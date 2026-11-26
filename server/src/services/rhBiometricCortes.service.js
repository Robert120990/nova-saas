const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');
const {
    getTodayDateOnly,
    extractDateOnly,
    extractTime,
    addDays,
    normalizeDateRange,
    appendPunchTimeBounds
} = require('./rhBiometricDate.helper');
const { evaluateDayAttendance } = require('./rhBiometricCalc.helper');
const {
    resolveAreaAndCategory,
    getPreviousCorteCarryover,
    getSavedCorteSaldos,
    getExcusedAbsenceSet,
    listSaturdaysInRange,
    buildEmployeeSaldosSummary
} = require('./rhBiometricCortesSaldos.helper');
const writeOps = require('./rhBiometricCortesWrite.service');

/**
 * Obtener el último corte congelado de la empresa
 */
async function getLastCorte(companyId) {
    const [rows] = await pool.query(
        `SELECT id, company_id, nombre, fecha_inicio, fecha_fin, estado,
                total_empleados, total_horas_trabajadas, total_horas_extra,
                total_horas_extra_aprobadas, total_horas_extra_produccion,
                total_horas_extra_transporte, total_horas_extra_avicola,
                total_horas_pendientes_aplicadas, total_horas_extra_pagables,
                observaciones, created_at
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

    if (!startDate || startDate > today) startDate = today;
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
            ...pendingData.summary
        },
        rules: pendingData.rules
    };
}

/**
 * Obtener detalle de horas extra y consolidado por colaborador para un rango o corte
 */
async function getDailyOvertimeRows(companyId, filters = {}) {
    const { corteId, search, departmentId, employeeKey } = filters;
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
    if (filters.mode === 'pending' && endDate > today) endDate = today;
    if (startDate > endDate) startDate = endDate;

    const settings = await getSettings(companyId);
    const rules = {
        modo_calculo_jornada: settings.modo_calculo_jornada || 'neto_sin_almuerzo',
        redondeo_horas_extra_minutos: parseInt(settings.redondeo_horas_extra_minutos, 10) || 0,
        umbral_redondeo_minutos: parseInt(settings.umbral_redondeo_minutos, 10) || 15,
        compensar_sabado: !!settings.compensar_sabado,
        horas_jornada_sabado: parseFloat(settings.horas_jornada_sabado || 4.0),
        permitir_saldo_negativo: !!settings.permitir_saldo_negativo,
        horas_jornada_diaria: parseFloat(settings.horas_jornada_diaria || 8.0)
    };

    const conditions = ['l.company_id = ?', '(e.id IS NULL OR COALESCE(e.omitir_marcador_digital, 0) = 0)'];
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
                e.codigo as empleado_codigo, e.ocupacion,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras,
                t.nombre as turno_nombre, t.hora_entrada as turno_hora_entrada,
                t.hora_salida as turno_hora_salida, t.tolerancia_entrada_minutos as turno_tolerancia,
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

    const adjConds = ['o.company_id = ?'];
    const adjParams = [companyId];
    if (corteId) {
        adjConds.push('(o.corte_id = ? OR (o.fecha >= ? AND o.fecha <= ?))');
        adjParams.push(corteId, startDate, endDate);
    } else {
        adjConds.push('o.fecha >= ? AND o.fecha <= ?');
        adjParams.push(startDate, endDate);
    }
    if (departmentId && departmentId !== 'todos') {
        adjConds.push('e.departamento_personal_id = ?');
        adjParams.push(departmentId);
    }
    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        adjConds.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR o.device_uid LIKE ? OR o.observacion LIKE ?)');
        adjParams.push(s, s, s, s, s);
    }

    const [savedAdjustments] = await pool.query(
        `SELECT o.*, DATE_FORMAT(o.fecha, '%Y-%m-%d') as fecha_str,
                e.codigo as empleado_codigo, e.ocupacion,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras,
                t.nombre as turno_nombre, t.hora_entrada as turno_hora_entrada,
                t.tolerancia_entrada_minutos as turno_tolerancia,
                t.horas_jornada_diaria as turno_jornada_horas
         FROM rh_biometric_daily_overtime o
         LEFT JOIN rh_empleados e ON e.id = o.empleado_id
         LEFT JOIN rh_turnos t ON t.id = e.turno_id
         LEFT JOIN rh_cargos c ON c.id = e.cargo_id
         LEFT JOIN rh_departamentos dep ON dep.id = e.departamento_personal_id
         WHERE ${adjConds.join(' AND ')}
         ORDER BY o.fecha ASC, o.id ASC`,
        adjParams
    );

    const adjustmentMap = new Map();
    savedAdjustments.forEach(adj => {
        const fKey = adj.fecha_str || extractDateOnly(adj.fecha);
        if (adj.device_uid) adjustmentMap.set(`${adj.device_uid}_${fKey}`, adj);
        if (adj.empleado_id) adjustmentMap.set(`emp_${adj.empleado_id}_${fKey}`, adj);
    });

    const [holidays, savedSaldos, carryover, excusedSet] = await Promise.all([
        getHolidays(companyId, settings.pais_festivos || 'SV'),
        corteId ? getSavedCorteSaldos(companyId, corteId) : Promise.resolve(null),
        getPreviousCorteCarryover(companyId, startDate, corteId || null),
        !corteId && rules.compensar_sabado ? getExcusedAbsenceSet(companyId, startDate, endDate) : Promise.resolve(new Set())
    ]);

    const holidayMap = new Set();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.add(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`);
    });

    const grouped = new Map();
    const activeEmployeesMeta = new Map();

    // Si es corte congelado con saldos/ajustes propios, usamos savedAdjustments como base principal y complementamos con punches
    const frozenHasSavedDaily = !!(corteId && savedAdjustments.some(a => Number(a.corte_id) === Number(corteId)));

    for (const p of punches) {
        const ptStr = p.punch_time_str;
        const dateKey = extractDateOnly(ptStr);
        if (!dateKey) continue;
        if (frozenHasSavedDaily && !adjustmentMap.has(`${p.device_uid}_${dateKey}`) && !(p.empleado_id && adjustmentMap.has(`emp_${p.empleado_id}_${dateKey}`))) {
            continue;
        }
        const key = `${p.device_uid}_${dateKey}`;
        if (!grouped.has(key)) {
            const areaInfo = resolveAreaAndCategory(p);
            const defaultBase = rules.modo_calculo_jornada === 'bruto_con_almuerzo'
                ? (areaInfo.categoria === 'transporte' ? 8.0 : rules.horas_jornada_diaria)
                : rules.horas_jornada_diaria;
            const meta = {
                empleado_id: p.empleado_id,
                device_uid: String(p.device_uid),
                codigo: p.empleado_codigo || p.device_uid,
                nombre: p.empleado_nombre?.trim() || `Empleado UID ${p.device_uid}`,
                departamento: p.departamento_nombre || 'Sin Depto',
                cargo: p.cargo_nombre || 'Sin Cargo',
                ocupacion: p.ocupacion || '',
                area: areaInfo.area,
                categoria: areaInfo.categoria,
                exento_horas_extras: !!p.exento_horas_extras,
                turno_nombre: p.turno_nombre || 'General',
                hora_entrada_esperada: p.turno_hora_entrada || settings.hora_entrada || '08:00:00',
                tolerancia_minutos: parseInt(p.turno_tolerancia ?? settings.tolerancia_entrada_minutos ?? 15, 10),
                jornada_horas: parseFloat(p.turno_jornada_horas ?? defaultBase)
            };
            grouped.set(key, { ...meta, fecha: dateKey, congelado: !!p.congelado, corte_id: p.corte_id, es_dia_compensacion: false, punches: [] });
            activeEmployeesMeta.set(meta.device_uid, meta);
        }
        grouped.get(key).punches.push(ptStr);
    }

    // Incorporar registros guardados en rh_biometric_daily_overtime sin marcaciones (sábados -4h, faltas, cortes importados)
    for (const adj of savedAdjustments) {
        const fKey = adj.fecha_str || extractDateOnly(adj.fecha);
        if (!fKey) continue;
        if (corteId && frozenHasSavedDaily && Number(adj.corte_id) !== Number(corteId)) continue;
        const key = `${adj.device_uid}_${fKey}`;
        if (!grouped.has(key)) {
            const savedMeta = savedSaldos?.byUid?.get(String(adj.device_uid));
            const areaInfo = resolveAreaAndCategory(adj);
            const defaultBase = rules.modo_calculo_jornada === 'bruto_con_almuerzo'
                ? (areaInfo.categoria === 'transporte' ? 8.0 : rules.horas_jornada_diaria)
                : rules.horas_jornada_diaria;
            const meta = {
                empleado_id: adj.empleado_id,
                device_uid: String(adj.device_uid),
                codigo: adj.empleado_codigo || adj.device_uid,
                nombre: adj.empleado_nombre?.trim() || savedMeta?.empleado_nombre || `Empleado UID ${adj.device_uid}`,
                departamento: adj.departamento_nombre || 'Sin Depto',
                cargo: adj.cargo_nombre || 'Sin Cargo',
                ocupacion: adj.ocupacion || '',
                area: savedMeta?.area || areaInfo.area,
                categoria: savedMeta?.categoria || areaInfo.categoria,
                exento_horas_extras: !!adj.exento_horas_extras,
                turno_nombre: adj.turno_nombre || 'General',
                hora_entrada_esperada: adj.turno_hora_entrada || settings.hora_entrada || '08:00:00',
                tolerancia_minutos: parseInt(adj.turno_tolerancia ?? settings.tolerancia_entrada_minutos ?? 15, 10),
                jornada_horas: parseFloat(savedMeta?.horas_jornada_base ?? adj.turno_jornada_horas ?? defaultBase)
            };
            grouped.set(key, {
                ...meta,
                fecha: fKey,
                congelado: !!adj.congelado,
                corte_id: adj.corte_id,
                es_dia_compensacion: !!adj.es_dia_compensacion,
                punches: []
            });
            activeEmployeesMeta.set(meta.device_uid, meta);
        }
    }

    // En modo pendiente con compensar_sabado activo: generar automáticamente filas de Sábado (-4h) para empleados activos que no marcaron
    if (!corteId && rules.compensar_sabado && rules.permitir_saldo_negativo) {
        const saturdays = listSaturdaysInRange(startDate, endDate, today);
        for (const satDate of saturdays) {
            const [, m, d] = satDate.split('-');
            if (holidayMap.has(`${m}-${d}`)) continue;
            for (const meta of activeEmployeesMeta.values()) {
                if (meta.exento_horas_extras) continue;
                const key = `${meta.device_uid}_${satDate}`;
                if (grouped.has(key)) continue;
                if (meta.empleado_id && excusedSet.has(`${meta.empleado_id}_${satDate}`)) continue;
                grouped.set(key, {
                    ...meta,
                    fecha: satDate,
                    congelado: false,
                    corte_id: null,
                    es_dia_compensacion: true,
                    punches: []
                });
            }
        }
    }

    const allRows = [];
    for (const item of grouped.values()) {
        const [, m, d] = item.fecha.split('-');
        const esFestivo = holidayMap.has(`${m}-${d}`);
        const calc = evaluateDayAttendance(item.punches, {
            fecha: item.fecha,
            horaEntradaEsperada: item.hora_entrada_esperada,
            toleranciaMinutos: item.tolerancia_minutos,
            jornadaHoras: item.jornada_horas,
            exentoHorasExtras: item.exento_horas_extras,
            esFestivo,
            modoCalculoJornada: rules.modo_calculo_jornada,
            redondeoMinutos: rules.redondeo_horas_extra_minutos,
            umbralRedondeoMinutos: rules.umbral_redondeo_minutos,
            compensarSabado: rules.compensar_sabado,
            horasJornadaSabado: rules.horas_jornada_sabado,
            permitirSaldoNegativo: rules.permitir_saldo_negativo
        });

        const adj = adjustmentMap.get(`${item.device_uid}_${item.fecha}`)
            || (item.empleado_id ? adjustmentMap.get(`emp_${item.empleado_id}_${item.fecha}`) : null);
        const isEdited = adj ? !!adj.es_editado : false;
        const hasPunches = item.punches.length > 0;
        const horasTrabajadas = hasPunches ? calc.horasTrabajadas : parseFloat(Number(adj?.horas_trabajadas || 0).toFixed(2));
        const horasExtraCalc = hasPunches || item.es_dia_compensacion
            ? calc.horasExtraCalculadas
            : parseFloat(Number(adj?.horas_extra_calculadas ?? calc.horasExtraCalculadas).toFixed(2));
        const horasExtraAprobadas = adj && adj.horas_extra_aprobadas !== null
            ? parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2))
            : horasExtraCalc;
        const horasExtraAvicola = parseFloat(Number(adj?.horas_extra_avicola || 0).toFixed(2));
        const observacion = adj?.observacion || (item.es_dia_compensacion ? 'Compensación sábado (44h sem.)' : '');
        const entrada = hasPunches ? extractTime(calc.horaEntrada) : (adj?.entrada ? String(adj.entrada).slice(0, 8) : '---');
        const salida = hasPunches ? extractTime(calc.horaSalida) : (adj?.salida ? String(adj.salida).slice(0, 8) : '---');

        let heDiurnas = calc.horasExtraDiurnas;
        let heNocturnas = calc.horasExtraNocturnas;
        if (isEdited || !hasPunches) {
            if (horasExtraAprobadas <= 0) {
                heDiurnas = 0;
                heNocturnas = 0;
            } else if (horasExtraCalc > 0) {
                const ratio = horasExtraAprobadas / horasExtraCalc;
                heNocturnas = parseFloat((calc.horasExtraNocturnas * ratio).toFixed(2));
                heDiurnas = parseFloat(Math.max(0, horasExtraAprobadas - heNocturnas).toFixed(2));
            } else {
                heDiurnas = horasExtraAprobadas;
                heNocturnas = 0;
            }
        }

        const empKey = item.empleado_id ? `emp_${item.empleado_id}` : `uid_${item.device_uid}`;

        allRows.push({
            id: adj?.id || null,
            employee_key: empKey,
            empleado_id: item.empleado_id,
            device_uid: item.device_uid,
            codigo: item.codigo,
            nombre: item.nombre,
            cargo: item.cargo,
            departamento: item.departamento,
            area: item.area,
            categoria: item.categoria,
            jornada_horas: item.jornada_horas,
            fecha: item.fecha,
            entrada,
            salida,
            horas_trabajadas: horasTrabajadas,
            minutos_tardanza: hasPunches ? calc.minutosTardanza : Number(adj?.minutos_tardanza || 0),
            es_llegada_tarde: hasPunches ? calc.esLlegadaTarde : Number(adj?.minutos_tardanza || 0) > 0,
            horas_extra_calculadas: horasExtraCalc,
            horas_extra_aprobadas: horasExtraAprobadas,
            horas_extra_avicola: horasExtraAvicola,
            horas_extra_diurnas: heDiurnas,
            horas_extra_nocturnas: heNocturnas,
            es_sabado: calc.esSabado,
            es_domingo: calc.esDomingo,
            es_festivo: calc.esFestivo,
            es_dia_compensacion: !!(adj?.es_dia_compensacion || item.es_dia_compensacion),
            marcas_count: calc.marcasCount,
            es_marcacion_incompleta: hasPunches ? calc.esMarcacionIncompleta : false,
            alerta_marcacion: hasPunches ? calc.alertaMarcacion : '',
            es_editado: isEdited,
            observacion,
            congelado: adj ? !!adj.congelado : item.congelado,
            corte_id: adj?.corte_id || item.corte_id,
            exento_horas_extras: item.exento_horas_extras
        });
    }

    allRows.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.nombre).localeCompare(String(b.nombre), 'es'));

    const { employeeSummaries: allEmployeeSummaries, categoryTotals: fullCategoryTotals } = buildEmployeeSaldosSummary(allRows, {
        carryover,
        savedSaldos,
        permitirSaldoNegativo: rules.permitir_saldo_negativo
    });

    const hasEmpFilter = !!(employeeKey && employeeKey !== 'todos' && employeeKey !== 'all');
    const scopedRows = hasEmpFilter ? allRows.filter(r => r.employee_key === employeeKey) : allRows;
    const rows = onlyOvertimeFlag
        ? scopedRows.filter(r => r.horas_extra_calculadas !== 0 || r.horas_extra_aprobadas !== 0 || r.horas_extra_avicola > 0)
        : scopedRows;

    const { employeeSummaries: scopedSummaries, categoryTotals } = hasEmpFilter
        ? buildEmployeeSaldosSummary(scopedRows, { carryover, savedSaldos, permitirSaldoNegativo: rules.permitir_saldo_negativo })
        : { employeeSummaries: allEmployeeSummaries, categoryTotals: fullCategoryTotals };

    const totalHorasTrabajadas = parseFloat(rows.reduce((s, r) => s + Number(r.horas_trabajadas || 0), 0).toFixed(2));
    const totalHorasExtraCalculadas = parseFloat(rows.reduce((s, r) => s + Number(r.horas_extra_calculadas || 0), 0).toFixed(2));
    const totalHorasExtraPeriodo = parseFloat(rows.reduce((s, r) => s + Number(r.horas_extra_aprobadas || 0), 0).toFixed(2));
    const totalHorasExtraDiurnas = parseFloat(rows.reduce((s, r) => s + Number(r.horas_extra_diurnas || 0), 0).toFixed(2));
    const totalHorasExtraNocturnas = parseFloat(rows.reduce((s, r) => s + Number(r.horas_extra_nocturnas || 0), 0).toFixed(2));
    const totalEditados = rows.filter(r => r.es_editado).length;
    const totalIncompletas = rows.filter(r => r.es_marcacion_incompleta).length;
    const totalLlegadasTarde = rows.filter(r => r.es_llegada_tarde).length;
    const totalMinutosTardanza = rows.reduce((s, r) => s + Number(r.minutos_tardanza || 0), 0);

    return {
        rows,
        employees: allEmployeeSummaries,
        employeeSummaries: allEmployeeSummaries,
        summary: {
            total_filas: rows.length,
            total_empleados: scopedSummaries.length,
            total_horas_trabajadas: totalHorasTrabajadas,
            total_horas_extra_calculadas: totalHorasExtraCalculadas,
            total_horas_extra_periodo: totalHorasExtraPeriodo,
            total_horas_extra_aprobadas: categoryTotals.total_horas_extra_netas,
            total_horas_extra_diurnas: totalHorasExtraDiurnas,
            total_horas_extra_nocturnas: totalHorasExtraNocturnas,
            total_llegadas_tarde: totalLlegadasTarde,
            total_minutos_tardanza: totalMinutosTardanza,
            total_editados: totalEditados,
            total_incompletas: totalIncompletas,
            ...categoryTotals
        },
        periodTotals: fullCategoryTotals,
        previous_corte: carryover.prevCorte,
        rules,
        range: { fecha_inicio: startDate, fecha_fin: endDate }
    };
}

module.exports = {
    getLastCorte,
    getPendingRangeSummary,
    getDailyOvertimeRows,
    updateOvertimeEntry: writeOps.updateOvertimeEntry,
    batchUpdateOvertimeEntries: writeOps.batchUpdateOvertimeEntries,
    freezePeriod: (companyId, userId, data) => writeOps.freezePeriod(companyId, userId, data, getDailyOvertimeRows),
    getCortesList: writeOps.getCortesList,
    unfreezeCorte: writeOps.unfreezeCorte
};
