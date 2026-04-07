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
        const [result] = await pool.query(
            'INSERT INTO roles (name, permissions) VALUES (?, ?)',
            [name, JSON.stringify(permissions)]
        );
        res.status(201).json({ id: result.insertId, name, permissions });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear rol' });
    }
};

const updateRole = async (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;
    try {
        await pool.query(
            'UPDATE roles SET name = ?, permissions = ? WHERE id = ?',
            [name, JSON.stringify(permissions), id]
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
