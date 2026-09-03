const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

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
const generateStatementPDF = (data, isProvider = false) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            doc.fontSize(18).text(data.company_name || 'EMPRESA', { align: 'left' });
            doc.fontSize(10).text(data.branch_name || 'SUCURSAL', { align: 'left' });
            doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString('es-SV')}`, { align: 'right' });
            doc.moveDown();

            const title = data.title || (isProvider ? 'ESTADO DE CUENTA DE PROVEEDOR' : 'ESTADO DE CUENTA DE CLIENTE');
            doc.fontSize(16).text(title, { align: 'center', underline: true });
            doc.moveDown();

            doc.fontSize(12).font('Helvetica-Bold').text(isProvider ? 'INFORMACIÓN DEL PROVEEDOR' : 'INFORMACIÓN DEL CLIENTE');
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${isProvider ? (data.provider_name || 'N/A') : (data.customer_name || 'N/A')}`);
            doc.text(`Correo: ${isProvider ? (data.provider_email || 'N/A') : (data.customer_email || 'N/A')}`);
            doc.moveDown();

            const summaryY = doc.y;
            doc.rect(50, summaryY, 500, 40).fill('#f3f4f6').stroke('#e5e7eb');
            doc.fill('#4f46e5').fontSize(12).font('Helvetica-Bold').text(data.balance_label || 'SALDO TOTAL PENDIENTE:', 70, summaryY + 12);
            doc.fontSize(14).text(`$${parseFloat(data.total_balance || 0).toFixed(2)}`, 350, summaryY + 12, { align: 'right', width: 150 });
            doc.fill('black');
            doc.moveDown(3);

            const tableTop = doc.y;
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Fecha', 50, tableTop);
            doc.text('Documento', 130, tableTop);
            doc.text('Concepto', 250, tableTop);
            doc.text('Cargo (+)', 340, tableTop, { align: 'right', width: 60 });
            doc.text('Abono (-)', 410, tableTop, { align: 'right', width: 60 });
            doc.text('Saldo', 490, tableTop, { align: 'right', width: 60 });
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown(0.5);

            doc.font('Helvetica');
            (data.movements || []).forEach(m => {
                const y = doc.y;
                if (y > 700) doc.addPage();
                
                const cargo = parseFloat(m.cargo || 0);
                const abono = parseFloat(m.abono || 0);
                const balance = parseFloat(m.balance || 0);

                // Todas las celdas de la fila en la MISMA línea base (evita filas diagonales)
                const rowY = doc.y;
                doc.fontSize(9);
                doc.text(fmtDateDDMMYYYY(m.fecha), 50, rowY, { width: 70 });
                const docText = `${m.tipo || ''} ${m.numero || ''}`.trim() || '—';
                doc.text(docText, 125, rowY, { width: 120 });
                doc.text(String(m.concepto || '—'), 250, rowY, { width: 90 });
                doc.text(cargo > 0 ? `$${cargo.toFixed(2)}` : '-', 340, rowY, { align: 'right', width: 60 });
                doc.text(abono > 0 ? `$${abono.toFixed(2)}` : '-', 410, rowY, { align: 'right', width: 60 });
                doc.text(`$${balance.toFixed(2)}`, 490, rowY, { align: 'right', width: 60 });
                doc.moveDown(1.5);
            });

            doc.moveDown(2);
            doc.fontSize(8).text('Este documento es un resumen informativo.', { align: 'center', color: 'grey' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateProviderStatementPDF = (data) => generateStatementPDF(data, true);

/**
 * Genera el PDF del estado de cuenta Trupput (prepago por galonaje).
 * Cargos: recargas de galones (gas_station_trupput).
 * Abonos: despachos de galones en cierres (gas_station_closeout_trupput_despachos).
 * Cada movimiento incluye galones y monto.
 */
const generateTrupputStatementPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            doc.fontSize(18).text(data.company_name || 'EMPRESA', { align: 'left' });
            doc.fontSize(10).text(data.branch_name || 'SUCURSAL', { align: 'left' });
            doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString('es-SV')}`, { align: 'right' });
            doc.moveDown();

            doc.fontSize(16).text('ESTADO DE CUENTA TRUPPUT (PREPAGO POR GALONAJE)', { align: 'center', underline: true });
            doc.moveDown();

            doc.fontSize(12).font('Helvetica-Bold').text('INFORMACIÓN DEL CLIENTE');
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${data.customer_name || 'N/A'}`);
            doc.text(`Correo: ${data.customer_email || 'N/A'}`);
            doc.moveDown();

            const summaryY = doc.y;
            doc.rect(50, summaryY, 500, 40).fill('#f3f4f6').stroke('#e5e7eb');
            doc.fill('#4f46e5').fontSize(12).font('Helvetica-Bold').text('SALDO DISPONIBLE EN GALONES:', 70, summaryY + 12);
            doc.fontSize(14).text(`${parseFloat(data.total_balance_galones || 0).toFixed(4)} gal.`, 350, summaryY + 12, { align: 'right', width: 150 });
            doc.fill('black');
            doc.moveDown(3);

            const tableTop = doc.y;
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Fecha', 50, tableTop);
            doc.text('Documento', 130, tableTop);
            doc.text('Concepto', 235, tableTop);
            doc.text('Galones', 300, tableTop, { align: 'right', width: 50 });
            doc.text('Gal+', 360, tableTop, { align: 'right', width: 45 });
            doc.text('Gal-', 415, tableTop, { align: 'right', width: 45 });
            doc.text('Saldo Gal', 470, tableTop, { align: 'right', width: 60 });
            doc.moveDown(0.5);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
            doc.moveDown(0.5);

            doc.font('Helvetica');
            (data.movements || []).forEach(m => {
                const rowY = doc.y;
                if (rowY > 700) doc.addPage();

                const cargoGal = parseFloat(m.galones_cargo || 0);
                const abonoGal = parseFloat(m.galones_abono || 0);
                const balanceGal = parseFloat(m.balance_galones || 0);
                const galones = parseFloat(m.galones || 0);

                doc.fontSize(9);
                doc.text(fmtDateDDMMYYYY(m.fecha), 50, rowY, { width: 70 });
                const docText = `${m.tipo || ''} ${m.numero || ''}`.trim() || '—';
                doc.text(docText, 125, rowY, { width: 105 });
                doc.text(String(m.concepto || '—'), 235, rowY, { width: 65 });
                doc.text(galones > 0 ? `${galones.toFixed(4)}` : '-', 300, rowY, { align: 'right', width: 50 });
                doc.text(cargoGal > 0 ? `${cargoGal.toFixed(4)}` : '-', 360, rowY, { align: 'right', width: 45 });
                doc.text(abonoGal > 0 ? `${abonoGal.toFixed(4)}` : '-', 415, rowY, { align: 'right', width: 45 });
                doc.text(`${balanceGal.toFixed(4)}`, 470, rowY, { align: 'right', width: 60 });
                doc.moveDown(1.5);
            });

            doc.moveDown(2);
            doc.fontSize(10).font('Helvetica-Bold').text('Resumen de montos', { align: 'left' });
            doc.font('Helvetica');
            doc.fontSize(9).text(`Total recargado: $${parseFloat(data.total_recargado || 0).toFixed(2)}`);
            doc.fontSize(9).text(`Total despachado: $${parseFloat(data.total_despachado || 0).toFixed(2)}`);

            doc.moveDown(2);
            doc.fontSize(8).text('Este documento es un resumen informativo.', { align: 'center', color: 'grey' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

/**
 * Generates a PDF buffer for a customer/provider aging report
 */
const generateAgingPDF = (data, isProvider = false) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            doc.fontSize(16).text(data.company_name, { align: 'left' });
            doc.fontSize(9).text(isProvider ? (data.provider_name || 'N/A') : (data.customer_name || 'N/A'), { align: 'left' });
            doc.fontSize(9).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            const title = isProvider ? 'ANTIGÜEDAD DE SALDOS (PROVEEDORES)' : 'ANTIGÜEDAD DE SALDOS (CLIENTES)';
            doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center', underline: true });
            doc.moveDown();

            const tableTop = doc.y;
            const colWidths = { fecha: 60, doc: 80, tipo: 80, b1: 70, b2: 70, b3: 70, b4: 70, b5: 70, b6: 70 };
            const startX = 30;

            doc.fontSize(8).font('Helvetica-Bold');
            doc.text('Fecha', startX, tableTop);
            doc.text('Documento', startX + colWidths.fecha, tableTop);
            doc.text('Tipo', startX + colWidths.fecha + colWidths.doc, tableTop);
            doc.text('0-30 Días', startX + 220, tableTop, { align: 'right', width: colWidths.b1 });
            doc.text('31-60 Días', startX + 290, tableTop, { align: 'right', width: colWidths.b2 });
            doc.text('61-90 Días', startX + 360, tableTop, { align: 'right', width: colWidths.b3 });
            doc.text('91-180 Días', startX + 430, tableTop, { align: 'right', width: colWidths.b4 });
            doc.text('181-365 Días', startX + 500, tableTop, { align: 'right', width: colWidths.b5 });
            doc.text('+365 Días', startX + 570, tableTop, { align: 'right', width: colWidths.b6 });
            
            doc.moveDown(0.5);
            doc.moveTo(startX, doc.y).lineTo(startX + 740, doc.y).stroke();
            doc.moveDown(0.5);

            doc.font('Helvetica');
            data.documents.forEach(docRow => {
                const y = doc.y;
                if (y > 500) doc.addPage();

                // Todas las celdas de la fila en la MISMA línea base
                const rowY = doc.y;
                doc.fontSize(8);
                doc.text(fmtDateDDMMYYYY(docRow.fecha), startX, rowY, { width: colWidths.fecha });
                doc.text(docRow.documento, startX + colWidths.fecha, rowY, { width: colWidths.doc });
                doc.text(docRow.tipo, startX + colWidths.fecha + colWidths.doc, rowY, { width: colWidths.tipo });
                
                doc.text(docRow.d0_30 > 0 ? `$${parseFloat(docRow.d0_30).toFixed(2)}` : '-', startX + 220, rowY, { align: 'right', width: colWidths.b1 });
                doc.text(docRow.d31_60 > 0 ? `$${parseFloat(docRow.d31_60).toFixed(2)}` : '-', startX + 290, rowY, { align: 'right', width: colWidths.b2 });
                doc.text(docRow.d61_90 > 0 ? `$${parseFloat(docRow.d61_90).toFixed(2)}` : '-', startX + 360, rowY, { align: 'right', width: colWidths.b3 });
                doc.text(docRow.d91_180 > 0 ? `$${parseFloat(docRow.d91_180).toFixed(2)}` : '-', startX + 430, rowY, { align: 'right', width: colWidths.b4 });
                doc.text(docRow.d181_365 > 0 ? `$${parseFloat(docRow.d181_365).toFixed(2)}` : '-', startX + 500, rowY, { align: 'right', width: colWidths.b5 });
                doc.text(docRow.d365_plus > 0 ? `$${parseFloat(docRow.d365_plus).toFixed(2)}` : '-', startX + 570, rowY, { align: 'right', width: colWidths.b6 });
                doc.moveDown(1.5);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + 740, doc.y).stroke();
            doc.moveDown(2);

            doc.fontSize(12).font('Helvetica-Bold').text(`SALDO TOTAL PENDIENTE: $${parseFloat(data.total_balance).toFixed(2)}`, { align: 'right' });
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateProviderAgingPDF = (data) => generateAgingPDF(data, true);

/**
 * Generates a PDF buffer for a stock report
 */
const generateStockReportPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name, { align: 'left' });
            doc.fontSize(10).text(`Sucursal: ${data.branch_name}${data.as_of ? `   |   Al: ${data.as_of}` : ''}`);
            doc.moveDown();

            doc.fontSize(14).text('REPORTE DE STOCK DE INVENTARIO', { align: 'center', underline: true });
            doc.moveDown();

            const startX = 30;
            const tableTop = doc.y;
            const colWidths = { codigo: 80, producto: 220, categoria: 100, stock: 60, costo: 70, precio: 70, total: 80 };

            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('Código', startX, tableTop);
            doc.text('Producto', startX + 80, tableTop);
            doc.text('Categoría', startX + 300, tableTop);
            doc.text('Stock', startX + 400, tableTop, { align: 'right', width: 60 });
            doc.text('Costo', startX + 460, tableTop, { align: 'right', width: 70 });
            doc.text('Precio', startX + 530, tableTop, { align: 'right', width: 70 });
            doc.text('V. Total', startX + 600, tableTop, { align: 'right', width: 80 });

            doc.moveDown(0.5);
            doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
            doc.moveDown(0.5);

            doc.font('Helvetica').fontSize(8);
            let grandTotalCost = 0;
            let grandTotalItems = 0;

            const drawTableHeader = () => {
                const hY = doc.y;
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('Código', startX, hY);
                doc.text('Producto', startX + 80, hY);
                doc.text('Categoría', startX + 300, hY);
                doc.text('Stock', startX + 400, hY, { align: 'right', width: 60 });
                doc.text('Costo', startX + 460, hY, { align: 'right', width: 70 });
                doc.text('Precio', startX + 530, hY, { align: 'right', width: 70 });
                doc.text('V. Total', startX + 600, hY, { align: 'right', width: 80 });
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(8);
            };

            data.products.forEach((p) => {
                // Check page break BEFORE capturing y
                if (doc.y > 500) {
                    doc.addPage();
                    drawTableHeader();
                }

                // Capture y AFTER possible page break
                const y = doc.y;

                const stock = parseFloat(p.stock || 0);
                const costo = parseFloat(p.costo || 0);
                const precio = parseFloat(p.precio_venta || 0);
                const valorTotal = stock * costo;
                grandTotalCost += valorTotal;
                grandTotalItems += stock;

                doc.text(p.codigo || 'N/A', startX, y);
                doc.text(p.nombre, startX + 80, y, { width: 210 });
                doc.text(p.categoria || '-', startX + 300, y);
                doc.text(stock.toFixed(2), startX + 400, y, { align: 'right', width: 60 });
                doc.text(`$${costo.toFixed(2)}`, startX + 460, y, { align: 'right', width: 70 });
                doc.text(`$${precio.toFixed(2)}`, startX + 530, y, { align: 'right', width: 70 });
                doc.text(`$${valorTotal.toFixed(2)}`, startX + 600, y, { align: 'right', width: 80 });
                doc.moveDown(1.2);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
            doc.moveDown(1);
            doc.fontSize(10).font('Helvetica-Bold').text(`TOTAL UNIDADES: ${grandTotalItems.toFixed(2)}`, { align: 'right' });
            doc.text(`VALOR TOTAL INVENTARIO: $${grandTotalCost.toFixed(2)}`, { align: 'right' });
            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a PDF buffer for an inventory movements report
 */
/**
 * Generates a PDF buffer for an inventory movements report
 */
const generateMovementsReportPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const finalBuffer = Buffer.concat(buffers);
                if (finalBuffer.length === 0) {
                    reject(new Error('PDF generation produced empty buffer'));
                    return;
                }
                resolve(finalBuffer);
            });
            doc.on('error', (err) => reject(err));

            const startX = 30;
            const drawHeader = () => {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text(data.company_name, { align: 'left' });
                doc.fontSize(10).text(`Sucursal: ${data.branch_name}`, { align: 'left' });
                doc.fontSize(10).text(`Periodo: ${new Date(data.startDate).toLocaleDateString()} al ${new Date(data.endDate).toLocaleDateString()}`, { align: 'left' });
                doc.moveDown();
                doc.fontSize(14).text('REPORTE DE MOVIMIENTOS DE INVENTARIO', { align: 'center', underline: true });
                doc.moveDown();
            };

            drawHeader();

            const tableTop = doc.y;
            const colWidths = { codigo: 70, producto: 220, costo: 60, inicial: 60, entradas: 60, salidas: 60, final: 60, monto: 80 };

            const drawTableHeader = () => {
                const hY = doc.y;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
                doc.text('Código', startX, hY, { align: 'left' });
                doc.text('Producto', startX + 70, hY, { align: 'left' });
                doc.text('Costo', startX + 290, hY, { align: 'right', width: 60 });
                doc.text('Inicial', startX + 350, hY, { align: 'right', width: 60 });
                doc.text('Entradas', startX + 410, hY, { align: 'right', width: 60 });
                doc.text('Salidas', startX + 470, hY, { align: 'right', width: 60 });
                doc.text('Final', startX + 530, hY, { align: 'right', width: 60 });
                doc.text('Monto', startX + 590, hY, { align: 'right', width: 80 });
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(8).fillColor('black');
            };

            drawTableHeader();

            let currentCategory = null;
            let grandTotalMonto = 0;

            data.products.forEach((p) => {
                // Grouping by category
                if (p.categoria !== currentCategory) {
                    if (doc.y > 450) {
                        doc.addPage();
                        drawTableHeader();
                    }
                    currentCategory = p.categoria;
                    doc.moveDown(0.5);
                    doc.fontSize(10).font('Helvetica-Bold').fillColor('#4f46e5').text(`CATEGORÍA: ${currentCategory.toUpperCase()}`, startX, doc.y, { align: 'left' });
                    doc.fillColor('black').moveDown(0.2);
                    doc.moveTo(startX, doc.y).lineTo(startX + 300, doc.y).stroke();
                    doc.moveDown(0.5);
                }

                // Check page break during item list
                if (doc.y > 500) {
                    doc.addPage();
                    drawTableHeader();
                    // Remind of current category on new page if it continues
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5').text(`CATEGORÍA: ${currentCategory.toUpperCase()} (cont.)`, startX, doc.y, { align: 'left' });
                    doc.fillColor('black').moveDown(0.5);
                }

                const y = doc.y;
                const inicial = parseFloat(p.inicial || 0);
                const entradas = parseFloat(p.entradas || 0);
                const salidas = parseFloat(p.salidas || 0);
                const final = parseFloat(p.final || 0);
                const costo = parseFloat(p.costo || 0);
                const monto = final * costo;
                grandTotalMonto += monto;

                doc.font('Helvetica').fontSize(8).fillColor('black');
                doc.text(p.codigo || 'N/A', startX, y, { align: 'left' });
                doc.text(p.nombre, startX + 70, y, { width: 210, align: 'left' });
                doc.text(`$${costo.toFixed(2)}`, startX + 290, y, { align: 'right', width: 60 });
                doc.text(inicial.toFixed(2), startX + 350, y, { align: 'right', width: 60 });
                doc.text(entradas.toFixed(2), startX + 410, y, { align: 'right', width: 60 });
                doc.text(salidas.toFixed(2), startX + 470, y, { align: 'right', width: 60 });
                doc.text(final.toFixed(2), startX + 530, y, { align: 'right', width: 60 });
                doc.text(`$${monto.toFixed(2)}`, startX + 590, y, { align: 'right', width: 80 });
                doc.moveDown(1.2);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold').fillColor('black').text(`VALOR TOTAL FINAL DEL INVENTARIO: $${grandTotalMonto.toFixed(2)}`, { align: 'right' });
            
            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a PDF for Customer Balances Report
 */
const generateCustomerBalancesPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const startX = 30;
            const drawHeader = () => {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text(data.company_name, { align: 'left' });
                doc.fontSize(10).text(`Sucursal: ${data.branch_name}`, { align: 'left' });
                doc.fontSize(10).text(`Fecha de Corte: ${new Date(data.endDate).toLocaleDateString()}`, { align: 'left' });
                doc.moveDown();
                doc.fontSize(14).text('REPORTE DE SALDOS DE CLIENTES', { align: 'center', underline: true });
                doc.moveDown();
            };

            drawHeader();

            const drawTableHeader = () => {
                const hY = doc.y;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
                doc.text('ID', startX, hY, { align: 'left' });
                doc.text('Cliente', startX + 50, hY, { align: 'left' });
                doc.text('DUI / NIT', startX + 350, hY, { align: 'left' });
                doc.text('NRC', startX + 500, hY, { align: 'left' });
                doc.text('Saldo Pendiente', startX + 600, hY, { align: 'right', width: 120 });
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(9).fillColor('black');
            };

            drawTableHeader();

            data.items.forEach(item => {
                if (doc.y > 520) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                doc.text(item.id.toString(), startX, y, { align: 'left' });
                doc.text(item.nombre, startX + 50, y, { width: 290, align: 'left' });
                doc.text(item.dui_nit, startX + 350, y, { align: 'left' });
                doc.text(item.nrc, startX + 500, y, { align: 'left' });
                doc.font('Helvetica-Bold').text(`$${parseFloat(item.saldo).toFixed(2)}`, startX + 600, y, { align: 'right', width: 120 });
                doc.font('Helvetica').moveDown(1.2);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL CARTERA CLIENTES: $${parseFloat(data.total_general).toFixed(2)}`, { align: 'right' });
            
            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a PDF for Provider Balances Report
 */
const generateProviderBalancesPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const startX = 30;
            const drawHeader = () => {
                doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text(data.company_name, { align: 'left' });
                doc.fontSize(10).text(`Sucursal: ${data.branch_name}`, { align: 'left' });
                doc.fontSize(10).text(`Fecha de Corte: ${new Date(data.endDate).toLocaleDateString()}`, { align: 'left' });
                doc.moveDown();
                doc.fontSize(14).text('REPORTE DE SALDOS DE PROVEEDORES', { align: 'center', underline: true });
                doc.moveDown();
            };

            drawHeader();

            const drawTableHeader = () => {
                const hY = doc.y;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
                doc.text('ID', startX, hY, { align: 'left' });
                doc.text('Proveedor', startX + 50, hY, { align: 'left' });
                doc.text('NIT / DUI', startX + 350, hY, { align: 'left' });
                doc.text('NRC', startX + 500, hY, { align: 'left' });
                doc.text('Saldo Pendiente', startX + 600, hY, { align: 'right', width: 120 });
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(9).fillColor('black');
            };

            drawTableHeader();

            data.items.forEach(item => {
                if (doc.y > 520) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                doc.text(item.id.toString(), startX, y, { align: 'left' });
                doc.text(item.nombre, startX + 50, y, { width: 290, align: 'left' });
                doc.text(item.dui_nit, startX + 350, y, { align: 'left' });
                doc.text(item.nrc, startX + 500, y, { align: 'left' });
                doc.font('Helvetica-Bold').text(`$${parseFloat(item.saldo).toFixed(2)}`, startX + 600, y, { align: 'right', width: 120 });
                doc.font('Helvetica').moveDown(1.2);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + 720, doc.y).stroke();
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL DEUDA PROVEEDORES: $${parseFloat(data.total_general).toFixed(2)}`, { align: 'right' });
            
            doc.end();
        } catch (err) { reject(err); }
    });
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
const generateDailySalesReportPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape', size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            // Header
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name, { align: 'left' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`);
            doc.text(`Período: ${data.startDate} al ${data.endDate}`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text('REPORTE DE VENTAS DIARIAS', { align: 'center', underline: true });
            doc.moveDown();

            const startX = 20;
            const tableTop = doc.y;
            const colWidths = {
                fecha: 42, tipo: 55, doc: 170, cond: 30, cliente: 255,
                grav: 30, exen: 30, iva: 22, fov: 20, cot: 20, ret: 22, perc: 22, total: 32
            };
            const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

            const drawTableHeader = () => {
                const y = doc.y;
                doc.fontSize(8).font('Helvetica-Bold');
                let x = startX;
                doc.text('Fecha', x, y); x += colWidths.fecha;
                doc.text('Tipo', x, y); x += colWidths.tipo;
                doc.text('Doc', x, y); x += colWidths.doc;
                doc.text('Cond.', x, y); x += colWidths.cond;
                doc.text('Cliente', x, y); x += colWidths.cliente;
                doc.text('Grav.', x, y, { align: 'right', width: colWidths.grav }); x += colWidths.grav;
                doc.text('Exen.', x, y, { align: 'right', width: colWidths.exen }); x += colWidths.exen;
                doc.text('IVA', x, y, { align: 'right', width: colWidths.iva }); x += colWidths.iva;
                doc.text('FOV', x, y, { align: 'right', width: colWidths.fov }); x += colWidths.fov;
                doc.text('COT', x, y, { align: 'right', width: colWidths.cot }); x += colWidths.cot;
                doc.text('Ret.', x, y, { align: 'right', width: colWidths.ret }); x += colWidths.ret;
                doc.text('Perc.', x, y, { align: 'right', width: colWidths.perc }); x += colWidths.perc;
                doc.text('Total', x, y, { align: 'right', width: colWidths.total });
                
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(7);
            };

            drawTableHeader();

            const formatDate = (dateStr) => {
                if (!dateStr) return '---';
                const d = new Date(dateStr);
                // Adjust for UTC/Local mismatch if necessary, but fecha_emision is usually YYYY-MM-DD
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };

            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

            data.sales.forEach(s => {
                if (doc.y > 520) {
                    doc.addPage();
                    drawTableHeader();
                }

                const y = doc.y;
                let x = startX;
                
                doc.text(formatDate(s.fecha), x, y, { width: colWidths.fecha }); x += colWidths.fecha;
                doc.text(s.tipo || '---', x, y, { width: colWidths.tipo }); x += colWidths.tipo;
                doc.text(s.documento || '---', x, y, { width: colWidths.doc }); x += colWidths.doc;
                doc.text(s.condicion || '---', x, y, { width: colWidths.cond }); x += colWidths.cond;
                doc.text(s.cliente || '---', x, y, { width: colWidths.cliente }); x += colWidths.cliente;
                
                doc.text(formatVal(s.gravadas), x, y, { align: 'right', width: colWidths.grav }); x += colWidths.grav;
                doc.text(formatVal(s.exentas), x, y, { align: 'right', width: colWidths.exen }); x += colWidths.exen;
                doc.text(formatVal(s.iva), x, y, { align: 'right', width: colWidths.iva }); x += colWidths.iva;
                doc.text(formatVal(s.fovial), x, y, { align: 'right', width: colWidths.fov }); x += colWidths.fov;
                doc.text(formatVal(s.cotrans), x, y, { align: 'right', width: colWidths.cot }); x += colWidths.cot;
                doc.text(formatVal(s.retencion), x, y, { align: 'right', width: colWidths.ret }); x += colWidths.ret;
                doc.text(formatVal(s.percepcion), x, y, { align: 'right', width: colWidths.perc }); x += colWidths.perc;
                doc.text(formatVal(s.total), x, y, { align: 'right', width: colWidths.total });
                
                doc.moveDown(0.7);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
            doc.moveDown(1);
            
            // Totals row
            doc.font('Helvetica-Bold');
            const totalsY = doc.y;
            let tX = startX + colWidths.fecha + colWidths.tipo + colWidths.doc + colWidths.cond + colWidths.cliente;

            doc.text(formatVal(data.total_gravadas), tX, totalsY, { align: 'right', width: colWidths.grav }); tX += colWidths.grav;
            doc.text(formatVal(data.total_exentas), tX, totalsY, { align: 'right', width: colWidths.exen }); tX += colWidths.exen;
            doc.text(formatVal(data.total_iva), tX, totalsY, { align: 'right', width: colWidths.iva }); tX += colWidths.iva;
            doc.text(formatVal(data.total_fovial), tX, totalsY, { align: 'right', width: colWidths.fov }); tX += colWidths.fov;
            doc.text(formatVal(data.total_cotrans), tX, totalsY, { align: 'right', width: colWidths.cot }); tX += colWidths.cot;
            doc.text(formatVal(data.total_retencion), tX, totalsY, { align: 'right', width: colWidths.ret }); tX += colWidths.ret;
            doc.text(formatVal(data.total_percepcion), tX, totalsY, { align: 'right', width: colWidths.perc }); tX += colWidths.perc;
            doc.text(formatVal(data.total_general), tX, totalsY, { align: 'right', width: colWidths.total });
            
            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a PDF report for sales by customer (detalle de productos).
 * Formato similar a ventas diarias pero filtrado por cliente,
 * con los datos del cliente en el encabezado.
 */
const generateSalesByCustomerPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            // Header
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name, { align: 'left' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`);
            doc.text(`Período: ${data.startDate} al ${data.endDate}`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text('REPORTE DE VENTAS POR CLIENTE', { align: 'center', underline: true });
            doc.moveDown();

            // Bloque de datos del cliente
            const c = data.customer || {};
            doc.fontSize(9).font('Helvetica-Bold').text('CLIENTE:', { underline: true });
            doc.font('Helvetica');
            doc.text(`Nombre: ${c.nombre || '---'}${c.nombre_comercial ? ` (${c.nombre_comercial})` : ''}`);
            doc.text(`NIT: ${c.nit || '---'}  |  NRC: ${c.nrc || '---'}  |  Tel: ${c.telefono || '---'}`);
            doc.text(`Correo: ${c.correo || '---'}`);
            const dirParts = [c.direccion, c.departamento, c.municipio].filter(Boolean).join(', ');
            doc.text(`Dirección: ${dirParts || '---'}`);
            doc.moveDown();

            const startX = 20;
            const colWidths = {
                fecha: 40, tipo: 50, doc: 130, producto: 230, cant: 35, total: 45
            };
            const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

            const drawTableHeader = () => {
                const y = doc.y;
                doc.fontSize(8).font('Helvetica-Bold');
                let x = startX;
                doc.text('Fecha', x, y); x += colWidths.fecha;
                doc.text('Tipo', x, y); x += colWidths.tipo;
                doc.text('Doc', x, y); x += colWidths.doc;
                doc.text('Producto', x, y); x += colWidths.producto;
                doc.text('Cant.', x, y, { align: 'right', width: colWidths.cant }); x += colWidths.cant;
                doc.text('Total', x, y, { align: 'right', width: colWidths.total });

                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(7);
            };

            drawTableHeader();

            const formatDate = (dateStr) => {
                if (!dateStr) return '---';
                const d = new Date(dateStr);
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };

            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;
            const formatQty = (val) => {
                const n = parseFloat(val || 0);
                return Number.isInteger(n) ? String(n) : n.toFixed(2);
            };

            data.sales.forEach(s => {
                if (doc.y > 740) {
                    doc.addPage();
                    drawTableHeader();
                }

                const y = doc.y;
                let x = startX;

                doc.text(formatDate(s.fecha), x, y, { width: colWidths.fecha }); x += colWidths.fecha;
                doc.text(s.tipo || '---', x, y, { width: colWidths.tipo }); x += colWidths.tipo;
                doc.text(s.documento || '---', x, y, { width: colWidths.doc }); x += colWidths.doc;
                doc.text(s.producto || '---', x, y, { width: colWidths.producto }); x += colWidths.producto;
                doc.text(formatQty(s.cantidad), x, y, { align: 'right', width: colWidths.cant }); x += colWidths.cant;
                doc.text(formatVal(s.total), x, y, { align: 'right', width: colWidths.total });

                doc.moveDown(0.7);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
            doc.moveDown(1);

            // Fila de totales
            doc.font('Helvetica-Bold');
            const totalsY = doc.y;
            let tX = startX + colWidths.fecha + colWidths.tipo + colWidths.doc;

            doc.text('TOTAL', tX, totalsY, { align: 'right', width: colWidths.producto }); tX += colWidths.producto;
            doc.text(formatQty(data.total_cantidad), tX, totalsY, { align: 'right', width: colWidths.cant }); tX += colWidths.cant;
            doc.text(formatVal(data.total_general), tX, totalsY, { align: 'right', width: colWidths.total });

            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a PDF report for sales by category
 */
const generateSalesByCategoryPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, layout: 'landscape', size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const formatDate = (dateStr) => {
                if (!dateStr) return '---';
                const d = new Date(dateStr);
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };
            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

            // Header
            doc.fontSize(16).font('Helvetica-Bold').text(data.company.razon_social, { align: 'left' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch}`);
            doc.text(`Período: ${data.period}`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text('REPORTE DE VENTAS POR CATEGORÍA', { align: 'center', underline: true });
            doc.moveDown();

            const startX = 40;
            const colWidths = {
                cat: 200, unidades: 100, monto: 120, rendimiento: 120, porcentaje: 100
            };

            const drawTableHeader = () => {
                const y = doc.y;
                doc.fontSize(10).font('Helvetica-Bold');
                let x = startX;
                doc.text('Categoría / Producto', x, y); x += colWidths.cat;
                doc.text('Unidades', x, y, { align: 'right', width: colWidths.unidades }); x += colWidths.unidades;
                doc.text('Monto ($)', x, y, { align: 'right', width: colWidths.monto }); x += colWidths.monto;
                doc.text('Rendimiento ($)', x, y, { align: 'right', width: colWidths.rendimiento }); x += colWidths.rendimiento;
                doc.text('% Part.', x, y, { align: 'right', width: colWidths.porcentaje });
                
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + 650, doc.y).stroke();
                doc.moveDown(0.5);
            };

            drawTableHeader();

            data.categories.forEach(cat => {
                if (doc.y > 500) {
                    doc.addPage();
                    drawTableHeader();
                }

                // Category Row
                const y = doc.y;
                let x = startX;
                doc.font('Helvetica-Bold').fontSize(10);
                doc.text(cat.categoria, x, y, { width: colWidths.cat }); x += colWidths.cat;
                doc.text(cat.total_unidades, x, y, { align: 'right', width: colWidths.unidades }); x += colWidths.unidades;
                doc.text(formatVal(cat.total_venta), x, y, { align: 'right', width: colWidths.monto }); x += colWidths.monto;
                doc.text(formatVal(cat.rendimiento), x, y, { align: 'right', width: colWidths.rendimiento }); x += colWidths.rendimiento;
                doc.text(`${parseFloat(cat.porcentaje_ventas || 0).toFixed(2)}%`, x, y, { align: 'right', width: colWidths.porcentaje });
                doc.moveDown(0.8);


                // Products if detailed
                if (data.isDetailed && cat.productos && cat.productos.length > 0) {
                    doc.font('Helvetica').fontSize(9);
                    cat.productos.forEach(p => {
                        if (doc.y > 520) {
                            doc.addPage();
                            drawTableHeader();
                        }
                        const py = doc.y;
                        let px = startX + 20; // Indent
                        doc.text(p.producto, px, py, { width: colWidths.cat - 20 }); px += colWidths.cat - 20;
                        doc.text(p.unidades, px, py, { align: 'right', width: colWidths.unidades }); px += colWidths.unidades;
                        doc.text(formatVal(p.monto), px, py, { align: 'right', width: colWidths.monto }); px += colWidths.monto;
                        doc.text(formatVal(p.rendimiento), px, py, { align: 'right', width: colWidths.rendimiento }); px += colWidths.rendimiento;
                        doc.moveDown(0.8);
                    });
                    doc.moveDown(0.5);
                }
            });

            // Grand Total
            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + 650, doc.y).stroke();
            doc.moveDown(0.5);
            const tY = doc.y;
            doc.font('Helvetica-Bold').fontSize(11);
            doc.text('TOTAL GENERAL:', startX, tY);
            doc.text(formatVal(data.grand_total), startX + colWidths.cat + colWidths.unidades, tY, { align: 'right', width: colWidths.monto });

            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a detailed itemized PDF for Sales by POS Report
 */
const generateSalesByPOSPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape', size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const formatDate = (dateStr) => {
                if (!dateStr) return '---';
                const d = new Date(dateStr);
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };
            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;
            // Truncado manual confiable (PDFKit truncate/ellipsis no aplican de forma consistente)
            const fitText = (text, maxWidth) => {
                const str = text || '';
                if (doc.widthOfString(str) <= maxWidth) return str;
                let truncated = str;
                while (truncated.length > 0 && doc.widthOfString(truncated + '...') > maxWidth) {
                    truncated = truncated.slice(0, -1);
                }
                return truncated + '...';
            };

            // Header
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name.toUpperCase(), { align: 'center' });
            if (data.company_nit) doc.fontSize(10).font('Helvetica').text(`NIT: ${data.company_nit}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`, { align: 'center' });
            doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DETALLADO DE VENTAS POR POS', { align: 'center' });
            doc.fontSize(9).font('Helvetica').text(`Periodo: ${formatDate(data.startDate)} al ${formatDate(data.endDate)}`, { align: 'center' });
            doc.moveDown(1.5);

            const startX = 30;
            const totalWidth = 710;
            const colWidths = {
                fecha: 40,
                tipo: 55,
                numero: 130,
                cond: 40,
                cliente: 250,
                fiscal: 130,
                total: 65
            };

            const drawTableHeader = (y) => {
                doc.fontSize(8).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, y); x += colWidths.fecha;
                doc.text('TIPO DOC', x, y); x += colWidths.tipo;
                doc.text('NUMERO', x, y); x += colWidths.numero;
                doc.text('COND.', x, y); x += colWidths.cond;
                doc.text('CLIENTE', x, y); x += colWidths.cliente;
                doc.text('FISCAL/VENDEDOR', x, y); x += colWidths.fiscal;
                doc.text('TOTAL', x, y, { align: 'right', width: colWidths.total });
                
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(7);
                return doc.y;
            };

            let currentY = drawTableHeader(doc.y);
            let currentPOS = null;
            let posTotal = 0;
            let grandTotal = 0;

            data.data.forEach((row, index) => {
                // POS Grouping Header
                if (row.pos_name !== currentPOS) {
                    if (currentPOS !== null) {
                        // Print POS Subtotal
                        doc.font('Helvetica-Bold').fontSize(8);
                        doc.text(`SUBTOTAL ${currentPOS}:`, startX + totalWidth - colWidths.total - 150, doc.y, { width: 150, align: 'right' });
                        doc.text(formatVal(posTotal), startX + totalWidth - colWidths.total, doc.y - 8, { width: colWidths.total, align: 'right' });
                        doc.moveDown(1);
                        posTotal = 0;
                    }

                    if (doc.y > 500) {
                        doc.addPage();
                        currentY = drawTableHeader(30);
                    }

                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#4f46e5');
                    doc.text(`TERMINAL POS: ${row.pos_name || 'SIN POS'}`, startX, doc.y);
                    doc.fillColor('black').moveDown(0.5);
                    currentPOS = row.pos_name;
                }

                if (doc.y > 540) {
                    doc.addPage();
                    currentY = drawTableHeader(30);
                    doc.font('Helvetica-Bold').fontSize(8).text(`TERMINAL POS: ${currentPOS} (cont.)`, startX, doc.y);
                    doc.moveDown(0.5);
                }

                const y = doc.y;
                let x = startX;
                doc.font('Helvetica').fontSize(7);

                // Row Data
                doc.text(formatDate(row.fecha_emision), x, y); x += colWidths.fecha;
                
                let tipoLabel = row.tipo_documento;
                if (tipoLabel === '01') tipoLabel = 'Factura';
                else if (tipoLabel === '03') tipoLabel = 'Crédito Fiscal';
                else if (tipoLabel === '04') tipoLabel = 'Nota de Remisión';
                else if (tipoLabel === '05') tipoLabel = 'Nota de Crédito';
                else if (tipoLabel === '11') tipoLabel = 'F. Exportación';
                
                doc.text(tipoLabel, x, y, { width: colWidths.tipo }); x += colWidths.tipo;
                doc.text(row.numero_control || 'N/A', x, y, { width: colWidths.numero }); x += colWidths.numero;
                
                let condLabel = row.condicion_operacion === 1 ? 'Contado' : 'Crédito';
                doc.text(condLabel, x, y); x += colWidths.cond;
                
                doc.text(fitText(row.cliente_nombre || 'Consumidor Final', colWidths.cliente), x, y, { width: colWidths.cliente }); x += colWidths.cliente;
                
                const fiscalInfo = `${row.cliente_nit || row.cliente_nrc || ''} / ${row.vendedor_nombre || ''}`.trim();
                doc.text(fitText(fiscalInfo || '---', colWidths.fiscal), x, y, { width: colWidths.fiscal }); x += colWidths.fiscal;
                
                doc.text(formatVal(row.total_pagar), x, y, { align: 'right', width: colWidths.total });

                posTotal += parseFloat(row.total_pagar || 0);
                grandTotal += parseFloat(row.total_pagar || 0);
                doc.moveDown(0.8);

                // Last row subtotal
                if (index === data.data.length - 1) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(8);
                    doc.text(`SUBTOTAL ${currentPOS}:`, startX + totalWidth - colWidths.total - 150, doc.y, { width: 150, align: 'right' });
                    doc.text(formatVal(posTotal), startX + totalWidth - colWidths.total, doc.y - 8, { width: colWidths.total, align: 'right' });
                }
            });

            // Grand Total Footer
            doc.moveDown(1.5);
            doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('TOTAL GENERAL:', startX + totalWidth - colWidths.total - 150, doc.y, { width: 150, align: 'right' });
            doc.text(formatVal(grandTotal), startX + totalWidth - colWidths.total, doc.y - 10, { width: colWidths.total, align: 'right' });

            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a detailed PDF of pending documents grouped by customer
 */
const generatePendingDocumentsDetailedPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER', layout: 'portrait' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const formatDate = (dateStr) => {
                if (!dateStr) return '---';
                const d = new Date(dateStr);
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };
            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

            // Header (Standard format)
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name.toUpperCase(), { align: 'center' });
            if (data.company_nit) doc.fontSize(10).font('Helvetica').text(`NIT: ${data.company_nit}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DETALLADO DE DOCUMENTOS PENDIENTES', { align: 'center', underline: true });
            doc.fontSize(9).font('Helvetica').text(`Fecha de Corte: ${formatDate(data.cutoffDate)}`, { align: 'center' });
            doc.moveDown(1.5);

            const startX = 40;
            const colWidths = {
                fecha: 70,
                dias: 40,
                tipo: 100,
                doc: 120,
                monto: 90,
                saldo: 90
            };

            const drawTableHeader = (y) => {
                doc.fontSize(9).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, y); x += colWidths.fecha;
                doc.text('DÍAS', x, y); x += colWidths.dias;
                doc.text('TIPO', x, y); x += colWidths.tipo;
                doc.text('DOCUMENTO', x, y); x += colWidths.doc;
                doc.text('MONTO ORIG.', x, y, { align: 'right', width: colWidths.monto }); x += colWidths.monto;
                doc.text('SALDO PEND.', x, y, { align: 'right', width: colWidths.saldo });
                
                doc.moveDown(0.4);
                doc.moveTo(startX, doc.y).lineTo(startX + 520, doc.y).strokeColor('#333').stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(8);
                return doc.y;
            };

            drawTableHeader(doc.y);

            data.customers.forEach((customer, cIndex) => {
                // Check page break for customer header
                if (doc.y > 650) {
                    doc.addPage();
                    drawTableHeader(40);
                }

                doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af');
                doc.text(`CLIENTE: ${customer.customer_name}`, startX, doc.y);
                doc.fillColor('black').moveDown(0.5);

                customer.documents.forEach(row => {
                    // Check page break for row
                    if (doc.y > 700) {
                        doc.addPage();
                        drawTableHeader(40);
                        doc.fontSize(9).font('Helvetica-Bold').text(`CLIENTE: ${customer.customer_name} (cont.)`, startX, doc.y);
                        doc.moveDown(0.5);
                    }

                    const y = doc.y;
                    let x = startX;
                    doc.font('Helvetica').fontSize(8);
                    
                    doc.text(formatDate(row.fecha), x, y); x += colWidths.fecha;
                    doc.text(row.dias.toString(), x, y); x += colWidths.dias;
                    doc.text(row.tipo, x, y, { width: colWidths.tipo, truncate: true }); x += colWidths.tipo;
                    doc.text(row.documento, x, y, { width: colWidths.doc, truncate: true }); x += colWidths.doc;
                    doc.text(formatVal(row.monto), x, y, { align: 'right', width: colWidths.monto }); x += colWidths.monto;
                    doc.text(formatVal(row.saldo), x, y, { align: 'right', width: colWidths.saldo });
                    doc.moveDown(0.8);
                });

                // Customer Subtotal
                doc.moveDown(0.2);
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text(`Subtotal ${customer.customer_name}:`, startX + 250, doc.y, { width: 170, align: 'right' });
                doc.text(formatVal(customer.subtotal), startX + 430, doc.y - 10, { width: colWidths.saldo, align: 'right' });
                doc.moveDown(1.5);
            });

            // Grand Total
            if (doc.y > 650) doc.addPage();
            doc.moveTo(startX, doc.y).lineTo(startX + 520, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('TOTAL GENERAL PENDIENTE:', startX + 200, doc.y, { width: 220, align: 'right' });
            doc.text(formatVal(data.grandTotal), startX + 430, doc.y - 12, { width: colWidths.saldo, align: 'right' });

            // Footer
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).fillColor('grey').text(
                    `Página ${i + 1} de ${pageCount} - Generado el ${new Date().toLocaleString()}`,
                    startX,
                    doc.page.height - 30,
                    { align: 'center' }
                );
            }

            doc.end();
        } catch (err) { reject(err); }
    });
};

/**
 * Generates a detailed PDF of pending documents for providers grouped by provider
 */
const generateProviderPendingDocumentsDetailedPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'LETTER', layout: 'portrait' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const formatDate = (dateStr) => {
                if (!dateStr) return '---';
                const d = new Date(dateStr);
                const day = String(d.getUTCDate()).padStart(2, '0');
                const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                const year = d.getUTCFullYear();
                return `${day}/${month}/${year}`;
            };
            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

            // Header (Standard format)
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name.toUpperCase(), { align: 'center' });
            if (data.company_nit) doc.fontSize(10).font('Helvetica').text(`NIT: ${data.company_nit}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DETALLADO DE DOCUMENTOS POR PAGAR', { align: 'center', underline: true });
            doc.fontSize(9).font('Helvetica').text(`Fecha de Corte: ${formatDate(data.cutoffDate)}`, { align: 'center' });
            doc.moveDown(1.5);

            const startX = 40;
            const colWidths = {
                fecha: 65,
                origen: 55,
                dias: 35,
                tipo: 85,
                doc: 110,
                monto: 85,
                saldo: 85
            };

            const drawTableHeader = (y) => {
                doc.fontSize(8).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, y); x += colWidths.fecha;
                doc.text('ORIGEN', x, y); x += colWidths.origen;
                doc.text('DÍAS', x, y); x += colWidths.dias;
                doc.text('TIPO', x, y); x += colWidths.tipo;
                doc.text('DOCUMENTO', x, y); x += colWidths.doc;
                doc.text('MONTO ORIG.', x, y, { align: 'right', width: colWidths.monto }); x += colWidths.monto;
                doc.text('SALDO PEND.', x, y, { align: 'right', width: colWidths.saldo });
                
                doc.moveDown(0.4);
                doc.moveTo(startX, doc.y).lineTo(startX + 520, doc.y).strokeColor('#333').stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(7);
                return doc.y;
            };

            drawTableHeader(doc.y);

            data.providers.forEach((provider, pIndex) => {
                // Check page break for provider header
                if (doc.y > 650) {
                    doc.addPage();
                    drawTableHeader(40);
                }

                doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e40af');
                doc.text(`PROVEEDOR: ${provider.provider_name}`, startX, doc.y);
                doc.fillColor('black').moveDown(0.5);

                provider.documents.forEach(row => {
                    // Check page break for row
                    if (doc.y > 700) {
                        doc.addPage();
                        drawTableHeader(40);
                        doc.fontSize(8).font('Helvetica-Bold').text(`PROVEEDOR: ${provider.provider_name} (cont.)`, startX, doc.y);
                        doc.moveDown(0.5);
                    }

                    const y = doc.y;
                    let x = startX;
                    doc.font('Helvetica').fontSize(7);
                    
                    doc.text(formatDate(row.fecha), x, y); x += colWidths.fecha;
                    doc.text(row.origen || '---', x, y); x += colWidths.origen;
                    doc.text(row.dias.toString(), x, y); x += colWidths.dias;
                    doc.text(row.tipo, x, y, { width: colWidths.tipo, truncate: true }); x += colWidths.tipo;
                    doc.text(row.documento, x, y, { width: colWidths.doc, truncate: true }); x += colWidths.doc;
                    doc.text(formatVal(row.monto), x, y, { align: 'right', width: colWidths.monto }); x += colWidths.monto;
                    doc.text(formatVal(row.saldo), x, y, { align: 'right', width: colWidths.saldo });
                    doc.moveDown(0.8);
                });

                // Provider Subtotal
                doc.moveDown(0.2);
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text(`Subtotal ${provider.provider_name}:`, startX + 250, doc.y, { width: 170, align: 'right' });
                doc.text(formatVal(provider.subtotal), startX + 430, doc.y - 10, { width: colWidths.saldo, align: 'right' });
                doc.moveDown(1.5);
            });

            // Grand Total
            if (doc.y > 650) doc.addPage();
            doc.moveTo(startX, doc.y).lineTo(startX + 520, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(11).font('Helvetica-Bold');
            doc.text('TOTAL GENERAL PENDIENTE:', startX + 200, doc.y, { width: 220, align: 'right' });
            doc.text(formatVal(data.grandTotal), startX + 430, doc.y - 12, { width: colWidths.saldo, align: 'right' });

            // Footer
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).fillColor('grey').text(
                    `Página ${i + 1} de ${pageCount} - Generado el ${new Date().toLocaleString()}`,
                    startX,
                    doc.page.height - 30,
                    { align: 'center' }
                );
            }

            doc.end();
        } catch (err) { reject(err); }
    });
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
                
                doc.text(formattedQty, startX + 5, currentY);
                doc.text(item.descripcion, startX + 45, currentY, { width: 300 });
                doc.text(`$${parseFloat(item.precioUnitario).toFixed(4)}`, startX + 350, currentY, { align: 'right', width: 60 });
                doc.text(`$${parseFloat(item.montoDescuento || 0).toFixed(2)}`, startX + 420, currentY, { align: 'right', width: 60 });
                doc.text(`$${parseFloat(item.totalItem).toFixed(2)}`, startX + 500, currentY, { align: 'right', width: 70 });
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
            
            const addTotalLine = (label, value, isBold = false) => {
                doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(label, totalsX, currentTotalY);
                doc.text(`$${parseFloat(value).toFixed(2)}`, startX + 500, currentTotalY, { align: 'right', width: 70 });
                currentTotalY += 12;
            };

            addTotalLine('SUMA DE OPERACIONES:', venta.total_gravado, true);
            addTotalLine('(-) DESCUENTOS:', venta.total_descuento);
            addTotalLine('VENTAS GRAVADAS:', venta.total_gravado, true);
            addTotalLine('TOTAL IVA (13%):', venta.total_iva, true);

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
            if (!processedCodes.has('D1') && !processedCodes.has('C3') && !processedCodes.has('01') && venta.fovial > 0) {
                addTotalLine('TOTAL FOVIAL ($0.20):', venta.fovial);
            }
            if (!processedCodes.has('C8') && !processedCodes.has('C1') && !processedCodes.has('02') && venta.cotrans > 0) {
                addTotalLine('TOTAL COTRAN ($0.10):', venta.cotrans);
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

const generateCloseoutDetailPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape', size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const fmtDate = (d) => {
                if (!d) return '—';
                if (typeof d === 'string' && d.length >= 10) return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
                const dt = new Date(d);
                return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
            };
            const fmtVal = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

            // Header
            doc.fontSize(14).font('Helvetica-Bold').text(data.company?.razon_social || data.company_name || '', { align: 'left' });
            doc.fontSize(9).font('Helvetica').text(`Sucursal: ${data.branch_name || 'Todas'}`);
            doc.fontSize(9).text(`Período: ${fmtDate(data.start_date)} — ${fmtDate(data.end_date)}`);
            doc.moveDown(0.3);

            doc.fontSize(12).font('Helvetica-Bold').text(`DETALLE DE ${data.tipo_nombre?.toUpperCase() || data.tipo_reporte?.toUpperCase()}`, { align: 'center', underline: true });
            doc.moveDown(0.5);

            const startX = 30;
            const pageW = 780;

            const colDefs = data.columns || [];
            const colTotal = colDefs.reduce((s, c) => s + c.w, 0);
            const drawTableHeader = () => {
                const y = doc.y;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b');
                let x = startX;
                colDefs.forEach(c => {
                    doc.text(c.label, x, y, { width: c.w, align: c.align || 'left' });
                    x += c.w;
                });
                doc.fillColor('#1e293b');
                doc.moveDown(0.3);
                doc.moveTo(startX, doc.y).lineTo(startX + pageW, doc.y).stroke('#e2e8f0');
                doc.moveDown(0.3);
            };

            drawTableHeader();

            let rowIndex = 0;
            const renderRow = (row) => {
                if (doc.y > 520) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                let x = startX;
                doc.fontSize(8).font('Helvetica');
                if (rowIndex % 2 === 0) {
                    doc.rect(startX, y - 2, pageW, 14).fill('#f8fafc');
                }
                rowIndex++;
                colDefs.forEach(c => {
                    const val = c.accessor ? row[c.accessor] : row[c.label];
                    doc.fillColor('#1e293b').fontSize(8);
                    if (c.format === 'money') {
                        doc.text(fmtVal(val), x, y, { width: c.w, align: 'right' });
                    } else if (c.format === 'date') {
                        doc.text(fmtDate(val), x, y, { width: c.w, align: 'center' });
                    } else {
                        doc.text(String(val ?? '—'), x, y, { width: c.w, align: c.align || 'left' });
                    }
                    x += c.w;
                });
                doc.moveDown(0.9);
            };

            const renderGroupHeader = (group) => {
                if (doc.y > 520) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                let x = startX;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155');
                doc.rect(startX, y - 2, pageW, 14).fill('#e2e8f0');
                colDefs.forEach(c => {
                    const isMoney = c.format === 'money';
                    const text = isMoney ? fmtVal(group.subtotal || 0) : (x === startX ? String(group.label ?? '—') : '');
                    doc.text(text, x, y, { width: c.w, align: isMoney ? 'right' : 'left' });
                    x += c.w;
                });
                doc.fillColor('#1e293b').font('Helvetica');
                doc.moveDown(0.9);
            };

            if (data.groups && data.groups.length) {
                data.groups.forEach(g => {
                    renderGroupHeader(g);
                    g.rows.forEach(renderRow);
                });
            } else {
                (data.rows || []).forEach(renderRow);
            }

            // Totals
            doc.moveDown(0.3);
            doc.moveTo(startX, doc.y).lineTo(startX + pageW, doc.y).stroke();
            doc.moveDown(0.3);
            const ty = doc.y;
            let tx = startX;
            doc.font('Helvetica-Bold').fontSize(9);
            colDefs.forEach((c, i) => {
                if (i === 0) {
                    doc.text('TOTALES', tx, ty, { width: c.w, align: 'left' });
                } else if (c.format === 'money') {
                    const total = data.rows.reduce((s, r) => s + (parseFloat(r[c.accessor || c.label]) || 0), 0);
                    doc.text(fmtVal(total), tx, ty, { width: c.w, align: 'right' });
                }
                tx += c.w;
            });

            doc.moveDown(2);
            doc.fontSize(7).fillColor('#94a3b8').font('Helvetica').text(
                `Generado el ${new Date().toLocaleString('es-SV')}`, { align: 'center' }
            );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateFuelInventoryPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, layout: 'landscape', size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const fmtDate = (d) => {
                if (!d) return '—';
                if (typeof d === 'string' && d.length >= 10) return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
                const dt = new Date(d);
                return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
            };
            const fmtVal = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
            const fmtGal = (v) => parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            // Header
            doc.fontSize(13).font('Helvetica-Bold').text(data.company?.razon_social || data.company_name || '', { align: 'left' });
            doc.fontSize(8).font('Helvetica').text(`Sucursal: ${data.branch_name || 'Todas'}`);
            doc.fontSize(8).text(`Período: ${fmtDate(data.start_date)} — ${fmtDate(data.end_date)}`);
            doc.fontSize(8).text(`Inventario Inicial: ${fmtGal(data.inventario_inicial || 0)} gal`);
            doc.moveDown(0.2);
            doc.fontSize(11).font('Helvetica-Bold').text(`INVENTARIO ${data.fuel_label || 'COMBUSTIBLE'}`, { align: 'center', underline: true });
            doc.moveDown(0.3);

            const startX = 20;
            const pageW = 802;

            // Column definitions — single-line labels only
            const colDefs = [
                { label: 'FECHA', w: 52, accessor: 'fecha', format: 'date', align: 'center', group: 'FECHA' },
                { label: 'V.AUTO', w: 36, accessor: 'venta_auto', format: 'gal', align: 'right', group: 'VENTA' },
                { label: 'V.FULL', w: 36, accessor: 'venta_full', format: 'gal', align: 'right', group: 'VENTA' },
                { label: 'V.MSTR', w: 36, accessor: 'venta_master', format: 'gal', align: 'right', group: 'VENTA' },
                { label: 'INVENTARIO', w: 46, accessor: 'inventario', format: 'gal', align: 'right', group: 'INV.' },
                { label: 'P.AUTO', w: 32, accessor: 'precio_auto', format: 'money', align: 'right', group: 'PRECIO' },
                { label: 'P.FULL', w: 32, accessor: 'precio_full', format: 'money', align: 'right', group: 'PRECIO' },
                { label: 'P.MSTR', w: 32, accessor: 'precio_master', format: 'money', align: 'right', group: 'PRECIO' },
                { label: 'COSTO', w: 30, accessor: 'costo', format: 'money', align: 'right', group: 'COSTO' },
                { label: 'M.AUTO', w: 32, accessor: 'margen_auto', format: 'money', align: 'right', group: 'MARGEN' },
                { label: 'M.FULL', w: 32, accessor: 'margen_full', format: 'money', align: 'right', group: 'MARGEN' },
                { label: 'M.MSTR', w: 32, accessor: 'margen_master', format: 'money', align: 'right', group: 'MARGEN' },
                { label: 'UTIL.TOT', w: 32, accessor: 'utilidad_total', format: 'money', align: 'right', group: 'UTILIDAD' },
                { label: 'U.AUTO', w: 32, accessor: 'utilidad_auto', format: 'money', align: 'right', group: 'UTILIDAD' },
                { label: 'U.FULL', w: 32, accessor: 'utilidad_full', format: 'money', align: 'right', group: 'UTILIDAD' },
                { label: 'U.MSTR', w: 32, accessor: 'utilidad_master', format: 'money', align: 'right', group: 'UTILIDAD' },
                { label: 'M.TOTAL', w: 32, accessor: 'margen_total', format: 'money', align: 'right', group: 'MG.TOT' },
                { label: 'REC.MAN', w: 34, accessor: 'recarga_manual', format: 'gal', align: 'right', group: 'RECARGA' },
                { label: 'REC.COM', w: 34, accessor: 'recarga_compra', format: 'gal', align: 'right', group: 'RECARGA' },
                { label: 'DIF.DIA', w: 34, accessor: 'dif_diaria', format: 'gal', align: 'right', group: 'DIF.DIA' },
                { label: 'T.VENTA', w: 38, accessor: 'total_venta', format: 'gal', align: 'right', group: 'TOT.VENTA' },
                { label: 'P.PROM.', w: 38, accessor: 'precio_promedio', format: 'money', align: 'right', group: 'P.PROM.' }
            ];

            // Unique groups with span
            const groups = [];
            for (const c of colDefs) {
                if (!groups.find(g => g.label === c.group)) {
                    const span = colDefs.filter(x => x.group === c.group).reduce((s, x) => s + x.w, 0);
                    groups.push({ label: c.group, w: span });
                }
            }

            const drawTableHeader = () => {
                const headerY = doc.y;

                // Group header row background
                doc.rect(startX, headerY, pageW, 16).fill('#f1f5f9');
                doc.fontSize(6).font('Helvetica-Bold').fillColor('#334155');
                let gx = startX;
                groups.forEach(g => {
                    doc.text(g.label, gx, headerY + 4, { width: g.w, align: 'center' });
                    gx += g.w;
                });

                // Divider after groups
                doc.fillColor('#cbd5e1');
                doc.moveTo(startX, headerY + 16).lineTo(startX + pageW, headerY + 16).stroke();

                // Column headers row background
                const colY = headerY + 17;
                doc.rect(startX, colY, pageW, 16).fill('#f8fafc');
                doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#475569');
                let cx = startX;
                colDefs.forEach(c => {
                    doc.text(c.label, cx, colY + 4, { width: c.w, align: 'center' });
                    cx += c.w;
                });

                // Bottom divider
                doc.fillColor('#94a3b8');
                doc.moveTo(startX, colY + 16).lineTo(startX + pageW, colY + 16).stroke();
                doc.y = colY + 18;
            };

            drawTableHeader();

            const rows = data.rows || [];

            rows.forEach((row, i) => {
                if (doc.y > 495) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                let x = startX;
                doc.fontSize(6).font('Helvetica');
                if (i % 2 === 0) {
                    doc.rect(startX, y, pageW, 13).fill('#f8fafc');
                }
                doc.fillColor('#1e293b');
                colDefs.forEach(c => {
                    const val = row[c.accessor];
                    if (c.format === 'money') {
                        doc.text(fmtVal(val), x, y + 2, { width: c.w, align: 'right' });
                    } else if (c.format === 'date') {
                        doc.text(fmtDate(val), x, y + 2, { width: c.w, align: 'center' });
                    } else {
                        doc.text(fmtGal(val), x, y + 2, { width: c.w, align: 'right' });
                    }
                    x += c.w;
                });
                doc.y = y + 13;
            });

            // Totals
            if (rows.length > 0) {
                doc.moveDown(0.2);
                doc.rect(startX, doc.y, pageW, 1).fill('#64748b');
                doc.moveDown(0.1);
                const ty = doc.y;
                let tx = startX;
                doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#1e293b');
                colDefs.forEach((c, i) => {
                    if (i === 0) {
                        doc.text('TOTALES', tx, ty + 2, { width: c.w, align: 'left' });
                    } else if (c.format === 'money') {
                        const total = rows.reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0);
                        doc.text(fmtVal(total), tx, ty + 2, { width: c.w, align: 'right' });
                    } else {
                        const total = rows.reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0);
                        doc.text(fmtGal(total), tx, ty + 2, { width: c.w, align: 'right' });
                    }
                    tx += c.w;
                });
                doc.moveDown(1.5);
            }

            doc.fontSize(6.5).fillColor('#94a3b8').font('Helvetica').text(
                `Generado el ${new Date().toLocaleString('es-SV')}`, { align: 'center' }
            );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

const generateGalonajeVendidoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 20, layout: 'landscape', size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const fmtDate = (d) => {
                if (!d) return '—';
                if (typeof d === 'string' && d.length >= 10) return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
                const dt = new Date(d);
                return `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`;
            };
            const fmtGal = (v) => parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            doc.fontSize(13).font('Helvetica-Bold').text(data.company?.razon_social || data.company_name || '', { align: 'left' });
            doc.fontSize(8).font('Helvetica').text(`Sucursal: ${data.branch_name || 'Todas'}`);
            doc.fontSize(8).text(`Período: ${fmtDate(data.start_date)} — ${fmtDate(data.end_date)}`);
            doc.moveDown(0.2);
            doc.fontSize(11).font('Helvetica-Bold').text('GALONAJE VENDIDO', { align: 'center', underline: true });
            doc.moveDown(0.3);

            const startX = 20;
            const pageW = 802;

            const colDefs = [
                { label: 'FECHA', w: 60, accessor: 'fecha', format: 'date', align: 'center', group: 'FECHA' },
                { label: 'LECTURA', w: 55, accessor: 'lect_diesel', format: 'gal', align: 'right', group: 'DIESEL' },
                { label: 'VENTA', w: 55, accessor: 'vta_diesel', format: 'gal', align: 'right', group: 'DIESEL' },
                { label: 'DIF.', w: 55, accessor: 'dif_diesel', format: 'gal', align: 'right', group: 'DIESEL' },
                { label: 'LECTURA', w: 55, accessor: 'lect_regular', format: 'gal', align: 'right', group: 'REGULAR' },
                { label: 'VENTA', w: 55, accessor: 'vta_regular', format: 'gal', align: 'right', group: 'REGULAR' },
                { label: 'DIF.', w: 55, accessor: 'dif_regular', format: 'gal', align: 'right', group: 'REGULAR' },
                { label: 'LECTURA', w: 55, accessor: 'lect_super', format: 'gal', align: 'right', group: 'SUPER' },
                { label: 'VENTA', w: 55, accessor: 'vta_super', format: 'gal', align: 'right', group: 'SUPER' },
                { label: 'DIF.', w: 55, accessor: 'dif_super', format: 'gal', align: 'right', group: 'SUPER' },
                { label: 'LECTURA', w: 55, accessor: 'lect_ion_diesel', format: 'gal', align: 'right', group: 'ION DIESEL' },
                { label: 'VENTA', w: 55, accessor: 'vta_ion_diesel', format: 'gal', align: 'right', group: 'ION DIESEL' },
                { label: 'DIF.', w: 55, accessor: 'dif_ion_diesel', format: 'gal', align: 'right', group: 'ION DIESEL' },
            ];

            const groups = [];
            for (const c of colDefs) {
                if (!groups.find(g => g.label === c.group)) {
                    const span = colDefs.filter(x => x.group === c.group).reduce((s, x) => s + x.w, 0);
                    groups.push({ label: c.group, w: span });
                }
            }

            const groupColors = {
                'FECHA': { headerBg: null, colHeaderBg: null },
                'DIESEL': { headerBg: '#e0e7ff', colHeaderBg: '#eef2ff', textColor: '#4338ca' },
                'REGULAR': { headerBg: '#dcfce7', colHeaderBg: '#f0fdf4', textColor: '#15803d' },
                'SUPER': { headerBg: '#fed7aa', colHeaderBg: '#fff7ed', textColor: '#c2410c' },
                'ION DIESEL': { headerBg: '#fae8ff', colHeaderBg: '#fdf4ff', textColor: '#a21caf' },
            };

            const drawTableHeader = () => {
                const headerY = doc.y;

                let gx = startX;
                groups.forEach(g => {
                    const colors = groupColors[g.label] || {};
                    if (colors.headerBg) {
                        doc.rect(gx, headerY, g.w, 16).fill(colors.headerBg);
                    }
                    gx += g.w;
                });
                gx = startX;
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b');
                groups.forEach(g => {
                    doc.text(g.label, gx, headerY + 4, { width: g.w, align: 'center' });
                    gx += g.w;
                });
                doc.fillColor('#94a3b8');
                doc.moveTo(startX, headerY + 16).lineTo(startX + pageW, headerY + 16).stroke();

                const colY = headerY + 17;
                let cx = startX;
                colDefs.forEach(c => {
                    const colors = groupColors[c.group] || {};
                    if (colors.colHeaderBg) {
                        doc.rect(cx, colY, c.w, 16).fill(colors.colHeaderBg);
                    }
                    cx += c.w;
                });
                cx = startX;
                doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#1e293b');
                colDefs.forEach(c => {
                    doc.text(c.label, cx, colY + 4, { width: c.w, align: 'center' });
                    cx += c.w;
                });
                doc.fillColor('#94a3b8');
                doc.moveTo(startX, colY + 16).lineTo(startX + pageW, colY + 16).stroke();

                doc.fillColor('#cbd5e1');
                gx = startX;
                groups.forEach(g => {
                    if (g.label !== 'FECHA') {
                        doc.moveTo(gx, headerY).lineTo(gx, colY + 16).stroke();
                    }
                    gx += g.w;
                });

                doc.y = colY + 18;
            };

            drawTableHeader();

            const rows = data.rows || [];
            rows.forEach((row, i) => {
                if (doc.y > 495) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                doc.fontSize(6.5).font('Helvetica');

                let x = startX;
                colDefs.forEach(c => {
                    const colors = groupColors[c.group] || {};
                    const baseTint = i % 2 === 0 ? 0 : 0;
                    if (colors.colHeaderBg) {
                        const alpha = baseTint ? 1 : 0.5;
                        doc.rect(x, y, c.w, 13).fill(colors.colHeaderBg);
                    } else if (i % 2 === 0) {
                        doc.rect(x, y, c.w, 13).fill('#f8fafc');
                    }
                    x += c.w;
                });

                x = startX;
                doc.fillColor('#1e293b');
                colDefs.forEach(c => {
                    const val = row[c.accessor];
                    const colors = groupColors[c.group] || {};
                    if (c.accessor.startsWith('dif_')) {
                        doc.fillColor(colors.textColor || '#1e293b');
                    } else {
                        doc.fillColor('#1e293b');
                    }
                    if (c.format === 'date') {
                        doc.text(fmtDate(val), x, y + 2, { width: c.w, align: 'center' });
                    } else {
                        doc.text(fmtGal(val), x, y + 2, { width: c.w, align: 'right' });
                    }
                    x += c.w;
                });

                doc.fillColor('#e2e8f0');
                let sx = startX;
                groups.forEach(g => {
                    if (g.label !== 'FECHA') {
                        doc.moveTo(sx, y).lineTo(sx, y + 13).stroke();
                    }
                    sx += g.w;
                });

                doc.y = y + 13;
            });

            if (rows.length > 0) {
                doc.moveDown(0.2);
                doc.rect(startX, doc.y, pageW, 1).fill('#64748b');
                doc.moveDown(0.1);

                const ty = doc.y;

                let tx = startX;
                colDefs.forEach(c => {
                    const colors = groupColors[c.group] || {};
                    if (colors.colHeaderBg) {
                        doc.rect(tx, ty, c.w, 16).fill(colors.colHeaderBg);
                    } else {
                        doc.rect(tx, ty, c.w, 16).fill('#f8fafc');
                    }
                    tx += c.w;
                });

                tx = startX;
                doc.font('Helvetica-Bold').fontSize(7);
                colDefs.forEach((c, i) => {
                    const colors = groupColors[c.group] || {};
                    if (c.accessor && c.accessor.startsWith('dif_')) {
                        doc.fillColor(colors.textColor || '#1e293b');
                    } else {
                        doc.fillColor('#1e293b');
                    }
                    if (i === 0) {
                        doc.text('TOTALES', tx, ty + 2, { width: c.w, align: 'left' });
                    } else {
                        const total = rows.reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0);
                        doc.text(fmtGal(total), tx, ty + 2, { width: c.w, align: 'right' });
                    }
                    tx += c.w;
                });

                doc.fillColor('#cbd5e1');
                let sxt = startX;
                groups.forEach(g => {
                    if (g.label !== 'FECHA') {
                        doc.moveTo(sxt, ty).lineTo(sxt, ty + 16).stroke();
                    }
                    sxt += g.w;
                });

                doc.y = ty + 16;

                doc.moveDown(0.6);
                doc.rect(startX, doc.y, pageW, 1).fill('#e2e8f0');
                doc.moveDown(0.4);

                const tdTotal = (data.diferencias?.total || 0);
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
                doc.text(`DIFERENCIA TOTAL: ${fmtGal(tdTotal)} galones`, startX, doc.y, { width: pageW, align: 'center' });
                doc.moveDown(1.5);
            }

            doc.fontSize(6.5).fillColor('#94a3b8').font('Helvetica').text(
                `Generado el ${new Date().toLocaleString('es-SV')}`, { align: 'center' }
            );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
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
            const doc = new PDFDocument({ margin: 30, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 30;
            const W = 552;
            const quincenaLabel = data.quincena === 'primera' ? '1ra' : '2da';
            const mesLabel = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][(data.periodo_mes || 1) - 1] || '';
            const mesAnio = `${mesLabel} ${data.periodo_anio}`;
            const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`;
            const logoPath = data.logo_url;
            const firmaPath = data.firma_url || '';
            const selloPath = data.sello_url || '';
            const responsable = data.responsable_nombre || 'RECURSOS HUMANOS';
            const fmt = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '';

            const percepciones = (data.detalles || []).filter(d => d.operacion === 'sumar');
            const deducciones = (data.detalles || []).filter(d => d.operacion === 'restar');

            const drawCopy = (yStart, label) => {
                let y = yStart;

                // Logo + company
                if (logoPath) {
                    try {
                        const f = logoPath.split('/').pop();
                        const p = path.join(__dirname, '..', '..', 'uploads', f);
                        if (fs.existsSync(p)) doc.image(p, M, y, { width: 65 });
                    } catch (e) { /* ignore */ }
                }
                const hx = logoPath ? 105 : M;
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text(data.company_name?.toUpperCase() || '', hx, y);
                doc.fontSize(7).font('Helvetica');
                doc.text(data.company_nit ? `NIT: ${data.company_nit}` : '', hx, y + 11);
                y += 22;

                // Title
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('RECIBO DE PLANILLA QUINCENAL', M, y, { width: W, align: 'center' });
                y += 11;
                doc.moveTo(M, y).lineTo(M + W, y).stroke('#4f46e5');
                y += 6;

                // Employee info
                doc.fontSize(7).font('Helvetica');
                doc.text('EMPLEADO:', M, y);
                doc.text('PERIODO:', M + 200, y);
                doc.text('MONTO A RECIBIR:', M + 370, y);
                y += 9;
                doc.font('Helvetica-Bold');
                doc.text(empName, M, y);
                doc.text(`${mesAnio} - ${quincenaLabel} Q.`, M + 200, y);
                doc.fillColor('#4f46e5');
                doc.text(`$ ${parseFloat(data.monto_recibir).toFixed(2)}`, M + 370, y, { align: 'right', width: 180 });
                doc.fillColor('black');
                y += 10;
                doc.font('Helvetica');
                doc.text(`CARGO: ${data.cargo_nombre || ''}`, M, y);
                doc.text(`DIAS: ${data.dias_trabajados || 0}`, M + 200, y);
                y += 9;
                doc.text(`DPTO: ${data.departamento_nombre || ''}`, M, y);
                doc.text(`SUELDO BASE: $ ${parseFloat(data.sueldo_base || 0).toFixed(2)}`, M + 200, y);
                y += 9;
                doc.text(`DUI: ${data.num_dui || ''}`, M, y);
                doc.text(`INGRESO: ${fmt(data.fecha_ingreso)}`, M + 200, y);
                y += 9;
                doc.text(`NIT: ${data.num_nit || ''}`, M, y);
                y += 4;

                // Seccionador
                doc.moveTo(M, y).lineTo(M + W, y).stroke('#e5e7eb');
                y += 6;

                // Two columns: left=PERCEPCIONES, right=DEDUCCIONES
                const leftX = M + 5;
                const rightX = M + 290;
                const leftValX = M + 250;
                const rightValX = M + W - 5;
                const colW = 270;
                const rowH = 11;

                // Column headers
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text('PERCEPCIONES', leftX, y);
                doc.text('DEDUCCIONES', rightX, y);
                doc.fillColor('black');
                y += 10;
                doc.moveTo(leftX, y).lineTo(leftValX, y).stroke('#e5e7eb');
                doc.moveTo(rightX, y).lineTo(rightValX, y).stroke('#e5e7eb');
                y += 3;

                doc.fontSize(7).font('Helvetica');

                // Left: percepciones
                let percY = y;
                for (const p of percepciones) {
                    doc.text(`${p.codigo} - ${p.descripcion}`, leftX, percY);
                    doc.text(`$ ${parseFloat(p.valor_ingresado || 0).toFixed(2)}`, leftValX, percY, { align: 'right' });
                    percY += rowH;
                }
                doc.moveTo(leftX, percY).lineTo(leftValX, percY).stroke('#e5e7eb');
                percY += 3;
                doc.font('Helvetica-Bold');
                doc.text('TOTAL PERCEPCIONES', leftX, percY);
                doc.text(`$ ${parseFloat(data.total_percepciones || 0).toFixed(2)}`, leftValX, percY, { align: 'right' });
                percY += 14;

                // Right: deducciones de ley section
                let dedY = y;
                doc.font('Helvetica-Bold');
                doc.text('RETENCIONES DE LEY:', rightX, dedY);
                doc.font('Helvetica');
                dedY += rowH;
                const isssPct = data.isss_porcentaje || 0;
                const afpPct = data.afp_porcentaje || 0;
                doc.text(`ISSS (${isssPct}%)`, rightX, dedY);
                doc.text(`$ ${parseFloat(data.descuento_isss || 0).toFixed(2)}`, rightValX, dedY, { align: 'right' });
                dedY += rowH;
                doc.text(`AFP (${afpPct}%)`, rightX, dedY);
                doc.text(`$ ${parseFloat(data.descuento_afp || 0).toFixed(2)}`, rightValX, dedY, { align: 'right' });
                dedY += rowH;
                doc.text('RENTA', rightX, dedY);
                doc.text(`$ ${parseFloat(data.descuento_renta || 0).toFixed(2)}`, rightValX, dedY, { align: 'right' });
                dedY += rowH + 1;
                doc.moveTo(rightX, dedY).lineTo(rightValX, dedY).stroke('#e5e7eb');
                dedY += 3;

                if (deducciones.length > 0) {
                    doc.font('Helvetica-Bold');
                    doc.text('OTRAS DEDUCCIONES:', rightX, dedY);
                    doc.font('Helvetica');
                    dedY += rowH;
                    for (const d of deducciones) {
                        doc.text(`${d.codigo} - ${d.descripcion}`, rightX, dedY);
                        doc.text(`$ ${parseFloat(d.valor_ingresado || 0).toFixed(2)}`, rightValX, dedY, { align: 'right' });
                        dedY += rowH;
                    }
                    dedY += 1;
                    doc.moveTo(rightX, dedY).lineTo(rightValX, dedY).stroke('#e5e7eb');
                    dedY += 3;
                }
                doc.font('Helvetica-Bold');
                doc.text('TOTAL DEDUCCIONES', rightX, dedY);
                doc.text(`$ ${parseFloat(data.total_deducciones || 0).toFixed(2)}`, rightValX, dedY, { align: 'right' });
                dedY += 14;

                // Total general
                y = Math.max(percY, dedY) + 4;
                doc.moveTo(M, y).lineTo(M + W, y).stroke('#4f46e5');
                y += 6;
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text('MONTO A RECIBIR', leftX, y);
                doc.text(`$ ${parseFloat(data.monto_recibir || 0).toFixed(2)}`, leftValX, y, { align: 'right' });
                doc.fillColor('black');
                y += 12;
                doc.fontSize(7).font('Helvetica-Oblique');
                doc.text(`Son: ${data.monto_letras}`, leftX, y, { width: W - 10 });
                y += 16;

                // Signatures
                doc.fontSize(7).font('Helvetica');
                const sigW = 200;
                doc.moveTo(M + 20, y).lineTo(M + 20 + sigW, y).stroke('#e5e7eb');
                doc.fontSize(6).font('Helvetica-Bold').text('RECIBI CONFORME', M + 20, y + 4, { width: sigW, align: 'center' });
                doc.fontSize(7).font('Helvetica-Bold').text(empName, M, y + 20, { width: sigW + 40, align: 'center' });

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

            // Top copy - Empleado
            drawCopy(30, 'COPIA EMPLEADO');

            // Page middle divider
            const PAGE_MID = 396;
            doc.moveTo(30, PAGE_MID - 4).lineTo(30 + 552, PAGE_MID - 4).stroke('#e5e7eb');

            // Bottom copy - Empresa
            drawCopy(PAGE_MID, 'ORIGINAL EMPRESA');

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
const generateArqueosReportPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, layout: 'landscape', size: 'A4' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name, { align: 'left' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`);
            doc.text(`Período: ${data.start_date} al ${data.end_date}`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text('REPORTE DE ARQUEOS (CORTES DE CAJA)', { align: 'center', underline: true });
            doc.moveDown();

            const startX = 20;
            const colWidths = {
                fecha: 62, turno: 25, sucursal: 75, pos: 65, vendedor: 70, estado: 42,
                fondo: 45, ventas: 50, ingresos: 38, gastos: 38, remesas: 38, puntos: 32,
                esperado: 55, contado: 55, diferencia: 50
            };
            const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

            const drawTableHeader = () => {
                const y = doc.y;
                doc.fontSize(7).font('Helvetica-Bold');
                let x = startX;
                doc.text('Fecha', x, y); x += colWidths.fecha;
                doc.text('#', x, y); x += colWidths.turno;
                doc.text('Sucursal', x, y); x += colWidths.sucursal;
                doc.text('POS', x, y); x += colWidths.pos;
                doc.text('Vendedor', x, y); x += colWidths.vendedor;
                doc.text('Estado', x, y); x += colWidths.estado;
                doc.text('Fondo', x, y, { align: 'right', width: colWidths.fondo }); x += colWidths.fondo;
                doc.text('Ventas', x, y, { align: 'right', width: colWidths.ventas }); x += colWidths.ventas;
                doc.text('Ingresos', x, y, { align: 'right', width: colWidths.ingresos }); x += colWidths.ingresos;
                doc.text('Gastos', x, y, { align: 'right', width: colWidths.gastos }); x += colWidths.gastos;
                doc.text('Remesas', x, y, { align: 'right', width: colWidths.remesas }); x += colWidths.remesas;
                doc.text('Puntos', x, y, { align: 'right', width: colWidths.puntos }); x += colWidths.puntos;
                doc.text('Esperado', x, y, { align: 'right', width: colWidths.esperado }); x += colWidths.esperado;
                doc.text('Contado', x, y, { align: 'right', width: colWidths.contado }); x += colWidths.contado;
                doc.text('Diferencia', x, y, { align: 'right', width: colWidths.diferencia });
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
                doc.moveDown(0.5);
                doc.font('Helvetica').fontSize(6.5);
            };

            drawTableHeader();

            const formatVal = (val) => `$${parseFloat(val || 0).toFixed(2)}`;

            (data.data || []).forEach(r => {
                if (doc.y > 520) {
                    doc.addPage();
                    drawTableHeader();
                }
                const y = doc.y;
                let x = startX;
                doc.text(r.fecha || '---', x, y, { width: colWidths.fecha }); x += colWidths.fecha;
                doc.text(r.turno || '---', x, y, { width: colWidths.turno }); x += colWidths.turno;
                doc.text(r.sucursal || '---', x, y, { width: colWidths.sucursal }); x += colWidths.sucursal;
                doc.text(r.pos || '---', x, y, { width: colWidths.pos }); x += colWidths.pos;
                doc.text(r.vendedor || '---', x, y, { width: colWidths.vendedor }); x += colWidths.vendedor;
                doc.text(r.estado || '---', x, y, { width: colWidths.estado }); x += colWidths.estado;
                doc.text(formatVal(r.fondo), x, y, { align: 'right', width: colWidths.fondo }); x += colWidths.fondo;
                doc.text(formatVal(r.ventas), x, y, { align: 'right', width: colWidths.ventas }); x += colWidths.ventas;
                doc.text(formatVal(r.ingresos), x, y, { align: 'right', width: colWidths.ingresos }); x += colWidths.ingresos;
                doc.text(formatVal(r.gastos), x, y, { align: 'right', width: colWidths.gastos }); x += colWidths.gastos;
                doc.text(formatVal(r.remesas), x, y, { align: 'right', width: colWidths.remesas }); x += colWidths.remesas;
                doc.text(formatVal(r.puntos), x, y, { align: 'right', width: colWidths.puntos }); x += colWidths.puntos;
                doc.text(formatVal(r.esperado), x, y, { align: 'right', width: colWidths.esperado }); x += colWidths.esperado;
                doc.text(formatVal(r.contado), x, y, { align: 'right', width: colWidths.contado }); x += colWidths.contado;
                doc.text(formatVal(r.diferencia), x, y, { align: 'right', width: colWidths.diferencia });
                doc.moveDown(0.7);
            });

            doc.moveDown();
            doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y).stroke();
            doc.moveDown(1);

            doc.font('Helvetica-Bold').fontSize(7);
            const totalsY = doc.y;
            let tX = startX + colWidths.fecha + colWidths.turno + colWidths.sucursal + colWidths.pos + colWidths.vendedor + colWidths.estado;
            doc.text('TOTALES', startX, totalsY, { width: colWidths.fecha + colWidths.turno + colWidths.sucursal + colWidths.pos + colWidths.vendedor + colWidths.estado });
            doc.text(formatVal(data.totales?.fondo), tX, totalsY, { align: 'right', width: colWidths.fondo }); tX += colWidths.fondo;
            doc.text(formatVal(data.totales?.ventas), tX, totalsY, { align: 'right', width: colWidths.ventas }); tX += colWidths.ventas;
            doc.text(formatVal(data.totales?.ingresos), tX, totalsY, { align: 'right', width: colWidths.ingresos }); tX += colWidths.ingresos;
            doc.text(formatVal(data.totales?.gastos), tX, totalsY, { align: 'right', width: colWidths.gastos }); tX += colWidths.gastos;
            doc.text(formatVal(data.totales?.remesas), tX, totalsY, { align: 'right', width: colWidths.remesas }); tX += colWidths.remesas;
            doc.text(formatVal(data.totales?.puntos), tX, totalsY, { align: 'right', width: colWidths.puntos }); tX += colWidths.puntos;
            doc.text(formatVal(data.totales?.esperado), tX, totalsY, { align: 'right', width: colWidths.esperado }); tX += colWidths.esperado;
            doc.text(formatVal(data.totales?.contado), tX, totalsY, { align: 'right', width: colWidths.contado }); tX += colWidths.contado;
            doc.text(formatVal(data.totales?.diferencia), tX, totalsY, { align: 'right', width: colWidths.diferencia });

            doc.end();
        } catch (err) { reject(err); }
    });
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
    generatePlanillaPDF,
    generatePlanillaReciboPDF,
    generateArqueosReportPDF
};
