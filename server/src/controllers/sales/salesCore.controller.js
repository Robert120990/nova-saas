const {
    mailerService,
    pool,
    dteService,
    pdfService,
    aiService,
    path,
    fs,
    jwt,
    getEffectiveProductId,
    getLubricantCategoryIds,
    isLubricantProduct,
    excelService,
    notificationService,
    dteValidoExistsSql,
    dteLatestColSql,
    reportPdfHelper,
    validateDocumentNumber,
    isValidDocumentNumber,
    dteTypeNames,
    getDteTypeName,
    FALLBACK_ACTIVIDAD,
} = require('./salesUtils');
const eggReturnableService = require('../../services/eggReturnableService');


// --- CREACIÓN, CONSULTA Y ANULACIÓN DE VENTAS ---
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

        let customerRow = null;
        if (header.customer_id) {
            const [custRows] = await connection.query(
                'SELECT id, nombre, nit, numero_documento, nrc, tipo_documento, departamento, municipio, distrito, direccion FROM customers WHERE id = ? AND company_id = ?',
                [header.customer_id, req.company_id]
            );
            customerRow = custRows[0] || null;
        }

        // 0a. Limpieza silenciosa de documentos ficticios (ceros) en clientes para Facturas < $200
        if (header.dte_type === '01' && customerRow && parseFloat(header.total_pagar || header.total || 0) < 200) {
            const rawDoc = customerRow.numero_documento || customerRow.nit;
            const cleanDoc = String(rawDoc || '').replace(/[-\s]/g, '');
            if (cleanDoc.length > 0 && !isValidDocumentNumber(cleanDoc, customerRow.tipo_documento)) {
                await connection.query(
                    'UPDATE customers SET numero_documento = NULL, nit = NULL WHERE id = ? AND company_id = ?',
                    [customerRow.id, req.company_id]
                );
                customerRow.numero_documento = null;
                customerRow.nit = null;
            }
        }

        // 0b. Validar dirección del cliente seleccionado antes de crear la venta (requisito DTE)
        if (company && company.dte_active && header.customer_id && header.dte_type !== '11') {
            const totalSale = parseFloat(header.total_pagar || header.total || 0);
            const isFacturaMinor = header.dte_type === '01' && totalSale < 200;

            if (!isFacturaMinor) {
                const addressError = await dteService.validateCustomerAddress(header.customer_id, header.customer_branch_id || null);
                if (addressError) {
                    await connection.rollback();
                    return res.status(400).json({ message: addressError, success: false });
                }
            }
        }

        // 0c. Validar NIT del cliente para Crédito Fiscal (requisito Hacienda)
        if (company && company.dte_active && header.dte_type === '03' && header.customer_id) {
            const rawNit = customerRow?.nit || customerRow?.numero_documento;
            const nitVal = validateDocumentNumber(rawNit, 'NIT');
            if (!nitVal.isValid) {
                await connection.rollback();
                return res.status(400).json({
                    message: `El cliente "${customerRow?.nombre || ''}" no tiene un NIT válido (${nitVal.error || 'requerido'}). Para emitir Crédito Fiscal (CCF) el cliente debe tener NIT registrado sin números ficticios.`,
                    success: false
                });
            }
            const cleanNrc = String(customerRow?.nrc || '').replace(/\D/g, '');
            if (!cleanNrc || /^0+$/.test(cleanNrc)) {
                await connection.rollback();
                return res.status(400).json({
                    message: `El cliente "${customerRow?.nombre || ''}" no tiene un NRC válido registrado.`,
                    success: false
                });
            }
        }

        // 0c2. Validar Factura (01) >= $200 o con documento
        if (company && company.dte_active && header.dte_type === '01') {
            const totalSale = parseFloat(header.total_pagar || header.total || 0);
            const rawDoc = customerRow?.numero_documento || customerRow?.nit;
            if (totalSale >= 200 && !rawDoc) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Facturas mayores o iguales a $200.00 requieren DUI o NIT del cliente.',
                    success: false
                });
            }
            if (rawDoc) {
                const docVal = validateDocumentNumber(rawDoc, customerRow?.tipo_documento);
                if (!docVal.isValid) {
                    await connection.rollback();
                    return res.status(400).json({
                        message: `Documento del cliente no válido: ${docVal.error}`,
                        success: false
                    });
                }
            }
        }

        // 0c3. Validar Nota de Crédito (05) sobre Crédito Fiscal
        if (company && company.dte_active && header.dte_type === '05' && customerRow) {
            const hasCCF = (linkedDocuments || []).some(d => d.doc_type === '03' || d.tipoDte === '03');
            if (hasCCF) {
                const rawNit = customerRow.nit || customerRow.numero_documento;
                const nitVal = validateDocumentNumber(rawNit, 'NIT');
                if (!nitVal.isValid) {
                    await connection.rollback();
                    return res.status(400).json({
                        message: `Para emitir Nota de Crédito sobre un Crédito Fiscal, el cliente debe tener un NIT válido. Motivo: ${nitVal.error}`,
                        success: false
                    });
                }
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

        // 0e. Validar límites de descuento de la sucursal (Tope de Margen % y Tope Acumulado por Ticket $)
        const effectiveBranchId = header.branch_id || req.user.branch_id;
        if (effectiveBranchId) {
            const [branchRows] = await connection.query(
                'SELECT id, nombre, max_discount_amount, max_discount_percentage FROM branches WHERE id = ? AND company_id = ?',
                [effectiveBranchId, req.company_id]
            );
            const branch = branchRows[0];
            if (branch) {
                const maxAmount = branch.max_discount_amount !== null && branch.max_discount_amount !== undefined 
                    ? parseFloat(branch.max_discount_amount) 
                    : null;
                const maxPercentage = branch.max_discount_percentage !== null && branch.max_discount_percentage !== undefined 
                    ? parseFloat(branch.max_discount_percentage) 
                    : null;

                const totalItemDiscounts = items.reduce((acc, it) => acc + (parseFloat(it.monto_descuento) || 0), 0);
                const generalDiscount = parseFloat(header.descuento_general || header.total_descuento || 0);
                const totalDiscounts = totalItemDiscounts + generalDiscount;

                // Validar tope de monto acumulado por ticket
                if (maxAmount !== null && totalDiscounts > (maxAmount + 0.01)) {
                    let hasManualDiscount = generalDiscount > 0;
                    if (!hasManualDiscount) {
                        for (const it of items) {
                            const itDisc = parseFloat(it.monto_descuento) || 0;
                            if (itDisc > 0 && it.product_id) {
                                const [rules] = await connection.query(
                                    `SELECT id FROM product_discount_rules 
                                     WHERE product_id = ? AND company_id = ? AND active = 1
                                     AND (start_date IS NULL OR start_date <= CURDATE())
                                     AND (end_date IS NULL OR end_date >= CURDATE())`,
                                    [it.product_id, req.company_id]
                                );
                                const [custRules] = await connection.query(
                                    `SELECT id FROM customer_product_discounts 
                                     WHERE customer_id = ? AND product_id = ? AND branch_id = ? AND company_id = ?`,
                                    [header.customer_id || 0, it.product_id, effectiveBranchId, req.company_id]
                                );
                                const [promoRules] = await connection.query(
                                    `SELECT sp.id 
                                     FROM sales_promotions sp
                                     JOIN sales_promotion_products spp ON sp.id = spp.promotion_id
                                     WHERE spp.product_id = ? AND sp.company_id = ? AND sp.active = 1
                                     AND (sp.branch_id IS NULL OR sp.branch_id = ?)
                                     AND (sp.start_date IS NULL OR sp.start_date <= CURDATE())
                                     AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())`,
                                    [it.product_id, req.company_id, effectiveBranchId]
                                );
                                if (rules.length === 0 && custRules.length === 0 && promoRules.length === 0) {
                                    hasManualDiscount = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (hasManualDiscount) {
                        await connection.rollback();
                        return res.status(400).json({
                            message: `El total de descuentos aplicados ($${totalDiscounts.toFixed(2)}) supera el monto máximo permitido por ticket para la sucursal ($${maxAmount.toFixed(2)}).`,
                            success: false
                        });
                    }
                }

                // Validar porcentaje máximo de margen
                if (maxPercentage !== null) {
                    for (const it of items) {
                        const itDisc = parseFloat(it.monto_descuento) || 0;
                        if (itDisc > 0) {
                            const qty = parseFloat(it.cantidad) || 1;
                            const unitPrice = parseFloat(it.precio_unitario) || 0;
                            const lineGross = qty * unitPrice;
                            if (lineGross > 0) {
                                const effectiveItemPct = (itDisc / lineGross) * 100;
                                if (effectiveItemPct > (maxPercentage + 0.05)) {
                                    let isAuthorizedRule = false;
                                    if (it.product_id) {
                                        const [prodRules] = await connection.query(
                                            `SELECT id FROM product_discount_rules 
                                             WHERE product_id = ? AND company_id = ? AND active = 1
                                             AND (start_date IS NULL OR start_date <= CURDATE())
                                             AND (end_date IS NULL OR end_date >= CURDATE())`,
                                            [it.product_id, req.company_id]
                                        );
                                        if (prodRules.length > 0) isAuthorizedRule = true;
                                    }
                                    if (!isAuthorizedRule && header.customer_id && it.product_id) {
                                        const [custRules] = await connection.query(
                                            `SELECT id FROM customer_product_discounts 
                                             WHERE customer_id = ? AND product_id = ? AND branch_id = ? AND company_id = ?`,
                                            [header.customer_id, it.product_id, effectiveBranchId, req.company_id]
                                        );
                                        if (custRules.length > 0) isAuthorizedRule = true;
                                    }
                                    if (!isAuthorizedRule && it.product_id) {
                                        const [promoRules] = await connection.query(
                                            `SELECT sp.id 
                                             FROM sales_promotions sp
                                             JOIN sales_promotion_products spp ON sp.id = spp.promotion_id
                                             WHERE spp.product_id = ? AND sp.company_id = ? AND sp.active = 1
                                             AND (sp.branch_id IS NULL OR sp.branch_id = ?)
                                             AND (sp.start_date IS NULL OR sp.start_date <= CURDATE())
                                             AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())`,
                                            [it.product_id, req.company_id, effectiveBranchId]
                                        );
                                        if (promoRules.length > 0) isAuthorizedRule = true;
                                    }
                                    if (!isAuthorizedRule) {
                                        await connection.rollback();
                                        return res.status(400).json({
                                            message: `El producto "${it.descripcion || 'Ítem'}" tiene un descuento de ${effectiveItemPct.toFixed(1)}%, que supera el porcentaje máximo autorizado para la sucursal (${maxPercentage}%).`,
                                            success: false
                                        });
                                    }
                                }
                            }
                        }
                    }

                    if (generalDiscount > 0) {
                        const totalGravado = parseFloat(header.total_gravado || 0);
                        const baseGeneral = totalGravado + generalDiscount;
                        if (baseGeneral > 0) {
                            const genPct = (generalDiscount / baseGeneral) * 100;
                            if (genPct > (maxPercentage + 0.05)) {
                                await connection.rollback();
                                return res.status(400).json({
                                    message: `El descuento general representa un ${genPct.toFixed(1)}%, superando el porcentaje máximo autorizado para la sucursal (${maxPercentage}%).`,
                                    success: false
                                });
                            }
                        }
                    }
                }
            }
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
        const branchId = req.user?.branch_id || header.branch_id || null;
        const lubricantCategoryIds = await getLubricantCategoryIds(connection, req.company_id, branchId);

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
                    const isLubricant = await isLubricantProduct(connection, req.company_id, branchId, effectiveProductId, lubricantCategoryIds);
                    
                    if (header.dte_type !== '04' && !isLubricant) {
                        await connection.query(`
                            INSERT INTO inventory (company_id, product_id, branch_id, stock)
                            VALUES (?, ?, ?, -?)
                            ON DUPLICATE KEY UPDATE stock = stock - ?
                        `, [req.company_id, effectiveProductId, req.user.branch_id, totalQty, totalQty]);

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
                const isLubricant = await isLubricantProduct(connection, req.company_id, branchId, effectiveProductId, lubricantCategoryIds);
                
                if (header.dte_type !== '04' && !isLubricant) {
                    await connection.query(`
                        INSERT INTO inventory (company_id, product_id, branch_id, stock)
                        VALUES (?, ?, ?, -?)
                        ON DUPLICATE KEY UPDATE stock = stock - ?
                    `, [req.company_id, effectiveProductId, req.user.branch_id, item.cantidad, item.cantidad]);

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
                let docNum = (doc.doc_number || '').trim().toUpperCase();
                let genType = doc.generation_type;

                // Si el documento enviado es un número de control (DTE-...), resolver al UUID oficial de Hacienda
                if (docNum.startsWith('DTE-')) {
                    const [dteRows] = await connection.query(
                        'SELECT codigo_generacion FROM dtes WHERE (numero_control = ? OR codigo_generacion = ?) AND company_id = ? LIMIT 1',
                        [docNum, docNum, req.company_id]
                    );
                    if (dteRows.length > 0 && dteRows[0].codigo_generacion) {
                        docNum = dteRows[0].codigo_generacion;
                        genType = 1;
                    }
                } else if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(docNum)) {
                    genType = 1;
                } else if (!genType) {
                    genType = 2;
                }

                doc.doc_number = docNum;
                doc.generation_type = genType;

                await connection.query('INSERT INTO sales_linked_documents SET ?', [{
                    sale_id: saleId,
                    doc_type: doc.doc_type || null,
                    doc_number: docNum,
                    emission_date: doc.emission_date || null,
                    generation_type: genType,
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
                linkedDocuments: linkedDocuments,
                items: (req.body.items || []).map(it => ({
                    ...it,
                    referencedDoc: (header.dte_type === '05' && linkedDocuments && linkedDocuments.length === 1)
                        ? linkedDocuments[0].doc_number
                        : (it.referencedDoc || null)
                })),
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
            const isContingency = Boolean(dteResult?.contingency || dteInfo.contingency);
            await connection.query('UPDATE sales_headers SET ? WHERE id = ?', [{
                codigo_generacion: dteInfo.codigo_generacion,
                numero_control: dteInfo.numero_control || null,
                sello_recepcion: dteInfo.sello_recepcion || null,
                fh_procesamiento: dteInfo.fh_procesamiento || null,
                estado: isContingency ? 'contingencia' : 'emitido'
            }, saleId]);

            await connection.query(
                'UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?',
                [saleId, dteInfo.codigo_generacion, req.company_id]
            );
        // 6b. Control de Envases Retornables (Cubetas y Tapaderas de Huevo Industrial)
        try {
            await eggReturnableService.recordSaleReturnables(connection, {
                company_id: req.company_id,
                customer_id: header.customer_id,
                customer_name: header.cliente_nombre,
                sale_id: saleId,
                dte_type: header.dte_type,
                numero_control: dteInfo.numero_control,
                items: items,
                user_name: req.user?.nombre || req.user?.username || 'Facturación Automática',
                fecha_emision: header.fecha_emision || new Date()
            });
        } catch (returnableErr) {
            console.error('[SalesController] Error registrando envases retornables:', returnableErr);
        }

        await connection.commit();

        // 7. Enviar correo de notificación en background vía cola BullMQ (después del commit)
        if (dteInfo.codigo_generacion && dteResult && dteResult.success) {
            mailerService.queueDTEEmail(saleId, req.company_id).catch(err => {
                console.error(`[PostSaleProcess] Error encolando correo para venta ${saleId}:`, err.message);
            });
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
            whereClause += ' AND (c.nombre LIKE ? OR h.cliente_nombre LIKE ? OR h.numero_control LIKE ? OR h.codigo_generacion LIKE ? OR c.nit LIKE ? OR c.numero_documento LIKE ? OR h.observaciones LIKE ?)';
            whereParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        const docType = tipo_documento || dte_type;
        if (docType && docType !== 'all') {
            if (docType === 'COMPLEMENTARIA') {
                whereClause += " AND h.observaciones LIKE '%Complementaria%'";
            } else {
                whereClause += ' AND (h.tipo_documento = ? OR h.dte_type = ?)';
                whereParams.push(docType, docType);
            }
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
            total: totalItems,
            totalItems: totalItems,
            page: parseInt(page) || 1,
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
            comp.razon_social as company_razon_social, comp.nombre_comercial as company_nombre_comercial,
            comp.nit as company_nit, comp.nrc as company_nrc,
            b.direccion as branch_address,
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

        // Liberar paradas de despacho de huevo si la venta fue generada desde una ruta
        try {
            await pool.query(
                'UPDATE egg_dispatch_stops SET sale_id = NULL, dte_codigo_generacion = NULL, estado_entrega = "pendiente" WHERE sale_id = ?',
                [id]
            );
        } catch (dispatchErr) {
            console.warn('[VoidSale] Error desvinculando parada de despacho de huevo:', dispatchErr.message);
        }

        // 5. Restaurar Stock e Inventario (en su propia transacción)
        //    Si falla, el estado ya quedó como "anulado" y el usuario puede corregir stock manualmente
        connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [items] = await connection.query('SELECT * FROM sales_items WHERE sale_id = ?', [id]);
            const lubricantCategoryIds = await getLubricantCategoryIds(connection, req.company_id, sale.branch_id);

            for (const item of items) {
                if (item.combo_id) {
                    const [comboItems] = await connection.query(
                        'SELECT product_id, quantity FROM product_combo_items WHERE combo_id = ?',
                        [item.combo_id]
                    );

                    for (const ci of comboItems) {
                        const totalQty = ci.quantity * item.cantidad;
                        const effectiveProductId = await getEffectiveProductId(connection, ci.product_id);
                        const isLubricant = await isLubricantProduct(connection, req.company_id, sale.branch_id, effectiveProductId, lubricantCategoryIds);

                        if (!isLubricant) {
                            await connection.query(`
                                INSERT INTO inventory (company_id, product_id, branch_id, stock)
                                VALUES (?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE stock = stock + ?
                            `, [req.company_id, effectiveProductId, sale.branch_id, totalQty, totalQty]);

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
                    }
                } else if (item.product_id) {
                    const effectiveProductId = await getEffectiveProductId(connection, item.product_id);
                    const isLubricant = await isLubricantProduct(connection, req.company_id, sale.branch_id, effectiveProductId, lubricantCategoryIds);

                    if (!isLubricant) {
                        await connection.query(`
                            INSERT INTO inventory (company_id, product_id, branch_id, stock)
                            VALUES (?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE stock = stock + ?
                        `, [req.company_id, effectiveProductId, sale.branch_id, item.cantidad, item.cantidad]);

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
            mailerService.queueInvalidatedDTEEmail(id, req.company_id).catch(err => {
                console.error('[VoidSale] Error al encolar correo de invalidación:', err.message);
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

// --- CAMBIO DE TURNO Y ACTUALIZACIÓN DE CLIENTE ---
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
const updateSaleCustomer = async (req, res) => {
    const { id } = req.params;
    const {
        nombre,
        nombre_comercial,
        tipo_documento,
        numero_documento,
        nit,
        nrc,
        codigo_actividad,
        departamento,
        municipio,
        direccion,
        telefono,
        correo,
        retransmit
    } = req.body;

    try {
        const [sales] = await pool.query(
            'SELECT id, customer_id, company_id, codigo_generacion FROM sales_headers WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );

        if (sales.length === 0) {
            return res.status(404).json({ success: false, message: 'Venta no encontrada' });
        }

        const sale = sales[0];
        let customerId = sale.customer_id;

        if (nit && String(nit).trim()) {
            const nitVal = validateDocumentNumber(nit, 'NIT');
            if (!nitVal.isValid) {
                return res.status(400).json({ success: false, message: `NIT inválido: ${nitVal.error}` });
            }
        }
        if (numero_documento && String(numero_documento).trim()) {
            const docVal = validateDocumentNumber(numero_documento, tipo_documento);
            if (!docVal.isValid) {
                return res.status(400).json({ success: false, message: `Documento inválido: ${docVal.error}` });
            }
        }

        const customerPayload = {
            company_id: req.company_id,
            nombre: nombre ? String(nombre).trim() : null,
            nombre_comercial: nombre_comercial ? String(nombre_comercial).trim() : null,
            tipo_documento: tipo_documento || 'DUI',
            numero_documento: numero_documento ? String(numero_documento).trim() : null,
            nit: nit ? String(nit).trim() : (numero_documento ? String(numero_documento).trim() : null),
            nrc: nrc ? String(nrc).trim() : null,
            codigo_actividad: codigo_actividad ? String(codigo_actividad).trim() : null,
            departamento: departamento || null,
            municipio: municipio || null,
            direccion: direccion ? String(direccion).trim() : null,
            telefono: telefono ? String(telefono).trim() : null,
            correo: correo ? String(correo).trim() : null
        };

        if (customerId) {
            // Actualizar cliente existente
            await pool.query('UPDATE customers SET ? WHERE id = ? AND company_id = ?', [customerPayload, customerId, req.company_id]);
        } else {
            // Crear cliente nuevo y asociarlo a la venta
            const [insertResult] = await pool.query('INSERT INTO customers SET ?', [customerPayload]);
            customerId = insertResult.insertId;
        }

        // Actualizar la cabecera de venta para reflejar el nombre y customer_id
        await pool.query(
            'UPDATE sales_headers SET customer_id = ?, cliente_nombre = ? WHERE id = ? AND company_id = ?',
            [customerId, customerPayload.nombre, id, req.company_id]
        );

        // Si se solicita retransmisión inmediata:
        let retransmitResult = null;
        if (retransmit === true) {
            const [updatedSales] = await pool.query(
                `SELECT s.*, c.dte_active, d.status as dte_status 
                 FROM sales_headers s 
                 JOIN companies c ON s.company_id = c.id 
                 LEFT JOIN dtes d ON s.codigo_generacion = d.codigo_generacion
                 WHERE s.id = ? AND s.company_id = ?`,
                [id, req.company_id]
            );
            if (updatedSales.length > 0 && updatedSales[0].codigo_generacion) {
                const uSale = updatedSales[0];
                retransmitResult = await dteService.retransmitDTE(uSale, uSale.codigo_generacion);
                if (retransmitResult.success) {
                    await pool.query(
                        'UPDATE sales_headers SET sello_recepcion = ?, fh_procesamiento = ? WHERE id = ?',
                        [retransmitResult.data.sello_recepcion, retransmitResult.data.fh_procesamiento, id]
                    );
                    await pool.query(
                        'UPDATE dtes SET status = "ACCEPTED", respuesta_hacienda = NULL, sello_recepcion = ?, fh_procesamiento = ? WHERE codigo_generacion = ?',
                        [retransmitResult.data.sello_recepcion, retransmitResult.data.fh_procesamiento, uSale.codigo_generacion]
                    );
                    mailerService.queueDTEEmail(id, req.company_id).catch(() => {});
                }
            }
        }

        return res.json({
            success: true,
            message: retransmitResult?.success ? 'Cliente actualizado y DTE transmitido con éxito a Hacienda' : 'Cliente actualizado correctamente',
            customer_id: customerId,
            retransmitResult
        });
    } catch (error) {
        console.error('[updateSaleCustomer] Error:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar cliente de la venta', error: error.message });
    }
};

module.exports = {
    createSale,
    getSales,
    getSaleById,
    voidSale,
    changeSalesShift,
    updateSaleCustomer
};
