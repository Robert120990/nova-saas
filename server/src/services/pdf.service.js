const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const reportPdfHelper = require('../utils/reportPdfHelper');
const { numberToWords } = require('../utils/numberToWords');

function isValidTaxVal(val) {
    return Boolean(val && val !== '---' && val !== 'N/A' && val !== '0000-000000-000-0' && val !== '000000-0');
}

/**
 * Resuelve la información de la empresa para encabezados de reportes.
 */
async function resolveCompanyInfo(data) {
    // 1. Si ya se proporcionó un objeto company con nit o nrc válidos
    if (data.company && typeof data.company === 'object' && (isValidTaxVal(data.company.nit) || isValidTaxVal(data.company.nrc))) {
        return data.company;
    }
    // 2. Si company es un objeto con id o si se pasó company_id
    const compId = data.company_id || (data.company && typeof data.company === 'object' ? data.company.id : null);
    if (compId) {
        const compById = await reportPdfHelper.getCompanyInfo(compId);
        if (compById && (isValidTaxVal(compById.nit) || isValidTaxVal(compById.nrc))) {
            return compById;
        }
    }
    // 3. Si se proporcionó company_name o data.company es un string, buscar por nombre en la base de datos
    const compName = data.company_name || (typeof data.company === 'string' ? data.company : null);
    if (compName) {
        const compByName = await reportPdfHelper.getCompanyByName(compName);
        if (compByName && (isValidTaxVal(compByName.nit) || isValidTaxVal(compByName.nrc))) {
            return compByName;
        }
    }
    // 4. Si se proporcionaron nit/nrc explícitos en data
    if (isValidTaxVal(data.company_nit) || isValidTaxVal(data.company_nrc)) {
        return {
            razon_social: compName || data.company?.razon_social || 'EMPRESA REGISTRADA',
            nombre_comercial: data.company?.nombre_comercial || 'EMPRESA',
            nit: data.company_nit || '---',
            nrc: data.company_nrc || '---'
        };
    }
    // 5. Fallback por defecto: primera empresa de la base de datos
    const defaultComp = await reportPdfHelper.getDefaultCompany();
    if (defaultComp && (isValidTaxVal(defaultComp.nit) || isValidTaxVal(defaultComp.nrc))) {
        return defaultComp;
    }

    return defaultComp || {
        razon_social: compName || 'EMPRESA REGISTRADA',
        nombre_comercial: 'EMPRESA',
        nit: '---',
        nrc: '---'
    };
}

/**
 * Formatea una fecha a DD/MM/YYYY sin desfase de zona horaria.
 * Acepta objetos Date o strings tipo 'YYYY-MM-DD' / ISO.
 */
const fmtDateDDMMYYYY = (val) => {
    if (!val) return '—';
    let y, m, d;
    if (val instanceof Date && !isNaN(val)) {
        y = val.getFullYear();
        m = val.getMonth() + 1;
        d = val.getDate();
    } else {
        const parts = String(val).substring(0, 10).split('-');
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
    }
    if (!y || !m || !d) return '—';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

/**
 * Generates a PDF buffer for an inventory transfer
 */
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
    const entityEmail = isProvider ? (data.provider_email || 'N/A') : (data.customer_email || 'N/A');

    doc.rect(startX, currentY, contentWidth, 34).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(entityTitle, startX + 8, currentY + 6);
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
    doc.text(`Nombre: ${entityName}    |    Correo: ${entityEmail}`, startX + 8, currentY + 18, { width: 330 });

    const balLabel = (data.balance_label || 'SALDO PENDIENTE:').toUpperCase();
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(balLabel, startX + 350, currentY + 6, { width: 194, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(reportPdfHelper.fmt(data.total_balance), startX + 350, currentY + 16, { width: 194, align: 'right' });

    currentY += 42;

    const colWidths = { fecha: 65, doc: 110, concepto: 157, cargo: 70, abono: 70, saldo: 80 };
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
    movements.forEach(m => {
        if (currentY > 710) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const cargo = parseFloat(m.cargo || 0);
        const abono = parseFloat(m.abono || 0);
        const balance = parseFloat(m.balance || 0);
        const docText = `${m.tipo || ''} ${m.numero || ''}`.trim() || '—';

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(m.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(docText, colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true });
        doc.text(String(m.concepto || '—'), colX.concepto + 2, currentY, { width: colWidths.concepto - 4, truncate: true });
        doc.text(reportPdfHelper.fmt(cargo), colX.cargo, currentY, { width: colWidths.cargo - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(abono), colX.abono, currentY, { width: colWidths.abono - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(balance), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 690) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('SALDO FINAL:', colX.concepto, currentY, { width: colWidths.concepto - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.total_balance), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });
    currentY += 18;

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
    const periodText = `AL ${reportPdfHelper.formatDate(new Date())}`;

    let currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);

    const startX = 30;
    const contentWidth = 552;

    // Info Box
    doc.rect(startX, currentY, contentWidth, 34).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('INFORMACIÓN DEL CLIENTE', startX + 8, currentY + 6);
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
    doc.text(`Nombre: ${data.customer_name || 'N/A'}    |    Correo: ${data.customer_email || 'N/A'}`, startX + 8, currentY + 18, { width: 330 });

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('SALDO DISPONIBLE EN GALONES:', startX + 350, currentY + 6, { width: 194, align: 'right' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text(`${parseFloat(data.total_balance_galones || 0).toFixed(4)} gal.`, startX + 350, currentY + 16, { width: 194, align: 'right' });

    currentY += 42;

    const colWidths = { fecha: 65, doc: 105, concepto: 112, galones: 65, cargo: 65, abono: 65, saldo: 75 };
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
    movements.forEach(m => {
        if (currentY > 710) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
            currentY = drawTableHeader(currentY);
        }

        const cargoGal = parseFloat(m.galones_cargo || 0);
        const abonoGal = parseFloat(m.galones_abono || 0);
        const balanceGal = parseFloat(m.balance_galones || 0);
        const galones = parseFloat(m.galones || 0);
        const docText = `${m.tipo || ''} ${m.numero || ''}`.trim() || '—';

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(m.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(docText, colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true });
        doc.text(String(m.concepto || '—'), colX.concepto + 2, currentY, { width: colWidths.concepto - 4, truncate: true });
        doc.text(galones > 0 ? galones.toFixed(4) : '-', colX.galones, currentY, { width: colWidths.galones - 4, align: 'right' });
        doc.text(cargoGal > 0 ? cargoGal.toFixed(4) : '-', colX.cargo, currentY, { width: colWidths.cargo - 4, align: 'right' });
        doc.text(abonoGal > 0 ? abonoGal.toFixed(4) : '-', colX.abono, currentY, { width: colWidths.abono - 4, align: 'right' });
        doc.text(balanceGal.toFixed(4), colX.saldo, currentY, { width: colWidths.saldo - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 660) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'portrait', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 6;

    // Resumen de montos
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
    const colWidths = { fecha: 65, doc: 90, tipo: 85, b1: 82, b2: 82, b3: 82, b4: 82, b5: 82, b6: 82 };
    const colX = {
        fecha: startX,
        doc: startX + colWidths.fecha,
        tipo: startX + colWidths.fecha + colWidths.doc,
        b1: startX + colWidths.fecha + colWidths.doc + colWidths.tipo,
        b2: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1,
        b3: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2,
        b4: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3,
        b5: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3 + colWidths.b4,
        b6: startX + colWidths.fecha + colWidths.doc + colWidths.tipo + colWidths.b1 + colWidths.b2 + colWidths.b3 + colWidths.b4 + colWidths.b5
    };

    const drawTableHeader = (y) => {
        doc.rect(startX, y, contentWidth, 14).fill('#f1f5f9');
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
        return y + 17;
    };

    currentY = drawTableHeader(currentY);

    const documents = data.documents || [];
    documents.forEach(docRow => {
        if (currentY > 540) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(reportPdfHelper.formatDate(docRow.fecha), colX.fecha + 2, currentY, { width: colWidths.fecha - 4 });
        doc.text(String(docRow.documento || '—'), colX.doc + 2, currentY, { width: colWidths.doc - 4, truncate: true });
        doc.text(String(docRow.tipo || '—'), colX.tipo + 2, currentY, { width: colWidths.tipo - 4, truncate: true });
        doc.text(reportPdfHelper.fmt(docRow.d0_30), colX.b1, currentY, { width: colWidths.b1 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(docRow.d31_60), colX.b2, currentY, { width: colWidths.b2 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(docRow.d61_90), colX.b3, currentY, { width: colWidths.b3 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(docRow.d91_180), colX.b4, currentY, { width: colWidths.b4 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(docRow.d181_365), colX.b5, currentY, { width: colWidths.b5 - 4, align: 'right' });
        doc.text(reportPdfHelper.fmt(docRow.d365_plus), colX.b6, currentY, { width: colWidths.b6 - 4, align: 'right' });

        currentY += 12;
    });

    if (currentY > 520) {
        doc.addPage();
        currentY = reportPdfHelper.renderHeader(doc, comp, title, periodText, 'landscape', subtitle);
    }

    doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
    currentY += 4;
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('SALDO TOTAL PENDIENTE:', colX.tipo, currentY, { width: colWidths.tipo - 4, align: 'right' });
    doc.text(reportPdfHelper.fmt(data.total_balance), colX.b6, currentY, { width: colWidths.b6 - 4, align: 'right' });
    currentY += 18;

    currentY = reportPdfHelper.renderClosingFooter(doc, startX, currentY, documents.length, 'Documentos');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generateProviderAgingPDF = (data) => generateAgingPDF(data, true);

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

/**
 * Generates a PDF buffer for the DTE Representation (RTEE)
 */
const generateRTEE = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'LETTER', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const { emisor, receptor, dte, venta, items } = data;
            const startX = 30;
            const pageWidth = doc.page.width - 60;

            // --- Header: Logo & Emisor & DTE Info ---
            let headerY = 30;
            
            // 1. Logo (si existe)
            if (emisor.logoPath) {
                doc.image(emisor.logoPath, startX, headerY, { width: 100 });
                headerY = 30; // Mantener alineación
            }

            // 2. Emisor Info (Desplazado si hay logo)
            const emisorX = emisor.logoPath ? 140 : startX;
            doc.fontSize(14).font('Helvetica-Bold').text(emisor.nombre.toUpperCase(), emisorX, headerY, { width: 200 });
            doc.fontSize(8).font('Helvetica').text(emisor.descActividad, emisorX, doc.y + 2, { width: 200 });
            
            const emisorDireccionComp = emisor.direccion?.complemento || emisor.direccion || '';
            const emisorMun = emisor.municipio_nombre || emisor.direccion?.municipio_nombre || 'San Salvador';
            const emisorDep = emisor.departamento_nombre || emisor.direccion?.departamento_nombre || 'San Salvador';
            
            doc.text(`${emisorDireccionComp}, ${emisorMun}, ${emisorDep}`, emisorX, doc.y + 2, { width: 220 });
            doc.text(`NIT: ${emisor.nit} | NRC: ${emisor.nrc}`, emisorX, doc.y + 2);
            doc.text(`Tel: ${emisor.telefono || 'N/A'} | Email: ${emisor.correo || 'N/A'}`, emisorX, doc.y + 2);

            // 3. DTE Box (Right) - Diseño más robusto
            const dteBoxX = 350;
            const dteBoxY = 25;
            doc.rect(dteBoxX, dteBoxY, 230, 115).stroke();
            
            // Etiqueta de Ambiente (PRUEBAS / PRODUCCIÓN)
            const isProd = dte.ambiente === '01';
            doc.rect(dteBoxX, dteBoxY, 230, 20).fill(isProd ? '#1e40af' : '#991b1b');
            doc.fillColor('white').fontSize(10).font('Helvetica-Bold').text(isProd ? 'MODO: PRODUCCIÓN' : 'MODO: PRUEBAS', dteBoxX, dteBoxY + 5, { align: 'center', width: 230 });
            doc.fillColor('black');

            doc.fontSize(9).font('Helvetica-Bold').text('DOCUMENTO TRIBUTARIO ELECTRÓNICO', dteBoxX, dteBoxY + 25, { align: 'center', width: 230 });
            doc.fontSize(11).text(dte.tipoDteNombre.toUpperCase(), dteBoxX, dteBoxY + 38, { align: 'center', width: 230 });
            
            doc.fontSize(7).font('Helvetica-Bold').text('Código Generación:', dteBoxX + 10, dteBoxY + 55);
            doc.font('Helvetica').text(dte.codigoGeneracion, dteBoxX + 10, dteBoxY + 63);
            
            doc.font('Helvetica-Bold').text('Número de Control:', dteBoxX + 10, dteBoxY + 75);
            doc.font('Helvetica').text(dte.numeroControl, dteBoxX + 10, dteBoxY + 83);

            doc.font('Helvetica-Bold').text('Sello de Recepción:', dteBoxX + 10, dteBoxY + 95);
            doc.font('Helvetica').text(dte.selloRecepcion || 'PENDIENTE DE AUTORIZACIÓN', dteBoxX + 10, dteBoxY + 103, { width: 210 });

            doc.moveDown(3);

            // --- Información Técnica Adicional ---
            const techY = Math.max(doc.y, 145);
            doc.fontSize(7).font('Helvetica-Bold');
            doc.text(`Modelo de Emisión: ${dte.tipoModelo === 1 ? 'Previo' : 'Diferido'}`, startX, techY);
            doc.text(`Tipo de Transmisión: ${dte.tipoOperacion === 1 ? 'Normal' : 'Contingencia'}`, startX + 150, techY);
            doc.text(`Moneda: USD`, startX + 300, techY);

            // --- Receptor Section ---
            const receptorY = techY + 15;
            const receptorBoxHeight = (dte.tipoDte === '03') ? 77 : (dte.tipoDte === '11') ? 65 : 55;
            doc.rect(startX, receptorY, pageWidth, receptorBoxHeight).stroke();
            doc.fontSize(9).font('Helvetica-Bold').text('DATOS DEL RECEPTOR', startX + 10, receptorY + 5);
            doc.fontSize(9).font('Helvetica');
            doc.text(`Nombre: ${receptor.nombre}`, startX + 10, receptorY + 18);
            
            let docIdentLabel = 'Documento:';
            if (dte.tipoDte === '03' && receptor.nit) docIdentLabel = 'NIT:';
            doc.text(`${docIdentLabel} ${receptor.nit || receptor.numDocumento || 'Consumidor Final'}`, startX + 10, receptorY + 30);
            
            if (dte.tipoDte === '03') {
                doc.text(`NRC: ${receptor.nrc || '—'}`, startX + 10, receptorY + 42);
                doc.text(`Actividad: ${receptor.descActividad || receptor.codActividad || 'N/A'}`, startX + 10, receptorY + 54);
                doc.text(`Dirección: ${receptor.direccion?.complemento || 'Ciudad'}`, startX + 10, receptorY + 66);
            } else if (dte.tipoDte === '11') {
                doc.text(`País: ${receptor.nombrePais || receptor.codPais || 'N/A'}`, startX + 10, receptorY + 42);
                doc.text(`Dirección: ${receptor.direccion?.complemento || 'Ciudad'}`, startX + 10, receptorY + 54);
            } else {
                doc.text(`Dirección: ${receptor.direccion?.complemento || 'Ciudad'}`, startX + 10, receptorY + 42);
            }

            doc.text(`Condición: ${venta.condicion_operacion === 1 ? 'Contado' : 'Crédito'}`, startX + 350, receptorY + 42);
            doc.text(`Fecha Emisión: ${venta.fecha_emision} ${venta.hora_emision}`, startX + 350, receptorY + 30);

            doc.moveDown(2);

            if (dte.tipoDte === '07') {
                // --- CR: tabla de documentos referenciados ---
                const tableTop = receptorY + receptorBoxHeight + 10;
                doc.fontSize(8).font('Helvetica-Bold');
                doc.rect(startX, tableTop, pageWidth, 20).fill('#f3f4f6').stroke('#000');
                doc.fillColor('black');
                doc.text('#', startX + 5, tableTop + 6);
                doc.text('DOCUMENTO REFERENCIADO', startX + 25, tableTop + 6);
                doc.text('GRAVADO', startX + 380, tableTop + 6, { align: 'right', width: 70 });
                doc.text('RETENCIÓN', startX + 470, tableTop + 6, { align: 'right', width: 70 });
                doc.font('Helvetica').fontSize(8);
                let crY = tableTop + 25;
                items.forEach((item, idx) => {
                    const docRef = `DTE ${item.tipoDte || ''} - ${item.numDocumento || ''}`;
                    const ih = doc.heightOfString(item.descripcion, { width: 320 }) + 10;
                    if (crY + ih > 680) { doc.addPage(); crY = 50; }
                    doc.text(String(idx + 1), startX + 5, crY);
                    doc.text(docRef, startX + 25, crY, { width: 150 });
                    doc.text(item.descripcion, startX + 180, crY, { width: 190 });
                    doc.text(`$${parseFloat(item.totalItem || 0).toFixed(2)}`, startX + 380, crY, { align: 'right', width: 70 });
                    doc.text(`$${parseFloat(item.ivaRetenido || 0).toFixed(2)}`, startX + 470, crY, { align: 'right', width: 70 });
                    crY += Math.max(ih, 15);
                });
                const footerY = Math.max(crY + 20, 580);
                const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.ambiente}&codGen=${dte.codigoGeneracion}&fechaEmi=${venta.fecha_emision}`;
                const qrImage = await QRCode.toDataURL(qrUrl);
                doc.image(qrImage, startX, footerY - 10, { width: 80 });
                let cy = footerY;
                doc.fontSize(8).font('Helvetica-Bold');
                doc.text('TOTAL SUJETO A RETENCIÓN:', 350, cy);
                doc.text(`$${parseFloat(venta.totalSujetoRetencion || venta.total_gravado || 0).toFixed(2)}`, 530, cy, { align: 'right', width: 70 });
                cy += 14;
                doc.text('TOTAL IVA RETENIDO (1%):', 350, cy);
                doc.text(`$${parseFloat(venta.totalIVAretenido || venta.total_iva || 0).toFixed(2)}`, 530, cy, { align: 'right', width: 70 });
                cy += 14;
                doc.font('Helvetica-Bold').text('TOTAL A PAGAR:', 350, cy);
                doc.text(`$${parseFloat(venta.total_pagar).toFixed(2)}`, 530, cy, { align: 'right', width: 70 });
                doc.fontSize(8).font('Helvetica-Bold').text('SON:', startX + 110, footerY + 70);
                doc.font('Helvetica').text(venta.total_letras || 'S/N', startX + 110, footerY + 82, { width: 230 });
            }

            if (dte.tipoDte !== '07') {
            const tableTop = receptorY + receptorBoxHeight + 10;
            doc.fontSize(8).font('Helvetica-Bold');
            doc.rect(startX, tableTop, pageWidth, 20).fill('#f3f4f6').stroke('#000');
            doc.fillColor('black');
            doc.text('CANT', startX + 5, tableTop + 6);
            doc.text('DESCRIPCIÓN', startX + 45, tableTop + 6);
            doc.text('PRECIO U.', startX + 350, tableTop + 6, { align: 'right', width: 60 });
            doc.text('DESC.', startX + 420, tableTop + 6, { align: 'right', width: 60 });
            doc.text('SUBTOTAL', startX + 500, tableTop + 6, { align: 'right', width: 70 });

            const esConsumidorFinal = dte.tipoDte === '01' || dte.tipoDte === 1 || String(dte.tipoDteNombre || '').toUpperCase().includes('CONSUMIDOR FINAL') || String(dte.tipoDteNombre || '').toUpperCase() === 'FACTURA';
            const fovialVenta = parseFloat(venta.fovial) || 0;
            const cotransVenta = parseFloat(venta.cotrans) || 0;
            const tieneImpuestosCombustible = (fovialVenta > 0 || cotransVenta > 0);

            const isFuelItem = (it) => {
                if (it.esCombustible || it.es_combustible) return true;
                if (it.uniMedida === 55) return true;
                if (Array.isArray(it.tributos) && it.tributos.some(t => (t && (t.codigo === 'D1' || t.codigo === 'C8' || t === 'D1' || t === 'C8')))) return true;
                const desc = String(it.descripcion || '').toUpperCase();
                return /(DIESEL|REGULAR|SUPER|GASOLINA|V-POWER|ION\s*DIESEL)/.test(desc);
            };

            doc.font('Helvetica').fontSize(8);
            let currentY = tableTop + 25;
            items.forEach(item => {
                const itemHeight = doc.heightOfString(item.descripcion, { width: 300 }) + 5;
                if (currentY + itemHeight > 680) {
                    doc.addPage();
                    currentY = 50;
                }
                
                // Formatear cantidad con hasta 4 decimales para combustibles
                const formattedQty = Number(item.cantidad) % 1 === 0 ? 
                    item.cantidad.toString() : 
                    Number(item.cantidad).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
                
                let displayUnitPrice = parseFloat(item.precioUnitario) || 0;
                let displayTotalItem = parseFloat(item.totalItem) || 0;

                // En Factura Consumidor Final (DTE 01) con combustible, los impuestos específicos (FOVIAL $0.20 y COTRANS $0.10)
                // se desglosan en el resumen y por tanto el precio unitario y subtotal del ítem deben mostrarse netos de dichos impuestos.
                if (esConsumidorFinal && tieneImpuestosCombustible && isFuelItem(item)) {
                    const cant = parseFloat(item.cantidad) || 0;
                    const fovialItem = Math.round(cant * 0.20 * 100) / 100;
                    const cotransItem = Math.round(cant * 0.10 * 100) / 100;
                    const fuelTaxes = fovialItem + cotransItem;

                    if (displayUnitPrice > 0.30) {
                        displayUnitPrice = Math.max(0, displayUnitPrice - 0.30);
                    }
                    displayTotalItem = Math.max(0, Math.round((displayTotalItem - fuelTaxes) * 100) / 100);
                }

                doc.text(formattedQty, startX + 5, currentY);
                doc.text(item.descripcion, startX + 45, currentY, { width: 300 });
                doc.text(`$${displayUnitPrice.toFixed(4)}`, startX + 350, currentY, { align: 'right', width: 60 });
                doc.text(`$${parseFloat(item.montoDescuento || 0).toFixed(2)}`, startX + 420, currentY, { align: 'right', width: 60 });
                doc.text(`$${displayTotalItem.toFixed(2)}`, startX + 500, currentY, { align: 'right', width: 70 });
                currentY += Math.max(itemHeight, 15);
            });

            // --- Resumen y QR ---
            const footerY = Math.max(currentY + 20, 580);
            
            // QR Code
            const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${dte.ambiente}&codGen=${dte.codigoGeneracion}&fechaEmi=${venta.fecha_emision}`;
            const qrImage = await QRCode.toDataURL(qrUrl);
            doc.image(qrImage, startX, footerY, { width: 90 });
            doc.fontSize(6).text('Representación Gráfica de DTE. Valide escaneando el código QR o en el sitio oficial de Hacienda.', startX, footerY + 95, { width: 90, align: 'center' });

            // Totales
            const totalsX = 350;
            let currentTotalY = footerY;
            doc.fontSize(8).font('Helvetica-Bold');
            
            const addTotalLine = (label, value, isBold = false, rawText = null) => {
                doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(label, totalsX, currentTotalY);
                if (rawText !== null) {
                    doc.text(rawText, startX + 500, currentTotalY, { align: 'right', width: 70 });
                } else {
                    doc.text(`$${parseFloat(value).toFixed(2)}`, startX + 500, currentTotalY, { align: 'right', width: 70 });
                }
                currentTotalY += 12;
            };

            let gravadasDisplay = parseFloat(venta.total_gravado) || 0;
            let sumaOperacionesDisplay = gravadasDisplay;

            if (esConsumidorFinal && tieneImpuestosCombustible) {
                // En Factura Consumidor Final, el total_gravado de Hacienda incluye FOVIAL y COTRANS.
                // Para que el resumen cuadre con los tributos específicos desglosados (y coincida con la tabla de ítems):
                // Ventas Gravadas = Total Pagar - FOVIAL - COTRANS - Exentas - No Sujetas.
                const totalPagarNum = parseFloat(venta.total_pagar) || 0;
                const totalExentoNum = parseFloat(venta.total_exento) || 0;
                const totalNoSujNum = parseFloat(venta.total_nosujetas) || 0;
                gravadasDisplay = Math.max(0, Math.round((totalPagarNum - fovialVenta - cotransVenta - totalExentoNum - totalNoSujNum) * 100) / 100);
                const descNum = parseFloat(venta.total_descuento) || 0;
                sumaOperacionesDisplay = Math.round((gravadasDisplay + descNum) * 100) / 100;
            }

            addTotalLine('SUMA DE OPERACIONES:', sumaOperacionesDisplay, true);
            addTotalLine('(-) DESCUENTOS:', venta.total_descuento);
            addTotalLine('VENTAS GRAVADAS:', gravadasDisplay, true);
            
            // Para DTE de Consumidor Final ('01'), el IVA ya está incorporado en las ventas gravadas y no se traslada en el resumen.
            // Se muestra '$ -' tal como en el formato de referencia oficial.
            if (esConsumidorFinal) {
                addTotalLine('TOTAL IVA (13%):', 0, false, '$ -');
            } else {
                addTotalLine('TOTAL IVA (13%):', venta.total_iva, true);
            }

            // Tributos adicionales (Retención 1%, FOVIAL, COTRAN, etc.)
            const processedCodes = new Set();
            if (venta.tributos && venta.tributos.length > 0) {
                venta.tributos.forEach(tri => {
                    // Filtrar el IVA ya mostrado (código 20)
                    if (tri.codigo !== '20') {
                        let desc = tri.descripcion || tri.codigo;
                        if (desc.toUpperCase().includes('FEFE')) desc = 'FOVIAL';
                        addTotalLine(`${desc.toUpperCase()}:`, tri.valor);
                        processedCodes.add(tri.codigo);
                    }
                });
            }
            
            // Fallback para FOVIAL y COTRAN si no fueron procesados arriba pero tienen valor
            // Códigos usados por el sistema: D1 (FOVIAL), C8 (COTRANS). Catálogo MH: C3 (FOVIAL), C1 (COTRANS)
            if (!processedCodes.has('D1') && !processedCodes.has('C3') && !processedCodes.has('01') && fovialVenta > 0) {
                addTotalLine('TOTAL FOVIAL ($0.20):', fovialVenta);
            }
            if (!processedCodes.has('C8') && !processedCodes.has('C1') && !processedCodes.has('02') && cotransVenta > 0) {
                addTotalLine('TOTAL COTRAN ($0.10):', cotransVenta);
            }

            // Retención y percepción de IVA (solo si aplica)
            const retencionIVA = parseFloat(venta.total_retencion) || 0;
            const percepcionIVA = parseFloat(venta.total_percepcion) || 0;
            if (retencionIVA > 0) addTotalLine('(-) RETENCIÓN IVA (1%):', retencionIVA);
            if (percepcionIVA > 0) addTotalLine('(+) PERCEPCIÓN IVA (1%):', percepcionIVA);

            currentTotalY += 5;
            doc.fontSize(11).font('Helvetica-Bold').text('TOTAL A PAGAR:', totalsX, currentTotalY);
            doc.text(`$${parseFloat(venta.total_pagar).toFixed(2)}`, startX + 500, currentTotalY, { align: 'right', width: 70 });

            // Monto en Letras
            doc.fontSize(8).font('Helvetica-Bold').text('SON:', startX + 110, footerY);
            doc.font('Helvetica').text(venta.total_letras || 'S/N', startX + 110, footerY + 12, { width: 230 });
            } // Fin standard (tipoDte !== '07')

            // --- Marca de Agua "ANULADO" ---
            console.log('[generateRTEE DEBUG] data.isVoided:', data.isVoided);
            if (data.isVoided) {
                const totalPages = doc.bufferedPageRange().count;
                for (let i = 0; i < totalPages; i++) {
                    doc.switchToPage(i);
                    const cx = doc.page.width / 2;
                    const cy = doc.page.height / 2;

                    doc.save();

                    // Resetear transformaciones y estilos
                    doc.translate(cx, cy);
                    doc.rotate(-45);

                    doc.fillColor('red').fillOpacity(0.25);
                    doc.fontSize(100).font('Helvetica-Bold');
                    const textWidth = doc.widthOfString('ANULADO');
                    doc.text('ANULADO', -textWidth / 2, -50);

                    doc.restore();

                    // Resetear estado para no afectar contenido posterior
                    doc.fillColor('black').fillOpacity(1);
                }
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateVacacionPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 28;
            const W = 556;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim();
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';

            const fmt = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            const sueldoMensual = parseFloat(data.sueldo_base || 0);
            const sueldoQuincenal = sueldoMensual / 2;
            const vacacionesMonto = parseFloat(data.vacaciones_monto || 0);
            const totalDevengado = parseFloat(data.total_devengado || (sueldoQuincenal + vacacionesMonto));
            const descuentoISSS = parseFloat(data.descuento_isss || 0);
            const descuentoAFP = parseFloat(data.descuento_afp || 0);
            const descuentoRenta = parseFloat(data.descuento_renta || 0);
            const totalDeducciones = parseFloat(data.total_deducciones || (descuentoISSS + descuentoAFP + descuentoRenta));
            const totalRecibir = parseFloat(data.total_recibir || (totalDevengado - totalDeducciones));
            const montoLetras = data.monto_letras || (numberToWords ? numberToWords(totalRecibir) : '');

            const periodoTexto = `${fmt(data.fecha_inicial)} AL ${fmt(data.fecha_final)}`;

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // --- 1. Header (Logo, Company, Title Pill) ---
                let logoRendered = false;
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) {
                            doc.image(p, M, y, { fit: [60, 26] });
                            logoRendered = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                const companyX = logoRendered ? M + 68 : M;
                const companyMaxW = logoRendered ? 270 : 330;

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                // Right header pill: Titulo & Periodo
                const rightPillW = 220;
                const rightPillX = M + W - rightPillW;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                doc.text('RECIBO DE VACACIONES ANUALES', rightPillX, y, { width: rightPillW, align: 'right' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`PERÍODO: ${periodoTexto}`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                y += 24;
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                y += 4;

                // --- 2. Employee Info Card ---
                const cardH = 34;
                doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                // Card Row 1
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('EMPLEADO:', M + 8, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                const cargoDepto = `${data.cargo_nombre || 'GENERAL'} • ${data.departamento_nombre || 'GENERAL'}`;
                doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('RÉGIMEN:', M + 375, y + 3.5);
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('ANUAL (ART. 177 CT)', M + 375, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('SUELDO MENSUAL:', M + 455, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(`$ ${sueldoMensual.toFixed(2)}`, M + 455, y + 11.5);

                // Card Row 2 (Metadata badges line)
                doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                const metaLine = `CÓD: ${data.empleado_codigo || '—'}    |    DUI: ${data.num_dui || '—'}    |    NIT: ${data.num_nit || '—'}    |    INGRESO: ${fmt(data.fecha_ingreso)}`;
                doc.text(metaLine, M + 8, y + 23);

                y += cardH + 5;

                // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                const colW = 270;
                const colGutter = 16;
                const leftX = M;
                const rightX = M + colW + colGutter;
                const headerH = 12;
                const rowH = 10;

                // Column Headers
                doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                y += headerH + 3;

                // Left Column: Percepciones
                let percY = y;
                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text('Sueldo Quincenal Ordinario', leftX + 4, percY, { width: 185, ellipsis: true });
                doc.text(`$ ${sueldoQuincenal.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                percY += rowH;

                doc.text('Vacación Reglamentaria (+30% Art. 177 CT)', leftX + 4, percY, { width: 185, ellipsis: true });
                doc.text(`$ ${vacacionesMonto.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                percY += rowH;

                // Right Column: Deducciones
                let dedY = y;
                const isssPct = data.isss_porcentaje || 3;
                const afpPct = data.afp_porcentaje || 7.25;

                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text(`ISSS (${isssPct}%)`, rightX + 4, dedY, { width: 175 });
                doc.text(`$ ${descuentoISSS.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text(`AFP (${afpPct}%)`, rightX + 4, dedY, { width: 175 });
                doc.text(`$ ${descuentoAFP.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text('Impuesto sobre la Renta (ISR)', rightX + 4, dedY, { width: 175 });
                doc.text(`$ ${descuentoRenta.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                // Column Totals
                const maxRowY = Math.max(percY, dedY) + 2;

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL DEVENGADO', leftX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${totalDevengado.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${totalDeducciones.toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                y = maxRowY + 15;

                // --- 4. Líquido a Recibir ---
                const netH = 17;
                doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                doc.text(`$ ${totalRecibir.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                y += netH + 3;
                doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                y += 9;
                doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                doc.text('Dinero que recibo a mi entera satisfacción en concepto de vacación anual reglamentaria y sueldo respectivo, liberando a la empresa de toda responsabilidad legal y laboral al respecto.', M + 4, y, { width: W - 8 });

                // --- 5. Signatures ---
                y += 34;
                const sigLineY = y;
                const sigW = 200;

                // Empleado Signature
                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Empresa / RRHH Signature
                const rightSigX = M + W - sigW - 15;

                if (firmaPath) {
                    try {
                        const fFile = firmaPath.split('/').pop();
                        const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                        if (fs.existsSync(fAbs)) {
                            doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                        }
                    } catch (e) {}
                }
                if (selloPath) {
                    try {
                        const sFile = selloPath.split('/').pop();
                        const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                        if (fs.existsSync(sAbs)) {
                            doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                        }
                    } catch (e) {}
                }

                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('AUTORIZADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Copy badge at bottom
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
            };

            // Top Copy (Copia Empleado)
            drawCopy(22, 'COPIA EMPLEADO');

            // Middle dashed divider line
            const PAGE_MID = 396;
            doc.save()
               .strokeColor('#cbd5e1')
               .lineWidth(0.6)
               .dash(4, { space: 3 })
               .moveTo(M, PAGE_MID)
               .lineTo(M + W, PAGE_MID)
               .stroke()
               .undash()
               .restore();

            // Bottom Copy (Original Empresa)
            drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateLiquidacionPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 36, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 36;
            const W = 540;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim();
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';

            const fmt = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            const sueldoMensual = parseFloat(data.sueldo_base || 0);
            const sueldoDiario = sueldoMensual / 30;
            const totalIndemnizacion = parseFloat(data.total_indemnizacion || 0);
            const totalVacaciones = parseFloat(data.total_vacaciones || 0);
            const totalAguinaldo = parseFloat(data.total_aguinaldo || 0);
            const pagoUltimosDias = parseFloat(data.pago_ultimos_dias || 0);
            const totalDevengado = parseFloat(data.total_devengado || 0);

            const descuentoISSS = parseFloat(data.descuento_isss || 0);
            const descuentoAFP = parseFloat(data.descuento_afp || 0);
            const descuentoRenta = parseFloat(data.descuento_renta || 0);
            const otrosDescuentos = parseFloat(data.otros_descuentos || 0);
            const totalDeducciones = parseFloat(data.total_deducciones || 0);

            const montoRecibir = parseFloat(data.monto_recibir || 0);
            const montoLetras = data.monto_letras || (numberToWords ? numberToWords(montoRecibir) : '');

            let y = 34;

            // --- 1. Header (Logo / Company / Title Pill) ---
            let logoRendered = false;
            if (logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) {
                        doc.image(p, M, y, { fit: [85, 34] });
                        logoRendered = true;
                    }
                } catch (e) { /* ignore */ }
            }

            const companyX = logoRendered ? M + 95 : M;
            const companyMaxW = logoRendered ? 230 : 310;

            doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 14);

            const rightPillW = 220;
            const rightPillX = M + W - rightPillW;
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('LIQUIDACIÓN LABORAL Y FINIQUITO', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('CONSTANCIA DE PRESTACIONES LABORALES', rightPillX, y + 13, { width: rightPillW, align: 'right' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`LIQ-${String(data.id || '1').padStart(5, '0')} • FECHA: ${new Date().toLocaleDateString('es-SV')}`, rightPillX, y + 24, { width: rightPillW, align: 'right' });

            y += 38;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 6;

            // --- 2. Employee Identification Card ---
            const cardH = 44;
            doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('EMPLEADO:', M + 8, y + 4.5);
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName.substring(0, 36), M + 8, y + 13.5, { width: 190, ellipsis: true });

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('CARGO:', M + 210, y + 4.5);
            doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
            doc.text((data.cargo_nombre || 'GENERAL').substring(0, 30), M + 210, y + 13.5, { width: 155, ellipsis: true });

            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('DEPARTAMENTO:', M + 375, y + 4.5);
            doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
            doc.text((data.departamento_nombre || 'GENERAL').substring(0, 30), M + 375, y + 13.5, { width: 155, ellipsis: true });

            // Card Row 2: Metadata
            doc.fontSize(6.8).font('Helvetica').fillColor('#475569');
            const metaLine = `CÓD: ${data.empleado_codigo || '—'}   |   DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}   |   INGRESO: ${fmt(data.fecha_ingreso)}   |   SUELDO BASE: $ ${sueldoMensual.toFixed(2)} (DIARIO: $ ${sueldoDiario.toFixed(2)})`;
            doc.text(metaLine, M + 8, y + 29);

            y += cardH + 7;

            // --- 3. Period & Seniority Cards (4 mini-cards side-by-side) ---
            const miniW = (W - 18) / 4;
            const miniH = 34;

            // Card 1: Indemnización
            doc.rect(M, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('INDEMNIZACIÓN', M + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(`${fmt(data.periodo_indemnizacion_desde)} al ${fmt(data.periodo_indemnizacion_hasta)}`, M + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(`${data.dias_indemnizacion || 0} DÍAS`, M + 5, y + 21.5);

            // Card 2: Vacaciones
            const c2X = M + miniW + 6;
            doc.rect(c2X, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('VACACIÓN PROPORCIONAL', c2X + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(`${fmt(data.periodo_vacaciones_desde)} al ${fmt(data.periodo_vacaciones_hasta)}`, c2X + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(`${data.dias_vacaciones || 0} DÍAS`, c2X + 5, y + 21.5);

            // Card 3: Aguinaldo
            const c3X = c2X + miniW + 6;
            doc.rect(c3X, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('AGUINALDO PROPORCIONAL', c3X + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(`${fmt(data.periodo_aguinaldo_desde)} al ${fmt(data.periodo_aguinaldo_hasta)}`, c3X + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(`${data.dias_aguinaldo || 0} DÍAS`, c3X + 5, y + 21.5);

            // Card 4: Días laborados
            const c4X = c3X + miniW + 6;
            doc.rect(c4X, y, miniW, miniH).fill('#ffffff').stroke('#cbd5e1');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('ÚLTIMOS DÍAS LABORADOS', c4X + 5, y + 3.5);
            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a').text(data.ultimos_dias_laborados ? `${fmt(data.ultimos_dias_laborados)}` : 'AL DÍA', c4X + 5, y + 12, { width: miniW - 10, ellipsis: true });
            doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca').text(pagoUltimosDias > 0 ? `$ ${pagoUltimosDias.toFixed(2)}` : 'COMPLETO', c4X + 5, y + 21.5);

            y += miniH + 9;

            // --- 4. Two Columns Breakdown: PERCEPCIONES vs DEDUCCIONES ---
            const colW = (W - 16) / 2;
            const leftX = M;
            const rightX = M + colW + 16;
            const headerH = 14;
            const rowH = 13;

            // Header Bars
            doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('CONCEPTO DE PERCEPCIÓN (INGRESOS)', leftX + 6, y + 3.5, { width: 180 });
            doc.text('MONTO ($)', leftX + colW - 75, y + 3.5, { width: 70, align: 'right' });

            doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
            doc.text('DEDUCCIONES Y RETENCIONES DE LEY', rightX + 6, y + 3.5, { width: 180 });
            doc.text('MONTO ($)', rightX + colW - 75, y + 3.5, { width: 70, align: 'right' });

            y += headerH + 4;

            // Percepciones List
            let percY = y;
            const drawPercRow = (title, subtitle, amount) => {
                doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#334155');
                doc.text(title, leftX + 6, percY, { width: 180 });
                doc.font('Helvetica').fontSize(6).fillColor('#64748b');
                doc.text(subtitle, leftX + 6, percY + 9, { width: 180 });
                doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
                doc.text(`$ ${amount.toFixed(2)}`, leftX + colW - 75, percY + 3, { width: 70, align: 'right' });
                percY += rowH + 8;
            };

            drawPercRow('Indemnización por Despido / Retiro', `${data.dias_indemnizacion || 0} días calculados según Art. 58 CT`, totalIndemnizacion);
            drawPercRow('Vacación Proporcional Reglamentaria', `${data.dias_vacaciones || 0} días (+30% recargo ley Art. 177 CT)`, totalVacaciones);
            drawPercRow('Aguinaldo Proporcional', `${data.dias_aguinaldo || 0} días computados según Art. 198 CT`, totalAguinaldo);
            if (pagoUltimosDias > 0) {
                drawPercRow('Últimos Días Laborados Pendientes', 'Salario ordinario devengado no cancelado', pagoUltimosDias);
            }

            // Deducciones List
            let dedY = y;
            const isssPct = data.isss_porcentaje || 3;
            const afpPct = data.afp_porcentaje || 7.25;

            const drawDedRow = (title, subtitle, amount) => {
                doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#334155');
                doc.text(title, rightX + 6, dedY, { width: 180 });
                doc.font('Helvetica').fontSize(6).fillColor('#64748b');
                doc.text(subtitle, rightX + 6, dedY + 9, { width: 180 });
                doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
                doc.text(`$ ${amount.toFixed(2)}`, rightX + colW - 75, dedY + 3, { width: 70, align: 'right' });
                dedY += rowH + 8;
            };

            drawDedRow(`Cotización ISSS (${isssPct}%)`, 'Aporte del trabajador para régimen de salud', descuentoISSS);
            drawDedRow(`Cotización AFP (${afpPct}%)`, 'Fondo de pensiones previsional obligatorio', descuentoAFP);
            drawDedRow('Retención Impuesto sobre la Renta (ISR)', 'Cálculo de retención tributaria sobre finiquito', descuentoRenta);
            if (otrosDescuentos > 0) {
                drawDedRow('Otros Descuentos / Préstamos', 'Anticipos, retenciones mercantiles o judiciales', otrosDescuentos);
            }

            // Column Totals
            const maxRowY = Math.max(percY, dedY);

            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
            doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
            doc.text('TOTAL PERCEPCIONES', leftX + 6, maxRowY + 4, { width: 170 });
            doc.text(`$ ${totalDevengado.toFixed(2)}`, leftX + colW - 85, maxRowY + 4, { width: 80, align: 'right' });

            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
            doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a');
            doc.text('TOTAL DEDUCCIONES', rightX + 6, maxRowY + 4, { width: 170 });
            doc.text(`$ ${totalDeducciones.toFixed(2)}`, rightX + colW - 85, maxRowY + 4, { width: 80, align: 'right' });

            y = maxRowY + 22;

            // --- 5. Net Amount Callout Card ---
            const netH = 24;
            doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#3730a3');
            doc.text('TOTAL LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 10, y + 6.5);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e1b4b');
            doc.text(`$ ${montoRecibir.toFixed(2)}`, M + W - 180, y + 5.5, { width: 170, align: 'right' });

            y += netH + 4;
            doc.fontSize(7.2).font('Helvetica-Oblique').fillColor('#475569');
            doc.text(`Son: ${montoLetras}`, M + 6, y, { width: W - 12 });
            y += 13;

            // Cuotas info if enabled
            if (data.pago_cuotas) {
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`Modalidad de Pago Fraccionado: Cancelable en ${data.cuotas} cuotas mensuales y consecutivas de $ ${parseFloat(data.pago_por_cuota || 0).toFixed(2)} cada una.`, M + 6, y);
                y += 12;
            }

            // --- 6. Release Clause (Cláusula de Finiquito) ---
            doc.rect(M, y, W, 40).fill('#fafafa').stroke('#e2e8f0');
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('CLÁUSULA DE FINIQUITO, EXONERACIÓN Y LIBERACIÓN LABORAL:', M + 8, y + 4);
            doc.fontSize(6.2).font('Helvetica').fillColor('#475569');
            const clausulaTexto = `Manifiesto expresamente que he recibido a mi entera satisfacción de ${data.company_name?.toUpperCase() || 'LA EMPRESA'} la cantidad líquida descrita en este documento en concepto de indemnización por terminación de contrato, vacaciones, aguinaldos proporcionales y demás derechos derivados de mi relación de trabajo. En consecuencia, declaro a la empresa y a sus representantes totalmente libres y solventes de cualquier obligación laboral, administrativa, previsional o civil.`;
            doc.text(clausulaTexto, M + 8, y + 14, { width: W - 16, align: 'justify' });

            y += 46;

            const today = new Date();
            const fechaTexto = today.toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.fontSize(7).font('Helvetica').fillColor('#475569');
            doc.text(`San Salvador, ${fechaTexto}`, M, y);

            // --- 7. Dual Signatures Block ---
            const sigLineY = 690;
            const sigW = 210;

            // Empleado Signature
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, sigLineY).lineTo(M + 20 + sigW, sigLineY).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('RECIBÍ CONFORME (EMPLEADO)', M + 20, sigLineY + 3, { width: sigW, align: 'center' });
            doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName, M + 20, sigLineY + 12, { width: sigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}`, M + 20, sigLineY + 21, { width: sigW, align: 'center' });

            // Empresa Signature (with optional stamps and digital signatures)
            const rightSigX = M + W - sigW - 20;

            if (firmaPath) {
                try {
                    const fFile = firmaPath.split('/').pop();
                    const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                    if (fs.existsSync(fAbs)) {
                        doc.image(fAbs, rightSigX + 15, sigLineY - 34, { fit: [95, 30] });
                    }
                } catch (e) {}
            }
            if (selloPath) {
                try {
                    const sFile = selloPath.split('/').pop();
                    const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                    if (fs.existsSync(sAbs)) {
                        doc.image(sAbs, rightSigX + 120, sigLineY - 34, { fit: [80, 30] });
                    }
                } catch (e) {}
            }

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('POR LA EMPRESA / AUTORIZADO', rightSigX, sigLineY + 3, { width: sigW, align: 'center' });
            doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 12, { width: sigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 21, { width: sigW, align: 'center' });

            // Footer note
            doc.fontSize(6).font('Helvetica').fillColor('#94a3b8');
            doc.text('Comprobante emitido en legal forma • Válido como recibo de pago y constancia de liquidación laboral.', M, 742, { align: 'center', width: W });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateFiniquitoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 45, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 45;
            const W = 522;
            const BOTTOM_FOOTER = 742;
            const SIG_Y = 650;

            const today = new Date();
            const city = data.ciudad || 'San Salvador';
            const dept = data.departamento || 'San Salvador';
            const fechaTexto = today.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
            const horaTexto = today.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim().toUpperCase();
            const companyName = (data.company_name || 'EMPRESA').toUpperCase();
            const empleadorNombre = (data.empleador_nombre || data.company_name || 'EL EMPLEADOR').toUpperCase();
            const motivo = data.motivo || 'RENUNCIA INMEDIATA';
            const notarioNombre = data.notario_nombre || '________________________________________';
            const notarioDomicilio = data.notario_domicilio || city;
            const notarioDept = data.notario_dept || dept;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';

            // ==========================================
            // === PAGE 1: Finiquito Laboral Privado ===
            // ==========================================

            let y = 36;
            let logoRendered = false;
            if (logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) {
                        doc.image(p, M, y, { fit: [75, 30] });
                        logoRendered = true;
                    }
                } catch (e) { /* ignore */ }
            }

            const compX = logoRendered ? M + 85 : M;
            const compW = logoRendered ? 240 : 310;
            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(companyName, compX, y, { width: compW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', compX, y + 13);

            const rightPillW = 200;
            const rightPillX = M + W - rightPillW;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('INSTRUMENTO PRIVADO', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('FINIQUITO LABORAL CON DESCARGO TOTAL', rightPillX, y + 12, { width: rightPillW, align: 'right' });

            y += 34;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 12;

            // Document Title
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('DOCUMENTO PRIVADO DE FINIQUITO LABORAL Y DESCARGO TOTAL', M, y, { width: W, align: 'center' });
            y += 20;

            // Body Paragraphs
            doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b');
            doc.text(`Yo, ${empName}, mayor de edad, de nacionalidad salvadoreña, del domicilio de la ciudad de ${city}, departamento de ${dept}, con Documento Único de Identidad número ${data.num_dui || '_______________'} y con Número de Identificación Tributaria ${data.num_nit || '_______________'}; por medio del presente instrumento privado, actuando en mi carácter personal, libre de toda coacción y con pleno conocimiento, MANIFIESTO:`, M, y, { width: W, align: 'justify', lineGap: 3.5 });
            doc.moveDown(0.8);

            doc.font('Helvetica-Bold').text('I) ANTECEDENTE LABORAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que ingresé a prestar mis servicios laborales para y bajo las órdenes de ${companyName}, desempeñando el cargo de ${(data.cargo_nombre || 'GENERAL').toUpperCase()}.`);
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('II) TERMINACIÓN DE LA RELACIÓN: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que en esta fecha, por motivo de ${motivo}, se da por terminada formal y definitivamente la relación de trabajo que me vinculaba con el referido empleador.`);
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('III) LIQUIDACIÓN Y PAGO ÍNTEGRO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text('Que he recibido a mi entera y cabal satisfacción la totalidad de las prestaciones laborales ordinarias y extraordinarias que conforme a derecho me corresponden, comprensivas de: salarios ordinarios y extraordinarios devengados, vacación anual reglamentaria y proporcional con el recargo legal correspondiente, aguinaldo proporcional reglamentario, indemnización por terminación laboral conforme a lo regulado en el Código de Trabajo, horas extraordinarias, días de descanso y asuetos devengados.');
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('IV) FINIQUITO Y EXONERACIÓN TOTAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`En consecuencia de haber recibido a mi entera conformidad el cien por ciento (100%) de todas mis prestaciones, declaro al empleador ${companyName}, a sus administradores, socios y empresas filiales o relacionadas, totalmente libres, solventes y exonerados de toda responsabilidad legal, laboral, previsional (AFP), de seguridad social (ISSS) o civil, no teniendo reclamación alguna presente ni futura que formular en sede judicial ni administrativa, otorgándole por este acto el más amplio, formal y eficaz FINIQUITO LABORAL.`);
            doc.moveDown(0.9);

            doc.font('Helvetica').text(`En fe de lo cual y para que surta los efectos jurídicos correspondientes, firmo el presente documento en la ciudad de ${city}, departamento de ${dept}, a los ${fechaTexto}.`, { width: W, align: 'justify', lineGap: 3.5 });

            // Page 1 Signatures Block
            const p1SigW = 200;
            // Trabajador
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, SIG_Y).lineTo(M + 20 + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('FIRMA DEL TRABAJADOR', M + 20, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName, M + 20, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '_______________'}`, M + 20, SIG_Y + 21, { width: p1SigW, align: 'center' });

            // Empleador
            const p1RightX = M + W - p1SigW - 20;
            if (firmaPath) {
                try {
                    const fFile = firmaPath.split('/').pop();
                    const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                    if (fs.existsSync(fAbs)) doc.image(fAbs, p1RightX + 20, SIG_Y - 32, { fit: [90, 28] });
                } catch (e) {}
            }
            if (selloPath) {
                try {
                    const sFile = selloPath.split('/').pop();
                    const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                    if (fs.existsSync(sAbs)) doc.image(sAbs, p1RightX + 115, SIG_Y - 32, { fit: [75, 28] });
                } catch (e) {}
            }

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(p1RightX, SIG_Y).lineTo(p1RightX + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('POR EL EMPLEADOR', p1RightX, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empleadorNombre, p1RightX, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('REPRESENTANTE PATRONAL', p1RightX, SIG_Y + 21, { width: p1SigW, align: 'center' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8');
            doc.text('Página 1 de 2 • Finiquito Laboral Privado • Sistema Nova SaaS', M, BOTTOM_FOOTER, { align: 'center', width: W });

            // ==========================================
            // === PAGE 2: Acta Notarial de Legalización ===
            // ==========================================
            doc.addPage();

            y = 36;
            if (logoRendered && logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) doc.image(p, M, y, { fit: [75, 30] });
                } catch (e) {}
            }

            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(companyName, compX, y, { width: compW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', compX, y + 13);

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('FE PÚBLICA NOTARIAL', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('ACTA NOTARIAL DE AUTÉNTICA DE FIRMA', rightPillX, y + 12, { width: rightPillW, align: 'right' });

            y += 34;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 12;

            // Title
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('ACTA NOTARIAL DE LEGALIZACIÓN DE FIRMA', M, y, { width: W, align: 'center' });
            y += 22;

            // Body Notarial
            doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b');
            const notariaTexto1 = `En la ciudad de ${city}, departamento de ${dept}, a las ${horaTexto} horas del día ${fechaTexto}. Ante mí, ${notarioNombre}, Notario, del domicilio de la ciudad de ${notarioDomicilio}, departamento de ${notarioDept}, comparece el/la señor(a) ${empName}, de ${data.edad || '___'} años de edad, de nacionalidad salvadoreña, del domicilio de ${city}, departamento de ${dept}, persona a quien no conozco pero identifico por medio de su Documento Único de Identidad número ${data.num_dui || '_______________'}; quien por este medio ME DICE: Que reconoce como suya la firma que calza el documento privado que antecede, redactado en una hoja de papel útil, suscrito en esta misma fecha y ciudad, por haber sido puesta de su propio puño y letra, así como reconoce las declaraciones y el finiquito de prestaciones de ley en él contenidos, en el cual declara libre y solvente de toda responsabilidad laboral a ${companyName}.`;
            doc.text(notariaTexto1, M, y, { width: W, align: 'justify', lineGap: 4 });
            doc.moveDown(1);

            const notariaTexto2 = `Y yo, el suscrito Notario, DOY FE: Que la firma que aparece al calce del anterior documento es AUTÉNTICA, por haber sido puesta de su puño y letra a mi presencia por el compareciente. Leída que le fue por mí íntegramente la presente acta notarial en un solo acto ininterrumpido, manifiesta estar plenamente enterado/a de sus efectos jurídicos, la ratifica por ser conforme a su voluntad y para constancia firma conmigo. DOY FE.`;
            doc.text(notariaTexto2, { width: W, align: 'justify', lineGap: 4 });

            // Signatures Page 2
            // Compareciente
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, SIG_Y).lineTo(M + 20 + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('FIRMA DEL COMPARECIENTE (TRABAJADOR)', M + 20, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empName, M + 20, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '_______________'}`, M + 20, SIG_Y + 21, { width: p1SigW, align: 'center' });

            // Notario
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(p1RightX, SIG_Y).lineTo(p1RightX + p1SigW, SIG_Y).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#334155');
            doc.text('ANTE MÍ: FIRMA Y SELLO NOTARIAL', p1RightX, SIG_Y + 3, { width: p1SigW, align: 'center' });
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text((data.notario_nombre || 'NOTARIO DE LA REPÚBLICA').toUpperCase(), p1RightX, SIG_Y + 12, { width: p1SigW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('NOTARIO AUTORIZADO', p1RightX, SIG_Y + 21, { width: p1SigW, align: 'center' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8');
            doc.text('Página 2 de 2 • Acta Notarial de Legalización • Sistema Nova SaaS', M, BOTTOM_FOOTER, { align: 'center', width: W });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAcuerdoPagoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 45, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 45;
            const W = 522;
            const BOTTOM_FOOTER = 742;
            const SIG_Y = 645;

            const today = new Date();
            const city = data.ciudad || 'San Salvador';
            const dept = data.departamento || 'San Salvador';
            const fechaTexto = today.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
            const horaTexto = today.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

            const empleado = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim().toUpperCase();
            const empleador = (data.company_name || 'EL EMPLEADOR').toUpperCase();
            const firmante = (data.empleador_nombre || data.company_name || 'REPRESENTANTE PATRONAL').toUpperCase();
            const montoVal = parseFloat(data.monto_recibir || 0);
            const monto = montoVal.toFixed(2);
            const numCuotas = data.cuotas || 1;
            const pagoCuota = parseFloat(data.pago_por_cuota || 0).toFixed(2);
            const diaPago = today.getDate();
            const montoLetras = numberToWords ? numberToWords(montoVal) : '';
            const cuotaLetras = numberToWords ? numberToWords(parseFloat(pagoCuota)) : '';

            const notarioNombre = data.notario_nombre || '________________________________________';
            const notarioDomicilio = data.notario_domicilio || city;
            const notarioDept = data.notario_dept || dept;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';

            // --- Header ---
            let y = 36;
            let logoRendered = false;
            if (logoPath) {
                try {
                    const f = logoPath.split('/').pop();
                    const p = path.join(__dirname, '..', '..', 'uploads', f);
                    if (fs.existsSync(p)) {
                        doc.image(p, M, y, { fit: [75, 30] });
                        logoRendered = true;
                    }
                } catch (e) { /* ignore */ }
            }

            const compX = logoRendered ? M + 85 : M;
            const compW = logoRendered ? 240 : 310;
            doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empleador, compX, y, { width: compW, ellipsis: true });
            doc.fontSize(7.5).font('Helvetica').fillColor('#64748b');
            doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', compX, y + 13);

            const rightPillW = 200;
            const rightPillX = M + W - rightPillW;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#312e81');
            doc.text('INSTRUMENTO NOTARIAL', rightPillX, y, { width: rightPillW, align: 'right' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#4338ca');
            doc.text('ACUERDO DE PAGO Y LIQUIDACIÓN EN CUOTAS', rightPillX, y + 12, { width: rightPillW, align: 'right' });

            y += 34;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
            y += 12;

            // Title
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('ACTA NOTARIAL DE ACUERDO DE PAGO Y LIQUIDACIÓN LABORAL', M, y, { width: W, align: 'center' });
            y += 20;

            // Body
            doc.fontSize(9).font('Helvetica').fillColor('#1e293b');
            const introTexto = `En la ciudad de ${city}, departamento de ${dept}, a las ${horaTexto} horas del día ${fechaTexto}. Ante mí, ${notarioNombre}, Notario, del domicilio de la ciudad de ${notarioDomicilio}, Departamento de ${notarioDept}, comparece ${empleado}, mayor de edad, del domicilio de ${city}, departamento de ${dept}, a quien no conozco pero identifico mediante su Documento Único de Identidad número ${data.num_dui || '_______________'}, quien en adelante se denominará como "EL TRABAJADOR"; y por otra parte el señor(a) ${firmante}, en su calidad de representante de ${empleador}, en adelante denominado "EL EMPLEADOR"; y de consuno y mutuo acuerdo ME DICEN:`;
            doc.text(introTexto, M, y, { width: W, align: 'justify', lineGap: 3.5 });
            doc.moveDown(0.7);

            doc.font('Helvetica-Bold').text('I) ANTECEDENTE LABORAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que entre las partes comparecientes existió una relación de trabajo en la cual el trabajador desempeñó las funciones correspondientes al cargo de ${(data.cargo_nombre || 'GENERAL').toUpperCase()}.`);
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('II) TERMINACIÓN POR MUTUO CONSENTIMIENTO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text('Que ambas partes de mutuo y libre consentimiento convienen en dar por terminada su relación laboral en esta misma fecha, en apego a las disposiciones pertinentes del Código de Trabajo.');
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('III) LIQUIDACIÓN Y MONTO CONVENIDO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Que habiendo practicado la liquidación de las prestaciones laborales ordinarias y extraordinarias correspondientes (indemnización, vacación y aguinaldo proporcionales), fijan de común acuerdo la suma neta definitiva a pagar en la cantidad de ${montoLetras.toUpperCase()} ($ ${monto} DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA).`);
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('IV) CALENDARIO Y MODALIDAD DE PAGO: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`Convienen las partes que dicha cantidad será cancelada íntegramente por el Empleador mediante un plan de ${numCuotas} cuotas mensuales, fijas y sucesivas de $ ${pagoCuota} (${cuotaLetras.toUpperCase()}) cada una, pagaderas los días ${diaPago} de cada uno de los meses subsiguientes hasta la total extinción del saldo. Si el día de pago correspondiese a día inhábil, el pago se verificará el primer día hábil inmediato posterior.`);
            doc.moveDown(0.6);

            doc.font('Helvetica-Bold').text('V) FINIQUITO CONDICIONAL: ', { continued: true, lineGap: 3.5 })
               .font('Helvetica').text(`El trabajador manifiesta darse por enteramente satisfecho con el presente acuerdo voluntario y se compromete formalmente a que, al recibir el pago íntegro de la última cuota convenida, otorgará el respectivo finiquito laboral total y definitivo a favor de ${empleador}.`);
            doc.moveDown(0.7);

            doc.font('Helvetica').text(`Y yo, el suscrito Notario, DOY FE: a) De haber explicado a los comparecientes los efectos jurídicos del presente acuerdo de pago, manifestando encontrarse enterados y aceptarlo por ser su fiel y libre voluntad; y b) Que los otorgantes se encuentran en el libre ejercicio de sus facultades civiles para celebrar este acto. Leída que les fue la presente acta íntegramente en un solo acto sin interrupción, la ratifican y firman conmigo. DOY FE.`, { width: W, align: 'justify', lineGap: 3.5 });

            // Signatures (Fixed at Bottom)
            const sigBoxW = 160;

            // 1. Trabajador
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 5, SIG_Y).lineTo(M + 5 + sigBoxW, SIG_Y).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('FIRMA DEL TRABAJADOR', M + 5, SIG_Y + 3, { width: sigBoxW, align: 'center' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(empleado, M + 5, SIG_Y + 12, { width: sigBoxW, align: 'center' });
            doc.fontSize(6).font('Helvetica').fillColor('#64748b');
            doc.text(`DUI: ${data.num_dui || '—'}`, M + 5, SIG_Y + 21, { width: sigBoxW, align: 'center' });

            // 2. Empleador
            const midSigX = M + 180;
            if (firmaPath) {
                try {
                    const fFile = firmaPath.split('/').pop();
                    const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                    if (fs.existsSync(fAbs)) doc.image(fAbs, midSigX + 15, SIG_Y - 32, { fit: [80, 28] });
                } catch (e) {}
            }
            if (selloPath) {
                try {
                    const sFile = selloPath.split('/').pop();
                    const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                    if (fs.existsSync(sAbs)) doc.image(sAbs, midSigX + 95, SIG_Y - 32, { fit: [65, 28] });
                } catch (e) {}
            }

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(midSigX, SIG_Y).lineTo(midSigX + sigBoxW, SIG_Y).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('POR EL EMPLEADOR', midSigX, SIG_Y + 3, { width: sigBoxW, align: 'center' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(firmante, midSigX, SIG_Y + 12, { width: sigBoxW, align: 'center' });
            doc.fontSize(6).font('Helvetica').fillColor('#64748b');
            doc.text('REPRESENTANTE PATRONAL', midSigX, SIG_Y + 21, { width: sigBoxW, align: 'center' });

            // 3. Notario
            const rightSigX = M + 360;
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, SIG_Y).lineTo(rightSigX + sigBoxW, SIG_Y).stroke();
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
            doc.text('ANTE MÍ: FIRMA Y SELLO', rightSigX, SIG_Y + 3, { width: sigBoxW, align: 'center' });
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text((data.notario_nombre || 'NOTARIO').toUpperCase(), rightSigX, SIG_Y + 12, { width: sigBoxW, align: 'center' });
            doc.fontSize(6).font('Helvetica').fillColor('#64748b');
            doc.text('NOTARIO AUTORIZADO', rightSigX, SIG_Y + 21, { width: sigBoxW, align: 'center' });

            doc.fontSize(6.5).font('Helvetica').fillColor('#94a3b8');
            doc.text('Acta Notarial de Acuerdo de Pago • Documento fehaciente emitido por Sistema Nova SaaS', M, BOTTOM_FOOTER, { align: 'center', width: W });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateHonorarioPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 28;
            const W = 556;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'PAGADURÍA / GERENCIA FINANCIERA';
            const nombrePrestador = (data.nombre || '').trim().toUpperCase();

            const fmt = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            const monto = parseFloat(data.monto || 0);
            const isr = parseFloat(data.renta_isr || 0);
            const liquido = parseFloat(data.liquido_pagar || (monto - isr));
            const montoLetras = data.monto_letras || (numberToWords ? numberToWords(liquido) : '');

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // --- 1. Header (Logo, Company, Title Pill) ---
                let logoRendered = false;
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) {
                            doc.image(p, M, y, { fit: [60, 26] });
                            logoRendered = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                const companyX = logoRendered ? M + 68 : M;
                const companyMaxW = logoRendered ? 270 : 330;

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                // Right header pill: Titulo & Numero
                const rightPillW = 220;
                const rightPillX = M + W - rightPillW;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                doc.text('RECIBO DE HONORARIOS Y SERVICIOS', rightPillX, y, { width: rightPillW, align: 'right' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`NÚMERO: ${data.numero || '—'}   •   FECHA: ${fmt(data.fecha)}`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                y += 24;
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                y += 4;

                // --- 2. Provider Information Card ---
                const cardH = 36;
                doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                // Card Row 1
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('PRESTADOR / PROFESIONAL:', M + 8, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(nombrePrestador.substring(0, 38), M + 8, y + 11.5, { width: 230, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('DUI:', M + 260, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                doc.text(data.num_dui || '—', M + 260, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('NIT:', M + 360, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                doc.text(data.num_nit || '—', M + 360, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('RÉGIMEN:', M + 455, y + 3.5);
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('HONORARIOS (10% ISR)', M + 455, y + 11.5);

                // Card Row 2: Concepto
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('POR CONCEPTO DE: ', M + 8, y + 23.5, { continued: true });
                doc.font('Helvetica-Oblique').fillColor('#334155');
                doc.text((data.concepto || 'Servicios profesionales independientes').substring(0, 85), { width: W - 120, ellipsis: true });

                y += cardH + 5;

                // --- 3. Two Columns: CONCEPTO BRUTO & RETENCIONES ---
                const colW = 270;
                const colGutter = 16;
                const leftX = M;
                const rightX = M + colW + colGutter;
                const headerH = 12;
                const rowH = 10;

                doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('HONORARIOS DEVENGADOS (VALOR BRUTO)', leftX + 4, y + 3, { width: 180 });
                doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                doc.text('RETENCIÓN TRIBUTARIA DE LEY', rightX + 4, y + 3, { width: 180 });
                doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                y += headerH + 3;

                // Left Column: Bruto
                let percY = y;
                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text('Honorarios por Servicios Profesionales', leftX + 4, percY, { width: 185, ellipsis: true });
                doc.text(`$ ${monto.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                percY += rowH;

                // Right Column: Retención
                let dedY = y;
                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text('Retención ISR 10% (Art. 156 C. Tributario)', rightX + 4, dedY, { width: 185, ellipsis: true });
                doc.text(`$ ${isr.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                // Totals
                const maxRowY = Math.max(percY, dedY) + 2;

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL HONORARIOS BRUTO', leftX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${monto.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL RETENCIÓN DE LEY', rightX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${isr.toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                y = maxRowY + 16;

                // --- 4. Líquido a Pagar ---
                const netH = 17;
                doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text('LÍQUIDO A PAGAR (NETO RECIBIDO):', M + 8, y + 4.5);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                doc.text(`$ ${liquido.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                y += netH + 3;
                doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                y += 9;
                doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                doc.text('Dinero que recibo a mi entera satisfacción por servicios profesionales prestados de forma independiente, aceptando expresamente la retención fiscal efectuada.', M + 4, y, { width: W - 8 });

                // --- 5. Signatures ---
                y += 34;
                const sigLineY = y;
                const sigW = 200;

                // Prestador
                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('RECIBÍ CONFORME (PRESTADOR)', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(nombrePrestador, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${data.num_dui || '—'}   |   NIT: ${data.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Empresa
                const rightSigX = M + W - sigW - 15;

                if (firmaPath) {
                    try {
                        const fFile = firmaPath.split('/').pop();
                        const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                        if (fs.existsSync(fAbs)) {
                            doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                        }
                    } catch (e) {}
                }
                if (selloPath) {
                    try {
                        const sFile = selloPath.split('/').pop();
                        const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                        if (fs.existsSync(sAbs)) {
                            doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                        }
                    } catch (e) {}
                }

                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('AUTORIZADO Y PAGADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text((data.company_name || 'EMPRESA').toUpperCase(), rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Copy label at bottom
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
            };

            // Top Copy (Copia Prestador)
            drawCopy(22, 'COPIA PRESTADOR / PROFESIONAL');

            // Middle dashed divider line
            const PAGE_MID = 396;
            doc.save()
               .strokeColor('#cbd5e1')
               .lineWidth(0.6)
               .dash(4, { space: 3 })
               .moveTo(M, PAGE_MID)
               .lineTo(M + W, PAGE_MID)
               .stroke()
               .undash()
               .restore();

            // Bottom Copy (Original Empresa)
            drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAguinaldoPDF = async (data) => {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const startX = 30;
    const contentWidth = 732;
    const items = data.items || [];
    const company = data.company || {
        razon_social: data.company_name || 'EMPRESA REGISTRADA',
        nit: data.company_nit || '0000-000000-000-0',
        nrc: data.company_nrc || '000000-0'
    };

    const title = 'PLANILLA DE AGUINALDOS';
    const periodText = data.periodo_label
        ? `CORRESPONDIENTE AL PERÍODO: ${data.periodo_label}`
        : `CORRESPONDIENTE AL EJERCICIO FISCAL ${data.año || new Date().getFullYear()}`;
    const subtitle = data.departamento_label && data.departamento_label !== 'Todos'
        ? `DEPARTAMENTO: ${data.departamento_label}`
        : null;

    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

    const colW = {
        num: 18,
        codigo: 38,
        nombre: 150,
        cargo: 85,
        ingreso: 48,
        base: 48,
        dias: 28,
        tabla: 26,
        sueldo: 56,
        aguinaldo: 62,
        excedente: 55,
        renta: 50,
        recibir: 68
    };

    const drawTableHeader = (yPos) => {
        doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        let x = startX + 2;
        doc.text('Nº', x, yPos + 3.5, { width: colW.num, align: 'center' }); x += colW.num;
        doc.text('CÓDIGO', x, yPos + 3.5, { width: colW.codigo }); x += colW.codigo;
        doc.text('EMPLEADO', x, yPos + 3.5, { width: colW.nombre }); x += colW.nombre;
        doc.text('CARGO / PUESTO', x, yPos + 3.5, { width: colW.cargo }); x += colW.cargo;
        doc.text('F. INGRESO', x, yPos + 3.5, { width: colW.ingreso, align: 'center' }); x += colW.ingreso;
        doc.text('F. BASE', x, yPos + 3.5, { width: colW.base, align: 'center' }); x += colW.base;
        doc.text('D. ANT.', x, yPos + 3.5, { width: colW.dias - 2, align: 'right' }); x += colW.dias;
        doc.text('D. LEY', x, yPos + 3.5, { width: colW.tabla - 2, align: 'right' }); x += colW.tabla;
        doc.text('SUELDO B.', x, yPos + 3.5, { width: colW.sueldo - 3, align: 'right' }); x += colW.sueldo;
        doc.text('AGUINALDO', x, yPos + 3.5, { width: colW.aguinaldo - 3, align: 'right' }); x += colW.aguinaldo;
        doc.text('EXC. RENTA', x, yPos + 3.5, { width: colW.excedente - 3, align: 'right' }); x += colW.excedente;
        doc.text('RET. RENTA', x, yPos + 3.5, { width: colW.renta - 3, align: 'right' }); x += colW.renta;
        doc.text('LÍQUIDO', x, yPos + 3.5, { width: colW.recibir - 3, align: 'right' });

        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, yPos + 14).lineTo(startX + contentWidth, yPos + 14).stroke();
        return yPos + 17;
    };

    let y = drawTableHeader(doc.y + 4);

    if (items.length === 0) {
        doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
        doc.text('No se encontraron registros de aguinaldos para el período seleccionado.', startX, y + 10);
        y += 30;
    } else {
        const grupos = new Map();
        for (const item of items) {
            const depto = item.departamento_nombre || 'Sin Depto.';
            if (!grupos.has(depto)) grupos.set(depto, []);
            grupos.get(depto).push(item);
        }

        let totalSueldo = 0;
        let totalAguinaldo = 0;
        let totalExcedente = 0;
        let totalRenta = 0;
        let totalRecibir = 0;
        let globalIndex = 0;

        for (const [depto, deptoItems] of grupos) {
            if (grupos.size > 1) {
                if (y > 510) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                    y = drawTableHeader(doc.y + 4);
                }
                doc.rect(startX, y, contentWidth, 12.5).fill('#e2e8f0');
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(`DEPARTAMENTO: ${depto.toUpperCase()} (${deptoItems.length} EMPLEADOS)`, startX + 4, y + 2.5);
                y += 15;
            }

            for (const item of deptoItems) {
                globalIndex++;
                if (y > 525) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                    y = drawTableHeader(doc.y + 4);
                }

                const sueldo = parseFloat(item.sueldo_base || 0);
                const aguinaldo = parseFloat(item.aguinaldo_calculado || 0);
                const excedente = parseFloat(item.excedente || 0);
                const renta = parseFloat(item.renta || 0);
                const recibir = parseFloat(item.monto_recibir || 0);

                totalSueldo += sueldo;
                totalAguinaldo += aguinaldo;
                totalExcedente += excedente;
                totalRenta += renta;
                totalRecibir += recibir;

                if (globalIndex % 2 === 0) {
                    doc.rect(startX, y - 1.5, contentWidth, 12).fill('#f8fafc');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
                let rx = startX + 2;
                doc.text(String(globalIndex), rx, y, { width: colW.num, align: 'center' }); rx += colW.num;
                doc.text(item.codigo || '', rx, y, { width: colW.codigo }); rx += colW.codigo;
                const empNombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
                doc.text(empNombre.substring(0, 32), rx, y, { width: colW.nombre - 3, ellipsis: true }); rx += colW.nombre;
                const cargoNombre = item.cargo_nombre || 'GENERAL';
                doc.text(cargoNombre.substring(0, 18), rx, y, { width: colW.cargo - 3, ellipsis: true }); rx += colW.cargo;
                doc.text(reportPdfHelper.formatDate(item.fecha_ingreso), rx, y, { width: colW.ingreso, align: 'center' }); rx += colW.ingreso;
                doc.text(reportPdfHelper.formatDate(item.fecha_base), rx, y, { width: colW.base, align: 'center' }); rx += colW.base;
                doc.text(String(item.dias_antiguedad || 0), rx, y, { width: colW.dias - 2, align: 'right' }); rx += colW.dias;
                doc.text(String(item.dias_segun_tabla || 0), rx, y, { width: colW.tabla - 2, align: 'right' }); rx += colW.tabla;
                doc.text(reportPdfHelper.fmt(sueldo), rx, y, { width: colW.sueldo - 3, align: 'right' }); rx += colW.sueldo;
                doc.text(reportPdfHelper.fmt(aguinaldo), rx, y, { width: colW.aguinaldo - 3, align: 'right' }); rx += colW.aguinaldo;
                doc.text(reportPdfHelper.fmt(excedente), rx, y, { width: colW.excedente - 3, align: 'right' }); rx += colW.excedente;
                doc.text(reportPdfHelper.fmt(renta), rx, y, { width: colW.renta - 3, align: 'right' }); rx += colW.renta;
                doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(recibir), rx, y, { width: colW.recibir - 3, align: 'right' });
                y += 12;
            }
        }

        // Totals row
        if (y > 510) {
            doc.addPage();
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            y = doc.y + 10;
        }

        doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
        y += 4;
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTALES GENERALES:', startX + 2, y);

        let tx = startX + colW.num + colW.codigo + colW.nombre + colW.cargo + colW.ingreso + colW.base + colW.dias + colW.tabla;
        doc.text(reportPdfHelper.fmt(totalSueldo), tx, y, { width: colW.sueldo - 3, align: 'right' }); tx += colW.sueldo;
        doc.text(reportPdfHelper.fmt(totalAguinaldo), tx, y, { width: colW.aguinaldo - 3, align: 'right' }); tx += colW.aguinaldo;
        doc.text(reportPdfHelper.fmt(totalExcedente), tx, y, { width: colW.excedente - 3, align: 'right' }); tx += colW.excedente;
        doc.text(reportPdfHelper.fmt(totalRenta), tx, y, { width: colW.renta - 3, align: 'right' }); tx += colW.renta;
        doc.text(reportPdfHelper.fmt(totalRecibir), tx, y, { width: colW.recibir - 3, align: 'right' });

        y += 18;
    }

    reportPdfHelper.renderClosingFooter(doc, startX, y, items.length, 'Empleados');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return getBuffer();
};

const generateAguinaldoRecibosPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const items = data.items || [];
            const año = data.año || new Date().getFullYear();
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const logoPath = data.logo_url;

            const M = 28;
            const W = 556;

            const fmtDate = (d) => {
                if (!d) return '—';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            for (let i = 0; i < items.length; i++) {
                if (i > 0) doc.addPage();
                const item = items[i];
                const sueldo = parseFloat(item.sueldo_base || 0);
                const sueldoDiario = sueldo / 30;
                const aguinaldo = parseFloat(item.aguinaldo_calculado || 0);
                const renta = parseFloat(item.renta || 0);
                const monto = parseFloat(item.monto_recibir || 0);
                const dias = item.dias_antiguedad || 0;
                const anios = (dias / 365).toFixed(1);
                const diasPagados = item.dias_segun_tabla || 0;
                const depto = item.departamento_nombre || 'GENERAL';
                const cargo = item.cargo_nombre || 'GENERAL';
                const nombre = `${item.nombres || ''} ${item.apellidos || ''}`.trim();
                const montoLetras = numberToWords ? numberToWords(monto) : '';

                const drawCopy = (yStart, label) => {
                    let y = yStart;

                    // --- 1. Header (Logo, Company, Title Pill) ---
                    let logoRendered = false;
                    if (logoPath) {
                        try {
                            const f = logoPath.split('/').pop();
                            const p = path.join(__dirname, '..', '..', 'uploads', f);
                            if (fs.existsSync(p)) {
                                doc.image(p, M, y, { fit: [60, 26] });
                                logoRendered = true;
                            }
                        } catch (e) { /* ignore */ }
                    }

                    const companyX = logoRendered ? M + 68 : M;
                    const companyMaxW = logoRendered ? 270 : 330;

                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                    doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                    // Right header pill: Titulo & Periodo
                    const rightPillW = 220;
                    const rightPillX = M + W - rightPillW;
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                    doc.text('RECIBO DE AGUINALDO NAVIDEÑO', rightPillX, y, { width: rightPillW, align: 'right' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                    doc.text(`EJERCICIO: ${año}   •   ART. 198 CÓDIGO DE TRABAJO`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                    y += 24;
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                    y += 4;

                    // --- 2. Employee Info Card ---
                    const cardH = 34;
                    doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                    // Row 1
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('EMPLEADO:', M + 8, y + 3.5);
                    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(nombre.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                    doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                    const cargoDepto = `${cargo} • ${depto}`;
                    doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('DÍAS A PAGAR:', M + 375, y + 3.5);
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                    doc.text(`${diasPagados} DÍAS`, M + 375, y + 11.5);

                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                    doc.text('SUELDO MENSUAL:', M + 455, y + 3.5);
                    doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`$ ${sueldo.toFixed(2)}`, M + 455, y + 11.5);

                    // Row 2 (Metadata badges line)
                    doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                    const metaLine = `CÓD: ${item.codigo || '—'}   |   DUI: ${item.num_dui || '—'}   |   INGRESO: ${fmtDate(item.fecha_ingreso)}   |   ANTIGÜEDAD: ${anios} AÑOS (${dias} DÍAS)   |   S. DIARIO: $ ${sueldoDiario.toFixed(2)}`;
                    doc.text(metaLine, M + 8, y + 23);

                    y += cardH + 5;

                    // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                    const colW = 270;
                    const colGutter = 16;
                    const leftX = M;
                    const rightX = M + colW + colGutter;
                    const headerH = 12;
                    const rowH = 10;

                    // Headers
                    doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                    doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                    doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                    doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                    doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                    doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                    y += headerH + 3;

                    // Left Column: Aguinaldo
                    let percY = y;
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    doc.text(`Aguinaldo Calculado (${diasPagados} días s/ tabla Art. 198 CT)`, leftX + 4, percY, { width: 185, ellipsis: true });
                    doc.text(`$ ${aguinaldo.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                    percY += rowH;

                    // Right Column: Renta / ISSS / AFP
                    let dedY = y;
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    doc.text('Impuesto sobre la Renta (ISR s/ Aguinaldo)', rightX + 4, dedY, { width: 185 });
                    doc.text(`$ ${renta.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                    dedY += rowH;

                    // Subtotals
                    const maxRowY = Math.max(percY, dedY) + 2;

                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                    doc.text('TOTAL DEVENGADO', leftX + 4, maxRowY + 3, { width: 180 });
                    doc.text(`$ ${aguinaldo.toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                    doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                    doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                    doc.text(`$ ${renta.toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                    y = maxRowY + 16;

                    // --- 4. Líquido a Recibir ---
                    const netH = 17;
                    doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                    doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                    doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                    doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                    doc.text(`$ ${monto.toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                    y += netH + 3;
                    doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                    doc.text(`Son: ${montoLetras}`, M + 4, y, { width: W - 8 });

                    y += 9;
                    doc.fontSize(5.5).font('Helvetica').fillColor('#64748b');
                    doc.text(`Dinero que recibo a mi entera satisfacción en concepto de liquidación de aguinaldo correspondiente al ejercicio ${año}, en estricto cumplimiento del Art. 198 del Código de Trabajo.`, M + 4, y, { width: W - 8 });

                    // --- 5. Signatures ---
                    y += 34;
                    const sigLineY = y;
                    const sigW = 200;

                    // Empleado
                    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                    doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                    doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(nombre, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                    doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                    doc.text(`DUI: ${item.num_dui || '—'}   |   NIT: ${item.num_nit || '—'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                    // Empresa / RRHH
                    const rightSigX = M + W - sigW - 15;

                    if (firmaPath) {
                        try {
                            const fFile = firmaPath.split('/').pop();
                            const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                            if (fs.existsSync(fAbs)) {
                                doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                            }
                        } catch (e) {}
                    }
                    if (selloPath) {
                        try {
                            const sFile = selloPath.split('/').pop();
                            const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                            if (fs.existsSync(sAbs)) {
                                doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                            }
                        } catch (e) {}
                    }

                    doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                    doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                    doc.text('AUTORIZADO POR', rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                    doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });
                    doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                    doc.text('DEPARTAMENTO DE RECURSOS HUMANOS', rightSigX, sigLineY + 18.5, { width: sigW, align: 'center' });

                    // Copy label at bottom
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#818cf8');
                    doc.text(`• ${label} •`, M, sigLineY + 27, { width: W, align: 'center' });
                };

                // Top Copy (Copia Empleado)
                drawCopy(22, 'COPIA EMPLEADO');

                // Middle dashed divider line
                const PAGE_MID = 396;
                doc.save()
                   .strokeColor('#cbd5e1')
                   .lineWidth(0.6)
                   .dash(4, { space: 3 })
                   .moveTo(M, PAGE_MID)
                   .lineTo(M + W, PAGE_MID)
                   .stroke()
                   .undash()
                   .restore();

                // Bottom Copy (Original Empresa)
                drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

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
            const align = c.align || (c.format === 'money' ? 'right' : c.format === 'date' ? 'center' : 'left');
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
            const align = c.align || (c.format === 'money' ? 'right' : c.format === 'date' ? 'center' : 'left');
            const padX = align === 'right' ? x : x + 2;
            const w = align === 'right' ? c.w - 2 : c.w - 4;

            if (c.format === 'money') {
                doc.text(reportPdfHelper.fmt(val), padX, currentY + 1, { width: w, align: 'right' });
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
                doc.text(`TIPO DE POS: ${String(group.label ?? '—').toUpperCase()}`, padX, currentY + 2, { width: w, align: 'left', lineBreak: false });
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

    let tx = startX;
    colDefs.forEach((c, idx) => {
        const align = c.align || (c.format === 'money' ? 'right' : 'left');
        const padX = align === 'right' ? tx : tx + 2;
        const w = align === 'right' ? c.w - 2 : c.w - 4;

        if (idx === 0) {
            doc.text('TOTALES GENERALES:', padX, currentY + 2, { width: w, align: 'left' });
        } else if (c.format === 'money') {
            const total = (data.rows || []).reduce((s, r) => s + (parseFloat(r[c.accessor || c.label]) || 0), 0);
            doc.text(reportPdfHelper.fmt(total), padX, currentY + 2, { width: w, align: 'right' });
        } else if (c.accessor === 'cantidad') {
            const totalQty = (data.rows || []).reduce((s, r) => s + (parseFloat(r[c.accessor || c.label]) || 0), 0);
            doc.text(Number(totalQty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), padX, currentY + 2, { width: w, align: 'right' });
        }
        tx += c.w;
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

    reportPdfHelper.renderClosingFooter(doc, startX, currentY, totalItemsCount, 'Registros');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return await getBuffer();
};

const generatePlanillaPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 40;
            const pageW = 532;
            const BOTTOM = 740;

            const logoPath = data.logo_url;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) doc.image(absolutePath, M, 28, { width: 75 });
                } catch (e) { /* ignore */ }
            }
            const hx = logoPath ? 125 : M;
            doc.fontSize(14).font('Helvetica-Bold').text(data.company_name, hx, 28);
            doc.fontSize(9).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, 44);
            doc.fontSize(12).font('Helvetica-Bold').text('PLANILLA QUINCENAL', M, 28, { align: 'right' });
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#4f46e5')
                .text(`$ ${parseFloat(data.monto_recibir).toFixed(2)}`, M, 42, { align: 'right' });
            doc.fillColor('black');

            const quincenaLabel = data.quincena === 'primera' ? '1ra' : '2da';
            const mesLabel = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][(data.periodo_mes || 1) - 1] || '';
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '';

            doc.rect(M, 76, pageW, 56).stroke('#e5e7eb');
            doc.fontSize(9).font('Helvetica');
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`;
            doc.text(`Empleado: ${empName}`, M + 12, 86);
            doc.text(`Cargo: ${data.cargo_nombre || ''}`, M + 12, 100);
            doc.text(`Departamento: ${data.departamento_nombre || ''}`, M + 12, 114);
            doc.text(`Periodo: ${mesLabel} ${data.periodo_anio} - ${quincenaLabel} Quincena`, 280, 86);
            doc.text(`Dias Trabajados: ${data.dias_trabajados || 0}`, 280, 100);
            doc.text(`Sueldo Base: $ ${parseFloat(data.sueldo_base).toFixed(2)}`, 280, 114);

            let ry = 148;
            doc.fontSize(10).font('Helvetica-Bold').text('DETALLE DE PLANILLA', M, ry);
            ry += 18;

            const col1X = M;
            const col2X = 300;
            const colVal1 = 250;
            const colVal2 = 510;
            const rowH = 14;

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
            doc.text('PERCEPCIONES', col1X, ry);
            doc.text('DEDUCCIONES', col2X, ry);
            doc.fillColor('black');
            ry += 14;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 4;

            const percepciones = (data.detalles || []).filter(d => d.operacion === 'sumar');
            const deducciones = (data.detalles || []).filter(d => d.operacion === 'restar');

            doc.font('Helvetica').fontSize(8);
            const maxRows = Math.max(percepciones.length, deducciones.length);
            for (let i = 0; i < maxRows; i++) {
                if (i < percepciones.length) {
                    const p = percepciones[i];
                    doc.text(`${p.codigo} - ${p.descripcion}`, col1X, ry);
                    doc.text(`$ ${parseFloat(p.valor_ingresado || 0).toFixed(2)}`, colVal1, ry, { align: 'right' });
                }
                if (i < deducciones.length) {
                    const d = deducciones[i];
                    doc.text(`${d.codigo} - ${d.descripcion}`, col2X, ry);
                    doc.text(`$ ${parseFloat(d.valor_ingresado || 0).toFixed(2)}`, colVal2, ry, { align: 'right' });
                }
                ry += rowH;
            }

            ry += 2;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold').fontSize(9);
            doc.text('TOTAL PERCEPCIONES', col1X, ry);
            doc.text(`$ ${parseFloat(data.total_percepciones).toFixed(2)}`, colVal1, ry, { align: 'right' });
            ry += 16;

            doc.font('Helvetica').fontSize(9);
            doc.text('RETENCIONES DE LEY:', col2X, ry - 16);
            const isssPct = data.isss_porcentaje || 0;
            const afpPct = data.afp_porcentaje || 0;
            doc.text(`ISSS (${isssPct}%)`, col2X, ry);
            doc.text(`$ ${parseFloat(data.descuento_isss).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 14;
            doc.text(`AFP (${afpPct}%)`, col2X, ry);
            doc.text(`$ ${parseFloat(data.descuento_afp).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 14;
            doc.text('RENTA', col2X, ry);
            doc.text(`$ ${parseFloat(data.descuento_renta).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 16;
            doc.moveTo(col2X, ry).lineTo(colVal2, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold').fontSize(9);
            doc.text('TOTAL DEDUCCIONES', col2X, ry);
            doc.text(`$ ${parseFloat(data.total_deducciones).toFixed(2)}`, colVal2, ry, { align: 'right' });
            ry += 22;

            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#4f46e5');
            ry += 6;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#4f46e5');
            doc.text('MONTO A RECIBIR', M, ry);
            doc.text(`$ ${parseFloat(data.monto_recibir).toFixed(2)}`, colVal1, ry, { align: 'right' });
            doc.fillColor('black');

            const legalY = ry + 24;
            doc.fontSize(8).font('Helvetica-Oblique')
                .text(`Recibí de ${data.company_name} la cantidad de ${data.monto_letras}, en concepto de planilla quincenal.`, M, legalY, { width: pageW, align: 'justify' });

            const today = new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.fontSize(9).font('Helvetica').text(`San Salvador, ${today}`, M, legalY + 20);

            const firmY = BOTTOM - 90;
            doc.moveTo(100, firmY).lineTo(270, firmY).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Recibí Conforme', 125, firmY + 4, { align: 'center', width: 120 });
            doc.fontSize(9).font('Helvetica-Bold')
                .text(empName, M, firmY + 22);
            doc.fontSize(8).font('Helvetica').text('FIRMA', M, firmY + 36);
            let extraY = firmY + 50;
            if (data.num_dui) { doc.text(`DUI: ${data.num_dui}`, M, extraY); extraY += 12; }
            if (data.num_nit) { doc.text(`NIT: ${data.num_nit}`, M, extraY); }

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generatePlanillaReciboPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 24, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 28;
            const W = 556;
            const quincenaLabel = data.quincena === 'primera' ? '1ra' : '2da';
            const mesLabel = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][(data.periodo_mes || 1) - 1] || '';
            const mesAnio = `${mesLabel} ${data.periodo_anio}`;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim();
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : 'N/A';

            const percepciones = (data.detalles || []).filter(d => d.operacion === 'sumar');
            const deducciones = (data.detalles || []).filter(d => d.operacion === 'restar');

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // --- 1. Header (Logo / Company / Title) ---
                let logoRendered = false;
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) {
                            doc.image(p, M, y, { fit: [60, 26] });
                            logoRendered = true;
                        }
                    } catch (e) { /* ignore */ }
                }

                const companyX = logoRendered ? M + 68 : M;
                const companyMaxW = logoRendered ? 270 : 330;

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(data.company_name?.toUpperCase() || 'EMPRESA', companyX, y, { width: companyMaxW, ellipsis: true });
                doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', companyX, y + 11);

                // Right header pill: Titulo & Periodo
                const rightPillW = 210;
                const rightPillX = M + W - rightPillW;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
                doc.text('RECIBO DE PLANILLA QUINCENAL', rightPillX, y, { width: rightPillW, align: 'right' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#4338ca');
                doc.text(`${quincenaLabel.toUpperCase()} QUINCENA • ${mesAnio.toUpperCase()}`, rightPillX, y + 11, { width: rightPillW, align: 'right' });

                y += 24;
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(M, y).lineTo(M + W, y).stroke();
                y += 4;

                // --- 2. Employee Info Card ---
                const cardH = 34;
                doc.rect(M, y, W, cardH).fill('#f8fafc').stroke('#e2e8f0');

                // Card Row 1
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('EMPLEADO:', M + 8, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName.substring(0, 32), M + 8, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('CARGO / DEPTO:', M + 190, y + 3.5);
                doc.fontSize(6.8).font('Helvetica').fillColor('#1e293b');
                const cargoDepto = `${data.cargo_nombre || 'GENERAL'} • ${data.departamento_nombre || 'GENERAL'}`;
                doc.text(cargoDepto.substring(0, 32), M + 190, y + 11.5, { width: 175, ellipsis: true });

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('DÍAS TRAB.:', M + 375, y + 3.5);
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(`${data.dias_trabajados || 0} DÍAS`, M + 375, y + 11.5);

                doc.fontSize(6).font('Helvetica-Bold').fillColor('#64748b');
                doc.text('SUELDO BASE:', M + 450, y + 3.5);
                doc.fontSize(7.2).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(`$ ${parseFloat(data.sueldo_base || 0).toFixed(2)}`, M + 450, y + 11.5);

                // Card Row 2 (Metadata badges line)
                doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                const metaLine = `CÓD: ${data.empleado_codigo || data.codigo || '—'}    |    DUI: ${data.num_dui || '—'}    |    NIT: ${data.num_nit || '—'}    |    INGRESO: ${fmt(data.fecha_ingreso)}`;
                doc.text(metaLine, M + 8, y + 23);

                y += cardH + 5;

                // --- 3. Two Columns: PERCEPCIONES & DEDUCCIONES ---
                const colW = 270;
                const colGutter = 16;
                const leftX = M;
                const rightX = M + colW + colGutter;
                const headerH = 12;
                const rowH = 9.5;

                // Table Column Headers
                doc.rect(leftX, y, colW, headerH).fill('#f1f5f9');
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text('PERCEPCIONES (INGRESOS)', leftX + 4, y + 3, { width: 180 });
                doc.text('VALOR', leftX + 190, y + 3, { width: 75, align: 'right' });

                doc.rect(rightX, y, colW, headerH).fill('#f1f5f9');
                doc.text('DEDUCCIONES Y RETENCIONES', rightX + 4, y + 3, { width: 180 });
                doc.text('VALOR', rightX + 190, y + 3, { width: 75, align: 'right' });

                y += headerH + 2;

                // Render Left Column (Percepciones)
                let percY = y;
                for (const p of percepciones) {
                    const val = parseFloat(p.valor_ingresado || 0);
                    doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                    doc.text(`${p.codigo} - ${p.descripcion}`, leftX + 4, percY, { width: 185, ellipsis: true });
                    doc.text(`$ ${val.toFixed(2)}`, leftX + 190, percY, { width: 75, align: 'right' });
                    percY += rowH;
                }

                // Render Right Column (Deducciones)
                let dedY = y;
                const isssPct = data.isss_porcentaje || 0;
                const afpPct = data.afp_porcentaje || 0;

                doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
                doc.text('RETENCIONES DE LEY:', rightX + 4, dedY, { width: 185 });
                dedY += rowH;

                doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                doc.text(`ISSS (${isssPct}%)`, rightX + 10, dedY, { width: 175 });
                doc.text(`$ ${parseFloat(data.descuento_isss || 0).toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text(`AFP (${afpPct}%)`, rightX + 10, dedY, { width: 175 });
                doc.text(`$ ${parseFloat(data.descuento_afp || 0).toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                doc.text('Impuesto sobre la Renta', rightX + 10, dedY, { width: 175 });
                doc.text(`$ ${parseFloat(data.descuento_renta || 0).toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                dedY += rowH;

                if (deducciones.length > 0) {
                    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#475569');
                    doc.text('OTRAS DEDUCCIONES:', rightX + 4, dedY, { width: 185 });
                    dedY += rowH;
                    for (const d of deducciones) {
                        const val = parseFloat(d.valor_ingresado || 0);
                        doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
                        doc.text(`${d.codigo} - ${d.descripcion}`, rightX + 10, dedY, { width: 175, ellipsis: true });
                        doc.text(`$ ${val.toFixed(2)}`, rightX + 190, dedY, { width: 75, align: 'right' });
                        dedY += rowH;
                    }
                }

                // Subtotales / Totales de columna
                const maxRowY = Math.max(percY, dedY) + 2;

                // Total Percepciones
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(leftX, maxRowY).lineTo(leftX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL PERCEPCIONES', leftX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${parseFloat(data.total_percepciones || 0).toFixed(2)}`, leftX + 190, maxRowY + 3, { width: 75, align: 'right' });

                // Total Deducciones
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(rightX, maxRowY).lineTo(rightX + colW, maxRowY).stroke();
                doc.font('Helvetica-Bold').fontSize(7).fillColor('#0f172a');
                doc.text('TOTAL DEDUCCIONES', rightX + 4, maxRowY + 3, { width: 180 });
                doc.text(`$ ${parseFloat(data.total_deducciones || 0).toFixed(2)}`, rightX + 190, maxRowY + 3, { width: 75, align: 'right' });

                y = maxRowY + 16;

                // --- 4. Líquido a Recibir ---
                const netH = 17;
                doc.rect(M, y, W, netH).fill('#eef2ff').stroke('#c7d2fe');
                doc.fontSize(7.8).font('Helvetica-Bold').fillColor('#3730a3');
                doc.text('LÍQUIDO A RECIBIR (NETO A PAGAR):', M + 8, y + 4.5);
                doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#1e1b4b');
                doc.text(`$ ${parseFloat(data.monto_recibir || 0).toFixed(2)}`, M + W - 140, y + 4, { width: 130, align: 'right' });

                y += netH + 3;
                doc.fontSize(6.2).font('Helvetica-Oblique').fillColor('#475569');
                doc.text(`Son: ${data.monto_letras || ''}`, M + 4, y, { width: W - 8 });

                // --- 5. Signatures (Generous spacing so signatures NEVER overlap with Monto / Letras) ---
                y += 36;
                const sigLineY = y;
                const sigW = 200;

                // Empleado
                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 15, sigLineY).lineTo(M + 15 + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text('RECIBÍ CONFORME', M + 15, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(empName, M + 15, sigLineY + 10.5, { width: sigW, align: 'center' });
                doc.fontSize(5.8).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${data.num_dui || 'N/A'}`, M + 15, sigLineY + 18.5, { width: sigW, align: 'center' });

                // Empresa / RRHH
                const rightSigX = M + W - sigW - 15;

                // Firma y Sello images placed cleanly above the line
                if (firmaPath) {
                    try {
                        const fFile = firmaPath.split('/').pop();
                        const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                        if (fs.existsSync(fAbs)) {
                            doc.image(fAbs, rightSigX + 15, sigLineY - 30, { fit: [90, 28] });
                        }
                    } catch (e) {}
                }
                if (selloPath) {
                    try {
                        const sFile = selloPath.split('/').pop();
                        const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                        if (fs.existsSync(sAbs)) {
                            doc.image(sAbs, rightSigX + 115, sigLineY - 30, { fit: [75, 28] });
                        }
                    } catch (e) {}
                }

                doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(rightSigX, sigLineY).lineTo(rightSigX + sigW, sigLineY).stroke();
                doc.fontSize(6.2).font('Helvetica-Bold').fillColor('#334155');
                doc.text(responsable.toUpperCase(), rightSigX, sigLineY + 2.5, { width: sigW, align: 'center' });
                doc.fontSize(6.2).font('Helvetica').fillColor('#64748b');
                doc.text('RECURSOS HUMANOS', rightSigX, sigLineY + 10.5, { width: sigW, align: 'center' });

                // Copy tag
                doc.fontSize(5.8).font('Helvetica-Bold').fillColor('#94a3b8');
                doc.text(`[ ${label} ]`, M, sigLineY + 22, { width: W, align: 'center' });

                return y;
            };

            // Top copy - Empleado
            drawCopy(22, 'COPIA EMPLEADO');

            // Page middle divider (clean dashed or light line)
            const PAGE_MID = 396;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).dash(4, { space: 3 })
               .moveTo(28, PAGE_MID).lineTo(28 + 556, PAGE_MID).stroke().undash();

            // Bottom copy - Empresa
            drawCopy(PAGE_MID + 14, 'ORIGINAL EMPRESA');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
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
    generateTransferPDF, 
      generateStatementPDF, 
      generateAgingPDF,
      generateProviderStatementPDF,
      generateTrupputStatementPDF,
    generateProviderAgingPDF,
    generateStockReportPDF,
    generateMovementsReportPDF,
    generateCustomerBalancesPDF,
    generateProviderBalancesPDF,
    generatePaymentReceiptPDF,
    generateDailySalesReportPDF,
    generateSalesByCustomerPDF,
    generateSalesByCategoryPDF,
    generateSalesByPOSPDF,
    generateStoreProfitabilityPDF,
    generatePendingDocumentsDetailedPDF,
    generateProviderPendingDocumentsDetailedPDF,
    generateRTEE,
    generateInvalidationPDF,
    generateVacacionPDF,
    generateLiquidacionPDF,
    generateFiniquitoPDF,
    generateAcuerdoPagoPDF,
    generateHonorarioPDF,
    generateAguinaldoPDF,
    generateAguinaldoRecibosPDF,
    generateCloseoutDetailPDF,
    generateFuelInventoryPDF,
    generateGalonajeVendidoPDF,
    generateFuelSalesSummaryPDF,
    generatePlanillaPDF,
    generatePlanillaReciboPDF,
    generateArqueosReportPDF
};
