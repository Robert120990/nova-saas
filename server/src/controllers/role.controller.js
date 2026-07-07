const pool = require('../config/db');

const getRoles = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM roles');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener roles' });
    }
};

const createRole = async (req, res) => {
    const { name, permissions } = req.body;
    try {
        const perms = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
        if (!Array.isArray(perms)) {
            return res.status(400).json({ message: 'El formato de permisos no es válido' });
        }
        if (new Set(perms).size !== perms.length) {
            return res.status(400).json({ message: 'No se permiten IDs de permiso duplicados' });
        }
        const [result] = await pool.query(
            'INSERT INTO roles (name, permissions) VALUES (?, ?)',
            [name, JSON.stringify(perms)]
        );
        res.status(201).json({ id: result.insertId, name, permissions: perms });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear rol' });
    }
};

const updateRole = async (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;
    try {
        const perms = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
        if (!Array.isArray(perms)) {
            return res.status(400).json({ message: 'El formato de permisos no es válido' });
        }
        if (new Set(perms).size !== perms.length) {
            return res.status(400).json({ message: 'No se permiten IDs de permiso duplicados' });
        }
        await pool.query(
            'UPDATE roles SET name = ?, permissions = ? WHERE id = ?',
            [name, JSON.stringify(perms), id]
        );
        res.json({ message: 'Rol actualizado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar rol' });
    }
};

const deleteRole = async (req, res) => {
    const { id } = req.params;
    try {
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
