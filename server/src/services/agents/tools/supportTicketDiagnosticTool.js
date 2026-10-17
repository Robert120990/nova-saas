const pool = require('../../../config/db');

function parseDiagnosticsSafe(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function classifyTicket(ticket, diag) {
    const score = Number(ticket.diagnostic_score) || Number(diag?.score) || 0;
    const netFailures = Array.isArray(diag?.networkFailures) ? diag.networkFailures : [];
    const consoleErrors = Array.isArray(diag?.consoleErrors) ? diag.consoleErrors : [];
    const hasHttp500 = netFailures.some((n) => Number(n.status) >= 500 || n.isRelated);
    const hasConsoleErr = consoleErrors.some((c) => c.isRelated || c.kind === 'runtime_error' || c.kind === 'unhandled_rejection');
    const rawType = String(ticket.ticket_type || ticket.type || '').toLowerCase();

    if (score >= 45 || hasHttp500 || hasConsoleErr) {
        return 'BUG_TECNICO_CON_TRAZA';
    }
    if (rawType === 'mejora' || rawType === 'bug') {
        return 'OPORTUNIDAD_MEJORA_O_AJUSTE';
    }
    return 'SOPORTE_OPERATIVO_USUARIO';
}

function buildSuggestedAiNote(ticket, categoria, diag) {
    const netFailures = Array.isArray(diag?.networkFailures) ? diag.networkFailures : [];
    const consoleErrors = Array.isArray(diag?.consoleErrors) ? diag.consoleErrors : [];
    const page = ticket.page_path || '/';
    const mod = ticket.module_name || 'General';

    if (categoria === 'BUG_TECNICO_CON_TRAZA') {
        const topNet = netFailures[0];
        const topCon = consoleErrors[0];
        const traceDetail = topNet
            ? `Fallo HTTP ${topNet.status || 'ERR'} en ${topNet.method || 'REQ'} ${topNet.url || ''} (${topNet.backendMessage || 'sin detalle'})`
            : (topCon ? `Error JS [${topCon.kind || 'error'}]: ${topCon.message || ''}` : `Correlación diagnóstica ${ticket.diagnostic_score || 0}%`);
        return `[Auto-Triaje IA] Corregir bug técnico en módulo ${mod} (${page}). ${traceDetail}. Revisar controlador/servicio y manejo defensivo en frontend.`;
    }

    return `[Auto-Triaje IA] Evaluar e implementar mejora/ajuste solicitado en módulo ${mod} (${page}): "${String(ticket.subject || '').slice(0, 100)}".`;
}

const toolDefinition = {
    name: 'analyze_support_tickets',
    description: 'Analiza y clasifica los tickets de soporte técnico, correlacionando telemetría del navegador (errores de consola JS y fallos HTTP/API) para distinguir entre dudas operativas de usuario, oportunidades de mejora y bugs técnicos reales. Opcionalmente marca tickets candidatos para el paquete TICKETS_PARA_IA.md.',
    parameters: {
        type: 'object',
        properties: {
            status: {
                type: 'string',
                enum: ['abierto', 'en_proceso', 'resuelto', 'cerrado', 'todos'],
                description: "Filtro por estado del ticket (por defecto 'todos')."
            },
            limit: {
                type: 'integer',
                description: 'Cantidad máxima de tickets a inspeccionar en detalle (por defecto 15, máximo 50).'
            },
            auto_flag_for_ai: {
                type: 'boolean',
                description: 'Si es true, marca automáticamente include_in_ai_prompt = 1 y genera ai_notes sugeridas en tickets abiertos/en_proceso con bug técnico o mejora.'
            }
        },
        required: []
    }
};

async function analyzeSupportTickets(args = {}, context = {}) {
    const statusFilter = args.status && args.status !== 'todos' ? String(args.status) : 'todos';
    const limitNum = Math.min(50, Math.max(1, parseInt(args.limit, 10) || 15));
    const autoFlagForAi = Boolean(args.auto_flag_for_ai);
    const companyId = context?.companyId ? Number(context.companyId) : null;

    const whereClauses = [];
    const queryParams = [];

    if (companyId && Number.isInteger(companyId) && companyId > 0) {
        whereClauses.push('t.company_id = ?');
        queryParams.push(companyId);
    }

    const baseWhereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    try {
        const [summaryRows] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN t.status = 'abierto' THEN 1 ELSE 0 END) AS abiertos,
                SUM(CASE WHEN t.status = 'en_proceso' THEN 1 ELSE 0 END) AS en_proceso,
                SUM(CASE WHEN t.status = 'resuelto' THEN 1 ELSE 0 END) AS resueltos,
                SUM(CASE WHEN t.status = 'cerrado' THEN 1 ELSE 0 END) AS cerrados,
                SUM(CASE WHEN t.type = 'problema' THEN 1 ELSE 0 END) AS tipo_problema,
                SUM(CASE WHEN t.type = 'bug' THEN 1 ELSE 0 END) AS tipo_bug,
                SUM(CASE WHEN t.type = 'mejora' THEN 1 ELSE 0 END) AS tipo_mejora,
                SUM(CASE WHEN t.type IN ('consulta', 'duda') THEN 1 ELSE 0 END) AS tipo_consulta,
                SUM(CASE WHEN t.diagnostic_relevance = 'alta' THEN 1 ELSE 0 END) AS relevancia_alta,
                SUM(CASE WHEN t.diagnostic_relevance = 'media' THEN 1 ELSE 0 END) AS relevancia_media,
                SUM(CASE WHEN t.diagnostic_relevance = 'baja' THEN 1 ELSE 0 END) AS relevancia_baja,
                SUM(CASE WHEN t.diagnostic_relevance = 'sin_errores' OR t.diagnostic_relevance IS NULL THEN 1 ELSE 0 END) AS sin_errores,
                SUM(CASE WHEN t.include_in_ai_prompt = 1 AND t.status NOT IN ('cerrado', 'rechazado') THEN 1 ELSE 0 END) AS marcados_para_ia
             FROM support_tickets t
             ${baseWhereSql}`,
            queryParams
        );

        const listWhere = [...whereClauses];
        const listParams = [...queryParams];
        if (statusFilter !== 'todos') {
            listWhere.push('t.status = ?');
            listParams.push(statusFilter);
        }
        const listWhereSql = listWhere.length > 0 ? `WHERE ${listWhere.join(' AND ')}` : '';

        const [ticketRows] = await pool.query(
            `SELECT
                t.id,
                t.ticket_code AS code,
                t.type AS ticket_type,
                t.priority,
                t.status,
                t.subject,
                t.description,
                t.page_url AS page_path,
                t.module_name,
                t.user_name,
                t.diagnostic_relevance,
                t.diagnostic_score,
                t.diagnostics_json,
                t.include_in_ai_prompt,
                t.ai_notes,
                t.created_at
             FROM support_tickets t
             ${listWhereSql}
             ORDER BY
                FIELD(t.status, 'abierto', 'en_proceso', 'resuelto', 'cerrado', 'rechazado'),
                FIELD(t.priority, 'urgente', 'alta', 'media', 'baja'),
                t.diagnostic_score DESC,
                t.created_at DESC
             LIMIT ?`,
            [...listParams, limitNum]
        );

        const triageBreakdown = {
            BUG_TECNICO_CON_TRAZA: 0,
            OPORTUNIDAD_MEJORA_O_AJUSTE: 0,
            SOPORTE_OPERATIVO_USUARIO: 0,
            auto_flagged_count: 0
        };

        const processedTickets = [];

        for (const row of ticketRows) {
            const diag = parseDiagnosticsSafe(row.diagnostics_json);
            const categoria = classifyTicket(row, diag);
            triageBreakdown[categoria] = (triageBreakdown[categoria] || 0) + 1;

            let includeInAi = Boolean(row.include_in_ai_prompt);
            let aiNotes = row.ai_notes || null;

            const isOpenOrActive = row.status === 'abierto' || row.status === 'en_proceso';
            const shouldFlag =
                autoFlagForAi &&
                isOpenOrActive &&
                (categoria === 'BUG_TECNICO_CON_TRAZA' || categoria === 'OPORTUNIDAD_MEJORA_O_AJUSTE');

            if (shouldFlag) {
                const suggestedNote = (!aiNotes || !String(aiNotes).trim())
                    ? buildSuggestedAiNote(row, categoria, diag)
                    : aiNotes;

                await pool.query(
                    `UPDATE support_tickets
                     SET include_in_ai_prompt = 1,
                         ai_notes = ?
                     WHERE id = ?`,
                    [suggestedNote, row.id]
                );
                includeInAi = true;
                aiNotes = suggestedNote;
                triageBreakdown.auto_flagged_count += 1;
            }

            const netFailures = Array.isArray(diag?.networkFailures) ? diag.networkFailures.slice(0, 3) : [];
            const consoleErrors = Array.isArray(diag?.consoleErrors) ? diag.consoleErrors.slice(0, 3) : [];

            processedTickets.push({
                id: row.id,
                code: row.code,
                ticket_type: row.ticket_type,
                priority: row.priority,
                status: row.status,
                subject: row.subject,
                description: String(row.description || '').slice(0, 300),
                page_path: row.page_path || '/',
                module_name: row.module_name || 'General',
                user_name: row.user_name,
                diagnostic_relevance: row.diagnostic_relevance || 'sin_errores',
                diagnostic_score: Number(row.diagnostic_score) || 0,
                categoria_sugerida: categoria,
                include_in_ai_prompt: includeInAi ? 1 : 0,
                ai_notes: aiNotes,
                telemetry_summary: {
                    explanation: diag?.explanation || null,
                    network_failures_count: netFailures.length,
                    network_failures: netFailures.map((n) => ({
                        method: n.method,
                        url: n.url,
                        status: n.status,
                        backendMessage: n.backendMessage,
                        isRelated: Boolean(n.isRelated)
                    })),
                    console_errors_count: consoleErrors.length,
                    console_errors: consoleErrors.map((c) => ({
                        kind: c.kind,
                        message: String(c.message || '').slice(0, 160),
                        isRelated: Boolean(c.isRelated)
                    }))
                },
                created_at: row.created_at
            });
        }

        const s = summaryRows[0] || {};
        return {
            summary: {
                total: Number(s.total || 0),
                by_status: {
                    abiertos: Number(s.abiertos || 0),
                    en_proceso: Number(s.en_proceso || 0),
                    resueltos: Number(s.resueltos || 0),
                    cerrados: Number(s.cerrados || 0)
                },
                by_type: {
                    problema: Number(s.tipo_problema || 0),
                    bug: Number(s.tipo_bug || 0),
                    mejora: Number(s.tipo_mejora || 0),
                    consulta: Number(s.tipo_consulta || 0)
                },
                by_diagnostic_relevance: {
                    alta: Number(s.relevancia_alta || 0),
                    media: Number(s.relevancia_media || 0),
                    baja: Number(s.relevancia_baja || 0),
                    sin_errores: Number(s.sin_errores || 0)
                },
                marcados_para_ia: Number(s.marcados_para_ia || 0) + triageBreakdown.auto_flagged_count
            },
            triage_breakdown: triageBreakdown,
            tickets: processedTickets,
            rowCount: processedTickets.length
        };
    } catch (error) {
        console.error('[supportTicketDiagnosticTool] Error:', error.message);
        return {
            error: 'Error al analizar los tickets de soporte.',
            detail: error.message
        };
    }
}

module.exports = {
    definition: toolDefinition,
    name: toolDefinition.name,
    description: toolDefinition.description,
    parameters: toolDefinition.parameters,
    execute: analyzeSupportTickets,
    analyzeSupportTickets
};
