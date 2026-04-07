const pool = require('../config/db');

const getPOS = async (req, res) => {
    const { branch_id, status } = req.query;
    try {
        let sql = `
            SELECT p.*, b.nombre AS branch_name 
            FROM points_of_sale p 
            LEFT JOIN branches b ON p.branch_id = b.id 
            WHERE p.company_id = ?
        `;
        const params = [req.company_id];

        if (branch_id) {
            sql += ` AND p.branch_id = ?`;
            params.push(branch_id);
        }
        if (status) {
            sql += ` AND p.status = ?`;
            params.push(status);
        }

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener puntos de venta' });
    }
};

const createPOS = async (req, res) => {
    const data = req.body;
    data.company_id = req.company_id;
    try {
        const [result] = await pool.query('INSERT INTO points_of_sale SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear punto de venta' });
    }
};

const updatePOS = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        await pool.query('UPDATE points_of_sale SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        res.json({ message: 'Punto de venta actualizado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar punto de venta' });
    }
};

const deletePOS = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM points_of_sale WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Punto de venta eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar punto de venta' });
    }
};

module.exports = { getPOS, createPOS, updatePOS, deletePOS };
