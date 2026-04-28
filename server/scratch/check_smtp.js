const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSmtp() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [rows] = await connection.execute('SELECT host, user, port, from_email, branch_id FROM smtp_settings');
        console.log('--- SMTP SETTINGS ---');
        console.table(rows);
    } catch (err) {
        console.error('Error checking SMTP:', err.message);
    } finally {
        await connection.end();
    }
}

checkSmtp();
