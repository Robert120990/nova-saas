const { assertPayrollPeriodEditable, applyCommissionToPayroll } = require('./commissionPayroll.service');

const syncIndustrialCommissions = async (req, res, pool) => {
    const connection = pool;
    try {
        const { periodo_anio, periodo_mes, quincena = 'segunda' } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        if (!periodo_anio || !periodo_mes) {
            return res.status(400).json({ message: 'periodo_anio y periodo_mes son requeridos' });
        }
        await assertPayrollPeriodEditable(connection, companyId, periodo_anio, periodo_mes, quincena);
        // Comparte el orden de bloqueo con el cálculo y la transferencia individual.
        await connection.query('SELECT id FROM sellers WHERE company_id = ? ORDER BY id FOR UPDATE', [companyId]);

        // 1. Obtener comisiones registradas de huevo industrial para este período
        const [commRows] = await connection.query(
            `SELECT c.*, s.nombre as seller_name
             FROM egg_seller_commissions c
             JOIN sellers s ON c.seller_id = s.id
             WHERE c.company_id = ? AND c.period_year = ? AND c.period_month = ?
               AND c.employee_id IS NOT NULL AND (c.quincena = ? OR (c.quincena = 'mensual' AND ? = 'segunda')) FOR UPDATE`,
            [companyId, periodo_anio, periodo_mes, quincena, quincena]
        );

        let commList = commRows;
        if (commList.length === 0) {
            // Auto-calcular comisiones si los vendedores tienen empleado vinculado y ventas
            const [sellers] = await connection.query(
                `SELECT s.id as seller_id, s.nombre as seller_name, s.employee_id,
                        g.target_volume_lbs, g.target_min_price_lb, g.commission_rate_per_lb, g.commission_cap_usd
                 FROM sellers s
                 LEFT JOIN egg_seller_goals g 
                        ON s.id = g.seller_id 
                       AND g.period_year = ? 
                       AND g.period_month = ?
                       AND g.company_id = ?
                 WHERE s.company_id = ? AND s.status = 'activo' AND s.is_egg_seller = 1 AND s.employee_id IS NOT NULL`,
                [periodo_anio, periodo_mes, companyId, companyId]
            );

            if (sellers.length > 0) {
                const startDate = `${periodo_anio}-${String(periodo_mes).padStart(2, '0')}-01`;
                const lastDay = new Date(periodo_anio, periodo_mes, 0).getDate();
                const endDate = `${periodo_anio}-${String(periodo_mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                for (const s of sellers) {
                    const cap = parseFloat(s.commission_cap_usd !== null && s.commission_cap_usd !== undefined ? s.commission_cap_usd : 1000.00);
                    const rate = parseFloat(s.commission_rate_per_lb || 0.0150);

                    const [orderStats] = await connection.query(
                        `SELECT COUNT(*) as orders_count,
                                COALESCE(SUM(quantity_lbs), 0) as total_lbs,
                                COALESCE(SUM(quantity_lbs * COALESCE(price_per_lb, 1.25)), 0) as total_sales
                         FROM egg_customer_orders
                         WHERE company_id = ? 
                           AND (seller_id = ? OR (seller_id IS NULL AND ? = 1))
                           AND delivery_status = 'entregado'
                           AND DATE(delivered_at) BETWEEN ? AND ?`,
                        [companyId, s.seller_id, sellers.length === 1 ? 1 : 0, startDate, endDate]
                    );

                    const ordersCount = parseInt(orderStats[0]?.orders_count || 0);
                    const totalLbs = parseFloat(orderStats[0]?.total_lbs || 0);
                    const totalSales = parseFloat(orderStats[0]?.total_sales || 0);
                    const avgPrice = totalLbs > 0 ? totalSales / totalLbs : 0;
                    const rawComm = Math.round(totalLbs * rate * 100) / 100;
                    const cappedComm = Math.min(rawComm, cap);
                    const isCapped = rawComm > cap ? 1 : 0;

                    if (totalLbs > 0 || rawComm > 0) {
                        await connection.query(
                            `INSERT INTO egg_seller_commissions
                                (company_id, seller_id, employee_id, period_year, period_month, quincena,
                                 total_orders_count, total_lbs_delivered, total_sales_amount, avg_price_per_lb,
                                 commission_rate_used, raw_commission_amount, capped_commission_amount, is_capped, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador')
                             ON DUPLICATE KEY UPDATE
                                employee_id = VALUES(employee_id),
                                total_orders_count = VALUES(total_orders_count),
                                total_lbs_delivered = VALUES(total_lbs_delivered),
                                total_sales_amount = VALUES(total_sales_amount),
                                avg_price_per_lb = VALUES(avg_price_per_lb),
                                commission_rate_used = VALUES(commission_rate_used),
                                raw_commission_amount = VALUES(raw_commission_amount),
                                capped_commission_amount = VALUES(capped_commission_amount),
                                is_capped = VALUES(is_capped),
                                updated_at = NOW()`,
                            [
                                companyId, s.seller_id, s.employee_id, periodo_anio, periodo_mes, quincena,
                                ordersCount, totalLbs, totalSales, avgPrice, rate, rawComm, cappedComm, isCapped
                            ]
                        );
                    }
                }

                const [refreshedRows] = await connection.query(
                    `SELECT c.*, s.nombre as seller_name
                     FROM egg_seller_commissions c
                     JOIN sellers s ON c.seller_id = s.id
                     WHERE c.company_id = ? AND c.period_year = ? AND c.period_month = ?
                       AND c.employee_id IS NOT NULL AND (c.quincena = ? OR (c.quincena = 'mensual' AND ? = 'segunda')) FOR UPDATE`,
                    [companyId, periodo_anio, periodo_mes, quincena, quincena]
                );
                commList = refreshedRows;
            }
        }

        if (commList.length === 0) {
            return res.json({ 
                success: true, 
                synced_count: 0, 
                message: 'No se encontraron comisiones o entregas de huevo industrial vinculadas a empleados para este período.' 
            });
        }

        // 2. Localizar o crear la cuenta de COMISIONES (código '07')
        const [cuentaRows] = await connection.query(
            `SELECT id, codigo, descripcion, operacion FROM rh_cuentas_planillas 
             WHERE company_id = ? AND (codigo = '07' OR descripcion LIKE '%COMISION%') 
             LIMIT 1`,
            [companyId]
        );
        let cuentaComisiones = cuentaRows[0];
        if (!cuentaComisiones) {
            const [newC] = await connection.query(
                `INSERT INTO rh_cuentas_planillas 
                    (company_id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden)
                 VALUES (?, '07', 'COMISIONES', 'sumar', 'valor', 1, 1, 1, 7)`,
                [companyId]
            );
            cuentaComisiones = { id: newC.insertId, codigo: '07', descripcion: 'COMISIONES', operacion: 'sumar' };
        }

        let syncedCount = 0;

        for (const comm of commList) {
            if (comm.status === 'pagado' || (comm.status === 'transferido_planilla' && comm.transferred_to_planilla_id)) continue;
            const cappedAmount = parseFloat(comm.capped_commission_amount || 0);
            if (cappedAmount <= 0) continue;
            await applyCommissionToPayroll(connection, companyId, comm, cuentaComisiones, quincena);
            syncedCount++;
        }

        res.json({
            success: true,
            synced_count: syncedCount,
            message: `Se sincronizaron exitosamente las comisiones (con tope de $1,000) de ${syncedCount} vendedor(es) en la Planilla de RH.`
        });
    } catch (error) {
        console.error('[RH Planilla] Error in syncIndustrialCommissions:', error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

module.exports = { syncIndustrialCommissions };
