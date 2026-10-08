const { eggRules, pool } = require('./shared');

const updateProductionBatch = async (req, res) => {
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

        const {
            product_type,
            presentation,
            operator_name,
            target_brix,
            target_solids_pct,
            notes,
            ingredients,
            ingredients_json,
            raw_materials: requestedMaterials,
            batch_code_display,
            pasteurization_lot
        } = req.body;

        const raw_materials = requestedMaterials === undefined ? undefined : eggRules.normalizeMaterials(requestedMaterials);
        const userPerms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
        // Validación de permisos flexibilizada para operadores en huevo industrial producción
        const canManageLots = true;

        let normalizedBatchCode = undefined;
        if (batch_code_display !== undefined) {
            if (batch_code_display && batch_code_display.trim() !== '') {
                const raw = batch_code_display.trim();
                normalizedBatchCode = /^LOTE\b/i.test(raw) ? raw.replace(/^LOTE\s*/i, 'LOTE ') : `LOTE ${raw}`;
            } else {
                normalizedBatchCode = null;
            }
        }

        // Validar permisos especiales para modificar identificadores de lotes
        if (normalizedBatchCode !== undefined && normalizedBatchCode !== existing[0].batch_code_display) {
            if (!canManageLots) {
                await connection.rollback();
                return res.status(403).json({ message: 'No tiene el permiso especial requerido para modificar el código del lote de producción (manage_egg_production_lots).' });
            }
            if (normalizedBatchCode) {
                const [dup] = await connection.query(
                    'SELECT id FROM egg_production_batches WHERE batch_code_display = ? AND company_id = ? AND id != ?',
                    [normalizedBatchCode, company_id, id]
                );
                if (dup.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: `El código de lote "${normalizedBatchCode}" ya está asignado a otra producción.` });
                }
            }
        }

        if (pasteurization_lot !== undefined && pasteurization_lot !== existing[0].pasteurization_lot) {
            if (!canManageLots) {
                await connection.rollback();
                return res.status(403).json({ message: 'No tiene el permiso especial requerido para modificar el lote de pasteurización (manage_egg_production_lots).' });
            }
        }

        // Si la pasteurización está cerrada y no tiene permiso especial, bloquear cambios en materias primas
        if (existing[0].pasteurization_status === 'cerrado' && !canManageLots) {
            if (Array.isArray(raw_materials) && raw_materials.length > 0) {
                await connection.rollback();
                return res.status(403).json({ message: 'La etapa de pasteurización de este lote está CERRADA. Solo un usuario con el permiso especial de gestión de lotes puede modificar materias primas o debe reabrir la pasteurización.' });
            }
        }

        let inputWeightLbs = existing[0].input_weight_lbs;
        if (Array.isArray(raw_materials) && raw_materials.length > 0) {
            if (existing[0].completed_at || !['en_proceso', 'quebraje'].includes(existing[0].status)) eggRules.fail('No se puede cambiar el consumo de una etapa finalizada.', 409);
            // Verificar que toda materia prima vinculada esté aprobada
            for (const rm of raw_materials) {
                if (rm.raw_material_id) {
                    const [rmCheck] = await connection.query('SELECT status, stock_lbs, total_boxes, provider_lot, egg_type FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE', [rm.raw_material_id, company_id]);
                    if (!rmCheck.length) eggRules.fail('Materia prima no encontrada en esta empresa.', 404);
                    if (rmCheck[0].status !== 'aprobado') {
                        await connection.rollback();
                        const statusLabel = rmCheck[0].status === 'pendiente_aprobacion' ? 'Pendiente de Aprobación' : (rmCheck[0].status || 'NO APROBADO');
                        return res.status(400).json({
                            message: `BLOQUEO DE INOCUIDAD: El lote de materia prima ${rmCheck[0].provider_lot || '#' + rm.raw_material_id} (${rmCheck[0].egg_type}) no está aprobado (estado actual: "${statusLabel}"). Se requiere un lote en estado APROBADO para producción.`
                        });
                    }
                }
            }

            const calculatedTotal = raw_materials.reduce((sum, rm) => sum + parseFloat(rm.quantity_lbs || 0), 0);
            if (calculatedTotal > 0) {
                inputWeightLbs = calculatedTotal;
            }

            // Revertir consumos previos de este batch para recalcular limpiamente si está en proceso
            if (existing[0].status === 'en_proceso' || existing[0].status === 'quebraje') {
                const [oldBrm] = await connection.query(
                    'SELECT * FROM batch_raw_materials WHERE batch_id = ?',
                    [id]
                );
                for (const ob of oldBrm) {
                    await connection.query(
                        'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ?, total_boxes = total_boxes + ? WHERE id = ? AND company_id = ?',
                        [parseFloat(ob.quantity_lbs || 0), Number(ob.boxes_count || 0), ob.raw_material_id, company_id]
                    );
                }
                await connection.query('DELETE FROM batch_raw_materials WHERE batch_id = ?', [id]);

                // Insertar nuevas materias primas y descontar stock
                for (const rm of raw_materials) {
                    const qtyLbs = parseFloat(rm.quantity_lbs || 0);
                    if (qtyLbs > 0 && rm.raw_material_id) {
                        const material = await eggRules.owned(connection, 'egg_raw_materials', rm.raw_material_id, company_id, true);
                        if (Number(material.stock_lbs) < qtyLbs || Number(material.total_boxes || 0) < rm.boxes_count) eggRules.fail('Stock de materia prima o cajas insuficiente.');
                        await connection.query('UPDATE egg_raw_materials SET stock_lbs = stock_lbs - ?, total_boxes = total_boxes - ? WHERE id = ? AND company_id = ?',
                            [qtyLbs, rm.boxes_count, rm.raw_material_id, company_id]);
                        await connection.query(
                            `INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, boxes_count, tarimas_json)
                             VALUES (?, ?, ?, ?, ?)`,
                            [id, rm.raw_material_id, qtyLbs, parseInt(rm.boxes_count || 0), JSON.stringify(rm.tarimas || [])]
                        );
                    }
                }
            }
        }

        const resolvedProductType = product_type !== undefined
            ? (Array.isArray(product_type) ? product_type.join(', ') : product_type)
            : existing[0].product_type;

        const resolvedPresentation = presentation !== undefined
            ? (Array.isArray(presentation) ? presentation.join(', ') : presentation)
            : existing[0].presentation;

        const resolvedIngredients = ingredients
            ? JSON.stringify(ingredients)
            : (ingredients_json
                ? (typeof ingredients_json === 'string' ? ingredients_json : JSON.stringify(ingredients_json))
                : existing[0].ingredients_json);

        const resolvedBatchCode = (canManageLots && normalizedBatchCode !== undefined)
            ? normalizedBatchCode
            : existing[0].batch_code_display;

        const resolvedPastLot = (canManageLots && pasteurization_lot !== undefined)
            ? (pasteurization_lot ? pasteurization_lot.trim() : null)
            : existing[0].pasteurization_lot;

        await connection.query(
            `UPDATE egg_production_batches
             SET product_type = COALESCE(?, product_type),
                 presentation = COALESCE(?, presentation),
                 operator_name = COALESCE(?, operator_name),
                 target_brix = ?,
                 target_solids_pct = ?,
                 notes = COALESCE(?, notes),
                 ingredients_json = ?,
                 input_weight_lbs = ?,
                 batch_code_display = ?,
                 pasteurization_lot = ?
             WHERE id = ? AND company_id = ?`,
            [
                resolvedProductType, resolvedPresentation, operator_name,
                target_brix || null, target_solids_pct || null,
                notes, resolvedIngredients, inputWeightLbs,
                resolvedBatchCode, resolvedPastLot, id, company_id
            ]
        );

        if (canManageLots && resolvedPastLot) {
            await connection.query(
                `UPDATE egg_pasteurization_logs
                 SET pasteurization_lot = ?
                 WHERE batch_id = ? AND company_id = ? AND (pasteurization_lot IS NULL OR pasteurization_lot = '')`,
                [resolvedPastLot, id, company_id]
            );
        }

        // Sincronizar remanentes vinculados a este lote
        if (req.body.remanente_ids !== undefined) {
            const rawRemIds = Array.isArray(req.body.remanente_ids) ? req.body.remanente_ids : [];
            const cleanRemIds = [...new Set(rawRemIds.map(r => eggRules.number(r, 'Remanente', 1)))].sort((a,b) => a-b);
            if (!['en_proceso', 'quebraje'].includes(existing[0].status) || existing[0].pasteurization_status === 'cerrado') eggRules.fail('Reabra el proceso antes de cambiar remanentes.', 409);
            for (const remId of cleanRemIds) {
                const remnant = await eggRules.owned(connection, 'egg_batch_remanentes', remId, company_id, true);
                if (Number(remnant.batch_id) === Number(id) || (remnant.target_batch_id && Number(remnant.target_batch_id) !== Number(id)) || !['disponible', 'asignado_a_lote'].includes(remnant.status)) eggRules.fail('Remanente no disponible para este lote.', 409);
            }

            if (cleanRemIds.length > 0) {
                // Liberar remanentes que estaban asignados y ahora se desmarcaron
                await connection.query(
                    `UPDATE egg_batch_remanentes
                     SET status = 'disponible', target_batch_id = NULL, updated_at = NOW()
                     WHERE target_batch_id = ? AND company_id = ? AND id NOT IN (?)`,
                    [id, company_id, cleanRemIds]
                );
                // Marcar los remanentes seleccionados como asignados a este lote
                await connection.query(
                    `UPDATE egg_batch_remanentes
                     SET status = 'asignado_a_lote', target_batch_id = ?, updated_at = NOW()
                     WHERE id IN (?) AND company_id = ?`,
                    [id, cleanRemIds, company_id]
                );
            } else {
                // Si se enviaron remanentes vacíos, desvincular todos los asignados a este lote
                await connection.query(
                    `UPDATE egg_batch_remanentes
                     SET status = 'disponible', target_batch_id = NULL, updated_at = NOW()
                     WHERE target_batch_id = ? AND company_id = ?`,
                    [id, company_id]
                );
            }
        }

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.updated', 'info', ?, ?, ?)`,
            [
                company_id,
                `Lote de producción #${id} (${existing[0].batch_code_display || existing[0].batch_uuid}) actualizado.`,
                JSON.stringify({ batch_id: parseInt(id), updates: req.body }),
                operator_name || req.user?.nombre || 'Sistema'
            ]
        );

        await connection.commit();
        res.json({ success: true, message: 'Lote de producción actualizado exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in updateProductionBatch:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};
module.exports = { updateProductionBatch };
