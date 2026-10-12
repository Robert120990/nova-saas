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

async function getCloseoutCostsData(companyId, branchId, date) {
    const [[branch]] = await pool.query(
        'SELECT id, nombre, codigo FROM branches WHERE id = ? AND company_id = ?',
        [branchId, companyId]
    );
    const branchLabel = branch ? `${branch.codigo ? branch.codigo + ' - ' : ''}${branch.nombre}`.toUpperCase() : 'SUCURSAL';
    const branchName = branch ? branch.nombre.toUpperCase() : '';

    const [closeouts] = await pool.query(
        'SELECT id, numero_turno, estado, seller_name FROM gas_station_closeouts WHERE company_id = ? AND branch_id = ? AND fecha_turno = ?',
        [companyId, branchId, date]
    );

    if (closeouts.length === 0) {
        return {
            closeouts_found: false,
            branch_label: branchLabel,
            date,
            fuels: [],
            lubricants: [],
            accounting_lines: [],
            accounting_totals: { total_debe: 0, total_haber: 0, balanced: true },
            existing_entry: null,
            totals: { fuel_gallons: 0, fuel_cost: 0, lub_units: 0, lub_cost: 0, grand_total_cost: 0 }
        };
    }

    const closeoutIds = closeouts.map(c => c.id);

    // Fuel readings and saved costs
    const [readings] = await pool.query(
        `SELECT r.product_id, r.codigo_producto, r.descripcion_producto, p.tipo_combustible, p.nombre as prod_nombre, p.costo as prod_costo,
                SUM(r.diferencia) as total_galones, SUM(r.monto) as total_dinero, r.precio
         FROM gas_station_closeout_readings r
         LEFT JOIN products p ON p.id = r.product_id
         WHERE r.closeout_id IN (?)
         GROUP BY r.product_id, r.codigo_producto, r.descripcion_producto, p.tipo_combustible, p.nombre, p.costo, r.precio`,
        [closeoutIds]
    );

    const [trupputDespachos] = await pool.query(
        `SELECT td.id, td.cliente_nombre, td.documento, td.producto_codigo, td.producto_descripcion, td.galones, td.precio, td.monto
         FROM gas_station_closeout_trupput_despachos td
         WHERE td.closeout_id IN (?)
         ORDER BY td.id ASC`,
        [closeoutIds]
    );

    const [savedCosts] = await pool.query(
        'SELECT product_id, costo_unitario FROM gas_station_closeout_costs WHERE company_id = ? AND branch_id = ? AND date = ?',
        [companyId, branchId, date]
    );
    const savedCostMap = new Map();
    savedCosts.forEach(sc => savedCostMap.set(sc.product_id, parseFloat(sc.costo_unitario) || 0));

    const fuelsMap = {
        diesel: { key: 'diesel', nombre: 'DIESEL', galones: 0, total_dinero: 0, costo_unitario: 0 },
        regular: { key: 'regular', nombre: 'REGULAR', galones: 0, total_dinero: 0, costo_unitario: 0 },
        super: { key: 'super', nombre: 'SUPER', galones: 0, total_dinero: 0, costo_unitario: 0 },
        ion_diesel: { key: 'ion_diesel', nombre: 'ION DIESEL', galones: 0, total_dinero: 0, costo_unitario: 0 }
    };

    readings.forEach(r => {
        const cat = categorizeFuel(r);
        const sf = fuelsMap[cat.key];
        if (sf) {
            sf.galones += parseFloat(r.total_galones) || 0;
            sf.total_dinero += parseFloat(r.total_dinero) || 0;
            const c = savedCostMap.has(r.product_id) ? savedCostMap.get(r.product_id) : (parseFloat(r.prod_costo) || 0);
            if (c > 0 && sf.costo_unitario === 0) sf.costo_unitario = c;
        }
    });

    const trupputMap = { diesel: { galones: 0, monto: 0 }, regular: { galones: 0, monto: 0 }, super: { galones: 0, monto: 0 }, ion_diesel: { galones: 0, monto: 0 } };
    let totalTrupputGalones = 0;
    let totalTrupputMonto = 0;
    trupputDespachos.forEach(td => {
        const cat = categorizeFuel(td, readings);
        const tf = trupputMap[cat.key];
        const g = parseFloat(td.galones) || 0;
        const m = parseFloat(td.monto) || 0;
        if (tf) { tf.galones += g; tf.monto += m; }
        totalTrupputGalones += g;
        totalTrupputMonto += m;
    });

    let totalFuelGallonsBomba = 0;
    let totalFuelGallonsTrupput = 0;
    let totalFuelGallons = 0;
    let totalFuelCost = 0;
    const fuels = Object.values(fuelsMap).map((f, idx) => {
        const galonesBomba = round4(f.galones);
        const galonesTrupput = round4(trupputMap[f.key]?.galones || 0);
        const galonesNetos = round4(Math.max(0, galonesBomba - galonesTrupput));
        const costo = round4(f.costo_unitario);
        const subtotal = round2(galonesNetos * costo);
        totalFuelGallonsBomba += galonesBomba;
        totalFuelGallonsTrupput += galonesTrupput;
        totalFuelGallons += galonesNetos;
        totalFuelCost += subtotal;
        return {
            index: idx + 1,
            key: f.key,
            nombre: f.nombre,
            galones_bomba: galonesBomba,
            galones_trupput: galonesTrupput,
            galones: galonesNetos,
            costo_unitario: costo,
            subtotal
        };
    });

    // Lubricants sold
    const [rawLubricants] = await pool.query(
        `SELECT l.producto_id, l.producto_codigo, l.producto_descripcion, SUM(l.ventas) as total_unidades, SUM(l.total) as total_dinero, COALESCE(p.costo, 0) as costo_unitario
         FROM gas_station_closeout_lubricant_readings l
         LEFT JOIN products p ON p.id = l.producto_id
         WHERE l.closeout_id IN (?)
         GROUP BY l.producto_id, l.producto_codigo, l.producto_descripcion, p.costo`,
        [closeoutIds]
    );

    let totalLubUnits = 0;
    let totalLubCost = 0;
    const soldLubricants = rawLubricants
        .filter(l => (parseFloat(l.total_unidades) || 0) > 0)
        .map((l, idx) => {
            const units = parseFloat(l.total_unidades) || 0;
            const costo = round4(parseFloat(l.costo_unitario) || 0);
            const subtotal = round2(units * costo);
            totalLubUnits += units;
            totalLubCost += subtotal;
            return {
                index: idx + 1,
                product_id: l.producto_id,
                codigo: l.producto_codigo || 'N/A',
                descripcion: (l.producto_descripcion || 'LUBRICANTE').toUpperCase(),
                unidades: units,
                costo_unitario: costo,
                subtotal
            };
        });

    totalFuelGallons = round4(totalFuelGallons);
    totalFuelCost = round2(totalFuelCost);
    totalLubCost = round2(totalLubCost);
    const grandTotalCost = round2(totalFuelCost + totalLubCost);

    // Resolve Accounting Accounts for Cost and Inventory
    const [[existingEntry]] = await pool.query(
        `SELECT id, number, date, description, status FROM accounting_entries 
         WHERE company_id = ? AND branch_id = ? AND date = ? AND status <> 'voided' 
           AND (description LIKE '%CIERRE DE TURNO%' OR description LIKE '%CIERRE%')
         ORDER BY id DESC LIMIT 1`,
        [companyId, branchId, date]
    );

    let costAcc = null;
    let invFuelAcc = null;
    let invLubAcc = null;

    if (existingEntry) {
        const [lines] = await pool.query(
            `SELECT l.id, l.account_id, l.description, l.debit, l.credit, a.code as account_code, a.name as account_name
             FROM accounting_entry_lines l
             JOIN chart_of_accounts a ON a.id = l.account_id
             WHERE l.entry_id = ?
             ORDER BY l.id`,
            [existingEntry.id]
        );

        const costLine = lines.find(l => 
            (l.description && l.description.toUpperCase().includes('COSTO MERCADERIA')) ||
            (l.account_code && l.account_code.startsWith('5101'))
        );
        const invFuelLine = lines.find(l =>
            (l.description && l.description.toUpperCase().includes('INVENTARIO COMBUSTIBLE')) ||
            (l.account_name && l.account_name.toUpperCase().includes('COMBUSTIBLE') && l.account_code.startsWith('1104'))
        );
        const invLubLine = lines.find(l =>
            (l.description && l.description.toUpperCase().includes('INVENTARIO LUBRICANTE')) ||
            (l.account_name && l.account_name.toUpperCase().includes('LUBRICANTE') && l.account_code.startsWith('1104'))
        );

        if (costLine) {
            costAcc = {
                id: costLine.account_id,
                code: costLine.account_code,
                name: costLine.account_name,
                debit: parseFloat(costLine.debit) || grandTotalCost
            };
        }
        if (invFuelLine) {
            invFuelAcc = {
                id: invFuelLine.account_id,
                code: invFuelLine.account_code,
                name: invFuelLine.account_name,
                credit: parseFloat(invFuelLine.credit) || totalFuelCost
            };
        }
        if (invLubLine) {
            invLubAcc = {
                id: invLubLine.account_id,
                code: invLubLine.account_code,
                name: invLubLine.account_name,
                credit: parseFloat(invLubLine.credit) || totalLubCost
            };
        }
    }

    if (!costAcc || !invFuelAcc || !invLubAcc) {
        const [settingsRows] = await pool.query(
            "SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ? AND branch_id IN (0, ?) AND setting_key IN ('CUENTA_COSTO_MERCADERIA', 'CUENTA_INVENTARIO_COMBUSTIBLE', 'CUENTA_INVENTARIO_LUBRICANTE') ORDER BY branch_id ASC",
            [companyId, Number(branchId) || 0]
        );
        const settings = {};
        settingsRows.forEach(r => { settings[r.setting_key] = parseInt(r.setting_value, 10); });

        const [allAccounts] = await pool.query(
            "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND active = 1 AND (code LIKE '5101%' OR code LIKE '1104%')",
            [companyId]
        );

        const rawTokens = branchName.replace(/PUMA|ENERGY|GAS|ESTACION|DE|DEL|LA|EL|LOS|LAS/gi, ' ').trim().split(/\s+/).filter(t => t.length >= 3);
        const findAccount = (fallbackId, codePrefix, keywords = []) => {
            const match = allAccounts.find(a => (!codePrefix || a.code.startsWith(codePrefix)) && rawTokens.some(t => a.name.toUpperCase().includes(t)) && (!keywords.length || keywords.some(k => a.name.toUpperCase().includes(k))));
            if (match) return match;
            return (fallbackId && allAccounts.find(a => a.id === fallbackId)) || allAccounts.find(a => a.code.startsWith(codePrefix)) || null;
        };

        if (!costAcc) {
            const found = findAccount(settings.CUENTA_COSTO_MERCADERIA, '5101', ['COMBUSTIBLE', 'VENTA', 'MERCADERIA']);
            costAcc = found ? { id: found.id, code: found.code, name: found.name, debit: grandTotalCost } : null;
        }
        if (!invFuelAcc) {
            const found = findAccount(settings.CUENTA_INVENTARIO_COMBUSTIBLE, '1104', ['COMBUSTIBLE']);
            invFuelAcc = found ? { id: found.id, code: found.code, name: found.name, credit: totalFuelCost } : null;
        }
        if (!invLubAcc) {
            const found = findAccount(settings.CUENTA_INVENTARIO_LUBRICANTE, '1104', ['LUBRICANTE']);
            invLubAcc = found ? { id: found.id, code: found.code, name: found.name, credit: totalLubCost } : null;
        }
    }

    const accountingLines = [];
    if (costAcc) accountingLines.push({ index: 1, account_id: costAcc.id, codigo: costAcc.code, cuenta: costAcc.name, concepto: 'COSTO MERCADERÍA (COMBUSTIBLES Y LUBRICANTES)', tipo_movimiento: 'CARGO', debe: costAcc.debit != null ? costAcc.debit : grandTotalCost, haber: 0 });
    if (invFuelAcc && totalFuelCost > 0) accountingLines.push({ index: 2, account_id: invFuelAcc.id, codigo: invFuelAcc.code, cuenta: invFuelAcc.name, concepto: 'DESCARGO INVENTARIO COMBUSTIBLES', tipo_movimiento: 'ABONO', debe: 0, haber: invFuelAcc.credit != null ? invFuelAcc.credit : totalFuelCost });
    if (invLubAcc && totalLubCost > 0) accountingLines.push({ index: accountingLines.length + 1, account_id: invLubAcc.id, codigo: invLubAcc.code, cuenta: invLubAcc.name, concepto: 'DESCARGO INVENTARIO LUBRICANTES', tipo_movimiento: 'ABONO', debe: 0, haber: invLubAcc.credit != null ? invLubAcc.credit : totalLubCost });

    const totalDebe = round2(accountingLines.reduce((s, l) => s + (l.debe || 0), 0));
    const totalHaber = round2(accountingLines.reduce((s, l) => s + (l.haber || 0), 0));

    return {
        closeouts_found: true,
        closeouts_count: closeouts.length,
        branch_label: branchLabel,
        date,
        fuels,
        lubricants: soldLubricants,
        accounting_lines: accountingLines,
        accounting_totals: {
            total_debe: totalDebe,
            total_haber: totalHaber,
            balanced: totalDebe === totalHaber
        },
        existing_entry: existingEntry ? {
            id: existingEntry.id,
            number: existingEntry.number,
            date: existingEntry.date,
            description: existingEntry.description
        } : null,
        totals: {
            fuel_gallons_bomba: round4(totalFuelGallonsBomba),
            fuel_gallons_trupput: round4(totalFuelGallonsTrupput),
            fuel_gallons: totalFuelGallons,
            fuel_cost: totalFuelCost,
            lub_units: totalLubUnits,
            lub_cost: totalLubCost,
            grand_total_cost: grandTotalCost,
            has_trupput: totalFuelGallonsTrupput > 0,
            total_trupput_monto: round2(totalTrupputMonto),
            trupput_despachos: trupputDespachos.map(td => ({
                id: td.id,
                cliente_nombre: td.cliente_nombre,
                documento: td.documento,
                combustible: categorizeFuel(td, readings).label,
                galones: round4(td.galones),
                precio: round2(td.precio),
                monto: round2(td.monto)
            }))
        }
    };
}

module.exports = {
    getCloseoutCostsData
};
