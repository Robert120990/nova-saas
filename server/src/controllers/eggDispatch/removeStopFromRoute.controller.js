const { pool } = require('./shared');

const removeStopFromRoute = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id, stop_id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        // 1. Verificar que la parada pertenezca a la ruta y empresa
        const [stopRows] = await connection.query(
            `SELECT s.id, s.order_id, s.dispatch_route_id
             FROM egg_dispatch_stops s
             JOIN egg_dispatch_routes r ON s.dispatch_route_id = r.id
             WHERE s.id = ? AND s.dispatch_route_id = ? AND r.company_id = ?`,
            [stop_id, id, company_id]
        );

        if (stopRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Parada no encontrada en esta ruta.' });
        }

        const stop = stopRows[0];

        // 2. Liberar el pedido (vuelve a pendiente sin ruta)
        await connection.query(
            `UPDATE egg_customer_orders SET dispatch_route_id = NULL, delivery_status = 'pendiente', status = 'pendiente'
             WHERE id = ? AND company_id = ? AND sale_id IS NULL`,
            [stop.order_id, company_id]
        );

        // 3. Eliminar la parada
        await connection.query('DELETE FROM egg_dispatch_stops WHERE id = ?', [stop_id]);

        // 4. Reordenar paradas restantes
        const [remainingStops] = await connection.query(
            `SELECT s.id, o.quantity_lbs
             FROM egg_dispatch_stops s
             JOIN egg_customer_orders o ON s.order_id = o.id
             WHERE s.dispatch_route_id = ?
             ORDER BY s.orden_visita ASC, s.id ASC`,
            [id]
        );

        for (let i = 0; i < remainingStops.length; i++) {
            await connection.query(
                'UPDATE egg_dispatch_stops SET orden_visita = ? WHERE id = ?',
                [i + 1, remainingStops[i].id]
            );
        }

        // 5. Recalcular totales de carga de la ruta
        const totalPedidos = remainingStops.length;
        const totalPesoLbs = remainingStops.reduce((sum, r) => sum + (parseFloat(r.quantity_lbs) || 0), 0);
        const totalCubetas = remainingStops.reduce((sum, r) => sum + Math.ceil((parseFloat(r.quantity_lbs) || 0) / 30), 0);

        await connection.query(
            `UPDATE egg_dispatch_routes SET
                total_pedidos = ?,
                total_peso_lbs = ?,
                total_cubetas = ?
             WHERE id = ? AND company_id = ?`,
            [totalPedidos, totalPesoLbs, totalCubetas, id, company_id]
        );

        await connection.commit();
        res.json({
            message: 'Parada removida y pedido liberado correctamente.',
            total_pedidos: totalPedidos,
            total_peso_lbs: totalPesoLbs,
            total_cubetas: totalCubetas
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al remover parada de ruta:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};
module.exports = { removeStopFromRoute };
