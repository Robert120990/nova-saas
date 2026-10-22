const pool = require('../config/db');

/**
 * Middleware para soporte de idempotencia en mutaciones (POST, PUT, PATCH, DELETE).
 * Si el cliente envía la cabecera 'x-idempotency-key', el middleware:
 * 1. Verifica si la operación ya fue completada exitosamente. De ser así, retorna
 *    la respuesta previamente almacenada sin reejecutar la lógica de negocio.
 * 2. Si es una nueva operación, intercepta la respuesta y la persiste para reintentos posteriores.
 */
const idempotencyMiddleware = async (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'];

    // Si no se envía clave o es una lectura segura (GET/OPTIONS/HEAD), continuar normalmente
    if (!idempotencyKey || ['GET', 'OPTIONS', 'HEAD'].includes(req.method)) {
        return next();
    }

    const companyId = req.company_id || req.user?.company_id || 0;

    try {
        const [rows] = await pool.query(
            `SELECT status_code, response_body FROM sys_idempotency_keys 
             WHERE idempotency_key = ? AND company_id = ? 
             LIMIT 1`,
            [idempotencyKey, companyId]
        );

        if (rows.length > 0) {
            const cached = rows[0];
            res.setHeader('x-idempotent-replayed', 'true');
            res.setHeader('Content-Type', 'application/json');
            return res.status(cached.status_code).send(cached.response_body);
        }

        // Interceptar res.send para persistir el resultado si es exitoso (2xx / 3xx)
        const originalSend = res.send.bind(res);
        res.send = function (body) {
            if (res.statusCode >= 200 && res.statusCode < 400) {
                const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
                pool.query(
                    `INSERT INTO sys_idempotency_keys 
                     (idempotency_key, company_id, user_id, endpoint, method, status_code, response_body)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE status_code = VALUES(status_code), response_body = VALUES(response_body)`,
                    [idempotencyKey, companyId, req.user?.id || null, req.originalUrl, req.method, res.statusCode, bodyStr]
                ).catch(err => {
                    console.error('[Idempotency] Error persistiendo clave:', err.message);
                });
            }
            return originalSend(body);
        };

        next();
    } catch (error) {
        console.error('[Idempotency] Error consultando clave:', error.message);
        // En caso de fallo en la tabla de idempotencia, continuar para no bloquear la operación
        next();
    }
};

module.exports = idempotencyMiddleware;
