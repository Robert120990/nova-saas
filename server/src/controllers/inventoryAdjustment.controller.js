const pool = require('../config/db');
const { getEffectiveProductId } = require('../utils/inventoryUtils');

const getMotivos = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
             return res.status(400).json({ message: 'Contexto de empresa no encontrado' });
        }
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
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar motivo' });
    }
};

const deleteMotivo = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        // Verificar si está en uso
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
    } catch (error) {
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
        // 1. Crear encabezado
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) throw new Error('Contexto de empresa no encontrado');
        if (!req.user?.id) throw new Error('Usuario no identificado en la sesión');

        console.log('Creating adjustment with items:', items.length);

        const [headerResult] = await connection.query(`
            INSERT INTO inventory_adjustment_headers 
            (company_id, branch_id, usuario_id, motivo_id, tipo, numero, fecha, observaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [companyId, branch_id, req.user.id, motivo_id, tipo, numero, fecha || new Date(), observaciones]);

        const adjustmentId = headerResult.insertId;

        for (const item of items) {
            const { product_id, cantidad, costo } = item;
            const qty = parseFloat(cantidad);
            const cost = parseFloat(costo);
            const total = qty * cost;

            // Registrar item
            await connection.query(`
                INSERT INTO inventory_adjustment_items (adjustment_id, product_id, cantidad, costo, total)
                VALUES (?, ?, ?, ?, ?)
            `, [adjustmentId, product_id, qty, cost, total]);

            // Obtener info del producto para validaciones
            const [pInfo] = await connection.query(
                'SELECT afecta_inventario, permitir_existencia_negativa FROM products WHERE id = ?',
                [product_id]
            );
            if (pInfo.length === 0) throw new Error(`Producto ID ${product_id} no encontrado`);
            const product = pInfo[0];

            // Resolver ID efectivo para inventario
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            if (product.afecta_inventario) {
                if (tipo === 'SALIDA') {
                    // Verificar stock
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
                    // ENTRADA
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

                // Registrar en log de movimientos (Kardex) (usamos el ID efectivo)
                await connection.query(`
                    INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, precio_venta, tipo_documento, documento_id)
                    VALUES (?, ?, ?, ?, ?, 'AJUSTE', ?)
                `, [effectiveProductId, branch_id, tipo, qty, cost, adjustmentId]);
            }
        }

        await connection.commit();
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
        const { search, branch_id, page = 1, limit = 10 } = req.query;
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
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener detalle del ajuste' });
    }
};

const updateAdjustment = async (req, res) => {
    try {
        const { id } = req.params;
        const { numero, fecha, observaciones } = req.body;
        const companyId = req.company_id || req.user?.company_id;

        // Solo permitir editar si no está anulado
        const [adj] = await pool.query('SELECT status FROM inventory_adjustment_headers WHERE id = ? AND company_id = ?', [id, companyId]);
        if (adj.length === 0) return res.status(404).json({ message: 'No encontrado' });
        if (adj[0].status === 'ANULADO') return res.status(400).json({ message: 'No se puede editar un ajuste anulado' });

        await pool.query(`
            UPDATE inventory_adjustment_headers 
            SET numero = ?, fecha = ?, observaciones = ?
            WHERE id = ? AND company_id = ?
        `, [numero, fecha, observaciones, id, companyId]);

        res.json({ message: 'Ajuste actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el ajuste' });
    }
};

const voidAdjustment = async (req, res) => {
    const { id } = req.params;
    const companyId = req.company_id || req.user?.company_id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Obtener encabezado y verificar estado
        const [adjRows] = await connection.query(
            'SELECT * FROM inventory_adjustment_headers WHERE id = ? AND company_id = ?',
            [id, companyId]
        );
        if (adjRows.length === 0) throw new Error('Ajuste no encontrado');
        const header = adjRows[0];
        if (header.status === 'ANULADO') throw new Error('El ajuste ya está anulado');

        // 2. Obtener items
        const [items] = await connection.query(
            'SELECT * FROM inventory_adjustment_items WHERE adjustment_id = ?',
            [id]
        );

        // 3. Reversar impacto en inventario
        for (const item of items) {
            const { product_id, cantidad, costo } = item;
            const branch_id = header.branch_id;

            // Resolver ID efectivo para reversión
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            // EL REVERSO ES EL TIPO OPUESTO
            if (header.tipo === 'ENTRADA') {
                // Si fue entrada, restamos (del ID efectivo)
                await connection.query(
                    'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                    [cantidad, effectiveProductId, branch_id]
                );
            } else {
                // Si fue salida, sumamos (al ID efectivo)
                await connection.query(
                    'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [cantidad, effectiveProductId, branch_id]
                );
            }

            // Registrar movimiento de reversa en Kardex (usamos el ID efectivo)
            const reverseType = header.tipo === 'ENTRADA' ? 'SALIDA' : 'ENTRADA';
            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, precio_venta, tipo_documento, documento_id)
                VALUES (?, ?, ?, ?, ?, 'ANULACION_AJUSTE', ?)
            `, [effectiveProductId, branch_id, reverseType, cantidad, costo, id]);
        }

        // 4. Marcar como anulado
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
