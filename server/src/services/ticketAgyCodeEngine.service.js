const fs = require('fs');
const path = require('path');
const { execSync, execFileSync, spawn } = require('child_process');
const aiService = require('./ai.service');
const { setAppVersion } = require('./websocket.service');
const { isTicketFromAdminProject, resolveProjectForTicket, findSmartRelatedFiles } = require('./ticketAgyRepoDiscovery.service');

const PROTECTED_AGY_PATTERNS = [
    /(^|\/)\.env(\.|$)/i,
    /(^|\/)\.git(\/|$)/i,
    /(^|\/)node_modules(\/|$)/i,
    /(^|\/)middleware\/auth\.js$/i,
    /(^|\/)middlewares\/auth\.middleware\.js$/i,
    /(^|\/)middleware\/bitacora\.js$/i,
    /(^|\/)ecosystem\.config\.js$/i,
    /(^|\/)deploy\.sh$/i,
    /(^|\/)webhook-server\.js$/i,
    /(^|\/)package(-lock)?\.json$/i,
    /(^|\/)pnpm-lock\.yaml$/i
];

function isSafeTargetRelPath(rootDir, candidateRel) {
    if (!candidateRel || typeof candidateRel !== 'string') return false;
    const clean = candidateRel.trim().replace(/\\/g, '/');
    if (!clean || clean.startsWith('/') || clean.includes('\0')) return false;
    const rootResolved = path.resolve(rootDir);
    const absPath = path.resolve(rootResolved, clean);
    const rel = path.relative(rootResolved, absPath).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
    if (PROTECTED_AGY_PATTERNS.some((rx) => rx.test(rel))) return false;
    return true;
}

function readCandidateSnippets(rootDir, relFiles = [], maxCharsPerFile = 85000, queryHint = '') {
    const snippets = [];
    const hintTerms = String(queryHint || '').toLowerCase().split(/[^a-z0-9_]+/).filter((w) => w.length >= 4);
    for (const rel of relFiles.slice(0, 5)) {
        const abs = path.join(rootDir, rel);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        try {
            const raw = fs.readFileSync(abs, 'utf8');
            const totalLines = raw.split('\n').length;
            if (raw.length <= maxCharsPerFile) {
                snippets.push({ file: rel, content: raw, totalLines });
            } else {
                const head = raw.slice(0, Math.floor(maxCharsPerFile * 0.45));
                let focusIdx = -1;
                for (const t of hintTerms) {
                    const idx = raw.toLowerCase().indexOf(t, head.length);
                    if (idx !== -1) { focusIdx = idx; break; }
                }
                const midStart = focusIdx !== -1 ? Math.max(head.length, focusIdx - 6000) : Math.max(head.length, raw.length - Math.floor(maxCharsPerFile * 0.5));
                const tail = raw.slice(midStart, midStart + Math.floor(maxCharsPerFile * 0.5));
                snippets.push({ file: rel, content: `${head}\n/* ... [sección intermedia omitida] ... */\n${tail}`, totalLines });
            }
        } catch { /* ignore */ }
    }
    return snippets;
}

async function generateAiPlanFromCode(ticket, model, planVersion, proj, relatedFiles) {
    const hint = `${ticket.subject || ''} ${ticket.description || ''} ${ticket.ai_notes || ''}`;
    const snippets = readCandidateSnippets(proj.projectPath, relatedFiles, 32000, hint);
    const codeContext = snippets.map((s) => `--- ARCHIVO: ${s.file} (${s.totalLines} líneas) ---\n${s.content}`).join('\n\n');
    const systemPrompt = `Eres AGY (${model}), arquitecto principal de software de SIPE. Analiza el código real adjunto para el ticket #${ticket.ticket_code} y redacta una propuesta de solución CONCISA, PRECISA Y EN LENGUAJE HUMANO en español (máximo 14 líneas) para Telegram. Sin bloques largos de código.`;
    const userPrompt = [
        `Ticket: #${ticket.ticket_code} | Proyecto: ${proj.projectLabel} | Modelo: ${model}`,
        `Ruta: ${ticket.page_url || 'N/A'} | Módulo: ${ticket.module_name || 'General'}`,
        `Asunto: ${ticket.subject} | Descripción: ${ticket.description}`,
        ticket.ai_notes ? `Directriz del Admin: ${ticket.ai_notes}` : '',
        `Archivos detectados:\n${relatedFiles.join('\n')}`,
        codeContext ? `Código actual en repositorio:\n${codeContext}` : '',
        `Estructura con: 🎯 Diagnóstico, 🛠️ Solución propuesta y 📂 Componentes.`
    ].filter(Boolean).join('\n');

    try {
        const resp = await aiService.generateCodeResponse({ systemPrompt, userPrompt, jsonMode: false });
        return resp?.content ? String(resp.content).trim() : null;
    } catch { return null; }
}

function gitExecArgs(args, rootDir, timeout = 15000) {
    return execFileSync('git', ['-c', 'safe.directory=*', ...args], { cwd: rootDir, timeout, stdio: 'pipe' }).toString().trim();
}

function getGitHeadCommit(rootDir) {
    try { return gitExecArgs(['rev-parse', 'HEAD'], rootDir, 5000); } catch { return ''; }
}

function getGitDirtySet(rootDir) {
    const set = new Set();
    try {
        const gitStatus = gitExecArgs(['status', '--porcelain'], rootDir, 8000);
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
        const branch = gitExecArgs(['rev-parse', '--abbrev-ref', 'HEAD'], rootDir, 5000) || 'main';
        const remotes = gitExecArgs(['remote'], rootDir, 5000).split(/\s+/).filter(Boolean);
        gitExecArgs(['fetch', '--all', '--prune'], rootDir, 20000);
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                gitExecArgs(['pull', '--rebase', '--autostash', rem, branch], rootDir, 30000);
                onLog(`[AGY] 🔄 Repositorio sincronizado con últimos cambios de ${rem}/${branch}.\n`);
                break;
            } catch { /* continue */ }
        }
    } catch { /* ignore */ }
}

function applyFlexibleEdit(currentContent, searchBlock, replaceBlock) {
    if (!searchBlock || currentContent === undefined) return currentContent;
    if (currentContent.includes(searchBlock)) return currentContent.replace(searchBlock, replaceBlock);
    const crlfSearch = searchBlock.replace(/\r?\n/g, '\r\n');
    if (currentContent.includes(crlfSearch)) return currentContent.replace(crlfSearch, replaceBlock.replace(/\r?\n/g, '\r\n'));

    const eol = currentContent.includes('\r\n') ? '\r\n' : '\n';
    const srcLines = currentContent.split(/\r?\n/);
    const searchLines = searchBlock.split(/\r?\n/).filter((l, idx, arr) => !(idx === arr.length - 1 && l === ''));
    if (searchLines.length >= 2) {
        const norm = (s) => s.trim();
        for (let i = 0; i <= srcLines.length - searchLines.length; i++) {
            let match = true;
            for (let j = 0; j < searchLines.length; j++) {
                if (norm(srcLines[i + j]) !== norm(searchLines[j])) { match = false; break; }
            }
            if (match) {
                const updatedLines = [...srcLines.slice(0, i), ...replaceBlock.split(/\r?\n/), ...srcLines.slice(i + searchLines.length)];
                return updatedLines.join(eol);
            }
        }
    }
    return currentContent;
}

function bumpAdminFrontendVersion(rootDir, modifiedFiles) {
    const pkgRel = 'frontend/package.json';
    const pkgFull = path.join(rootDir, pkgRel);
    if (!fs.existsSync(pkgFull)) return null;
    try {
        const pkgObj = JSON.parse(fs.readFileSync(pkgFull, 'utf8'));
        const parts = String(pkgObj.version || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);
        parts[2] = (parts[2] || 0) + 1;
        pkgObj.version = parts.join('.');
        fs.writeFileSync(pkgFull, `${JSON.stringify(pkgObj, null, 2)}\n`, 'utf8');
        if (!modifiedFiles.includes(pkgRel)) modifiedFiles.push(pkgRel);
        return `v${pkgObj.version}`;
    } catch { return null; }
}

function syncGitCommitAndPush(rootDir, ticket, modifiedFiles, proj, onLog = () => {}) {
    const safeFiles = modifiedFiles.filter((f) => f && !f.includes('.env') && !f.endsWith('package-lock.json') && !f.endsWith('pnpm-lock.yaml'));
    try {
        const bumpedVer = proj?.isAdmin ? bumpAdminFrontendVersion(rootDir, safeFiles) : null;
        if (safeFiles.length > 0) {
            gitExecArgs(['add', '--', ...safeFiles], rootDir, 15000);
            const staged = gitExecArgs(['diff', '--cached', '--name-only'], rootDir, 8000);
            if (staged) {
                const cleanCode = String(ticket.ticket_code || 'TICKET').replace(/[^A-Za-z0-9_-]/g, '');
                const cleanSubject = String(ticket.subject || 'ajuste solicitado').replace(/["`$\\\r\n]/g, ' ').trim().slice(0, 72);
                gitExecArgs(
                    ['-c', 'user.name=AGY Server Bot', '-c', 'user.email=agy@sipesv.com', 'commit', '-m', `fix(agy): resolver #${cleanCode} - ${cleanSubject}`],
                    rootDir,
                    15000
                );
            }
        }
        const commitHash = gitExecArgs(['rev-parse', '--short', 'HEAD'], rootDir, 5000);
        const branch = gitExecArgs(['rev-parse', '--abbrev-ref', 'HEAD'], rootDir, 5000) || 'main';
        const remotes = gitExecArgs(['remote'], rootDir, 5000).split(/\s+/).filter(Boolean);
        const pushedRemotes = [];
        gitExecArgs(['fetch', '--all', '--prune'], rootDir, 20000);
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                gitExecArgs(['pull', '--rebase', '--autostash', rem, branch], rootDir, 30000);
                gitExecArgs(['push', rem, branch], rootDir, 30000);
                pushedRemotes.push(`${rem}/${branch}`);
            } catch (pushErr) {
                onLog(`[AGY] ⚠️ Aviso push ${rem}/${branch}: ${pushErr.message?.slice(0, 120)}\n`);
            }
        }
        let version = bumpedVer;
        if (!proj?.isAdmin) {
            const count = parseInt(gitExecArgs(['rev-list', '--count', 'HEAD'], rootDir, 5000), 10);
            version = !isNaN(count) && count >= 1000 ? `v2.08.${String(count - 999).padStart(2, '0')}` : `v2.07.${String(count || 0).padStart(2, '0')}`;
            setAppVersion({ version, commit: commitHash });
        }
        const gitLog = pushedRemotes.length > 0
            ? `Commit ${commitHash} (${version || ''}) subido a GitHub (${pushedRemotes.join(', ')}).`
            : `Commit local ${commitHash} (${version || ''}) registrado.`;
        onLog(`[AGY] 🚀 ${gitLog}\n`);
        return { commitHash, version, gitLog };
    } catch (err) {
        const msg = `Aviso Git en servidor: ${err.message?.slice(0, 140)}`;
        onLog(`[AGY] ⚠️ ${msg}\n`);
        return { commitHash: null, version: null, gitLog: msg };
    }
}

function buildAgyReviewBranchName(ticketCode = '') {
    const slug = String(ticketCode || 'ticket').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'ticket';
    return `agy/ticket-${slug}`;
}

function resolveGithubCompareUrl(rootDir, baseBranch = 'main', reviewBranch = '') {
    if (!reviewBranch) return null;
    try {
        const remotes = gitExecArgs(['remote'], rootDir, 5000).split(/\s+/).filter(Boolean);
        const targetRemote = remotes.includes('upstream') ? 'upstream' : (remotes.includes('origin') ? 'origin' : null);
        if (!targetRemote) return null;
        const remoteUrl = gitExecArgs(['remote', 'get-url', targetRemote], rootDir, 5000);
        const match = remoteUrl.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/i);
        if (match && match[1]) {
            return `https://github.com/${match[1]}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(reviewBranch)}`;
        }
    } catch { /* ignore */ }
    return null;
}

function pushAgyReviewBranch(rootDir, ticket, modifiedFiles, onLog = () => {}) {
    const safeFiles = modifiedFiles.filter((f) => f && !f.includes('.env') && !f.endsWith('package-lock.json') && !f.endsWith('pnpm-lock.yaml'));
    const reviewBranch = buildAgyReviewBranchName(ticket.ticket_code);
    let baseBranch = 'main';
    let diffStat = '';
    try {
        const currentBranch = gitExecArgs(['rev-parse', '--abbrev-ref', 'HEAD'], rootDir, 5000) || 'main';
        baseBranch = currentBranch.startsWith('agy/ticket-') ? 'main' : currentBranch;
        try {
            diffStat = gitExecArgs(['diff', '--stat', '--', ...safeFiles], rootDir, 8000);
        } catch { /* ignore */ }

        gitExecArgs(['checkout', '-B', reviewBranch], rootDir, 10000);
        if (safeFiles.length > 0) {
            gitExecArgs(['add', '--', ...safeFiles], rootDir, 15000);
            const staged = gitExecArgs(['diff', '--cached', '--name-only'], rootDir, 8000);
            if (staged) {
                const cleanCode = String(ticket.ticket_code || 'TICKET').replace(/[^A-Za-z0-9_-]/g, '');
                const cleanSubject = String(ticket.subject || 'ajuste solicitado').replace(/["`$\\\r\n]/g, ' ').trim().slice(0, 72);
                gitExecArgs(
                    ['-c', 'user.name=AGY Server Bot', '-c', 'user.email=agy@sipesv.com', 'commit', '-m', `fix(agy): propuesta #${cleanCode} - ${cleanSubject}`],
                    rootDir,
                    15000
                );
            }
        }
        const commitHash = gitExecArgs(['rev-parse', '--short', 'HEAD'], rootDir, 5000);
        const remotes = gitExecArgs(['remote'], rootDir, 5000).split(/\s+/).filter(Boolean);
        const pushedRemotes = [];
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                gitExecArgs(['push', '-f', rem, reviewBranch], rootDir, 30000);
                pushedRemotes.push(`${rem}/${reviewBranch}`);
            } catch (pushErr) {
                onLog(`[AGY] ⚠️ Aviso push rama ${rem}/${reviewBranch}: ${pushErr.message?.slice(0, 120)}\n`);
            }
        }
        // Regresar de inmediato a main para mantener la copia viva intacta hasta aprobación humana
        gitExecArgs(['checkout', baseBranch], rootDir, 10000);
        const compareUrl = resolveGithubCompareUrl(rootDir, baseBranch, reviewBranch);
        const gitLog = pushedRemotes.length > 0
            ? `Rama de revisión ${reviewBranch} (${commitHash}) publicada en GitHub (${pushedRemotes.join(', ')}).`
            : `Rama de revisión local ${reviewBranch} (${commitHash}) lista para inspección.`;
        onLog(`[AGY] 🌿 ${gitLog}\n`);
        return { reviewBranch, baseBranch, commitHash, diffStat, compareUrl, gitLog };
    } catch (err) {
        try { gitExecArgs(['checkout', baseBranch], rootDir, 8000); } catch { /* ignore */ }
        const msg = `Aviso Git rama revisión: ${err.message?.slice(0, 140)}`;
        onLog(`[AGY] ⚠️ ${msg}\n`);
        return { reviewBranch, baseBranch, commitHash: null, diffStat, compareUrl: null, gitLog: msg };
    }
}

function mergeAgyReviewBranch(rootDir, ticket, proj, onLog = () => {}) {
    const reviewBranch = buildAgyReviewBranchName(ticket.ticket_code);
    let baseBranch = 'main';
    let bumpedVersion = null;
    try {
        const curBranch = gitExecArgs(['rev-parse', '--abbrev-ref', 'HEAD'], rootDir, 5000) || 'main';
        baseBranch = curBranch.startsWith('agy/ticket-') ? 'main' : curBranch;
        const remotes = gitExecArgs(['remote'], rootDir, 5000).split(/\s+/).filter(Boolean);
        const primaryRemote = remotes.includes('upstream') ? 'upstream' : (remotes.includes('origin') ? 'origin' : null);

        gitExecArgs(['fetch', '--all', '--prune'], rootDir, 20000);
        gitExecArgs(['checkout', baseBranch], rootDir, 10000);
        if (primaryRemote) {
            try { gitExecArgs(['pull', '--rebase', '--autostash', primaryRemote, baseBranch], rootDir, 30000); } catch { /* continue */ }
        }

        let mergeRef = reviewBranch;
        if (primaryRemote) {
            try {
                gitExecArgs(['rev-parse', '--verify', `${primaryRemote}/${reviewBranch}`], rootDir, 5000);
                mergeRef = `${primaryRemote}/${reviewBranch}`;
            } catch { /* fallback local branch */ }
        }

        const cleanCode = String(ticket.ticket_code || 'TICKET').replace(/[^A-Za-z0-9_-]/g, '');
        const cleanSubject = String(ticket.subject || 'ajuste solicitado').replace(/["`$\\\r\n]/g, ' ').trim().slice(0, 72);
        let touchedFiles = [];
        try {
            touchedFiles = gitExecArgs(['diff', '--name-only', `${baseBranch}...${mergeRef}`], rootDir, 8000).split('\n').filter(Boolean);
        } catch { /* ignore */ }

        gitExecArgs(
            ['-c', 'user.name=AGY Server Bot', '-c', 'user.email=agy@sipesv.com', 'merge', '--no-ff', mergeRef, '-m', `merge(agy): aprobar y publicar #${cleanCode} - ${cleanSubject}`],
            rootDir,
            20000
        );

        if (proj?.isAdmin) {
            const bumped = bumpAdminFrontendVersion(rootDir, []);
            if (bumped) {
                bumpedVersion = bumped;
                gitExecArgs(['add', '--', 'frontend/package.json'], rootDir, 10000);
                gitExecArgs(
                    ['-c', 'user.name=AGY Server Bot', '-c', 'user.email=agy@sipesv.com', 'commit', '-m', `chore: incrementar version a ${bumped.replace(/^v/, '')}`],
                    rootDir,
                    15000
                );
            }
        }

        const frontendRel = proj?.frontendDir || 'client';
        const frontendFull = path.join(rootDir, frontendRel);
        if (fs.existsSync(frontendFull)) {
            onLog(`[AGY] Compilando frontend (${frontendRel}) tras fusión en ${baseBranch}...\n`);
            const buildCmd = proj?.isAdmin
                ? 'export PATH="/home/sistemas/.local/share/pnpm:/usr/local/bin:$PATH"; pnpm --filter frontend run build || npm --prefix frontend run build'
                : 'npm --prefix client run build || pnpm --filter client run build';
            execSync(buildCmd, { cwd: rootDir, timeout: 150000, stdio: 'pipe', shell: process.platform === 'win32' ? undefined : '/bin/bash' });
        }

        const pushedRemotes = [];
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                gitExecArgs(['push', rem, baseBranch], rootDir, 30000);
                pushedRemotes.push(`${rem}/${baseBranch}`);
            } catch (pushErr) {
                onLog(`[AGY] ⚠️ Aviso push ${rem}/${baseBranch}: ${pushErr.message?.slice(0, 120)}\n`);
            }
            try { gitExecArgs(['push', rem, '--delete', reviewBranch], rootDir, 15000); } catch { /* ignore */ }
        }
        try { gitExecArgs(['branch', '-D', reviewBranch], rootDir, 8000); } catch { /* ignore */ }

        const commitHash = gitExecArgs(['rev-parse', '--short', 'HEAD'], rootDir, 5000);
        if (!proj?.isAdmin) {
            const count = parseInt(gitExecArgs(['rev-list', '--count', 'HEAD'], rootDir, 5000), 10);
            bumpedVersion = !isNaN(count) && count >= 1000 ? `v2.08.${String(count - 999).padStart(2, '0')}` : `v2.07.${String(count || 0).padStart(2, '0')}`;
            setAppVersion({ version: bumpedVersion, commit: commitHash });
        }

        const hasBackendChanges = touchedFiles.some((f) => f.startsWith(`${proj?.backendDir || 'server'}/`));
        if (hasBackendChanges) {
            const pm2Target = proj?.isAdmin ? 'sipeadmin-backend' : 'server';
            setTimeout(() => {
                try {
                    const pm2Cmd = `export PATH="/home/sistemas/.local/share/pnpm:/usr/local/bin:$PATH"; pm2 reload ${pm2Target} --update-env || pm2 reload sipewebgas-server --update-env || true`;
                    const child = spawn('sh', ['-c', pm2Cmd], { cwd: rootDir, detached: true, stdio: 'ignore' });
                    child.unref();
                } catch { /* ignore */ }
            }, 3000);
        }

        const summary = `Rama ${reviewBranch} fusionada en ${baseBranch} (${commitHash}${bumpedVersion ? ` · ${bumpedVersion}` : ''})${pushedRemotes.length ? ` y subida a ${pushedRemotes.join(', ')}` : ''}.`;
        return { success: true, reviewBranch, baseBranch, commitHash, version: bumpedVersion, touchedFiles, summary };
    } catch (err) {
        try { gitExecArgs(['merge', '--abort'], rootDir, 8000); } catch { /* ignore */ }
        return { success: false, reviewBranch, baseBranch, summary: `❌ No se pudo fusionar ${reviewBranch}: ${String(err.message || '').slice(0, 220)}` };
    }
}

function discardAgyReviewBranch(rootDir, ticket) {
    const reviewBranch = buildAgyReviewBranchName(ticket.ticket_code);
    if (fs.existsSync(rootDir)) {
        try { gitExecArgs(['checkout', 'main'], rootDir, 8000); } catch { /* ignore */ }
        try { gitExecArgs(['branch', '-D', reviewBranch], rootDir, 8000); } catch { /* ignore */ }
        try {
            const remotes = gitExecArgs(['remote'], rootDir, 5000).split(/\s+/).filter(Boolean);
            for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
                try { gitExecArgs(['push', rem, '--delete', reviewBranch], rootDir, 15000); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }
    return { success: true, reviewBranch, summary: `🗑️ Rama de revisión ${reviewBranch} descartada. Ningún cambio afectó main.` };
}

async function applyAiCodePatchAndBuild(ticket, proj, relatedFiles, onLog = () => {}, preExistingDirtySet = new Set(), preHeadCommit = '') {
    const rootDir = proj.projectPath;
    if (!fs.existsSync(rootDir)) return { modifiedFiles: [], buildSuccess: false, buildLog: `Ruta ${rootDir} no localizada`, gitLog: '' };

    const modifiedFiles = [];
    for (const f of getGitDirtySet(rootDir)) {
        if (!preExistingDirtySet.has(f) && !f.endsWith('package-lock.json') && !f.endsWith('pnpm-lock.yaml') && !f.includes('.env')) modifiedFiles.push(f);
    }
    const postHeadCommit = getGitHeadCommit(rootDir);
    if (preHeadCommit && postHeadCommit && preHeadCommit !== postHeadCommit) {
        try {
            const committedDiff = gitExecArgs(['diff', '--name-only', `${preHeadCommit}..${postHeadCommit}`], rootDir, 8000);
            for (const f of committedDiff ? committedDiff.split('\n') : []) {
                const norm = f.trim().replace(/\\/g, '/');
                if (norm && !modifiedFiles.includes(norm) && !norm.includes('.env')) modifiedFiles.push(norm);
            }
        } catch { /* ignore */ }
    }

    if (modifiedFiles.length === 0) {
        const hint = `${ticket.subject || ''} ${ticket.description || ''} ${ticket.ai_notes || ''}`;
        const snippets = readCandidateSnippets(rootDir, relatedFiles, 85000, hint);
        if (snippets.length > 0) {
            onLog(`[AGY] Aplicando motor quirúrgico de código en ${snippets.map((s) => s.file).join(', ')}...\n`);
            const systemPrompt = `Eres el motor de edición quirúrgica de código de AGY para ${proj.projectLabel}. Devuelve ÚNICAMENTE un objeto JSON válido con la estructura exacta: {"edits":[{"file":"ruta/relativa.jsx","search":"fragmento exacto actual en el archivo","replace":"fragmento nuevo con la mejora implementada"}],"summary":"resumen claro en español"}. Reglas: "search" debe existir literalmente en el archivo suministrado (incluye 3 a 8 líneas de contexto únicas); nunca edites .env ni credenciales.`;
            const userPrompt = [
                `Ticket #${ticket.ticket_code} (${proj.projectLabel}) | Ruta: ${ticket.page_url || 'N/A'} | Módulo: ${ticket.module_name || 'General'}`,
                `Asunto: ${ticket.subject}\nDescripción: ${ticket.description}`,
                ticket.ai_notes ? `Directriz Técnica del Administrador: ${ticket.ai_notes}` : '',
                `Plan de Ejecución Aprobado:\n${ticket.agy_plan_markdown || ''}`,
                ...snippets.map((s) => `=== FILE: ${s.file} ===\n${s.content}`)
            ].filter(Boolean).join('\n\n');

            try {
                const resp = await aiService.generateCodeResponse({ systemPrompt, userPrompt, jsonMode: true });
                const rawJson = String(resp?.content || '').replace(/```json/gi, '').replace(/```/g, '').trim();
                const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawJson);
                for (const edit of Array.isArray(parsed?.edits) ? parsed.edits : []) {
                    if (!edit.file || !edit.search || edit.replace === undefined) continue;
                    if (!isSafeTargetRelPath(rootDir, String(edit.file))) continue;
                    const absPath = path.resolve(rootDir, String(edit.file));
                    const normRel = path.relative(path.resolve(rootDir), absPath).replace(/\\/g, '/');
                    if (!fs.existsSync(absPath)) continue;
                    const currentContent = fs.readFileSync(absPath, 'utf8');
                    const updatedContent = applyFlexibleEdit(currentContent, String(edit.search), String(edit.replace));
                    if (updatedContent !== currentContent) {
                        fs.writeFileSync(absPath, updatedContent, 'utf8');
                        if (!modifiedFiles.includes(normRel)) modifiedFiles.push(normRel);
                    }
                }
            } catch (err) {
                onLog(`[AGY] Aviso motor quirúrgico IA: ${err.message}\n`);
            }
        }
    }

    if (modifiedFiles.length === 0) return { modifiedFiles: [], buildSuccess: false, buildLog: '', commitHash: null, gitLog: '' };

    // 1. Compilar y validar frontend ANTES de hacer commit/push a producción
    let buildSuccess = true;
    let buildLog = '';
    const frontendRel = proj.frontendDir;
    const frontendFull = path.join(rootDir, frontendRel);
    const hasBackendChanges = modifiedFiles.some((f) => f.startsWith(`${proj.backendDir}/`));

    if (fs.existsSync(frontendFull)) {
        try {
            onLog(`[AGY] Verificando compilación frontend (${frontendRel}) antes de publicar...\n`);
            const buildCmd = proj.isAdmin
                ? 'export PATH="/home/sistemas/.local/share/pnpm:/usr/local/bin:$PATH"; pnpm --filter frontend run build || npm --prefix frontend run build'
                : 'npm --prefix client run build || pnpm --filter client run build';
            execSync(buildCmd, { cwd: rootDir, timeout: 150000, stdio: 'pipe', shell: process.platform === 'win32' ? undefined : '/bin/bash' });
            buildSuccess = true;
            buildLog = `Frontend (${frontendRel}/dist) compilado sin errores.`;
            onLog(`[AGY] ✅ ${buildLog}\n`);
        } catch (bErr) {
            buildSuccess = false;
            buildLog = `Compilación frontend falló — commit/push cancelado para proteger producción: ${bErr.message?.slice(0, 180)}`;
            onLog(`[AGY] ❌ ${buildLog}\n`);
            try {
                gitExecArgs(['checkout', '--', ...modifiedFiles], rootDir, 10000);
            } catch { /* ignore rollback */ }
            return { modifiedFiles: [], buildSuccess: false, buildLog, commitHash: null, version: null, gitLog: '' };
        }
    }

    // 2. Publicar en rama de revisión agy/ticket-<codigo> por defecto (evita push ciego a main)
    if (process.env.AGY_DIRECT_MAIN !== 'true') {
        const rev = pushAgyReviewBranch(rootDir, ticket, modifiedFiles, onLog);
        return {
            awaitingMerge: true,
            reviewBranch: rev.reviewBranch,
            baseBranch: rev.baseBranch,
            diffStat: rev.diffStat,
            compareUrl: rev.compareUrl,
            modifiedFiles,
            buildSuccess,
            buildLog,
            commitHash: rev.commitHash,
            version: null,
            gitLog: rev.gitLog
        };
    }

    // 2b. Modo directo opcional (solo si AGY_DIRECT_MAIN=true)
    const { commitHash, version, gitLog } = syncGitCommitAndPush(rootDir, ticket, modifiedFiles, proj, onLog);
    if (buildSuccess && buildLog) {
        buildLog = `Frontend (${frontendRel}/dist) recompilado (${version || commitHash || 'ok'}) y desplegado.`;
    }

    if (hasBackendChanges && proj.pm2AppName) {
        buildLog = buildLog ? `${buildLog} Backend (${proj.pm2AppName}) recargado en vivo.` : `Backend (${proj.pm2AppName}) recargado en vivo.`;
        setTimeout(() => {
            try {
                const pm2Cmd = `export PATH="/home/sistemas/.local/share/pnpm:/usr/local/bin:$PATH"; pm2 reload ${proj.pm2AppName} --update-env || sudo -n -u sistemas /home/sistemas/.local/share/pnpm/pm2 reload ${proj.pm2AppName} --update-env || true`;
                const child = spawn('sh', ['-c', pm2Cmd], { cwd: rootDir, detached: true, stdio: 'ignore' });
                child.unref();
            } catch { /* ignore */ }
        }, 3000);
    }

    return { awaitingMerge: false, modifiedFiles, buildSuccess, buildLog, commitHash, version, gitLog };
}

module.exports = {
    isTicketFromAdminProject, resolveProjectForTicket, findSmartRelatedFiles,
    buildAgyReviewBranchName, resolveGithubCompareUrl, pushAgyReviewBranch,
    mergeAgyReviewBranch, discardAgyReviewBranch,
    generateAiPlanFromCode, applyAiCodePatchAndBuild, syncGitCommitAndPush,
    syncGitPullLatest, getGitDirtySet, getGitHeadCommit
};
