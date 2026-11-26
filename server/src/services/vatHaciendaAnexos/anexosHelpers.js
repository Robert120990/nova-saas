const pool = require('../../config/db');
const reportPdfHelper = require('../../utils/reportPdfHelper');

const ALLOWED_TAXPAYER_INCOME_TYPES = ['1', '2', '3', '4', '5', '6', '7', '8', '12'];

// Map legacy F-07 expense document types to official MH Anexo 3 / Anexo 8 codes
const EXPENSE_TO_MH_DOC_MAP = {
    '02': '03', // Comprobante de Crédito Fiscal
    '08': '06', // Nota de Débito
    '09': '05', // Nota de Crédito
    '04': '12', // Declaración de Mercancías (Importación)
    '05': '13', // FAUCA (Internación)
    '07': '09', // Comprobante de Liquidación
    '03': '11'  // Factura de Exportación
};

// Official MH Anexo 3 allowed document types for direct purchases
const PURCHASE_ALLOWED_MH_DOCS = new Set(['03', '05', '06', '09', '11', '12', '13']);

// Central America country codes (CAT-020 / ISO) for FEX Anexo 2 routing
const CA_COUNTRY_CODES = new Set(['9483', '9501', '9504', '9505', '9506', '9507', 'GT', 'HN', 'NI', 'CR', 'PA', 'BZ']);

// Deduplicated latest DTE join per venta_id
const DTE_JOIN_SQL = `
    LEFT JOIN (
        SELECT dd.venta_id, dd.codigo_generacion, dd.numero_control, dd.status, dd.sello_recepcion, dd.json_original, dd.ambiente
        FROM dtes dd
        INNER JOIN (
            SELECT venta_id, MAX(id) AS max_id
            FROM dtes
            WHERE venta_id IS NOT NULL
            GROUP BY venta_id
        ) dm ON dm.max_id = dd.id
    ) d ON sh.id = d.venta_id
`;

const DTE_VALID_SQL = `(
    d.venta_id IS NOT NULL
    AND d.status NOT IN ('REJECTED', 'ERROR', 'INVALIDADO')
    AND (d.ambiente IS NULL OR d.ambiente = '01')
)`;

const toNum = (val) => {
    const parsed = parseFloat(val);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const round2 = (val) => Math.round(toNum(val) * 100) / 100;

const fmtAmount = (val) => Math.abs(toNum(val)).toFixed(2);

const stripHyphens = (val) => String(val || '').replace(/[\s-]+/g, '').trim().toUpperCase();

const cleanDocId = (val) => String(val || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();

const cleanCsvText = (val) => {
    if (!val) return '';
    return String(val)
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/;/g, ',')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
};

const formatMhDate = (dateVal) => {
    const formatted = reportPdfHelper.formatDate(dateVal);
    return formatted === '---' ? '' : formatted;
};

const extractUuid32 = (...candidates) => {
    for (const candidate of candidates) {
        if (!candidate) continue;
        const cleaned = stripHyphens(candidate);
        if (/^[0-9A-F]{32}$/.test(cleaned)) {
            return cleaned;
        }
    }
    return '';
};

const isDateAfterPeriodEnd = (dateVal, year, month) => {
    const formatted = formatMhDate(dateVal);
    if (!formatted) return false;
    const parts = formatted.split('/');
    if (parts.length !== 3) return false;
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    const yyyy = parseInt(parts[2], 10);
    const targetYear = parseInt(year, 10);
    const targetMonth = parseInt(month, 10);
    if ([dd, mm, yyyy, targetYear, targetMonth].some(Number.isNaN)) return false;

    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const docDateNum = yyyy * 10000 + mm * 100 + dd;
    const periodEndNum = targetYear * 10000 + targetMonth * 100 + lastDay;
    return docDateNum > periodEndNum;
};

const getLastDayOfPeriodFormatted = (year, month) => {
    const targetYear = parseInt(year, 10);
    const targetMonth = parseInt(month, 10);
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    return `${String(lastDay).padStart(2, '0')}/${String(targetMonth).padStart(2, '0')}/${targetYear}`;
};

const isComprasEnabled = async (companyId) => {
    const [taxConfigRows] = await pool.query(
        'SELECT compras_afectan_libro_compras FROM tax_configurations WHERE company_id = ?',
        [companyId]
    );
    return Boolean(taxConfigRows[0]?.compras_afectan_libro_compras);
};

const safeJsonParse = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
};

const resolveIdentityDoc = (nit, duiOrDoc, explicitType = null) => {
    const cleanNit = cleanDocId(nit);
    const cleanOther = cleanDocId(duiOrDoc);

    if (cleanNit.length === 14) {
        return { docType: '1', docNumber: cleanNit };
    }
    if (cleanNit.length === 9) {
        return { docType: '2', docNumber: cleanNit };
    }
    if (cleanOther.length === 14) {
        return { docType: '1', docNumber: cleanOther };
    }
    if (cleanOther.length === 9) {
        return { docType: '2', docNumber: cleanOther };
    }
    const fallbackNum = cleanNit || cleanOther;
    if (!fallbackNum) {
        return { docType: '3', docNumber: '' };
    }
    if (explicitType === '36') return { docType: '1', docNumber: fallbackNum };
    if (explicitType === '13') return { docType: '2', docNumber: fallbackNum };
    return { docType: '3', docNumber: fallbackNum };
};

const extractDuiIfNoNit = (nit, tipoDoc, numDoc) => {
    const cleanNit = cleanDocId(nit);
    if (cleanNit) return '';
    const cleanNum = cleanDocId(numDoc);
    if (String(tipoDoc || '').trim() === '13' && cleanNum) {
        return cleanNum;
    }
    return cleanNum.length === 9 ? cleanNum : '';
};

const mapExpenseOrPurchaseDocToMh = (rawDoc, sourceType) => {
    const code = String(rawDoc || '').trim().padStart(2, '0');
    if (sourceType === 'gasto') {
        return EXPENSE_TO_MH_DOC_MAP[code] || null;
    }
    return PURCHASE_ALLOWED_MH_DOCS.has(code) ? code : null;
};

const resolveNonPlaceholderDoc = (numeroDocumento, numeroControl, preferControl = false) => {
    const rawDoc = String(numeroDocumento || '').trim();
    const rawCtrl = String(numeroControl || '').trim();
    const isDocPlaceholder = !rawDoc || ['S/N', 'SN', 'SIN NUMERO', 'S-N'].includes(rawDoc.toUpperCase());
    const isCtrlPlaceholder = !rawCtrl || ['S/N', 'SN', 'SIN NUMERO', 'S-N'].includes(rawCtrl.toUpperCase());

    if (preferControl && !isCtrlPlaceholder) return stripHyphens(rawCtrl);
    if (!isDocPlaceholder) return stripHyphens(rawDoc);
    if (!isCtrlPlaceholder) return stripHyphens(rawCtrl);
    return '';
};

module.exports = {
    ALLOWED_TAXPAYER_INCOME_TYPES,
    EXPENSE_TO_MH_DOC_MAP,
    PURCHASE_ALLOWED_MH_DOCS,
    CA_COUNTRY_CODES,
    DTE_JOIN_SQL,
    DTE_VALID_SQL,
    toNum,
    round2,
    fmtAmount,
    stripHyphens,
    cleanDocId,
    cleanCsvText,
    formatMhDate,
    extractUuid32,
    isDateAfterPeriodEnd,
    getLastDayOfPeriodFormatted,
    isComprasEnabled,
    safeJsonParse,
    resolveIdentityDoc,
    extractDuiIfNoNit,
    mapExpenseOrPurchaseDocToMh,
    resolveNonPlaceholderDoc
};
