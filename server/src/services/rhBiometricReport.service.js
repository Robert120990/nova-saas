const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');
const { enrichReportWithAbsences } = require('./rhBiometricReportAbsences.helper');
const {
    extractDateOnly,
    extractTime,
    normalizeDateRange,
    appendPunchTimeBounds
} = require('./rhBiometricDate.helper');
const { evaluateDayAttendance, formatDecimalHoursText } = require('./rhBiometricCalc.helper');

async function getAttendanceReportData(companyId, filters = {}) {
    const rawStart = filters.startDate || filters.start_date;
    const rawEnd = filters.endDate || filters.end_date;
    const { branchId, departamentoId, search } = filters;
    const settings = await getSettings(companyId);
    const conditions = ['l.company_id = ?', '(e.id IS NULL OR COALESCE(e.omitir_marcador_digital, 0) = 0)'];
    const params = [companyId];

    const { startDate, endDate } = appendPunchTimeBounds(conditions, params, 'l', rawStart, rawEnd);
    if (branchId && branchId !== 'todos') { conditions.push('e.branch_id = ?'); params.push(branchId); }
    if (departamentoId && departamentoId !== 'todos') { conditions.push('e.departamento_personal_id = ?'); params.push(departamentoId); }
    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR l.device_uid LIKE ?)');
        params.push(s, s, s, s);
    }

    const [punches] = await pool.query(
        `SELECT l.id, l.device_uid, l.empleado_id,
                DATE_FORMAT(l.punch_time, '%Y-%m-%d %H:%i:%s') as punch_time_str,
                l.punch_type, l.source,
                e.codigo as empleado_codigo, e.nombres as empleado_nombres, e.apellidos as empleado_apellidos,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras,
                e.turno_id, t.nombre as turno_nombre,
                t.hora_entrada as turno_hora_entrada, t.hora_salida as turno_hora_salida,
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

    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const holidayMap = new Set();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.add(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`);
    });

    const adjMap = new Map();
    if (startDate && endDate) {
        const [adjustments] = await pool.query(
            `SELECT empleado_id, device_uid, DATE_FORMAT(fecha, '%Y-%m-%d') as fecha_str,
                    horas_extra_aprobadas, es_editado, observacion, congelado
             FROM rh_biometric_daily_overtime
             WHERE company_id = ? AND fecha >= ? AND fecha <= ?`,
            [companyId, startDate, endDate]
        );
        adjustments.forEach(a => {
            const fKey = a.fecha_str;
            if (a.device_uid) adjMap.set(`${a.device_uid}_${fKey}`, a);
            if (a.empleado_id) adjMap.set(`emp_${a.empleado_id}_${fKey}`, a);
        });
    }

    const grouped = new Map();
    for (const p of punches) {
        const ptStr = p.punch_time_str;
        const dateKey = extractDateOnly(ptStr);
        if (!dateKey) continue;
        const key = `${p.empleado_id || `uid_${p.device_uid}`}_${dateKey}`;
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
                punches: []
            });
        }
        grouped.get(key).punches.push(ptStr);
    }

    const reportRows = [];
    let totalMinutosTrabajados = 0;
    let totalLlegadasTarde = 0;
    let totalHorasExtra = 0;
    let totalHorasExtraDiurnas = 0;
    let totalHorasExtraNocturnas = 0;
    let totalIncompletas = 0;

    for (const item of grouped.values()) {
        const [, m, d] = item.fecha.split('-');
        const esFestivo = holidayMap.has(`${m}-${d}`);
        const calc = evaluateDayAttendance(item.punches, {
            fecha: item.fecha,
            horaEntradaEsperada: item.hora_entrada_esperada,
            toleranciaMinutos: item.tolerancia_minutos,
            jornadaHoras: item.jornada_horas,
            exentoHorasExtras: item.exento_horas_extras,
            esFestivo
        });

        totalMinutosTrabajados += calc.minutosTrabajados;
        if (calc.esLlegadaTarde) totalLlegadasTarde++;
        if (calc.esMarcacionIncompleta) totalIncompletas++;

        let horasExtra = calc.horasExtraCalculadas;
        let heDiurnas = calc.horasExtraDiurnas;
        let heNocturnas = calc.horasExtraNocturnas;

        const adj = adjMap.get(`${item.device_uid}_${item.fecha}`)
            || (item.empleado_id ? adjMap.get(`emp_${item.empleado_id}_${item.fecha}`) : null)
            || adjMap.get(`${item.codigo}_${item.fecha}`);
        if (adj && adj.horas_extra_aprobadas !== null) {
            horasExtra = parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2));
            if (horasExtra <= 0) {
                heDiurnas = 0;
                heNocturnas = 0;
            } else if (calc.horasExtraCalculadas > 0) {
                const ratio = horasExtra / calc.horasExtraCalculadas;
                heNocturnas = parseFloat((calc.horasExtraNocturnas * ratio).toFixed(2));
                heDiurnas = parseFloat(Math.max(0, horasExtra - heNocturnas).toFixed(2));
            } else {
                heDiurnas = horasExtra;
                heNocturnas = 0;
            }
        }
        totalHorasExtra += horasExtra;
        totalHorasExtraDiurnas += heDiurnas;
        totalHorasExtraNocturnas += heNocturnas;

        reportRows.push({
            empleado_id: item.empleado_id,
            device_uid: item.device_uid,
            codigo: item.codigo,
            nombre: item.nombre,
            turno: item.turno_nombre,
            departamento: item.departamento,
            cargo: item.cargo,
            fecha: item.fecha,
            entrada: extractTime(calc.horaEntrada),
            salida_almuerzo: extractTime(calc.horaSalidaAlmuerzo),
            entrada_almuerzo: extractTime(calc.horaEntradaAlmuerzo),
            salida: extractTime(calc.horaSalida),
            horas_trabajadas: calc.horasTrabajadas,
            minutos_tardanza: calc.minutosTardanza,
            es_llegada_tarde: calc.esLlegadaTarde,
            horas_extra: horasExtra,
            horas_extra_diurnas: heDiurnas,
            horas_extra_nocturnas: heNocturnas,
            es_domingo: calc.esDomingo,
            es_festivo: calc.esFestivo,
            es_marcacion_incompleta: calc.esMarcacionIncompleta,
            alerta_marcacion: calc.alertaMarcacion,
            es_editado: adj ? !!adj.es_editado : false,
            observacion: adj?.observacion || '',
            congelado: adj ? !!adj.congelado : false,
            exento_horas_extras: item.exento_horas_extras
        });
    }

    const summary = {
        total_registros: reportRows.length,
        total_horas_trabajadas: parseFloat((totalMinutosTrabajados / 60).toFixed(2)),
        total_llegadas_tarde: totalLlegadasTarde,
        total_horas_extra: parseFloat(totalHorasExtra.toFixed(2)),
        total_horas_extra_diurnas: parseFloat(totalHorasExtraDiurnas.toFixed(2)),
        total_horas_extra_nocturnas: parseFloat(totalHorasExtraNocturnas.toFixed(2)),
        total_incompletas: totalIncompletas
    };
    await enrichReportWithAbsences(companyId, { ...filters, startDate, endDate }, reportRows, summary, holidayMap, settings);

    return { rows: reportRows, summary };
}

async function generateAttendancePdf(companyId, filters = {}) {
    const data = await getAttendanceReportData(companyId, filters);
    const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const company = compRows[0] || {};
    const { startDate, endDate } = normalizeDateRange(filters.startDate || filters.start_date, filters.endDate || filters.end_date);
    const periodText = startDate && endDate ? `DEL ${startDate} AL ${endDate}` : 'HISTÓRICO';
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    let y = reportPdfHelper.renderHeader(doc, company, 'REPORTE GENERAL DE ASISTENCIA Y CONTROL HORARIO', periodText, 'landscape', 'RECURSOS HUMANOS - CONTROL BIOMÉTRICO');

    const cols = [
        { label: 'FECHA', x: 30, w: 46, align: 'left' },
        { label: 'CÓDIGO', x: 78, w: 36, align: 'left' },
        { label: 'EMPLEADO', x: 116, w: 118, align: 'left' },
        { label: 'TURNO', x: 236, w: 78, align: 'left' },
        { label: 'DEPARTAMENTO', x: 316, w: 72, align: 'left' },
        { label: 'ENTRADA', x: 390, w: 40, align: 'center' },
        { label: 'S. ALM', x: 432, w: 40, align: 'center' },
        { label: 'E. ALM', x: 474, w: 40, align: 'center' },
        { label: 'SALIDA', x: 516, w: 40, align: 'center' },
        { label: 'HRS TRAB', x: 558, w: 54, align: 'right' },
        { label: 'TARDE', x: 614, w: 38, align: 'right' },
        { label: 'H. EXTRA', x: 654, w: 78, align: 'right' }
    ];

    const renderHeaderRow = () => {
        doc.rect(30, y, 702, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        cols.forEach(c => doc.text(c.label, c.x, y + 3.5, { width: c.w, align: c.align, lineBreak: false }));
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 14).lineTo(732, y + 14).stroke();
        y += 16;
    };

    renderHeaderRow();

    for (const r of data.rows) {
        if (y > 510) { doc.addPage(); y = 35; renderHeaderRow(); }
        doc.fontSize(6).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(r.fecha), cols[0].x, y, { width: cols[0].w, align: 'left', lineBreak: false });
        doc.text(r.codigo || '---', cols[1].x, y, { width: cols[1].w, align: 'left', lineBreak: false });
        doc.font('Helvetica-Bold').text(r.nombre, cols[2].x, y, { width: cols[2].w, align: 'left', lineBreak: false });
        doc.font('Helvetica').text(r.turno || 'General', cols[3].x, y, { width: cols[3].w, align: 'left', lineBreak: false });
        doc.text(r.departamento, cols[4].x, y, { width: cols[4].w, align: 'left', lineBreak: false });

        if (r.es_ausencia) {
            const absColor = r.ausencia_estado === 'pendiente' ? '#b45309' : (r.ausencia_goce ? '#0369a1' : '#b91c1c');
            doc.font('Helvetica-Bold').fillColor(absColor).text(r.observacion || r.entrada, cols[5].x, y, { width: 166, align: 'left', lineBreak: false });
            doc.font('Helvetica').fillColor('#334155');
        } else {
            doc.text(r.entrada, cols[5].x, y, { width: cols[5].w, align: 'center', lineBreak: false });
            doc.text(r.salida_almuerzo, cols[6].x, y, { width: cols[6].w, align: 'center', lineBreak: false });
            doc.text(r.entrada_almuerzo, cols[7].x, y, { width: cols[7].w, align: 'center', lineBreak: false });
            doc.text(r.salida, cols[8].x, y, { width: cols[8].w, align: 'center', lineBreak: false });
        }

        doc.text(r.horas_trabajadas > 0 ? formatDecimalHoursText(r.horas_trabajadas, true) : '—', cols[9].x, y, { width: cols[9].w, align: 'right', lineBreak: false });

        if (r.es_llegada_tarde) {
            doc.font('Helvetica-Bold').fillColor('#b91c1c').text(`${r.minutos_tardanza} m`, cols[10].x, y, { width: cols[10].w, align: 'right', lineBreak: false });
            doc.font('Helvetica').fillColor('#334155');
        } else {
            doc.text('—', cols[10].x, y, { width: cols[10].w, align: 'right', lineBreak: false });
        }

        if (r.horas_extra > 0) {
            const heLabel = `${formatDecimalHoursText(r.horas_extra, true)} (${r.horas_extra.toFixed(2)}h)`;
            doc.font('Helvetica-Bold').fillColor('#15803d').text(heLabel, cols[11].x, y, { width: cols[11].w, align: 'right', lineBreak: false });
            doc.font('Helvetica').fillColor('#334155');
        } else if (r.es_marcacion_incompleta) {
            doc.font('Helvetica-Bold').fillColor('#b45309').text('Incompleta', cols[11].x, y, { width: cols[11].w, align: 'right', lineBreak: false });
            doc.font('Helvetica').fillColor('#334155');
        } else {
            doc.text('—', cols[11].x, y, { width: cols[11].w, align: 'right', lineBreak: false });
        }
        y += 12;
    }

    if (y > 480) { doc.addPage(); y = 35; }
    y += 8;
    doc.rect(30, y, 702, 18).fill('#f8fafc');
    doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(30, y, 702, 18).stroke();
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL HORAS: ${formatDecimalHoursText(data.summary.total_horas_trabajadas, true)} (${data.summary.total_horas_trabajadas}h)`, 38, y + 5, { lineBreak: false });
    doc.text(`TARDANZAS: ${data.summary.total_llegadas_tarde}`, 205, y + 5, { lineBreak: false });
    doc.text(`H. EXTRAS: ${formatDecimalHoursText(data.summary.total_horas_extra, true)} (D:${data.summary.total_horas_extra_diurnas}h N:${data.summary.total_horas_extra_nocturnas}h)`, 290, y + 5, { lineBreak: false });
    doc.text(`AUSENCIAS: ${(data.summary.total_ausencias_justificadas || 0) + (data.summary.total_ausencias_injustificadas || 0)}`, 530, y + 5, { lineBreak: false });
    doc.text(`INCOMPLETAS: ${data.summary.total_incompletas || 0}`, 635, y + 5, { lineBreak: false });

    y += 26;
    reportPdfHelper.renderClosingFooter(doc, 30, y, data.rows.length, 'Registros de Asistencia');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
}

async function generateAttendanceExcel(companyId, filters = {}) {
    const data = await getAttendanceReportData(companyId, filters);
    const rows = data.rows.map(r => ({
        fecha: reportPdfHelper.formatDate(r.fecha),
        codigo: r.codigo || '',
        nombre: r.nombre || '',
        turno: r.turno || 'General',
        departamento: r.departamento || '',
        cargo: r.cargo || '',
        entrada: r.entrada || '',
        salida_almuerzo: r.salida_almuerzo || '',
        entrada_almuerzo: r.entrada_almuerzo || '',
        salida: r.salida || '',
        horas_trabajadas_fmt: formatDecimalHoursText(r.horas_trabajadas, true),
        horas_trabajadas: r.horas_trabajadas || 0,
        minutos_tardanza: r.minutos_tardanza || 0,
        horas_extra_fmt: r.horas_extra > 0 ? formatDecimalHoursText(r.horas_extra, true) : '0m',
        horas_extra: r.horas_extra || 0,
        horas_extra_diurnas: r.horas_extra_diurnas || 0,
        horas_extra_nocturnas: r.horas_extra_nocturnas || 0,
        alerta: r.alerta_marcacion || '',
        exento_horas_extras: r.exento_horas_extras ? 'SÍ' : 'NO',
        es_festivo: r.es_festivo ? 'SÍ' : 'NO',
        observacion: r.observacion || ''
    }));

    return await excelService.createExcelBuffer({
        title: 'Reporte de Asistencia Biométrico',
        sheets: [{
            name: 'Asistencia',
            columns: [
                { header: 'Fecha', key: 'fecha', width: 13 },
                { header: 'Código', key: 'codigo', width: 10 },
                { header: 'Empleado', key: 'nombre', width: 30 },
                { header: 'Turno / Horario', key: 'turno', width: 20 },
                { header: 'Departamento', key: 'departamento', width: 20 },
                { header: 'Cargo', key: 'cargo', width: 20 },
                { header: 'Entrada', key: 'entrada', width: 11 },
                { header: 'S. Almuerzo', key: 'salida_almuerzo', width: 12 },
                { header: 'E. Almuerzo', key: 'entrada_almuerzo', width: 12 },
                { header: 'Salida', key: 'salida', width: 11 },
                { header: 'Hrs Trab (Reloj)', key: 'horas_trabajadas_fmt', width: 14 },
                { header: 'Hrs Trab (Dec)', key: 'horas_trabajadas', width: 13 },
                { header: 'Min Tarde', key: 'minutos_tardanza', width: 11 },
                { header: 'H. Extra (Reloj)', key: 'horas_extra_fmt', width: 14 },
                { header: 'H. Extra (Dec)', key: 'horas_extra', width: 13 },
                { header: 'H.E. Diurnas', key: 'horas_extra_diurnas', width: 12 },
                { header: 'H.E. Nocturnas', key: 'horas_extra_nocturnas', width: 13 },
                { header: 'Alertas Marcación', key: 'alerta', width: 28 },
                { header: 'Exento H.E.', key: 'exento_horas_extras', width: 11 },
                { header: 'Festivo', key: 'es_festivo', width: 9 },
                { header: 'Justificación / Observaciones', key: 'observacion', width: 36 }
            ],
            data: rows
        }]
    });
}

module.exports = { getAttendanceReportData, generateAttendancePdf, generateAttendanceExcel };
