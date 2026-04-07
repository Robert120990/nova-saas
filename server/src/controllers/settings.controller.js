const pool = require('../config/db');

const getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM system_settings WHERE company_id = ?', [req.company_id]);
        if (rows.length === 0) {
            // Devuelve valores por defecto si no existen
            return res.json({ system_name: 'SAAS SV', logo_url: null });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener configuración' });
    }
};

const updateSettings = async (req, res) => {
    const { system_name, logo_url } = req.body;
    try {
        // Usar ON DUPLICATE KEY UPDATE para manejar creación/actualización
        await pool.query(
            `INSERT INTO system_settings (company_id, system_name, logo_url) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE system_name = VALUES(system_name), logo_url = VALUES(logo_url)`,
            [req.company_id, system_name, logo_url]
        );
        res.json({ message: 'Configuración actualizada exitosamente' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error al actualizar configuración' });
    }
};

const getPublicSettings = async (req, res) => {
    try {
        // Obtener la configuración del sistema (global o la primera empresa activa)
        const [rows] = await pool.query('SELECT system_name, logo_url FROM system_settings LIMIT 1');
        if (rows.length === 0) {
            return res.json({ system_name: 'SAAS SV', logo_url: null });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener configuración pública' });
    }
};

module.exports = { getSettings, updateSettings, getPublicSettings };
