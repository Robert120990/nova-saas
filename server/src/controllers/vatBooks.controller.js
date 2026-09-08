const pool = require('../config/db');
const excelService = require('../services/excel.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Extreme defensive parsing: Ensures everything is a string or number as expected
 */
const n = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

const cleanStr = (val) => {
    if (!val) return '';
    return String(val).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const safeFormatDate = (date) => {
    return reportPdfHelper.formatDate(date);
};

const MONTH_NAMES = [
    '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const getPeriodText = (month, year) => {
    const mNum = parseInt(month, 10);
    const mName = MONTH_NAMES[mNum] || month;
    return `MES DE ${mName} DE ${year}`;
};

/**
 * JOIN deduplicado con dtes: una venta puede tener varios DTEs (reintentos/retransmisiones),
 * se toma solo el DTE más reciente por venta para no duplicar montos en los libros.
 */
const DTE_JOIN_SQL = `
    LEFT JOIN (
        SELECT dd.venta_id, dd.numero_control, dd.status, dd.sello_recepcion, dd.json_original
        FROM dtes dd
        INNER JOIN (
            SELECT venta_id, MAX(id) AS max_id
            FROM dtes
            WHERE venta_id IS NOT NULL
            GROUP BY venta_id
        ) dm ON dm.max_id = dd.id
    ) d ON sh.id = d.venta_id
`;

/**
 * Incluye en el libro/anexo solo ventas cuyo DTE más reciente (último intento
 * por MAX(id) del JOIN deduplicado) tiene status válido. Excluye ventas sin DTE
 * (sin código de generación), rechazadas (REJECTED/ERROR) e invalidadas.
 * Requiere el alias \`d\` del DTE_JOIN_SQL.
 */
const DTE_VALIDO_SQL = `(
    d.venta_id IS NOT NULL
    AND d.status NOT IN ('REJECTED', 'ERROR', 'INVALIDADO')
)`;

/**
 * Summary Box with unified accounting style and credit notes support
 */
const drawPdfSummaryBox = (doc, x, y, totals, title = 'RESUMEN') => {
    try {
        const hasNc = (totals.nc_total && totals.nc_total > 0) || (totals.nc_grav && totals.nc_grav > 0);
        const boxWidth = 260;
        const boxHeight = hasNc ? 165 : 140;

        if (y + boxHeight > 510) {
            doc.addPage();
            y = 30;
        }

        doc.save();
        // Fondo y borde del cuadro
        doc.roundedRect(x, y, boxWidth, boxHeight, 4).fillAndStroke('#f8fafc', '#cbd5e1');

        // Encabezado del cuadro
        doc.roundedRect(x, y, boxWidth, 18, 4).fill('#f1f5f9');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(String(title).toUpperCase(), x + 10, y + 5);

        let rowY = y + 24;
        const drawRow = (label, val, isBold = false, isNegative = false) => {
            doc.fillColor(isBold ? '#0f172a' : '#475569')
                .fontSize(7.5)
                .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                .text(String(label), x + 10, rowY, { width: 135 });

            const formattedVal = reportPdfHelper.fmt(isNegative ? -Math.abs(n(val)) : n(val));
            doc.fillColor(isBold ? '#0f172a' : '#1e293b')
                .fontSize(7.5)
                .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                .text(formattedVal, x + 140, rowY, { width: 110, align: 'right' });

            rowY += 12.5;
        };

        if (hasNc) {
            drawRow('Total Bruto:', totals.bruto_total || (totals.total + (totals.nc_total || 0)));
            drawRow('(-) Notas de Crédito:', totals.nc_total, false, true);
            doc.moveTo(x + 8, rowY).lineTo(x + boxWidth - 8, rowY).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
            rowY += 3;
        }

        drawRow(hasNc ? 'Gravadas Netas:' : 'Gravadas:', totals.grav);
        drawRow('Exentas:', totals.exe);
        drawRow(hasNc ? 'IVA Neto:' : 'IVA:', totals.iva);
        if (totals.fovial > 0 || totals.cotrans > 0) {
            drawRow('FOVIAL:', totals.fovial);
            drawRow('COTRANS:', totals.cotrans);
        }
        if (totals.ret !== undefined && (totals.ret > 0 || hasNc)) {
            drawRow('Retenciones/Percepciones:', totals.ret);
        }

        doc.moveTo(x + 8, rowY).lineTo(x + boxWidth - 8, rowY).lineWidth(0.75).strokeColor('#cbd5e1').stroke();
        rowY += 3;
        drawRow(hasNc ? 'TOTAL GENERAL NETO:' : 'TOTAL GENERAL:', totals.total, true);
        doc.restore();
        return y + boxHeight;
    } catch (err) {
        console.error('[VAT Books] Error drawing summary box:', err);
        return y;
    }
};

/**
 * 1. Libro de Compras
 */
const getVatBookPurchasesPDF = async (req, res) => {
    try {
        const { year, month, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        console.log(`[VAT Books] Generating Purchases: Co=${companyId}, Period=${year}-${month}, Branch=${branch_id}`);

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const company = await reportPdfHelper.getCompanyInfo(companyId);
        
        let branchName = 'TODAS / CONSOLIDADO';
        if (branch_id && branch_id !== 'all') {
            const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            branchName = branches[0]?.nombre || '---';
        }

        let whereClauses = ['ph.company_id = ?', 'ph.period_year = ?', 'ph.period_month = ?', "ph.status != 'ANULADO'"];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('ph.branch_id = ?'); params.push(branch_id); }

        const query = `
            SELECT ph.*, p.nombre AS provider_nombre, p.nit AS provider_nit, p.nrc AS provider_nrc, cat.description AS tipo_doc_nombre
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            LEFT JOIN cat_002_tipo_dte cat ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY ph.fecha ASC, ph.id ASC
        `;
        const [rows] = await pool.query(query, params);

        const isNotaCreditoCompra = (r) => {
            const tId = String(r.tipo_documento_id || '').trim();
            const desc = String(r.tipo_doc_nombre || '').toLowerCase();
            return tId === '06' || tId === '05' || desc.includes('crédito');
        };

        if (req.query.format === 'excel') {
            const excelData = rows.map(r => {
                const esNC = isNotaCreditoCompra(r);
                const sign = esNC ? -1 : 1;
                return {
                    Fecha: reportPdfHelper.formatDate(r.fecha),
                    'Tipo Doc': r.tipo_doc_nombre || (esNC ? 'Nota de Crédito' : 'Crédito Fiscal'),
                    'No. Documento': r.numero_documento || '',
                    Proveedor: r.provider_nombre || 'S/N',
                    NIT: r.provider_nit || '',
                    NRC: r.provider_nrc || '',
                    Exento: (sign * n(r.total_exenta)).toFixed(2),
                    Neto: (sign * n(r.total_gravada)).toFixed(2),
                    IVA: (sign * n(r.iva)).toFixed(2),
                    Total: (sign * n(r.monto_total)).toFixed(2)
                };
            });
            const buffer = await excelService.createExcelBuffer({
                sheets: [{ name: 'Libro Compras', columns: [
                    { header: 'Fecha', key: 'Fecha', width: 14 },
                    { header: 'Tipo Doc', key: 'Tipo Doc', width: 16 },
                    { header: 'No. Documento', key: 'No. Documento', width: 20 },
                    { header: 'Proveedor', key: 'Proveedor', width: 35 },
                    { header: 'NIT', key: 'NIT', width: 18 },
                    { header: 'NRC', key: 'NRC', width: 15 },
                    { header: 'Exento', key: 'Exento', width: 14 },
                    { header: 'Neto', key: 'Neto', width: 14 },
                    { header: 'IVA', key: 'IVA', width: 14 },
                    { header: 'Total', key: 'Total', width: 14 }
                ], data: excelData }]
            });
            return excelService.sendExcelResponse(res, buffer, `Libro_Compras_${month}_${year}.xlsx`);
        }

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const title = 'LIBRO DE COMPRAS (I.V.A.)';
        const periodText = getPeriodText(month, year);
        const subtitle = `SUCURSAL: ${branchName.toUpperCase()}`;

        const startX = 30;
        const totalWidth = 732;
        const cols = {
            fecha: 45,
            documento: 124,
            proveedor: 180,
            nit_nrc: 68,
            gravada: 48,
            exenta: 42,
            iva: 44,
            fov: 35,
            cot: 35,
            ret_per: 44,
            total: 67
        };

        const drawPageHeader = () => {
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        };

        const drawTableHeader = () => {
            const y = doc.y;
            doc.rect(startX, y, totalWidth, 15).fill('#f1f5f9');
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX;
            doc.text('FECHA', x + 2, y + 4, { width: cols.fecha - 4 }); x += cols.fecha;
            doc.text('DOCUMENTO', x + 2, y + 4, { width: cols.documento - 4 }); x += cols.documento;
            doc.text('PROVEEDOR', x + 2, y + 4, { width: cols.proveedor - 4 }); x += cols.proveedor;
            doc.text('NIT/NRC', x + 2, y + 4, { width: cols.nit_nrc - 4 }); x += cols.nit_nrc;
            doc.text('GRAVADA', x, y + 4, { width: cols.gravada - 2, align: 'right' }); x += cols.gravada;
            doc.text('EXENTA', x, y + 4, { width: cols.exenta - 2, align: 'right' }); x += cols.exenta;
            doc.text('IVA', x, y + 4, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
            doc.text('FOV', x, y + 4, { width: cols.fov - 2, align: 'right' }); x += cols.fov;
            doc.text('COT', x, y + 4, { width: cols.cot - 2, align: 'right' }); x += cols.cot;
            doc.text('RET/PER', x, y + 4, { width: cols.ret_per - 2, align: 'right' }); x += cols.ret_per;
            doc.text('TOTAL', x, y + 4, { width: cols.total - 2, align: 'right' });
            doc.moveTo(startX, y + 15).lineTo(startX + totalWidth, y + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.y = y + 19;
        };

        drawPageHeader();
        drawTableHeader();

        let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, nc_iva: 0, bruto_total: 0 };

        rows.forEach((r, idx) => {
            if (doc.y > 510) {
                doc.addPage();
                drawPageHeader();
                drawTableHeader();
            }

            const esNC = isNotaCreditoCompra(r);
            const sign = esNC ? -1 : 1;
            const g = n(r.total_gravada), e = n(r.total_exenta), i = n(r.iva);
            const f = n(r.fovial), c = n(r.cotrans), re = n(r.retencion) + n(r.percepcion), to = n(r.monto_total);

            const rowY = doc.y;
            if (idx % 2 === 1) {
                doc.rect(startX, rowY - 1, totalWidth, 13).fill('#f8fafc');
            }

            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a');
            let x = startX;
            doc.text(reportPdfHelper.formatDate(r.fecha), x + 2, rowY, { lineBreak: false }); x += cols.fecha;
            
            const docLabel = `${String(r.tipo_doc_nombre || '')} ${String(r.numero_documento || '')}`.trim();
            doc.text(reportPdfHelper.fitText(doc, docLabel || '---', cols.documento - 4), x + 2, rowY, { lineBreak: false }); x += cols.documento;
            doc.text(reportPdfHelper.fitText(doc, String(r.provider_nombre || 'S/N').toUpperCase(), cols.proveedor - 4), x + 2, rowY, { lineBreak: false }); x += cols.proveedor;
            
            const nitNrc = String(r.provider_nit || r.provider_nrc || '').trim();
            doc.text(reportPdfHelper.fitText(doc, nitNrc || '---', cols.nit_nrc - 4), x + 2, rowY, { lineBreak: false }); x += cols.nit_nrc;

            doc.text(reportPdfHelper.fmt(sign * g), x, rowY, { width: cols.gravada - 2, align: 'right' }); x += cols.gravada;
            doc.text(reportPdfHelper.fmt(sign * e), x, rowY, { width: cols.exenta - 2, align: 'right' }); x += cols.exenta;
            doc.text(reportPdfHelper.fmt(sign * i), x, rowY, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
            doc.text(reportPdfHelper.fmt(sign * f), x, rowY, { width: cols.fov - 2, align: 'right' }); x += cols.fov;
            doc.text(reportPdfHelper.fmt(sign * c), x, rowY, { width: cols.cot - 2, align: 'right' }); x += cols.cot;
            doc.text(reportPdfHelper.fmt(sign * re), x, rowY, { width: cols.ret_per - 2, align: 'right' }); x += cols.ret_per;
            doc.text(reportPdfHelper.fmt(sign * to), x, rowY, { width: cols.total - 2, align: 'right' });

            if (esNC) {
                t.grav -= g; t.exe -= e; t.iva -= i; t.fovial -= f; t.cotrans -= c; t.ret -= re; t.total -= to;
                t.nc_total += to; t.nc_grav += g; t.nc_iva += i;
            } else {
                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
                t.bruto_total += to;
            }
            doc.y = rowY + 13;
        });

        if (doc.y > 470) {
            doc.addPage();
            drawPageHeader();
        }

        const boxX = startX + totalWidth - 260;
        const boxEndY = drawPdfSummaryBox(doc, boxX, doc.y + 10, t, 'RESUMEN DE COMPRAS');

        const footerY = Math.max(doc.y, boxEndY) + 12;
        reportPdfHelper.renderClosingFooter(doc, startX, footerY, rows.length, 'Documentos');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Libro_Compras_${month}_${year}.pdf"`);
        res.send(buffer);
    } catch (e) {
        console.error('[VAT Books] Error Purchases PDF:', e);
        res.status(500).json({ message: 'Error al generar PDF de compras: ' + e.message });
    }
};

/**
 * 2. Libro de CCF
 */
const getVatBookSalesTaxpayersPDF = async (req, res) => {
    try {
        const { year, month, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        console.log(`[VAT Books] Generating CCF: Co=${companyId}, Period=${year}-${month}, Branch=${branch_id}`);

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'TODAS / CONSOLIDADO';
        if (branch_id && branch_id !== 'all') {
            const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            branchName = branches[0]?.nombre || '---';
        }

        const ccfFilterSql = `(
            sh.tipo_documento = '03'
            OR (
                sh.tipo_documento = '05'
                AND (
                    (c.nrc IS NOT NULL AND TRIM(c.nrc) != '')
                    OR JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.documentoRelacionado[0].tipoDocumento')) = '03'
                )
            )
        )`;

        let whereClauses = [
            'sh.company_id = ?',
            'YEAR(sh.fecha_emision) = ?',
            'MONTH(sh.fecha_emision) = ?',
            ccfFilterSql,
            "sh.estado != 'ANULADO'",
            DTE_VALIDO_SQL
        ];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('sh.branch_id = ?'); params.push(branch_id); }

        const query = `
            SELECT sh.*, c.nombre AS customer_nombre, c.nrc AS customer_nrc, c.nit AS customer_nit, COALESCE(d.numero_control, sh.numero_control) AS numero_control
            FROM sales_headers sh
            LEFT JOIN customers c ON sh.customer_id = c.id
            ${DTE_JOIN_SQL}
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY sh.fecha_emision ASC, COALESCE(d.numero_control, sh.numero_control) ASC
        `;
        const [rows] = await pool.query(query, params);

        if (req.query.format === 'excel') {
            const excelData = rows.map(r => {
                const esNC = r.tipo_documento === '05';
                const sign = esNC ? -1 : 1;
                return {
                    Fecha: reportPdfHelper.formatDate(r.fecha_emision),
                    'Tipo Doc': esNC ? 'Nota de Crédito' : 'Crédito Fiscal',
                    'No. Documento': r.numero_control || '---',
                    Cliente: r.customer_nombre || 'CLIENTE S/N',
                    NIT: r.customer_nit || '',
                    NRC: r.customer_nrc || '',
                    Exento: (sign * n(r.total_exento)).toFixed(2),
                    Neto: (sign * n(r.total_gravado)).toFixed(2),
                    IVA: (sign * n(r.total_iva)).toFixed(2),
                    FOVIAL: (sign * n(r.fovial)).toFixed(2),
                    COTRANS: (sign * n(r.cotrans)).toFixed(2),
                    'Ret/Per': (sign * (n(r.iva_retenido) + n(r.iva_percibido))).toFixed(2),
                    Total: (sign * n(r.total_pagar)).toFixed(2)
                };
            });
            const buffer = await excelService.createExcelBuffer({
                sheets: [{ name: 'Libro CCF', columns: [
                    { header: 'Fecha', key: 'Fecha', width: 14 },
                    { header: 'Tipo Doc', key: 'Tipo Doc', width: 16 },
                    { header: 'No. Documento', key: 'No. Documento', width: 22 },
                    { header: 'Cliente', key: 'Cliente', width: 35 },
                    { header: 'NIT', key: 'NIT', width: 18 },
                    { header: 'NRC', key: 'NRC', width: 15 },
                    { header: 'Exento', key: 'Exento', width: 14 },
                    { header: 'Neto', key: 'Neto', width: 14 },
                    { header: 'IVA', key: 'IVA', width: 14 },
                    { header: 'FOVIAL', key: 'FOVIAL', width: 14 },
                    { header: 'COTRANS', key: 'COTRANS', width: 14 },
                    { header: 'Ret/Per', key: 'Ret/Per', width: 14 },
                    { header: 'Total', key: 'Total', width: 14 }
                ], data: excelData }]
            });
            return excelService.sendExcelResponse(res, buffer, `Libro_CCF_${month}_${year}.xlsx`);
        }

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const title = 'LIBRO DE VENTAS A CONTRIBUYENTES (CRÉDITO FISCAL)';
        const periodText = getPeriodText(month, year);
        const subtitle = `SUCURSAL: ${branchName.toUpperCase()}`;

        const startX = 30;
        const totalWidth = 732;
        const cols = {
            fecha: 45,
            documento: 124,
            cliente: 190,
            nrc: 45,
            gravada: 48,
            exenta: 42,
            iva: 44,
            fov: 35,
            cot: 35,
            ret_per: 46,
            total: 78
        };

        const drawPageHeader = () => {
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        };

        const drawTableHeader = () => {
            const y = doc.y;
            doc.rect(startX, y, totalWidth, 15).fill('#f1f5f9');
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX;
            doc.text('FECHA', x + 2, y + 4, { width: cols.fecha - 4 }); x += cols.fecha;
            doc.text('DOCUMENTO', x + 2, y + 4, { width: cols.documento - 4 }); x += cols.documento;
            doc.text('CLIENTE', x + 2, y + 4, { width: cols.cliente - 4 }); x += cols.cliente;
            doc.text('NRC', x + 2, y + 4, { width: cols.nrc - 4 }); x += cols.nrc;
            doc.text('GRAVADA', x, y + 4, { width: cols.gravada - 2, align: 'right' }); x += cols.gravada;
            doc.text('EXENTA', x, y + 4, { width: cols.exenta - 2, align: 'right' }); x += cols.exenta;
            doc.text('IVA DEB.', x, y + 4, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
            doc.text('FOV', x, y + 4, { width: cols.fov - 2, align: 'right' }); x += cols.fov;
            doc.text('COT', x, y + 4, { width: cols.cot - 2, align: 'right' }); x += cols.cot;
            doc.text('RET/PER', x, y + 4, { width: cols.ret_per - 2, align: 'right' }); x += cols.ret_per;
            doc.text('TOTAL', x, y + 4, { width: cols.total - 2, align: 'right' });
            doc.moveTo(startX, y + 15).lineTo(startX + totalWidth, y + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.y = y + 19;
        };

        drawPageHeader();
        drawTableHeader();

        let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, nc_iva: 0, bruto_total: 0 };

        rows.forEach((r, idx) => {
            if (doc.y > 510) {
                doc.addPage();
                drawPageHeader();
                drawTableHeader();
            }

            const esNC = r.tipo_documento === '05';
            const sign = esNC ? -1 : 1;
            const g = n(r.total_gravado), e = n(r.total_exento), i = n(r.total_iva);
            const f = n(r.fovial), c = n(r.cotrans), re = n(r.iva_retenido) + n(r.iva_percibido), to = n(r.total_pagar);

            const rowY = doc.y;
            if (idx % 2 === 1) {
                doc.rect(startX, rowY - 1, totalWidth, 13).fill('#f8fafc');
            }

            doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a');
            let x = startX;
            doc.text(reportPdfHelper.formatDate(r.fecha_emision), x + 2, rowY, { lineBreak: false }); x += cols.fecha;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.numero_control || '---'), cols.documento - 4), x + 2, rowY, { lineBreak: false }); x += cols.documento;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.customer_nombre || 'CLIENTE S/N').toUpperCase(), cols.cliente - 4), x + 2, rowY, { lineBreak: false }); x += cols.cliente;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.customer_nrc || '---'), cols.nrc - 4), x + 2, rowY, { lineBreak: false }); x += cols.nrc;

            doc.text(reportPdfHelper.fmt(sign * g), x, rowY, { width: cols.gravada - 2, align: 'right' }); x += cols.gravada;
            doc.text(reportPdfHelper.fmt(sign * e), x, rowY, { width: cols.exenta - 2, align: 'right' }); x += cols.exenta;
            doc.text(reportPdfHelper.fmt(sign * i), x, rowY, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
            doc.text(reportPdfHelper.fmt(sign * f), x, rowY, { width: cols.fov - 2, align: 'right' }); x += cols.fov;
            doc.text(reportPdfHelper.fmt(sign * c), x, rowY, { width: cols.cot - 2, align: 'right' }); x += cols.cot;
            doc.text(reportPdfHelper.fmt(sign * re), x, rowY, { width: cols.ret_per - 2, align: 'right' }); x += cols.ret_per;
            doc.text(reportPdfHelper.fmt(sign * to), x, rowY, { width: cols.total - 2, align: 'right' });

            if (esNC) {
                t.grav -= g; t.exe -= e; t.iva -= i; t.fovial -= f; t.cotrans -= c; t.ret -= re; t.total -= to;
                t.nc_total += to; t.nc_grav += g; t.nc_iva += i;
            } else {
                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
                t.bruto_total += to;
            }
            doc.y = rowY + 13;
        });

        if (doc.y > 470) {
            doc.addPage();
            drawPageHeader();
        }

        const boxX = startX + totalWidth - 260;
        const boxEndY = drawPdfSummaryBox(doc, boxX, doc.y + 10, t, 'RESUMEN VENTAS CCF');

        const footerY = Math.max(doc.y, boxEndY) + 12;
        reportPdfHelper.renderClosingFooter(doc, startX, footerY, rows.length, 'Documentos');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Libro_CCF_${month}_${year}.pdf"`);
        res.send(buffer);
    } catch (e) { 
        console.error('[VAT Books] Error CCF:', e); 
        res.status(500).json({ message: 'Error al generar Libro CCF: ' + e.message }); 
    }
};

/**
 * 3. Libro de FAC
 */
const getVatBookSalesConsumersPDF = async (req, res) => {
    try {
        const { year, month, branch_id, resumen } = req.query;
        const companyId = req.company_id || req.user?.company_id;
        const isResumen = resumen !== 'false';

        console.log(`[VAT Books] Generating FAC: Co=${companyId}, Period=${year}-${month}, Branch=${branch_id}, isResumen=${isResumen}`);

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'TODAS / CONSOLIDADO';
        if (branch_id && branch_id !== 'all') {
            const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            branchName = branches[0]?.nombre || '---';
        }

        const facFilterSql = `(
            sh.tipo_documento = '01'
            OR (
                sh.tipo_documento = '05'
                AND (c.nrc IS NULL OR TRIM(c.nrc) = '')
                AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.documentoRelacionado[0].tipoDocumento')), '01') = '01'
            )
        )`;

        let whereClauses = [
            'sh.company_id = ?',
            'YEAR(sh.fecha_emision) = ?',
            'MONTH(sh.fecha_emision) = ?',
            facFilterSql,
            "sh.estado != 'ANULADO'",
            DTE_VALIDO_SQL
        ];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('sh.branch_id = ?'); params.push(branch_id); }

        let rows;
        if (isResumen) {
            const query = `
                SELECT DATE(sh.fecha_emision) as fecha, MIN(d.numero_control) as num_desde, MAX(d.numero_control) as num_hasta,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN -sh.total_gravado ELSE sh.total_gravado END) as t_grav,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN -sh.total_exento ELSE sh.total_exento END) as t_exe,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN -sh.total_iva ELSE sh.total_iva END) as t_iva,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN -sh.fovial ELSE sh.fovial END) as t_fov,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN -sh.cotrans ELSE sh.cotrans END) as t_cot,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN -sh.total_pagar ELSE sh.total_pagar END) as t_pagar,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN sh.total_pagar ELSE 0 END) as nc_total,
                       SUM(CASE WHEN sh.tipo_documento = '05' THEN sh.total_gravado ELSE 0 END) as nc_grav,
                       SUM(CASE WHEN sh.tipo_documento != '05' THEN sh.total_pagar ELSE 0 END) as bruto_total
                FROM sales_headers sh
                ${DTE_JOIN_SQL}
                LEFT JOIN customers c ON sh.customer_id = c.id
                WHERE ${whereClauses.join(' AND ')}
                GROUP BY DATE(sh.fecha_emision)
                ORDER BY fecha ASC
            `;
            [rows] = await pool.query(query, params);
        } else {
            const query = `
                SELECT sh.fecha_emision as fecha, d.numero_control, sh.tipo_documento,
                       COALESCE(c.nombre, sh.cliente_nombre, 'CONSUMIDOR FINAL') as cliente,
                       COALESCE(c.nit, '') as nit,
                       sh.total_gravado, sh.total_exento, sh.total_iva,
                       sh.fovial, sh.cotrans, sh.total_pagar
                FROM sales_headers sh
                ${DTE_JOIN_SQL}
                LEFT JOIN customers c ON sh.customer_id = c.id
                WHERE ${whereClauses.join(' AND ')}
                ORDER BY sh.fecha_emision ASC, d.numero_control ASC
            `;
            [rows] = await pool.query(query, params);
        }

        if (req.query.format === 'excel') {
            if (isResumen) {
                const excelData = rows.map(r => ({
                    Fecha: reportPdfHelper.formatDate(r.fecha),
                    'Tipo Doc': 'Factura',
                    'No. Documento': `${r.num_desde || '---'} - ${r.num_hasta || '---'}`,
                    Cliente: 'CONSUMIDOR FINAL',
                    NIT: '',
                    Exento: n(r.t_exe).toFixed(2),
                    Neto: n(r.t_grav).toFixed(2),
                    IVA: n(r.t_iva).toFixed(2),
                    FOVIAL: n(r.t_fov).toFixed(2),
                    COTRANS: n(r.t_cot).toFixed(2),
                    Total: n(r.t_pagar).toFixed(2)
                }));
                const buffer = await excelService.createExcelBuffer({
                    sheets: [{ name: 'Libro FAC', columns: [
                        { header: 'Fecha', key: 'Fecha', width: 14 },
                        { header: 'Tipo Doc', key: 'Tipo Doc', width: 14 },
                        { header: 'No. Documento', key: 'No. Documento', width: 24 },
                        { header: 'Cliente', key: 'Cliente', width: 30 },
                        { header: 'NIT', key: 'NIT', width: 18 },
                        { header: 'Exento', key: 'Exento', width: 14 },
                        { header: 'Neto', key: 'Neto', width: 14 },
                        { header: 'IVA', key: 'IVA', width: 14 },
                        { header: 'FOVIAL', key: 'FOVIAL', width: 14 },
                        { header: 'COTRANS', key: 'COTRANS', width: 14 },
                        { header: 'Total', key: 'Total', width: 14 }
                    ], data: excelData }]
                });
                return excelService.sendExcelResponse(res, buffer, `Libro_FAC_${month}_${year}.xlsx`);
            } else {
                const excelData = rows.map(r => {
                    const esNC = r.tipo_documento === '05';
                    const sign = esNC ? -1 : 1;
                    return {
                        'N° Control': r.numero_control || 'SIN DTE',
                        Fecha: reportPdfHelper.formatDate(r.fecha),
                        'Tipo Doc': esNC ? 'Nota de Crédito' : 'Factura',
                        Cliente: r.cliente || 'CONSUMIDOR FINAL',
                        NIT: r.nit || '',
                        Exento: (sign * n(r.total_exento)).toFixed(2),
                        Neto: (sign * n(r.total_gravado)).toFixed(2),
                        IVA: (sign * n(r.total_iva)).toFixed(2),
                        FOVIAL: (sign * n(r.fovial)).toFixed(2),
                        COTRANS: (sign * n(r.cotrans)).toFixed(2),
                        Total: (sign * n(r.total_pagar)).toFixed(2)
                    };
                });
                const buffer = await excelService.createExcelBuffer({
                    sheets: [{ name: 'Detalle FAC', columns: [
                        { header: 'N° Control', key: 'N° Control', width: 22 },
                        { header: 'Fecha', key: 'Fecha', width: 14 },
                        { header: 'Tipo Doc', key: 'Tipo Doc', width: 16 },
                        { header: 'Cliente', key: 'Cliente', width: 30 },
                        { header: 'NIT', key: 'NIT', width: 18 },
                        { header: 'Exento', key: 'Exento', width: 14 },
                        { header: 'Neto', key: 'Neto', width: 14 },
                        { header: 'IVA', key: 'IVA', width: 14 },
                        { header: 'FOVIAL', key: 'FOVIAL', width: 14 },
                        { header: 'COTRANS', key: 'COTRANS', width: 14 },
                        { header: 'Total', key: 'Total', width: 14 }
                    ], data: excelData }]
                });
                return excelService.sendExcelResponse(res, buffer, `Detalle_FAC_${month}_${year}.xlsx`);
            }
        }

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const title = isResumen 
            ? 'LIBRO DE VENTAS A CONSUMIDOR FINAL (RESUMEN)' 
            : 'LIBRO DE VENTAS A CONSUMIDOR FINAL (DETALLE)';
        const periodText = getPeriodText(month, year);
        const subtitle = `SUCURSAL: ${branchName.toUpperCase()}`;

        const startX = 30;
        const totalWidth = 732;

        const drawPageHeader = () => {
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        };

        if (isResumen) {
            const cols = {
                fecha: 55,
                del_no: 155,
                al_no: 155,
                gravado: 62,
                exento: 58,
                iva: 54,
                fovial: 48,
                cotrans: 48,
                total: 97
            };

            const drawTableHeader = () => {
                const y = doc.y;
                doc.rect(startX, y, totalWidth, 15).fill('#f1f5f9');
                doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
                let x = startX;
                doc.text('FECHA', x + 2, y + 4, { width: cols.fecha - 4 }); x += cols.fecha;
                doc.text('DEL No.', x + 2, y + 4, { width: cols.del_no - 4 }); x += cols.del_no;
                doc.text('AL No.', x + 2, y + 4, { width: cols.al_no - 4 }); x += cols.al_no;
                doc.text('GRAVADO', x, y + 4, { width: cols.gravado - 2, align: 'right' }); x += cols.gravado;
                doc.text('EXENTO', x, y + 4, { width: cols.exento - 2, align: 'right' }); x += cols.exento;
                doc.text('IVA', x, y + 4, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
                doc.text('FOVIAL', x, y + 4, { width: cols.fovial - 2, align: 'right' }); x += cols.fovial;
                doc.text('COTRANS', x, y + 4, { width: cols.cotrans - 2, align: 'right' }); x += cols.cotrans;
                doc.text('TOTAL', x, y + 4, { width: cols.total - 2, align: 'right' });
                doc.moveTo(startX, y + 15).lineTo(startX + totalWidth, y + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
                doc.y = y + 19;
            };

            drawPageHeader();
            drawTableHeader();

            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, bruto_total: 0 };

            rows.forEach((r, idx) => {
                if (doc.y > 510) {
                    doc.addPage();
                    drawPageHeader();
                    drawTableHeader();
                }

                const g = n(r.t_grav), i = n(r.t_iva);
                const e = n(r.t_exe);
                const f = n(r.t_fov), c = n(r.t_cot), to = n(r.t_pagar);

                const rowY = doc.y;
                if (idx % 2 === 1) {
                    doc.rect(startX, rowY - 1, totalWidth, 13).fill('#f8fafc');
                }

                doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a');
                let x = startX;
                doc.text(reportPdfHelper.formatDate(r.fecha), x + 2, rowY, { lineBreak: false }); x += cols.fecha;
                doc.text(reportPdfHelper.fitText(doc, String(r.num_desde || '---'), cols.del_no - 4), x + 2, rowY, { lineBreak: false }); x += cols.del_no;
                doc.text(reportPdfHelper.fitText(doc, String(r.num_hasta || '---'), cols.al_no - 4), x + 2, rowY, { lineBreak: false }); x += cols.al_no;
                doc.text(reportPdfHelper.fmt(g), x, rowY, { width: cols.gravado - 2, align: 'right' }); x += cols.gravado;
                doc.text(reportPdfHelper.fmt(e), x, rowY, { width: cols.exento - 2, align: 'right' }); x += cols.exento;
                doc.text(reportPdfHelper.fmt(i), x, rowY, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
                doc.text(reportPdfHelper.fmt(f), x, rowY, { width: cols.fovial - 2, align: 'right' }); x += cols.fovial;
                doc.text(reportPdfHelper.fmt(c), x, rowY, { width: cols.cotrans - 2, align: 'right' }); x += cols.cotrans;
                doc.text(reportPdfHelper.fmt(to), x, rowY, { width: cols.total - 2, align: 'right' });

                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.total += to;
                t.nc_total += n(r.nc_total); t.nc_grav += n(r.nc_grav); t.bruto_total += n(r.bruto_total);
                doc.y = rowY + 13;
            });

            if (doc.y > 470) {
                doc.addPage();
                drawPageHeader();
            }

            const boxX = startX + totalWidth - 260;
            const boxEndY = drawPdfSummaryBox(doc, boxX, doc.y + 10, t, 'RESUMEN VENTAS FAC');

            const footerY = Math.max(doc.y, boxEndY) + 12;
            reportPdfHelper.renderClosingFooter(doc, startX, footerY, rows.length, 'Días');
            reportPdfHelper.renderPageNumbers(doc);
        } else {
            const cols = {
                numero_control: 124,
                fecha: 46,
                cliente: 180,
                nit: 68,
                gravado: 52,
                exento: 46,
                iva: 44,
                fovial: 36,
                cotrans: 36,
                total: 100
            };

            const drawDetailHeader = () => {
                const y = doc.y;
                doc.rect(startX, y, totalWidth, 15).fill('#f1f5f9');
                doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#0f172a');
                let x = startX;
                doc.text('N° CONTROL', x + 2, y + 4, { width: cols.numero_control - 4 }); x += cols.numero_control;
                doc.text('FECHA', x + 2, y + 4, { width: cols.fecha - 4 }); x += cols.fecha;
                doc.text('CLIENTE', x + 2, y + 4, { width: cols.cliente - 4 }); x += cols.cliente;
                doc.text('NIT', x + 2, y + 4, { width: cols.nit - 4 }); x += cols.nit;
                doc.text('GRAVADO', x, y + 4, { width: cols.gravado - 2, align: 'right' }); x += cols.gravado;
                doc.text('EXENTO', x, y + 4, { width: cols.exento - 2, align: 'right' }); x += cols.exento;
                doc.text('IVA', x, y + 4, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
                doc.text('FOVIAL', x, y + 4, { width: cols.fovial - 2, align: 'right' }); x += cols.fovial;
                doc.text('COTRANS', x, y + 4, { width: cols.cotrans - 2, align: 'right' }); x += cols.cotrans;
                doc.text('TOTAL', x, y + 4, { width: cols.total - 2, align: 'right' });
                doc.moveTo(startX, y + 15).lineTo(startX + totalWidth, y + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
                doc.y = y + 19;
            };

            drawPageHeader();
            drawDetailHeader();

            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, nc_iva: 0, bruto_total: 0 };

            rows.forEach((r, idx) => {
                if (doc.y > 510) {
                    doc.addPage();
                    drawPageHeader();
                    drawDetailHeader();
                }

                const esNC = r.tipo_documento === '05';
                const sign = esNC ? -1 : 1;
                const g = n(r.total_gravado), i = n(r.total_iva);
                const e = n(r.total_exento);
                const f = n(r.fovial), c = n(r.cotrans), to = n(r.total_pagar);

                const rowY = doc.y;
                if (idx % 2 === 1) {
                    doc.rect(startX, rowY - 1, totalWidth, 13).fill('#f8fafc');
                }

                doc.fontSize(6.5).font('Helvetica').fillColor('#0f172a');
                let x = startX;
                doc.text(reportPdfHelper.fitText(doc, String(r.numero_control || 'SIN DTE'), cols.numero_control - 4), x + 2, rowY, { lineBreak: false }); x += cols.numero_control;
                doc.text(reportPdfHelper.formatDate(r.fecha), x + 2, rowY, { lineBreak: false }); x += cols.fecha;
                doc.text(reportPdfHelper.fitText(doc, String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(), cols.cliente - 4), x + 2, rowY, { lineBreak: false }); x += cols.cliente;
                doc.text(reportPdfHelper.fitText(doc, String(r.nit || '---'), cols.nit - 4), x + 2, rowY, { lineBreak: false }); x += cols.nit;

                doc.text(reportPdfHelper.fmt(sign * g), x, rowY, { width: cols.gravado - 2, align: 'right' }); x += cols.gravado;
                doc.text(reportPdfHelper.fmt(sign * e), x, rowY, { width: cols.exento - 2, align: 'right' }); x += cols.exento;
                doc.text(reportPdfHelper.fmt(sign * i), x, rowY, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
                doc.text(reportPdfHelper.fmt(sign * f), x, rowY, { width: cols.fovial - 2, align: 'right' }); x += cols.fovial;
                doc.text(reportPdfHelper.fmt(sign * c), x, rowY, { width: cols.cotrans - 2, align: 'right' }); x += cols.cotrans;
                doc.text(reportPdfHelper.fmt(sign * to), x, rowY, { width: cols.total - 2, align: 'right' });

                if (esNC) {
                    t.grav -= g; t.exe -= e; t.iva -= i; t.fovial -= f; t.cotrans -= c; t.total -= to;
                    t.nc_total += to; t.nc_grav += g; t.nc_iva += i;
                } else {
                    t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.total += to;
                    t.bruto_total += to;
                }
                doc.y = rowY + 13;
            });

            if (doc.y > 470) {
                doc.addPage();
                drawPageHeader();
            }

            const boxX = startX + totalWidth - 260;
            const boxEndY = drawPdfSummaryBox(doc, boxX, doc.y + 10, t, 'RESUMEN VENTAS FAC');

            const footerY = Math.max(doc.y, boxEndY) + 12;
            reportPdfHelper.renderClosingFooter(doc, startX, footerY, rows.length, 'Documentos');
            reportPdfHelper.renderPageNumbers(doc);
        }
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Libro_FAC_${month}_${year}.pdf"`);
        res.send(buffer);
    } catch (e) { 
        console.error('[VAT Books] Error FAC:', e); 
    }
};



/**
 * 4. Anexos de IVA (consulta con rango de fechas + tipo DTE)
 * Filtrado SIEMPRE por la sucursal actual del usuario (req.user.branch_id).
 */
const buildAnexosIVAQuery = ({ companyId, branchId, fecha_inicio, fecha_fin, tipo_dte, search, limit, offset }) => {
    const whereClauses = [
        'sh.company_id = ?',
        'sh.branch_id = ?',
        "sh.estado != 'ANULADO'",
        DTE_VALIDO_SQL
    ];
    const params = [companyId, branchId];

    if (fecha_inicio) { whereClauses.push('DATE(sh.fecha_emision) >= ?'); params.push(fecha_inicio); }
    if (fecha_fin) { whereClauses.push('DATE(sh.fecha_emision) <= ?'); params.push(fecha_fin); }
    if (tipo_dte) { whereClauses.push('sh.tipo_documento = ?'); params.push(tipo_dte); }
    if (search) {
        whereClauses.push(`(
            COALESCE(sh.numero_control, '') LIKE ?
            OR COALESCE(sh.codigo_generacion, '') LIKE ?
            OR COALESCE(sh.sello_recepcion, '') LIKE ?
            OR COALESCE(c.nombre, sh.cliente_nombre, '') LIKE ?
            OR COALESCE(c.nit, '') LIKE ?
            OR COALESCE(c.nrc, '') LIKE ?
        )`);
        const like = `%${search}%`;
        params.push(like, like, like, like, like, like);
    }

    const where = whereClauses.join(' AND ');

    const selectCols = `
        sh.id,
        sh.fecha_emision,
        sh.codigo_generacion,
        sh.numero_control,
        COALESCE(sh.sello_recepcion, d.sello_recepcion) AS sello_recepcion,
        d.status AS estado,
        sh.tipo_documento,
        cat.description AS tipo_dte,
        COALESCE(c.nombre, sh.cliente_nombre, 'CONSUMIDOR FINAL') AS cliente,
        COALESCE(c.nit, '') AS nit,
        COALESCE(c.nrc, '') AS nrc,
        sh.total_exento,
        sh.total_gravado,
        sh.total_iva,
        sh.fovial,
        sh.cotrans,
        sh.iva_retenido,
        sh.iva_percibido,
        sh.total_pagar
    `;

    const countQuery = `
        SELECT COUNT(*) AS total
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        ${DTE_JOIN_SQL}
        LEFT JOIN cat_002_tipo_dte cat ON sh.tipo_documento = cat.code
        WHERE ${where}
    `;

    const dataQuery = `
        SELECT ${selectCols}
        FROM sales_headers sh
        LEFT JOIN customers c ON sh.customer_id = c.id
        ${DTE_JOIN_SQL}
        LEFT JOIN cat_002_tipo_dte cat ON sh.tipo_documento = cat.code
        WHERE ${where}
        ORDER BY sh.fecha_emision ASC, COALESCE(d.numero_control, sh.numero_control) ASC
    ` + (limit ? ' LIMIT ? OFFSET ?' : '');

    return { countQuery, dataQuery, params: limit ? [...params, limit, offset] : params };
};

const getVatBookAnexosIVA = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const branchId = req.user?.branch_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const { fecha_inicio, fecha_fin, tipo_dte, search = '', page = 1, limit = 15 } = req.query;
        const currentPage = Math.max(1, parseInt(page) || 1);
        const currentLimit = Math.max(1, Math.min(100, parseInt(limit) || 15));
        const offset = (currentPage - 1) * currentLimit;

        const { countQuery, dataQuery, params } = buildAnexosIVAQuery({
            companyId, branchId, fecha_inicio, fecha_fin, tipo_dte, search,
            limit: currentLimit, offset
        });

        const [countRows] = await pool.query(countQuery, params);
        const total = countRows[0]?.total || 0;
        const [rows] = await pool.query(dataQuery, params);

        const data = rows.map((r, idx) => ({
            corr: offset + idx + 1,
            fecha: safeFormatDate(r.fecha_emision),
            codigo_generacion: cleanStr(r.codigo_generacion),
            numero_control: cleanStr(r.numero_control),
            sello_recepcion: cleanStr(r.sello_recepcion),
            estado: cleanStr(r.estado) || 'PENDIENTE',
            cliente: cleanStr(r.cliente).toUpperCase(),
            nit: cleanStr(r.nit),
            nrc: cleanStr(r.nrc),
            tipo_dte: cleanStr(r.tipo_dte || r.tipo_documento),
            exentas: n(r.total_exento),
            gravadas: n(r.total_gravado),
            iva: n(r.total_iva),
            retencion: n(r.iva_retenido) + n(r.iva_percibido),
            fovial: n(r.fovial),
            cotrans: n(r.cotrans),
            total: n(r.total_pagar)
        }));

        res.json({
            data,
            total,
            page: currentPage,
            totalPages: Math.ceil(total / currentLimit)
        });
    } catch (e) {
        console.error('[VAT Books] Error Anexos IVA:', e);
        res.status(500).json({ message: 'Error', error: e.message });
    }
};

const getVatBookAnexosIVAPDF = async (req, res) => {
    try {
        if (req.query.format === 'excel') {
            return getVatBookAnexosIVAExcel(req, res);
        }

        const companyId = req.company_id || req.user?.company_id;
        const branchId = req.user?.branch_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const { fecha_inicio, fecha_fin, tipo_dte, search = '' } = req.query;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'TODAS / CONSOLIDADO';
        if (branchId) {
            const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
            branchName = branches[0]?.nombre || '---';
        }

        const { dataQuery, params } = buildAnexosIVAQuery({
            companyId, branchId, fecha_inicio, fecha_fin, tipo_dte, search
        });
        const [rows] = await pool.query(dataQuery, params);

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const title = 'ANEXOS DE I.V.A. (DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS)';
        const periodText = (fecha_inicio && fecha_fin)
            ? `DEL ${reportPdfHelper.formatDate(fecha_inicio)} AL ${reportPdfHelper.formatDate(fecha_fin)}`
            : 'TODOS LOS REGISTROS';
        const subtitle = `SUCURSAL: ${branchName.toUpperCase()}`;

        const startX = 30;
        const totalWidth = 732;
        const cols = {
            num: 22,
            fecha: 44,
            codigo_generacion: 112,
            numero_control: 102,
            sello_recepcion: 90,
            estado: 44,
            cliente: 120,
            tipo_dte: 26,
            gravada: 44,
            iva: 40,
            ret: 34,
            total: 54
        };

        const drawPageHeader = () => {
            reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
        };

        const drawTableHeader = () => {
            const y = doc.y;
            doc.rect(startX, y, totalWidth, 15).fill('#f1f5f9');
            doc.fontSize(6).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX;
            doc.text('N°', x + 2, y + 4, { width: cols.num - 4 }); x += cols.num;
            doc.text('FECHA', x + 2, y + 4, { width: cols.fecha - 4 }); x += cols.fecha;
            doc.text('COD. GENERACIÓN', x + 2, y + 4, { width: cols.codigo_generacion - 4 }); x += cols.codigo_generacion;
            doc.text('N° CONTROL', x + 2, y + 4, { width: cols.numero_control - 4 }); x += cols.numero_control;
            doc.text('SELLO RECEPCIÓN', x + 2, y + 4, { width: cols.sello_recepcion - 4 }); x += cols.sello_recepcion;
            doc.text('ESTADO', x + 2, y + 4, { width: cols.estado - 4 }); x += cols.estado;
            doc.text('CLIENTE', x + 2, y + 4, { width: cols.cliente - 4 }); x += cols.cliente;
            doc.text('TIPO', x + 2, y + 4, { width: cols.tipo_dte - 4 }); x += cols.tipo_dte;
            doc.text('GRAVADA', x, y + 4, { width: cols.gravada - 2, align: 'right' }); x += cols.gravada;
            doc.text('IVA', x, y + 4, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
            doc.text('RET', x, y + 4, { width: cols.ret - 2, align: 'right' }); x += cols.ret;
            doc.text('TOTAL', x, y + 4, { width: cols.total - 2, align: 'right' });
            doc.moveTo(startX, y + 15).lineTo(startX + totalWidth, y + 15).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
            doc.y = y + 19;
        };

        drawPageHeader();
        drawTableHeader();

        let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

        rows.forEach((r, idx) => {
            if (doc.y > 510) {
                doc.addPage();
                drawPageHeader();
                drawTableHeader();
            }

            const g = n(r.total_gravado), e = n(r.total_exento), i = n(r.total_iva);
            const f = n(r.fovial), c = n(r.cotrans), re = n(r.iva_retenido) + n(r.iva_percibido), to = n(r.total_pagar);

            const rowY = doc.y;
            if (idx % 2 === 1) {
                doc.rect(startX, rowY - 1, totalWidth, 12).fill('#f8fafc');
            }

            doc.fontSize(5.5).font('Helvetica').fillColor('#0f172a');
            let x = startX;
            doc.text(String(idx + 1), x + 2, rowY, { lineBreak: false }); x += cols.num;
            doc.text(reportPdfHelper.formatDate(r.fecha_emision), x + 2, rowY, { lineBreak: false }); x += cols.fecha;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.codigo_generacion || '---'), cols.codigo_generacion - 4), x + 2, rowY, { lineBreak: false }); x += cols.codigo_generacion;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.numero_control || '---'), cols.numero_control - 4), x + 2, rowY, { lineBreak: false }); x += cols.numero_control;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.sello_recepcion || '---'), cols.sello_recepcion - 4), x + 2, rowY, { lineBreak: false }); x += cols.sello_recepcion;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.estado || 'PENDIENTE'), cols.estado - 4), x + 2, rowY, { lineBreak: false }); x += cols.estado;
            doc.text(reportPdfHelper.fitText(doc, String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(), cols.cliente - 4), x + 2, rowY, { lineBreak: false }); x += cols.cliente;
            doc.text(reportPdfHelper.fitText(doc, cleanStr(r.tipo_dte || r.tipo_documento), cols.tipo_dte - 4), x + 2, rowY, { lineBreak: false }); x += cols.tipo_dte;

            doc.text(reportPdfHelper.fmt(g), x, rowY, { width: cols.gravada - 2, align: 'right' }); x += cols.gravada;
            doc.text(reportPdfHelper.fmt(i), x, rowY, { width: cols.iva - 2, align: 'right' }); x += cols.iva;
            doc.text(reportPdfHelper.fmt(re), x, rowY, { width: cols.ret - 2, align: 'right' }); x += cols.ret;
            doc.text(reportPdfHelper.fmt(to), x, rowY, { width: cols.total - 2, align: 'right' });

            t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
            doc.y = rowY + 12;
        });

        if (doc.y > 470) {
            doc.addPage();
            drawPageHeader();
        }

        const boxX = startX + totalWidth - 260;
        const boxEndY = drawPdfSummaryBox(doc, boxX, doc.y + 10, t, 'RESUMEN ANEXOS IVA');

        const footerY = Math.max(doc.y, boxEndY) + 12;
        reportPdfHelper.renderClosingFooter(doc, startX, footerY, rows.length, 'Documentos');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Anexos_IVA_${fecha_inicio || 'inicio'}_${fecha_fin || 'fin'}.pdf"`);
        res.send(buffer);
    } catch (e) {
        console.error('[VAT Books] Error Anexos IVA PDF:', e);
        res.status(500).json({ message: 'Error al generar PDF de Anexos IVA: ' + e.message });
    }
};

const getVatBookAnexosIVAExcel = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const branchId = req.user?.branch_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const { fecha_inicio, fecha_fin, tipo_dte, search = '' } = req.query;

        const { dataQuery, params } = buildAnexosIVAQuery({
            companyId, branchId, fecha_inicio, fecha_fin, tipo_dte, search
        });
        const [rows] = await pool.query(dataQuery, params);

        const excelData = rows.map((r, idx) => ({
            Correlativo: idx + 1,
            Fecha: safeFormatDate(r.fecha_emision),
            'Cod. Generación': cleanStr(r.codigo_generacion || '---'),
            'N° Control': cleanStr(r.numero_control || '---'),
            'Sello Recepción': cleanStr(r.sello_recepcion || '---'),
            'Estado': cleanStr(r.estado || 'PENDIENTE'),
            Cliente: String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(),
            NIT: cleanStr(r.nit || ''),
            NRC: cleanStr(r.nrc || ''),
            'Tipo DTE': cleanStr(r.tipo_dte || r.tipo_documento),
            Exentas: n(r.total_exento).toFixed(2),
            Gravadas: n(r.total_gravado).toFixed(2),
            IVA: n(r.total_iva).toFixed(2),
            Retención: (n(r.iva_retenido) + n(r.iva_percibido)).toFixed(2),
            FOVIAL: n(r.fovial).toFixed(2),
            COTRANS: n(r.cotrans).toFixed(2),
            Total: n(r.total_pagar).toFixed(2)
        }));

        const buffer = await excelService.createExcelBuffer({
            sheets: [{
                name: 'Anexos IVA',
                columns: [
                    { header: 'Correlativo', key: 'Correlativo', width: 12 },
                    { header: 'Fecha', key: 'Fecha', width: 12 },
                    { header: 'Cod. Generación', key: 'Cod. Generación', width: 30 },
                    { header: 'N° Control', key: 'N° Control', width: 22 },
                    { header: 'Sello Recepción', key: 'Sello Recepción', width: 26 },
                    { header: 'Estado', key: 'Estado', width: 14 },
                    { header: 'Cliente', key: 'Cliente', width: 35 },
                    { header: 'NIT', key: 'NIT', width: 18 },
                    { header: 'NRC', key: 'NRC', width: 15 },
                    { header: 'Tipo DTE', key: 'Tipo DTE', width: 14 },
                    { header: 'Exentas', key: 'Exentas', width: 12 },
                    { header: 'Gravadas', key: 'Gravadas', width: 12 },
                    { header: 'IVA', key: 'IVA', width: 12 },
                    { header: 'Retención', key: 'Retención', width: 12 },
                    { header: 'FOVIAL', key: 'FOVIAL', width: 12 },
                    { header: 'COTRANS', key: 'COTRANS', width: 12 },
                    { header: 'Total', key: 'Total', width: 14 }
                ],
                data: excelData
            }]
        });
        return excelService.sendExcelResponse(res, buffer, `Anexos_IVA_${fecha_inicio || 'inicio'}_${fecha_fin || 'fin'}.xlsx`);
    } catch (e) {
        console.error('[VAT Books] Error Anexos IVA Excel:', e);
        res.status(500).json({ message: 'Error', error: e.message });
    }
};

module.exports = {
    getVatBookPurchasesPDF,
    getVatBookSalesTaxpayersPDF,
    getVatBookSalesConsumersPDF,
    getVatBookAnexosIVA,
    getVatBookAnexosIVAPDF,
    getVatBookAnexosIVAExcel
};
