const pool = require('../config/db');

const isSuperAdmin = (req) => req.user?.role === 'SuperAdmin';

const getRoles = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM roles');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener roles' });
    }
};

const createRole = async (req, res) => {
    const { name, permissions, default_dashboard } = req.body;
    try {
        if (String(name || '').trim().toLowerCase() === 'superadmin') {
            return res.status(403).json({ message: 'No se permite crear un rol con el nombre reservado SuperAdmin' });
        }

        const perms = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
        if (!Array.isArray(perms)) {
            return res.status(400).json({ message: 'El formato de permisos no es válido' });
        }
        if (new Set(perms).size !== perms.length) {
            return res.status(400).json({ message: 'No se permiten IDs de permiso duplicados' });
        }
        if (!isSuperAdmin(req) && perms.includes('manage_server_terminal')) {
            return res.status(403).json({ message: 'Solo un SuperAdmin puede otorgar permisos de terminal del servidor' });
        }

        const validDashboards = ['general', 'pista', 'tienda', 'andelsa', 'server'];
        const dash = validDashboards.includes(default_dashboard) ? default_dashboard : 'general';

        const [result] = await pool.query(
            'INSERT INTO roles (name, permissions, default_dashboard) VALUES (?, ?, ?)',
            [name, JSON.stringify(perms), dash]
        );
        res.status(201).json({ id: result.insertId, name, permissions: perms, default_dashboard: dash });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear rol' });
    }
};

const updateRole = async (req, res) => {
    const { id } = req.params;
    const { name, permissions, default_dashboard } = req.body;
    try {
        const [existing] = await pool.query('SELECT id, name FROM roles WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }

        const existingIsSuperAdmin = Number(id) === 1 || String(existing[0].name || '').trim().toLowerCase() === 'superadmin';
        if (existingIsSuperAdmin && !isSuperAdmin(req)) {
            return res.status(403).json({ message: 'Solo un SuperAdmin puede modificar el rol SuperAdmin' });
        }

        if (String(name || '').trim().toLowerCase() === 'superadmin' && !existingIsSuperAdmin) {
            return res.status(403).json({ message: 'No se permite asignar el nombre reservado SuperAdmin a otro rol' });
        }

        const perms = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
        if (!Array.isArray(perms)) {
            return res.status(400).json({ message: 'El formato de permisos no es válido' });
        }
        if (new Set(perms).size !== perms.length) {
            return res.status(400).json({ message: 'No se permiten IDs de permiso duplicados' });
        }
        if (!isSuperAdmin(req) && perms.includes('manage_server_terminal')) {
            return res.status(403).json({ message: 'Solo un SuperAdmin puede otorgar permisos de terminal del servidor' });
        }

        const validDashboards = ['general', 'pista', 'tienda', 'andelsa', 'server'];
        const dash = validDashboards.includes(default_dashboard) ? default_dashboard : 'general';

        await pool.query(
            'UPDATE roles SET name = ?, permissions = ?, default_dashboard = ? WHERE id = ?',
            [name, JSON.stringify(perms), dash, id]
        );
        res.json({ message: 'Rol actualizado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar rol' });
    }
};

const deleteRole = async (req, res) => {
    const { id } = req.params;
    try {
        const [existing] = await pool.query('SELECT id, name FROM roles WHERE id = ?', [id]);
        if (
            Number(id) === 1 ||
            (existing.length > 0 && String(existing[0].name || '').trim().toLowerCase() === 'superadmin')
        ) {
            return res.status(403).json({ message: 'El rol SuperAdmin del sistema no puede ser eliminado' });
        }

        await pool.query(
            'DELETE FROM roles WHERE id = ?',
            [id]
        );
        res.json({ message: 'Rol eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar rol' });
    }
};

module.exports = { getRoles, createRole, updateRole, deleteRole };

