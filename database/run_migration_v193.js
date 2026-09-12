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
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_headers' AND COLUMN_NAME = 'num_quedan'`,
            [process.env.DB_NAME]
        );

        if (exists && exists.n > 0) {
            console.log('Columna purchase_headers.num_quedan ya existe. Omitiendo ALTER TABLE.');
        } else {
            const migrationPath = path.join(__dirname, 'migration_v193_purchase_headers_num_quedan.sql');
            const sql = fs.readFileSync(migrationPath, 'utf8');
            await pool.query(sql);
            console.log('Migración v193 aplicada: columna num_quedan en purchase_headers');
        }

        const [[c]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_headers' AND COLUMN_NAME = 'num_quedan'`,
            [process.env.DB_NAME]
        );
        if (!c || c.n === 0) throw new Error('Columna purchase_headers.num_quedan no existe tras la migración');
        console.log('OK: migración v193 completa.');
    } catch (err) {
        console.error('Error en migración v193:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
