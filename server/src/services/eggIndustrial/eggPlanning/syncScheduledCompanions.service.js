/**
 * Sincroniza lotes secundarios / co-productos al actualizar una producción programada en el calendario
 */
async function syncScheduledCompanions(connection, {
    company_id,
    branch_id,
    masterProductionId,
    production_date,
    start_time,
    end_time,
    status,
    priority,
    assigned_operator_id,
    assigned_operator_name,
    created_by,
    secondary_lots = []
}) {
    if (!masterProductionId) return;

    // Obtener los co-productos actualmente vinculados a este lote padre
    const [existingCompanions] = await connection.query(
        'SELECT id, lot_code, status, batch_id FROM egg_scheduled_productions WHERE parent_production_id = ? AND company_id = ?',
        [masterProductionId, company_id]
    );

    const processedIds = new Set();

    for (let idx = 0; idx < (secondary_lots || []).length; idx++) {
        const sec = secondary_lots[idx];
        const isNumericId = typeof sec.id === 'number' || (typeof sec.id === 'string' && /^\d+$/.test(sec.id));
        const secId = isNumericId ? parseInt(sec.id, 10) : null;

        const secLotCode = sec.lot_code || `LOTE 0${idx + 2}-${production_date || '267'}`;
        const secProduct = sec.product_profile || 'Clara de Huevo Pasteurizada';
        const secPres = sec.presentation || 'cubeta 30LB';
        const secQty = parseFloat(sec.target_quantity_lbs) || 6000.00;
        const secSolids = parseFloat(sec.target_solids_pct) || (secProduct.toLowerCase().includes('clara') ? 11.50 : 21.50);
        const secMixJson = JSON.stringify(sec.mix_formula_json || {});
        const secNotes = sec.notes || `Co-producto en corrida multi-lote #${masterProductionId}.`;

        if (secId && existingCompanions.some(ec => ec.id === secId)) {
            // Actualizar co-producto existente
            await connection.query(
                `UPDATE egg_scheduled_productions SET
                    production_date = ?, start_time = ?, end_time = ?, lot_code = ?,
                    product_profile = ?, presentation = ?, target_quantity_lbs = ?,
                    target_solids_pct = ?, status = ?, priority = ?,
                    mix_formula_json = ?, assigned_operator_id = ?,
                    assigned_operator_name = ?, notes = ?
                 WHERE id = ? AND company_id = ?`,
                [
                    production_date,
                    start_time || '06:00:00',
                    end_time || '14:00:00',
                    secLotCode,
                    secProduct,
                    secPres,
                    secQty,
                    secSolids,
                    status || 'programado',
                    priority || 'media',
                    secMixJson,
                    assigned_operator_id || null,
                    assigned_operator_name || null,
                    secNotes,
                    secId,
                    company_id
                ]
            );
            processedIds.add(secId);
        } else {
            // Insertar nuevo co-producto
            const [insertRes] = await connection.query(
                `INSERT INTO egg_scheduled_productions (
                    company_id, branch_id, production_date, start_time, end_time,
                    lot_code, product_profile, presentation, target_quantity_lbs,
                    target_solids_pct, status, priority, mix_formula_json,
                    assigned_operator_id, assigned_operator_name, parent_production_id,
                    is_coproduct, suggestion_source, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'co-producto', ?, ?)`,
                [
                    company_id,
                    branch_id || null,
                    production_date,
                    start_time || '06:00:00',
                    end_time || '14:00:00',
                    secLotCode,
                    secProduct,
                    secPres,
                    secQty,
                    secSolids,
                    status || 'programado',
                    priority || 'media',
                    secMixJson,
                    assigned_operator_id || null,
                    assigned_operator_name || null,
                    masterProductionId,
                    secNotes,
                    created_by || 'Planificador'
                ]
            );
            processedIds.add(insertRes.insertId);
        }
    }

    // Si algún co-producto existente fue removido de la lista y aún no tiene lote real iniciado en planta, eliminarlo
    for (const ec of existingCompanions) {
        if (!processedIds.has(ec.id) && !ec.batch_id) {
            await connection.query(
                'DELETE FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
                [ec.id, company_id]
            );
        }
    }
}

module.exports = { syncScheduledCompanions };
