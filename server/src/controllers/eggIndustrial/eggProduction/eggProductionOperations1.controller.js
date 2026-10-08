const { pool, ensureEggSchema } = require('./shared');

const getCipLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT c.*,
                    b.batch_code_display,
                    b.batch_uuid,
                    b.product_type as batch_product
             FROM egg_cip_logs c
             LEFT JOIN egg_production_batches b ON c.batch_id = b.id
             WHERE c.company_id = ?
             ORDER BY c.created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createCipLog = async (req, res) => {
    try {
        const {
            equipment_name,
            chemical_used,
            temperature_c,
            duration_minutes,
            operator_name,
            validation_status,
            notes,
            cleaned_at,
            created_at,
            batch_id
        } = req.body;

        const customDate = cleaned_at || created_at || null;
        const targetBatchId = batch_id ? parseInt(batch_id, 10) : null;

        const [result] = await pool.query(
            `INSERT INTO egg_cip_logs (
                company_id,
                equipment_name,
                chemical_used,
                temperature_c,
                duration_minutes,
                operator_name,
                batch_id,
                validation_status,
                notes,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))`,
            [
                req.company_id,
                equipment_name,
                chemical_used,
                temperature_c,
                duration_minutes,
                operator_name || req.user?.nombre || 'Operador',
                targetBatchId,
                validation_status || 'completado',
                notes,
                customDate
            ]
        );

        // Crear evento
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'cip.completed', ?, ?, ?, ?)`,
            [
                req.company_id,
                validation_status === 'completado' ? 'info' : 'warning',
                `Sanitización CIP en equipo ${equipment_name} registrada con estado: ${validation_status || 'completado'}${targetBatchId ? ` (Vinculado a lote #${targetBatchId})` : ''}.`,
                JSON.stringify({ cip_id: result.insertId, equipment_name, batch_id: targetBatchId }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        res.status(201).json({ id: result.insertId, ...req.body, created_at: customDate || new Date().toISOString() });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const deleteCipLog = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM egg_cip_logs WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de sanitización CIP no encontrado.' });
        }

        await pool.query('DELETE FROM egg_cip_logs WHERE id = ? AND company_id = ?', [id, company_id]);

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'cip.deleted', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Registro de sanitización CIP #${id} (${existing[0].equipment_name}) eliminado por ${req.user?.nombre || 'Operador'}.`,
                JSON.stringify({ cip_id: parseInt(id), equipment_name: existing[0].equipment_name }),
                req.user?.nombre || 'Operador'
            ]
        );

        res.json({ success: true, message: 'Registro de sanitización CIP eliminado con éxito.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const quickSanitizeCip = async (req, res) => {
    try {
        const { operator_name, notes } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_cip_logs (company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes)
             VALUES (?, 'pasteurizador', 'Ácido Peracético 1.5% (Sanitización Express)', 78.50, 45, ?, 'completado', ?)`,
            [
                req.company_id,
                operator_name || req.user?.nombre || 'Operador de Planta',
                notes || 'Sanitización CIP express validada y aprobada para inicio de turno de producción.'
            ]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'cip.completed', 'info', ?, ?, ?)`,
            [
                req.company_id,
                'Sanitización CIP express en pasteurizador validada y completada.',
                JSON.stringify({ cip_id: result.insertId, equipment_name: 'pasteurizador' }),
                operator_name || req.user?.nombre || 'Operador de Planta'
            ]
        );

        res.status(201).json({ success: true, id: result.insertId, message: 'Sanitización CIP express registrada y aprobada.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getProductionBatches = async (req, res) => {
    try {
        await ensureEggSchema();
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company ID is required' });
        }
        let rows = [];
        try {
            const [queriedRows] = await pool.query(
                `SELECT b.*, esp.lot_code as scheduled_lot_code, esp.production_date as scheduled_production_date,
                        pb.batch_code_display as parent_batch_code, pb.product_type as parent_product_type
                 FROM egg_production_batches b
                 LEFT JOIN egg_scheduled_productions esp ON b.scheduled_production_id = esp.id
                 LEFT JOIN egg_production_batches pb ON b.parent_batch_id = pb.id
                 WHERE b.company_id = ?
                 ORDER BY b.started_at DESC`,
                [companyId]
            );
            rows = queriedRows;
        } catch (queryErr) {
            console.warn("[getProductionBatches] Query with join failed, falling back to direct batches query:", queryErr.message);
            const [fallbackRows] = await pool.query(
                `SELECT b.* FROM egg_production_batches b
                 WHERE b.company_id = ?
                 ORDER BY b.started_at DESC`,
                [companyId]
            );
            rows = fallbackRows;
        }

        for (const batch of rows) {
            try {
                const rootBatchId = batch.parent_batch_id || batch.id;
                const relatedIds = [batch.id];
                if (batch.parent_batch_id && !relatedIds.includes(batch.parent_batch_id)) {
                    relatedIds.push(batch.parent_batch_id);
                }

                const [materials] = await pool.query(
                    `SELECT brm.*, rm.egg_type, rm.provider_lot, rm.egg_color, rm.egg_size,
                            CASE WHEN brm.batch_id = ? THEN 0 ELSE 1 END as is_parent_material
                     FROM batch_raw_materials brm
                     JOIN egg_raw_materials rm ON brm.raw_material_id = rm.id
                     WHERE brm.batch_id IN (?)
                     ORDER BY is_parent_material DESC, brm.id ASC`,
                    [rootBatchId, relatedIds]
                );
                for (const m of materials) {
                    if (m.tarimas_json && typeof m.tarimas_json === 'string') {
                        try { m.tarimas = JSON.parse(m.tarimas_json); } catch (e) { m.tarimas = []; }
                    } else {
                        m.tarimas = m.tarimas_json || [];
                    }
                    m.is_initial = (m.batch_id === rootBatchId && batch.parent_batch_id) || Boolean(m.is_initial);
                    m.is_added = !m.is_initial;
                }
                batch.raw_materials = materials;
                const totalMatWeight = materials.reduce((sum, m) => sum + parseFloat(m.quantity_lbs || 0), 0);
                batch.total_input_weight_lbs = Math.max(parseFloat(batch.input_weight_lbs || 0), totalMatWeight);
            } catch (matErr) {
                console.warn(`[getProductionBatches] Error fetching materials for batch ${batch.id}:`, matErr.message);
                batch.raw_materials = [];
                batch.total_input_weight_lbs = parseFloat(batch.input_weight_lbs || 0);
            }

            try {
                const [pkgSum] = await pool.query(
                    'SELECT COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
                    [batch.id, companyId]
                );
                batch.packaged_weight_lbs = pkgSum[0]?.packaged_weight || 0;
            } catch (pkgErr) {
                console.warn(`[getProductionBatches] Error fetching packaged_weight for batch ${batch.id}:`, pkgErr.message);
                batch.packaged_weight_lbs = 0;
            }

            try {
                const [varCosts] = await pool.query(
                    'SELECT * FROM egg_batch_variable_costs WHERE batch_id = ? AND company_id = ?',
                    [batch.id, companyId]
                );
                batch.variable_costs = varCosts;
            } catch (vcErr) {
                batch.variable_costs = [];
            }

            try {
                const [remanentes] = await pool.query(
                    'SELECT * FROM egg_batch_remanentes WHERE target_batch_id = ? AND company_id = ?',
                    [batch.id, companyId]
                );
                batch.remanentes_used = remanentes;
            } catch (remErr) {
                batch.remanentes_used = [];
            }
        }

        res.json(rows);
    } catch (error) {
        console.error("Error in getProductionBatches:", error);
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { getCipLogs, createCipLog, deleteCipLog, quickSanitizeCip, getProductionBatches };
