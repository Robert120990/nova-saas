const telegramService = require('./telegram.service');
const { getAgyServerSettings, extractAgyQuestionsAndOptions, sanitizeConsoleText } = require('./ticketAgyConsole.service');

// chat_id -> { ticketId, ticketCode, techName, expiresAt }
const pendingAgyFeedbackMap = new Map();

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[])/g, '\\$1');
}

function renderProgressBar(percent) {
    const clamped = Math.max(5, Math.min(100, Math.round(percent)));
    const filled = Math.round(clamped / 10);
    return `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}] ${clamped}%`;
}

function buildAgyPlanApprovalKeyboard(ticketId, planMarkdown = '') {
    const { requiresDecision, options } = extractAgyQuestionsAndOptions(planMarkdown);
    const rows = [];
    const numIcons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    for (const opt of options) {
        const icon = numIcons[opt.index - 1] || '🔹';
        const shortLabel = opt.label.length > 36 ? `${opt.label.slice(0, 35)}…` : opt.label;
        rows.push([{ text: `${icon} Elegir: ${shortLabel}`, callback_data: `agy_pick_opt:${ticketId}:${opt.index}` }]);
    }

    rows.push([{ text: '✅ Aprobar y Ejecutar Plan', callback_data: `agy_plan_approve:${ticketId}` }]);
    rows.push([
        { text: requiresDecision ? '✍️ Responder Duda / Otra Opción' : '✏️ Ampliar / Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` },
        { text: '❌ Denegar Plan', callback_data: `agy_plan_reject:${ticketId}` }
    ]);
    return { inline_keyboard: rows };
}

function buildAgyPostExecutionKeyboard(ticketId) {
    return {
        inline_keyboard: [[
            { text: '🔄 Reiterar Error / Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` },
            { text: '✍️ Nota Adicional', callback_data: `ticket_resolve_note:${ticketId}` }
        ]]
    };
}

async function safeSendTelegramWithKeyboard(chatId, text, replyMarkup) {
    const cleanText = sanitizeConsoleText(String(text || '')).slice(0, 3850);
    try {
        return await telegramService.apiCall('sendMessage', { chat_id: chatId, text: cleanText, parse_mode: 'Markdown', reply_markup: replyMarkup });
    } catch {
        return await telegramService.apiCall('sendMessage', { chat_id: chatId, text: cleanText.replace(/\\([_*`[])/g, '$1'), reply_markup: replyMarkup }).catch((err) => {
            console.error(`[TicketAgyTelegram] Error enviando mensaje a ${chatId}:`, err.message);
            return null;
        });
    }
}

async function createTelegramLiveProgress(ticket, { mode = 'execute', model = 'gemini-4-argon-high', actorName = 'SuperAdmin', sourceChatId = null, sourceMessageId = null } = {}) {
    const { getTechChatsForTicket } = require('./ticketTelegram.service');
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    const targetChatIds = Array.from(new Set([...(chats || []).map((c) => String(c.chat_id)), ...(sourceChatId ? [String(sourceChatId)] : [])]));
    const startTime = Date.now();
    let stepIndex = 0;
    let latestConsoleLine = mode === 'execute'
        ? 'Conectando con Consola AGY e iniciando aplicación del plan...'
        : 'Inspeccionando estructura del proyecto y analizando causa raíz...';

    const steps = mode === 'execute'
        ? [
            { pct: 20, label: 'Conectando con Consola AGY y preparando entorno...' },
            { pct: 45, label: 'Inspeccionando archivos del módulo e inyectando Plan aprobado...' },
            { pct: 70, label: 'Aplicando solución con AGY en el repositorio...' },
            { pct: 88, label: 'Verificando integridad del código y actualizando estado del ticket...' },
            { pct: 95, label: 'Finalizando ejecución y cerrando ticket como Resuelto...' }
        ]
        : [
            { pct: 20, label: 'Conectando con Consola AGY y cargando telemetría del ticket...' },
            { pct: 50, label: 'Analizando archivos del módulo involucrado en el repositorio...' },
            { pct: 78, label: 'Estructurando pasos del Plan de Ejecución con AGY...' },
            { pct: 92, label: 'Preparando entrega del Plan de Ejecución para Telegram...' }
        ];

    if (sourceChatId && sourceMessageId) {
        telegramService.apiCall('editMessageReplyMarkup', {
            chat_id: sourceChatId,
            message_id: sourceMessageId,
            reply_markup: { inline_keyboard: [[{ text: mode === 'execute' ? '⚙️ AGY ejecutando solución... (En curso)' : '⏳ AGY generando plan... (En curso)', callback_data: 'agy_noop' }]] }
        }).catch(() => {});
    }

    const formatProgressText = (pct, statusText, done = false) => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const icon = done ? '✅' : '⚙️';
        const title = mode === 'execute'
            ? (done ? `SOLUCIÓN EJECUTADA EN CONSOLA AGY — #${escapeMd(ticket.ticket_code)}` : `AGY TRABAJANDO EN LA SOLUCIÓN — #${escapeMd(ticket.ticket_code)}`)
            : (done ? `PLAN GENERADO EN CONSOLA AGY — #${escapeMd(ticket.ticket_code)}` : `AGY GENERANDO PLAN DE EJECUCIÓN — #${escapeMd(ticket.ticket_code)}`);

        return (
            `${icon} *${title}*\n` +
            `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
            `🧠 *Modelo:* \`${escapeMd(model)}\`  |  👤 *Por:* ${escapeMd(actorName)}\n` +
            `📊 *Progreso:* \`${renderProgressBar(pct)}\` · ⏱️ \`${elapsedSec}s\`\n` +
            `🔄 *Actividad en vivo:* ${escapeMd(statusText)}`
        );
    };

    const liveMessages = [];
    for (const cid of targetChatIds) {
        telegramService.apiCall('sendChatAction', { chat_id: cid, action: 'typing' }).catch(() => {});
        const sent = await safeSendTelegramWithKeyboard(cid, formatProgressText(15, steps[0].label), undefined);
        if (sent?.message_id) liveMessages.push({ chatId: cid, messageId: sent.message_id });
    }

    const timer = setInterval(async () => {
        stepIndex = Math.min(steps.length - 1, stepIndex + 1);
        const step = steps[stepIndex];
        const statusToDisplay = latestConsoleLine || step.label;
        for (const item of liveMessages) {
            telegramService.apiCall('sendChatAction', { chat_id: item.chatId, action: 'typing' }).catch(() => {});
            telegramService.apiCall('editMessageText', {
                chat_id: item.chatId,
                message_id: item.messageId,
                text: formatProgressText(step.pct, statusToDisplay, false),
                parse_mode: 'Markdown'
            }).catch(() => {});
        }
    }, 3500);

    return {
        onConsoleChunk(rawChunk = '') {
            const lines = sanitizeConsoleText(rawChunk).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('==='));
            if (lines.length > 0) latestConsoleLine = lines[lines.length - 1].slice(0, 140);
        },
        async complete(finalSummary = 'Proceso completado exitosamente en Consola AGY.') {
            clearInterval(timer);
            const cleanFinal = sanitizeConsoleText(finalSummary).split('\n')[0].slice(0, 160);
            for (const item of liveMessages) {
                await telegramService.apiCall('editMessageText', {
                    chat_id: item.chatId,
                    message_id: item.messageId,
                    text: formatProgressText(100, cleanFinal, true),
                    parse_mode: 'Markdown'
                }).catch(() => {});
            }
            if (sourceChatId && sourceMessageId && mode === 'execute') {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: sourceChatId,
                    message_id: sourceMessageId,
                    reply_markup: { inline_keyboard: [[{ text: '✅ Solución Ejecutada — Ticket Resuelto', callback_data: 'agy_noop' }]] }
                }).catch(() => {});
            }
        }
    };
}

async function sendAgyPlanToTelegram(ticket) {
    if (!ticket) return false;
    const { getTechChatsForTicket } = require('./ticketTelegram.service');
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (!chats || chats.length === 0) return false;

    const settings = await getAgyServerSettings();
    const version = ticket.agy_plan_version || 1;
    const model = ticket.agy_model || settings.default_model || 'gemini-4-argon-high';
    const rawPlan = sanitizeConsoleText(String(ticket.agy_plan_markdown || 'Sin contenido de plan.').replace('[[REQUIERE_DECISION_AGY]]', '').trim());
    const { requiresDecision, options } = extractAgyQuestionsAndOptions(ticket.agy_plan_markdown || '');
    const planBody = rawPlan.slice(0, 2850);

    const headerTitle = requiresDecision
        ? `❓ *AGY REQUIERE TU DECISIÓN / OPCIÓN (Plan v${version}) — #${escapeMd(ticket.ticket_code)}*`
        : `🤖 *PLAN DE EJECUCIÓN AGY (v${version}) — #${escapeMd(ticket.ticket_code)}*`;

    const footerHint = options.length > 0
        ? `👇 *AGY detectó ${options.length} opciones posibles. Toca un botón para elegir la opción o escribe tu respuesta:*`
        : (requiresDecision ? `👇 *AGY planteó una duda antes de ejecutar. Presiona "✍️ Responder Duda" o aprueba el plan:*` : `👇 *Selecciona una decisión para la Consola AGY:*`);

    const msg =
        `${headerTitle}\n` +
        `🖥️ *Entorno:* \`Consola AGY\`  |  🧠 *Modelo:* \`${escapeMd(model)}\`\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
        `🏢 *Empresa:* ${escapeMd(ticket.company_name || 'Global')} · *Módulo:* ${escapeMd(ticket.module_name || 'General')}\n` +
        (ticket.ai_notes ? `🎯 *Directriz IA:* ${escapeMd(ticket.ai_notes)}\n` : '') +
        `\n━━━━━━━━━━━━━━━━━━━━\n${planBody}\n━━━━━━━━━━━━━━━━━━━━\n${footerHint}`;

    const replyMarkup = buildAgyPlanApprovalKeyboard(ticket.id, ticket.agy_plan_markdown || '');
    for (const chat of chats) {
        await safeSendTelegramWithKeyboard(chat.chat_id, msg, replyMarkup);
    }
    return true;
}

async function notifyAgyExecutionResultToTelegram(ticket, summaryText, approvedBy) {
    if (!ticket) return false;
    const { getTechChatsForTicket } = require('./ticketTelegram.service');
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (!chats || chats.length === 0) return false;

    const settings = await getAgyServerSettings();
    const model = ticket.agy_model || settings.default_model || 'gemini-4-argon-high';
    const msg =
        `🚀 *EJECUCIÓN AGY COMPLETADA — #${escapeMd(ticket.ticket_code)} (RESUELTO)*\n` +
        `🖥️ *Entorno:* \`Consola AGY\`  |  🧠 *Modelo:* \`${escapeMd(model)}\`\n` +
        `👤 *Aprobado por:* ${escapeMd(approvedBy)}\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n\n` +
        `📝 *Resultado de Consola:*\n${sanitizeConsoleText(String(summaryText || '')).slice(0, 2500)}\n\n` +
        `✅ _El ticket ha sido marcado automáticamente como RESUELTO. Solo usa el botón inferior si el usuario reitera el error:_`;

    const replyMarkup = buildAgyPostExecutionKeyboard(ticket.id);
    for (const chat of chats) {
        await safeSendTelegramWithKeyboard(chat.chat_id, msg, replyMarkup);
    }
    return true;
}

async function handleAgyTelegramCallback(cb) {
    const data = cb?.data || '';
    if (!data.startsWith('agy_')) return false;

    if (data === 'agy_noop') {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '⏳ AGY ya está procesando o completó esta solicitud.', show_alert: false }).catch(() => {});
        return true;
    }

    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const techName = cb.from?.first_name || cb.from?.username || 'SuperAdmin';
    const parts = data.split(':');
    const action = parts[0];
    const ticketId = parseInt(parts[1], 10);
    if (isNaN(ticketId)) return true;

    const { getTicketById } = require('./ticket.service');
    const { startTicketAgyPlanning, executeApprovedTicketAgyPlan, rejectTicketAgyPlan } = require('./ticketAgyWorkflow.service');
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '⚠️ Ticket no encontrado' }).catch(() => {});
        return true;
    }

    const settings = await getAgyServerSettings();
    const model = ticket.agy_model || settings.default_model || 'gemini-4-argon-high';

    if (action === 'agy_pick_opt') {
        const optIdx = parseInt(parts[2], 10) || 1;
        const { options } = extractAgyQuestionsAndOptions(ticket.agy_plan_markdown || '');
        const picked = options.find((o) => o.index === optIdx);
        const chosenText = picked ? picked.label : `Opción ${optIdx}`;
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🎯 Opción ${optIdx} seleccionada. Re-planificando...` }).catch(() => {});
        await startTicketAgyPlanning(ticketId, {
            model, approvedBy: `${techName} (Telegram)`,
            additionalFeedback: `DECISIÓN SELECCIONADA POR EL ADMINISTRADOR: Opción ${optIdx} (${chosenText}). Elabora el plan final aplicando esta opción.`,
            telegramContext: { sourceChatId: chatId, sourceMessageId: messageId }
        });
        return true;
    }

    if (action === 'agy_start_plan') {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '🤖 AGY iniciando análisis y plan de ejecución...' }).catch(() => {});
        await startTicketAgyPlanning(ticketId, { model, approvedBy: `${techName} (Telegram)`, telegramContext: { sourceChatId: chatId, sourceMessageId: messageId } });
        return true;
    }

    if (action === 'agy_plan_approve') {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '⚙️ ¡Plan aprobado! AGY está ejecutando la solución ahora mismo...' }).catch(() => {});
        await executeApprovedTicketAgyPlan(ticketId, { approvedBy: `${techName} (Telegram)`, telegramContext: { sourceChatId: chatId, sourceMessageId: messageId } });
        return true;
    }

    if (action === 'agy_plan_reject') {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '❌ Plan denegado' }).catch(() => {});
        await rejectTicketAgyPlan(ticketId, { rejectedBy: `${techName} (Telegram)`, reason: 'Denegado desde Telegram' });
        await safeSendTelegramWithKeyboard(
            chatId,
            `❌ *Plan v${ticket.agy_plan_version || 1} DENEGADO* en Ticket *#${escapeMd(ticket.ticket_code)}* por *${escapeMd(techName)}*.\n_No se aplicaron cambios. Puedes ampliar comentarios si deseas generar un nuevo plan:_`,
            { inline_keyboard: [[{ text: '✏️ Ampliar Comentarios y Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` }]] }
        );
        return true;
    }

    if (action === 'agy_plan_feedback') {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});
        pendingAgyFeedbackMap.set(chatId, { ticketId, ticketCode: ticket.ticket_code, techName, expiresAt: Date.now() + 15 * 60 * 1000 });
        await telegramService.sendMessage(
            chatId,
            `✍️ *Responder Duda / Ampliar Comentarios en Ticket #${escapeMd(ticket.ticket_code)}*\n\nEscribe tu respuesta, opción elegida o indicaciones adicionales para que \`agy\` (\`${escapeMd(model)}\`) continúe en Consola AGY (o escribe /cancelar):`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
        return true;
    }

    return false;
}

async function handleAgyTelegramText(chatId, text, from) {
    const trimmed = (text || '').trim();
    const techName = from?.first_name || from?.username || 'SuperAdmin';

    if (/^\/cancelar$/i.test(trimmed) && pendingAgyFeedbackMap.has(chatId)) {
        pendingAgyFeedbackMap.delete(chatId);
        await telegramService.sendMessage(chatId, '❎ Ampliación de plan AGY cancelada.');
        return true;
    }

    const agyCmdMatch = trimmed.match(/^\/agy\s+([A-Za-z0-9#-]+)(?:\s+([\s\S]+))?$/i);
    if (agyCmdMatch) {
        const { getTicketByCodeOrId } = require('./ticket.service');
        const { startTicketAgyPlanning } = require('./ticketAgyWorkflow.service');
        const ticket = await getTicketByCodeOrId(agyCmdMatch[1]);
        if (!ticket) {
            await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${agyCmdMatch[1]}".`);
            return true;
        }
        await startTicketAgyPlanning(ticket.id, {
            approvedBy: `${techName} (Telegram)`,
            additionalFeedback: (agyCmdMatch[2] || '').trim() || null,
            telegramContext: { sourceChatId: chatId }
        });
        return true;
    }

    const pending = pendingAgyFeedbackMap.get(chatId);
    if (!pending) return false;
    pendingAgyFeedbackMap.delete(chatId);
    if (Date.now() > pending.expiresAt || trimmed.startsWith('/')) return false;

    const { startTicketAgyPlanning } = require('./ticketAgyWorkflow.service');
    await startTicketAgyPlanning(pending.ticketId, { approvedBy: `${techName} (Telegram)`, additionalFeedback: trimmed, telegramContext: { sourceChatId: chatId } });
    return true;
}

module.exports = { createTelegramLiveProgress, sendAgyPlanToTelegram, notifyAgyExecutionResultToTelegram, handleAgyTelegramCallback, handleAgyTelegramText };
