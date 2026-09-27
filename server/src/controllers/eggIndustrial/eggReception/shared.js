const { owned, fail, number } = require('../../../services/eggRules.service');
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
module.exports = { owned, fail, number, pool, nodemailer, broadcastToCompany, notificationService, eggExportService, eggReportsExportService, eggQualityLetterExport, eggRawMaterialLabReport, eggOriginCertificate, reportPdfHelper, excelService, resolveEggCatalogProduct, safeNum, safeInt, computeJulianLotCode };
