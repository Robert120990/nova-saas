const pool = require('../server/src/config/db');

async function run() {
    console.log('[Migration v242] Separación de datos energéticos por empresa (Andelsa vs Inversiones LIL San Martín)...');

    // 1. Agregar columna growatt_plant_id y plant_name a energy_credentials si no existen
    const [cols] = await pool.query('DESCRIBE energy_credentials');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('growatt_plant_id')) {
        await pool.query(`
            ALTER TABLE energy_credentials 
            ADD COLUMN growatt_plant_id VARCHAR(50) NULL DEFAULT NULL AFTER growatt_enabled
        `);
        console.log('[Migration v242] Columna growatt_plant_id agregada.');
    }

    if (!colNames.includes('plant_name')) {
        await pool.query(`
            ALTER TABLE energy_credentials 
            ADD COLUMN plant_name VARCHAR(100) NULL DEFAULT NULL AFTER growatt_plant_id
        `);
        console.log('[Migration v242] Columna plant_name agregada.');
    }

    // 2. Configurar Empresa 9: ANDELSA, S.A. DE C.V.
    // Planta Growatt 2410077 (Andelsa) + Baterías GESS 218 (513.6 kWh)
    await pool.query(`
        UPDATE energy_credentials 
        SET growatt_plant_id = '2410077',
            plant_name = 'Andelsa',
            growatt_enabled = 1,
            gess_enabled = 1,
            gess_plant_id = 218
        WHERE company_id = 9
    `);
    console.log('[Migration v242] Configuración de ANDELSA (Empresa 9) vinculada a Planta Growatt 2410077 con Baterías BESS activas.');

    // 3. Configurar Empresa 1: Inversiones Lil, S.A. de C.V.
    // Planta Growatt 2604519 (Puma San Martín II) + SIN BATERÍAS (gess_enabled = 0)
    await pool.query(`
        UPDATE energy_credentials 
        SET growatt_plant_id = '2604519',
            plant_name = 'Puma San Martín II',
            growatt_enabled = 1,
            gess_enabled = 0,
            gess_plant_id = 0
        WHERE company_id = 1
    `);
    console.log('[Migration v242] Configuración de Inversiones Lil San Martín (Empresa 1) vinculada a Planta Growatt 2604519 sin baterías.');

    console.log('[Migration v242] Migración completada exitosamente.');
}

module.exports = run;
