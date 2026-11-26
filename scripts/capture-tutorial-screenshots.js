const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const { spawn } = require('child_process');
const jwt = require('../server/node_modules/jsonwebtoken');
const dotenv = require('../server/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../server/.env') });
const pool = require('../server/src/config/db');

const OUT_DIR = path.join(__dirname, '../client/public/tutorials');
const BOUNDS_OUT = path.join(
    'C:',
    'Users',
    'rauls',
    '.gemini',
    'antigravity',
    'brain',
    'a4aea9af-976e-45f5-8180-c39200499f12',
    'scratch',
    'tutorial-bounds.json'
);

const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const SCREENS_FASE1 = [
    { file: 'pos-terminal-access.png', route: '/ventas/nueva', companyId: 1, minWaitMs: 1200, maxWaitMs: 18000 },
    { file: 'sales-history.png', route: '/ventas', companyId: 1, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'products-list.png', route: '/products', companyId: 1, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'categories-list.png', route: '/categories', companyId: 1, minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'combos-list.png', route: '/ventas/combos', companyId: 1, minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'promotions-list.png', route: '/ventas/promociones', companyId: 1, minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'customer-discounts.png', route: '/ventas/descuentos', companyId: 1, minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'customers-list.png', route: '/customers', companyId: 1, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'cash-closing.png', route: '/ventas/cierre', companyId: 1, minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'sales-remesas.png', route: '/ventas/entrega-remesas', companyId: 1, minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'store-shift-report.png', route: '/ventas/reportes/tienda-turno', companyId: 1, minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'gas-closeout.png', route: '/gas-station/cierre-lecturas', companyId: 1, minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'gas-readings-history.png', route: '/gas-station/historial-lecturas', companyId: 1, minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'fuel-prices.png', route: '/ventas/combustibles', companyId: 1, minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'gas-remesas.png', route: '/gas-station/entrega-remesas', companyId: 1, minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'gas-coupons.png', route: '/gas-station/liquidacion-cupones', companyId: 1, minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'gas-advances.png', route: '/gas-station/anticipos', companyId: 1, minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'gas-trupput.png', route: '/gas-station/trupput', companyId: 1, minWaitMs: 800, maxWaitMs: 12000 }
];

const SCREENS_FASE2 = [
    // Empresa 1: Ventas Eventos MH y Reportes Pista
    { file: 'sales-contingency.png', route: '/ventas/contingencia', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'sales-eret.png', route: '/ventas/retorno', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'sales-shift-dtes.png', route: '/ventas/dtes-turno', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'gas-fuel-sales-report.png', route: '/gas-station/reporte-ventas', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },

    // Empresa 1: Compras, Gastos y Pagos
    { file: 'providers-list.png', route: '/providers', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'purchases-list.png', route: '/compras', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'purchase-period.png', route: '/compras/periodo', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'expenses-list.png', route: '/compras/gastos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'purchase-quedan.png', route: '/compras/quedan', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'purchase-checks.png', route: '/compras/chq-contado', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },

    // Empresa 1: Inventario y Bodega
    { file: 'inventory-transfers.png', route: '/inventario/traslados', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'inventory-adjustments.png', route: '/inventario/movimientos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'physical-inventory.png', route: '/inventario/fisico', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'inventory-kardex.png', route: '/inventario/kardex', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'inventory-stock-report.png', route: '/inventario/reportes/stock', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },

    // Empresa 1: CXC y CXP
    { file: 'cxc-statement.png', route: '/cxc/estado-cuenta', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cxc-payments.png', route: '/cxc/abonos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cxc-balances-report.png', route: '/cxc/reportes/saldos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cxp-statement.png', route: '/cxp/estado-cuenta', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cxp-payments.png', route: '/cxp/abonos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cxp-balances-report.png', route: '/cxp/reportes/saldos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },

    // Empresa 1: Contabilidad e IVA
    { file: 'accounting-chart.png', route: '/contabilidad/cuentas', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'accounting-entries.png', route: '/contabilidad/partidas', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'accounting-generate.png', route: '/contabilidad/contabilizar', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'accounting-audit.png', route: '/contabilidad/auditoria', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'iva-purchases.png', route: '/iva/compras', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'iva-anexos.png', route: '/iva/anexos-iva', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'iva-liquidation.png', route: '/iva/liquidacion', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },

    // Empresa 1: Recursos Humanos
    { file: 'rh-empleados.png', route: '/rh/empleados', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-contratos.png', route: '/rh/contratos-laborales', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-acciones.png', route: '/rh/acciones-personal', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-planillas.png', route: '/rh/planillas', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-vacaciones.png', route: '/rh/planilla-vacaciones', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-reportes.png', route: '/rh/reportes/isss', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },

    // Empresa 1: Control de Pozo, Seguridad y Soporte
    { file: 'pozo-despachos.png', route: '/pozo/despachos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'pozo-corte.png', route: '/pozo/corte', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'pozo-entregas.png', route: '/pozo/entregas-efectivo', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'admin-users.png', route: '/users', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'admin-user-access.png', route: '/user-access', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'admin-roles.png', route: '/roles', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'support-tickets.png', route: '/soporte/tickets', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'keyboard-shortcuts.png', route: '/seguridad/atajos', companyId: 1, minWaitMs: 800, maxWaitMs: 12000 },

    // Empresa 9 (ANDELSA): Marcador Digital, Huevo Industrial y CRM
    { file: 'rh-marcador.png', route: '/rh/marcador-digital', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-planta.png', route: '/industrial/planta', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-recepcion.png', route: '/industrial/recepcion', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-baja-tarimas.png', route: '/industrial/baja-tarimas', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-produccion.png', route: '/industrial/produccion', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-empaque.png', route: '/industrial/empaque', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-trazabilidad.png', route: '/industrial/trazabilidad', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-despachos.png', route: '/industrial/despachos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-inventario.png', route: '/industrial/inventario', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-insumos.png', route: '/industrial/insumos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-costeo.png', route: '/industrial/costeo-libra', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-calendario.png', route: '/industrial/calendario', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-contenedores.png', route: '/industrial/contenedores', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-costos-mantenimiento.png', route: '/industrial/costos-mantenimiento', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-reportes.png', route: '/industrial/reportes', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'egg-configuracion.png', route: '/industrial/configuracion', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'crm-cotizaciones.png', route: '/crm/cotizaciones', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'crm-acuerdos.png', route: '/crm/acuerdos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'crm-config.png', route: '/crm/configuracion', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000 },

    // Empresa 1: Dashboards, Sistema, Reglas Descuento, Catálogos Gasolinera, Contabilidad/Cierre, RRHH Prestaciones, Pozo, Seguridad/Config/IA
    { file: 'dashboard-main.png', route: '/dashboard', companyId: 1, minWaitMs: 1200, maxWaitMs: 30000, waitForText: 'Dashboard General' },
    { file: 'dashboard-energy.png', route: '/dashboard?tab=energy', companyId: 1, minWaitMs: 1200, maxWaitMs: 16000 },
    { file: 'sys-companies.png', route: '/companies', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'sys-branches.png', route: '/branches', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'sys-pos.png', route: '/pos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'sys-sellers.png', route: '/sellers', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'discount-rules.png', route: '/ventas/reglas-descuento', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'gas-nozzles.png', route: '/gas-station/nozzles', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'gas-tanks.png', route: '/gas-station/tanks', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'gas-attendant-nozzles.png', route: '/gas-station/despachador-nozzles', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'gas-orders.png', route: '/gas-station/pedidos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-correlativos.png', route: '/contabilidad/correlativos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-ajustes.png', route: '/contabilidad/ajustes', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-balance-general.png', route: '/contabilidad/reportes/balance-general', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-cierre-anual.png', route: '/contabilidad/cierre', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-aguinaldos.png', route: '/rh/aguinaldos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-quincena25.png', route: '/rh/quincena25', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-liquidaciones.png', route: '/rh/liquidaciones', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'rh-honorarios.png', route: '/rh/honorarios', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'pozo-servicios.png', route: '/pozo/servicios', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'sec-bitacora.png', route: '/seguridad/bitacora', companyId: 1, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'cfg-sistema.png', route: '/configuracion/sistema', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cfg-modulos-empresa.png', route: '/configuracion/modulos-empresa', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'cfg-servidor.png', route: '/configuracion/servidor', companyId: 1, minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'ai-tasks.png', route: '/ai-tasks', companyId: 1, minWaitMs: 1000, maxWaitMs: 15000 },

    // Empresa 9 (ANDELSA): Dashboard Planta y sub-vistas Huevo Industrial
    { file: 'dashboard-andelsa.png', route: '/dashboard?tab=andelsa', companyId: 9, minWaitMs: 1200, maxWaitMs: 30000, waitForText: 'Dashboard Andelsa' },
    { file: 'egg-produccion-cip.png', route: '/industrial/produccion', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Sanitización' },
    { file: 'egg-trazabilidad-lab.png', route: '/industrial/trazabilidad', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'LAB-004' },
    { file: 'egg-trazabilidad-normas.png', route: '/industrial/trazabilidad', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Normas COA' },
    { file: 'egg-trazabilidad-solidos.png', route: '/industrial/trazabilidad', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Sólidos' },
    { file: 'egg-despachos-rutas.png', route: '/industrial/despachos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Planificador' },
    { file: 'egg-despachos-flota.png', route: '/industrial/despachos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Flota' },
    { file: 'egg-despachos-motorista.png', route: '/industrial/despachos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Motorista' },
    { file: 'egg-insumos-kardex.png', route: '/industrial/insumos', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Kárdex' },
    { file: 'egg-costeo-margen.png', route: '/industrial/costeo-libra', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Margen Libre' },
    { file: 'egg-costeo-escenarios.png', route: '/industrial/costeo-libra', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Escenarios' },
    { file: 'egg-costos-cubetas.png', route: '/industrial/costos-mantenimiento', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Envases Retornables' },
    { file: 'egg-config-prefijos.png', route: '/industrial/configuracion', companyId: 9, minWaitMs: 1000, maxWaitMs: 15000, clickButtonText: 'Prefijos' },

    // Empresa 1: Contabilidad completa (Contabilizar, Apertura, Libros, Estados Financieros, Retenciones) e IVA completo
    { file: 'acc-contabilizar-cxc-cxp.png', route: '/contabilidad/contabilizar/cxc-cxp', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-contabilizar-turnos.png', route: '/contabilidad/contabilizar/turnos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-contabilizar-bancos.png', route: '/contabilidad/contabilizar/bancos', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-apertura-anio.png', route: '/contabilidad/apertura', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-libro-diario.png', route: '/contabilidad/reportes/libro-diario', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-libro-mayor.png', route: '/contabilidad/reportes/libro-mayor', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-auxiliar-operaciones.png', route: '/contabilidad/reportes/auxiliar-operaciones', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-listado-partidas.png', route: '/contabilidad/reportes/listado-partidas', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-impresion-partidas.png', route: '/contabilidad/reportes/impresion-partidas', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-balance-comprobacion.png', route: '/contabilidad/reportes/balance-comprobacion', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-estado-resultados.png', route: '/contabilidad/reportes/estado-resultados', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-balance-comparativo.png', route: '/contabilidad/reportes/balance-comparativo', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-cambios-patrimonio.png', route: '/contabilidad/reportes/cambios-patrimonio', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-flujo-efectivo.png', route: '/contabilidad/reportes/flujo-efectivo', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-cedula-auditoria.png', route: '/contabilidad/reportes/cedula-auditoria', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'acc-retenciones.png', route: '/contabilidad/reportes/retenciones', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'iva-ventas-ccf.png', route: '/iva/ventas-ccf', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'iva-ventas-fac.png', route: '/iva/ventas-fac', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 },
    { file: 'iva-declaraciones.png', route: '/iva/declaraciones', companyId: 1, minWaitMs: 900, maxWaitMs: 14000 }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function checkUrl(url) {
    return new Promise((resolve) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { rejectUnauthorized: false, timeout: 1500 }, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function waitForUrl(url, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (await checkUrl(url)) return true;
        await sleep(500);
    }
    throw new Error(`Timeout esperando a ${url}`);
}

async function waitForViteUrl(maxWaitMs = 35000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (await checkUrl('https://127.0.0.1:3000')) return 'https://127.0.0.1:3000';
        if (await checkUrl('http://127.0.0.1:3000')) return 'http://127.0.0.1:3000';
        await sleep(500);
    }
    throw new Error('Timeout esperando a Vite en :3000');
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

class CdpClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.id = 1;
        this.pending = new Map();
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.addEventListener('open', () => resolve());
            this.ws.addEventListener('error', (err) => reject(err));
            this.ws.addEventListener('message', (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id && this.pending.has(msg.id)) {
                    const { res, rej } = this.pending.get(msg.id);
                    this.pending.delete(msg.id);
                    if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
                    else res(msg.result);
                }
            });
        });
    }
    send(method, params = {}) {
        const msgId = this.id++;
        return new Promise((res, rej) => {
            this.pending.set(msgId, { res, rej });
            this.ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }
    close() {
        try { this.ws.close(); } catch { /* ignore */ }
    }
}

async function waitForPageReady(cdp, minWaitMs = 900, maxWaitMs = 15000, waitForText = '') {
    await sleep(minWaitMs);
    const start = Date.now();
    let lastMeta = { href: '', len: 0, loading: true, hasText: false };
    while (Date.now() - start < maxWaitMs) {
        const res = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
                const txt = (document.body?.innerText || '').trim();
                const loading = txt.includes('Cargando registros') || txt.includes('Cargando...') || txt.includes('Cargando historial') || txt.includes('Actualizando...') || txt.includes('Cargando bitácora') || txt.includes('Cargando cheques');
                const requiredText = ${JSON.stringify(waitForText || '')};
                const hasText = !requiredText || txt.includes(requiredText);
                return JSON.stringify({ href: location.href, len: txt.length, loading, hasText });
            })()`
        });
        lastMeta = JSON.parse(res.result?.value || '{}');
        if (!lastMeta.loading && lastMeta.len > 100 && lastMeta.hasText) {
            await sleep(500);
            return lastMeta;
        }
        await sleep(450);
    }
    return lastMeta;
}

async function prepareCleanUiAndCollectBounds(cdp) {
    const res = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
            if (!document.getElementById('sipe-tut-clean')) {
                const style = document.createElement('style');
                style.id = 'sipe-tut-clean';
                style.textContent = '[data-sonner-toaster], .sonner-toast, ol[data-sonner-toaster] { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
                document.head.appendChild(style);
            }
            const vw = 1480;
            const vh = 880;
            const items = [];
            const seen = new Set();
            const els = document.querySelectorAll('h1, h2, h3, button, a, input, textarea, select, table, thead, [role="tab"]');
            for (const el of els) {
                const r = el.getBoundingClientRect();
                if (r.width < 12 || r.height < 10) continue;
                if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
                if (r.left < 180 && r.top > 70 && el.tagName === 'A') continue; // omitir links del sidebar izquierdo
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
                const rawText = (el.innerText || el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('title') || '').replace(/\\s+/g, ' ').trim();
                const text = rawText.slice(0, 70);
                if (!text && el.tagName !== 'TABLE' && el.tagName !== 'THEAD' && el.tagName !== 'SELECT') continue;
                const x = Math.round((Math.max(0, r.left) / vw) * 1000) / 10;
                const y = Math.round((Math.max(0, r.top) / vh) * 1000) / 10;
                const w = Math.round((Math.min(vw, r.right) - Math.max(0, r.left)) / vw * 1000) / 10;
                const h = Math.round((Math.min(vh, r.bottom) - Math.max(0, r.top)) / vh * 1000) / 10;
                const key = el.tagName + '|' + text + '|' + x + '|' + y;
                if (seen.has(key)) continue;
                seen.add(key);
                items.push({ tag: el.tagName.toLowerCase(), text, x, y, w, h });
                if (items.length >= 45) break;
            }
            return JSON.stringify(items);
        })()`
    });
    await sleep(120);
    try {
        return JSON.parse(res.result?.value || '[]');
    } catch {
        return [];
    }
}

async function buildCaptureContext(companyId = 1) {
    const [users] = await pool.query("SELECT id, username, nombre, email FROM users WHERE username = 'raul' LIMIT 1");
    const userRow = users[0] || { id: 1, username: 'admin', nombre: 'Administrador', email: 'admin@sipesv.com' };
    const [compRows] = await pool.query('SELECT id, razon_social, enabled_modules FROM companies WHERE id = ? LIMIT 1', [companyId]);
    const [brRows] = await pool.query('SELECT id, nombre FROM branches WHERE company_id = ? ORDER BY id ASC LIMIT 1', [companyId]);
    const [roleRows] = await pool.query('SELECT permissions FROM roles WHERE id = 1 LIMIT 1');

    const company = compRows[0] || {
        id: companyId,
        razon_social: companyId === 9 ? 'ANDELSA, S.A. DE C.V.' : 'Inversiones Lil, S.A. de C.V.',
        enabled_modules: ['sales', 'purchases', 'inventory', 'gas_station', 'accounting', 'human_resources', 'pozo']
    };
    const branch = brRows[0] || { id: companyId === 9 ? 5 : 1, nombre: companyId === 9 ? 'Sede Central' : 'Puma San Martin II' };

    let perms = [];
    try {
        perms = typeof roleRows[0]?.permissions === 'string'
            ? JSON.parse(roleRows[0].permissions)
            : (roleRows[0]?.permissions || []);
    } catch { perms = []; }

    const enabledModules = Array.isArray(company.enabled_modules)
        ? company.enabled_modules
        : (typeof company.enabled_modules === 'string'
            ? JSON.parse(company.enabled_modules)
            : ['sales', 'purchases', 'inventory', 'gas_station', 'accounting', 'human_resources', 'pozo']);

    const token = jwt.sign(
        { id: userRow.id, username: userRow.username, company_id: company.id, branch_id: branch.id, role: 'SuperAdmin' },
        process.env.JWT_SECRET,
        { expiresIn: '20m' }
    );

    const userObj = {
        id: userRow.id,
        username: userRow.username,
        nombre: userRow.nombre,
        email: userRow.email,
        role: 'SuperAdmin',
        permissions: perms,
        default_dashboard: companyId === 9 ? 'andelsa' : 'general',
        enabled_modules: enabledModules,
        company_id: company.id,
        branch_id: branch.id,
        company_name: company.razon_social,
        branch_name: branch.nombre
    };

    const [openShifts] = await pool.query(
        `SELECT sh.id as shift_id, sh.pos_id, sh.seller_id, s.nombre as seller_name, pos.nombre as pos_name
         FROM pos_shifts sh
         JOIN sellers s ON sh.seller_id = s.id
         LEFT JOIN points_of_sale pos ON sh.pos_id = pos.id
         WHERE sh.company_id = ? AND sh.branch_id = ? AND sh.status = 'open'
         ORDER BY sh.id DESC LIMIT 1`,
        [company.id, branch.id]
    );
    const [sellers] = await pool.query(
        "SELECT id, nombre, pos_id, branch_id FROM sellers WHERE company_id = ? AND branch_id = ? AND status = 'activo' LIMIT 1",
        [company.id, branch.id]
    );
    const [posRows] = await pool.query(
        'SELECT id, nombre FROM points_of_sale WHERE company_id = ? AND branch_id = ? LIMIT 1',
        [company.id, branch.id]
    );
    const [prodRows] = await pool.query(
        "SELECT id, codigo, nombre FROM products WHERE company_id = ? AND status = 'activo' LIMIT 1",
        [company.id]
    );
    const [gasCloseRows] = await pool.query(
        'SELECT id FROM gas_station_closeouts WHERE company_id = ? AND branch_id = ? ORDER BY id DESC LIMIT 1',
        [company.id, branch.id]
    );

    const openSh = openShifts[0] || null;
    const seller = sellers[0] || { id: 1, nombre: 'Vendedor Tienda', pos_id: posRows[0]?.id || 1, branch_id: branch.id };
    const pos = posRows[0] || { id: seller.pos_id || 1, nombre: 'TIENDA 1' };
    const prod = prodRows[0] || { id: 1, codigo: 'PROD-01', nombre: 'Producto Demo' };

    return {
        token,
        userObj,
        sellerSession: {
            seller_id: openSh ? openSh.seller_id : seller.id,
            seller_name: openSh ? openSh.seller_name : seller.nombre,
            branch_id: branch.id,
            branch_name: branch.nombre,
            pos_id: openSh ? openSh.pos_id : (seller.pos_id || pos.id),
            pos_name: openSh ? openSh.pos_name : pos.nombre
        },
        posDraft: {
            cart: [{
                product_id: prod.id,
                codigo: prod.codigo || 'PROD-01',
                nombre: prod.nombre,
                descripcion: prod.nombre,
                cantidad: 2,
                precio_unitario: 2.50,
                precio: 2.50,
                monto_descuento: 0,
                es_exento: false
            }],
            tipoDte: '01',
            condicionPago: '1'
        },
        latestCloseoutId: gasCloseRows[0]?.id || null
    };
}

function killTree(pid) {
    if (!pid) return;
    try { require('child_process').execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch { /* ignore */ }
}

async function applyAuthContext(cdp, ctx) {
    await cdp.send('Runtime.evaluate', {
        expression: `
            localStorage.setItem('token', ${JSON.stringify(ctx.token)});
            localStorage.setItem('user', ${JSON.stringify(JSON.stringify(ctx.userObj))});
            localStorage.setItem('sidebar-collapsed', 'false');
            'OK';
        `
    });
}

function parseOnlyPrefixes(argv) {
    const arg = argv.find(a => a.startsWith('--only='));
    if (!arg) return null;
    return arg.slice('--only='.length).split(',').map(s => s.trim()).filter(Boolean);
}

async function setReactInputValue(cdp, selector, value) {
    await cdp.send('Runtime.evaluate', {
        expression: `(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return 'NOT_FOUND';
            el.focus();
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, ${JSON.stringify(value)});
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return 'OK';
        })()`
    });
}

async function captureCtrlKAndTicketModals(cdp, clientBaseUrl, boundsMap) {
    await cdp.send('Page.navigate', { url: `${clientBaseUrl}/ventas` });
    await waitForPageReady(cdp, 1300, 15000);

    // Abrir CommandPalette con Ctrl+K (o botón Buscar menú)
    await cdp.send('Runtime.evaluate', {
        expression: `(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b =>
                (b.title || b.innerText || '').includes('Ctrl+K')
            );
            if (btn) btn.click();
            else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
            return 'OPENED';
        })()`
    });
    await sleep(450);

    // 1) CommandPalette buscando pantallas ("ventas")
    await setReactInputValue(cdp, 'div[data-ticket-modal="true"] input', 'ventas');
    await sleep(450);
    boundsMap['command-palette-search.png'] = {
        route: '/ventas (Ctrl+K search)',
        companyId: 1,
        bounds: await prepareCleanUiAndCollectBounds(cdp)
    };
    const s1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'command-palette-search.png'), Buffer.from(s1.data, 'base64'));
    console.log(`📸 command-palette-search.png (${(fs.statSync(path.join(OUT_DIR, 'command-palette-search.png')).size / 1024).toFixed(1)} KB)`);

    // 2) CommandPalette en modo Calculadora IVA ("125*4")
    await setReactInputValue(cdp, 'div[data-ticket-modal="true"] input', '125*4');
    await sleep(450);
    boundsMap['command-palette-calc.png'] = {
        route: '/ventas (Ctrl+K calc)',
        companyId: 1,
        bounds: await prepareCleanUiAndCollectBounds(cdp)
    };
    const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'command-palette-calc.png'), Buffer.from(s2.data, 'base64'));
    console.log(`📸 command-palette-calc.png (${(fs.statSync(path.join(OUT_DIR, 'command-palette-calc.png')).size / 1024).toFixed(1)} KB)`);

    // 3) CommandPalette creando ticket rápido ("ticket: error al imprimir factura")
    await setReactInputValue(cdp, 'div[data-ticket-modal="true"] input', 'ticket: error al imprimir factura');
    await sleep(450);
    boundsMap['command-palette-ticket.png'] = {
        route: '/ventas (Ctrl+K ticket)',
        companyId: 1,
        bounds: await prepareCleanUiAndCollectBounds(cdp)
    };
    const s3 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'command-palette-ticket.png'), Buffer.from(s3.data, 'base64'));
    console.log(`📸 command-palette-ticket.png (${(fs.statSync(path.join(OUT_DIR, 'command-palette-ticket.png')).size / 1024).toFixed(1)} KB)`);

    // 4) Abrir QuickTicketModal disparando el acceso directo del CommandPalette (captura pantalla automática)
    await cdp.send('Runtime.evaluate', {
        expression: `(() => {
            const btn = document.querySelector('div[data-ticket-modal="true"] button[data-index="0"]');
            if (btn) btn.click();
            else {
                const topBtn = Array.from(document.querySelectorAll('button')).find(b => (b.title || '').includes('Ticket'));
                if (topBtn) topBtn.click();
            }
            return 'TRIGGERED';
        })()`
    });

    // Esperar a que QuickTicketModal complete html2canvas y muestre el modal (y su miniatura si aplica)
    const startTicket = Date.now();
    while (Date.now() - startTicket < 4500) {
        const res = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
                const txt = document.body?.innerText || '';
                const hasModal = txt.includes('Centro Inteligente de Tickets');
                const hasThumb = Boolean(document.querySelector('img[alt^="Captura"]'));
                return JSON.stringify({ hasModal, hasThumb });
            })()`
        });
        const st = JSON.parse(res.result?.value || '{}');
        if (st.hasModal && st.hasThumb) break;
        await sleep(250);
    }
    await sleep(350);

    boundsMap['quick-ticket-modal.png'] = {
        route: '/ventas (QuickTicketModal)',
        companyId: 1,
        bounds: await prepareCleanUiAndCollectBounds(cdp)
    };
    const s4 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, 'quick-ticket-modal.png'), Buffer.from(s4.data, 'base64'));
    console.log(`📸 quick-ticket-modal.png (${(fs.statSync(path.join(OUT_DIR, 'quick-ticket-modal.png')).size / 1024).toFixed(1)} KB)`);
}

async function run() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(BOUNDS_OUT), { recursive: true });

    const chromeExe = CHROME_PATHS.find(p => fs.existsSync(p));
    if (!chromeExe) throw new Error('No se encontró Chrome/Edge instalado.');

    const onlyPos = process.argv.includes('--only-pos');
    const onlyCtrlKTicket = process.argv.includes('--only-ctrlk-ticket');
    const isPhase2 = process.argv.includes('--phase2');
    const onlyPrefixes = parseOnlyPrefixes(process.argv);

    let screensToCapture = isPhase2 ? [...SCREENS_FASE2] : [...SCREENS_FASE1, ...SCREENS_FASE2];
    if (onlyCtrlKTicket) {
        screensToCapture = [];
    } else if (onlyPrefixes && onlyPrefixes.length > 0) {
        screensToCapture = [...SCREENS_FASE1, ...SCREENS_FASE2].filter(s =>
            onlyPrefixes.some(pref => s.file.startsWith(pref))
        );
    }

    let serverProc = null;
    let clientProc = null;
    let chromeProc = null;
    const tempUserDir = path.join(os.tmpdir(), `sipe-tut-chrome-${Date.now()}`);
    const boundsMap = fs.existsSync(BOUNDS_OUT)
        ? (() => { try { return JSON.parse(fs.readFileSync(BOUNDS_OUT, 'utf8')); } catch { return {}; } })()
        : {};

    try {
        if (!(await checkUrl('http://127.0.0.1:4000/api/health'))) {
            console.log('Iniciando backend temporal en :4000...');
            serverProc = spawn('node', ['src/index.js'], { cwd: path.join(__dirname, '../server'), stdio: 'ignore' });
            await waitForUrl('http://127.0.0.1:4000/api/health', 45000);
        }

        let clientBaseUrl = null;
        if (await checkUrl('https://127.0.0.1:3000')) clientBaseUrl = 'https://127.0.0.1:3000';
        else if (await checkUrl('http://127.0.0.1:3000')) clientBaseUrl = 'http://127.0.0.1:3000';
        if (!clientBaseUrl) {
            console.log('Iniciando frontend Vite temporal en :3000...');
            clientProc = spawn('cmd.exe', ['/c', 'npx', 'vite', '--host', '127.0.0.1', '--port', '3000'], { cwd: path.join(__dirname, '../client'), stdio: 'ignore' });
            clientBaseUrl = await waitForViteUrl(45000);
        }

        const ctx1 = await buildCaptureContext(1);
        const ctx9 = await buildCaptureContext(9);
        const ctxByCompany = { 1: ctx1, 9: ctx9 };

        const debugPort = 9225;
        chromeProc = spawn(chromeExe, [
            '--headless=new', '--disable-gpu', '--ignore-certificate-errors',
            '--no-first-run', '--no-default-browser-check', '--window-size=1480,880',
            `--remote-debugging-port=${debugPort}`, `--user-data-dir=${tempUserDir}`,
            `${clientBaseUrl}/login`
        ], { stdio: 'ignore' });

        await waitForUrl(`http://127.0.0.1:${debugPort}/json/list`, 15000);
        const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
        await cdp.connect();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1480, height: 880, deviceScaleFactor: 1, mobile: false });

        await waitForPageReady(cdp, 1200, 15000);
        let activeCompanyId = 1;
        await applyAuthContext(cdp, ctx1);

        if (!onlyPos && !onlyCtrlKTicket) {
            for (const scr of screensToCapture) {
                const targetCompany = scr.companyId || 1;
                if (targetCompany !== activeCompanyId) {
                    activeCompanyId = targetCompany;
                    await applyAuthContext(cdp, ctxByCompany[activeCompanyId]);
                }

                await cdp.send('Page.navigate', { url: `${clientBaseUrl}${scr.route}` });
                const meta = await waitForPageReady(cdp, scr.minWaitMs, scr.maxWaitMs, scr.waitForText || '');
                if (scr.clickButtonText) {
                    const clickRes = await cdp.send('Runtime.evaluate', {
                        expression: `(() => {
                            const needle = ${JSON.stringify(scr.clickButtonText)}.toLowerCase();
                            const btns = Array.from(document.querySelectorAll('button, [role="tab"]'))
                                .filter(b => !b.closest('aside, header') && b.offsetParent !== null && (b.innerText || b.textContent || '').toLowerCase().includes(needle));
                            if (btns.length > 0) {
                                btns[0].click();
                                return 'CLICKED:' + (btns[0].innerText || '').replace(/\\s+/g, ' ').trim();
                            }
                            return 'NOT_FOUND:' + needle;
                        })()`
                    });
                    console.log(`   ↳ Tab [${scr.file}]: ${clickRes.result?.value}`);
                    await waitForPageReady(cdp, 950, 14000, scr.postClickWaitForText || '');
                }
                const bounds = await prepareCleanUiAndCollectBounds(cdp);
                const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                const outPath = path.join(OUT_DIR, scr.file);
                fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
                boundsMap[scr.file] = { route: scr.route, companyId: activeCompanyId, href: meta.href, bounds };
                console.log(`📸 ${scr.file} [C${activeCompanyId}] (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) -> ${meta.href}`);
                if (String(meta.href).includes('/login')) throw new Error(`Ruta ${scr.route} redirigió a /login`);
            }
        }

        if (onlyCtrlKTicket || isPhase2 || !onlyPos && !onlyPrefixes) {
            if (activeCompanyId !== 1) {
                activeCompanyId = 1;
                await applyAuthContext(cdp, ctx1);
            }
            await captureCtrlKAndTicketModals(cdp, clientBaseUrl, boundsMap);
        }

        // Capturar terminal POS activo limpio (sin toast Sonner)
        const shouldCapturePos = onlyPos
            || (!onlyCtrlKTicket && isPhase2)
            || (!onlyCtrlKTicket && !onlyPrefixes)
            || (onlyPrefixes && onlyPrefixes.some(p => 'pos-terminal.png'.startsWith(p)));

        if (shouldCapturePos) {
            if (activeCompanyId !== 1) {
                activeCompanyId = 1;
                await applyAuthContext(cdp, ctx1);
            }
            const sellerKey = `sipe_pos_seller_session_${ctx1.userObj.id}_${ctx1.userObj.company_id}_${ctx1.userObj.branch_id}`;
            const draftKey = `sipe_pos_sale_draft_${ctx1.userObj.id}_${ctx1.userObj.company_id}_${ctx1.userObj.branch_id}`;
            await cdp.send('Runtime.evaluate', {
                expression: `
                    sessionStorage.setItem(${JSON.stringify(sellerKey)}, ${JSON.stringify(JSON.stringify(ctx1.sellerSession))});
                    localStorage.setItem(${JSON.stringify(draftKey)}, ${JSON.stringify(JSON.stringify(ctx1.posDraft))});
                    'OK';
                `
            });
            await cdp.send('Page.navigate', { url: `${clientBaseUrl}/ventas/nueva` });
            const metaPos = await waitForPageReady(cdp, 2200, 16000);
            const boundsPos = await prepareCleanUiAndCollectBounds(cdp);
            const posShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
            const posPath = path.join(OUT_DIR, 'pos-terminal.png');
            fs.writeFileSync(posPath, Buffer.from(posShot.data, 'base64'));
            boundsMap['pos-terminal.png'] = { route: '/ventas/nueva', companyId: 1, href: metaPos.href, bounds: boundsPos };
            console.log(`📸 pos-terminal.png (${(fs.statSync(posPath).size / 1024).toFixed(1)} KB)`);
        }

        if (!onlyPos && !onlyCtrlKTicket && !isPhase2 && !onlyPrefixes && ctx1.latestCloseoutId) {
            if (activeCompanyId !== 1) {
                activeCompanyId = 1;
                await applyAuthContext(cdp, ctx1);
            }
            await cdp.send('Page.navigate', { url: `${clientBaseUrl}/gas-station/cierre-lecturas?editId=${ctx1.latestCloseoutId}` });
            const metaSheet = await waitForPageReady(cdp, 1800, 15000);
            const boundsSheet = await prepareCleanUiAndCollectBounds(cdp);
            const sheetShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
            const sheetPath = path.join(OUT_DIR, 'gas-closeout-sheet.png');
            fs.writeFileSync(sheetPath, Buffer.from(sheetShot.data, 'base64'));
            boundsMap['gas-closeout-sheet.png'] = { route: '/gas-station/cierre-lecturas', companyId: 1, href: metaSheet.href, bounds: boundsSheet };
            console.log(`📸 gas-closeout-sheet.png (${(fs.statSync(sheetPath).size / 1024).toFixed(1)} KB)`);
        }

        fs.writeFileSync(BOUNDS_OUT, JSON.stringify(boundsMap, null, 2));
        cdp.close();
        console.log(`✅ Capturas y telemetría DOM completadas (${BOUNDS_OUT}).`);
    } finally {
        if (chromeProc) killTree(chromeProc.pid);
        if (clientProc) killTree(clientProc.pid);
        if (serverProc) killTree(serverProc.pid);
        try { fs.rmSync(tempUserDir, { recursive: true, force: true }); } catch { /* ignore */ }
        await pool.end().catch(() => {});
    }
}

run().catch((err) => {
    console.error('❌ Error capturando pantallas:', err);
    process.exit(1);
});
