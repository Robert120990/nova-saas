const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const aiService = require('./ai.service');
const { setAppVersion } = require('./websocket.service');
const { isTicketFromAdminProject, resolveProjectForTicket, findSmartRelatedFiles } = require('./ticketAgyRepoDiscovery.service');

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

function gitExec(cmd, rootDir, timeout = 15000) {
    return execSync(`git -c safe.directory="*" ${cmd}`, { cwd: rootDir, timeout, stdio: 'pipe' }).toString().trim();
}

function getGitHeadCommit(rootDir) {
    try { return gitExec('rev-parse HEAD', rootDir, 5000); } catch { return ''; }
}

function getGitDirtySet(rootDir) {
    const set = new Set();
    try {
        const gitStatus = gitExec('status --porcelain', rootDir, 8000);
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
        const branch = gitExec('rev-parse --abbrev-ref HEAD', rootDir, 5000) || 'main';
        const remotes = gitExec('remote', rootDir, 5000).split(/\s+/).filter(Boolean);
        gitExec('fetch --all --prune', rootDir, 20000);
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                gitExec(`pull --rebase --autostash ${rem} ${branch}`, rootDir, 30000);
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
            const quotedFiles = safeFiles.map((f) => `"${f.replace(/"/g, '')}"`).join(' ');
            gitExec(`add -- ${quotedFiles}`, rootDir, 15000);
            const staged = gitExec('diff --cached --name-only', rootDir, 8000);
            if (staged) {
                const cleanSubject = String(ticket.subject || 'ajuste solicitado').replace(/["`$\\]/g, '').slice(0, 72);
                gitExec(`-c user.name="AGY Server Bot" -c user.email="agy@sipesv.com" commit -m "fix(agy): resolver #${ticket.ticket_code} - ${cleanSubject}"`, rootDir, 15000);
            }
        }
        const commitHash = gitExec('rev-parse --short HEAD', rootDir, 5000);
        const branch = gitExec('rev-parse --abbrev-ref HEAD', rootDir, 5000) || 'main';
        const remotes = gitExec('remote', rootDir, 5000).split(/\s+/).filter(Boolean);
        const pushedRemotes = [];
        gitExec('fetch --all --prune', rootDir, 20000);
        for (const rem of ['upstream', 'origin'].filter((r) => remotes.includes(r))) {
            try {
                gitExec(`pull --rebase --autostash ${rem} ${branch}`, rootDir, 30000);
                gitExec(`push ${rem} ${branch}`, rootDir, 30000);
                pushedRemotes.push(`${rem}/${branch}`);
            } catch (pushErr) {
                onLog(`[AGY] ⚠️ Aviso push ${rem}/${branch}: ${pushErr.message?.slice(0, 120)}\n`);
            }
        }
        let version = bumpedVer;
        if (!proj?.isAdmin) {
            const count = parseInt(gitExec('rev-list --count HEAD', rootDir, 5000), 10);
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
            const committedDiff = gitExec(`diff --name-only ${preHeadCommit}..${postHeadCommit}`, rootDir, 8000);
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
                    const safeRel = path.normalize(edit.file).replace(/^(\.\.(\/|\\|$))+/, '');
                    if (safeRel.includes('.env') || safeRel.includes('node_modules')) continue;
                    const absPath = path.resolve(rootDir, safeRel);
                    if (!absPath.startsWith(path.resolve(rootDir)) || !fs.existsSync(absPath)) continue;
                    const currentContent = fs.readFileSync(absPath, 'utf8');
                    const updatedContent = applyFlexibleEdit(currentContent, String(edit.search), String(edit.replace));
                    if (updatedContent !== currentContent) {
                        fs.writeFileSync(absPath, updatedContent, 'utf8');
                        const normRel = safeRel.replace(/\\/g, '/');
                        if (!modifiedFiles.includes(normRel)) modifiedFiles.push(normRel);
                    }
                }
            } catch (err) {
                onLog(`[AGY] Aviso motor quirúrgico IA: ${err.message}\n`);
            }
        }
    }

    if (modifiedFiles.length === 0) return { modifiedFiles: [], buildSuccess: false, buildLog: '', commitHash: null, gitLog: '' };

    const { commitHash, version, gitLog } = syncGitCommitAndPush(rootDir, ticket, modifiedFiles, proj, onLog);
    let buildSuccess = false;
    let buildLog = '';
    const frontendRel = proj.frontendDir;
    const frontendFull = path.join(rootDir, frontendRel);
    const hasBackendChanges = modifiedFiles.some((f) => f.startsWith(`${proj.backendDir}/`));

    if (fs.existsSync(frontendFull)) {
        try {
            onLog(`[AGY] Compilando frontend (${frontendRel}) con versión ${version || commitHash || ''}...\n`);
            const buildCmd = proj.isAdmin
                ? 'export PATH="/home/sistemas/.local/share/pnpm:/usr/local/bin:$PATH"; pnpm --filter frontend run build || npm --prefix frontend run build'
                : 'npm --prefix client run build || pnpm --filter client run build';
            execSync(buildCmd, { cwd: rootDir, timeout: 150000, stdio: 'pipe', shell: process.platform === 'win32' ? undefined : '/bin/bash' });
            buildSuccess = true;
            buildLog = `Frontend (${frontendRel}/dist) recompilado (${version || commitHash}) y desplegado.`;
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
                const pm2Cmd = `export PATH="/home/sistemas/.local/share/pnpm:/usr/local/bin:$PATH"; pm2 reload ${proj.pm2AppName} --update-env || sudo -n -u sistemas /home/sistemas/.local/share/pnpm/pm2 reload ${proj.pm2AppName} --update-env || true`;
                const child = spawn('sh', ['-c', pm2Cmd], { cwd: rootDir, detached: true, stdio: 'ignore' });
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
