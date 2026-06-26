const pool = require('../config/db');

exports.initCloseout = async (req, res) => {
    try {
        const { seller_id, seller_name, fecha_turno, numero_turno, despachadores } = req.body;
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

        const [lastTurno] = await pool.query(
            `SELECT DATE_FORMAT(fecha_turno, '%d/%m/%Y') as fecha_turno, numero_turno FROM gas_station_closeouts
             WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
             ORDER BY created_at DESC LIMIT 1`,
            [req.company_id, req.user.branch_id || null, req.user.branch_id || null]
        );

        if (lastTurno.length > 0) {
            const last = lastTurno[0];
            if (fecha_turno < last.fecha_turno) {
                return res.status(400).json({ message: `La fecha del turno no puede ser menor al último turno (${last.fecha_turno})` });
            }
            if (parseInt(numero_turno) <= parseInt(last.numero_turno)) {
                return res.status(400).json({ message: `El número de turno debe ser mayor al último turno (${last.numero_turno})` });
            }
        }

        const [result] = await pool.query(
            `INSERT INTO gas_station_closeouts (company_id, branch_id, seller_id, seller_name, fecha_turno, numero_turno) VALUES (?, ?, ?, ?, ?, ?)`,
            [req.company_id, req.user.branch_id || null, seller_id, seller_name || '', fecha_turno, numero_turno]
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
                `SELECT id, codigo, descripcion FROM gas_station_despachadores WHERE company_id = ? ORDER BY id ASC`,
                [req.company_id]
            );
            for (const d of allDespachadores) {
                await pool.query(
                    `INSERT INTO gas_station_closeout_despachadores (closeout_id, despachador_id, nombre) VALUES (?, ?, ?)`,
                    [closeoutId, d.id, d.descripcion || d.codigo || '']
                );
                savedDespachadores.push({ despachador_id: d.id, nombre: d.descripcion || d.codigo || '' });
            }
        }

        const [nozzles] = await pool.query(`
            SELECT n.id as nozzle_id, n.codigo as codigo_pistola,
                   p.id as product_id, p.codigo as codigo_producto, p.nombre as descripcion_producto,
                   p.precio_unitario
            FROM gas_station_nozzles n
            JOIN products p ON n.product_id = p.id
            WHERE n.company_id = ?
        `, [req.company_id]);

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
                lectura_anterior,
                lectura_actual: lectura_anterior,
                calibracion: 0,
                diferencia: 0,
                monto: 0
            });
        }

        const [tanks] = await pool.query(
            `SELECT id as tank_id, codigo, descripcion, capacidad FROM gas_station_tanks WHERE company_id = ?`,
            [req.company_id]
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
                lectura_anterior,
                recarga: 0,
                lectura_actual: lectura_anterior,
                diferencia: 0
            });
        }

        res.status(201).json({ id: closeoutId, readings, tankReadings, despachadores: savedDespachadores });
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
                SELECT tr.*, t.capacidad
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE tr.closeout_id = ?
                ORDER BY tr.codigo_tanque ASC
            `, [id]);
            return res.json(rows);
        }

        const [tanks] = await pool.query(
            `SELECT id as tank_id, codigo, descripcion, capacidad FROM gas_station_tanks WHERE company_id = ?`,
            [req.company_id]
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
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        let where = 'WHERE c.company_id = ?';
        let params = [req.company_id];

        if (req.user.branch_id) {
            where += ' AND c.branch_id = ?';
            params.push(req.user.branch_id);
        }

        if (search) {
            where += ' AND (c.numero_turno LIKE ? OR c.seller_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM gas_station_closeouts c ${where}`, params
        );
        const total = countResult[0].total;

        const [rows] = await pool.query(`
            SELECT
              c.*,
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
            SELECT * FROM gas_station_closeout_readings
            WHERE closeout_id = ?
            ORDER BY codigo_pistola ASC
        `, [id]);

        let tankReadings = [];
        try {
            [tankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad
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

        res.json({ ...closeouts[0], readings, tankReadings, despachadores });
    } catch (error) {
        console.error('Error getCloseout:', error);
        res.status(500).json({ message: 'Error al obtener cierre de lecturas' });
    }
};

exports.updateReading = async (req, res) => {
    try {
        const { closeoutId, id } = req.params;
        const { lectura_actual, calibracion, lectura_anterior: newAnterior } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado, no se puede modificar' });
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

exports.updateTankReading = async (req, res) => {
    try {
        const { closeoutId, id } = req.params;
        const { lectura_actual, recarga, lectura_anterior: newAnterior } = req.body;

        const [closeouts] = await pool.query(
            `SELECT * FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [closeoutId, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado, no se puede modificar' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const [current] = await pool.query(
            `SELECT lectura_anterior FROM gas_station_closeout_tank_readings WHERE id = ? AND closeout_id = ?`,
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

        const branchId = req.user?.branch_id || null;
        const [settingsRows] = await pool.query(
            `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND setting_key = 'variacion_permitida'`,
            [req.company_id, branchId, branchId]
        );
        const variacionPermitida = parseFloat(settingsRows[0]?.setting_value) || 0;

        if (variacionPermitida > 0) {
            const [[{ totalMonto }]] = await pool.query(
                `SELECT COALESCE(SUM(monto), 0) as totalMonto FROM gas_station_closeout_readings WHERE closeout_id = ?`,
                [id]
            );
            const [[{ lubricantTotal }]] = await pool.query(
                `SELECT COALESCE(SUM(total), 0) as lubricantTotal FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`,
                [id]
            );
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

        res.json({ message: 'Cierre cerrado exitosamente' });
    } catch (error) {
        console.error('Error closeCloseout:', error);
        res.status(500).json({ message: 'Error al cerrar cierre de lecturas' });
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

        await pool.query(`DELETE FROM gas_station_closeout_expenses WHERE closeout_id = ?`, [id]);

        if (expenses && expenses.length > 0) {
            const providerIds = expenses.filter(e => e.provider_id).map(e => parseInt(e.provider_id));
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
                    e.despachador_id ? parseInt(e.despachador_id) : null
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_expenses (closeout_id, rubro, fecha, documento, tipo, provider_id, proveedor, valor, despachador_id) VALUES ?`,
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

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_expenses WHERE id = ? AND closeout_id = ?`,
            [expenseId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Gasto no encontrado' });
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

        // REPLACE-ALL STRATEGY
        await pool.query(`DELETE FROM gas_station_closeout_remesas WHERE closeout_id = ?`, [id]);

        if (remesas && remesas.length > 0) {
            const values = remesas.map(r => [
                parseInt(id),
                r.documento || '',
                r.descripcion || '',
                r.despachador_id ? parseInt(r.despachador_id) : null,
                r.tipo_operacion || 'venta_combustible',
                parseFloat(r.monto) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_remesas (closeout_id, documento, descripcion, despachador_id, tipo_operacion, monto) VALUES ?`,
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

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_remesas WHERE id = ? AND closeout_id = ?`,
            [remesaId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Remesa no encontrada' });
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

        // REPLACE-ALL STRATEGY
        await pool.query(`DELETE FROM gas_station_closeout_cupones WHERE closeout_id = ?`, [id]);

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

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_cupones WHERE id = ? AND closeout_id = ?`,
            [cuponId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Cupón no encontrado' });
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

        await pool.query(`DELETE FROM gas_station_closeout_descuentos WHERE closeout_id = ?`, [id]);

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

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_descuentos WHERE id = ? AND closeout_id = ?`,
            [descuentoId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Descuento no encontrado' });
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

        await pool.query(`DELETE FROM gas_station_closeout_adelantos WHERE closeout_id = ?`, [id]);

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

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_adelantos WHERE id = ? AND closeout_id = ?`,
            [adelantoId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Adelanto no encontrado' });
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

        res.json({ despachadores: savedDespachadores });
    } catch (error) {
        console.error('Error updateCloseoutDespachadores:', error);
        res.status(500).json({ message: 'Error al actualizar despachadores' });
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

        await pool.query(`DELETE FROM gas_station_closeout_tarjetas WHERE closeout_id = ?`, [id]);

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

        await pool.query(`DELETE FROM gas_station_closeout_tarjetas WHERE id = ? AND closeout_id = ?`, [tarjetaId, id]);
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

        await pool.query(`DELETE FROM gas_station_closeout_creditos WHERE closeout_id = ?`, [id]);

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

        await pool.query(`DELETE FROM gas_station_closeout_creditos WHERE id = ? AND closeout_id = ?`, [creditoId, id]);
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

        await pool.query(`DELETE FROM gas_station_closeout_vales WHERE closeout_id = ?`, [id]);

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

        await pool.query(`DELETE FROM gas_station_closeout_vales WHERE id = ? AND closeout_id = ?`, [valeId, id]);
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
        `SELECT id, monto_disponible FROM gas_station_advances WHERE company_id = ? AND cliente_id = ? ORDER BY fecha DESC, id DESC`,
        [companyId, clienteId]
    );
    let remaining = parseFloat(monto);
    for (const adv of advances) {
        if (remaining <= 0) break;
        const restore = Math.min(remaining, parseFloat(adv.monto_disponible));
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
            SELECT ad.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
            FROM gas_station_closeout_anticipos_despachados ad
            LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
            WHERE ad.closeout_id = ?
            ORDER BY ad.id ASC
        `, [id]);
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
                SELECT ad.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
                FROM gas_station_closeout_anticipos_despachados ad
                LEFT JOIN gas_station_despachadores d ON ad.despachador_id = d.id
                WHERE ad.closeout_id = ?
                ORDER BY ad.id ASC
            `, [id]);

            await connection.commit();
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

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            if (anticipo[0].cliente_id && parseFloat(anticipo[0].monto) > 0) {
                await restoreAdvanceByFIFO(connection, req.company_id, anticipo[0].cliente_id, anticipo[0].monto);
            }

            await connection.query(`DELETE FROM gas_station_closeout_anticipos_despachados WHERE id = ? AND closeout_id = ?`, [anticipoId, id]);

            await connection.commit();
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
            `SELECT DATE_FORMAT(fecha_turno, '%d/%m/%Y') as fecha_turno, numero_turno FROM gas_station_closeouts
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
            `SELECT * FROM gas_station_closeout_readings WHERE closeout_id = ? ORDER BY codigo_pistola ASC`, [id]
        );

        let tankReadings = [];
        try {
            [tankReadings] = await pool.query(`
                SELECT tr.*, t.capacidad
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
            `SELECT * FROM gas_station_closeout_anticipos_despachados WHERE closeout_id = ? ORDER BY id ASC`, [id]
        );

        const [nozzleAssignments] = await pool.query(
            `SELECT dn.* FROM gas_station_despachador_nozzles dn
             JOIN gas_station_closeout_despachadores cd ON cd.despachador_id = dn.despachador_id
             WHERE cd.closeout_id = ?`, [id]
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
