const { normalizeCatalogCodes, pool, ensureEggSchema } = require('./shared');

const getTranslatedInventory = async (req, res) => {
    try {
        await ensureEggSchema();
        const company_id = req.company_id;

        // 1. Obtener todos los mapeos activos
        const [mappings] = await pool.query(
            'SELECT * FROM egg_product_code_mappings WHERE company_id = ?',
            [company_id]
        );

        // Crear mapas rápidos de código y producto de catálogo -> mapeo con peso unitario específico por código.
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
                } catch (e) {
                    console.error('Error parsing code_weights_json in getTranslatedInventory:', e);
                }
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

        // 2. Consultar productos del inventario general con su stock real de forma optimizada
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

        // 3. Clasificar y traducir inventario
        const items = [];
        const byType = {};
        let grandTotalUnits = 0;
        let grandTotalLbs = 0;
        let grandTotalKg = 0;
        const unmappedProducts = [];

        for (const prod of products) {
            const code = (prod.codigo || '').trim().toLowerCase();
            const barcode = (prod.codigo_barra || '').trim().toLowerCase();
            const matchedEntry = codeMap[code] || codeMap[barcode] || mappingByProductId[prod.id];
            const mapping = matchedEntry?.mapping;
            const currentStockUnits = parseFloat(prod.stock || 0);

            const isEggCandidate =
                (prod.nombre || '').toLowerCase().includes('huevo') ||
                (prod.nombre || '').toLowerCase().includes('clara') ||
                (prod.nombre || '').toLowerCase().includes('yema') ||
                (prod.categoria || '').toLowerCase().includes('huevo') ||
                (prod.category_name || '').toLowerCase().includes('huevo') ||
                (prod.category_name || '').toLowerCase().includes('ovoproducto');

            if (mapping) {
                // Usar peso unitario específico de este código si fue configurado individualmente
                const lbsPerUnit = parseFloat(matchedEntry?.weight_lbs ?? mapping.unit_weight_lbs ?? 1);
                const kgPerUnit = parseFloat(matchedEntry?.weight_kg ?? mapping.unit_weight_kg ?? (lbsPerUnit * 0.453592));
                const totalLbs = currentStockUnits * lbsPerUnit;
                const totalKg = currentStockUnits * kgPerUnit;

                grandTotalUnits += currentStockUnits;
                grandTotalLbs += totalLbs;
                grandTotalKg += totalKg;

                // Fila para tabla plana
                items.push({
                    product_id: prod.id,
                    product_code: prod.codigo,
                    product_barcode: prod.codigo_barra,
                    product_name: prod.nombre,
                    product_type: mapping.industrial_product_type,
                    presentation: mapping.presentation,
                    matched_code: (codeMap[code] ? prod.codigo : (codeMap[barcode] ? prod.codigo_barra : mapping.catalog_codes)),
                    unit_of_measure: mapping.unit_of_measure || 'lb',
                    stock_units: currentStockUnits,
                    weight_per_unit_lbs: lbsPerUnit,
                    weight_per_unit_kg: kgPerUnit,
                    total_lbs: totalLbs,
                    total_kg: totalKg
                });

                // Agrupar por Tipo de Producto
                const pType = mapping.industrial_product_type;
                if (!byType[pType]) {
                    byType[pType] = { product_type: pType, units: 0, total_lbs: 0, total_kg: 0, presentations: {} };
                }
                byType[pType].units += currentStockUnits;
                byType[pType].total_lbs += totalLbs;
                byType[pType].total_kg += totalKg;

                // Agrupar por Presentación
                const pres = mapping.presentation;
                if (!byType[pType].presentations[pres]) {
                    byType[pType].presentations[pres] = {
                        presentation: pres,
                        units: 0,
                        total_lbs: 0,
                        total_kg: 0,
                        unit_weight_lbs: lbsPerUnit,
                        unit_weight_kg: kgPerUnit,
                        unit_of_measure: mapping.unit_of_measure || 'lb',
                        matched_products: []
                    };
                }
                byType[pType].presentations[pres].units += currentStockUnits;
                byType[pType].presentations[pres].total_lbs += totalLbs;
                byType[pType].presentations[pres].total_kg += totalKg;
                byType[pType].presentations[pres].matched_products.push({
                    product_id: prod.id,
                    codigo: prod.codigo,
                    codigo_barra: prod.codigo_barra,
                    nombre: prod.nombre,
                    stock_units: currentStockUnits
                });
            } else if (isEggCandidate) {
                unmappedProducts.push({
                    id: prod.id,
                    codigo: prod.codigo,
                    nombre: prod.nombre,
                    stock_units: currentStockUnits,
                    categoria: prod.category_name || prod.categoria || 'Sin categoría'
                });
            }
        }

        // 4. Agrupar existencias según la vinculación de productos (egg_product_code_mappings)
        const byMapping = mappings.map(m => {
            const mCodes = normalizeCatalogCodes(m.catalog_codes).map(c => c.toLowerCase());
            const mProductIds = new Set();
            if (m.catalog_product_id) mProductIds.add(Number(m.catalog_product_id));
            if (m.code_weights_json) {
                try {
                    const parsed = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
                    if (Array.isArray(parsed)) {
                        parsed.forEach(it => { if (it?.product_id) mProductIds.add(Number(it.product_id)); });
                    }
                } catch (e) {}
            }
            const matchedProds = items.filter(it =>
                mCodes.includes((it.product_code || '').toLowerCase()) ||
                mCodes.includes((it.product_barcode || '').toLowerCase()) ||
                (it.product_id && mProductIds.has(Number(it.product_id)))
            );

            const totalUnits = matchedProds.reduce((sum, it) => sum + (parseFloat(it.stock_units) || 0), 0);
            const totalLbs = matchedProds.reduce((sum, it) => sum + (parseFloat(it.total_lbs) || 0), 0);
            const totalKg = matchedProds.reduce((sum, it) => sum + (parseFloat(it.total_kg) || 0), 0);

            return {
                id: m.id,
                commercial_name: m.catalog_product_name || m.industrial_product_type,
                industrial_product_type: m.industrial_product_type,
                presentation: m.presentation,
                catalog_codes: m.catalog_codes,
                unit_weight_lbs: parseFloat(m.unit_weight_lbs || 1),
                unit_weight_kg: parseFloat(m.unit_weight_kg || 0.45),
                unit_of_measure: m.unit_of_measure || 'lb',
                total_stock_units: totalUnits,
                total_weight_lbs: Math.round(totalLbs * 100) / 100,
                total_weight_kg: Math.round(totalKg * 100) / 100,
                status: totalUnits <= 0 ? 'Agotado' : (totalUnits < 10 ? 'Bajo' : 'En Stock'),
                matched_items: matchedProds
            };
        });

        res.json({
            totals: {
                total_items: items.length,
                total_stock_units: grandTotalUnits,
                total_weight_lbs: Math.round(grandTotalLbs * 100) / 100,
                total_weight_kg: Math.round(grandTotalKg * 100) / 100
            },
            summary: {
                grandTotalUnits,
                grandTotalLbs: Math.round(grandTotalLbs * 100) / 100,
                grandTotalKg: Math.round(grandTotalKg * 100) / 100,
                mappedProductsCount: new Set([
                    ...Object.keys(codeMap).map((code) => `code:${code}`),
                    ...Object.keys(mappingByProductId).map((productId) => `product:${productId}`)
                ]).size,
                unmappedProductsCount: unmappedProducts.length
            },
            items,
            by_type: Object.values(byType),
            by_mapping: byMapping,
            unmapped_products: unmappedProducts,
            mappings_count: mappings.length
        });
    } catch (error) {
        console.error('Error in getTranslatedInventory:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { getTranslatedInventory };
