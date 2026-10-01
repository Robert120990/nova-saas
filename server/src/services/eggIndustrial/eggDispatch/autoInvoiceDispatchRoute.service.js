const { eggStock, emitSavedSale, pool, dteService, mailerService, resolveEggCatalogProduct, eggReturnableService, safeNum, safeInt, getPresentationWeightLbs } = require('../../../controllers/eggDispatch/shared');
const { validateDocumentNumber } = require('../../../utils/svfeValidators');

const autoInvoiceDispatchRoute = async (req) => {
    const responseHeaders = {};
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const company_id = req.company_id || req.user?.company_id;
        const { id: route_id } = req.params;
        const { stops = [] } = req.body;

        if (!stops || !Array.isArray(stops) || stops.length === 0) {
            await connection.rollback();
            return ({ status: 400, body: { message: 'No se seleccionaron paradas o pedidos para facturar.' }, headers: responseHeaders });
        }

        // 1. Obtener datos de la empresa (incluyendo configuración DTE)
        const [companyRows] = await connection.query(`
            SELECT c.*, cat.description as actividad_economica
            FROM companies c
            LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
            WHERE c.id = ?
        `, [company_id]);

        if (companyRows.length === 0) {
            await connection.rollback();
            return ({ status: 404, body: { message: 'Empresa no encontrada.' }, headers: responseHeaders });
        }
        const company = companyRows[0];

        // 2. Obtener datos de la ruta
        const [routeRows] = await connection.query(
            'SELECT * FROM egg_dispatch_routes WHERE id = ? AND company_id = ? FOR UPDATE',
            [route_id, company_id]
        );
        if (routeRows.length === 0) {
            await connection.rollback();
            return ({ status: 404, body: { message: 'Ruta de despacho no encontrada.' }, headers: responseHeaders });
        }
        const route = routeRows[0];

        // 3. Validar contra refacturación y verificar existencia en la ruta
        const stopIds = stops.map(s => s.stop_id).filter(Boolean);
        if (stopIds.length > 0) {
            const [existingStops] = await connection.query(
                `SELECT s.id, s.order_id, s.sale_id, s.dte_codigo_generacion, o.order_number, c.nombre as customer_name
                 FROM egg_dispatch_stops s
                 JOIN egg_customer_orders o ON s.order_id = o.id
                 JOIN customers c ON COALESCE(o.customer_id, s.customer_id) = c.id
                 WHERE s.id IN (?) AND s.dispatch_route_id = ?`,
                [stopIds, route_id]
            );

            if (existingStops.length !== stops.length || new Set(stopIds).size !== stops.length) {
                await connection.rollback(); return ({ status: 400, body: { message: 'Todas las paradas deben ser distintas y pertenecer a la ruta.' }, headers: responseHeaders });
            }

        }

        // Determinar vendedor y sucursal válidos para la empresa (protección Foreign Key sales_headers_ibfk_4 y sales_headers_ibfk_2)
        let resolvedSellerId = null;
        if (route.driver_name) {
            const [sellerByName] = await connection.query(
                'SELECT id FROM sellers WHERE company_id = ? AND status = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1',
                [company_id, 'activo', route.driver_name]
            );
            if (sellerByName.length > 0) {
                resolvedSellerId = sellerByName[0].id;
            }
        }
        if (!resolvedSellerId && req.user?.nombre) {
            const [sellerByUser] = await connection.query(
                'SELECT id FROM sellers WHERE company_id = ? AND status = ? AND LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1',
                [company_id, 'activo', req.user.nombre]
            );
            if (sellerByUser.length > 0) {
                resolvedSellerId = sellerByUser[0].id;
            }
        }
        if (!resolvedSellerId) {
            const [firstSeller] = await connection.query(
                'SELECT id FROM sellers WHERE company_id = ? AND status = ? ORDER BY id ASC LIMIT 1',
                [company_id, 'activo']
            );
            resolvedSellerId = firstSeller.length > 0 ? firstSeller[0].id : null;
        }

        let resolvedBranchId = req.user?.branch_id;
        const [validBranch] = await connection.query(
            'SELECT id FROM branches WHERE company_id = ? ORDER BY (id = ?) DESC, es_casa_matriz DESC, id ASC LIMIT 1',
            [company_id, resolvedBranchId || 0]
        );
        resolvedBranchId = validBranch.length > 0 ? validBranch[0].id : null;

        let resolvedPosId = req.user?.pos_id || null;
        if (resolvedBranchId) {
            const [validPos] = await connection.query(
                'SELECT id FROM points_of_sale WHERE branch_id = ? AND status = ? ORDER BY (id = ?) DESC, id ASC LIMIT 1',
                [resolvedBranchId, 'activo', resolvedPosId || 0]
            );
            resolvedPosId = validPos.length > 0 ? validPos[0].id : null;
        }

        // 4. Validar que cada parada seleccionada contenga productos válidos (el lote es opcional según requerimiento operativo)
        for (const stop of stops) {
            if (!stop.items || !Array.isArray(stop.items) || stop.items.length === 0) {
                await connection.rollback();
                return ({ status: 400, body: {
                    message: `La parada del cliente ID ${stop.customer_id} no contiene productos.`
                }, headers: responseHeaders });
            }
        }

        const billedResults = [];
        const emissionJobs = [];
        const successfulSalesForEmail = [];

        // 5. Procesar cada parada seleccionada
        for (const stop of stops) {
            // Verificar si la parada ya fue facturada en una ejecución anterior (idempotencia y re-ejecución segura)
            const [existingStopRows] = await connection.query(
                `SELECT s.id, s.sale_id, s.dte_codigo_generacion,
                        sh.id as existing_sale_id, sh.codigo_generacion, sh.numero_control,
                        sh.sello_recepcion, sh.condicion_operacion, sh.total_pagar, sh.estado,
                        sh.cliente_nombre
                 FROM egg_dispatch_stops s
                 LEFT JOIN sales_headers sh ON sh.id = s.sale_id AND sh.estado != 'ANULADO'
                 WHERE s.id = ? AND s.dispatch_route_id = ?`,
                [stop.stop_id, route_id]
            );

            const [custRows] = await connection.query(
                'SELECT * FROM customers WHERE id = ? AND company_id = ?',
                [stop.customer_id, company_id]
            );
            if (custRows.length === 0) {
                await connection.rollback();
                return ({ status: 400, body: { message: `Cliente ID ${stop.customer_id} no encontrado.` }, headers: responseHeaders });
            }
            const customer = custRows[0];
            if (existingStopRows.length !== 1) throw Object.assign(new Error('Parada ajena a la ruta.'), { status: 404 });
            const [orderRows] = await connection.query('SELECT customer_id FROM egg_customer_orders WHERE id = ? AND company_id = ? FOR UPDATE', [stop.order_id, company_id]);
            const [stopOrder] = await connection.query('SELECT order_id FROM egg_dispatch_stops WHERE id = ? AND dispatch_route_id = ?', [stop.stop_id, route_id]);
            if (!orderRows.length || Number(orderRows[0].customer_id) !== Number(stop.customer_id) || Number(stopOrder[0]?.order_id) !== Number(stop.order_id)) throw Object.assign(new Error('Pedido o cliente no corresponde a la parada.'), { status: 400 });


            const dteType = stop.dte_type || (customer.pais && customer.pais !== '9579' && customer.pais !== 'SV' ? '11' : customer.nrc ? '03' : '01');
            const condicionOperacion = parseInt(stop.condicion_operacion) || (customer.es_credito ? 2 : 1);
            const diasCredito = condicionOperacion === 2 ? (parseInt(stop.dias_credito) || parseInt(customer.dias_credito) || 15) : 0;

            if (existingStopRows[0].sale_id || existingStopRows[0].dte_codigo_generacion) {
                const prev = existingStopRows[0];
                const [jobs] = await connection.query('SELECT status, result_json FROM egg_dispatch_emissions WHERE company_id = ? AND sale_id = ?', [company_id, prev.sale_id]);
                const saved = jobs[0]?.result_json ? (typeof jobs[0].result_json === 'string' ? JSON.parse(jobs[0].result_json) : jobs[0].result_json) : {};
                if (jobs[0]?.status === 'pending') emissionJobs.push(prev.sale_id);
                billedResults.push({ stop_id: stop.stop_id, order_id: stop.order_id, sale_id: prev.sale_id,
                    customer_name: customer.nombre, customer_email: customer.correo, total: Number(prev.total_pagar || 0),
                    already_billed: true, dte_status: prev.sello_recepcion ? 'ACEPTADO_HACIENDA' : prev.estado === 'contingencia' ? 'CONTINGENCIA' : prev.estado === 'emitido' ? 'NO_DTE' : 'PENDIENTE_EMISION',
                    hacienda_msg: 'Venta existente conservada. Use Conciliar emisión si sigue pendiente.', ...saved });
                continue;
            }
            const physicalItems = stop.items.filter(item => !item.is_custom_detail);
            if (!physicalItems.length) throw Object.assign(new Error('Seleccione al menos un producto físico.'), { status: 400 });
            const stockSelection = await eggStock.reserveItems(connection, company_id, physicalItems);

            // Validaciones DTE y de consistencia de cliente
            if ((customer.nombre || '').toUpperCase().includes('[INACTIVO') || (customer.nombre_comercial || '').toUpperCase().includes('[INACTIVO')) {
                await connection.rollback();
                return ({ status: 400, body: { message: `La parada del Pedido #${stop.order_number || stop.order_id} tiene asignado al cliente inactivo o duplicado "${customer.nombre}". Reasigne el cliente activo antes de facturar.` }, headers: responseHeaders });
            }

            if (company.dte_active) {
                const stopEstimatedTotal = (stop.items || []).reduce((sum, it) => {
                    const rawQty = safeNum(it.quantity_lbs ?? it.quantity ?? 0, 0);
                    const rawPrice = safeNum(it.price_per_lb ?? it.price ?? 0, 0);
                    return sum + (rawQty * rawPrice);
                }, 0);
                const isFacturaMinor = dteType === '01' && stopEstimatedTotal < 200;
                if (dteType !== '11' && !isFacturaMinor) {
                    const addressError = await dteService.validateCustomerAddress(stop.customer_id, stop.customer_branch_id || null);
                    if (addressError) {
                        await connection.rollback();
                        return ({ status: 400, body: { message: `Cliente "${customer.nombre}": ${addressError}` }, headers: responseHeaders });
                    }
                }
                if (dteType === '03') {
                    if (!customer.nit || !String(customer.nit).trim()) {
                        await connection.rollback();
                        return ({ status: 400, body: {
                            message: `El cliente "${customer.nombre}" no tiene NIT registrado. Para emitir Crédito Fiscal (03) el cliente debe tener NIT registrado.`
                        }, headers: responseHeaders });
                    }
                    const nitValidation = validateDocumentNumber(customer.nit, 'NIT');
                    if (!nitValidation.isValid) {
                        await connection.rollback();
                        return ({ status: 400, body: {
                            message: `El cliente "${customer.nombre}" tiene un NIT no válido (${nitValidation.error}). Actualice el NIT del cliente en Catálogos antes de facturar.`
                        }, headers: responseHeaders });
                    }
                    const cleanNrc = String(customer.nrc || '').replace(/[-\s]/g, '');
                    if (!cleanNrc || cleanNrc.length < 2) {
                        await connection.rollback();
                        return ({ status: 400, body: {
                            message: `El cliente "${customer.nombre}" no tiene un NRC válido registrado. Para emitir Crédito Fiscal (03) el cliente debe tener NRC.`
                        }, headers: responseHeaders });
                    }
                }
            }

            // Cálculos de montos de ítems
            let totalGravado = 0;
            let totalIva = 0;
            let totalExento = 0;
            let totalNoSujeto = 0;
            const itemsProcessed = [];
            const freeNotes = [];

            const ivaRate = 0.13;

            // Separar productos comerciales y detalles libres/notas de la parada
            const fiscalProductItems = [];
            const customDetailItems = [];

            for (const it of (stop.items || [])) {
                const isCustom = !!it.is_custom_detail;
                const rawQty = safeNum(it.quantity_lbs ?? it.quantity ?? 0, 0);
                const rawPrice = safeNum(it.price_per_lb ?? it.price ?? 0, 0);

                if (isCustom || rawPrice <= 0 || rawQty <= 0) {
                    customDetailItems.push(it);
                } else {
                    fiscalProductItems.push(it);
                }
            }

            // Validar que la parada tenga al menos un producto facturable válido
            if (fiscalProductItems.length === 0 && dteType !== '04') {
                await connection.rollback();
                return ({ status: 400, body: {
                    message: `La parada del cliente "${customer.nombre}" (Pedido #${stop.order_number || stop.order_id}) no contiene productos facturables válidos con cantidad y precio mayores a cero.`
                }, headers: responseHeaders });
            }

            for (let i = 0; i < fiscalProductItems.length; i++) {
                const it = fiscalProductItems[i];
                const rawQty = safeNum(it.quantity_lbs ?? it.quantity ?? 0, 0);
                const rawPrice = safeNum(it.price_per_lb ?? it.price ?? 0, 0);

                // Ítem normal de producto ovoproducto legítimo
                const qtyLbs = rawQty;
                const priceLb = rawPrice;
                let itemTotal = Math.round(qtyLbs * priceLb * 100) / 100;

                if (dteType === '04') {
                    itemTotal = 0.00001; // Precio simbólico para Nota de Remisión
                }

                let ventaGravada = 0;
                let ivaItem = 0;

                if (dteType === '11') {
                    ventaGravada = itemTotal;
                    ivaItem = 0;
                } else if (dteType === '04') {
                    ventaGravada = 0;
                    ivaItem = 0;
                } else {
                    const gravNeto = Math.round((itemTotal / (1 + ivaRate)) * 100) / 100;
                    ivaItem = Math.round((itemTotal - gravNeto) * 100) / 100;
                    ventaGravada = gravNeto;
                }

                totalGravado += safeNum(ventaGravada, 0);
                totalIva += safeNum(ivaItem, 0);

                const productType = (it.product_type || 'Ovoproducto').trim();
                const presentation = (it.presentation || 'cubeta 30LB').trim();
                const rawLot = (it.lot_code || stop.order_lot_code || stop.lot_code || stop.linked_batch_code || '').trim();
                const lotCode = rawLot.replace(/\s*-\s*/g, '-');

                // Calcular unidades según presentación o usar unidades provistas
                let units = safeNum(it.units ?? it.quantity_units ?? 0, 0);
                if (units <= 0) {
                    const unitWeight = getPresentationWeightLbs(presentation);
                    const calcUnits = unitWeight > 0 ? (qtyLbs / unitWeight) : 1;
                    units = Number.isInteger(calcUnits) ? calcUnits : Math.round(calcUnits * 100) / 100;
                }

                // Resolver equivalencia con producto comercial del catálogo
                const resolved = await resolveEggCatalogProduct(connection, company_id, productType, presentation);
                const resolvedProductId = resolved.catalog_product_id || null;
                if (it.product_id && Number(it.product_id) !== Number(resolvedProductId)) throw Object.assign(new Error('El producto comercial no coincide con el mapeo industrial autorizado.'), { status: 400 });
                const catalogCode = resolved.catalog_code || (lotCode !== 'S/L' && lotCode !== 'N/A' && lotCode ? lotCode : 'OVO-01');
                const isReturnable = resolved.is_returnable;
                const unitOfMeasure = (resolved.unit_of_measure || '').toLowerCase();
                const stockQty = ['cubeta', 'galon', 'unidad', 'caja', 'carton', 'litro', 'botella'].includes(unitOfMeasure) ? units : qtyLbs;

                // Detección de cliente Callejas (exige código de barra antes del nombre)
                const isCallejas = (customer.nombre || '').toUpperCase().includes('CALLEJA') || customer.id === 11316 || customer.id === 32555;
                const barcode = (it.barcode || it.product_barcode || resolved.catalog_barcode || '').trim();

                let displayProductName = productType;
                // Si el cliente es Callejas o si tiene código de barra y el nombre aún no lo incluye, anteponerlo
                if ((isCallejas || barcode) && barcode && !displayProductName.startsWith(barcode)) {
                    displayProductName = `${barcode} ${displayProductName}`;
                }

                // Detección de cliente Comidas Especializadas o modo Kilogramos
                const isComidasEsp = (customer.nombre || '').toUpperCase().includes('COMIDAS ESPECIALIZADAS') || (customer.nombre || '').toUpperCase().includes('COMIDAS E INDUSTRIAS');
                const isKgMode = !!it.is_kg_mode || isComidasEsp || it.unit_of_measure === 'kg';

                let displayPresentation = presentation;
                let weightDesc = `${qtyLbs.toFixed(2)} Lbs`;

                if (isKgMode) {
                    // Limpiar menciones de "lb" / "LB" de la presentación y del nombre
                    displayPresentation = displayPresentation.replace(/\b(\d+)?\s*(lbs?|lb)\b/gi, '').replace(/\s+/g, ' ').trim();
                    displayProductName = displayProductName.replace(/\b(\d+)?\s*(lbs?|lb)\b/gi, '').replace(/\s+/g, ' ').trim();
                    const qtyKg = safeNum(it.quantity_kg, parseFloat((qtyLbs * 0.45359237).toFixed(2)));
                    weightDesc = `${qtyKg.toFixed(2)} Kg`;
                }

                // Modalidad de facturación: por unidades/presentación (ej: 40 litros) o por peso en libras (ej: 80 lbs)
                // Se factura por presentación/unidades cuando it.billing_unit === 'units' o por defecto para Calleja o pedidos con unidades
                const shouldBillByUnits = it.billing_unit === 'units' ||
                    (it.billing_unit !== 'lbs' && (isCallejas || (units > 0 && it.billing_by_presentation !== false)));

                const billedQty = (shouldBillByUnits && units > 0) ? units : qtyLbs;
                let precioUnitario = priceLb;

                if (dteType === '11') {
                    precioUnitario = billedQty > 0 ? Math.round((itemTotal / billedQty) * 1000000) / 1000000 : itemTotal;
                } else if (dteType === '04') {
                    precioUnitario = 0.00001;
                } else {
                    // Para 01 (Factura), 03 (Crédito Fiscal) y demás DTEs:
                    // En el modelo del sistema los precios comerciales unitarios incluyen IVA (inclusive).
                    // Para Crédito Fiscal (03), dte-api (calculateItem) se encarga de extraer el precio neto
                    // (precioUni = precioUnitario / 1.13) en cuerpoDocumento y liquidar el débito fiscal en el resumen.
                    // Si se enviara ya neto, dte-api lo dividiría por 1.13 por segunda vez distorsionando el total.
                    precioUnitario = billedQty > 0 ? Math.round((itemTotal / billedQty) * 1000000) / 1000000 : itemTotal;
                }

                // Renglón del producto fiscal limpio: sin lote incrustado con pipes
                let defaultDesc = shouldBillByUnits
                    ? `${displayProductName} | Presentación: ${displayPresentation || 'Unidad'} (${weightDesc})`
                    : `${displayProductName} | Presentación: ${displayPresentation || 'Unidad'} | Cant: ${units} Uds (${weightDesc})`;

                if (it.custom_description && it.custom_description.trim()) {
                    defaultDesc = it.custom_description.replace(/\s*\|\s*Lote:\s*[^|]+/i, '').trim();
                }

                itemsProcessed.push({
                    product_id: resolvedProductId,
                    codigo: catalogCode,
                    descripcion: defaultDesc,
                    cantidad: billedQty,
                    precio_unitario: safeNum(precioUnitario, 0),
                    monto_descuento: 0,
                    venta_gravada: safeNum(ventaGravada, 0),
                    venta_exenta: 0,
                    tributos: dteType === '11' || dteType === '04' ? [] : ['20'],
                    is_returnable: isReturnable,
                    returnable_units: Math.ceil(units),
                    stock_qty: stockQty
                });

                // Renglón de Lote: SIEMPRE ABAJO DEL PRODUCTO
                // 1. Buscar si hay una nota libre explícita de lote (ej: "Lote: 01-266-26 estado liquido")
                const lotNoteIdx = customDetailItems.findIndex(c => {
                    const txt = (c.product_type || c.descripcion || '').trim();
                    return /^\s*lote\b/i.test(txt);
                });

                let lotDescLine = null;
                if (lotNoteIdx !== -1) {
                    const rawLotTxt = (customDetailItems[lotNoteIdx].product_type || customDetailItems[lotNoteIdx].descripcion).trim();
                    lotDescLine = rawLotTxt.toLowerCase().startsWith('lote') ? rawLotTxt : `Lote: ${rawLotTxt}`;
                    // Extraer para no duplicarlo como nota genérica
                    customDetailItems.splice(lotNoteIdx, 1);
                } else if (lotCode && lotCode !== 'N/A' && lotCode !== 'S/L') {
                    lotDescLine = `Lote: ${lotCode}`;
                } else if (lotCode === 'S/L') {
                    lotDescLine = `Lote: S/L`;
                }

                if (lotDescLine) {
                    freeNotes.push(lotDescLine);
                    itemsProcessed.push({
                        product_id: null,
                        codigo: null,
                        descripcion: lotDescLine,
                        cantidad: 1,
                        precio_unitario: 0,
                        monto_descuento: 0,
                        venta_gravada: 0,
                        venta_exenta: 0,
                        tributos: dteType === '11' || dteType === '04' ? [] : ['20'],
                        is_returnable: false,
                        returnable_units: 0,
                        stock_qty: 0
                    });
                }
            }

            // Procesar el resto de detalles libres (Sucursal, observaciones de entrega, etc.)
            for (const cd of customDetailItems) {
                const descNote = (cd.product_type || cd.descripcion || cd.description || '').trim();
                if (!descNote) continue;

                freeNotes.push(descNote);
                itemsProcessed.push({
                    product_id: null,
                    codigo: null,
                    descripcion: descNote,
                    cantidad: 1,
                    precio_unitario: 0,
                    monto_descuento: 0,
                    venta_gravada: 0,
                    venta_exenta: 0,
                    tributos: dteType === '11' || dteType === '04' ? [] : ['20'],
                    is_returnable: false,
                    returnable_units: 0,
                    stock_qty: 0
                });
            }

            // Si la parada tiene sucursal asociada y no fue agregada aún en las notas, incorporarla
            const branchName = stop.branch_name || stop.customer_branch_name;
            if (branchName && !freeNotes.some(n => n.toLowerCase().includes(branchName.toLowerCase()))) {
                const branchDescLine = branchName.toLowerCase().startsWith('sucursal') ? branchName : `Sucursal: ${branchName}`;
                freeNotes.push(branchDescLine);
                itemsProcessed.push({
                    product_id: null,
                    codigo: null,
                    descripcion: branchDescLine,
                    cantidad: 1,
                    precio_unitario: 0,
                    monto_descuento: 0,
                    venta_gravada: 0,
                    venta_exenta: 0,
                    tributos: dteType === '11' || dteType === '04' ? [] : ['20'],
                    is_returnable: false,
                    returnable_units: 0,
                    stock_qty: 0
                });
            }

            const finalTotalGravado = safeNum(totalGravado, 0);
            const finalTotalIva = safeNum(totalIva, 0);
            const finalTotalExento = safeNum(totalExento, 0);
            const finalTotalNoSujeto = safeNum(totalNoSujeto, 0);
            let retencion = 0;
            let percepcion = 0;
            if (company.tipo_contribuyente !== 'Grande' && customer.condicion_fiscal === 'gran contribuyente' && dteType === '03') {
                if (finalTotalGravado >= 100) {
                    retencion = Math.round(finalTotalGravado * 0.01 * 100) / 100;
                }
            }
            const finalRetencion = safeNum(retencion, 0);
            const finalPercepcion = safeNum(percepcion, 0);

            // Total a pagar neto oficial: Gravado + IVA + Exento + No Sujeto - Retención (1% Gran Contribuyente) + Percepción
            const calculatedPagar = dteType === '04'
                ? 0.00001
                : (dteType === '11'
                    ? finalTotalGravado
                    : Math.max(0, Math.round((finalTotalGravado + finalTotalIva + finalTotalExento + finalTotalNoSujeto - finalRetencion + finalPercepcion) * 100) / 100)
                );
            const totalPagar = safeNum(calculatedPagar, 0);

            const sellerId = resolvedSellerId;
            const branchId = resolvedBranchId;

            // Extraer notas de detalles libres para observaciones
            const customNotes = stop.items
                .filter(it => it.is_custom_detail && (it.product_type || it.descripcion))
                .map(it => (it.product_type || it.descripcion).trim());
            const allNotes = [...customNotes, ...freeNotes.filter(n => !customNotes.includes(n))];
            const notesSuffix = allNotes.length > 0 ? ` | Notas: ${allNotes.join('; ')}` : '';
            const saleObservaciones = `Facturación Automática de Despacho Ruta ${route.codigo_ruta} - Pedido ${stop.order_number || stop.order_id}${notesSuffix}`;

            // 5a. Insertar Cabecera de Venta
            const [saleResult] = await connection.query('INSERT INTO sales_headers SET ?', [{
                company_id: company_id,
                branch_id: branchId,
                pos_id: resolvedPosId,
                customer_id: stop.customer_id,
                customer_branch_id: stop.customer_branch_id || null,
                seller_id: sellerId,
                dte_type: dteType,
                tipo_documento: dteType,
                condicion_operacion: condicionOperacion,
                payment_condition: condicionOperacion,
                fecha_emision: new Date(),
                hora_emision: new Date().toTimeString().split(' ')[0],
                estado: company.dte_active ? 'borrador' : 'emitido',
                total_gravado: finalTotalGravado,
                total_exento: finalTotalExento,
                total_nosujetas: finalTotalNoSujeto,
                total_iva: finalTotalIva,
                descuento_general: 0,
                iva_percibido: finalPercepcion,
                iva_retenido: finalRetencion,
                total_pagar: totalPagar,
                cliente_nombre: customer.nombre,
                observaciones: saleObservaciones,
                remission_type: dteType === '04' ? '02' : null,
                transporter_name: dteType === '04' ? (route.driver_name || 'Chofer Asignado') : null,
                vehicle_plate: dteType === '04' ? (route.vehicle_placa || null) : null,
                created_at: new Date()
            }]);
            const saleId = saleResult.insertId;

            // 5b. Insertar Ítems y sincronizar inventario / Kardex / empaques retornables
            for (const item of itemsProcessed) {
                await connection.query('INSERT INTO sales_items SET ?', [{
                    sale_id: saleId,
                    product_id: item.product_id,
                    codigo: item.codigo,
                    descripcion: item.descripcion,
                    cantidad: safeNum(item.cantidad, 1),
                    precio_unitario: safeNum(item.precio_unitario, 0),
                    monto_descuento: 0,
                    venta_gravada: safeNum(item.venta_gravada, 0),
                    venta_exenta: safeNum(item.venta_exenta, 0),
                    tributos: JSON.stringify(item.tributos || [])
                }]);

                // Actualizar inventario comercial y Kardex si no es remisión y tiene product_id
                if (dteType !== '04' && item.product_id) {
                    const stockQty = safeNum(item.stock_qty || item.cantidad, 1);
                    await connection.query(
                        `INSERT INTO inventory (company_id, branch_id, product_id, stock)
                         VALUES (?, ?, ?, -?)
                         ON DUPLICATE KEY UPDATE stock = stock - ?`,
                        [company_id, branchId, item.product_id, stockQty, stockQty]
                    );

                    await connection.query('INSERT INTO inventory_movements SET ?', [{
                        company_id: company_id,
                        branch_id: branchId,
                        product_id: item.product_id,
                        tipo_movimiento: 'SALIDA',
                        cantidad: stockQty,
                        tipo_documento: `DTE-${dteType || '01'}`,
                        documento_id: saleId,
                        created_at: new Date()
                    }]);
                }

            }
            await eggReturnableService.recordSaleReturnables(connection, {
                company_id, customer_id: stop.customer_id, customer_name: customer.nombre, sale_id: saleId,
                dte_type: dteType, numero_control: null, items: itemsProcessed,
                user_name: req.user?.nombre || 'Despacho', fecha_emision: new Date()
            });

            // 5c. Insertar Pago inicial de la venta (garantiza persistencia y consistencia en retransmisiones)
            await connection.query('INSERT INTO sales_payments SET ?', [{
                sale_id: saleId,
                metodo_pago: '01',
                monto: totalPagar,
                referencia: condicionOperacion === 2 ? `Crédito ${diasCredito} días` : 'Contado Despacho'
            }]);

            // 5d. Emitir DTE si la empresa tiene DTE activo
            let dteInfo = {};
            let dteHaciendaStatus = 'NO_DTE';
            let dteHaciendaMsg = 'DTE no activo para la empresa';
            let dteHaciendaDetails = null;

            if (company.dte_active) {
                const dtePayload = {
                    header: {
                        company_id: company_id,
                        branch_id: branchId,
                        pos_id: resolvedPosId,
                        user_id: req.user?.id || 1,
                        customer_id: stop.customer_id,
                        customer_branch_id: stop.customer_branch_id || null,
                        dte_type: dteType,
                        condicion_operacion: condicionOperacion,
                        dias_credito: diasCredito,
                        total_gravado: finalTotalGravado,
                        total_exento: finalTotalExento,
                        total_nosujeto: finalTotalNoSujeto,
                        total_iva: finalTotalIva,
                        total_pagar: totalPagar,
                        total_retencion: finalRetencion,
                        total_percepcion: finalPercepcion,
                        remission_type: dteType === '04' ? '02' : null,
                        transporter_name: dteType === '04' ? (route.driver_name || 'Chofer Asignado') : null,
                        vehicle_plate: dteType === '04' ? (route.vehicle_placa || null) : null
                    },
                    items: itemsProcessed,
                    payments: [{
                        codigo: '01',
                        monto: totalPagar,
                        plazo: condicionOperacion === 2 ? '01' : null,
                        periodo: condicionOperacion === 2 ? (parseInt(diasCredito) || 15) : null
                    }]
                };

                await connection.query('INSERT INTO egg_dispatch_emissions (company_id, sale_id, payload_json) VALUES (?, ?, ?)', [company_id, saleId, JSON.stringify(dtePayload)]);
                emissionJobs.push(saleId);
                dteHaciendaStatus = 'PENDIENTE_EMISION';
                dteHaciendaMsg = 'Venta guardada con reserva; emisión pendiente.';
            }

            // 5e. Actualizar venta con datos DTE y vincular tabla dtes
            // Nota: sales_headers.estado es enum('borrador','emitido','invalidado','contingencia')
            const saleEstadoFinal = company.dte_active ? 'borrador' : 'emitido';

            const saleObservacionesFinal = dteHaciendaStatus === 'RECHAZADO_HACIENDA'
                ? `${saleObservaciones} | [RECHAZADO HACIENDA]: ${dteHaciendaMsg}${dteHaciendaDetails ? ' (' + (Array.isArray(dteHaciendaDetails) ? dteHaciendaDetails.join('; ') : JSON.stringify(dteHaciendaDetails)) + ')' : ''}`
                : saleObservaciones;

            await connection.query('UPDATE sales_headers SET ? WHERE id = ?', [{
                codigo_generacion: dteInfo.codigo_generacion || null,
                numero_control: dteInfo.numero_control || null,
                sello_recepcion: dteInfo.sello_recepcion || null,
                fh_procesamiento: dteInfo.fh_procesamiento || null,
                estado: saleEstadoFinal,
                observaciones: saleObservacionesFinal
            }, saleId]);

            if (dteInfo.codigo_generacion) {
                await connection.query(
                    'UPDATE dtes SET venta_id = ? WHERE codigo_generacion = ? AND company_id = ?',
                    [saleId, dteInfo.codigo_generacion, company_id]
                );
            }

            // 5f. Actualizar Parada (egg_dispatch_stops)
            const firstBatchId = safeInt(stop.items[0]?.batch_id, null);
            const firstLotCode = stop.items[0]?.lot_code || null;
            await connection.query(`
                UPDATE egg_dispatch_stops SET
                    sale_id = ?,
                    dte_codigo_generacion = COALESCE(?, dte_codigo_generacion),
                    batch_id = COALESCE(?, batch_id),
                    lot_code = COALESCE(?, lot_code)
                WHERE id = ? AND dispatch_route_id = ?
            `, [
                safeInt(saleId),
                dteInfo.codigo_generacion || null,
                firstBatchId,
                firstLotCode,
                safeInt(stop.stop_id),
                safeInt(route_id)
            ]);

            // 5g. Actualizar Pedido (egg_customer_orders)
            await connection.query(`
                UPDATE egg_customer_orders SET
                    sale_id = ?,
                    dte_codigo_generacion = COALESCE(?, dte_codigo_generacion),
                    batch_id = COALESCE(?, batch_id),
                    lot_code = COALESCE(?, lot_code),
                    items_json = ?
                WHERE id = ? AND company_id = ?
            `, [
                safeInt(saleId),
                dteInfo.codigo_generacion || null,
                firstBatchId,
                firstLotCode,
                JSON.stringify(stop.items),
                safeInt(stop.order_id),
                safeInt(company_id)
            ]);

            await eggStock.recordDispatch(connection, company_id, saleId, stockSelection);

            if (dteInfo.codigo_generacion && (dteHaciendaStatus === 'ACEPTADO_HACIENDA' || dteHaciendaStatus === 'CONTINGENCIA')) {
                successfulSalesForEmail.push({
                    saleId: safeInt(saleId),
                    customerName: customer.nombre,
                    customerEmail: customer.correo || null,
                    codigoGeneracion: dteInfo.codigo_generacion,
                    numeroControl: dteInfo.numero_control
                });
            }

            billedResults.push({
                stop_id: stop.stop_id,
                order_id: stop.order_id,
                sale_id: saleId,
                customer_name: customer.nombre,
                customer_email: customer.correo || null,
                email_queued: !!(dteInfo.codigo_generacion && (dteHaciendaStatus === 'ACEPTADO_HACIENDA' || dteHaciendaStatus === 'CONTINGENCIA') && customer.correo),
                dte_type: dteType,
                numero_control: dteInfo.numero_control || `VTA-${saleId}`,
                codigo_generacion: dteInfo.codigo_generacion || null,
                sello_recepcion: dteInfo.sello_recepcion || null,
                dte_status: dteHaciendaStatus,
                hacienda_msg: dteHaciendaMsg,
                hacienda_details: dteHaciendaDetails,
                condicion: condicionOperacion === 2 ? `Crédito (${diasCredito} días)` : 'Contado',
                cxc_status: company.dte_active ? 'Pendiente de emisión' : condicionOperacion === 2 ? 'Alimentado en Estado de Cuenta / Saldo Pendiente (CXC)' : 'Pagado al Contado',
                total: totalPagar
            });
        }

        await connection.commit();
        for (const saleId of emissionJobs) {
            let outcome;
            try { outcome = await emitSavedSale(company_id, saleId); }
            catch (error) { outcome = { success: false, dte_status: 'ERROR_EMISION', hacienda_msg: error.message }; }
            const result = billedResults.find(r => r.sale_id === saleId);
            Object.assign(result, outcome);
            result.cxc_status = outcome.success ? result.condicion : 'Pendiente de emisión; reserva conservada';
            if (outcome.success && result.customer_email) successfulSalesForEmail.push({ saleId });
        }

        // 6. Enviar correo formal con DTE a los clientes tras emisión exitosa vía cola BullMQ
        if (successfulSalesForEmail.length > 0) {
            for (const item of successfulSalesForEmail) {
                mailerService.queueDTEEmail(item.saleId, company_id).catch(mailErr => {
                    console.error(`[AutoInvoice] Error encolando correo DTE para Venta #${item.saleId}:`, mailErr.message);
                });
            }
        }

        return ({ status: 200, body: {
            success: billedResults.every(r => !['ERROR_EMISION', 'RECHAZADO_HACIENDA', 'PENDIENTE_EMISION'].includes(r.dte_status)),
            message: `Se guardaron ${billedResults.length} parada(s) de la ruta ${route.codigo_ruta}.`,
            results: billedResults
        }, headers: responseHeaders });
    } catch (error) {
        await connection.rollback();
        console.error('Error en autoInvoiceDispatchRoute:', error);
        return ({ status: error.status || 500, body: { message: error.message || 'Error al procesar la facturación de la ruta.' }, headers: responseHeaders });
    } finally {
        connection.release();
    }
};
module.exports = autoInvoiceDispatchRoute;
