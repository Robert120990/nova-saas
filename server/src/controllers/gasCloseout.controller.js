const pool = require('../config/db');
const { sendCloseoutToRrs } = require('../services/gasCloseoutRrs.service');
const dteService = require('../services/dte.service');
const notificationService = require('../services/notification.service');
const { dteValidoExistsSql } = require('../services/dteQueryFilters');

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
    lubricantes: { label: 'Lubricantes', table: 'gas_station_closeout_lubricant_readings' },
    despachadores: { label: 'Despachadores', table: 'gas_station_closeout_despachadores' },
    nozzles: { label: 'Asignación de mangueras', table: 'gas_station_closeout_despachador_nozzles' }
};

async function getSectionRows(closeoutId, section) {
    const cfg = CLOSEOUT_SECTIONS[section];
    if (!cfg) return [];
    const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]);
    return rows;
}

function fieldChanges(oldRow, newRow) {
    const changes = [];
    for (const [key, newVal] of Object.entries(newRow)) {
        if (key === 'id' || key === 'closeout_id') continue;
        if (!(key in oldRow)) continue;
        const oldVal = oldRow[key];
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes.push({ field: key, old: oldVal, new: newVal });
        }
    }
    return changes;
}

function buildSectionDiff(before, after) {
    const added = [];
    const removed = [];
    const modified = [];

    if (before.length === after.length) {
        for (let i = 0; i < after.length; i++) {
            const changes = fieldChanges(before[i], after[i]);
            if (changes.length > 0) modified.push({ before: before[i], after: after[i], changes });
        }
        return { added, removed, modified };
    }

    const beforeMap = new Map(before.map(r => [r.id, r]));
    const afterMap = new Map(after.map(r => [r.id, r]));
    for (const row of after) if (!beforeMap.has(row.id)) added.push(row);
    for (const row of before) if (!afterMap.has(row.id)) removed.push(row);

    const min = Math.min(before.length, after.length);
    for (let i = 0; i < min; i++) {
        const changes = fieldChanges(before[i], after[i]);
        if (changes.length > 0) modified.push({ before: before[i], after: after[i], changes });
    }
    return { added, removed, modified };
}

function summarizeDiff(sectionLabel, diff) {
    const parts = [];
    if (diff.added.length) parts.push(`${diff.added.length} agregado${diff.added.length > 1 ? 's' : ''}`);
    if (diff.removed.length) parts.push(`${diff.removed.length} eliminado${diff.removed.length > 1 ? 's' : ''}`);
    if (diff.modified.length) parts.push(`${diff.modified.length} modificado${diff.modified.length > 1 ? 's' : ''}`);
    return parts.length ? `${sectionLabel}: ${parts.join(', ')}` : `${sectionLabel}: sin cambios`;
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

async function logSectionChange(req, closeoutId, section, before, after) {
    const cfg = CLOSEOUT_SECTIONS[section];
    if (!cfg) return;
    const diff = buildSectionDiff(before, after);
    await logCloseoutChange(req, closeoutId, section, 'update', summarizeDiff(cfg.label, diff), { before, after, added: diff.added, removed: diff.removed, modified: diff.modified });
}

async function recalcularTanquesPosteriores(req, closeout, tankReading, prevLecturaActual) {
    try {
        const fechaStr = closeout.fecha_turno ? String(closeout.fecha_turno).slice(0, 10) : '';
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

async function logDeleteRow(req, closeoutId, section, row) {
    const cfg = CLOSEOUT_SECTIONS[section];
    if (!cfg) return;
    await logCloseoutChange(req, closeoutId, section, 'delete', `${cfg.label}: 1 eliminado`, { before: [row], after: [] });
}

exports.initCloseout = async (req, res) => {
    try {
        const { seller_id, seller_name, fecha_turno, numero_turno, despachadores, nozzle_assignments } = req.body;
        if (!seller_id || !fecha_turno || !numero_turno) {
            return res.status(400).json({ message: 'seller_id, fecha_turno y numero_turno son requeridos' });
        }

        const [openCloseout] = await pool.query(
            `SELECT id FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND estado = 'abierto'
             LIMIT 1`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null]
        );
        if (openCloseout.length > 0) {
            return res.status(400).json({ message: 'Ya existe un turno abierto en esta sucursal. Debe cerrarlo antes de iniciar uno nuevo.' });
        }

        // Verify (fecha_turno, numero_turno) pair is not duplicate
        const [existingTurno] = await pool.query(
            `SELECT id FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
             AND fecha_turno = ? AND numero_turno = ?
             LIMIT 1`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null, fecha_turno, parseInt(numero_turno, 10)]
        );
        if (existingTurno.length > 0) {
            return res.status(400).json({ message: `El turno #${numero_turno} ya existe para la fecha ${fecha_turno}` });
        }

        // Validate numbering within the same date
        const [lastOnDate] = await pool.query(
            `SELECT numero_turno FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
             AND fecha_turno = ?
             ORDER BY numero_turno DESC LIMIT 1`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null, fecha_turno]
        );

        if (lastOnDate.length > 0) {
            const lastNum = parseInt(lastOnDate[0].numero_turno, 10);
            if (parseInt(numero_turno, 10) <= lastNum) {
                return res.status(400).json({ message: `El número de turno debe ser mayor al último turno registrado en esta fecha (${lastNum})` });
            }
        }

        const [result] = await pool.query(
            `INSERT INTO gas_station_closeouts (company_id, branch_id, seller_id, seller_name, fecha_turno, numero_turno) VALUES (?, ?, ?, ?, ?, ?)`,
            [req.company_id, req.user.branch_id || null, seller_id, seller_name || '', fecha_turno, parseInt(numero_turno, 10)]
        );
        const closeoutId = result.insertId;

        const savedDespachadores = [];
        if (Array.isArray(despachadores) && despachadores.length > 0) {
            for (const d of despachadores) {
                const [[existing]] = await pool.query(
                    `SELECT id FROM gas_station_despachadores WHERE id = ? AND company_id = ?`,
                    [d.despachador_id, req.company_id]
                );
                if (existing) {
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachadores (closeout_id, despachador_id, nombre) VALUES (?, ?, ?)`,
                        [closeoutId, d.despachador_id, d.nombre || '']
                    );
                    savedDespachadores.push({ despachador_id: d.despachador_id, nombre: d.nombre || '' });
                }
            }
        } else {
            const [allDespachadores] = await pool.query(
                `SELECT id, codigo, descripcion FROM gas_station_despachadores WHERE company_id = ? AND branch_id = ? ORDER BY id ASC`,
                [req.company_id, req.user.branch_id]
            );
            for (const d of allDespachadores) {
                await pool.query(
                    `INSERT INTO gas_station_closeout_despachadores (closeout_id, despachador_id, nombre) VALUES (?, ?, ?)`,
                    [closeoutId, d.id, d.descripcion || d.codigo || '']
                );
                savedDespachadores.push({ despachador_id: d.id, nombre: d.descripcion || d.codigo || '' });
            }
        }

        const savedNozzleAssignments = [];
        const validAssignments = (Array.isArray(nozzle_assignments) ? nozzle_assignments : [])
            .filter(a => a.despachador_id && Array.isArray(a.nozzle_ids) && a.nozzle_ids.length > 0);
        if (validAssignments.length > 0) {
            for (const a of validAssignments) {
                for (const nid of a.nozzle_ids) {
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id) VALUES (?, ?, ?)`,
                        [closeoutId, a.despachador_id, nid]
                    );
                    savedNozzleAssignments.push({ despachador_id: a.despachador_id, nozzle_id: nid });
                }
            }
        } else {
            const savedIds = savedDespachadores.map(d => d.despachador_id);
            if (savedIds.length > 0) {
                const [liveAssignments] = await pool.query(
                    `SELECT despachador_id, nozzle_id FROM gas_station_despachador_nozzles
                     WHERE company_id = ? AND despachador_id IN (?) AND (branch_id = ? OR branch_id IS NULL)`,
                    [req.company_id, savedIds, req.user.branch_id || null]
                );
                for (const a of liveAssignments) {
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id) VALUES (?, ?, ?)`,
                        [closeoutId, a.despachador_id, a.nozzle_id]
                    );
                    savedNozzleAssignments.push({ despachador_id: a.despachador_id, nozzle_id: a.nozzle_id });
                }
            }
        }

        const branchId = req.user.branch_id || null;
        const [nozzles] = await pool.query(`
            SELECT n.id as nozzle_id, n.codigo as codigo_pistola,
                   p.id as product_id, p.codigo as codigo_producto, p.nombre as descripcion_producto,
                   COALESCE(pbp.precio_unitario, 0) as precio_unitario, p.tipo_combustible
            FROM gas_station_nozzles n
            JOIN products p ON n.product_id = p.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            WHERE n.company_id = ? AND (n.branch_id = ? OR (? IS NULL AND n.branch_id IS NULL))
        `, [branchId, req.company_id, branchId, branchId]);

        const readings = [];
        for (const n of nozzles) {
            const [lastReading] = await pool.query(`
                SELECT r.lectura_actual
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE r.nozzle_id = ? AND c.company_id = ? AND c.estado = 'cerrado'
                ORDER BY c.created_at DESC
                LIMIT 1
            `, [n.nozzle_id, req.company_id]);

            const lectura_anterior = lastReading.length > 0 ? parseFloat(lastReading[0].lectura_actual) : 0;

            const [insertResult] = await pool.query(`
                INSERT INTO gas_station_closeout_readings
                (closeout_id, nozzle_id, product_id, codigo_pistola, codigo_producto, descripcion_producto, precio, lectura_anterior, lectura_actual, calibracion, diferencia, monto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
            `, [closeoutId, n.nozzle_id, n.product_id, n.codigo_pistola, n.codigo_producto, n.descripcion_producto, n.precio_unitario, lectura_anterior, lectura_anterior]);

            readings.push({
                id: insertResult.insertId,
                nozzle_id: n.nozzle_id,
                codigo_pistola: n.codigo_pistola,
                codigo_producto: n.codigo_producto,
                descripcion_producto: n.descripcion_producto,
                precio: n.precio_unitario,
                tipo_combustible: n.tipo_combustible,
                lectura_anterior,
                lectura_actual: lectura_anterior,
                calibracion: 0,
                diferencia: 0,
                monto: 0
            });
        }

        const [tanks] = await pool.query(
            `SELECT id as tank_id, codigo, descripcion, capacidad, tipo_combustible FROM gas_station_tanks WHERE company_id = ? AND (branch_id = ? OR (? IS NULL AND branch_id IS NULL))`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null]
        );

        const tankReadings = [];
        for (const t of tanks) {
            const [lastTankReading] = await pool.query(`
                SELECT r.lectura_actual
                FROM gas_station_closeout_tank_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE r.tank_id = ? AND c.company_id = ? AND c.estado = 'cerrado'
                ORDER BY c.created_at DESC
                LIMIT 1
            `, [t.tank_id, req.company_id]);

            const lectura_anterior = lastTankReading.length > 0 ? parseFloat(lastTankReading[0].lectura_actual) : 0;

            const [tankInsertResult] = await pool.query(`
                INSERT INTO gas_station_closeout_tank_readings
                (closeout_id, tank_id, codigo_tanque, descripcion_tanque, lectura_anterior, recarga, lectura_actual, diferencia)
                VALUES (?, ?, ?, ?, ?, 0, ?, 0)
            `, [closeoutId, t.tank_id, t.codigo, t.descripcion, lectura_anterior, lectura_anterior]);

            tankReadings.push({
                id: tankInsertResult.insertId,
                tank_id: t.tank_id,
                codigo_tanque: t.codigo,
                descripcion_tanque: t.descripcion,
                capacidad: parseFloat(t.capacidad),
                tipo_combustible: t.tipo_combustible,
                lectura_anterior,
                recarga: 0,
                lectura_actual: lectura_anterior,
                diferencia: 0
            });
        }

        // === Sembrar lecturas de lubricantes (inicial = último final del turno anterior cerrado con lecturas) ===
        const lubricantReadings = [];
        try {
            const [lubSettings] = await pool.query(
                `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND setting_key = 'lubricant_category_id'`,
                [req.company_id, branchId, branchId]
            );
            const lubricantCategoryId = lubSettings[0]?.setting_value;
            if (lubricantCategoryId) {
                const [lubProducts] = await pool.query(`
                    SELECT p.id, p.codigo, p.nombre AS descripcion, COALESCE(pbp.precio_unitario, 0) as precio_unitario
                    FROM products p
                    JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
                    LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
                    WHERE p.company_id = ? AND p.category_id = ? AND p.status = 'activo'
                    ORDER BY p.codigo ASC
                `, [branchId, branchId, req.company_id, lubricantCategoryId]);

                if (lubProducts.length > 0) {
                    const [lastLubReadings] = await pool.query(`
                        SELECT lr.producto_id, lr.lectura_final
                        FROM gas_station_closeout_lubricant_readings lr
                        WHERE lr.closeout_id = (
                            SELECT MAX(c2.id) FROM gas_station_closeouts c2
                            WHERE c2.company_id = ? AND c2.estado = 'cerrado'
                            AND (c2.branch_id = ? OR (? IS NULL AND c2.branch_id IS NULL))
                            AND EXISTS (SELECT 1 FROM gas_station_closeout_lubricant_readings l WHERE l.closeout_id = c2.id)
                        )
                    `, [req.company_id, branchId, branchId]);

                    const lastMap = {};
                    lastLubReadings.forEach(r => {
                        if (!lastMap[r.producto_id]) lastMap[r.producto_id] = parseFloat(r.lectura_final) || 0;
                    });

                    for (const p of lubProducts) {
                        const inicial = lastMap[p.id] || 0;
                        const [lubResult] = await pool.query(`
                            INSERT INTO gas_station_closeout_lubricant_readings
                            (closeout_id, producto_id, producto_codigo, producto_descripcion, lectura_inicial, recarga, lectura_final, ventas, precio, total)
                            VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, 0)
                        `, [closeoutId, p.id, p.codigo, p.descripcion, inicial, inicial, p.precio_unitario]);

                        lubricantReadings.push({
                            id: lubResult.insertId,
                            producto_id: p.id,
                            producto_codigo: p.codigo,
                            producto_descripcion: p.descripcion,
                            lectura_inicial: inicial,
                            recarga: 0,
                            lectura_final: inicial,
                            ventas: 0,
                            precio: parseFloat(p.precio_unitario) || 0,
                            total: 0
                        });
                    }
                }
            }
        } catch (lubError) {
            console.error('Error sembrando lubricantes en initCloseout:', lubError);
        }

        res.status(201).json({ id: closeoutId, readings, tankReadings, lubricantReadings, despachadores: savedDespachadores, despachadorNozzleAssignments: savedNozzleAssignments });
    } catch (error) {
        console.error('Error initCloseout:', error);
        res.status(500).json({ message: 'Error al iniciar cierre de lecturas' });
    }
};

exports.initTankReadings = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [existing] = await pool.query(
            `SELECT COUNT(*) as cnt FROM gas_station_closeout_tank_readings WHERE closeout_id = ?`,
            [id]
        );
        if (existing[0].cnt > 0) {
            const [rows] = await pool.query(`
                SELECT tr.*, t.capacidad, t.tipo_combustible
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id = ?
                ORDER BY tr.codigo_tanque ASC
            `, [id]);
            return res.json(rows);
        }

        const [tanks] = await pool.query(
            `SELECT id as tank_id, codigo, descripcion, capacidad, tipo_combustible FROM gas_station_tanks WHERE company_id = ? AND (branch_id = ? OR (? IS NULL AND branch_id IS NULL))`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null]
        );

        const tankReadings = [];
        for (const t of tanks) {
            const [lastTankReading] = await pool.query(`
                SELECT r.lectura_actual
                FROM gas_station_closeout_tank_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE r.tank_id = ? AND c.company_id = ? AND c.estado = 'cerrado'
                ORDER BY c.created_at DESC
                LIMIT 1
            `, [t.tank_id, req.company_id]);

            const lectura_anterior = lastTankReading.length > 0 ? parseFloat(lastTankReading[0].lectura_actual) : 0;

            const [tankInsertResult] = await pool.query(`
                INSERT INTO gas_station_closeout_tank_readings
                (closeout_id, tank_id, codigo_tanque, descripcion_tanque, lectura_anterior, recarga, lectura_actual, diferencia)
                VALUES (?, ?, ?, ?, ?, 0, 0, 0)
            `, [id, t.tank_id, t.codigo, t.descripcion, lectura_anterior]);

            tankReadings.push({
                id: tankInsertResult.insertId,
                tank_id: t.tank_id,
                codigo_tanque: t.codigo,
                descripcion_tanque: t.descripcion,
                capacidad: parseFloat(t.capacidad),
                tipo_combustible: t.tipo_combustible,
                lectura_anterior,
                recarga: 0,
                lectura_actual: 0,
                diferencia: 0
            });
        }

        res.status(201).json(tankReadings);
    } catch (error) {
        console.error('Error initTankReadings:', error);
        res.status(500).json({ message: 'Error al iniciar lecturas de tanque' });
    }
};

exports.getCloseouts = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE c.company_id = ?';
        let params = [req.company_id];

        if (req.user.branch_id) {
            where += ' AND c.branch_id = ?';
            params.push(req.user.branch_id);
        }

        if (search) {
            where += ' AND (CAST(c.numero_turno AS CHAR) LIKE ? OR c.seller_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM gas_station_closeouts c ${where}`, params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(`
            SELECT
              c.*,
              (SELECT COUNT(*) FROM gas_station_closeout_changes ch WHERE ch.closeout_id = c.id) as cambios_count,
              COALESCE(rd.total_lecturas, 0) as total_lecturas,
              COALESCE(rd.total_monto, 0) as total_monto,
              COALESCE(rd.total_diferencia, 0) as total_diferencia,
              ROUND(
                (COALESCE(eg.total_gastos, 0) + COALESCE(re.total_remesas, 0) +
                 COALESCE(cu.total_cupones, 0) + COALESCE(dc.total_descuentos, 0) +
                 COALESCE(ad.total_adelantos, 0) + COALESCE(tj.total_tarjetas, 0) +
                 COALESCE(cr.total_creditos, 0) + COALESCE(vl.total_vales, 0) +
                 COALESCE(ad2.total_anticipos_desp, 0)) -
                (COALESCE(rd.total_monto, 0) + COALESCE(lb.total_lubricantes, 0)),
                2
              ) as total_diferencia_efectivo
            FROM gas_station_closeouts c
            LEFT JOIN (SELECT closeout_id, SUM(monto) as total_monto, SUM(diferencia) as total_diferencia, COUNT(*) as total_lecturas FROM gas_station_closeout_readings GROUP BY closeout_id) rd ON rd.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(valor), 0) as total_gastos FROM gas_station_closeout_expenses GROUP BY closeout_id) eg ON eg.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_remesas FROM gas_station_closeout_remesas GROUP BY closeout_id) re ON re.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_cupones FROM gas_station_closeout_cupones GROUP BY closeout_id) cu ON cu.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(total), 0) as total_descuentos FROM gas_station_closeout_descuentos GROUP BY closeout_id) dc ON dc.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_adelantos FROM gas_station_closeout_adelantos GROUP BY closeout_id) ad ON ad.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_tarjetas FROM gas_station_closeout_tarjetas GROUP BY closeout_id) tj ON tj.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_creditos FROM gas_station_closeout_creditos GROUP BY closeout_id) cr ON cr.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_vales FROM gas_station_closeout_vales GROUP BY closeout_id) vl ON vl.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_anticipos_desp FROM gas_station_closeout_anticipos_despachados GROUP BY closeout_id) ad2 ON ad2.closeout_id = c.id
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(total), 0) as total_lubricantes FROM gas_station_closeout_lubricant_readings GROUP BY closeout_id) lb ON lb.closeout_id = c.id
            ${where}
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('Error getCloseouts:', error);
        res.status(500).json({ message: 'Error al obtener cierres de lecturas' });
    }
};

exports.getCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [readings] = await pool.query(`
            SELECT r.*, p.tipo_combustible
            FROM gas_station_closeout_readings r
            JOIN products p ON r.product_id = p.id
            WHERE r.closeout_id = ?
            ORDER BY r.codigo_pistola ASC
        `, [id]);

        let tankReadings = [];
        try {
            [tankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad, t.tipo_combustible
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id = ?
                ORDER BY tr.codigo_tanque ASC
            `, [id]);
        } catch { }

        const [despachadores] = await pool.query(
            `SELECT cd.despachador_id, cd.nombre, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_despachadores cd
             JOIN gas_station_despachadores d ON d.id = cd.despachador_id
             WHERE cd.closeout_id = ?`,
            [id]
        );

        let despachadorNozzleAssignments = [];
        try {
            [despachadorNozzleAssignments] = await pool.query(
                `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
                [id]
            );
        } catch { }

        const [gastos] = await pool.query(
            `SELECT e.*, p.nombre as proveedor_nombre FROM gas_station_closeout_expenses e
             LEFT JOIN providers p ON e.provider_id = p.id
             WHERE e.closeout_id = ? ORDER BY e.id ASC`, [id]
        );

        const [remesas] = await pool.query(
            `SELECT r.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_remesas r
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
             WHERE r.closeout_id = ? ORDER BY r.id ASC`, [id]
        );

        const [cupones] = await pool.query(
            `SELECT * FROM gas_station_closeout_cupones WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [descuentos] = await pool.query(
            `SELECT * FROM gas_station_closeout_descuentos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [adelantos] = await pool.query(
            `SELECT * FROM gas_station_closeout_adelantos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [tarjetas] = await pool.query(
            `SELECT * FROM gas_station_closeout_tarjetas WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [creditos] = await pool.query(
            `SELECT * FROM gas_station_closeout_creditos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [vales] = await pool.query(
            `SELECT * FROM gas_station_closeout_vales WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [anticiposDesp] = await pool.query(
            `SELECT ad.*,
                    COALESCE(ga.total_disponible, 0) AS saldo_disponible
             FROM gas_station_closeout_anticipos_despachados ad
             LEFT JOIN (
                 SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                 FROM gas_station_advances
                 WHERE company_id = ? AND monto_disponible > 0
                 GROUP BY cliente_id
             ) ga ON ga.cliente_id = ad.cliente_id
             WHERE ad.closeout_id = ?
             ORDER BY ad.id ASC`, [req.company_id, id]
        );

        const [lubricantes] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        res.json({
            ...closeouts[0],
            readings,
            tankReadings,
            despachadores,
            despachadorNozzleAssignments,
            gastos: gastos.map(e => ({ ...e, proveedor: e.proveedor_nombre || e.proveedor })),
            remesas,
            cupones,
            descuentos,
            adelantos,
            tarjetas,
            creditos,
            vales,
            anticipos_despachadores: anticiposDesp,
            lubricantReadings: lubricantes
        });
    } catch (error) {
        console.error('Error getCloseout:', error);
        res.status(500).json({ message: 'Error al obtener cierre de lecturas' });
    }
};

exports.getCloseoutChanges = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT id, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [rows] = await pool.query(
            `SELECT id, user_id, username, section, action, description, details, created_at
             FROM gas_station_closeout_changes
             WHERE closeout_id = ? AND company_id = ?
             ORDER BY created_at DESC, id DESC`,
            [id, req.company_id]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error getCloseoutChanges:', error);
        res.status(500).json({ message: 'Error al obtener cambios del cierre' });
    }
};

exports.updateReading = async (req, res) => {
    try {
        const { closeoutId, id } = req.params;
        const { lectura_actual, calibracion, lectura_anterior: newAnterior } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [closeoutId, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado' || closeouts[0].estado === 'reabierto') {
            return res.status(400).json({ message: 'El cierre no se puede modificar en este estado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [current] = await pool.query(
            `SELECT lectura_anterior, precio FROM gas_station_closeout_readings WHERE id = ? AND closeout_id = ?`,
            [id, closeoutId]
        );
        if (current.length === 0) return res.status(404).json({ message: 'Lectura no encontrada' });

        const lectura_anterior = newAnterior !== undefined ? parseFloat(newAnterior) : parseFloat(current[0].lectura_anterior);
        const precio = parseFloat(current[0].precio);
        const newLectura = lectura_actual !== undefined ? parseFloat(lectura_actual) : undefined;
        const newCalibracion = calibracion !== undefined ? parseFloat(calibracion) : undefined;

        const finalLectura = newLectura !== undefined ? newLectura : parseFloat(current[0].lectura_actual);
        const finalCalibracion = newCalibracion !== undefined ? newCalibracion : parseFloat(current[0].calibracion);
        const diferencia = finalLectura - lectura_anterior - finalCalibracion;
        const monto = diferencia * precio;

        await pool.query(`
            UPDATE gas_station_closeout_readings
            SET lectura_actual = ?, calibracion = ?, lectura_anterior = ?, diferencia = ?, monto = ?
            WHERE id = ? AND closeout_id = ?
        `, [finalLectura, finalCalibracion, lectura_anterior, diferencia, monto, id, closeoutId]);

        res.json({ id: parseInt(id), lectura_actual: finalLectura, calibracion: finalCalibracion, lectura_anterior, diferencia, monto });
    } catch (error) {
        console.error('Error updateReading:', error);
        res.status(500).json({ message: 'Error al actualizar lectura' });
    }
};

exports.batchUpdateReadings = async (req, res) => {
    try {
        const { closeoutId } = req.params;
        const { readings } = req.body;

        if (!Array.isArray(readings) || readings.length === 0) {
            return res.status(400).json({ message: 'El arreglo de lecturas es requerido' });
        }

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [closeoutId, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado' || closeouts[0].estado === 'reabierto') {
            return res.status(400).json({ message: 'El cierre no se puede modificar en este estado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const updated = [];
        for (const r of readings) {
            if (!r.readingId || r.lectura_actual === undefined) continue;

            const [current] = await pool.query(
                `SELECT lectura_anterior, precio, calibracion FROM gas_station_closeout_readings WHERE id = ? AND closeout_id = ?`,
                [r.readingId, closeoutId]
            );
            if (current.length === 0) continue;

            const lectura_anterior = parseFloat(current[0].lectura_anterior);
            const precio = parseFloat(current[0].precio);
            const calibracion = parseFloat(current[0].calibracion);
            const lectura_actual = parseFloat(r.lectura_actual);
            const diferencia = lectura_actual - lectura_anterior - calibracion;
            const monto = diferencia * precio;

            await pool.query(`
                UPDATE gas_station_closeout_readings
                SET lectura_actual = ?, diferencia = ?, monto = ?
                WHERE id = ? AND closeout_id = ?
            `, [lectura_actual, diferencia, monto, r.readingId, closeoutId]);

            updated.push({ id: parseInt(r.readingId), lectura_actual, diferencia, monto });
        }

        res.json({ updated: updated.length, readings: updated });
    } catch (error) {
        console.error('Error batchUpdateReadings:', error);
        res.status(500).json({ message: 'Error al actualizar lecturas' });
    }
};

exports.updateTankReading = async (req, res) => {
    try {
        const { closeoutId, id } = req.params;
        const { lectura_actual, recarga, lectura_anterior: newAnterior } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [closeoutId, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        const closeout = closeouts[0];
        if (closeout.estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre no se puede modificar en este estado' });
        }
        if (closeout.estado === 'reabierto' && req.user.role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Solo un SuperAdmin puede editar lecturas de tanque de un turno reabierto' });
        }
        if (req.user.branch_id && closeout.branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [current] = await pool.query(
            `SELECT * FROM gas_station_closeout_tank_readings WHERE id = ? AND closeout_id = ?`,
            [id, closeoutId]
        );
        if (current.length === 0) return res.status(404).json({ message: 'Lectura de tanque no encontrada' });

        const lectura_anterior = newAnterior !== undefined ? parseFloat(newAnterior) : parseFloat(current[0].lectura_anterior);
        const newLectura = lectura_actual !== undefined ? parseFloat(lectura_actual) : undefined;
        const newRecarga = recarga !== undefined ? parseFloat(recarga) : undefined;

        const finalLectura = newLectura !== undefined ? newLectura : parseFloat(current[0].lectura_actual);
        const finalRecarga = newRecarga !== undefined ? newRecarga : parseFloat(current[0].recarga);
        const diferencia = lectura_anterior + finalRecarga - finalLectura;

        await pool.query(`
            UPDATE gas_station_closeout_tank_readings
            SET lectura_actual = ?, recarga = ?, lectura_anterior = ?, diferencia = ?
            WHERE id = ? AND closeout_id = ?
        `, [finalLectura, finalRecarga, lectura_anterior, diferencia, id, closeoutId]);

        if (closeout.estado === 'reabierto') {
            await logCloseoutChange(req, closeout.id, 'tanques', 'edit',
                `Tanque ${current[0].codigo_tanque} corregido en turno reabierto (SuperAdmin)`,
                {
                    modified: [{
                        codigo_tanque: current[0].codigo_tanque,
                        changes: [
                            { field: 'lectura_actual', old: parseFloat(current[0].lectura_actual), new: finalLectura },
                            { field: 'recarga', old: parseFloat(current[0].recarga), new: finalRecarga },
                            { field: 'lectura_anterior', old: parseFloat(current[0].lectura_anterior), new: lectura_anterior },
                            { field: 'diferencia', old: parseFloat(current[0].diferencia), new: diferencia }
                        ]
                    }]
                }
            );
            await recalcularTanquesPosteriores(req, closeout, { tank_id: current[0].tank_id }, finalLectura);
        }

        res.json({ id: parseInt(id), lectura_actual: finalLectura, recarga: finalRecarga, lectura_anterior, diferencia });
    } catch (error) {
        console.error('Error updateTankReading:', error);
        res.status(500).json({ message: 'Error al actualizar lectura de tanque' });
    }
};

exports.deleteCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [anticiposDesp] = await connection.query(
                `SELECT cliente_id, monto FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`,
                [id]
            );

            for (const ad of anticiposDesp) {
                const cid = ad.cliente_id;
                const monto = parseFloat(ad.monto);
                if (!cid || monto <= 0) continue;
                const [availableAdvances] = await connection.query(
                    `SELECT id, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? AND monto_disponible > 0 ORDER BY fecha ASC, id ASC`,
                    [req.company_id, cid]
                );
                let remaining = monto;
                for (const adv of availableAdvances) {
                    if (remaining <= 0) break;
                    const restore = Math.min(remaining, parseFloat(adv.monto_disponible));
                    await connection.query(
                        `UPDATE gas_station_advances SET monto_disponible = monto_disponible + ? WHERE id = ?`,
                        [restore, adv.id]
                    );
                    remaining -= restore;
                }
            }

            await connection.query(`DELETE FROM gas_station_closeout_adelantos WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_tank_readings WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_readings WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeouts WHERE id = ?`, [id]);

            await connection.commit();
            res.json({ message: 'Cierre eliminado exitosamente' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleteCloseout:', error);
        res.status(500).json({ message: 'Error al eliminar cierre de lecturas' });
    }
};

exports.closeCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id, numero_turno, fecha_turno FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [tanksCfg] = await pool.query(
            `SELECT COUNT(*) AS cnt FROM gas_station_tanks WHERE company_id = ? AND (branch_id = ? OR (? IS NULL AND branch_id IS NULL))`,
            [req.company_id, closeouts[0].branch_id, closeouts[0].branch_id]
        );
        if (tanksCfg[0].cnt > 0) {
            const [tankReadingRows] = await pool.query(
                `SELECT lectura_anterior, recarga, lectura_actual FROM gas_station_closeout_tank_readings WHERE closeout_id = ?`,
                [id]
            );
            if (tankReadingRows.length === 0) {
                return res.status(400).json({ message: 'No se han registrado lecturas de tanque en este turno. Ingréselas antes de cerrar el turno.' });
            }
            const todasSinDiferencia = tankReadingRows.every(r =>
                Math.abs((parseFloat(r.lectura_anterior) || 0) + (parseFloat(r.recarga) || 0) - (parseFloat(r.lectura_actual) || 0)) < 0.00001
            );
            if (todasSinDiferencia) {
                return res.status(400).json({ message: 'Las lecturas de tanque no han sido ingresadas (todas con diferencia cero). Ingrese las lecturas reales antes de cerrar el turno.' });
            }
        }

        const branchId = req.user?.branch_id || null;
        const [settingsRows] = await pool.query(
            `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND setting_key = 'variacion_permitida'`,
            [req.company_id, branchId, branchId]
        );
        const variacionPermitida = parseFloat(settingsRows[0]?.setting_value) || 0;

        const [[{ totalMonto }]] = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as totalMonto FROM gas_station_closeout_readings WHERE closeout_id = ?`,
            [id]
        );
        const [[{ lubricantTotal }]] = await pool.query(
            `SELECT COALESCE(SUM(total), 0) as lubricantTotal FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`,
            [id]
        );
        const [[{ totalGalones }]] = await pool.query(
            `SELECT COALESCE(SUM(diferencia), 0) as totalGalones FROM gas_station_closeout_readings WHERE closeout_id = ?`,
            [id]
        );
        const [[{ numDespachadores }]] = await pool.query(
            `SELECT COUNT(*) as numDespachadores FROM gas_station_closeout_despachadores WHERE closeout_id = ?`,
            [id]
        );

        if (variacionPermitida > 0) {
            const [[{ gastosTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(valor), 0) as gastosTotal FROM gas_station_closeout_expenses WHERE closeout_id = ?`,
                [id]
            );
            const [[{ remesasTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as remesasTotal FROM gas_station_closeout_remesas WHERE closeout_id = ?`,
                [id]
            );
            const [[{ cuponesTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as cuponesTotal FROM gas_station_closeout_cupones WHERE closeout_id = ?`,
                [id]
            );
            const [[{ descuentosTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(total), 0) as descuentosTotal FROM gas_station_closeout_descuentos WHERE closeout_id = ?`,
                [id]
            );
            const [[{ adelantosTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as adelantosTotal FROM gas_station_closeout_adelantos WHERE closeout_id = ?`,
                [id]
            );
            const [[{ tarjetasTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as tarjetasTotal FROM gas_station_closeout_tarjetas WHERE closeout_id = ?`,
                [id]
            );
            const [[{ creditosTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as creditosTotal FROM gas_station_closeout_creditos WHERE closeout_id = ?`,
                [id]
            );
            const [[{ valesTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as valesTotal FROM gas_station_closeout_vales WHERE closeout_id = ?`,
                [id]
            );
            const [[{ anticiposDespTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as anticiposDespTotal FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`,
                [id]
            );

            const diferencia = (parseFloat(gastosTotal) + parseFloat(remesasTotal) + parseFloat(cuponesTotal) + parseFloat(descuentosTotal) + parseFloat(adelantosTotal) + parseFloat(tarjetasTotal) + parseFloat(creditosTotal) + parseFloat(valesTotal) + parseFloat(anticiposDespTotal)) - (parseFloat(totalMonto) + parseFloat(lubricantTotal));

            if (Math.abs(diferencia) > variacionPermitida) {
                return res.status(400).json({
                    message: `La diferencia de $${Math.abs(diferencia).toFixed(2)} excede la variación permitida de $${variacionPermitida.toFixed(2)}. Revise los datos antes de cerrar.`
                });
            }
        }

        await pool.query(
            `UPDATE gas_station_closeouts SET estado = 'cerrado', closed_at = NOW() WHERE id = ?`,
            [id]
        );

        if (closeouts[0].estado === 'reabierto') {
            await logCloseoutChange(req, id, 'reclose', 'reclose', 'Cierre recerrado', {});
        }

        const [brRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [closeouts[0].branch_id]);
        const branchName = brRows[0]?.nombre || '';

        notificationService.notify('gas_closeout_completed', req.company_id, closeouts[0].branch_id, {
            turno: closeouts[0].numero_turno || '',
            fecha: closeouts[0].fecha_turno ? new Date(closeouts[0].fecha_turno).toLocaleDateString('es-SV') : '',
            total_ventas: totalMonto,
            total_galones: totalGalones,
            num_despachadores: numDespachadores,
            tanques: [],
            sucursal: branchName
        }).catch(() => {});

        res.json({ message: 'Cierre cerrado exitosamente' });
    } catch (error) {
        console.error('Error closeCloseout:', error);
        res.status(500).json({ message: 'Error al cerrar cierre de lecturas' });
    }
};

exports.reopenCloseout = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id, numero_turno, fecha_turno FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado !== 'cerrado') {
            return res.status(400).json({ message: 'Solo se pueden reabrir cierres cerrados' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        await pool.query(
            `UPDATE gas_station_closeouts SET estado = 'reabierto' WHERE id = ?`,
            [id]
        );

        await logCloseoutChange(req, id, 'reopen', 'reopen', 'Cierre reabierto', {});

        const [brRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [closeouts[0].branch_id]);
        const branchName = brRows[0]?.nombre || '';

        notificationService.notify('gas_closeout_reopened', req.company_id, closeouts[0].branch_id, {
            turno: closeouts[0].numero_turno || '',
            fecha: closeouts[0].fecha_turno ? new Date(closeouts[0].fecha_turno).toLocaleDateString('es-SV') : '',
            sucursal: branchName
        }).catch(() => {});

        res.json({ message: 'Cierre reabierto exitosamente' });
    } catch (error) {
        console.error('Error reopenCloseout:', error);
        res.status(500).json({ message: 'Error al reabrir cierre de lecturas' });
    }
};

exports.updateCloseoutFechaTurno = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha_turno, numero_turno } = req.body;

        if (!fecha_turno || numero_turno === undefined || numero_turno === null || numero_turno === '') {
            return res.status(400).json({ message: 'fecha_turno y numero_turno son requeridos' });
        }

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const newNumeroTurno = parseInt(numero_turno, 10);
        const branchId = closeouts[0].branch_id;

        const [existingTurno] = await pool.query(
            `SELECT id FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
             AND fecha_turno = ? AND numero_turno = ? AND id != ?
             LIMIT 1`,
            [req.company_id, branchId, branchId, fecha_turno, newNumeroTurno, id]
        );
        if (existingTurno.length > 0) {
            return res.status(400).json({ message: `El turno #${newNumeroTurno} ya existe para la fecha ${fecha_turno}` });
        }

        await pool.query(
            `UPDATE gas_station_closeouts SET fecha_turno = ?, numero_turno = ?, rrs_enviado_at = NULL WHERE id = ? AND company_id = ?`,
            [fecha_turno, newNumeroTurno, id, req.company_id]
        );

        if (closeouts[0].estado !== 'abierto') {
            const oldFecha = closeouts[0].fecha_turno ? new Date(closeouts[0].fecha_turno).toLocaleDateString('es-SV') : '';
            const newFecha = new Date(fecha_turno).toLocaleDateString('es-SV');
            await logCloseoutChange(req, id, 'fecha_turno', 'update',
                `Fecha/Turno modificado: ${oldFecha} #${closeouts[0].numero_turno} → ${newFecha} #${newNumeroTurno}`,
                {
                    before: { fecha_turno: closeouts[0].fecha_turno, numero_turno: closeouts[0].numero_turno },
                    after: { fecha_turno, numero_turno: newNumeroTurno }
                }
            );
        }

        res.json({ id: parseInt(id), fecha_turno, numero_turno: newNumeroTurno });
    } catch (error) {
        console.error('Error updateCloseoutFechaTurno:', error);
        res.status(500).json({ message: 'Error al actualizar fecha y turno del cierre' });
    }
};

// === Expense Categories ===

exports.getExpenseCategories = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name FROM gas_station_expense_categories WHERE company_id = ? AND branch_id = ? ORDER BY name`,
            [req.company_id, req.user.branch_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getExpenseCategories:', error);
        res.status(500).json({ message: 'Error al obtener rubros' });
    }
};

exports.createExpenseCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Nombre es requerido' });
        const [result] = await pool.query(
            `INSERT INTO gas_station_expense_categories (company_id, branch_id, name) VALUES (?, ?, ?)`,
            [req.company_id, req.user.branch_id, name]
        );
        res.status(201).json({ id: result.insertId, name });
    } catch (error) {
        console.error('Error createExpenseCategory:', error);
        res.status(500).json({ message: 'Error al crear rubro' });
    }
};

exports.updateExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Nombre es requerido' });
        const [result] = await pool.query(
            `UPDATE gas_station_expense_categories SET name = ? WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [name, id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Rubro no encontrado' });
        res.json({ id: parseInt(id), name });
    } catch (error) {
        console.error('Error updateExpenseCategory:', error);
        res.status(500).json({ message: 'Error al actualizar rubro' });
    }
};

exports.deleteExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM gas_station_expense_categories WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Rubro no encontrado' });
        res.json({ message: 'Rubro eliminado' });
    } catch (error) {
        console.error('Error deleteExpenseCategory:', error);
        res.status(500).json({ message: 'Error al eliminar rubro' });
    }
};

// === Closeout Expenses ===

exports.getExpenses = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT e.*, p.nombre as proveedor_nombre, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_expenses e
            LEFT JOIN providers p ON e.provider_id = p.id
            LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
            WHERE e.closeout_id = ?
            ORDER BY e.id ASC
        `, [id]);
        const mapped = rows.map(e => ({
            ...e,
            proveedor: e.proveedor_nombre || e.proveedor
        }));
        res.json(mapped);
    } catch (error) {
        console.error('Error getExpenses:', error);
        res.status(500).json({ message: 'Error al obtener gastos' });
    }
};

exports.saveExpenses = async (req, res) => {
    try {
        const { id } = req.params;
        const { expenses } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'gastos');

        await pool.query(`DELETE FROM gas_station_closeout_expenses WHERE closeout_id = ?`, [id]);

        const invalidExpenses = expenses.filter(e => !e.despachador_id);
        if (invalidExpenses.length > 0) {
            return res.status(400).json({ message: 'Todos los gastos deben tener un despachador asignado' });
        }

        if (expenses && expenses.length > 0) {
            const providerIds = expenses.map(e => e.provider_id).filter(id => id);
            const providerMap = {};
            if (providerIds.length > 0) {
                const [providers] = await pool.query(
                    `SELECT id, nombre FROM providers WHERE id IN (?) AND company_id = ?`,
                    [providerIds, req.company_id]
                );
                providers.forEach(p => { providerMap[p.id] = p.nombre; });
            }

            const values = expenses.map(e => {
                const providerId = e.provider_id ? parseInt(e.provider_id) : null;
                const proveedor = providerId ? (providerMap[providerId] || '') : (e.proveedor || '');
                return [
                    parseInt(id),
                    e.rubro || '',
                    e.fecha || null,
                    e.documento || '',
                    e.tipo || 'ccf',
                    providerId,
                    proveedor,
                    parseFloat(e.valor) || 0,
                    e.despachador_id ? parseInt(e.despachador_id) : null,
                    e.comentario || ''
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_expenses (closeout_id, rubro, fecha, documento, tipo, provider_id, proveedor, valor, despachador_id, comentario) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT e.*, p.nombre as proveedor_nombre, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_expenses e
            LEFT JOIN providers p ON e.provider_id = p.id
            LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
            WHERE e.closeout_id = ?
            ORDER BY e.id ASC
        `, [id]);

        const mapped = remaining.map(e => ({
            ...e,
            proveedor: e.proveedor_nombre || e.proveedor
        }));

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'gastos');
            await logSectionChange(req, id, 'gastos', beforeRows, afterRows);
        }

        res.json(mapped);
    } catch (error) {
        console.error('Error saveExpenses:', error);
        res.status(500).json({ message: 'Error al guardar gastos' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id, expenseId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_expenses WHERE id = ? AND closeout_id = ?`,
                [expenseId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_expenses WHERE id = ? AND closeout_id = ?`,
            [expenseId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Gasto no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'gastos', deletedRow);
        res.json({ message: 'Gasto eliminado' });
    } catch (error) {
        console.error('Error deleteExpense:', error);
        res.status(500).json({ message: 'Error al eliminar gasto' });
    }
};

// === Closeout Remesas ===

exports.getRemesas = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT r.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_remesas r
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            WHERE r.closeout_id = ?
            ORDER BY r.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getRemesas:', error);
        res.status(500).json({ message: 'Error al obtener remesas' });
    }
};

exports.saveRemesas = async (req, res) => {
    try {
        const { id } = req.params;
        const { remesas } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'remesas');

        // REPLACE-ALL STRATEGY
        // Preserve codigos of remesas that are being re-saved (they exist in DB)
        const [existingRemesas] = await pool.query(
            `SELECT id, codigo FROM gas_station_closeout_remesas WHERE closeout_id = ?`,
            [id]
        );
        const existingCodigos = {};
        existingRemesas.forEach(r => { existingCodigos[r.id] = r.codigo; });

        await pool.query(`DELETE FROM gas_station_closeout_remesas WHERE closeout_id = ?`, [id]);

        if (remesas && remesas.length > 0) {
            const invalid = remesas.filter(r => !r.despachador_id);
            if (invalid.length > 0) {
                return res.status(400).json({ message: 'Todas las remesas deben tener un despachador asignado' });
            }
            const values = remesas.map((r, index) => {
                let codigo = r.codigo || existingCodigos[r.id] || null;
                if (!codigo) {
                    codigo = `REM-${id}-${index + 1}`;
                }
                return [
                    parseInt(id),
                    codigo,
                    r.documento || '',
                    r.descripcion || '',
                    r.despachador_id ? parseInt(r.despachador_id) : null,
                    r.tipo_operacion || 'venta_combustible',
                    parseFloat(r.monto) || 0
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_remesas (closeout_id, codigo, documento, descripcion, despachador_id, tipo_operacion, monto) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT r.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_remesas r
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            WHERE r.closeout_id = ?
            ORDER BY r.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'remesas');
            await logSectionChange(req, id, 'remesas', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveRemesas:', error);
        res.status(500).json({ message: 'Error al guardar remesas' });
    }
};

exports.deleteRemesa = async (req, res) => {
    try {
        const { id, remesaId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_remesas WHERE id = ? AND closeout_id = ?`,
                [remesaId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_remesas WHERE id = ? AND closeout_id = ?`,
            [remesaId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Remesa no encontrada' });
        if (deletedRow) await logDeleteRow(req, id, 'remesas', deletedRow);
        res.json({ message: 'Remesa eliminada' });
    } catch (error) {
        console.error('Error deleteRemesa:', error);
        res.status(500).json({ message: 'Error al eliminar remesa' });
    }
};

// === Closeout Cupones ===

exports.getCupones = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_cupones c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getCupones:', error);
        res.status(500).json({ message: 'Error al obtener cupones' });
    }
};

exports.saveCupones = async (req, res) => {
    try {
        const { id } = req.params;
        const { cupones } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'cupones');

        // REPLACE-ALL STRATEGY
        await pool.query(`DELETE FROM gas_station_closeout_cupones WHERE closeout_id = ?`, [id]);

        const invalidCupones = cupones.filter(c => !c.despachador_id);
        if (invalidCupones.length > 0) {
            return res.status(400).json({ message: 'Todos los cupones deben tener un despachador asignado' });
        }

        if (cupones && cupones.length > 0) {
            const distributorIds = cupones.filter(c => c.distribuidora_id).map(c => parseInt(c.distribuidora_id));
            const distributorMap = {};
            if (distributorIds.length > 0) {
                const [distributors] = await pool.query(
                    `SELECT id, descripcion FROM gas_station_distributors WHERE id IN (?) AND company_id = ?`,
                    [distributorIds, req.company_id]
                );
                distributors.forEach(d => { distributorMap[d.id] = d.descripcion; });
            }

            const values = cupones.map(c => {
                const distribuidoraId = c.distribuidora_id ? parseInt(c.distribuidora_id) : null;
                const distribuidoraNombre = distribuidoraId ? (distributorMap[distribuidoraId] || '') : '';
                return [
                    parseInt(id),
                    c.cupon || '',
                    distribuidoraId,
                    distribuidoraNombre,
                    c.producto_codigo || '',
                    c.producto_descripcion || '',
                    parseFloat(c.monto) || 0,
                    c.despachador_id ? parseInt(c.despachador_id) : null
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_cupones (closeout_id, cupon, distribuidora_id, distribuidora_nombre, producto_codigo, producto_descripcion, monto, despachador_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_cupones c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'cupones');
            await logSectionChange(req, id, 'cupones', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveCupones:', error);
        res.status(500).json({ message: 'Error al guardar cupones' });
    }
};

exports.deleteCupon = async (req, res) => {
    try {
        const { id, cuponId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_cupones WHERE id = ? AND closeout_id = ?`,
                [cuponId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_cupones WHERE id = ? AND closeout_id = ?`,
            [cuponId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Cupón no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'cupones', deletedRow);
        res.json({ message: 'Cupón eliminado' });
    } catch (error) {
        console.error('Error deleteCupon:', error);
        res.status(500).json({ message: 'Error al eliminar cupón' });
    }
};

// === Closeout Descuentos ===

exports.getDescuentos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT d.*, desp.codigo as despachador_codigo, desp.descripcion as despachador_descripcion
            FROM gas_station_closeout_descuentos d
            LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
            WHERE d.closeout_id = ?
            ORDER BY d.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getDescuentos:', error);
        res.status(500).json({ message: 'Error al obtener descuentos' });
    }
};

exports.saveDescuentos = async (req, res) => {
    try {
        const { id } = req.params;
        const { descuentos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'descuentos');

        await pool.query(`DELETE FROM gas_station_closeout_descuentos WHERE closeout_id = ?`, [id]);

        const invalidDescuentos = descuentos.filter(d => !d.despachador_id);
        if (invalidDescuentos.length > 0) {
            return res.status(400).json({ message: 'Todos los descuentos deben tener un despachador asignado' });
        }

        if (descuentos && descuentos.length > 0) {
            const clienteIds = descuentos.filter(d => d.cliente_id).map(d => parseInt(d.cliente_id));
            const clienteMap = {};
            if (clienteIds.length > 0) {
                const [clientes] = await pool.query(
                    `SELECT id, nombre FROM customers WHERE id IN (?) AND company_id = ?`,
                    [clienteIds, req.company_id]
                );
                clientes.forEach(c => { clienteMap[c.id] = c.nombre; });
            }

            const values = descuentos.map(d => {
                const clienteId = d.cliente_id ? parseInt(d.cliente_id) : null;
                const clienteNombre = clienteId ? (clienteMap[clienteId] || '') : '';
                const cantidad = parseFloat(d.cantidad) || 0;
                const valor = parseFloat(d.valor) || 0;
                const total = cantidad * valor;
                return [
                    parseInt(id),
                    d.documento || '',
                    clienteId,
                    clienteNombre,
                    d.producto_codigo || '',
                    d.producto_descripcion || '',
                    cantidad,
                    valor,
                    total,
                    d.despachador_id ? parseInt(d.despachador_id) : null
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_descuentos (closeout_id, documento, cliente_id, cliente_nombre, producto_codigo, producto_descripcion, cantidad, valor, total, despachador_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT d.*, desp.codigo as despachador_codigo, desp.descripcion as despachador_descripcion
            FROM gas_station_closeout_descuentos d
            LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
            WHERE d.closeout_id = ?
            ORDER BY d.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'descuentos');
            await logSectionChange(req, id, 'descuentos', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveDescuentos:', error);
        res.status(500).json({ message: 'Error al guardar descuentos' });
    }
};

exports.deleteDescuento = async (req, res) => {
    try {
        const { id, descuentoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_descuentos WHERE id = ? AND closeout_id = ?`,
                [descuentoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_descuentos WHERE id = ? AND closeout_id = ?`,
            [descuentoId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Descuento no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'descuentos', deletedRow);
        res.json({ message: 'Descuento eliminado' });
    } catch (error) {
        console.error('Error deleteDescuento:', error);
        res.status(500).json({ message: 'Error al eliminar descuento' });
    }
};

// === Closeout Adelantos ===

exports.getAdelantos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT a.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_adelantos a
            LEFT JOIN gas_station_despachadores d ON a.despachador_id = d.id
            WHERE a.closeout_id = ?
            ORDER BY a.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getAdelantos:', error);
        res.status(500).json({ message: 'Error al obtener adelantos' });
    }
};

exports.saveAdelantos = async (req, res) => {
    try {
        const { id } = req.params;
        const { adelantos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'adelantos');

        await pool.query(`DELETE FROM gas_station_closeout_adelantos WHERE closeout_id = ?`, [id]);

        const invalidAdelantos = adelantos.filter(a => !a.despachador_id);
        if (invalidAdelantos.length > 0) {
            return res.status(400).json({ message: 'Todos los adelantos deben tener un despachador asignado' });
        }

        if (adelantos && adelantos.length > 0) {
            const values = adelantos.map(a => [
                parseInt(id),
                a.empleado || '',
                parseFloat(a.monto) || 0,
                a.despachador_id ? parseInt(a.despachador_id) : null
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_adelantos (closeout_id, empleado, monto, despachador_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT a.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_adelantos a
            LEFT JOIN gas_station_despachadores d ON a.despachador_id = d.id
            WHERE a.closeout_id = ?
            ORDER BY a.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'adelantos');
            await logSectionChange(req, id, 'adelantos', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveAdelantos:', error);
        res.status(500).json({ message: 'Error al guardar adelantos' });
    }
};

exports.deleteAdelanto = async (req, res) => {
    try {
        const { id, adelantoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_adelantos WHERE id = ? AND closeout_id = ?`,
                [adelantoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_adelantos WHERE id = ? AND closeout_id = ?`,
            [adelantoId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Adelanto no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'adelantos', deletedRow);
        res.json({ message: 'Adelanto eliminado' });
    } catch (error) {
        console.error('Error deleteAdelanto:', error);
        res.status(500).json({ message: 'Error al eliminar adelanto' });
    }
};

exports.getLubricantReadings = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getLubricantReadings:', error);
        res.status(500).json({ message: 'Error al obtener lecturas de lubricantes' });
    }
};

exports.saveLubricantReadings = async (req, res) => {
    try {
        const { id } = req.params;
        const { readings } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'lubricantes');

        await pool.query(`DELETE FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`, [id]);

        if (readings && readings.length > 0) {
            const values = readings.map(r => [
                parseInt(id),
                r.producto_id || null,
                r.producto_codigo || '',
                r.producto_descripcion || '',
                parseFloat(r.lectura_inicial) || 0,
                parseFloat(r.recarga) || 0,
                parseFloat(r.lectura_final) || 0,
                parseFloat(r.ventas) || 0,
                parseFloat(r.precio) || 0,
                parseFloat(r.total) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_lubricant_readings 
                 (closeout_id, producto_id, producto_codigo, producto_descripcion, lectura_inicial, recarga, lectura_final, ventas, precio, total) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`,
            [id]
        );

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'lubricantes');
            await logSectionChange(req, id, 'lubricantes', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveLubricantReadings:', error);
        res.status(500).json({ message: 'Error al guardar lecturas de lubricantes' });
    }
};

exports.updateCloseoutDespachadores = async (req, res) => {
    try {
        const { id } = req.params;
        const { despachadores } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'No se puede modificar un cierre cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'despachadores');

        await pool.query(
            `DELETE FROM gas_station_closeout_despachadores WHERE closeout_id = ?`,
            [id]
        );

        const savedDespachadores = [];
        if (Array.isArray(despachadores) && despachadores.length > 0) {
            for (const d of despachadores) {
                const [[existing]] = await pool.query(
                    `SELECT id FROM gas_station_despachadores WHERE id = ? AND company_id = ?`,
                    [d.despachador_id, req.company_id]
                );
                if (existing) {
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachadores (closeout_id, despachador_id, nombre) VALUES (?, ?, ?)`,
                        [id, d.despachador_id, d.nombre || '']
                    );
                    savedDespachadores.push({ despachador_id: d.despachador_id, nombre: d.nombre || '' });
                }
            }
        }

        await pool.query(
            `DELETE FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
            [id]
        );
        const savedIds = savedDespachadores.map(d => d.despachador_id);
        if (savedIds.length > 0) {
            const [liveAssignments] = await pool.query(
                `SELECT despachador_id, nozzle_id FROM gas_station_despachador_nozzles
                 WHERE company_id = ? AND despachador_id IN (?)`,
                [req.company_id, savedIds]
            );
            for (const a of liveAssignments) {
                await pool.query(
                    `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id) VALUES (?, ?, ?)`,
                    [id, a.despachador_id, a.nozzle_id]
                );
            }
        }

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'despachadores');
            await logSectionChange(req, id, 'despachadores', beforeRows, afterRows);
        }

        res.json({ despachadores: savedDespachadores });
    } catch (error) {
        console.error('Error updateCloseoutDespachadores:', error);
        res.status(500).json({ message: 'Error al actualizar despachadores' });
    }
};

exports.updateCloseoutDespachadorNozzles = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignments } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'No se puede modificar un cierre cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'nozzles');

        await pool.query(
            `DELETE FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
            [id]
        );

        if (Array.isArray(assignments) && assignments.length > 0) {
            for (const a of assignments) {
                if (!a.despachador_id || !Array.isArray(a.nozzle_ids)) continue;
                for (const nid of a.nozzle_ids) {
                    await pool.query(
                        `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id) VALUES (?, ?, ?)`,
                        [id, a.despachador_id, nid]
                    );
                }
            }
        }

        const [rows] = await pool.query(
            `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`,
            [id]
        );

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'nozzles');
            await logSectionChange(req, id, 'nozzles', beforeRows, afterRows);
        }

        res.json(rows);
    } catch (error) {
        console.error('Error updateCloseoutDespachadorNozzles:', error);
        res.status(500).json({ message: 'Error al actualizar asignaciones de mangueras' });
    }
};

// === Closeout Tarjetas ===

exports.getTarjetas = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT t.*, p.nombre as pos_type_nombre, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_tarjetas t
            LEFT JOIN gas_station_pos_types p ON t.pos_type_id = p.id
            LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
            WHERE t.closeout_id = ?
            ORDER BY t.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getTarjetas:', error);
        res.status(500).json({ message: 'Error al obtener tarjetas' });
    }
};

exports.saveTarjetas = async (req, res) => {
    try {
        const { id } = req.params;
        const { tarjetas } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'tarjetas');

        await pool.query(`DELETE FROM gas_station_closeout_tarjetas WHERE closeout_id = ?`, [id]);

        const invalidTarjetas = tarjetas.filter(t => !t.despachador_id);
        if (invalidTarjetas.length > 0) {
            return res.status(400).json({ message: 'Todas las tarjetas deben tener un despachador asignado' });
        }

        if (tarjetas && tarjetas.length > 0) {
            const values = tarjetas.map(t => [
                parseInt(id),
                t.num_tarjeta || '',
                t.num_autorizacion || '',
                t.pos_type_id ? parseInt(t.pos_type_id) : null,
                t.despachador_id ? parseInt(t.despachador_id) : null,
                t.tipo_operacion || 'venta_combustible',
                parseFloat(t.monto) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_tarjetas (closeout_id, num_tarjeta, num_autorizacion, pos_type_id, despachador_id, tipo_operacion, monto) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT t.*, p.nombre as pos_type_nombre, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_tarjetas t
            LEFT JOIN gas_station_pos_types p ON t.pos_type_id = p.id
            LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
            WHERE t.closeout_id = ?
            ORDER BY t.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'tarjetas');
            await logSectionChange(req, id, 'tarjetas', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveTarjetas:', error);
        res.status(500).json({ message: 'Error al guardar tarjetas' });
    }
};

exports.deleteTarjeta = async (req, res) => {
    try {
        const { id, tarjetaId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_tarjetas WHERE id = ? AND closeout_id = ?`,
                [tarjetaId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_tarjetas WHERE id = ? AND closeout_id = ?`, [tarjetaId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'tarjetas', deletedRow);
        res.json({ message: 'Tarjeta eliminada' });
    } catch (error) {
        console.error('Error deleteTarjeta:', error);
        res.status(500).json({ message: 'Error al eliminar tarjeta' });
    }
};

// === Closeout Creditos ===

exports.getCreditos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_creditos c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getCreditos:', error);
        res.status(500).json({ message: 'Error al obtener créditos' });
    }
};

exports.saveCreditos = async (req, res) => {
    try {
        const { id } = req.params;
        const { creditos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'creditos');

        await pool.query(`DELETE FROM gas_station_closeout_creditos WHERE closeout_id = ?`, [id]);

        const invalidCreditos = creditos.filter(c => !c.despachador_id);
        if (invalidCreditos.length > 0) {
            return res.status(400).json({ message: 'Todos los créditos deben tener un despachador asignado' });
        }

        if (creditos && creditos.length > 0) {
            const values = creditos.map(c => [
                parseInt(id),
                c.documento || '',
                c.tipo_documento || 'FAC',
                c.cliente_id ? parseInt(c.cliente_id) : null,
                c.cliente_nombre || '',
                c.producto_codigo || '',
                c.producto_descripcion || '',
                c.despachador_id ? parseInt(c.despachador_id) : null,
                parseFloat(c.cantidad) || 0,
                parseFloat(c.precio) || 0,
                parseFloat(c.monto) || 0,
                c.placa || '',
                c.kilometraje || ''
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_creditos (closeout_id, documento, tipo_documento, cliente_id, cliente_nombre, producto_codigo, producto_descripcion, despachador_id, cantidad, precio, monto, placa, kilometraje) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT c.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_creditos c
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            WHERE c.closeout_id = ?
            ORDER BY c.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'creditos');
            await logSectionChange(req, id, 'creditos', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveCreditos:', error);
        res.status(500).json({ message: 'Error al guardar créditos' });
    }
};

exports.deleteCredito = async (req, res) => {
    try {
        const { id, creditoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_creditos WHERE id = ? AND closeout_id = ?`,
                [creditoId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_creditos WHERE id = ? AND closeout_id = ?`, [creditoId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'creditos', deletedRow);
        res.json({ message: 'Crédito eliminado' });
    } catch (error) {
        console.error('Error deleteCredito:', error);
        res.status(500).json({ message: 'Error al eliminar crédito' });
    }
};

// === Closeout Vales ===

exports.getVales = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT v.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_vales v
            LEFT JOIN gas_station_despachadores d ON v.despachador_id = d.id
            WHERE v.closeout_id = ?
            ORDER BY v.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getVales:', error);
        res.status(500).json({ message: 'Error al obtener vales' });
    }
};

exports.saveVales = async (req, res) => {
    try {
        const { id } = req.params;
        const { vales } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'vales');

        await pool.query(`DELETE FROM gas_station_closeout_vales WHERE closeout_id = ?`, [id]);

        const invalidVales = vales.filter(v => !v.despachador_id);
        if (invalidVales.length > 0) {
            return res.status(400).json({ message: 'Todos los vales deben tener un despachador asignado' });
        }

        if (vales && vales.length > 0) {
            const values = vales.map(v => [
                parseInt(id),
                v.documento || '',
                v.tipo_documento || 'FAC',
                v.cliente_id ? parseInt(v.cliente_id) : null,
                v.cliente_nombre || '',
                v.producto_codigo || '',
                v.producto_descripcion || '',
                v.despachador_id ? parseInt(v.despachador_id) : null,
                parseFloat(v.cantidad) || 0,
                parseFloat(v.precio) || 0,
                parseFloat(v.monto) || 0,
                v.placa || '',
                v.kilometraje || ''
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_vales (closeout_id, documento, tipo_documento, cliente_id, cliente_nombre, producto_codigo, producto_descripcion, despachador_id, cantidad, precio, monto, placa, kilometraje) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT v.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_vales v
            LEFT JOIN gas_station_despachadores d ON v.despachador_id = d.id
            WHERE v.closeout_id = ?
            ORDER BY v.id ASC
        `, [id]);

        if (isReabierto) {
            const afterRows = await getSectionRows(id, 'vales');
            await logSectionChange(req, id, 'vales', beforeRows, afterRows);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveVales:', error);
        res.status(500).json({ message: 'Error al guardar vales' });
    }
};

exports.deleteVale = async (req, res) => {
    try {
        const { id, valeId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_vales WHERE id = ? AND closeout_id = ?`,
                [valeId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_vales WHERE id = ? AND closeout_id = ?`, [valeId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'vales', deletedRow);
        res.json({ message: 'Vale eliminado' });
    } catch (error) {
        console.error('Error deleteVale:', error);
        res.status(500).json({ message: 'Error al eliminar vale' });
    }
};

async function deductAdvanceByFIFO(pool, companyId, clienteId, monto) {
    const [advances] = await pool.query(
        `SELECT id, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? AND monto_disponible > 0 ORDER BY fecha ASC, id ASC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, parseFloat(adv.monto_disponible));
        await pool.query(
            `UPDATE gas_station_advances SET monto_disponible = monto_disponible - ? WHERE id = ?`,
            [deduct, adv.id]
        );
        remaining -= deduct;
    }
}

async function restoreAdvanceByFIFO(pool, companyId, clienteId, monto) {
    const [advances] = await pool.query(
        `SELECT id, monto, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? ORDER BY fecha DESC, id DESC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, parseFloat(adv.monto) - parseFloat(adv.monto_disponible));
        await pool.query(
            `UPDATE gas_station_advances SET monto_disponible = monto_disponible + ? WHERE id = ?`,
            [restore, adv.id]
        );
        remaining -= restore;
    }
}

// === Closeout Anticipos Despachados ===

exports.getAnticiposDesp = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT ad.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion,
                   COALESCE(ga.total_disponible, 0) AS saldo_disponible
            FROM gas_station_closeout_anticipos_despachados ad
            LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
            LEFT JOIN (
                SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                FROM gas_station_advances
                WHERE company_id = ? AND monto_disponible > 0
                GROUP BY cliente_id
            ) ga ON ga.cliente_id = ad.cliente_id
            WHERE ad.closeout_id = ?
            ORDER BY ad.id ASC
        `, [req.company_id, id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getAnticiposDesp:', error);
        res.status(500).json({ message: 'Error al obtener anticipos despachados' });
    }
};

exports.saveAnticiposDesp = async (req, res) => {
    try {
        const { id } = req.params;
        const { anticipos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const isReabierto = closeouts[0].estado === 'reabierto';
            let beforeRows = [];
            if (isReabierto) {
                const [rows] = await connection.query(
                    `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ? ORDER BY id ASC`,
                    [id]
                );
                beforeRows = rows;
            }

            const [oldAnticipos] = await connection.query(
                `SELECT cliente_id, monto FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`,
                [id]
            );

            for (const old of oldAnticipos) {
                if (old.cliente_id && parseFloat(old.monto) > 0) {
                    await restoreAdvanceByFIFO(connection, req.company_id, old.cliente_id, old.monto);
                }
            }

            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`, [id]);

        const invalidAnticipos = anticipos.filter(a => !a.despachador_id);
        if (invalidAnticipos.length > 0) {
            return res.status(400).json({ message: 'Todos los anticipos deben tener un despachador asignado' });
        }

        const sinCliente = anticipos.filter(a => parseFloat(a.monto) > 0 && !a.cliente_id);
        if (sinCliente.length > 0) {
            return res.status(400).json({ message: 'Debe seleccionar un cliente para el anticipo despachado' });
        }

        if (anticipos && anticipos.length > 0) {
            for (const a of anticipos) {
                    if (a.cliente_id && parseFloat(a.monto) > 0) {
                        const [available] = await connection.query(
                            `SELECT COALESCE(SUM(monto_disponible), 0) as total FROM gas_station_advances WHERE company_id = ? AND cliente_id = ?`,
                            [req.company_id, a.cliente_id]
                        );
                        if (parseFloat(available[0].total) < parseFloat(a.monto)) {
                            throw new Error(`El cliente no tiene suficiente saldo disponible. Se requiere $${parseFloat(a.monto).toFixed(2)}, disponible: $${parseFloat(available[0].total).toFixed(2)}`);
                        }
                        await deductAdvanceByFIFO(connection, req.company_id, a.cliente_id, a.monto);
                    }

                    await connection.query(
                        `INSERT INTO gas_station_closeout_anticipos_despachados (closeout_id, cliente_id, cliente_nombre, documento, tipo_documento, producto_codigo, producto_descripcion, despachador_id, cantidad, precio, monto, placa, kilometraje)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            parseInt(id),
                            a.cliente_id ? parseInt(a.cliente_id) : null,
                            a.cliente_nombre || '',
                            a.documento || '',
                            a.tipo_documento || 'FAC',
                            a.producto_codigo || '',
                            a.producto_descripcion || '',
                            a.despachador_id ? parseInt(a.despachador_id) : null,
                            parseFloat(a.cantidad) || 0,
                            parseFloat(a.precio) || 0,
                            parseFloat(a.monto) || 0,
                            a.placa || '',
                            a.kilometraje || ''
                        ]
                    );
                }
            }

            const [remaining] = await connection.query(`
                SELECT ad.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion,
                       COALESCE(ga.total_disponible, 0) AS saldo_disponible
                FROM gas_station_closeout_anticipos_despachados ad
                LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
                LEFT JOIN (
                    SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                    FROM gas_station_advances
                    WHERE company_id = ? AND monto_disponible > 0
                    GROUP BY cliente_id
                ) ga ON ga.cliente_id = ad.cliente_id
                WHERE ad.closeout_id = ?
                ORDER BY ad.id ASC
            `, [req.company_id, id]);

            await connection.commit();

            if (isReabierto) {
                const afterRows = await getSectionRows(id, 'anticipos');
                await logSectionChange(req, id, 'anticipos', beforeRows, afterRows);
            }

            res.json(remaining);
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error saveAnticiposDesp:', error);
        res.status(500).json({ message: error.message || 'Error al guardar anticipos despachados' });
    }
};

exports.deleteAnticipoDesp = async (req, res) => {
    try {
        const { id, anticipoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [anticipo] = await pool.query(
            `SELECT cliente_id, monto FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`,
            [anticipoId, id]
        );
        if (anticipo.length === 0) return res.status(404).json({ message: 'Anticipo despachado no encontrado' });

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`,
                [anticipoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            if (anticipo[0].cliente_id && parseFloat(anticipo[0].monto) > 0) {
                await restoreAdvanceByFIFO(connection, req.company_id, anticipo[0].cliente_id, anticipo[0].monto);
            }

            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`, [anticipoId, id]);

            await connection.commit();
            if (deletedRow) await logDeleteRow(req, id, 'anticipos', deletedRow);
            res.json({ message: 'Anticipo despachado eliminado' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error deleteAnticipoDesp:', error);
        res.status(500).json({ message: 'Error al eliminar anticipo despachado' });
    }
};

// === Get Last Turno ===

exports.getLastTurno = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT fecha_turno, numero_turno FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
             ORDER BY created_at DESC LIMIT 1`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null]
        );
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (error) {
        console.error('Error getLastTurno:', error);
        res.status(500).json({ message: 'Error al obtener último turno' });
    }
};

exports.getNextTurno = async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ message: 'Fecha requerida' });
        const branchId = req.user?.branch_id || null;
        const [rows] = await pool.query(
            `SELECT COALESCE(MAX(numero_turno), 0) + 1 as next_turno
             FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
             AND fecha_turno = ?`,
            [req.company_id, branchId, branchId, fecha]
        );
        res.json({ next_turno: rows[0].next_turno });
    } catch (error) {
        console.error('Error getNextTurno:', error);
        res.status(500).json({ message: 'Error al obtener próximo turno' });
    }
};

// === Print Full Closeout Data ===

exports.getCloseoutPrintData = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(`
            SELECT co.*, c.razon_social as company_name, c.nit as company_nit,
                   c.nombre_comercial as company_commercial_name,
                   b.nombre as branch_name, b.direccion as branch_address,
                   b.telefono as branch_phone
            FROM gas_station_closeouts co
            JOIN companies c ON c.id = co.company_id
            JOIN branches b ON b.id = co.branch_id
            WHERE co.id = ? AND co.company_id = ?
        `, [id, req.company_id]);

        if (closeouts.length === 0) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [readings] = await pool.query(
            `SELECT r.*, p.tipo_combustible
             FROM gas_station_closeout_readings r
             JOIN products p ON r.product_id = p.id
             WHERE r.closeout_id = ? ORDER BY r.codigo_pistola ASC`, [id]
        );

        let tankReadings = [];
        try {
            [tankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad, t.tipo_combustible
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id = ?
                ORDER BY tr.codigo_tanque ASC
            `, [id]);
        } catch (e) { /* table may not exist */ }

        const [despachadores] = await pool.query(
            `SELECT cd.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
             FROM gas_station_closeout_despachadores cd
             JOIN gas_station_despachadores d ON d.id = cd.despachador_id
             WHERE cd.closeout_id = ?`, [id]
        );

        const [gastos] = await pool.query(
            `SELECT e.*, p.nombre as proveedor_nombre FROM gas_station_closeout_expenses e
             LEFT JOIN providers p ON e.provider_id = p.id
             WHERE e.closeout_id = ? ORDER BY e.id ASC`, [id]
        );

        const [remesas] = await pool.query(
            `SELECT * FROM gas_station_closeout_remesas WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [cupones] = await pool.query(
            `SELECT * FROM gas_station_closeout_cupones WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [descuentos] = await pool.query(
            `SELECT * FROM gas_station_closeout_descuentos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [adelantos] = await pool.query(
            `SELECT * FROM gas_station_closeout_adelantos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [lubricantes] = await pool.query(
            `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [tarjetas] = await pool.query(
            `SELECT * FROM gas_station_closeout_tarjetas WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [creditos] = await pool.query(
            `SELECT * FROM gas_station_closeout_creditos WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [vales] = await pool.query(
            `SELECT * FROM gas_station_closeout_vales WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [anticiposDesp] = await pool.query(
            `SELECT ad.*,
                    COALESCE(ga.total_disponible, 0) AS saldo_disponible
             FROM gas_station_closeout_anticipos_despachados ad
             LEFT JOIN (
                 SELECT cliente_id, COALESCE(SUM(monto_disponible), 0) AS total_disponible
                 FROM gas_station_advances
                 WHERE company_id = ? AND monto_disponible > 0
                 GROUP BY cliente_id
             ) ga ON ga.cliente_id = ad.cliente_id
             WHERE ad.closeout_id = ?
             ORDER BY ad.id ASC`, [req.company_id, id]
        );

        const [nozzleAssignments] = await pool.query(
            `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id = ?`, [id]
        );

        res.json({
            closeout: closeouts[0],
            readings,
            tankReadings,
            despachadores,
            despachadorNozzleAssignments: nozzleAssignments,
            gastos: gastos.map(e => ({ ...e, proveedor: e.proveedor_nombre || e.proveedor })),
            remesas,
            cupones,
            descuentos,
            adelantos,
            lubricantes,
            tarjetas,
            creditos,
            vales,
            anticiposDesp
        });
    } catch (error) {
        console.error('Error getCloseoutPrintData:', error);
        res.status(500).json({ message: 'Error al obtener datos de impresión' });
    }
};

exports.sendToRrs = async (req, res) => {
    try {
        const { id } = req.params;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }
        if (closeouts[0].estado !== 'cerrado') {
            return res.status(400).json({ message: 'El cierre debe estar cerrado para enviarlo a RRS' });
        }

        await sendCloseoutToRrs(id, req.company_id);

        await pool.query(
            `UPDATE gas_station_closeouts SET rrs_enviado_at = NOW() WHERE id = ?`,
            [id]
        );

        res.json({ message: 'Cierre enviado a RRS exitosamente' });
    } catch (error) {
        console.error('Error sendToRrs:', error);
        res.status(500).json({ message: error.message || 'Error al enviar cierre a RRS' });
    }
};

exports.getVentasComparacion = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const [closeouts] = await pool.query(
            `SELECT c.fecha_turno, c.numero_turno, c.branch_id
             FROM gas_station_closeouts c WHERE c.id = ? AND c.company_id = ?`,
            [id, company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });

        const { fecha_turno, numero_turno, branch_id } = closeouts[0];

        const turnoNum = parseInt(numero_turno, 10) || 0;

        const shiftId = parseInt(req.query.shift_id, 10);
        if (!shiftId) return res.status(400).json({ message: 'Debe seleccionar un turno para consultar las ventas' });

        const [posShift] = await pool.query(
            `SELECT id FROM pos_shifts
             WHERE id = ? AND company_id = ? AND branch_id = ?
             LIMIT 1`,
            [shiftId, company_id, branch_id]
        );
        if (posShift.length === 0) {
            return res.status(400).json({ message: 'El turno seleccionado no existe o no pertenece a la sucursal del cierre' });
        }

        const [rows] = await pool.query(`
            SELECT 
                p.codigo AS codigo_producto,
                p.nombre AS descripcion_producto,
                COALESCE(l.precio, v.precio, 0) AS precio,
                COALESCE(l.lectura_galones, 0) AS lectura_galones,
                COALESCE(l.lectura_monto, 0) AS lectura_monto,
                COALESCE(v.venta_galones, 0) AS venta_galones,
                COALESCE(v.venta_monto, 0) AS venta_monto,
                COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0) AS diferencia_galones,
                (COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0)) * COALESCE(l.precio, v.precio, 0) AS diferencia_monto
            FROM products p
            LEFT JOIN (
                SELECT 
                    r.product_id,
                    AVG(r.precio) AS precio,
                    SUM(COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) AS lectura_galones,
                    ROUND(SUM((COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) * r.precio), 2) AS lectura_monto
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE c.company_id = ? AND c.fecha_turno = ? AND c.branch_id = ?
                  AND (? = 0 OR c.numero_turno = ?)
                GROUP BY r.product_id
            ) l ON p.id = l.product_id
            LEFT JOIN (
                SELECT 
                    si.product_id,
                    AVG(si.precio_unitario) AS precio,
                    SUM(si.cantidad) AS venta_galones,
                    ROUND(SUM(si.cantidad * si.precio_unitario), 2) AS venta_monto
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                WHERE sh.company_id = ? AND DATE(sh.created_at) = ? AND sh.branch_id = ?
                  AND sh.estado != 'anulado'
                  AND ${dteValidoExistsSql('sh')}
                  AND sh.shift_id = ?
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            ORDER BY p.codigo
        `, [
            company_id, fecha_turno, branch_id, turnoNum, turnoNum,
            company_id, fecha_turno, branch_id, shiftId,
            company_id
        ]);

        const totales = {
            lectura_galones: 0, lectura_monto: 0,
            venta_galones: 0, venta_monto: 0,
            diferencia_galones: 0, diferencia_monto: 0,
        };

        for (const row of rows) {
            totales.lectura_galones += parseFloat(row.lectura_galones) || 0;
            totales.lectura_monto += parseFloat(row.lectura_monto) || 0;
            totales.venta_galones += parseFloat(row.venta_galones) || 0;
            totales.venta_monto += parseFloat(row.venta_monto) || 0;
            totales.diferencia_galones += parseFloat(row.diferencia_galones) || 0;
            totales.diferencia_monto += parseFloat(row.diferencia_monto) || 0;
        }

        res.json({ data: rows, totales, fecha: fecha_turno, turno: numero_turno, shiftMatch: true, matchedShiftId: shiftId, branch_id });
    } catch (error) {
        console.error('Error getVentasComparacion:', error);
        res.status(500).json({ message: 'Error al obtener comparacion de ventas' });
    }
};

exports.generarComplementaria = async (req, res) => {
    const { id } = req.params;
    const company_id = req.company_id;

    try {
        const [closeouts] = await pool.query(
            `SELECT c.fecha_turno, c.numero_turno, c.branch_id
             FROM gas_station_closeouts c WHERE c.id = ? AND c.company_id = ?`,
            [id, company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });

        const { fecha_turno, numero_turno, branch_id } = closeouts[0];
        const turnoNum = parseInt(numero_turno, 10) || 0;

        const { shift_id } = req.body || {};

        if (!shift_id) {
            return res.status(400).json({ message: 'Debe seleccionar el turno destino para generar la complementaria' });
        }

        const [posShiftRows] = await pool.query(
            `SELECT id, seller_id, pos_id, branch_id, status FROM pos_shifts
             WHERE id = ? AND company_id = ?`,
            [Number(shift_id), company_id]
        );
        if (posShiftRows.length === 0) {
            return res.status(400).json({ message: 'El turno destino no existe o no pertenece a esta empresa' });
        }
        if (Number(posShiftRows[0].branch_id) !== Number(branch_id)) {
            return res.status(400).json({ message: 'El turno destino no pertenece a la sucursal del cierre' });
        }
        const posShift = posShiftRows;

        let codPuntoVentaMH = null;
        if (posShift[0].pos_id) {
            const [pos] = await pool.query('SELECT codigo FROM points_of_sale WHERE id = ?', [posShift[0].pos_id]);
            if (pos.length > 0) codPuntoVentaMH = pos[0].codigo;
        }

        const [rows] = await pool.query(`
            SELECT 
                p.id AS product_id,
                p.codigo AS codigo_producto,
                p.nombre AS descripcion_producto,
                COALESCE(l.precio, v.precio, 0) AS precio,
                COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0) AS diferencia_galones,
                (COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0)) * COALESCE(l.precio, v.precio, 0) AS diferencia_monto
            FROM products p
            LEFT JOIN (
                SELECT r.product_id, AVG(r.precio) AS precio,
                    SUM(COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) AS lectura_galones,
                    ROUND(SUM((COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) * r.precio), 2) AS lectura_monto
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE c.company_id = ? AND c.fecha_turno = ? AND c.branch_id = ? AND (? = 0 OR c.numero_turno = ?)
                GROUP BY r.product_id
            ) l ON p.id = l.product_id
            LEFT JOIN (
                SELECT si.product_id, AVG(si.precio_unitario) AS precio,
                    SUM(si.cantidad) AS venta_galones,
                    ROUND(SUM(si.cantidad * si.precio_unitario), 2) AS venta_monto
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                WHERE sh.company_id = ? AND DATE(sh.created_at) = ? AND sh.branch_id = ?
                  AND sh.estado != 'anulado'
                  AND ${dteValidoExistsSql('sh')}
                  AND sh.shift_id = ?
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            HAVING diferencia_galones > 0
            ORDER BY p.codigo
        `, [
            company_id, fecha_turno, branch_id, turnoNum, turnoNum,
            company_id, fecha_turno, branch_id, posShift[0].id,
            company_id
        ]);

        if (rows.length === 0) {
            return res.status(400).json({ message: 'No hay diferencias positivas para generar complementaria' });
        }

        const [companyRows] = await pool.query(
            `SELECT c.id, c.razon_social, c.nit, c.dte_active, c.ambiente,
                    cat.description AS actividad_economica,
                    c.departamento, c.municipio, c.direccion, c.telefono, c.correo
             FROM companies c
             LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
             WHERE c.id = ?`,
            [company_id]
        );
        if (companyRows.length === 0) return res.status(404).json({ message: 'Empresa no encontrada' });
        const company = companyRows[0];

        const [taxCfg] = await pool.query(
            'SELECT fovial_rate, cotrans_rate FROM tax_configurations WHERE company_id = ?',
            [company_id]
        );
        const tasaFovial = taxCfg.length > 0 ? parseFloat(taxCfg[0].fovial_rate) : 0.20;
        const tasaCotran = taxCfg.length > 0 ? parseFloat(taxCfg[0].cotrans_rate) : 0.10;

        const resultados = [];

        for (const r of rows) {
            const cantidad = parseFloat((parseFloat(r.diferencia_galones) || 0).toFixed(5));
            const precio = parseFloat(r.precio) || 0;
            const montoBruto = cantidad * precio;
            if (montoBruto <= 0) continue;

            const fovial = Math.round(cantidad * tasaFovial * 100) / 100;
            const cotrans = Math.round(cantidad * tasaCotran * 100) / 100;
            const ventaGravada = Math.round((montoBruto - fovial - cotrans) * 100) / 100;
            const ivaComplementaria = Math.round((ventaGravada * 13) / 113 * 100) / 100;
            const gravadoNeto = Math.round((ventaGravada - ivaComplementaria) * 100) / 100;
            const montoTotal = Math.round((ventaGravada + fovial + cotrans) * 100) / 100;

            const item = {
                product_id: r.product_id,
                codigo: r.codigo_producto,
                descripcion: r.descripcion_producto,
                cantidad,
                precio_unitario: precio,
                monto_descuento: 0,
                ventaNoSujeta: 0,
                ventaExenta: 0,
                ventaGravada,
                tributos: [
                    { codigo: 'D1', descripcion: 'FOVIAL', valor: fovial },
                    { codigo: 'C8', descripcion: 'COTRANS', valor: cotrans },
                    "20"
                ],
                noGravado: 0,
                ivaItem: 0,
                tipoItem: 1
            };

            const payload = {
                header: {
                    dte_type: '01',
                    customer_id: null,
                    customer_name: 'CONSUMIDOR FINAL',
                    customer_nit: null,
                    customer_nrc: '',
                    customer_dui: '',
                    customer_direccion: company.direccion,
                    customer_telefono: company.telefono,
                    customer_correo: company.correo,
                    branch_id,
                    user_id: req.user?.id,
                    payment_type: 'CONT',
                    fovial,
                    cotrans,
                    taxes: [],
                    total_gravado: gravadoNeto,
                    total_iva: ivaComplementaria,
                    total_pagar: montoTotal,
                    shift_id: posShift[0].id,
                    seller_id: posShift[0].seller_id || null,
                },
                items: [item],
                payments: [{ codigo: '01', monto: montoTotal, referencia: '', plazo: '', periodo: '' }],
                linkedDocuments: [],
                emisor_adicional: {
                    descActividad: company.actividad_economica || '',
                    codPuntoVentaMH: codPuntoVentaMH
                }
            };

            const [saleResult] = await pool.query('INSERT INTO sales_headers SET ?', [{
                company_id,
                branch_id,
                customer_id: null,
                seller_id: payload.header.seller_id,
                shift_id: posShift[0].id,
                pos_id: posShift[0].pos_id,
                dte_type: '01',
                tipo_documento: '01',
                condicion_operacion: 1,
                fecha_emision: new Date(),
                hora_emision: new Date().toTimeString().split(' ')[0],
                estado: 'emitido',
                total_gravado: gravadoNeto,
                total_exento: 0,
                total_nosujetas: 0,
                fovial,
                cotrans,
                total_iva: ivaComplementaria,
                descuento_general: 0,
                iva_percibido: 0,
                iva_retenido: 0,
                total_pagar: montoTotal,
                payment_condition: 1,
                cliente_nombre: 'CONSUMIDOR FINAL',
                observaciones: `Complementaria turno ${fecha_turno} #${turnoNum} - ${r.descripcion_producto}`,
                created_at: new Date()
            }]);
            const saleId = saleResult.insertId;

            await pool.query('INSERT INTO sales_items SET ?', [{
                sale_id: saleId,
                product_id: item.product_id,
                codigo: item.codigo,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                monto_descuento: 0,
                venta_gravada: ventaGravada,
                venta_exenta: 0,
                tributos: JSON.stringify(item.tributos || [])
            }]);

            await pool.query('INSERT INTO sales_payments SET ?', [{
                sale_id: saleId,
                metodo_pago: '01',
                monto: montoTotal,
                referencia: ''
            }]);

            try {
                const dteResult = await dteService.emitDTE(company, payload, saleId);

                if (dteResult.success) {
                    await pool.query(
                        `UPDATE sales_headers SET
                         numero_control = ?, codigo_generacion = ?, sello_recepcion = ?, fh_procesamiento = ?
                         WHERE id = ?`,
                        [dteResult.data.numero_control, dteResult.data.codigo_generacion,
                         dteResult.data.sello_recepcion, dteResult.data.fh_procesamiento, saleId]
                    );
                    resultados.push({
                        producto: r.descripcion_producto,
                        success: true,
                        codigo_generacion: dteResult.data.codigo_generacion,
                        numero_control: dteResult.data.numero_control,
                        total: montoTotal,
                        sale_id: saleId
                    });
                } else if (dteResult.codigo_generacion) {
                    await pool.query(
                        `UPDATE sales_headers SET codigo_generacion = ?, numero_control = ? WHERE id = ?`,
                        [dteResult.codigo_generacion, dteResult.numero_control || null, saleId]
                    );
                    resultados.push({
                        producto: r.descripcion_producto,
                        success: false,
                        partial: true,
                        codigo_generacion: dteResult.codigo_generacion,
                        sale_id: saleId,
                        error: dteResult.error
                    });
                } else {
                    resultados.push({
                        producto: r.descripcion_producto,
                        success: false,
                        sale_id: saleId,
                        error: dteResult.error || 'Error al emitir DTE'
                    });
                }
            } catch (err) {
                resultados.push({
                    producto: r.descripcion_producto,
                    success: false,
                    sale_id: saleId,
                    error: err.message
                });
            }
        }

        const exitosos = resultados.filter(r => r.success).length;
        const fallidos = resultados.filter(r => !r.success).length;

        if (resultados.length === 0) {
            return res.status(400).json({ message: 'No se generó ninguna complementaria' });
        }

        res.json({
            message: `Complementarias generadas: ${exitosos} exitosas, ${fallidos} fallidas`,
            resultados,
            total_exitosos: exitosos,
            total_fallidos: fallidos
        });
    } catch (error) {
        console.error('Error generarComplementaria:', error);
        res.status(500).json({ message: error.message || 'Error al generar complementaria' });
    }
};

// === Accumulated Daily Closeout Print Data ===

exports.getAccumulatedDayPrintData = async (req, res) => {
    try {
        const { fecha, branch_id } = req.query;

        if (!fecha || !branch_id) {
            return res.status(400).json({ message: 'fecha y branch_id son requeridos' });
        }

        const [closeouts] = await pool.query(`
            SELECT co.*, c.razon_social as company_name, c.nit as company_nit,
                   c.nombre_comercial as company_commercial_name,
                   b.nombre as branch_name, b.direccion as branch_address,
                   b.telefono as branch_phone
            FROM gas_station_closeouts co
            JOIN companies c ON c.id = co.company_id
            JOIN branches b ON b.id = co.branch_id
            WHERE co.fecha_turno = ? AND co.branch_id = ? AND co.company_id = ?
            ORDER BY co.numero_turno ASC
        `, [fecha, branch_id, req.company_id]);

        if (closeouts.length === 0) {
            return res.status(404).json({ message: 'No hay cierres para esta fecha y sucursal' });
        }

        const base = closeouts[0];
        const closeoutIds = closeouts.map(c => c.id);

        // Build synthetic accumulated closeout
        const accumulated = {
            ...base,
            id: null,
            numero_turno: 'ACUMULADO',
            total_venta: 0,
            total_venta_efectivo: 0,
            total_venta_tarjeta: 0,
            total_venta_credito: 0,
            total_venta_vale: 0,
            total_venta_anticipos: 0,
            total_venta_diesel: 0,
            total_venta_regular: 0,
            total_venta_premium: 0,
            total_efectivo: 0,
            total_ajuste_pos: 0,
            diferencia: 0,
            created_at: null,
            updated_at: null
        };

        for (const c of closeouts) {
            accumulated.total_venta += Number(c.total_venta || 0);
            accumulated.total_venta_efectivo += Number(c.total_venta_efectivo || 0);
            accumulated.total_venta_tarjeta += Number(c.total_venta_tarjeta || 0);
            accumulated.total_venta_credito += Number(c.total_venta_credito || 0);
            accumulated.total_venta_vale += Number(c.total_venta_vale || 0);
            accumulated.total_venta_anticipos += Number(c.total_venta_anticipos || 0);
            accumulated.total_venta_diesel += Number(c.total_venta_diesel || 0);
            accumulated.total_venta_regular += Number(c.total_venta_regular || 0);
            accumulated.total_venta_premium += Number(c.total_venta_premium || 0);
            accumulated.total_efectivo += Number(c.total_efectivo || 0);
            accumulated.total_ajuste_pos += Number(c.total_ajuste_pos || 0);
            accumulated.diferencia += Number(c.diferencia || 0);
        }

        // Aggregate readings across all closeouts
        const placeholders = closeoutIds.map(() => '?').join(',');
        const [allReadings] = await pool.query(`
            SELECT * FROM gas_station_closeout_readings
            WHERE closeout_id IN (${placeholders})
            ORDER BY codigo_pistola ASC, closeout_id ASC
        `, closeoutIds);

        const aggrReadings = {};
        for (const r of allReadings) {
            const key = r.nozzle_id;
            if (aggrReadings[key]) {
                aggrReadings[key].lectura_actual = Number(r.lectura_actual || 0);
                aggrReadings[key].calibracion += Number(r.calibracion || 0);
                aggrReadings[key].total_galones += Number(r.total_galones || 0);
                aggrReadings[key].total_venta += Number(r.total_venta || 0);
                aggrReadings[key].total_venta_efectivo += Number(r.total_venta_efectivo || 0);
                aggrReadings[key].total_venta_tarjeta += Number(r.total_venta_tarjeta || 0);
                aggrReadings[key].total_venta_credito += Number(r.total_venta_credito || 0);
                aggrReadings[key].total_venta_vale += Number(r.total_venta_vale || 0);
                aggrReadings[key].total_venta_anticipos += Number(r.total_venta_anticipos || 0);
            } else {
                aggrReadings[key] = {
                    ...r,
                    lectura_anterior: Number(r.lectura_anterior || 0),
                    lectura_actual: Number(r.lectura_actual || 0),
                    calibracion: Number(r.calibracion || 0),
                    total_galones: Number(r.total_galones || 0),
                    total_venta: Number(r.total_venta || 0),
                    total_venta_efectivo: Number(r.total_venta_efectivo || 0),
                    total_venta_tarjeta: Number(r.total_venta_tarjeta || 0),
                    total_venta_credito: Number(r.total_venta_credito || 0),
                    total_venta_vale: Number(r.total_venta_vale || 0),
                    total_venta_anticipos: Number(r.total_venta_anticipos || 0)
                };
            }
        }
        const readings = Object.values(aggrReadings);

        // Tank readings - get last for each tank
        let tankReadings = [];
        try {
            const [allTankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id IN (${placeholders})
                ORDER BY tr.codigo_tanque ASC, tr.closeout_id ASC
            `, closeoutIds);

            const aggrTank = {};
            for (const tr of allTankReadings) {
                if (aggrTank[tr.tank_id]) {
                    aggrTank[tr.tank_id].lectura_actual = tr.lectura_actual;
                    aggrTank[tr.tank_id].recarga = (parseFloat(aggrTank[tr.tank_id].recarga) || 0) + (parseFloat(tr.recarga) || 0);
                } else {
                    aggrTank[tr.tank_id] = {
                        ...tr,
                        lectura_anterior: tr.lectura_anterior,
                        lectura_actual: tr.lectura_actual,
                        recarga: tr.recarga
                    };
                }
            }
            tankReadings = Object.values(aggrTank);
        } catch (e) { /* table may not exist */ }

        // Despachadores - aggregate
        const [allDespachadores] = await pool.query(`
            SELECT cd.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_despachadores cd
            JOIN gas_station_despachadores d ON d.id = cd.despachador_id
            WHERE cd.closeout_id IN (${placeholders})
        `, closeoutIds);

        const aggrDesp = {};
        for (const d of allDespachadores) {
            const key = d.despachador_id;
            if (aggrDesp[key]) {
                aggrDesp[key].total_venta += Number(d.total_venta || 0);
                aggrDesp[key].total_no_percibido += Number(d.total_no_percibido || 0);
                aggrDesp[key].total_entregado += Number(d.total_entregado || 0);
            } else {
                aggrDesp[key] = { ...d };
            }
        }
        const despachadores = Object.values(aggrDesp);

        const aggregateRows = async (table) => {
            const [rows] = await pool.query(
                `SELECT * FROM ${table} WHERE closeout_id IN (${placeholders}) ORDER BY id ASC`,
                closeoutIds
            );
            return rows;
        };

        const gastos = await aggregateRows('gas_station_closeout_expenses');
        const remesas = await aggregateRows('gas_station_closeout_remesas');
        const cupones = await aggregateRows('gas_station_closeout_cupones');
        const descuentos = await aggregateRows('gas_station_closeout_descuentos');
        const adelantos = await aggregateRows('gas_station_closeout_adelantos');
        const lubricantes = await aggregateRows('gas_station_closeout_lubricant_readings');
        const tarjetas = await aggregateRows('gas_station_closeout_tarjetas');
        const creditos = await aggregateRows('gas_station_closeout_creditos');
        const vales = await aggregateRows('gas_station_closeout_vales');
        let anticiposDesp = [];
        try {
            [anticiposDesp] = await pool.query(
                `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE closeout_id IN (${placeholders}) ORDER BY id ASC`,
                closeoutIds
            );
        } catch (e) { /* table may not exist */ }

        let nozzleAssignments = [];
        try {
            [nozzleAssignments] = await pool.query(
                `SELECT * FROM gas_station_closeout_despachador_nozzles WHERE closeout_id IN (${placeholders})`,
                closeoutIds
            );
        } catch (e) { /* table may not exist */ }

        res.json({
            closeout: accumulated,
            readings,
            tankReadings,
            despachadores,
            despachadorNozzleAssignments: nozzleAssignments,
            gastos: gastos.map(e => ({ ...e, proveedor: e.proveedor_nombre || e.proveedor })),
            remesas,
            cupones,
            descuentos,
            adelantos,
            lubricantes,
            tarjetas,
            creditos,
            vales,
            anticiposDesp
        });
    } catch (error) {
        console.error('Error getAccumulatedDayPrintData:', error);
        res.status(500).json({ message: 'Error al obtener datos de cierre acumulado' });
    }
};
