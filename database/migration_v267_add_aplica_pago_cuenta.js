const pool = require('../server/src/config/db');

async function migrate() {
    try {
        console.log('--- Iniciando Migración v267: Agregar aplica_pago_cuenta a tax_configurations ---');

        const [columns] = await pool.query(
            "SHOW COLUMNS FROM tax_configurations LIKE 'aplica_pago_cuenta'"
        );

        if (columns.length === 0) {
            await pool.query(
                "ALTER TABLE tax_configurations ADD COLUMN aplica_pago_cuenta BOOLEAN NOT NULL DEFAULT TRUE AFTER compras_afectan_libro_compras"
            );
            console.log('✓ Columna aplica_pago_cuenta agregada exitosamente a tax_configurations');
        } else {
            console.log('ℹ La columna aplica_pago_cuenta ya existe en tax_configurations');
        }

        // Configurar por defecto aplica_pago_cuenta = 0 para personas naturales de servicios profesionales (como Josue Roberto Orellana)
        await pool.query(`
            INSERT INTO tax_configurations (company_id, iva_rate, fovial_rate, cotrans_rate, retencion_rate, percepcion_rate, compras_afectan_libro_compras, aplica_pago_cuenta)
            SELECT id, 13.00, 0.20, 0.10, 1.00, 1.00, 0, 0
            FROM companies
            WHERE tipo_persona = '1' AND (codigo_actividad = '62010' OR razon_social LIKE '%JOSUE%')
            ON DUPLICATE KEY UPDATE aplica_pago_cuenta = 0
        `);
        console.log('✓ Exención de pago a cuenta registrada para personas naturales de servicios profesionales');

        console.log('--- Migración v267 completada con éxito ---');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v267:', error);
        process.exit(1);
    }
}

migrate();
