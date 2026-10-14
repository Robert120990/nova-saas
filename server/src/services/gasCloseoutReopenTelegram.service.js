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

    if (data.startsWith('reopen_approve:')) {
        const requestId = parseInt(data.replace('reopen_approve:', ''), 10);
        if (isNaN(requestId)) return;
        const res = await approveReopenRequest({
            requestId,
            resolvedBy: `${userDisplayName} (Telegram)`,
            chatId,
            messageId
        });
        if (!res.success && res.alreadyResolved) {
            await telegramService.sendMessage(chatId, `ℹ️ ${res.message}`).catch(() => {});
        }
    } else if (data.startsWith('reopen_reject:')) {
        const requestId = parseInt(data.replace('reopen_reject:', ''), 10);
        if (isNaN(requestId)) return;
        const res = await rejectReopenRequest({
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

    let companyId = state?.companyId;
    let branchId = state?.branchId;

    if (!companyId) {
        const [rows] = await pool.query(
            'SELECT company_id, branch_id FROM telegram_chat_bindings WHERE chat_id = ? LIMIT 1',
            [chatId]
        );
        if (rows.length > 0) {
            companyId = rows[0].company_id;
            branchId = rows[0].branch_id;
        }
    }

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
