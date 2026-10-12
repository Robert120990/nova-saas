const pool = require('../../config/db');

/**
 * Restaurant Waiters & Shift Summary Controller
 * Manages waiter shift closeout, sales totals, tip reconciliations, and courtesies summary
 */

async function getWaitersList(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || null;

        let query = `
            SELECT DISTINCT u.id, u.nombre as name, u.email, ue.role_id, r.name as role_name
            FROM users u
            INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id AND ue.empresa_id = ? AND ue.has_access = 1
            LEFT JOIN roles r ON ue.role_id = r.id
            LEFT JOIN usuario_sucursal us ON u.id = us.usuario_id
            WHERE u.status = 'activo'
        `;
        const params = [companyId];

        if (branchId) {
            query += " AND (us.sucursal_id = ? OR r.name IN ('SuperAdmin', 'Admin') OR ue.role_id = 1)";
            params.push(branchId);
        }

        query += " ORDER BY u.nombre ASC";

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getWaitersList:', err);
        res.status(500).json({ success: false, message: 'Error al obtener lista de meseros' });
    }
}

async function getWaiterShiftSummary(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || null;
        const currentUserId = req.user?.id;
        const waiterId = req.query.waiter_id ? Number(req.query.waiter_id) : currentUserId;
        const dateParam = req.query.date || new Date().toISOString().slice(0, 10);

        // Obtener datos del mesero
        const [waiterRows] = await pool.query("SELECT id, nombre as name, email FROM users WHERE id = ?", [waiterId]);
        const waiter = waiterRows[0] || { id: waiterId, name: 'Mesero' };

        // Rango del día
        const startDate = `${dateParam} 00:00:00`;
        const endDate = `${dateParam} 23:59:59`;

        let ordersQuery = `
            SELECT ro.id, ro.table_id, ro.order_type, ro.customer_name, ro.status,
                   ro.guest_count, ro.subtotal, ro.discount_type, ro.discount_value,
                   ro.discount_reason, ro.tip_percentage, ro.tip_amount,
                   ro.total_with_tip, ro.opened_at, ro.closed_at,
                   rt.table_number, ra.name as area_name,
                   GREATEST(
                       COALESCE(ro.discount_amount, 0),
                       (SELECT COALESCE(SUM(discount_amount), 0) FROM restaurant_order_items WHERE order_id = ro.id AND status != 'cancelado')
                   ) as discount_amount,
                   (SELECT COUNT(*) FROM restaurant_order_items WHERE order_id = ro.id AND status != 'cancelado') as total_items,
                   (SELECT COUNT(*) FROM restaurant_order_items WHERE order_id = ro.id AND status = 'cancelado') as cancelled_items
            FROM restaurant_orders ro
            LEFT JOIN restaurant_tables rt ON ro.table_id = rt.id
            LEFT JOIN restaurant_areas ra ON rt.area_id = ra.id
            WHERE ro.company_id = ? AND ro.waiter_id = ?
              AND ro.opened_at BETWEEN ? AND ?
        `;
        const orderParams = [companyId, waiterId, startDate, endDate];

        if (branchId) {
            ordersQuery += " AND (ro.branch_id = ? OR ro.branch_id IS NULL)";
            orderParams.push(branchId);
        }

        ordersQuery += " ORDER BY ro.opened_at DESC";

        const [orders] = await pool.query(ordersQuery, orderParams);

        // Métricas agregadas
        let totalOrders = orders.length;
        let closedOrders = 0;
        let openOrders = 0;
        let cancelledOrders = 0;
        let grossSales = 0;
        let totalDiscounts = 0;
        let netSales = 0;
        let totalTips = 0;
        let pendingTips = 0;
        let totalGuests = 0;
        let itemsServed = 0;
        let itemsCancelled = 0;

        orders.forEach(ord => {
            const sub = Number(ord.subtotal || 0);
            const disc = Number(ord.discount_amount || 0);
            const tip = Number(ord.tip_amount || 0);
            totalGuests += Number(ord.guest_count || 1);
            itemsServed += Number(ord.total_items || 0);
            itemsCancelled += Number(ord.cancelled_items || 0);

            if (ord.status === 'facturada') {
                closedOrders++;
                grossSales += sub;
                totalDiscounts += disc;
                netSales += Math.max(0, sub - disc);
                totalTips += tip;
            } else if (ord.status === 'cancelada') {
                cancelledOrders++;
            } else {
                openOrders++;
                pendingTips += tip;
            }
        });

        const totalCollected = Number((netSales + totalTips).toFixed(2));

        res.json({
            success: true,
            data: {
                waiter,
                date: dateParam,
                metrics: {
                    total_orders: totalOrders,
                    closed_orders: closedOrders,
                    open_orders: openOrders,
                    cancelled_orders: cancelledOrders,
                    total_guests: totalGuests,
                    items_served: itemsServed,
                    items_cancelled: itemsCancelled,
                    gross_sales: Number(grossSales.toFixed(2)),
                    total_discounts: Number(totalDiscounts.toFixed(2)),
                    net_sales: Number(netSales.toFixed(2)),
                    total_tips: Number(totalTips.toFixed(2)),
                    pending_tips: Number(pendingTips.toFixed(2)),
                    total_collected: totalCollected
                },
                orders
            }
        });
    } catch (err) {
        console.error('Error in getWaiterShiftSummary:', err);
        res.status(500).json({ success: false, message: 'Error interno al consultar resumen de turno' });
    }
}

module.exports = {
    getWaitersList,
    getWaiterShiftSummary
};
