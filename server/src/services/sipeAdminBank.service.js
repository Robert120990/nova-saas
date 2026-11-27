const pool = require('../config/db');
const { getSipeAdminPool } = require('../config/sipeAdminDb');

const pad2 = (n) => String(n).padStart(2, '0');

function toIsoDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
    }
    const str = String(val).trim();
    const dmy = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    return null;
}

function isRowContabilizado(row) {
    return Boolean(
        row && (
            row.es_contabilizado == 1 ||
            row.es_contabilizado === 'S' ||
            (row.num_partida && String(row.num_partida).trim() !== '')
        )
    );
}

async function resolveSipeAdminAccount(conn, accountRef) {
    const raw = String(accountRef || '').trim();
    const clean = raw.replace(/\s/g, '');
    const last4 = clean.slice(-4);
    if (!clean) throw new Error('Cuenta bancaria no válida para db_sipe_admin');

    const queries = [
        ['SELECT id, empresa_id, numero, cod_cta FROM cuentas_bancarias WHERE numero = ? ORDER BY activa DESC, id DESC LIMIT 1', [raw]],
        ['SELECT id, empresa_id, numero, cod_cta FROM cuentas_bancarias WHERE REPLACE(numero, " ", "") = ? ORDER BY activa DESC, id DESC LIMIT 1', [clean]]
    ];
    if (last4.length === 4) {
        queries.push(['SELECT id, empresa_id, numero, cod_cta FROM cuentas_bancarias WHERE numero LIKE ? ORDER BY activa DESC, id DESC LIMIT 1', [`%${last4}`]]);
    }

    for (const [sql, params] of queries) {
        const [rows] = await conn.query(sql, params);
        if (rows.length > 0) return rows[0];
    }
    throw new Error(`No se encontró cuenta bancaria en db_sipe_admin para "${raw}"`);
}

async function resolveTipoRemesaId(conn, empresaId, codigo, fallbackCodigo = null) {
    const [rows] = await conn.query('SELECT id FROM tipos_remesas WHERE empresa_id = ? AND codigo = ? LIMIT 1', [empresaId, codigo]);
    if (rows[0]?.id) return rows[0].id;
    if (fallbackCodigo) {
        const [fb] = await conn.query('SELECT id FROM tipos_remesas WHERE empresa_id = ? AND codigo = ? LIMIT 1', [empresaId, fallbackCodigo]);
        if (fb[0]?.id) return fb[0].id;
    }
    return null;
}

async function upsertSyncMap({ sourceType, sourceId, parentId = null, companyId = null, table, sipeAdminId, cuentaBancariaId = null, documento = null }) {
    await pool.query(
        `INSERT INTO sipe_admin_bank_sync_map
            (source_type, source_id, parent_id, company_id, sipe_admin_table, sipe_admin_id, cuenta_bancaria_id, documento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            parent_id = VALUES(parent_id), company_id = VALUES(company_id),
            sipe_admin_table = VALUES(sipe_admin_table), sipe_admin_id = VALUES(sipe_admin_id),
            cuenta_bancaria_id = VALUES(cuenta_bancaria_id), documento = VALUES(documento)`,
        [sourceType, String(sourceId), parentId ? String(parentId) : null, companyId, table, sipeAdminId, cuentaBancariaId, documento]
    );
}

async function upsertSipeAdminMovement(conn, {
    sourceType, sourceId, parentId = null, companyId, cuenta, tipoRemesaId,
    fechaIso, fechaAplicadoIso = null, documento, concepto, monto, cargo, abono
}) {
    const docTrim = String(documento || '').slice(0, 100);
    const conceptTrim = String(concepto || '').slice(0, 255);
    let existing = null;

    const [mapped] = await pool.query(
        `SELECT sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = ? AND source_id = ? AND sipe_admin_table = 'movimientos_bancarios' LIMIT 1`,
        [sourceType, String(sourceId)]
    );
    if (mapped[0]?.sipe_admin_id) {
        const [rows] = await conn.query('SELECT id, num_partida, es_contabilizado FROM movimientos_bancarios WHERE id = ? LIMIT 1', [mapped[0].sipe_admin_id]);
        existing = rows[0] || null;
    }
    if (!existing && fechaIso) {
        const [fb] = await conn.query(
            `SELECT id, num_partida, es_contabilizado FROM movimientos_bancarios
             WHERE cuenta_bancaria_id = ? AND documento = ? AND fecha = ? AND concepto = ? LIMIT 1`,
            [cuenta.id, docTrim, fechaIso, conceptTrim]
        );
        existing = fb[0] || null;
    }

    if (existing) {
        await conn.query(
            `UPDATE movimientos_bancarios
             SET empresa_id = ?, cuenta_bancaria_id = ?, fecha = ?, fecha_aplicado = COALESCE(?, fecha_aplicado),
                 documento = ?, concepto = ?, monto = ?, cargo = ?, abono = ?, tipo_remesa_id = ?
             WHERE id = ?`,
            [cuenta.empresa_id, cuenta.id, fechaIso, fechaAplicadoIso, docTrim, conceptTrim, monto, cargo, abono, tipoRemesaId, existing.id]
        );
        await upsertSyncMap({
            sourceType, sourceId, parentId, companyId,
            table: 'movimientos_bancarios', sipeAdminId: existing.id, cuentaBancariaId: cuenta.id, documento: docTrim
        });
        return { action: 'updated', id: existing.id };
    }

    const [ins] = await conn.query(
        `INSERT INTO movimientos_bancarios
            (empresa_id, cuenta_bancaria_id, fecha, fecha_aplicado, documento, concepto, monto, cargo, abono, tipo_remesa_id, num_partida, cod_cta, es_contabilizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0)`,
        [cuenta.empresa_id, cuenta.id, fechaIso, fechaAplicadoIso, docTrim, conceptTrim, monto, cargo, abono, tipoRemesaId]
    );
    await upsertSyncMap({
        sourceType, sourceId, parentId, companyId,
        table: 'movimientos_bancarios', sipeAdminId: ins.insertId, cuentaBancariaId: cuenta.id, documento: docTrim
    });
    return { action: 'inserted', id: ins.insertId };
}

async function deleteUnpostedMovementById(conn, sipeAdminId) {
    const [rows] = await conn.query('SELECT id, num_partida, es_contabilizado FROM movimientos_bancarios WHERE id = ? LIMIT 1', [sipeAdminId]);
    if (rows[0] && !isRowContabilizado(rows[0])) {
        await conn.query('DELETE FROM movimientos_bancarios WHERE id = ?', [sipeAdminId]);
        return true;
    }
    return rows.length === 0;
}

async function syncGasRemesaToSipeAdmin({ delivery, companyId, rawAccount, montoTotal, remesasExtra = [], documento, concepto }) {
    const sipePool = getSipeAdminPool();
    const cuenta = await resolveSipeAdminAccount(sipePool, rawAccount);
    const tipoRemesaId = await resolveTipoRemesaId(sipePool, cuenta.empresa_id, '01', 'RM');
    const fechaIso = toIsoDate(delivery.fecha);
    if (!fechaIso) throw new Error('Fecha inválida para sincronizar remesa a db_sipe_admin');

    let mainResult = null;
    if (montoTotal > 0) {
        mainResult = await upsertSipeAdminMovement(sipePool, {
            sourceType: 'gas_remesa', sourceId: String(delivery.id), companyId, cuenta, tipoRemesaId,
            fechaIso, fechaAplicadoIso: null, documento, concepto,
            monto: montoTotal.toFixed(2), cargo: montoTotal.toFixed(2), abono: '0.00'
        });
    } else {
        const [mapped] = await pool.query(
            `SELECT id, sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = 'gas_remesa' AND source_id = ?`,
            [String(delivery.id)]
        );
        for (const m of mapped) {
            if (await deleteUnpostedMovementById(sipePool, m.sipe_admin_id)) {
                await pool.query('DELETE FROM sipe_admin_bank_sync_map WHERE id = ?', [m.id]);
            }
        }
    }

    const [prevExtras] = await pool.query(
        `SELECT id, source_id, sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = 'gas_remesa_extra' AND parent_id = ?`,
        [String(delivery.id)]
    );
    const activeExtraIds = new Set();
    const extraResults = [];

    for (const extra of remesasExtra) {
        const montoExtra = parseFloat(extra.monto) || 0;
        if (montoExtra <= 0) continue;
        const extraKey = String(extra.id);
        activeExtraIds.add(extraKey);
        const conceptoExtra = String(extra.descripcion || 'OTRAS REMESAS').trim().toUpperCase().slice(0, 255);
        const res = await upsertSipeAdminMovement(sipePool, {
            sourceType: 'gas_remesa_extra', sourceId: extraKey, parentId: String(delivery.id),
            companyId, cuenta, tipoRemesaId, fechaIso, fechaAplicadoIso: null, documento,
            concepto: conceptoExtra, monto: montoExtra.toFixed(2), cargo: montoExtra.toFixed(2), abono: '0.00'
        });
        extraResults.push(res);
    }

    for (const prev of prevExtras) {
        if (activeExtraIds.has(String(prev.source_id))) continue;
        if (await deleteUnpostedMovementById(sipePool, prev.sipe_admin_id)) {
            await pool.query('DELETE FROM sipe_admin_bank_sync_map WHERE id = ?', [prev.id]);
        }
    }

    return { cuenta: cuenta.numero, empresa_id: cuenta.empresa_id, mainResult, extraResults };
}

async function syncSalesRemesaToSipeAdmin({ delivery, companyId, rawAccount, montoEntregado, documento, concepto }) {
    const sipePool = getSipeAdminPool();
    const cuenta = await resolveSipeAdminAccount(sipePool, rawAccount);
    const tipoRemesaId = await resolveTipoRemesaId(sipePool, cuenta.empresa_id, '01', 'RM');
    const fechaIso = toIsoDate(delivery.fecha);
    if (!fechaIso) throw new Error('Fecha inválida para sincronizar remesa de ventas a db_sipe_admin');

    const result = await upsertSipeAdminMovement(sipePool, {
        sourceType: 'sales_remesa', sourceId: String(delivery.id), companyId, cuenta, tipoRemesaId,
        fechaIso, fechaAplicadoIso: null, documento, concepto,
        monto: montoEntregado.toFixed(2), cargo: montoEntregado.toFixed(2), abono: '0.00'
    });
    return { cuenta: cuenta.numero, empresa_id: cuenta.empresa_id, result };
}

async function collectRemesaTargetRows(sipePool, { sourceType, sourceId, extraSourceType = null, rawAccount = null, documento = '', fechaIso = null, conceptos = [] }) {
    const [mainMaps] = await pool.query(
        `SELECT id, sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = ? AND source_id = ?`,
        [sourceType, String(sourceId)]
    );
    const extraMaps = extraSourceType
        ? (await pool.query(`SELECT id, sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = ? AND parent_id = ?`, [extraSourceType, String(sourceId)]))[0]
        : [];
    const movIds = new Set([...mainMaps, ...extraMaps].map(m => m.sipe_admin_id));
    const mapIds = [...mainMaps, ...extraMaps].map(m => m.id);

    if (movIds.size === 0 && rawAccount && fechaIso && documento && conceptos.length > 0) {
        try {
            const cuenta = await resolveSipeAdminAccount(sipePool, rawAccount);
            const [fb] = await sipePool.query(
                `SELECT id FROM movimientos_bancarios WHERE cuenta_bancaria_id = ? AND documento = ? AND fecha = ? AND concepto IN (?)`,
                [cuenta.id, String(documento).slice(0, 100), fechaIso, conceptos.map(c => String(c).slice(0, 255))]
            );
            fb.forEach(r => movIds.add(r.id));
        } catch { /* ignore fallback lookup failures */ }
    }
    return { movimientoIds: [...movIds], mapIds };
}

async function checkRemesaContabilizadoInSipeAdmin(params) {
    const sipePool = getSipeAdminPool();
    const collected = await collectRemesaTargetRows(sipePool, params);
    if (collected.movimientoIds.length === 0) return { blocked: false, partidas: [], ...collected };
    const [rows] = await sipePool.query(
        'SELECT id, num_partida, es_contabilizado FROM movimientos_bancarios WHERE id IN (?)',
        [collected.movimientoIds]
    );
    const blockedRows = rows.filter(isRowContabilizado);
    if (blockedRows.length > 0) {
        return { blocked: true, partidas: [...new Set(blockedRows.map(r => r.num_partida).filter(Boolean))], ...collected };
    }
    return { blocked: false, partidas: [], ...collected };
}

async function revertRemesaFromSipeAdmin(params) {
    const sipePool = getSipeAdminPool();
    const check = await checkRemesaContabilizadoInSipeAdmin(params);
    if (check.blocked) return { blocked: true, partidas: check.partidas, deleted: 0 };

    let deleted = 0;
    if (check.movimientoIds.length > 0) {
        const [del] = await sipePool.query('DELETE FROM movimientos_bancarios WHERE id IN (?)', [check.movimientoIds]);
        deleted = del.affectedRows || 0;
    }
    if (check.mapIds.length > 0) {
        await pool.query('DELETE FROM sipe_admin_bank_sync_map WHERE id IN (?)', [check.mapIds]);
    }
    return { blocked: false, deleted };
}

async function releaseOrderChequesInSipeAdmin(conn, orderId, previousRrsVouchers = []) {
    const [mapped] = await pool.query(
        `SELECT id, sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = 'gas_order_cheque' AND parent_id = ?`,
        [String(orderId)]
    );
    const chequeIds = new Set(mapped.map(m => m.sipe_admin_id));

    for (const pv of previousRrsVouchers) {
        if (!pv?.numero_cuenta || !pv?.cheque) continue;
        try {
            const cta = await resolveSipeAdminAccount(conn, pv.numero_cuenta);
            const numChq = String(pv.cheque).trim();
            let found = [];
            if (pv.llave) {
                [found] = await conn.query('SELECT id FROM cheques WHERE cuenta_bancaria_id = ? AND cheque = ? AND llave = ? LIMIT 1', [cta.id, numChq, pv.llave]);
            }
            if (found.length === 0) {
                [found] = await conn.query('SELECT id FROM cheques WHERE cuenta_bancaria_id = ? AND cheque = ? ORDER BY id DESC LIMIT 1', [cta.id, numChq]);
            }
            if (found[0]?.id) chequeIds.add(found[0].id);
        } catch { /* ignore missing previous voucher account */ }
    }

    if (chequeIds.size > 0) {
        await conn.query(
            `UPDATE cheques
             SET es_reservado = 1, concepto = '***** CHEQUE NO EMITIDO *****', valor = 0.00, fecha = NULL
             WHERE id IN (?) AND (es_contabilizado = 0 OR es_contabilizado IS NULL)`,
            [[...chequeIds]]
        );
    }
    await pool.query(`DELETE FROM sipe_admin_bank_sync_map WHERE source_type = 'gas_order_cheque' AND parent_id = ?`, [String(orderId)]);
}

async function syncGasOrderTransferToSipeAdmin({ orderId, companyId, numeroCuenta, referencia, monto, fechaPago, concepto, previousRrsVouchers = [] }) {
    const sipePool = getSipeAdminPool();
    const conn = await sipePool.getConnection();
    try {
        await conn.beginTransaction();
        await releaseOrderChequesInSipeAdmin(conn, orderId, previousRrsVouchers);

        const cuenta = await resolveSipeAdminAccount(conn, numeroCuenta);
        const tipoRemesaId = await resolveTipoRemesaId(conn, cuenta.empresa_id, '02', 'TR');
        const fechaIso = toIsoDate(fechaPago);
        if (!fechaIso) throw new Error('Fecha de pago inválida para db_sipe_admin');

        const montoStr = Number(monto).toFixed(2);
        const result = await upsertSipeAdminMovement(conn, {
            sourceType: 'gas_order_transfer', sourceId: String(orderId), companyId, cuenta, tipoRemesaId,
            fechaIso, fechaAplicadoIso: fechaIso, documento: referencia, concepto,
            monto: montoStr, cargo: '0.00', abono: montoStr
        });

        await conn.commit();
        return { cuenta: cuenta.numero, empresa_id: cuenta.empresa_id, result };
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

async function syncGasOrderChequesToSipeAdmin({ orderId, companyId, fechaDescarga, documento, cheques = [], previousRrsVouchers = [], rrsVoucherMetaMap = new Map() }) {
    const sipePool = getSipeAdminPool();
    const conn = await sipePool.getConnection();
    try {
        await conn.beginTransaction();

        const [mappedTransfers] = await pool.query(
            `SELECT id, sipe_admin_id FROM sipe_admin_bank_sync_map WHERE source_type = 'gas_order_transfer' AND source_id = ?`,
            [String(orderId)]
        );
        for (const mt of mappedTransfers) {
            if (await deleteUnpostedMovementById(conn, mt.sipe_admin_id)) {
                await pool.query('DELETE FROM sipe_admin_bank_sync_map WHERE id = ?', [mt.id]);
            }
        }

        await releaseOrderChequesInSipeAdmin(conn, orderId, previousRrsVouchers);

        const fechaIso = toIsoDate(fechaDescarga);
        const chequeIds = [];

        for (const chq of cheques) {
            const numCta = String(chq.numero_cuenta || '').trim();
            const numCheque = String(chq.cheque || '').trim();
            const valor = parseFloat(chq.valor) || 0;
            if (!numCta || !numCheque || valor <= 0) continue;

            const cuenta = await resolveSipeAdminAccount(conn, numCta);
            const cConcepto = ((chq.concepto || '').trim() || `PAGO DE PIPA CCF# ${documento}`).slice(0, 200);
            const rrsMeta = rrsVoucherMetaMap instanceof Map
                ? rrsVoucherMetaMap.get(`${numCta}|${numCheque}`)
                : rrsVoucherMetaMap[`${numCta}|${numCheque}`];

            let existing = [];
            if (rrsMeta?.llave) {
                [existing] = await conn.query('SELECT id FROM cheques WHERE cuenta_bancaria_id = ? AND cheque = ? AND llave = ? LIMIT 1', [cuenta.id, numCheque, rrsMeta.llave]);
            }
            if (existing.length === 0) {
                [existing] = await conn.query('SELECT id FROM cheques WHERE cuenta_bancaria_id = ? AND cheque = ? ORDER BY id DESC LIMIT 1', [cuenta.id, numCheque]);
            }

            let chequeId;
            if (existing[0]?.id) {
                chequeId = existing[0].id;
                await conn.query(
                    'UPDATE cheques SET es_reservado = 0, concepto = ?, valor = ?, fecha = ? WHERE id = ?',
                    [cConcepto, valor.toFixed(2), fechaIso, chequeId]
                );
            } else {
                const [ins] = await conn.query(
                    `INSERT INTO cheques
                        (empresa_id, cuenta_bancaria_id, llave, fecha, cheque_anulado, cheque, valor, a_nombre, fecha_aplicado, concepto, es_reservado, es_contabilizado, es_pago_contado, fue_noemitido, num_partida)
                     VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, 0, 0, ?, 0, NULL)`,
                    [cuenta.empresa_id, cuenta.id, rrsMeta?.llave || null, fechaIso, numCheque, valor.toFixed(2), String(rrsMeta?.a_nombre || '').slice(0, 150), cConcepto, rrsMeta?.es_pago_contado ? 1 : 0]
                );
                chequeId = ins.insertId;
            }

            await upsertSyncMap({
                sourceType: 'gas_order_cheque', sourceId: `${orderId}:${cuenta.id}:${numCheque}`, parentId: String(orderId),
                companyId, table: 'cheques', sipeAdminId: chequeId, cuentaBancariaId: cuenta.id, documento: numCheque
            });
            chequeIds.push(chequeId);
        }

        await conn.commit();
        return { chequeIds };
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    toIsoDate,
    syncGasRemesaToSipeAdmin,
    syncSalesRemesaToSipeAdmin,
    checkRemesaContabilizadoInSipeAdmin,
    revertRemesaFromSipeAdmin,
    syncGasOrderTransferToSipeAdmin,
    syncGasOrderChequesToSipeAdmin
};
