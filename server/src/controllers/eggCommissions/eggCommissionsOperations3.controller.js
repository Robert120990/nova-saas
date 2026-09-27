const { pool } = require('./shared');

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
module.exports = { createEggSeller, removeEggSeller };
