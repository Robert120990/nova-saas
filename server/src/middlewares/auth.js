const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verifyToken = (req, res, next) => {
    console.log('[DEBUG] verifyToken hit for:', req.method, req.originalUrl);
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification FAILED:', error.message);
        return res.status(401).json({ message: 'Unauthorized' });
    }
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

            const permissions = JSON.parse(rows[0].permissions || '[]');
            if (permissions.includes(permission)) {
                return next();
            }

            return res.status(403).json({ message: `Forbidden: Missing permission [${permission}]` });
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Error al verificar permisos' });
        }
    };
};

module.exports = { verifyToken, checkRole, checkPermission };
