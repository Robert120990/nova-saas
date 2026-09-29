const pool = require('../server/src/config/db');

async function run() {
    console.log('[Migration v240] Creando tabla rh_turnos y asignación de horarios por empleado...');

    // 1. Tabla de turnos / horarios
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_turnos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            hora_entrada TIME NOT NULL DEFAULT '08:00:00',
            hora_salida TIME NOT NULL DEFAULT '17:00:00',
            hora_inicio_almuerzo TIME NOT NULL DEFAULT '12:00:00',
            hora_fin_almuerzo TIME NOT NULL DEFAULT '13:00:00',
            tolerancia_entrada_minutos INT NOT NULL DEFAULT 15,
            horas_jornada_diaria DECIMAL(4,2) NOT NULL DEFAULT 8.00,
            es_predeterminado TINYINT(1) NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_rh_turnos_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Columna turno_id en rh_empleados
    const [empCols] = await pool.query("SHOW COLUMNS FROM rh_empleados LIKE 'turno_id'");
    if (empCols.length === 0) {
        await pool.query(`
            ALTER TABLE rh_empleados 
            ADD COLUMN turno_id INT NULL DEFAULT NULL AFTER exento_horas_extras;
        `);
        console.log('[Migration v240] Columna turno_id agregada a rh_empleados.');
    }

    // 3. Crear turnos predeterminados para empresas existentes si no tienen ninguno
    const [companies] = await pool.query('SELECT id FROM companies');
    for (const comp of companies) {
        const [existingTurnos] = await pool.query(
            'SELECT id FROM rh_turnos WHERE company_id = ? LIMIT 1',
            [comp.id]
        );
        if (existingTurnos.length === 0) {
            // Obtener configuración si existe
            const [settings] = await pool.query(
                'SELECT * FROM rh_biometric_settings WHERE company_id = ? LIMIT 1',
                [comp.id]
            );
            const s = settings[0] || {};
            await pool.query(`
                INSERT INTO rh_turnos 
                (company_id, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos, horas_jornada_diaria, es_predeterminado, is_active)
                VALUES 
                (?, 'Turno General (Oficina)', ?, ?, ?, ?, ?, ?, 1, 1),
                (?, 'Turno Matutino (Planta)', '06:00:00', '14:00:00', '11:00:00', '12:00:00', 15, 8.00, 0, 1),
                (?, 'Turno Vespertino (Planta)', '14:00:00', '22:00:00', '17:00:00', '18:00:00', 15, 8.00, 0, 1)
            `, [
                comp.id,
                s.hora_entrada || '08:00:00',
                s.hora_salida || '17:00:00',
                s.hora_inicio_almuerzo || '12:00:00',
                s.hora_fin_almuerzo || '13:00:00',
                s.tolerancia_entrada_minutos || 15,
                s.horas_jornada_diaria || 8.00,
                comp.id,
                comp.id
            ]);
            console.log(`[Migration v240] Turnos base sembrados para empresa ${comp.id}.`);
        }
    }

    console.log('[Migration v240] Migración completada con éxito.');
}

module.exports = run;
