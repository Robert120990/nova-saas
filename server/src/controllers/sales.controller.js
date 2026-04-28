const mailerService = require('../services/mailer.service');
const pool = require('../config/db');
const dteService = require('../services/dte.service');
const pdfService = require('../services/pdf.service');
const path = require('path');
const fs = require('fs');
const { getEffectiveProductId } = require('../utils/inventoryUtils');

/**
 * Procesa una nueva venta junto con sus ítems, pagos y documentos vinculados.
 * Maneja la reducción de inventario y el registro en el Kardex.
 */
const createSale = async (req, res) => {
    // ... (rest of the code till items loop)
    const { 
        header, 
        items, 
        payments, 
        linkedDocuments 
    } = req.body;

    if (!header || !items || items.length === 0) {
        return res.status(400).json({ message: 'Datos de venta incompletos (cabecera o ítems faltantes)' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 0. Verificar configuración DTE de la empresa
        const [companies] = await connection.query(`
            SELECT c.*, cat.description as actividad_economica 
            FROM companies c
            LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
            WHERE c.id = ?
        `, [req.company_id]);
        const company = companies[0];

        // Obtener código de terminal si existe pos_id
        let codPuntoVentaMH = null;
        if (header.pos_id) {
            const [pos] = await connection.query('SELECT codigo FROM points_of_sale WHERE id = ?', [header.pos_id]);
            if (pos.length > 0) codPuntoVentaMH = pos[0].codigo;
        }

        let dteInfo = {};
        let dteResult = null;
        if (company && company.dte_active) {
            // Enriquecer el payload con datos de catálogo y terminal
            const dtePayload = {
                ...req.body,
                emisor_adicional: {
                    descActividad: company.actividad_economica,
                    codPuntoVentaMH: codPuntoVentaMH
                }
            };

            // Asegurar que el branch_id y user_id lleguen al dte-api si no vienen en el header
            if (!header.branch_id) header.branch_id = req.user.branch_id;
            if (!header.user_id) header.user_id = req.user.id;

            dteResult = await dteService.emitDTE(company, dtePayload);
            if (dteResult.success) {
                dteInfo = dteResult.data;
            } else if (!dteResult.skip) {
                // Si el DTE falló pero tenemos un código de generación, significa que se registró el rechazo.
                // No abortamos la venta, la guardamos vinculada al código generado para permitir reintentos.
                if (dteResult.codigo_generacion) {
                    // Metadatos para sales_headers (solo columnas existentes)
                    dteInfo = { 
                        codigo_generacion: dteResult.codigo_generacion,
                        numero_control: dteResult.numero_control,
                        sello_recepcion: dteResult.data?.sello_recepcion || null,
                        fh_procesamiento: dteResult.data?.fh_procesamiento || null
                    };
                    console.warn(`[SalesController] Venta persistida con DTE Rechazado: ${dteResult.codigo_generacion}`);
                } else {
                    // Si no hay código de generación, fue un error crítico antes de crear el DTE
                    console.error('[SalesController] DTE Schema Error Details:', JSON.stringify(dteResult.details, null, 2));
                    throw new Error('Error crítico en DTE: ' + (dteResult.error || 'Error desconocido'));
                }
            }
        }

        // 1. Insertar Cabecera de Venta
        const [saleResult] = await connection.query('INSERT INTO sales_headers SET ?', [{
            company_id: req.company_id,
            branch_id: req.user.branch_id,
            customer_id: header.customer_id,
            seller_id: header.seller_id,
            pos_id: header.pos_id,
            shift_id: header.shift_id || null,
            dte_type: header.dte_type,
            tipo_documento: header.tipo_documento || header.dte_type,
            condicion_operacion: header.condicion_operacion || 1,
            fecha_emision: new Date(),
            hora_emision: new Date().toTimeString().split(' ')[0],
            estado: 'emitido',
            total_gravado: header.total_gravado || 0,
            total_exento: header.total_exento || 0,
            total_nosujetas: header.total_nosujetas || header.total_nosujeto || 0,
            fovial: header.fovial || header.total_fovial || 0,
            cotrans: header.cotrans || header.total_cotrans || 0,
            total_iva: header.total_iva || 0,
            descuento_general: header.descuento_general || header.total_descuento || 0,
            iva_percibido: header.total_percepcion || header.iva_percibido || 0,
            iva_retenido: header.total_retencion || header.iva_retenido || 0,
            total_pagar: header.total_pagar || 0,
            payment_condition: header.payment_condition || 1,
            observaciones: header.observaciones || null,
            // Campos de Exportación (FEX - 11)
            export_item_type: header.export_item_type || null,
            fiscal_enclosure: header.fiscal_enclosure || null,
            export_regime: header.export_regime || null,
            dest_country_code: header.dest_country_code || null,
            // Campos de Remisión (NR - 04)
            remission_type: header.remission_type || null,
            transporter_name: header.transporter_name || null,
            vehicle_plate: header.vehicle_plate || null,
            cliente_nombre: header.cliente_nombre || null,
            ...dteInfo, // Fusionar metadatos de DTE (codigo_generacion, sello_recepcion, etc.)
            created_at: new Date()
        }]);
        const saleId = saleResult.insertId;

        // 2. Procesar Ítems
        for (const item of items) {
            await connection.query('INSERT INTO sales_items SET ?', [{
                sale_id: saleId,
                product_id: item.product_id || null,
                codigo: item.codigo || null,
                combo_id: item.combo_id || null,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                monto_descuento: item.monto_descuento || 0,
                venta_gravada: item.venta_gravada || 0,
                venta_exenta: item.venta_exenta || 0,
                tributos: JSON.stringify(item.tributos || [])
            }]);

            // Si es un COMBO, reducir stock de sus componentes
            if (item.combo_id) {
                const [comboItems] = await connection.query(
                    'SELECT product_id, quantity FROM product_combo_items WHERE combo_id = ?', 
                    [item.combo_id]
                );

                for (const ci of comboItems) {
                    const totalQty = ci.quantity * item.cantidad;
                    // Resolver ID efectivo para inventario
                    const effectiveProductId = await getEffectiveProductId(connection, ci.product_id);
                    
                    if (header.dte_type !== '04') {
                        // Actualizar Stock de los componentes
                        await connection.query(
                            'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                            [totalQty, effectiveProductId, req.user.branch_id]
                        );

                        // Registrar Movimiento en Kardex para cada componente
                        await connection.query('INSERT INTO inventory_movements SET ?', [{
                            company_id: req.company_id,
                            branch_id: req.user.branch_id,
                            product_id: effectiveProductId,
                            tipo_movimiento: 'SALIDA',
                            cantidad: totalQty,
                            tipo_documento: `DTE-${header.dte_type || '01'} (COMBO)`,
                            documento_id: saleId,
                            created_at: new Date()
                        }]);
                    }
                }
            } else if (item.product_id) {
                // Producto normal
                // Resolver ID efectivo para inventario
                const effectiveProductId = await getEffectiveProductId(connection, item.product_id);
                
                if (header.dte_type !== '04') {
                    // Actualizar Stock
                    await connection.query(
                        'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                        [item.cantidad, effectiveProductId, req.user.branch_id]
                    );

                    // Registrar Movimiento en Kardex
                    await connection.query('INSERT INTO inventory_movements SET ?', [{
                        company_id: req.company_id,
                        branch_id: req.user.branch_id,
                        product_id: effectiveProductId,
                        tipo_movimiento: 'SALIDA',
                        cantidad: item.cantidad,
                        tipo_documento: `DTE-${header.dte_type || '01'}`,
                        documento_id: saleId,
                        created_at: new Date()
                    }]);
                }
            }
        }

        // 3. Procesar Pagos
        if (payments && payments.length > 0) {
            for (const pay of payments) {
                await connection.query('INSERT INTO sales_payments SET ?', [{
                    sale_id: saleId,
                    metodo_pago: pay.codigo || '01',
                    monto: pay.monto,
                    referencia: pay.referencia || null
                }]);
            }
        }

        // 4. Documentos Vinculados (Para Notas de Crédito / Remisiones)
        if (linkedDocuments && linkedDocuments.length > 0) {
            for (const doc of linkedDocuments) {
                await connection.query('INSERT INTO sales_linked_documents SET ?', [{
                    ...doc,
                    sale_id: saleId
                }]);
            }
        }

        await connection.commit();

        // 5. Vincular venta_id en la tabla dtes y enviar correo de notificación (Solo si fue exitoso)
        if (dteInfo.codigo_generacion) {
            const isSuccessful = dteResult && dteResult.success;
            (async () => {
                try {
                    // 1. Vincular venta_id
                    await pool.query(
                        'UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?',
                        [saleId, dteInfo.codigo_generacion, req.company_id]
                    );
                    
                    // 2. Enviar correo SOLO si fue aceptado por Hacienda
                    if (isSuccessful) {
                        await mailerService.sendDTEEmail(saleId, req.company_id);
                    } else {
                        console.log(`[PostSaleProcess] Venta ${saleId}: DTE rechazado/pendiente, se omite envío de correo al cliente.`);
                    }
                } catch (err) {
                    console.error(`[PostSaleProcess] Error en proceso posterior de venta ${saleId}:`, err.message);
                }
            })();
        }

        res.status(201).json({ 
            id: saleId, 
            message: 'Venta procesada exitosamente',
            success: true 
        });

    } catch (error) {
        await connection.rollback();
        console.error('CRITICAL ERROR in createSale:', error);
        res.status(500).json({ 
            message: 'Error al procesar la venta', 
            error: error.message,
            stack: error.stack,
            success: false 
        });
    } finally {
        connection.release();
    }
};

/**
 * Obtiene el historial de ventas paginado.
 */
const getSales = async (req, res) => {
    const { page = 1, limit = 10, dte_type, start_date, end_date, search = '', customer_id, status, only_processed, exclude_has_nc } = req.query;
    const offset = (page - 1) * limit;

    try {
        let sql = `
            SELECT h.*, s.nombre as seller_name, p.nombre as pos_name, b.nombre as branch_name, c.correo as customer_email,
            c.nit as customer_nit, c.nrc as customer_nrc,
            COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as customer_name,
            d.status as dte_status, d.numero_control as dte_control, d.respuesta_hacienda, d.respuesta_hacienda as dte_error,
            CASE h.tipo_documento 
                WHEN '01' THEN 'Factura'
                WHEN '03' THEN 'Crédito Fiscal'
                WHEN '04' THEN 'Nota de Remisión'
                WHEN '05' THEN 'Nota de Crédito'
                WHEN '11' THEN 'Factura de Exportación'
                ELSE h.tipo_documento 
            END as tipo_documento_name
            FROM sales_headers h
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN branches b ON h.branch_id = b.id
            LEFT JOIN dtes d ON (h.id = d.venta_id OR (h.codigo_generacion IS NOT NULL AND h.codigo_generacion = d.codigo_generacion)) AND h.company_id = d.company_id
            WHERE h.company_id = ?
        `;
        const params = [req.company_id];

        if (req.user.branch_id) {
            sql += ' AND h.branch_id = ?';
            params.push(req.user.branch_id);
        }

        if (search) {
            sql += ' AND (c.nombre LIKE ? OR h.cliente_nombre LIKE ? OR h.numero_control LIKE ? OR h.codigo_generacion LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (dte_type) {
            sql += ' AND h.dte_type = ?';
            params.push(dte_type);
        }
        if (start_date && end_date) {
            sql += ' AND h.created_at BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        if (customer_id) {
            sql += ' AND h.customer_id = ?';
            params.push(customer_id);
        }

        if (status) {
            sql += ' AND h.estado = ?';
            params.push(status);
        }

        if (only_processed === 'true') {
            sql += " AND d.status = 'ACCEPTED'";
        }

        if (exclude_has_nc === 'true') {
            sql += ` AND NOT EXISTS (
                SELECT 1 FROM sales_linked_documents ld 
                JOIN sales_headers h2 ON ld.sale_id = h2.id 
                WHERE h2.tipo_documento = '05' AND h2.estado = 'emitido'
                AND (
                    (ld.doc_number = h.codigo_generacion COLLATE utf8mb4_unicode_ci AND h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '') OR 
                    (ld.doc_number = h.numero_control COLLATE utf8mb4_unicode_ci AND h.numero_control IS NOT NULL AND h.numero_control != '') OR 
                    (ld.doc_number = d.numero_control COLLATE utf8mb4_unicode_ci AND d.numero_control IS NOT NULL AND d.numero_control != '') OR
                    (ld.doc_number = CAST(h.id AS CHAR) COLLATE utf8mb4_unicode_ci)
                )
            )`;
        }

        let countSql = `SELECT COUNT(*) as total FROM sales_headers h LEFT JOIN customers c ON h.customer_id = c.id WHERE h.company_id = ?`;
        const countParams = [req.company_id];
        
        if (req.user.branch_id) {
            countSql += ' AND h.branch_id = ?';
            countParams.push(req.user.branch_id);
        }
        if (search) {
            countSql += ' AND (c.nombre LIKE ? OR h.cliente_nombre LIKE ? OR h.numero_control LIKE ? OR h.codigo_generacion LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (dte_type) {
            countSql += ' AND h.dte_type = ?';
            countParams.push(dte_type);
        }

        if (customer_id) {
            countSql += ' AND h.customer_id = ?';
            countParams.push(customer_id);
        }

        if (status) {
            countSql += ' AND h.estado = ?';
            countParams.push(status);
        }

        if (only_processed === 'true') {
            countSql += " AND EXISTS (SELECT 1 FROM dtes d2 WHERE (h.id = d2.venta_id OR (h.codigo_generacion IS NOT NULL AND h.codigo_generacion = d2.codigo_generacion)) AND d2.status = 'ACCEPTED')";
        }

        if (exclude_has_nc === 'true') {
            countSql += ` AND NOT EXISTS (
                SELECT 1 FROM sales_linked_documents ld 
                JOIN sales_headers h2 ON ld.sale_id = h2.id 
                WHERE h2.tipo_documento = '05' AND h2.estado = 'emitido'
                AND (
                    (ld.doc_number = h.codigo_generacion COLLATE utf8mb4_unicode_ci AND h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '') OR 
                    (ld.doc_number = h.numero_control COLLATE utf8mb4_unicode_ci AND h.numero_control IS NOT NULL AND h.numero_control != '') OR
                    (ld.doc_number = CAST(h.id AS CHAR) COLLATE utf8mb4_unicode_ci)
                )
            )`;
        }

        sql += ' ORDER BY h.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(sql, params);
        const [totalRows] = await pool.query(countSql, countParams);

        const totalItems = totalRows[0].total;

        res.json({
            data: rows,
            totalItems: totalItems,
            totalPages: Math.ceil(totalItems / limit)
        });
    } catch (error) {
        console.error('Error in getSales:', error);
        res.status(500).json({ message: 'Error al obtener historial de ventas', error: error.message });
    }
};

/**
 * Obtiene el detalle de una venta específica.
 */
const getSaleById = async (req, res) => {
    const { id } = req.params;
    try {
        const [header] = await pool.query(`
            SELECT h.*, s.nombre as seller_name, b.nombre as branch_name,
            COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as customer_name, 
            c.direccion as customer_address, c.nit as customer_nit, c.nrc as customer_nrc, c.numero_documento as customer_dui,
            d.status as dte_status, d.respuesta_hacienda, d.respuesta_hacienda as dte_error, d.json_original, d.sello_recepcion, d.fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN branches b ON h.branch_id = b.id
            LEFT JOIN dtes d ON (h.id = d.venta_id OR (h.codigo_generacion IS NOT NULL AND h.codigo_generacion = d.codigo_generacion)) AND h.company_id = d.company_id
            WHERE h.id = ? AND h.company_id = ?
        `, [id, req.company_id]);

        if (header.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const sale = header[0];
        
        // Procesar JSON si vienen como strings (MySQL LONGTEXT)
        if (typeof sale.json_original === 'string') {
            try { sale.json_original = JSON.parse(sale.json_original); } catch (e) {}
        }
        if (typeof sale.respuesta_hacienda === 'string') {
            try { sale.respuesta_hacienda = JSON.parse(sale.respuesta_hacienda); } catch (e) {}
        }

        const [items] = await pool.query('SELECT * FROM sales_items WHERE sale_id = ?', [id]);
        const [payments] = await pool.query('SELECT * FROM sales_payments WHERE sale_id = ?', [id]);
        const [linkedDocs] = await pool.query('SELECT * FROM sales_linked_documents WHERE sale_id = ?', [id]);

        res.json({
            ...sale,
            items,
            payments,
            linkedDocuments: linkedDocs
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener detalle de venta', error: error.message });
    }
};

/**
 * Obtiene el reporte de ventas agrupado por categoría de producto.
 */
/**
 * Obtiene el reporte de ventas por categoría con métricas de rendimiento y participación.
 */
const getSalesByCategory = async (req, res) => {
    const { start_date, end_date, branch_id, detailed } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        // 1. Obtener el total general de ventas del período para calcular porcentajes
        let totalSalesSql = `
            SELECT SUM(si.cantidad * si.precio_unitario) as total_periodo
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const totalParams = [companyId];
        
        if (start_date && end_date) {
            totalSalesSql += ' AND h.fecha_emision BETWEEN ? AND ?';
            totalParams.push(start_date, end_date);
        }
        if (branch_id && branch_id !== 'all') {
            totalSalesSql += ' AND h.branch_id = ?';
            totalParams.push(branch_id);
        }
        
        const [totalResult] = await pool.query(totalSalesSql, totalParams);
        const grandTotalSales = parseFloat(totalResult[0]?.total_periodo || 0);

        // 2. Consulta de categorías
        let sql = `
            SELECT 
                COALESCE(c.id, 0) as category_id,
                COALESCE(c.name, 'Sin Categoría') as categoria,
                SUM(si.cantidad) as total_unidades,
                SUM(si.cantidad * si.precio_unitario) as total_venta,
                SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento, -- Usando costo real de la tabla products
                (SUM(si.cantidad * si.precio_unitario) / NULLIF(?, 0)) * 100 as porcentaje_ventas
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const params = [grandTotalSales, companyId];

        if (start_date && end_date) {
            sql += ' AND h.fecha_emision BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' GROUP BY COALESCE(c.id, 0), COALESCE(c.name, "Sin Categoría") ORDER BY total_venta DESC';

        const [categories] = await pool.query(sql, params);

        // 3. Si es detallado, obtener items por cada categoría
        if (detailed === 'true') {
            let detailSql = `
                SELECT 
                    COALESCE(c.id, 0) as category_id,
                    p.descripcion as producto,
                    SUM(si.cantidad) as unidades,
                    SUM(si.cantidad * si.precio_unitario) as monto,
                    SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento
                FROM sales_headers h
                JOIN sales_items si ON h.id = si.sale_id
                LEFT JOIN products p ON si.product_id = p.id
                LEFT JOIN product_categories c ON p.category_id = c.id
                WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            `;
            const detailParams = [companyId];
            
            if (start_date && end_date) {
                detailSql += ' AND h.fecha_emision BETWEEN ? AND ?';
                detailParams.push(start_date, end_date);
            }
            if (branch_id && branch_id !== 'all') {
                detailSql += ' AND h.branch_id = ?';
                detailParams.push(branch_id);
            }

            detailSql += ' GROUP BY COALESCE(c.id, 0), p.id, p.descripcion ORDER BY category_id, monto DESC';
            const [products] = await pool.query(detailSql, detailParams);

            // Mapear productos a sus categorías
            const mappedCategories = categories.map(cat => ({
                ...cat,
                productos: products.filter(p => p.category_id === cat.category_id)
            }));
            return res.json(mappedCategories);
        }

        res.json(categories);
    } catch (error) {
        console.error('Error in getSalesByCategory:', error);
        res.status(500).json({ message: 'Error al generar reporte por categoría', error: error.message });
    }
};

/**
 * Exporta el reporte de ventas por categoría a PDF (Resumen o Detallado).
 */
const exportSalesByCategoryPDF = async (req, res) => {
    const { start_date, end_date, branch_id, detailed } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No sesion' });

        // Re-utilizamos la lógica de obtención de datos para asegurar consistencia
        // (En una app real, esto podría estar en un service para evitar redundancia)
        
        // 1. Info de Empresa
        const [companyRows] = await pool.query('SELECT razon_social, logo_url FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa' };

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 2. Obtener datos (Total periodo)
        let totalSalesSql = `SELECT SUM(si.cantidad * si.precio_unitario) as total_periodo FROM sales_headers h JOIN sales_items si ON h.id = si.sale_id WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'`;
        const totalParams = [companyId];
        if (start_date && end_date) { totalSalesSql += ' AND h.fecha_emision BETWEEN ? AND ?'; totalParams.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { totalSalesSql += ' AND h.branch_id = ?'; totalParams.push(branch_id); }
        const [totalResult] = await pool.query(totalSalesSql, totalParams);
        const grandTotal = parseFloat(totalResult[0]?.total_periodo || 0);

        // 3. Query Categorías
        let sql = `
            SELECT 
                COALESCE(c.id, 0) as category_id,
                COALESCE(c.name, 'Sin Categoría') as categoria,
                SUM(si.cantidad) as total_unidades,
                SUM(si.cantidad * si.precio_unitario) as total_venta,
                SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento,
                (SUM(si.cantidad * si.precio_unitario) / NULLIF(?, 0)) * 100 as porcentaje_ventas
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN product_categories c ON p.category_id = c.id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const params = [grandTotal, companyId];
        if (start_date && end_date) { sql += ' AND h.fecha_emision BETWEEN ? AND ?'; params.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { sql += ' AND h.branch_id = ?'; params.push(branch_id); }
        sql += ' GROUP BY COALESCE(c.id, 0), COALESCE(c.name, "Sin Categoría") ORDER BY total_venta DESC';

        const [categories] = await pool.query(sql, params);

        let reportData = {
            company: companyInfo,
            branch: branchName,
            period: `${start_date} al ${end_date}`,
            grand_total: grandTotal,
            isDetailed: detailed === 'true',
            categories: categories
        };

        if (detailed === 'true') {
            let detailSql = `
                SELECT 
                    COALESCE(c.id, 0) as category_id,
                    p.descripcion as producto,
                    SUM(si.cantidad) as unidades,
                    SUM(si.cantidad * si.precio_unitario) as monto,
                    SUM(si.cantidad * si.precio_unitario) - SUM(si.cantidad * COALESCE(p.costo, 0)) as rendimiento
                FROM sales_headers h
                JOIN sales_items si ON h.id = si.sale_id
                LEFT JOIN products p ON si.product_id = p.id
                LEFT JOIN product_categories c ON p.category_id = c.id
                WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            `;
            const dParams = [companyId];
            if (start_date && end_date) { detailSql += ' AND h.fecha_emision BETWEEN ? AND ?'; dParams.push(start_date, end_date); }
            if (branch_id && branch_id !== 'all') { detailSql += ' AND h.branch_id = ?'; dParams.push(branch_id); }
            detailSql += ' GROUP BY COALESCE(c.id, 0), p.id, p.descripcion ORDER BY category_id, monto DESC';
            const [products] = await pool.query(detailSql, dParams);
            
            reportData.categories = categories.map(cat => ({
                ...cat,
                productos: products.filter(p => p.category_id === cat.category_id)
            }));
        }

        const pdfBuffer = await pdfService.generateSalesByCategoryPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Ventas_Categoria_${start_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportSalesByCategoryPDF:', error);
        res.status(500).json({ message: 'Error al exportar reporte' });
    }
};

/**
 * Obtiene el reporte de ventas diarias detallado.
 */
const getDailySales = async (req, res) => {
    const { start_date, end_date, branch_id } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        let sql = `
            SELECT 
                h.fecha_emision as fecha,
                CASE h.tipo_documento 
                    WHEN '01' THEN 'Factura'
                    WHEN '03' THEN 'Crédito Fiscal'
                    WHEN '04' THEN 'Nota de Remisión'
                    WHEN '05' THEN 'Nota de Crédito'
                    WHEN '06' THEN 'Nota de Débito'
                    WHEN '11' THEN 'Factura de Exportación'
                    ELSE h.tipo_documento 
                END as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                CASE h.condicion_operacion 
                    WHEN 1 THEN 'Contado'
                    WHEN 2 THEN 'Crédito'
                    ELSE 'Contado'
                END as condicion,
                COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as cliente,
                h.total_gravado as gravadas,
                h.total_exento as exentas,
                h.total_iva as iva,
                h.fovial,
                h.cotrans,
                h.iva_retenido as retencion,
                h.iva_percibido as percepcion,
                h.total_pagar as total
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const params = [companyId];

        if (start_date && end_date) {
            sql += ' AND h.fecha_emision BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        } else if (req.user.branch_id && !branch_id) {
            sql += ' AND h.branch_id = ?';
            params.push(req.user.branch_id);
        }

        sql += ' ORDER BY h.fecha_emision ASC, h.created_at ASC';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getDailySales:', error);
        res.status(500).json({ message: 'Error al generar reporte de ventas diarias', error: error.message });
    }
};

/**
 * Exporta el reporte de ventas diarias en formato PDF.
 */
const exportDailySalesPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) {
            return res.status(401).json({ message: 'No se pudo identificar la empresa' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        // 1. Info de Empresa y Sucursal
        const [companyRows] = await pool.query('SELECT razon_social as nombre FROM companies WHERE id = ?', [companyId]);
        const companyName = companyRows.length > 0 ? companyRows[0].nombre : 'Empresa';

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 2. Consulta de Datos
        let sql = `
            SELECT 
                h.fecha_emision as fecha,
                CASE h.tipo_documento 
                    WHEN '01' THEN 'Factura'
                    WHEN '03' THEN 'Crédito Fiscal'
                    WHEN '04' THEN 'Nota de Remisión'
                    WHEN '05' THEN 'Nota de Crédito'
                    WHEN '06' THEN 'Nota de Débito'
                    WHEN '11' THEN 'Factura de Exportación'
                    ELSE h.tipo_documento 
                END as tipo,
                COALESCE(d.numero_control, CONCAT('VTA-', h.id)) as documento,
                CASE h.condicion_operacion 
                    WHEN 1 THEN 'Contado'
                    WHEN 2 THEN 'Crédito'
                    ELSE 'Contado'
                END as condicion,
                COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as cliente,
                h.total_gravado as gravadas,
                h.total_exento as exentas,
                h.total_iva as iva,
                h.fovial,
                h.cotrans,
                h.iva_retenido as retencion,
                h.iva_percibido as percepcion,
                h.total_pagar as total
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const params = [companyId];

        // Filtramos por fecha_emision que es la fecha contable
        sql += ' AND h.fecha_emision BETWEEN ? AND ?';
        params.push(start_date, end_date);

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' ORDER BY h.fecha_emision ASC, h.id ASC';

        const [rows] = await pool.query(sql, params);

        // 3. Totales
        const totals = rows.reduce((acc, curr) => {
            acc.gravadas += parseFloat(curr.gravadas || 0);
            acc.exentas += parseFloat(curr.exentas || 0);
            acc.iva += parseFloat(curr.iva || 0);
            acc.fovial += parseFloat(curr.fovial || 0);
            acc.cotrans += parseFloat(curr.cotrans || 0);
            acc.retencion += parseFloat(curr.retencion || 0);
            acc.percepcion += parseFloat(curr.percepcion || 0);
            acc.total += parseFloat(curr.total || 0);
            return acc;
        }, { gravadas: 0, exentas: 0, iva: 0, fovial: 0, cotrans: 0, retencion: 0, percepcion: 0, total: 0 });

        // 4. Generar PDF
        const reportData = {
            company_name: companyName,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            sales: rows,
            total_gravadas: totals.gravadas,
            total_exentas: totals.exentas,
            total_iva: totals.iva,
            total_fovial: totals.fovial,
            total_cotrans: totals.cotrans,
            total_retencion: totals.retencion,
            total_percepcion: totals.percepcion,
            total_general: totals.total
        };

        const pdfBuffer = await pdfService.generateDailySalesReportPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-ventas-diarias.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportDailySalesPDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de ventas diarias', error: error.message });
    }
};

/**
 * Generar Reporte de Ventas en PDF (Landscape)
 */
const getSalesReportPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, customer_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        // 1. Obtener datos de la empresa
        const [company] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const comp = company[0] || { razon_social: 'EMPRESA', nit: '---' };

        // 2. Construir Query de Ventas
        let sql = `
            SELECT h.*, 
                   COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') AS customer_name, 
                   br.nombre AS branch_nombre,
                   CASE h.tipo_documento 
                        WHEN '01' THEN 'Factura'
                        WHEN '03' THEN 'Crédito Fiscal'
                        WHEN '04' THEN 'Nota de Remisión'
                        WHEN '05' THEN 'Nota de Crédito'
                        WHEN '06' THEN 'Nota de Débito'
                        WHEN '11' THEN 'Factura de Exportación'
                        ELSE h.tipo_documento 
                   END AS tipo_doc_nombre,
                   CASE h.condicion_operacion 
                        WHEN 1 THEN 'Contado'
                        WHEN 2 THEN 'Crédito'
                        ELSE 'Contado'
                   END AS condicion_nombre
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN branches br ON h.branch_id = br.id
            WHERE h.company_id = ? AND h.fecha_emision BETWEEN ? AND ? AND h.estado != 'ANULADO' AND h.estado != 'anulado'
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += " AND h.branch_id = ?";
            params.push(branch_id);
        }

        if (customer_id && customer_id !== 'all') {
            sql += " AND h.customer_id = ?";
            params.push(customer_id);
        }

        sql += " ORDER BY customer_name ASC, h.fecha_emision ASC, h.id ASC";

        const [rows] = await pool.query(sql, params);

        const PDFDocument = require('pdfkit');
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
        doc.fontSize(12).font('Helvetica-Bold').text('REPORTE DE VENTAS (DETALLADO)', { align: 'center' });
        doc.fontSize(9).font('Helvetica').text(`Periodo: ${start_date} al ${end_date}`, { align: 'center' });
        
        let branchName = 'Todas las sucursales';
        if (branch_id !== 'all' && rows.length > 0) branchName = rows[0].branch_nombre;
        doc.text(`Sucursal: ${branchName}`, { align: 'center' });
        doc.moveDown(1.5);

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

        let currentCustomer = null;
        let cTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
        let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

        rows.forEach((row, index) => {
            if (currentY > 550) {
                doc.addPage();
                currentY = drawTableHeader(30);
            }

            // Grouping Header
            if (row.customer_name !== currentCustomer) {
                if (currentCustomer !== null) {
                    doc.fontSize(7).font('Helvetica-Bold');
                    doc.text('SUBTOTAL:', startX + 220, currentY, { width: 50, align: 'right' });
                    doc.text(`$${cTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
                    doc.text(`$${cTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                    doc.text(`$${cTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
                    doc.text(`$${cTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
                    doc.text(`$${cTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
                    doc.text(`$${cTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
                    doc.text(`$${cTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
                    doc.text(`$${cTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });
                    currentY += 15;
                    cTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
                }
                
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text(`CLIENTE: ${row.customer_name}`, startX, currentY);
                doc.fillColor('black');
                currentY += 12;
                currentCustomer = row.customer_name;
            }

            // Row Data
            doc.fontSize(7).font('Helvetica');
            const fechaVal = new Date(row.fecha_emision).toLocaleDateString();
            doc.text(fechaVal, startX, currentY);
            doc.text(row.tipo_doc_nombre || '---', startX + 45, currentY, { width: 100, truncate: true });
            doc.text(row.numero_control || `VTA-${row.id}`, startX + 150, currentY, { width: 65 });
            doc.text(row.condicion_nombre || 'CONTADO', startX + 220, currentY, { width: 50 });
            doc.text(`$${parseFloat(row.total_gravado || 0).toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.total_exento || 0).toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.total_iva || 0).toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.iva_retenido || 0).toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.iva_percibido || 0).toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.fovial || 0).toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.cotrans || 0).toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.total_pagar || 0).toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });

            // Sum cTotals
            cTotals.grav += parseFloat(row.total_gravado || 0);
            cTotals.exe += parseFloat(row.total_exento || 0);
            cTotals.iva += parseFloat(row.total_iva || 0);
            cTotals.ret += parseFloat(row.iva_retenido || 0);
            cTotals.per += parseFloat(row.iva_percibido || 0);
            cTotals.fov += parseFloat(row.fovial || 0);
            cTotals.cot += parseFloat(row.cotrans || 0);
            cTotals.total += parseFloat(row.total_pagar || 0);

            // Sum gTotals
            gTotals.grav += parseFloat(row.total_gravado || 0);
            gTotals.exe += parseFloat(row.total_exento || 0);
            gTotals.iva += parseFloat(row.total_iva || 0);
            gTotals.ret += parseFloat(row.iva_retenido || 0);
            gTotals.per += parseFloat(row.iva_percibido || 0);
            gTotals.fov += parseFloat(row.fovial || 0);
            gTotals.cot += parseFloat(row.cotrans || 0);
            gTotals.total += parseFloat(row.total_pagar || 0);

            currentY += 12;

            if (index === rows.length - 1) {
                doc.fontSize(7).font('Helvetica-Bold');
                doc.text('SUBTOTAL:', startX + 220, currentY, { width: 50, align: 'right' });
                doc.text(`$${cTotals.grav.toFixed(2)}`, startX + 275, currentY, { width: 55, align: 'right' });
                doc.text(`$${cTotals.exe.toFixed(2)}`, startX + 335, currentY, { width: 55, align: 'right' });
                doc.text(`$${cTotals.iva.toFixed(2)}`, startX + 395, currentY, { width: 45, align: 'right' });
                doc.text(`$${cTotals.ret.toFixed(2)}`, startX + 445, currentY, { width: 40, align: 'right' });
                doc.text(`$${cTotals.per.toFixed(2)}`, startX + 490, currentY, { width: 40, align: 'right' });
                doc.text(`$${cTotals.fov.toFixed(2)}`, startX + 535, currentY, { width: 45, align: 'right' });
                doc.text(`$${cTotals.cot.toFixed(2)}`, startX + 585, currentY, { width: 45, align: 'right' });
                doc.text(`$${cTotals.total.toFixed(2)}`, startX + 635, currentY, { width: 70, align: 'right' });
                currentY += 20;
            }
        });

        // Grand Total
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
        console.error('Error al generar reporte de ventas:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error interno al generar reporte' });
        }
    }
};

/**
 * Obtiene el detalle de ventas por POS (listado detallado).
 */
const getSalesByPOS = async (req, res) => {
    const { start_date, end_date, branch_id } = req.query;
    const companyId = req.company_id || req.user?.company_id;

    try {
        let sql = `
            SELECT 
                h.id,
                h.fecha_emision,
                h.tipo_documento,
                h.condicion_operacion,
                COALESCE(c.nombre, h.cliente_nombre) as cliente_nombre,
                COALESCE(c.nit, '') as cliente_nit,
                COALESCE(c.nrc, '') as cliente_nrc,
                COALESCE(s.nombre, 'Vendedor Genérico') as vendedor_nombre,
                h.total_pagar,
                COALESCE(p.nombre, 'Sin POS') as pos_name,
                d.numero_control,
                d.codigo_generacion
            FROM sales_headers h
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const params = [companyId];

        if (start_date && end_date) {
            sql += ' AND h.fecha_emision BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }
        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' ORDER BY p.nombre, h.fecha_emision, h.id';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getSalesByPOS:', error);
        res.status(500).json({ message: 'Error al obtener detalle de ventas por POS' });
    }
};

/**
 * Exporta el reporte detallado de ventas por POS a PDF.
 */
const exportSalesByPOSPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const [companyRows] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const company = companyRows[0] || { razon_social: 'EMPRESA', nit: '' };

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        let sql = `
            SELECT 
                h.fecha_emision,
                h.tipo_documento,
                h.condicion_operacion,
                COALESCE(c.nombre, h.cliente_nombre) as cliente_nombre,
                COALESCE(c.nit, '') as cliente_nit,
                COALESCE(c.nrc, '') as cliente_nrc,
                COALESCE(s.nombre, 'Vendedor') as vendedor_nombre,
                h.total_gravado,
                h.total_iva,
                h.total_pagar,
                COALESCE(p.nombre, 'Sin POS') as pos_name,
                d.numero_control,
                d.codigo_generacion
            FROM sales_headers h
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
        `;
        const params = [companyId];
        if (start_date && end_date) { sql += ' AND h.fecha_emision BETWEEN ? AND ?'; params.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { sql += ' AND h.branch_id = ?'; params.push(branch_id); }
        sql += ' ORDER BY p.nombre, h.fecha_emision, h.id';

        const [rows] = await pool.query(sql, params);

        const reportData = {
            company_name: company.razon_social,
            company_nit: company.nit,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            data: rows
        };

        const pdfBuffer = await pdfService.generateSalesByPOSPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Detalle_Ventas_POS_${start_date}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportSalesByPOSPDF:', error);
        res.status(500).json({ message: 'Error al generar PDF detallado de ventas por POS' });
    }
};

const exportRTEE = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener datos detallados de la venta y DTE
        const [header] = await pool.query(
            `SELECT h.*, s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
            d.status as dte_status, d.numero_control as dte_control, d.respuesta_hacienda, d.respuesta_hacienda as dte_error,
            d.json_original, d.sello_recepcion, d.fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN dtes d ON (h.id = d.venta_id OR (h.codigo_generacion IS NOT NULL AND h.codigo_generacion = d.codigo_generacion)) AND h.company_id = d.company_id
            WHERE h.id = ? AND h.company_id = ?`, [id, req.company_id]);

        if (header.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const venta = header[0];
        
        // Procesar JSON si viene como string
        let dteJson = venta.json_original;
        if (typeof dteJson === 'string') {
            try { dteJson = JSON.parse(dteJson); } catch (e) {
                return res.status(500).json({ message: 'Error al procesar el JSON del DTE' });
            }
        }

        if (!dteJson) {
            return res.status(400).json({ message: 'Esta venta no tiene un DTE asociado para generar la RTEE' });
        }

        // 2. Obtener datos del emisor (Empresa y Sucursal)
        const [company] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.company_id]);
        const [branch] = await pool.query('SELECT * FROM branches WHERE id = ?', [venta.branch_id]);

        // --- Lógica de Logo ---
        let logoPath = null;
        const rawLogoUrl = (branch[0]?.logo_url || company[0]?.logo_url);
        
        if (rawLogoUrl) {
            const cleanPath = rawLogoUrl.startsWith('/') ? rawLogoUrl.substring(1) : rawLogoUrl;
            const absoluteLogoPath = path.join(__dirname, '..', '..', cleanPath);
            
            if (fs.existsSync(absoluteLogoPath)) {
                logoPath = absoluteLogoPath;
            }
        }

        // 3. Mapear datos para el servicio de PDF
        const reportData = {
            emisor: {
                nombre: company[0].razon_social,
                nit: company[0].nit,
                nrc: company[0].nrc,
                descActividad: dteJson.emisor.descActividad,
                direccion: dteJson.emisor.direccion,
                telefono: dteJson.emisor.telefono,
                correo: dteJson.emisor.correo,
                departamento_nombre: 'San Salvador',
                municipio_nombre: 'San Salvador',
                logoPath: logoPath
            },
            receptor: {
                nombre: dteJson.receptor.nombre,
                nit: dteJson.receptor.nit,
                nrc: dteJson.receptor.nrc || null,
                numDocumento: dteJson.receptor.numDocumento,
                direccion: dteJson.receptor.direccion,
                codActividad: dteJson.receptor.codActividad || null
            },
            dte: {
                tipoDte: dteJson.identificacion.tipoDte,
                tipoDteNombre: venta.tipo_documento_name || 'Factura',
                codigoGeneracion: dteJson.identificacion.codigoGeneracion,
                numeroControl: dteJson.identificacion.numeroControl,
                selloRecepcion: venta.sello_recepcion,
                ambiente: dteJson.identificacion.ambiente,
                tipoModelo: dteJson.identificacion.tipoModelo,
                tipoOperacion: dteJson.identificacion.tipoOperacion
            },
            venta: {
                fecha_emision: dteJson.identificacion.fecEmi,
                hora_emision: dteJson.identificacion.horEmi,
                condicion_operacion: dteJson.resumen.condicionOperacion,
                total_gravado: dteJson.resumen.totalGravada,
                total_iva: dteJson.resumen.totalIva || (dteJson.resumen.tributos ? dteJson.resumen.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
                total_descuento: dteJson.resumen.descuNoExenta || 0,
                total_pagar: dteJson.resumen.totalPagar,
                total_letras: dteJson.resumen.totalLetras,
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen.tributos || []
            },
            items: dteJson.cuerpoDocumento.map(item => ({
                cantidad: item.cantidad,
                descripcion: item.descripcion,
                precioUnitario: item.precioUni,
                montoDescuento: item.montoDescu,
                totalItem: item.ventaGravada,
                uniMedida: item.uniMedida || 59
            }))
        };

        const pdfBuffer = await pdfService.generateRTEE(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=RTEE-${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportRTEE] Error:', error);
        res.status(500).json({ message: 'Error al generar Representación Gráfica (RTEE)', error: error.message });
    }
};

const getDTEJson = async (req, res) => {
    const { id } = req.params;
    try {
        const [dte] = await pool.query('SELECT json_original FROM dtes WHERE venta_id = ? AND company_id = ?', [id, req.company_id]);
        if (dte.length === 0) {
            return res.status(404).json({ message: 'JSON no encontrado para esta venta' });
        }
        res.json(JSON.parse(dte[0].json_original));
    } catch (error) {
        console.error('[GetDTEJson] Error:', error);
        res.status(500).json({ message: 'Error al obtener JSON del DTE', error: error.message });
    }
};

const resendDTEEmail = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await mailerService.sendDTEEmail(id, req.company_id);
        if (result.success) {
            res.json({ success: true, message: 'Correo enviado correctamente' });
        } else {
            res.status(500).json({ success: false, message: 'Error al enviar correo', error: result.error });
        }
    } catch (error) {
        console.error('[ResendDTEEmail] Error:', error);
        res.status(500).json({ success: false, message: 'Error al procesar reenvío de correo', error: error.message });
    }
};

/**
 * Anula una venta, restaura el stock y maneja la invalidación DTE si aplica.
 */
const voidSale = async (req, res) => {
    const { id } = req.params;
    const { motivo, descripcion, nombreResponsable, tipDocResponsable, numDocResponsable, nombreSolicita, tipDocSolicita, numDocSolicita } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        // 1. Obtener la venta y configuración de empresa
        const [sales] = await connection.query(`
            SELECT h.*, c.dte_active, c.razon_social
            FROM sales_headers h
            JOIN companies c ON h.company_id = c.id
            WHERE h.id = ? AND h.company_id = ?
        `, [id, req.company_id]);

        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const sale = sales[0];

        if (sale.estado === 'anulado') {
            return res.status(400).json({ message: 'La venta ya se encuentra anulada' });
        }

        // 2. Validación de Tiempo para DTE (Normativa Hacienda SV: 24 horas)
        if (sale.dte_active && sale.codigo_generacion) {
            // Formatear fecha de emisión correctamente para comparación
            const emissionDateStr = sale.fecha_emision.toISOString().split('T')[0];
            const emissionDateTime = new Date(`${emissionDateStr}T${sale.hora_emision}`);
            const now = new Date();
            const diffHours = (now - emissionDateTime) / (1000 * 60 * 60);

            const isFactura = sale.tipo_documento === '01' || (sale.tipo_documento_name && sale.tipo_documento_name.toLowerCase().includes('factura'));
            const limitHours = isFactura ? (90 * 24) : 24;

            if (diffHours > limitHours) {
                const limitText = isFactura ? '90 días' : '24 horas';
                return res.status(400).json({ 
                    message: `No se puede invalidar este documento porque han transcurrido más de ${limitText} desde su emisión. Según la normativa, debe proceder mediante una Nota de Crédito.` 
                });
            }

            // 3. Proceso de Invalidación en dte-api
            const invalidationPayload = {
                codigoGeneracion: sale.codigo_generacion,
                motivo,
                descripcion,
                nombreResponsable: nombreResponsable || req.user.nombre,
                tipDocResponsable: tipDocResponsable || '36',
                numDocResponsable: numDocResponsable || '',
                nombreSolicita: nombreSolicita || sale.cliente_nombre || 'CLIENTE',
                tipDocSolicita: tipDocSolicita || '36',
                numDocSolicita: numDocSolicita || '',
                user_id: req.user.id
            };

            const dteResult = await dteService.invalidateDTE(sale, invalidationPayload);
            if (!dteResult.success) {
                throw new Error('Error al invalidar DTE en Hacienda: ' + dteResult.error);
            }
        }

        // 4. Actualizar estado de la venta
        await connection.query('UPDATE sales_headers SET estado = "anulado" WHERE id = ?', [id]);

        // 5. Restaurar Stock e Inventario
        const [items] = await connection.query('SELECT * FROM sales_items WHERE sale_id = ?', [id]);
        
        for (const item of items) {
            if (item.combo_id) {
                // Restaurar componentes de combo
                const [comboItems] = await connection.query(
                    'SELECT product_id, quantity FROM product_combo_items WHERE combo_id = ?', 
                    [item.combo_id]
                );

                for (const ci of comboItems) {
                    const totalQty = ci.quantity * item.cantidad;
                    const effectiveProductId = await getEffectiveProductId(connection, ci.product_id);
                    
                    await connection.query(
                        'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                        [totalQty, effectiveProductId, sale.branch_id]
                    );

                    await connection.query('INSERT INTO inventory_movements SET ?', [{
                        company_id: req.company_id,
                        branch_id: sale.branch_id,
                        product_id: effectiveProductId,
                        tipo_movimiento: 'ENTRADA',
                        cantidad: totalQty,
                        tipo_documento: `Anulación Venta ${id} (COMBO)`,
                        documento_id: id,
                        created_at: new Date()
                    }]);
                }
            } else if (item.product_id) {
                // Producto normal
                const effectiveProductId = await getEffectiveProductId(connection, item.product_id);
                
                await connection.query(
                    'UPDATE inventory SET stock = stock + ? WHERE product_id = ? AND branch_id = ?',
                    [item.cantidad, effectiveProductId, sale.branch_id]
                );

                await connection.query('INSERT INTO inventory_movements SET ?', [{
                    company_id: req.company_id,
                    branch_id: sale.branch_id,
                    product_id: effectiveProductId,
                    tipo_movimiento: 'ENTRADA',
                    cantidad: item.cantidad,
                    tipo_documento: `Anulación Venta ${id}`,
                    documento_id: id,
                    created_at: new Date()
                }]);
            }
        }

        await connection.commit();

        // 6. Notificación por Correo (Asíncrona, no bloquea la respuesta)
        if (sale.dte_active && sale.codigo_generacion) {
            mailerService.sendInvalidatedDTEEmail(id, req.company_id).catch(err => {
                console.error('[VoidSale] Error al enviar correo de invalidación:', err);
            });
        }

        res.json({ success: true, message: 'Venta anulada correctamente, DTE invalidado e inventario restaurado' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[VoidSale] Error:', error);
        res.status(500).json({ message: 'Error al anular la venta', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

/**
 * Retransmite un DTE que previamente fue rechazado.
 */
const retransmitSaleDTE = async (req, res) => {
    const { id } = req.params;
    const { newReceptor } = req.body;

    try {
        // 1. Obtener la venta y verificar que tenga un DTE rechazado
        const [sales] = await pool.query(
            `SELECT s.*, c.dte_active, d.status as dte_status 
             FROM sales_headers s 
             JOIN companies c ON s.company_id = c.id 
             LEFT JOIN dtes d ON s.codigo_generacion = d.codigo_generacion
             WHERE s.id = ? AND s.company_id = ?`, 
            [id, req.company_id]
        );

        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const sale = sales[0];
        const currentDteStatus = (sale.dte_status || '').toUpperCase();

        // Si tiene código de generación pero no está "ACCEPTED", permitimos el reintento
        // Esto desbloquea casos donde el estado quedó nulo o en blanco por errores previos
        const canRetransmit = currentDteStatus === 'REJECTED' || 
                             currentDteStatus === 'RECHAZADO' || 
                             currentDteStatus === '' || 
                             currentDteStatus === 'PENDIENTE' ||
                             currentDteStatus === 'SENT';

        if (!sale.codigo_generacion || !canRetransmit) {
            console.log(`[SalesController] Bloqueo de retransmisión: Venta ${id}, Gén: ${sale.codigo_generacion}, Status real: ${sale.dte_status}`);
            return res.status(400).json({ message: 'Esta venta no tiene un DTE que requiera retransmisión en este momento' });
        }

        // 2. Llamar al servicio de retransmisión
        console.log(`[SalesController] Re-intentando DTE ${sale.codigo_generacion} para venta ${id}`);
        const result = await dteService.retransmitDTE(sale, sale.codigo_generacion, newReceptor);

        if (result.success) {
            // 3. Actualizar la venta (sello/fecha en cabecera) y el estado en la tabla dtes
            await pool.query(
                'UPDATE sales_headers SET sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
                [result.data.sello_recepcion, result.data.fh_procesamiento, id]
            );

            await pool.query(
                'UPDATE dtes SET status = "ACCEPTED", respuesta_hacienda = NULL, sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                [result.data.sello_recepcion, result.data.fh_procesamiento, sale.codigo_generacion]
            );

            // 4. Enviar correo de notificación (Asíncrono)
            mailerService.sendDTEEmail(id, req.company_id).catch(err => 
                console.error(`[RetransmitSaleDTE] Error enviando correo para venta ${id}:`, err)
            );

            return res.json({
                success: true,
                message: 'DTE retransmitido y aceptado con éxito',
                data: result.data
            });
        } else {
            // Actualizar el error capturado en la tabla dtes
            await pool.query(
                'UPDATE dtes SET status = "REJECTED", respuesta_hacienda = ? WHERE codigo_generacion = ?',
                [JSON.stringify(result.error), sale.codigo_generacion]
            );

            return res.status(400).json({
                success: false,
                message: 'El reintento fue rechazado nuevamente por Hacienda',
                error: result.error
            });
        }

    } catch (error) {
        console.error('[SalesController] Error en retransmisión:', error);
        res.status(500).json({ message: 'Error interno al intentar retransmitir' });
    }
};

module.exports = {
    createSale,
    getSales,
    getSaleById,
    getSalesByCategory,
    exportSalesByCategoryPDF,
    getDailySales,
    exportDailySalesPDF,
    getSalesReportPDF,
    getSalesByPOS,
    exportSalesByPOSPDF,
    exportRTEE,
    getDTEJson,
    resendDTEEmail,
    voidSale,
    retransmitSaleDTE
};
