const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const telegramService = require('./telegram.service');

async function getTechChatsForTicket(companyId, branchId) {
    const [settingsRows] = await pool.query('SELECT support_tickets_active FROM telegram_settings WHERE id = 1');
    const active = settingsRows.length > 0 ? (settingsRows[0].support_tickets_active !== 0) : true;
    if (!active) return [];

    // Solo chats con permiso explícito receive_support_tickets = 1:
    // - Chats globales de soporte (company_id IS NULL), o
    // - Chats de la misma empresa y sucursal (o globales de esa empresa)
    const [chats] = await pool.query(
        `SELECT DISTINCT chat_id, nombre, username, company_id, branch_id
         FROM telegram_chat_bindings
         WHERE receive_support_tickets = 1
           AND (
               company_id IS NULL
               OR (company_id = ? AND (branch_id = ? OR branch_id IS NULL))
           )`,
        [companyId || null, branchId || null]
    );
    return chats || [];
}

/**
 * Verificación fail-closed contra BD para callbacks y comandos de soporte / AGY.
 * - Exige chat vinculado en telegram_chat_bindings con receive_support_tickets = 1.
 * - Para acciones AGY (planificar/ejecutar/cambiar modelo), exige además vinculación global (company_id IS NULL).
 * - Para tickets de empresa específica, valida aislamiento multi-tenant.
 */
async function verifyTelegramSupportAccess(chatId, { requireGlobalAgy = false, ticketCompanyId = null } = {}) {
    if (!chatId) return { allowed: false, reason: '⛔ Chat no identificado.' };
    try {
        const [rows] = await pool.query(
            `SELECT id, chat_id, company_id, branch_id, nombre, username, receive_support_tickets, can_approve_entries
             FROM telegram_chat_bindings
             WHERE chat_id = ?
             LIMIT 1`,
            [String(chatId)]
        );
        if (!rows || rows.length === 0) {
            return { allowed: false, reason: '⛔ Tu chat de Telegram no está vinculado ni autorizado.' };
        }
        const binding = rows[0];
        if (Number(binding.receive_support_tickets) !== 1) {
            return { allowed: false, reason: '⛔ No tienes permisos habilitados para gestionar tickets de soporte.' };
        }
        const isGlobalTech = binding.company_id === null || binding.company_id === undefined;
        if (requireGlobalAgy && !isGlobalTech) {
            return { allowed: false, reason: '⛔ Solo administradores globales de soporte pueden operar Consola AGY.' };
        }
        if (ticketCompanyId && !isGlobalTech && Number(binding.company_id) !== Number(ticketCompanyId)) {
            return { allowed: false, reason: '⛔ No tienes acceso a tickets de otra empresa.' };
        }
        return { allowed: true, binding, isGlobalTech };
    } catch {
        return { allowed: false, reason: '⛔ No fue posible verificar tus permisos de soporte.' };
    }
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
    if (!token || !filePath) return null;

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
    return data.result;
}

module.exports = {
    getTechChatsForTicket,
    verifyTelegramSupportAccess,
    resolveLocalUploadPath,
    sendLocalPhotoToTelegram
};
