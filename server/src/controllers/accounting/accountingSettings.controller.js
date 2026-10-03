const pool = require('../../config/db');

const getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ?', [req.company_id]);
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json(settings);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const saveSettings = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { settings, remove } = req.body;
        const keys = [...Object.keys(settings || {}), ...(Array.isArray(remove) ? remove : [])];
        if (keys.some(key => /^PARTIDA_(VENTAS|COMPRAS|CXC|CXP)_/.test(key))) {
            throw new Error('Los marcadores de partidas generadas no se pueden modificar desde la configuración');
        }
        await conn.beginTransaction();
        for (const [key, value] of Object.entries(settings || {})) {
            if (value !== null && value !== undefined) {
                await conn.query(
                    'INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [req.company_id, key, String(value), String(value)]
                );
            }
        }
        if (Array.isArray(remove) && remove.length > 0) {
            for (const key of remove) {
                if (typeof key === 'string' && key.trim() !== '') {
                    await conn.query('DELETE FROM accounting_settings WHERE company_id = ? AND setting_key = ?', [req.company_id, key]);
                }
            }
        }
        await conn.commit();
        res.json({ message: 'Configuración guardada' });
    } catch (e) {
        await conn.rollback();
        res.status(400).json({ message: e.message });
    } finally { conn.release(); }
};


module.exports = { getSettings, saveSettings };
