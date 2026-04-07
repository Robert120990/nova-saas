/**
 * PDF Generation Service
 */

const PDFDocument = require('pdfkit');
const qr = require('qr-image');
const fs = require('fs');
const path = require('path');

async function generateDTEPDF(dteData, stream) {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(stream);

    const { identificacion, emisor, receptor, cuerpoDocumento, resumen } = dteData;

    // Header
    doc.fontSize(16).text(emisor.nombre, { align: 'center', bold: true });
    doc.fontSize(10).text(`NIT: ${emisor.nit} | NRC: ${emisor.nrc}`, { align: 'center' });
    doc.text(emisor.direccion.complemento, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('COMPROBANTE DE CRÉDITO FISCAL ELECTRÓNICO', { align: 'center', color: 'blue' });
    doc.fontSize(10).text(`Código de Generación: ${identificacion.codigoGeneracion}`, { align: 'center' });
    doc.text(`Número de Control: ${identificacion.numeroControl}`, { align: 'center' });
    doc.moveDown();

    // Receptor info
    doc.fontSize(12).text('RECEPTOR:', { underline: true });
    doc.fontSize(10).text(`Nombre: ${receptor.nombre}`);
    doc.text(`NIT/NRC: ${receptor.nit || ''} / ${receptor.nrc || ''}`);
    doc.text(`Dirección: ${receptor.direccion ? receptor.direccion.complemento : 'N/A'}`);
    doc.moveDown();

    // Table Header
    const tableTop = 250;
    doc.fontSize(10).text('Cant.', 50, tableTop);
    doc.text('Descripción', 100, tableTop);
    doc.text('P. Unit', 350, tableTop, { width: 50, align: 'right' });
    doc.text('IVA', 410, tableTop, { width: 50, align: 'right' });
    doc.text('Monto', 480, tableTop, { width: 50, align: 'right' });
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Items
    let y = tableTop + 25;
    cuerpoDocumento.forEach(item => {
        doc.text(item.cantidad.toString(), 50, y);
        doc.text(item.descripcion, 100, y, { width: 240 });
        doc.text(item.precioUnitario.toFixed(2), 350, y, { width: 50, align: 'right' });
        doc.text(item.ivaItem.toFixed(2), 410, y, { width: 50, align: 'right' });
        doc.text((item.ventaGravada || item.ventaExenta || item.ventaNoSuj).toFixed(2), 480, y, { width: 50, align: 'right' });
        y += 20;
    });

    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;

    // Totals
    doc.text('SUBTOTAL:', 400, y);
    doc.text(resumen.subTotal.toFixed(2), 480, y, { align: 'right' });
    y += 15;
    doc.text('IVA (13%):', 400, y);
    doc.text(resumen.totalIva.toFixed(2), 480, y, { align: 'right' });
    y += 15;
    doc.fontSize(12).text('TOTAL A PAGAR:', 380, y, { bold: true });
    doc.text(`USD $${resumen.totalPagar.toFixed(2)}`, 480, y, { align: 'right', bold: true });

    // QR Code
    const qrUrl = `https://admin.factura.gob.sv/consultaPublica?ambiente=${identificacion.ambiente}&codGen=${identificacion.codigoGeneracion}&fechaEmi=${identificacion.fecEmi}`;
    const qr_png = qr.imageSync(qrUrl, { type: 'png' });
    doc.image(qr_png, 50, doc.page.height - 150, { width: 100 });

    doc.fontSize(8).text('Consulte su documento en:', 50, doc.page.height - 40);
    doc.fillColor('blue').text(qrUrl, 50, doc.page.height - 30, { link: qrUrl });

    doc.end();
}

module.exports = { generateDTEPDF };
