const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');
const { debouncePunches, roundOvertimeMinutesToHours } = require('./rhBiometricCalc.helper');
const {
    resolveAreaAndCategory,
    getPreviousCorteCarryover,
    getSavedCorteSaldos,
    getExcusedAbsenceSet
} = require('./rhBiometricCortesSaldos.helper');
const { calculateQuincenaTitle, buildAndelsaWorkbookBuffer } = require('./rhBiometricAndelsaExcelWorkbook.helper');

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function calculateDayTimes(rawTimeStrings, dateStr, jornadaHoras = 9, options = {}) {
    const {
        redondeoMinutos = 30,
        umbralMinutos = 15,
        compensarSabado = true,
        horasJornadaSabado = 4,
        permitirSaldoNegativo = true,
        incluirDeficitDiario = false,
        esFestivo = false,
        esExcusado = false
    } = options;

    const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    const esDomingo = dow === 0;
    const esSabado = dow === 6;

    if (!rawTimeStrings || rawTimeStrings.length === 0) {
        let extraCalcHours = 0;
        if (esSabado && compensarSabado && permitirSaldoNegativo && !esFestivo && !esExcusado) {
            extraCalcHours = -Math.abs(parseFloat(horasJornadaSabado) || 4);
        }
        return { mEnt1: '', mSal1: '', mEnt2: '', mSal2: '', spanStr: '00:00:00', extraStr: '00:00:00', extraCalcHours, alerta: '' };
    }

    const fullTs = rawTimeStrings.map(t => `${dateStr} ${t}`);
    const { punches: debouncedFull, removedDuplicates } = debouncePunches(fullTs, 3);
    const sorted = debouncedFull.map(dt => dt.slice(11, 19));

    let mEnt1 = '', mSal1 = '', mEnt2 = '', mSal2 = '';
    const n = sorted.length;
    let alerta = '';

    if (n === 1) {
        mEnt1 = sorted[0];
        alerta = 'Marca incompleta (sin salida)';
    } else if (n === 2) {
        mEnt1 = sorted[0];
        mSal2 = sorted[1];
    } else if (n === 3) {
        mEnt1 = sorted[0];
        if (sorted[1] < '12:45:00') {
            mSal1 = sorted[1];
            alerta = 'Almuerzo incompleto';
        } else {
            mEnt2 = sorted[1];
            alerta = 'Almuerzo incompleto';
        }
        mSal2 = sorted[2];
    } else {
        mEnt1 = sorted[0];
        mSal1 = sorted[1];
        mEnt2 = sorted[2];
        mSal2 = sorted[n - 1];
    }

    const first = sorted[0];
    const last = sorted[n - 1];
    let spanMins = 0;
    if (n >= 2 && first && last && first !== last) {
        const [h1, min1] = first.split(':').map(Number);
        const [h2, min2] = last.split(':').map(Number);
        spanMins = Math.max(0, (h2 * 60 + min2) - (h1 * 60 + min1));
    }

    const jornadaMins = Math.round(jornadaHoras * 60);
    const sabadoMins = Math.round((parseFloat(horasJornadaSabado) || 4) * 60);
    let deltaMins = 0;
    if (esDomingo && compensarSabado) {
        deltaMins = spanMins;
    } else if (esSabado && compensarSabado) {
        deltaMins = spanMins - sabadoMins;
    } else if (incluirDeficitDiario && !esFestivo && !esExcusado && spanMins > 0 && spanMins < jornadaMins) {
        deltaMins = spanMins - jornadaMins;
    } else {
        deltaMins = Math.max(0, spanMins - jornadaMins);
    }

    const extraMinsDisplay = Math.max(0, deltaMins);
    const extraCalcHours = roundOvertimeMinutesToHours(deltaMins, redondeoMinutos, umbralMinutos);

    const pad = num => String(num).padStart(2, '0');
    const toHHMMSS = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`;

    if (removedDuplicates > 0 && !alerta) {
        alerta = `${removedDuplicates} doble toque filtrado`;
    }

    return {
        mEnt1, mSal1, mEnt2, mSal2,
        spanStr: spanMins > 0 ? toHHMMSS(spanMins) : '00:00:00',
        extraStr: extraMinsDisplay > 0 ? toHHMMSS(extraMinsDisplay) : '00:00:00',
        extraCalcHours,
        alerta
    };
}

async function generateAndelsaOvertimeExcel(companyId, filters = {}) {
    let startDate = filters.startDate || filters.start_date;
    let endDate = filters.endDate || filters.end_date;
    const corteId = filters.corteId || filters.corte_id || null;

    if (!startDate || !endDate) {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = today.getDate();
        if (!endDate) endDate = `${y}-${m}-${String(d).padStart(2, '0')}`;
        if (!startDate) startDate = d <= 15 ? `${y}-${m}-01` : `${y}-${m}-16`;
    }
    if (startDate && endDate && startDate > endDate) { const tmp = startDate; startDate = endDate; endDate = tmp; }
    const { branchId, departamentoId, search } = filters;

    const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const company = compRows[0] || {};
    const companyName = (company.razon_social || 'ANDELSA S.A DE C.V').toUpperCase();
    const settings = await getSettings(companyId);

    // Detectar si existe un corte congelado exactamente para este rango
    let resolvedCorteId = corteId;
    if (!resolvedCorteId) {
        const [matchCorte] = await pool.query(
            `SELECT id FROM rh_biometric_cortes
             WHERE company_id = ? AND fecha_inicio = ? AND fecha_fin = ?
             LIMIT 1`,
            [companyId, startDate, endDate]
        );
        if (matchCorte.length) resolvedCorteId = matchCorte[0].id;
    }

    const empConds = ['e.company_id = ?', 'COALESCE(e.omitir_marcador_digital, 0) = 0'];
    if (!resolvedCorteId) empConds.push('e.es_activo = 1');
    const empParams = [companyId];
    if (branchId && branchId !== 'todos') { empConds.push('e.branch_id = ?'); empParams.push(branchId); }
    if (departamentoId && departamentoId !== 'todos') { empConds.push('e.departamento_personal_id = ?'); empParams.push(departamentoId); }
    if (search && search.trim()) {
        empConds.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ?)');
        const s = `%${search.trim()}%`;
        empParams.push(s, s, s);
    }

    const [employees] = await pool.query(`
        SELECT e.id, e.codigo, e.codigo_biometrico,
               CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as nombre_completo,
               e.ocupacion, e.cargo_id, e.departamento_personal_id,
               c.descripcion as cargo_nombre, d.descripcion as depto_nombre,
               t.nombre as turno_nombre, t.horas_jornada_diaria
        FROM rh_empleados e
        LEFT JOIN rh_cargos c ON c.id = e.cargo_id
        LEFT JOIN rh_departamentos d ON d.id = e.departamento_personal_id
        LEFT JOIN rh_turnos t ON t.id = e.turno_id
        WHERE ${empConds.join(' AND ')}
        ORDER BY e.id ASC
    `, empParams);

    const [punches] = await pool.query(`
        SELECT l.id, l.device_uid, l.empleado_id, l.punch_time, l.punch_type,
               DATE_FORMAT(l.punch_time, '%Y-%m-%d') as fecha,
               DATE_FORMAT(l.punch_time, '%H:%i:%s') as hora
        FROM rh_biometric_attendance_logs l
        WHERE l.company_id = ? AND l.punch_time >= ? AND l.punch_time <= ?
        ORDER BY l.punch_time ASC
    `, [companyId, `${startDate} 00:00:00`, `${endDate} 23:59:59`]);

    const punchMap = new Map();
    punches.forEach(p => {
        if (p.empleado_id) {
            const k1 = `${p.empleado_id}_${p.fecha}`;
            if (!punchMap.has(k1)) punchMap.set(k1, []);
            punchMap.get(k1).push(p.hora);
        }
        if (p.device_uid) {
            const cleanUid = String(p.device_uid).trim().replace(/^0+/, '');
            const k2 = `uid_${cleanUid}_${p.fecha}`;
            if (!punchMap.has(k2)) punchMap.set(k2, []);
            punchMap.get(k2).push(p.hora);
        }
    });

    const [adjustments] = await pool.query(`
        SELECT id, empleado_id, device_uid, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
               entrada, salida, horas_extra_aprobadas, horas_extra_avicola, es_editado, observacion
        FROM rh_biometric_daily_overtime
        WHERE company_id = ? AND fecha >= ? AND fecha <= ?
    `, [companyId, startDate, endDate]);

    const adjMap = new Map();
    adjustments.forEach(a => {
        if (a.empleado_id) adjMap.set(`${a.empleado_id}_${a.fecha}`, a);
        if (a.device_uid) {
            const cleanUid = String(a.device_uid).trim().replace(/^0+/, '');
            adjMap.set(`uid_${cleanUid}_${a.fecha}`, a);
        }
    });

    const [holidays, savedSaldos, carryover, excusedSet] = await Promise.all([
        getHolidays(companyId, settings.pais_festivos || 'SV'),
        resolvedCorteId ? getSavedCorteSaldos(companyId, resolvedCorteId) : Promise.resolve(null),
        getPreviousCorteCarryover(companyId, startDate, resolvedCorteId || null),
        getExcusedAbsenceSet(companyId, startDate, endDate)
    ]);

    const holidayMap = new Map();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.set(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`, h.nombre || 'ASUETO');
    });

    const dateList = [];
    const cur = new Date(`${startDate}T12:00:00Z`);
    const endD = new Date(`${endDate}T12:00:00Z`);
    while (cur <= endD) {
        const dtStr = cur.toISOString().split('T')[0];
        dateList.push({ dateStr: dtStr, dayName: DAYS_ES[cur.getUTCDay()], dow: cur.getUTCDay() });
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const processedEmployees = [];
    const avicolaRows = [];
    let totalProduccion = 0;
    let totalOtrosTransporte = 0;
    let totalAvicola = 0;

    for (const emp of employees) {
        const bioUid = emp.codigo_biometrico ? String(emp.codigo_biometrico).trim() : null;
        const bioUidClean = bioUid ? bioUid.replace(/^0+/, '') : null;
        const { area: specificArea, categoria } = resolveAreaAndCategory(emp);
        const isTransporteArea = categoria === 'transporte';
        const savedS = savedSaldos ? (savedSaldos.byEmpId.get(Number(emp.id)) || (bioUid && savedSaldos.byUid.get(bioUid)) || null) : null;
        const prevCarry = carryover ? (carryover.byEmpId.get(Number(emp.id)) || (bioUid && carryover.byUid.get(bioUid)) || null) : null;

        const jornadaHoras = parseFloat(savedS?.horas_jornada_base || emp.horas_jornada_diaria || (isTransporteArea ? 8 : 9));
        const horasLaboralesStr = `${String(Math.floor(jornadaHoras)).padStart(2, '0')}:00:00`;
        const pendingCarry = savedS
            ? parseFloat(savedS.horas_pendientes_anteriores || 0)
            : (settings.permitir_saldo_negativo && prevCarry ? parseFloat(prevCarry.carry || 0) : 0);

        let totalHorasEmp = pendingCarry;
        const daysData = [];

        for (const d of dateList) {
            let punchList = punchMap.get(`${emp.id}_${d.dateStr}`);
            if ((!punchList || punchList.length === 0) && bioUidClean) {
                punchList = punchMap.get(`uid_${bioUidClean}_${d.dateStr}`);
            }
            punchList = punchList ? [...punchList].sort() : [];

            let adj = adjMap.get(`${emp.id}_${d.dateStr}`);
            if (!adj && bioUidClean) adj = adjMap.get(`uid_${bioUidClean}_${d.dateStr}`);

            // Omitir domingos sin actividad (en formato Andelsa solo aparecen Lunes-Sábado o Domingos trabajados)
            if (d.dow === 0 && punchList.length === 0 && !adj) continue;

            const [, m, dayNum] = d.dateStr.split('-');
            const holidayName = holidayMap.get(`${m}-${dayNum}`);
            const isExcused = excusedSet.has(`${emp.id}_${d.dateStr}`);

            const timeCalc = calculateDayTimes(punchList, d.dateStr, jornadaHoras, {
                redondeoMinutos: parseInt(settings.redondeo_horas_extra_minutos, 10) || 30,
                umbralMinutos: parseInt(settings.umbral_redondeo_minutos, 10) || 15,
                compensarSabado: settings.compensar_sabado !== undefined ? !!settings.compensar_sabado : true,
                horasJornadaSabado: parseFloat(settings.horas_jornada_sabado || 4),
                permitirSaldoNegativo: settings.permitir_saldo_negativo !== undefined ? !!settings.permitir_saldo_negativo : true,
                incluirDeficitDiario: !!(filters.includeDeficit === true || filters.includeDeficit === 1 || filters.includeDeficit === '1' || filters.includeDeficit === 'true'),
                esFestivo: !!holidayName,
                esExcusado: isExcused
            });

            let extraVal = 0;
            let observacion = adj?.observacion || '';
            let spanStr = timeCalc.spanStr;
            let extraStr = timeCalc.extraStr;

            if (adj && adj.horas_extra_aprobadas !== null) {
                extraVal = parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2));
            } else if (holidayName && punchList.length === 0) {
                extraVal = 0;
                observacion = observacion || holidayName;
                spanStr = '00:00:00';
                extraStr = '00:00:00';
            } else if (punchList.length === 0 && timeCalc.extraCalcHours === 0) {
                extraVal = '';
                spanStr = '00:00:00';
                extraStr = '00:00:00';
            } else {
                extraVal = timeCalc.extraCalcHours;
                if (!observacion && timeCalc.alerta) observacion = timeCalc.alerta;
            }

            if (typeof extraVal === 'number' && !isNaN(extraVal)) {
                totalHorasEmp += extraVal;
            }

            const avicHrs = parseFloat(adj?.horas_extra_avicola || 0);
            if (avicHrs > 0) {
                totalAvicola += avicHrs;
                avicolaRows.push({
                    nombre: emp.nombre_completo.trim(),
                    area: specificArea,
                    dayName: d.dayName,
                    dateStr: d.dateStr,
                    extraVal: avicHrs,
                    observacion: observacion || 'AVICOLA'
                });
            }

            daysData.push({
                dayName: d.dayName,
                dateStr: d.dateStr,
                mEnt1: timeCalc.mEnt1 || (adj?.entrada ? String(adj.entrada).slice(0, 5) : ''),
                mSal1: timeCalc.mSal1,
                mEnt2: timeCalc.mEnt2,
                mSal2: timeCalc.mSal2 || (adj?.salida ? String(adj.salida).slice(0, 5) : ''),
                extraVal: extraVal !== '' ? extraVal : '',
                observacion,
                tiempoTrabajo: spanStr,
                horaExtras: extraStr
            });
        }

        const hasActivity = daysData.some(d => d.mEnt1 || d.mSal1 || d.mEnt2 || d.mSal2 || (typeof d.extraVal === 'number' && d.extraVal !== 0)) || pendingCarry !== 0;
        if (hasActivity) {
            const empNet = parseFloat(totalHorasEmp.toFixed(2));
            if (isTransporteArea) totalOtrosTransporte += empNet;
            else totalProduccion += empNet;

            processedEmployees.push({
                nombre: emp.nombre_completo.trim(),
                area: savedS?.area || specificArea,
                categoria: savedS?.categoria || categoria,
                horasLaboralesStr,
                horasPendientes: pendingCarry,
                totalHorasEmp: empNet,
                days: daysData
            });
        }
    }

    const totalGeneralHorasExtra = parseFloat((totalProduccion + totalOtrosTransporte).toFixed(2));
    const quincenaTitle = calculateQuincenaTitle(startDate, endDate, filters.title || filters.corteNombre);

    return buildAndelsaWorkbookBuffer({
        companyName,
        quincenaTitle,
        processedEmployees,
        avicolaRows,
        totalProduccion: parseFloat(totalProduccion.toFixed(2)),
        totalOtrosTransporte: parseFloat(totalOtrosTransporte.toFixed(2)),
        totalAvicola: parseFloat(totalAvicola.toFixed(2)),
        totalGeneralHorasExtra
    });
}

module.exports = {
    generateAndelsaOvertimeExcel
};
