async function migrate(pool) {
    console.log('[Migration v247] Modificando gas_station_closeout_tank_readings para permitir tank_id NULL y ON DELETE SET NULL...');

    // 1. Dropear foreign keys restrictivas en tank_id si existen
    const [fks] = await pool.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'gas_station_closeout_tank_readings' 
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `);
    const fkNames = fks.map(f => f.CONSTRAINT_NAME);

    if (fkNames.includes('gas_station_closeout_tank_readings_ibfk_3')) {
        await pool.query('ALTER TABLE gas_station_closeout_tank_readings DROP FOREIGN KEY gas_station_closeout_tank_readings_ibfk_3');
        console.log('[Migration v247] Dropeada constraint gas_station_closeout_tank_readings_ibfk_3');
    }
    if (fkNames.includes('gas_station_closeout_tank_readings_ibfk_2')) {
        await pool.query('ALTER TABLE gas_station_closeout_tank_readings DROP FOREIGN KEY gas_station_closeout_tank_readings_ibfk_2');
        console.log('[Migration v247] Dropeada constraint gas_station_closeout_tank_readings_ibfk_2');
    }

    // 2. Modificar columna tank_id a NULL
    await pool.query(`
        ALTER TABLE gas_station_closeout_tank_readings
        MODIFY COLUMN tank_id INT NULL DEFAULT NULL
    `);
    console.log('[Migration v247] Columna tank_id modificada a INT NULL DEFAULT NULL');

    // 3. Crear foreign key con ON DELETE SET NULL si no existe
    if (!fkNames.includes('fk_closeout_tank_readings_tank')) {
        await pool.query(`
            ALTER TABLE gas_station_closeout_tank_readings
            ADD CONSTRAINT fk_closeout_tank_readings_tank
            FOREIGN KEY (tank_id) REFERENCES gas_station_tanks (id) ON DELETE SET NULL
        `);
        console.log('[Migration v247] Creada constraint fk_closeout_tank_readings_tank con ON DELETE SET NULL');
    }

    console.log('[Migration v247] Migración v247 completada con éxito.');
}

module.exports = { migrate };
