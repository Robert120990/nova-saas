const pool = require('../server/src/config/db');

async function addColIfMissing(table, colName, colDef) {
    const [rows] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, colName]
    );
    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${colName}\` ${colDef}`);
        console.log(`✅ Columna ${table}.${colName} agregada.`);
    } else {
        console.log(`ℹ️ Columna ${table}.${colName} ya existe.`);
    }
}

async function addIndexIfMissing(table, indexName, colsSql) {
    const [rows] = await pool.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
    );
    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${colsSql})`);
        console.log(`✅ Índice ${table}.${indexName} creado.`);
    }
}

async function runMigration() {
    try {
        console.log('🚀 Ejecutando migración v640: Gestión Integral de Inasistencias, Permisos y Autorizaciones en Marcador Digital...');

        // 1. Ampliar columna tipo de ENUM limitado a VARCHAR(50) compatible con registros existentes
        await pool.query(
            `ALTER TABLE rh_empleado_ausencias MODIFY COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'inasistencia'`
        );

        // 2. Agregar columnas de clasificación legal/interna, solicitud de permiso y flujo de autorización
        await addColIfMissing('rh_empleado_ausencias', 'categoria', "ENUM('ley','interna','injustificada') NOT NULL DEFAULT 'injustificada'");
        await addColIfMissing('rh_empleado_ausencias', 'subtipo', 'VARCHAR(60) NULL');
        await addColIfMissing('rh_empleado_ausencias', 'pidio_permiso', 'TINYINT(1) NOT NULL DEFAULT 0');
        await addColIfMissing('rh_empleado_ausencias', 'estado_autorizacion', "ENUM('sin_solicitud','pendiente','autorizado','rechazado') NOT NULL DEFAULT 'sin_solicitud'");
        await addColIfMissing('rh_empleado_ausencias', 'goce_sueldo', 'TINYINT(1) NOT NULL DEFAULT 0');
        await addColIfMissing('rh_empleado_ausencias', 'afecta_septimo_dia', 'TINYINT(1) NOT NULL DEFAULT 0');
        await addColIfMissing('rh_empleado_ausencias', 'modalidad_tiempo', "ENUM('dia_completo','medio_dia','por_horas') NOT NULL DEFAULT 'dia_completo'");
        await addColIfMissing('rh_empleado_ausencias', 'horas_ausencia', 'DECIMAL(5,2) NOT NULL DEFAULT 8.00');
        await addColIfMissing('rh_empleado_ausencias', 'hora_inicio', 'TIME NULL');
        await addColIfMissing('rh_empleado_ausencias', 'hora_fin', 'TIME NULL');
        await addColIfMissing('rh_empleado_ausencias', 'documento_referencia', 'VARCHAR(120) NULL');
        await addColIfMissing('rh_empleado_ausencias', 'solicitado_por', 'INT NULL');
        await addColIfMissing('rh_empleado_ausencias', 'autorizado_por', 'INT NULL');
        await addColIfMissing('rh_empleado_ausencias', 'fecha_autorizacion', 'DATETIME NULL');
        await addColIfMissing('rh_empleado_ausencias', 'notas_autorizacion', 'TEXT NULL');
        await addColIfMissing('rh_empleado_ausencias', 'origen', "VARCHAR(30) NOT NULL DEFAULT 'marcador'");
        await addColIfMissing('rh_empleado_ausencias', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

        // 3. Índices de rendimiento multi-tenant para radar diario y reportes
        await addIndexIfMissing('rh_empleado_ausencias', 'idx_rh_ausencias_company_dates', 'company_id, fecha_inicio, fecha_fin');
        await addIndexIfMissing('rh_empleado_ausencias', 'idx_rh_ausencias_auth', 'company_id, estado_autorizacion');

        // 4. Homologar registros históricos previos creados desde expedientes
        await pool.query(`
            UPDATE rh_empleado_ausencias
            SET categoria = 'ley',
                subtipo = COALESCE(subtipo, 'incapacidad_isss'),
                pidio_permiso = 1,
                estado_autorizacion = 'autorizado',
                goce_sueldo = 1,
                justificada = 1,
                afecta_septimo_dia = 0
            WHERE tipo = 'incapacidad' AND subtipo IS NULL
        `);

        await pool.query(`
            UPDATE rh_empleado_ausencias
            SET categoria = CASE WHEN justificada = 1 THEN 'interna' ELSE 'injustificada' END,
                subtipo = COALESCE(subtipo, CASE WHEN justificada = 1 THEN 'permiso_personal' ELSE 'falta_sin_aviso' END),
                pidio_permiso = CASE WHEN justificada = 1 THEN 1 ELSE 0 END,
                estado_autorizacion = CASE WHEN justificada = 1 THEN 'autorizado' ELSE 'sin_solicitud' END
            WHERE subtipo IS NULL
        `);

        console.log('✅ Migración v640 completada exitosamente.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en migración v640:', error);
        process.exit(1);
    }
}

runMigration();
