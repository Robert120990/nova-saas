const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v203: Mejoras de Pedidos de Ovoproductos y Despachos ---');

        // 1. Columnas en egg_customer_orders
        const [orderCols] = await pool.query('DESCRIBE egg_customer_orders');
        const orderColNames = orderCols.map(c => c.Field);

        if (!orderColNames.includes('items_json')) {
            await pool.query('ALTER TABLE egg_customer_orders ADD COLUMN items_json JSON NULL AFTER notes');
            console.log('  → Columna items_json agregada a egg_customer_orders.');
        } else {
            console.log('  ✓ Columna items_json ya existe en egg_customer_orders.');
        }

        if (!orderColNames.includes('batch_id')) {
            await pool.query('ALTER TABLE egg_customer_orders ADD COLUMN batch_id INT NULL AFTER items_json');
            console.log('  → Columna batch_id agregada a egg_customer_orders.');
        } else {
            console.log('  ✓ Columna batch_id ya existe en egg_customer_orders.');
        }

        if (!orderColNames.includes('lot_code')) {
            await pool.query('ALTER TABLE egg_customer_orders ADD COLUMN lot_code VARCHAR(100) NULL AFTER batch_id');
            console.log('  → Columna lot_code agregada a egg_customer_orders.');
        } else {
            console.log('  ✓ Columna lot_code ya existe en egg_customer_orders.');
        }

        // 2. Columnas en egg_dispatch_stops
        const [stopCols] = await pool.query('DESCRIBE egg_dispatch_stops');
        const stopColNames = stopCols.map(c => c.Field);

        if (!stopColNames.includes('batch_id')) {
            await pool.query('ALTER TABLE egg_dispatch_stops ADD COLUMN batch_id INT NULL AFTER dte_codigo_generacion');
            console.log('  → Columna batch_id agregada a egg_dispatch_stops.');
        } else {
            console.log('  ✓ Columna batch_id ya existe en egg_dispatch_stops.');
        }

        if (!stopColNames.includes('lot_code')) {
            await pool.query('ALTER TABLE egg_dispatch_stops ADD COLUMN lot_code VARCHAR(100) NULL AFTER batch_id');
            console.log('  → Columna lot_code agregada a egg_dispatch_stops.');
        } else {
            console.log('  ✓ Columna lot_code ya existe en egg_dispatch_stops.');
        }

        if (!stopColNames.includes('quantity_delivered_lbs')) {
            await pool.query('ALTER TABLE egg_dispatch_stops ADD COLUMN quantity_delivered_lbs DECIMAL(12,2) NULL AFTER lot_code');
            console.log('  → Columna quantity_delivered_lbs agregada a egg_dispatch_stops.');
        } else {
            console.log('  ✓ Columna quantity_delivered_lbs ya existe en egg_dispatch_stops.');
        }

        console.log('--- Migración v203 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v203:', error);
        process.exit(1);
    }
}

runMigration();
