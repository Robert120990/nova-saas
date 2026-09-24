/**
 * FIFO Utility Functions for Gas Station Operations
 * Handles FIFO deduction and restoration for Advances and Trupput.
 */

/**
 * Deducts amount from available client advances using FIFO (oldest first).
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {number} companyId
 * @param {number} clienteId
 * @param {number|string} monto
 */
async function deductAdvanceByFIFO(db, companyId, clienteId, monto) {
    const [advances] = await db.query(
        `SELECT id, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? AND monto_disponible > 0 ORDER BY fecha ASC, id ASC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, parseFloat(adv.monto_disponible));
        await db.query(
            `UPDATE gas_station_advances SET monto_disponible = monto_disponible - ? WHERE id = ?`,
            [deduct, adv.id]
        );
        remaining -= deduct;
    }
}

/**
 * Restores amount to client advances using reverse FIFO (newest first).
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {number} companyId
 * @param {number} clienteId
 * @param {number|string} monto
 */
async function restoreAdvanceByFIFO(db, companyId, clienteId, monto) {
    const [advances] = await db.query(
        `SELECT id, monto, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? ORDER BY fecha DESC, id DESC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, parseFloat(adv.monto) - parseFloat(adv.monto_disponible));
        await db.query(
            `UPDATE gas_station_advances SET monto_disponible = monto_disponible + ? WHERE id = ?`,
            [restore, adv.id]
        );
        remaining -= restore;
    }
}

/**
 * Deducts gallons from available client Trupput deposits using FIFO (oldest first).
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {number} companyId
 * @param {number} clienteId
 * @param {number|string} galones
 */
async function deductTrupputByFIFO(db, companyId, clienteId, galones) {
    const [trupput] = await db.query(
        `SELECT id, galones_disponibles FROM gas_station_trupput WHERE company_id = ? AND cliente_id = ? AND galones_disponibles > 0 ORDER BY fecha ASC, id ASC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(galones);
    for (const t of trupput) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, parseFloat(t.galones_disponibles));
        await db.query(
            `UPDATE gas_station_trupput SET galones_disponibles = galones_disponibles - ? WHERE id = ?`,
            [deduct, t.id]
        );
        remaining -= deduct;
    }
}

/**
 * Restores gallons to client Trupput deposits using reverse FIFO (newest first).
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {number} companyId
 * @param {number} clienteId
 * @param {number|string} galones
 */
async function restoreTrupputByFIFO(db, companyId, clienteId, galones) {
    const [trupput] = await db.query(
        `SELECT id, galones, galones_disponibles FROM gas_station_trupput WHERE company_id = ? AND cliente_id = ? ORDER BY fecha DESC, id DESC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(galones);
    for (const t of trupput) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, parseFloat(t.galones) - parseFloat(t.galones_disponibles));
        await db.query(
            `UPDATE gas_station_trupput SET galones_disponibles = galones_disponibles + ? WHERE id = ?`,
            [restore, t.id]
        );
        remaining -= restore;
    }
}

module.exports = {
    deductAdvanceByFIFO,
    restoreAdvanceByFIFO,
    deductTrupputByFIFO,
    restoreTrupputByFIFO
};
