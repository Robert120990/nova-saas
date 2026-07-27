const pool = require('../config/db');

async function notify(actionCode, companyId, branchId, context = {}) {
    try {
        await pool.query(
            `INSERT INTO notification_queue (action_code, company_id, branch_id, context)
             VALUES (?, ?, ?, ?)`,
            [actionCode, companyId, branchId, JSON.stringify(context)]
        );
    } catch (error) {
        console.error('[NotificationService] Error al encolar notificación:', error);
    }
}

module.exports = { notify };
