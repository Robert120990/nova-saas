const tenantMiddleware = (req, res, next) => {
    const companyId = req.headers['x-company-id'] ? parseInt(req.headers['x-company-id']) : (req.user?.company_id || req.company_id);
    if (!companyId) {
        return res.status(400).json({ message: 'Tenant context missing' });
    }

    req.company_id = companyId;
    req.branch_id = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id']) : (req.user?.branch_id || req.branch_id || null);
    next();
};

module.exports = tenantMiddleware;
