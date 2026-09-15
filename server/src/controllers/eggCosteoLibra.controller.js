const pool = require('../config/db');

// Helper para auto-sembrar parámetros iniciales solo si la empresa tiene habilitado el módulo de huevo
const ensureSeedData = async (companyId) => {
    try {
        if (!companyId) return;
        const [comp] = await pool.query('SELECT id FROM companies WHERE id = ?', [companyId]);
        if (comp.length === 0) return;

        const [cRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_configurations WHERE company_id = ?', [companyId]);
        if (cRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_configurations (company_id, setting_key, setting_label, setting_value, unit_label, category)
                VALUES 
                    (?, 'monthly_gif_total', 'Gastos Indirectos de Fabricación (GIF) Mensual', 24537.0000, 'USD/mes', 'gif'),
                    (?, 'monthly_projected_lbs', 'Volumen Base Mensual Proyectado', 100000.0000, 'LBS', 'gif'),
                    (?, 'boiler_diesel_gal_batch', 'Consumo Diesel Caldera por Batch', 20.8400, 'Galones', 'boiler'),
                    (?, 'boiler_diesel_price_gal', 'Precio Diesel por Galón', 4.1400, 'USD/Gal', 'boiler'),
                    (?, 'boiler_kwh_cost_batch', 'Costo Electricidad Pasteurizador/Caldera', 386.0000, 'USD/batch', 'boiler'),
                    (?, 'boiler_water_cost_batch', 'Costo Agua Suavizada Caldera', 17.3400, 'USD/batch', 'boiler'),
                    (?, 'mod_cost_per_lb', 'Mano de Obra Directa (MOD) por Libra', 0.0500, 'USD/LB', 'labor'),
                    (?, 'he_plus_citric_acid_pct', 'Dosis Ácido Cítrico HE Plus', 0.0010, '% p/p', 'additive'),
                    (?, 'yolk_sugar_pct', 'Porcentaje Azúcar Yema Azucarada', 0.0400, '% p/p', 'additive'),
                    (?, 'standard_batch_weight_lbs', 'Peso Batch Estándar', 12000.0000, 'LBS', 'production')
            `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId, companyId]);
        }

        const [cipRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_cip_items WHERE company_id = ?', [companyId]);
        if (cipRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_cip_items (company_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit)
                VALUES
                    (?, 'Soda Cáustica (Hidróxido de Sodio)', 250.00, 'kg', 262.50, 15.000, 'kg'),
                    (?, 'Hipoclorito de Sodio 13%', 55.00, 'gal', 66.00, 3.500, 'gal'),
                    (?, 'Ácido Fosfórico / Nítrico (Desincrustante)', 60.00, 'kg', 145.00, 4.000, 'kg'),
                    (?, 'Detergente Espumante Clean Foam', 20.00, 'kg', 55.00, 2.000, 'kg')
            `, [companyId, companyId, companyId, companyId]);
        }

        const [pRows] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_packaging WHERE company_id = ?', [companyId]);
        if (pRows[0].c === 0) {
            await pool.query(`
                INSERT IGNORE INTO egg_costing_packaging (company_id, item_code, item_name, unit_cost, category)
                VALUES
                    (?, 'CUBETA-30LB', 'Cubeta Plástica Blanca 30 LBS Grado Alimenticio', 2.4000, 'recipiente'),
                    (?, 'TAPA-30LB', 'Tapadera Hermética para Cubeta 30 LBS', 0.6500, 'tapadera'),
                    (?, 'LINER-30LB', 'Bolsa Plástica Liner Polietileno Virgen', 0.3000, 'liner'),
                    (?, 'ETIQ-4X2', 'Etiqueta Térmica Polipropileno 4x2 Pulgadas', 0.0350, 'etiqueta'),
                    (?, 'ETIQ-4X4', 'Etiqueta Térmica de Lote y Trazabilidad 4x4 Pulgadas', 0.0500, 'etiqueta'),
                    (?, 'GALON-8LB', 'Envase Plástico Galón 8 LBS con Asa', 0.8500, 'recipiente'),
                    (?, 'TAPA-GALON', 'Tapa con Sello de Seguridad para Galón', 0.1500, 'tapadera'),
                    (?, 'MEDIO-GALON', 'Envase Plástico Medio Galón 4 LBS', 0.5500, 'recipiente'),
                    (?, 'TAPA-MEDIO-GALON', 'Tapa con Sello para Medio Galón', 0.1000, 'tapadera'),
                    (?, 'LITRO-2LB', 'Botella Plástica Litro 2 LBS', 0.3500, 'recipiente'),
                    (?, 'TAPA-LITRO', 'Tapa con Sello para Botella 2 LBS', 0.0800, 'tapadera'),
                    (?, 'MEDIO-LITRO-1LB', 'Botella Plástica Medio Litro 1 LB', 0.2500, 'recipiente'),
                    (?, 'TAPA-MEDIO-LITRO', 'Tapa con Sello para Botella 1 LB', 0.0500, 'tapadera')
            `, [companyId, companyId, companyId, companyId, companyId, companyId, companyId]);
        }

        // Asegurar columnas de vinculación con productos y compras
        const [cipCols] = await pool.query("SHOW COLUMNS FROM egg_costing_cip_items LIKE 'product_id'");
        if (cipCols.length === 0) {
            await pool.query("ALTER TABLE egg_costing_cip_items ADD COLUMN product_id INT NULL AFTER company_id");
        }
        const [packCols] = await pool.query("SHOW COLUMNS FROM egg_costing_packaging LIKE 'product_id'");
        if (packCols.length === 0) {
            await pool.query("ALTER TABLE egg_costing_packaging ADD COLUMN product_id INT NULL AFTER company_id");
        }

        // Asegurar columnas de vigencia en egg_costing_customer_agreements
        const [agrCols] = await pool.query("SHOW COLUMNS FROM egg_costing_customer_agreements LIKE 'valid_from'");
        if (agrCols.length === 0) {
            await pool.query('ALTER TABLE egg_costing_customer_agreements ADD COLUMN valid_from DATE NULL DEFAULT NULL AFTER target_margin_pct');
        }
        const [agrColsTo] = await pool.query("SHOW COLUMNS FROM egg_costing_customer_agreements LIKE 'valid_to'");
        if (agrColsTo.length === 0) {
            await pool.query('ALTER TABLE egg_costing_customer_agreements ADD COLUMN valid_to DATE NULL DEFAULT NULL AFTER valid_from');
        }

        // Asegurar tabla de auditoría e historial de acuerdos de clientes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_costing_agreement_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                agreement_id INT NOT NULL,
                company_id INT NOT NULL,
                customer_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                product_id INT NULL,
                product_type VARCHAR(100) NOT NULL,
                presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
                agreed_price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
                agreed_unit_price DECIMAL(10,4) NULL,
                monthly_volume_lbs DECIMAL(12,2) DEFAULT 0.00,
                target_margin_pct DECIMAL(5,2) DEFAULT 20.00,
                freight_cost_per_lb DECIMAL(8,4) DEFAULT 0.0000,
                payment_terms_days INT DEFAULT 30,
                valid_from DATE NULL,
                valid_to DATE NULL,
                change_reason VARCHAR(255) NULL,
                recorded_by VARCHAR(100) NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ecah_agr (agreement_id),
                INDEX idx_ecah_comp (company_id),
                INDEX idx_ecah_cust (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    } catch (err) {
        console.warn('Advertencia en ensureSeedData:', err.message);
    }
};

// 1. OBTENER CONFIGURACIONES GENERALES DE COSTEO
const getCostingConfig = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(
            'SELECT * FROM egg_costing_configurations WHERE company_id = ? ORDER BY category, id',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. ACTUALIZAR O GUARDAR CONFIGURACIONES DE COSTEO
const updateCostingConfig = async (req, res) => {
    try {
        const { settings } = req.body; // array of { setting_key, setting_value, setting_label, unit_label, category }
        if (!Array.isArray(settings)) {
            return res.status(400).json({ message: 'Se esperaba un arreglo de configuraciones.' });
        }

        for (const item of settings) {
            await pool.query(
                `INSERT INTO egg_costing_configurations (company_id, setting_key, setting_label, setting_value, unit_label, category)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    setting_label = COALESCE(VALUES(setting_label), setting_label),
                    unit_label = COALESCE(VALUES(unit_label), unit_label),
                    category = COALESCE(VALUES(category), category)`,
                [req.company_id, item.setting_key, item.setting_label || item.setting_key, item.setting_value, item.unit_label || 'USD', item.category || 'general']
            );
        }

        res.json({ message: 'Configuraciones de costeo actualizadas con éxito.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. CATÁLOGO DE QUÍMICOS CIP (VINCULADO A PRODUCTOS Y COMPRAS)
const getCipItems = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(`
            SELECT 
                cip.*,
                p.codigo AS product_code,
                p.nombre AS product_name,
                p.costo AS product_catalog_cost,
                p.unidad_medida AS product_unit,
                latest_purch.precio_unitario AS latest_purchase_cost,
                latest_purch.cantidad AS latest_purchase_qty,
                latest_purch.fecha AS latest_purchase_date,
                latest_purch.numero_documento AS latest_invoice_number,
                latest_purch.provider_nombre AS latest_provider_name
            FROM egg_costing_cip_items cip
            LEFT JOIN products p ON p.id = cip.product_id
            LEFT JOIN (
                SELECT 
                    pi.product_id,
                    pi.precio_unitario,
                    pi.cantidad,
                    ph.fecha,
                    ph.numero_documento,
                    prov.nombre AS provider_nombre
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
            ORDER BY cip.id
        `, [req.company_id, req.company_id, req.company_id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveCipItem = async (req, res) => {
    try {
        const { id, product_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status } = req.body;
        if (id) {
            await pool.query(
                `UPDATE egg_costing_cip_items 
                 SET product_id = ?, item_name = ?, presentation_qty = ?, presentation_unit = ?, presentation_cost = ?, dose_per_batch = ?, dose_unit = ?, status = ?
                 WHERE id = ? AND company_id = ?`,
                [product_id || null, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status || 'activo', id, req.company_id]
            );
            res.json({ message: 'Químico CIP actualizado con éxito.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_costing_cip_items (company_id, product_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, product_id || null, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit, status || 'activo']
            );
            res.status(201).json({ message: 'Químico CIP creado.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCipItem = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_cip_items WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Químico CIP eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. CATÁLOGO DE EMPAQUES (VINCULADO A PRODUCTOS Y COMPRAS)
const getPackagingItems = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const [rows] = await pool.query(`
            SELECT 
                pack.*,
                p.codigo AS product_code,
                p.nombre AS product_name,
                p.costo AS product_catalog_cost,
                p.unidad_medida AS product_unit,
                latest_purch.precio_unitario AS latest_purchase_cost,
                latest_purch.cantidad AS latest_purchase_qty,
                latest_purch.fecha AS latest_purchase_date,
                latest_purch.numero_documento AS latest_invoice_number,
                latest_purch.provider_nombre AS latest_provider_name
            FROM egg_costing_packaging pack
            LEFT JOIN products p ON p.id = pack.product_id
            LEFT JOIN (
                SELECT 
                    pi.product_id,
                    pi.precio_unitario,
                    pi.cantidad,
                    ph.fecha,
                    ph.numero_documento,
                    prov.nombre AS provider_nombre
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
            ORDER BY pack.category, pack.id
        `, [req.company_id, req.company_id, req.company_id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const savePackagingItem = async (req, res) => {
    try {
        const { id, product_id, item_code, item_name, unit_cost, category } = req.body;
        if (id) {
            await pool.query(
                `UPDATE egg_costing_packaging 
                 SET product_id = ?, item_code = ?, item_name = ?, unit_cost = ?, category = ?
                 WHERE id = ? AND company_id = ?`,
                [product_id || null, item_code, item_name, unit_cost, category || 'recipiente', id, req.company_id]
            );
            res.json({ message: 'Empaque actualizado con éxito.', id });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_costing_packaging (company_id, product_id, item_code, item_name, unit_cost, category)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [req.company_id, product_id || null, item_code, item_name, unit_cost, category || 'recipiente']
            );
            res.status(201).json({ message: 'Empaque registrado.', id: result.insertId });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4.1 LOOKUP DE PRODUCTOS DEL CATÁLOGO PARA COSTEO
const getCostingProductsLookup = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                p.id, p.codigo, p.nombre, p.descripcion, p.unidad_medida, p.costo,
                latest_purch.precio_unitario AS latest_purchase_cost,
                latest_purch.fecha AS latest_purchase_date,
                latest_purch.numero_documento AS latest_invoice_number,
                latest_purch.provider_nombre AS latest_provider_name
            FROM products p
            LEFT JOIN (
                SELECT 
                    pi.product_id,
                    pi.precio_unitario,
                    ph.fecha,
                    ph.numero_documento,
                    prov.nombre AS provider_nombre
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
            ) latest_purch ON latest_purch.product_id = p.id
            WHERE p.company_id = ? AND p.status = 'activo'
            ORDER BY p.nombre ASC
        `, [req.company_id, req.company_id, req.company_id]);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4.2 SINCRONIZAR COSTOS CON ÚLTIMAS FACTURAS DE COMPRAS INGRESADAS
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

// 5. ACUERDOS DE PRECIOS CON CLIENTES (CONTRATOS)
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

// Obtener Historial de Precios y Revisiones de Acuerdos de Clientes
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

// 6. MOTOR MATEMÁTICO DE COSTEO DINÁMICO POR LIBRA
const calculateDynamicCost = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);

        const {
            product_type = 'Huevo Entero Pasteurizado',
            presentation = 'cubeta 30LB',
            raw_egg_box_cost = 38.00, // Costo de caja de 360 huevos
            raw_egg_lbs_per_box = 43.50, // Peso aprox de caja
            batch_size_lbs = 12000.00, // Batch estándar
            water_added_pct = null, // % Agua directa
            sugar_added_pct = null, // % Azúcar
            salt_added_pct = null,  // % Sal
            milk_added_pct = null,  // % Leche
            base_egg_solids = null, // Sólidos base medidos refractómetro
            target_solids = null,   // Sólidos objetivo deseados
            // Parámetros de Separación Clara/Yema & Huevo Formulado con H2O
            clara_separated_pct = 100.0, // % de clara destinada a venta directa
            clara_sale_price_per_lb = 1.35, // Precio de venta pactado de clara ($/lb)
            yema_solids_pct = 50.0, // Sólidos de la yema pura (%)
            custom_gif_monthly = null,
            custom_monthly_volume_lbs = null,
            target_sale_price_per_lb = null,
            start_date = null,
            end_date = null
        } = req.body;

        // Cargar configuraciones del sistema
        const [configRows] = await pool.query('SELECT * FROM egg_costing_configurations WHERE company_id = ?', [req.company_id]);
        const configs = {};
        configRows.forEach(c => { configs[c.setting_key] = parseFloat(c.setting_value) || 0; });

        // Cargar Químicos CIP
        const [cipRows] = await pool.query('SELECT * FROM egg_costing_cip_items WHERE company_id = ? AND status = "activo"', [req.company_id]);
        
        // Cargar Empaques
        const [packRows] = await pool.query('SELECT * FROM egg_costing_packaging WHERE company_id = ?', [req.company_id]);
        const packMap = {};
        packRows.forEach(p => { packMap[p.item_code] = parseFloat(p.unit_cost) || 0; });

        // Cargar Acuerdos de Clientes
        const [agreements] = await pool.query('SELECT * FROM egg_costing_customer_agreements WHERE company_id = ? AND status = "activo"', [req.company_id]);

        // A. CÁLCULO DE COSTO DE MATERIA PRIMA (HUEVO CÁSCARA -> LÍQUIDO)
        const safeLbsPerBox = Math.max(parseFloat(raw_egg_lbs_per_box) || 43.50, 1);
        const safeBoxCost = Math.max(parseFloat(raw_egg_box_cost) || 0, 0);
        const costPerLbRawEgg = safeBoxCost / safeLbsPerBox;
        const safeBatchSize = Math.max(parseFloat(batch_size_lbs) || 12000, 1);

        // Rendimiento base de quebrado según producto
        let liquidYieldPct = 0.83; // 83% líquido para huevo entero (17% cáscara)
        let productBase = (product_type || '').toLowerCase();
        let isSeparationMode = productBase.includes('separaci') || productBase.includes('separad') || productBase.includes('reconstituido');

        if (productBase.includes('clara') && !isSeparationMode) {
            liquidYieldPct = 0.5395;
        } else if (productBase.includes('yema') && !isSeparationMode) {
            liquidYieldPct = 0.2905;
        }

        // Sólidos y Balance Hídrico
        const bSolids = parseFloat(base_egg_solids) || 24.20;
        let tSolids = parseFloat(target_solids);
        if (isNaN(tSolids) || tSolids <= 0) {
            tSolids = (productBase.includes('plus') || isSeparationMode) ? 21.50 : bSolids;
        }

        let effectiveWaterPct = 0;
        let effectiveSugarPct = (sugar_added_pct !== null && sugar_added_pct !== undefined && !isNaN(parseFloat(sugar_added_pct)))
            ? Math.max(0, parseFloat(sugar_added_pct)) / 100
            : (productBase.includes('azucarada') ? 0.04 : 0);

        let effectiveSaltPct = (salt_added_pct !== null && salt_added_pct !== undefined && !isNaN(parseFloat(salt_added_pct)))
            ? Math.max(0, parseFloat(salt_added_pct)) / 100
            : (productBase.includes('salada') ? 0.10 : 0);

        let effectiveMilkPct = (milk_added_pct !== null && milk_added_pct !== undefined && !isNaN(parseFloat(milk_added_pct)))
            ? Math.max(0, parseFloat(milk_added_pct)) / 100
            : (productBase.includes('leche') ? 0.05 : 0);

        let baseLiquidCostPerLb = costPerLbRawEgg / Math.max(liquidYieldPct, 0.01);
        let additiveCostPerLb = 0;
        let mpCostPerLb = 0;
        let effectivePureEggFraction = 1;
        let separationData = null;

        if (isSeparationMode) {
            // --- MODELO OFICIAL ANDELSA: SEPARACIÓN DE CLARA + HUEVO FORMULADO CON YEMA & H2O ---
            const rawShellLbs = safeBatchSize;
            const grossRawCost = (rawShellLbs / safeLbsPerBox) * safeBoxCost;
            
            const totalLiquidLbs = rawShellLbs * 0.83; // 83% líquido neto
            const naturalClaraLbs = rawShellLbs * 0.5395; // 65% del líquido (53.95% del huevo cáscara)
            const naturalYemaLbs = rawShellLbs * 0.2905;  // 35% del líquido (29.05% del huevo cáscara)

            const claraSepRate = Math.min(100, Math.max(0, parseFloat(clara_separated_pct) || 100)) / 100;
            const claraForSaleLbs = naturalClaraLbs * claraSepRate;
            const remainingClaraLbs = naturalClaraLbs * (1 - claraSepRate);
            const claraPrice = Math.max(0, parseFloat(clara_sale_price_per_lb) || 1.35);
            const claraRevenue = claraForSaleLbs * claraPrice;

            // Sólidos totales disponibles
            const ySolids = parseFloat(yema_solids_pct) || 50.0;
            const targetSolidsPct = Math.max(15, parseFloat(tSolids) || 21.5);
            const solidsFromYema = naturalYemaLbs * (ySolids / 100);
            const solidsFromRemClara = remainingClaraLbs * 0.118; // 11.8% sólidos en clara
            const totalSolidsLbs = solidsFromYema + solidsFromRemClara;

            // Peso final formulado para alcanzar targetSolidsPct
            const finalFormulatedLbs = totalSolidsLbs / (targetSolidsPct / 100);
            const h2oRequiredLbs = Math.max(0, finalFormulatedLbs - naturalYemaLbs - remainingClaraLbs);
            const h2oGarrafones = h2oRequiredLbs / 42.0;

            // Aditivo estabilizador: Ácido cítrico al 0.1% a $2.10/lb
            const citricAcidLbs = finalFormulatedLbs * 0.001;
            const citricAcidCost = citricAcidLbs * 2.10;
            const h2oCost = h2oRequiredLbs * 0.001;
            const totalAdditiveCost = citricAcidCost + h2oCost;

            // Costo neto atribuible a la MP del huevo formulado:
            // Se resta el crédito/ingreso por la venta de la clara premium
            const netRawEggCost = Math.max(0, grossRawCost - claraRevenue) + totalAdditiveCost;
            const mpCostPerLbFormulated = finalFormulatedLbs > 0 ? netRawEggCost / finalFormulatedLbs : 0;

            mpCostPerLb = mpCostPerLbFormulated;
            effectiveWaterPct = finalFormulatedLbs > 0 ? h2oRequiredLbs / finalFormulatedLbs : 0;
            effectivePureEggFraction = finalFormulatedLbs > 0 ? (naturalYemaLbs + remainingClaraLbs) / finalFormulatedLbs : 1;

            const claraCostPerLb = (grossRawCost * 0.65) / Math.max(naturalClaraLbs, 1);
            const claraProfit = (claraPrice - claraCostPerLb) * claraForSaleLbs;

            separationData = {
                is_separation_mode: true,
                raw_shell_batch_lbs: rawShellLbs,
                gross_raw_cost: grossRawCost,
                natural_clara_lbs: naturalClaraLbs,
                clara_for_sale_lbs: claraForSaleLbs,
                clara_sale_price: claraPrice,
                clara_revenue: claraRevenue,
                clara_cost_per_lb: claraCostPerLb,
                clara_profit: claraProfit,
                natural_yema_lbs: naturalYemaLbs,
                remaining_clara_lbs: remainingClaraLbs,
                yema_solids_pct: ySolids,
                target_solids_pct: targetSolidsPct,
                total_solids_lbs: totalSolidsLbs,
                h2o_required_lbs: h2oRequiredLbs,
                h2o_garrafones: h2oGarrafones,
                citric_acid_lbs: citricAcidLbs,
                final_formulated_lbs: finalFormulatedLbs,
                total_additive_cost: totalAdditiveCost,
                net_raw_egg_cost: netRawEggCost,
                mp_cost_per_lb_formulated: mpCostPerLbFormulated,
                standard_mp_cost_without_separation: grossRawCost / Math.max(totalLiquidLbs, 1),
                mp_cost_reduction_per_lb: Math.max(0, (grossRawCost / Math.max(totalLiquidLbs, 1)) - mpCostPerLbFormulated)
            };
        } else {
            // Modelo de mezclado / adición estándar
            if (productBase.includes('plus') || water_added_pct !== null || (base_egg_solids && target_solids)) {
                if (water_added_pct !== null && water_added_pct !== undefined && !isNaN(parseFloat(water_added_pct))) {
                    effectiveWaterPct = Math.max(0, parseFloat(water_added_pct)) / 100;
                    tSolids = bSolids * (1 - effectiveWaterPct);
                } else if (bSolids > tSolids && bSolids > 0) {
                    effectiveWaterPct = Math.max(0, (bSolids - tSolids) / bSolids);
                } else if (productBase.includes('plus')) {
                    effectiveWaterPct = 0.08; // 8% estándar ANDELSA
                    tSolids = bSolids * (1 - effectiveWaterPct);
                }
            }

            if (effectiveSugarPct > 0) additiveCostPerLb += effectiveSugarPct * 0.45;
            if (effectiveSaltPct > 0) additiveCostPerLb += effectiveSaltPct * 0.15;
            if (effectiveMilkPct > 0) additiveCostPerLb += effectiveMilkPct * 1.80;
            if (effectiveWaterPct > 0) additiveCostPerLb += (effectiveWaterPct * 0.001) + 0.0015;

            effectivePureEggFraction = Math.max(0, 1 - effectiveWaterPct - effectiveSugarPct - effectiveSaltPct - effectiveMilkPct);
            mpCostPerLb = (baseLiquidCostPerLb * effectivePureEggFraction) + additiveCostPerLb;
        }

        // Desglose de formulación física para el batch
        const formulation = {
            product_type,
            base_liquid_pure_lbs: safeBatchSize * effectivePureEggFraction,
            water_added_pct: effectiveWaterPct * 100,
            water_lbs: safeBatchSize * effectiveWaterPct,
            water_garrafones: (safeBatchSize * effectiveWaterPct) / 42.0,
            citric_acid_pct: effectiveWaterPct > 0 ? 0.10 : 0,
            citric_acid_lbs: effectiveWaterPct > 0 ? safeBatchSize * 0.001 : 0,
            sugar_pct: effectiveSugarPct * 100,
            sugar_lbs: safeBatchSize * effectiveSugarPct,
            salt_pct: effectiveSaltPct * 100,
            salt_lbs: safeBatchSize * effectiveSaltPct,
            milk_pct: effectiveMilkPct * 100,
            milk_lbs: safeBatchSize * effectiveMilkPct,
            base_egg_solids: bSolids,
            target_solids: tSolids,
            is_solids_compliant: tSolids >= 21.0,
            pure_egg_cost_per_lb: baseLiquidCostPerLb,
            formulated_mp_cost_per_lb: mpCostPerLb,
            mp_cost_savings_per_lb: Math.max(0, baseLiquidCostPerLb - mpCostPerLb)
        };

        // B. COSTO DE LIMPIEZA CIP POR BATCH Y POR LIBRA
        let totalCipBatchCost = 0;
        cipRows.forEach(item => {
            const unitPrice = parseFloat(item.presentation_cost) / (parseFloat(item.presentation_qty) || 1);
            totalCipBatchCost += unitPrice * parseFloat(item.dose_per_batch);
        });
        if (totalCipBatchCost === 0) totalCipBatchCost = 50.85;
        const cipCostPerLb = totalCipBatchCost / safeBatchSize;

        // C. COSTO DE CALDERA, ENERGÍA, DIESEL Y AGUA (PASTEURIZADOR)
        const dieselGal = configs.boiler_diesel_gal_batch || 20.84;
        const dieselPrice = configs.boiler_diesel_price_gal || 4.14;
        const dieselTotal = dieselGal * dieselPrice;
        const electricityTotal = configs.boiler_kwh_cost_batch || 386.00;
        const waterTotal = configs.boiler_water_cost_batch || 17.34;
        const totalBoilerEnergyBatchCost = dieselTotal + electricityTotal + waterTotal;
        const boilerEnergyCostPerLb = totalBoilerEnergyBatchCost / safeBatchSize;

        // D. MANO DE OBRA DIRECTA (MOD)
        const modCostPerLb = configs.mod_cost_per_lb || 0.0500;

        // E. GASTOS INDIRECTOS DE FABRICACIÓN (GIF) PRORRATEADOS
        const monthlyGifTotal = custom_gif_monthly !== null ? custom_gif_monthly : (configs.monthly_gif_total || 24537.00);
        const monthlyProjectedLbs = Math.max(custom_monthly_volume_lbs !== null ? custom_monthly_volume_lbs : (configs.monthly_projected_lbs || 100000.00), 1);
        const gifCostPerLb = monthlyGifTotal / monthlyProjectedLbs;

        // F. COSTO BASE OPERACIONAL POR LIBRA (SIN EMPAQUE)
        // La materia prima formulada, el lavado CIP, la caldera/energía, la MOD y los GIF aplican por igual al lote líquido
        const baseOperatingCostPerLb = mpCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + gifCostPerLb;

        // G. CATÁLOGO COMPLETO DE PRESENTACIONES COMERCIALES Y EMPAQUES
        const presentationsCatalog = [
            {
                id: 'cubeta 30LB',
                name: 'Cubeta 30 Lbs (Estándar)',
                short_name: 'Cubeta 30 Lb',
                lbs: 30.0,
                type: 'bucket',
                container_code: 'CUBETA-30LB',
                container_cost: parseFloat(packMap['CUBETA-30LB'] !== undefined ? packMap['CUBETA-30LB'] : 2.40),
                lid_code: 'TAPA-30LB',
                lid_cost: parseFloat(packMap['TAPA-30LB'] !== undefined ? packMap['TAPA-30LB'] : 0.65),
                liner_code: 'LINER-30LB',
                liner_cost: parseFloat(packMap['LINER-30LB'] !== undefined ? packMap['LINER-30LB'] : 0.30),
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'cubeta 32LB',
                name: 'Cubeta 32 Lbs',
                short_name: 'Cubeta 32 Lb',
                lbs: 32.0,
                type: 'bucket',
                container_code: 'CUBETA-30LB',
                container_cost: parseFloat(packMap['CUBETA-30LB'] !== undefined ? packMap['CUBETA-30LB'] : 2.40),
                lid_code: 'TAPA-30LB',
                lid_cost: parseFloat(packMap['TAPA-30LB'] !== undefined ? packMap['TAPA-30LB'] : 0.65),
                liner_code: 'LINER-30LB',
                liner_cost: parseFloat(packMap['LINER-30LB'] !== undefined ? packMap['LINER-30LB'] : 0.30),
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'galon 8LB',
                name: 'Galón 8 Lbs',
                short_name: 'Galón 8 Lb',
                lbs: 8.0,
                type: 'bottle',
                container_code: 'GALON-8LB',
                container_cost: parseFloat(packMap['GALON-8LB'] !== undefined ? packMap['GALON-8LB'] : 0.85),
                lid_code: 'TAPA-GALON',
                lid_cost: parseFloat(packMap['TAPA-GALON'] !== undefined ? packMap['TAPA-GALON'] : 0.15),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'medio galon 4LB',
                name: 'Medio Galón 4 Lbs',
                short_name: 'Medio Galón 4 Lb',
                lbs: 4.0,
                type: 'bottle',
                container_code: 'MEDIO-GALON',
                container_cost: parseFloat(packMap['MEDIO-GALON'] !== undefined ? packMap['MEDIO-GALON'] : 0.55),
                lid_code: 'TAPA-MEDIO-GALON',
                lid_cost: parseFloat(packMap['TAPA-MEDIO-GALON'] !== undefined ? packMap['TAPA-MEDIO-GALON'] : 0.10),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'litro 2LB',
                name: 'Litro 2 Lbs',
                short_name: 'Litro 2 Lb',
                lbs: 2.0,
                type: 'flask',
                container_code: 'LITRO-2LB',
                container_cost: parseFloat(packMap['LITRO-2LB'] !== undefined ? packMap['LITRO-2LB'] : 0.35),
                lid_code: 'TAPA-LITRO',
                lid_cost: parseFloat(packMap['TAPA-LITRO'] !== undefined ? packMap['TAPA-LITRO'] : 0.08),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'medio litro 1LB',
                name: 'Medio Litro 1 Lb',
                short_name: 'Medio Litro 1 Lb',
                lbs: 1.0,
                type: 'flask',
                container_code: 'MEDIO-LITRO-1LB',
                container_cost: parseFloat(packMap['MEDIO-LITRO-1LB'] !== undefined ? packMap['MEDIO-LITRO-1LB'] : 0.25),
                lid_code: 'TAPA-MEDIO-LITRO',
                lid_cost: parseFloat(packMap['TAPA-MEDIO-LITRO'] !== undefined ? packMap['TAPA-MEDIO-LITRO'] : 0.05),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            }
        ];

        // Determinar presentación activa seleccionada en el formulario
        const presLower = (presentation || '').toLowerCase();
        let activePresentation = presentationsCatalog.find(p => {
            return p.id.toLowerCase() === presLower || 
                   (presLower.includes('32') && p.lbs === 32) ||
                   (presLower.includes('30') && p.lbs === 30) ||
                   (presLower.includes('8') && p.lbs === 8) ||
                   (presLower.includes('4') && p.lbs === 4) ||
                   (presLower.includes('2') && p.lbs === 2) ||
                   (presLower.includes('1') && p.lbs === 1);
        });
        if (!activePresentation) {
            activePresentation = presentationsCatalog[0]; // Cubeta 30 Lb por defecto
        }

        const presentationLbs = activePresentation.lbs;
        const packagingCostPerUnit = activePresentation.container_cost + activePresentation.lid_cost + activePresentation.liner_cost + activePresentation.label_cost;
        const packagingCostPerLb = packagingCostPerUnit / presentationLbs;

        // H. COSTO TOTAL POR LIBRA DE LA PRESENTACIÓN SELECCIONADA
        const totalCostPerLb = baseOperatingCostPerLb + packagingCostPerLb;

        // I. MATRIZ MULTIFORMATO COMPARATIVA POR PRESENTACIÓN (IMPACTO DE EMPAQUE)
        const targetPriceNum = parseFloat(target_sale_price_per_lb) || 0;
        const presentationsComparison = presentationsCatalog.map(p => {
            const packCostUnit = p.container_cost + p.lid_cost + p.liner_cost + p.label_cost;
            const packCostLb = packCostUnit / p.lbs;
            const totCostLb = baseOperatingCostPerLb + packCostLb;
            const totCostUnit = totCostLb * p.lbs;
            const unitsInBatch = Math.floor(safeBatchSize / p.lbs);

            // Precios sugeridos con márgenes comunes
            const priceSug15Lb = totCostLb / (1 - 0.15);
            const priceSug20Lb = totCostLb / (1 - 0.20);
            const priceSug25Lb = totCostLb / (1 - 0.25);
            const priceSug30Lb = totCostLb / (1 - 0.30);

            // Simulación con precio libre
            let simSalePriceUnit = 0;
            let simMarginLb = 0;
            let simMarginPct = 0;
            let simGainUnit = 0;
            let simBatchGain = 0;
            let simStatus = 'red';

            if (targetPriceNum > 0) {
                simSalePriceUnit = targetPriceNum * p.lbs;
                simMarginLb = targetPriceNum - totCostLb;
                simMarginPct = (simMarginLb / targetPriceNum) * 100;
                simGainUnit = simMarginLb * p.lbs;
                simBatchGain = simGainUnit * unitsInBatch;
                simStatus = simMarginPct >= 20 ? 'green' : (simMarginPct >= 10 ? 'yellow' : 'red');
            }

            const isCurrent = p.id.toLowerCase() === activePresentation.id.toLowerCase();

            return {
                id: p.id,
                name: p.name,
                short_name: p.short_name,
                lbs: p.lbs,
                type: p.type,
                is_current: isCurrent,
                packaging_cost_unit: packCostUnit,
                packaging_cost_lb: packCostLb,
                packaging_breakdown: {
                    container_code: p.container_code,
                    container_cost: p.container_cost,
                    lid_code: p.lid_code,
                    lid_cost: p.lid_cost,
                    liner_code: p.liner_code,
                    liner_cost: p.liner_cost,
                    label_code: p.label_code,
                    label_cost: p.label_cost
                },
                base_operating_cost_per_lb: baseOperatingCostPerLb,
                total_cost_per_lb: totCostLb,
                total_cost_per_unit: totCostUnit,
                units_in_batch: unitsInBatch,
                suggested_prices: {
                    margin_15: { price_lb: priceSug15Lb, price_unit: priceSug15Lb * p.lbs },
                    margin_20: { price_lb: priceSug20Lb, price_unit: priceSug20Lb * p.lbs },
                    margin_25: { price_lb: priceSug25Lb, price_unit: priceSug25Lb * p.lbs },
                    margin_30: { price_lb: priceSug30Lb, price_unit: priceSug30Lb * p.lbs }
                },
                simulation: {
                    target_price_lb: targetPriceNum,
                    sale_price_unit: simSalePriceUnit,
                    margin_per_lb: simMarginLb,
                    margin_pct: simMarginPct,
                    gain_per_unit: simGainUnit,
                    total_batch_gain: simBatchGain,
                    status: simStatus
                }
            };
        });

        // J. ANÁLISIS DE RENTABILIDAD CON CLIENTES
        const todayStr = new Date().toISOString().split('T')[0];
        const clientsComparison = agreements.map(agr => {
            const clientPrice = parseFloat(agr.agreed_price_per_lb) || 0;
            const freight = parseFloat(agr.freight_cost_per_lb) || 0;
            const effectiveCost = totalCostPerLb + freight;
            const marginPerLb = clientPrice - effectiveCost;
            const marginPct = clientPrice > 0 ? (marginPerLb / clientPrice) * 100 : 0;

            let status = 'red';
            if (marginPct >= (parseFloat(agr.target_margin_pct) || 20)) {
                status = 'green';
            } else if (marginPct >= 10) {
                status = 'yellow';
            }

            let bonoRate = 0;
            if (marginPct >= 20) bonoRate = 0.015;
            else if (marginPct >= 15) bonoRate = 0.010;
            else if (marginPct >= 10) bonoRate = 0.005;

            const monthlyVol = parseFloat(agr.monthly_volume_lbs) || 0;
            const monthlyRevenue = monthlyVol * clientPrice;
            const monthlyProfit = monthlyVol * marginPerLb;
            const simulatedBonus = monthlyRevenue * bonoRate;

            const fromStr = agr.valid_from ? new Date(agr.valid_from).toISOString().split('T')[0] : null;
            const toStr = agr.valid_to ? new Date(agr.valid_to).toISOString().split('T')[0] : null;
            let validityStatus = 'vigente';
            let daysRemaining = null;

            if (toStr && toStr < todayStr) {
                validityStatus = 'vencido';
            } else if (fromStr && fromStr > todayStr) {
                validityStatus = 'programado';
            } else if (toStr) {
                const diffTime = new Date(toStr) - new Date(todayStr);
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                validityStatus = daysRemaining <= 30 ? 'por_vencer' : 'vigente';
            }

            let isValidInPeriod = true;
            if (start_date && toStr && toStr < start_date) isValidInPeriod = false;
            if (end_date && fromStr && fromStr > end_date) isValidInPeriod = false;

            return {
                id: agr.id,
                customer_name: agr.customer_name,
                product_type: agr.product_type,
                presentation: agr.presentation,
                agreed_price: clientPrice,
                freight_per_lb: freight,
                effective_cost: effectiveCost,
                margin_per_lb: marginPerLb,
                margin_pct: marginPct,
                target_margin_pct: parseFloat(agr.target_margin_pct) || 20,
                status,
                valid_from: fromStr,
                valid_to: toStr,
                validity_status: validityStatus,
                days_remaining: daysRemaining,
                is_valid_in_period: isValidInPeriod,
                monthly_volume_lbs: monthlyVol,
                monthly_revenue: monthlyRevenue,
                monthly_profit: monthlyProfit,
                simulated_bonus: simulatedBonus,
                bono_rate_pct: bonoRate * 100
            };
        });

        // Matriz de Precios Sugeridos por Margen (10%, 15%, 20%, 25%, 30%)
        const marginTargets = [10, 15, 20, 25, 30];
        const marginMatrix = marginTargets.map(pct => {
            const suggestedPrice = totalCostPerLb > 0 ? totalCostPerLb / (1 - (pct / 100)) : 0;
            const gainPerLb = suggestedPrice - totalCostPerLb;
            const batchGain = gainPerLb * safeBatchSize;
            return {
                margin_target_pct: pct,
                suggested_price_per_lb: suggestedPrice,
                suggested_price_per_presentation: suggestedPrice * presentationLbs,
                gain_per_lb: gainPerLb,
                batch_gain: batchGain
            };
        });

        // Simulación con precio libre
        const targetPrice = parseFloat(target_sale_price_per_lb) || 0;
        const marginLb = targetPrice - totalCostPerLb;
        const marginPct = targetPrice > 0 ? (marginLb / targetPrice) * 100 : 0;
        const targetSimulation = {
            price: targetPrice,
            cost: totalCostPerLb,
            margin_per_lb: marginLb,
            margin_pct: marginPct,
            status: marginPct >= 20 ? 'green' : (marginPct >= 10 ? 'yellow' : 'red'),
            margin_matrix: marginMatrix
        };

        res.json({
            product_type,
            presentation,
            presentation_lbs: presentationLbs,
            batch_size_lbs,
            raw_egg_box_cost,
            breakdown: {
                base_operating_cost_per_lb: baseOperatingCostPerLb,
                mp_cost_per_lb: mpCostPerLb,
                packaging_cost_per_lb: packagingCostPerLb,
                packaging_cost_per_unit: packagingCostPerUnit,
                cip_cost_per_lb: cipCostPerLb,
                cip_total_batch_cost: totalCipBatchCost,
                boiler_energy_cost_per_lb: boilerEnergyCostPerLb,
                boiler_total_batch_cost: totalBoilerEnergyBatchCost,
                mod_cost_per_lb: modCostPerLb,
                gif_cost_per_lb: gifCostPerLb,
                gif_monthly_total: monthlyGifTotal,
                total_cost_per_lb: totalCostPerLb,
                cost_per_unit: totalCostPerLb * presentationLbs
            },
            formulation,
            separation_data: separationData,
            presentations_comparison: presentationsComparison,
            clients_comparison: clientsComparison,
            target_simulation: targetSimulation,
            parameters_used: {
                liquid_yield_pct: liquidYieldPct * 100,
                water_added_pct: effectiveWaterPct * 100,
                sugar_added_pct: effectiveSugarPct * 100,
                salt_added_pct: effectiveSaltPct * 100,
                milk_added_pct: effectiveMilkPct * 100,
                base_egg_solids: bSolids,
                target_solids: tSolids,
                monthly_projected_lbs: monthlyProjectedLbs,
                monthly_gif: monthlyGifTotal
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 7. ESCENARIOS GUARDADOS DE COSTEO
const getScenarios = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM egg_costing_scenarios WHERE company_id = ? ORDER BY created_at DESC',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveScenario = async (req, res) => {
    try {
        const { scenario_name, product_type, presentation, base_raw_egg_cost_per_box, batch_size_lbs, yield_liquid_pct, calculated_cost_per_lb, target_sale_price_per_lb, margin_pct, full_breakdown_json } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_costing_scenarios (company_id, scenario_name, product_type, presentation, base_raw_egg_cost_per_box, batch_size_lbs, yield_liquid_pct, calculated_cost_per_lb, target_sale_price_per_lb, margin_pct, full_breakdown_json, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, scenario_name, product_type, presentation, base_raw_egg_cost_per_box, batch_size_lbs, yield_liquid_pct, calculated_cost_per_lb, target_sale_price_per_lb, margin_pct, JSON.stringify(full_breakdown_json || {}), req.user?.nombre || 'Analista de Costos']
        );
        res.status(201).json({ id: result.insertId, message: 'Escenario guardado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteScenario = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM egg_costing_scenarios WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Escenario eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 8. HISTÓRICO DE COSTOS Y MIX DE PRODUCTO
const getCostingHistory = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        let query = `
            SELECT 
                DATE_FORMAT(b.started_at, '%Y-%m') as period,
                b.product_type,
                COUNT(b.id) as batches_count,
                SUM(b.input_weight_lbs) as total_input_lbs,
                SUM(b.yield_liquid_lbs) as total_yield_lbs,
                COALESCE(SUM(c.total_cost), 0) as total_cost,
                CASE WHEN SUM(b.yield_liquid_lbs) > 0 
                     THEN COALESCE(SUM(c.total_cost), 0) / SUM(b.yield_liquid_lbs) 
                     ELSE 0 END as avg_cost_per_lb
             FROM egg_production_batches b
             LEFT JOIN egg_industrial_costs c ON b.id = c.batch_id
             WHERE b.company_id = ?
        `;
        const params = [req.company_id];

        if (start_date && end_date) {
            query += ' AND DATE(b.started_at) BETWEEN ? AND ?';
            params.push(start_date, end_date);
        } else if (start_date) {
            query += ' AND DATE(b.started_at) >= ?';
            params.push(start_date);
        } else if (end_date) {
            query += ' AND DATE(b.started_at) <= ?';
            params.push(end_date);
        }

        query += `
             GROUP BY period, b.product_type
             ORDER BY period DESC, b.product_type ASC
             LIMIT 36
        `;
        const [history] = await pool.query(query, params);
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 9. COSTO ACTUAL REAL DE OPERACIÓN (EN VIVO SEGÚN RECEPCIONES, PRODUCCIÓN Y VENTAS)
const getActualOperationalCost = async (req, res) => {
    try {
        await ensureSeedData(req.company_id);
        const { start_date, end_date } = req.query;

        // 1. Recepciones de Materia Prima (Huevo Cáscara)
        let rawSql = `
            SELECT 
                COUNT(*) as total_receptions,
                COALESCE(SUM(weight_lbs), 0) as total_lbs_received,
                COALESCE(SUM(total_boxes), 0) as total_boxes_received,
                AVG(CASE WHEN total_boxes > 0 THEN weight_lbs / total_boxes ELSE 43.5 END) as avg_lbs_per_box
            FROM egg_raw_materials
            WHERE company_id = ? AND status = 'aprobado'
        `;
        const rawParams = [req.company_id];
        if (start_date && end_date) {
            rawSql += ` AND (
                (reception_date BETWEEN ? AND ?) OR 
                (reception_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)
            )`;
            rawParams.push(start_date, end_date, start_date, end_date);
        } else if (start_date) {
            rawSql += ` AND (reception_date >= ? OR (reception_date IS NULL AND DATE(created_at) >= ?))`;
            rawParams.push(start_date, start_date);
        } else if (end_date) {
            rawSql += ` AND (reception_date <= ? OR (reception_date IS NULL AND DATE(created_at) <= ?))`;
            rawParams.push(end_date, end_date);
        }

        const [rawStats] = await pool.query(rawSql, rawParams);

        // Buscar si hay costo promedio registrado en producto 'huevo cáscara' o default $38.00
        const [productCost] = await pool.query(
            `SELECT costo FROM products 
             WHERE company_id = ? AND (nombre LIKE '%huevo cáscara%' OR nombre LIKE '%huevo cascara%' OR nombre LIKE '%huevo en cascara%') 
             ORDER BY id DESC LIMIT 1`,
            [req.company_id]
        );
        const realBoxCost = productCost.length > 0 && parseFloat(productCost[0].costo) > 0 
            ? parseFloat(productCost[0].costo) 
            : 38.00;

        // 2. Lotes de Producción y Rendimiento Real de Quebrado
        let batchSql = `
            SELECT 
                COUNT(*) as total_batches,
                COALESCE(SUM(input_weight_lbs), 0) as total_input_lbs,
                COALESCE(SUM(yield_liquid_lbs), 0) as total_liquid_lbs,
                COALESCE(SUM(waste_shell_lbs), 0) as total_shell_lbs
            FROM egg_production_batches
            WHERE company_id = ? AND status != 'cancelado'
        `;
        const batchParams = [req.company_id];
        if (start_date && end_date) {
            batchSql += ` AND DATE(started_at) BETWEEN ? AND ?`;
            batchParams.push(start_date, end_date);
        } else if (start_date) {
            batchSql += ` AND DATE(started_at) >= ?`;
            batchParams.push(start_date);
        } else if (end_date) {
            batchSql += ` AND DATE(started_at) <= ?`;
            batchParams.push(end_date);
        }

        const [batchStats] = await pool.query(batchSql, batchParams);

        const totalInput = parseFloat(batchStats[0].total_input_lbs) || 0;
        const totalLiquid = parseFloat(batchStats[0].total_liquid_lbs) || 0;
        const totalShell = parseFloat(batchStats[0].total_shell_lbs) || 0;

        const actualYieldPct = totalInput > 0 && totalLiquid > 0 
            ? Math.min(100, Math.max(50, (totalLiquid / totalInput) * 100)) 
            : 83.00;
        const actualShellPct = totalInput > 0 && totalShell > 0 
            ? (totalShell / totalInput) * 100 
            : 17.00;

        // 3. Precios de Venta Pactados / Facturados vigentes en el rango
        let agrSql = `
            SELECT 
                COUNT(*) as count_agreements,
                COALESCE(AVG(agreed_price_per_lb), 0) as avg_contract_price,
                COALESCE(SUM(monthly_volume_lbs), 0) as total_contract_volume,
                COALESCE(SUM(agreed_price_per_lb * monthly_volume_lbs), 0) as total_contract_revenue
            FROM egg_costing_customer_agreements
            WHERE company_id = ? AND status = 'activo'
        `;
        const agrParams = [req.company_id];
        if (start_date && end_date) {
            agrSql += ` AND (
                (valid_from IS NULL AND valid_to IS NULL) OR
                (valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?))
            )`;
            agrParams.push(end_date, start_date);
        }

        const [agreements] = await pool.query(agrSql, agrParams);

        const totalVolume = parseFloat(agreements[0].total_contract_volume) || 0;
        const avgSalePrice = totalVolume > 0 
            ? parseFloat(agreements[0].total_contract_revenue) / totalVolume 
            : (parseFloat(agreements[0].avg_contract_price) || 1.25);

        // 4. Configs para costos fijos
        const [configRows] = await pool.query('SELECT * FROM egg_costing_configurations WHERE company_id = ?', [req.company_id]);
        const configs = {};
        configRows.forEach(c => { configs[c.setting_key] = parseFloat(c.setting_value) || 0; });

        const lbsPerBox = parseFloat(rawStats[0].avg_lbs_per_box) || 43.50;
        const mpCostPerLbRaw = realBoxCost / lbsPerBox;
        const actualMpCostPerLbLiquid = mpCostPerLbRaw / (actualYieldPct / 100);

        const packagingCostPerLb = 0.1128;
        const cipCostPerLb = 0.0042;
        const boilerEnergyCostPerLb = 0.0408;
        const modCostPerLb = configs.mod_cost_per_lb || 0.0500;
        
        const currentMonthlyVolume = totalLiquid > 0 ? Math.max(totalLiquid, 10000) : (configs.monthly_projected_lbs || 100000);
        const gifTotal = configs.monthly_gif_total || 24537;
        const actualGifCostPerLb = gifTotal / currentMonthlyVolume;

        const actualTotalCostPerLb = actualMpCostPerLbLiquid + packagingCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + actualGifCostPerLb;
        const actualMarginPerLb = avgSalePrice - actualTotalCostPerLb;
        const actualMarginPct = avgSalePrice > 0 ? (actualMarginPerLb / avgSalePrice) * 100 : 0;

        res.json({
            date_range: {
                start_date: start_date || null,
                end_date: end_date || null,
                is_filtered: !!(start_date || end_date)
            },
            operational_summary: {
                total_receptions: rawStats[0].total_receptions,
                total_lbs_received: parseFloat(rawStats[0].total_lbs_received),
                total_boxes_received: parseFloat(rawStats[0].total_boxes_received),
                avg_lbs_per_box: lbsPerBox,
                real_box_cost: realBoxCost,
                total_batches: batchStats[0].total_batches,
                total_input_lbs: totalInput,
                total_liquid_lbs: totalLiquid,
                total_shell_lbs: totalShell,
                actual_yield_pct: actualYieldPct,
                actual_shell_pct: actualShellPct,
                total_contract_volume: totalVolume,
                avg_sale_price_per_lb: avgSalePrice
            },
            actual_cost_breakdown: {
                mp_cost_per_lb: actualMpCostPerLbLiquid,
                packaging_cost_per_lb: packagingCostPerLb,
                cip_cost_per_lb: cipCostPerLb,
                boiler_energy_cost_per_lb: boilerEnergyCostPerLb,
                mod_cost_per_lb: modCostPerLb,
                gif_cost_per_lb: actualGifCostPerLb,
                total_actual_cost_per_lb: actualTotalCostPerLb,
                actual_margin_per_lb: actualMarginPerLb,
                actual_margin_pct: actualMarginPct,
                volume_basis_lbs: currentMonthlyVolume
            }
        });
    } catch (error) {
        console.error('Error calculando costo operacional:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCostingConfig,
    updateCostingConfig,
    getCipItems,
    saveCipItem,
    deleteCipItem,
    getPackagingItems,
    savePackagingItem,
    deletePackagingItem,
    getCustomerAgreements,
    saveCustomerAgreement,
    deleteCustomerAgreement,
    getAgreementHistory,
    calculateDynamicCost,
    getScenarios,
    saveScenario,
    deleteScenario,
    getCostingHistory,
    getActualOperationalCost,
    getCostingProductsLookup,
    syncPurchasesWithInvoices
};

