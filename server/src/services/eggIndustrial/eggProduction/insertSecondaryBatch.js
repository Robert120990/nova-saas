const crypto = require('crypto');
const calendarBatchSync = require('../eggPlanning/calendarBatchSync.service');

async function insertSecondaryBatch(connection, {
    company_id,
    branch_id,
    parentBatchId,
    raw_materials = [],
    scheduled_production_id = null,
    secondary_batch,
    totalInputWeight = 0,
    operator_name = 'Operador',
    dayOfYearStr,
    year2Digit,
    quebraje_inicio = null,
    quebraje_fin = null,
    egg_condition = 'Buenas',
    empaque_inicio = null,
    empaque_fin = null
}) {
    if (!secondary_batch || typeof secondary_batch !== 'object') return null;

    const secUuid = crypto.randomUUID();
    const secProductType = Array.isArray(secondary_batch.product_type)
        ? secondary_batch.product_type.join(', ')
        : (secondary_batch.product_type || 'huevo entero');

    const secPresentation = Array.isArray(secondary_batch.presentation)
        ? secondary_batch.presentation.join(', ')
        : (secondary_batch.presentation || 'cubeta 30LB');

    let secCode = secondary_batch.batch_code_display;
    if (!secCode || !secCode.trim()) {
        const secRun = String(secondary_batch.run_number || 2).padStart(2, '0');
        secCode = `LOTE ${secRun}-${dayOfYearStr}-${year2Digit}`;
    } else {
        secCode = secCode.trim();
        if (!/^LOTE\b/i.test(secCode)) secCode = `LOTE ${secCode}`;
    }

    const secSchedId = secondary_batch.scheduled_production_id
        ? parseInt(secondary_batch.scheduled_production_id, 10)
        : null;

    const [secResult] = await connection.query(
        `INSERT INTO egg_production_batches (
            company_id, branch_id, batch_uuid, batch_code_display, scheduled_production_id,
            parent_batch_id, is_coproduct, product_type, presentation, ingredients_json,
            status, input_weight_lbs, target_brix, target_solids_pct, operator_name,
            quebraje_inicio, quebraje_fin, egg_condition, empaque_inicio, empaque_fin
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'en_proceso', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            company_id, branch_id, secUuid, secCode, secSchedId,
            parentBatchId, secProductType, secPresentation,
            JSON.stringify(secondary_batch.ingredients_json || {}),
            totalInputWeight,
            secondary_batch.target_brix || null,
            secondary_batch.target_solids_pct || null,
            operator_name,
            secondary_batch.quebraje_inicio || quebraje_inicio || null,
            secondary_batch.quebraje_fin || quebraje_fin || null,
            secondary_batch.egg_condition || egg_condition || 'Buenas',
            secondary_batch.empaque_inicio || empaque_inicio || null,
            secondary_batch.empaque_fin || empaque_fin || null
        ]
    );

    const secBatchId = secResult.insertId;

    try {
        const resolvedSecSchedId = await calendarBatchSync.ensureSecondaryBatchSchedule(connection, {
            company_id,
            branch_id,
            secBatchId,
            secCode,
            secProductType,
            secPresentation,
            totalInputWeight,
            target_solids_pct: secondary_batch.target_solids_pct || null,
            ingredients_json: secondary_batch.ingredients_json || {},
            operator_name,
            parentSchedId: scheduled_production_id,
            secSchedId
        });

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'batch.linked_to_schedule', 'info', ?, ?, ?)`,
            [
                company_id,
                `Lote co-producto ${secCode} vinculado / programado en calendario #${resolvedSecSchedId}.`,
                JSON.stringify({ batch_id: secBatchId, scheduled_production_id: resolvedSecSchedId, parent_batch_id: parentBatchId, is_coproduct: true, batch_code_display: secCode }),
                operator_name
            ]
        );
    } catch (schedErr) {
        console.warn('[insertSecondaryBatch] Update egg_scheduled_productions error:', schedErr.message);
    }

    // Registrar materias primas compartidas (sin descontar inventario dos veces)
    for (const rm of raw_materials) {
        const qty = parseFloat(rm.quantity_lbs || 0);
        let boxes = parseInt(rm.boxes_count ?? rm.total_boxes ?? rm.boxes ?? 0, 10);
        if (isNaN(boxes) || boxes < 0) boxes = 0;
        if (boxes === 0 && Array.isArray(rm.tarimas) && rm.tarimas.length > 0) {
            boxes = rm.tarimas.reduce((sum, t) => sum + (parseInt(t.boxes_count || t.boxes || 0, 10) || 0), 0);
        }
        let taggedTarimas = rm.tarimas;
        if (Array.isArray(rm.tarimas) && rm.tarimas.length > 0) {
            taggedTarimas = rm.tarimas.map(t => ({
                ...t,
                is_initial: false,
                is_added: true
            }));
        }
        const tarimasJson = taggedTarimas && Array.isArray(taggedTarimas) ? JSON.stringify(taggedTarimas) : (rm.tarimas_json || null);

        await connection.query(
            'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, tarimas_json, boxes_count, is_shared) VALUES (?, ?, ?, ?, ?, 1)',
            [secBatchId, rm.raw_material_id, qty, tarimasJson, boxes]
        );
    }

    return {
        id: secBatchId,
        batch_uuid: secUuid,
        batch_code_display: secCode,
        product_type: secProductType,
        presentation: secPresentation
    };
}

module.exports = { insertSecondaryBatch };
