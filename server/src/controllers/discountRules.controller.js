const pool = require('../config/db');

const getRules = async (req, res) => {
    const { product_id, active } = req.query;
    try {
        let sql = `
            SELECT dr.*, p.nombre as product_name, p.codigo as product_code
            FROM product_discount_rules dr
            LEFT JOIN products p ON dr.product_id = p.id
            WHERE dr.company_id = ?
        `;
        const params = [req.company_id];

        if (product_id) {
            sql += ' AND dr.product_id = ?';
            params.push(product_id);
        }
        if (active === '1') {
            sql += ' AND dr.active = 1 AND (dr.start_date IS NULL OR dr.start_date <= CURDATE()) AND (dr.end_date IS NULL OR dr.end_date >= CURDATE())';
        }

        sql += ' ORDER BY dr.created_at DESC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getDiscountRules:', error);
        res.status(500).json({ message: 'Error al obtener reglas de descuento' });
    }
};

const createRule = async (req, res) => {
    try {
        const data = { ...req.body, company_id: req.company_id };
        const [result] = await pool.query('INSERT INTO product_discount_rules SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        console.error('Error in createDiscountRule:', error);
        res.status(500).json({ message: 'Error al crear regla de descuento' });
    }
};

const updateRule = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE product_discount_rules SET ? WHERE id = ? AND company_id = ?', [req.body, id, req.company_id]);
        res.json({ message: 'Regla actualizada' });
    } catch (error) {
        console.error('Error in updateDiscountRule:', error);
        res.status(500).json({ message: 'Error al actualizar regla' });
    }
};

const deleteRule = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM product_discount_rules WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Regla eliminada' });
    } catch (error) {
        console.error('Error in deleteDiscountRule:', error);
        res.status(500).json({ message: 'Error al eliminar regla' });
    }
};

module.exports = { getRules, createRule, updateRule, deleteRule };
