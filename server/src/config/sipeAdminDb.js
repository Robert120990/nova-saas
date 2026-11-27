const mysql = require('mysql2/promise');

let sipeAdminPool = null;

/**
 * Return a lazy singleton mysql2 connection pool for db_sipe_admin.
 */
function getSipeAdminPool() {
    if (sipeAdminPool) return sipeAdminPool;
    sipeAdminPool = mysql.createPool({
        host: process.env.SIPE_ADMIN_DB_HOST || process.env.RRS_DB_HOST || process.env.DB_HOST,
        port: Number(process.env.SIPE_ADMIN_DB_PORT || process.env.RRS_DB_PORT || process.env.DB_PORT || 3306),
        user: process.env.SIPE_ADMIN_DB_USER || process.env.RRS_DB_USER || process.env.DB_USER,
        password: process.env.SIPE_ADMIN_DB_PASSWORD || process.env.RRS_DB_PASSWORD || process.env.DB_PASSWORD,
        database: process.env.SIPE_ADMIN_DB_NAME || 'db_sipe_admin',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        decimalNumbers: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000
    });
    return sipeAdminPool;
}

/**
 * Determine active bank sync targets from BANK_SYNC_TARGET env var.
 * Valid modes: 'both' (default), 'rrs', 'sipe_admin'.
 */
function getBankSyncTargets() {
    const rawMode = String(process.env.BANK_SYNC_TARGET || 'both').trim().toLowerCase();
    const mode = ['both', 'rrs', 'sipe_admin'].includes(rawMode) ? rawMode : 'both';
    return {
        mode,
        writeRrs: mode === 'both' || mode === 'rrs',
        writeSipeAdmin: mode === 'both' || mode === 'sipe_admin',
        isSipeAdminPrimary: mode === 'sipe_admin'
    };
}

module.exports = { getSipeAdminPool, getBankSyncTargets };
