const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const ticketService = require('../services/ticket.service');
const ticketAiTaskBridge = require('../services/ticketAiTaskBridge.service');
const agentTaskQueue = require('../services/agents/agentTaskQueue.service');
const { getPlatformMeta } = require('../services/aiPromptBuilder.service');

function parseJsonSafe(val, fallback = null) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
}

function buildAiPromptMarkdown(tickets = [], extraContext = '', agentPlatform = 'antigravity', aiMode = 'agent_prompt') {
    const nowStr = new Date().toLocaleString('es-SV');
    const plat = getPlatformMeta(agentPlatform);
    const modeTitle = aiMode === 'api'
        ? '⚡ MODO 1: EJECUCIÓN POR API INTERNA (AGENTES GEMINI)'
        : `${plat.icon} MODO 2: PAQUETE DE PROMPT + LOGS PARA ${plat.name.toUpperCase()}`;

    const lines = [
        `# ${modeTitle}`,
        `> Generado: ${nowStr} | Plataforma Destino: **${plat.name}** | Total de tickets: **${tickets.length}**`,
        `> ${plat.headerNote}`,
        '',
        'Analiza y resuelve cada uno de los siguientes tickets seleccionados tras la revisión técnica.',
        'Para cada ticket se incluye: el reporte original, la **Directriz Técnica**, las rutas locales de las capturas WebP, los **Logs Cargados por el Usuario** y el **Log de Diagnóstico Automático**.',
        ''
    ];

    if (extraContext && String(extraContext).trim()) {
        lines.push('## Contexto / Instrucción General del Lote');
        lines.push(String(extraContext).trim());
        lines.push('');
    }

    tickets.forEach((t, idx) => {
        const attachments = parseJsonSafe(t.attachments_json, []);
        const listAtt = Array.isArray(attachments) && attachments.length > 0
            ? attachments
            : (t.screenshot_url ? [{ url: t.screenshot_url, caption: '', annotated: false }] : []);
        const diag = parseJsonSafe(t.diagnostics_json, null);

        lines.push('---');
        lines.push(`## ${idx + 1}. Ticket #${t.ticket_code} — ${t.subject}`);
        lines.push(`- **Tipo:** \`${t.type}\` | **Prioridad:** \`${t.priority}\` | **Estado actual:** \`${t.status}\` | **Modo IA:** \`${t.ai_mode || aiMode}\``);
        lines.push(`- **Módulo / Pantalla:** ${t.module_name || 'General'} (\`${t.page_url || '/'}\`)`);
        lines.push(`- **Reportado por:** ${t.user_name} (${t.company_name || 'Empresa'})`);
        lines.push('');
        lines.push('### 📝 Descripción del Usuario');
        lines.push(t.description || t.subject);
        lines.push('');

        lines.push('### 🎯 DIRECTRIZ / COMENTARIO TÉCNICO PARA LA IA');
        lines.push(
            t.ai_notes && String(t.ai_notes).trim()
                ? `**Instrucción de revisión:** ${String(t.ai_notes).trim()}`
                : '_Sin comentario adicional del revisor; resolver según la descripción, captura anotada y logs adjuntos._'
        );
        lines.push('');

        if (listAtt.length > 0) {
            lines.push('### 🖼️ Capturas de Pantalla Adjuntas (Formato Liviano WebP)');
            listAtt.forEach((att, i) => {
                const relPath = String(att.url || '').replace(/^\/+/, '').replace(/^api\/+/, '');
                const localServerPath = `server/${relPath}`;
                const flags = att.annotated ? ' [CON TRAZOS/FLECHAS DE SEÑALIZACIÓN]' : '';
                const cap = att.caption ? ` — Nota en imagen: "${att.caption}"` : '';
                lines.push(`- Captura #${i + 1}${flags}: \`${localServerPath}\`${cap}`);
            });
            lines.push('');
        }

        if (t.custom_logs && String(t.custom_logs).trim()) {
            lines.push('### 📎 Logs Cargados Manualmente por el Usuario (Consola / Servidor / Stack Trace)');
            lines.push('```log');
            lines.push(String(t.custom_logs).trim().slice(0, 10000));
            lines.push('```');
            lines.push('');
        }

        if (diag && (diag.relevance !== 'sin_errores' || (diag.networkFailures?.length || 0) > 0 || (diag.consoleErrors?.length || 0) > 0)) {
            lines.push(`### 🚨 Log del Explorador y Operaciones Fallidas (Correlación: ${(diag.relevance || 'N/A').toUpperCase()} - ${diag.score || 0}%)`);
            if (diag.explanation) {
                lines.push(`- **Veredicto Automático:** ${diag.explanation}`);
            }
            const netList = Array.isArray(diag.networkFailures) ? diag.networkFailures : [];
            if (netList.length > 0) {
                lines.push('- **Operaciones HTTP/API Fallidas:**');
                netList.slice(0, 5).forEach((n) => {
                    lines.push(`  - \`${n.method} ${n.url}\` → **HTTP ${n.status || 'ERR'}** (${n.isRelated ? `Relacionado ${n.relevanceScore}%` : `Baja relación ${n.relevanceScore}%`}): "${n.backendMessage}" [Ruta: \`${n.route || '/'}\`]`);
                });
            }
            const conList = Array.isArray(diag.consoleErrors) ? diag.consoleErrors : [];
            if (conList.length > 0) {
                lines.push('- **Errores en Consola JS / Runtime:**');
                conList.slice(0, 5).forEach((c) => {
                    lines.push(`  - \`[${c.kind}]\` (${c.isRelated ? `Relacionado ${c.relevanceScore}%` : `${c.relevanceScore}%`}): \`${c.message}\` [Ruta: \`${c.route || '/'}\`]`);
                });
            }
            lines.push('');
        }
    });

    lines.push('---');
    lines.push('## Requisitos de Entrega para la IA');
    lines.push('1. Aplica las correcciones o mejoras correspondientes en los archivos de `client/`, `server/` o `database/` según cada ticket.');
    lines.push('2. Respeta las reglas de arquitectura de `AGENTS.md` (límite de 350 líneas por archivo, cero modales inline, uso de `unwrapList`, `dateUtils` y `<Money>`).');
    lines.push('3. Verifica que `npx eslint` y `npm run build` finalicen con **0 errores** e indícalo detallando qué se solucionó en cada código `TKT-XXXX`.');

    return lines.join('\n');
}

async function checkIsTechManager(req) {
    if (req.user?.role === 'SuperAdmin') return true;
    const rl = (req.user?.role || '').toLowerCase();
    if (rl.includes('admin') || rl.includes('soporte') || rl.includes('tecnic') || rl.includes('técnic') || rl.includes('sistemas')) return true;
    try {
        const companyId = req.companyId || req.company_id;
        const [rows] = await pool.query(
            `SELECT r.permissions FROM usuario_empresa ue JOIN roles r ON r.id = ue.role_id WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND ue.has_access = 1 LIMIT 1`,
            [req.user?.id, companyId]
        );
        const perms = rows[0]?.permissions ? (typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions) : rows[0].permissions) : [];
        return Array.isArray(perms) && (perms.includes('manage_support_tickets') || perms.includes('manage_system'));
    } catch { return false; }
}

const updateTicketAiReview = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) return res.status(403).json({ message: 'Requiere permisos de gestión técnica de tickets' });
        const { id } = req.params;
        const { include_in_ai_prompt, ai_notes, ai_mode, agent_platform, custom_logs } = req.body;
        const ticket = await ticketService.getTicketById(id);
        if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

        const reqCompanyId = req.companyId || req.company_id;
        if (req.user?.role !== 'SuperAdmin' && reqCompanyId && Number(ticket.company_id) !== Number(reqCompanyId)) {
            return res.status(403).json({ message: 'No tienes autorización para modificar tickets de otra empresa' });
        }

        const updates = [];
        const params = [];
        if (include_in_ai_prompt !== undefined) { updates.push('include_in_ai_prompt = ?'); params.push(include_in_ai_prompt ? 1 : 0); }
        if (ai_notes !== undefined) { updates.push('ai_notes = ?'); params.push(ai_notes === null ? null : String(ai_notes)); }
        if (ai_mode !== undefined && ['api', 'agent_prompt'].includes(ai_mode)) { updates.push('ai_mode = ?'); params.push(ai_mode); }
        if (agent_platform !== undefined && ['antigravity', 'cursor', 'claude_code', 'universal'].includes(agent_platform)) {
            updates.push('agent_platform = ?'); params.push(agent_platform);
        }
        if (custom_logs !== undefined) { updates.push('custom_logs = ?'); params.push(custom_logs === null ? null : String(custom_logs)); }
        if (updates.length > 0) {
            params.push(id);
            await pool.query(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        const updated = await ticketService.getTicketById(id);
        const taskId = await ticketAiTaskBridge.syncTicketToAiTask(updated, { forceSync: true });
        if (ai_mode === 'api' && taskId) {
            await agentTaskQueue.retryTask(taskId, updated.company_id).catch(() => {});
        }
        res.json({ success: true, data: updated, ticket: updated });
    } catch (error) {
        console.error('Error updateTicketAiReview:', error);
        res.status(500).json({ message: 'Error al guardar revisión para IA en el ticket' });
    }
};

const getAiBundleTickets = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) return res.status(403).json({ message: 'Requiere permisos de gestión técnica de tickets' });
        const { ids = '', agent_platform = 'antigravity', ai_mode = 'agent_prompt' } = req.query;
        const idList = String(ids).split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const reqCompanyId = req.companyId || req.company_id;
        const tenantFilter = !isSuperAdmin && reqCompanyId ? ' AND t.company_id = ?' : '';
        const tenantParams = !isSuperAdmin && reqCompanyId ? [reqCompanyId] : [];
        const baseSql = `SELECT t.*, t.ticket_code AS code, c.razon_social AS company_name FROM support_tickets t LEFT JOIN companies c ON c.id = t.company_id`;
        const [rows] = idList.length > 0
            ? await pool.query(`${baseSql} WHERE t.id IN (?)${tenantFilter} ORDER BY FIELD(t.priority, 'urgente', 'alta', 'media', 'baja'), t.id ASC`, [idList, ...tenantParams])
            : await pool.query(`${baseSql} WHERE t.include_in_ai_prompt = 1 AND t.status NOT IN ('cerrado', 'rechazado')${tenantFilter} ORDER BY FIELD(t.priority, 'urgente', 'alta', 'media', 'baja'), t.id ASC`, tenantParams);

        const promptMarkdown = buildAiPromptMarkdown(rows, '', agent_platform, ai_mode);
        res.json({ data: rows, total: rows.length, promptMarkdown });
    } catch (error) {
        console.error('Error getAiBundleTickets:', error);
        res.status(500).json({ message: 'Error al obtener paquete de tickets para IA' });
    }
};

const saveAndGenerateAiBundle = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) return res.status(403).json({ message: 'Requiere permisos de gestión técnica de tickets' });
        const { items = [], extraContext = '', ai_mode = 'agent_prompt', agent_platform = 'antigravity' } = req.body;
        const selectedIds = [];
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const reqCompanyId = req.companyId || req.company_id;
        const cleanMode = ai_mode === 'api' ? 'api' : 'agent_prompt';
        const cleanPlat = ['antigravity', 'cursor', 'claude_code', 'universal'].includes(agent_platform) ? agent_platform : 'antigravity';

        if (Array.isArray(items)) {
            for (const item of items) {
                if (!item?.id) continue;
                const inc = item.include_in_ai_prompt !== undefined ? (item.include_in_ai_prompt ? 1 : 0) : 1;
                const notes = item.ai_notes !== undefined ? String(item.ai_notes || '') : null;
                const logs = item.custom_logs !== undefined ? (item.custom_logs ? String(item.custom_logs) : null) : undefined;
                const itemMode = item.ai_mode || cleanMode;
                const itemPlat = item.agent_platform || cleanPlat;
                const tenantWhere = !isSuperAdmin && reqCompanyId ? ' AND company_id = ?' : '';
                const tParams = !isSuperAdmin && reqCompanyId ? [reqCompanyId] : [];

                if (logs !== undefined) {
                    await pool.query(
                        `UPDATE support_tickets SET include_in_ai_prompt = ?, ai_notes = COALESCE(?, ai_notes), ai_mode = ?, agent_platform = ?, custom_logs = ? WHERE id = ?${tenantWhere}`,
                        [inc, notes, itemMode, itemPlat, logs, item.id, ...tParams]
                    );
                } else {
                    await pool.query(
                        `UPDATE support_tickets SET include_in_ai_prompt = ?, ai_notes = COALESCE(?, ai_notes), ai_mode = ?, agent_platform = ? WHERE id = ?${tenantWhere}`,
                        [inc, notes, itemMode, itemPlat, item.id, ...tParams]
                    );
                }
                if (inc === 1) selectedIds.push(Number(item.id));
            }
        }

        const tenantFilter = !isSuperAdmin && reqCompanyId ? ' AND t.company_id = ?' : '';
        const tenantParams = !isSuperAdmin && reqCompanyId ? [reqCompanyId] : [];
        const baseSql = `SELECT t.*, t.ticket_code AS code, c.razon_social AS company_name FROM support_tickets t LEFT JOIN companies c ON c.id = t.company_id`;
        const [rows] = selectedIds.length > 0
            ? await pool.query(`${baseSql} WHERE t.id IN (?)${tenantFilter} ORDER BY FIELD(t.priority, 'urgente', 'alta', 'media', 'baja'), t.id ASC`, [selectedIds, ...tenantParams])
            : await pool.query(`${baseSql} WHERE t.include_in_ai_prompt = 1 AND t.status NOT IN ('cerrado', 'rechazado')${tenantFilter} ORDER BY FIELD(t.priority, 'urgente', 'alta', 'media', 'baja'), t.id ASC`, tenantParams);

        for (const r of rows) {
            const taskId = await ticketAiTaskBridge.syncTicketToAiTask(r, { forceSync: true });
            if ((r.ai_mode || cleanMode) === 'api' && taskId && r.status !== 'resuelto') {
                await agentTaskQueue.retryTask(taskId, r.company_id).catch(() => {});
            }
        }

        const promptMarkdown = buildAiPromptMarkdown(rows, extraContext, cleanPlat, cleanMode);
        try {
            fs.writeFileSync(path.join(__dirname, '..', '..', '..', 'TICKETS_PARA_IA.md'), promptMarkdown, 'utf8');
        } catch (writeErr) {
            console.warn('[TicketAiBundle] No se pudo escribir TICKETS_PARA_IA.md:', writeErr.message);
        }

        res.json({
            success: true,
            message: cleanMode === 'api'
                ? `${rows.length} ticket(s) enviados a ejecución autónoma por API Interna en /ai-tasks`
                : `Paquete de ${rows.length} ticket(s) + Logs listo para ${getPlatformMeta(cleanPlat).name} y guardado en TICKETS_PARA_IA.md`,
            data: rows,
            promptMarkdown,
            filePath: 'TICKETS_PARA_IA.md'
        });
    } catch (error) {
        console.error('Error saveAndGenerateAiBundle:', error);
        res.status(500).json({ message: 'Error al generar el paquete de prompt para IA' });
    }
};

const resolveAiBundleBatch = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) return res.status(403).json({ message: 'Requiere permisos de gestión técnica de tickets' });
        const { ticketIds = [], resolution_notes = '', resolved_version = null } = req.body;
        if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
            return res.status(400).json({ message: 'Selecciona al menos un ticket para resolver en lote' });
        }

        const actorName = req.user?.nombre || req.user?.username || 'Soporte Técnico';
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const reqCompanyId = req.companyId || req.company_id;
        const resolvedList = [];

        for (const rawId of ticketIds) {
            const id = Number(rawId);
            if (!id) continue;
            const existing = await ticketService.getTicketById(id);
            if (!existing) continue;
            if (!isSuperAdmin && (!reqCompanyId || Number(existing.company_id) !== Number(reqCompanyId))) continue;

            const note = String(resolution_notes || '').trim() || existing.ai_notes || 'Mejora / corrección aplicada exitosamente en el sistema.';
            const upd = await ticketService.updateTicketStatus(id, {
                status: 'resuelto', resolvedByName: actorName, resolutionNotes: note,
                resolvedVersion: resolved_version || null, updatedByType: 'tech', updatedById: req.user?.id || null
            });
            await ticketAiTaskBridge.syncTicketToAiTask({ ...upd, include_in_ai_prompt: 1 }, { forceSync: true });
            await pool.query('UPDATE support_tickets SET include_in_ai_prompt = 0 WHERE id = ?', [id]);
            resolvedList.push(upd);
        }

        res.json({
            success: true,
            message: `${resolvedList.length} ticket(s) marcados como RESUELTOS. Se notificó individualmente a cada usuario creador.`,
            data: resolvedList
        });
    } catch (error) {
        console.error('Error resolveAiBundleBatch:', error);
        res.status(500).json({ message: 'Error al resolver lote de tickets' });
    }
};

const autoTriageAiBundle = async (req, res) => {
    try {
        if (!(await checkIsTechManager(req))) return res.status(403).json({ message: 'Requiere permisos de gestión técnica de tickets' });
        const supportTicketDiagnosticTool = require('../services/agents/tools/supportTicketDiagnosticTool');
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const reqCompanyId = req.companyId || req.company_id;
        const targetCompany = isSuperAdmin ? (reqCompanyId || null) : (reqCompanyId || 0);
        const result = await supportTicketDiagnosticTool.execute(
            { status: 'todos', limit: 35, auto_flag_for_ai: true },
            { companyId: targetCompany, user: req.user }
        );
        await ticketAiTaskBridge.syncAllFlaggedTicketsToAiTasks(targetCompany);
        const flagged = result.triage_breakdown?.auto_flagged_count ?? 0;
        const totalIa = result.summary?.marcados_para_ia ?? flagged;
        res.json({
            success: true,
            message: `Auto-Triaje del Agente IA completado: ${flagged} nuevo(s) ticket(s) marcados y enviados al Centro de Tareas IA (${totalIa} en paquete).`,
            data: result
        });
    } catch (error) {
        console.error('Error autoTriageAiBundle:', error);
        res.status(500).json({ message: 'Error al ejecutar el auto-triaje con el Agente de Soporte' });
    }
};

module.exports = { updateTicketAiReview, getAiBundleTickets, saveAndGenerateAiBundle, resolveAiBundleBatch, autoTriageAiBundle };
