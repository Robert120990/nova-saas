const pool = require('../../config/db');
const notificationService = require('../notification.service');

// Todas las escrituras de planilla de una empresa comparten este bloqueo,
// incluyendo la validación de períodos cerrados y el descuento de cuotas.
async function executePayrollMutation(handler, request) {
    let connection;
    let transactionStarted = false;
    const notifications = [];
    const result = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [companies] = await connection.query(
            'SELECT id FROM companies WHERE id = ? FOR UPDATE', [request.company_id]
        );
        if (!companies.length) {
            result.status(404).json({ message: 'Empresa no encontrada' });
        } else {
            await handler(request, result, connection, {
                notify(...args) { notifications.push(args); return Promise.resolve(); }
            });
        }
        if (result.statusCode >= 400 || result.body === undefined) {
            await connection.rollback();
        } else {
            await connection.commit();
            notifications.forEach(args => {
                Promise.resolve().then(() => notificationService.notify(...args)).catch(() => {});
            });
        }
        transactionStarted = false;
    } catch (error) {
        if (transactionStarted) await connection.rollback().catch(() => {});
        result.status(error.statusCode || 500).json({ message: error.message });
    } finally {
        if (connection) connection.release();
    }
    return result;
}

module.exports = { executePayrollMutation };
