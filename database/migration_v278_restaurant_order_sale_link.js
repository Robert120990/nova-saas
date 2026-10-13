const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v278: Enlace de Comandas con Ventas Fiscales (sale_id) ---');

        const [exists] = await pool.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurant_orders' AND COLUMN_NAME = 'sale_id'
        `);

        if (exists.length === 0) {
            await pool.query(`
                ALTER TABLE restaurant_orders 
                ADD COLUMN sale_id INT NULL AFTER company_id,
                ADD INDEX idx_rest_orders_sale (sale_id)
            `);
            console.log('✓ Columna sale_id e índice agregados a restaurant_orders');
        } else {
            console.log('✓ Columna sale_id ya existe en restaurant_orders');
        }

        console.log('--- Migración v278 completada exitosamente ---');
        process.exit(0);
    } catch (err) {
        console.error('Error en migración v278:', err);
        process.exit(1);
    }
}

migrate();
