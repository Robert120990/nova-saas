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
        const migrationPath = path.join(__dirname, 'migration_v156_omitir_digito_verificador.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v156 aplicada: columna branches.omitir_digito_verificador');

        const [[c]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'omitir_digito_verificador'`,
            [process.env.DB_NAME]
        );
        if (!c || c.n === 0) throw new Error('Columna branches.omitir_digito_verificador no existe tras la migracion');
        console.log('OK: migracion v156 completa.');
    } catch (err) {
        console.error('Error en migracion v156:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
