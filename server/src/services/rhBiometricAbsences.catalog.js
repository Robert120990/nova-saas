const pool = require('../config/db');

/**
 * Catálogo oficial de motivos de inasistencia, permisos y licencias
 * alineado al Código de Trabajo de El Salvador (Art. 29 Ord. 6°, Art. 171, ISSS)
 * y políticas internas empresariales.
 */
const ABSENCE_CATALOG = [
    // 1. DE LEY (Código de Trabajo SV / ISSS)
    {
        subtipo: 'incapacidad_isss',
        label: 'Incapacidad Médica ISSS / Certificada',
        categoria: 'ley',
        legacyTipo: 'incapacidad',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Código de Trabajo / Ley ISSS'
    },
    {
        subtipo: 'cita_medica_isss',
        label: 'Consulta / Cita Médica ISSS',
        categoria: 'ley',
        legacyTipo: 'permiso',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 29 Ord. 6° C.T.'
    },
    {
        subtipo: 'duelo_familiar',
        label: 'Licencia por Duelo Familiar Directo',
        categoria: 'ley',
        legacyTipo: 'licencia_ley',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 29 Ord. 6° C.T. (Padres, hijos, cónyuge)'
    },
    {
        subtipo: 'maternidad_paternidad',
        label: 'Licencia Maternidad / Paternidad / Lactancia',
        categoria: 'ley',
        legacyTipo: 'licencia_ley',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 29 Ord. 6° / Art. 309 C.T.'
    },
    {
        subtipo: 'matrimonio_nacimiento',
        label: 'Licencia por Matrimonio / Nacimiento de Hijo',
        categoria: 'ley',
        legacyTipo: 'licencia_ley',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 29 Ord. 6° C.T.'
    },
    {
        subtipo: 'deber_publico',
        label: 'Citación Judicial / Obligación Pública',
        categoria: 'ley',
        legacyTipo: 'licencia_ley',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 29 Ord. 6° C.T.'
    },
    {
        subtipo: 'vacaciones',
        label: 'Vacaciones Anuales',
        categoria: 'ley',
        legacyTipo: 'vacaciones',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 177 C.T.'
    },

    // 2. POLÍTICAS INTERNAS DE EMPRESA
    {
        subtipo: 'permiso_personal',
        label: 'Permiso Personal / Asunto Familiar',
        categoria: 'interna',
        legacyTipo: 'permiso',
        defaultGoceSueldo: 0,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Política Interna'
    },
    {
        subtipo: 'comision_trabajo_campo',
        label: 'Comisión Externa / Trabajo en Campo / Capacitación',
        categoria: 'interna',
        legacyTipo: 'comision',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Actividad Laboral Externa'
    },
    {
        subtipo: 'tiempo_compensatorio',
        label: 'Tiempo Compensatorio (Horas Acumuladas)',
        categoria: 'interna',
        legacyTipo: 'permiso',
        defaultGoceSueldo: 1,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Compensación Interna'
    },
    {
        subtipo: 'suspension_disciplinaria',
        label: 'Suspensión Disciplinaria (Sin Goce)',
        categoria: 'interna',
        legacyTipo: 'falta',
        defaultGoceSueldo: 0,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 0,
        legalRef: 'Art. 305 C.T. / Reglamento Interno'
    },
    {
        subtipo: 'otro_interno',
        label: 'Otro Permiso / Acuerdo Interno',
        categoria: 'interna',
        legacyTipo: 'permiso',
        defaultGoceSueldo: 0,
        defaultAfectaSeptimo: 0,
        defaultPidioPermiso: 1,
        legalRef: 'Política Interna'
    },

    // 3. INASISTENCIAS INJUSTIFICADAS / SIN PERMISO
    {
        subtipo: 'falta_sin_aviso',
        label: 'Inasistencia sin Aviso (No pidió permiso)',
        categoria: 'injustificada',
        legacyTipo: 'inasistencia',
        defaultGoceSueldo: 0,
        defaultAfectaSeptimo: 1,
        defaultPidioPermiso: 0,
        legalRef: 'Art. 171 C.T. (Pérdida de 7° día)'
    },
    {
        subtipo: 'permiso_denegado',
        label: 'Permiso Solicitado pero No Autorizado',
        categoria: 'injustificada',
        legacyTipo: 'inasistencia',
        defaultGoceSueldo: 0,
        defaultAfectaSeptimo: 1,
        defaultPidioPermiso: 1,
        legalRef: 'Art. 171 C.T.'
    },
    {
        subtipo: 'justificacion_no_idonea',
        label: 'Sin Comprobante / Justificación No Idónea',
        categoria: 'injustificada',
        legacyTipo: 'falta',
        defaultGoceSueldo: 0,
        defaultAfectaSeptimo: 1,
        defaultPidioPermiso: 0,
        legalRef: 'Reglamento Interno / Art. 171 C.T.'
    }
];

function getCatalogMeta(subtipo) {
    return ABSENCE_CATALOG.find(item => item.subtipo === subtipo) || null;
}

let schemaEnsuredPromise = null;
async function ensureAbsenceSchema() {
    if (schemaEnsuredPromise) return schemaEnsuredPromise;
    schemaEnsuredPromise = (async () => {
        const [cols] = await pool.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_empleado_ausencias'`
        );
        const existing = new Set(cols.map(c => c.COLUMN_NAME));
        if (existing.has('estado_autorizacion') && existing.has('categoria') && existing.has('modalidad_tiempo')) return;

        await pool.query(`ALTER TABLE rh_empleado_ausencias MODIFY COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'inasistencia'`);
        const defs = [
            ['categoria', "ENUM('ley','interna','injustificada') NOT NULL DEFAULT 'injustificada'"],
            ['subtipo', 'VARCHAR(60) NULL'],
            ['pidio_permiso', 'TINYINT(1) NOT NULL DEFAULT 0'],
            ['estado_autorizacion', "ENUM('sin_solicitud','pendiente','autorizado','rechazado') NOT NULL DEFAULT 'sin_solicitud'"],
            ['goce_sueldo', 'TINYINT(1) NOT NULL DEFAULT 0'],
            ['afecta_septimo_dia', 'TINYINT(1) NOT NULL DEFAULT 0'],
            ['modalidad_tiempo', "ENUM('dia_completo','medio_dia','por_horas') NOT NULL DEFAULT 'dia_completo'"],
            ['horas_ausencia', 'DECIMAL(5,2) NOT NULL DEFAULT 8.00'],
            ['hora_inicio', 'TIME NULL'],
            ['hora_fin', 'TIME NULL'],
            ['documento_referencia', 'VARCHAR(120) NULL'],
            ['solicitado_por', 'INT NULL'],
            ['autorizado_por', 'INT NULL'],
            ['fecha_autorizacion', 'DATETIME NULL'],
            ['notas_autorizacion', 'TEXT NULL'],
            ['origen', "VARCHAR(30) NOT NULL DEFAULT 'marcador'"],
            ['updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP']
        ];
        for (const [col, def] of defs) {
            if (!existing.has(col)) {
                await pool.query(`ALTER TABLE rh_empleado_ausencias ADD COLUMN \`${col}\` ${def}`);
            }
        }
    })().catch((err) => {
        schemaEnsuredPromise = null;
        throw err;
    });
    return schemaEnsuredPromise;
}

module.exports = {
    ABSENCE_CATALOG,
    getCatalogMeta,
    ensureAbsenceSchema
};
