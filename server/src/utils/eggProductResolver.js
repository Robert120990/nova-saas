/**
 * eggProductResolver.js
 * Utilidad unificada para resolver la equivalencia entre productos industriales de huevo
 * (tipo de producto + presentación) y el catálogo comercial de productos (products).
 * Consulta la matriz de vinculación multicódigo (egg_product_code_mappings), provee
 * respaldos inteligentes de conversión de pesos, scoring difuso por tokens y garantía de
 * auto-creación para evitar caídas silenciosas de inventario.
 */

const STOP_WORDS = new Set([
    'de', 'del', 'en', 'con', 'el', 'la', 'los', 'las', 'un', 'una',
    'para', 'por', 'd', 'al', 'y', 'e', 'o', 'u'
]);

const MODIFIER_KEYWORDS = ['rapido', 'rápido', 'leche', 'salada', 'azucarada', 'ppg', 'cascara', 'cáscara'];

/**
 * Calcula el peso unitario en libras por defecto según la presentación.
 * @param {string} presentation 
 * @returns {number}
 */
function parseDefaultPresentationWeightLbs(presentation) {
    if (!presentation || typeof presentation !== 'string') return 1;
    const text = presentation.trim().toLowerCase();

    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
    if (m) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 0) return val;
    }

    if (text.includes('55')) return 55;
    if (text.includes('32')) return 32;
    if (text.includes('30') || text.includes('cubeta')) return 30;
    if (text.includes('20')) return 20;
    if (text.includes('8') || text.includes('galon') || text.includes('galón')) return 8;
    if (text.includes('4') || text.includes('medio')) return 4;
    if (text.includes('2') || text.includes('litro')) return 2;
    if (text.includes('caja')) return 45; // ~45 lbs por caja de 360 huevos
    if (text.includes('carton') || text.includes('cartón')) return 3.75;
    if (text.includes('unidad')) return 0.125;

    return 1;
}

/**
 * Normaliza cadenas para comparaciones flexibles.
 */
function cleanStr(str) {
    return (str || '').trim().toLowerCase();
}

/**
 * Extrae tokens relevantes para búsquedas difusas eliminando tildes y preposiciones.
 */
function tokenizeEgg(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Crea automáticamente un producto de catálogo para un ovoproducto no mapeado,
 * garantizando que nunca se pierda un movimiento de inventario comercial ni Kardex.
 */
async function autoCreateEggCatalogProduct(dbConnection, companyId, productType, presentation, branchId) {
    const rawType = (productType || 'Ovoproducto').trim();
    const rawPres = (presentation || 'cubeta 30LB').trim();
    const defaultWeightLbs = parseDefaultPresentationWeightLbs(rawPres);
    const defaultUm = defaultWeightLbs >= 30 ? 'cubeta' : (defaultWeightLbs === 8 ? 'galon' : (defaultWeightLbs === 2 ? 'litro' : 'lb'));

    // Generar código único y conciso
    const words = rawType.split(/\s+/).filter(Boolean);
    const initials = words.map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3) || 'OVO';
    const codeSuffix = Math.round(defaultWeightLbs);
    let candidateCode = `${initials}-${codeSuffix}`;

    const [existingCode] = await dbConnection.query(
        'SELECT id FROM products WHERE company_id = ? AND codigo = ? LIMIT 1',
        [companyId, candidateCode]
    );
    if (existingCode.length > 0) {
        candidateCode = `${initials}-${codeSuffix}-${Date.now().toString().slice(-4)}`;
    }

    const productName = `${rawType.toUpperCase()} ${rawPres.toUpperCase()}`;

    // Buscar categoría industrial de ovoproductos si existe
    const [cats] = await dbConnection.query(
        'SELECT id FROM product_categories WHERE company_id = ? AND (LOWER(name) LIKE "%ovoproducto%" OR LOWER(name) LIKE "%huevo%" OR LOWER(name) LIKE "%industrial%") LIMIT 1',
        [companyId]
    );
    const categoryId = cats[0]?.id || null;

    const [insertResult] = await dbConnection.query(
        `INSERT INTO products (
            company_id, codigo, nombre, descripcion, unidad_medida, tipo_item, category_id,
            status, afecta_inventario, costo, stock_minimo, permitir_existencia_negativa, created_at
        ) VALUES (?, ?, ?, ?, ?, 'PRODUCTO', ?, 'activo', 1, 0, 0, 1, NOW())`,
        [companyId, candidateCode, productName, `Autocreado desde módulo de envasado industrial (${rawType} - ${rawPres})`, defaultUm, categoryId]
    );
    const newId = insertResult.insertId;

    if (branchId) {
        await dbConnection.query('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES (?, ?)', [newId, branchId]);
    }

    // Registrar también en egg_product_code_mappings para futuras resoluciones instantáneas
    await dbConnection.query(
        `INSERT INTO egg_product_code_mappings (
            company_id, catalog_product_id, catalog_product_name, industrial_product_type, presentation,
            catalog_codes, unit_weight_lbs, unit_weight_kg, unit_of_measure
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            companyId, newId, productName, rawType.toLowerCase(), rawPres.toLowerCase(),
            candidateCode, defaultWeightLbs, parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)), defaultUm
        ]
    ).catch(err => {
        console.warn('[eggProductResolver] Auto-mapping insert notice:', err.message);
    });

    return {
        catalog_product_id: newId,
        catalog_code: candidateCode,
        catalog_codes: candidateCode,
        catalog_product_name: productName,
        catalog_barcode: null,
        unit_weight_lbs: defaultWeightLbs,
        unit_weight_kg: parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)),
        unit_of_measure: defaultUm,
        cost: 0,
        is_returnable: cleanStr(rawPres).includes('cubeta'),
        source: 'auto_created_product'
    };
}

/**
 * Resuelve el producto de catálogo correspondiente a un producto industrial y su presentación.
 * 
 * @param {Object} dbConnection - Pool de conexiones o conexión MySQL activa
 * @param {number} companyId - ID de la empresa
 * @param {string} productType - Tipo de producto industrial (ej. "Huevo Entero Pasteurizado")
 * @param {string} presentation - Presentación (ej. "cubeta 30 lb", "galon 8 lb")
 * @param {Object} [options] - Opciones adicionales ({ autoCreate: true, branchId: 5 })
 * @returns {Promise<Object>} Información de resolución
 */
async function resolveEggCatalogProduct(dbConnection, companyId, productType, presentation, options = {}) {
    const rawType = (productType || '').trim();
    const rawPres = (presentation || '').trim();
    const defaultWeightLbs = parseDefaultPresentationWeightLbs(rawPres);

    const fallbackResult = {
        catalog_product_id: null,
        catalog_code: null,
        catalog_codes: '',
        catalog_product_name: rawType || 'Ovoproducto',
        unit_weight_lbs: defaultWeightLbs,
        unit_weight_kg: parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)),
        unit_of_measure: defaultWeightLbs >= 30 ? 'cubeta' : (defaultWeightLbs === 8 ? 'galon' : (defaultWeightLbs === 2 ? 'litro' : 'lb')),
        cost: 0,
        is_returnable: cleanStr(rawPres).includes('cubeta'),
        source: 'default_fallback'
    };

    if (!companyId || (!rawType && !rawPres)) {
        return fallbackResult;
    }

    try {
        // 1. Buscar en la matriz de mapeo oficial: egg_product_code_mappings
        const [mappings] = await dbConnection.query(
            `SELECT m.*, 
                    p.nombre as catalog_p_nombre, 
                    p.codigo as catalog_p_codigo, 
                    p.codigo_barra as catalog_p_barcode,
                    p.costo as catalog_p_costo,
                    p.unidad_medida as catalog_p_um
             FROM egg_product_code_mappings m
             LEFT JOIN products p ON m.catalog_product_id = p.id
             WHERE m.company_id = ?
             ORDER BY m.id ASC`,
            [companyId]
        );

        if (Array.isArray(mappings) && mappings.length > 0) {
            const pTokens = tokenizeEgg(rawType);
            const presTokens = tokenizeEgg(rawPres);

            // 1.0 Buscar coincidencia inteligente con scoring en code_weights_json
            let scoredCandidates = [];
            for (const m of mappings) {
                let codeItems = [];
                try {
                    codeItems = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
                } catch {
                    codeItems = [];
                }
                if (!Array.isArray(codeItems)) continue;

                for (const it of codeItems) {
                    if (!it.product_id) continue;
                    const iTokens = tokenizeEgg(`${it.product_name || ''} ${it.code || ''}`);
                    let score = 0;

                    for (const pt of pTokens) {
                        if (iTokens.includes(pt)) score += 4;
                    }
                    if (Math.abs(Number(it.weight_lbs || 0) - defaultWeightLbs) < 0.5) score += 6;
                    for (const pr of presTokens) {
                        if (iTokens.includes(pr)) score += 2;
                    }
                    for (const mod of MODIFIER_KEYWORDS) {
                        const normMod = mod.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        if (iTokens.includes(normMod) && !pTokens.includes(normMod)) {
                            score -= 5;
                        }
                    }

                    scoredCandidates.push({ item: it, score, mapping: m });
                }
            }

            if (scoredCandidates.length > 0) {
                scoredCandidates.sort((a, b) => b.score - a.score);
                const best = scoredCandidates[0];
                if (best && best.score >= 8 && best.item.product_id) {
                    const weightLbs = parseFloat(best.item.weight_lbs || defaultWeightLbs);
                    const weightKg = parseFloat(best.item.weight_kg || (weightLbs * 0.45359237).toFixed(4));
                    return {
                        catalog_product_id: Number(best.item.product_id),
                        catalog_code: best.item.code || null,
                        catalog_codes: best.item.code || '',
                        catalog_product_name: best.item.product_name || rawType,
                        catalog_barcode: null,
                        unit_weight_lbs: weightLbs > 0 ? weightLbs : defaultWeightLbs,
                        unit_weight_kg: weightKg > 0 ? weightKg : parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)),
                        unit_of_measure: weightLbs >= 30 ? 'cubeta' : (weightLbs === 8 ? 'galon' : (weightLbs === 2 ? 'litro' : 'lb')),
                        cost: 0,
                        is_returnable: cleanStr(rawPres).includes('cubeta') || cleanStr(best.item.product_name || '').includes('cubeta'),
                        source: 'code_weights_json',
                        mapping_id: best.mapping.id
                    };
                }
            }

            // 1.1 Coincidencia directa por filas de mapping
            const cleanType = cleanStr(rawType);
            const cleanPres = cleanStr(rawPres);
            let match = mappings.find(m => cleanStr(m.industrial_product_type) === cleanType && cleanStr(m.presentation) === cleanPres);
            if (!match) {
                match = mappings.find(m => {
                    const mType = cleanStr(m.industrial_product_type);
                    const mPres = cleanStr(m.presentation);
                    return (mType === cleanType || cleanType.includes(mType) || mType.includes(cleanType)) &&
                           (mPres === cleanPres || cleanPres.includes(mPres) || mPres.includes(cleanPres));
                });
            }

            if (match && match.catalog_product_id) {
                const weightLbs = parseFloat(match.unit_weight_lbs || defaultWeightLbs);
                const weightKg = parseFloat(match.unit_weight_kg || (weightLbs * 0.45359237).toFixed(4));
                const firstCode = match.catalog_codes ? match.catalog_codes.split(',')[0].trim() : (match.catalog_p_codigo || null);

                return {
                    catalog_product_id: match.catalog_product_id,
                    catalog_code: firstCode,
                    catalog_codes: match.catalog_codes || match.catalog_p_codigo || '',
                    catalog_product_name: match.catalog_product_name || match.catalog_p_nombre || rawType,
                    catalog_barcode: match.catalog_p_barcode || null,
                    unit_weight_lbs: weightLbs > 0 ? weightLbs : defaultWeightLbs,
                    unit_weight_kg: weightKg > 0 ? weightKg : parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)),
                    unit_of_measure: match.unit_of_measure || 'lb',
                    cost: match.catalog_p_costo !== undefined ? parseFloat(match.catalog_p_costo || 0) : 0,
                    is_returnable: cleanStr(match.presentation || rawPres).includes('cubeta'),
                    source: 'code_mapping',
                    mapping_id: match.id
                };
            }
        }

        // 2. Respaldo: Buscar directamente en products por coincidencia difusa de palabras clave
        if (rawType) {
            const pTokens = tokenizeEgg(rawType);
            if (pTokens.length > 0) {
                const [allProducts] = await dbConnection.query(
                    `SELECT id, codigo, codigo_barra, nombre, descripcion, costo, unidad_medida
                     FROM products
                     WHERE company_id = ? AND status = 'activo' AND afecta_inventario = 1`,
                    [companyId]
                );

                if (Array.isArray(allProducts) && allProducts.length > 0) {
                    const scoredProducts = allProducts.map(p => {
                        const nameTokens = tokenizeEgg(`${p.nombre || ''} ${p.descripcion || ''} ${p.codigo || ''}`);
                        let s = 0;
                        for (const pt of pTokens) {
                            if (nameTokens.includes(pt)) s += 4;
                        }
                        if (cleanStr(p.nombre).includes(cleanStr(rawPres))) s += 5;
                        return { p, score: s };
                    }).filter(it => it.score >= 4);

                    if (scoredProducts.length > 0) {
                        scoredProducts.sort((a, b) => b.score - a.score);
                        const bestProd = scoredProducts[0].p;
                        return {
                            catalog_product_id: bestProd.id,
                            catalog_code: bestProd.codigo || null,
                            catalog_codes: bestProd.codigo || '',
                            catalog_product_name: bestProd.nombre,
                            catalog_barcode: bestProd.codigo_barra || null,
                            unit_weight_lbs: defaultWeightLbs,
                            unit_weight_kg: parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)),
                            unit_of_measure: bestProd.unidad_medida || 'lb',
                            cost: parseFloat(bestProd.costo || 0),
                            is_returnable: cleanStr(rawPres).includes('cubeta'),
                            source: 'product_catalog_tokens'
                        };
                    }
                }
            }
        }

        // 3. Auto-creación garantizada si fue solicitada o para evitar pérdida de inventario
        if (options.autoCreate) {
            return await autoCreateEggCatalogProduct(dbConnection, companyId, productType, presentation, options.branchId);
        }
    } catch (err) {
        console.error('[eggProductResolver] Error al resolver producto de catálogo:', err.message);
    }

    return fallbackResult;
}

module.exports = {
    resolveEggCatalogProduct,
    parseDefaultPresentationWeightLbs,
    autoCreateEggCatalogProduct,
    tokenizeEgg
};
