const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v232: Control Integral de Cubetas y Tapaderas y Estado de Cuenta ---');

        // 1. Columnas en egg_returnable_packaging
        const [packCols] = await pool.query('DESCRIBE egg_returnable_packaging');
        const packColNames = packCols.map(c => c.Field);

        if (!packColNames.includes('initial_tapaderas')) {
            await pool.query('ALTER TABLE egg_returnable_packaging ADD COLUMN initial_tapaderas INT NOT NULL DEFAULT 0 AFTER returned_qty');
            console.log('  → Columna initial_tapaderas agregada a egg_returnable_packaging.');
        }
        if (!packColNames.includes('delivered_tapaderas')) {
            await pool.query('ALTER TABLE egg_returnable_packaging ADD COLUMN delivered_tapaderas INT NOT NULL DEFAULT 0 AFTER initial_tapaderas');
            console.log('  → Columna delivered_tapaderas agregada a egg_returnable_packaging.');
        }
        if (!packColNames.includes('returned_tapaderas')) {
            await pool.query('ALTER TABLE egg_returnable_packaging ADD COLUMN returned_tapaderas INT NOT NULL DEFAULT 0 AFTER delivered_tapaderas');
            console.log('  → Columna returned_tapaderas agregada a egg_returnable_packaging.');
        }
        if (!packColNames.includes('current_tapaderas')) {
            await pool.query('ALTER TABLE egg_returnable_packaging ADD COLUMN current_tapaderas INT GENERATED ALWAYS AS (initial_tapaderas + delivered_tapaderas - returned_tapaderas) STORED AFTER returned_tapaderas');
            console.log('  → Columna virtual current_tapaderas agregada a egg_returnable_packaging.');
        }

        // 2. Columnas en egg_returnable_movements
        const [movCols] = await pool.query('DESCRIBE egg_returnable_movements');
        const movColNames = movCols.map(c => c.Field);

        if (!movColNames.includes('sale_id')) {
            await pool.query('ALTER TABLE egg_returnable_movements ADD COLUMN sale_id INT NULL AFTER returnable_id');
            await pool.query('ALTER TABLE egg_returnable_movements ADD INDEX idx_erm_sale (sale_id)');
            console.log('  → Columna sale_id e índice agregados a egg_returnable_movements.');
        }
        if (!movColNames.includes('cubetas_qty')) {
            await pool.query('ALTER TABLE egg_returnable_movements ADD COLUMN cubetas_qty INT NOT NULL DEFAULT 0 AFTER quantity');
            console.log('  → Columna cubetas_qty agregada a egg_returnable_movements.');
        }
        if (!movColNames.includes('tapaderas_qty')) {
            await pool.query('ALTER TABLE egg_returnable_movements ADD COLUMN tapaderas_qty INT NOT NULL DEFAULT 0 AFTER cubetas_qty');
            console.log('  → Columna tapaderas_qty agregada a egg_returnable_movements.');
        }
        if (!movColNames.includes('movement_date')) {
            await pool.query('ALTER TABLE egg_returnable_movements ADD COLUMN movement_date DATE NULL AFTER tapaderas_qty');
            await pool.query('ALTER TABLE egg_returnable_movements ADD INDEX idx_erm_date (movement_date)');
            console.log('  → Columna movement_date e índice agregados a egg_returnable_movements.');
        }

        console.log('--- Migración v232 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v232:', error);
        process.exit(1);
    }
}

runMigration();
