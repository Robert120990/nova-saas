export function buildCloseoutPrintHtml(data) {
    const c = data.closeout;
    const readings = data.readings || [];
    const tankReadings = data.tankReadings || [];
    const despachadores = data.despachadores || [];
    const gastos = data.gastos || [];
    const remesas = data.remesas || [];
    const cupones = data.cupones || [];
    const descuentos = data.descuentos || [];
    const adelantos = data.adelantos || [];
    const lubricantes = data.lubricantes || [];
    const tarjetas = data.tarjetas || [];
    const creditos = data.creditos || [];
    const vales = data.vales || [];
    const anticiposDesp = data.anticiposDesp || [];
    const despachadorNozzleAssignments = data.despachadorNozzleAssignments || [];
    const shiftReadings = data.shiftReadings || readings;

    const despachadorVentas = {};
    const despachadorNoPercibido = {};
    const despachadorEntregado = {};

    // Group shift readings and despachadores by shift/closeout_id
    const shiftDespachadores = {};
    despachadores.forEach((d, idx) => {
        const cid = d.closeout_id || 'single';
        if (!shiftDespachadores[cid]) shiftDespachadores[cid] = [];
        shiftDespachadores[cid].push({ ...d, originalIdx: idx });
    });

    const shiftReadingsMap = {};
    shiftReadings.forEach(r => {
        const cid = r.closeout_id || 'single';
        if (!shiftReadingsMap[cid]) shiftReadingsMap[cid] = [];
        shiftReadingsMap[cid].push(r);
    });

    for (let idx = 0; idx < despachadores.length; idx++) {
        const d = despachadores[idx];
        const rowKey = `${d.closeout_id || ''}_${d.despachador_id}_${idx}`;
        const did = d.despachador_id;
        const cid = d.closeout_id;
        
        // 1. Calculate No Percibido (gastos, tarjetas, creditos, vales, etc.)
        const matchShiftAndDesp = (item) => {
            const matchDesp = parseInt(item.despachador_id) === did;
            if (!matchDesp) return false;
            if (cid && item.closeout_id) return item.closeout_id === cid;
            return true;
        };

        const noPercibidoSum =
            gastos.filter(matchShiftAndDesp).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0) +
            cupones.filter(matchShiftAndDesp).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) +
            descuentos.filter(matchShiftAndDesp).reduce((s, dd) => s + (parseFloat(dd.total) || 0), 0) +
            adelantos.filter(matchShiftAndDesp).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0) +
            tarjetas.filter(matchShiftAndDesp).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0) +
            creditos.filter(matchShiftAndDesp).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) +
            vales.filter(matchShiftAndDesp).reduce((s, v) => s + (parseFloat(v.monto) || 0), 0) +
            anticiposDesp.filter(matchShiftAndDesp).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
        despachadorNoPercibido[rowKey] = Number(d.total_no_percibido || 0) > 0 ? Number(d.total_no_percibido) : noPercibidoSum;

        // 2. Calculate Entregado (remesas)
        const entregadoSum = remesas.filter(matchShiftAndDesp).reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
        despachadorEntregado[rowKey] = Number(d.total_entregado || 0) > 0 ? Number(d.total_entregado) : entregadoSum;
    }

    // 3. Calculate Venta per shift and allocate proportionally to active despachadores
    Object.entries(shiftDespachadores).forEach(([cidKey, shiftDesps]) => {
        const cid = cidKey === 'single' ? null : Number(cidKey);
        const shiftReadingsList = shiftReadingsMap[cidKey] || readings;
        const totalFuelShift = shiftReadingsList.reduce((s, r) => {
            const diff = (parseFloat(r.lectura_actual) || 0) - (parseFloat(r.lectura_anterior) || 0) - (parseFloat(r.calibracion) || 0);
            return s + (diff * (parseFloat(r.precio) || 0));
        }, 0);

        const totalLubeShift = lubricantes
            .filter(l => !cid || !l.closeout_id || l.closeout_id === cid)
            .reduce((s, l) => s + (parseFloat(l.total) || 0), 0);

        const totalShiftSales = totalFuelShift + totalLubeShift;

        // Determine nozzle fuel and liquidations for each despachador in this shift
        const despsWithInfo = shiftDesps.map(d => {
            const rowKey = `${d.closeout_id || ''}_${d.despachador_id}_${d.originalIdx}`;
            const did = d.despachador_id;
            const assignedNozzles = despachadorNozzleAssignments
                .filter(a => parseInt(a.despachador_id) === did && (!cid || !a.closeout_id || a.closeout_id === cid))
                .map(a => a.nozzle_id);

            let nozzleFuel = 0;
            if (assignedNozzles.length > 0) {
                for (const r of shiftReadingsList) {
                    if (assignedNozzles.includes(r.nozzle_id)) {
                        nozzleFuel += ((parseFloat(r.lectura_actual) || 0) - (parseFloat(r.lectura_anterior) || 0) - (parseFloat(r.calibracion) || 0)) * (parseFloat(r.precio) || 0);
                    }
                }
            }

            const liq = (despachadorNoPercibido[rowKey] || 0) + (despachadorEntregado[rowKey] || 0);
            return {
                d,
                rowKey,
                assignedNozzles,
                nozzleFuel,
                liq
            };
        });

        // Identify active despachadores in this shift (have nozzles assigned or turned in funds)
        const activeDesps = despsWithInfo.filter(item =>
            Number(item.d.total_venta || 0) > 0 || item.assignedNozzles.length > 0 || item.liq > 0
        );

        const anyHasNozzles = activeDesps.some(item => item.assignedNozzles.length > 0);
        const sumAssignedFuel = activeDesps.reduce((s, item) => s + item.nozzleFuel, 0);
        const unassignedFuel = Math.max(0, totalFuelShift - sumAssignedFuel);
        const totalActiveLiq = activeDesps.reduce((s, item) => s + item.liq, 0);
        const activeCount = activeDesps.length;

        despsWithInfo.forEach(item => {
            if (Number(item.d.total_venta || 0) > 0) {
                despachadorVentas[item.rowKey] = Number(item.d.total_venta);
            } else if (!activeDesps.includes(item)) {
                // Inactive despachador in this shift: no nozzles assigned and $0 liquidated
                despachadorVentas[item.rowKey] = 0;
            } else if (anyHasNozzles) {
                let v = item.nozzleFuel;
                // Distribute any unassigned fuel or lubricant among active despachadores
                const weight = totalActiveLiq > 0 ? (item.liq / totalActiveLiq) : (1 / activeCount);
                if (unassignedFuel > 0.001) {
                    v += unassignedFuel * weight;
                }
                if (totalLubeShift > 0.001) {
                    v += totalLubeShift * weight;
                }
                despachadorVentas[item.rowKey] = v;
            } else {
                // No individual nozzle assignments in this shift: partition total shift sales
                const weight = totalActiveLiq > 0 ? (item.liq / totalActiveLiq) : (1 / activeCount);
                despachadorVentas[item.rowKey] = totalShiftSales * weight;
            }
        });
    });

    const gastosTotal = gastos.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0);
    const remesasTotal = remesas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    const cuponesTotal = cupones.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
    const descuentosTotal = descuentos.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
    const adelantosTotal = adelantos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
    const tarjetasTotal = tarjetas.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
    const creditosTotal = creditos.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
    const valesTotal = vales.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0);
    const anticiposDespTotal = anticiposDesp.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
    const lubricantTotal = lubricantes.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

    const totalMonto = readings.reduce((s, r) => s + ((r.lectura_actual - r.lectura_anterior - r.calibracion) * r.precio), 0);
    const totalLectura = readings.reduce((s, r) => s + (r.lectura_actual - r.lectura_anterior - r.calibracion), 0);

    const egresosTotal = gastosTotal + remesasTotal + cuponesTotal + descuentosTotal + adelantosTotal + tarjetasTotal + creditosTotal + valesTotal + anticiposDespTotal;
    const ingresosTotal = totalMonto + lubricantTotal;
    const diferenciaTotal = egresosTotal - ingresosTotal;

    const summaryMap = {};
    readings.forEach(r => {
        const key = r.codigo_producto;
        if (!summaryMap[key]) {
            summaryMap[key] = { codigo_producto: r.codigo_producto, descripcion_producto: r.descripcion_producto, precio: r.precio, total_lectura: 0, total_monto: 0 };
        }
        const diff = r.lectura_actual - r.lectura_anterior - r.calibracion;
        summaryMap[key].total_lectura += diff;
        summaryMap[key].total_monto += diff * r.precio;
    });
    const summaryByProduct = Object.values(summaryMap);

    const estadoLabel = c.estado === 'cerrado' ? 'CERRADO' : 'ABIERTO';
    const estadoColor = c.estado === 'cerrado' ? '#059669' : '#d97706';

    const fecha = c.fecha_turno ? new Date(c.fecha_turno).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const isAccumulated = !c.numero_turno || String(c.numero_turno).toUpperCase() === 'ACUMULADO';
    const reportTitle = isAccumulated ? 'REPORTE DE CIERRE ACUMULADO DIARIO' : 'REPORTE DE CIERRE DE LECTURAS';
    const periodText = isAccumulated ? `FECHA: ${fecha}` : `FECHA: ${fecha}    |    TURNO #${c.numero_turno}`;

    const now = new Date();
    const printDateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const printTimeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const fmtMoney = (val) => {
        const n = parseFloat(val) || 0;
        return '$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fmtQty = (val, dec = 5) => {
        const n = parseFloat(val) || 0;
        return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };

    // Group readings by island
    const islandGroups = [];
    const islandMap = {};

    readings.forEach(r => {
        const islandKey = r.island_id ? String(r.island_id) : (r.island_codigo || 'SIN_ISLA');
        if (!islandMap[islandKey]) {
            const islandObj = {
                id: r.island_id,
                codigo: r.island_codigo || '',
                descripcion: r.island_descripcion || (r.island_codigo ? `ISLA ${r.island_codigo}` : 'ISLA GENERAL'),
                readings: [],
                subtotalLectura: 0,
                subtotalMonto: 0
            };
            islandMap[islandKey] = islandObj;
            islandGroups.push(islandObj);
        }
        const diff = (parseFloat(r.lectura_actual) || 0) - (parseFloat(r.lectura_anterior) || 0) - (parseFloat(r.calibracion) || 0);
        const monto = diff * (parseFloat(r.precio) || 0);
        islandMap[islandKey].readings.push({ ...r, diff, monto });
        islandMap[islandKey].subtotalLectura += diff;
        islandMap[islandKey].subtotalMonto += monto;
    });

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escHtml(reportTitle)} - ${escHtml(fecha)}</title>
<style>
    @page { margin: 4mm 6mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #0f172a; font-size: 9px; line-height: 1.18; }
    
    /* Institutional Header */
    .inst-header { position: relative; text-align: center; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 0.75px solid #cbd5e1; }
    .inst-timestamp { position: absolute; left: 0; top: 0; font-size: 7px; color: #64748b; font-family: monospace; }
    .inst-status { position: absolute; right: 0; top: 0; }
    .inst-company { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; color: #0f172a; margin: 0 0 1px; }
    .inst-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2px; color: #1e293b; margin: 0 0 1px; }
    .inst-tax { font-size: 7.5px; color: #475569; margin-bottom: 1px; }
    .inst-period { font-size: 8px; font-weight: 700; color: #1e293b; margin-bottom: 1px; }
    .inst-currency { font-size: 7px; color: #64748b; letter-spacing: 0.2px; }

    .badge { display: inline-block; padding: 1px 5px; border-radius: 4px; font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
    
    .section { margin-bottom: 5px; break-inside: avoid; }
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 5px; background: #f1f5f9; border-left: 3px solid #64748b; margin-bottom: 2px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 8.5px; table-layout: fixed; }
    th { background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1.5px solid #cbd5e1; padding: 2.5px 5px; text-align: left; font-size: 7.5px; font-weight: 700; text-transform: uppercase; color: #475569; white-space: nowrap; }
    th.right { text-align: right !important; }
    td { padding: 2px 5px; border-bottom: 1px solid #f1f5f9; font-size: 8.5px; white-space: nowrap; }
    td.right { text-align: right !important; }
    td.mono { font-family: 'Courier New', monospace; font-size: 8.5px; }
    
    .island-row td { background: #f8fafc; font-weight: 700; color: #1e293b; font-size: 8px; text-transform: uppercase; padding: 2.5px 5px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
    .island-subtotal td { background: #fafafa; font-weight: 700; color: #334155; font-size: 8px; border-top: 1px dashed #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 2.5px 5px; }

    tfoot td { background: #f8fafc; border-top: 1.5px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 2.5px 5px; font-size: 8.5px; font-weight: 700; }
    tfoot td.right { text-align: right !important; }
    
    .flex-row { display: flex; gap: 6px; }
    .flex-1 { flex: 1; min-width: 0; }
    
    @media print {
        .no-print { display: none; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style></head><body>
    <div class="inst-header">
        <div class="inst-timestamp">${printDateStr} ${printTimeStr}</div>
        <div class="inst-status">
            <span class="badge" style="background:${estadoColor}15;color:${estadoColor};border:1px solid ${estadoColor}40;">${estadoLabel}</span>
        </div>
        <div class="inst-company">${escHtml(c.company_name || 'ESTACION DE SERVICIO')}</div>
        <div class="inst-title">${escHtml(reportTitle)}</div>
        <div class="inst-tax">
            NUMERO DE REGISTRO DE I.V.A.: ${escHtml(c.company_nrc || 'N/A')} &nbsp;|&nbsp; NIT: ${escHtml(c.company_nit || 'N/A')} &nbsp;|&nbsp; SUCURSAL: ${escHtml(c.branch_name || '')}${c.branch_address ? ' (' + escHtml(c.branch_address) + ')' : ''}
        </div>
        <div class="inst-period">${escHtml(periodText)}${c.seller_name ? ' &nbsp;|&nbsp; VENDEDOR: ' + escHtml(c.seller_name) : ''}</div>
        <div class="inst-currency">(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)</div>
    </div>`;

    // Readings table grouped by island with adjusted, balanced column widths
    html += `<div class="section">
        <div class="section-title">Lecturas de Mangueras por Isla</div>
        <table>
            <colgroup>
                <col style="width: 6%;">
                <col style="width: 22%;">
                <col style="width: 9%;">
                <col style="width: 14%;">
                <col style="width: 14%;">
                <col style="width: 9%;">
                <col style="width: 12%;">
                <col style="width: 14%;">
            </colgroup>
            <thead><tr>
                <th>Pistola</th><th>Producto</th><th class="right">Precio</th>
                <th class="right">Lect. Ant.</th><th class="right">Lect. Actual</th>
                <th class="right">Calib.</th><th class="right">Galones</th><th class="right">Monto</th>
            </tr></thead>
            <tbody>`;

    if (islandGroups.length === 0) {
        html += `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:8px;">No hay lecturas de mangueras registradas</td></tr>`;
    }

    islandGroups.forEach(ig => {
        // Island Header Row
        const islandLabel = ig.codigo ? `ISLA: ${ig.codigo} — ${ig.descripcion}` : ig.descripcion;
        html += `<tr class="island-row">
            <td colspan="8"><strong>⛽ ${escHtml(islandLabel)}</strong></td>
        </tr>`;

        ig.readings.forEach(r => {
            html += `<tr>
                <td class="mono"><strong>${escHtml(r.codigo_pistola)}</strong></td>
                <td>${escHtml(r.codigo_producto)} <span style="font-size:8px;color:#64748b;">${escHtml(r.descripcion_producto)}</span></td>
                <td class="right mono">${fmtMoney(r.precio)}</td>
                <td class="right mono">${fmtQty(r.lectura_anterior)}</td>
                <td class="right mono">${fmtQty(r.lectura_actual)}</td>
                <td class="right mono">${fmtQty(r.calibracion)}</td>
                <td class="right mono"><strong>${fmtQty(r.diff)}</strong></td>
                <td class="right mono"><strong>${fmtMoney(r.monto)}</strong></td>
            </tr>`;
        });

        // Island Subtotal Row (perfectly aligned with Galones col 7 & Monto col 8)
        if (islandGroups.length > 1) {
            html += `<tr class="island-subtotal">
                <td colspan="6" class="right" style="text-align:right;">Subtotal ${escHtml(ig.codigo ? 'Isla ' + ig.codigo : ig.descripcion)}:</td>
                <td class="right mono">${fmtQty(ig.subtotalLectura)}</td>
                <td class="right mono">${fmtMoney(ig.subtotalMonto)}</td>
            </tr>`;
        }
    });

    html += `</tbody>
            <tfoot><tr>
                <td colspan="6" class="right" style="text-align:right;">Total General Lecturas:</td>
                <td class="right mono">${fmtQty(totalLectura)}</td>
                <td class="right mono">${fmtMoney(totalMonto)}</td>
            </tr></tfoot>
        </table></div>`;

    // Resumen de Lecturas & Liquidación in compact columns
    html += `<div class="flex-row">`;

    // Left Column: Resumen por Producto + Diferencia
    html += `<div class="flex-1" style="display:flex;flex-direction:column;justify-content:space-between;">`;
    
    // Summary by product with explicit column widths
    html += `<div>
        <div class="section">
            <div class="section-title">Resumen por Producto</div>
            <table>
                <colgroup>
                    <col style="width: 14%;">
                    <col style="width: 38%;">
                    <col style="width: 14%;">
                    <col style="width: 17%;">
                    <col style="width: 17%;">
                </colgroup>
                <thead><tr>
                    <th>Código</th><th>Descripción</th><th class="right">Precio</th>
                    <th class="right">Galones</th><th class="right">Total Monto</th>
                </tr></thead>
                <tbody>`;
    summaryByProduct.forEach(p => {
        html += `<tr>
            <td class="mono">${escHtml(p.codigo_producto)}</td>
            <td>${escHtml(p.descripcion_producto)}</td>
            <td class="right mono">${fmtMoney(p.precio)}</td>
            <td class="right mono">${fmtQty(p.total_lectura)}</td>
            <td class="right mono">${fmtMoney(p.total_monto)}</td>
        </tr>`;
    });
    html += `</tbody>
                <tfoot><tr>
                    <td colspan="3" style="text-align:right;">Totales:</td>
                    <td class="right mono">${fmtQty(totalLectura)}</td>
                    <td class="right mono">${fmtMoney(totalMonto)}</td>
                </tr></tfoot>
            </table>
        </div>
    </div>`;

    // Liquidación / Diferencia (nivelada)
    html += `<div class="section" style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; background: #fafafa; margin-bottom: 7px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;color:#475569;">Faltante / Sobrante del Turno:</span>
            <span style="font-size:13px;font-weight:900;font-family:'Courier New',monospace;${diferenciaTotal >= 0 ? 'color:#059669;' : 'color:#dc2626;'}">
                ${diferenciaTotal >= 0 ? '+' : ''}${fmtMoney(diferenciaTotal)}
            </span>
        </div>
    </div>`;

    html += `</div>`; // End Left Column

    // Right Column: Liquidación de Ingresos y Egresos with explicit column widths
    html += `<div class="flex-1">
        <div class="section">
            <div class="section-title" style="border-left-color:#059669;color:#059669;">Liquidación de Ingresos y Egresos</div>
            <table>
                <colgroup>
                    <col style="width: 52%;">
                    <col style="width: 24%;">
                    <col style="width: 24%;">
                </colgroup>
                <thead><tr><th>Concepto</th><th class="right">Ingreso (+)</th><th class="right">Egreso (-)</th></tr></thead>
                <tbody>
                    <tr><td>Combustible (Venta Lecturas)</td><td class="right mono">${fmtMoney(totalMonto)}</td><td class="right mono">—</td></tr>
                    ${lubricantTotal > 0 ? `<tr><td>Lubricantes</td><td class="right mono">${fmtMoney(lubricantTotal)}</td><td class="right mono">—</td></tr>` : ''}
                    ${remesasTotal > 0 ? `<tr><td>Remesas Bancarias</td><td class="right mono">—</td><td class="right mono">${fmtMoney(remesasTotal)}</td></tr>` : ''}
                    ${tarjetasTotal > 0 ? `<tr><td>Tarjetas (POS)</td><td class="right mono">—</td><td class="right mono">${fmtMoney(tarjetasTotal)}</td></tr>` : ''}
                    ${creditosTotal > 0 ? `<tr><td>Ventas a Crédito</td><td class="right mono">—</td><td class="right mono">${fmtMoney(creditosTotal)}</td></tr>` : ''}
                    ${valesTotal > 0 ? `<tr><td>Vales / Órdenes</td><td class="right mono">—</td><td class="right mono">${fmtMoney(valesTotal)}</td></tr>` : ''}
                    ${anticiposDespTotal > 0 ? `<tr><td>Anticipos Despachadores</td><td class="right mono">—</td><td class="right mono">${fmtMoney(anticiposDespTotal)}</td></tr>` : ''}
                    ${gastosTotal > 0 ? `<tr><td>Gastos de Turno</td><td class="right mono">—</td><td class="right mono">${fmtMoney(gastosTotal)}</td></tr>` : ''}
                    ${cuponesTotal > 0 ? `<tr><td>Cupones</td><td class="right mono">—</td><td class="right mono">${fmtMoney(cuponesTotal)}</td></tr>` : ''}
                    ${descuentosTotal > 0 ? `<tr><td>Descuentos</td><td class="right mono">—</td><td class="right mono">${fmtMoney(descuentosTotal)}</td></tr>` : ''}
                    ${adelantosTotal > 0 ? `<tr><td>Adelantos</td><td class="right mono">—</td><td class="right mono">${fmtMoney(adelantosTotal)}</td></tr>` : ''}
                </tbody>
                <tfoot>
                    <tr>
                        <td>Subtotales</td>
                        <td class="right mono" style="color:#059669;">${fmtMoney(ingresosTotal)}</td>
                        <td class="right mono" style="color:#dc2626;">${fmtMoney(egresosTotal)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>`; // End Right Column

    html += `</div>`; // End Flex-Row

    // Tank Readings & Despachadores
    html += `<div class="flex-row">`;

    // Tank Readings
    html += `<div class="flex-1">
        <div class="section">
            <div class="section-title">Lecturas de Tanques</div>
            <table>
                <colgroup>
                    <col style="width: 40%;">
                    <col style="width: 15%;">
                    <col style="width: 15%;">
                    <col style="width: 15%;">
                    <col style="width: 15%;">
                </colgroup>
                <thead><tr>
                    <th>Tanque</th><th class="right">Lect. Ant.</th><th class="right">Recarga</th>
                    <th class="right">Lect. Act.</th><th class="right">Difer.</th>
                </tr></thead>
                <tbody>`;
    if (tankReadings.length === 0) {
        html += `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:6px;">Sin registros de tanques</td></tr>`;
    }
    tankReadings.forEach(r => {
        const diff = (parseFloat(r.lectura_anterior) || 0) + (parseFloat(r.recarga) || 0) - (parseFloat(r.lectura_actual) || 0);
        html += `<tr>
            <td>${escHtml(r.codigo_tanque)} <span style="font-size:8px;color:#64748b;">${escHtml(r.descripcion_tanque)}</span></td>
            <td class="right mono">${fmtQty(r.lectura_anterior, 4)}</td>
            <td class="right mono">${fmtQty(r.recarga, 4)}</td>
            <td class="right mono">${fmtQty(r.lectura_actual, 4)}</td>
            <td class="right mono">${fmtQty(diff, 4)}</td>
        </tr>`;
    });
    const tankRecargaTotal = tankReadings.reduce((s, r) => s + (parseFloat(r.recarga) || 0), 0);
    const tankDiffTotal = tankReadings.reduce((s, r) => s + ((parseFloat(r.lectura_anterior) || 0) + (parseFloat(r.recarga) || 0) - (parseFloat(r.lectura_actual) || 0)), 0);
    if (tankReadings.length > 0) {
        html += `</tbody>
                <tfoot><tr>
                    <td style="text-align:right;">Totales:</td>
                    <td></td>
                    <td class="right mono">${fmtQty(tankRecargaTotal, 4)}</td>
                    <td></td>
                    <td class="right mono">${fmtQty(tankDiffTotal, 4)}</td>
                </tr></tfoot>`;
    } else {
        html += `</tbody>`;
    }
    html += `</table></div></div>`;

    // Despachadores
    html += `<div class="flex-1">
        <div class="section">
            <div class="section-title">Despachadores por Turno</div>
            <table>
                <colgroup>
                    ${isAccumulated ? '<col style="width: 14%;">' : ''}
                    <col style="width: 12%;">
                    <col style="${isAccumulated ? 'width: 24%;' : 'width: 28%;'}">
                    <col style="${isAccumulated ? 'width: 17%;' : 'width: 20%;'}">
                    <col style="${isAccumulated ? 'width: 17%;' : 'width: 20%;'}">
                    <col style="${isAccumulated ? 'width: 16%;' : 'width: 20%;'}">
                </colgroup>
                <thead><tr>
                    ${isAccumulated ? '<th>Turno</th>' : ''}
                    <th>Código</th><th>Nombre</th><th class="right">Venta</th>
                    <th class="right">Liquidado</th><th class="right">Diferencia</th>
                </tr></thead>
                <tbody>`;
    let totalVentaDesp = 0;
    let totalLiquidadoDesp = 0;
    let totalDiffDesp = 0;

    despachadores.forEach((d, idx) => {
        const rowKey = `${d.closeout_id || ''}_${d.despachador_id}_${idx}`;
        const dVenta = despachadorVentas[rowKey] || 0;
        const dNoPercibido = despachadorNoPercibido[rowKey] || 0;
        const dEntregado = despachadorEntregado[rowKey] || 0;
        const dLiquidado = dNoPercibido + dEntregado;
        const dDiff = dLiquidado - dVenta;
        totalVentaDesp += dVenta;
        totalLiquidadoDesp += dLiquidado;
        totalDiffDesp += dDiff;
        const turnoBadge = d.numero_turno ? `Turno #${d.numero_turno}` : '—';
        html += `<tr>
            ${isAccumulated ? `<td class="mono"><strong>${escHtml(turnoBadge)}</strong></td>` : ''}
            <td class="mono"><strong>${escHtml(d.despachador_codigo || '')}</strong></td>
            <td>${escHtml(d.nombre || d.despachador_descripcion || '')}</td>
            <td class="right mono">${fmtMoney(dVenta)}</td>
            <td class="right mono">${fmtMoney(dLiquidado)}</td>
            <td class="right mono" style="color:${dDiff >= 0 ? '#059669' : '#dc2626'};font-weight:700;">${dDiff >= 0 ? '+' : ''}${fmtMoney(dDiff)}</td>
        </tr>`;
    });
    if (despachadores.length > 0) {
        html += `</tbody>
            <tfoot><tr>
                <td colspan="${isAccumulated ? 3 : 2}" class="right" style="text-align:right;">Totales:</td>
                <td class="right mono">${fmtMoney(totalVentaDesp)}</td>
                <td class="right mono">${fmtMoney(totalLiquidadoDesp)}</td>
                <td class="right mono" style="color:${totalDiffDesp >= 0 ? '#059669' : '#dc2626'};font-weight:700;">${totalDiffDesp >= 0 ? '+' : ''}${fmtMoney(totalDiffDesp)}</td>
            </tr></tfoot>`;
    } else {
        html += `</tbody>`;
    }
    html += `</table></div></div>`;

    html += `</div>`; // End Tank/Despachadores row

    html += `<div style="text-align:center;font-size:7.5px;color:#94a3b8;margin-top:6px;padding-top:4px;border-top:0.75px solid #cbd5e1;">
        FIN DEL REPORTE — GENERADO POR EL SISTEMA
    </div>`;

    html += `<script>setTimeout(() => { window.print(); }, 300);</script>`;
    html += `</body></html>`;

    return html;
}

function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
