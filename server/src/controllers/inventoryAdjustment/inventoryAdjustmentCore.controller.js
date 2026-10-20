const pool = require('../../config/db');
const { getEffectiveProductId } = require('../../utils/inventoryUtils');
const notificationService = require('../../services/notification.service');

const DEFAULT_ADJUSTMENT_MOTIVOS = [
    { nombre: 'ENTRADA POR COMPRA', tipo: 'ENTRADA' },
    { nombre: 'ENTRADA POR DEVOLUCION', tipo: 'ENTRADA' },
    { nombre: 'AJUSTE DE INVENTARIO (ENTRADA)', tipo: 'ENTRADA' },
    { nombre: 'INVENTARIO INICIAL', tipo: 'ENTRADA' },
    { nombre: 'AJUSTE POR DAÑO', tipo: 'SALIDA' },
    { nombre: 'AJUSTE POR PERDIDA', tipo: 'SALIDA' },
    { nombre: 'SALIDA POR DEVOLUCION', tipo: 'SALIDA' },
    { nombre: 'AJUSTE DE INVENTARIO (SALIDA)', tipo: 'SALIDA' },
    { nombre: 'MERMA', tipo: 'SALIDA' }
];

async function ensureCompanyDefaultMotivos(companyId) {
    const [existing] = await pool.query(
        'SELECT id, nombre, tipo FROM inventory_adjustment_motivos WHERE company_id = ?',
        [companyId]
    );
    const hasEntrada = existing.some((r) => r.tipo === 'ENTRADA');
    const hasSalida = existing.some((r) => r.tipo === 'SALIDA');
    if (hasEntrada && hasSalida) return;

    const existingKey = new Set(existing.map((r) => `${r.tipo}:${String(r.nombre || '').trim().toUpperCase()}`));
    for (const item of DEFAULT_ADJUSTMENT_MOTIVOS) {
        const key = `${item.tipo}:${item.nombre}`;
        if (!existingKey.has(key)) {
            await pool.query(
                'INSERT INTO inventory_adjustment_motivos (company_id, nombre, tipo) VALUES (?, ?, ?)',
                [companyId, item.nombre, item.tipo]
            );
        }
    }
}

const getMotivos = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa no encontrado' });
        }
        await ensureCompanyDefaultMotivos(companyId);
        const [rows] = await pool.query(
            'SELECT * FROM inventory_adjustment_motivos WHERE company_id = ? ORDER BY nombre ASC',
            [companyId]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error in getMotivos:', error);
        res.status(500).json({ message: 'Error al obtener motivos: ' + error.message });
    }
};

const createMotivo = async (req, res) => {
    try {
        const { nombre, tipo } = req.body;
        if (!nombre || !tipo) return res.status(400).json({ message: 'Nombre y tipo son requeridos' });

        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) return res.status(400).json({ message: 'Contexto de empresa no encontrado' });

        await pool.query(
            'INSERT INTO inventory_adjustment_motivos (company_id, nombre, tipo) VALUES (?, ?, ?)',
            [companyId, nombre, tipo]
        );
        res.status(201).json({ message: 'Motivo creado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear motivo' });
    }
};

const updateMotivo = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        await pool.query(
            'UPDATE inventory_adjustment_motivos SET nombre = ? WHERE id = ? AND company_id = ?',
            [nombre, id, companyId]
        );
        res.json({ message: 'Motivo actualizado' });
    } catch {
        res.status(500).json({ message: 'Error al actualizar motivo' });
    }
};

const deleteMotivo = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [inUse] = await pool.query(
            'SELECT id FROM inventory_adjustment_headers WHERE motivo_id = ? LIMIT 1',
            [id]
        );
        if (inUse.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar un motivo que ya ha sido utilizado en movimientos' });
        }

        await pool.query(
            'DELETE FROM inventory_adjustment_motivos WHERE id = ? AND company_id = ?',
            [id, companyId]
        );
        res.json({ message: 'Motivo eliminado' });
    } catch {
        res.status(500).json({ message: 'Error al eliminar motivo' });
    }
};

const createAdjustment = async (req, res) => {
    const { branch_id, motivo_id, tipo, numero, fecha, observaciones, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un producto' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) throw new Error('Contexto de empresa no encontrado');
        if (!req.user?.id) throw new Error('Usuario no identificado en la sesión');

        let movementCreatedAt = new Date();
        let docType = 'AJUSTE';

        const [motivoRows] = await connection.query(
            'SELECT nombre FROM inventory_adjustment_motivos WHERE id = ?',
            [motivo_id]
        );
        const isInicial = motivoRows.length > 0 && motivoRows[0].nombre.toUpperCase().includes('INICIAL');

        if (fecha) {
            const fechaStr = typeof fecha === 'string' ? fecha.slice(0, 10) : new Date(fecha).toISOString().slice(0, 10);
            if (isInicial) {
                const prevDay = new Date(`${fechaStr}T12:00:00Z`);
                prevDay.setDate(prevDay.getDate() - 1);
                const prevDayStr = prevDay.toISOString().slice(0, 10);
                movementCreatedAt = `${prevDayStr} 23:59:59`;
                docType = 'INVENTARIO_INICIAL';
            } else {
                const nowTime = new Date().toTimeString().slice(0, 8);
                movementCreatedAt = `${fechaStr} ${nowTime}`;
            }
        }

        const [headerResult] = await connection.query(`
            INSERT INTO inventory_adjustment_headers 
            (company_id, branch_id, usuario_id, motivo_id, tipo, numero, fecha, observaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [companyId, branch_id, req.user.id, motivo_id, tipo, numero || '', fecha || new Date(), observaciones || '']);

        const adjustmentId = headerResult.insertId;

        for (const item of items) {
            const { product_id, cantidad, costo } = item;
            const qty = parseFloat(cantidad);
            const cost = parseFloat(costo);
            const total = qty * cost;

            await connection.query(`
                INSERT INTO inventory_adjustment_items (adjustment_id, product_id, cantidad, costo, total)
                VALUES (?, ?, ?, ?, ?)
            `, [adjustmentId, product_id, qty, cost, total]);

            const [pInfo] = await connection.query(
                'SELECT afecta_inventario, permitir_existencia_negativa FROM products WHERE id = ?',
                [product_id]
            );
            if (pInfo.length === 0) throw new Error(`Producto ID ${product_id} no encontrado`);
            const product = pInfo[0];

            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            if (product.afecta_inventario) {
                if (tipo === 'SALIDA') {
                    const [stockRows] = await connection.query(
                        'SELECT stock FROM inventory WHERE product_id = ? AND branch_id = ?',
                        [effectiveProductId, branch_id]
                    );
                    const currentStock = stockRows.length > 0 ? parseFloat(stockRows[0].stock) : 0;

                    if (currentStock < qty && !product.permitir_existencia_negativa) {
                        throw new Error(`Stock insuficiente para el producto ID ${product_id} (Inventario real ID ${effectiveProductId})`);
                    }

                    await connection.query(
                        'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                        [qty, effectiveProductId, branch_id]
                    );
                } else {
                    const [stockRows] = await connection.query(
                        'SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?',
                        [effectiveProductId, branch_id]
                    );

                    if (stockRows.length > 0) {
                        await connection.query(
                            'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                            [qty, effectiveProductId, branch_id]
                        );
                    } else {
                        await connection.query(
                            'INSERT INTO inventory (product_id, branch_id, stock) VALUES (?, ?, ?)',
                            [effectiveProductId, branch_id, qty]
                        );
                    }
                }

                await connection.query(`
                    INSERT INTO inventory_movements (company_id, product_id, branch_id, tipo_movimiento, cantidad, costo, precio_venta, tipo_documento, documento_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [companyId, effectiveProductId, branch_id, tipo, qty, cost, cost, docType, adjustmentId, movementCreatedAt]);
            }
        }

        await connection.commit();

        notificationService.notify('adjustment_applied', req.company_id, req.user.branch_id, {
            ajuste_id: adjustmentId,
            tipo: tipo,
            items_count: items.length,
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.status(201).json({ id: adjustmentId, message: 'Movimiento registrado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al procesar movimiento' });
    } finally {
        connection.release();
    }
};

const getAdjustments = async (req, res) => {
    try {
        const { search, branch_id, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) return res.status(400).json({ message: 'Contexto de empresa no encontrado' });

        const params = [companyId];
        let whereClause = 'WHERE h.company_id = ?';
        if (branch_id) {
            whereClause += ' AND h.branch_id = ?';
            params.push(branch_id);
        }
        if (search) {
            whereClause += ' AND (h.numero LIKE ? OR h.observaciones LIKE ? OR b.nombre LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        const query = `
            SELECT h.*, b.nombre as branch_name, m.nombre as motivo_name, u.nombre as usuario_nombre,
            (SELECT COUNT(*) FROM inventory_adjustment_items WHERE adjustment_id = h.id) as items_count
            FROM inventory_adjustment_headers h
            JOIN branches b ON h.branch_id = b.id
            JOIN inventory_adjustment_motivos m ON h.motivo_id = m.id
            JOIN users u ON h.usuario_id = u.id
            ${whereClause}
            ORDER BY h.fecha DESC
            LIMIT ? OFFSET ?
        `;

        const countQuery = `
            SELECT COUNT(*) as total 
            FROM inventory_adjustment_headers h
            JOIN branches b ON h.branch_id = b.id
            ${whereClause}
        `;

        const [[{ total }]] = await pool.query(countQuery, params);
        const [rows] = await pool.query(query, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: rows,
            total,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los movimientos' });
    }
};

const getAdjustmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [header] = await pool.query(`
            SELECT h.*, b.nombre as branch_name, m.nombre as motivo_name, u.nombre as usuario_nombre
            FROM inventory_adjustment_headers h
            JOIN branches b ON h.branch_id = b.id
            JOIN inventory_adjustment_motivos m ON h.motivo_id = m.id
            JOIN users u ON h.usuario_id = u.id
            WHERE h.id = ? AND h.company_id = ?
        `, [id, companyId]);

        if (header.length === 0) return res.status(404).json({ message: 'Ajuste no encontrado' });

        const [items] = await pool.query(`
            SELECT i.*, p.nombre, p.codigo
            FROM inventory_adjustment_items i
            JOIN products p ON i.product_id = p.id
            WHERE i.adjustment_id = ?
        `, [id]);

        res.json({ ...header[0], items });
    } catch {
        res.status(500).json({ message: 'Error al obtener detalle del ajuste' });
    }
};

const updateAdjustment = async (req, res) => {
    try {
        const { id } = req.params;
        const { numero, fecha, observaciones } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        const [adj] = await pool.query('SELECT status FROM inventory_adjustment_headers WHERE id = ? AND company_id = ?', [id, companyId]);
        if (adj.length === 0) return res.status(404).json({ message: 'No encontrado' });
        if (adj[0].status === 'ANULADO') return res.status(400).json({ message: 'No se puede editar un ajuste anulado' });

        await pool.query(`
            UPDATE inventory_adjustment_headers 
            SET numero = ?, fecha = ?, observaciones = ?
            WHERE id = ? AND company_id = ?
        `, [numero, fecha, observaciones, id, companyId]);

        res.json({ message: 'Ajuste actualizado correctamente' });
    } catch {
        res.status(500).json({ message: 'Error al actualizar el ajuste' });
    }
};

const voidAdjustment = async (req, res) => {
    const { id } = req.params;
    const companyId = req.company_id || req.user?.company_id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [adjRows] = await connection.query(
            'SELECT * FROM inventory_adjustment_headers WHERE id = ? AND company_id = ?',
            [id, companyId]
        );
        if (adjRows.length === 0) throw new Error('Ajuste no encontrado');
        const header = adjRows[0];
        if (header.status === 'ANULADO') throw new Error('El ajuste ya está anulado');

        const [items] = await connection.query(
            'SELECT * FROM inventory_adjustment_items WHERE adjustment_id = ?',
            [id]
        );

        for (const item of items) {
            const { product_id, cantidad } = item;
            const branch_id = header.branch_id;
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            if (header.tipo === 'ENTRADA') {
                await connection.query(
                    'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                    [cantidad, effectiveProductId, branch_id]
                );
            } else {
                await connection.query(
                    'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [cantidad, effectiveProductId, branch_id]
                );
            }
        }

        await connection.query(
            'DELETE FROM inventory_movements WHERE documento_id = ? AND tipo_documento IN ("AJUSTE", "ANULACION_AJUSTE", "INVENTARIO_INICIAL")',
            [id]
        );

        await connection.query(
            'UPDATE inventory_adjustment_headers SET status = "ANULADO" WHERE id = ?',
            [id]
        );

        await connection.commit();
        res.json({ message: 'Ajuste anulado y stock reversado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al anular el ajuste' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getMotivos,
    createMotivo,
    updateMotivo,
    deleteMotivo,
    createAdjustment,
    getAdjustments,
    getAdjustmentById,
    updateAdjustment,
    voidAdjustment
};
