const PDFDocument = require('pdfkit');
const doc = new PDFDocument();

doc.fontSize(7);
const texts = [
    "Factura",
    "Crédito Fiscal",
    "Nota de Remisión",
    "Factura de Exportación",
    "CONTADO",
    "CRÉDITO"
];

texts.forEach(t => {
    console.log(`"${t}": ${doc.widthOfString(t)} pt`);
});
doc.end();
