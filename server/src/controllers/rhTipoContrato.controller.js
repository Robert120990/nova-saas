const pool = require('../config/db');

const TABLE = 'rh_tipos_contrato';
const LABEL = 'Tipo de Contrato';

const getTiposContrato = async (req, res) => {
    try {
        const { search, page = 1, limit = 15 } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM ${TABLE} WHERE company_id = ?`;
        let params = [req.company_id];

        if (search) {
            query += ` AND (codigo LIKE ? OR descripcion LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY codigo ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createTipoContrato = async (req, res) => {
    try {
        const { codigo, descripcion } = req.body;
        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (codigo, descripcion, company_id) VALUES (?, ?, ?)`,
            [codigo, descripcion, req.company_id]
        );
        res.status(201).json({ id: result.insertId, codigo, descripcion });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateTipoContrato = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, descripcion } = req.body;
        const [result] = await pool.query(
            `UPDATE ${TABLE} SET codigo = ?, descripcion = ? WHERE id = ? AND company_id = ?`,
            [codigo, descripcion, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ id, codigo, descripcion });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteTipoContrato = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ message: `${LABEL} eliminado` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getTiposContrato, createTipoContrato, updateTipoContrato, deleteTipoContrato };
