const { pool, computeJulianLotCode } = require('./shared');
const convertLotToJulian = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        const [rows] = await pool.query(
            'SELECT id, production_date, lot_code FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Producción no encontrada.' });
        }

        const prod = rows[0];
        const newJulianLot = computeJulianLotCode(prod.production_date, 1);

        await pool.query(
            'UPDATE egg_scheduled_productions SET lot_code = ? WHERE id = ? AND company_id = ?',
            [newJulianLot, id, company_id]
        );

        res.json({
            success: true,
            id: prod.id,
            previous_lot: prod.lot_code,
            new_lot_code: newJulianLot,
            message: `Lote actualizado a formato juliano: ${newJulianLot}`
        });
    } catch (error) {
        console.error('Error al convertir lote a juliano:', error);
        res.status(500).json({ message: error.message });
    }
};

const getEggCustomerOrders = async (req, res) => {
    try {
        const { status, delivery_status, unassigned_only, fecha_desde, fecha_hasta } = req.query;
        const company_id = req.company_id || req.user?.company_id;
        let sql = `
            SELECT o.*,
                   c.nombre as customer_registered_name,
                   c.nombre_comercial as customer_commercial_name,
                   c.nit as customer_nit,
                   c.nrc as customer_nrc,
                   c.telefono as customer_phone,
                   cb.nombre as branch_name,
                   cb.direccion as branch_address,
                   cb.departamento as branch_departamento,
                   cb.municipio as branch_municipio,
                   cb.contacto_nombre as branch_contact_person,
                   cb.contacto_telefono as branch_contact_phone,
                   cb.latitude as branch_latitude,
                   cb.longitude as branch_longitude,
                   cb.indicaciones_entrega as branch_delivery_notes,
                   r.codigo_ruta,
                   r.driver_name as route_driver_name,
                   r.fecha_despacho as route_date,
                   r.estado as route_estado,
                   b.batch_code_display as linked_batch_code
            FROM egg_customer_orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN customer_branches cb ON o.customer_branch_id = cb.id
            LEFT JOIN egg_dispatch_routes r ON o.dispatch_route_id = r.id
            LEFT JOIN egg_production_batches b ON o.batch_id = b.id
            WHERE o.company_id = ?
        `;
        const params = [company_id];

        if (status) {
            sql += ' AND o.status = ?';
            params.push(status);
        }

        if (delivery_status) {
            sql += ' AND o.delivery_status = ?';
            params.push(delivery_status);
        }

        if (unassigned_only === 'true' || unassigned_only === '1') {
            sql += ' AND o.dispatch_route_id IS NULL AND o.delivery_status != "entregado"';
        }

        if (fecha_desde) {
            sql += ' AND o.required_delivery_date >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            sql += ' AND o.required_delivery_date <= ?';
            params.push(fecha_hasta);
        }

        sql += ' ORDER BY o.required_delivery_date ASC, o.created_at DESC';
        const [orders] = await pool.query(sql, params);
        res.json(orders);
    } catch (error) {
        console.error('Error al listar pedidos de ovoproductos:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { convertLotToJulian, getEggCustomerOrders };
