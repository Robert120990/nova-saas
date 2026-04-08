const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

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

            doc.fontSize(18).text(data.company_name, { align: 'left' });
            doc.fontSize(10).text(data.branch_name, { align: 'left' });
            doc.fontSize(10).text(`Fecha: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            const title = isProvider ? 'ESTADO DE CUENTA DE PROVEEDOR' : 'ESTADO DE CUENTA DE CLIENTE';
            doc.fontSize(16).text(title, { align: 'center', underline: true });
            doc.moveDown();

            doc.fontSize(12).font('Helvetica-Bold').text(isProvider ? 'INFORMACIÓN DEL PROVEEDOR' : 'INFORMACIÓN DEL CLIENTE');
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nombre: ${isProvider ? data.provider_name : data.customer_name}`);
            doc.text(`Correo: ${isProvider ? (data.provider_email || 'N/A') : (data.customer_email || 'N/A')}`);
            doc.moveDown();

            const summaryY = doc.y;
            doc.rect(50, summaryY, 500, 40).fill('#f3f4f6').stroke('#e5e7eb');
            doc.fill('#4f46e5').fontSize(12).font('Helvetica-Bold').text('SALDO TOTAL PENDIENTE:', 70, summaryY + 12);
            doc.fontSize(14).text(`$${parseFloat(data.total_balance).toFixed(2)}`, 350, summaryY + 12, { align: 'right', width: 150 });
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
            data.movements.forEach(m => {
                const y = doc.y;
                if (y > 700) doc.addPage();
                
                const cargo = parseFloat(m.cargo || 0);
                const abono = parseFloat(m.abono || 0);
                const balance = parseFloat(m.balance || 0);

                doc.fontSize(9);
                doc.text(new Date(m.fecha).toLocaleDateString(), 50, doc.y, { width: 70 });
                doc.text(`${m.tipo} ${m.numero || ''}`, 125, doc.y, { width: 120 });
                doc.text(m.concepto, 250, doc.y, { width: 90 });
                doc.text(cargo > 0 ? `$${cargo.toFixed(2)}` : '-', 340, doc.y, { align: 'right', width: 60 });
                doc.text(abono > 0 ? `$${abono.toFixed(2)}` : '-', 410, doc.y, { align: 'right', width: 60 });
                doc.text(`$${balance.toFixed(2)}`, 490, doc.y, { align: 'right', width: 60 });
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

                doc.fontSize(8);
                doc.text(new Date(docRow.fecha).toLocaleDateString(), startX, doc.y, { width: colWidths.fecha });
                doc.text(docRow.documento, startX + colWidths.fecha, doc.y, { width: colWidths.doc });
                doc.text(docRow.tipo, startX + colWidths.fecha + colWidths.doc, doc.y, { width: colWidths.tipo });
                
                doc.text(docRow.d0_30 > 0 ? `$${parseFloat(docRow.d0_30).toFixed(2)}` : '-', startX + 220, doc.y, { align: 'right', width: colWidths.b1 });
                doc.text(docRow.d31_60 > 0 ? `$${parseFloat(docRow.d31_60).toFixed(2)}` : '-', startX + 290, doc.y, { align: 'right', width: colWidths.b2 });
                doc.text(docRow.d61_90 > 0 ? `$${parseFloat(docRow.d61_90).toFixed(2)}` : '-', startX + 360, doc.y, { align: 'right', width: colWidths.b3 });
                doc.text(docRow.d91_180 > 0 ? `$${parseFloat(docRow.d91_180).toFixed(2)}` : '-', startX + 430, doc.y, { align: 'right', width: colWidths.b4 });
                doc.text(docRow.d181_365 > 0 ? `$${parseFloat(docRow.d181_365).toFixed(2)}` : '-', startX + 500, doc.y, { align: 'right', width: colWidths.b5 });
                doc.text(docRow.d365_plus > 0 ? `$${parseFloat(docRow.d365_plus).toFixed(2)}` : '-', startX + 570, doc.y, { align: 'right', width: colWidths.b6 });
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
            doc.fontSize(10).text(`Sucursal: ${data.branch_name}`);
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

            doc.moveDown(4);

            // --- Receipt Body ---
            const bodyTop = doc.y;
            doc.rect(40, bodyTop, 532, 200).stroke('#e5e7eb');
            
            doc.fontSize(10).font('Helvetica-Bold').text('RECIBIMOS DE:', 55, bodyTop + 15);
            doc.font('Helvetica').text(data.customer_name.toUpperCase(), 150, bodyTop + 15);
            
            doc.font('Helvetica-Bold').text('LA CANTIDAD DE:', 55, bodyTop + 40);
            doc.font('Helvetica').text(`$${parseFloat(data.monto).toFixed(2)}`, 150, bodyTop + 40);
            
            doc.font('Helvetica-Bold').text('FECHA DE PAGO:', 55, bodyTop + 65);
            doc.font('Helvetica').text(new Date(data.fecha_pago).toLocaleDateString('es-SV'), 150, bodyTop + 65);

            doc.font('Helvetica-Bold').text('MÉTODO DE PAGO:', 55, bodyTop + 90);
            doc.font('Helvetica').text(data.metodo_pago.toUpperCase(), 150, bodyTop + 90);

            if (data.referencia) {
                doc.font('Helvetica-Bold').text('REFERENCIA:', 55, bodyTop + 115);
                doc.font('Helvetica').text(data.referencia.toUpperCase(), 150, bodyTop + 115);
            }

            doc.font('Helvetica-Bold').text('CONCEPTO:', 55, bodyTop + 140);
            const concepto = data.documento_aplicado 
                ? `ABONO A DOCUMENTO ${data.documento_tipo || ''} ${data.documento_aplicado}` 
                : 'ABONO A CUENTA';
            doc.font('Helvetica').text(concepto, 150, bodyTop + 140, { width: 380 });

            if (data.notas) {
                doc.font('Helvetica-Bold').text('NOTAS:', 55, bodyTop + 165);
                doc.font('Helvetica').text(data.notas, 150, bodyTop + 165, { width: 380 });
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
                fecha: 50, tipo: 65, doc: 75, cond: 45, cliente: 120,
                grav: 50, exen: 50, iva: 45, fov: 40, cot: 40, ret: 45, perc: 45, total: 60
            };

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
                doc.moveTo(startX, doc.y).lineTo(startX + 750, doc.y).stroke();
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
            doc.moveTo(startX, doc.y).lineTo(startX + 750, doc.y).stroke();
            doc.moveDown(1);
            
            // Totals row (fixed alignment)
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

            // Header
            doc.fontSize(16).font('Helvetica-Bold').text(data.company_name.toUpperCase(), { align: 'center' });
            if (data.company_nit) doc.fontSize(10).font('Helvetica').text(`NIT: ${data.company_nit}`, { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Sucursal: ${data.branch_name}`, { align: 'center' });
            doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DETALLADO DE VENTAS POR POS', { align: 'center' });
            doc.fontSize(9).font('Helvetica').text(`Periodo: ${formatDate(data.startDate)} al ${formatDate(data.endDate)}`, { align: 'center' });
            doc.moveDown(1.5);

            const startX = 30;
            const colWidths = {
                fecha: 55,
                tipo: 80,
                numero: 90,
                cond: 70,
                cliente: 180,
                fiscal: 150,
                total: 80
            };

            const drawTableHeader = (y) => {
                doc.fontSize(8).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, y); x += colWidths.fecha;
                doc.text('TIPO DOC', x, y); x += colWidths.tipo;
                doc.text('NUMERO', x, y); x += colWidths.numero;
                doc.text('CONDICION', x, y); x += colWidths.cond;
                doc.text('CLIENTE', x, y); x += colWidths.cliente;
                doc.text('FISCAL/VENDEDOR', x, y); x += colWidths.fiscal;
                doc.text('TOTAL', x, y, { align: 'right', width: colWidths.total });
                
                doc.moveDown(0.5);
                doc.moveTo(startX, doc.y).lineTo(startX + 730, doc.y).stroke();
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
                        doc.text(`SUBTOTAL ${currentPOS}:`, startX + 500, doc.y, { width: 150, align: 'right' });
                        doc.text(formatVal(posTotal), startX + 650, doc.y - 8, { width: colWidths.total, align: 'right' });
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
                
                doc.text(row.cliente_nombre || 'Consumidor Final', x, y, { width: colWidths.cliente, truncate: true }); x += colWidths.cliente;
                
                const fiscalInfo = `${row.cliente_nit || row.cliente_nrc || ''} / ${row.vendedor_nombre || ''}`.trim();
                doc.text(fiscalInfo || '---', x, y, { width: colWidths.fiscal, truncate: true }); x += colWidths.fiscal;
                
                doc.text(formatVal(row.total_pagar), x, y, { align: 'right', width: colWidths.total });

                posTotal += parseFloat(row.total_pagar || 0);
                grandTotal += parseFloat(row.total_pagar || 0);
                doc.moveDown(0.8);

                // Last row subtotal
                if (index === data.data.length - 1) {
                    doc.moveDown(0.5);
                    doc.font('Helvetica-Bold').fontSize(8);
                    doc.text(`SUBTOTAL ${currentPOS}:`, startX + 500, doc.y, { width: 150, align: 'right' });
                    doc.text(formatVal(posTotal), startX + 650, doc.y - 8, { width: colWidths.total, align: 'right' });
                }
            });

            // Grand Total Footer
            doc.moveDown(1.5);
            doc.moveTo(startX, doc.y).lineTo(startX + 730, doc.y).stroke();
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('TOTAL GENERAL:', startX + 500, doc.y, { width: 150, align: 'right' });
            doc.text(formatVal(grandTotal), startX + 650, doc.y - 10, { width: colWidths.total, align: 'right' });

            doc.end();
        } catch (err) { reject(err); }
    });
};

module.exports = { 
    generateTransferPDF, 
    generateStatementPDF, 
    generateAgingPDF,
    generateProviderStatementPDF,
    generateProviderAgingPDF,
    generateStockReportPDF,
    generateMovementsReportPDF,
    generateCustomerBalancesPDF,
    generateProviderBalancesPDF,
    generatePaymentReceiptPDF,
    generateDailySalesReportPDF,
    generateSalesByCategoryPDF,
    generateSalesByPOSPDF
};
