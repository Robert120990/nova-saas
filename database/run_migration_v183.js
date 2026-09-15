const mysql = require('mysql2/promise');
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
        console.log('Iniciando migración v183: detalle de tarimas en producción y vínculo con calendario...');

        // 1. Columnas en batch_raw_materials
        const [[hasTarimasJson]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'batch_raw_materials' AND COLUMN_NAME = 'tarimas_json'`,
            [process.env.DB_NAME]
        );
        if (!hasTarimasJson || hasTarimasJson.n === 0) {
            await pool.query('ALTER TABLE batch_raw_materials ADD COLUMN tarimas_json JSON NULL AFTER quantity_lbs');
            console.log('OK: Columna batch_raw_materials.tarimas_json agregada.');
        }

        const [[hasBoxesCount]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'batch_raw_materials' AND COLUMN_NAME = 'boxes_count'`,
            [process.env.DB_NAME]
        );
        if (!hasBoxesCount || hasBoxesCount.n === 0) {
            await pool.query('ALTER TABLE batch_raw_materials ADD COLUMN boxes_count INT DEFAULT 0 AFTER tarimas_json');
            console.log('OK: Columna batch_raw_materials.boxes_count agregada.');
        }

        // 2. Columna en egg_production_batches
        const [[hasSchedId]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'scheduled_production_id'`,
            [process.env.DB_NAME]
        );
        if (!hasSchedId || hasSchedId.n === 0) {
            await pool.query('ALTER TABLE egg_production_batches ADD COLUMN scheduled_production_id INT NULL AFTER batch_code_display');
            console.log('OK: Columna egg_production_batches.scheduled_production_id agregada.');
            
            try {
                await pool.query('CREATE INDEX idx_epb_scheduled_prod ON egg_production_batches(scheduled_production_id)');
                console.log('OK: Índice idx_epb_scheduled_prod creado.');
            } catch (e) {
                // Índice podría ya existir
            }
        }

        console.log('OK: Migración v183 finalizada con éxito.');
    } catch (err) {
        console.error('Error en migración v183:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
