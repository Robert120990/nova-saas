const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v204: Soporte para Formato Oficial de Calidad LAB 001 en egg_raw_materials ---');

        const [cols] = await pool.query('DESCRIBE egg_raw_materials');
        const colNames = cols.map(c => c.Field);

        const columnsToAdd = [
            { name: 'quality_lab_report_json', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN quality_lab_report_json JSON NULL AFTER quality_brix' },
            { name: 'quality_reviewed_by', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN quality_reviewed_by VARCHAR(150) NULL AFTER quality_inspector_name' },
            { name: 'remission_note', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN remission_note VARCHAR(100) NULL AFTER provider_lot' },
            { name: 'farm_name', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN farm_name VARCHAR(150) NULL AFTER remission_note' },
            { name: 'production_date', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN production_date DATE NULL AFTER farm_name' },
            { name: 'expiration_date', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN expiration_date DATE NULL AFTER production_date' },
            { name: 'sample_egg_weight_g', sql: 'ALTER TABLE egg_raw_materials ADD COLUMN sample_egg_weight_g DECIMAL(6,2) NULL AFTER expiration_date' }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                await pool.query(col.sql);
                console.log(`  → Columna ${col.name} agregada exitosamente.`);
            } else {
                console.log(`  ✓ Columna ${col.name} ya existe.`);
            }
        }

        console.log('--- Migración v204 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v204:', error);
        process.exit(1);
    }
}

runMigration();
