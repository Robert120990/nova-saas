const pool = require('../config/db');
const telegramService = require('../services/telegram.service');
const telegramDailyBriefingService = require('../services/telegramDailyBriefing.service');
const telegramInviteService = require('../services/telegramInvite.service');

/**
 * Configuración de Telegram, vinculaciones y permisos multi-agente
 */

const getStatus = async (req, res) => {
    try {
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const [bindings] = await pool.query(
            `SELECT b.id, b.chat_id, b.company_id, b.branch_id, b.nombre, b.username, b.receive_alerts,
                    COALESCE(b.receive_reopen_requests, 1) as receive_reopen_requests,
                    b.allowed_agents,
                    COALESCE(b.can_approve_entries, 0) as can_approve_entries,
                    COALESCE(b.receive_inventory_alerts, 1) as receive_inventory_alerts,
                    COALESCE(b.receive_dte_alerts, 1) as receive_dte_alerts,
                    COALESCE(b.receive_support_tickets, 1) as receive_support_tickets,
                    COALESCE(c.razon_social, 'Todas las Empresas') as company_nombre,
                    COALESCE(br.nombre, 'Todas las sucursales (Global)') as branch_nombre
             FROM telegram_chat_bindings b
             LEFT JOIN companies c ON c.id = b.company_id
              LEFT JOIN branches br ON br.id = b.branch_id
              ${isSuperAdmin ? '' : 'WHERE b.company_id = ?'}
              ORDER BY b.created_at DESC`,
            isSuperAdmin ? [] : [req.company_id]
        );
        const token = await telegramService.getBotToken();
        const botInfo = await telegramService.getMe();
        const [settingsRows] = await pool.query('SELECT daily_briefing_active, reopen_requests_active, COALESCE(support_tickets_active, 1) as support_tickets_active FROM telegram_settings WHERE id = 1');
        const dailyBriefingActive = settingsRows.length > 0 ? (settingsRows[0].daily_briefing_active !== 0) : true;
        const reopenRequestsActive = settingsRows.length > 0 ? (settingsRows[0].reopen_requests_active !== 0) : true;
        const supportTicketsActive = settingsRows.length > 0 ? (settingsRows[0].support_tickets_active !== 0) : true;

        res.json({
            configured: !!token,
            maskedToken: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '',
            botInfo,
            bindings,
            dailyBriefingActive,
            reopenRequestsActive,
            supportTicketsActive
        });
    } catch (error) {
        console.error('Error getTelegramStatus:', error);
        res.status(500).json({ message: 'Error al obtener estado de Telegram' });
    }
};

const saveBotToken = async (req, res) => {
    try {
        if (req.user?.role !== 'SuperAdmin') {
            return res.status(403).json({ message: 'Solo SuperAdmin puede configurar el token del bot de Telegram' });
        }
        const { token } = req.body;
        if (!token || typeof token !== 'string' || !token.trim()) {
            return res.status(400).json({ message: 'El token del bot es obligatorio' });
        }
        const cleanToken = token.trim();
        await pool.query(`
            INSERT INTO telegram_settings (id, bot_token, is_active)
            VALUES (1, ?, 1)
            ON DUPLICATE KEY UPDATE bot_token = VALUES(bot_token), is_active = 1
        `, [cleanToken]);

        await telegramService.setBotToken(cleanToken);
        const botInfo = await telegramService.getMe(true);

        res.json({ success: true, message: 'Token de Telegram configurado exitosamente', botInfo });
    } catch (error) {
        console.error('Error saveBotToken:', error);
        res.status(500).json({ message: 'Error al guardar token de Telegram: ' + error.message });
    }
};

const updateBinding = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const {
            receive_alerts, receive_reopen_requests, branch_id, company_id,
            allowed_agents, can_approve_entries, receive_inventory_alerts, receive_dte_alerts, receive_support_tickets
        } = req.body;
        const updates = [];
        const params = [];
        if (receive_alerts !== undefined) { updates.push('receive_alerts = ?'); params.push(receive_alerts ? 1 : 0); }
        if (receive_reopen_requests !== undefined) { updates.push('receive_reopen_requests = ?'); params.push(receive_reopen_requests ? 1 : 0); }
        if (branch_id !== undefined) {
            updates.push('branch_id = ?');
            params.push(!branch_id || branch_id === 'all' ? null : parseInt(branch_id, 10));
        }
        if (company_id !== undefined && isSuperAdmin) {
            updates.push('company_id = ?');
            params.push(parseInt(company_id, 10));
        }
        if (allowed_agents !== undefined) { updates.push('allowed_agents = ?'); params.push(JSON.stringify(allowed_agents)); }
        if (can_approve_entries !== undefined) { updates.push('can_approve_entries = ?'); params.push(can_approve_entries ? 1 : 0); }
        if (receive_inventory_alerts !== undefined) { updates.push('receive_inventory_alerts = ?'); params.push(receive_inventory_alerts ? 1 : 0); }
        if (receive_dte_alerts !== undefined) { updates.push('receive_dte_alerts = ?'); params.push(receive_dte_alerts ? 1 : 0); }
        if (receive_support_tickets !== undefined) { updates.push('receive_support_tickets = ?'); params.push(receive_support_tickets ? 1 : 0); }
        if (updates.length === 0) return res.json({ message: 'Sin cambios' });

        let whereClause = 'WHERE id = ?';
        params.push(id);
        if (!isSuperAdmin) {
            whereClause += ' AND company_id = ?';
            params.push(req.company_id);
        }

        const [result] = await pool.query(
            `UPDATE telegram_chat_bindings SET ${updates.join(', ')} ${whereClause}`,
            params
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vinculación no encontrada o no autorizada' });
        }
        res.json({ message: 'Vinculación actualizada' });
    } catch (error) {
        console.error('Error updateBinding:', error);
        res.status(500).json({ message: 'Error al actualizar la vinculación' });
    }
};

const deleteBinding = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const query = isSuperAdmin
            ? 'DELETE FROM telegram_chat_bindings WHERE id = ?'
            : 'DELETE FROM telegram_chat_bindings WHERE id = ? AND company_id = ?';
        const params = isSuperAdmin ? [id] : [id, req.company_id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vinculación no encontrada o no autorizada' });
        }
        res.json({ success: true, message: 'Vinculación eliminada exitosamente' });
    } catch (error) {
        console.error('Error deleteBinding:', error);
        res.status(500).json({ message: 'Error al eliminar vinculación' });
    }
};

const createInviteToken = async (req, res) => {
    try {
        const { branch_id, assigned_name, permissions, expires_in_hours } = req.body;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const companyId = (isSuperAdmin && req.body.company_id) ? req.body.company_id : req.company_id;
        const result = await telegramInviteService.createInviteToken({
            companyId,
            branchId: branch_id,
            assignedName: assigned_name,
            permissions,
            createdBy: req.user?.id,
            expiresInHours: expires_in_hours || 48
        });

        const botInfo = await telegramService.getMe();
        const botUsername = botInfo?.username || 'Sipeweb_bot';
        const deepLink = `https://t.me/${botUsername}?start=bind_${result.token}`;

        res.json({ success: true, token: result.token, deepLink, expiresAt: result.expiresAt });
    } catch (error) {
        console.error('Error createInviteToken:', error);
        res.status(500).json({ message: 'Error al generar enlace de invitación' });
    }
};

const getPendingInvites = async (req, res) => {
    try {
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const rows = await telegramInviteService.listPendingInvites(req.company_id, isSuperAdmin);
        res.json(rows);
    } catch (error) {
        console.error('Error getPendingInvites:', error);
        res.status(500).json({ message: 'Error al obtener invitaciones' });
    }
};

const deletePendingInvite = async (req, res) => {
    try {
        const { id } = req.params;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const query = isSuperAdmin
            ? 'DELETE FROM telegram_invite_tokens WHERE id = ?'
            : 'DELETE FROM telegram_invite_tokens WHERE id = ? AND company_id = ?';
        const params = isSuperAdmin ? [id] : [id, req.company_id];
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Invitación no encontrada o no autorizada' });
        }
        res.json({ success: true, message: 'Invitación eliminada exitosamente' });
    } catch (error) {
        console.error('Error deletePendingInvite:', error);
        res.status(500).json({ message: 'Error al eliminar invitación' });
    }
};

const testConnection = async (req, res) => {
    try {
        const token = await telegramService.getBotToken();
        if (!token) return res.status(400).json({ message: 'El token de Telegram no está configurado en el servidor' });
        const { chat_id } = req.body;
        let targetChat = chat_id;
        const isSuperAdmin = req.user?.role === 'SuperAdmin';

        if (!targetChat) {
            const [rows] = await pool.query(
                'SELECT chat_id FROM telegram_chat_bindings WHERE company_id = ? ORDER BY id DESC LIMIT 1',
                [req.company_id]
            );
            targetChat = rows[0]?.chat_id;
        } else if (!isSuperAdmin) {
            const [rows] = await pool.query(
                'SELECT id FROM telegram_chat_bindings WHERE chat_id = ? AND company_id = ?',
                [targetChat, req.company_id]
            );
            if (rows.length === 0) {
                return res.status(403).json({ message: 'No tienes autorización para enviar pruebas a este chat' });
            }
        }

        if (!targetChat) return res.status(400).json({ message: 'No hay chats vinculados para esta empresa.' });
        await telegramService.sendMessage(targetChat, '✅ Prueba de conexión de Novas.\n\nSi recibes este mensaje, las alertas de Telegram funcionan correctamente.');
        res.json({ message: 'Mensaje de prueba enviado' });
    } catch (error) {
        console.error('Error testTelegram:', error);
        res.status(500).json({ message: `Error al enviar prueba: ${error.message}` });
    }
};

const getSuspiciousSettings = async (req, res) => {
    try {
        const { branch_id } = req.query;
        if (!branch_id) return res.status(400).json({ message: 'branch_id es obligatorio' });
        const [rows] = await pool.query(
            `SELECT * FROM sale_suspicious_settings WHERE company_id = ? AND branch_id = ?`,
            [req.company_id, branch_id]
        );
        if (rows.length === 0) {
            const [insert] = await pool.query(
                `INSERT INTO sale_suspicious_settings (company_id, branch_id) VALUES (?, ?)`,
                [req.company_id, branch_id]
            );
            const [created] = await pool.query('SELECT * FROM sale_suspicious_settings WHERE id = ?', [insert.insertId]);
            return res.json(created[0]);
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error getSuspiciousSettings:', error);
        res.status(500).json({ message: 'Error al obtener configuración de ventas sospechosas' });
    }
};

const saveSuspiciousSettings = async (req, res) => {
    try {
        const {
            branch_id, enabled, monto_maximo, descuento_maximo_porcentaje,
            montos_redondos, horas_inicio, horas_fin,
            anulaciones_maximas, ventana_anulaciones_min
        } = req.body;
        if (!branch_id) return res.status(400).json({ message: 'branch_id es obligatorio' });

        await pool.query(
            `INSERT INTO sale_suspicious_settings
                (company_id, branch_id, enabled, monto_maximo, descuento_maximo_porcentaje, montos_redondos, horas_inicio, horas_fin, anulaciones_maximas, ventana_anulaciones_min)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                enabled = VALUES(enabled), monto_maximo = VALUES(monto_maximo),
                descuento_maximo_porcentaje = VALUES(descuento_maximo_porcentaje),
                montos_redondos = VALUES(montos_redondos), horas_inicio = VALUES(horas_inicio),
                horas_fin = VALUES(horas_fin), anulaciones_maximas = VALUES(anulaciones_maximas),
                ventana_anulaciones_min = VALUES(ventana_anulaciones_min)`,
            [
                req.company_id, branch_id, enabled ? 1 : 0, parseFloat(monto_maximo) || 0,
                parseFloat(descuento_maximo_porcentaje) || 0, montos_redondos ? 1 : 0,
                horas_inicio || '00:00:00', horas_fin || '23:59:59',
                parseInt(anulaciones_maximas, 10) || 0, parseInt(ventana_anulaciones_min, 10) || 10
            ]
        );
        res.json({ message: 'Configuración de ventas sospechosas guardada' });
    } catch (error) {
        console.error('Error saveSuspiciousSettings:', error);
        res.status(500).json({ message: 'Error al guardar configuración de ventas sospechosas' });
    }
};

const updateDailyBriefingSetting = async (req, res) => {
    try {
        if (req.user?.role !== 'SuperAdmin') return res.status(403).json({ message: 'Solo SuperAdmin puede cambiar la configuración global' });
        const val = req.body.active ? 1 : 0;
        await pool.query('INSERT INTO telegram_settings (id, daily_briefing_active) VALUES (1, ?) ON DUPLICATE KEY UPDATE daily_briefing_active = VALUES(daily_briefing_active)', [val]);
        res.json({ success: true, message: `Reporte diario matutino ${val ? 'activado' : 'desactivado'}` });
    } catch (error) {
        console.error('Error updateDailyBriefingSetting:', error);
        res.status(500).json({ message: 'Error al actualizar configuración del reporte diario' });
    }
};

const testDailyBriefing = async (req, res) => {
    try {
        const isSuperAdmin = req.user?.role === 'SuperAdmin';
        const result = isSuperAdmin
            ? await telegramDailyBriefingService.sendAllDailyBriefings({ manual: true })
            : await telegramDailyBriefingService.sendDailyBriefingForCompany(req.company_id, { manual: true });
        if (result.success) return res.json({ success: true, message: result.message || 'Reporte de prueba enviado exitosamente a Telegram' });
        res.status(400).json({ success: false, message: result.message || 'No se pudo enviar el reporte' });
    } catch (error) {
        console.error('Error testDailyBriefing:', error);
        res.status(500).json({ message: `Error al enviar reporte de prueba: ${error.message}` });
    }
};

const updateReopenRequestsSetting = async (req, res) => {
    try {
        if (req.user?.role !== 'SuperAdmin') return res.status(403).json({ message: 'Solo SuperAdmin puede cambiar la configuración global' });
        const val = req.body.active ? 1 : 0;
        await pool.query('INSERT INTO telegram_settings (id, reopen_requests_active) VALUES (1, ?) ON DUPLICATE KEY UPDATE reopen_requests_active = VALUES(reopen_requests_active)', [val]);
        res.json({ success: true, message: `Solicitud de apertura de turnos vía Telegram ${val ? 'activada' : 'desactivada'}` });
    } catch (error) {
        console.error('Error updateReopenRequestsSetting:', error);
        res.status(500).json({ message: 'Error al actualizar configuración de reapertura' });
    }
};

const updateSupportTicketsSetting = async (req, res) => {
    try {
        if (req.user?.role !== 'SuperAdmin') return res.status(403).json({ message: 'Solo SuperAdmin puede cambiar la configuración global' });
        const val = req.body.active ? 1 : 0;
        await pool.query('INSERT INTO telegram_settings (id, support_tickets_active) VALUES (1, ?) ON DUPLICATE KEY UPDATE support_tickets_active = VALUES(support_tickets_active)', [val]);
        res.json({ success: true, message: `Gestión de tickets vía Telegram ${val ? 'activada' : 'desactivada'}` });
    } catch {
        res.status(500).json({ message: 'Error al actualizar configuración de tickets' });
    }
};

module.exports = {
    getStatus, getConfig: getStatus, saveBotToken, updateBinding, updateChatBinding: updateBinding,
    deleteBinding, deleteChatBinding: deleteBinding, createInviteToken, getPendingInvites, deletePendingInvite,
    testConnection, getSuspiciousSettings, saveSuspiciousSettings, updateDailyBriefingSetting,
    testDailyBriefing, updateReopenRequestsSetting, updateSupportTicketsSetting
};
