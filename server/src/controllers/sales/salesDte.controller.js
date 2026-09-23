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
    resolveActividadOficial
} = require('./salesUtils');


// --- GESTIÓN, TRANSMISIÓN Y CONSULTA DE DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS (DTE) ---
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
            const lubricantCategoryIds = await getLubricantCategoryIds(connection, req.company_id, sale.branch_id);

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
                        const isLubricant = await isLubricantProduct(connection, req.company_id, sale.branch_id, effectiveProductId, lubricantCategoryIds);

                        if (sale.dte_type !== '04' && sale.tipo_documento !== '04' && !isLubricant) {
                            await connection.query(`
                                INSERT INTO inventory (company_id, product_id, branch_id, stock)
                                VALUES (?, ?, ?, -?)
                                ON DUPLICATE KEY UPDATE stock = stock - ?
                            `, [req.company_id, effectiveProductId, sale.branch_id, totalQty, totalQty]);
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
                    const isLubricant = await isLubricantProduct(connection, req.company_id, sale.branch_id, effectiveProductId, lubricantCategoryIds);

                    if (sale.dte_type !== '04' && sale.tipo_documento !== '04' && !isLubricant) {
                        await connection.query(`
                            INSERT INTO inventory (company_id, product_id, branch_id, stock)
                            VALUES (?, ?, ?, -?)
                            ON DUPLICATE KEY UPDATE stock = stock - ?
                        `, [req.company_id, effectiveProductId, sale.branch_id, item.cantidad, item.cantidad]);
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

            // Sincronizar parada de despacho si la venta provino de despacho
            try {
                await connection.query(
                    'UPDATE egg_dispatch_stops SET sale_id = ?, dte_codigo_generacion = ? WHERE sale_id = ?',
                    [newSaleId, dteInfo.codigo_generacion, id]
                );
            } catch (_) {}

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
            'UPDATE sales_headers SET codigo_generacion = ?, numero_control = ?, sello_recepcion = ?, fh_procesamiento = ?, estado = "emitido" WHERE id = ?',
            [dteInfo.codigo_generacion, dteInfo.numero_control, dteInfo.sello_recepcion || null, dteInfo.fh_procesamiento || null, id]
        );

        // Sincronizar parada de despacho si la venta provino de despacho
        try {
            await connection.query(
                'UPDATE egg_dispatch_stops SET dte_codigo_generacion = ? WHERE sale_id = ?',
                [dteInfo.codigo_generacion, id]
            );
        } catch (_) {}
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

/**
 * Obtiene o genera el diagnóstico inteligente con IA para un DTE rechazado por Hacienda.
 * Revisa primero el caché en `dte_diagnoses` (0 ms); si no existe, consulta DeepSeek / Gemini.
 */
const getDteDiagnosis = async (req, res) => {
    const { id } = req.params;
    const { force } = req.query;

    try {
        // 1. Verificar si ya existe en caché persistente en base de datos
        if (force !== 'true') {
            const [cached] = await pool.query(
                'SELECT * FROM dte_diagnoses WHERE sale_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1',
                [id, req.company_id]
            );
            if (cached.length > 0) {
                return res.json({
                    success: true,
                    cached: true,
                    data: cached[0]
                });
            }
        }

        // 2. Obtener datos de la venta, cliente y respuesta de Hacienda
        const [sales] = await pool.query(`
            SELECT h.*, 
                   COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as customer_name,
                   c.tipo_documento as customer_tipo_doc,
                   COALESCE(c.nit, c.numero_documento) as customer_nit,
                   c.nrc as customer_nrc,
                   c.codigo_actividad as customer_actividad_economica,
                   c.direccion as customer_address,
                   c.departamento as customer_departamento,
                   c.municipio as customer_municipio,
                   c.correo as customer_email,
                   COALESCE(d_c.status, d_v.status) as dte_status,
                   COALESCE(d_c.codigo_generacion, d_v.codigo_generacion, h.codigo_generacion) as dte_codigo_generacion,
                   COALESCE(d_c.numero_control, d_v.numero_control, h.numero_control) as dte_numero_control,
                   COALESCE(d_c.respuesta_hacienda, d_v.respuesta_hacienda) as dte_respuesta_hacienda
            FROM sales_headers h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
            LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
            WHERE h.id = ? AND h.company_id = ?
        `, [id, req.company_id]);

        if (sales.length === 0) {
            return res.status(404).json({ success: false, message: 'Venta no encontrada' });
        }

        const sale = sales[0];
        let errorData = sale.dte_respuesta_hacienda;
        if (typeof errorData === 'string') {
            try { errorData = JSON.parse(errorData); } catch (e) {}
        }

        const tipoDocName = getDteTypeName(sale.tipo_documento);

        // 3. Invocar al servicio de IA (DeepSeek en la nube con fallback a Gemini Flash y heurística)
        const diagResult = await aiService.diagnoseDteError({
            errorData: errorData || { mensaje: 'Documento en estado rechazado sin detalle de Hacienda' },
            dteInfo: {
                tipo_documento: sale.tipo_documento,
                tipo_documento_name: tipoDocName,
                codigo_generacion: sale.dte_codigo_generacion,
                numero_control: sale.dte_numero_control,
                total_pagar: sale.total_pagar
            },
            customerInfo: {
                nombre: sale.customer_name,
                tipo_documento: sale.customer_tipo_doc,
                num_documento: sale.customer_nit,
                nrc: sale.customer_nrc,
                actividad_economica: sale.customer_actividad_economica,
                direccion: sale.customer_address,
                departamento: sale.customer_departamento,
                municipio: sale.customer_municipio,
                correo: sale.customer_email
            }
        });

        // 4. Guardar en la tabla de caché dte_diagnoses
        const codigoMsg = errorData?.codigoMsg || (typeof errorData === 'string' ? 'RECHAZO' : null);
        const rawStr = typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData || '');

        const insertData = {
            sale_id: sale.id,
            codigo_generacion: sale.dte_codigo_generacion || null,
            company_id: req.company_id,
            codigo_msg: codigoMsg,
            error_raw: rawStr,
            que_paso: diagResult.data.quePaso,
            normativa: diagResult.data.normativa,
            solucion: diagResult.data.solucion,
            tipo_correccion: diagResult.data.tipoCorreccion,
            provider: diagResult.provider
        };

        const [insertResult] = await pool.query('INSERT INTO dte_diagnoses SET ?', [insertData]);
        insertData.id = insertResult.insertId;
        insertData.created_at = new Date();

        res.json({
            success: true,
            cached: false,
            data: insertData
        });
    } catch (error) {
        console.error('[getDteDiagnosis] Error generando diagnóstico:', error);
        res.status(500).json({ success: false, message: 'Error al generar diagnóstico DTE con IA', error: error.message });
    }
};

/**
 * Actualiza los datos del cliente de una venta (y en la tabla customers)
 * para corregir rechazos DTE de Hacienda, con opción de retransmisión inmediata.
 */

module.exports = {
    notifyDTEAccepted,
    retransmitSaleDTE,
    regenerateDTE,
    getDTEJson,
    resendDTEEmail,
    editDTEItems,
    getDTEByCodigoGeneracion,
    getDteStats,
    getDteDiagnosis,
    checkExistingCR
};
