const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const { numberToWords } = require('../../utils/numberToWords');

function isValidTaxVal(val) {
    return Boolean(val && val !== '---' && val !== 'N/A' && val !== '0000-000000-000-0' && val !== '000000-0');
}

/**
 * Resuelve la información de la empresa para encabezados de reportes.
 */
async function resolveCompanyInfo(data) {
    // 1. Si ya se proporcionó un objeto company con nit o nrc válidos
    if (data.company && typeof data.company === 'object' && (isValidTaxVal(data.company.nit) || isValidTaxVal(data.company.nrc))) {
        return data.company;
    }
    // 2. Si company es un objeto con id o si se pasó company_id
    const compId = data.company_id || (data.company && typeof data.company === 'object' ? data.company.id : null);
    if (compId) {
        const compById = await reportPdfHelper.getCompanyInfo(compId);
        if (compById && (isValidTaxVal(compById.nit) || isValidTaxVal(compById.nrc))) {
            return compById;
        }
    }
    // 3. Si se proporcionó company_name o data.company es un string, buscar por nombre en la base de datos
    const compName = data.company_name || (typeof data.company === 'string' ? data.company : null);
    if (compName) {
        const compByName = await reportPdfHelper.getCompanyByName(compName);
        if (compByName && (isValidTaxVal(compByName.nit) || isValidTaxVal(compByName.nrc))) {
            return compByName;
        }
    }
    // 4. Si se proporcionaron nit/nrc explícitos en data
    if (isValidTaxVal(data.company_nit) || isValidTaxVal(data.company_nrc)) {
        return {
            razon_social: compName || data.company?.razon_social || 'EMPRESA REGISTRADA',
            nombre_comercial: data.company?.nombre_comercial || 'EMPRESA',
            nit: data.company_nit || '---',
            nrc: data.company_nrc || '---'
        };
    }
    // 5. Fallback por defecto: primera empresa de la base de datos
    const defaultComp = await reportPdfHelper.getDefaultCompany();
    if (defaultComp && (isValidTaxVal(defaultComp.nit) || isValidTaxVal(defaultComp.nrc))) {
        return defaultComp;
    }

    return defaultComp || {
        razon_social: compName || 'EMPRESA REGISTRADA',
        nombre_comercial: 'EMPRESA',
        nit: '---',
        nrc: '---'
    };
}

/**
 * Formatea una fecha a DD/MM/YYYY sin desfase de zona horaria.
 * Acepta objetos Date o strings tipo 'YYYY-MM-DD' / ISO.
 */
const fmtDateDDMMYYYY = (val) => {
    if (!val) return '—';
    let y, m, d;
    if (val instanceof Date && !isNaN(val)) {
        y = val.getFullYear();
        m = val.getMonth() + 1;
        d = val.getDate();
    } else {
        const parts = String(val).substring(0, 10).split('-');
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
    }
    if (!y || !m || !d) return '—';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

/**
 * Generates a PDF buffer for an inventory transfer
 */

module.exports = {
    PDFDocument,
    path,
    fs,
    QRCode,
    reportPdfHelper,
    numberToWords,
    isValidTaxVal,
    resolveCompanyInfo,
    fmtDateDDMMYYYY
};
