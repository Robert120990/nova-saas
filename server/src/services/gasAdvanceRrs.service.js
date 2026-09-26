const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');

/**
 * Synchronize a gas station customer advance with RRS cabecera_cxc table.
 * Runs silently without throwing errors to prevent disrupting Nova-SaaS operations.
 *
 * @param {number|string} advanceId - ID from gas_station_advances
 * @param {number|string} companyId - Company ID in Nova-SaaS
 * @param {'create'|'update'|'delete'} action - Operation performed
 * @param {object|null} fallbackData - Existing advance data (useful during delete)
 */
async function syncAdvanceToRrs(advanceId, companyId, action = 'create', fallbackData = null) {
    try {
        let branchId = null;
        let adv = null;

        if (action === 'delete') {
            branchId = fallbackData?.branch_id || null;
        } else {
            const [rows] = await pool.query(`
                SELECT a.*, c.nrc, c.nit, c.numero_documento, c.nombre AS customer_nombre
                FROM gas_station_advances a
                LEFT JOIN customers c ON a.cliente_id = c.id
                WHERE a.id = ? AND a.company_id = ?
            `, [advanceId, companyId]);

            if (rows.length === 0) {
                return;
            }
            adv = rows[0];
            branchId = adv.branch_id;
        }

        // Resolve rrs_id_empresa from gas_station_settings
        let settingsRows;
        if (branchId) {
            [settingsRows] = await pool.query(`
                SELECT setting_value FROM gas_station_settings
                WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL) AND setting_key = 'rrs_id_empresa'
                ORDER BY (branch_id IS NOT NULL) DESC
                LIMIT 1
            `, [companyId, branchId]);
        } else {
            [settingsRows] = await pool.query(`
                SELECT setting_value FROM gas_station_settings
                WHERE company_id = ? AND setting_key = 'rrs_id_empresa'
                ORDER BY (branch_id IS NULL) DESC, id ASC
                LIMIT 1
            `, [companyId]);
        }

        const rrsIdEmpresa = settingsRows[0]?.setting_value;
        if (!rrsIdEmpresa) {
            // RRS not configured for this branch/company
            return;
        }

        const rrs = getRrsPool();
        const rrsEmpresaFormatted = String(rrsIdEmpresa).padStart(3, '0');
        const cxcId = `${rrsEmpresaFormatted}-ADV-${String(advanceId).padStart(12, '0')}`;

        if (action === 'delete') {
            const likeId = `%-ADV-${String(advanceId).padStart(12, '0')}`;
            await rrs.query('DELETE FROM cabecera_cxc WHERE id = ? OR id LIKE ?', [cxcId, likeId]);
            return;
        }

        // Action is 'create' or 'update' -> Upsert into cabecera_cxc
        const nrc = String(adv.nrc || '').trim();
        const nit = String(adv.nit || '').trim();
        const doc = String(adv.numero_documento || '').trim();
        const name = String(adv.customer_nombre || adv.cliente_nombre || '').trim();

        let rrsClienteId = '';
        let rrsClienteNombre = name;

        // Search for existing client in RRS
        const [rrsClients] = await rrs.query(`
            SELECT id, codigo, nombre, id_empresa
            FROM clientes
            WHERE (
                (? != '' AND nrc = ?)
                OR (? != '' AND nit = ?)
                OR (? != '' AND (dui = ? OR nit = ?))
                OR (? != '' AND nombre = ?)
            )
            ORDER BY (id_empresa = ?) DESC
            LIMIT 1
        `, [nrc, nrc, nit, nit, doc, doc, doc, name, name, rrsIdEmpresa]);

        if (rrsClients.length > 0) {
            rrsClienteId = rrsClients[0].id || '';
            if (rrsClients[0].nombre) {
                rrsClienteNombre = rrsClients[0].nombre;
            }
        } else {
            // Si el cliente no se encuentra en RRS, solo se agrega codigo y nombre, no es necesario asignar id
            rrsClienteId = '';
        }

        // In 'codigo', place the client's NRC per explicit requirement
        const rrsCodigo = String(nrc || (rrsClients[0]?.codigo) || doc || nit || adv.cliente_id || '').trim().slice(0, 10);

        let fechaVal;
        if (adv.fecha instanceof Date) {
            fechaVal = adv.fecha.toISOString().slice(0, 10);
        } else if (typeof adv.fecha === 'string') {
            fechaVal = adv.fecha.slice(0, 10);
        } else {
            fechaVal = new Date().toISOString().slice(0, 10);
        }

        const documento = String(adv.numero || '').trim().slice(0, 10);
        const montoEfectivo = Math.round((parseFloat(adv.efectivo) || 0) * 100) / 100;
        const montoCheque = Math.round((parseFloat(adv.cheque) || 0) * 100) / 100;
        const montoRemesa = Math.round((parseFloat(adv.transferencia) || 0) * 100) / 100;
        const montoTarjeta = Math.round((parseFloat(adv.tarjeta) || 0) * 100) / 100;
        const montoTotal = Math.round((parseFloat(adv.monto) || 0) * 100) / 100;
        const chequeRef = String(adv.cheque_referencia || '').trim().slice(0, 10);
        const remesaRef = String(adv.transferencia_referencia || '').trim().slice(0, 10);
        const tarjetaRef = String(adv.tarjeta_referencia || '').trim().slice(0, 20);

        await rrs.query(`
            INSERT INTO cabecera_cxc (
                id, id_cliente, codigo, nombre, fecha, documento,
                monto_efectivo, monto_cheque, monto_remesa, monto_tarjeta, monto_total,
                banco_cheque, banco_remesa, cheque, remesa, banco_tarjeta,
                id_empresa, id_tipo_ingreso, galonaje, fec_copia
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, '02', 0, NOW())
            ON DUPLICATE KEY UPDATE
                id_cliente = VALUES(id_cliente),
                codigo = VALUES(codigo),
                nombre = VALUES(nombre),
                fecha = VALUES(fecha),
                documento = VALUES(documento),
                monto_efectivo = VALUES(monto_efectivo),
                monto_cheque = VALUES(monto_cheque),
                monto_remesa = VALUES(monto_remesa),
                monto_tarjeta = VALUES(monto_tarjeta),
                monto_total = VALUES(monto_total),
                banco_cheque = VALUES(banco_cheque),
                banco_remesa = VALUES(banco_remesa),
                cheque = VALUES(cheque),
                remesa = VALUES(remesa),
                banco_tarjeta = VALUES(banco_tarjeta),
                id_empresa = VALUES(id_empresa),
                id_tipo_ingreso = VALUES(id_tipo_ingreso),
                fec_copia = NOW()
        `, [
            cxcId,
            rrsClienteId,
            rrsCodigo,
            String(rrsClienteNombre).slice(0, 80),
            fechaVal,
            documento,
            montoEfectivo,
            montoCheque,
            montoRemesa,
            montoTarjeta,
            montoTotal,
            chequeRef,
            remesaRef,
            tarjetaRef,
            rrsIdEmpresa
        ]);
    } catch (err) {
        console.error(`[RRS Advance Sync] Error during ${action} for advance ${advanceId}:`, err.message);
    }
}

/**
 * Backfill / Synchronize all customer advances across all companies to RRS.
 *
 * @returns {Promise<{ total: number, synced: number, skipped: number, errors: number }>}
 */
async function syncAllAdvancesToRrs() {
    const summary = { total: 0, synced: 0, skipped: 0, errors: 0 };
    try {
        const [advances] = await pool.query(`
            SELECT id, company_id, branch_id, numero, fecha
            FROM gas_station_advances
            ORDER BY id ASC
        `);

        summary.total = advances.length;

        for (const adv of advances) {
            try {
                // Check if RRS company is configured
                let settingsRows;
                if (adv.branch_id) {
                    [settingsRows] = await pool.query(`
                        SELECT setting_value FROM gas_station_settings
                        WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL) AND setting_key = 'rrs_id_empresa'
                        ORDER BY (branch_id IS NOT NULL) DESC
                        LIMIT 1
                    `, [adv.company_id, adv.branch_id]);
                } else {
                    [settingsRows] = await pool.query(`
                        SELECT setting_value FROM gas_station_settings
                        WHERE company_id = ? AND setting_key = 'rrs_id_empresa'
                        ORDER BY (branch_id IS NULL) DESC, id ASC
                        LIMIT 1
                    `, [adv.company_id]);
                }

                if (!settingsRows[0]?.setting_value) {
                    summary.skipped++;
                    continue;
                }

                await syncAdvanceToRrs(adv.id, adv.company_id, 'update');
                summary.synced++;
            } catch (itemErr) {
                console.error(`[RRS Advance Sync] Error backfilling advance ${adv.id}:`, itemErr.message);
                summary.errors++;
            }
        }
    } catch (err) {
        console.error('[RRS Advance Sync] General error backfilling all advances:', err.message);
    }
    return summary;
}

module.exports = {
    syncAdvanceToRrs,
    syncAllAdvancesToRrs
};
