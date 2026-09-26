const pool = require('../config/db');

/**
 * Controlador de Gestión de Promociones Comerciales
 * (2x1 / N x M, 2da unidad con descuento, paquetes fijos, escalas por volumen)
 */

const getPromotions = async (req, res) => {
    try {
        const { search, status, branch_id, promotion_type } = req.query;
        let query = `
            SELECT sp.*, b.nombre as branch_name
            FROM sales_promotions sp
            LEFT JOIN branches b ON sp.branch_id = b.id
            WHERE sp.company_id = ?
        `;
        const params = [req.company_id];

        if (branch_id) {
            query += ' AND (sp.branch_id = ? OR sp.branch_id IS NULL)';
            params.push(branch_id);
        }

        if (promotion_type) {
            query += ' AND sp.promotion_type = ?';
            params.push(promotion_type);
        }

        if (status === 'active') {
            query += ' AND sp.active = 1 AND (sp.start_date IS NULL OR sp.start_date <= CURDATE()) AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())';
        } else if (status === 'inactive') {
            query += ' AND sp.active = 0';
        } else if (status === 'expired') {
            query += ' AND sp.end_date < CURDATE()';
        }

        if (search) {
            query += ' AND (sp.name LIKE ? OR sp.description LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term);
        }

        query += ' ORDER BY sp.created_at DESC';

        const [promotions] = await pool.query(query, params);

        if (promotions.length === 0) {
            return res.json([]);
        }

        // Obtener productos asociados a las promociones
        const promoIds = promotions.map(p => p.id);
        const [prodRows] = await pool.query(
            `SELECT spp.promotion_id, p.id as product_id, p.codigo, p.nombre
             FROM sales_promotion_products spp
             JOIN products p ON spp.product_id = p.id
             WHERE spp.promotion_id IN (?)`,
            [promoIds]
        );

        const productsByPromo = {};
        prodRows.forEach(row => {
            if (!productsByPromo[row.promotion_id]) {
                productsByPromo[row.promotion_id] = [];
            }
            productsByPromo[row.promotion_id].push({
                id: row.product_id,
                codigo: row.codigo,
                nombre: row.nombre
            });
        });

        const result = promotions.map(p => ({
            ...p,
            products: productsByPromo[p.id] || []
        }));

        res.json(result);
    } catch (error) {
        console.error('Error in getPromotions:', error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

const getPromotionById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT sp.*, b.nombre as branch_name
             FROM sales_promotions sp
             LEFT JOIN branches b ON sp.branch_id = b.id
             WHERE sp.id = ? AND sp.company_id = ?`,
            [id, req.company_id]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Promoción no encontrada' });
        }

        const promo = rows[0];

        const [products] = await pool.query(
            `SELECT p.id, p.codigo, p.nombre
             FROM sales_promotion_products spp
             JOIN products p ON spp.product_id = p.id
             WHERE spp.promotion_id = ?`,
            [id]
        );

        promo.products = products;
        promo.product_ids = products.map(p => p.id);

        res.json(promo);
    } catch (error) {
        console.error('Error in getPromotionById:', error);
        res.status(500).json({ message: 'Error al obtener detalle de la promoción' });
    }
};

const createPromotion = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const {
            name,
            description,
            branch_id,
            promotion_type,
            buy_quantity = 2,
            pay_quantity = 1,
            discount_percentage = null,
            bundle_price = null,
            start_date,
            end_date,
            days_of_week = '1,2,3,4,5,6,7',
            start_time,
            end_time,
            max_applications_per_sale,
            is_cumulative = false,
            active = true,
            product_ids = []
        } = req.body;

        if (!name || !name.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'El nombre de la promoción es obligatorio' });
        }

        if (!['nxm', 'second_unit_discount', 'bundle_fixed_price', 'volume_tier'].includes(promotion_type)) {
            await connection.rollback();
            return res.status(400).json({ message: 'Tipo de promoción no válido' });
        }

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe seleccionar al menos un producto participante' });
        }

        const buyQty = parseFloat(buy_quantity) || 1;
        const payQty = parseFloat(pay_quantity) || 1;
        const discPct = discount_percentage !== null && discount_percentage !== undefined ? parseFloat(discount_percentage) : null;
        const bPrice = bundle_price !== null && bundle_price !== undefined ? parseFloat(bundle_price) : null;

        // Validaciones por tipo
        if (promotion_type === 'nxm') {
            if (buyQty < 2 || payQty < 1 || buyQty <= payQty) {
                await connection.rollback();
                return res.status(400).json({ message: 'En promociones N x M, la cantidad a llevar debe ser mayor a la cantidad a pagar (ej: 2x1, 3x2)' });
            }
        } else if (promotion_type === 'second_unit_discount') {
            if (discPct === null || discPct <= 0 || discPct > 100) {
                await connection.rollback();
                return res.status(400).json({ message: 'Debe ingresar un porcentaje de descuento válido (entre 1% y 100%) para la segunda unidad' });
            }
        } else if (promotion_type === 'bundle_fixed_price') {
            if (bPrice === null || bPrice <= 0 || buyQty < 2) {
                await connection.rollback();
                return res.status(400).json({ message: 'Debe ingresar una cantidad mínima de productos y un precio total de paquete mayor a cero' });
            }
        } else if (promotion_type === 'volume_tier') {
            if (buyQty < 2 || (discPct === null && bPrice === null)) {
                await connection.rollback();
                return res.status(400).json({ message: 'En escala por volumen debe definir la cantidad mínima y un porcentaje de descuento o precio especial' });
            }
        }

        const [result] = await connection.query(
            `INSERT INTO sales_promotions (
                company_id, branch_id, name, description, promotion_type,
                buy_quantity, pay_quantity, discount_percentage, bundle_price,
                start_date, end_date, days_of_week, start_time, end_time,
                max_applications_per_sale, is_cumulative, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                req.company_id,
                branch_id ? parseInt(branch_id, 10) : null,
                name.trim(),
                description ? description.trim() : null,
                promotion_type,
                buyQty,
                payQty,
                discPct,
                bPrice,
                start_date || null,
                end_date || null,
                days_of_week || '1,2,3,4,5,6,7',
                start_time || null,
                end_time || null,
                max_applications_per_sale ? parseInt(max_applications_per_sale, 10) : null,
                is_cumulative ? 1 : 0,
                active ? 1 : 0
            ]
        );

        const promoId = result.insertId;

        // Insertar productos participantes
        const productValues = product_ids
            .map(pid => typeof pid === 'object' && pid !== null ? (pid.id || pid.product_id) : pid)
            .map(pid => parseInt(pid, 10))
            .filter(pid => pid && !isNaN(pid))
            .map(pid => [promoId, pid]);
        await connection.query(
            'INSERT INTO sales_promotion_products (promotion_id, product_id) VALUES ?',
            [productValues]
        );

        await connection.commit();
        res.status(201).json({ message: 'Promoción creada exitosamente', id: promoId });
    } catch (error) {
        await connection.rollback();
        console.error('Error in createPromotion:', error);
        res.status(500).json({ message: 'Error al crear la promoción' });
    } finally {
        connection.release();
    }
};

const updatePromotion = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { id } = req.params;
        const {
            name,
            description,
            branch_id,
            promotion_type,
            buy_quantity = 2,
            pay_quantity = 1,
            discount_percentage = null,
            bundle_price = null,
            start_date,
            end_date,
            days_of_week = '1,2,3,4,5,6,7',
            start_time,
            end_time,
            max_applications_per_sale,
            is_cumulative = false,
            active = true,
            product_ids = []
        } = req.body;

        const [existing] = await connection.query(
            'SELECT id FROM sales_promotions WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );

        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Promoción no encontrada' });
        }

        if (!name || !name.trim()) {
            await connection.rollback();
            return res.status(400).json({ message: 'El nombre de la promoción es obligatorio' });
        }

        if (!Array.isArray(product_ids) || product_ids.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe seleccionar al menos un producto participante' });
        }

        const buyQty = parseFloat(buy_quantity) || 1;
        const payQty = parseFloat(pay_quantity) || 1;
        const discPct = discount_percentage !== null && discount_percentage !== undefined ? parseFloat(discount_percentage) : null;
        const bPrice = bundle_price !== null && bundle_price !== undefined ? parseFloat(bundle_price) : null;

        await connection.query(
            `UPDATE sales_promotions SET
                branch_id = ?,
                name = ?,
                description = ?,
                promotion_type = ?,
                buy_quantity = ?,
                pay_quantity = ?,
                discount_percentage = ?,
                bundle_price = ?,
                start_date = ?,
                end_date = ?,
                days_of_week = ?,
                start_time = ?,
                end_time = ?,
                max_applications_per_sale = ?,
                is_cumulative = ?,
                active = ?,
                updated_at = NOW()
            WHERE id = ? AND company_id = ?`,
            [
                branch_id ? parseInt(branch_id, 10) : null,
                name.trim(),
                description ? description.trim() : null,
                promotion_type,
                buyQty,
                payQty,
                discPct,
                bPrice,
                start_date || null,
                end_date || null,
                days_of_week || '1,2,3,4,5,6,7',
                start_time || null,
                end_time || null,
                max_applications_per_sale ? parseInt(max_applications_per_sale, 10) : null,
                is_cumulative ? 1 : 0,
                active ? 1 : 0,
                id,
                req.company_id
            ]
        );

        // Actualizar productos participantes
        await connection.query('DELETE FROM sales_promotion_products WHERE promotion_id = ?', [id]);
        const productValues = product_ids
            .map(pid => typeof pid === 'object' && pid !== null ? (pid.id || pid.product_id) : pid)
            .map(pid => parseInt(pid, 10))
            .filter(pid => pid && !isNaN(pid))
            .map(pid => [id, pid]);
        await connection.query(
            'INSERT INTO sales_promotion_products (promotion_id, product_id) VALUES ?',
            [productValues]
        );

        await connection.commit();
        res.json({ message: 'Promoción actualizada exitosamente' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in updatePromotion:', error);
        res.status(500).json({ message: 'Error al actualizar la promoción' });
    } finally {
        connection.release();
    }
};

const deletePromotion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            'DELETE FROM sales_promotions WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Promoción no encontrada' });
        }

        res.json({ message: 'Promoción eliminada exitosamente' });
    } catch (error) {
        console.error('Error in deletePromotion:', error);
        res.status(500).json({ message: 'Error al eliminar la promoción' });
    }
};

/**
 * Endpoint optimizado para el Terminal POS
 * Devuelve todas las promociones activas vigentes aplicables a la sucursal del usuario
 */
const getActivePromotionsForPos = async (req, res) => {
    try {
        const userBranchId = req.user?.branch_id || req.query.branch_id || null;

        let query = `
            SELECT sp.*
            FROM sales_promotions sp
            WHERE sp.company_id = ?
              AND sp.active = 1
              AND (sp.start_date IS NULL OR sp.start_date <= CURDATE())
              AND (sp.end_date IS NULL OR sp.end_date >= CURDATE())
        `;
        const params = [req.company_id];

        if (userBranchId) {
            query += ' AND (sp.branch_id IS NULL OR sp.branch_id = ?)';
            params.push(userBranchId);
        }

        query += ' ORDER BY sp.id ASC';

        const [promos] = await pool.query(query, params);

        if (promos.length === 0) {
            return res.json([]);
        }

        const promoIds = promos.map(p => p.id);
        const [prodRows] = await pool.query(
            `SELECT spp.promotion_id, spp.product_id
             FROM sales_promotion_products spp
             WHERE spp.promotion_id IN (?)`,
            [promoIds]
        );

        const productsByPromo = {};
        prodRows.forEach(row => {
            if (!productsByPromo[row.promotion_id]) {
                productsByPromo[row.promotion_id] = [];
            }
            productsByPromo[row.promotion_id].push(row.product_id);
        });

        const activePromos = promos.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            promotion_type: p.promotion_type,
            buy_quantity: parseFloat(p.buy_quantity) || 1,
            pay_quantity: parseFloat(p.pay_quantity) || 1,
            discount_percentage: p.discount_percentage ? parseFloat(p.discount_percentage) : null,
            bundle_price: p.bundle_price ? parseFloat(p.bundle_price) : null,
            days_of_week: p.days_of_week ? p.days_of_week.split(',').map(d => parseInt(d.trim(), 10)) : [1, 2, 3, 4, 5, 6, 7],
            start_time: p.start_time,
            end_time: p.end_time,
            max_applications_per_sale: p.max_applications_per_sale ? parseInt(p.max_applications_per_sale, 10) : null,
            is_cumulative: Boolean(p.is_cumulative),
            product_ids: productsByPromo[p.id] || []
        }));

        res.json(activePromos);
    } catch (error) {
        console.error('Error in getActivePromotionsForPos:', error);
        res.status(500).json({ message: 'Error al obtener promociones activas' });
    }
};

module.exports = {
    getPromotions,
    getPromotionById,
    createPromotion,
    updatePromotion,
    deletePromotion,
    getActivePromotionsForPos
};
