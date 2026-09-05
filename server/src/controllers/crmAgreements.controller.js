const pool = require('../config/db');

/**
 * Controlador de CRM: Acuerdos Comerciales de Precios con Clientes
 * Permite la gestión y mantenimiento integral de acuerdos de precios
 * y la consulta rápida en tiempo de facturación en el Punto de Venta.
 */

// 1. Obtener listado con métricas/KPIs y filtros
const getAgreements = async (req, res) => {
    try {
        const companyId = req.company_id || req.companyId || req.user?.company_id || 1;
        const { search = '', status = '', page = 1, limit = 50 } = req.query;

        let query = `
            SELECT 
                a.*,
                c.nombre as customer_registered_name,
                c.nit as customer_nit,
                c.nrc as customer_nrc,
                c.telefono as customer_phone,
                c.correo as customer_email,
                p.codigo as product_code,
                p.nombre as catalog_product_name,
                COALESCE(pbp.precio_unitario, 0) as catalog_base_price
            FROM egg_costing_customer_agreements a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN products p ON a.product_id = p.id
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id
            WHERE a.company_id = ?
        `;
        const params = [companyId];

        if (status && status !== 'todos') {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        if (search && search.trim()) {
            const term = `%${search.trim()}%`;
            query += ` AND (
                a.customer_name LIKE ? OR 
                c.nombre LIKE ? OR 
                a.product_type LIKE ? OR 
                a.presentation LIKE ? OR 
                p.nombre LIKE ? OR 
                p.codigo LIKE ? OR 
                a.notes LIKE ?
            )`;
            params.push(term, term, term, term, term, term, term);
        }

        query += ` GROUP BY a.id ORDER BY a.status ASC, a.updated_at DESC`;

        const [rows] = await pool.query(query, params);

        // Calcular KPIs en vivo para el encabezado del CRM
        const [kpiRows] = await pool.query(`
            SELECT 
                COUNT(*) as total_agreements,
                SUM(CASE WHEN status = 'activo' THEN 1 ELSE 0 END) as active_agreements,
                COUNT(DISTINCT customer_id) as distinct_customers,
                COALESCE(SUM(CASE WHEN status = 'activo' THEN monthly_volume_lbs ELSE 0 END), 0) as total_active_volume_lbs,
                COALESCE(AVG(CASE WHEN status = 'activo' THEN target_margin_pct ELSE NULL END), 0) as avg_target_margin
            FROM egg_costing_customer_agreements
            WHERE company_id = ?
        `, [companyId]);

        res.json({
            data: rows,
            total: rows.length,
            kpis: kpiRows[0] || {
                total_agreements: 0,
                active_agreements: 0,
                distinct_customers: 0,
                total_active_volume_lbs: 0,
                avg_target_margin: 0
            }
        });
    } catch (error) {
        console.error('Error al obtener acuerdos de CRM:', error);
        res.status(500).json({ message: 'Error interno al obtener acuerdos comerciales.' });
    }
};

// 2. Consulta ultrarrápida para Punto de Venta / Facturación
const getActiveAgreementsByCustomer = async (req, res) => {
    try {
        const companyId = req.company_id || req.companyId || req.user?.company_id || 1;
        const { customerId } = req.params;

        if (!customerId) {
            return res.json([]);
        }

        // Obtener nombre del cliente para matching de respaldo en caso de que algún acuerdo histórico no tenga customer_id seteado
        const [cRows] = await pool.query('SELECT nombre FROM customers WHERE id = ? AND company_id = ?', [customerId, companyId]);
        const customerName = cRows[0]?.nombre || '';

        let query = `
            SELECT 
                a.id,
                a.customer_id,
                a.customer_name,
                a.product_id,
                p.codigo as product_code,
                p.nombre as product_name,
                a.product_type,
                a.presentation,
                a.agreed_price_per_lb,
                a.agreed_unit_price,
                a.payment_terms_days,
                a.notes
            FROM egg_costing_customer_agreements a
            LEFT JOIN products p ON a.product_id = p.id
            WHERE a.company_id = ? 
              AND a.status = 'activo'
              AND (
                  a.customer_id = ?
                  ${customerName ? `OR (a.customer_id IS NULL AND a.customer_name = ?)` : ''}
              )
        `;
        const params = [companyId, customerId];
        if (customerName) params.push(customerName);

        const [rows] = await pool.query(query, params);

        // Si algún acuerdo no tiene agreed_unit_price, calcularlo al vuelo según la presentación
        const formatted = rows.map(r => {
            let unitPrice = parseFloat(r.agreed_unit_price);
            if (isNaN(unitPrice) || unitPrice <= 0) {
                const pricePerLb = parseFloat(r.agreed_price_per_lb) || 0;
                let lbs = 1;
                const text = `${r.presentation || ''} ${r.product_name || ''} ${r.product_type || ''}`.toLowerCase();
                const m = text.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
                if (m) {
                    lbs = parseFloat(m[1]) || 1;
                } else if (text.includes('galón') || text.includes('galon')) {
                    lbs = 8;
                } else if (text.includes('litro')) {
                    lbs = 2;
                }
                unitPrice = pricePerLb * lbs;
            }
            return {
                ...r,
                effective_unit_price: parseFloat(unitPrice.toFixed(4))
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('Error al obtener acuerdos activos para facturación:', error);
        res.status(500).json({ message: 'Error al consultar acuerdos de cliente.' });
    }
};

// 3. Crear o actualizar acuerdo comercial
const saveAgreement = async (req, res) => {
    try {
        const companyId = req.company_id || req.companyId || req.user?.company_id || 1;
        const {
            id,
            customer_id,
            customer_name,
            product_id,
            product_type,
            presentation,
            agreed_price_per_lb,
            agreed_unit_price,
            monthly_volume_lbs,
            target_margin_pct,
            freight_cost_per_lb,
            payment_terms_days,
            notes,
            status
        } = req.body;

        if (!customer_name || !customer_name.trim()) {
            return res.status(400).json({ message: 'El nombre del cliente es obligatorio.' });
        }

        const pricePerLb = parseFloat(agreed_price_per_lb) || 0;
        let unitPrice = parseFloat(agreed_unit_price);

        // Si no se proveyó precio unitario directo, calcularlo a partir de la presentación y $/Lb
        if (isNaN(unitPrice) || unitPrice <= 0) {
            let lbs = 1;
            const text = `${presentation || ''} ${product_type || ''}`.toLowerCase();
            const m = text.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
            if (m) {
                lbs = parseFloat(m[1]) || 1;
            } else if (text.includes('galón') || text.includes('galon')) {
                lbs = 8;
            } else if (text.includes('litro')) {
                lbs = 2;
            }
            unitPrice = pricePerLb * lbs;
        }

        if (id) {
            await pool.query(`
                UPDATE egg_costing_customer_agreements
                SET customer_id = ?,
                    customer_name = ?,
                    product_id = ?,
                    product_type = ?,
                    presentation = ?,
                    agreed_price_per_lb = ?,
                    agreed_unit_price = ?,
                    monthly_volume_lbs = ?,
                    target_margin_pct = ?,
                    freight_cost_per_lb = ?,
                    payment_terms_days = ?,
                    notes = ?,
                    status = ?
                WHERE id = ? AND company_id = ?
            `, [
                customer_id || null,
                customer_name.trim(),
                product_id || null,
                product_type || 'Huevo Entero Pasteurizado',
                presentation || 'cubeta 30LB',
                pricePerLb,
                unitPrice,
                parseFloat(monthly_volume_lbs) || 0,
                parseFloat(target_margin_pct) || 20,
                parseFloat(freight_cost_per_lb) || 0,
                parseInt(payment_terms_days, 10) || 30,
                notes ? notes.trim() : null,
                status || 'activo',
                id,
                companyId
            ]);
            return res.json({ message: 'Acuerdo comercial actualizado exitosamente.', id });
        } else {
            const [result] = await pool.query(`
                INSERT INTO egg_costing_customer_agreements (
                    company_id,
                    customer_id,
                    customer_name,
                    product_id,
                    product_type,
                    presentation,
                    agreed_price_per_lb,
                    agreed_unit_price,
                    monthly_volume_lbs,
                    target_margin_pct,
                    freight_cost_per_lb,
                    payment_terms_days,
                    notes,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                companyId,
                customer_id || null,
                customer_name.trim(),
                product_id || null,
                product_type || 'Huevo Entero Pasteurizado',
                presentation || 'cubeta 30LB',
                pricePerLb,
                unitPrice,
                parseFloat(monthly_volume_lbs) || 0,
                parseFloat(target_margin_pct) || 20,
                parseFloat(freight_cost_per_lb) || 0,
                parseInt(payment_terms_days, 10) || 30,
                notes ? notes.trim() : null,
                status || 'activo'
            ]);
            return res.status(201).json({ message: 'Acuerdo comercial registrado con éxito.', id: result.insertId });
        }
    } catch (error) {
        console.error('Error al guardar acuerdo en CRM:', error);
        res.status(500).json({ message: 'Error interno al guardar acuerdo comercial.' });
    }
};

// 4. Eliminar acuerdo comercial
const deleteAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId || req.user?.company_id || 1;

        const [result] = await pool.query(
            'DELETE FROM egg_costing_customer_agreements WHERE id = ? AND company_id = ?',
            [id, companyId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Acuerdo no encontrado o ya eliminado.' });
        }

        res.json({ message: 'Acuerdo comercial eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar acuerdo de CRM:', error);
        res.status(500).json({ message: 'Error al eliminar acuerdo comercial.' });
    }
};

module.exports = {
    getAgreements,
    getActiveAgreementsByCustomer,
    saveAgreement,
    deleteAgreement
};
