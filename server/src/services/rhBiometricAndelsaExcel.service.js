const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');
const { debouncePunches } = require('./rhBiometricCalc.helper');
const { calculateQuincenaTitle, buildAndelsaWorkbookBuffer } = require('./rhBiometricAndelsaExcelWorkbook.helper');

const FALLBACK_ANDELSA_AREAS = {
    '22': 'Quebradoras', '26': 'Empaque', '24': 'Bodega', '795': 'Transferencia',
    '23': 'Logistica', '27': 'Logistica', '21': 'Transferencia', '20': 'Bodega',
    '32': 'Quebraje', '790': 'Pasteurizacion', '794': 'Produccion', '793': 'Produccion',
    '25': 'Transferencia', '28': 'Transferencia'
};

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function resolveEmployeeArea(emp) {
    const cleanDepto = (emp.depto_nombre || '').trim();
    const cleanOcup = (emp.ocupacion || '').trim();
    const cleanCargo = (emp.cargo_nombre || '').trim();
    if (cleanOcup && !/^operario$/i.test(cleanOcup)) return cleanOcup;
    if (cleanDepto && !/^planta$/i.test(cleanDepto)) return cleanDepto;
    return FALLBACK_ANDELSA_AREAS[String(emp.id)] || cleanDepto || cleanCargo || 'Producción';
}

function calculateDayTimes(rawTimeStrings, dateStr, jornadaHoras = 9) {
    if (!rawTimeStrings || rawTimeStrings.length === 0) {
        return { mEnt1: '', mSal1: '', mEnt2: '', mSal2: '', spanStr: '00:00:00', extraStr: '00:00:00', extraCalcHours: 0, alerta: '' };
    }

    // Aplicar filtro anti-rebote (< 3 min) usando fecha+hora completa
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
    const extraMins = Math.max(0, spanMins - jornadaMins);

    const pad = num => String(num).padStart(2, '0');
    const toHHMMSS = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`;

    if (removedDuplicates > 0 && !alerta) {
        alerta = `${removedDuplicates} doble toque filtrado`;
    }

    return {
        mEnt1,
        mSal1,
        mEnt2,
        mSal2,
        spanStr: spanMins > 0 ? toHHMMSS(spanMins) : '00:00:00',
        extraStr: extraMins > 0 ? toHHMMSS(extraMins) : '00:00:00',
        extraCalcHours: parseFloat((extraMins / 60).toFixed(1)),
        alerta
    };
}

async function generateAndelsaOvertimeExcel(companyId, filters = {}) {
    let startDate = filters.startDate || filters.start_date;
    let endDate = filters.endDate || filters.end_date;

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

    const empConds = ['e.company_id = ?', 'e.es_activo = 1', 'COALESCE(e.omitir_marcador_digital, 0) = 0'];
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
               horas_extra_aprobadas, es_editado, observacion
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

    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const holidayMap = new Map();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.set(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`, h.nombre || 'ASUETO');
    });

    const dateList = [];
    const cur = new Date(`${startDate}T12:00:00Z`);
    const endD = new Date(`${endDate}T12:00:00Z`);
    while (cur <= endD) {
        const dtStr = cur.toISOString().split('T')[0];
        dateList.push({ dateStr: dtStr, dayName: DAYS_ES[cur.getUTCDay()] });
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const processedEmployees = [];
    let totalProduccion = 0;
    let totalOtrosTransporte = 0;

    for (const emp of employees) {
        const bioUid = emp.codigo_biometrico ? String(emp.codigo_biometrico).trim() : null;
        const bioUidClean = bioUid ? bioUid.replace(/^0+/, '') : null;
        const specificArea = resolveEmployeeArea(emp);
        const isTransporteArea = /logistica|bodega|transporte/i.test(specificArea);
        const jornadaHoras = parseFloat(emp.horas_jornada_diaria || (isTransporteArea ? 8 : 9));
        const horasLaboralesStr = `${String(Math.floor(jornadaHoras)).padStart(2, '0')}:00:00`;

        let totalHorasEmp = 0;
        const daysData = [];

        for (const d of dateList) {
            let punchList = punchMap.get(`${emp.id}_${d.dateStr}`);
            if ((!punchList || punchList.length === 0) && bioUidClean) {
                punchList = punchMap.get(`uid_${bioUidClean}_${d.dateStr}`);
            }
            punchList = punchList ? [...punchList].sort() : [];

            const timeCalc = calculateDayTimes(punchList, d.dateStr, jornadaHoras);
            let adj = adjMap.get(`${emp.id}_${d.dateStr}`);
            if (!adj && bioUidClean) adj = adjMap.get(`uid_${bioUidClean}_${d.dateStr}`);

            const [, m, dayNum] = d.dateStr.split('-');
            const holidayName = holidayMap.get(`${m}-${dayNum}`);

            let extraVal = 0;
            let observacion = adj?.observacion || '';
            let spanStr = timeCalc.spanStr;
            let extraStr = timeCalc.extraStr;

            if (adj && adj.horas_extra_aprobadas !== null) {
                extraVal = parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2));
            } else if (holidayName) {
                extraVal = 0;
                observacion = observacion || holidayName;
                spanStr = 'NaN';
                extraStr = 'NaN';
            } else if (punchList.length === 0) {
                extraVal = '';
                spanStr = '00:00:00';
                extraStr = '00:00:00';
            } else {
                extraVal = timeCalc.extraCalcHours > 0 ? (Math.round(timeCalc.extraCalcHours * 2) / 2) : 0;
                if (!observacion && timeCalc.alerta) observacion = timeCalc.alerta;
            }

            if (typeof extraVal === 'number' && !isNaN(extraVal)) {
                totalHorasEmp += extraVal;
            }

            daysData.push({
                dayName: d.dayName,
                dateStr: d.dateStr,
                mEnt1: timeCalc.mEnt1,
                mSal1: timeCalc.mSal1,
                mEnt2: timeCalc.mEnt2,
                mSal2: timeCalc.mSal2,
                extraVal: extraVal !== '' ? extraVal : '',
                observacion,
                tiempoTrabajo: spanStr,
                horaExtras: extraStr
            });
        }

        const hasActivity = daysData.some(d => d.mEnt1 || d.mSal1 || d.mEnt2 || d.mSal2 || (typeof d.extraVal === 'number' && d.extraVal !== 0));
        if (hasActivity) {
            if (isTransporteArea) totalOtrosTransporte += totalHorasEmp;
            else totalProduccion += totalHorasEmp;

            processedEmployees.push({
                nombre: emp.nombre_completo.trim(),
                area: specificArea,
                horasLaboralesStr,
                totalHorasEmp: parseFloat(totalHorasEmp.toFixed(2)),
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
        totalProduccion: parseFloat(totalProduccion.toFixed(2)),
        totalOtrosTransporte: parseFloat(totalOtrosTransporte.toFixed(2)),
        totalGeneralHorasExtra
    });
}

module.exports = {
    generateAndelsaOvertimeExcel
};
