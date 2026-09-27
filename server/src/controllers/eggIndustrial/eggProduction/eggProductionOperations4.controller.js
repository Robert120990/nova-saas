const { eggRules, pool } = require('./shared');

const deleteProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote de producción no encontrado.' });
        }
        const batch = existing[0];

        if (batch.completed_at || !['en_proceso','quebraje'].includes(batch.status)) eggRules.fail('Un lote procesado no puede eliminarse ni devolver materia prima como si no se hubiese consumido.', 409);
        const [processing] = await connection.query('SELECT id FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? LIMIT 1', [id, company_id]);
        const [assigned] = await connection.query('SELECT id FROM egg_batch_remanentes WHERE batch_id = ? AND company_id = ? AND target_batch_id IS NOT NULL LIMIT 1', [id, company_id]);
        if (processing.length || assigned.length) eggRules.fail('El lote tiene procesamiento o remanentes utilizados y debe conservarse para trazabilidad.', 409);
        // Verificar si ya tiene empaque registrado
        const [pkgRecords] = await connection.query(
            'SELECT COUNT(*) as count FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [id, company_id]
        );
        if (pkgRecords[0]?.count > 0) {
            await connection.rollback();
            return res.status(400).json({
                message: `No se puede eliminar el lote porque ya cuenta con ${pkgRecords[0].count} registro(s) de envasado comercial. Debe conservarse la trazabilidad del envasado.`
            });
        }

        // Revertir materias primas consumidas a egg_raw_materials
        const [materials] = await connection.query(
            'SELECT * FROM batch_raw_materials WHERE batch_id = ?',
            [id]
        );
        for (const rm of materials) {
            const qty = parseFloat(rm.quantity_lbs || 0);
            const boxes = parseInt(rm.boxes_count || 0, 10);
            if (boxes > 0) {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ?, total_boxes = total_boxes + ? WHERE id = ? AND company_id = ?',
                    [qty, boxes, rm.raw_material_id, company_id]
                );
            } else {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ? WHERE id = ? AND company_id = ?',
                    [qty, rm.raw_material_id, company_id]
                );
            }
        }

        await connection.query("UPDATE egg_batch_remanentes SET status = 'disponible', target_batch_id = NULL WHERE target_batch_id = ? AND company_id = ?", [id, company_id]);
        // Eliminar tablas dependientes
        await connection.query('DELETE FROM batch_raw_materials WHERE batch_id = ?', [id]);
        await connection.query('DELETE FROM egg_batch_variable_costs WHERE batch_id = ? AND company_id = ?', [id, company_id]);
        await connection.query('DELETE FROM egg_batch_waste_logs WHERE batch_id = ? AND company_id = ?', [id, company_id]);
        await connection.query('DELETE FROM egg_batch_remanentes WHERE batch_id = ? AND company_id = ?', [id, company_id]);
        await connection.query('DELETE FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ?', [id, company_id]);

        // Si estaba vinculado al calendario, restaurar estado a 'programado'
        if (batch.scheduled_production_id) {
            await connection.query(
                'UPDATE egg_scheduled_productions SET status = "programado", batch_id = NULL WHERE id = ? AND company_id = ?',
                [batch.scheduled_production_id, company_id]
            );
        }

        await connection.query('DELETE FROM egg_production_batches WHERE id = ? AND company_id = ?', [id, company_id]);

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.deleted', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Lote de producción #${id} (${batch.batch_code_display || batch.batch_uuid}) eliminado y stock revertido.`,
                JSON.stringify({ batch_id: parseInt(id), batch_code: batch.batch_code_display, materials_reverted: materials.length }),
                req.user?.nombre || 'Administrador'
            ]
        );

        await connection.commit();
        res.json({ success: true, message: 'Lote de producción eliminado y materias primas revertidas al stock.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in deleteProductionBatch:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const addTarimasToBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;
        const { raw_materials, notes, operator_name } = req.body;

        // Validar lote de producción
        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote de producción no encontrado.' });
        }
        const batch = batches[0];

        if (batch.pasteurization_status === 'cerrado' || !['en_proceso', 'quebraje'].includes(batch.status) || batch.completed_at) eggRules.fail('Reabra el lote antes de agregar materia prima.', 409);

        // Construir lista de items de materia prima a procesar
        let listToAdd = [];
        if (Array.isArray(raw_materials) && raw_materials.length > 0) {
            listToAdd = raw_materials;
        } else if (req.body.raw_material_id) {
            const singleQty = parseFloat(req.body.weight_lbs || req.body.quantity_lbs || 0);
            const singleBoxes = parseInt(req.body.boxes_count || 0, 10);
            listToAdd = [{
                raw_material_id: req.body.raw_material_id,
                quantity_lbs: singleQty,
                boxes_count: singleBoxes,
                tarimas: req.body.tarimas || (req.body.tarima_number ? [{
                    tarima_number: req.body.tarima_number,
                    boxes_count: singleBoxes,
                    quantity_lbs: singleQty
                }] : [])
            }];
        }

        if (listToAdd.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe especificar las tarimas y lotes de materia prima a agregar.' });
        }

        listToAdd = eggRules.normalizeMaterials(listToAdd);
        let totalAddedLbs = 0;
        let totalAddedBoxes = 0;

        for (const rm of listToAdd) {
            const rmId = parseInt(rm.raw_material_id, 10);
            const qty = parseFloat(rm.quantity_lbs || rm.weight_lbs || 0);
            const boxes = parseInt(rm.boxes_count || 0, 10);
            const tarimas = Array.isArray(rm.tarimas) ? rm.tarimas : [];

            if (qty <= 0) continue;

            // Validar stock del lote de MP
            const [rmRows] = await connection.query(
                'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE',
                [rmId, company_id]
            );
            if (rmRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Materia prima con ID ${rmId} no encontrada.` });
            }

            const currentStock = parseFloat(rmRows[0].stock_lbs || 0);
            if (rmRows[0].status !== 'aprobado') eggRules.fail('La materia prima debe estar aprobada.');
            if (currentStock < qty || Number(rmRows[0].total_boxes || 0) < boxes) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Stock insuficiente en lote ${rmRows[0].provider_lot}. Disponible: ${currentStock.toFixed(2)} Lbs, Solicitado: ${qty.toFixed(2)} Lbs.`
                });
            }

            // Descontar stock
            if (boxes > 0) {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs - ?, total_boxes = total_boxes - ? WHERE id = ? AND company_id = ?',
                    [qty, boxes, rmId, company_id]
                );
            } else {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs - ? WHERE id = ? AND company_id = ?',
                    [qty, rmId, company_id]
                );
            }

            // Insertar o actualizar en batch_raw_materials
            const [existingBrm] = await connection.query(
                'SELECT * FROM batch_raw_materials WHERE batch_id = ? AND raw_material_id = ?',
                [id, rmId]
            );

            if (existingBrm.length > 0) {
                let currentTarimas = [];
                try {
                    currentTarimas = typeof existingBrm[0].tarimas_json === 'string'
                        ? JSON.parse(existingBrm[0].tarimas_json || '[]')
                        : (existingBrm[0].tarimas_json || []);
                } catch (e) { currentTarimas = []; }

                const combinedTarimas = [...currentTarimas, ...tarimas];
                const newQty = parseFloat(existingBrm[0].quantity_lbs || 0) + qty;
                const newBoxes = parseInt(existingBrm[0].boxes_count || 0, 10) + boxes;

                await connection.query(
                    'UPDATE batch_raw_materials SET quantity_lbs = ?, boxes_count = ?, tarimas_json = ? WHERE id = ?',
                    [newQty, newBoxes, JSON.stringify(combinedTarimas), existingBrm[0].id]
                );
            } else {
                await connection.query(
                    'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, tarimas_json, boxes_count) VALUES (?, ?, ?, ?, ?)',
                    [id, rmId, qty, JSON.stringify(tarimas), boxes]
                );
            }

            totalAddedLbs += qty;
            totalAddedBoxes += boxes;
        }

        if (totalAddedLbs <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El peso total de las tarimas agregadas debe ser mayor a cero.' });
        }

        // Incrementar input_weight_lbs en el lote de producción
        await connection.query(
            'UPDATE egg_production_batches SET input_weight_lbs = input_weight_lbs + ? WHERE id = ? AND company_id = ?',
            [totalAddedLbs, id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'batch.tarimas_added', 'info', ?, ?, ?)`,
            [
                company_id,
                `Agregadas ${totalAddedLbs.toFixed(2)} Lbs (${totalAddedBoxes} cajas / tarimas) al quebraje del lote ${batch.batch_code_display || batch.batch_uuid}.`,
                JSON.stringify({ batch_id: parseInt(id), totalAddedLbs, totalAddedBoxes, notes }),
                operator_name || req.user?.nombre || batch.operator_name || 'Operador'
            ]
        );

        await connection.commit();
        res.json({
            success: true,
            message: `Se agregaron exitosamente ${totalAddedLbs.toFixed(2)} Lbs (${totalAddedBoxes} cjs) al lote ${batch.batch_code_display || batch.batch_uuid}.`,
            totalAddedLbs,
            totalAddedBoxes,
            new_input_weight_lbs: parseFloat(batch.input_weight_lbs || 0) + totalAddedLbs
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in addTarimasToBatch:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};
module.exports = { deleteProductionBatch, addTarimasToBatch };
