const { pool, safeNum } = require('./shared');

const confirmStopDelivery = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const company_id = req.company_id || req.user?.company_id;
        const { stop_id } = req.params;
        const {
            dte_codigo_generacion,
            recibido_por,
            telefono_receptor,
            observaciones_entrega,
            latitude,
            longitude,
            update_branch_data // Boolean para actualizar o crear la sucursal
        } = req.body;

        const [stopRows] = await connection.query(
            `SELECT s.*, o.customer_id, o.customer_name, o.customer_branch_id AS order_branch_id,
                    r.id AS route_id, r.company_id AS route_company_id
             FROM egg_dispatch_stops s
             JOIN egg_customer_orders o ON s.order_id = o.id
             JOIN egg_dispatch_routes r ON s.dispatch_route_id = r.id
             WHERE s.id = ? AND r.company_id = ?`,
            [stop_id, company_id]
        );

        if (stopRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Parada de entrega no encontrada.' });
        }

        const stop = stopRows[0];
        const parsedLat = safeNum(latitude, null);
        const parsedLng = safeNum(longitude, null);
        const cleanRecibidoPor = (recibido_por || '').trim();
        const cleanTelefono = (telefono_receptor || '').trim();
        const cleanDte = (dte_codigo_generacion || '').trim().toUpperCase();

        // 1. Actualizar egg_dispatch_stops
        await connection.query(
            `UPDATE egg_dispatch_stops SET
                estado_entrega = 'entregado',
                hora_real_llegada = NOW(),
                dte_codigo_generacion = COALESCE(?, dte_codigo_generacion),
                recibido_por = ?,
                telefono_receptor = ?,
                observaciones_entrega = ?,
                lat_entrega = ?,
                lng_entrega = ?
             WHERE id = ?`,
            [
                cleanDte || null,
                cleanRecibidoPor || null,
                cleanTelefono || null,
                observaciones_entrega || null,
                parsedLat,
                parsedLng,
                stop_id
            ]
        );

        // 2. Actualizar egg_customer_orders
        await connection.query(
            `UPDATE egg_customer_orders SET
                delivery_status = 'entregado',
                status = 'entregado',
                delivered_at = NOW(),
                delivered_by_user_id = ?,
                dte_codigo_generacion = COALESCE(?, dte_codigo_generacion),
                recipient_name = ?,
                recipient_phone = ?,
                delivery_notes = ?
             WHERE id = ? AND company_id = ?`,
            [
                req.user?.id || null,
                cleanDte || null,
                cleanRecibidoPor || null,
                cleanTelefono || null,
                observaciones_entrega || null,
                stop.order_id,
                company_id
            ]
        );

        // 3. ACTUALIZAR O VINCULAR LA SUCURSAL DEL CLIENTE PARA FUTURAS ENTREGAS
        let branchId = stop.customer_branch_id || stop.order_branch_id;

        if (branchId) {
            // Actualizar sucursal existente
            const branchUpdates = [];
            const bParams = [];

            if (parsedLat !== null && parsedLng !== null) {
                branchUpdates.push('latitude = ?', 'longitude = ?');
                bParams.push(parsedLat, parsedLng);
            }
            if (cleanRecibidoPor) {
                branchUpdates.push('contacto_nombre = ?');
                bParams.push(cleanRecibidoPor);
            }
            if (cleanTelefono) {
                branchUpdates.push('contacto_telefono = ?', 'telefono = COALESCE(telefono, ?)');
                bParams.push(cleanTelefono, cleanTelefono);
            }
            if (observaciones_entrega) {
                branchUpdates.push('indicaciones_entrega = ?');
                bParams.push(observaciones_entrega);
            }

            if (branchUpdates.length > 0) {
                bParams.push(branchId, company_id);
                await connection.query(
                    `UPDATE customer_branches SET ${branchUpdates.join(', ')} WHERE id = ? AND company_id = ?`,
                    bParams
                );
            }
        } else if (stop.customer_id) {
            // Si el cliente aún no tenía sucursal creada, crear "Sucursal Principal / Entrega" con las coordenadas y contacto capturados
            const [custData] = await connection.query(
                'SELECT nombre, direccion, departamento, municipio, telefono FROM customers WHERE id = ? AND company_id = ?',
                [stop.customer_id, company_id]
            );
            if (custData.length > 0) {
                const c = custData[0];
                const [newBranch] = await connection.query(
                    `INSERT INTO customer_branches (
                        customer_id, company_id, nombre, departamento, municipio,
                        direccion, telefono, contacto_nombre, contacto_telefono,
                        latitude, longitude, indicaciones_entrega
                    ) VALUES (?, ?, 'Sucursal Principal', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        stop.customer_id,
                        company_id,
                        c.departamento || '06',
                        c.municipio || '14',
                        c.direccion || 'Dirección de Entrega',
                        cleanTelefono || c.telefono || null,
                        cleanRecibidoPor || null,
                        cleanTelefono || null,
                        parsedLat,
                        parsedLng,
                        observaciones_entrega || null
                    ]
                );
                branchId = newBranch.insertId;

                // Vincular la nueva sucursal a la parada y al pedido
                await connection.query('UPDATE egg_dispatch_stops SET customer_branch_id = ? WHERE id = ?', [branchId, stop_id]);
                await connection.query('UPDATE egg_customer_orders SET customer_branch_id = ? WHERE id = ?', [branchId, stop.order_id]);
            }
        }

        // 4. Verificar si todas las paradas de la ruta fueron completadas o atendidas
        const [pendingStops] = await connection.query(
            `SELECT COUNT(*) as pending_count
             FROM egg_dispatch_stops
             WHERE dispatch_route_id = ? AND estado_entrega IN ('pendiente', 'en_camino')`,
            [stop.route_id]
        );

        if (pendingStops[0].pending_count === 0) {
            await connection.query(
                `UPDATE egg_dispatch_routes SET estado = 'completada', hora_llegada_real = NOW()
                 WHERE id = ? AND company_id = ?`,
                [stop.route_id, company_id]
            );

            // Liberar camión si estaba en ruta
            const [rCheck] = await connection.query('SELECT vehicle_id FROM egg_dispatch_routes WHERE id = ?', [stop.route_id]);
            if (rCheck.length > 0 && rCheck[0].vehicle_id) {
                await connection.query('UPDATE delivery_vehicles SET estado = "disponible" WHERE id = ?', [rCheck[0].vehicle_id]);
            }
        }

        await connection.commit();

        res.json({
            message: 'Entrega confirmada y datos de sucursal actualizados para futuras visitas.',
            branch_id: branchId,
            route_completed: pendingStops[0].pending_count === 0
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al confirmar entrega:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const updateCustomerBranchLocation = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { branch_id } = req.params;
        const { latitude, longitude, contacto_nombre, contacto_telefono, indicaciones_entrega, direccion } = req.body;

        if (!branch_id) {
            return res.status(400).json({ message: 'El ID de la sucursal es obligatorio.' });
        }

        await pool.query(
            `UPDATE customer_branches SET
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                contacto_nombre = COALESCE(?, contacto_nombre),
                contacto_telefono = COALESCE(?, contacto_telefono),
                indicaciones_entrega = COALESCE(?, indicaciones_entrega),
                direccion = COALESCE(?, direccion)
             WHERE id = ? AND company_id = ?`,
            [
                latitude ? parseFloat(latitude) : null,
                longitude ? parseFloat(longitude) : null,
                contacto_nombre ? contacto_nombre.trim() : null,
                contacto_telefono ? contacto_telefono.trim() : null,
                indicaciones_entrega ? indicaciones_entrega.trim() : null,
                direccion ? direccion.trim() : null,
                branch_id,
                company_id
            ]
        );

        res.json({ message: 'Ubicación y contacto de la sucursal actualizados exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar ubicación de sucursal:', error);
        res.status(500).json({ message: error.message });
    }
};

const getCustomerBranches = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { customer_id } = req.query;

        let sql = `
            SELECT cb.*, c.nombre AS customer_name
            FROM customer_branches cb
            JOIN customers c ON cb.customer_id = c.id
            WHERE cb.company_id = ?
        `;
        const params = [company_id];

        if (customer_id) {
            sql += ' AND cb.customer_id = ?';
            params.push(customer_id);
        }

        sql += ' ORDER BY c.nombre ASC, cb.nombre ASC';

        const [branches] = await pool.query(sql, params);
        res.json(branches);
    } catch (error) {
        console.error('Error al listar sucursales:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { confirmStopDelivery, updateCustomerBranchLocation, getCustomerBranches };
