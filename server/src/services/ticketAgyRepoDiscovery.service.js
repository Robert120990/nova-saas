const fs = require('fs');
const path = require('path');

const ADMIN_CANDIDATE_PATHS = [
    process.env.AGY_ADMIN_PROJECT_PATH, '/var/www/sipeadmin', '/home/sistemas/sipeadmin',
    '/home/rsboosted/sipeadmin', '/home/rsboosted/OFICINA SIPE',
    '/home/sistemas/OFICINA SIPE', '/opt/sipeadmin', '/home/sistemas/SIPEOFI', '/opt/SIPEOFI',
    path.resolve(process.cwd(), '../../OFICINA SIPE'), path.resolve(process.cwd(), '../OFICINA SIPE'),
    path.resolve(process.cwd(), '../../SIPEOFI'), path.resolve(process.cwd(), '../SIPEOFI'),
    'c:/Proyectos IA/OFICINA SIPE', 'c:/Proyects local/SIPEOFI'
].filter(Boolean);

const SAAS_CANDIDATE_PATHS = [
    process.env.AGY_PROJECT_PATH, path.resolve(__dirname, '../../..'), process.cwd(), path.resolve(process.cwd(), '..'),
    '/home/rsboosted/SIPEWEBgas', '/opt/nova-saas', '/var/www/SIPEWEBgas', '/home/sistemas/SIPEWEBgas', 'c:/Proyects local/SIPEWEBgas'
].filter(Boolean);

function isTicketFromAdminProject(ticket = {}) {
    const code = String(ticket.ticket_code || '').toUpperCase();
    const source = String(ticket.source_system || '').toLowerCase();
    const mod = String(ticket.module_name || '').toLowerCase();
    const url = String(ticket.page_url || '').toLowerCase();
    if (source.includes('sys.sipesv.com') || code.startsWith('TKT-')) {
        return false;
    }
    return code.startsWith('ADM-') || source.includes('admin.sipesv.com') || mod.includes('sipe admin') || mod.includes('(admin)') || url.startsWith('/dashboard/');
}

function resolveProjectForTicket(ticket = {}, settings = {}) {
    if (isTicketFromAdminProject(ticket)) {
        const foundAdmin = ADMIN_CANDIDATE_PATHS.find((c) => {
            try { return fs.existsSync(c) && (fs.existsSync(path.join(c, 'frontend')) || fs.existsSync(path.join(c, 'backend'))); } catch { return false; }
        });
        return {
            isAdmin: true, projectCode: 'ADM', projectLabel: 'admin.sipesv.com (SIPE Admin)',
            projectPath: foundAdmin || process.env.AGY_ADMIN_PROJECT_PATH || '/var/www/sipeadmin',
            frontendDir: 'frontend', backendDir: 'backend', pm2AppName: 'sipeadmin-backend'
        };
    }
    const configured = settings?.project_path;
    const foundSaas = [configured, ...SAAS_CANDIDATE_PATHS].filter(Boolean).find((c) => {
        try { return fs.existsSync(c) && fs.existsSync(path.join(c, 'client')); } catch { return false; }
    });
    return {
        isAdmin: false, projectCode: 'TKT', projectLabel: 'sys.sipesv.com (SIPE SaaS)',
        projectPath: foundSaas || configured || '/opt/nova-saas',
        frontendDir: 'client', backendDir: 'server', pm2AppName: 'nova-saas-api'
    };
}

const KNOWN_SAAS_ROUTE_FILES = {
    '/dashboard': ['client/src/components/energy/EnergyFlowDiagram.jsx', 'client/src/components/energy/EnergyBatteryStatus.jsx', 'client/src/components/energy/EnergySummaryCards.jsx', 'client/src/pages/energy/SistemaEnergetico.jsx', 'server/src/services/energySystem.service.js', 'client/src/pages/Dashboard.jsx'],
    '/energia': ['client/src/pages/energy/SistemaEnergetico.jsx', 'client/src/components/energy/EnergyFlowDiagram.jsx', 'client/src/components/energy/EnergyBatteryStatus.jsx', 'client/src/components/energy/EnergySummaryCards.jsx', 'client/src/components/energy/EnergyInvertersTable.jsx', 'server/src/services/energySystem.service.js'],
    '/branches': ['server/src/controllers/branch.controller.js', 'server/src/schemas/companySchemas.js', 'client/src/pages/Branches.jsx', 'client/src/components/branches/BranchModal.jsx'],
    '/ventas': ['server/src/schemas/salesSchemas.js', 'server/src/controllers/sales/salesEditDteItems.controller.js', 'server/src/controllers/sales/salesDte.controller.js', 'client/src/pages/SalesHistory.jsx', 'client/src/pages/SalesTerminal.jsx'],
    '/ventas/nueva': ['client/src/pages/SalesTerminal.jsx', 'server/src/controllers/sales/salesCore.controller.js', 'server/src/schemas/salesSchemas.js'],
    '/industrial/empaque': ['client/src/components/egg/packaging/EggNewPackagingModal.jsx', 'client/src/components/egg/packaging/PackagingItemsSection.jsx', 'client/src/components/egg/packaging/EggEditPackagingModal.jsx', 'client/src/constants/eggIndustrialCatalogs.js', 'client/src/pages/EggIndustrial/Packaging.jsx'],
    '/industrial/produccion': ['client/src/components/egg/production/ProductionIsNewBatchModalOpenModal.jsx', 'client/src/constants/eggIndustrialCatalogs.js', 'client/src/pages/EggIndustrial/Production.jsx', 'server/src/controllers/eggIndustrial/eggBatches/eggBatchesCore.controller.js'],
    '/industrial/calendario': ['client/src/components/egg/EggCustomerOrderModal.jsx', 'client/src/components/egg/productionCalendar/eggCalendarConstants.js', 'client/src/components/egg/productionCalendar/useProductionCalendarModel.jsx', 'client/src/pages/EggIndustrial/ProductionCalendar.jsx', 'server/src/controllers/eggIndustrial/eggPlanning/eggPlanningOperations5.controller.js'],
    '/industrial/despachos': ['client/src/components/egg/EggCustomerOrderModal.jsx', 'client/src/components/egg/RouteAutoInvoicingModal.jsx', 'client/src/components/egg/eggDispatch/tabs/EggDispatchCalendarioTab.jsx', 'client/src/components/egg/eggDispatch/tabs/EggDispatchRutasTab.jsx', 'client/src/pages/EggIndustrial/EggDispatch.jsx'],
    '/ventas/descuentos': ['client/src/pages/CustomerDiscounts.jsx', 'client/src/components/sales/CustomerDiscountModal.jsx', 'server/src/controllers/customerDiscount.controller.js', 'server/src/schemas/promoSchemas.js'],
    '/inventario/movimientos': ['client/src/pages/InventoryAdjustments.jsx', 'client/src/components/inventory/tabs/NewAdjustmentTab.jsx', 'server/src/controllers/inventoryAdjustment/inventoryAdjustmentCore.controller.js']
};

const KNOWN_ADMIN_ROUTE_FILES = {
    '/dashboard/operaciones/pedidos': ['frontend/src/pages/PedidosCombustible.jsx', 'backend/routes/operaciones.js'],
    '/dashboard/operaciones/pedidos-programados': ['frontend/src/pages/PedidosProgramadosConsulta.jsx', 'backend/routes/operaciones.js'],
    '/dashboard/operaciones/tareas': ['frontend/src/pages/Tareas.jsx', 'backend/routes/tasks.js'],
    '/dashboard/operaciones/recordatorios': ['frontend/src/pages/ControlRecordatorios.jsx', 'backend/routes/operaciones.js'],
    '/dashboard/operaciones/energia-solar': ['frontend/src/pages/EnergiaSolarAndelsa.jsx', 'backend/routes/ai.js', 'backend/services/solarEnergyService.js'],
    '/dashboard/consultas/estaciones/ventas': ['frontend/src/pages/VentasEstaciones.jsx', 'backend/routes/consultas.js', 'backend/services/fuelIntelligence.js'],
    '/dashboard/consultas/estaciones/resumen-cierre': ['frontend/src/pages/ResumenPista.jsx', 'backend/routes/consultas.js'],
    '/dashboard/consultas/estaciones/diferencias-combustible': ['frontend/src/pages/DiferenciasCombustible.jsx', 'backend/routes/consultas.js'],
    '/dashboard/consultas/estaciones/precios': ['frontend/src/pages/PreciosEstacion.jsx', 'backend/routes/consultas.js'],
    '/dashboard/consultas/estaciones/precios-competencia': ['frontend/src/pages/ConsultasPreciosCompetencia.jsx', 'backend/routes/consultasCompetenciaRoutes.js', 'backend/services/dgehmService.js'],
    '/dashboard/consultas/estaciones/lubricantes': ['frontend/src/pages/Lubricantes.jsx', 'backend/routes/consultas.js'],
    '/dashboard/bancos/conciliacion': ['frontend/src/pages/ConciliacionBancaria.jsx', 'backend/routes/bancos.js'],
    '/dashboard/bancos/movimientos': ['frontend/src/pages/MovimientosBancarios.jsx', 'backend/routes/bancos.js'],
    '/dashboard/bancos/cheques': ['frontend/src/pages/Cheques.jsx', 'backend/routes/cheques.js'],
    '/dashboard/bancos/cheques-contado': ['frontend/src/pages/ChequesContado.jsx', 'backend/routes/cheques.js'],
    '/dashboard/bancos/reportes/impresion-cheques': ['frontend/src/pages/ImpresionCheques.jsx', 'backend/routes/cheques.js'],
    '/dashboard/finanzas/prestamos': ['frontend/src/pages/FinanzasPrestamos.jsx', 'backend/routes/finanzas.js'],
    '/dashboard/finanzas/inversiones': ['frontend/src/pages/FinanzasInversiones.jsx', 'backend/routes/finanzas.js'],
    '/dashboard/finanzas/crecimiento': ['frontend/src/pages/FinanzasCrecimiento.jsx', 'backend/routes/finanzasCrecimiento.js', 'backend/services/businessGrowthAgyService.js'],
    '/dashboard/rrhh/planillas': ['frontend/src/pages/PlanillasRRHH.jsx', 'backend/routes/rrhh.js'],
    '/dashboard/seguridad/tickets': ['frontend/src/pages/SupportTickets.jsx', 'backend/routes/tickets.js', 'backend/services/ticketService.js'],
    '/dashboard/seguridad/telegram': ['frontend/src/pages/TelegramUsers.jsx', 'backend/routes/telegram.js', 'backend/services/telegramBotService.js']
};

function extractExplicitFilesFromTicketText(ticket, rootDir) {
    const combined = [ticket.ai_notes || '', ticket.agy_plan_markdown || '', ticket.agy_execution_log || '', ticket.description || ''].join('\n');
    const regex = /((?:client|server|frontend|backend|dte-api)\/[A-Za-z0-9_./-]+\.(?:jsx?|tsx?|css|sql))/g;
    const explicit = [];
    const rootResolved = path.resolve(rootDir);
    for (let m = regex.exec(combined); m; m = regex.exec(combined)) {
        const rawRel = m[1].replace(/\\/g, '/');
        if (rawRel.includes('..')) continue;
        const abs = path.resolve(rootResolved, rawRel);
        const rel = path.relative(rootResolved, abs).replace(/\\/g, '/');
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
        if (!explicit.includes(rel) && fs.existsSync(abs) && fs.statSync(abs).isFile()) explicit.push(rel);
    }
    return explicit;
}

function findGraphifyAdminFiles(rootDir, queryText) {
    const graphFile = path.join(rootDir, 'graphify-out/graph.json');
    if (!fs.existsSync(graphFile)) return [];
    try {
        const raw = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
        const terms = String(queryText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-z0-9_./-]+/).filter((t) => t.length >= 4);
        if (terms.length === 0) return [];
        const fileScores = new Map();
        for (const node of (Array.isArray(raw.nodes) ? raw.nodes : [])) {
            const sf = node.source_file;
            if (!sf || sf.startsWith('graphify-out') || sf.includes('.test.')) continue;
            const hay = `${node.id || ''} ${node.label || ''} ${sf}`.toLowerCase();
            let s = 0;
            for (const t of terms) { if (hay.includes(t)) s += sf.toLowerCase().includes(t) ? 3 : 1; }
            if (s > 0) fileScores.set(sf, (fileScores.get(sf) || 0) + s);
        }
        return [...fileScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f)
            .filter((f) => fs.existsSync(path.join(rootDir, f)));
    } catch { return []; }
}

function findRouteMappedFiles(rootDir, pageUrl, isAdmin) {
    if (!pageUrl) return [];
    const matched = [];
    const cleanRoute = String(pageUrl).split('?')[0].replace(/\/+$/, '').trim();
    const routeMap = isAdmin ? KNOWN_ADMIN_ROUTE_FILES : KNOWN_SAAS_ROUTE_FILES;
    for (const rel of (routeMap[cleanRoute] || [])) {
        if (fs.existsSync(path.join(rootDir, rel))) matched.push(rel);
    }
    const srcBase = isAdmin ? 'frontend/src' : 'client/src';
    const routerFiles = isAdmin
        ? [path.join(rootDir, 'frontend/src/pages/DashboardLayout.jsx'), path.join(rootDir, 'frontend/src/App.jsx')]
        : [path.join(rootDir, 'client/src/App.jsx')];

    for (const rf of routerFiles) {
        if (!fs.existsSync(rf)) continue;
        try {
            const content = fs.readFileSync(rf, 'utf8');
            for (const line of content.split('\n').filter((l) => l.includes(cleanRoute))) {
                for (const raw of (line.match(/<([A-Z][A-Za-z0-9_]+)/g) || [])) {
                    const compName = raw.replace('<', '');
                    const pageCand = `${srcBase}/pages/${compName}.jsx`;
                    if (fs.existsSync(path.join(rootDir, pageCand)) && !matched.includes(pageCand)) matched.push(pageCand);
                }
            }
        } catch { /* ignore */ }
    }
    return matched;
}

const DOMAIN_SYNONYMS = {
    bateria: ['battery', 'energy', 'gess'], baterias: ['battery', 'energy', 'gess'],
    solar: ['energy', 'growatt', 'solar'], paneles: ['energy', 'growatt'], energia: ['energy'],
    huevo: ['egg'], produccion: ['production', 'eggbatch'], lote: ['batch', 'production'],
    empaque: ['packaging'], calendario: ['productioncalendar', 'eggplanning'],
    pedido: ['order', 'eggcustomerorder'], pedidos: ['order', 'eggcustomerorder'],
    despacho: ['dispatch', 'route'], ruta: ['route', 'dispatch'],
    venta: ['sales', 'sale'], factura: ['sales', 'dte', 'invoice'],
    compra: ['purchase'], inventario: ['inventory', 'kardex'],
    cliente: ['customer'], proveedor: ['provider', 'supplier'],
    sucursal: ['branch'], usuario: ['user'], rol: ['role'],
    planilla: ['payroll', 'planilla'], empleado: ['employee', 'empleado']
};

function expandLocalImports(rootDir, seedFiles = []) {
    const discovered = [];
    const rootResolved = path.resolve(rootDir);
    const tryResolve = (baseDir, relSpec) => {
        const candidates = [relSpec, `${relSpec}.jsx`, `${relSpec}.js`, `${relSpec}/index.js`, `${relSpec}/index.jsx`];
        for (const c of candidates) {
            const abs = path.resolve(baseDir, c);
            const rel = path.relative(rootResolved, abs).replace(/\\/g, '/');
            if (!rel.startsWith('..') && fs.existsSync(abs) && fs.statSync(abs).isFile()) return { abs, rel };
        }
        return null;
    };
    const queue = seedFiles.map((f) => ({ rel: f, depth: 0 }));
    const visited = new Set(seedFiles);
    while (queue.length > 0 && discovered.length < 18) {
        const { rel, depth } = queue.shift();
        if (depth >= 2) continue;
        const abs = path.join(rootResolved, rel);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        try {
            const content = fs.readFileSync(abs, 'utf8');
            const rx = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;
            for (let m = rx.exec(content); m; m = rx.exec(content)) {
                const hit = tryResolve(path.dirname(abs), m[1]);
                if (hit && !visited.has(hit.rel) && !hit.rel.includes('/ui/')) {
                    visited.add(hit.rel);
                    if (!hit.rel.endsWith('/index.js')) discovered.push(hit.rel);
                    queue.push({ rel: hit.rel, depth: depth + 1 });
                }
            }
        } catch { /* ignore */ }
    }
    return discovered;
}

function findSmartRelatedFiles(ticket, settings = {}) {
    const proj = resolveProjectForTicket(ticket, settings);
    const rootDir = proj.projectPath;
    if (!fs.existsSync(rootDir)) return proj.isAdmin ? ['frontend/src/pages/DashboardLayout.jsx'] : ['client/src/pages/SupportTickets.jsx'];
    const queryText = [ticket.subject, ticket.description, ticket.module_name, ticket.page_url, ticket.ai_notes, ticket.agy_plan_markdown].filter(Boolean).join(' ');
    const explicitFiles = extractExplicitFilesFromTicketText(ticket, rootDir);
    const routeFiles = findRouteMappedFiles(rootDir, ticket.page_url, proj.isAdmin);
    const stopWords = new Set(['dashboard', 'soporte', 'reporte', 'reportes', 'general', 'modulo', 'sistema', 'error', 'problema', 'quitar', 'poner', 'agregar']);
    const rawKeywords = queryText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/).filter((k) => k.length >= 3 && !stopWords.has(k));
    const keywords = Array.from(new Set(rawKeywords.flatMap((k) => [k, ...(DOMAIN_SYNONYMS[k] || [])]))).filter((k) => k.length >= 4);

    const importedFiles = expandLocalImports(rootDir, [...explicitFiles, ...routeFiles]);
    const found = new Set([
        ...explicitFiles,
        ...routeFiles,
        ...importedFiles,
        ...(proj.isAdmin ? findGraphifyAdminFiles(rootDir, queryText) : [])
    ]);
    const dirsToScan = proj.isAdmin ? ['frontend/src/pages', 'frontend/src/components', 'backend/routes', 'backend/services'] : ['client/src/pages', 'client/src/components', 'server/src/controllers', 'server/src/services', 'server/src/schemas'];

    const walk = (dir, depth = 0) => {
        if (depth > 3 || !fs.existsSync(dir) || found.size >= 16) return;
        try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (found.size >= 16) break;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) walk(full, depth + 1);
                else if (/\.(jsx?|tsx?)$/.test(entry.name) && keywords.some((kw) => entry.name.toLowerCase().includes(kw))) {
                    found.add(path.relative(rootDir, full).replace(/\\/g, '/'));
                }
            }
        } catch { /* ignore */ }
    };
    dirsToScan.forEach((d) => walk(path.join(rootDir, d), 0));
    if (found.size === 0) found.add(proj.isAdmin ? 'frontend/src/pages/Dashboard.jsx' : 'client/src/pages/SupportTickets.jsx');

    const explicitSet = new Set(explicitFiles);
    const ranked = Array.from(found).map((rel, idx) => {
        let score = explicitSet.has(rel) ? 100 : Math.max(0, 20 - idx);
        const lowerRel = rel.toLowerCase();
        for (const kw of keywords) {
            if (lowerRel.includes(kw)) score += 15;
        }
        return { rel, score };
    }).sort((a, b) => b.score - a.score);

    return ranked.slice(0, 8).map((r) => r.rel);
}

module.exports = { isTicketFromAdminProject, resolveProjectForTicket, findSmartRelatedFiles };
