const reportPdfHelper = require('../../utils/reportPdfHelper');

/**
 * Resolves company information for PDF headers.
 */
async function resolveCompanyInfo(data) {
    if (data.company && (data.company.razon_social || data.company.nombre_comercial)) {
        return data.company;
    }
    if (data.company_id) {
        return await reportPdfHelper.getCompanyInfo(data.company_id);
    }
    return await reportPdfHelper.getDefaultCompany();
}

/**
 * Maps DTE document code to a human-readable abbreviation.
 */
function getTipoDocLabel(code) {
    switch (String(code)) {
        case '01': return 'Factura';
        case '03': return 'Crédito Fiscal';
        case '04': return 'Nota Remisión';
        case '05': return 'Nota Crédito';
        case '06': return 'Nota Débito';
        case '11': return 'F. Exportación';
        case '14': return 'Sujeto Excluido';
        default: return code || '---';
    }
}

/**
 * Formats time from ISO string or HH:mm:ss.
 */
function formatHour(val) {
    if (!val) return '';
    if (typeof val === 'string' && val.includes(':')) {
        const parts = val.split(':');
        return `${parts[0]}:${parts[1]}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return '';
}

/**
 * Generates the PDF buffer for "Ventas de Tienda por Turno"
 */
const generateStoreSalesByShiftPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE VENTAS DE TIENDA POR TURNO';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = {
        fecha: 75,
        tipo: 60,
        numero: 130,
        cond: 45,
        cliente: 175,
        fiscal: 155,
        total: 92
    };

    const colX = {
        fecha: startX,
        tipo: startX + colWidths.fecha,
        numero: startX + colWidths.fecha + colWidths.tipo,
        cond: startX + colWidths.fecha + colWidths.tipo + colWidths.numero,
        cliente: startX + colWidths.fecha + colWidths.tipo + colWidths.numero + colWidths.cond,
        fiscal: startX + colWidths.fecha + colWidths.tipo + colWidths.numero + colWidths.cond + colWidths.cliente,
        total: startX + colWidths.fecha + colWidths.tipo + colWidths.numero + colWidths.cond + colWidths.cliente + colWidths.fiscal
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA / HORA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('TIPO DOC', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4 });
        doc.text('NÚMERO CONTROL', colX.numero + 2, y + 3, { width: colWidths.numero - 4 });
        doc.text('COND.', colX.cond + 2, y + 3, { width: colWidths.cond - 4 });
        doc.text('CLIENTE', colX.cliente + 2, y + 3, { width: colWidths.cliente - 4 });
        doc.text('NIT/NRC / CAJERO', colX.fiscal + 2, y + 3, { width: colWidths.fiscal - 4 });
        doc.text('TOTAL', colX.total, y + 3, { width: colWidths.total - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const posGroups = data.posGroups || [];
    let grandTotalCount = 0;

    if (posGroups.length === 0) {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b');
        doc.text('No se encontraron turnos ni ventas de tienda en el período seleccionado.', startX, currentY + 15, {
            width: contentWidth,
            align: 'center'
        });
        currentY += 45;
    }

    posGroups.forEach(pos => {
        // POS Header
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.rect(startX, currentY, contentWidth, 14).fill('#e2e8f0');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b');
        doc.text(`TERMINAL PUNTO DE VENTA: ${(pos.pos_name || 'SIN POS').toUpperCase()}`, startX + 5, currentY + 3);
        currentY += 16;

        (pos.shifts || []).forEach(shift => {
            if (currentY > 520) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
                // Repetir banner de POS si cambió de página
                doc.rect(startX, currentY, contentWidth, 14).fill('#e2e8f0');
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#1e293b');
                doc.text(`TERMINAL PUNTO DE VENTA: ${(pos.pos_name || 'SIN POS').toUpperCase()} (cont.)`, startX + 5, currentY + 3);
                currentY += 16;
            }

            // Shift Banner
            const startHour = formatHour(shift.start_time);
            const endHour = shift.end_time ? formatHour(shift.end_time) : 'Abierto';
            const shiftDateStr = reportPdfHelper.formatDate(shift.shift_date || shift.start_time);
            const shiftTitle = `TURNO #${shift.shift_number || shift.shift_id}  |  Fecha: ${shiftDateStr}  |  Horario: ${startHour} a ${endHour}  |  Cajero: ${(shift.seller_name || 'Sin Asignar').toUpperCase()}  |  Estado: ${(shift.status || '').toUpperCase()}`;

            doc.rect(startX, currentY, contentWidth, 13).fill('#f8fafc');
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569');
            doc.text(shiftTitle, startX + 4, currentY + 2.5);
            currentY += 15;

            const sales = shift.sales || [];
            if (sales.length === 0) {
                doc.fontSize(7).font('Helvetica-Oblique').fillColor('#94a3b8');
                doc.text('(Sin documentos DTE emitidos en este turno)', startX + 10, currentY);
                currentY += 12;
            } else {
                sales.forEach(row => {
                    if (currentY > 540) {
                        doc.addPage();
                        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(currentY);
                        doc.rect(startX, currentY, contentWidth, 13).fill('#f8fafc');
                        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569');
                        doc.text(`${shiftTitle} (cont.)`, startX + 4, currentY + 2.5);
                        currentY += 15;
                    }

                    const tipoLabel = getTipoDocLabel(row.tipo_documento);
                    const condLabel = row.condicion_operacion === 1 ? 'Contado' : 'Crédito';
                    const horaStr = row.hora_emision ? formatHour(row.hora_emision) : formatHour(row.created_at);
                    const fechaCompleta = `${reportPdfHelper.formatDate(row.fecha_emision)} ${horaStr}`.trim();
                    const fiscalInfo = `${row.cliente_nit || row.cliente_nrc || ''} / ${row.vendedor_nombre || ''}`.trim();
                    const totalPagar = parseFloat(row.total_pagar || 0);

                    doc.fontSize(7).font('Helvetica').fillColor('#334155');
                    doc.text(fechaCompleta, colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
                    doc.text(tipoLabel, colX.tipo + 2, currentY, { width: colWidths.tipo - 4 });
                    doc.text(row.numero_control || 'N/A', colX.numero + 2, currentY, { width: colWidths.numero - 4, truncate: true });
                    doc.text(condLabel, colX.cond + 2, currentY, { width: colWidths.cond - 4 });
                    doc.text(row.cliente_nombre || 'Consumidor Final', colX.cliente + 2, currentY, { width: colWidths.cliente - 4, truncate: true });
                    doc.text(fiscalInfo || '---', colX.fiscal + 2, currentY, { width: colWidths.fiscal - 4, truncate: true });
                    doc.text(reportPdfHelper.fmt(totalPagar), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });

                    grandTotalCount++;
                    currentY += 11.5;
                });
            }

            // Subtotal Turno
            doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
            currentY += 2;
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#1e293b');
            const subShiftText = `SUBTOTAL TURNO #${shift.shift_number || shift.shift_id} (${sales.length} dtes) - Contado: ${reportPdfHelper.fmt(shift.total_contado || 0)}  |  Crédito: ${reportPdfHelper.fmt(shift.total_credito || 0)}:`;
            doc.text(subShiftText, colX.cond, currentY, { width: colWidths.cond + colWidths.cliente + colWidths.fiscal - 6, align: 'right' });
            doc.text(reportPdfHelper.fmt(shift.total_shift || 0), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
            currentY += 13;
        });

        // Subtotal Terminal POS
        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
        currentY += 3;
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        const posSubtext = `SUBTOTAL TERMINAL ${(pos.pos_name || '').toUpperCase()} (${pos.sales_count || 0} dtes) - Contado: ${reportPdfHelper.fmt(pos.total_contado || 0)} | Crédito: ${reportPdfHelper.fmt(pos.total_credito || 0)}:`;
        doc.text(posSubtext, colX.cliente, currentY, { width: colWidths.cliente + colWidths.fiscal - 6, align: 'right' });
        doc.text(reportPdfHelper.fmt(pos.total_pos || 0), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
        currentY += 16;
    });

    // Total General
    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    const totals = data.totals || {};
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    const grandText = `TOTAL GENERAL TIENDA (${totals.count || grandTotalCount} ventas) - Contado: ${reportPdfHelper.fmt(totals.total_contado || 0)} | Crédito: ${reportPdfHelper.fmt(totals.total_credito || 0)}:`;
    doc.text(grandText, colX.cliente - 40, currentY, { width: colWidths.cliente + colWidths.fiscal + 34, align: 'right' });
    doc.text(reportPdfHelper.fmt(totals.grand_total || 0), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, totals.count || grandTotalCount, 'Ventas');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

module.exports = {
    generateStoreSalesByShiftPDF
};
