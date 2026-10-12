const pool = require('../../config/db');
const { emitRestaurant, getActiveOrderDetails, getRestaurantConfig } = require('../../services/restaurant.service');

function safeParseJson(str, fallback = []) {
    if (!str) return fallback;
    if (typeof str !== 'string') return str;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

async function getKdsOrders(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const { station_id } = req.query;

        let query = `
            SELECT ro.*, rt.table_number, ra.name as area_name, u.nombre as waiter_name
            FROM restaurant_orders ro
            LEFT JOIN restaurant_tables rt ON ro.table_id = rt.id
            LEFT JOIN restaurant_areas ra ON rt.area_id = ra.id
            LEFT JOIN users u ON ro.waiter_id = u.id
            WHERE ro.company_id = ? AND ro.status IN ('abierta', 'en_cocina', 'lista')
        `;
        const params = [companyId];

        if (branchId) {
            query += " AND (ro.branch_id = ? OR ro.branch_id IS NULL)";
            params.push(branchId);
        }

        query += " ORDER BY ro.opened_at ASC";

        const [orders] = await pool.query(query, params);
        const config = await getRestaurantConfig(companyId);

        let targetCategoryIds = null;
        if (station_id && station_id !== 'all') {
            const [stRows] = await pool.query("SELECT category_ids FROM restaurant_stations WHERE id = ? AND company_id = ?", [station_id, companyId]);
            if (stRows.length > 0 && stRows[0].category_ids) {
                targetCategoryIds = safeParseJson(stRows[0].category_ids, []).map(Number);
            }
        }

        const result = [];
        for (const order of orders) {
            let itemQuery = `
                SELECT roi.*, COALESCE(p.nombre, 'Producto') as product_name, p.codigo as sku, rs.name as station_name
                FROM restaurant_order_items roi
                LEFT JOIN products p ON roi.product_id = p.id
                LEFT JOIN restaurant_stations rs ON roi.station_id = rs.id
                WHERE roi.order_id = ?
            `;
            const itemParams = [order.id];

            if (station_id && station_id !== 'all') {
                if (targetCategoryIds && targetCategoryIds.length > 0) {
                    itemQuery += " AND (roi.station_id = ? OR (roi.station_id IS NULL AND p.category_id IN (?)))";
                    itemParams.push(station_id, targetCategoryIds);
                } else {
                    itemQuery += " AND roi.station_id = ?";
                    itemParams.push(station_id);
                }
            }

            itemQuery += " ORDER BY roi.id ASC";

            const [items] = await pool.query(itemQuery, itemParams);
            if (items.length > 0) {
                order.items = items.map(i => ({
                    ...i,
                    selected_modifiers: safeParseJson(i.selected_modifiers)
                }));
                order.kds_warning_minutes = config.kds_warning_minutes;
                order.kds_danger_minutes = config.kds_danger_minutes;
                result.push(order);
            }
        }

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error in getKdsOrders:', err);
        res.status(500).json({ success: false, message: 'Error al obtener comandas para KDS' });
    }
}

async function updateItemStatus(req, res) {
    try {
        const { id, itemId } = req.params;
        const companyId = req.company_id || req.companyId;
        const { status } = req.body; // 'pendiente', 'en_preparacion', 'listo', 'servido'

        const validStatuses = ['pendiente', 'en_preparacion', 'listo', 'servido'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado de partida inválido' });
        }

        const preparedAt = status === 'listo' ? 'NOW()' : 'NULL';
        await pool.query(`
            UPDATE restaurant_order_items
            SET status = ?,
                prepared_at = ${preparedAt},
                course_status = CASE WHEN ? IN ('en_preparacion', 'listo') AND course_status = 'en_espera' THEN 'marchado' ELSE course_status END
            WHERE id = ? AND order_id = ?
        `, [status, status, itemId, id]);

        // Verificar si todos los ítems están listos
        const [remaining] = await pool.query(`
            SELECT COUNT(*) as pending_count
            FROM restaurant_order_items
            WHERE order_id = ? AND status IN ('pendiente', 'en_preparacion') AND status != 'cancelado'
        `, [id]);

        let orderReady = false;
        if (remaining[0]?.pending_count === 0) {
            await pool.query("UPDATE restaurant_orders SET status = 'lista' WHERE id = ?", [id]);
            orderReady = true;
        }

        const updatedOrder = await getActiveOrderDetails(id, companyId);

        emitRestaurant(companyId, 'restaurant:item_status', {
            orderId: id,
            itemId,
            status,
            order: updatedOrder
        });

        if (orderReady) {
            emitRestaurant(companyId, 'restaurant:order_ready', {
                orderId: id,
                tableNumber: updatedOrder.table_number || updatedOrder.customer_name,
                order: updatedOrder
            });
        }

        res.json({ success: true, message: `Partida actualizada a ${status}`, data: updatedOrder });
    } catch (err) {
        console.error('Error in updateItemStatus:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar estado de la partida' });
    }
}

async function updateOrderStatus(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { status, station_id } = req.body; // 'en_cocina', 'lista', 'abierta'

        if (status === 'lista') {
            if (station_id && station_id !== 'all') {
                await pool.query(
                    "UPDATE restaurant_order_items SET status = 'listo', prepared_at = NOW() WHERE order_id = ? AND status != 'cancelado' AND station_id = ?",
                    [id, station_id]
                );
            } else {
                await pool.query(
                    "UPDATE restaurant_order_items SET status = 'listo', prepared_at = NOW() WHERE order_id = ? AND status != 'cancelado'",
                    [id]
                );
            }
        }

        const [remaining] = await pool.query(`
            SELECT COUNT(*) as pending_count
            FROM restaurant_order_items
            WHERE order_id = ? AND status IN ('pendiente', 'en_preparacion') AND status != 'cancelado'
        `, [id]);

        const orderReady = remaining[0]?.pending_count === 0;
        const finalOrderStatus = (status === 'lista' && !orderReady) ? 'en_cocina' : status;

        await pool.query("UPDATE restaurant_orders SET status = ? WHERE id = ? AND company_id = ?", [finalOrderStatus, id, companyId]);

        const updatedOrder = await getActiveOrderDetails(id, companyId);

        emitRestaurant(companyId, 'restaurant:order_status', { orderId: id, status: finalOrderStatus, order: updatedOrder });
        if (orderReady) {
            emitRestaurant(companyId, 'restaurant:order_ready', {
                orderId: id,
                tableNumber: updatedOrder.table_number || updatedOrder.customer_name,
                order: updatedOrder
            });
        }

        res.json({ success: true, message: `Comanda marcada como ${finalOrderStatus}`, data: updatedOrder });
    } catch (err) {
        console.error('Error in updateOrderStatus:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar estado de comanda' });
    }
}

// GESTIÓN DE PRODUCTO AGOTADO (PLATO 86)
async function getUnavailableProducts(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;

        let query = `
            SELECT rup.*, COALESCE(p.nombre, 'Producto') as product_name, p.codigo as sku
            FROM restaurant_unavailable_products rup
            LEFT JOIN products p ON rup.product_id = p.id
            WHERE rup.company_id = ?
        `;
        const params = [companyId];

        if (branchId) {
            query += " AND (rup.branch_id = ? OR rup.branch_id IS NULL)";
            params.push(branchId);
        }

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getUnavailableProducts:', err);
        res.status(500).json({ success: false, message: 'Error al obtener productos agotados' });
    }
}

async function toggleProduct86(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.body?.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const userId = req.user?.id || null;
        const { product_id, is_unavailable } = req.body;

        if (!product_id) {
            return res.status(400).json({ success: false, message: 'ID de producto requerido' });
        }

        if (is_unavailable) {
            await pool.query(`
                INSERT INTO restaurant_unavailable_products (company_id, branch_id, product_id, marked_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE marked_by = VALUES(marked_by)
            `, [companyId, branchId, product_id, userId]);
        } else {
            await pool.query(
                "DELETE FROM restaurant_unavailable_products WHERE company_id = ? AND product_id = ?",
                [companyId, product_id]
            );
        }

        const [product] = await pool.query("SELECT id, nombre as name FROM products WHERE id = ?", [product_id]);

        emitRestaurant(companyId, 'restaurant:product_86', {
            productId: product_id,
            productName: product[0]?.name || '',
            isUnavailable: Boolean(is_unavailable)
        });

        res.json({
            success: true,
            message: is_unavailable ? 'Producto marcado como Agotado (86)' : 'Producto reactivado en cocina',
            data: { productId: product_id, isUnavailable: Boolean(is_unavailable) }
        });
    } catch (err) {
        console.error('Error in toggleProduct86:', err);
        res.status(500).json({ success: false, message: 'Error al cambiar disponibilidad del producto' });
    }
}

module.exports = {
    getKdsOrders,
    updateItemStatus,
    updateOrderStatus,
    getUnavailableProducts,
    toggleProduct86
};
