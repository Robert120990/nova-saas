const pool = require('../../config/db');
const { emitRestaurant, recalculateOrderTotals } = require('../../services/restaurant.service');

// ÁREAS
async function getAreas(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;

        let query = "SELECT * FROM restaurant_areas WHERE company_id = ? AND is_active = 1";
        const params = [companyId];

        if (branchId) {
            query += " AND (branch_id = ? OR branch_id IS NULL)";
            params.push(branchId);
        }

        query += " ORDER BY order_index ASC, id ASC";

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getAreas:', err);
        res.status(500).json({ success: false, message: 'Error al obtener áreas' });
    }
}

async function createArea(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.body?.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const { name, order_index = 0 } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre del área es requerido' });
        }

        const [result] = await pool.query(
            "INSERT INTO restaurant_areas (company_id, branch_id, name, order_index) VALUES (?, ?, ?, ?)",
            [companyId, branchId, name.trim(), order_index]
        );

        res.status(201).json({ success: true, message: 'Área creada', data: { id: result.insertId, name: name.trim() } });
    } catch (err) {
        console.error('Error in createArea:', err);
        res.status(500).json({ success: false, message: 'Error al crear área' });
    }
}

async function updateArea(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { name, order_index, is_active } = req.body;

        await pool.query(
            "UPDATE restaurant_areas SET name = COALESCE(?, name), order_index = COALESCE(?, order_index), is_active = COALESCE(?, is_active) WHERE id = ? AND company_id = ?",
            [name?.trim(), order_index, is_active, id, companyId]
        );

        res.json({ success: true, message: 'Área actualizada' });
    } catch (err) {
        console.error('Error in updateArea:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar área' });
    }
}

async function deleteArea(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;

        // Verificar si tiene mesas activas
        const [tables] = await pool.query("SELECT id FROM restaurant_tables WHERE area_id = ? AND is_active = 1", [id]);
        if (tables.length > 0) {
            return res.status(400).json({ success: false, message: 'No se puede eliminar el área porque contiene mesas asociadas' });
        }

        await pool.query("UPDATE restaurant_areas SET is_active = 0 WHERE id = ? AND company_id = ?", [id, companyId]);
        res.json({ success: true, message: 'Área eliminada' });
    } catch (err) {
        console.error('Error in deleteArea:', err);
        res.status(500).json({ success: false, message: 'Error al eliminar área' });
    }
}

// MESAS
async function getTables(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const { area_id } = req.query;

        let query = `
            SELECT rt.*, ra.name as area_name,
                   MAX(ro.id) as active_order_id, MAX(ro.status) as active_order_status,
                   COALESCE(SUM(ro.subtotal), 0) as active_subtotal,
                   MIN(ro.opened_at) as order_opened_at, MAX(u.nombre) as waiter_name,
                   COUNT(DISTINCT ro.id) as active_orders_count,
                   COALESCE((SELECT COUNT(*) FROM restaurant_order_items roi JOIN restaurant_orders ro2 ON roi.order_id = ro2.id WHERE ro2.table_id = rt.id AND ro2.status IN ('abierta', 'en_cocina', 'lista') AND roi.status != 'cancelado'), 0) as active_items_count
            FROM restaurant_tables rt
            LEFT JOIN restaurant_areas ra ON rt.area_id = ra.id
            LEFT JOIN restaurant_orders ro ON rt.id = ro.table_id AND ro.status IN ('abierta', 'en_cocina', 'lista')
            LEFT JOIN users u ON ro.waiter_id = u.id
            WHERE rt.company_id = ? AND rt.is_active = 1
        `;
        const params = [companyId];

        if (branchId) {
            query += " AND (rt.branch_id = ? OR rt.branch_id IS NULL)";
            params.push(branchId);
        }

        if (area_id) {
            query += " AND rt.area_id = ?";
            params.push(area_id);
        }

        query += " GROUP BY rt.id, ra.name, ra.order_index ORDER BY ra.order_index ASC, rt.table_number ASC";

        const [rows] = await pool.query(query, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getTables:', err);
        res.status(500).json({ success: false, message: 'Error al obtener mesas' });
    }
}

async function createTable(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.body?.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const { area_id, table_number, capacity = 4 } = req.body;

        if (!table_number || !table_number.trim()) {
            return res.status(400).json({ success: false, message: 'El identificador de la mesa es requerido' });
        }

        const [result] = await pool.query(
            "INSERT INTO restaurant_tables (company_id, branch_id, area_id, table_number, capacity, status) VALUES (?, ?, ?, ?, ?, 'disponible')",
            [companyId, branchId, area_id || null, table_number.trim(), capacity]
        );

        res.status(201).json({ success: true, message: 'Mesa creada', data: { id: result.insertId, table_number: table_number.trim() } });
    } catch (err) {
        console.error('Error in createTable:', err);
        res.status(500).json({ success: false, message: 'Error al crear mesa' });
    }
}

async function updateTable(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { area_id, table_number, capacity, status, is_active } = req.body;

        await pool.query(
            "UPDATE restaurant_tables SET area_id = COALESCE(?, area_id), table_number = COALESCE(?, table_number), capacity = COALESCE(?, capacity), status = COALESCE(?, status), is_active = COALESCE(?, is_active) WHERE id = ? AND company_id = ?",
            [area_id, table_number?.trim(), capacity, status, is_active, id, companyId]
        );

        if (status) {
            emitRestaurant(companyId, 'restaurant:table_status', { table_id: id, status });
        }

        res.json({ success: true, message: 'Mesa actualizada' });
    } catch (err) {
        console.error('Error in updateTable:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar mesa' });
    }
}

async function deleteTable(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;

        // Verificar si la mesa tiene orden activa
        const [orders] = await pool.query(
            "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('abierta', 'en_cocina', 'lista')",
            [id]
        );
        if (orders.length > 0) {
            return res.status(400).json({ success: false, message: 'No se puede eliminar la mesa porque tiene una comanda activa' });
        }

        await pool.query("UPDATE restaurant_tables SET is_active = 0 WHERE id = ? AND company_id = ?", [id, companyId]);
        res.json({ success: true, message: 'Mesa eliminada' });
    } catch (err) {
        console.error('Error in deleteTable:', err);
        res.status(500).json({ success: false, message: 'Error al eliminar mesa' });
    }
}

// CAMBIO Y UNIÓN DE MESAS
async function transferTable(req, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.companyId;
        const { source_table_id, target_table_id } = req.body;

        if (!source_table_id || !target_table_id || source_table_id === target_table_id) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Mesas de origen y destino inválidas' });
        }

        // Obtener comanda activa de la mesa origen
        const [sourceOrders] = await conn.query(
            "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('abierta', 'en_cocina', 'lista') LIMIT 1",
            [source_table_id]
        );
        if (sourceOrders.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'La mesa origen no tiene comanda activa' });
        }

        // Verificar que la mesa destino esté disponible
        const [targetOrders] = await conn.query(
            "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('abierta', 'en_cocina', 'lista') LIMIT 1",
            [target_table_id]
        );
        if (targetOrders.length > 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'La mesa destino ya está ocupada. Utilice unión de mesas.' });
        }

        const orderId = sourceOrders[0].id;

        // Mover comanda
        await conn.query("UPDATE restaurant_orders SET table_id = ? WHERE id = ?", [target_table_id, orderId]);
        // Liberar mesa origen y ocupar mesa destino
        await conn.query("UPDATE restaurant_tables SET status = 'disponible' WHERE id = ?", [source_table_id]);
        await conn.query("UPDATE restaurant_tables SET status = 'ocupada' WHERE id = ?", [target_table_id]);

        await conn.commit();

        emitRestaurant(companyId, 'restaurant:table_status', { table_id: source_table_id, status: 'disponible' });
        emitRestaurant(companyId, 'restaurant:table_status', { table_id: target_table_id, status: 'ocupada' });
        emitRestaurant(companyId, 'restaurant:table_transferred', { orderId, fromTable: source_table_id, toTable: target_table_id });

        res.json({ success: true, message: 'Comanda transferida exitosamente a la nueva mesa' });
    } catch (err) {
        await conn.rollback();
        console.error('Error in transferTable:', err);
        res.status(500).json({ success: false, message: 'Error al transferir comanda' });
    } finally {
        conn.release();
    }
}

async function mergeTables(req, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const companyId = req.company_id || req.companyId;
        const { main_table_id, secondary_table_id } = req.body;

        if (!main_table_id || !secondary_table_id || main_table_id === secondary_table_id) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Mesas a unir inválidas' });
        }

        const [mainOrders] = await conn.query(
            "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('abierta', 'en_cocina', 'lista') LIMIT 1",
            [main_table_id]
        );
        const [secondaryOrders] = await conn.query(
            "SELECT id FROM restaurant_orders WHERE table_id = ? AND status IN ('abierta', 'en_cocina', 'lista') LIMIT 1",
            [secondary_table_id]
        );

        if (mainOrders.length === 0 || secondaryOrders.length === 0) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: 'Ambas mesas deben tener comandas activas para unirse' });
        }

        const mainOrderId = mainOrders[0].id;
        const secondaryOrderId = secondaryOrders[0].id;

        // Mover todos los ítems de la secundaria a la principal
        await conn.query("UPDATE restaurant_order_items SET order_id = ? WHERE order_id = ?", [mainOrderId, secondaryOrderId]);
        // Cancelar orden secundaria por unión
        await conn.query("UPDATE restaurant_orders SET status = 'cancelada', notes = CONCAT(COALESCE(notes, ''), ' [Unida con orden #', ?) WHERE id = ?", [mainOrderId, secondaryOrderId]);
        // Liberar mesa secundaria
        await conn.query("UPDATE restaurant_tables SET status = 'disponible' WHERE id = ?", [secondary_table_id]);

        await conn.commit();

        await recalculateOrderTotals(mainOrderId);

        emitRestaurant(companyId, 'restaurant:table_status', { table_id: secondary_table_id, status: 'disponible' });
        emitRestaurant(companyId, 'restaurant:table_merged', { mainOrderId, mergedTableId: secondary_table_id });

        res.json({ success: true, message: 'Mesas unidas exitosamente en la comanda principal' });
    } catch (err) {
        await conn.rollback();
        console.error('Error in mergeTables:', err);
        res.status(500).json({ success: false, message: 'Error al unir mesas' });
    } finally {
        conn.release();
    }
}

module.exports = {
    getAreas,
    createArea,
    updateArea,
    deleteArea,
    getTables,
    createTable,
    updateTable,
    deleteTable,
    transferTable,
    mergeTables
};
