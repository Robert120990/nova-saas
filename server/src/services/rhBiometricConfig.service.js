const pool = require('../config/db');

const DEFAULT_SETTINGS = {
    hora_entrada: '08:00:00', hora_salida: '17:00:00',
    hora_inicio_almuerzo: '12:00:00', hora_fin_almuerzo: '13:00:00',
    tolerancia_entrada_minutos: 15, tolerancia_salida_temprana_minutos: 10,
    ventana_entrada_inicio: '05:00:00', ventana_entrada_fin: '11:00:00',
    ventana_almuerzo_inicio: '11:00:00', ventana_almuerzo_fin: '14:30:00',
    ventana_salida_inicio: '15:00:00', ventana_salida_fin: '23:59:59',
    modo_clasificacion: 'hibrido', pais_festivos: 'SV',
    vincular_con_planilla: 0, calcular_horas_extra: 1, horas_jornada_diaria: 8.00
};

async function getSettings(companyId) {
    const [rows] = await pool.query('SELECT * FROM rh_biometric_settings WHERE company_id = ? LIMIT 1', [companyId]);
    if (rows.length > 0) return rows[0];

    await pool.query(
        `INSERT IGNORE INTO rh_biometric_settings
         (company_id, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo,
          tolerancia_entrada_minutos, tolerancia_salida_temprana_minutos,
          ventana_entrada_inicio, ventana_entrada_fin, ventana_almuerzo_inicio, ventana_almuerzo_fin,
          ventana_salida_inicio, ventana_salida_fin, modo_clasificacion, pais_festivos,
          vincular_con_planilla, calcular_horas_extra, horas_jornada_diaria)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            companyId, DEFAULT_SETTINGS.hora_entrada, DEFAULT_SETTINGS.hora_salida,
            DEFAULT_SETTINGS.hora_inicio_almuerzo, DEFAULT_SETTINGS.hora_fin_almuerzo,
            DEFAULT_SETTINGS.tolerancia_entrada_minutos, DEFAULT_SETTINGS.tolerancia_salida_temprana_minutos,
            DEFAULT_SETTINGS.ventana_entrada_inicio, DEFAULT_SETTINGS.ventana_entrada_fin,
            DEFAULT_SETTINGS.ventana_almuerzo_inicio, DEFAULT_SETTINGS.ventana_almuerzo_fin,
            DEFAULT_SETTINGS.ventana_salida_inicio, DEFAULT_SETTINGS.ventana_salida_fin,
            DEFAULT_SETTINGS.modo_clasificacion, DEFAULT_SETTINGS.pais_festivos,
            DEFAULT_SETTINGS.vincular_con_planilla, DEFAULT_SETTINGS.calcular_horas_extra,
            DEFAULT_SETTINGS.horas_jornada_diaria
        ]
    );

    const [created] = await pool.query('SELECT * FROM rh_biometric_settings WHERE company_id = ? LIMIT 1', [companyId]);
    return created[0] || { company_id: companyId, ...DEFAULT_SETTINGS };
}

async function updateSettings(companyId, data) {
    const {
        hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo,
        tolerancia_entrada_minutos, tolerancia_salida_temprana_minutos,
        ventana_entrada_inicio, ventana_entrada_fin, ventana_almuerzo_inicio, ventana_almuerzo_fin,
        ventana_salida_inicio, ventana_salida_fin, modo_clasificacion, pais_festivos,
        vincular_con_planilla, calcular_horas_extra, horas_jornada_diaria
    } = data;

    await pool.query(
        `INSERT INTO rh_biometric_settings
         (company_id, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo,
          tolerancia_entrada_minutos, tolerancia_salida_temprana_minutos,
          ventana_entrada_inicio, ventana_entrada_fin, ventana_almuerzo_inicio, ventana_almuerzo_fin,
          ventana_salida_inicio, ventana_salida_fin, modo_clasificacion, pais_festivos,
          vincular_con_planilla, calcular_horas_extra, horas_jornada_diaria)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          hora_entrada = VALUES(hora_entrada), hora_salida = VALUES(hora_salida),
          hora_inicio_almuerzo = VALUES(hora_inicio_almuerzo), hora_fin_almuerzo = VALUES(hora_fin_almuerzo),
          tolerancia_entrada_minutos = VALUES(tolerancia_entrada_minutos),
          tolerancia_salida_temprana_minutos = VALUES(tolerancia_salida_temprana_minutos),
          ventana_entrada_inicio = VALUES(ventana_entrada_inicio), ventana_entrada_fin = VALUES(ventana_entrada_fin),
          ventana_almuerzo_inicio = VALUES(ventana_almuerzo_inicio), ventana_almuerzo_fin = VALUES(ventana_almuerzo_fin),
          ventana_salida_inicio = VALUES(ventana_salida_inicio), ventana_salida_fin = VALUES(ventana_salida_fin),
          modo_clasificacion = VALUES(modo_clasificacion), pais_festivos = VALUES(pais_festivos),
          vincular_con_planilla = VALUES(vincular_con_planilla), calcular_horas_extra = VALUES(calcular_horas_extra),
          horas_jornada_diaria = VALUES(horas_jornada_diaria)`,
        [
            companyId, hora_entrada || DEFAULT_SETTINGS.hora_entrada, hora_salida || DEFAULT_SETTINGS.hora_salida,
            hora_inicio_almuerzo || DEFAULT_SETTINGS.hora_inicio_almuerzo, hora_fin_almuerzo || DEFAULT_SETTINGS.hora_fin_almuerzo,
            parseInt(tolerancia_entrada_minutos, 10) || 15, parseInt(tolerancia_salida_temprana_minutos, 10) || 10,
            ventana_entrada_inicio || DEFAULT_SETTINGS.ventana_entrada_inicio, ventana_entrada_fin || DEFAULT_SETTINGS.ventana_entrada_fin,
            ventana_almuerzo_inicio || DEFAULT_SETTINGS.ventana_almuerzo_inicio, ventana_almuerzo_fin || DEFAULT_SETTINGS.ventana_almuerzo_fin,
            ventana_salida_inicio || DEFAULT_SETTINGS.ventana_salida_inicio, ventana_salida_fin || DEFAULT_SETTINGS.ventana_salida_fin,
            modo_clasificacion || DEFAULT_SETTINGS.modo_clasificacion, pais_festivos || DEFAULT_SETTINGS.pais_festivos,
            vincular_con_planilla ? 1 : 0, calcular_horas_extra ? 1 : 0, parseFloat(horas_jornada_diaria) || 8.00
        ]
    );

    return await getSettings(companyId);
}

// -------------------------------------------------------------
// Turnos y Horarios (Shifts)
// -------------------------------------------------------------

async function getShifts(companyId) {
    const [rows] = await pool.query(
        'SELECT * FROM rh_turnos WHERE company_id = ? AND is_active = 1 ORDER BY es_predeterminado DESC, nombre ASC',
        [companyId]
    );
    return rows;
}

async function saveShift(companyId, data) {
    const { id, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos, horas_jornada_diaria, es_predeterminado } = data;
    if (!nombre) throw Object.assign(new Error('El nombre del turno es obligatorio.'), { status: 400 });

    if (es_predeterminado) {
        await pool.query('UPDATE rh_turnos SET es_predeterminado = 0 WHERE company_id = ?', [companyId]);
    }

    if (id) {
        await pool.query(
            `UPDATE rh_turnos 
             SET nombre = ?, hora_entrada = ?, hora_salida = ?, hora_inicio_almuerzo = ?, hora_fin_almuerzo = ?,
                 tolerancia_entrada_minutos = ?, horas_jornada_diaria = ?, es_predeterminado = ?
             WHERE id = ? AND company_id = ?`,
            [nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos || 15, horas_jornada_diaria || 8.00, es_predeterminado ? 1 : 0, id, companyId]
        );
        return { id, ...data };
    }

    const [res] = await pool.query(
        `INSERT INTO rh_turnos 
         (company_id, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos, horas_jornada_diaria, es_predeterminado, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [companyId, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos || 15, horas_jornada_diaria || 8.00, es_predeterminado ? 1 : 0]
    );
    return { id: res.insertId, ...data };
}

async function deleteShift(companyId, id) {
    await pool.query('UPDATE rh_empleados SET turno_id = NULL WHERE turno_id = ? AND company_id = ?', [id, companyId]);
    const [res] = await pool.query('DELETE FROM rh_turnos WHERE id = ? AND company_id = ?', [id, companyId]);
    return { deleted: res.affectedRows > 0 };
}

async function getEmployeeShiftAssignments(companyId) {
    const [rows] = await pool.query(
        `SELECT e.id, e.codigo,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as nombre_completo,
                c.descripcion as cargo_nombre,
                dep.descripcion as departamento_nombre,
                e.turno_id,
                t.nombre as turno_nombre,
                t.hora_entrada as turno_hora_entrada,
                t.hora_salida as turno_hora_salida
         FROM rh_empleados e
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE e.company_id = ? AND e.es_activo = 1
         ORDER BY e.nombres ASC`,
        [companyId]
    );
    return rows;
}

async function assignEmployeeShift(companyId, empleadoId, turnoId) {
    const [res] = await pool.query(
        'UPDATE rh_empleados SET turno_id = ? WHERE id = ? AND company_id = ?',
        [turnoId ? parseInt(turnoId, 10) : null, empleadoId, companyId]
    );
    return { success: res.affectedRows > 0 };
}

// -------------------------------------------------------------
// Días Festivos y Horas Extras
// -------------------------------------------------------------

async function getHolidays(companyId, pais = 'SV') {
    const [rows] = await pool.query(
        `SELECT id, company_id, pais, mes, dia, anio, nombre, tipo, is_active
         FROM rh_dias_festivos
         WHERE pais = ? AND (company_id = ? OR company_id IS NULL)
         ORDER BY mes ASC, dia ASC`,
        [pais, companyId]
    );
    return rows;
}

async function saveHoliday(companyId, data) {
    const { id, pais, mes, dia, anio, nombre, tipo, is_active } = data;
    if (!mes || !dia || !nombre) {
        throw Object.assign(new Error('Mes, día y nombre son obligatorios para el día festivo.'), { status: 400 });
    }

    if (id) {
        await pool.query(
            `UPDATE rh_dias_festivos
             SET pais = ?, mes = ?, dia = ?, anio = ?, nombre = ?, tipo = ?, is_active = ?
             WHERE id = ? AND (company_id = ? OR company_id IS NULL)`,
            [pais || 'SV', mes, dia, anio || null, nombre, tipo || 'oficial', is_active !== undefined ? (is_active ? 1 : 0) : 1, id, companyId]
        );
        return { id, ...data };
    }

    const [res] = await pool.query(
        `INSERT INTO rh_dias_festivos (company_id, pais, mes, dia, anio, nombre, tipo, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [companyId, pais || 'SV', mes, dia, anio || null, nombre, tipo || 'oficial', is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );
    return { id: res.insertId, ...data };
}

async function deleteHoliday(companyId, id) {
    const [res] = await pool.query('DELETE FROM rh_dias_festivos WHERE id = ? AND company_id = ?', [id, companyId]);
    return { deleted: res.affectedRows > 0 };
}

async function toggleHoliday(companyId, id, isActive) {
    const [res] = await pool.query(
        'UPDATE rh_dias_festivos SET is_active = ? WHERE id = ? AND (company_id = ? OR company_id IS NULL)',
        [isActive ? 1 : 0, id, companyId]
    );
    return { success: res.affectedRows > 0 };
}

async function getOvertimeEmployees(companyId) {
    const [rows] = await pool.query(
        `SELECT e.id, e.codigo, e.nombres, e.apellidos,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as nombre_completo,
                e.cargo_id, c.descripcion as cargo_nombre,
                e.departamento_personal_id, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras
         FROM rh_empleados e
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE e.company_id = ? AND e.es_activo = 1
         ORDER BY e.nombres ASC`,
        [companyId]
    );
    return rows;
}

async function updateEmployeeOvertimeExemption(companyId, empleadoId, exento) {
    const [res] = await pool.query(
        'UPDATE rh_empleados SET exento_horas_extras = ? WHERE id = ? AND company_id = ?',
        [exento ? 1 : 0, empleadoId, companyId]
    );
    return { success: res.affectedRows > 0 };
}

async function batchUpdateOvertimeExemptions(companyId, { exemptIds = [], nonExemptIds = [] }) {
    if (exemptIds.length > 0) {
        await pool.query('UPDATE rh_empleados SET exento_horas_extras = 1 WHERE id IN (?) AND company_id = ?', [exemptIds, companyId]);
    }
    if (nonExemptIds.length > 0) {
        await pool.query('UPDATE rh_empleados SET exento_horas_extras = 0 WHERE id IN (?) AND company_id = ?', [nonExemptIds, companyId]);
    }
    return { success: true, updatedCount: exemptIds.length + nonExemptIds.length };
}

async function reclassifyPunches(companyId, startDate = null, endDate = null) {
    const s = await getSettings(companyId);
    const toleranciaMins = parseInt(s.tolerancia_entrada_minutos, 10) || 15;

    const dateFilter = [];
    const dateParams = [];
    if (startDate) { dateFilter.push('DATE(punch_time) >= ?'); dateParams.push(startDate); }
    if (endDate) { dateFilter.push('DATE(punch_time) <= ?'); dateParams.push(endDate); }
    const dateSql = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET punch_type = 'salida'
         WHERE company_id = ? AND source = 'agent'
           AND TIME(punch_time) >= ? AND TIME(punch_time) <= ? ${dateSql}`,
        [companyId, s.ventana_salida_inicio, s.ventana_salida_fin, ...dateParams]
    );

    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET punch_type = CASE WHEN TIME(punch_time) < '12:45:00' THEN 'salida_almuerzo' ELSE 'entrada_almuerzo' END
         WHERE company_id = ? AND source = 'agent'
           AND TIME(punch_time) >= ? AND TIME(punch_time) <= ? ${dateSql}`,
        [companyId, s.ventana_almuerzo_inicio, s.ventana_almuerzo_fin, ...dateParams]
    );

    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET punch_type = 'entrada'
         WHERE company_id = ? AND source = 'agent'
           AND (TIME(punch_time) >= ? AND TIME(punch_time) <= ? OR TIME(punch_time) < ?) ${dateSql}`,
        [companyId, s.ventana_entrada_inicio, s.ventana_entrada_fin, s.ventana_entrada_inicio, ...dateParams]
    );

    await pool.query(
        `UPDATE rh_biometric_attendance_logs
         SET es_llegada_tarde = CASE WHEN TIME(punch_time) > ADDTIME(?, SEC_TO_TIME(? * 60)) THEN 1 ELSE 0 END,
             minutos_tarde = CASE 
                 WHEN TIME(punch_time) > ADDTIME(?, SEC_TO_TIME(? * 60)) 
                 THEN GREATEST(0, TIMESTAMPDIFF(MINUTE, CONCAT(DATE(punch_time), ' ', ?), punch_time))
                 ELSE 0
             END
         WHERE company_id = ? AND punch_type = 'entrada' ${dateSql}`,
        [s.hora_entrada, toleranciaMins, s.hora_entrada, toleranciaMins, s.hora_entrada, companyId, ...dateParams]
    );

    return { success: true, message: 'Marcaciones reclasificadas exitosamente según turnos y horarios.' };
}

module.exports = {
    getSettings, updateSettings, getShifts, saveShift, deleteShift,
    getEmployeeShiftAssignments, assignEmployeeShift,
    getHolidays, saveHoliday, deleteHoliday, toggleHoliday,
    getOvertimeEmployees, updateEmployeeOvertimeExemption,
    batchUpdateOvertimeExemptions, reclassifyPunches
};
