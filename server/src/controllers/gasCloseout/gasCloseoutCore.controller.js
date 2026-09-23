const {
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
} = require('./gasCloseoutUtils');


// --- CICLO DE VIDA DEL CIERRE & LECTURAS DE MANGUERAS Y TANQUES ---
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
                    const initFechaStr = toDateStr(fecha_turno);
                    const [prevCloseout] = await pool.query(`
                        SELECT c2.id FROM gas_station_closeouts c2
                        WHERE c2.company_id = ?
                          AND (c2.branch_id = ? OR (? IS NULL AND c2.branch_id IS NULL))
                          AND (
                              c2.fecha_turno < ?
                              OR (c2.fecha_turno = ? AND CAST(c2.numero_turno AS UNSIGNED) < CAST(? AS UNSIGNED))
                          )
                          AND c2.estado IN ('cerrado', 'reabierto')
                          AND EXISTS (SELECT 1 FROM gas_station_closeout_lubricant_readings l WHERE l.closeout_id = c2.id)
                        ORDER BY c2.fecha_turno DESC, CAST(c2.numero_turno AS UNSIGNED) DESC, c2.id DESC
                        LIMIT 1
                    `, [req.company_id, branchId, branchId, initFechaStr, initFechaStr, numero_turno]);

                    let lastLubReadings = [];
                    if (prevCloseout.length > 0) {
                        [lastLubReadings] = await pool.query(`
                            SELECT lr.producto_id, lr.lectura_final
                            FROM gas_station_closeout_lubricant_readings lr
                            WHERE lr.closeout_id = ?
                        `, [prevCloseout[0].id]);
                    }

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
                 COALESCE(ad2.total_anticipos_desp, 0) + COALESCE(tp.total_trupput_desp, 0)) -
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
            LEFT JOIN (SELECT closeout_id, COALESCE(SUM(monto), 0) as total_trupput_desp FROM gas_station_closeout_trupput_despachos GROUP BY closeout_id) tp ON tp.closeout_id = c.id
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
            `SELECT cd.despachador_id, cd.nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
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
            `SELECT e.*, p.nombre as proveedor_nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_expenses e
             LEFT JOIN providers p ON e.provider_id = p.id
             LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = e.closeout_id AND cd.despachador_id = e.despachador_id
             WHERE e.closeout_id = ? ORDER BY e.id ASC`, [id]
        );

        const [remesas] = await pool.query(
            `SELECT r.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_remesas r
             LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
             WHERE r.closeout_id = ? ORDER BY r.id ASC`, [id]
        );

        const [cupones] = await pool.query(
            `SELECT c.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_cupones c
             LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
             WHERE c.closeout_id = ? ORDER BY c.id ASC`, [id]
        );

        const [descuentos] = await pool.query(
            `SELECT d.*, desp.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), desp.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_descuentos d
             LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = d.closeout_id AND cd.despachador_id = d.despachador_id
             WHERE d.closeout_id = ? ORDER BY d.id ASC`, [id]
        );

        const [adelantos] = await pool.query(
            `SELECT a.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_adelantos a
             LEFT JOIN gas_station_despachadores d ON a.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = a.closeout_id AND cd.despachador_id = a.despachador_id
             WHERE a.closeout_id = ? ORDER BY a.id ASC`, [id]
        );

        const [tarjetas] = await pool.query(
            `SELECT t.*, p.nombre as pos_type_nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_tarjetas t
             LEFT JOIN gas_station_pos_types p ON t.pos_type_id = p.id
             LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = t.closeout_id AND cd.despachador_id = t.despachador_id
             WHERE t.closeout_id = ? ORDER BY t.id ASC`, [id]
        );

        const [creditos] = await pool.query(
            `SELECT c.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_creditos c
             LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
             WHERE c.closeout_id = ? ORDER BY c.id ASC`, [id]
        );

        const [vales] = await pool.query(
            `SELECT v.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
             FROM gas_station_closeout_vales v
             LEFT JOIN gas_station_despachadores d ON v.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = v.closeout_id AND cd.despachador_id = v.despachador_id
             WHERE v.closeout_id = ? ORDER BY v.id ASC`, [id]
        );

        const [anticiposDesp] = await pool.query(
            `SELECT ad.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion,
                    COALESCE(ga.total_disponible, 0) AS saldo_disponible
             FROM gas_station_closeout_anticipos_despachados ad
             LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = ad.closeout_id AND cd.despachador_id = ad.despachador_id
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

        const [trupputDesp] = await pool.query(
            `SELECT td.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion,
                    COALESCE(gt.total_galones, 0) AS galones_disponibles
             FROM gas_station_closeout_trupput_despachos td
             LEFT JOIN gas_station_despachadores d ON td.despachador_id = d.id
             LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = td.closeout_id AND cd.despachador_id = td.despachador_id
             LEFT JOIN (
                 SELECT cliente_id, COALESCE(SUM(galones_disponibles), 0) AS total_galones
                 FROM gas_station_trupput
                 WHERE company_id = ? AND galones_disponibles > 0
                 GROUP BY cliente_id
             ) gt ON gt.cliente_id = td.cliente_id
             WHERE td.closeout_id = ?
             ORDER BY td.id ASC`, [req.company_id, id]
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
            trupput_despachos: trupputDesp,
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

        const sanitized = rows.map(r => {
            let details = r.details;
            if (typeof details === 'string') {
                try { details = JSON.parse(details); } catch { details = null; }
            }
            if (!details) return { ...r, details: null };

            // Normalize legacy delete details
            if (r.action === 'delete' && (!details.removed || details.removed.length === 0) && details.before?.length > 0) {
                details.removed = details.before;
            }

            // Remove technical fields from modified diffs and ensure identifier is populated
            if (Array.isArray(details.modified)) {
                details.modified = details.modified.map(m => {
                    const cleanChanges = (m.changes || []).filter(c =>
                        !['created_at', 'updated_at', 'id', 'closeout_id'].includes(c.field)
                    );
                    const rowData = { ...(m.before || {}), ...(m.oldRow || {}), ...(m.row || {}), ...(m.after || {}), ...(typeof m === 'object' ? m : {}) };
                    const identifier = (m.identifier && m.identifier !== 'Tarjeta' && m.identifier !== 'Gasto' && m.identifier !== 'Remesa' && m.identifier !== 'Crédito')
                        ? m.identifier
                        : formatItemLabel(r.section, rowData);
                    return { ...m, changes: cleanChanges, identifier };
                }).filter(m => m.changes.length > 0);
            }

            let description = r.description;
            if (description && Array.isArray(details.modified)) {
                const cfg = CLOSEOUT_SECTIONS[r.section];
                const label = cfg?.label || r.section;
                const newSummary = summarizeDiff(label, {
                    added: details.added || [],
                    removed: details.removed || [],
                    modified: details.modified || []
                });
                description = newSummary || `${label}: sin cambios en valores de negocio`;
            }

            return { ...r, description, details };
        });

        res.json(sanitized);
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

        const isSuperAdmin = req.user?.role === 'SuperAdmin' || req.user?.role?.toLowerCase() === 'superadmin';
        const lectura_anterior = (newAnterior !== undefined && isSuperAdmin) ? parseFloat(newAnterior) : parseFloat(current[0].lectura_anterior);
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

            const [trupputDesp] = await connection.query(
                `SELECT cliente_id, galones FROM gas_station_closeout_trupput_despachos WHERE closeout_id = ?`,
                [id]
            );

            for (const td of trupputDesp) {
                const cid = td.cliente_id;
                const galones = parseFloat(td.galones);
                if (!cid || galones <= 0) continue;
                const [availableTrupput] = await connection.query(
                    `SELECT id, galones_disponibles FROM gas_station_trupput WHERE company_id = ? AND cliente_id = ? AND galones_disponibles > 0 ORDER BY fecha ASC, id ASC`,
                    [req.company_id, cid]
                );
                let remaining = galones;
                for (const t of availableTrupput) {
                    if (remaining <= 0) break;
                    const restore = Math.min(remaining, parseFloat(t.galones_disponibles));
                    await connection.query(
                        `UPDATE gas_station_trupput SET galones_disponibles = galones_disponibles + ? WHERE id = ?`,
                        [restore, t.id]
                    );
                    remaining -= restore;
                }
            }

            // Revert any lubricant movements applied by this closeout
            await revertCloseoutLubricantsInventory(connection, req.company_id, id);

            await connection.query(`DELETE FROM gas_station_closeout_adelantos WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_tank_readings WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_readings WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ?`, [id]);
            await connection.query(`DELETE FROM gas_station_closeout_trupput_despachos WHERE closeout_id = ?`, [id]);
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
            const [[{ trupputDespTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as trupputDespTotal FROM gas_station_closeout_trupput_despachos WHERE closeout_id = ?`,
                [id]
            );

            const diferencia = (parseFloat(gastosTotal) + parseFloat(remesasTotal) + parseFloat(cuponesTotal) + parseFloat(descuentosTotal) + parseFloat(adelantosTotal) + parseFloat(tarjetasTotal) + parseFloat(creditosTotal) + parseFloat(valesTotal) + parseFloat(anticiposDespTotal) + parseFloat(trupputDespTotal)) - (parseFloat(totalMonto) + parseFloat(lubricantTotal));

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

        // Deduct inventory for lubricants sold during this shift closeout
        await applyCloseoutLubricantsInventory(pool, req.company_id, id);

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

        // Revert inventory deduction for lubricants when shift is reopened
        await revertCloseoutLubricantsInventory(pool, req.company_id, id);

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


// --- CONSULTAS DE CORRELATIVO DE TURNO ---
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

