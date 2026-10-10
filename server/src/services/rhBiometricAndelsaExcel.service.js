const ExcelJS = require('exceljs');
const pool = require('../config/db');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');

const KNOWN_ANDELSA_AREAS = {
    '22': 'Quebradoras',
    '26': 'Empaque',
    '24': 'Bodega',
    '795': 'Transferencia',
    '23': 'Logistica',
    '27': 'Logistica',
    '21': 'Transferencia',
    '20': 'Bodega',
    '32': 'Quebraje',
    '790': 'Pasteurizacion',
    '794': 'Produccion',
    '793': 'Produccion',
    '25': 'Transferencia',
    '28': 'Transferencia'
};

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatTimeOnly(val) {
    if (!val) return '';
    if (typeof val === 'string') {
        const m = val.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
        return m ? `${m[1]}:${m[2]}:${m[3] || '00'}` : val;
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
        const pad = n => String(n).padStart(2, '0');
        return `${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
    }
    return '';
}

function calculateQuincenaTitle(startDateStr, endDateStr, explicitTitle) {
    if (explicitTitle && typeof explicitTitle === 'string' && explicitTitle.trim()) {
        return explicitTitle.trim();
    }
    // Si tenemos fecha de fin (endDateStr), la quincena de pago corresponde a dicha fecha de cierre:
    // Cierre del 1 al 15 -> 1° Quincena del mes de cierre (ej. corte al 10 de octubre -> 1° Quincena Octubre)
    // Cierre del 16 en adelante -> 2° Quincena del mes de cierre (ej. corte al 25 de septiembre -> 2° Quincena Septiembre)
    if (endDateStr) {
        const [y, m, d] = endDateStr.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            const monthName = MONTHS_ES[(m - 1) % 12];
            const quincenaLabel = d <= 15 ? '1°' : '2°';
            return `${quincenaLabel} Quincena ${monthName}  ${y}`;
        }
    }
    if (startDateStr) {
        const [y, m, d] = startDateStr.split('-').map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            if (d >= 20) {
                const nextM = m === 12 ? 1 : m + 1;
                const nextY = m === 12 ? y + 1 : y;
                return `1° Quincena ${MONTHS_ES[nextM - 1]}  ${nextY}`;
            }
            const monthName = MONTHS_ES[(m - 1) % 12];
            const quincenaLabel = d <= 5 ? '1°' : '2°';
            return `${quincenaLabel} Quincena ${monthName}  ${y}`;
        }
    }
    return 'Reporte de Horas Extras';
}

function calculateDayTimes(sortedTimeStrings, jornadaHoras = 9) {
    if (!sortedTimeStrings || sortedTimeStrings.length === 0) {
        return { mEnt1: '', mSal1: '', mEnt2: '', mSal2: '', spanStr: '00:00:00', extraStr: '00:00:00', extraCalcHours: 0 };
    }

    let mEnt1 = '', mSal1 = '', mEnt2 = '', mSal2 = '';
    const n = sortedTimeStrings.length;

    if (n === 1) {
        mEnt1 = sortedTimeStrings[0];
    } else if (n === 2) {
        mEnt1 = sortedTimeStrings[0];
        mSal2 = sortedTimeStrings[1];
    } else if (n === 3) {
        mEnt1 = sortedTimeStrings[0];
        if (sortedTimeStrings[1] < '14:00:00') {
            mSal1 = sortedTimeStrings[1];
            mSal2 = sortedTimeStrings[2];
        } else {
            mEnt2 = sortedTimeStrings[1];
            mSal2 = sortedTimeStrings[2];
        }
    } else {
        mEnt1 = sortedTimeStrings[0];
        mSal1 = sortedTimeStrings[1];
        mEnt2 = sortedTimeStrings[2];
        mSal2 = sortedTimeStrings[n - 1];
    }

    const first = sortedTimeStrings[0];
    const last = sortedTimeStrings[n - 1];
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

    return {
        mEnt1,
        mSal1,
        mEnt2,
        mSal2,
        spanStr: spanMins > 0 ? toHHMMSS(spanMins) : '00:00:00',
        extraStr: extraMins > 0 ? toHHMMSS(extraMins) : '00:00:00',
        extraCalcHours: parseFloat((extraMins / 60).toFixed(1))
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
        if (!endDate) {
            endDate = `${y}-${m}-${String(d).padStart(2, '0')}`;
        }
        if (!startDate) {
            startDate = d <= 15 ? `${y}-${m}-01` : `${y}-${m}-16`;
        }
    }
    const { branchId, departamentoId, search } = filters;

    const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const company = compRows[0] || {};
    const companyName = (company.razon_social || 'ANDELSA S.A DE C.V').toUpperCase();
    const settings = await getSettings(companyId);

    // 1. Empleados activos
    const empConds = ['e.company_id = ?', 'e.es_activo = 1'];
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

    // 2. Marcaciones
    const [punches] = await pool.query(`
        SELECT l.id, l.device_uid, l.empleado_id, l.punch_time, l.punch_type,
               DATE_FORMAT(l.punch_time, '%Y-%m-%d') as fecha,
               DATE_FORMAT(l.punch_time, '%H:%i:%s') as hora
        FROM rh_biometric_attendance_logs l
        WHERE l.company_id = ? AND DATE(l.punch_time) >= ? AND DATE(l.punch_time) <= ?
        ORDER BY l.punch_time ASC
    `, [companyId, startDate, endDate]);

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

            const k2Raw = `uid_${String(p.device_uid).trim()}_${p.fecha}`;
            if (k2Raw !== k2) {
                if (!punchMap.has(k2Raw)) punchMap.set(k2Raw, []);
                punchMap.get(k2Raw).push(p.hora);
            }
        }
    });

    // 3. Ajustes de horas extra
    const [adjustments] = await pool.query(`
        SELECT id, empleado_id, device_uid, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha,
               horas_extra_aprobadas, es_editado, observacion
        FROM rh_biometric_daily_overtime
        WHERE company_id = ? AND fecha >= ? AND fecha <= ?
    `, [companyId, startDate, endDate]);

    const adjMap = new Map();
    adjustments.forEach(a => {
        if (a.empleado_id) {
            adjMap.set(`${a.empleado_id}_${a.fecha}`, a);
        }
        if (a.device_uid) {
            const cleanUid = String(a.device_uid).trim().replace(/^0+/, '');
            adjMap.set(`uid_${cleanUid}_${a.fecha}`, a);
            adjMap.set(`uid_${String(a.device_uid).trim()}_${a.fecha}`, a);
        }
    });

    // 4. Festivos
    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const holidayMap = new Map();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.set(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`, h.nombre || 'ASUETO');
    });

    // 5. Lista de días calendario en el rango
    const dateList = [];
    let cur = new Date(`${startDate}T12:00:00Z`);
    const endD = new Date(`${endDate}T12:00:00Z`);
    while (cur <= endD) {
        const dtStr = cur.toISOString().split('T')[0];
        const dayIdx = cur.getUTCDay();
        dateList.push({ dateStr: dtStr, dayName: DAYS_ES[dayIdx], dayIdx });
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // 6. Preparar datos procesados por empleado
    const processedEmployees = [];
    let totalProduccion = 0;
    let totalOtrosTransporte = 0;

    for (const emp of employees) {
        const bioUid = emp.codigo_biometrico ? String(emp.codigo_biometrico).trim() : null;
        const bioUidClean = bioUid ? bioUid.replace(/^0+/, '') : null;
        const specificArea = KNOWN_ANDELSA_AREAS[String(emp.id)] || emp.ocupacion || emp.cargo_nombre || emp.depto_nombre || 'Producción';
        const isTransporteArea = /logistica|bodega|transporte/i.test(specificArea);
        const jornadaHoras = parseFloat(emp.horas_jornada_diaria || (isTransporteArea ? 8 : 9));
        const horasLaboralesStr = `${String(Math.floor(jornadaHoras)).padStart(2, '0')}:00:00`;

        let totalHorasEmp = 0;
        const daysData = [];

        for (const d of dateList) {
            // Buscar marcaciones estrictamente vinculadas a este empleado:
            // 1. Por empleado_id (prioridad máxima y relación directa en BD)
            let punchList = punchMap.get(`${emp.id}_${d.dateStr}`);
            
            // 2. Si no hay por empleado_id, solo buscar por codigo_biometrico si el empleado lo tiene configurado
            // (NUNCA por emp.codigo de planilla o ID numérico suelto para evitar cruzamiento de empleados)
            if ((!punchList || punchList.length === 0) && bioUid) {
                punchList = (bioUidClean ? punchMap.get(`uid_${bioUidClean}_${d.dateStr}`) : null) ||
                            punchMap.get(`uid_${bioUid}_${d.dateStr}`);
            }
            punchList = punchList ? [...punchList] : [];
            punchList.sort();

            const timeCalc = calculateDayTimes(punchList, jornadaHoras);
            let adj = adjMap.get(`${emp.id}_${d.dateStr}`);
            if (!adj && bioUid) {
                adj = (bioUidClean ? adjMap.get(`uid_${bioUidClean}_${d.dateStr}`) : null) ||
                      adjMap.get(`uid_${bioUid}_${d.dateStr}`);
            }

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
                observacion = '';
                spanStr = '00:00:00';
                extraStr = '00:00:00';
            } else {
                extraVal = timeCalc.extraCalcHours > 0 ? (Math.round(timeCalc.extraCalcHours * 2) / 2) : 0;
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

        // Solo incluir al empleado si tiene actividad (marcaciones o ajustes con horas extra)
        // para coincidir exactamente con los que aparecen en la pantalla de Marcador Digital
        const hasActivity = daysData.some(d => d.mEnt1 || d.mSal1 || d.mEnt2 || d.mSal2 || (typeof d.extraVal === 'number' && d.extraVal !== 0));
        if (hasActivity) {
            if (isTransporteArea) {
                totalOtrosTransporte += totalHorasEmp;
            } else {
                totalProduccion += totalHorasEmp;
            }

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
    totalProduccion = parseFloat(totalProduccion.toFixed(2));
    totalOtrosTransporte = parseFloat(totalOtrosTransporte.toFixed(2));

    // 7. Construir Workbook con ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS';
    const ws = workbook.addWorksheet('Horas Extras');

    // Configuración de anchos de columna
    const colWidths = [14, 13, 11, 11, 8, 38, 18, 14, 4, 4, 22, 10, 14, 10];
    colWidths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const quincenaTitle = calculateQuincenaTitle(startDate, endDate, filters.title || filters.corteNombre);
    const emissionDate = new Date().toISOString().slice(0, 10);
    let rIdx = 1;

    for (let eIdx = 0; eIdx < processedEmployees.length; eIdx++) {
        const emp = processedEmployees[eIdx];

        // Encabezado del bloque
        ws.getCell(`A${rIdx}`).value = 'Reporte de Horas Extras.';
        ws.getCell(`A${rIdx}`).font = { name: 'Calibri', size: 11, bold: true };

        ws.getCell(`A${rIdx + 1}`).value = companyName;
        ws.getCell(`A${rIdx + 1}`).font = { name: 'Calibri', size: 11, bold: true };

        ws.getCell(`A${rIdx + 2}`).value = 'PRO: 018';
        ws.getCell(`A${rIdx + 2}`).font = { name: 'Calibri', size: 10, bold: true };

        // Tarjeta resumen lateral (solo en el primer bloque)
        if (eIdx === 0) {
            ws.getCell(`K${rIdx + 2}`).value = 'RESUMEN  DE HORAS EXTRAS';
            ws.getCell(`K${rIdx + 2}`).font = { name: 'Calibri', size: 10, bold: true };
            ws.getCell(`K${rIdx + 3}`).value = 'FECHA:';
            ws.getCell(`L${rIdx + 3}`).value = emissionDate;
        }

        ws.getCell(`A${rIdx + 3}`).value = quincenaTitle;
        ws.getCell(`A${rIdx + 3}`).font = { name: 'Calibri', size: 10, bold: true };

        ws.getCell(`A${rIdx + 4}`).value = `Nombre: ${emp.nombre} .     Área: ${emp.area} .`;
        ws.getCell(`A${rIdx + 4}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`H${rIdx + 4}`).value = 'Horas Laborales';
        ws.getCell(`H${rIdx + 4}`).font = { name: 'Calibri', size: 9, bold: true };

        ws.getCell(`H${rIdx + 5}`).value = emp.horasLaboralesStr;
        ws.getCell(`H${rIdx + 5}`).font = { name: 'Calibri', size: 9 };
        ws.getCell(`H${rIdx + 5}`).alignment = { horizontal: 'center' };

        // Fila de encabezados de la tabla
        const headerRowIdx = rIdx + 6;
        const headers = ['Dia', 'Fecha', 'Marc-Ent', 'Marc-Sal', 'Extra', 'Observaciones', 'Tiempo de Trabajo', 'Hora Extras'];
        headers.forEach((h, i) => {
            const cell = ws.getCell(headerRowIdx, i + 1);
            cell.value = h;
            cell.font = { name: 'Calibri', size: 9, bold: true };
            cell.alignment = { horizontal: i === 5 ? 'left' : 'center', vertical: 'middle' };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });

        if (eIdx === 0) {
            ws.getCell(`K${headerRowIdx}`).value = 'Produccion';
            ws.getCell(`N${headerRowIdx}`).value = totalProduccion;
            ws.getCell(`K${headerRowIdx}`).font = { name: 'Calibri', size: 9, bold: true };
            ws.getCell(`N${headerRowIdx}`).font = { name: 'Calibri', size: 9, bold: true };
        }

        let curRow = headerRowIdx + 1;

        // Renderizar días (2 filas por cada día)
        emp.days.forEach((day, dIdx) => {
            const r1 = curRow;
            const r2 = curRow + 1;

            // Fila 1 del día
            ws.getCell(`A${r1}`).value = day.dayName;
            ws.getCell(`B${r1}`).value = day.dateStr;
            ws.getCell(`C${r1}`).value = day.mEnt1;
            ws.getCell(`D${r1}`).value = day.mSal1;
            ws.getCell(`E${r1}`).value = day.extraVal;
            ws.getCell(`F${r1}`).value = day.observacion;
            ws.getCell(`G${r1}`).value = day.tiempoTrabajo;
            ws.getCell(`H${r1}`).value = day.horaExtras;

            // Fila 2 del día
            ws.getCell(`C${r2}`).value = day.mEnt2;
            ws.getCell(`D${r2}`).value = day.mSal2;

            // Resumen lateral en los primeros días
            if (eIdx === 0 && dIdx === 0) {
                ws.getCell(`K${r2}`).value = 'OTROS (TRANSPORTE)';
                ws.getCell(`N${r2}`).value = totalOtrosTransporte;
                ws.getCell(`K${r2}`).font = { name: 'Calibri', size: 9, bold: true };
                ws.getCell(`N${r2}`).font = { name: 'Calibri', size: 9, bold: true };
            } else if (eIdx === 0 && dIdx === 1) {
                ws.getCell(`K${r2}`).value = 'TOTAL  de HORAS EXTRA';
                ws.getCell(`N${r2}`).value = totalGeneralHorasExtra;
                ws.getCell(`K${r2}`).font = { name: 'Calibri', size: 9, bold: true };
                ws.getCell(`N${r2}`).font = { name: 'Calibri', size: 9, bold: true };
            }

            // Formato y bordes de las dos filas
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
                const c1 = ws.getCell(`${col}${r1}`);
                const c2 = ws.getCell(`${col}${r2}`);
                c1.font = { name: 'Calibri', size: 9, bold: col === 'E' };
                c2.font = { name: 'Calibri', size: 9 };
                c1.alignment = { horizontal: col === 'F' ? 'left' : 'center', vertical: 'middle' };
                c2.alignment = { horizontal: 'center', vertical: 'middle' };
                c1.border = thinBorder;
                c2.border = thinBorder;
            });

            curRow += 2;
        });

        // Pie del bloque del empleado
        ws.getCell(`A${curRow}`).value = 'HORAS PENDIENTES';
        ws.getCell(`A${curRow}`).font = { name: 'Calibri', size: 9, bold: true };

        ws.getCell(`C${curRow + 2}`).value = 'Total Horas';
        ws.getCell(`C${curRow + 2}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`E${curRow + 2}`).value = emp.totalHorasEmp;
        ws.getCell(`E${curRow + 2}`).font = { name: 'Calibri', size: 10, bold: true };
        ws.getCell(`E${curRow + 2}`).alignment = { horizontal: 'center' };
        ws.getCell(`E${curRow + 2}`).border = thinBorder;

        ws.getCell(`A${curRow + 4}`).value = 'F: Empleado';
        ws.getCell(`A${curRow + 4}`).font = { name: 'Calibri', size: 9, bold: true };
        ws.getCell(`E${curRow + 4}`).value = 'F: AUTORIZADO';
        ws.getCell(`E${curRow + 4}`).font = { name: 'Calibri', size: 9, bold: true };

        rIdx = curRow + 7;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    generateAndelsaOvertimeExcel
};
