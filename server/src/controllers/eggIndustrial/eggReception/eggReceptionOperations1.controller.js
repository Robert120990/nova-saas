const { owned, fail, number, pool } = require('./shared');

const getRawMaterials = async (req, res) => {
    try {
        const { only_with_stock } = req.query;
        let sql = `SELECT rm.*, p.nombre as provider_name
             FROM egg_raw_materials rm
             LEFT JOIN providers p ON rm.provider_id = p.id
             WHERE rm.company_id = ?`;
        const params = [req.company_id];
        if (only_with_stock === 'true') {
            sql += ' AND rm.status = ? AND rm.stock_lbs > 0';
            params.push('aprobado');
            sql += ' ORDER BY rm.fecha ASC, rm.created_at ASC, rm.id ASC';
        } else {
            sql += ' ORDER BY rm.created_at DESC';
        }
        const [rows] = await pool.query(sql, params);

        // Consultar consumos previos por lote y tarima en batch_raw_materials
        const [consumedRows] = await pool.query(
            `SELECT brm.raw_material_id, brm.tarimas_json, brm.quantity_lbs, brm.boxes_count
             FROM batch_raw_materials brm
             JOIN egg_production_batches b ON b.id = brm.batch_id
             WHERE b.company_id = ? AND b.status != 'cancelado'`,
            [req.company_id]
        );

        const consumedMap = {};
        for (const c of consumedRows) {
            const rmId = c.raw_material_id;
            if (!consumedMap[rmId]) consumedMap[rmId] = { tarimas: {}, totalBoxes: 0, totalLbs: 0 };
            consumedMap[rmId].totalBoxes += parseInt(c.boxes_count) || 0;
            consumedMap[rmId].totalLbs += parseFloat(c.quantity_lbs) || 0;

            let parsed = [];
            if (c.tarimas_json) {
                try {
                    parsed = typeof c.tarimas_json === 'string' ? JSON.parse(c.tarimas_json) : c.tarimas_json;
                } catch (e) { }
            }
            if (Array.isArray(parsed)) {
                for (const t of parsed) {
                    const num = parseInt(t.tarima_number) || 1;
                    if (!consumedMap[rmId].tarimas[num]) {
                        consumedMap[rmId].tarimas[num] = { boxes: 0, lbs: 0 };
                    }
                    consumedMap[rmId].tarimas[num].boxes += parseInt(t.boxes_count) || 0;
                    consumedMap[rmId].tarimas[num].lbs += parseFloat(t.quantity_lbs) || 0;
                }
            }
        }

        const enrichedRows = rows.map(rm => {
            const consumed = consumedMap[rm.id] || { tarimas: {}, totalBoxes: 0, totalLbs: 0 };
            let originalTarimas = [];
            if (rm.tarimas_json) {
                try {
                    originalTarimas = typeof rm.tarimas_json === 'string' ? JSON.parse(rm.tarimas_json) : rm.tarimas_json;
                } catch (e) { }
            }

            const lotCode = (rm.provider_lot || 'LOTE').trim().toUpperCase();

            // Si no tiene desglose de tarimas pero tiene peso/cajas, crear tarima default #1
            if (!Array.isArray(originalTarimas) || originalTarimas.length === 0) {
                const origBoxes = parseInt(rm.total_boxes) || 0;
                const origLbs = parseFloat(rm.weight_lbs) || 0;
                originalTarimas = [{
                    tarima_number: 1,
                    boxes_count: origBoxes,
                    net_weight_lbs: origLbs,
                    storage_location: rm.storage_location || 'abajo'
                }];
            }

            const tarimasAvailable = originalTarimas.map((t, idx) => {
                const tarimaNum = parseInt(t.tarima_number) || (idx + 1);
                const origBoxes = parseInt(t.boxes_count) || 0;
                const origLbs = parseFloat(t.net_weight_lbs || t.gross_weight_lbs) || 0;

                const used = consumed.tarimas[tarimaNum] || { boxes: 0, lbs: 0 };
                const availBoxes = Math.max(0, origBoxes - used.boxes);
                const availLbs = Math.max(0, Math.round((origLbs - used.lbs) * 100) / 100);

                const barcode = `TAR-${lotCode}-${String(tarimaNum).padStart(2, '0')}`;
                const isDepleted = (availBoxes <= 0 && availLbs <= 0.01) || parseFloat(rm.stock_lbs) <= 0.01;

                return {
                    tarima_number: tarimaNum,
                    original_boxes: origBoxes,
                    original_lbs: origLbs,
                    consumed_boxes: used.boxes,
                    consumed_lbs: used.lbs,
                    available_boxes: availBoxes,
                    available_lbs: availLbs,
                    barcode: barcode,
                    storage_location: t.storage_location || rm.storage_location || 'abajo',
                    is_depleted: isDepleted
                };
            });

            const tarimaBoxes = Array.isArray(originalTarimas) && originalTarimas.length > 0
                ? originalTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0)
                : 0;
            const initialBoxes = rm.initial_boxes || tarimaBoxes || ((parseInt(rm.total_boxes) || 0) + (consumed.totalBoxes || 0));
            const stockBoxes = parseInt(rm.total_boxes) || 0;
            const initialWeight = parseFloat(rm.weight_lbs) || 0;
            const avgWeightPerBox = initialBoxes > 0 && initialWeight > 0 ? Math.round((initialWeight / initialBoxes) * 100) / 100 : null;

            return {
                ...rm,
                initial_boxes: initialBoxes,
                stock_boxes: stockBoxes,
                consumed_boxes: consumed.totalBoxes || 0,
                avg_weight_per_box: avgWeightPerBox,
                tarimas_available: tarimasAvailable,
                is_depleted: isDepleted
            };
        });

        const finalResult = only_with_stock === 'true'
            ? enrichedRows.filter(r => !r.is_depleted && parseFloat(r.stock_lbs) > 0.01)
            : enrichedRows;

        res.json(finalResult);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createRawMaterial = async (req, res) => {
    try {
        const {
            provider_id, egg_type, egg_color, egg_size, weight_lbs,
            temperature_c, truck_temperature_c, truck_plate, driver_name,
            total_boxes, tarimas_json, provider_lot, certificate_urls,
            operator_name, status, fecha, storage_location
        } = req.body;

        const mainStorageLocation = storage_location || 'abajo';

        // Si viene desglose de tarimas, calcular el peso neto total, cajas y asegurar storage_location
        let finalWeightLbs = weight_lbs;
        let finalBoxes = total_boxes || 0;
        let cleanTarimas = [];
        if (Array.isArray(tarimas_json) && tarimas_json.length > 0) {
            cleanTarimas = tarimas_json.map((t, idx) => ({
                ...t,
                tarima_number: t.tarima_number || (idx + 1),
                storage_location: t.storage_location || mainStorageLocation
            }));
            const sumNet = cleanTarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs) || 0), 0);
            const sumBoxes = cleanTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0);
            if (sumNet > 0) finalWeightLbs = sumNet;
            if (sumBoxes > 0) finalBoxes = sumBoxes;
        }

        await owned(pool, 'providers', provider_id, req.company_id);
        number(finalWeightLbs, 'Peso', 0.001);
        let branchId = req.body.branch_id || req.user?.branch_id;
        if (!branchId) {
            const [b] = await pool.query('SELECT id FROM branches WHERE company_id = ? LIMIT 1', [req.company_id]);
            branchId = b[0]?.id || 1;
        }

        await owned(pool, 'branches', branchId, req.company_id);
        const [result] = await pool.query(
            `INSERT INTO egg_raw_materials (
                company_id, branch_id, provider_id, egg_type, egg_color, egg_size,
                fecha, weight_lbs, total_boxes, initial_boxes, storage_location, stock_lbs, temperature_c, truck_temperature_c,
                truck_plate, driver_name, provider_lot, certificate_urls, tarimas_json, operator_name, status
            )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id, branchId, provider_id, egg_type,
                egg_color || 'blanco', egg_size || 'L', fecha || new Date().toISOString().split('T')[0],
                finalWeightLbs, finalBoxes, finalBoxes, mainStorageLocation, finalWeightLbs, temperature_c || null,
                truck_temperature_c || null, truck_plate || null, driver_name || null,
                provider_lot, JSON.stringify(certificate_urls || []),
                JSON.stringify(cleanTarimas.length > 0 ? cleanTarimas : (tarimas_json || [])), operator_name, 'pendiente_aprobacion'
            ]
        );

        // Crear evento de auditoría
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.received', 'info', ?, ?, ?)`,
            [
                req.company_id,
                `Recibido lote de materia prima ${egg_type} (${finalWeightLbs} LBS, ${finalBoxes} cajas) del proveedor lote ${provider_lot}.`,
                JSON.stringify({ raw_material_id: result.insertId, weight_lbs: finalWeightLbs, total_boxes: finalBoxes }),
                operator_name
            ]
        );

        res.status(201).json({ id: result.insertId, weight_lbs: finalWeightLbs, total_boxes: finalBoxes, storage_location: mainStorageLocation, ...req.body });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const updateRawMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            provider_id, egg_type, egg_color, egg_size, weight_lbs,
            temperature_c, truck_temperature_c, truck_plate, driver_name,
            total_boxes, tarimas_json, provider_lot, certificate_urls,
            operator_name, status, fecha, storage_location
        } = req.body;

        const [existing] = await pool.query(
            'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Recepción no encontrada.' });
        }

        const mainStorageLocation = storage_location || existing[0].storage_location || 'abajo';

        let finalWeightLbs = weight_lbs;
        let finalBoxes = total_boxes || existing[0].total_boxes || 0;
        let cleanTarimas = [];
        if (Array.isArray(tarimas_json) && tarimas_json.length > 0) {
            cleanTarimas = tarimas_json.map((t, idx) => ({
                ...t,
                tarima_number: t.tarima_number || (idx + 1),
                storage_location: t.storage_location || mainStorageLocation
            }));
            const sumNet = cleanTarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs) || 0), 0);
            const sumBoxes = cleanTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0);
            if (sumNet > 0) finalWeightLbs = sumNet;
            if (sumBoxes > 0) finalBoxes = sumBoxes;
        }

        // Si el peso cambia y el lote aún no ha sido consumido, ajustar stock_lbs
        const currentStock = parseFloat(existing[0].stock_lbs);
        const prevWeight = parseFloat(existing[0].weight_lbs);
        number(finalWeightLbs, 'Peso', 0.001);
        const consumed = prevWeight - currentStock;
        if (Number(finalWeightLbs) < consumed) fail('El peso corregido no puede ser menor al consumo registrado.');
        if (consumed > 0 && Number(finalWeightLbs) !== prevWeight) fail('Una recepción consumida requiere un ajuste de inventario, no editar su peso.', 409);
        let updatedStock = currentStock;
        if (currentStock === prevWeight) {
            updatedStock = finalWeightLbs;
        }

        const newInitialBoxes = consumed > 0 ? (existing[0].initial_boxes || existing[0].total_boxes) : finalBoxes;

        await pool.query(
            `UPDATE egg_raw_materials SET
                provider_id = ?, egg_type = ?, egg_color = ?, egg_size = ?,
                fecha = ?, weight_lbs = ?, total_boxes = ?, initial_boxes = ?, storage_location = ?, stock_lbs = ?,
                temperature_c = ?, truck_temperature_c = ?, truck_plate = ?, driver_name = ?,
                provider_lot = ?, certificate_urls = ?, tarimas_json = ?, operator_name = ?, status = ?
             WHERE id = ? AND company_id = ?`,
            [
                provider_id, egg_type, egg_color || 'blanco', egg_size || 'L',
                fecha || existing[0].fecha, finalWeightLbs, finalBoxes, newInitialBoxes, mainStorageLocation, updatedStock,
                temperature_c, truck_temperature_c || null, truck_plate || null, driver_name || null,
                provider_lot, JSON.stringify(certificate_urls || []),
                JSON.stringify(cleanTarimas.length > 0 ? cleanTarimas : (tarimas_json || [])), operator_name, existing[0].status,
                id, req.company_id
            ]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.updated', 'info', ?, ?, ?)`,
            [req.company_id, `Recepción de materia prima #${id} actualizada.`, JSON.stringify({ raw_material_id: parseInt(id), ...req.body }), operator_name]
        );

        res.json({ id, weight_lbs: finalWeightLbs, total_boxes: finalBoxes, ...req.body });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { getRawMaterials, createRawMaterial, updateRawMaterial };
