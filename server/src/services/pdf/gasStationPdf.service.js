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


// --- CIERRES, COMBUSTIBLES Y LUBRICANTES DE ESTACIÓN DE SERVICIO ---
const generateCloseoutDetailPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const company = await resolveCompanyInfo(data);
    const title = `DETALLE DE ${data.tipo_nombre?.toUpperCase() || data.tipo_reporte?.toUpperCase() || 'CIERRE'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;

    const startX = 30;
    const pageW = 732;

    const rawCols = data.columns || [];
    const rawSum = rawCols.reduce((s, c) => s + (c.w || 100), 0);
    let accumulatedW = 0;
    const colDefs = rawCols.map((c, i) => {
        let w;
        if (i === rawCols.length - 1) {
            w = pageW - accumulatedW;
        } else {
            w = Math.round((c.w / rawSum) * pageW);
            accumulatedW += w;
        }
        return { ...c, w };
    });

    const drawTableHeader = (y) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX;
        colDefs.forEach(c => {
            const align = c.align || (c.format === 'money' || c.format === 'qty' ? 'right' : c.format === 'date' ? 'center' : 'left');
            const padX = align === 'right' ? x : x + 2;
            const w = align === 'right' ? c.w - 2 : c.w - 4;
            doc.text(c.label, padX, y + 3, { width: w, align });
            x += c.w;
        });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = drawTableHeader(currentY);

    let rowIndex = 0;
    const renderRow = (row) => {
        if (currentY > 515) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        if (rowIndex % 2 === 1) {
            doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
        }
        rowIndex++;

        doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
        let x = startX;
        colDefs.forEach(c => {
            const val = c.accessor ? row[c.accessor] : row[c.label];
            const align = c.align || (c.format === 'money' || c.format === 'qty' ? 'right' : c.format === 'date' ? 'center' : 'left');
            const padX = align === 'right' ? x : x + 2;
            const w = align === 'right' ? c.w - 2 : c.w - 4;

            if (c.format === 'money') {
                doc.text(reportPdfHelper.fmt(val), padX, currentY + 1, { width: w, align: 'right' });
            } else if (c.format === 'qty') {
                const qtyStr = Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                doc.text(qtyStr, padX, currentY + 1, { width: w, align: 'right' });
            } else if (c.format === 'date') {
                doc.text(reportPdfHelper.formatDate(val), padX, currentY + 1, { width: w, align: 'center' });
            } else {
                const textStr = reportPdfHelper.fitText(doc, String(val ?? '—'), w);
                doc.text(textStr, padX, currentY + 1, { width: w, align, lineBreak: false });
            }
            x += c.w;
        });

        currentY += 12;
    };

    const renderGroupHeader = (group) => {
        if (currentY > 515) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.rect(startX, currentY - 1, pageW, 13).fill('#e2e8f0');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX;
        colDefs.forEach((c, idx) => {
            const align = c.align || (c.format === 'money' ? 'right' : 'left');
            const padX = align === 'right' ? x : x + 2;
            const w = align === 'right' ? c.w - 2 : c.w - 4;

            if (c.format === 'money') {
                doc.text(reportPdfHelper.fmt(group.subtotal || 0), padX, currentY + 2, { width: w, align: 'right' });
            } else if (idx === 0) {
                doc.text(`TIPO DE POS: ${String(group.label ?? '—').toUpperCase()}`, padX, currentY + 2, { width: pageW - 140, align: 'left', lineBreak: false });
            }
            x += c.w;
        });

        currentY += 14;
    };

    if (data.groups && data.groups.length) {
        data.groups.forEach(g => {
            renderGroupHeader(g);
            g.rows.forEach(renderRow);
        });
    } else {
        (data.rows || []).forEach(renderRow);
    }

    if (currentY > 510) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Totales
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
    currentY += 2;
    doc.rect(startX, currentY - 1, pageW, 14).fill('#f1f5f9');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');

    const isTotalCol = (c) => {
        if (c.noTotal) return false;
        if (c.hasTotal !== undefined) return c.hasTotal;
        if (c.format === 'money') return true;
        if (c.format === 'qty' || c.accessor === 'cantidad') return true;
        return false;
    };

    const firstTotalIdx = colDefs.findIndex(isTotalCol);

    let colXPositions = [];
    let curX = startX;
    colDefs.forEach(c => {
        colXPositions.push(curX);
        curX += c.w;
    });

    const labelEndX = firstTotalIdx > 0 ? colXPositions[firstTotalIdx] : (startX + (colDefs[0]?.w || 150));
    const labelW = Math.max(labelEndX - startX - 4, 100);

    doc.text('TOTALES GENERALES:', startX + 2, currentY + 3, { width: labelW, align: 'left', lineBreak: false });

    colDefs.forEach((c, idx) => {
        if (!isTotalCol(c)) return;
        const tx = colXPositions[idx];
        const align = c.align || 'right';
        const padX = align === 'right' ? tx : tx + 2;
        const w = align === 'right' ? c.w - 2 : c.w - 4;

        if (c.format === 'money') {
            const total = (data.rows || []).reduce((s, r) => s + (parseFloat(r[c.accessor || c.label]) || 0), 0);
            doc.text(reportPdfHelper.fmt(total), padX, currentY + 3, { width: w, align: 'right', lineBreak: false });
        } else if (c.format === 'qty' || c.accessor === 'cantidad') {
            const totalQty = (data.rows || []).reduce((s, r) => s + (parseFloat(r[c.accessor || c.label]) || 0), 0);
            doc.text(Number(totalQty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), padX, currentY + 3, { width: w, align: 'right', lineBreak: false });
        }
    });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY + 13).lineTo(startX + pageW, currentY + 13).stroke();
    currentY += 22;

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, data.rows?.length || 0, 'Registros');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateFuelInventoryPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const company = await resolveCompanyInfo(data);
    const title = `INVENTARIO DE ${data.fuel_label?.toUpperCase() || 'COMBUSTIBLE'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;

    const startX = 30;
    const pageW = 732;

    const fmtGal = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const colDefs = [
        { label: 'FECHA', w: 48, accessor: 'fecha', format: 'date', align: 'center', group: 'FECHA' },
        { label: 'V.AUTO', w: 34, accessor: 'venta_auto', format: 'gal', align: 'right', group: 'VENTA' },
        { label: 'V.FULL', w: 34, accessor: 'venta_full', format: 'gal', align: 'right', group: 'VENTA' },
        { label: 'V.MSTR', w: 34, accessor: 'venta_master', format: 'gal', align: 'right', group: 'VENTA' },
        { label: 'INVENTARIO', w: 46, accessor: 'inventario', format: 'gal', align: 'right', group: 'INV.' },
        { label: 'P.AUTO', w: 31, accessor: 'precio_auto', format: 'money', align: 'right', group: 'PRECIOS' },
        { label: 'P.FULL', w: 31, accessor: 'precio_full', format: 'money', align: 'right', group: 'PRECIOS' },
        { label: 'P.MSTR', w: 31, accessor: 'precio_master', format: 'money', align: 'right', group: 'PRECIOS' },
        { label: 'COSTO', w: 30, accessor: 'costo', format: 'money', align: 'right', group: 'COSTO' },
        { label: 'M.AUTO', w: 30, accessor: 'margen_auto', format: 'money', align: 'right', group: 'MARGEN' },
        { label: 'M.FULL', w: 30, accessor: 'margen_full', format: 'money', align: 'right', group: 'MARGEN' },
        { label: 'M.MSTR', w: 30, accessor: 'margen_master', format: 'money', align: 'right', group: 'MARGEN' },
        { label: 'UTIL.TOT', w: 34, accessor: 'utilidad_total', format: 'money', align: 'right', group: 'UTILIDAD' },
        { label: 'U.AUTO', w: 30, accessor: 'utilidad_auto', format: 'money', align: 'right', group: 'UTILIDAD' },
        { label: 'U.FULL', w: 30, accessor: 'utilidad_full', format: 'money', align: 'right', group: 'UTILIDAD' },
        { label: 'U.MSTR', w: 30, accessor: 'utilidad_master', format: 'money', align: 'right', group: 'UTILIDAD' },
        { label: 'M.TOTAL', w: 30, accessor: 'margen_total', format: 'money', align: 'right', group: 'MG.TOT' },
        { label: 'REC.MAN', w: 33, accessor: 'recarga_manual', format: 'gal', align: 'right', group: 'RECARGA' },
        { label: 'REC.COM', w: 33, accessor: 'recarga_compra', format: 'gal', align: 'right', group: 'RECARGA' },
        { label: 'DIF.DIA', w: 33, accessor: 'dif_diaria', format: 'gal', align: 'right', group: 'DIF.DIA' },
        { label: 'T.VENTA', w: 35, accessor: 'total_venta', format: 'gal', align: 'right', group: 'TOTAL' },
        { label: 'P.PROM', w: 35, accessor: 'precio_promedio', format: 'money', align: 'right', group: 'TOTAL' }
    ];

    const groups = [];
    for (const c of colDefs) {
        if (!groups.find(g => g.label === c.group)) {
            const span = colDefs.filter(x => x.group === c.group).reduce((s, x) => s + x.w, 0);
            groups.push({ label: c.group, w: span });
        }
    }

    const drawTableHeader = (y) => {
        // Tier 1: Grupos
        doc.rect(startX, y, pageW, 12).fill('#f1f5f9');
        doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0f172a');
        let gx = startX;
        groups.forEach(g => {
            doc.text(g.label, gx, y + 2.5, { width: g.w, align: 'center' });
            gx += g.w;
        });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 12).lineTo(startX + pageW, y + 12).stroke();

        // Tier 2: Columnas
        const colY = y + 12;
        doc.rect(startX, colY, pageW, 12).fill('#f8fafc');
        doc.fontSize(5).font('Helvetica-Bold').fillColor('#334155');
        let cx = startX;
        colDefs.forEach(c => {
            doc.text(c.label, cx, colY + 2.5, { width: c.w, align: 'center' });
            cx += c.w;
        });
        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, colY + 12).lineTo(startX + pageW, colY + 12).stroke();
        return colY + 13;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    // Barra de inventario inicial
    doc.rect(startX, currentY, pageW, 14).fill('#f8fafc');
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`INVENTARIO INICIAL: ${fmtGal(data.inventario_inicial || 0)} GALONES`, startX + 6, currentY + 3, { width: pageW - 12, align: 'left' });
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY + 14).lineTo(startX + pageW, currentY + 14).stroke();
    currentY += 16;

    currentY = drawTableHeader(currentY);

    const rows = data.rows || [];
    rows.forEach((row, idx) => {
        if (currentY > 515) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 1, pageW, 11).fill('#f8fafc');
        }

        doc.fontSize(5.5).font('Helvetica').fillColor('#1e293b');
        let x = startX;
        colDefs.forEach(c => {
            const val = row[c.accessor];
            if (c.format === 'money') {
                doc.text(reportPdfHelper.fmt(val), x, currentY + 1, { width: c.w - 2, align: 'right' });
            } else if (c.format === 'date') {
                doc.text(reportPdfHelper.formatDate(val), x, currentY + 1, { width: c.w, align: 'center' });
            } else {
                doc.text(fmtGal(val), x, currentY + 1, { width: c.w - 2, align: 'right' });
            }
            x += c.w;
        });

        currentY += 11;
    });

    if (currentY > 510) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Totales
    if (rows.length > 0) {
        doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
        currentY += 2;
        doc.rect(startX, currentY - 1, pageW, 13).fill('#f1f5f9');
        doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0f172a');

        let tx = startX;
        colDefs.forEach((c, idx) => {
            if (idx === 0) {
                doc.text('TOTALES:', tx, currentY + 2, { width: c.w, align: 'left' });
            } else if (['precio_auto', 'precio_full', 'precio_master', 'costo', 'margen_auto', 'margen_full', 'margen_master', 'margen_total', 'precio_promedio'].includes(c.accessor)) {
                // Precios unitarios y márgenes no se totalizan
            } else if (c.format === 'money') {
                const total = rows.reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0);
                doc.text(reportPdfHelper.fmt(total), tx, currentY + 2, { width: c.w - 2, align: 'right' });
            } else {
                const total = rows.reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0);
                doc.text(fmtGal(total), tx, currentY + 2, { width: c.w - 2, align: 'right' });
            }
            tx += c.w;
        });
        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY + 12).lineTo(startX + pageW, currentY + 12).stroke();
        currentY += 22;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Días');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateGalonajeVendidoPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const company = await resolveCompanyInfo(data);
    const title = 'REPORTE DE GALONAJE VENDIDO';
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;

    const startX = 30;
    const pageW = 732;

    const fmtGal = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const colDefs = [
        { label: 'FECHA', w: 60, accessor: 'fecha', format: 'date', align: 'center', group: 'FECHA' },
        { label: 'LECTURA', w: 56, accessor: 'lect_diesel', format: 'gal', align: 'right', group: 'DIESEL' },
        { label: 'VENTA', w: 56, accessor: 'vta_diesel', format: 'gal', align: 'right', group: 'DIESEL' },
        { label: 'DIF.', w: 56, accessor: 'dif_diesel', format: 'gal', align: 'right', group: 'DIESEL' },
        { label: 'LECTURA', w: 56, accessor: 'lect_regular', format: 'gal', align: 'right', group: 'REGULAR' },
        { label: 'VENTA', w: 56, accessor: 'vta_regular', format: 'gal', align: 'right', group: 'REGULAR' },
        { label: 'DIF.', w: 56, accessor: 'dif_regular', format: 'gal', align: 'right', group: 'REGULAR' },
        { label: 'LECTURA', w: 56, accessor: 'lect_super', format: 'gal', align: 'right', group: 'SUPER' },
        { label: 'VENTA', w: 56, accessor: 'vta_super', format: 'gal', align: 'right', group: 'SUPER' },
        { label: 'DIF.', w: 56, accessor: 'dif_super', format: 'gal', align: 'right', group: 'SUPER' },
        { label: 'LECTURA', w: 56, accessor: 'lect_ion_diesel', format: 'gal', align: 'right', group: 'ION DIESEL' },
        { label: 'VENTA', w: 56, accessor: 'vta_ion_diesel', format: 'gal', align: 'right', group: 'ION DIESEL' },
        { label: 'DIF.', w: 56, accessor: 'dif_ion_diesel', format: 'gal', align: 'right', group: 'ION DIESEL' },
    ];

    const groups = [
        { label: 'FECHA', w: 60, headerBg: '#f1f5f9', textColor: '#0f172a' },
        { label: 'DIESEL', w: 168, headerBg: '#e0e7ff', textColor: '#3730a3' },
        { label: 'REGULAR', w: 168, headerBg: '#dcfce7', textColor: '#166534' },
        { label: 'SUPER', w: 168, headerBg: '#fed7aa', textColor: '#9a3412' },
        { label: 'ION DIESEL', w: 168, headerBg: '#fae8ff', textColor: '#86198f' },
    ];

    const drawTableHeader = (y) => {
        // Tier 1: Categorías de combustible
        let gx = startX;
        groups.forEach(g => {
            doc.rect(gx, y, g.w, 14).fill(g.headerBg);
            doc.fontSize(7).font('Helvetica-Bold').fillColor(g.textColor);
            doc.text(g.label, gx, y + 3, { width: g.w, align: 'center' });
            gx += g.w;
        });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();

        // Tier 2: Subcolumnas
        const colY = y + 14;
        let cx = startX;
        colDefs.forEach(c => {
            doc.rect(cx, colY, c.w, 13).fill('#f8fafc');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#334155');
            doc.text(c.label, cx, colY + 2.5, { width: c.w, align: 'center' });
            cx += c.w;
        });
        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, colY + 13).lineTo(startX + pageW, colY + 13).stroke();

        // Divisores verticales
        doc.strokeColor('#cbd5e1').lineWidth(0.5);
        gx = startX;
        groups.forEach(g => {
            if (g.label !== 'FECHA') {
                doc.moveTo(gx, y).lineTo(gx, colY + 13).stroke();
            }
            gx += g.w;
        });

        return colY + 14;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = drawTableHeader(currentY);

    const rows = data.rows || [];
    rows.forEach((row, idx) => {
        if (currentY > 515) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
        }

        doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b');
        let x = startX;
        colDefs.forEach(c => {
            const val = row[c.accessor];
            if (c.format === 'date') {
                doc.text(reportPdfHelper.formatDate(val), x, currentY + 1, { width: c.w, align: 'center' });
            } else {
                if (c.accessor.startsWith('dif_')) {
                    const numVal = parseFloat(val) || 0;
                    if (Math.abs(numVal) > 0.001) {
                        doc.font('Helvetica-Bold');
                        if (numVal < 0) doc.fillColor('#dc2626');
                        else doc.fillColor('#15803d');
                    } else {
                        doc.font('Helvetica').fillColor('#1e293b');
                    }
                } else {
                    doc.font('Helvetica').fillColor('#1e293b');
                }
                doc.text(fmtGal(val), x, currentY + 1, { width: c.w - 3, align: 'right' });
            }
            x += c.w;
        });

        // Divisor vertical sutil entre grupos
        doc.strokeColor('#e2e8f0').lineWidth(0.5);
        let gx = startX;
        groups.forEach(g => {
            if (g.label !== 'FECHA') {
                doc.moveTo(gx, currentY - 1).lineTo(gx, currentY + 11).stroke();
            }
            gx += g.w;
        });

        currentY += 12;
    });

    if (currentY > 480) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Totales
    if (rows.length > 0) {
        doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
        currentY += 2;
        doc.rect(startX, currentY - 1, pageW, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');

        let tx = startX;
        colDefs.forEach((c, idx) => {
            if (idx === 0) {
                doc.text('TOTALES:', tx, currentY + 2, { width: c.w, align: 'left' });
            } else {
                const total = rows.reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0);
                if (c.accessor.startsWith('dif_')) {
                    if (total < 0) doc.fillColor('#dc2626');
                    else if (total > 0) doc.fillColor('#15803d');
                    else doc.fillColor('#0f172a');
                } else {
                    doc.fillColor('#0f172a');
                }
                doc.text(fmtGal(total), tx, currentY + 2, { width: c.w - 3, align: 'right' });
            }
            tx += c.w;
        });

        doc.strokeColor('#cbd5e1').lineWidth(0.5);
        let gx = startX;
        groups.forEach(g => {
            if (g.label !== 'FECHA') {
                doc.moveTo(gx, currentY - 1).lineTo(gx, currentY + 13).stroke();
            }
            gx += g.w;
        });

        doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY + 13).lineTo(startX + pageW, currentY + 13).stroke();
        currentY += 20;

        // Cuadro resumen de diferencias
        const difData = data.diferencias || {};
        const tdTotal = difData.total || 0;

        if (currentY > 500) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        }

        doc.rect(startX, currentY, pageW, 32).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('RESUMEN DE DIFERENCIAS POR COMBUSTIBLE (GALONES):', startX + 10, currentY + 4);

        const summaryText = `DIESEL: ${fmtGal(difData.diesel)} gal.    |    REGULAR: ${fmtGal(difData.regular)} gal.    |    SUPER: ${fmtGal(difData.super)} gal.    |    ION DIESEL: ${fmtGal(difData.ion_diesel)} gal.`;
        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(summaryText, startX + 10, currentY + 14);

        doc.fontSize(7.5).font('Helvetica-Bold');
        if (tdTotal < 0) doc.fillColor('#dc2626');
        else if (tdTotal > 0) doc.fillColor('#15803d');
        else doc.fillColor('#0f172a');
        doc.text(`DIFERENCIA TOTAL ACUMULADA: ${fmtGal(tdTotal)} GALONES`, startX + 10, currentY + 23);

        currentY += 40;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Días');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

function draw3DDonutSlice(doc, cx, cy, rx, ry, innerRx, innerRy, startAngle, endAngle, depth, explodeDist, topColor, sideColor) {
    const midAngle = (startAngle + endAngle) / 2;
    const ox = Math.cos(midAngle) * explodeDist;
    const oy = Math.sin(midAngle) * explodeDist;

    const centerColX = cx + ox;
    const centerColY = cy + oy;

    const steps = 40;
    const angleStep = (endAngle - startAngle) / steps;

    const outerPoints = [];
    for (let i = 0; i <= steps; i++) {
        const a = startAngle + i * angleStep;
        outerPoints.push({
            x: centerColX + Math.cos(a) * rx,
            y: centerColY + Math.sin(a) * ry,
            angle: a
        });
    }

    const innerPoints = [];
    for (let i = 0; i <= steps; i++) {
        const a = startAngle + i * angleStep;
        innerPoints.push({
            x: centerColX + Math.cos(a) * innerRx,
            y: centerColY + Math.sin(a) * innerRy,
            angle: a
        });
    }

    // Outer side wall (front-facing)
    for (let i = 0; i < steps; i++) {
        const p1 = outerPoints[i];
        const p2 = outerPoints[i + 1];
        const midA = (p1.angle + p2.angle) / 2;

        if (Math.sin(midA) >= -0.05) {
            doc.save();
            doc.fillColor(sideColor);
            doc.strokeColor(sideColor).lineWidth(0.5);
            doc.moveTo(p1.x, p1.y)
               .lineTo(p2.x, p2.y)
               .lineTo(p2.x, p2.y + depth)
               .lineTo(p1.x, p1.y + depth)
               .closePath()
               .fillAndStroke();
            doc.restore();
        }
    }

    // Inner side wall (back-facing)
    for (let i = 0; i < steps; i++) {
        const p1 = innerPoints[i];
        const p2 = innerPoints[i + 1];
        const midA = (p1.angle + p2.angle) / 2;

        if (Math.sin(midA) <= 0.05) {
            doc.save();
            doc.fillColor(sideColor);
            doc.strokeColor(sideColor).lineWidth(0.5);
            doc.moveTo(p1.x, p1.y)
               .lineTo(p2.x, p2.y)
               .lineTo(p2.x, p2.y + depth)
               .lineTo(p1.x, p1.y + depth)
               .closePath()
               .fillAndStroke();
            doc.restore();
        }
    }

    // Radial cut wall: START edge
    if (Math.cos(startAngle) <= 0.05) {
        const inPt = innerPoints[0];
        const outPt = outerPoints[0];
        doc.save();
        doc.fillColor(sideColor);
        doc.strokeColor(sideColor).lineWidth(0.5);
        doc.moveTo(inPt.x, inPt.y)
           .lineTo(outPt.x, outPt.y)
           .lineTo(outPt.x, outPt.y + depth)
           .lineTo(inPt.x, inPt.y + depth)
           .closePath()
           .fillAndStroke();
        doc.restore();
    }

    // Radial cut wall: END edge
    if (Math.cos(endAngle) >= -0.05) {
        const inPt = innerPoints[steps];
        const outPt = outerPoints[steps];
        doc.save();
        doc.fillColor(sideColor);
        doc.strokeColor(sideColor).lineWidth(0.5);
        doc.moveTo(inPt.x, inPt.y)
           .lineTo(outPt.x, outPt.y)
           .lineTo(outPt.x, outPt.y + depth)
           .lineTo(inPt.x, inPt.y + depth)
           .closePath()
           .fillAndStroke();
        doc.restore();
    }

    // Top face
    doc.save();
    doc.fillColor(topColor);
    doc.strokeColor('#ffffff').lineWidth(1);
    doc.moveTo(outerPoints[0].x, outerPoints[0].y);
    for (let i = 1; i <= steps; i++) {
        doc.lineTo(outerPoints[i].x, outerPoints[i].y);
    }
    for (let i = steps; i >= 0; i--) {
        doc.lineTo(innerPoints[i].x, innerPoints[i].y);
    }
    doc.closePath();
    doc.fillAndStroke();
    doc.restore();

    const labelRadiusX = (rx + innerRx) / 2;
    const labelRadiusY = (ry + innerRy) / 2;
    const lx = centerColX + Math.cos(midAngle) * labelRadiusX;
    const ly = centerColY + Math.sin(midAngle) * labelRadiusY - 4;

    return { lx, ly, midAngle };
}

function getFuelPalette(desc, index) {
    const d = (desc || '').toUpperCase();
    if (d.includes('DIESEL') && !d.includes('COMPLETO')) return { top: '#3b70a2', side: '#24496b' };
    if (d.includes('DIESEL') && d.includes('COMPLETO')) return { top: '#688fa0', side: '#43616f' };
    if (d.includes('REGULAR') && !d.includes('COMPLETO')) return { top: '#4f944f', side: '#326332' };
    if (d.includes('REGULAR') && d.includes('COMPLETO')) return { top: '#d97724', side: '#8f4a10' };
    if (d.includes('SUPER') && !d.includes('COMPLETO')) return { top: '#dfa212', side: '#946a06' };
    if (d.includes('SUPER') && d.includes('COMPLETO')) return { top: '#8a99a8', side: '#576573' };
    const palette = [
        { top: '#3b70a2', side: '#24496b' },
        { top: '#4f944f', side: '#326332' },
        { top: '#dfa212', side: '#946a06' },
        { top: '#d97724', side: '#8f4a10' },
        { top: '#688fa0', side: '#43616f' },
        { top: '#8a99a8', side: '#576573' }
    ];
    return palette[index % palette.length];
}

const generateFuelSalesSummaryPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const company = await resolveCompanyInfo(data);
    const title = 'RESUMEN DE GLN VENDIDOS';
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;

    const startX = 30;
    const pageW = 552;

    const colX = {
        fecha: 30,
        codigo: 95,
        descripcion: 160,
        galones: 402,
        monto: 487
    };
    const colW = {
        fecha: 65,
        codigo: 65,
        descripcion: 242,
        galones: 85,
        monto: 95
    };

    const fmtGal = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const drawTableHeader = (y) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha, y + 3, { width: colW.fecha, align: 'center' });
        doc.text('CÓDIGO', colX.codigo, y + 3, { width: colW.codigo });
        doc.text('DESCRIPCIÓN', colX.descripcion, y + 3, { width: colW.descripcion });
        doc.text('GALONES', colX.galones, y + 3, { width: colW.galones - 2, align: 'right' });
        doc.text('MONTO', colX.monto, y + 3, { width: colW.monto - 2, align: 'right' });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    currentY = drawTableHeader(currentY);

    const grouped = data.grouped || {};
    const allEntries = Object.entries(grouped);
    let grandGalones = 0;
    let grandMonto = 0;
    let totalItemsCount = 0;

    for (let di = 0; di < allEntries.length; di++) {
        const [fecha, items] = allEntries[di];
        let dayGalones = 0;
        let dayMonto = 0;

        for (let i = 0; i < items.length; i++) {
            const r = items[i];
            if (currentY > 695) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
                currentY = drawTableHeader(currentY);
            }

            if (i % 2 === 1) {
                doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
            }

            const gal = parseFloat(r.galones || 0);
            const mto = parseFloat(r.monto || 0);
            dayGalones += gal;
            dayMonto += mto;
            totalItemsCount++;

            doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
            doc.text(reportPdfHelper.formatDate(r.fecha_turno || fecha), colX.fecha, currentY + 1, { width: colW.fecha, align: 'center' });
            doc.text(r.codigo_producto || '', colX.codigo, currentY + 1, { width: colW.codigo });
            const desc = reportPdfHelper.fitText(doc, r.descripcion_producto || '', colW.descripcion - 4);
            doc.text(desc, colX.descripcion, currentY + 1, { width: colW.descripcion, lineBreak: false });
            doc.text(fmtGal(gal), colX.galones, currentY + 1, { width: colW.galones - 2, align: 'right' });
            doc.text(reportPdfHelper.fmt(mto), colX.monto, currentY + 1, { width: colW.monto - 2, align: 'right' });

            currentY += 12;
        }

        grandGalones += dayGalones;
        grandMonto += dayMonto;

        // Subtotal diario
        if (currentY > 695) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
        doc.rect(startX, currentY, pageW, 13).fill('#f8fafc');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
        doc.text(`TOTAL DIARIO (${reportPdfHelper.formatDate(fecha)}):`, colX.fecha + 2, currentY + 2, { width: 300 });
        doc.text(fmtGal(dayGalones), colX.galones, currentY + 2, { width: colW.galones - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(dayMonto), colX.monto, currentY + 2, { width: colW.monto - 2, align: 'right' });
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY + 13).lineTo(startX + pageW, currentY + 13).stroke();

        currentY += 16;
    }

    if (currentY > 680) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    // Gran Total
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
    currentY += 2;
    doc.rect(startX, currentY - 1, pageW, 15).fill('#f1f5f9');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL GENERAL:', colX.fecha + 2, currentY + 3, { width: 300 });
    doc.text(fmtGal(grandGalones), colX.galones, currentY + 3, { width: colW.galones - 2, align: 'right' });
    doc.text(reportPdfHelper.fmt(grandMonto), colX.monto, currentY + 3, { width: colW.monto - 2, align: 'right' });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY + 14).lineTo(startX + pageW, currentY + 14).stroke();
    currentY += 24;

    // === CUADRO RESUMEN DE OPERACIONES ===
    const summaryByProduct = {};
    for (const [, items] of allEntries) {
        for (const r of items) {
            const code = r.codigo_producto || 'SIN_COD';
            if (!summaryByProduct[code]) {
                summaryByProduct[code] = {
                    codigo: code,
                    descripcion: r.descripcion_producto || '',
                    galonaje: 0,
                    monto: 0
                };
            }
            summaryByProduct[code].galonaje += parseFloat(r.galones || 0);
            summaryByProduct[code].monto += parseFloat(r.monto || 0);
        }
    }
    const summaryList = Object.values(summaryByProduct).sort((a, b) => a.codigo.localeCompare(b.codigo));
    summaryList.forEach(s => {
        s.porcentaje = grandGalones > 0 ? (s.galonaje / grandGalones) * 100 : 0;
    });

    const summaryTableHeight = 14 + 14 + (summaryList.length * 12) + 20;
    if (currentY + summaryTableHeight > 690) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CUADRO RESUMEN DE OPERACIONES', startX, currentY, { width: pageW, align: 'center' });
    currentY += 14;

    const sumColX = {
        codigo: startX,
        descripcion: startX + 60,
        galonaje: startX + 60 + 202,
        monto: startX + 60 + 202 + 95,
        porcentaje: startX + 60 + 202 + 95 + 105
    };
    const sumColW = {
        codigo: 60,
        descripcion: 202,
        galonaje: 95,
        monto: 105,
        porcentaje: 90
    };

    doc.rect(startX, currentY, pageW, 14).fill('#f1f5f9');
    doc.strokeColor('#94a3b8').lineWidth(0.5).rect(startX, currentY, pageW, 14).stroke();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CODIGO', sumColX.codigo, currentY + 3, { width: sumColW.codigo, align: 'center' });
    doc.text('DESCRIPCION', sumColX.descripcion, currentY + 3, { width: sumColW.descripcion });
    doc.text('GALONAJE', sumColX.galonaje, currentY + 3, { width: sumColW.galonaje - 4, align: 'right' });
    doc.text('MONTO', sumColX.monto, currentY + 3, { width: sumColW.monto - 4, align: 'right' });
    doc.text('PORCENTAJE', sumColX.porcentaje, currentY + 3, { width: sumColW.porcentaje - 4, align: 'right' });
    currentY += 14;

    summaryList.forEach((r, idx) => {
        if (idx % 2 === 1) doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, currentY, pageW, 12).stroke();
        doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
        doc.text(r.codigo, sumColX.codigo, currentY + 2, { width: sumColW.codigo, align: 'center' });
        doc.text(r.descripcion, sumColX.descripcion, currentY + 2, { width: sumColW.descripcion });
        doc.text(fmtGal(r.galonaje), sumColX.galonaje, currentY + 2, { width: sumColW.galonaje - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(r.monto), sumColX.monto, currentY + 2, { width: sumColW.monto - 4, align: 'right' });
        doc.text(`${r.porcentaje.toFixed(2)}%`, sumColX.porcentaje, currentY + 2, { width: sumColW.porcentaje - 4, align: 'right' });
        currentY += 12;
    });
    currentY += 20;

    // === DISTRIBUCION DE VENTAS (GRAFICO Y LEYENDA) ===
    const chartAreaHeight = 160;
    if (currentY + chartAreaHeight > 690) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'portrait', subtitle);
    }

    doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Distribucion de Ventas', startX, currentY, { width: pageW, align: 'center' });
    currentY += 22;

    const chartY = currentY + 58;
    const cx = 170;
    const cy = chartY;
    const rx = 85;
    const ry = 46;
    const innerRx = 38;
    const innerRy = 20;
    const depth = 16;
    const explode = 8;

    const activeSlices = summaryList.filter(r => r.galonaje > 0);
    if (grandGalones > 0 && activeSlices.length > 0) {
        let currentAngle = -Math.PI / 2;
        const renderedSlices = [];

        activeSlices.forEach((s, idx) => {
            const sliceAngle = (s.porcentaje / 100) * Math.PI * 2;
            const startA = currentAngle;
            const endA = currentAngle + sliceAngle;
            const color = getFuelPalette(s.descripcion, idx);

            renderedSlices.push({
                label: s.descripcion,
                porcentaje: s.porcentaje,
                startA,
                endA,
                midA: (startA + endA) / 2,
                topColor: color.top,
                sideColor: color.side
            });

            currentAngle = endA;
        });

        // Painter's algorithm
        renderedSlices.sort((a, b) => Math.sin(a.midA) - Math.sin(b.midA));

        const labelsToDraw = [];
        for (const s of renderedSlices) {
            const { lx, ly } = draw3DDonutSlice(
                doc, cx, cy, rx, ry, innerRx, innerRy,
                s.startA, s.endA, depth, explode,
                s.topColor, s.sideColor
            );
            labelsToDraw.push({ text: `${s.porcentaje.toFixed(2)}%`, x: lx - 20, y: ly });
        }

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
        for (const lbl of labelsToDraw) {
            doc.text(lbl.text, lbl.x, lbl.y, { width: 40, align: 'center' });
        }
    } else {
        doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b');
        doc.text('No se registraron ventas de combustible en el período.', startX, chartY, { width: 300, align: 'center' });
    }

    // Legend box
    const legX = 325;
    const legY = currentY + 8;
    const legW = 227;
    const legH = (summaryList.length * 15) + 26;

    doc.rect(legX, legY, legW, legH).fillAndStroke('#ffffff', '#cbd5e1');

    let itemY = legY + 8;
    summaryList.forEach((r, idx) => {
        const color = getFuelPalette(r.descripcion, idx);
        doc.rect(legX + 10, itemY + 1, 9, 9).fill(color.top);
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(r.descripcion, legX + 25, itemY + 1, { width: 135 });
        doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
        doc.text(`${r.porcentaje.toFixed(2)}%`, legX + 165, itemY + 1, { width: 50, align: 'right' });
        itemY += 15;
    });

    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(legX + 10, itemY).lineTo(legX + legW - 10, itemY).stroke();
    itemY += 3;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Total:', legX + 25, itemY, { width: 100 });
    doc.text('100.00%', legX + 165, itemY, { width: 50, align: 'right' });

    currentY = Math.max(chartY + depth + ry + 20, legY + legH + 20);

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, totalItemsCount, 'Registros');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateLubricantsSoldPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const company = await resolveCompanyInfo(data);
    const title = 'REPORTE DE LUBRICANTES VENDIDOS';
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;

    const startX = 30;
    const pageW = 732;

    const colX = {
        fecha: 30,
        turno: 90,
        sucursal: 130,
        codigo: 215,
        descripcion: 270,
        inicial: 452,
        recarga: 502,
        final: 552,
        ventas: 602,
        precio: 652,
        total: 702
    };

    const colW = {
        fecha: 60,
        turno: 40,
        sucursal: 85,
        codigo: 55,
        descripcion: 182,
        inicial: 50,
        recarga: 50,
        final: 50,
        ventas: 50,
        precio: 50,
        total: 60
    };

    const fmtQty = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const drawTableHeader = (y) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha, y + 3, { width: colW.fecha, align: 'center', lineBreak: false });
        doc.text('TURNO', colX.turno, y + 3, { width: colW.turno, align: 'center', lineBreak: false });
        doc.text('SUCURSAL', colX.sucursal, y + 3, { width: colW.sucursal, lineBreak: false });
        doc.text('CÓDIGO', colX.codigo, y + 3, { width: colW.codigo, lineBreak: false });
        doc.text('DESCRIPCIÓN', colX.descripcion, y + 3, { width: colW.descripcion, lineBreak: false });
        doc.text('INICIAL', colX.inicial, y + 3, { width: colW.inicial - 2, align: 'right', lineBreak: false });
        doc.text('RECARGA', colX.recarga, y + 3, { width: colW.recarga - 2, align: 'right', lineBreak: false });
        doc.text('FINAL', colX.final, y + 3, { width: colW.final - 2, align: 'right', lineBreak: false });
        doc.text('VENDIDOS', colX.ventas, y + 3, { width: colW.ventas - 2, align: 'right', lineBreak: false });
        doc.text('PRECIO', colX.precio, y + 3, { width: colW.precio - 2, align: 'right', lineBreak: false });
        doc.text('TOTAL $', colX.total, y + 3, { width: colW.total - 2, align: 'right', lineBreak: false });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    currentY = drawTableHeader(currentY);

    const grouped = data.grouped || {};
    const allEntries = Object.entries(grouped);
    let grandUnits = 0;
    let grandTotal = 0;
    let totalItemsCount = 0;

    for (let di = 0; di < allEntries.length; di++) {
        const [fecha, items] = allEntries[di];
        let dayUnits = 0;
        let dayTotal = 0;

        for (let i = 0; i < items.length; i++) {
            const r = items[i];
            if (currentY > 510) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
            }

            if (i % 2 === 1) {
                doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
            }

            const u = parseFloat(r.ventas || 0);
            const tot = parseFloat(r.total || 0);
            dayUnits += u;
            dayTotal += tot;
            totalItemsCount++;

            doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
            doc.text(reportPdfHelper.formatDate(r.fecha_turno || fecha), colX.fecha, currentY + 1, { width: colW.fecha, align: 'center' });
            doc.text(`T-${r.numero_turno}`, colX.turno, currentY + 1, { width: colW.turno, align: 'center' });
            
            const suc = reportPdfHelper.fitText(doc, r.branch_name || 'Sin Sucursal', colW.sucursal - 4);
            doc.text(suc, colX.sucursal, currentY + 1, { width: colW.sucursal, lineBreak: false });

            doc.text(r.producto_codigo || '', colX.codigo, currentY + 1, { width: colW.codigo, lineBreak: false });
            
            const desc = reportPdfHelper.fitText(doc, r.producto_descripcion || '', colW.descripcion - 4);
            doc.text(desc, colX.descripcion, currentY + 1, { width: colW.descripcion, lineBreak: false });

            doc.text(fmtQty(r.lectura_inicial), colX.inicial, currentY + 1, { width: colW.inicial - 2, align: 'right' });
            doc.text(fmtQty(r.recarga), colX.recarga, currentY + 1, { width: colW.recarga - 2, align: 'right' });
            doc.text(fmtQty(r.lectura_final), colX.final, currentY + 1, { width: colW.final - 2, align: 'right' });

            doc.font('Helvetica-Bold').text(fmtQty(u), colX.ventas, currentY + 1, { width: colW.ventas - 2, align: 'right' });
            doc.font('Helvetica').text(reportPdfHelper.fmt(r.precio), colX.precio, currentY + 1, { width: colW.precio - 2, align: 'right' });
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(tot), colX.total, currentY + 1, { width: colW.total - 2, align: 'right' });

            currentY += 12;
        }

        grandUnits += dayUnits;
        grandTotal += dayTotal;

        // Subtotal diario
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
        doc.rect(startX, currentY, pageW, 13).fill('#f8fafc');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
        doc.text(`SUBTOTAL DIARIO (${reportPdfHelper.formatDate(fecha)}):`, colX.fecha + 2, currentY + 2, { width: 350 });
        doc.text(fmtQty(dayUnits), colX.ventas, currentY + 2, { width: colW.ventas - 2, align: 'right' });
        doc.text(reportPdfHelper.fmt(dayTotal), colX.total, currentY + 2, { width: colW.total - 2, align: 'right' });
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(startX, currentY + 13).lineTo(startX + pageW, currentY + 13).stroke();

        currentY += 16;
    }

    if (currentY > 500) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    // Gran Total
    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
    currentY += 2;
    doc.rect(startX, currentY - 1, pageW, 15).fill('#f1f5f9');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL GENERAL LUBRICANTES VENDIDOS:', colX.fecha + 2, currentY + 3, { width: 350 });
    doc.text(fmtQty(grandUnits), colX.ventas, currentY + 3, { width: colW.ventas - 2, align: 'right' });
    doc.text(reportPdfHelper.fmt(grandTotal), colX.total, currentY + 3, { width: colW.total - 2, align: 'right' });
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY + 14).lineTo(startX + pageW, currentY + 14).stroke();
    currentY += 24;

    // === CUADRO RESUMEN DE VENTAS POR PRODUCTO ===
    const summaryList = data.summaryList || [];
    const summaryTableHeight = 16 + 14 + (summaryList.length * 12) + 20;
    if (currentY + Math.min(summaryTableHeight, 150) > 510) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CUADRO RESUMEN DE VENTAS POR PRODUCTO', startX, currentY, { width: pageW, align: 'center', lineBreak: false });
    currentY += 14;

    const sumColX = {
        codigo: 30,
        descripcion: 100,
        unidades: 372,
        precio: 462,
        monto: 557,
        porcentaje: 652
    };
    const sumColW = {
        codigo: 70,
        descripcion: 272,
        unidades: 90,
        precio: 95,
        monto: 95,
        porcentaje: 110
    };

    const drawSummaryHeader = (y) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.strokeColor('#94a3b8').lineWidth(0.5).rect(startX, y, pageW, 14).stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('CÓDIGO', sumColX.codigo, y + 3, { width: sumColW.codigo, align: 'center', lineBreak: false });
        doc.text('DESCRIPCIÓN DEL PRODUCTO', sumColX.descripcion, y + 3, { width: sumColW.descripcion, lineBreak: false });
        doc.text('UNIDADES VENDIDAS', sumColX.unidades, y + 3, { width: sumColW.unidades - 4, align: 'right', lineBreak: false });
        doc.text('PRECIO PROMEDIO', sumColX.precio, y + 3, { width: sumColW.precio - 4, align: 'right', lineBreak: false });
        doc.text('MONTO TOTAL', sumColX.monto, y + 3, { width: sumColW.monto - 4, align: 'right', lineBreak: false });
        doc.text('% PARTICIPACIÓN', sumColX.porcentaje, y + 3, { width: sumColW.porcentaje - 4, align: 'right', lineBreak: false });
        return y + 14;
    };

    currentY = drawSummaryHeader(currentY);

    summaryList.forEach((s, idx) => {
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawSummaryHeader(currentY);
        }

        if (idx % 2 === 1) doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX, currentY, pageW, 12).stroke();
        doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
        doc.text(s.codigo || '', sumColX.codigo, currentY + 2, { width: sumColW.codigo, align: 'center', lineBreak: false });
        
        const desc = reportPdfHelper.fitText(doc, s.descripcion || '', sumColW.descripcion - 4);
        doc.text(desc, sumColX.descripcion, currentY + 2, { width: sumColW.descripcion, lineBreak: false });

        doc.text(fmtQty(s.unidades), sumColX.unidades, currentY + 2, { width: sumColW.unidades - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.precio_promedio), sumColX.precio, currentY + 2, { width: sumColW.precio - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.total), sumColX.monto, currentY + 2, { width: sumColW.monto - 4, align: 'right', lineBreak: false });
        doc.text(`${(s.porcentaje || 0).toFixed(2)}%`, sumColX.porcentaje, currentY + 2, { width: sumColW.porcentaje - 4, align: 'right', lineBreak: false });
        currentY += 12;
    });

    // Summary Total Row
    if (summaryList.length > 0) {
        doc.rect(startX, currentY - 1, pageW, 14).fill('#f1f5f9');
        doc.strokeColor('#94a3b8').lineWidth(0.5).rect(startX, currentY - 1, pageW, 14).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTAL:', sumColX.codigo, currentY + 2, { width: sumColW.codigo, align: 'center', lineBreak: false });
        doc.text(fmtQty(grandUnits), sumColX.unidades, currentY + 2, { width: sumColW.unidades - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotal), sumColX.monto, currentY + 2, { width: sumColW.monto - 4, align: 'right', lineBreak: false });
        doc.text('100.00%', sumColX.porcentaje, currentY + 2, { width: sumColW.porcentaje - 4, align: 'right', lineBreak: false });
        currentY += 20;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, totalItemsCount, 'Operaciones');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateComplementariasPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const company = await resolveCompanyInfo(data);
    const isDetailed = data.include_details !== false && data.modalidad !== 'resumido';
    const title = isDetailed 
        ? 'REPORTE DETALLADO DE COMPLEMENTARIAS EMITIDAS'
        : 'REPORTE RESUMIDO DE COMPLEMENTARIAS EMITIDAS';
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}${data.turno && data.turno !== 'all' ? `    |    TURNO: ${data.turno}` : ''}`;

    const startX = 30;
    const pageW = 732;

    const fmtQty = (v, dec = 2) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

    const groupedByDay = data.groupedByDay || [];
    const grandTotals = data.grandTotals || { dtes_count: 0, galones: 0, gravado: 0, iva: 0, fovial: 0, cotrans: 0, total: 0 };
    const summaryByProduct = data.summaryByProduct || [];

    const summaryByDay = data.summaryByDay || (data.groupedByDay || []).map(day => {
        const shifts = day.shifts || [];
        const branchNames = [...new Set(shifts.map(s => s.branch_name).filter(Boolean))].join(', ');
        const turnosArr = [...new Set(shifts.map(s => s.turno))].sort((a, b) => a - b);
        const turnosStr = turnosArr.length > 0 ? (turnosArr.length === 1 ? `Turno ${turnosArr[0]}` : `Turnos ${turnosArr.join(', ')}`) : 'Turno 1';

        return {
            fecha: day.fecha,
            sucursal: branchNames || 'Sin Sucursal',
            turnos: turnosStr,
            totals: day.totals,
            products: Object.values(day.products || {})
        };
    });

    // --- Column configurations ---

    // 1. Day Consolidated Summary Table Columns (width sum = 732, startX = 30 to 762)
    const dayColX = {
        fecha: 30,
        sucursal: 98,
        turnos: 248,
        dtes: 314,
        galones: 370,
        gravado: 446,
        iva: 522,
        fovial: 586,
        cotrans: 644,
        total: 700
    };
    const dayColW = {
        fecha: 66,
        sucursal: 148,
        turnos: 64,
        dtes: 54,
        galones: 74,
        gravado: 74,
        iva: 62,
        fovial: 56,
        cotrans: 54,
        total: 62
    };

    const drawDaySummaryHeader = (y) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', dayColX.fecha, y + 3, { width: dayColW.fecha, align: 'center', lineBreak: false });
        doc.text('SUCURSAL', dayColX.sucursal, y + 3, { width: dayColW.sucursal, lineBreak: false });
        doc.text('TURNOS', dayColX.turnos, y + 3, { width: dayColW.turnos, align: 'center', lineBreak: false });
        doc.text('CANT. DTES', dayColX.dtes, y + 3, { width: dayColW.dtes - 4, align: 'right', lineBreak: false });
        doc.text('TOTAL GALONES', dayColX.galones, y + 3, { width: dayColW.galones - 4, align: 'right', lineBreak: false });
        doc.text('VENTA GRAVADA', dayColX.gravado, y + 3, { width: dayColW.gravado - 4, align: 'right', lineBreak: false });
        doc.text('IVA 13%', dayColX.iva, y + 3, { width: dayColW.iva - 4, align: 'right', lineBreak: false });
        doc.text('FOVIAL', dayColX.fovial, y + 3, { width: dayColW.fovial - 4, align: 'right', lineBreak: false });
        doc.text('COTRANS', dayColX.cotrans, y + 3, { width: dayColW.cotrans - 4, align: 'right', lineBreak: false });
        doc.text('TOTAL ($)', dayColX.total, y + 3, { width: dayColW.total - 2, align: 'right', lineBreak: false });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();
        return y + 15;
    };

    // 2. DTE Detail Table Columns (width sum = 732: 36 + 114 + 138 + 94 + 50 + 58 + 52 + 50 + 50 + 72 = 714, comfortably within 732)
    const detColX = {
        hora: 30,
        numero_control: 68,
        codigo_generacion: 184,
        producto: 324,
        galones: 420,
        gravado: 472,
        iva: 532,
        fovial: 586,
        cotrans: 638,
        total: 690
    };
    const detColW = {
        hora: 36,
        numero_control: 114,
        codigo_generacion: 138,
        producto: 94,
        galones: 50,
        gravado: 58,
        iva: 52,
        fovial: 50,
        cotrans: 50,
        total: 72
    };

    const drawDetailTableHeader = (y) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('HORA', detColX.hora, y + 3, { width: detColW.hora, align: 'center', lineBreak: false });
        doc.text('N° CONTROL DTE', detColX.numero_control, y + 3, { width: detColW.numero_control, lineBreak: false });
        doc.text('CÓDIGO GENERACIÓN', detColX.codigo_generacion, y + 3, { width: detColW.codigo_generacion, lineBreak: false });
        doc.text('COMBUSTIBLE', detColX.producto, y + 3, { width: detColW.producto, lineBreak: false });
        doc.text('GALONES', detColX.galones, y + 3, { width: detColW.galones - 2, align: 'right', lineBreak: false });
        doc.text('GRAVADO', detColX.gravado, y + 3, { width: detColW.gravado - 2, align: 'right', lineBreak: false });
        doc.text('IVA 13%', detColX.iva, y + 3, { width: detColW.iva - 2, align: 'right', lineBreak: false });
        doc.text('FOVIAL', detColX.fovial, y + 3, { width: detColW.fovial - 2, align: 'right', lineBreak: false });
        doc.text('COTRANS', detColX.cotrans, y + 3, { width: detColW.cotrans - 2, align: 'right', lineBreak: false });
        doc.text('TOTAL ($)', detColX.total, y + 3, { width: detColW.total - 2, align: 'right', lineBreak: false });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();
        return y + 15;
    };

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    const drawDaySummaryTable = () => {
        if (currentY > 440) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        }

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('RESUMEN CONSOLIDADO POR DÍA', startX, currentY, { width: pageW, align: 'center', lineBreak: false });
        currentY += 14;
        currentY = drawDaySummaryHeader(currentY);

        let rowCount = 0;
        for (let di = 0; di < summaryByDay.length; di++) {
            const d = summaryByDay[di];
            if (currentY > 505) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = drawDaySummaryHeader(currentY);
            }

            if (rowCount % 2 === 1) doc.rect(startX, currentY - 1, pageW, 12).fill('#f8fafc');
            rowCount++;

            doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
            doc.text(reportPdfHelper.formatDate(d.fecha), dayColX.fecha, currentY + 1, { width: dayColW.fecha, align: 'center', lineBreak: false });
            const suc = reportPdfHelper.fitText(doc, d.sucursal || 'Sin Sucursal', dayColW.sucursal - 4);
            doc.text(suc, dayColX.sucursal, currentY + 1, { width: dayColW.sucursal, lineBreak: false });
            doc.text(d.turnos || '', dayColX.turnos, currentY + 1, { width: dayColW.turnos, align: 'center', lineBreak: false });
            doc.text(String(d.totals.dtes_count || 0), dayColX.dtes, currentY + 1, { width: dayColW.dtes - 4, align: 'right', lineBreak: false });
            doc.text(fmtQty(d.totals.galones, 2), dayColX.galones, currentY + 1, { width: dayColW.galones - 4, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(d.totals.gravado), dayColX.gravado, currentY + 1, { width: dayColW.gravado - 4, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(d.totals.iva), dayColX.iva, currentY + 1, { width: dayColW.iva - 4, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(d.totals.fovial), dayColX.fovial, currentY + 1, { width: dayColW.fovial - 4, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(d.totals.cotrans), dayColX.cotrans, currentY + 1, { width: dayColW.cotrans - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(d.totals.total), dayColX.total, currentY + 1, { width: dayColW.total - 2, align: 'right', lineBreak: false });
            currentY += 12;
        }

        if (currentY > 500) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawDaySummaryHeader(currentY);
        }

        doc.strokeColor('#94a3b8').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
        currentY += 2;
        doc.rect(startX, currentY - 1, pageW, 14).fill('#e2e8f0');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTAL GENERAL COMPLEMENTARIAS EMITIDAS:', dayColX.fecha + 2, currentY + 3, { width: dayColW.fecha + dayColW.sucursal + dayColW.turnos - 4, lineBreak: false });
        doc.text(String(grandTotals.dtes_count || 0), dayColX.dtes, currentY + 3, { width: dayColW.dtes - 4, align: 'right', lineBreak: false });
        doc.text(fmtQty(grandTotals.galones, 2), dayColX.galones, currentY + 3, { width: dayColW.galones - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.gravado), dayColX.gravado, currentY + 3, { width: dayColW.gravado - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.iva), dayColX.iva, currentY + 3, { width: dayColW.iva - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.fovial), dayColX.fovial, currentY + 3, { width: dayColW.fovial - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.cotrans), dayColX.cotrans, currentY + 3, { width: dayColW.cotrans - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.total), dayColX.total, currentY + 3, { width: dayColW.total - 2, align: 'right', lineBreak: false });
        doc.strokeColor('#64748b').lineWidth(0.8).moveTo(startX, currentY + 13).lineTo(startX + pageW, currentY + 13).stroke();
        currentY += 22;
    };

    if (isDetailed) {
        // === RENDER DETAILED REPORT (BY DAY -> BY SHIFT -> INDIVIDUAL DTES) ===
        for (let di = 0; di < groupedByDay.length; di++) {
            const dayGroup = groupedByDay[di];
            const shifts = dayGroup.shifts || [];

            for (let si = 0; si < shifts.length; si++) {
                const s = shifts[si];
                const dtes = s.dtes || [];

                if (currentY > 470) {
                    doc.addPage();
                    currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                }

                // Shift Banner Header
                doc.rect(startX, currentY, pageW, 15).fill('#e0e7ff');
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text(
                    `FECHA TURNO: ${reportPdfHelper.formatDate(dayGroup.fecha)}   •   TURNO: ${s.turno}   •   SUCURSAL: ${s.branch_name.toUpperCase()}   •   CANTIDAD DTES: ${s.totals.dtes_count}`,
                    startX + 8,
                    currentY + 3.5,
                    { width: pageW - 16, lineBreak: false }
                );
                currentY += 16;
                currentY = drawDetailTableHeader(currentY);

                // DTE Rows
                for (let dti = 0; dti < dtes.length; dti++) {
                    const dte = dtes[dti];
                    if (currentY > 505) {
                        doc.addPage();
                        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                        doc.rect(startX, currentY, pageW, 14).fill('#e0e7ff');
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#3730a3');
                        doc.text(
                            `FECHA: ${reportPdfHelper.formatDate(dayGroup.fecha)} • TURNO ${s.turno} • ${s.branch_name.toUpperCase()} (Continuación)`,
                            startX + 8,
                            currentY + 3,
                            { width: pageW - 16, lineBreak: false }
                        );
                        currentY += 15;
                        currentY = drawDetailTableHeader(currentY);
                    }

                    if (dti % 2 === 1) {
                        doc.rect(startX, currentY - 1, pageW, 13).fill('#f8fafc');
                    }

                    const fuelDesc = dte.items.map(it => it.producto).join(', ') || 'Combustible';
                    const totalGln = dte.items.reduce((acc, it) => acc + (it.galones || 0), 0);

                    doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b');
                    doc.text(dte.hora_emision || '', detColX.hora, currentY + 2, { width: detColW.hora, align: 'center', lineBreak: false });
                    
                    doc.font('Helvetica-Bold').fontSize(6).text(dte.numero_control || '', detColX.numero_control, currentY + 2, { width: detColW.numero_control - 2, lineBreak: false });
                    
                    doc.font('Helvetica').fontSize(5.5).text(dte.codigo_generacion || '', detColX.codigo_generacion, currentY + 2.5, { width: detColW.codigo_generacion - 2, lineBreak: false });
                    
                    const fittedFuel = reportPdfHelper.fitText(doc, fuelDesc, detColW.producto - 4);
                    doc.font('Helvetica').fontSize(6.5).text(fittedFuel, detColX.producto, currentY + 2, { width: detColW.producto, lineBreak: false });

                    doc.text(fmtQty(totalGln, 2), detColX.galones, currentY + 2, { width: detColW.galones - 2, align: 'right', lineBreak: false });
                    doc.text(reportPdfHelper.fmt(dte.total_gravado), detColX.gravado, currentY + 2, { width: detColW.gravado - 2, align: 'right', lineBreak: false });
                    doc.text(reportPdfHelper.fmt(dte.total_iva), detColX.iva, currentY + 2, { width: detColW.iva - 2, align: 'right', lineBreak: false });
                    doc.text(reportPdfHelper.fmt(dte.fovial), detColX.fovial, currentY + 2, { width: detColW.fovial - 2, align: 'right', lineBreak: false });
                    doc.text(reportPdfHelper.fmt(dte.cotrans), detColX.cotrans, currentY + 2, { width: detColW.cotrans - 2, align: 'right', lineBreak: false });
                    doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(dte.total_pagar), detColX.total, currentY + 2, { width: detColW.total - 2, align: 'right', lineBreak: false });

                    currentY += 13;
                }

                // Subtotal Turno Row
                if (currentY > 505) {
                    doc.addPage();
                    currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                }
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
                doc.rect(startX, currentY, pageW, 13).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#334155');
                doc.text(`TOTAL TURNO ${s.turno} (${s.totals.dtes_count} DTEs):`, detColX.hora + 2, currentY + 2.5, { width: 380, lineBreak: false });
                doc.text(fmtQty(s.totals.galones, 2), detColX.galones, currentY + 2.5, { width: detColW.galones - 2, align: 'right', lineBreak: false });
                doc.text(reportPdfHelper.fmt(s.totals.gravado), detColX.gravado, currentY + 2.5, { width: detColW.gravado - 2, align: 'right', lineBreak: false });
                doc.text(reportPdfHelper.fmt(s.totals.iva), detColX.iva, currentY + 2.5, { width: detColW.iva - 2, align: 'right', lineBreak: false });
                doc.text(reportPdfHelper.fmt(s.totals.fovial), detColX.fovial, currentY + 2.5, { width: detColW.fovial - 2, align: 'right', lineBreak: false });
                doc.text(reportPdfHelper.fmt(s.totals.cotrans), detColX.cotrans, currentY + 2.5, { width: detColW.cotrans - 2, align: 'right', lineBreak: false });
                doc.text(reportPdfHelper.fmt(s.totals.total), detColX.total, currentY + 2.5, { width: detColW.total - 2, align: 'right', lineBreak: false });
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY + 13).lineTo(startX + pageW, currentY + 13).stroke();
                currentY += 17;
            }

            // Subtotal Diario Row
            if (currentY > 505) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            }
            doc.strokeColor('#94a3b8').lineWidth(0.6).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
            doc.rect(startX, currentY, pageW, 14).fill('#e2e8f0');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`SUBTOTAL DÍA (${reportPdfHelper.formatDate(dayGroup.fecha)}) (${dayGroup.totals.dtes_count} DTEs):`, detColX.hora + 2, currentY + 3, { width: 380, lineBreak: false });
            doc.text(fmtQty(dayGroup.totals.galones, 2), detColX.galones, currentY + 3, { width: detColW.galones - 2, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(dayGroup.totals.gravado), detColX.gravado, currentY + 3, { width: detColW.gravado - 2, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(dayGroup.totals.iva), detColX.iva, currentY + 3, { width: detColW.iva - 2, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(dayGroup.totals.fovial), detColX.fovial, currentY + 3, { width: detColW.fovial - 2, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(dayGroup.totals.cotrans), detColX.cotrans, currentY + 3, { width: detColW.cotrans - 2, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(dayGroup.totals.total), detColX.total, currentY + 3, { width: detColW.total - 2, align: 'right', lineBreak: false });
            doc.strokeColor('#94a3b8').lineWidth(0.6).moveTo(startX, currentY + 14).lineTo(startX + pageW, currentY + 14).stroke();
            currentY += 19;
        }

        // Gran Total General
        if (currentY > 495) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        }
        doc.strokeColor('#0f172a').lineWidth(0.8).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
        currentY += 2;
        doc.rect(startX, currentY - 1, pageW, 16).fill('#cbd5e1');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`TOTAL GENERAL COMPLEMENTARIAS (${grandTotals.dtes_count} DTEs):`, detColX.hora + 2, currentY + 3.5, { width: 380, lineBreak: false });
        doc.text(fmtQty(grandTotals.galones, 2), detColX.galones, currentY + 3.5, { width: detColW.galones - 2, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.gravado), detColX.gravado, currentY + 3.5, { width: detColW.gravado - 2, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.iva), detColX.iva, currentY + 3.5, { width: detColW.iva - 2, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.fovial), detColX.fovial, currentY + 3.5, { width: detColW.fovial - 2, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.cotrans), detColX.cotrans, currentY + 3.5, { width: detColW.cotrans - 2, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.total), detColX.total, currentY + 3.5, { width: detColW.total - 2, align: 'right', lineBreak: false });
        doc.strokeColor('#0f172a').lineWidth(0.8).moveTo(startX, currentY + 15).lineTo(startX + pageW, currentY + 15).stroke();
        currentY += 25;

        // Cuadro Resumen Consolidado por Día
        drawDaySummaryTable();
    } else {
        // === RENDER SUMMARY-ONLY REPORT ===
        drawDaySummaryTable();
    }

    // === CUADRO RESUMEN CONSOLIDADO POR COMBUSTIBLE ===
    const summaryTableHeight = 16 + 14 + (summaryByProduct.length * 12) + 20;
    if (currentY + Math.min(summaryTableHeight, 140) > 510) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
    }

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('CUADRO RESUMEN CONSOLIDADO POR COMBUSTIBLE', startX, currentY, { width: pageW, align: 'center', lineBreak: false });
    currentY += 14;

    const fuelColX = {
        producto: 60,
        galones: 280,
        gravado: 400,
        total: 520,
        porcentaje: 630
    };
    const fuelColW = {
        producto: 210,
        galones: 110,
        gravado: 110,
        total: 100,
        porcentaje: 70
    };

    const drawFuelHeader = (y) => {
        doc.rect(startX + 30, y, pageW - 60, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('COMBUSTIBLE', fuelColX.producto, y + 3, { width: fuelColW.producto, lineBreak: false });
        doc.text('TOTAL GALONES', fuelColX.galones, y + 3, { width: fuelColW.galones - 4, align: 'right', lineBreak: false });
        doc.text('VENTA GRAVADA', fuelColX.gravado, y + 3, { width: fuelColW.gravado - 4, align: 'right', lineBreak: false });
        doc.text('TOTAL FACTURADO', fuelColX.total, y + 3, { width: fuelColW.total - 4, align: 'right', lineBreak: false });
        doc.text('% VOLUMEN', fuelColX.porcentaje, y + 3, { width: fuelColW.porcentaje - 4, align: 'right', lineBreak: false });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + 30, y + 14).lineTo(startX + pageW - 30, y + 14).stroke();
        return y + 15;
    };

    currentY = drawFuelHeader(currentY);

    summaryByProduct.forEach((s, idx) => {
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawFuelHeader(currentY);
        }

        if (idx % 2 === 1) doc.rect(startX + 30, currentY - 1, pageW - 60, 12).fill('#f8fafc');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).rect(startX + 30, currentY - 1, pageW - 60, 12).stroke();
        doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
        doc.text(s.producto || '', fuelColX.producto, currentY + 2, { width: fuelColW.producto, lineBreak: false });
        doc.text(fmtQty(s.galones, 2), fuelColX.galones, currentY + 2, { width: fuelColW.galones - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.gravado || s.total), fuelColX.gravado, currentY + 2, { width: fuelColW.gravado - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.total), fuelColX.total, currentY + 2, { width: fuelColW.total - 4, align: 'right', lineBreak: false });
        doc.text(`${(s.porcentaje || 0).toFixed(2)}%`, fuelColX.porcentaje, currentY + 2, { width: fuelColW.porcentaje - 4, align: 'right', lineBreak: false });
        currentY += 12;
    });

    if (summaryByProduct.length > 0) {
        doc.rect(startX + 30, currentY - 1, pageW - 60, 14).fill('#f1f5f9');
        doc.strokeColor('#94a3b8').lineWidth(0.5).rect(startX + 30, currentY - 1, pageW - 60, 14).stroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTAL:', fuelColX.producto, currentY + 2, { width: fuelColW.producto, lineBreak: false });
        doc.text(fmtQty(grandTotals.galones, 2), fuelColX.galones, currentY + 2, { width: fuelColW.galones - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.gravado), fuelColX.gravado, currentY + 2, { width: fuelColW.gravado - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(grandTotals.total), fuelColX.total, currentY + 2, { width: fuelColW.total - 4, align: 'right', lineBreak: false });
        doc.text('100.00%', fuelColX.porcentaje, currentY + 2, { width: fuelColW.porcentaje - 4, align: 'right', lineBreak: false });
        currentY += 20;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, grandTotals.dtes_count, 'Complementarias');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

// --- ARQUEOS DE CAJA Y ANÁLISIS DE VENTAS/LECTURAS ---
/**
 * Generates a PDF buffer for the arqueos report (cortes de caja por turno POS)
 */
const generateArqueosReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const periodText = (data.start_date && data.end_date)
        ? `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`
        : 'TODOS LOS REGISTROS';
    const subtitle = data.branch_name ? `SUCURSAL: ${String(data.branch_name).toUpperCase()}` : null;

    const startX = 30;
    const totalWidth = 732;
    const colWidths = {
        fecha: 56, turno: 24, sucursal: 81, pos: 60, vendedor: 81, estado: 46,
        fondo: 45, ventas: 52, ingresos: 42, gastos: 42, remesas: 42, puntos: 38,
        esperado: 57, contado: 57, diferencia: 57
    };

    const drawHeader = () => {
        reportPdfHelper.renderHeader(doc, comp, 'REPORTE DE ARQUEOS (CORTES DE CAJA)', periodText, 'landscape', subtitle);
    };

    const drawTableHeader = () => {
        const y = doc.y;
        doc.rect(startX, y, totalWidth, 14).fill('#f1f5f9');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX;
        doc.text('FECHA', x, y + 3, { width: colWidths.fecha }); x += colWidths.fecha;
        doc.text('#', x, y + 3, { width: colWidths.turno }); x += colWidths.turno;
        doc.text('SUCURSAL', x, y + 3, { width: colWidths.sucursal }); x += colWidths.sucursal;
        doc.text('POS', x, y + 3, { width: colWidths.pos }); x += colWidths.pos;
        doc.text('VENDEDOR', x, y + 3, { width: colWidths.vendedor }); x += colWidths.vendedor;
        doc.text('ESTADO', x, y + 3, { width: colWidths.estado }); x += colWidths.estado;
        doc.text('FONDO', x, y + 3, { align: 'right', width: colWidths.fondo }); x += colWidths.fondo;
        doc.text('VENTAS', x, y + 3, { align: 'right', width: colWidths.ventas }); x += colWidths.ventas;
        doc.text('INGRESOS', x, y + 3, { align: 'right', width: colWidths.ingresos }); x += colWidths.ingresos;
        doc.text('GASTOS', x, y + 3, { align: 'right', width: colWidths.gastos }); x += colWidths.gastos;
        doc.text('REMESAS', x, y + 3, { align: 'right', width: colWidths.remesas }); x += colWidths.remesas;
        doc.text('PUNTOS', x, y + 3, { align: 'right', width: colWidths.puntos }); x += colWidths.puntos;
        doc.text('ESPERADO', x, y + 3, { align: 'right', width: colWidths.esperado }); x += colWidths.esperado;
        doc.text('CONTADO', x, y + 3, { align: 'right', width: colWidths.contado }); x += colWidths.contado;
        doc.text('DIFERENCIA', x, y + 3, { align: 'right', width: colWidths.diferencia });
        doc.moveTo(startX, y + 14).lineTo(startX + totalWidth, y + 14).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        doc.y = y + 18;
    };

    drawHeader();
    drawTableHeader();

    const items = data.data || [];
    items.forEach(r => {
        if (doc.y > 510) {
            doc.addPage();
            drawHeader();
            drawTableHeader();
        }
        const y = doc.y;
        let x = startX;
        doc.font('Helvetica').fontSize(6.5).fillColor('#0f172a');
        doc.text(r.fecha || '---', x, y, { width: colWidths.fecha, lineBreak: false }); x += colWidths.fecha;
        doc.text(String(r.turno || '---'), x, y, { width: colWidths.turno, lineBreak: false }); x += colWidths.turno;
        doc.text(r.sucursal || '---', x, y, { width: colWidths.sucursal, lineBreak: false, ellipsis: true }); x += colWidths.sucursal;
        doc.text(r.pos || '---', x, y, { width: colWidths.pos, lineBreak: false, ellipsis: true }); x += colWidths.pos;
        doc.text(r.vendedor || '---', x, y, { width: colWidths.vendedor, lineBreak: false, ellipsis: true }); x += colWidths.vendedor;
        doc.text(r.estado || '---', x, y, { width: colWidths.estado, lineBreak: false }); x += colWidths.estado;
        doc.text(reportPdfHelper.fmt(r.fondo), x, y, { align: 'right', width: colWidths.fondo }); x += colWidths.fondo;
        doc.text(reportPdfHelper.fmt(r.ventas), x, y, { align: 'right', width: colWidths.ventas }); x += colWidths.ventas;
        doc.text(reportPdfHelper.fmt(r.ingresos), x, y, { align: 'right', width: colWidths.ingresos }); x += colWidths.ingresos;
        doc.text(reportPdfHelper.fmt(r.gastos), x, y, { align: 'right', width: colWidths.gastos }); x += colWidths.gastos;
        doc.text(reportPdfHelper.fmt(r.remesas), x, y, { align: 'right', width: colWidths.remesas }); x += colWidths.remesas;
        doc.text(reportPdfHelper.fmt(r.puntos), x, y, { align: 'right', width: colWidths.puntos }); x += colWidths.puntos;
        doc.text(reportPdfHelper.fmt(r.esperado), x, y, { align: 'right', width: colWidths.esperado }); x += colWidths.esperado;
        doc.text(reportPdfHelper.fmt(r.contado), x, y, { align: 'right', width: colWidths.contado }); x += colWidths.contado;
        doc.text(reportPdfHelper.fmt(r.diferencia), x, y, { align: 'right', width: colWidths.diferencia });
        doc.y = y + 10;
    });

    // Línea de totales
    if (doc.y > 510) {
        doc.addPage();
        drawHeader();
        drawTableHeader();
    }

    const totalsY = doc.y + 4;
    doc.moveTo(startX, totalsY).lineTo(startX + totalWidth, totalsY).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
    const labelW = colWidths.fecha + colWidths.turno + colWidths.sucursal + colWidths.pos + colWidths.vendedor + colWidths.estado;
    doc.text('TOTALES', startX, totalsY + 3, { width: labelW });
    let tX = startX + labelW;
    doc.text(reportPdfHelper.fmt(data.totales?.fondo), tX, totalsY + 3, { align: 'right', width: colWidths.fondo }); tX += colWidths.fondo;
    doc.text(reportPdfHelper.fmt(data.totales?.ventas), tX, totalsY + 3, { align: 'right', width: colWidths.ventas }); tX += colWidths.ventas;
    doc.text(reportPdfHelper.fmt(data.totales?.ingresos), tX, totalsY + 3, { align: 'right', width: colWidths.ingresos }); tX += colWidths.ingresos;
    doc.text(reportPdfHelper.fmt(data.totales?.gastos), tX, totalsY + 3, { align: 'right', width: colWidths.gastos }); tX += colWidths.gastos;
    doc.text(reportPdfHelper.fmt(data.totales?.remesas), tX, totalsY + 3, { align: 'right', width: colWidths.remesas }); tX += colWidths.remesas;
    doc.text(reportPdfHelper.fmt(data.totales?.puntos), tX, totalsY + 3, { align: 'right', width: colWidths.puntos }); tX += colWidths.puntos;
    doc.text(reportPdfHelper.fmt(data.totales?.esperado), tX, totalsY + 3, { align: 'right', width: colWidths.esperado }); tX += colWidths.esperado;
    doc.text(reportPdfHelper.fmt(data.totales?.contado), tX, totalsY + 3, { align: 'right', width: colWidths.contado }); tX += colWidths.contado;
    doc.text(reportPdfHelper.fmt(data.totales?.diferencia), tX, totalsY + 3, { align: 'right', width: colWidths.diferencia });
    doc.moveTo(startX, totalsY + 14).lineTo(startX + totalWidth, totalsY + 14).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.y = totalsY + 20;

    // Detalle de Gastos y Remesas
    const gastosList = data.gastos_detalle || [];
    const remesasList = data.remesas_detalle || [];
    if (gastosList.length > 0 || remesasList.length > 0) {
        if (doc.y > 420) {
            doc.addPage();
            drawHeader();
        } else {
            doc.y += 10;
        }

        const leftColX = startX;
        const colW = 350;
        const gap = 32;
        const rightColX = leftColX + colW + gap;

        const gCols = { fecha: 50, turno: 25, pos: 55, descripcion: 160, monto: 60 };
        const rCols = { fecha: 48, turno: 25, numero: 32, pos: 50, descripcion: 135, monto: 60 };

        const drawDetailHeaders = () => {
            const topY = doc.y;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('DETALLE DE GASTOS', leftColX, topY, { width: colW });
            doc.text('DETALLE DE REMESAS', rightColX, topY, { width: colW });

            const headerY = topY + 12;
            doc.rect(leftColX, headerY, colW, 12).fill('#f1f5f9');
            doc.rect(rightColX, headerY, colW, 12).fill('#f1f5f9');

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');

            // Gastos
            let gx = leftColX;
            doc.text('FECHA', gx, headerY + 2, { width: gCols.fecha }); gx += gCols.fecha;
            doc.text('TURNO', gx, headerY + 2, { width: gCols.turno }); gx += gCols.turno;
            doc.text('POS', gx, headerY + 2, { width: gCols.pos }); gx += gCols.pos;
            doc.text('DESCRIPCIÓN', gx, headerY + 2, { width: gCols.descripcion }); gx += gCols.descripcion;
            doc.text('MONTO', gx, headerY + 2, { align: 'right', width: gCols.monto });

            // Remesas
            let rx = rightColX;
            doc.text('FECHA', rx, headerY + 2, { width: rCols.fecha }); rx += rCols.fecha;
            doc.text('TURNO', rx, headerY + 2, { width: rCols.turno }); rx += rCols.turno;
            doc.text('N°', rx, headerY + 2, { width: rCols.numero }); rx += rCols.numero;
            doc.text('POS', rx, headerY + 2, { width: rCols.pos }); rx += rCols.pos;
            doc.text('DESCRIPCIÓN', rx, headerY + 2, { width: rCols.descripcion }); rx += rCols.descripcion;
            doc.text('MONTO', rx, headerY + 2, { align: 'right', width: rCols.monto });

            const lineY = headerY + 12;
            doc.moveTo(leftColX, lineY).lineTo(leftColX + colW, lineY).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.moveTo(rightColX, lineY).lineTo(rightColX + colW, lineY).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            return lineY + 4;
        };

        let curY = drawDetailHeaders();
        const maxRows = Math.max(gastosList.length, remesasList.length);

        for (let i = 0; i < maxRows; i++) {
            if (curY > 510) {
                doc.addPage();
                drawHeader();
                curY = drawDetailHeaders();
            }

            const rowH = 10;
            doc.fontSize(6).font('Helvetica').fillColor('#0f172a');

            if (i < gastosList.length) {
                const g = gastosList[i];
                let gx = leftColX;
                doc.text(g.fecha || '---', gx, curY, { width: gCols.fecha, lineBreak: false }); gx += gCols.fecha;
                doc.text(String(g.turno || '---'), gx, curY, { width: gCols.turno, lineBreak: false }); gx += gCols.turno;
                doc.text(g.pos || '---', gx, curY, { width: gCols.pos, lineBreak: false, ellipsis: true }); gx += gCols.pos;
                doc.text(g.descripcion || '---', gx, curY, { width: gCols.descripcion, lineBreak: false, ellipsis: true }); gx += gCols.descripcion;
                doc.text(reportPdfHelper.fmt(g.monto), gx, curY, { align: 'right', width: gCols.monto, lineBreak: false });
            } else if (i === 0 && gastosList.length === 0) {
                doc.fillColor('#94a3b8').text('Sin gastos registrados', leftColX, curY, { width: colW });
            }

            if (i < remesasList.length) {
                const r = remesasList[i];
                let rx = rightColX;
                doc.text(r.fecha || '---', rx, curY, { width: rCols.fecha, lineBreak: false }); rx += rCols.fecha;
                doc.text(String(r.turno || '---'), rx, curY, { width: rCols.turno, lineBreak: false }); rx += rCols.turno;
                doc.text(String(r.numero || '---'), rx, curY, { width: rCols.numero, lineBreak: false }); rx += rCols.numero;
                doc.text(r.pos || '---', rx, curY, { width: rCols.pos, lineBreak: false, ellipsis: true }); rx += rCols.pos;
                doc.text(r.descripcion || '---', rx, curY, { width: rCols.descripcion, lineBreak: false, ellipsis: true }); rx += rCols.descripcion;
                doc.text(reportPdfHelper.fmt(r.monto), rx, curY, { align: 'right', width: rCols.monto, lineBreak: false });
            } else if (i === 0 && remesasList.length === 0) {
                doc.fillColor('#94a3b8').text('Sin remesas registradas', rightColX, curY, { width: colW });
            }

            curY += rowH;
        }

        if (curY > 510) {
            doc.addPage();
            drawHeader();
            curY = doc.y;
        }

        doc.moveTo(leftColX, curY).lineTo(leftColX + colW, curY).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        doc.moveTo(rightColX, curY).lineTo(rightColX + colW, curY).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        curY += 4;

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
        const totalGastos = gastosList.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
        const totalRemesas = remesasList.reduce((acc, r) => acc + (parseFloat(r.monto) || 0), 0);

        doc.text('TOTAL GASTOS', leftColX, curY, { width: colW - gCols.monto });
        doc.text(reportPdfHelper.fmt(totalGastos), leftColX + colW - gCols.monto, curY, { align: 'right', width: gCols.monto });

        doc.text('TOTAL REMESAS', rightColX, curY, { width: colW - rCols.monto });
        doc.text(reportPdfHelper.fmt(totalRemesas), rightColX + colW - rCols.monto, curY, { align: 'right', width: rCols.monto });
        doc.y = curY + 14;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, doc.y, items.length, 'Arqueos');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();
    return await getBuffer();
};


const generateVentasLecturasAnalyticsPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
    const company = await resolveCompanyInfo(data);

    const title = 'ANÁLISIS DE VENTAS, PROYECCIÓN Y COMPARATIVO (SEGÚN LECTURAS)';
    const periodText = `DEL ${reportPdfHelper.formatDate(data.start_date)} AL ${reportPdfHelper.formatDate(data.end_date)}`;
    const compText = data.compare_mode === 'prev_month' ? 'MISMO PERÍODO MES ANTERIOR' : 'PERÍODO INMEDIATO ANTERIOR';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}    |    COMPARACIÓN: ${compText}`;

    let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const pageW = 732;
    const fmtQty = (v, dec = 2) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const fmtPct = (v) => `${v >= 0 ? '+' : ''}${Number(v || 0).toFixed(1)}%`;

    const summary = data.summary || {};
    const curTot = summary.current_totals || {};
    const prevTot = summary.prev_totals || {};
    const variations = summary.variations || {};
    const projection = data.projection || {};
    const fuelComparison = data.fuel_comparison || [];
    const weeklyPatterns = data.weekly_patterns || [];
    const dailySeries = data.daily_series || [];

    const drawTableHeader = (y, cols) => {
        doc.rect(startX, y, pageW, 14).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 14).lineTo(startX + pageW, y + 14).stroke();
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5);
        for (const col of cols) {
            doc.text(col.title, col.x, y + 3.5, { width: col.w, align: col.align || 'left' });
        }
        return y + 15;
    };

    const drawSectionTitle = (y, titleText) => {
        if (y > 510) {
            doc.addPage();
            y = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        }
        doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(8);
        doc.text(titleText, startX, y, { width: pageW });
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y + 11).lineTo(startX + pageW, y + 11).stroke();
        return y + 15;
    };

    // 1. Resumen Ejecutivo y Proyección de Fin de Mes
    currentY += 4;
    currentY = drawSectionTitle(currentY, '1. RESUMEN EJECUTIVO Y PROYECCIÓN DE CIERRE DE MES');

    const colWBox = 358;
    const boxH = 68;

    doc.rect(startX, currentY, colWBox, boxH).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7).text('COMPARATIVO DE VENTAS DEL PERÍODO', startX + 8, currentY + 6);

    const b1Y = currentY + 18;
    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b');
    doc.text('Concepto', startX + 8, b1Y, { width: 90 });
    doc.text('Período Actual', startX + 100, b1Y, { width: 75, align: 'right' });
    doc.text('Período Anterior', startX + 180, b1Y, { width: 75, align: 'right' });
    doc.text('Diferencia / Variación', startX + 260, b1Y, { width: 88, align: 'right' });

    const drawKpiRow = (label, curVal, prevVal, diffVal, pctVal, isMoney, yRow) => {
        doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
        doc.text(label, startX + 8, yRow, { width: 90 });
        doc.text(isMoney ? reportPdfHelper.fmt(curVal) : fmtQty(curVal), startX + 100, yRow, { width: 75, align: 'right' });
        doc.text(isMoney ? reportPdfHelper.fmt(prevVal) : fmtQty(prevVal), startX + 180, yRow, { width: 75, align: 'right' });
        const diffStr = `${isMoney ? reportPdfHelper.fmt(diffVal) : fmtQty(diffVal)} (${fmtPct(pctVal)})`;
        doc.font('Helvetica-Bold').fillColor(diffVal >= 0 ? '#166534' : '#991b1b');
        doc.text(diffStr, startX + 260, yRow, { width: 88, align: 'right' });
    };

    drawKpiRow('Galones Despachados:', curTot.galones, prevTot.galones, variations.diff_galones, variations.pct_galones, false, b1Y + 11);
    drawKpiRow('Venta Total ($):', curTot.monto, prevTot.monto, variations.diff_monto, variations.pct_monto, true, b1Y + 22);
    drawKpiRow('Precio Prom. Ponderado:', curTot.precio_promedio, prevTot.precio_promedio, variations.diff_precio, variations.pct_precio, true, b1Y + 33);
    drawKpiRow('Ritmo Promedio Diario:', curTot.prom_diario_galones, prevTot.prom_diario_galones, (curTot.prom_diario_galones || 0) - (prevTot.prom_diario_galones || 0), prevTot.prom_diario_galones > 0 ? (((curTot.prom_diario_galones || 0) - prevTot.prom_diario_galones) / prevTot.prom_diario_galones) * 100 : 0, false, b1Y + 44);

    const box2X = startX + colWBox + 16;
    doc.rect(box2X, currentY, colWBox, boxH).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7).text(`PROYECCIÓN AL CIERRE DE MES (${(projection.month_name || '').toUpperCase()})`, box2X + 8, currentY + 6);

    const b2Y = currentY + 18;
    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b');
    doc.text('Días Transcurridos:', box2X + 8, b2Y, { width: 100 });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${projection.days_elapsed || 0} de ${projection.month_days || 0} días (${projection.progress_pct || 0}% avance)`, box2X + 110, b2Y, { width: 235, align: 'left' });

    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Días Restantes en Mes:', box2X + 8, b2Y + 11, { width: 100 });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${projection.days_remaining || 0} días`, box2X + 110, b2Y + 11, { width: 235, align: 'left' });

    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Ritmo Actual Diario:', box2X + 8, b2Y + 22, { width: 100 });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${fmtQty(projection.daily_rate_galones)} gln/día   |   ${reportPdfHelper.fmt(projection.daily_rate_monto)} /día`, box2X + 110, b2Y + 22, { width: 235, align: 'left' });

    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Galones Proyectados:', box2X + 8, b2Y + 33, { width: 100 });
    doc.font('Helvetica-Bold').fillColor('#1d4ed8').text(`${fmtQty(projection.projected_galones)} Galones`, box2X + 110, b2Y + 33, { width: 235, align: 'left' });

    doc.font('Helvetica').fontSize(6.5).fillColor('#64748b').text('Venta Proyectada ($):', box2X + 8, b2Y + 44, { width: 100 });
    doc.font('Helvetica-Bold').fillColor('#166534').text(`${reportPdfHelper.fmt(projection.projected_monto)}`, box2X + 110, b2Y + 44, { width: 235, align: 'left' });

    currentY += boxH + 12;

    // 2. Tabla Comparativa por Combustible
    currentY = drawSectionTitle(currentY, '2. COMPARATIVO DETALLADO POR TIPO DE COMBUSTIBLE');

    const curStart = summary.period?.start_date || data.start_date || '';
    const curEnd = summary.period?.end_date || data.end_date || '';
    const prevStart = summary.prev_period?.start_date || '';
    const prevEnd = summary.prev_period?.end_date || '';
    doc.font('Helvetica-Oblique').fontSize(6).fillColor('#64748b').text(`Comparativa: Período Consultado (${curStart} al ${curEnd}) vs Período Anterior (${prevStart} al ${prevEnd}). Refleja variación comercial de ventas, no contadores físicos.`, startX + 4, currentY, { width: pageW });
    currentY += 10;

    const fuelCols = [
        { title: 'PRODUCTO / COMBUSTIBLE', x: startX + 4, w: 136 },
        { title: 'VOL. ACTUAL', x: startX + 142, w: 58, align: 'right' },
        { title: 'VOL. ANT.', x: startX + 202, w: 58, align: 'right' },
        { title: 'DIF. GLN', x: startX + 262, w: 50, align: 'right' },
        { title: '% CREC.', x: startX + 314, w: 42, align: 'right' },
        { title: 'VENTA ACT.', x: startX + 358, w: 64, align: 'right' },
        { title: 'VENTA ANT.', x: startX + 424, w: 64, align: 'right' },
        { title: 'DIF. VTA.', x: startX + 490, w: 56, align: 'right' },
        { title: '% CREC.', x: startX + 548, w: 42, align: 'right' },
        { title: 'PR. ACT.', x: startX + 592, w: 44, align: 'right' },
        { title: 'PR. ANT.', x: startX + 638, w: 44, align: 'right' },
        { title: '% CUOTA', x: startX + 684, w: 44, align: 'right' }
    ];

    currentY = drawTableHeader(currentY, fuelCols);

    for (const f of fuelComparison) {
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY, fuelCols);
        }

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        doc.text(f.producto, fuelCols[0].x, currentY + 2, { width: fuelCols[0].w });
        doc.text(fmtQty(f.current_galones), fuelCols[1].x, currentY + 2, { width: fuelCols[1].w, align: 'right' });
        doc.text(fmtQty(f.prev_galones), fuelCols[2].x, currentY + 2, { width: fuelCols[2].w, align: 'right' });
        
        doc.font('Helvetica-Bold').fillColor(f.diff_galones >= 0 ? '#166534' : '#991b1b');
        doc.text(fmtQty(f.diff_galones), fuelCols[3].x, currentY + 2, { width: fuelCols[3].w, align: 'right' });
        doc.text(fmtPct(f.pct_galones), fuelCols[4].x, currentY + 2, { width: fuelCols[4].w, align: 'right' });

        doc.font('Helvetica').fillColor('#1e293b');
        doc.text(reportPdfHelper.fmt(f.current_monto), fuelCols[5].x, currentY + 2, { width: fuelCols[5].w, align: 'right' });
        doc.text(reportPdfHelper.fmt(f.prev_monto), fuelCols[6].x, currentY + 2, { width: fuelCols[6].w, align: 'right' });

        doc.font('Helvetica-Bold').fillColor(f.diff_monto >= 0 ? '#166534' : '#991b1b');
        doc.text(reportPdfHelper.fmt(f.diff_monto), fuelCols[7].x, currentY + 2, { width: fuelCols[7].w, align: 'right' });
        doc.text(fmtPct(f.pct_monto), fuelCols[8].x, currentY + 2, { width: fuelCols[8].w, align: 'right' });

        doc.font('Helvetica').fillColor('#475569');
        doc.text(reportPdfHelper.fmt(f.current_precio_prom), fuelCols[9].x, currentY + 2, { width: fuelCols[9].w, align: 'right' });
        doc.text(reportPdfHelper.fmt(f.prev_precio_prom), fuelCols[10].x, currentY + 2, { width: fuelCols[10].w, align: 'right' });
        doc.text(`${Number(f.share_volume_pct || 0).toFixed(1)}%`, fuelCols[11].x, currentY + 2, { width: fuelCols[11].w, align: 'right' });

        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(startX, currentY + 11).lineTo(startX + pageW, currentY + 11).stroke();
        currentY += 12;
    }

    // Totals row for fuels
    doc.rect(startX, currentY, pageW, 13).fill('#f8fafc');
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
    doc.text('TOTALES CONSOLIDADOS:', fuelCols[0].x, currentY + 3, { width: fuelCols[0].w });
    doc.text(fmtQty(curTot.galones), fuelCols[1].x, currentY + 3, { width: fuelCols[1].w, align: 'right' });
    doc.text(fmtQty(prevTot.galones), fuelCols[2].x, currentY + 3, { width: fuelCols[2].w, align: 'right' });
    doc.fillColor(variations.diff_galones >= 0 ? '#166534' : '#991b1b').text(fmtQty(variations.diff_galones), fuelCols[3].x, currentY + 3, { width: fuelCols[3].w, align: 'right' });
    doc.text(fmtPct(variations.pct_galones), fuelCols[4].x, currentY + 3, { width: fuelCols[4].w, align: 'right' });
    doc.fillColor('#0f172a').text(reportPdfHelper.fmt(curTot.monto), fuelCols[5].x, currentY + 3, { width: fuelCols[5].w, align: 'right' });
    doc.text(reportPdfHelper.fmt(prevTot.monto), fuelCols[6].x, currentY + 3, { width: fuelCols[6].w, align: 'right' });
    doc.fillColor(variations.diff_monto >= 0 ? '#166534' : '#991b1b').text(reportPdfHelper.fmt(variations.diff_monto), fuelCols[7].x, currentY + 3, { width: fuelCols[7].w, align: 'right' });
    doc.text(fmtPct(variations.pct_monto), fuelCols[8].x, currentY + 3, { width: fuelCols[8].w, align: 'right' });
    doc.fillColor('#0f172a').text(reportPdfHelper.fmt(curTot.precio_promedio), fuelCols[9].x, currentY + 3, { width: fuelCols[9].w, align: 'right' });
    doc.text(reportPdfHelper.fmt(prevTot.precio_promedio), fuelCols[10].x, currentY + 3, { width: fuelCols[10].w, align: 'right' });
    doc.text('100.0%', fuelCols[11].x, currentY + 3, { width: fuelCols[11].w, align: 'right' });

    currentY += 20;

    // 3. Proyección al Cierre de Mes por Tipo de Combustible
    currentY = drawSectionTitle(currentY, `3. PROYECCIÓN ESTIMADA AL CIERRE DE MES POR TIPO DE COMBUSTIBLE (${(projection.month_name || '').toUpperCase()})`);

    const projFuelCols = [
        { title: 'PRODUCTO / COMBUSTIBLE', x: startX + 4, w: 156 },
        { title: 'GALONES ACTUALES', x: startX + 162, w: 90, align: 'right' },
        { title: 'RITMO (GLN/DÍA)', x: startX + 254, w: 85, align: 'right' },
        { title: 'PROYECTADO (GLN)', x: startX + 341, w: 95, align: 'right' },
        { title: 'VENTA ACTUAL ($)', x: startX + 438, w: 95, align: 'right' },
        { title: 'RITMO ($/DÍA)', x: startX + 535, w: 95, align: 'right' },
        { title: 'PROYECTADO ($)', x: startX + 632, w: 96, align: 'right' }
    ];

    currentY = drawTableHeader(currentY, projFuelCols);

    const byProductList = projection.by_product || [];
    for (const p of byProductList) {
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY, projFuelCols);
        }

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        doc.text(p.producto, projFuelCols[0].x, currentY + 2, { width: projFuelCols[0].w });
        doc.text(fmtQty(p.current_galones), projFuelCols[1].x, currentY + 2, { width: projFuelCols[1].w, align: 'right' });
        doc.text(fmtQty(p.daily_rate_galones), projFuelCols[2].x, currentY + 2, { width: projFuelCols[2].w, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#1d4ed8').text(fmtQty(p.projected_galones), projFuelCols[3].x, currentY + 2, { width: projFuelCols[3].w, align: 'right' });

        doc.font('Helvetica').fillColor('#1e293b').text(reportPdfHelper.fmt(p.current_monto), projFuelCols[4].x, currentY + 2, { width: projFuelCols[4].w, align: 'right' });
        doc.text(reportPdfHelper.fmt(p.daily_rate_monto), projFuelCols[5].x, currentY + 2, { width: projFuelCols[5].w, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#166534').text(reportPdfHelper.fmt(p.projected_monto), projFuelCols[6].x, currentY + 2, { width: projFuelCols[6].w, align: 'right' });

        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(startX, currentY + 11).lineTo(startX + pageW, currentY + 11).stroke();
        currentY += 12;
    }

    // Totales de la proyección por combustible
    doc.rect(startX, currentY, pageW, 13).fill('#f8fafc');
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
    doc.text('TOTAL PROYECTADO:', projFuelCols[0].x, currentY + 3, { width: projFuelCols[0].w });
    doc.text(fmtQty(projection.current_galones), projFuelCols[1].x, currentY + 3, { width: projFuelCols[1].w, align: 'right' });
    doc.text(fmtQty(projection.daily_rate_galones), projFuelCols[2].x, currentY + 3, { width: projFuelCols[2].w, align: 'right' });
    doc.fillColor('#1d4ed8').text(fmtQty(projection.projected_galones), projFuelCols[3].x, currentY + 3, { width: projFuelCols[3].w, align: 'right' });
    doc.fillColor('#0f172a').text(reportPdfHelper.fmt(projection.current_monto), projFuelCols[4].x, currentY + 3, { width: projFuelCols[4].w, align: 'right' });
    doc.text(reportPdfHelper.fmt(projection.daily_rate_monto), projFuelCols[5].x, currentY + 3, { width: projFuelCols[5].w, align: 'right' });
    doc.fillColor('#166534').text(reportPdfHelper.fmt(projection.projected_monto), projFuelCols[6].x, currentY + 3, { width: projFuelCols[6].w, align: 'right' });

    currentY += 20;

    // 4. Patrón de Demanda Semanal
    currentY = drawSectionTitle(currentY, '4. PATRÓN DE DEMANDA SEMANAL (LUNES A DOMINGO)');

    const weeklyCols = [
        { title: 'DÍA DE LA SEMANA', x: startX + 6, w: 120 },
        { title: 'DÍAS REGISTRADOS', x: startX + 130, w: 80, align: 'center' },
        { title: 'GALONES TOTALES', x: startX + 214, w: 100, align: 'right' },
        { title: 'PROM. DIARIO GALONES', x: startX + 318, w: 110, align: 'right' },
        { title: 'VENTAS TOTALES ($)', x: startX + 432, w: 110, align: 'right' },
        { title: 'PROM. DIARIO VENTAS ($)', x: startX + 546, w: 110, align: 'right' },
        { title: 'ESTADO / PICO', x: startX + 660, w: 66, align: 'center' }
    ];

    currentY = drawTableHeader(currentY, weeklyCols);

    for (const w of weeklyPatterns) {
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY, weeklyCols);
        }

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        doc.text(w.name, weeklyCols[0].x, currentY + 2, { width: weeklyCols[0].w });
        doc.text(String(w.dias_ocurrencia || 0), weeklyCols[1].x, currentY + 2, { width: weeklyCols[1].w, align: 'center' });
        doc.text(fmtQty(w.galones_total), weeklyCols[2].x, currentY + 2, { width: weeklyCols[2].w, align: 'right' });
        doc.font('Helvetica-Bold').text(fmtQty(w.galones_promedio), weeklyCols[3].x, currentY + 2, { width: weeklyCols[3].w, align: 'right' });
        doc.font('Helvetica').text(reportPdfHelper.fmt(w.monto_total), weeklyCols[4].x, currentY + 2, { width: weeklyCols[4].w, align: 'right' });
        doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(w.monto_promedio), weeklyCols[5].x, currentY + 2, { width: weeklyCols[5].w, align: 'right' });

        if (w.is_peak_galones || w.is_peak_monto) {
            doc.font('Helvetica-Bold').fillColor('#b45309').text('★ DÍA PICO', weeklyCols[6].x, currentY + 2, { width: weeklyCols[6].w, align: 'center' });
        } else {
            doc.font('Helvetica').fillColor('#94a3b8').text('Normal', weeklyCols[6].x, currentY + 2, { width: weeklyCols[6].w, align: 'center' });
        }

        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(startX, currentY + 11).lineTo(startX + pageW, currentY + 11).stroke();
        currentY += 12;
    }

    currentY += 15;

    // 5. Desglose Diario de Ventas
    currentY = drawSectionTitle(currentY, '5. DESGLOSE DIARIO DE VENTAS SEGÚN LECTURAS');

    const dailyCols = [
        { title: 'FECHA', x: startX + 6, w: 68 },
        { title: 'DÍA', x: startX + 78, w: 70 },
        { title: 'TOTAL GALONES', x: startX + 152, w: 90, align: 'right' },
        { title: 'VENTA TOTAL ($)', x: startX + 246, w: 94, align: 'right' },
        { title: 'PRECIO PROM ($/gln)', x: startX + 344, w: 84, align: 'right' },
        { title: 'COMBUSTIBLES DESPACHADOS (GALONES)', x: startX + 434, w: 292, align: 'left' }
    ];

    currentY = drawTableHeader(currentY, dailyCols);

    for (const d of dailySeries) {
        if (currentY > 510) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY, dailyCols);
        }

        const fuelDetailStr = Object.entries(d.fuels || {})
            .map(([prod, inf]) => `${prod}: ${fmtQty(inf.galones)} gln`)
            .join(' | ');

        doc.font('Helvetica').fontSize(6.5).fillColor('#1e293b');
        doc.text(reportPdfHelper.formatDate(d.fecha), dailyCols[0].x, currentY + 2, { width: dailyCols[0].w });
        doc.text(d.dia_semana, dailyCols[1].x, currentY + 2, { width: dailyCols[1].w });
        doc.font('Helvetica-Bold').text(fmtQty(d.total_galones), dailyCols[2].x, currentY + 2, { width: dailyCols[2].w, align: 'right' });
        doc.text(reportPdfHelper.fmt(d.total_monto), dailyCols[3].x, currentY + 2, { width: dailyCols[3].w, align: 'right' });
        doc.font('Helvetica').fillColor('#475569').text(reportPdfHelper.fmt(d.precio_promedio), dailyCols[4].x, currentY + 2, { width: dailyCols[4].w, align: 'right' });
        doc.fontSize(6).fillColor('#64748b').text(reportPdfHelper.fitText(doc, fuelDetailStr, dailyCols[5].w), dailyCols[5].x, currentY + 2, { width: dailyCols[5].w });

        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(startX, currentY + 11).lineTo(startX + pageW, currentY + 11).stroke();
        currentY += 12;
    }

    // Totals row for daily
    doc.rect(startX, currentY, pageW, 13).fill('#f8fafc');
    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + pageW, currentY).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0f172a');
    doc.text('TOTAL PERÍODO:', dailyCols[0].x, currentY + 3, { width: 140 });
    doc.text(fmtQty(curTot.galones), dailyCols[2].x, currentY + 3, { width: dailyCols[2].w, align: 'right' });
    doc.text(reportPdfHelper.fmt(curTot.monto), dailyCols[3].x, currentY + 3, { width: dailyCols[3].w, align: 'right' });
    doc.text(reportPdfHelper.fmt(curTot.precio_promedio), dailyCols[4].x, currentY + 3, { width: dailyCols[4].w, align: 'right' });

    currentY += 20;

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, dailySeries.length, 'Días de Venta');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};


module.exports = {
    generateCloseoutDetailPDF,
    generateFuelInventoryPDF,
    generateGalonajeVendidoPDF,
    generateFuelSalesSummaryPDF,
    generateLubricantsSoldPDF,
    generateComplementariasPDF,
    generateArqueosReportPDF,
    generateVentasLecturasAnalyticsPDF
};
