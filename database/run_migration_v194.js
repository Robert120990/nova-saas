const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const [[exists]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'expense_headers' AND COLUMN_NAME = 'anticipo_cuenta'`,
            [process.env.DB_NAME]
        );

        if (exists && exists.n > 0) {
            console.log('Columna expense_headers.anticipo_cuenta ya existe. Omitiendo ALTER TABLE.');
        } else {
            const migrationPath = path.join(__dirname, 'migration_v194_expense_headers_anticipo_cuenta.sql');
            const sql = fs.readFileSync(migrationPath, 'utf8');
            await pool.query(sql);
            console.log('Migración v194 aplicada: columna anticipo_cuenta en expense_headers');
        }

        const [[c]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'expense_headers' AND COLUMN_NAME = 'anticipo_cuenta'`,
            [process.env.DB_NAME]
        );
        if (!c || c.n === 0) throw new Error('Columna expense_headers.anticipo_cuenta no existe tras la migración');
        console.log('OK: migración v194 completa.');
    } catch (err) {
        console.error('Error en migración v194:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
