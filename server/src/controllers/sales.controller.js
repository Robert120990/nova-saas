const mailerService = require('../services/mailer.service');
const pool = require('../config/db');
const dteService = require('../services/dte.service');
const pdfService = require('../services/pdf.service');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getEffectiveProductId } = require('../utils/inventoryUtils');
const excelService = require('../services/excel.service');

const dteTypeNames = {
    '01': 'Factura',
    '03': 'Crédito Fiscal',
    '04': 'Nota de Remisión',
    '05': 'Nota de Crédito',
    '06': 'Nota de Débito',
    '07': 'Comprobante de Retención',
    '08': 'Comprobante de Liquidación',
    '09': 'Documento Contable de Liquidación',
    '11': 'Factura de Exportación',
    '14': 'Factura de Sujeto Excluido',
    '15': 'Comprobante de Donación'
};

function getDteTypeName(tipoDte) {
    return dteTypeNames[tipoDte] || 'Documento Tributario';
}

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

        // 1. Insertar Cabecera de Venta (sin DTE aún)
        const [saleResult] = await connection.query('INSERT INTO sales_headers SET ?', [{
            company_id: req.company_id,
            branch_id: req.user.branch_id,
            customer_id: header.customer_id,
            customer_branch_id: header.customer_branch_id || null,
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
            export_item_type: header.export_item_type || null,
            fiscal_enclosure: header.fiscal_enclosure || null,
            export_regime: header.export_regime || null,
            dest_country_code: header.dest_country_code || null,
            remission_type: header.remission_type || null,
            transporter_name: header.transporter_name || null,
            vehicle_plate: header.vehicle_plate || null,
            cliente_nombre: header.cliente_nombre || null,
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

            if (item.combo_id) {
                const [comboItems] = await connection.query(
                    'SELECT product_id, quantity FROM product_combo_items WHERE combo_id = ?', 
                    [item.combo_id]
                );

                for (const ci of comboItems) {
                    const totalQty = ci.quantity * item.cantidad;
                    const effectiveProductId = await getEffectiveProductId(connection, ci.product_id);
                    
                    if (header.dte_type !== '04') {
                        await connection.query(
                            'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                            [totalQty, effectiveProductId, req.user.branch_id]
                        );

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
                const effectiveProductId = await getEffectiveProductId(connection, item.product_id);
                
                if (header.dte_type !== '04') {
                    await connection.query(
                        'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                        [item.cantidad, effectiveProductId, req.user.branch_id]
                    );

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

        // 4. Documentos Vinculados
        if (linkedDocuments && linkedDocuments.length > 0) {
            for (const doc of linkedDocuments) {
                await connection.query('INSERT INTO sales_linked_documents SET ?', [{
                    sale_id: saleId,
                    doc_type: doc.doc_type || null,
                    doc_number: doc.doc_number || null,
                    emission_date: doc.emission_date || null,
                    generation_type: doc.generation_type || null
                }]);
            }
        }

        // 5. Emitir DTE (después de guardar la venta para evitar DTEs huérfanos)
        let dteInfo = {};
        let dteResult = null;
        if (company && company.dte_active) {
            const dtePayload = {
                ...req.body,
                sale_id: saleId,
                emisor_adicional: {
                    descActividad: company.actividad_economica,
                    codPuntoVentaMH: codPuntoVentaMH
                }
            };

            if (!header.branch_id) header.branch_id = req.user.branch_id;
            if (!header.user_id) header.user_id = req.user.id;

            dteResult = await dteService.emitDTE(company, dtePayload);
            if (dteResult.success) {
                dteInfo = dteResult.data;
            } else if (!dteResult.skip) {
                if (dteResult.codigo_generacion) {
                    dteInfo = { 
                        codigo_generacion: dteResult.codigo_generacion,
                        numero_control: dteResult.numero_control,
                        sello_recepcion: dteResult.data?.sello_recepcion || null,
                        fh_procesamiento: dteResult.data?.fh_procesamiento || null
                    };
                    console.warn(`[SalesController] Venta persistida con DTE Rechazado: ${dteResult.codigo_generacion}`);
                } else {
                    console.error('[SalesController] DTE Schema Error Details:', JSON.stringify(dteResult.details, null, 2));
                    const err = new Error('Error crítico en DTE: ' + (dteResult.error || 'Error desconocido'));
                    err.details = dteResult.details || null;
                    throw err;
                }
            }
        }

        // 6. Vincular datos del DTE a la venta (dentro de la transacción)
        if (dteInfo.codigo_generacion) {
            await connection.query('UPDATE sales_headers SET ? WHERE id = ?', [{
                codigo_generacion: dteInfo.codigo_generacion,
                numero_control: dteInfo.numero_control || null,
                sello_recepcion: dteInfo.sello_recepcion || null,
                fh_procesamiento: dteInfo.fh_procesamiento || null
            }, saleId]);

            await connection.query(
                'UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?',
                [saleId, dteInfo.codigo_generacion, req.company_id]
            );
        }

        await connection.commit();

        // 7. Enviar correo de notificación (async, después del commit)
        if (dteInfo.codigo_generacion && dteResult && dteResult.success) {
            (async () => {
                try {
                    await mailerService.sendDTEEmail(saleId, req.company_id);
                } catch (err) {
                    console.error(`[PostSaleProcess] Error al enviar correo para venta ${saleId}:`, err.message);
                }
            })();
        }

        res.status(201).json({ 
            id: saleId, 
            message: 'Venta procesada exitosamente',
            success: true,
            dte: dteInfo
        });

    } catch (error) {
        await connection.rollback();
        console.error('CRITICAL ERROR in createSale:', error);
        res.status(500).json({ 
            message: 'Error al procesar la venta', 
            error: error.message,
            details: error.details || null,
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
    const { page = 1, limit = 15, dte_type, start_date, end_date, search = '', customer_id, status, only_processed, exclude_has_nc } = req.query;
    const offset = (page - 1) * limit;

    try {
        let sql = `
            SELECT h.*, s.nombre as seller_name, p.nombre as pos_name, b.nombre as branch_name, c.correo as customer_email,
            c.nit as customer_nit, c.nrc as customer_nrc, c.numero_documento as customer_dui,
            COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as customer_name,
            COALESCE(d_v.status, d_c.status) as dte_status, COALESCE(d_v.numero_control, d_c.numero_control) as dte_control, COALESCE(d_v.ambiente, d_c.ambiente, '00') as dte_ambiente, COALESCE(d_v.respuesta_hacienda, d_c.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_v.respuesta_hacienda, d_c.respuesta_hacienda) as dte_error,
            comp.nit as company_nit,
            CASE h.tipo_documento 
                WHEN '01' THEN 'Factura'
                WHEN '03' THEN 'Crédito Fiscal'
                WHEN '04' THEN 'Nota de Remisión'
                WHEN '05' THEN 'Nota de Crédito'
                WHEN '07' THEN 'C. Retención'
                WHEN '11' THEN 'Factura de Exportación'
                ELSE h.tipo_documento 
            END as tipo_documento_name
            FROM sales_headers h
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN branches b ON h.branch_id = b.id
            LEFT JOIN companies comp ON h.company_id = comp.id
            LEFT JOIN dtes d_v ON d_v.venta_id = h.id AND d_v.company_id = h.company_id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
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
            sql += " AND (d_v.status = 'ACCEPTED' OR d_c.status = 'ACCEPTED')";
        }

        if (exclude_has_nc === 'true') {
            sql += ` AND NOT EXISTS (
                SELECT 1 FROM sales_linked_documents ld 
                JOIN sales_headers h2 ON ld.sale_id = h2.id 
                WHERE h2.tipo_documento = '05' AND h2.estado = 'emitido'
                AND (
                    (ld.doc_number = h.codigo_generacion COLLATE utf8mb4_unicode_ci AND h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '') OR 
                    (ld.doc_number = h.numero_control COLLATE utf8mb4_unicode_ci AND h.numero_control IS NOT NULL AND h.numero_control != '') OR 
                    (ld.doc_number = d_v.numero_control COLLATE utf8mb4_unicode_ci AND d_v.numero_control IS NOT NULL AND d_v.numero_control != '') OR
                    (ld.doc_number = d_c.numero_control COLLATE utf8mb4_unicode_ci AND d_c.numero_control IS NOT NULL AND d_c.numero_control != '') OR
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
            countSql += " AND (EXISTS (SELECT 1 FROM dtes d2 WHERE d2.venta_id = h.id AND d2.status = 'ACCEPTED') OR EXISTS (SELECT 1 FROM dtes d2 WHERE d2.codigo_generacion = h.codigo_generacion AND d2.status = 'ACCEPTED'))";
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

        sql += ' ORDER BY h.fecha_emision DESC, h.hora_emision DESC LIMIT ? OFFSET ?';
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
            comp.nit as company_nit,
            COALESCE(d_v.status, d_c.status) as dte_status, COALESCE(d_v.respuesta_hacienda, d_c.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_v.respuesta_hacienda, d_c.respuesta_hacienda) as dte_error, COALESCE(d_v.json_original, d_c.json_original) as json_original, COALESCE(d_v.sello_recepcion, d_c.sello_recepcion) as sello_recepcion, COALESCE(d_v.fh_procesamiento, d_c.fh_procesamiento) as fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN branches b ON h.branch_id = b.id
            LEFT JOIN companies comp ON h.company_id = comp.id
            LEFT JOIN dtes d_v ON d_v.venta_id = h.id AND d_v.company_id = h.company_id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
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

        const [items] = await pool.query('SELECT * FROM sales_items WHERE sale_id = ? ORDER BY id ASC', [id]);
        const [payments] = await pool.query('SELECT * FROM sales_payments WHERE sale_id = ? ORDER BY id ASC', [id]);
        const [linkedDocs] = await pool.query('SELECT * FROM sales_linked_documents WHERE sale_id = ? ORDER BY id ASC', [id]);

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

        if (req.query.format === 'excel') {
            const sheetData = [];
            reportData.categories.forEach(cat => {
                if (reportData.isDetailed && cat.productos) {
                    cat.productos.forEach(prod => {
                        sheetData.push({
                            categoria: cat.categoria,
                            producto: prod.producto,
                            unidades: parseFloat(prod.unidades || 0).toFixed(2),
                            monto: parseFloat(prod.monto || 0).toFixed(2),
                            rendimiento: parseFloat(prod.rendimiento || 0).toFixed(2),
                            porcentaje: '',
                        });
                    });
                } else {
                    sheetData.push({
                        categoria: cat.categoria,
                        producto: '',
                        unidades: parseFloat(cat.total_unidades || 0).toFixed(2),
                        monto: parseFloat(cat.total_venta || 0).toFixed(2),
                        rendimiento: parseFloat(cat.rendimiento || 0).toFixed(2),
                        porcentaje: parseFloat(cat.porcentaje_ventas || 0).toFixed(2) + '%',
                    });
                }
            });

            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Categorías',
                    columns: [
                        { header: 'Categoría', key: 'categoria', width: 25 },
                        { header: 'Producto', key: 'producto', width: 30 },
                        { header: 'Unidades', key: 'unidades', width: 14 },
                        { header: 'Monto', key: 'monto', width: 16 },
                        { header: 'Rendimiento', key: 'rendimiento', width: 16 },
                        { header: '% Ventas', key: 'porcentaje', width: 12 },
                    ],
                    data: sheetData
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_Categoria_${start_date}.xlsx`);
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

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas Diarias',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Cliente', key: 'cliente', width: 30 },
                        { header: 'Tipo Doc', key: 'tipo', width: 16 },
                        { header: 'Documento', key: 'documento', width: 20 },
                        { header: 'Condición', key: 'condicion', width: 12 },
                        { header: 'Gravadas', key: 'gravadas', width: 14 },
                        { header: 'Exentas', key: 'exentas', width: 14 },
                        { header: 'IVA', key: 'iva', width: 14 },
                        { header: 'FOVIAL', key: 'fovial', width: 14 },
                        { header: 'COTRANS', key: 'cotrans', width: 14 },
                        { header: 'Retención', key: 'retencion', width: 14 },
                        { header: 'Percepción', key: 'percepcion', width: 14 },
                        { header: 'Total', key: 'total', width: 16 },
                    ],
                    data: rows.map(r => ({
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        cliente: r.cliente,
                        tipo: r.tipo,
                        documento: r.documento,
                        condicion: r.condicion,
                        gravadas: parseFloat(r.gravadas || 0).toFixed(2),
                        exentas: parseFloat(r.exentas || 0).toFixed(2),
                        iva: parseFloat(r.iva || 0).toFixed(2),
                        fovial: parseFloat(r.fovial || 0).toFixed(2),
                        cotrans: parseFloat(r.cotrans || 0).toFixed(2),
                        retencion: parseFloat(r.retencion || 0).toFixed(2),
                        percepcion: parseFloat(r.percepcion || 0).toFixed(2),
                        total: parseFloat(r.total || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_Diarias_${start_date}_al_${end_date}.xlsx`);
        }

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

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas',
                    columns: [
                        { header: 'Cliente', key: 'customer_name', width: 30 },
                        { header: 'Sucursal', key: 'branch_nombre', width: 20 },
                        { header: 'Fecha', key: 'fecha_emision', width: 14 },
                        { header: 'Tipo Doc', key: 'tipo_doc_nombre', width: 16 },
                        { header: 'No. Documento', key: 'numero_control', width: 20 },
                        { header: 'Condición', key: 'condicion_nombre', width: 12 },
                        { header: 'Gravada', key: 'gravada', width: 14 },
                        { header: 'Exenta', key: 'exenta', width: 14 },
                        { header: 'IVA', key: 'iva', width: 14 },
                        { header: 'Retención', key: 'retencion', width: 14 },
                        { header: 'Percepción', key: 'percepcion', width: 14 },
                        { header: 'FOVIAL', key: 'fovial', width: 14 },
                        { header: 'COTRANS', key: 'cotrans', width: 14 },
                        { header: 'Total', key: 'total', width: 16 },
                    ],
                    data: rows.map(r => ({
                        customer_name: r.customer_name,
                        branch_nombre: r.branch_nombre,
                        fecha_emision: new Date(r.fecha_emision).toLocaleDateString('es-SV'),
                        tipo_doc_nombre: r.tipo_doc_nombre,
                        numero_control: r.numero_control,
                        condicion_nombre: r.condicion_nombre,
                        gravada: parseFloat(r.total_gravada || 0).toFixed(2),
                        exenta: parseFloat(r.total_exenta || 0).toFixed(2),
                        iva: parseFloat(r.total_iva || 0).toFixed(2),
                        retencion: parseFloat(r.total_retencion || 0).toFixed(2),
                        percepcion: parseFloat(r.total_percepcion || 0).toFixed(2),
                        fovial: parseFloat(r.total_fovial || 0).toFixed(2),
                        cotrans: parseFloat(r.total_cotrans || 0).toFixed(2),
                        total: parseFloat(r.total_pagar || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Reporte_Ventas_${req.query.start_date}_al_${req.query.end_date}.xlsx`);
        }

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
            doc.text('TIPO DOC', startX + 38, y);
            doc.text('NÚMERO', startX + 120, y);
            doc.text('CONDICIÓN', startX + 248, y);
            doc.text('GRAVADA', startX + 298, y, { width: 55, align: 'right' });
            doc.text('EXENTA', startX + 358, y, { width: 55, align: 'right' });
            doc.text('IVA', startX + 418, y, { width: 45, align: 'right' });
            doc.text('RET.', startX + 468, y, { width: 40, align: 'right' });
            doc.text('PER.', startX + 513, y, { width: 40, align: 'right' });
            doc.text('FOV.', startX + 558, y, { width: 45, align: 'right' });
            doc.text('COT.', startX + 608, y, { width: 45, align: 'right' });
            doc.text('TOTAL', startX + 658, y, { width: 70, align: 'right' });
            doc.moveTo(startX, y + 10).lineTo(758, y + 10).stroke();
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
                    doc.text('SUBTOTAL:', startX + 240, currentY, { width: 53, align: 'right' });
                    doc.text(`$${cTotals.grav.toFixed(2)}`, startX + 298, currentY, { width: 55, align: 'right' });
                    doc.text(`$${cTotals.exe.toFixed(2)}`, startX + 358, currentY, { width: 55, align: 'right' });
                    doc.text(`$${cTotals.iva.toFixed(2)}`, startX + 418, currentY, { width: 45, align: 'right' });
                    doc.text(`$${cTotals.ret.toFixed(2)}`, startX + 468, currentY, { width: 40, align: 'right' });
                    doc.text(`$${cTotals.per.toFixed(2)}`, startX + 513, currentY, { width: 40, align: 'right' });
                    doc.text(`$${cTotals.fov.toFixed(2)}`, startX + 558, currentY, { width: 45, align: 'right' });
                    doc.text(`$${cTotals.cot.toFixed(2)}`, startX + 608, currentY, { width: 45, align: 'right' });
                    doc.text(`$${cTotals.total.toFixed(2)}`, startX + 658, currentY, { width: 70, align: 'right' });
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
            doc.text(row.tipo_doc_nombre || '---', startX + 38, currentY, { width: 80, truncate: true });
            doc.text(row.numero_control || `VTA-${row.id}`, startX + 120, currentY, { width: 125 });
            doc.text(row.condicion_nombre || 'CONTADO', startX + 248, currentY, { width: 48 });
            doc.text(`$${parseFloat(row.total_gravado || 0).toFixed(2)}`, startX + 298, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.total_exento || 0).toFixed(2)}`, startX + 358, currentY, { width: 55, align: 'right' });
            doc.text(`$${parseFloat(row.total_iva || 0).toFixed(2)}`, startX + 418, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.iva_retenido || 0).toFixed(2)}`, startX + 468, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.iva_percibido || 0).toFixed(2)}`, startX + 513, currentY, { width: 40, align: 'right' });
            doc.text(`$${parseFloat(row.fovial || 0).toFixed(2)}`, startX + 558, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.cotrans || 0).toFixed(2)}`, startX + 608, currentY, { width: 45, align: 'right' });
            doc.text(`$${parseFloat(row.total_pagar || 0).toFixed(2)}`, startX + 658, currentY, { width: 70, align: 'right' });

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
                doc.text('SUBTOTAL:', startX + 240, currentY, { width: 53, align: 'right' });
                doc.text(`$${cTotals.grav.toFixed(2)}`, startX + 298, currentY, { width: 55, align: 'right' });
                doc.text(`$${cTotals.exe.toFixed(2)}`, startX + 358, currentY, { width: 55, align: 'right' });
                doc.text(`$${cTotals.iva.toFixed(2)}`, startX + 418, currentY, { width: 45, align: 'right' });
                doc.text(`$${cTotals.ret.toFixed(2)}`, startX + 468, currentY, { width: 40, align: 'right' });
                doc.text(`$${cTotals.per.toFixed(2)}`, startX + 513, currentY, { width: 40, align: 'right' });
                doc.text(`$${cTotals.fov.toFixed(2)}`, startX + 558, currentY, { width: 45, align: 'right' });
                doc.text(`$${cTotals.cot.toFixed(2)}`, startX + 608, currentY, { width: 45, align: 'right' });
                doc.text(`$${cTotals.total.toFixed(2)}`, startX + 658, currentY, { width: 70, align: 'right' });
                currentY += 20;
            }
        });

        // Grand Total
        doc.moveTo(startX, currentY).lineTo(758, currentY).stroke();
        currentY += 10;
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('TOTAL GENERAL:', startX + 138, currentY, { width: 155, align: 'right' });
        doc.text(`$${gTotals.grav.toFixed(2)}`, startX + 298, currentY, { width: 55, align: 'right' });
        doc.text(`$${gTotals.exe.toFixed(2)}`, startX + 358, currentY, { width: 55, align: 'right' });
        doc.text(`$${gTotals.iva.toFixed(2)}`, startX + 418, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.ret.toFixed(2)}`, startX + 468, currentY, { width: 40, align: 'right' });
        doc.text(`$${gTotals.per.toFixed(2)}`, startX + 513, currentY, { width: 40, align: 'right' });
        doc.text(`$${gTotals.fov.toFixed(2)}`, startX + 558, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.cot.toFixed(2)}`, startX + 608, currentY, { width: 45, align: 'right' });
        doc.text(`$${gTotals.total.toFixed(2)}`, startX + 658, currentY, { width: 70, align: 'right' });
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

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas por POS',
                    columns: [
                        { header: 'POS', key: 'pos_name', width: 20 },
                        { header: 'Fecha', key: 'fecha_emision', width: 14 },
                        { header: 'Cliente', key: 'cliente_nombre', width: 30 },
                        { header: 'No. Documento', key: 'numero_control', width: 20 },
                        { header: 'Vendedor', key: 'vendedor_nombre', width: 20 },
                        { header: 'Gravado', key: 'total_gravado', width: 14 },
                        { header: 'IVA', key: 'total_iva', width: 14 },
                        { header: 'Total', key: 'total_pagar', width: 16 },
                    ],
                    data: rows.map(r => ({
                        pos_name: r.pos_name,
                        fecha_emision: new Date(r.fecha_emision).toLocaleDateString('es-SV'),
                        cliente_nombre: r.cliente_nombre || 'Consumidor Final',
                        numero_control: r.numero_control || '',
                        vendedor_nombre: r.vendedor_nombre,
                        total_gravado: parseFloat(r.total_gravado || 0).toFixed(2),
                        total_iva: parseFloat(r.total_iva || 0).toFixed(2),
                        total_pagar: parseFloat(r.total_pagar || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_POS_${start_date}.xlsx`);
        }

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
            `SELECT h.*, h.estado as sale_estado,
            s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
            COALESCE(d_v.status, d_c.status) as dte_status, COALESCE(d_v.numero_control, d_c.numero_control) as dte_control, COALESCE(d_v.respuesta_hacienda, d_c.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_v.respuesta_hacienda, d_c.respuesta_hacienda) as dte_error,
            COALESCE(d_v.json_original, d_c.json_original) as json_original, COALESCE(d_v.sello_recepcion, d_c.sello_recepcion) as sello_recepcion, COALESCE(d_v.fh_procesamiento, d_c.fh_procesamiento) as fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN dtes d_v ON d_v.venta_id = h.id AND d_v.company_id = h.company_id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
            WHERE h.id = ? AND h.company_id = ? LIMIT 1`, [id, req.company_id]);

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
                codActividad: dteJson.receptor.codActividad || null,
                descActividad: dteJson.receptor.descActividad || null,
                codPais: dteJson.receptor.codPais || null,
                nombrePais: dteJson.receptor.nombrePais || null,
            },
            dte: {
                tipoDte: dteJson.identificacion.tipoDte,
                tipoDteNombre: getDteTypeName(dteJson.identificacion.tipoDte),
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
                total_gravado: dteJson.resumen.totalGravada || dteJson.resumen.totalSujetoRetencion || 0,
                total_iva: dteJson.resumen.totalIva || dteJson.resumen.totalIVAretenido || (dteJson.resumen.tributos ? dteJson.resumen.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
                total_descuento: dteJson.resumen.descuNoExenta || 0,
                total_pagar: dteJson.resumen.totalPagar || dteJson.resumen.totalIVAretenido || 0,
                total_letras: dteJson.resumen.totalLetras || dteJson.resumen.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen.tributos || [],
                totalSujetoRetencion: dteJson.resumen.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen.totalIVAretenido || 0,
            },
            items: dteJson.cuerpoDocumento.map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                numDocumento: item.numDocumento || null,
                ivaRetenido: item.ivaRetenido || 0,
            }))
        };

        reportData.isVoided = (venta.estado || '').toLowerCase() === 'anulado' || venta.dte_status === 'INVALIDADO';

        const pdfBuffer = await pdfService.generateRTEE(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=RTEE-${id}.pdf`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportRTEE] Error:', error);
        res.status(500).json({ message: 'Error al generar Representación Gráfica (RTEE)', error: error.message });
    }
};

const getPublicRTEE = async (req, res) => {
    const { codigo } = req.params;

    try {
        // 1. Obtener datos detallados de la venta y DTE por codigo_generacion
        const [header] = await pool.query(
            `SELECT h.*, s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
            d.status as dte_status, d.numero_control as dte_control, d.respuesta_hacienda, d.respuesta_hacienda as dte_error,
            d.json_original, d.sello_recepcion, d.fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN dtes d ON h.codigo_generacion = d.codigo_generacion
            WHERE h.codigo_generacion = ?`, [codigo]);

        if (header.length === 0) {
            return res.status(404).json({ message: 'Documento no encontrado' });
        }

        const venta = header[0];
        
        let dteJson = venta.json_original;
        if (typeof dteJson === 'string') {
            try { dteJson = JSON.parse(dteJson); } catch (e) {
                return res.status(500).json({ message: 'Error al procesar el JSON del DTE' });
            }
        }

        if (!dteJson) {
            return res.status(400).json({ message: 'Este documento no tiene un DTE asociado' });
        }

        // 2. Obtener datos del emisor usando el company_id de la venta
        const [company] = await pool.query('SELECT * FROM companies WHERE id = ?', [venta.company_id]);
        const [branch] = await pool.query('SELECT * FROM branches WHERE id = ?', [venta.branch_id]);

        let logoPath = null;
        const rawLogoUrl = (branch[0]?.logo_url || company[0]?.logo_url);
        
        if (rawLogoUrl) {
            const cleanPath = rawLogoUrl.startsWith('/') ? rawLogoUrl.substring(1) : rawLogoUrl;
            const absoluteLogoPath = path.join(__dirname, '..', '..', cleanPath);
            if (fs.existsSync(absoluteLogoPath)) logoPath = absoluteLogoPath;
        }

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
                codActividad: dteJson.receptor.codActividad || null,
                descActividad: dteJson.receptor.descActividad || null,
                codPais: dteJson.receptor.codPais || null,
                nombrePais: dteJson.receptor.nombrePais || null,
            },
            dte: {
                tipoDte: dteJson.identificacion.tipoDte,
                tipoDteNombre: getDteTypeName(dteJson.identificacion.tipoDte),
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
                total_gravado: dteJson.resumen.totalGravada || dteJson.resumen.totalSujetoRetencion || 0,
                total_iva: dteJson.resumen.totalIva || dteJson.resumen.totalIVAretenido || (dteJson.resumen.tributos ? dteJson.resumen.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
                total_descuento: dteJson.resumen.descuNoExenta || 0,
                total_pagar: dteJson.resumen.totalPagar || dteJson.resumen.totalIVAretenido || 0,
                total_letras: dteJson.resumen.totalLetras || dteJson.resumen.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen.tributos || [],
                totalSujetoRetencion: dteJson.resumen.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen.totalIVAretenido || 0,
            },
            items: dteJson.cuerpoDocumento.map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                numDocumento: item.numDocumento || null,
                ivaRetenido: item.ivaRetenido || 0,
            }))
        };

        reportData.isVoided = (venta.estado || '').toLowerCase() === 'anulado' || venta.dte_status === 'INVALIDADO';

        const pdfBuffer = await pdfService.generateRTEE(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=DTE-${codigo}.pdf`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[GetPublicRTEE] Error:', error);
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

const getDTEByCodigoGeneracion = async (req, res) => {
    const { codigoGeneracion } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [codigoGeneracion, req.company_id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'DTE no encontrado' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('[GetDTEByCodigoGeneracion] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const resendDTEEmail = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await mailerService.sendDTEEmail(id, req.company_id);
        if (result.success) {
            res.json({ success: true, message: 'Correo enviado correctamente' });
        } else if (result.skip) {
            res.json({ success: false, message: 'El cliente no tiene un correo electrónico registrado.' });
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
    let connection = null;

    try {
        // 1. Obtener la venta y configuración de empresa
        const [sales] = await pool.query(`
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

        // 2. Validación de Tiempo para DTE (Normativa V2.0 MH / Infile)
        if (sale.dte_active && sale.codigo_generacion) {
            const emissionDateStr = sale.fecha_emision.toISOString().split('T')[0];
            const now = new Date();
            const localNow = new Date(now.toLocaleString("en-US", { timeZone: "America/El_Salvador" }));

            const tipoDte = String(sale.tipo_documento || '01');
            const emiDateParts = emissionDateStr.split('-');
            const emiYear = parseInt(emiDateParts[0], 10);
            const emiMonth = parseInt(emiDateParts[1], 10) - 1; // 0-indexed
            const emiDay = parseInt(emiDateParts[2], 10);

            // Grupo 1: CCF (03), NC (05), ND (06), Retención (07), Liquidación (08), Remisión (04), Retorno (18), Op. Esp (17)
            // -> 10 Días Hábiles del mes siguiente al periodo tributario de emisión
            // Grupo 2: Factura (01), FEX (11), FSE (14) -> 3 Meses desde el sello de recepción / emisión
            const group1Types = ['03', '04', '05', '06', '07', '08', '17', '18'];
            let isWithinLimit = true;
            let limitMessage = '';

            if (group1Types.includes(tipoDte)) {
                // Calcular el 10º día hábil del mes siguiente
                let nextMonth = emiMonth + 1;
                let year = emiYear;
                if (nextMonth > 11) {
                    nextMonth = 0;
                    year += 1;
                }

                let businessDaysCount = 0;
                let limitDate = null;
                for (let day = 1; day <= 31; day++) {
                    const d = new Date(year, nextMonth, day);
                    if (d.getMonth() !== nextMonth) break;
                    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                        businessDaysCount++;
                        if (businessDaysCount === 10) {
                            limitDate = new Date(year, nextMonth, day, 23, 59, 59, 999);
                            break;
                        }
                    }
                }

                if (limitDate && localNow > limitDate) {
                    isWithinLimit = false;
                    limitMessage = `Ha transcurrido el plazo máximo de 10 días hábiles del mes siguiente al periodo de emisión para este tipo de documento. Debe proceder mediante una Nota de Crédito.`;
                }
            } else {
                // Grupo 2 (Factura 01, FEX 11, FSE 14): Tres meses desde el sello de recepción / emisión
                const limitDate = new Date(emiYear, emiMonth + 3, emiDay, 23, 59, 59, 999);
                if (localNow > limitDate) {
                    isWithinLimit = false;
                    limitMessage = `Han transcurrido más de tres meses desde el sello de recepción del documento. Según la normativa, debe proceder mediante una Nota de Crédito.`;
                }
            }

            if (!isWithinLimit) {
                return res.status(400).json({ message: limitMessage });
            }

            // 3. Proceso de Invalidación en dte-api
            const { codigoGeneracionR } = req.body;

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
                codigoGeneracionR: codigoGeneracionR || null,
                user_id: req.user.id
            };

            const dteResult = await dteService.invalidateDTE(sale, invalidationPayload);
            if (!dteResult.success && !dteResult.skip) {
                console.warn('[VoidSale] dte-api reportó error, el DTE pudo haberse invalidado igual:', dteResult.error);
            }
        }

        // 4. Actualizar estado de la venta INMEDIATAMENTE (fuera de transacción)
        //    para evitar el escenario donde el DTE queda invalidado pero estado = ""
        await pool.query('UPDATE sales_headers SET estado = "anulado" WHERE id = ?', [id]);

        // 5. Restaurar Stock e Inventario (en su propia transacción)
        //    Si falla, el estado ya quedó como "anulado" y el usuario puede corregir stock manualmente
        connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [items] = await connection.query('SELECT * FROM sales_items WHERE sale_id = ?', [id]);

            for (const item of items) {
                if (item.combo_id) {
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
        } catch (stockError) {
            await connection.rollback();
            console.error('[VoidSale] Error restaurando stock (la venta ya fue anulada):', stockError.message);
            // No relanzar — la venta ya está anulada y el DTE invalidado correctamente
        } finally {
            connection.release();
            connection = null;
        }

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
        res.status(500).json({ message: `Error al anular la venta: ${error.message}` });
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

const checkExistingCR = async (req, res) => {
    try {
        const { doc_number, doc_type } = req.query;
        if (!doc_number) return res.json({ exists: false });

        const [rows] = await pool.query(
            `SELECT 1 FROM sales_linked_documents ld
             JOIN sales_headers h ON ld.sale_id = h.id
             WHERE ld.doc_number = ? AND h.tipo_documento = '07' AND h.company_id = ?
             LIMIT 1`,
            [doc_number, req.company_id]
        );
        res.json({ exists: rows.length > 0 });
    } catch (error) {
        console.error('[checkExistingCR] Error:', error.message);
        res.json({ exists: false });
    }
};

const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || 'saas_dte_api_secret_2024';

const getContingencyStatus = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/status`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const startContingency = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id, branch_id: req.user.branch_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const stopContingency = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/stop/${req.params.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ERET / Retorno proxy endpoints
const listRetornos = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const params = new URLSearchParams({ search: req.query.search || '', page: req.query.page || '1', limit: req.query.limit || '10' });
        const response = await fetch(`${DTE_API_URL}/retorno?${params}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const emitRetorno = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id, branch_id: req.user.branch_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/retorno/emit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getRetornoStatus = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/retorno/status/${req.params.codigoGeneracion}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const regenerateDTE = async (req, res) => {
    const { id } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();

        const [sales] = await connection.query(
            `SELECT s.*, c.*, s.id as sale_id, cat.description as actividad_economica
             FROM sales_headers s
             JOIN companies c ON s.company_id = c.id
             LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
             WHERE s.id = ? AND s.company_id = ?`,
            [id, req.company_id]
        );

        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const sale = sales[0];

        if (!sale.dte_active) {
            return res.status(400).json({ message: 'La empresa no tiene activado el módulo DTE' });
        }

        const [items] = await connection.query('SELECT * FROM sales_items WHERE sale_id = ?', [id]);
        const [payments] = await connection.query('SELECT * FROM sales_payments WHERE sale_id = ?', [id]);
        const [linkedDocs] = await connection.query('SELECT * FROM sales_linked_documents WHERE sale_id = ?', [id]);

        let codPuntoVentaMH = null;
        if (sale.pos_id) {
            const [pos] = await connection.query('SELECT codigo FROM points_of_sale WHERE id = ?', [sale.pos_id]);
            if (pos.length > 0) codPuntoVentaMH = pos[0].codigo;
        }

        connection.release();
        connection = null;

        const dtePayload = {
            header: {
                dte_type: sale.dte_type || sale.tipo_documento,
                customer_id: sale.customer_id,
                cliente_nombre: sale.cliente_nombre || null,
                customer_branch_id: sale.customer_branch_id || null,
                seller_id: sale.seller_id,
                pos_id: sale.pos_id,
                shift_id: sale.shift_id || null,
                branch_id: sale.branch_id,
                user_id: req.user.id,
                condicion_operacion: sale.condicion_operacion || 1,
                total_gravado: sale.total_gravado || 0,
                total_exento: sale.total_exento || 0,
                total_nosujetas: sale.total_nosujetas || 0,
                fovial: sale.fovial || 0,
                total_fovial: sale.fovial || 0,
                cotrans: sale.cotrans || 0,
                total_cotrans: sale.cotrans || 0,
                total_iva: sale.total_iva || 0,
                descuento_general: sale.descuento_general || 0,
                total_descuento: sale.descuento_general || 0,
                iva_percibido: sale.iva_percibido || 0,
                total_percepcion: sale.iva_percibido || 0,
                iva_retenido: sale.iva_retenido || 0,
                total_retencion: sale.iva_retenido || 0,
                total_pagar: sale.total_pagar || 0,
                payment_condition: sale.payment_condition || 1,
                observaciones: sale.observaciones || null,
                export_item_type: sale.export_item_type || null,
                fiscal_enclosure: sale.fiscal_enclosure || null,
                export_regime: sale.export_regime || null,
                dest_country_code: sale.dest_country_code || null,
                remission_type: sale.remission_type || null,
                transporter_name: sale.transporter_name || null,
                vehicle_plate: sale.vehicle_plate || null,
                incoterms: sale.incoterms || '01',
                desc_incoterms: sale.desc_incoterms || 'EXW- En fabrica',
                flete: sale.flete || 0,
                seguro: sale.seguro || 0,
                total_letras: sale.total_letras || ''
            },
            items: items.map(item => ({
                product_id: item.product_id,
                combo_id: item.combo_id || null,
                codigo: item.codigo || null,
                descripcion: item.descripcion,
                nombre: item.descripcion,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                precio: item.precio_unitario,
                monto_descuento: item.monto_descuento || 0,
                descuento: item.monto_descuento || 0,
                venta_gravada: item.venta_gravada || 0,
                venta_exenta: item.venta_exenta || 0,
                exento: item.venta_gravada === 0 && item.venta_exenta > 0,
                tributos: typeof item.tributos === 'string' ? JSON.parse(item.tributos) : (item.tributos || [])
            })),
            payments: payments.map(p => ({
                codigo: p.metodo_pago || '01',
                monto: p.monto,
                referencia: p.referencia || null
            })),
            linkedDocuments: linkedDocs.map(d => ({
                doc_type: d.doc_type || d.tipo_documento || '03',
                generation_type: d.generation_type || 1,
                doc_number: d.doc_number || d.numero_documento || '',
                emission_date: d.emission_date || d.fecha_emision || '',
                montoSujeto: d.monto_sujeto || 0,
                ivaRetenido: d.iva_retenido || 0,
                descripcion: d.descripcion || ''
            })),
            emisor_adicional: {
                descActividad: sale.actividad_economica || 'Actividad no definida',
                codPuntoVentaMH: codPuntoVentaMH
            }
        };

        // Preservar fecha/hora original del DTE si el usuario no solicita actualizarlas
        if (!req.body.updateDateTime && sale.codigo_generacion) {
            const [dteRows] = await pool.query(
                'SELECT json_original FROM dtes WHERE codigo_generacion = ? AND company_id = ?',
                [sale.codigo_generacion, req.company_id]
            );
            if (dteRows.length > 0) {
                const origJson = typeof dteRows[0].json_original === 'string'
                    ? JSON.parse(dteRows[0].json_original) : dteRows[0].json_original;
                if (origJson?.identificacion?.fecEmi && origJson?.identificacion?.horEmi) {
                    dtePayload.identificacionExtra = {
                        fecEmi: origJson.identificacion.fecEmi,
                        horEmi: origJson.identificacion.horEmi
                    };
                }
            }
        }

        console.log(`[SalesController] Regenerando DTE para venta ${id} con ambiente ${sale.ambiente || 'test'}`);
        const dteResult = await dteService.emitDTE(sale, dtePayload, id);

        if (!dteResult.success || dteResult.skip) {
            return res.status(400).json({
                success: false,
                message: dteResult.error || 'Error al regenerar DTE'
            });
        }

        const dteInfo = dteResult.data;

        connection = await pool.getConnection();
        await connection.query(
            'UPDATE sales_headers SET codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
            [dteInfo.codigo_generacion, dteInfo.numero_control, dteInfo.sello_recepcion || null, dteInfo.fh_procesamiento || null, id]
        );
        connection.release();
        connection = null;

        res.json({
            success: true,
            message: 'DTE regenerado exitosamente',
            codigoGeneracion: dteInfo.codigo_generacion,
            numeroControl: dteInfo.numero_control,
            ambiente: sale.ambiente || 'test'
        });
    } catch (error) {
        console.error('Error en regenerateDTE:', error);
        res.status(500).json({ message: 'Error al regenerar DTE', error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

const editDTEItems = async (req, res) => {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
        return res.status(400).json({ message: 'items es requerido' });
    }

    try {
        const [sales] = await pool.query(
            `SELECT h.*, COALESCE(d_v.status, d_c.status) as dte_status, COALESCE(d_v.json_original, d_c.json_original) as json_original
             FROM sales_headers h
             LEFT JOIN dtes d_v ON d_v.venta_id = h.id AND d_v.company_id = h.company_id
             LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
             WHERE h.id = ? AND h.company_id = ? AND (d_v.id IS NOT NULL OR d_c.id IS NOT NULL)`,
            [id, req.company_id]
        );

        if (sales.length === 0) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const sale = sales[0];

        if (sale.estado === 'anulado') {
            return res.status(400).json({ message: 'La venta está anulada' });
        }

        if (sale.dte_status !== 'ACCEPTED') {
            return res.status(400).json({ message: 'Solo se pueden editar DTE aceptados' });
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [existingItems] = await connection.query(
                'SELECT id, codigo FROM sales_items WHERE sale_id = ? ORDER BY id ASC',
                [id]
            );

            const existingWithoutCodigo = existingItems.filter(i => !i.codigo);
            const existingIds = existingWithoutCodigo.map(i => i.id);

            const incomingIds = items
                .filter(i => i.sales_item_id)
                .map(i => i.sales_item_id);

            const toDelete = existingIds.filter(eid => !incomingIds.includes(eid));

            // Delete removed items
            if (toDelete.length > 0) {
                await connection.query(
                    `DELETE FROM sales_items WHERE id IN (${toDelete.map(() => '?').join(',')}) AND codigo IS NULL`,
                    toDelete
                );
            }

            // Update existing items without codigo
            for (const item of items) {
                if (item.sales_item_id) {
                    await connection.query(
                        `UPDATE sales_items SET descripcion = ? WHERE id = ? AND codigo IS NULL AND sale_id = ?`,
                        [item.descripcion, item.sales_item_id, id]
                    );
                }
            }

            // Insert new items without codigo
            for (const item of items) {
                if (!item.sales_item_id) {
                    await connection.query('INSERT INTO sales_items SET ?', [{
                        sale_id: parseInt(id),
                        product_id: null,
                        codigo: null,
                        descripcion: item.descripcion,
                        cantidad: item.cantidad || 1,
                        precio_unitario: 0,
                        monto_descuento: 0,
                        venta_gravada: 0,
                        venta_exenta: 0,
                        tributos: '[]'
                    }]);
                }
            }

            // Read updated items
            const [updatedItems] = await connection.query(
                'SELECT * FROM sales_items WHERE sale_id = ? ORDER BY id ASC',
                [id]
            );

            // Update json_original
            const json = typeof sale.json_original === 'string' ? JSON.parse(sale.json_original) : sale.json_original;
            const originalCuerpo = json.cuerpoDocumento || [];

            const origWithCodigo = [];
            const origWithoutCodigo = [];
            originalCuerpo.forEach((entry) => {
                if (entry.codigo) {
                    origWithCodigo.push(entry);
                } else {
                    origWithoutCodigo.push(entry);
                }
            });

            const updWithCodigo = [];
            const updWithoutCodigo = [];
            updatedItems.forEach(item => {
                if (item.codigo) {
                    updWithCodigo.push(item);
                } else {
                    updWithoutCodigo.push(item);
                }
            });

            const newCuerpo = [];
            let withIdx = 0;
            let withoutIdx = 0;

            for (const origEntry of originalCuerpo) {
                if (origEntry.codigo) {
                    const upd = updWithCodigo[withIdx];
                    if (upd) {
                        newCuerpo.push({ ...origEntry });
                    }
                    withIdx++;
                } else {
                    const upd = updWithoutCodigo[withoutIdx];
                    if (upd) {
                        newCuerpo.push({
                            ...origEntry,
                            descripcion: upd.descripcion,
                            cantidad: parseFloat(upd.cantidad),
                        });
                    }
                    withoutIdx++;
                }
            }

            // Append new items not in original
            while (withoutIdx < updWithoutCodigo.length) {
                const upd = updWithoutCodigo[withoutIdx];
                newCuerpo.push({
                    numItem: 0,
                    tipoItem: 1,
                    numeroDocumento: null,
                    codigo: null,
                    codTributo: null,
                    descripcion: upd.descripcion,
                    cantidad: parseFloat(upd.cantidad),
                    uniMedida: 59,
                    precioUni: 0,
                    montoDescu: 0,
                    ventaNoSuj: 0,
                    ventaExenta: 0,
                    ventaGravada: 0,
                    tributos: null,
                    psv: 0,
                    noGravado: 0
                });
                withoutIdx++;
            }

            newCuerpo.forEach((entry, idx) => { entry.numItem = idx + 1; });
            json.cuerpoDocumento = newCuerpo;

            await connection.query(
                'UPDATE dtes SET json_original = ? WHERE venta_id = ? AND company_id = ?',
                [JSON.stringify(json), id, req.company_id]
            );

            await connection.commit();
            connection.release();

            // Send email asynchronously
            mailerService.sendDTEEmail(id, req.company_id).catch(err => {
                console.error('[editDTEItems] Error sending email:', err);
            });

            res.json({ success: true, message: 'Items actualizados correctamente' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (error) {
        console.error('[editDTEItems] Error:', error);
        res.status(500).json({ message: 'Error al editar items del DTE', error: error.message });
    }
};

const getPublicDTEInfo = async (req, res) => {
    const { codigo } = req.params;
    try {
        const [dte] = await pool.query(
            `SELECT d.tipo_dte, d.numero_control, d.status, d.ambiente, d.sello_recepcion, d.fh_procesamiento,
                    h.fecha_emision, h.total_pagar,
                    comp.razon_social as company_name,
                    b.nombre as branch_name,
                    COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as receptor_nombre,
                    c.nit as receptor_nit, c.nrc as receptor_nrc,
                    c.direccion as receptor_direccion
             FROM dtes d
             LEFT JOIN sales_headers h ON d.codigo_generacion = h.codigo_generacion
             LEFT JOIN companies comp ON h.company_id = comp.id
             LEFT JOIN branches b ON h.branch_id = b.id
             LEFT JOIN customers c ON h.customer_id = c.id
             WHERE d.codigo_generacion = ?`,
            [codigo]
        );
        if (dte.length === 0) {
            return res.status(404).json({ encontrado: false, message: 'DTE no encontrado' });
        }
        res.json({ encontrado: true, ...dte[0] });
    } catch (error) {
        console.error('[GetPublicDTEInfo] Error:', error);
        res.status(500).json({ message: 'Error al obtener información del DTE' });
    }
};

const getPublicDTEJson = async (req, res) => {
    const { codigo } = req.params;
    try {
        const [dte] = await pool.query(
            'SELECT json_original, numero_control FROM dtes WHERE codigo_generacion = ?',
            [codigo]
        );
        if (dte.length === 0) {
            return res.status(404).json({ message: 'DTE no encontrado' });
        }
        const json = typeof dte[0].json_original === 'string' ? JSON.parse(dte[0].json_original) : dte[0].json_original;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=DTE-${dte[0].numero_control}.json`);
        res.json(json);
    } catch (error) {
        console.error('[GetPublicDTEJson] Error:', error);
        res.status(500).json({ message: 'Error al obtener JSON del DTE' });
    }
};

const sendPublicDTEEmail = async (req, res) => {
    const { codigo } = req.params;
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'El correo electrónico es requerido' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT h.*, d.status as dte_status, d.json_original, d.sello_recepcion, d.numero_control,
                    c.razon_social as company_name, c.nit as company_nit, c.nrc as company_nrc,
                    b.nombre as branch_name, cat.description as tipo_documento_name
             FROM dtes d
             JOIN sales_headers h ON d.codigo_generacion = h.codigo_generacion
             JOIN companies c ON h.company_id = c.id
             JOIN branches b ON h.branch_id = b.id
             LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
             WHERE d.codigo_generacion = ?`,
            [codigo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'DTE no encontrado' });
        }

        const venta = rows[0];
        const dteJson = typeof venta.json_original === 'string' ? JSON.parse(venta.json_original) : venta.json_original;

        if (!dteJson) {
            return res.status(400).json({ message: 'El DTE no tiene JSON original' });
        }

        const dteNames = {
            '01': 'Factura', '03': 'Crédito Fiscal', '04': 'Nota de Remisión',
            '05': 'Nota de Crédito', '06': 'Nota de Débito', '07': 'Comprobante de Retención',
            '08': 'Comprobante de Liquidación', '09': 'Documento Contable de Liquidación',
            '11': 'Factura de Exportación', '14': 'Factura de Sujeto Excluido', '15': 'Comprobante de Donación'
        };
        const tipoNombre = dteNames[venta.tipo_documento] || 'Documento Tributario';

        const reportData = {
            emisor: {
                nombre: venta.company_name,
                nit: venta.company_nit,
                nrc: venta.company_nrc,
                descActividad: dteJson.emisor?.descActividad,
                direccion: dteJson.emisor?.direccion,
                telefono: dteJson.emisor?.telefono,
                correo: dteJson.emisor?.correo,
                departamento_nombre: 'SS',
                municipio_nombre: 'SS'
            },
            receptor: {
                nombre: dteJson.receptor?.nombre,
                nit: dteJson.receptor?.nit,
                nrc: dteJson.receptor?.nrc || null,
                numDocumento: dteJson.receptor?.numDocumento,
                direccion: dteJson.receptor?.direccion
            },
            dte: {
                tipoDte: dteJson.identificacion?.tipoDte,
                tipoDteNombre: tipoNombre,
                codigoGeneracion: dteJson.identificacion?.codigoGeneracion,
                numeroControl: venta.numero_control,
                selloRecepcion: venta.sello_recepcion
            },
            venta: {
                fecha_emision: dteJson.identificacion?.fecEmi,
                hora_emision: dteJson.identificacion?.horEmi,
                condicion_operacion: dteJson.resumen?.condicionOperacion,
                total_gravado: dteJson.resumen?.totalGravada || 0,
                total_iva: dteJson.resumen?.totalIva || (dteJson.resumen?.tributos?.find(t => t.codigo === '20')?.valor || 0),
                total_descuento: dteJson.resumen?.descuNoExenta || 0,
                total_pagar: dteJson.resumen?.totalPagar || 0,
                total_letras: dteJson.resumen?.totalLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen?.tributos || []
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || 0
            })),
            isVoided: (venta.estado || '').toLowerCase() === 'anulado' || venta.dte_status === 'INVALIDADO'
        };

        const pdfBuffer = await pdfService.generateRTEE(reportData);

        const smtp = await mailerService.getSMTPSettings(venta.branch_id, venta.company_id);
        const transporter = mailerService.createTransporter(smtp);

        await transporter.sendMail({
            from: `"${smtp.from_name}" <${smtp.from_email}>`,
            to: email,
            subject: `${tipoNombre} Electrónica - ${venta.company_name}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px; max-width: 600px; margin: auto;">
                    <h2 style="color: #4f46e5; text-align: center;">Su documento electrónico está listo</h2>
                    <p>Estimado(a) <b>${dteJson.receptor?.nombre || 'cliente'}</b>,</p>
                    <p>Adjunto encontrará su <b>${tipoNombre}</b> electrónica con número de control <b>${venta.numero_control}</b>.</p>
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
                        <span style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Total a Pagar</span>
                        <div style="font-size: 24px; font-weight: 800; color: #1e293b;">$${parseFloat(venta.total_pagar).toFixed(2)}</div>
                    </div>
                    <p style="font-size: 13px; color: #666;">Se incluyen dos archivos: la representación gráfica (PDF) y el archivo de datos (JSON) para su registro legal.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 11px; color: #94a3b8; text-align: center;">Este es un mensaje automático de ${venta.company_name}.</p>
                </div>
            `,
            attachments: [
                { filename: `DTE-${venta.numero_control}.pdf`, content: pdfBuffer },
                { filename: `DTE-${venta.numero_control}.json`, content: JSON.stringify(dteJson, null, 2) }
            ]
        });

        res.json({ success: true, message: 'Correo enviado correctamente' });
    } catch (error) {
        console.error('[SendPublicDTEEmail] Error:', error);
        res.status(500).json({ message: 'Error al enviar correo', error: error.message });
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
    getPublicRTEE,
    getPublicDTEInfo,
    getPublicDTEJson,
    sendPublicDTEEmail,
    checkExistingCR,
    getContingencyStatus,
    startContingency,
    stopContingency,
    getDTEJson,
    resendDTEEmail,
    editDTEItems,
    voidSale,
    retransmitSaleDTE,
    regenerateDTE,
    listRetornos,
    emitRetorno,
    getRetornoStatus,
    getDTEByCodigoGeneracion
};
