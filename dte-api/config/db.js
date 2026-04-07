const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'sysadmin',
    password: process.env.DB_PASSWORD || 'QwErTy123',
    database: process.env.DB_NAME || 'db_sistema_saas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true
});

module.exports = pool;
