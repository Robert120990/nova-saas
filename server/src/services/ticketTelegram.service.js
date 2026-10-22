const pool = require('../config/db');
const telegramService = require('./telegram.service');
const {
    getTechChatsForTicket,
    resolveLocalUploadPath,
    sendLocalPhotoToTelegram
} = require('./ticketTelegramMedia.service');

// chat_id -> { action: 'resolve_note' | 'comment', ticketId, ticketCode, techName, messageId, expiresAt }
const pendingTechActions = new Map();

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[])/g, '\\$1');
}

const PRIORITY_BADGE = { urgente: '🔴 URGENTE', alta: '🟠 ALTA', media: '🔵 MEDIA', baja: '⚪ BAJA' };
const TYPE_BADGE = { problema: '🐛 Problema / Error', requerimiento: '✨ Requerimiento', mejora: '🚀 Mejora', consulta: '❓ Consulta' };

let telegramSchemaEnsured = false;
async function ensureTicketTelegramSchema() {
    if (telegramSchemaEnsured) return;
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM support_tickets');
        const colNames = cols.map((c) => c.Field);
        if (!colNames.includes('telegram_messages_json')) {
            await pool.query('ALTER TABLE support_tickets ADD COLUMN telegram_messages_json JSON NULL AFTER telegram_notified');
        }
        telegramSchemaEnsured = true;
    } catch {
        // Columna ya existe o tabla en migración
    }
}

async function removeTicketTelegramButtons(ticketId, directContext = null) {
    const targets = [];
    if (directContext?.chatId && directContext?.messageId) {
        targets.push({ chatId: directContext.chatId, messageId: directContext.messageId });
    }

    if (ticketId) {
        try {
            const [rows] = await pool.query('SELECT telegram_messages_json FROM support_tickets WHERE id = ?', [ticketId]);
            const raw = rows[0]?.telegram_messages_json;
            const list = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
            for (const item of list) {
                if (item?.chatId && item?.messageId) {
                    if (!targets.some((t) => String(t.chatId) === String(item.chatId) && Number(t.messageId) === Number(item.messageId))) {
                        targets.push(item);
                    }
                }
            }
        } catch { /* ignore */ }
    }

    for (const target of targets) {
        try {
            await telegramService.apiCall('editMessageReplyMarkup', {
                chat_id: target.chatId,
                message_id: target.messageId,
                reply_markup: { inline_keyboard: [] }
            });
        } catch {
            // Ignorado si el mensaje ya fue editado o eliminado
        }
    }
}

function buildTicketInlineKeyboard(ticketId, status = 'abierto') {
    if (status === 'resuelto' || status === 'cerrado') {
        return { inline_keyboard: [] };
    }
    return {
        inline_keyboard: [
            [{ text: '🤖 Aprobar y Planificar AGY', callback_data: `agy_start_plan:${ticketId}` }],
            [{ text: '🛠️ En Proceso', callback_data: `ticket_take:${ticketId}` }, { text: '✅ Marcar Resuelto', callback_data: `ticket_resolve:${ticketId}` }],
            [{ text: '✍️ Resolver con Nota', callback_data: `ticket_resolve_note:${ticketId}` }, { text: '💬 Comentar al Usuario', callback_data: `ticket_comment:${ticketId}` }]
        ]
    };
}

async function notifyNewTicketToTelegram(ticket) {
    if (!ticket) return false;
    await ensureTicketTelegramSchema();
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (chats.length === 0) return false;

    const prioText = PRIORITY_BADGE[ticket.priority] || '🔵 MEDIA';
    const typeText = TYPE_BADGE[ticket.type] || '🐛 Problema';

    let diag = ticket.diagnostics_json;
    if (typeof diag === 'string') { try { diag = JSON.parse(diag); } catch { diag = null; } }
    let diagLine = '';
    if (diag && diag.relevance && diag.relevance !== 'sin_errores') {
        const icon = diag.relevance === 'alta' ? '🚨' : (diag.relevance === 'media' ? '⚠️' : 'ℹ️');
        diagLine = `\n${icon} *Diagnóstico Auto (${diag.score || 0}%):* ${escapeMd(diag.explanation || diag.verdictLabel)}\n`;
    }

    let attList = ticket.attachments_json;
    if (typeof attList === 'string') { try { attList = JSON.parse(attList); } catch { attList = []; } }
    const firstCaption = Array.isArray(attList) && attList[0]?.caption ? `\n🖼️ *Nota en captura:* "${escapeMd(attList[0].caption)}"\n` : '';

    const isFromAdmin = String(ticket.source_system || '').toLowerCase().includes('admin.sipesv.com') || String(ticket.ticket_code || '').toUpperCase().startsWith('ADM-');
    const projectBadge = isFromAdmin ? '🌐 *Proyecto:* `admin.sipesv.com` (SIPE Admin)' : '🖥️ *Proyecto:* `sys.sipesv.com` (SIPE SaaS)';

    const text =
        `🎫 *NUEVO TICKET DE SOPORTE — #${escapeMd(ticket.ticket_code)}*\n` +
        `${projectBadge}\n\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
        `🏷️ *Tipo:* ${typeText}  |  *Prioridad:* ${prioText}\n` +
        `🏢 *Empresa:* ${escapeMd(ticket.company_name || (isFromAdmin ? 'SIPE Admin' : 'Empresa'))} (${escapeMd(ticket.branch_name || 'Global')})\n` +
        `👤 *Reportado por:* ${escapeMd(ticket.user_name)}${ticket.user_role ? ` (${escapeMd(ticket.user_role)})` : ''}\n` +
        (ticket.page_url ? `🖥️ *Pantalla:* \`${escapeMd(ticket.page_url)}\`\n` : '') +
        `\n📝 *Descripción:*\n${escapeMd(ticket.description)}\n` +
        firstCaption +
        diagLine +
        `\n_Selecciona una acción o usa /resolver ${escapeMd(ticket.ticket_code)} <nota>_`;

    const replyMarkup = buildTicketInlineKeyboard(ticket.id, ticket.status);
    let sentCount = 0;
    const sentTelegramMessages = [];

    for (const chat of chats) {
        try {
            let photoResult = null;
            if (ticket.screenshot_url) {
                try { photoResult = await sendLocalPhotoToTelegram(chat.chat_id, ticket.screenshot_url, text, replyMarkup); } catch { /* fallback */ }
            }
            let sentMsgId = photoResult?.message_id;
            if (!photoResult) {
                const sendRes = await telegramService.sendMessage(chat.chat_id, text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
                if (Array.isArray(sendRes) && sendRes[0]?.message_id) {
                    sentMsgId = sendRes[0].message_id;
                }
            }
            if (sentMsgId) {
                sentTelegramMessages.push({ chatId: chat.chat_id, messageId: sentMsgId });
            }
            if (Array.isArray(attList) && attList.length > 1) {
                for (const extra of attList.slice(1, 4)) {
                    if (extra?.url) {
                        await sendLocalPhotoToTelegram(chat.chat_id, extra.url, `📎 *#${escapeMd(ticket.ticket_code)}* ${escapeMd(extra.caption || 'Captura adicional')}`, null).catch(() => {});
                    }
                }
            }
            sentCount++;
        } catch (err) {
            console.error(`[TicketTelegram] Error enviando ticket a chat ${chat.chat_id}:`, err.message);
        }
    }

    if (sentTelegramMessages.length > 0) {
        await pool.query('UPDATE support_tickets SET telegram_messages_json = ? WHERE id = ?', [JSON.stringify(sentTelegramMessages), ticket.id]).catch(() => {});
    }

    return sentCount > 0;
}

async function notifyTicketCommentToTelegram(ticket, senderName, commentText, attachmentUrl = null) {
    if (!ticket) return;
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (chats.length === 0) return;

    const msg = `💬 *Nuevo comentario en Ticket #${escapeMd(ticket.ticket_code)}*\n📌 *Asunto:* ${escapeMd(ticket.subject)}\n👤 *Usuario:* ${escapeMd(senderName)}\n\n"${escapeMd(commentText)}"`;
    const replyMarkup = buildTicketInlineKeyboard(ticket.id, ticket.status);
    for (const chat of chats) {
        let sentPhoto = false;
        if (attachmentUrl) {
            try { sentPhoto = await sendLocalPhotoToTelegram(chat.chat_id, attachmentUrl, msg, replyMarkup); } catch { /* fallback */ }
        }
        if (!sentPhoto) {
            await telegramService.sendMessage(chat.chat_id, msg, { parse_mode: 'Markdown', reply_markup: replyMarkup }).catch(() => {});
        }
    }
}

async function notifyTicketStatusToTelegram(ticket) {
    if (!ticket) return;
    if (ticket.status === 'resuelto' || ticket.status === 'cerrado') {
        await removeTicketTelegramButtons(ticket.id).catch(() => {});
    }
    const chats = await getTechChatsForTicket(ticket.company_id, ticket.branch_id);
    if (chats.length === 0) return;
    const msg = ticket.status === 'resuelto'
        ? `✅ *Ticket #${escapeMd(ticket.ticket_code)} RESUELTO*\n📌 *Asunto:* ${escapeMd(ticket.subject)}\n🛠️ *Resuelto por:* ${escapeMd(ticket.resolved_by_name || 'Soporte Técnico')}\n📝 *Solución:* ${escapeMd(ticket.resolution_notes || 'Mejora/corrección aplicada.')}\n🔔 _Pop-up exclusivo enviado a ${escapeMd(ticket.user_name)}._`
        : `🛠️ *Ticket #${escapeMd(ticket.ticket_code)} — ${escapeMd(String(ticket.status || '').toUpperCase())}*\n📌 *Asunto:* ${escapeMd(ticket.subject)}\n👤 *Asignado:* ${escapeMd(ticket.assigned_name || 'Soporte Técnico')}`;
    for (const chat of chats) {
        await telegramService.sendMessage(chat.chat_id, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }
}

async function handleTicketTelegramCallback(cb) {
    const data = cb?.data || '';
    if (data.startsWith('agy_')) {
        const { handleAgyTelegramCallback } = require('./ticketAgyTelegram.service');
        return handleAgyTelegramCallback(cb);
    }
    if (!data.startsWith('ticket_')) return false;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const techName = cb.from?.first_name || cb.from?.username || 'Soporte Técnico';
    const { getTicketById, updateTicketStatus } = require('./ticket.service');
    telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});
    const [action, rawId] = data.split(':');
    const ticketId = parseInt(rawId, 10);
    if (isNaN(ticketId)) return true;

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        await telegramService.sendMessage(chatId, '⚠️ Ticket no encontrado.').catch(() => {});
        return true;
    }

    if (action === 'ticket_take') {
        await updateTicketStatus(ticketId, { status: 'en_proceso', assignedName: `${techName} (Telegram)`, updatedByType: 'telegram' });
        const updatedMarkup = {
            inline_keyboard: [
                [{ text: '🤖 Aprobar y Planificar AGY', callback_data: `agy_start_plan:${ticketId}` }],
                [{ text: '✅ Marcar Resuelto', callback_data: `ticket_resolve:${ticketId}` }],
                [{ text: '✍️ Resolver con Nota', callback_data: `ticket_resolve_note:${ticketId}` }, { text: '💬 Comentar al Usuario', callback_data: `ticket_comment:${ticketId}` }]
            ]
        };
        if (chatId && messageId) {
            telegramService.apiCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: updatedMarkup }).catch(() => {});
        }
        await telegramService.sendMessage(chatId, `🛠️ *Ticket #${escapeMd(ticket.ticket_code)} en proceso*\nAsignado a: *${escapeMd(techName)}*\nAsunto: ${escapeMd(ticket.subject)}`, { parse_mode: 'Markdown' }).catch(() => {});
        return true;
    }

    if (action === 'ticket_resolve') {
        await removeTicketTelegramButtons(ticketId, { chatId, messageId });
        await updateTicketStatus(ticketId, { status: 'resuelto', resolvedByName: `${techName} (Telegram)`, resolutionNotes: 'El equipo técnico ha realizado los ajustes solicitados y resuelto tu ticket.', updatedByType: 'telegram' });
        await telegramService.sendMessage(chatId, `✅ *Ticket #${escapeMd(ticket.ticket_code)} MARCADO COMO RESUELTO*\n📌 *Asunto:* ${escapeMd(ticket.subject)}\n🔔 _Se ha enviado automáticamente el pop-up de resolución únicamente a ${escapeMd(ticket.user_name)}._`, { parse_mode: 'Markdown' }).catch(() => {});
        return true;
    }

    if (action === 'ticket_resolve_note' || action === 'ticket_comment') {
        const isResolve = action === 'ticket_resolve_note';
        if (pendingTechActions.size > 100) {
            const now = Date.now();
            for (const [k, v] of pendingTechActions.entries()) { if (now > v.expiresAt) pendingTechActions.delete(k); }
        }
        pendingTechActions.set(chatId, {
            action: isResolve ? 'resolve_note' : 'comment',
            ticketId,
            ticketCode: ticket.ticket_code,
            techName,
            messageId: isResolve ? messageId : null,
            expiresAt: Date.now() + 10 * 60 * 1000
        });
        const promptText = isResolve
            ? `✍️ *Resolver Ticket #${escapeMd(ticket.ticket_code)} con nota*\nEscribe qué solución aplicaste para enviársela en el pop-up a *${escapeMd(ticket.user_name)}* (o /cancelar):`
            : `💬 *Comentar en Ticket #${escapeMd(ticket.ticket_code)}*\nEscribe el mensaje para *${escapeMd(ticket.user_name)}* (o /cancelar):`;
        await telegramService.sendMessage(chatId, promptText, { parse_mode: 'Markdown' }).catch(() => {});
        return true;
    }
    return false;
}

async function handleTicketTelegramText(chatId, text, from) {
    const { handleAgyTelegramText } = require('./ticketAgyTelegram.service');
    const handledAgy = await handleAgyTelegramText(chatId, text, from);
    if (handledAgy) return true;

    const trimmed = (text || '').trim();
    const techName = from?.first_name || from?.username || 'Soporte Técnico';
    const { getTicketByCodeOrId, updateTicketStatus, addTicketMessage } = require('./ticket.service');

    if (/^\/cancelar$/i.test(trimmed) && pendingTechActions.has(chatId)) {
        pendingTechActions.delete(chatId);
        await telegramService.sendMessage(chatId, '❎ Acción de ticket cancelada.');
        return true;
    }

    if (/^\/tickets\b/i.test(trimmed)) {
        const [rows] = await pool.query(`SELECT id, ticket_code, subject, priority, status, user_name FROM support_tickets WHERE status IN ('abierto', 'en_proceso') ORDER BY FIELD(priority, 'urgente', 'alta', 'media', 'baja'), created_at DESC LIMIT 10`);
        if (rows.length === 0) {
            await telegramService.sendMessage(chatId, '🎉 No hay tickets pendientes o en proceso en este momento.');
            return true;
        }
        let listMsg = `🎫 *Tickets Activos (${rows.length}):*\n\n`;
        for (const r of rows) {
            listMsg += `${r.status === 'en_proceso' ? '🛠️' : '🆕'} *#${escapeMd(r.ticket_code)}* (${r.priority.toUpperCase()}) — ${escapeMd(r.subject)} _(${escapeMd(r.user_name)})_\n`;
        }
        listMsg += `\n_Comandos:_ \`/agy TKT-0001\` _(planificar con AGY)_ | \`/resolver TKT-0001 Solución\``;
        await telegramService.sendMessage(chatId, listMsg, { parse_mode: 'Markdown' });
        return true;
    }

    const resolveMatch = trimmed.match(/^\/resolver\s+([A-Za-z0-9#-]+)(?:\s+([\s\S]+))?$/i);
    if (resolveMatch) {
        const ticket = await getTicketByCodeOrId(resolveMatch[1]);
        if (!ticket) {
            await telegramService.sendMessage(chatId, `⚠️ No se encontró el ticket "${resolveMatch[1]}".`);
            return true;
        }
        await removeTicketTelegramButtons(ticket.id);
        const note = (resolveMatch[2] || '').trim() || 'El equipo técnico ha aplicado los cambios y resuelto tu ticket.';
        await updateTicketStatus(ticket.id, { status: 'resuelto', resolvedByName: `${techName} (Telegram)`, resolutionNotes: note, updatedByType: 'telegram' });
        await telegramService.sendMessage(chatId, `✅ *Ticket #${escapeMd(ticket.ticket_code)} RESUELTO*\n📌 *Asunto:* ${escapeMd(ticket.subject)}\n📝 *Solución:* ${escapeMd(note)}\n🔔 _Pop-up enviado únicamente a ${escapeMd(ticket.user_name)}._`, { parse_mode: 'Markdown' });
        return true;
    }

    const pending = pendingTechActions.get(chatId);
    if (pending) {
        pendingTechActions.delete(chatId);
        if (Date.now() > pending.expiresAt || trimmed.startsWith('/')) return false;
        if (pending.action === 'resolve_note') {
            await removeTicketTelegramButtons(pending.ticketId, { chatId, messageId: pending.messageId });
            const updated = await updateTicketStatus(pending.ticketId, { status: 'resuelto', resolvedByName: `${techName} (Telegram)`, resolutionNotes: trimmed, updatedByType: 'telegram' });
            await telegramService.sendMessage(chatId, `✅ *Ticket #${escapeMd(updated.ticket_code)} RESUELTO CON NOTA*\n📌 *Asunto:* ${escapeMd(updated.subject)}\n📝 *Nota:* ${escapeMd(trimmed)}\n🔔 _Notificado únicamente a ${escapeMd(updated.user_name)}._`, { parse_mode: 'Markdown' });
            return true;
        }
        if (pending.action === 'comment') {
            const updated = await addTicketMessage(pending.ticketId, { senderType: 'telegram', senderName: `${techName} (Telegram)`, message: trimmed });
            await telegramService.sendMessage(chatId, `💬 Comentario enviado a *${escapeMd(updated.user_name)}* en el ticket *#${escapeMd(updated.ticket_code)}*.`, { parse_mode: 'Markdown' });
            return true;
        }
    }
    return false;
}

module.exports = {
    getTechChatsForTicket,
    resolveLocalUploadPath,
    notifyNewTicketToTelegram,
    notifyTicketCommentToTelegram,
    notifyTicketStatusToTelegram,
    removeTicketTelegramButtons,
    handleTicketTelegramCallback,
    handleTicketTelegramText
};
