const pool = require('../../config/db');
const { sendCloseoutToRrs } = require('../../services/gasCloseoutRrs.service');
const dteService = require('../../services/dte.service');
const notificationService = require('../../services/notification.service');
const { dteValidoExistsSql } = require('../../services/dteQueryFilters');
const { applyCloseoutLubricantsInventory, revertCloseoutLubricantsInventory } = require('../../services/gasCloseoutInventory.service');

// === Historial de cambios en cierres reabiertos ===

const CLOSEOUT_SECTIONS = {
    gastos: { label: 'Gastos', table: 'gas_station_closeout_expenses' },
    remesas: { label: 'Remesas', table: 'gas_station_closeout_remesas' },
    cupones: { label: 'Cupones', table: 'gas_station_closeout_cupones' },
    descuentos: { label: 'Descuentos', table: 'gas_station_closeout_descuentos' },
    adelantos: { label: 'Adelantos', table: 'gas_station_closeout_adelantos' },
    tarjetas: { label: 'Tarjetas', table: 'gas_station_closeout_tarjetas' },
    creditos: { label: 'Créditos', table: 'gas_station_closeout_creditos' },
    vales: { label: 'Vales', table: 'gas_station_closeout_vales' },
    anticipos: { label: 'Anticipos despachados', table: 'gas_station_closeout_anticipos_despachados' },
    trupput: { label: 'Despachos Trupput', table: 'gas_station_closeout_trupput_despachos' },
    lubricantes: { label: 'Lubricantes', table: 'gas_station_closeout_lubricant_readings' },
    despachadores: { label: 'Despachadores', table: 'gas_station_closeout_despachadores' },
    nozzles: { label: 'Asignación de mangueras', table: 'gas_station_closeout_despachador_nozzles' }
};

const SECTION_BUSINESS_FIELDS = {
    gastos: ['rubro', 'fecha', 'documento', 'tipo', 'provider_id', 'proveedor', 'valor', 'despachador_id', 'comentario'],
    remesas: ['documento', 'descripcion', 'despachador_id', 'tipo_operacion', 'monto'],
    cupones: ['distribuidora_id', 'cupon', 'valor', 'cantidad', 'monto', 'despachador_id'],
    descuentos: ['descripcion', 'monto', 'despachador_id'],
    adelantos: ['monto', 'comentario', 'despachador_id'],
    tarjetas: ['num_tarjeta', 'num_autorizacion', 'pos_type_id', 'despachador_id', 'tipo_operacion', 'monto'],
    creditos: ['documento', 'tipo_documento', 'cliente_id', 'cliente_nombre', 'producto_codigo', 'producto_descripcion', 'despachador_id', 'cantidad', 'precio', 'monto', 'placa', 'kilometraje'],
    vales: ['cliente_id', 'cliente_nombre', 'documento', 'monto', 'despachador_id'],
    anticipos: ['cliente_id', 'despachador_id', 'monto', 'comentario'],
    trupput: ['cliente_id', 'despachador_id', 'galones', 'monto', 'comentario'],
    lubricantes: ['producto_id', 'lectura_anterior', 'recarga', 'lectura_final', 'ventas'],
    despachadores: ['despachador_id'],
    nozzles: ['despachador_id', 'nozzle_id']
};

const NUMERIC_FIELDS = ['valor', 'monto', 'cantidad', 'precio', 'lectura_anterior', 'recarga', 'lectura_final', 'ventas', 'galones'];

function formatItemLabel(section, row) {
    if (!row) return '';
    try {
        if (section === 'remesas') {
            return [
                row.documento ? `Boleta #${row.documento}` : (row.codigo || (row.id ? `Remesa #${row.id}` : 'Remesa')),
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null,
                row.despachador_descripcion ? `(Desp: ${row.despachador_descripcion})` : (row.despachador_id ? `(Desp #${row.despachador_id})` : null)
            ].filter(Boolean).join(' ');
        }
        if (section === 'tarjetas') {
            const cardNum = row.num_tarjeta ? `Tarjeta ****${String(row.num_tarjeta).slice(-4)}` : (row.id ? `Tarjeta #${row.id}` : 'Tarjeta');
            return [
                cardNum,
                row.pos_type_nombre ? `(${row.pos_type_nombre})` : (row.pos_type_id ? `(POS #${row.pos_type_id})` : null),
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null,
                row.num_autorizacion ? `[Aut: #${row.num_autorizacion}]` : null,
                row.despachador_descripcion ? `· Desp: ${row.despachador_descripcion}` : (row.despachador_id ? `· Desp #${row.despachador_id}` : null)
            ].filter(Boolean).join(' ');
        }
        if (section === 'creditos') {
            return [
                row.cliente_nombre ? `Cliente: ${row.cliente_nombre}` : (row.cliente_id ? `Cliente #${row.cliente_id}` : 'Crédito'),
                row.documento ? `(Doc #${row.documento})` : null,
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null,
                row.placa ? `· Placa: ${row.placa}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'gastos') {
            return [
                row.rubro || 'Gasto',
                row.proveedor_nombre || row.proveedor ? `- ${row.proveedor_nombre || row.proveedor}` : (row.provider_id ? `- Proveedor #${row.provider_id}` : null),
                row.valor != null ? `$${parseFloat(row.valor).toFixed(2)}` : null,
                row.documento ? `[Doc #${row.documento}]` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'cupones') {
            return [
                row.distribuidora_nombre ? `${row.distribuidora_nombre}` : 'Cupón',
                row.cupon ? `#${row.cupon}` : null,
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'descuentos') {
            return [
                row.descripcion || 'Descuento',
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'adelantos') {
            return [
                row.despachador_descripcion ? `Despachador: ${row.despachador_descripcion}` : (row.despachador_id ? `Despachador #${row.despachador_id}` : 'Adelanto'),
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'vales') {
            return [
                row.cliente_nombre ? `Cliente: ${row.cliente_nombre}` : 'Vale',
                row.documento ? `(Doc: ${row.documento})` : null,
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'anticipos') {
            return [
                row.cliente_nombre ? `Cliente: ${row.cliente_nombre}` : 'Anticipo',
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'trupput') {
            return [
                row.cliente_nombre ? `Cliente: ${row.cliente_nombre}` : 'Trupput',
                row.galones != null ? `${parseFloat(row.galones).toFixed(2)} gal` : null,
                row.monto != null ? `$${parseFloat(row.monto).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'lubricantes') {
            return [
                row.producto_descripcion || row.producto_codigo || 'Lubricante',
                row.ventas != null ? `Ventas: $${parseFloat(row.ventas).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'tanques') {
            return [
                row.codigo_tanque ? `Tanque ${row.codigo_tanque}` : (row.descripcion_tanque || 'Tanque'),
                row.lectura_actual != null ? `Lect: ${parseFloat(row.lectura_actual).toFixed(2)}` : null
            ].filter(Boolean).join(' ');
        }
        if (section === 'despachadores') {
            return row.nombre || row.despachador_descripcion || (row.despachador_id ? `Despachador #${row.despachador_id}` : 'Despachador');
        }
        if (section === 'nozzles') {
            return `Manguera ${row.nozzle_codigo || row.codigo_pistola || row.nozzle_id || ''}`.trim();
        }
    } catch {
        return '';
    }
    return '';
}

function getNaturalKey(section, row) {
    if (!row) return null;
    if (section === 'remesas') {
        return row.documento ? String(row.documento).trim() : (row.codigo ? String(row.codigo).trim() : null);
    }
    if (section === 'tarjetas') {
        return row.num_tarjeta ? `${String(row.num_tarjeta).trim()}_${String(row.num_autorizacion || '').trim()}` : null;
    }
    if (section === 'creditos') {
        return row.documento ? `${String(row.documento).trim()}_${row.cliente_id || ''}` : null;
    }
    if (section === 'gastos') {
        return row.documento ? `${String(row.documento).trim()}_${row.provider_id || row.proveedor || ''}` : null;
    }
    if (section === 'cupones') {
        return row.cupon ? `${String(row.cupon).trim()}_${row.distribuidora_id || ''}` : null;
    }
    if (section === 'descuentos') {
        return row.descripcion ? String(row.descripcion).trim().toLowerCase() : null;
    }
    if (section === 'adelantos') {
        return row.despachador_id ? `adelanto_${row.despachador_id}_${row.monto}` : null;
    }
    if (section === 'vales') {
        return row.documento ? `${String(row.documento).trim()}_${row.cliente_id || ''}` : null;
    }
    if (section === 'anticipos') {
        return row.cliente_id ? `anticipo_${row.cliente_id}_${row.monto}` : null;
    }
    if (section === 'trupput') {
        return row.cliente_id ? `trupput_${row.cliente_id}_${row.despachador_id || ''}` : null;
    }
    if (section === 'lubricantes') {
        return row.producto_id ? `lub_${row.producto_id}` : null;
    }
    if (section === 'despachadores') {
        return row.despachador_id ? `desp_${row.despachador_id}` : null;
    }
    if (section === 'nozzles') {
        return (row.despachador_id && row.nozzle_id) ? `nozzle_${row.despachador_id}_${row.nozzle_id}` : null;
    }
    return null;
}

async function enrichSectionRows(companyId, closeoutId, section, rows) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
    const cloned = rows.map(r => ({ ...r }));

    try {
        const despIds = [...new Set(cloned.map(r => r.despachador_id).filter(Boolean))];
        const posIds = [...new Set(cloned.map(r => r.pos_type_id).filter(Boolean))];
        const provIds = [...new Set(cloned.map(r => r.provider_id).filter(Boolean))];
        const custIds = [...new Set(cloned.map(r => r.cliente_id).filter(Boolean))];
        const distIds = [...new Set(cloned.map(r => r.distribuidora_id).filter(Boolean))];
        const prodIds = [...new Set(cloned.map(r => r.producto_id).filter(Boolean))];

        let closeoutDespRows = [];
        if (despIds.length > 0 && closeoutId) {
            try {
                [closeoutDespRows] = await pool.query(
                    `SELECT despachador_id, nombre FROM gas_station_closeout_despachadores WHERE closeout_id = ? AND despachador_id IN (?)`,
                    [closeoutId, despIds]
                );
            } catch { }
        }
        const closeoutDespMap = Object.fromEntries(closeoutDespRows.filter(cd => cd.nombre).map(cd => [cd.despachador_id, cd.nombre]));

        const [despRows, posRows, provRows, custRows, distRows, prodRows] = await Promise.all([
            despIds.length > 0
                ? pool.query(`SELECT id, codigo, descripcion FROM gas_station_despachadores WHERE id IN (?)`, [despIds]).then(([r]) => r).catch(() => [])
                : [],
            posIds.length > 0
                ? pool.query(`SELECT id, nombre FROM gas_station_pos_types WHERE id IN (?)`, [posIds]).then(([r]) => r).catch(() => [])
                : [],
            provIds.length > 0
                ? pool.query(`SELECT id, nombre FROM providers WHERE id IN (?)`, [provIds]).then(([r]) => r).catch(() => [])
                : [],
            custIds.length > 0
                ? pool.query(`SELECT id, nombre, razon_social FROM customers WHERE id IN (?)`, [custIds]).then(([r]) => r).catch(() => [])
                : [],
            distIds.length > 0
                ? pool.query(`SELECT id, nombre FROM gas_station_distributors WHERE id IN (?)`, [distIds]).then(([r]) => r).catch(() => [])
                : [],
            prodIds.length > 0
                ? pool.query(`SELECT id, codigo, descripcion FROM products WHERE id IN (?)`, [prodIds]).then(([r]) => r).catch(() => [])
                : []
        ]);

        const despMap = Object.fromEntries(despRows.map(d => [d.id, closeoutDespMap[d.id] || d.descripcion || d.codigo]));
        const posMap = Object.fromEntries(posRows.map(p => [p.id, p.nombre]));
        const provMap = Object.fromEntries(provRows.map(p => [p.id, p.nombre]));
        const custMap = Object.fromEntries(custRows.map(c => [c.id, c.nombre || c.razon_social]));
        const distMap = Object.fromEntries(distRows.map(d => [d.id, d.nombre]));
        const prodMap = Object.fromEntries(prodRows.map(p => [p.id, p.descripcion || p.codigo]));

        for (const row of cloned) {
            if (row.despachador_id && !row.despachador_descripcion) {
                row.despachador_descripcion = despMap[row.despachador_id] || '';
            }
            if (row.pos_type_id && !row.pos_type_nombre) {
                row.pos_type_nombre = posMap[row.pos_type_id] || '';
            }
            if (row.provider_id && !row.proveedor_nombre) {
                row.proveedor_nombre = provMap[row.provider_id] || row.proveedor || '';
            }
            if (row.cliente_id && !row.cliente_nombre) {
                row.cliente_nombre = custMap[row.cliente_id] || '';
            }
            if (row.distribuidora_id && !row.distribuidora_nombre) {
                row.distribuidora_nombre = distMap[row.distribuidora_id] || '';
            }
            if (row.producto_id && !row.producto_descripcion) {
                row.producto_descripcion = prodMap[row.producto_id] || '';
            }
        }
    } catch (err) {
        console.error('Error in enrichSectionRows:', err);
    }

    return cloned;
}

async function getSectionRows(closeoutId, section) {
    const cfg = CLOSEOUT_SECTIONS[section];
    if (!cfg) return [];
    const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]);
    return rows;
}

function fieldChanges(section, oldRow, newRow) {
    const allowed = SECTION_BUSINESS_FIELDS[section] || Object.keys(newRow);
    const changes = [];
    for (const key of allowed) {
        if (key === 'id' || key === 'closeout_id' || key === 'created_at' || key === 'updated_at') continue;
        if (!(key in oldRow) && !(key in newRow)) continue;

        const oldVal = oldRow[key];
        const newVal = newRow[key];
        if (NUMERIC_FIELDS.includes(key)) {
            const oldNum = parseFloat(oldVal || 0);
            const newNum = parseFloat(newVal || 0);
            if (Math.abs(oldNum - newNum) > 0.001) {
                changes.push({ field: key, old: oldNum, new: newNum });
            }
        } else {
            const oldStr = String(oldVal ?? '').trim();
            const newStr = String(newVal ?? '').trim();
            if (oldStr !== newStr) {
                changes.push({ field: key, old: oldVal ?? '', new: newVal ?? '' });
            }
        }
    }
    return changes;
}

function buildSectionDiff(section, beforeRows, incomingRows) {
    const before = beforeRows || [];
    const after = incomingRows || [];
    const added = [];
    const removed = [];
    const modified = [];

    const beforeById = new Map();
    for (const row of before) {
        if (row.id) beforeById.set(Number(row.id), row);
    }

    const matchedBeforeIds = new Set();
    const unmatchedIncoming = [];

    // Step 1: Match by ID
    for (const inc of after) {
        const incId = Number(inc.id);
        if (incId && beforeById.has(incId)) {
            matchedBeforeIds.add(incId);
            const oldRow = beforeById.get(incId);
            const changes = fieldChanges(section, oldRow, inc);
            if (changes.length > 0) {
                modified.push({
                    id: incId,
                    identifier: formatItemLabel(section, inc) || formatItemLabel(section, oldRow),
                    row: inc,
                    oldRow,
                    changes
                });
            }
        } else {
            unmatchedIncoming.push(inc);
        }
    }

    // Step 2: Unmatched before rows
    const unmatchedBefore = before.filter(r => !matchedBeforeIds.has(Number(r.id)));

    // Step 3: Match remaining by natural business key
    const stillUnmatchedIncoming = [];
    for (const inc of unmatchedIncoming) {
        const key = getNaturalKey(section, inc);
        let foundIdx = -1;
        if (key) {
            foundIdx = unmatchedBefore.findIndex(b => getNaturalKey(section, b) === key);
        }
        if (foundIdx >= 0) {
            const oldRow = unmatchedBefore.splice(foundIdx, 1)[0];
            const changes = fieldChanges(section, oldRow, inc);
            if (changes.length > 0) {
                modified.push({
                    id: oldRow.id || inc.id,
                    identifier: formatItemLabel(section, inc) || formatItemLabel(section, oldRow),
                    row: inc,
                    oldRow,
                    changes
                });
            }
        } else {
            stillUnmatchedIncoming.push(inc);
        }
    }

    // Step 4: Any still unmatched in incoming are ADDED
    for (const inc of stillUnmatchedIncoming) {
        added.push(inc);
    }

    // Step 5: Any still in unmatchedBefore are REMOVED
    for (const b of unmatchedBefore) {
        removed.push(b);
    }

    return { added, removed, modified };
}

function summarizeDiff(sectionLabel, diff) {
    const parts = [];
    if (diff.added.length) parts.push(`${diff.added.length} agregado${diff.added.length > 1 ? 's' : ''}`);
    if (diff.removed.length) parts.push(`${diff.removed.length} eliminado${diff.removed.length > 1 ? 's' : ''}`);
    if (diff.modified.length) parts.push(`${diff.modified.length} modificado${diff.modified.length > 1 ? 's' : ''}`);
    return parts.length ? `${sectionLabel}: ${parts.join(', ')}` : '';
}

async function logCloseoutChange(req, closeoutId, section, action, description, details) {
    try {
        await pool.query(
            `INSERT INTO gas_station_closeout_changes (company_id, branch_id, closeout_id, user_id, username, section, action, description, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id,
                req.user?.branch_id || null,
                closeoutId,
                req.user?.id || null,
                req.user?.username || req.user?.nombre || '',
                section,
                action,
                description || '',
                details ? JSON.stringify(details) : null
            ]
        );
    } catch (err) {
        console.error('Error logCloseoutChange:', err);
    }
}

async function logSectionChange(req, closeoutId, section, beforeRows, incomingRows) {
    const cfg = CLOSEOUT_SECTIONS[section];
    if (!cfg) return;

    const [enrichedBefore, enrichedAfter] = await Promise.all([
        enrichSectionRows(req.company_id, closeoutId, section, beforeRows),
        enrichSectionRows(req.company_id, closeoutId, section, incomingRows)
    ]);

    const diff = buildSectionDiff(section, enrichedBefore, enrichedAfter);

    if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
        return;
    }

    const summary = summarizeDiff(cfg.label, diff);
    let action = 'update';
    if (diff.added.length > 0 && diff.removed.length === 0 && diff.modified.length === 0) {
        action = 'create';
    } else if (diff.removed.length > 0 && diff.added.length === 0 && diff.modified.length === 0) {
        action = 'delete';
    }

    await logCloseoutChange(req, closeoutId, section, action, summary, {
        added: diff.added,
        removed: diff.removed,
        modified: diff.modified
    });
}

const toDateStr = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    const s = String(val);
    const m = s.match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : s.slice(0, 10);
};

async function recalcularTanquesPosteriores(req, closeout, tankReading, prevLecturaActual) {
    try {
        const fechaStr = toDateStr(closeout.fecha_turno) || '';
        const [posteriores] = await pool.query(
            `SELECT * FROM gas_station_closeouts
             WHERE company_id = ? AND branch_id <=> ? AND id <> ?
               AND (fecha_turno > ? OR (fecha_turno = ? AND CAST(numero_turno AS UNSIGNED) > CAST(? AS UNSIGNED)))
             ORDER BY fecha_turno ASC, CAST(numero_turno AS UNSIGNED) ASC`,
            [req.company_id, closeout.branch_id ?? null, closeout.id, fechaStr, fechaStr, closeout.numero_turno]
        );

        for (const nextCloseout of posteriores) {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_tank_readings WHERE closeout_id = ? AND tank_id = ? LIMIT 1`,
                [nextCloseout.id, tankReading.tank_id]
            );
            if (rows.length === 0) continue;
            const row = rows[0];
            const nuevaAnterior = prevLecturaActual;
            const nuevaDiferencia = nuevaAnterior + parseFloat(row.recarga || 0) - parseFloat(row.lectura_actual || 0);
            await pool.query(
                `UPDATE gas_station_closeout_tank_readings SET lectura_anterior = ?, diferencia = ? WHERE id = ?`,
                [nuevaAnterior, nuevaDiferencia, row.id]
            );
            await logCloseoutChange(req, nextCloseout.id, 'tanques', 'edit',
                `Recálculo por corrección en turno #${closeout.numero_turno} (${fechaStr}): tanque ${row.codigo_tanque}`,
                {
                    modified: [{
                        codigo_tanque: row.codigo_tanque,
                        changes: [
                            { field: 'lectura_anterior', old: parseFloat(row.lectura_anterior), new: nuevaAnterior },
                            { field: 'diferencia', old: parseFloat(row.diferencia), new: nuevaDiferencia }
                        ]
                    }]
                }
            );
            prevLecturaActual = parseFloat(row.lectura_actual || 0);
        }
    } catch (error) {
        console.error('Error recalcularTanquesPosteriores:', error);
    }
}

async function recalcularLubricantesPosteriores(req, closeout, updatedReadings) {
    try {
        const fechaStr = toDateStr(closeout.fecha_turno);
        if (!fechaStr) return;

        const [posteriores] = await pool.query(
            `SELECT * FROM gas_station_closeouts
             WHERE company_id = ? AND branch_id <=> ? AND id <> ?
               AND (fecha_turno > ? OR (fecha_turno = ? AND CAST(numero_turno AS UNSIGNED) > CAST(? AS UNSIGNED)))
             ORDER BY fecha_turno ASC, CAST(numero_turno AS UNSIGNED) ASC`,
            [req.company_id, closeout.branch_id ?? null, closeout.id, fechaStr, fechaStr, closeout.numero_turno]
        );

        if (posteriores.length === 0) return;

        const runningFinalMap = {};
        for (const r of updatedReadings) {
            if (r.producto_id) {
                runningFinalMap[r.producto_id] = parseFloat(r.lectura_final) || 0;
            }
        }

        for (const nextCloseout of posteriores) {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`,
                [nextCloseout.id]
            );
            if (rows.length === 0) continue;

            const changes = [];
            for (const row of rows) {
                if (runningFinalMap[row.producto_id] !== undefined) {
                    const prevFinal = runningFinalMap[row.producto_id];
                    const currentInicial = parseFloat(row.lectura_inicial) || 0;
                    const recarga = parseFloat(row.recarga) || 0;
                    const currentFinal = parseFloat(row.lectura_final) || 0;
                    const currentVentas = parseFloat(row.ventas) || 0;

                    if (Math.abs(currentInicial - prevFinal) > 0.0001) {
                        let newFinal = currentFinal;
                        let newVentas = currentVentas;
                        const precio = parseFloat(row.precio) || 0;

                        if (currentVentas === 0 && recarga === 0) {
                            newFinal = prevFinal;
                            newVentas = 0;
                        } else {
                            newVentas = Math.max(0, prevFinal + recarga - newFinal);
                        }
                        const newTotal = parseFloat((newVentas * precio).toFixed(2));

                        await pool.query(
                            `UPDATE gas_station_closeout_lubricant_readings
                             SET lectura_inicial = ?, lectura_final = ?, ventas = ?, total = ?
                             WHERE id = ?`,
                            [prevFinal, newFinal, newVentas, newTotal, row.id]
                        );

                        changes.push({
                            field: 'lectura_inicial',
                            producto_codigo: row.producto_codigo,
                            old: currentInicial,
                            new: prevFinal
                        });

                        runningFinalMap[row.producto_id] = newFinal;
                    } else {
                        runningFinalMap[row.producto_id] = currentFinal;
                    }
                }
            }

            if (changes.length > 0) {
                await logCloseoutChange(
                    req,
                    nextCloseout.id,
                    'lubricantes',
                    'edit',
                    `Recálculo por corrección en turno #${closeout.numero_turno} (${fechaStr}): ${changes.length} lubricantes`,
                    { modified: changes }
                );
            }
        }
    } catch (error) {
        console.error('Error recalcularLubricantesPosteriores:', error);
    }
}

async function logDeleteRow(req, closeoutId, section, row) {
    const cfg = CLOSEOUT_SECTIONS[section];
    if (!cfg) return;
    const [enrichedRow] = await enrichSectionRows(req.company_id, closeoutId, section, [row]);
    const itemLabel = formatItemLabel(section, enrichedRow);
    const desc = itemLabel
        ? `${cfg.label}: se eliminó ${itemLabel}`
        : `${cfg.label}: 1 elemento eliminado`;

    await logCloseoutChange(req, closeoutId, section, 'delete', desc, {
        removed: [enrichedRow],
        before: [enrichedRow],
        after: []
    });
}


module.exports = {
    pool,
    sendCloseoutToRrs,
    dteService,
    notificationService,
    dteValidoExistsSql,
    applyCloseoutLubricantsInventory,
    revertCloseoutLubricantsInventory,
    CLOSEOUT_SECTIONS,
    SECTION_BUSINESS_FIELDS,
    NUMERIC_FIELDS,
    formatItemLabel,
    getNaturalKey,
    enrichSectionRows,
    getSectionRows,
    fieldChanges,
    buildSectionDiff,
    summarizeDiff,
    logCloseoutChange,
    logSectionChange,
    toDateStr,
    recalcularTanquesPosteriores,
    recalcularLubricantesPosteriores,
    logDeleteRow
};
