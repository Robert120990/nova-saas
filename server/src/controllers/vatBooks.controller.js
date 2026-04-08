const pool = require('../config/db');
const PDFDocument = require('pdfkit');

/**
 * Extreme defensive parsing: Ensures everything is a string or number as expected
 */
const n = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
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

        let whereClauses = ['sh.company_id = ?', 'YEAR(sh.fecha_emision) = ?', 'MONTH(sh.fecha_emision) = ?', "sh.tipo_documento = '03'", "sh.estado != 'ANULADO'"];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('sh.branch_id = ?'); params.push(branch_id); }

        const query = `
            SELECT sh.*, c.nombre AS customer_nombre, c.nrc AS customer_nrc, d.numero_control
            FROM sales_headers sh
            LEFT JOIN customers c ON sh.customer_id = c.id
            LEFT JOIN dtes d ON sh.id = d.venta_id
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY sh.fecha_emision ASC, d.numero_control ASC
        `;
        const [rows] = await pool.query(query, params);

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
                doc.text('FECHA', startX, y);
                doc.text('DOCUMENTO', startX + 50, y);
                doc.text('CLIENTE', startX + 125, y);
                doc.text('NRC', startX + 260, y);
                doc.text('GRAVADA', startX + 310, y, { width: 50, align: 'right' });
                doc.text('EXENTA', startX + 365, y, { width: 50, align: 'right' });
                doc.text('IVA DEB.', startX + 420, y, { width: 45, align: 'right' });
                doc.text('FOV', startX + 470, y, { width: 40, align: 'right' });
                doc.text('COT', startX + 515, y, { width: 40, align: 'right' });
                doc.text('RET/PER', startX + 560, y, { width: 45, align: 'right' });
                doc.text('TOTAL', startX + 615, y, { width: 65, align: 'right' });
                doc.moveTo(startX, y + 10).lineTo(startX + 680, y + 10).stroke();
                return y + 15;
            };

            currentY = drawHeader(currentY);
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

            rows.forEach(r => {
                if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                const g = n(r.total_gravado), e = n(r.total_exento), i = n(r.total_iva);
                const f = n(r.fovial), c = n(r.cotrans), re = n(r.iva_retenido) + n(r.iva_percibido), to = n(r.total_pagar);

                doc.fontSize(7).font('Helvetica');
                doc.text(safeFormatDate(r.fecha_emision), startX, currentY);
                doc.text(String(r.numero_control || '---'), startX + 50, currentY, { width: 70, truncate: true });
                doc.text(String(r.customer_nombre || 'CLIENTE S/N'), startX + 125, currentY, { width: 130, truncate: true });
                doc.text(String(r.customer_nrc || ''), startX + 260, currentY);
                doc.text(`$${g.toFixed(2)}`, startX + 310, currentY, { width: 50, align: 'right' });
                doc.text(`$${e.toFixed(2)}`, startX + 365, currentY, { width: 50, align: 'right' });
                doc.text(`$${i.toFixed(2)}`, startX + 420, currentY, { width: 45, align: 'right' });
                doc.text(`$${f.toFixed(2)}`, startX + 470, currentY, { width: 40, align: 'right' });
                doc.text(`$${c.toFixed(2)}`, startX + 515, currentY, { width: 40, align: 'right' });
                doc.text(`$${re.toFixed(2)}`, startX + 560, currentY, { width: 45, align: 'right' });
                doc.text(`$${to.toFixed(2)}`, startX + 615, currentY, { width: 65, align: 'right' });

                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.ret += re; t.total += to;
                currentY += 13;
            });
            drawPdfSummaryBox(doc, 440, currentY + 15, t, 'RESUMEN VENTAS CCF');
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
        const { year, month, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        console.log(`[VAT Books] Generating FAC: Co=${companyId}, Period=${year}-${month}, Branch=${branch_id}`);

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const [companies] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const company = companies[0] || { razon_social: 'EMPRESA' };

        let branchName = 'TODAS / CONSOLIDADO';
        if (branch_id && branch_id !== 'all') {
            const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            branchName = branches[0]?.nombre || '---';
        }

        let whereClauses = ['sh.company_id = ?', 'YEAR(sh.fecha_emision) = ?', 'MONTH(sh.fecha_emision) = ?', "sh.tipo_documento = '01'", "sh.estado != 'ANULADO'"];
        let params = [companyId, year, month];
        if (branch_id && branch_id !== 'all') { whereClauses.push('sh.branch_id = ?'); params.push(branch_id); }

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
        const [rows] = await pool.query(query, params);

        const buffer = await generatePdfBuffer((doc) => {
            // Header completo
            doc.fontSize(14).font('Helvetica-Bold').text(String(company.razon_social), 30, 30);
            doc.fontSize(8).font('Helvetica').text(`NIT: ${String(company.nit || '')}  NRC: ${String(company.nrc || '')}`, 30, 48);
            doc.fontSize(8).font('Helvetica-Bold').text(`SUCURSAL: ${String(branchName)}`, 30, 58);
            doc.fontSize(12).font('Helvetica-Bold').text('LIBRO DE VENTAS A CONSUMIDOR FINAL', 30, 30, { align: 'right' });
            doc.fontSize(10).text(`MES: ${String(month)} / AÑO: ${String(year)}`, 30, 45, { align: 'right' });
            doc.moveDown(3);

            const startX = 30;
            let currentY = doc.y;
            const drawHeader = (y) => {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('FECHA', startX, y);
                doc.text('DEL No.', startX + 55, y);
                doc.text('AL No.', startX + 155, y);
                doc.text('GRAVADO', startX + 250, y, { width: 70, align: 'right' });
                doc.text('EXENTO', startX + 325, y, { width: 65, align: 'right' });
                doc.text('IVA', startX + 395, y, { width: 55, align: 'right' });
                doc.text('FOVIAL', startX + 455, y, { width: 55, align: 'right' });
                doc.text('COTRANS', startX + 515, y, { width: 55, align: 'right' });
                doc.text('TOTAL', startX + 580, y, { width: 80, align: 'right' });
                doc.moveTo(startX, y + 10).lineTo(startX + 660, y + 10).stroke();
                return y + 15;
            };

            currentY = drawHeader(currentY);
            let t = { grav: 0, exe: 0, iva: 0, fovial: 0, cotrans: 0, ret: 0, total: 0 };

            rows.forEach(r => {
                if (currentY > 540) { doc.addPage(); currentY = drawHeader(30); }
                const gNeto = n(r.t_grav), i = n(r.t_iva);
                const g = gNeto + i; // Gravado incluye IVA para consumidor final
                const e = n(r.t_exe);
                const f = n(r.t_fov), c = n(r.t_cot), to = n(r.t_pagar);

                doc.fontSize(7).font('Helvetica');
                doc.text(safeFormatDate(r.fecha), startX, currentY);
                doc.text(String(r.num_desde || '---'), startX + 55, currentY, { width: 95, truncate: true });
                doc.text(String(r.num_hasta || '---'), startX + 155, currentY, { width: 90, truncate: true });
                doc.text(`$${g.toFixed(2)}`, startX + 250, currentY, { width: 70, align: 'right' });
                doc.text(`$${e.toFixed(2)}`, startX + 325, currentY, { width: 65, align: 'right' });
                doc.text(`$${i.toFixed(2)}`, startX + 395, currentY, { width: 55, align: 'right' });
                doc.text(`$${f.toFixed(2)}`, startX + 455, currentY, { width: 55, align: 'right' });
                doc.text(`$${c.toFixed(2)}`, startX + 515, currentY, { width: 55, align: 'right' });
                doc.text(`$${to.toFixed(2)}`, startX + 580, currentY, { width: 80, align: 'right' });

                t.grav += g; t.exe += e; t.iva += i; t.fovial += f; t.cotrans += c; t.total += to;
                currentY += 13;
            });
            drawPdfSummaryBox(doc, 420, currentY + 15, t, 'RESUMEN VENTAS FAC');
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
