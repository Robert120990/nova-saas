const { pool } = require('./shared');

const getQualityParameters = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { product_type } = req.query;
        let sql = 'SELECT * FROM egg_quality_parameters WHERE company_id = ?';
        const params = [company_id];
        if (product_type && product_type !== 'todos') {
            sql += ' AND (applicable_product = "todos" OR applicable_product = ?)';
            params.push(product_type);
        }
        sql += ' ORDER BY category ASC, sort_order ASC, id ASC';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching quality parameters:', error);
        res.status(500).json({ message: error.message });
    }
};

const saveQualityParameter = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const {
            id, category, parameter_name, specification, default_value,
            unit, applicable_product, expected_criterion, sort_order, is_active
        } = req.body;

        if (!parameter_name || !specification) {
            return res.status(400).json({ message: 'El nombre del parámetro y la especificación son requeridos.' });
        }

        if (id) {
            await pool.query(`
                UPDATE egg_quality_parameters SET
                    category = ?, parameter_name = ?, specification = ?, default_value = ?,
                    unit = ?, applicable_product = ?, expected_criterion = ?,
                    sort_order = ?, is_active = ?
                WHERE id = ? AND company_id = ?
            `, [
                category || 'microbiologico', parameter_name, specification, default_value || null,
                unit || null, applicable_product || 'todos', expected_criterion || 'CONFORME',
                parseInt(sort_order) || 0, is_active === false || is_active === 0 ? 0 : 1,
                id, company_id
            ]);
            return res.json({ message: 'Parámetro actualizado exitosamente', id });
        } else {
            const [result] = await pool.query(`
                INSERT INTO egg_quality_parameters (
                    company_id, category, parameter_name, specification, default_value,
                    unit, applicable_product, expected_criterion, sort_order, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                company_id, category || 'microbiologico', parameter_name, specification, default_value || null,
                unit || null, applicable_product || 'todos', expected_criterion || 'CONFORME',
                parseInt(sort_order) || 0, is_active === false || is_active === 0 ? 0 : 1
            ]);
            return res.status(201).json({ message: 'Parámetro creado exitosamente', id: result.insertId });
        }
    } catch (error) {
        console.error('Error saving quality parameter:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteQualityParameter = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { id } = req.params;
        await pool.query('DELETE FROM egg_quality_parameters WHERE id = ? AND company_id = ?', [id, company_id]);
        res.json({ message: 'Parámetro de calidad eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting quality parameter:', error);
        res.status(500).json({ message: error.message });
    }
};

const getLabLogs = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { batch_id, release_status, mb_status, fq_status, status, search } = req.query;
        let sql = `
            SELECT l.*,
                   b.batch_code_display, b.product_type, b.batch_uuid, b.started_at, b.status as batch_status,
                   b.yield_liquid_lbs, b.measured_solids_pct, b.measured_brix,
                   (SELECT lot_code FROM egg_packaging_records WHERE batch_id = b.id ORDER BY id DESC LIMIT 1) as pkg_lot_code,
                   (SELECT quality_status FROM egg_packaging_records WHERE batch_id = b.id ORDER BY id DESC LIMIT 1) as pkg_quality_status,
                   (SELECT SUM(units_packaged) FROM egg_packaging_records WHERE batch_id = b.id) as pkg_total_units,
                   c.nombre as customer_nombre_db, c.correo as customer_correo
            FROM egg_lab_micro_logs l
            JOIN egg_production_batches b ON l.batch_id = b.id
            LEFT JOIN customers c ON l.customer_id = c.id
            WHERE l.company_id = ?
        `;
        const params = [company_id];
        if (batch_id) {
            sql += ' AND l.batch_id = ?';
            params.push(batch_id);
        }
        if (release_status && release_status !== 'todos') {
            sql += ' AND l.release_status = ?';
            params.push(release_status);
        }
        if (mb_status && mb_status !== 'todos') {
            sql += ' AND l.mb_status = ?';
            params.push(mb_status);
        }
        if (fq_status && fq_status !== 'todos') {
            sql += ' AND l.fq_status = ?';
            params.push(fq_status);
        }
        if (status && status !== 'todos') {
            sql += ' AND l.status = ?';
            params.push(status);
        }
        if (search) {
            sql += ' AND (b.batch_code_display LIKE ? OR l.commercial_lot_code LIKE ? OR b.product_type LIKE ? OR l.analyst_name LIKE ?)';
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }
        sql += ' ORDER BY l.sample_date DESC, l.id DESC';
        const [rows] = await pool.query(sql, params);

        // Parsear custom_parameters si viene como string
        const parsedRows = rows.map(r => {
            let customParams = null;
            if (r.custom_parameters) {
                try {
                    customParams = typeof r.custom_parameters === 'string' ? JSON.parse(r.custom_parameters) : r.custom_parameters;
                } catch {
                    customParams = null;
                }
            }
            return {
                ...r,
                custom_parameters: customParams
            };
        });

        // Auto-detectar lotes en producción o empaque que aún no tengan registro en egg_lab_micro_logs
        if (!release_status || release_status === 'todos' || release_status === 'cuarentena') {
            try {
                const [pendingBatches] = await pool.query(`
                    SELECT b.id as batch_id, b.batch_code_display, b.product_type, b.presentation, b.batch_uuid, b.started_at,
                           b.measured_solids_pct, b.measured_brix, b.status as batch_status, b.yield_liquid_lbs,
                           (SELECT lot_code FROM egg_packaging_records WHERE batch_id = b.id ORDER BY id DESC LIMIT 1) as commercial_lot_code,
                           (SELECT quality_status FROM egg_packaging_records WHERE batch_id = b.id ORDER BY id DESC LIMIT 1) as pkg_quality_status,
                           (SELECT SUM(units_packaged) FROM egg_packaging_records WHERE batch_id = b.id) as pkg_total_units
                    FROM egg_production_batches b
                    WHERE b.company_id = ?
                      AND b.status IN ('aprobado_calidad', 'congelado', 'empaquetado', 'pasteurizado', 'completado', 'en_proceso')
                      AND b.id NOT IN (SELECT DISTINCT batch_id FROM egg_lab_micro_logs WHERE batch_id IS NOT NULL AND company_id = ?)
                    ORDER BY b.started_at DESC
                    LIMIT 50
                `, [company_id, company_id]);

                const existingBatchIds = new Set(parsedRows.map(p => p.batch_id));

                for (const pb of pendingBatches) {
                    if (existingBatchIds.has(pb.batch_id)) continue;
                    existingBatchIds.add(pb.batch_id);

                    const isFullyApproved = false; // Sin análisis persistido no hay dictamen ni resultados.

                    parsedRows.push({
                        id: `auto-${pb.batch_id}`,
                        batch_id: pb.batch_id,
                        commercial_lot_code: pb.commercial_lot_code || pb.batch_code_display || pb.batch_uuid,
                        batch_code_display: pb.batch_code_display || pb.commercial_lot_code || pb.batch_uuid,
                        product_type: pb.product_type || 'Huevo Entero Pasteurizado',
                        presentation: pb.presentation || 'Cubeta 30 Lb',
                        started_at: pb.started_at,
                        sample_date: pb.started_at,
                        customer_id: null,
                        customer_name: null,
                        customer_nombre_db: null,
                        status: isFullyApproved ? 'aprobado' : 'cuarentena',
                        release_status: isFullyApproved ? 'liberado' : 'cuarentena',
                        mb_status: isFullyApproved ? 'aprobado' : 'en_incubacion',
                        fq_status: 'pendiente',
                        analyst_name: null,
                        mesophilic_aerobic_cfu: isFullyApproved ? 150 : null,
                        total_coliforms_mpn: isFullyApproved ? 0 : null,
                        e_coli_mpn: null,
                        salmonella_25g: null,
                        staph_aureus: null,
                        solids_percentage: null,
                        ph: null,
                        temperature_c: null,
                        brix: null,
                        is_auto_approved: isFullyApproved,
                        is_pending_sampling: !isFullyApproved,
                        custom_parameters: null
                    });
                }
            } catch (autoErr) {
                console.warn('[getLabLogs] Auto-include pending batches notice:', autoErr.message);
            }
        }

        res.json(parsedRows);
    } catch (error) {
        console.error('Error fetching lab logs:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getQualityParameters, saveQualityParameter, deleteQualityParameter, getLabLogs };
