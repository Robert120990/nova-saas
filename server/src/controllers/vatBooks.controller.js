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
 * Summary Box with extreme layout safety
 */
const drawPdfSummaryBox = (doc, x, y, totals, title = 'RESUMEN') => {
    try {
        const boxWidth = 250;
        const boxHeight = 140;

        if (y + boxHeight > 550) {
            doc.addPage();
            y = 30;
        }

        doc.save();
        doc.lineWidth(1).strokeColor('#e2e8f0').rect(x, y, boxWidth, boxHeight).stroke();
        doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold').text(String(title), x + 10, y + 10);
        
        let rowY = y + 35;
        const drawRow = (label, val, isBold = false) => {
            doc.fillColor('#475569').fontSize(8).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(String(label), x + 10, rowY);
            doc.fillColor('#1e293b').font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(`$${n(val).toFixed(2)}`, x + 150, rowY, { width: 90, align: 'right' });
            rowY += 14;
        };

        drawRow('Gravadas:', totals.grav);
        drawRow('Exentas:', totals.exe);
        drawRow('IVA:', totals.iva);
        drawRow('FOVIAL:', totals.fovial);
        drawRow('COTRANS:', totals.cotrans);
        drawRow('Retenciones/Percepciones:', totals.ret);
        
        doc.moveTo(x + 10, rowY).lineTo(x + boxWidth - 10, rowY).strokeColor('#cbd5e1').stroke();
        rowY += 5;
        drawRow('TOTAL GENERAL:', totals.total, true);
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

        if (req.query.format === 'excel') {
            const excelData = rows.map(r => ({
                Fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                'Tipo Doc': r.tipo_doc_nombre || '',
                'No. Documento': r.numero_documento || '',
                Proveedor: r.provider_nombre || 'S/N',
                NIT: r.provider_nit || '',
                NRC: r.provider_nrc || '',
                Exento: n(r.total_exenta).toFixed(2),
                Neto: n(r.total_gravada).toFixed(2),
                IVA: n(r.iva).toFixed(2),
                Total: n(r.monto_total).toFixed(2)
            }));
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
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

            rows.forEach(r => {
                if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                const g = n(r.total_gravada), e = n(r.total_exenta), i = n(r.iva);
                const f = n(r.fovial), c = n(r.cotrans), re = n(r.retencion) + n(r.percepcion), to = n(r.monto_total);

                doc.fontSize(7).font('Helvetica');
                doc.text(safeFormatDate(r.fecha), startX, currentY);
                doc.text(`${String(r.tipo_doc_nombre || '')} ${String(r.numero_documento || '')}`, startX + 50, currentY, { width: 95, truncate: true });
                doc.text(String(r.provider_nombre || 'S/N'), startX + 150, currentY, { width: 135, truncate: true });
                doc.text(String(r.provider_nit || ''), startX + 290, currentY, { width: 80, truncate: true });
                doc.text(`$${g.toFixed(2)}`, startX + 370, currentY, { width: 50, align: 'right' });
                doc.text(`$${e.toFixed(2)}`, startX + 420, currentY, { width: 50, align: 'right' });
                doc.text(`$${i.toFixed(2)}`, startX + 470, currentY, { width: 40, align: 'right' });
                doc.text(`$${f.toFixed(2)}`, startX + 510, currentY, { width: 40, align: 'right' });
                doc.text(`$${c.toFixed(2)}`, startX + 550, currentY, { width: 40, align: 'right' });
                doc.text(`$${re.toFixed(2)}`, startX + 590, currentY, { width: 50, align: 'right' });
                doc.text(`$${to.toFixed(2)}`, startX + 645, currentY, { width: 75, align: 'right' });

                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
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

        let whereClauses = ['sh.company_id = ?', 'YEAR(sh.fecha_emision) = ?', 'MONTH(sh.fecha_emision) = ?', "sh.tipo_documento = '03'", "sh.estado != 'ANULADO'", "(d.status IS NULL OR d.status != 'INVALIDADO')"];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('sh.branch_id = ?'); params.push(branch_id); }

        const query = `
            SELECT sh.*, c.nombre AS customer_nombre, c.nrc AS customer_nrc, c.nit AS customer_nit, COALESCE(d.numero_control, sh.numero_control) AS numero_control
            FROM sales_headers sh
            LEFT JOIN customers c ON sh.customer_id = c.id
            LEFT JOIN dtes d ON sh.id = d.venta_id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY sh.fecha_emision ASC, COALESCE(d.numero_control, sh.numero_control) ASC
        `;
        const [rows] = await pool.query(query, params);

        if (req.query.format === 'excel') {
            const excelData = rows.map(r => ({
                Fecha: new Date(r.fecha_emision).toLocaleDateString('es-SV'),
                'Tipo Doc': 'Crédito Fiscal',
                'No. Documento': r.numero_control || '---',
                Cliente: r.customer_nombre || 'CLIENTE S/N',
                NIT: r.customer_nit || '',
                NRC: r.customer_nrc || '',
                Exento: n(r.total_exento).toFixed(2),
                Neto: n(r.total_gravado).toFixed(2),
                IVA: n(r.total_iva).toFixed(2),
                FOVIAL: n(r.fovial).toFixed(2),
                COTRANS: n(r.cotrans).toFixed(2),
                'Ret/Per': (n(r.iva_retenido) + n(r.iva_percibido)).toFixed(2),
                Total: n(r.total_pagar).toFixed(2)
            }));
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
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

            rows.forEach(r => {
                if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                const g = n(r.total_gravado), e = n(r.total_exento), i = n(r.total_iva);
                const f = n(r.fovial), c = n(r.cotrans), re = n(r.iva_retenido) + n(r.iva_percibido), to = n(r.total_pagar);

                doc.fontSize(6.5).font('Helvetica');
                doc.text(safeFormatDate(r.fecha_emision), startX, currentY, { width: 36 });
                doc.text(cleanStr(r.numero_control || '---'), startX + 36, currentY, { width: 132 });
                doc.text(cleanStr(r.customer_nombre || 'CLIENTE S/N').toUpperCase(), startX + 168, currentY, { width: 227, height: 10, ellipsis: true });
                doc.text(cleanStr(r.customer_nrc || ''), startX + 395, currentY, { width: 41, height: 10, ellipsis: true });
                doc.text(`$${g.toFixed(2)}`, startX + 436, currentY, { width: 48, align: 'right' });
                doc.text(`$${e.toFixed(2)}`, startX + 484, currentY, { width: 42, align: 'right' });
                doc.text(`$${i.toFixed(2)}`, startX + 526, currentY, { width: 42, align: 'right' });
                doc.text(`$${f.toFixed(2)}`, startX + 568, currentY, { width: 30, align: 'right' });
                doc.text(`$${c.toFixed(2)}`, startX + 598, currentY, { width: 30, align: 'right' });
                doc.text(`$${re.toFixed(2)}`, startX + 628, currentY, { width: 42, align: 'right' });
                doc.text(`$${to.toFixed(2)}`, startX + 670, currentY, { width: 55, align: 'right' });

                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
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

        let whereClauses = ['sh.company_id = ?', 'YEAR(sh.fecha_emision) = ?', 'MONTH(sh.fecha_emision) = ?', "sh.tipo_documento = '01'", "sh.estado != 'ANULADO'", "(d.status IS NULL OR d.status != 'INVALIDADO')"];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('sh.branch_id = ?'); params.push(branch_id); }

        let rows;
        if (isResumen) {
            const query = `
                SELECT DATE(sh.fecha_emision) as fecha, MIN(d.numero_control) as num_desde, MAX(d.numero_control) as num_hasta,
                       SUM(sh.total_gravado) as t_grav, SUM(sh.total_exento) as t_exe, SUM(sh.total_iva) as t_iva,
                       SUM(sh.fovial) as t_fov, SUM(sh.cotrans) as t_cot, SUM(sh.total_pagar) as t_pagar
                FROM sales_headers sh
                LEFT JOIN dtes d ON sh.id = d.venta_id
                WHERE ${whereClauses.join(' AND ')}
                GROUP BY DATE(sh.fecha_emision)
                ORDER BY fecha ASC
            `;
            [rows] = await pool.query(query, params);
        } else {
            const query = `
                SELECT sh.fecha_emision as fecha, d.numero_control,
                       COALESCE(c.nombre, sh.cliente_nombre, 'CONSUMIDOR FINAL') as cliente,
                       COALESCE(c.nit, '') as nit,
                       sh.total_gravado, sh.total_exento, sh.total_iva,
                       sh.fovial, sh.cotrans, sh.total_pagar
                FROM sales_headers sh
                LEFT JOIN dtes d ON sh.id = d.venta_id
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
                const excelData = rows.map(r => ({
                    'N° Control': r.numero_control || 'SIN DTE',
                    Fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                    Cliente: r.cliente || 'CONSUMIDOR FINAL',
                    NIT: r.nit || '',
                    Exento: n(r.total_exento).toFixed(2),
                    Neto: n(r.total_gravado).toFixed(2),
                    IVA: n(r.total_iva).toFixed(2),
                    FOVIAL: n(r.fovial).toFixed(2),
                    COTRANS: n(r.cotrans).toFixed(2),
                    Total: n(r.total_pagar).toFixed(2)
                }));
                const buffer = await excelService.createExcelBuffer({
                    sheets: [{ name: 'Detalle FAC', columns: [
                        { header: 'N° Control', key: 'N° Control', width: 22 },
                        { header: 'Fecha', key: 'Fecha', width: 14 },
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
                let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

                rows.forEach(r => {
                    if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                    const gNeto = n(r.t_grav), i = n(r.t_iva);
                    const g = gNeto + i;
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
                let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

                rows.forEach(r => {
                    if (currentY > 540) { doc.addPage(); currentY = drawDetailHeader(30); }
                    const gNeto = n(r.total_gravado), i = n(r.total_iva);
                    const g = gNeto + i;
                    const e = n(r.total_exento);
                    const f = n(r.fovial), c = n(r.cotrans), to = n(r.total_pagar);

                    doc.fontSize(6.5).font('Helvetica');
                    doc.text(String(r.numero_control || 'SIN DTE'), startX, currentY, { width: 115, truncate: true });
                    doc.text(safeFormatDate(r.fecha), startX + 120, currentY, { width: 60 });
                    doc.text(String(r.cliente || 'CONSUMIDOR FINAL'), startX + 185, currentY, { width: 135, truncate: true });
                    doc.text(String(r.nit || ''), startX + 325, currentY, { width: 85, truncate: true });
                    doc.text(`$${g.toFixed(2)}`, startX + 415, currentY, { width: 55, align: 'right' });
                    doc.text(`$${e.toFixed(2)}`, startX + 475, currentY, { width: 50, align: 'right' });
                    doc.text(`$${i.toFixed(2)}`, startX + 530, currentY, { width: 40, align: 'right' });
                    doc.text(`$${f.toFixed(2)}`, startX + 575, currentY, { width: 35, align: 'right' });
                    doc.text(`$${c.toFixed(2)}`, startX + 615, currentY, { width: 35, align: 'right' });
                    doc.text(`$${to.toFixed(2)}`, startX + 655, currentY, { width: 55, align: 'right' });

                    t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.total += to;
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

module.exports = {
    getVatBookPurchasesPDF,
    getVatBookSalesTaxpayersPDF,
    getVatBookSalesConsumersPDF
};
