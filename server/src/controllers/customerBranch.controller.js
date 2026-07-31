const pool = require('../config/db');

const getBranches = async (req, res) => {
    const { customer_id } = req.query;
    if (!customer_id) {
        return res.status(400).json({ message: 'customer_id es requerido' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT cb.*,
                    d.description AS departamento_nombre,
                    m.description AS municipio_nombre,
                    dist.description AS distrito_nombre
             FROM customer_branches cb
             LEFT JOIN cat_012_departamento d ON cb.departamento = d.code
             LEFT JOIN cat_013_municipio m ON cb.municipio = m.code AND cb.departamento = m.dep_code
             LEFT JOIN cat_008_distrito dist ON cb.distrito = dist.code AND cb.departamento = dist.dep_code
             WHERE cb.customer_id = ? AND cb.company_id = ?
             ORDER BY cb.id ASC`,
            [customer_id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        res.status(500).json({ message: 'Error al obtener sucursales' });
    }
};

const createBranch = async (req, res) => {
    const { customer_id, nombre, departamento, municipio, distrito, direccion, telefono } = req.body;
    if (!customer_id || !nombre) {
        return res.status(400).json({ message: 'customer_id y nombre son requeridos' });
    }
    try {
        const [result] = await pool.query(
            'INSERT INTO customer_branches (customer_id, company_id, nombre, departamento, municipio, distrito, direccion, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [customer_id, req.company_id, nombre, departamento || null, municipio || null, distrito || null, direccion || null, telefono || null]
        );
        res.status(201).json({ id: result.insertId, customer_id, nombre, departamento, municipio, distrito, direccion, telefono });
    } catch (error) {
        console.error('Error al crear sucursal:', error);
        res.status(500).json({ message: 'Error al crear sucursal' });
    }
};

const updateBranch = async (req, res) => {
    const { id } = req.params;
    const { nombre, departamento, municipio, distrito, direccion, telefono } = req.body;
    try {
        await pool.query(
            'UPDATE customer_branches SET nombre = ?, departamento = ?, municipio = ?, distrito = ?, direccion = ?, telefono = ? WHERE id = ? AND company_id = ?',
            [nombre, departamento || null, municipio || null, distrito || null, direccion || null, telefono || null, id, req.company_id]
        );
        res.json({ message: 'Sucursal actualizada' });
    } catch (error) {
        console.error('Error al actualizar sucursal:', error);
        res.status(500).json({ message: 'Error al actualizar sucursal' });
    }
};

const deleteBranch = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM customer_branches WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Sucursal eliminada' });
    } catch (error) {
        console.error('Error al eliminar sucursal:', error);
        res.status(500).json({ message: 'Error al eliminar sucursal' });
    }
};

module.exports = { getBranches, createBranch, updateBranch, deleteBranch };
