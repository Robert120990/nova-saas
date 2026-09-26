const pool = require('../../config/db');
const PDFDocument = require('pdfkit');
const excelService = require('../../services/excel.service');

const MONTH_NAMES = [
    '',
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE'
];

async function getCompanyInfo(companyId) {
    const [rows] = await pool.query(
        'SELECT id, razon_social, nombre_comercial, nit, nrc, direccion FROM companies WHERE id = ?',
        [companyId]
    );
    return rows[0] || {
        razon_social: 'EMPRESA REGISTRADA',
        nombre_comercial: 'EMPRESA',
        nit: '0000-000000-000-0',
        nrc: '000000-0',
        direccion: ''
    };
}

async function getSignatures(companyId) {
    const [rows] = await pool.query(
        `SELECT setting_key, setting_value FROM accounting_settings 
         WHERE company_id = ? AND setting_key IN (
            'contador_nombre', 'contador_dui', 
            'auditor_nombre', 'auditor_dui', 
            'representante_nombre', 'representante_dui'
         )`,
        [companyId]
    );
    const sig = {
        contador_nombre: '',
        contador_dui: '',
        auditor_nombre: '',
        auditor_dui: '',
        representante_nombre: '',
        representante_dui: ''
    };
    rows.forEach(r => {
        if (r.setting_key) sig[r.setting_key] = (r.setting_value || '').trim();
    });
    return sig;
}

function formatDate(d) {
    if (!d) return '---';
    if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '---';
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

function formatCurrency(val, showDashWhenZero = true) {
    if (val === null || val === undefined || isNaN(val)) return '';
    const n = Number(val);
    if (Math.abs(n) < 0.001) {
        return showDashWhenZero ? '$ -' : '$ 0.00';
    }
    const formatted = Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    if (n < 0) {
        return `$(${formatted})`;
    }
    return `$ ${formatted}`;
}
const fmt = formatCurrency;

function getLastDayOfMonth(year, month) {
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || (new Date().getMonth() + 1);
    return new Date(y, m, 0).getDate();
}

function getAccountLevel(code) {
    const clean = String(code || '').replace(/[^0-9]/g, '');
    if (clean.length <= 1) return 1;
    if (clean.length <= 2) return 2;
    if (clean.length <= 4) return 3;
    if (clean.length <= 6) return 4;
    if (clean.length <= 8) return 5;
    return 6;
}

function renderHeader(doc, company, title, periodText, orientation = 'portrait') {
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const contentWidth = pageWidth - 60;
    const centerX = pageWidth / 2;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Emission timestamp at top-left
    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b').text(`${dateStr}  ${timeStr}`, 30, 20);

    // 1. Company Name
    const companyName = (company.razon_social || company.nombre_comercial || 'EMPRESA REGISTRADA').toUpperCase();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, 30, 20, { align: 'center', width: contentWidth });

    // 2. Report Title
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase(), 30, 35, { align: 'center', width: contentWidth });

    // 3. Tax Identifiers
    const taxText = `NUMERO DE REGISTRO DE I.V.A.: ${company.nrc || 'N/A'}    |    NIT: ${company.nit || 'N/A'}`;
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(taxText, 30, 49, { align: 'center', width: contentWidth });

    // 4. Period
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(periodText.toUpperCase(), 30, 61, { align: 'center', width: contentWidth });

    // 5. Currency standard legend
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)', 30, 73, { align: 'center', width: contentWidth });

    // Subtle divider line
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, 85).lineTo(pageWidth - 30, 85).stroke();

    doc.y = 92;
    return 92;
}

function renderSignatures(doc, signatures, company, orientation = 'portrait') {
    const pageHeight = orientation === 'landscape' ? 612 : 792;
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const marginBottom = 35;
    const sigBlockHeight = 60;
    const bottomTargetY = pageHeight - marginBottom - sigBlockHeight;

    if (doc.y > bottomTargetY - 10) {
        doc.addPage();
        doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#94a3b8').text('(Vienen firmas autorizadas del reporte oficial)', 30, 40, { lineBreak: false });
        doc.y = bottomTargetY;
    } else {
        doc.y = Math.max(doc.y + 15, bottomTargetY);
    }

    const currentY = doc.y;
    const contentWidth = pageWidth - 60;
    const colWidth = contentWidth / 3;
    const lineWidth = Math.min(150, colWidth - 20);

    const sigs = [
        {
            name: signatures.representante_nombre || company.razon_social || 'Representante Legal',
            title: 'Representante Legal'
        },
        {
            name: signatures.contador_nombre || 'Contador General',
            title: `Contador General${signatures.contador_dui ? ` - DUI: ${signatures.contador_dui}` : ''}`
        },
        {
            name: signatures.auditor_nombre || 'Auditor Externo',
            title: `Auditor Externo${signatures.auditor_dui ? ` - DUI: ${signatures.auditor_dui}` : ''}`
        }
    ];

    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    sigs.forEach((s, i) => {
        const centerX = 30 + (i * colWidth) + (colWidth / 2);
        const lineStartX = centerX - (lineWidth / 2);
        const lineEndX = centerX + (lineWidth / 2);

        doc.strokeColor('#64748b').lineWidth(0.5).moveTo(lineStartX, currentY + 15).lineTo(lineEndX, currentY + 15).stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(s.name, centerX - (lineWidth / 2), currentY + 19, {
            align: 'center',
            width: lineWidth,
            lineBreak: false
        });
        doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(s.title, centerX - (lineWidth / 2), currentY + 30, {
            align: 'center',
            width: lineWidth,
            lineBreak: false
        });
    });

    doc.page.margins.bottom = oldBottom;
}

function renderClosingFooter(doc, startX, y, count, entityName = 'Cuentas') {
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
    doc.text(`Número de ${entityName} Impresas : ${count || 0}`, startX, y, { lineBreak: false });
    doc.text('FIN DEL REPORTE.', startX, y + 9, { lineBreak: false });
    return y + 22;
}

function renderPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Página ${i + 1} de ${range.count}`, 30, doc.page.height - 20, {
            align: 'center',
            width: doc.page.width - 60,
            lineBreak: false
        });
        doc.page.margins.bottom = oldBottom;
    }
}

function buildPDF(res, orientation, buildContent) {
    const doc = new PDFDocument({
        margin: 30,
        size: 'LETTER',
        layout: orientation,
        bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(result);
    });
    try {
        buildContent(doc);
    } catch (e) {
        console.error('[buildPDF Error]:', e);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generando PDF: ' + e.message });
        }
        try { doc.end(); } catch (_) {}
    }
}

function buildExcelResponse(res, rows, columns, filename) {
    return excelService.createExcelBuffer({
        sheets: [{ name: 'Reporte', columns, data: rows }]
    }).then(buffer => excelService.sendExcelResponse(res, buffer, filename));
}


module.exports = {
    MONTH_NAMES,
    getCompanyInfo,
    getSignatures,
    formatDate,
    formatCurrency,
    fmt,
    getLastDayOfMonth,
    getAccountLevel,
    renderHeader,
    renderSignatures,
    renderClosingFooter,
    renderPageNumbers,
    buildPDF,
    buildExcelResponse
};
