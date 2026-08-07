const pool = require('../config/db');

const getProducts = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, branch_id, pos_id, category_id, status } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT DISTINCT p.id, p.company_id, p.codigo, p.codigo_barra, p.nombre, p.descripcion,
                   p.costo, p.unidad_medida, p.tipo_item, p.category_id, p.provider_id,
                   p.tipo_combustible, p.tipo_operacion, p.stock_minimo, p.afecta_inventario,
                   p.permitir_existencia_negativa, p.discount_from_id, p.status, p.created_at,
                   COALESCE(pbp.precio_unitario, 0) as precio_unitario,
                   c.name as category_name, p2.nombre as discount_from_name
            FROM products p
            LEFT JOIN product_categories c ON p.category_id = c.id
            LEFT JOIN products p2 ON p.discount_from_id = p2.id
        `;
        let params = [];

        if (branch_id) {
            query += ` JOIN product_branch pb ON p.id = pb.product_id`;
            query += ` LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?`;
            params.push(branch_id);
        } else {
            query += ` LEFT JOIN product_branch_prices pbp ON FALSE`;
        }

        if (pos_id) {
            query += ` LEFT JOIN product_pos pp ON p.id = pp.product_id`;
        }

        query += ` WHERE p.company_id = ?`;
        params.push(req.company_id);

        if (branch_id) {
            query += ` AND pb.branch_id = ?`;
            params.push(branch_id);
        }

        if (pos_id) {
            query += ` AND (pp.pos_id = ? OR pp.pos_id IS NULL)`;
            params.push(pos_id);
        }

        if (search) {
            query += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ? OR p.codigo LIKE ? OR p.codigo_barra LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (category_id) {
            query += ` AND p.category_id = ?`;
            params.push(category_id);
        }

        if (status) {
            query += ` AND p.status = ?`;
            params.push(status);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY p.nombre ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        
        // Cargar sucursales, POS, tributos y precios por sucursal para cada producto
        const productsWithDetails = await Promise.all(rows.map(async (p) => {
            const [branches] = await pool.query('SELECT branch_id FROM product_branch WHERE product_id = ?', [p.id]);
            const [pos] = await pool.query('SELECT pos_id FROM product_pos WHERE product_id = ?', [p.id]);
            const [tributes] = await pool.query('SELECT tribute_code FROM product_tributes WHERE product_id = ?', [p.id]);
            const [branchPrices] = await pool.query(
                'SELECT branch_id, precio_unitario FROM product_branch_prices WHERE product_id = ?', [p.id]
            );
            const branchPricesMap = {};
            branchPrices.forEach(bp => { branchPricesMap[bp.branch_id] = bp.precio_unitario; });
            return {
                ...p,
                branches: branches.map(b => b.branch_id),
                branchPrices: branchPricesMap,
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
        const [existing] = await connection.query(
            'SELECT id FROM products WHERE company_id = ? AND codigo = ?',
            [productData.company_id, productData.codigo]
        );
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'Ya existe un producto con este código' });
        }

        const [result] = await connection.query('INSERT INTO products SET ?', [productData]);
        const productId = result.insertId;

        if (branches && Array.isArray(branches) && branches.length > 0) {
            const branchValues = branches.map(b => [productId, b.branch_id]);
            await connection.query('INSERT INTO product_branch (product_id, branch_id) VALUES ?', [branchValues]);

            const priceValues = branches.map(b => [productId, b.branch_id, b.precio_unitario || 0]);
            await connection.query(
                'INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES ?',
                [priceValues]
            );
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
            await connection.query('DELETE FROM product_branch_prices WHERE product_id = ?', [id]);
            await connection.query('DELETE FROM product_branch WHERE product_id = ?', [id]);
            if (branches.length > 0) {
                const branchValues = branches.map(b => [id, b.branch_id]);
                await connection.query('INSERT INTO product_branch (product_id, branch_id) VALUES ?', [branchValues]);

                const priceValues = branches.map(b => [id, b.branch_id, b.precio_unitario || 0]);
                await connection.query(
                    'INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES ?',
                    [priceValues]
                );
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

const lookupProduct = async (req, res) => {
    try {
        const { code } = req.params;
        const { branch_id, pos_id } = req.query;
        let query = `
            SELECT p.id, p.company_id, p.codigo, p.codigo_barra, p.nombre, p.descripcion,
                   p.costo, p.unidad_medida, p.tipo_item, p.category_id, p.provider_id,
                   p.tipo_combustible, p.tipo_operacion, p.stock_minimo, p.afecta_inventario,
                   p.permitir_existencia_negativa, p.discount_from_id, p.status, p.created_at,
                   COALESCE(pbp.precio_unitario, 0) as precio_unitario
            FROM products p
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = pb.branch_id
            WHERE p.company_id = ? AND (p.codigo = ? OR p.codigo_barra = ?)
        `;
        let params = [branch_id, req.company_id, code, code];

        if (pos_id) {
            query += ` AND (NOT EXISTS (SELECT 1 FROM product_pos pp WHERE pp.product_id = p.id)
                            OR EXISTS (SELECT 1 FROM product_pos pp WHERE pp.product_id = p.id AND pp.pos_id = ?))`;
            params.push(pos_id);
        }

        query += ` LIMIT 1`;
        const [rows] = await pool.query(query, params);
        if (rows.length === 0) return res.status(404).json({ message: 'Producto no encontrado' });

        const [branches] = await pool.query('SELECT branch_id FROM product_branch WHERE product_id = ?', [rows[0].id]);
        res.json({ ...rows[0], branches: branches.map(b => b.branch_id) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const [[usage]] = await pool.query(`
            SELECT
                EXISTS(SELECT 1 FROM sales_items WHERE product_id = ?) AS in_sales,
                EXISTS(SELECT 1 FROM purchase_items WHERE product_id = ?) AS in_purchases,
                EXISTS(SELECT 1 FROM inventory_movements WHERE product_id = ?) AS in_movements,
                EXISTS(SELECT 1 FROM inventory_adjustment_items WHERE product_id = ?) AS in_adjustments,
                EXISTS(SELECT 1 FROM product_combo_items WHERE product_id = ?) AS in_combos
        `, [id, id, id, id, id]);

        const hasUsage = usage.in_sales || usage.in_purchases || usage.in_movements
                      || usage.in_adjustments || usage.in_combos;

        if (hasUsage) {
            await pool.query('UPDATE products SET status = ? WHERE id = ? AND company_id = ?', ['inactivo', id, req.company_id]);
            res.json({ message: 'Producto desactivado (tiene historial de uso)' });
        } else {
            await pool.query('DELETE FROM products WHERE id = ? AND company_id = ?', [id, req.company_id]);
            res.json({ message: 'Producto eliminado permanentemente' });
        }
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ message: 'Error al eliminar producto' });
    }
};

const getFuelProducts = async (req, res) => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id || null;
        const [rows] = await pool.query(`
            SELECT p.id, p.codigo, p.nombre, p.descripcion,
                   COALESCE(pbp.precio_unitario, 0) as precio_unitario,
                   p.costo, p.tipo_combustible
            FROM products p
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            ORDER BY p.nombre ASC
        `, [branchId, req.company_id]);
        
        res.json(rows);
    } catch (error) {
        console.error('Error in getFuelProducts:', error);
        res.status(500).json({ message: 'Error al obtener combustibles' });
    }
};

const updateFuelPrices = async (req, res) => {
    const { prices, branch_id } = req.body;
    if (!prices || !Array.isArray(prices)) {
        return res.status(400).json({ message: 'Se requiere una lista de precios' });
    }
    if (!branch_id) {
        return res.status(400).json({ message: 'Se requiere branch_id' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        for (const item of prices) {
            await connection.query(
                `INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE precio_unitario = ?`,
                [item.id, branch_id, item.precio_unitario, item.precio_unitario]
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

const getLubricantProducts = async (req, res) => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id || null;

        const [settings] = await pool.query(
            `SELECT setting_value FROM gas_station_settings WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL)) AND setting_key = 'lubricant_category_id'`,
            [req.company_id, branchId, branchId]
        );
        const categoryId = settings[0]?.setting_value;
        if (!categoryId) {
            return res.json([]);
        }

        const [products] = await pool.query(`
            SELECT p.id, p.codigo, p.nombre AS descripcion, COALESCE(pbp.precio_unitario, 0) as precio_unitario
            FROM products p
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            WHERE p.company_id = ? AND p.category_id = ? AND p.status = 'activo'
            ORDER BY p.codigo ASC
        `, [branchId, branchId, req.company_id, categoryId]);

        if (products.length === 0) return res.json([]);

        const [lastReadings] = await pool.query(`
            SELECT lr.producto_id, lr.lectura_final
            FROM gas_station_closeout_lubricant_readings lr
            WHERE lr.closeout_id = (
                SELECT c2.id FROM gas_station_closeouts c2
                WHERE c2.company_id = ? AND c2.estado = 'cerrado'
                AND (c2.branch_id = ? OR (? IS NULL AND c2.branch_id IS NULL))
                ORDER BY c2.id DESC LIMIT 1
            )
        `, [req.company_id, branchId, branchId]);

        const lastReadingMap = {};
        lastReadings.forEach(r => {
            if (!lastReadingMap[r.producto_id]) {
                lastReadingMap[r.producto_id] = parseFloat(r.lectura_final) || 0;
            }
        });

        const result = products.map(p => ({
            ...p,
            lectura_inicial: lastReadingMap[p.id] || 0,
        }));

        res.json(result);
    } catch (error) {
        console.error('Error in getLubricantProducts:', error);
        res.status(500).json({ message: 'Error al obtener lubricantes' });
    }
};

module.exports = { getProducts, lookupProduct, createProduct, updateProduct, deleteProduct, getFuelProducts, updateFuelPrices, getLubricantProducts };
