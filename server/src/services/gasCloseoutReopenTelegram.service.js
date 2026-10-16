const pool = require('../config/db');
const telegramService = require('./telegram.service');
const {
    approveReopenRequest,
    rejectReopenRequest,
    getLatestPendingForCompany
} = require('./gasCloseoutReopenRequest.service');

/**
 * Maneja eventos de botones interactivos (Inline Keyboard) de Telegram.
 */
async function handleTelegramCallback(cb) {
    const data = cb.data || '';
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const userDisplayName = cb.from?.first_name || cb.from?.username || 'Administrador';

    // Responder callback a Telegram de inmediato para remover el estado de carga en la app
    telegramService.apiCall('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => {});

    if (data.startsWith('reopen_approve:') || data.startsWith('reopen_reject:')) {
        const isApprove = data.startsWith('reopen_approve:');
        const prefix = isApprove ? 'reopen_approve:' : 'reopen_reject:';
        const requestId = parseInt(data.replace(prefix, ''), 10);
        if (isNaN(requestId)) return;

        // 1. Validar que la solicitud existe
        const [reqRows] = await pool.query(
            'SELECT id, company_id, branch_id, status FROM gas_station_closeout_reopen_requests WHERE id = ?',
            [requestId]
        );
        if (reqRows.length === 0) {
            await telegramService.sendMessage(chatId, '⚠️ Solicitud de reapertura no encontrada.').catch(() => {});
            return;
        }
        const reopenReq = reqRows[0];

        // 2. Validar que el chat de Telegram está vinculado y cuenta con permiso de aprobación
        const [bindings] = await pool.query(
            'SELECT company_id, branch_id, can_approve_entries, is_admin FROM telegram_chat_bindings WHERE chat_id = ?',
            [chatId]
        );
        if (bindings.length === 0) {
            await telegramService.sendMessage(chatId, '⛔ Tu cuenta de Telegram no está vinculada al sistema.').catch(() => {});
            return;
        }
        const b = bindings[0];
        if (!b.can_approve_entries && !b.is_admin) {
            await telegramService.sendMessage(chatId, '⛔ No tienes permiso para aprobar o rechazar reaperturas de turnos.').catch(() => {});
            return;
        }

        // 3. Aislamiento multi-empresa
        if (b.company_id !== null && b.company_id !== reopenReq.company_id) {
            await telegramService.sendMessage(chatId, '⛔ No tienes autorización para gestionar solicitudes de otra empresa.').catch(() => {});
            return;
        }
        if (b.branch_id !== null && reopenReq.branch_id !== null && b.branch_id !== reopenReq.branch_id) {
            await telegramService.sendMessage(chatId, '⛔ Esta solicitud pertenece a otra sucursal.').catch(() => {});
            return;
        }

        // 4. Ejecutar la aprobación o rechazo
        const actionFn = isApprove ? approveReopenRequest : rejectReopenRequest;
        const res = await actionFn({
            requestId,
            resolvedBy: `${userDisplayName} (Telegram)`,
            chatId,
            messageId
        });
        if (!res.success && res.alreadyResolved) {
            await telegramService.sendMessage(chatId, `ℹ️ ${res.message}`).catch(() => {});
        }
    }
}

/**
 * Maneja respuestas de texto enviadas por administradores en Telegram ("si", "sí", "aprobar" / "no", "rechazar").
 * Retorna true si el mensaje fue procesado como respuesta a una solicitud de reapertura.
 */
async function handleTelegramTextApproval(chatId, text, from, state) {
    const trimmed = (text || '').trim().toLowerCase();
    const isAffirmative = /^(si|sí|aprobar|apruebo|aprobado|reabrir|confirmar|ok|dale)$/i.test(trimmed);
    const isNegative = /^(no|rechazar|rechazo|cancelar|denegar)$/i.test(trimmed);

    if (!isAffirmative && !isNegative) return false;

    // Validar autorización del chat en BD
    const [bindings] = await pool.query(
        'SELECT company_id, branch_id, can_approve_entries, is_admin FROM telegram_chat_bindings WHERE chat_id = ?',
        [chatId]
    );
    if (bindings.length === 0) return false;

    const b = bindings[0];
    if (!b.can_approve_entries && !b.is_admin) {
        return false;
    }

    const companyId = b.company_id || state?.companyId;
    const branchId = b.branch_id || state?.branchId;
    if (!companyId) return false;

    const pendingReq = await getLatestPendingForCompany(companyId, branchId);
    if (!pendingReq) return false;

    const userDisplayName = from?.first_name || from?.username || 'Administrador';

    if (isAffirmative) {
        await approveReopenRequest({
            requestId: pendingReq.id,
            resolvedBy: `${userDisplayName} (Telegram)`,
            chatId
        });
        return true;
    } else if (isNegative) {
        await rejectReopenRequest({
            requestId: pendingReq.id,
            resolvedBy: `${userDisplayName} (Telegram)`,
            chatId
        });
        return true;
    }

    return false;
}

module.exports = {
    handleTelegramCallback,
    handleTelegramTextApproval
};
