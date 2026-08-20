const pool = require('../config/db');
const { encrypt } = require('../utils/crypto');
const { getOfficeConfig, destroyOfficePools, testConnection, OFFICE_KEYS } = require('../services/officeDb.service');

const getConnection = async (req, res) => {
    try {
        const config = await getOfficeConfig(req.company_id);
        const { password, ...safe } = config;
        res.json(safe);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const saveConnection = async (req, res) => {
    try {
        const { host, port, user, password, database } = req.body;
        if (!host || !user || !database) {
            return res.status(400).json({ message: 'Servidor, usuario y nombre de base de datos son obligatorios' });
        }
        const portValue = port ? String(parseInt(port) || 3306) : '3306';

        const existing = await getOfficeConfig(req.company_id);
        const passwordToSave = password ? encrypt(password) : (existing.password ? encrypt(existing.password) : '');

        const values = {
            oficina_db_host: host,
            oficina_db_port: portValue,
            oficina_db_user: user,
            oficina_db_password: passwordToSave,
            oficina_db_name: database
        };
        for (const [key, value] of Object.entries(values)) {
            await pool.query(
                'INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [req.company_id, key, String(value), String(value)]
            );
        }

        destroyOfficePools();
        res.json({ message: 'Configuración de conexión guardada' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const test = async (req, res) => {
    try {
        const body = req.body || {};
        const saved = await getOfficeConfig(req.company_id);
        const config = {
            host: body.host || saved.host,
            port: body.port || saved.port,
            user: body.user || saved.user,
            password: body.password || saved.password,
            database: body.database || saved.database
        };
        if (!config.host || !config.user || !config.database) {
            return res.status(400).json({ message: 'Complete servidor, usuario y nombre de base de datos para probar la conexión' });
        }
        const { version } = await testConnection(config);
        res.json({ success: true, message: `Conexión exitosa a la base de datos (MySQL ${version})`, version });
    } catch (e) {
        res.status(400).json({ success: false, message: `Error de conexión: ${e.code || ''} ${e.message}`.trim() });
    }
};

module.exports = { getConnection, saveConnection, test };