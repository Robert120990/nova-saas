const pool = require('../config/db');
const pdfService = require('../services/pdf.service');
const { getEffectiveProductId } = require('../utils/inventoryUtils');

const getInventory = async (req, res) => {
    try {
        const { branch_id, search } = req.query;
        let query = `
            SELECT i.*, p.nombre, p.codigo, p.precio_unitario, b.nombre as branch_name
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            JOIN branches b ON i.branch_id = b.id
            WHERE p.company_id = ?
        `;
        const params = [req.company_id];

        if (branch_id) {
            query += ` AND i.branch_id = ?`;
            params.push(branch_id);
        }

        if (search) {
            query += ` AND (p.nombre LIKE ? OR p.codigo LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener inventario' });
    }
};

const getKardex = async (req, res) => {
    try {
        const { product_id, branch_id } = req.query;
        if (!product_id || !branch_id) {
            return res.status(400).json({ message: 'Producto y Sucursal son requeridos' });
        }

        const [rows] = await pool.query(`
            SELECT m.*, p.precio_unitario as current_price
            FROM inventory_movements m
            JOIN products p ON m.product_id = p.id
            WHERE m.product_id = ? AND m.branch_id = ?
            ORDER BY m.created_at DESC
        `, [product_id, branch_id]);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener Kardex' });
    }
};

const mailerService = require('../services/mailer.service');

const createTransfer = async (req, res) => {
    const { origen_branch_id, destino_branch_id, observaciones, items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un producto' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Crear encabezado de traslado
        const [transferResult] = await connection.query(`
            INSERT INTO inventory_transfers (company_id, origen_branch_id, destino_branch_id, observaciones, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `, [req.company_id, origen_branch_id, destino_branch_id, observaciones || '', req.user.id]);
        
        const transferId = transferResult.insertId;

        for (const item of items) {
            const { product_id, cantidad } = item;
            const qty = parseFloat(cantidad);

            // Get product info for flags and price
            const [pInfo] = await connection.query(
                'SELECT precio_unitario, afecta_inventario, permitir_existencia_negativa FROM products WHERE id = ?', 
                [product_id]
            );
            
            if (pInfo.length === 0) throw new Error(`Producto ID ${product_id} no encontrado`);
            
            const product = pInfo[0];
            const price = product.precio_unitario;

            // 2. Verificar permiso de producto en sucursal destino
            const [hasAccess] = await connection.query(
                'SELECT 1 FROM product_branch WHERE product_id = ? AND branch_id = ?',
                [product_id, destino_branch_id]
            );

            if (hasAccess.length === 0) {
                // Get product name for better error message
                const [pName] = await connection.query('SELECT nombre FROM products WHERE id = ?', [product_id]);
                const nombreProducto = pName.length > 0 ? pName[0].nombre : `ID ${product_id}`;
                throw new Error(`El producto "${nombreProducto}" no tiene permiso de acceso a la sucursal de destino`);
            }

            // 3. Registrar detalle
            await connection.query(`
                INSERT INTO inventory_transfer_items (transfer_id, product_id, cantidad)
                VALUES (?, ?, ?)
            `, [transferId, product_id, qty]);

            // If product doesn't affect inventory, skip stock updates but record transfer items
            if (!product.afecta_inventario) continue;

            // 3. Procesar ORIGEN (SALIDA)
            // Resolver ID efectivo para inventario
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            // Verificar stock
            const [originStock] = await connection.query(
                'SELECT stock FROM inventory WHERE product_id = ? AND branch_id = ?',
                [effectiveProductId, origen_branch_id]
            );

            const currentOriginStock = originStock.length > 0 ? parseFloat(originStock[0].stock) : 0;

            if (currentOriginStock < qty && !product.permitir_existencia_negativa) {
                throw new Error(`Stock insuficiente para el producto ID ${product_id} (ID efectivo ${effectiveProductId}) en la sucursal de origen`);
            }

            await connection.query(
                'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                [qty, effectiveProductId, origen_branch_id]
            );

            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, precio_venta, tipo_documento, documento_id)
                VALUES (?, ?, 'SALIDA', ?, ?, 'TRASLADO', ?)
            `, [effectiveProductId, origen_branch_id, qty, price, transferId]);

            // 4. Procesar DESTINO (ENTRADA)
            const [destStock] = await connection.query(
                'SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?',
                [effectiveProductId, destino_branch_id]
            );

            if (destStock.length > 0) {
                await connection.query(
                    'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [qty, effectiveProductId, destino_branch_id]
                );
            } else {
                await connection.query(
                    'INSERT INTO inventory (product_id, branch_id, stock) VALUES (?, ?, ?)',
                    [effectiveProductId, destino_branch_id, qty]
                );
            }

            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, precio_venta, tipo_documento, documento_id)
                VALUES (?, ?, 'ENTRADA', ?, ?, 'TRASLADO', ?)
            `, [effectiveProductId, destino_branch_id, qty, price, transferId]);
        }

        await connection.commit();
        
        // Trigger email notification in background
        mailerService.sendTransferEmail(transferId).catch(err => {
            console.error('Error triggered in background mailer:', err);
        });

        res.status(201).json({ 
            id: transferId, 
            message: 'Traslado completado con éxito. El comprobante se enviará por correo a la sucursal de destino.' 
        });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al procesar traslado' });
    } finally {
        connection.release();
    }
};

const getTransfers = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const params = [req.company_id];

        let whereClause = 'WHERE t.company_id = ?';
        if (search) {
            whereClause += ` AND (
                b1.nombre LIKE ? OR 
                b2.nombre LIKE ? OR 
                u.nombre LIKE ? OR 
                t.observaciones LIKE ? OR
                CONCAT('TR-', LPAD(t.id, 6, '0')) LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const query = `
            SELECT t.*, 
                   b1.nombre AS origen_nombre, 
                   b2.nombre AS destino_nombre,
                   u.nombre AS usuario_nombre,
                   (SELECT COUNT(*) FROM inventory_transfer_items WHERE transfer_id = t.id) AS items_count
            FROM inventory_transfers t
            JOIN branches b1 ON t.origen_branch_id = b1.id
            JOIN branches b2 ON t.destino_branch_id = b2.id
            JOIN users u ON t.usuario_id = u.id
            ${whereClause}
            ORDER BY t.fecha DESC
            LIMIT ? OFFSET ?
        `;
        
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM inventory_transfers t
            JOIN branches b1 ON t.origen_branch_id = b1.id
            JOIN branches b2 ON t.destino_branch_id = b2.id
            JOIN users u ON t.usuario_id = u.id
            ${whereClause}
        `;

        const [[{ total }]] = await pool.query(countQuery, params);
        
        // Add limit and offset for the data query
        const finalParams = [...params, parseInt(limit), parseInt(offset)];
        const [rows] = await pool.query(query, finalParams);

        res.json({
            data: rows,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener traslados' });
    }
};

const deleteTransfer = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Get transfer and items
        const [transfers] = await connection.query('SELECT * FROM inventory_transfers WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (transfers.length === 0) throw new Error('Traslado no encontrado');
        
        const transfer = transfers[0];
        if (transfer.status === 'ANULADO') throw new Error('El traslado ya está anulado');

        const [items] = await connection.query('SELECT * FROM inventory_transfer_items WHERE transfer_id = ?', [id]);

        for (const item of items) {
            const { product_id, cantidad } = item;
            const qty = parseFloat(cantidad);

            // Resolver ID efectivo para reversión
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            // Revert ORIGIN (SALIDA -> ENTRADA)
            await connection.query('UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?', [qty, effectiveProductId, transfer.origen_branch_id]);
            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, tipo_documento, documento_id)
                VALUES (?, ?, 'ENTRADA', ?, 'ANULACION_TRASLADO', ?)
            `, [effectiveProductId, transfer.origen_branch_id, qty, id]);

            // Revert DESTINATION (ENTRADA -> SALIDA)
            await connection.query('UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?', [qty, effectiveProductId, transfer.destino_branch_id]);
            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, tipo_documento, documento_id)
                VALUES (?, ?, 'SALIDA', ?, 'ANULACION_TRASLADO', ?)
            `, [effectiveProductId, transfer.destino_branch_id, qty, id]);
        }

        // Update status
        await connection.query('UPDATE inventory_transfers SET status = "ANULADO" WHERE id = ?', [id]);

        await connection.commit();
        res.json({ message: 'Traslado anulado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al anular traslado' });
    } finally {
        connection.release();
    }
};

const getTransferDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT i.*, p.nombre, p.codigo
            FROM inventory_transfer_items i
            JOIN products p ON i.product_id = p.id
            WHERE i.transfer_id = ?
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener detalle de traslado' });
    }
};

const getProductsForPhysicalInventory = async (req, res) => {
    try {
        const { branch_id, category_ids } = req.query;
        if (!branch_id) return res.status(400).json({ message: 'Sucursal es requerida' });

        let catFilter = '';
        let params = [branch_id, branch_id, req.company_id];

        if (category_ids) {
            const ids = category_ids.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                catFilter = `AND p.category_id IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            }
        }

        const [rows] = await pool.query(`
            SELECT p.id as product_id, p.nombre, p.codigo, p.costo, 
                   COALESCE(i.stock, 0) as stock_sistema,
                   COALESCE(c.name, 'Sin Categoría') as category_name
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE p.company_id = ? AND p.status = 'activo' AND p.afecta_inventario = 1
            ${catFilter}
        `, params);

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener productos para inventario' });
    }
};


const getPhysicalInventories = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        const params = [req.company_id];

        let whereClause = 'WHERE p.company_id = ?';
        if (search) {
            whereClause += ` AND (p.responsable LIKE ? OR b.nombre LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const query = `
            SELECT p.*, b.nombre as branch_name,
                   (SELECT COUNT(*) FROM physical_inventory_items WHERE physical_inventory_id = p.id) as items_count
            FROM physical_inventories p
            JOIN branches b ON p.branch_id = b.id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM physical_inventories p JOIN branches b ON p.branch_id = b.id ${whereClause}`, params);
        const [rows] = await pool.query(query, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: rows,
            totalItems: total,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener historial de inventarios' });
    }
};

const savePhysicalInventory = async (req, res) => {
    const { id, branch_id, fecha, responsable, observaciones, items } = req.body;
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        let inventoryId = id;

        if (!inventoryId) {
            const [result] = await connection.query(`
                INSERT INTO physical_inventories (company_id, branch_id, fecha, responsable, observaciones, status)
                VALUES (?, ?, ?, ?, ?, 'PENDIENTE')
            `, [req.company_id, branch_id, fecha, responsable || '', observaciones || '']);
            inventoryId = result.insertId;
        } else {
            await connection.query(`
                UPDATE physical_inventories 
                SET fecha = ?, responsable = ?, observaciones = ?
                WHERE id = ? AND company_id = ? AND status = 'PENDIENTE'
            `, [fecha, responsable || '', observaciones || '', inventoryId, req.company_id]);
        }

        // Update items (clear and re-insert for simplicity in this draft stage)
        await connection.query('DELETE FROM physical_inventory_items WHERE physical_inventory_id = ?', [inventoryId]);
        if (items && items.length > 0) {
            const values = items.map(item => [
                inventoryId, 
                item.product_id, 
                item.stock_sistema || 0, 
                item.stock_fisico !== null && item.stock_fisico !== undefined && item.stock_fisico !== '' ? item.stock_fisico : null, 
                item.diferencia || 0, 
                item.costo || 0, 
                item.total || 0
            ]);

            await connection.query(`
                INSERT INTO physical_inventory_items 
                (physical_inventory_id, product_id, stock_sistema, stock_fisico, diferencia, costo, total)
                VALUES ?
            `, [values]);
        }

        await connection.commit();
        res.json({ id: inventoryId, message: 'Inventario guardado' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al guardar inventario' });
    } finally {
        connection.release();
    }
};

const applyPhysicalInventory = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [headers] = await connection.query('SELECT * FROM physical_inventories WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (headers.length === 0) throw new Error('Inventario no encontrado');
        const header = headers[0];
        if (header.status !== 'PENDIENTE') throw new Error('El inventario ya fue aplicado o anulado');

        const [items] = await connection.query('SELECT * FROM physical_inventory_items WHERE physical_inventory_id = ?', [id]);

        for (const item of items) {
            const diff = parseFloat(item.diferencia);
            if (diff === 0) continue;

            const tipo_movimiento = diff > 0 ? 'ENTRADA' : 'SALIDA';
            const cantidad = Math.abs(diff);

            // Resolver ID efectivo para aplicación física
            const effectiveProductId = await getEffectiveProductId(connection, item.product_id);

            // 1. Update master stock
            const [stockRow] = await connection.query('SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?', [effectiveProductId, header.branch_id]);
            
            if (stockRow.length > 0) {
                await connection.query('UPDATE inventory SET stock = stock + ? WHERE id = ?', [diff, stockRow[0].id]);
            } else {
                await connection.query('INSERT INTO inventory (product_id, branch_id, stock) VALUES (?, ?, ?)', [effectiveProductId, header.branch_id, item.stock_fisico]);
            }

            // 2. Register Kardex movement
            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, precio_venta, tipo_documento, documento_id)
                VALUES (?, ?, ?, ?, ?, 'INVENTARIO_FISICO', ?)
            `, [effectiveProductId, header.branch_id, tipo_movimiento, cantidad, item.costo, id]);
        }

        await connection.query('UPDATE physical_inventories SET status = "APLICADO" WHERE id = ?', [id]);

        await connection.commit();
        res.json({ message: 'Inventario aplicado y stock ajustado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al aplicar inventario' });
    } finally {
        connection.release();
    }
};

const getPhysicalInventoryDetail = async (req, res) => {
    const { id } = req.params;
    const companyId = req.company_id;
    console.log(`[DEBUG] Attempting to fetch inventory: ID=${id}, Company=${companyId}`);
    try {
        const [headers] = await pool.query('SELECT * FROM physical_inventories WHERE id = ? AND company_id = ?', [id, companyId]);
        if (headers.length === 0) {
            console.error(`[DEBUG] 404: Inventory not found for ID=${id} and Company=${companyId}`);
            return res.status(404).json({ 
                message: 'Inventario no en el servidor',
                debug: `ID=${id}, Company=${companyId}`
            });
        }

        const [items] = await pool.query(`
            SELECT pi.*, p.nombre, p.codigo, COALESCE(c.name, 'Sin Categoría') AS categoria
            FROM physical_inventory_items pi
            JOIN products p ON pi.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE pi.physical_inventory_id = ?
        `, [id]);

        res.json({ ...headers[0], items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener detalle de inventario' });
    }
};

const deletePhysicalInventory = async (req, res) => {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [headers] = await connection.query('SELECT status FROM physical_inventories WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (headers.length === 0) throw new Error('Inventario no encontrado');
        
        const header = headers[0];
        if (header.status !== 'PENDIENTE') throw new Error('Solo se pueden eliminar inventarios PENDIENTES');

        await connection.query('DELETE FROM physical_inventories WHERE id = ?', [id]);

        await connection.commit();
        res.json({ message: 'Borrador de inventario eliminado correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: error.message || 'Error al eliminar inventario' });
    } finally {
        connection.release();
    }
};

const getInventoryStockReport = async (req, res) => {
    try {
        const { branch_id, category_ids } = req.query;
        const company_id = req.company_id;

        if (!branch_id) {
            return res.status(400).json({ message: 'La sucursal es requerida' });
        }

        // Fetch company and branch info for header (safe pattern)
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);

        if (!companyRows || companyRows.length === 0) {
            console.error(`[StockReport] Company not found for company_id=${company_id}`);
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        if (!branchRows || branchRows.length === 0) {
            console.error(`[StockReport] Branch not found for branch_id=${branch_id}`);
            return res.status(404).json({ message: 'Sucursal no encontrada' });
        }

        const company = companyRows[0];
        const branch = branchRows[0];

        let query = `
            SELECT 
                p.codigo, 
                p.nombre, 
                c.name as categoria, 
                COALESCE(i.stock, 0) as stock,
                p.costo,
                p.precio_unitario as precio_venta
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
            LEFT JOIN product_categories c ON p.category_id = c.id
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            WHERE p.company_id = ? AND p.status = 'activo'
        `;
        const params = [branch_id, branch_id, company_id];

        if (category_ids) {
            const ids = category_ids.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                query += ` AND p.category_id IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            }
        }

        query += ` ORDER BY c.name ASC, p.nombre ASC`;

        const [rows] = await pool.query(query, params);

        const reportData = {
            company_name: company.nombre,
            branch_name: branch.nombre,
            products: rows
        };

        const pdfBuffer = await pdfService.generateStockReportPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-stock.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[StockReport] Full error:', error.message);
        console.error('[StockReport] Stack:', error.stack);
        res.status(500).json({ message: error.message || 'Error al generar el reporte de stock' });
    }
};

const getInventoryMovementsReport = async (req, res) => {
    try {
        const { branch_id, startDate, endDate, category_ids } = req.query;
        const company_id = req.company_id;

        if (!branch_id || !startDate || !endDate) {
            return res.status(400).json({ message: 'Sucursal y rango de fechas son requeridos' });
        }

        // Fetch company and branch info for header
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);

        if (!companyRows.length || !branchRows.length) {
            return res.status(404).json({ message: 'Empresa o Sucursal no encontrada' });
        }

        let catFilter = '';
        const params = [
            branch_id, startDate, // Inicial
            branch_id, startDate, endDate, // Entradas
            branch_id, startDate, endDate, // Salidas
            branch_id, endDate, // Final
            branch_id, // JOIN pb
            company_id // WHERE
        ];

        if (category_ids) {
            const ids = category_ids.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                catFilter = `AND p.category_id IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            }
        }

        // The query calculates:
        // - Initial: Movements before startDate
        // - Entradas: Inward movements during range
        // - Salidas: Outward movements during range
        // - Final: All movements up to endDate
        const query = `
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.costo,
                COALESCE(c.name, 'Sin Categoría') as categoria,
                COALESCE((
                    SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END)
                    FROM inventory_movements
                    WHERE product_id = p.id AND branch_id = ? AND created_at < ?
                ), 0) as inicial,
                COALESCE((
                    SELECT SUM(cantidad)
                    FROM inventory_movements
                    WHERE product_id = p.id AND branch_id = ? AND created_at BETWEEN ? AND ? AND tipo_movimiento = 'ENTRADA'
                ), 0) as entradas,
                COALESCE((
                    SELECT SUM(cantidad)
                    FROM inventory_movements
                    WHERE product_id = p.id AND branch_id = ? AND created_at BETWEEN ? AND ? AND tipo_movimiento = 'SALIDA'
                ), 0) as salidas,
                COALESCE((
                    SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END)
                    FROM inventory_movements
                    WHERE product_id = p.id AND branch_id = ? AND created_at <= ?
                ), 0) as final
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            WHERE p.company_id = ? AND p.status = 'activo'
            ${catFilter}
            ORDER BY c.name ASC, p.nombre ASC
        `;

        const [rows] = await pool.query(query, params);

        // Filter out products that have 0 in all columns (no historical or current movement)
        const filteredRows = rows.filter(r => 
            parseFloat(r.inicial) !== 0 || 
            parseFloat(r.entradas) !== 0 || 
            parseFloat(r.salidas) !== 0 || 
            parseFloat(r.final) !== 0
        );

        const reportData = {
            company_name: companyRows[0].nombre,
            branch_name: branchRows[0].nombre,
            startDate,
            endDate,
            products: filteredRows
        };

        const pdfBuffer = await pdfService.generateMovementsReportPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-movimientos.pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('[MovementsReport] Full error:', error.message);
        res.status(500).json({ message: error.message || 'Error al generar el reporte de movimientos' });
    }
};

module.exports = { 
    getInventory, 
    getKardex, 
    createTransfer, 
    getTransfers, 
    deleteTransfer, 
    getTransferDetail,
    getProductsForPhysicalInventory,
    getPhysicalInventories,
    savePhysicalInventory,
    applyPhysicalInventory,
    getPhysicalInventoryDetail,
    deletePhysicalInventory,
    getInventoryStockReport,
    getInventoryMovementsReport
};
