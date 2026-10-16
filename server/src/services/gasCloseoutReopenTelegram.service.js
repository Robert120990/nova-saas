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
            'SELECT company_id, branch_id, can_approve_entries, receive_reopen_requests FROM telegram_chat_bindings WHERE chat_id = ?',
            [chatId]
        );
        if (bindings.length === 0) {
            await telegramService.sendMessage(chatId, '⛔ Tu cuenta de Telegram no está vinculada al sistema.').catch(() => {});
            return;
        }
        const hasApprovePermission = bindings.some(b => b.can_approve_entries || b.receive_reopen_requests);
        if (!hasApprovePermission) {
            await telegramService.sendMessage(chatId, '⛔ No tienes permiso para aprobar o rechazar reaperturas de turnos.').catch(() => {});
            return;
        }

        // 3. Aislamiento multi-empresa y sucursal estricto
        const reqRow = reopenReq;
        const authorizedBinding = bindings.find(b =>
            (b.can_approve_entries || b.receive_reopen_requests) &&
            (b.company_id === null || Number(b.company_id) === Number(reqRow.company_id)) &&
            (b.branch_id === null || Number(b.branch_id) === Number(reqRow.branch_id))
        );
        if (!authorizedBinding) {
            const sameCompany = bindings.some(b =>
                (b.can_approve_entries || b.receive_reopen_requests) &&
                (b.company_id === null || Number(b.company_id) === Number(reqRow.company_id))
            );
            const errorMsg = sameCompany
                ? '⛔ Esta solicitud pertenece a otra sucursal.'
                : '⛔ No tienes autorización para gestionar solicitudes de otra empresa.';
            await telegramService.sendMessage(chatId, errorMsg).catch(() => {});
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
        'SELECT company_id, branch_id, can_approve_entries, receive_reopen_requests FROM telegram_chat_bindings WHERE chat_id = ?',
        [chatId]
    );
    if (bindings.length === 0) return false;

    let authorizedBinding = null;
    for (const b of bindings) {
        if (b.can_approve_entries || b.receive_reopen_requests) {
            authorizedBinding = b;
            break;
        }
    }
    if (!authorizedBinding) {
        return false;
    }

    const companyId = authorizedBinding.company_id || state?.companyId;
    const branchId = authorizedBinding.branch_id || state?.branchId;
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
