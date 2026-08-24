const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    console.log('Using DB_HOST:', process.env.DB_HOST);
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v144_login_rate_limit.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v144 aplicada: tabla login_rate_limits verificada/creada');

        const [[tbl]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'login_rate_limits'`,
            [process.env.DB_NAME]
        );
        if (!tbl || tbl.n === 0) throw new Error('La tabla login_rate_limits no existe tras la migracion');
        console.log('OK: login_rate_limits presente en', process.env.DB_NAME);
    } catch (err) {
        console.error('Error en migracion v144:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
