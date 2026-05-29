const { logAudit } = require('../services/audit.service');

const EXCLUDED_PATHS = [
    '/api/dashboard',
    '/api/pos',
    '/health',
    '/api/audit-log',
];

function auditMiddleware(req, res, next) {
    if (req.method === 'GET') return next();

    const start = Date.now();
    const originalEnd = res.end;

    if (EXCLUDED_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) {
        return next();
    }

    res.end = function (...args) {
        const duration = Date.now() - start;

        logAudit({
            company_id: req.company_id,
            user_id: req.user?.id,
            username: req.user?.username || req.user?.nombre,
            branch_id: req.user?.branch_id,
            entity_type: 'api_request',
            entity_id: req.params?.id || null,
            action: `${req.method} ${req.baseUrl ? req.baseUrl + req.path : req.path}`,
            description: `${res.statusCode} — ${req.method} ${req.originalUrl || req.url}`,
            payload: {
                query: req.query,
                statusCode: res.statusCode
            },
            ip_address: req.ip || req.connection?.remoteAddress,
            duration_ms: duration
        });

        originalEnd.apply(this, args);
    };

    next();
}

module.exports = auditMiddleware;
