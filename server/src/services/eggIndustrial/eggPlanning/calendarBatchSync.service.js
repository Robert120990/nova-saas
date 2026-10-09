/**
 * calendarBatchSync.service.js
 * Servicio centralizado para sincronización bidireccional entre
 * Lotes de Producción (egg_production_batches) y Calendario (egg_scheduled_productions).
 */

async function reconcileSchedules(db, companyId) {
    if (!companyId) return;
    try {
        // 1. Vincular programaciones que coincidan con lotes existentes y actualizar sus estados
        await db.query(
            `UPDATE egg_scheduled_productions p
             JOIN egg_production_batches b ON (
                 b.company_id = p.company_id AND (
                     b.scheduled_production_id = p.id OR
                     p.batch_id = b.id OR
                     p.lot_code = b.batch_code_display COLLATE utf8mb4_unicode_ci OR
                     p.lot_code = CONCAT('LOTE ', b.batch_code_display) COLLATE utf8mb4_unicode_ci OR
                     b.batch_code_display COLLATE utf8mb4_unicode_ci = CONCAT('LOTE ', p.lot_code) OR
                     TRIM(REPLACE(b.batch_code_display COLLATE utf8mb4_unicode_ci, 'LOTE', '')) = TRIM(REPLACE(p.lot_code, 'LOTE', ''))
                 )
             )
             SET p.batch_id = b.id,
                 p.status = CASE
                     WHEN b.completed_at IS NOT NULL OR b.status IN ('completado', 'aprobado_calidad', 'congelado', 'empaquetado', 'pasteurizado') THEN 'completado'
                     WHEN b.status = 'cancelado' THEN 'cancelado'
                     ELSE 'en_proceso'
                 END
             WHERE p.company_id = ? AND (
                 p.batch_id IS NULL OR
                 p.batch_id != b.id OR
                 (p.status != 'completado' AND (b.completed_at IS NOT NULL OR b.status IN ('completado', 'aprobado_calidad', 'congelado', 'empaquetado', 'pasteurizado')))
             )`,
            [companyId]
        );

        // 2. Garantizar que cada lote tenga scheduled_production_id apuntando a su programación vinculada
        await db.query(
            `UPDATE egg_production_batches b
             JOIN egg_scheduled_productions p ON (p.company_id = b.company_id AND p.batch_id = b.id)
             SET b.scheduled_production_id = p.id
             WHERE b.company_id = ? AND (b.scheduled_production_id IS NULL OR b.scheduled_production_id != p.id)`,
            [companyId]
        );

        // 3. Crear automáticamente programaciones en el calendario para lotes que hayan sido iniciados en Planta sin programación previa
        const [orphanBatches] = await db.query(
            `SELECT b.* 
             FROM egg_production_batches b
             LEFT JOIN egg_scheduled_productions p ON (
                 p.company_id = b.company_id AND (
                     b.scheduled_production_id = p.id OR 
                     p.batch_id = b.id OR
                     p.lot_code = b.batch_code_display COLLATE utf8mb4_unicode_ci
                 )
             )
             WHERE b.company_id = ? AND p.id IS NULL`,
            [companyId]
        );

        for (const b of orphanBatches) {
            const isFinished = b.completed_at || ['completado', 'aprobado_calidad', 'congelado', 'empaquetado', 'pasteurizado'].includes(b.status);
            const schedStatus = isFinished ? 'completado' : (b.status === 'cancelado' ? 'cancelado' : 'en_proceso');
            const [insRes] = await db.query(
                `INSERT INTO egg_scheduled_productions (
                    company_id, branch_id, production_date, start_time, lot_code, product_profile,
                    presentation, target_quantity_lbs, target_solids_pct, status, priority,
                    batch_id, is_coproduct, suggestion_source, notes, created_by
                ) VALUES (?, ?, DATE(COALESCE(?, NOW())), TIME(COALESCE(?, NOW())), ?, ?, ?, ?, ?, ?, 'media', ?, ?, 'planta_directo', 'Auto-generado desde Producción en Planta', ?)`,
                [
                    companyId, b.branch_id || 1, b.started_at, b.started_at, b.batch_code_display || `LOTE-${b.id}`,
                    b.product_type || 'huevo entero', b.presentation || 'cubeta 30LB', b.input_weight_lbs || 0,
                    b.target_solids_pct || null, schedStatus, b.id, b.is_coproduct ? 1 : 0, b.operator_name || 'Producción'
                ]
            );
            await db.query('UPDATE egg_production_batches SET scheduled_production_id = ? WHERE id = ?', [insRes.insertId, b.id]);
        }
    } catch (err) {
        console.warn('[calendarBatchSync.reconcileSchedules] error:', err.message);
    }
}

async function ensureScheduleForDirectBatch(connection, {
    company_id,
    branch_id,
    batchId,
    batch_code_display,
    product_type,
    presentation,
    totalInputWeight,
    target_solids_pct,
    ingredients_json,
    operator_name,
    user_id,
    is_coproduct = false,
    parent_batch_id = null,
    scheduled_production_id = null
}) {
    let resolvedSchedId = scheduled_production_id;

    if (resolvedSchedId) {
        await connection.query(
            'UPDATE egg_scheduled_productions SET status = "en_proceso", batch_id = ? WHERE id = ? AND company_id = ?',
            [batchId, resolvedSchedId, company_id]
        );
        await connection.query(
            'UPDATE egg_production_batches SET scheduled_production_id = ? WHERE id = ?',
            [resolvedSchedId, batchId]
        );
        return resolvedSchedId;
    }

    const cleanLot = (batch_code_display || '').trim();
    const cleanNoPrefix = cleanLot.replace(/^LOTE\s*/i, '');
    const [matching] = await connection.query(
        `SELECT id FROM egg_scheduled_productions 
         WHERE company_id = ? AND (
             lot_code = ? OR
             lot_code = ? OR
             lot_code = ?
         ) AND batch_id IS NULL AND status != 'cancelado'
         ORDER BY id DESC LIMIT 1`,
        [company_id, cleanLot, cleanNoPrefix, `LOTE ${cleanNoPrefix}`]
    );

    if (matching.length > 0) {
        resolvedSchedId = matching[0].id;
        await connection.query(
            'UPDATE egg_scheduled_productions SET status = "en_proceso", batch_id = ? WHERE id = ? AND company_id = ?',
            [batchId, resolvedSchedId, company_id]
        );
    } else {
        let parentSchedId = null;
        if (parent_batch_id) {
            const [pb] = await connection.query(
                'SELECT scheduled_production_id FROM egg_production_batches WHERE id = ? AND company_id = ?',
                [parent_batch_id, company_id]
            );
            if (pb.length && pb[0].scheduled_production_id) parentSchedId = pb[0].scheduled_production_id;
        }

        const [insRes] = await connection.query(
            `INSERT INTO egg_scheduled_productions (
                company_id, branch_id, production_date, start_time, lot_code, product_profile,
                presentation, target_quantity_lbs, target_solids_pct, status, priority,
                mix_formula_json, assigned_operator_id, assigned_operator_name, batch_id,
                parent_production_id, is_coproduct, suggestion_source, notes, created_by
            ) VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, 'en_proceso', 'media', ?, ?, ?, ?, ?, ?, 'planta_directo', 'Auto-generado desde Producción en Planta', ?)`,
            [
                company_id,
                branch_id || 1,
                cleanLot,
                product_type || 'huevo entero',
                presentation || 'cubeta 30LB',
                totalInputWeight || 0,
                target_solids_pct || null,
                JSON.stringify(ingredients_json || {}),
                user_id || null,
                operator_name || 'Operador',
                batchId,
                parentSchedId,
                is_coproduct ? 1 : 0,
                operator_name || 'Producción'
            ]
        );
        resolvedSchedId = insRes.insertId;
    }

    await connection.query(
        'UPDATE egg_production_batches SET scheduled_production_id = ? WHERE id = ?',
        [resolvedSchedId, batchId]
    );

    return resolvedSchedId;
}

async function ensureSecondaryBatchSchedule(connection, {
    company_id,
    branch_id,
    secBatchId,
    secCode,
    secProductType,
    secPresentation,
    totalInputWeight,
    target_solids_pct = null,
    ingredients_json = {},
    operator_name,
    parentSchedId = null,
    secSchedId = null
}) {
    let resolvedId = secSchedId;
    const cleanLot = (secCode || '').trim();
    const cleanNoPrefix = cleanLot.replace(/^LOTE\s*/i, '');

    if (resolvedId) {
        await connection.query(
            'UPDATE egg_scheduled_productions SET status = "en_proceso", batch_id = ?, parent_production_id = COALESCE(parent_production_id, ?) WHERE id = ? AND company_id = ?',
            [secBatchId, parentSchedId, resolvedId, company_id]
        );
    } else {
        const [matching] = await connection.query(
            `SELECT id FROM egg_scheduled_productions 
             WHERE company_id = ? AND (lot_code = ? OR lot_code = ? OR lot_code = ?) AND batch_id IS NULL AND status != 'cancelado'
             ORDER BY id DESC LIMIT 1`,
            [company_id, cleanLot, cleanNoPrefix, `LOTE ${cleanNoPrefix}`]
        );

        if (matching.length > 0) {
            resolvedId = matching[0].id;
            await connection.query(
                'UPDATE egg_scheduled_productions SET status = "en_proceso", batch_id = ?, parent_production_id = COALESCE(parent_production_id, ?) WHERE id = ? AND company_id = ?',
                [secBatchId, parentSchedId, resolvedId, company_id]
            );
        } else {
            const [insRes] = await connection.query(
                `INSERT INTO egg_scheduled_productions (
                    company_id, branch_id, production_date, start_time, lot_code, product_profile,
                    presentation, target_quantity_lbs, target_solids_pct, status, priority,
                    mix_formula_json, assigned_operator_id, assigned_operator_name, batch_id,
                    parent_production_id, is_coproduct, suggestion_source, notes, created_by
                ) VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, 'en_proceso', 'media', ?, NULL, ?, ?, ?, 1, 'planta_directo', 'Auto-generado como Co-Producto desde Producción', ?)`,
                [
                    company_id,
                    branch_id || 1,
                    cleanLot,
                    secProductType,
                    secPresentation,
                    totalInputWeight || 0,
                    target_solids_pct || null,
                    JSON.stringify(ingredients_json || {}),
                    operator_name || 'Operador',
                    secBatchId,
                    parentSchedId,
                    operator_name || 'Producción'
                ]
            );
            resolvedId = insRes.insertId;
        }
    }

    await connection.query(
        'UPDATE egg_production_batches SET scheduled_production_id = ? WHERE id = ?',
        [resolvedId, secBatchId]
    );

    return resolvedId;
}

async function markScheduleCompleted(connection, {
    company_id,
    batchId,
    scheduled_production_id = null,
    batch_code_display = null
}) {
    if (!company_id) return;
    try {
        if (scheduled_production_id) {
            await connection.query(
                'UPDATE egg_scheduled_productions SET status = "completado", batch_id = COALESCE(batch_id, ?) WHERE id = ? AND company_id = ?',
                [batchId, scheduled_production_id, company_id]
            );
        }

        if (batchId) {
            await connection.query(
                'UPDATE egg_scheduled_productions SET status = "completado" WHERE batch_id = ? AND company_id = ?',
                [batchId, company_id]
            );
        }

        if (batch_code_display) {
            const cleanLot = batch_code_display.trim();
            const cleanNoPrefix = cleanLot.replace(/^LOTE\s*/i, '');
            await connection.query(
                `UPDATE egg_scheduled_productions 
                 SET status = "completado", batch_id = COALESCE(batch_id, ?)
                 WHERE company_id = ? AND (lot_code = ? OR lot_code = ? OR lot_code = ?)`,
                [batchId, company_id, cleanLot, cleanNoPrefix, `LOTE ${cleanNoPrefix}`]
            );
        }
    } catch (err) {
        console.warn('[calendarBatchSync.markScheduleCompleted] error:', err.message);
    }
}

async function handleBatchDeleted(connection, {
    company_id,
    batchId,
    scheduled_production_id
}) {
    if (!scheduled_production_id || !company_id) return;
    try {
        const [survivors] = await connection.query(
            'SELECT id, status, completed_at FROM egg_production_batches WHERE scheduled_production_id = ? AND id != ? AND company_id = ?',
            [scheduled_production_id, batchId, company_id]
        );
        if (survivors.length > 0) {
            const survivor = survivors[0];
            const isFinished = survivor.completed_at || ['completado', 'aprobado_calidad', 'congelado', 'empaquetado', 'pasteurizado'].includes(survivor.status);
            await connection.query(
                'UPDATE egg_scheduled_productions SET status = ?, batch_id = ? WHERE id = ? AND company_id = ?',
                [isFinished ? 'completado' : 'en_proceso', survivor.id, scheduled_production_id, company_id]
            );
        } else {
            const [sched] = await connection.query(
                'SELECT suggestion_source FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
                [scheduled_production_id, company_id]
            );
            if (sched[0]?.suggestion_source === 'planta_directo') {
                await connection.query(
                    'DELETE FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
                    [scheduled_production_id, company_id]
                );
            } else {
                await connection.query(
                    'UPDATE egg_scheduled_productions SET status = "programado", batch_id = NULL WHERE id = ? AND company_id = ?',
                    [scheduled_production_id, company_id]
                );
            }
        }
    } catch (err) {
        console.warn('[calendarBatchSync.handleBatchDeleted] error:', err.message);
    }
}

module.exports = {
    reconcileSchedules,
    ensureScheduleForDirectBatch,
    ensureSecondaryBatchSchedule,
    markScheduleCompleted,
    handleBatchDeleted
};
