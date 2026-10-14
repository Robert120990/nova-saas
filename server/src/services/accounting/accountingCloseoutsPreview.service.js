const pool = require('../../config/db');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((parseFloat(n) || 0) * 10000) / 10000;

function categorizeFuel(item, readings = []) {
    let name = String(item?.nombre || item?.descripcion_producto || item?.prod_nombre || item?.producto_descripcion || '').toUpperCase();
    if (!name && item?.precio && Array.isArray(readings) && readings.length > 0) {
        const itemPrice = parseFloat(item.precio) || 0;
        const match = readings.find(r => Math.abs((parseFloat(r.precio) || 0) - itemPrice) < 0.01);
        if (match) name = String(match.descripcion_producto || match.prod_nombre || '').toUpperCase();
    }
    const tipo = Number(item?.tipo_combustible);
    if (tipo === 5 || name.includes('ION') || name.includes('ESPECIAL')) return { key: 'ion_diesel', label: 'ION DIESEL' };
    if (tipo === 1 || name.includes('REGULAR')) return { key: 'regular', label: 'REGULAR' };
    if (tipo === 2 || name.includes('SUPER')) return { key: 'super', label: 'SUPER' };
    return { key: 'diesel', label: 'DIESEL' };
}

async function getCompanySettings(companyId, branchId = 0) {
    const [rows] = await pool.query(
        'SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ? AND branch_id IN (0, ?) ORDER BY branch_id ASC',
        [companyId, Number(branchId) || 0]
    );
    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value ? parseInt(r.setting_value, 10) : null; });
    if (map.CUENTA_TARJETAS_PRISS && !map.CUENTA_TARJETAS_PRIS) map.CUENTA_TARJETAS_PRIS = map.CUENTA_TARJETAS_PRISS;
    if (map.CUENTA_TARJETAS_PRIS && !map.CUENTA_TARJETAS_PRISS) map.CUENTA_TARJETAS_PRISS = map.CUENTA_TARJETAS_PRIS;
    return map;
}

async function getAccountDetails(companyId, accountIds) {
    if (!accountIds.length) return new Map();
    const [rows] = await pool.query('SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND id IN (?)', [companyId, accountIds]);
    const map = new Map();
    rows.forEach(r => map.set(r.id, { id: r.id, code: r.code, name: r.name }));
    return map;
}

async function buildCloseoutsPreview(companyId, branchId, date) {
    const [[branch]] = await pool.query('SELECT id, nombre, codigo FROM branches WHERE id = ? AND company_id = ?', [branchId, companyId]);
    const branchLabel = branch ? `${branch.codigo ? branch.codigo + ' - ' : ''}${branch.nombre}`.toUpperCase() : 'SUCURSAL';

    const [closeouts] = await pool.query(
        `SELECT id, numero_turno, estado, seller_name FROM gas_station_closeouts WHERE company_id = ? AND branch_id = ? AND fecha_turno = ?`,
        [companyId, branchId, date]
    );
    if (closeouts.length === 0) return { closeouts_found: false, lines: [], fuels_for_cost: [], branch_label: branchLabel };

    const closeoutIds = closeouts.map(c => c.id);
    const settings = await getCompanySettings(companyId, branchId);

    // Fallback resolution for CUENTA_IVA_CREDITO if not set in accounting_settings
    if (!settings.CUENTA_IVA_CREDITO) {
        const [[ivaAcc]] = await pool.query(
            "SELECT id FROM chart_of_accounts WHERE company_id = ? AND (code LIKE '110206%' OR name LIKE '%IVA CREDITO FISCAL%' OR name LIKE '%IVA CRÉDITO FISCAL%') AND allows_entries = 1 LIMIT 1",
            [companyId]
        );
        if (ivaAcc) settings.CUENTA_IVA_CREDITO = ivaAcc.id;
    }

    // Smart branch-specific accounts override (matches branch accounts in chart_of_accounts)
    if (branch?.nombre) {
        const [branchAccs] = await pool.query("SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND active = 1 AND allows_entries = 1 AND (code LIKE '5101%' OR code LIKE '1104%' OR code LIKE '4101%')", [companyId]);
        const tokens = branch.nombre.toUpperCase().replace(/PUMA|ENERGY|GAS|ESTACION|DE|DEL|LA|EL|LOS|LAS/gi, ' ').trim().split(/\s+/).filter(t => t.length >= 3);
        const findAcc = (pfx, kws) => branchAccs.find(a => (!pfx || a.code.startsWith(pfx)) && tokens.some(t => a.name.toUpperCase().includes(t)) && (!kws || kws.some(k => a.name.toUpperCase().includes(k))))?.id;
        settings.CUENTA_COSTO_MERCADERIA = findAcc('5101', ['COMBUSTIBLE', 'VENTA', 'MERCADERIA']) || settings.CUENTA_COSTO_MERCADERIA;
        settings.CUENTA_INVENTARIO_COMBUSTIBLE = findAcc('1104', ['COMBUSTIBLE']) || settings.CUENTA_INVENTARIO_COMBUSTIBLE;
        settings.CUENTA_INVENTARIO_LUBRICANTE = findAcc('1104', ['LUBRICANTE']) || settings.CUENTA_INVENTARIO_LUBRICANTE;
        settings.CUENTA_VENTAS_COMBUSTIBLE = findAcc('4101', ['COMBUSTIBLE']) || settings.CUENTA_VENTAS_COMBUSTIBLE;
        settings.CUENTA_VENTAS_LUBRICANTES = findAcc('4101', ['LUBRICANTE']) || settings.CUENTA_VENTAS_LUBRICANTES;
    }

    // 1. Fuel readings
    const [readings] = await pool.query(
        `SELECT r.product_id, r.codigo_producto, r.descripcion_producto, p.tipo_combustible, p.nombre as prod_nombre, p.costo as prod_costo,
                SUM(r.diferencia) as total_galones, SUM(r.monto) as total_dinero, r.precio
         FROM gas_station_closeout_readings r
         LEFT JOIN products p ON p.id = r.product_id
         WHERE r.closeout_id IN (?)
         GROUP BY r.product_id, r.codigo_producto, r.descripcion_producto, p.tipo_combustible, p.nombre, p.costo, r.precio`,
        [closeoutIds]
    );

    const [trupputDespachos] = await pool.query('SELECT id, producto_codigo, producto_descripcion, galones, precio, monto FROM gas_station_closeout_trupput_despachos WHERE closeout_id IN (?)', [closeoutIds]);
    const [savedCosts] = await pool.query('SELECT product_id, costo_unitario FROM gas_station_closeout_costs WHERE company_id = ? AND branch_id = ? AND date = ?', [companyId, branchId, date]);
    const savedCostMap = new Map();
    savedCosts.forEach(sc => savedCostMap.set(sc.product_id, parseFloat(sc.costo_unitario) || 0));

    // Standard 4 fuels
    const fuelsMap = {
        diesel: { key: 'diesel', nombre: 'DIESEL', galones: 0, total_dinero: 0, costo_unitario: 0, product_ids: [] },
        regular: { key: 'regular', nombre: 'REGULAR', galones: 0, total_dinero: 0, costo_unitario: 0, product_ids: [] },
        super: { key: 'super', nombre: 'SUPER', galones: 0, total_dinero: 0, costo_unitario: 0, product_ids: [] },
        ion_diesel: { key: 'ion_diesel', nombre: 'ION DIESEL', galones: 0, total_dinero: 0, costo_unitario: 0, product_ids: [] }
    };

    readings.forEach(r => {
        const cat = categorizeFuel(r);
        const sf = fuelsMap[cat.key];
        if (sf) {
            sf.galones += parseFloat(r.total_galones) || 0;
            sf.total_dinero += parseFloat(r.total_dinero) || 0;
            if (r.product_id && !sf.product_ids.includes(r.product_id)) sf.product_ids.push(r.product_id);
            const c = savedCostMap.has(r.product_id) ? savedCostMap.get(r.product_id) : (parseFloat(r.prod_costo) || 0);
            if (c > 0 && sf.costo_unitario === 0) sf.costo_unitario = c;
        }
    });

    // Categorize Trupput dispatches (prepaid throughput does not count as station sale or inventory)
    const trupputMap = { diesel: { galones: 0, monto: 0 }, regular: { galones: 0, monto: 0 }, super: { galones: 0, monto: 0 }, ion_diesel: { galones: 0, monto: 0 } };
    let totalTrupputMonto = 0;
    trupputDespachos.forEach(td => {
        const cat = categorizeFuel(td, readings);
        const tf = trupputMap[cat.key];
        const g = parseFloat(td.galones) || 0;
        const m = parseFloat(td.monto) || 0;
        if (tf) { tf.galones += g; tf.monto += m; }
        totalTrupputMonto += m;
    });

    const fuelsForCost = Object.values(fuelsMap).map(f => {
        const galonesBomba = round4(f.galones);
        const galonesTrupput = round4(trupputMap[f.key]?.galones || 0);
        const galonesNetos = round4(Math.max(0, galonesBomba - galonesTrupput));
        const costo = round4(f.costo_unitario);
        return {
            key: f.key,
            nombre: f.nombre,
            galones_bomba: galonesBomba,
            galones_trupput: galonesTrupput,
            galones: galonesNetos,
            costo_unitario: costo,
            subtotal: round2(galonesNetos * costo),
            product_ids: f.product_ids
        };
    });

    // 2. Lubricants
    const [lubricants] = await pool.query(
        `SELECT l.producto_id, l.producto_codigo, l.producto_descripcion, SUM(l.ventas) as total_unidades, SUM(l.total) as total_dinero, COALESCE(p.costo, 0) as costo_unitario
         FROM gas_station_closeout_lubricant_readings l
         LEFT JOIN products p ON p.id = l.producto_id
         WHERE l.closeout_id IN (?)
         GROUP BY l.producto_id, l.producto_codigo, l.producto_descripcion, p.costo`,
        [closeoutIds]
    );

    let totalGalones = 0; let totalFuelDinero = 0; let totalFuelCosto = 0;
    fuelsForCost.forEach(f => {
        totalGalones += f.galones;
        totalFuelDinero += (fuelsMap[f.key]?.total_dinero || 0);
        totalFuelCosto += f.subtotal;
    });
    let totalLubDinero = 0; let totalLubCosto = 0;
    lubricants.forEach(l => {
        totalLubDinero += parseFloat(l.total_dinero) || 0;
        totalLubCosto += round2((parseFloat(l.total_unidades) || 0) * (parseFloat(l.costo_unitario) || 0));
    });
    // Deduct Trupput money from fuel sales since it is not a station sale
    totalFuelDinero = round2(Math.max(0, totalFuelDinero - totalTrupputMonto));
    totalLubDinero = round2(totalLubDinero);
    totalFuelCosto = round2(totalFuelCosto); totalLubCosto = round2(totalLubCosto);

    const fovial = round2(totalGalones * 0.30);
    const fuelGravado = round2((totalFuelDinero - fovial) / 1.13);
    const lubGravado = round2(totalLubDinero / 1.13);
    const totalIva = round2((totalFuelDinero - fovial - fuelGravado) + (totalLubDinero - lubGravado));
    const totalCostoMercaderia = round2(totalFuelCosto + totalLubCosto);

    // 3. Sub-table liquidations
    const [[remesas], [tarjetas], [creditos], [anticiposDesp], [anticiposRec], [cxcPayments]] = await Promise.all([
        pool.query(`SELECT tipo_operacion, SUM(monto) as total FROM gas_station_closeout_remesas WHERE closeout_id IN (?) GROUP BY tipo_operacion`, [closeoutIds]),
        pool.query(`SELECT t.pos_type_id, p.nombre as pos_name, SUM(t.monto) as total FROM gas_station_closeout_tarjetas t LEFT JOIN gas_station_pos_types p ON t.pos_type_id = p.id WHERE t.closeout_id IN (?) GROUP BY t.pos_type_id, p.nombre`, [closeoutIds]),
        pool.query(`SELECT c.cliente_id, c.cliente_nombre, SUM(c.monto) as total, cust.account_id FROM gas_station_closeout_creditos c LEFT JOIN customers cust ON cust.id = c.cliente_id WHERE c.closeout_id IN (?) GROUP BY c.cliente_id, c.cliente_nombre, cust.account_id`, [closeoutIds]),
        pool.query(`SELECT a.cliente_id, a.cliente_nombre, SUM(a.monto) as total, cust.account_id FROM gas_station_closeout_anticipos_despachados a LEFT JOIN customers cust ON cust.id = a.cliente_id WHERE a.closeout_id IN (?) GROUP BY a.cliente_id, a.cliente_nombre, cust.account_id`, [closeoutIds]),
        pool.query(`SELECT a.cliente_id, a.cliente_nombre, SUM(a.monto) as total, cust.account_id FROM gas_station_advances a LEFT JOIN customers cust ON cust.id = a.cliente_id WHERE a.company_id = ? AND a.branch_id = ? AND DATE(a.fecha) = ? GROUP BY a.cliente_id, a.cliente_nombre, cust.account_id`, [companyId, branchId, date]),
        pool.query(`SELECT cp.customer_id, c.nombre as customer_name, SUM(cp.monto) as total, c.account_id FROM customer_payments cp LEFT JOIN customers c ON c.id = cp.customer_id WHERE cp.company_id = ? AND cp.branch_id = ? AND DATE(cp.fecha_pago) = ? GROUP BY cp.customer_id, c.nombre, c.account_id`, [companyId, branchId, date])
    ]);
    const [rawExpenses] = await pool.query(
        `SELECT rubro, comentario, proveedor, tipo, MAX(provider_id) as provider_id, SUM(valor) as total FROM gas_station_closeout_expenses WHERE closeout_id IN (?) GROUP BY rubro, comentario, proveedor, tipo`,
        [closeoutIds]
    );
    const [provList] = await pool.query('SELECT id, nombre, account_id FROM providers WHERE company_id = ? AND account_id IS NOT NULL', [companyId]);
    const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const provMap = new Map();
    provList.forEach(p => { if (p.id) provMap.set(String(p.id), p.account_id); if (p.nombre) provMap.set(norm(p.nombre), p.account_id); });
    const expenses = rawExpenses.map(e => ({
        ...e,
        account_id: (e.provider_id && provMap.get(String(e.provider_id))) || (e.proveedor && provMap.get(norm(e.proveedor))) || settings.CUENTA_GASTOS || null
    }));
    const [[descuentos], [cupones], [cheques], [adelantos], [vales]] = await Promise.all([
        pool.query(`SELECT SUM(total) as total FROM gas_station_closeout_descuentos WHERE closeout_id IN (?)`, [closeoutIds]),
        pool.query(`SELECT distribuidora_nombre, SUM(monto) as total FROM gas_station_closeout_cupones WHERE closeout_id IN (?) GROUP BY distribuidora_nombre`, [closeoutIds]),
        pool.query(`SELECT SUM(monto) as total FROM gas_station_closeout_cheques WHERE closeout_id IN (?)`, [closeoutIds]),
        pool.query(`SELECT SUM(monto) as total FROM gas_station_closeout_adelantos WHERE closeout_id IN (?)`, [closeoutIds]),
        pool.query(`SELECT SUM(monto) as total FROM gas_station_closeout_vales WHERE closeout_id IN (?)`, [closeoutIds])
    ]);

    // 4. Accounts lookup
    const targetAccountIds = new Set();
    Object.values(settings).forEach(id => { if (id) targetAccountIds.add(id); });
    [...creditos, ...anticiposDesp, ...anticiposRec, ...cxcPayments, ...expenses].forEach(x => { if (x.account_id) targetAccountIds.add(x.account_id); });

    const accountDetails = await getAccountDetails(companyId, Array.from(targetAccountIds));

    const makeLine = (accId, description, debit = 0, credit = 0) => {
        const acc = accId ? accountDetails.get(accId) : null;
        return {
            account_id: acc ? acc.id : (accId || null),
            account_code: acc?.code || '',
            account_name: acc?.name || '',
            description: String(description || '').toUpperCase(),
            destination: branchLabel,
            debit: round2(debit),
            credit: round2(credit)
        };
    };

    const lines = [];

    // --- CARGOS (DEBIT) ---
    if (totalCostoMercaderia > 0) lines.push(makeLine(settings.CUENTA_COSTO_MERCADERIA, 'COSTO MERCADERIA', totalCostoMercaderia, 0));

    let efectivoPista = 0; let efectivoClientes = 0;
    remesas.forEach(r => {
        if (r.tipo_operacion === 'recuperacion_credito') efectivoClientes += parseFloat(r.total) || 0;
        else efectivoPista += parseFloat(r.total) || 0;
    });

    // Customer advances received and CxC payments add to CAJA GENERAL (CLIENTES) on debit side
    const totalAnticiposRec = anticiposRec.reduce((sum, a) => sum + (parseFloat(a.total) || 0), 0);
    const totalCxcPayments = cxcPayments.reduce((sum, cp) => sum + (parseFloat(cp.total) || 0), 0);
    efectivoClientes += totalAnticiposRec + totalCxcPayments;

    if (efectivoPista > 0) lines.push(makeLine(settings.CUENTA_CAJA, 'CAJA GENERAL (PISTA)', efectivoPista, 0));
    if (efectivoClientes > 0) lines.push(makeLine(settings.CUENTA_CAJA, 'CAJA GENERAL (CLIENTES)', efectivoClientes, 0));

    tarjetas.forEach(t => {
        const amt = round2(t.total);
        if (amt <= 0) return;
        const name = (t.pos_name || 'POS').toUpperCase();
        const clean = name.replace(/[^A-Z0-9]/g, '');
        const under = name.trim().replace(/[^A-Z0-9]+/g, '_');
        let accId = settings['CUENTA_TARJETAS_' + under] || settings['CUENTA_TARJETAS_' + clean];
        if (!accId) {
            for (const [re, keys] of [
                [/CREDOMATIC|BAC/, ['CUENTA_TARJETAS_CREDOMATIC', 'CUENTA_TARJETAS_BAC', 'CUENTA_TARJETAS_POS_BAC']],
                [/VERSATEC/, ['CUENTA_TARJETAS_VERSATEC', 'CUENTA_TARJETAS_VERSATEC_FLEET']],
                [/PRIS/, ['CUENTA_TARJETAS_PRISS', 'CUENTA_TARJETAS_PRIS', 'CUENTA_TARJETAS_PUMA_PRIS']],
                [/FLOTA/, ['CUENTA_TARJETAS_FLOTA', 'CUENTA_TARJETAS_PUMA_FLOTA']],
                [/DAVIVIENDA|SERFINSA/, ['CUENTA_TARJETAS_DAVIVIENDA', 'CUENTA_TARJETAS_SERFINSA', 'CUENTA_TARJETAS_POS_DAVIVIENDA']],
                [/PROMERICA/, ['CUENTA_TARJETAS_PROMERICA', 'CUENTA_TARJETAS_POS_PROMERICA']],
                [/AGRICOLA/, ['CUENTA_TARJETAS_AGRICOLA', 'CUENTA_TARJETAS_POS_AGRICOLA']],
                [/CUSCATLAN/, ['CUENTA_TARJETAS_CUSCATLAN', 'CUENTA_TARJETAS_POS_CUSCATLAN']],
                [/HIPOTECARIO/, ['CUENTA_TARJETAS_HIPOTECARIO', 'CUENTA_TARJETAS_POS_HIPOTECARIO']],
                [/SHELL|GO\+/, ['CUENTA_TARJETAS_SHELL_GO', 'CUENTA_TARJETAS_SHELL']],
                [/TRANSFERENCIA/, ['CUENTA_TARJETAS_TRANSFERENCIA_BANCARIA', 'CUENTA_TARJETAS_TRANSFERENCIA']],
                [/NECTAR/, ['CUENTA_TARJETAS_NECTAR']]
            ]) {
                if (re.test(name)) {
                    for (const k of keys) { if (settings[k]) { accId = settings[k]; break; } }
                    if (!accId) {
                        const mk = Object.keys(settings).find(k => k.startsWith('CUENTA_TARJETAS_') && re.test(k) && settings[k]);
                        if (mk) accId = settings[mk];
                    }
                }
                if (accId) break;
            }
        }
        lines.push(makeLine(accId || settings.CUENTA_BANCOS || null, `(TARJETAS CREDITO) ${name}`, amt, 0));
    });

    creditos.forEach(c => {
        const amt = round2(c.total);
        if (amt > 0) lines.push(makeLine(c.account_id || settings.CUENTA_CLIENTES_CXC, `(CREDITO) ${c.cliente_nombre}`, amt, 0));
    });

    anticiposDesp.forEach(a => {
        const amt = round2(a.total);
        if (amt > 0) lines.push(makeLine(a.account_id, `(ANTICIPO DESPACHADO) ${a.cliente_nombre}`, amt, 0));
    });

    let totalIvaCredito = 0;
    expenses.forEach(e => {
        const amt = round2(e.total);
        if (amt <= 0) return;
        const desc = e.proveedor ? `(GASTOS) ${e.proveedor}` : (e.rubro || e.comentario ? `(GASTOS) ${e.rubro || e.comentario}` : `(GASTOS) ${branchLabel}`);
        const isCcf = String(e.tipo).toLowerCase() === 'ccf';
        const neto = isCcf ? round2(amt / 1.13) : amt;
        if (isCcf) totalIvaCredito += round2(amt - neto);
        lines.push(makeLine(e.account_id || null, desc, neto, 0));
    });
    if (totalIvaCredito > 0) lines.push(makeLine(settings.CUENTA_IVA_CREDITO, 'IVA CREDITO FISCAL', totalIvaCredito, 0));

    cupones.forEach(cp => {
        const amt = round2(cp.total);
        if (amt > 0) lines.push(makeLine(settings.CUENTA_CUPONES, `CUPONES ${cp.distribuidora_nombre ? '(' + cp.distribuidora_nombre + ')' : ''}`.trim(), amt, 0));
    });
    const addPositiveLine = (accId, label, deb, crd) => { if (deb > 0 || crd > 0) lines.push(makeLine(accId, label, deb, crd)); };
    addPositiveLine(settings.CUENTA_CHEQUES || settings.CUENTA_CAJA, 'CHEQUES', round2(cheques[0]?.total || 0), 0);
    addPositiveLine(settings.CUENTA_ADELANTOS, 'ADELANTOS', round2(adelantos[0]?.total || 0), 0);
    addPositiveLine(settings.CUENTA_VALES, 'VALES', round2(vales[0]?.total || 0), 0);
    addPositiveLine(settings.CUENTA_SOBRANTES_FALTANTES, 'DESCUENTOS', round2(descuentos[0]?.total || 0), 0);

    // --- ABONOS (CREDIT) ---
    addPositiveLine(settings.CUENTA_VENTAS_COMBUSTIBLE, 'VENTA COMBUSTIBLES', 0, fuelGravado);
    addPositiveLine(settings.CUENTA_VENTAS_LUBRICANTES, 'VENTA LUBRICANTES', 0, lubGravado);
    addPositiveLine(settings.CUENTA_IVA_DEBITO, 'IVA DEBITO FISCAL', 0, totalIva);
    addPositiveLine(settings.CUENTA_FOVIAL_POR_PAGAR, 'FONDO FOVIAL', 0, fovial);
    addPositiveLine(settings.CUENTA_INVENTARIO_COMBUSTIBLE, 'INVENTARIO COMBUSTIBLES', 0, totalFuelCosto);
    addPositiveLine(settings.CUENTA_INVENTARIO_LUBRICANTE, 'INVENTARIO LUBRICANTES', 0, totalLubCosto);
    anticiposRec.forEach(ar => addPositiveLine(ar.account_id, `(ANTICIPO RECIBIDO) ${ar.cliente_nombre}`, 0, round2(ar.total)));
    cxcPayments.forEach(cp => addPositiveLine(cp.account_id || settings.CUENTA_CLIENTES_CXC, `(ABONO CXC) ${cp.customer_name}`, 0, round2(cp.total)));

    // 5. Balance check for faltante / sobrante (matches shift closeouts)
    let sumDebit = 0; let sumCredit = 0;
    lines.forEach(l => { sumDebit += l.debit; sumCredit += l.credit; });
    const diff = round2(sumCredit - sumDebit);

    if (diff > 0.005) {
        // Debits < credits -> Faltante (Cargo)
        lines.push(makeLine(settings.CUENTA_SOBRANTES_FALTANTES, 'FALTANTE CORTE DIARIO', diff, 0));
    } else if (diff < -0.005) {
        // Debits > credits -> Sobrante (Abono)
        lines.push(makeLine(settings.CUENTA_SOBRANTES_FALTANTES, 'SOBRANTES CORTE DIARIO', 0, Math.abs(diff)));
    }

    return {
        closeouts_found: true,
        closeouts_count: closeouts.length,
        branch_id: branchId,
        branch_label: branchLabel,
        date,
        lines,
        fuels_for_cost: fuelsForCost,
        trupput: {
            has_trupput: totalTrupputMonto > 0,
            total_monto: round2(totalTrupputMonto),
            total_galones: round4(Object.values(trupputMap).reduce((s, t) => s + t.galones, 0)),
            despachos: trupputDespachos
        }
    };
}

module.exports = { buildCloseoutsPreview };
