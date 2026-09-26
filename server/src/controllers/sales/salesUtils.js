const mailerService = require('../../services/mailer.service');
const pool = require('../../config/db');
const dteService = require('../../services/dte.service');
const pdfService = require('../../services/pdf.service');
const aiService = require('../../services/ai.service');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getEffectiveProductId, getLubricantCategoryIds, isLubricantProduct } = require('../../utils/inventoryUtils');
const excelService = require('../../services/excel.service');
const notificationService = require('../../services/notification.service');
const { dteValidoExistsSql, dteLatestColSql } = require('../../services/dteQueryFilters');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const { validateDocumentNumber, isValidDocumentNumber } = require('../../utils/svfeValidators');

const dteTypeNames = {
    '01': 'Factura',
    '03': 'Crédito Fiscal',
    '04': 'Nota de Remisión',
    '05': 'Nota de Crédito',
    '06': 'Nota de Débito',
    '07': 'Comprobante de Retención',
    '08': 'Comprobante de Liquidación',
    '09': 'Documento Contable de Liquidación',
    '11': 'Factura de Exportación',
    '14': 'Factura de Sujeto Excluido',
    '15': 'Comprobante de Donación'
};

function getDteTypeName(tipoDte) {
    return dteTypeNames[tipoDte] || 'Documento Tributario';
}

const FALLBACK_ACTIVIDAD = new Set(['otros', 'otro', 'actividad no definida', 'n/a', '']);

async function resolveActividadOficial(codActividad, descActividad) {
    const desc = (descActividad || '').trim();
    if (!FALLBACK_ACTIVIDAD.has(desc.toLowerCase())) return desc;
    if (!codActividad) return desc;
    try {
        const [rows] = await pool.query('SELECT description FROM cat_019_actividad_economica WHERE code = ?', [String(codActividad).trim()]);
        return rows.length > 0 ? rows[0].description : desc;
    } catch (e) {
        return desc;
    }
}

/**
 * Procesa una nueva venta junto con sus ítems, pagos y documentos vinculados.
 * Maneja la reducción de inventario y el registro en el Kardex.
 */

module.exports = {
    mailerService,
    pool,
    dteService,
    pdfService,
    aiService,
    path,
    fs,
    jwt,
    getEffectiveProductId,
    getLubricantCategoryIds,
    isLubricantProduct,
    excelService,
    notificationService,
    dteValidoExistsSql,
    dteLatestColSql,
    reportPdfHelper,
    validateDocumentNumber,
    isValidDocumentNumber,
    dteTypeNames,
    getDteTypeName,
    FALLBACK_ACTIVIDAD,
    resolveActividadOficial
};
