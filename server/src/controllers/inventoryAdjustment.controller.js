const pool = require('../config/db');
const { getEffectiveProductId } = require('../utils/inventoryUtils');
const notificationService = require('../services/notification.service');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('../services/excel.service');

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

const getAdjustmentsReportPDF = async (req, res) => {
    try {
        const { search, branch_id, tipo } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        const params = [companyId];
        let whereClause = 'WHERE h.company_id = ?';
        if (branch_id && branch_id !== 'all') {
            whereClause += ' AND h.branch_id = ?';
            params.push(branch_id);
        }
        if (tipo && tipo !== 'all') {
            whereClause += ' AND h.tipo = ?';
            params.push(tipo);
        }
        if (search) {
            whereClause += ` AND (
                h.numero LIKE ? OR 
                h.observaciones LIKE ? OR 
                b.nombre LIKE ? OR 
                m.nombre LIKE ? OR 
                u.nombre LIKE ? OR 
                CONCAT('AJ-', LPAD(h.id, 6, '0')) LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const query = `
            SELECT h.*, 
                   b.nombre as branch_name, 
                   m.nombre as motivo_name, 
                   u.nombre as usuario_nombre,
                   (SELECT COUNT(*) FROM inventory_adjustment_items WHERE adjustment_id = h.id) as items_count,
                   (SELECT COALESCE(SUM(cantidad), 0) FROM inventory_adjustment_items WHERE adjustment_id = h.id) as total_unidades,
                   (SELECT COALESCE(SUM(total), 0) FROM inventory_adjustment_items WHERE adjustment_id = h.id) as total_monto
            FROM inventory_adjustment_headers h
            JOIN branches b ON h.branch_id = b.id
            JOIN inventory_adjustment_motivos m ON h.motivo_id = m.id
            JOIN users u ON h.usuario_id = u.id
            ${whereClause}
            ORDER BY h.fecha DESC
        `;

        const [rows] = await pool.query(query, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Movimientos',
                    columns: [
                        { header: 'Documento', key: 'documento', width: 15 },
                        { header: 'Fecha', key: 'fecha', width: 20 },
                        { header: 'Sucursal', key: 'sucursal', width: 22 },
                        { header: 'Motivo', key: 'motivo', width: 25 },
                        { header: 'Tipo', key: 'tipo', width: 12 },
                        { header: 'Usuario', key: 'usuario', width: 20 },
                        { header: 'Items', key: 'items', width: 10 },
                        { header: 'Unidades', key: 'unidades', width: 12 },
                        { header: 'Costo Total', key: 'total_monto', width: 15 },
                        { header: 'Estado', key: 'estado', width: 15 },
                        { header: 'Observaciones', key: 'observaciones', width: 30 }
                    ],
                    rows: rows.map(r => ({
                        documento: `AJ-${String(r.id).padStart(6, '0')}${r.numero ? ` / ${r.numero}` : ''}`,
                        fecha: r.fecha ? new Date(r.fecha).toLocaleString('es-SV') : '',
                        sucursal: (r.branch_name || '').toUpperCase(),
                        motivo: (r.motivo_name || '').toUpperCase(),
                        tipo: (r.tipo || '').toUpperCase(),
                        usuario: (r.usuario_nombre || '').toUpperCase(),
                        items: parseInt(r.items_count) || 0,
                        unidades: parseFloat(r.total_unidades || 0),
                        total_monto: parseFloat(r.total_monto || 0),
                        estado: (r.status || 'COMPLETADO').toUpperCase(),
                        observaciones: r.observaciones || ''
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-movimientos-inventario.xlsx');
        }

        let branchName = 'TODAS LAS SUCURSALES';
        if (branch_id && branch_id !== 'all') {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (bRows.length > 0) branchName = (bRows[0].nombre || '').toUpperCase();
        }

        const periodText = `AL ${reportPdfHelper.formatDate(new Date())}`;
        const subtitle = `SUCURSAL: ${branchName}${search ? `   |   FILTRO: "${search}"` : ''}`;

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732;

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Movimientos de Inventario', periodText, 'landscape', subtitle);

        const colW = {
            doc: 65,
            fecha: 85,
            sucursal: 95,
            motivo: 110,
            tipo: 50,
            usuario: 80,
            items: 40,
            unidades: 52,
            total: 55,
            estado: 50,
            obs: 50
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('DOCUMENTO', x, yPos + 3); x += colW.doc;
            doc.text('FECHA / HORA', x, yPos + 3); x += colW.fecha;
            doc.text('SUCURSAL', x, yPos + 3); x += colW.sucursal;
            doc.text('MOTIVO', x, yPos + 3); x += colW.motivo;
            doc.text('TIPO', x, yPos + 3, { width: colW.tipo, align: 'center' }); x += colW.tipo;
            doc.text('USUARIO', x, yPos + 3); x += colW.usuario;
            doc.text('ITEMS', x, yPos + 3, { width: colW.items, align: 'center' }); x += colW.items;
            doc.text('UNIDADES', x, yPos + 3, { width: colW.unidades, align: 'right' }); x += colW.unidades;
            doc.text('COSTO TOT.', x, yPos + 3, { width: colW.total, align: 'right' }); x += colW.total;
            doc.text('ESTADO', x, yPos + 3, { width: colW.estado, align: 'center' }); x += colW.estado;
            doc.text('OBSERV.', x, yPos + 3, { width: colW.obs });
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (rows.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron movimientos de inventario registrados.', startX, currentY + 10);
            currentY += 30;
        } else {
            let totalItemsCount = 0;
            let totalUnidadesSum = 0;
            let totalMontoSum = 0;

            rows.forEach((r, idx) => {
                if (currentY > 510) {
                    doc.addPage();
                    currentY = drawTableHeader(30);
                }

                if (idx % 2 === 1) {
                    doc.rect(startX, currentY - 2, contentWidth, 13).fill('#f8fafc');
                }

                doc.fontSize(7).font('Helvetica').fillColor('#334155');
                let x = startX + 4;
                
                doc.font('Helvetica-Bold').fillColor('#4338ca');
                const docLabel = `AJ-${String(r.id).padStart(6, '0')}`;
                doc.text(docLabel, x, currentY); x += colW.doc;

                doc.font('Helvetica').fillColor('#334155');
                const fechaStr = r.fecha ? `${reportPdfHelper.formatDate(r.fecha)} ${new Date(r.fecha).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '---';
                doc.text(fechaStr, x, currentY); x += colW.fecha;

                doc.text((r.branch_name || '').substring(0, 18).toUpperCase(), x, currentY); x += colW.sucursal;
                doc.text((r.motivo_name || '').substring(0, 22).toUpperCase(), x, currentY); x += colW.motivo;

                const tipoColor = r.tipo === 'ENTRADA' ? '#059669' : '#d97706';
                doc.font('Helvetica-Bold').fillColor(tipoColor);
                doc.text(r.tipo || '---', x, currentY, { width: colW.tipo, align: 'center' }); x += colW.tipo;

                doc.font('Helvetica').fillColor('#334155');
                doc.text((r.usuario_nombre || '').substring(0, 15).toUpperCase(), x, currentY); x += colW.usuario;
                
                const itemsCount = parseInt(r.items_count) || 0;
                const unidadesCount = parseFloat(r.total_unidades) || 0;
                const montoCount = parseFloat(r.total_monto) || 0;
                totalItemsCount += itemsCount;
                totalUnidadesSum += unidadesCount;
                totalMontoSum += montoCount;

                doc.text(String(itemsCount), x, currentY, { width: colW.items, align: 'center' }); x += colW.items;
                doc.text(unidadesCount.toFixed(2), x, currentY, { width: colW.unidades, align: 'right' }); x += colW.unidades;
                doc.text(reportPdfHelper.fmt(montoCount), x, currentY, { width: colW.total, align: 'right' }); x += colW.total;

                const statusColor = r.status === 'ANULADO' ? '#e11d48' : '#059669';
                doc.font('Helvetica-Bold').fillColor(statusColor);
                doc.text(r.status || 'COMPLETADO', x, currentY, { width: colW.estado, align: 'center' }); x += colW.estado;

                doc.font('Helvetica').fillColor('#64748b');
                doc.text((r.observaciones || '---').substring(0, 15), x, currentY, { width: colW.obs });

                currentY += 13;
            });

            // Summary row
            if (currentY > 500) {
                doc.addPage();
                currentY = drawTableHeader(30);
            }

            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
            currentY += 3;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTALES:', startX + colW.doc + colW.fecha + colW.sucursal + colW.motivo + colW.tipo, currentY, { width: colW.usuario, align: 'right' });
            
            let sx = startX + colW.doc + colW.fecha + colW.sucursal + colW.motivo + colW.tipo + colW.usuario;
            doc.text(String(totalItemsCount), sx, currentY, { width: colW.items, align: 'center' }); sx += colW.items;
            doc.text(totalUnidadesSum.toFixed(2), sx, currentY, { width: colW.unidades, align: 'right' }); sx += colW.unidades;
            doc.text(reportPdfHelper.fmt(totalMontoSum), sx, currentY, { width: colW.total, align: 'right' });
            currentY += 16;
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Movimientos');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="reporte-movimientos-inventario.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getAdjustmentsReportPDF] Error:', error);
        res.status(500).json({ message: error.message || 'Error al generar reporte de movimientos de inventario' });
    }
};

module.exports = { 
    getMotivos, 
    createMotivo, 
    updateMotivo, 
    deleteMotivo, 
    createAdjustment, 
    getAdjustments, 
    getAdjustmentsReportPDF,
    getAdjustmentById,
    updateAdjustment,
    voidAdjustment 
};

