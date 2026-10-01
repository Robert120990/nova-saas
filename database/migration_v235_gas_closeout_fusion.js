// Migración v235: Campos de trazabilidad para importación desde Fusion FFC en Cierres de Gasolinera

async function migrate(pool) {
    const [columns] = await pool.query('SHOW COLUMNS FROM gas_station_closeouts');
    const names = new Set(columns.map(c => c.Field));

    if (!names.has('fusion_shift_id')) {
        await pool.query('ALTER TABLE gas_station_closeouts ADD COLUMN fusion_shift_id INT NULL DEFAULT NULL AFTER observaciones');
        console.log('Columna fusion_shift_id agregada a gas_station_closeouts');
    }

    if (!names.has('fusion_sales_amount')) {
        await pool.query('ALTER TABLE gas_station_closeouts ADD COLUMN fusion_sales_amount DECIMAL(12, 2) NULL DEFAULT NULL AFTER fusion_shift_id');
        console.log('Columna fusion_sales_amount agregada a gas_station_closeouts');
    }

    if (!names.has('fusion_sales_volume')) {
        await pool.query('ALTER TABLE gas_station_closeouts ADD COLUMN fusion_sales_volume DECIMAL(12, 3) NULL DEFAULT NULL AFTER fusion_sales_amount');
        console.log('Columna fusion_sales_volume agregada a gas_station_closeouts');
    }

    if (!names.has('fusion_imported_at')) {
        await pool.query('ALTER TABLE gas_station_closeouts ADD COLUMN fusion_imported_at DATETIME NULL DEFAULT NULL AFTER fusion_sales_volume');
        console.log('Columna fusion_imported_at agregada a gas_station_closeouts');
    }

    // Verificar si el índice ya existe
    const [indexes] = await pool.query("SHOW INDEX FROM gas_station_closeouts WHERE Key_name = 'idx_closeouts_fusion_shift'");
    if (indexes.length === 0) {
        await pool.query('ALTER TABLE gas_station_closeouts ADD INDEX idx_closeouts_fusion_shift (company_id, fusion_shift_id)');
        console.log('Índice idx_closeouts_fusion_shift creado');
    }
}

module.exports = { migrate };
