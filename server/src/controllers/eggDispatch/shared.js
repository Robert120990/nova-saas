const eggStock = require('../../services/eggStock.service');
const { emitSavedSale } = require('../../services/eggDispatchEmission.service');
const pool = require('../../config/db');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../../services/excel.service');
const dteService = require('../../services/dte.service');
const mailerService = require('../../services/mailer.service');
const { getSaleRTEEPdfBuffer } = require('../sales.controller');
const { PDFDocument } = require('pdf-lib');
const { resolveEggCatalogProduct, parseDefaultPresentationWeightLbs } = require('../../utils/eggProductResolver');
const eggReturnableService = require('../../services/eggReturnableService');
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
const getPresentationWeightLbs = (presentation) => {
    if (!presentation) return 30;
    const clean = String(presentation).toLowerCase().trim();
    const m = clean.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
    if (m) return parseFloat(m[1]) || 30;
    if (clean.includes('galon') || clean.includes('galón')) return 8;
    if (clean.includes('litro')) return 2;
    if (clean.includes('medio galon') || clean.includes('medio galón')) return 4;
    if (clean.includes('carton') || clean.includes('cartón')) return 55;
    if (clean.includes('caja')) return 32;
    if (clean.includes('bolsa')) return 5;
    if (clean.includes('tanque')) return 2000;
    return 30;
};
module.exports = { eggStock, emitSavedSale, pool, reportPdfHelper, excelService, dteService, mailerService, getSaleRTEEPdfBuffer, PDFDocument, resolveEggCatalogProduct, parseDefaultPresentationWeightLbs, eggReturnableService, safeNum, safeInt, getPresentationWeightLbs };
