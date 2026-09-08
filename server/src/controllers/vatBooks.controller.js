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

/**
 * Motor de cálculo de Liquidación de IVA y Pago a Cuenta (Art. 151 Código Tributario)
 */
const calculateVatLiquidation = async (companyId, year, month, branch_id, options = {}) => {
    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const isPersonaNatural = String(company?.tipo_persona) === '2';
    const defaultFuelRate = isPersonaNatural ? 0.00 : 0.75;
    const defaultGeneralRate = 1.75;

    const fuelRate = (options.fuel_rate !== undefined && options.fuel_rate !== null && options.fuel_rate !== '')
        ? Math.max(0, parseFloat(options.fuel_rate))
        : defaultFuelRate;
    const generalRate = (options.general_rate !== undefined && options.general_rate !== null && options.general_rate !== '')
        ? Math.max(0, parseFloat(options.general_rate))
        : defaultGeneralRate;
    const remanenteAnterior = Math.max(0, n(options.remanente_anterior));
    const retencionesRentaSufridas = Math.max(0, n(options.retenciones_renta_sufridas));

    let branchName = 'TODAS / CONSOLIDADO';
    if (branch_id && branch_id !== 'all') {
        const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        branchName = branches[0]?.nombre || '---';
    }

    // 1. Débito Fiscal (Ventas del período)
    let salesWhere = [
        'sh.company_id = ?',
        'YEAR(sh.fecha_emision) = ?',
        'MONTH(sh.fecha_emision) = ?',
        "sh.estado != 'ANULADO'",
        "sh.estado != 'invalidado'",
        DTE_VALIDO_SQL
    ];
    let salesParams = [companyId, year, month];
    if (branch_id && branch_id !== 'all') {
        salesWhere.push('sh.branch_id = ?');
        salesParams.push(branch_id);
    }

    const [salesByTypeRows] = await pool.query(`
        SELECT 
            sh.tipo_documento,
            cat.description as tipo_doc_nombre,
            COUNT(*) as count,
            COALESCE(SUM(sh.total_gravado), 0) as total_gravado,
            COALESCE(SUM(sh.total_exento), 0) as total_exento,
            COALESCE(SUM(sh.total_nosujetas), 0) as total_nosujetas,
            COALESCE(SUM(sh.total_iva), 0) as total_iva,
            COALESCE(SUM(sh.iva_retenido), 0) as total_iva_retenido,
            COALESCE(SUM(sh.iva_percibido), 0) as total_iva_percibido,
            COALESCE(SUM(sh.fovial), 0) as total_fovial,
            COALESCE(SUM(sh.cotrans), 0) as total_cotrans,
            COALESCE(SUM(sh.total_pagar), 0) as total_pagar
        FROM sales_headers sh
        LEFT JOIN cat_002_tipo_dte cat ON sh.tipo_documento COLLATE utf8mb4_unicode_ci = cat.code
        ${DTE_JOIN_SQL}
        WHERE ${salesWhere.join(' AND ')}
        GROUP BY sh.tipo_documento, cat.description
    `, salesParams);

    let ccfSales = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retenido: 0, percibido: 0, total: 0 };
    let fcfSales = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retenido: 0, percibido: 0, total: 0 };
    let ncSales = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retenido: 0, percibido: 0, total: 0 };
    let otrosSales = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retenido: 0, percibido: 0, total: 0 };

    salesByTypeRows.forEach(row => {
        const t = String(row.tipo_documento || '').trim();
        const item = {
            count: parseInt(row.count, 10) || 0,
            gravado: n(row.total_gravado),
            exento: n(row.total_exento),
            nosujeta: n(row.total_nosujetas),
            iva: n(row.total_iva),
            retenido: n(row.total_iva_retenido),
            percibido: n(row.total_iva_percibido),
            total: n(row.total_pagar)
        };
        if (t === '03') {
            ccfSales = item;
        } else if (t === '01') {
            fcfSales = item;
        } else if (t === '05') {
            ncSales = item;
        } else {
            otrosSales.count += item.count;
            otrosSales.gravado += item.gravado;
            otrosSales.exento += item.exento;
            otrosSales.nosujeta += item.nosujeta;
            otrosSales.iva += item.iva;
            otrosSales.retenido += item.retenido;
            otrosSales.percibido += item.percibido;
            otrosSales.total += item.total;
        }
    });

    const debitoFiscalBruto = Math.round((ccfSales.iva + fcfSales.iva + otrosSales.iva) * 100) / 100;
    const debitoFiscalNc = Math.round(ncSales.iva * 100) / 100;
    const debitoFiscalNeto = Math.round(Math.max(0, debitoFiscalBruto - debitoFiscalNc) * 100) / 100;

    const ventasGravadasNetas = Math.round(Math.max(0, (ccfSales.gravado + fcfSales.gravado + otrosSales.gravado) - ncSales.gravado) * 100) / 100;
    const ventasExentasNetas = Math.round(Math.max(0, (ccfSales.exento + fcfSales.exento + otrosSales.exento) - ncSales.exento) * 100) / 100;
    const ventasNosujetasNetas = Math.round(Math.max(0, (ccfSales.nosujeta + fcfSales.nosujeta + otrosSales.nosujeta) - ncSales.nosujeta) * 100) / 100;
    const retencionesIvaSufridas = Math.round(Math.max(0, (ccfSales.retenido + fcfSales.retenido) - ncSales.retenido) * 100) / 100;
    const percepcionesIvaEfectuadas = Math.round((ccfSales.percibido + fcfSales.percibido) * 100) / 100;

    // 2. Crédito Fiscal (Compras del período)
    let purchasesWhere = [
        'ph.company_id = ?',
        'ph.period_year = ?',
        'ph.period_month = ?',
        "ph.status != 'ANULADO'"
    ];
    let purchasesParams = [companyId, year, month];
    if (branch_id && branch_id !== 'all') {
        purchasesWhere.push('ph.branch_id = ?');
        purchasesParams.push(branch_id);
    }

    const [purchasesByTypeRows] = await pool.query(`
        SELECT 
            ph.tipo_documento_id,
            cat.description as tipo_doc_nombre,
            COUNT(*) as count,
            COALESCE(SUM(ph.total_gravada), 0) as total_gravada,
            COALESCE(SUM(ph.total_exenta), 0) as total_exenta,
            COALESCE(SUM(ph.total_nosujeta), 0) as total_nosujeta,
            COALESCE(SUM(ph.iva), 0) as total_iva,
            COALESCE(SUM(ph.retencion), 0) as total_retencion,
            COALESCE(SUM(ph.percepcion), 0) as total_percepcion,
            COALESCE(SUM(ph.monto_total), 0) as total_monto
        FROM purchase_headers ph
        LEFT JOIN cat_002_tipo_dte cat ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code
        WHERE ${purchasesWhere.join(' AND ')}
        GROUP BY ph.tipo_documento_id, cat.description
    `, purchasesParams);

    let ccfPurchases = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retencion: 0, percepcion: 0, total: 0 };
    let ncPurchases = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retencion: 0, percepcion: 0, total: 0 };
    let sujetosExcluidos = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retencion: 0, percepcion: 0, total: 0 };
    let otrosPurchases = { count: 0, gravado: 0, exento: 0, nosujeta: 0, iva: 0, retencion: 0, percepcion: 0, total: 0 };

    purchasesByTypeRows.forEach(row => {
        const t = String(row.tipo_documento_id || '').trim();
        const item = {
            count: parseInt(row.count, 10) || 0,
            gravado: n(row.total_gravada),
            exento: n(row.total_exenta),
            nosujeta: n(row.total_nosujeta),
            iva: n(row.total_iva),
            retencion: n(row.total_retencion),
            percepcion: n(row.total_percepcion),
            total: n(row.total_monto)
        };
        if (t === '03') {
            ccfPurchases = item;
        } else if (t === '05' || t === '06') {
            ncPurchases.count += item.count;
            ncPurchases.gravado += item.gravado;
            ncPurchases.exento += item.exento;
            ncPurchases.nosujeta += item.nosujeta;
            ncPurchases.iva += item.iva;
            ncPurchases.retencion += item.retencion;
            ncPurchases.percepcion += item.percepcion;
            ncPurchases.total += item.total;
        } else if (t === '14') {
            sujetosExcluidos = item;
        } else {
            otrosPurchases.count += item.count;
            otrosPurchases.gravado += item.gravado;
            otrosPurchases.exento += item.exento;
            otrosPurchases.nosujeta += item.nosujeta;
            otrosPurchases.iva += item.iva;
            otrosPurchases.retencion += item.retencion;
            otrosPurchases.percepcion += item.percepcion;
            otrosPurchases.total += item.total;
        }
    });

    const creditoFiscalBruto = Math.round((ccfPurchases.iva + otrosPurchases.iva) * 100) / 100;
    const creditoFiscalNc = Math.round(ncPurchases.iva * 100) / 100;
    const creditoFiscalNeto = Math.round(Math.max(0, creditoFiscalBruto - creditoFiscalNc) * 100) / 100;

    const comprasGravadasNetas = Math.round(Math.max(0, (ccfPurchases.gravado + otrosPurchases.gravado) - ncPurchases.gravado) * 100) / 100;
    const comprasExentasNetas = Math.round(Math.max(0, (ccfPurchases.exento + otrosPurchases.exento) - ncPurchases.exento) * 100) / 100;
    const comprasNosujetasNetas = Math.round(Math.max(0, (ccfPurchases.nosujeta + otrosPurchases.nosujeta) - ncPurchases.nosujeta) * 100) / 100;
    const percepcionesIvaSoportadas = Math.round((ccfPurchases.percepcion + otrosPurchases.percepcion) * 100) / 100;
    const retencionesSujetosExcluidos = Math.round(sujetosExcluidos.retencion * 100) / 100;

    // 3. Liquidación de IVA (F-07)
    const diferenciaIva = debitoFiscalNeto - creditoFiscalNeto;
    let impuestoDeterminado = 0;
    let remanenteCreditoMes = 0;

    if (diferenciaIva > 0) {
        impuestoDeterminado = Math.round(diferenciaIva * 100) / 100;
    } else {
        remanenteCreditoMes = Math.round(Math.abs(diferenciaIva) * 100) / 100;
    }

    const totalAcreditaciones = remanenteAnterior + retencionesIvaSufridas + percepcionesIvaSoportadas;
    let ivaPagarOperaciones = 0;
    let nuevoRemanenteCredito = 0;

    if (impuestoDeterminado >= totalAcreditaciones) {
        ivaPagarOperaciones = Math.round((impuestoDeterminado - totalAcreditaciones) * 100) / 100;
        nuevoRemanenteCredito = remanenteCreditoMes; // 0
    } else {
        ivaPagarOperaciones = 0;
        nuevoRemanenteCredito = Math.round((remanenteCreditoMes + (totalAcreditaciones - impuestoDeterminado)) * 100) / 100;
    }

    const totalIvaEnterar = Math.round((ivaPagarOperaciones + retencionesSujetosExcluidos) * 100) / 100;

    // 4. Pago a Cuenta Segregado (Art. 151 Código Tributario)
    const [itemsByRubroRows] = await pool.query(`
        SELECT 
            CASE 
                WHEN p.tipo_combustible IS NOT NULL AND p.tipo_combustible > 0 THEN 'combustible' 
                ELSE 'otros' 
            END AS rubro,
            COUNT(DISTINCT sh.id) as sales_count,
            COALESCE(SUM(CASE WHEN sh.tipo_documento = '05' THEN -si.venta_gravada ELSE si.venta_gravada END), 0) AS gravada_neta,
            COALESCE(SUM(CASE WHEN sh.tipo_documento = '05' THEN -si.venta_exenta ELSE si.venta_exenta END), 0) AS exenta_neta,
            COALESCE(SUM(CASE WHEN sh.tipo_documento = '05' THEN -(si.venta_gravada + si.venta_exenta) ELSE (si.venta_gravada + si.venta_exenta) END), 0) AS ingreso_bruto_neto
        FROM sales_items si
        JOIN sales_headers sh ON si.sale_id = sh.id
        LEFT JOIN products p ON si.product_id = p.id
        ${DTE_JOIN_SQL}
        WHERE ${salesWhere.join(' AND ')}
        GROUP BY rubro
    `, salesParams);

    const fuelRow = itemsByRubroRows.find(r => r.rubro === 'combustible') || { sales_count: 0, gravada_neta: 0, exenta_neta: 0, ingreso_bruto_neto: 0 };
    const otherRow = itemsByRubroRows.find(r => r.rubro === 'otros') || { sales_count: 0, gravada_neta: 0, exenta_neta: 0, ingreso_bruto_neto: 0 };

    const ingresoBrutoCombustible = Math.max(0, n(fuelRow.ingreso_bruto_neto));
    const ingresoBrutoOtros = Math.max(0, n(otherRow.ingreso_bruto_neto));
    const totalIngresosBrutos = ingresoBrutoCombustible + ingresoBrutoOtros;

    const pagoCuentaCombustible = Math.round(ingresoBrutoCombustible * (fuelRate / 100) * 100) / 100;
    const pagoCuentaOtros = Math.round(ingresoBrutoOtros * (generalRate / 100) * 100) / 100;
    const subtotalPagoCuenta = Math.round((pagoCuentaCombustible + pagoCuentaOtros) * 100) / 100;

    let pagoCuentaPagar = 0;
    let remanentePagoCuenta = 0;

    if (subtotalPagoCuenta >= retencionesRentaSufridas) {
        pagoCuentaPagar = Math.round((subtotalPagoCuenta - retencionesRentaSufridas) * 100) / 100;
        remanentePagoCuenta = 0;
    } else {
        pagoCuentaPagar = 0;
        remanentePagoCuenta = Math.round((retencionesRentaSufridas - subtotalPagoCuenta) * 100) / 100;
    }

    // 5. Consolidado F-07
    const totalF07 = Math.round((totalIvaEnterar + pagoCuentaPagar) * 100) / 100;

    return {
        meta: {
            company,
            periodText: getPeriodText(month, year),
            year: parseInt(year, 10),
            month: parseInt(month, 10),
            branch_id,
            branchName,
            isPersonaNatural,
            fuelRate,
            generalRate,
            defaultFuelRate,
            defaultGeneralRate,
            remanenteAnterior,
            retencionesRentaSufridas
        },
        debito_fiscal: {
            ccf: ccfSales,
            fcf: fcfSales,
            nc: ncSales,
            otros: otrosSales,
            totales: {
                bruto: debitoFiscalBruto,
                nc: debitoFiscalNc,
                neto: debitoFiscalNeto,
                ventas_gravadas_netas: ventasGravadasNetas,
                ventas_exentas_netas: ventasExentasNetas,
                ventas_nosujetas_netas: ventasNosujetasNetas,
                retenciones_sufridas_1pct: retencionesIvaSufridas,
                percepciones_efectuadas_1pct: percepcionesIvaEfectuadas
            }
        },
        credito_fiscal: {
            ccf: ccfPurchases,
            nc: ncPurchases,
            sujetos_excluidos: sujetosExcluidos,
            otros: otrosPurchases,
            totales: {
                bruto: creditoFiscalBruto,
                nc: creditoFiscalNc,
                neto: creditoFiscalNeto,
                compras_gravadas_netas: comprasGravadasNetas,
                compras_exentas_netas: comprasExentasNetas,
                compras_nosujetas_netas: comprasNosujetasNetas,
                percepciones_soportadas_1pct: percepcionesIvaSoportadas,
                retenciones_sujetos_excluidos: retencionesSujetosExcluidos
            }
        },
        liquidacion_iva: {
            debito_fiscal_neto: debitoFiscalNeto,
            credito_fiscal_neto: creditoFiscalNeto,
            diferencia_impuesto: diferenciaIva,
            impuesto_determinado: impuestoDeterminado,
            remanente_credito_mes: remanenteCreditoMes,
            remanente_anterior: remanenteAnterior,
            retenciones_iva_sufridas: retencionesIvaSufridas,
            percepciones_iva_soportadas: percepcionesIvaSoportadas,
            total_acreditaciones: totalAcreditaciones,
            iva_pagar_operaciones: ivaPagarOperaciones,
            retenciones_sujetos_excluidos: retencionesSujetosExcluidos,
            total_iva_a_enterar: totalIvaEnterar,
            nuevo_remanente_credito: nuevoRemanenteCredito
        },
        pago_cuenta: {
            combustibles: {
                rubro: 'Combustibles (Gasolina y Diésel)',
                ingreso_bruto_neto: ingresoBrutoCombustible,
                tasa: fuelRate,
                cuota_calculada: pagoCuentaCombustible,
                nota: isPersonaNatural ? 'Persona Natural (Exenta 0.00% según Art. 151 inc. 3 CT)' : 'Persona Jurídica (Tasa especial 0.75% Art. 151 CT)'
            },
            otros: {
                rubro: 'Otros Productos y Servicios (General)',
                ingreso_bruto_neto: ingresoBrutoOtros,
                tasa: generalRate,
                cuota_calculada: pagoCuentaOtros,
                nota: 'Tasa general aplicable (1.75% Art. 151 CT)'
            },
            totales: {
                total_ingresos_brutos: totalIngresosBrutos,
                subtotal_pago_cuenta: subtotalPagoCuenta,
                retenciones_renta_sufridas: retencionesRentaSufridas,
                pago_cuenta_a_pagar: pagoCuentaPagar,
                remanente_pago_cuenta: remanentePagoCuenta
            }
        },
        resumen_f07: {
            total_iva_a_enterar: totalIvaEnterar,
            pago_cuenta_a_pagar: pagoCuentaPagar,
            total_f07: totalF07
        }
    };
};

/**
 * Endpoint JSON: Consulta de Liquidación de IVA y Pago a Cuenta
 */
const getVatLiquidationData = async (req, res) => {
    try {
        const { year, month, branch_id = 'all', remanente_anterior = 0, retenciones_renta_sufridas = 0, fuel_rate, general_rate } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!year || !month) return res.status(400).json({ message: 'Año y mes requeridos' });

        const data = await calculateVatLiquidation(companyId, year, month, branch_id, {
            remanente_anterior,
            retenciones_renta_sufridas,
            fuel_rate,
            general_rate
        });

        return res.json({ success: true, data });
    } catch (e) {
        console.error('[VAT Books] Error en Liquidacion IVA:', e);
        return res.status(500).json({ message: 'Error calculando liquidación de IVA', error: e.message });
    }
};

/**
 * Endpoint PDF: Reporte Oficial de Liquidación de IVA y Pago a Cuenta (F-07)
 */
const getVatLiquidationPDF = async (req, res) => {
    try {
        const { year, month, branch_id = 'all', remanente_anterior = 0, retenciones_renta_sufridas = 0, fuel_rate, general_rate } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!year || !month) return res.status(400).json({ message: 'Año y mes requeridos' });

        const data = await calculateVatLiquidation(companyId, year, month, branch_id, {
            remanente_anterior,
            retenciones_renta_sufridas,
            fuel_rate,
            general_rate
        });

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        // Encabezado institucional unificado
        reportPdfHelper.renderHeader(
            doc,
            data.meta.company,
            'LIQUIDACIÓN DE IVA Y PAGO A CUENTA (MANDAMIENTO F-07)',
            data.meta.periodText,
            'landscape',
            data.meta.branchName !== 'TODAS / CONSOLIDADO' ? `SUCURSAL: ${data.meta.branchName}` : null
        );

        let curY = doc.y + 4;
        const colWidth = 356;
        const col1X = 30;
        const col2X = 406;

        // Función auxiliar para dibujar cajas contables con encabezado
        const drawSectionBox = (x, y, width, height, title) => {
            doc.save();
            doc.roundedRect(x, y, width, height, 4).fillAndStroke('#ffffff', '#cbd5e1');
            doc.roundedRect(x, y, width, 16, 4).fill('#f1f5f9');
            doc.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(title.toUpperCase(), x + 8, y + 4.5);
            doc.restore();
        };

        const drawRow = (x, y, width, label, val, isBold = false, isNegative = false, isIndent = false) => {
            doc.fillColor(isBold ? '#0f172a' : '#475569')
                .fontSize(7)
                .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                .text((isIndent ? '   ' : '') + String(label), x + 8, y, { width: width - 100 });

            const formattedVal = reportPdfHelper.fmt(isNegative ? -Math.abs(n(val)) : n(val));
            doc.fillColor(isBold ? '#0f172a' : '#1e293b')
                .fontSize(7)
                .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
                .text(formattedVal, x + width - 90, y, { width: 82, align: 'right' });
        };

        // ==========================================
        // FILA 1: DÉBITO FISCAL (IZQ) Y CRÉDITO FISCAL (DER)
        // ==========================================
        const row1Height = 112;
        drawSectionBox(col1X, curY, colWidth, row1Height, '1. Débito Fiscal (Ventas del Período)');
        drawSectionBox(col2X, curY, colWidth, row1Height, '2. Crédito Fiscal (Compras del Período)');

        // Contenido Débito Fiscal
        let r1Y = curY + 20;
        drawRow(col1X, r1Y, colWidth, 'Comprobantes de Crédito Fiscal (03):', data.debito_fiscal.ccf.iva);
        r1Y += 12;
        drawRow(col1X, r1Y, colWidth, 'Facturas a Consumidor Final (01):', data.debito_fiscal.fcf.iva);
        r1Y += 12;
        drawRow(col1X, r1Y, colWidth, 'Otros Documentos de Débito:', data.debito_fiscal.otros.iva);
        r1Y += 12;
        drawRow(col1X, r1Y, colWidth, '(-) Notas de Crédito emitidas (05):', data.debito_fiscal.nc.iva, false, true);
        r1Y += 12;
        doc.moveTo(col1X + 8, r1Y + 1).lineTo(col1X + colWidth - 8, r1Y + 1).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        r1Y += 4;
        drawRow(col1X, r1Y, colWidth, 'TOTAL DÉBITO FISCAL NETO:', data.debito_fiscal.totales.neto, true);
        r1Y += 12;
        drawRow(col1X, r1Y, colWidth, 'Retenciones IVA 1% Sufridas:', data.debito_fiscal.totales.retenciones_sufridas_1pct, false, false, true);
        r1Y += 12;
        drawRow(col1X, r1Y, colWidth, 'Ventas Gravadas Netas:', data.debito_fiscal.totales.ventas_gravadas_netas, false, false, true);

        // Contenido Crédito Fiscal
        let r2Y = curY + 20;
        drawRow(col2X, r2Y, colWidth, 'Comprobantes de Crédito Fiscal (03):', data.credito_fiscal.ccf.iva);
        r2Y += 12;
        drawRow(col2X, r2Y, colWidth, 'Compras a Sujetos Excluidos (14):', data.credito_fiscal.sujetos_excluidos.retencion);
        r2Y += 12;
        drawRow(col2X, r2Y, colWidth, 'Otras Compras y Servicios:', data.credito_fiscal.otros.iva);
        r2Y += 12;
        drawRow(col2X, r2Y, colWidth, '(-) Notas de Crédito recibidas (05/06):', data.credito_fiscal.nc.iva, false, true);
        r2Y += 12;
        doc.moveTo(col2X + 8, r2Y + 1).lineTo(col2X + colWidth - 8, r2Y + 1).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        r2Y += 4;
        drawRow(col2X, r2Y, colWidth, 'TOTAL CRÉDITO FISCAL NETO:', data.credito_fiscal.totales.neto, true);
        r2Y += 12;
        drawRow(col2X, r2Y, colWidth, 'Percepciones IVA 1% Soportadas:', data.credito_fiscal.totales.percepciones_soportadas_1pct, false, false, true);
        r2Y += 12;
        drawRow(col2X, r2Y, colWidth, 'Compras Gravadas Netas:', data.credito_fiscal.totales.compras_gravadas_netas, false, false, true);

        curY += row1Height + 8;

        // ==========================================
        // FILA 2: LIQUIDACIÓN DE IVA (IZQ) Y PAGO A CUENTA (DER)
        // ==========================================
        const row2Height = 145;
        drawSectionBox(col1X, curY, colWidth, row2Height, '3. Liquidación Mensual de IVA (F-07)');
        drawSectionBox(col2X, curY, colWidth, row2Height, '4. Pago a Cuenta del Impuesto sobre la Renta (Art. 151 CT)');

        // Contenido Liquidación IVA
        let lY = curY + 20;
        drawRow(col1X, lY, colWidth, 'Total Débito Fiscal Neto:', data.liquidacion_iva.debito_fiscal_neto);
        lY += 11;
        drawRow(col1X, lY, colWidth, '(-) Total Crédito Fiscal Neto:', data.liquidacion_iva.credito_fiscal_neto, false, true);
        lY += 11;
        if (data.liquidacion_iva.impuesto_determinado > 0) {
            drawRow(col1X, lY, colWidth, 'Impuesto Determinado del Mes:', data.liquidacion_iva.impuesto_determinado, true);
        } else {
            drawRow(col1X, lY, colWidth, 'Remanente de Crédito del Mes:', -data.liquidacion_iva.remanente_credito_mes, true, true);
        }
        lY += 11;
        drawRow(col1X, lY, colWidth, '(-) Remanente de Crédito Mes Anterior:', data.liquidacion_iva.remanente_anterior, false, true);
        lY += 11;
        drawRow(col1X, lY, colWidth, '(-) Retenciones IVA 1% Sufridas:', data.liquidacion_iva.retenciones_iva_sufridas, false, true);
        lY += 11;
        drawRow(col1X, lY, colWidth, '(-) Percepciones IVA 1% Soportadas:', data.liquidacion_iva.percepciones_iva_soportadas, false, true);
        lY += 11;
        doc.moveTo(col1X + 8, lY + 1).lineTo(col1X + colWidth - 8, lY + 1).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        lY += 4;
        drawRow(col1X, lY, colWidth, 'IVA a Pagar por Operaciones Propias:', data.liquidacion_iva.iva_pagar_operaciones, true);
        lY += 11;
        drawRow(col1X, lY, colWidth, '(+) Retención 13% Sujetos Excluidos a Enterar:', data.liquidacion_iva.retenciones_sujetos_excluidos);
        lY += 11;
        doc.moveTo(col1X + 8, lY + 1).lineTo(col1X + colWidth - 8, lY + 1).lineWidth(0.75).strokeColor('#0f172a').stroke();
        lY += 4;
        drawRow(col1X, lY, colWidth, 'TOTAL IVA A PAGAR (F-07):', data.liquidacion_iva.total_iva_a_enterar, true);
        lY += 11;
        if (data.liquidacion_iva.nuevo_remanente_credito > 0) {
            drawRow(col1X, lY, colWidth, 'Remanente a Favor para el Próximo Mes:', data.liquidacion_iva.nuevo_remanente_credito, true);
        }

        // Contenido Pago a Cuenta Segregado
        let pY = curY + 20;
        const fuelNote = `Combustibles (${data.pago_cuenta.combustibles.tasa.toFixed(2)}%):`;
        drawRow(col2X, pY, colWidth, fuelNote, data.pago_cuenta.combustibles.cuota_calculada);
        pY += 9;
        doc.fontSize(6).font('Helvetica-Oblique').fillColor('#64748b')
            .text(`Base: ${reportPdfHelper.fmt(data.pago_cuenta.combustibles.ingreso_bruto_neto)} (${data.pago_cuenta.combustibles.nota})`, col2X + 16, pY);
        pY += 12;

        const otherNote = `Otros Rubros / General (${data.pago_cuenta.otros.tasa.toFixed(2)}%):`;
        drawRow(col2X, pY, colWidth, otherNote, data.pago_cuenta.otros.cuota_calculada);
        pY += 9;
        doc.fontSize(6).font('Helvetica-Oblique').fillColor('#64748b')
            .text(`Base: ${reportPdfHelper.fmt(data.pago_cuenta.otros.ingreso_bruto_neto)} (${data.pago_cuenta.otros.nota})`, col2X + 16, pY);
        pY += 13;

        drawRow(col2X, pY, colWidth, 'Subtotal Pago a Cuenta Determinado:', data.pago_cuenta.totales.subtotal_pago_cuenta, true);
        pY += 12;
        drawRow(col2X, pY, colWidth, '(-) Retenciones Renta Sufridas en el Mes:', data.pago_cuenta.totales.retenciones_renta_sufridas, false, true);
        pY += 12;
        doc.moveTo(col2X + 8, pY + 1).lineTo(col2X + colWidth - 8, pY + 1).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
        pY += 4;
        drawRow(col2X, pY, colWidth, 'TOTAL PAGO A CUENTA A PAGAR:', data.pago_cuenta.totales.pago_cuenta_a_pagar, true);
        pY += 12;
        if (data.pago_cuenta.totales.remanente_pago_cuenta > 0) {
            drawRow(col2X, pY, colWidth, 'Remanente Pago a Cuenta a Favor:', data.pago_cuenta.totales.remanente_pago_cuenta, true);
        }

        curY += row2Height + 10;

        // ==========================================
        // FILA 3: CUADRO CONSOLIDADO TOTAL MANDAMIENTO F-07
        // ==========================================
        const summaryWidth = 732;
        const summaryHeight = 36;
        doc.save();
        doc.roundedRect(30, curY, summaryWidth, summaryHeight, 4).fillAndStroke('#0f172a', '#0f172a');
        
        doc.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('RESUMEN DE OBLIGACIONES TRIBUTARIAS', 42, curY + 6);
        doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text('MANDAMIENTO CONSOLIDADO F-07 (MINISTERIO DE HACIENDA)', 42, curY + 17);

        doc.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica').text('TOTAL IVA A PAGAR:', 410, curY + 7);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(reportPdfHelper.fmt(data.resumen_f07.total_iva_a_enterar), 410, curY + 18);

        doc.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica').text('PAGO A CUENTA:', 520, curY + 7);
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(reportPdfHelper.fmt(data.resumen_f07.pago_cuenta_a_pagar), 520, curY + 18);

        doc.fillColor('#38bdf8').fontSize(7.5).font('Helvetica-Bold').text('TOTAL A ENTERAR F-07:', 630, curY + 7);
        doc.fillColor('#38bdf8').fontSize(11).font('Helvetica-Bold').text(reportPdfHelper.fmt(data.resumen_f07.total_f07), 630, curY + 17);
        doc.restore();

        curY += summaryHeight + 12;

        // Cierre estandarizado sin firmas
        reportPdfHelper.renderClosingFooter(doc, 30, curY, 2, 'Obligaciones Fiscales');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Liquidacion_IVA_F07_${year}_${month}.pdf"`);
        return res.send(buffer);
    } catch (e) {
        console.error('[VAT Books] Error Liquidacion IVA PDF:', e);
        res.status(500).json({ message: 'Error generando PDF de liquidación', error: e.message });
    }
};

/**
 * Endpoint Excel: Liquidación de IVA y Pago a Cuenta (F-07)
 */
const getVatLiquidationExcel = async (req, res) => {
    try {
        const { year, month, branch_id = 'all', remanente_anterior = 0, retenciones_renta_sufridas = 0, fuel_rate, general_rate } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!year || !month) return res.status(400).json({ message: 'Año y mes requeridos' });

        const data = await calculateVatLiquidation(companyId, year, month, branch_id, {
            remanente_anterior,
            retenciones_renta_sufridas,
            fuel_rate,
            general_rate
        });

        const rows = [
            { Concepto: '--- 1. DÉBITO FISCAL (VENTAS) ---', Base: '', IVA: '', Total: '' },
            { Concepto: 'Comprobantes de Crédito Fiscal (03)', Base: data.debito_fiscal.ccf.gravado.toFixed(2), IVA: data.debito_fiscal.ccf.iva.toFixed(2), Total: data.debito_fiscal.ccf.total.toFixed(2) },
            { Concepto: 'Facturas a Consumidor Final (01)', Base: data.debito_fiscal.fcf.gravado.toFixed(2), IVA: data.debito_fiscal.fcf.iva.toFixed(2), Total: data.debito_fiscal.fcf.total.toFixed(2) },
            { Concepto: 'Otros Documentos de Débito', Base: data.debito_fiscal.otros.gravado.toFixed(2), IVA: data.debito_fiscal.otros.iva.toFixed(2), Total: data.debito_fiscal.otros.total.toFixed(2) },
            { Concepto: '(-) Notas de Crédito emitidas (05)', Base: (-data.debito_fiscal.nc.gravado).toFixed(2), IVA: (-data.debito_fiscal.nc.iva).toFixed(2), Total: (-data.debito_fiscal.nc.total).toFixed(2) },
            { Concepto: 'TOTAL DÉBITO FISCAL NETO', Base: data.debito_fiscal.totales.ventas_gravadas_netas.toFixed(2), IVA: data.debito_fiscal.totales.neto.toFixed(2), Total: '' },
            { Concepto: '', Base: '', IVA: '', Total: '' },
            { Concepto: '--- 2. CRÉDITO FISCAL (COMPRAS) ---', Base: '', IVA: '', Total: '' },
            { Concepto: 'Comprobantes de Crédito Fiscal (03)', Base: data.credito_fiscal.ccf.gravado.toFixed(2), IVA: data.credito_fiscal.ccf.iva.toFixed(2), Total: data.credito_fiscal.ccf.total.toFixed(2) },
            { Concepto: 'Compras Sujetos Excluidos (14) - Retención 13%', Base: data.credito_fiscal.sujetos_excluidos.gravado.toFixed(2), IVA: data.credito_fiscal.sujetos_excluidos.retencion.toFixed(2), Total: data.credito_fiscal.sujetos_excluidos.total.toFixed(2) },
            { Concepto: 'Otras Compras y Servicios', Base: data.credito_fiscal.otros.gravado.toFixed(2), IVA: data.credito_fiscal.otros.iva.toFixed(2), Total: data.credito_fiscal.otros.total.toFixed(2) },
            { Concepto: '(-) Notas de Crédito recibidas (05/06)', Base: (-data.credito_fiscal.nc.gravado).toFixed(2), IVA: (-data.credito_fiscal.nc.iva).toFixed(2), Total: (-data.credito_fiscal.nc.total).toFixed(2) },
            { Concepto: 'TOTAL CRÉDITO FISCAL NETO', Base: data.credito_fiscal.totales.compras_gravadas_netas.toFixed(2), IVA: data.credito_fiscal.totales.neto.toFixed(2), Total: '' },
            { Concepto: '', Base: '', IVA: '', Total: '' },
            { Concepto: '--- 3. LIQUIDACIÓN DE IVA (F-07) ---', Base: '', IVA: '', Total: '' },
            { Concepto: 'Total Débito Fiscal Neto', Base: '', IVA: data.liquidacion_iva.debito_fiscal_neto.toFixed(2), Total: '' },
            { Concepto: '(-) Total Crédito Fiscal Neto', Base: '', IVA: (-data.liquidacion_iva.credito_fiscal_neto).toFixed(2), Total: '' },
            { Concepto: 'Impuesto Determinado del Mes', Base: '', IVA: data.liquidacion_iva.impuesto_determinado.toFixed(2), Total: '' },
            { Concepto: '(-) Remanente Crédito Mes Anterior', Base: '', IVA: (-data.liquidacion_iva.remanente_anterior).toFixed(2), Total: '' },
            { Concepto: '(-) Retenciones IVA 1% Sufridas', Base: '', IVA: (-data.liquidacion_iva.retenciones_iva_sufridas).toFixed(2), Total: '' },
            { Concepto: '(-) Percepciones IVA 1% Soportadas', Base: '', IVA: (-data.liquidacion_iva.percepciones_iva_soportadas).toFixed(2), Total: '' },
            { Concepto: 'IVA a Pagar Operaciones Propias', Base: '', IVA: data.liquidacion_iva.iva_pagar_operaciones.toFixed(2), Total: '' },
            { Concepto: '(+) Retención 13% Sujetos Excluidos a Enterar', Base: '', IVA: data.liquidacion_iva.retenciones_sujetos_excluidos.toFixed(2), Total: '' },
            { Concepto: 'TOTAL IVA A PAGAR (F-07)', Base: '', IVA: data.liquidacion_iva.total_iva_a_enterar.toFixed(2), Total: '' },
            { Concepto: 'Remanente a Favor para Próximo Mes', Base: '', IVA: data.liquidacion_iva.nuevo_remanente_credito.toFixed(2), Total: '' },
            { Concepto: '', Base: '', IVA: '', Total: '' },
            { Concepto: '--- 4. PAGO A CUENTA (ART. 151 CT) ---', Base: '', IVA: '', Total: '' },
            { Concepto: `Combustibles (${data.pago_cuenta.combustibles.tasa.toFixed(2)}%) - ${data.pago_cuenta.combustibles.nota}`, Base: data.pago_cuenta.combustibles.ingreso_bruto_neto.toFixed(2), IVA: '', Total: data.pago_cuenta.combustibles.cuota_calculada.toFixed(2) },
            { Concepto: `Otros Rubros / General (${data.pago_cuenta.otros.tasa.toFixed(2)}%)`, Base: data.pago_cuenta.otros.ingreso_bruto_neto.toFixed(2), IVA: '', Total: data.pago_cuenta.otros.cuota_calculada.toFixed(2) },
            { Concepto: 'Subtotal Pago a Cuenta Determinado', Base: data.pago_cuenta.totales.total_ingresos_brutos.toFixed(2), IVA: '', Total: data.pago_cuenta.totales.subtotal_pago_cuenta.toFixed(2) },
            { Concepto: '(-) Retenciones Renta Sufridas', Base: '', IVA: '', Total: (-data.pago_cuenta.totales.retenciones_renta_sufridas).toFixed(2) },
            { Concepto: 'TOTAL PAGO A CUENTA A PAGAR', Base: '', IVA: '', Total: data.pago_cuenta.totales.pago_cuenta_a_pagar.toFixed(2) },
            { Concepto: '', Base: '', IVA: '', Total: '' },
            { Concepto: '--- TOTAL CONSOLIDADO MANDAMIENTO F-07 ---', Base: '', IVA: '', Total: data.resumen_f07.total_f07.toFixed(2) }
        ];

        const buffer = await excelService.createExcelBuffer({
            sheets: [{
                name: 'Liquidacion F-07',
                columns: [
                    { header: 'Concepto / Rubro', key: 'Concepto', width: 45 },
                    { header: 'Base Imponible / Ingreso', key: 'Base', width: 25 },
                    { header: 'Débito / Crédito IVA', key: 'IVA', width: 22 },
                    { header: 'Cuota / Total a Pagar', key: 'Total', width: 25 }
                ],
                data: rows
            }]
        });

        return excelService.sendExcelResponse(res, buffer, `Liquidacion_IVA_F07_${year}_${month}.xlsx`);
    } catch (e) {
        console.error('[VAT Books] Error Liquidacion IVA Excel:', e);
        res.status(500).json({ message: 'Error exportando liquidación a Excel', error: e.message });
    }
};

module.exports = {
    getVatBookPurchasesPDF,
    getVatBookSalesTaxpayersPDF,
    getVatBookSalesConsumersPDF,
    getVatBookAnexosIVA,
    getVatBookAnexosIVAPDF,
    getVatBookAnexosIVAExcel,
    getVatLiquidationData,
    getVatLiquidationPDF,
    getVatLiquidationExcel
};
