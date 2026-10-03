const pool = require('../../config/db');
const PDFDocument = require('pdfkit');
const { generatePlanillaPDF, generatePlanillaReciboPDF } = require('../../services/pdf.service');
const { numberToWords } = require('../../utils/numberToWords');
const notificationService = require('../../services/notification.service');

const TABLE = 'rh_planillas';
const LABEL = 'Planilla';

const MESES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const isBonificacionCuenta = (c) => {
    return c.codigo === '02' || (c.descripcion || '').toUpperCase().includes('BONIF');
};

const parseIdList = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(Number).filter(n => !isNaN(n) && n > 0);
    return String(val).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
};

module.exports = { pool, PDFDocument, generatePlanillaPDF, generatePlanillaReciboPDF, numberToWords, notificationService, TABLE, LABEL, MESES, isBonificacionCuenta, parseIdList };
