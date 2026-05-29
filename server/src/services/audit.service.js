const pool = require('../config/db');

async function logAudit({ company_id, user_id, username, branch_id, entity_type, entity_id, action, description, payload, ip_address, duration_ms }) {
    try {
        await pool.query(
            `INSERT INTO audit_log (company_id, user_id, username, branch_id, entity_type, entity_id, action, description, payload, ip_address, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_id || null,
                user_id || null,
                username || null,
                branch_id || null,
                entity_type,
                entity_id ? String(entity_id) : null,
                action,
                description || null,
                payload ? JSON.stringify(payload) : null,
                ip_address || null,
                duration_ms || null
            ]
        );
    } catch (error) {
        console.error('[AuditLog] Error:', error.message);
    }
}

module.exports = { logAudit };
