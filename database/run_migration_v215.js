const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v215: Tara de tarima física/pallet en configuración de lotes ---');

        const [cols] = await pool.query('DESCRIBE egg_provider_lot_configurations');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('tare_tarima_lbs')) {
            await pool.query(`
                ALTER TABLE egg_provider_lot_configurations 
                ADD COLUMN tare_tarima_lbs DECIMAL(8,2) NOT NULL DEFAULT 0.00 COMMENT 'Tara de tarima física/pallet (lbs)' AFTER format_pattern
            `);
            console.log('  → Columna tare_tarima_lbs agregada exitosamente.');
        } else {
            console.log('  ✓ Columna tare_tarima_lbs ya existe.');
        }

        console.log('--- Migración v215 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v215:', error);
        process.exit(1);
    }
}

runMigration();
