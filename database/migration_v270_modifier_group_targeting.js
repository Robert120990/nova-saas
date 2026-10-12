const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v270: Vinculación de Modificadores por Categoría o Producto ---');

        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'restaurant_modifier_groups'
        `);

        const columnNames = columns.map(c => c.COLUMN_NAME.toLowerCase());

        if (!columnNames.includes('applies_to')) {
            await pool.query(`
                ALTER TABLE restaurant_modifier_groups 
                ADD COLUMN applies_to ENUM('all', 'categories', 'products') NOT NULL DEFAULT 'categories' AFTER name
            `);
            console.log('✓ Columna applies_to agregada a restaurant_modifier_groups');
        }

        if (!columnNames.includes('target_category_ids')) {
            await pool.query(`
                ALTER TABLE restaurant_modifier_groups 
                ADD COLUMN target_category_ids JSON NULL AFTER applies_to
            `);
            console.log('✓ Columna target_category_ids agregada a restaurant_modifier_groups');
        }

        if (!columnNames.includes('target_product_ids')) {
            await pool.query(`
                ALTER TABLE restaurant_modifier_groups 
                ADD COLUMN target_product_ids JSON NULL AFTER target_category_ids
            `);
            console.log('✓ Columna target_product_ids agregada a restaurant_modifier_groups');
        }

        console.log('--- Migración v270 completada exitosamente ---');
        process.exit(0);
    } catch (err) {
        console.error('Error ejecutando migración v270:', err);
        process.exit(1);
    }
}

migrate();
