async function migrate(pool) {
    // 1. Columnas parent_batch_id e is_coproduct en egg_production_batches
    const [batchCols] = await pool.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'parent_batch_id'"
    );
    if (batchCols.length === 0) {
        await pool.query(`
            ALTER TABLE egg_production_batches
            ADD COLUMN parent_batch_id INT NULL DEFAULT NULL AFTER scheduled_production_id,
            ADD COLUMN is_coproduct TINYINT(1) NOT NULL DEFAULT 0 AFTER parent_batch_id,
            ADD INDEX idx_epb_parent (company_id, parent_batch_id)
        `);
        console.log('[Migration v235] Agregadas columnas parent_batch_id e is_coproduct a egg_production_batches.');
    }

    // 2. Columna is_shared en batch_raw_materials
    const [brmCols] = await pool.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_raw_materials' AND COLUMN_NAME = 'is_shared'"
    );
    if (brmCols.length === 0) {
        await pool.query(`
            ALTER TABLE batch_raw_materials
            ADD COLUMN is_shared TINYINT(1) NOT NULL DEFAULT 0 AFTER boxes_count
        `);
        console.log('[Migration v235] Agregada columna is_shared a batch_raw_materials.');
    }

    // 3. Columnas parent_production_id e is_coproduct en egg_scheduled_productions
    const [schedCols] = await pool.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_scheduled_productions' AND COLUMN_NAME = 'parent_production_id'"
    );
    if (schedCols.length === 0) {
        await pool.query(`
            ALTER TABLE egg_scheduled_productions
            ADD COLUMN parent_production_id INT NULL DEFAULT NULL AFTER batch_id,
            ADD COLUMN is_coproduct TINYINT(1) NOT NULL DEFAULT 0 AFTER parent_production_id,
            ADD INDEX idx_esp_parent (company_id, parent_production_id)
        `);
        console.log('[Migration v235] Agregadas columnas parent_production_id e is_coproduct a egg_scheduled_productions.');
    }
}

module.exports = { migrate };
