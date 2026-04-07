const pool = require('../config/db');

const getCategories = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM product_categories WHERE company_id = ?`;
        let params = [req.company_id];

        if (search) {
            query += ` AND (name LIKE ? OR description LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createCategory = async (req, res) => {
    console.log('ENTERING createCategory:', req.body);
    try {
        const { name, description } = req.body;
        const company_id = req.company_id;
        console.log('company_id from req:', company_id);
        const [result] = await pool.query(
            'INSERT INTO product_categories (name, description, company_id) VALUES (?, ?, ?)',
            [name, description, company_id]
        );
        res.status(201).json({ id: result.insertId, name, description });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        await pool.query(
            'UPDATE product_categories SET name = ?, description = ? WHERE id = ? AND company_id = ?',
            [name, description, id, req.company_id]
        );
        res.json({ id, name, description });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM product_categories WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory
};
