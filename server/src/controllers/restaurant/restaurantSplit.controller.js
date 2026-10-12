const pool = require('../../config/db');
const { emitRestaurant, recalculateOrderTotals, getActiveOrderDetails } = require('../../services/restaurant.service');

async function splitOrder(req, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { item_ids, split_name } = req.body;

        if (!Array.isArray(item_ids) || item_ids.length === 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Debes seleccionar al menos un platillo para dividir' });
        }

        // Obtener comanda original
        const [orders] = await conn.query(
            "SELECT * FROM restaurant_orders WHERE id = ? AND company_id = ? AND status IN ('abierta', 'en_cocina', 'lista')",
            [id, companyId]
        );

        if (orders.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Comanda original no encontrada o ya finalizada' });
        }

        const original = orders[0];

        // Obtener partidas activas de la orden original
        const [allItems] = await conn.query(
            "SELECT id FROM restaurant_order_items WHERE order_id = ? AND status != 'cancelado'",
            [id]
        );

        const movingIds = item_ids.map(Number);
        const validMovingItems = allItems.filter(i => movingIds.includes(i.id));

        if (validMovingItems.length === 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Ninguna de las partidas seleccionadas es válida' });
        }

        if (validMovingItems.length >= allItems.length) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'No puedes mover todas las partidas; al menos una debe quedar en la comanda original' });
        }

        // Crear nueva comanda secundaria
        const secondaryName = (split_name || '').trim() || `Cuenta B (Mesa ${original.table_id ? original.table_id : ''})`;
        const [insertResult] = await conn.query(`
            INSERT INTO restaurant_orders (
                company_id, branch_id, table_id, order_type,
                customer_name, waiter_id, status, guest_count,
                tip_percentage, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `, [
            original.company_id,
            original.branch_id,
            original.table_id,
            original.order_type,
            secondaryName,
            original.waiter_id,
            original.status,
            original.tip_percentage || 10.00,
            `Dividida de comanda #${original.id}`
        ]);

        const newOrderId = insertResult.insertId;

        // Transferir los ítems seleccionados a la nueva comanda
        await conn.query(
            "UPDATE restaurant_order_items SET order_id = ? WHERE id IN (?) AND order_id = ?",
            [newOrderId, movingIds, id]
        );

        await conn.commit();

        // Recalcular totales para ambas comandas
        await recalculateOrderTotals(id);
        await recalculateOrderTotals(newOrderId);

        const updatedOriginal = await getActiveOrderDetails(id, companyId);
        const newOrderDetails = await getActiveOrderDetails(newOrderId, companyId);

        emitRestaurant(companyId, 'restaurant:order_updated', { orderId: id, order: updatedOriginal });
        emitRestaurant(companyId, 'restaurant:new_order', {
            orderId: newOrderId,
            table_number: updatedOriginal?.table_number,
            order: newOrderDetails
        });

        res.json({
            success: true,
            message: 'Comanda dividida exitosamente',
            data: {
                originalOrder: updatedOriginal,
                newOrder: newOrderDetails
            }
        });
    } catch (err) {
        await conn.rollback();
        console.error('Error in splitOrder:', err);
        res.status(500).json({ success: false, message: 'Error interno al dividir comanda' });
    } finally {
        conn.release();
    }
}

module.exports = {
    splitOrder
};
