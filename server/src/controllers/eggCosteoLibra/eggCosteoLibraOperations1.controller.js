const { pool, ensureSeedData } = require('./shared');

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
module.exports = { getCostingConfig, updateCostingConfig, getCipItems, saveCipItem, deleteCipItem, getPackagingItems, savePackagingItem, getCostingProductsLookup };
