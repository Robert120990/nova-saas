const pool = require('../../config/db');
const { getRestaurantConfig } = require('../../services/restaurant.service');

async function getConfig(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;

        const config = await getRestaurantConfig(companyId, branchId);
        res.json({ success: true, data: config });
    } catch (err) {
        console.error('Error in getConfig:', err);
        res.status(500).json({ success: false, message: 'Error al consultar configuración de restaurante' });
    }
}

async function updateConfig(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.body?.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const {
            enable_tips,
            default_tip_percentage,
            tip_is_optional,
            kds_warning_minutes,
            kds_danger_minutes,
            auto_print_comanda,
            allowed_categories
        } = req.body;

        const allowedCategoriesJson = allowed_categories !== undefined
            ? (Array.isArray(allowed_categories) ? JSON.stringify(allowed_categories.map(Number)) : null)
            : null;

        let selectSql = "SELECT id FROM restaurant_config WHERE company_id = ?";
        const selectParams = [companyId];
        if (branchId) {
            selectSql += " AND branch_id = ?";
            selectParams.push(branchId);
        } else {
            selectSql += " AND branch_id IS NULL";
        }
        selectSql += " ORDER BY id DESC LIMIT 1";

        const [existing] = await pool.query(selectSql, selectParams);

        if (existing.length > 0) {
            await pool.query(`
                UPDATE restaurant_config SET
                    enable_tips = COALESCE(?, enable_tips),
                    default_tip_percentage = COALESCE(?, default_tip_percentage),
                    tip_is_optional = COALESCE(?, tip_is_optional),
                    kds_warning_minutes = COALESCE(?, kds_warning_minutes),
                    kds_danger_minutes = COALESCE(?, kds_danger_minutes),
                    auto_print_comanda = COALESCE(?, auto_print_comanda),
                    allowed_categories = ?
                WHERE id = ?
            `, [
                enable_tips !== undefined ? (enable_tips ? 1 : 0) : null,
                default_tip_percentage !== undefined ? default_tip_percentage : null,
                tip_is_optional !== undefined ? (tip_is_optional ? 1 : 0) : null,
                kds_warning_minutes !== undefined ? kds_warning_minutes : null,
                kds_danger_minutes !== undefined ? kds_danger_minutes : null,
                auto_print_comanda !== undefined ? (auto_print_comanda ? 1 : 0) : null,
                allowedCategoriesJson,
                existing[0].id
            ]);
        } else {
            await pool.query(`
                INSERT INTO restaurant_config (
                    company_id, branch_id, enable_tips, default_tip_percentage,
                    tip_is_optional, kds_warning_minutes, kds_danger_minutes, auto_print_comanda, allowed_categories
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                companyId,
                branchId,
                enable_tips !== undefined ? (enable_tips ? 1 : 0) : 1,
                default_tip_percentage !== undefined ? default_tip_percentage : 10.00,
                tip_is_optional !== undefined ? (tip_is_optional ? 1 : 0) : 1,
                kds_warning_minutes !== undefined ? kds_warning_minutes : 10,
                kds_danger_minutes !== undefined ? kds_danger_minutes : 18,
                auto_print_comanda !== undefined ? (auto_print_comanda ? 1 : 0) : 0,
                allowedCategoriesJson
            ]);
        }

        const updated = await getRestaurantConfig(companyId, branchId);
        res.json({ success: true, message: 'Configuración guardada exitosamente', data: updated });
    } catch (err) {
        console.error('Error in updateConfig:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar configuración de restaurante' });
    }
}

module.exports = {
    getConfig,
    updateConfig
};
