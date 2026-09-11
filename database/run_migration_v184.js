const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
        multipleStatements: true
    });

    try {
        const migrationPath = path.join(__dirname, 'migration_v184_purchase_items_nullable_product_and_description.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('Migración v184 aplicada: product_id NULL y columna descripcion en purchase_items');

        const [cols] = await pool.query(
            `SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_items' AND COLUMN_NAME IN ('product_id', 'descripcion')`,
            [process.env.DB_NAME || 'db_sistema_saas']
        );
        console.table(cols);
        console.log('OK: migración v184 completa.');
    } catch (err) {
        console.error('Error en migración v184:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
