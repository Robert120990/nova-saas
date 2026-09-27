const { pool, ensureSeedData } = require('./shared');

const syncPurchasesWithInvoices = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        let updatedCount = 0;
        const updatedDetails = [];

        // 1. Sincronizar empaques
        const [packRows] = await pool.query(`
            SELECT
                pack.id, pack.item_code, pack.item_name, pack.unit_cost, pack.product_id,
                latest_purch.precio_unitario AS latest_purchase_cost,
                latest_purch.numero_documento AS latest_invoice_number,
                latest_purch.fecha AS latest_purchase_date,
                latest_purch.provider_nombre AS latest_provider_name
            FROM egg_costing_packaging pack
            JOIN (
                SELECT
                    pi.product_id, pi.precio_unitario, ph.fecha, ph.numero_documento, prov.nombre AS provider_nombre
                FROM purchase_items pi
                JOIN purchase_headers ph ON ph.id = pi.purchase_id
                LEFT JOIN providers prov ON prov.id = ph.provider_id
                JOIN (
                    SELECT pi_sub.product_id, MAX(ph_sub.id) AS max_ph_id
                    FROM purchase_items pi_sub
                    JOIN purchase_headers ph_sub ON ph_sub.id = pi_sub.purchase_id
                    WHERE ph_sub.company_id = ? AND (ph_sub.status IS NULL OR ph_sub.status != 'ANULADO')
                    GROUP BY pi_sub.product_id
                ) max_p ON max_p.product_id = pi.product_id AND max_p.max_ph_id = ph.id
                WHERE ph.company_id = ? AND (ph.status IS NULL OR ph.status != 'ANULADO')
            ) latest_purch ON latest_purch.product_id = pack.product_id
            WHERE pack.company_id = ?
        `, [req.company_id, req.company_id, req.company_id]);

        for (const p of packRows) {
            if (p.latest_purchase_cost !== null && p.latest_purchase_cost !== undefined) {
                const newCost = parseFloat(p.latest_purchase_cost);
                if (Math.abs(parseFloat(p.unit_cost) - newCost) > 0.0001) {
                    await pool.query('UPDATE egg_costing_packaging SET unit_cost = ? WHERE id = ?', [newCost, p.id]);
                    updatedCount++;
                    updatedDetails.push({
                        type: 'Empaque',
                        name: p.item_name,
                        code: p.item_code,
                        old_cost: p.unit_cost,
                        new_cost: newCost,
                        invoice: p.latest_invoice_number,
                        date: p.latest_purchase_date,
                        provider: p.latest_provider_name
                    });
                }
            }
        }

        // 2. Sincronizar químicos CIP
        const [cipRows] = await pool.query(`
            SELECT
                cip.id, cip.item_name, cip.presentation_qty, cip.presentation_cost, cip.product_id,
                latest_purch.precio_unitario AS latest_purchase_cost,
                latest_purch.numero_documento AS latest_invoice_number,
                latest_purch.fecha AS latest_purchase_date,
                latest_purch.provider_nombre AS latest_provider_name
            FROM egg_costing_cip_items cip
            JOIN (
                SELECT
                    pi.product_id, pi.precio_unitario, ph.fecha, ph.numero_documento, prov.nombre AS provider_nombre
                FROM purchase_items pi
                JOIN purchase_headers ph ON ph.id = pi.purchase_id
                LEFT JOIN providers prov ON prov.id = ph.provider_id
                JOIN (
                    SELECT pi_sub.product_id, MAX(ph_sub.id) AS max_ph_id
                    FROM purchase_items pi_sub
                    JOIN purchase_headers ph_sub ON ph_sub.id = pi_sub.purchase_id
                    WHERE ph_sub.company_id = ? AND (ph_sub.status IS NULL OR ph_sub.status != 'ANULADO')
                    GROUP BY pi_sub.product_id
                ) max_p ON max_p.product_id = pi.product_id AND max_p.max_ph_id = ph.id
                WHERE ph.company_id = ? AND (ph.status IS NULL OR ph.status != 'ANULADO')
            ) latest_purch ON latest_purch.product_id = cip.product_id
            WHERE cip.company_id = ?
        `, [req.company_id, req.company_id, req.company_id]);

        for (const c of cipRows) {
            if (c.latest_purchase_cost !== null && c.latest_purchase_cost !== undefined) {
                const qty = parseFloat(c.presentation_qty) || 1;
                const newCost = parseFloat(c.latest_purchase_cost) * qty;
                if (Math.abs(parseFloat(c.presentation_cost) - newCost) > 0.0001) {
                    await pool.query('UPDATE egg_costing_cip_items SET presentation_cost = ? WHERE id = ?', [newCost, c.id]);
                    updatedCount++;
                    updatedDetails.push({
                        type: 'Químico CIP',
                        name: c.item_name,
                        old_cost: c.presentation_cost,
                        new_cost: newCost,
                        invoice: c.latest_invoice_number,
                        date: c.latest_purchase_date,
                        provider: c.latest_provider_name
                    });
                }
            }
        }

        res.json({
            message: updatedCount > 0
                ? `Se actualizaron ${updatedCount} costos con base en las facturas de compra más recientes.`
                : 'Todos los costos de insumos ya coinciden con las últimas facturas de compras registradas.',
            updated_count: updatedCount,
            details: updatedDetails
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deletePackagingItem = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_packaging WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Empaque eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCustomerAgreements = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const { start_date, end_date, validity_status, search } = req.query;

        let query = `
            SELECT a.*, c.nombre as customer_registered_name, c.telefono, c.correo as email,
                    p.nombre as catalog_product_name, p.codigo as product_code
             FROM egg_costing_customer_agreements a
             LEFT JOIN customers c ON a.customer_id = c.id
             LEFT JOIN products p ON a.product_id = p.id
             WHERE a.company_id = ?
        `;
        const params = [req.company_id];

        if (search && search.trim()) {
            query += ` AND (a.customer_name LIKE ? OR c.nombre LIKE ? OR a.product_type LIKE ? OR a.presentation LIKE ?)`;
            const s = `%${search.trim()}%`;
            params.push(s, s, s, s);
        }

        // Filtro por rango de fechas de vigencia
        if (start_date && end_date) {
            query += ` AND (
                (a.valid_from IS NULL AND a.valid_to IS NULL) OR
                (a.valid_from <= ? AND (a.valid_to IS NULL OR a.valid_to >= ?))
            )`;
            params.push(end_date, start_date);
        } else if (start_date) {
            query += ` AND (a.valid_to IS NULL OR a.valid_to >= ?)`;
            params.push(start_date);
        } else if (end_date) {
            query += ` AND (a.valid_from IS NULL OR a.valid_from <= ?)`;
            params.push(end_date);
        }

        query += ` ORDER BY a.agreed_price_per_lb DESC`;

        const [rows] = await pool.query(query, params);

        // Computar validity_status y días restantes para cada acuerdo
        const todayStr = new Date().toISOString().split('T')[0];
        const processed = rows.map(r => {
            let validity = 'vigente';
            let daysRemaining = null;

            const fromStr = r.valid_from ? new Date(r.valid_from).toISOString().split('T')[0] : null;
            const toStr = r.valid_to ? new Date(r.valid_to).toISOString().split('T')[0] : null;

            if (toStr && toStr < todayStr) {
                validity = 'vencido';
            } else if (fromStr && fromStr > todayStr) {
                validity = 'programado';
            } else if (toStr) {
                const diffTime = new Date(toStr) - new Date(todayStr);
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                validity = daysRemaining <= 30 ? 'por_vencer' : 'vigente';
            } else {
                validity = 'vigente'; // sin vencimiento
            }

            return {
                ...r,
                validity_status: validity,
                days_remaining: daysRemaining
            };
        });

        const finalRows = validity_status && validity_status !== 'todos'
            ? processed.filter(p => p.validity_status === validity_status)
            : processed;

        res.json(finalRows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { syncPurchasesWithInvoices, deletePackagingItem, getCustomerAgreements };
