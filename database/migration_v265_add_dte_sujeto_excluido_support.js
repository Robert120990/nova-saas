const fs = require('fs');
const path = require('path');

async function columnExists(pool, table, column) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows[0].total > 0;
}

async function indexExists(pool, table, indexName) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
    );
    return rows[0].total > 0;
}

async function migrate(pool) {
    console.log('[Migration v265] Starting Sujeto Excluido (DTE-14) schema migration...');

    // 1. Columnas en tabla 'dtes'
    if (!(await columnExists(pool, 'dtes', 'gasto_id'))) {
        await pool.query('ALTER TABLE dtes ADD COLUMN gasto_id INT NULL DEFAULT NULL AFTER venta_id');
        console.log('  -> Added dtes.gasto_id');
    }
    if (!(await columnExists(pool, 'dtes', 'compra_id'))) {
        await pool.query('ALTER TABLE dtes ADD COLUMN compra_id INT NULL DEFAULT NULL AFTER gasto_id');
        console.log('  -> Added dtes.compra_id');
    }
    if (!(await indexExists(pool, 'dtes', 'idx_dtes_gasto_id'))) {
        await pool.query('ALTER TABLE dtes ADD INDEX idx_dtes_gasto_id (company_id, gasto_id)');
        console.log('  -> Added index idx_dtes_gasto_id');
    }
    if (!(await indexExists(pool, 'dtes', 'idx_dtes_compra_id'))) {
        await pool.query('ALTER TABLE dtes ADD INDEX idx_dtes_compra_id (company_id, compra_id)');
        console.log('  -> Added index idx_dtes_compra_id');
    }

    // 2. Columna en 'expense_headers'
    if (!(await columnExists(pool, 'expense_headers', 'estado_dte'))) {
        await pool.query('ALTER TABLE expense_headers ADD COLUMN estado_dte VARCHAR(50) NULL DEFAULT NULL AFTER sello_recepcion');
        console.log('  -> Added expense_headers.estado_dte');
    }

    // 3. Columnas en 'purchase_headers'
    if (!(await columnExists(pool, 'purchase_headers', 'codigo_generacion'))) {
        await pool.query('ALTER TABLE purchase_headers ADD COLUMN codigo_generacion VARCHAR(36) NULL DEFAULT NULL AFTER numero_documento');
        console.log('  -> Added purchase_headers.codigo_generacion');
    }
    if (!(await columnExists(pool, 'purchase_headers', 'estado_dte'))) {
        await pool.query('ALTER TABLE purchase_headers ADD COLUMN estado_dte VARCHAR(50) NULL DEFAULT NULL AFTER sello_recepcion');
        console.log('  -> Added purchase_headers.estado_dte');
    }

    // 4. Columna en 'purchase_items'
    if (!(await columnExists(pool, 'purchase_items', 'tipo_item'))) {
        await pool.query('ALTER TABLE purchase_items ADD COLUMN tipo_item TINYINT NOT NULL DEFAULT 1 AFTER product_id');
        console.log('  -> Added purchase_items.tipo_item');
    }

    console.log('[Migration v265] Completed successfully.');
}

module.exports = { migrate };
