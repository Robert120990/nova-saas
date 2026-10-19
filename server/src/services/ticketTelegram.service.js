const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const telegramService = require('./telegram.service');

// chat_id -> { action: 'resolve_note' | 'comment', ticketId, ticketCode, techName, expiresAt }
const pendingTechActions = new Map();

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[])/g, '\\$1');
}

const PRIORITY_BADGE = { urgente: '🔴 URGENTE', alta: '🟠 ALTA', media: '🔵 MEDIA', baja: '⚪ BAJA' };
const TYPE_BADGE = { problema: '🐛 Problema / Error', requerimiento: '✨ Requerimiento', mejora: '🚀 Mejora', consulta: '❓ Consulta' };

async function getTechChatsForTicket(companyId, branchId) {
    const [settingsRows] = await pool.query('SELECT support_tickets_active FROM telegram_settings WHERE id = 1');
    const active = settingsRows.length > 0 ? (settingsRows[0].support_tickets_active !== 0) : true;
    if (!active) return [];

    // Los usuarios técnicos globales (Roberto y Raul) siempre reciben todos los tickets de cualquier empresa/sucursal,
    // además de los enlaces configurados con receive_support_tickets = 1 para la empresa del ticket.
    const [chats] = await pool.query(
        `SELECT DISTINCT chat_id, nombre, username FROM telegram_chat_bindings
         WHERE COALESCE(receive_support_tickets, 1) = 1
           AND (
               LOWER(COALESCE(nombre, '')) LIKE '%robert%'
               OR LOWER(COALESCE(username, '')) LIKE '%robert%'
               OR LOWER(COALESCE(nombre, '')) LIKE '%raul%'
               OR LOWER(COALESCE(nombre, '')) LIKE '%raúl%'
               OR LOWER(COALESCE(username, '')) LIKE '%raul%'
               OR LOWER(COALESCE(username, '')) LIKE '%rrsm%'
               OR (
                   receive_alerts = 1
                   AND (company_id = ? OR company_id IS NULL)
                   AND (branch_id = ? OR branch_id IS NULL)
               )
           )`,
        [companyId || null, branchId || null]
    );
    if (chats.length > 0) return chats;

    const [globalChats] = await pool.query(
        `SELECT DISTINCT chat_id, nombre, username FROM telegram_chat_bindings
         WHERE COALESCE(receive_support_tickets, 1) = 1`
    );
    return globalChats;
}

function resolveLocalUploadPath(screenshotUrl) {
    if (!screenshotUrl || typeof screenshotUrl !== 'string') return null;
    const clean = screenshotUrl.split('?')[0].replace(/\\/g, '/').trim();
    const fileName = path.basename(clean);
    if (!fileName || fileName === '.' || fileName === '..') return null;
    const uploadsRoot = path.resolve(__dirname, '../../uploads');
    const resolved = path.resolve(uploadsRoot, fileName);
    if (!resolved.startsWith(uploadsRoot + path.sep)) return null;
    return fs.existsSync(resolved) ? resolved : null;
}

async function sendLocalPhotoToTelegram(chatId, screenshotUrl, caption, replyMarkup) {
    const token = await telegramService.getBotToken();
    const filePath = resolveLocalUploadPath(screenshotUrl);
    if (!token || !filePath) return false;

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.webp' ? 'image/webp' : 'image/png');
    const blob = new Blob([fileBuffer], { type: mime });

    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', blob, path.basename(filePath));
    if (caption) {
        form.append('caption', caption.slice(0, 1020));
        form.append('parse_mode', 'Markdown');
    }
    if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || `HTTP ${res.status}`);
    return true;
}

function buildTicketInlineKeyboard(ticketId, status = 'abierto') {
    if (status === 'resuelto' || status === 'cerrado') {
        return { inline_keyboard: [[{ text: '💬 Enviar Comentario Adicional', callback_data: `ticket_comment:${ticketId}` }]] };
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

    const text =
        `🎫 *NUEVO TICKET DE SOPORTE — #${escapeMd(ticket.ticket_code)}*\n\n` +
        `📌 *Asunto:* ${escapeMd(ticket.subject)}\n` +
        `🏷️ *Tipo:* ${typeText}  |  *Prioridad:* ${prioText}\n` +
        `🏢 *Empresa:* ${escapeMd(ticket.company_name || 'Empresa')} (${escapeMd(ticket.branch_name || 'Global')})\n` +
        `👤 *Reportado por:* ${escapeMd(ticket.user_name)}${ticket.user_role ? ` (${escapeMd(ticket.user_role)})` : ''}\n` +
        (ticket.page_url ? `🖥️ *Pantalla:* \`${escapeMd(ticket.page_url)}\`\n` : '') +
        `\n📝 *Descripción:*\n${escapeMd(ticket.description)}\n` +
        firstCaption +
        diagLine +
        `\n_Selecciona una acción o usa /resolver ${escapeMd(ticket.ticket_code)} <nota>_`;

    const replyMarkup = buildTicketInlineKeyboard(ticket.id, ticket.status);
    let sentCount = 0;

    for (const chat of chats) {
        try {
            let photoSent = false;
            if (ticket.screenshot_url) {
                try { photoSent = await sendLocalPhotoToTelegram(chat.chat_id, ticket.screenshot_url, text, replyMarkup); } catch { /* fallback */ }
            }
            if (!photoSent) {
                await telegramService.sendMessage(chat.chat_id, text, { parse_mode: 'Markdown', reply_markup: replyMarkup });
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
        await telegramService.sendMessage(chatId, `🛠️ *Ticket #${escapeMd(ticket.ticket_code)} en proceso*\nAsignado a: *${escapeMd(techName)}*\nAsunto: ${escapeMd(ticket.subject)}`, { parse_mode: 'Markdown' }).catch(() => {});
        return true;
    }

    if (action === 'ticket_resolve') {
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
        pendingTechActions.set(chatId, { action: isResolve ? 'resolve_note' : 'comment', ticketId, ticketCode: ticket.ticket_code, techName, expiresAt: Date.now() + 10 * 60 * 1000 });
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
        const note = (resolveMatch[2] || '').trim() || 'El equipo técnico ha aplicado los cambios y resuelto tu ticket.';
        await updateTicketStatus(ticket.id, { status: 'resuelto', resolvedByName: `${techName} (Telegram)`, resolutionNotes: note, updatedByType: 'telegram' });
        await telegramService.sendMessage(chatId, `✅ *Ticket #${escapeMd(ticket.ticket_code)} RESUELTO*\n📝 *Solución:* ${escapeMd(note)}\n🔔 _Pop-up enviado únicamente a ${escapeMd(ticket.user_name)}._`, { parse_mode: 'Markdown' });
        return true;
    }

    const pending = pendingTechActions.get(chatId);
    if (pending) {
        pendingTechActions.delete(chatId);
        if (Date.now() > pending.expiresAt || trimmed.startsWith('/')) return false;
        if (pending.action === 'resolve_note') {
            const updated = await updateTicketStatus(pending.ticketId, { status: 'resuelto', resolvedByName: `${techName} (Telegram)`, resolutionNotes: trimmed, updatedByType: 'telegram' });
            await telegramService.sendMessage(chatId, `✅ *Ticket #${escapeMd(updated.ticket_code)} RESUELTO CON NOTA*\n📝 *Nota:* ${escapeMd(trimmed)}\n🔔 _Notificado únicamente a ${escapeMd(updated.user_name)}._`, { parse_mode: 'Markdown' });
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
    handleTicketTelegramCallback,
    handleTicketTelegramText
};
