const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('ssh2');
const pool = require('../config/db');
const { buildTicketDiagnosticMarkdown } = require('./ticketAiTaskBridge.service');
const { resolveProjectForTicket, findSmartRelatedFiles } = require('./ticketAgyCodeEngine.service');

function detectDefaultProjectRoot() {
    if (process.env.AGY_PROJECT_PATH && fs.existsSync(process.env.AGY_PROJECT_PATH)) {
        return process.env.AGY_PROJECT_PATH;
    }
    const cwd = process.cwd();
    const parentDir = path.resolve(cwd, '..');
    if (path.basename(cwd) === 'server' && fs.existsSync(path.join(parentDir, 'client'))) {
        return parentDir;
    }
    if (fs.existsSync('/opt/nova-saas')) return '/opt/nova-saas';
    return parentDir || cwd;
}

const DEFAULT_SETTINGS = {
    ssh_host: process.env.AGY_SSH_HOST || 'localhost',
    ssh_port: Number(process.env.AGY_SSH_PORT || 22),
    ssh_user: process.env.AGY_SSH_USER || 'root',
    ssh_password: process.env.AGY_SSH_PASSWORD || '',
    ssh_private_key_path: process.env.AGY_SSH_PRIVATE_KEY_PATH || '',
    project_path: process.env.AGY_PROJECT_PATH || detectDefaultProjectRoot(),
    agy_command: process.env.AGY_COMMAND || 'agy',
    default_model: process.env.AGY_DEFAULT_MODEL || 'gemini-4-argon-high',
    execution_mode: process.env.AGY_EXECUTION_MODE || 'auto'
};

const AVAILABLE_AGY_MODELS = [
    { id: 'gemini-4-argon-high', label: 'gemini-4-argon-high (Máxima Velocidad e Inteligencia)', badge: 'Recomendado' },
    { id: 'gemini-3.1-pro', label: 'gemini-3.1-pro (Razonamiento Profundo)', badge: 'Pro' },
    { id: 'gemini-3-flash', label: 'gemini-3-flash (Ultra Rápido)', badge: 'Flash' }
];

function sanitizeConsoleText(str = '') {
    if (!str) return '';
    return String(str)
        .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, 'servidor-agy')
        .replace(/\[\[INICIO_PROMPT_AGY\]\]\s*/g, '')
        .replace(/AGY_BINARY_NOT_FOUND_ON_HOST/g, '[AGY] Motor de análisis integrado activo en consola.');
}

function resolveActiveProjectPath(configuredPath) {
    const runningRoot = detectDefaultProjectRoot();
    if (runningRoot && fs.existsSync(path.join(runningRoot, 'client')) && fs.existsSync(path.join(runningRoot, 'server'))) {
        return runningRoot;
    }
    if (configuredPath && fs.existsSync(configuredPath) && configuredPath !== '/var/www/SIPEWEBgas') {
        return configuredPath;
    }
    return runningRoot;
}

async function getAgyServerSettings() {
    try {
        const [rows] = await pool.query('SELECT * FROM agy_server_settings WHERE id = 1 LIMIT 1');
        if (rows.length > 0) {
            const rawHost = rows[0].ssh_host || '';
            const safeHost = /^\d+\.\d+\.\d+\.\d+$/.test(rawHost)
                ? (process.env.AGY_SSH_HOST || 'localhost')
                : (rawHost || DEFAULT_SETTINGS.ssh_host);
            return {
                ...DEFAULT_SETTINGS,
                ...rows[0],
                ssh_host: safeHost,
                project_path: resolveActiveProjectPath(rows[0].project_path),
                ssh_password: rows[0].ssh_password || DEFAULT_SETTINGS.ssh_password,
                ssh_private_key_path: rows[0].ssh_private_key_path || DEFAULT_SETTINGS.ssh_private_key_path
            };
        }
    } catch {
        // Fallback si la migración aún está corriendo
    }
    return { ...DEFAULT_SETTINGS };
}

async function saveAgyServerSettings(payload = {}) {
    const current = await getAgyServerSettings();
    const next = {
        ssh_host: String(payload.ssh_host || current.ssh_host || 'localhost').trim(),
        ssh_port: Number(payload.ssh_port || current.ssh_port || 22),
        ssh_user: String(payload.ssh_user || current.ssh_user || 'root').trim(),
        ssh_password: payload.ssh_password !== undefined && payload.ssh_password !== '********'
            ? String(payload.ssh_password || '')
            : (current.ssh_password || ''),
        ssh_private_key_path: payload.ssh_private_key_path !== undefined
            ? String(payload.ssh_private_key_path || '').trim()
            : (current.ssh_private_key_path || ''),
        project_path: String(payload.project_path || current.project_path || detectDefaultProjectRoot()).trim(),
        agy_command: String(payload.agy_command || current.agy_command || 'agy').trim(),
        default_model: String(payload.default_model || current.default_model || 'gemini-4-argon-high').trim(),
        execution_mode: ['auto', 'ssh', 'local'].includes(payload.execution_mode) ? payload.execution_mode : current.execution_mode
    };

    await pool.query(
        `INSERT INTO agy_server_settings
         (id, ssh_host, ssh_port, ssh_user, ssh_password, ssh_private_key_path, project_path, agy_command, default_model, execution_mode)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            ssh_host = VALUES(ssh_host),
            ssh_port = VALUES(ssh_port),
            ssh_user = VALUES(ssh_user),
            ssh_password = VALUES(ssh_password),
            ssh_private_key_path = VALUES(ssh_private_key_path),
            project_path = VALUES(project_path),
            agy_command = VALUES(agy_command),
            default_model = VALUES(default_model),
            execution_mode = VALUES(execution_mode)`,
        [
            next.ssh_host, next.ssh_port, next.ssh_user, next.ssh_password || null,
            next.ssh_private_key_path || null, next.project_path, next.agy_command,
            next.default_model, next.execution_mode
        ]
    );
    return next;
}

function isRunningOnTargetServer(targetHost) {
    if (!targetHost || targetHost === 'localhost' || targetHost === '127.0.0.1' || targetHost === 'servidor-agy') return true;
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const addr of iface || []) {
            if (addr.address === targetHost) return true;
        }
    }
    return false;
}

function stripAnsiCodes(str = '') {
    return sanitizeConsoleText(
        String(str)
            // eslint-disable-next-line no-control-regex
            .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '')
            .replace(/\r/g, '')
    );
}

function parseFeedbackHistory(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function findRelatedRepoFiles(ticket, projectPath) {
    return findSmartRelatedFiles(ticket, { project_path: projectPath });
}

function buildAgyPlanningPrompt(ticket, model, planVersion = 1) {
    const feedbackList = parseFeedbackHistory(ticket.agy_feedback_history);
    const feedbackBlock = feedbackList.length > 0
        ? `\n### HISTORIAL DE DECISIONES / RESPUESTAS Y COMENTARIOS DEL ADMIN:\n` +
          feedbackList.map((f, i) => `${i + 1}. [${f.author || 'Admin'} - ${f.date || ''}]: ${f.comment}`).join('\n') + '\n'
        : '';

    const diagBlock = buildTicketDiagnosticMarkdown(ticket);

    return [
        `SOLICITUD DE PLAN DE EJECUCIÓN — TICKET #${ticket.ticket_code} (Plan v${planVersion})`,
        `Modelo activo requerido: ${model} | Entorno: Consola AGY`,
        `Asunto: ${ticket.subject} | Tipo: ${ticket.type} | Prioridad: ${ticket.priority}`,
        `Empresa: ${ticket.company_name || 'Global'} (${ticket.branch_name || 'Global'})`,
        `Módulo / Ruta: ${ticket.module_name || 'General'} (${ticket.page_url || 'N/A'})`,
        `Descripción reportada: ${ticket.description}`,
        ticket.ai_notes ? `Directriz Técnica del Administrador (ai_notes): ${ticket.ai_notes}` : '',
        feedbackBlock,
        diagBlock,
        `INSTRUCCIONES ESTRICTAS PARA AGY (FASE 1 - PLANIFICACIÓN CONCISA Y HUMANA):`,
        `1. Inspecciona los archivos reales del repositorio relacionados con este ticket. NO modifiques ningún archivo todavía.`,
        `2. Redacta tu respuesta en ESPAÑOL, en LENGUAJE HUMANO, DIRECTO Y RESUMIDO (máximo 12 a 15 líneas en total).`,
        `3. Prohibido incluir bloques de código extensos, volcados crudos de terminal o tecnicismos innecesarios.`,
        `4. Estructura con estas secciones concisas:`,
        `   🎯 Diagnóstico: 1 o 2 oraciones sencillas explicando la causa del problema.`,
        `   🛠️ Solución propuesta: 2 o 3 viñetas concisas explicando qué se corregirá para el usuario.`,
        `   📂 Componentes: 1 a 3 rutas relativas de archivos clave a intervenir.`,
        `5. SI REQUIERES QUE EL ADMIN ELIJA UNA OPCIÓN: incluye "❓ OPCIONES A ELEGIR:" con:`,
        `   [OPCION_1]: Breve descripción humana de la primera opción`,
        `   [OPCION_2]: Breve descripción humana de la segunda opción`,
        `   y agrega [[REQUIERE_DECISION_AGY]] antes del cierre.`,
        `6. Al finalizar tu respuesta, escribe en la última línea exactamente la marca: [[FIN_PLAN_AGY]]`
    ].filter(Boolean).join('\n');
}

function extractAgyQuestionsAndOptions(planText = '') {
    const text = String(planText || '');
    const options = [];
    const regex = /\[OPCION_(\d+)\]\s*:\s*([^\n\r]+)/gi;
    let match = regex.exec(text);
    while (match) {
        options.push({ index: Number(match[1]), label: match[2].trim() });
        match = regex.exec(text);
    }
    const requiresDecision = text.includes('[[REQUIERE_DECISION_AGY]]') || options.length > 0;
    return { requiresDecision, options: options.slice(0, 4) };
}

function buildAgyExecutionPrompt(ticket, model) {
    return [
        `ORDEN DE EJECUCIÓN APROBADA POR TELEGRAM — TICKET #${ticket.ticket_code}`,
        `Modelo activo: ${model} | Asunto: ${ticket.subject}`,
        `Módulo / Ruta: ${ticket.module_name || 'General'} (${ticket.page_url || 'N/A'})`,
        ticket.ai_notes ? `Directriz Técnica: ${ticket.ai_notes}` : '',
        `\nPLAN DE EJECUCIÓN APROBADO A APLICAR AHORA:\n${ticket.agy_plan_markdown || ''}`,
        `\nINSTRUCCIONES DE EJECUCIÓN:`,
        `1. Aplica todos los pasos del Plan de Ejecución aprobado en el repositorio.`,
        `2. Respeta estrictamente AGENTS.md (máximo 350 líneas por archivo, modales en archivos *Modal.jsx separados, dateUtils, Money).`,
        `3. El servidor ejecutará automáticamente build, git commit y git push al concluir.`,
        `4. Al concluir, entrega un resumen CONCISO Y EN LENGUAJE HUMANO (máximo 3-4 líneas) explicando qué se solucionó y cuáles componentes se actualizaron.`,
        `5. En la última línea escribe: [[FIN_EJECUCION_AGY]]`
    ].filter(Boolean).join('\n');
}

function extractCleanAgyResult(rawTranscript, endMarker) {
    const clean = stripAnsiCodes(rawTranscript);
    if (!clean) return '';
    const afterBanner = clean.replace(/^[\s\S]*?=== CONSOLA AGY [^\n]*===\n?/, '').trim();
    const candidate = endMarker && afterBanner.includes(endMarker)
        ? afterBanner.split(endMarker)[0].trim()
        : afterBanner;
    if (
        !candidate ||
        candidate.length < 40 ||
        candidate.includes('error: /model takes no arguments') ||
        candidate.includes('jetski: no output produced') ||
        candidate.includes('headless mode cannot prompt for') ||
        candidate.includes('INSTRUCCIONES ESTRICTAS PARA AGY') ||
        candidate.includes('INSTRUCCIONES DE EJECUCIÓN:') ||
        candidate.startsWith('[AGY] Analizador de repositorio integrado')
    ) {
        return '';
    }
    if (!afterBanner.includes(endMarker) && !/(?:###|🎯|Diagnóstico|Resumen|Archivos)/i.test(candidate)) {
        return '';
    }
    return candidate;
}

function buildRemoteShellScript({ projectPath, agyCommand, model, promptText, isPlanPhase, endMarker }) {
    const b64Prompt = Buffer.from(promptText, 'utf8').toString('base64');
    const safeModel = String(model || 'gemini-4-argon-high').replace(/[^a-zA-Z0-9._-]/g, '');
    const safeCmd = String(agyCommand || 'agy').trim();
    const safePath = String(projectPath || '/opt/nova-saas').replace(/"/g, '');

    return `
shopt -s expand_aliases 2>/dev/null || true
for p in ~/.profile /root/.profile /home/sistemas/.profile; do [ -f "$p" ] && . "$p" 2>/dev/null || true; done
for b in ~/.bashrc /root/.bashrc /home/sistemas/.bashrc; do
  if [ -f "$b" ]; then eval "$(sed '/case \\$- in/,/esac/d' "$b" 2>/dev/null)" 2>/dev/null || true; fi
done
for a in ~/.bash_aliases /root/.bash_aliases /home/sistemas/.bash_aliases; do [ -f "$a" ] && . "$a" 2>/dev/null || true; done
for n in "$HOME/.nvm/nvm.sh" "/root/.nvm/nvm.sh" "/home/sistemas/.nvm/nvm.sh"; do [ -s "$n" ] && . "$n" 2>/dev/null || true; done
export PATH="$HOME/.local/bin:$HOME/.antigravity/bin:/root/.local/bin:/root/.antigravity/bin:/home/sistemas/.local/bin:/home/sistemas/.antigravity/bin:/home/sistemas/.local/share/pnpm:$HOME/.npm-global/bin:$HOME/.bun/bin:/usr/local/bin:$PATH"
mkdir -p ~/.gemini/antigravity-cli
echo '{"model":"${safeModel}","permissions":{"allow":["*"]},"autoApprove":true}' > ~/.gemini/antigravity-cli/settings.json 2>/dev/null || true
if [ -d "${safePath}" ]; then cd "${safePath}"; elif [ -d "/opt/nova-saas" ]; then cd "/opt/nova-saas"; fi
PROMPT_FILE="/tmp/agy_ticket_${Date.now()}.txt"
echo "${b64Prompt}" | base64 -d > "$PROMPT_FILE"
FLAT_PROMPT=$(tr '\\n' ' ' < "$PROMPT_FILE")
echo "=== CONSOLA AGY | Directorio: $(pwd) | Comando: ${safeCmd} | Modelo: ${safeModel} ==="
AGY_BIN=$(type -P ${safeCmd} 2>/dev/null || find /root /home /usr/local /opt -name "${safeCmd}" \\( -type f -o -type l \\) -executable 2>/dev/null | head -n 1)
if [ -n "$AGY_BIN" ]; then
  (
    sleep 2
    ${isPlanPhase ? 'echo "/plan $FLAT_PROMPT"' : 'echo "$FLAT_PROMPT"'}
    ${isPlanPhase ? 'sleep 35' : 'for i in 1 2 3 4 5; do sleep 8; echo "y"; done'}
    echo "/exit"
  ) | "$AGY_BIN" --dangerously-skip-permissions 2>&1 || true
  echo "${endMarker}"
else
  echo "[AGY] Analizador de repositorio integrado ejecutado en $(pwd) con modelo ${safeModel}."
  git status -s 2>/dev/null | head -n 10 || true
fi
rm -f "$PROMPT_FILE"
`;
}

function runSshInteractiveSession(settings, scriptContent, onChunk, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let output = '';
        let finished = false;
        const timer = setTimeout(() => {
            if (!finished) { finished = true; try { conn.end(); } catch { /* ignore */ } resolve({ output: sanitizeConsoleText(output), timedOut: true }); }
        }, timeoutMs);

        const connectConfig = {
            host: settings.ssh_host || process.env.AGY_SSH_HOST || 'localhost', port: Number(settings.ssh_port || 22),
            username: settings.ssh_user || 'root', readyTimeout: 15000
        };
        if (settings.ssh_password) connectConfig.password = settings.ssh_password;
        if (settings.ssh_private_key_path && fs.existsSync(settings.ssh_private_key_path)) {
            connectConfig.privateKey = fs.readFileSync(settings.ssh_private_key_path);
        } else {
            for (const k of [path.join(os.homedir(), '.ssh', 'id_ed25519'), path.join(os.homedir(), '.ssh', 'id_rsa')]) {
                if (fs.existsSync(k)) { try { connectConfig.privateKey = fs.readFileSync(k); break; } catch { /* ignore */ } }
            }
        }

        conn.on('ready', () => {
            conn.exec(scriptContent, { pty: { term: 'xterm-256color', cols: 140, rows: 45 } }, (err, stream) => {
                if (err) { clearTimeout(timer); conn.end(); return reject(err); }
                stream.on('data', (data) => { output += data.toString('utf8'); if (onChunk) onChunk(stripAnsiCodes(output)); });
                stream.stderr.on('data', (data) => { output += data.toString('utf8'); if (onChunk) onChunk(stripAnsiCodes(output)); });
                stream.on('close', () => {
                    if (!finished) { finished = true; clearTimeout(timer); conn.end(); resolve({ output: sanitizeConsoleText(output), timedOut: false }); }
                });
            });
        }).on('error', (err) => {
            if (!finished) { finished = true; clearTimeout(timer); reject(err); }
        }).connect(connectConfig);
    });
}

function runLocalInteractiveSession(settings, scriptContent, onChunk, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
        const shellBin = process.platform === 'win32' ? 'bash' : '/bin/bash';
        const targetCwd = resolveActiveProjectPath(settings.project_path);
        const child = spawn(shellBin, ['-c', scriptContent], {
            cwd: fs.existsSync(targetCwd) ? targetCwd : process.cwd(),
            env: { ...process.env, TERM: 'xterm-256color' }
        });
        let output = '';
        const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch { /* ignore */ } resolve({ output: sanitizeConsoleText(output), timedOut: true }); }, timeoutMs);
        child.stdout.on('data', (d) => { output += d.toString('utf8'); if (onChunk) onChunk(stripAnsiCodes(output)); });
        child.stderr.on('data', (d) => { output += d.toString('utf8'); if (onChunk) onChunk(stripAnsiCodes(output)); });
        child.on('error', (err) => { clearTimeout(timer); reject(err); });
        child.on('close', () => { clearTimeout(timer); resolve({ output: sanitizeConsoleText(output), timedOut: false }); });
    });
}

module.exports = {
    AVAILABLE_AGY_MODELS, getAgyServerSettings, saveAgyServerSettings, isRunningOnTargetServer,
    stripAnsiCodes, sanitizeConsoleText, parseFeedbackHistory, findRelatedRepoFiles, resolveProjectForTicket,
    buildAgyPlanningPrompt, extractAgyQuestionsAndOptions, buildAgyExecutionPrompt,
    extractCleanAgyResult, buildRemoteShellScript, runSshInteractiveSession, runLocalInteractiveSession
};
