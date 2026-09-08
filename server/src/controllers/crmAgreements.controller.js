const pool = require('../config/db');

/**
 * Controlador de CRM: Acuerdos Comerciales de Precios con Clientes
 * Permite la gestión y mantenimiento integral de acuerdos de precios
 * y la consulta rápida en tiempo de facturación en el Punto de Venta.
 */

// 1. Obtener listado con métricas/KPIs y filtros
const getAgreements = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }
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
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }
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
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }
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

        const validFromVal = valid_from ? valid_from : null;
        const validToVal = valid_to ? valid_to : null;

        // Si se envió un array de productos / presentaciones múltiples (items)
        if (Array.isArray(items) && items.length > 0) {
            // Validar que no haya combinaciones duplicadas en la lista enviada
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
                const pricePerLb = parseFloat(item.agreed_price_per_lb) || 0;
                let unitPrice = parseFloat(item.agreed_unit_price);
                if (isNaN(unitPrice) || unitPrice <= 0) {
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
                    unitPrice = pricePerLb * lbs;
                }

                const itemProductId = item.product_id || null;
                const itemProductType = item.product_type || 'Huevo Entero Pasteurizado';
                const itemPresentation = item.presentation || 'cubeta 30LB';
                const itemMonthlyVolume = parseFloat(item.monthly_volume_lbs) || parseFloat(monthly_volume_lbs) || 0;
                const itemTargetMargin = parseFloat(target_margin_pct) || 20;
                const targetId = item.id || (items.length === 1 ? id : null);

                if (targetId) {
                    // Actualizar registro existente
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
                            valid_from = ?,
                            valid_to = ?,
                            notes = ?,
                            status = ?
                        WHERE id = ? AND company_id = ?
                    `, [
                        customer_id || null,
                        customer_name.trim(),
                        itemProductId,
                        itemProductType,
                        itemPresentation,
                        pricePerLb,
                        unitPrice,
                        itemMonthlyVolume,
                        itemTargetMargin,
                        parseFloat(freight_cost_per_lb) || 0,
                        parseInt(payment_terms_days, 10) || 30,
                        validFromVal,
                        validToVal,
                        notes ? notes.trim() : null,
                        status || 'activo',
                        targetId,
                        companyId
                    ]);
                    savedIds.push(targetId);
                } else {
                    // Buscar si ya existe acuerdo para este cliente y producto/presentación en la empresa
                    let existingQuery = `
                        SELECT id FROM egg_costing_customer_agreements 
                        WHERE company_id = ? 
                          AND product_type = ? 
                          AND presentation = ?
                          AND (customer_id = ? OR (customer_id IS NULL AND customer_name = ?))
                        LIMIT 1
                    `;
                    const [existingRows] = await pool.query(existingQuery, [
                        companyId,
                        itemProductType,
                        itemPresentation,
                        customer_id || 0,
                        customer_name.trim()
                    ]);

                    if (existingRows.length > 0) {
                        const existingId = existingRows[0].id;
                        await pool.query(`
                            UPDATE egg_costing_customer_agreements
                            SET customer_id = ?,
                                customer_name = ?,
                                product_id = ?,
                                agreed_price_per_lb = ?,
                                agreed_unit_price = ?,
                                monthly_volume_lbs = ?,
                                target_margin_pct = ?,
                                freight_cost_per_lb = ?,
                                payment_terms_days = ?,
                                valid_from = ?,
                                valid_to = ?,
                                notes = ?,
                                status = ?
                            WHERE id = ? AND company_id = ?
                        `, [
                            customer_id || null,
                            customer_name.trim(),
                            itemProductId,
                            pricePerLb,
                            unitPrice,
                            itemMonthlyVolume,
                            itemTargetMargin,
                            parseFloat(freight_cost_per_lb) || 0,
                            parseInt(payment_terms_days, 10) || 30,
                            validFromVal,
                            validToVal,
                            notes ? notes.trim() : null,
                            status || 'activo',
                            existingId,
                            companyId
                        ]);
                        savedIds.push(existingId);
                    } else {
                        // Insertar nuevo acuerdo para este producto y presentación
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
                                valid_from,
                                valid_to,
                                notes,
                                status
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            companyId,
                            customer_id || null,
                            customer_name.trim(),
                            itemProductId,
                            itemProductType,
                            itemPresentation,
                            pricePerLb,
                            unitPrice,
                            itemMonthlyVolume,
                            itemTargetMargin,
                            parseFloat(freight_cost_per_lb) || 0,
                            parseInt(payment_terms_days, 10) || 30,
                            validFromVal,
                            validToVal,
                            notes ? notes.trim() : null,
                            status || 'activo'
                        ]);
                        savedIds.push(result.insertId);

                        // Registrar creación inicial en historial
                        try {
                            await pool.query(
                                `INSERT INTO egg_costing_agreement_history 
                                 (agreement_id, company_id, customer_id, customer_name, product_type, presentation, agreed_price_per_lb, previous_price_per_lb, monthly_volume_lbs, valid_from, valid_to, change_reason, changed_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    result.insertId,
                                    companyId,
                                    customer_id || null,
                                    customer_name.trim(),
                                    itemProductType,
                                    itemPresentation,
                                    pricePerLb,
                                    null,
                                    itemMonthlyVolume,
                                    validFromVal,
                                    validToVal,
                                    change_reason || 'Pacto comercial de precio con cliente',
                                    req.user?.nombre || 'Usuario CRM'
                                ]
                            );
                        } catch (hErr) {
                            console.warn('Advertencia historial inicial CRM:', hErr.message);
                        }
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

        // Modo plano tradicional (1 solo producto)
        if (id) {
            // Guardar versión previa en historial
            try {
                const [previous] = await pool.query('SELECT * FROM egg_costing_customer_agreements WHERE id = ? AND company_id = ?', [id, companyId]);
                if (previous && previous.length > 0) {
                    const prev = previous[0];
                    await pool.query(
                        `INSERT INTO egg_costing_agreement_history 
                         (agreement_id, company_id, customer_id, customer_name, product_type, presentation, agreed_price_per_lb, previous_price_per_lb, monthly_volume_lbs, valid_from, valid_to, change_reason, changed_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            id,
                            companyId,
                            prev.customer_id,
                            prev.customer_name,
                            prev.product_type,
                            prev.presentation,
                            pricePerLb,
                            prev.agreed_price_per_lb,
                            parseFloat(monthly_volume_lbs) || prev.monthly_volume_lbs,
                            prev.valid_from,
                            prev.valid_to,
                            change_reason || 'Actualización de acuerdo desde CRM',
                            req.user?.nombre || 'Usuario CRM'
                        ]
                    );
                }
            } catch (histErr) {
                console.warn('Advertencia registrando historial de acuerdo CRM:', histErr.message);
            }

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
                    valid_from = ?,
                    valid_to = ?,
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
                validFromVal,
                validToVal,
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
                    valid_from,
                    valid_to,
                    notes,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                validFromVal,
                validToVal,
                notes ? notes.trim() : null,
                status || 'activo'
            ]);

            // Registrar creación inicial en historial
            try {
                await pool.query(
                    `INSERT INTO egg_costing_agreement_history 
                     (agreement_id, company_id, customer_id, customer_name, product_type, presentation, agreed_price_per_lb, previous_price_per_lb, monthly_volume_lbs, valid_from, valid_to, change_reason, changed_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        result.insertId,
                        companyId,
                        customer_id || null,
                        customer_name.trim(),
                        product_type || 'Huevo Entero Pasteurizado',
                        presentation || 'cubeta 30LB',
                        pricePerLb,
                        null,
                        parseFloat(monthly_volume_lbs) || 0,
                        validFromVal,
                        validToVal,
                        change_reason || 'Pacto inicial de precio de cliente',
                        req.user?.nombre || 'Usuario CRM'
                    ]
                );
            } catch (hErr) {
                console.warn('Advertencia historial inicial CRM:', hErr.message);
            }

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
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }

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

// 5. Obtener configuración general del CRM
const getCrmSettings = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }

        // Asegurar tabla crm_settings si no existe
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                default_target_margin_pct DECIMAL(5,2) DEFAULT 22.00,
                default_payment_terms_days INT DEFAULT 30,
                default_freight_per_lb DECIMAL(8,4) DEFAULT 0.0000,
                min_monthly_volume_lbs DECIMAL(12,2) DEFAULT 5000.00,
                contract_alert_days INT DEFAULT 15,
                auto_apply_agreements_in_pos TINYINT(1) DEFAULT 1,
                require_supervisor_override TINYINT(1) DEFAULT 1,
                grace_period_days INT DEFAULT 5,
                default_terms_conditions TEXT NULL,
                notification_email VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_crm_settings_company (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        const [rows] = await pool.query(
            'SELECT * FROM crm_settings WHERE company_id = ? LIMIT 1',
            [companyId]
        );

        const defaultSettings = {
            company_id: companyId,
            default_target_margin_pct: 22.00,
            default_payment_terms_days: 30,
            default_freight_per_lb: 0.0000,
            min_monthly_volume_lbs: 5000.00,
            contract_alert_days: 15,
            auto_apply_agreements_in_pos: 1,
            require_supervisor_override: 1,
            grace_period_days: 5,
            default_terms_conditions: '1. Los precios pactados aplican exclusivamente para los volúmenes mensuales y presentaciones especificadas en el presente acuerdo.\n2. Todo despacho está sujeto a confirmación de stock y crédito vigente.\n3. Los precios acordados no incluyen flete adicional salvo especificación en el acuerdo.',
            notification_email: ''
        };

        if (rows.length === 0) {
            return res.json(defaultSettings);
        }

        res.json({
            ...defaultSettings,
            ...rows[0]
        });
    } catch (error) {
        console.error('Error al obtener configuración de CRM:', error);
        res.status(500).json({ message: 'Error interno al obtener la configuración del CRM.' });
    }
};

// 6. Guardar / actualizar configuración general del CRM
const updateCrmSettings = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Contexto de empresa faltante' });
        }

        const {
            default_target_margin_pct = 22.00,
            default_payment_terms_days = 30,
            default_freight_per_lb = 0.0000,
            min_monthly_volume_lbs = 5000.00,
            contract_alert_days = 15,
            auto_apply_agreements_in_pos = 1,
            require_supervisor_override = 1,
            grace_period_days = 5,
            default_terms_conditions = '',
            notification_email = ''
        } = req.body;

        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                default_target_margin_pct DECIMAL(5,2) DEFAULT 22.00,
                default_payment_terms_days INT DEFAULT 30,
                default_freight_per_lb DECIMAL(8,4) DEFAULT 0.0000,
                min_monthly_volume_lbs DECIMAL(12,2) DEFAULT 5000.00,
                contract_alert_days INT DEFAULT 15,
                auto_apply_agreements_in_pos TINYINT(1) DEFAULT 1,
                require_supervisor_override TINYINT(1) DEFAULT 1,
                grace_period_days INT DEFAULT 5,
                default_terms_conditions TEXT NULL,
                notification_email VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_crm_settings_company (company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            INSERT INTO crm_settings (
                company_id,
                default_target_margin_pct,
                default_payment_terms_days,
                default_freight_per_lb,
                min_monthly_volume_lbs,
                contract_alert_days,
                auto_apply_agreements_in_pos,
                require_supervisor_override,
                grace_period_days,
                default_terms_conditions,
                notification_email
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                default_target_margin_pct = VALUES(default_target_margin_pct),
                default_payment_terms_days = VALUES(default_payment_terms_days),
                default_freight_per_lb = VALUES(default_freight_per_lb),
                min_monthly_volume_lbs = VALUES(min_monthly_volume_lbs),
                contract_alert_days = VALUES(contract_alert_days),
                auto_apply_agreements_in_pos = VALUES(auto_apply_agreements_in_pos),
                require_supervisor_override = VALUES(require_supervisor_override),
                grace_period_days = VALUES(grace_period_days),
                default_terms_conditions = VALUES(default_terms_conditions),
                notification_email = VALUES(notification_email),
                updated_at = CURRENT_TIMESTAMP
        `, [
            companyId,
            parseFloat(default_target_margin_pct) || 22.00,
            parseInt(default_payment_terms_days, 10) || 30,
            parseFloat(default_freight_per_lb) || 0.0000,
            parseFloat(min_monthly_volume_lbs) || 5000.00,
            parseInt(contract_alert_days, 10) || 15,
            auto_apply_agreements_in_pos ? 1 : 0,
            require_supervisor_override ? 1 : 0,
            parseInt(grace_period_days, 10) || 5,
            default_terms_conditions || '',
            notification_email || ''
        ]);

        res.json({ message: 'Configuración comercial de CRM guardada exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar configuración de CRM:', error);
        res.status(500).json({ message: 'Error interno al actualizar la configuración del CRM.' });
    }
};

module.exports = {
    getAgreements,
    getActiveAgreementsByCustomer,
    saveAgreement,
    deleteAgreement,
    getCrmSettings,
    updateCrmSettings
};
