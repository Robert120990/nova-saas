const pool = require('../config/db');

function parseJsonSafe(val, fallback = null) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return fallback; }
}

function buildSingleTicketTaskPrompt(t) {
    const diag = parseJsonSafe(t.diagnostics_json, null);
    const attachments = parseJsonSafe(t.attachments_json, []);
    const listAtt = Array.isArray(attachments) && attachments.length > 0
        ? attachments
        : (t.screenshot_url ? [{ url: t.screenshot_url, caption: '', annotated: false }] : []);

    const lines = [
        `Analiza y resuelve el Ticket de Soporte #${t.ticket_code}: "${t.subject}"`,
        `- Tipo: ${t.type} | Prioridad: ${t.priority} | Módulo: ${t.module_name || 'General'} (${t.page_url || '/'})`,
        `- Reportado por: ${t.user_name || 'Usuario'} | Descripción: "${t.description || t.subject}"`
    ];

    if (t.ai_notes && String(t.ai_notes).trim()) {
        lines.push(`- Directriz Técnica para IA: "${String(t.ai_notes).trim()}"`);
    }
    if (listAtt.length > 0) {
        lines.push(`- Capturas WebP (${listAtt.length}): ${listAtt.map((a, i) => `#${i + 1} server/${String(a.url || '').replace(/^\/+/, '')}`).join(', ')}`);
    }
    if (diag && (diag.relevance !== 'sin_errores' || (diag.networkFailures?.length || 0) > 0 || (diag.consoleErrors?.length || 0) > 0)) {
        lines.push(`- Diagnóstico Navegador: Correlación ${(diag.relevance || 'N/A').toUpperCase()} (${diag.score || 0}%)`);
    }
    return lines.join('\n');
}

function buildTicketDiagnosticMarkdown(t) {
    const diag = parseJsonSafe(t.diagnostics_json, null);
    const attachments = parseJsonSafe(t.attachments_json, []);
    const listAtt = Array.isArray(attachments) && attachments.length > 0
        ? attachments
        : (t.screenshot_url ? [{ url: t.screenshot_url, caption: '', annotated: false }] : []);

    const netFailures = Array.isArray(diag?.networkFailures) ? diag.networkFailures : [];
    const conErrors = Array.isArray(diag?.consoleErrors) ? diag.consoleErrors : [];
    const score = Number(t.diagnostic_score ?? diag?.score ?? 0);
    const relevance = t.diagnostic_relevance || diag?.relevance || 'sin_errores';

    const categoria = (score >= 45 || netFailures.some(n => Number(n.status) >= 500) || conErrors.length > 0)
        ? '🔴 BUG TÉCNICO CON TRAZA EN CONSOLA / RED'
        : ((t.type === 'mejora' || t.type === 'bug') ? '🟣 OPORTUNIDAD DE MEJORA / AJUSTE DE CÓDIGO' : '🔵 SOPORTE OPERATIVO');

    const lines = [
        `**[🎫 Agente Especialista en Tickets & Diagnóstico de Soporte]:**`,
        '',
        `### 📋 Ficha Técnica del Ticket \`#${t.ticket_code}\``,
        `| Campo | Detalle |`,
        `| :--- | :--- |`,
        `| **Código** | \`${t.ticket_code}\` |`,
        `| **Asunto** | ${t.subject} |`,
        `| **Clasificación IA** | **${categoria}** |`,
        `| **Tipo / Prioridad** | \`${t.type}\` / \`${t.priority}\` |`,
        `| **Módulo / Ruta** | ${t.module_name || 'General'} (\`${t.page_url || '/'}\`) |`,
        `| **Usuario Creador** | ${t.user_name || 'Usuario'} |`,
        `| **Correlación de Logs** | \`${relevance.toUpperCase()}\` (**${score}%**) |`,
        '',
        `### 📝 1. Reporte Original del Usuario`,
        `> ${String(t.description || t.subject).replace(/\n/g, '\n> ')}`,
        '',
        `### 🎯 2. Directriz / Comentario Técnico para Resolución con IA`,
        t.ai_notes && String(t.ai_notes).trim()
            ? `**Instrucción asignada:** ${String(t.ai_notes).trim()}`
            : `_Pendiente de comentario adicional. Se recomienda revisar el componente asociado a la ruta \`${t.page_url || '/'}\` y validar los eventos de interfaz._`,
        ''
    ];

    if (listAtt.length > 0) {
        lines.push(`### 🖼️ 3. Evidencia Visual Adjunta (Formato Liviano WebP)`);
        listAtt.forEach((att, idx) => {
            const relPath = String(att.url || '').replace(/^\/+/, '');
            const annotatedBadge = att.annotated ? ' *(Con trazos/flechas de señalización)*' : '';
            const captionText = att.caption ? ` — Nota: "${att.caption}"` : '';
            lines.push(`- **Captura #${idx + 1}**${annotatedBadge}: \`server/${relPath}\`${captionText}`);
        });
        lines.push('');
    }

    lines.push(`### 🚨 4. Telemetría del Explorador y Operaciones Fallidas`);
    if (netFailures.length === 0 && conErrors.length === 0) {
        lines.push(`- **Estado de Consola y Red:** 🟢 Sin errores HTTP ni excepciones JS registradas en el instante del reporte (el requerimiento es visual, funcional o de experiencia de usuario en \`${t.page_url || '/'}\`).`);
    } else {
        if (diag?.explanation) {
            lines.push(`- **Veredicto del Motor de Relevancia:** ${diag.explanation}`);
        }
        if (netFailures.length > 0) {
            lines.push(`- **Peticiones HTTP/API Fallidas (${netFailures.length}):**`);
            netFailures.slice(0, 5).forEach((n) => {
                lines.push(`  - \`${n.method} ${n.url}\` → **HTTP ${n.status || 'ERR'}** (${n.isRelated ? `Relacionado ${n.relevanceScore}%` : `${n.relevanceScore}%`}): "${n.backendMessage || 'Sin mensaje'}"`);
            });
        }
        if (conErrors.length > 0) {
            lines.push(`- **Excepciones en Consola JS (${conErrors.length}):**`);
            conErrors.slice(0, 5).forEach((c) => {
                lines.push(`  - \`[${c.kind}]\` (${c.relevanceScore || 0}%): \`${c.message}\``);
            });
        }
    }

    lines.push('');
    lines.push(`### 🚀 5. Prompt Empaquetado Listo para Ejecución IA`);
    lines.push('```markdown');
    lines.push(`Resuelve el Ticket #${t.ticket_code} (${t.subject}) en la ruta ${t.page_url || '/'}:`);
    lines.push(`- Reporte: ${t.description || t.subject}`);
    if (t.ai_notes) lines.push(`- Instrucción técnica: ${t.ai_notes}`);
    if (listAtt.length > 0) lines.push(`- Capturas WebP locales: ${listAtt.map(a => 'server/' + String(a.url || '').replace(/^\/+/, '')).join(', ')}`);
    lines.push('```');

    return lines.join('\n');
}

function mapTicketPriority(priority) {
    if (priority === 'urgente' || priority === 'alta') return 'alta';
    if (priority === 'baja') return 'baja';
    return 'media';
}

async function ensureTaskLogs(taskId, ticket) {
    const [logs] = await pool.query('SELECT COUNT(*) AS cnt FROM ai_agent_task_logs WHERE task_id = ?', [taskId]);
    if (Number(logs[0]?.cnt || 0) > 0) return;

    await pool.query(
        `INSERT INTO ai_agent_task_logs (task_id, agent_code, log_type, message, metadata) VALUES
         (?, 'supervisor', 'thinking', ?, NULL),
         (?, 'supervisor', 'delegation', 'Caso asignado a [Agente Especialista en Tickets & Diagnóstico de Soporte] (support).', NULL),
         (?, 'support', 'tool_call', 'Ejecutando herramienta analyze_support_tickets y correlacionando telemetría WebP/Consola...', NULL),
         (?, 'support', 'info', 'Diagnóstico técnico y prompt empaquetado generados exitosamente.', NULL)`,
        [
            taskId,
            `Recepción de Ticket #${ticket.ticket_code} ("${ticket.subject}") desde el módulo de Soporte Técnico.`,
            taskId,
            taskId,
            taskId
        ]
    );
}

async function syncTicketToAiTask(ticketOrId) {
    try {
        const ticket = typeof ticketOrId === 'object' && ticketOrId?.ticket_code
            ? ticketOrId
            : (await pool.query('SELECT * FROM support_tickets WHERE id = ? LIMIT 1', [Number(ticketOrId)]))[0]?.[0];

        if (!ticket || !ticket.ticket_code) return null;

        const codeTag = `[Ticket #${ticket.ticket_code}]`;
        const [existingRows] = await pool.query(
            `SELECT id, status FROM ai_agent_tasks
             WHERE company_id = ? AND (title LIKE ? OR title LIKE ?)
             ORDER BY id DESC LIMIT 1`,
            [ticket.company_id || 1, `%${codeTag}%`, `%${ticket.ticket_code}%`]
        );

        const existing = existingRows[0] || null;

        if (!Number(ticket.include_in_ai_prompt)) {
            if (existing && existing.status !== 'cancelada') {
                await pool.query(
                    `UPDATE ai_agent_tasks SET status = 'cancelada', current_step = 'Retirado del paquete IA en Tickets de Soporte.' WHERE id = ?`,
                    [existing.id]
                );
            }
            return null;
        }

        const title = `${codeTag} ${String(ticket.subject || '').slice(0, 190)}`.slice(0, 250);
        const prompt = buildSingleTicketTaskPrompt(ticket);
        const resultMd = buildTicketDiagnosticMarkdown(ticket);
        const priority = mapTicketPriority(ticket.priority);
        const metadataJson = JSON.stringify({
            source: 'support_ticket',
            ticket_id: ticket.id,
            ticket_code: ticket.ticket_code,
            page_url: ticket.page_url || null,
            screenshot_url: ticket.screenshot_url || null,
            diagnostic_relevance: ticket.diagnostic_relevance || 'sin_errores',
            diagnostic_score: ticket.diagnostic_score || 0
        });

        if (existing) {
            await pool.query(
                `UPDATE ai_agent_tasks
                 SET title = ?, prompt = ?, priority = ?, status = 'completada',
                     assigned_agent_code = 'support', progress = 100,
                     current_step = 'Diagnóstico técnico y paquete IA listos.',
                     result = ?, output_metadata = ?, error_message = NULL,
                     started_at = COALESCE(started_at, NOW()), completed_at = COALESCE(completed_at, NOW())
                 WHERE id = ?`,
                [title, prompt, priority, resultMd, metadataJson, existing.id]
            );
            await ensureTaskLogs(existing.id, ticket);
            return existing.id;
        }

        const [ins] = await pool.query(
            `INSERT INTO ai_agent_tasks
             (company_id, branch_id, user_id, title, prompt, output_type, priority, status, assigned_agent_code, progress, current_step, result, output_metadata, notify_telegram, started_at, completed_at)
             VALUES (?, ?, ?, ?, ?, 'texto', ?, 'completada', 'support', 100, 'Diagnóstico técnico y paquete IA listos.', ?, ?, 0, NOW(), NOW())`,
            [
                ticket.company_id || 1,
                ticket.branch_id || null,
                ticket.user_id || 1,
                title,
                prompt,
                priority,
                resultMd,
                metadataJson
            ]
        );

        const taskId = ins.insertId;
        await ensureTaskLogs(taskId, ticket);
        return taskId;
    } catch (err) {
        console.error('[TicketAiTaskBridge] Error syncing ticket to ai_agent_tasks:', err.message);
        return null;
    }
}

async function syncAllFlaggedTicketsToAiTasks(companyId = null) {
    try {
        const params = [];
        let where = `WHERE include_in_ai_prompt = 1 AND status NOT IN ('cerrado', 'rechazado')`;
        if (companyId) {
            where += ' AND company_id = ?';
            params.push(companyId);
        }
        const [tickets] = await pool.query(`SELECT * FROM support_tickets ${where} ORDER BY id ASC`, params);
        const syncedIds = [];
        for (const t of tickets) {
            const taskId = await syncTicketToAiTask(t);
            if (taskId) syncedIds.push(taskId);
        }
        return syncedIds;
    } catch (err) {
        console.error('[TicketAiTaskBridge] Error in syncAllFlaggedTicketsToAiTasks:', err.message);
        return [];
    }
}

module.exports = {
    syncTicketToAiTask,
    syncAllFlaggedTicketsToAiTasks,
    buildSingleTicketTaskPrompt,
    buildTicketDiagnosticMarkdown
};
