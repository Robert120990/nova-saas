const pool = require('../config/db');
const telegramService = require('./telegram.service');
const notificationService = require('./notification.service');
const { broadcastToCompany, sendToUser } = require('./websocket.service');
const { revertCloseoutLubricantsInventory } = require('./gasCloseoutInventory.service');
const { logCloseoutChange } = require('../controllers/gasCloseout/gasCloseoutUtils');

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[])/g, '\\$1');
}

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
 * Notifica inmediatamente al usuario que solicitó la reapertura (in-app, WebSocket y Telegram personal).
 */
async function notifyReopenResultToUser({ req, closeout, branchName, resolvedBy, isApproved }) {
    if (!req?.requested_by) return;

    const turnoNum = closeout?.numero_turno || '';
    const actionCode = isApproved ? 'gas_closeout_reopen_approved' : 'gas_closeout_reopen_rejected';
    const title = isApproved
        ? `Reapertura de Turno #${turnoNum} Aprobada`
        : `Reapertura de Turno #${turnoNum} Rechazada`;
    const message = isApproved
        ? `Tu solicitud para reabrir el Turno #${turnoNum}${branchName ? ` (${branchName})` : ''} fue aprobada por ${resolvedBy}. Ya puedes modificar el turno.`
        : `Tu solicitud para reabrir el Turno #${turnoNum} fue rechazada por ${resolvedBy}.`;
    const link = '/gas-station/historial-lecturas';

    let notifId = null;

    // 1. Guardar en bandeja de notificaciones in-app
    try {
        const [insertRes] = await pool.query(
            `INSERT INTO notifications (company_id, user_id, rule_id, action_code, title, message, link)
             VALUES (?, ?, NULL, ?, ?, ?, ?)`,
            [req.company_id, req.requested_by, actionCode, title, message, link]
        );
        notifId = insertRes.insertId;
    } catch (err) {
        console.error('[ReopenRequest] Error guardando notificación in-app para el solicitante:', err.message);
    }

    // 2. Notificación en tiempo real vía WebSocket directo al usuario
    try {
        sendToUser(req.requested_by, 'new_notification', {
            id: notifId,
            action_code: actionCode,
            title,
            message,
            link,
            is_read: false,
            created_at: new Date().toISOString()
        });

        sendToUser(req.requested_by, actionCode, {
            closeoutId: req.closeout_id,
            requestId: req.id,
            numeroTurno: turnoNum,
            branchId: req.branch_id,
            resolvedBy,
            isApproved,
            title,
            message
        });
    } catch (err) {
        console.error('[ReopenRequest] Error enviando WS directo al solicitante:', err.message);
    }

    // 3. Notificar directamente por Telegram si el usuario solicitante tiene cuenta vinculada
    try {
        const [userRows] = await pool.query('SELECT username, nombre FROM users WHERE id = ?', [req.requested_by]);
        const user = userRows[0];
        if (user) {
            const [userChats] = await pool.query(
                `SELECT DISTINCT chat_id FROM telegram_chat_bindings
                 WHERE ((username IS NOT NULL AND LOWER(username) = LOWER(?))
                    OR (nombre IS NOT NULL AND LOWER(nombre) = LOWER(?)))
                   AND (company_id = ? OR company_id IS NULL)
                   AND receive_alerts = 1`,
                [user.username || '', user.nombre || '', req.company_id]
            );

            const tgText = isApproved
                ? `✅ *SOLICITUD DE REAPERTURA APROBADA*\n\n` +
                  `Hola *${escapeMd(req.requested_by_name)}*, tu solicitud para reabrir el Turno *#${escapeMd(turnoNum)}*${branchName ? ` (${escapeMd(branchName)})` : ''} fue *APROBADA* por *${escapeMd(resolvedBy)}*.\n\n` +
                  `Ya puedes ingresar al sistema y editar el turno.`
                : `❌ *SOLICITUD DE REAPERTURA RECHAZADA*\n\n` +
                  `Hola *${escapeMd(req.requested_by_name)}*, tu solicitud para reabrir el Turno *#${escapeMd(turnoNum)}* fue *RECHAZADA* por *${escapeMd(resolvedBy)}*.`;

            for (const chat of userChats) {
                if (req.resolved_chat_id && String(chat.chat_id) === String(req.resolved_chat_id)) continue;
                await telegramService.sendMessage(chat.chat_id, tgText, { parse_mode: 'Markdown' }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('[ReopenRequest] Error enviando Telegram al solicitante:', err.message);
    }
}

/**
 * Envía la alerta interactiva de reapertura a los chats de Telegram autorizados.
 */
async function sendReopenTelegramNotification({ requestId, closeout, companyId, branchId, userName, reason }) {
    const effectiveBranchId = closeout.branch_id || branchId || null;

    const [compRows] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [companyId]);
    const [brRows] = effectiveBranchId
        ? await pool.query('SELECT nombre FROM branches WHERE id = ?', [effectiveBranchId])
        : [[]];
    const companyName = compRows[0]?.razon_social || 'Empresa';
    const branchName = brRows[0]?.nombre || 'Sucursal';
    const fechaText = formatDateSV(closeout.fecha_turno);

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
            [companyId, effectiveBranchId]
        );
        chats = activeChats;
    }

    const telegramText =
        `🔓 *SOLICITUD DE REAPERTURA DE TURNO*\n\n` +
        `El usuario *${escapeMd(userName)}* solicita la apertura del cierre de lectura:\n\n` +
        `🏢 *Empresa:* ${escapeMd(companyName)}\n` +
        `📍 *Sucursal:* ${escapeMd(branchName)}\n` +
        `📋 *Turno:* #${escapeMd(closeout.numero_turno)}\n` +
        `📅 *Fecha:* ${escapeMd(fechaText)}\n` +
        `👤 *Responsable:* ${escapeMd(closeout.seller_name || 'No especificado')}\n` +
        `💬 *Motivo:* ${escapeMd(reason || 'Sin motivo especificado')}\n\n` +
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

    return sentCount;
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

    const [existing] = await pool.query(
        `SELECT id, reason, requested_by_name, created_at FROM gas_station_closeout_reopen_requests
         WHERE closeout_id = ? AND status = 'pending'
         ORDER BY id DESC LIMIT 1`,
        [closeoutId]
    );

    if (existing.length > 0) {
        const effectiveReason = reason || existing[0].reason;
        const effectiveUser = userName || existing[0].requested_by_name || 'Usuario';
        if (reason && reason !== existing[0].reason) {
            await pool.query(
                `UPDATE gas_station_closeout_reopen_requests
                 SET reason = ?, requested_by = ?, requested_by_name = ?
                 WHERE id = ?`,
                [reason, userId, effectiveUser, existing[0].id]
            );
        }

        const sentCount = await sendReopenTelegramNotification({
            requestId: existing[0].id,
            closeout,
            companyId,
            branchId: closeout.branch_id || branchId,
            userName: effectiveUser,
            reason: effectiveReason
        });

        return {
            alreadyPending: true,
            requestId: existing[0].id,
            sentToTelegram: sentCount > 0,
            message: sentCount > 0
                ? 'Solicitud reenviada a los administradores vía Telegram.'
                : 'Ya existe una solicitud pendiente de aprobación para este turno.'
        };
    }

    const [insertResult] = await pool.query(
        `INSERT INTO gas_station_closeout_reopen_requests
         (company_id, branch_id, closeout_id, requested_by, requested_by_name, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [companyId, closeout.branch_id || branchId, closeoutId, userId, userName || 'Usuario', reason || null]
    );

    const requestId = insertResult.insertId;

    const sentCount = await sendReopenTelegramNotification({
        requestId,
        closeout,
        companyId,
        branchId: closeout.branch_id || branchId,
        userName: userName || 'Usuario',
        reason
    });

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
 * Aprueba una solicitud de reapertura, cambia el estado del cierre y notifica inmediatamente al usuario.
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

    const [brRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [closeout.branch_id]);
    const branchName = brRows[0]?.nombre || 'Sucursal';

    // 1. Notificar inmediatamente al usuario que hizo la solicitud (in-app, WS y Telegram personal)
    await notifyReopenResultToUser({
        req: { ...req, resolved_chat_id: chatId },
        closeout,
        branchName,
        resolvedBy,
        isApproved: true
    });

    // 2. Disparar reglas de notificación configuradas en la empresa
    try {
        notificationService.notify('gas_closeout_reopened', req.company_id, closeout.branch_id, {
            turno: closeout.numero_turno,
            fecha: formatDateSV(closeout.fecha_turno),
            sucursal: branchName,
            aprobado_por: resolvedBy,
            solicitante: req.requested_by_name
        });
    } catch {}

    // 3. Notificar por WebSocket para actualización en tiempo real en la pantalla de la empresa
    try {
        broadcastToCompany(req.company_id, 'gas_closeout_reopened', {
            closeoutId: req.closeout_id,
            requestId,
            estado: 'reabierto',
            approvedBy: resolvedBy
        });
    } catch {}

    // 4. Actualizar mensaje en Telegram de los administradores
    const updateText =
        `✅ *SOLICITUD APROBADA*\n\n` +
        `El Turno *#${escapeMd(closeout.numero_turno)}* (${escapeMd(branchName)}) ha sido *REABIERTO* en el sistema inmediatamente.\n\n` +
        `🟢 *Aprobado por:* ${escapeMd(resolvedBy)}\n` +
        `👤 *Solicitante:* ${escapeMd(req.requested_by_name)}\n` +
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
 * Rechaza una solicitud de reapertura y notifica inmediatamente al usuario solicitante.
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

    const [closeouts] = await pool.query('SELECT id, numero_turno, branch_id FROM gas_station_closeouts WHERE id = ?', [req.closeout_id]);
    const closeout = closeouts[0] || { id: req.closeout_id, numero_turno: '', branch_id: req.branch_id };
    const turnoNum = closeout?.numero_turno || '';

    // Notificar inmediatamente al usuario que hizo la solicitud
    await notifyReopenResultToUser({
        req: { ...req, resolved_chat_id: chatId },
        closeout,
        branchName: '',
        resolvedBy,
        isApproved: false
    });

    try {
        broadcastToCompany(req.company_id, 'gas_closeout_reopen_rejected', {
            closeoutId: req.closeout_id,
            requestId,
            rejectedBy: resolvedBy
        });
    } catch {}

    const rejectText =
        `❌ *SOLICITUD RECHAZADA*\n\n` +
        `La reapertura del Turno *#${escapeMd(turnoNum)}* fue rechazada por *${escapeMd(resolvedBy)}*.\n\n` +
        `👤 *Solicitante:* ${escapeMd(req.requested_by_name)}`;

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
async function getLatestPendingForCompany(companyId = null, branchId = null) {
    let query = `SELECT * FROM gas_station_closeout_reopen_requests WHERE status = 'pending'`;
    const params = [];
    if (companyId) {
        query += ` AND company_id = ?`;
        params.push(companyId);
    }
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
    sendReopenTelegramNotification,
    approveReopenRequest,
    rejectReopenRequest,
    getLatestPendingForCompany,
    getCloseoutReopenStatus
};
