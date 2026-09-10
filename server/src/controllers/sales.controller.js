const mailerService = require('../services/mailer.service');
const pool = require('../config/db');
const dteService = require('../services/dte.service');
const pdfService = require('../services/pdf.service');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getEffectiveProductId } = require('../utils/inventoryUtils');
const excelService = require('../services/excel.service');
const notificationService = require('../services/notification.service');
const { dteValidoExistsSql, dteLatestColSql } = require('../services/dteQueryFilters');
const reportPdfHelper = require('../utils/reportPdfHelper');

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

const FALLBACK_ACTIVIDAD = new Set(['otros', 'otro', 'actividad no definida', 'n/a', '']);

async function resolveActividadOficial(codActividad, descActividad) {
    const desc = (descActividad || '').trim();
    if (!FALLBACK_ACTIVIDAD.has(desc.toLowerCase())) return desc;
    if (!codActividad) return desc;
    try {
        const [rows] = await pool.query('SELECT description FROM cat_019_actividad_economica WHERE code = ?', [String(codActividad).trim()]);
        return rows.length > 0 ? rows[0].description : desc;
    } catch (e) {
        return desc;
    }
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

        // 0b. Validar dirección del cliente seleccionado antes de crear la venta (requisito DTE)
        if (company && company.dte_active && header.customer_id && header.dte_type !== '11') {
            const addressError = await dteService.validateCustomerAddress(header.customer_id, header.customer_branch_id || null);
            if (addressError) {
                await connection.rollback();
                return res.status(400).json({ message: addressError, success: false });
            }
        }

        // 0c. Validar NIT del cliente para Crédito Fiscal (requisito Hacienda)
        if (company && company.dte_active && header.dte_type === '03' && header.customer_id) {
            const [cust] = await connection.query(
                'SELECT nit, nombre FROM customers WHERE id = ? AND company_id = ?',
                [header.customer_id, req.company_id]
            );
            if (cust.length > 0 && !cust[0].nit) {
                await connection.rollback();
                return res.status(400).json({
                    message: `El cliente "${cust[0].nombre}" no tiene NIT registrado. Para emitir Crédito Fiscal (CCF) el cliente debe tener NIT.`,
                    success: false
                });
            }
        }

        // 0d. Validar período de documentos vinculados para Comprobante de Retención (DTE 07)
        if (header.dte_type === '07' || header.tipo_documento === '07') {
            const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
            for (const doc of (linkedDocuments || [])) {
                if (doc.emission_date) {
                    const docDateStr = doc.emission_date instanceof Date 
                        ? doc.emission_date.toISOString().substring(0, 10)
                        : String(doc.emission_date).substring(0, 10);
                    const docPeriod = docDateStr.substring(0, 7);
                    if (docPeriod !== currentPeriod) {
                        await connection.rollback();
                        return res.status(400).json({
                            message: `El documento a retener (${doc.doc_number || 'sin número'}) tiene fecha ${docDateStr} fuera del período tributario actual (${currentPeriod}). Hacienda rechaza comprobantes de retención para documentos de otros meses.`,
                            success: false
                        });
                    }
                }
            }
        }

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
                    generation_type: doc.generation_type || null,
                    monto_sujeto: doc.montoSujeto != null ? doc.montoSujeto : (doc.monto_sujeto || null),
                    iva_retenido: doc.ivaRetenido != null ? doc.ivaRetenido : (doc.iva_retenido || null),
                    descripcion: doc.descripcion || null
                }]);
            }
        }

        // 5. Emitir DTE (después de guardar la venta para evitar DTEs huérfanos)
        let dteInfo = {};
        let dteResult = null;
        if (company && company.dte_active) {
            // Días de crédito del cliente (para operaciones a crédito, condición 2)
            let diasCredito = 15;
            if (header.customer_id) {
                const [custDias] = await connection.query(
                    'SELECT dias_credito FROM customers WHERE id = ? AND company_id = ?',
                    [header.customer_id, req.company_id]
                );
                if (custDias.length > 0 && custDias[0].dias_credito != null) {
                    diasCredito = parseInt(custDias[0].dias_credito) || 15;
                }
            }

            if (!header.branch_id) header.branch_id = req.user.branch_id;
            if (!header.user_id) header.user_id = req.user.id;

            const dtePayload = {
                ...req.body,
                sale_id: saleId,
                header: { ...(req.body.header || {}), dias_credito: diasCredito },
                dias_credito: diasCredito,
                emisor_adicional: {
                    descActividad: company.actividad_economica,
                    codPuntoVentaMH: codPuntoVentaMH
                }
            };

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

        notificationService.notify('sale_created', req.company_id, req.user.branch_id, {
            venta_id: saleResult.insertId,
            cliente_nombre: header.cliente_nombre || 'Cliente Final',
            total: header.total_pagar || 0,
            tipo_dte: dteTypeNames[header.dte_type] || header.dte_type,
            sucursal: req.branch_name || ''
        }).catch(() => {});

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
    const { 
        page = 1, 
        limit = 15, 
        dte_type, 
        tipo_documento,
        start_date, 
        end_date, 
        search = '', 
        customer_id, 
        status, 
        dte_status,
        branch_id,
        only_processed, 
        exclude_has_nc, 
        shift_id, 
        has_dte 
    } = req.query;
    const offset = (page - 1) * limit;

    try {
        let whereClause = ' WHERE h.company_id = ?';
        const whereParams = [req.company_id];

        if (req.user.branch_id) {
            whereClause += ' AND h.branch_id = ?';
            whereParams.push(req.user.branch_id);
        } else if (branch_id && branch_id !== 'all') {
            whereClause += ' AND h.branch_id = ?';
            whereParams.push(branch_id);
        }

        if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            whereClause += ' AND (c.nombre LIKE ? OR h.cliente_nombre LIKE ? OR h.numero_control LIKE ? OR h.codigo_generacion LIKE ? OR c.nit LIKE ? OR c.numero_documento LIKE ?)';
            whereParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        const docType = tipo_documento || dte_type;
        if (docType && docType !== 'all') {
            whereClause += ' AND (h.tipo_documento = ? OR h.dte_type = ?)';
            whereParams.push(docType, docType);
        }

        if (start_date && end_date) {
            whereClause += ' AND h.fecha_emision BETWEEN ? AND ?';
            whereParams.push(start_date, end_date);
        } else if (start_date) {
            whereClause += ' AND h.fecha_emision >= ?';
            whereParams.push(start_date);
        } else if (end_date) {
            whereClause += ' AND h.fecha_emision <= ?';
            whereParams.push(end_date);
        }

        if (customer_id) {
            whereClause += ' AND h.customer_id = ?';
            whereParams.push(customer_id);
        }

        if (shift_id) {
            whereClause += ' AND h.shift_id = ?';
            whereParams.push(shift_id);
        }

        if (has_dte === 'true') {
            whereClause += ' AND (d_c.id IS NOT NULL OR d_v.id IS NOT NULL)';
        }

        const effectiveStatus = status || dte_status;
        if (effectiveStatus && effectiveStatus !== 'all') {
            if (effectiveStatus === 'ACCEPTED') {
                whereClause += " AND ((d_c.status = 'ACCEPTED' OR d_v.status = 'ACCEPTED') AND h.estado NOT IN ('invalidado', 'anulado'))";
            } else if (effectiveStatus === 'REJECTED') {
                whereClause += " AND (d_c.status = 'REJECTED' OR d_v.status = 'REJECTED')";
            } else if (effectiveStatus === 'INVALIDADO' || effectiveStatus === 'anulado') {
                whereClause += " AND (h.estado IN ('invalidado', 'anulado') OR d_c.status = 'INVALIDADO' OR d_v.status = 'INVALIDADO')";
            } else if (effectiveStatus === 'PENDING') {
                whereClause += " AND ((d_c.id IS NULL AND d_v.id IS NULL) OR COALESCE(d_c.status, d_v.status) NOT IN ('ACCEPTED', 'REJECTED', 'INVALIDADO')) AND h.estado NOT IN ('invalidado', 'anulado')";
            } else {
                whereClause += ' AND h.estado = ?';
                whereParams.push(effectiveStatus);
            }
        }

        if (only_processed === 'true') {
            whereClause += " AND (d_c.status = 'ACCEPTED' OR d_v.status = 'ACCEPTED')";
        }

        if (exclude_has_nc === 'true') {
            whereClause += ` AND NOT EXISTS (
                SELECT 1 FROM sales_linked_documents ld 
                JOIN sales_headers h2 ON ld.sale_id = h2.id 
                WHERE h2.tipo_documento = '05' AND h2.estado = 'emitido'
                AND (
                    (ld.doc_number = h.codigo_generacion COLLATE utf8mb4_unicode_ci AND h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '') OR 
                    (ld.doc_number = h.numero_control COLLATE utf8mb4_unicode_ci AND h.numero_control IS NOT NULL AND h.numero_control != '') OR 
                    (ld.doc_number = d_c.numero_control COLLATE utf8mb4_unicode_ci AND d_c.numero_control IS NOT NULL AND d_c.numero_control != '') OR
                    (ld.doc_number = d_v.numero_control COLLATE utf8mb4_unicode_ci AND d_v.numero_control IS NOT NULL AND d_v.numero_control != '') OR
                    (ld.doc_number = CAST(h.id AS CHAR) COLLATE utf8mb4_unicode_ci)
                )
            )`;
        }

        const sql = `
            SELECT h.*, s.nombre as seller_name, p.nombre as pos_name, b.nombre as branch_name, c.correo as customer_email,
            c.nit as customer_nit, c.nrc as customer_nrc, c.numero_documento as customer_dui,
            COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as customer_name,
            COALESCE(d_c.status, d_v.status) as dte_status, COALESCE(d_c.numero_control, d_v.numero_control) as dte_control, COALESCE(d_c.ambiente, d_v.ambiente, '00') as dte_ambiente, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as dte_error,
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
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
            LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
            ${whereClause}
            ORDER BY h.fecha_emision DESC, h.hora_emision DESC
            LIMIT ? OFFSET ?
        `;
        const params = [...whereParams, parseInt(limit), parseInt(offset)];

        const countSql = `
            SELECT COUNT(*) as total 
            FROM sales_headers h 
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
            LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
            ${whereClause}
        `;
        const countParams = [...whereParams];

        const [rows] = await pool.query(sql, params);
        const [totalRows] = await pool.query(countSql, countParams);

        const totalItems = totalRows[0]?.total || 0;

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
            COALESCE(NULLIF(TRIM(cb.direccion), ''), c.direccion) as customer_address,
            cb.nombre as customer_branch_name,
            COALESCE(NULLIF(TRIM(cb.departamento), ''), c.departamento) as customer_departamento,
            COALESCE(NULLIF(TRIM(cb.municipio), ''), c.municipio) as customer_municipio,
            COALESCE(NULLIF(TRIM(cb.distrito), ''), c.distrito) as customer_distrito,
            c.nit as customer_nit, c.nrc as customer_nrc, c.numero_documento as customer_dui,
            comp.nit as company_nit,
            COALESCE(d_c.status, d_v.status) as dte_status, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as dte_error, COALESCE(d_c.json_original, d_v.json_original) as json_original, COALESCE(d_c.sello_recepcion, d_v.sello_recepcion) as sello_recepcion, COALESCE(d_c.fh_procesamiento, d_v.fh_procesamiento) as fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN customer_branches cb ON h.customer_branch_id = cb.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN branches b ON h.branch_id = b.id
            LEFT JOIN companies comp ON h.company_id = comp.id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
            LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
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
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
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
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
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
        const companyInfo = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 2. Obtener datos (Total periodo)
        let totalSalesSql = `SELECT SUM(si.cantidad * si.precio_unitario) as total_periodo FROM sales_headers h JOIN sales_items si ON h.id = si.sale_id WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido' AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')`;
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
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
        `;
        const params = [grandTotal, companyId];
        if (start_date && end_date) { sql += ' AND h.fecha_emision BETWEEN ? AND ?'; params.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { sql += ' AND h.branch_id = ?'; params.push(branch_id); }
        sql += ' GROUP BY COALESCE(c.id, 0), COALESCE(c.name, "Sin Categoría") ORDER BY total_venta DESC';

        const [categories] = await pool.query(sql, params);

        let reportData = {
            company_id: companyId,
            company: companyInfo,
            company_name: companyInfo.razon_social,
            company_nit: companyInfo.nit,
            company_nrc: companyInfo.nrc,
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
                AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
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
                COALESCE(d.numero_control, h.numero_control, CONCAT('VTA-', h.id)) as documento,
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
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
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
        const company = await reportPdfHelper.getCompanyInfo(companyId);
        const companyName = company.razon_social || company.nombre_comercial || 'Empresa';

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
                COALESCE(d.numero_control, h.numero_control, CONCAT('VTA-', h.id)) as documento,
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
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
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
            company_id: companyId,
            company: company,
            company_name: companyName,
            company_nit: company.nit,
            company_nrc: company.nrc,
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
                        { header: 'Cliente', key: 'cliente', width: 35 },
                        { header: 'Tipo Doc', key: 'tipo', width: 16 },
                        { header: 'Documento', key: 'documento', width: 34 },
                        { header: 'Condición', key: 'condicion', width: 14 },
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
 * Exporta el reporte de ventas por cliente en formato PDF/Excel.
 * Formato similar a ventas diarias, filtrado por cliente, detallando
 * los productos de cada venta y mostrando el cliente en el encabezado.
 */
const exportSalesByCustomerPDF = async (req, res) => {
    try {
        const { customer_id, start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) {
            return res.status(401).json({ message: 'No se pudo identificar la empresa' });
        }

        if (!customer_id) {
            return res.status(400).json({ message: 'El cliente es requerido' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        // 1. Datos del cliente (encabezado del reporte)
        const [customerRows] = await pool.query(
            'SELECT * FROM customers WHERE id = ? AND company_id = ?',
            [customer_id, companyId]
        );
        if (customerRows.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        const customer = customerRows[0];

        // 2. Info de Empresa y Sucursal
        const company = await reportPdfHelper.getCompanyInfo(companyId);
        const companyName = company.razon_social || company.nombre_comercial || 'Empresa';

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        // 3. Consulta de detalle (productos por venta del cliente)
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
                COALESCE(p.descripcion, si.descripcion) as producto,
                si.cantidad,
                ROUND(COALESCE(si.venta_gravada, 0) + COALESCE(si.venta_exenta, 0) + ROUND(COALESCE(si.venta_gravada, 0) * 0.13, 2), 2) as total
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.customer_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId, customer_id];

        sql += ' AND h.fecha_emision BETWEEN ? AND ?';
        params.push(start_date, end_date);

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        sql += ' ORDER BY h.fecha_emision ASC, h.id ASC, si.id ASC';

        const [rows] = await pool.query(sql, params);

        // 4. Totales (desde las cabeceras de venta)
        let totalsSql = `
            SELECT 
                SUM(h.total_gravado) as gravadas,
                SUM(h.total_exento) as exentas,
                SUM(h.total_iva) as iva,
                SUM(h.fovial) as fovial,
                SUM(h.cotrans) as cotrans,
                SUM(h.iva_retenido) as retencion,
                SUM(h.iva_percibido) as percepcion,
                SUM(h.total_pagar) as total
            FROM sales_headers h
            LEFT JOIN dtes d ON h.id = d.venta_id
            WHERE h.company_id = ? AND h.customer_id = ? AND LOWER(h.estado) = 'emitido'
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
            AND h.fecha_emision BETWEEN ? AND ?
        `;
        const totalsParams = [companyId, customer_id, start_date, end_date];
        if (branch_id && branch_id !== 'all') {
            totalsSql += ' AND h.branch_id = ?';
            totalsParams.push(branch_id);
        }
        const [totalsRows] = await pool.query(totalsSql, totalsParams);
        const totals = totalsRows[0] || {};

        // 5. Datos para el reporte
        const total_cantidad = rows.reduce((acc, r) => acc + parseFloat(r.cantidad || 0), 0);
        const reportData = {
            company_id: companyId,
            company: company,
            company_name: companyName,
            company_nit: company.nit,
            company_nrc: company.nrc,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            customer: {
                nombre: customer.nombre,
                nombre_comercial: customer.nombre_comercial || null,
                nit: customer.nit || null,
                nrc: customer.nrc || null,
                telefono: customer.telefono || null,
                correo: customer.correo || null,
                direccion: customer.direccion || null,
                departamento: customer.departamento || null,
                municipio: customer.municipio || null
            },
            sales: rows,
            total_cantidad,
            total_gravadas: parseFloat(totals.gravadas || 0),
            total_exentas: parseFloat(totals.exentas || 0),
            total_iva: parseFloat(totals.iva || 0),
            total_fovial: parseFloat(totals.fovial || 0),
            total_cotrans: parseFloat(totals.cotrans || 0),
            total_retencion: parseFloat(totals.retencion || 0),
            total_percepcion: parseFloat(totals.percepcion || 0),
            total_general: parseFloat(totals.total || 0)
        };

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Ventas por Cliente',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Tipo Doc', key: 'tipo', width: 16 },
                        { header: 'Documento', key: 'documento', width: 20 },
                        { header: 'Producto', key: 'producto', width: 35 },
                        { header: 'Cantidad', key: 'cantidad', width: 12 },
                        { header: 'Total', key: 'total', width: 16 },
                    ],
                    data: rows.map(r => ({
                        fecha: new Date(r.fecha).toLocaleDateString('es-SV'),
                        tipo: r.tipo,
                        documento: r.documento,
                        producto: r.producto,
                        cantidad: parseFloat(r.cantidad || 0).toFixed(2),
                        total: parseFloat(r.total || 0).toFixed(2),
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Ventas_por_Cliente_${start_date}_al_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateSalesByCustomerPDF(reportData);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=reporte-ventas-por-cliente.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[ExportSalesByCustomerPDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de ventas por cliente', error: error.message });
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
        const company = await reportPdfHelper.getCompanyInfo(companyId);

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
            AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id AND status = 'INVALIDADO')
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

        let branchName = 'TODAS LAS SUCURSALES';
        if (branch_id && branch_id !== 'all' && rows.length > 0) {
            branchName = (rows[0].branch_nombre || '').toUpperCase();
        } else if (branch_id && branch_id !== 'all') {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (bRows.length > 0) branchName = (bRows[0].nombre || '').toUpperCase();
        }

        const periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;
        const subtitle = `SUCURSAL: ${branchName}`;

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732; // 792 - 60

        reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);

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
            doc.text('No se encontraron ventas en el período seleccionado.', startX, currentY + 10);
            currentY += 30;
        } else {
            let currentCustomer = null;
            let cTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            let gTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };

            const printSubtotal = () => {
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.tipoDoc + colW.numero, currentY).lineTo(startX + contentWidth, currentY).stroke();
                currentY += 2;
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('SUBTOTAL:', startX + colW.fecha + colW.tipoDoc, currentY, { width: colW.numero, align: 'right' });
                let sx = startX + colW.fecha + colW.tipoDoc + colW.numero + colW.condicion;
                doc.text(reportPdfHelper.fmt(cTotals.grav), sx, currentY, { width: colW.gravada, align: 'right' }); sx += colW.gravada;
                doc.text(reportPdfHelper.fmt(cTotals.exe), sx, currentY, { width: colW.exenta, align: 'right' }); sx += colW.exenta;
                doc.text(reportPdfHelper.fmt(cTotals.iva), sx, currentY, { width: colW.iva, align: 'right' }); sx += colW.iva;
                doc.text(reportPdfHelper.fmt(cTotals.ret), sx, currentY, { width: colW.ret, align: 'right' }); sx += colW.ret;
                doc.text(reportPdfHelper.fmt(cTotals.per), sx, currentY, { width: colW.per, align: 'right' }); sx += colW.per;
                doc.text(reportPdfHelper.fmt(cTotals.fov), sx, currentY, { width: colW.fov, align: 'right' }); sx += colW.fov;
                doc.text(reportPdfHelper.fmt(cTotals.cot), sx, currentY, { width: colW.cot, align: 'right' }); sx += colW.cot;
                doc.text(reportPdfHelper.fmt(cTotals.total), sx, currentY, { width: colW.total - 6, align: 'right' });
                currentY += 15;
                cTotals = { grav: 0, exe: 0, iva: 0, ret: 0, per: 0, fov: 0, cot: 0, total: 0 };
            };

            for (const row of rows) {
                if (currentY > 520) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                if (row.customer_name !== currentCustomer) {
                    if (currentCustomer !== null) {
                        printSubtotal();
                    }
                    if (currentY > 520) {
                        doc.addPage();
                        reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);
                        currentY = drawTableHeader(doc.y + 4);
                    }
                    doc.rect(startX, currentY, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`CLIENTE: ${row.customer_name}`, startX + 4, currentY + 3);
                    currentY += 16;
                    currentCustomer = row.customer_name;
                }

                doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                let lx = startX + 4;
                doc.text(reportPdfHelper.formatDate(row.fecha_emision), lx, currentY, { width: colW.fecha }); lx += colW.fecha;
                doc.text((row.tipo_doc_nombre || '---').substring(0, 16), lx, currentY, { width: colW.tipoDoc }); lx += colW.tipoDoc;
                doc.text(String(row.numero_control || `VTA-${row.id}`), lx, currentY, { width: colW.numero }); lx += colW.numero;
                doc.text((row.condicion_nombre || 'CONTADO').substring(0, 10), lx, currentY, { width: colW.condicion }); lx += colW.condicion;

                const grav = parseFloat(row.total_gravado || 0);
                const exe = parseFloat(row.total_exento || 0);
                const iva = parseFloat(row.total_iva || 0);
                const ret = parseFloat(row.iva_retenido || 0);
                const per = parseFloat(row.iva_percibido || 0);
                const fov = parseFloat(row.fovial || 0);
                const cot = parseFloat(row.cotrans || 0);
                const tot = parseFloat(row.total_pagar || 0);

                doc.text(reportPdfHelper.fmt(grav), lx, currentY, { width: colW.gravada, align: 'right' }); lx += colW.gravada;
                doc.text(reportPdfHelper.fmt(exe), lx, currentY, { width: colW.exenta, align: 'right' }); lx += colW.exenta;
                doc.text(reportPdfHelper.fmt(iva), lx, currentY, { width: colW.iva, align: 'right' }); lx += colW.iva;
                doc.text(reportPdfHelper.fmt(ret), lx, currentY, { width: colW.ret, align: 'right' }); lx += colW.ret;
                doc.text(reportPdfHelper.fmt(per), lx, currentY, { width: colW.per, align: 'right' }); lx += colW.per;
                doc.text(reportPdfHelper.fmt(fov), lx, currentY, { width: colW.fov, align: 'right' }); lx += colW.fov;
                doc.text(reportPdfHelper.fmt(cot), lx, currentY, { width: colW.cot, align: 'right' }); lx += colW.cot;
                doc.text(reportPdfHelper.fmt(tot), lx, currentY, { width: colW.total - 6, align: 'right' });

                cTotals.grav += grav;
                cTotals.exe += exe;
                cTotals.iva += iva;
                cTotals.ret += ret;
                cTotals.per += per;
                cTotals.fov += fov;
                cTotals.cot += cot;
                cTotals.total += tot;

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

            if (currentCustomer !== null) {
                printSubtotal();
            }

            if (currentY > 520) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Reporte de Ventas (Detallado)', periodText, 'landscape', subtitle);
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

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, rows.length, 'Ventas');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.send(buffer);

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
    const { start_date, end_date, branch_id, pos_ids } = req.query;
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
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
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
        if (pos_ids) {
            const ids = pos_ids.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (ids.length > 0) sql += ` AND h.pos_id IN (${ids.join(',')})`;
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
        const { start_date, end_date, branch_id, pos_ids } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const company = await reportPdfHelper.getCompanyInfo(companyId);

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
            AND (d.status IS NULL OR d.status != 'INVALIDADO')
        `;
        const params = [companyId];
        if (start_date && end_date) { sql += ' AND h.fecha_emision BETWEEN ? AND ?'; params.push(start_date, end_date); }
        if (branch_id && branch_id !== 'all') { sql += ' AND h.branch_id = ?'; params.push(branch_id); }
        if (pos_ids) {
            const ids = pos_ids.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (ids.length > 0) sql += ` AND h.pos_id IN (${ids.join(',')})`;
        }
        sql += ' ORDER BY p.nombre, h.fecha_emision, h.id';

        const [rows] = await pool.query(sql, params);

        const reportData = {
            company_id: companyId,
            company: company,
            company_name: company.razon_social,
            company_nit: company.nit,
            company_nrc: company.nrc,
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

const IVA_DOC_TYPES = ['01', '03', '05', '06', '08', '09'];

const parseItemTributos = (raw) => {
    let arr = [];
    try {
        arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    } catch (e) {
        arr = [];
    }
    let fovial = 0;
    let cotrans = 0;
    (arr || []).forEach(t => {
        if (!t || typeof t !== 'object') return;
        if (t.codigo === 'D1') fovial += parseFloat(t.valor) || 0;
        if (t.codigo === 'C8') cotrans += parseFloat(t.valor) || 0;
    });
    return { fovial, cotrans };
};

const fmtDate = (d) => {
    if (!d) return '---';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '---';
    return date.toLocaleDateString('es-SV');
};

const fmtMoney = (v) => {
    const n = parseFloat(v) || 0;
    return `$${n.toFixed(2)}`;
};

/**
 * Reporte "Detalle de Facturación" - líneas de detalle por documento DTE.
 * Params: start_date, end_date, branch_id, pos_ids, format=excel
 */
const exportSalesDetailPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, pos_ids } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas es requerido' });
        }

        const [companyRows] = await pool.query('SELECT razon_social, nit FROM companies WHERE id = ?', [companyId]);
        const company = companyRows[0] || { razon_social: 'EMPRESA', nit: '' };

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (branchRows.length > 0) branchName = branchRows[0].nombre;
        }

        let posFilter = '';
        let posIds = [];
        if (pos_ids) {
            posIds = pos_ids.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
            if (posIds.length > 0) posFilter = ` AND h.pos_id IN (${posIds.join(',')})`;
        }

        let posLabel = 'Todos los puntos de venta';
        if (posIds.length > 0) {
            const [posRows] = await pool.query(
                `SELECT nombre FROM points_of_sale WHERE id IN (${posIds.join(',')})`
            );
            posLabel = posRows.map(p => p.nombre).join(', ');
        }

        // Detalle por línea
        let sql = `
            SELECT
                h.fecha_emision,
                h.tipo_documento,
                cat.description AS tipo_dte,
                COALESCE(${dteLatestColSql('h', 'numero_control')}, CONCAT('VTA-', h.id)) AS numero_control,
                COALESCE(c.nombre, h.cliente_nombre, 'CONSUMIDOR FINAL') AS cliente,
                COALESCE(si.codigo, p.codigo, '') AS codigo_producto,
                COALESCE(si.descripcion, p.descripcion, '') AS descripcion,
                si.cantidad,
                si.precio_unitario,
                si.venta_gravada,
                si.venta_exenta,
                si.tributos
            FROM sales_headers h
            JOIN sales_items si ON h.id = si.sale_id
            LEFT JOIN products p ON si.product_id = p.id
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND ${dteValidoExistsSql('h')}
            AND h.fecha_emision BETWEEN ? AND ?
        `;
        const params = [companyId, start_date, end_date];

        if (branch_id && branch_id !== 'all') {
            sql += ' AND h.branch_id = ?';
            params.push(branch_id);
        }
        sql += posFilter;
        sql += ' ORDER BY h.fecha_emision ASC, h.id ASC, si.id ASC';

        const [rows] = await pool.query(sql, params);

        // Totales autoritativos desde las cabeceras
        let totalsSql = `
            SELECT
                COUNT(DISTINCT h.id) AS num_documentos,
                SUM(h.total_iva) AS iva,
                SUM(h.fovial) AS fovial,
                SUM(h.cotrans) AS cotrans,
                SUM(h.total_pagar) AS total
            FROM sales_headers h
            WHERE h.company_id = ? AND LOWER(h.estado) = 'emitido'
            AND ${dteValidoExistsSql('h')}
            AND h.fecha_emision BETWEEN ? AND ?
        `;
        const totalsParams = [companyId, start_date, end_date];
        if (branch_id && branch_id !== 'all') {
            totalsSql += ' AND h.branch_id = ?';
            totalsParams.push(branch_id);
        }
        totalsSql += posFilter;
        const [totalsRows] = await pool.query(totalsSql, totalsParams);
        const totals = totalsRows[0] || {};

        const details = rows.map((r) => {
            const { fovial, cotrans } = parseItemTributos(r.tributos);
            const gravada = parseFloat(r.venta_gravada) || 0;
            const exenta = parseFloat(r.venta_exenta) || 0;
            const cantidad = parseFloat(r.cantidad) || 0;
            const precio = parseFloat(r.precio_unitario) || 0;
            const tipoDoc = String(r.tipo_documento || '');
            const iva = IVA_DOC_TYPES.includes(tipoDoc) ? Math.round(gravada * (13 / 113) * 100) / 100 : 0;
            return {
                fecha: fmtDate(r.fecha_emision),
                tipo_dte: String(r.tipo_dte || getDteTypeName(tipoDoc) || '---'),
                numero_control: String(r.numero_control || '---'),
                cliente: String(r.cliente || 'CONSUMIDOR FINAL').toUpperCase(),
                codigo_producto: String(r.codigo_producto || ''),
                descripcion: String(r.descripcion || ''),
                cantidad,
                precio,
                iva,
                fovial,
                cotrans,
                total: gravada + exenta + fovial + cotrans
            };
        });

        let lineTotals = { cantidad: 0, iva: 0, fovial: 0, cotrans: 0, total: 0 };
        details.forEach(d => {
            lineTotals.cantidad += d.cantidad;
            lineTotals.iva += d.iva;
            lineTotals.fovial += d.fovial;
            lineTotals.cotrans += d.cotrans;
            lineTotals.total += d.total;
        });

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Detalle Facturación',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Tipo DTE', key: 'tipo_dte', width: 18 },
                        { header: 'N° Control', key: 'numero_control', width: 22 },
                        { header: 'Cliente', key: 'cliente', width: 30 },
                        { header: 'Código Producto', key: 'codigo_producto', width: 16 },
                        { header: 'Descripción', key: 'descripcion', width: 35 },
                        { header: 'Cantidad', key: 'cantidad', width: 10 },
                        { header: 'Precio', key: 'precio', width: 12 },
                        { header: 'IVA', key: 'iva', width: 12 },
                        { header: 'FOVIAL', key: 'fovial', width: 12 },
                        { header: 'COTRANS', key: 'cotrans', width: 12 },
                        { header: 'Total', key: 'total', width: 14 }
                    ],
                    data: details.map(d => ({
                        fecha: d.fecha,
                        tipo_dte: d.tipo_dte,
                        numero_control: d.numero_control,
                        cliente: d.cliente,
                        codigo_producto: d.codigo_producto,
                        descripcion: d.descripcion,
                        cantidad: d.cantidad.toFixed(5),
                        precio: d.precio.toFixed(2),
                        iva: d.iva.toFixed(2),
                        fovial: d.fovial.toFixed(2),
                        cotrans: d.cotrans.toFixed(2),
                        total: d.total.toFixed(2)
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Detalle_Facturacion_${start_date}_al_${end_date}.xlsx`);
        }

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732;

        const periodText = `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;
        const subtitle = `SUCURSAL: ${branchName}   |   PUNTOS DE VENTA: ${posLabel}`;

        reportPdfHelper.renderHeader(doc, company, 'Detalle de Facturación', periodText, 'landscape', subtitle);

        const colW = {
            fecha: 46,
            tipoDte: 62,
            control: 110,
            cliente: 115,
            codigo: 55,
            desc: 110,
            cant: 44,
            precio: 46,
            iva: 44,
            fov: 38,
            cot: 38,
            tot: 54
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('FECHA', x, yPos + 3); x += colW.fecha;
            doc.text('TIPO DTE', x, yPos + 3); x += colW.tipoDte;
            doc.text('N° CONTROL', x, yPos + 3); x += colW.control;
            doc.text('CLIENTE', x, yPos + 3); x += colW.cliente;
            doc.text('CÓDIGO', x, yPos + 3); x += colW.codigo;
            doc.text('DESCRIPCIÓN', x, yPos + 3); x += colW.desc;
            doc.text('CANT.', x, yPos + 3, { width: colW.cant, align: 'right' }); x += colW.cant;
            doc.text('PRECIO', x, yPos + 3, { width: colW.precio, align: 'right' }); x += colW.precio;
            doc.text('IVA', x, yPos + 3, { width: colW.iva, align: 'right' }); x += colW.iva;
            doc.text('FOV.', x, yPos + 3, { width: colW.fov, align: 'right' }); x += colW.fov;
            doc.text('COT.', x, yPos + 3, { width: colW.cot, align: 'right' }); x += colW.cot;
            doc.text('TOTAL', x, yPos + 3, { width: colW.tot - 6, align: 'right' });
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (details.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron registros de facturación en el período seleccionado.', startX, currentY + 10);
            currentY += 30;
        } else {
            details.forEach((r) => {
                if (currentY > 520) {
                    doc.addPage();
                    reportPdfHelper.renderHeader(doc, company, 'Detalle de Facturación', periodText, 'landscape', subtitle);
                    currentY = drawTableHeader(doc.y + 4);
                }

                doc.fontSize(7).font('Helvetica').fillColor('#1e293b');
                let lx = startX + 4;
                doc.text(r.fecha, lx, currentY, { width: colW.fecha, truncate: true }); lx += colW.fecha;
                doc.text(r.tipo_dte, lx, currentY, { width: colW.tipoDte, truncate: true }); lx += colW.tipoDte;
                doc.text(r.numero_control, lx, currentY, { width: colW.control, truncate: true }); lx += colW.control;
                doc.text(r.cliente, lx, currentY, { width: colW.cliente, truncate: true }); lx += colW.cliente;
                doc.text(r.codigo_producto, lx, currentY, { width: colW.codigo, truncate: true }); lx += colW.codigo;
                doc.text(r.descripcion, lx, currentY, { width: colW.desc, truncate: true }); lx += colW.desc;
                doc.text(r.cantidad.toFixed(2), lx, currentY, { width: colW.cant, align: 'right' }); lx += colW.cant;
                doc.text(reportPdfHelper.fmt(r.precio), lx, currentY, { width: colW.precio, align: 'right' }); lx += colW.precio;
                doc.text(reportPdfHelper.fmt(r.iva), lx, currentY, { width: colW.iva, align: 'right' }); lx += colW.iva;
                doc.text(reportPdfHelper.fmt(r.fovial), lx, currentY, { width: colW.fov, align: 'right' }); lx += colW.fov;
                doc.text(reportPdfHelper.fmt(r.cotrans), lx, currentY, { width: colW.cot, align: 'right' }); lx += colW.cot;
                doc.text(reportPdfHelper.fmt(r.total), lx, currentY, { width: colW.tot - 6, align: 'right' });
                currentY += 11;
            });

            // Fila de totales por línea
            if (currentY > 510) {
                doc.addPage();
                reportPdfHelper.renderHeader(doc, company, 'Detalle de Facturación', periodText, 'landscape', subtitle);
                currentY = drawTableHeader(doc.y + 4);
            }

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, currentY + 1).lineTo(startX + contentWidth, currentY + 1).stroke();
            currentY += 4;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`TOTALES (${details.length} LÍNEAS):`, startX + 4, currentY, { width: colW.fecha + colW.tipoDte + colW.control + colW.cliente + colW.codigo + colW.desc, align: 'right' });
            let tx = startX + colW.fecha + colW.tipoDte + colW.control + colW.cliente + colW.codigo + colW.desc + 4;
            doc.text(lineTotals.cantidad.toFixed(2), tx, currentY, { width: colW.cant, align: 'right' }); tx += colW.cant;
            tx += colW.precio; // Salta precio unitario
            doc.text(reportPdfHelper.fmt(lineTotals.iva), tx, currentY, { width: colW.iva, align: 'right' }); tx += colW.iva;
            doc.text(reportPdfHelper.fmt(lineTotals.fovial), tx, currentY, { width: colW.fov, align: 'right' }); tx += colW.fov;
            doc.text(reportPdfHelper.fmt(lineTotals.cotrans), tx, currentY, { width: colW.cot, align: 'right' }); tx += colW.cot;
            doc.text(reportPdfHelper.fmt(lineTotals.total), tx, currentY, { width: colW.tot - 6, align: 'right' });
            currentY += 16;

            // Totales de cabeceras (autoritativos)
            doc.rect(startX, currentY, contentWidth, 16).fill('#f1f5f9');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(
                `RESUMEN DE CABECERAS: ${parseInt(totals.num_documentos || 0, 10)} DOCUMENTOS | IVA: ${reportPdfHelper.fmt(totals.iva)} | FOVIAL: ${reportPdfHelper.fmt(totals.fovial)} | COTRANS: ${reportPdfHelper.fmt(totals.cotrans)} | TOTAL: ${reportPdfHelper.fmt(totals.total)}`,
                startX + 6, currentY + 4, { width: contentWidth - 12 }
            );
            currentY += 22;
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY, details.length, 'Líneas');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();

        const buffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Detalle_Facturacion_${start_date}_al_${end_date}.pdf`);
        res.send(buffer);
    } catch (error) {
        console.error('Error in exportSalesDetailPDF:', error);
        res.status(500).json({ message: 'Error al generar el detalle de facturación', error: error.message });
    }
};

async function resolveRTEELogo(companyId, branchId, branchLogo, compLogo) {
    const checkFile = (rawUrl) => {
        if (!rawUrl) return null;
        const cleanPath = rawUrl.startsWith('/') ? rawUrl.substring(1) : rawUrl;
        const abs1 = path.join(__dirname, '..', '..', cleanPath);
        if (fs.existsSync(abs1)) return abs1;
        const fileName = path.basename(cleanPath);
        const abs2 = path.join(__dirname, '..', '..', 'uploads', fileName);
        if (fs.existsSync(abs2)) return abs2;
        return null;
    };

    // 1. Priorizar estrictamente el logo configurado para la sucursal emisora
    if (branchLogo) {
        const found = checkFile(branchLogo);
        if (found) return found;
    }

    if (branchId) {
        try {
            const [b] = await pool.query('SELECT logo_url FROM branches WHERE id = ?', [branchId]);
            if (b.length && b[0].logo_url) {
                const found = checkFile(b[0].logo_url);
                if (found) return found;
            }
        } catch (_) {}
    }

    // 2. Si la sucursal no tiene logo propio, recurrir al logo corporativo de la empresa
    if (compLogo) {
        const found = checkFile(compLogo);
        if (found) return found;
    }

    if (companyId) {
        try {
            const [c] = await pool.query('SELECT logo_url FROM companies WHERE id = ?', [companyId]);
            if (c.length && c[0].logo_url) {
                const found = checkFile(c[0].logo_url);
                if (found) return found;
            }
        } catch (_) {}
    }

    // NUNCA tomar el logo de otra sucursal hermana porque pueden ser franquicias distintas (ej: Shell vs Puma)
    return null;
}

async function resolveUbicacionCompleta(depCode, munCode, distCode, direccionComp) {
    let depNombre = '';
    let munNombre = '';
    let distNombre = '';

    try {
        if (depCode) {
            const [dep] = await pool.query('SELECT description FROM cat_012_departamento WHERE code = ? LIMIT 1', [depCode]);
            if (dep.length) depNombre = dep[0].description;
        }
        if (depCode && munCode) {
            const [mun] = await pool.query('SELECT description FROM cat_013_municipio WHERE dep_code = ? AND code = ? LIMIT 1', [depCode, munCode]);
            if (mun.length) munNombre = mun[0].description;
        }
        if (depCode && munCode && distCode) {
            const [dist] = await pool.query('SELECT description FROM cat_008_distrito WHERE dep_code = ? AND muni_code = ? AND code = ? LIMIT 1', [depCode, munCode, distCode]);
            if (dist.length) distNombre = dist[0].description;
        }
    } catch (_) {}

    const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
    };

    const parts = [];
    if (direccionComp) parts.push(direccionComp.trim().replace(/,\s*$/, ''));
    if (distNombre) parts.push(toTitleCase(distNombre));
    else if (munNombre) parts.push(toTitleCase(munNombre));
    if (depNombre) parts.push(toTitleCase(depNombre));

    const fullText = parts.reduce((acc, part) => {
        if (!part) return acc;
        if (!acc) return part;
        if (acc.toLowerCase().includes(part.toLowerCase())) return acc;
        return `${acc}, ${part}`;
    }, '');

    return {
        textoCompleto: fullText,
        departamento_nombre: toTitleCase(depNombre) || 'San Salvador',
        municipio_nombre: toTitleCase(distNombre || munNombre) || 'San Salvador'
    };
}

const exportRTEE = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Obtener datos detallados de la venta y DTE
        const [header] = await pool.query(
            `SELECT h.*, h.estado as sale_estado,
            s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
            c.nrc as customer_nrc,
            COALESCE(d_c.status, d_v.status) as dte_status, COALESCE(d_c.numero_control, d_v.numero_control) as dte_control, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as respuesta_hacienda, COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as dte_error,
            COALESCE(d_c.json_original, d_v.json_original) as json_original, COALESCE(d_c.sello_recepcion, d_v.sello_recepcion) as sello_recepcion, COALESCE(d_c.fh_procesamiento, d_v.fh_procesamiento) as fh_procesamiento
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN sellers s ON h.seller_id = s.id
            LEFT JOIN points_of_sale p ON h.pos_id = p.id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
            LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
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

        const branchRow = branch[0] || {};
        const companyRow = company[0] || {};

        // --- Lógica de Logo Robusta sin préstamos entre sucursales ---
        const logoPath = await resolveRTEELogo(req.company_id, venta.branch_id, branchRow.logo_url, companyRow.logo_url);

        // Resolver ubicación detallada de la sucursal (dirección, distrito, municipio, departamento)
        const depCode = branchRow.departamento || dteJson.emisor?.direccion?.departamento || companyRow.departamento;
        const munCode = branchRow.municipio || dteJson.emisor?.direccion?.municipio || companyRow.municipio;
        const distCode = branchRow.distrito || dteJson.emisor?.direccion?.distrito;
        const dirComplemento = branchRow.direccion || dteJson.emisor?.direccion?.complemento || dteJson.emisor?.direccion || '';

        const [emisorDescActividad, receptorDescActividad, ubicacionInfo] = await Promise.all([
            resolveActividadOficial(dteJson.emisor?.codActividad, dteJson.emisor?.descActividad),
            resolveActividadOficial(dteJson.receptor?.codActividad, dteJson.receptor?.descActividad),
            resolveUbicacionCompleta(depCode, munCode, distCode, dirComplemento)
        ]);

        const reportData = {
            emisor: {
                nombre: companyRow.razon_social || dteJson.emisor?.nombre,
                nombre_comercial: dteJson.emisor?.nombreComercial || companyRow.nombre_comercial || null,
                sucursal_nombre: branchRow.nombre || dteJson.emisor?.nombreComercial || null,
                cod_establecimiento: branchRow.codigo_mh || dteJson.emisor?.codEstable || dteJson.emisor?.codEstableMH || null,
                cod_punto_venta: dteJson.emisor?.codPuntoVenta || dteJson.emisor?.codPuntoVentaMH || venta.pos_name || null,
                tipo_establecimiento: branchRow.tipo_establecimiento || dteJson.emisor?.tipoEstablecimiento || null,
                es_casa_matriz: branchRow.es_casa_matriz ?? 0,
                nit: companyRow.nit || dteJson.emisor?.nit,
                nrc: companyRow.nrc || dteJson.emisor?.nrc,
                descActividad: emisorDescActividad,
                direccion: dteJson.emisor?.direccion || branchRow.direccion,
                direccion_completa: ubicacionInfo.textoCompleto,
                telefono: dteJson.emisor?.telefono || branchRow.telefono,
                correo: dteJson.emisor?.correo || branchRow.correo,
                departamento_nombre: ubicacionInfo.departamento_nombre,
                municipio_nombre: ubicacionInfo.municipio_nombre,
                logoPath: logoPath
            },
            receptor: {
                nombre: dteJson.receptor.nombre,
                nit: dteJson.receptor.nit,
                nrc: dteJson.receptor.nrc || venta.customer_nrc || null,
                numDocumento: dteJson.receptor.numDocumento,
                direccion: dteJson.receptor.direccion,
                codActividad: dteJson.receptor.codActividad || null,
                descActividad: receptorDescActividad,
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
                condicion_operacion: dteJson.resumen.condicionOperacion || 1,
                total_gravado: dteJson.resumen.totalGravada || dteJson.resumen.totalSujetoRetencion || 0,
                total_exento: dteJson.resumen.totalExenta || 0,
                total_nosujetas: dteJson.resumen.totalNoSuj || 0,
                total_iva: dteJson.resumen.totalIva || dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || (dteJson.resumen.tributos ? dteJson.resumen.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
                total_descuento: dteJson.resumen.descuNoExenta || 0,
                total_pagar: dteJson.resumen.totalPagar || dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || parseFloat(venta.total_pagar) || 0,
                total_letras: dteJson.resumen.totalLetras || dteJson.resumen.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen.tributos || [],
                totalSujetoRetencion: dteJson.resumen.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || 0,
                totalIvaRetenido: dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || 0,
                total_retencion: dteJson.resumen.ivaRete || dteJson.resumen.totalIvaRetenido || 0,
                total_percepcion: dteJson.resumen.ivaPerci || 0,
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                montoSujetoGrav: item.montoSujetoGrav || item.ventaGravada || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                tipoGeneracion: item.tipoGeneracion || null,
                numDocumento: item.numeroDocumento || item.numDocumento || null,
                numeroDocumento: item.numeroDocumento || item.numDocumento || null,
                fechaEmision: item.fechaEmision || item.emissionDate || item.fecEmi || null,
                ivaRetenido: item.ivaRetenido || 0,
                codigoRetencionMH: item.codigoRetencionMH || null,
                tributos: item.tributos || null,
            }))
        };

        reportData.isVoided = ['anulado', 'invalidado'].includes((venta.estado || '').toLowerCase()) ||
                              ['anulado', 'invalidado'].includes((venta.sale_estado || '').toLowerCase()) ||
                              venta.dte_status === 'INVALIDADO';

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
            `SELECT h.*,             s.nombre as seller_name, p.nombre as pos_name, c.nombre as customer_name, c.correo as customer_email,
            c.nrc as customer_nrc,
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

        const branchRow = branch[0] || {};
        const companyRow = company[0] || {};

        // --- Lógica de Logo Robusta sin préstamos entre sucursales ---
        const logoPath = await resolveRTEELogo(venta.company_id, venta.branch_id, branchRow.logo_url, companyRow.logo_url);

        // Resolver ubicación detallada de la sucursal (dirección, distrito, municipio, departamento)
        const depCode = branchRow.departamento || dteJson.emisor?.direccion?.departamento || companyRow.departamento;
        const munCode = branchRow.municipio || dteJson.emisor?.direccion?.municipio || companyRow.municipio;
        const distCode = branchRow.distrito || dteJson.emisor?.direccion?.distrito;
        const dirComplemento = branchRow.direccion || dteJson.emisor?.direccion?.complemento || dteJson.emisor?.direccion || '';

        const [emisorDescActividad, receptorDescActividad, ubicacionInfo] = await Promise.all([
            resolveActividadOficial(dteJson.emisor?.codActividad, dteJson.emisor?.descActividad),
            resolveActividadOficial(dteJson.receptor?.codActividad, dteJson.receptor?.descActividad),
            resolveUbicacionCompleta(depCode, munCode, distCode, dirComplemento)
        ]);

        const reportData = {
            emisor: {
                nombre: companyRow.razon_social || dteJson.emisor?.nombre,
                nombre_comercial: dteJson.emisor?.nombreComercial || companyRow.nombre_comercial || null,
                sucursal_nombre: branchRow.nombre || dteJson.emisor?.nombreComercial || null,
                cod_establecimiento: branchRow.codigo_mh || dteJson.emisor?.codEstable || dteJson.emisor?.codEstableMH || null,
                cod_punto_venta: dteJson.emisor?.codPuntoVenta || dteJson.emisor?.codPuntoVentaMH || venta.pos_name || null,
                tipo_establecimiento: branchRow.tipo_establecimiento || dteJson.emisor?.tipoEstablecimiento || null,
                es_casa_matriz: branchRow.es_casa_matriz ?? 0,
                nit: companyRow.nit || dteJson.emisor?.nit,
                nrc: companyRow.nrc || dteJson.emisor?.nrc,
                descActividad: emisorDescActividad,
                direccion: dteJson.emisor?.direccion || branchRow.direccion,
                direccion_completa: ubicacionInfo.textoCompleto,
                telefono: dteJson.emisor?.telefono || branchRow.telefono,
                correo: dteJson.emisor?.correo || branchRow.correo,
                departamento_nombre: ubicacionInfo.departamento_nombre,
                municipio_nombre: ubicacionInfo.municipio_nombre,
                logoPath: logoPath
            },
            receptor: {
                nombre: dteJson.receptor.nombre,
                nit: dteJson.receptor.nit,
                nrc: dteJson.receptor.nrc || venta.customer_nrc || null,
                numDocumento: dteJson.receptor.numDocumento,
                direccion: dteJson.receptor.direccion,
                codActividad: dteJson.receptor.codActividad || null,
                descActividad: receptorDescActividad,
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
                condicion_operacion: dteJson.resumen.condicionOperacion || 1,
                total_gravado: dteJson.resumen.totalGravada || dteJson.resumen.totalSujetoRetencion || 0,
                total_exento: dteJson.resumen.totalExenta || 0,
                total_nosujetas: dteJson.resumen.totalNoSuj || 0,
                total_iva: dteJson.resumen.totalIva || dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || (dteJson.resumen.tributos ? dteJson.resumen.tributos.find(t => t.codigo === '20')?.valor : 0) || 0,
                total_descuento: dteJson.resumen.descuNoExenta || 0,
                total_pagar: dteJson.resumen.totalPagar || dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || parseFloat(venta.total_pagar) || 0,
                total_letras: dteJson.resumen.totalLetras || dteJson.resumen.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen.tributos || [],
                totalSujetoRetencion: dteJson.resumen.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || 0,
                totalIvaRetenido: dteJson.resumen.totalIvaRetenido || dteJson.resumen.totalIVAretenido || 0,
                total_retencion: dteJson.resumen.ivaRete || dteJson.resumen.totalIvaRetenido || 0,
                total_percepcion: dteJson.resumen.ivaPerci || 0,
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                montoSujetoGrav: item.montoSujetoGrav || item.ventaGravada || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                tipoGeneracion: item.tipoGeneracion || null,
                numDocumento: item.numeroDocumento || item.numDocumento || null,
                numeroDocumento: item.numeroDocumento || item.numDocumento || null,
                fechaEmision: item.fechaEmision || item.emissionDate || item.fecEmi || null,
                ivaRetenido: item.ivaRetenido || 0,
                codigoRetencionMH: item.codigoRetencionMH || null,
                tributos: item.tributos || null,
            }))
        };

        reportData.isVoided = ['anulado', 'invalidado'].includes((venta.estado || '').toLowerCase()) ||
                              venta.dte_status === 'INVALIDADO';

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

        if (sale.estado === 'anulado' || sale.estado === 'invalidado') {
            return res.status(400).json({ message: 'La venta ya se encuentra anulada o invalidada' });
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

            const isSuperAdmin = req.user?.role === 'SuperAdmin' || 
                                 (typeof req.user?.role === 'string' && req.user.role.toLowerCase() === 'superadmin');

            if (!isWithinLimit && !isSuperAdmin) {
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
                return res.status(502).json({
                    message: `Error al invalidar el DTE en Hacienda: ${dteResult.error}`
                });
            }
        }

        // 4. Actualizar estado de la venta INMEDIATAMENTE (fuera de transacción)
        //    para evitar el escenario donde el DTE queda invalidado pero estado = ""
        await pool.query('UPDATE sales_headers SET estado = "invalidado" WHERE id = ?', [id]);

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

        notificationService.notify('sale_annulled', req.company_id, req.user.branch_id, {
            venta_id: id,
            cliente_nombre: sale.cliente_nombre || 'Cliente Final',
            total: sale.total_pagar || 0,
            motivo: req.body.motivo || 'Anulación manual',
            sucursal: req.branch_name || ''
        }).catch(() => {});

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
                error: result.error,
                details: result.details || null
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

        let query = `
            SELECT 1 FROM sales_linked_documents ld
            JOIN sales_headers h ON ld.sale_id = h.id
            WHERE ld.doc_number = ?
              AND (h.tipo_documento = '07' OR h.dte_type = '07')
              AND h.company_id = ?
              AND LOWER(h.estado) != 'anulado'
              AND (
                  (${dteValidoExistsSql('h')})
                  OR (
                      (h.codigo_generacion IS NULL OR h.codigo_generacion = '')
                      AND NOT EXISTS (SELECT 1 FROM dtes WHERE venta_id = h.id)
                  )
              )
        `;
        const params = [String(doc_number).trim(), req.company_id];

        if (doc_type) {
            query += ` AND ld.doc_type = ?`;
            params.push(String(doc_type).trim());
        }

        query += ` LIMIT 1`;

        const [rows] = await pool.query(query, params);
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
    const { updateDateTime, target_shift_id } = req.body;
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

        // Consultar el estado del DTE activo previo
        const [dteRows] = await connection.query(
            `SELECT id, codigo_generacion, numero_control, status, sello_recepcion, json_original 
             FROM dtes 
             WHERE (venta_id = ? OR (codigo_generacion = ? AND codigo_generacion IS NOT NULL AND codigo_generacion != '')) 
               AND company_id = ? 
             ORDER BY id DESC LIMIT 1`,
            [id, sale.codigo_generacion, req.company_id]
        );
        const activeDte = dteRows[0] || null;
        const isAlreadyAccepted = (activeDte?.status === 'ACCEPTED' || Boolean(activeDte?.sello_recepcion) || Boolean(sale.sello_recepcion));

        const company = { ...sale, id: sale.company_id };

        // Días de crédito si aplica
        let diasCredito = 15;
        if (sale.customer_id) {
            const [custDias] = await connection.query(
                'SELECT dias_credito FROM customers WHERE id = ? AND company_id = ?',
                [sale.customer_id, req.company_id]
            );
            if (custDias.length > 0 && custDias[0].dias_credito != null) {
                diasCredito = parseInt(custDias[0].dias_credito) || 15;
            }
        }

        // =====================================================================
        // CASO B: DTE YA ACEPTADO POR HACIENDA -> CREAR NUEVA VENTA Y EMITIR DTE
        // =====================================================================
        if (isAlreadyAccepted) {
            if (!target_shift_id) {
                return res.status(400).json({
                    message: 'Debe seleccionar un turno abierto en la sucursal para registrar la nueva venta.'
                });
            }

            const [shiftRows] = await connection.query(
                `SELECT id, branch_id, status FROM pos_shifts 
                 WHERE id = ? AND company_id = ? AND branch_id = ? AND status = 'open'`,
                [target_shift_id, req.company_id, sale.branch_id]
            );
            if (shiftRows.length === 0) {
                return res.status(400).json({
                    message: 'El turno seleccionado no está abierto o no pertenece a la sucursal de la venta. Debe abrir un turno antes de proceder.'
                });
            }

            await connection.beginTransaction();

            const now = new Date();
            const horaEmision = now.toTimeString().split(' ')[0];
            const origControl = sale.numero_control || activeDte?.numero_control || `VTA-${sale.id}`;
            const nuevaObservacion = sale.observaciones 
                ? `${sale.observaciones} | Regenerado a partir de venta #${sale.id} (DTE previo: ${origControl})`
                : `Regenerado a partir de venta #${sale.id} (DTE previo: ${origControl})`;

            // 1. Insertar nueva cabecera de venta
            const [newSaleResult] = await connection.query('INSERT INTO sales_headers SET ?', [{
                company_id: req.company_id,
                branch_id: sale.branch_id,
                customer_id: sale.customer_id,
                customer_branch_id: sale.customer_branch_id || null,
                seller_id: sale.seller_id,
                pos_id: sale.pos_id,
                shift_id: target_shift_id,
                dte_type: sale.dte_type || sale.tipo_documento,
                tipo_documento: sale.tipo_documento || sale.dte_type,
                condicion_operacion: sale.condicion_operacion || 1,
                fecha_emision: now,
                hora_emision: horaEmision,
                estado: 'emitido',
                total_gravado: sale.total_gravado || 0,
                total_exento: sale.total_exento || 0,
                total_nosujetas: sale.total_nosujetas || 0,
                fovial: sale.fovial || 0,
                cotrans: sale.cotrans || 0,
                total_iva: sale.total_iva || 0,
                descuento_general: sale.descuento_general || 0,
                iva_percibido: sale.iva_percibido || 0,
                iva_retenido: sale.iva_retenido || 0,
                total_pagar: sale.total_pagar || 0,
                payment_condition: sale.payment_condition || 1,
                observaciones: nuevaObservacion,
                export_item_type: sale.export_item_type || null,
                fiscal_enclosure: sale.fiscal_enclosure || null,
                export_regime: sale.export_regime || null,
                dest_country_code: sale.dest_country_code || null,
                remission_type: sale.remission_type || null,
                transporter_name: sale.transporter_name || null,
                vehicle_plate: sale.vehicle_plate || null,
                cliente_nombre: sale.cliente_nombre || null,
                created_at: now
            }]);
            const newSaleId = newSaleResult.insertId;

            // 2. Insertar ítems y descontar inventario
            for (const item of items) {
                await connection.query('INSERT INTO sales_items SET ?', [{
                    sale_id: newSaleId,
                    product_id: item.product_id || null,
                    codigo: item.codigo || null,
                    combo_id: item.combo_id || null,
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_unitario,
                    monto_descuento: item.monto_descuento || 0,
                    venta_gravada: item.venta_gravada || 0,
                    venta_exenta: item.venta_exenta || 0,
                    tributos: typeof item.tributos === 'string' ? item.tributos : JSON.stringify(item.tributos || []),
                    retention_type: item.retention_type || null,
                    retention_code: item.retention_code || null,
                    retention_amount: item.retention_amount || null,
                    retention_base: item.retention_base || null
                }]);

                if (item.combo_id) {
                    const [comboItems] = await connection.query(
                        'SELECT product_id, quantity FROM product_combo_items WHERE combo_id = ?',
                        [item.combo_id]
                    );
                    for (const ci of comboItems) {
                        const totalQty = ci.quantity * item.cantidad;
                        const effectiveProductId = await getEffectiveProductId(connection, ci.product_id);
                        if (sale.dte_type !== '04' && sale.tipo_documento !== '04') {
                            await connection.query(
                                'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                                [totalQty, effectiveProductId, sale.branch_id]
                            );
                            await connection.query('INSERT INTO inventory_movements SET ?', [{
                                company_id: req.company_id,
                                branch_id: sale.branch_id,
                                product_id: effectiveProductId,
                                tipo_movimiento: 'SALIDA',
                                cantidad: totalQty,
                                tipo_documento: `DTE-${sale.dte_type || '01'} (COMBO)`,
                                documento_id: newSaleId,
                                created_at: now
                            }]);
                        }
                    }
                } else if (item.product_id) {
                    const effectiveProductId = await getEffectiveProductId(connection, item.product_id);
                    if (sale.dte_type !== '04' && sale.tipo_documento !== '04') {
                        await connection.query(
                            'UPDATE inventory SET stock = stock - ? WHERE product_id = ? AND branch_id = ?',
                            [item.cantidad, effectiveProductId, sale.branch_id]
                        );
                        await connection.query('INSERT INTO inventory_movements SET ?', [{
                            company_id: req.company_id,
                            branch_id: sale.branch_id,
                            product_id: effectiveProductId,
                            tipo_movimiento: 'SALIDA',
                            cantidad: item.cantidad,
                            tipo_documento: `DTE-${sale.dte_type || '01'}`,
                            documento_id: newSaleId,
                            created_at: now
                        }]);
                    }
                }
            }

            // 3. Insertar pagos
            for (const p of payments) {
                await connection.query('INSERT INTO sales_payments SET ?', [{
                    sale_id: newSaleId,
                    metodo_pago: p.metodo_pago || '01',
                    monto: p.monto,
                    referencia: p.referencia || null
                }]);
            }

            // 4. Insertar documentos vinculados
            for (const d of linkedDocs) {
                await connection.query('INSERT INTO sales_linked_documents SET ?', [{
                    sale_id: newSaleId,
                    doc_type: d.doc_type || d.tipo_documento || null,
                    doc_number: d.doc_number || d.numero_documento || null,
                    emission_date: d.emission_date || d.fecha_emision || null,
                    generation_type: d.generation_type || 1,
                    monto_sujeto: d.monto_sujeto || null,
                    iva_retenido: d.iva_retenido || null,
                    descripcion: d.descripcion || null
                }]);
            }

            // 5. Construir payload y emitir DTE (tiempo real)
            const dtePayload = {
                header: {
                    dte_type: sale.dte_type || sale.tipo_documento,
                    customer_id: sale.customer_id,
                    cliente_nombre: sale.cliente_nombre || null,
                    customer_branch_id: sale.customer_branch_id || null,
                    seller_id: sale.seller_id,
                    pos_id: sale.pos_id,
                    shift_id: target_shift_id,
                    branch_id: sale.branch_id,
                    user_id: req.user.id,
                    condicion_operacion: sale.condicion_operacion || 1,
                    dias_credito: diasCredito,
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
                    observaciones: nuevaObservacion,
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
                dias_credito: diasCredito,
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

            console.log(`[SalesController] Regenerando como NUEVA VENTA #${newSaleId} a partir de venta #${id}`);
            const dteResult = await dteService.emitDTE(company, dtePayload, newSaleId);

            if (!dteResult.success || dteResult.skip) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: dteResult.error || 'Error al emitir DTE para la nueva venta'
                });
            }

            const dteInfo = dteResult.data;

            // Actualizar cabecera de la nueva venta y vincular DTE
            await connection.query(
                'UPDATE sales_headers SET codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
                [dteInfo.codigo_generacion, dteInfo.numero_control, dteInfo.sello_recepcion || null, dteInfo.fh_procesamiento || null, newSaleId]
            );
            await connection.query(
                'UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?',
                [newSaleId, dteInfo.codigo_generacion, req.company_id]
            );

            await connection.commit();
            connection.release();
            connection = null;

            // Envío asíncrono de correo si el cliente tiene email
            mailerService.sendDTEEmail(newSaleId, req.company_id).catch(err => {
                console.error('[RegenerateDTE - Nueva Venta] Error enviando correo:', err.message);
            });

            return res.json({
                success: true,
                isNewSale: true,
                newSaleId,
                codigoGeneracion: dteInfo.codigo_generacion,
                numeroControl: dteInfo.numero_control,
                ambiente: sale.ambiente || 'test',
                message: `Nueva venta #${newSaleId} creada y DTE emitido exitosamente`
            });
        }

        // =====================================================================
        // CASO A: DTE NO ACEPTADO PREVIAMENTE -> REINTENTAR EN LA MISMA VENTA
        // =====================================================================
        // Desvincular cualquier DTE previo en 'dtes' para esta venta (se conserva para auditoría con venta_id = NULL)
        await connection.query(
            'UPDATE dtes SET venta_id = NULL WHERE venta_id = ? AND company_id = ?',
            [id, req.company_id]
        );

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
                dias_credito: diasCredito,
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
            dias_credito: diasCredito,
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
        if (!updateDateTime && activeDte?.json_original) {
            const origJson = typeof activeDte.json_original === 'string'
                ? JSON.parse(activeDte.json_original) : activeDte.json_original;
            if (origJson?.identificacion?.fecEmi && origJson?.identificacion?.horEmi) {
                dtePayload.identificacionExtra = {
                    fecEmi: origJson.identificacion.fecEmi,
                    horEmi: origJson.identificacion.horEmi
                };
            }
        }

        console.log(`[SalesController] Regenerando DTE in-situ para venta ${id} con ambiente ${sale.ambiente || 'test'}`);
        const dteResult = await dteService.emitDTE(company, dtePayload, id);

        if (!dteResult.success || dteResult.skip) {
            return res.status(400).json({
                success: false,
                message: dteResult.error || 'Error al regenerar DTE'
            });
        }

        const dteInfo = dteResult.data;

        connection = await pool.getConnection();
        // 2. Desvincular cualquier intento anterior y vincular exclusivamente el nuevo DTE a la venta
        await connection.query(
            'UPDATE dtes SET venta_id = NULL WHERE venta_id = ? AND codigo_generacion != ? AND company_id = ?',
            [id, dteInfo.codigo_generacion, req.company_id]
        );
        await connection.query(
            'UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?',
            [id, dteInfo.codigo_generacion, req.company_id]
        );
        await connection.query(
            'UPDATE sales_headers SET codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
            [dteInfo.codigo_generacion, dteInfo.numero_control, dteInfo.sello_recepcion || null, dteInfo.fh_procesamiento || null, id]
        );
        connection.release();
        connection = null;

        res.json({
            success: true,
            isNewSale: false,
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
                    COALESCE(NULLIF(TRIM(cb.direccion), ''), c.direccion) as receptor_direccion
             FROM dtes d
             LEFT JOIN sales_headers h ON d.codigo_generacion = h.codigo_generacion
             LEFT JOIN companies comp ON h.company_id = comp.id
             LEFT JOIN branches b ON h.branch_id = b.id
             LEFT JOIN customers c ON h.customer_id = c.id
             LEFT JOIN customer_branches cb ON h.customer_branch_id = cb.id
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
                    c.razon_social as company_name, c.nit as company_nit, c.nrc as company_nrc, c.logo_url as company_logo_url,
                    c.departamento as company_dep, c.municipio as company_mun,
                    cu.nrc as customer_nrc,
                    b.nombre as branch_name, b.codigo_mh as branch_codigo_mh, b.es_casa_matriz, b.tipo_establecimiento as branch_tipo_est,
                    b.telefono as branch_telefono, b.correo as branch_correo, b.logo_url as branch_logo_url,
                    b.direccion as branch_dir, b.departamento as branch_dep, b.municipio as branch_mun, b.distrito as branch_dist,
                    cat.description as tipo_documento_name
             FROM dtes d
             JOIN sales_headers h ON d.codigo_generacion = h.codigo_generacion
             JOIN companies c ON h.company_id = c.id
             JOIN branches b ON h.branch_id = b.id
             LEFT JOIN customers cu ON h.customer_id = cu.id
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

        const logoPath = await resolveRTEELogo(venta.company_id, venta.branch_id, venta.branch_logo_url, venta.company_logo_url);

        const depCode = venta.branch_dep || dteJson.emisor?.direccion?.departamento || venta.company_dep;
        const munCode = venta.branch_mun || dteJson.emisor?.direccion?.municipio || venta.company_mun;
        const distCode = venta.branch_dist || dteJson.emisor?.direccion?.distrito;
        const dirComplemento = venta.branch_dir || dteJson.emisor?.direccion?.complemento || dteJson.emisor?.direccion || '';

        const ubicacionInfo = await resolveUbicacionCompleta(depCode, munCode, distCode, dirComplemento);

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
                nombre_comercial: dteJson.emisor?.nombreComercial || null,
                sucursal_nombre: venta.branch_name || dteJson.emisor?.nombreComercial || null,
                cod_establecimiento: venta.branch_codigo_mh || dteJson.emisor?.codEstable || dteJson.emisor?.codEstableMH || null,
                cod_punto_venta: dteJson.emisor?.codPuntoVenta || dteJson.emisor?.codPuntoVentaMH || null,
                tipo_establecimiento: venta.branch_tipo_est || dteJson.emisor?.tipoEstablecimiento || null,
                es_casa_matriz: venta.es_casa_matriz ?? 0,
                nit: venta.company_nit,
                nrc: venta.company_nrc,
                descActividad: dteJson.emisor?.descActividad,
                direccion: dteJson.emisor?.direccion || venta.branch_dir,
                direccion_completa: ubicacionInfo.textoCompleto,
                telefono: dteJson.emisor?.telefono || venta.branch_telefono,
                correo: dteJson.emisor?.correo || venta.branch_correo,
                departamento_nombre: ubicacionInfo.departamento_nombre,
                municipio_nombre: ubicacionInfo.municipio_nombre,
                logoPath: logoPath
            },
            receptor: {
                nombre: dteJson.receptor?.nombre,
                nit: dteJson.receptor?.nit,
                nrc: dteJson.receptor?.nrc || venta.customer_nrc || null,
                numDocumento: dteJson.receptor?.numDocumento,
                direccion: dteJson.receptor?.direccion
            },
            dte: {
                tipoDte: dteJson.identificacion?.tipoDte,
                tipoDteNombre: tipoNombre,
                codigoGeneracion: dteJson.identificacion?.codigoGeneracion,
                numeroControl: venta.numero_control,
                selloRecepcion: venta.sello_recepcion,
                ambiente: dteJson.identificacion?.ambiente
            },
            venta: {
                fecha_emision: dteJson.identificacion?.fecEmi,
                hora_emision: dteJson.identificacion?.horEmi,
                condicion_operacion: dteJson.resumen?.condicionOperacion || 1,
                total_gravado: dteJson.resumen?.totalGravada || dteJson.resumen?.totalSujetoRetencion || 0,
                total_iva: dteJson.resumen?.totalIva || dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || (dteJson.resumen?.tributos?.find(t => t.codigo === '20')?.valor || 0),
                total_descuento: dteJson.resumen?.descuNoExenta || 0,
                total_pagar: dteJson.resumen?.totalPagar || dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || parseFloat(venta.total_pagar) || 0,
                total_letras: dteJson.resumen?.totalLetras || dteJson.resumen?.totalIVAretenidoLetras || '',
                fovial: parseFloat(venta.fovial) || 0,
                cotrans: parseFloat(venta.cotrans) || 0,
                tributos: dteJson.resumen?.tributos || [],
                totalSujetoRetencion: dteJson.resumen?.totalSujetoRetencion || 0,
                totalIVAretenido: dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || 0,
                totalIvaRetenido: dteJson.resumen?.totalIvaRetenido || dteJson.resumen?.totalIVAretenido || 0,
                total_retencion: dteJson.resumen?.ivaRete || dteJson.resumen?.totalIvaRetenido || 0,
                total_percepcion: dteJson.resumen?.ivaPerci || 0
            },
            items: (dteJson.cuerpoDocumento || []).map(item => ({
                cantidad: item.cantidad || 1,
                descripcion: item.descripcion || '',
                precioUnitario: item.precioUni || item.montoSujetoGrav || 0,
                montoDescuento: item.montoDescu || 0,
                totalItem: item.ventaGravada || item.montoSujetoGrav || 0,
                montoSujetoGrav: item.montoSujetoGrav || item.ventaGravada || 0,
                uniMedida: item.uniMedida || 59,
                tipoDte: item.tipoDte || null,
                tipoGeneracion: item.tipoGeneracion || null,
                numDocumento: item.numeroDocumento || item.numDocumento || null,
                numeroDocumento: item.numeroDocumento || item.numDocumento || null,
                fechaEmision: item.fechaEmision || item.emissionDate || item.fecEmi || null,
                ivaRetenido: item.ivaRetenido || 0,
                codigoRetencionMH: item.codigoRetencionMH || null,
                tributos: item.tributos || null,
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

/**
 * Cambia el turno (pos_shift) de una o varias ventas con DTE emitido.
 */
const changeSalesShift = async (req, res) => {
    const { ids = [], shift_id } = req.body;

    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una venta' });
        }
        if (!shift_id) {
            return res.status(400).json({ message: 'Debe indicar el turno destino' });
        }

        const [shiftRows] = await pool.query(
            'SELECT id, company_id, branch_id, status, shift_number FROM pos_shifts WHERE id = ? AND company_id = ?',
            [shift_id, req.company_id]
        );
        if (shiftRows.length === 0) {
            return res.status(404).json({ message: 'El turno destino no existe o no pertenece a esta empresa' });
        }
        const targetShift = shiftRows[0];

        const [sales] = await pool.query(
            `SELECT h.id, h.shift_id, h.estado, h.branch_id, h.codigo_generacion,
                    (SELECT COUNT(*) FROM dtes d WHERE d.venta_id = h.id AND d.company_id = h.company_id) as dte_venta_count,
                    (SELECT COUNT(*) FROM dtes d WHERE d.codigo_generacion = h.codigo_generacion AND d.company_id = h.company_id) as dte_codigo_count
             FROM sales_headers h
             WHERE h.id IN (?) AND h.company_id = ?`,
            [ids, req.company_id]
        );

        if (sales.length === 0) {
            return res.status(404).json({ message: 'No se encontraron ventas con los ids indicados' });
        }

        const missing = ids.filter(id => !sales.some(s => Number(s.id) === Number(id)));
        if (missing.length > 0) {
            return res.status(404).json({ message: 'Algunas ventas no pertenecen a esta empresa', missing });
        }

        const userBranchId = req.user.branch_id ? Number(req.user.branch_id) : null;
        const targetBranchId = Number(targetShift.branch_id);

        const invalid = [];
        for (const s of sales) {
            if (s.estado !== 'emitido') invalid.push({ id: s.id, reason: 'La venta no está emitida' });
            else if (s.dte_venta_count === 0 && s.dte_codigo_count === 0) invalid.push({ id: s.id, reason: 'La venta no tiene DTE asociado' });
            else if (Number(s.branch_id) !== targetBranchId) invalid.push({ id: s.id, reason: 'La venta es de otra sucursal que el turno destino' });
            else if (userBranchId && Number(s.branch_id) !== userBranchId) invalid.push({ id: s.id, reason: 'La venta no pertenece a su sucursal' });
        }
        if (invalid.length > 0) {
            return res.status(400).json({ message: `${invalid.length} venta(s) no pueden cambiarse de turno`, invalid });
        }

        await pool.query(
            'UPDATE sales_headers SET shift_id = ? WHERE id IN (?) AND company_id = ?',
            [shift_id, ids, req.company_id]
        );

        res.json({ success: true, message: `${sales.length} venta(s) cambiada(s) de turno correctamente`, updated: sales.length });
    } catch (error) {
        console.error('Error in changeSalesShift:', error);
        res.status(500).json({ message: 'Error al cambiar las ventas de turno', error: error.message });
    }
};

/**
 * Obtiene métricas y estadísticas consolidadas de DTEs emitidos por rango de fechas.
 */
const getDteStats = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { start_date, end_date, branch_id } = req.query;

        let where = 'WHERE h.company_id = ?';
        const params = [companyId];

        if (start_date && end_date) {
            where += ' AND DATE(h.fecha_emision) BETWEEN ? AND ?';
            params.push(start_date, end_date);
        } else if (start_date) {
            where += ' AND DATE(h.fecha_emision) = ?';
            params.push(start_date);
        }

        if (branch_id && branch_id !== 'all') {
            where += ' AND h.branch_id = ?';
            params.push(branch_id);
        }

        const summaryQuery = `
            SELECT 
                COUNT(*) as total_ventas,
                COUNT(CASE WHEN h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '' THEN 1 END) as total_dtes_emitidos,
                COUNT(CASE WHEN (h.sello_recepcion IS NOT NULL AND h.sello_recepcion != '') THEN 1 END) as total_aceptados,
                COUNT(CASE WHEN h.estado = 'anulado' OR EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'INVALIDADO') THEN 1 END) as total_invalidados,
                COUNT(CASE WHEN (h.sello_recepcion IS NULL OR h.sello_recepcion = '') AND h.estado != 'anulado' AND EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'REJECTED') THEN 1 END) as total_rechazados,
                COUNT(CASE WHEN (h.sello_recepcion IS NULL OR h.sello_recepcion = '') AND h.estado != 'anulado' AND EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'CONTINGENCIA') THEN 1 END) as total_contingencia,
                COUNT(CASE WHEN h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '' AND (h.sello_recepcion IS NULL OR h.sello_recepcion = '') AND h.estado != 'anulado' AND NOT EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status IN ('REJECTED', 'CONTINGENCIA')) THEN 1 END) as total_pendientes,
                
                SUM(h.total_pagar) as total_monto_ventas,
                SUM(CASE WHEN h.codigo_generacion IS NOT NULL AND h.codigo_generacion != '' THEN h.total_pagar ELSE 0 END) as total_monto_dtes
            FROM sales_headers h
            ${where}
        `;

        const byTypeQuery = `
            SELECT 
                h.tipo_documento,
                COUNT(*) as cantidad,
                SUM(h.total_pagar) as monto,
                COUNT(CASE WHEN h.sello_recepcion IS NOT NULL AND h.sello_recepcion != '' THEN 1 END) as aceptados,
                COUNT(CASE WHEN (h.sello_recepcion IS NULL OR h.sello_recepcion = '') AND h.estado != 'anulado' AND EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'REJECTED') THEN 1 END) as rechazados,
                COUNT(CASE WHEN h.estado = 'anulado' OR EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'INVALIDADO') THEN 1 END) as invalidados
            FROM sales_headers h
            ${where} AND h.codigo_generacion IS NOT NULL AND h.codigo_generacion != ''
            GROUP BY h.tipo_documento
            ORDER BY cantidad DESC
        `;

        const dailyQuery = `
            SELECT 
                DATE_FORMAT(h.fecha_emision, '%Y-%m-%d') as fecha,
                COUNT(*) as total_dtes,
                COUNT(CASE WHEN h.sello_recepcion IS NOT NULL AND h.sello_recepcion != '' THEN 1 END) as aceptados,
                COUNT(CASE WHEN (h.sello_recepcion IS NULL OR h.sello_recepcion = '') AND h.estado != 'anulado' AND EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'REJECTED') THEN 1 END) as rechazados,
                COUNT(CASE WHEN h.estado = 'anulado' OR EXISTS (SELECT 1 FROM dtes d WHERE d.company_id = h.company_id AND d.venta_id = h.id AND d.status = 'INVALIDADO') THEN 1 END) as invalidados,
                COUNT(CASE WHEN h.tipo_documento = '01' THEN 1 END) as facturas,
                COUNT(CASE WHEN h.tipo_documento = '03' THEN 1 END) as creditos_fiscales,
                COUNT(CASE WHEN h.tipo_documento NOT IN ('01', '03') THEN 1 END) as otros_dtes,
                SUM(h.total_pagar) as total_monto
            FROM sales_headers h
            ${where} AND h.codigo_generacion IS NOT NULL AND h.codigo_generacion != ''
            GROUP BY DATE(h.fecha_emision)
            ORDER BY fecha DESC
            LIMIT 31
        `;

        const [[summaryRows], [byTypeRows], [dailyRows]] = await Promise.all([
            pool.query(summaryQuery, params),
            pool.query(byTypeQuery, params),
            pool.query(dailyQuery, params)
        ]);

        const rawSummary = summaryRows[0] || {};
        const totalDtes = Number(rawSummary.total_dtes_emitidos || 0);
        const totalAceptados = Number(rawSummary.total_aceptados || 0);
        const totalRechazados = Number(rawSummary.total_rechazados || 0);
        const totalInvalidados = Number(rawSummary.total_invalidados || 0);
        const totalMontoDtes = Number(rawSummary.total_monto_dtes || 0);

        const summary = {
            total_ventas: Number(rawSummary.total_ventas || 0),
            total_dtes_emitidos: totalDtes,
            total_aceptados: totalAceptados,
            porcentaje_aceptados: totalDtes > 0 ? ((totalAceptados / totalDtes) * 100).toFixed(1) : '100.0',
            total_rechazados: totalRechazados,
            porcentaje_rechazados: totalDtes > 0 ? ((totalRechazados / totalDtes) * 100).toFixed(1) : '0.0',
            total_invalidados: totalInvalidados,
            porcentaje_invalidados: totalDtes > 0 ? ((totalInvalidados / totalDtes) * 100).toFixed(1) : '0.0',
            total_contingencia: Number(rawSummary.total_contingencia || 0),
            total_pendientes: Number(rawSummary.total_pendientes || 0),
            total_monto_ventas: Number(rawSummary.total_monto_ventas || 0),
            total_monto_dtes: totalMontoDtes
        };

        const byType = byTypeRows.map(row => {
            const cant = Number(row.cantidad || 0);
            const monto = Number(row.monto || 0);
            return {
                tipo_documento: row.tipo_documento,
                nombre: dteTypeNames[row.tipo_documento] || `DTE Tipo ${row.tipo_documento}`,
                cantidad: cant,
                monto: monto,
                aceptados: Number(row.aceptados || 0),
                rechazados: Number(row.rechazados || 0),
                invalidados: Number(row.invalidados || 0),
                porcentaje_cantidad: totalDtes > 0 ? ((cant / totalDtes) * 100).toFixed(1) : '0.0',
                porcentaje_monto: totalMontoDtes > 0 ? ((monto / totalMontoDtes) * 100).toFixed(1) : '0.0'
            };
        });

        res.json({
            period: {
                start_date: start_date || null,
                end_date: end_date || null,
                branch_id: branch_id || 'all'
            },
            summary,
            by_type: byType,
            daily_breakdown: dailyRows
        });
    } catch (error) {
        console.error('Error in getDteStats:', error);
        res.status(500).json({ message: 'Error al calcular estadísticas de DTE', error: error.message });
    }
};

const notifyDTEAccepted = async (req, res) => {
    const { codigoGeneracion, ventaId, companyId } = req.body;
    try {
        if (ventaId) {
            console.log(`[NotifyDTEAccepted] Disparando envío automático de correo para venta ${ventaId} (DTE: ${codigoGeneracion})...`);
            await mailerService.sendDTEEmail(ventaId, companyId);
        }
        res.json({ success: true, message: 'Correo enviado automáticamente tras aprobación de Hacienda' });
    } catch (err) {
        console.error('[NotifyDTEAccepted] Error enviando correo automático:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = {
    notifyDTEAccepted,
    createSale,
    getSales,
    getSaleById,
    getSalesByCategory,
    exportSalesByCategoryPDF,
    getDailySales,
    exportDailySalesPDF,
    exportSalesByCustomerPDF,
    getSalesReportPDF,
    getSalesByPOS,
    exportSalesByPOSPDF,
    exportSalesDetailPDF,
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
    getDTEByCodigoGeneracion,
    changeSalesShift,
    getDteStats
};
