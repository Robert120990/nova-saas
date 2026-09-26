const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v227: Optimización de Índices Compuestos de Rendimiento ---');

        // 1. Índices para inventory_movements (Kárdex y Orígenes)
        const [movIndexes] = await pool.query('SHOW INDEX FROM inventory_movements');
        const movIndexNames = new Set(movIndexes.map(i => i.Key_name));

        if (!movIndexNames.has('idx_mov_prod_branch_date')) {
            console.log('  → Creando índice idx_mov_prod_branch_date en inventory_movements...');
            await pool.query('ALTER TABLE inventory_movements ADD INDEX idx_mov_prod_branch_date (product_id, branch_id, created_at DESC)');
            console.log('  ✓ Índice idx_mov_prod_branch_date creado.');
        } else {
            console.log('  ✓ Índice idx_mov_prod_branch_date ya existe.');
        }

        if (!movIndexNames.has('idx_mov_origin')) {
            console.log('  → Creando índice idx_mov_origin en inventory_movements...');
            await pool.query('ALTER TABLE inventory_movements ADD INDEX idx_mov_origin (tipo_documento, documento_id)');
            console.log('  ✓ Índice idx_mov_origin creado.');
        } else {
            console.log('  ✓ Índice idx_mov_origin ya existe.');
        }

        // 2. Índices para sales_headers (Consultas históricas de ventas por fecha y empresa)
        const [salesIndexes] = await pool.query('SHOW INDEX FROM sales_headers');
        const salesIndexNames = new Set(salesIndexes.map(i => i.Key_name));

        if (!salesIndexNames.has('idx_sales_company_fecha')) {
            console.log('  → Creando índice idx_sales_company_fecha en sales_headers...');
            await pool.query('ALTER TABLE sales_headers ADD INDEX idx_sales_company_fecha (company_id, fecha_emision)');
            console.log('  ✓ Índice idx_sales_company_fecha creado.');
        } else {
            console.log('  ✓ Índice idx_sales_company_fecha ya existe.');
        }

        // 3. Índices para purchase_headers (Consultas históricas de compras por fecha y empresa)
        const [purchaseIndexes] = await pool.query('SHOW INDEX FROM purchase_headers');
        const purchaseIndexNames = new Set(purchaseIndexes.map(i => i.Key_name));

        if (!purchaseIndexNames.has('idx_purchases_company_fecha')) {
            console.log('  → Creando índice idx_purchases_company_fecha en purchase_headers...');
            await pool.query('ALTER TABLE purchase_headers ADD INDEX idx_purchases_company_fecha (company_id, fecha)');
            console.log('  ✓ Índice idx_purchases_company_fecha creado.');
        } else {
            console.log('  ✓ Índice idx_purchases_company_fecha ya existe.');
        }

        console.log('--- Migración v227 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v227:', error);
        process.exit(1);
    }
}

runMigration();
