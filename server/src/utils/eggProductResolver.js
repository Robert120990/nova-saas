/**
 * eggProductResolver.js
 * Utilidad unificada para resolver la equivalencia entre productos industriales de huevo
 * (tipo de producto + presentación) y el catálogo comercial de productos (products).
 * Consulta la matriz de vinculación multicódigo (egg_product_code_mappings) y provee
 * respaldos inteligentes de conversión de pesos y unidades de medida.
 */

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
 * Normaliza nombres de tipo de producto y presentación para comparaciones flexibles.
 */
function cleanStr(str) {
    return (str || '').trim().toLowerCase();
}

/**
 * Resuelve el producto de catálogo correspondiente a un producto industrial y su presentación.
 * 
 * @param {Object} dbConnection - Pool de conexiones o conexión MySQL activa
 * @param {number} companyId - ID de la empresa
 * @param {string} productType - Tipo de producto industrial (ej. "Huevo Entero Pasteurizado")
 * @param {string} presentation - Presentación (ej. "cubeta 30 lb", "galon 8 lb")
 * @returns {Promise<Object>} Información de resolución
 */
async function resolveEggCatalogProduct(dbConnection, companyId, productType, presentation) {
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
                    p.costo as catalog_p_costo,
                    p.unidad_medida as catalog_p_um
             FROM egg_product_code_mappings m
             LEFT JOIN products p ON m.catalog_product_id = p.id
             WHERE m.company_id = ?
             ORDER BY m.id ASC`,
            [companyId]
        );

        if (Array.isArray(mappings) && mappings.length > 0) {
            const cleanType = cleanStr(rawType);
            const cleanPres = cleanStr(rawPres);

            // Coincidencia exacta de tipo y presentación
            let match = mappings.find(m => 
                cleanStr(m.industrial_product_type) === cleanType &&
                cleanStr(m.presentation) === cleanPres
            );

            // Coincidencia flexible si la presentación contiene la palabra clave (ej. "cubeta 30" en "cubeta 30 lb")
            if (!match) {
                match = mappings.find(m => {
                    const mType = cleanStr(m.industrial_product_type);
                    const mPres = cleanStr(m.presentation);
                    const typeMatches = mType === cleanType || cleanType.includes(mType) || mType.includes(cleanType);
                    const presMatches = mPres === cleanPres || cleanPres.includes(mPres) || mPres.includes(cleanPres);
                    return typeMatches && presMatches;
                });
            }

            // Coincidencia por peso aproximado y tipo de producto
            if (!match) {
                match = mappings.find(m => {
                    const mType = cleanStr(m.industrial_product_type);
                    const typeMatches = mType === cleanType || cleanType.includes(mType) || mType.includes(cleanType);
                    const mLbs = parseFloat(m.unit_weight_lbs || 0);
                    return typeMatches && Math.abs(mLbs - defaultWeightLbs) < 0.5;
                });
            }

            if (match) {
                const weightLbs = parseFloat(match.unit_weight_lbs || defaultWeightLbs);
                const weightKg = parseFloat(match.unit_weight_kg || (weightLbs * 0.45359237).toFixed(4));
                const firstCode = match.catalog_codes
                    ? match.catalog_codes.split(',')[0].trim()
                    : (match.catalog_p_codigo || null);

                return {
                    catalog_product_id: match.catalog_product_id || (match.catalog_p_codigo ? match.catalog_product_id : null),
                    catalog_code: firstCode,
                    catalog_codes: match.catalog_codes || match.catalog_p_codigo || '',
                    catalog_product_name: match.catalog_product_name || match.catalog_p_nombre || rawType,
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

        // 2. Respaldo: Buscar directamente en products por coincidencia de nombre
        if (rawType) {
            const [prodRows] = await dbConnection.query(
                `SELECT id, codigo, nombre, costo, unidad_medida
                 FROM products
                 WHERE company_id = ? 
                   AND status = 'activo'
                   AND (
                       LOWER(nombre) LIKE ? 
                       OR LOWER(descripcion) LIKE ?
                   )
                 ORDER BY 
                     CASE 
                         WHEN LOWER(nombre) LIKE ? THEN 1
                         ELSE 2
                     END, id ASC
                 LIMIT 1`,
                [
                    companyId,
                    `%${cleanStr(rawType)}%`,
                    `%${cleanStr(rawType)}%`,
                    `%${cleanStr(rawPres)}%`
                ]
            );

            if (prodRows.length > 0) {
                const p = prodRows[0];
                return {
                    catalog_product_id: p.id,
                    catalog_code: p.codigo || null,
                    catalog_codes: p.codigo || '',
                    catalog_product_name: p.nombre,
                    unit_weight_lbs: defaultWeightLbs,
                    unit_weight_kg: parseFloat((defaultWeightLbs * 0.45359237).toFixed(4)),
                    unit_of_measure: p.unidad_medida || 'lb',
                    cost: parseFloat(p.costo || 0),
                    is_returnable: cleanStr(rawPres).includes('cubeta'),
                    source: 'product_catalog_fallback'
                };
            }
        }
    } catch (err) {
        console.error('[eggProductResolver] Error al resolver producto de catálogo:', err.message);
    }

    return fallbackResult;
}

module.exports = {
    resolveEggCatalogProduct,
    parseDefaultPresentationWeightLbs
};
