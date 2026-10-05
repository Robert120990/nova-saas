const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');
const { getSettings, getHolidays } = require('./rhBiometricConfig.service');

function timeStringToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function extractTime(dt) {
    if (!dt) return '---';
    try {
        const d = new Date(dt);
        return isNaN(d.getTime()) ? '---' : d.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch { return '---'; }
}

function extractDateOnly(dt) {
    if (!dt) return '';
    try {
        const d = new Date(dt);
        if (isNaN(d.getTime())) return '';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch { return ''; }
}

async function getAttendanceReportData(companyId, filters = {}) {
    const startDate = filters.startDate || filters.start_date;
    const endDate = filters.endDate || filters.end_date;
    const { branchId, departamentoId, search } = filters;
    const settings = await getSettings(companyId);
    const conditions = ['l.company_id = ?'];
    const params = [companyId];

    if (startDate) { conditions.push('DATE(l.punch_time) >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('DATE(l.punch_time) <= ?'); params.push(endDate); }
    if (branchId && branchId !== 'todos') { conditions.push('e.branch_id = ?'); params.push(branchId); }
    if (departamentoId && departamentoId !== 'todos') { conditions.push('e.departamento_personal_id = ?'); params.push(departamentoId); }
    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push('(e.nombres LIKE ? OR e.apellidos LIKE ? OR e.codigo LIKE ? OR l.device_uid LIKE ?)');
        params.push(s, s, s, s);
    }

    const [punches] = await pool.query(
        `SELECT l.id, l.device_uid, l.empleado_id, l.punch_time, l.punch_type, l.source,
                e.codigo as empleado_codigo, e.nombres as empleado_nombres, e.apellidos as empleado_apellidos,
                CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, '')) as empleado_nombre,
                c.descripcion as cargo_nombre, dep.descripcion as departamento_nombre,
                COALESCE(e.exento_horas_extras, 0) as exento_horas_extras,
                e.turno_id,
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

    const holidays = await getHolidays(companyId, settings.pais_festivos || 'SV');
    const holidayMap = new Set();
    holidays.forEach(h => {
        if (h.is_active) holidayMap.add(`${String(h.mes).padStart(2, '0')}-${String(h.dia).padStart(2, '0')}`);
    });

    let adjMap = new Map();
    if (startDate && endDate) {
        const [adjustments] = await pool.query(
            `SELECT device_uid, fecha, horas_extra_aprobadas, es_editado, observacion, congelado
             FROM rh_biometric_daily_overtime
             WHERE company_id = ? AND fecha >= ? AND fecha <= ?`,
            [companyId, startDate, endDate]
        );
        adjustments.forEach(a => {
            const fKey = extractDateOnly(a.fecha);
            adjMap.set(`${a.device_uid}_${fKey}`, a);
        });
    }

    const grouped = new Map();
    for (const p of punches) {
        const dateKey = extractDateOnly(p.punch_time);
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
        grouped.get(key).punches.push(p);
    }

    const reportRows = [];
    let totalMinutosTrabajados = 0;
    let totalLlegadasTarde = 0;
    let totalHorasExtra = 0;

    for (const item of grouped.values()) {
        const sorted = item.punches.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));
        let horaEntrada = sorted[0].punch_time;
        let horaSalidaAlmuerzo = null, horaEntradaAlmuerzo = null, horaSalida = null;

        if (sorted.length === 2) {
            horaSalida = sorted[1].punch_time;
        } else if (sorted.length === 3) {
            horaSalidaAlmuerzo = sorted[1].punch_time;
            horaSalida = sorted[2].punch_time;
        } else if (sorted.length >= 4) {
            horaSalidaAlmuerzo = sorted[1].punch_time;
            horaEntradaAlmuerzo = sorted[2].punch_time;
            horaSalida = sorted[sorted.length - 1].punch_time;
        }

        const entradaEsperadaMins = timeStringToMinutes(item.hora_entrada_esperada);
        const limiteEntrada = entradaEsperadaMins + item.tolerancia_minutos;

        let minutosTardanza = 0, esLlegadaTarde = false;
        if (horaEntrada) {
            const entradaRealMins = timeStringToMinutes(extractTime(horaEntrada));
            if (entradaRealMins > limiteEntrada) {
                minutosTardanza = entradaRealMins - entradaEsperadaMins;
                esLlegadaTarde = true;
                totalLlegadasTarde++;
            }
        }

        let minutosTrabajados = 0;
        if (horaEntrada && horaSalida) {
            let diffMins = Math.max(0, Math.floor((new Date(horaSalida) - new Date(horaEntrada)) / 60000));
            if (horaSalidaAlmuerzo && horaEntradaAlmuerzo) {
                const lunchMins = Math.max(0, Math.floor((new Date(horaEntradaAlmuerzo) - new Date(horaSalidaAlmuerzo)) / 60000));
                diffMins = Math.max(0, diffMins - lunchMins);
            }
            minutosTrabajados = diffMins;
            totalMinutosTrabajados += minutosTrabajados;
        }

        const horasTrabajadas = parseFloat((minutosTrabajados / 60).toFixed(2));
        let horasExtra = 0;
        if (!item.exento_horas_extras && horasTrabajadas > item.jornada_horas) {
            horasExtra = parseFloat((horasTrabajadas - item.jornada_horas).toFixed(2));
        }

        const adj = adjMap.get(`${item.device_uid}_${item.fecha}`) || adjMap.get(`${item.codigo}_${item.fecha}`);
        if (adj && adj.horas_extra_aprobadas !== null) {
            horasExtra = parseFloat(Number(adj.horas_extra_aprobadas).toFixed(2));
        }
        totalHorasExtra += horasExtra;

        const [, m, d] = item.fecha.split('-');
        reportRows.push({
            empleado_id: item.empleado_id,
            device_uid: item.device_uid,
            codigo: item.codigo,
            nombre: item.nombre,
            turno: item.turno_nombre,
            departamento: item.departamento,
            cargo: item.cargo,
            fecha: item.fecha,
            entrada: extractTime(horaEntrada),
            salida_almuerzo: extractTime(horaSalidaAlmuerzo),
            entrada_almuerzo: extractTime(horaEntradaAlmuerzo),
            salida: extractTime(horaSalida),
            horas_trabajadas: horasTrabajadas,
            minutos_tardanza: minutosTardanza,
            es_llegada_tarde: esLlegadaTarde,
            horas_extra: horasExtra,
            es_editado: adj ? !!adj.es_editado : false,
            observacion: adj?.observacion || '',
            congelado: adj ? !!adj.congelado : false,
            exento_horas_extras: item.exento_horas_extras,
            es_festivo: holidayMap.has(`${m}-${d}`)
        });

    }

    return {
        rows: reportRows,
        summary: {
            total_registros: reportRows.length,
            total_horas_trabajadas: parseFloat((totalMinutosTrabajados / 60).toFixed(2)),
            total_llegadas_tarde: totalLlegadasTarde,
            total_horas_extra: parseFloat(totalHorasExtra.toFixed(2))
        }
    };
}

async function generateAttendancePdf(companyId, filters = {}) {
    const data = await getAttendanceReportData(companyId, filters);
    const [compRows] = await pool.query('SELECT * FROM companies WHERE id = ?', [companyId]);
    const company = compRows[0] || {};
    const startDate = filters.startDate || filters.start_date;
    const endDate = filters.endDate || filters.end_date;
    const periodText = startDate && endDate ? `DEL ${startDate} AL ${endDate}` : 'HISTÓRICO';
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    let y = reportPdfHelper.renderHeader(doc, company, 'REPORTE GENERAL DE ASISTENCIA Y CONTROL HORARIO', periodText, 'landscape', 'RECURSOS HUMANOS - CONTROL BIOMÉTRICO');

    const cols = [
        { label: 'FECHA', x: 30, w: 46, align: 'left' },
        { label: 'CÓDIGO', x: 78, w: 38, align: 'left' },
        { label: 'EMPLEADO', x: 118, w: 120, align: 'left' },
        { label: 'TURNO', x: 240, w: 85, align: 'left' },
        { label: 'DEPARTAMENTO', x: 328, w: 75, align: 'left' },
        { label: 'ENTRADA', x: 406, w: 42, align: 'center' },
        { label: 'S. ALM', x: 450, w: 42, align: 'center' },
        { label: 'E. ALM', x: 494, w: 42, align: 'center' },
        { label: 'SALIDA', x: 538, w: 42, align: 'center' },
        { label: 'HRS TRAB', x: 582, w: 48, align: 'right' },
        { label: 'TARDE', x: 632, w: 42, align: 'right' },
        { label: 'H. EXTRA', x: 676, w: 56, align: 'right' }
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
        doc.text(r.entrada, cols[5].x, y, { width: cols[5].w, align: 'center', lineBreak: false });
        doc.text(r.salida_almuerzo, cols[6].x, y, { width: cols[6].w, align: 'center', lineBreak: false });
        doc.text(r.entrada_almuerzo, cols[7].x, y, { width: cols[7].w, align: 'center', lineBreak: false });
        doc.text(r.salida, cols[8].x, y, { width: cols[8].w, align: 'center', lineBreak: false });
        doc.text(r.horas_trabajadas > 0 ? r.horas_trabajadas.toFixed(2) : '—', cols[9].x, y, { width: cols[9].w, align: 'right', lineBreak: false });

        if (r.es_llegada_tarde) {
            doc.font('Helvetica-Bold').fillColor('#b91c1c').text(`${r.minutos_tardanza} m`, cols[10].x, y, { width: cols[10].w, align: 'right', lineBreak: false });
            doc.font('Helvetica').fillColor('#334155');
        } else {
            doc.text('—', cols[10].x, y, { width: cols[10].w, align: 'right', lineBreak: false });
        }

        if (r.horas_extra > 0) {
            doc.font('Helvetica-Bold').fillColor('#15803d').text(`${r.horas_extra.toFixed(2)} h`, cols[11].x, y, { width: cols[11].w, align: 'right', lineBreak: false });
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
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL HORAS: ${data.summary.total_horas_trabajadas} hrs`, 40, y + 5, { lineBreak: false });
    doc.text(`LLEGADAS TARDE: ${data.summary.total_llegadas_tarde}`, 220, y + 5, { lineBreak: false });
    doc.text(`TOTAL HORAS EXTRAS: ${data.summary.total_horas_extra} hrs`, 400, y + 5, { lineBreak: false });

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
        horas_trabajadas: r.horas_trabajadas || 0,
        minutos_tardanza: r.minutos_tardanza || 0,
        horas_extra: r.horas_extra || 0,
        exento_horas_extras: r.exento_horas_extras ? 'SÍ' : 'NO',
        es_festivo: r.es_festivo ? 'SÍ' : 'NO'
    }));

    return await excelService.createExcelBuffer({
        title: 'Reporte de Asistencia Biometrico',
        sheets: [{
            name: 'Asistencia',
            columns: [
                { header: 'Fecha', key: 'fecha', width: 14 },
                { header: 'Código', key: 'codigo', width: 12 },
                { header: 'Empleado', key: 'nombre', width: 32 },
                { header: 'Turno / Horario', key: 'turno', width: 22 },
                { header: 'Departamento', key: 'departamento', width: 22 },
                { header: 'Cargo', key: 'cargo', width: 22 },
                { header: 'Entrada', key: 'entrada', width: 12 },
                { header: 'Salida Almuerzo', key: 'salida_almuerzo', width: 14 },
                { header: 'Entrada Almuerzo', key: 'entrada_almuerzo', width: 14 },
                { header: 'Salida', key: 'salida', width: 12 },
                { header: 'Horas Trabajadas', key: 'horas_trabajadas', width: 16 },
                { header: 'Minutos Tarde', key: 'minutos_tardanza', width: 14 },
                { header: 'Horas Extra', key: 'horas_extra', width: 14 },
                { header: 'Exento H.E.', key: 'exento_horas_extras', width: 12 },
                { header: 'Festivo', key: 'es_festivo', width: 10 }
            ],
            data: rows
        }]
    });
}

module.exports = {
    getAttendanceReportData,
    generateAttendancePdf,
    generateAttendanceExcel
};
