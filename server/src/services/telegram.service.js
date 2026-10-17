const pool = require('../config/db');

/**
 * Telegram Bot Service — long polling
 *
 * Un solo bot para todo el sistema (token en TELEGRAM_BOT_TOKEN).
 * Flujo: /start → elige empresa → elige sucursal → chat multi-agente con Novas AI.
 * Comandos: /ayuda, /cambiar, /alertas on|off, /agentes
 */

let memoryBotToken = process.env.TELEGRAM_BOT_TOKEN || null;
const MAX_MESSAGE_LENGTH = 4000;
const LONG_POLL_TIMEOUT = 25; // segundos

let lastUpdateId = 0;
let botRunning = false;
let botInfoCache = null;
let pollIntervalId = null;
const chatStates = new Map(); // chat_id -> { step, companyId, branchId, companies, branches, ... }

let isBotActive = true;
let lastActiveCheck = 0;

async function checkIsActive() {
    if (process.env.NODE_ENV !== 'production' && process.env.TELEGRAM_DEV_POLLING === 'true') {
        return true;
    }
    const now = Date.now();
    if (now - lastActiveCheck < 10000) return isBotActive;
    lastActiveCheck = now;
    try {
        const [rows] = await pool.query('SELECT is_active, bot_token FROM telegram_settings ORDER BY id DESC LIMIT 1');
        if (rows.length > 0) {
            isBotActive = rows[0].is_active === 1;
            if (rows[0].bot_token) memoryBotToken = rows[0].bot_token;
        }
    } catch {
        // Table might not exist yet
    }
    return isBotActive;
}

async function getBotToken() {
    if (memoryBotToken) return memoryBotToken;
    try {
        const [rows] = await pool.query('SELECT bot_token FROM telegram_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
        if (rows.length > 0 && rows[0].bot_token) {
            memoryBotToken = rows[0].bot_token;
            return memoryBotToken;
        }
    } catch {
        // Table might not exist yet during migration
    }
    return null;
}

function getApiBase(token) {
    const t = token || memoryBotToken || process.env.TELEGRAM_BOT_TOKEN;
    return t ? `https://api.telegram.org/bot${t}` : null;
}

async function apiCall(method, payload = {}, timeoutMs = 35000) {
    const token = await getBotToken();
    const base = getApiBase(token);
    if (!base) throw new Error('Telegram bot token not configured');

    const res = await fetch(`${base}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
    });
    const data = await res.json();
    if (!data.ok) {
        const desc = data.description || `HTTP ${res.status}`;
        throw new Error(`Telegram API ${method}: ${desc}`);
    }
    return data.result;
}

function splitText(text, max = MAX_MESSAGE_LENGTH) {
    if (!text) return [];
    const chunks = [];
    let rest = text;
    while (rest.length > max) {
        let cut = rest.lastIndexOf('\n', max);
        if (cut <= 0) cut = max;
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).replace(/^\n/, '');
    }
    chunks.push(rest);
    return chunks;
}

async function sendMessage(chatId, text, extra = {}) {
    const token = await getBotToken();
    if (!token || !text) return null;
    const results = [];
    for (const chunk of splitText(text)) {
        const result = await apiCall('sendMessage', { chat_id: chatId, text: chunk, ...extra });
        results.push(result);
    }
    return results;
}

async function getMe(force = false) {
    const token = await getBotToken();
    if (!token) return null;
    if (botInfoCache && !force) return botInfoCache;
    try {
        botInfoCache = await apiCall('getMe', {}, 15000);
    } catch (error) {
        console.error('[Telegram] getMe falló:', error.message);
        botInfoCache = null;
    }
    return botInfoCache;
}

// ============ Flujo por chat ============

async function handleStart(chatId, from, text = '') {
    const { handleStartInvite } = require('./telegramInvite.service');
    const inviteDone = await handleStartInvite(chatId, from, text, { sendMessage, chatStates });
    if (inviteDone) return;
    const [rows] = await pool.query('SELECT * FROM telegram_chat_bindings WHERE chat_id = ?', [chatId]);
    if (rows.length > 0) {
        chatStates.set(chatId, { step: 'ready', companyId: rows[0].company_id, branchId: rows[0].branch_id });
        const [branch] = rows[0].branch_id
            ? await pool.query('SELECT nombre FROM branches WHERE id = ?', [rows[0].branch_id])
            : [[{ nombre: 'Todas las sucursales (Acceso Global)' }]];
        const branchName = branch[0]?.nombre || 'Todas las sucursales (Acceso Global)';
        const [company] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [rows[0].company_id]);
        const companyName = company[0]?.razon_social || '';
        return sendMessage(chatId,
            `✅ Ya estás conectado a **${branchName}** (${companyName}).\n\n` +
            `Puedes preguntarme cosas como:\n- "dime las ventas de ayer"\n- "nivel de tanques"\n- "clientes con saldo"\n\n` +
            `Comandos:\n/agentes · /contador · /fiscal · /ventas · /ayuda`);
    }

    // Acceso restringido por seguridad: No permitir auto-vinculación anónima
    return sendMessage(chatId,
        `🔒 *Acceso Restringido — SIPE WEB*\n\n` +
        `Este bot es de uso exclusivo para empresas y sucursales autorizadas.\n\n` +
        `*Para conectar tu cuenta:*\n` +
        `1. Inicia sesión en la plataforma SIPE WEB.\n` +
        `2. Ve a Notificaciones > Conexión Telegram.\n` +
        `3. Solicita a un Administrador un *Enlace de Invitación* oficial para tu empresa/sucursal.\n\n` +
        `_Los enlaces de invitación son personales, seguros y de un solo uso._`,
        { parse_mode: 'Markdown' }
    );
}

async function handleHelp(chatId) {
    return sendMessage(chatId,
        `🤖 *Novas AI — Red Multi-Agente*\n\n` +
        `*Agentes especializados:*\n` +
        `• /agentes — Ver todos los agentes disponibles\n` +
        `• /contador — Agente Contador CPA (generar partidas de ventas/compras o ajustes)\n` +
        `• /fiscal — Agente Fiscal & DTE (normativa MH, contingencias, rechazos)\n` +
        `• /ventas — Agente Comercial (ventas, ticket promedio, clientes)\n` +
        `• /tanques — Agente de Combustibles (niveles de tanques y cierres)\n` +
        `• /inventario — Agente de Inventario & Kardex\n\n` +
        `*Comandos del sistema:*\n` +
        `/start — Ver conexión actual\n` +
        `/cambiar — Cambiar empresa o sucursal\n` +
        `/alertas on|off — Activar o silenciar alertas\n` +
        `/ayuda — Este mensaje\n\n` +
        `_También puedes escribir consultas libres y el Supervisor las delegará automáticamente._`);
}

async function handleCambiar(chatId) {
    return sendMessage(chatId,
        `🔒 *Aislamiento de Seguridad Multi-Empresa*\n\n` +
        `Por seguridad y protección de datos confidenciales, la vinculación a una empresa o sucursal requiere autorización previa.\n\n` +
        `Para conectarte a otra empresa o sucursal, solicita un nuevo enlace de invitación desde la plataforma web SIPE WEB.`,
        { parse_mode: 'Markdown' }
    );
}

async function handleAlertas(chatId, arg) {
    const on = /^on|1|si|activar|recibir$/i.test((arg || '').trim());
    const off = /^off|0|no|desactivar|quitar$/i.test((arg || '').trim());
    const [rows] = await pool.query('SELECT id FROM telegram_chat_bindings WHERE chat_id = ?', [chatId]);
    if (rows.length === 0) return sendMessage(chatId, 'Primero conéctate con un enlace de invitación oficial para poder recibir alertas.');
    if (!on && !off) return sendMessage(chatId, 'Uso: /alertas on  o  /alertas off');
    const value = on ? 1 : 0;
    await pool.query('UPDATE telegram_chat_bindings SET receive_alerts = ? WHERE id = ?', [value, rows[0].id]);
    return sendMessage(chatId, value ? '🔔 Recibirás las alertas de tu sucursal aquí.' : '🔕 Alertas desactivadas.');
}

async function handleAIQuestion(chatId, text, state, from = {}) {
    const { handleAgentTelegramMessage } = require('./telegramAgentBridge.service');
    return handleAgentTelegramMessage(chatId, text, from, state);
}

async function handleMessage(chatId, text, from) {
    const trimmed = (text || '').trim();

    // /start primero para permitir vinculación con enlaces de invitación (/start bind_<token>)
    if (trimmed.startsWith('/start')) return handleStart(chatId, from, trimmed);

    // Validar que el chat esté vinculado en BD antes de ejecutar cualquier otro comando o consulta
    const [bindings] = await pool.query(
        'SELECT company_id, branch_id, receive_alerts, can_approve_entries, allowed_agents FROM telegram_chat_bindings WHERE chat_id = ? LIMIT 1',
        [chatId]
    );
    if (bindings.length === 0) {
        chatStates.delete(chatId);
        return sendMessage(chatId,
            `🔒 *Acceso Restringido — SIPE WEB*\n\n` +
            `Este bot es de uso exclusivo para empresas y sucursales autorizadas.\n\n` +
            `*Para conectar tu cuenta:*\n` +
            `1. Inicia sesión en la plataforma SIPE WEB.\n` +
            `2. Ve a Notificaciones > Conexión Telegram.\n` +
            `3. Solicita a un Administrador un *Enlace de Invitación* oficial para tu empresa/sucursal.\n\n` +
            `_Los enlaces de invitación son personales, seguros y de un solo uso._`,
            { parse_mode: 'Markdown' }
        );
    }

    const state = {
        step: 'ready',
        companyId: bindings[0].company_id,
        branchId: bindings[0].branch_id,
        receiveAlerts: bindings[0].receive_alerts,
        canApproveEntries: bindings[0].can_approve_entries,
        allowedAgents: bindings[0].allowed_agents
    };
    chatStates.set(chatId, state);

    // Comandos para chats vinculados
    if (trimmed.startsWith('/ayuda') || trimmed.startsWith('/help')) return handleHelp(chatId);
    if (trimmed.startsWith('/agentes')) {
        const { handleAgentTelegramCommand } = require('./telegramAgentBridge.service');
        return handleAgentTelegramCommand(chatId, trimmed);
    }
    if (trimmed.startsWith('/cambiar')) return handleCambiar(chatId);
    if (trimmed.startsWith('/alertas')) {
        const arg = trimmed.replace(/^\/alertas\s*/i, '');
        return handleAlertas(chatId, arg);
    }

    // Interceptar gestión de tickets de soporte (/tickets, /resolver, notas interactivas)
    try {
        const { handleTicketTelegramText } = require('./ticketTelegram.service');
        const handledTicket = await handleTicketTelegramText(chatId, trimmed, from);
        if (handledTicket) return;
    } catch (err) {
        console.error('[Telegram] Error en ticket text handler:', err.message);
    }

    // Interceptar aprobaciones o rechazos de reapertura de turnos por texto
    try {
        const { handleTelegramTextApproval } = require('./gasCloseoutReopenTelegram.service');
        const handled = await handleTelegramTextApproval(chatId, trimmed, from, state);
        if (handled) return;
    } catch (err) {
        console.error('[Telegram] Error en text approval:', err.message);
    }

    // Chat libre con Novas AI
    return handleAIQuestion(chatId, trimmed, state, from);
}

// ============ Long polling ============

async function pollOnce() {
    const active = await checkIsActive();
    if (!active) return;
    const token = await getBotToken();
    if (!token || botRunning) return;
    botRunning = true;
    try {
        const updates = await apiCall('getUpdates', {
            offset: lastUpdateId + 1,
            timeout: LONG_POLL_TIMEOUT,
            allowed_updates: ['message', 'callback_query']
        }, (LONG_POLL_TIMEOUT + 10) * 1000);

        for (const upd of updates || []) {
            lastUpdateId = Math.max(lastUpdateId, upd.update_id);
            if (upd.callback_query) {
                const { routeTelegramCallback } = require('./telegramInvite.service');
                routeTelegramCallback(upd.callback_query, { apiCall, sendMessage, chatStates }).catch(err =>
                    console.error('[Telegram] Error en callback_query:', err.message)
                );
            } else if (upd.message && upd.message.text) {
                handleMessage(upd.message.chat.id, upd.message.text, upd.message.from || {}).catch(err =>
                    console.error('[Telegram] Error manejando mensaje:', err.message)
                );
            }
        }
    } catch (error) {
        if (!/Timeout/i.test(error.message)) {
            console.error('[Telegram] getUpdates error:', error.message);
        }
    } finally {
        botRunning = false;
    }
}

async function startBot() {
    // Si no estamos en producción y no se forzó el polling local, desactivar para no colisionar con el servidor VPS
    if (process.env.NODE_ENV !== 'production' && process.env.TELEGRAM_DEV_POLLING !== 'true') {
        console.log('[Telegram] Polling desactivado en entorno local para evitar colisión con el servidor VPS (usar TELEGRAM_DEV_POLLING=true en .env si se desea probar en local).');
        return;
    }
    const token = await getBotToken();
    if (!token) {
        console.warn('[Telegram] TELEGRAM_BOT_TOKEN no configurado — bot desactivado.');
        return;
    }
    const active = await checkIsActive();
    if (!active) {
        console.log('[Telegram] Bot en espera: is_active = 0 en telegram_settings.');
    }
    console.log('[Telegram] Bot iniciado (long polling).');
    await getMe(true);
    if (!pollIntervalId) {
        pollIntervalId = setInterval(pollOnce, 1000);
    }
    pollOnce();
}

async function setBotToken(newToken) {
    memoryBotToken = newToken;
    botInfoCache = null;
    lastUpdateId = 0;
    if (newToken) {
        await startBot();
    }
}

module.exports = {
    sendMessage,
    apiCall,
    getMe,
    startBot,
    pollOnce,
    splitText,
    getBotToken,
    setBotToken
};
