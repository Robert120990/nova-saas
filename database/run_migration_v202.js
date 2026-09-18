const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas'
    });

    try {
        console.log('--- Migración v202: Destino (PISTA / TIENDA) en purchase_quedans ---');

        const [tables] = await pool.query(
            `SELECT 1 FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_quedans' LIMIT 1`
        );

        if (tables.length === 0) {
            throw new Error('No existe la tabla purchase_quedans.');
        }

        const [cols] = await pool.query(
            `SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_quedans' AND COLUMN_NAME = 'destino' LIMIT 1`
        );

        if (cols.length === 0) {
            await pool.query(
                `ALTER TABLE purchase_quedans
                 ADD COLUMN destino CHAR(1) NOT NULL DEFAULT 'T' COMMENT 'P = Pista, T = Tienda' AFTER dias_credito,
                 ADD INDEX idx_destino (destino)`
            );
            console.log("  ✓ Columna 'destino' (DEFAULT 'T') e índice idx_destino agregados a purchase_quedans.");
        } else {
            console.log("  → La columna 'destino' ya existe en purchase_quedans.");
        }

        console.log('--- Migración v202 completada exitosamente. ---');
    } catch (error) {
        console.error('Error en migración v202:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
