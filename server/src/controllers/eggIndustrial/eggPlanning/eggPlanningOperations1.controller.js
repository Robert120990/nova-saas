const { pool } = require('./shared');

const getForecasting = async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT DATE_FORMAT(delivered_at, '%Y-%m') AS period,
            SUM(quantity_lbs) AS lbs FROM egg_customer_orders
            WHERE company_id = ? AND delivery_status = 'entregado'
            AND delivered_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 6 MONTH)
            AND delivered_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')
            GROUP BY period ORDER BY period`, [req.company_id]);
        const historical = rows.map(row => Number(row.lbs));
        if (rows.length < 4) return res.json({ historical, periods: rows.map(r => r.period), forecast: null,
            recommended_purchase_raw_material_lbs: null, confidence_interval: null, safety_stock: null,
            status: 'insufficient_data', is_simulation: false, message: 'Se requieren al menos cuatro meses completos con entregas.' });
        const forecast = Math.round(historical.reduce((sum, value, i) => sum + value * (i + 1), 0) / historical.reduce((sum, _, i) => sum + i + 1, 0));
        res.json({ historical, periods: rows.map(r => r.period), forecast, confidence_interval: null,
            recommended_purchase_raw_material_lbs: null, safety_stock: null, status: 'estimated', is_simulation: false,
            message: 'Estimación de libras entregadas; la compra requiere receta y rendimiento por producto.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

const getIndustrialEvents = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM egg_industrial_events WHERE company_id = ? ORDER BY created_at DESC LIMIT 100`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProductConfig = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM egg_product_config WHERE company_id = ? ORDER BY product_type',
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateProductConfig = async (req, res) => {
    try {
        const { product_type, weight_per_unit_lbs, yield_pct, waste_shell_pct, waste_loss_pct } = req.body;

        await pool.query(
            `INSERT INTO egg_product_config (company_id, product_type, weight_per_unit_lbs, yield_pct, waste_shell_pct, waste_loss_pct)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE weight_per_unit_lbs = VALUES(weight_per_unit_lbs), yield_pct = VALUES(yield_pct), waste_shell_pct = VALUES(waste_shell_pct), waste_loss_pct = VALUES(waste_loss_pct)`,
            [req.company_id, product_type, weight_per_unit_lbs || 32.00, yield_pct || 85.00, waste_shell_pct || 12.00, waste_loss_pct || 3.00]
        );
        res.json({ product_type, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProviderLotConfigs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.*, p.nombre as provider_name, p.nombre_comercial, p.nrc as provider_nrc,
                    (SELECT rm.provider_lot
                     FROM egg_raw_materials rm
                     WHERE rm.provider_id = c.provider_id AND rm.company_id = c.company_id
                     ORDER BY rm.id DESC LIMIT 1) as last_registered_lot,
                    (SELECT rm.fecha
                     FROM egg_raw_materials rm
                     WHERE rm.provider_id = c.provider_id AND rm.company_id = c.company_id
                     ORDER BY rm.id DESC LIMIT 1) as last_registered_date
             FROM egg_provider_lot_configurations c
             JOIN providers p ON c.provider_id = p.id
             WHERE c.company_id = ?
             ORDER BY p.nombre ASC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveProviderLotConfig = async (req, res) => {
    try {
        const { provider_id, lot_prefix, notes } = req.body;
        const format_pattern = req.body.format_pattern || req.body.suffix_format || 'correlativo';
        const next_correlative = req.body.next_correlative || 1;
        const tare_tarima_lbs = req.body.tare_tarima_lbs !== undefined ? parseFloat(req.body.tare_tarima_lbs) : 0.00;
        const tare_separador_lbs = req.body.tare_separador_lbs !== undefined ? parseFloat(req.body.tare_separador_lbs) : 48.00;
        const tare_caja_lbs = req.body.tare_caja_lbs !== undefined ? parseFloat(req.body.tare_caja_lbs) : 30.00;
        const base_boxes_per_tarima = req.body.base_boxes_per_tarima !== undefined ? parseInt(req.body.base_boxes_per_tarima) : 24;
        const default_has_caja = req.body.default_has_caja !== undefined ? (req.body.default_has_caja ? 1 : 0) : 1;

        if (!provider_id || !lot_prefix) {
            return res.status(400).json({ message: 'Proveedor y prefijo de lote son obligatorios.' });
        }
        await pool.query(
            `INSERT INTO egg_provider_lot_configurations
             (company_id, provider_id, lot_prefix, format_pattern, tare_tarima_lbs, tare_separador_lbs, tare_caja_lbs, base_boxes_per_tarima, default_has_caja, next_correlative, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                lot_prefix = VALUES(lot_prefix),
                format_pattern = VALUES(format_pattern),
                tare_tarima_lbs = VALUES(tare_tarima_lbs),
                tare_separador_lbs = VALUES(tare_separador_lbs),
                tare_caja_lbs = VALUES(tare_caja_lbs),
                base_boxes_per_tarima = VALUES(base_boxes_per_tarima),
                default_has_caja = VALUES(default_has_caja),
                next_correlative = VALUES(next_correlative),
                notes = VALUES(notes),
                updated_at = NOW()`,
            [req.company_id, provider_id, lot_prefix.trim().toUpperCase(), format_pattern, tare_tarima_lbs, tare_separador_lbs, tare_caja_lbs, base_boxes_per_tarima, default_has_caja, next_correlative, notes || null]
        );
        res.json({ success: true, message: 'Configuración de lote guardada correctamente.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteProviderLotConfig = async (req, res) => {
    try {
        await pool.query('DELETE FROM egg_provider_lot_configurations WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        res.json({ success: true, message: 'Configuración eliminada.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getProviderLotIntelligence = async (req, res) => {
    try {
        const providerId = req.params.providerId;
        const [configs] = await pool.query(
            'SELECT * FROM egg_provider_lot_configurations WHERE provider_id = ? AND company_id = ?',
            [providerId, req.company_id]
        );
        const [prov] = await pool.query(
            'SELECT id, nombre, nombre_comercial FROM providers WHERE id = ? AND company_id = ?',
            [providerId, req.company_id]
        );
        const [history] = await pool.query(
            `SELECT id, provider_lot, fecha, weight_lbs, total_boxes, created_at
             FROM egg_raw_materials
             WHERE provider_id = ? AND company_id = ?
             ORDER BY id DESC LIMIT 5`,
            [providerId, req.company_id]
        );

        const config = configs[0] || null;
        const provider = prov[0] || null;
        const lastLot = history[0]?.provider_lot || null;

        let prefix = config?.lot_prefix;
        if (!prefix && provider) {
            const name = (provider.nombre_comercial || provider.nombre || '').toUpperCase();
            if (name.includes('HECTOR') || name.includes('HÉCTOR')) prefix = 'HD-25918';
            else if (name.includes('CANDY')) prefix = 'GC-CANDY';
            else if (name.includes('GRANJA') || name.includes('AVICOLA') || name.includes('AVÍCOLA')) prefix = 'LOTE-AV';
            else {
                const cleanName = name.replace(/[^A-Z0-9\s]/g, '').trim();
                const words = cleanName.split(/\s+/).filter(w => w.length > 2 && !['SOCIEDAD', 'ANONIMA', 'CAPITAL', 'VARIABLE', 'S.A.', 'C.V.', 'DE', 'RL'].includes(w));
                prefix = words.length >= 2 ? `${words[0].slice(0, 3)}-${words[1].slice(0, 4)}` : `LOTE-${(cleanName.slice(0, 4) || 'PROV')}`;
            }
        }
        if (!prefix) prefix = 'LOTE-PROV';

        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${month}${day}`;
        const pattern = config?.format_pattern || 'PREFIX-DATE';

        let suggestedLot = `${prefix}-${dateStr}`;
        if (pattern === 'PREFIX-CORRELATIVO') {
            const nextCorr = String(config?.next_correlative || (history.length + 1)).padStart(3, '0');
            suggestedLot = `${prefix}-${nextCorr}`;
        }

        res.json({
            provider,
            config,
            prefix,
            last_registered_lot: lastLot,
            last_registered_date: history[0]?.fecha || null,
            suggested_lot: suggestedLot,
            historical_lots: history
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getScheduledProductions = async (req, res) => {
    try {
        const { start_date, end_date, status, product_profile } = req.query;
        let sql = `
            SELECT p.*, b.batch_code_display, b.status as batch_status, b.started_at as batch_started_at, b.completed_at as batch_completed_at
            FROM egg_scheduled_productions p
            LEFT JOIN egg_production_batches b ON p.batch_id = b.id
            WHERE p.company_id = ?
        `;
        const company_id = req.company_id || req.user?.company_id;
        const params = [company_id];

        if (start_date) {
            sql += ' AND p.production_date >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND p.production_date <= ?';
            params.push(end_date);
        }
        if (status) {
            if (status.includes(',')) {
                const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
                sql += ` AND p.status IN (${statusList.map(() => '?').join(',')})`;
                params.push(...statusList);
            } else {
                sql += ' AND p.status = ?';
                params.push(status);
            }
        }
        if (product_profile) {
            sql += ' AND p.product_profile = ?';
            params.push(product_profile);
        }

        sql += ' ORDER BY p.production_date ASC, p.start_time ASC';
        const [productions] = await pool.query(sql, params);

        // Adjuntar tareas asignadas a cada producción
        for (const prod of productions) {
            const [tasks] = await pool.query(
                `SELECT t.*, u.username, u.nombre as user_full_name
                 FROM egg_scheduled_tasks t
                 LEFT JOIN users u ON t.user_id = u.id
                 WHERE t.scheduled_production_id = ?
                 ORDER BY t.id ASC`,
                [prod.id]
            );
            prod.tasks = tasks;

            // Parsear mix_formula_json si viene como string
            if (typeof prod.mix_formula_json === 'string') {
                try {
                    prod.mix_formula_json = JSON.parse(prod.mix_formula_json);
                } catch (e) {
                    prod.mix_formula_json = {};
                }
            }
        }

        res.json(productions);
    } catch (error) {
        console.error('Error al listar producciones programadas:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getForecasting, getIndustrialEvents, getProductConfig, updateProductConfig, getProviderLotConfigs, saveProviderLotConfig, deleteProviderLotConfig, getProviderLotIntelligence, getScheduledProductions };
