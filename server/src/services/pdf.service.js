const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const reportPdfHelper = require('../utils/reportPdfHelper');

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
            const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 40;
            const colVal = 530;
            const pageW = 532;
            const BOTTOM = 740;

            // --- Logo + Header (y=30-68) ---
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
            doc.fontSize(12).font('Helvetica-Bold').text('RECIBO', M, 28, { align: 'right' });
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#4f46e5')
                .text(`POR $ ${parseFloat(data.total_recibir).toFixed(2)}`, M, 42, { align: 'right' });
            doc.fillColor('black');

            // --- Body recibo (y=76-138) ---
            doc.rect(M, 76, pageW, 62).stroke('#e5e7eb');
            doc.fontSize(9).font('Helvetica')
                .text(`Yo, ${data.empleado_nombres.toUpperCase()} ${data.empleado_apellidos.toUpperCase()}. Recibí de ${data.company_name.toUpperCase()}: la cantidad ${data.monto_letras}, en concepto de VACACION ANUAL.`, M + 12, 86, { width: pageW - 24 });
            doc.text('Según el siguiente detalle.', M + 12, 122);

            // --- Employee Details (y=148-180) ---
            doc.fontSize(9).font('Helvetica');
            doc.text(`Cargo: ${data.cargo_nombre || ''}`, M, 148);
            doc.text(`Sueldo Mensual: $ ${parseFloat(data.sueldo_base).toFixed(2)}`, 250, 148);
            doc.text(`Fecha Ingreso: ${data.fecha_ingreso ? new Date(data.fecha_ingreso).toLocaleDateString('es-SV') : ''}`, M, 163);
            doc.text('Política de goce de vacación: Anual', 250, 163);

            // --- Period (y=190-220) ---
            const fpInicial = data.fecha_inicial ? new Date(data.fecha_inicial).toLocaleDateString('es-SV') : '';
            const fpFinal = data.fecha_final ? new Date(data.fecha_final).toLocaleDateString('es-SV') : '';
            doc.fontSize(10).font('Helvetica-Bold').text('PERIODO DE PAGO', M, 190);
            doc.fontSize(9).font('Helvetica').text(`${fpInicial} - ${fpFinal}`, M, 205);
            doc.fontSize(7).font('Helvetica-Oblique').text('S/G Art. 58 C/Trabajo.', M, 215);

            // --- Earnings Table (y=232+) ---
            const tblY = 232;
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('CONCEPTO', M, tblY);
            doc.text('VALOR', colVal, tblY, { align: 'right' });
            doc.moveTo(M, tblY + 14).lineTo(M + pageW, tblY + 14).stroke('#e5e7eb');

            const sueldoQ = parseFloat(data.sueldo_base) / 2;
            const vac = parseFloat(data.vacaciones_monto);
            const rh = 16;

            doc.font('Helvetica').fontSize(9);
            let ry = tblY + 20;
            doc.text('SUELDO QUINCENAL', M, ry);
            doc.text(`$${sueldoQ.toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text('VACACIONES', M, ry);
            doc.text(`$${vac.toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold');
            doc.text('SUB TOTAL...', M, ry);
            doc.text(`$${parseFloat(data.total_devengado).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += 18;

            // --- Deductions ---
            doc.font('Helvetica').fontSize(9);
            doc.text('MENOS:', M, ry);
            ry += rh;
            doc.text(`ISSS...${data.isss_porcentaje || 0} %`, M, ry);
            doc.text(`$${parseFloat(data.descuento_isss).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text(`AFP...${data.afp_porcentaje || 0} %`, M, ry);
            doc.text(`$${parseFloat(data.descuento_afp).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text('RENTA', M, ry);
            doc.text(`$${parseFloat(data.descuento_renta).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold');
            doc.text('SUB TOTAL...', M, ry);
            doc.text(`$${parseFloat(data.total_deducciones).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += 20;

            // --- Total (ry) ---
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('TOTAL A RECIBIR...', M, ry);
            doc.fillColor('#4f46e5')
                .text(`$${parseFloat(data.total_recibir).toFixed(2)}`, colVal, ry, { align: 'right' });
            doc.fillColor('black');

            // --- Legal text ---
            const legalY = ry + 24;
            doc.fontSize(8).font('Helvetica-Oblique')
                .text('DINERO QUE RECIBO A MI ENTERA SATISFACCION Y POR LO TANTO, LIBERO A LA EMPRESA DE TODA RESPONSABILIDAD LEGAL Y LABORAL PARA CON MI PERSONA.', M, legalY, { width: pageW, align: 'justify' });

            // --- Signature at bottom ---
            const today = new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.fontSize(9).font('Helvetica').text(`San Salvador, ${today}`, M, legalY + 24);

            const firmY = BOTTOM - 80;
            doc.moveTo(100, firmY).lineTo(270, firmY).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Recibí Conforme', 125, firmY + 4, { align: 'center', width: 120 });
            doc.fontSize(9).font('Helvetica-Bold')
                .text(`SR(A). ${data.empleado_nombres.toUpperCase()} ${data.empleado_apellidos.toUpperCase()}`, M, firmY + 22);
            doc.fontSize(8).font('Helvetica').text('FIRMA', M, firmY + 36);
            let extraY = firmY + 50;
            if (data.num_dui) { doc.text(`DUI: ${data.num_dui}`, M, extraY); extraY += 12; }
            if (data.num_nit) { doc.text(`NIT: ${data.num_nit}`, M, extraY); }

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automáticamente por el Sistema SaaS.', M, BOTTOM, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateLiquidacionPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 40;
            const colVal = 530;
            const pageW = 532;
            const BOTTOM = 740;
            const rh = 15;

            // --- Logo + Header ---
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
            doc.fontSize(12).font('Helvetica-Bold').text('RECIBO', M, 28, { align: 'right' });
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#4f46e5')
                .text(`POR $ ${parseFloat(data.monto_recibir).toFixed(2)}`, M, 42, { align: 'right' });
            doc.fillColor('black');

            // --- Body recibo ---
            doc.rect(M, 76, pageW, 62).stroke('#e5e7eb');
            doc.fontSize(9).font('Helvetica')
                .text(`Yo, ${data.empleado_nombres.toUpperCase()} ${data.empleado_apellidos.toUpperCase()}. Recibí de ${data.company_name.toUpperCase()}: la cantidad ${data.monto_letras}, en concepto de LIQUIDACION LABORAL.`, M + 12, 86, { width: pageW - 24 });
            doc.text('Segun el siguiente detalle.', M + 12, 122);

            // --- Employee Details ---
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '';
            doc.fontSize(9).font('Helvetica');
            doc.text(`Cargo: ${data.cargo_nombre || ''}`, M, 148);
            doc.text(`Sueldo Mensual: $ ${parseFloat(data.sueldo_base).toFixed(2)}`, 250, 148);
            doc.text(`Fecha Ingreso: ${fmt(data.fecha_ingreso)}`, M, 163);
            doc.text('Tipo: Liquidacion Laboral', 250, 163);

            // --- Periods ---
            let ry = 185;
            doc.fontSize(10).font('Helvetica-Bold').text('PERIODOS', M, ry);
            ry += 14;
            doc.fontSize(8).font('Helvetica');
            doc.text(`Indemnizacion: ${fmt(data.periodo_indemnizacion_desde)} - ${fmt(data.periodo_indemnizacion_hasta)}  (${data.dias_indemnizacion || 0} dias)`, M, ry);
            ry += 12;
            doc.text(`Vacaciones: ${fmt(data.periodo_vacaciones_desde)} - ${fmt(data.periodo_vacaciones_hasta)}  (${data.dias_vacaciones || 0} dias)`, M, ry);
            ry += 12;
            doc.text(`Aguinaldo: ${fmt(data.periodo_aguinaldo_desde)} - ${fmt(data.periodo_aguinaldo_hasta)}  (${data.dias_aguinaldo || 0} dias)`, M, ry);
            ry += 12;
            if (data.pago_ultimos_dias > 0) {
                doc.text(`Ultimos Dias Laborados: ${fmt(data.ultimos_dias_laborados)}  (${data.dias_ultimos || 0} dias)`, M, ry);
                ry += 12;
            }
            ry += 4;

            // --- Earnings Table ---
            const tblY = ry;
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('CONCEPTO', M, tblY);
            doc.text('VALOR', colVal, tblY, { align: 'right' });
            doc.moveTo(M, tblY + 14).lineTo(M + pageW, tblY + 14).stroke('#e5e7eb');

            doc.font('Helvetica').fontSize(9);
            ry = tblY + 20;
            doc.text('INDEMNIZACION...', M, ry);
            doc.text(`$${parseFloat(data.total_indemnizacion || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text('VACACIONES...', M, ry);
            doc.text(`$${parseFloat(data.total_vacaciones || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text('AGUINALDO...', M, ry);
            doc.text(`$${parseFloat(data.total_aguinaldo || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            if (parseFloat(data.pago_ultimos_dias || 0) > 0) {
                doc.text('ULTIMOS DIAS LABORADOS...', M, ry);
                doc.text(`$${parseFloat(data.pago_ultimos_dias || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
                ry += rh;
            }
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold');
            doc.text('SUB TOTAL...', M, ry);
            doc.text(`$${parseFloat(data.total_devengado).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += 18;

            // --- Deductions ---
            doc.font('Helvetica').fontSize(9);
            doc.text('MENOS:', M, ry);
            ry += rh;
            doc.text(`ISSS...${data.isss_porcentaje || 0} %`, M, ry);
            doc.text(`$${parseFloat(data.descuento_isss || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text(`AFP...${data.afp_porcentaje || 0} %`, M, ry);
            doc.text(`$${parseFloat(data.descuento_afp || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text('RENTA...', M, ry);
            doc.text(`$${parseFloat(data.descuento_renta || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            if (parseFloat(data.otros_descuentos || 0) > 0) {
                doc.text('OTROS DESCUENTOS...', M, ry);
                doc.text(`$${parseFloat(data.otros_descuentos || 0).toFixed(2)}`, colVal, ry, { align: 'right' });
                ry += rh;
            }
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold');
            doc.text('SUB TOTAL...', M, ry);
            doc.text(`$${parseFloat(data.total_deducciones).toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += 20;

            // --- Total ---
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('TOTAL A RECIBIR', M, ry, { continued: true, width: 250 });
            doc.fillColor('#4f46e5')
                .text(` $ ${parseFloat(data.monto_recibir).toFixed(2)}`, { align: 'right' });
            doc.fillColor('black');

            // --- Cuotas info ---
            if (data.pago_cuotas) {
                ry += 24;
                doc.fontSize(9).font('Helvetica');
                doc.text(`Pago en ${data.cuotas} cuotas de $${parseFloat(data.pago_por_cuota || 0).toFixed(2)} cada una.`, M, ry);
            }

            // --- Legal text ---
            const legalY = ry + 28;
            doc.fontSize(8).font('Helvetica-Oblique')
                .text('DINERO QUE RECIBO A MI ENTERA SATISFACCION Y POR LO TANTO, LIBERO A LA EMPRESA DE TODA RESPONSABILIDAD LEGAL Y LABORAL PARA CON MI PERSONA.', M, legalY, { width: pageW, align: 'justify' });

            // --- Signature ---
            const today = new Date().toLocaleDateString('es-SV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            doc.fontSize(9).font('Helvetica').text(`San Salvador, ${today}`, M, legalY + 24);

            const firmY = BOTTOM - 80;
            doc.moveTo(100, firmY).lineTo(270, firmY).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text('Recibí Conforme', 125, firmY + 4, { align: 'center', width: 120 });
            doc.fontSize(9).font('Helvetica-Bold')
                .text(`SR(A). ${data.empleado_nombres.toUpperCase()} ${data.empleado_apellidos.toUpperCase()}`, M, firmY + 22);
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

const generateFiniquitoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 50;
            const pageW = 512;
            const BOTTOM_FOOTER = 730;
            const SIG_Y = BOTTOM_FOOTER - 55;

            // === PAGE 1: Employee Declaration ===

            // --- Logo + Header ---
            const logoPath = data.logo_url;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) doc.image(absolutePath, M, 38, { width: 65 });
                } catch (e) { /* ignore */ }
            }
            const hx = logoPath ? 125 : M;
            doc.y = 38;
            doc.fontSize(13).font('Helvetica-Bold').text(data.company_name?.toUpperCase() || '', hx, 40);
            doc.fontSize(9).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, 56);
            doc.fontSize(14).font('Helvetica-Bold').text('FINIQUITO LABORAL', M, 40, { align: 'right' });
            doc.moveTo(M, 68).lineTo(M + pageW, 68).stroke('#4f46e5');

            // --- Body (flow mode) ---
            doc.y = 82;
            doc.fontSize(10).font('Helvetica');

            doc.text(`Yo, ${data.empleado_nombres?.toUpperCase() || ''} ${data.empleado_apellidos?.toUpperCase() || ''}, mayor de edad, de nacionalidad salvadorena y del domicilio de la ciudad de ${data.ciudad || 'San Salvador'}, departamento de ${data.departamento || 'San Salvador'}, portador/a de mi Documento Unico de Identidad numero ${data.num_dui || '_______________'}; por medio del presente, actuando en mi caracter personal, MANIFIESTO:`, { width: pageW, align: 'justify' });
            doc.moveDown(0.5);

            doc.text(`I) Que he venido desempenando para y a las ordenes del senor(a) ${(data.company_name || '').toUpperCase()}, el cargo de ${(data.cargo_nombre || '').toUpperCase()}.`, { width: pageW, align: 'justify' });
            doc.moveDown(0.5);

            const motivo = data.motivo || 'RENUNCIA INMEDIATA';
            doc.text(`II) Que por medio del presente documento hago constar que mi relacion laboral culmina por: ${motivo}, a partir de este dia, doy por terminada la relacion laboral que me vinculo con el referido senor, haciendo constar que el mismo no me adeuda ninguna cantidad de dinero en concepto de salarios ordinarios o extraordinarios, vacaciones u aguinaldos, fueran completos o proporcionales, Indemnizaciones, dias de asueto o de descanso, por horas extraordinarias, ni en concepto de ninguna otra prestacion laboral, de seguridad social, ni previsional, por haber recibido a mi entera satisfaccion, el cien por ciento de todas mis prestaciones laborales e indemnizacion, declarando por ende, libre y solvente de toda responsabilidad al senor(a) ${(data.company_name || '').toUpperCase()}, y a las empresas vinculadas, de cualquier reclamo de indole laboral o de cualquier otra naturaleza por los servicios prestados hasta esta fecha, extendiendole en este acto al senor(a) ${(data.company_name || '').toUpperCase()}, el mas amplio y completo FINIQUITO, el cual hago extensivo a cualquier otra persona natural o juridica que pudiera haberse visto involucrada en el trabajo que desempene hasta esta fecha sea directa o indirectamente.`, { width: pageW, align: 'justify' });

            // --- Fecha y lugar ---
            doc.moveDown(1);
            const today = new Date();
            const city = data.ciudad || 'San Salvador';
            const dept = data.departamento || 'San Salvador';
            const fechaTexto = today.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
            doc.fontSize(10).font('Helvetica')
                .text(`En fe de lo cual firmo el presente documento en la ciudad de ${city}, departamento de ${dept}, a los ${fechaTexto}.`, { width: pageW, align: 'justify' });

            // --- Page 1 Signatures (fixed at bottom) ---
            doc.fontSize(8).font('Helvetica-Bold');
            doc.moveTo(M + 40, SIG_Y).lineTo(M + 220, SIG_Y).stroke();
            doc.text(`${data.empleado_nombres?.toUpperCase() || ''} ${data.empleado_apellidos?.toUpperCase() || ''}`, M + 40, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA EMPLEADO', M + 40, SIG_Y + 20, { width: 180, align: 'center' });

            const emp1X = M + pageW - 260;
            doc.moveTo(emp1X, SIG_Y).lineTo(emp1X + 180, SIG_Y).stroke();
            doc.fontSize(8).font('Helvetica-Bold')
                .text(`${(data.empleador_nombre || data.company_name || '').toUpperCase()}`, emp1X, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA EMPLEADOR', emp1X, SIG_Y + 20, { width: 180, align: 'center' });

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM_FOOTER, { align: 'center', width: pageW });
            doc.fillColor('black');

            // === PAGE 2: Notary Act ===
            doc.addPage();

            doc.fontSize(13).font('Helvetica-Bold').text(data.company_name?.toUpperCase() || '', M, 40);
            doc.fontSize(9).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', M, 56);
            doc.fontSize(14).font('Helvetica-Bold').text('ACTA NOTARIAL', M, 40, { align: 'right' });
            doc.moveTo(M, 68).lineTo(M + pageW, 68).stroke('#4f46e5');

            doc.y = 82;
            doc.fontSize(10).font('Helvetica');
            doc.text(`En la ciudad de ${city}, departamento de ${dept}, a las ${today.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })} horas del dia ${fechaTexto}. Ante mi, ${data.notario_nombre || '________________________'}, Notario, del domicilio de la ciudad de ${data.notario_domicilio || city}, departamento de ${data.notario_dept || dept}, comparece la/el senor(a) ${data.empleado_nombres?.toUpperCase() || ''} ${data.empleado_apellidos?.toUpperCase() || ''}, de ${data.edad || '___'} anos de edad, de nacionalidad salvadorena y del domicilio de ${city}, departamento de ${dept}, a quien no conozco, pero identifico por medio de su Documento Unico de Identidad numero ${data.num_dui || '_______________'}; quien por este medio, ME DICE: Que reconoce como suya la firma que antecede, asi como las declaraciones contenidas en el anterior documento que consta de un folio util, que ha sido suscrito en esta misma ciudad, este mismo dia, mes y ano, y que literalmente DICE:`, { width: pageW, align: 'justify' });

            doc.moveDown(0.5);
            doc.fontSize(9).font('Helvetica-Oblique');
            doc.text(`"${data.empleado_nombres?.toUpperCase() || ''} ${data.empleado_apellidos?.toUpperCase() || ''}, mayor de edad, de nacionalidad salvadorena y del domicilio de ${city}, departamento de ${dept}, portador/a de su Documento Unico de Identidad numero ${data.num_dui || '_______________'}; por medio del presente, actuando en su caracter personal, MANIFIESTO: I) Que ha venido desempenando para y a las ordenes del senor(a) ${(data.company_name || '').toUpperCase()}, el cargo de ${(data.cargo_nombre || '').toUpperCase()}. II) Que a partir de este dia, da por terminada la relacion laboral que le vinculo con el referido senor por: ${motivo}, haciendo constar que el mismo no le adeuda ninguna cantidad de dinero en concepto de salarios, vacaciones, aguinaldos, indemnizaciones, ni ninguna otra prestacion laboral, declarando por ende, libre y solvente de toda responsabilidad al senor(a) ${(data.company_name || '').toUpperCase()}, extendiendole el mas amplio y completo FINIQUITO."`, { width: pageW - 20, align: 'justify' });

            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Y yo, el suscrito Notario, DOY FE: Que la firma que aparece al calce del anterior documento es autentica, por haber sido puesta de su propio puno y letra y a mi presencia por el compareciente. Asi se expreso el compareciente, a quien explique los efectos legales de la presente acta notarial, que consta de un folio util; y leida que le fue por mi integramente, en un solo acto ininterrumpido, la ratifica por ser conforme a su voluntad y para constancia firma conmigo. DOY FE.`, { width: pageW, align: 'justify' });

            // --- Page 2 Signatures (fixed at bottom) ---
            doc.fontSize(8).font('Helvetica-Bold');
            doc.moveTo(M + 40, SIG_Y).lineTo(M + 220, SIG_Y).stroke();
            doc.text(`${data.empleado_nombres?.toUpperCase() || ''} ${data.empleado_apellidos?.toUpperCase() || ''}`, M + 40, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA EMPLEADO', M + 40, SIG_Y + 20, { width: 180, align: 'center' });

            const emp2X = M + pageW - 260;
            doc.moveTo(emp2X, SIG_Y).lineTo(emp2X + 180, SIG_Y).stroke();
            doc.fontSize(8).font('Helvetica-Bold')
                .text(`${(data.notario_nombre || 'NOTARIO').toUpperCase()}`, emp2X, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA NOTARIO', emp2X, SIG_Y + 20, { width: 180, align: 'center' });

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM_FOOTER, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAcuerdoPagoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 50;
            const pageW = 512;
            const BOTTOM_FOOTER = 730;
            const SIG_Y = BOTTOM_FOOTER - 55;

            const today = new Date();
            const fechaTexto = today.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
            const city = data.ciudad || 'San Salvador';
            const dept = data.departamento || 'San Salvador';

            // === PAGE 1: Payment Agreement ===

            // --- Logo + Header ---
            const logoPath = data.logo_url;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) doc.image(absolutePath, M, 38, { width: 65 });
                } catch (e) { /* ignore */ }
            }
            const hx = logoPath ? 125 : M;
            doc.fontSize(13).font('Helvetica-Bold').text(data.company_name?.toUpperCase() || '', hx, 40);
            doc.fontSize(9).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, 56);
            doc.fontSize(14).font('Helvetica-Bold').text('ACUERDO DE PAGO', M, 40, { align: 'right' });
            doc.moveTo(M, 68).lineTo(M + pageW, 68).stroke('#4f46e5');

            const empleado = `${data.empleado_nombres?.toUpperCase() || ''} ${data.empleado_apellidos?.toUpperCase() || ''}`;
            const empleador = (data.company_name || '').toUpperCase();
            const firmante = (data.empleador_nombre || data.company_name || '').toUpperCase();
            const monto = parseFloat(data.monto_recibir || 0).toFixed(2);
            const numCuotas = data.cuotas || 1;
            const pagoCuota = parseFloat(data.pago_por_cuota || 0).toFixed(2);
            const diaPago = today.getDate();
            const detCuotas = `${numCuotas} cuotas de $${pagoCuota} cada una, pagaderas los dias ${diaPago} de cada mes`;

            // --- Body ---
            doc.y = 82;
            doc.fontSize(10).font('Helvetica');

            doc.text(`En la ciudad de ${city}, departamento de ${dept}, a los ${fechaTexto}. Ante mi, ${data.notario_nombre || '________________________'}, Notario, del domicilio de ${data.notario_domicilio || city}, Departamento de ${data.notario_dept || dept}, comparece ${empleado}, mayor de edad, estudiante, de nacionalidad salvadorena, a quien no conozco, pero identifico por medio de su Documento Unico de Identidad numero ${data.num_dui || '_______________'}, quien en adelante sera denominado como "el empleado" quien actuando en su calidad personal, por este medio ME DICE:`, { width: pageW, align: 'justify' });

            doc.moveDown(0.5);
            doc.text(`I) ANTECEDENTE: Que el empleado ha desempenado el cargo de ${(data.cargo_nombre || '').toUpperCase()} para y a las ordenes del senor(a) ${empleador}, en adelante denominado como "El Empleador"`, { width: pageW, align: 'justify' });

            doc.moveDown(0.3);
            doc.text(`II) Que el empleado de comun acuerdo con la empleadora dan por terminada su relacion laboral en esta fecha;`, { width: pageW, align: 'justify' });

            doc.moveDown(0.3);
            doc.text(`III) En vista de lo anterior, el empleado manifiesta que junto con el empleador, ha revisado sus calculos en concepto de indemnizacion y prestaciones laborales correspondientes, habiendo llegado a un acuerdo de pago de $${monto}, menos los descuentos de ley correspondientes, en concepto de indemnizacion, vacacion proporcional, aguinaldo proporcional, y demas que conforme a derecho le corresponden por haber finalizado de comun acuerdo su relacion laboral en esta fecha.`, { width: pageW, align: 'justify' });

            doc.moveDown(0.3);
            doc.text(`IV) DECLARACION JURADA DE ACUERDO DE PAGO: Manifiesta el compareciente, que de comun acuerdo entre las partes, en esta misma fecha quedo establecido que del monto anteriormente detallado se recibira por el empleado en ${numCuotas} cuotas mensuales, fijas y sucesivas de $${pagoCuota}, ${detCuotas}. En caso de que la fecha sea un dia inhabil, sera pagadera el dia habil inmediato posterior;`, { width: pageW, align: 'justify' });

            doc.moveDown(0.3);
            doc.text(`V) Habiendose acordado lo anterior, manifiesta la compareciente que se dio por satisfecha por ser el anterior acuerdo conforme con su voluntad, por lo que exonera al Empleador de toda responsabilidad al haber llegado al presente acuerdo de pago de dicha prestacion, y al recibir la ultima cuota, se compromete a firmar el respectivo finiquito a favor del senor(a) ${empleador}.`, { width: pageW, align: 'justify' });

            doc.moveDown(0.5);
            doc.text(`Y yo, el suscrito Notario, DOY FE: a) De haber explicado a la compareciente los efectos legales de la presente acta notarial de acuerdo voluntario de pago y demas, de lo cual manifiestan estar enterados, y aceptan por ser conforme a sus voluntades; y b) Que la compareciente esta en su total capacidad de comparecer al otorgamiento del presente. Asi se expreso la compareciente, a quien explique los efectos legales de la presente acta notarial, que consta de un folio util; y leida que le fue por mi integramente, en un solo acto ininterrumpido, la ratifica por ser conforme a su voluntad y para constancia firma conmigo. DOY FE.`, { width: pageW, align: 'justify' });

            // --- Signatures (fixed at bottom) ---
            doc.fontSize(8).font('Helvetica-Bold');
            doc.moveTo(M + 40, SIG_Y).lineTo(M + 220, SIG_Y).stroke();
            doc.text(empleado, M + 40, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA EMPLEADO', M + 40, SIG_Y + 20, { width: 180, align: 'center' });

            const emp1X = M + pageW - 260;
            doc.moveTo(emp1X, SIG_Y).lineTo(emp1X + 180, SIG_Y).stroke();
            doc.fontSize(8).font('Helvetica-Bold').text(firmante, emp1X, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA EMPLEADOR', emp1X, SIG_Y + 20, { width: 180, align: 'center' });

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM_FOOTER, { align: 'center', width: pageW });
            doc.fillColor('black');

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateHonorarioPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 40;
            const colVal = 530;
            const pageW = 532;
            const BOTTOM_FOOTER = 740;
            const SIG_Y = BOTTOM_FOOTER - 55;

            // --- Logo + Header ---
            const logoPath = data.logo_url;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) doc.image(absolutePath, M, 28, { width: 75 });
                } catch (e) { /* ignore */ }
            }
            const hx = logoPath ? 125 : M;
            doc.fontSize(14).font('Helvetica-Bold').text(data.company_name?.toUpperCase() || '', hx, 28);
            doc.fontSize(9).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, 44);
            doc.fontSize(12).font('Helvetica-Bold').text('RECIBO', M, 28, { align: 'right' });
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#4f46e5')
                .text(`POR $ ${parseFloat(data.liquido_pagar).toFixed(2)}`, M, 42, { align: 'right' });
            doc.fillColor('black');

            // --- Body recibo ---
            doc.rect(M, 76, pageW, 62).stroke('#e5e7eb');
            doc.fontSize(9).font('Helvetica')
                .text(`Yo, ${(data.nombre || '').toUpperCase()}. Recibí de ${(data.company_name || '').toUpperCase()}: la cantidad ${data.monto_letras}, en concepto de HONORARIOS PROFESIONALES.`, M + 12, 86, { width: pageW - 24 });
            doc.text('Segun el siguiente detalle.', M + 12, 122);

            // --- Provider Details ---
            doc.fontSize(9).font('Helvetica');
            doc.text(`Nombre: ${data.nombre || ''}`, M, 148);
            doc.text(`No. Recibo: ${data.numero || ''}`, 250, 148);
            doc.text(`DUI: ${data.num_dui || '-'}`, M, 163);
            doc.text(`NIT: ${data.num_nit || '-'}`, 250, 163);
            doc.text(`Concepto: ${data.concepto || ''}`, M, 178);
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '';
            doc.text(`Fecha: ${fmt(data.fecha)}`, 250, 178);

            // --- Amounts Table ---
            let ry = 200;
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('CONCEPTO', M, ry);
            doc.text('VALOR', colVal, ry, { align: 'right' });
            doc.moveTo(M, ry + 14).lineTo(M + pageW, ry + 14).stroke('#e5e7eb');

            const monto = parseFloat(data.monto || 0);
            const isr = parseFloat(data.renta_isr || 0);
            const liquido = parseFloat(data.liquido_pagar || 0);
            const rh = 16;

            doc.font('Helvetica').fontSize(9);
            ry += 20;
            doc.text('HONORARIOS...', M, ry);
            doc.text(`$${monto.toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.text('ISR (10%)...', M, ry);
            doc.text(`$${isr.toFixed(2)}`, colVal, ry, { align: 'right' });
            ry += rh;
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
            ry += 5;
            doc.font('Helvetica-Bold');
            doc.text('LIQUIDO A PAGAR', M, ry);
            doc.fillColor('#4f46e5')
                .text(`$${liquido.toFixed(2)}`, colVal, ry, { align: 'right' });
            doc.fillColor('black');

            // --- Signatures ---
            doc.fontSize(8).font('Helvetica-Bold');
            doc.moveTo(M + 40, SIG_Y).lineTo(M + 220, SIG_Y).stroke();
            doc.text((data.nombre || '').toUpperCase(), M + 40, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('RECIBI CONFORME', M + 40, SIG_Y + 20, { width: 180, align: 'center' });

            const empX = M + pageW - 260;
            doc.moveTo(empX, SIG_Y).lineTo(empX + 180, SIG_Y).stroke();
            doc.fontSize(8).font('Helvetica-Bold')
                .text((data.company_name || '').toUpperCase(), empX, SIG_Y + 6, { width: 180, align: 'center' });
            doc.fontSize(7).font('Helvetica').text('FIRMA EMPRESA', empX, SIG_Y + 20, { width: 180, align: 'center' });

            doc.fontSize(7).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM_FOOTER, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAguinaldoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'LETTER', layout: 'landscape' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 30;
            const pageW = 732;
            const BOTTOM_FOOTER = 560;

            const fmtDate = (d) => {
                if (!d) return '';
                try {
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return String(d);
                    const dd = date.getUTCDate().toString().padStart(2, '0');
                    const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                    const yy = date.getUTCFullYear();
                    return `${dd}/${mm}/${yy}`;
                } catch (e) { return String(d); }
            };

            // --- Logo + Header ---
            const logoPath = data.logo_url;
            if (logoPath) {
                try {
                    const fileName = logoPath.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) doc.image(absolutePath, M, 25, { width: 55 });
                } catch (e) { /* ignore */ }
            }
            const hx = logoPath ? 95 : M;
            doc.fontSize(12).font('Helvetica-Bold').text(data.company_name?.toUpperCase() || '', hx, 25);
            doc.fontSize(8).font('Helvetica').text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, 40);
            doc.fontSize(13).font('Helvetica-Bold').text('PLANILLA DE AGUINALDOS', M, 25, { align: 'right' });
            doc.fontSize(9).font('Helvetica')
                .text(`${data.periodo_label || ''}  |  ${data.departamento_label || 'Todos'}`, M, 42, { align: 'right' });
            doc.moveTo(M, 58).lineTo(M + pageW, 58).stroke('#4f46e5');

            // --- Table columns ---
            const col = {
                codigo: M,
                nombre: M + 45,
                cargo: M + 240,
                ingreso: M + 370,
                base: M + 435,
                dias: M + 500,
                tabla: M + 530,
                aguinaldo: M + 560,
                excedente: M + 610,
                renta: M + 655,
                recibir: M + 690
            };

            const drawHeader = (y) => {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('Codigo', col.codigo, y);
                doc.text('Nombre', col.nombre, y);
                doc.text('Cargo', col.cargo, y);
                doc.text('F. Ingreso', col.ingreso, y);
                doc.text('F. Base', col.base, y);
                doc.text('Dias', col.dias, y, { align: 'right', width: 25 });
                doc.text('Tabla', col.tabla, y, { align: 'right', width: 25 });
                doc.text('Aguinaldo', col.aguinaldo, y, { align: 'right', width: 45 });
                doc.text('Exc.', col.excedente, y, { align: 'right', width: 45 });
                doc.text('Renta', col.renta, y, { align: 'right', width: 35 });
                doc.text('Recibir', col.recibir, y, { align: 'right', width: 45 });
                y += 11;
                doc.moveTo(M, y).lineTo(M + pageW, y).stroke('#e5e7eb');
                return y + 3;
            };

            const drawRow = (item, y) => {
                const ag = parseFloat(item.aguinaldo_calculado || 0);
                const re = parseFloat(item.renta || 0);
                const mr = parseFloat(item.monto_recibir || 0);
                doc.fontSize(7).font('Helvetica');
                doc.text(item.codigo || '', col.codigo, y);
                doc.text(`${item.nombres || ''} ${item.apellidos || ''}`, col.nombre, y, { width: col.cargo - col.nombre - 5 });
                doc.text(item.cargo_nombre || '', col.cargo, y, { width: col.ingreso - col.cargo - 5 });
                doc.text(fmtDate(item.fecha_ingreso), col.ingreso, y);
                doc.text(fmtDate(item.fecha_base), col.base, y);
                doc.text(String(item.dias_antiguedad || 0), col.dias, y, { align: 'right', width: 25 });
                doc.text(String(item.dias_segun_tabla || 0), col.tabla, y, { align: 'right', width: 25 });
                doc.text(`$${ag.toFixed(2)}`, col.aguinaldo, y, { align: 'right', width: 45 });
                doc.text(`$${parseFloat(item.excedente || 0).toFixed(2)}`, col.excedente, y, { align: 'right', width: 45 });
                doc.text(`$${re.toFixed(2)}`, col.renta, y, { align: 'right', width: 35 });
                doc.text(`$${mr.toFixed(2)}`, col.recibir, y, { align: 'right', width: 45 });
                return y + 11;
            };

            const items = data.items || [];

            // Group by department
            const grupos = new Map();
            for (const item of items) {
                const depto = item.departamento_nombre || 'Sin Depto.';
                if (!grupos.has(depto)) grupos.set(depto, []);
                grupos.get(depto).push(item);
            }

            let ry = 68;
            let totalAguinaldo = 0, totalRenta = 0, totalRecibir = 0;
            let grupoIndex = 0;

            for (const [depto, deptoItems] of grupos) {
                if (ry > BOTTOM_FOOTER - 80) { doc.addPage(); ry = 40; }

                // Department header (only if multiple groups)
                if (grupos.size > 1) {
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(depto.toUpperCase(), M, ry);
                    doc.fillColor('black');
                    ry += 14;
                }

                ry = drawHeader(ry);

                let subAguinaldo = 0, subRenta = 0, subRecibir = 0;

                for (const item of deptoItems) {
                    if (ry > BOTTOM_FOOTER - 40) { doc.addPage(); ry = 40; ry = drawHeader(ry); }
                    const ag = parseFloat(item.aguinaldo_calculado || 0);
                    const re = parseFloat(item.renta || 0);
                    const mr = parseFloat(item.monto_recibir || 0);
                    subAguinaldo += ag; subRenta += re; subRecibir += mr;
                    ry = drawRow(item, ry);
                }

                // Subtotals per department (only if multiple groups)
                if (grupos.size > 1) {
                    doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke('#e5e7eb');
                    ry += 3;
                    doc.fontSize(7).font('Helvetica-Bold');
                    doc.text(`Subtotal ${depto}`, col.nombre, ry);
                    doc.text(`$${subAguinaldo.toFixed(2)}`, col.aguinaldo, ry, { align: 'right', width: 45 });
                    doc.text(`$${subRenta.toFixed(2)}`, col.renta, ry, { align: 'right', width: 35 });
                    doc.text(`$${subRecibir.toFixed(2)}`, col.recibir, ry, { align: 'right', width: 45 });
                    ry += 14;
                }

                totalAguinaldo += subAguinaldo;
                totalRenta += subRenta;
                totalRecibir += subRecibir;
                grupoIndex++;
            }

            // Grand Totals
            if (ry > BOTTOM_FOOTER - 20) { doc.addPage(); ry = 40; }
            doc.moveTo(M, ry).lineTo(M + pageW, ry).stroke();
            ry += 4;
            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('TOTALES', col.nombre, ry);
            doc.text(`$${totalAguinaldo.toFixed(2)}`, col.aguinaldo, ry, { align: 'right', width: 45 });
            doc.text(`$${totalRenta.toFixed(2)}`, col.renta, ry, { align: 'right', width: 35 });
            doc.text(`$${totalRecibir.toFixed(2)}`, col.recibir, ry, { align: 'right', width: 45 });

            doc.fontSize(6).fillColor('grey')
                .text('Documento generado automaticamente por el Sistema SaaS.', M, BOTTOM_FOOTER, { align: 'center', width: pageW });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateAguinaldoRecibosPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const items = data.items || [];
            const año = data.año || new Date().getFullYear();
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';

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
                const depto = item.departamento_nombre || '';
                const cargo = item.cargo_nombre || '';
                const nombre = `${item.nombres || ''} ${item.apellidos || ''}`;
                const fmtDate = (d) => {
                    if (!d) return '';
                    try {
                        const date = new Date(d);
                        if (isNaN(date.getTime())) return String(d);
                        const dd = date.getUTCDate().toString().padStart(2, '0');
                        const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                        const yy = date.getUTCFullYear();
                        return `${dd}/${mm}/${yy}`;
                    } catch (e) { return String(d); }
                };

                const drawCopy = (yStart, label) => {
                    const M = 30;
                    const W = 552;
                    let y = yStart;

                    // Company name
                    doc.fontSize(9).font('Helvetica-Bold');
                    doc.text(data.company_name?.toUpperCase() || '', M, y, { width: W, align: 'center' });
                    y += 12;

                    // Title
                    doc.fontSize(8).font('Helvetica-Bold');
                    doc.text('RECIBO DE LIQUIDACION DE AGUINALDO', M, y, { width: W, align: 'center' });
                    y += 11;
                    doc.moveTo(M, y).lineTo(M + W, y).stroke('#4f46e5');
                    y += 5;

                    const C1 = M + 220;
                    doc.fontSize(7).font('Helvetica');

                    // Row 1
                    doc.text('NOMBRE DEL EMPLEADO:', M, y);
                    doc.text('AGUINALDO A LIQUIDAR:', C1, y);
                    y += 9;
                    doc.font('Helvetica-Bold').text(nombre, M, y);
                    doc.text(String(año), C1, y);
                    y += 11;

                    // Row 2
                    doc.font('Helvetica');
                    doc.text('CARGO:', M, y);
                    doc.text('DEPARTAMENTO DE', C1, y);
                    y += 9;
                    doc.font('Helvetica-Bold').text(cargo, M, y);
                    doc.text(depto, C1, y);
                    y += 11;

                    // Row 3
                    doc.font('Helvetica');
                    doc.text('SUELDO MENSUAL:', M, y);
                    doc.text(`FECHA INGRESO: ${fmtDate(item.fecha_ingreso)}`, C1, y);
                    y += 9;
                    doc.font('Helvetica-Bold').text(`$ ${sueldo.toFixed(2)}`, M, y);
                    y += 11;

                    // Row 4
                    doc.font('Helvetica');
                    doc.text('SUELDO DIARIO:', M, y);
                    doc.text(`ANTIGUEDAD AÑOS: ${anios}`, M + 130, y);
                    doc.text(`DIAS PAGADOS: ${diasPagados}`, M + 240, y);
                    y += 9;
                    doc.font('Helvetica-Bold').text(`$ ${sueldoDiario.toFixed(2)}`, M, y);
                    y += 12;

                    // Row 5
                    doc.font('Helvetica');
                    doc.text(`ANTIGUEDAD DIAS: ${dias}`, M, y);
                    doc.text(`SEGUN ART. 198 COD. DE TRABAJO`, M + 140, y);
                    y += 12;

                    // Amounts box
                    const ax = M + 5;
                    const aw = W - 10;
                    doc.rect(ax, y, aw, 50).stroke('#e5e7eb');
                    let ay = y + 6;

                    doc.font('Helvetica').fontSize(7);
                    doc.text('AGUINALDO:', ax + 5, ay);
                    doc.font('Helvetica-Bold').text(`$ ${aguinaldo.toFixed(2)}`, ax + 5, ay, { align: 'right', width: aw - 10 });
                    ay += 12;

                    doc.font('Helvetica');
                    doc.text('MENOS RENTA:', ax + 5, ay);
                    doc.font('Helvetica-Bold').text(`$ ${renta.toFixed(2)}`, ax + 5, ay, { align: 'right', width: aw - 10 });
                    ay += 12;

                    doc.moveTo(ax + 5, ay).lineTo(ax + aw - 5, ay).stroke('#e5e7eb');
                    ay += 4;

                    doc.font('Helvetica');
                    doc.text('TOTAL A RECIBIR:', ax + 5, ay);
                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(`$ ${monto.toFixed(2)}`, ax + 5, ay, { align: 'right', width: aw - 10 });
                    doc.fillColor('black');

                    y += 60;

                    y += 60;

                    // Signatures
                    doc.fontSize(7).font('Helvetica');
                    const sigW = 200;
                    doc.moveTo(M + 20, y).lineTo(M + 20 + sigW, y).stroke('#e5e7eb');
                    doc.fontSize(6).font('Helvetica-Bold').text('RECIBI CONFORME', M + 20, y + 4, { width: sigW, align: 'center' });
                    doc.fontSize(7).font('Helvetica-Bold').text(nombre, M, y + 20, { width: sigW + 40, align: 'center' });

                    // Firma y sello (arriba de la linea)
                    if (firmaPath) {
                        try {
                            const fFile = firmaPath.split('/').pop();
                            const fAbs = path.join(__dirname, '..', '..', 'uploads', fFile);
                            if (fs.existsSync(fAbs)) doc.image(fAbs, M + W - sigW - 10, y - 50, { width: 90, height: 35 });
                        } catch (e) { /* ignore */ }
                    }
                    if (selloPath) {
                        try {
                            const sFile = selloPath.split('/').pop();
                            const sAbs = path.join(__dirname, '..', '..', 'uploads', sFile);
                            if (fs.existsSync(sAbs)) doc.image(sAbs, M + W - 120, y - 50, { width: 80, height: 40 });
                        } catch (e) { /* ignore */ }
                    }

                    doc.fontSize(7).font('Helvetica');
                    doc.moveTo(M + W - sigW - 20, y).lineTo(M + W - 20, y).stroke('#e5e7eb');
                    doc.fontSize(6).font('Helvetica-Bold').text(responsable.toUpperCase(), M + W - sigW - 20, y + 4, { width: sigW, align: 'center' });
                    doc.fontSize(7).font('Helvetica').text('RECURSOS HUMANOS', M + W - sigW - 20, y + 20, { width: sigW, align: 'center' });

                    y += 45;

                    // Copy label
                    doc.fontSize(7).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(label, M, y, { width: W, align: 'center' });
                    doc.fillColor('black');

                    return y;
                };

                // Top copy - Copia Empleado
                drawCopy(30, 'COPIA EMPLEADO');

                // Divider line at middle of page
                const PAGE_MID = 396;
                doc.moveTo(30, PAGE_MID - 4).lineTo(30 + 552, PAGE_MID - 4).stroke('#e5e7eb');

                // Bottom copy - Original Empresa, starts at middle
                drawCopy(PAGE_MID, 'ORIGINAL EMPRESA');
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
