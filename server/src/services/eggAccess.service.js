const pool = require('../config/db');
function parsePermissions(raw) {
    for (let i = 0; i < 2 && typeof raw === 'string'; i++) {
        try { raw = JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(raw) ? raw : [];
}
async function getAccess(user, companyId) {
    if (user?.role === 'SuperAdmin') return { superAdmin: true, permissions: [] };
    const [rows] = await pool.query(`SELECT r.permissions FROM usuario_empresa ue JOIN roles r ON r.id = ue.role_id
        WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND ue.has_access = 1`, [user?.id, companyId]);
    if (!rows.length) throw Object.assign(new Error('Acceso no autorizado a esta empresa.'), { status: 403 });
    return { superAdmin: false, permissions: parsePermissions(rows[0].permissions) };
}
const hasPermission = (access, permission) => !!access?.superAdmin || (access?.permissions || []).includes(permission);
module.exports = { getAccess, hasPermission, parsePermissions };
