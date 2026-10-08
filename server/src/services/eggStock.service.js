const { fail, number } = require('./eggRules.service');
const { resolveEggCatalogProduct } = require('../utils/eggProductResolver');

function normalizePresentation(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isProductTypeCompatible(typeA, typeB) {
    if (!typeA || !typeB) return true;
    const a = String(typeA).trim().toLowerCase();
    const b = String(typeB).trim().toLowerCase();
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const isEntero = (s) => s.includes('entero') || s.includes('rapido') || s.includes('rápido');
    const isClara = (s) => s.includes('clara');
    const isYema = (s) => s.includes('yema');
    const isFormula = (s) => s.includes('formula') || s.includes('fórmula') || s.includes('mezcla') || s.includes('formulad');
    if (isEntero(a) && isEntero(b)) return true;
    if (isClara(a) && isClara(b)) return true;
    if (isYema(a) && isYema(b)) return true;
    if (isFormula(a) && isFormula(b)) return true;
    return false;
}

async function selectPackaging(connection, companyId, item) {
    const id = item.packaging_id;
    const lot = (item.original_lot_code || item.lot_code || '').trim();
    const batch = item.batch_id;
    const pres = (item.presentation || '').trim();
    const cleanPres = normalizePresentation(pres);

    if (!id && !lot && !batch) fail('Cada partida industrial requiere un lote de empaque liberado.');

    let rows = [];

    // 1. Prioridad: Buscar por ID directo de registro de empaque
    if (id) {
        [rows] = await connection.query(`SELECT pk.*, b.status AS batch_status FROM egg_packaging_records pk
            JOIN egg_production_batches b ON b.id = pk.batch_id AND b.company_id = pk.company_id
            WHERE pk.company_id = ? AND pk.id = ? ORDER BY pk.expiry_date, pk.id FOR UPDATE`, [companyId, id]);
    }

    // 2. Si no se encontró por ID directo y viene código de lote, buscar por pk.lot_code exacto
    if (rows.length === 0 && lot) {
        [rows] = await connection.query(`SELECT pk.*, b.status AS batch_status FROM egg_packaging_records pk
            JOIN egg_production_batches b ON b.id = pk.batch_id AND b.company_id = pk.company_id
            WHERE pk.company_id = ? AND pk.lot_code = ? ORDER BY pk.expiry_date, pk.id FOR UPDATE`, [companyId, lot]);
    }

    // 3. Si no se encontró por lot_code de empaque (ej. lot es código de batch 'LOTE 01-265-26' o viene batch_id),
    // buscar entre los empaques del lote de producción filtrando por presentación
    if (rows.length === 0 && (batch || lot)) {
        const cleanLot = lot.replace(/^LOTE\s+/i, '').replace(/^LOT-/i, '').replace(/\s+/g, '');
        const [candidates] = await connection.query(`
            SELECT pk.*, b.status AS batch_status FROM egg_packaging_records pk
            JOIN egg_production_batches b ON b.id = pk.batch_id AND b.company_id = pk.company_id
            WHERE pk.company_id = ?
              AND (
                  (? IS NOT NULL AND pk.batch_id = ?)
                  OR (? != '' AND (
                      b.batch_code_display = ?
                      OR b.pasteurization_lot = ?
                      OR pk.lot_code = ?
                      OR pk.lot_code LIKE CONCAT('%', ?, '%')
                      OR b.batch_code_display LIKE CONCAT('%', ?, '%')
                  ))
              )
            ORDER BY pk.expiry_date ASC, pk.id ASC
            FOR UPDATE
        `, [
            companyId,
            batch || null, batch || 0,
            lot, lot, lot, lot, cleanLot, cleanLot
        ]);

        if (candidates.length > 0) {
            let matched = candidates;
            if (cleanPres) {
                const presFiltered = candidates.filter(r => {
                    const rPres = normalizePresentation(r.presentation);
                    return rPres === cleanPres || rPres.includes(cleanPres) || cleanPres.includes(rPres);
                });
                if (presFiltered.length > 0) matched = presFiltered;
            }

            if (item.product_type) {
                const prodFiltered = matched.filter(r => isProductTypeCompatible(item.product_type, r.product_type));
                if (prodFiltered.length > 0) matched = prodFiltered;
            }

            rows = matched.slice(0, 1);
        }
    }

    if (rows.length !== 1) {
        fail('Seleccione un empaque específico y válido de esta empresa.');
    }

    const pkg = rows[0];
    if (pkg.quality_status !== 'liberado' || pkg.batch_status === 'bloqueado_haccp') {
        fail('El lote no está liberado por calidad.', 409);
    }

    const [validDate] = await connection.query('SELECT expiry_date >= CURDATE() AS valid FROM egg_packaging_records WHERE id = ? AND company_id = ?', [pkg.id, companyId]);
    if (!validDate[0]?.valid) fail('El lote está vencido o no tiene vencimiento.', 409);

    if (item.product_type && !isProductTypeCompatible(item.product_type, pkg.product_type)) {
        fail('El producto no coincide con el empaque seleccionado.');
    }

    const pounds = number(item.quantity_lbs ?? item.quantity, 'Libras de despacho', 0.001);
    const pkgWeight = Number(pkg.weight_per_unit_lbs) || 30;
    const units = number(item.units ?? item.quantity_units ?? pounds / pkgWeight, 'Unidades', 0.001);
    if (!Number.isInteger(units) || Math.abs(units * pkgWeight - pounds) > 0.05) {
        fail('Unidades y libras no corresponden al peso del empaque.');
    }

    return { pkg, units, pounds };
}

async function reserveItems(connection, companyId, items) {
    const selected = [];
    // All callers serialize the route; packaging locks also prevent concurrent sales in other routes.
    for (const item of items) selected.push(await selectPackaging(connection, companyId, item));
    const grouped = new Map();
    for (const row of selected) {
        const previous = grouped.get(row.pkg.id) || { ...row, units: 0, pounds: 0 };
        previous.units += row.units; previous.pounds += row.pounds;
        grouped.set(row.pkg.id, previous);
    }
    for (const { pkg, units, pounds } of grouped.values()) {
        if (units > Number(pkg.units_packaged) - Number(pkg.dispatched_units || 0) || pounds > Number(pkg.total_batch_weight_lbs) - Number(pkg.dispatched_weight_lbs || 0) + 0.01) fail('Existencias insuficientes para el despacho.', 409);
    }
    return [...grouped.values()];
}

async function recordDispatch(connection, companyId, saleId, selection) {
    for (const { pkg, units, pounds } of selection) {
        const [existing] = await connection.query('SELECT id FROM egg_packaging_movements WHERE company_id = ? AND sale_id = ? AND packaging_id = ?', [companyId, saleId, pkg.id]);
        if (existing.length) continue;
        const [result] = await connection.query(`UPDATE egg_packaging_records SET dispatched_units = dispatched_units + ?,
            dispatched_weight_lbs = dispatched_weight_lbs + ? WHERE id = ? AND company_id = ?
            AND units_packaged - dispatched_units >= ? AND total_batch_weight_lbs - dispatched_weight_lbs >= ?`,
        [units, pounds, pkg.id, companyId, units, pounds]);
        if (result.affectedRows !== 1) fail('El saldo cambió durante el despacho. Vuelva a consultar.', 409);
        await connection.query(`INSERT INTO egg_packaging_movements (company_id, packaging_id, sale_id, units, weight_lbs)
            VALUES (?, ?, ?, ?, ?)`, [companyId, pkg.id, saleId, units, pounds]);
    }
}

async function getEffectiveBranchId(connection, companyId, preferredBranchId) {
    if (preferredBranchId) {
        const [rows] = await connection.query('SELECT id FROM branches WHERE id = ? AND company_id = ? LIMIT 1', [preferredBranchId, companyId]);
        if (rows.length > 0) return rows[0].id;
    }
    const [defRows] = await connection.query('SELECT id FROM branches WHERE company_id = ? ORDER BY es_casa_matriz DESC, id ASC LIMIT 1', [companyId]);
    return defRows[0]?.id || null;
}

async function recordPackagingStock(connection, companyId, packagingId, recordData, unitsToRecord) {
    const units = Number(unitsToRecord !== undefined ? unitsToRecord : recordData.units_packaged || 0);
    if (!Number.isFinite(units) || units <= 0) return null;
    const branchId = await getEffectiveBranchId(connection, companyId, recordData.branch_id);
    if (!branchId) return null;

    let productId = recordData.product_id;
    let productCost = 0;
    if (!productId) {
        const resolved = await resolveEggCatalogProduct(connection, companyId, recordData.product_type, recordData.presentation, { autoCreate: true, branchId });
        productId = resolved?.catalog_product_id || null;
        productCost = resolved?.cost || 0;
    }
    if (!productId) return null;

    if (!productCost || productCost === 0) {
        const [pRows] = await connection.query('SELECT costo FROM products WHERE id = ? LIMIT 1', [productId]);
        productCost = Number(pRows[0]?.costo || 0);
    }

    await connection.query('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES (?, ?)', [productId, branchId]);
    await connection.query(
        `INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE stock = stock + ?`,
        [companyId, branchId, productId, units, units]
    );
    await connection.query(
        `INSERT INTO inventory_movements (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, precio_venta, tipo_documento, documento_id, created_at)
         VALUES (?, ?, ?, 'ENTRADA', ?, ?, 0, 'ENVASADO_INDUSTRIAL', ?, NOW())`,
        [companyId, branchId, productId, units, productCost, packagingId]
    );
    await connection.query('UPDATE egg_packaging_records SET product_id = ?, branch_id = ? WHERE id = ? AND company_id = ?', [productId, branchId, packagingId, companyId]).catch(() => {});
    return { productId, branchId, units, cost: productCost };
}

async function revertPackagingStock(connection, companyId, packagingId, recordData, unitsToRevert, reason = 'ANULACION_ENVASADO') {
    const units = Number(unitsToRevert !== undefined ? unitsToRevert : recordData.units_packaged || 0);
    if (!Number.isFinite(units) || units <= 0) return null;
    const branchId = await getEffectiveBranchId(connection, companyId, recordData.branch_id);
    if (!branchId) return null;

    let productId = recordData.product_id;
    if (!productId) {
        const resolved = await resolveEggCatalogProduct(connection, companyId, recordData.product_type, recordData.presentation);
        productId = resolved?.catalog_product_id || null;
    }
    if (!productId) return null;

    let productCost = 0;
    const [pRows] = await connection.query('SELECT costo FROM products WHERE id = ? LIMIT 1', [productId]);
    productCost = Number(pRows[0]?.costo || 0);

    await connection.query(
        `INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, -?)
         ON DUPLICATE KEY UPDATE stock = stock - ?`,
        [companyId, branchId, productId, units, units]
    );
    await connection.query(
        `INSERT INTO inventory_movements (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, precio_venta, tipo_documento, documento_id, created_at)
         VALUES (?, ?, ?, 'SALIDA', ?, ?, 0, ?, ?, NOW())`,
        [companyId, branchId, productId, units, productCost, reason, packagingId]
    );
    return { productId, branchId, units, cost: productCost };
}

async function adjustPackagingStock(connection, companyId, packagingId, oldData, newData) {
    const branchId = await getEffectiveBranchId(connection, companyId, newData.branch_id || oldData.branch_id);
    if (!branchId) return null;

    let oldProductId = oldData.product_id;
    if (!oldProductId) {
        const resolvedOld = await resolveEggCatalogProduct(connection, companyId, oldData.product_type, oldData.presentation);
        oldProductId = resolvedOld?.catalog_product_id || null;
    }
    let newProductId = newData.product_id;
    if (!newProductId) {
        const resolvedNew = await resolveEggCatalogProduct(connection, companyId, newData.product_type, newData.presentation, { autoCreate: true, branchId });
        newProductId = resolvedNew?.catalog_product_id || null;
    }

    const oldUnits = Number(oldData.units_packaged || 0);
    const newUnits = Number(newData.units_packaged || 0);

    if (oldProductId && newProductId && oldProductId !== newProductId) {
        if (oldUnits > 0) await revertPackagingStock(connection, companyId, packagingId, { ...oldData, product_id: oldProductId, branch_id: branchId }, oldUnits, 'AJUSTE_ENVASADO');
        if (newUnits > 0) await recordPackagingStock(connection, companyId, packagingId, { ...newData, product_id: newProductId, branch_id: branchId }, newUnits);
    } else {
        const targetProductId = newProductId || oldProductId;
        if (!targetProductId) return null;

        let cost = 0;
        const [pRows] = await connection.query('SELECT costo FROM products WHERE id = ? LIMIT 1', [targetProductId]);
        cost = Number(pRows[0]?.costo || 0);

        const delta = newUnits - oldUnits;
        if (delta > 0) {
            await connection.query('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES (?, ?)', [targetProductId, branchId]);
            await connection.query(`INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock = stock + ?`, [companyId, branchId, targetProductId, delta, delta]);
            await connection.query(`INSERT INTO inventory_movements (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, precio_venta, tipo_documento, documento_id, created_at) VALUES (?, ?, ?, 'ENTRADA', ?, ?, 0, 'AJUSTE_ENVASADO', ?, NOW())`, [companyId, branchId, targetProductId, delta, cost, packagingId]);
        } else if (delta < 0) {
            const absDelta = Math.abs(delta);
            await connection.query(`INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, -?) ON DUPLICATE KEY UPDATE stock = stock - ?`, [companyId, branchId, targetProductId, absDelta, absDelta]);
            await connection.query(`INSERT INTO inventory_movements (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, precio_venta, tipo_documento, documento_id, created_at) VALUES (?, ?, ?, 'SALIDA', ?, ?, 0, 'AJUSTE_ENVASADO', ?, NOW())`, [companyId, branchId, targetProductId, absDelta, cost, packagingId]);
        }
    }

    if (newProductId || branchId) {
        await connection.query('UPDATE egg_packaging_records SET product_id = ?, branch_id = ? WHERE id = ? AND company_id = ?', [newProductId || oldProductId || null, branchId, packagingId, companyId]).catch(() => {});
    }
    return { oldProductId, newProductId, branchId, oldUnits, newUnits };
}

module.exports = {
    selectPackaging, reserveItems, recordDispatch, isProductTypeCompatible, normalizePresentation,
    getEffectiveBranchId, recordPackagingStock, revertPackagingStock, adjustPackagingStock
};

