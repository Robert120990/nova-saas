const { evaluateLab, owned, fail } = require('../../../services/eggRules.service');
const {
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
    computeJulianLotCode
} = require('../eggUtils');
const eggReturnableService = require('../../../services/eggReturnableService');
const parseNumSafe = (val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const clean = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
};
module.exports = { evaluateLab, owned, fail, pool, nodemailer, broadcastToCompany, notificationService, eggExportService, eggReportsExportService, eggQualityLetterExport, eggRawMaterialLabReport, eggOriginCertificate, reportPdfHelper, excelService, resolveEggCatalogProduct, safeNum, safeInt, computeJulianLotCode, eggReturnableService, parseNumSafe };
