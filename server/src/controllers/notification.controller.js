const pool = require('../config/db');

const getActions = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM notification_actions WHERE is_active = 1 ORDER BY category, name'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error in getActions:', error);
        res.status(500).json({ message: 'Error al obtener acciones' });
    }
};

const getRulesByBranch = async (req, res) => {
    const { branchId } = req.params;
    try {
        const [branchCheck] = await pool.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branchId, req.company_id]
        );
        if (branchCheck.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para acceder a esta sucursal' });
        }

        const [rules] = await pool.query(
            'SELECT * FROM notification_rules WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL) ORDER BY created_at DESC',
            [req.company_id, branchId]
        );

        const result = [];
        for (const rule of rules) {
            const [conditions] = await pool.query(
                'SELECT * FROM notification_rule_conditions WHERE rule_id = ? ORDER BY id',
                [rule.id]
            );
            const [recipients] = await pool.query(
                `SELECT rcr.user_id, u.nombre, u.username, u.email
                 FROM notification_rule_recipients rcr
                 JOIN users u ON rcr.user_id = u.id
                 WHERE rcr.rule_id = ?`,
                [rule.id]
            );
            result.push({ ...rule, conditions, recipients });
        }
        res.json(result);
    } catch (error) {
        console.error('Error in getRulesByBranch:', error);
        res.status(500).json({ message: 'Error al obtener reglas' });
    }
};

const saveRule = async (req, res) => {
    const { id, branch_id, action_code, name, is_active, channel_system, channel_email, channel_whatsapp, title_template, body_template, conditions, recipients } = req.body;

    if (!action_code || !name) {
        return res.status(400).json({ message: 'Código de acción y nombre son requeridos' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [branchCheck] = await connection.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branch_id, req.company_id]
        );
        if (branchCheck.length === 0) {
            await connection.rollback();
            return res.status(403).json({ message: 'No tienes permiso para configurar esta sucursal' });
        }

        let ruleId;
        if (id) {
            await connection.query(
                `UPDATE notification_rules SET branch_id = ?, action_code = ?, name = ?, is_active = ?,
                 channel_system = ?, channel_email = ?, channel_whatsapp = ?,
                 title_template = ?, body_template = ?
                 WHERE id = ? AND company_id = ?`,
                [branch_id, action_code, name, is_active ?? 1, channel_system ?? 1, channel_email ?? 0, channel_whatsapp ?? 0, title_template || null, body_template || null, id, req.company_id]
            );
            ruleId = id;
            await connection.query('DELETE FROM notification_rule_conditions WHERE rule_id = ?', [id]);
            await connection.query('DELETE FROM notification_rule_recipients WHERE rule_id = ?', [id]);
        } else {
            const [result] = await connection.query(
                `INSERT INTO notification_rules (company_id, branch_id, action_code, name, is_active, channel_system, channel_email, channel_whatsapp, title_template, body_template)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, branch_id, action_code, name, is_active ?? 1, channel_system ?? 1, channel_email ?? 0, channel_whatsapp ?? 0, title_template || null, body_template || null]
            );
            ruleId = result.insertId;
        }

        if (conditions && conditions.length > 0) {
            const validConditions = conditions.filter(c => c.field && c.field.trim());
            if (validConditions.length > 0) {
                const values = validConditions.map(c => [ruleId, c.field, c.operator, c.value]);
                await connection.query(
                    'INSERT INTO notification_rule_conditions (rule_id, field, operator, value) VALUES ?',
                    [values]
                );
            }
        }

        if (recipients && recipients.length > 0) {
            const values = recipients.map(u => [ruleId, u.user_id || u.id]);
            await connection.query(
                'INSERT INTO notification_rule_recipients (rule_id, user_id) VALUES ?',
                [values]
            );
        }

        await connection.commit();
        res.json({ id: ruleId, message: 'Regla guardada correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in saveRule:', error);
        res.status(500).json({ message: 'Error al guardar regla: ' + error.message });
    } finally {
        connection.release();
    }
};

const deleteRule = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query(
            'DELETE FROM notification_rules WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Regla no encontrada' });
        }
        res.json({ message: 'Regla eliminada correctamente' });
    } catch (error) {
        console.error('Error in deleteRule:', error);
        res.status(500).json({ message: 'Error al eliminar regla' });
    }
};

const getMyNotifications = async (req, res) => {
    const { page = 1, limit = 20, unread } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

    try {
        let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?';
        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        const params = [userId];

        if (unread === 'true') {
            countQuery += ' AND is_read = 0';
            query += ' AND is_read = 0';
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        const [rows] = await pool.query(query, [...params, parseInt(limit), parseInt(offset)]);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error in getMyNotifications:', error);
        res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ count: rows[0].count });
    } catch (error) {
        console.error('Error in getUnreadCount:', error);
        res.status(500).json({ message: 'Error al obtener conteo' });
    }
};

const markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        res.json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        console.error('Error in markAsRead:', error);
        res.status(500).json({ message: 'Error al marcar notificación' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        console.error('Error in markAllAsRead:', error);
        res.status(500).json({ message: 'Error al marcar notificaciones' });
    }
};

module.exports = {
    getActions,
    getRulesByBranch,
    saveRule,
    deleteRule,
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead
};
