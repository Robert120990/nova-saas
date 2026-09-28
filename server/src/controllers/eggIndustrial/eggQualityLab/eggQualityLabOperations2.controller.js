const { evaluateLab, owned, fail, pool, parseNumSafe } = require('./shared');

const createLabLog = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const company_id = req.company_id || req.user?.company_id;
        const {
            batch_id, commercial_lot_code, sample_date, customer_id, customer_name, presentation,
            // MB
            mesophilic_aerobic_cfu, mesofilos_aerobios,
            total_coliforms_mpn, coliformes_totales,
            e_coli_mpn, escherichia_coli,
            salmonella_25g, salmonella_spp,
            fungi_yeasts_cfu, hongos_levaduras,
            staph_aureus,
            // FQ
            ph, brix, solids_percentage, solidos_totales_pct,
            temperature_c, salinity_pct, density,
            // Estados y Control
            fq_status, mb_status, release_status, incubation_started_at, incubation_hours,
            status, result_status, observations, notes, analyst_name,
            custom_parameters
        } = req.body;

        const aeroVal = parseNumSafe(mesophilic_aerobic_cfu ?? mesofilos_aerobios);
        const coliVal = parseNumSafe(total_coliforms_mpn ?? coliformes_totales);
        const ecoliVal = parseNumSafe(e_coli_mpn ?? escherichia_coli);
        const fungiVal = parseNumSafe(fungi_yeasts_cfu ?? hongos_levaduras);
        const phVal = parseNumSafe(ph);
        const brixVal = parseNumSafe(brix);
        let solidsVal = parseNumSafe(solids_percentage ?? solidos_totales_pct);
        const tempVal = parseNumSafe(temperature_c);
        let salVal = parseNumSafe(salinity_pct);
        let densVal = parseNumSafe(density);

        if (brixVal !== null) {
            if (solidsVal === null) solidsVal = Math.round(brixVal * 1.017 * 10) / 10;
            if (densVal === null) densVal = 0.130;
        }

        const salmonella = String(salmonella_25g ?? salmonella_spp ?? '').toLowerCase();
        const staph = String(staph_aureus ?? '').toLowerCase();
        const salmStr = ['ausencia', 'presencia'].includes(salmonella) ? salmonella : null;
        const staphStr = ['negativo', 'positivo', 'ausencia', 'presencia'].includes(staph) ? staph : null;

        const batch = await owned(connection, 'egg_production_batches', batch_id, company_id, true);
        const evaluation = evaluateLab({
            ...req.body,
            solids_percentage: solidsVal,
            density: densVal,
            salinity_pct: salVal
        });
        const evaluatedMb = evaluation.mb;
        const evaluatedFq = evaluation.fq;
        let evaluatedRelease = evaluation.release;
        let evaluatedStatus = evaluation.status;
        if (evaluatedRelease === 'liberado') {
            const [past] = await connection.query('SELECT id FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? LIMIT 1', [batch_id, company_id]);
            if (batch.pasteurization_status !== 'cerrado' || !past.length) fail('La liberación requiere pasteurización registrada y cerrada.');
        }
        if (customer_id) await owned(connection, 'customers', customer_id, company_id);
        const releasedAt = evaluatedRelease === 'liberado' ? new Date() : null;
        const releasedBy = evaluatedRelease === 'liberado' ? (req.user?.nombre || String(req.user?.id)) : null;
        const customParamsJson = custom_parameters ? (typeof custom_parameters === 'string' ? custom_parameters : JSON.stringify(custom_parameters)) : null;

        const [result] = await connection.query(
            `INSERT INTO egg_lab_micro_logs (
                company_id, batch_id, commercial_lot_code, customer_id, customer_name, presentation, sample_date,
                mesophilic_aerobic_cfu, total_coliforms_mpn, e_coli_mpn, salmonella_25g,
                fungi_yeasts_cfu, staph_aureus, ph, temperature_c, salinity_pct, density,
                brix, solids_percentage, fq_status, mb_status, release_status, released_at, released_by,
                incubation_started_at, incubation_hours, status, observations,
                custom_parameters, analyst_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_id, batch_id, commercial_lot_code || null, customer_id || null, customer_name || null, presentation || 'Cubeta 30 Lb',
                sample_date || new Date().toISOString().split('T')[0],
                aeroVal, coliVal, ecoliVal, salmStr,
                fungiVal, staphStr, phVal, tempVal, salVal, densVal,
                brixVal, solidsVal, evaluatedFq, evaluatedMb, evaluatedRelease, releasedAt, releasedBy,
                incubation_started_at || (evaluatedMb === 'en_incubacion' ? new Date() : null), parseInt(incubation_hours) || 48,
                evaluatedStatus, observations || notes || null, customParamsJson, analyst_name || req.user?.nombre || String(req.user?.id)
            ]
        );

        // Sincronización armónica con Producción y Envasado
        if (evaluatedRelease === 'bloqueado_haccp') {
            await connection.query('UPDATE egg_production_batches SET status = "bloqueado_haccp" WHERE id = ? AND company_id = ?', [batch_id, company_id]);
            await connection.query('UPDATE egg_packaging_records SET quality_status = "bloqueado_haccp" WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
            await connection.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'quality.rejection', 'critical', ?, ?, ?)`,
                [company_id, `Lote #${batch_id} BLOQUEADO HACCP por análisis microbiológico LAB-004.`, JSON.stringify({ batch_id, salmonella: salmStr, aeroVal, coliVal, staph: staphStr }), analyst_name]
            );
        } else if (evaluatedRelease === 'liberado') {
            await connection.query('UPDATE egg_production_batches SET status = "aprobado_calidad" WHERE id = ? AND company_id = ? AND status IN ("congelado", "empaquetado", "pasteurizado", "en_proceso")', [batch_id, company_id]);
            await connection.query('UPDATE egg_packaging_records SET quality_status = "liberado" WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
        } else {
            // Cuarentena (envasado concurrente o diferido pendiente de lectura MB)
            await connection.query('UPDATE egg_packaging_records SET quality_status = "cuarentena" WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
        }

        await connection.commit();
        res.status(201).json({ id: result.insertId, status: evaluatedStatus, release_status: evaluatedRelease, mb_status: evaluatedMb, fq_status: evaluatedFq });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating lab log:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally { connection.release(); }
};

const updateLabLog = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;
        const {
            batch_id, commercial_lot_code, sample_date, customer_id, customer_name, presentation,
            // MB
            mesophilic_aerobic_cfu, mesofilos_aerobios,
            total_coliforms_mpn, coliformes_totales,
            e_coli_mpn, escherichia_coli,
            salmonella_25g, salmonella_spp,
            fungi_yeasts_cfu, hongos_levaduras,
            staph_aureus,
            // FQ
            ph, brix, solids_percentage, solidos_totales_pct,
            temperature_c, salinity_pct, density,
            // Estados y Control
            fq_status, mb_status, release_status, incubation_started_at, incubation_hours,
            status, result_status, observations, notes, analyst_name,
            custom_parameters
        } = req.body;

        const aeroVal = parseNumSafe(mesophilic_aerobic_cfu ?? mesofilos_aerobios);
        const coliVal = parseNumSafe(total_coliforms_mpn ?? coliformes_totales);
        const ecoliVal = parseNumSafe(e_coli_mpn ?? escherichia_coli);
        const fungiVal = parseNumSafe(fungi_yeasts_cfu ?? hongos_levaduras);
        const phVal = parseNumSafe(ph);
        const brixVal = parseNumSafe(brix);
        let solidsVal = parseNumSafe(solids_percentage ?? solidos_totales_pct);
        const tempVal = parseNumSafe(temperature_c);
        let salVal = parseNumSafe(salinity_pct);
        let densVal = parseNumSafe(density);

        if (brixVal !== null) {
            if (solidsVal === null) solidsVal = Math.round(brixVal * 1.017 * 10) / 10;
            if (densVal === null) densVal = 0.130;
        }

        const salmonella = String(salmonella_25g ?? salmonella_spp ?? '').toLowerCase();
        const staph = String(staph_aureus ?? '').toLowerCase();
        const salmStr = ['ausencia', 'presencia'].includes(salmonella) ? salmonella : null;
        const staphStr = ['negativo', 'positivo', 'ausencia', 'presencia'].includes(staph) ? staph : null;

        const [current] = await connection.query('SELECT batch_id FROM egg_lab_micro_logs WHERE id = ? AND company_id = ? FOR UPDATE', [id, company_id]);
        if (!current.length || Number(current[0].batch_id) !== Number(batch_id)) fail('Análisis inexistente o lote diferente.', 404);
        const batch = await owned(connection, 'egg_production_batches', batch_id, company_id, true);
        const evaluation = evaluateLab({
            ...req.body,
            solids_percentage: solidsVal,
            density: densVal,
            salinity_pct: salVal
        });
        const evaluatedMb = evaluation.mb;
        const evaluatedFq = evaluation.fq;
        let evaluatedRelease = evaluation.release;
        let evaluatedStatus = evaluation.status;
        if (evaluatedRelease === 'liberado') {
            const [past] = await connection.query('SELECT id FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? LIMIT 1', [batch_id, company_id]);
            if (batch.pasteurization_status !== 'cerrado' || !past.length) fail('La liberación requiere pasteurización registrada y cerrada.');
        }
        if (customer_id) await owned(connection, 'customers', customer_id, company_id);
        const releasedAt = evaluatedRelease === 'liberado' ? new Date() : null;
        const releasedBy = evaluatedRelease === 'liberado' ? (req.user?.nombre || String(req.user?.id)) : null;
        const customParamsJson = custom_parameters ? (typeof custom_parameters === 'string' ? custom_parameters : JSON.stringify(custom_parameters)) : null;

        await connection.query(`
            UPDATE egg_lab_micro_logs SET
                batch_id = ?,
                commercial_lot_code = ?,
                customer_id = ?,
                customer_name = ?,
                presentation = ?,
                sample_date = ?,
                mesophilic_aerobic_cfu = ?,
                total_coliforms_mpn = ?,
                e_coli_mpn = ?,
                salmonella_25g = ?,
                fungi_yeasts_cfu = ?,
                staph_aureus = ?,
                ph = ?,
                temperature_c = ?,
                salinity_pct = ?,
                density = ?,
                brix = ?,
                solids_percentage = ?,
                fq_status = ?,
                mb_status = ?,
                release_status = ?,
                released_at = COALESCE(?, released_at),
                released_by = COALESCE(?, released_by),
                incubation_started_at = COALESCE(?, incubation_started_at),
                incubation_hours = ?,
                status = ?,
                observations = ?,
                custom_parameters = ?,
                analyst_name = ?
            WHERE id = ? AND company_id = ?
        `, [
            batch_id,
            commercial_lot_code || null,
            customer_id || null,
            customer_name || null,
            presentation || 'Cubeta 30 Lb',
            sample_date || new Date().toISOString().split('T')[0],
            aeroVal,
            coliVal,
            ecoliVal,
            salmStr,
            fungiVal,
            staphStr,
            phVal,
            tempVal,
            salVal,
            densVal,
            brixVal,
            solidsVal,
            evaluatedFq,
            evaluatedMb,
            evaluatedRelease,
            releasedAt,
            releasedBy,
            incubation_started_at || (evaluatedMb === 'en_incubacion' ? new Date() : null),
            parseInt(incubation_hours) || 48,
            evaluatedStatus,
            observations || notes || null,
            customParamsJson,
            analyst_name || req.user?.nombre || String(req.user?.id),
            id,
            company_id
        ]);

        // Sincronización armónica con Producción y Envasado
        if (evaluatedRelease === 'bloqueado_haccp') {
            await connection.query('UPDATE egg_production_batches SET status = "bloqueado_haccp" WHERE id = ? AND company_id = ?', [batch_id, company_id]);
            await connection.query('UPDATE egg_packaging_records SET quality_status = "bloqueado_haccp" WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
        } else if (evaluatedRelease === 'liberado') {
            await connection.query('UPDATE egg_production_batches SET status = "aprobado_calidad" WHERE id = ? AND company_id = ? AND status IN ("congelado", "empaquetado", "pasteurizado", "en_proceso")', [batch_id, company_id]);
            await connection.query('UPDATE egg_packaging_records SET quality_status = "liberado" WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
        } else {
            await connection.query('UPDATE egg_packaging_records SET quality_status = "cuarentena" WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
        }

        await connection.commit();
        res.json({ message: 'Análisis LAB-004 actualizado exitosamente', id, status: evaluatedStatus, release_status: evaluatedRelease, mb_status: evaluatedMb, fq_status: evaluatedFq });
    } catch (error) {
        await connection.rollback();
        console.error('Error updating lab log:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally { connection.release(); }
};
module.exports = { createLabLog, updateLabLog };
