const tenantMiddleware = (req, res, next) => {
    if (!req.user || !req.user.company_id) {
        return res.status(400).json({ message: 'Tenant context missing' });
    }

    req.company_id = req.user.company_id;
    next();
};

module.exports = tenantMiddleware;
