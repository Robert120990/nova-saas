const pool = require('../config/db');
const telegramService = require('./telegram.service');
const { broadcastToCompany } = require('./websocket.service');
const { revertCloseoutLubricantsInventory } = require('./gasCloseoutInventory.service');
const { logCloseoutChange } = require('../controllers/gasCloseout/gasCloseoutUtils');

function formatDateSV(dateVal) {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal).slice(0, 10);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return String(dateVal);
    }
}

/**
 * Registra una solicitud de reapertura y notifica a los chats de Telegram autorizados.
 */
async function createReopenRequest({ closeoutId, companyId, branchId, userId, userName, reason }) {
    const [closeouts] = await pool.query(
        `SELECT id, numero_turno, fecha_turno, estado, seller_name, branch_id, company_id
         FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
        [closeoutId, companyId]
    );

    if (closeouts.length === 0) {
        throw new Error('Cierre de lecturas no encontrado.');
    }
    const closeout = closeouts[0];
    if (closeout.estado !== 'cerrado') {
        throw new Error('Solo se puede solicitar la apertura de un cierre que esté cerrado.');
    }

    // Verificar si ya existe una solicitud pendiente
    const [existing] = await pool.query(
        `SELECT id, created_at FROM gas_station_closeout_reopen_requests
         WHERE closeout_id = ? AND status = 'pending'
         ORDER BY id DESC LIMIT 1`,
        [closeoutId]
    );

    if (existing.length > 0) {
        return {
            alreadyPending: true,
            requestId: existing[0].id,
            message: 'Ya existe una solicitud pendiente de aprobación para este turno.'
        };
    }

    const [insertResult] = await pool.query(
        `INSERT INTO gas_station_closeout_reopen_requests
         (company_id, branch_id, closeout_id, requested_by, requested_by_name, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [companyId, closeout.branch_id || branchId, closeoutId, userId, userName || 'Usuario', reason || null]
    );

    const requestId = insertResult.insertId;

    // Obtener nombres de empresa y sucursal
    const [compRows] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [companyId]);
    const [brRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [closeout.branch_id || branchId]);
    const companyName = compRows[0]?.razon_social || 'Empresa';
    const branchName = brRows[0]?.nombre || 'Sucursal';
    const fechaText = formatDateSV(closeout.fecha_turno);

    // Buscar chats de Telegram autorizados para recibir solicitudes de reapertura
    let chats = [];
    const [settingsRows] = await pool.query('SELECT reopen_requests_active FROM telegram_settings WHERE id = 1');
    const reopenActive = settingsRows.length > 0 ? (settingsRows[0].reopen_requests_active !== 0) : true;

    if (reopenActive) {
        const [activeChats] = await pool.query(
            `SELECT DISTINCT chat_id FROM telegram_chat_bindings
             WHERE (company_id = ? OR company_id IS NULL)
               AND (branch_id = ? OR branch_id IS NULL)
               AND receive_alerts = 1
               AND (receive_reopen_requests = 1 OR can_approve_entries = 1)`,
            [companyId, closeout.branch_id || branchId]
        );
        chats = activeChats;
    }

    const telegramText =
        `🔓 *SOLICITUD DE REAPERTURA DE TURNO*\n\n` +
        `El usuario *${userName}* solicita la apertura del cierre de lectura:\n\n` +
        `🏢 *Empresa:* ${companyName}\n` +
        `📍 *Sucursal:* ${branchName}\n` +
        `📋 *Turno:* #${closeout.numero_turno}\n` +
        `📅 *Fecha:* ${fechaText}\n` +
        `👤 *Responsable:* ${closeout.seller_name || 'No especificado'}\n` +
        `💬 *Motivo:* ${reason || 'Sin motivo especificado'}\n\n` +
        `¿Apruebas la reapertura de este turno?`;

    const inlineKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ Sí, Aprobar', callback_data: `reopen_approve:${requestId}` },
                { text: '❌ Rechazar', callback_data: `reopen_reject:${requestId}` }
            ]
        ]
    };

    let sentCount = 0;
    for (const chat of chats) {
        try {
            await telegramService.sendMessage(chat.chat_id, telegramText, {
                parse_mode: 'Markdown',
                reply_markup: inlineKeyboard
            });
            sentCount++;
        } catch (err) {
            console.error(`[ReopenRequest] Error enviando Telegram a chat ${chat.chat_id}:`, err.message);
        }
    }

    // Notificar en tiempo real vía WebSocket a la empresa
    try {
        broadcastToCompany(companyId, 'gas_closeout_reopen_requested', {
            closeoutId,
            requestId,
            numeroTurno: closeout.numero_turno,
            branchId: closeout.branch_id || branchId,
            requestedBy: userName,
            status: 'pending'
        });
    } catch {}

    return {
        success: true,
        requestId,
        sentToTelegram: sentCount > 0,
        message: sentCount > 0
            ? 'Solicitud enviada a los administradores vía Telegram.'
            : 'Solicitud registrada. Notifique a su supervisor para su aprobación.'
    };
}

/**
 * Aprueba una solicitud de reapertura y cambia el estado del cierre inmediatamente.
 */
async function approveReopenRequest({ requestId, resolvedBy = 'Administrador', chatId = null, messageId = null }) {
    const [requests] = await pool.query(
        `SELECT * FROM gas_station_closeout_reopen_requests WHERE id = ?`,
        [requestId]
    );

    if (requests.length === 0) {
        return { success: false, message: 'Solicitud no encontrada.' };
    }
    const req = requests[0];
    if (req.status !== 'pending') {
        return {
            success: false,
            alreadyResolved: true,
            status: req.status,
            message: `Esta solicitud ya fue ${req.status === 'approved' ? 'aprobada' : 'rechazada'} anteriormente.`
        };
    }

    const [closeouts] = await pool.query(
        `SELECT id, numero_turno, fecha_turno, estado, branch_id, company_id FROM gas_station_closeouts WHERE id = ?`,
        [req.closeout_id]
    );

    if (closeouts.length === 0) {
        return { success: false, message: 'Cierre asociado no encontrado.' };
    }
    const closeout = closeouts[0];

    // Cambiar estado a reabierto
    await pool.query(
        `UPDATE gas_station_closeouts SET estado = 'reabierto' WHERE id = ?`,
        [req.closeout_id]
    );

    // Revertir inventario de lubricantes
    try {
        await revertCloseoutLubricantsInventory(pool, req.company_id, req.closeout_id);
    } catch (err) {
        console.error('[ReopenRequest] Error revirtiendo inventario lubricantes:', err.message);
    }

    // Bitácora de cambios
    try {
        await logCloseoutChange(
            { user: { id: req.requested_by, name: req.requested_by_name } },
            req.closeout_id,
            'reopen',
            'reopen',
            `Cierre reabierto vía Telegram por ${resolvedBy}`,
            {}
        );
    } catch {}

    // Marcar solicitud como aprobada
    await pool.query(
        `UPDATE gas_station_closeout_reopen_requests
         SET status = 'approved', resolved_by = ?, resolved_chat_id = ?, resolved_at = NOW()
         WHERE id = ?`,
        [resolvedBy, chatId, requestId]
    );

    // Notificar por WebSocket para actualización en tiempo real en la pantalla del usuario
    try {
        broadcastToCompany(req.company_id, 'gas_closeout_reopened', {
            closeoutId: req.closeout_id,
            requestId,
            estado: 'reabierto',
            approvedBy: resolvedBy
        });
    } catch {}

    // Actualizar mensaje de Telegram si corresponde
    const [brRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [closeout.branch_id]);
    const branchName = brRows[0]?.nombre || 'Sucursal';
    const updateText =
        `✅ *SOLICITUD APROBADA*\n\n` +
        `El Turno *#${closeout.numero_turno}* (${branchName}) ha sido *REABIERTO* en el sistema inmediatamente.\n\n` +
        `🟢 *Aprobado por:* ${resolvedBy}\n` +
        `👤 *Solicitante:* ${req.requested_by_name}\n` +
        `⏰ *Hora:* ${new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}\n\n` +
        `_El usuario ya puede editar el cierre en el sistema._`;

    if (chatId && messageId) {
        try {
            await telegramService.apiCall('editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: updateText,
                parse_mode: 'Markdown'
            });
        } catch {
            await telegramService.sendMessage(chatId, updateText, { parse_mode: 'Markdown' }).catch(() => {});
        }
    } else if (chatId) {
        await telegramService.sendMessage(chatId, updateText, { parse_mode: 'Markdown' }).catch(() => {});
    }

    return { success: true, message: 'Turno reabierto exitosamente.' };
}

/**
 * Rechaza una solicitud de reapertura.
 */
async function rejectReopenRequest({ requestId, resolvedBy = 'Administrador', chatId = null, messageId = null }) {
    const [requests] = await pool.query(
        `SELECT * FROM gas_station_closeout_reopen_requests WHERE id = ?`,
        [requestId]
    );

    if (requests.length === 0) return { success: false, message: 'Solicitud no encontrada.' };
    const req = requests[0];
    if (req.status !== 'pending') {
        return { success: false, alreadyResolved: true, message: 'La solicitud ya fue procesada anteriormente.' };
    }

    await pool.query(
        `UPDATE gas_station_closeout_reopen_requests
         SET status = 'rejected', resolved_by = ?, resolved_chat_id = ?, resolved_at = NOW()
         WHERE id = ?`,
        [resolvedBy, chatId, requestId]
    );

    try {
        broadcastToCompany(req.company_id, 'gas_closeout_reopen_rejected', {
            closeoutId: req.closeout_id,
            requestId,
            rejectedBy: resolvedBy
        });
    } catch {}

    const [closeouts] = await pool.query('SELECT numero_turno FROM gas_station_closeouts WHERE id = ?', [req.closeout_id]);
    const turnoNum = closeouts[0]?.numero_turno || '';

    const rejectText =
        `❌ *SOLICITUD RECHAZADA*\n\n` +
        `La reapertura del Turno *#${turnoNum}* fue rechazada por *${resolvedBy}*.\n\n` +
        `👤 *Solicitante:* ${req.requested_by_name}`;

    if (chatId && messageId) {
        try {
            await telegramService.apiCall('editMessageText', {
                chat_id: chatId,
                message_id: messageId,
                text: rejectText,
                parse_mode: 'Markdown'
            });
        } catch {
            await telegramService.sendMessage(chatId, rejectText, { parse_mode: 'Markdown' }).catch(() => {});
        }
    } else if (chatId) {
        await telegramService.sendMessage(chatId, rejectText, { parse_mode: 'Markdown' }).catch(() => {});
    }

    return { success: true, message: 'Solicitud rechazada.' };
}

/**
 * Obtiene la última solicitud pendiente para un chat / empresa.
 */
async function getLatestPendingForCompany(companyId, branchId = null) {
    let query = `SELECT * FROM gas_station_closeout_reopen_requests WHERE company_id = ? AND status = 'pending'`;
    const params = [companyId];
    if (branchId) {
        query += ` AND branch_id = ?`;
        params.push(branchId);
    }
    query += ` ORDER BY id DESC LIMIT 1`;
    const [rows] = await pool.query(query, params);
    return rows[0] || null;
}

/**
 * Obtiene el estado de la solicitud para un cierre específico.
 */
async function getCloseoutReopenStatus(closeoutId, companyId) {
    const [rows] = await pool.query(
        `SELECT id, status, requested_by_name, reason, created_at, resolved_by, resolved_at
         FROM gas_station_closeout_reopen_requests
         WHERE closeout_id = ? AND company_id = ?
         ORDER BY id DESC LIMIT 1`,
        [closeoutId, companyId]
    );
    return rows[0] || null;
}

module.exports = {
    createReopenRequest,
    approveReopenRequest,
    rejectReopenRequest,
    getLatestPendingForCompany,
    getCloseoutReopenStatus
};
