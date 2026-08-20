const mysql = require('mysql2/promise');
const pool = require('../config/db');
const { decrypt } = require('../utils/crypto');

const OFFICE_KEYS = ['oficina_db_host', 'oficina_db_port', 'oficina_db_user', 'oficina_db_password', 'oficina_db_name'];

const officePools = new Map();

async function getOfficeConfig(companyId) {
    const [rows] = await pool.query(
        'SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ? AND setting_key IN (?, ?, ?, ?, ?)',
        [companyId, ...OFFICE_KEYS]
    );
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    return {
        host: settings.oficina_db_host || '',
        port: settings.oficina_db_port ? parseInt(settings.oficina_db_port) : 3306,
        user: settings.oficina_db_user || '',
        password: decrypt(settings.oficina_db_password),
        database: settings.oficina_db_name || ''
    };
}

function createOfficePool(config) {
    return mysql.createPool({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password || '',
        database: config.database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        decimalNumbers: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
        connectTimeout: 10000
    });
}

function getOfficePool(config) {
    const key = [config.host, config.port, config.user, config.database].join('|');
    const cached = officePools.get(key);
    if (cached) return cached;
    const officePool = createOfficePool(config);
    officePools.set(key, officePool);
    return officePool;
}

function destroyOfficePools() {
    officePools.forEach(p => p.end().catch(() => {}));
    officePools.clear();
}

async function testConnection(config) {
    const conn = await mysql.createConnection({
        host: config.host,
        port: config.port || 3306,
        user: config.user,
        password: config.password || '',
        database: config.database,
        connectTimeout: 10000
    });
    try {
        const [rows] = await conn.query('SELECT VERSION() AS version');
        return { version: rows[0]?.version || 'desconocida' };
    } finally {
        conn.end().catch(() => {});
    }
}

module.exports = { getOfficeConfig, getOfficePool, destroyOfficePools, testConnection, OFFICE_KEYS };