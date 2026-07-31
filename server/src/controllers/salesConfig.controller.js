const pool = require('../config/db');

exports.getSettings = async (req, res) => {
    try {
        const branchId = req.user?.branch_id || null;
        const [rows] = await pool.query(
            'SELECT setting_key, setting_value FROM sales_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))',
            [req.company_id, branchId, branchId]
        );
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json(settings);
    } catch (error) {
        console.error('Error fetching sales settings:', error.message);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const branchId = req.user?.branch_id || null;
        const entries = req.body;

        for (const [key, value] of Object.entries(entries)) {
            if (value !== undefined) {
                await pool.query(
                    `INSERT INTO sales_settings (company_id, branch_id, setting_key, setting_value)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
                    [req.company_id, branchId, key, value]
                );
            }
        }

        res.json({ message: 'Configuración actualizada' });
    } catch (error) {
        console.error('Error updating sales settings:', error.message);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};
