const { pool } = require('./shared');

const LBS_PER_KG = 2.20462262;
const KG_PER_LB = 0.45359237;

const norm = (str) =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const getProductFamily = (str) => {
    const s = norm(str);
    if (!s) return '';
    if (s.includes('ppg')) return 'clara_ppg';
    if (s.includes('clara')) return 'clara';
    if (s.includes('yema') && (s.includes('azucar') || s.includes('dulce'))) return 'yema_azucarada';
    if (s.includes('yema') && s.includes('sal')) return 'yema_salada';
    if (s.includes('yema')) return 'yema';
    if (s.includes('leche')) return 'huevo_leche';
    if (s.includes('rapido') || s.includes('plus') || s.includes('formulad') || s.includes('separacion')) return 'huevo_rapido';
    if (s.includes('cascara') || s.includes('blanco') || s.includes('carton') || s.includes('caja')) return 'huevo_cascara';
    if (s.includes('entero') || s.includes('pasteurizado') || s.includes('tortita') || s.includes('huevo')) return 'huevo_entero';
    return s;
};

const getPresentationFactorLbs = (str) => {
    const s = norm(str);
    if (!s) return 30;
    if (s.includes('1/2 galon') || s.includes('medio galon') || s.includes('4 lb') || s.includes('4.lb') || s.includes('4. lb') || s.includes('4lb')) return 4;
    if (s.includes('1/2 litro') || s.includes('medio litro')) return 1;
    const m = s.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
    if (m) return parseFloat(m[1]) || 30;
    if (s.includes('55')) return 55;
    if (s.includes('45') || s.includes('360')) return 45;
    if (s.includes('32')) return 32;
    if (s.includes('30') && !s.includes('carton')) return 30;
    if (s.includes('20')) return 20;
    if (s.includes('7.5')) return 7.5;
    if (s.includes('8') || s.includes('galon')) return 8;
    if (s.includes('4')) return 4;
    if (s.includes('3.9') || s.includes('carton')) return 3.9;
    if (s.includes('2') || s.includes('litro')) return 2;
    if (s.includes('0.13') || s.includes('unid')) return 0.13;
    return 30;
};

const isSamePresentation = (presA, presB) => {
    if (!presA || !presB) return false;
    const a = norm(presA);
    const b = norm(presB);
    if (a === b || a.includes(b) || b.includes(a)) return true;
    return Math.abs(getPresentationFactorLbs(a) - getPresentationFactorLbs(b)) < 0.1;
};

const deleteEggCustomerOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        await pool.query(
            'DELETE FROM egg_customer_orders WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        res.json({ message: 'Pedido eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar pedido de ovoproductos:', error);
        res.status(500).json({ message: error.message });
    }
};

const getCustomerPricingForOrder = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { customer_id, customer_name, product_type, presentation, product_id, catalog_code } = req.query;

        if (!customer_id && !customer_name) {
            return res.json({ price_per_lb: 0, price_per_kg: 0, source: null, description: 'Cliente no especificado.', customer_agreements: [] });
        }

        let resolvedCustomerId = customer_id ? parseInt(customer_id, 10) : null;
        let resolvedCustomerName = (customer_name || '').trim();
        let commercialName = '';

        if (resolvedCustomerId) {
            const [cRows] = await pool.query(
                'SELECT id, nombre, nombre_comercial FROM customers WHERE id = ? AND company_id = ? LIMIT 1',
                [resolvedCustomerId, company_id]
            );
            if (cRows.length > 0) {
                resolvedCustomerName = resolvedCustomerName || cRows[0].nombre || '';
                commercialName = cRows[0].nombre_comercial || '';
            }
        } else if (resolvedCustomerName) {
            const [cRows] = await pool.query(
                `SELECT id, nombre, nombre_comercial FROM customers
                 WHERE company_id = ?
                   AND (LOWER(TRIM(nombre)) = LOWER(TRIM(?)) OR LOWER(TRIM(nombre_comercial)) = LOWER(TRIM(?)))
                   AND nombre NOT LIKE '[INACTIVO%'
                 ORDER BY id ASC LIMIT 1`,
                [company_id, resolvedCustomerName, resolvedCustomerName]
            );
            if (cRows.length > 0) {
                resolvedCustomerId = cRows[0].id;
                commercialName = cRows[0].nombre_comercial || '';
            }
        }

        const normCustName = norm(resolvedCustomerName);
        const normCommName = norm(commercialName);
        const isDennys = normCustName.includes('denny') || normCommName.includes('denny') || normCustName.includes('comidas e industrias especializadas');
        let isKgCustomer = normCustName.includes('comidas especializadas') || norm(presentation).includes('kg') || norm(product_type).includes('kg');

        const targetFamily = getProductFamily(product_type);
        const targetFactorLbs = getPresentationFactorLbs(presentation || product_type);
        const targetProductId = product_id ? parseInt(product_id, 10) : null;

        // 1. Obtener todos los acuerdos activos de la empresa y filtrar para este cliente
        const [allActiveAgreements] = await pool.query(
            `SELECT a.*, p.codigo as product_code, p.nombre as catalog_product_name
             FROM egg_costing_customer_agreements a
             LEFT JOIN products p ON a.product_id = p.id
             WHERE a.company_id = ?
               AND a.status = 'activo'
               AND (a.valid_from IS NULL OR a.valid_from <= CURDATE())
               AND (a.valid_to IS NULL OR a.valid_to >= CURDATE())
             ORDER BY a.updated_at DESC`,
            [company_id]
        );

        const customerAgreements = allActiveAgreements.filter(a => {
            if (resolvedCustomerId && a.customer_id && Number(a.customer_id) === Number(resolvedCustomerId)) return true;
            const aName = norm(a.customer_name);
            if (!aName) return false;
            if (normCustName && (aName === normCustName || aName.includes(normCustName) || normCustName.includes(aName))) return true;
            if (normCommName && (aName === normCommName || aName.includes(normCommName) || normCommName.includes(aName))) return true;
            if (isDennys && aName.includes('denny')) return true;
            return false;
        }).map(a => {
            const pLb = parseFloat(a.agreed_price_per_lb) || 0;
            const factor = getPresentationFactorLbs(a.presentation || a.product_type);
            const uPrice = parseFloat(a.agreed_unit_price) > 0 ? parseFloat(a.agreed_unit_price) : parseFloat((pLb * factor).toFixed(4));
            return {
                id: a.id,
                product_id: a.product_id,
                product_code: a.product_code || null,
                product_type: a.product_type,
                presentation: a.presentation,
                price_per_lb: pLb,
                price_per_kg: parseFloat((pLb * LBS_PER_KG).toFixed(4)),
                unit_price: uPrice,
                notes: a.notes
            };
        });

        // Buscar acuerdo que coincida con el producto/presentación solicitada
        let matchedAgreement = null;
        if (customerAgreements.length > 0) {
            // Prioridad 1: Mismo product_id o misma familia + misma presentación
            matchedAgreement = customerAgreements.find(a =>
                (targetProductId && a.product_id && Number(a.product_id) === targetProductId) ||
                (getProductFamily(a.product_type) === targetFamily && isSamePresentation(a.presentation, presentation))
            );
            // Prioridad 2: Misma familia de producto (cualquier presentación, ya que el precio pactado es por libra)
            if (!matchedAgreement && targetFamily) {
                matchedAgreement = customerAgreements.find(a => getProductFamily(a.product_type) === targetFamily);
            }
            // Prioridad 3: Si no se especificó producto, tomar el primer acuerdo activo del cliente
            if (!matchedAgreement && !product_type) {
                matchedAgreement = customerAgreements[0];
            }
        }

        if (matchedAgreement && matchedAgreement.price_per_lb > 0) {
            const price = matchedAgreement.price_per_lb;
            const priceKg = matchedAgreement.price_per_kg;
            const unitPrice = parseFloat((price * targetFactorLbs).toFixed(4));
            return res.json({
                price_per_lb: price,
                price_per_kg: priceKg,
                unit_price: unitPrice,
                is_kg_customer: isKgCustomer,
                source: 'crm',
                description: `Pactado CRM: $${price.toFixed(4)}/lb ($${priceKg.toFixed(4)}/kg)`,
                agreement: matchedAgreement,
                customer_agreements: customerAgreements
            });
        }

        // 2. Buscar en el último pedido del cliente en egg_customer_orders (incluyendo items_json)
        const [lastOrders] = await pool.query(
            `SELECT id, price_per_lb, product_type, presentation, items_json, required_delivery_date, created_at
             FROM egg_customer_orders
             WHERE company_id = ?
               AND (
                   (customer_id IS NOT NULL AND customer_id = ?)
                   OR (customer_name IS NOT NULL AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?)))
               )
             ORDER BY id DESC LIMIT 25`,
            [company_id, resolvedCustomerId || 0, resolvedCustomerName]
        );

        let matchedOrderItem = null;
        let matchedOrderDate = '';
        for (const ord of lastOrders) {
            const dateStr = ord.created_at ? new Date(ord.created_at).toISOString().split('T')[0] : '';
            let parsedItems = [];
            if (ord.items_json) {
                try {
                    parsedItems = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : ord.items_json;
                } catch (e) {
                    parsedItems = [];
                }
            }
            const candidates = Array.isArray(parsedItems) && parsedItems.length > 0
                ? parsedItems.filter(it => !it.is_custom_detail && parseFloat(it.price_per_lb) > 0)
                : (parseFloat(ord.price_per_lb) > 0 ? [{ product_type: ord.product_type, presentation: ord.presentation, price_per_lb: ord.price_per_lb }] : []);

            for (const cand of candidates) {
                if (cand.is_kg_mode) isKgCustomer = true;
                const candFamily = getProductFamily(cand.product_type);
                const codeMatch = catalog_code && cand.catalog_code && norm(cand.catalog_code) === norm(catalog_code);
                if (codeMatch || (targetFamily && candFamily === targetFamily)) {
                    const candFactor = parseFloat(cand.unit_weight_lbs) || getPresentationFactorLbs(cand.presentation || cand.product_type);
                    let rawP = parseFloat(cand.price_per_lb) || 0;
                    // Normalizar si en un pedido anterior se guardó por error el precio de la presentación en vez de $/Lb
                    if (rawP > 4.2 && candFactor >= 2) {
                        rawP = parseFloat((rawP / candFactor).toFixed(4));
                    }
                    matchedOrderItem = { ...cand, normalized_price_per_lb: rawP };
                    matchedOrderDate = dateStr;
                    if (isSamePresentation(cand.presentation, presentation)) break;
                }
            }
            if (matchedOrderItem && isSamePresentation(matchedOrderItem.presentation, presentation)) break;
        }

        if (matchedOrderItem && matchedOrderItem.normalized_price_per_lb > 0) {
            const price = matchedOrderItem.normalized_price_per_lb;
            const priceKg = parseFloat((price * LBS_PER_KG).toFixed(4));
            return res.json({
                price_per_lb: price,
                price_per_kg: priceKg,
                unit_price: parseFloat((price * targetFactorLbs).toFixed(4)),
                is_kg_customer: isKgCustomer,
                source: 'last_order',
                description: `Último pedido (${matchedOrderDate}): $${price.toFixed(4)}/lb ($${priceKg.toFixed(4)}/kg)`,
                customer_agreements: customerAgreements
            });
        }

        // 3. Buscar en el historial de facturación de ventas (sales_headers + sales_items)
        const [sales] = await pool.query(
            `SELECT sh.id as sale_id, si.product_id, p.codigo as product_code, p.nombre as catalog_name,
                    si.precio_unitario, si.cantidad, si.descripcion, sh.fecha_emision, sh.created_at,
                    EXISTS(
                        SELECT 1 FROM sales_items si2
                        WHERE si2.sale_id = sh.id AND si2.precio_unitario = 0 AND LOWER(si2.descripcion) LIKE '%kg%'
                    ) as has_kg_note
             FROM sales_headers sh
             JOIN sales_items si ON sh.id = si.sale_id
             LEFT JOIN products p ON si.product_id = p.id
             WHERE sh.company_id = ?
               AND sh.estado != 'anulado'
               AND si.precio_unitario > 0
               AND (
                   (sh.customer_id IS NOT NULL AND sh.customer_id = ?)
                   OR (sh.cliente_nombre IS NOT NULL AND LOWER(TRIM(sh.cliente_nombre)) = LOWER(TRIM(?)))
               )
             ORDER BY sh.id DESC LIMIT 40`,
            [company_id, resolvedCustomerId || 0, resolvedCustomerName]
        );

        let matchedSale = null;
        for (const s of sales) {
            if (s.has_kg_note) isKgCustomer = true;
            const sFamily = getProductFamily(`${s.descripcion || ''} ${s.catalog_name || ''}`);
            const idMatch = targetProductId && s.product_id && Number(s.product_id) === targetProductId;
            const codeMatch = catalog_code && s.product_code && norm(s.product_code) === norm(catalog_code);
            if (idMatch || codeMatch || (targetFamily && sFamily === targetFamily)) {
                matchedSale = s;
                if (idMatch || codeMatch || isSamePresentation(s.descripcion || s.catalog_name, presentation)) break;
            }
        }

        if (matchedSale && parseFloat(matchedSale.precio_unitario) > 0) {
            const unitPrice = parseFloat(matchedSale.precio_unitario);
            const descText = `${matchedSale.descripcion || ''} ${matchedSale.catalog_name || ''}`;
            const factorLbs = getPresentationFactorLbs(descText);
            const saleInKg = Boolean(matchedSale.has_kg_note) || norm(descText).includes(' kg') || (isKgCustomer && unitPrice >= 1.8 && unitPrice <= 4.5 && factorLbs >= 4);

            let pricePerLb = unitPrice;
            if (saleInKg) {
                isKgCustomer = true;
                pricePerLb = parseFloat((unitPrice / LBS_PER_KG).toFixed(4));
            } else if (unitPrice > 3.8 && factorLbs > 1) {
                pricePerLb = parseFloat((unitPrice / factorLbs).toFixed(4));
            }

            const pricePerKg = parseFloat((pricePerLb * LBS_PER_KG).toFixed(4));
            const dateStr = matchedSale.fecha_emision || matchedSale.created_at
                ? new Date(matchedSale.fecha_emision || matchedSale.created_at).toISOString().split('T')[0]
                : '';

            return res.json({
                price_per_lb: pricePerLb,
                price_per_kg: pricePerKg,
                unit_price: parseFloat((pricePerLb * targetFactorLbs).toFixed(4)),
                is_kg_customer: isKgCustomer,
                source: 'last_sale',
                description: `Última factura (${dateStr}): $${pricePerLb.toFixed(4)}/lb ($${pricePerKg.toFixed(4)}/kg)`,
                sale: matchedSale,
                customer_agreements: customerAgreements
            });
        }

        return res.json({
            price_per_lb: 0,
            price_per_kg: 0,
            is_kg_customer: isKgCustomer,
            source: null,
            description: 'Sin precio previo registrado.',
            customer_agreements: customerAgreements
        });
    } catch (error) {
        console.error('Error al obtener precio de cliente para ovoproductos:', error);
        res.status(500).json({ message: error.message });
    }
};

const getFactoryUsers = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const [users] = await pool.query(
            `SELECT u.id, u.username, u.nombre, r.name as role_name
             FROM users u
             INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
             LEFT JOIN roles r ON ue.role_id = r.id
             WHERE u.status = 'activo' AND ue.empresa_id = ?
             ORDER BY u.nombre ASC`,
            [company_id]
        );
        res.json(users);
    } catch (error) {
        console.error('Error al obtener usuarios de fábrica:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { deleteEggCustomerOrder, getCustomerPricingForOrder, getFactoryUsers };
