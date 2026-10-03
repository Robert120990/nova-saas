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
        const { settings, remove, expected_settings } = req.body;
        const keys = [...new Set([...Object.keys(settings || {}), ...(Array.isArray(remove) ? remove : [])])];
        if (keys.some(key => /^PARTIDA_(VENTAS|COMPRAS|CXC|CXP|CIERRE|APERTURA)_/i.test(key))) {
            throw new Error('Los marcadores de partidas generadas no se pueden modificar desde la configuración');
        }
        await conn.beginTransaction();
        if (expected_settings !== undefined) {
            if (!expected_settings || Array.isArray(expected_settings) || typeof expected_settings !== 'object' ||
                keys.some(key => !Object.hasOwn(expected_settings, key))) {
                throw new Error('Debe indicar la versión previa de cada ajuste que desea modificar');
            }
            const [previous] = keys.length ? await conn.query(
                'SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ? AND setting_key IN (?) FOR UPDATE',
                [req.company_id, keys]
            ) : [[]];
            const values = Object.fromEntries(previous.map(row => [row.setting_key, row.setting_value]));
            const normalized = value => value === undefined || value === null ? null : String(value);
            const conflicts = keys.filter(key => normalized(values[key]) !== normalized(expected_settings[key]))
                .map(key => ({ key, expected: normalized(expected_settings[key]), current: normalized(values[key]) }));
            if (conflicts.length) {
                const conflict = new Error('La configuración cambió desde que se abrió. Se conservaron tus cambios pendientes; compara los valores guardados antes de volver a guardar.');
                conflict.statusCode = 409;
                conflict.conflicts = conflicts;
                throw conflict;
            }
        }
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
        res.status(e.statusCode || 400).json({ message: e.message, ...(e.conflicts ? { conflicts: e.conflicts } : {}) });
    } finally { conn.release(); }
};


module.exports = { getSettings, saveSettings };
