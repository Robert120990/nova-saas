const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Token no proporcionado' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

const tenantMiddleware = (req, res, next) => {
    // STRICT: Extract company_id and branch_id ONLY from the authenticated user token
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const companyId = req.user.company_id;
    const branchId = req.user.branch_id;

    if (!companyId) {
        return res.status(400).json({ success: false, message: 'ID de empresa faltante en el token' });
    }

    req.company_id = parseInt(companyId);
    req.branch_id = branchId ? parseInt(branchId) : null;

    // Debug log as requested by user
    console.log(`[TenantAware] Authenticated user: ${req.user.id}, Company: ${req.company_id}, Branch: ${req.branch_id}`);

    next();
};

module.exports = { authMiddleware, tenantMiddleware };
