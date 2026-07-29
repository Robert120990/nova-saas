const mysql = require('mysql2/promise');

let rrsPool = null;

function getRrsPool() {
    if (rrsPool) return rrsPool;
    rrsPool = mysql.createPool({
        host: process.env.RRS_DB_HOST,
        user: process.env.RRS_DB_USER,
        password: process.env.RRS_DB_PASSWORD,
        database: process.env.RRS_DB_NAME || 'db_system_rrs',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        decimalNumbers: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000
    });
    return rrsPool;
}

module.exports = { getRrsPool };
