const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const excelService = require('../services/excel.service');
const { getEffectiveProductId } = require('../utils/inventoryUtils');
const notificationService = require('../services/notification.service');
const reportPdfHelper = require('../utils/reportPdfHelper');
const aiService = require('../services/ai.service');

/**
 * Obtener lista de compras con búsqueda y paginación
 */
const getPurchases = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, branch_id } = req.query;
        const offset = (page - 1) * limit;
        const companyId = req.company_id || req.user?.company_id;

        let query = `
            SELECT ph.*, 
                   p.nombre AS provider_nombre, 
                   br.nombre AS branch_nombre,
                   u.nombre AS usuario_nombre,
                   cat_dte.description AS tipo_documento_nombre,
                   cat_cond.description AS condicion_operacion_nombre
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            LEFT JOIN branches br ON ph.branch_id = br.id
            LEFT JOIN users u ON ph.usuario_id = u.id
            LEFT JOIN cat_002_tipo_dte cat_dte ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_dte.code
            LEFT JOIN cat_016_condicion_operacion cat_cond ON ph.condicion_operacion_id COLLATE utf8mb4_unicode_ci = cat_cond.code
            WHERE ph.company_id = ?
        `;
        let params = [companyId];

        if (branch_id) {
            query += " AND ph.branch_id = ?";
            params.push(branch_id);
        }

        const getSearchWords = (term) => {
            const words = term.trim().split(/\s+/).filter(Boolean);
            return [...new Set(words)];
        };

        const searchWords = search ? getSearchWords(search) : [];
        searchWords.forEach(word => {
            query += ` AND (ph.numero_documento LIKE ? OR ph.numero_control LIKE ? OR ph.sello_recepcion LIKE ? OR p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR ph.observaciones LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY ph.fecha DESC, ph.id DESC LIMIT ? OFFSET ? `;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error al obtener compras:', error);
        res.status(500).json({ message: 'Error al obtener compras' });
    }
};

/**
 * Obtener detalle de una compra por ID
 */
const getPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        const [header] = await pool.query(`
            SELECT ph.*, p.nombre AS provider_nombre, br.nombre AS branch_nombre,
                   cat.description AS tipo_documento_nombre
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            LEFT JOIN branches br ON ph.branch_id = br.id
            LEFT JOIN cat_002_tipo_dte cat ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE ph.id = ? AND ph.company_id = ?
        `, [id, companyId]);

        if (header.length === 0) {
            return res.status(404).json({ message: 'Compra no encontrada' });
        }

        const [items] = await pool.query(`
            SELECT pi.*, p.nombre, p.codigo, p.tipo_combustible
            FROM purchase_items pi
            JOIN products p ON pi.product_id = p.id
            WHERE pi.purchase_id = ?
        `, [id]);

        res.json({ ...header[0], items });
    } catch (error) {
        console.error('Error al obtener detalle de compra:', error);
        res.status(500).json({ message: 'Error al obtener detalle de compra' });
    }
};

/**
 * Crear una nueva compra
 */
const createPurchase = async (req, res) => {
    const { 
        branch_id, provider_id, fecha, numero_documento, 
        tipo_documento_id, condicion_operacion_id, observaciones,
        total_nosujeta, total_exenta, total_gravada, 
        iva, retencion, percepcion, fovial, cotrans, monto_total,
        dias_credito, fecha_vencimiento,
        period_year, period_month,
        items 
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un producto' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const companyId = req.company_id || req.user?.company_id;
        const usuarioId = req.user?.id;

        if (!companyId || !usuarioId) throw new Error('Sesión no válida');

        // 1. Validar y asegurar cálculos fiscales (IVA, totales)
        const [provRows] = await connection.query('SELECT exento_iva, nombre FROM providers WHERE id = ? AND company_id = ?', [provider_id, companyId]);
        const isProviderExempt = provRows.length > 0 ? Boolean(provRows[0].exento_iva) : false;
        const providerName = provRows.length > 0 ? (provRows[0].nombre || '') : '';

        const gravadaNum = parseFloat(total_gravada) || 0;
        const nosujetaNum = parseFloat(total_nosujeta) || 0;
        const exentaNum = parseFloat(total_exenta) || 0;
        const retencionNum = parseFloat(retencion) || 0;
        const percepcionNum = parseFloat(percepcion) || 0;
        const fovialNum = parseFloat(fovial) || 0;
        const cotransNum = parseFloat(cotrans) || 0;

        let finalIva = 0;
        if (tipo_documento_id === '01' || isProviderExempt) {
            finalIva = 0;
        } else if (['03', '06'].includes(tipo_documento_id) && gravadaNum > 0) {
            finalIva = Math.round(gravadaNum * 0.13 * 100) / 100;
        } else {
            finalIva = parseFloat(iva) || 0;
        }

        const finalMontoTotal = Math.round((gravadaNum + exentaNum + nosujetaNum + finalIva + fovialNum + cotransNum - retencionNum + percepcionNum) * 100) / 100;

        // Periodo fiscal de la compra (Art. 65 Ley del IVA: no puede declararse en un periodo anterior a su emision)
        let docYear = new Date().getFullYear();
        let docMonth = new Date().getMonth() + 1;
        if (fecha) {
            if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
                const parts = fecha.split('T')[0].split('-');
                docYear = parseInt(parts[0], 10);
                docMonth = parseInt(parts[1], 10);
            } else {
                const d = new Date(fecha);
                if (!isNaN(d.getTime())) {
                    docYear = d.getFullYear();
                    docMonth = d.getMonth() + 1;
                }
            }
        }
        let finalPeriodYear = parseInt(period_year, 10) || docYear;
        let finalPeriodMonth = parseInt(period_month, 10) || docMonth;
        if (finalPeriodYear < docYear || (finalPeriodYear === docYear && finalPeriodMonth < docMonth)) {
            finalPeriodYear = docYear;
            finalPeriodMonth = docMonth;
        }

        // Si no existe un periodo configurado para este usuario, crearlo al guardar el registro
        const [existingPeriod] = await connection.query(
            'SELECT id FROM purchase_user_periods WHERE user_id = ? AND company_id = ?',
            [usuarioId, companyId]
        );
        if (existingPeriod.length === 0) {
            await connection.query(
                'INSERT INTO purchase_user_periods (user_id, company_id, year, month) VALUES (?, ?, ?, ?)',
                [usuarioId, companyId, finalPeriodYear, finalPeriodMonth]
            );
        }

        // 1. Insertar Cabecera
        const numeroControl = req.body.numero_control || req.body.num_control || null;
        const selloRecepcion = req.body.sello_recepcion || null;

        const [headerResult] = await connection.query(`
             INSERT INTO purchase_headers 
             (company_id, branch_id, usuario_id, provider_id, fecha, numero_documento, 
              numero_control, sello_recepcion,
              tipo_documento_id, condicion_operacion_id, observaciones,
              dias_credito, fecha_vencimiento,
              total_nosujeta, total_exenta, total_gravada, 
              iva, retencion, percepcion, fovial, cotrans, monto_total,
              documento_afectado, fecha_afectada,
              period_year, period_month)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         `, [
             companyId, branch_id, usuarioId, provider_id, fecha || new Date(), numero_documento,
             numeroControl, selloRecepcion,
             tipo_documento_id, condicion_operacion_id, observaciones,
             dias_credito || 0, fecha_vencimiento || null,
             nosujetaNum, exentaNum, gravadaNum,
             finalIva, retencionNum, percepcionNum, fovialNum, cotransNum, finalMontoTotal,
             req.body.documento_afectado || null, req.body.fecha_afectada || null,
             finalPeriodYear, finalPeriodMonth
         ]);

        const purchaseId = headerResult.insertId;

        // 2. Insertar Items y Actualizar Inventario
        for (const item of items) {
            const { product_id, cantidad, precio_unitario } = item;
            const qty = parseFloat(cantidad);
            const price = parseFloat(precio_unitario);
            const total = qty * price;

            await connection.query(`
                INSERT INTO purchase_items (purchase_id, product_id, cantidad, precio_unitario, total)
                VALUES (?, ?, ?, ?, ?)
            `, [purchaseId, product_id, qty, price, total]);

            // Determinar impacto (Entrada por defecto, Salida si es Nota de Crédito 06)
            const esNotaCredito = tipo_documento_id === '06';
            const sqlImpacto = esNotaCredito 
                ? 'UPDATE inventory SET stock = stock - ? WHERE id = ?'
                : 'UPDATE inventory SET stock = stock + ? WHERE id = ?';
            const movTipo = esNotaCredito ? 'SALIDA' : 'ENTRADA';

            // Resolver ID efectivo para inventario
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            // Actualizar Inventario
            const [stockRows] = await connection.query(
                'SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?',
                [effectiveProductId, branch_id]
            );

            if (stockRows.length > 0) {
                await connection.query(sqlImpacto, [qty, stockRows[0].id]);
            } else if (!esNotaCredito) {
                // Solo crear si es entrada (usamos el ID efectivo)
                await connection.query(
                    'INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?)',
                    [companyId, branch_id, effectiveProductId, qty]
                );
            } else {
                // Nota de crédito sin registro previo (usamos el ID efectivo)
                await connection.query(
                    'INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?)',
                    [companyId, branch_id, effectiveProductId, -qty]
                );
            }

            // Registrar en movimientos de inventario general (usamos el ID efectivo)
            await connection.query(`
                INSERT INTO inventory_movements 
                (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, documento_id, tipo_documento)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPRA')
            `, [companyId, branch_id, effectiveProductId, movTipo, qty, price, purchaseId]);

            // ACTUALIZACIÓN DE COSTO: Si es un ingreso, actualizar el costo en la tabla de productos
            const esIngreso = ['01', '03', '05', '14'].includes(tipo_documento_id);
            if (esIngreso) {
                await connection.query(
                    'UPDATE products SET costo = ? WHERE id = ?',
                    [price, product_id]
                );
            }
        }

        await connection.commit();

        notificationService.notify('purchase_created', req.company_id, req.user.branch_id, {
            compra_id: purchaseId,
            proveedor_nombre: providerName,
            numero_documento: numero_documento || '',
            total: monto_total || 0,
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.status(201).json({ message: 'Compra registrada con éxito', id: purchaseId });
    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar compra:', error);
        res.status(500).json({ message: 'Error al registrar compra: ' + error.message });
    } finally {
        connection.release();
    }
};

/**
 * Actualizar una compra existente (incluye reversión de inventario)
 */
const updatePurchase = async (req, res) => {
    const { id } = req.params;
    const { 
        branch_id, provider_id, fecha, numero_documento, 
        tipo_documento_id, condicion_operacion_id, observaciones,
        total_nosujeta, total_exenta, total_gravada, 
        iva, retencion, percepcion, fovial, cotrans, monto_total,
        dias_credito, fecha_vencimiento,
        period_year, period_month,
        items 
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const companyId = req.company_id || req.user?.company_id;

        // 1. Obtener compra y items actuales para REVERSAR
        const [oldPurchase] = await connection.query(
            'SELECT * FROM purchase_headers WHERE id = ? AND company_id = ?',
            [id, companyId]
        );
        if (oldPurchase.length === 0) throw new Error('Compra no encontrada');
        
        const oldBranchId = oldPurchase[0].branch_id;
        const oldTipoDoc = oldPurchase[0].tipo_documento_id;
        const [oldItems] = await connection.query(
            'SELECT * FROM purchase_items WHERE purchase_id = ?',
            [id]
        );

        // REVERSAR IMPACTO ANTIGUO
        for (const oldItem of oldItems) {
            const esNC = oldTipoDoc === '06';
            const reverseSql = esNC 
                ? 'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?'
                : 'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?';
            
            // Resolver ID efectivo (por si la configuración del producto cambió o para ser consistente)
            const oldEffectiveId = await getEffectiveProductId(connection, oldItem.product_id);

            // Verificar si el registro de inventario existe
            const [stockRows] = await connection.query(
                'SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?',
                [oldEffectiveId, oldBranchId]
            );
            
            if (stockRows.length > 0) {
                await connection.query(reverseSql, [oldItem.cantidad, oldEffectiveId, oldBranchId]);
            }
        }

        // Eliminar items antiguos
        await connection.query('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);

        // Validar y asegurar cálculos fiscales (IVA, totales)
        const [provRows] = await connection.query('SELECT exento_iva FROM providers WHERE id = ? AND company_id = ?', [provider_id, companyId]);
        const isProviderExempt = provRows.length > 0 ? Boolean(provRows[0].exento_iva) : false;

        const gravadaNum = parseFloat(total_gravada) || 0;
        const nosujetaNum = parseFloat(total_nosujeta) || 0;
        const exentaNum = parseFloat(total_exenta) || 0;
        const retencionNum = parseFloat(retencion) || 0;
        const percepcionNum = parseFloat(percepcion) || 0;
        const fovialNum = parseFloat(fovial) || 0;
        const cotransNum = parseFloat(cotrans) || 0;

        let finalIva = 0;
        if (tipo_documento_id === '01' || isProviderExempt) {
            finalIva = 0;
        } else if (['03', '06'].includes(tipo_documento_id) && gravadaNum > 0) {
            finalIva = Math.round(gravadaNum * 0.13 * 100) / 100;
        } else {
            finalIva = parseFloat(iva) || 0;
        }

        const finalMontoTotal = Math.round((gravadaNum + exentaNum + nosujetaNum + finalIva + fovialNum + cotransNum - retencionNum + percepcionNum) * 100) / 100;

        const usuarioId = req.user?.id;

        // Periodo fiscal de la compra (Art. 65 Ley del IVA: no puede declararse en un periodo anterior a su emision)
        let docYear = new Date().getFullYear();
        let docMonth = new Date().getMonth() + 1;
        if (fecha) {
            if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
                const parts = fecha.split('T')[0].split('-');
                docYear = parseInt(parts[0], 10);
                docMonth = parseInt(parts[1], 10);
            } else {
                const d = new Date(fecha);
                if (!isNaN(d.getTime())) {
                    docYear = d.getFullYear();
                    docMonth = d.getMonth() + 1;
                }
            }
        }
        let finalPeriodYear = parseInt(period_year, 10) || docYear;
        let finalPeriodMonth = parseInt(period_month, 10) || docMonth;
        if (finalPeriodYear < docYear || (finalPeriodYear === docYear && finalPeriodMonth < docMonth)) {
            finalPeriodYear = docYear;
            finalPeriodMonth = docMonth;
        }

        // Si no existe un periodo configurado para este usuario, crearlo al guardar el registro
        if (usuarioId && companyId) {
            const [existingPeriod] = await connection.query(
                'SELECT id FROM purchase_user_periods WHERE user_id = ? AND company_id = ?',
                [usuarioId, companyId]
            );
            if (existingPeriod.length === 0) {
                await connection.query(
                    'INSERT INTO purchase_user_periods (user_id, company_id, year, month) VALUES (?, ?, ?, ?)',
                    [usuarioId, companyId, finalPeriodYear, finalPeriodMonth]
                );
            }
        }

        // 2. Actualizar Cabecera
        const numeroControl = req.body.numero_control || req.body.num_control || null;
        const selloRecepcion = req.body.sello_recepcion || null;

        await connection.query(`
            UPDATE purchase_headers SET 
                branch_id = ?, provider_id = ?, fecha = ?, numero_documento = ?,
                numero_control = ?, sello_recepcion = ?,
                tipo_documento_id = ?, condicion_operacion_id = ?, observaciones = ?,
                dias_credito = ?, fecha_vencimiento = ?,
                total_nosujeta = ?, total_exenta = ?, total_gravada = ?,
                iva = ?, retencion = ?, percepcion = ?, fovial = ?, cotrans = ?, monto_total = ?,
                documento_afectado = ?, fecha_afectada = ?,
                period_year = ?, period_month = ?
            WHERE id = ? AND company_id = ?
        `, [
            branch_id, provider_id, fecha, numero_documento,
            numeroControl, selloRecepcion,
            tipo_documento_id, condicion_operacion_id, observaciones,
            dias_credito || 0, fecha_vencimiento || null,
            nosujetaNum, exentaNum, gravadaNum,
            finalIva, retencionNum, percepcionNum, fovialNum, cotransNum, finalMontoTotal,
            req.body.documento_afectado || null, req.body.fecha_afectada || null,
            finalPeriodYear, finalPeriodMonth,
            id, companyId
        ]);

        // 3. Insertar Nuevos Items y Aplicar NUEVO IMPACTO
        for (const item of items) {
            const { product_id, cantidad, precio_unitario } = item;
            const qty = parseFloat(cantidad);
            const price = parseFloat(precio_unitario);
            const total = qty * price;

            await connection.query(`
                INSERT INTO purchase_items (purchase_id, product_id, cantidad, precio_unitario, total)
                VALUES (?, ?, ?, ?, ?)
            `, [id, product_id, qty, price, total]);

            // Resolver ID efectivo para inventario
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            const newEsNC = tipo_documento_id === '06';
            const applySql = newEsNC
                ? 'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?'
                : 'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?';
            
            // Asegurar que existe registro de inventario
            const [stockRows] = await connection.query(
                'SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?',
                [effectiveProductId, branch_id]
            );

            if (stockRows.length > 0) {
                await connection.query(applySql, [qty, effectiveProductId, branch_id]);
            } else if (!newEsNC) {
                await connection.query(
                    'INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?)',
                    [companyId, branch_id, effectiveProductId, qty]
                );
            } else {
                await connection.query(
                    'INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?)',
                    [companyId, branch_id, effectiveProductId, -qty]
                );
            }

        }

        // Registrar movimientos por DELTA (efecto_nuevo - efecto_viejo); el movimiento COMPRA original queda intacto
        const oldEffects = {};
        for (const oldItem of oldItems) {
            const efectoViejo = (oldTipoDoc === '06' ? -1 : 1) * parseFloat(oldItem.cantidad);
            oldEffects[oldItem.product_id] = (oldEffects[oldItem.product_id] || 0) + efectoViejo;
        }

        const newEffects = {};
        const newPrices = {};
        for (const item of items) {
            const efectoNuevo = (tipo_documento_id === '06' ? -1 : 1) * parseFloat(item.cantidad);
            newEffects[item.product_id] = (newEffects[item.product_id] || 0) + efectoNuevo;
            newPrices[item.product_id] = parseFloat(item.precio_unitario);
        }

        for (const productKey of new Set([...Object.keys(oldEffects), ...Object.keys(newEffects)])) {
            const productId = parseInt(productKey, 10);
            const delta = (newEffects[productId] || 0) - (oldEffects[productId] || 0);
            if (delta === 0) continue;

            const effectiveProductId = await getEffectiveProductId(connection, productId);
            const movBranch = newEffects[productId] !== undefined ? branch_id : oldBranchId;
            await connection.query(`
                INSERT INTO inventory_movements 
                (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, documento_id, tipo_documento)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'EDICION_COMPRA')
            `, [companyId, movBranch, effectiveProductId, delta > 0 ? 'ENTRADA' : 'SALIDA', Math.abs(delta), newPrices[productId] || 0, id]);
        }

        await connection.commit();
        res.json({ message: 'Compra actualizada con éxito' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar compra:', error);
        res.status(500).json({ message: 'Error al actualizar compra: ' + error.message });
    } finally {
        connection.release();
    }
};

/**
 * Anular una compra
 */
const voidPurchase = async (req, res) => {
    const { id } = req.params;
    const companyId = req.company_id || req.user?.company_id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Verificar estado actual
        const [purchase] = await connection.query(
            `SELECT ph.*, pr.nombre AS proveedor_nombre
             FROM purchase_headers ph
             LEFT JOIN providers pr ON ph.provider_id = pr.id
             WHERE ph.id = ? AND ph.company_id = ?`,
            [id, companyId]
        );

        if (purchase.length === 0) throw new Error('Compra no encontrada');
        if (purchase[0].status === 'ANULADO') throw new Error('La compra ya está anulada');

        const { branch_id, tipo_documento_id } = purchase[0];
        const esNotaCredito = tipo_documento_id === '06';

        // 2. Obtener items para reversar inventario
        const [items] = await connection.query(
            'SELECT product_id, cantidad FROM purchase_items WHERE purchase_id = ?',
            [id]
        );

        for (const item of items) {
            const { product_id, cantidad } = item;
            const qty = parseFloat(cantidad);

            // Resolver ID efectivo para reversión
            const effectiveProductId = await getEffectiveProductId(connection, product_id);

            // Reversar stock
            // Si era entrada (compra normal), restamos. Si era salida (nota crédito), sumamos.
            const sqlReverse = esNotaCredito
                ? 'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?'
                : 'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?';
            const revMovTipo = esNotaCredito ? 'ENTRADA' : 'SALIDA';

            await connection.query(sqlReverse, [qty, effectiveProductId, branch_id]);

            // Registrar movimiento de reversión (usamos el ID efectivo)
            await connection.query(`
                INSERT INTO inventory_movements 
                (company_id, branch_id, product_id, tipo_movimiento, cantidad, documento_id, tipo_documento, fecha)
                VALUES (?, ?, ?, ?, ?, ?, 'ANULACION_COMPRA', ?)
            `, [companyId, branch_id, effectiveProductId, revMovTipo, qty, id, new Date()]);
        }

        // 3. Marcar como ANULADO
        await connection.query(
            'UPDATE purchase_headers SET status = "ANULADO" WHERE id = ?',
            [id]
        );

        await connection.commit();

        notificationService.notify('purchase_annulled', req.company_id, req.user.branch_id, {
            compra_id: id,
            proveedor_nombre: purchase[0].proveedor_nombre || '',
            numero_documento: purchase[0].numero_documento || '',
            total: purchase[0].monto_total || 0,
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.json({ message: 'Compra anulada correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al anular compra:', error);
        res.status(500).json({ message: 'Error al anular compra: ' + error.message });
    } finally {
        connection.release();
    }
};

/**
 * Exportar compra a PDF
 */
const exportPurchasePDF = async (req, res) => {
    const { id } = req.params;
    const companyId = req.company_id || req.user?.company_id;

    try {
        // 1. Obtener cabecera con nombres
        const [purchase] = await pool.query(`
            SELECT ph.*, p.nombre AS provider_nombre, p.nrc AS provider_nrc, p.nit AS provider_nit,
                   b.nombre AS branch_nombre, b.direccion AS branch_direccion,
                   cat.description AS tipo_doc_nombre,
                   c.razon_social AS company_nombre, c.nit AS company_nit
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            LEFT JOIN branches b ON ph.branch_id = b.id
            LEFT JOIN companies c ON ph.company_id = c.id
            LEFT JOIN cat_002_tipo_dte cat ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat.code COLLATE utf8mb4_unicode_ci
            WHERE ph.id = ? AND ph.company_id = ?
        `, [id, companyId]);

        if (purchase.length === 0) return res.status(404).json({ message: 'Compra no encontrada' });
        const p = purchase[0];

        // 2. Obtener items
        const [items] = await pool.query(`
            SELECT pi.*, prod.nombre, prod.codigo
            FROM purchase_items pi
            JOIN products prod ON pi.product_id = prod.id
            WHERE pi.purchase_id = ?
        `, [id]);

        // 3. Generar PDF
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Compra_${p.numero_documento || 'Sin_Numero'}.pdf"`);
            res.setHeader('Content-Length', result.length);
            res.send(result);
        });

        // Header
        doc.fontSize(20).text(p.company_nombre?.toUpperCase() || 'EMPRESA', { align: 'center' });
        doc.fontSize(10).text(`NIT: ${p.company_nit || '---'}`, { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(14).text('COMPROBANTE DE COMPRA', { align: 'center', underline: true });
        doc.moveDown();

        // Details Grid
        const startX = 50;
        let currentY = doc.y;

        doc.fontSize(10).font('Helvetica-Bold').text('INFORMACIÓN DEL PROVEEDOR', startX, currentY);
        doc.font('Helvetica').text(`Proveedor: ${p.provider_nombre || '---'}`, startX, currentY + 15);
        doc.text(`NRC/NIT: ${p.provider_nrc || p.provider_nit || '---'}`, startX, currentY + 30);

        doc.font('Helvetica-Bold').text('DETALLES DEL DOCUMENTO', startX + 300, currentY);
        doc.font('Helvetica').text(`Tipo: ${p.tipo_doc_nombre || '---'}`, startX + 300, currentY + 15);
        doc.text(`Número: ${p.numero_documento || '---'}`, startX + 300, currentY + 30);
        
        let extraY = 45;
        if (p.numero_control) {
            doc.text(`N° Control: ${p.numero_control}`, startX + 300, currentY + extraY);
            extraY += 15;
        }

        let fechaDoc = '---';
        try { if (p.fecha) fechaDoc = new Date(p.fecha).toLocaleDateString(); } catch (e) {}
        doc.text(`Fecha: ${fechaDoc}`, startX + 300, currentY + extraY);

        if (p.sello_recepcion) {
            extraY += 15;
            doc.fontSize(8).text(`Sello: ${p.sello_recepcion}`, startX + 300, currentY + extraY, { width: 230 });
            doc.fontSize(10);
        }

        doc.moveDown(4);

        // Table Header
        const tableTop = doc.y + 20;
        doc.font('Helvetica-Bold');
        doc.text('CÓDIGO', 50, tableTop);
        doc.text('DESCRIPCIÓN', 120, tableTop);
        doc.text('CANT', 400, tableTop, { width: 40, align: 'right' });
        doc.text('PRECIO U.', 450, tableTop, { width: 60, align: 'right' });
        doc.text('TOTAL', 520, tableTop, { width: 40, align: 'right' });
        
        doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();

        // Table Rows
        let rowY = tableTop + 25;
        doc.font('Helvetica');
        items.forEach(item => {
            if (rowY > 700) { doc.addPage(); rowY = 50; }
            doc.text(item.codigo || '---', 50, rowY);
            doc.text(item.nombre?.toUpperCase() || 'PRODUCTO', 120, rowY, { width: 270 });
            doc.text((item.cantidad || 0).toString(), 400, rowY, { width: 40, align: 'right' });
            doc.text(parseFloat(item.precio_unitario || 0).toFixed(2), 450, rowY, { width: 60, align: 'right' });
            doc.text(parseFloat(item.total || 0).toFixed(2), 520, rowY, { width: 40, align: 'right' });
            rowY += 20;
        });

        doc.moveTo(50, rowY).lineTo(560, rowY).stroke();
        rowY += 10;

        // Totals
        const summaryX = 380;
        doc.text('SUBTOTAL GRAVADA:', summaryX, rowY);
        doc.text(`$${parseFloat(p.total_gravada || 0).toFixed(2)}`, 520, rowY, { align: 'right' });
        rowY += 15;
        doc.text('IVA (13%):', summaryX, rowY);
        doc.text(`$${parseFloat(p.iva || 0).toFixed(2)}`, 520, rowY, { align: 'right' });
        rowY += 15;
        if (parseFloat(p.retencion || 0) > 0) {
            doc.text('RETENCIÓN (1%):', summaryX, rowY);
            doc.text(`$${parseFloat(p.retencion).toFixed(2)}`, 520, rowY, { align: 'right' });
            rowY += 15;
        }
        if (parseFloat(p.percepcion || 0) > 0) {
            doc.text('PERCEPCIÓN (1%):', summaryX, rowY);
            doc.text(`$${parseFloat(p.percepcion).toFixed(2)}`, 520, rowY, { align: 'right' });
            rowY += 15;
        }
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text('TOTAL:', summaryX, rowY + 5, { width: 100 });
        doc.text(`$${parseFloat(p.monto_total || 0).toFixed(2)}`, 450, rowY + 5, { width: 110, align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Error al generar PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error al generar PDF' });
        }
    }
};

/**
 * Generar Reporte de Compras en PDF (Landscape)
 */
const getPurchaseReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, provider_id, search } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        // 1. Obtener datos de la empresa
        const company = await reportPdfHelper.getCompanyInfo(companyId);

        // 2. Construir Query de Compras
        let sql = `
            SELECT ph.*, 
                   p.nombre AS provider_nombre, 
                   br.nombre AS branch_nombre,
                   cat_dte.description AS tipo_doc_nombre,
                   cat_cond.description AS condicion_nombre
            FROM purchase_headers ph
            LEFT JOIN providers p ON ph.provider_id = p.id
            LEFT JOIN branches br ON ph.branch_id = br.id
            LEFT JOIN cat_002_tipo_dte cat_dte ON ph.tipo_documento_id COLLATE utf8mb4_unicode_ci = cat_dte.code
            LEFT JOIN cat_016_condicion_operacion cat_cond ON ph.condicion_operacion_id COLLATE utf8mb4_unicode_ci = cat_cond.code
            WHERE ph.company_id = ? AND ph.status != 'ANULADO'
        `;
        const params = [companyId];

        if (start_date && end_date) {
            sql += " AND ph.fecha BETWEEN ? AND ?";
            params.push(start_date, end_date);
        } else if (start_date) {
            sql += " AND ph.fecha >= ?";
            params.push(start_date);
        } else if (end_date) {
            sql += " AND ph.fecha <= ?";
            params.push(end_date);
        }

        if (branch_id && branch_id !== 'all') {
            sql += " AND ph.branch_id = ?";
            params.push(branch_id);
        }

        if (provider_id && provider_id !== 'all') {
            sql += " AND ph.provider_id = ?";
            params.push(provider_id);
        }

        if (search) {
            const words = search.trim().split(/\s+/).filter(Boolean);
            words.forEach(word => {
                sql += ` AND (ph.numero_documento LIKE ? OR ph.numero_control LIKE ? OR ph.sello_recepcion LIKE ? OR p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR ph.observaciones LIKE ?) `;
                const searchTerm = `%${word}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            });
        }

        sql += " ORDER BY p.nombre ASC, ph.fecha ASC";

        const [rows] = await pool.query(sql, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Reporte',
                    columns: [
                        { header: 'Proveedor', key: 'proveedor', width: 25 },
                        { header: 'Sucursal', key: 'sucursal', width: 20 },
                        { header: 'Fecha', key: 'fecha', width: 15 },
                        { header: 'Tipo Doc', key: 'tipo_doc', width: 12 },
                        { header: 'Documento', key: 'documento', width: 15 },
                        { header: 'N° Control', key: 'num_control', width: 20 },
                        { header: 'Condición', key: 'condicion', width: 12 },
                        { header: 'Gravada', key: 'gravada', width: 12 },
                        { header: 'Exenta', key: 'exenta', width: 12 },
                        { header: 'IVA', key: 'iva', width: 10 },
                        { header: 'Retención', key: 'retencion', width: 12 },
                        { header: 'Percepción', key: 'percepcion', width: 12 },
                        { header: 'FOVIAL', key: 'fovial', width: 10 },
                        { header: 'COTRANS', key: 'cotrans', width: 10 },
                        { header: 'Total', key: 'total', width: 12 }
                    ],
                    data: rows.map(r => ({
                        proveedor: r.provider_nombre,
                        sucursal: r.branch_nombre,
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        tipo_doc: r.tipo_doc_nombre,
                        documento: r.numero_documento,
                        num_control: r.numero_control || '---',
                        condicion: r.condicion_nombre,
                        gravada: parseFloat(r.total_gravada || 0).toFixed(2),
                        exenta: parseFloat(r.total_exenta || 0).toFixed(2),
                        iva: parseFloat(r.iva || 0).toFixed(2),
                        retencion: parseFloat(r.retencion || 0).toFixed(2),
                        percepcion: parseFloat(r.percepcion || 0).toFixed(2),
                        fovial: parseFloat(r.fovial || 0).toFixed(2),
                        cotrans: parseFloat(r.cotrans || 0).toFixed(2),
                        total: parseFloat(r.monto_total || 0).toFixed(2)
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'reporte-compras.xlsx');
        }

        let branchName = 'TODAS LAS SUCURSALES';
        if (branch_id && branch_id !== 'all' && rows.length > 0) {
            branchName = (rows[0].branch_nombre || '').toUpperCase();
        } else if (branch_id && branch_id !== 'all') {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (bRows.length > 0) branchName = (bRows[0].nombre || '').toUpperCase();
        }

        let periodText = '';
        if (start_date && end_date) {
            periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;
        } else if (start_date) {
            periodText = `DESDE EL ${reportPdfHelper.formatDate(start_date)}`;
        } else if (end_date) {
            periodText = `AL ${reportPdfHelper.formatDate(end_date)}`;
        } else {
            periodText = `AL ${reportPdfHelper.formatDate(new Date())}`;
        }
        const subtitle = `SUCURSAL: ${branchName}${search ? `   |   FILTRO: "${search}"` : ''}`;

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732; // 792 - 60

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Compras (Detallado)', periodText, 'landscape', subtitle);

        const colW = {
            fecha: 46,
            tipoDoc: 66,
            numero: 105,
            condicion: 48,
            gravada: 52,
            exenta: 50,
            iva: 45,
            ret: 42,
            per: 42,
            fov: 44,
            cot: 44,
            total: 66
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('FECHA', x, yPos + 3); x += colW.fecha;
            doc.text('TIPO DOC', x, yPos + 3); x += colW.tipoDoc;
            doc.text('NÚMERO', x, yPos + 3); x += colW.numero;
            doc.text('CONDICIÓN', x, yPos + 3); x += colW.condicion;
            doc.text('GRAVADA', x, yPos + 3, { width: colW.gravada, align: 'right' }); x += colW.gravada;
            doc.text('EXENTA', x, yPos + 3, { width: colW.exenta, align: 'right' }); x += colW.exenta;
            doc.text('IVA', x, yPos + 3, { width: colW.iva, align: 'right' }); x += colW.iva;
            doc.text('RET.', x, yPos + 3, { width: colW.ret, align: 'right' }); x += colW.ret;
            doc.text('PER.', x, yPos + 3, { width: colW.per, align: 'right' }); x += colW.per;
            doc.text('FOV.', x, yPos + 3, { width: colW.fov, align: 'right' }); x += colW.fov;
            doc.text('COT.', x, yPos + 3, { width: colW.cot, align: 'right' }); x += colW.cot;
            doc.text('TOTAL', x, yPos + 3, { width: colW.total - 6, align: 'right' });
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (rows.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron compras en el período seleccionado.', startX, currentY + 10);
            currentY += 30;
        } else {
            let currentProvider = null;
            let pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

            const printSubtotal = () => {
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.tipoDoc + colW.numero, currentY).lineTo(startX + contentWidth, currentY).stroke();
                currentY += 2;
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('SUBTOTAL:', startX + colW.fecha + colW.tipoDoc, currentY, { width: colW.numero, align: 'right' });
                let sx = startX + colW.fecha + colW.tipoDoc + colW.numero + colW.condicion;
                doc.text(reportPdfHelper.fmt(pTotals.grav), sx, currentY, { width: colW.gravada, align: 'right' }); sx += colW.gravada;
                doc.text(reportPdfHelper.fmt(pTotals.exe), sx, currentY, { width: colW.exenta, align: 'right' }); sx += colW.exenta;
                doc.text(reportPdfHelper.fmt(pTotals.iva), sx, currentY, { width: colW.iva, align: 'right' }); sx += colW.iva;
                doc.text(reportPdfHelper.fmt(pTotals.ret), sx, currentY, { width: colW.ret, align: 'right' }); sx += colW.ret;
                doc.text(reportPdfHelper.fmt(pTotals.per), sx, currentY, { width: colW.per, align: 'right' }); sx += colW.per;
                doc.text(reportPdfHelper.fmt(pTotals.fov), sx, currentY, { width: colW.fov, align: 'right' }); sx += colW.fov;
                doc.text(reportPdfHelper.fmt(pTotals.cot), sx, currentY, { width: colW.cot, align: 'right' }); sx += colW.cot;
                doc.text(reportPdfHelper.fmt(pTotals.total), sx, currentY, { width: colW.total - 6, align: 'right' });
                currentY += 15;
                pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            };

            for (const row of rows) {
                if (currentY > 520) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Reporte de Compras (Detallado)', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                if (row.provider_nombre !== currentProvider) {
                    if (currentProvider !== null) {
                        printSubtotal();
                    }
                    if (currentY > 520) {
                        doc.addPage();
                        reportPdfHelper.renderHeader(doc, company, 'Reporte de Compras (Detallado)', periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(doc.y + 4);
                    }
                    doc.rect(startX, currentY, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`PROVEEDOR: ${row.provider_nombre || 'S/N'}`, startX + 4, currentY + 3);
                    currentY += 16;
                    currentProvider = row.provider_nombre;
                }

                doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                let lx = startX + 4;
                doc.text(reportPdfHelper.formatDate(row.fecha), lx, currentY, { width: colW.fecha }); lx += colW.fecha;
                doc.text((row.tipo_doc_nombre || '---').substring(0, 16), lx, currentY, { width: colW.tipoDoc }); lx += colW.tipoDoc;
                doc.text(String(row.numero_documento || '---'), lx, currentY, { width: colW.numero }); lx += colW.numero;
                doc.text((row.condicion_nombre || 'CONTADO').substring(0, 10), lx, currentY, { width: colW.condicion }); lx += colW.condicion;

                const grav = parseFloat(row.total_gravada || 0);
                const exe = parseFloat(row.total_exenta || 0);
                const iva = parseFloat(row.iva || 0);
                const ret = parseFloat(row.retencion || 0);
                const per = parseFloat(row.percepcion || 0);
                const fov = parseFloat(row.fovial || 0);
                const cot = parseFloat(row.cotrans || 0);
                const tot = parseFloat(row.monto_total || 0);

                doc.text(reportPdfHelper.fmt(grav), lx, currentY, { width: colW.gravada, align: 'right' }); lx += colW.gravada;
                doc.text(reportPdfHelper.fmt(exe), lx, currentY, { width: colW.exenta, align: 'right' }); lx += colW.exenta;
                doc.text(reportPdfHelper.fmt(iva), lx, currentY, { width: colW.iva, align: 'right' }); lx += colW.iva;
                doc.text(reportPdfHelper.fmt(ret), lx, currentY, { width: colW.ret, align: 'right' }); lx += colW.ret;
                doc.text(reportPdfHelper.fmt(per), lx, currentY, { width: colW.per, align: 'right' }); lx += colW.per;
                doc.text(reportPdfHelper.fmt(fov), lx, currentY, { width: colW.fov, align: 'right' }); lx += colW.fov;
                doc.text(reportPdfHelper.fmt(cot), lx, currentY, { width: colW.cot, align: 'right' }); lx += colW.cot;
                doc.text(reportPdfHelper.fmt(tot), lx, currentY, { width: colW.total - 6, align: 'right' });

                pTotals.grav += grav;
                pTotals.exe += exe;
                pTotals.iva += iva;
                pTotals.ret += ret;
                pTotals.per += per;
                pTotals.fov += fov;
                pTotals.cot += cot;
                pTotals.total += tot;

                gTotals.grav += grav;
                gTotals.exe += exe;
                gTotals.iva += iva;
                gTotals.ret += ret;
                gTotals.per += per;
                gTotals.fov += fov;
                gTotals.cot += cot;
                gTotals.total += tot;

                currentY += 12;
            }

            if (currentProvider !== null) {
                printSubtotal();
            }

            if (currentY > 520) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Reporte de Compras (Detallado)', periodText, 'landscape', subtitle);
                currentY = doc.y + 10;
            }

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).stroke();
            currentY += 4;
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL GENERAL:', startX + colW.fecha + colW.tipoDoc, currentY, { width: colW.numero, align: 'right' });
            let gx = startX + colW.fecha + colW.tipoDoc + colW.numero + colW.condicion;
            doc.text(reportPdfHelper.fmt(gTotals.grav), gx, currentY, { width: colW.gravada, align: 'right' }); gx += colW.gravada;
            doc.text(reportPdfHelper.fmt(gTotals.exe), gx, currentY, { width: colW.exenta, align: 'right' }); gx += colW.exenta;
            doc.text(reportPdfHelper.fmt(gTotals.iva), gx, currentY, { width: colW.iva, align: 'right' }); gx += colW.iva;
            doc.text(reportPdfHelper.fmt(gTotals.ret), gx, currentY, { width: colW.ret, align: 'right' }); gx += colW.ret;
            doc.text(reportPdfHelper.fmt(gTotals.per), gx, currentY, { width: colW.per, align: 'right' }); gx += colW.per;
            doc.text(reportPdfHelper.fmt(gTotals.fov), gx, currentY, { width: colW.fov, align: 'right' }); gx += colW.fov;
            doc.text(reportPdfHelper.fmt(gTotals.cot), gx, currentY, { width: colW.cot, align: 'right' }); gx += colW.cot;
            doc.text(reportPdfHelper.fmt(gTotals.total), gx, currentY, { width: colW.total - 6, align: 'right' });
            currentY += 18;
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Compras');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);

    } catch (error) {
        console.error('Error al generar reporte de compras:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error interno al generar reporte' });
        }
    }
};

/**
 * Escanear factura/DTE físico o digital mediante IA y extraer datos
 */
const scanDteInvoice = async (req, res) => {
    try {
        if (!req.file && !req.body?.image) {
            return res.status(400).json({ message: 'No se recibió ninguna imagen o archivo para escanear.' });
        }

        let buffer;
        let mimeType = 'image/jpeg';

        if (req.file) {
            buffer = req.file.buffer;
            mimeType = req.file.mimetype;
        } else if (req.body.image) {
            const matches = req.body.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                buffer = Buffer.from(matches[2], 'base64');
            } else {
                buffer = Buffer.from(req.body.image, 'base64');
            }
        }

        const companyId = req.company_id || req.user?.company_id;

        // Llamar a servicio de IA
        const extracted = await aiService.extractDteFromImage(buffer, mimeType);

        // Buscar si existe un proveedor que coincida por NIT, NRC o nombre
        let matchedProvider = null;
        if (extracted.emisor && (extracted.emisor.nit || extracted.emisor.nrc || extracted.emisor.nombre)) {
            const cleanNit = (extracted.emisor.nit || '').replace(/[^0-9]/g, '');
            const cleanNrc = (extracted.emisor.nrc || '').replace(/[^0-9]/g, '');
            const searchName = (extracted.emisor.nombre || '').trim();

            let pQuery = `SELECT id, nombre, nit, nrc, dias_credito FROM providers WHERE company_id = ? AND (1=0`;
            const pParams = [companyId];

            if (cleanNit.length > 5) {
                pQuery += ` OR REPLACE(nit, '-', '') LIKE ?`;
                pParams.push(`%${cleanNit}%`);
            }
            if (cleanNrc.length > 2) {
                pQuery += ` OR REPLACE(nrc, '-', '') LIKE ?`;
                pParams.push(`%${cleanNrc}%`);
            }
            if (searchName.length > 3) {
                pQuery += ` OR nombre LIKE ?`;
                pParams.push(`%${searchName}%`);
            }
            pQuery += `) LIMIT 1`;

            const [pRows] = await pool.query(pQuery, pParams);
            if (pRows.length > 0) {
                matchedProvider = pRows[0];
            }
        }

        return res.json({
            success: true,
            data: {
                ...extracted,
                matchedProvider
            }
        });

    } catch (error) {
        console.error('Error al escanear DTE con IA:', error);
        return res.status(500).json({
            message: error.message || 'Error al procesar la imagen del DTE con IA'
        });
    }
};

module.exports = {
    getPurchases,
    getPurchaseById,
    createPurchase,
    voidPurchase,
    exportPurchasePDF,
    updatePurchase,
    getPurchaseReportPDF,
    scanDteInvoice
};
