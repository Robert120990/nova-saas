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
        const migrationPath = path.join(__dirname, 'migration_v181_purchase_headers_control_and_sello.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migración v181 aplicada: columnas numero_control y sello_recepcion en purchase_headers');

        for (const col of ['numero_control', 'sello_recepcion']) {
            const [[c]] = await pool.query(
                `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_headers' AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, col]
            );
            if (!c || c.n === 0) throw new Error(`Columna purchase_headers.${col} no existe tras la migración`);
        }
        console.log('OK: migración v181 completa.');
    } catch (err) {
        console.error('Error en migración v181:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
