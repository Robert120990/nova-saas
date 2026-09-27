const pool = require('../../config/db');
const nodemailer = require('nodemailer');
const { broadcastToCompany } = require('../../services/websocket.service');
const notificationService = require('../../services/notification.service');
const eggExportService = require('../../services/eggProductionExport.service');
const eggReportsExportService = require('../../services/eggReportsExport.service');
const eggQualityLetterExport = require('../../services/eggQualityLetterExport.service');
const eggRawMaterialLabReport = require('../../services/eggRawMaterialLabReport.service');
const eggOriginCertificate = require('../../services/eggOriginCertificate.service');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../../services/excel.service');
const { resolveEggCatalogProduct } = require('../../utils/eggProductResolver');

// Helpers de sanitización numérica defensiva contra valores NaN / vacíos en MySQL
const safeNum = (val, fallback = 0) => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
};

const safeInt = (val, fallback = null) => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
};

// Helper oficial para cálculo de código de lote en Calendario Juliano: LOTE [Corrida 2d]-[Día Juliano 3d]-[Año 2d] (ej. LOTE 01-265-26)
const computeJulianLotCode = (productionDate, runNumber = 1) => {
    let d;
    if (!productionDate) {
        d = new Date();
    } else if (typeof productionDate === 'string') {
        const parts = productionDate.split('T')[0].split('-');
        if (parts.length === 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            d = new Date(productionDate);
        }
    } else {
        d = new Date(productionDate);
    }
    if (isNaN(d.getTime())) d = new Date();

    const yearFull = d.getFullYear();
    const year2Digit = String(yearFull).slice(-2);
    const startOfYear = new Date(yearFull, 0, 1);
    const diffMs = d.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const dayOfYearStr = String(dayOfYear).padStart(3, '0');
    const runStr = String(runNumber || 1).padStart(2, '0');
    return `LOTE ${runStr}-${dayOfYearStr}-${year2Digit}`;
};


// Auto-garantizar tablas y columnas requeridas en caliente para evitar ER_BAD_FIELD_ERROR / ER_NO_SUCH_TABLE
let schemaEnsured = false;
const ensureEggSchema = async () => {
    if (schemaEnsured) return;
    const [columns] = await pool.query("SHOW COLUMNS FROM egg_packaging_records LIKE 'dispatched_units'");
    if (!columns.length) throw new Error('Ejecute database/run_migration_v234.js antes de usar huevo industrial.');
    schemaEnsured = true;
};



module.exports = {
    pool,
    nodemailer,
    broadcastToCompany,
    notificationService,
    eggExportService,
    eggReportsExportService,
    eggQualityLetterExport,
    eggRawMaterialLabReport,
    eggOriginCertificate,
    reportPdfHelper,
    excelService,
    resolveEggCatalogProduct,
    safeNum,
    safeInt,
    computeJulianLotCode,
    ensureEggSchema
};
