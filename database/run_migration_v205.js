const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v205: Facturación Automática de Despachos y Control de Ventas ---');

        // 1. Columnas en egg_dispatch_stops
        const [stopCols] = await pool.query('DESCRIBE egg_dispatch_stops');
        const stopColNames = stopCols.map(c => c.Field);

        if (!stopColNames.includes('sale_id')) {
            await pool.query('ALTER TABLE egg_dispatch_stops ADD COLUMN sale_id INT NULL AFTER dte_codigo_generacion');
            await pool.query('ALTER TABLE egg_dispatch_stops ADD INDEX idx_eds_sale (sale_id)');
            console.log('  → Columna sale_id e índice agregados a egg_dispatch_stops.');
        } else {
            console.log('  ✓ Columna sale_id ya existe en egg_dispatch_stops.');
        }

        // 2. Columnas en egg_customer_orders
        const [orderCols] = await pool.query('DESCRIBE egg_customer_orders');
        const orderColNames = orderCols.map(c => c.Field);

        if (!orderColNames.includes('sale_id')) {
            await pool.query('ALTER TABLE egg_customer_orders ADD COLUMN sale_id INT NULL AFTER dte_codigo_generacion');
            await pool.query('ALTER TABLE egg_customer_orders ADD INDEX idx_eco_sale (sale_id)');
            console.log('  → Columna sale_id e índice agregados a egg_customer_orders.');
        } else {
            console.log('  ✓ Columna sale_id ya existe en egg_customer_orders.');
        }

        console.log('--- Migración v205 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v205:', error);
        process.exit(1);
    }
}

runMigration();
