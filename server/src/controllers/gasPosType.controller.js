const pool = require('../config/db');

const TABLE = 'gas_station_pos_types';

exports.getPosTypes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, nombre FROM ${TABLE} WHERE company_id = ? AND branch_id = ? ORDER BY nombre`,
            [req.company_id, req.user.branch_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getPosTypes:', error);
        res.status(500).json({ message: 'Error al obtener tipos de POS' });
    }
};

exports.createPosType = async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ message: 'El nombre es obligatorio' });
        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (company_id, branch_id, nombre) VALUES (?, ?, ?)`,
            [req.company_id, req.user.branch_id, nombre]
        );
        res.status(201).json({ id: result.insertId, nombre });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un tipo de POS con ese nombre' });
        console.error('Error createPosType:', error);
        res.status(500).json({ message: 'Error al crear tipo de POS' });
    }
};

exports.updatePosType = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ message: 'El nombre es obligatorio' });
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET nombre = ? WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [nombre, id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Tipo de POS no encontrado' });
        res.json({ id: parseInt(id), nombre });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Ya existe un tipo de POS con ese nombre' });
        console.error('Error updatePosType:', error);
        res.status(500).json({ message: 'Error al actualizar tipo de POS' });
    }
};

exports.deletePosType = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM ${TABLE} WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Tipo de POS no encontrado' });
        res.json({ message: 'Tipo de POS eliminado' });
    } catch (error) {
        console.error('Error deletePosType:', error);
        res.status(500).json({ message: 'Error al eliminar tipo de POS' });
    }
};
