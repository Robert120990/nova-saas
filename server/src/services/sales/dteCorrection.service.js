const { getEffectiveProductId, getLubricantCategoryIds, isLubricantProduct } = require('../../controllers/sales/salesUtils');
const { validateDocumentNumber } = require('../../utils/svfeValidators');

const round2 = (n) => Number(Math.round((Number(n) || 0) + 'e+2') + 'e-2') || 0;
const round4 = (n) => Number(Math.round((Number(n) || 0) + 'e+4') + 'e-4') || 0;
const round6 = (n) => Number(Math.round((Number(n) || 0) + 'e+6') + 'e-6') || 0;

const parseJsonSafe = (raw, fallback = null) => {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return fallback; }
};

const extractTaxVal = (tributos, code) => {
    if (!Array.isArray(tributos)) return 0;
    return tributos.reduce((sum, t) => {
        if (t && typeof t === 'object' && String(t.codigo) === code) {
            return sum + (parseFloat(t.valor) || 0);
        }
        return sum;
    }, 0);
};

const formatDateOnly = (val) => {
    if (!val) return '';
    if (val instanceof Date) {
        return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    return String(val).substring(0, 10);
};

const getTodayElSalvador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' });

const isCustomerExemptFlag = (c) => Boolean(
    c && (
        Number(c.exento_iva) === 1 ||
        c.exento_iva === true ||
        String(c.condicion_fiscal || '').trim().toLowerCase() === 'exento iva'
    )
);

/**
 * Replica el cálculo exacto de dte-api/src/utils/calculations.js y valida/cuadra
 * diferencias de aproximación, redondeo, retención/percepción indebida y pagos.
 */
function recalculateSaleDraft({
    dteType = '01',
    items = [],
    header = {},
    payments = [],
    linkedDocs = [],
    taxCfg = {},
    company = {},
    customer = null,
    autoFixApproximation = true,
    recalcRetencionPercepcion = false
}) {
    const type = String(dteType || '01');
    const ivaPct = parseFloat(taxCfg?.iva_rate || 13);
    const ivaRate = ivaPct / 100;
    const divisor = 1 + ivaRate;
    const retRate = parseFloat(taxCfg?.retencion_rate || 1) / 100;
    const percRate = parseFloat(taxCfg?.percepcion_rate || 1) / 100;
    const adjustments = [];

    // Caso especial CR (07): totales provienen exclusivamente de documentos vinculados
    if (type === '07') {
        let totalSujeto = 0;
        let totalRetenido = 0;
        const normDocs = (Array.isArray(linkedDocs) ? linkedDocs : []).map((doc, idx) => {
            const sujeto = round2(parseFloat(doc.monto_sujeto ?? doc.montoSujeto ?? 0));
            const rawRet = parseFloat(doc.iva_retenido ?? doc.ivaRetenido ?? 0);
            const expectedRet = round2(sujeto * retRate);
            const ret = (autoFixApproximation && Math.abs(rawRet - expectedRet) >= 0.01)
                ? expectedRet
                : round2(rawRet);
            if (Math.abs(ret - round2(rawRet)) >= 0.01) {
                adjustments.push(`Doc. #${idx + 1}: IVA retenido ajustado de $${round2(rawRet).toFixed(2)} a $${ret.toFixed(2)} (1%).`);
            }
            totalSujeto = round2(totalSujeto + sujeto);
            totalRetenido = round2(totalRetenido + ret);
            return {
                ...doc,
                doc_type: doc.doc_type || '03',
                generation_type: parseInt(doc.generation_type, 10) || 1,
                doc_number: String(doc.doc_number || '').trim().toUpperCase(),
                emission_date: formatDateOnly(doc.emission_date),
                monto_sujeto: sujeto,
                iva_retenido: ret,
                descripcion: doc.descripcion || `RETENCION AL DOCUMENTO ${doc.doc_number || ''}`
            };
        });

        const nextHeader = {
            ...header,
            total_gravado: totalSujeto,
            total_exento: 0,
            total_nosujetas: 0,
            total_iva: 0,
            fovial: 0,
            cotrans: 0,
            descuento_general: 0,
            iva_retenido: totalRetenido,
            iva_percibido: 0,
            total_pagar: totalRetenido,
            condicion_operacion: 1
        };

        return {
            items: Array.isArray(items) ? items : [],
            header: nextHeader,
            payments: [],
            linkedDocuments: normDocs,
            dtePreview: {
                totalSujetoRetencion: totalSujeto,
                totalIvaRetenido: totalRetenido,
                totalPagar: totalRetenido,
                pagosSum: 0,
                isBalanced: true
            },
            adjustments
        };
    }

    let dteTotalNoSuj = 0;
    let dteTotalExenta = 0;
    let dteTotalGravadaNet = 0;
    let dteTotalIva = 0;
    let dteTotalExpectedInclusive = 0;
    let totalFovial = 0;
    let totalCotrans = 0;

    const normItems = (Array.isArray(items) ? items : []).map((rawItem, idx) => {
        const qty = round4(parseFloat(rawItem.cantidad) || 0);
        const origPrice = round4(parseFloat(rawItem.precio_unitario ?? rawItem.precioUni ?? 0));
        const origDesc = round4(parseFloat(rawItem.monto_descuento ?? rawItem.montoDescu ?? 0));
        const parsedTributos = parseJsonSafe(rawItem.tributos, []);
        const tributosArr = Array.isArray(parsedTributos) ? parsedTributos : [];

        const fovial = round2(extractTaxVal(tributosArr, 'D1'));
        const cotrans = round2(extractTaxVal(tributosArr, 'C8'));
        totalFovial = round2(totalFovial + fovial);
        totalCotrans = round2(totalCotrans + cotrans);

        const isDescriptiveZero = origPrice === 0 && parseFloat(rawItem.venta_gravada || 0) === 0 && parseFloat(rawItem.venta_exenta || 0) === 0;
        if (isDescriptiveZero) {
            return {
                ...rawItem,
                cantidad: qty || 1,
                precio_unitario: 0,
                monto_descuento: 0,
                venta_gravada: 0,
                venta_exenta: 0,
                exento: false,
                tributos: tributosArr
            };
        }

        const wasExento = rawItem.exento !== undefined
            ? Boolean(rawItem.exento)
            : (parseFloat(rawItem.venta_exenta || 0) > 0 && parseFloat(rawItem.venta_gravada || 0) === 0);
        const isExento = type === '11' ? false : wasExento;

        const unitFuelTax = qty > 0 ? (fovial + cotrans) / qty : 0;
        let nextPrice = origPrice;
        let nextDesc = origDesc;
        let dbGravada = 0;
        let dbExenta = 0;

        // Cuadre de precio/descuento y totales por ítem igual que dte-api/utils/calculations.js
        const lineInclusive = Math.max(0, (nextPrice * qty) - nextDesc);
        const expectedLineStored = round2(Math.max(0, lineInclusive - fovial - cotrans));

        if (isExento) {
            dbExenta = expectedLineStored;
            dbGravada = 0;
            dteTotalExenta = round2(dteTotalExenta + expectedLineStored);
            dteTotalExpectedInclusive = round2(dteTotalExpectedInclusive + expectedLineStored + fovial + cotrans);
        } else if (type === '01') {
            dbGravada = round2(lineInclusive);
            dbExenta = 0;
            const ivaItem = round6((dbGravada * ivaPct) / (100 + ivaPct));
            dteTotalGravadaNet = round2(dteTotalGravadaNet + dbGravada);
            dteTotalIva = round6(dteTotalIva + ivaItem);
            dteTotalExpectedInclusive = round2(dteTotalExpectedInclusive + dbGravada + fovial + cotrans);
        } else if (type === '11') {
            dbGravada = round2(lineInclusive);
            dbExenta = 0;
            dteTotalGravadaNet = round2(dteTotalGravadaNet + dbGravada);
            dteTotalExpectedInclusive = round2(dteTotalExpectedInclusive + dbGravada);
        } else {
            // CCF (03), NC (05), ND (06), NR (04): precio_unitario DB incluye IVA + FOVIAL + COTRANS
            const baseConIva = Math.max(0, lineInclusive - fovial - cotrans);
            const netPrice = round6(Math.max(0, nextPrice - unitFuelTax) / divisor);
            const netDiscount = round6(nextDesc / divisor);
            const dteVentaGrav = round2(Math.max(0, (netPrice * qty) - netDiscount));
            const dteIva = round2(baseConIva - dteVentaGrav);

            dbGravada = round2(baseConIva);
            dbExenta = 0;
            dteTotalGravadaNet = round2(dteTotalGravadaNet + dteVentaGrav);
            dteTotalIva = round2(dteTotalIva + dteIva);
            dteTotalExpectedInclusive = round2(dteTotalExpectedInclusive + dteVentaGrav + dteIva + fovial + cotrans);

            // Detectar si había deriva por redondeo o discrepancia de línea
            const prevStored = round2(parseFloat(rawItem.venta_gravada || 0));
            if (autoFixApproximation && Math.abs(prevStored - dbGravada) >= 0.01) {
                adjustments.push(
                    `Ítem #${idx + 1} (${String(rawItem.descripcion || '').slice(0, 32)}): total de línea cuadrado de $${prevStored.toFixed(2)} a $${dbGravada.toFixed(2)}.`
                );
            }
        }

        if (isExento) {
            const prevEx = round2(parseFloat(rawItem.venta_exenta || 0));
            if (autoFixApproximation && Math.abs(prevEx - dbExenta) >= 0.01) {
                adjustments.push(`Ítem #${idx + 1}: venta exenta cuadrada de $${prevEx.toFixed(2)} a $${dbExenta.toFixed(2)}.`);
            }
        }

        // Asegurar tributos limpios si es exento
        let nextTributos = tributosArr;
        if (isExento) {
            nextTributos = tributosArr.filter(t => (typeof t === 'object' ? String(t.codigo) : String(t)) !== '20');
        }

        return {
            ...rawItem,
            cantidad: qty,
            precio_unitario: nextPrice,
            monto_descuento: nextDesc,
            venta_gravada: dbGravada,
            venta_exenta: dbExenta,
            exento: isExento,
            tributos: nextTributos
        };
    });

    const noSujetoTotal = round2(parseFloat(header.total_nosujetas || 0));
    dteTotalNoSuj = noSujetoTotal;

    const rawGenDiscount = round2(Math.max(0, parseFloat(header.descuento_general || 0)));
    let descuGravada = (type === '03' || type === '05' || type === '06')
        ? round2(rawGenDiscount / divisor)
        : round2(rawGenDiscount);
    descuGravada = Math.min(descuGravada, round2(dteTotalGravadaNet));
    const safeRawGenDiscount = (type === '03' || type === '05' || type === '06')
        ? Math.min(rawGenDiscount, round2(dteTotalGravadaNet * divisor))
        : descuGravada;
    if (Math.abs(safeRawGenDiscount - rawGenDiscount) >= 0.01) {
        adjustments.push(`Descuento general limitado de $${rawGenDiscount.toFixed(2)} a $${safeRawGenDiscount.toFixed(2)} para no exceder monto gravado.`);
    }

    const rSubTotalVentas = round2(dteTotalNoSuj + dteTotalExenta + dteTotalGravadaNet);
    const subTotal = round2(Math.max(0, rSubTotalVentas - descuGravada));
    const otrosImp = (type === '03' || type === '05' || type === '06')
        ? round2(totalFovial + totalCotrans)
        : 0;

    let finalIva = 0;
    let totalBeforeRetPerc = 0;
    if (type === '01') {
        finalIva = round2(((dteTotalGravadaNet - descuGravada) * ivaPct) / (100 + ivaPct));
        totalBeforeRetPerc = round2(subTotal + totalFovial + totalCotrans);
    } else if (type === '11') {
        finalIva = 0;
        totalBeforeRetPerc = round2(subTotal);
    } else {
        if (descuGravada > 0) {
            finalIva = Math.max(0, round2(dteTotalIva - round2(descuGravada * ivaRate)));
        } else {
            finalIva = round2(dteTotalIva);
        }
        // Blindaje exacto de 1 centavo igual a dte-api/utils/calculations.js
        const expectedTotal = round2(dteTotalExpectedInclusive - safeRawGenDiscount);
        const currentSum = round2(subTotal + finalIva + otrosImp);
        const diff = round2(expectedTotal - currentSum);
        if (Math.abs(diff) === 0.01 && (finalIva + diff) >= 0) {
            finalIva = round2(finalIva + diff);
            adjustments.push(`Aproximación de IVA ajustada en ${diff > 0 ? '+' : ''}$${diff.toFixed(2)} para cuadre exacto MH.`);
        }
        totalBeforeRetPerc = round2(subTotal + finalIva + otrosImp);
    }

    const gravadoNetoHeader = type === '01'
        ? round2(Math.max(0, (dteTotalGravadaNet - descuGravada) - finalIva))
        : round2(Math.max(0, dteTotalGravadaNet - descuGravada));

    let retencion = round2(Math.max(0, parseFloat(header.iva_retenido || 0)));
    let percepcion = round2(Math.max(0, parseFloat(header.iva_percibido || 0)));

    if (recalcRetencionPercepcion && customer && ['01', '03', '05', '06'].includes(type)) {
        const nosAgente = String(company?.tipo_contribuyente || '').trim().toLowerCase() === 'grande';
        const custGC = String(customer?.condicion_fiscal || '').trim().toLowerCase() === 'gran contribuyente';
        const calcRet = (!nosAgente && custGC && gravadoNetoHeader >= 100) ? round2(gravadoNetoHeader * retRate) : 0;
        const calcPerc = (['03', '05', '06'].includes(type) && nosAgente && !custGC && gravadoNetoHeader >= 100) ? round2(gravadoNetoHeader * percRate) : 0;
        if (Math.abs(calcRet - retencion) >= 0.01) {
            adjustments.push(`Retención 1% recalculada de $${retencion.toFixed(2)} a $${calcRet.toFixed(2)}.`);
        }
        if (Math.abs(calcPerc - percepcion) >= 0.01) {
            adjustments.push(`Percepción 1% recalculada de $${percepcion.toFixed(2)} a $${calcPerc.toFixed(2)}.`);
        }
        retencion = calcRet;
        percepcion = calcPerc;
    } else if (autoFixApproximation) {
        // Evitar retención/percepción inválida cuando no existe base gravada >= 100 (ej. ventas exentas)
        if ((gravadoNetoHeader <= 0 || !['01', '03', '05', '06'].includes(type)) && retencion > 0) {
            adjustments.push(`Retención 1% ($${retencion.toFixed(2)}) limpiada a $0.00 porque no hay monto gravado sujeto.`);
            retencion = 0;
        }
        if ((gravadoNetoHeader <= 0 || !['03', '05', '06'].includes(type)) && percepcion > 0) {
            adjustments.push(`Percepción 1% ($${percepcion.toFixed(2)}) limpiada a $0.00 porque no aplica al documento/monto.`);
            percepcion = 0;
        }
    }

    const totalPagar = round2(Math.max(0, totalBeforeRetPerc - retencion + percepcion));
    const prevHeaderTotal = round2(parseFloat(header.total_pagar || 0));
    if (autoFixApproximation && Math.abs(prevHeaderTotal - totalPagar) >= 0.01) {
        adjustments.push(`Total a pagar cuadrado de $${prevHeaderTotal.toFixed(2)} a $${totalPagar.toFixed(2)}.`);
    }

    // Cuadrar formas de pago contra totalPagar
    const rawPays = Array.isArray(payments) ? payments : [];
    let normPayments = rawPays.map(p => ({
        ...p,
        metodo_pago: String(p.metodo_pago || p.codigo || '01').padStart(2, '0'),
        monto: round2(parseFloat(p.monto ?? p.montoPago ?? 0)),
        referencia: p.referencia || null
    }));

    if (normPayments.length === 0) {
        normPayments = [{
            metodo_pago: parseInt(header.condicion_operacion, 10) === 2 ? '13' : '01',
            monto: totalPagar,
            referencia: parseInt(header.condicion_operacion, 10) === 2 ? 'Crédito' : 'Contado'
        }];
    } else if (autoFixApproximation) {
        const paySumBefore = round2(normPayments.reduce((s, p) => s + p.monto, 0));
        if (normPayments.length === 1) {
            normPayments[0].monto = totalPagar;
        } else if (Math.abs(paySumBefore - totalPagar) >= 0.01) {
            let acc = 0;
            normPayments = normPayments.map((p, idx) => {
                if (idx === normPayments.length - 1) {
                    return { ...p, monto: round2(Math.max(0, totalPagar - acc)) };
                }
                acc = round2(acc + p.monto);
                return p;
            });
        }
        if (Math.abs(paySumBefore - totalPagar) >= 0.01) {
            adjustments.push(`Formas de pago cuadradas de $${paySumBefore.toFixed(2)} a $${totalPagar.toFixed(2)}.`);
        }
    }

    const pagosSum = round2(normPayments.reduce((s, p) => s + p.monto, 0));
    const isBalanced = Math.abs(pagosSum - totalPagar) < 0.01;

    const nextHeader = {
        ...header,
        total_gravado: gravadoNetoHeader,
        total_exento: dteTotalExenta,
        total_nosujetas: noSujetoTotal,
        total_iva: finalIva,
        fovial: totalFovial,
        cotrans: totalCotrans,
        descuento_general: safeRawGenDiscount,
        iva_retenido: retencion,
        iva_percibido: percepcion,
        total_pagar: totalPagar,
        condicion_operacion: parseInt(header.condicion_operacion, 10) || 1
    };

    return {
        items: normItems,
        header: nextHeader,
        payments: normPayments,
        linkedDocuments: linkedDocs,
        dtePreview: {
            totalGravada: round2(dteTotalGravadaNet),
            totalGravadoNetoHeader: gravadoNetoHeader,
            totalExenta: dteTotalExenta,
            descuGravada,
            subTotal,
            totalIva: finalIva,
            fovial: totalFovial,
            cotrans: totalCotrans,
            ivaRete: retencion,
            ivaPerci: percepcion,
            montoTotalOperacion: round2(subTotal + (type === '01' ? 0 : finalIva) + otrosImp),
            totalPagar,
            pagosSum,
            isBalanced
        },
        adjustments
    };
}

/**
 * Analiza la respuesta de Hacienda y el estado real en BD para detectar causas exactas
 * y sugerir la pestaña / acciones directas al operador.
 */
function analyzeDteRejection({
    sale,
    dte,
    linkedDocs = [],
    customer = null,
    customerBranch = null,
    recalculation = null,
    distritoValido = true
}) {
    const tipoDte = String(sale?.dte_type || sale?.tipo_documento || '01');
    const resp = parseJsonSafe(dte?.respuesta_hacienda, dte?.respuesta_hacienda || null);
    const origJson = parseJsonSafe(dte?.json_original, null);
    const codigoMsg = resp?.codigoMsg ? String(resp.codigoMsg) : null;
    const descripcionMsg = resp?.descripcionMsg || (typeof resp === 'string' ? resp : '');
    const observaciones = Array.isArray(resp?.observaciones) ? resp.observaciones : [];
    const rawErrorText = [codigoMsg, descripcionMsg, ...observaciones, typeof resp === 'string' ? resp : JSON.stringify(resp || {})]
        .filter(Boolean)
        .join(' | ');
    const lower = rawErrorText.toLowerCase();

    const detectedIssues = [];
    const addIssue = (id, severity, tab, title, detail) => {
        if (!detectedIssues.some(i => i.id === id)) {
            detectedIssues.push({ id, severity, tab, title, detail });
        }
    };

    const effectiveDepto = customerBranch?.departamento || customer?.departamento;
    const effectiveMuni = customerBranch?.municipio || customer?.municipio;
    const effectiveDistrito = customerBranch?.distrito || customer?.distrito;
    const isFacturaMinor = tipoDte === '01' && parseFloat(sale?.total_pagar || 0) < 200;

    // 1. Cliente / Dirección / Documentos
    if (customer && !['11', '14'].includes(tipoDte) && !isFacturaMinor) {
        if (!effectiveDistrito || !distritoValido) {
            addIssue(
                'missing_distrito',
                'error',
                'cliente',
                'Distrito del receptor faltante o inválido',
                `Depto ${effectiveDepto || '--'} / Muni ${effectiveMuni || '--'} / Distrito ${effectiveDistrito || 'vacío'} no es válido en CAT-008.`
            );
        }
    }

    if (tipoDte === '03' && customer) {
        const nitCheck = validateDocumentNumber(customer.nit || customer.numero_documento, 'NIT');
        if (!nitCheck.isValid) {
            addIssue('invalid_ccf_nit', 'error', 'cliente', 'NIT inválido o faltante para CCF', nitCheck.error || 'Se requiere NIT válido de 14 o 9 dígitos.');
        }
        const cleanNrc = String(customer.nrc || '').replace(/\D/g, '');
        if (!cleanNrc || /^0+$/.test(cleanNrc)) {
            addIssue('invalid_ccf_nrc', 'error', 'cliente', 'NRC faltante o inválido para CCF', 'El Crédito Fiscal exige un NRC vigente.');
        }
    }

    if (lower.includes('nit') || lower.includes('nrc') || lower.includes('numdocumento') || lower.includes('receptor') || lower.includes('actividad') || lower.includes('distrito')) {
        addIssue('mh_receptor', 'error', 'cliente', 'Rechazo en datos del Receptor', descripcionMsg || observaciones[0] || 'Hacienda observó campos del cliente.');
    }

    // 2. Documentos Relacionados (NC 05, ND 06, CR 07, NR 04)
    if (['05', '06', '07'].includes(tipoDte)) {
        if (linkedDocs.length === 0) {
            addIssue('missing_linked_doc', 'error', 'documentos', 'Sin documento relacionado', 'Debe vincular al menos una factura o CCF previo.');
        } else {
            const currentPeriod = getTodayElSalvador().substring(0, 7);
            linkedDocs.forEach((doc, idx) => {
                const num = String(doc.doc_number || '').trim().toUpperCase();
                const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(num);
                if (Number(doc.generation_type || 1) === 1 && !isUUID) {
                    addIssue(
                        `bad_linked_uuid_${idx}`,
                        'error',
                        'documentos',
                        `Doc. relacionado #${idx + 1} no tiene UUID válido`,
                        `El valor "${num || 'vacío'}" debe ser un Código de Generación (36 caracteres) si el tipo de generación es Electrónico (1).`
                    );
                }
                const docDate = formatDateOnly(doc.emission_date);
                if (tipoDte === '07' && docDate && docDate.substring(0, 7) !== currentPeriod) {
                    addIssue(
                        `bad_cr_period_${idx}`,
                        'error',
                        'documentos',
                        `Doc. #${idx + 1} fuera del período tributario (${currentPeriod})`,
                        `La fecha ${docDate} pertenece a otro mes; Hacienda rechaza CR 07 fuera del mes vigente.`
                    );
                }
            });
        }
    }

    if (lower.includes('documentorelacionado') || lower.includes('cuerpodocumento/0/numerodocumento') || lower.includes('fecha fuera de plazo')) {
        addIssue('mh_linked_doc', 'error', 'documentos', 'Observación MH en Documento Relacionado', observaciones[0] || descripcionMsg);
    }

    // 3. Exportación FEX (11) y Remisión (04)
    if (tipoDte === '11') {
        const country = String(sale?.dest_country_code || customer?.pais || '').trim().toUpperCase();
        if (!country || country.length !== 2) {
            addIssue('missing_fex_country', 'error', 'exportacion', 'País destino inválido en FEX', 'Debe asignar un código de país ISO de 2 letras (ej. US, GT, HN).');
        }
        const expType = parseInt(sale?.export_item_type, 10);
        if (![1, 2, 3].includes(expType)) {
            addIssue('missing_fex_itemtype', 'error', 'exportacion', 'Tipo de ítem FEX no válido', 'Seleccione Bienes (1), Servicios (2) o Bienes y Servicios (3).');
        }
        if (expType !== 2 && !sale?.export_regime) {
            addIssue('missing_fex_regime', 'warning', 'exportacion', 'Régimen FEX pendiente', 'Seleccione régimen de exportación (ej. EX-1).');
        }
    }

    if (lower.includes('recintofiscal') || lower.includes('tipoitemexpor') || lower.includes('tiporegimen') || lower.includes('codpais') || lower.includes('incoterms')) {
        addIssue('mh_fex', 'error', 'exportacion', 'Observación MH en datos de Exportación (FEX)', observaciones[0] || descripcionMsg);
    }

    // 4. Montos / Aproximación / Redondeo
    if ((recalculation?.adjustments || []).length > 0 && tipoDte !== '07') {
        addIssue(
            'math_drift',
            'warning',
            'montos',
            'Diferencia de aproximación o cuadre detectada',
            recalculation.adjustments[0]
        );
    }

    if ((codigoMsg === '003' && !lower.includes('receptor')) || lower.includes('cuerpodocumento.item') || lower.includes('resumen') || lower.includes('aproxim') || lower.includes('totalpagar')) {
        addIssue('mh_amounts', 'error', 'montos', 'Observación MH en cálculos / aproximación', descripcionMsg || observaciones[0] || 'Descuadre en ítems, IVA o resumen.');
    }

    // 5. Fecha / Número de Control
    const origFecEmi = origJson?.identificacion?.fecEmi ? String(origJson.identificacion.fecEmi).substring(0, 10) : null;
    const todaySv = getTodayElSalvador();
    const staleDate = Boolean(origFecEmi && origFecEmi !== todaySv && !dte?.sello_recepcion);
    const recommendUpdateDateTime = lower.includes('fecemi') || lower.includes('fecha de envío') || lower.includes('fecha de envio') || staleDate;
    const recommendRegenerate = codigoMsg === '004' || lower.includes('numerocontrol') || lower.includes('ya existe') || !dte?.codigo_generacion;

    let recommendedTab = 'cliente';
    if (detectedIssues.some(i => i.tab === 'documentos') && ['05', '06', '07'].includes(tipoDte)) {
        recommendedTab = 'documentos';
    } else if (detectedIssues.some(i => i.tab === 'exportacion') && ['11', '04'].includes(tipoDte)) {
        recommendedTab = 'exportacion';
    } else if (detectedIssues.some(i => i.tab === 'montos' && i.severity === 'error')) {
        recommendedTab = 'montos';
    } else if (detectedIssues.length > 0) {
        recommendedTab = detectedIssues[0].tab;
    }

    const isAccepted = Boolean(dte?.status === 'ACCEPTED' || dte?.sello_recepcion || sale?.sello_recepcion);
    const isVoided = ['anulado', 'invalidado'].includes(String(sale?.estado || '').toLowerCase()) || dte?.status === 'INVALIDADO';

    return {
        codigoMsg,
        descripcionMsg,
        observaciones,
        rawErrorText,
        detectedIssues,
        recommendedTab,
        recommendRegenerate,
        recommendUpdateDateTime,
        staleDate,
        origFecEmi,
        todaySv,
        isEditable: !isAccepted && !isVoided,
        blockedReason: isAccepted ? 'El DTE ya fue aceptado por Hacienda.' : (isVoided ? 'La venta se encuentra anulada o invalidada.' : null)
    };
}

/**
 * Carga todo el contexto editable de una venta con DTE no aceptado.
 */
async function getSaleCorrectionContext(pool, saleId, companyId) {
    const [sales] = await pool.query(
        `SELECT s.*, c.tipo_contribuyente, c.dte_active, c.razon_social
         FROM sales_headers s
         JOIN companies c ON s.company_id = c.id
         WHERE s.id = ? AND s.company_id = ?`,
        [saleId, companyId]
    );
    if (!sales.length) {
        const err = new Error('Venta no encontrada');
        err.status = 404;
        throw err;
    }
    const sale = sales[0];

    const [[dteRows], [items], [payments], [linkedDocs], [taxRows]] = await Promise.all([
        pool.query(
            `SELECT id, codigo_generacion, numero_control, tipo_dte, status, sello_recepcion, fh_procesamiento, respuesta_hacienda, json_original
             FROM dtes
             WHERE (venta_id = ? OR (codigo_generacion = ? AND codigo_generacion IS NOT NULL AND codigo_generacion != ''))
               AND company_id = ?
             ORDER BY id DESC LIMIT 1`,
            [saleId, sale.codigo_generacion || '', companyId]
        ),
        pool.query(
            `SELECT si.*, p.es_exento as product_es_exento, p.tipo_combustible
             FROM sales_items si
             LEFT JOIN products p ON p.id = si.product_id
             WHERE si.sale_id = ?
             ORDER BY si.id ASC`,
            [saleId]
        ),
        pool.query('SELECT * FROM sales_payments WHERE sale_id = ? ORDER BY id ASC', [saleId]),
        pool.query('SELECT * FROM sales_linked_documents WHERE sale_id = ? ORDER BY id ASC', [saleId]),
        pool.query('SELECT * FROM tax_configurations WHERE company_id = ? LIMIT 1', [companyId])
    ]);

    const activeDte = dteRows[0] || null;
    const taxCfg = taxRows[0] || { iva_rate: 13, fovial_rate: 0.20, cotrans_rate: 0.10, retencion_rate: 1, percepcion_rate: 1 };

    let customer = null;
    let customerBranch = null;
    if (sale.customer_id) {
        const [custRows] = await pool.query(
            `SELECT c.*, cat.description as actividad_economica
             FROM customers c
             LEFT JOIN cat_019_actividad_economica cat ON c.codigo_actividad = cat.code
             WHERE c.id = ? AND c.company_id = ?`,
            [sale.customer_id, companyId]
        );
        customer = custRows[0] || null;

        if (sale.customer_branch_id) {
            const [brRows] = await pool.query(
                'SELECT * FROM customer_branches WHERE id = ? AND customer_id = ?',
                [sale.customer_branch_id, sale.customer_id]
            );
            customerBranch = brRows[0] || null;
        }
    }

    // Verificar validez de terna departamento/municipio/distrito en CAT-008
    let distritoValido = true;
    const effDepto = customerBranch?.departamento || customer?.departamento;
    const effMuni = customerBranch?.municipio || customer?.municipio;
    const effDist = customerBranch?.distrito || customer?.distrito;
    if (customer && !['11', '14'].includes(String(sale.dte_type || sale.tipo_documento))) {
        if (!effDist) {
            distritoValido = false;
        } else {
            const [distRows] = await pool.query(
                'SELECT code FROM cat_008_distrito WHERE dep_code = ? AND muni_code = ? AND code = ? LIMIT 1',
                [String(effDepto || '').padStart(2, '0'), String(effMuni || '').padStart(2, '0'), String(effDist).padStart(2, '0')]
            );
            distritoValido = distRows.length > 0;
        }
    }

    const normLinked = linkedDocs.map(d => ({
        ...d,
        emission_date: formatDateOnly(d.emission_date)
    }));

    const normItems = items.map(it => ({
        ...it,
        tributos: parseJsonSafe(it.tributos, []),
        exento: String(sale.dte_type || sale.tipo_documento) === '11'
            ? false
            : (parseFloat(it.venta_exenta || 0) > 0 && parseFloat(it.venta_gravada || 0) === 0)
    }));

    const recalculation = recalculateSaleDraft({
        dteType: sale.dte_type || sale.tipo_documento || '01',
        items: normItems,
        header: {
            total_gravado: parseFloat(sale.total_gravado || 0),
            total_exento: parseFloat(sale.total_exento || 0),
            total_nosujetas: parseFloat(sale.total_nosujetas || 0),
            total_iva: parseFloat(sale.total_iva || 0),
            fovial: parseFloat(sale.fovial || 0),
            cotrans: parseFloat(sale.cotrans || 0),
            descuento_general: parseFloat(sale.descuento_general || 0),
            iva_retenido: parseFloat(sale.iva_retenido || 0),
            iva_percibido: parseFloat(sale.iva_percibido || 0),
            total_pagar: parseFloat(sale.total_pagar || 0),
            condicion_operacion: sale.condicion_operacion || 1
        },
        payments,
        linkedDocs: normLinked,
        taxCfg,
        company: { tipo_contribuyente: sale.tipo_contribuyente },
        customer,
        autoFixApproximation: true
    });

    const analysis = analyzeDteRejection({
        sale,
        dte: activeDte,
        linkedDocs: normLinked,
        customer,
        customerBranch,
        recalculation,
        distritoValido
    });

    return {
        sale: {
            id: sale.id,
            branch_id: sale.branch_id,
            customer_id: sale.customer_id,
            customer_branch_id: sale.customer_branch_id,
            cliente_nombre: sale.cliente_nombre,
            dte_type: sale.dte_type || sale.tipo_documento || '01',
            tipo_documento: sale.tipo_documento || sale.dte_type || '01',
            condicion_operacion: sale.condicion_operacion || 1,
            payment_condition: sale.payment_condition || 1,
            fecha_emision: formatDateOnly(sale.fecha_emision),
            estado: sale.estado,
            codigo_generacion: activeDte?.codigo_generacion || sale.codigo_generacion || null,
            numero_control: activeDte?.numero_control || sale.numero_control || null,
            dte_status: activeDte?.status || null,
            observaciones: sale.observaciones || '',
            export_item_type: sale.export_item_type || 1,
            fiscal_enclosure: sale.fiscal_enclosure || '',
            export_regime: sale.export_regime || 'EX-1',
            dest_country_code: sale.dest_country_code || customer?.pais || '',
            remission_type: sale.remission_type || '02',
            transporter_name: sale.transporter_name || '',
            vehicle_plate: sale.vehicle_plate || ''
        },
        header: {
            total_gravado: round2(sale.total_gravado),
            total_exento: round2(sale.total_exento),
            total_nosujetas: round2(sale.total_nosujetas),
            total_iva: round2(sale.total_iva),
            fovial: round2(sale.fovial),
            cotrans: round2(sale.cotrans),
            descuento_general: round2(sale.descuento_general),
            iva_retenido: round2(sale.iva_retenido),
            iva_percibido: round2(sale.iva_percibido),
            total_pagar: round2(sale.total_pagar),
            condicion_operacion: sale.condicion_operacion || 1
        },
        items: normItems,
        payments: payments.map(p => ({ ...p, monto: round2(p.monto) })),
        linkedDocuments: normLinked,
        customer: customer ? {
            ...customer,
            exento_iva: isCustomerExemptFlag(customer),
            aplica_fovial: Number(customer.aplica_fovial) !== 0 && customer.aplica_fovial !== false,
            aplica_cotrans: Number(customer.aplica_cotrans) !== 0 && customer.aplica_cotrans !== false
        } : null,
        customerBranch,
        company: {
            razon_social: sale.razon_social,
            tipo_contribuyente: sale.tipo_contribuyente,
            dte_active: Boolean(sale.dte_active)
        },
        taxConfig: taxCfg,
        recalculationPreview: recalculation,
        analysis
    };
}

/**
 * Aplica atómicamente todas las correcciones sobre una venta no aceptada.
 */
async function applySaleDteCorrection(pool, saleId, companyId, payload = {}, user = {}) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [sales] = await connection.query(
            `SELECT s.*, c.tipo_contribuyente, c.dte_active
             FROM sales_headers s
             JOIN companies c ON s.company_id = c.id
             WHERE s.id = ? AND s.company_id = ?
             FOR UPDATE`,
            [saleId, companyId]
        );
        if (!sales.length) {
            const err = new Error('Venta no encontrada');
            err.status = 404;
            throw err;
        }
        const sale = sales[0];
        const dteType = String(sale.dte_type || sale.tipo_documento || '01');

        const [dteRows] = await connection.query(
            `SELECT id, codigo_generacion, status, sello_recepcion
             FROM dtes
             WHERE (venta_id = ? OR (codigo_generacion = ? AND codigo_generacion IS NOT NULL AND codigo_generacion != ''))
               AND company_id = ?
             ORDER BY id DESC LIMIT 1`,
            [saleId, sale.codigo_generacion || '', companyId]
        );
        const activeDte = dteRows[0] || null;
        if (activeDte?.status === 'ACCEPTED' || activeDte?.sello_recepcion || sale.sello_recepcion) {
            const err = new Error('No se puede editar directamente un DTE ya aceptado por Hacienda. Use "Regenerar DTE" si requiere emitir un nuevo comprobante.');
            err.status = 400;
            throw err;
        }
        if (['anulado', 'invalidado'].includes(String(sale.estado || '').toLowerCase()) || activeDte?.status === 'INVALIDADO') {
            const err = new Error('No se puede corregir una venta anulada o invalidada.');
            err.status = 400;
            throw err;
        }

        const updatedSections = [];
        let customerRow = null;
        if (sale.customer_id) {
            const [cust] = await connection.query('SELECT * FROM customers WHERE id = ? AND company_id = ?', [sale.customer_id, companyId]);
            customerRow = cust[0] || null;
        }

        // 1. Actualizar Cliente / Receptor y sucursal vinculada si corresponde
        if (payload.customer && typeof payload.customer === 'object') {
            const cIn = payload.customer;
            if (cIn.nit && String(cIn.nit).trim()) {
                const nitVal = validateDocumentNumber(cIn.nit, 'NIT');
                if (!nitVal.isValid) {
                    const err = new Error(`NIT inválido: ${nitVal.error}`);
                    err.status = 400;
                    throw err;
                }
            }
            if (cIn.numero_documento && String(cIn.numero_documento).trim()) {
                const docVal = validateDocumentNumber(cIn.numero_documento, cIn.tipo_documento);
                if (!docVal.isValid) {
                    const err = new Error(`Documento inválido: ${docVal.error}`);
                    err.status = 400;
                    throw err;
                }
            }

            const custFields = {};
            const strOrNull = (v) => (v !== undefined ? (String(v ?? '').trim() || null) : undefined);
            const assignIfDef = (k, val) => { if (val !== undefined) custFields[k] = val; };

            assignIfDef('nombre', strOrNull(cIn.nombre));
            assignIfDef('nombre_comercial', strOrNull(cIn.nombre_comercial));
            if (cIn.tipo_documento !== undefined) assignIfDef('tipo_documento', cIn.tipo_documento || 'DUI');
            assignIfDef('numero_documento', strOrNull(cIn.numero_documento));
            assignIfDef('nit', strOrNull(cIn.nit));
            assignIfDef('nrc', strOrNull(cIn.nrc));
            assignIfDef('codigo_actividad', strOrNull(cIn.codigo_actividad));
            assignIfDef('departamento', strOrNull(cIn.departamento));
            assignIfDef('municipio', strOrNull(cIn.municipio));
            assignIfDef('distrito', strOrNull(cIn.distrito));
            if (cIn.pais !== undefined) assignIfDef('pais', cIn.pais ? String(cIn.pais).trim().toUpperCase().slice(0, 10) : null);
            assignIfDef('direccion', strOrNull(cIn.direccion));
            assignIfDef('telefono', strOrNull(cIn.telefono));
            assignIfDef('correo', strOrNull(cIn.correo));
            if (cIn.tipo_persona !== undefined) assignIfDef('tipo_persona', cIn.tipo_persona ? String(cIn.tipo_persona) : null);
            if (cIn.condicion_fiscal !== undefined) assignIfDef('condicion_fiscal', cIn.condicion_fiscal || 'otro');
            if (cIn.exento_iva !== undefined) assignIfDef('exento_iva', cIn.exento_iva ? 1 : 0);
            if (cIn.aplica_fovial !== undefined) assignIfDef('aplica_fovial', cIn.aplica_fovial ? 1 : 0);
            if (cIn.aplica_cotrans !== undefined) assignIfDef('aplica_cotrans', cIn.aplica_cotrans ? 1 : 0);
            if (cIn.dias_credito !== undefined && cIn.dias_credito !== null) {
                custFields.dias_credito = parseInt(cIn.dias_credito, 10) || 15;
            }

            if (sale.customer_id && Object.keys(custFields).length > 0) {
                await connection.query('UPDATE customers SET ? WHERE id = ? AND company_id = ?', [custFields, sale.customer_id, companyId]);
                if (custFields.nombre) {
                    await connection.query('UPDATE sales_headers SET cliente_nombre = ? WHERE id = ?', [custFields.nombre, saleId]);
                }
                if (sale.customer_branch_id && payload.syncBranchAddress !== false) {
                    const brFields = {};
                    if (custFields.departamento !== undefined) brFields.departamento = custFields.departamento;
                    if (custFields.municipio !== undefined) brFields.municipio = custFields.municipio;
                    if (custFields.distrito !== undefined) brFields.distrito = custFields.distrito;
                    if (custFields.direccion !== undefined) brFields.direccion = custFields.direccion;
                    if (custFields.telefono !== undefined) brFields.telefono = custFields.telefono;
                    if (custFields.correo !== undefined) brFields.correo = custFields.correo;
                    if (Object.keys(brFields).length > 0) {
                        await connection.query(
                            'UPDATE customer_branches SET ? WHERE id = ? AND customer_id = ?',
                            [brFields, sale.customer_branch_id, sale.customer_id]
                        ).catch(() => {});
                    }
                }
                const [refreshed] = await connection.query('SELECT * FROM customers WHERE id = ?', [sale.customer_id]);
                customerRow = refreshed[0] || customerRow;
            } else if (!sale.customer_id && custFields.nombre) {
                await connection.query('UPDATE sales_headers SET cliente_nombre = ? WHERE id = ?', [custFields.nombre, saleId]);
            }
            updatedSections.push('customer');
        }

        // 2. Actualizar metadatos de Exportación (FEX 11), Remisión (NR 04) u Observaciones
        if (payload.exportacion || payload.remision || payload.observaciones !== undefined) {
            const metaUpdate = {};
            if (payload.observaciones !== undefined) {
                metaUpdate.observaciones = String(payload.observaciones || '').trim() || null;
            }
            if (payload.exportacion && typeof payload.exportacion === 'object') {
                const exp = payload.exportacion;
                if (exp.export_item_type !== undefined) metaUpdate.export_item_type = parseInt(exp.export_item_type, 10) || 1;
                if (exp.fiscal_enclosure !== undefined) {
                    const cleanRec = String(exp.fiscal_enclosure || '').trim();
                    metaUpdate.fiscal_enclosure = (metaUpdate.export_item_type === 2) ? null : (cleanRec ? cleanRec.slice(0, 2) : null);
                }
                if (exp.export_regime !== undefined) {
                    metaUpdate.export_regime = (metaUpdate.export_item_type === 2) ? null : (String(exp.export_regime || '').trim().toUpperCase().slice(0, 10) || 'EX-1');
                }
                if (exp.dest_country_code !== undefined) {
                    const iso = String(exp.dest_country_code || '').trim().toUpperCase().slice(0, 4);
                    metaUpdate.dest_country_code = iso || null;
                    if (iso && sale.customer_id && payload.syncCustomerCountry !== false && iso.length === 2) {
                        await connection.query('UPDATE customers SET pais = ? WHERE id = ? AND company_id = ?', [iso, sale.customer_id, companyId]);
                    }
                }
            }
            if (payload.remision && typeof payload.remision === 'object') {
                const rem = payload.remision;
                if (rem.remission_type !== undefined) metaUpdate.remission_type = String(rem.remission_type || '02').slice(0, 2);
                if (rem.transporter_name !== undefined) metaUpdate.transporter_name = String(rem.transporter_name || '').trim().slice(0, 100) || null;
                if (rem.vehicle_plate !== undefined) metaUpdate.vehicle_plate = String(rem.vehicle_plate || '').trim().slice(0, 20) || null;
            }
            if (Object.keys(metaUpdate).length > 0) {
                await connection.query('UPDATE sales_headers SET ? WHERE id = ?', [metaUpdate, saleId]);
                updatedSections.push('metadata');
            }
        }

        // 3. Actualizar Documentos Relacionados
        let effectiveLinkedDocs = null;
        if (Array.isArray(payload.linkedDocuments)) {
            await connection.query('DELETE FROM sales_linked_documents WHERE sale_id = ?', [saleId]);
            effectiveLinkedDocs = [];
            for (const doc of payload.linkedDocuments) {
                let docNum = String(doc.doc_number || '').trim().toUpperCase();
                let genType = parseInt(doc.generation_type, 10) || 1;
                if (docNum.startsWith('DTE-')) {
                    const [origDte] = await connection.query(
                        'SELECT codigo_generacion FROM dtes WHERE (numero_control = ? OR codigo_generacion = ?) AND company_id = ? LIMIT 1',
                        [docNum, docNum, companyId]
                    );
                    if (origDte.length > 0 && origDte[0].codigo_generacion) {
                        docNum = origDte[0].codigo_generacion;
                        genType = 1;
                    }
                } else if (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(docNum)) {
                    genType = 1;
                }
                const emissionDate = formatDateOnly(doc.emission_date) || getTodayElSalvador();
                const sujeto = doc.monto_sujeto !== undefined && doc.monto_sujeto !== null && doc.monto_sujeto !== ''
                    ? round2(doc.monto_sujeto) : null;
                const retenido = doc.iva_retenido !== undefined && doc.iva_retenido !== null && doc.iva_retenido !== ''
                    ? round2(doc.iva_retenido) : (dteType === '07' && sujeto !== null ? round2(sujeto * 0.01) : null);

                const row = {
                    sale_id: saleId,
                    doc_type: String(doc.doc_type || '03').slice(0, 2),
                    doc_number: docNum.slice(0, 36),
                    emission_date: emissionDate,
                    generation_type: genType,
                    monto_sujeto: sujeto,
                    iva_retenido: retenido,
                    descripcion: doc.descripcion ? String(doc.descripcion).slice(0, 255) : null
                };
                await connection.query('INSERT INTO sales_linked_documents SET ?', [row]);
                effectiveLinkedDocs.push(row);
            }
            updatedSections.push('linkedDocuments');
        }

        // 4. Actualizar Ítems, Totales y Pagos (o recalcular CR 07 si cambiaron documentos vinculados)
        let finalHeaderTotals = null;
        if (Array.isArray(payload.items) || payload.header || Array.isArray(payload.payments) || (dteType === '07' && effectiveLinkedDocs)) {
            const [taxRows] = await connection.query('SELECT * FROM tax_configurations WHERE company_id = ? LIMIT 1', [companyId]);
            const taxCfg = taxRows[0] || { iva_rate: 13, fovial_rate: 0.20, cotrans_rate: 0.10, retencion_rate: 1, percepcion_rate: 1 };

            const [existingItems] = await connection.query('SELECT * FROM sales_items WHERE sale_id = ? ORDER BY id ASC', [saleId]);
            const [existingPays] = await connection.query('SELECT * FROM sales_payments WHERE sale_id = ? ORDER BY id ASC', [saleId]);
            const [existingLinks] = effectiveLinkedDocs
                ? [effectiveLinkedDocs]
                : await connection.query('SELECT * FROM sales_linked_documents WHERE sale_id = ? ORDER BY id ASC', [saleId]);

            const itemsInput = Array.isArray(payload.items) ? payload.items : existingItems;
            const paysInput = Array.isArray(payload.payments) ? payload.payments : existingPays;
            const headerInput = {
                total_gravado: parseFloat(sale.total_gravado || 0),
                total_exento: parseFloat(sale.total_exento || 0),
                total_nosujetas: parseFloat(sale.total_nosujetas || 0),
                total_iva: parseFloat(sale.total_iva || 0),
                fovial: parseFloat(sale.fovial || 0),
                cotrans: parseFloat(sale.cotrans || 0),
                descuento_general: parseFloat(sale.descuento_general || 0),
                iva_retenido: parseFloat(sale.iva_retenido || 0),
                iva_percibido: parseFloat(sale.iva_percibido || 0),
                total_pagar: parseFloat(sale.total_pagar || 0),
                condicion_operacion: sale.condicion_operacion || 1,
                ...(payload.header || {})
            };

            const recalc = recalculateSaleDraft({
                dteType,
                items: itemsInput,
                header: headerInput,
                payments: paysInput,
                linkedDocs: existingLinks,
                taxCfg,
                company: { tipo_contribuyente: sale.tipo_contribuyente },
                customer: customerRow,
                autoFixApproximation: true,
                recalcRetencionPercepcion: Boolean(payload.recalcRetencionPercepcion)
            });

            // Persistir cambios en sales_items existentes y ajustar inventario si cambió cantidad
            const existingById = new Map(existingItems.map(i => [Number(i.id), i]));
            const lubricantCats = !['04', '07'].includes(dteType)
                ? await getLubricantCategoryIds(connection, companyId, sale.branch_id)
                : [];

            for (const item of recalc.items) {
                const itemId = item.id ? Number(item.id) : null;
                if (itemId && existingById.has(itemId)) {
                    const prev = existingById.get(itemId);
                    await connection.query(
                        `UPDATE sales_items
                         SET descripcion = ?, cantidad = ?, precio_unitario = ?, monto_descuento = ?,
                             venta_gravada = ?, venta_exenta = ?, tributos = ?
                         WHERE id = ? AND sale_id = ?`,
                        [
                            String(item.descripcion || prev.descripcion || '').trim(),
                            item.cantidad,
                            item.precio_unitario,
                            item.monto_descuento || 0,
                            item.venta_gravada || 0,
                            item.venta_exenta || 0,
                            JSON.stringify(Array.isArray(item.tributos) ? item.tributos : []),
                            itemId,
                            saleId
                        ]
                    );

                    const deltaQty = round4((parseFloat(item.cantidad) || 0) - (parseFloat(prev.cantidad) || 0));
                    if (Math.abs(deltaQty) >= 0.0001 && prev.product_id && !prev.combo_id && !['04', '07'].includes(dteType)) {
                        const effectiveProdId = await getEffectiveProductId(connection, prev.product_id);
                        const isLub = await isLubricantProduct(connection, companyId, sale.branch_id, effectiveProdId, lubricantCats);
                        if (!isLub) {
                            await connection.query(
                                `INSERT INTO inventory (company_id, product_id, branch_id, stock)
                                 VALUES (?, ?, ?, -?)
                                 ON DUPLICATE KEY UPDATE stock = stock - ?`,
                                [companyId, effectiveProdId, sale.branch_id, deltaQty, deltaQty]
                            );
                            await connection.query('INSERT INTO inventory_movements SET ?', [{
                                company_id: companyId,
                                branch_id: sale.branch_id,
                                product_id: effectiveProdId,
                                tipo_movimiento: deltaQty > 0 ? 'SALIDA' : 'ENTRADA',
                                cantidad: Math.abs(deltaQty),
                                tipo_documento: `AJUSTE-DTE-${dteType} (${user?.username || 'sistema'})`.slice(0, 50),
                                documento_id: saleId,
                                created_at: new Date()
                            }]);
                        }
                    }
                }
            }

            // Actualizar cabecera con totales cuadrados
            const condOp = parseInt(recalc.header.condicion_operacion, 10) || 1;
            await connection.query(
                `UPDATE sales_headers
                 SET total_gravado = ?, total_exento = ?, total_nosujetas = ?, total_iva = ?,
                     fovial = ?, cotrans = ?, descuento_general = ?, iva_retenido = ?,
                     iva_percibido = ?, total_pagar = ?, condicion_operacion = ?, payment_condition = ?
                 WHERE id = ?`,
                [
                    recalc.header.total_gravado,
                    recalc.header.total_exento,
                    recalc.header.total_nosujetas,
                    recalc.header.total_iva,
                    recalc.header.fovial,
                    recalc.header.cotrans,
                    recalc.header.descuento_general,
                    recalc.header.iva_retenido,
                    recalc.header.iva_percibido,
                    recalc.header.total_pagar,
                    condOp,
                    condOp,
                    saleId
                ]
            );
            finalHeaderTotals = recalc.header;

            // Reemplazar pagos cuadrados (salvo CR 07)
            if (dteType !== '07') {
                await connection.query('DELETE FROM sales_payments WHERE sale_id = ?', [saleId]);
                for (const p of recalc.payments) {
                    await connection.query('INSERT INTO sales_payments SET ?', [{
                        sale_id: saleId,
                        metodo_pago: String(p.metodo_pago || '01').padStart(2, '0'),
                        monto: round2(p.monto),
                        referencia: p.referencia ? String(p.referencia).slice(0, 50) : null
                    }]);
                }
            }
            updatedSections.push('amounts');
        }

        // Limpiar caché de diagnóstico IA para que refleje los nuevos datos si se reconsulta
        await connection.query('DELETE FROM dte_diagnoses WHERE sale_id = ? AND company_id = ?', [saleId, companyId]);

        await connection.commit();
        return {
            success: true,
            saleId: Number(saleId),
            dteType,
            updatedSections,
            headerTotals: finalHeaderTotals,
            codigoGeneracion: activeDte?.codigo_generacion || sale.codigo_generacion || null
        };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

/**
 * Busca documentos electrónicos existentes para vincular en NC (05), ND (06), CR (07) o NR (04).
 */
async function searchRelatedDocuments(pool, companyId, { search = '', customerId = null, docType = null } = {}) {
    const cleanSearch = String(search || '').trim();
    const params = [companyId];
    let where = `
        WHERE h.company_id = ?
          AND COALESCE(d_c.codigo_generacion, d_v.codigo_generacion, h.codigo_generacion) IS NOT NULL
          AND COALESCE(d_c.codigo_generacion, d_v.codigo_generacion, h.codigo_generacion) != ''
          AND LOWER(COALESCE(h.estado, '')) NOT IN ('anulado', 'invalidado')
    `;

    if (customerId && Number(customerId) > 0) {
        where += ' AND h.customer_id = ?';
        params.push(Number(customerId));
    }

    if (docType && String(docType).trim() !== '') {
        where += ' AND COALESCE(h.tipo_documento, h.dte_type) = ?';
        params.push(String(docType).trim());
    }

    if (cleanSearch) {
        const like = `%${cleanSearch}%`;
        where += ` AND (
            h.numero_control LIKE ? OR
            h.codigo_generacion LIKE ? OR
            c.nombre LIKE ? OR
            h.cliente_nombre LIKE ? OR
            CAST(h.id AS CHAR) LIKE ?
        )`;
        params.push(like, like, like, like, like);
    }

    const [rows] = await pool.query(
        `SELECT h.id as sale_id,
                COALESCE(h.tipo_documento, h.dte_type) as tipo_documento,
                COALESCE(d_c.numero_control, d_v.numero_control, h.numero_control) as numero_control,
                COALESCE(d_c.codigo_generacion, d_v.codigo_generacion, h.codigo_generacion) as codigo_generacion,
                h.fecha_emision,
                h.customer_id,
                COALESCE(c.nombre, h.cliente_nombre, 'Consumidor Final') as customer_name,
                h.total_gravado,
                h.total_exento,
                h.total_iva,
                h.total_pagar,
                COALESCE(d_c.status, d_v.status, 'PENDING') as dte_status
         FROM sales_headers h
         LEFT JOIN customers c ON h.customer_id = c.id
         LEFT JOIN dtes d_c ON d_c.codigo_generacion = h.codigo_generacion AND d_c.company_id = h.company_id
         LEFT JOIN dtes d_v ON (h.codigo_generacion IS NULL OR h.codigo_generacion = '') AND d_v.venta_id = h.id AND d_v.company_id = h.company_id
         ${where}
         ORDER BY h.fecha_emision DESC, h.id DESC
         LIMIT 25`,
        params
    );

    return rows.map(r => ({
        ...r,
        fecha_emision: formatDateOnly(r.fecha_emision),
        total_gravado: round2(r.total_gravado),
        total_exento: round2(r.total_exento),
        total_iva: round2(r.total_iva),
        total_pagar: round2(r.total_pagar)
    }));
}

module.exports = {
    recalculateSaleDraft,
    analyzeDteRejection,
    getSaleCorrectionContext,
    applySaleDteCorrection,
    searchRelatedDocuments
};
