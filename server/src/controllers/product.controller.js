const pool = require('../config/db');

const getProducts = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, branch_id } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT DISTINCT p.*, c.name as category_name, p2.nombre as discount_from_name
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN products p2 ON p.discount_from_id = p2.id
        `;
        let params = [];

        if (branch_id) {
            query += ` JOIN product_branch pb ON p.id = pb.product_id`;
        }

        query += ` WHERE p.company_id = ?`;
        params.push(req.company_id);

        if (branch_id) {
            query += ` AND pb.branch_id = ?`;
            params.push(branch_id);
        }

        if (search) {
            query += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.codigo LIKE ? OR p.codigo_barra LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY p.nombre ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        
        // Cargar sucursales, POS y tributos asociados para cada producto de la página actual
        const productsWithDetails = await Promise.all(rows.map(async (p) => {
            const [branches] = await pool.query('SELECT branch_id FROM product_branch WHERE product_id = ?', [p.id]);
            const [pos] = await pool.query('SELECT pos_id FROM product_pos WHERE product_id = ?', [p.id]);
            const [tributes] = await pool.query('SELECT tribute_code FROM product_tributes WHERE product_id = ?', [p.id]);
            return {
                ...p,
                branches: branches.map(b => b.branch_id),
                pos: pos.map(pos => pos.pos_id),
                tributes: tributes.map(t => t.tribute_code)
            };
        }));

        res.json({
            data: productsWithDetails,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener productos' });
    }
};

const createProduct = async (req, res) => {
    const { branches, pos, tributes, ...productData } = req.body;
    productData.company_id = req.company_id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [result] = await connection.query('INSERT INTO products SET ?', [productData]);
        const productId = result.insertId;

        if (branches && Array.isArray(branches) && branches.length > 0) {
            const values = branches.map(branchId => [productId, branchId]);
            await connection.query('INSERT INTO product_branch (product_id, branch_id) VALUES ?', [values]);
        }

        if (pos && Array.isArray(pos) && pos.length > 0) {
            const values = pos.map(posId => [productId, posId]);
            await connection.query('INSERT INTO product_pos (product_id, pos_id) VALUES ?', [values]);
        }

        if (tributes && Array.isArray(tributes) && tributes.length > 0) {
            const values = tributes.map(tcode => [productId, tcode]);
            await connection.query('INSERT INTO product_tributes (product_id, tribute_code) VALUES ?', [values]);
        }

        await connection.commit();
        res.status(201).json({ id: productId, ...productData });
    } catch (error) {
        await connection.rollback();
        console.error('Error al crear producto:', error.message);
        res.status(500).json({ message: 'Error al crear producto', details: error.message });
    } finally {
        connection.release();
    }
};

const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { branches, pos, tributes, ...productData } = req.body;
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        await connection.query('UPDATE products SET ? WHERE id = ? AND company_id = ?', [productData, id, req.company_id]);

        if (branches && Array.isArray(branches)) {
            await connection.query('DELETE FROM product_branch WHERE product_id = ?', [id]);
            if (branches.length > 0) {
                const values = branches.map(branchId => [id, branchId]);
                await connection.query('INSERT INTO product_branch (product_id, branch_id) VALUES ?', [values]);
            }
        }

        if (pos && Array.isArray(pos)) {
            await connection.query('DELETE FROM product_pos WHERE product_id = ?', [id]);
            if (pos.length > 0) {
                const values = pos.map(posId => [id, posId]);
                await connection.query('INSERT INTO product_pos (product_id, pos_id) VALUES ?', [values]);
            }
        }

        if (tributes && Array.isArray(tributes)) {
            await connection.query('DELETE FROM product_tributes WHERE product_id = ?', [id]);
            if (tributes.length > 0) {
                const values = tributes.map(tcode => [id, tcode]);
                await connection.query('INSERT INTO product_tributes (product_id, tribute_code) VALUES ?', [values]);
            }
        }

        await connection.commit();
        res.json({ message: 'Producto actualizado' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar producto' });
    } finally {
        connection.release();
    }
};

const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM products WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar producto' });
    }
};

const getFuelProducts = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.id, p.codigo, p.nombre, p.descripcion, p.precio_unitario, p.costo, p.tipo_combustible
            FROM products p
            WHERE p.company_id = ? AND p.tipo_combustible > 0
            ORDER BY p.nombre ASC
        `, [req.company_id]);
        
        res.json(rows);
    } catch (error) {
        console.error('Error in getFuelProducts:', error);
        res.status(500).json({ message: 'Error al obtener combustibles' });
    }
};

const updateFuelPrices = async (req, res) => {
    const { prices } = req.body; // Array of { id, precio_unitario }
    if (!prices || !Array.isArray(prices)) {
        return res.status(400).json({ message: 'Se requiere una lista de precios' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        for (const item of prices) {
            await connection.query(
                'UPDATE products SET precio_unitario = ? WHERE id = ? AND company_id = ?',
                [item.precio_unitario, item.id, req.company_id]
            );
        }
        await connection.commit();
        res.json({ message: 'Precios actualizados correctamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in updateFuelPrices:', error);
        res.status(500).json({ message: 'Error al actualizar precios' });
    } finally {
        connection.release();
    }
};

module.exports = { getProducts, createProduct, updateProduct, deleteProduct, getFuelProducts, updateFuelPrices };
