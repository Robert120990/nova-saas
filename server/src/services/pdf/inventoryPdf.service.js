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


// --- REPORTES DE INVENTARIO Y TRASLADOS ---
const generateTransferPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            doc.fontSize(20).text('Comprobante de Traslado de Inventario', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Número: TR-${String(data.id).padStart(6, '0')}`, { align: 'right' });
            doc.text(`Fecha: ${new Date(data.fecha).toLocaleString()}`, { align: 'right' });
            doc.moveDown();

            doc.fontSize(14).text('Detalles del Traslado', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(11).text(`Sucursal Origen: ${data.origen_nombre}`);
            doc.text(`Sucursal Destino: ${data.destino_nombre}`);
            doc.text(`Usuario: ${data.usuario_nombre}`);
            doc.moveDown();

            if (data.observaciones) {
                doc.text(`Observaciones: ${data.observaciones}`);
                doc.moveDown();
            }

            const tableTop = doc.y;
            doc.font('Helvetica-Bold');
            doc.text('Código', 50, tableTop);
            doc.text('Producto', 150, tableTop);
            doc.text('Cantidad', 450, tableTop, { align: 'right' });
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown(0.5);

            doc.font('Helvetica');
            data.items.forEach(item => {
                const y = doc.y;
                doc.text(item.codigo || 'N/A', 50, y);
                doc.text(item.nombre, 150, y, { width: 280 });
                doc.text(item.cantidad.toString(), 450, y, { align: 'right' });
                doc.moveDown();
            });

            doc.moveDown();
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown();
            doc.fontSize(10).text('Documento generado automáticamente por el Sistema SaaS.', { align: 'center', color: 'grey' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};


/**
 * Generates a PDF buffer for a stock report
 */
const generateStockReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE STOCK DE INVENTARIO';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = data.as_of ? `AL ${data.as_of}` : `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = { codigo: 80, producto: 232, categoria: 110, stock: 70, costo: 75, precio: 75, total: 90 };
    const colX = {
        codigo: startX,
        producto: startX + colWidths.codigo,
        categoria: startX + colWidths.codigo + colWidths.producto,
        stock: startX + colWidths.codigo + colWidths.producto + colWidths.categoria,
        costo: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock,
        precio: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo,
        total: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.precio
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('CÓDIGO', colX.codigo + 2, y + 3, { width: colWidths.codigo - 4 });
        doc.text('PRODUCTO', colX.producto + 2, y + 3, { width: colWidths.producto - 4 });
        doc.text('CATEGORÍA', colX.categoria + 2, y + 3, { width: colWidths.categoria - 4 });
        doc.text('STOCK', colX.stock, y + 3, { width: colWidths.stock - 4, align: 'right' });
        doc.text('COSTO', colX.costo, y + 3, { width: colWidths.costo - 4, align: 'right' });
        doc.text('PRECIO', colX.precio, y + 3, { width: colWidths.precio - 4, align: 'right' });
        doc.text('V. TOTAL', colX.total, y + 3, { width: colWidths.total - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    let grandTotalCost = 0;
    let grandTotalItems = 0;
    const products = data.products || [];

    products.forEach((p) => {
        if (currentY > 540) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const stock = parseFloat(p.stock || 0);
        const costo = parseFloat(p.costo || 0);
        const precio = parseFloat(p.precio_venta || 0);
        const valorTotal = stock * costo;
        grandTotalCost += valorTotal;
        grandTotalItems += stock;

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(p.codigo || 'N/A', colX.codigo + 2, currentY, { width: colWidths.codigo - 4 });
        doc.text(p.nombre || '—', colX.producto + 2, currentY, { width: colWidths.producto - 4, truncate: true });
        doc.text(p.categoria || '—', colX.categoria + 2, currentY, { width: colWidths.categoria - 4, truncate: true });
        doc.text(stock.toFixed(2), colX.stock, currentY, { width: colWidths.stock - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(costo), colX.costo, currentY, { width: colWidths.costo - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(precio), colX.precio, currentY, { width: colWidths.precio - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(valorTotal), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 510) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL UNIDADES: ${grandTotalItems.toFixed(2)}`, colX.categoria, currentY, { width: colWidths.categoria + colWidths.stock, align: 'right' });
    doc.text(`VALOR TOTAL INVENTARIO: ${reportPdfHelper.fmt(grandTotalCost)}`, colX.costo, currentY, { width: colWidths.costo + colWidths.precio + colWidths.total, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, products.length, 'Productos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF buffer for an inventory movements report
 */
const generateMovementsReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE MOVIMIENTOS DE INVENTARIO';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = { codigo: 72, producto: 210, costo: 65, inicial: 65, entradas: 65, salidas: 65, final: 65, monto: 130 };
    const colX = {
        codigo: startX,
        producto: startX + colWidths.codigo,
        costo: startX + colWidths.codigo + colWidths.producto,
        inicial: startX + colWidths.codigo + colWidths.producto + colWidths.costo,
        entradas: startX + colWidths.codigo + colWidths.producto + colWidths.costo + colWidths.inicial,
        salidas: startX + colWidths.codigo + colWidths.producto + colWidths.costo + colWidths.inicial + colWidths.entradas,
        final: startX + colWidths.codigo + colWidths.producto + colWidths.costo + colWidths.inicial + colWidths.entradas + colWidths.salidas,
        monto: startX + colWidths.codigo + colWidths.producto + colWidths.costo + colWidths.inicial + colWidths.entradas + colWidths.salidas + colWidths.final
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('CÓDIGO', colX.codigo + 2, y + 3, { width: colWidths.codigo - 4 });
        doc.text('PRODUCTO', colX.producto + 2, y + 3, { width: colWidths.producto - 4 });
        doc.text('COSTO', colX.costo, y + 3, { width: colWidths.costo - 4, align: 'right' });
        doc.text('INICIAL', colX.inicial, y + 3, { width: colWidths.inicial - 4, align: 'right' });
        doc.text('ENTRADAS', colX.entradas, y + 3, { width: colWidths.entradas - 4, align: 'right' });
        doc.text('SALIDAS', colX.salidas, y + 3, { width: colWidths.salidas - 4, align: 'right' });
        doc.text('FINAL', colX.final, y + 3, { width: colWidths.final - 4, align: 'right' });
        doc.text('VALOR FINAL', colX.monto, y + 3, { width: colWidths.monto - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    let currentCategory = null;
    let grandTotalMonto = 0;
    let count = 0;
    const products = data.products || [];

    products.forEach((p) => {
        // Grouping by category
        if (p.categoria !== currentCategory) {
            if (currentY > 520) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
            }
            currentCategory = p.categoria;
            doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b').text(`CATEGORÍA: ${(currentCategory || 'SIN CATEGORÍA').toUpperCase()}`, startX + 4, currentY + 3);
            currentY += 16;
        }

        if (currentY > 540) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
            doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b').text(`CATEGORÍA: ${(currentCategory || 'SIN CATEGORÍA').toUpperCase()} (cont.)`, startX + 4, currentY + 3);
            currentY += 16;
        }

        const inicial = parseFloat(p.inicial || 0);
        const entradas = parseFloat(p.entradas || 0);
        const salidas = parseFloat(p.salidas || 0);
        const final = parseFloat(p.final || 0);
        const costo = parseFloat(p.costo || 0);
        const monto = final * costo;
        grandTotalMonto += monto;
        count++;

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(p.codigo || 'N/A', colX.codigo + 2, currentY, { width: colWidths.codigo - 4 });
        doc.text(p.nombre || '—', colX.producto + 2, currentY, { width: colWidths.producto - 4, truncate: true });
        doc.text(reportPdfHelper.fmt(costo), colX.costo, currentY, { width: colWidths.costo - 4, align: 'right' });
        doc.text(inicial.toFixed(2), colX.inicial, currentY, { width: colWidths.inicial - 4, align: 'right' });
        doc.text(entradas.toFixed(2), colX.entradas, currentY, { width: colWidths.entradas - 4, align: 'right' });
        doc.text(salidas.toFixed(2), colX.salidas, currentY, { width: colWidths.salidas - 4, align: 'right' });
        doc.text(final.toFixed(2), colX.final, currentY, { width: colWidths.final - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(monto), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('VALOR TOTAL FINAL DEL INVENTARIO:', colX.producto, currentY, { width: colWidths.producto + colWidths.costo + colWidths.inicial + colWidths.entradas + colWidths.salidas + colWidths.final, align: 'right' });
    doc.text(reportPdfHelper.fmt(grandTotalMonto), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, count, 'Movimientos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF buffer for a Kardex Report (Movement history for a product in a branch)
 * Strictly follows official accounting standards from reportPdfHelper.js:
 * - Letter size, portrait layout
 * - Official unified company header with NRC, NIT, period and monetary legend
 * - Product overview information box
 * - Clean tabular layout with #f1f5f9 header, 7pt Helvetica-Bold #0f172a
 * - Running balances and monetary values with reportPdfHelper.fmt
 * - Defensive pagination (currentY > 700)
 * - Summary row and official closing footer without authorized signatures
 * - Dynamic page numbers (Página X de Y)
 */
const generateKardexReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = 'CONSULTA DE KÁRDEX DE PRODUCTO';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = data.periodText || `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;

    // 1. Product Overview Card
    const product = data.product || {};
    const cardHeight = 36;
    doc.rect(startX, currentY, contentWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');

    // Row 1: Product Code, Name, Category
    const prodCodigo = product.codigo ? `[${product.codigo}] ` : '';
    const prodNombre = `${prodCodigo}${product.nombre || 'PRODUCTO'}`;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`PRODUCTO: ${prodNombre}`, startX + 8, currentY + 6, { width: 360, truncate: true });

    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    const catName = (product.categoria || 'GENERAL').toUpperCase();
    doc.text(`CATEGORÍA: ${catName}`, startX + 375, currentY + 6, { width: 168, align: 'right', truncate: true });

    // Row 2: Barcode, Costo, Precio Venta, Stock Actual, Valorización
    const costo = parseFloat(product.costo || 0);
    const precio = parseFloat(product.precio_venta || 0);
    const stockActual = parseFloat(product.stock_actual !== undefined ? product.stock_actual : (data.finalStock || 0));
    const valorizacion = stockActual * costo;

    doc.fontSize(7).font('Helvetica').fillColor('#475569');
    const barcodeText = product.barcode ? `CÓDIGO BARRA: ${product.barcode}   |   ` : '';
    doc.text(`${barcodeText}COSTO UNITARIO: ${reportPdfHelper.fmt(costo)}   |   PRECIO VENTA: ${reportPdfHelper.fmt(precio)}`, startX + 8, currentY + 20, { width: 340, truncate: true });

    doc.font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`STOCK ACTUAL: ${stockActual.toFixed(2)}   |   VALORIZACIÓN: ${reportPdfHelper.fmt(valorizacion)}`, startX + 330, currentY + 20, { width: 214, align: 'right' });

    currentY += cardHeight + 8;

    // 2. Table Column Configuration (Width sum: 90 + 52 + 160 + 60 + 60 + 60 + 70 = 552)
    const colWidths = {
        fecha: 90,
        tipo: 52,
        doc: 160,
        cantidad: 60,
        precio: 60,
        costo: 60,
        saldo: 70
    };
    const colX = {
        fecha: startX,
        tipo: startX + colWidths.fecha,
        doc: startX + colWidths.fecha + colWidths.tipo,
        cantidad: startX + colWidths.fecha + colWidths.tipo + colWidths.doc,
        precio: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cantidad,
        costo: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cantidad + colWidths.precio,
        saldo: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cantidad + colWidths.precio + colWidths.costo
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA / HORA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('TIPO', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4, align: 'center' });
        doc.text('DOCUMENTO / REF.', colX.doc + 2, y + 3, { width: colWidths.doc - 4 });
        doc.text('CANTIDAD', colX.cantidad, y + 3, { width: colWidths.cantidad - 4, align: 'right' });
        doc.text('P. VENTA', colX.precio, y + 3, { width: colWidths.precio - 4, align: 'right' });
        doc.text('COSTO UNIT.', colX.costo, y + 3, { width: colWidths.costo - 4, align: 'right' });
        doc.text('SALDO UNID.', colX.saldo, y + 3, { width: colWidths.saldo - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const movements = data.movements || [];
    let totalEntradas = 0;
    let totalSalidas = 0;

    movements.forEach((m, idx) => {
        if (currentY > 700) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const qty = parseFloat(m.cantidad || 0);
        if (m.tipo_movimiento === 'ENTRADA') {
            totalEntradas += qty;
        } else {
            totalSalidas += qty;
        }

        // Alternating row background
        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 1, contentWidth, 13).fill('#f8fafc');
        }

        const dateObj = new Date(m.created_at);
        const fechaStr = reportPdfHelper.formatDate(m.created_at);
        const horaStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: false });
        const fullFecha = horaStr ? `${fechaStr} ${horaStr}` : fechaStr;

        const isEntrada = m.tipo_movimiento === 'ENTRADA';
        const docText = `${m.tipo_documento || 'Movimiento'} ${m.documento_id ? '#' + m.documento_id : ''}`.trim();
        const pVenta = parseFloat(m.precio_venta || m.current_price || 0);
        const pCosto = parseFloat(m.costo || product.costo || 0);
        const saldoUnid = parseFloat(m.balance !== undefined ? m.balance : 0);

        doc.fontSize(6.8).font('Helvetica').fillColor('#334155');
        doc.text(fullFecha, colX.fecha + 2, currentY, { width: colWidths.fecha - 4, lineBreak: false });

        // Tipo badge text
        doc.font('Helvetica-Bold').fillColor(isEntrada ? '#047857' : '#b91c1c');
        doc.text(m.tipo_movimiento || '---', colX.tipo + 2, currentY, { width: colWidths.tipo - 4, align: 'center', lineBreak: false });

        doc.font('Helvetica').fillColor('#1e293b');
        doc.text(docText, colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true, lineBreak: false });

        doc.font('Helvetica-Bold').fillColor(isEntrada ? '#047857' : '#b91c1c');
        doc.text(`${isEntrada ? '+' : '-'}${qty.toFixed(2)}`, colX.cantidad, currentY, { width: colWidths.cantidad - 4, align: 'right', lineBreak: false });

        doc.font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.fmt(pVenta), colX.precio, currentY, { width: colWidths.precio - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(pCosto), colX.costo, currentY, { width: colWidths.costo - 4, align: 'right', lineBreak: false });

        doc.font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(saldoUnid.toFixed(2), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right', lineBreak: false });

        currentY += 13;
    });

    if (movements.length === 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94a3b8');
        doc.text('No se encontraron movimientos registrados para el producto en el período seleccionado.', startX, currentY + 10, { width: contentWidth, align: 'center' });
        currentY += 30;
    }

    if (currentY > 680) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    // Totals line & summary
    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 5;

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL ENTRADAS: +${totalEntradas.toFixed(2)}`, startX + 10, currentY);
    doc.text(`TOTAL SALIDAS: -${totalSalidas.toFixed(2)}`, startX + 150, currentY);
    doc.text(`SALDO FINAL: ${stockActual.toFixed(2)} UNIDADES`, startX + 280, currentY);
    doc.text(`VALOR TOTAL: ${reportPdfHelper.fmt(valorizacion)}`, startX + 410, currentY, { width: 135, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, movements.length, 'Movimientos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF buffer for Inventory Valuation & Margins Report
 */
const generateInventoryValuationPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE VALORIZACIÓN DE INVENTARIO Y MÁRGENES';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = data.as_of ? `FECHA DE CORTE: ${reportPdfHelper.formatDate(data.as_of)}` : `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = {
        codigo: 62,
        producto: 170,
        categoria: 90,
        stock: 55,
        costo: 55,
        precio: 55,
        valorCosto: 75,
        valorVenta: 80,
        margen: 90
    };
    const colX = {
        codigo: startX,
        producto: startX + colWidths.codigo,
        categoria: startX + colWidths.codigo + colWidths.producto,
        stock: startX + colWidths.codigo + colWidths.producto + colWidths.categoria,
        costo: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock,
        precio: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo,
        valorCosto: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.precio,
        valorVenta: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.precio + colWidths.valorCosto,
        margen: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.precio + colWidths.valorCosto + colWidths.valorVenta
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('CÓDIGO', colX.codigo + 2, y + 3, { width: colWidths.codigo - 4 });
        doc.text('PRODUCTO', colX.producto + 2, y + 3, { width: colWidths.producto - 4 });
        doc.text('CATEGORÍA', colX.categoria + 2, y + 3, { width: colWidths.categoria - 4 });
        doc.text('STOCK', colX.stock, y + 3, { width: colWidths.stock - 4, align: 'right' });
        doc.text('COSTO UNIT.', colX.costo, y + 3, { width: colWidths.costo - 4, align: 'right' });
        doc.text('P. VENTA', colX.precio, y + 3, { width: colWidths.precio - 4, align: 'right' });
        doc.text('VALOR COSTO', colX.valorCosto, y + 3, { width: colWidths.valorCosto - 4, align: 'right' });
        doc.text('VALOR VENTA', colX.valorVenta, y + 3, { width: colWidths.valorVenta - 4, align: 'right' });
        doc.text('MARGEN BRUTO (%)', colX.margen, y + 3, { width: colWidths.margen - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    let grandTotalStock = 0;
    let grandTotalCost = 0;
    let grandTotalRevenue = 0;
    const products = data.products || [];

    products.forEach((p, idx) => {
        if (currentY > 530) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const stock = parseFloat(p.stock || 0);
        const costo = parseFloat(p.costo || 0);
        const precio = parseFloat(p.precio_venta || 0);
        const valorCosto = stock * costo;
        const valorVenta = stock * precio;
        const margen = valorVenta - valorCosto;
        const margenPct = valorVenta > 0 ? (margen / valorVenta) * 100 : 0;

        grandTotalStock += stock;
        grandTotalCost += valorCosto;
        grandTotalRevenue += valorVenta;

        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 1, contentWidth, 12).fill('#f8fafc');
        }

        doc.fontSize(6.8).font('Helvetica').fillColor('#334155');
        doc.text(p.codigo || 'S/C', colX.codigo + 2, currentY, { width: colWidths.codigo - 4, lineBreak: false });
        doc.text(p.nombre || '—', colX.producto + 2, currentY, { width: colWidths.producto - 4, truncate: true, lineBreak: false });
        doc.text(p.categoria || 'GENERAL', colX.categoria + 2, currentY, { width: colWidths.categoria - 4, truncate: true, lineBreak: false });
        doc.text(stock.toFixed(2), colX.stock, currentY, { width: colWidths.stock - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(costo), colX.costo, currentY, { width: colWidths.costo - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(precio), colX.precio, currentY, { width: colWidths.precio - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(valorCosto), colX.valorCosto, currentY, { width: colWidths.valorCosto - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(valorVenta), colX.valorVenta, currentY, { width: colWidths.valorVenta - 4, align: 'right', lineBreak: false });

        // Margen con color según sea positivo o negativo
        const margenColor = margen >= 0 ? '#047857' : '#b91c1c';
        doc.font('Helvetica-Bold').fillColor(margenColor);
        doc.text(`${reportPdfHelper.fmt(margen)} (${margenPct.toFixed(1)}%)`, colX.margen, currentY, { width: colWidths.margen - 4, align: 'right', lineBreak: false });

        currentY += 12;
    });

    if (products.length === 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94a3b8');
        doc.text('No se encontraron productos registrados para los filtros seleccionados.', startX, currentY + 10, { width: contentWidth, align: 'center' });
        currentY += 30;
    }

    if (currentY > 500) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    const grandTotalMargin = grandTotalRevenue - grandTotalCost;
    const grandTotalMarginPct = grandTotalRevenue > 0 ? (grandTotalMargin / grandTotalRevenue) * 100 : 0;

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 5;

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL UNIDADES: ${grandTotalStock.toFixed(2)}`, startX, currentY, { width: 140, lineBreak: false });
    doc.text(`INVERSIÓN AL COSTO: ${reportPdfHelper.fmt(grandTotalCost)}`, startX + 150, currentY, { width: 180, lineBreak: false });
    doc.text(`VENTA POTENCIAL: ${reportPdfHelper.fmt(grandTotalRevenue)}`, startX + 340, currentY, { width: 180, lineBreak: false });
    doc.text(`UTILIDAD: ${reportPdfHelper.fmt(grandTotalMargin)} (${grandTotalMarginPct.toFixed(1)}%)`, startX + 530, currentY, { width: 202, align: 'right', lineBreak: false });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, products.length, 'Productos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF buffer for Inventory Turnover & Stagnant Stock Report
 */
const generateInventoryTurnoverPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE ROTACIÓN DE INVENTARIO Y OBSOLESCENCIA';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = data.criteriaText ? data.criteriaText.toUpperCase() : `CORTE AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = {
        codigo: 70,
        producto: 195,
        categoria: 90,
        stock: 55,
        costo: 55,
        inmovilizado: 77,
        ultimoMov: 72,
        diasInact: 48,
        estado: 70
    };
    const colX = {
        codigo: startX,
        producto: startX + colWidths.codigo,
        categoria: startX + colWidths.codigo + colWidths.producto,
        stock: startX + colWidths.codigo + colWidths.producto + colWidths.categoria,
        costo: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock,
        inmovilizado: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo,
        ultimoMov: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.inmovilizado,
        diasInact: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.inmovilizado + colWidths.ultimoMov,
        estado: startX + colWidths.codigo + colWidths.producto + colWidths.categoria + colWidths.stock + colWidths.costo + colWidths.inmovilizado + colWidths.ultimoMov + colWidths.diasInact
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('CÓDIGO', colX.codigo + 2, y + 3, { width: colWidths.codigo - 4 });
        doc.text('PRODUCTO', colX.producto + 2, y + 3, { width: colWidths.producto - 4 });
        doc.text('CATEGORÍA', colX.categoria + 2, y + 3, { width: colWidths.categoria - 4 });
        doc.text('STOCK', colX.stock, y + 3, { width: colWidths.stock - 4, align: 'right' });
        doc.text('COSTO UNIT.', colX.costo, y + 3, { width: colWidths.costo - 4, align: 'right' });
        doc.text('CAPITAL INMOV.', colX.inmovilizado, y + 3, { width: colWidths.inmovilizado - 4, align: 'right' });
        doc.text('ÚLTIMO MOV.', colX.ultimoMov, y + 3, { width: colWidths.ultimoMov - 4, align: 'center' });
        doc.text('DÍAS INACT.', colX.diasInact, y + 3, { width: colWidths.diasInact - 4, align: 'center' });
        doc.text('ESTADO', colX.estado, y + 3, { width: colWidths.estado - 4, align: 'center' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    let grandTotalStock = 0;
    let grandTotalInmovilizado = 0;
    const products = data.products || [];

    products.forEach((p, idx) => {
        if (currentY > 530) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const stock = parseFloat(p.stock || 0);
        const costo = parseFloat(p.costo || 0);
        const inmovilizado = stock * costo;
        const dias = parseInt(p.dias_inactivo || 0, 10);
        const ultimoMovStr = p.ultimo_movimiento ? reportPdfHelper.formatDate(p.ultimo_movimiento) : 'SIN MOV.';

        grandTotalStock += stock;
        grandTotalInmovilizado += inmovilizado;

        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 1, contentWidth, 12).fill('#f8fafc');
        }

        let estadoColor = '#334155';
        let estadoLabel = 'NORMAL';
        if (dias >= 120) {
            estadoColor = '#b91c1c';
            estadoLabel = 'CRÍTICO (+120D)';
        } else if (dias >= 90) {
            estadoColor = '#c2410c';
            estadoLabel = 'OBSOLETO (90D)';
        } else if (dias >= 60) {
            estadoColor = '#b45309';
            estadoLabel = 'LENTO (60D)';
        } else if (dias >= 30) {
            estadoColor = '#475569';
            estadoLabel = 'BAJO (30D)';
        }

        doc.fontSize(6.8).font('Helvetica').fillColor('#334155');
        doc.text(p.codigo || 'S/C', colX.codigo + 2, currentY, { width: colWidths.codigo - 4, lineBreak: false });
        doc.text(p.nombre || '—', colX.producto + 2, currentY, { width: colWidths.producto - 4, truncate: true, lineBreak: false });
        doc.text(p.categoria || 'GENERAL', colX.categoria + 2, currentY, { width: colWidths.categoria - 4, truncate: true, lineBreak: false });
        doc.text(stock.toFixed(2), colX.stock, currentY, { width: colWidths.stock - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(costo), colX.costo, currentY, { width: colWidths.costo - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(inmovilizado), colX.inmovilizado, currentY, { width: colWidths.inmovilizado - 4, align: 'right', lineBreak: false });
        doc.text(ultimoMovStr, colX.ultimoMov, currentY, { width: colWidths.ultimoMov - 4, align: 'center', lineBreak: false });
        doc.text(`${dias} d`, colX.diasInact, currentY, { width: colWidths.diasInact - 4, align: 'center', lineBreak: false });

        doc.font('Helvetica-Bold').fillColor(estadoColor);
        doc.text(estadoLabel, colX.estado, currentY, { width: colWidths.estado - 4, align: 'center', lineBreak: false });

        currentY += 12;
    });

    if (products.length === 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94a3b8');
        doc.text('No se encontraron productos que coincidan con los criterios de inactividad.', startX, currentY + 10, { width: contentWidth, align: 'center' });
        currentY += 30;
    }

    if (currentY > 500) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 5;

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`TOTAL PRODUCTOS: ${products.length}`, startX, currentY, { width: 150, lineBreak: false });
    doc.text(`TOTAL UNIDADES ESTANCADAS: ${grandTotalStock.toFixed(2)}`, startX + 170, currentY, { width: 230, lineBreak: false });
    doc.text(`TOTAL CAPITAL INMOVILIZADO: ${reportPdfHelper.fmt(grandTotalInmovilizado)}`, startX + 420, currentY, { width: 312, align: 'right', lineBreak: false });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, products.length, 'Productos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};


module.exports = {
    generateTransferPDF,
    generateStockReportPDF,
    generateMovementsReportPDF,
    generateKardexReportPDF,
    generateInventoryValuationPDF,
    generateInventoryTurnoverPDF
};
