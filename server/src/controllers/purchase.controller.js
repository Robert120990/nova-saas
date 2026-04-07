const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const { getEffectiveProductId } = require('../utils/inventoryUtils');

/**
 * Obtener lista de compras con búsqueda y paginación
 */
const getPurchases = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, branch_id } = req.query;
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

        if (search) {
            query += ` AND (ph.numero_documento LIKE ? OR p.nombre LIKE ? OR ph.observaciones LIKE ?) `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

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

        // 1. Insertar Cabecera
        const [headerResult] = await connection.query(`
            INSERT INTO purchase_headers 
            (company_id, branch_id, usuario_id, provider_id, fecha, numero_documento, 
             tipo_documento_id, condicion_operacion_id, observaciones,
             total_nosujeta, total_exenta, total_gravada, 
             iva, retencion, percepcion, fovial, cotrans, monto_total,
             documento_afectado, fecha_afectada,
             period_year, period_month)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            companyId, branch_id, usuarioId, provider_id, fecha || new Date(), numero_documento,
            tipo_documento_id, condicion_operacion_id, observaciones,
            total_nosujeta || 0, total_exenta || 0, total_gravada || 0,
            iva || 0, retencion || 0, percepcion || 0, fovial || 0, cotrans || 0, monto_total || 0,
            req.body.documento_afectado || null, req.body.fecha_afectada || null,
            period_year, period_month
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

        // 2. Actualizar Cabecera
        await connection.query(`
            UPDATE purchase_headers SET 
                branch_id = ?, provider_id = ?, fecha = ?, numero_documento = ?,
                tipo_documento_id = ?, condicion_operacion_id = ?, observaciones = ?,
                total_nosujeta = ?, total_exenta = ?, total_gravada = ?,
                iva = ?, retencion = ?, percepcion = ?, fovial = ?, cotrans = ?, monto_total = ?,
                documento_afectado = ?, fecha_afectada = ?,
                period_year = ?, period_month = ?
            WHERE id = ? AND company_id = ?
        `, [
            branch_id, provider_id, fecha, numero_documento,
            tipo_documento_id, condicion_operacion_id, observaciones,
            total_nosujeta || 0, total_exenta || 0, total_gravada || 0,
            iva || 0, retencion || 0, percepcion || 0, fovial || 0, cotrans || 0, monto_total || 0,
            req.body.documento_afectado || null, req.body.fecha_afectada || null,
            period_year, period_month,
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

            // Registrar Movimiento (usamos el ID efectivo)
            await connection.query(`
                INSERT INTO inventory_movements 
                (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, documento_id, tipo_documento)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'EDICION_COMPRA')
            `, [companyId, branch_id, effectiveProductId, newEsNC ? 'SALIDA' : 'ENTRADA', qty, price, id]);
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
            'SELECT * FROM purchase_headers WHERE id = ? AND company_id = ?',
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
        
        let fechaDoc = '---';
        try { if (p.fecha) fechaDoc = new Date(p.fecha).toLocaleDateString(); } catch (e) {}
        doc.text(`Fecha: ${fechaDoc}`, startX + 300, currentY + 45);

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
        const { start_date, end_date, branch_id, provider_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        // 1. Obtener datos de la empresa
        const [company] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const comp = company[0] || { razon_social: 'EMPRESA', nit: '---' };

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
            WHERE ph.company_id = ? AND ph.fecha BETWEEN ? AND ? AND ph.status != 'ANULADO'
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += " AND ph.branch_id = ?";
            params.push(branch_id);
        }

        if (provider_id && provider_id !== 'all') {
            sql += " AND ph.provider_id = ?";
            params.push(provider_id);
        }

        sql += " ORDER BY p.nombre ASC, ph.fecha ASC";

        const [rows] = await pool.query(sql, params);

        // 3. Generar PDF (LANDSCAPE)
        const doc = new PDFDocument({ margin: 30, size: 'LETTER', layout: 'landscape' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.send(result);
        });

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text(comp.razon_social.toUpperCase(), { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(`NIT: ${comp.nit}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DE COMPRAS (DETALLADO)', { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(`Periodo: ${start_date} al ${end_date}`, { align: 'center' });
        
        let branchName = 'Todas las sucursales';
        if (branch_id !== 'all' && rows.length > 0) branchName = rows[0].branch_nombre;
        doc.text(`Sucursal: ${branchName}`, { align: 'center' });
        doc.moveDown(1.5);

        // Table logic
        const startX = 30;
        let currentY = doc.y;

        const drawTableHeader = (y) => {
            doc.fontSize(7).font('Helvetica-Bold');
            doc.text('FECHA', startX, y);
            doc.text('TIPO DOC', startX + 45, y);
            doc.text('NÚMERO', startX + 150, y);
            doc.text('CONDICIÓN', startX + 220, y);
            doc.text('GRAVADA', startX + 275, y, { width: 55, align: 'right' });
            doc.text('EXENTA', startX + 335, y, { width: 55, align: 'right' });
            doc.text('IVA', startX + 395, y, { width: 45, align: 'right' });
            doc.text('RET.', startX + 445, y, { width: 40, align: 'right' });
            doc.text('PER.', startX + 490, y, { width: 40, align: 'right' });
            doc.text('FOV.', startX + 535, y, { width: 45, align: 'right' });
            doc.text('COT.', startX + 585, y, { width: 45, align: 'right' });
            doc.text('TOTAL', startX + 635, y, { width: 70, align: 'right' });
            doc.moveTo(startX, y + 10).lineTo(740, y + 10).stroke();
            return y + 15;
        };

        currentY = drawTableHeader(currentY);

        let currentProvider = null;
        let pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
        let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

        rows.forEach((row, index) => {
            // Check for page break
            if (currentY > 550) {
                doc.addPage();
                currentY = drawTableHeader(30);
            }

            // Grouping Header
            if (row.provider_nombre !== currentProvider) {
                if (currentProvider !== null) {
                    // Print subtotal
                    doc.fontSize(7).font('Helvetica-Bold');
                    doc.text('SUBTOTAL:', startX + 220, currentY, { width: 50, align: 'right' });
                    doc.text(`$${pTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
                    doc.text(`$${pTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                    doc.text(`$${pTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
                    doc.text(`$${pTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
                    doc.text(`$${pTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
                    doc.text(`$${pTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
                    doc.text(`$${pTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
                    doc.text(`$${pTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });
                    currentY += 15;
                    pTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
                }
                
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text(`PROVEEDOR: ${row.provider_nombre || 'S/N'}`, startX, currentY);
                doc.fillColor('black');
                currentY += 12;
                currentProvider = row.provider_nombre;
            }

            // Row Data
            doc.fontSize(7).font('Helvetica');
            const fechaVal = new Date(row.fecha).toLocaleDateString();
            doc.text(fechaVal, startX, currentY);
            doc.text(row.tipo_doc_nombre || '---', startX + 45, currentY, { width: 100, truncate: true });
            doc.text(row.numero_documento || '---', startX + 150, currentY, { width: 65 });
            doc.text(row.condicion_nombre || 'CONTADO', startX + 220, currentY, { width: 50 });
            doc.text(`$${parseFloat(row.total_gravada || 0).toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.total_exenta || 0).toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.iva || 0).toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.retencion || 0).toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.percepcion || 0).toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.fovial || 0).toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.cotrans || 0).toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.monto_total || 0).toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });

            // Sum pTotals
            pTotals.grav += parseFloat(row.total_gravada || 0);
            pTotals.exe += parseFloat(row.total_exenta || 0);
            pTotals.iva += parseFloat(row.iva || 0);
            pTotals.ret += parseFloat(row.retencion || 0);
            pTotals.per += parseFloat(row.percepcion || 0);
            pTotals.fov += parseFloat(row.fovial || 0);
            pTotals.cot += parseFloat(row.cotrans || 0);
            pTotals.total += parseFloat(row.monto_total || 0);

            // Sum gTotals
            gTotals.grav += parseFloat(row.total_gravada || 0);
            gTotals.exe += parseFloat(row.total_exenta || 0);
            gTotals.iva += parseFloat(row.iva || 0);
            gTotals.ret += parseFloat(row.retencion || 0);
            gTotals.per += parseFloat(row.percepcion || 0);
            gTotals.fov += parseFloat(row.fovial || 0);
            gTotals.cot += parseFloat(row.cotrans || 0);
            gTotals.total += parseFloat(row.monto_total || 0);

            currentY += 12;

            // Last subtotal
            if (index === rows.length - 1) {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('SUBTOTAL:', startX + 220, currentY, { width: 50, align: 'right' });
                doc.text(`$${pTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
                doc.text(`$${pTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                doc.text(`$${pTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
                doc.text(`$${pTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
                doc.text(`$${pTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
                doc.text(`$${pTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
                doc.text(`$${pTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
                doc.text(`$${pTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });
                currentY += 20;
            }
        });

        // Grand Total Section
        doc.moveTo(startX, currentY).lineTo(740, currentY).stroke();
        currentY += 10;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('TOTAL GENERAL:', startX + 115, currentY, { width: 155, align: 'right' });
        doc.text(`$${gTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
        doc.text(`$${gTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
        doc.text(`$${gTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
        doc.text(`$${gTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
        doc.text(`$${gTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });

        doc.end();

    } catch (error) {
        console.error('Error al generar reporte de compras:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error interno al generar reporte' });
        }
    }
};

module.exports = {
    getPurchases,
    getPurchaseById,
    createPurchase,
    voidPurchase,
    exportPurchasePDF,
    updatePurchase,
    getPurchaseReportPDF
};
