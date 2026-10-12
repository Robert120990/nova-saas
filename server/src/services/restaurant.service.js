const pool = require('../config/db');
const { broadcastToCompany } = require('./websocket.service');

/**
 * Restaurant Service
 * Handles business logic, totals calculation, tips, and real-time WebSocket dispatch
 */

function emitRestaurant(companyId, event, data) {
    try {
        if (companyId) {
            broadcastToCompany(companyId, event, data);
        }
    } catch (err) {
        console.error('Error broadcasting restaurant WebSocket event:', err);
    }
}

async function recalculateOrderTotals(orderId, connection = null) {
    const db = connection || pool;
    const [items] = await db.query(
        "SELECT quantity, unit_price, status, discount_type, discount_value, discount_amount FROM restaurant_order_items WHERE order_id = ? AND status != 'cancelado'",
        [orderId]
    );

    let grossSubtotal = 0;
    let itemsDiscountTotal = 0;

    for (const item of items) {
        const itemGross = Number(item.quantity) * Number(item.unit_price);
        grossSubtotal += itemGross;
        itemsDiscountTotal += Number(item.discount_amount || 0);
    }

    const itemsNet = Math.max(0, grossSubtotal - itemsDiscountTotal);

    const [orders] = await db.query(
        "SELECT tip_percentage, discount_type, discount_value, company_id, branch_id FROM restaurant_orders WHERE id = ?",
        [orderId]
    );
    if (orders.length === 0) return { subtotal: 0, tipAmount: 0, totalWithTip: 0 };

    const order = orders[0];
    const tipPercentage = Number(order.tip_percentage || 0);

    let orderDiscount = 0;
    const discType = order.discount_type || 'none';
    const discVal = Number(order.discount_value || 0);

    if (discType === 'percentage') {
        orderDiscount = Number(((itemsNet * discVal) / 100).toFixed(2));
    } else if (discType === 'amount') {
        orderDiscount = Math.min(discVal, itemsNet);
    } else if (discType === 'courtesy') {
        orderDiscount = itemsNet;
    }

    const totalDiscount = Number((itemsDiscountTotal + orderDiscount).toFixed(2));
    const netSubtotal = Math.max(0, Number((itemsNet - orderDiscount).toFixed(2)));
    const tipAmount = Number(((netSubtotal * tipPercentage) / 100).toFixed(2));
    const totalWithTip = Number((netSubtotal + tipAmount).toFixed(2));

    await db.query(
        "UPDATE restaurant_orders SET subtotal = ?, discount_amount = ?, tip_amount = ?, total_with_tip = ? WHERE id = ?",
        [grossSubtotal.toFixed(2), totalDiscount.toFixed(2), tipAmount.toFixed(2), totalWithTip.toFixed(2), orderId]
    );

    return {
        subtotal: grossSubtotal,
        discountAmount: orderDiscount,
        totalDiscount,
        netSubtotal,
        tipPercentage,
        tipAmount,
        totalWithTip,
        companyId: order.company_id,
        branchId: order.branch_id
    };
}

async function getRestaurantConfig(companyId, branchId = null) {
    let query = "SELECT * FROM restaurant_config WHERE company_id = ?";
    const params = [companyId];
    if (branchId) {
        query += " AND (branch_id = ? OR branch_id IS NULL) ORDER BY (branch_id IS NOT NULL) DESC, id DESC LIMIT 1";
        params.push(branchId);
    } else {
        query += " AND branch_id IS NULL ORDER BY id DESC LIMIT 1";
    }

    const [rows] = await pool.query(query, params);
    if (rows.length > 0) {
        return {
            ...rows[0],
            allowed_categories: safeParseModifiers(rows[0].allowed_categories)
        };
    }

    return {
        enable_tips: 1,
        default_tip_percentage: 10.00,
        tip_is_optional: 1,
        kds_warning_minutes: 10,
        kds_danger_minutes: 18,
        auto_print_comanda: 0,
        allowed_categories: []
    };
}

function safeParseModifiers(val) {
    if (!val) return [];
    if (typeof val !== 'string') return val;
    try {
        return JSON.parse(val);
    } catch {
        return [];
    }
}

async function getActiveOrderDetails(orderId, companyId) {
    const [orders] = await pool.query(`
        SELECT ro.*, rt.table_number, ra.name as area_name, u.nombre as waiter_name
        FROM restaurant_orders ro
        LEFT JOIN restaurant_tables rt ON ro.table_id = rt.id
        LEFT JOIN restaurant_areas ra ON rt.area_id = ra.id
        LEFT JOIN users u ON ro.waiter_id = u.id
        WHERE ro.id = ? AND ro.company_id = ?
    `, [orderId, companyId]);

    if (orders.length === 0) return null;
    const order = orders[0];

    const [items] = await pool.query(`
        SELECT roi.*, COALESCE(p.nombre, 'Producto') as product_name, p.codigo as sku, rs.name as station_name
        FROM restaurant_order_items roi
        LEFT JOIN products p ON roi.product_id = p.id
        LEFT JOIN restaurant_stations rs ON roi.station_id = rs.id
        WHERE roi.order_id = ?
        ORDER BY roi.id ASC
    `, [orderId]);

    order.items = items.map(i => ({
        ...i,
        selected_modifiers: safeParseModifiers(i.selected_modifiers)
    }));

    return order;
}

async function resolveStationsForOrderItems(companyId, branchId, items, connection = null) {
    if (!Array.isArray(items) || items.length === 0) return items;

    const db = connection || pool;
    const productIds = Array.from(new Set(items.map(i => i.product_id).filter(Boolean)));
    if (productIds.length === 0) return items;

    const [products] = await db.query(
        "SELECT id, category_id FROM products WHERE id IN (?)",
        [productIds]
    );
    const prodCatMap = new Map(products.map(p => [p.id, p.category_id]));

    let stationQuery = "SELECT id, category_ids FROM restaurant_stations WHERE company_id = ? AND is_active = 1";
    const stationParams = [companyId];
    if (branchId) {
        stationQuery += " AND (branch_id = ? OR branch_id IS NULL)";
        stationParams.push(branchId);
    }
    const [stations] = await db.query(stationQuery, stationParams);

    const catToStation = new Map();
    for (const st of stations) {
        let cats = st.category_ids;
        if (typeof cats === 'string') {
            try { cats = JSON.parse(cats); } catch { cats = []; }
        }
        if (Array.isArray(cats)) {
            for (const catId of cats) {
                catToStation.set(Number(catId), st.id);
            }
        }
    }

    return items.map(item => {
        let assignedStationId = item.station_id || null;
        if (!assignedStationId) {
            const catId = prodCatMap.get(Number(item.product_id));
            if (catId && catToStation.has(Number(catId))) {
                assignedStationId = catToStation.get(Number(catId));
            } else if (stations.length === 1) {
                assignedStationId = stations[0].id;
            }
        }
        return {
            ...item,
            station_id: assignedStationId
        };
    });
}

module.exports = {
    emitRestaurant,
    recalculateOrderTotals,
    getRestaurantConfig,
    getActiveOrderDetails,
    resolveStationsForOrderItems
};
