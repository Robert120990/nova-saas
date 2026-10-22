const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const telegramService = require('./telegram.service');

async function getTechChatsForTicket(companyId, branchId) {
    const [settingsRows] = await pool.query('SELECT support_tickets_active FROM telegram_settings WHERE id = 1');
    const active = settingsRows.length > 0 ? (settingsRows[0].support_tickets_active !== 0) : true;
    if (!active) return [];

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
    resolveLocalUploadPath,
    sendLocalPhotoToTelegram
};
