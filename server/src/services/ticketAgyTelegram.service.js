const telegramService = require('./telegram.service');
const { getAgyServerSettings, extractAgyQuestionsAndOptions, sanitizeConsoleText } = require('./ticketAgyConsole.service');

// chat_id -> { ticketId, ticketCode, techName, expiresAt }
const pendingAgyFeedbackMap = new Map();

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[])/g, '\\$1');
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
        {
            text: requiresDecision ? '✍️ Responder Duda / Otra Opción' : '✏️ Ampliar / Re-planificar',
            callback_data: `agy_plan_feedback:${ticketId}`
        },
        { text: '❌ Denegar Plan', callback_data: `agy_plan_reject:${ticketId}` }
    ]);

    return { inline_keyboard: rows };
}

function buildAgyPostExecutionKeyboard(ticketId) {
    return {
        inline_keyboard: [
            [
                { text: '✅ Marcar Ticket Resuelto', callback_data: `ticket_resolve:${ticketId}` },
                { text: '✍️ Resolver con Nota', callback_data: `ticket_resolve_note:${ticketId}` }
            ],
            [
                { text: '✏️ Ampliar / Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` }
            ]
        ]
    };
}

async function safeSendTelegramWithKeyboard(chatId, text, replyMarkup) {
    const cleanText = sanitizeConsoleText(String(text || '')).slice(0, 3850);
    try {
        await telegramService.apiCall('sendMessage', {
            chat_id: chatId,
            text: cleanText,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup
        });
    } catch {
        await telegramService.apiCall('sendMessage', {
            chat_id: chatId,
            text: cleanText.replace(/\\([_*`[])/g, '$1'),
            reply_markup: replyMarkup
        }).catch((err) => {
            console.error(`[TicketAgyTelegram] Error enviando mensaje a ${chatId}:`, err.message);
        });
    }
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
        : (requiresDecision
            ? `👇 *AGY planteó una duda antes de ejecutar. Presiona "✍️ Responder Duda" o aprueba el plan:*`
            : `👇 *Selecciona una decisión para la Consola AGY:*`);

    const msg =
        `${headerTitle}\n` +
        `🖥️ *Entorno:* \`Consola AGY\`  |  🧠 *Modelo:* \`${escapeMd(model)}\`\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
        `🏢 *Empresa:* ${escapeMd(ticket.company_name || 'Global')} · *Módulo:* ${escapeMd(ticket.module_name || 'General')}\n` +
        (ticket.ai_notes ? `🎯 *Directriz IA:* ${escapeMd(ticket.ai_notes)}\n` : '') +
        `\n━━━━━━━━━━━━━━━━━━━━\n` +
        `${planBody}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        footerHint;

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
        `🚀 *EJECUCIÓN AGY COMPLETADA — #${escapeMd(ticket.ticket_code)}*\n` +
        `🖥️ *Entorno:* \`Consola AGY\`  |  🧠 *Modelo:* \`${escapeMd(model)}\`\n` +
        `👤 *Aprobado por:* ${escapeMd(approvedBy)}\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n\n` +
        `📝 *Resultado de Consola:*\n${sanitizeConsoleText(String(summaryText || '')).slice(0, 2500)}\n\n` +
        `_Puedes marcar el ticket como resuelto para notificar al usuario o ampliar comentarios si requiere otro ajuste:_`;

    const replyMarkup = buildAgyPostExecutionKeyboard(ticket.id);
    for (const chat of chats) {
        await safeSendTelegramWithKeyboard(chat.chat_id, msg, replyMarkup);
    }
    return true;
}

async function handleAgyTelegramCallback(cb) {
    const data = cb?.data || '';
    if (!data.startsWith('agy_')) return false;

    const chatId = cb.message?.chat?.id;
    const techName = cb.from?.first_name || cb.from?.username || 'SuperAdmin';
    telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

    const parts = data.split(':');
    const action = parts[0];
    const ticketId = parseInt(parts[1], 10);
    if (isNaN(ticketId)) return true;

    const { getTicketById } = require('./ticket.service');
    const {
        startTicketAgyPlanning,
        executeApprovedTicketAgyPlan,
        rejectTicketAgyPlan
    } = require('./ticketAgyWorkflow.service');

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        await telegramService.sendMessage(chatId, '⚠️ Ticket no encontrado.').catch(() => {});
        return true;
    }

    const settings = await getAgyServerSettings();
    const model = ticket.agy_model || settings.default_model || 'gemini-4-argon-high';

    if (action === 'agy_pick_opt') {
        const optIdx = parseInt(parts[2], 10) || 1;
        const { options } = extractAgyQuestionsAndOptions(ticket.agy_plan_markdown || '');
        const picked = options.find((o) => o.index === optIdx);
        const chosenText = picked ? picked.label : `Opción ${optIdx}`;

        await telegramService.sendMessage(
            chatId,
            `🎯 *Opción ${optIdx} seleccionada por ${escapeMd(techName)}*\n` +
            `👉 _"${escapeMd(chosenText)}"_\n\n` +
            `🔄 Enviando tu elección a \`agy\` (\`${escapeMd(model)}\`) en Consola AGY para actualizar el plan...`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});

        await startTicketAgyPlanning(ticketId, {
            model,
            approvedBy: `${techName} (Telegram)`,
            additionalFeedback: `DECISIÓN SELECCIONADA POR EL ADMINISTRADOR: Opción ${optIdx} (${chosenText}). Elabora el plan final aplicando esta opción.`
        });
        return true;
    }

    if (action === 'agy_start_plan') {
        await telegramService.sendMessage(
            chatId,
            `🤖 *Iniciando Planificación en Consola AGY*\n` +
            `🎫 Ticket: *#${escapeMd(ticket.ticket_code)}*\n` +
            `🧠 Modelo: \`${escapeMd(model)}\`\n` +
            `_Generando plan de ejecución... Te lo enviaré por aquí al finalizar._`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
        await startTicketAgyPlanning(ticketId, {
            model,
            approvedBy: `${techName} (Telegram)`
        });
        return true;
    }

    if (action === 'agy_plan_approve') {
        await telegramService.sendMessage(
            chatId,
            `✅ *Plan v${ticket.agy_plan_version || 1} Aprobado por ${escapeMd(techName)}*\n` +
            `🚀 Ejecutando cambios con \`agy\` (\`${escapeMd(model)}\`) en Consola AGY para el ticket *#${escapeMd(ticket.ticket_code)}*...`,
            { parse_mode: 'Markdown' }
        ).catch(() => {});
        await executeApprovedTicketAgyPlan(ticketId, {
            approvedBy: `${techName} (Telegram)`
        });
        return true;
    }

    if (action === 'agy_plan_reject') {
        await rejectTicketAgyPlan(ticketId, {
            rejectedBy: `${techName} (Telegram)`,
            reason: 'Denegado desde Telegram'
        });
        await safeSendTelegramWithKeyboard(
            chatId,
            `❌ *Plan v${ticket.agy_plan_version || 1} DENEGADO* en Ticket *#${escapeMd(ticket.ticket_code)}* por *${escapeMd(techName)}*.\n` +
            `_No se aplicaron cambios en el servidor. Puedes ampliar comentarios si deseas generar un nuevo plan:_`,
            {
                inline_keyboard: [
                    [{ text: '✏️ Ampliar Comentarios y Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` }]
                ]
            }
        );
        return true;
    }

    if (action === 'agy_plan_feedback') {
        pendingAgyFeedbackMap.set(chatId, {
            ticketId,
            ticketCode: ticket.ticket_code,
            techName,
            expiresAt: Date.now() + 15 * 60 * 1000
        });
        await telegramService.sendMessage(
            chatId,
            `✍️ *Responder Duda / Ampliar Comentarios en Ticket #${escapeMd(ticket.ticket_code)}*\n\n` +
            `Escribe tu respuesta, opción elegida o indicaciones adicionales para que \`agy\` (\`${escapeMd(model)}\`) continúe en Consola AGY (o escribe /cancelar):`,
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

    // Comando directo: /agy TKT-0001 [instrucción opcional]
    const agyCmdMatch = trimmed.match(/^\/agy\s+([A-Za-z0-9#-]+)(?:\s+([\s\S]+))?$/i);
    if (agyCmdMatch) {
        const { getTicketByCodeOrId } = require('./ticket.service');
        const { startTicketAgyPlanning } = require('./ticketAgyWorkflow.service');
        const ticket = await getTicketByCodeOrId(agyCmdMatch[1]);
        if (!ticket) {
            await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${agyCmdMatch[1]}".`);
            return true;
        }
        const extraNote = (agyCmdMatch[2] || '').trim() || null;
        const settings = await getAgyServerSettings();
        await telegramService.sendMessage(
            chatId,
            `🤖 Conectando con Consola AGY (\`agy\` · \`${escapeMd(ticket.agy_model || settings.default_model)}\`) para planificar el Ticket *#${escapeMd(ticket.ticket_code)}*...`,
            { parse_mode: 'Markdown' }
        );
        await startTicketAgyPlanning(ticket.id, {
            approvedBy: `${techName} (Telegram)`,
            additionalFeedback: extraNote
        });
        return true;
    }

    const pending = pendingAgyFeedbackMap.get(chatId);
    if (!pending) return false;

    pendingAgyFeedbackMap.delete(chatId);
    if (Date.now() > pending.expiresAt || trimmed.startsWith('/')) return false;

    const { startTicketAgyPlanning } = require('./ticketAgyWorkflow.service');
    await telegramService.sendMessage(
        chatId,
        `🔄 *Comentarios recibidos para #${escapeMd(pending.ticketCode)}*\n` +
        `📝 _"${escapeMd(trimmed)}"_\n\n` +
        `Ejecutando \`agy\` en Consola AGY para re-planificar... Te enviaré el nuevo plan en breve.`,
        { parse_mode: 'Markdown' }
    );

    await startTicketAgyPlanning(pending.ticketId, {
        approvedBy: `${techName} (Telegram)`,
        additionalFeedback: trimmed
    });
    return true;
}

module.exports = {
    sendAgyPlanToTelegram,
    notifyAgyExecutionResultToTelegram,
    handleAgyTelegramCallback,
    handleAgyTelegramText
};
