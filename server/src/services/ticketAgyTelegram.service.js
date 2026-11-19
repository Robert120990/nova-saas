const telegramService = require('./telegram.service');
const {
    DEFAULT_AGY_MODEL,
    AVAILABLE_AGY_MODELS,
    getModelShortLabel,
    resolveAgyModelId,
    getAgyServerSettings,
    extractAgyQuestionsAndOptions,
    sanitizeConsoleText
} = require('./ticketAgyConsole.service');
const { humanizeAndFormatAgyPlan, formatAgyExecutionResultForTelegram } = require('./ticketAgyFormatters');
const { verifyTelegramSupportAccess } = require('./ticketTelegramMedia.service');

// chat_id -> { ticketId, ticketCode, techName, expiresAt }
const pendingAgyFeedbackMap = new Map();

function resolveEffectiveAgyModel(ticket = {}, settings = {}) {
    if (ticket?.agy_model) return String(ticket.agy_model).trim();
    if (settings?.default_model) return String(settings.default_model).trim();
    return DEFAULT_AGY_MODEL;
}

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[\]])/g, '');
}

function renderProgressBar(percent) {
    const clamped = Math.max(5, Math.min(100, Math.round(percent)));
    const filled = Math.round(clamped / 10);
    return `${'▓'.repeat(filled)}${'░'.repeat(10 - filled)} ${clamped}%`;
}

function buildAgyModelPickerKeyboard(ticketId = 0, currentModel = DEFAULT_AGY_MODEL, { scope = 'ticket' } = {}) {
    const isGlobal = scope === 'global' || !ticketId;
    const prefix = isGlobal ? 'agy_sdm' : 'agy_sm';
    const tid = Number(ticketId) || 0;
    const rows = [];

    for (let i = 0; i < AVAILABLE_AGY_MODELS.length; i += 2) {
        const pair = AVAILABLE_AGY_MODELS.slice(i, i + 2).map((m) => ({
            text: `${m.id === currentModel ? '✅ ' : '🧠 '}${m.short}`,
            callback_data: `${prefix}:${tid}:${m.id}`
        }));
        rows.push(pair);
    }

    if (isGlobal && tid > 0) {
        rows.push([
            { text: '🎫 Solo este Ticket', callback_data: `agy_model_menu:${tid}` },
            { text: '⬅️ Volver', callback_data: `agy_back:${tid}` }
        ]);
    } else if (!isGlobal && tid > 0) {
        rows.push([
            { text: '🌐 Cambiar Default Global', callback_data: `agy_def_menu:${tid}` },
            { text: '⬅️ Volver', callback_data: `agy_back:${tid}` }
        ]);
    }

    return { inline_keyboard: rows };
}

function buildAgyPlanApprovalKeyboard(ticketId, planMarkdown = '', modelId = DEFAULT_AGY_MODEL) {
    const { requiresDecision, options } = extractAgyQuestionsAndOptions(planMarkdown);
    const shortModel = getModelShortLabel(modelId);
    const rows = [];
    const numIcons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

    for (const opt of options) {
        const icon = numIcons[opt.index - 1] || '🔹';
        const shortLabel = opt.label.length > 36 ? `${opt.label.slice(0, 35)}…` : opt.label;
        rows.push([{ text: `${icon} Elegir: ${shortLabel}`, callback_data: `agy_pick_opt:${ticketId}:${opt.index}` }]);
    }

    rows.push([{ text: `✅ Aprobar y Ejecutar (${shortModel})`, callback_data: `agy_plan_approve:${ticketId}` }]);
    rows.push([{ text: `🧠 Cambiar Modelo (${shortModel})`, callback_data: `agy_model_menu:${ticketId}` }]);
    rows.push([
        { text: requiresDecision ? '✍️ Responder Duda / Otra Opción' : '✏️ Ampliar / Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` },
        { text: '❌ Denegar Plan', callback_data: `agy_plan_reject:${ticketId}` }
    ]);
    return { inline_keyboard: rows };
}

function buildAgyBranchReviewKeyboard(ticketId, modelId = DEFAULT_AGY_MODEL, compareUrl = null) {
    const shortModel = getModelShortLabel(modelId);
    const rows = [
        [{ text: '🚀 Fusionar a main y Desplegar', callback_data: `agy_merge_branch:${ticketId}` }],
        [
            { text: '🗑️ Descartar Rama', callback_data: `agy_discard_branch:${ticketId}` },
            { text: '✏️ Pedir Ajustes', callback_data: `agy_plan_feedback:${ticketId}` }
        ],
        [{ text: `🧠 Cambiar Modelo (${shortModel})`, callback_data: `agy_model_menu:${ticketId}` }]
    ];
    if (compareUrl && /^https:\/\/github\.com\//i.test(compareUrl)) {
        rows.splice(1, 0, [{ text: '🔍 Ver Diff en GitHub', url: compareUrl }]);
    }
    return { inline_keyboard: rows };
}

function buildAgyPostExecutionKeyboard(ticketId, success = true, modelId = DEFAULT_AGY_MODEL) {
    const shortModel = getModelShortLabel(modelId);
    if (!success) {
        return {
            inline_keyboard: [
                [{ text: `🔄 Reintentar AGY (${shortModel})`, callback_data: `agy_plan_approve:${ticketId}` }],
                [{ text: `🧠 Cambiar Modelo (${shortModel})`, callback_data: `agy_model_menu:${ticketId}` }],
                [
                    { text: '✏️ Ampliar Directriz y Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` },
                    { text: '✅ Marcar Resuelto', callback_data: `ticket_resolve:${ticketId}` }
                ]
            ]
        };
    }
    return {
        inline_keyboard: [
            [
                { text: '🔄 Reiterar Error / Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` },
                { text: '✍️ Nota Adicional', callback_data: `ticket_resolve_note:${ticketId}` }
            ]
        ]
    };
}

async function safeSendTelegramWithKeyboard(chatId, text, replyMarkup) {
    const cleanText = sanitizeConsoleText(String(text || '')).slice(0, 3850);
    const payload = { chat_id: chatId, text: cleanText, parse_mode: 'Markdown' };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    try {
        return await telegramService.apiCall('sendMessage', payload);
    } catch {
        const fallbackPayload = { chat_id: chatId, text: cleanText.replace(/[*_`\\]/g, '') };
        if (replyMarkup) fallbackPayload.reply_markup = replyMarkup;
        return await telegramService.apiCall('sendMessage', fallbackPayload).catch((err) => {
            console.error(`[TicketAgyTelegram] Error enviando mensaje a ${chatId}:`, err.message);
            return null;
        });
    }
}

async function safeEditTelegramMessage(chatId, messageId, text) {
    const cleanText = sanitizeConsoleText(String(text || '')).slice(0, 3850);
    try {
        return await telegramService.apiCall('editMessageText', {
            chat_id: chatId, message_id: messageId, text: cleanText, parse_mode: 'Markdown'
        });
    } catch {
        return await telegramService.apiCall('editMessageText', {
            chat_id: chatId, message_id: messageId, text: cleanText.replace(/[*_`\\]/g, '')
        }).catch(() => null);
    }
}

async function createTelegramLiveProgress(ticket, { mode = 'execute', model = DEFAULT_AGY_MODEL, actorName = 'SuperAdmin', sourceChatId = null, sourceMessageId = null } = {}) {
    const { getTechChatsForTicket } = require('./ticketTelegram.service');
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id).catch(() => []);
    const targetChatIds = Array.from(new Set([
        ...(sourceChatId ? [String(sourceChatId)] : []),
        ...(chats || []).map((c) => String(c.chat_id))
    ]));
    const startTime = Date.now();
    let stepIndex = 0;
    let latestConsoleLine = mode === 'execute'
        ? 'Conectando con Consola AGY e iniciando aplicación del plan...'
        : 'Inspeccionando estructura del proyecto y analizando causa raíz...';

    const steps = mode === 'execute'
        ? [
            { pct: 25, label: 'Conectando con Consola AGY y preparando entorno...' },
            { pct: 50, label: 'Inspeccionando archivos del módulo e inyectando Plan aprobado...' },
            { pct: 75, label: 'Aplicando solución con AGY en el repositorio...' },
            { pct: 90, label: 'Verificando integridad del código y actualizando estado del ticket...' }
        ]
        : [
            { pct: 25, label: 'Conectando con Consola AGY y cargando telemetría del ticket...' },
            { pct: 55, label: 'Analizando archivos del módulo involucrado en el repositorio...' },
            { pct: 85, label: 'Estructurando pasos del Plan de Ejecución con AGY...' }
        ];

    if (sourceChatId && sourceMessageId) {
        telegramService.apiCall('editMessageReplyMarkup', {
            chat_id: sourceChatId,
            message_id: sourceMessageId,
            reply_markup: { inline_keyboard: [[{ text: mode === 'execute' ? '⚙️ AGY ejecutando solución... (En curso)' : '⏳ AGY generando plan... (En curso)', callback_data: 'agy_noop' }]] }
        }).catch(() => {});
    }

    const formatProgressText = (pct, statusText, done = false, incomplete = false) => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const icon = incomplete ? '⚠️' : (done ? '✅' : '⚙️');
        const title = mode === 'execute'
            ? (incomplete
                ? `EJECUCIÓN PENDIENTE DE CAMBIOS — #${escapeMd(ticket.ticket_code)}`
                : (done ? `SOLUCIÓN EJECUTADA EN CONSOLA AGY — #${escapeMd(ticket.ticket_code)}` : `AGY TRABAJANDO EN LA SOLUCIÓN — #${escapeMd(ticket.ticket_code)}`))
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
        const sent = await safeSendTelegramWithKeyboard(cid, formatProgressText(15, steps[0].label), null);
        if (sent?.message_id) liveMessages.push({ chatId: cid, messageId: sent.message_id });
    }

    const timer = setInterval(async () => {
        stepIndex = Math.min(steps.length - 1, stepIndex + 1);
        const step = steps[stepIndex];
        const statusToDisplay = latestConsoleLine || step.label;
        for (const item of liveMessages) {
            telegramService.apiCall('sendChatAction', { chat_id: item.chatId, action: 'typing' }).catch(() => {});
            await safeEditTelegramMessage(item.chatId, item.messageId, formatProgressText(step.pct, statusToDisplay, false, false));
        }
    }, 3000);

    return {
        onConsoleChunk(rawChunk = '') {
            const lines = sanitizeConsoleText(rawChunk).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('==='));
            if (lines.length > 0) latestConsoleLine = lines[lines.length - 1].slice(0, 140);
        },
        async complete(finalSummary = 'Proceso completado exitosamente en Consola AGY.', opts = {}) {
            clearInterval(timer);
            const isSuccess = opts.success !== undefined ? Boolean(opts.success) : !String(finalSummary || '').trim().startsWith('⚠️');
            const cleanFinal = sanitizeConsoleText(finalSummary).split('\n')[0].slice(0, 160);
            const finalPct = isSuccess ? 100 : 85;
            for (const item of liveMessages) {
                await safeEditTelegramMessage(item.chatId, item.messageId, formatProgressText(finalPct, cleanFinal, isSuccess, !isSuccess));
            }
            if (sourceChatId && sourceMessageId && mode === 'execute') {
                const nextMarkup = isSuccess
                    ? { inline_keyboard: [] }
                    : buildAgyPlanApprovalKeyboard(ticket.id, ticket.agy_plan_markdown || '', model || ticket.agy_model || DEFAULT_AGY_MODEL);
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: sourceChatId,
                    message_id: sourceMessageId,
                    reply_markup: nextMarkup
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

    const version = ticket.agy_plan_version || 1;
    const { requiresDecision, options } = extractAgyQuestionsAndOptions(ticket.agy_plan_markdown || '');
    const planBody = humanizeAndFormatAgyPlan(ticket, ticket.agy_plan_markdown);

    const headerTitle = requiresDecision
        ? `❓ *AGY REQUIERE TU DECISIÓN (Plan v${version}) — #${escapeMd(ticket.ticket_code)}*`
        : `🤖 *PROPUESTA DE SOLUCIÓN AGY (v${version}) — #${escapeMd(ticket.ticket_code)}*`;

    const footerHint = options.length > 0
        ? `👇 *Toca una opción para continuar o escribe tu indicación:*`
        : (requiresDecision ? `👇 *Responde con tu preferencia o aprueba la propuesta:*` : `👇 *Revisa y autoriza la ejecución:*`);

    const isFromAdmin = String(ticket.source_system || '').toLowerCase().includes('admin.sipesv.com') || String(ticket.ticket_code || '').toUpperCase().startsWith('ADM-');
    const projectTag = isFromAdmin ? 'admin.sipesv.com (SIPE Admin)' : 'sys.sipesv.com (SIPE SaaS)';
    const settings = await getAgyServerSettings().catch(() => ({ default_model: DEFAULT_AGY_MODEL }));
    const activeModel = resolveEffectiveAgyModel(ticket, settings);

    const msg =
        `${headerTitle}\n\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
        `🧠 *Modelo:* \`${escapeMd(activeModel)}\` (${escapeMd(getModelShortLabel(activeModel))})\n` +
        `🏢 *Módulo:* ${escapeMd(ticket.module_name || 'General')} (\`${escapeMd(projectTag)}\`)\n` +
        (ticket.ai_notes ? `🎯 *Directriz:* ${escapeMd(ticket.ai_notes)}\n` : '') +
        `\n━━━━━━━━━━━━━━━━━━━━\n` +
        `${planBody}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${footerHint}`;

    const replyMarkup = buildAgyPlanApprovalKeyboard(ticket.id, ticket.agy_plan_markdown || '', activeModel);
    for (const chat of chats) {
        await safeSendTelegramWithKeyboard(chat.chat_id, msg, replyMarkup);
    }
    return true;
}

async function notifyAgyReviewBranchToTelegram(ticket, reviewInfo = {}, approvedBy = 'SuperAdmin') {
    if (!ticket) return false;
    const { getTechChatsForTicket } = require('./ticketTelegram.service');
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (!chats || chats.length === 0) return false;

    const settings = await getAgyServerSettings().catch(() => ({ default_model: DEFAULT_AGY_MODEL }));
    const activeModel = resolveEffectiveAgyModel(ticket, settings);
    const diffPreview = reviewInfo.diffStat ? `\n\`\`\`\n${String(reviewInfo.diffStat).slice(0, 500)}\n\`\`\`\n` : '\n';
    const msg =
        `🔍 *RAMA DE REVISIÓN LISTA — #${escapeMd(ticket.ticket_code)}*\n` +
        `🌿 *Rama:* \`${escapeMd(reviewInfo.reviewBranch || '')}\` (\`${escapeMd(reviewInfo.commitHash || 'local')}\`)\n` +
        `🧠 *Modelo:* \`${escapeMd(activeModel)}\` (${escapeMd(getModelShortLabel(activeModel))})\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
        `👤 *Solicitado por:* ${escapeMd(approvedBy)}\n` +
        `📦 *Archivos:* \`${escapeMd((reviewInfo.modifiedFiles || []).join(', '))}\`` +
        diffPreview +
        `🛡️ _La rama main permanece protegida e intacta. Revisa el diff y pulsa Fusionar cuando estés listo:_`;

    const replyMarkup = buildAgyBranchReviewKeyboard(ticket.id, activeModel, reviewInfo.compareUrl || null);
    for (const chat of chats) {
        await safeSendTelegramWithKeyboard(chat.chat_id, msg, replyMarkup);
    }
    return true;
}

async function notifyAgyExecutionResultToTelegram(ticket, summaryText, approvedBy, options = {}) {
    if (!ticket) return false;
    const { getTechChatsForTicket } = require('./ticketTelegram.service');
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (!chats || chats.length === 0) return false;

    const isSuccess = options.success !== undefined ? Boolean(options.success) : !String(summaryText || '').trim().startsWith('⚠️');
    const msg = formatAgyExecutionResultForTelegram(ticket, summaryText, approvedBy, { success: isSuccess });
    const settings = await getAgyServerSettings().catch(() => ({ default_model: DEFAULT_AGY_MODEL }));
    const activeModel = resolveEffectiveAgyModel(ticket, settings);
    const replyMarkup = buildAgyPostExecutionKeyboard(ticket.id, isSuccess, activeModel);
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

    // Verificación fail-closed contra BD: solo administradores globales de soporte pueden operar Consola AGY
    const auth = await verifyTelegramSupportAccess(chatId, { requireGlobalAgy: true });
    if (!auth.allowed) {
        telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: auth.reason, show_alert: true }).catch(() => {});
        return true;
    }

    const parts = data.split(':');
    const action = parts[0];
    const rawId = parts[1];
    const extraArg = parts.slice(2).join(':');

    try {
        const { getTicketById } = require('./ticket.service');
        const {
            setTicketAgyModel,
            startTicketAgyPlanning,
            executeApprovedTicketAgyPlan,
            mergeTicketAgyReviewBranch,
            discardTicketAgyReviewBranch,
            rejectTicketAgyPlan
        } = require('./ticketAgyWorkflow.service');
        const { buildTicketInlineKeyboard } = require('./ticketTelegram.service');

        // Cambio de modelo global desde /modelo (sin ticket asociado)
        if (action === 'agy_set_def_model' || (action === 'agy_sdm' && (rawId === '0' || !rawId))) {
            const reqModel = action === 'agy_set_def_model' ? rawId : extraArg;
            const res = await setTicketAgyModel(null, reqModel, { setAsDefault: true });
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `✅ Modelo global: ${res.shortLabel}` }).catch(() => {});
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: buildAgyModelPickerKeyboard(0, res.model, { scope: 'global' })
                }).catch(() => {});
            }
            await safeSendTelegramWithKeyboard(
                chatId,
                `🌐 *Modelo AGY predeterminado actualizado*\n🧠 *Nuevo default global:* \`${escapeMd(res.model)}\` (${escapeMd(res.shortLabel)})\n👤 *Por:* ${escapeMd(techName)}`,
                null
            );
            return true;
        }

        const ticketId = parseInt(rawId, 10);
        if (isNaN(ticketId)) return true;

        const ticket = await getTicketById(ticketId);
        if (!ticket) {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '⚠️ Ticket no encontrado' }).catch(() => {});
            return true;
        }

        const settings = await getAgyServerSettings();
        const model = resolveEffectiveAgyModel(ticket, settings);
        const shortModel = getModelShortLabel(model);
        const getCardMarkup = (t, m) => (
            t.agy_status === 'esperando_fusion'
                ? buildAgyBranchReviewKeyboard(t.id, m)
                : (t.agy_status === 'esperando_aprobacion'
                    ? buildAgyPlanApprovalKeyboard(t.id, t.agy_plan_markdown || '', m)
                    : buildTicketInlineKeyboard(t.id, t.status, m))
        );

        if (action === 'agy_model_menu') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🧠 Elige el modelo AGY para #${ticket.ticket_code}` }).catch(() => {});
            const pickerKb = buildAgyModelPickerKeyboard(ticketId, model, { scope: 'ticket' });
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: pickerKb }).catch(() => {});
            } else {
                await safeSendTelegramWithKeyboard(chatId, `🧠 *Selecciona el modelo AGY para #${escapeMd(ticket.ticket_code)}*\nActual: \`${escapeMd(model)}\``, pickerKb);
            }
            return true;
        }

        if (action === 'agy_def_menu' || action === 'agy_def_model_menu') {
            const globalDefault = settings.default_model || DEFAULT_AGY_MODEL;
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '🌐 Selecciona el nuevo modelo default global' }).catch(() => {});
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: buildAgyModelPickerKeyboard(ticketId, globalDefault, { scope: 'global' })
                }).catch(() => {});
            }
            return true;
        }

        if (action === 'agy_sm' || action === 'agy_set_model') {
            const res = await setTicketAgyModel(ticketId, extraArg, { setAsDefault: false });
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `✅ Modelo de #${ticket.ticket_code}: ${res.shortLabel}` }).catch(() => {});
            const updatedTicket = res.ticket || { ...ticket, agy_model: res.model };
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: getCardMarkup(updatedTicket, res.model)
                }).catch(() => {});
            }
            await safeSendTelegramWithKeyboard(
                chatId,
                `🧠 *Modelo AGY actualizado en #${escapeMd(ticket.ticket_code)}*\n✨ *Modelo:* \`${escapeMd(res.model)}\` (${escapeMd(res.shortLabel)})\n_Usa los botones del ticket para planificar o ejecutar con este motor._`,
                null
            );
            return true;
        }

        if (action === 'agy_sdm') {
            const res = await setTicketAgyModel(ticketId, extraArg, { setAsDefault: true });
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🌐 Default global y #${ticket.ticket_code}: ${res.shortLabel}` }).catch(() => {});
            const updatedTicket = res.ticket || { ...ticket, agy_model: res.model };
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: getCardMarkup(updatedTicket, res.model)
                }).catch(() => {});
            }
            await safeSendTelegramWithKeyboard(
                chatId,
                `🌐 *Modelo AGY global actualizado*\n🧠 *Nuevo modelo:* \`${escapeMd(res.model)}\` (${escapeMd(res.shortLabel)})\n🎫 También aplicado a *#${escapeMd(ticket.ticket_code)}*.`,
                null
            );
            return true;
        }

        if (action === 'agy_back') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '⬅️ Volviendo al ticket' }).catch(() => {});
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: getCardMarkup(ticket, model)
                }).catch(() => {});
            }
            return true;
        }

        if (action === 'agy_pick_opt') {
            const optIdx = parseInt(parts[2], 10) || 1;
            const { options } = extractAgyQuestionsAndOptions(ticket.agy_plan_markdown || '');
            const picked = options.find((o) => o.index === optIdx);
            const chosenText = picked ? picked.label : `Opción ${optIdx}`;
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🎯 Opción ${optIdx} seleccionada. Re-planificando (${shortModel})...` }).catch(() => {});
            await startTicketAgyPlanning(ticketId, {
                model, approvedBy: `${techName} (Telegram)`,
                additionalFeedback: `DECISIÓN SELECCIONADA POR EL ADMINISTRADOR: Opción ${optIdx} (${chosenText}). Elabora el plan final aplicando esta opción.`,
                telegramContext: { sourceChatId: chatId, sourceMessageId: messageId }
            });
            return true;
        }

        if (action === 'agy_start_plan') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `🤖 AGY (${shortModel}) iniciando análisis y plan...` }).catch(() => {});
            await startTicketAgyPlanning(ticketId, { model, approvedBy: `${techName} (Telegram)`, telegramContext: { sourceChatId: chatId, sourceMessageId: messageId } });
            return true;
        }

        if (action === 'agy_plan_approve') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: `⚙️ ¡Plan aprobado! AGY (${shortModel}) ejecutando...` }).catch(() => {});
            await executeApprovedTicketAgyPlan(ticketId, { approvedBy: `${techName} (Telegram)`, telegramContext: { sourceChatId: chatId, sourceMessageId: messageId } });
            return true;
        }

        if (action === 'agy_plan_reject') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '❌ Plan denegado' }).catch(() => {});
            await rejectTicketAgyPlan(ticketId, { rejectedBy: `${techName} (Telegram)`, reason: 'Denegado desde Telegram' });
            await safeSendTelegramWithKeyboard(
                chatId,
                `❌ *Plan v${ticket.agy_plan_version || 1} DENEGADO* en Ticket *#${escapeMd(ticket.ticket_code)}* por *${escapeMd(techName)}*.\n_No se aplicaron cambios. Puedes ampliar comentarios o cambiar el modelo:_`,
                {
                    inline_keyboard: [
                        [{ text: '✏️ Ampliar Comentarios y Re-planificar', callback_data: `agy_plan_feedback:${ticketId}` }],
                        [{ text: `🧠 Cambiar Modelo (${shortModel})`, callback_data: `agy_model_menu:${ticketId}` }]
                    ]
                }
            );
            return true;
        }

        if (action === 'agy_merge_branch') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '🚀 Fusionando rama de revisión a main y desplegando...' }).catch(() => {});
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: [[{ text: '🚀 Fusionando y compilando main...', callback_data: 'agy_noop' }]] }
                }).catch(() => {});
            }
            setImmediate(async () => {
                try {
                    const mRes = await mergeTicketAgyReviewBranch(ticketId, {
                        approvedBy: `${techName} (Telegram)`,
                        telegramContext: { sourceChatId: chatId, sourceMessageId: messageId }
                    });
                    if (!mRes.success) {
                        if (chatId && messageId) {
                            telegramService.apiCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: buildAgyBranchReviewKeyboard(ticketId, model) }).catch(() => {});
                        }
                        await safeSendTelegramWithKeyboard(chatId, mRes.summary, buildAgyBranchReviewKeyboard(ticketId, model));
                        return;
                    }
                    await safeSendTelegramWithKeyboard(
                        chatId,
                        `🚀 *FUSIÓN COMPLETADA Y DESPLEGADA — #${escapeMd(ticket.ticket_code)}*\n` +
                        `🌿 *Rama:* \`${escapeMd(mRes.reviewBranch)}\` → \`${escapeMd(mRes.baseBranch)}\`\n` +
                        `🏷️ *Commit:* \`${escapeMd(mRes.commitHash || '')}\`${mRes.version ? ` · *${escapeMd(mRes.version)}*` : ''}\n` +
                        `✅ _Ticket marcado como Resuelto y rama temporal eliminada._`,
                        null
                    );
                } catch (err) {
                    await safeSendTelegramWithKeyboard(chatId, `⚠️ Error fusionando rama: ${err.message}`, buildAgyBranchReviewKeyboard(ticketId, model));
                }
            });
            return true;
        }

        if (action === 'agy_discard_branch') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id, text: '🗑️ Descartando rama de revisión...' }).catch(() => {});
            const dRes = await discardTicketAgyReviewBranch(ticketId, { rejectedBy: `${techName} (Telegram)` });
            if (chatId && messageId) {
                telegramService.apiCall('editMessageReplyMarkup', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: buildTicketInlineKeyboard(ticketId, ticket.status, model)
                }).catch(() => {});
            }
            await safeSendTelegramWithKeyboard(
                chatId,
                `${dRes.summary}\n📌 *Ticket #${escapeMd(ticket.ticket_code)}* permanece abierto para re-planificar.`,
                buildTicketInlineKeyboard(ticketId, ticket.status, model)
            );
            return true;
        }

        if (action === 'agy_plan_feedback') {
            telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});
            pendingAgyFeedbackMap.set(chatId, { ticketId, ticketCode: ticket.ticket_code, techName, expiresAt: Date.now() + 15 * 60 * 1000 });
            await safeSendTelegramWithKeyboard(
                chatId,
                `✍️ *Responder Duda / Ampliar Comentarios en Ticket #${escapeMd(ticket.ticket_code)}*\n\nEscribe tu respuesta, opción elegida o indicaciones adicionales para que \`agy\` (\`${escapeMd(model)}\`) continúe en Consola AGY (o escribe /cancelar):`,
                null
            );
            return true;
        }
    } catch (err) {
        console.error('[TicketAgyTelegram] Error en callback:', err);
        if (chatId) {
            await safeSendTelegramWithKeyboard(chatId, `⚠️ Aviso al procesar acción AGY: ${err.message || 'Error inesperado'}`, null);
        }
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

    const isAgyCmd = /^\/(?:ejecutar|reintentar|agy|modelo|modelos|fusionar|descartar)\b/i.test(trimmed);
    const pending = pendingAgyFeedbackMap.get(chatId);
    if (!isAgyCmd && !pending) return false;

    // Verificación fail-closed contra BD para todos los comandos AGY
    const auth = await verifyTelegramSupportAccess(chatId, { requireGlobalAgy: true });
    if (!auth.allowed) {
        if (pending) pendingAgyFeedbackMap.delete(chatId);
        if (isAgyCmd) {
            await telegramService.sendMessage(chatId, auth.reason);
            return true;
        }
        return false;
    }

    // /modelo [TICKET|alias_modelo] [alias_modelo]
    const modelCmdMatch = trimmed.match(/^\/modelos?(?:\s+(\S+))?(?:\s+(\S+))?$/i);
    if (modelCmdMatch) {
        const arg1 = (modelCmdMatch[1] || '').trim();
        const arg2 = (modelCmdMatch[2] || '').trim();
        const settings = await getAgyServerSettings();
        const currentDefault = settings.default_model || DEFAULT_AGY_MODEL;
        const { getTicketByCodeOrId } = require('./ticket.service');
        const { setTicketAgyModel } = require('./ticketAgyWorkflow.service');
        const { buildTicketInlineKeyboard } = require('./ticketTelegram.service');

        if (!arg1) {
            const listStr = AVAILABLE_AGY_MODELS
                .map((m) => `${m.id === currentDefault ? '✅' : '•'} \`${m.id}\` — ${m.short}`)
                .join('\n');
            await safeSendTelegramWithKeyboard(
                chatId,
                `🧠 *Selector de Modelo AGY*\n🌐 *Default actual:* \`${escapeMd(currentDefault)}\` (${escapeMd(getModelShortLabel(currentDefault))})\n\n${listStr}\n\n_Toca un botón abajo para cambiar el modelo global, o usa:_\n• \`/modelo neon-high\`\n• \`/modelo TKT-0034\`\n• \`/modelo TKT-0034 opus\``,
                buildAgyModelPickerKeyboard(0, currentDefault, { scope: 'global' })
            );
            return true;
        }

        if (/^(?:#?(?:ADM|TKT)-?\d+|#?\d+)$/i.test(arg1)) {
            const ticket = await getTicketByCodeOrId(arg1);
            if (!ticket) {
                await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${arg1}".`);
                return true;
            }
            const tModel = resolveEffectiveAgyModel(ticket, settings);
            if (!arg2) {
                await safeSendTelegramWithKeyboard(
                    chatId,
                    `🧠 *Cambiar Modelo AGY — Ticket #${escapeMd(ticket.ticket_code)}*\n📌 *Asunto:* ${escapeMd(ticket.subject)}\n✨ *Modelo actual:* \`${escapeMd(tModel)}\` (${escapeMd(getModelShortLabel(tModel))})`,
                    buildAgyModelPickerKeyboard(ticket.id, tModel, { scope: 'ticket' })
                );
                return true;
            }
            const resolved = resolveAgyModelId(arg2);
            if (!resolved) {
                await telegramService.sendMessage(chatId, `⚠️ Modelo no reconocido: "${arg2}". Usa /modelo para ver las opciones.`);
                return true;
            }
            const res = await setTicketAgyModel(ticket.id, resolved, { setAsDefault: false });
            const updatedTicket = res.ticket || { ...ticket, agy_model: res.model };
            const kb = updatedTicket.agy_status === 'esperando_aprobacion'
                ? buildAgyPlanApprovalKeyboard(updatedTicket.id, updatedTicket.agy_plan_markdown || '', res.model)
                : buildTicketInlineKeyboard(updatedTicket.id, updatedTicket.status, res.model);
            await safeSendTelegramWithKeyboard(
                chatId,
                `✅ *Modelo actualizado en #${escapeMd(ticket.ticket_code)}*\n🧠 *Nuevo modelo:* \`${escapeMd(res.model)}\` (${escapeMd(res.shortLabel)})`,
                kb
            );
            return true;
        }

        const resolvedGlobal = resolveAgyModelId(arg1);
        if (!resolvedGlobal) {
            await telegramService.sendMessage(chatId, `⚠️ Modelo o ticket no reconocido: "${arg1}". Usa /modelo para abrir el selector.`);
            return true;
        }
        const res = await setTicketAgyModel(null, resolvedGlobal, { setAsDefault: true });
        await safeSendTelegramWithKeyboard(
            chatId,
            `🌐 *Modelo AGY global actualizado*\n🧠 *Nuevo default:* \`${escapeMd(res.model)}\` (${escapeMd(res.shortLabel)})`,
            buildAgyModelPickerKeyboard(0, res.model, { scope: 'global' })
        );
        return true;
    }

    const mergeCmdMatch = trimmed.match(/^\/fusionar\s+([A-Za-z0-9#-]+)$/i);
    if (mergeCmdMatch) {
        const { getTicketByCodeOrId } = require('./ticket.service');
        const { mergeTicketAgyReviewBranch } = require('./ticketAgyWorkflow.service');
        const ticket = await getTicketByCodeOrId(mergeCmdMatch[1]);
        if (!ticket) {
            await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${mergeCmdMatch[1]}".`);
            return true;
        }
        await telegramService.sendMessage(chatId, `🚀 Fusionando rama de revisión de #${ticket.ticket_code} en main...`);
        setImmediate(async () => {
            try {
                const mRes = await mergeTicketAgyReviewBranch(ticket.id, { approvedBy: `${techName} (Telegram)`, telegramContext: { sourceChatId: chatId } });
                await safeSendTelegramWithKeyboard(chatId, mRes.summary, null);
            } catch (err) {
                await telegramService.sendMessage(chatId, `⚠️ Error fusionando rama: ${err.message}`);
            }
        });
        return true;
    }

    const discardCmdMatch = trimmed.match(/^\/descartar\s+([A-Za-z0-9#-]+)$/i);
    if (discardCmdMatch) {
        const { getTicketByCodeOrId } = require('./ticket.service');
        const { discardTicketAgyReviewBranch } = require('./ticketAgyWorkflow.service');
        const ticket = await getTicketByCodeOrId(discardCmdMatch[1]);
        if (!ticket) {
            await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${discardCmdMatch[1]}".`);
            return true;
        }
        const dRes = await discardTicketAgyReviewBranch(ticket.id, { rejectedBy: `${techName} (Telegram)` });
        await safeSendTelegramWithKeyboard(chatId, dRes.summary, null);
        return true;
    }

    const execCmdMatch = trimmed.match(/^\/(?:ejecutar|reintentar)\s+([A-Za-z0-9#-]+)$/i);
    if (execCmdMatch) {
        const { getTicketByCodeOrId } = require('./ticket.service');
        const { executeApprovedTicketAgyPlan } = require('./ticketAgyWorkflow.service');
        const ticket = await getTicketByCodeOrId(execCmdMatch[1]);
        if (!ticket) {
            await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${execCmdMatch[1]}".`);
            return true;
        }
        await executeApprovedTicketAgyPlan(ticket.id, {
            approvedBy: `${techName} (Telegram)`,
            telegramContext: { sourceChatId: chatId }
        });
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

    if (!pending) return false;
    pendingAgyFeedbackMap.delete(chatId);
    if (Date.now() > pending.expiresAt || trimmed.startsWith('/')) return false;

    const { startTicketAgyPlanning } = require('./ticketAgyWorkflow.service');
    await startTicketAgyPlanning(pending.ticketId, { approvedBy: `${techName} (Telegram)`, additionalFeedback: trimmed, telegramContext: { sourceChatId: chatId } });
    return true;
}

module.exports = {
    buildAgyModelPickerKeyboard,
    buildAgyPlanApprovalKeyboard,
    buildAgyBranchReviewKeyboard,
    createTelegramLiveProgress,
    sendAgyPlanToTelegram,
    notifyAgyReviewBranchToTelegram,
    notifyAgyExecutionResultToTelegram,
    handleAgyTelegramCallback,
    handleAgyTelegramText
};
