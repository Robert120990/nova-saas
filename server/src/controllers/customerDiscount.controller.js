const pool = require('../config/db');

/**
 * Gestión de Descuentos Específicos por Cliente
 */

const getDiscounts = async (req, res) => {
    try {
        const { branch_id } = req.query;
        let query = `
            SELECT cd.*, c.nombre as customer_name, p.nombre as product_name, p.codigo as product_code, b.nombre as branch_name
            FROM customer_product_discounts cd
            JOIN customers c ON cd.customer_id = c.id
            JOIN products p ON cd.product_id = p.id
            JOIN branches b ON cd.branch_id = b.id
            WHERE cd.company_id = ?
        `;
        let params = [req.company_id];

        if (branch_id) {
            query += ` AND cd.branch_id = ?`;
            params.push(branch_id);
        }

        query += ` ORDER BY cd.created_at DESC`;
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error in getDiscounts:', error);
        res.status(500).json({ message: 'Error al obtener descuentos' });
    }
};

const createDiscount = async (req, res) => {
    const { customer_id, product_id, branch_id, discount_type, discount_value } = req.body;
    try {
        if (!branch_id) return res.status(400).json({ message: 'La sucursal es obligatoria' });

        // Verificar si ya existe una regla para este cliente, producto y sucursal
        const [existing] = await pool.query(
            'SELECT id FROM customer_product_discounts WHERE company_id = ? AND customer_id = ? AND product_id = ? AND branch_id = ?',
            [req.company_id, customer_id, product_id, branch_id]
        );

        if (existing.length > 0) {
            // Actualizar existente
            await pool.query(
                'UPDATE customer_product_discounts SET discount_type = ?, discount_value = ? WHERE id = ?',
                [discount_type, discount_value, existing[0].id]
            );
            return res.json({ message: 'Descuento actualizado exitosamente' });
        }

        await pool.query(`
            INSERT INTO customer_product_discounts (company_id, branch_id, customer_id, product_id, discount_type, discount_value)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [req.company_id, branch_id, customer_id, product_id, discount_type, discount_value]);
        
        res.status(201).json({ message: 'Descuento creado exitosamente' });
    } catch (error) {
        console.error('Error in createDiscount:', error);
        res.status(500).json({ message: 'Error al crear descuento' });
    }
};

const deleteDiscount = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM customer_product_discounts WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Descuento eliminado exitosamente' });
    } catch (error) {
        console.error('Error in deleteDiscount:', error);
        res.status(500).json({ message: 'Error al eliminar descuento' });
    }
};

module.exports = {
    getDiscounts,
    createDiscount,
    deleteDiscount
};
