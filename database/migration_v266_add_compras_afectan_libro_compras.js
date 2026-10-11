const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v266: Agregar compras_afectan_libro_compras a tax_configurations ---');

        const [columns] = await pool.query(
            "SHOW COLUMNS FROM tax_configurations LIKE 'compras_afectan_libro_compras'"
        );

        if (columns.length === 0) {
            await pool.query(
                "ALTER TABLE tax_configurations ADD COLUMN compras_afectan_libro_compras BOOLEAN NOT NULL DEFAULT FALSE AFTER percepcion_rate"
            );
            console.log('✓ Columna compras_afectan_libro_compras agregada exitosamente a tax_configurations');
        } else {
            console.log('ℹ La columna compras_afectan_libro_compras ya existe en tax_configurations');
        }

        console.log('--- Migración v266 completada con éxito ---');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v266:', error);
        process.exit(1);
    }
}

migrate();
