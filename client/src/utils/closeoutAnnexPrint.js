import { formatDate, formatDateTime } from './dateUtils';

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const fmtMoney = (val) => {
    const n = parseFloat(val) || 0;
    return '$ ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtQty = (val, dec = 2) => {
    const n = parseFloat(val) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

export const ANNEX_CONFIG = {
    remesas: {
        id: 'remesas',
        label: 'Remesas',
        title: 'ANEXO DE REMESAS BANCARIAS',
        icon: '💵',
        dataKey: 'remesas'
    },
    gastos: {
        id: 'gastos',
        label: 'Gastos',
        title: 'ANEXO DE GASTOS DE TURNO',
        icon: '📑',
        dataKey: 'gastos'
    },
    creditos: {
        id: 'creditos',
        label: 'Créditos',
        title: 'ANEXO DE VENTAS A CRÉDITO',
        icon: '👥',
        dataKey: 'creditos'
    },
    cupones: {
        id: 'cupones',
        label: 'Cupones',
        title: 'ANEXO DE CUPONES',
        icon: '🎟️',
        dataKey: 'cupones'
    },
    descuentos: {
        id: 'descuentos',
        label: 'Descuentos',
        title: 'ANEXO DE DESCUENTOS',
        icon: '🏷️',
        dataKey: 'descuentos'
    },
    adelantos: {
        id: 'adelantos',
        label: 'Adelantos',
        title: 'ANEXO DE ADELANTOS DE EMPLEADOS',
        icon: '⏩',
        dataKey: 'adelantos'
    },
    tarjetas: {
        id: 'tarjetas',
        label: 'Tarjetas',
        title: 'ANEXO DE PAGOS CON TARJETAS (POS)',
        icon: '💳',
        dataKey: 'tarjetas'
    },
    vales: {
        id: 'vales',
        label: 'Vales',
        title: 'ANEXO DE VALES Y ÓRDENES DE DESPACHO',
        icon: '🎫',
        dataKey: 'vales'
    },
    anticipos: {
        id: 'anticipos',
        label: 'Anticipos Despachados',
        title: 'ANEXO DE ANTICIPOS DESPACHADOS',
        icon: '⛽',
        dataKey: 'anticiposDesp'
    },
    lubricantes: {
        id: 'lubricantes',
        label: 'Lubricantes',
        title: 'ANEXO DE VENTAS Y LECTURAS DE LUBRICANTES',
        icon: '🛢️',
        dataKey: 'lubricantes'
    }
};

export function buildCloseoutAnnexPrintHtml(data, annexKey) {
    const config = ANNEX_CONFIG[annexKey];
    if (!config) {
        throw new Error(`Tipo de anexo no válido: ${annexKey}`);
    }

    const c = data.closeout || {};
    const items = data[config.dataKey] || [];
    const fecha = c.fecha_turno ? formatDate(c.fecha_turno) : '—';
    const emision = formatDateTime(new Date());

    let rowsHtml = '';
    let totalMonto = 0;
    let totalCantidad = 0;

    switch (annexKey) {
        case 'remesas': {
            totalMonto = items.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);
            const tipoMap = {
                venta_combustible: 'Venta Combustible',
                recuperacion_credito: 'Recup. Crédito',
                pago_anticipado: 'Pago Anticipado'
            };
            rowsHtml = items.length === 0
                ? `<tr><td colspan="5" class="empty">No se registraron remesas en este turno</td></tr>`
                : items.map((r, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono font-bold">${escHtml(r.documento || '—')}</td>
                        <td>${escHtml(r.despachador_descripcion || r.despachador_codigo || '—')}</td>
                        <td>${escHtml(tipoMap[r.tipo_operacion] || r.tipo_operacion || '—')}</td>
                        <td class="right mono font-bold">${fmtMoney(r.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'gastos': {
            totalMonto = items.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="7" class="empty">No se registraron gastos en este turno</td></tr>`
                : items.map((g, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td><span class="badge-tag">${escHtml(g.rubro || 'General')}</span></td>
                        <td class="mono">${escHtml(g.documento || '—')}</td>
                        <td>${escHtml(g.proveedor_nombre || g.proveedor || '—')}</td>
                        <td>${escHtml(g.despachador_descripcion || '—')}</td>
                        <td>${escHtml(g.descripcion || '—')}</td>
                        <td class="right mono font-bold">${fmtMoney(g.valor)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'creditos': {
            totalMonto = items.reduce((s, cr) => s + (parseFloat(cr.monto) || 0), 0);
            totalCantidad = items.reduce((s, cr) => s + (parseFloat(cr.galones) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="7" class="empty">No se registraron ventas a crédito en este turno</td></tr>`
                : items.map((cr, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono font-bold">${escHtml(cr.comprobante || '—')}</td>
                        <td class="font-bold">${escHtml(cr.cliente_nombre_db || cr.cliente || '—')}</td>
                        <td>${escHtml(cr.producto_nombre_db || cr.producto || '—')}</td>
                        <td>${escHtml(cr.despachador_descripcion || '—')}</td>
                        <td class="right mono">${fmtQty(cr.galones, 3)} gal</td>
                        <td class="right mono font-bold">${fmtMoney(cr.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'cupones': {
            totalMonto = items.reduce((s, cp) => s + (parseFloat(cp.monto) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="6" class="empty">No se registraron cupones en este turno</td></tr>`
                : items.map((cp, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono font-bold">${escHtml(cp.cupon || '—')}</td>
                        <td>${escHtml(cp.distribuidora_nombre || cp.distribuidora || '—')}</td>
                        <td>${escHtml(cp.producto_nombre || cp.producto || '—')}</td>
                        <td>${escHtml(cp.despachador_descripcion || '—')}</td>
                        <td class="right mono font-bold">${fmtMoney(cp.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'descuentos': {
            totalMonto = items.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);
            totalCantidad = items.reduce((s, d) => s + (parseFloat(d.cantidad) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="8" class="empty">No se registraron descuentos en este turno</td></tr>`
                : items.map((d, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono">${escHtml(d.documento || '—')}</td>
                        <td>${escHtml(d.cliente_nombre_db || d.cliente || '—')}</td>
                        <td>${escHtml(d.producto_nombre_db || d.producto || '—')}</td>
                        <td>${escHtml(d.despachador_descripcion || '—')}</td>
                        <td class="right mono">${fmtQty(d.cantidad, 2)}</td>
                        <td class="right mono">${fmtMoney(d.valor)}</td>
                        <td class="right mono font-bold">${fmtMoney(d.total)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'adelantos': {
            totalMonto = items.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="4" class="empty">No se registraron adelantos en este turno</td></tr>`
                : items.map((a, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="font-bold">${escHtml(a.empleado || '—')}</td>
                        <td>${escHtml(a.despachador_descripcion || '—')}</td>
                        <td class="right mono font-bold">${fmtMoney(a.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'tarjetas': {
            totalMonto = items.reduce((s, t) => s + (parseFloat(t.monto) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="7" class="empty">No se registraron transacciones con tarjeta en este turno</td></tr>`
                : items.map((t, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono font-bold">${escHtml(t.numero_tarjeta || '—')}</td>
                        <td class="mono">${escHtml(t.numero_autorizacion || '—')}</td>
                        <td>${escHtml(t.tipo_pos_nombre || t.pos_tipo || '—')}</td>
                        <td>${escHtml(t.despachador_descripcion || '—')}</td>
                        <td>${escHtml(t.tipo_operacion || 'Venta')}</td>
                        <td class="right mono font-bold">${fmtMoney(t.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'vales': {
            totalMonto = items.reduce((s, v) => s + (parseFloat(v.monto) || 0), 0);
            totalCantidad = items.reduce((s, v) => s + (parseFloat(v.cantidad) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="9" class="empty">No se registraron vales en este turno</td></tr>`
                : items.map((v, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono font-bold">${escHtml(v.documento || '—')}</td>
                        <td>${escHtml(v.cliente_nombre_db || v.cliente || '—')}</td>
                        <td>${escHtml(v.producto_nombre_db || v.producto || '—')}</td>
                        <td>${escHtml(v.despachador_descripcion || '—')}</td>
                        <td class="mono">${escHtml(v.placa || '—')}</td>
                        <td class="right mono">${fmtQty(v.cantidad, 2)}</td>
                        <td class="right mono">${fmtMoney(v.precio)}</td>
                        <td class="right mono font-bold">${fmtMoney(v.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'anticipos': {
            totalMonto = items.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
            totalCantidad = items.reduce((s, a) => s + (parseFloat(a.cantidad) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="9" class="empty">No se registraron anticipos despachados en este turno</td></tr>`
                : items.map((a, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono font-bold">${escHtml(a.documento || '—')}</td>
                        <td>${escHtml(a.cliente_nombre_db || a.cliente || '—')}</td>
                        <td>${escHtml(a.producto_nombre_db || a.producto || '—')}</td>
                        <td>${escHtml(a.despachador_descripcion || '—')}</td>
                        <td class="mono">${escHtml(a.placa || '—')}</td>
                        <td class="right mono">${fmtQty(a.cantidad, 2)}</td>
                        <td class="right mono">${fmtMoney(a.precio)}</td>
                        <td class="right mono font-bold">${fmtMoney(a.monto)}</td>
                    </tr>
                `).join('');
            break;
        }

        case 'lubricantes': {
            totalMonto = items.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
            totalCantidad = items.reduce((s, l) => s + (parseFloat(l.ventas) || 0), 0);
            rowsHtml = items.length === 0
                ? `<tr><td colspan="9" class="empty">No se registraron lecturas de lubricantes en este turno</td></tr>`
                : items.map((l, i) => `
                    <tr>
                        <td class="center mono">${i + 1}</td>
                        <td class="mono">${escHtml(l.producto_codigo || '—')}</td>
                        <td>${escHtml(l.producto_descripcion || '—')}</td>
                        <td class="right mono">${fmtQty(l.lectura_inicial, 0)}</td>
                        <td class="right mono">${fmtQty(l.recarga, 0)}</td>
                        <td class="right mono">${fmtQty(l.lectura_final, 0)}</td>
                        <td class="right mono font-bold">${fmtQty(l.ventas, 0)}</td>
                        <td class="right mono">${fmtMoney(l.precio)}</td>
                        <td class="right mono font-bold">${fmtMoney(l.total)}</td>
                    </tr>
                `).join('');
            break;
        }
    }

    // Encabezados de tabla según el tipo
    let theadCols = '';
    let footerColspan = 4;
    switch (annexKey) {
        case 'remesas':
            theadCols = `<th style="width:5%">#</th><th style="width:25%">Documento</th><th style="width:30%">Despachador</th><th style="width:25%">Tipo de Operación</th><th style="width:15%" class="right">Monto</th>`;
            footerColspan = 4;
            break;
        case 'gastos':
            theadCols = `<th style="width:4%">#</th><th style="width:14%">Rubro</th><th style="width:14%">Documento</th><th style="width:20%">Proveedor</th><th style="width:18%">Despachador</th><th style="width:18%">Descripción</th><th style="width:12%" class="right">Monto</th>`;
            footerColspan = 6;
            break;
        case 'creditos':
            theadCols = `<th style="width:4%">#</th><th style="width:14%">Comprobante</th><th style="width:26%">Cliente</th><th style="width:18%">Combustible</th><th style="width:18%">Despachador</th><th style="width:10%" class="right">Galones</th><th style="width:10%" class="right">Total</th>`;
            footerColspan = 6;
            break;
        case 'cupones':
            theadCols = `<th style="width:5%">#</th><th style="width:20%">No. Cupón</th><th style="width:25%">Distribuidora</th><th style="width:25%">Producto</th><th style="width:15%">Despachador</th><th style="width:10%" class="right">Monto</th>`;
            footerColspan = 5;
            break;
        case 'descuentos':
            theadCols = `<th style="width:4%">#</th><th style="width:14%">Documento</th><th style="width:22%">Cliente</th><th style="width:18%">Producto</th><th style="width:16%">Despachador</th><th style="width:8%" class="right">Cant.</th><th style="width:9%" class="right">Valor</th><th style="width:9%" class="right">Total</th>`;
            footerColspan = 7;
            break;
        case 'adelantos':
            theadCols = `<th style="width:8%">#</th><th style="width:46%">Empleado / Beneficiario</th><th style="width:30%">Despachador</th><th style="width:16%" class="right">Monto</th>`;
            footerColspan = 3;
            break;
        case 'tarjetas':
            theadCols = `<th style="width:5%">#</th><th style="width:20%">No. Tarjeta</th><th style="width:18%">Autorización</th><th style="width:18%">Tipo POS</th><th style="width:18%">Despachador</th><th style="width:11%">Operación</th><th style="width:10%" class="right">Monto</th>`;
            footerColspan = 6;
            break;
        case 'vales':
            theadCols = `<th style="width:4%">#</th><th style="width:14%">Documento</th><th style="width:22%">Cliente</th><th style="width:16%">Producto</th><th style="width:16%">Despachador</th><th style="width:8%">Placa</th><th style="width:6%" class="right">Cant.</th><th style="width:7%" class="right">Precio</th><th style="width:7%" class="right">Total</th>`;
            footerColspan = 8;
            break;
        case 'anticipos':
            theadCols = `<th style="width:4%">#</th><th style="width:14%">Documento</th><th style="width:22%">Cliente</th><th style="width:16%">Producto</th><th style="width:16%">Despachador</th><th style="width:8%">Placa</th><th style="width:6%" class="right">Cant.</th><th style="width:7%" class="right">Precio</th><th style="width:7%" class="right">Total</th>`;
            footerColspan = 8;
            break;
        case 'lubricantes':
            theadCols = `<th style="width:4%">#</th><th style="width:10%">Código</th><th style="width:26%">Descripción</th><th style="width:9%" class="right">Lect. Ant.</th><th style="width:9%" class="right">Recarga</th><th style="width:9%" class="right">Lect. Act.</th><th style="width:8%" class="right">Ventas</th><th style="width:10%" class="right">Precio</th><th style="width:15%" class="right">Total</th>`;
            footerColspan = 8;
            break;
    }

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${escHtml(config.title)} - Turno #${escHtml(c.numero_turno || '—')}</title>
    <style>
        @page { margin: 8mm 10mm; size: letter portrait; }
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 15px;
            color: #0f172a;
            font-size: 10px;
            background: #f8fafc;
        }
        .page-container {
            max-width: 820px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        /* Actions Bar on screen */
        .actions-bar {
            max-width: 820px;
            margin: 0 auto 12px auto;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .btn {
            background: #4f46e5;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 14px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.15s ease;
        }
        .btn:hover { background: #4338ca; }
        .btn-secondary { background: #e2e8f0; color: #334155; }
        .btn-secondary:hover { background: #cbd5e1; }

        /* Institutional Header */
        .header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
        }
        .company-name {
            font-size: 15px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin: 0 0 2px 0;
        }
        .company-tax {
            font-size: 9.5px;
            font-weight: 600;
            color: #475569;
            margin-bottom: 2px;
        }
        .branch-info {
            font-size: 9px;
            color: #64748b;
            margin-bottom: 8px;
        }
        .report-title-box {
            display: inline-block;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 4px 14px;
            margin-top: 4px;
        }
        .report-title {
            font-size: 12px;
            font-weight: 800;
            color: #1e293b;
            letter-spacing: 0.5px;
        }

        /* Metadata Grid */
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 14px;
        }
        .meta-item { display: flex; flex-direction: column; }
        .meta-label { font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .meta-value { font-size: 10.5px; font-weight: 700; color: #0f172a; }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            margin-bottom: 16px;
        }
        th {
            background: #f1f5f9;
            color: #0f172a;
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 6px 8px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
        }
        td {
            padding: 6px 8px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            vertical-align: middle;
        }
        tr:nth-child(even) td { background: #fafafa; }
        tfoot td {
            background: #f8fafc;
            border-top: 2px solid #cbd5e1;
            border-bottom: 2px solid #cbd5e1;
            font-size: 10px;
            font-weight: 800;
        }

        .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
        .right { text-align: right; }
        .center { text-align: center; }
        .font-bold { font-weight: 700; }
        .empty { text-align: center; color: #94a3b8; padding: 24px; font-style: italic; }
        .badge-tag {
            background: #ede9fe;
            color: #5b21b6;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;
        }

        /* Signatures block */
        .signatures {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
            margin-top: 36px;
            padding-top: 10px;
        }
        .signature-box {
            text-align: center;
        }
        .signature-line {
            border-top: 1px solid #94a3b8;
            margin-bottom: 4px;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
        }
        .signature-title {
            font-size: 9px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
        }

        .footer-note {
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
            margin-top: 20px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 6px;
        }

        @media print {
            body { background: #ffffff; padding: 0; }
            .page-container { border: none; padding: 0; box-shadow: none; }
            .actions-bar { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="actions-bar">
        <button class="btn btn-secondary" onclick="window.close()">✕ Cerrar</button>
        <button class="btn" onclick="window.print()">🖨️ Imprimir Anexo</button>
    </div>

    <div class="page-container">
        <div class="header">
            <h1 class="company-name">${escHtml(c.company_name || c.company_commercial_name || 'EMPRESA GASOLINERA')}</h1>
            <div class="company-tax">
                ${c.company_nit ? `NIT: ${escHtml(c.company_nit)}` : ''} 
                ${c.company_nrc ? `&nbsp;|&nbsp; NRC: ${escHtml(c.company_nrc)}` : ''}
            </div>
            <div class="branch-info">
                ${escHtml(c.branch_name || 'Sucursal')} ${c.branch_address ? `— ${escHtml(c.branch_address)}` : ''}
            </div>
            <div class="report-title-box">
                <span class="report-title">${escHtml(config.title)}</span>
            </div>
        </div>

        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">Número de Turno</span>
                <span class="meta-value">#${escHtml(c.numero_turno || '—')}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Fecha de Turno</span>
                <span class="meta-value">${escHtml(fecha)}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Cajero / Bombero</span>
                <span class="meta-value">${escHtml(c.vendedor_nombre || '—')}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Estado de Turno</span>
                <span class="meta-value" style="color:#059669;">${escHtml((c.estado || 'CERRADO').toUpperCase())}</span>
            </div>
        </div>

        <table>
            <thead>
                <tr>${theadCols}</tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="${footerColspan}" style="text-align:right;">
                        TOTAL LIQUIDADO (${items.length} REGISTRO${items.length === 1 ? '' : 'S'}):
                    </td>
                    <td class="right mono" style="color:#0f172a; font-size:11px;">
                        ${fmtMoney(totalMonto)}
                    </td>
                </tr>
            </tfoot>
        </table>

        <div class="signatures">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-title">Elaborado por (Cajero / Despachador)</div>
                <div style="font-size:8.5px;color:#64748b;">${escHtml(c.vendedor_nombre || 'Firma')}</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-title">Revisado y Conforme (Administración)</div>
                <div style="font-size:8.5px;color:#64748b;">Firma y Sello</div>
            </div>
        </div>

        <div class="footer-note">
            Emitido el ${escHtml(emision)} | Documento oficial de liquidación de turno | SIPEWEB Gasolinera
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        };
    </script>
</body>
</html>`;
}

export function printCloseoutAnnex(data, annexKey) {
    const html = buildCloseoutAnnexPrintHtml(data, annexKey);
    const win = window.open('', '_blank');
    if (!win) {
        throw new Error('La ventana emergente de impresión fue bloqueada por el navegador');
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
}
