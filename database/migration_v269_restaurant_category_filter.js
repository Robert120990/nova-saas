const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v269: Filtro de Categorías para Comanda de Restaurante ---');

        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'restaurant_config' 
              AND COLUMN_NAME = 'allowed_categories'
        `);

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE restaurant_config 
                ADD COLUMN allowed_categories JSON NULL AFTER auto_print_comanda
            `);
            console.log('✓ Columna allowed_categories agregada a restaurant_config');
        } else {
            console.log('✓ Columna allowed_categories ya existe en restaurant_config');
        }

        console.log('--- Migración v269 completada exitosamente ---');
        process.exit(0);
    } catch (err) {
        console.error('Error ejecutando migración v269:', err);
        process.exit(1);
    }
}

migrate();
