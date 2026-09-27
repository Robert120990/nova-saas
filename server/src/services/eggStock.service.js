const { fail, number } = require('./eggRules.service');

async function selectPackaging(connection, companyId, item) {
    const id = item.packaging_id;
    const lot = item.original_lot_code || item.lot_code;
    const batch = item.batch_id;
    if (!id && !lot && !batch) fail('Cada partida industrial requiere un lote de empaque liberado.');
    const where = id ? 'pk.id = ?' : lot ? 'pk.lot_code = ?' : 'pk.batch_id = ? AND pk.product_type = ? AND pk.presentation = ?';
    const params = id ? [id] : lot ? [lot] : [batch, item.product_type, item.presentation];
    const [rows] = await connection.query(`SELECT pk.*, b.status AS batch_status FROM egg_packaging_records pk
        JOIN egg_production_batches b ON b.id = pk.batch_id AND b.company_id = pk.company_id
        WHERE pk.company_id = ? AND ${where} ORDER BY pk.expiry_date, pk.id FOR UPDATE`, [companyId, ...params]);
    if (rows.length !== 1) fail('Seleccione un empaque específico y válido de esta empresa.');
    const pkg = rows[0];
    if (pkg.quality_status !== 'liberado' || pkg.batch_status === 'bloqueado_haccp') fail('El lote no está liberado por calidad.', 409);
    const [validDate] = await connection.query('SELECT expiry_date >= CURDATE() AS valid FROM egg_packaging_records WHERE id = ? AND company_id = ?', [pkg.id, companyId]);
    if (!validDate[0]?.valid) fail('El lote está vencido o no tiene vencimiento.', 409);
    if (item.product_type && String(item.product_type).trim().toLowerCase() !== String(pkg.product_type).trim().toLowerCase()) fail('El producto no coincide con el empaque seleccionado.');
    const pounds = number(item.quantity_lbs ?? item.quantity, 'Libras de despacho', 0.001);
    const units = number(item.units ?? item.quantity_units ?? pounds / Number(pkg.weight_per_unit_lbs), 'Unidades', 0.001);
    if (!Number.isInteger(units) || Math.abs(units * Number(pkg.weight_per_unit_lbs) - pounds) > 0.01) fail('Unidades y libras no corresponden al peso del empaque.');
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
module.exports = { selectPackaging, reserveItems, recordDispatch };
