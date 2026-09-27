const { pool } = require('./shared');

const getDispatchRouteDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        const [routeRows] = await pool.query(
            `SELECT r.*,
                    v.codigo AS vehicle_codigo,
                    v.placa AS vehicle_placa,
                    v.marca AS vehicle_marca,
                    v.modelo AS vehicle_modelo,
                    v.capacidad_peso_lbs AS vehicle_capacidad_peso,
                    v.capacidad_cubetas AS vehicle_capacidad_cubetas,
                    v.tiene_termo_king,
                    v.odometro_actual,
                    v.estado AS vehicle_estado,
                    u.nombre AS driver_user_nombre,
                    u.username AS driver_username
             FROM egg_dispatch_routes r
             LEFT JOIN delivery_vehicles v ON r.vehicle_id = v.id
             LEFT JOIN users u ON r.driver_id = u.id
             WHERE r.id = ? AND r.company_id = ?`,
            [id, company_id]
        );

        if (routeRows.length === 0) {
            return res.status(404).json({ message: 'Ruta de despacho no encontrada.' });
        }

        const route = routeRows[0];

        // Obtener paradas con datos de pedido, cliente, sucursal, productos y lotes
        const [stops] = await pool.query(
            `SELECT s.*,
                    COALESCE(o.customer_id, s.customer_id) AS customer_id,
                    COALESCE(o.customer_branch_id, s.customer_branch_id) AS customer_branch_id,
                    COALESCE(o.batch_id, s.batch_id) AS batch_id,
                    COALESCE(o.lot_code, s.lot_code, b.batch_code_display) AS lot_code,
                    o.order_number,
                    o.product_type,
                    o.presentation,
                    o.quantity_lbs,
                    o.price_per_lb,
                    o.notes AS order_notes,
                    o.items_json,
                    o.batch_id AS order_batch_id,
                    o.lot_code AS order_lot_code,
                    o.required_delivery_date,
                    b.batch_code_display AS linked_batch_code,
                    COALESCE(o.lot_code, s.lot_code, b.batch_code_display) AS lot_code_display,
                    ROUND(o.quantity_lbs / 30.0, 0) AS calculated_buckets,
                    c.nombre AS customer_name,
                    c.nombre_comercial AS customer_commercial_name,
                    c.nit AS customer_nit,
                    c.nrc AS customer_nrc,
                    c.telefono AS customer_phone,
                    c.direccion AS customer_address,
                    c.es_credito AS customer_es_credito,
                    c.dias_credito AS customer_dias_credito,
                    0 AS customer_limite_credito,
                    c.condicion_fiscal AS customer_condicion_fiscal,
                    c.pais AS customer_pais,
                    c.codigo_actividad AS customer_codigo_actividad,
                    c.departamento AS customer_departamento,
                    c.municipio AS customer_municipio,
                    c.distrito AS customer_distrito,
                    cb.nombre AS branch_name,
                    cb.direccion AS branch_address,
                    cb.departamento AS branch_departamento,
                    cb.municipio AS branch_municipio,
                    cb.telefono AS branch_phone,
                    cb.contacto_nombre AS branch_contact_person,
                    cb.contacto_telefono AS branch_contact_phone,
                    cb.indicaciones_entrega AS branch_delivery_notes,
                    cb.latitude AS branch_latitude,
                    cb.longitude AS branch_longitude,
                    sh.id AS sale_id_linked,
                    sh.codigo_generacion AS sale_codigo_generacion,
                    sh.numero_control AS sale_numero_control,
                    sh.sello_recepcion AS sale_sello_recepcion,
                    sh.dte_type AS sale_dte_type,
                    sh.total_pagar AS sale_total_pagar,
                    sh.condicion_operacion AS sale_condicion_operacion,
                    sh.estado AS sale_estado,
                    d.status AS dte_status,
                    d.respuesta_hacienda AS dte_respuesta_hacienda,
                    (CASE
                        WHEN sh.sello_recepcion IS NOT NULL OR d.status = 'ACCEPTED' THEN 1
                        WHEN sh.estado = 'contingencia' AND (d.status IS NULL OR d.status != 'REJECTED') THEN 1
                        ELSE 0
                     END) AS is_billed,
                    (CASE
                        WHEN d.status = 'REJECTED' OR (sh.id IS NOT NULL AND sh.sello_recepcion IS NULL AND (d.status = 'REJECTED' OR sh.estado = 'rechazado')) THEN 1
                        ELSE 0
                     END) AS is_rejected
             FROM egg_dispatch_stops s
             JOIN egg_customer_orders o ON s.order_id = o.id
             LEFT JOIN egg_production_batches b ON COALESCE(o.batch_id, s.batch_id) = b.id
             LEFT JOIN customers c ON COALESCE(o.customer_id, s.customer_id) = c.id
             LEFT JOIN customer_branches cb ON COALESCE(o.customer_branch_id, s.customer_branch_id) = cb.id
             LEFT JOIN sales_headers sh ON (s.sale_id = sh.id OR o.sale_id = sh.id OR (s.dte_codigo_generacion IS NOT NULL AND s.dte_codigo_generacion COLLATE utf8mb4_unicode_ci = sh.codigo_generacion COLLATE utf8mb4_unicode_ci))
             LEFT JOIN dtes d ON d.venta_id = sh.id
             WHERE s.dispatch_route_id = ?
             ORDER BY s.orden_visita ASC, s.id ASC`,
            [id]
        );

        res.json({
            ...route,
            stops
        });
    } catch (error) {
        console.error('Error al obtener detalle de ruta:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getDispatchRouteDetail };
