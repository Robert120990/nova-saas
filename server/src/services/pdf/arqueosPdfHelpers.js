const reportPdfHelper = require('../../utils/reportPdfHelper');

/**
 * Agrupa y consolida partidas de detalle por concepto normalizado para rangos multiturno.
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

/**
 * Renders two detail tables side-by-side with synchronized rows and automatic pagination.
 */
function renderPairDetailTables(doc, leftTable, rightTable, drawHeader, curY, startX, colW) {
    const leftColX = startX;
    const rightColX = startX + colW + 16;
    const amountColDef = { amountWidth: 65 };
    const descWidth = colW - amountColDef.amountWidth - 8;

    const leftItems = leftTable?.items || [];
    const rightItems = rightTable?.items || [];
    const maxItems = Math.max(leftItems.length, rightItems.length);

    if (curY > 670) {
        doc.addPage();
        drawHeader();
        curY = doc.y + 6;
    }

    const drawHeaders = (y) => {
        if (leftTable) {
            doc.rect(leftColX, y, colW, 14).fill('#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(leftTable.title.toUpperCase(), leftColX + 4, y + 3.5, { width: colW - 8 });
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftColX, y + 14).lineTo(leftColX + colW, y + 14).stroke();
        }
        if (rightTable) {
            doc.rect(rightColX, y, colW, 14).fill('#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(rightTable.title.toUpperCase(), rightColX + 4, y + 3.5, { width: colW - 8 });
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightColX, y + 14).lineTo(rightColX + colW, y + 14).stroke();
        }
        return y + 17;
    };

    curY = drawHeaders(curY);

    if (maxItems === 0) {
        doc.fontSize(6).font('Helvetica-Oblique').fillColor('#94a3b8');
        if (leftTable) doc.text('Sin movimientos registrados', leftColX + 4, curY, { width: colW - 8 });
        if (rightTable) doc.text('Sin movimientos registrados', rightColX + 4, curY, { width: colW - 8 });
        curY += 10;
    } else {
        doc.fontSize(6).font('Helvetica').fillColor('#0f172a');
        for (let i = 0; i < maxItems; i++) {
            if (curY > 700) {
                doc.addPage();
                drawHeader();
                curY = drawHeaders(doc.y + 6);
                doc.fontSize(6).font('Helvetica').fillColor('#0f172a');
            }

            if (leftTable && i < leftItems.length) {
                const item = leftItems[i];
                const desc = item.descripcion || item.description || '---';
                const amt = parseFloat(item.monto !== undefined ? item.monto : item.amount) || 0;
                doc.text(desc, leftColX + 4, curY, { width: descWidth, lineBreak: false, ellipsis: true });
                doc.text(reportPdfHelper.fmt(amt), leftColX + descWidth + 4, curY, { align: 'right', width: amountColDef.amountWidth, lineBreak: false });
            }

            if (rightTable && i < rightItems.length) {
                const item = rightItems[i];
                const desc = item.descripcion || item.description || '---';
                const amt = parseFloat(item.monto !== undefined ? item.monto : item.amount) || 0;
                doc.text(desc, rightColX + 4, curY, { width: descWidth, lineBreak: false, ellipsis: true });
                doc.text(reportPdfHelper.fmt(amt), rightColX + descWidth + 4, curY, { align: 'right', width: amountColDef.amountWidth, lineBreak: false });
            }

            curY += 9;
        }
    }

    if (curY > 695) {
        doc.addPage();
        drawHeader();
        curY = doc.y + 6;
    }

    if (leftTable) {
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftColX, curY).lineTo(leftColX + colW, curY).stroke();
    }
    if (rightTable) {
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightColX, curY).lineTo(rightColX + colW, curY).stroke();
    }
    curY += 2;

    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
    if (leftTable) {
        doc.text(leftTable.totalLabel.toUpperCase(), leftColX + 4, curY, { width: descWidth, lineBreak: false, ellipsis: true });
        doc.text(reportPdfHelper.fmt(leftTable.totalVal), leftColX + descWidth + 4, curY, { align: 'right', width: amountColDef.amountWidth });
    }
    if (rightTable) {
        doc.text(rightTable.totalLabel.toUpperCase(), rightColX + 4, curY, { width: descWidth, lineBreak: false, ellipsis: true });
        doc.text(reportPdfHelper.fmt(rightTable.totalVal), rightColX + descWidth + 4, curY, { align: 'right', width: amountColDef.amountWidth });
    }
    curY += 13;

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

module.exports = {
    groupDetailItems,
    renderPairDetailTables,
    renderOperationsSummary
};
