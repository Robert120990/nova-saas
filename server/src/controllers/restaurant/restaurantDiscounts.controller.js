const pool = require('../../config/db');
const { emitRestaurant, recalculateOrderTotals, getActiveOrderDetails } = require('../../services/restaurant.service');

/**
 * Restaurant Discounts & Courtesies Controller
 * Manages order-level and item-level discounts, percentage, fixed amount, and 100% courtesy comps
 */

async function applyOrderDiscount(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const userId = req.user?.id || null;
        const { discount_type = 'none', discount_value = 0, discount_reason } = req.body;

        const validTypes = ['none', 'percentage', 'amount', 'courtesy'];
        if (!validTypes.includes(discount_type)) {
            return res.status(400).json({ success: false, message: 'Tipo de descuento no válido' });
        }

        if (discount_type !== 'none' && (!discount_reason || !discount_reason.trim())) {
            return res.status(400).json({ success: false, message: 'El motivo del descuento o cortesía es obligatorio' });
        }

        const [orders] = await pool.query(
            "SELECT id, status FROM restaurant_orders WHERE id = ? AND company_id = ? AND status IN ('abierta', 'en_cocina', 'lista')",
            [id, companyId]
        );

        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Comanda no encontrada o ya finalizada' });
        }

        let numValue = Number(discount_value || 0);
        if (discount_type === 'courtesy') {
            numValue = 100;
        } else if (discount_type === 'percentage') {
            if (numValue < 0 || numValue > 100) {
                return res.status(400).json({ success: false, message: 'El porcentaje debe estar entre 0 y 100' });
            }
        } else if (discount_type === 'amount') {
            if (numValue < 0) {
                return res.status(400).json({ success: false, message: 'El monto de descuento debe ser mayor o igual a 0' });
            }
        } else {
            numValue = 0;
        }

        await pool.query(`
            UPDATE restaurant_orders
            SET discount_type = ?, discount_value = ?, discount_reason = ?, discount_by = ?
            WHERE id = ? AND company_id = ?
        `, [
            discount_type,
            numValue,
            discount_type !== 'none' ? discount_reason.trim() : null,
            discount_type !== 'none' ? userId : null,
            id,
            companyId
        ]);

        await recalculateOrderTotals(id);
        const updatedOrder = await getActiveOrderDetails(id, companyId);

        emitRestaurant(companyId, 'restaurant:order_updated', { orderId: id, order: updatedOrder });

        res.json({
            success: true,
            message: discount_type === 'none' ? 'Descuento removido' : 'Descuento aplicado a la comanda',
            data: updatedOrder
        });
    } catch (err) {
        console.error('Error in applyOrderDiscount:', err);
        res.status(500).json({ success: false, message: 'Error interno al aplicar descuento a comanda' });
    }
}

async function applyItemDiscount(req, res) {
    try {
        const { id, itemId } = req.params;
        const companyId = req.company_id || req.companyId;
        const userId = req.user?.id || null;
        const { discount_type = 'none', discount_value = 0, discount_reason } = req.body;

        const validTypes = ['none', 'percentage', 'amount', 'courtesy'];
        if (!validTypes.includes(discount_type)) {
            return res.status(400).json({ success: false, message: 'Tipo de descuento no válido' });
        }

        if (discount_type !== 'none' && (!discount_reason || !discount_reason.trim())) {
            return res.status(400).json({ success: false, message: 'El motivo del descuento o cortesía es obligatorio' });
        }

        const [items] = await pool.query(
            "SELECT * FROM restaurant_order_items WHERE id = ? AND order_id = ? AND status != 'cancelado'",
            [itemId, id]
        );

        if (items.length === 0) {
            return res.status(404).json({ success: false, message: 'Platillo no encontrado o anulado' });
        }

        const item = items[0];
        const itemGross = Number(item.quantity) * Number(item.unit_price);
        let numValue = Number(discount_value || 0);
        let computedDiscount = 0;

        if (discount_type === 'courtesy') {
            numValue = 100;
            computedDiscount = itemGross;
        } else if (discount_type === 'percentage') {
            if (numValue < 0 || numValue > 100) {
                return res.status(400).json({ success: false, message: 'El porcentaje debe estar entre 0 y 100' });
            }
            computedDiscount = Number(((itemGross * numValue) / 100).toFixed(2));
        } else if (discount_type === 'amount') {
            if (numValue < 0) {
                return res.status(400).json({ success: false, message: 'El monto de descuento debe ser mayor o igual a 0' });
            }
            computedDiscount = Math.min(numValue, itemGross);
        } else {
            numValue = 0;
            computedDiscount = 0;
        }

        await pool.query(`
            UPDATE restaurant_order_items
            SET discount_type = ?, discount_value = ?, discount_amount = ?, discount_reason = ?, discount_by = ?
            WHERE id = ? AND order_id = ?
        `, [
            discount_type,
            numValue,
            computedDiscount,
            discount_type !== 'none' ? discount_reason.trim() : null,
            discount_type !== 'none' ? userId : null,
            itemId,
            id
        ]);

        await recalculateOrderTotals(id);
        const updatedOrder = await getActiveOrderDetails(id, companyId);

        emitRestaurant(companyId, 'restaurant:order_updated', { orderId: id, order: updatedOrder });

        res.json({
            success: true,
            message: discount_type === 'none' ? 'Descuento removido del platillo' : 'Descuento aplicado al platillo',
            data: updatedOrder
        });
    } catch (err) {
        console.error('Error in applyItemDiscount:', err);
        res.status(500).json({ success: false, message: 'Error interno al aplicar descuento a platillo' });
    }
}

module.exports = {
    applyOrderDiscount,
    applyItemDiscount
};
