const { pool } = require('./shared');

const deleteEggCustomerOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        await pool.query(
            'DELETE FROM egg_customer_orders WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        res.json({ message: 'Pedido eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar pedido de ovoproductos:', error);
        res.status(500).json({ message: error.message });
    }
};

const getCustomerPricingForOrder = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { customer_id, customer_name, product_type, presentation } = req.query;

        if (!customer_id && !customer_name) {
            return res.json({ price_per_lb: 0, source: null, description: 'Cliente no especificado.' });
        }

        const resolvedCustomerId = customer_id ? parseInt(customer_id) : null;
        const resolvedCustomerName = (customer_name || '').trim();

        // 1. Buscar en Acuerdos Comerciales del CRM (egg_costing_customer_agreements)
        let agreementQuery = `
            SELECT agreed_price_per_lb, agreed_unit_price, product_type, presentation, notes
            FROM egg_costing_customer_agreements
            WHERE company_id = ?
              AND status = 'activo'
              AND (valid_from IS NULL OR valid_from <= CURDATE())
              AND (valid_to IS NULL OR valid_to >= CURDATE())
              AND (
                  (customer_id IS NOT NULL AND customer_id = ?)
                  OR (customer_name IS NOT NULL AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?)))
              )
        `;
        const agreementParams = [company_id, resolvedCustomerId || 0, resolvedCustomerName];

        if (product_type) {
            agreementQuery += `
                AND (
                    product_type = ?
                    OR LOWER(product_type) LIKE LOWER(?)
                    OR LOWER(?) LIKE CONCAT('%', LOWER(product_type), '%')
                )
            `;
            agreementParams.push(product_type, `%${product_type}%`, product_type);
        }

        if (presentation) {
            agreementQuery += `
                AND (
                    presentation = ?
                    OR LOWER(presentation) LIKE LOWER(?)
                    OR LOWER(?) LIKE CONCAT('%', LOWER(presentation), '%')
                )
            `;
            agreementParams.push(presentation, `%${presentation}%`, presentation);
        }

        agreementQuery += ` ORDER BY updated_at DESC LIMIT 1`;
        const [agreements] = await pool.query(agreementQuery, agreementParams);

        if (agreements.length > 0 && parseFloat(agreements[0].agreed_price_per_lb) > 0) {
            const price = parseFloat(agreements[0].agreed_price_per_lb);
            const unitPrice = agreements[0].agreed_unit_price ? parseFloat(agreements[0].agreed_unit_price) : null;
            return res.json({
                price_per_lb: price,
                unit_price: unitPrice,
                source: 'crm',
                description: `Acuerdo Comercial CRM: $${price.toFixed(2)}/lb${unitPrice ? ` ($${unitPrice.toFixed(2)}/ud)` : ''}`,
                agreement: agreements[0]
            });
        }

        // 2. Si no hay CRM, buscar el último pedido del cliente en egg_customer_orders
        let orderQuery = `
            SELECT price_per_lb, product_type, presentation, required_delivery_date, created_at
            FROM egg_customer_orders
            WHERE company_id = ?
              AND price_per_lb > 0
              AND (
                  (customer_id IS NOT NULL AND customer_id = ?)
                  OR (customer_name IS NOT NULL AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?)))
              )
        `;
        const orderParams = [company_id, resolvedCustomerId || 0, resolvedCustomerName];

        if (product_type) {
            orderQuery += `
                AND (
                    product_type = ?
                    OR LOWER(product_type) LIKE LOWER(?)
                    OR LOWER(?) LIKE CONCAT('%', LOWER(product_type), '%')
                )
            `;
            orderParams.push(product_type, `%${product_type}%`, product_type);
        }

        if (presentation) {
            orderQuery += `
                AND (
                    presentation = ?
                    OR LOWER(presentation) LIKE LOWER(?)
                    OR LOWER(?) LIKE CONCAT('%', LOWER(presentation), '%')
                )
            `;
            orderParams.push(presentation, `%${presentation}%`, presentation);
        }

        orderQuery += ` ORDER BY created_at DESC LIMIT 1`;
        const [lastOrders] = await pool.query(orderQuery, orderParams);

        if (lastOrders.length > 0 && parseFloat(lastOrders[0].price_per_lb) > 0) {
            const price = parseFloat(lastOrders[0].price_per_lb);
            const dateStr = lastOrders[0].created_at ? new Date(lastOrders[0].created_at).toISOString().split('T')[0] : '';
            return res.json({
                price_per_lb: price,
                source: 'last_order',
                description: `Último pedido registrado (${dateStr}): $${price.toFixed(2)}/lb`,
                order: lastOrders[0]
            });
        }

        // 3. Buscar en el historial de facturación de ventas (sales_headers + sales_items)
        let saleQuery = `
            SELECT si.precio_unitario, si.cantidad, si.descripcion, sh.fecha_emision, sh.created_at
            FROM sales_headers sh
            JOIN sales_items si ON sh.id = si.sale_id
            WHERE sh.company_id = ?
              AND sh.estado != 'anulado'
              AND (
                  (sh.customer_id IS NOT NULL AND sh.customer_id = ?)
                  OR (sh.cliente_nombre IS NOT NULL AND LOWER(TRIM(sh.cliente_nombre)) = LOWER(TRIM(?)))
              )
        `;
        const saleParams = [company_id, resolvedCustomerId || 0, resolvedCustomerName];

        if (product_type) {
            saleQuery += ` AND LOWER(si.descripcion) LIKE LOWER(?)`;
            saleParams.push(`%${product_type}%`);
        }

        saleQuery += ` ORDER BY sh.id DESC LIMIT 1`;
        const [sales] = await pool.query(saleQuery, saleParams);

        if (sales.length > 0 && parseFloat(sales[0].precio_unitario) > 0) {
            let unitPrice = parseFloat(sales[0].precio_unitario);
            let factorLbs = 1;
            const desc = (sales[0].descripcion || '').toLowerCase();
            if (desc.includes('32')) factorLbs = 32;
            else if (desc.includes('30')) factorLbs = 30;
            else if (desc.includes('8') || desc.includes('galon') || desc.includes('galón')) factorLbs = 8;
            else if (desc.includes('4') || desc.includes('medio')) factorLbs = 4;
            else if (desc.includes('2') || desc.includes('litro')) factorLbs = 2;

            const pricePerLb = factorLbs > 1 ? parseFloat((unitPrice / factorLbs).toFixed(4)) : unitPrice;
            const dateStr = sales[0].fecha_emision || sales[0].created_at ? new Date(sales[0].fecha_emision || sales[0].created_at).toISOString().split('T')[0] : '';
            return res.json({
                price_per_lb: pricePerLb,
                source: 'last_sale',
                description: `Última factura (${dateStr}): $${pricePerLb.toFixed(2)}/lb`,
                sale: sales[0]
            });
        }

        return res.json({
            price_per_lb: 0,
            source: null,
            description: 'Sin precio previo registrado.'
        });
    } catch (error) {
        console.error('Error al obtener precio de cliente para ovoproductos:', error);
        res.status(500).json({ message: error.message });
    }
};

const getFactoryUsers = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const [users] = await pool.query(
            `SELECT u.id, u.username, u.nombre, r.name as role_name
             FROM users u
             INNER JOIN usuario_empresa ue ON u.id = ue.usuario_id
             LEFT JOIN roles r ON ue.role_id = r.id
             WHERE u.status = 'activo' AND ue.empresa_id = ?
             ORDER BY u.nombre ASC`,
            [company_id]
        );
        res.json(users);
    } catch (error) {
        console.error('Error al obtener usuarios de fábrica:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { deleteEggCustomerOrder, getCustomerPricingForOrder, getFactoryUsers };
