const pool = require('../config/db');

const parseDecimal = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
};

// ============================================================
// SERVICIOS
// ============================================================

exports.getServicios = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = 'WHERE company_id = ? AND branch_id = ?';
        const params = [req.company_id, req.user.branch_id];
        if (search) {
            where += ' AND (codigo LIKE ? OR descripcion LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM pozo_servicios ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(
            `SELECT * FROM pozo_servicios ${where} ORDER BY codigo ASC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getServicios:', error);
        res.status(500).json({ message: 'Error al obtener servicios' });
    }
};

exports.createServicio = async (req, res) => {
    try {
        const { codigo, descripcion, monto } = req.body;
        if (!codigo || !String(codigo).trim()) return res.status(400).json({ message: 'El código es obligatorio' });
        if (parseDecimal(monto) <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a cero' });
        const [result] = await pool.query(
            `INSERT INTO pozo_servicios (company_id, branch_id, codigo, descripcion, monto) VALUES (?, ?, ?, ?, ?)`,
            [req.company_id, req.user.branch_id, String(codigo).trim(), String(descripcion || '').trim(), parseDecimal(monto)]
        );
        res.status(201).json({ id: result.insertId, codigo: String(codigo).trim(), descripcion: String(descripcion || '').trim(), monto: parseDecimal(monto) });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un servicio con ese código' });
        console.error('Error createServicio:', error);
        res.status(500).json({ message: 'Error al crear servicio' });
    }
};

exports.updateServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, descripcion, monto } = req.body;
        if (!codigo || !String(codigo).trim()) return res.status(400).json({ message: 'El código es obligatorio' });
        if (parseDecimal(monto) <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a cero' });
        const [result] = await pool.query(
            `UPDATE pozo_servicios SET codigo = ?, descripcion = ?, monto = ? WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [String(codigo).trim(), String(descripcion || '').trim(), parseDecimal(monto), id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json({ message: 'Servicio actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un servicio con ese código' });
        console.error('Error updateServicio:', error);
        res.status(500).json({ message: 'Error al actualizar servicio' });
    }
};

exports.deleteServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM pozo_servicios WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Servicio no encontrado' });
        res.json({ message: 'Servicio eliminado' });
    } catch (error) {
        console.error('Error deleteServicio:', error);
        res.status(500).json({ message: 'Error al eliminar servicio' });
    }
};

// ============================================================
// DESPACHOS
// ============================================================

const selectDespachosBase = `
    SELECT d.*,
           COUNT(ds.id) as total_servicios,
           COALESCE(SUM(ds.subtotal), 0) as monto_total
    FROM pozo_despachos d
    LEFT JOIN pozo_despacho_servicios ds ON ds.despacho_id = d.id
`;

exports.getDespachos = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = 'WHERE d.company_id = ? AND d.branch_id = ?';
        const params = [req.company_id, req.user.branch_id];
        if (search) {
            where += ' AND (d.numero LIKE ? OR d.cliente LIKE ? OR d.placa LIKE ? OR d.encargado LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM pozo_despachos d ${where}`,
            params
        );
        const total = countResult[0].total;
        const [rows] = await pool.query(
            `${selectDespachosBase} ${where} GROUP BY d.id ORDER BY d.fecha DESC, d.id DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getDespachos:', error);
        res.status(500).json({ message: 'Error al obtener despachos' });
    }
};

exports.getDespacho = async (req, res) => {
    try {
        const { id } = req.params;
        const [despachos] = await pool.query(
            `${selectDespachosBase} WHERE d.id = ? AND d.company_id = ? AND d.branch_id = ? GROUP BY d.id`,
            [id, req.company_id, req.user.branch_id]
        );
        if (despachos.length === 0) return res.status(404).json({ message: 'Despacho no encontrado' });

        const [servicios] = await pool.query(
            `SELECT ds.id, ds.servicio_id, ds.cantidad, ds.monto, ds.subtotal,
                    s.codigo as servicio_codigo, s.descripcion as servicio_descripcion
             FROM pozo_despacho_servicios ds
             LEFT JOIN pozo_servicios s ON s.id = ds.servicio_id
             WHERE ds.despacho_id = ?
             ORDER BY ds.id ASC`,
            [id]
        );

        res.json({ ...despachos[0], servicios });
    } catch (error) {
        console.error('Error getDespacho:', error);
        res.status(500).json({ message: 'Error al obtener despacho' });
    }
};

const normalizeServicios = (servicios) => {
    if (!Array.isArray(servicios)) return [];
    return servicios
        .map(s => ({
            servicio_id: parseInt(s.servicio_id) || null,
            cantidad: parseDecimal(s.cantidad),
            monto: parseDecimal(s.monto),
        }))
        .filter(s => s.cantidad > 0 && s.monto > 0);
};

exports.createDespacho = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { numero, fecha, encargado, cliente, placa, hora_entrada, hora_salida, odometro_inicial, odometro_final, servicios } = req.body;
        if (!fecha) return res.status(400).json({ message: 'La fecha es obligatoria' });

        const items = normalizeServicios(servicios);
        if (items.length === 0) return res.status(400).json({ message: 'Debe agregar al menos un servicio con cantidad y monto válidos' });

        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO pozo_despachos (company_id, branch_id, numero, fecha, encargado, cliente, placa, hora_entrada, hora_salida, odometro_inicial, odometro_final)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id, req.user.branch_id,
                String(numero || '').trim(), fecha,
                String(encargado || '').trim(), String(cliente || '').trim(), String(placa || '').trim(),
                hora_entrada || null, hora_salida || null,
                odometro_inicial != null && odometro_inicial !== '' ? parseInt(odometro_inicial) : null,
                odometro_final != null && odometro_final !== '' ? parseInt(odometro_final) : null,
            ]
        );
        const despachoId = result.insertId;

        await conn.query(
            `INSERT INTO pozo_despacho_servicios (despacho_id, servicio_id, cantidad, monto, subtotal) VALUES ?`,
            [items.map(i => [despachoId, i.servicio_id, i.cantidad, i.monto, (i.cantidad * i.monto)])]
        );

        await conn.commit();
        res.status(201).json({ id: despachoId, message: 'Despacho creado' });
    } catch (error) {
        await conn.rollback();
        console.error('Error createDespacho:', error);
        res.status(500).json({ message: 'Error al crear despacho' });
    } finally {
        conn.release();
    }
};

exports.updateDespacho = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const { numero, fecha, encargado, cliente, placa, hora_entrada, hora_salida, odometro_inicial, odometro_final, servicios } = req.body;
        if (!fecha) return res.status(400).json({ message: 'La fecha es obligatoria' });

        const [despachos] = await conn.query(
            `SELECT id FROM pozo_despachos WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (despachos.length === 0) return res.status(404).json({ message: 'Despacho no encontrado' });

        const items = normalizeServicios(servicios);
        if (items.length === 0) return res.status(400).json({ message: 'Debe agregar al menos un servicio con cantidad y monto válidos' });

        await conn.beginTransaction();

        await conn.query(
            `UPDATE pozo_despachos SET numero = ?, fecha = ?, encargado = ?, cliente = ?, placa = ?, hora_entrada = ?, hora_salida = ?, odometro_inicial = ?, odometro_final = ?
             WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [
                String(numero || '').trim(), fecha,
                String(encargado || '').trim(), String(cliente || '').trim(), String(placa || '').trim(),
                hora_entrada || null, hora_salida || null,
                odometro_inicial != null && odometro_inicial !== '' ? parseInt(odometro_inicial) : null,
                odometro_final != null && odometro_final !== '' ? parseInt(odometro_final) : null,
                id, req.company_id, req.user.branch_id,
            ]
        );

        await conn.query(`DELETE FROM pozo_despacho_servicios WHERE despacho_id = ?`, [id]);

        await conn.query(
            `INSERT INTO pozo_despacho_servicios (despacho_id, servicio_id, cantidad, monto, subtotal) VALUES ?`,
            [items.map(i => [id, i.servicio_id, i.cantidad, i.monto, (i.cantidad * i.monto)])]
        );

        await conn.commit();
        res.json({ message: 'Despacho actualizado' });
    } catch (error) {
        await conn.rollback();
        console.error('Error updateDespacho:', error);
        res.status(500).json({ message: 'Error al actualizar despacho' });
    } finally {
        conn.release();
    }
};

exports.deleteDespacho = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM pozo_despachos WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Despacho no encontrado' });
        res.json({ message: 'Despacho eliminado' });
    } catch (error) {
        console.error('Error deleteDespacho:', error);
        res.status(500).json({ message: 'Error al eliminar despacho' });
    }
};

// ============================================================
// CORTES
// ============================================================

exports.getCortes = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = 'WHERE company_id = ? AND branch_id = ?';
        const params = [req.company_id, req.user.branch_id];
        if (search) {
            where += ' AND encargado LIKE ?';
            params.push(`%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM pozo_cortes ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(
            `SELECT c.*,
                    COALESCE(SUM(g.monto), 0) as total_gastos,
                    COUNT(g.id) as total_gastos_count,
                    COALESCE((SELECT SUM(ds.subtotal)
                              FROM pozo_despachos d
                              LEFT JOIN pozo_despacho_servicios ds ON ds.despacho_id = d.id
                              WHERE d.company_id = c.company_id AND d.branch_id = c.branch_id AND d.fecha = c.fecha), 0) as total_ventas
             FROM pozo_cortes c
             LEFT JOIN pozo_corte_gastos g ON g.corte_id = c.id
             ${where}
             GROUP BY c.id
             ORDER BY c.fecha DESC, c.id DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getCortes:', error);
        res.status(500).json({ message: 'Error al obtener cortes' });
    }
};

exports.getCorte = async (req, res) => {
    try {
        const { id } = req.params;
        const [cortes] = await pool.query(
            `SELECT * FROM pozo_cortes WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (cortes.length === 0) return res.status(404).json({ message: 'Corte no encontrado' });

        const [gastos] = await pool.query(
            `SELECT id, descripcion, monto FROM pozo_corte_gastos WHERE corte_id = ? ORDER BY id ASC`,
            [id]
        );

        res.json({ ...cortes[0], gastos });
    } catch (error) {
        console.error('Error getCorte:', error);
        res.status(500).json({ message: 'Error al obtener corte' });
    }
};

exports.consultarCorte = async (req, res) => {
    try {
        const { fecha } = req.query;
        if (!fecha) return res.status(400).json({ message: 'La fecha es obligatoria' });

        const [despachos] = await pool.query(
            `${selectDespachosBase}
             WHERE d.company_id = ? AND d.branch_id = ? AND d.fecha = ?
             GROUP BY d.id
             ORDER BY d.numero ASC, d.id ASC`,
            [req.company_id, req.user.branch_id, fecha]
        );

        const [odometroRows] = await pool.query(
            `SELECT MIN(odometro_inicial) as odometro_inicial, MAX(odometro_final) as odometro_final,
                    COUNT(*) as total_despachos
             FROM pozo_despachos
             WHERE company_id = ? AND branch_id = ? AND fecha = ?
               AND odometro_inicial IS NOT NULL AND odometro_final IS NOT NULL`,
            [req.company_id, req.user.branch_id, fecha]
        );

        const totalServicios = despachos.reduce((s, d) => s + (parseFloat(d.total_servicios) || 0), 0);
        const montoTotal = despachos.reduce((s, d) => s + (parseFloat(d.monto_total) || 0), 0);

        let corte = null;
        let gastos = [];
        const [cortes] = await pool.query(
            `SELECT * FROM pozo_cortes WHERE company_id = ? AND branch_id = ? AND fecha = ?`,
            [req.company_id, req.user.branch_id, fecha]
        );
        if (cortes.length > 0) {
            corte = cortes[0];
            const [gastoRows] = await pool.query(
                `SELECT id, descripcion, monto FROM pozo_corte_gastos WHERE corte_id = ? ORDER BY id ASC`,
                [cortes[0].id]
            );
            gastos = gastoRows;
        }

        res.json({
            fecha,
            despachos,
            odometro_inicial: odometroRows[0]?.odometro_inicial ?? null,
            odometro_final: odometroRows[0]?.odometro_final ?? null,
            total_despachos: odometroRows[0]?.total_despachos ?? despachos.length,
            total_servicios: totalServicios,
            monto_total: montoTotal,
            corte: corte ? {
                id: corte.id,
                fecha: corte.fecha,
                encargado: corte.encargado,
                estado: corte.estado,
                odometro_final_manual: corte.odometro_final_manual
            } : null,
            gastos,
        });
    } catch (error) {
        console.error('Error consultarCorte:', error);
        res.status(500).json({ message: 'Error al consultar el corte' });
    }
};

exports.saveCorte = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { fecha, encargado, gastos, odometro_final_manual } = req.body;
        if (!fecha) return res.status(400).json({ message: 'La fecha es obligatoria' });

        let odometroValor = null;
        const rawOdo = odometro_final_manual;
        if (rawOdo !== null && rawOdo !== undefined && String(rawOdo).trim() !== '') {
            odometroValor = parseFloat(rawOdo);
            if (isNaN(odometroValor) || odometroValor < 0) {
                return res.status(400).json({ message: 'El valor del odómetro debe ser mayor o igual a cero' });
            }
        }

        const items = (gastos || [])
            .map(g => ({ descripcion: String(g.descripcion || '').trim(), monto: parseDecimal(g.monto) }))
            .filter(g => g.descripcion && g.monto > 0);

        await conn.beginTransaction();

        const [cortes] = await conn.query(
            `SELECT id, estado FROM pozo_cortes WHERE company_id = ? AND branch_id = ? AND fecha = ?`,
            [req.company_id, req.user.branch_id, fecha]
        );

        let corteId;
        if (cortes.length > 0) {
            if (cortes[0].estado === 'cerrado') {
                await conn.rollback();
                return res.status(400).json({ message: 'El corte está cerrado y no puede editarse' });
            }
            corteId = cortes[0].id;
            await conn.query(
                `UPDATE pozo_cortes SET encargado = ?, odometro_final_manual = ? WHERE id = ?`,
                [String(encargado || '').trim(), odometroValor, corteId]
            );
            await conn.query(`DELETE FROM pozo_corte_gastos WHERE corte_id = ?`, [corteId]);
        } else {
            const [result] = await conn.query(
                `INSERT INTO pozo_cortes (company_id, branch_id, fecha, encargado, odometro_final_manual) VALUES (?, ?, ?, ?, ?)`,
                [req.company_id, req.user.branch_id, fecha, String(encargado || '').trim(), odometroValor]
            );
            corteId = result.insertId;
        }

        if (items.length > 0) {
            await conn.query(
                `INSERT INTO pozo_corte_gastos (corte_id, descripcion, monto) VALUES ?`,
                [items.map(g => [corteId, g.descripcion, g.monto])]
            );
        }

        await conn.commit();
        res.json({ id: corteId, message: 'Corte guardado' });
    } catch (error) {
        await conn.rollback();
        console.error('Error saveCorte:', error);
        res.status(500).json({ message: 'Error al guardar el corte' });
    } finally {
        conn.release();
    }
};

exports.deleteCorte = async (req, res) => {
    try {
        const { id } = req.params;
        const [cortes] = await pool.query(
            `SELECT estado FROM pozo_cortes WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (cortes.length === 0) return res.status(404).json({ message: 'Corte no encontrado' });
        if (cortes[0].estado === 'cerrado') return res.status(400).json({ message: 'No se puede eliminar un corte cerrado' });

        await pool.query(
            `DELETE FROM pozo_cortes WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        res.json({ message: 'Corte eliminado' });
    } catch (error) {
        console.error('Error deleteCorte:', error);
        res.status(500).json({ message: 'Error al eliminar corte' });
    }
};

// === CIERRE / REAPERTURA DE CORTES ===

exports.closeCorte = async (req, res) => {
    try {
        const { id } = req.params;
        const [cortes] = await pool.query(
            `SELECT estado FROM pozo_cortes WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (cortes.length === 0) return res.status(404).json({ message: 'Corte no encontrado' });
        if (cortes[0].estado === 'cerrado') return res.status(400).json({ message: 'El corte ya está cerrado' });

        await pool.query(
            `UPDATE pozo_cortes SET estado = 'cerrado' WHERE id = ?`,
            [id]
        );
        res.json({ message: 'Corte cerrado' });
    } catch (error) {
        console.error('Error closeCorte:', error);
        res.status(500).json({ message: 'Error al cerrar el corte' });
    }
};

exports.reopenCorte = async (req, res) => {
    try {
        const { id } = req.params;
        const [cortes] = await pool.query(
            `SELECT estado FROM pozo_cortes WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (cortes.length === 0) return res.status(404).json({ message: 'Corte no encontrado' });
        if (cortes[0].estado !== 'cerrado') return res.status(400).json({ message: 'El corte no está cerrado' });

        await pool.query(
            `UPDATE pozo_cortes SET estado = 'abierto' WHERE id = ?`,
            [id]
        );
        res.json({ message: 'Corte reabierto' });
    } catch (error) {
        console.error('Error reopenCorte:', error);
        res.status(500).json({ message: 'Error al reabrir el corte' });
    }
};

// === PENDIENTE DE ENTREGA DE EFECTIVO (basado en cortes) ===

exports.getPendienteEntregas = async (req, res) => {
    try {
        const [estimadoRows] = await pool.query(
            `SELECT
                COALESCE(SUM(
                    COALESCE((SELECT SUM(ds.subtotal)
                              FROM pozo_despachos d
                              LEFT JOIN pozo_despacho_servicios ds ON ds.despacho_id = d.id
                              WHERE d.company_id = c.company_id AND d.branch_id = c.branch_id AND d.fecha = c.fecha), 0)
                    - COALESCE((SELECT SUM(g.monto)
                                FROM pozo_corte_gastos g WHERE g.corte_id = c.id), 0)
                ), 0) as total_estimado
             FROM pozo_cortes c
             WHERE c.company_id = ? AND c.branch_id = ? AND c.fecha <= CURDATE()`,
            [req.company_id, req.user.branch_id]
        );
        const [entregadoRows] = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) as total_entregado
             FROM pozo_entregas_efectivo
             WHERE company_id = ? AND branch_id = ?`,
            [req.company_id, req.user.branch_id]
        );
        const total_estimado = parseFloat(estimadoRows[0].total_estimado) || 0;
        const total_entregado = parseFloat(entregadoRows[0].total_entregado) || 0;
        res.json({
            total_estimado,
            total_entregado,
            pendiente: total_estimado - total_entregado
        });
    } catch (error) {
        console.error('Error getPendienteEntregas:', error);
        res.status(500).json({ message: 'Error al obtener el pendiente de entrega' });
    }
};

exports.updateCorteOdometroFinal = async (req, res) => {
    try {
        const { id } = req.params;
        const { odometro_final_manual } = req.body;
        const [cortes] = await pool.query(
            `SELECT estado FROM pozo_cortes WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (cortes.length === 0) return res.status(404).json({ message: 'Corte no encontrado' });
        if (cortes[0].estado === 'cerrado') return res.status(400).json({ message: 'El corte está cerrado y no puede editarse' });

        let valor = null;
        const raw = odometro_final_manual;
        if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
            valor = parseFloat(raw);
            if (isNaN(valor) || valor < 0) {
                return res.status(400).json({ message: 'El valor del odómetro debe ser mayor o igual a cero' });
            }
        }

        await pool.query(
            `UPDATE pozo_cortes SET odometro_final_manual = ? WHERE id = ?`,
            [valor, id]
        );
        res.json({ message: 'Odómetro final actualizado' });
    } catch (error) {
        console.error('Error updateCorteOdometroFinal:', error);
        res.status(500).json({ message: 'Error al actualizar el odómetro final' });
    }
};

// ============================================================
// ENTREGAS DE EFECTIVO
// ============================================================

exports.getEntregasEfectivo = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = 'WHERE company_id = ? AND branch_id = ?';
        const params = [req.company_id, req.user.branch_id];
        if (search) {
            where += ' AND (persona_entrega LIKE ? OR persona_recibe LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM pozo_entregas_efectivo ${where}`, params);
        const total = countResult[0].total;
        const [rows] = await pool.query(
            `SELECT * FROM pozo_entregas_efectivo ${where} ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error getEntregasEfectivo:', error);
        res.status(500).json({ message: 'Error al obtener entregas de efectivo' });
    }
};

exports.createEntregaEfectivo = async (req, res) => {
    try {
        const { persona_entrega, persona_recibe, fecha, monto } = req.body;
        if (!persona_entrega || !String(persona_entrega).trim()) return res.status(400).json({ message: 'La persona que entrega es obligatoria' });
        if (!persona_recibe || !String(persona_recibe).trim()) return res.status(400).json({ message: 'La persona que recibe es obligatoria' });
        if (!fecha) return res.status(400).json({ message: 'La fecha es obligatoria' });
        if (parseDecimal(monto) <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a cero' });
        const [result] = await pool.query(
            `INSERT INTO pozo_entregas_efectivo (company_id, branch_id, persona_entrega, persona_recibe, fecha, monto)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.company_id, req.user.branch_id, String(persona_entrega).trim(), String(persona_recibe).trim(), fecha, parseDecimal(monto)]
        );
        res.status(201).json({ id: result.insertId, message: 'Entrega de efectivo registrada' });
    } catch (error) {
        console.error('Error createEntregaEfectivo:', error);
        res.status(500).json({ message: 'Error al registrar entrega de efectivo' });
    }
};

exports.updateEntregaEfectivo = async (req, res) => {
    try {
        const { id } = req.params;
        const { persona_entrega, persona_recibe, fecha, monto } = req.body;
        if (!persona_entrega || !String(persona_entrega).trim()) return res.status(400).json({ message: 'La persona que entrega es obligatoria' });
        if (!persona_recibe || !String(persona_recibe).trim()) return res.status(400).json({ message: 'La persona que recibe es obligatoria' });
        if (!fecha) return res.status(400).json({ message: 'La fecha es obligatoria' });
        if (parseDecimal(monto) <= 0) return res.status(400).json({ message: 'El monto debe ser mayor a cero' });
        const [result] = await pool.query(
            `UPDATE pozo_entregas_efectivo
             SET persona_entrega = ?, persona_recibe = ?, fecha = ?, monto = ?
             WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [String(persona_entrega).trim(), String(persona_recibe).trim(), fecha, parseDecimal(monto), id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Entrega de efectivo no encontrada' });
        res.json({ message: 'Entrega de efectivo actualizada' });
    } catch (error) {
        console.error('Error updateEntregaEfectivo:', error);
        res.status(500).json({ message: 'Error al actualizar entrega de efectivo' });
    }
};

exports.deleteEntregaEfectivo = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM pozo_entregas_efectivo WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Entrega de efectivo no encontrada' });
        res.json({ message: 'Entrega de efectivo eliminada' });
    } catch (error) {
        console.error('Error deleteEntregaEfectivo:', error);
        res.status(500).json({ message: 'Error al eliminar entrega de efectivo' });
    }
};
