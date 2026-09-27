const { pool } = require('./shared');

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
module.exports = { simulateCommission, getSellersAndEmployees, linkSellerToEmployee, getSellerGoals, saveSellerGoal };
