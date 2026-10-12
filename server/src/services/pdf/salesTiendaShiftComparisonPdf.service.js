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
 * Generates the PDF buffer for Comparative Store Sales Report: Arqueos vs DTEs.
 */
const generateStoreSalesComparisonPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE COMPARATIVO: ARQUEOS VS DTES POR TURNO';
    const subtitle = `TIENDA  |  SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const compData = data.comparison || { days: [], shifts: [], summary: {} };
    const summary = compData.summary || {};

    // 1. KPI Summary Cards
    const cardWidth = (contentWidth - 18) / 4;
    const cardHeight = 28;
    const cardY = currentY + 2;

    const cards = [
        { label: 'TOTAL ARQUEOS (CAJA)', val: reportPdfHelper.fmt(summary.total_arqueos || 0), color: '#1e293b' },
        { label: 'TOTAL DTES EMITIDOS', val: reportPdfHelper.fmt(summary.total_dtes || 0), color: '#4f46e5' },
        { 
            label: 'DIFERENCIA NETA', 
            val: reportPdfHelper.fmt(summary.total_difference || 0),
            color: Math.abs(summary.total_difference || 0) < 0.01 ? '#16a34a' : '#d97706'
        },
        { 
            label: 'DÍAS CUADRE EXACTO', 
            val: `${summary.exact_days_count || 0} de ${summary.total_days || 0} días`,
            color: '#16a34a'
        }
    ];

    cards.forEach((c, idx) => {
        const cx = startX + idx * (cardWidth + 6);
        doc.rect(cx, cardY, cardWidth, cardHeight).fill('#f8fafc').strokeColor('#e2e8f0').stroke();
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#64748b').text(c.label, cx + 6, cardY + 4, { width: cardWidth - 12 });
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(c.color).text(c.val, cx + 6, cardY + 14, { width: cardWidth - 12 });
    });

    currentY = cardY + cardHeight + 10;

    // 2. Section: Cuadre Diario Comparativo
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('1. CUADRE COMPARATIVO DÍA POR DÍA (FECHA APERTURA DEL TURNO)', startX, currentY);
    currentY += 12;

    const colWidths = {
        fecha: 75,
        arqueo: 105,
        dte: 105,
        contado: 85,
        credito: 85,
        diff: 95,
        diag: 142,
        turnos: 40
    };

    const drawDailyHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX;
        doc.text('FECHA', x + 2, y + 3, { width: colWidths.fecha - 4 }); x += colWidths.fecha;
        doc.text('ARQUEOS CAJA', x, y + 3, { width: colWidths.arqueo - 4, align: 'right' }); x += colWidths.arqueo;
        doc.text('TOTAL DTES', x, y + 3, { width: colWidths.dte - 4, align: 'right' }); x += colWidths.dte;
        doc.text('DTE CONTADO', x, y + 3, { width: colWidths.contado - 4, align: 'right' }); x += colWidths.contado;
        doc.text('DTE CRÉDITO', x, y + 3, { width: colWidths.credito - 4, align: 'right' }); x += colWidths.credito;
        doc.text('DIFERENCIA', x, y + 3, { width: colWidths.diff - 4, align: 'right' }); x += colWidths.diff;
        doc.text('DIAGNÓSTICO / ESTADO', x + 4, y + 3, { width: colWidths.diag - 4 }); x += colWidths.diag;
        doc.text('TURNOS', x, y + 3, { width: colWidths.turnos - 4, align: 'center' });
        return y + 16;
    };

    currentY = drawDailyHeader(currentY);

    const days = compData.days || [];
    days.forEach(d => {
        if (currentY > 530) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawDailyHeader(currentY);
        }

        const isExact = Math.abs(d.difference || 0) < 0.01;
        const diffColor = isExact ? '#16a34a' : (d.difference > 0 ? '#d97706' : '#e11d48');
        let diagLabel = '✓ EXACTO AL CENTAVO';
        if (!isExact) {
            diagLabel = d.difference > 0 ? `+${d.difference.toFixed(2)} (Efectivo sin DTE)` : `${d.difference.toFixed(2)} (Exceso DTE)`;
        }

        let x = startX;
        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(d.fecha), x + 2, currentY, { width: colWidths.fecha - 4 }); x += colWidths.fecha;
        doc.text(reportPdfHelper.fmt(d.total_arqueo), x, currentY, { width: colWidths.arqueo - 4, align: 'right' }); x += colWidths.arqueo;
        doc.text(reportPdfHelper.fmt(d.total_dtes), x, currentY, { width: colWidths.dte - 4, align: 'right' }); x += colWidths.dte;
        doc.text(reportPdfHelper.fmt(d.total_contado), x, currentY, { width: colWidths.contado - 4, align: 'right' }); x += colWidths.contado;
        doc.text(reportPdfHelper.fmt(d.total_credito), x, currentY, { width: colWidths.credito - 4, align: 'right' }); x += colWidths.credito;
        doc.font('Helvetica-Bold').fillColor(diffColor).text(reportPdfHelper.fmt(d.difference), x, currentY, { width: colWidths.diff - 4, align: 'right' }); x += colWidths.diff;
        doc.fontSize(6.5).text(diagLabel, x + 4, currentY, { width: colWidths.diag - 4 }); x += colWidths.diag;
        doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(String(d.shifts_count || 1), x, currentY, { width: colWidths.turnos - 4, align: 'center' });

        currentY += 12;
    });

    // Daily Total Row
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 3;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
    let xTot = startX;
    doc.text('TOTAL MES:', xTot + 2, currentY, { width: colWidths.fecha - 4 }); xTot += colWidths.fecha;
    doc.text(reportPdfHelper.fmt(summary.total_arqueos || 0), xTot, currentY, { width: colWidths.arqueo - 4, align: 'right' }); xTot += colWidths.arqueo;
    doc.text(reportPdfHelper.fmt(summary.total_dtes || 0), xTot, currentY, { width: colWidths.dte - 4, align: 'right' }); xTot += colWidths.dte;
    doc.text(reportPdfHelper.fmt(summary.total_contado || 0), xTot, currentY, { width: colWidths.contado - 4, align: 'right' }); xTot += colWidths.contado;
    doc.text(reportPdfHelper.fmt(summary.total_credito || 0), xTot, currentY, { width: colWidths.credito - 4, align: 'right' }); xTot += colWidths.credito;
    doc.text(reportPdfHelper.fmt(summary.total_difference || 0), xTot, currentY, { width: colWidths.diff - 4, align: 'right' }); xTot += colWidths.diff;
    doc.text(`Cuadre: ${summary.exact_days_count} de ${summary.total_days} días`, xTot + 4, currentY, { width: colWidths.diag - 4 }); xTot += colWidths.diag;
    doc.text(String(summary.total_shifts || 0), xTot, currentY, { width: colWidths.turnos - 4, align: 'center' });
    currentY += 16;

    // 3. Section: Detalle Comparativo por Turno (Nueva página si es necesario)
    if (currentY > 480) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('2. DETALLE COMPARATIVO POR TURNO INDIVIDUAL', startX, currentY);
    currentY += 12;

    const shiftCols = {
        fecha: 65,
        pos: 90,
        turno: 55,
        cajero: 140,
        estado: 55,
        arqueo: 85,
        dte: 85,
        diff: 77,
        diag: 80
    };

    const drawShiftHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX;
        doc.text('FECHA', x + 2, y + 3, { width: shiftCols.fecha - 4 }); x += shiftCols.fecha;
        doc.text('TERMINAL POS', x + 2, y + 3, { width: shiftCols.pos - 4 }); x += shiftCols.pos;
        doc.text('TURNO', x + 2, y + 3, { width: shiftCols.turno - 4 }); x += shiftCols.turno;
        doc.text('CAJERO / VENDEDOR', x + 2, y + 3, { width: shiftCols.cajero - 4 }); x += shiftCols.cajero;
        doc.text('ESTADO', x + 2, y + 3, { width: shiftCols.estado - 4 }); x += shiftCols.estado;
        doc.text('ARQUEO CAJA', x, y + 3, { width: shiftCols.arqueo - 4, align: 'right' }); x += shiftCols.arqueo;
        doc.text('TOTAL DTES', x, y + 3, { width: shiftCols.dte - 4, align: 'right' }); x += shiftCols.dte;
        doc.text('DIFERENCIA', x, y + 3, { width: shiftCols.diff - 4, align: 'right' }); x += shiftCols.diff;
        doc.text('DIAGNÓSTICO', x + 4, y + 3, { width: shiftCols.diag - 4 });
        return y + 16;
    };

    currentY = drawShiftHeader(currentY);

    const shifts = compData.shifts || [];
    shifts.forEach(s => {
        if (currentY > 530) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawShiftHeader(currentY);
        }

        const isExact = Math.abs(s.difference || 0) < 0.01;
        const diffColor = isExact ? '#16a34a' : (s.difference > 0 ? '#d97706' : '#e11d48');
        let diagLabel = '✓ Exacto';
        if (!isExact) {
            diagLabel = s.difference > 0 ? 'Sobregiro/Efectivo' : 'Exceso DTE';
        }

        let x = startX;
        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(s.fecha_str), x + 2, currentY, { width: shiftCols.fecha - 4 }); x += shiftCols.fecha;
        doc.text(s.pos_name || 'Sin POS', x + 2, currentY, { width: shiftCols.pos - 4, truncate: true }); x += shiftCols.pos;
        doc.text(`Turno #${s.shift_number}`, x + 2, currentY, { width: shiftCols.turno - 4 }); x += shiftCols.turno;
        doc.text(s.seller_name || 'Sin Asignar', x + 2, currentY, { width: shiftCols.cajero - 4, truncate: true }); x += shiftCols.cajero;
        doc.text((s.status || '').toUpperCase(), x + 2, currentY, { width: shiftCols.estado - 4 }); x += shiftCols.estado;
        doc.text(reportPdfHelper.fmt(s.arqueo_sales), x, currentY, { width: shiftCols.arqueo - 4, align: 'right' }); x += shiftCols.arqueo;
        doc.text(reportPdfHelper.fmt(s.dte_sales), x, currentY, { width: shiftCols.dte - 4, align: 'right' }); x += shiftCols.dte;
        doc.font('Helvetica-Bold').fillColor(diffColor).text(reportPdfHelper.fmt(s.difference), x, currentY, { width: shiftCols.diff - 4, align: 'right' }); x += shiftCols.diff;
        doc.fontSize(6.5).text(diagLabel, x + 4, currentY, { width: shiftCols.diag - 4 });

        currentY += 11.5;
    });

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, shifts.length, 'Turnos Evaluados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

module.exports = {
    generateStoreSalesComparisonPDF
};
