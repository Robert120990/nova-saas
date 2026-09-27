const { eggRules, pool, eggExportService } = require('./shared');

const getBatchStages = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const data = await eggExportService.getBatchExportData(id, company_id);
        if (!data) return res.status(404).json({ message: 'Lote no encontrado.' });

        const { batch, rawMaterials, pasteurizationLogs, remanentes, packagingRecords, wasteLogs, totals } = data;

        // Construir el desglose de las 4 etapas
        const stages = [
            {
                step: 1,
                id: 'quebraje',
                title: 'Inicio de Producción y Quebraje de Tarimas',
                subtitle: 'Recepción, pesaje y quebraje de huevo en cáscara / líquido',
                status: batch.input_weight_lbs > 0 ? 'completado' : 'pendiente',
                started_at: batch.started_at,
                data: {
                    total_input_lbs: totals.totalInputWeight,
                    total_boxes: rawMaterials.reduce((s, r) => s + parseInt(r.boxes_count || 0, 10), 0),
                    raw_materials_count: rawMaterials.length,
                    raw_materials: rawMaterials
                }
            },
            {
                step: 2,
                id: 'pasteurizacion',
                title: 'Pasteurización Térmica y Lotes Duales',
                subtitle: 'Tratamiento térmico, curva de temperatura, caudal y presión',
                status: pasteurizationLogs.length > 0 ? 'completado' : (batch.status === 'en_proceso' ? 'en_progreso' : 'pendiente'),
                data: {
                    logs_count: pasteurizationLogs.length,
                    logs: pasteurizationLogs,
                    target_brix: batch.target_brix,
                    target_solids_pct: batch.target_solids_pct,
                    yield_liquid_lbs: totals.liquidYield,
                    waste_shell_lbs: totals.shellWaste,
                    is_dual_compatible: true
                }
            },
            {
                step: 3,
                id: 'remanentes',
                title: 'Remanentes, Reprocesos y Reutilizables',
                subtitle: 'Gestión de sobrantes (ej. huevo en leche), mezclas y reprocesos',
                status: remanentes.length > 0 ? 'activo' : 'opcional',
                data: {
                    total_remanente_lbs: totals.remanenteWeight,
                    remanentes: remanentes
                }
            },
            {
                step: 4,
                id: 'envasado',
                title: 'Envasado Comercial, Mermas y Balance Final',
                subtitle: 'Empaque en cubetas/galones, detección de faltante y cierre oficial',
                status: batch.packaging_status === 'cerrado' ? 'completado' : (packagingRecords.length > 0 ? 'en_envasado' : 'pendiente'),
                data: {
                    packaged_weight_lbs: totals.packagedWeight,
                    packaged_records_count: packagingRecords.length,
                    packaging_records: packagingRecords,
                    packaging_status: batch.packaging_status || 'pendiente',
                    packaging_loss_lbs: parseFloat(batch.packaging_loss_lbs || 0),
                    packaging_efficiency_pct: parseFloat(batch.packaging_efficiency_pct || totals.packagingEfficiencyPct),
                    waste_logs: wasteLogs
                }
            }
        ];

        // Mapeo defensivo de remanentes para visualización y edición
        const mappedRemanentes = (remanentes || []).map(r => ({
            id: r.id,
            batch_id: r.batch_id,
            remanente_code: `REM-${r.id}`,
            product_type: r.product_type,
            weight_lbs: parseFloat(r.quantity_lbs || r.weight_lbs || 0),
            quantity_lbs: parseFloat(r.quantity_lbs || r.weight_lbs || 0),
            remanente_type: r.remanente_type,
            is_pasteurized: r.remanente_type === 'pasteurizado' || r.is_pasteurized === 1 || r.is_pasteurized === true,
            storage_location: r.storage_location,
            destination: r.storage_location || 'proximo_empaque',
            status: r.status,
            notes: r.notes || '',
            operator_name: r.operator_name || ''
        }));

        // Mapeo defensivo de mermas para visualización y edición
        const mappedWastes = (wasteLogs || []).map(w => ({
            id: w.id,
            batch_id: w.batch_id,
            stage: w.stage,
            waste_type: w.waste_type,
            weight_lbs: parseFloat(w.quantity_lbs || w.weight_lbs || 0),
            quantity_lbs: parseFloat(w.quantity_lbs || w.weight_lbs || 0),
            reason: w.reason || w.notes || '',
            notes: w.reason || w.notes || '',
            operator_name: w.operator_name || ''
        }));

        res.json({
            batch,
            totals,
            stages,
            raw_materials: rawMaterials,
            tarimas: data.tarimasUsed || rawMaterials.flatMap(r => (r.tarimas || []).map(t => ({ ...t, provider_lot: r.provider_lot, egg_type: r.egg_type }))),
            remanentes_used: data.remanentesUsed || [],
            pasteurize_log: pasteurizationLogs[pasteurizationLogs.length - 1] || null,
            pasteurization_logs: pasteurizationLogs,
            remanentes: mappedRemanentes,
            wastes: mappedWastes,
            waste_logs: mappedWastes,
            packaging_records: packagingRecords
        });
    } catch (error) {
        console.error('Error in getBatchStages:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getBatchWastes = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM egg_batch_waste_logs WHERE batch_id = ? AND company_id = ? ORDER BY created_at DESC',
            [id, req.company_id]
        );
        const mapped = rows.map(w => ({
            ...w,
            weight_lbs: parseFloat(w.quantity_lbs || 0),
            notes: w.reason || ''
        }));
        res.json(mapped);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createBatchWaste = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage, waste_type, quantity_lbs, weight_lbs, reason, notes, operator_name } = req.body;
        const company_id = req.company_id;

        await eggRules.owned(pool, 'egg_production_batches', id, company_id);
        const qty = eggRules.number(quantity_lbs ?? weight_lbs, 'Peso de remanente', 0.001);
        if (qty <= 0) return res.status(400).json({ message: 'La cantidad de merma debe ser mayor a cero.' });

        const wasteReason = reason || notes || null;
        const [result] = await pool.query(
            `INSERT INTO egg_batch_waste_logs (company_id, batch_id, stage, waste_type, quantity_lbs, reason, operator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [company_id, id, stage || 'quebraje', waste_type || 'merma_operativa', qty, wasteReason, operator_name || req.user?.nombre || null]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'waste.logged', 'info', ?, ?, ?)`,
            [
                company_id,
                `Registrada merma de ${qty} Lbs en etapa ${stage} para lote #${id}.`,
                JSON.stringify({ waste_id: result.insertId, batch_id: parseInt(id), quantity_lbs: qty, stage, reason: wasteReason }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        res.status(201).json({ id: result.insertId, success: true, message: 'Merma registrada exitosamente.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const updateBatchWaste = async (req, res) => {
    try {
        const targetId = req.params.wasteId || req.params.id;
        const { stage, waste_type, quantity_lbs, weight_lbs, reason, notes, operator_name } = req.body;
        const qty = parseFloat(quantity_lbs ?? weight_lbs ?? 0);
        const wasteReason = reason ?? notes ?? null;

        await pool.query(
            `UPDATE egg_batch_waste_logs
             SET stage = COALESCE(?, stage),
                 waste_type = COALESCE(?, waste_type),
                 quantity_lbs = CASE WHEN ? > 0 THEN ? ELSE quantity_lbs END,
                 reason = COALESCE(?, reason),
                 operator_name = COALESCE(?, operator_name)
             WHERE id = ? AND company_id = ?`,
            [stage || null, waste_type || null, qty, qty, wasteReason, operator_name || null, targetId, req.company_id]
        );
        res.json({ success: true, message: 'Merma actualizada exitosamente.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const deleteBatchWaste = async (req, res) => {
    try {
        const targetId = req.params.wasteId || req.params.id;
        await pool.query('DELETE FROM egg_batch_waste_logs WHERE id = ? AND company_id = ?', [targetId, req.company_id]);
        res.json({ success: true, message: 'Registro de merma eliminado.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getBatchRemanentes = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM egg_batch_remanentes WHERE batch_id = ? AND company_id = ? ORDER BY created_at DESC',
            [id, req.company_id]
        );
        const mapped = rows.map(r => ({
            ...r,
            remanente_code: `REM-${r.id}`,
            weight_lbs: parseFloat(r.quantity_lbs || 0),
            is_pasteurized: r.remanente_type === 'pasteurizado',
            destination: r.storage_location || 'proximo_empaque'
        }));
        res.json(mapped);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getAvailableRemanentes = async (req, res) => {
    try {
        const includeBatchId = req.query.include_batch_id ? parseInt(req.query.include_batch_id, 10) : null;
        const showAll = req.query.all === 'true' || req.query.status === 'all';
        let query = `SELECT r.*, b.batch_code_display, b.batch_uuid
             FROM egg_batch_remanentes r
             JOIN egg_production_batches b ON r.batch_id = b.id
             WHERE r.company_id = ? `;
        const params = [req.company_id];

        if (showAll) {
            // Todos los estados recientes
        } else if (includeBatchId) {
            query += ` AND (r.status = 'disponible' OR r.target_batch_id = ?)`;
            params.push(includeBatchId);
        } else {
            query += ` AND r.status = 'disponible'`;
        }
        query += ` ORDER BY r.created_at DESC LIMIT 100`;

        const [rows] = await pool.query(query, params);
        const mapped = rows.map(r => ({
            ...r,
            remanente_code: `REM-${r.id}`,
            weight_lbs: parseFloat(r.quantity_lbs || 0),
            is_pasteurized: r.remanente_type === 'pasteurizado',
            destination: r.storage_location || 'proximo_empaque'
        }));
        res.json(mapped);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createBatchRemanente = async (req, res) => {
    try {
        const { id } = req.params;
        const { product_type, presentation, remanente_type, quantity_lbs, weight_lbs, storage_location, destination, notes, operator_name, created_by, is_pasteurized } = req.body;
        const company_id = req.company_id;

        const qty = parseFloat(quantity_lbs ?? weight_lbs ?? 0);
        if (qty <= 0) return res.status(400).json({ message: 'La cantidad debe ser mayor a cero.' });

        const remType = remanente_type || (is_pasteurized === false ? 'no_pasteurizado' : 'pasteurizado');
        const loc = storage_location || destination || 'Tanque Pulmón / Cámara';

        const [result] = await pool.query(
            `INSERT INTO egg_batch_remanentes (company_id, batch_id, product_type, remanente_type, quantity_lbs, storage_location, notes, operator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_id, id, product_type || 'huevo entero',
                remType, qty,
                loc, notes || null,
                operator_name || created_by || req.user?.nombre || null
            ]
        );

        res.status(201).json({ id: result.insertId, success: true, message: 'Remanente / Reproceso registrado con éxito.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { getBatchStages, getBatchWastes, createBatchWaste, updateBatchWaste, deleteBatchWaste, getBatchRemanentes, getAvailableRemanentes, createBatchRemanente };
