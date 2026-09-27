const { pool } = require('./shared');

const calculatePeriodCommissions = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { year, month, quincena = 'segunda' } = req.body;

        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || (new Date().getMonth() + 1);
        if (!['primera', 'segunda', 'mensual'].includes(quincena) || currentMonth < 1 || currentMonth > 12 || currentYear < 2000) throw Object.assign(new Error('Período inválido.'), { status: 400 });

        // 1. Obtener todos los vendedores activos
        const [sellers] = await connection.query(
            `SELECT s.id as seller_id, s.nombre as seller_name, s.employee_id,
                    g.target_volume_lbs, g.target_min_price_lb, g.commission_rate_per_lb, g.commission_cap_usd
             FROM sellers s
             LEFT JOIN egg_seller_goals g
                    ON s.id = g.seller_id
                   AND g.period_year = ?
                   AND g.period_month = ?
                   AND g.company_id = ?
             WHERE s.company_id = ? AND s.status = 'activo' AND s.is_egg_seller = 1 ORDER BY s.id FOR UPDATE`,
            [currentYear, currentMonth, companyId, companyId]
        );

        const results = [];

        // Rango de fechas del mes
        const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        for (const s of sellers) {
            const [previous] = await connection.query('SELECT * FROM egg_seller_commissions WHERE company_id = ? AND seller_id = ? AND period_year = ? AND period_month = ? FOR UPDATE', [companyId, s.seller_id, currentYear, currentMonth]);
            if (previous.some(row => row.quincena !== quincena)) throw Object.assign(new Error('La comisión mensual ya tiene una quincena de pago. Use esa liquidación; no se puede duplicar el mes.'), { status: 409 });
            if (previous.some(row => ['transferido_planilla', 'pagado'].includes(row.status))) {
                results.push({ seller_id: s.seller_id, status: previous[0].status, unchanged: true });
                continue;
            }
            const cap = parseFloat(s.commission_cap_usd !== null && s.commission_cap_usd !== undefined ? s.commission_cap_usd : 1000.00);
            const rate = parseFloat(s.commission_rate_per_lb ?? 0.0150);

            // Consultar pedidos entregados asignados al vendedor
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
            const isCapped = rawComm > cap;

            // Upsert en egg_seller_commissions
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
                    companyId, s.seller_id, s.employee_id, currentYear, currentMonth, quincena,
                    ordersCount, totalLbs, totalSales, avgPrice, rate, rawComm, cappedComm, isCapped ? 1 : 0
                ]
            );

            results.push({
                seller_id: s.seller_id,
                seller_name: s.seller_name,
                employee_id: s.employee_id,
                total_orders_count: ordersCount,
                total_lbs_delivered: totalLbs,
                total_sales_amount: totalSales,
                avg_price_per_lb: avgPrice,
                commission_rate: rate,
                raw_commission: rawComm,
                capped_commission: cappedComm,
                is_capped: isCapped,
                cap_usd: cap,
                cap_pct_reached: cap > 0 ? Math.min(100, Math.round((rawComm / cap) * 10000) / 100) : 100
            });
        }

        await connection.commit();
        res.json({
            success: true,
            period: { year: currentYear, month: currentMonth, quincena },
            commissions: results
        });
    } catch (error) {
        await connection.rollback();
        console.error('[EggCommissions] Error in calculatePeriodCommissions:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally { connection.release(); }
};
module.exports = { calculatePeriodCommissions };
