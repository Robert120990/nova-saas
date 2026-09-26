const pool = require('../config/db');

const tenantMiddleware = async (req, res, next) => {
    const companyId = req.headers['x-company-id'] 
        ? parseInt(req.headers['x-company-id']) 
        : (req.query.company_id ? parseInt(req.query.company_id) : (req.user?.company_id || req.company_id));
    if (!companyId) {
        return res.status(400).json({ message: 'Tenant context missing' });
    }

    // Validar aislamiento multi-tenant: si el usuario no es SuperAdmin, debe tener asignación activa en la empresa
    if (req.user && req.user.role !== 'SuperAdmin') {
        try {
            const [access] = await pool.query(
                'SELECT 1 FROM usuario_empresa WHERE usuario_id = ? AND empresa_id = ? AND has_access = 1',
                [req.user.id, companyId]
            );
            if (access.length === 0) {
                return res.status(403).json({ message: 'Acceso no autorizado a esta empresa' });
            }
        } catch (dbErr) {
            console.error('Tenant access verification error:', dbErr);
            return res.status(500).json({ message: 'Error al verificar acceso de empresa' });
        }
    }

    req.company_id = companyId;
    req.branch_id = req.headers['x-branch-id'] 
        ? parseInt(req.headers['x-branch-id']) 
        : (req.query.branch_id ? parseInt(req.query.branch_id) : (req.user?.branch_id || req.branch_id || null));
    next();
};

module.exports = tenantMiddleware;
