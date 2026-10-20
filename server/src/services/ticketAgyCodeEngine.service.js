const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const aiService = require('./ai.service');

const ADMIN_CANDIDATE_PATHS = [
    process.env.AGY_ADMIN_PROJECT_PATH,
    '/var/www/sipeadmin',
    '/opt/sipeadmin',
    '/home/sistemas/sipeadmin',
    '/home/sistemas/SIPEOFI',
    '/opt/SIPEOFI',
    path.resolve(process.cwd(), '../../SIPEOFI'),
    path.resolve(process.cwd(), '../SIPEOFI'),
    'c:/Proyects local/SIPEOFI'
].filter(Boolean);

const SAAS_CANDIDATE_PATHS = [
    process.env.AGY_PROJECT_PATH,
    '/opt/nova-saas',
    '/var/www/SIPEWEBgas',
    '/home/sistemas/SIPEWEBgas',
    path.resolve(process.cwd(), '..'),
    'c:/Proyects local/SIPEWEBgas'
].filter(Boolean);

function isTicketFromAdminProject(ticket = {}) {
    const code = String(ticket.ticket_code || '').toUpperCase();
    const source = String(ticket.source_system || '').toLowerCase();
    const mod = String(ticket.module_name || '').toLowerCase();
    const url = String(ticket.page_url || '').toLowerCase();
    return (
        code.startsWith('ADM-') ||
        source.includes('admin.sipesv.com') ||
        mod.includes('sipe admin') ||
        url.startsWith('/dashboard/')
    );
}

function resolveProjectForTicket(ticket = {}, settings = {}) {
    const isAdmin = isTicketFromAdminProject(ticket);
    if (isAdmin) {
        for (const candidate of ADMIN_CANDIDATE_PATHS) {
            try {
                if (fs.existsSync(candidate) && (fs.existsSync(path.join(candidate, 'frontend')) || fs.existsSync(path.join(candidate, 'backend')))) {
                    return {
                        isAdmin: true,
                        projectCode: 'ADM',
                        projectLabel: 'admin.sipesv.com (SIPE Admin)',
                        projectPath: candidate,
                        frontendDir: 'frontend',
                        backendDir: 'backend',
                        pm2AppName: 'sipeadmin-backend'
                    };
                }
            } catch { /* ignore */ }
        }
        return {
            isAdmin: true,
            projectCode: 'ADM',
            projectLabel: 'admin.sipesv.com (SIPE Admin)',
            projectPath: process.env.AGY_ADMIN_PROJECT_PATH || '/var/www/sipeadmin',
            frontendDir: 'frontend',
            backendDir: 'backend',
            pm2AppName: 'sipeadmin-backend'
        };
    }

    const configured = settings?.project_path;
    if (configured && fs.existsSync(configured) && fs.existsSync(path.join(configured, 'client'))) {
        return {
            isAdmin: false,
            projectCode: 'TKT',
            projectLabel: 'sys.sipesv.com (SIPE SaaS)',
            projectPath: configured,
            frontendDir: 'client',
            backendDir: 'server',
            pm2AppName: 'nova-saas-api'
        };
    }

    for (const candidate of SAAS_CANDIDATE_PATHS) {
        try {
            if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'client'))) {
                return {
                    isAdmin: false,
                    projectCode: 'TKT',
                    projectLabel: 'sys.sipesv.com (SIPE SaaS)',
                    projectPath: candidate,
                    frontendDir: 'client',
                    backendDir: 'server',
                    pm2AppName: 'nova-saas-api'
                };
            }
        } catch { /* ignore */ }
    }

    return {
        isAdmin: false,
        projectCode: 'TKT',
        projectLabel: 'sys.sipesv.com (SIPE SaaS)',
        projectPath: configured || '/opt/nova-saas',
        frontendDir: 'client',
        backendDir: 'server',
        pm2AppName: 'nova-saas-api'
    };
}

const KNOWN_SAAS_ROUTE_FILES = {
    '/industrial/empaque': [
        'client/src/components/egg/packaging/EggNewPackagingModal.jsx',
        'client/src/components/egg/packaging/PackagingItemsSection.jsx',
        'client/src/components/egg/packaging/EggEditPackagingModal.jsx',
        'client/src/constants/eggIndustrialCatalogs.js',
        'client/src/pages/EggIndustrial/Packaging.jsx'
    ],
    '/industrial/produccion': [
        'client/src/components/egg/production/ProductionIsNewBatchModalOpenModal.jsx',
        'client/src/constants/eggIndustrialCatalogs.js',
        'client/src/pages/EggIndustrial/Production.jsx'
    ]
};

function findRouteMappedFiles(rootDir, pageUrl, isAdmin) {
    if (!pageUrl) return [];
    const matched = [];
    const cleanRoute = String(pageUrl).split('?')[0].trim();
    if (!isAdmin && KNOWN_SAAS_ROUTE_FILES[cleanRoute]) {
        for (const rel of KNOWN_SAAS_ROUTE_FILES[cleanRoute]) {
            if (fs.existsSync(path.join(rootDir, rel))) matched.push(rel);
        }
    }
    const routerFiles = isAdmin
        ? [path.join(rootDir, 'frontend/src/pages/DashboardLayout.jsx'), path.join(rootDir, 'frontend/src/App.jsx')]
        : [path.join(rootDir, 'client/src/App.jsx')];

    for (const rf of routerFiles) {
        if (!fs.existsSync(rf)) continue;
        try {
            const content = fs.readFileSync(rf, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.includes(cleanRoute)) {
                    const compMatches = line.match(/<([A-Z][A-Za-z0-9_]+)/g) || [];
                    for (const raw of compMatches) {
                        const compName = raw.replace('<', '');
                        const pagesDir = path.join(rootDir, isAdmin ? 'frontend/src/pages' : 'client/src/pages');
                        const directFile = path.join(pagesDir, `${compName}.jsx`);
                        if (fs.existsSync(directFile)) {
                            matched.push(path.relative(rootDir, directFile).replace(/\\/g, '/'));
                        }
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
    if (!fs.existsSync(rootDir)) {
        return proj.isAdmin ? ['frontend/src/pages/DashboardLayout.jsx'] : ['client/src/pages/SupportTickets.jsx'];
    }

    const found = new Set(findRouteMappedFiles(rootDir, ticket.page_url, proj.isAdmin));
    const stopWords = new Set(['dashboard', 'soporte', 'reporte', 'reportes', 'general', 'modulo', 'sistema', 'error', 'problema', 'quitar', 'poner', 'agregar']);
    const keywords = [
        ...(String(ticket.page_url || '').split('/').filter(Boolean)),
        ...(String(ticket.module_name || '').split(/\s+/)),
        ...(String(ticket.subject || '').split(/\s+/))
    ]
        .map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter((k) => k.length >= 4 && !stopWords.has(k));

    const dirsToScan = proj.isAdmin
        ? [
            path.join(rootDir, 'frontend/src/pages'),
            path.join(rootDir, 'frontend/src/components'),
            path.join(rootDir, 'backend/routes'),
            path.join(rootDir, 'backend/services')
        ]
        : [
            path.join(rootDir, 'client/src/pages'),
            path.join(rootDir, 'client/src/components'),
            path.join(rootDir, 'server/src/controllers'),
            path.join(rootDir, 'server/src/services')
        ];

    const walk = (dir, depth = 0) => {
        if (depth > 2 || !fs.existsSync(dir) || found.size >= 6) return;
        try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (found.size >= 6) break;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full, depth + 1);
                } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
                    const lower = entry.name.toLowerCase();
                    if (keywords.some((kw) => lower.includes(kw))) {
                        found.add(path.relative(rootDir, full).replace(/\\/g, '/'));
                    }
                }
            }
        } catch { /* ignore */ }
    };

    dirsToScan.forEach((d) => walk(d, 0));
    if (found.size === 0) {
        found.add(proj.isAdmin ? 'frontend/src/pages/DashboardLayout.jsx' : 'client/src/pages/SupportTickets.jsx');
    }
    return Array.from(found).slice(0, 6);
}

function readCandidateSnippets(rootDir, relFiles = [], maxCharsPerFile = 6000) {
    const snippets = [];
    for (const rel of relFiles.slice(0, 3)) {
        const abs = path.join(rootDir, rel);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            try {
                const raw = fs.readFileSync(abs, 'utf8');
                snippets.push({
                    file: rel,
                    content: raw.slice(0, maxCharsPerFile),
                    totalLines: raw.split('\n').length
                });
            } catch { /* ignore */ }
        }
    }
    return snippets;
}

async function generateAiPlanFromCode(ticket, model, planVersion, proj, relatedFiles) {
    if (!aiService.deepseek && !aiService.gemini) return null;
    const snippets = readCandidateSnippets(proj.projectPath, relatedFiles, 5000);
    const codeContext = snippets.map((s) => `--- ARCHIVO: ${s.file} (${s.totalLines} líneas) ---\n${s.content}`).join('\n\n');

    const systemPrompt = `Eres AGY, el arquitecto de software autónomo de SIPE. Tu tarea es analizar el ticket #${ticket.ticket_code} del proyecto ${proj.projectLabel} y generar un Plan de Ejecución técnico conciso y exacto en Markdown.`;
    const userPrompt = [
        `Ticket: #${ticket.ticket_code} | Proyecto: ${proj.projectLabel} (${proj.projectPath})`,
        `Ruta reportada: ${ticket.page_url || 'N/A'} | Módulo: ${ticket.module_name || 'General'}`,
        `Asunto: ${ticket.subject}`,
        `Descripción: ${ticket.description}`,
        ticket.ai_notes ? `Directriz del Admin: ${ticket.ai_notes}` : '',
        `\nArchivos detectados:\n${relatedFiles.join('\n')}`,
        codeContext ? `\nExtracto de código actual:\n${codeContext}` : '',
        `\nGenera el Plan v${planVersion} con las secciones: ### 🎯 1. Diagnóstico de Causa Raíz, ### 📂 2. Archivos a Intervenir, ### 🛠️ 3. Pasos Exactos de Código a Aplicar.`
    ].filter(Boolean).join('\n');

    try {
        const resp = await aiService.generateFinalResponse({
            systemPrompt,
            history: [],
            finalPrompt: userPrompt
        });
        return resp?.content ? String(resp.content).trim() : null;
    } catch {
        return null;
    }
}

async function applyAiCodePatchAndBuild(ticket, proj, relatedFiles, onLog = () => {}) {
    const rootDir = proj.projectPath;
    if (!fs.existsSync(rootDir)) {
        return { modifiedFiles: [], buildSuccess: false, summary: `Directorio de proyecto ${rootDir} no disponible localmente.` };
    }

    const modifiedFiles = [];

    if (aiService.deepseek || aiService.gemini) {
        const snippets = readCandidateSnippets(rootDir, relatedFiles, 14000);
        if (snippets.length > 0) {
            onLog(`[AGY] Analizando y aplicando cambios en ${snippets.map((s) => s.file).join(', ')}...\n`);
            const systemPrompt = `Eres un motor de edición quirúrgica de código. Devuelve ÚNICAMENTE un JSON válido sin bloques markdown con el formato: {"edits":[{"file":"ruta/relativa.jsx","search":"bloque exacto existente","replace":"bloque nuevo corregido"}],"summary":"explicación breve del cambio aplicado"}. El campo "search" debe coincidir EXACTAMENTE carácter por carácter con el archivo original.`;
            const userPrompt = [
                `Ticket #${ticket.ticket_code} (${proj.projectLabel})`,
                `Asunto: ${ticket.subject}`,
                `Descripción: ${ticket.description}`,
                ticket.ai_notes ? `Directriz: ${ticket.ai_notes}` : '',
                `Plan aprobado:\n${ticket.agy_plan_markdown || ''}`,
                `\nContenido de archivos:\n`,
                ...snippets.map((s) => `=== FILE: ${s.file} ===\n${s.content}`)
            ].filter(Boolean).join('\n');

            try {
                const resp = await aiService.generateFinalResponse({ systemPrompt, history: [], finalPrompt: userPrompt });
                const rawJson = String(resp?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed?.edits)) {
                    for (const edit of parsed.edits) {
                        if (!edit.file || !edit.search || edit.replace === undefined) continue;
                        const safeRel = path.normalize(edit.file).replace(/^(\.\.(\/|\\|$))+/, '');
                        const absPath = path.resolve(rootDir, safeRel);
                        if (!absPath.startsWith(path.resolve(rootDir))) continue;
                        if (fs.existsSync(absPath)) {
                            const currentContent = fs.readFileSync(absPath, 'utf8');
                            if (currentContent.includes(edit.search)) {
                                const updatedContent = currentContent.replace(edit.search, edit.replace);
                                if (updatedContent !== currentContent) {
                                    fs.writeFileSync(absPath, updatedContent, 'utf8');
                                    modifiedFiles.push(safeRel.replace(/\\/g, '/'));
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                onLog(`[AGY] Aviso motor IA: ${err.message}\n`);
            }
        }
    }

    // Verificar git status por si AGY CLI o el motor IA modificó archivos
    try {
        const gitStatus = execSync('git status --porcelain', { cwd: rootDir, timeout: 8000 }).toString().trim();
        if (gitStatus) {
            for (const line of gitStatus.split('\n')) {
                const f = line.trim().split(/\s+/).pop();
                if (f && !f.endsWith('package-lock.json') && !modifiedFiles.includes(f)) {
                    modifiedFiles.push(f);
                }
            }
        }
    } catch { /* ignore */ }

    let buildSuccess = false;
    let buildLog = '';
    const frontendRel = proj.frontendDir;
    const frontendFull = path.join(rootDir, frontendRel);
    const hasFrontendChanges = modifiedFiles.some((f) => f.startsWith(`${frontendRel}/`));

    if (hasFrontendChanges && fs.existsSync(frontendFull)) {
        try {
            onLog(`[AGY] Compilando frontend (${frontendRel}) para publicar cambios en producción...\n`);
            const buildCmd = proj.isAdmin ? 'pnpm --filter frontend run build || npm --prefix frontend run build' : 'npm --prefix client run build || pnpm --filter client run build';
            execSync(buildCmd, { cwd: rootDir, timeout: 120000, stdio: 'pipe' });
            buildSuccess = true;
            buildLog = `Frontend (${frontendRel}/dist) recompilado y publicado en vivo.`;
            onLog(`[AGY] ✅ ${buildLog}\n`);
        } catch (bErr) {
            buildLog = `Aviso al compilar frontend: ${bErr.message?.slice(0, 160)}`;
            onLog(`[AGY] ⚠️ ${buildLog}\n`);
        }
    }

    return { modifiedFiles, buildSuccess, buildLog };
}

module.exports = {
    isTicketFromAdminProject,
    resolveProjectForTicket,
    findSmartRelatedFiles,
    generateAiPlanFromCode,
    applyAiCodePatchAndBuild
};
