const { pool } = require('./shared');

const deleteDispatchRoute = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        // 1. Obtener órdenes asociadas a la ruta (directamente o por paradas)
        const [associatedStops] = await connection.query(
            `SELECT s.id as stop_id, s.order_id, s.sale_id, s.dte_codigo_generacion,
                    o.status as order_status, o.delivery_status as order_delivery_status
             FROM egg_dispatch_stops s
             LEFT JOIN egg_customer_orders o ON s.order_id = o.id
             WHERE s.dispatch_route_id = ?`,
            [id]
        );

        // 2. Liberar pedidos no facturados: volver a estado 'pendiente' y delivery_status 'pendiente'
        // Esto evita que queden en el limbo con status 'en_proceso'
        await connection.query(
            `UPDATE egg_customer_orders
             SET dispatch_route_id = NULL, delivery_status = 'pendiente', status = 'pendiente'
             WHERE (dispatch_route_id = ? OR id IN (SELECT order_id FROM egg_dispatch_stops WHERE dispatch_route_id = ?))
               AND company_id = ?
               AND (sale_id IS NULL AND (dte_codigo_generacion IS NULL OR dte_codigo_generacion = ''))`,
            [id, id, company_id]
        );

        // 3. Para pedidos que ya estaban facturados en esta ruta: desvincular de la ruta pero preservar venta y estado
        await connection.query(
            `UPDATE egg_customer_orders
             SET dispatch_route_id = NULL
             WHERE (dispatch_route_id = ? OR id IN (SELECT order_id FROM egg_dispatch_stops WHERE dispatch_route_id = ?))
               AND company_id = ?
               AND (sale_id IS NOT NULL OR (dte_codigo_generacion IS NOT NULL AND dte_codigo_generacion != ''))`,
            [id, id, company_id]
        );

        // 4. Eliminar paradas de la ruta explícitamente para evitar bloqueos por Foreign Key
        await connection.query('DELETE FROM egg_dispatch_stops WHERE dispatch_route_id = ?', [id]);

        // 5. Liberar camión si estaba en ruta
        const [rRows] = await connection.query(
            'SELECT vehicle_id FROM egg_dispatch_routes WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (rRows.length > 0 && rRows[0].vehicle_id) {
            await connection.query(
                'UPDATE delivery_vehicles SET estado = "disponible" WHERE id = ? AND estado = "en_ruta"',
                [rRows[0].vehicle_id]
            );
        }

        // 6. Eliminar la ruta de despacho
        await connection.query('DELETE FROM egg_dispatch_routes WHERE id = ? AND company_id = ?', [id, company_id]);

        await connection.commit();
        res.json({ message: 'Ruta de despacho eliminada y pedidos liberados correctamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al eliminar ruta de despacho:', error);
        res.status(500).json({ message: error.message || 'Error al eliminar ruta de despacho' });
    } finally {
        connection.release();
    }
};

const reorderRouteStops = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { stops } = req.body; // Array de { id: stop_id, orden_visita: N }

        if (!Array.isArray(stops)) {
            await connection.rollback();
            return res.status(400).json({ message: 'La lista de paradas a reordenar es inválida.' });
        }

        for (const s of stops) {
            await connection.query(
                'UPDATE egg_dispatch_stops SET orden_visita = ? WHERE id = ? AND dispatch_route_id = ?',
                [s.orden_visita, s.id, id]
            );
        }

        await connection.commit();
        res.json({ message: 'Secuencia de paradas actualizada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al reordenar paradas:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const optimizeRouteStops = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        const [stops] = await connection.query(
            `SELECT s.id, s.prioridad, cb.latitude, cb.longitude, cb.departamento, cb.municipio
             FROM egg_dispatch_stops s
             JOIN egg_dispatch_routes r ON s.dispatch_route_id = r.id
             LEFT JOIN customer_branches cb ON s.customer_branch_id = cb.id
             WHERE s.dispatch_route_id = ? AND r.company_id = ?
             ORDER BY s.id ASC`,
            [id, company_id]
        );

        if (stops.length <= 1) {
            await connection.rollback();
            return res.json({ message: 'No hay suficientes paradas para optimizar.' });
        }

        // Ordenamiento por prioridad primero, luego cercanía geográfica
        const priorityWeight = { urgente: 1, alta: 2, normal: 3 };

        // Coordenadas base de planta (ej. San Salvador centro aprox 13.6929, -89.2182 si no hay)
        let currentLat = 13.6929;
        let currentLng = -89.2182;

        const unvisited = [...stops];
        const sorted = [];

        // Función de distancia simple (Haversine o euclidiana)
        const calcDist = (lat1, lon1, lat2, lon2) => {
            if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // Agrupar por prioridad
        ['urgente', 'alta', 'normal'].forEach(prio => {
            const group = unvisited.filter(s => (s.prioridad || 'normal') === prio);
            // Ordenar el grupo por el vecino más cercano
            while (group.length > 0) {
                let bestIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < group.length; i++) {
                    const d = calcDist(currentLat, currentLng, group[i].latitude, group[i].longitude);
                    if (d < minDist) {
                        minDist = d;
                        bestIdx = i;
                    }
                }
                const chosen = group.splice(bestIdx, 1)[0];
                sorted.push(chosen);
                if (chosen.latitude && chosen.longitude) {
                    currentLat = parseFloat(chosen.latitude);
                    currentLng = parseFloat(chosen.longitude);
                }
            }
        });

        // Aplicar nuevo orden_visita en BD
        for (let i = 0; i < sorted.length; i++) {
            await connection.query(
                'UPDATE egg_dispatch_stops SET orden_visita = ? WHERE id = ?',
                [i + 1, sorted[i].id]
            );
        }

        await connection.commit();
        res.json({ message: 'Ruta optimizada con éxito según prioridad y cercanía geográfica.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al optimizar paradas:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const getMyDriverRoutes = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const userId = req.user?.id;
        const { fecha } = req.query;
        const targetDate = fecha || new Date().toISOString().split('T')[0];

        // Obtener rutas donde el usuario es el driver_id asignado, o todas las rutas de la fecha si tiene rol supervisor/admin
        let sql = `
            SELECT r.*,
                   v.codigo AS vehicle_codigo,
                   v.placa AS vehicle_placa,
                   v.tiene_termo_king,
                   (SELECT COUNT(*) FROM egg_dispatch_stops s WHERE s.dispatch_route_id = r.id) AS total_stops,
                   (SELECT COUNT(*) FROM egg_dispatch_stops s WHERE s.dispatch_route_id = r.id AND s.estado_entrega = 'entregado') AS completed_stops
            FROM egg_dispatch_routes r
            LEFT JOIN delivery_vehicles v ON r.vehicle_id = v.id
            WHERE r.company_id = ? AND r.fecha_despacho = ?
        `;
        const params = [company_id, targetDate];

        // Si no es rol admin/supervisor, filtrar solo sus rutas asignadas
        const isSupervisor = ['Admin', 'SuperAdmin', 'Gerencia', 'Operaciones'].includes(req.user?.role_name);
        if (!isSupervisor && userId) {
            sql += ' AND (r.driver_id = ? OR r.driver_name LIKE ?)';
            params.push(userId, `%${req.user?.nombre || ''}%`);
        }

        sql += ' ORDER BY r.hora_salida_estimada ASC, r.id DESC';

        const [routes] = await pool.query(sql, params);
        res.json(routes);
    } catch (error) {
        console.error('Error al obtener rutas del motorista:', error);
        res.status(500).json({ message: error.message });
    }
};

const searchDteOrActiveOrders = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { query } = req.query;

        if (!query || query.trim().length < 2) {
            return res.json({ dtes: [], orders: [] });
        }

        const cleanQuery = query.trim();

        // 1. Buscar en DTEs (código de generación, número de control o sello)
        const [dtes] = await pool.query(
            `SELECT d.id, d.codigo_generacion, d.numero_control, d.tipo_dte, d.status,
                    d.sello_recepcion, d.fh_procesamiento,
                    s.cliente_id, s.total, s.created_at
             FROM dtes d
             LEFT JOIN sales_headers s ON d.venta_id = s.id
             WHERE d.company_id = ?
               AND (d.codigo_generacion LIKE ? OR d.numero_control LIKE ? OR d.sello_recepcion LIKE ?)
             LIMIT 10`,
            [company_id, `%${cleanQuery}%`, `%${cleanQuery}%`, `%${cleanQuery}%`]
        );

        // 2. Buscar en pedidos de clientes activos
        const [orders] = await pool.query(
            `SELECT o.id, o.order_number, o.customer_name, o.product_type, o.quantity_lbs,
                    o.delivery_status, o.required_delivery_date, o.customer_id, o.customer_branch_id
             FROM egg_customer_orders o
             WHERE o.company_id = ?
               AND o.delivery_status != 'entregado'
               AND (o.order_number LIKE ? OR o.customer_name LIKE ? OR o.product_type LIKE ?)
             LIMIT 10`,
            [company_id, `%${cleanQuery}%`, `%${cleanQuery}%`, `%${cleanQuery}%`]
        );

        res.json({ dtes, orders });
    } catch (error) {
        console.error('Error al buscar DTE u órdenes activas:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { deleteDispatchRoute, reorderRouteStops, optimizeRouteStops, getMyDriverRoutes, searchDteOrActiveOrders };
