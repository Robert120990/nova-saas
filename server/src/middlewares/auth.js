const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SESSION_CACHE_TTL_MS = 15000;
const sessionValidityCache = new Map();

const invalidateSessionCache = (sessionId) => {
    if (sessionId !== undefined && sessionId !== null) {
        sessionValidityCache.delete(sessionId);
        sessionValidityCache.delete(String(sessionId));
        const numId = Number(sessionId);
        if (!Number.isNaN(numId)) {
            sessionValidityCache.delete(numId);
        }
    } else {
        sessionValidityCache.clear();
    }
};

const clearSessionCache = () => {
    sessionValidityCache.clear();
};

const verifyToken = async (req, res, next) => {
    console.log('[DEBUG] verifyToken hit for:', req.method, req.path);
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const queryToken = req.method === 'GET' ? req.query?.token : undefined;
    const token = headerToken || queryToken;

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        console.error('Token verification FAILED:', error.message);
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawUrl = String(req.originalUrl || `${req.baseUrl || ''}${req.path || ''}`).split('?')[0];
    const fullPath = String(`${req.baseUrl || ''}${req.path || ''}`).split('?')[0];
    if (
        decoded.isTemp &&
        !/\/(select-context|me\/access)\/?$/.test(rawUrl) &&
        !/\/(select-context|me\/access)\/?$/.test(fullPath)
    ) {
        return res.status(403).json({ message: 'Debe seleccionar empresa y sucursal antes de continuar.' });
    }

    if (decoded.session_id) {
        const sessionId = decoded.session_id;
        const now = Date.now();
        const cached = sessionValidityCache.get(sessionId) || sessionValidityCache.get(String(sessionId));

        if (cached && (now - cached.ts) < SESSION_CACHE_TTL_MS) {
            if (!cached.valid) {
                return res.status(401).json({
                    message: 'Sesión finalizada o revocada por un administrador.',
                    sessionTerminated: true
                });
            }
        } else {
            let isValid = true;
            let dbQueried = false;
            try {
                const [rows] = await pool.query(
                    'SELECT id, is_active FROM user_sessions WHERE id = ? AND user_id = ? LIMIT 1',
                    [sessionId, decoded.id]
                );
                dbQueried = true;
                isValid = Array.isArray(rows) && rows.length > 0 && rows[0].is_active !== 0 && rows[0].is_active !== false;
            } catch (dbErr) {
                console.error('Session validation DB error (failing open):', dbErr.message);
            }

            if (dbQueried) {
                const entry = { valid: isValid, ts: now };
                sessionValidityCache.set(sessionId, entry);
                sessionValidityCache.set(String(sessionId), entry);
                if (!isValid) {
                    return res.status(401).json({
                        message: 'Sesión finalizada o revocada por un administrador.',
                        sessionTerminated: true
                    });
                }
            }
        }
    }

    req.user = decoded;
    req.company_id = req.headers['x-company-id'] ? parseInt(req.headers['x-company-id']) : (decoded.company_id || null);
    req.companyId = req.company_id;
    req.branch_id = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (decoded.branch_id || null);
    req.branchId = req.branch_id;
    next();
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

const checkPermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (req.user.role === 'SuperAdmin') return next();

            const [rows] = await pool.query(
                'SELECT permissions FROM roles WHERE name = ?',
                [req.user.role]
            );

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Role not found' });
            }

            const raw = rows[0].permissions;
            let permissions = [];
            if (Array.isArray(raw)) {
                permissions = raw;
            } else if (typeof raw === 'string') {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        permissions = parsed;
                    } else if (typeof parsed === 'string') {
                        const doubleParsed = JSON.parse(parsed);
                        if (Array.isArray(doubleParsed)) permissions = doubleParsed;
                    }
                } catch {
                    permissions = [];
                }
            }
            const required = Array.isArray(permission) ? permission : [permission];
            const hasPermission = required.some(p => permissions.includes(p));

            if (hasPermission) {
                return next();
            }

            return res.status(403).json({ message: `Forbidden: Missing permission [${required.join(' OR ')}]` });
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Error al verificar permisos' });
        }
    };
};

module.exports = { verifyToken, checkRole, checkPermission, invalidateSessionCache, clearSessionCache, sessionValidityCache };

