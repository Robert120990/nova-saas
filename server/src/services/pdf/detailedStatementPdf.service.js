const reportPdfHelper = require('../../utils/reportPdfHelper');
const { numeroALetras } = require('../../utils/numberToWords');

/**
 * Formats a numerical balance into words in Spanish for the promissory note line.
 * Example: 1943.72 -> "MIL NOVECIENTOS CUARENTA Y TRES CON 72/100 DOLARES"
 */
function formatAmountInWords(amount) {
    const val = Math.abs(Number(amount) || 0);
    const entero = Math.floor(val);
    const decimal = Math.round((val - entero) * 100);
    const letras = numeroALetras(entero);
    const prefix = Number(amount) < 0 ? 'MENOS ' : '';
    return `${prefix}${letras} CON ${String(decimal).padStart(2, '0')}/100 DOLARES`;
}

/**
 * Generates the Detailed Customer Statement PDF (Estado de Cuenta Detallado).
 * Features:
 * - Products, vehicle plates, and odometer per line
 * - Line net accumulated balance
 * - Summary box with Total Valores, Abonos, and Net Acumulado
 * - Promissory note: "Debo y pagare el valor de los productos..."
 * - Signatures: "FIRMA Y SELLO DEPTO DE COBROS" and "RECIBI CONFORME (CLIENTE)"
 */
const generateDetailedStatementPDF = async (data) => {
    const comp = data.company || await reportPdfHelper.getDefaultCompany();
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = 'ESTADO DE CUENTA DETALLADO';
    const subtitle = data.branch_name ? `SUCURSAL: ${data.branch_name}` : null;
    const periodText = data.startDate && data.endDate
        ? `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`
        : data.endDate
            ? `AL ${reportPdfHelper.formatDate(data.endDate)}`
            : `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;

    // Entity Customer Box
    const entityName = data.customer_name || 'N/A';
    const entityNit = data.customer_nit || data.customer_dui || data.nit || '—';
    const entityNrc = data.customer_nrc || data.nrc || '—';
    const entityPhone = data.customer_phone || data.telefono || '—';
    const entityEmail = data.customer_email || '—';

    doc.rect(startX, currentY, contentWidth, 38).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('INFORMACIÓN DEL CLIENTE', startX + 8, currentY + 5);

    const balLabel = 'SALDO A CANCELAR:';
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(balLabel, startX + 350, currentY + 5, { width: 194, align: 'right' });
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(data.totalAcumulado), startX + 350, currentY + 16, { width: 194, align: 'right' });

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b').text(entityName, startX + 8, currentY + 16, { width: 340, truncate: true });
    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    doc.text(`NIT/DUI: ${entityNit}    |    NRC: ${entityNrc}    |    Tel: ${entityPhone}    |    Correo: ${entityEmail}`, startX + 8, currentY + 26, { width: 340, truncate: true });

    currentY += 46;

    // Table Column Definitions
    const colWidths = {
        fecha: 52,
        doc: 54,
        tipo: 32,
        producto: 160,
        placas: 48,
        odometro: 44,
        valor: 58,
        abono: 50,
        acumulado: 54
    };

    const colX = {
        fecha: startX,
        doc: startX + colWidths.fecha,
        tipo: startX + colWidths.fecha + colWidths.doc,
        producto: startX + colWidths.fecha + colWidths.doc + colWidths.tipo,
        placas: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.producto,
        odometro: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.producto + colWidths.placas,
        valor: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.producto + colWidths.placas + colWidths.odometro,
        abono: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.producto + colWidths.placas + colWidths.odometro + colWidths.valor,
        acumulado: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.producto + colWidths.placas + colWidths.odometro + colWidths.valor + colWidths.abono
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).lineWidth(1).strokeColor('#0f172a').fillAndStroke('#f8fafc', '#0f172a');
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3.5, { width: colWidths.fecha - 4 });
        doc.text('DOCUMENTO', colX.doc + 2, y + 3.5, { width: colWidths.doc - 4 });
        doc.text('TIPO', colX.tipo + 1, y + 3.5, { width: colWidths.tipo - 2, align: 'center' });
        doc.text('PRODUCTO', colX.producto + 2, y + 3.5, { width: colWidths.producto - 4 });
        doc.text('PLACAS', colX.placas + 1, y + 3.5, { width: colWidths.placas - 2, align: 'center' });
        doc.text('ODOMETRO', colX.odometro, y + 3.5, { width: colWidths.odometro - 2, align: 'right' });
        doc.text('VALOR', colX.valor, y + 3.5, { width: colWidths.valor - 4, align: 'right' });
        doc.text('ABONO', colX.abono, y + 3.5, { width: colWidths.abono - 4, align: 'right' });
        doc.text('ACUMULADO', colX.acumulado, y + 3.5, { width: colWidths.acumulado - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const movements = data.movements || [];
    let totalValor = 0;
    let totalAbono = 0;

    movements.forEach((m) => {
        const valor = parseFloat(m.valor || 0);
        const abono = parseFloat(m.abono || 0);
        const acumulado = parseFloat(m.acumulado !== undefined ? m.acumulado : (valor - abono));
        totalValor += valor;
        totalAbono += abono;

        const rowHeight = 12;

        if (currentY + rowHeight > 680) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b');
        doc.text(reportPdfHelper.formatDate(m.fecha), colX.fecha + 2, currentY + 1.5, { width: colWidths.fecha - 4 });
        doc.text(String(m.documento || '—'), colX.doc + 2, currentY + 1.5, { width: colWidths.doc - 4, truncate: true });
        doc.text(String(m.tipo || 'CCF'), colX.tipo + 1, currentY + 1.5, { width: colWidths.tipo - 2, align: 'center', truncate: true });
        doc.text(String(m.producto || '—'), colX.producto + 2, currentY + 1.5, { width: colWidths.producto - 4, truncate: true });
        doc.text(String(m.placas || ''), colX.placas + 1, currentY + 1.5, { width: colWidths.placas - 2, align: 'center', truncate: true });
        doc.text(String(m.odometro !== undefined && m.odometro !== null && m.odometro !== '' ? m.odometro : '0.00'), colX.odometro, currentY + 1.5, { width: colWidths.odometro - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(valor), colX.valor, currentY + 1.5, { width: colWidths.valor - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(abono), colX.abono, currentY + 1.5, { width: colWidths.abono - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(acumulado), colX.acumulado, currentY + 1.5, { width: colWidths.acumulado - 4, align: 'right' });

        currentY += rowHeight;
    });

    const totalAcumulado = data.totalAcumulado !== undefined ? data.totalAcumulado : (totalValor - totalAbono);

    // Defensive check to avoid cutting off totals, note, and signatures
    const footerNeededHeight = 145;
    if (currentY + footerNeededHeight > 740) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    currentY += 6;

    // TOTALS BOX
    // Styled with solid borders matching reference image
    const boxX = colX.placas - 45;
    const boxW = (colX.acumulado + colWidths.acumulado) - boxX;
    const boxH = 17;

    doc.rect(boxX, currentY, boxW, boxH).lineWidth(1.2).strokeColor('#0f172a').stroke();

    // Vertical dividers inside totals box
    doc.moveTo(colX.valor, currentY).lineTo(colX.valor, currentY + boxH).lineWidth(0.8).strokeColor('#0f172a').stroke();
    doc.moveTo(colX.abono, currentY).lineTo(colX.abono, currentY + boxH).lineWidth(0.8).strokeColor('#0f172a').stroke();
    doc.moveTo(colX.acumulado, currentY).lineTo(colX.acumulado, currentY + boxH).lineWidth(0.8).strokeColor('#0f172a').stroke();

    // Content inside totals box
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL VALORES', boxX + 4, currentY + 4.5, { width: colX.valor - boxX - 10, align: 'right' });
    doc.text(reportPdfHelper.fmt(totalValor), colX.valor, currentY + 4.5, { width: colWidths.valor - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(totalAbono), colX.abono, currentY + 4.5, { width: colWidths.abono - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(totalAcumulado), colX.acumulado, currentY + 4.5, { width: colWidths.acumulado - 4, align: 'right' });

    currentY += boxH + 14;

    // SALDO A CANCELAR EN LETRAS (Vibrant Blue bold text)
    const saldoEnLetras = formatAmountInWords(totalAcumulado);
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1d4ed8')
        .text(`SALDO A CANCELAR : ${saldoEnLetras}`, startX, currentY, { width: contentWidth });

    currentY += 18;

    // NOTA LEGAL / PAGARÉ
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a')
        .text('NOTA: ', startX, currentY, { continued: true });
    doc.font('Helvetica').fontSize(7.5).fillColor('#0f172a')
        .text('Debo y pagare el valor de los productos detallados en este estado de cuenta. En caso de mora reconoceré el 4% mensual.', { width: contentWidth, lineGap: 1.5 });

    currentY += 48;

    // FIRMAS
    const sigW = 180;
    const sig1X = startX + 10;
    const sig2X = startX + contentWidth - sigW - 10;

    doc.moveTo(sig1X, currentY).lineTo(sig1X + sigW, currentY).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text('FIRMA Y SELLO DEPTO DE COBROS', sig1X, currentY + 6, { width: sigW, align: 'center' });

    doc.moveTo(sig2X, currentY).lineTo(sig2X + sigW, currentY).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text('RECIBI CONFORME (CLIENTE)', sig2X, currentY + 6, { width: sigW, align: 'center' });

    // Page Numbers Footer
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

module.exports = {
    generateDetailedStatementPDF,
    formatAmountInWords
};
