const pool = require('../config/db');

/**
 * 1. SIMULADOR INTERACTIVO DE COMISIONES CON TOPE RÍGIDO DE $1,000
 */
const simulateCommission = async (req, res) => {
    try {
        const params = { ...req.query, ...req.body };
        const {
            lbs = 60000,
            sale_price_per_lb = 1.30,
            plant_cost_per_lb = 1.05,
            rate_per_lb = 0.0150,
            cap_usd = 1000.00
        } = params;

        const volumeLbs = Math.max(0, parseFloat(lbs) || 0);
        const salePrice = Math.max(0, parseFloat(sale_price_per_lb) || 0);
        const plantCost = Math.max(0, parseFloat(plant_cost_per_lb) || 0);
        const rate = Math.max(0, parseFloat(rate_per_lb) || 0.015);
        const cap = Math.max(0, parseFloat(cap_usd) !== undefined ? parseFloat(cap_usd) : 1000.00);

        // Cálculos base
        const totalSalesAmount = Math.round(volumeLbs * salePrice * 100) / 100;
        const totalCostAmount = Math.round(volumeLbs * plantCost * 100) / 100;
        const companyGrossMargin = Math.round((totalSalesAmount - totalCostAmount) * 100) / 100;
        const companyMarginPct = totalSalesAmount > 0 
            ? Math.round((companyGrossMargin / totalSalesAmount) * 10000) / 100 
            : 0;

        const rawCommission = Math.round(volumeLbs * rate * 100) / 100;
        const cappedCommission = Math.min(rawCommission, cap);
        const isCapped = rawCommission > cap;
        const companyNetMargin = Math.round((companyGrossMargin - cappedCommission) * 100) / 100;
        const capPctReached = cap > 0 
            ? Math.min(100, Math.round((rawCommission / cap) * 10000) / 100) 
            : 100;

        // Libras necesarias para el tope exacto
        const lbsNeededForCap = rate > 0 ? Math.ceil(cap / rate) : 0;
        const lbsRemainingForCap = Math.max(0, lbsNeededForCap - volumeLbs);

        // Tabla de sensibilidad en tramos
        const steps = [20000, 40000, 60000, lbsNeededForCap, 80000, 100000];
        const uniqueSteps = [...new Set(steps)].sort((a, b) => a - b);

        const sensitivityTable = uniqueSteps.map(stepLbs => {
            const stepSales = Math.round(stepLbs * salePrice * 100) / 100;
            const stepCost = Math.round(stepLbs * plantCost * 100) / 100;
            const stepGross = Math.round((stepSales - stepCost) * 100) / 100;
            const stepRawComm = Math.round(stepLbs * rate * 100) / 100;
            const stepCappedComm = Math.min(stepRawComm, cap);
            const stepNet = Math.round((stepGross - stepCappedComm) * 100) / 100;
            return {
                lbs: stepLbs,
                sales_amount: stepSales,
                gross_margin: stepGross,
                raw_commission: stepRawComm,
                capped_commission: stepCappedComm,
                is_capped: stepRawComm >= cap,
                net_company_margin: stepNet,
                commission_pct_of_margin: stepGross > 0 ? Math.round((stepCappedComm / stepGross) * 10000) / 100 : 0
            };
        });

        res.json({
            inputs: {
                volume_lbs: volumeLbs,
                sale_price_per_lb: salePrice,
                plant_cost_per_lb: plantCost,
                commission_rate_per_lb: rate,
                commission_cap_usd: cap
            },
            results: {
                total_sales_amount: totalSalesAmount,
                total_cost_amount: totalCostAmount,
                company_gross_margin: companyGrossMargin,
                company_margin_pct: companyMarginPct,
                raw_commission: rawCommission,
                capped_commission: cappedCommission,
                is_capped: isCapped,
                excess_commission_retained: Math.max(0, Math.round((rawCommission - cappedCommission) * 100) / 100),
                company_net_margin: companyNetMargin,
                cap_pct_reached: capPctReached,
                lbs_needed_for_cap: lbsNeededForCap,
                lbs_remaining_for_cap: lbsRemainingForCap
            },
            sensitivity_table: sensitivityTable
        });
    } catch (error) {
        console.error('[EggCommissions] Error in simulateCommission:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 2. LISTAR VENDEDORES Y EMPLEADOS PARA VINCULACIÓN MULTI-EMPLEADO
 */
const getSellersAndEmployees = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;

        // Vendedores
        const [sellers] = await pool.query(
            `SELECT s.id, s.nombre, s.status, s.employee_id, s.is_egg_seller,
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base as empleado_sueldo_base,
                    c.descripcion as cargo_nombre
             FROM sellers s
             LEFT JOIN rh_empleados e ON s.employee_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             WHERE s.company_id = ? AND s.status = 'activo' AND s.is_egg_seller = 1
             ORDER BY s.nombre ASC`,
            [companyId]
        );

        // Vendedores generales del sistema disponibles para asignar si se desea
        const [otherSellers] = await pool.query(
            `SELECT s.id, s.nombre, s.status, s.employee_id
             FROM sellers s
             WHERE s.company_id = ? AND s.status = 'activo' AND (s.is_egg_seller = 0 OR s.is_egg_seller IS NULL)
             ORDER BY s.nombre ASC`,
            [companyId]
        );

        // Lista de empleados disponibles de RH para vincular
        const [employees] = await pool.query(
            `SELECT id, codigo, nombres, apellidos, sueldo_base
             FROM rh_empleados
             WHERE company_id = ? AND es_activo = 1
             ORDER BY nombres ASC, apellidos ASC`,
            [companyId]
        );

        res.json({ sellers, employees, otherSellers });
    } catch (error) {
        console.error('[EggCommissions] Error in getSellersAndEmployees:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 3. VINCULAR VENDEDOR CON EMPLEADO DE NÓMINA
 */
const linkSellerToEmployee = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { seller_id, employee_id } = req.body;

        if (!seller_id) {
            return res.status(400).json({ message: 'seller_id es requerido' });
        }

        await pool.query(
            `UPDATE sellers SET employee_id = ? WHERE id = ? AND company_id = ?`,
            [employee_id || null, seller_id, companyId]
        );

        res.json({ success: true, message: 'Vinculación de vendedor con empleado actualizada.' });
    } catch (error) {
        console.error('[EggCommissions] Error in linkSellerToEmployee:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 4. GESTIÓN DE METAS POR VENDEDOR / PERÍODO
 */
const getSellerGoals = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { year, month } = req.query;

        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || (new Date().getMonth() + 1);

        const [goals] = await pool.query(
            `SELECT g.*, 
                    s.nombre as seller_name, 
                    s.employee_id,
                    e.codigo as empleado_codigo,
                    CONCAT(e.nombres, ' ', e.apellidos) as empleado_nombre_completo,
                    e.sueldo_base as empleado_sueldo_base
             FROM egg_seller_goals g
             JOIN sellers s ON g.seller_id = s.id
             LEFT JOIN rh_empleados e ON s.employee_id = e.id
             WHERE g.company_id = ? AND g.period_year = ? AND g.period_month = ?
             ORDER BY s.nombre ASC`,
            [companyId, currentYear, currentMonth]
        );

        res.json(goals);
    } catch (error) {
        console.error('[EggCommissions] Error in getSellerGoals:', error);
        res.status(500).json({ message: error.message });
    }
};

const saveSellerGoal = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const {
            seller_id,
            period_year,
            period_month,
            target_volume_lbs = 60000,
            target_amount_usd = 78000,
            target_min_price_lb = 1.25,
            commission_rate_per_lb = 0.0150,
            commission_cap_usd = 1000.00,
            notes
        } = req.body;

        if (!seller_id || !period_year || !period_month) {
            return res.status(400).json({ message: 'seller_id, period_year y period_month son requeridos' });
        }

        // Obtener employee_id del vendedor
        const [sellerRows] = await pool.query(
            `SELECT employee_id FROM sellers WHERE id = ? AND company_id = ?`,
            [seller_id, companyId]
        );
        const employeeId = sellerRows[0]?.employee_id || null;

        await pool.query(
            `INSERT INTO egg_seller_goals 
                (company_id, seller_id, employee_id, period_year, period_month, target_volume_lbs, target_amount_usd, target_min_price_lb, commission_rate_per_lb, commission_cap_usd, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                employee_id = VALUES(employee_id),
                target_volume_lbs = VALUES(target_volume_lbs),
                target_amount_usd = VALUES(target_amount_usd),
                target_min_price_lb = VALUES(target_min_price_lb),
                commission_rate_per_lb = VALUES(commission_rate_per_lb),
                commission_cap_usd = VALUES(commission_cap_usd),
                notes = VALUES(notes),
                updated_at = NOW()`,
            [
                companyId, seller_id, employeeId, period_year, period_month,
                target_volume_lbs, target_amount_usd, target_min_price_lb,
                commission_rate_per_lb, commission_cap_usd, notes || null
            ]
        );

        res.json({ success: true, message: 'Meta comercial guardada con éxito.' });
    } catch (error) {
        console.error('[EggCommissions] Error in saveSellerGoal:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 5. LIQUIDACIÓN Y CÁLCULO DE COMISIONES DEL PERÍODO CON TOPE DE $1,000
 */
const calculatePeriodCommissions = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { year, month, quincena = 'segunda' } = req.body;

        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || (new Date().getMonth() + 1);

        // 1. Obtener todos los vendedores activos
        const [sellers] = await pool.query(
            `SELECT s.id as seller_id, s.nombre as seller_name, s.employee_id,
                    g.target_volume_lbs, g.target_min_price_lb, g.commission_rate_per_lb, g.commission_cap_usd
             FROM sellers s
             LEFT JOIN egg_seller_goals g 
                    ON s.id = g.seller_id 
                   AND g.period_year = ? 
                   AND g.period_month = ?
                   AND g.company_id = ?
             WHERE s.company_id = ? AND s.status = 'activo' AND s.is_egg_seller = 1`,
            [currentYear, currentMonth, companyId, companyId]
        );

        const results = [];

        // Rango de fechas del mes
        const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(currentYear, currentMonth, 0).getDate();
        const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        for (const s of sellers) {
            const cap = parseFloat(s.commission_cap_usd !== null && s.commission_cap_usd !== undefined ? s.commission_cap_usd : 1000.00);
            const rate = parseFloat(s.commission_rate_per_lb || 0.0150);

            // Consultar pedidos entregados asignados al vendedor
            const [orderStats] = await pool.query(
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
            await pool.query(
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

        res.json({
            success: true,
            period: { year: currentYear, month: currentMonth, quincena },
            commissions: results
        });
    } catch (error) {
        console.error('[EggCommissions] Error in calculatePeriodCommissions:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 6. TRANSFERIR COMISIÓN TOPADA AL MÓDULO DE PLANILLAS (RH)
 */
const transferCommissionToPayroll = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { commission_id, seller_id, year, month, quincena = 'segunda' } = req.body;

        // 1. Obtener registro de comisión
        let comm;
        if (commission_id) {
            const [rows] = await connection.query(
                `SELECT * FROM egg_seller_commissions WHERE id = ? AND company_id = ?`,
                [commission_id, companyId]
            );
            comm = rows[0];
        } else if (seller_id && year && month) {
            const [rows] = await connection.query(
                `SELECT * FROM egg_seller_commissions 
                 WHERE seller_id = ? AND period_year = ? AND period_month = ? AND quincena = ? AND company_id = ?`,
                [seller_id, year, month, quincena, companyId]
            );
            comm = rows[0];
        }

        if (!comm) {
            await connection.rollback();
            return res.status(404).json({ message: 'No se encontró la liquidación de comisión especificada.' });
        }

        if (!comm.employee_id) {
            await connection.rollback();
            return res.status(400).json({ 
                message: 'El vendedor no tiene un Empleado de Planilla (RH) vinculado. Vincúlelo primero en el módulo de Vendedores.' 
            });
        }

        const commissionAmount = parseFloat(comm.capped_commission_amount || 0);
        if (commissionAmount <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El monto de la comisión es $0.00. No hay saldo para transferir.' });
        }

        // 2. Localizar o asegurar cuenta de COMISIONES (código '07') en rh_cuentas_planillas
        const [cuentaRows] = await connection.query(
            `SELECT id, codigo, descripcion, operacion FROM rh_cuentas_planillas 
             WHERE company_id = ? AND (codigo = '07' OR descripcion LIKE '%COMISION%') 
             LIMIT 1`,
            [companyId]
        );
        let cuentaComisiones = cuentaRows[0];
        if (!cuentaComisiones) {
            const [newCuenta] = await connection.query(
                `INSERT INTO rh_cuentas_planillas 
                    (company_id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden)
                 VALUES (?, '07', 'COMISIONES', 'sumar', 'valor', 1, 1, 1, 7)`,
                [companyId]
            );
            cuentaComisiones = { id: newCuenta.insertId, codigo: '07', descripcion: 'COMISIONES', operacion: 'sumar' };
        }

        // 3. Buscar planilla abierta para este empleado en el período indicado
        const [planillaRows] = await connection.query(
            `SELECT * FROM rh_planillas 
             WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [companyId, comm.employee_id, comm.period_year, comm.period_month, comm.quincena]
        );

        let planillaId;
        if (planillaRows.length > 0) {
            if (planillaRows[0].estado === 'pagada') {
                await connection.rollback();
                return res.status(400).json({ message: 'La planilla para este período ya fue PAGADA y CERRADA. No se puede modificar.' });
            }
            planillaId = planillaRows[0].id;
        } else {
            // Obtener sueldo base del empleado
            const [emp] = await connection.query(
                `SELECT sueldo_base, bonificacion_fija FROM rh_empleados WHERE id = ? AND company_id = ?`,
                [comm.employee_id, companyId]
            );
            const sueldoBase = parseFloat(emp[0]?.sueldo_base || 0);
            const bonifFija = parseFloat(emp[0]?.bonificacion_fija || 0);

            const [newPlanilla] = await connection.query(
                `INSERT INTO rh_planillas 
                    (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija, estado)
                 VALUES (?, ?, ?, ?, ?, 15, ?, ?, 'pendiente')`,
                [companyId, comm.employee_id, comm.period_year, comm.period_month, comm.quincena, sueldoBase, bonifFija]
            );
            planillaId = newPlanilla.insertId;
        }

        // 4. Inyectar o actualizar detalle de comisión en rh_planilla_detalles
        const [existingDetail] = await connection.query(
            `SELECT id FROM rh_planilla_detalles WHERE planilla_id = ? AND cuenta_id = ?`,
            [planillaId, cuentaComisiones.id]
        );

        if (existingDetail.length > 0) {
            await connection.query(
                `UPDATE rh_planilla_detalles 
                 SET valor_ingresado = ?, valor_base = ? 
                 WHERE id = ?`,
                [commissionAmount, commissionAmount, existingDetail[0].id]
            );
        } else {
            await connection.query(
                `INSERT INTO rh_planilla_detalles
                    (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
                 VALUES (?, ?, ?, ?, 'sumar', 'valor', ?, ?, 7)`,
                [planillaId, cuentaComisiones.id, cuentaComisiones.codigo, cuentaComisiones.descripcion, commissionAmount, commissionAmount]
            );
        }

        // 5. Recalcular percepciones y total de la planilla
        const [detalles] = await connection.query(
            `SELECT operacion, valor_ingresado FROM rh_planilla_detalles WHERE planilla_id = ?`,
            [planillaId]
        );

        let percepciones = 0;
        let deducciones = 0;
        detalles.forEach(d => {
            const val = parseFloat(d.valor_ingresado || 0);
            if (d.operacion === 'sumar') percepciones += val;
            else deducciones += val;
        });

        const [pInfo] = await connection.query(`SELECT sueldo_base FROM rh_planillas WHERE id = ?`, [planillaId]);
        const sBaseQuincena = (parseFloat(pInfo[0]?.sueldo_base || 0) / 2);
        const totalPercepciones = Math.round((sBaseQuincena + percepciones) * 100) / 100;
        const totalDeducciones = Math.round(deducciones * 100) / 100;
        const montoRecibir = Math.max(0, Math.round((totalPercepciones - totalDeducciones) * 100) / 100);

        await connection.query(
            `UPDATE rh_planillas 
             SET total_percepciones = ?, total_deducciones = ?, monto_recibir = ?, updated_at = NOW() 
             WHERE id = ?`,
            [totalPercepciones, totalDeducciones, montoRecibir, planillaId]
        );

        // 6. Actualizar estado en egg_seller_commissions
        await connection.query(
            `UPDATE egg_seller_commissions 
             SET status = 'transferido_planilla', transferred_to_planilla_id = ?, transferred_at = NOW() 
             WHERE id = ?`,
            [planillaId, comm.id]
        );

        await connection.commit();

        res.json({
            success: true,
            message: `Comisión de $${commissionAmount.toFixed(2)} transferida exitosamente a la Planilla #${planillaId} de Recursos Humanos.`,
            planilla_id: planillaId,
            commission_amount: commissionAmount
        });
    } catch (error) {
        await connection.rollback();
        console.error('[EggCommissions] Error in transferCommissionToPayroll:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

/**
 * 7. RESUMEN GLOBAL PARA CONSOLA DE GESTIÓN
 */
const getCommissionsSummary = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { year, month } = req.query;

        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || (new Date().getMonth() + 1);

        const [rows] = await pool.query(
            `SELECT c.*, 
                    s.nombre as seller_name,
                    e.codigo as empleado_codigo,
                    CONCAT(e.nombres, ' ', e.apellidos) as empleado_nombre_completo,
                    e.sueldo_base as empleado_sueldo_base,
                    g.target_volume_lbs,
                    g.commission_cap_usd
             FROM egg_seller_commissions c
             JOIN sellers s ON c.seller_id = s.id
             LEFT JOIN rh_empleados e ON c.employee_id = e.id
             LEFT JOIN egg_seller_goals g 
                    ON c.seller_id = g.seller_id 
                   AND c.period_year = g.period_year 
                   AND c.period_month = g.period_month
             WHERE c.company_id = ? AND c.period_year = ? AND c.period_month = ?
             ORDER BY s.nombre ASC, c.quincena ASC`,
            [companyId, currentYear, currentMonth]
        );

        res.json(rows);
    } catch (error) {
        console.error('[EggCommissions] Error in getCommissionsSummary:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 8. REGISTRAR O ASIGNAR UN VENDEDOR EXCLUSIVO PARA HUEVO INDUSTRIAL
 */
const createEggSeller = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const {
            employee_id = null,
            seller_id = null,
            nombre = '',
            target_volume_lbs = 60000,
            target_min_price_lb = 1.25,
            commission_rate_per_lb = 0.0150,
            commission_cap_usd = 1000.00,
            period_year = new Date().getFullYear(),
            period_month = new Date().getMonth() + 1
        } = req.body;

        let effectiveSellerId = seller_id;

        if (effectiveSellerId) {
            // Promover vendedor existente del sistema
            await pool.query(
                `UPDATE sellers SET is_egg_seller = 1, employee_id = COALESCE(?, employee_id) WHERE id = ? AND company_id = ?`,
                [employee_id || null, effectiveSellerId, companyId]
            );
        } else {
            // Crear nuevo perfil de vendedor para huevo industrial
            let sellerName = nombre?.trim();
            if (!sellerName && employee_id) {
                const [empRows] = await pool.query(
                    `SELECT nombres, apellidos FROM rh_empleados WHERE id = ? AND company_id = ?`,
                    [employee_id, companyId]
                );
                if (empRows.length > 0) {
                    sellerName = `${empRows[0].nombres} ${empRows[0].apellidos}`.trim();
                }
            }
            if (!sellerName) {
                return res.status(400).json({ message: 'El nombre del vendedor o la selección de empleado es obligatoria.' });
            }

            // Obtener sucursal por defecto
            const [branchRows] = await pool.query(
                `SELECT id FROM branches WHERE company_id = ? ORDER BY es_casa_matriz DESC, id ASC LIMIT 1`,
                [companyId]
            );
            const branchId = branchRows[0]?.id || null;

            const [result] = await pool.query(
                `INSERT INTO sellers (company_id, branch_id, nombre, employee_id, is_egg_seller, status, allow_price_edit)
                 VALUES (?, ?, ?, ?, 1, 'activo', 1)`,
                [companyId, branchId, sellerName, employee_id || null]
            );
            effectiveSellerId = result.insertId;
        }

        // Crear meta inicial
        if (effectiveSellerId) {
            await pool.query(
                `INSERT INTO egg_seller_goals 
                    (company_id, seller_id, employee_id, period_year, period_month, target_volume_lbs, target_min_price_lb, commission_rate_per_lb, commission_cap_usd)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    employee_id = VALUES(employee_id),
                    target_volume_lbs = VALUES(target_volume_lbs),
                    target_min_price_lb = VALUES(target_min_price_lb),
                    commission_rate_per_lb = VALUES(commission_rate_per_lb),
                    commission_cap_usd = VALUES(commission_cap_usd),
                    updated_at = NOW()`,
                [companyId, effectiveSellerId, employee_id || null, period_year, period_month, target_volume_lbs, target_min_price_lb, commission_rate_per_lb, commission_cap_usd]
            );
        }

        res.json({
            success: true,
            message: 'Vendedor de Huevo Industrial registrado exitosamente.',
            seller_id: effectiveSellerId
        });
    } catch (error) {
        console.error('[EggCommissions] Error in createEggSeller:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * 9. QUITAR VENDEDOR DE HUEVO INDUSTRIAL
 */
const removeEggSeller = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { seller_id } = req.body;
        if (!seller_id) return res.status(400).json({ message: 'seller_id es requerido' });

        await pool.query(
            `UPDATE sellers SET is_egg_seller = 0 WHERE id = ? AND company_id = ?`,
            [seller_id, companyId]
        );

        res.json({ success: true, message: 'Vendedor removido del módulo de Huevo Industrial.' });
    } catch (error) {
        console.error('[EggCommissions] Error in removeEggSeller:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    simulateCommission,
    getSellersAndEmployees,
    linkSellerToEmployee,
    getSellerGoals,
    saveSellerGoal,
    calculatePeriodCommissions,
    transferCommissionToPayroll,
    getCommissionsSummary,
    createEggSeller,
    removeEggSeller
};
