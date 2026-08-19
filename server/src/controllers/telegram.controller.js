const pool = require('../config/db');
const telegramService = require('../services/telegram.service');

/**
 * Configuración de Telegram y ventas sospechosas (panel de Notificaciones)
 */

const getStatus = async (req, res) => {
    try {
        const [bindings] = await pool.query(
            `SELECT b.id, b.chat_id, b.company_id, b.branch_id, b.nombre, b.username, b.receive_alerts,
                    c.razon_social as company_nombre, br.nombre as branch_nombre
             FROM telegram_chat_bindings b
             JOIN companies c ON c.id = b.company_id
             JOIN branches br ON br.id = b.branch_id
             WHERE b.company_id = ?
             ORDER BY b.created_at DESC`,
            [req.company_id]
        );
        const botInfo = await telegramService.getMe();
        res.json({
            configured: !!process.env.TELEGRAM_BOT_TOKEN,
            botInfo,
            bindings
        });
    } catch (error) {
        console.error('Error getTelegramStatus:', error);
        res.status(500).json({ message: 'Error al obtener estado de Telegram' });
    }
};

const updateBinding = async (req, res) => {
    try {
        const { id } = req.params;
        const { receive_alerts } = req.body;
        const [result] = await pool.query(
            `UPDATE telegram_chat_bindings
             SET receive_alerts = ?
             WHERE id = ? AND company_id = ?`,
            [receive_alerts ? 1 : 0, id, req.company_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vinculación no encontrada' });
        }
        res.json({ message: 'Preferencia de alertas actualizada' });
    } catch (error) {
        console.error('Error updateBinding:', error);
        res.status(500).json({ message: 'Error al actualizar la vinculación' });
    }
};

const testConnection = async (req, res) => {
    try {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            return res.status(400).json({ message: 'TELEGRAM_BOT_TOKEN no está configurado en el servidor' });
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

module.exports = { getStatus, updateBinding, testConnection, getSuspiciousSettings, saveSuspiciousSettings };
