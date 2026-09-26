const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v214: Parámetros de tara por proveedor (separadores y cajas/jabas) ---');

        const [cols] = await pool.query('DESCRIBE egg_provider_lot_configurations');
        const colNames = cols.map(c => c.Field);

        const columnsToAdd = [
            { name: 'tare_separador_lbs', sql: "ALTER TABLE egg_provider_lot_configurations ADD COLUMN tare_separador_lbs DECIMAL(8,2) NOT NULL DEFAULT 48.00 COMMENT 'Tara de separadores para tarima estándar (lbs)' AFTER format_pattern" },
            { name: 'tare_caja_lbs', sql: "ALTER TABLE egg_provider_lot_configurations ADD COLUMN tare_caja_lbs DECIMAL(8,2) NOT NULL DEFAULT 30.00 COMMENT 'Tara de jaba o caja para tarima estándar (lbs)' AFTER tare_separador_lbs" },
            { name: 'base_boxes_per_tarima', sql: "ALTER TABLE egg_provider_lot_configurations ADD COLUMN base_boxes_per_tarima INT NOT NULL DEFAULT 24 COMMENT 'Cantidad base de cajas por tarima estándar' AFTER tare_caja_lbs" },
            { name: 'default_has_caja', sql: "ALTER TABLE egg_provider_lot_configurations ADD COLUMN default_has_caja TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = con caja/jaba por defecto, 0 = a granel' AFTER base_boxes_per_tarima" }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                await pool.query(col.sql);
                console.log(`  → Columna ${col.name} agregada exitosamente.`);
            } else {
                console.log(`  ✓ Columna ${col.name} ya existe.`);
            }
        }

        // Actualizar parámetros para proveedor INAVI si existe
        const [updateRes] = await pool.query(`
            UPDATE egg_provider_lot_configurations
            SET tare_separador_lbs = 48.00,
                tare_caja_lbs = 30.00,
                base_boxes_per_tarima = 24,
                default_has_caja = 1
            WHERE provider_id IN (
                SELECT id FROM providers 
                WHERE nombre LIKE '%INAVI%' OR nombre_comercial LIKE '%INAVI%' OR nombre LIKE '%Honduras%'
            )
        `);
        console.log(`  ✓ Parámetros actualizados para INAVI (${updateRes.affectedRows} filas afectadas).`);

        console.log('--- Migración v214 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v214:', error);
        process.exit(1);
    }
}

runMigration();
