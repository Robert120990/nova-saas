const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Servicio para gestión de invitaciones Deep Linking de Telegram
 */

async function createInviteToken({
    companyId,
    branchId = null,
    assignedName = null,
    permissions = null,
    createdBy = null,
    expiresInHours = 48
}) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    const defaultPermissions = {
        allowed_agents: ['accounting', 'dte', 'sales', 'inventory', 'gas', 'operations'],
        can_approve_entries: 0,
        receive_reopen_requests: 1,
        receive_inventory_alerts: 1,
        receive_dte_alerts: 1,
        ...permissions
    };

    await pool.query(`
        INSERT INTO telegram_invite_tokens 
        (token, company_id, branch_id, assigned_name, permissions_template, created_by, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        token,
        companyId,
        branchId ? parseInt(branchId, 10) : null,
        assignedName ? assignedName.trim() : null,
        JSON.stringify(defaultPermissions),
        createdBy,
        expiresAt
    ]);

    return {
        token,
        expiresAt,
        permissions: defaultPermissions
    };
}

async function resolveInviteToken(tokenStr, chatId, from = {}) {
    if (!tokenStr) return null;
    const cleanToken = tokenStr.trim();

    const [rows] = await pool.query(`
        SELECT t.*, c.razon_social as company_name, b.nombre as branch_name
        FROM telegram_invite_tokens t
        LEFT JOIN companies c ON c.id = t.company_id
        LEFT JOIN branches b ON b.id = t.branch_id
        WHERE t.token = ? AND t.used_at IS NULL AND t.expires_at > NOW()
        LIMIT 1
    `, [cleanToken]);

    if (rows.length === 0) {
        return { valid: false, reason: 'Enlace expirado o ya utilizado' };
    }

    const invite = rows[0];
    let permissions = {};
    try {
        permissions = typeof invite.permissions_template === 'string'
            ? JSON.parse(invite.permissions_template)
            : (invite.permissions_template || {});
    } catch {
        permissions = {};
    }

    const allowedAgents = permissions.allowed_agents || ['accounting', 'dte', 'sales', 'inventory', 'gas', 'operations'];
    const canApproveEntries = permissions.can_approve_entries ? 1 : 0;
    const receiveReopen = permissions.receive_reopen_requests !== undefined ? (permissions.receive_reopen_requests ? 1 : 0) : 1;
    const receiveInventory = permissions.receive_inventory_alerts !== undefined ? (permissions.receive_inventory_alerts ? 1 : 0) : 1;
    const receiveDte = permissions.receive_dte_alerts !== undefined ? (permissions.receive_dte_alerts ? 1 : 0) : 1;

    const nombre = invite.assigned_name || from.first_name || from.username || 'Usuario';
    const username = from.username || null;

    // Upsert into bindings
    await pool.query(`
        INSERT INTO telegram_chat_bindings 
        (chat_id, company_id, branch_id, nombre, username, receive_alerts, receive_reopen_requests, allowed_agents, can_approve_entries, receive_inventory_alerts, receive_dte_alerts)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            company_id = VALUES(company_id),
            branch_id = VALUES(branch_id),
            nombre = VALUES(nombre),
            username = VALUES(username),
            receive_alerts = 1,
            receive_reopen_requests = VALUES(receive_reopen_requests),
            allowed_agents = VALUES(allowed_agents),
            can_approve_entries = VALUES(can_approve_entries),
            receive_inventory_alerts = VALUES(receive_inventory_alerts),
            receive_dte_alerts = VALUES(receive_dte_alerts)
    `, [
        chatId,
        invite.company_id,
        invite.branch_id,
        nombre,
        username,
        receiveReopen,
        JSON.stringify(allowedAgents),
        canApproveEntries,
        receiveInventory,
        receiveDte
    ]);

    // Mark token as consumed
    await pool.query(`
        UPDATE telegram_invite_tokens 
        SET used_at = NOW(), used_by_chat_id = ?
        WHERE id = ?
    `, [chatId, invite.id]);

    return {
        valid: true,
        companyId: invite.company_id,
        companyName: invite.company_name,
        branchId: invite.branch_id,
        branchName: invite.branch_name || 'Acceso Global (Todas las sucursales)',
        assignedName: nombre
    };
}

async function listPendingInvites(companyId, isSuperAdmin = false) {
    const [rows] = await pool.query(`
        SELECT t.id, t.token, t.company_id, t.branch_id, t.assigned_name,
               t.permissions_template, t.expires_at, t.created_at,
               c.razon_social as company_name, b.nombre as branch_name,
               u.name as created_by_name
        FROM telegram_invite_tokens t
        LEFT JOIN companies c ON c.id = t.company_id
        LEFT JOIN branches b ON b.id = t.branch_id
        LEFT JOIN users u ON u.id = t.created_by
        WHERE t.used_at IS NULL AND t.expires_at > NOW()
        ${isSuperAdmin ? '' : 'AND t.company_id = ?'}
        ORDER BY t.created_at DESC
        LIMIT 20
    `, isSuperAdmin ? [] : [companyId]);

    return rows;
}

async function handleBindingCallback(callbackQuery, { apiCall, sendMessage, chatStates }) {
    const data = callbackQuery?.data || '';
    const chatId = callbackQuery?.message?.chat?.id;
    const from = callbackQuery?.from || {};

    if (!data.startsWith('bind_co:') && !data.startsWith('bind_br:')) {
        return false;
    }

    try {
        await apiCall('answerCallbackQuery', { callback_query_id: callbackQuery.id });
    } catch {
        // Ignore answerCallbackQuery error
    }

    if (data.startsWith('bind_co:')) {
        const companyId = parseInt(data.replace('bind_co:', ''), 10);
        const [companies] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [companyId]);
        const companyName = companies[0]?.razon_social || 'Empresa';

        const [branches] = await pool.query('SELECT id, nombre FROM branches WHERE company_id = ? ORDER BY nombre', [companyId]);
        if (branches.length === 0) {
            await sendMessage(chatId, `⚠️ ${companyName} no tiene sucursales registradas.`);
            return true;
        }

        const buttons = [];
        buttons.push([{ text: '🌐 Todas las sucursales (Global)', callback_data: `bind_br:${companyId}:all` }]);
        branches.forEach(b => {
            buttons.push([{ text: `📍 ${b.nombre}`, callback_data: `bind_br:${companyId}:${b.id}` }]);
        });

        await sendMessage(chatId, `🏢 *${companyName}*\n\nSelecciona a qué sucursal deseas conectarte:`, {
            reply_markup: { inline_keyboard: buttons }
        });
        return true;
    }

    if (data.startsWith('bind_br:')) {
        const parts = data.replace('bind_br:', '').split(':');
        const companyId = parseInt(parts[0], 10);
        const branchIdStr = parts[1];
        const branchId = branchIdStr === 'all' ? null : parseInt(branchIdStr, 10);

        const [companies] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [companyId]);
        const companyName = companies[0]?.razon_social || '';
        let branchName = 'Todas las sucursales (Acceso Global)';
        if (branchId) {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
            branchName = bRows[0]?.nombre || 'Sucursal';
        }

        const nombre = from.first_name || from.username || 'Usuario';
        await pool.query(`
            INSERT INTO telegram_chat_bindings (chat_id, company_id, branch_id, nombre, username, receive_alerts)
            VALUES (?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                company_id = VALUES(company_id),
                branch_id = VALUES(branch_id),
                nombre = VALUES(nombre),
                username = VALUES(username),
                receive_alerts = 1
        `, [chatId, companyId, branchId, nombre, from.username || null]);

        if (chatStates) {
            chatStates.set(chatId, { step: 'ready', companyId, branchId });
        }

        await sendMessage(chatId,
            `🎉 *¡Conectado exitosamente!*\n\n` +
            `🏢 Empresa: *${companyName}*\n` +
            `📍 Sucursal: *${branchName}*\n\n` +
            `Ya puedes interactuar con los agentes con comandos como /agentes, /contador, /fiscal, o escribir directamente tus dudas.`);
        return true;
    }

    return false;
}

async function handleStartInvite(chatId, from, fullText, { sendMessage, chatStates }) {
    const parts = (fullText || '').trim().split(/\s+/);
    if (parts[1] && parts[1].startsWith('bind_')) {
        const token = parts[1].replace('bind_', '').trim();
        const res = await resolveInviteToken(token, chatId, from);
        if (res && res.valid) {
            if (chatStates) {
                chatStates.set(chatId, { step: 'ready', companyId: res.companyId, branchId: res.branchId });
            }
            await sendMessage(chatId,
                `🎉 *¡Vinculación Exitosa con Novas!*\n\n` +
                `Te has conectado como *${res.assignedName}* a:\n` +
                `🏢 Empresa: *${res.companyName}*\n` +
                `📍 Sucursal: *${res.branchName}*\n\n` +
                `Comandos disponibles:\n/agentes · /contador · /fiscal · /ventas · /ayuda`);
            return true;
        } else {
            await sendMessage(chatId, `⚠️ ${res?.reason || 'Invitación expirada o inválida'}.`);
            return false;
        }
    }
    return false;
}

async function routeTelegramCallback(query, { apiCall, sendMessage, chatStates }) {
    const handledBinding = await handleBindingCallback(query, { apiCall, sendMessage, chatStates });
    if (handledBinding) return;
    const { handleAgentTelegramCallback } = require('./telegramAgentBridge.service');
    const handledAgent = await handleAgentTelegramCallback(query);
    if (!handledAgent) {
        const { handleTelegramCallback } = require('./gasCloseoutReopenTelegram.service');
        await handleTelegramCallback(query);
    }
}

module.exports = {
    createInviteToken,
    resolveInviteToken,
    listPendingInvites,
    handleBindingCallback,
    handleStartInvite,
    routeTelegramCallback
};


