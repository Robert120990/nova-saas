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
    process.env.AGY_PROJECT_PATH, path.resolve(process.cwd(), '..'),
    '/home/rsboosted/SIPEWEBgas', '/opt/nova-saas', '/var/www/SIPEWEBgas', '/home/sistemas/SIPEWEBgas', 'c:/Proyects local/SIPEWEBgas'
].filter(Boolean);

function isTicketFromAdminProject(ticket = {}) {
    const code = String(ticket.ticket_code || '').toUpperCase();
    const source = String(ticket.source_system || '').toLowerCase();
    const mod = String(ticket.module_name || '').toLowerCase();
    const url = String(ticket.page_url || '').toLowerCase();
    return code.startsWith('ADM-') || source.includes('admin.sipesv.com') || mod.includes('sipe admin') || mod.includes('(admin)') || url.startsWith('/dashboard');
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
    '/branches': ['server/src/controllers/branch.controller.js', 'server/src/schemas/companySchemas.js', 'client/src/pages/Branches.jsx', 'client/src/components/branches/BranchModal.jsx'],
    '/ventas': ['server/src/schemas/salesSchemas.js', 'server/src/controllers/sales/salesEditDteItems.controller.js', 'server/src/controllers/sales/salesDte.controller.js', 'client/src/pages/SalesHistory.jsx', 'client/src/pages/SalesTerminal.jsx'],
    '/industrial/empaque': ['client/src/components/egg/packaging/EggNewPackagingModal.jsx', 'client/src/components/egg/packaging/PackagingItemsSection.jsx', 'client/src/components/egg/packaging/EggEditPackagingModal.jsx', 'client/src/constants/eggIndustrialCatalogs.js', 'client/src/pages/EggIndustrial/Packaging.jsx'],
    '/industrial/produccion': ['client/src/components/egg/production/ProductionIsNewBatchModalOpenModal.jsx', 'client/src/constants/eggIndustrialCatalogs.js', 'client/src/pages/EggIndustrial/Production.jsx'],
    '/industrial/calendario': ['client/src/components/egg/productionCalendar/eggCalendarConstants.js', 'client/src/components/egg/productionCalendar/useProductionCalendarModel.jsx', 'client/src/pages/EggIndustrial/ProductionCalendar.jsx'],
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
    for (let m = regex.exec(combined); m; m = regex.exec(combined)) {
        const rel = m[1].replace(/\\/g, '/');
        if (!explicit.includes(rel) && fs.existsSync(path.join(rootDir, rel))) explicit.push(rel);
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

function findSmartRelatedFiles(ticket, settings = {}) {
    const proj = resolveProjectForTicket(ticket, settings);
    const rootDir = proj.projectPath;
    if (!fs.existsSync(rootDir)) return proj.isAdmin ? ['frontend/src/pages/DashboardLayout.jsx'] : ['client/src/pages/SupportTickets.jsx'];
    const queryText = [ticket.subject, ticket.description, ticket.module_name, ticket.page_url, ticket.ai_notes].filter(Boolean).join(' ');
    const found = new Set([
        ...extractExplicitFilesFromTicketText(ticket, rootDir),
        ...findRouteMappedFiles(rootDir, ticket.page_url, proj.isAdmin),
        ...(proj.isAdmin ? findGraphifyAdminFiles(rootDir, queryText) : [])
    ]);
    const stopWords = new Set(['dashboard', 'soporte', 'reporte', 'reportes', 'general', 'modulo', 'sistema', 'error', 'problema', 'quitar', 'poner', 'agregar']);
    const keywords = queryText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/).filter((k) => k.length >= 4 && !stopWords.has(k));
    const dirsToScan = proj.isAdmin ? ['frontend/src/pages', 'frontend/src/components', 'backend/routes', 'backend/services'] : ['client/src/pages', 'client/src/components', 'server/src/controllers', 'server/src/services', 'server/src/schemas'];

    const walk = (dir, depth = 0) => {
        if (depth > 2 || !fs.existsSync(dir) || found.size >= 6) return;
        try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (found.size >= 6) break;
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
    return Array.from(found).slice(0, 6);
}

module.exports = { isTicketFromAdminProject, resolveProjectForTicket, findSmartRelatedFiles };
