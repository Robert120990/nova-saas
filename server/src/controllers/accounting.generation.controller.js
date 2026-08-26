const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const { reserveEntryNumber } = require('./accounting.correlativos.controller');

const REQUIRED_KEYS = {
    ventas: [
        'CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_CLIENTES_CXC',
        'CUENTA_VENTAS_GRAVADAS', 'CUENTA_VENTAS_EXENTAS', 'CUENTA_VENTAS_NOSUJETAS',
        'CUENTA_IVA_DEBITO', 'CUENTA_FOVIAL_POR_PAGAR', 'CUENTA_COTRANS_POR_PAGAR', 'CUENTA_IVA_PERCIBIDO'
    ],
    compras: [
        'CUENTA_COMPRAS_GRAVADAS', 'CUENTA_COMPRAS_EXENTAS', 'CUENTA_IVA_CREDITO',
        'CUENTA_PROVEEDORES_CXP', 'CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_IVA_RETENIDO',
        'CUENTA_FOVIAL_POR_PAGAR', 'CUENTA_COTRANS_POR_PAGAR'
    ],
    cxc: ['CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_CLIENTES_CXC'],
    cxp: ['CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_PROVEEDORES_CXP']
};

const KIND_ENTRY_CODE = { ventas: 'VENTAS', compras: 'COMPRAS', cxc: 'CXC', cxp: 'CXP' };
const DEDUP_PREFIX = { ventas: 'PARTIDA_VENTAS_', compras: 'PARTIDA_COMPRAS_', cxc: 'PARTIDA_CXC_', cxp: 'PARTIDA_CXP_' };

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

async function getSettingsMap(companyId) {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ?', [companyId]);
    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value; });
    return map;
}

async function getEntryTypeIdByCode(code) {
    const [[row]] = await pool.query('SELECT id FROM entry_types WHERE code = ?', [code]);
    return row ? row.id : null;
}

const getConfig = async (req, res) => {
    try {
        const settings = await getSettingsMap(req.company_id);
        const mappings = {};
        const missing = [];
        for (const kind of Object.keys(REQUIRED_KEYS)) {
            mappings[kind] = {};
            for (const key of REQUIRED_KEYS[kind]) {
                const val = settings[key] ? parseInt(settings[key], 10) : null;
                mappings[kind][key] = val;
                if (!val && !missing.includes(key)) missing.push(key);
            }
        }
        const entryTypes = {};
        for (const [kind, code] of Object.entries(KIND_ENTRY_CODE)) {
            entryTypes[kind] = await getEntryTypeIdByCode(code);
        }
        res.json({ mappings, missing, entry_types: entryTypes });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

function buildLine(lines, accountId, description, amount, side) {
    const amt = round2(Math.abs(amount));
    if (!accountId || amt < 0.005) return;
    const existing = lines.find(l => l.account_id === accountId && l.description === description);
    if (existing) {
        existing[side] = round2(existing[side] + amt);
    } else {
        lines.push({ account_id: parseInt(accountId, 10), description, debit: side === 'debit' ? amt : 0, credit: side === 'credit' ? amt : 0 });
    }
}

function balanceLines(lines) {
    let debit = 0; let credit = 0;
    lines.forEach(l => { debit += l.debit; credit += l.credit; });
    debit = round2(debit); credit = round2(credit);
    return { debit, credit, diff: round2(debit - credit), balanced: Math.abs(debit - credit) <= 0.01 };
}

async function buildVentasPreview(companyId, date, detailCredit, settings) {
    const [headers] = await pool.query(
        `SELECT h.id, h.customer_id, c.nombre AS customer_nombre, c.nrc AS customer_nrc, c.account_id AS customer_account_id,
                h.tipo_documento, h.condicion_operacion,
                h.total_gravado, h.total_exento, h.total_nosujetas, h.total_iva,
                h.fovial, h.cotrans, h.iva_percibido, h.total_pagar
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
    const totales = { gravadasNetas: 0, exentas: 0, nosujetas: 0, iva: 0, fovial: 0, cotrans: 0, percibido: 0 };
    headers.forEach(h => {
        const sign = h.tipo_documento === '05' ? -1 : 1;
        totales.gravadasNetas += sign * (parseFloat(h.total_gravado) - parseFloat(h.total_iva));
        totales.exentas += sign * parseFloat(h.total_exento);
        totales.nosujetas += sign * parseFloat(h.total_nosujetas);
        totales.iva += sign * parseFloat(h.total_iva);
        totales.fovial += sign * parseFloat(h.fovial);
        totales.cotrans += sign * parseFloat(h.cotrans);
        totales.percibido += sign * parseFloat(h.iva_percibido);
        if (h.condicion_operacion === 2) {
            const monto = sign * parseFloat(h.total_pagar);
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

    const { diff } = balanceLines(lines);
    if (Math.abs(diff) > 0.01) {
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
        const sign = p.tipo_documento_id === '06' ? -1 : 1;
        totales.gravada += sign * parseFloat(p.total_gravada);
        totales.exenta += sign * (parseFloat(p.total_exenta) + parseFloat(p.total_nosujeta));
        totales.iva += sign * (parseFloat(p.iva) + parseFloat(p.percepcion));
        totales.fovial += sign * parseFloat(p.fovial);
        totales.cotrans += sign * parseFloat(p.cotrans);
        retenciones += sign * parseFloat(p.retencion);
        const neto = sign * (parseFloat(p.monto_total) - parseFloat(p.retencion));
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
    if (Math.abs(diff) > 0.01) {
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

const preview = async (req, res) => {
    try {
        const { kind, date, detail_credit } = req.body;
        if (!KIND_ENTRY_CODE[kind]) return res.status(400).json({ message: 'Tipo inválido (ventas|compras)' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });

        const settings = await getSettingsMap(req.company_id);
        const required = REQUIRED_KEYS[kind];
        const missing = required.filter(k => !settings[k]);
        if (missing.length > 0) {
            return res.status(400).json({ message: `Faltan cuentas configuradas: ${missing.join(', ')}`, missing });
        }
        const numericSettings = {};
        required.forEach(k => { numericSettings[k] = parseInt(settings[k], 10); });

        const data = kind === 'ventas'
            ? await buildVentasPreview(req.company_id, date, !!detail_credit, numericSettings)
            : kind === 'compras'
                ? await buildComprasPreview(req.company_id, date, !!detail_credit, numericSettings)
                : kind === 'cxc'
                    ? await buildCxcPreview(req.company_id, date, !!detail_credit, numericSettings)
                    : await buildCxpPreview(req.company_id, date, !!detail_credit, numericSettings);

        const dedupKey = DEDUP_PREFIX[kind] + date;
        const alreadyGenerated = !!settings[dedupKey];

        res.json({ kind, date, detail_credit: !!detail_credit, already_generated: alreadyGenerated, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const generate = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { kind, date, lines, description } = req.body;
        if (!KIND_ENTRY_CODE[kind]) return res.status(400).json({ message: 'Tipo inválido (ventas|compras)' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });
        if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ message: 'Debe tener al menos una línea' });

        const totalDebit = round2(lines.reduce((s, l) => s + parseFloat(l.debit || 0), 0));
        const totalCredit = round2(lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0));
        if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ message: 'El débito y crédito no cuadran' });
        if (lines.some(l => !l.account_id)) return res.status(400).json({ message: 'Todas las líneas necesitan cuenta contable' });

        const settings = await getSettingsMap(req.company_id);
        const dedupKey = DEDUP_PREFIX[kind] + date;
        if (settings[dedupKey]) {
            return res.status(409).json({ message: `Ya existe una partida de ${kind} generada para ${date} (partida #${settings[dedupKey]}). Anúlala primero si deseas regenerarla.` });
        }

        const entryTypeId = await getEntryTypeIdByCode(KIND_ENTRY_CODE[kind]);
        if (!entryTypeId) return res.status(500).json({ message: `No existe el tipo de partida ${KIND_ENTRY_CODE[kind]}. Ejecuta la migración v145.` });

        await conn.beginTransaction();
        try {
            const entryNumber = await reserveEntryNumber(conn, req.company_id, entryTypeId, date);
            const defaultDesc = {
                ventas: `CONTABILIZACION AUTOMATICA DE VENTAS DEL ${date}`,
                compras: `CONTABILIZACION AUTOMATICA DE COMPRAS DEL ${date}`,
                cxc: `CONTABILIZACION AUTOMATICA DE COBRANZAS DEL ${date}`,
                cxp: `CONTABILIZACION AUTOMATICA DE PAGOS DEL ${date}`
            }[kind];

            const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
                company_id: req.company_id,
                branch_id: req.branch_id,
                entry_type_id: entryTypeId,
                number: entryNumber,
                date,
                description: description || defaultDesc,
                total_debit: totalDebit,
                total_credit: totalCredit,
                status: 'posted',
                created_by: req.user?.id
            }]);
            for (const line of lines) {
                await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                    entry_id: r.insertId,
                    account_id: line.account_id,
                    description: line.description || '',
                    debit: round2(line.debit || 0),
                    credit: round2(line.credit || 0)
                }]);
            }
            await conn.query(
                'INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [req.company_id, dedupKey, String(r.insertId), String(r.insertId)]
            );
            await conn.commit();

            notificationService.notify('accounting_entry_created', req.company_id, req.user?.branch_id, {
                partida_id: r.insertId,
                tipo_partida: KIND_ENTRY_CODE[kind],
                descripcion: description || defaultDesc,
                total_debe: totalDebit,
                total_haber: totalCredit,
                fecha: date
            }).catch(() => {});

            res.status(201).json({ id: r.insertId, number: entryNumber, message: 'Partida generada' });
        } catch (e) {
            await conn.rollback();
            throw e;
        }
    } catch (e) { res.status(500).json({ message: e.message }); }
    finally { conn.release(); }
};

const ENTITY_TABLES = {
    cliente: { table: 'customers', nameCol: 'nombre' },
    proveedor: { table: 'providers', nameCol: 'nombre' }
};

const listEntityAccounts = async (req, res) => {
    try {
        const type = req.query.type;
        const conf = ENTITY_TABLES[type];
        if (!conf) return res.status(400).json({ message: 'Tipo inválido (cliente|proveedor)' });
        const search = (req.query.search || '').trim();
        let sql = `
            SELECT t.id, t.nombre, t.nrc, t.account_id,
                   acc.code AS account_code, acc.name AS account_name
            FROM ${conf.table} t
            LEFT JOIN chart_of_accounts acc ON acc.id = t.account_id
            WHERE t.company_id = ?`;
        const params = [req.company_id];
        if (search) {
            sql += ` AND (t.nombre LIKE ? OR t.nrc LIKE ?)`;
            const like = `%${search}%`;
            params.push(like, like);
        }
        sql += ' ORDER BY t.nombre LIMIT 50';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const saveEntityAccounts = async (req, res) => {
    try {
        const { type, items } = req.body;
        const conf = ENTITY_TABLES[type];
        if (!conf) return res.status(400).json({ message: 'Tipo inválido (cliente|proveedor)' });
        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Sin cambios' });
        for (const item of items) {
            if (!item.id) continue;
            if (item.account_id) {
                const [[acc]] = await pool.query(
                    'SELECT id FROM chart_of_accounts WHERE id = ? AND company_id = ?',
                    [item.account_id, req.company_id]
                );
                if (!acc) return res.status(400).json({ message: `La cuenta ${item.account_id} no pertenece a tu empresa` });
            }
            await pool.query(
                `UPDATE ${conf.table} SET account_id = ? WHERE id = ? AND company_id = ?`,
                [item.account_id || null, item.id, req.company_id]
            );
        }
        res.json({ message: 'Asignaciones guardadas' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = { getConfig, preview, generate, listEntityAccounts, saveEntityAccounts };
