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

    const despachadorVentas = {};
    const despachadorNoPercibido = {};
    const despachadorEntregado = {};

    for (const d of despachadores) {
        const did = d.despachador_id;
        const assignedNozzles = despachadorNozzleAssignments
            .filter(a => a.despachador_id === did)
            .map(a => a.nozzle_id);
        let ventaTotal = 0;
        for (const r of readings) {
            if (assignedNozzles.includes(r.nozzle_id)) {
                ventaTotal += (r.lectura_actual - r.lectura_anterior - (r.calibracion || 0)) * r.precio;
            }
        }
        despachadorVentas[did] = ventaTotal;

        despachadorNoPercibido[did] =
            gastos.filter(g => parseInt(g.despachador_id) === did).reduce((s, g) => s + (parseFloat(g.valor) || 0), 0) +
            cupones.filter(c => parseInt(c.despachador_id) === did).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) +
            descuentos.filter(dd => parseInt(dd.despachador_id) === did).reduce((s, dd) => s + (parseFloat(dd.total) || 0), 0) +
            adelantos.filter(a => parseInt(a.despachador_id) === did).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0) +
            tarjetas.filter(t => parseInt(t.despachador_id) === did).reduce((s, t) => s + (parseFloat(t.monto) || 0), 0) +
            creditos.filter(c => parseInt(c.despachador_id) === did).reduce((s, c) => s + (parseFloat(c.monto) || 0), 0) +
            vales.filter(v => parseInt(v.despachador_id) === did).reduce((s, v) => s + (parseFloat(v.monto) || 0), 0) +
            anticiposDesp.filter(a => parseInt(a.despachador_id) === did).reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);

        despachadorEntregado[did] =
            remesas.filter(r => parseInt(r.despachador_id) === did).reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
    }

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

    const tableStyle = 'width:100%;border-collapse:collapse;font-size:10px;';
    const thStyle = 'background:#f8fafc;border-bottom:2px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;color:#64748b;';
    const thRight = thStyle + 'text-align:right;';
    const tdStyle = 'padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:10px;';
    const tdRight = tdStyle + 'text-align:right;';
    const tfootStyle = 'background:#f8fafc;border-top:2px solid #e2e8f0;padding:6px 8px;font-size:10px;font-weight:700;';
    const tfootRight = tfootStyle + 'text-align:right;';

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cierre de Lecturas - Turno #${c.numero_turno}</title>
<style>
    @page { margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #1e293b; font-size: 11px; }
    .header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1e293b; }
    .header h1 { font-size: 16px; margin: 0 0 4px; }
    .header .sub { font-size: 10px; color: #64748b; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 6px 8px; background: #f1f5f9; border-radius: 4px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    th.right { text-align: right; }
    td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    td.right { text-align: right; }
    td.mono { font-family: 'Courier New', monospace; }
    tfoot td { background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 6px 8px; font-size: 10px; font-weight: 700; }
    tfoot td.right { text-align: right; }
    .flex-row { display: flex; gap: 12px; }
    .flex-1 { flex: 1; }
    .diff-pos { color: #059669; }
    .diff-neg { color: #dc2626; }
    .total-row { font-weight: 700; }
    @media print {
        .no-print { display: none; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style></head><body>
    <div class="header">
        <h1>${escHtml(c.company_name || '')}</h1>
        <div class="sub">NIT: ${escHtml(c.company_nit || '')}${c.company_commercial_name ? ' — ' + escHtml(c.company_commercial_name) : ''}</div>
        <div class="sub">${escHtml(c.branch_name || '')} ${c.branch_address ? '— ' + escHtml(c.branch_address) : ''}</div>
        <div style="margin-top:8px;font-size:12px;font-weight:700;">CIERRE DE LECTURAS</div>
        <div style="margin-top:4px;font-size:10px;">
            Turno #${c.numero_turno} — ${fecha}
            <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:700;text-transform:uppercase;background:${estadoColor}15;color:${estadoColor};margin-left:6px;">${estadoLabel}</span>
        </div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;">Vendedor: ${escHtml(c.seller_name || '')}</div>
    </div>`;

    // Readings table
    html += `<div class="section">
        <div class="section-title">Lecturas de Mangueras</div>
        <table>
            <thead><tr>
                <th>Pistola</th><th>Producto</th><th class="right">Precio</th>
                <th class="right">Lect. Ant.</th><th class="right">Lect. Actual</th>
                <th class="right">Calib.</th><th class="right">Difer.</th><th class="right">Monto</th>
            </tr></thead>
            <tbody>`;
    readings.forEach(r => {
        const diff = r.lectura_actual - r.lectura_anterior - r.calibracion;
        const monto = diff * r.precio;
        html += `<tr>
            <td class="mono">${escHtml(r.codigo_pistola)}</td>
            <td>${escHtml(r.codigo_producto)}<br><span style="font-size:9px;color:#94a3b8;">${escHtml(r.descripcion_producto)}</span></td>
            <td class="right mono">$${parseFloat(r.precio).toFixed(2)}</td>
            <td class="right mono">${parseFloat(r.lectura_anterior).toFixed(5)}</td>
            <td class="right mono">${parseFloat(r.lectura_actual).toFixed(5)}</td>
            <td class="right mono">${parseFloat(r.calibracion).toFixed(5)}</td>
            <td class="right mono">${diff.toFixed(5)}</td>
            <td class="right mono">$${monto.toFixed(2)}</td>
        </tr>`;
    });
    html += `</tbody></table></div>`;

    // Summary by product
    html += `<div class="section">
        <div class="section-title">Resumen de Lecturas</div>
        <table>
            <thead><tr>
                <th>Código</th><th>Descripción</th><th class="right">Precio</th>
                <th class="right">Total Lectura</th><th class="right">Total Monto</th>
            </tr></thead>
            <tbody>`;
    summaryByProduct.forEach(p => {
        html += `<tr>
            <td class="mono">${escHtml(p.codigo_producto)}</td>
            <td>${escHtml(p.descripcion_producto)}</td>
            <td class="right mono">$${parseFloat(p.precio).toFixed(2)}</td>
            <td class="right mono">${p.total_lectura.toFixed(5)}</td>
            <td class="right mono">$${p.total_monto.toFixed(2)}</td>
        </tr>`;
    });
    html += `</tbody>
            <tfoot><tr>
                <td colspan="3" style="${tfootStyle}text-align:right;">Totales</td>
                <td style="${tfootRight}mono">${totalLectura.toFixed(5)}</td>
                <td style="${tfootRight}mono">$${totalMonto.toFixed(2)}</td>
            </tr></tfoot>
        </table></div>`;

    // Ingresos & Egresos side by side
    html += `<div style="display:flex;gap:12px;">`;

    // Ingresos
    html += `<div class="section" style="flex:1;">
        <div class="section-title" style="color:#059669;">Ingresos</div>
        <table>
            <thead><tr><th>Descripción</th><th class="right">Monto</th></tr></thead>
            <tbody>
                <tr><td>Combustible (Ventas)</td><td class="right mono">$${totalMonto.toFixed(2)}</td></tr>
                <tr><td>Lubricantes</td><td class="right mono">${lubricantTotal > 0 ? '$' + lubricantTotal.toFixed(2) : '<span style="color:#94a3b8;">$0.00</span>'}</td></tr>
            </tbody>
            <tfoot><tr><td style="${tfootStyle}">Total Ingresos</td><td style="${tfootRight}mono" style="color:#059669;">$${ingresosTotal.toFixed(2)}</td></tr></tfoot>
        </table>
    </div>`;

    // Egresos
    html += `<div class="section" style="flex:1;">
        <div class="section-title" style="color:#dc2626;">Egresos</div>
        <table>
            <thead><tr><th>Descripción</th><th class="right">Monto</th></tr></thead>
            <tbody>`;
    const egresosItems = [
        { label: 'Créditos', total: creditosTotal },
        { label: 'Vales', total: valesTotal },
        { label: 'Anticipos Desp.', total: anticiposDespTotal },
        { label: 'Gastos', total: gastosTotal },
        { label: 'Remesas', total: remesasTotal },
        { label: 'Cupones', total: cuponesTotal },
        { label: 'Descuentos', total: descuentosTotal },
        { label: 'Adelantos', total: adelantosTotal },
        { label: 'Tarjetas', total: tarjetasTotal },
    ];
    egresosItems.forEach(item => {
        html += `<tr><td>${item.label}</td><td class="right mono">$${item.total.toFixed(2)}</td></tr>`;
    });
    html += `</tbody>
            <tfoot><tr><td style="${tfootStyle}">Total Egresos</td><td style="${tfootRight}mono" style="color:#dc2626;">$${egresosTotal.toFixed(2)}</td></tr></tfoot>
        </table>
    </div>`;

    html += `</div>`; // end flex-row

    // Tank Readings
    html += `<div class="section">
        <div class="section-title">Lecturas de Tanques</div>
        <table>
            <thead><tr>
                <th>Tanque</th><th class="right">Lect. Ant.</th><th class="right">Recarga</th>
                <th class="right">Lect. Actual</th><th class="right">Venta (Difer.)</th>
            </tr></thead>
            <tbody>`;
    if (tankReadings.length === 0) {
        html += `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px;">No hay lecturas de tanques registradas.</td></tr>`;
    }
    tankReadings.forEach(r => {
        const diff = (parseFloat(r.lectura_anterior) || 0) + (parseFloat(r.recarga) || 0) - (parseFloat(r.lectura_actual) || 0);
        html += `<tr>
            <td>${escHtml(r.codigo_tanque)} — ${escHtml(r.descripcion_tanque)}</td>
            <td class="right mono">${(parseFloat(r.lectura_anterior) || 0).toFixed(5)}</td>
            <td class="right mono">${(parseFloat(r.recarga) || 0).toFixed(5)}</td>
            <td class="right mono">${(parseFloat(r.lectura_actual) || 0).toFixed(5)}</td>
            <td class="right mono">${diff.toFixed(5)}</td>
        </tr>`;
    });
    const tankRecargaTotal = tankReadings.reduce((s, r) => s + (parseFloat(r.recarga) || 0), 0);
    const tankDiffTotal = tankReadings.reduce((s, r) => s + ((parseFloat(r.lectura_anterior) || 0) + (parseFloat(r.recarga) || 0) - (parseFloat(r.lectura_actual) || 0)), 0);
    html += `</tbody>
            <tfoot><tr>
                <td colspan="2" style="${tfootStyle}text-align:right;">Totales</td>
                <td style="${tfootRight}mono">${tankRecargaTotal.toFixed(5)}</td>
                <td></td>
                <td style="${tfootRight}mono">${tankDiffTotal.toFixed(5)}</td>
            </tr></tfoot>
        </table></div>`;

    // Diferencia
    const diffClass = diferenciaTotal >= 0 ? 'diff-pos' : 'diff-neg';
    html += `<div class="section">
        <div class="section-title">Diferencia</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;">
            <span style="font-size:11px;">Faltante / Sobrante del turno</span>
            <span style="font-size:16px;font-weight:900;font-family:'Courier New',monospace;${diferenciaTotal >= 0 ? 'color:#059669;' : 'color:#dc2626;'}">${diferenciaTotal >= 0 ? '+' : ''}$${diferenciaTotal.toFixed(2)}</span>
        </div>
    </div>`;

    // Despachadores
    html += `<div class="section">
        <div class="section-title">Despachadores del Turno</div>
        <table>
            <thead><tr>
                <th>Código</th><th>Nombre</th><th class="right">Venta</th>
                <th class="right">No Percibido</th><th class="right">Entregado</th><th class="right">Diferencia</th>
            </tr></thead>
            <tbody>`;
    if (despachadores.length === 0) {
        html += `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:16px;">Sin despachadores asignados</td></tr>`;
    }
    despachadores.forEach(d => {
        const did = d.despachador_id;
        const dVenta = despachadorVentas[did] || 0;
        const dNoPercibido = despachadorNoPercibido[did] || 0;
        const dEntregado = despachadorEntregado[did] || 0;
        const dDiff = (dNoPercibido + dEntregado) - dVenta;
        const diffClass = dDiff >= 0 ? 'diff-pos' : 'diff-neg';
        html += `<tr>
            <td class="mono">${escHtml(d.despachador_codigo || '')}</td>
            <td>${escHtml(d.nombre || '')}</td>
            <td class="right mono">$${dVenta.toFixed(2)}</td>
            <td class="right mono">$${dNoPercibido.toFixed(2)}</td>
            <td class="right mono">$${dEntregado.toFixed(2)}</td>
            <td class="right mono" style="color:${dDiff >= 0 ? '#059669' : '#dc2626'};font-weight:700;">${dDiff >= 0 ? '+' : ''}$${dDiff.toFixed(2)}</td>
        </tr>`;
    });
    html += `</tbody></table></div>`;

    html += `<div style="text-align:center;font-size:9px;color:#94a3b8;margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;">
        Documento generado el ${new Date().toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
