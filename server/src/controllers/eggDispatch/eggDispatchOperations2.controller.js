const { pool } = require('./shared');

const saveMaintenanceLog = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { id } = req.params;
        const {
            vehicle_id,
            tipo_mantenimiento,
            fecha_programada,
            fecha_realizada,
            odometro,
            taller_proveedor,
            costo_total,
            descripcion,
            repuestos_cambiados,
            estado,
            proximo_servicio_km,
            proximo_servicio_fecha,
            responsable_usuario_id,
            notas
        } = req.body;

        if (!vehicle_id || !fecha_programada || !descripcion) {
            return res.status(400).json({ message: 'Vehículo, fecha programada y descripción son obligatorios.' });
        }

        let maintenanceId = id;

        if (id) {
            await pool.query(
                `UPDATE vehicle_maintenance_logs SET
                    vehicle_id = ?, tipo_mantenimiento = ?, fecha_programada = ?,
                    fecha_realizada = ?, odometro = ?, taller_proveedor = ?,
                    costo_total = ?, descripcion = ?, repuestos_cambiados = ?,
                    estado = ?, proximo_servicio_km = ?, proximo_servicio_fecha = ?,
                    responsable_usuario_id = ?, notas = ?
                 WHERE id = ? AND company_id = ?`,
                [
                    vehicle_id,
                    tipo_mantenimiento || 'preventivo',
                    fecha_programada,
                    fecha_realizada || null,
                    odometro ? parseFloat(odometro) : null,
                    taller_proveedor || null,
                    parseFloat(costo_total) || 0.0,
                    descripcion,
                    repuestos_cambiados || null,
                    estado || 'programado',
                    proximo_servicio_km ? parseFloat(proximo_servicio_km) : null,
                    proximo_servicio_fecha || null,
                    responsable_usuario_id ? parseInt(responsable_usuario_id) : (req.user?.id || null),
                    notas || null,
                    id,
                    company_id
                ]
            );
        } else {
            const [result] = await pool.query(
                `INSERT INTO vehicle_maintenance_logs (
                    company_id, vehicle_id, tipo_mantenimiento, fecha_programada,
                    fecha_realizada, odometro, taller_proveedor, costo_total,
                    descripcion, repuestos_cambiados, estado, proximo_servicio_km,
                    proximo_servicio_fecha, responsable_usuario_id, notas
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id,
                    vehicle_id,
                    tipo_mantenimiento || 'preventivo',
                    fecha_programada,
                    fecha_realizada || null,
                    odometro ? parseFloat(odometro) : null,
                    taller_proveedor || null,
                    parseFloat(costo_total) || 0.0,
                    descripcion,
                    repuestos_cambiados || null,
                    estado || 'programado',
                    proximo_servicio_km ? parseFloat(proximo_servicio_km) : null,
                    proximo_servicio_fecha || null,
                    responsable_usuario_id ? parseInt(responsable_usuario_id) : (req.user?.id || null),
                    notas || null
                ]
            );
            maintenanceId = result.insertId;
        }

        // Sincronizar estado del vehículo según el mantenimiento
        if (estado === 'en_proceso') {
            await pool.query(
                'UPDATE delivery_vehicles SET estado = "en_mantenimiento" WHERE id = ? AND company_id = ?',
                [vehicle_id, company_id]
            );
        } else if (estado === 'completado') {
            let vehicleUpdates = ['estado = "disponible"'];
            let vParams = [];

            if (fecha_realizada) {
                vehicleUpdates.push('ultimo_mantenimiento_fecha = ?');
                vParams.push(fecha_realizada);
            }
            if (odometro) {
                vehicleUpdates.push('ultimo_mantenimiento_km = ?');
                vParams.push(parseFloat(odometro));
                vehicleUpdates.push('odometro_actual = GREATEST(odometro_actual, ?)');
                vParams.push(parseFloat(odometro));
            }
            if (proximo_servicio_fecha) {
                vehicleUpdates.push('proximo_mantenimiento_fecha = ?');
                vParams.push(proximo_servicio_fecha);
            }
            if (proximo_servicio_km) {
                vehicleUpdates.push('proximo_mantenimiento_km = ?');
                vParams.push(parseFloat(proximo_servicio_km));
            }

            vParams.push(vehicle_id, company_id);
            await pool.query(
                `UPDATE delivery_vehicles SET ${vehicleUpdates.join(', ')} WHERE id = ? AND company_id = ?`,
                vParams
            );
        }

        res.json({ id: maintenanceId, message: 'Registro de mantenimiento guardado exitosamente.' });
    } catch (error) {
        console.error('Error al guardar mantenimiento:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteMaintenanceLog = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        await pool.query('DELETE FROM vehicle_maintenance_logs WHERE id = ? AND company_id = ?', [id, company_id]);
        res.json({ message: 'Mantenimiento eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar mantenimiento:', error);
        res.status(500).json({ message: error.message });
    }
};

const getDispatchRoutes = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { fecha_desde, fecha_hasta, fecha, estado, driver_id, vehicle_id } = req.query;

        let sql = `
            SELECT r.*,
                   v.codigo AS vehicle_codigo,
                   v.placa AS vehicle_placa,
                   v.capacidad_peso_lbs AS vehicle_capacidad_peso,
                   v.capacidad_cubetas AS vehicle_capacidad_cubetas,
                   v.tiene_termo_king AS vehicle_termo_king,
                   v.estado AS vehicle_estado,
                   u.nombre AS driver_user_nombre,
                   (SELECT COUNT(*) FROM egg_dispatch_stops s WHERE s.dispatch_route_id = r.id) AS total_stops,
                   (SELECT COUNT(*) FROM egg_dispatch_stops s WHERE s.dispatch_route_id = r.id AND s.estado_entrega = 'entregado') AS completed_stops,
                   (SELECT COUNT(*) FROM egg_dispatch_stops s WHERE s.dispatch_route_id = r.id AND s.prioridad = 'urgente' AND s.estado_entrega != 'entregado') AS urgent_pending_stops,
                   (SELECT COUNT(*) FROM egg_dispatch_stops s JOIN sales_headers sh ON s.sale_id = sh.id LEFT JOIN dtes d ON d.venta_id = sh.id WHERE s.dispatch_route_id = r.id AND (sh.sello_recepcion IS NOT NULL OR d.status = 'ACCEPTED')) AS billed_stops
            FROM egg_dispatch_routes r
            LEFT JOIN delivery_vehicles v ON r.vehicle_id = v.id
            LEFT JOIN users u ON r.driver_id = u.id
            WHERE r.company_id = ?
        `;
        const params = [company_id];

        if (fecha) {
            sql += ' AND r.fecha_despacho = ?';
            params.push(fecha);
        } else {
            if (fecha_desde) {
                sql += ' AND r.fecha_despacho >= ?';
                params.push(fecha_desde);
            }
            if (fecha_hasta) {
                sql += ' AND r.fecha_despacho <= ?';
                params.push(fecha_hasta);
            }
        }

        if (estado) {
            sql += ' AND r.estado = ?';
            params.push(estado);
        }

        if (driver_id) {
            sql += ' AND r.driver_id = ?';
            params.push(driver_id);
        }

        if (vehicle_id) {
            sql += ' AND r.vehicle_id = ?';
            params.push(vehicle_id);
        }

        sql += ' ORDER BY r.fecha_despacho DESC, r.hora_salida_estimada ASC, r.id DESC';

        const [routes] = await pool.query(sql, params);
        res.json(routes);
    } catch (error) {
        console.error('Error al listar rutas de despacho:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { saveMaintenanceLog, deleteMaintenanceLog, getDispatchRoutes };
