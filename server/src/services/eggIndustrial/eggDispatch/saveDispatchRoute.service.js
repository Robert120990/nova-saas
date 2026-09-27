const { pool, safeNum, safeInt } = require('../../../controllers/eggDispatch/shared');

const saveDispatchRoute = async (req) => {
    const responseHeaders = {};
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const company_id = req.company_id || req.user?.company_id;
        const { id } = req.params;
        const {
            codigo_ruta,
            fecha_despacho,
            vehicle_id,
            driver_id,
            driver_name,
            driver_phone,
            estado,
            hora_salida_estimada,
            odometro_inicial,
            odometro_final,
            distancia_km_estimada,
            notas_ruta,
            stops // Array de { order_id, customer_id, customer_branch_id, prioridad, orden_visita }
        } = req.body;

        if (!fecha_despacho) {
            await connection.rollback();
            return ({ status: 400, body: { message: 'La fecha de despacho es obligatoria.' }, headers: responseHeaders });
        }

        // 1. Validar estado del camión si fue asignado
        let vehicleRecord = null;
        if (vehicle_id) {
            const [vCheck] = await connection.query(
                'SELECT id, codigo, placa, estado, capacidad_peso_lbs, capacidad_cubetas FROM delivery_vehicles WHERE id = ? AND company_id = ?',
                [vehicle_id, company_id]
            );
            if (vCheck.length === 0) {
                await connection.rollback();
                return ({ status: 400, body: { message: 'El camión seleccionado no existe o no pertenece a la empresa.' }, headers: responseHeaders });
            }
            vehicleRecord = vCheck[0];

            if (vehicleRecord.estado === 'en_mantenimiento') {
                await connection.rollback();
                return ({ status: 400, body: {
                    message: `El camión ${vehicleRecord.codigo} (${vehicleRecord.placa}) se encuentra EN MANTENIMIENTO y no puede ser programado en rutas activas.`
                }, headers: responseHeaders });
            }
            if (vehicleRecord.estado === 'inactivo') {
                await connection.rollback();
                return ({ status: 400, body: {
                    message: `El camión ${vehicleRecord.codigo} (${vehicleRecord.placa}) está INACTIVO.`
                }, headers: responseHeaders });
            }
        }

        // 2. Generar código de ruta si no viene
        let routeCode = (codigo_ruta || '').trim();
        if (!routeCode) {
            const cleanDate = fecha_despacho.replace(/-/g, '');
            const [countRows] = await connection.query(
                'SELECT COUNT(*) as cnt FROM egg_dispatch_routes WHERE company_id = ? AND fecha_despacho = ?',
                [company_id, fecha_despacho]
            );
            const nextNum = (countRows[0].cnt || 0) + 1;
            routeCode = `RUTA-${cleanDate}-${String(nextNum).padStart(2, '0')}`;
        }

        // 3. Resolver nombre y teléfono del motorista si se seleccionó un usuario registrado
        let resolvedDriverName = driver_name || null;
        let resolvedDriverPhone = driver_phone || null;
        if (driver_id) {
            const [uRows] = await connection.query(
                `SELECT u.id, u.nombre, u.telefono
                 FROM users u
                 INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
                 WHERE u.id = ? AND ue.empresa_id = ?`,
                [driver_id, company_id]
            );
            if (uRows.length > 0) {
                resolvedDriverName = uRows[0].nombre;
                if (!resolvedDriverPhone && uRows[0].telefono) {
                    resolvedDriverPhone = uRows[0].telefono;
                }
            }
        }

        // 4. Calcular totales de carga de las paradas
        let totalPedidos = 0;
        let totalPesoLbs = 0;
        let totalCubetas = 0;

        const stopList = Array.isArray(stops) ? stops : [];
        if (stopList.length > 0) {
            const orderIds = stopList.map(s => s.order_id).filter(Boolean);
            if (orderIds.length > 0) {
                const [ordersData] = await connection.query(
                    `SELECT id, quantity_lbs FROM egg_customer_orders WHERE id IN (?) AND company_id = ?`,
                    [orderIds, company_id]
                );
                totalPedidos = ordersData.length;
                ordersData.forEach(o => {
                    const lbs = safeNum(o.quantity_lbs, 0);
                    totalPesoLbs += lbs;
                    totalCubetas += Math.ceil(lbs / 30.0);
                });

                // Evitar asignación duplicada concurrente en rutas nuevas
                if (!id) {
                    const [alreadyAssigned] = await connection.query(
                        `SELECT id, order_number, dispatch_route_id
                         FROM egg_customer_orders
                         WHERE id IN (?) AND dispatch_route_id IS NOT NULL AND company_id = ?`,
                        [orderIds, company_id]
                    );
                    if (alreadyAssigned.length > 0) {
                        await connection.rollback();
                        return ({ status: 400, body: {
                            message: `El pedido ${alreadyAssigned[0].order_number || '#' + alreadyAssigned[0].id} ya se encuentra asignado a otra ruta de despacho.`
                        }, headers: responseHeaders });
                    }
                }
            }
        }

        let routeId = id;

        let existingStopsMap = {};
        if (id) {
            const [currentRoute] = await connection.query('SELECT estado FROM egg_dispatch_routes WHERE id = ? AND company_id = ? FOR UPDATE', [id, company_id]);
            if (currentRoute.length === 0) {
                await connection.rollback();
                return ({ status: 404, body: { message: 'Ruta no encontrada.' }, headers: responseHeaders });
            }
            if (['completada', 'cancelada'].includes(currentRoute[0].estado)) {
                await connection.rollback();
                return ({ status: 409, body: { message: `No se puede modificar una ruta que ya se encuentra ${currentRoute[0].estado}.` }, headers: responseHeaders });
            }

            await connection.query(
                `UPDATE egg_dispatch_routes SET
                    codigo_ruta = ?, fecha_despacho = ?, vehicle_id = ?,
                    driver_id = ?, driver_name = ?, driver_phone = ?,
                    estado = ?, hora_salida_estimada = ?, total_pedidos = ?,
                    total_peso_lbs = ?, total_cubetas = ?, odometro_inicial = ?,
                    odometro_final = ?, distancia_km_estimada = ?, notas_ruta = ?
                 WHERE id = ? AND company_id = ?`,
                [
                    routeCode,
                    fecha_despacho,
                    safeInt(vehicle_id),
                    safeInt(driver_id),
                    resolvedDriverName,
                    resolvedDriverPhone,
                    estado || 'planificada',
                    hora_salida_estimada || '07:00:00',
                    safeInt(totalPedidos, 0),
                    safeNum(totalPesoLbs, 0),
                    safeInt(totalCubetas, 0),
                    safeNum(odometro_inicial, null),
                    safeNum(odometro_final, null),
                    safeNum(distancia_km_estimada, null),
                    notas_ruta || null,
                    safeInt(id),
                    company_id
                ]
            );

            // Obtener paradas existentes para preservar datos de facturación (sale_id, dte_codigo_generacion, entrega)
            const [currentStops] = await connection.query(
                'SELECT * FROM egg_dispatch_stops WHERE dispatch_route_id = ?',
                [id]
            );
            currentStops.forEach(s => {
                existingStopsMap[s.order_id] = s;
            });

            const newOrderIds = stopList.map(s => safeInt(s.order_id)).filter(Boolean);

            // Identificar paradas removidas que no deben seguir en la ruta
            const removedStops = currentStops.filter(s => !newOrderIds.includes(s.order_id));
            for (const rem of removedStops) {
                // Si la parada NO fue facturada, la liberamos a pendiente
                if (!rem.sale_id && !rem.dte_codigo_generacion) {
                    await connection.query(
                        `UPDATE egg_customer_orders
                         SET dispatch_route_id = NULL, delivery_status = 'pendiente', status = 'pendiente'
                         WHERE id = ? AND company_id = ?`,
                        [rem.order_id, company_id]
                    );
                    await connection.query('DELETE FROM egg_dispatch_stops WHERE id = ?', [rem.id]);
                }
                // Si ya fue facturada, la conservamos en la ruta para no perder trazabilidad fiscal
            }
        } else {
            const [insRes] = await connection.query(
                `INSERT INTO egg_dispatch_routes (
                    company_id, codigo_ruta, fecha_despacho, vehicle_id, driver_id,
                    driver_name, driver_phone, estado, hora_salida_estimada, total_pedidos,
                    total_peso_lbs, total_cubetas, odometro_inicial, odometro_final,
                    distancia_km_estimada, notas_ruta
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id,
                    routeCode,
                    fecha_despacho,
                    safeInt(vehicle_id),
                    safeInt(driver_id),
                    resolvedDriverName,
                    resolvedDriverPhone,
                    estado || 'planificada',
                    hora_salida_estimada || '07:00:00',
                    safeInt(totalPedidos, 0),
                    safeNum(totalPesoLbs, 0),
                    safeInt(totalCubetas, 0),
                    safeNum(odometro_inicial, null),
                    safeNum(odometro_final, null),
                    safeNum(distancia_km_estimada, null),
                    notas_ruta || null
                ]
            );
            routeId = insRes.insertId;
        }

        // 5. Insertar o actualizar paradas y asociar pedidos con trazabilidad de lotes
        for (let idx = 0; idx < stopList.length; idx++) {
            const stop = stopList[idx];
            const ordenVisita = stop.orden_visita !== undefined ? safeInt(stop.orden_visita, idx + 1) : (idx + 1);

            const [oData] = await connection.query(
                'SELECT batch_id, lot_code FROM egg_customer_orders WHERE id = ?',
                [stop.order_id]
            );
            const stopBatchId = safeInt(oData[0]?.batch_id);
            const stopLotCode = oData[0]?.lot_code || null;

            const existing = existingStopsMap[stop.order_id];

            if (existing) {
                // Actualizar parada existente preservando sale_id, dte_codigo_generacion, etc.
                await connection.query(
                    `UPDATE egg_dispatch_stops SET
                        customer_branch_id = ?,
                        orden_visita = ?,
                        prioridad = ?,
                        batch_id = COALESCE(batch_id, ?),
                        lot_code = COALESCE(lot_code, ?)
                     WHERE id = ?`,
                    [
                        safeInt(stop.customer_branch_id),
                        ordenVisita,
                        stop.prioridad || existing.prioridad || 'normal',
                        stopBatchId,
                        stopLotCode,
                        existing.id
                    ]
                );
            } else {
                // Insertar nueva parada a la ruta existente o nueva
                await connection.query(
                    `INSERT INTO egg_dispatch_stops (
                        dispatch_route_id, order_id, customer_id, customer_branch_id,
                        orden_visita, prioridad, estado_entrega, batch_id, lot_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        safeInt(routeId),
                        safeInt(stop.order_id),
                        safeInt(stop.customer_id),
                        safeInt(stop.customer_branch_id),
                        ordenVisita,
                        stop.prioridad || 'normal',
                        'pendiente',
                        stopBatchId,
                        stopLotCode
                    ]
                );
            }

            // Actualizar pedido a 'en_ruta' o 'programado'
            await connection.query(
                `UPDATE egg_customer_orders SET
                    dispatch_route_id = ?,
                    customer_branch_id = COALESCE(?, customer_branch_id),
                    delivery_status = CASE WHEN delivery_status = 'entregado' THEN 'entregado' ELSE 'en_ruta' END,
                    status = CASE WHEN status = 'entregado' THEN 'entregado' ELSE 'en_proceso' END,
                    priority = ?
                 WHERE id = ? AND company_id = ?`,
                [safeInt(routeId), safeInt(stop.customer_branch_id), stop.prioridad || 'normal', safeInt(stop.order_id), company_id]
            );
        }

        // 6. Actualizar estado del camión a 'en_ruta' si la ruta pasa a en_curso
        if (vehicle_id && estado === 'en_curso') {
            await connection.query(
                'UPDATE delivery_vehicles SET estado = "en_ruta" WHERE id = ? AND company_id = ?',
                [vehicle_id, company_id]
            );
        }

        await connection.commit();

        return ({ status: 200, body: {
            id: routeId,
            codigo_ruta: routeCode,
            total_peso_lbs: totalPesoLbs,
            total_cubetas: totalCubetas,
            message: 'Ruta de despacho guardada exitosamente.'
        }, headers: responseHeaders });
    } catch (error) {
        await connection.rollback();
        console.error('Error al guardar ruta de despacho:', error);
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    } finally {
        connection.release();
    }
};
module.exports = saveDispatchRoute;
