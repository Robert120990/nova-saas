const { normalizeCatalogCodes, pool, ensureEggSchema } = require('./shared');

const saveCodeMapping = async (req, res) => {
    try {
        await ensureEggSchema();
        const mappingId = req.params?.id || req.body?.id;
        const {
            industrial_product_type,
            product_type,
            presentation,
            catalog_codes,
            codes,
            code_items,
            unit_weight_lbs,
            weight_lbs,
            unit_weight_kg,
            weight_kg,
            catalog_product_id,
            product_id,
            catalog_product_name,
            product_name,
            unit_of_measure,
            notes
        } = req.body;
        const company_id = req.company_id;
        const resolvedProductType = String(industrial_product_type || product_type || '').trim();
        const resolvedPresentation = String(presentation || '').trim();
        const resolvedUnit = String(unit_of_measure || 'lb').trim().toLowerCase();
        const currentMappingId = mappingId ? Number(mappingId) : null;

        // Normalizar lista de códigos y pesos por código
        let items = [];
        if (Array.isArray(code_items) && code_items.length > 0) {
            items = code_items;
        } else if (Array.isArray(codes)) {
            items = codes.map((c) => {
                if (typeof c === 'object' && c !== null) return c;
                return {
                    code: String(c || '').trim(),
                    weight_lbs: Number(unit_weight_lbs ?? weight_lbs ?? 1),
                    weight_kg: Number(unit_weight_kg ?? weight_kg ?? 0.45)
                };
            });
        } else {
            const rawCodes = normalizeCatalogCodes(catalog_codes ?? codes);
            items = rawCodes.map((c) => ({
                code: c,
                weight_lbs: Number(unit_weight_lbs ?? weight_lbs ?? 1),
                weight_kg: Number(unit_weight_kg ?? weight_kg ?? 0.45)
            }));
        }

        // Filtrar códigos vacíos y estandarizar
        items = items
            .map((it) => {
                const c = String(it.code || '').trim();
                const itemLbs = Number(it.weight_lbs ?? unit_weight_lbs ?? weight_lbs ?? 1);
                const itemKg = Number(it.weight_kg ?? (itemLbs * 0.45359237).toFixed(2));
                return {
                    code: c,
                    weight_lbs: Number.isFinite(itemLbs) && itemLbs > 0 ? itemLbs : 1,
                    weight_kg: Number.isFinite(itemKg) && itemKg > 0 ? itemKg : 0.45,
                    product_id: it.product_id ? Number(it.product_id) : null,
                    product_name: it.product_name ? String(it.product_name).trim() : null
                };
            })
            .filter((it) => it.code.length > 0);

        const resolvedCodes = items.map((it) => it.code);

        if (!resolvedProductType || !resolvedPresentation || resolvedCodes.length === 0) {
            return res.status(400).json({ message: 'Tipo de producto, presentación y al menos un código vinculado son obligatorios.' });
        }
        if (mappingId && (!Number.isInteger(currentMappingId) || currentMappingId <= 0)) {
            return res.status(400).json({ message: 'El identificador del mapeo no es válido.' });
        }
        const allowedUnits = ['lb', 'kg', 'unidad', 'carton', 'caja'];
        if (!allowedUnits.includes(String(resolvedUnit).toLowerCase().trim())) {
            return res.status(400).json({ message: 'La unidad de medida debe ser lb, kg, unidad, carton o caja.' });
        }

        // 1. Validar que no haya códigos repetidos dentro de la misma solicitud
        const uniqueSet = new Set();
        const duplicatesInForm = [];
        for (const c of resolvedCodes) {
            const lower = c.toLowerCase();
            if (uniqueSet.has(lower)) {
                duplicatesInForm.push(c);
            }
            uniqueSet.add(lower);
        }
        if (duplicatesInForm.length > 0) {
            return res.status(400).json({
                message: `El código "${duplicatesInForm.join(', ')}" está repetido en el formulario. Cada código debe ser único.`
            });
        }

        // 2. Validar que ninguno de los códigos esté ya vinculado a otra configuración
        const [otherMappings] = await pool.query(
            currentMappingId
                ? 'SELECT id, catalog_codes, catalog_product_name, industrial_product_type FROM egg_product_code_mappings WHERE company_id = ? AND id <> ?'
                : 'SELECT id, catalog_codes, catalog_product_name, industrial_product_type FROM egg_product_code_mappings WHERE company_id = ?',
            currentMappingId ? [company_id, currentMappingId] : [company_id]
        );
        const assignedCodesMap = new Map();
        for (const om of otherMappings) {
            const ocList = normalizeCatalogCodes(om.catalog_codes);
            for (const oc of ocList) {
                assignedCodesMap.set(oc.toLowerCase(), om.catalog_product_name || om.industrial_product_type || 'otra vinculación');
            }
        }

        const duplicateCodes = resolvedCodes.filter((c) => assignedCodesMap.has(c.toLowerCase()));
        if (duplicateCodes.length > 0) {
            const details = duplicateCodes
                .map((c) => `"${c}" (ya vinculado en ${assignedCodesMap.get(c.toLowerCase())})`)
                .join(', ');
            return res.status(409).json({
                message: `Los siguientes códigos ya están vinculados a otro producto: ${details}. Evite duplicar productos para evitar inconsistencias de inventario.`
            });
        }

        const requestedProductId = catalog_product_id ?? product_id ?? items.find((i) => i.product_id)?.product_id;
        const parsedProductId = requestedProductId ? Number(requestedProductId) : null;
        let resolvedProductId = null;
        let resolvedProductName = String(catalog_product_name || product_name || items[0]?.product_name || '').trim() || null;

        if (parsedProductId !== null) {
            if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
                return res.status(400).json({ message: 'El producto de catálogo seleccionado no es válido.' });
            }
            const [products] = await pool.query(
                'SELECT id, nombre FROM products WHERE id = ? AND company_id = ? LIMIT 1',
                [parsedProductId, company_id]
            );
            if (products.length === 0) {
                return res.status(400).json({ message: 'El producto seleccionado no pertenece a la empresa actual.' });
            }
            resolvedProductId = products[0].id;
            if (!resolvedProductName) resolvedProductName = products[0].nombre;
        }

        if (!resolvedProductName) {
            return res.status(400).json({ message: 'Debe indicar un nombre descriptivo para el producto comercial.' });
        }

        const primaryLbs = items.length > 0 ? items[0].weight_lbs : Number(unit_weight_lbs ?? weight_lbs ?? 1);
        const primaryKg = items.length > 0 ? items[0].weight_kg : Number((primaryLbs * 0.45359237).toFixed(2));
        const resolvedNotes = notes ? String(notes).trim() : null;
        const codeWeightsJson = JSON.stringify(items);

        if (currentMappingId) {
            const [result] = await pool.query(
                `UPDATE egg_product_code_mappings
                 SET catalog_product_id = ?, catalog_product_name = ?, industrial_product_type = ?, presentation = ?, catalog_codes = ?,
                     code_weights_json = ?, unit_weight_lbs = ?, unit_weight_kg = ?, unit_of_measure = ?, notes = ?, updated_at = NOW()
                 WHERE id = ? AND company_id = ?`,
                [
                    resolvedProductId, resolvedProductName, resolvedProductType, resolvedPresentation, resolvedCodes.join(', '),
                    codeWeightsJson, primaryLbs, primaryKg, resolvedUnit, resolvedNotes, currentMappingId, company_id
                ]
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Mapeo de códigos no encontrado.' });
            }
            return res.json({ success: true, message: 'Vinculación de códigos actualizada correctamente.' });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_product_code_mappings (
                    company_id, catalog_product_id, catalog_product_name, industrial_product_type, presentation, catalog_codes,
                    code_weights_json, unit_weight_lbs, unit_weight_kg, unit_of_measure, notes
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id, resolvedProductId, resolvedProductName, resolvedProductType, resolvedPresentation,
                    resolvedCodes.join(', '), codeWeightsJson, primaryLbs, primaryKg, resolvedUnit, resolvedNotes
                ]
            );
            return res.status(201).json({ id: result.insertId, success: true, message: 'Vinculación de códigos creada exitosamente.' });
        }
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const deleteCodeMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM egg_product_code_mappings WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Mapeo de códigos no encontrado.' });
        }
        res.json({ success: true, message: 'Mapeo eliminado exitosamente.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { saveCodeMapping, deleteCodeMapping };
