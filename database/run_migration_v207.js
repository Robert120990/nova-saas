const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v207: Añadir gas_credito_id a customer_payments ---');

        const [columns] = await pool.query('SHOW COLUMNS FROM customer_payments LIKE "gas_credito_id"');
        if (columns.length === 0) {
            console.log('  → Añadiendo columna gas_credito_id y llave foránea a customer_payments...');
            await pool.query(`
                ALTER TABLE customer_payments
                ADD COLUMN gas_credito_id INT DEFAULT NULL AFTER sale_id,
                ADD CONSTRAINT fk_cp_gas_credito FOREIGN KEY (gas_credito_id) 
                    REFERENCES gas_station_closeout_creditos(id) ON DELETE SET NULL,
                ADD INDEX idx_cp_gas_credito (gas_credito_id)
            `);
            console.log('  ✓ Columna gas_credito_id añadida exitosamente.');
        } else {
            console.log('  ✓ Columna gas_credito_id ya existe en customer_payments.');
        }

        console.log('--- Migración v207 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v207:', error);
        process.exit(1);
    }
}

runMigration();
