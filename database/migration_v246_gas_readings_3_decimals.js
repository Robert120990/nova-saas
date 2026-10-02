async function migrate(pool) {
    console.log('[Migration v246] Modificando columnas de gas_station_closeout_readings a DECIMAL(14,3)...');

    await pool.query(`
        ALTER TABLE gas_station_closeout_readings
        MODIFY COLUMN lectura_anterior DECIMAL(14,3) NOT NULL DEFAULT 0.000,
        MODIFY COLUMN lectura_actual DECIMAL(14,3) NOT NULL DEFAULT 0.000,
        MODIFY COLUMN calibracion DECIMAL(14,3) NOT NULL DEFAULT 0.000,
        MODIFY COLUMN diferencia DECIMAL(14,3) NOT NULL DEFAULT 0.000
    `);

    console.log('[Migration v246] Modificadas exitosamente las columnas de lecturas a DECIMAL(14,3).');
}

module.exports = { migrate };
