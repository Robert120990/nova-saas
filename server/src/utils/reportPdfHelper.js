const PDFDocument = require('pdfkit');
const pool = require('../config/db');

/**
 * Obtiene la información oficial de la empresa para encabezados de reportes.
 */
async function getCompanyInfo(companyId) {
    if (!companyId) {
        return {
            razon_social: 'EMPRESA REGISTRADA',
            nombre_comercial: 'EMPRESA',
            nit: '0000-000000-000-0',
            nrc: '000000-0',
            direccion: ''
        };
    }
    try {
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
    } catch (e) {
        console.error('[reportPdfHelper getCompanyInfo error]:', e);
        return {
            razon_social: 'EMPRESA REGISTRADA',
            nombre_comercial: 'EMPRESA',
            nit: '0000-000000-000-0',
            nrc: '000000-0',
            direccion: ''
        };
    }
}

/**
 * Obtiene la información oficial de la empresa buscando por razón social o nombre comercial.
 */
async function getCompanyByName(name) {
    if (!name) return null;
    try {
        const cleanName = String(name).trim();
        const [rows] = await pool.query(
            'SELECT id, razon_social, nombre_comercial, nit, nrc, direccion FROM companies WHERE razon_social = ? OR nombre_comercial = ? OR razon_social LIKE ? LIMIT 1',
            [cleanName, cleanName, `%${cleanName}%`]
        );
        return rows[0] || null;
    } catch (e) {
        console.error('[reportPdfHelper getCompanyByName error]:', e);
        return null;
    }
}

/**
 * Obtiene la primera empresa registrada en la base de datos como fallback.
 */
async function getDefaultCompany() {
    try {
        const [rows] = await pool.query(
            'SELECT id, razon_social, nombre_comercial, nit, nrc, direccion FROM companies LIMIT 1'
        );
        return rows[0] || null;
    } catch (e) {
        console.error('[reportPdfHelper getDefaultCompany error]:', e);
        return null;
    }
}

/**
 * Formatea fechas a formato DD/MM/YYYY
 */
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

/**
 * Formatea montos monetarios con estilo contable:
 * 0 -> "$ -" o "$ 0.00"
 * < 0 -> "$(1,234.56)"
 * > 0 -> "$ 1,234.56"
 */
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

/**
 * Encabezado institucional estandarizado para reportes.
 */
function renderHeader(doc, company, title, periodText, orientation = 'portrait', subtitle = null) {
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const contentWidth = pageWidth - 60;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Timestamp de emisión en esquina superior izquierda
    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b').text(`${dateStr}  ${timeStr}`, 30, 20);

    // 1. Nombre de la Empresa
    const companyName = (company?.razon_social || company?.nombre_comercial || company?.nombre || 'EMPRESA REGISTRADA').toUpperCase();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, 30, 20, { align: 'center', width: contentWidth });

    // 2. Título del Reporte
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text((title || 'REPORTE').toUpperCase(), 30, 35, { align: 'center', width: contentWidth });

    // 3. Identificadores tributarios y sucursal/subtítulo
    let taxText = `NUMERO DE REGISTRO DE I.V.A.: ${company?.nrc || 'N/A'}    |    NIT: ${company?.nit || 'N/A'}`;
    if (subtitle) {
        taxText += `    |    ${subtitle.toUpperCase()}`;
    }
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(taxText, 30, 49, { align: 'center', width: contentWidth });

    // 4. Período
    let currentY = 61;
    if (periodText) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(periodText.toUpperCase(), 30, currentY, { align: 'center', width: contentWidth });
        currentY += 12;
    }

    // 5. Leyenda monetaria
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)', 30, currentY, { align: 'center', width: contentWidth });
    currentY += 12;

    // Línea divisoria sutil
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, currentY).lineTo(pageWidth - 30, currentY).stroke();

    doc.y = currentY + 7;
    return doc.y;
}

/**
 * Pie de cierre del reporte (número de registros y mensaje de fin).
 * Sin firmas autorizadas.
 */
function renderClosingFooter(doc, startX, y, count, entityName = 'Registros') {
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
    doc.text(`Número de ${entityName} Impresas : ${count || 0}`, startX, y, { lineBreak: false });
    doc.text('FIN DEL REPORTE.', startX, y + 9, { lineBreak: false });
    return y + 22;
}

/**
 * Numeración de páginas centrada en pie de página (Página X de Y).
 */
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

/**
 * Crea un documento PDF con los estándares de reportes y un callback para obtener el Buffer
 */
function createPdfDocument(orientation = 'portrait') {
    const doc = new PDFDocument({
        margin: 30,
        size: 'LETTER',
        layout: orientation,
        bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    const getBuffer = () => new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
    });
    return { doc, getBuffer };
}

/**
 * Envía directamente el PDF generado a la respuesta Express
 */
function buildPDF(res, orientation, buildContent) {
    const { doc, getBuffer } = createPdfDocument(orientation);
    try {
        buildContent(doc);
    } catch (e) {
        console.error('[buildPDF Error]:', e);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generando PDF: ' + e.message });
        }
        try { doc.end(); } catch (_) {}
        return;
    }
    getBuffer()
        .then(buffer => {
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/pdf');
                res.send(buffer);
            }
        })
        .catch(e => {
            console.error('[buildPDF Buffer Error]:', e);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error procesando buffer de PDF: ' + e.message });
            }
        });
}

/**
 * Truncates text so it fits within a maximum width in points on a single line,
 * appending '...' if it exceeds.
 */
function fitText(doc, text, maxWidth) {
    const str = String(text ?? '').trim();
    if (!str || maxWidth <= 0) return '';
    const singleLineMaxHeight = doc.currentLineHeight(true) * 1.5;
    if (doc.heightOfString(str, { width: maxWidth }) <= singleLineMaxHeight) {
        return str;
    }
    let truncated = str;
    while (truncated.length > 0) {
        truncated = truncated.slice(0, -1);
        const candidate = truncated.trim() + '...';
        if (doc.heightOfString(candidate, { width: maxWidth }) <= singleLineMaxHeight) {
            return candidate;
        }
    }
    return '';
}

module.exports = {
    getCompanyInfo,
    getCompanyByName,
    getDefaultCompany,
    formatDate,
    formatCurrency,
    fmt,
    fitText,
    renderHeader,
    renderClosingFooter,
    renderPageNumbers,
    createPdfDocument,
    buildPDF
};

