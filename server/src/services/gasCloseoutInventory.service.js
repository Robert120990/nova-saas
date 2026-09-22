const { getEffectiveProductId } = require('../utils/inventoryUtils');

/**
 * Applies inventory deduction for lubricants sold during a gas station shift closeout.
 * Creates 'SALIDA' movements in inventory_movements and decrements inventory.stock.
 * Idempotent: reverses any previous movements for this closeout before applying new ones.
 *
 * @param {Object} db - Database pool or connection
 * @param {number} companyId - Company ID
 * @param {number|string} closeoutId - Closeout ID
 */
async function applyCloseoutLubricantsInventory(db, companyId, closeoutId) {
    if (!db || !companyId || !closeoutId) return;

    try {
        // 1. Fetch closeout details
        const [closeoutRows] = await db.query(
            'SELECT id, company_id, branch_id, fecha_turno, numero_turno, estado FROM gas_station_closeouts WHERE id = ? AND company_id = ?',
            [closeoutId, companyId]
        );
        if (closeoutRows.length === 0) return;
        const closeout = closeoutRows[0];
        const branchId = closeout.branch_id;

        // 2. Revert any prior lubricant movements for this closeout (handles re-closing)
        await revertCloseoutLubricantsInventory(db, companyId, closeoutId);

        // 3. Query lubricant readings with sales > 0
        const [readings] = await db.query(
            `SELECT lr.producto_id, lr.producto_codigo, lr.ventas, lr.precio, p.costo
             FROM gas_station_closeout_lubricant_readings lr
             LEFT JOIN products p ON lr.producto_id = p.id
             WHERE lr.closeout_id = ? AND lr.ventas > 0`,
            [closeoutId]
        );

        if (readings.length === 0) return;

        const shiftDate = closeout.fecha_turno instanceof Date
            ? closeout.fecha_turno.toISOString().slice(0, 10)
            : String(closeout.fecha_turno).slice(0, 10);
        const nowTime = new Date().toTimeString().slice(0, 8);
        const movementDate = new Date(`${shiftDate}T${nowTime}`);

        // 4. Apply stock deduction for each lubricant sold
        for (const r of readings) {
            const qty = Math.round((parseFloat(r.ventas) || 0) * 10000) / 10000;
            if (qty <= 0) continue;

            let prodId = r.producto_id;
            let prodCosto = parseFloat(r.costo) || 0;

            if (!prodId && r.producto_codigo) {
                const [pRows] = await db.query(
                    'SELECT id, costo FROM products WHERE company_id = ? AND codigo = ? LIMIT 1',
                    [companyId, r.producto_codigo]
                );
                if (pRows.length > 0) {
                    prodId = pRows[0].id;
                    prodCosto = parseFloat(pRows[0].costo) || 0;
                }
            }

            if (!prodId) continue;

            const effectiveProductId = await getEffectiveProductId(db, prodId);

            // Deduct stock in inventory
            await db.query(`
                INSERT INTO inventory (company_id, product_id, branch_id, stock)
                VALUES (?, ?, ?, -?)
                ON DUPLICATE KEY UPDATE stock = stock - ?
            `, [companyId, effectiveProductId, branchId, qty, qty]);

            // Register movement in Kardex
            await db.query('INSERT INTO inventory_movements SET ?', [{
                company_id: companyId,
                branch_id: branchId,
                product_id: effectiveProductId,
                tipo_movimiento: 'SALIDA',
                cantidad: qty,
                costo: prodCosto,
                precio_venta: parseFloat(r.precio) || 0,
                tipo_documento: 'CIERRE_TURNO_LUBRICANTE',
                documento_id: closeoutId,
                created_at: movementDate
            }]);
        }
    } catch (err) {
        console.error(`[applyCloseoutLubricantsInventory] Error for closeout ${closeoutId}:`, err);
        throw err;
    }
}

/**
 * Reverts inventory deduction for lubricants when a closeout is reopened or deleted.
 *
 * @param {Object} db - Database pool or connection
 * @param {number} companyId - Company ID
 * @param {number|string} closeoutId - Closeout ID
 */
async function revertCloseoutLubricantsInventory(db, companyId, closeoutId) {
    if (!db || !companyId || !closeoutId) return;

    try {
        const [existingMovs] = await db.query(
            `SELECT product_id, branch_id, cantidad FROM inventory_movements 
             WHERE company_id = ? AND documento_id = ? AND tipo_documento = 'CIERRE_TURNO_LUBRICANTE'`,
            [companyId, closeoutId]
        );

        for (const m of existingMovs) {
            const qtyRestore = parseFloat(m.cantidad) || 0;
            if (qtyRestore > 0) {
                await db.query(
                    `UPDATE inventory SET stock = stock + ? WHERE company_id = ? AND branch_id = ? AND product_id = ?`,
                    [qtyRestore, companyId, m.branch_id, m.product_id]
                );
            }
        }

        if (existingMovs.length > 0) {
            await db.query(
                `DELETE FROM inventory_movements WHERE company_id = ? AND documento_id = ? AND tipo_documento = 'CIERRE_TURNO_LUBRICANTE'`,
                [companyId, closeoutId]
            );
        }
    } catch (err) {
        console.error(`[revertCloseoutLubricantsInventory] Error for closeout ${closeoutId}:`, err);
        throw err;
    }
}

module.exports = {
    applyCloseoutLubricantsInventory,
    revertCloseoutLubricantsInventory
};
