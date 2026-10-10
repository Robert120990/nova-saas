const reportPdfHelper = require('../../utils/reportPdfHelper');
const { resolveCompanyInfo } = require('./pdfUtils');

/**
 * Agrupa y consolida partidas de detalle por concepto normalizado para rangos multituron.
 */
function groupDetailItems(items, labelSuffix = '') {
    if (!items || items.length === 0) return [];
    const map = new Map();
    items.forEach(it => {
        let desc = (it.descripcion || it.description || 'SIN DESCRIPCION').trim();
        desc = desc.replace(/^#\d+\s+/, '').trim().toUpperCase();
        const amt = parseFloat(it.monto !== undefined ? it.monto : it.amount) || 0;
        if (!map.has(desc)) {
            map.set(desc, { descripcion: desc, count: 1, monto: amt });
        } else {
            const entry = map.get(desc);
            entry.count += 1;
            entry.monto += amt;
        }
    });

    return Array.from(map.values())
        .sort((a, b) => b.monto - a.monto)
        .map(entry => ({
            descripcion: entry.count > 1 && labelSuffix ? `${entry.descripcion} (${entry.count} ${labelSuffix})` : entry.descripcion,
            monto: entry.monto
        }));
}

function getTableHeight(count) {
    return 14 + 3 + (count === 0 ? 10 : count * 9) + 13;
}

/**
 * Helper para renderizar una tabla de detalle (Ingresos, Gastos, Tarjetas, Remesas, Puntos).
 */
function renderDetailTable(doc, title, items, startX, startY, width, colDef, totalLabel, totalVal) {
    const headerHeight = 14;
    doc.rect(startX, startY, width, headerHeight).fill('#f1f5f9');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(title.toUpperCase(), startX + 4, startY + 3.5, { width: width - 8 });

    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, startY + headerHeight).lineTo(startX + width, startY + headerHeight).stroke();

    let curY = startY + headerHeight + 3;
    const descWidth = width - colDef.amountWidth - 8;

    if (!items || items.length === 0) {
        doc.fontSize(6).font('Helvetica-Oblique').fillColor('#94a3b8');
        doc.text('Sin movimientos registrados', startX + 4, curY, { width: width - 8 });
        curY += 10;
    } else {
        doc.fontSize(6).font('Helvetica').fillColor('#0f172a');
        items.forEach(item => {
            if (curY > 700) return; // Salvaguarda estricta contra desbordes
            const desc = item.descripcion || item.description || '---';
            const amount = parseFloat(item.monto !== undefined ? item.monto : item.amount) || 0;
            doc.text(desc, startX + 4, curY, { width: descWidth, lineBreak: false, ellipsis: true });
            doc.text(reportPdfHelper.fmt(amount), startX + descWidth + 4, curY, { align: 'right', width: colDef.amountWidth, lineBreak: false });
            curY += 9;
        });
    }

    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, curY).lineTo(startX + width, curY).stroke();
    curY += 2;
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(totalLabel.toUpperCase(), startX + 4, curY, { width: descWidth, lineBreak: false, ellipsis: true });
    doc.text(reportPdfHelper.fmt(totalVal), startX + descWidth + 4, curY, { align: 'right', width: colDef.amountWidth });
    curY += 11;

    return curY;
}

/**
 * Renderiza la caja de "RESUMEN DE OPERACIONES" con la estructura idéntica al formato contable.
 */
function renderOperationsSummary(doc, totales, startX, startY, contentWidth) {
    const halfWidth = contentWidth / 2;
    const rowHeight = 14;
    const midX = startX + halfWidth;

    doc.rect(startX, startY, contentWidth, 16).fill('#f1f5f9');
    doc.strokeColor('#94a3b8').lineWidth(0.75).rect(startX, startY, contentWidth, 16).stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('RESUMEN DE OPERACIONES', startX, startY + 4, { align: 'center', width: contentWidth });

    const tableStartY = startY + 16;
    const labelW = halfWidth - 75;
    const valW = 68;

    const leftRows = [
        { label: 'TOTAL VENTA', val: totales.ventas, bold: false },
        { label: 'TOTAL INGRESOS', val: totales.ingresos, bold: false },
        { label: 'VENTAS + INGRESOS', val: (totales.ventas || 0) + (totales.ingresos || 0), bold: true },
        { label: 'TOTAL CONTADO', val: totales.contado, bold: true },
        { label: 'FONDO INICIAL', val: totales.fondo, bold: false }
    ];

    const rightRows = [
        { label: 'TOTAL TARJETAS', val: totales.tarjetas, bold: false },
        { label: 'TOTAL GASTOS', val: totales.gastos, bold: false },
        { label: 'TOTAL RETIRADO (PUNTOS)', val: totales.puntos, bold: false },
        { label: 'TOTAL REMESADO', val: totales.remesas, bold: false },
        { label: 'SALDO FINAL (ESPERADO)', val: totales.esperado, bold: true }
    ];

    let rowY = tableStartY;
    for (let i = 0; i < 5; i++) {
        if (i % 2 === 1) doc.rect(startX, rowY, contentWidth, rowHeight).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).stroke();

        const l = leftRows[i];
        doc.fontSize(6.8).font(l.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#1e293b');
        doc.text(l.label, startX + 6, rowY + 3.5, { width: labelW });
        doc.text(reportPdfHelper.fmt(l.val), startX + labelW + 4, rowY + 3.5, { align: 'right', width: valW });

        const r = rightRows[i];
        doc.fontSize(6.8).font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#1e293b');
        doc.text(r.label, midX + 6, rowY + 3.5, { width: labelW });
        doc.text(reportPdfHelper.fmt(r.val), midX + labelW + 4, rowY + 3.5, { align: 'right', width: valW });

        rowY += rowHeight;
    }

    doc.rect(startX, rowY, contentWidth, 18).fill('#f1f5f9');
    doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(startX, rowY).lineTo(startX + contentWidth, rowY).stroke();

    const diff = totales.diferencia || 0;
    const statusLabel = Math.abs(diff) < 0.01 ? 'CAJA CUADRADA' : (diff > 0 ? 'SOBRANTE DE CAJA' : 'FALTANTE DE CAJA');
    const statusColor = Math.abs(diff) < 0.01 ? '#047857' : (diff > 0 ? '#1d4ed8' : '#be123c');

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(statusColor);
    doc.text(`ESTADO: ${statusLabel}`, startX + 6, rowY + 5, { width: labelW + 20 });
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('DIFERENCIA', midX + 6, rowY + 5, { width: labelW });
    doc.fillColor(statusColor).text(reportPdfHelper.fmt(diff), midX + labelW + 4, rowY + 5, { align: 'right', width: valW });

    rowY += 18;
    const totalBoxHeight = rowY - startY;
    doc.strokeColor('#94a3b8').lineWidth(0.75).rect(startX, startY, contentWidth, totalBoxHeight).stroke();
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(midX, tableStartY).lineTo(midX, rowY).stroke();

    return rowY + 12;
}

/**
 * Generador unificado de Reporte de Arqueos / Corte de Tienda en PDF.
 */
const generateArqueosReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const isSingleShift = Array.isArray(data.data) && data.data.length === 1;
    const single = isSingleShift ? data.data[0] : null;

    const periodText = isSingleShift
        ? (single.fecha ? `CORTE DEL ${single.fecha}` : (data.start_date ? `CORTE DEL ${reportPdfHelper.formatDate(data.start_date)}` : 'CORTE DE TIENDA'))
        : ((data.start_date && data.end_date)
            ? `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`
            : 'TODOS LOS REGISTROS');

    const subtitle = data.branch_name ? `SUCURSAL: ${String(data.branch_name).toUpperCase()}` : null;
    const startX = 30;
    const contentWidth = 552;

    const drawHeader = () => {
        reportPdfHelper.renderHeader(doc, comp, 'CORTE DE TIENDA (ARQUEO DE CAJA)', periodText, 'portrait', subtitle);
    };

    drawHeader();

    // 1. Barra de Metadatos de Corte
    let curY = doc.y + 2;
    doc.rect(startX, curY, contentWidth, 24).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#475569');

    if (single) {
        doc.text('FECHA DE CORTE:', startX + 6, curY + 4, { width: 62 });
        doc.font('Helvetica').fillColor('#0f172a').text(single.fecha || '---', startX + 68, curY + 4, { width: 55 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('TURNO:', startX + 130, curY + 4, { width: 35 });
        doc.font('Helvetica').fillColor('#0f172a').text(String(single.turno || '0'), startX + 165, curY + 4, { width: 30 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('INICIAL (FONDO):', startX + 295, curY + 4, { width: 65 });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(single.fondo), startX + 360, curY + 4, { align: 'right', width: 50 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('FINAL (CONTADO):', startX + 420, curY + 4, { width: 70 });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(single.contado), startX + 490, curY + 4, { align: 'right', width: 56 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('POS / CAJERO:', startX + 6, curY + 13, { width: 60 });
        doc.font('Helvetica').fillColor('#0f172a').text(`${single.pos || 'POS'} — ${single.vendedor || '---'} (${single.estado || '---'})`, startX + 68, curY + 13, { width: 380, ellipsis: true });
    } else {
        doc.text('RANGO:', startX + 6, curY + 4, { width: 38 });
        doc.font('Helvetica').fillColor('#0f172a').text(periodText, startX + 44, curY + 4, { width: 145, ellipsis: true });
        doc.font('Helvetica-Bold').fillColor('#475569').text('TOTAL TURNOS:', startX + 195, curY + 4, { width: 65 });
        doc.font('Helvetica').fillColor('#0f172a').text(String(data.data?.length || 0), startX + 262, curY + 4, { width: 25 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('FONDO TOTAL:', startX + 295, curY + 4, { width: 65 });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(data.totales?.fondo), startX + 360, curY + 4, { align: 'right', width: 50 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('CONTADO TOTAL:', startX + 420, curY + 4, { width: 70 });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(data.totales?.contado), startX + 490, curY + 4, { align: 'right', width: 56 });
        doc.font('Helvetica-Bold').fillColor('#475569').text('SUCURSAL:', startX + 6, curY + 13, { width: 45 });
        doc.font('Helvetica').fillColor('#0f172a').text(data.branch_name || 'TODAS LAS SUCURSALES', startX + 52, curY + 13, { width: 360, ellipsis: true });
    }

    curY += 30;

    // 2. Si son múltiples turnos: Tabla de Resumen de Turnos
    const items = data.data || [];
    if (!isSingleShift && items.length > 0) {
        const tCols = { fecha: 65, turno: 28, pos: 65, vendedor: 95, fondo: 48, ventas: 58, esperado: 62, contado: 62, diferencia: 65 };
        const renderTurnosHeader = (y) => {
            doc.rect(startX, y, contentWidth, 12).fill('#f1f5f9');
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 12).lineTo(startX + contentWidth, y + 12).stroke();
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#0f172a');
            let tx = startX + 2;
            doc.text('FECHA', tx, y + 2.5, { width: tCols.fecha }); tx += tCols.fecha;
            doc.text('#', tx, y + 2.5, { width: tCols.turno }); tx += tCols.turno;
            doc.text('POS', tx, y + 2.5, { width: tCols.pos }); tx += tCols.pos;
            doc.text('RESPONSABLE', tx, y + 2.5, { width: tCols.vendedor }); tx += tCols.vendedor;
            doc.text('FONDO', tx, y + 2.5, { align: 'right', width: tCols.fondo }); tx += tCols.fondo;
            doc.text('VENTAS', tx, y + 2.5, { align: 'right', width: tCols.ventas }); tx += tCols.ventas;
            doc.text('ESPERADO', tx, y + 2.5, { align: 'right', width: tCols.esperado }); tx += tCols.esperado;
            doc.text('CONTADO', tx, y + 2.5, { align: 'right', width: tCols.contado }); tx += tCols.contado;
            doc.text('DIFERENCIA', tx, y + 2.5, { align: 'right', width: tCols.diferencia });
            return y + 14;
        };

        curY = renderTurnosHeader(curY);

        items.forEach(r => {
            if (curY > 690) {
                doc.addPage();
                drawHeader();
                curY = renderTurnosHeader(doc.y + 4);
            }
            let rx = startX + 2;
            doc.fontSize(5.8).font('Helvetica').fillColor('#0f172a');
            doc.text(r.fecha || '---', rx, curY, { width: tCols.fecha, lineBreak: false }); rx += tCols.fecha;
            doc.text(String(r.turno || '---'), rx, curY, { width: tCols.turno, lineBreak: false }); rx += tCols.turno;
            doc.text(r.pos || '---', rx, curY, { width: tCols.pos, lineBreak: false, ellipsis: true }); rx += tCols.pos;
            doc.text(r.vendedor || '---', rx, curY, { width: tCols.vendedor, lineBreak: false, ellipsis: true }); rx += tCols.vendedor;
            doc.text(reportPdfHelper.fmt(r.fondo), rx, curY, { align: 'right', width: tCols.fondo }); rx += tCols.fondo;
            doc.text(reportPdfHelper.fmt(r.ventas), rx, curY, { align: 'right', width: tCols.ventas }); rx += tCols.ventas;
            doc.text(reportPdfHelper.fmt(r.esperado), rx, curY, { align: 'right', width: tCols.esperado }); rx += tCols.esperado;
            doc.text(reportPdfHelper.fmt(r.contado), rx, curY, { align: 'right', width: tCols.contado }); rx += tCols.contado;
            doc.text(reportPdfHelper.fmt(r.diferencia), rx, curY, { align: 'right', width: tCols.diferencia });
            curY += 8.5;
        });

        // Totales de la tabla de turnos
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, curY).lineTo(startX + contentWidth, curY).stroke();
        curY += 2;
        doc.fontSize(6).font('Helvetica-Bold').fillColor('#0f172a');
        let lx = startX + 2;
        const metaW = tCols.fecha + tCols.turno + tCols.pos + tCols.vendedor;
        doc.text(`TOTALES (${items.length} TURNOS)`, lx, curY, { width: metaW }); lx += metaW;
        doc.text(reportPdfHelper.fmt(data.totales?.fondo), lx, curY, { align: 'right', width: tCols.fondo }); lx += tCols.fondo;
        doc.text(reportPdfHelper.fmt(data.totales?.ventas), lx, curY, { align: 'right', width: tCols.ventas }); lx += tCols.ventas;
        doc.text(reportPdfHelper.fmt(data.totales?.esperado), lx, curY, { align: 'right', width: tCols.esperado }); lx += tCols.esperado;
        doc.text(reportPdfHelper.fmt(data.totales?.contado), lx, curY, { align: 'right', width: tCols.contado }); lx += tCols.contado;
        doc.text(reportPdfHelper.fmt(data.totales?.diferencia), lx, curY, { align: 'right', width: tCols.diferencia });
        curY += 10;
        doc.strokeColor('#0f172a').lineWidth(0.75).moveTo(startX, curY).lineTo(startX + contentWidth, curY).stroke();
        curY += 8;

        // Salto limpio hacia la sección de consolidación de detalles
        if (curY > 360) {
            doc.addPage();
            drawHeader();
            curY = doc.y + 6;
        }
    }

    // 3. Preparación de Listas de Detalle (Consolidadas si son múltiples turnos)
    const rawIngresos = data.ingresos_detalle || [];
    const rawGastos = data.gastos_detalle || [];
    const rawTarjetas = data.tarjetas_detalle || [];
    const rawRemesas = data.remesas_detalle || [];
    const rawPuntos = data.puntos_detalle || [];

    const ingresosList = isSingleShift
        ? rawIngresos.map(i => ({ descripcion: `${i.descripcion || 'Ingreso adicional'}${i.metodo && i.metodo !== '01' ? ` (${i.metodo})` : ''}`, monto: i.monto }))
        : groupDetailItems(rawIngresos, 'MOVS.');

    const gastosList = isSingleShift
        ? rawGastos.map(g => ({ descripcion: g.descripcion || 'Gasto operativo', monto: g.monto }))
        : groupDetailItems(rawGastos, 'COMPRAS');

    const tarjetasList = isSingleShift
        ? rawTarjetas.map(t => {
            let label = t.descripcion || 'Tarjeta';
            if (t.tarjeta && t.tarjeta !== '---') label += ` (${t.tarjeta})`;
            if (t.autorizacion && t.autorizacion !== '---') label += ` Aut: #${t.autorizacion}`;
            return { descripcion: label, monto: t.monto };
        })
        : groupDetailItems(rawTarjetas, 'VOUCHERS');

    const remesasList = isSingleShift
        ? rawRemesas.map(r => ({ descripcion: r.numero && r.numero !== '---' ? `${r.numero} ${r.descripcion || 'Remesa'}` : (r.descripcion || 'Remesa'), monto: r.monto }))
        : groupDetailItems(rawRemesas, 'REMESAS');

    const puntosList = isSingleShift
        ? rawPuntos.map(p => ({ descripcion: p.descripcion || 'Canje de puntos', monto: p.monto }))
        : groupDetailItems(rawPuntos, 'CANJES');

    const totalIngresos = (data.totales?.ingresos !== undefined) ? data.totales.ingresos : ingresosList.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
    const totalGastos = (data.totales?.gastos !== undefined) ? data.totales.gastos : gastosList.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
    const totalTarjetas = (data.totales?.tarjetas !== undefined) ? data.totales.tarjetas : tarjetasList.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
    const totalRemesas = (data.totales?.remesas !== undefined) ? data.totales.remesas : remesasList.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const totalPuntos = (data.totales?.puntos !== undefined) ? data.totales.puntos : puntosList.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

    const colW = (contentWidth - 16) / 2;
    const leftColX = startX;
    const rightColX = startX + colW + 16;
    const amountColDef = { amountWidth: 65 };

    // Fila 1 de Detalle: INGRESOS & GASTOS
    const rowHeight1 = Math.max(getTableHeight(ingresosList.length), getTableHeight(gastosList.length));
    if (curY + rowHeight1 > 700) {
        doc.addPage();
        drawHeader();
        curY = doc.y + 6;
    }
    const endY1 = renderDetailTable(doc, 'Detalle de Otros Ingresos', ingresosList, leftColX, curY, colW, amountColDef, 'Total Ingresos', totalIngresos);
    const endY2 = renderDetailTable(doc, 'Detalle de Gastos (Caja Chica)', gastosList, rightColX, curY, colW, amountColDef, 'Total Gastos', totalGastos);
    curY = Math.max(endY1, endY2) + 6;

    // Fila 2 de Detalle: TARJETAS & REMESAS
    const rowHeight2 = Math.max(getTableHeight(tarjetasList.length), getTableHeight(remesasList.length));
    if (curY + rowHeight2 > 700) {
        doc.addPage();
        drawHeader();
        curY = doc.y + 6;
    }
    const endY3 = renderDetailTable(doc, 'Detalle de Tarjetas (Vouchers)', tarjetasList, leftColX, curY, colW, amountColDef, 'Total Tarjetas', totalTarjetas);
    const endY4 = renderDetailTable(doc, 'Detalle de Remesas', remesasList, rightColX, curY, colW, amountColDef, 'Total Remesas', totalRemesas);
    curY = Math.max(endY3, endY4) + 6;

    // Fila 3: Puntos Canjeados (si existen)
    if (puntosList.length > 0) {
        const rowHeight3 = getTableHeight(puntosList.length);
        if (curY + rowHeight3 > 700) {
            doc.addPage();
            drawHeader();
            curY = doc.y + 6;
        }
        curY = renderDetailTable(doc, 'Detalle de Puntos Canjeados', puntosList, leftColX, curY, colW, amountColDef, 'Total Puntos', totalPuntos) + 6;
    }

    // 4. RESUMEN DE OPERACIONES (Cuadro principal)
    if (curY + 115 > 700) {
        doc.addPage();
        drawHeader();
        curY = doc.y + 6;
    }

    curY = renderOperationsSummary(doc, data.totales || {}, startX, curY, contentWidth);

    // 5. Cierre estándar sin firmas
    if (curY > 700) {
        doc.addPage();
        drawHeader();
        curY = doc.y + 6;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, curY, items.length, 'Arqueos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

module.exports = {
    generateArqueosReportPDF
};
