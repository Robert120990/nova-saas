const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v272: Descuentos y Cortesías en Restaurante ---');

        // Columnas para restaurant_orders
        const orderColumnsToAdd = [
            { name: 'discount_type', sql: "ALTER TABLE restaurant_orders ADD COLUMN discount_type VARCHAR(20) DEFAULT 'none' AFTER subtotal" },
            { name: 'discount_value', sql: "ALTER TABLE restaurant_orders ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0.00 AFTER discount_type" },
            { name: 'discount_amount', sql: "ALTER TABLE restaurant_orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00 AFTER discount_value" },
            { name: 'discount_reason', sql: "ALTER TABLE restaurant_orders ADD COLUMN discount_reason VARCHAR(255) NULL AFTER discount_amount" },
            { name: 'discount_by', sql: "ALTER TABLE restaurant_orders ADD COLUMN discount_by INT NULL AFTER discount_reason" }
        ];

        for (const col of orderColumnsToAdd) {
            const [exists] = await pool.query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurant_orders' AND COLUMN_NAME = ?
            `, [col.name]);

            if (exists.length === 0) {
                await pool.query(col.sql);
                console.log(`✓ Columna ${col.name} agregada a restaurant_orders`);
            } else {
                console.log(`✓ Columna ${col.name} ya existe en restaurant_orders`);
            }
        }

        // Columnas para restaurant_order_items
        const itemColumnsToAdd = [
            { name: 'discount_type', sql: "ALTER TABLE restaurant_order_items ADD COLUMN discount_type VARCHAR(20) DEFAULT 'none' AFTER unit_price" },
            { name: 'discount_value', sql: "ALTER TABLE restaurant_order_items ADD COLUMN discount_value DECIMAL(10,2) DEFAULT 0.00 AFTER discount_type" },
            { name: 'discount_amount', sql: "ALTER TABLE restaurant_order_items ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00 AFTER discount_value" },
            { name: 'discount_reason', sql: "ALTER TABLE restaurant_order_items ADD COLUMN discount_reason VARCHAR(255) NULL AFTER discount_amount" },
            { name: 'discount_by', sql: "ALTER TABLE restaurant_order_items ADD COLUMN discount_by INT NULL AFTER discount_reason" }
        ];

        for (const col of itemColumnsToAdd) {
            const [exists] = await pool.query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'restaurant_order_items' AND COLUMN_NAME = ?
            `, [col.name]);

            if (exists.length === 0) {
                await pool.query(col.sql);
                console.log(`✓ Columna ${col.name} agregada a restaurant_order_items`);
            } else {
                console.log(`✓ Columna ${col.name} ya existe en restaurant_order_items`);
            }
        }

        console.log('--- Migración v272 finalizada con éxito ---');
    } catch (err) {
        console.error('Error en migración v272:', err);
        throw err;
    }
}

module.exports = { migrate };
