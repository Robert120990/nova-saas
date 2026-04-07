const pool = require('../config/db');

/**
 * Obtiene la lista de combos para la empresa actual.
 */
const getCombos = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, branch_id } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT pc.*, b.nombre as branch_name
            FROM product_combos pc
            LEFT JOIN branches b ON pc.branch_id = b.id
            WHERE pc.company_id = ?
        `;
        let params = [req.company_id];

        if (branch_id) {
            query += ` AND pc.branch_id = ?`;
            params.push(branch_id);
        }

        if (search) {
            query += ` AND (pc.name LIKE ? OR pc.barcode LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        query += ` ORDER BY pc.name ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        // Cargar los items de cada combo
        const combosWithItems = await Promise.all(rows.map(async (combo) => {
            const [items] = await pool.query(`
                SELECT pci.*, p.nombre as product_name, p.codigo as product_code, p.precio_unitario
                FROM product_combo_items pci
                JOIN products p ON pci.product_id = p.id
                WHERE pci.combo_id = ?
            `, [combo.id]);
            return { ...combo, items };
        }));

        res.json({
            data: combosWithItems,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('[Combos] Error al obtener combos:', error);
        res.status(500).json({ message: 'Error al obtener combos' });
    }
};

/**
 * Crea un nuevo combo.
 */
const createCombo = async (req, res) => {
    const { name, barcode, description, price, items, status, branch_id } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'El combo debe tener al menos un producto' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const [result] = await connection.query('INSERT INTO product_combos SET ?', {
            company_id: req.company_id,
            branch_id: branch_id || null,
            barcode,
            name,
            description,
            price,
            status: status || 'active'
        });
        const comboId = result.insertId;

        const itemValues = items.map(item => [comboId, item.product_id, item.quantity]);
        await connection.query('INSERT INTO product_combo_items (combo_id, product_id, quantity) VALUES ?', [itemValues]);

        await connection.commit();
        res.status(201).json({ id: comboId, message: 'Combo creado con éxito' });
    } catch (error) {
        await connection.rollback();
        console.error('[Combos] Error al crear combo:', error);
        res.status(500).json({ message: 'Error al crear combo', details: error.message });
    } finally {
        connection.release();
    }
};

/**
 * Actualiza un combo existente.
 */
const updateCombo = async (req, res) => {
    const { id } = req.params;
    const { name, barcode, description, price, items, status, branch_id } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        await connection.query('UPDATE product_combos SET ? WHERE id = ? AND company_id = ?', [
            { name, barcode, description, price, status, branch_id },
            id,
            req.company_id
        ]);

        if (items && Array.isArray(items)) {
            await connection.query('DELETE FROM product_combo_items WHERE combo_id = ?', [id]);
            if (items.length > 0) {
                const itemValues = items.map(item => [id, item.product_id, item.quantity]);
                await connection.query('INSERT INTO product_combo_items (combo_id, product_id, quantity) VALUES ?', [itemValues]);
            }
        }

        await connection.commit();
        res.json({ message: 'Combo actualizado con éxito' });
    } catch (error) {
        await connection.rollback();
        console.error('[Combos] Error al actualizar combo:', error);
        res.status(500).json({ message: 'Error al actualizar combo' });
    } finally {
        connection.release();
    }
};

/**
 * Elimina un combo.
 */
const deleteCombo = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM product_combos WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Combo eliminado con éxito' });
    } catch (error) {
        console.error('[Combos] Error al eliminar combo:', error);
        res.status(500).json({ message: 'Error al eliminar combo' });
    }
};

module.exports = { getCombos, createCombo, updateCombo, deleteCombo };
