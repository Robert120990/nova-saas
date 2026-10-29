const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');
const {
    getTodayDateOnly,
    extractDateOnly,
    extractTime,
    timeStringToMinutes,
    diffMinutesLocal,
    addDays,
    normalizeDateRange,
    appendPunchTimeBounds
} = require('./rhBiometricDate.helper');
const writeOps = require('./rhBiometricCortesWrite.service');

/**
 * Obtener el último corte congelado de la empresa
 */
async function getLastCorte(companyId) {
    const [rows] = await pool.query(
        `SELECT id, company_id, nombre, fecha_inicio, fecha_fin, estado,
                total_empleados, total_horas_trabajadas, total_horas_extra,
                total_horas_extra_aprobadas, observaciones, created_at
         FROM rh_biometric_cortes
         WHERE company_id = ? AND estado = 'congelado'
         ORDER BY fecha_fin DESC, id DESC
         LIMIT 1`,
        [companyId]
    );
    if (!rows || rows.length === 0) return null;
    const c = rows[0];
    return {
        ...c,
        fecha_inicio: extractDateOnly(c.fecha_inicio),
        fecha_fin: extractDateOnly(c.fecha_fin)
    };
}

/**
 * Resumen de período pendiente de reporte
 */
async function getPendingRangeSummary(companyId) {
    const today = getTodayDateOnly();
    const lastCorte = await getLastCorte(companyId);
    let startDate;

    if (lastCorte && lastCorte.fecha_fin) {
        startDate = addDays(lastCorte.fecha_fin, 1);
    } else {
        const [minRow] = await pool.query(
            `SELECT MIN(DATE_FORMAT(punch_time, '%Y-%m-%d')) as min_date
             FROM rh_biometric_attendance_logs
             WHERE company_id = ?
               AND punch_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
               AND punch_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)`,
            [companyId]
        );
        if (minRow[0]?.min_date) {
            startDate = extractDateOnly(minRow[0].min_date);
        } else {
            const [latestRow] = await pool.query(
                `SELECT DATE_FORMAT(MAX(punch_time), '%Y-%m-01') as latest_month_start
                 FROM rh_biometric_attendance_logs
                 WHERE company_id = ?
                   AND punch_time >= '2018-01-01 00:00:00'
                   AND punch_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)`,
                [companyId]
            );
            startDate = latestRow[0]?.latest_month_start || `${today.slice(0, 8)}01`;
        }
    }

    if (!startDate || startDate > today) {
        startDate = today;
    }

    const endDate = today;

    const pendingData = await getDailyOvertimeRows(companyId, {
        startDate,
        endDate,
        onlyOvertime: 0,
        mode: 'pending'
    });

    return {
        ultimo_corte: lastCorte,
        rango_pendiente: {
            fecha_inicio: startDate,
            fecha_fin: endDate,
            total_filas: pendingData.summary.total_filas,
            total_empleados: pendingData.summary.total_empleados,
            total_horas_trabajadas: pendingData.summary.total_horas_trabajadas,
            total_horas_extra_calculadas: pendingData.summary.total_horas_extra_calculadas,
            total_horas_extra_aprobadas: pendingData.summary.total_horas_extra_aprobadas,
            total_editados: pendingData.summary.total_editados
        }
    };
}

/**
 * Obtener detalle de horas extra y asistencia diaria para un rango o corte
 */
async function getDailyOvertimeRows(companyId, filters = {}) {
    const { corteId, search, departmentId } = filters;
    const onlyOvertimeFlag = filters.onlyOvertime === true
        || filters.onlyOvertime === 1
        || filters.onlyOvertime === '1'
        || filters.onlyOvertime === 'true';

    let rawStart = filters.startDate || filters.start_date;
    let rawEnd = filters.endDate || filters.end_date;

    if (corteId) {
        const [corteRows] = await pool.query(
            `SELECT * FROM rh_biometric_cortes WHERE id = ? AND company_id = ?`,
            [corteId, companyId]
        );
        if (corteRows.length > 0) {
            rawStart = extractDateOnly(corteRows[0].fecha_inicio);
            rawEnd = extractDateOnly(corteRows[0].fecha_fin);
        }
    }

    const today = getTodayDateOnly();
    let { startDate, endDate } = normalizeDateRange(rawStart || today, rawEnd || today);
    if (!startDate) startDate = today;
    if (!endDate) endDate = today;
    if (filters.mode === 'pending' && endDate > today) {
        endDate = today;
    }
    if (startDate > endDate) {
        startDate = endDate;
    }

    const settings = await getSettings(companyId);
    const conditions = ['l.company_id = ?'];
    const params = [companyId];
    appendPunchTimeBounds(conditions, params, 'l', startDate, endDate);

    if (departmentId && departmentId !== 'todos') {
        conditions.push('e.departamento_personal_id = ?');
        params.push(departmentId);
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR l.device_uid LIKE ?)');
        params.push(s, s, s, s);
    }

    const [punches] = await pool.query(
        `SELECT l.id, l.device_uid, l.empleado_id,
                DATE_FORMAT(l.punch_time, '%Y-%m-%d %H:%i:%s') as punch_time_str,
                l.punch_type, l.source, l.congelado, l.corte_id,
                e.codigo as empleado_codigo,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras,
                t.nombre as turno_nombre,
                t.hora_entrada as turno_hora_entrada,
                t.hora_salida as turno_hora_salida,
                t.tolerancia_entrada_minutos as turno_tolerancia,
                t.horas_jornada_diaria as turno_jornada_horas
         FROM rh_biometric_attendance_logs l
         LEFT JOIN rh_empleados e ON e.id = l.empleado_id
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY l.punch_time ASC`,
        params
    );

    const [savedAdjustments] = await pool.query(
        `SELECT *, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha_str
         FROM rh_biometric_daily_overtime
         WHERE company_id = ? AND fecha >= ? AND fecha <= ?`,
        [companyId, startDate, endDate]
    );
    const adjustmentMap = new Map();
    savedAdjustments.forEach(adj => {
        const fKey = adj.fecha_str || extractDateOnly(adj.fecha);
        if (adj.device_uid) adjustmentMap.set(`${adj.device_uid}_${fKey}`, adj);
        if (adj.empleado_id) adjustmentMap.set(`emp_${adj.empleado_id}_${fKey}`, adj);
    });

    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const holidayMap = new Set();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.add(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`);
    });

    const grouped = new Map();
    for (const p of punches) {
        const ptStr = p.punch_time_str;
        const dateKey = extractDateOnly(ptStr);
        if (!dateKey) continue;
        const key = `${p.device_uid}_${dateKey}`;
        if (!grouped.has(key)) {
            grouped.set(key, {
                empleado_id: p.empleado_id,
                device_uid: p.device_uid,
                codigo: p.empleado_codigo || p.device_uid,
                nombre: p.empleado_nombre ? p.empleado_nombre.trim() : `Empleado UID ${p.device_uid}`,
                departamento: p.departamento_nombre || 'Sin Depto',
                cargo: p.cargo_nombre || 'Sin Cargo',
                fecha: dateKey,
                exento_horas_extras: !!p.exento_horas_extras,
                turno_nombre: p.turno_nombre || 'General',
                hora_entrada_esperada: p.turno_hora_entrada || settings.hora_entrada || '08:00:00',
                tolerancia_minutos: parseInt(p.turno_tolerancia ?? settings.tolerancia_entrada_minutos ?? 15, 10),
                jornada_horas: parseFloat(p.turno_jornada_horas ?? settings.horas_jornada_diaria ?? 8.00),
                congelado: !!p.congelado,
                corte_id: p.corte_id,
                punches: []
            });
        }
        grouped.get(key).punches.push(ptStr);
    }

    const rows = [];
    const empSet = new Set();
    let totalMinutosTrabajados = 0;
    let totalHorasExtraCalculadas = 0;
    let totalHorasExtraAprobadas = 0;
    let totalEditados = 0;

    for (const item of grouped.values()) {
        const sorted = item.punches.sort();
        const horaEntrada = sorted[0];
        let horaSalidaAlmuerzo = null;
        let horaEntradaAlmuerzo = null;
        let horaSalida = null;

        if (sorted.length === 2) {
            horaSalida = sorted[1];
        } else if (sorted.length === 3) {
            horaSalidaAlmuerzo = sorted[1];
            horaSalida = sorted[2];
        } else if (sorted.length >= 4) {
            horaSalidaAlmuerzo = sorted[1];
            horaEntradaAlmuerzo = sorted[2];
            horaSalida = sorted[sorted.length - 1];
        }

        const entradaEsperadaMins = timeStringToMinutes(item.hora_entrada_esperada);
        const limiteEntrada = entradaEsperadaMins + item.tolerancia_minutos;

        let minutosTardanza = 0;
        let esLlegadaTarde = false;
        if (horaEntrada) {
            const entradaRealMins = timeStringToMinutes(extractTime(horaEntrada));
            if (entradaRealMins > limiteEntrada) {
                minutosTardanza = entradaRealMins - entradaEsperadaMins;
                esLlegadaTarde = true;
            }
        }

        let minutosTrabajados = 0;
        if (horaEntrada && horaSalida) {
            let diffMins = diffMinutesLocal(horaEntrada, horaSalida);
            if (horaSalidaAlmuerzo && horaEntradaAlmuerzo) {
                const lunchMins = diffMinutesLocal(horaSalidaAlmuerzo, horaEntradaAlmuerzo);
                diffMins = Math.max(0, diffMins - lunchMins);
            }
            minutosTrabajados = diffMins;
        }

        const horasTrabajadas = parseFloat((minutosTrabajados / 60).toFixed(2));
        let horasExtraCalculadas = 0;
        if (!item.exento_horas_extras && horasTrabajadas > item.jornada_horas) {
            horasExtraCalculadas = parseFloat((horasTrabajadas - item.jornada_horas).toFixed(2));
        }

        const adj = adjustmentMap.get(`${item.device_uid}_${item.fecha}`)
            || (item.empleado_id ? adjustmentMap.get(`emp_${item.empleado_id}_${item.fecha}`) : null);
        const isEdited = adj ? !!adj.es_editado : false;
        const horasExtraAprobadas = adj && adj.horas_extra_aprobadas !== null
            ? parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2))
            : horasExtraCalculadas;
        const observacion = adj?.observacion || '';
        const isFrozen = adj ? !!adj.congelado : item.congelado;
        const activeCorteId = adj?.corte_id || item.corte_id;

        if (onlyOvertimeFlag && horasExtraCalculadas <= 0 && horasExtraAprobadas <= 0) {
            continue;
        }

        totalMinutosTrabajados += minutosTrabajados;
        empSet.add(item.empleado_id || item.device_uid);
        totalHorasExtraCalculadas += horasExtraCalculadas;
        totalHorasExtraAprobadas += horasExtraAprobadas;
        if (isEdited) totalEditados++;

        const [, m, d] = item.fecha.split('-');
        rows.push({
            id: adj?.id || null,
            empleado_id: item.empleado_id,
            device_uid: item.device_uid,
            codigo: item.codigo,
            nombre: item.nombre,
            cargo: item.cargo,
            departamento: item.departamento,
            fecha: item.fecha,
            entrada: extractTime(horaEntrada),
            salida: extractTime(horaSalida),
            horas_trabajadas: horasTrabajadas,
            minutos_tardanza: minutosTardanza,
            es_llegada_tarde: esLlegadaTarde,
            horas_extra_calculadas: horasExtraCalculadas,
            horas_extra_aprobadas: horasExtraAprobadas,
            es_editado: isEdited,
            observacion,
            congelado: isFrozen,
            corte_id: activeCorteId,
            exento_horas_extras: item.exento_horas_extras,
            es_festivo: holidayMap.has(`${m}-${d}`)
        });
    }

    return {
        rows,
        summary: {
            total_filas: rows.length,
            total_empleados: empSet.size,
            total_horas_trabajadas: parseFloat((totalMinutosTrabajados / 60).toFixed(2)),
            total_horas_extra_calculadas: parseFloat(totalHorasExtraCalculadas.toFixed(2)),
            total_horas_extra_aprobadas: parseFloat(totalHorasExtraAprobadas.toFixed(2)),
            total_editados: totalEditados
        },
        range: {
            fecha_inicio: startDate,
            fecha_fin: endDate
        }
    };
}

module.exports = {
    getLastCorte,
    getPendingRangeSummary,
    getDailyOvertimeRows,
    updateOvertimeEntry: writeOps.updateOvertimeEntry,
    freezePeriod: (companyId, userId, data) => writeOps.freezePeriod(companyId, userId, data, getDailyOvertimeRows),
    getCortesList: writeOps.getCortesList,
    unfreezeCorte: writeOps.unfreezeCorte
};
