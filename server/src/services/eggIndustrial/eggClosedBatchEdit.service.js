const pool = require('../../config/db');
const eggRules = require('../eggRules.service');
const { hasPermission } = require('../eggAccess.service');
const { getRealRawEggMetrics } = require('./eggCostsSync.service');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const normStr = (v) => (v === undefined || v === null ? '' : String(v).trim());
const normTime = (v) => (v ? String(v).trim().slice(0, 5) : '');
const parseJsonSafe = (raw, fallback) => {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return fallback; }
};

const isBatchClosed = (batch) => Boolean(
    batch?.completed_at ||
    batch?.pasteurization_status === 'cerrado' ||
    !['en_proceso', 'quebraje'].includes(batch?.status)
);

const canEditClosedBatch = (req) => Boolean(
    req?.eggAccess?.superAdmin ||
    req?.user?.role === 'SuperAdmin' ||
    hasPermission(req?.eggAccess, 'manage_egg_closed_batch_edit')
);

const canManageLotsPerm = (req) => Boolean(
    canEditClosedBatch(req) ||
    hasPermission(req?.eggAccess, 'manage_egg_production_lots') ||
    hasPermission(req?.eggAccess, 'manage_production')
);

function estimateLiquidYield(inputWeightLbs, productType) {
    const pType = String(productType || '').toLowerCase();
    const factor = pType.includes('clara') ? 0.56 : pType.includes('yema') ? 0.32 : 0.87;
    return round2(Number(inputWeightLbs || 0) * factor);
}

function normalizeBatchCode(batchCodeDisplay) {
    if (batchCodeDisplay === undefined) return undefined;
    if (batchCodeDisplay && String(batchCodeDisplay).trim() !== '') {
        const raw = String(batchCodeDisplay).trim();
        return /^LOTE\b/i.test(raw) ? raw.replace(/^LOTE\s*/i, 'LOTE ') : `LOTE ${raw}`;
    }
    return null;
}

function simplifyMaterialsForCompare(list) {
    return (Array.isArray(list) ? list : [])
        .filter(m => m && m.raw_material_id)
        .map(m => ({
            raw_material_id: Number(m.raw_material_id),
            quantity_lbs: round2(m.quantity_lbs ?? m.weight_lbs ?? 0),
            boxes_count: parseInt(m.boxes_count ?? m.total_boxes ?? m.boxes ?? 0, 10) || 0,
            tarimas: (Array.isArray(m.tarimas) ? m.tarimas : [])
                .map(t => ({
                    tarima_number: parseInt(t.tarima_number || 0, 10) || 0,
                    boxes_count: parseInt(t.boxes_count || 0, 10) || 0,
                    quantity_lbs: round2(t.quantity_lbs || 0)
                }))
                .sort((a, b) => a.tarima_number - b.tarima_number)
        }))
        .sort((a, b) => a.raw_material_id - b.raw_material_id);
}

function areMaterialsEquivalent(currentRows, incomingNormalized) {
    const a = simplifyMaterialsForCompare(currentRows.map(r => ({
        ...r,
        tarimas: parseJsonSafe(r.tarimas_json, r.tarimas || [])
    })));
    const b = simplifyMaterialsForCompare(incomingNormalized);
    return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeIncomingRemanentes(body, currentAssigned) {
    if (body.remanente_ids === undefined && body.remanente_usages === undefined && body.remanente_items === undefined) {
        return {
            provided: false,
            items: currentAssigned.map(r => ({ id: r.id, used_lbs: round2(r.quantity_lbs) }))
        };
    }
    const rawRemIds = Array.isArray(body.remanente_ids) ? body.remanente_ids : [];
    const remanenteUsages = body.remanente_usages || {};
    const remanenteItems = Array.isArray(body.remanente_items) ? body.remanente_items : [];
    const allIds = [...new Set([
        ...rawRemIds.map(r => parseInt(r, 10)),
        ...remanenteItems.map(item => parseInt(item.id, 10)),
        ...Object.keys(remanenteUsages).map(k => parseInt(k, 10))
    ].filter(n => !isNaN(n) && n > 0))].sort((a, b) => a - b);

    const items = allIds.map(id => {
        const usageObj = remanenteUsages[id] || remanenteItems.find(it => parseInt(it.id, 10) === id);
        let requestedLbs = null;
        if (usageObj) {
            if (usageObj.used_lbs !== undefined && usageObj.used_lbs !== '' && usageObj.used_lbs !== null) {
                requestedLbs = Number(usageObj.used_lbs);
            } else if (usageObj.percentage !== undefined && usageObj.percentage !== '' && usageObj.percentage !== null) {
                requestedLbs = { pct: Number(usageObj.percentage) };
            } else if (usageObj.pct !== undefined && usageObj.pct !== '' && usageObj.pct !== null) {
                requestedLbs = { pct: Number(usageObj.pct) };
            }
        }
        return { id, requestedLbs };
    });

    return { provided: true, items };
}

async function findSiblingResidual(conn, companyId, remnant, lock = false) {
    const [rows] = await conn.query(
        `SELECT * FROM egg_batch_remanentes
         WHERE company_id = ? AND batch_id = ? AND status = 'disponible' AND target_batch_id IS NULL
           AND notes LIKE ?
         ORDER BY id DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
        [companyId, remnant.batch_id, `%Origen: REM-#${remnant.id})%`]
    );
    return rows[0] || null;
}

function cleanUsageNote(notes) {
    return String(notes || '').replace(/\s*\[Uso parcial:[^\]]*\]/gi, '').trim();
}

async function buildBatchEditPlan(conn, req, batchId, companyId, body, { lock = false } = {}) {
    const [batches] = await conn.query(
        `SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?${lock ? ' FOR UPDATE' : ''}`,
        [batchId, companyId]
    );
    if (!batches.length) eggRules.fail('Lote de producción no encontrado.', 404);
    const batch = batches[0];
    const closed = isBatchClosed(batch);
    const hasClosedPerm = canEditClosedBatch(req);
    const hasManageLots = canManageLotsPerm(req);

    const changes = [];
    const warnings = [];
    const blockingErrors = [];
    const remanentePlan = [];
    const remanenteImpacts = [];
    const materialImpacts = [];

    // 1. Validar códigos de lote y pasteurización
    const normalizedBatchCode = normalizeBatchCode(body.batch_code_display);
    if (normalizedBatchCode !== undefined && normalizedBatchCode !== batch.batch_code_display) {
        if (!hasManageLots) {
            blockingErrors.push('No tiene el permiso requerido para modificar el código del lote.');
        } else if (normalizedBatchCode) {
            const [dup] = await conn.query(
                'SELECT id FROM egg_production_batches WHERE batch_code_display = ? AND company_id = ? AND id != ?',
                [normalizedBatchCode, companyId, batchId]
            );
            if (dup.length) blockingErrors.push(`El código de lote "${normalizedBatchCode}" ya está asignado a otra producción.`);
        }
    }

    const resolvedBatchCode = (hasManageLots && normalizedBatchCode !== undefined)
        ? normalizedBatchCode
        : batch.batch_code_display;
    const resolvedPastLot = (hasManageLots && body.pasteurization_lot !== undefined)
        ? (body.pasteurization_lot ? String(body.pasteurization_lot).trim() : null)
        : batch.pasteurization_lot;

    const resolvedProductType = body.product_type !== undefined
        ? (Array.isArray(body.product_type) ? body.product_type.join(', ') : String(body.product_type))
        : batch.product_type;
    const resolvedPresentation = body.presentation !== undefined
        ? (Array.isArray(body.presentation) ? body.presentation.join(', ') : String(body.presentation))
        : batch.presentation;

    const trackField = (field, label, beforeVal, afterVal) => {
        if (normStr(beforeVal) !== normStr(afterVal)) {
            changes.push({ field, label, before: beforeVal ?? null, after: afterVal ?? null });
        }
    };

    trackField('batch_code_display', 'Código de Lote', batch.batch_code_display, resolvedBatchCode);
    trackField('pasteurization_lot', 'Lote Pasteurización', batch.pasteurization_lot, resolvedPastLot);
    trackField('product_type', 'Producto', batch.product_type, resolvedProductType);
    trackField('presentation', 'Presentación', batch.presentation, resolvedPresentation);
    if (body.operator_name !== undefined) trackField('operator_name', 'Operador', batch.operator_name, body.operator_name);
    if (body.notes !== undefined) trackField('notes', 'Notas', batch.notes, body.notes);
    if (body.egg_condition !== undefined) trackField('egg_condition', 'Condición de Huevo', batch.egg_condition, body.egg_condition);

    const checkTime = (field, label, nextVal) => {
        if (nextVal !== undefined && normTime(batch[field]) !== normTime(nextVal)) {
            changes.push({ field, label, before: batch[field] || null, after: nextVal || null });
        }
    };
    checkTime('quebraje_inicio', 'Inicio Quebraje', body.quebraje_inicio);
    checkTime('quebraje_fin', 'Fin Quebraje', body.quebraje_fin);
    checkTime('empaque_inicio', 'Inicio Empaque', body.empaque_inicio);
    checkTime('empaque_fin', 'Fin Empaque', body.empaque_fin);

    // Ingredientes
    const prevIngredients = parseJsonSafe(batch.ingredients_json, {});
    let nextIngredients = prevIngredients;
    if (body.ingredients !== undefined) nextIngredients = parseJsonSafe(body.ingredients, {});
    else if (body.ingredients_json !== undefined) nextIngredients = parseJsonSafe(body.ingredients_json, {});
    if (JSON.stringify(prevIngredients) !== JSON.stringify(nextIngredients)) {
        changes.push({ field: 'ingredients_json', label: 'Insumos / Receta', before: prevIngredients, after: nextIngredients });
    }

    // Balance de masas (editable explícitamente en rectificación de lote cerrado)
    const parseOptNum = (val, current) => (val === undefined || val === null || val === '' ? Number(current || 0) : round2(val));
    const nextYieldLiquid = parseOptNum(body.yield_liquid_lbs, batch.yield_liquid_lbs);
    const nextWasteShell = parseOptNum(body.waste_shell_lbs, batch.waste_shell_lbs);
    const nextWasteLoss = parseOptNum(body.waste_loss_lbs, batch.waste_loss_lbs);
    if (Math.abs(nextYieldLiquid - Number(batch.yield_liquid_lbs || 0)) > 0.01) {
        changes.push({ field: 'yield_liquid_lbs', label: 'Rendimiento Líquido (Lbs)', before: round2(batch.yield_liquid_lbs), after: nextYieldLiquid });
    }
    if (Math.abs(nextWasteShell - Number(batch.waste_shell_lbs || 0)) > 0.01) {
        changes.push({ field: 'waste_shell_lbs', label: 'Merma Cáscara (Lbs)', before: round2(batch.waste_shell_lbs), after: nextWasteShell });
    }
    if (Math.abs(nextWasteLoss - Number(batch.waste_loss_lbs || 0)) > 0.01) {
        changes.push({ field: 'waste_loss_lbs', label: 'Merma Proceso (Lbs)', before: round2(batch.waste_loss_lbs), after: nextWasteLoss });
    }

    // 2. Materias primas
    const [currentBrm] = await conn.query('SELECT * FROM batch_raw_materials WHERE batch_id = ?', [batchId]);
    const isCoproduct = Boolean(batch.is_coproduct || batch.parent_batch_id);
    let currentAllBrm = currentBrm;
    if (isCoproduct && batch.parent_batch_id) {
        const [parentBrm] = await conn.query('SELECT * FROM batch_raw_materials WHERE batch_id = ?', [batch.parent_batch_id]);
        currentAllBrm = [...parentBrm, ...currentBrm];
    }

    let rawMaterialsChanged = false;
    let normalizedIncomingMaterials = null;
    let nextInputWeight = round2(batch.input_weight_lbs);

    if (body.raw_materials !== undefined && Array.isArray(body.raw_materials) && body.raw_materials.length > 0) {
        normalizedIncomingMaterials = eggRules.normalizeMaterials(body.raw_materials);
        const matchesOwn = areMaterialsEquivalent(currentBrm, normalizedIncomingMaterials);
        const matchesAll = isCoproduct ? areMaterialsEquivalent(currentAllBrm, normalizedIncomingMaterials) : matchesOwn;
        if (!matchesOwn && !matchesAll) {
            if (isCoproduct) {
                blockingErrors.push('Las materias primas de un co-producto se administran desde el lote principal de la corrida compartida.');
            } else {
                rawMaterialsChanged = true;
                nextInputWeight = round2(normalizedIncomingMaterials.reduce((s, m) => s + Number(m.quantity_lbs || 0), 0));

                const prevMap = new Map();
                for (const ob of currentBrm) {
                    const ex = prevMap.get(ob.raw_material_id) || { lbs: 0, boxes: 0 };
                    ex.lbs += Number(ob.quantity_lbs || 0);
                    ex.boxes += parseInt(ob.boxes_count || 0, 10);
                    prevMap.set(ob.raw_material_id, ex);
                }
                const nextMap = new Map();
                for (const nm of normalizedIncomingMaterials) {
                    nextMap.set(nm.raw_material_id, { lbs: round2(nm.quantity_lbs), boxes: parseInt(nm.boxes_count || 0, 10) });
                }
                const touchedIds = [...new Set([...prevMap.keys(), ...nextMap.keys()])];
                for (const rmId of touchedIds) {
                    const prev = prevMap.get(rmId) || { lbs: 0, boxes: 0 };
                    const next = nextMap.get(rmId) || { lbs: 0, boxes: 0 };
                    const [rmRows] = await conn.query(
                        `SELECT id, provider_lot, egg_type, status, stock_lbs, total_boxes FROM egg_raw_materials WHERE id = ? AND company_id = ?${lock ? ' FOR UPDATE' : ''}`,
                        [rmId, companyId]
                    );
                    if (!rmRows.length) {
                        blockingErrors.push(`Materia prima #${rmId} no encontrada en la empresa.`);
                        continue;
                    }
                    const mat = rmRows[0];
                    if (next.lbs > 0 && mat.status !== 'aprobado') {
                        blockingErrors.push(`El lote de MP ${mat.provider_lot || rmId} no está aprobado.`);
                    }
                    const deltaLbs = round2(next.lbs - prev.lbs);
                    const deltaBoxes = next.boxes - prev.boxes;
                    const resultingStock = round2(Number(mat.stock_lbs || 0) - deltaLbs);
                    const resultingBoxes = Number(mat.total_boxes || 0) - deltaBoxes;
                    if (resultingStock < -0.01 || resultingBoxes < 0) {
                        blockingErrors.push(`Stock insuficiente en MP ${mat.provider_lot || rmId}: disponible ${round2(mat.stock_lbs)} Lbs (${mat.total_boxes} cjs), requiere ${deltaLbs} Lbs adicionales.`);
                    }
                    if (Math.abs(deltaLbs) > 0.01 || deltaBoxes !== 0) {
                        materialImpacts.push({
                            raw_material_id: rmId,
                            provider_lot: mat.provider_lot,
                            egg_type: mat.egg_type,
                            before_lbs: round2(prev.lbs),
                            after_lbs: round2(next.lbs),
                            delta_lbs: deltaLbs,
                            before_boxes: prev.boxes,
                            after_boxes: next.boxes,
                            stock_after_lbs: Math.max(0, resultingStock),
                            boxes_after: Math.max(0, resultingBoxes)
                        });
                    }
                }
                changes.push({
                    field: 'raw_materials',
                    label: 'Consumo de Materia Prima',
                    before: round2(batch.input_weight_lbs),
                    after: nextInputWeight
                });
            }
        }
    }

    // 3. Reconciliación completa de remanentes / reutilizables
    const [currentAssignedRems] = await conn.query(
        `SELECT * FROM egg_batch_remanentes WHERE target_batch_id = ? AND company_id = ?${lock ? ' FOR UPDATE' : ''}`,
        [batchId, companyId]
    );
    const incomingRem = normalizeIncomingRemanentes(body, currentAssignedRems);
    const incomingRemMap = new Map(incomingRem.items.map(it => [it.id, it]));
    const currentRemMap = new Map(currentAssignedRems.map(r => [r.id, r]));

    let nextRemanentesTotal = round2(currentAssignedRems.reduce((s, r) => s + Number(r.quantity_lbs || 0), 0));
    const beforeRemanentesTotal = nextRemanentesTotal;

    if (incomingRem.provided) {
        nextRemanentesTotal = 0;

        // A) Removidos del lote
        for (const rem of currentAssignedRems) {
            if (incomingRemMap.has(rem.id)) continue;
            const oldQty = round2(rem.quantity_lbs);
            const sibling = await findSiblingResidual(conn, companyId, rem, lock);
            const siblingQty = sibling ? round2(sibling.quantity_lbs) : 0;
            const restoredQty = round2(oldQty + siblingQty);

            remanentePlan.push({
                action: 'release',
                remnant: rem,
                sibling,
                oldQty,
                newQty: 0,
                restoredQty
            });
            remanenteImpacts.push({
                remanente_id: rem.id,
                code: `REM-#${rem.id}`,
                product_type: rem.product_type,
                action: 'liberado',
                before_lbs: oldQty,
                after_lbs: 0,
                delta_lbs: -oldQty,
                residual_effect: sibling
                    ? `Se fusiona con residual REM-#${sibling.id} (${siblingQty} Lbs) -> queda disponible ${restoredQty} Lbs.`
                    : `Se libera REM-#${rem.id} con ${oldQty} Lbs a inventario disponible.`
            });
        }

        // B & C) Conservados/modificados y nuevos asignados
        for (const item of incomingRem.items) {
            const existingRem = currentRemMap.get(item.id);
            if (existingRem) {
                const oldQty = round2(existingRem.quantity_lbs);
                const sibling = await findSiblingResidual(conn, companyId, existingRem, lock);
                const siblingQty = sibling ? round2(sibling.quantity_lbs) : 0;
                const maxEditable = round2(oldQty + siblingQty);

                let targetQty = oldQty;
                if (typeof item.requestedLbs === 'number') {
                    targetQty = round2(item.requestedLbs);
                } else if (item.requestedLbs && typeof item.requestedLbs.pct === 'number') {
                    targetQty = round2((maxEditable * item.requestedLbs.pct) / 100);
                }

                if (targetQty <= 0.01) {
                    const restoredQty = round2(oldQty + siblingQty);
                    remanentePlan.push({ action: 'release', remnant: existingRem, sibling, oldQty, newQty: 0, restoredQty });
                    remanenteImpacts.push({
                        remanente_id: existingRem.id,
                        code: `REM-#${existingRem.id}`,
                        product_type: existingRem.product_type,
                        action: 'liberado',
                        before_lbs: oldQty,
                        after_lbs: 0,
                        delta_lbs: -oldQty,
                        residual_effect: sibling
                            ? `Cantidad en 0: se fusiona con REM-#${sibling.id} (${restoredQty} Lbs disponibles).`
                            : `Cantidad en 0: vuelve a disponible con ${oldQty} Lbs.`
                    });
                    continue;
                }

                const delta = round2(targetQty - oldQty);
                nextRemanentesTotal = round2(nextRemanentesTotal + targetQty);

                if (Math.abs(delta) > 0.01) {
                    if (delta < 0) {
                        const returnQty = round2(Math.abs(delta));
                        const newSiblingQty = round2(siblingQty + returnQty);
                        remanentePlan.push({
                            action: 'reduce',
                            remnant: existingRem,
                            sibling,
                            oldQty,
                            newQty: targetQty,
                            returnQty,
                            newSiblingQty
                        });
                        remanenteImpacts.push({
                            remanente_id: existingRem.id,
                            code: `REM-#${existingRem.id}`,
                            product_type: existingRem.product_type,
                            action: 'reducido',
                            before_lbs: oldQty,
                            after_lbs: targetQty,
                            delta_lbs: delta,
                            residual_effect: sibling
                                ? `Devuelve ${returnQty} Lbs a residual REM-#${sibling.id} (nuevo saldo: ${newSiblingQty} Lbs).`
                                : `Crea saldo residual disponible por ${returnQty} Lbs.`
                        });
                    } else {
                        if (!sibling || delta > siblingQty + 0.01) {
                            blockingErrors.push(
                                `No es posible aumentar REM-#${existingRem.id} en ${delta.toFixed(2)} Lbs; el saldo residual disponible es ${siblingQty.toFixed(2)} Lbs.`
                            );
                        } else {
                            const siblingLeft = round2(siblingQty - delta);
                            remanentePlan.push({
                                action: 'increase',
                                remnant: existingRem,
                                sibling,
                                oldQty,
                                newQty: targetQty,
                                extraUsed: delta,
                                siblingLeft
                            });
                            remanenteImpacts.push({
                                remanente_id: existingRem.id,
                                code: `REM-#${existingRem.id}`,
                                product_type: existingRem.product_type,
                                action: 'aumentado',
                                before_lbs: oldQty,
                                after_lbs: targetQty,
                                delta_lbs: delta,
                                residual_effect: siblingLeft <= 0.05
                                    ? `Consume por completo el residual REM-#${sibling.id} (${siblingQty} Lbs).`
                                    : `Descuenta ${delta} Lbs de residual REM-#${sibling.id} (quedan ${siblingLeft} Lbs).`
                            });
                        }
                    }
                }
            } else {
                // Nuevo remanente asignado
                const remnant = await eggRules.owned(conn, 'egg_batch_remanentes', item.id, companyId, lock);
                if (Number(remnant.batch_id) === Number(batchId) || remnant.target_batch_id || remnant.status !== 'disponible') {
                    blockingErrors.push(`El remanente REM-#${item.id} no está disponible para asignarse a este lote.`);
                    continue;
                }
                const totalAvail = round2(remnant.quantity_lbs);
                let usedQty = totalAvail;
                if (typeof item.requestedLbs === 'number') usedQty = round2(item.requestedLbs);
                else if (item.requestedLbs && typeof item.requestedLbs.pct === 'number') {
                    usedQty = round2((totalAvail * item.requestedLbs.pct) / 100);
                }

                if (usedQty <= 0 || usedQty > totalAvail + 0.01) {
                    blockingErrors.push(`Cantidad solicitada (${usedQty} Lbs) inválida para REM-#${item.id} (disponible: ${totalAvail} Lbs).`);
                    continue;
                }
                const remainingQty = round2(totalAvail - usedQty);
                nextRemanentesTotal = round2(nextRemanentesTotal + usedQty);
                remanentePlan.push({
                    action: 'assign',
                    remnant,
                    oldQty: 0,
                    newQty: usedQty,
                    remainingQty,
                    totalAvail
                });
                remanenteImpacts.push({
                    remanente_id: remnant.id,
                    code: `REM-#${remnant.id}`,
                    product_type: remnant.product_type,
                    action: 'asignado',
                    before_lbs: 0,
                    after_lbs: usedQty,
                    delta_lbs: usedQty,
                    residual_effect: remainingQty > 0.05
                        ? `Genera saldo residual disponible de ${remainingQty} Lbs.`
                        : `Consumo total del remanente (${totalAvail} Lbs).`
                });
            }
        }
    }

    if (remanenteImpacts.length > 0) {
        changes.push({
            field: 'remanentes',
            label: 'Reutilizables / Remanentes Incorporados (Lbs)',
            before: beforeRemanentesTotal,
            after: nextRemanentesTotal
        });
    }

    // 4. Cálculos de afectaciones downstream (balance, envasado, costos)
    const [pkgRows] = await conn.query(
        'SELECT COUNT(*) as records_count, COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_lbs FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
        [batchId, companyId]
    );
    const packagedCount = Number(pkgRows[0]?.records_count || 0);
    const packagedLbs = round2(pkgRows[0]?.packaged_lbs || 0);

    const beforeYield = round2(batch.yield_liquid_lbs);
    const beforeInput = round2(batch.input_weight_lbs);
    const beforeYieldBasis = beforeYield > 0 ? beforeYield : estimateLiquidYield(beforeInput, batch.product_type);
    const afterYieldBasis = nextYieldLiquid > 0 ? nextYieldLiquid : estimateLiquidYield(nextInputWeight, resolvedProductType);

    const beforeTotalLiquid = round2(beforeYieldBasis + beforeRemanentesTotal);
    const afterTotalLiquid = round2(afterYieldBasis + nextRemanentesTotal);

    const beforeYieldPct = beforeInput > 0 ? round2((beforeYield / beforeInput) * 100) : 0;
    const afterYieldPct = nextInputWeight > 0 ? round2((nextYieldLiquid / nextInputWeight) * 100) : 0;

    const beforePkgEff = beforeTotalLiquid > 0 ? Math.min(100, round2((packagedLbs / beforeTotalLiquid) * 100)) : 0;
    const afterPkgEff = afterTotalLiquid > 0 ? Math.min(100, round2((packagedLbs / afterTotalLiquid) * 100)) : 0;
    const beforePkgLoss = round2(Math.max(0, beforeTotalLiquid - packagedLbs));
    const afterPkgLoss = round2(Math.max(0, afterTotalLiquid - packagedLbs));

    if (packagedLbs > afterTotalLiquid + 0.01) {
        warnings.push(
            `El peso ya envasado (${packagedLbs.toFixed(2)} Lbs) supera el líquido disponible resultante (${afterTotalLiquid.toFixed(2)} Lbs) por ${(packagedLbs - afterTotalLiquid).toFixed(2)} Lbs. Verifique si debe rectificar también el rendimiento líquido o el registro de envasado.`
        );
    }

    // Costeo industrial
    const rawMetrics = await getRealRawEggMetrics(companyId);
    const mpCostPerLb = rawMetrics.avg_lbs_per_box > 0 ? (rawMetrics.real_box_cost / rawMetrics.avg_lbs_per_box) : (38 / 47.88);
    const [indCostRows] = await conn.query(
        'SELECT * FROM egg_industrial_costs WHERE batch_id = ? AND company_id = ? LIMIT 1',
        [batchId, companyId]
    );
    const [varMpRows] = await conn.query(
        "SELECT id, amount FROM egg_batch_variable_costs WHERE batch_id = ? AND company_id = ? AND concept_name LIKE 'Materia Prima%' LIMIT 1",
        [batchId, companyId]
    );

    const calcScaledInd = (yieldRef, pkgMatCost) => {
        const scale = Math.max(0.25, Math.min(1.5, Number(yieldRef || 0) / 10000));
        const diesel = round2(86.28 * scale);
        const elec = round2(386.00 * scale);
        const water = round2(17.34 * scale);
        const labor = round2(Number(yieldRef || 0) * 0.05);
        const cip = round2(50.45 * scale);
        const quality = 25.00;
        const indTotal = round2(diesel + elec + water + labor + Number(pkgMatCost || 0) + cip + quality);
        return { diesel, elec, water, labor, cip, quality, indTotal };
    };

    const currentPkgCost = Number(indCostRows[0]?.packaging_materials_cost || 0);
    const currentIndTotal = indCostRows.length
        ? round2(Number(indCostRows[0].diesel_cost || 0) + Number(indCostRows[0].electricity_cost || 0) + Number(indCostRows[0].water_cost || 0) + Number(indCostRows[0].labor_cost || 0) + currentPkgCost + Number(indCostRows[0].chemicals_cip_cost || 0) + Number(indCostRows[0].quality_tests_cost || 0))
        : calcScaledInd(beforeYieldBasis, currentPkgCost).indTotal;

    const yieldChangedForCost = Math.abs(nextYieldLiquid - beforeYield) > 0.01;
    const afterScaledInd = yieldChangedForCost ? calcScaledInd(afterYieldBasis, currentPkgCost) : null;
    const afterIndTotal = afterScaledInd ? afterScaledInd.indTotal : currentIndTotal;

    const beforeMpCost = varMpRows.length
        ? round2(varMpRows[0].amount)
        : (isCoproduct ? round2(beforeYieldBasis * mpCostPerLb * 0.85) : round2(beforeInput * mpCostPerLb));
    const afterMpCost = (Math.abs(nextInputWeight - beforeInput) > 0.01 || (isCoproduct && yieldChangedForCost))
        ? (isCoproduct ? round2(afterYieldBasis * mpCostPerLb * 0.85) : round2(nextInputWeight * mpCostPerLb))
        : beforeMpCost;

    const beforeTotalCost = round2(beforeMpCost + currentIndTotal);
    const afterTotalCost = round2(afterMpCost + afterIndTotal);
    const beforeCostPerLb = beforeTotalLiquid > 0 ? round2(beforeTotalCost / beforeTotalLiquid) : 0;
    const afterCostPerLb = afterTotalLiquid > 0 ? round2(afterTotalCost / afterTotalLiquid) : 0;

    return {
        batch,
        is_closed: closed,
        has_permission: !closed || hasClosedPerm,
        can_edit_closed: hasClosedPerm,
        can_manage_lots: hasManageLots,
        has_changes: changes.length > 0,
        consumables_changed: rawMaterialsChanged || remanenteImpacts.length > 0,
        changes,
        warnings,
        blocking_errors: blockingErrors,
        remanente_plan: remanentePlan,
        remanente_impacts: remanenteImpacts,
        raw_materials_changed: rawMaterialsChanged,
        normalized_materials: normalizedIncomingMaterials,
        material_impacts: materialImpacts,
        resolved: {
            product_type: resolvedProductType,
            presentation: resolvedPresentation,
            batch_code_display: resolvedBatchCode,
            pasteurization_lot: resolvedPastLot,
            ingredients_json: JSON.stringify(nextIngredients || {}),
            input_weight_lbs: nextInputWeight,
            yield_liquid_lbs: nextYieldLiquid,
            waste_shell_lbs: nextWasteShell,
            waste_loss_lbs: nextWasteLoss
        },
        mass_balance: {
            input_weight_lbs: { before: beforeInput, after: nextInputWeight },
            remanentes_used_lbs: { before: beforeRemanentesTotal, after: nextRemanentesTotal },
            total_input_plus_rem_lbs: { before: round2(beforeInput + beforeRemanentesTotal), after: round2(nextInputWeight + nextRemanentesTotal) },
            yield_liquid_lbs: { before: beforeYield, after: nextYieldLiquid },
            total_available_liquid_lbs: { before: beforeTotalLiquid, after: afterTotalLiquid },
            yield_pct: { before: beforeYieldPct, after: afterYieldPct },
            waste_shell_lbs: { before: round2(batch.waste_shell_lbs), after: nextWasteShell },
            waste_loss_lbs: { before: round2(batch.waste_loss_lbs), after: nextWasteLoss }
        },
        packaging_impact: {
            records_count: packagedCount,
            packaged_lbs: packagedLbs,
            packaging_status: batch.packaging_status,
            efficiency_pct: { before: beforePkgEff, after: afterPkgEff },
            loss_lbs: { before: beforePkgLoss, after: afterPkgLoss }
        },
        costing_impact: {
            has_cost_record: indCostRows.length > 0,
            mp_cost: { before: beforeMpCost, after: afterMpCost },
            industrial_cost: { before: currentIndTotal, after: afterIndTotal },
            total_cost: { before: beforeTotalCost, after: afterTotalCost },
            cost_per_lb: { before: beforeCostPerLb, after: afterCostPerLb },
            scaled_ind_row: afterScaledInd,
            var_mp_row_id: varMpRows[0]?.id || null
        },
        downstream_notes: [
            'Disponibilidad de remanentes/reutilizables y saldos residuales para futuras corridas.',
            'Balance de masa líquido disponible vs. peso envasado en Empaque y Congelado.',
            'Trazabilidad 360° y exportaciones de Resumen de Lote (PDF / Excel / Word).',
            'Registro permanente en la bitácora de modificaciones del lote (Log de Auditoría).'
        ]
    };
}

async function previewBatchEdit(req, batchId, companyId, body) {
    const conn = await pool.getConnection();
    try {
        const plan = await buildBatchEditPlan(conn, req, batchId, companyId, body, { lock: false });
        return {
            batch_id: Number(batchId),
            batch_code_display: plan.batch.batch_code_display || plan.batch.batch_uuid,
            batch_status: plan.batch.status,
            pasteurization_status: plan.batch.pasteurization_status,
            packaging_status: plan.batch.packaging_status,
            is_closed: plan.is_closed,
            has_permission: plan.has_permission,
            has_changes: plan.has_changes,
            changes: plan.changes,
            remanente_impacts: plan.remanente_impacts,
            material_impacts: plan.material_impacts,
            mass_balance: plan.mass_balance,
            packaging_impact: plan.packaging_impact,
            costing_impact: {
                mp_cost: plan.costing_impact.mp_cost,
                industrial_cost: plan.costing_impact.industrial_cost,
                total_cost: plan.costing_impact.total_cost,
                cost_per_lb: plan.costing_impact.cost_per_lb
            },
            downstream_notes: plan.downstream_notes,
            warnings: plan.warnings,
            blocking_errors: plan.blocking_errors
        };
    } finally {
        conn.release();
    }
}

async function applyBatchEditInTransaction(connection, req, batchId, companyId, body) {
    const plan = await buildBatchEditPlan(connection, req, batchId, companyId, body, { lock: true });
    const { batch, is_closed, has_permission, has_changes, resolved } = plan;

    if (is_closed && !has_permission) {
        eggRules.fail(
            "Este lote ya está cerrado o finalizado. Solo los niveles autorizados con el permiso 'Editar Lotes Cerrados y Reutilizables' pueden modificarlo.",
            403
        );
    }

    if (plan.blocking_errors.length > 0) {
        eggRules.fail(plan.blocking_errors[0], 409);
    }

    const reason = String(body.edit_reason || '').trim();
    if (is_closed && has_changes && reason.length < 5) {
        eggRules.fail('Debe ingresar un motivo descriptivo (mínimo 5 caracteres) para registrar la modificación en el log de auditoría.', 400);
    }

    if (is_closed && plan.warnings.length > 0 && body.acknowledge_warnings !== true) {
        eggRules.fail(`${plan.warnings[0]} Confirme la advertencia de afectación para continuar.`, 409);
    }

    const operatorName = body.operator_name || req.user?.nombre || batch.operator_name || 'Sistema';

    // 1. Actualizar materias primas si cambiaron
    if (plan.raw_materials_changed && Array.isArray(plan.normalized_materials)) {
        const [oldBrm] = await connection.query('SELECT * FROM batch_raw_materials WHERE batch_id = ?', [batchId]);
        for (const ob of oldBrm) {
            await connection.query(
                'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ?, total_boxes = total_boxes + ? WHERE id = ? AND company_id = ?',
                [round2(ob.quantity_lbs), parseInt(ob.boxes_count || 0, 10), ob.raw_material_id, companyId]
            );
        }
        await connection.query('DELETE FROM batch_raw_materials WHERE batch_id = ?', [batchId]);
        for (const rm of plan.normalized_materials) {
            const qtyLbs = round2(rm.quantity_lbs);
            const boxes = parseInt(rm.boxes_count || 0, 10);
            if (qtyLbs > 0 && rm.raw_material_id) {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs - ?, total_boxes = total_boxes - ? WHERE id = ? AND company_id = ?',
                    [qtyLbs, boxes, rm.raw_material_id, companyId]
                );
                await connection.query(
                    `INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, boxes_count, tarimas_json)
                     VALUES (?, ?, ?, ?, ?)`,
                    [batchId, rm.raw_material_id, qtyLbs, boxes, JSON.stringify(rm.tarimas || [])]
                );
            }
        }
    }

    // 2. Actualizar cabecera de lote (metadatos + balance + eficiencia si hay empaque)
    const updatePackagingMetrics = plan.packaging_impact.records_count > 0 || batch.packaging_status === 'cerrado';
    const nextPkgLoss = updatePackagingMetrics ? plan.packaging_impact.loss_lbs.after : batch.packaging_loss_lbs;
    const nextPkgEff = updatePackagingMetrics ? plan.packaging_impact.efficiency_pct.after : batch.packaging_efficiency_pct;

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
             yield_liquid_lbs = ?,
             waste_shell_lbs = ?,
             waste_loss_lbs = ?,
             packaging_loss_lbs = ?,
             packaging_efficiency_pct = ?,
             batch_code_display = ?,
             pasteurization_lot = ?,
             quebraje_inicio = COALESCE(?, quebraje_inicio),
             quebraje_fin = COALESCE(?, quebraje_fin),
             egg_condition = COALESCE(?, egg_condition),
             empaque_inicio = COALESCE(?, empaque_inicio),
             empaque_fin = COALESCE(?, empaque_fin)
         WHERE id = ? AND company_id = ?`,
        [
            resolved.product_type,
            resolved.presentation,
            body.operator_name !== undefined ? body.operator_name : null,
            body.target_brix !== undefined ? (body.target_brix || null) : batch.target_brix,
            body.target_solids_pct !== undefined ? (body.target_solids_pct || null) : batch.target_solids_pct,
            body.notes !== undefined ? body.notes : null,
            resolved.ingredients_json,
            resolved.input_weight_lbs,
            resolved.yield_liquid_lbs,
            resolved.waste_shell_lbs,
            resolved.waste_loss_lbs,
            nextPkgLoss,
            nextPkgEff,
            resolved.batch_code_display,
            resolved.pasteurization_lot,
            body.quebraje_inicio !== undefined ? body.quebraje_inicio : null,
            body.quebraje_fin !== undefined ? body.quebraje_fin : null,
            body.egg_condition !== undefined ? body.egg_condition : null,
            body.empaque_inicio !== undefined ? body.empaque_inicio : null,
            body.empaque_fin !== undefined ? body.empaque_fin : null,
            batchId,
            companyId
        ]
    );

    if (plan.can_manage_lots && resolved.pasteurization_lot) {
        await connection.query(
            `UPDATE egg_pasteurization_logs
             SET pasteurization_lot = ?
             WHERE batch_id = ? AND company_id = ? AND (pasteurization_lot IS NULL OR pasteurization_lot = '')`,
            [resolved.pasteurization_lot, batchId, companyId]
        );
    }

    // Sincronizar merma automática de cascarón si cambió waste_shell_lbs
    if (Math.abs(resolved.waste_shell_lbs - round2(batch.waste_shell_lbs)) > 0.01) {
        await connection.query(
            `UPDATE egg_batch_waste_logs
             SET quantity_lbs = ?
             WHERE batch_id = ? AND company_id = ? AND stage = 'quebraje' AND waste_type = 'cascaron'`,
            [resolved.waste_shell_lbs, batchId, companyId]
        );
    }

    // 3. Ejecutar reconciliación de remanentes / reutilizables
    const lotLabel = resolved.batch_code_display || String(batchId);
    for (const step of plan.remanente_plan) {
        const { remnant, sibling } = step;
        if (step.action === 'release') {
            const baseNotes = cleanUsageNote(remnant.notes);
            const relNote = `${baseNotes ? baseNotes + ' | ' : ''}Liberado de Lote ${lotLabel}`;
            if (sibling) {
                await connection.query('DELETE FROM egg_batch_remanentes WHERE id = ? AND company_id = ?', [sibling.id, companyId]);
            }
            await connection.query(
                `UPDATE egg_batch_remanentes
                 SET quantity_lbs = ?, status = 'disponible', target_batch_id = NULL, notes = ?, updated_at = NOW()
                 WHERE id = ? AND company_id = ?`,
                [step.restoredQty, relNote, remnant.id, companyId]
            );
        } else if (step.action === 'reduce') {
            const totalBase = round2(step.newQty + step.newSiblingQty);
            const usedPct = totalBase > 0 ? ((step.newQty / totalBase) * 100).toFixed(1) : '100.0';
            const cleanBase = cleanUsageNote(remnant.notes);
            const updatedNote = `${cleanBase ? cleanBase + ' ' : ''}[Uso parcial: ${step.newQty} Lbs (${usedPct}%) en lote ${lotLabel}]`.trim();

            await connection.query(
                `UPDATE egg_batch_remanentes SET quantity_lbs = ?, notes = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                [step.newQty, updatedNote, remnant.id, companyId]
            );
            const sibNote = `Saldo remanente residual (${step.newSiblingQty} Lbs) tras ajuste en Lote ${lotLabel} (Origen: REM-#${remnant.id})`;
            if (sibling) {
                await connection.query(
                    `UPDATE egg_batch_remanentes SET quantity_lbs = ?, notes = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                    [step.newSiblingQty, sibNote, sibling.id, companyId]
                );
            } else {
                await connection.query(
                    `INSERT INTO egg_batch_remanentes
                     (company_id, batch_id, product_type, remanente_type, quantity_lbs, storage_location, status, notes, operator_name, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?, ?, NOW())`,
                    [companyId, remnant.batch_id, remnant.product_type, remnant.remanente_type, step.newSiblingQty, remnant.storage_location || 'Tanque Pulmón / Cámara', sibNote, operatorName]
                );
            }
        } else if (step.action === 'increase') {
            if (step.siblingLeft <= 0.05) {
                await connection.query('DELETE FROM egg_batch_remanentes WHERE id = ? AND company_id = ?', [sibling.id, companyId]);
                const cleanBase = cleanUsageNote(remnant.notes);
                await connection.query(
                    `UPDATE egg_batch_remanentes SET quantity_lbs = ?, notes = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                    [step.newQty, cleanBase || null, remnant.id, companyId]
                );
            } else {
                const totalBase = round2(step.newQty + step.siblingLeft);
                const usedPct = totalBase > 0 ? ((step.newQty / totalBase) * 100).toFixed(1) : '100.0';
                const cleanBase = cleanUsageNote(remnant.notes);
                const updatedNote = `${cleanBase ? cleanBase + ' ' : ''}[Uso parcial: ${step.newQty} Lbs (${usedPct}%) en lote ${lotLabel}]`.trim();
                await connection.query(
                    `UPDATE egg_batch_remanentes SET quantity_lbs = ?, notes = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                    [step.newQty, updatedNote, remnant.id, companyId]
                );
                const sibNote = `Saldo remanente residual (${step.siblingLeft} Lbs) tras ajuste en Lote ${lotLabel} (Origen: REM-#${remnant.id})`;
                await connection.query(
                    `UPDATE egg_batch_remanentes SET quantity_lbs = ?, notes = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                    [step.siblingLeft, sibNote, sibling.id, companyId]
                );
            }
        } else if (step.action === 'assign') {
            if (step.remainingQty <= 0.05) {
                await connection.query(
                    `UPDATE egg_batch_remanentes SET status = 'asignado_a_lote', target_batch_id = ?, updated_at = NOW() WHERE id = ? AND company_id = ?`,
                    [batchId, remnant.id, companyId]
                );
            } else {
                const usedPct = step.totalAvail > 0 ? ((step.newQty / step.totalAvail) * 100).toFixed(1) : '100.0';
                await connection.query(
                    `UPDATE egg_batch_remanentes
                     SET quantity_lbs = ?, status = 'asignado_a_lote', target_batch_id = ?,
                         notes = CONCAT(COALESCE(notes, ''), ' [Uso parcial: ', ?, ' Lbs (', ?, '%) en lote ', ?, ']'),
                         updated_at = NOW()
                     WHERE id = ? AND company_id = ?`,
                    [step.newQty, batchId, step.newQty, usedPct, lotLabel, remnant.id, companyId]
                );
                const residualNote = `Saldo remanente residual (${step.remainingQty} Lbs) tras uso parcial en Lote ${lotLabel} (Origen: REM-#${remnant.id})`;
                await connection.query(
                    `INSERT INTO egg_batch_remanentes
                     (company_id, batch_id, product_type, remanente_type, quantity_lbs, storage_location, status, notes, operator_name, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?, ?, NOW())`,
                    [companyId, remnant.batch_id, remnant.product_type, remnant.remanente_type, step.remainingQty, remnant.storage_location || 'Tanque Pulmón / Cámara', residualNote, operatorName]
                );
            }
        }
    }

    // 4. Actualizar costos si cambiaron input_weight_lbs o yield_liquid_lbs
    const { costing_impact } = plan;
    if (costing_impact.scaled_ind_row && costing_impact.has_cost_record) {
        const s = costing_impact.scaled_ind_row;
        await connection.query(
            `UPDATE egg_industrial_costs
             SET diesel_cost = ?, electricity_cost = ?, water_cost = ?, labor_cost = ?, chemicals_cip_cost = ?, quality_tests_cost = ?
             WHERE batch_id = ? AND company_id = ?`,
            [s.diesel, s.elec, s.water, s.labor, s.cip, s.quality, batchId, companyId]
        );
    }
    if (costing_impact.var_mp_row_id && Math.abs(costing_impact.mp_cost.after - costing_impact.mp_cost.before) > 0.01) {
        await connection.query(
            'UPDATE egg_batch_variable_costs SET amount = ? WHERE id = ? AND company_id = ?',
            [costing_impact.mp_cost.after, costing_impact.var_mp_row_id, companyId]
        );
    }

    // 5. Registrar log permanente de modificaciones y evento industrial
    let logId = null;
    if (has_changes && (is_closed || plan.consumables_changed)) {
        const impactsPayload = {
            remanentes: plan.remanente_impacts,
            raw_materials: plan.material_impacts,
            mass_balance: plan.mass_balance,
            packaging: plan.packaging_impact,
            costing: {
                mp_cost: costing_impact.mp_cost,
                industrial_cost: costing_impact.industrial_cost,
                total_cost: costing_impact.total_cost,
                cost_per_lb: costing_impact.cost_per_lb
            },
            warnings_acknowledged: plan.warnings
        };
        const [logRes] = await connection.query(
            `INSERT INTO egg_batch_modification_logs
             (company_id, batch_id, batch_code_display, batch_status_at_edit, was_closed, action_type, reason,
              edited_by_user_id, edited_by_name, edited_by_role, changes_json, impacts_json, before_snapshot_json, after_snapshot_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId,
                Number(batchId),
                lotLabel,
                batch.status,
                is_closed ? 1 : 0,
                is_closed ? 'closed_batch_edit' : 'consumption_edit',
                reason || 'Ajuste de consumo en lote en proceso',
                req.user?.id || null,
                req.user?.nombre || operatorName,
                req.user?.role || null,
                JSON.stringify(plan.changes),
                JSON.stringify(impactsPayload),
                JSON.stringify({ mass_balance: { input_weight_lbs: plan.mass_balance.input_weight_lbs.before, remanentes_used_lbs: plan.mass_balance.remanentes_used_lbs.before, yield_liquid_lbs: plan.mass_balance.yield_liquid_lbs.before } }),
                JSON.stringify({ mass_balance: { input_weight_lbs: plan.mass_balance.input_weight_lbs.after, remanentes_used_lbs: plan.mass_balance.remanentes_used_lbs.after, yield_liquid_lbs: plan.mass_balance.yield_liquid_lbs.after } })
            ]
        );
        logId = logRes.insertId;
    }

    await connection.query(
        `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            companyId,
            is_closed ? 'production.closed_batch_edited' : 'production.updated',
            is_closed ? 'warning' : 'info',
            is_closed
                ? `Lote cerrado #${batchId} (${lotLabel}) editado por ${req.user?.nombre || operatorName}. Motivo: ${reason}`
                : `Lote de producción #${batchId} (${lotLabel}) actualizado.`,
            JSON.stringify({ batch_id: Number(batchId), log_id: logId, changes: plan.changes, remanente_impacts: plan.remanente_impacts }),
            req.user?.nombre || operatorName
        ]
    );

    return {
        success: true,
        is_closed,
        log_id: logId,
        changes: plan.changes,
        impacts: {
            remanentes: plan.remanente_impacts,
            raw_materials: plan.material_impacts,
            mass_balance: plan.mass_balance,
            packaging: plan.packaging_impact
        },
        message: is_closed
            ? 'Lote cerrado actualizado con todas sus afectaciones y registrado en el log de modificaciones.'
            : 'Lote de producción actualizado exitosamente.'
    };
}

module.exports = {
    isBatchClosed,
    canEditClosedBatch,
    previewBatchEdit,
    applyBatchEditInTransaction
};
