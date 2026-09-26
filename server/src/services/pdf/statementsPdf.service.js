const {
    PDFDocument,
    path,
    fs,
    QRCode,
    reportPdfHelper,
    numberToWords,
    isValidTaxVal,
    resolveCompanyInfo,
    fmtDateDDMMYYYY
} = require('./pdfUtils');


// --- ESTADOS DE CUENTA Y ANTIGÜEDAD DE SALDOS (CLIENTES Y PROVEEDORES) ---
/**
 * Generates a PDF buffer for a customer/provider statement
 */
const generateStatementPDF = async (data, isProvider = false) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = data.title || (isProvider ? 'ESTADO DE CUENTA DE PROVEEDOR' : 'ESTADO DE CUENTA DE CLIENTE');
    const subtitle = data.branch_name ? `SUCURSAL: ${data.branch_name}` : null;
    const periodText = data.startDate && data.endDate 
        ? `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`
        : `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;

    // Entity Info Box
    const entityTitle = isProvider ? 'INFORMACIÓN DEL PROVEEDOR' : 'INFORMACIÓN DEL CLIENTE';
    const entityName = isProvider ? (data.provider_name || 'N/A') : (data.customer_name || 'N/A');
    const entityEmail = isProvider ? (data.provider_email || '—') : (data.customer_email || '—');
    const entityNit = isProvider ? (data.provider_nit || data.nit || '—') : (data.customer_nit || data.customer_dui || data.nit || '—');
    const entityNrc = isProvider ? (data.provider_nrc || data.nrc || '—') : (data.customer_nrc || data.nrc || '—');
    const entityPhone = isProvider ? (data.provider_phone || data.telefono || '—') : (data.customer_phone || data.telefono || '—');

    doc.rect(startX, currentY, contentWidth, 40).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(entityTitle, startX + 8, currentY + 5);

    const balLabel = (data.balance_label || (isProvider ? 'SALDO A PAGAR:' : 'SALDO PENDIENTE:')).toUpperCase();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(balLabel, startX + 350, currentY + 5, { width: 194, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(data.total_balance), startX + 350, currentY + 16, { width: 194, align: 'right' });

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b').text(entityName, startX + 8, currentY + 16, { width: 340, truncate: true });
    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    doc.text(`NIT/DUI: ${entityNit}    |    NRC: ${entityNrc}    |    Tel: ${entityPhone}    |    Correo: ${entityEmail}`, startX + 8, currentY + 27, { width: 340, truncate: true });

    currentY += 48;

    const colWidths = { fecha: 58, doc: 88, concepto: 196, cargo: 70, abono: 70, saldo: 70 };
    const colX = {
        fecha: startX,
        doc: startX + colWidths.fecha,
        concepto: startX + colWidths.fecha + colWidths.doc,
        cargo: startX + colWidths.fecha + colWidths.doc + colWidths.concepto,
        abono: startX + colWidths.fecha + colWidths.doc + colWidths.concepto + colWidths.cargo,
        saldo: startX + colWidths.fecha + colWidths.doc + colWidths.concepto + colWidths.cargo + colWidths.abono
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + contentWidth, y + 14).stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('CONCEPTO', colX.concepto + 2, y + 3, { width: colWidths.concepto - 4 });
        doc.text('CARGO (+)', colX.cargo, y + 3, { width: colWidths.cargo - 4, align: 'right' });
        doc.text('ABONO (-)', colX.abono, y + 3, { width: colWidths.abono - 4, align: 'right' });
        doc.text('SALDO', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const movements = data.movements || [];
    let totalCargos = 0;
    let totalAbonos = 0;

    movements.forEach(m => {
        const cargo = parseFloat(m.cargo || 0);
        const abono = parseFloat(m.abono || 0);
        const balance = parseFloat(m.balance || 0);
        totalCargos += cargo;
        totalAbonos += abono;
        const docText = `${m.tipo || ''} ${m.numero || ''}`.trim() || '—';
        const conceptoText = String(m.concepto || '—');

        doc.fontSize(7).font('Helvetica');
        const conceptHeight = doc.heightOfString(conceptoText, { width: colWidths.concepto - 4 });
        const docHeight = doc.heightOfString(docText, { width: colWidths.doc - 4 });
        const rowHeight = Math.max(13, Math.ceil(conceptHeight) + 3, Math.ceil(docHeight) + 3);

        if (currentY + rowHeight > 700) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(m.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(docText, colX.doc + 2, currentY, { width: colWidths.doc - 4 });
        doc.text(conceptoText, colX.concepto + 2, currentY, { width: colWidths.concepto - 4 });
        doc.text(reportPdfHelper.fmt(cargo), colX.cargo, currentY, { width: colWidths.cargo - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(abono), colX.abono, currentY, { width: colWidths.abono - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(balance), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

        currentY += rowHeight;
    });

    if (currentY > 685) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    // Fila de totales contables
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', colX.concepto, currentY, { width: colWidths.concepto - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(totalCargos), colX.cargo, currentY, { width: colWidths.cargo - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(totalAbonos), colX.abono, currentY, { width: colWidths.abono - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.total_balance), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 13;
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 16;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, movements.length, 'Movimientos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateProviderStatementPDF = (data) => generateStatementPDF(data, true);

/**
 * Genera el PDF del estado de cuenta Trupput (prepago por galonaje).
 * Cargos: recargas de galones (gas_station_trupput).
 * Abonos: despachos de galones en cierres (gas_station_closeout_trupput_despachos).
 * Cada movimiento incluye galones y monto.
 */
const generateTrupputStatementPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = 'ESTADO DE CUENTA TRUPPUT (PREPAGO POR GALONAJE)';
    const subtitle = data.branch_name ? `SUCURSAL: ${data.branch_name}` : null;
    const periodText = data.startDate && data.endDate 
        ? `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`
        : `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;

    // Info Box
    const entityName = data.customer_name || 'N/A';
    const entityEmail = data.customer_email || '—';
    const entityNit = data.customer_nit || data.nit || '—';
    const entityNrc = data.customer_nrc || data.nrc || '—';
    const entityPhone = data.customer_phone || data.telefono || '—';

    doc.rect(startX, currentY, contentWidth, 40).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('INFORMACIÓN DEL CLIENTE', startX + 8, currentY + 5);

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('SALDO DISPONIBLE EN GALONES:', startX + 350, currentY + 5, { width: 194, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(`${parseFloat(data.total_balance_galones || 0).toFixed(4)} gal.`, startX + 350, currentY + 16, { width: 194, align: 'right' });

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b').text(entityName, startX + 8, currentY + 16, { width: 340, truncate: true });
    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    doc.text(`NIT/DUI: ${entityNit}    |    NRC: ${entityNrc}    |    Tel: ${entityPhone}    |    Correo: ${entityEmail}`, startX + 8, currentY + 27, { width: 340, truncate: true });

    currentY += 48;

    const colWidths = { fecha: 55, doc: 85, concepto: 162, galones: 60, cargo: 60, abono: 60, saldo: 70 };
    const colX = {
        fecha: startX,
        doc: startX + colWidths.fecha,
        concepto: startX + colWidths.fecha + colWidths.doc,
        galones: startX + colWidths.fecha + colWidths.doc + colWidths.concepto,
        cargo: startX + colWidths.fecha + colWidths.doc + colWidths.concepto + colWidths.galones,
        abono: startX + colWidths.fecha + colWidths.doc + colWidths.concepto + colWidths.galones + colWidths.cargo,
        saldo: startX + colWidths.fecha + colWidths.doc + colWidths.concepto + colWidths.galones + colWidths.cargo + colWidths.abono
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + contentWidth, y + 14).stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('CONCEPTO', colX.concepto + 2, y + 3, { width: colWidths.concepto - 4 });
        doc.text('GALONES', colX.galones, y + 3, { width: colWidths.galones - 4, align: 'right' });
        doc.text('GAL (+)', colX.cargo, y + 3, { width: colWidths.cargo - 4, align: 'right' });
        doc.text('GAL (-)', colX.abono, y + 3, { width: colWidths.abono - 4, align: 'right' });
        doc.text('SALDO GAL', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const movements = data.movements || [];
    let totalGalonesCargo = 0;
    let totalGalonesAbono = 0;

    movements.forEach(m => {
        const cargoGal = parseFloat(m.galones_cargo || 0);
        const abonoGal = parseFloat(m.galones_abono || 0);
        const balanceGal = parseFloat(m.balance_galones || 0);
        const galones = parseFloat(m.galones || 0);
        totalGalonesCargo += cargoGal;
        totalGalonesAbono += abonoGal;
        const docText = `${m.tipo || ''} ${m.numero || ''}`.trim() || '—';
        const conceptoText = String(m.concepto || '—');

        doc.fontSize(7).font('Helvetica');
        const conceptHeight = doc.heightOfString(conceptoText, { width: colWidths.concepto - 4 });
        const docHeight = doc.heightOfString(docText, { width: colWidths.doc - 4 });
        const rowHeight = Math.max(13, Math.ceil(conceptHeight) + 3, Math.ceil(docHeight) + 3);

        if (currentY + rowHeight > 700) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(m.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(docText, colX.doc + 2, currentY, { width: colWidths.doc - 4 });
        doc.text(conceptoText, colX.concepto + 2, currentY, { width: colWidths.concepto - 4 });
        doc.text(galones > 0 ? galones.toFixed(4) : '-', colX.galones, currentY, { width: colWidths.galones - 4, align: 'right' });
        doc.text(cargoGal > 0 ? cargoGal.toFixed(4) : '-', colX.cargo, currentY, { width: colWidths.cargo - 4, align: 'right' });
        doc.text(abonoGal > 0 ? abonoGal.toFixed(4) : '-', colX.abono, currentY, { width: colWidths.abono - 4, align: 'right' });
        doc.text(balanceGal.toFixed(4), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

        currentY += rowHeight;
    });

    if (currentY > 655) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    // Totales en galones
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES EN GALONES:', colX.concepto, currentY, { width: colWidths.concepto - 4, align: 'right' });
    doc.text('-', colX.galones, currentY, { width: colWidths.galones - 4, align: 'right' });
    doc.text(totalGalonesCargo > 0 ? totalGalonesCargo.toFixed(4) : '-', colX.cargo, currentY, { width: colWidths.cargo - 4, align: 'right' });
    doc.text(totalGalonesAbono > 0 ? totalGalonesAbono.toFixed(4) : '-', colX.abono, currentY, { width: colWidths.abono - 4, align: 'right' });
    doc.text(parseFloat(data.total_balance_galones || 0).toFixed(4), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 13;
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 8;

    // Resumen de montos monetarios
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text('RESUMEN DE MONTOS MONETARIOS:', startX, currentY);
    currentY += 11;
    doc.fontSize(7).font('Helvetica').fillColor('#334155');
    doc.text(`Total recargado: ${reportPdfHelper.fmt(data.total_recargado)}    |    Total despachado: ${reportPdfHelper.fmt(data.total_despachado)}`, startX, currentY);
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, movements.length, 'Movimientos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF buffer for a customer/provider aging report
 */
const generateAgingPDF = async (data, isProvider = false) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = isProvider ? 'ANTIGÜEDAD DE SALDOS (PROVEEDORES)' : 'ANTIGÜEDAD DE SALDOS (CLIENTES)';
    const entityLabel = isProvider ? 'PROVEEDOR' : 'CLIENTE';
    const entityName = isProvider ? (data.provider_name || 'N/A') : (data.customer_name || 'N/A');
    const subtitle = `${entityLabel}: ${entityName}`;
    const periodText = `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;

    // Entity Info Card
    const entityTitle = isProvider ? 'INFORMACIÓN DEL PROVEEDOR' : 'INFORMACIÓN DEL CLIENTE';
    const entityEmail = isProvider ? (data.provider_email || '—') : (data.customer_email || '—');
    const entityNit = isProvider ? (data.provider_nit || data.nit || '—') : (data.customer_nit || data.customer_dui || data.nit || '—');
    const entityNrc = isProvider ? (data.provider_nrc || data.nrc || '—') : (data.customer_nrc || data.nrc || '—');
    const entityPhone = isProvider ? (data.provider_phone || data.telefono || '—') : (data.customer_phone || data.telefono || '—');

    doc.rect(startX, currentY, contentWidth, 32).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text(entityTitle, startX + 8, currentY + 5);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(entityName, startX + 8, currentY + 16, { width: 450, truncate: true });

    const balLabel = isProvider ? 'TOTAL SALDO PENDIENTE (PROVEEDOR):' : 'TOTAL SALDO PENDIENTE (CLIENTE):';
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(balLabel, startX + 480, currentY + 5, { width: 244, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(data.total_balance), startX + 480, currentY + 15, { width: 244, align: 'right' });

    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    doc.text(`NIT/DUI: ${entityNit}    |    NRC: ${entityNrc}    |    Tel: ${entityPhone}    |    Correo: ${entityEmail}`, startX + 160, currentY + 5, { width: 320, truncate: true });

    currentY += 38;

    const colWidths = { fecha: 65, doc: 95, tipo: 82, b1: 70, b2: 70, b3: 70, b4: 70, b5: 70, b6: 70, total: 70 };
    const colX = {
        fecha: startX,
        doc: startX + colWidths.fecha,
        tipo: startX + colWidths.fecha + colWidths.doc,
        b1: startX + colWidths.fecha + colWidths.doc + colWidths.tipo,
        b2: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1,
        b3: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2,
        b4: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3,
        b5: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3 + colWidths.b4,
        b6: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3 + colWidths.b4 + colWidths.b5,
        total: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3 + colWidths.b4 + colWidths.b5 + colWidths.b6
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + contentWidth, y + 14).stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('TIPO', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4 });
        doc.text('0-30 DÍAS', colX.b1, y + 3, { width: colWidths.b1 - 4, align: 'right' });
        doc.text('31-60 DÍAS', colX.b2, y + 3, { width: colWidths.b2 - 4, align: 'right' });
        doc.text('61-90 DÍAS', colX.b3, y + 3, { width: colWidths.b3 - 4, align: 'right' });
        doc.text('91-180 DÍAS', colX.b4, y + 3, { width: colWidths.b4 - 4, align: 'right' });
        doc.text('181-365 DÍAS', colX.b5, y + 3, { width: colWidths.b5 - 4, align: 'right' });
        doc.text('+365 DÍAS', colX.b6, y + 3, { width: colWidths.b6 - 4, align: 'right' });
        doc.text('TOTAL SALDO', colX.total, y + 3, { width: colWidths.total - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const documents = data.documents || [];
    documents.forEach(docRow => {
        if (currentY > 520) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const d0 = parseFloat(docRow.d0_30 || 0);
        const d31 = parseFloat(docRow.d31_60 || 0);
        const d61 = parseFloat(docRow.d61_90 || 0);
        const d91 = parseFloat(docRow.d91_180 || 0);
        const d181 = parseFloat(docRow.d181_365 || 0);
        const d365 = parseFloat(docRow.d365_plus || 0);
        const docSaldo = parseFloat(docRow.saldo_pendiente != null ? docRow.saldo_pendiente : (d0 + d31 + d61 + d91 + d181 + d365));

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(docRow.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(String(docRow.documento || '—'), colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true });
        doc.text(String(docRow.tipo || '—'), colX.tipo + 2, currentY, { width: colWidths.tipo - 4, truncate: true });
        doc.text(reportPdfHelper.fmt(d0), colX.b1, currentY, { width: colWidths.b1 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(d31), colX.b2, currentY, { width: colWidths.b2 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(d61), colX.b3, currentY, { width: colWidths.b3 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(d91), colX.b4, currentY, { width: colWidths.b4 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(d181), colX.b5, currentY, { width: colWidths.b5 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(d365), colX.b6, currentY, { width: colWidths.b6 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(docSaldo), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 505) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    // Fila de totales
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', colX.tipo, currentY, { width: colWidths.tipo - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.totals?.t0_30), colX.b1, currentY, { width: colWidths.b1 - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.totals?.t31_60), colX.b2, currentY, { width: colWidths.b2 - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.totals?.t61_90), colX.b3, currentY, { width: colWidths.b3 - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.totals?.t91_180), colX.b4, currentY, { width: colWidths.b4 - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.totals?.t181_365), colX.b5, currentY, { width: colWidths.b5 - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.totals?.t365_plus), colX.b6, currentY, { width: colWidths.b6 - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.total_balance), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
    currentY += 13;
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 16;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, documents.length, 'Documentos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateProviderAgingPDF = (data) => generateAgingPDF(data, true);


// --- BALANCES Y RECIBOS DE PAGO ---
/**
 * Generates a PDF for Customer Balances Report
 */
const generateCustomerBalancesPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE SALDOS DE CLIENTES';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `FECHA DE CORTE: ${reportPdfHelper.formatDate(data.endDate || new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = { id: 45, nombre: 327, doc: 130, nrc: 100, saldo: 130 };
    const colX = {
        id: startX,
        nombre: startX + colWidths.id,
        doc: startX + colWidths.id + colWidths.nombre,
        nrc: startX + colWidths.id + colWidths.nombre + colWidths.doc,
        saldo: startX + colWidths.id + colWidths.nombre + colWidths.doc + colWidths.nrc
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('ID', colX.id + 2, y + 3, { width: colWidths.id - 4 });
        doc.text('CLIENTE', colX.nombre + 2, y + 3, { width: colWidths.nombre - 4 });
        doc.text('DUI / NIT', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('NRC', colX.nrc + 2, y + 3, { width: colWidths.nrc - 4 });
        doc.text('SALDO PENDIENTE', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const items = data.items || [];
    items.forEach(item => {
        if (currentY > 540) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(String(item.id || ''), colX.id + 2, currentY, { width: colWidths.id - 4 });
        doc.text(String(item.nombre || '—'), colX.nombre + 2, currentY, { width: colWidths.nombre - 4, truncate: true });
        doc.text(String(item.dui_nit || '—'), colX.doc + 2, currentY, { width: colWidths.doc - 4 });
        doc.text(String(item.nrc || '—'), colX.nrc + 2, currentY, { width: colWidths.nrc - 4 });
        doc.text(reportPdfHelper.fmt(item.saldo), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL CARTERA CLIENTES:', colX.nrc, currentY, { width: colWidths.nrc - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.total_general), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, items.length, 'Clientes');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF for Provider Balances Report
 */
const generateProviderBalancesPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE SALDOS DE PROVEEDORES';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `FECHA DE CORTE: ${reportPdfHelper.formatDate(data.endDate || new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = { id: 45, nombre: 327, doc: 130, nrc: 100, saldo: 130 };
    const colX = {
        id: startX,
        nombre: startX + colWidths.id,
        doc: startX + colWidths.id + colWidths.nombre,
        nrc: startX + colWidths.id + colWidths.nombre + colWidths.doc,
        saldo: startX + colWidths.id + colWidths.nombre + colWidths.doc + colWidths.nrc
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('ID', colX.id + 2, y + 3, { width: colWidths.id - 4 });
        doc.text('PROVEEDOR', colX.nombre + 2, y + 3, { width: colWidths.nombre - 4 });
        doc.text('NIT / DUI', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('NRC', colX.nrc + 2, y + 3, { width: colWidths.nrc - 4 });
        doc.text('SALDO PENDIENTE', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const items = data.items || [];
    items.forEach(item => {
        if (currentY > 540) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(String(item.id || ''), colX.id + 2, currentY, { width: colWidths.id - 4 });
        doc.text(String(item.nombre || '—'), colX.nombre + 2, currentY, { width: colWidths.nombre - 4, truncate: true });
        doc.text(String(item.dui_nit || '—'), colX.doc + 2, currentY, { width: colWidths.doc - 4 });
        doc.text(String(item.nrc || '—'), colX.nrc + 2, currentY, { width: colWidths.nrc - 4 });
        doc.text(reportPdfHelper.fmt(item.saldo), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL DEUDA PROVEEDORES:', colX.nrc, currentY, { width: colWidths.nrc - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.total_general), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, items.length, 'Proveedores');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF buffer for a customer payment receipt
 */
const generatePaymentReceiptPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            // --- Logo Handling ---
            const logoPath = data.branch_logo_url || data.company_logo_url;
            if (logoPath) {
                try {
                    // Extract filament name from /uploads/filename.ext
                    const fileName = logoPath.split('/').pop();
                    const absoluteLogoPath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    
                    if (fs.existsSync(absoluteLogoPath)) {
                        doc.image(absoluteLogoPath, 40, 40, { width: 80 });
                    }
                } catch (e) {
                    console.error('[PDF Service] Error loading logo:', e.message);
                }
            }

            // --- Header Info ---
            const headerX = logoPath ? 130 : 40;
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name, headerX, 40);
            doc.fontSize(10).font('Helvetica').text(data.branch_name, headerX, 60);
            if (data.company_nit) doc.text(`NIT: ${data.company_nit}`, headerX, 72);
            doc.fontSize(14).font('Helvetica-Bold').text('RECIBO DE INGRESO', 400, 40, { align: 'right' });
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#4f46e5').text(`No. ${String(data.id).padStart(6, '0')}`, 400, 55, { align: 'right' });
            doc.fillColor('black');
            doc.moveDown(5);

            // --- Receipt Body ---
            const bodyTop = doc.y;
            doc.rect(40, bodyTop, 532, 100).stroke('#e5e7eb');
            
            doc.fontSize(10).font('Helvetica-Bold').text('RECIBIMOS DE:', 55, bodyTop + 15);
            doc.font('Helvetica').text(data.customer_name.toUpperCase(), 150, bodyTop + 15);
            
            doc.font('Helvetica-Bold').text('LA CANTIDAD DE:', 55, bodyTop + 35);
            doc.font('Helvetica').text(`$${parseFloat(data.monto).toFixed(2)}`, 150, bodyTop + 35);
            
            doc.font('Helvetica-Bold').text('FECHA DE PAGO:', 55, bodyTop + 55);
            doc.font('Helvetica').text(new Date(data.fecha_pago).toLocaleDateString('es-SV'), 150, bodyTop + 55);
 
            const payInfo = `METODO: ${data.metodo_pago?.toUpperCase() || ''} ${data.referencia ? ` - REF: ${data.referencia.toUpperCase()}` : ''}`;
            doc.font('Helvetica-Bold').text('INFORMACIÓN:', 55, bodyTop + 75);
            doc.font('Helvetica').text(payInfo, 150, bodyTop + 75);

            doc.moveDown(3);
            
            // --- Documents Table ---
            doc.fontSize(10).font('Helvetica-Bold').text('DETALLE DE DOCUMENTOS ABONADOS:', 40, doc.y);
            doc.moveDown(0.5);
            
            const tableTop = doc.y;
            const colWidths = { fecha: 80, doc: 180, total: 130, abono: 130 };
            
            // Table Header
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
            let trx = 40;
            doc.text('FECHA DOC.', trx, tableTop); trx += colWidths.fecha;
            doc.text('DOCUMENTO', trx, tableTop); trx += colWidths.doc;
            doc.text('MONTO DOC.', trx, tableTop, { align: 'right', width: colWidths.total }); trx += colWidths.total;
            doc.text('MONTO ABONO', trx, tableTop, { align: 'right', width: colWidths.abono });
            
            doc.moveDown(0.3);
            doc.moveTo(40, doc.y).lineTo(572, doc.y).strokeColor('#e5e7eb').stroke();
            doc.moveDown(0.5);
            doc.fillColor('black').font('Helvetica').fontSize(9);

            if (data.documentos && data.documentos.length > 0) {
                data.documentos.forEach(docItem => {
                    const y = doc.y;
                    let x = 40;
                    
                    const fDate = docItem.fecha ? new Date(docItem.fecha).toLocaleDateString('es-SV') : '---';
                    doc.text(fDate, x, y); x += colWidths.fecha;
                    
                    const docLabel = `${docItem.tipo || ''} ${docItem.numero || ''}`.trim();
                    doc.text(docLabel, x, y, { width: colWidths.doc, truncate: true }); x += colWidths.doc;
                    
                    doc.text(`$${parseFloat(docItem.total || 0).toFixed(2)}`, x, y, { align: 'right', width: colWidths.total }); x += colWidths.total;
                    doc.text(`$${parseFloat(docItem.abono || 0).toFixed(2)}`, x, y, { align: 'right', width: colWidths.abono });
                    
                    doc.moveDown(0.8);
                });
            } else {
                // Fallback for single document backward compatibility
                const concepto = data.documento_aplicado 
                    ? `ABONO A DOCUMENTO ${data.documento_tipo || ''} ${data.documento_aplicado}` 
                    : 'ABONO A CUENTA';
                doc.text(concepto, 40, doc.y);
                doc.moveDown();
            }

            if (data.notas) {
                doc.moveDown();
                doc.fontSize(9).font('Helvetica-Bold').text('NOTAS:', 40, doc.y);
                doc.font('Helvetica').text(data.notas, 80, doc.y - 10, { width: 490 });
            }

            // --- Footer / Signatures ---
            doc.moveDown(10);
            const footerY = doc.y;
            doc.moveTo(80, footerY).lineTo(250, footerY).stroke();
            doc.fontSize(9).text('ENTREGADO POR', 125, footerY + 5, { align: 'center', width: 100 });

            doc.moveTo(350, footerY).lineTo(520, footerY).stroke();
            doc.fontSize(9).text('RECIBIDO CONFORME (CLIENTE)', 385, footerY + 5, { align: 'center', width: 100 });

            doc.fontSize(8).fillColor('grey').text('Este documento es un comprobante de abono a su cuenta pendiente.', 40, 720, { align: 'center', width: 532 });
            
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

// --- DOCUMENTOS PENDIENTES DETALLADOS ---
/**
 * Generates a detailed PDF of pending documents grouped by customer
 */
const generatePendingDocumentsDetailedPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = 'REPORTE DETALLADO DE DOCUMENTOS PENDIENTES';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `FECHA DE CORTE: ${reportPdfHelper.formatDate(data.cutoffDate || new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;
    const colWidths = { fecha: 65, dias: 40, tipo: 100, doc: 147, monto: 100, saldo: 100 };
    const colX = {
        fecha: startX,
        dias: startX + colWidths.fecha,
        tipo: startX + colWidths.fecha + colWidths.dias,
        doc: startX + colWidths.fecha + colWidths.dias + colWidths.tipo,
        monto: startX + colWidths.fecha + colWidths.dias + colWidths.tipo + colWidths.doc,
        saldo: startX + colWidths.fecha + colWidths.dias + colWidths.tipo + colWidths.doc + colWidths.monto
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('DÍAS', colX.dias, y + 3, { width: colWidths.dias, align: 'center' });
        doc.text('TIPO', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4 });
        doc.text('DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('MONTO ORIG.', colX.monto, y + 3, { width: colWidths.monto - 4, align: 'right' });
        doc.text('SALDO PEND.', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const customers = data.customers || [];
    let count = 0;

    customers.forEach((customer) => {
        if (currentY > 690) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`CLIENTE: ${(customer.customer_name || 'SIN NOMBRE').toUpperCase()}`, startX + 4, currentY + 3);
        currentY += 16;

        (customer.documents || []).forEach(row => {
            if (currentY > 710) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
                currentY = drawTableHeader(currentY);
                doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(`CLIENTE: ${(customer.customer_name || 'SIN NOMBRE').toUpperCase()} (cont.)`, startX + 4, currentY + 3);
                currentY += 16;
            }

            doc.fontSize(7).font('Helvetica').fillColor('#334155');
            doc.text(reportPdfHelper.formatDate(row.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
            doc.text(String(row.dias || 0), colX.dias, currentY, { width: colWidths.dias, align: 'center' });
            doc.text(String(row.tipo || '—'), colX.tipo + 2, currentY, { width: colWidths.tipo - 4, truncate: true });
            doc.text(String(row.documento || '—'), colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true });
            doc.text(reportPdfHelper.fmt(row.monto), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });
            doc.text(reportPdfHelper.fmt(row.saldo), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

            count++;
            currentY += 12;
        });

        // Subtotal cliente
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
        currentY += 3;
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`Subtotal ${customer.customer_name}:`, colX.tipo, currentY, { width: colWidths.tipo + colWidths.doc + colWidths.monto - 6, align: 'right' });
        doc.text(reportPdfHelper.fmt(customer.subtotal), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
        currentY += 14;
    });

    if (currentY > 690) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL GENERAL PENDIENTE:', colX.tipo, currentY, { width: colWidths.tipo + colWidths.doc + colWidths.monto - 6, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.grandTotal), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, count, 'Documentos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a detailed PDF of pending documents for providers grouped by provider
 */
const generateProviderPendingDocumentsDetailedPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = 'REPORTE DETALLADO DE DOCUMENTOS POR PAGAR';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `FECHA DE CORTE: ${reportPdfHelper.formatDate(data.cutoffDate || new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;
    const colWidths = { fecha: 65, origen: 55, dias: 35, tipo: 95, doc: 112, monto: 95, saldo: 95 };
    const colX = {
        fecha: startX,
        origen: startX + colWidths.fecha,
        dias: startX + colWidths.fecha + colWidths.origen,
        tipo: startX + colWidths.fecha + colWidths.origen + colWidths.dias,
        doc: startX + colWidths.fecha + colWidths.origen + colWidths.dias + colWidths.tipo,
        monto: startX + colWidths.fecha + colWidths.origen + colWidths.dias + colWidths.tipo + colWidths.doc,
        saldo: startX + colWidths.fecha + colWidths.origen + colWidths.dias + colWidths.tipo + colWidths.doc + colWidths.monto
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('ORIGEN', colX.origen + 2, y + 3, { width: colWidths.origen - 4 });
        doc.text('DÍAS', colX.dias, y + 3, { width: colWidths.dias, align: 'center' });
        doc.text('TIPO', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4 });
        doc.text('DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('MONTO ORIG.', colX.monto, y + 3, { width: colWidths.monto - 4, align: 'right' });
        doc.text('SALDO PEND.', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const providers = data.providers || [];
    let count = 0;

    providers.forEach((provider) => {
        if (currentY > 690) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`PROVEEDOR: ${(provider.provider_name || 'SIN NOMBRE').toUpperCase()}`, startX + 4, currentY + 3);
        currentY += 16;

        (provider.documents || []).forEach(row => {
            if (currentY > 710) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
                currentY = drawTableHeader(currentY);
                doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(`PROVEEDOR: ${(provider.provider_name || 'SIN NOMBRE').toUpperCase()} (cont.)`, startX + 4, currentY + 3);
                currentY += 16;
            }

            doc.fontSize(7).font('Helvetica').fillColor('#334155');
            doc.text(reportPdfHelper.formatDate(row.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
            doc.text(row.origen || '---', colX.origen + 2, currentY, { width: colWidths.origen - 4 });
            doc.text(String(row.dias || 0), colX.dias, currentY, { width: colWidths.dias, align: 'center' });
            doc.text(String(row.tipo || '—'), colX.tipo + 2, currentY, { width: colWidths.tipo - 4, truncate: true });
            doc.text(String(row.documento || '—'), colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true });
            doc.text(reportPdfHelper.fmt(row.monto), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });
            doc.text(reportPdfHelper.fmt(row.saldo), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

            count++;
            currentY += 12;
        });

        // Subtotal proveedor
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
        currentY += 3;
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`Subtotal ${provider.provider_name}:`, colX.tipo, currentY, { width: colWidths.tipo + colWidths.doc + colWidths.monto - 6, align: 'right' });
        doc.text(reportPdfHelper.fmt(provider.subtotal), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
        currentY += 14;
    });

    if (currentY > 690) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL GENERAL PENDIENTE:', colX.tipo, currentY, { width: colWidths.tipo + colWidths.doc + colWidths.monto - 6, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.grandTotal), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, count, 'Documentos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

// --- RECIBOS DE ANTICIPO DE CLIENTE ---
/**
 * Generates a PDF buffer for a gas station customer advance payment receipt
 */
const generateAdvanceReceiptPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                layout: 'portrait',
                margins: { top: 35, bottom: 35, left: 35, right: 35 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', b => buffers.push(b));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', err => reject(err));

            const startX = 35;
            const contentWidth = 542; // 612 - 70

            // 1. --- LOGO Y ENCABEZADO EMPRESA ---
            const logoPath = data.branch_logo_url || data.company_logo_url;
            let logoDrawn = false;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absoluteLogoPath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absoluteLogoPath)) {
                        doc.image(absoluteLogoPath, startX, 35, { fit: [95, 60], align: 'left', valign: 'center' });
                        logoDrawn = true;
                    }
                } catch (e) {
                    console.error('[Advance Receipt PDF] Error loading logo:', e.message);
                }
            }

            const headerLeftX = logoDrawn ? startX + 105 : startX;
            const companyBoxW = logoDrawn ? 260 : 365;

            // Datos de la empresa / sucursal
            const companyName = (data.company_name || 'ESTACIÓN DE SERVICIO').toUpperCase();
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
               .text(companyName, headerLeftX, 35, { width: companyBoxW, ellipsis: true });

            let curY = doc.y + 2;

            doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
            const taxParts = [];
            if (data.company_nit && data.company_nit !== '---') taxParts.push(`NIT: ${data.company_nit}`);
            if (data.company_nrc && data.company_nrc !== '---') taxParts.push(`NRC: ${data.company_nrc}`);
            if (taxParts.length > 0) {
                doc.text(taxParts.join('  •  '), headerLeftX, curY, { width: companyBoxW });
                curY = doc.y + 1;
            }

            const branchName = data.branch_name || 'Estación Central';
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
               .text(`SUCURSAL: ${branchName.toUpperCase()}`, headerLeftX, curY, { width: companyBoxW });
            curY = doc.y + 1;

            const addr = data.branch_direccion || data.company_direccion;
            if (addr) {
                doc.font('Helvetica').fontSize(7).fillColor('#64748b')
                   .text(addr, headerLeftX, curY, { width: companyBoxW, maxLines: 2 });
                curY = doc.y + 1;
            }

            const phone = data.branch_telefono || data.company_telefono;
            if (phone) {
                doc.font('Helvetica').fontSize(7).fillColor('#64748b')
                   .text(`Tel: ${phone}`, headerLeftX, curY, { width: companyBoxW });
            }

            // --- RECUADRO SUPERIOR DERECHO: TÍTULO Y CORRELATIVO ---
            const badgeW = 165;
            const badgeX = startX + contentWidth - badgeW;
            const badgeY = 35;
            const badgeH = 68;

            // Recuadro contenedor
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6)
               .lineWidth(1).strokeColor('#4f46e5').stroke();

            // Cabecera del recuadro
            doc.roundedRect(badgeX, badgeY, badgeW, 20, 6).fill('#4f46e5');
            doc.rect(badgeX, badgeY + 12, badgeW, 8).fill('#4f46e5');

            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
               .text('RECIBO DE ANTICIPO', badgeX, badgeY + 5, { width: badgeW, align: 'center' });

            // Número de Anticipo
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b')
               .text('NO. ANTICIPO', badgeX, badgeY + 24, { width: badgeW, align: 'center' });

            doc.font('Helvetica-Bold').fontSize(13).fillColor('#4f46e5')
               .text(`No. ${data.numero || String(data.id).padStart(6, '0')}`, badgeX, badgeY + 34, { width: badgeW, align: 'center' });

            // Fecha
            const fechaStr = reportPdfHelper.formatDate(data.fecha);
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a')
               .text(`FECHA: ${fechaStr}`, badgeX, badgeY + 52, { width: badgeW, align: 'center' });

            // 2. --- LÍNEA DIVISORIA DE ENCABEZADO ---
            const lineY = Math.max(curY + 8, badgeY + badgeH + 10);
            doc.moveTo(startX, lineY).lineTo(startX + contentWidth, lineY)
               .lineWidth(0.75).strokeColor('#e2e8f0').stroke();

            // 3. --- RECUADRO DATOS DEL CLIENTE ---
            const clientBoxY = lineY + 8;
            const clientBoxH = 58;

            doc.roundedRect(startX, clientBoxY, contentWidth, clientBoxH, 6)
               .fillAndStroke('#f8fafc', '#e2e8f0');

            const clientPadX = startX + 12;
            const clientPadY = clientBoxY + 8;

            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#64748b')
               .text('RECIBIMOS DE (CLIENTE):', clientPadX, clientPadY);

            const clientName = (data.cliente_nombre || data.customer_nombre || 'CLIENTE GENERAL').toUpperCase();
            doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#0f172a')
               .text(clientName, clientPadX, clientPadY + 11, { width: 330, ellipsis: true });

            const clientAddr = data.customer_direccion;
            if (clientAddr) {
                doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
                   .text(`Dirección: ${clientAddr}`, clientPadX, clientPadY + 25, { width: 330, maxLines: 2 });
            }

            // Datos fiscales del cliente en la columna derecha
            const clientTaxX = startX + 355;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569');
            
            const nrcText = data.nrc && data.nrc !== '---' ? data.nrc : '---';
            const nitText = data.nit && data.nit !== '---' ? data.nit : '---';
            doc.text('NRC: ', clientTaxX, clientPadY + 11, { continued: true })
               .font('Helvetica').text(nrcText);

            doc.font('Helvetica-Bold').text('NIT/DUI: ', clientTaxX, clientPadY + 23, { continued: true })
               .font('Helvetica').text(nitText);

            if (data.customer_telefono) {
                doc.font('Helvetica-Bold').text('Teléfono: ', clientTaxX, clientPadY + 35, { continued: true })
                   .font('Helvetica').text(data.customer_telefono);
            }

            // 4. --- RECUADRO DE MONTO RECIBIDO Y CANTIDAD EN LETRAS ---
            const amountBoxY = clientBoxY + clientBoxH + 8;
            const amountBoxH = 48;

            doc.roundedRect(startX, amountBoxY, contentWidth, amountBoxH, 6)
               .fillAndStroke('#eef2ff', '#c7d2fe');

            // Columna Izquierda: Cantidad en letras
            const amtPadX = startX + 12;
            const amtPadY = amountBoxY + 8;

            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#4f46e5')
               .text('POR LA CANTIDAD DE:', amtPadX, amtPadY);

            const montoTotal = parseFloat(data.monto) || 0;
            const letras = numberToWords(montoTotal);
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b')
               .text(letras, amtPadX, amtPadY + 12, { width: 360, leading: 2 });

            // Columna Derecha: Monto en Números
            const bigAmtX = startX + contentWidth - 160;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#4f46e5')
               .text('TOTAL RECIBIDO', bigAmtX, amtPadY, { width: 148, align: 'right' });

            doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e1b4b')
               .text(`$ ${montoTotal.toFixed(2)}`, bigAmtX, amtPadY + 11, { width: 148, align: 'right' });

            // 5. --- CONCEPTO Y OBSERVACIONES ---
            let nextY = amountBoxY + amountBoxH + 10;
            doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
               .text('CONCEPTO / DESTINO DE FONDOS:', startX, nextY);

            doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
               .text('Anticipo de fondos para consumo y suministro de combustibles (Gasolina / Diésel) y lubricantes en estación de servicio.', startX, nextY + 11, { width: contentWidth });

            nextY = doc.y + 4;

            if (data.notas && data.notas.trim()) {
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#334155')
                   .text('NOTAS / OBSERVACIONES:', startX, nextY);
                doc.font('Helvetica').fontSize(8).fillColor('#0f172a')
                   .text(data.notas.trim(), startX, nextY + 11, { width: contentWidth });
                nextY = doc.y + 6;
            } else {
                nextY += 4;
            }

            // 6. --- TABLA DE DESGLOSE DE FORMAS DE PAGO RECIBIDAS ---
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
               .text('DESGLOSE DE FORMAS DE PAGO RECIBIDAS:', startX, nextY);
            nextY = doc.y + 5;

            const tableHdrY = nextY;
            const tableHdrH = 18;

            doc.rect(startX, tableHdrY, contentWidth, tableHdrH).fill('#f1f5f9');
            doc.moveTo(startX, tableHdrY).lineTo(startX + contentWidth, tableHdrY).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.moveTo(startX, tableHdrY + tableHdrH).lineTo(startX + contentWidth, tableHdrY + tableHdrH).lineWidth(0.5).strokeColor('#cbd5e1').stroke();

            const colW1 = 140;
            const colW2 = 252;
            const colW3 = 150;

            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155');
            doc.text('FORMA DE PAGO', startX + 10, tableHdrY + 5, { width: colW1 });
            doc.text('REFERENCIA / NO. DOCUMENTO / AUTORIZACIÓN', startX + colW1 + 10, tableHdrY + 5, { width: colW2 });
            doc.text('MONTO RECIBIDO ($)', startX + colW1 + colW2, tableHdrY + 5, { width: colW3 - 10, align: 'right' });

            let rowY = tableHdrY + tableHdrH;

            const ef = parseFloat(data.efectivo) || 0;
            const tj = parseFloat(data.tarjeta) || 0;
            const ch = parseFloat(data.cheque) || 0;
            const tr = parseFloat(data.transferencia) || 0;

            const paymentRows = [];
            if (ef > 0) {
                paymentRows.push({
                    metodo: 'EFECTIVO',
                    ref: 'Pago en efectivo recibido en caja',
                    monto: ef
                });
            }
            if (tj > 0) {
                paymentRows.push({
                    metodo: 'TARJETA (DÉBITO / CRÉDITO)',
                    ref: data.tarjeta_referencia ? `Autorización / Ref: ${data.tarjeta_referencia}` : 'Terminal POS',
                    monto: tj
                });
            }
            if (ch > 0) {
                paymentRows.push({
                    metodo: 'CHEQUE',
                    ref: data.cheque_referencia ? `No. Cheque: ${data.cheque_referencia}` : 'Cheque bancario',
                    monto: ch
                });
            }
            if (tr > 0) {
                paymentRows.push({
                    metodo: 'TRANSFERENCIA BANCARIA',
                    ref: data.transferencia_referencia ? `Comprobante / Ref: ${data.transferencia_referencia}` : 'Depósito / Transferencia',
                    monto: tr
                });
            }

            if (paymentRows.length === 0 && montoTotal > 0) {
                paymentRows.push({
                    metodo: 'EFECTIVO',
                    ref: 'Anticipo recibido en caja',
                    monto: montoTotal
                });
            }

            paymentRows.forEach((item, idx) => {
                const bg = idx % 2 === 1 ? '#f8fafc' : '#ffffff';
                doc.rect(startX, rowY, contentWidth, 18).fill(bg);

                doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
                   .text(item.metodo, startX + 10, rowY + 5, { width: colW1 });

                doc.font('Helvetica').fontSize(8).fillColor('#475569')
                   .text(item.ref, startX + colW1 + 10, rowY + 5, { width: colW2, ellipsis: true });

                doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
                   .text(`$ ${item.monto.toFixed(2)}`, startX + colW1 + colW2, rowY + 5, { width: colW3 - 10, align: 'right' });

                rowY += 18;
                doc.moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).lineWidth(0.5).strokeColor('#f1f5f9').stroke();
            });

            // Fila de Total de la Tabla
            doc.rect(startX, rowY, contentWidth, 20).fill('#f8fafc');
            doc.moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).lineWidth(0.75).strokeColor('#cbd5e1').stroke();

            doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a')
               .text('TOTAL PAGADO:', startX + colW1, rowY + 6, { width: colW2, align: 'right' });

            doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#4f46e5')
               .text(`$ ${montoTotal.toFixed(2)}`, startX + colW1 + colW2, rowY + 5, { width: colW3 - 10, align: 'right' });

            rowY += 20;
            doc.moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).lineWidth(0.75).strokeColor('#cbd5e1').stroke();

            // 7. --- RESUMEN DE SALDO DISPONIBLE Y CONSUMOS ---
            const balanceBoxY = rowY + 12;
            const balanceBoxH = 46;

            doc.roundedRect(startX, balanceBoxY, contentWidth, balanceBoxH, 6)
               .fillAndStroke('#ffffff', '#e2e8f0');

            const colBalanceW = contentWidth / 3;
            const disp = parseFloat(data.monto_disponible) || 0;
            const consumido = Math.max(0, Math.round((montoTotal - disp) * 100) / 100);

            // Col 1: Monto Anticipado
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b')
               .text('MONTO TOTAL ANTICIPADO', startX, balanceBoxY + 9, { width: colBalanceW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
               .text(`$ ${montoTotal.toFixed(2)}`, startX, balanceBoxY + 21, { width: colBalanceW, align: 'center' });

            // Línea vertical separadora 1
            doc.moveTo(startX + colBalanceW, balanceBoxY + 8).lineTo(startX + colBalanceW, balanceBoxY + balanceBoxH - 8)
               .lineWidth(0.5).strokeColor('#e2e8f0').stroke();

            // Col 2: Monto Consumido en Cierres
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#64748b')
               .text('TOTAL CONSUMIDO EN TURNOS', startX + colBalanceW, balanceBoxY + 9, { width: colBalanceW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#e11d48')
               .text(`$ ${consumido.toFixed(2)}`, startX + colBalanceW, balanceBoxY + 21, { width: colBalanceW, align: 'center' });

            // Línea vertical separadora 2
            doc.moveTo(startX + (colBalanceW * 2), balanceBoxY + 8).lineTo(startX + (colBalanceW * 2), balanceBoxY + balanceBoxH - 8)
               .lineWidth(0.5).strokeColor('#e2e8f0').stroke();

            // Col 3: Saldo Disponible Actual
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#059669')
               .text('SALDO DISPONIBLE ACTUAL', startX + (colBalanceW * 2), balanceBoxY + 9, { width: colBalanceW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#059669')
               .text(`$ ${disp.toFixed(2)}`, startX + (colBalanceW * 2), balanceBoxY + 20, { width: colBalanceW, align: 'center' });

            // 8. --- FIRMAS (ENTREGADO Y RECIBIDO) ---
            const sigY = balanceBoxY + balanceBoxH + 52;
            const sigLineW = 190;
            const sigLeftX = startX + 35;
            const sigRightX = startX + contentWidth - sigLineW - 35;

            // Línea izquierda: Cliente
            doc.moveTo(sigLeftX, sigY).lineTo(sigLeftX + sigLineW, sigY)
               .lineWidth(0.75).strokeColor('#94a3b8').stroke();

            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
               .text('ENTREGADO POR (CLIENTE)', sigLeftX, sigY + 5, { width: sigLineW, align: 'center' });
            doc.font('Helvetica').fontSize(7).fillColor('#64748b')
               .text('Nombre, Firma y DUI', sigLeftX, sigY + 16, { width: sigLineW, align: 'center' });

            // Línea derecha: Estación de Servicio
            doc.moveTo(sigRightX, sigY).lineTo(sigRightX + sigLineW, sigY)
               .lineWidth(0.75).strokeColor('#94a3b8').stroke();

            doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a')
               .text('RECIBIDO CONFORME (CAJERO / ESTACIÓN)', sigRightX, sigY + 5, { width: sigLineW, align: 'center' });
            doc.font('Helvetica').fontSize(7).fillColor('#64748b')
               .text('Nombre, Firma y Sello de Estación', sigRightX, sigY + 16, { width: sigLineW, align: 'center' });

            // 9. --- LEYENDA LEGAL Y PIE DE PÁGINA ---
            const footerY = 705;
            doc.moveTo(startX, footerY).lineTo(startX + contentWidth, footerY)
               .lineWidth(0.5).strokeColor('#e2e8f0').stroke();

            const disclaimer = 'Este recibo certifica la recepción efectiva de fondos en concepto de pago anticipado para consumo de combustibles en pista o productos de tienda. No constituye Documento Tributario Electrónico (DTE); el documento tributario fiscal correspondiente será emitido de conformidad con la normativa del Ministerio de Hacienda al momento del suministro y despacho.';
            doc.font('Helvetica-Oblique').fontSize(6.5).fillColor('#94a3b8')
               .text(disclaimer, startX, footerY + 6, { width: contentWidth, align: 'center', lineGap: 1.5 });

            const nowStr = new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' });
            doc.font('Helvetica').fontSize(6.5).fillColor('#94a3b8')
               .text(`Documento generado el ${nowStr} • Sipe Web SaaS Gasolinera`, startX, footerY + 28, { width: contentWidth, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};


module.exports = {
    generateStatementPDF,
    generateProviderStatementPDF,
    generateTrupputStatementPDF,
    generateAgingPDF,
    generateProviderAgingPDF,
    generateCustomerBalancesPDF,
    generateProviderBalancesPDF,
    generatePaymentReceiptPDF,
    generateAdvanceReceiptPDF,
    generatePendingDocumentsDetailedPDF,
    generateProviderPendingDocumentsDetailedPDF
};
