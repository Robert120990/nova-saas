const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const getSellers = async (req, res) => {
    const { search = '', page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    try {
        let query = `
            SELECT s.*, b.nombre as branch_name, p.nombre as pos_name
            FROM sellers s
            LEFT JOIN branches b ON s.branch_id = b.id
            LEFT JOIN points_of_sale p ON s.pos_id = p.id
            WHERE s.company_id = ?
        `;
        let countQuery = `SELECT COUNT(*) as total FROM sellers WHERE company_id = ?`;
        const params = [req.company_id];
        const countParams = [req.company_id];

        if (search) {
            const searchPattern = `%${search}%`;
            query += ` AND s.nombre LIKE ?`;
            countQuery += ` AND nombre LIKE ?`;
            params.push(searchPattern);
            countParams.push(searchPattern);
        }

        query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        const [totalRows] = await pool.query(countQuery, countParams);

        res.json({
            data: rows,
            pagination: {
                total: totalRows[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalRows[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error in getSellers:', error);
        res.status(500).json({ message: 'Error al obtener vendedores' });
    }
};

const createSeller = async (req, res) => {
    const data = req.body;
    data.company_id = req.company_id;
    try {
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }
        const [result] = await pool.query('INSERT INTO sellers SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data, password: undefined });
    } catch (error) {
        console.error('Error in createSeller:', error);
        res.status(500).json({ message: 'Error al crear vendedor' });
    }
};

const updateSeller = async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    try {
        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }
        await pool.query('UPDATE sellers SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        res.json({ message: 'Vendedor actualizado' });
    } catch (error) {
        console.error('Error in updateSeller:', error);
        res.status(500).json({ message: 'Error al actualizar vendedor' });
    }
};

const deleteSeller = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM sellers WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Vendedor eliminado' });
    } catch (error) {
        console.error('Error in deleteSeller:', error);
        res.status(500).json({ message: 'Error al eliminar vendedor' });
    }
};

const loginPos = async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ message: 'La contraseña es obligatoria' });
    }

    try {
        const [sellers] = await pool.query(`
            SELECT s.*, p.nombre as pos_name, b.nombre as branch_name
            FROM sellers s
            LEFT JOIN points_of_sale p ON s.pos_id = p.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.company_id = ? AND s.status = 'activo'
        `, [req.company_id]);

        for (const seller of sellers) {
            const match = await bcrypt.compare(password, seller.password);
            if (match) {
                return res.json({
                    seller_id: seller.id,
                    seller_name: seller.nombre,
                    pos_id: seller.pos_id,
                    pos_name: seller.pos_name,
                    branch_id: seller.branch_id,
                    branch_name: seller.branch_name,
                    allow_price_edit: !!seller.allow_price_edit
                });
            }
        }

        res.status(401).json({ message: 'Contraseña incorrecta o vendedor inactivo' });
    } catch (error) {
        console.error('Error in loginPos:', error);
        res.status(500).json({ message: 'Error en la autenticación del vendedor' });
    }
};

module.exports = { getSellers, createSeller, updateSeller, deleteSeller, loginPos };
