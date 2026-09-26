const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: process.env.DB_CONNECTION_LIMIT ? Number(process.env.DB_CONNECTION_LIMIT) : 25,
    queueLimit: 0,
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000
});

// Capture and log pool-level connection errors to prevent unhandled socket reset crashes
pool.on('error', (err) => {
    console.error('[MySQL Pool Error]', err.code || err.message);
});

module.exports = pool;
