const mysql = require('../server/node_modules/mysql2/promise');
const path = require('path');
require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
        multipleStatements: true
    });

    console.log('[Migration v230] Starting migration v230...');

    // 1. Columnas en egg_production_batches
    const batchCols = [
        { name: 'pasteurization_lot', sql: 'ALTER TABLE egg_production_batches ADD COLUMN pasteurization_lot VARCHAR(100) NULL AFTER batch_code_display' },
        { name: 'pasteurization_status', sql: "ALTER TABLE egg_production_batches ADD COLUMN pasteurization_status ENUM('pendiente', 'en_proceso', 'pasteurizado', 'cerrado') NOT NULL DEFAULT 'pendiente' AFTER status" },
        { name: 'pasteurization_closed_at', sql: 'ALTER TABLE egg_production_batches ADD COLUMN pasteurization_closed_at DATETIME NULL AFTER completed_at' },
        { name: 'pasteurization_closed_by', sql: 'ALTER TABLE egg_production_batches ADD COLUMN pasteurization_closed_by VARCHAR(150) NULL AFTER pasteurization_closed_at' }
    ];

    for (const col of batchCols) {
        const [existing] = await connection.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = ?",
            [col.name]
        );
        if (existing.length === 0) {
            await connection.query(col.sql);
            console.log(`[Migration v230] Added column ${col.name} to egg_production_batches.`);
        }
    }

    // 2. Columna en egg_pasteurization_logs
    const [pastLotCols] = await connection.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_pasteurization_logs' AND COLUMN_NAME = 'pasteurization_lot'"
    );
    if (pastLotCols.length === 0) {
        await connection.query('ALTER TABLE egg_pasteurization_logs ADD COLUMN pasteurization_lot VARCHAR(100) NULL AFTER batch_id');
        console.log('[Migration v230] Added column pasteurization_lot to egg_pasteurization_logs.');
    }

    // 3. Insertar nuevo permiso en menu_items para matriz de roles (hijo de Producción)
    const [permItem] = await connection.query(
        "SELECT id FROM menu_items WHERE permission_key = 'manage_egg_production_lots'"
    );
    if (permItem.length === 0) {
        await connection.query(`
            INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active, hide_in_menu)
            VALUES ('Editar Lotes y Cierre Pasteurización', NULL, 'Layers', 'manage_egg_production_lots', 67, 99, 1, 1)
        `);
        console.log('[Migration v230] Inserted permission_key manage_egg_production_lots into menu_items.');
    }

    // 4. Actualizar roles de SuperAdmin y Admin para asignar el nuevo permiso
    await connection.query(`
        UPDATE roles 
        SET permissions = JSON_ARRAY_APPEND(
            permissions, 
            '$', 
            'manage_egg_production_lots'
        )
        WHERE id IN (1, 2) 
          AND NOT JSON_CONTAINS(permissions, '"manage_egg_production_lots"')
    `);
    console.log('[Migration v230] Updated roles permissions with manage_egg_production_lots.');

    console.log('[Migration v230] Migration completed successfully.');
    await connection.end();
}

run().catch(err => {
    console.error('[Migration v230] ERROR:', err);
    process.exit(1);
});
