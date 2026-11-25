const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
const round6 = (n) => Math.round((Number(n) || 0) * 1000000) / 1000000;

const parseJsonSafe = (raw, fallback) => {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return fallback; }
};

const isCustomerExemptFlag = (c) => Boolean(
    c && (
        Number(c.exento_iva) === 1 ||
        c.exento_iva === true ||
        String(c.condicion_fiscal || '').trim().toLowerCase() === 'exento iva'
    )
);

const formatCondicionLabel = (c) => {
    if (!c) return 'Consumidor Final / General';
    const raw = String(c.condicion_fiscal || '').trim();
    if (raw === 'otro' || !raw) return c.nrc ? 'Contribuyente' : 'Consumidor Final';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
};

function extractTaxVal(tributos, code) {
    if (!Array.isArray(tributos)) return 0;
    return tributos.reduce((sum, t) => {
        if (t && typeof t === 'object' && String(t.codigo) === code) {
            return sum + (parseFloat(t.valor) || 0);
        }
        return sum;
    }, 0);
}

function recalculateSaleWithCurrentCustomer({
    sale,
    items,
    payments,
    customer,
    company,
    taxCfg,
    dteOrigJson,
    options = {}
}) {
    const dteType = String(sale.dte_type || sale.tipo_documento || '01');
    const unsupportedTypes = ['07', '14'];
    const fiscalRecalcSupported = Boolean(customer) && !unsupportedTypes.includes(dteType);

    const ivaRate = parseFloat(taxCfg?.iva_rate || 13) / 100;
    const fovialRate = parseFloat(taxCfg?.fovial_rate || 0.20);
    const cotransRate = parseFloat(taxCfg?.cotrans_rate || 0.10);
    const retRate = parseFloat(taxCfg?.retencion_rate || 1) / 100;
    const percRate = parseFloat(taxCfg?.percepcion_rate || 1) / 100;

    const stripIvaOnExempt = options.stripIvaOnExempt !== false;
    const addIvaFromExempt = options.addIvaFromExempt === true;

    const currentExento = isCustomerExemptFlag(customer);
    const currentGC = String(customer?.condicion_fiscal || '').trim().toLowerCase() === 'gran contribuyente';
    const currentAppliesFovial = customer ? (Number(customer.aplica_fovial) !== 0 && customer.aplica_fovial !== false) : true;
    const currentAppliesCotrans = customer ? (Number(customer.aplica_cotrans) !== 0 && customer.aplica_cotrans !== false) : true;
    const nosAgenteRetencion = String(company?.tipo_contribuyente || '').trim().toLowerCase() === 'grande';

    let hasNonFuelGravToExempt = false;
    let hasNonFuelExemptToGrav = false;
    let origAnyFovial = false;
    let origAnyCotrans = false;
    let origAnyExento = false;

    const recalcItems = (Array.isArray(items) ? items : []).map((item) => {
        const qty = parseFloat(item.cantidad || 0);
        const origPrice = parseFloat(item.precio_unitario || 0);
        const origDesc = parseFloat(item.monto_descuento || 0);
        const origGrav = parseFloat(item.venta_gravada || 0);
        const origEx = parseFloat(item.venta_exenta || 0);
        const origTributos = parseJsonSafe(item.tributos, []);
        const origD1 = round2(extractTaxVal(origTributos, 'D1'));
        const origC8 = round2(extractTaxVal(origTributos, 'C8'));
        if (origD1 > 0) origAnyFovial = true;
        if (origC8 > 0) origAnyCotrans = true;

        const wasExento = origGrav === 0 && origEx > 0;
        if (wasExento) origAnyExento = true;
        const isZeroDescriptive = origPrice === 0 && origGrav === 0 && origEx === 0;

        if (!fiscalRecalcSupported || isZeroDescriptive) {
            return {
                ...item,
                tributos: origTributos,
                exento: wasExento
            };
        }

        const isFuel = Number(item.tipo_combustible || 0) > 0 && dteType !== '04';
        const isProductExento = Number(item.product_es_exento || 0) === 1;
        const nextExento = dteType === '11' ? false : Boolean(isProductExento || currentExento);

        if (isFuel) {
            const nextFovial = currentAppliesFovial ? round2(qty * fovialRate) : 0;
            const nextCotrans = currentAppliesCotrans ? round2(qty * cotransRate) : 0;
            const fuelTributos = [];
            if (nextFovial > 0) fuelTributos.push({ codigo: 'D1', descripcion: 'FOVIAL', valor: nextFovial });
            if (nextCotrans > 0) fuelTributos.push({ codigo: 'C8', descripcion: 'COTRANS', valor: nextCotrans });

            const taxChanged = Math.abs(nextFovial - origD1) > 0.005 || Math.abs(nextCotrans - origC8) > 0.005;
            if (wasExento === nextExento && !taxChanged) {
                return {
                    ...item,
                    tributos: origTributos,
                    exento: wasExento
                };
            }

            const origUnitFuelTax = qty > 0 ? (origD1 + origC8) / qty : 0;
            const nextUnitFuelTax = qty > 0 ? (nextFovial + nextCotrans) / qty : 0;
            const pumpGrossPrice = wasExento
                ? (origPrice * (1 + ivaRate) + origUnitFuelTax)
                : origPrice;
            const grossDesc = wasExento ? (origDesc * (1 + ivaRate)) : origDesc;

            if (nextExento) {
                const newUnitPrice = qty > 0
                    ? round6(Math.max(0, (pumpGrossPrice - nextUnitFuelTax) / (1 + ivaRate)))
                    : round6(origPrice);
                const newDesc = round4(grossDesc / (1 + ivaRate));
                const newExenta = round2(Math.max(0, (newUnitPrice * qty) - newDesc));
                return {
                    ...item,
                    precio_unitario: newUnitPrice,
                    monto_descuento: newDesc,
                    venta_gravada: 0,
                    venta_exenta: newExenta,
                    tributos: fuelTributos,
                    exento: true
                };
            }

            const newUnitPrice = round6(pumpGrossPrice);
            const newDesc = round4(grossDesc);
            const newGravada = round2(Math.max(0, (newUnitPrice * qty) - newDesc - nextFovial - nextCotrans));
            return {
                ...item,
                precio_unitario: newUnitPrice,
                monto_descuento: newDesc,
                venta_gravada: newGravada,
                venta_exenta: 0,
                tributos: fuelTributos,
                exento: false
            };
        }

        // Mercadería general / servicios (no combustible)
        if (wasExento === nextExento) {
            return {
                ...item,
                tributos: origTributos,
                exento: wasExento
            };
        }

        if (!wasExento && nextExento) {
            hasNonFuelGravToExempt = true;
            const factor = stripIvaOnExempt ? (1 + ivaRate) : 1;
            const newUnitPrice = round6(origPrice / factor);
            const newDesc = round4(origDesc / factor);
            const newExenta = round2(Math.max(0, (newUnitPrice * qty) - newDesc));
            const cleanTributos = Array.isArray(origTributos)
                ? origTributos.filter(t => (typeof t === 'object' ? t.codigo : String(t)) !== '20')
                : [];
            return {
                ...item,
                precio_unitario: newUnitPrice,
                monto_descuento: newDesc,
                venta_gravada: 0,
                venta_exenta: newExenta,
                tributos: cleanTributos,
                exento: true
            };
        }

        // wasExento && !nextExento (Exento -> Gravado)
        hasNonFuelExemptToGrav = true;
        const factor = addIvaFromExempt ? (1 + ivaRate) : 1;
        const newUnitPrice = round6(origPrice * factor);
        const newDesc = round4(origDesc * factor);
        const newGravada = round2(Math.max(0, (newUnitPrice * qty) - newDesc));
        return {
            ...item,
            precio_unitario: newUnitPrice,
            monto_descuento: newDesc,
            venta_gravada: newGravada,
            venta_exenta: 0,
            tributos: origTributos,
            exento: false
        };
    });

    if (!fiscalRecalcSupported) {
        return {
            fiscal_recalc_supported: false,
            recalcHeader: {
                total_gravado: round2(sale.total_gravado),
                total_exento: round2(sale.total_exento),
                total_nosujetas: round2(sale.total_nosujetas),
                total_iva: round2(sale.total_iva),
                fovial: round2(sale.fovial),
                cotrans: round2(sale.cotrans),
                descuento_general: round2(sale.descuento_general),
                iva_retenido: round2(sale.iva_retenido),
                iva_percibido: round2(sale.iva_percibido),
                total_pagar: round2(sale.total_pagar)
            },
            recalcItems,
            recalcPayments: (payments || []).map(p => ({ ...p, monto: round2(p.monto) })),
            hasNonFuelGravToExempt: false,
            hasNonFuelExemptToGrav: false,
            origAnyExento,
            origAnyFovial,
            origAnyCotrans
        };
    }

    let gravadoBruto = 0;
    let exentoTotal = 0;
    let fovialTotal = 0;
    let cotransTotal = 0;

    for (const it of recalcItems) {
        gravadoBruto += parseFloat(it.venta_gravada || 0);
        exentoTotal += parseFloat(it.venta_exenta || 0);
        fovialTotal += extractTaxVal(it.tributos, 'D1');
        cotransTotal += extractTaxVal(it.tributos, 'C8');
    }

    gravadoBruto = round2(gravadoBruto);
    exentoTotal = round2(exentoTotal);
    fovialTotal = round2(fovialTotal);
    cotransTotal = round2(cotransTotal);

    const noSujetoTotal = round2(sale.total_nosujetas || 0);
    const origGenDiscount = round2(sale.descuento_general || 0);
    const safeGenDisc = Math.min(origGenDiscount, Math.max(0, gravadoBruto));

    let gravadoNeto = 0;
    let ivaTotal = 0;
    let subtotalGeneral = 0;

    if (dteType === '01') {
        const gravadoFinalConIva = Math.max(0, gravadoBruto - safeGenDisc);
        const netoSinIva = gravadoFinalConIva / (1 + ivaRate);
        ivaTotal = round2(gravadoFinalConIva - netoSinIva);
        gravadoNeto = round2(gravadoFinalConIva - ivaTotal);
        subtotalGeneral = round2(gravadoFinalConIva + exentoTotal + noSujetoTotal + fovialTotal + cotransTotal);
    } else if (dteType === '11') {
        gravadoNeto = round2(Math.max(0, gravadoBruto - safeGenDisc));
        ivaTotal = 0;
        subtotalGeneral = round2(gravadoNeto + exentoTotal + noSujetoTotal + fovialTotal + cotransTotal);
    } else {
        const netoAntes = gravadoBruto / (1 + ivaRate);
        const netGenDisc = safeGenDisc / (1 + ivaRate);
        gravadoNeto = round2(Math.max(0, netoAntes - netGenDisc));
        ivaTotal = round2(gravadoNeto * ivaRate);
        subtotalGeneral = round2(gravadoNeto + ivaTotal + exentoTotal + noSujetoTotal + fovialTotal + cotransTotal);
    }

    let retencion = 0;
    let percepcion = 0;
    if (['01', '03', '05', '06'].includes(dteType) && gravadoNeto >= 100) {
        if (!nosAgenteRetencion && currentGC) {
            retencion = round2(gravadoNeto * retRate);
        } else if (['03', '05', '06'].includes(dteType) && nosAgenteRetencion && !currentGC) {
            percepcion = round2(gravadoNeto * percRate);
        }
    }

    const totalPagar = round2(Math.max(0, subtotalGeneral - retencion + percepcion));

    // Reajustar pagos proporcionalmente al nuevo totalPagar
    const origPayments = Array.isArray(payments) ? payments : [];
    let recalcPayments = origPayments.map(p => ({ ...p, monto: round2(p.monto) }));
    if (origPayments.length === 1) {
        recalcPayments = [{ ...origPayments[0], monto: totalPagar }];
    } else if (origPayments.length > 1) {
        const prevSum = origPayments.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
        if (prevSum > 0) {
            let acc = 0;
            recalcPayments = origPayments.map((p, idx) => {
                if (idx === origPayments.length - 1) {
                    return { ...p, monto: round2(Math.max(0, totalPagar - acc)) };
                }
                const ratio = (parseFloat(p.monto || 0) / prevSum);
                const part = round2(totalPagar * ratio);
                acc = round2(acc + part);
                return { ...p, monto: part };
            });
        }
    }

    // Construir aviso de diferencias vs receptor anterior
    const origReceptor = dteOrigJson?.receptor || {};
    const receptorDiffs = [];
    const checkReceptorField = (key, label, origVal, currVal) => {
        const a = String(origVal ?? '').trim();
        const b = String(currVal ?? '').trim();
        if (a && b && a.toUpperCase() !== b.toUpperCase()) {
            receptorDiffs.push({ field: key, label, before: a, after: b });
        }
    };
    if (origReceptor && Object.keys(origReceptor).length > 0 && customer) {
        checkReceptorField('nombre', 'Nombre / Razón Social', origReceptor.nombre, customer.nombre);
        checkReceptorField('nit', 'NIT', origReceptor.nit || origReceptor.numDocumento, customer.nit || customer.numero_documento);
        checkReceptorField('nrc', 'NRC', origReceptor.nrc, customer.nrc);
        checkReceptorField('correo', 'Correo Electrónico', origReceptor.correo, customer.correo);
        checkReceptorField('codActividad', 'Actividad Económica', origReceptor.codActividad, customer.codigo_actividad);
    }

    return {
        fiscal_recalc_supported: true,
        recalcHeader: {
            total_gravado: gravadoNeto,
            total_exento: exentoTotal,
            total_nosujetas: noSujetoTotal,
            total_iva: ivaTotal,
            fovial: fovialTotal,
            cotrans: cotransTotal,
            descuento_general: safeGenDisc,
            iva_retenido: retencion,
            iva_percibido: percepcion,
            total_pagar: totalPagar
        },
        recalcItems,
        recalcPayments,
        receptorDiffs,
        hasNonFuelGravToExempt,
        hasNonFuelExemptToGrav,
        origAnyExento,
        origAnyFovial,
        origAnyCotrans
    };
}

async function buildRegeneratePreview(conn, saleId, companyId, options = {}) {
    const [sales] = await conn.query(
        `SELECT s.*, c.id as comp_id, c.razon_social, c.tipo_contribuyente, c.dte_active, c.ambiente as comp_ambiente
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
    const [items] = await conn.query(
        `SELECT si.*, p.es_exento as product_es_exento, p.tipo_combustible
         FROM sales_items si
         LEFT JOIN products p ON p.id = si.product_id
         WHERE si.sale_id = ?
         ORDER BY si.id ASC`,
        [saleId]
    );
    const [payments] = await conn.query('SELECT * FROM sales_payments WHERE sale_id = ?', [saleId]);
    const [dteRows] = await conn.query(
        `SELECT id, codigo_generacion, numero_control, status, sello_recepcion, json_original
         FROM dtes
         WHERE (venta_id = ? OR (codigo_generacion = ? AND codigo_generacion IS NOT NULL AND codigo_generacion != ''))
           AND company_id = ?
         ORDER BY id DESC LIMIT 1`,
        [saleId, sale.codigo_generacion, companyId]
    );
    const activeDte = dteRows[0] || null;
    const dteOrigJson = parseJsonSafe(activeDte?.json_original, null);

    let customer = null;
    if (sale.customer_id) {
        const [custRows] = await conn.query(
            'SELECT * FROM customers WHERE id = ? AND company_id = ? LIMIT 1',
            [sale.customer_id, companyId]
        );
        customer = custRows[0] || null;
    }

    const [taxRows] = await conn.query('SELECT * FROM tax_configurations WHERE company_id = ? LIMIT 1', [companyId]);
    const taxCfg = taxRows[0] || { iva_rate: 13, fovial_rate: 0.20, cotrans_rate: 0.10, retencion_rate: 1, percepcion_rate: 1 };

    const isAlreadyAccepted = Boolean(
        activeDte?.status === 'ACCEPTED' ||
        activeDte?.sello_recepcion ||
        sale.sello_recepcion
    );

    const calc = recalculateSaleWithCurrentCustomer({
        sale,
        items,
        payments,
        customer,
        company: { tipo_contribuyente: sale.tipo_contribuyente },
        taxCfg,
        dteOrigJson,
        options
    });

    const originalHeader = {
        total_gravado: round2(sale.total_gravado),
        total_exento: round2(sale.total_exento),
        total_nosujetas: round2(sale.total_nosujetas),
        total_iva: round2(sale.total_iva),
        fovial: round2(sale.fovial),
        cotrans: round2(sale.cotrans),
        descuento_general: round2(sale.descuento_general),
        iva_retenido: round2(sale.iva_retenido),
        iva_percibido: round2(sale.iva_percibido),
        total_pagar: round2(sale.total_pagar)
    };

    const fiscalDiffs = [];
    const diffFields = [
        ['total_gravado', 'Gravado Neto'],
        ['total_exento', 'Exento'],
        ['total_iva', 'IVA (13%)'],
        ['iva_retenido', 'Retención 1%'],
        ['iva_percibido', 'Percepción 1%'],
        ['fovial', 'FOVIAL'],
        ['cotrans', 'COTRANS'],
        ['total_pagar', 'Total a Pagar']
    ];
    for (const [k, label] of diffFields) {
        const before = originalHeader[k];
        const after = calc.recalcHeader[k];
        if (Math.abs(after - before) >= 0.01) {
            fiscalDiffs.push({ field: k, label, before, after, delta: round2(after - before) });
        }
    }

    const hasFiscalChanges = fiscalDiffs.length > 0;
    const hasReceptorChanges = (calc.receptorDiffs || []).length > 0;

    const warnings = [];
    const dteType = String(sale.dte_type || sale.tipo_documento || '01');
    if (dteType === '03' && customer && !String(customer.nrc || '').trim()) {
        warnings.push('El cliente actual no posee NRC configurado; Hacienda podría rechazar un Crédito Fiscal (DTE-03) sin NRC.');
    }
    if (customer && String(customer.condicion_fiscal || '').toLowerCase() === 'extranjero' && ['01', '03'].includes(dteType)) {
        warnings.push('El cliente figura actualmente como Extranjero en un comprobante local.');
    }
    if (hasFiscalChanges && Math.abs(calc.recalcHeader.total_pagar - originalHeader.total_pagar) >= 0.01) {
        warnings.push(
            `El Total a Pagar cambiará de $${originalHeader.total_pagar.toFixed(2)} a $${calc.recalcHeader.total_pagar.toFixed(2)}; los montos registrados en formas de pago se ajustarán al nuevo total.`
        );
    }

    return {
        sale_id: Number(saleId),
        dte_type: dteType,
        is_already_accepted: isAlreadyAccepted,
        fiscal_recalc_supported: calc.fiscal_recalc_supported,
        has_customer: Boolean(customer),
        customer_current: customer
            ? {
                id: customer.id,
                nombre: customer.nombre,
                nit: customer.nit,
                nrc: customer.nrc,
                condicion_fiscal: customer.condicion_fiscal,
                condicion_label: formatCondicionLabel(customer),
                exento_iva: isCustomerExemptFlag(customer),
                aplica_fovial: Number(customer.aplica_fovial) !== 0 && customer.aplica_fovial !== false,
                aplica_cotrans: Number(customer.aplica_cotrans) !== 0 && customer.aplica_cotrans !== false,
                dias_credito: customer.dias_credito || 15
            }
            : null,
        original_header: originalHeader,
        recalculated_header: calc.recalcHeader,
        recalculated_items: calc.recalcItems,
        recalculated_payments: calc.recalcPayments,
        fiscal_diffs: fiscalDiffs,
        receptor_diffs: calc.receptorDiffs || [],
        has_fiscal_changes: hasFiscalChanges,
        has_receptor_changes: hasReceptorChanges,
        options_applicable: {
            can_strip_iva_on_exempt: calc.hasNonFuelGravToExempt,
            can_add_iva_from_exempt: calc.hasNonFuelExemptToGrav
        },
        warnings
    };
}

module.exports = {
    buildRegeneratePreview,
    recalculateSaleWithCurrentCustomer
};
