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
        console.log('Iniciando ejecución de migración v196...');
        const migrationPath = path.join(__dirname, 'migration_v196_fix_cat_002_tipo_dte.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        await pool.query(sql);
        console.log('Migración v196 aplicada correctamente.');

        // Verificaciones
        const [catRows] = await pool.query('SELECT code, description FROM cat_002_tipo_dte ORDER BY code');
        console.log('Catálogo cat_002_tipo_dte actualizado:');
        console.table(catRows);

        const [purchaseRows] = await pool.query(`
            SELECT id, numero_documento, tipo_documento_id 
            FROM purchase_headers 
            WHERE id IN (33, 74, 76, 102, 123, 143, 149, 155, 157)
            ORDER BY id
        `);
        console.log('Compras históricas actualizadas:');
        console.table(purchaseRows);

        console.log('OK: Migración v196 completada con éxito.');
    } catch (err) {
        console.error('Error en migración v196:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
