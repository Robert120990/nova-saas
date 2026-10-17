const pool = require('../../config/db');
const { emitRestaurant, recalculateOrderTotals, getActiveOrderDetails, getRestaurantConfig, resolveStationsForOrderItems } = require('../../services/restaurant.service');

async function getOrders(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const { status, table_id, order_type, start_date, end_date, search, waiter_id } = req.query;

        let query = `
            SELECT ro.*, rt.table_number, ra.name as area_name, u.nombre as waiter_name,
                   sh.dte_type, sh.codigo_generacion, sh.numero_control, sh.sello_recepcion, sh.fh_procesamiento,
                   (SELECT COUNT(*) FROM restaurant_order_items WHERE order_id = ro.id AND status != 'cancelado') as total_items
            FROM restaurant_orders ro
            LEFT JOIN restaurant_tables rt ON ro.table_id = rt.id
            LEFT JOIN restaurant_areas ra ON rt.area_id = ra.id
            LEFT JOIN users u ON ro.waiter_id = u.id
            LEFT JOIN sales_headers sh ON ro.sale_id = sh.id
            WHERE ro.company_id = ?
        `;
        const params = [companyId];
        if (branchId) { query += " AND (ro.branch_id = ? OR ro.branch_id IS NULL)"; params.push(branchId); }
        if (status && status !== 'all') { query += " AND ro.status = ?"; params.push(status); }
        else if (!status) { query += " AND ro.status IN ('abierta', 'en_cocina', 'lista')"; }
        if (table_id) { query += " AND ro.table_id = ?"; params.push(table_id); }
        if (order_type) { query += " AND ro.order_type = ?"; params.push(order_type); }
        if (waiter_id) { query += " AND ro.waiter_id = ?"; params.push(waiter_id); }
        if (start_date && end_date) { query += " AND DATE(ro.opened_at) BETWEEN ? AND ?"; params.push(start_date, end_date); }
        if (search && search.trim()) {
            query += " AND (ro.id = ? OR ro.customer_name LIKE ? OR rt.table_number LIKE ? OR sh.numero_control LIKE ?)";
            params.push(search.trim(), `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
        }
        query += " ORDER BY ro.opened_at DESC LIMIT 300";

        const [rows] = await pool.query(query, params);
        if (rows.length > 0) {
            const [allItems] = await pool.query(`
                SELECT roi.*, COALESCE(p.nombre, 'Producto') as product_name, p.codigo as sku, rs.name as station_name
                FROM restaurant_order_items roi
                LEFT JOIN products p ON roi.product_id = p.id
                LEFT JOIN restaurant_stations rs ON roi.station_id = rs.id
                WHERE roi.order_id IN (?) ORDER BY roi.id ASC
            `, [rows.map(r => r.id)]);
            const map = {};
            allItems.forEach(i => {
                try {
                    i.selected_modifiers = typeof i.selected_modifiers === 'string' ? JSON.parse(i.selected_modifiers) : (i.selected_modifiers || []);
                } catch {
                    i.selected_modifiers = [];
                }
                (map[i.order_id] = map[i.order_id] || []).push(i);
            });
            rows.forEach(r => { r.items = map[r.id] || []; });
        }
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getOrders:', err);
        res.status(500).json({ success: false, message: 'Error al obtener comandas' });
    }
}

async function getOrderById(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;

        const order = await getActiveOrderDetails(id, companyId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Comanda no encontrada' });
        }

        res.json({ success: true, data: order });
    } catch (err) {
        console.error('Error in getOrderById:', err);
        res.status(500).json({ success: false, message: 'Error al consultar comanda' });
    }
}

async function createOrder(req, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.companyId;
        const branchId = req.body?.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const waiterId = req.user?.id || null;
        const { table_id, order_type = 'mesa', customer_name, customer_phone, delivery_address, guest_count = 1, notes, items = [] } = req.body;

        const config = await getRestaurantConfig(companyId, branchId);
        const tipPercentage = config.enable_tips ? Number(config.default_tip_percentage || 10) : 0;

        // Si es orden de mesa, verificar que no tenga comanda abierta activa
        if (order_type === 'mesa' && table_id) {
            const [active] = await conn.query(
                "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('abierta', 'en_cocina', 'lista') LIMIT 1",
                [table_id]
            );
            if (active.length > 0) {
                await conn.rollback();
                return res.status(400).json({ success: false, message: 'La mesa ya tiene una comanda activa abierta.' });
            }
        }

        const [orderResult] = await conn.query(`
            INSERT INTO restaurant_orders (company_id, branch_id, table_id, order_type, customer_name, customer_phone, delivery_address, waiter_id, status, guest_count, tip_percentage, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abierta', ?, ?, ?)
        `, [companyId, branchId, table_id || null, order_type, customer_name || null, customer_phone || null, delivery_address || null, waiterId, guest_count, tipPercentage, notes || null]);

        const orderId = orderResult.insertId;

        // Actualizar estado de la mesa a 'ocupada'
        if (order_type === 'mesa' && table_id) {
            await conn.query("UPDATE restaurant_tables SET status = 'ocupada' WHERE id = ?", [table_id]);
        }

        if (Array.isArray(items) && items.length > 0) {
            const resolvedItems = await resolveStationsForOrderItems(companyId, branchId, items, conn);
            for (const item of resolvedItems) {
                await conn.query(`
                    INSERT INTO restaurant_order_items (order_id, product_id, station_id, quantity, unit_price, course, course_status, seat_number, status, notes, selected_modifiers, sent_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, NOW())
                `, [
                    orderId,
                    item.product_id,
                    item.station_id || null,
                    item.quantity || 1,
                    item.unit_price || 0,
                    item.course || 'fuerte',
                    item.course_status || (item.course === 'fuerte' ? 'en_espera' : 'marchado'),
                    item.seat_number || 1,
                    item.notes || null,
                    item.selected_modifiers ? JSON.stringify(item.selected_modifiers) : null
                ]);
            }
        }

        await conn.commit();

        await recalculateOrderTotals(orderId);
        const fullOrder = await getActiveOrderDetails(orderId, companyId);

        emitRestaurant(companyId, 'restaurant:table_status', { table_id, status: 'ocupada' });
        emitRestaurant(companyId, 'restaurant:new_order', fullOrder);

        res.status(201).json({ success: true, message: 'Comanda creada con éxito', data: fullOrder });
    } catch (err) {
        await conn.rollback();
        console.error('Error in createOrder:', err);
        res.status(500).json({ success: false, message: 'Error al crear comanda' });
    } finally {
        conn.release();
    }
}

async function addItemsToOrder(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { items = [] } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No se enviaron partidas a agregar' });
        }

        const [orders] = await pool.query("SELECT * FROM restaurant_orders WHERE id = ? AND company_id = ?", [id, companyId]);
        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Comanda no encontrada' });
        }

        const branchId = orders[0].branch_id || req.branch_id || req.body?.branch_id;
        const resolvedItems = await resolveStationsForOrderItems(companyId, branchId, items);
        for (const item of resolvedItems) {
            await pool.query(`
                INSERT INTO restaurant_order_items (order_id, product_id, station_id, quantity, unit_price, course, course_status, seat_number, status, notes, selected_modifiers, sent_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, NOW())
            `, [
                id,
                item.product_id,
                item.station_id || null,
                item.quantity || 1,
                item.unit_price || 0,
                item.course || 'fuerte',
                item.course_status || 'marchado',
                item.seat_number || 1,
                item.notes || null,
                item.selected_modifiers ? JSON.stringify(item.selected_modifiers) : null
            ]);
        }

        // Marcar comanda en_cocina si no lo estaba
        await pool.query("UPDATE restaurant_orders SET status = 'en_cocina' WHERE id = ? AND status = 'abierta'", [id]);

        await recalculateOrderTotals(id);
        const updatedOrder = await getActiveOrderDetails(id, companyId);

        emitRestaurant(companyId, 'restaurant:order_updated', updatedOrder);

        res.json({ success: true, message: 'Partidas agregadas a la comanda', data: updatedOrder });
    } catch (err) {
        console.error('Error in addItemsToOrder:', err);
        res.status(500).json({ success: false, message: 'Error al agregar partidas a comanda' });
    }
}

async function fireCourse(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { course } = req.body; // 'fuerte' o 'postre'

        await pool.query(`
            UPDATE restaurant_order_items
            SET course_status = 'marchado', sent_at = NOW()
            WHERE order_id = ? AND course = ? AND course_status = 'en_espera' AND status != 'cancelado'
        `, [id, course]);

        await pool.query("UPDATE restaurant_orders SET status = 'en_cocina' WHERE id = ? AND status = 'abierta'", [id]);

        const updatedOrder = await getActiveOrderDetails(id, companyId);
        emitRestaurant(companyId, 'restaurant:course_fired', { orderId: id, course, order: updatedOrder });

        res.json({ success: true, message: `Tiempo ${course} marchado a cocina`, data: updatedOrder });
    } catch (err) {
        console.error('Error in fireCourse:', err);
        res.status(500).json({ success: false, message: 'Error al marchar tiempo de comida' });
    }
}

async function cancelOrderItem(req, res) {
    try {
        const { id, itemId } = req.params;
        const companyId = req.company_id || req.companyId;
        const userId = req.user?.id || null;
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'El motivo de anulación es obligatorio' });
        }

        await pool.query(`
            UPDATE restaurant_order_items
            SET status = 'cancelado', cancellation_reason = ?, cancelled_by = ?
            WHERE id = ? AND order_id = ?
        `, [reason.trim(), userId, itemId, id]);

        await recalculateOrderTotals(id);
        const updatedOrder = await getActiveOrderDetails(id, companyId);

        emitRestaurant(companyId, 'restaurant:item_cancelled', {
            orderId: id,
            itemId,
            reason: reason.trim(),
            cancelledBy: req.user.nombre || 'Mesero',
            order: updatedOrder
        });

        res.json({ success: true, message: 'Platillo anulado con éxito', data: updatedOrder });
    } catch (err) {
        console.error('Error in cancelOrderItem:', err);
        res.status(500).json({ success: false, message: 'Error al anular platillo' });
    }
}

async function updateTip(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { tip_percentage, tip_amount } = req.body;

        if (tip_percentage !== undefined) {
            await pool.query("UPDATE restaurant_orders SET tip_percentage = ? WHERE id = ? AND company_id = ?", [tip_percentage, id, companyId]);
        } else if (tip_amount !== undefined) {
            const [orders] = await pool.query("SELECT subtotal FROM restaurant_orders WHERE id = ?", [id]);
            const subtotal = Number(orders[0]?.subtotal || 0);
            const calculatedPct = subtotal > 0 ? ((tip_amount / subtotal) * 100).toFixed(2) : 0;
            await pool.query("UPDATE restaurant_orders SET tip_percentage = ?, tip_amount = ?, total_with_tip = ? WHERE id = ? AND company_id = ?", [calculatedPct, tip_amount, (subtotal + Number(tip_amount)).toFixed(2), id, companyId]);
        }

        await recalculateOrderTotals(id);
        const updatedOrder = await getActiveOrderDetails(id, companyId);

        res.json({ success: true, message: 'Propina actualizada', data: updatedOrder });
    } catch (err) {
        console.error('Error in updateTip:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar propina' });
    }
}

async function closeOrder(req, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { status = 'facturada', sale_id, tip_amount, total_with_tip } = req.body;
        const [orders] = await conn.query("SELECT * FROM restaurant_orders WHERE id = ? AND company_id = ?", [id, companyId]);
        if (orders.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Comanda no encontrada' });
        }

        const order = orders[0];
        let updateSql = "UPDATE restaurant_orders SET status = ?, closed_at = NOW()";
        const updateParams = [status];
        if (sale_id !== undefined) { updateSql += ", sale_id = ?"; updateParams.push(sale_id); }
        if (tip_amount !== undefined) { updateSql += ", tip_amount = ?"; updateParams.push(tip_amount); }
        if (total_with_tip !== undefined) { updateSql += ", total_with_tip = ?"; updateParams.push(total_with_tip); }
        updateSql += " WHERE id = ?";
        updateParams.push(id);
        await conn.query(updateSql, updateParams);

        if (order.table_id) {
            const [otherActive] = await conn.query(
                "SELECT id FROM restaurant_orders WHERE table_id = ? AND id != ? AND status IN ('abierta', 'en_cocina', 'lista')",
                [order.table_id, id]
            );
            if (otherActive.length === 0) {
                await conn.query("UPDATE restaurant_tables SET status = 'disponible' WHERE id = ?", [order.table_id]);
                emitRestaurant(companyId, 'restaurant:table_status', { table_id: order.table_id, status: 'disponible' });
            }
        }
        await conn.commit();
        emitRestaurant(companyId, 'restaurant:order_closed', { orderId: id, status });

        res.json({ success: true, message: `Comanda marcada como ${status}` });
    } catch (err) {
        await conn.rollback();
        console.error('Error in closeOrder:', err);
        res.status(500).json({ success: false, message: 'Error al cerrar comanda' });
    } finally {
        conn.release();
    }
}

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    addItemsToOrder,
    fireCourse,
    cancelOrderItem,
    updateTip,
    closeOrder
};
