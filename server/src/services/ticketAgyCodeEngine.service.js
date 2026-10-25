const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const aiService = require('./ai.service');
const { setAppVersion } = require('./websocket.service');

const ADMIN_CANDIDATE_PATHS = [process.env.AGY_ADMIN_PROJECT_PATH, '/var/www/sipeadmin', '/opt/sipeadmin', '/home/sistemas/sipeadmin', '/home/sistemas/SIPEOFI', '/opt/SIPEOFI', path.resolve(process.cwd(), '../../SIPEOFI'), path.resolve(process.cwd(), '../SIPEOFI'), 'c:/Proyects local/SIPEOFI'].filter(Boolean);
const SAAS_CANDIDATE_PATHS = [process.env.AGY_PROJECT_PATH, path.resolve(process.cwd(), '..'), '/opt/nova-saas', '/var/www/SIPEWEBgas', '/home/sistemas/SIPEWEBgas', 'c:/Proyects local/SIPEWEBgas'].filter(Boolean);

function isTicketFromAdminProject(ticket = {}) {
    const code = String(ticket.ticket_code || '').toUpperCase();
    const source = String(ticket.source_system || '').toLowerCase();
    const mod = String(ticket.module_name || '').toLowerCase();
    const url = String(ticket.page_url || '').toLowerCase();
    return code.startsWith('ADM-') || source.includes('admin.sipesv.com') || mod.includes('sipe admin') || url.startsWith('/dashboard/');
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
    '/dashboard/operaciones/pedidos': ['backend/routes/operaciones.js', 'frontend/src/pages/PedidosCombustible.jsx'],
    '/dashboard/consultas/estaciones/ventas': ['backend/routes/consultas.js', 'backend/services/fuelIntelligence.js', 'frontend/src/pages/ConsultaVentasEstaciones.jsx']
};

function extractExplicitFilesFromTicketText(ticket, rootDir) {
    const combined = [ticket.ai_notes || '', ticket.agy_plan_markdown || '', ticket.agy_execution_log || '', ticket.description || ''].join('\n');
    const regex = /((?:client|server|frontend|backend|dte-api)\/[A-Za-z0-9_./-]+\.(?:jsx?|tsx?|css|sql))/g;
    const explicit = [];
    let m = regex.exec(combined);
    while (m) {
        const rel = m[1].replace(/\\/g, '/');
        if (!explicit.includes(rel) && fs.existsSync(path.join(rootDir, rel))) explicit.push(rel);
        m = regex.exec(combined);
    }
    return explicit;
}

function findRouteMappedFiles(rootDir, pageUrl, isAdmin) {
    if (!pageUrl) return [];
    const matched = [];
    const cleanRoute = String(pageUrl).split('?')[0].trim();
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
            const importMap = {};
            const importRegex = /(?:const|let)\s+([A-Z][A-Za-z0-9_]*)\s*=.*import\(['"]\.\/([^'"]+)['"]\)|import\s+([A-Z][A-Za-z0-9_]*)\s+from\s+['"]\.\/([^'"]+)['"]/g;
            for (let im = importRegex.exec(content); im; im = importRegex.exec(content)) {
                const name = im[1] || im[3];
                const relImport = im[2] || im[4];
                if (name && relImport) importMap[name] = relImport;
            }
            for (const line of content.split('\n').filter((l) => l.includes(cleanRoute))) {
                for (const raw of (line.match(/<([A-Z][A-Za-z0-9_]+)/g) || [])) {
                    const compName = raw.replace('<', '');
                    for (const relCand of [importMap[compName] ? `${srcBase}/${importMap[compName]}.jsx` : null, `${srcBase}/pages/${compName}.jsx`].filter(Boolean)) {
                        if (fs.existsSync(path.join(rootDir, relCand))) matched.push(relCand);
                    }
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
    const found = new Set([...extractExplicitFilesFromTicketText(ticket, rootDir), ...findRouteMappedFiles(rootDir, ticket.page_url, proj.isAdmin)]);
    const stopWords = new Set(['dashboard', 'soporte', 'reporte', 'reportes', 'general', 'modulo', 'sistema', 'error', 'problema', 'quitar', 'poner', 'agregar']);
    const keywords = [...(String(ticket.page_url || '').split('/').filter(Boolean)), ...(String(ticket.module_name || '').split(/\s+/)), ...(String(ticket.subject || '').split(/\s+/))]
        .map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((k) => k.length >= 4 && !stopWords.has(k));
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
    if (found.size === 0) found.add(proj.isAdmin ? 'frontend/src/pages/DashboardLayout.jsx' : 'client/src/pages/SupportTickets.jsx');
    return Array.from(found).slice(0, 6);
}

function readCandidateSnippets(rootDir, relFiles = [], maxCharsPerFile = 6000) {
    const snippets = [];
    for (const rel of relFiles.slice(0, 5)) {
        const abs = path.join(rootDir, rel);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            try {
                const raw = fs.readFileSync(abs, 'utf8');
                snippets.push({ file: rel, content: raw.slice(0, maxCharsPerFile), totalLines: raw.split('\n').length });
            } catch { /* ignore */ }
        }
    }
    return snippets;
}

async function generateAiPlanFromCode(ticket, model, planVersion, proj, relatedFiles) {
    if (!aiService.deepseek && !aiService.gemini) return null;
    const snippets = readCandidateSnippets(proj.projectPath, relatedFiles, 5000);
    const codeContext = snippets.map((s) => `--- ARCHIVO: ${s.file} (${s.totalLines} líneas) ---\n${s.content}`).join('\n\n');
    const systemPrompt = `Eres AGY, el arquitecto de software de SIPE. Analiza el ticket #${ticket.ticket_code} y redacta una propuesta de solución RESUMIDA, CLARA Y EN LENGUAJE HUMANO (máximo 12-15 líneas) para Telegram. Evita tecnicismos excesivos o bloques de código.`;
    const userPrompt = [
        `Ticket: #${ticket.ticket_code} | Proyecto: ${proj.projectLabel}`,
        `Ruta: ${ticket.page_url || 'N/A'} | Módulo: ${ticket.module_name || 'General'}`,
        `Asunto: ${ticket.subject} | Descripción: ${ticket.description}`,
        ticket.ai_notes ? `Directriz del Admin: ${ticket.ai_notes}` : '',
        `Archivos detectados:\n${relatedFiles.join('\n')}`,
        codeContext ? `Extracto de código actual:\n${codeContext}` : '',
        `Genera el Plan v${planVersion} con: 🎯 Diagnóstico, 🛠️ Solución propuesta y 📂 Componentes.`
    ].filter(Boolean).join('\n');

    try {
        const resp = await aiService.generateFinalResponse({ systemPrompt, history: [], finalPrompt: userPrompt });
        return resp?.content ? String(resp.content).trim() : null;
    } catch { return null; }
}

function getGitHeadCommit(rootDir) {
    try { return execSync('git rev-parse HEAD', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim(); } catch { return ''; }
}

function getGitDirtySet(rootDir) {
    const set = new Set();
    try {
        const gitStatus = execSync('git status --porcelain', { cwd: rootDir, timeout: 8000, stdio: 'pipe' }).toString().trim();
        for (const line of gitStatus ? gitStatus.split('\n') : []) {
            const f = line.trim().split(/\s+/).pop();
            if (f) set.add(f.replace(/\\/g, '/'));
        }
    } catch { /* ignore */ }
    return set;
}

function syncGitPullLatest(rootDir, onLog = () => {}) {
    if (!fs.existsSync(rootDir)) return;
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim() || 'main';
        const remotes = execSync('git remote', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim().split(/\s+/).filter(Boolean);
        execSync('git fetch --all --prune', { cwd: rootDir, timeout: 20000, stdio: 'pipe' });
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                execSync(`git pull --rebase --autostash ${rem} ${branch}`, { cwd: rootDir, timeout: 30000, stdio: 'pipe' });
                onLog(`[AGY] 🔄 Repositorio sincronizado con últimos cambios de ${rem}/${branch}.\n`);
                break;
            } catch { /* continue */ }
        }
    } catch { /* ignore */ }
}

function computeAndBroadcastVersion(rootDir) {
    try {
        const commit = execSync('git rev-parse --short HEAD', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim();
        const count = parseInt(execSync('git rev-list --count HEAD', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim(), 10);
        const version = !isNaN(count) && count >= 1000 ? `v2.08.${String(count - 999).padStart(2, '0')}` : `v2.07.${String(count || 0).padStart(2, '0')}`;
        setAppVersion({ version, commit });
        return { version, commit };
    } catch { return { version: null, commit: null }; }
}

function syncGitCommitAndPush(rootDir, ticket, modifiedFiles, onLog = () => {}) {
    const safeFiles = modifiedFiles.filter((f) => f && !f.includes('.env') && !f.endsWith('package-lock.json') && !f.endsWith('pnpm-lock.yaml'));
    try {
        if (safeFiles.length > 0) {
            const quotedFiles = safeFiles.map((f) => `"${f.replace(/"/g, '')}"`).join(' ');
            execSync(`git add -- ${quotedFiles}`, { cwd: rootDir, timeout: 15000, stdio: 'pipe' });
            const staged = execSync('git diff --cached --name-only', { cwd: rootDir, timeout: 8000, stdio: 'pipe' }).toString().trim();
            if (staged) {
                const cleanSubject = String(ticket.subject || 'ajuste solicitado').replace(/["`$\\]/g, '').slice(0, 72);
                execSync(`git -c user.name="AGY Server Bot" -c user.email="agy@sipesv.com" commit -m "fix(agy): resolver #${ticket.ticket_code} - ${cleanSubject}"`, { cwd: rootDir, timeout: 15000, stdio: 'pipe' });
            }
        }
        const commitHash = execSync('git rev-parse --short HEAD', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim() || 'main';
        const remotes = execSync('git remote', { cwd: rootDir, timeout: 5000, stdio: 'pipe' }).toString().trim().split(/\s+/).filter(Boolean);
        const pushedRemotes = [];
        execSync('git fetch --all --prune', { cwd: rootDir, timeout: 20000, stdio: 'pipe' });
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                execSync(`git pull --rebase --autostash ${rem} ${branch}`, { cwd: rootDir, timeout: 30000, stdio: 'pipe' });
                execSync(`git push ${rem} ${branch}`, { cwd: rootDir, timeout: 30000, stdio: 'pipe' });
                pushedRemotes.push(`${rem}/${branch}`);
            } catch (pushErr) {
                onLog(`[AGY] ⚠️ Aviso push ${rem}/${branch}: ${pushErr.message?.slice(0, 120)}\n`);
            }
        }
        const verInfo = computeAndBroadcastVersion(rootDir);
        const gitLog = pushedRemotes.length > 0
            ? `Commit ${commitHash} (${verInfo.version || ''}) subido a GitHub (${pushedRemotes.join(', ')}) y actualización notificada.`
            : `Commit local ${commitHash} (${verInfo.version || ''}) registrado y notificado.`;
        onLog(`[AGY] 🚀 ${gitLog}\n`);
        return { commitHash, version: verInfo.version, gitLog };
    } catch (err) {
        const msg = `Aviso Git en servidor: ${err.message?.slice(0, 140)}`;
        onLog(`[AGY] ⚠️ ${msg}\n`);
        return { commitHash: null, version: null, gitLog: msg };
    }
}

async function applyAiCodePatchAndBuild(ticket, proj, relatedFiles, onLog = () => {}, preExistingDirtySet = new Set(), preHeadCommit = '') {
    const rootDir = proj.projectPath;
    if (!fs.existsSync(rootDir)) return { modifiedFiles: [], buildSuccess: false, buildLog: '', gitLog: '' };

    const modifiedFiles = [];
    for (const f of getGitDirtySet(rootDir)) {
        if (!preExistingDirtySet.has(f) && !f.endsWith('package-lock.json') && !f.includes('.env')) modifiedFiles.push(f);
    }
    const postHeadCommit = getGitHeadCommit(rootDir);
    if (preHeadCommit && postHeadCommit && preHeadCommit !== postHeadCommit) {
        try {
            const committedDiff = execSync(`git diff --name-only ${preHeadCommit}..${postHeadCommit}`, { cwd: rootDir, timeout: 8000, stdio: 'pipe' }).toString().trim();
            for (const f of committedDiff ? committedDiff.split('\n') : []) {
                const norm = f.trim().replace(/\\/g, '/');
                if (norm && !modifiedFiles.includes(norm) && !norm.includes('.env')) modifiedFiles.push(norm);
            }
        } catch { /* ignore */ }
    }

    if (modifiedFiles.length === 0 && (aiService.deepseek || aiService.gemini)) {
        const snippets = readCandidateSnippets(rootDir, relatedFiles, 18000);
        if (snippets.length > 0) {
            onLog(`[AGY] Analizando y aplicando cambios en ${snippets.map((s) => s.file).join(', ')}...\n`);
            const systemPrompt = `Eres un motor de edición quirúrgica de código. Devuelve ÚNICAMENTE un JSON válido sin bloques markdown con el formato: {"edits":[{"file":"ruta/relativa.jsx","search":"bloque exacto existente","replace":"bloque nuevo corregido"}],"summary":"explicación breve del cambio aplicado"}.`;
            const userPrompt = [
                `Ticket #${ticket.ticket_code} (${proj.projectLabel}) | Asunto: ${ticket.subject} | Descripción: ${ticket.description}`,
                ticket.ai_notes ? `Directriz: ${ticket.ai_notes}` : '',
                `Plan aprobado:\n${ticket.agy_plan_markdown || ''}`,
                ...snippets.map((s) => `=== FILE: ${s.file} ===\n${s.content}`)
            ].filter(Boolean).join('\n');

            try {
                const resp = await aiService.generateFinalResponse({ systemPrompt, history: [], finalPrompt: userPrompt });
                const parsed = JSON.parse(String(resp?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim());
                for (const edit of Array.isArray(parsed?.edits) ? parsed.edits : []) {
                    if (!edit.file || !edit.search || edit.replace === undefined) continue;
                    const safeRel = path.normalize(edit.file).replace(/^(\.\.(\/|\\|$))+/, '');
                    const absPath = path.resolve(rootDir, safeRel);
                    if (!absPath.startsWith(path.resolve(rootDir)) || !fs.existsSync(absPath)) continue;
                    const currentContent = fs.readFileSync(absPath, 'utf8');
                    const crlfSearch = edit.search.replace(/\r?\n/g, '\r\n');
                    let updatedContent = currentContent;
                    if (currentContent.includes(edit.search)) updatedContent = currentContent.replace(edit.search, edit.replace);
                    else if (currentContent.includes(crlfSearch)) updatedContent = currentContent.replace(crlfSearch, edit.replace.replace(/\r?\n/g, '\r\n'));
                    if (updatedContent !== currentContent) {
                        fs.writeFileSync(absPath, updatedContent, 'utf8');
                        const normRel = safeRel.replace(/\\/g, '/');
                        if (!modifiedFiles.includes(normRel)) modifiedFiles.push(normRel);
                    }
                }
            } catch (err) {
                onLog(`[AGY] Aviso motor IA: ${err.message}\n`);
            }
        }
    }

    if (modifiedFiles.length === 0) return { modifiedFiles: [], buildSuccess: false, buildLog: '', commitHash: null, gitLog: '' };

    const { commitHash, version, gitLog } = syncGitCommitAndPush(rootDir, ticket, modifiedFiles, onLog);
    let buildSuccess = false;
    let buildLog = '';
    const frontendRel = proj.frontendDir;
    const frontendFull = path.join(rootDir, frontendRel);
    const hasBackendChanges = modifiedFiles.some((f) => f.startsWith(`${proj.backendDir}/`));

    if (fs.existsSync(frontendFull)) {
        try {
            onLog(`[AGY] Compilando frontend (${frontendRel}) con versión ${version || commitHash || ''} para lanzar actualización...\n`);
            const buildCmd = proj.isAdmin ? 'pnpm --filter frontend run build || npm --prefix frontend run build' : 'npm --prefix client run build || pnpm --filter client run build';
            execSync(buildCmd, { cwd: rootDir, timeout: 120000, stdio: 'pipe' });
            buildSuccess = true;
            buildLog = `Frontend (${frontendRel}/dist) recompilado (${version || commitHash}) y actualización lanzada.`;
            onLog(`[AGY] ✅ ${buildLog}\n`);
        } catch (bErr) {
            buildLog = `Aviso al compilar frontend: ${bErr.message?.slice(0, 160)}`;
            onLog(`[AGY] ⚠️ ${buildLog}\n`);
        }
    }

    if (hasBackendChanges && proj.pm2AppName) {
        buildLog = buildLog ? `${buildLog} Backend (${proj.pm2AppName}) recargado en vivo.` : `Backend (${proj.pm2AppName}) recargado en vivo.`;
        setTimeout(() => {
            try {
                const child = spawn('sh', ['-c', `pm2 reload ${proj.pm2AppName} --update-env || pm2 reload all --update-env || true`], { cwd: rootDir, detached: true, stdio: 'ignore' });
                child.unref();
            } catch { /* ignore */ }
        }, 3000);
    }

    return { modifiedFiles, buildSuccess, buildLog, commitHash, version, gitLog };
}

module.exports = {
    isTicketFromAdminProject, resolveProjectForTicket, findSmartRelatedFiles,
    generateAiPlanFromCode, applyAiCodePatchAndBuild, syncGitCommitAndPush,
    syncGitPullLatest, getGitDirtySet, getGitHeadCommit
};
