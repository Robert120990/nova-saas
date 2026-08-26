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
        const migrationPath = path.join(__dirname, 'migration_v151_correlativos_partidas.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v151 aplicada: tabla accounting_entry_correlativos y menu verificados');

        const [[t]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'accounting_entry_correlativos'`,
            [process.env.DB_NAME]
        );
        if (!t || t.n === 0) throw new Error('La tabla accounting_entry_correlativos no existe tras la migracion');
        console.log('OK: migracion v151 completa');
    } catch (err) {
        console.error('Error en migracion v151:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
