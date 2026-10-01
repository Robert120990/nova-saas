const { normalizeCatalogCodes, pool, reportPdfHelper, excelService, ensureEggSchema } = require('./shared');

const exportTranslatedInventory = async (req, res) => {
    try {
        await ensureEggSchema();
        const company_id = req.company_id || req.user?.company_id;
        const format = (req.query.format || 'pdf').toLowerCase();

        const [mappings] = await pool.query(
            'SELECT * FROM egg_product_code_mappings WHERE company_id = ?',
            [company_id]
        );

        const codeMap = {};
        const mappingByProductId = {};
        const mappedCodesList = [];
        const mappedProductIds = [];
        for (const m of mappings) {
            let weightsByCode = {};
            if (m.code_weights_json) {
                try {
                    const parsed = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
                    if (Array.isArray(parsed)) {
                        parsed.forEach((item) => {
                            if (item && item.code) {
                                weightsByCode[item.code.toLowerCase().trim()] = item;
                            }
                            const pid = Number(item?.product_id);
                            if (Number.isInteger(pid) && pid > 0) {
                                const specificLbs = parseFloat(item.weight_lbs);
                                const specificKg = parseFloat(item.weight_kg);
                                mappingByProductId[pid] = {
                                    mapping: m,
                                    weight_lbs: Number.isFinite(specificLbs) && specificLbs > 0 ? specificLbs : parseFloat(m.unit_weight_lbs || 1),
                                    weight_kg: Number.isFinite(specificKg) && specificKg > 0 ? specificKg : parseFloat(m.unit_weight_kg || 0.45)
                                };
                                mappedProductIds.push(pid);
                            }
                        });
                    }
                } catch (e) {}
            }
            const rawCodes = normalizeCatalogCodes(m.catalog_codes).map((code) => code.toLowerCase());
            for (const c of rawCodes) {
                const specificItem = weightsByCode[c];
                const specificLbs = specificItem ? parseFloat(specificItem.weight_lbs) : null;
                const specificKg = specificItem ? parseFloat(specificItem.weight_kg) : null;
                codeMap[c] = {
                    mapping: m,
                    weight_lbs: Number.isFinite(specificLbs) && specificLbs > 0 ? specificLbs : parseFloat(m.unit_weight_lbs || 1),
                    weight_kg: Number.isFinite(specificKg) && specificKg > 0 ? specificKg : parseFloat(m.unit_weight_kg || 0.45),
                    matched_code: c
                };
                mappedCodesList.push(c);
            }
            const catalogProductId = Number(m.catalog_product_id);
            if (Number.isInteger(catalogProductId) && catalogProductId > 0) {
                mappingByProductId[catalogProductId] = {
                    mapping: m,
                    weight_lbs: parseFloat(m.unit_weight_lbs || 1),
                    weight_kg: parseFloat(m.unit_weight_kg || 0.45)
                };
                mappedProductIds.push(catalogProductId);
            }
        }

        const safeCodes = mappedCodesList.length > 0 ? mappedCodesList : ['__none__'];
        const safeProductIds = mappedProductIds.length > 0 ? mappedProductIds : [0];
        const [products] = await pool.query(
            `SELECT p.id, p.codigo, p.codigo_barra, p.nombre, COALESCE(SUM(i.stock), 0) as stock, p.unidad_medida, c.name as category_name
             FROM products p
             LEFT JOIN inventory i ON p.id = i.product_id
             LEFT JOIN product_categories c ON p.category_id = c.id
             WHERE p.company_id = ? AND p.status = 'activo'
               AND (
                   LOWER(p.nombre) LIKE '%huevo%'
                   OR LOWER(p.nombre) LIKE '%clara%'
                   OR LOWER(p.nombre) LIKE '%yema%'
                   OR LOWER(c.name) LIKE '%huevo%'
                   OR LOWER(c.name) LIKE '%ovoproducto%'
                   OR LOWER(p.codigo) IN (?)
                   OR LOWER(p.codigo_barra) IN (?)
                   OR p.id IN (?)
               )
             GROUP BY p.id, p.codigo, p.codigo_barra, p.nombre, p.unidad_medida, c.name`,
            [company_id, safeCodes, safeCodes, safeProductIds]
        );

        const items = [];
        let grandTotalUnits = 0;
        let grandTotalLbs = 0;
        let grandTotalKg = 0;

        for (const prod of products) {
            const code = (prod.codigo || '').trim().toLowerCase();
            const barcode = (prod.codigo_barra || '').trim().toLowerCase();
            const matchedEntry = codeMap[code] || codeMap[barcode] || mappingByProductId[prod.id];
            const mapping = matchedEntry?.mapping;
            const currentStockUnits = parseFloat(prod.stock || 0);

            if (mapping) {
                const lbsPerUnit = parseFloat(matchedEntry?.weight_lbs ?? mapping.unit_weight_lbs ?? 1);
                const kgPerUnit = parseFloat(matchedEntry?.weight_kg ?? mapping.unit_weight_kg ?? (lbsPerUnit * 0.453592));
                const totalLbs = currentStockUnits * lbsPerUnit;
                const totalKg = currentStockUnits * kgPerUnit;
                grandTotalUnits += currentStockUnits;
                grandTotalLbs += totalLbs;
                grandTotalKg += totalKg;

                items.push({
                    product_code: prod.codigo || '',
                    matched_code: (codeMap[code] ? prod.codigo : (codeMap[barcode] ? prod.codigo_barra : mapping.catalog_codes)),
                    product_name: mapping.catalog_product_name || prod.nombre,
                    product_type: mapping.industrial_product_type,
                    presentation: mapping.presentation,
                    stock_units: currentStockUnits,
                    weight_per_unit_lbs: lbsPerUnit,
                    weight_per_unit_kg: kgPerUnit,
                    total_lbs: totalLbs,
                    total_kg: totalKg,
                    status: currentStockUnits <= 0 ? 'Agotado' : (currentStockUnits < 10 ? 'Bajo' : 'En Stock')
                });
            }
        }

        // Exportar a Excel
        if (format === 'excel') {
            const rows = items.map(it => [
                it.product_code,
                it.matched_code,
                it.product_name,
                it.stock_units,
                it.weight_per_unit_lbs.toFixed(2),
                it.total_lbs.toFixed(2),
                it.total_kg.toFixed(2),
                it.status
            ]);
            rows.push([
                'TOTAL GENERAL',
                '',
                `${items.length} Productos`,
                grandTotalUnits,
                '',
                grandTotalLbs.toFixed(2),
                grandTotalKg.toFixed(2),
                ''
            ]);

            const buffer = await excelService.createExcelBuffer({
                title: 'Inventario Industrial Traducido',
                sheets: [{
                    name: 'Inventario Traducido',
                    headers: ['CÓDIGO CATÁLOGO', 'CÓDIGOS VINCULADOS', 'PRODUCTO COMERCIAL', 'STOCK FÍSICO', 'PESO UNIT. (LBS)', 'TOTAL LIBRAS (LBS)', 'TOTAL KILOS (KG)', 'ESTADO'],
                    rows
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `inventario_industrial_${new Date().toISOString().split('T')[0]}.xlsx`);
        }

        // Exportar a PDF (Estándar Contable Oficial Andelsa / Report Design Rules)
        const company = await reportPdfHelper.getCompanyInfo(company_id);
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const title = 'INVENTARIO INDUSTRIAL TRADUCIDO';
        const subtitle = 'CONTROL DE STOCK, EQUIVALENCIAS Y CONVERSIÓN A LIBRAS Y KILOS';
        const periodText = `EMISIÓN: ${new Date().toLocaleDateString('es-SV')} ${new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`;

        let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

        const drawTableHeader = (y) => {
            doc.rect(30, y, 732, 16).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7);
            doc.text('CÓD. CATÁLOGO', 35, y + 4, { width: 65 });
            doc.text('CÓD. VINCULADOS', 105, y + 4, { width: 100 });
            doc.text('PRODUCTO COMERCIAL', 210, y + 4, { width: 200 });
            doc.text('STOCK (U)', 415, y + 4, { width: 65, align: 'right' });
            doc.text('PESO U. (LB)', 485, y + 4, { width: 65, align: 'right' });
            doc.text('TOTAL LBS', 555, y + 4, { width: 70, align: 'right' });
            doc.text('TOTAL KG', 630, y + 4, { width: 70, align: 'right' });
            doc.text('ESTADO', 705, y + 4, { width: 50, align: 'center' });
            doc.rect(30, y + 16, 732, 0.5).fill('#cbd5e1');
            return y + 18;
        };

        currentY = drawTableHeader(currentY);

        items.forEach((item, idx) => {
            if (currentY > 510) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
            }

            if (idx % 2 === 1) {
                doc.rect(30, currentY - 1, 732, 14).fill('#f8fafc');
            }

            doc.fillColor('#334155').font('Helvetica').fontSize(7);
            doc.text(item.product_code || '-', 35, currentY + 2, { width: 65 });
            doc.text(String(item.matched_code || '-').substring(0, 25), 105, currentY + 2, { width: 100 });
            doc.fillColor('#0f172a').font('Helvetica-Bold').text(item.product_name, 210, currentY + 2, { width: 200, ellipsis: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text(parseInt(item.stock_units).toLocaleString(), 415, currentY + 2, { width: 65, align: 'right' });
            doc.text(item.weight_per_unit_lbs.toFixed(2), 485, currentY + 2, { width: 65, align: 'right' });
            doc.font('Helvetica-Bold').fillColor('#047857').text(item.total_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 555, currentY + 2, { width: 70, align: 'right' });
            doc.fillColor('#6d28d9').text(item.total_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 630, currentY + 2, { width: 70, align: 'right' });
            doc.font('Helvetica').fillColor(item.stock_units <= 0 ? '#b91c1c' : '#047857').text(item.status, 705, currentY + 2, { width: 50, align: 'center' });

            currentY += 14;
        });

        if (currentY > 500) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.rect(30, currentY, 732, 16).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
        doc.text('TOTALES DE INVENTARIO INDUSTRIAL:', 35, currentY + 4, { width: 370 });
        doc.text(parseInt(grandTotalUnits).toLocaleString(), 415, currentY + 4, { width: 65, align: 'right' });
        doc.fillColor('#047857').text(grandTotalLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Lbs', 555, currentY + 4, { width: 70, align: 'right' });
        doc.fillColor('#6d28d9').text(grandTotalKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Kg', 630, currentY + 4, { width: 70, align: 'right' });
        currentY += 24;

        reportPdfHelper.renderClosingFooter(doc, 30, currentY, items.length, 'Líneas de Inventario');
        reportPdfHelper.renderPageNumbers(doc);

        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=inventario_industrial_${new Date().toISOString().split('T')[0]}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al exportar inventario traducido:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { exportTranslatedInventory };
