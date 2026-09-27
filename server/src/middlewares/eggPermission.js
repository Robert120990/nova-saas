const { getAccess, hasPermission } = require('../services/eggAccess.service');

// Cada endpoint declara su permiso; los catálogos de lectura permiten los consumidores indicados.
const requireEggPermission = (...permissions) => async (req, res, next) => {
    try {
        req.eggAccess ||= await getAccess(req.user, req.company_id);
        if (!permissions.some(permission => hasPermission(req.eggAccess, permission))) {
            return res.status(403).json({ message: `Permiso requerido: ${permissions.join(' / ')}` });
        }
        req.user.permissions = req.eggAccess.permissions;
        next();
    } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
module.exports = requireEggPermission;
