const pool = require('../config/db');
const { broadcastToCompany } = require('../services/websocket.service');
const pdfService = require('../services/pdf.service');
const excelService = require('../services/excel.service');
const { getEffectiveProductId } = require('../utils/inventoryUtils');
const notificationService = require('../services/notification.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

const getInventory = async (req, res) => {
    try {
        const { branch_id, search } = req.query;
        let query = `
            SELECT i.*, p.nombre, p.codigo, COALESCE(pbp.precio_unitario, 0) as precio_unitario, b.nombre as branch_name
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = i.branch_id
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
            SELECT m.*, COALESCE(pbp.precio_unitario, 0) as current_price
            FROM inventory_movements m
            JOIN products p ON m.product_id = p.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = m.branch_id
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

            // Get product info for flags and price (from origin branch)
            const [pInfo] = await connection.query(`
                SELECT COALESCE(pbp.precio_unitario, 0) as precio_unitario,
                       p.afecta_inventario, p.permitir_existencia_negativa
                FROM products p
                LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
                WHERE p.id = ?
            `, [origen_branch_id, product_id]);
            
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

            notificationService.notify('low_stock', req.company_id, req.user.branch_id, {
                product_id: product_id,
                cantidad_retirada: qty,
                stock_actual: Math.max(0, currentOriginStock - qty),
                origen_branch_id: origen_branch_id,
                sucursal: req.branch_name || ''
            }).catch(() => {});

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

        notificationService.notify('transfer_created', req.company_id, req.user.branch_id, {
            transfer_id: transferId,
            origen_branch_id: origen_branch_id,
            destino_branch_id: destino_branch_id,
            items_count: items.length,
            sucursal: req.branch_name || ''
        }).catch(() => {});

        notificationService.notify('transfer_received', req.company_id, req.user.branch_id, {
            transfer_id: transferId,
            origen_branch_id: origen_branch_id,
            destino_branch_id: destino_branch_id,
            items_count: items.length,
            sucursal: req.branch_name || ''
        }).catch(() => {});

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
        const { search, branch_id, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        const params = [req.company_id];

        let whereClause = 'WHERE t.company_id = ?';
        if (branch_id) {
            whereClause += ' AND (t.origen_branch_id = ? OR t.destino_branch_id = ?)';
            params.push(branch_id, branch_id);
        }
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

        notificationService.notify('transfer_annulled', req.company_id, req.user.branch_id, {
            transfer_id: id,
            origen_branch_id: transfer.origen_branch_id,
            destino_branch_id: transfer.destino_branch_id,
            sucursal: req.branch_name || ''
        }).catch(() => {});

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
        const { search, branch_id, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;
        const params = [req.company_id];

        let whereClause = 'WHERE p.company_id = ?';
        if (branch_id) {
            whereClause += ' AND p.branch_id = ?';
            params.push(branch_id);
        }
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

        if (req.company_id) {
            broadcastToCompany(req.company_id, 'inventory_updated', {
                physical_inventory_id: inventoryId
            });
        }

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
        const { branch_id, category_ids, as_of } = req.query;
        const company_id = req.company_id;

        if (!branch_id) {
            return res.status(400).json({ message: 'La sucursal es requerida' });
        }

        // Fecha de corte opcional (YYYY-MM-DD): stock al final de ese día
        let asOfDate = null;
        if (as_of) {
            const parsed = new Date(as_of);
            if (isNaN(parsed.getTime())) {
                return res.status(400).json({ message: 'Formato de fecha inválido. Use YYYY-MM-DD' });
            }
            asOfDate = `${as_of} 23:59:59`;
        }

        // Fetch company and branch info for header (safe pattern)
        const [companyRows] = await pool.query('SELECT razon_social as nombre, nit, nrc FROM companies WHERE id = ?', [company_id]);
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
                ${asOfDate ? `
                COALESCE(i.stock, 0) - COALESCE((
                    SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END)
                    FROM inventory_movements
                    WHERE product_id = p.id AND branch_id = ? AND created_at > ?
                ), 0) as stock,
                ` : `
                COALESCE(i.stock, 0) as stock,
                `}
                p.costo,
                COALESCE(pbp.precio_unitario, 0) as precio_venta
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            WHERE p.company_id = ? AND p.status = 'activo'
        `;
        const params = asOfDate
            ? [branch_id, asOfDate, branch_id, branch_id, branch_id, company_id]
            : [branch_id, branch_id, branch_id, company_id];

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
            company_id: company_id,
            company: company,
            company_name: company.nombre,
            company_nit: company.nit,
            company_nrc: company.nrc,
            branch_name: branch.nombre,
            as_of: as_of || null,
            products: rows
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Reporte',
                    columns: [
                        { header: 'Código', key: 'codigo', width: 15 },
                        { header: 'Producto', key: 'nombre', width: 40 },
                        { header: 'Categoría', key: 'categoria', width: 20 },
                        { header: 'Stock', key: 'stock', width: 10 },
                        { header: 'Costo', key: 'costo', width: 15 },
                        { header: 'Precio Venta', key: 'precio_venta', width: 15 }
                    ],
                    data: rows.map(r => ({
                        codigo: r.codigo,
                        nombre: r.nombre,
                        categoria: r.categoria,
                        stock: parseFloat(r.stock).toFixed(2),
                        costo: parseFloat(r.costo).toFixed(2),
                        precio_venta: parseFloat(r.precio_venta).toFixed(2)
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-stock.xlsx');
        }

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
        const [companyRows] = await pool.query('SELECT razon_social as nombre, nit, nrc FROM companies WHERE id = ?', [company_id]);
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
            company_id: company_id,
            company: companyRows[0],
            company_name: companyRows[0].nombre,
            company_nit: companyRows[0].nit,
            company_nrc: companyRows[0].nrc,
            branch_name: branchRows[0].nombre,
            startDate,
            endDate,
            products: filteredRows
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Reporte',
                    columns: [
                        { header: 'Código', key: 'codigo', width: 15 },
                        { header: 'Producto', key: 'nombre', width: 40 },
                        { header: 'Categoría', key: 'categoria', width: 20 },
                        { header: 'Costo', key: 'costo', width: 15 },
                        { header: 'Inicial', key: 'inicial', width: 10 },
                        { header: 'Entradas', key: 'entradas', width: 10 },
                        { header: 'Salidas', key: 'salidas', width: 10 },
                        { header: 'Final', key: 'final', width: 10 }
                    ],
                    data: filteredRows.map(r => ({
                        codigo: r.codigo,
                        nombre: r.nombre,
                        categoria: r.categoria,
                        costo: parseFloat(r.costo).toFixed(2),
                        inicial: parseFloat(r.inicial).toFixed(2),
                        entradas: parseFloat(r.entradas).toFixed(2),
                        salidas: parseFloat(r.salidas).toFixed(2),
                        final: parseFloat(r.final).toFixed(2)
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-movimientos.xlsx');
        }

        const pdfBuffer = await pdfService.generateMovementsReportPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-movimientos.pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('[MovementsReport] Full error:', error.message);
        res.status(500).json({ message: error.message || 'Error al generar el reporte de movimientos' });
    }
};

const getKardexReport = async (req, res) => {
    try {
        const { product_id, branch_id, startDate, endDate, tipo_movimiento } = req.query;
        const company_id = req.company_id;

        if (!product_id || !branch_id) {
            return res.status(400).json({ message: 'Producto y Sucursal son requeridos' });
        }

        // 1. Fetch Company Info
        const [companyRows] = await pool.query(
            'SELECT id, razon_social as nombre, razon_social, nombre_comercial, nit, nrc FROM companies WHERE id = ?',
            [company_id]
        );
        const [branchRows] = await pool.query(
            'SELECT nombre FROM branches WHERE id = ?',
            [branch_id]
        );

        if (!companyRows.length || !branchRows.length) {
            return res.status(404).json({ message: 'Empresa o Sucursal no encontrada' });
        }

        const company = companyRows[0];
        const branch = branchRows[0];

        // 2. Fetch Product Info
        const [productRows] = await pool.query(`
            SELECT 
                p.id,
                p.nombre,
                p.codigo,
                p.codigo_barra as barcode,
                p.costo,
                c.name as categoria,
                COALESCE(pbp.precio_unitario, 0) as precio_venta,
                COALESCE(i.stock, 0) as stock_actual
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
            WHERE p.id = ? AND p.company_id = ?
        `, [branch_id, branch_id, product_id, company_id]);

        if (!productRows.length) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        const product = productRows[0];

        // 3. Calculate Initial Balance if startDate is present
        let initialBalance = 0;
        if (startDate) {
            const [initRows] = await pool.query(`
                SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) as initial_balance
                FROM inventory_movements
                WHERE product_id = ? AND branch_id = ? AND DATE(created_at) < ?
            `, [product_id, branch_id, startDate]);
            initialBalance = parseFloat(initRows[0]?.initial_balance || 0);
        }

        // 4. Fetch Movements
        let query = `
            SELECT 
                m.id,
                m.created_at,
                m.tipo_movimiento,
                m.tipo_documento,
                m.documento_id,
                m.cantidad,
                m.precio_venta,
                COALESCE(pbp.precio_unitario, 0) as current_price
            FROM inventory_movements m
            LEFT JOIN product_branch_prices pbp ON m.product_id = pbp.product_id AND pbp.branch_id = m.branch_id
            WHERE m.product_id = ? AND m.branch_id = ?
        `;
        const params = [product_id, branch_id];

        if (startDate) {
            query += ` AND DATE(m.created_at) >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND DATE(m.created_at) <= ?`;
            params.push(endDate);
        }
        if (tipo_movimiento && tipo_movimiento !== 'ALL') {
            query += ` AND m.tipo_movimiento = ?`;
            params.push(tipo_movimiento);
        }

        query += ` ORDER BY m.created_at ASC, m.id ASC`;

        const [rows] = await pool.query(query, params);

        // 5. Calculate Running Balances chronologically
        let runningBalance = initialBalance;
        const movementsWithBalance = rows.map(m => {
            const qty = parseFloat(m.cantidad || 0);
            if (m.tipo_movimiento === 'ENTRADA') {
                runningBalance += qty;
            } else {
                runningBalance -= qty;
            }
            return {
                ...m,
                balance: runningBalance,
                costo: product.costo
            };
        });

        // For display matching screen (newest first):
        const movementsDisplay = [...movementsWithBalance].reverse();

        // 6. Period Text
        let periodText = '';
        if (startDate && endDate) {
            periodText = `DEL ${reportPdfHelper.formatDate(startDate)} AL ${reportPdfHelper.formatDate(endDate)}`;
        } else if (startDate) {
            periodText = `DESDE EL ${reportPdfHelper.formatDate(startDate)}`;
        } else if (endDate) {
            periodText = `AL ${reportPdfHelper.formatDate(endDate)}`;
        } else {
            periodText = `AL ${reportPdfHelper.formatDate(new Date())}`;
        }

        const reportData = {
            company_id,
            company,
            branch_name: branch.nombre,
            product,
            periodText,
            movements: movementsDisplay,
            finalStock: runningBalance
        };

        // 7. Handle Excel export
        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Kardex',
                    columns: [
                        { header: 'Fecha y Hora', key: 'fecha', width: 20 },
                        { header: 'Tipo', key: 'tipo', width: 12 },
                        { header: 'Documento', key: 'documento', width: 25 },
                        { header: 'No. Doc', key: 'doc_id', width: 12 },
                        { header: 'Cantidad', key: 'cantidad', width: 14 },
                        { header: 'Precio Venta', key: 'precio_venta', width: 15 },
                        { header: 'Costo Unitario', key: 'costo', width: 15 },
                        { header: 'Saldo Unidades', key: 'saldo', width: 15 }
                    ],
                    data: movementsDisplay.map(m => {
                        const dateObj = new Date(m.created_at);
                        const timeStr = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
                        return {
                            fecha: `${reportPdfHelper.formatDate(m.created_at)} ${timeStr}`.trim(),
                            tipo: m.tipo_movimiento,
                            documento: m.tipo_documento || 'Movimiento',
                            doc_id: m.documento_id || '',
                            cantidad: (m.tipo_movimiento === 'ENTRADA' ? '+' : '-') + parseFloat(m.cantidad || 0).toFixed(2),
                            precio_venta: parseFloat(m.precio_venta || m.current_price || 0).toFixed(2),
                            costo: parseFloat(product.costo || 0).toFixed(2),
                            saldo: parseFloat(m.balance || 0).toFixed(2)
                        };
                    })
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `kardex-${product.codigo || 'producto'}.xlsx`);
        }

        // 8. Generate & Send PDF
        const pdfBuffer = await pdfService.generateKardexReportPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=kardex-${product.codigo || 'producto'}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('[KardexReport] Full error:', error.message);
        res.status(500).json({ message: error.message || 'Error al generar el reporte de Kárdex' });
    }
};

const getInventoryValuationReport = async (req, res) => {
    try {
        const { branch_id, category_ids, as_of, only_in_stock } = req.query;
        const company_id = req.company_id;

        if (!branch_id) {
            return res.status(400).json({ message: 'La sucursal es requerida' });
        }

        const [companyRows] = await pool.query('SELECT razon_social as nombre, nit, nrc FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);

        if (!companyRows.length || !branchRows.length) {
            return res.status(404).json({ message: 'Empresa o Sucursal no encontrada' });
        }

        const company = companyRows[0];
        const branch = branchRows[0];

        let query = `
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                c.name as categoria,
                COALESCE(i.stock, 0) as stock,
                p.costo,
                COALESCE(pbp.precio_unitario, 0) as precio_venta
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            WHERE p.company_id = ? AND p.status = 'activo'
        `;
        const params = [branch_id, branch_id, branch_id, company_id];

        if (category_ids) {
            const ids = category_ids.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                query += ` AND p.category_id IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            }
        }

        if (only_in_stock === 'true' || only_in_stock === true) {
            query += ` AND COALESCE(i.stock, 0) > 0`;
        }

        query += ` ORDER BY c.name ASC, p.nombre ASC`;

        const [rows] = await pool.query(query, params);

        const reportData = {
            company_id,
            company,
            branch_name: branch.nombre,
            as_of: as_of || null,
            products: rows
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Valorizacion',
                    columns: [
                        { header: 'Código', key: 'codigo', width: 14 },
                        { header: 'Producto', key: 'nombre', width: 35 },
                        { header: 'Categoría', key: 'categoria', width: 20 },
                        { header: 'Stock', key: 'stock', width: 12 },
                        { header: 'Costo Unit.', key: 'costo', width: 14 },
                        { header: 'Precio Venta', key: 'precio_venta', width: 14 },
                        { header: 'Valor Costo', key: 'valor_costo', width: 16 },
                        { header: 'Valor Venta', key: 'valor_venta', width: 16 },
                        { header: 'Margen ($)', key: 'margen_monto', width: 16 },
                        { header: 'Margen (%)', key: 'margen_pct', width: 14 }
                    ],
                    data: rows.map(r => {
                        const stock = parseFloat(r.stock || 0);
                        const costo = parseFloat(r.costo || 0);
                        const precio = parseFloat(r.precio_venta || 0);
                        const vCosto = stock * costo;
                        const vVenta = stock * precio;
                        const margen = vVenta - vCosto;
                        const margenPct = vVenta > 0 ? (margen / vVenta) * 100 : 0;
                        return {
                            codigo: r.codigo || 'S/C',
                            nombre: r.nombre,
                            categoria: r.categoria || 'GENERAL',
                            stock: stock.toFixed(2),
                            costo: costo.toFixed(2),
                            precio_venta: precio.toFixed(2),
                            valor_costo: vCosto.toFixed(2),
                            valor_venta: vVenta.toFixed(2),
                            margen_monto: margen.toFixed(2),
                            margen_pct: `${margenPct.toFixed(1)}%`
                        };
                    })
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-valorizacion-inventario.xlsx');
        }

        const pdfBuffer = await pdfService.generateInventoryValuationPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-valorizacion.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[InventoryValuationReport] Error:', error);
        res.status(500).json({ message: error.message || 'Error al generar el reporte de valorización' });
    }
};

const getInventoryTurnoverReport = async (req, res) => {
    try {
        const { branch_id, category_ids, days_inactive, only_stagnant } = req.query;
        const company_id = req.company_id;

        if (!branch_id) {
            return res.status(400).json({ message: 'La sucursal es requerida' });
        }

        const [companyRows] = await pool.query('SELECT razon_social as nombre, nit, nrc FROM companies WHERE id = ?', [company_id]);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);

        if (!companyRows.length || !branchRows.length) {
            return res.status(404).json({ message: 'Empresa o Sucursal no encontrada' });
        }

        const company = companyRows[0];
        const branch = branchRows[0];

        let query = `
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                c.name as categoria,
                COALESCE(i.stock, 0) as stock,
                p.costo,
                lm.ultimo_movimiento,
                DATEDIFF(NOW(), COALESCE(lm.ultimo_movimiento, p.created_at)) as dias_inactivo
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id AND i.branch_id = ?
            LEFT JOIN product_categories c ON p.category_id = c.id
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            LEFT JOIN (
                SELECT product_id, MAX(created_at) as ultimo_movimiento
                FROM inventory_movements
                WHERE branch_id = ?
                GROUP BY product_id
            ) lm ON p.id = lm.product_id
            WHERE p.company_id = ? AND p.status = 'activo'
        `;
        const params = [branch_id, branch_id, branch_id, company_id];

        if (category_ids) {
            const ids = category_ids.split(',').map(id => parseInt(id)).filter(Boolean);
            if (ids.length > 0) {
                query += ` AND p.category_id IN (${ids.map(() => '?').join(',')})`;
                params.push(...ids);
            }
        }

        const minDays = parseInt(days_inactive || 0, 10);
        if (minDays > 0) {
            query += ` AND DATEDIFF(NOW(), COALESCE(lm.ultimo_movimiento, p.created_at)) >= ?`;
            params.push(minDays);
        }

        if (only_stagnant === 'true' || only_stagnant === true) {
            query += ` AND COALESCE(i.stock, 0) > 0`;
        }

        query += ` ORDER BY dias_inactivo DESC, p.nombre ASC`;

        const [rows] = await pool.query(query, params);

        let criteriaText = '';
        if (minDays > 0) {
            criteriaText = `PRODUCTOS CON MÁS DE ${minDays} DÍAS SIN MOVIMIENTO`;
        } else {
            criteriaText = `ANÁLISIS GENERAL DE ROTACIÓN E INACTIVIDAD`;
        }

        const reportData = {
            company_id,
            company,
            branch_name: branch.nombre,
            criteriaText,
            products: rows
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Rotacion',
                    columns: [
                        { header: 'Código', key: 'codigo', width: 14 },
                        { header: 'Producto', key: 'nombre', width: 35 },
                        { header: 'Categoría', key: 'categoria', width: 20 },
                        { header: 'Stock Actual', key: 'stock', width: 14 },
                        { header: 'Costo Unit.', key: 'costo', width: 14 },
                        { header: 'Capital Inmovilizado', key: 'inmovilizado', width: 18 },
                        { header: 'Último Movimiento', key: 'ultimo_mov', width: 18 },
                        { header: 'Días Inactivo', key: 'dias_inactivo', width: 14 },
                        { header: 'Estado', key: 'estado', width: 16 }
                    ],
                    data: rows.map(r => {
                        const stock = parseFloat(r.stock || 0);
                        const costo = parseFloat(r.costo || 0);
                        const dias = parseInt(r.dias_inactivo || 0, 10);
                        let estado = 'Normal';
                        if (dias >= 120) estado = 'Crítico (+120d)';
                        else if (dias >= 90) estado = 'Obsoleto (90d)';
                        else if (dias >= 60) estado = 'Lento (60d)';
                        else if (dias >= 30) estado = 'Bajo (30d)';

                        return {
                            codigo: r.codigo || 'S/C',
                            nombre: r.nombre,
                            categoria: r.categoria || 'GENERAL',
                            stock: stock.toFixed(2),
                            costo: costo.toFixed(2),
                            inmovilizado: (stock * costo).toFixed(2),
                            ultimo_mov: r.ultimo_movimiento ? reportPdfHelper.formatDate(r.ultimo_movimiento) : 'Sin Mov.',
                            dias_inactivo: dias,
                            estado
                        };
                    })
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-rotacion-inventario.xlsx');
        }

        const pdfBuffer = await pdfService.generateInventoryTurnoverPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-rotacion.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[InventoryTurnoverReport] Error:', error);
        res.status(500).json({ message: error.message || 'Error al generar el reporte de rotación' });
    }
};

const getTransfersReportPDF = async (req, res) => {
    try {
        const { search, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        const params = [companyId];
        let whereClause = 'WHERE t.company_id = ?';
        if (branch_id && branch_id !== 'all') {
            whereClause += ' AND (t.origen_branch_id = ? OR t.destino_branch_id = ?)';
            params.push(branch_id, branch_id);
        }
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
                   (SELECT COUNT(*) FROM inventory_transfer_items WHERE transfer_id = t.id) AS items_count,
                   (SELECT COALESCE(SUM(cantidad), 0) FROM inventory_transfer_items WHERE transfer_id = t.id) AS total_unidades
            FROM inventory_transfers t
            JOIN branches b1 ON t.origen_branch_id = b1.id
            JOIN branches b2 ON t.destino_branch_id = b2.id
            JOIN users u ON t.usuario_id = u.id
            ${whereClause}
            ORDER BY t.fecha DESC
        `;

        const [rows] = await pool.query(query, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Traslados',
                    columns: [
                        { header: 'Documento', key: 'documento', width: 15 },
                        { header: 'Fecha', key: 'fecha', width: 20 },
                        { header: 'Sucursal Origen', key: 'origen', width: 25 },
                        { header: 'Sucursal Destino', key: 'destino', width: 25 },
                        { header: 'Usuario', key: 'usuario', width: 20 },
                        { header: 'Items', key: 'items', width: 10 },
                        { header: 'Unidades', key: 'unidades', width: 12 },
                        { header: 'Estado', key: 'estado', width: 15 },
                        { header: 'Observaciones', key: 'observaciones', width: 30 }
                    ],
                    rows: rows.map(r => ({
                        documento: `TR-${String(r.id).padStart(6, '0')}`,
                        fecha: r.fecha ? new Date(r.fecha).toLocaleString('es-SV') : '',
                        origen: (r.origen_nombre || '').toUpperCase(),
                        destino: (r.destino_nombre || '').toUpperCase(),
                        usuario: (r.usuario_nombre || '').toUpperCase(),
                        items: parseInt(r.items_count) || 0,
                        unidades: parseFloat(r.total_unidades || 0),
                        estado: (r.status || 'COMPLETADO').toUpperCase(),
                        observaciones: r.observaciones || ''
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-traslados.xlsx');
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

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Traslados de Inventario', periodText, 'landscape', subtitle);

        const colW = {
            doc: 65,
            fecha: 90,
            origen: 105,
            destino: 105,
            usuario: 95,
            items: 45,
            unidades: 52,
            estado: 65,
            obs: 110
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('DOCUMENTO', x, yPos + 3); x += colW.doc;
            doc.text('FECHA / HORA', x, yPos + 3); x += colW.fecha;
            doc.text('SUC. ORIGEN', x, yPos + 3); x += colW.origen;
            doc.text('SUC. DESTINO', x, yPos + 3); x += colW.destino;
            doc.text('USUARIO', x, yPos + 3); x += colW.usuario;
            doc.text('ITEMS', x, yPos + 3, { width: colW.items, align: 'center' }); x += colW.items;
            doc.text('UNIDADES', x, yPos + 3, { width: colW.unidades, align: 'right' }); x += colW.unidades;
            doc.text('ESTADO', x, yPos + 3, { width: colW.estado, align: 'center' }); x += colW.estado;
            doc.text('OBSERVACIONES', x, yPos + 3, { width: colW.obs });
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (rows.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron traslados de inventario registrados.', startX, currentY + 10);
            currentY += 30;
        } else {
            let totalItemsCount = 0;
            let totalUnidadesSum = 0;

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
                doc.text(`TR-${String(r.id).padStart(6, '0')}`, x, currentY); x += colW.doc;

                doc.font('Helvetica').fillColor('#334155');
                const fechaStr = r.fecha ? `${reportPdfHelper.formatDate(r.fecha)} ${new Date(r.fecha).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '---';
                doc.text(fechaStr, x, currentY); x += colW.fecha;

                doc.text((r.origen_nombre || '').substring(0, 20).toUpperCase(), x, currentY); x += colW.origen;
                doc.text((r.destino_nombre || '').substring(0, 20).toUpperCase(), x, currentY); x += colW.destino;
                doc.text((r.usuario_nombre || '').substring(0, 18).toUpperCase(), x, currentY); x += colW.usuario;
                
                const itemsCount = parseInt(r.items_count) || 0;
                const unidadesCount = parseFloat(r.total_unidades) || 0;
                totalItemsCount += itemsCount;
                totalUnidadesSum += unidadesCount;

                doc.text(String(itemsCount), x, currentY, { width: colW.items, align: 'center' }); x += colW.items;
                doc.text(unidadesCount.toFixed(2), x, currentY, { width: colW.unidades, align: 'right' }); x += colW.unidades;

                const statusColor = r.status === 'ANULADO' ? '#e11d48' : '#059669';
                doc.font('Helvetica-Bold').fillColor(statusColor);
                doc.text(r.status || 'COMPLETADO', x, currentY, { width: colW.estado, align: 'center' }); x += colW.estado;

                doc.font('Helvetica').fillColor('#64748b');
                doc.text((r.observaciones || '---').substring(0, 30), x, currentY, { width: colW.obs });

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
            doc.text('TOTALES:', startX + colW.doc + colW.fecha + colW.origen + colW.destino, currentY, { width: colW.usuario, align: 'right' });
            
            let sx = startX + colW.doc + colW.fecha + colW.origen + colW.destino + colW.usuario;
            doc.text(String(totalItemsCount), sx, currentY, { width: colW.items, align: 'center' }); sx += colW.items;
            doc.text(totalUnidadesSum.toFixed(2), sx, currentY, { width: colW.unidades, align: 'right' });
            currentY += 16;
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Traslados');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="reporte-traslados.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getTransfersReportPDF] Error:', error);
        res.status(500).json({ message: error.message || 'Error al generar reporte de traslados' });
    }
};

module.exports = { 
    getInventory, 
    getKardex, 
    getKardexReport,
    getInventoryValuationReport,
    getInventoryTurnoverReport,
    createTransfer, 
    getTransfers, 
    getTransfersReportPDF,
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

