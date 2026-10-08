const { eggRules, hasPermission, pool, notificationService } = require('../../../controllers/eggIndustrial/eggProduction/shared');
const { insertSecondaryBatch } = require('./insertSecondaryBatch');

const createProductionBatch = async (req) => {
    const responseHeaders = {};
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { product_type, presentation, operator_name } = req.body;
        let scheduled_production_id = req.body.scheduled_production_id ? parseInt(req.body.scheduled_production_id, 10) : null;
        let parent_batch_id = req.body.parent_batch_id ? parseInt(req.body.parent_batch_id, 10) : null;
        let is_coproduct = Boolean(req.body.is_coproduct || parent_batch_id);

        const company_id = req.company_id;
        let branch_id = req.body.branch_id || req.branch_id || req.user?.branch_id;
        if (!branch_id) {
            const [b] = await connection.query('SELECT id FROM branches WHERE company_id = ? ORDER BY id ASC LIMIT 1', [company_id]);
            branch_id = b[0]?.id;
        }
        if (branch_id) {
            await eggRules.owned(connection, 'branches', branch_id, company_id);
        }
        if (scheduled_production_id) {
            const schedule = await eggRules.owned(connection, 'egg_scheduled_productions', scheduled_production_id, company_id, true);
            if (schedule.status === 'cancelado') {
                eggRules.fail('La producción programada se encuentra cancelada.', 409);
            }
            if (schedule.batch_id || ['en_proceso', 'completado'].includes(schedule.status)) {
                // Ya existe lote en esta programación: se permite crear segundo lote / co-producto en la misma corrida
                is_coproduct = true;
                if (!parent_batch_id) parent_batch_id = schedule.batch_id;
            }
        }

        if (parent_batch_id && !scheduled_production_id) {
            const [pbRows] = await connection.query('SELECT scheduled_production_id FROM egg_production_batches WHERE id = ? AND company_id = ?', [parent_batch_id, company_id]);
            if (pbRows.length && pbRows[0].scheduled_production_id) scheduled_production_id = pbRows[0].scheduled_production_id;
        }

        let raw_materials = null;
        if (Array.isArray(req.body.raw_materials) && req.body.raw_materials.length > 0) {
            raw_materials = eggRules.normalizeMaterials(req.body.raw_materials);
        } else if (parent_batch_id) {
            const [pm] = await connection.query('SELECT raw_material_id, quantity_lbs, tarimas_json, boxes_count FROM batch_raw_materials WHERE batch_id = ?', [parent_batch_id]);
            if (pm?.length) raw_materials = eggRules.normalizeMaterials(pm);
        }

        if (!raw_materials || !Array.isArray(raw_materials) || raw_materials.length === 0) {
            return ({ status: 400, body: { message: 'Debe seleccionar al menos una materia prima.' }, headers: responseHeaders });
        }

        let totalInputWeight = raw_materials.reduce((sum, rm) => sum + parseFloat(rm.quantity_lbs || 0), 0);
        if (totalInputWeight <= 0 && parent_batch_id) {
            const [pb] = await connection.query('SELECT input_weight_lbs FROM egg_production_batches WHERE id = ? AND company_id = ?', [parent_batch_id, company_id]);
            if (pb.length && parseFloat(pb[0].input_weight_lbs || 0) > 0) totalInputWeight = parseFloat(pb[0].input_weight_lbs);
        }
        if (totalInputWeight <= 0) {
            return ({ status: 400, body: { message: 'El peso total de entrada debe ser mayor a cero.' }, headers: responseHeaders });
        }

        // Validate stock availability and MANDATORY APPROVAL STATUS for each raw material
        for (const rm of raw_materials) {
            const [rows] = await connection.query(
                'SELECT id, stock_lbs, total_boxes, egg_type, provider_lot, status FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE',
                [rm.raw_material_id, company_id]
            );
            if (rows.length === 0) {
                await connection.rollback();
                return ({ status: 400, body: { message: `Materia prima #${rm.raw_material_id} no encontrada.` }, headers: responseHeaders });
            }

            // --- REGLA CRÍTICA DE INOCUIDAD: SOLO MATERIA PRIMA APROBADA ---
            if (rows[0].status !== 'aprobado') {
                await connection.rollback();
                const statusLabel = rows[0].status === 'pendiente_aprobacion'
                    ? 'Pendiente de Aprobación'
                    : (rows[0].status ? rows[0].status.toUpperCase() : 'NO APROBADO');
                return ({ status: 400, body: {
                    message: `BLOQUEO DE INOCUIDAD: El lote de materia prima ${rows[0].provider_lot || '#' + rows[0].id} (${rows[0].egg_type}) no puede ser utilizado porque se encuentra en estado "${statusLabel}". Se requiere que el lote esté APROBADO por Control de Calidad antes de iniciar producción.`
                }, headers: responseHeaders });
            }
            if (!is_coproduct) {
                const currentStock = parseFloat(rows[0].stock_lbs || 0);
                if (currentStock <= 0.01) {
                    await connection.rollback();
                    return ({ status: 400, body: {
                        message: `El lote ${rows[0].provider_lot} (${rows[0].egg_type}) ya está 100% agotado y no tiene saldo disponible.`
                    }, headers: responseHeaders });
                }
                if (currentStock < rm.quantity_lbs || Number(rows[0].total_boxes || 0) < rm.boxes_count) {
                    await connection.rollback();
                    return ({ status: 400, body: {
                        message: `Stock insuficiente para lote ${rows[0].provider_lot} (disponible: ${currentStock.toFixed(2)} Lbs, solicitado: ${parseFloat(rm.quantity_lbs).toFixed(2)} Lbs).`
                    }, headers: responseHeaders });
                }
            }
        }

        const batch_uuid = require('crypto').randomUUID();
        const now = new Date();
        const yearFull = now.getFullYear();
        const year2Digit = String(yearFull).slice(-2);
        const dayOfYear = Math.floor((now.getTime() - new Date(yearFull, 0, 1).getTime()) / 86400000) + 1;
        const dayOfYearStr = String(dayOfYear).padStart(3, '0');

        // Consultar corridas registradas para este día juliano/año para autoincrementar correlativo de forma única
        const [existingRuns] = await connection.query(
            `SELECT batch_code_display FROM egg_production_batches
             WHERE company_id = ? AND (
                DATE(started_at) = CURDATE() OR
                batch_code_display LIKE ? OR
                batch_code_display LIKE ? OR
                batch_code_display LIKE ?
             )`,
            [company_id, `%-${dayOfYearStr}-${year2Digit}`, `% - ${dayOfYearStr} - ${year2Digit}`, `%LOTE%${dayOfYearStr}-${year2Digit}%`]
        );

        let maxRun = 0;
        for (const b of existingRuns) {
            if (b.batch_code_display) {
                const cleaned = b.batch_code_display.toUpperCase().replace(/^LOTE\s*/i, '').replace(/\s+/g, '');
                const parts = cleaned.split('-');
                if (parts.length === 3) {
                    const num = parseInt(parts[0], 10);
                    if (!isNaN(num) && num > maxRun) maxRun = num;
                }
            }
        }

        let chosenRun = maxRun + 1;
        if (req.body.run_number) {
            const userRun = parseInt(req.body.run_number, 10);
            const userTargetCode = `${String(userRun).padStart(2, '0')}-${dayOfYearStr}-${year2Digit}`;
            const collision = existingRuns.some(b => {
                const cleaned = (b.batch_code_display || '').toUpperCase().replace(/^LOTE\s*/i, '').replace(/\s+/g, '');
                return cleaned === userTargetCode;
            });
            if (!isNaN(userRun) && userRun > 0 && !collision) {
                chosenRun = userRun;
            }
        }

        const runNumber = String(chosenRun).padStart(2, '0');
        let batch_code_display;
        if (req.body.batch_code_display && req.body.batch_code_display.trim() !== '') {
            const raw = req.body.batch_code_display.trim();
            if (/^LOTE\b/i.test(raw)) {
                batch_code_display = raw.replace(/^LOTE\s*/i, 'LOTE ');
            } else {
                batch_code_display = `LOTE ${raw}`;
            }
        } else {
            batch_code_display = `LOTE ${runNumber}-${dayOfYearStr}-${year2Digit}`;
        }

        const resolvedProductType = Array.isArray(product_type)
            ? product_type.join(', ')
            : (product_type || 'huevo entero');

        const resolvedPresentation = Array.isArray(presentation)
            ? presentation.join(', ')
            : (presentation || 'cubeta 30LB');

        const { ingredients_json, target_brix, target_solids_pct } = req.body;

        let batchId;
        try {
            const [result] = await connection.query(
                `INSERT INTO egg_production_batches (
                    company_id, branch_id, batch_uuid, batch_code_display, scheduled_production_id, parent_batch_id, is_coproduct, product_type,
                    presentation, ingredients_json, status, input_weight_lbs,
                    target_brix, target_solids_pct, operator_name
                )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_proceso', ?, ?, ?, ?)`,
                [
                    company_id, branch_id, batch_uuid, batch_code_display, scheduled_production_id, parent_batch_id, is_coproduct ? 1 : 0, resolvedProductType,
                    resolvedPresentation, JSON.stringify(ingredients_json || {}), totalInputWeight,
                    target_brix || null, target_solids_pct || null, operator_name
                ]
            );
            batchId = result.insertId;
        } catch (insertErr) {
            console.warn("[createProductionBatch] Primary insert failed, falling back:", insertErr.message);
            const [result] = await connection.query(
                `INSERT INTO egg_production_batches (
                    company_id, branch_id, batch_uuid, batch_code_display, product_type,
                    presentation, ingredients_json, status, input_weight_lbs,
                    target_brix, target_solids_pct, operator_name
                )
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'en_proceso', ?, ?, ?, ?)`,
                [
                    company_id, branch_id, batch_uuid, batch_code_display, resolvedProductType,
                    resolvedPresentation, JSON.stringify(ingredients_json || {}), totalInputWeight,
                    target_brix || null, target_solids_pct || null, operator_name
                ]
            );
            batchId = result.insertId;
        }

        // Vincular remanentes utilizados en esta producción
        const rawRemIds = req.body.remanente_ids || (Array.isArray(req.body.remanentes) ? req.body.remanentes.map(r => r.id || r) : []);
        const remanenteIds = (Array.isArray(rawRemIds) ? rawRemIds : []).map(r => parseInt(r, 10)).filter(r => !isNaN(r) && r > 0);
        if (remanenteIds.length > 0) {
            for (const remId of remanenteIds) {
                const remnant = await eggRules.owned(connection, 'egg_batch_remanentes', remId, company_id, true);
                if (remnant.status !== 'disponible' || remnant.target_batch_id) eggRules.fail('El remanente ya está asignado o consumido.', 409);
                await connection.query(
                    `UPDATE egg_batch_remanentes
                     SET status = 'asignado_a_lote', target_batch_id = ?, updated_at = NOW()
                     WHERE id = ? AND company_id = ?`,
                    [batchId, remId, company_id]
                );
            }
        }

        // Insert batch_raw_materials and deduct stock (with tarimas breakdown support)
        for (const rm of raw_materials) {
            const qty = parseFloat(rm.quantity_lbs || 0);
            const boxes = parseInt(rm.boxes_count || rm.total_boxes || 0, 10);
            const tarimasJson = rm.tarimas && Array.isArray(rm.tarimas) ? JSON.stringify(rm.tarimas) : (rm.tarimas_json || null);

            try {
                await connection.query(
                    'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, tarimas_json, boxes_count, is_shared) VALUES (?, ?, ?, ?, ?, ?)',
                    [batchId, rm.raw_material_id, qty, tarimasJson, boxes, is_coproduct ? 1 : 0]
                );
            } catch (brmErr) {
                console.warn("[createProductionBatch] Insert into batch_raw_materials fallback:", brmErr.message);
                await connection.query(
                    'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs) VALUES (?, ?, ?)',
                    [batchId, rm.raw_material_id, qty]
                );
            }

            if (!is_coproduct) {
                const stockSql = boxes > 0
                    ? 'UPDATE egg_raw_materials SET stock_lbs = stock_lbs - ?, total_boxes = total_boxes - ? WHERE id = ? AND company_id = ?'
                    : 'UPDATE egg_raw_materials SET stock_lbs = stock_lbs - ? WHERE id = ? AND company_id = ?';
                await connection.query(stockSql, boxes > 0 ? [qty, boxes, rm.raw_material_id, req.company_id] : [qty, rm.raw_material_id, req.company_id]);
            }
        }

        // Si se vinculó a una producción programada del calendario, actualizar su estado y registrar evento
        if (scheduled_production_id) {
            try {
                await connection.query(
                    'UPDATE egg_scheduled_productions SET status = "en_proceso", batch_id = COALESCE(batch_id, ?) WHERE id = ? AND company_id = ?',
                    [batchId, scheduled_production_id, company_id]
                );

                await connection.query(
                    `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                     VALUES (?, 'batch.linked_to_schedule', 'info', ?, ?, ?)`,
                    [
                        company_id,
                        `Lote ${batch_code_display} vinculado a la producción programada #${scheduled_production_id}${is_coproduct ? ' (Segundo lote / Co-producto)' : ''}.`,
                        JSON.stringify({ batch_id: batchId, scheduled_production_id, parent_batch_id, is_coproduct, batch_code_display }),
                        operator_name
                    ]
                );
            } catch (schedErr) {
                console.warn("[createProductionBatch] Update egg_scheduled_productions notice:", schedErr.message);
            }
        }

        // Crear evento
        await connection.query(
            'INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name) VALUES (?, "production.started", "info", ?, ?, ?)',
            [company_id, `Iniciado lote oficial ${batch_code_display} (${product_type} - ${presentation}) con ${totalInputWeight} LBS.`, JSON.stringify({ batch_id: batchId, batch_uuid, batch_code_display, totalInputWeight, raw_materials }), operator_name]
        );

        const secInput = Array.isArray(req.body.secondary_batches) && req.body.secondary_batches.length > 0
            ? req.body.secondary_batches
            : (req.body.secondary_batch ? [req.body.secondary_batch] : []);

        const secondaryBatches = [];
        for (const secData of secInput) {
            const secCreated = await insertSecondaryBatch(connection, {
                company_id, branch_id, parentBatchId: batchId, raw_materials, scheduled_production_id,
                secondary_batch: secData, totalInputWeight, operator_name, dayOfYearStr, year2Digit
            });
            if (secCreated) secondaryBatches.push(secCreated);
        }

        await connection.commit();

        notificationService.notify('production_batch_created', req.company_id, req.body.branch_id || 1, {
            lote_id: batchId, producto: product_type || '', cantidad: totalInputWeight || 0, fecha: new Date().toISOString().split('T')[0], sucursal: ''
        }).catch(() => { });

        return ({ status: 201, body: {
            id: batchId,
            batch_uuid,
            batch_code_display,
            parent_batch_id,
            is_coproduct: Boolean(is_coproduct),
            product_type: resolvedProductType,
            presentation: resolvedPresentation,
            secondary_batch: secondaryBatches[0] || null,
            secondary_batches: secondaryBatches,
            status: 'en_proceso',
            totalInputWeight
        }, headers: responseHeaders });
    } catch (error) {
        await connection.rollback();
        return ({ status: error.status || 500, body: { message: error.message }, headers: responseHeaders });
    } finally {
        connection.release();
    }
};
module.exports = createProductionBatch;
