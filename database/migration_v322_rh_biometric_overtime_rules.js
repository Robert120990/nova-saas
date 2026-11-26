const pool = require('../server/src/config/db');

async function addColumnIfMissing(table, column, definition) {
    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    if (cols.length === 0) {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`[v321] + ${table}.${column}`);
    }
}

async function up() {
    console.log('[v321] Iniciando migración de reglas avanzadas de horas extra, compensación de sábados y arrastre de saldos...');

    // 1. Reglas configurables en rh_biometric_settings
    await addColumnIfMissing(
        'rh_biometric_settings',
        'modo_calculo_jornada',
        "ENUM('neto_sin_almuerzo', 'bruto_con_almuerzo') NOT NULL DEFAULT 'neto_sin_almuerzo' COMMENT 'neto_sin_almuerzo resta almuerzo vs 8h; bruto_con_almuerzo usa salida-entrada vs jornada (ej. 9h)'"
    );
    await addColumnIfMissing(
        'rh_biometric_settings',
        'redondeo_horas_extra_minutos',
        "INT NOT NULL DEFAULT 0 COMMENT 'Bloque de redondeo en minutos (0=exacto, 30=medias horas 0.5h, 15=cuartos 0.25h)'"
    );
    await addColumnIfMissing(
        'rh_biometric_settings',
        'umbral_redondeo_minutos',
        "INT NOT NULL DEFAULT 15 COMMENT 'Minutos mínimos de residuo dentro del bloque para redondear hacia arriba (ej. 15 min en bloques de 30 min)'"
    );
    await addColumnIfMissing(
        'rh_biometric_settings',
        'compensar_sabado',
        "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = aplicar compensación semanal 44h (sábado no trabajado = -horas_jornada_sabado; sábado trabajado = horas - horas_jornada_sabado)'"
    );
    await addColumnIfMissing(
        'rh_biometric_settings',
        'horas_jornada_sabado',
        "DECIMAL(4,2) NOT NULL DEFAULT 4.00 COMMENT 'Horas obligatorias del sábado cuando compensar_sabado = 1'"
    );
    await addColumnIfMissing(
        'rh_biometric_settings',
        'permitir_saldo_negativo',
        "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = permitir horas extra negativas (déficit de jornada/sábado) y arrastrar saldo negativo como HORAS PENDIENTES al siguiente corte'"
    );

    // 2. Columnas de resumen por categoría y saldo pagable en rh_biometric_cortes
    await addColumnIfMissing(
        'rh_biometric_cortes',
        'total_horas_extra_produccion',
        "DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Subtotal horas extra área Producción'"
    );
    await addColumnIfMissing(
        'rh_biometric_cortes',
        'total_horas_extra_transporte',
        "DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Subtotal horas extra área Transporte/Logística'"
    );
    await addColumnIfMissing(
        'rh_biometric_cortes',
        'total_horas_extra_avicola',
        "DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Subtotal horas extra adicionales Avícola'"
    );
    await addColumnIfMissing(
        'rh_biometric_cortes',
        'total_horas_pendientes_aplicadas',
        "DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Suma algebraica de horas pendientes arrastradas aplicadas en el corte'"
    );
    await addColumnIfMissing(
        'rh_biometric_cortes',
        'total_horas_extra_pagables',
        "DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Suma de horas extra netas >= 0 pagables en planilla (excluyendo saldos negativos que pasan a arrastre)'"
    );

    // 3. Columnas auxiliares en rh_biometric_daily_overtime
    await addColumnIfMissing(
        'rh_biometric_daily_overtime',
        'es_dia_compensacion',
        "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = fila generada por compensación de sábado o ausencia sin marca'"
    );
    await addColumnIfMissing(
        'rh_biometric_daily_overtime',
        'horas_extra_avicola',
        "DECIMAL(6,2) NOT NULL DEFAULT 0.00 COMMENT 'Horas extra adicionales imputadas a operación Avícola en esta fecha'"
    );

    // 4. Tabla de saldos consolidados y arrastre de HORAS PENDIENTES por corte y colaborador
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_biometric_corte_saldos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            corte_id INT NOT NULL,
            empleado_id INT NULL,
            device_uid VARCHAR(50) NOT NULL,
            empleado_nombre VARCHAR(180) NULL,
            area VARCHAR(100) NULL,
            categoria ENUM('produccion', 'transporte', 'avicola') NOT NULL DEFAULT 'produccion',
            horas_jornada_base DECIMAL(4,2) NOT NULL DEFAULT 9.00,
            horas_extra_periodo DECIMAL(8,2) NOT NULL DEFAULT 0.00,
            horas_pendientes_anteriores DECIMAL(8,2) NOT NULL DEFAULT 0.00,
            horas_extra_avicola DECIMAL(8,2) NOT NULL DEFAULT 0.00,
            saldo_neto DECIMAL(8,2) NOT NULL DEFAULT 0.00,
            horas_pagables DECIMAL(8,2) NOT NULL DEFAULT 0.00,
            saldo_arrastre_siguiente DECIMAL(8,2) NOT NULL DEFAULT 0.00,
            observacion VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_corte_uid (corte_id, device_uid),
            INDEX idx_saldos_comp_uid (company_id, device_uid),
            INDEX idx_saldos_comp_emp (company_id, empleado_id),
            INDEX idx_saldos_corte (corte_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[v321] Tabla rh_biometric_corte_saldos verificada/creada.');
    console.log('[v321] Migración completada con éxito.');
}

module.exports = { up };
