const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const excelService = require('../services/excel.service');

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
    if (!date) return '---';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '---';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch (e) {
        return '---';
    }
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
 * Requiere el alias `d` del DTE_JOIN_SQL.
 */
const DTE_VALIDO_SQL = `(
    d.venta_id IS NOT NULL
    AND d.status NOT IN ('REJECTED', 'ERROR', 'INVALIDADO')
)`;

/**
 * Summary Box with extreme layout safety and credit notes support
 */
const drawPdfSummaryBox = (doc, x, y, totals, title = 'RESUMEN') => {
    try {
        const hasNc = (totals.nc_total && totals.nc_total > 0) || (totals.nc_grav && totals.nc_grav > 0);
        const boxWidth = 250;
        const boxHeight = hasNc ? 165 : 140;

        if (y + boxHeight > 550) {
            doc.addPage();
            y = 30;
        }

        doc.save();
        doc.lineWidth(1).strokeColor('#e2e8f0').rect(x, y, boxWidth, boxHeight).stroke();
        doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold').text(String(title), x + 10, y + 8);
        
        let rowY = y + 25;
        const drawRow = (label, val, isBold = false, isNegative = false) => {
            doc.fillColor(isBold ? '#1e293b' : '#475569').fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(String(label), x + 10, rowY);
            const formattedVal = isNegative ? `-$${Math.abs(n(val)).toFixed(2)}` : `$${n(val).toFixed(2)}`;
            doc.fillColor(isBold ? '#1e293b' : '#334155').font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(formattedVal, x + 150, rowY, { width: 90, align: 'right' });
            rowY += 13;
        };

        if (hasNc) {
            drawRow('Total Bruto:', totals.bruto_total || (totals.total + (totals.nc_total || 0)));
            drawRow('(-) Notas de Crédito:', totals.nc_total, false, true);
            doc.moveTo(x + 10, rowY).lineTo(x + boxWidth - 10, rowY).strokeColor('#e2e8f0').stroke();
            rowY += 3;
        }

        drawRow(hasNc ? 'Gravadas Netas:' : 'Gravadas:', totals.grav);
        drawRow('Exentas:', totals.exe);
        drawRow(hasNc ? 'IVA Neto:' : 'IVA:', totals.iva);
        if (totals.fovial > 0 || totals.cotrans > 0) {
            drawRow('FOVIAL:', totals.fovial);
            drawRow('COTRANS:', totals.cotrans);
        }
        if (totals.ret !== undefined) {
            drawRow('Retenciones/Percepciones:', totals.ret);
        }
        
        doc.moveTo(x + 10, rowY).lineTo(x + boxWidth - 10, rowY).strokeColor('#cbd5e1').stroke();
        rowY += 4;
        drawRow(hasNc ? 'TOTAL GENERAL NETO:' : 'TOTAL GENERAL:', totals.total, true);
        doc.restore();
    } catch (err) {
        console.error('[VAT Books] Error drawing summary box:', err);
    }
};

/**
 * Promise-based PDF Buffer Generator
 */
const generatePdfBuffer = (setupFn) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ layout: 'landscape', margin: 30, size: 'LETTER', autoFirstPage: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => {
                console.error('[VAT Books] PDF Stream Error:', err);
                reject(err);
            });
            
            setupFn(doc);
            doc.end();
        } catch (e) {
            console.error('[VAT Books] PDF Generation Exception:', e);
            reject(e);
        }
    });
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

        const [companies] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const company = companies[0] || { razon_social: 'EMPRESA' };
        
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
                    Fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
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

        const buffer = await generatePdfBuffer((doc) => {
            // Header
            doc.fontSize(14).font('Helvetica-Bold').text(String(company.razon_social), 30, 30);
            doc.fontSize(8).font('Helvetica').text(`NIT: ${String(company.nit || '')}  NRC: ${String(company.nrc || '')}`, 30, 48);
            doc.fontSize(8).font('Helvetica-Bold').text(`SUCURSAL: ${String(branchName)}`, 30, 58);
            doc.fontSize(12).font('Helvetica-Bold').text('LIBRO DE COMPRAS (IVA)', 30, 30, { align: 'right' });
            doc.fontSize(10).text(`MES: ${String(month)} / AÑO: ${String(year)}`, 30, 45, { align: 'right' });
            doc.moveDown(3);

            const startX = 30;
            let currentY = doc.y;
            const drawHeader = (y) => {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('FECHA', startX, y);
                doc.text('DOCUMENTO', startX + 50, y);
                doc.text('PROVEEDOR', startX + 150, y);
                doc.text('NIT/NRC', startX + 290, y);
                doc.text('GRAVADA', startX + 370, y, { width: 50, align: 'right' });
                doc.text('EXENTA', startX + 420, y, { width: 50, align: 'right' });
                doc.text('IVA', startX + 470, y, { width: 40, align: 'right' });
                doc.text('FOV', startX + 510, y, { width: 40, align: 'right' });
                doc.text('COT', startX + 550, y, { width: 40, align: 'right' });
                doc.text('RET/PER', startX + 590, y, { width: 50, align: 'right' });
                doc.text('TOTAL', startX + 645, y, { width: 75, align: 'right' });
                doc.moveTo(startX, y + 10).lineTo(startX + 720, y + 10).stroke();
                return y + 15;
            };

            currentY = drawHeader(currentY);
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, nc_iva: 0, bruto_total: 0 };

            rows.forEach(r => {
                if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                const esNC = isNotaCreditoCompra(r);
                const g = n(r.total_gravada), e = n(r.total_exenta), i = n(r.iva);
                const f = n(r.fovial), c = n(r.cotrans), re = n(r.retencion) + n(r.percepcion), to = n(r.monto_total);

                doc.fontSize(7).font('Helvetica');
                doc.text(safeFormatDate(r.fecha), startX, currentY);
                doc.text(`${String(r.tipo_doc_nombre || '')} ${String(r.numero_documento || '')}`, startX + 50, currentY, { width: 95, truncate: true });
                doc.text(String(r.provider_nombre || 'S/N'), startX + 150, currentY, { width: 135, truncate: true });
                doc.text(String(r.provider_nit || ''), startX + 290, currentY, { width: 80, truncate: true });

                const fmtAmount = (val) => esNC ? `-$${val.toFixed(2)}` : `$${val.toFixed(2)}`;
                doc.text(fmtAmount(g), startX + 370, currentY, { width: 50, align: 'right' });
                doc.text(fmtAmount(e), startX + 420, currentY, { width: 50, align: 'right' });
                doc.text(fmtAmount(i), startX + 470, currentY, { width: 40, align: 'right' });
                doc.text(fmtAmount(f), startX + 510, currentY, { width: 40, align: 'right' });
                doc.text(fmtAmount(c), startX + 550, currentY, { width: 40, align: 'right' });
                doc.text(fmtAmount(re), startX + 590, currentY, { width: 50, align: 'right' });
                doc.text(fmtAmount(to), startX + 645, currentY, { width: 75, align: 'right' });

                if (esNC) {
                    t.grav -= g; t.exe -= e; t.iva -= i; t.fovial -= f; t.cotrans -= c; t.ret -= re; t.total -= to;
                    t.nc_total += to; t.nc_grav += g; t.nc_iva += i;
                } else {
                    t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
                    t.bruto_total += to;
                }
                currentY += 13;
            });
            drawPdfSummaryBox(doc, 480, currentY + 15, t, 'RESUMEN DE COMPRAS');
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Libro_Compras_${month}_${year}.pdf"`);
        res.send(buffer);
    } catch (e) {
        console.error('[VAT Books] Error Purchases PDF:', e);
        res.status(500).json({ message: 'Error', error: e.message });
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

        const [companies] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const company = companies[0] || { razon_social: 'EMPRESA' };

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
                    Fecha: new Date(r.fecha_emision).toLocaleDateString('es-SV'),
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

        const buffer = await generatePdfBuffer((doc) => {
            doc.fontSize(14).font('Helvetica-Bold').text(String(company.razon_social), 30, 30);
            doc.fontSize(8).font('Helvetica').text(`NIT: ${String(company.nit || '')}  NRC: ${String(company.nrc || '')}`, 30, 48);
            doc.fontSize(8).font('Helvetica-Bold').text(`SUCURSAL: ${String(branchName)}`, 30, 58);
            doc.fontSize(12).font('Helvetica-Bold').text('LIBRO DE VENTAS A CONTRIBUYENTES', 30, 30, { align: 'right' });
            doc.fontSize(10).text(`MES: ${String(month)} / AÑO: ${String(year)}`, 30, 45, { align: 'right' });
            doc.moveDown(3);

            const startX = 30;
            let currentY = doc.y;
            const drawHeader = (y) => {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('FECHA', startX, y, { width: 36 });
                doc.text('DOCUMENTO', startX + 36, y, { width: 132 });
                doc.text('CLIENTE', startX + 168, y, { width: 227 });
                doc.text('NRC', startX + 395, y, { width: 41 });
                doc.text('GRAVADA', startX + 436, y, { width: 48, align: 'right' });
                doc.text('EXENTA', startX + 484, y, { width: 42, align: 'right' });
                doc.text('IVA DEB.', startX + 526, y, { width: 42, align: 'right' });
                doc.text('FOV', startX + 568, y, { width: 30, align: 'right' });
                doc.text('COT', startX + 598, y, { width: 30, align: 'right' });
                doc.text('RET/PER', startX + 628, y, { width: 42, align: 'right' });
                doc.text('TOTAL', startX + 670, y, { width: 55, align: 'right' });
                doc.moveTo(startX, y + 10).lineTo(startX + 725, y + 10).stroke();
                return y + 15;
            };

            currentY = drawHeader(currentY);
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, nc_iva: 0, bruto_total: 0 };

            rows.forEach(r => {
                if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                const esNC = r.tipo_documento === '05';
                const g = n(r.total_gravado), e = n(r.total_exento), i = n(r.total_iva);
                const f = n(r.fovial), c = n(r.cotrans), re = n(r.iva_retenido) + n(r.iva_percibido), to = n(r.total_pagar);

                doc.fontSize(6.5).font('Helvetica');
                doc.text(safeFormatDate(r.fecha_emision), startX, currentY, { width: 36 });
                doc.text(cleanStr(r.numero_control || '---'), startX + 36, currentY, { width: 132 });
                doc.text(cleanStr(r.customer_nombre || 'CLIENTE S/N').toUpperCase(), startX + 168, currentY, { width: 227, height: 10, ellipsis: true });
                doc.text(cleanStr(r.customer_nrc || ''), startX + 395, currentY, { width: 41, height: 10, ellipsis: true });

                const fmtAmount = (val) => esNC ? `-$${val.toFixed(2)}` : `$${val.toFixed(2)}`;
                doc.text(fmtAmount(g), startX + 436, currentY, { width: 48, align: 'right' });
                doc.text(fmtAmount(e), startX + 484, currentY, { width: 42, align: 'right' });
                doc.text(fmtAmount(i), startX + 526, currentY, { width: 42, align: 'right' });
                doc.text(fmtAmount(f), startX + 568, currentY, { width: 30, align: 'right' });
                doc.text(fmtAmount(c), startX + 598, currentY, { width: 30, align: 'right' });
                doc.text(fmtAmount(re), startX + 628, currentY, { width: 42, align: 'right' });
                doc.text(fmtAmount(to), startX + 670, currentY, { width: 55, align: 'right' });

                if (esNC) {
                    t.grav -= g; t.exe -= e; t.iva -= i; t.fovial -= f; t.cotrans -= c; t.ret -= re; t.total -= to;
                    t.nc_total += to; t.nc_grav += g; t.nc_iva += i;
                } else {
                    t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
                    t.bruto_total += to;
                }
                currentY += 13;
            });
            drawPdfSummaryBox(doc, 505, currentY + 15, t, 'RESUMEN VENTAS CCF');
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Libro_CCF_${month}_${year}.pdf"`);
        res.send(buffer);
    } catch (e) { console.error('[VAT Books] Error CCF:', e); res.status(500).json({ message: 'Error', error: e.message }); }
};

/**
 * 3. Libro de FAC
 */
const getVatBookSalesConsumersPDF = async (req, res) => {
    try {
        const { year, month, branch_id, resumen } = req.query;
        const companyId = req.company_id || req.user?.company_id;
        const isResumen = resumen !== 'false';

        console.log(`[VAT Books] Generating FAC: Co=${companyId}, Period=${year}-${month}, Branch=${branch_id}`);

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const [companies] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const company = companies[0] || { razon_social: 'EMPRESA' };

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
                    Fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
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
                        Fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
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

        const buffer = await generatePdfBuffer((doc) => {
            doc.fontSize(14).font('Helvetica-Bold').text(String(company.razon_social), 30, 30);
            doc.fontSize(8).font('Helvetica').text(`NIT: ${String(company.nit || '')}  NRC: ${String(company.nrc || '')}`, 30, 48);
            doc.fontSize(8).font('Helvetica-Bold').text(`SUCURSAL: ${String(branchName)}`, 30, 58);
            doc.fontSize(12).font('Helvetica-Bold').text('LIBRO DE VENTAS A CONSUMIDOR FINAL', 30, 30, { align: 'right' });
            doc.fontSize(10).text(`${isResumen ? 'RESUMEN' : 'DETALLE'} — MES: ${String(month)} / AÑO: ${String(year)}`, 30, 45, { align: 'right' });
            doc.moveDown(3);

            const startX = 30;
            let currentY = doc.y;

            if (isResumen) {
                const drawHeader = (y) => {
                    doc.fontSize(7).font('Helvetica-Bold');
                    doc.text('FECHA', startX, y);
                    doc.text('DEL No.', startX + 55, y);
                    doc.text('AL No.', startX + 195, y);
                    doc.text('GRAVADO', startX + 335, y, { width: 60, align: 'right' });
                    doc.text('EXENTO', startX + 395, y, { width: 55, align: 'right' });
                    doc.text('IVA', startX + 450, y, { width: 45, align: 'right' });
                    doc.text('FOVIAL', startX + 495, y, { width: 45, align: 'right' });
                    doc.text('COTRANS', startX + 540, y, { width: 45, align: 'right' });
                    doc.text('TOTAL', startX + 585, y, { width: 70, align: 'right' });
                    doc.moveTo(startX, y + 10).lineTo(startX + 655, y + 10).stroke();
                    return y + 15;
                };

                currentY = drawHeader(currentY);
                let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, bruto_total: 0 };

                rows.forEach(r => {
                    if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                    const g = n(r.t_grav), i = n(r.t_iva);
                    const e = n(r.t_exe);
                    const f = n(r.t_fov), c = n(r.t_cot), to = n(r.t_pagar);

                    doc.fontSize(7).font('Helvetica');
                    doc.text(safeFormatDate(r.fecha), startX, currentY);
                    doc.text(String(r.num_desde || '---'), startX + 55, currentY, { width: 135, truncate: true });
                    doc.text(String(r.num_hasta || '---'), startX + 195, currentY, { width: 135, truncate: true });
                    doc.text(`$${g.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                    doc.text(`$${e.toFixed(2)}`, startX + 395, currentY, { width: 50, align: 'right' });
                    doc.text(`$${i.toFixed(2)}`, startX + 450, currentY, { width: 40, align: 'right' });
                    doc.text(`$${f.toFixed(2)}`, startX + 495, currentY, { width: 40, align: 'right' });
                    doc.text(`$${c.toFixed(2)}`, startX + 540, currentY, { width: 40, align: 'right' });
                    doc.text(`$${to.toFixed(2)}`, startX + 585, currentY, { width: 65, align: 'right' });

                    t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.total += to;
                    t.nc_total += n(r.nc_total); t.nc_grav += n(r.nc_grav); t.bruto_total += n(r.bruto_total);
                    currentY += 13;
                });
                drawPdfSummaryBox(doc, 420, currentY + 15, t, 'RESUMEN VENTAS FAC');
            } else {
                const drawDetailHeader = (y) => {
                    doc.fontSize(6.5).font('Helvetica-Bold');
                    doc.text('N° CONTROL', startX, y);
                    doc.text('FECHA', startX + 120, y);
                    doc.text('CLIENTE', startX + 185, y);
                    doc.text('NIT', startX + 325, y);
                    doc.text('GRAVADO', startX + 415, y, { width: 55, align: 'right' });
                    doc.text('EXENTO', startX + 475, y, { width: 50, align: 'right' });
                    doc.text('IVA', startX + 530, y, { width: 40, align: 'right' });
                    doc.text('FOVIAL', startX + 575, y, { width: 35, align: 'right' });
                    doc.text('COTRANS', startX + 615, y, { width: 35, align: 'right' });
                    doc.text('TOTAL', startX + 655, y, { width: 55, align: 'right' });
                    doc.moveTo(startX, y + 10).lineTo(startX + 710, y + 10).stroke();
                    return y + 15;
                };

                currentY = drawDetailHeader(currentY);
                let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0, nc_total: 0, nc_grav: 0, nc_iva: 0, bruto_total: 0 };

                rows.forEach(r => {
                    if (currentY > 540) { doc.addPage(); currentY = drawDetailHeader(30); }
                    const esNC = r.tipo_documento === '05';
                    const g = n(r.total_gravado), i = n(r.total_iva);
                    const e = n(r.total_exento);
                    const f = n(r.fovial), c = n(r.cotrans), to = n(r.total_pagar);

                    doc.fontSize(6.5).font('Helvetica');
                    doc.text(String(r.numero_control || 'SIN DTE'), startX, currentY, { width: 115, truncate: true });
                    doc.text(safeFormatDate(r.fecha), startX + 120, currentY, { width: 60 });
                    doc.text(String(r.cliente || 'CONSUMIDOR FINAL'), startX + 185, currentY, { width: 135, truncate: true });
                    doc.text(String(r.nit || ''), startX + 325, currentY, { width: 85, truncate: true });

                    const fmtAmount = (val) => esNC ? `-$${val.toFixed(2)}` : `$${val.toFixed(2)}`;
                    doc.text(fmtAmount(g), startX + 415, currentY, { width: 55, align: 'right' });
                    doc.text(fmtAmount(e), startX + 475, currentY, { width: 50, align: 'right' });
                    doc.text(fmtAmount(i), startX + 530, currentY, { width: 40, align: 'right' });
                    doc.text(fmtAmount(f), startX + 575, currentY, { width: 35, align: 'right' });
                    doc.text(fmtAmount(c), startX + 615, currentY, { width: 35, align: 'right' });
                    doc.text(fmtAmount(to), startX + 655, currentY, { width: 55, align: 'right' });

                    if (esNC) {
                        t.grav -= g; t.exe -= e; t.iva -= i; t.fovial -= f; t.cotrans -= c; t.total -= to;
                        t.nc_total += to; t.nc_grav += g; t.nc_iva += i;
                    } else {
                        t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.total += to;
                        t.bruto_total += to;
                    }
                    currentY += 11;
                });
                drawPdfSummaryBox(doc, 420, currentY + 15, t, 'RESUMEN VENTAS FAC');
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Libro_FAC_${month}_${year}.pdf"`);
        res.send(buffer);
    } catch (e) { console.error('[VAT Books] Error FAC:', e); res.status(500).json({ message: 'Error', error: e.message }); }
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
        const companyId = req.company_id || req.user?.company_id;
        const branchId = req.user?.branch_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const { fecha_inicio, fecha_fin, tipo_dte, search = '' } = req.query;

        const [companies] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const company = companies[0] || { razon_social: 'EMPRESA' };

        let branchName = '---';
        if (branchId) {
            const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
            branchName = branches[0]?.nombre || '---';
        }

        const { dataQuery, params } = buildAnexosIVAQuery({
            companyId, branchId, fecha_inicio, fecha_fin, tipo_dte, search
        });
        const [rows] = await pool.query(dataQuery, params);

        const buffer = await generatePdfBuffer((doc) => {
            doc.fontSize(14).font('Helvetica-Bold').text(String(company.razon_social), 30, 30);
            doc.fontSize(8).font('Helvetica').text(`NIT: ${String(company.nit || '')}  NRC: ${String(company.nrc || '')}`, 30, 48);
            doc.fontSize(8).font('Helvetica-Bold').text(`SUCURSAL: ${String(branchName)}`, 30, 58);
            doc.fontSize(12).font('Helvetica-Bold').text('ANEXOS DE IVA', 30, 30, { align: 'right' });
            doc.fontSize(10).text(`PERIODO: ${String(fecha_inicio || '---')} AL ${String(fecha_fin || '---')}`, 30, 45, { align: 'right' });
            doc.moveDown(3);

            const startX = 30;
            let currentY = doc.y;

            const drawHeader = (y) => {
                doc.fontSize(6).font('Helvetica-Bold');
                doc.text('N°', startX, y, { width: 20 });
                doc.text('FECHA', startX + 20, y, { width: 48 });
                doc.text('COD. GENERACIÓN', startX + 68, y, { width: 110 });
                doc.text('N° CONTROL', startX + 178, y, { width: 80 });
                doc.text('SELLO RECEPCIÓN', startX + 258, y, { width: 90 });
                doc.text('ESTADO', startX + 348, y, { width: 56 });
                doc.text('CLIENTE', startX + 404, y, { width: 130 });
                doc.text('NIT', startX + 534, y, { width: 65 });
                doc.text('NRC', startX + 599, y, { width: 40 });
                doc.text('TIPO', startX + 639, y, { width: 30 });
                doc.text('EXENTA', startX + 669, y, { width: 38, align: 'right' });
                doc.text('GRAVADA', startX + 707, y, { width: 44, align: 'right' });
                doc.text('IVA', startX + 751, y, { width: 36, align: 'right' });
                doc.text('RET', startX + 787, y, { width: 30, align: 'right' });
                doc.text('FOV', startX + 817, y, { width: 26, align: 'right' });
                doc.text('COT', startX + 843, y, { width: 26, align: 'right' });
                doc.text('TOTAL', startX + 869, y, { width: 40, align: 'right' });
                doc.moveTo(startX, y + 9).lineTo(startX + 909, y + 9).stroke();
                return y + 14;
            };

            currentY = drawHeader(currentY);
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

            rows.forEach((r, idx) => {
                if (currentY > 545) { doc.addPage(); currentY = drawHeader(30); }
                const g = n(r.total_gravado), e = n(r.total_exento), i = n(r.total_iva);
                const f = n(r.fovial), c = n(r.cotrans), re = n(r.iva_retenido) + n(r.iva_percibido), to = n(r.total_pagar);

                doc.fontSize(6).font('Helvetica');
                doc.text(String(idx + 1), startX, currentY, { width: 20 });
                doc.text(safeFormatDate(r.fecha_emision), startX + 20, currentY, { width: 46 });
                doc.text(cleanStr(r.codigo_generacion || '---'), startX + 68, currentY, { width: 108, truncate: true });
                doc.text(cleanStr(r.numero_control || '---'), startX + 178, currentY, { width: 78, truncate: true });
                doc.text(cleanStr(r.sello_recepcion || '---'), startX + 258, currentY, { width: 88, truncate: true });
                doc.text(cleanStr(r.estado || 'PENDIENTE'), startX + 348, currentY, { width: 54, truncate: true });
                doc.text(String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(), startX + 404, currentY, { width: 128, truncate: true });
                doc.text(cleanStr(r.nit || ''), startX + 534, currentY, { width: 63, truncate: true });
                doc.text(cleanStr(r.nrc || ''), startX + 599, currentY, { width: 38, truncate: true });
                doc.text(cleanStr(r.tipo_dte || r.tipo_documento), startX + 639, currentY, { width: 28, truncate: true });
                doc.text(`$${e.toFixed(2)}`, startX + 669, currentY, { width: 38, align: 'right' });
                doc.text(`$${g.toFixed(2)}`, startX + 707, currentY, { width: 44, align: 'right' });
                doc.text(`$${i.toFixed(2)}`, startX + 751, currentY, { width: 36, align: 'right' });
                doc.text(`$${re.toFixed(2)}`, startX + 787, currentY, { width: 30, align: 'right' });
                doc.text(`$${f.toFixed(2)}`, startX + 817, currentY, { width: 26, align: 'right' });
                doc.text(`$${c.toFixed(2)}`, startX + 843, currentY, { width: 26, align: 'right' });
                doc.text(`$${to.toFixed(2)}`, startX + 869, currentY, { width: 40, align: 'right' });

                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
                currentY += 11;
            });
            drawPdfSummaryBox(doc, 560, currentY + 15, t, 'RESUMEN ANEXOS IVA');
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Anexos_IVA_${fecha_inicio || 'inicio'}_${fecha_fin || 'fin'}.pdf"`);
        res.send(buffer);
    } catch (e) {
        console.error('[VAT Books] Error Anexos IVA PDF:', e);
        res.status(500).json({ message: 'Error', error: e.message });
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
