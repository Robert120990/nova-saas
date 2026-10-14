const pool = require('../config/db');
const telegramService = require('../services/telegram.service');
const telegramDailyBriefingService = require('../services/telegramDailyBriefing.service');

/**
 * Configuración de Telegram y ventas sospechosas (panel de Notificaciones)
 */

const getStatus = async (req, res) => {
    try {
        const [bindings] = await pool.query(
            `SELECT b.id, b.chat_id, b.company_id, b.branch_id, b.nombre, b.username, b.receive_alerts,
                    COALESCE(c.razon_social, 'Todas las Empresas') as company_nombre,
                    COALESCE(br.nombre, 'Todas las sucursales (Global)') as branch_nombre
             FROM telegram_chat_bindings b
             LEFT JOIN companies c ON c.id = b.company_id
             LEFT JOIN branches br ON br.id = b.branch_id
             WHERE b.company_id = ? OR b.branch_id IS NULL
             ORDER BY b.created_at DESC`,
            [req.company_id]
        );
        const token = await telegramService.getBotToken();
        const botInfo = await telegramService.getMe();
        const [settingsRows] = await pool.query('SELECT daily_briefing_active FROM telegram_settings WHERE id = 1');
        const dailyBriefingActive = settingsRows.length > 0 ? (settingsRows[0].daily_briefing_active !== 0) : true;

        res.json({
            configured: !!token,
            maskedToken: token ? `${token.slice(0, 6)}...${token.slice(-4)}` : '',
            botInfo,
            bindings,
            dailyBriefingActive
        });
    } catch (error) {
        console.error('Error getTelegramStatus:', error);
        res.status(500).json({ message: 'Error al obtener estado de Telegram' });
    }
};

const saveBotToken = async (req, res) => {
    try {
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

        res.json({
            success: true,
            message: 'Token de Telegram configurado exitosamente',
            botInfo
        });
    } catch (error) {
        console.error('Error saveBotToken:', error);
        res.status(500).json({ message: 'Error al guardar token de Telegram: ' + error.message });
    }
};

const updateBinding = async (req, res) => {
    try {
        const { id } = req.params;
        const { receive_alerts, branch_id } = req.body;
        const updates = [];
        const params = [];
        if (receive_alerts !== undefined) {
            updates.push('receive_alerts = ?');
            params.push(receive_alerts ? 1 : 0);
        }
        if (branch_id !== undefined) {
            updates.push('branch_id = ?');
            params.push(branch_id === 'all' || branch_id === null || branch_id === '' ? null : parseInt(branch_id, 10));
        }
        if (updates.length === 0) return res.json({ message: 'Sin cambios' });
        params.push(id);
        const [result] = await pool.query(
            `UPDATE telegram_chat_bindings SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vinculación no encontrada' });
        }
        res.json({ message: 'Vinculación actualizada' });
    } catch (error) {
        console.error('Error updateBinding:', error);
        res.status(500).json({ message: 'Error al actualizar la vinculación' });
    }
};

const testConnection = async (req, res) => {
    try {
        const token = await telegramService.getBotToken();
        if (!token) {
            return res.status(400).json({ message: 'El token de Telegram no está configurado en el servidor' });
        }
        const { chat_id } = req.body;
        let targetChat = chat_id;
        if (!targetChat) {
            const [rows] = await pool.query(
                'SELECT chat_id FROM telegram_chat_bindings WHERE company_id = ? ORDER BY id DESC LIMIT 1',
                [req.company_id]
            );
            targetChat = rows[0]?.chat_id;
        }
        if (!targetChat) {
            return res.status(400).json({ message: 'No hay chats vinculados. Escribe /start al bot desde Telegram.' });
        }
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
            const [created] = await pool.query(
                'SELECT * FROM sale_suspicious_settings WHERE id = ?',
                [insert.insertId]
            );
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
        const { branch_id } = req.body;
        const {
            enabled, monto_maximo, descuento_maximo_porcentaje,
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
                req.company_id, branch_id,
                enabled ? 1 : 0,
                parseFloat(monto_maximo) || 0,
                parseFloat(descuento_maximo_porcentaje) || 0,
                montos_redondos ? 1 : 0,
                horas_inicio || '00:00:00',
                horas_fin || '23:59:59',
                parseInt(anulaciones_maximas, 10) || 0,
                parseInt(ventana_anulaciones_min, 10) || 10
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
        const { active } = req.body;
        const val = active ? 1 : 0;
        await pool.query(`
            INSERT INTO telegram_settings (id, daily_briefing_active)
            VALUES (1, ?)
            ON DUPLICATE KEY UPDATE daily_briefing_active = VALUES(daily_briefing_active)
        `, [val]);
        res.json({ success: true, message: `Reporte diario matutino ${val ? 'activado' : 'desactivado'}` });
    } catch (error) {
        console.error('Error updateDailyBriefingSetting:', error);
        res.status(500).json({ message: 'Error al actualizar configuración del reporte diario' });
    }
};

const testDailyBriefing = async (req, res) => {
    try {
        const result = await telegramDailyBriefingService.sendAllDailyBriefings({ manual: true });
        if (result.success) {
            res.json({ success: true, message: result.message || 'Reporte de prueba enviado exitosamente a Telegram' });
        } else {
            res.status(400).json({ success: false, message: result.message || 'No se pudo enviar el reporte' });
        }
    } catch (error) {
        console.error('Error testDailyBriefing:', error);
        res.status(500).json({ message: `Error al enviar reporte de prueba: ${error.message}` });
    }
};

module.exports = {
    getStatus,
    saveBotToken,
    updateBinding,
    testConnection,
    getSuspiciousSettings,
    saveSuspiciousSettings,
    updateDailyBriefingSetting,
    testDailyBriefing
};
