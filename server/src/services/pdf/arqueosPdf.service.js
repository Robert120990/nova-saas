const reportPdfHelper = require('../../utils/reportPdfHelper');
const { resolveCompanyInfo } = require('./pdfUtils');
const {
    groupDetailItems,
    renderPairDetailTables,
    renderOperationsSummary
} = require('./arqueosPdfHelpers');

/**
 * Generador unificado de Reporte de Arqueos / Corte de Tienda en PDF.
 */
const generateArqueosReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const isSingleShift = Array.isArray(data.data) && data.data.length === 1;
    const isDetailed = Boolean(data.detailed);
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

        if (curY > 360) {
            doc.addPage();
            drawHeader();
            curY = doc.y + 6;
        }
    }

    // 3. Preparación de Listas de Detalle (Consolidadas o Detalladas según toggle)
    const rawIngresos = data.ingresos_detalle || [];
    const rawGastos = data.gastos_detalle || [];
    const rawTarjetas = data.tarjetas_detalle || [];
    const rawRemesas = data.remesas_detalle || [];
    const rawPuntos = data.puntos_detalle || [];

    const shouldDetail = isDetailed || isSingleShift;

    const ingresosList = shouldDetail
        ? rawIngresos.map(i => {
            let label = i.descripcion || 'Ingreso adicional';
            if (i.metodo && i.metodo !== '01') label += ` (${i.metodo})`;
            if (!isSingleShift && i.vendedor && i.vendedor !== '---') label += ` (${i.vendedor})`;
            return { descripcion: label.trim(), monto: i.monto };
        })
        : groupDetailItems(rawIngresos, 'MOVS.');

    const gastosList = shouldDetail
        ? rawGastos.map(g => {
            let label = g.descripcion || 'Gasto operativo';
            if (!isSingleShift && g.vendedor && g.vendedor !== '---') label += ` (${g.vendedor})`;
            return { descripcion: label.trim(), monto: g.monto };
        })
        : groupDetailItems(rawGastos, 'COMPRAS');

    const tarjetasList = shouldDetail
        ? rawTarjetas.map(t => {
            let label = t.descripcion || 'Tarjeta';
            if (t.tarjeta && t.tarjeta !== '---') label += ` (${t.tarjeta})`;
            if (t.autorizacion && t.autorizacion !== '---') label += ` Aut: #${t.autorizacion}`;
            if (!isSingleShift && t.vendedor && t.vendedor !== '---') label += ` (${t.vendedor})`;
            return { descripcion: label.trim(), monto: t.monto };
        })
        : groupDetailItems(rawTarjetas, 'VOUCHERS');

    const remesasList = shouldDetail
        ? rawRemesas.map(r => {
            const numStr = r.numero && r.numero !== '---' ? `${r.numero} ` : '';
            const descStr = r.descripcion || 'Remesa';
            const vendStr = r.vendedor && r.vendedor !== '---' ? ` (${r.vendedor})` : '';
            const turnoStr = (!isSingleShift && r.turno && r.turno !== '---') ? ` [T#${r.turno}]` : '';
            return {
                descripcion: `${numStr}${descStr}${vendStr}${turnoStr}`.trim(),
                monto: r.monto
            };
        })
        : groupDetailItems(rawRemesas, 'REMESAS');

    const puntosList = shouldDetail
        ? rawPuntos.map(p => {
            let label = p.descripcion || 'Canje de puntos';
            if (!isSingleShift && p.vendedor && p.vendedor !== '---') label += ` (${p.vendedor})`;
            return { descripcion: label.trim(), monto: p.monto };
        })
        : groupDetailItems(rawPuntos, 'CANJES');

    const totalIngresos = (data.totales?.ingresos !== undefined) ? data.totales.ingresos : ingresosList.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
    const totalGastos = (data.totales?.gastos !== undefined) ? data.totales.gastos : gastosList.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0);
    const totalTarjetas = (data.totales?.tarjetas !== undefined) ? data.totales.tarjetas : tarjetasList.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
    const totalRemesas = (data.totales?.remesas !== undefined) ? data.totales.remesas : remesasList.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const totalPuntos = (data.totales?.puntos !== undefined) ? data.totales.puntos : puntosList.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

    const colW = (contentWidth - 16) / 2;

    // Fila 1 de Detalle: INGRESOS & GASTOS
    curY = renderPairDetailTables(
        doc,
        { title: 'Detalle de Otros Ingresos', items: ingresosList, totalLabel: 'Total Ingresos', totalVal: totalIngresos },
        { title: 'Detalle de Gastos (Caja Chica)', items: gastosList, totalLabel: 'Total Gastos', totalVal: totalGastos },
        drawHeader,
        curY,
        startX,
        colW
    );

    // Fila 2 de Detalle: TARJETAS & REMESAS
    curY = renderPairDetailTables(
        doc,
        { title: 'Detalle de Tarjetas (Vouchers)', items: tarjetasList, totalLabel: 'Total Tarjetas', totalVal: totalTarjetas },
        { title: 'Detalle de Remesas', items: remesasList, totalLabel: 'Total Remesas', totalVal: totalRemesas },
        drawHeader,
        curY,
        startX,
        colW
    );

    // Fila 3: Puntos Canjeados (si existen)
    if (puntosList.length > 0) {
        curY = renderPairDetailTables(
            doc,
            { title: 'Detalle de Puntos Canjeados', items: puntosList, totalLabel: 'Total Puntos', totalVal: totalPuntos },
            null,
            drawHeader,
            curY,
            startX,
            colW
        );
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
