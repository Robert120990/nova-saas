const { pool, ensureSeedData } = require('./shared');

const saveCustomerAgreement = async (req, res) => {
    try {
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
            valid_from,
            valid_to,
            change_reason,
            notes,
            status
        } = req.body;

        const pricePerLb = parseFloat(agreed_price_per_lb) || 0;
        let unitPrice = parseFloat(agreed_unit_price);
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

        const validFromDate = valid_from ? valid_from.split('T')[0] : null;
        const validToDate = valid_to ? valid_to.split('T')[0] : null;
        const userName = req.user?.nombre || 'Usuario Sistema';

        // Si se envió un array de productos / presentaciones múltiples (items)
        if (Array.isArray(req.body.items) && req.body.items.length > 0) {
            const items = req.body.items;
            const seenCombos = new Set();
            for (const item of items) {
                const pType = (item.product_type || 'Huevo Entero Pasteurizado').trim().toLowerCase();
                const pPres = (item.presentation || 'cubeta 30LB').trim().toLowerCase();
                const comboKey = `${pType}___${pPres}`;
                if (seenCombos.has(comboKey)) {
                    return res.status(400).json({
                        message: `No se pueden repetir productos con la misma presentación: "${item.product_type} - ${item.presentation}" está duplicado.`
                    });
                }
                seenCombos.add(comboKey);
            }

            const savedIds = [];
            for (const item of items) {
                const itemPricePerLb = parseFloat(item.agreed_price_per_lb) || 0;
                let itemUnitPrice = parseFloat(item.agreed_unit_price);
                if (isNaN(itemUnitPrice) || itemUnitPrice <= 0) {
                    let lbs = 1;
                    const text = `${item.presentation || ''} ${item.product_type || ''}`.toLowerCase();
                    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)/i);
                    if (m) {
                        lbs = parseFloat(m[1]) || 1;
                    } else if (text.includes('galón') || text.includes('galon')) {
                        lbs = 8;
                    } else if (text.includes('litro')) {
                        lbs = 2;
                    }
                    itemUnitPrice = itemPricePerLb * lbs;
                }

                const itemProductId = item.product_id || null;
                const itemProductType = item.product_type || 'Huevo Entero Pasteurizado';
                const itemPresentation = item.presentation || 'cubeta 30LB';
                const itemMonthlyVolume = parseFloat(item.monthly_volume_lbs) || parseFloat(monthly_volume_lbs) || 0;
                const itemTargetMargin = parseFloat(target_margin_pct) || 20;
                const targetId = item.id || (items.length === 1 ? id : null);

                if (targetId) {
                    await pool.query(
                        `UPDATE egg_costing_customer_agreements
                         SET customer_id = ?, customer_name = ?, product_id = ?, product_type = ?, presentation = ?, agreed_price_per_lb = ?, agreed_unit_price = ?, monthly_volume_lbs = ?, target_margin_pct = ?, freight_cost_per_lb = ?, payment_terms_days = ?, valid_from = ?, valid_to = ?, notes = ?, status = ?
                         WHERE id = ? AND company_id = ?`,
                        [customer_id || null, customer_name, itemProductId, itemProductType, itemPresentation, itemPricePerLb, itemUnitPrice, itemMonthlyVolume, itemTargetMargin, freight_cost_per_lb || 0, payment_terms_days || 30, validFromDate, validToDate, notes || null, status || 'activo', targetId, req.company_id]
                    );
                    savedIds.push(targetId);
                } else {
                    const [existingRows] = await pool.query(
                        `SELECT id FROM egg_costing_customer_agreements
                         WHERE company_id = ? AND product_type = ? AND presentation = ?
                           AND (customer_id = ? OR (customer_id IS NULL AND customer_name = ?)) LIMIT 1`,
                        [req.company_id, itemProductType, itemPresentation, customer_id || 0, customer_name.trim()]
                    );

                    if (existingRows.length > 0) {
                        const existingId = existingRows[0].id;
                        await pool.query(
                            `UPDATE egg_costing_customer_agreements
                             SET customer_id = ?, customer_name = ?, product_id = ?, agreed_price_per_lb = ?, agreed_unit_price = ?, monthly_volume_lbs = ?, target_margin_pct = ?, freight_cost_per_lb = ?, payment_terms_days = ?, valid_from = ?, valid_to = ?, notes = ?, status = ?
                             WHERE id = ? AND company_id = ?`,
                            [customer_id || null, customer_name, itemProductId, itemPricePerLb, itemUnitPrice, itemMonthlyVolume, itemTargetMargin, freight_cost_per_lb || 0, payment_terms_days || 30, validFromDate, validToDate, notes || null, status || 'activo', existingId, req.company_id]
                        );
                        savedIds.push(existingId);
                    } else {
                        const [result] = await pool.query(
                            `INSERT INTO egg_costing_customer_agreements (company_id, customer_id, customer_name, product_id, product_type, presentation, agreed_price_per_lb, agreed_unit_price, monthly_volume_lbs, target_margin_pct, freight_cost_per_lb, payment_terms_days, valid_from, valid_to, notes, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [req.company_id, customer_id || null, customer_name, itemProductId, itemProductType, itemPresentation, itemPricePerLb, itemUnitPrice, itemMonthlyVolume, itemTargetMargin, freight_cost_per_lb || 0, payment_terms_days || 30, validFromDate, validToDate, notes || null, status || 'activo']
                        );
                        savedIds.push(result.insertId);
                    }
                }
            }

            return res.json({
                message: items.length > 1
                    ? `Se guardaron ${items.length} productos y presentaciones para el acuerdo comercial.`
                    : 'Acuerdo comercial guardado exitosamente.',
                ids: savedIds
            });
        }

        if (id) {
            // Guardar versión previa en historial si hay cambio de precio, volumen, fechas o motivo
            const [priorRows] = await pool.query(
                'SELECT * FROM egg_costing_customer_agreements WHERE id = ? AND company_id = ?',
                [id, req.company_id]
            );

            if (priorRows.length > 0) {
                const prior = priorRows[0];
                const priceChanged = Math.abs(parseFloat(prior.agreed_price_per_lb) - pricePerLb) > 0.0001;
                const volumeChanged = Math.abs(parseFloat(prior.monthly_volume_lbs || 0) - parseFloat(monthly_volume_lbs || 0)) > 0.01;
                const datesChanged = prior.valid_from !== validFromDate || prior.valid_to !== validToDate;

                if (priceChanged || volumeChanged || datesChanged || change_reason) {
                    await pool.query(
                        `INSERT INTO egg_costing_agreement_history
                         (agreement_id, company_id, customer_id, customer_name, product_id, product_type, presentation, agreed_price_per_lb, agreed_unit_price, monthly_volume_lbs, target_margin_pct, freight_cost_per_lb, payment_terms_days, valid_from, valid_to, change_reason, recorded_by, notes)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            req.company_id,
                            prior.customer_id,
                            prior.customer_name,
                            prior.product_id,
                            prior.product_type,
                            prior.presentation,
                            prior.agreed_price_per_lb,
                            prior.agreed_unit_price,
                            prior.monthly_volume_lbs,
                            prior.target_margin_pct,
                            prior.freight_cost_per_lb,
                            prior.payment_terms_days,
                            prior.valid_from,
                            prior.valid_to,
                            change_reason || (priceChanged ? `Actualización de precio de $${parseFloat(prior.agreed_price_per_lb).toFixed(4)} a $${pricePerLb.toFixed(4)}` : 'Modificación de condiciones de acuerdo'),
                            userName,
                            prior.notes
                        ]
                    );
                }
            }

            await pool.query(
                `UPDATE egg_costing_customer_agreements
                 SET customer_id = ?, customer_name = ?, product_id = ?, product_type = ?, presentation = ?, agreed_price_per_lb = ?, agreed_unit_price = ?, monthly_volume_lbs = ?, target_margin_pct = ?, freight_cost_per_lb = ?, payment_terms_days = ?, valid_from = ?, valid_to = ?, notes = ?, status = ?
                 WHERE id = ? AND company_id = ?`,
                [customer_id || null, customer_name, product_id || null, product_type, presentation || 'cubeta 30LB', pricePerLb, unitPrice, monthly_volume_lbs || 0, target_margin_pct || 20, freight_cost_per_lb || 0, payment_terms_days || 30, validFromDate, validToDate, notes || null, status || 'activo', id, req.company_id]
            );
            res.json({ message: 'Acuerdo comercial actualizado y registrado en historial.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_costing_customer_agreements (company_id, customer_id, customer_name, product_id, product_type, presentation, agreed_price_per_lb, agreed_unit_price, monthly_volume_lbs, target_margin_pct, freight_cost_per_lb, payment_terms_days, valid_from, valid_to, notes, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, customer_id || null, customer_name, product_id || null, product_type, presentation || 'cubeta 30LB', pricePerLb, unitPrice, monthly_volume_lbs || 0, target_margin_pct || 20, freight_cost_per_lb || 0, payment_terms_days || 30, validFromDate, validToDate, notes || null, status || 'activo']
            );

            // Registrar versión inicial en historial
            await pool.query(
                `INSERT INTO egg_costing_agreement_history
                 (agreement_id, company_id, customer_id, customer_name, product_id, product_type, presentation, agreed_price_per_lb, agreed_unit_price, monthly_volume_lbs, target_margin_pct, freight_cost_per_lb, payment_terms_days, valid_from, valid_to, change_reason, recorded_by, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    result.insertId,
                    req.company_id,
                    customer_id || null,
                    customer_name,
                    product_id || null,
                    product_type,
                    presentation || 'cubeta 30LB',
                    pricePerLb,
                    unitPrice,
                    monthly_volume_lbs || 0,
                    target_margin_pct || 20,
                    freight_cost_per_lb || 0,
                    payment_terms_days || 30,
                    validFromDate,
                    validToDate,
                    change_reason || 'Creación inicial del acuerdo comercial',
                    userName,
                    notes || null
                ]
            );

            res.status(201).json({ message: 'Acuerdo comercial registrado con trazabilidad histórica.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCustomerAgreement = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_customer_agreements WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Acuerdo comercial eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAgreementHistory = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const { id } = req.params;
        const { customer_id, product_type } = req.query;

        let query = `
            SELECT h.*,
                   c.nombre as customer_registered_name,
                   p.nombre as catalog_product_name
            FROM egg_costing_agreement_history h
            LEFT JOIN customers c ON h.customer_id = c.id
            LEFT JOIN products p ON h.product_id = p.id
            WHERE h.company_id = ?
        `;
        const params = [req.company_id];

        if (id && id !== 'all') {
            query += ' AND h.agreement_id = ?';
            params.push(id);
        }
        if (customer_id) {
            query += ' AND h.customer_id = ?';
            params.push(customer_id);
        }
        if (product_type) {
            query += ' AND h.product_type = ?';
            params.push(product_type);
        }

        query += ' ORDER BY h.created_at DESC, h.id DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { saveCustomerAgreement, deleteCustomerAgreement, getAgreementHistory };
