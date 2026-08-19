const pool = require('../config/db');
const { runAssistant } = require('./ai.assistant');

/**
 * Telegram Bot Service — long polling
 *
 * Un solo bot para todo el sistema (token en TELEGRAM_BOT_TOKEN).
 * Flujo: /start → elige empresa → elige sucursal → chat libre con Novas AI.
 * Comandos: /ayuda, /cambiar, /alertas on|off
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;
const MAX_MESSAGE_LENGTH = 4000;
const LONG_POLL_TIMEOUT = 25; // segundos

let lastUpdateId = 0;
let botRunning = false;
let botInfoCache = null;
const chatStates = new Map(); // chat_id -> { step, companyId, branchId, companies, branches, ... }

async function apiCall(method, payload = {}, timeoutMs = 35000) {
    const res = await fetch(`${API_BASE}/${method}`, {
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
    if (!API_BASE || !text) return null;
    const results = [];
    for (const chunk of splitText(text)) {
        const result = await apiCall('sendMessage', { chat_id: chatId, text: chunk, ...extra });
        results.push(result);
    }
    return results;
}

async function getMe(force = false) {
    if (!API_BASE) return null;
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

async function listCompanies(chatId) {
    const [companies] = await pool.query(
        'SELECT id, razon_social FROM companies ORDER BY razon_social'
    );
    if (companies.length === 0) {
        return sendMessage(chatId, '⚠️ No hay empresas registradas en el sistema todavía.');
    }
    chatStates.set(chatId, { step: 'awaiting_company', companies });
    const list = companies.map((c, i) => `${i + 1}. ${c.razon_social}`).join('\n');
    return sendMessage(chatId, `👋 ¡Hola! Bienvenido al bot de Novas.\n\nPara conectarte, dime a qué empresa perteneces (envía el número):\n\n${list}\n\nEn cualquier momento: /ayuda`);
}

async function handleStart(chatId, from) {
    const [rows] = await pool.query('SELECT * FROM telegram_chat_bindings WHERE chat_id = ?', [chatId]);
    if (rows.length > 0) {
        chatStates.set(chatId, { step: 'ready', companyId: rows[0].company_id, branchId: rows[0].branch_id });
        const [company] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [rows[0].company_id]);
        const [branch] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [rows[0].branch_id]);
        return sendMessage(chatId,
            `✅ Ya estás conectado a **${branch[0]?.nombre || rows[0].branch_id}** (${company[0]?.razon_social || ''}).\n\n` +
            `Puedes preguntarme cosas como:\n- "dime las ventas de ayer"\n- "nivel de tanques"\n- "clientes con saldo"\n\n` +
            `Comandos:\n/ayuda · /cambiar · /alertas on|off`);
    }
    return listCompanies(chatId);
}

async function handleHelp(chatId) {
    return sendMessage(chatId,
        `🤖 *Novas AI Bot*\n\n` +
        `*Preguntas libres:*\n"dime las ventas de ayer", "nivel de tanques", "clientes que me deben", "ventas por producto este mes"...\n\n` +
        `*Comandos:*\n` +
        `/start — ver mi conexión actual\n` +
        `/cambiar — cambiar empresa/sucursal\n` +
        `/alertas on — recibir alertas aquí\n` +
        `/alertas off — dejar de recibir alertas\n` +
        `/ayuda — este mensaje\n\n` +
        `Solo respondo consultas de lectura sobre tu empresa y sucursal.`);
}

async function handleCambiar(chatId) {
    return listCompanies(chatId);
}

async function handleAlertas(chatId, arg) {
    const on = /^on|1|si|activar|recibir$/i.test((arg || '').trim());
    const off = /^off|0|no|desactivar|quitar$/i.test((arg || '').trim());
    const [rows] = await pool.query('SELECT id FROM telegram_chat_bindings WHERE chat_id = ?', [chatId]);
    if (rows.length === 0) {
        return sendMessage(chatId, 'Primero conéctate con /start para poder recibir alertas.');
    }
    let value;
    if (on) value = 1;
    else if (off) value = 0;
    else return sendMessage(chatId, 'Uso: /alertas on  o  /alertas off');
    await pool.query('UPDATE telegram_chat_bindings SET receive_alerts = ? WHERE id = ?', [value, rows[0].id]);
    return sendMessage(chatId, value ? '🔔 Recibirás las alertas de tu sucursal aquí.' : '🔕 Alertas desactivadas.');
}

async function handleAIQuestion(chatId, text, state) {
    await apiCall('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => { });
    try {
        const reply = await runAssistant({
            messages: [{ role: 'user', content: text }],
            companyId: state.companyId,
            branchId: state.branchId
        });
        const content = typeof reply === 'string' ? reply : (reply?.content || '');
        return sendMessage(chatId, content || '⚠️ No obtuve una respuesta. Intenta reformular tu pregunta.');
    } catch (error) {
        console.error('[Telegram AI] Error:', error.message);
        return sendMessage(chatId, `⚠️ Error procesando tu consulta: ${error.message}`);
    }
}

async function handleMessage(chatId, text, from) {
    const trimmed = (text || '').trim();
    const state = chatStates.get(chatId);
    const firstName = from?.first_name || from?.username || '';

    // Comandos
    if (trimmed.startsWith('/start')) return handleStart(chatId, from);
    if (trimmed.startsWith('/ayuda') || trimmed.startsWith('/help')) return handleHelp(chatId);
    if (trimmed.startsWith('/cambiar')) return handleCambiar(chatId);
    if (trimmed.startsWith('/alertas')) {
        const arg = trimmed.replace(/^\/alertas\s*/i, '');
        return handleAlertas(chatId, arg);
    }

    // Máquina de estados de vinculación
    if (state?.step === 'awaiting_company') {
        const idx = parseInt(trimmed, 10) - 1;
        if (isNaN(idx) || !state.companies[idx]) {
            return sendMessage(chatId, 'Envía el número de una empresa de la lista.');
        }
        const company = state.companies[idx];
        const [branches] = await pool.query(
            'SELECT id, nombre FROM branches WHERE company_id = ? ORDER BY nombre',
            [company.id]
        );
        if (branches.length === 0) {
            return sendMessage(chatId, `⚠️ ${company.razon_social} no tiene sucursales registradas. Elige otra empresa con /cambiar.`);
        }
        chatStates.set(chatId, { step: 'awaiting_branch', companyId: company.id, companyName: company.razon_social, branches });
        const list = branches.map((b, i) => `${i + 1}. ${b.nombre}`).join('\n');
        return sendMessage(chatId, `¿A qué sucursal de *${company.razon_social}* perteneces? (envía el número)\n\n${list}`);
    }

    if (state?.step === 'awaiting_branch') {
        const idx = parseInt(trimmed, 10) - 1;
        if (isNaN(idx) || !state.branches[idx]) {
            return sendMessage(chatId, 'Envía el número de una sucursal de la lista.');
        }
        const branch = state.branches[idx];
        await pool.query(
            `INSERT INTO telegram_chat_bindings (chat_id, company_id, branch_id, nombre, username)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE company_id = VALUES(company_id), branch_id = VALUES(branch_id),
                 nombre = VALUES(nombre), username = VALUES(username), receive_alerts = 1`,
            [chatId, state.companyId, branch.id, firstName, from?.username || null]
        );
        chatStates.set(chatId, { step: 'ready', companyId: state.companyId, branchId: branch.id });
        return sendMessage(chatId,
            `✅ ¡Conectado! Sucursal: *${branch.nombre}* (${state.companyName}).\n\n` +
            `Ya puedes preguntarme, por ejemplo:\n- "dime las ventas de ayer"\n- "nivel de tanques"\n- "clientes con saldo"\n\n` +
            `También recibirás alertas de tu sucursal aquí. (/alertas off para desactivarlas)`);
    }

    // Chat libre: si ya está vinculado (estado en memoria o en BD)
    if (state?.step === 'ready') {
        return handleAIQuestion(chatId, trimmed, state);
    }

    const [rows] = await pool.query('SELECT * FROM telegram_chat_bindings WHERE chat_id = ?', [chatId]);
    if (rows.length > 0) {
        chatStates.set(chatId, { step: 'ready', companyId: rows[0].company_id, branchId: rows[0].branch_id });
        return handleAIQuestion(chatId, trimmed, chatStates.get(chatId));
    }

    return listCompanies(chatId);
}

// ============ Long polling ============

async function pollOnce() {
    if (!API_BASE || botRunning) return;
    botRunning = true;
    try {
        const updates = await apiCall('getUpdates', {
            offset: lastUpdateId + 1,
            timeout: LONG_POLL_TIMEOUT,
            allowed_updates: ['message']
        }, (LONG_POLL_TIMEOUT + 10) * 1000);

        for (const upd of updates || []) {
            lastUpdateId = Math.max(lastUpdateId, upd.update_id);
            const msg = upd.message;
            if (!msg || !msg.text) continue;
            handleMessage(msg.chat.id, msg.text, msg.from || {}).catch(err =>
                console.error('[Telegram] Error manejando mensaje:', err.message)
            );
        }
    } catch (error) {
        if (!/Timeout/i.test(error.message)) {
            console.error('[Telegram] getUpdates error:', error.message);
        }
    } finally {
        botRunning = false;
    }
}

function startBot() {
    if (!API_BASE) {
        console.warn('[Telegram] TELEGRAM_BOT_TOKEN no configurado — bot desactivado.');
        return;
    }
    console.log('[Telegram] Bot iniciado (long polling).');
    getMe();
    setInterval(pollOnce, 1000);
    pollOnce();
}

module.exports = { sendMessage, getMe, startBot, pollOnce, splitText };
