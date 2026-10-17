const pool = require('../config/db');
const { sendToUser, broadcastToCompany } = require('./websocket.service');

async function generateTicketCode() {
    const [rows] = await pool.query('SELECT id FROM support_tickets ORDER BY id DESC LIMIT 1');
    const nextNum = (rows[0]?.id || 0) + 1;
    return `TKT-${String(nextNum).padStart(4, '0')}`;
}

function getCurrentSystemVersion() {
    try {
        const { execSync } = require('child_process');
        const count = parseInt(execSync('git rev-list --count HEAD', { cwd: __dirname, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10);
        if (!isNaN(count) && count >= 1000) {
            return `2.08.${String(count - 999).padStart(2, '0')}`;
        }
    } catch {
        // Fallback silencioso
    }
    return '2.08';
}

function toApiUploadUrl(url) {
    if (!url || typeof url !== 'string') return url;
    return url.startsWith('/uploads/') ? `/api${url}` : url;
}

function normalizeTicketRow(row, messages = undefined) {
    if (!row) return null;
    let parsedAtt = row.attachments_json;
    if (typeof parsedAtt === 'string') {
        try { parsedAtt = JSON.parse(parsedAtt); } catch { parsedAtt = null; }
    }
    if (Array.isArray(parsedAtt)) {
        parsedAtt = parsedAtt.map((a) => (a && a.url ? { ...a, url: toApiUploadUrl(a.url) } : a));
    }
    const base = {
        ...row,
        code: row.ticket_code,
        creator_name: row.user_name,
        screenshot_url: toApiUploadUrl(row.screenshot_url),
        attachments_json: parsedAtt || row.attachments_json
    };
    if (messages !== undefined) {
        base.messages = messages.map((m) => ({
            ...m,
            attachment_url: toApiUploadUrl(m.attachment_url),
            sender_role: m.sender_type === 'user' ? 'user' : 'tech',
            source: m.sender_type === 'telegram' ? 'telegram' : 'web'
        }));
    }
    return base;
}

async function createTicket({
    companyId,
    branchId = null,
    userId,
    userName,
    userRole = null,
    type = 'problema',
    priority = 'media',
    subject,
    description,
    pageUrl = null,
    moduleName = null,
    screenshotUrl = null,
    attachmentsJson = null,
    browserInfo = null,
    diagnosticsJson = null,
    diagnosticRelevance = 'sin_errores',
    diagnosticScore = 0
}) {
    const ticketCode = await generateTicketCode();
    const safeSubject = String(subject || '').trim().slice(0, 250);
    const safeDesc = String(description || safeSubject).trim();

    const [result] = await pool.query(
        `INSERT INTO support_tickets
         (ticket_code, company_id, branch_id, user_id, user_name, user_role, type, priority, status,
          subject, description, page_url, module_name, screenshot_url, attachments_json,
          browser_info, diagnostics_json, diagnostic_relevance, diagnostic_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            ticketCode,
            companyId,
            branchId || null,
            userId,
            String(userName || 'Usuario').slice(0, 150),
            userRole ? String(userRole).slice(0, 80) : null,
            type || 'problema',
            priority || 'media',
            safeSubject,
            safeDesc,
            pageUrl ? String(pageUrl).slice(0, 500) : null,
            moduleName ? String(moduleName).slice(0, 120) : null,
            screenshotUrl || null,
            attachmentsJson ? JSON.stringify(attachmentsJson) : null,
            browserInfo ? String(browserInfo).slice(0, 500) : null,
            diagnosticsJson ? JSON.stringify(diagnosticsJson) : null,
            diagnosticRelevance || 'sin_errores',
            Number(diagnosticScore) || 0
        ]
    );

    const ticketId = result.insertId;

    await pool.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, attachment_url)
         VALUES (?, 'user', ?, ?, ?, ?)`,
        [ticketId, userId, userName || 'Usuario', description.trim(), screenshotUrl || null]
    );

    const ticket = await getTicketById(ticketId);

    // Notificar por Telegram a los técnicos en segundo plano
    const { notifyNewTicketToTelegram } = require('./ticketTelegram.service');
    notifyNewTicketToTelegram(ticket)
        .then(async (sent) => {
            if (sent) {
                await pool.query('UPDATE support_tickets SET telegram_notified = 1 WHERE id = ?', [ticketId]);
            }
        })
        .catch(err => console.error('[TicketService] Error enviando ticket a Telegram:', err.message));

    try {
        broadcastToCompany(companyId, 'ticket_created', {
            id: ticketId,
            code: ticketCode,
            ticket_code: ticketCode,
            subject: ticket.subject,
            priority: ticket.priority,
            type: ticket.type,
            status: 'abierto',
            user_name: ticket.user_name,
            creator_name: ticket.user_name
        });
    } catch {
        // Ignore broadcast error
    }

    return ticket;
}

async function getTicketById(ticketId) {
    const [rows] = await pool.query(
        `SELECT t.*,
                c.razon_social AS company_name,
                b.nombre AS branch_name
         FROM support_tickets t
         LEFT JOIN companies c ON c.id = t.company_id
         LEFT JOIN branches b ON b.id = t.branch_id
         WHERE t.id = ?
         LIMIT 1`,
        [ticketId]
    );
    if (rows.length === 0) return null;

    const [messages] = await pool.query(
        `SELECT * FROM support_ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
        [ticketId]
    );

    return normalizeTicketRow(rows[0], messages);
}

async function getTicketByCodeOrId(codeOrId) {
    const clean = String(codeOrId || '').trim().toUpperCase().replace(/^#/, '');
    if (/^\d+$/.test(clean)) {
        return getTicketById(parseInt(clean, 10));
    }
    const normalizedCode = clean.startsWith('TKT-') ? clean : `TKT-${clean.padStart(4, '0')}`;
    const [rows] = await pool.query('SELECT id FROM support_tickets WHERE ticket_code = ? LIMIT 1', [normalizedCode]);
    if (rows.length === 0) return null;
    return getTicketById(rows[0].id);
}

async function updateTicketStatus(ticketId, {
    status,
    assignedTo = null,
    assignedName = null,
    resolvedByName = null,
    resolutionNotes = null,
    resolvedVersion = null,
    updatedByType = 'tech',
    updatedById = null
}) {
    const existing = await getTicketById(ticketId);
    if (!existing) throw new Error('Ticket no encontrado');

    const updates = ['status = ?'];
    const params = [status];

    if (assignedTo !== null) {
        updates.push('assigned_to = ?');
        params.push(assignedTo);
    }
    if (assignedName !== null) {
        updates.push('assigned_name = ?');
        params.push(assignedName);
    }

    if (status === 'resuelto') {
        const version = resolvedVersion || getCurrentSystemVersion();
        const solver = resolvedByName || assignedName || existing.assigned_name || 'Soporte Técnico';
        const notes = resolutionNotes !== null
            ? resolutionNotes
            : (existing.resolution_notes || 'Se aplicaron las correcciones y mejoras correspondientes a tu solicitud.');

        updates.push('resolved_at = NOW()', 'resolved_by_name = ?', 'resolution_notes = ?', 'resolved_version = ?', 'creator_notified_at = NULL');
        params.push(solver, notes, version);
    } else if (resolutionNotes !== null) {
        updates.push('resolution_notes = ?');
        params.push(resolutionNotes);
    }

    params.push(ticketId);
    await pool.query(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, params);

    const actorName = resolvedByName || assignedName || 'Soporte Técnico';
    let systemMsg = `Estado actualizado a "${status.toUpperCase().replace('_', ' ')}" por ${actorName}.`;
    if (status === 'resuelto' && resolutionNotes) {
        systemMsg += `\nSolución: ${resolutionNotes}`;
    }

    await pool.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, sender_name, message)
         VALUES (?, ?, ?, ?, ?)`,
        [ticketId, updatedByType, updatedById, actorName, systemMsg]
    );

    const updatedTicket = await getTicketById(ticketId);

    // Si el ticket pasó a RESUELTO: avisar ÚNICAMENTE al usuario que lo creó
    if (status === 'resuelto') {
        try {
            const notifTitle = `✅ Ticket ${updatedTicket.ticket_code} Resuelto`;
            const notifBody = `Tu ticket "${updatedTicket.subject}" fue resuelto por ${updatedTicket.resolved_by_name || 'Soporte Técnico'}: ${updatedTicket.resolution_notes || ''}`;
            await pool.query(
                `INSERT INTO notifications (company_id, user_id, action_code, title, message, link, is_read)
                 VALUES (?, ?, 'TICKET_RESOLVED', ?, ?, ?, 0)`,
                [
                    updatedTicket.company_id,
                    updatedTicket.user_id,
                    notifTitle,
                    notifBody.slice(0, 500),
                    `/soporte/tickets?ticketId=${updatedTicket.id}`
                ]
            );
        } catch (err) {
            console.error('[TicketService] Error creando notificación interna:', err.message);
        }

        try {
            sendToUser(updatedTicket.user_id, 'ticket_resolved', {
                id: updatedTicket.id,
                user_id: updatedTicket.user_id,
                code: updatedTicket.ticket_code,
                ticket_code: updatedTicket.ticket_code,
                subject: updatedTicket.subject,
                type: updatedTicket.type,
                priority: updatedTicket.priority,
                page_url: updatedTicket.page_url,
                module_name: updatedTicket.module_name,
                resolution_notes: updatedTicket.resolution_notes,
                resolved_by_name: updatedTicket.resolved_by_name,
                resolved_version: updatedTicket.resolved_version,
                resolved_at: updatedTicket.resolved_at
            });
            sendToUser(updatedTicket.user_id, 'new_notification', {
                title: `✅ Ticket ${updatedTicket.ticket_code} Resuelto`,
                body: `Tu ticket "${updatedTicket.subject}" ha sido resuelto.`,
                link: `/soporte/tickets?ticketId=${updatedTicket.id}`
            });
        } catch (err) {
            console.error('[TicketService] Error enviando WS ticket_resolved al creador:', err.message);
        }
    } else {
        try {
            sendToUser(updatedTicket.user_id, 'ticket_updated', {
                id: updatedTicket.id,
                user_id: updatedTicket.user_id,
                code: updatedTicket.ticket_code,
                ticket_code: updatedTicket.ticket_code,
                status: updatedTicket.status,
                assigned_name: updatedTicket.assigned_name
            });
        } catch {
            // Ignore
        }
    }

    if (updatedByType !== 'telegram' && (status === 'resuelto' || status === 'en_proceso')) {
        const { notifyTicketStatusToTelegram } = require('./ticketTelegram.service');
        notifyTicketStatusToTelegram(updatedTicket).catch(() => {});
    }

    try {
        broadcastToCompany(updatedTicket.company_id, 'ticket_updated', { id: updatedTicket.id, status: updatedTicket.status });
    } catch {
        // Ignore
    }

    return updatedTicket;
}

async function addTicketMessage(ticketId, { senderType = 'user', senderId = null, senderName, message, attachmentUrl = null }) {
    const existing = await getTicketById(ticketId);
    if (!existing) throw new Error('Ticket no encontrado');

    await pool.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, attachment_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ticketId, senderType, senderId, senderName || 'Usuario', message.trim(), attachmentUrl || null]
    );

    await pool.query('UPDATE support_tickets SET updated_at = NOW() WHERE id = ?', [ticketId]);

    const updated = await getTicketById(ticketId);

    if (senderType === 'tech' || senderType === 'telegram') {
        try {
            sendToUser(existing.user_id, 'ticket_message', {
                id: existing.id,
                ticket_id: existing.id,
                code: existing.ticket_code,
                ticket_code: existing.ticket_code,
                sender_name: senderName,
                message: message.trim()
            });
        } catch {
            // Ignore
        }
    } else {
        const { notifyTicketCommentToTelegram } = require('./ticketTelegram.service');
        notifyTicketCommentToTelegram(updated, senderName, message.trim(), attachmentUrl).catch(() => {});
    }

    return updated;
}

module.exports = {
    generateTicketCode,
    normalizeTicketRow,
    createTicket,
    getTicketById,
    getTicketByCodeOrId,
    updateTicketStatus,
    addTicketMessage
};
