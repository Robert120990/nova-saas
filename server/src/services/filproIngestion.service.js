const pool = require('../config/db');

class FilproIngestionService {
    /**
     * Ingest a single DTE into Nova SaaS
     * @param {Object} params
     * @param {number} params.companyId
     * @param {number} params.branchId
     * @param {number} params.userId
     * @param {Object} params.dteSummary (from FilPro report: uuid, numero_control, status, etc.)
     * @param {Object} params.officialJson (downloaded from Infile certifier)
     * @returns {Promise<Object>} Ingestion outcome
     */
    async ingestDte({ companyId, branchId, userId, dteSummary, officialJson }) {
        const uuid = (dteSummary.uuid || officialJson.identificacion?.codigoGeneracion || '').trim();
        const numeroControl = (dteSummary.numero_control || officialJson.identificacion?.numeroControl || '').trim();
        const tipoDte = dteSummary.tipo_dte || officialJson.identificacion?.tipoDte || '01';

        if (!uuid) {
            return { status: 'error', reason: 'missing_uuid', message: 'No se encontró el UUID / código de generación del DTE' };
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Idempotency Check: Verify if DTE already exists
            const [existingDtes] = await connection.query(
                'SELECT id, venta_id, status FROM dtes WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                [uuid, companyId]
            );

            const isAnuladoInFilpro = (dteSummary.status === 'ANULADO' || dteSummary.status === 'INVALIDADO');

            if (existingDtes.length > 0) {
                const existingDte = existingDtes[0];

                // If FilPro marks it as ANULADO but in Nova it's still ACCEPTED/emitido, update it
                if (isAnuladoInFilpro && existingDte.status !== 'INVALIDADO') {
                    await connection.query(
                        "UPDATE dtes SET status = 'INVALIDADO' WHERE id = ?",
                        [existingDte.id]
                    );

                    if (existingDte.venta_id) {
                        await connection.query(
                            "UPDATE sales_headers SET estado = 'ANULADO' WHERE id = ?",
                            [existingDte.venta_id]
                        );
                    }

                    await connection.commit();
                    return {
                        status: 'updated_anulado',
                        uuid,
                        numeroControl,
                        message: 'DTE ya existía y fue actualizado a estado ANULADO/INVALIDADO'
                    };
                }

                await connection.rollback();
                return {
                    status: 'skipped',
                    uuid,
                    numeroControl,
                    reason: 'already_exists',
                    message: `DTE ya importado previamente (ID: ${existingDte.id})`
                };
            }

            // Also check by sales_headers.codigo_generacion
            const [existingSales] = await connection.query(
                'SELECT id FROM sales_headers WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                [uuid, companyId]
            );
            if (existingSales.length > 0) {
                await connection.rollback();
                return {
                    status: 'skipped',
                    uuid,
                    numeroControl,
                    reason: 'already_exists',
                    message: `Venta ya existente con este código de generación (ID: ${existingSales[0].id})`
                };
            }

            // 2. Parse DTE Content
            const identificacion = officialJson.identificacion || {};
            const emisor = officialJson.emisor || {};
            const receptor = officialJson.receptor || {};
            const cuerpoDocumento = Array.isArray(officialJson.cuerpoDocumento) ? officialJson.cuerpoDocumento : [];
            const resumen = officialJson.resumen || {};

            // Emission date & time
            const fecEmi = identificacion.fecEmi || (dteSummary.fecha_certificacion ? dteSummary.fecha_certificacion.substring(0, 10) : new Date().toISOString().substring(0, 10));
            const horEmi = identificacion.horEmi || (dteSummary.fecha_certificacion ? dteSummary.fecha_certificacion.substring(11, 19) : '00:00:00');

            // Totals
            const totalGravado = parseFloat(resumen.totalGravada || 0);
            const totalExento = parseFloat(resumen.totalExenta || 0);
            const totalNoSujeto = parseFloat(resumen.totalNoSuj || 0);
            const subTotal = parseFloat(resumen.subTotal || (totalGravado + totalExento + totalNoSujeto));
            const totalDescuento = parseFloat(resumen.totalDescu || 0);
            const totalPagar = parseFloat(resumen.totalPagar || dteSummary.monto_total || 0);

            // Calculate taxes from tributos array (FOVIAL, COTRANS, IVA)
            let totalIva = 0;
            let totalFovial = 0;
            let totalCotrans = 0;
            let totalRetencion = parseFloat(resumen.ivaRete1 || resumen.reteRenta || 0);
            let totalPercepcion = 0;

            const tributosArray = Array.isArray(resumen.tributos) ? resumen.tributos : [];
            for (const trib of tributosArray) {
                const code = String(trib.codigo || '');
                const val = parseFloat(trib.valor || 0);
                if (code === '20') totalIva += val;
                else if (code === 'D1') totalFovial += val;
                else if (code === 'C8') totalCotrans += val;
                else if (code === '22') totalRetencion += val;
                else if (code === 'C3') totalPercepcion += val;
            }

            // Fallback IVA if CCF (03) has separate IVA or if not explicitly in tributos
            if (totalIva === 0 && tipoDte === '03' && totalGravado > 0) {
                totalIva = parseFloat((totalGravado * 0.13).toFixed(2));
            }

            // Sello de recepción
            const selloRecepcion = officialJson.selloRecepcion ||
                                  officialJson.respuestaHacienda?.selloRecibido ||
                                  dteSummary.identificador ||
                                  'CERTIFICADO_INFILE';

            // 3. Resolve or Create Customer (Receptor)
            let customerId = null;
            let clienteNombre = (receptor.nombre || dteSummary.nombre_receptor || '').trim() || null;

            const docNum = (receptor.numDocumento || dteSummary.nit_receptor || '').trim();
            const nrcNum = (receptor.nrc || '').trim();

            if (docNum || nrcNum) {
                const [custMatches] = await connection.query(`
                    SELECT id, nombre FROM customers 
                    WHERE company_id = ? 
                      AND ((nit IS NOT NULL AND nit = ?) 
                           OR (numero_documento IS NOT NULL AND numero_documento = ?) 
                           OR (nrc IS NOT NULL AND nrc = ?))
                    LIMIT 1
                `, [companyId, docNum, docNum, nrcNum]);

                if (custMatches.length > 0) {
                    customerId = custMatches[0].id;
                    if (!clienteNombre) clienteNombre = custMatches[0].nombre;
                } else if (clienteNombre) {
                    // Create new customer
                    const tipoDocMH = receptor.tipoDocumento || (docNum.length === 9 ? '13' : '36');
                    const [custResult] = await connection.query('INSERT INTO customers SET ?', [{
                        company_id: companyId,
                        nombre: clienteNombre,
                        nombre_comercial: receptor.nombreComercial || null,
                        tipo_documento: tipoDocMH,
                        numero_documento: docNum || null,
                        nit: docNum || null,
                        nrc: nrcNum || null,
                        codigo_actividad: receptor.codActividad || null,
                        direccion: receptor.direccion?.complemento || 'Ciudad',
                        departamento: receptor.direccion?.departamento || null,
                        municipio: receptor.direccion?.municipio || null,
                        telefono: receptor.telefono || null,
                        correo: receptor.correo || null,
                        tipo_persona: nrcNum ? '2' : '1',
                        condicion_fiscal: 'contribuyente',
                        pais: '9579',
                        tipo_operacion: 'local',
                        created_at: new Date()
                    }]);
                    customerId = custResult.insertId;
                }
            }

            // 4. Ensure a Comodin Product exists for fallback
            let comodinProductId = null;
            const [comodinRows] = await connection.query(
                "SELECT id FROM products WHERE company_id = ? AND codigo = 'COMODIN_FILPRO' LIMIT 1",
                [companyId]
            );

            if (comodinRows.length > 0) {
                comodinProductId = comodinRows[0].id;
            } else {
                const [newComodin] = await connection.query('INSERT INTO products SET ?', [{
                    company_id: companyId,
                    codigo: 'COMODIN_FILPRO',
                    nombre: 'Ítem General FilPro (Comodín)',
                    descripcion: 'Producto comodín para ítems importados de FilPro',
                    costo: 0,
                    unidad_medida: '59', // Unidad
                    tipo_item: '1', // Bien
                    tipo_operacion: 1, // Gravada
                    es_exento: 0,
                    status: 'activo',
                    afecta_inventario: 0,
                    created_at: new Date()
                }]);
                comodinProductId = newComodin.insertId;

                await connection.query(
                    'INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE precio_unitario = 0',
                    [comodinProductId, branchId]
                ).catch(() => {});
            }

            // 5. Insert sales_headers
            const condicionOperacion = parseInt(resumen.condicionOperacion, 10) || 1; // 1: Contado, 2: Credito
            const saleEstado = isAnuladoInFilpro ? 'ANULADO' : 'emitido';

            const [saleHeaderResult] = await connection.query('INSERT INTO sales_headers SET ?', [{
                company_id: companyId,
                branch_id: branchId,
                customer_id: customerId,
                seller_id: null,
                pos_id: null,
                shift_id: null,
                dte_type: tipoDte,
                tipo_documento: tipoDte,
                numero_control: numeroControl,
                codigo_generacion: uuid,
                sello_recepcion: selloRecepcion,
                condicion_operacion: condicionOperacion,
                payment_condition: condicionOperacion,
                estado: saleEstado,
                fecha_emision: fecEmi,
                hora_emision: horEmi,
                total_gravado: totalGravado,
                total_exento: totalExento,
                total_nosujetas: totalNoSujeto,
                fovial: totalFovial,
                cotrans: totalCotrans,
                total_iva: totalIva,
                descuento_general: totalDescuento,
                iva_percibido: totalPercepcion,
                iva_retenido: totalRetencion,
                total_pagar: totalPagar,
                cliente_nombre: clienteNombre,
                observaciones: `Importado de FilPro (${dteSummary.nombre_establecimiento || ''})`.trim(),
                created_at: new Date()
            }]);

            const saleId = saleHeaderResult.insertId;

            // 6. Process sales_items (Rule: use system description if mapped or product exists; fallback to FilPro description only if no match, NO stock deduction)
            for (const item of cuerpoDocumento) {
                const itemCode = (item.codigo || '').trim();
                const itemDesc = (item.descripcion || '').trim() || 'Ítem sin descripción';
                const itemQty = parseFloat(item.cantidad) || 1;
                const itemPrecio = parseFloat(item.precioUni) || 0;
                const itemDescu = parseFloat(item.montoDescu) || 0;
                const itemGrav = parseFloat(item.ventaGravada) || 0;
                const itemExen = parseFloat(item.ventaExenta) || 0;
                const itemTributos = Array.isArray(item.tributos) ? item.tributos : (item.codTributo ? [String(item.codTributo)] : ['20']);

                let targetProductId = comodinProductId;
                let targetProductCode = itemCode || 'FILPRO';
                let targetDescription = itemDesc;

                if (itemCode) {
                    // 1. Check custom mapping configured in filpro_product_mappings
                    const [mappedRows] = await connection.query(
                        `SELECT m.product_id, p.codigo as system_code, p.nombre as system_name, p.descripcion as system_desc 
                         FROM filpro_product_mappings m 
                         JOIN products p ON m.product_id = p.id 
                         WHERE m.company_id = ? AND m.filpro_code = ? LIMIT 1`,
                        [companyId, itemCode]
                    );

                    if (mappedRows.length > 0) {
                        targetProductId = mappedRows[0].product_id;
                        targetProductCode = mappedRows[0].system_code || itemCode;
                        targetDescription = (mappedRows[0].system_name || mappedRows[0].system_desc || '').trim() || itemDesc;
                    } else {
                        // 2. Direct code match in products table
                        const [prodMatch] = await connection.query(
                            'SELECT id, codigo, nombre, descripcion FROM products WHERE company_id = ? AND codigo = ? LIMIT 1',
                            [companyId, itemCode]
                        );
                        if (prodMatch.length > 0) {
                            targetProductId = prodMatch[0].id;
                            targetProductCode = prodMatch[0].codigo || itemCode;
                            targetDescription = (prodMatch[0].nombre || prodMatch[0].descripcion || '').trim() || itemDesc;
                        }
                    }
                }

                await connection.query('INSERT INTO sales_items SET ?', [{
                    sale_id: saleId,
                    product_id: targetProductId,
                    codigo: targetProductCode,
                    combo_id: null,
                    descripcion: targetDescription,
                    cantidad: itemQty,
                    precio_unitario: itemPrecio,
                    monto_descuento: itemDescu,
                    venta_gravada: itemGrav,
                    venta_exenta: itemExen,
                    tributos: JSON.stringify(itemTributos)
                }]);
            }

            // 7. Process sales_payments
            const pagosArray = Array.isArray(resumen.pagos) ? resumen.pagos : [];
            if (pagosArray.length > 0) {
                for (const pago of pagosArray) {
                    await connection.query('INSERT INTO sales_payments SET ?', [{
                        sale_id: saleId,
                        metodo_pago: String(pago.codigo || '01'),
                        monto: parseFloat(pago.montoPago) || totalPagar,
                        referencia: pago.referencia || null
                    }]);
                }
            } else {
                await connection.query('INSERT INTO sales_payments SET ?', [{
                    sale_id: saleId,
                    metodo_pago: condicionOperacion === 2 ? '02' : '01',
                    monto: totalPagar,
                    referencia: null
                }]);
            }

            // 8. Insert into dtes table
            const dteStatus = isAnuladoInFilpro ? 'INVALIDADO' : 'ACCEPTED';
            const fhProcesamiento = dteSummary.fecha_certificacion ? new Date(dteSummary.fecha_certificacion) : new Date();

            await connection.query('INSERT INTO dtes SET ?', [{
                codigo_generacion: uuid,
                numero_control: numeroControl,
                tipo_dte: tipoDte,
                company_id: companyId,
                branch_id: branchId,
                usuario_id: userId,
                status: dteStatus,
                ambiente: '01', // Producción
                json_original: JSON.stringify(officialJson),
                json_firmado: officialJson.firmaElectronica || null,
                sello_recepcion: selloRecepcion,
                fh_procesamiento: fhProcesamiento,
                venta_id: saleId,
                created_at: new Date()
            }]);

            await connection.commit();

            return {
                status: 'imported',
                saleId,
                uuid,
                numeroControl,
                total: totalPagar,
                tipoDte,
                message: `DTE importado exitosamente como Venta #${saleId}`
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Revert / Delete an ingested DTE and its corresponding sale from Nova SaaS
     * @param {Object} params
     * @param {number} params.companyId
     * @param {string} [params.uuid]
     * @param {number} [params.saleId]
     * @param {number} [params.userId]
     * @returns {Promise<Object>}
     */
    async revertDte({ companyId, uuid, saleId, userId }) {
        if (!uuid && !saleId) {
            throw new Error('Debe proporcionar el UUID o el ID de la venta para revertir');
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Find target sale and DTE with strict company_id isolation
            let query = `
                SELECT s.id as sale_id, s.codigo_generacion, s.observaciones, s.fecha_emision, d.id as dte_id 
                FROM sales_headers s 
                LEFT JOIN dtes d ON s.id = d.venta_id OR s.codigo_generacion = d.codigo_generacion 
                WHERE s.company_id = ?
            `;
            const params = [companyId];

            if (saleId) {
                query += ' AND s.id = ?';
                params.push(saleId);
            } else if (uuid) {
                query += ' AND (s.codigo_generacion = ? OR d.codigo_generacion = ?)';
                params.push(uuid, uuid);
            }
            query += ' LIMIT 1';

            const [rows] = await connection.query(query, params);

            let targetDteId = null;
            let targetSaleId = null;
            let targetUuid = uuid;
            let targetDate = null;

            if (rows.length > 0) {
                targetSaleId = rows[0].sale_id;
                targetDteId = rows[0].dte_id;
                targetUuid = rows[0].codigo_generacion || uuid;
                targetDate = rows[0].fecha_emision;

                // Safety validation: only allow reverting sales imported from FilPro
                const isFilpro = (rows[0].observaciones && rows[0].observaciones.includes('Importado de FilPro')) || targetDteId;
                if (!isFilpro) {
                    throw new Error('Solo se permite revertir ventas importadas de FilPro');
                }
            } else if (uuid) {
                // Check if DTE exists in dtes without sales_header
                const [dtesOnly] = await connection.query(
                    'SELECT id, venta_id FROM dtes WHERE codigo_generacion = ? AND company_id = ? LIMIT 1',
                    [uuid, companyId]
                );
                if (dtesOnly.length > 0) {
                    targetDteId = dtesOnly[0].id;
                    targetSaleId = dtesOnly[0].venta_id;
                } else {
                    await connection.rollback();
                    return { success: false, notFound: true, message: 'No se encontró la venta o DTE a revertir en su empresa' };
                }
            } else {
                await connection.rollback();
                return { success: false, notFound: true, message: 'No se encontró la venta o DTE a revertir en su empresa' };
            }

            // 1. Delete DTE and dependent events
            if (targetDteId) {
                await connection.query('DELETE FROM dte_events WHERE dte_id = ?', [targetDteId]).catch(() => {});
                await connection.query('DELETE FROM dte_responses WHERE dte_id = ?', [targetDteId]).catch(() => {});
                await connection.query('DELETE FROM dte_errors WHERE dte_id = ?', [targetDteId]).catch(() => {});
                await connection.query('DELETE FROM transmission_queue WHERE dte_id = ?', [targetDteId]).catch(() => {});
                await connection.query('DELETE FROM dtes WHERE id = ?', [targetDteId]);
            } else if (targetUuid) {
                await connection.query('DELETE FROM dtes WHERE codigo_generacion = ? AND company_id = ?', [targetUuid, companyId]);
            }

            // 2. Delete sale children and header
            if (targetSaleId) {
                await connection.query('DELETE FROM sales_payments WHERE sale_id = ?', [targetSaleId]);
                await connection.query('DELETE FROM sales_items WHERE sale_id = ?', [targetSaleId]);
                await connection.query('DELETE FROM sales_linked_documents WHERE sale_id = ?', [targetSaleId]).catch(() => {});
                await connection.query('DELETE FROM customer_payments WHERE sale_id = ?', [targetSaleId]).catch(() => {});
                await connection.query('DELETE FROM sales_headers WHERE id = ? AND company_id = ?', [targetSaleId, companyId]);
            }

            // 3. Optional Audit Log
            await connection.query('INSERT INTO filpro_sync_logs SET ?', [{
                company_id: companyId,
                branch_id: null,
                sync_date: targetDate ? new Date(targetDate).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
                total_found: 1,
                total_imported: 0,
                total_skipped: 0,
                total_errors: 0,
                details: JSON.stringify({
                    action: 'revert_single_dte',
                    uuid: targetUuid,
                    saleId: targetSaleId,
                    userId: userId || null,
                    timestamp: new Date().toISOString()
                }),
                created_at: new Date()
            }]).catch(err => console.warn('Could not record single revert log:', err.message));

            await connection.commit();

            return {
                success: true,
                saleId: targetSaleId,
                uuid: targetUuid,
                message: `Venta ${targetSaleId ? `#${targetSaleId}` : ''} revertida y eliminada correctamente de Nova SaaS`
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Revert all FilPro sales imported for a specific day
     * @param {Object} params
     * @param {number} params.companyId
     * @param {string} params.dateStr (YYYY-MM-DD)
     * @param {number} [params.branchId]
     * @param {number} [params.userId]
     * @returns {Promise<Object>}
     */
    async revertDay({ companyId, dateStr, branchId, userId }) {
        if (!dateStr) {
            throw new Error('La fecha a revertir es obligatoria (YYYY-MM-DD)');
        }

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Find all sales imported from FilPro for this date
            let findQuery = `
                SELECT s.id, s.codigo_generacion 
                FROM sales_headers s 
                WHERE s.company_id = ? 
                  AND s.fecha_emision = ?
                  AND s.observaciones LIKE 'Importado de FilPro%'
            `;
            const findParams = [companyId, dateStr];

            if (branchId) {
                findQuery += ' AND s.branch_id = ?';
                findParams.push(branchId);
            }

            const [salesToRevert] = await connection.query(findQuery, findParams);

            // 2. Also find any DTEs for this company associated with these sales or imported for this date
            const [dtesForDay] = await connection.query(`
                SELECT d.id, d.venta_id, d.codigo_generacion 
                FROM dtes d 
                WHERE d.company_id = ? 
                  AND (
                    d.codigo_generacion IN (
                        SELECT s2.codigo_generacion FROM sales_headers s2 
                        WHERE s2.company_id = ? AND s2.fecha_emision = ? AND s2.observaciones LIKE 'Importado de FilPro%'
                    )
                    OR (DATE(d.fh_procesamiento) = ? AND (d.json_original LIKE '%infile%' OR d.sello_recepcion = 'CERTIFICADO_INFILE'))
                  )
            `, [companyId, companyId, dateStr, dateStr]).catch(() => [[]]);

            const saleIds = Array.from(new Set([
                ...salesToRevert.map(s => s.id),
                ...dtesForDay.map(d => d.venta_id).filter(Boolean)
            ]));

            const dteUuids = Array.from(new Set([
                ...salesToRevert.map(s => s.codigo_generacion).filter(Boolean),
                ...dtesForDay.map(d => d.codigo_generacion).filter(Boolean)
            ]));

            if (saleIds.length === 0 && dteUuids.length === 0) {
                await connection.rollback();
                return {
                    success: true,
                    totalReverted: 0,
                    message: `No se encontraron ventas importadas de FilPro para la fecha ${dateStr}`
                };
            }

            // 3. Delete associated DTEs
            if (dteUuids.length > 0) {
                const [targetDtes] = await connection.query(
                    'SELECT id FROM dtes WHERE company_id = ? AND codigo_generacion IN (?)',
                    [companyId, dteUuids]
                );
                const dteIds = targetDtes.map(d => d.id);
                if (dteIds.length > 0) {
                    await connection.query('DELETE FROM dte_events WHERE dte_id IN (?)', [dteIds]).catch(() => {});
                    await connection.query('DELETE FROM dte_responses WHERE dte_id IN (?)', [dteIds]).catch(() => {});
                    await connection.query('DELETE FROM dte_errors WHERE dte_id IN (?)', [dteIds]).catch(() => {});
                    await connection.query('DELETE FROM transmission_queue WHERE dte_id IN (?)', [dteIds]).catch(() => {});
                    await connection.query('DELETE FROM dtes WHERE id IN (?)', [dteIds]);
                }
            }

            // 4. Delete sales items, payments, linked documents, and headers
            if (saleIds.length > 0) {
                await connection.query('DELETE FROM sales_payments WHERE sale_id IN (?)', [saleIds]);
                await connection.query('DELETE FROM sales_items WHERE sale_id IN (?)', [saleIds]);
                await connection.query('DELETE FROM sales_linked_documents WHERE sale_id IN (?)', [saleIds]).catch(() => {});
                await connection.query('DELETE FROM customer_payments WHERE sale_id IN (?)', [saleIds]).catch(() => {});
                await connection.query('DELETE FROM sales_headers WHERE id IN (?) AND company_id = ?', [saleIds, companyId]);
            }

            // 5. Record Audit Log for Reversal
            await connection.query('INSERT INTO filpro_sync_logs SET ?', [{
                company_id: companyId,
                branch_id: branchId || null,
                sync_date: dateStr,
                total_found: saleIds.length,
                total_imported: 0,
                total_skipped: 0,
                total_errors: 0,
                details: JSON.stringify({
                    action: 'revert_day',
                    revertedCount: saleIds.length,
                    revertedSaleIds: saleIds,
                    userId: userId || null,
                    timestamp: new Date().toISOString()
                }),
                created_at: new Date()
            }]).catch(err => console.warn('Could not record reversal log:', err.message));

            await connection.commit();

            return {
                success: true,
                totalReverted: saleIds.length,
                revertedSaleIds: saleIds,
                message: `Se revirtieron y eliminaron exitosamente ${saleIds.length} ventas importadas de FilPro para la fecha ${dateStr}`
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new FilproIngestionService();
