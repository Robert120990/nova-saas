/**
 * Migración v239: Configuración de Marcador Biométrico, Turnos, Tolerancias,
 * Exención de Horas Extras, Días Festivos por País y Reportes.
 */

async function up(pool) {
    console.log('--- Iniciando Migración v239: Configuración Biométrica, Turnos y Festivos ---');

    // 1. Tabla de Configuración de Marcador Biométrico por Empresa
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_biometric_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            hora_entrada TIME DEFAULT '08:00:00',
            hora_salida TIME DEFAULT '17:00:00',
            hora_inicio_almuerzo TIME DEFAULT '12:00:00',
            hora_fin_almuerzo TIME DEFAULT '13:00:00',
            tolerancia_entrada_minutos INT DEFAULT 15,
            tolerancia_salida_temprana_minutos INT DEFAULT 10,
            ventana_entrada_inicio TIME DEFAULT '05:00:00',
            ventana_entrada_fin TIME DEFAULT '11:00:00',
            ventana_almuerzo_inicio TIME DEFAULT '11:00:00',
            ventana_almuerzo_fin TIME DEFAULT '14:30:00',
            ventana_salida_inicio TIME DEFAULT '15:00:00',
            ventana_salida_fin TIME DEFAULT '23:59:59',
            modo_clasificacion VARCHAR(20) DEFAULT 'hibrido',
            pais_festivos VARCHAR(10) DEFAULT 'SV',
            vincular_con_planilla TINYINT(1) DEFAULT 0,
            calcular_horas_extra TINYINT(1) DEFAULT 1,
            horas_jornada_diaria DECIMAL(4,2) DEFAULT 8.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_company_biometric_settings (company_id),
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Tabla rh_biometric_settings creada / verificada.');

    // 2. Columna exento_horas_extras en rh_empleados
    const [empCols] = await pool.query("SHOW COLUMNS FROM rh_empleados LIKE 'exento_horas_extras'");
    if (empCols.length === 0) {
        await pool.query(`
            ALTER TABLE rh_empleados
            ADD COLUMN exento_horas_extras TINYINT(1) DEFAULT 0 COMMENT '0: Se le calculan horas extras, 1: Exento (personal de confianza/jefaturas)'
        `);
        console.log('✓ Columna exento_horas_extras agregada a rh_empleados.');
    }

    // 3. Columnas de análisis en rh_biometric_attendance_logs
    const [logCols] = await pool.query("SHOW COLUMNS FROM rh_biometric_attendance_logs LIKE 'minutos_tarde'");
    if (logCols.length === 0) {
        await pool.query(`
            ALTER TABLE rh_biometric_attendance_logs
            ADD COLUMN minutos_tarde INT DEFAULT 0,
            ADD COLUMN es_llegada_tarde TINYINT(1) DEFAULT 0,
            ADD COLUMN horas_extra DECIMAL(5,2) DEFAULT 0.00
        `);
        console.log('✓ Columnas de análisis minutos_tarde y horas_extra agregadas a rh_biometric_attendance_logs.');
    }

    // 4. Tabla de Días Festivos Oficiales
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_dias_festivos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NULL,
            pais VARCHAR(5) DEFAULT 'SV',
            mes INT NOT NULL,
            dia INT NOT NULL,
            anio INT NULL COMMENT 'NULL si es fecha fija todos los años',
            nombre VARCHAR(150) NOT NULL,
            tipo VARCHAR(30) DEFAULT 'nacional',
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_pais_fecha (pais, mes, dia, anio)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✓ Tabla rh_dias_festivos creada / verificada.');

    // 5. Poblar festivos de El Salvador (SV) si no existen
    const [svHolidays] = await pool.query("SELECT COUNT(*) as total FROM rh_dias_festivos WHERE pais = 'SV'");
    if (svHolidays[0].total === 0) {
        const festivosSV = [
            [null, 'SV', 1, 1, null, 'Año Nuevo', 'nacional'],
            [null, 'SV', 5, 1, null, 'Día del Trabajo', 'nacional'],
            [null, 'SV', 5, 10, null, 'Día de la Madre', 'nacional'],
            [null, 'SV', 6, 17, null, 'Día del Padre', 'nacional'],
            [null, 'SV', 8, 5, null, 'Fiestas Patronales de San Salvador', 'nacional'],
            [null, 'SV', 8, 6, null, 'Día del Divino Salvador del Mundo', 'nacional'],
            [null, 'SV', 9, 15, null, 'Día de la Independencia', 'nacional'],
            [null, 'SV', 11, 2, null, 'Día de los Difuntos', 'nacional'],
            [null, 'SV', 12, 25, null, 'Navidad', 'nacional'],
            // Semana Santa 2026 (estimación)
            [null, 'SV', 4, 2, 2026, 'Jueves Santo', 'nacional'],
            [null, 'SV', 4, 3, 2026, 'Viernes Santo', 'nacional'],
            [null, 'SV', 4, 4, 2026, 'Sábado Santo', 'nacional']
        ];

        await pool.query(
            `INSERT INTO rh_dias_festivos (company_id, pais, mes, dia, anio, nombre, tipo) VALUES ?`,
            [festivosSV]
        );
        console.log('✓ Días festivos oficiales de El Salvador insertados.');
    }

    // 6. Poblar configuración biométrica inicial por defecto para empresas existentes
    const [companies] = await pool.query("SELECT id FROM companies");
    for (const comp of companies) {
        await pool.query(`
            INSERT IGNORE INTO rh_biometric_settings 
            (company_id, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos, tolerancia_salida_temprana_minutos, ventana_entrada_inicio, ventana_entrada_fin, ventana_almuerzo_inicio, ventana_almuerzo_fin, ventana_salida_inicio, ventana_salida_fin, modo_clasificacion, pais_festivos, vincular_con_planilla, calcular_horas_extra, horas_jornada_diaria)
            VALUES (?, '08:00:00', '17:00:00', '12:00:00', '13:00:00', 15, 10, '05:00:00', '11:00:00', '11:00:00', '14:30:00', '15:00:00', '23:59:59', 'hibrido', 'SV', 0, 1, 8.00)
        `, [comp.id]);
    }
    console.log('✓ Configuración biométrica por defecto asegurada para todas las empresas.');

    console.log('--- Migración v239 completada exitosamente ---');
}

module.exports = { up };
