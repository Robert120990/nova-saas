const pool = require('../config/db');

async function getLogs(req, res) {
    try {
        const { search = '', page = 1, limit = 50, entity_type, action: filterAction, user_id, start_date, end_date } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = ['company_id = ?'];
        let params = [req.company_id];

        if (search) {
            where.push('(description LIKE ? OR username LIKE ? OR entity_type LIKE ? OR action LIKE ?)');
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (entity_type) {
            where.push('entity_type = ?');
            params.push(entity_type);
        }

        if (filterAction) {
            where.push('action LIKE ?');
            params.push(`%${filterAction}%`);
        }

        if (user_id) {
            where.push('user_id = ?');
            params.push(parseInt(user_id));
        }

        if (start_date) {
            where.push('created_at >= ?');
            params.push(start_date);
        }

        if (end_date) {
            where.push('created_at <= ?');
            params.push(end_date + ' 23:59:59');
        }

        const whereClause = where.join(' AND ');

        const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM audit_log WHERE ${whereClause}`, params);
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT id, company_id, user_id, username, branch_id, entity_type, entity_id, action, description, ip_address, duration_ms, created_at
             FROM audit_log WHERE ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('[AuditLog] List error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

async function getLogById(req, res) {
    try {
        const [rows] = await pool.query('SELECT * FROM audit_log WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Registro no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function getEntityTypes(req, res) {
    try {
        const [rows] = await pool.query('SELECT DISTINCT entity_type FROM audit_log WHERE company_id = ? ORDER BY entity_type', [req.company_id]);
        res.json(rows.map(r => r.entity_type));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = { getLogs, getLogById, getEntityTypes };
