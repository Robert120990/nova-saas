const ExcelJS = require('exceljs');
const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const { formatDecimalHoursText } = require('./rhBiometricCalc.helper');
const { extractDateOnly } = require('./rhBiometricDate.helper');
const { getDailyOvertimeRows } = require('./rhBiometricCortes.service');

/**
 * Formatea horas decimales acompañadas del formato reloj compacto (ej: "18h 30m (18.50h)")
 */
function fmtHoursPair(val) {
    const num = Number(val || 0);
    if (num <= 0) return '0.00 h';
    return `${formatDecimalHoursText(num, true)} (${num.toFixed(2)}h)`;
}

/**
 * Prepara el contexto de exportación de un período congelado agrupado por colaborador
 */
async function getCorteExportContext(companyId, corteId, query = {}) {
    const [corteRows] = await pool.query(
        `SELECT id, company_id, nombre, fecha_inicio, fecha_fin, estado, observaciones
         FROM rh_biometric_cortes
         WHERE id = ? AND company_id = ?
         LIMIT 1`,
        [corteId, companyId]
    );
    if (!corteRows || corteRows.length === 0) {
        throw new Error('Corte biométrico congelado no encontrado.');
    }

    const rawCorte = corteRows[0];
    const corte = {
        ...rawCorte,
        fecha_inicio: extractDateOnly(rawCorte.fecha_inicio),
        fecha_fin: extractDateOnly(rawCorte.fecha_fin)
    };

    const scope = String(query.scope || 'global').toLowerCase() === 'person' ? 'person' : 'global';
    const rawEmpKey = String(query.employeeKey || query.employee_key || '').trim();
    const activeEmployeeKey = scope === 'person' && rawEmpKey && rawEmpKey !== 'all' && rawEmpKey !== 'todos'
        ? rawEmpKey
        : (scope === 'global' && rawEmpKey && rawEmpKey !== 'all' && rawEmpKey !== 'todos' ? rawEmpKey : '');

    const onlyOvertime = query.onlyOvertime === true || query.onlyOvertime === 1 || query.onlyOvertime === '1' || query.onlyOvertime === 'true';

    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const data = await getDailyOvertimeRows(companyId, {
        corteId,
        employeeKey: activeEmployeeKey || undefined,
        onlyOvertime: onlyOvertime ? 1 : 0
    });

    const groupedMap = new Map();
    for (const r of (Array.isArray(data.rows) ? data.rows : [])) {
        const key = r.employee_key || (r.empleado_id ? `emp_${r.empleado_id}` : `uid_${r.device_uid}`);
        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                employee_key: key,
                empleado_id: r.empleado_id,
                device_uid: r.device_uid,
                codigo: r.codigo || '---',
                nombre: r.nombre || 'Sin Nombre',
                cargo: r.cargo || 'Sin Cargo',
                departamento: r.departamento || 'Sin Depto',
                dias: 0,
                horas_trabajadas: 0,
                llegadas_tarde: 0,
                minutos_tardanza: 0,
                horas_extra_calculadas: 0,
                horas_extra_aprobadas: 0,
                horas_extra_diurnas: 0,
                horas_extra_nocturnas: 0,
                rows: []
            });
        }
        const emp = groupedMap.get(key);
        emp.dias += 1;
        emp.horas_trabajadas += Number(r.horas_trabajadas || 0);
        if (r.es_llegada_tarde) {
            emp.llegadas_tarde += 1;
            emp.minutos_tardanza += Number(r.minutos_tardanza || 0);
        }
        emp.horas_extra_calculadas += Number(r.horas_extra_calculadas || 0);
        emp.horas_extra_aprobadas += Number(r.horas_extra_aprobadas || 0);
        emp.horas_extra_diurnas += Number(r.horas_extra_diurnas || 0);
        emp.horas_extra_nocturnas += Number(r.horas_extra_nocturnas || 0);
        emp.rows.push(r);
    }

    const employeeSummaries = Array.from(groupedMap.values())
        .map(emp => ({
            ...emp,
            horas_trabajadas: parseFloat(emp.horas_trabajadas.toFixed(2)),
            horas_extra_calculadas: parseFloat(emp.horas_extra_calculadas.toFixed(2)),
            horas_extra_aprobadas: parseFloat(emp.horas_extra_aprobadas.toFixed(2)),
            horas_extra_diurnas: parseFloat(emp.horas_extra_diurnas.toFixed(2)),
            horas_extra_nocturnas: parseFloat(emp.horas_extra_nocturnas.toFixed(2)),
            rows: [...emp.rows].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
        }))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

    return {
        corte,
        company,
        scope,
        onlyOvertime,
        activeEmployeeKey,
        summary: data.summary || {},
        employeeSummaries
    };
}

function renderGlobalCortePdf(doc, ctx) {
    const { company, corte, onlyOvertime, employeeSummaries } = ctx;
    const periodText = `DEL ${reportPdfHelper.formatDate(corte.fecha_inicio)} AL ${reportPdfHelper.formatDate(corte.fecha_fin)}`;
    const subtitle = `${corte.nombre.toUpperCase()} — ${onlyOvertime ? 'SOLO REGISTROS CON HORAS EXTRA' : 'TODOS LOS REGISTROS'}`;

    let y = reportPdfHelper.renderHeader(
        doc,
        company,
        'RESUMEN GLOBAL DE CONTROL DE HORAS Y ACEPTACIÓN',
        periodText,
        'landscape',
        subtitle
    );

    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#475569').text(
        'Con mi firma en la fila correspondiente hago constar la revisión y aceptación de las horas laboradas y horas extra aprobadas del período.',
        30,
        y,
        { width: 732 }
    );
    y += 14;

    const cols = [
        { label: '#', x: 30, w: 22, align: 'center' },
        { label: 'CÓDIGO', x: 52, w: 46, align: 'left' },
        { label: 'COLABORADOR', x: 98, w: 150, align: 'left' },
        { label: 'CARGO / DEPTO', x: 248, w: 104, align: 'left' },
        { label: 'DÍAS', x: 352, w: 28, align: 'center' },
        { label: 'HRS LAB.', x: 380, w: 56, align: 'right' },
        { label: 'TARD.', x: 436, w: 42, align: 'right' },
        { label: 'H.E. RELOJ', x: 478, w: 56, align: 'right' },
        { label: 'H.E. APROB.', x: 534, w: 76, align: 'right' },
        { label: 'FIRMA DE ACEPTACIÓN', x: 616, w: 146, align: 'center' }
    ];

    const renderTableHeader = () => {
        doc.rect(30, y, 732, 16).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        cols.forEach(c => doc.text(c.label, c.x + 2, y + 4.5, { width: c.w - 4, align: c.align, lineBreak: false }));
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 16).lineTo(762, y + 16).stroke();
        y += 18;
    };

    renderTableHeader();

    let totDias = 0;
    let totHrsLab = 0;
    let totMinTard = 0;
    let totHeReloj = 0;
    let totHeAprob = 0;

    employeeSummaries.forEach((emp, idx) => {
        if (y > 490) {
            doc.addPage();
            y = 35;
            renderTableHeader();
        }

        totDias += emp.dias;
        totHrsLab += emp.horas_trabajadas;
        totMinTard += emp.minutos_tardanza;
        totHeReloj += emp.horas_extra_calculadas;
        totHeAprob += emp.horas_extra_aprobadas;

        if (idx % 2 === 1) {
            doc.rect(30, y, 732, 28).fill('#f8fafc');
        }

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(String(idx + 1), cols[0].x + 2, y + 9, { width: cols[0].w - 4, align: 'center', lineBreak: false });
        doc.font('Courier').text(String(emp.codigo || '---').slice(0, 10), cols[1].x + 2, y + 9, { width: cols[1].w - 4, align: 'left', lineBreak: false });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(emp.nombre, cols[2].x + 2, y + 5, { width: cols[2].w - 4, align: 'left', height: 18 });
        doc.font('Helvetica').fontSize(6).fillColor('#475569').text(`${emp.cargo} · ${emp.departamento}`, cols[3].x + 2, y + 6, { width: cols[3].w - 4, align: 'left', height: 18 });

        doc.fontSize(7).fillColor('#0f172a');
        doc.text(String(emp.dias), cols[4].x + 2, y + 9, { width: cols[4].w - 4, align: 'center', lineBreak: false });
        doc.font('Helvetica-Bold').text(`${emp.horas_trabajadas.toFixed(2)}h`, cols[5].x + 2, y + 5, { width: cols[5].w - 4, align: 'right', lineBreak: false });
        doc.font('Helvetica').fontSize(5.8).fillColor('#64748b').text(formatDecimalHoursText(emp.horas_trabajadas, true), cols[5].x + 2, y + 14, { width: cols[5].w - 4, align: 'right', lineBreak: false });

        doc.fontSize(6.5).fillColor(emp.minutos_tardanza > 0 ? '#b91c1c' : '#94a3b8');
        doc.text(emp.minutos_tardanza > 0 ? `${emp.minutos_tardanza}m (${emp.llegadas_tarde})` : '—', cols[6].x + 2, y + 9, { width: cols[6].w - 4, align: 'right', lineBreak: false });

        doc.fontSize(7).fillColor('#475569');
        doc.text(`${emp.horas_extra_calculadas.toFixed(2)}h`, cols[7].x + 2, y + 9, { width: cols[7].w - 4, align: 'right', lineBreak: false });

        doc.font('Helvetica-Bold').fillColor(emp.horas_extra_aprobadas > 0 ? '#15803d' : '#64748b');
        doc.text(`${emp.horas_extra_aprobadas.toFixed(2)}h`, cols[8].x + 2, y + 5, { width: cols[8].w - 4, align: 'right', lineBreak: false });
        doc.font('Helvetica').fontSize(5.8).fillColor('#475569').text(formatDecimalHoursText(emp.horas_extra_aprobadas, true), cols[8].x + 2, y + 14, { width: cols[8].w - 4, align: 'right', lineBreak: false });

        // Línea de firma individual por colaborador
        const sigX1 = cols[9].x + 8;
        const sigX2 = cols[9].x + cols[9].w - 8;
        doc.strokeColor('#64748b').lineWidth(0.6).moveTo(sigX1, y + 17).lineTo(sigX2, y + 17).stroke();
        doc.font('Helvetica').fontSize(5.3).fillColor('#64748b').text(`Firma: ${emp.nombre}`, sigX1, y + 19, {
            width: sigX2 - sigX1,
            align: 'center',
            ellipsis: true,
            lineBreak: false
        });

        doc.strokeColor('#e2e8f0').lineWidth(0.4).moveTo(30, y + 28).lineTo(762, y + 28).stroke();
        y += 28;
    });

    if (y > 505) {
        doc.addPage();
        y = 35;
    }

    y += 4;
    doc.rect(30, y, 732, 20).fill('#eef2ff');
    doc.strokeColor('#818cf8').lineWidth(0.6).rect(30, y, 732, 20).stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e1b4b');
    doc.text(`TOTALES GENERALES (${employeeSummaries.length} COLABORADORES)`, 36, y + 6, { width: 310, lineBreak: false });
    doc.text(String(totDias), cols[4].x + 2, y + 6, { width: cols[4].w - 4, align: 'center', lineBreak: false });
    doc.text(`${totHrsLab.toFixed(2)}h`, cols[5].x + 2, y + 6, { width: cols[5].w - 4, align: 'right', lineBreak: false });
    doc.text(totMinTard > 0 ? `${totMinTard}m` : '0m', cols[6].x + 2, y + 6, { width: cols[6].w - 4, align: 'right', lineBreak: false });
    doc.text(`${totHeReloj.toFixed(2)}h`, cols[7].x + 2, y + 6, { width: cols[7].w - 4, align: 'right', lineBreak: false });
    doc.text(`${totHeAprob.toFixed(2)}h`, cols[8].x + 2, y + 6, { width: cols[8].w - 4, align: 'right', lineBreak: false });

    y += 28;
    reportPdfHelper.renderClosingFooter(doc, 30, y, employeeSummaries.length, 'Colaboradores en Corte Congelado');
    reportPdfHelper.renderPageNumbers(doc);
}

function renderDetailedPersonPdf(doc, ctx) {
    const { company, corte, onlyOvertime, employeeSummaries } = ctx;
    const periodText = `DEL ${reportPdfHelper.formatDate(corte.fecha_inicio)} AL ${reportPdfHelper.formatDate(corte.fecha_fin)}`;
    const subtitle = `${corte.nombre.toUpperCase()} — ${onlyOvertime ? 'SOLO HORAS EXTRA' : 'DETALLE COMPLETO POR PERSONA'}`;

    let y = reportPdfHelper.renderHeader(
        doc,
        company,
        'RESUMEN DETALLADO DE CONTROL DE HORAS POR COLABORADOR',
        periodText,
        'landscape',
        subtitle
    );

    const cols = [
        { label: 'FECHA', x: 30, w: 68, align: 'left' },
        { label: 'ENTRADA', x: 98, w: 54, align: 'center' },
        { label: 'SALIDA', x: 152, w: 54, align: 'center' },
        { label: 'HRS LAB.', x: 206, w: 72, align: 'right' },
        { label: 'TARDANZA', x: 278, w: 58, align: 'right' },
        { label: 'H.E. RELOJ', x: 336, w: 74, align: 'right' },
        { label: 'H.E. APROB.', x: 410, w: 94, align: 'right' },
        { label: 'OBSERVACIÓN', x: 510, w: 148, align: 'left' },
        { label: 'FIRMA / V°B°', x: 662, w: 100, align: 'center' }
    ];

    const renderPersonTableHeader = () => {
        doc.rect(30, y, 732, 15).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        cols.forEach(c => doc.text(c.label, c.x + 2, y + 4, { width: c.w - 4, align: c.align, lineBreak: false }));
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 15).lineTo(762, y + 15).stroke();
        y += 17;
    };

    if (employeeSummaries.length === 0) {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('No hay registros para los filtros seleccionados.', 30, y + 10);
    }

    employeeSummaries.forEach((emp, empIdx) => {
        if (empIdx > 0 && (employeeSummaries.length > 1 || y > 330)) {
            doc.addPage();
            y = 35;
        }

        // Tarjeta encabezado del colaborador con su totalizador
        doc.rect(30, y, 732, 34).fill('#eef2ff');
        doc.strokeColor('#a5b4fc').lineWidth(0.6).rect(30, y, 732, 34).stroke();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e1b4b').text(
            `${emp.nombre}  [${emp.codigo}]`,
            38,
            y + 5,
            { width: 350, lineBreak: false }
        );
        doc.fontSize(7).font('Helvetica').fillColor('#4338ca').text(
            `${emp.cargo} · ${emp.departamento}`,
            38,
            y + 18,
            { width: 350, lineBreak: false }
        );

        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text(
            `Días: ${emp.dias}   |   Hrs Lab.: ${fmtHoursPair(emp.horas_trabajadas)}   |   Tardanzas: ${emp.llegadas_tarde} (${emp.minutos_tardanza} min)`,
            370,
            y + 6,
            { width: 384, align: 'right', lineBreak: false }
        );
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#15803d').text(
            `H.E. Reloj: ${emp.horas_extra_calculadas.toFixed(2)}h   |   H.E. Aprobadas: ${fmtHoursPair(emp.horas_extra_aprobadas)} (D:${emp.horas_extra_diurnas.toFixed(2)}h / N:${emp.horas_extra_nocturnas.toFixed(2)}h)`,
            370,
            y + 18,
            { width: 384, align: 'right', lineBreak: false }
        );
        y += 38;

        renderPersonTableHeader();

        emp.rows.forEach((r, rIdx) => {
            if (y > 505) {
                doc.addPage();
                y = 35;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text(`${emp.nombre} [${emp.codigo}] (cont.)`, 30, y);
                y += 14;
                renderPersonTableHeader();
            }

            if (rIdx % 2 === 1) {
                doc.rect(30, y, 732, 20).fill('#f8fafc');
            }

            const flags = [r.es_festivo ? 'Fest' : '', r.es_domingo ? 'Dom' : '', r.es_marcacion_incompleta ? 'Inc' : ''].filter(Boolean).join('/');
            const dateText = flags ? `${reportPdfHelper.formatDate(r.fecha)} (${flags})` : reportPdfHelper.formatDate(r.fecha);

            doc.fontSize(6.5).font('Helvetica').fillColor('#334155');
            doc.text(dateText, cols[0].x + 2, y + 6, { width: cols[0].w - 4, align: 'left', lineBreak: false });
            doc.font('Courier').text(r.entrada || '---', cols[1].x + 2, y + 6, { width: cols[1].w - 4, align: 'center', lineBreak: false });
            doc.text(r.salida || '---', cols[2].x + 2, y + 6, { width: cols[2].w - 4, align: 'center', lineBreak: false });

            doc.font('Helvetica').fillColor('#0f172a');
            doc.text(r.horas_trabajadas > 0 ? `${Number(r.horas_trabajadas).toFixed(2)}h (${formatDecimalHoursText(r.horas_trabajadas, true)})` : '—', cols[3].x + 2, y + 6, { width: cols[3].w - 4, align: 'right', lineBreak: false });
            doc.fillColor(r.es_llegada_tarde ? '#b91c1c' : '#94a3b8').text(r.es_llegada_tarde ? `${r.minutos_tardanza} min` : '—', cols[4].x + 2, y + 6, { width: cols[4].w - 4, align: 'right', lineBreak: false });
            doc.fillColor('#475569').text(r.horas_extra_calculadas > 0 ? `${Number(r.horas_extra_calculadas).toFixed(2)}h` : '—', cols[5].x + 2, y + 6, { width: cols[5].w - 4, align: 'right', lineBreak: false });

            const noctTag = Number(r.horas_extra_nocturnas || 0) > 0 ? ` (N:${Number(r.horas_extra_nocturnas).toFixed(2)}h)` : '';
            doc.font('Helvetica-Bold').fillColor(r.horas_extra_aprobadas > 0 ? '#15803d' : '#94a3b8').text(
                r.horas_extra_aprobadas > 0 ? `${Number(r.horas_extra_aprobadas).toFixed(2)}h${noctTag}` : '—',
                cols[6].x + 2,
                y + 6,
                { width: cols[6].w - 4, align: 'right', lineBreak: false }
            );

            doc.font('Helvetica').fontSize(6).fillColor('#475569').text(
                r.observacion || r.alerta_marcacion || '',
                cols[7].x + 2,
                y + 6,
                { width: cols[7].w - 4, align: 'left', ellipsis: true, lineBreak: false }
            );

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(cols[8].x + 8, y + 14).lineTo(cols[8].x + cols[8].w - 8, y + 14).stroke();
            doc.strokeColor('#e2e8f0').lineWidth(0.4).moveTo(30, y + 20).lineTo(762, y + 20).stroke();
            y += 20;
        });

        // Fila subtotal del colaborador + bloque firma de aceptación personal
        if (y > 475) {
            doc.addPage();
            y = 35;
        }
        doc.rect(30, y, 732, 18).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`SUBTOTAL ${emp.nombre} (${emp.dias} días)`, 34, y + 5, { width: 170, ellipsis: true, lineBreak: false });
        doc.text(`${emp.horas_trabajadas.toFixed(2)}h`, cols[3].x + 2, y + 5, { width: cols[3].w - 4, align: 'right', lineBreak: false });
        doc.text(emp.minutos_tardanza > 0 ? `${emp.minutos_tardanza}m` : '—', cols[4].x + 2, y + 5, { width: cols[4].w - 4, align: 'right', lineBreak: false });
        doc.text(`${emp.horas_extra_calculadas.toFixed(2)}h`, cols[5].x + 2, y + 5, { width: cols[5].w - 4, align: 'right', lineBreak: false });
        doc.fillColor('#15803d').text(`${emp.horas_extra_aprobadas.toFixed(2)}h`, cols[6].x + 2, y + 5, { width: cols[6].w - 4, align: 'right', lineBreak: false });
        y += 26;

        // Firma de aceptación del colaborador y supervisor
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#475569').text(
            'Declaro haber revisado y estar conforme con el detalle diario y total de horas laboradas y horas extra aprobadas en este período.',
            30,
            y,
            { width: 732 }
        );
        y += 26;
        doc.strokeColor('#334155').lineWidth(0.8).moveTo(70, y).lineTo(310, y).stroke();
        doc.strokeColor('#334155').lineWidth(0.8).moveTo(450, y).lineTo(690, y).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`FIRMA DE ACEPTACIÓN: ${emp.nombre}`, 50, y + 4, { width: 280, align: 'center' });
        doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
        doc.text(`Código [${emp.codigo}] · ${emp.cargo}`, 50, y + 14, { width: 280, align: 'center' });
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('AUTORIZADO POR (RRHH / SUPERVISIÓN)', 430, y + 4, { width: 280, align: 'center' });
        y += 30;
    });

    if (y > 515) {
        doc.addPage();
        y = 35;
    }
    reportPdfHelper.renderClosingFooter(doc, 30, y, employeeSummaries.length, 'Resúmenes por Colaborador');
    reportPdfHelper.renderPageNumbers(doc);
}

/**
 * Genera el PDF oficial (Global con firmas por fila o Detallado por Persona)
 */
async function generateCortePdf(companyId, corteId, query = {}) {
    const ctx = await getCorteExportContext(companyId, corteId, query);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    if (ctx.scope === 'person') {
        renderDetailedPersonPdf(doc, ctx);
    } else {
        renderGlobalCortePdf(doc, ctx);
    }

    doc.end();
    return await getBuffer();
}

function styleHeaderRow(row) {
    row.font = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.height = 22;
    row.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });
}

function applyThinBorders(row) {
    row.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });
}

/**
 * Genera el libro Excel (.xlsx) para Período Congelado (Global con columna Firma o Detallado por Persona)
 */
async function generateCorteExcel(companyId, corteId, query = {}) {
    const ctx = await getCorteExportContext(companyId, corteId, query);
    const { company, corte, scope, onlyOvertime, employeeSummaries } = ctx;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS';
    const companyTitle = String(company?.razon_social || company?.nombre_comercial || 'EMPRESA').toUpperCase();
    const rangeLabel = `Del ${reportPdfHelper.formatDate(corte.fecha_inicio)} al ${reportPdfHelper.formatDate(corte.fecha_fin)}`;

    if (scope === 'global') {
        const ws = workbook.addWorksheet('Resumen Global (Firmas)', {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        ws.mergeCells('A1:K1');
        ws.getCell('A1').value = `${companyTitle} — RESUMEN GLOBAL DE CONTROL DE HORAS Y ACEPTACIÓN`;
        ws.getCell('A1').font = { bold: true, size: 13, name: 'Calibri' };
        ws.getCell('A1').alignment = { horizontal: 'center' };

        ws.mergeCells('A2:K2');
        ws.getCell('A2').value = `${corte.nombre} (${rangeLabel})${onlyOvertime ? ' · Solo registros con Horas Extra' : ''}`;
        ws.getCell('A2').font = { size: 10, name: 'Calibri', color: { argb: 'FF475569' } };
        ws.getCell('A2').alignment = { horizontal: 'center' };

        ws.mergeCells('A3:K3');
        ws.getCell('A3').value = 'Con mi firma en la fila correspondiente hago constar la revisión y aceptación de las horas laboradas y horas extra aprobadas del período.';
        ws.getCell('A3').font = { italic: true, size: 9, name: 'Calibri', color: { argb: 'FF475569' } };
        ws.getCell('A3').alignment = { horizontal: 'center' };
        ws.addRow([]);

        const headers = [
            '#', 'Código', 'Colaborador', 'Cargo', 'Departamento',
            'Días', 'Hrs Laboradas', 'Min Tardanza', 'H.E. Reloj', 'H.E. Aprobadas',
            'Firma de Aceptación (según nombre)'
        ];
        const headerRow = ws.addRow(headers);
        styleHeaderRow(headerRow);

        const widths = [5, 11, 28, 18, 18, 8, 14, 13, 12, 14, 34];
        widths.forEach((w, idx) => { ws.getColumn(idx + 1).width = w; });

        let totDias = 0;
        let totHrs = 0;
        let totTard = 0;
        let totHeReloj = 0;
        let totHeAprob = 0;

        employeeSummaries.forEach((emp, idx) => {
            totDias += emp.dias;
            totHrs += emp.horas_trabajadas;
            totTard += emp.minutos_tardanza;
            totHeReloj += emp.horas_extra_calculadas;
            totHeAprob += emp.horas_extra_aprobadas;

            const row = ws.addRow([
                idx + 1,
                emp.codigo,
                emp.nombre,
                emp.cargo,
                emp.departamento,
                emp.dias,
                emp.horas_trabajadas,
                emp.minutos_tardanza,
                emp.horas_extra_calculadas,
                emp.horas_extra_aprobadas,
                `_______________________ (${emp.nombre})`
            ]);
            row.height = 28;
            row.font = { size: 10, name: 'Calibri' };
            row.alignment = { vertical: 'middle' };
            row.getCell(11).font = { size: 8.5, name: 'Calibri', color: { argb: 'FF64748B' } };
            row.getCell(11).alignment = { horizontal: 'center', vertical: 'bottom' };
            applyThinBorders(row);
        });

        const totalRow = ws.addRow([
            '', '', `TOTALES (${employeeSummaries.length} colaboradores)`, '', '',
            totDias,
            parseFloat(totHrs.toFixed(2)),
            totTard,
            parseFloat(totHeReloj.toFixed(2)),
            parseFloat(totHeAprob.toFixed(2)),
            ''
        ]);
        totalRow.height = 22;
        totalRow.font = { bold: true, size: 10, name: 'Calibri' };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
        applyThinBorders(totalRow);

        // Hoja 2: Detalle Diario completo
        const wsDetail = workbook.addWorksheet('Detalle Diario', {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        const detHeaders = [
            'Fecha', 'Código', 'Colaborador', 'Cargo', 'Departamento',
            'Entrada', 'Salida', 'Hrs Lab.', 'Tardanza (min)', 'H.E. Reloj',
            'H.E. Aprob.', 'H.E. Diurnas', 'H.E. Nocturnas', 'Observación', 'Firma / V°B°'
        ];
        const detHeadRow = wsDetail.addRow(detHeaders);
        styleHeaderRow(detHeadRow);
        [12, 10, 26, 16, 16, 10, 10, 11, 13, 11, 11, 12, 13, 28, 20].forEach((w, idx) => {
            wsDetail.getColumn(idx + 1).width = w;
        });

        employeeSummaries.forEach((emp) => {
            emp.rows.forEach((r) => {
                const row = wsDetail.addRow([
                    reportPdfHelper.formatDate(r.fecha),
                    r.codigo,
                    r.nombre,
                    r.cargo,
                    r.departamento,
                    r.entrada || '---',
                    r.salida || '---',
                    Number(r.horas_trabajadas || 0),
                    Number(r.minutos_tardanza || 0),
                    Number(r.horas_extra_calculadas || 0),
                    Number(r.horas_extra_aprobadas || 0),
                    Number(r.horas_extra_diurnas || 0),
                    Number(r.horas_extra_nocturnas || 0),
                    r.observacion || r.alerta_marcacion || '',
                    ''
                ]);
                row.height = 20;
                row.font = { size: 9.5, name: 'Calibri' };
                row.alignment = { vertical: 'middle' };
                applyThinBorders(row);
            });
        });
    } else {
        const ws = workbook.addWorksheet('Detalle por Persona', {
            pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        ws.mergeCells('A1:K1');
        ws.getCell('A1').value = `${companyTitle} — RESUMEN DETALLADO DE CONTROL DE HORAS POR COLABORADOR`;
        ws.getCell('A1').font = { bold: true, size: 13, name: 'Calibri' };
        ws.getCell('A1').alignment = { horizontal: 'center' };

        ws.mergeCells('A2:K2');
        ws.getCell('A2').value = `${corte.nombre} (${rangeLabel})${onlyOvertime ? ' · Solo registros con Horas Extra' : ''}`;
        ws.getCell('A2').font = { size: 10, name: 'Calibri', color: { argb: 'FF475569' } };
        ws.getCell('A2').alignment = { horizontal: 'center' };

        [13, 11, 11, 12, 13, 12, 13, 12, 12, 30, 24].forEach((w, idx) => {
            ws.getColumn(idx + 1).width = w;
        });

        const detCols = [
            'Fecha', 'Entrada', 'Salida', 'Hrs Lab.', 'Tardanza (min)',
            'H.E. Reloj', 'H.E. Aprob.', 'H.E. Diurnas', 'H.E. Noct.', 'Observación', 'Firma / V°B°'
        ];

        employeeSummaries.forEach((emp) => {
            ws.addRow([]);
            const empTitleRow = ws.addRow([
                `Colaborador: ${emp.nombre} [${emp.codigo}]`,
                '', '', '',
                `Cargo: ${emp.cargo} (${emp.departamento})`,
                '', '',
                `Días: ${emp.dias}`,
                `Hrs: ${emp.horas_trabajadas.toFixed(2)}h`,
                `H.E. Aprob.: ${emp.horas_extra_aprobadas.toFixed(2)}h`,
                `Tard.: ${emp.minutos_tardanza}m`
            ]);
            ws.mergeCells(empTitleRow.number, 1, empTitleRow.number, 4);
            ws.mergeCells(empTitleRow.number, 5, empTitleRow.number, 7);
            empTitleRow.font = { bold: true, size: 10.5, name: 'Calibri', color: { argb: 'FF1E1B4B' } };
            empTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
            empTitleRow.height = 22;
            applyThinBorders(empTitleRow);

            const hRow = ws.addRow(detCols);
            styleHeaderRow(hRow);

            emp.rows.forEach((r) => {
                const row = ws.addRow([
                    reportPdfHelper.formatDate(r.fecha),
                    r.entrada || '---',
                    r.salida || '---',
                    Number(r.horas_trabajadas || 0),
                    Number(r.minutos_tardanza || 0),
                    Number(r.horas_extra_calculadas || 0),
                    Number(r.horas_extra_aprobadas || 0),
                    Number(r.horas_extra_diurnas || 0),
                    Number(r.horas_extra_nocturnas || 0),
                    r.observacion || r.alerta_marcacion || '',
                    ''
                ]);
                row.height = 22;
                row.font = { size: 9.5, name: 'Calibri' };
                row.alignment = { vertical: 'middle' };
                applyThinBorders(row);
            });

            const subRow = ws.addRow([
                `SUBTOTAL (${emp.dias} días)`,
                '', '',
                emp.horas_trabajadas,
                emp.minutos_tardanza,
                emp.horas_extra_calculadas,
                emp.horas_extra_aprobadas,
                emp.horas_extra_diurnas,
                emp.horas_extra_nocturnas,
                'Firma de Aceptación:',
                `_____________________ (${emp.nombre})`
            ]);
            subRow.height = 28;
            subRow.font = { bold: true, size: 9.5, name: 'Calibri' };
            subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            subRow.getCell(11).font = { size: 8.5, name: 'Calibri', color: { argb: 'FF475569' } };
            subRow.getCell(11).alignment = { horizontal: 'center', vertical: 'bottom' };
            applyThinBorders(subRow);
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    getCorteExportContext,
    generateCortePdf,
    generateCorteExcel
};
