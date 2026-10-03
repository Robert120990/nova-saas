const pool = require('../../config/db');
const numeric = (value) => parseFloat(value) || 0;
const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

function buildLine(lines, accountId, description, amount, side) {
    const amt = round2(Math.abs(amount));
    if (!accountId || amt < 0.005) return;
    // Las devoluciones revierten el movimiento, sin perder el signo del saldo.
    const actualSide = amount < 0 ? (side === 'debit' ? 'credit' : 'debit') : side;
    const oppositeSide = actualSide === 'debit' ? 'credit' : 'debit';
    const existing = lines.find(l => l.account_id === Number(accountId) && l.description === description && !l[oppositeSide]);
    if (existing) {
        existing[actualSide] = round2(existing[actualSide] + amt);
    } else {
        lines.push({ account_id: parseInt(accountId, 10), description, debit: actualSide === 'debit' ? amt : 0, credit: actualSide === 'credit' ? amt : 0 });
    }
}

function balanceLines(lines) {
    let debit = 0; let credit = 0;
    lines.forEach(l => { debit += l.debit; credit += l.credit; });
    debit = round2(debit); credit = round2(credit);
    return { debit, credit, diff: round2(debit - credit), balanced: debit === credit };
}

async function buildVentasPreview(companyId, date, detailCredit, settings) {
    const [headers] = await pool.query(
        `SELECT h.id, h.customer_id, c.nombre AS customer_nombre, c.nrc AS customer_nrc, c.account_id AS customer_account_id,
                h.tipo_documento, h.condicion_operacion,
                h.total_gravado, h.total_exento, h.total_nosujetas, h.total_iva,
                h.fovial, h.cotrans, h.iva_percibido, h.iva_retenido, h.total_pagar
         FROM sales_headers h
         LEFT JOIN customers c ON c.id = h.customer_id
         WHERE h.company_id = ? AND DATE(h.fecha_emision) = ? AND UPPER(h.estado) <> 'ANULADO'`,
        [companyId, date]
    );

    const [payments] = await pool.query(
        `SELECT sp.metodo_pago, SUM(sp.monto) AS monto
         FROM sales_payments sp
         JOIN sales_headers h ON h.id = sp.sale_id
         WHERE h.company_id = ? AND DATE(h.fecha_emision) = ?
           AND UPPER(h.estado) <> 'ANULADO' AND h.tipo_documento <> '05'
           AND h.condicion_operacion = 1
         GROUP BY sp.metodo_pago`,
        [companyId, date]
    );

    const lines = [];
    let cajaTotal = 0; let bancosTotal = 0;
    payments.forEach(p => {
        if (String(p.metodo_pago) === '01') cajaTotal += parseFloat(p.monto) || 0;
        else bancosTotal += parseFloat(p.monto) || 0;
    });
    buildLine(lines, settings.CUENTA_CAJA, 'Cobros en efectivo del día', cajaTotal, 'debit');
    buildLine(lines, settings.CUENTA_BANCOS, 'Cobros tarjeta/transferencia del día', bancosTotal, 'debit');

    const creditosPorCliente = new Map();
    let creditosTotal = 0;
    const totales = { gravadasNetas: 0, exentas: 0, nosujetas: 0, iva: 0, fovial: 0, cotrans: 0, percibido: 0, retenido: 0 };
    headers.forEach(h => {
        const sign = h.tipo_documento === '05' ? -1 : 1;
        totales.gravadasNetas += sign * numeric(h.total_gravado);
        totales.exentas += sign * numeric(h.total_exento);
        totales.nosujetas += sign * numeric(h.total_nosujetas);
        totales.iva += sign * numeric(h.total_iva);
        totales.fovial += sign * numeric(h.fovial);
        totales.cotrans += sign * numeric(h.cotrans);
        totales.percibido += sign * numeric(h.iva_percibido);
        totales.retenido += sign * numeric(h.iva_retenido);
        if (String(h.condicion_operacion) === '2') {
            const monto = sign * numeric(h.total_pagar);
            creditosTotal += monto;
            if (detailCredit) {
                const key = h.customer_id || 0;
                const prev = creditosPorCliente.get(key) || {
                    nombre: h.customer_nombre || 'Consumidor Final',
                    nrc: h.customer_nrc || '',
                    account_id: h.customer_account_id || null,
                    monto: 0
                };
                prev.monto += monto;
                creditosPorCliente.set(key, prev);
            }
        }
    });

    const unmapped = [];
    if (detailCredit) {
        for (const info of creditosPorCliente.values()) {
            const accountId = info.account_id || settings.CUENTA_CLIENTES_CXC;
            if (!info.account_id) unmapped.push(`${info.nombre}${info.nrc ? ` (NRC ${info.nrc})` : ''}`);
            buildLine(lines, accountId, `Crédito — ${info.nombre}`, info.monto, 'debit');
        }
    } else {
        buildLine(lines, settings.CUENTA_CLIENTES_CXC, 'Ventas al crédito del día', creditosTotal, 'debit');
    }

    buildLine(lines, settings.CUENTA_VENTAS_GRAVADAS, 'Ventas gravadas del día', totales.gravadasNetas, 'credit');
    buildLine(lines, settings.CUENTA_VENTAS_EXENTAS, 'Ventas exentas del día', totales.exentas, 'credit');
    buildLine(lines, settings.CUENTA_VENTAS_NOSUJETAS, 'Ventas no sujetas del día', totales.nosujetas, 'credit');
    buildLine(lines, settings.CUENTA_IVA_DEBITO, 'IVA débito fiscal del día', totales.iva, 'credit');
    buildLine(lines, settings.CUENTA_FOVIAL_POR_PAGAR, 'FOVIAL del día', totales.fovial, 'credit');
    buildLine(lines, settings.CUENTA_COTRANS_POR_PAGAR, 'COTRANS del día', totales.cotrans, 'credit');
    buildLine(lines, settings.CUENTA_IVA_PERCIBIDO, 'IVA percibido del día', totales.percibido, 'credit');
    if (totales.retenido !== 0) {
        buildLine(lines, settings.CUENTA_IVA_RETENIDO || settings.CUENTA_CLIENTES_CXC, 'IVA retenido por clientes', totales.retenido, 'debit');
    }

    const { diff } = balanceLines(lines);
    if (diff !== 0) {
        buildLine(lines, settings.CUENTA_VENTAS_GRAVADAS, 'Ajuste descuentos/redondeos del día', Math.abs(diff), diff < 0 ? 'debit' : 'credit');
    }

    return {
        lines: lines.map(l => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) })),
        totals: balanceLines(lines),
        unmapped_entities: unmapped,
        source: { documentos: headers.length, ...Object.fromEntries(Object.entries(totales).map(([k, v]) => [k, round2(v)])), cobros_efectivo: round2(cajaTotal), cobros_bancos: round2(bancosTotal), ventas_credito: round2(creditosTotal) }
    };
}

async function buildComprasPreview(companyId, date, detailCredit, settings) {
    const [headers] = await pool.query(
        `SELECT p.id, p.provider_id, pr.nombre AS provider_nombre, pr.nrc AS provider_nrc, pr.account_id AS provider_account_id,
                p.tipo_documento_id, p.condicion_operacion_id,
                p.total_gravada, p.total_exenta, p.total_nosujeta, p.iva,
                p.retencion, p.percepcion, p.fovial, p.cotrans, p.monto_total
         FROM purchase_headers p
         LEFT JOIN providers pr ON pr.id = p.provider_id
         WHERE p.company_id = ? AND DATE(p.fecha) = ? AND p.status <> 'ANULADO'`,
        [companyId, date]
    );

    const lines = [];
    const porProveedor = new Map();
    let contadoNeto = 0; let retenciones = 0;
    const totales = { gravada: 0, exenta: 0, iva: 0, fovial: 0, cotrans: 0 };
    headers.forEach(p => {
        const sign = (p.tipo_documento_id === '05' || p.tipo_documento_id === '06') ? -1 : 1;
        totales.gravada += sign * numeric(p.total_gravada);
        totales.exenta += sign * (numeric(p.total_exenta) + numeric(p.total_nosujeta));
        totales.iva += sign * (numeric(p.iva) + numeric(p.percepcion));
        totales.fovial += sign * numeric(p.fovial);
        totales.cotrans += sign * numeric(p.cotrans);
        retenciones += sign * numeric(p.retencion);
        const neto = sign * numeric(p.monto_total);
        if (String(p.condicion_operacion_id) === '2') {
            const key = p.provider_id || 0;
            const prev = porProveedor.get(key) || {
                nombre: p.provider_nombre || 'Proveedor sin identificar',
                nrc: p.provider_nrc || '',
                account_id: p.provider_account_id || null,
                monto: 0
            };
            prev.monto += neto;
            porProveedor.set(key, prev);
        } else {
            contadoNeto += neto;
        }
    });

    buildLine(lines, settings.CUENTA_COMPRAS_GRAVADAS, 'Compras gravadas del día', totales.gravada, 'debit');
    buildLine(lines, settings.CUENTA_COMPRAS_EXENTAS, 'Compras exentas / no sujetas del día', totales.exenta, 'debit');
    buildLine(lines, settings.CUENTA_IVA_CREDITO, 'IVA crédito fiscal (+percepción) del día', totales.iva, 'debit');
    buildLine(lines, settings.CUENTA_FOVIAL_POR_PAGAR, 'FOVIAL crédito del día', totales.fovial, 'debit');
    buildLine(lines, settings.CUENTA_COTRANS_POR_PAGAR, 'COTRANS crédito del día', totales.cotrans, 'debit');

    const unmapped = [];
    if (detailCredit) {
        for (const info of porProveedor.values()) {
            const accountId = info.account_id || settings.CUENTA_PROVEEDORES_CXP;
            if (!info.account_id) unmapped.push(`${info.nombre}${info.nrc ? ` (NRC ${info.nrc})` : ''}`);
            buildLine(lines, accountId, `Crédito — ${info.nombre}`, info.monto, 'credit');
        }
    } else {
        let creditoTotal = 0;
        porProveedor.forEach(info => { creditoTotal += info.monto; });
        buildLine(lines, settings.CUENTA_PROVEEDORES_CXP, 'Compras al crédito del día', creditoTotal, 'credit');
    }
    buildLine(lines, settings.CUENTA_CAJA, 'Compras al contado del día (neto)', contadoNeto, 'credit');
    buildLine(lines, settings.CUENTA_IVA_RETENIDO, 'IVA retenido por proveedores', retenciones, 'credit');

    const { diff } = balanceLines(lines);
    if (diff !== 0) {
        buildLine(lines, settings.CUENTA_COMPRAS_GRAVADAS, 'Ajuste redondeos del día', Math.abs(diff), diff < 0 ? 'debit' : 'credit');
    }

    return {
        lines: lines.map(l => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) })),
        totals: balanceLines(lines),
        unmapped_entities: unmapped,
        source: { documentos: headers.length, ...Object.fromEntries(Object.entries(totales).map(([k, v]) => [k, round2(v)])), retenciones: round2(retenciones), contado_neto: round2(contadoNeto) }
    };
}

async function buildCxcPreview(companyId, date, detailCredit, settings) {
    const [payments] = await pool.query(
        `SELECT cp.id, cp.customer_id, c.nombre AS customer_nombre, c.nrc AS customer_nrc, c.account_id AS customer_account_id,
                cp.monto, cp.metodo_pago
         FROM customer_payments cp
         LEFT JOIN customers c ON c.id = cp.customer_id
         WHERE cp.company_id = ? AND cp.fecha_pago = ?`,
        [companyId, date]
    );

    const lines = [];
    let cajaTotal = 0; let bancosTotal = 0;
    payments.forEach(p => {
        if ((p.metodo_pago || '').trim().toLowerCase() === 'efectivo') cajaTotal += parseFloat(p.monto) || 0;
        else bancosTotal += parseFloat(p.monto) || 0;
    });
    buildLine(lines, settings.CUENTA_CAJA, 'Cobros en efectivo del día', cajaTotal, 'debit');
    buildLine(lines, settings.CUENTA_BANCOS, 'Cobros por banco/tarjeta del día', bancosTotal, 'debit');

    const porCliente = new Map();
    payments.forEach(p => {
        const key = p.customer_id || 0;
        const prev = porCliente.get(key) || {
            nombre: p.customer_nombre || 'Cliente sin identificar',
            nrc: p.customer_nrc || '',
            account_id: p.customer_account_id || null,
            monto: 0
        };
        prev.monto += parseFloat(p.monto) || 0;
        porCliente.set(key, prev);
    });

    const unmapped = [];
    if (detailCredit) {
        for (const info of porCliente.values()) {
            const accountId = info.account_id || settings.CUENTA_CLIENTES_CXC;
            if (!info.account_id) unmapped.push(`${info.nombre}${info.nrc ? ` (NRC ${info.nrc})` : ''}`);
            buildLine(lines, accountId, `Abono — ${info.nombre}`, info.monto, 'credit');
        }
    } else {
        let total = 0;
        porCliente.forEach(info => { total += info.monto; });
        buildLine(lines, settings.CUENTA_CLIENTES_CXC, 'Abonos de clientes del día', total, 'credit');
    }

    return {
        lines: lines.map(l => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) })),
        totals: balanceLines(lines),
        unmapped_entities: unmapped,
        source: { abonos: payments.length, cobros_efectivo: round2(cajaTotal), cobros_bancos: round2(bancosTotal) }
    };
}

async function buildCxpPreview(companyId, date, detailCredit, settings) {
    const [payments] = await pool.query(
        `SELECT pp.id, pp.provider_id, pr.nombre AS provider_nombre, pr.nrc AS provider_nrc, pr.account_id AS provider_account_id,
                pp.purchase_id, pp.expense_id, pp.monto, pp.metodo_pago
         FROM provider_payments pp
         LEFT JOIN providers pr ON pr.id = pp.provider_id
         WHERE pp.company_id = ? AND pp.fecha_pago = ?`,
        [companyId, date]
    );

    const lines = [];
    let cajaTotal = 0; let bancosTotal = 0;
    payments.forEach(p => {
        if ((p.metodo_pago || '').trim().toLowerCase() === 'efectivo') cajaTotal += parseFloat(p.monto) || 0;
        else bancosTotal += parseFloat(p.monto) || 0;
    });

    const porProveedor = new Map();
    payments.forEach(p => {
        const key = p.provider_id || 0;
        const prev = porProveedor.get(key) || {
            nombre: p.provider_nombre || 'Proveedor sin identificar',
            nrc: p.provider_nrc || '',
            account_id: p.provider_account_id || null,
            monto: 0
        };
        prev.monto += parseFloat(p.monto) || 0;
        porProveedor.set(key, prev);
    });

    const unmapped = [];
    if (detailCredit) {
        for (const info of porProveedor.values()) {
            const accountId = info.account_id || settings.CUENTA_PROVEEDORES_CXP;
            if (!info.account_id) unmapped.push(`${info.nombre}${info.nrc ? ` (NRC ${info.nrc})` : ''}`);
            buildLine(lines, accountId, `Pago — ${info.nombre}`, info.monto, 'debit');
        }
    } else {
        let total = 0;
        porProveedor.forEach(info => { total += info.monto; });
        buildLine(lines, settings.CUENTA_PROVEEDORES_CXP, 'Pagos a proveedores del día', total, 'debit');
    }

    buildLine(lines, settings.CUENTA_CAJA, 'Pagos en efectivo del día', cajaTotal, 'credit');
    buildLine(lines, settings.CUENTA_BANCOS, 'Pagos por banco/tarjeta del día', bancosTotal, 'credit');

    return {
        lines: lines.map(l => ({ ...l, debit: round2(l.debit), credit: round2(l.credit) })),
        totals: balanceLines(lines),
        unmapped_entities: unmapped,
        source: { pagos: payments.length, pagos_efectivo: round2(cajaTotal), pagos_bancos: round2(bancosTotal) }
    };
}


module.exports = { buildVentasPreview, buildComprasPreview, buildCxcPreview, buildCxpPreview };
