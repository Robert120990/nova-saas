const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    decimalNumbers: true
});

async function checkSchema() {
    try {
        const [tables] = await pool.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('--- START ---');
        for (const name of tableNames) {
            console.log(name);
        }
        console.log('--- END ---');
        process.exit(0);
    } catch (error) {
        process.exit(1);
    }
}

checkSchema();
