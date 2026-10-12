const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v271: Categorías por Estación de Restaurante ---');

        // 1. Agregar columna category_ids a restaurant_stations si no existe
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'restaurant_stations' 
              AND COLUMN_NAME = 'category_ids'
        `);

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE restaurant_stations 
                ADD COLUMN category_ids JSON NULL AFTER printer_ip_or_name;
            `);
            console.log('✓ Columna category_ids agregada a restaurant_stations');
        } else {
            console.log('✓ Columna category_ids ya existe en restaurant_stations');
        }

        console.log('--- Migración v271 finalizada con éxito ---');
    } catch (err) {
        console.error('Error en migración v271:', err);
        throw err;
    }
}

module.exports = { migrate };
