const pool = require('../config/db');

const getPOS = async (req, res) => {
    const { branch_id, status, include_inactive } = req.query;
    try {
        let sql = `
            SELECT p.*, b.nombre AS branch_name,
                (
                    (SELECT COUNT(*) FROM sales_headers sh WHERE sh.pos_id = p.id) +
                    (SELECT COUNT(*) FROM pos_shifts ps WHERE ps.pos_id = p.id)
                ) AS records_count
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
        } else if (include_inactive !== 'true' && include_inactive !== '1') {
            sql += ` AND p.status = 'activo'`;
        }

        sql += ` ORDER BY p.branch_id ASC, p.codigo ASC`;

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error getPOS:', error);
        res.status(500).json({ message: 'Error al obtener puntos de venta' });
    }
};

const createPOS = async (req, res) => {
    const data = { ...req.body };
    data.company_id = req.company_id;
    if (data.allow_discounts !== undefined) {
        data.allow_discounts = (data.allow_discounts === true || data.allow_discounts === 'true' || data.allow_discounts === 1 || data.allow_discounts === '1' || data.allow_discounts === 'on') ? 1 : 0;
    } else {
        data.allow_discounts = 0;
    }
    try {
        const [result] = await pool.query('INSERT INTO points_of_sale SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear punto de venta' });
    }
};

const updatePOS = async (req, res) => {
    const { id } = req.params;
    const data = { ...req.body };
    if (data.allow_discounts !== undefined) {
        data.allow_discounts = (data.allow_discounts === true || data.allow_discounts === 'true' || data.allow_discounts === 1 || data.allow_discounts === '1' || data.allow_discounts === 'on') ? 1 : 0;
    }
    try {
        await pool.query('UPDATE points_of_sale SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        res.json({ message: 'Punto de venta actualizado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar punto de venta' });
    }
};

const deletePOS = async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.query(
            'SELECT id FROM points_of_sale WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (existing.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Punto de venta no encontrado' });
        }

        const [[salesCount]] = await conn.query(
            'SELECT COUNT(*) AS count FROM sales_headers WHERE pos_id = ?',
            [id]
        );
        const [[shiftsCount]] = await conn.query(
            'SELECT COUNT(*) AS count FROM pos_shifts WHERE pos_id = ?',
            [id]
        );
        const totalRecords = Number(salesCount.count || 0) + Number(shiftsCount.count || 0);

        // Limpiar asignaciones de productos y vendedores que no son registros históricos
        await conn.query('DELETE FROM product_pos WHERE pos_id = ?', [id]);
        await conn.query('UPDATE sellers SET pos_id = NULL WHERE pos_id = ?', [id]);

        if (totalRecords === 0) {
            await conn.query('DELETE FROM points_of_sale WHERE id = ? AND company_id = ?', [id, req.company_id]);
            await conn.commit();
            return res.json({
                action: 'deleted',
                message: 'Punto de venta eliminado permanentemente'
            });
        } else {
            await conn.query(
                'UPDATE points_of_sale SET status = ? WHERE id = ? AND company_id = ?',
                ['inactivo', id, req.company_id]
            );
            await conn.commit();
            return res.json({
                action: 'deactivated',
                message: 'El punto de venta tiene registros asociados y ha sido desactivado.'
            });
        }
    } catch (error) {
        await conn.rollback();
        console.error('Error deletePOS:', error);
        res.status(500).json({ message: 'Error al procesar eliminación del punto de venta' });
    } finally {
        conn.release();
    }
};

module.exports = { getPOS, createPOS, updatePOS, deletePOS };

