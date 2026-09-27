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
module.exports = { pool, nodemailer, broadcastToCompany, notificationService, eggExportService, eggReportsExportService, eggQualityLetterExport, eggRawMaterialLabReport, eggOriginCertificate, reportPdfHelper, excelService, resolveEggCatalogProduct, safeNum, safeInt, computeJulianLotCode };
