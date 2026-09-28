const { fail, number } = require('./eggRules.service');

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

module.exports = { selectPackaging, reserveItems, recordDispatch, isProductTypeCompatible, normalizePresentation };
