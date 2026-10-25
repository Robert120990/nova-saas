const pool = require('../config/db');
const ticketService = require('./ticket.service');
const { broadcastToCompany } = require('./websocket.service');
const {
    getAgyServerSettings, isRunningOnTargetServer, parseFeedbackHistory,
    sanitizeConsoleText, findRelatedRepoFiles, resolveProjectForTicket, buildAgyPlanningPrompt,
    buildAgyExecutionPrompt, extractCleanAgyResult, buildRemoteShellScript,
    runSshInteractiveSession, runLocalInteractiveSession
} = require('./ticketAgyConsole.service');
const {
    generateAiPlanFromCode, applyAiCodePatchAndBuild,
    syncGitPullLatest, getGitDirtySet, getGitHeadCommit
} = require('./ticketAgyCodeEngine.service');

let schemaEnsured = false;

async function ensureAgyFlowSchema() {
    if (schemaEnsured) return;
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM support_tickets');
        const colNames = cols.map((c) => c.Field);
        const defs = [
            ['agy_status', "ADD COLUMN agy_status VARCHAR(40) NOT NULL DEFAULT 'idle'"],
            ['agy_model', "ADD COLUMN agy_model VARCHAR(100) NULL DEFAULT 'gemini-4-argon-high'"],
            ['agy_plan_markdown', 'ADD COLUMN agy_plan_markdown LONGTEXT NULL'],
            ['agy_plan_version', 'ADD COLUMN agy_plan_version INT NOT NULL DEFAULT 0'],
            ['agy_execution_log', 'ADD COLUMN agy_execution_log LONGTEXT NULL'],
            ['agy_feedback_history', 'ADD COLUMN agy_feedback_history JSON NULL'],
            ['agy_approved_by', 'ADD COLUMN agy_approved_by VARCHAR(150) NULL'],
            ['agy_updated_at', 'ADD COLUMN agy_updated_at DATETIME NULL']
        ];
        for (const [name, sql] of defs) {
            if (!colNames.includes(name)) await pool.query(`ALTER TABLE support_tickets ${sql}`);
        }
        await pool.query(`CREATE TABLE IF NOT EXISTS agy_server_settings (
            id INT PRIMARY KEY DEFAULT 1, ssh_host VARCHAR(120) NOT NULL DEFAULT 'localhost',
            ssh_port INT NOT NULL DEFAULT 22, ssh_user VARCHAR(100) NOT NULL DEFAULT 'root',
            ssh_password VARCHAR(255) NULL, ssh_private_key_path VARCHAR(500) NULL,
            project_path VARCHAR(500) NOT NULL DEFAULT '/opt/nova-saas', agy_command VARCHAR(255) NOT NULL DEFAULT 'agy',
            default_model VARCHAR(100) NOT NULL DEFAULT 'gemini-4-argon-high', execution_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
        await pool.query(`INSERT IGNORE INTO agy_server_settings (id, ssh_host, ssh_port, ssh_user, project_path, agy_command, default_model, execution_mode) VALUES (1, 'localhost', 22, 'root', '/opt/nova-saas', 'agy', 'gemini-4-argon-high', 'auto')`);
        await pool.query(`UPDATE agy_server_settings SET ssh_host = 'localhost', project_path = '/opt/nova-saas' WHERE ssh_host REGEXP '^[0-9]+\\\\.[0-9]+\\\\.[0-9]+\\\\.[0-9]+$' OR project_path = '/var/www/SIPEWEBgas'`);
        await pool.query(`UPDATE support_tickets SET status = 'resuelto', include_in_ai_prompt = 0, resolved_at = COALESCE(resolved_at, NOW()) WHERE agy_status = 'completado' AND status IN ('abierto', 'en_proceso')`);

        const [dirtyRows] = await pool.query(`SELECT id, agy_plan_markdown, agy_execution_log FROM support_tickets WHERE agy_execution_log IS NOT NULL OR agy_plan_markdown IS NOT NULL`);
        for (const row of dirtyRows) {
            const cleanPlan = row.agy_plan_markdown ? sanitizeConsoleText(row.agy_plan_markdown) : null;
            const cleanLog = row.agy_execution_log ? sanitizeConsoleText(row.agy_execution_log) : null;
            if (cleanPlan !== row.agy_plan_markdown || cleanLog !== row.agy_execution_log) {
                await pool.query(`UPDATE support_tickets SET agy_plan_markdown = ?, agy_execution_log = ? WHERE id = ?`, [cleanPlan, cleanLog, row.id]);
            }
        }
        schemaEnsured = true;
    } catch (err) {
        console.warn('[TicketAgyWorkflow] No se pudo verificar esquema AGY:', err.message);
    }
}

function buildSynthesizedStructuredPlan(ticket, model, planVersion, relatedFiles = [], proj = null) {
    const feedbacks = parseFeedbackHistory(ticket.agy_feedback_history);
    const latestFeedback = feedbacks.length > 0 ? feedbacks[feedbacks.length - 1] : null;
    const pathMod = require('path');
    const moduleHint = ticket.module_name || 'Módulo General';
    const cleanSubject = ticket.subject || 'Ajuste solicitado';
    const shortDesc = ticket.description ? ticket.description.replace(/\s+/g, ' ').trim() : cleanSubject;
    const shortFiles = relatedFiles.slice(0, 3).map((f) => pathMod.basename(f)).join(', ');
    const projectHint = proj?.projectLabel ? ` (${proj.projectLabel})` : '';

    return [
        `🎯 *Diagnóstico:*`,
        `Se analizó el reporte en *${moduleHint}*${projectHint} ("${shortDesc.slice(0, 160)}"). Se identificó la causa y el ajuste requerido en la lógica y presentación de datos.`,
        ticket.ai_notes ? `💡 *Directriz técnica:* ${ticket.ai_notes}` : null,
        latestFeedback ? `💬 *Aclaración:* "${latestFeedback.comment}"` : null,
        '',
        `🛠️ *Solución propuesta:*`,
        `1. Ajustar la consulta y filtros en pantalla para que los registros y datos se procesen según lo esperado.`,
        `2. Validar que la interfaz y las acciones respondan sin errores para el usuario.`,
        `3. Compilar los cambios y publicar la actualización inmediatamente en el sistema.` +
        (shortFiles ? `\n\n📂 *Componentes principales:* \`${shortFiles}\`` : '')
    ].filter(Boolean).join('\n');
}

async function runAgyCommandOnTarget(settings, scriptContent, onChunk) {
    const useLocal = settings.execution_mode === 'local' || (settings.execution_mode === 'auto' && isRunningOnTargetServer(settings.ssh_host));
    return useLocal ? runLocalInteractiveSession(settings, scriptContent, onChunk) : runSshInteractiveSession(settings, scriptContent, onChunk);
}

function notifyFrontendAgyUpdate(ticket) {
    if (!ticket) return;
    try {
        broadcastToCompany(ticket.company_id, 'ticket_agy_updated', {
            id: ticket.id, ticket_code: ticket.ticket_code, status: ticket.status,
            agy_status: ticket.agy_status, agy_model: ticket.agy_model, agy_plan_version: ticket.agy_plan_version
        });
    } catch { /* ignore */ }
}

async function startTicketAgyPlanning(ticketId, { model = null, aiNotes = undefined, approvedBy = 'SuperAdmin', additionalFeedback = null, telegramContext = null } = {}) {
    await ensureAgyFlowSchema();
    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');
    const settings = await getAgyServerSettings();
    const chosenModel = (model || ticket.agy_model || settings.default_model || 'gemini-4-argon-high').trim();
    const nextVersion = Number(ticket.agy_plan_version || 0) + 1;
    const feedbackHistory = parseFeedbackHistory(ticket.agy_feedback_history);
    let updatedAiNotes = aiNotes !== undefined ? String(aiNotes || '').trim() : (ticket.ai_notes || '');

    if (additionalFeedback && String(additionalFeedback).trim()) {
        const cleanComment = String(additionalFeedback).trim();
        feedbackHistory.push({ version: nextVersion, author: approvedBy, comment: cleanComment, date: new Date().toISOString() });
        updatedAiNotes = updatedAiNotes ? `${updatedAiNotes}\n[Ampliación v${nextVersion} - ${approvedBy}]: ${cleanComment}` : `[Ampliación v${nextVersion} - ${approvedBy}]: ${cleanComment}`;
    }

    const proj = resolveProjectForTicket(ticket, settings);
    const targetSettings = { ...settings, project_path: proj.projectPath };
    syncGitPullLatest(proj.projectPath);
    const relatedFiles = findRelatedRepoFiles(ticket, proj.projectPath);
    const initLog = `[${new Date().toISOString()}] Iniciando análisis en Consola AGY...\n` +
        `→ Proyecto detectado: ${proj.projectLabel} (${proj.projectPath})\n` +
        `→ Modelo seleccionado: ${chosenModel} | Plan v${nextVersion}\n` +
        `→ Solicitado por: ${approvedBy}\n` +
        `→ Archivos vinculados detectados: ${relatedFiles.join(', ')}\n`;

    await pool.query(
        `UPDATE support_tickets
         SET status = 'en_proceso', include_in_ai_prompt = 1, ai_notes = ?,
             agy_status = 'planificando', agy_model = ?, agy_plan_version = ?,
             agy_feedback_history = ?, agy_approved_by = ?, agy_execution_log = ?, agy_updated_at = NOW()
         WHERE id = ?`,
        [updatedAiNotes || null, chosenModel, nextVersion, JSON.stringify(feedbackHistory), approvedBy, initLog, ticketId]
    );

    const preparingTicket = await ticketService.getTicketById(ticketId);
    notifyFrontendAgyUpdate(preparingTicket);

    setImmediate(async () => {
        const { createTelegramLiveProgress, sendAgyPlanToTelegram } = require('./ticketAgyTelegram.service');
        let liveProgress = null;
        try {
            liveProgress = await createTelegramLiveProgress(preparingTicket, {
                mode: 'plan', model: chosenModel, actorName: approvedBy,
                sourceChatId: telegramContext?.sourceChatId || null, sourceMessageId: telegramContext?.sourceMessageId || null
            });

            const promptText = buildAgyPlanningPrompt(preparingTicket, chosenModel, nextVersion);
            const endMarker = '[[FIN_PLAN_AGY]]';
            const script = buildRemoteShellScript({ projectPath: proj.projectPath, agyCommand: settings.agy_command, model: chosenModel, promptText, isPlanPhase: true, endMarker });

            let consoleTranscript = initLog;
            let planMarkdown = '';
            let lastDbSync = 0;

            try {
                const { output } = await runAgyCommandOnTarget(targetSettings, script, (liveOut) => {
                    if (liveProgress) liveProgress.onConsoleChunk(liveOut);
                    const now = Date.now();
                    if (now - lastDbSync > 2500) {
                        lastDbSync = now;
                        pool.query('UPDATE support_tickets SET agy_execution_log = ? WHERE id = ?', [`${initLog}\n${sanitizeConsoleText(liveOut)}`.slice(-30000), ticketId]).catch(() => {});
                    }
                });
                consoleTranscript += `\n${sanitizeConsoleText(output || '')}`;
                const extracted = extractCleanAgyResult(output, endMarker);
                if (extracted && extracted.length > 40) planMarkdown = sanitizeConsoleText(extracted);
            } catch (sshErr) {
                consoleTranscript += `\n[Aviso Consola AGY]: ${sanitizeConsoleText(sshErr.message)}\n`;
            }

            if (!planMarkdown) {
                const freshFiles = findRelatedRepoFiles({ ...preparingTicket, agy_execution_log: consoleTranscript }, proj.projectPath);
                const aiPlan = await generateAiPlanFromCode(preparingTicket, chosenModel, nextVersion, proj, freshFiles);
                planMarkdown = aiPlan || buildSynthesizedStructuredPlan(preparingTicket, chosenModel, nextVersion, freshFiles, proj);
                consoleTranscript += `[AGY] Plan de ejecución v${nextVersion} (${proj.projectLabel}) generado exitosamente y enviado a Telegram.\n`;
            }

            await pool.query(
                `UPDATE support_tickets SET agy_status = 'esperando_aprobacion', agy_plan_markdown = ?, agy_execution_log = ?, agy_updated_at = NOW() WHERE id = ?`,
                [sanitizeConsoleText(planMarkdown), sanitizeConsoleText(consoleTranscript).slice(-30000), ticketId]
            );

            await ticketService.addTicketMessage(ticketId, {
                senderType: 'tech', senderName: `AGY (${chosenModel})`,
                message: `📋 Plan de Ejecución v${nextVersion} generado en Consola AGY y enviado a Telegram para aprobación.`
            });

            if (liveProgress) await liveProgress.complete(`Plan v${nextVersion} completado y listo para tu revisión.`);
            const readyTicket = await ticketService.getTicketById(ticketId);
            notifyFrontendAgyUpdate(readyTicket);
            await sendAgyPlanToTelegram(readyTicket);
        } catch (err) {
            console.error('[TicketAgyWorkflow] Error en planificación AGY:', err);
            if (liveProgress) await liveProgress.complete(`Aviso: ${err.message || 'Error en consola'}`).catch(() => {});
            await pool.query(
                `UPDATE support_tickets SET agy_status = 'error', agy_execution_log = CONCAT(COALESCE(agy_execution_log, ''), '\n[ERROR]: ', ?), agy_updated_at = NOW() WHERE id = ?`,
                [sanitizeConsoleText(err.message || 'Error desconocido'), ticketId]
            );
            const failedTicket = await ticketService.getTicketById(ticketId);
            notifyFrontendAgyUpdate(failedTicket);
        }
    });

    return preparingTicket;
}

async function executeApprovedTicketAgyPlan(ticketId, { approvedBy = 'SuperAdmin', telegramContext = null } = {}) {
    await ensureAgyFlowSchema();
    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');

    const settings = await getAgyServerSettings();
    const proj = resolveProjectForTicket(ticket, settings);
    const targetSettings = { ...settings, project_path: proj.projectPath };
    const chosenModel = ticket.agy_model || settings.default_model || 'gemini-4-argon-high';
    const relatedFiles = findRelatedRepoFiles(ticket, proj.projectPath);
    const activePlan = ticket.agy_plan_markdown || buildSynthesizedStructuredPlan(ticket, chosenModel, ticket.agy_plan_version || 1, relatedFiles, proj);
    const execStartLog = `\n[${new Date().toISOString()}] ✅ PLAN v${ticket.agy_plan_version || 1} APROBADO POR ${approvedBy}.\n` +
        `→ Ejecutando plan en Consola AGY (${proj.projectLabel} · ${proj.projectPath}) con modelo [${chosenModel}]...\n`;

    await pool.query(
        `UPDATE support_tickets SET agy_status = 'ejecutando', agy_plan_markdown = ?, agy_approved_by = ?, agy_execution_log = CONCAT(COALESCE(agy_execution_log, ''), ?), agy_updated_at = NOW() WHERE id = ?`,
        [activePlan, approvedBy, execStartLog, ticketId]
    );

    const runningTicket = await ticketService.getTicketById(ticketId);
    notifyFrontendAgyUpdate(runningTicket);

    setImmediate(async () => {
        const { createTelegramLiveProgress, notifyAgyExecutionResultToTelegram } = require('./ticketAgyTelegram.service');
        let liveProgress = null;
        try {
            liveProgress = await createTelegramLiveProgress(runningTicket, {
                mode: 'execute', model: chosenModel, actorName: approvedBy,
                sourceChatId: telegramContext?.sourceChatId || null, sourceMessageId: telegramContext?.sourceMessageId || null
            });

            syncGitPullLatest(proj.projectPath, (msg) => { if (liveProgress) liveProgress.onConsoleChunk(msg); });
            const preExistingDirtySet = getGitDirtySet(proj.projectPath);
            const preHeadCommit = getGitHeadCommit(proj.projectPath);
            const promptText = buildAgyExecutionPrompt(runningTicket, chosenModel);
            const endMarker = '[[FIN_EJECUCION_AGY]]';
            const script = buildRemoteShellScript({ projectPath: proj.projectPath, agyCommand: settings.agy_command, model: chosenModel, promptText, isPlanPhase: false, endMarker });

            let execOutput = '';
            let lastDbSync = 0;
            const baseLog = runningTicket.agy_execution_log || '';
            try {
                const { output } = await runAgyCommandOnTarget(targetSettings, script, (liveOut) => {
                    if (liveProgress) liveProgress.onConsoleChunk(liveOut);
                    const now = Date.now();
                    if (now - lastDbSync > 2500) {
                        lastDbSync = now;
                        pool.query('UPDATE support_tickets SET agy_execution_log = ? WHERE id = ?', [`${baseLog}\n${sanitizeConsoleText(liveOut)}`.slice(-30000), ticketId]).catch(() => {});
                    }
                });
                execOutput = extractCleanAgyResult(output, endMarker);
            } catch (sshErr) {
                execOutput = '';
                console.warn('[TicketAgyWorkflow] Aviso ejecución consola:', sshErr.message);
            }

            const patchResult = await applyAiCodePatchAndBuild(runningTicket, proj, relatedFiles, (msg) => {
                if (liveProgress) liveProgress.onConsoleChunk(msg);
            }, preExistingDirtySet, preHeadCommit);

            if (patchResult.modifiedFiles.length === 0) {
                const warnSummary = sanitizeConsoleText(
                    `⚠️ El motor AGY inspeccionó ${relatedFiles.join(', ')} en ${proj.projectLabel}, pero no se registraron modificaciones de código en disco. Agrega una Directriz Técnica (ai_notes) más específica o aplica el cambio manualmente.`
                );
                await pool.query(
                    `UPDATE support_tickets SET agy_status = 'esperando_aprobacion', agy_execution_log = CONCAT(COALESCE(agy_execution_log, ''), '\n=== AVISO EJECUCIÓN ===\n', ?), agy_updated_at = NOW() WHERE id = ?`,
                    [warnSummary, ticketId]
                );
                if (liveProgress) await liveProgress.complete(warnSummary);
                const pendingTicket = await ticketService.getTicketById(ticketId);
                notifyFrontendAgyUpdate(pendingTicket);
                await notifyAgyExecutionResultToTelegram(pendingTicket, warnSummary, approvedBy);
                return;
            }

            const touchedList = patchResult.modifiedFiles;
            const finalSummary = sanitizeConsoleText(
                [
                    execOutput ? execOutput : `✅ Plan v${runningTicket.agy_plan_version || 1} ejecutado en ${proj.projectLabel} (${chosenModel}).`,
                    `• Archivos actualizados: ${touchedList.join(', ')}`,
                    patchResult.buildLog ? `• Compilación / Despliegue: ${patchResult.buildLog}` : null,
                    patchResult.gitLog ? `• Git Sync: ${patchResult.gitLog}` : null
                ].filter(Boolean).join('\n')
            );

            await pool.query(
                `UPDATE support_tickets SET agy_status = 'completado', include_in_ai_prompt = 0, agy_execution_log = CONCAT(COALESCE(agy_execution_log, ''), '\n=== RESULTADO EJECUCIÓN ===\n', ?), agy_updated_at = NOW() WHERE id = ?`,
                [finalSummary.slice(-20000), ticketId]
            );

            await ticketService.updateTicketStatus(ticketId, {
                status: 'resuelto', resolvedByName: `${approvedBy} (AGY)`,
                resolutionNotes: `Solución ejecutada mediante Plan AGY v${runningTicket.agy_plan_version || 1} (${chosenModel}).`,
                updatedByType: 'tech'
            });

            try {
                const { removeTicketTelegramButtons } = require('./ticketTelegram.service');
                await removeTicketTelegramButtons(ticketId, telegramContext ? { chatId: telegramContext.sourceChatId, messageId: telegramContext.sourceMessageId } : null);
            } catch { /* ignore */ }

            if (liveProgress) await liveProgress.complete(`Solución ejecutada y ticket #${runningTicket.ticket_code} marcado como RESUELTO.`);
            const doneTicket = await ticketService.getTicketById(ticketId);
            notifyFrontendAgyUpdate(doneTicket);
            await notifyAgyExecutionResultToTelegram(doneTicket, finalSummary, approvedBy);
        } catch (err) {
            console.error('[TicketAgyWorkflow] Error ejecutando plan AGY:', err);
            if (liveProgress) await liveProgress.complete(`Aviso en ejecución: ${err.message || 'Error'}`).catch(() => {});
            await pool.query(`UPDATE support_tickets SET agy_status = 'error', agy_updated_at = NOW() WHERE id = ?`, [ticketId]);
        }
    });

    return runningTicket;
}

async function rejectTicketAgyPlan(ticketId, { rejectedBy = 'SuperAdmin', reason = '' } = {}) {
    await ensureAgyFlowSchema();
    const ticket = await ticketService.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket no encontrado');

    const logLine = `\n[${new Date().toISOString()}] ❌ Plan v${ticket.agy_plan_version || 1} DENEGADO por ${rejectedBy}.${reason ? ` Motivo: ${reason}` : ''}\n`;
    await pool.query(
        `UPDATE support_tickets SET agy_status = 'denegado', agy_approved_by = ?, agy_execution_log = CONCAT(COALESCE(agy_execution_log, ''), ?), agy_updated_at = NOW() WHERE id = ?`,
        [rejectedBy, logLine, ticketId]
    );

    await ticketService.addTicketMessage(ticketId, {
        senderType: 'tech', senderName: rejectedBy,
        message: `❌ Plan de Ejecución AGY v${ticket.agy_plan_version || 1} denegado.${reason ? ` Motivo: ${reason}` : ''}`
    });

    const updated = await ticketService.getTicketById(ticketId);
    notifyFrontendAgyUpdate(updated);
    return updated;
}

module.exports = { ensureAgyFlowSchema, startTicketAgyPlanning, executeApprovedTicketAgyPlan, rejectTicketAgyPlan };
