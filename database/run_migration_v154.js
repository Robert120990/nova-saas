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
        const migrationPath = path.join(__dirname, 'migration_v154_linked_documents_montos.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migracion v154 aplicada: columnas monto_sujeto, iva_retenido, descripcion en sales_linked_documents');

        for (const col of ['monto_sujeto', 'iva_retenido', 'descripcion']) {
            const [[c]] = await pool.query(
                `SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sales_linked_documents' AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, col]
            );
            if (!c || c.n === 0) throw new Error(`Columna sales_linked_documents.${col} no existe tras la migracion`);
        }
        console.log('OK: migracion v154 completa.');
    } catch (err) {
        console.error('Error en migracion v154:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
