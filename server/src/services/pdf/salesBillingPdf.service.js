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

const { generateRTEEModern } = require('../pdf.modern_rtee');

// --- REPORTES DE VENTAS, POS Y RENTABILIDAD ---
/**
 * Generates a PDF buffer for a daily sales report
 */
const generateDailySalesReportPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE VENTAS DIARIAS';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = {
        fecha: 44, tipo: 48, doc: 130, cond: 32, cliente: 170,
        grav: 45, exen: 40, iva: 37, fov: 32, cot: 32, ret: 35, perc: 35, total: 52
    };
    const colX = {
        fecha: startX,
        tipo: startX + colWidths.fecha,
        doc: startX + colWidths.fecha + colWidths.tipo,
        cond: startX + colWidths.fecha + colWidths.tipo + colWidths.doc,
        cliente: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond,
        grav: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente,
        exen: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav,
        iva: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav + colWidths.exen,
        fov: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav + colWidths.exen + colWidths.iva,
        cot: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav + colWidths.exen + colWidths.iva + colWidths.fov,
        ret: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav + colWidths.exen + colWidths.iva + colWidths.fov + colWidths.cot,
        perc: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav + colWidths.exen + colWidths.iva + colWidths.fov + colWidths.cot + colWidths.ret,
        total: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente + colWidths.grav + colWidths.exen + colWidths.iva + colWidths.fov + colWidths.cot + colWidths.ret + colWidths.perc
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4, lineBreak: false });
        doc.text('TIPO', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4, lineBreak: false });
        doc.text('N° DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4, lineBreak: false });
        doc.text('COND.', colX.cond + 2, y + 3, { width: colWidths.cond - 4, lineBreak: false });
        doc.text('CLIENTE', colX.cliente + 2, y + 3, { width: colWidths.cliente - 4, lineBreak: false });
        doc.text('GRAV.', colX.grav, y + 3, { width: colWidths.grav - 4, align: 'right', lineBreak: false });
        doc.text('EXEN.', colX.exen, y + 3, { width: colWidths.exen - 4, align: 'right', lineBreak: false });
        doc.text('IVA', colX.iva, y + 3, { width: colWidths.iva - 4, align: 'right', lineBreak: false });
        doc.text('FOV', colX.fov, y + 3, { width: colWidths.fov - 4, align: 'right', lineBreak: false });
        doc.text('COT', colX.cot, y + 3, { width: colWidths.cot - 4, align: 'right', lineBreak: false });
        doc.text('RET.', colX.ret, y + 3, { width: colWidths.ret - 4, align: 'right', lineBreak: false });
        doc.text('PERC.', colX.perc, y + 3, { width: colWidths.perc - 4, align: 'right', lineBreak: false });
        doc.text('TOTAL', colX.total, y + 3, { width: colWidths.total - 4, align: 'right', lineBreak: false });
        doc.moveTo(startX, y + 14).lineTo(startX + contentWidth, y + 14).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const sales = data.sales || [];
    sales.forEach((s, idx) => {
        if (currentY > 530) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 2, contentWidth, 12).fill('#f8fafc');
        }

        doc.fontSize(6.5).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(s.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.tipo || '---', colWidths.tipo - 4), colX.tipo + 2, currentY, { width: colWidths.tipo - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.documento || '---', colWidths.doc - 4), colX.doc + 2, currentY, { width: colWidths.doc - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.condicion || '---', colWidths.cond - 4), colX.cond + 2, currentY, { width: colWidths.cond - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.cliente || '---', colWidths.cliente - 4), colX.cliente + 2, currentY, { width: colWidths.cliente - 4, lineBreak: false });
        
        doc.text(reportPdfHelper.fmt(s.gravadas), colX.grav, currentY, { width: colWidths.grav - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.exentas), colX.exen, currentY, { width: colWidths.exen - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.iva), colX.iva, currentY, { width: colWidths.iva - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.fovial), colX.fov, currentY, { width: colWidths.fov - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.cotrans), colX.cot, currentY, { width: colWidths.cot - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.retencion), colX.ret, currentY, { width: colWidths.ret - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.percepcion), colX.perc, currentY, { width: colWidths.perc - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.total), colX.total, currentY, { width: colWidths.total - 4, align: 'right', lineBreak: false });

        currentY += 12;
    });

    if (currentY > 510) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', colX.cliente, currentY, { width: colWidths.cliente - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_gravadas), colX.grav, currentY, { width: colWidths.grav - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_exentas), colX.exen, currentY, { width: colWidths.exen - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_iva), colX.iva, currentY, { width: colWidths.iva - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_fovial), colX.fov, currentY, { width: colWidths.fov - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_cotrans), colX.cot, currentY, { width: colWidths.cot - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_retencion), colX.ret, currentY, { width: colWidths.ret - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_percepcion), colX.perc, currentY, { width: colWidths.perc - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_general), colX.total, currentY, { width: colWidths.total - 4, align: 'right', lineBreak: false });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, sales.length, 'Ventas');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF report for sales by customer (detalle de productos).
 */
const generateSalesByCustomerPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');

    const title = 'REPORTE DE VENTAS POR CLIENTE';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;

    // Card de datos del cliente
    const c = data.customer || {};
    const dirParts = [c.direccion, c.departamento, c.municipio].filter(Boolean).join(', ');

    doc.rect(startX, currentY, contentWidth, 36).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('DATOS DEL CLIENTE', startX + 8, currentY + 6);
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
    const clientLine1 = `Nombre: ${c.nombre || '---'}${c.nombre_comercial ? ` (${c.nombre_comercial})` : ''}    |    NIT: ${c.nit || '---'}    |    NRC: ${c.nrc || '---'}`;
    const clientLine2 = `Tel: ${c.telefono || '---'}    |    Correo: ${c.correo || '---'}    |    Dirección: ${dirParts || '---'}`;
    doc.text(reportPdfHelper.fitText(doc, clientLine1, contentWidth - 16), startX + 8, currentY + 16, { width: contentWidth - 16, lineBreak: false });
    doc.text(reportPdfHelper.fitText(doc, clientLine2, contentWidth - 16), startX + 8, currentY + 25, { width: contentWidth - 16, lineBreak: false });

    currentY += 44;

    const colWidths = { fecha: 45, tipo: 50, doc: 130, producto: 197, cant: 45, total: 85 };
    const colX = {
        fecha: startX,
        tipo: startX + colWidths.fecha,
        doc: startX + colWidths.fecha + colWidths.tipo,
        producto: startX + colWidths.fecha + colWidths.tipo + colWidths.doc,
        cant: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.producto,
        total: startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.producto + colWidths.cant
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4, lineBreak: false });
        doc.text('TIPO', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4, lineBreak: false });
        doc.text('N° DOCUMENTO', colX.doc + 2, y + 3, { width: colWidths.doc - 4, lineBreak: false });
        doc.text('PRODUCTO', colX.producto + 2, y + 3, { width: colWidths.producto - 4, lineBreak: false });
        doc.text('CANT.', colX.cant, y + 3, { width: colWidths.cant - 4, align: 'right', lineBreak: false });
        doc.text('TOTAL', colX.total, y + 3, { width: colWidths.total - 4, align: 'right', lineBreak: false });
        doc.moveTo(startX, y + 14).lineTo(startX + contentWidth, y + 14).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const formatQty = (val) => {
        const n = parseFloat(val || 0);
        return Number.isInteger(n) ? String(n) : n.toFixed(2);
    };

    const sales = data.sales || [];
    sales.forEach((s, idx) => {
        if (currentY > 700) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        if (idx % 2 === 1) {
            doc.rect(startX, currentY - 2, contentWidth, 12).fill('#f8fafc');
        }

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(s.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.tipo || '---', colWidths.tipo - 4), colX.tipo + 2, currentY, { width: colWidths.tipo - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.documento || '---', colWidths.doc - 4), colX.doc + 2, currentY, { width: colWidths.doc - 4, lineBreak: false });
        doc.text(reportPdfHelper.fitText(doc, s.producto || '---', colWidths.producto - 4), colX.producto + 2, currentY, { width: colWidths.producto - 4, lineBreak: false });
        doc.text(formatQty(s.cantidad), colX.cant, currentY, { width: colWidths.cant - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(s.total), colX.total, currentY, { width: colWidths.total - 4, align: 'right', lineBreak: false });

        currentY += 12;
    });

    if (currentY > 680) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL:', colX.producto, currentY, { width: colWidths.producto - 4, align: 'right', lineBreak: false });
    doc.text(formatQty(data.total_cantidad), colX.cant, currentY, { width: colWidths.cant - 4, align: 'right', lineBreak: false });
    doc.text(reportPdfHelper.fmt(data.total_general), colX.total, currentY, { width: colWidths.total - 4, align: 'right', lineBreak: false });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, sales.length, 'Detalles de Venta');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a PDF report for sales by category
 */
const generateSalesByCategoryPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DE VENTAS POR CATEGORÍA';
    const subtitle = `SUCURSAL: ${data.branch || 'TODAS'}`;
    const periodText = data.period || (data.startDate && data.endDate 
        ? `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`
        : `AL ${reportPdfHelper.formatDate(new Date())}`);

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = { cat: 272, unidades: 100, monto: 120, rendimiento: 120, porcentaje: 120 };
    const colX = {
        cat: startX,
        unidades: startX + colWidths.cat,
        monto: startX + colWidths.cat + colWidths.unidades,
        rendimiento: startX + colWidths.cat + colWidths.unidades + colWidths.monto,
        porcentaje: startX + colWidths.cat + colWidths.unidades + colWidths.monto + colWidths.rendimiento
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('CATEGORÍA / PRODUCTO', colX.cat + 2, y + 3, { width: colWidths.cat - 4 });
        doc.text('UNIDADES', colX.unidades, y + 3, { width: colWidths.unidades - 4, align: 'right' });
        doc.text('MONTO ($)', colX.monto, y + 3, { width: colWidths.monto - 4, align: 'right' });
        doc.text('RENDIMIENTO ($)', colX.rendimiento, y + 3, { width: colWidths.rendimiento - 4, align: 'right' });
        doc.text('% PART.', colX.porcentaje, y + 3, { width: colWidths.porcentaje - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const categories = data.categories || [];
    let count = 0;

    categories.forEach(cat => {
        if (currentY > 530) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        // Fila de categoría
        doc.rect(startX, currentY, contentWidth, 13).fill('#f8fafc');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
        doc.text(cat.categoria || 'SIN CATEGORÍA', colX.cat + 2, currentY + 3, { width: colWidths.cat - 4, truncate: true });
        doc.text(String(cat.total_unidades || 0), colX.unidades, currentY + 3, { width: colWidths.unidades - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(cat.total_venta), colX.monto, currentY + 3, { width: colWidths.monto - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(cat.rendimiento), colX.rendimiento, currentY + 3, { width: colWidths.rendimiento - 4, align: 'right' });
        doc.text(`${parseFloat(cat.porcentaje_ventas || 0).toFixed(2)}%`, colX.porcentaje, currentY + 3, { width: colWidths.porcentaje - 4, align: 'right' });
        currentY += 15;
        count++;

        // Productos si es detallado
        if (data.isDetailed && cat.productos && cat.productos.length > 0) {
            cat.productos.forEach(p => {
                if (currentY > 540) {
                    doc.addPage();
                    currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(currentY);
                }
                doc.font('Helvetica').fontSize(7).fillColor('#475569');
                doc.text(p.producto || '—', colX.cat + 16, currentY, { width: colWidths.cat - 18, truncate: true });
                doc.text(String(p.unidades || 0), colX.unidades, currentY, { width: colWidths.unidades - 4, align: 'right' });
                doc.text(reportPdfHelper.fmt(p.monto), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });
                doc.text(reportPdfHelper.fmt(p.rendimiento), colX.rendimiento, currentY, { width: colWidths.rendimiento - 4, align: 'right' });
                currentY += 11;
            });
            currentY += 3;
        }
    });

    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
    doc.text('TOTAL GENERAL:', colX.cat, currentY, { width: colWidths.cat - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.grand_total), colX.monto, currentY, { width: colWidths.monto - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, count, 'Categorías');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

/**
 * Generates a detailed itemized PDF for Sales by POS Report
 */
const generateSalesByPOSPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const title = 'REPORTE DETALLADO DE VENTAS POR POS';
    const subtitle = `SUCURSAL: ${data.branch_name || 'TODAS'}`;
    const periodText = `DEL ${reportPdfHelper.formatDate(data.startDate)} AL ${reportPdfHelper.formatDate(data.endDate)}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);

    const startX = 30;
    const contentWidth = 732;
    const colWidths = {
        fecha: 45,
        tipo: 60,
        numero: 130,
        cond: 42,
        cliente: 220,
        fiscal: 155,
        total: 80
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
        doc.text('FECHA', colX.fecha + 2, y + 3, { width: colWidths.fecha - 4 });
        doc.text('TIPO DOC', colX.tipo + 2, y + 3, { width: colWidths.tipo - 4 });
        doc.text('NÚMERO', colX.numero + 2, y + 3, { width: colWidths.numero - 4 });
        doc.text('COND.', colX.cond + 2, y + 3, { width: colWidths.cond - 4 });
        doc.text('CLIENTE', colX.cliente + 2, y + 3, { width: colWidths.cliente - 4 });
        doc.text('FISCAL / VENDEDOR', colX.fiscal + 2, y + 3, { width: colWidths.fiscal - 4 });
        doc.text('TOTAL', colX.total, y + 3, { width: colWidths.total - 4, align: 'right' });
        return y + 17;
    };

    currentY = drawTableHeader(currentY);
    let currentPOS = null;
    let posTotal = 0;
    let grandTotal = 0;
    let rowCount = 0;
    const rows = data.data || [];

    rows.forEach((row, index) => {
        // Agrupación por POS
        if (row.pos_name !== currentPOS) {
            if (currentPOS !== null) {
                // Subtotal del POS anterior
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
                currentY += 3;
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text(`SUBTOTAL ${currentPOS}:`, colX.cliente, currentY, { width: colWidths.cliente + colWidths.fiscal - 6, align: 'right' });
                doc.text(reportPdfHelper.fmt(posTotal), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
                currentY += 14;
                posTotal = 0;
            }

            if (currentY > 520) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
            }

            doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1e293b');
            doc.text(`TERMINAL POS: ${(row.pos_name || 'SIN POS').toUpperCase()}`, startX + 4, currentY + 3);
            currentPOS = row.pos_name;
            currentY += 16;
        }

        if (currentY > 540) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
            doc.rect(startX, currentY, contentWidth, 13).fill('#e2e8f0');
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#1e293b');
            doc.text(`TERMINAL POS: ${(currentPOS || 'SIN POS').toUpperCase()} (cont.)`, startX + 4, currentY + 3);
            currentY += 16;
        }

        let tipoLabel = row.tipo_documento;
        if (tipoLabel === '01') tipoLabel = 'Factura';
        else if (tipoLabel === '03') tipoLabel = 'Crédito Fiscal';
        else if (tipoLabel === '04') tipoLabel = 'Nota de Remisión';
        else if (tipoLabel === '05') tipoLabel = 'Nota de Crédito';
        else if (tipoLabel === '11') tipoLabel = 'F. Exportación';

        const condLabel = row.condicion_operacion === 1 ? 'Contado' : 'Crédito';
        const fiscalInfo = `${row.cliente_nit || row.cliente_nrc || ''} / ${row.vendedor_nombre || ''}`.trim();
        const totalPagar = parseFloat(row.total_pagar || 0);

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(row.fecha_emision), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(tipoLabel || '---', colX.tipo + 2, currentY, { width: colWidths.tipo - 4 });
        doc.text(row.numero_control || 'N/A', colX.numero + 2, currentY, { width: colWidths.numero - 4, truncate: true });
        doc.text(condLabel, colX.cond + 2, currentY, { width: colWidths.cond - 4 });
        doc.text(row.cliente_nombre || 'Consumidor Final', colX.cliente + 2, currentY, { width: colWidths.cliente - 4, truncate: true });
        doc.text(fiscalInfo || '---', colX.fiscal + 2, currentY, { width: colWidths.fiscal - 4, truncate: true });
        doc.text(reportPdfHelper.fmt(totalPagar), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });

        posTotal += totalPagar;
        grandTotal += totalPagar;
        rowCount++;
        currentY += 12;

        if (index === rows.length - 1) {
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
            currentY += 3;
            doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
            doc.text(`SUBTOTAL ${currentPOS}:`, colX.cliente, currentY, { width: colWidths.cliente + colWidths.fiscal - 6, align: 'right' });
            doc.text(reportPdfHelper.fmt(posTotal), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
            currentY += 14;
        }
    });

    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('TOTAL GENERAL:', colX.cliente, currentY, { width: colWidths.cliente + colWidths.fiscal - 6, align: 'right' });
    doc.text(reportPdfHelper.fmt(grandTotal), colX.total, currentY, { width: colWidths.total - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, rowCount, 'Ventas');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};


/**
 * Generates a PDF buffer for the DTE Representation (RTEE)
 * Formato oficial estándar definitivo Sipe Web SaaS.
 */
const generateRTEE = (data) => {
    return generateRTEEModern(data);
};


const generateInvalidationPDF = (invalidationJson) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const id = invalidationJson.identificacion || {};
            const emisor = invalidationJson.emisor || {};
            const documento = invalidationJson.documento || {};
            const motivo = invalidationJson.motivo || {};
            const M = 40;
            const pageW = doc.page.width - 80;

            const tipoAnulacionNombres = {
                1: 'Anulación Total por sustitución',
                2: 'Anulación Total por no concretar operación',
                3: 'Anulación Parcial'
            };

            // --- Header ---
            doc.rect(M, 30, pageW, 18).fill('#991b1b');
            doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
                .text('EVENTO DE INVALIDACIÓN DE DOCUMENTO TRIBUTARIO ELECTRÓNICO', M, 33, { align: 'center', width: pageW });
            doc.fillColor('black');

            // --- Identificación ---
            let y = 65;
            doc.fontSize(10).font('Helvetica-Bold').text('Identificación del Evento', M, y);
            y = doc.y + 4;
            doc.rect(M, y, pageW, 65).stroke();
            doc.fontSize(8.5).font('Helvetica');
            const idX = M + 8;

            doc.font('Helvetica-Bold').text('Versión:', idX, y + 6);
            doc.font('Helvetica').text(String(id.version || ''), idX + 80, y + 6);

            doc.font('Helvetica-Bold').text('Ambiente:', idX, y + 20);
            doc.font('Helvetica').text(id.ambiente === '01' ? 'PRODUCCIÓN' : 'PRUEBAS', idX + 80, y + 20);

            doc.font('Helvetica-Bold').text('Código Generación:', idX, y + 34);
            doc.font('Helvetica').text(id.codigoGeneracion || '', idX + 80, y + 34, { width: 400 });

            doc.font('Helvetica-Bold').text('Fecha/Hora:', idX, y + 48);
            doc.font('Helvetica').text(`${id.fecEmi || ''} ${id.horEmi || ''}`, idX + 80, y + 48);

            // --- Emisor ---
            y = doc.y + 12;
            doc.fontSize(10).font('Helvetica-Bold').text('Emisor', M, y);
            y = doc.y + 4;
            doc.rect(M, y, pageW, 65).stroke();
            doc.fontSize(8.5).font('Helvetica');
            doc.font('Helvetica-Bold').text('NIT:', idX, y + 6);
            doc.font('Helvetica').text(emisor.nit || '', idX + 80, y + 6);
            doc.font('Helvetica-Bold').text('Nombre:', idX, y + 20);
            doc.font('Helvetica').text(emisor.nombre || '', idX + 80, y + 20, { width: 400 });
            doc.font('Helvetica-Bold').text('Cod.Establecimiento:', idX, y + 34);
            doc.font('Helvetica').text(`${emisor.codEstableMH || ''} (${emisor.codEstable || ''})`, idX + 80, y + 34);
            doc.font('Helvetica-Bold').text('Cod.Punto Venta:', idX, y + 48);
            doc.font('Helvetica').text(`${emisor.codPuntoVentaMH || ''} (${emisor.codPuntoVenta || ''})`, idX + 80, y + 48);

            // --- Documento Original ---
            y = doc.y + 12;
            doc.fontSize(10).font('Helvetica-Bold').text('Documento Original Invalidado', M, y);
            y = doc.y + 4;
            doc.rect(M, y, pageW, 80).stroke();
            doc.fontSize(8.5).font('Helvetica');
            doc.font('Helvetica-Bold').text('Tipo DTE:', idX, y + 6);
            doc.font('Helvetica').text(documento.tipoDte || '', idX + 80, y + 6);
            doc.font('Helvetica-Bold').text('Código Generación:', idX, y + 20);
            doc.font('Helvetica').text(documento.codigoGeneracion || '', idX + 80, y + 20, { width: 400 });
            doc.font('Helvetica-Bold').text('Número Control:', idX, y + 34);
            doc.font('Helvetica').text(documento.numeroControl || '', idX + 80, y + 34, { width: 400 });
            doc.font('Helvetica-Bold').text('Sello Recepción:', idX, y + 48);
            doc.font('Helvetica').text(documento.selloRecibido || '', idX + 80, y + 48, { width: 400 });
            doc.font('Helvetica-Bold').text('Fecha Emisión Doc.:', idX, y + 62);
            doc.font('Helvetica').text(documento.fecEmi || '', idX + 80, y + 62);

            // --- Motivo ---
            y = doc.y + 12;
            doc.fontSize(10).font('Helvetica-Bold').text('Motivo de Invalidación', M, y);
            y = doc.y + 4;
            const motivoBoxH = 100;
            doc.rect(M, y, pageW, motivoBoxH).stroke();
            doc.fontSize(8.5).font('Helvetica');
            doc.font('Helvetica-Bold').text('Tipo Anulación:', idX, y + 6);
            doc.font('Helvetica').text(tipoAnulacionNombres[motivo.tipoAnulacion] || String(motivo.tipoAnulacion || ''), idX + 100, y + 6, { width: 350 });
            doc.font('Helvetica-Bold').text('Motivo:', idX, y + 22);
            doc.font('Helvetica').text(motivo.motivoAnulacion || '', idX + 100, y + 22, { width: 350 });
            doc.font('Helvetica-Bold').text('Responsable:', idX, y + 40);
            doc.font('Helvetica').text(motivo.nombreResponsable || '', idX + 100, y + 40, { width: 350 });
            doc.font('Helvetica-Bold').text('Doc. Responsable:', idX, y + 56);
            doc.font('Helvetica').text(`${motivo.tipDocResponsable || ''}: ${motivo.numDocResponsable || ''}`, idX + 100, y + 56, { width: 350 });
            doc.font('Helvetica-Bold').text('Solicitante:', idX, y + 72);
            doc.font('Helvetica').text(`${motivo.nombreSolicita || ''} (${motivo.tipDocSolicita || ''}: ${motivo.numDocSolicita || ''})`, idX + 100, y + 72, { width: 350 });

            // --- Footer ---
            y = doc.y + 20;
            doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
                .text('Documento de Invalidación generado electrónicamente.', M, y, { align: 'center', width: pageW });
            doc.text(`Código de Generación del Evento: ${id.codigoGeneracion || ''}`, M, doc.y + 2, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};


/**
 * Generates a PDF buffer for Store Profitability Report (Informe de Ventas y Rentabilidad de Tienda)
 */
const generateStoreProfitabilityPDF = async (data) => {
    const comp = await resolveCompanyInfo(data);
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const periodText = (data.startDateFormatted && data.endDateFormatted)
        ? `DEL ${data.startDateFormatted} AL ${data.endDateFormatted}`
        : 'TODOS LOS REGISTROS';
    const subtitle = data.branch_name ? `SUCURSAL: ${String(data.branch_name).toUpperCase()}` : null;

    const startX = 30;
    const totalWidth = 732;
    const colWidths = {
        codigo: 75,
        descripcion: 165,
        categoria: 100,
        costo: 45,
        precio: 45,
        cant: 42,
        rentabilidad: 88,
        costoTot: 56,
        ventas: 56,
        ganancia: 60
    };

    const drawHeader = () => {
        reportPdfHelper.renderHeader(doc, comp, 'INFORME DE VENTAS Y RENTABILIDAD DE TIENDA', periodText, 'landscape', subtitle);
    };

    const drawTableHeader = () => {
        const tableTop = doc.y;
        doc.rect(startX, tableTop, totalWidth, 14).fill('#f1f5f9');
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
        let x = startX;
        const headerY = tableTop + 3;
        doc.text('CÓDIGO', x, headerY, { width: colWidths.codigo }); x += colWidths.codigo;
        doc.text('DESCRIPCIÓN', x, headerY, { width: colWidths.descripcion }); x += colWidths.descripcion;
        doc.text('CATEGORÍA', x, headerY, { width: colWidths.categoria }); x += colWidths.categoria;
        doc.text('COSTO', x, headerY, { align: 'right', width: colWidths.costo }); x += colWidths.costo;
        doc.text('PRECIO', x, headerY, { align: 'right', width: colWidths.precio }); x += colWidths.precio;
        doc.text('CANT.', x, headerY, { align: 'right', width: colWidths.cant }); x += colWidths.cant;
        doc.text('RENTABILIDAD', x, headerY, { align: 'right', width: colWidths.rentabilidad }); x += colWidths.rentabilidad;
        doc.text('COSTO TOT', x, headerY, { align: 'right', width: colWidths.costoTot }); x += colWidths.costoTot;
        doc.text('VENTAS', x, headerY, { align: 'right', width: colWidths.ventas }); x += colWidths.ventas;
        doc.text('GANANCIA', x, headerY, { align: 'right', width: colWidths.ganancia });

        doc.moveTo(startX, tableTop + 14).lineTo(startX + totalWidth, tableTop + 14).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
        doc.y = tableTop + 18;
    };

    drawHeader();
    drawTableHeader();

    const fitText = (text, maxWidth) => {
        const str = text || '';
        if (doc.widthOfString(str) <= maxWidth) return str;
        let truncated = str;
        while (truncated.length > 0 && doc.widthOfString(truncated + '...') > maxWidth) {
            truncated = truncated.slice(0, -1);
        }
        return truncated + '...';
    };

    const items = data.items || [];
    items.forEach((item) => {
        if (doc.y > 520) {
            doc.addPage();
            drawHeader();
            drawTableHeader();
        }

        const currentY = doc.y;
        doc.font('Helvetica').fontSize(6.8).fillColor('#0f172a');
        let x = startX;

        // CODIGO
        doc.text(String(item.codigo || '---'), x, currentY, { width: colWidths.codigo - 4, lineBreak: false, ellipsis: true });
        x += colWidths.codigo;

        // DESCRIPCION
        doc.text(fitText(String(item.descripcion || '').toUpperCase(), colWidths.descripcion - 4), x, currentY, { width: colWidths.descripcion - 4, lineBreak: false });
        x += colWidths.descripcion;

        // CATEGORIA
        doc.text(fitText(String(item.categoria || 'SIN CATEGORÍA').toUpperCase(), colWidths.categoria - 4), x, currentY, { width: colWidths.categoria - 4, lineBreak: false });
        x += colWidths.categoria;

        // COSTO
        const costoStr = item.hasCost ? reportPdfHelper.fmt(item.costo) : '$ -';
        doc.text(costoStr, x, currentY, { align: 'right', width: colWidths.costo });
        x += colWidths.costo;

        // PRECIO
        doc.text(reportPdfHelper.fmt(item.precio), x, currentY, { align: 'right', width: colWidths.precio });
        x += colWidths.precio;

        // CANT.
        doc.text(parseFloat(item.cantidad || 0).toFixed(2), x, currentY, { align: 'right', width: colWidths.cant });
        x += colWidths.cant;

        // RENTABILIDAD: "$ 0.70 | 66.52%"
        let rentStr = '$ - | 0.00%';
        if (item.hasCost) {
            const unitMarginStr = reportPdfHelper.fmt(item.rentabilidadUnitaria || 0);
            const pctStr = `${parseFloat(item.rentabilidadPorcentaje || 0).toFixed(2)}%`;
            rentStr = `${unitMarginStr} | ${pctStr}`;
        }
        doc.text(rentStr, x, currentY, { align: 'right', width: colWidths.rentabilidad });
        x += colWidths.rentabilidad;

        // COSTO TOT
        const costoTotStr = item.hasCost ? reportPdfHelper.fmt(item.costoTotal) : '$ -';
        doc.text(costoTotStr, x, currentY, { align: 'right', width: colWidths.costoTot });
        x += colWidths.costoTot;

        // VENTAS
        doc.text(reportPdfHelper.fmt(item.totalVenta), x, currentY, { align: 'right', width: colWidths.ventas });
        x += colWidths.ventas;

        // GANANCIA
        const gananciaStr = item.hasCost ? reportPdfHelper.fmt(item.ganancia) : '$ -';
        doc.text(gananciaStr, x, currentY, { align: 'right', width: colWidths.ganancia });

        doc.y = currentY + 11;
    });

    // Resumen de Totales Generales
    if (doc.y > 510) {
        doc.addPage();
        drawHeader();
        drawTableHeader();
    }

    const currentY = doc.y + 4;
    doc.moveTo(startX, currentY).lineTo(startX + totalWidth, currentY).lineWidth(1).strokeColor('#0f172a').stroke();

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a');
    doc.text('TOTALES GENERALES:', startX, currentY + 3, { width: colWidths.codigo + colWidths.descripcion + colWidths.categoria });
    
    let xTot = startX + colWidths.codigo + colWidths.descripcion + colWidths.categoria + colWidths.costo + colWidths.precio;
    // CANT TOTAL
    doc.text(parseFloat(data.totals?.cantidad || 0).toFixed(2), xTot, currentY + 3, { align: 'right', width: colWidths.cant });
    xTot += colWidths.cant;

    // RENTABILIDAD TOTAL %
    const totPct = `${parseFloat(data.totals?.rentabilidadPorcentaje || 0).toFixed(2)}%`;
    doc.text(totPct, xTot, currentY + 3, { align: 'right', width: colWidths.rentabilidad });
    xTot += colWidths.rentabilidad;

    // COSTO TOTAL
    doc.text(reportPdfHelper.fmt(data.totals?.costoTotal), xTot, currentY + 3, { align: 'right', width: colWidths.costoTot });
    xTot += colWidths.costoTot;

    // VENTAS TOTAL
    doc.text(reportPdfHelper.fmt(data.totals?.totalVenta), xTot, currentY + 3, { align: 'right', width: colWidths.ventas });
    xTot += colWidths.ventas;

    // GANANCIA TOTAL
    doc.text(reportPdfHelper.fmt(data.totals?.ganancia), xTot, currentY + 3, { align: 'right', width: colWidths.ganancia });

    doc.moveTo(startX, currentY + 15).lineTo(startX + totalWidth, currentY + 15).lineWidth(1).strokeColor('#0f172a').stroke();
    doc.y = currentY + 20;

    reportPdfHelper.renderClosingFooter(doc, startX, doc.y, items.length, 'Productos');
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();
    return await getBuffer();
};


module.exports = {
    generateDailySalesReportPDF,
    generateSalesByCustomerPDF,
    generateSalesByCategoryPDF,
    generateSalesByPOSPDF,
    generateStoreProfitabilityPDF,
    generateRTEE,
    generateInvalidationPDF
};
