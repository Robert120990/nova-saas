const { pool, resolveEggCatalogProduct, safeNum, safeInt } = require('../../../controllers/eggIndustrial/eggPlanning/shared');

const saveEggCustomerOrder = async (req) => {
    const responseHeaders = {};
    try {
        const { id } = req.params;
        const {
            customer_id,
            customer_branch_id,
            customer_name,
            order_number,
            product_type,
            presentation,
            quantity_lbs,
            required_delivery_date,
            status,
            priority,
            price_per_lb,
            notes,
            items,
            items_json,
            batch_id,
            lot_code
        } = req.body;

        const company_id = req.company_id || req.user?.company_id;

        if (!customer_name || !required_delivery_date) {
            return ({ status: 400, body: { message: 'El nombre del cliente y la fecha requerida son obligatorios.' }, headers: responseHeaders });
        }

        // 1. Manejo flexible de cliente: si existe se vincula, si no se encuentra o se escribe ad-hoc se permite sin bloquear
        let resolvedCustomerId = safeInt(customer_id, null);
        let resolvedCustomerName = (customer_name || '').trim();

        if (resolvedCustomerId) {
            const [cCheck] = await pool.query(
                'SELECT id, nombre, nombre_comercial FROM customers WHERE id = ? AND company_id = ?',
                [resolvedCustomerId, company_id]
            );
            if (cCheck.length > 0) {
                if ((cCheck[0].nombre || '').toUpperCase().includes('[INACTIVO') || (cCheck[0].nombre_comercial || '').toUpperCase().includes('[INACTIVO')) {
                    return ({ status: 400, body: { message: `El cliente seleccionado "${cCheck[0].nombre}" está inactivo o marcado como duplicado. Por favor seleccione el cliente activo correspondiente.` }, headers: responseHeaders });
                }
                resolvedCustomerName = cCheck[0].nombre;
            } else {
                resolvedCustomerId = null;
            }
        } else if (resolvedCustomerName) {
            // Intentar buscar coincidencia sin forzar si no está registrado, priorizando clientes activos
            const [cCheck] = await pool.query(
                `SELECT id, nombre, nombre_comercial FROM customers
                 WHERE company_id = ?
                   AND (LOWER(TRIM(nombre)) = LOWER(TRIM(?)) OR LOWER(TRIM(nombre_comercial)) = LOWER(TRIM(?)))
                   AND nombre NOT LIKE '[INACTIVO%'
                 ORDER BY id ASC
                 LIMIT 1`,
                [company_id, resolvedCustomerName, resolvedCustomerName]
            );
            if (cCheck.length > 0) {
                resolvedCustomerId = cCheck[0].id;
                resolvedCustomerName = cCheck[0].nombre;
            }
        }

        // Validar sucursal si se especificó
        let resolvedBranchId = safeInt(customer_branch_id, null);
        if (resolvedBranchId && resolvedCustomerId) {
            const [bCheck] = await pool.query(
                'SELECT id FROM customer_branches WHERE id = ? AND customer_id = ? AND company_id = ?',
                [resolvedBranchId, resolvedCustomerId, company_id]
            );
            if (bCheck.length === 0) {
                resolvedBranchId = null;
            }
        } else {
            resolvedBranchId = null;
        }

        // 2. Procesar presentaciones y productos múltiples (+ botón)
        let itemList = [];
        if (Array.isArray(items) && items.length > 0) {
            itemList = items;
        } else if (items_json) {
            try {
                itemList = typeof items_json === 'string' ? JSON.parse(items_json) : items_json;
            } catch (e) {
                itemList = [];
            }
        }

        let primaryProductType = (product_type || '').trim();
        let primaryPresentation = (presentation || '').trim();
        let primaryPrice = safeNum(price_per_lb, 0);
        let totalQuantityLbs = safeNum(quantity_lbs, 0);
        let resolvedBatchId = safeInt(batch_id, null);
        let resolvedLotCode = lot_code || null;

        if (itemList.length > 0) {
            totalQuantityLbs = itemList.reduce((sum, it) => sum + safeNum(it.quantity_lbs, 0), 0);
            for (const it of itemList) {
                if (!it.catalog_product_id) {
                    const resolved = await resolveEggCatalogProduct(pool, company_id, it.product_type, it.presentation);
                    if (resolved && resolved.catalog_product_id) {
                        it.catalog_product_id = resolved.catalog_product_id;
                        it.catalog_code = it.catalog_code || resolved.catalog_code;
                        it.is_returnable = resolved.is_returnable;
                    }
                }
            }
            const firstItem = itemList[0];
            primaryProductType = primaryProductType || firstItem.product_type || 'Huevo Entero Pasteurizado';
            primaryPresentation = primaryPresentation || firstItem.presentation || 'cubeta 30LB';
            if (primaryPrice <= 0 && firstItem.price_per_lb) {
                primaryPrice = safeNum(firstItem.price_per_lb, 0);
            }
            if (!resolvedBatchId && firstItem.batch_id) {
                resolvedBatchId = safeInt(firstItem.batch_id, null);
            }
            if (!resolvedLotCode && firstItem.lot_code) {
                resolvedLotCode = firstItem.lot_code;
            }
        } else {
            primaryProductType = primaryProductType || 'Huevo Entero Pasteurizado';
            primaryPresentation = primaryPresentation || 'cubeta 30LB';
        }

        if (totalQuantityLbs <= 0) {
            totalQuantityLbs = safeNum(quantity_lbs, 0);
        }

        // Resolver lot_code si tenemos batch_id
        if (resolvedBatchId && !resolvedLotCode) {
            const [bRow] = await pool.query(
                'SELECT batch_code_display FROM egg_production_batches WHERE id = ? AND company_id = ?',
                [resolvedBatchId, company_id]
            );
            if (bRow.length > 0) {
                resolvedLotCode = bRow[0].batch_code_display;
            }
        }

        const serializedItems = itemList.length > 0 ? JSON.stringify(itemList) : null;

        // 3. Obtener precio pactado del CRM si no se ingresó manualmente
        if (primaryPrice <= 0 && resolvedCustomerId) {
            // Intentar primero coincidencia de producto Y presentación activa y vigente
            let [agreements] = await pool.query(
                `SELECT agreed_price_per_lb
                 FROM egg_costing_customer_agreements
                 WHERE company_id = ?
                   AND (customer_id = ? OR customer_name = ?)
                   AND status = 'activo'
                   AND (valid_from IS NULL OR valid_from <= CURDATE())
                   AND (valid_to IS NULL OR valid_to >= CURDATE())
                   AND (
                       product_type = ?
                       OR LOWER(product_type) LIKE LOWER(?)
                       OR LOWER(?) LIKE CONCAT('%', LOWER(product_type), '%')
                   )
                   AND (
                       presentation = ?
                       OR LOWER(presentation) LIKE LOWER(?)
                       OR LOWER(?) LIKE CONCAT('%', LOWER(presentation), '%')
                   )
                 ORDER BY updated_at DESC LIMIT 1`,
                [company_id, resolvedCustomerId, resolvedCustomerName, primaryProductType, `%${primaryProductType}%`, primaryProductType, primaryPresentation, `%${primaryPresentation}%`, primaryPresentation]
            );

            // Si no hay precio con presentación exacta, buscar por tipo de producto general
            if (agreements.length === 0) {
                const [genAgr] = await pool.query(
                    `SELECT agreed_price_per_lb
                     FROM egg_costing_customer_agreements
                     WHERE company_id = ?
                       AND (customer_id = ? OR customer_name = ?)
                       AND status = 'activo'
                       AND (valid_from IS NULL OR valid_from <= CURDATE())
                       AND (valid_to IS NULL OR valid_to >= CURDATE())
                       AND (
                           product_type = ?
                           OR LOWER(product_type) LIKE LOWER(?)
                           OR LOWER(?) LIKE CONCAT('%', LOWER(product_type), '%')
                       )
                     ORDER BY updated_at DESC LIMIT 1`,
                    [company_id, resolvedCustomerId, resolvedCustomerName, primaryProductType, `%${primaryProductType}%`, primaryProductType]
                );
                agreements = genAgr;
            }

            if (agreements.length > 0 && safeNum(agreements[0].agreed_price_per_lb, 0) > 0) {
                primaryPrice = safeNum(agreements[0].agreed_price_per_lb, 0);
            }
        }

        let orderId = id;
        if (id) {
            const [currentOrder] = await pool.query(
                'SELECT dispatch_route_id FROM egg_customer_orders WHERE id = ? AND company_id = ?',
                [id, company_id]
            );

            await pool.query(
                `UPDATE egg_customer_orders SET
                    customer_id = ?, customer_branch_id = ?, customer_name = ?, order_number = ?, product_type = ?,
                    presentation = ?, quantity_lbs = ?, required_delivery_date = ?,
                    status = ?, priority = ?, price_per_lb = ?, notes = ?,
                    items_json = ?, batch_id = ?, lot_code = ?
                 WHERE id = ? AND company_id = ?`,
                [
                    resolvedCustomerId, resolvedBranchId, resolvedCustomerName, order_number || null, primaryProductType,
                    primaryPresentation, totalQuantityLbs,
                    required_delivery_date, status || 'pendiente', priority || 'normal', primaryPrice,
                    notes || null, serializedItems, resolvedBatchId, resolvedLotCode, id, company_id
                ]
            );

            // Sincronizar parada de despacho y totales de ruta si el pedido ya está en ruta/despacho
            const [stopRoutes] = await pool.query(
                'SELECT DISTINCT dispatch_route_id FROM egg_dispatch_stops WHERE order_id = ?',
                [id]
            );
            const routeIdsToSync = new Set();
            if (currentOrder[0]?.dispatch_route_id) {
                routeIdsToSync.add(currentOrder[0].dispatch_route_id);
            }
            stopRoutes.forEach(sr => {
                if (sr.dispatch_route_id) routeIdsToSync.add(sr.dispatch_route_id);
            });

            if (routeIdsToSync.size > 0) {
                await pool.query(
                    `UPDATE egg_dispatch_stops
                     SET customer_id = ?, customer_branch_id = ?, batch_id = ?, lot_code = ?
                     WHERE order_id = ?`,
                    [resolvedCustomerId, resolvedBranchId, resolvedBatchId, resolvedLotCode, id]
                );

                for (const rId of routeIdsToSync) {
                    const [rOrders] = await pool.query(
                        `SELECT o.quantity_lbs
                         FROM egg_dispatch_stops s
                         JOIN egg_customer_orders o ON s.order_id = o.id
                         WHERE s.dispatch_route_id = ?`,
                        [rId]
                    );
                    let rLbs = 0;
                    let rCubetas = 0;
                    rOrders.forEach(ro => {
                        const l = safeNum(ro.quantity_lbs, 0);
                        rLbs += l;
                        rCubetas += Math.ceil(l / 30.0);
                    });
                    await pool.query(
                        'UPDATE egg_dispatch_routes SET total_peso_lbs = ?, total_cubetas = ? WHERE id = ?',
                        [safeNum(rLbs, 0), safeNum(rCubetas, 0), safeInt(rId)]
                    );
                }
            }

            return ({ status: 200, body: {
                id,
                message: 'Pedido actualizado exitosamente.',
                customer_id: resolvedCustomerId,
                customer_name: resolvedCustomerName,
                price_per_lb: primaryPrice,
                batch_id: resolvedBatchId,
                lot_code: resolvedLotCode,
                quantity_lbs: totalQuantityLbs
            }, headers: responseHeaders });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_customer_orders (
                    company_id, customer_id, customer_branch_id, customer_name, order_number, product_type,
                    presentation, quantity_lbs, required_delivery_date, status, priority, price_per_lb, notes,
                    items_json, batch_id, lot_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id, resolvedCustomerId, resolvedBranchId, resolvedCustomerName, order_number || null, primaryProductType,
                    primaryPresentation, totalQuantityLbs,
                    required_delivery_date, status || 'pendiente', priority || 'normal', primaryPrice,
                    notes || null, serializedItems, resolvedBatchId, resolvedLotCode
                ]
            );
            orderId = result.insertId;
            return ({ status: 201, body: {
                id: orderId,
                message: 'Pedido registrado exitosamente.',
                customer_id: resolvedCustomerId,
                customer_name: resolvedCustomerName,
                price_per_lb: primaryPrice,
                batch_id: resolvedBatchId,
                lot_code: resolvedLotCode,
                quantity_lbs: totalQuantityLbs
            }, headers: responseHeaders });
        }
    } catch (error) {
        console.error('Error al guardar pedido de ovoproductos:', error);
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    }
};
module.exports = saveEggCustomerOrder;
