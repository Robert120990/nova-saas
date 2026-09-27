const { pool, computeJulianLotCode } = require('./shared');
const createScheduledProduction = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            production_date,
            start_time,
            end_time,
            lot_code,
            product_profile,
            presentation,
            target_quantity_lbs,
            target_solids_pct,
            status,
            priority,
            mix_formula_json,
            assigned_operator_id,
            assigned_operator_name,
            suggestion_source,
            notes,
            tasks
        } = req.body;

        const company_id = req.company_id || req.user?.company_id;
        const branch_id = req.body.branch_id || null;

        // Generar lote correlativo automático en formato Juliano si no viene
        let finalLotCode = lot_code;
        if (!finalLotCode || finalLotCode.trim() === '') {
            const [countRows] = await connection.query(
                'SELECT COUNT(*) as cnt FROM egg_scheduled_productions WHERE company_id = ? AND production_date = ?',
                [company_id, production_date]
            );
            const nextNum = (countRows[0]?.cnt || 0) + 1;
            finalLotCode = computeJulianLotCode(production_date, nextNum);
        }

        const [result] = await connection.query(
            `INSERT INTO egg_scheduled_productions (
                company_id, branch_id, production_date, start_time, end_time,
                lot_code, product_profile, presentation, target_quantity_lbs,
                target_solids_pct, status, priority, mix_formula_json,
                assigned_operator_id, assigned_operator_name, suggestion_source,
                notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_id,
                branch_id,
                production_date,
                start_time || '06:00:00',
                end_time || '14:00:00',
                finalLotCode,
                product_profile || 'Huevo Entero Pasteurizado',
                presentation || 'cubeta 30LB',
                parseFloat(target_quantity_lbs) || 12000.00,
                parseFloat(target_solids_pct) || 21.50,
                status || 'programado',
                priority || 'media',
                JSON.stringify(mix_formula_json || {}),
                assigned_operator_id || null,
                assigned_operator_name || null,
                suggestion_source || 'manual',
                notes || null,
                req.user?.nombre || req.user?.username || 'Sistema'
            ]
        );

        const scheduledId = result.insertId;

        // Guardar tareas y asignación de roles de fábrica
        if (Array.isArray(tasks) && tasks.length > 0) {
            for (const task of tasks) {
                if (task.task_description && task.task_description.trim() !== '') {
                    await connection.query(
                        `INSERT INTO egg_scheduled_tasks (
                            company_id, scheduled_production_id, user_id, user_name,
                            factory_role, task_description, checklist_status, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            company_id,
                            scheduledId,
                            task.user_id || null,
                            task.user_name || 'Operario de Planta',
                            task.factory_role || 'General',
                            task.task_description,
                            task.checklist_status || 'pendiente',
                            task.notes || null
                        ]
                    );
                }
            }
        }

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'calendar.created', 'info', ?, ?, ?)`,
            [
                company_id,
                `Producción programada ${finalLotCode} (${product_profile}) para el día ${production_date}.`,
                JSON.stringify({ scheduled_id: scheduledId, lot_code: finalLotCode, production_date }),
                req.user?.nombre || 'Planificador'
            ]
        );

        await connection.commit();
        res.status(201).json({ id: scheduledId, lot_code: finalLotCode, message: 'Producción programada exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al crear producción programada:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const updateScheduledProduction = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        const {
            production_date,
            start_time,
            end_time,
            lot_code,
            product_profile,
            presentation,
            target_quantity_lbs,
            target_solids_pct,
            status,
            priority,
            mix_formula_json,
            assigned_operator_id,
            assigned_operator_name,
            notes,
            tasks
        } = req.body;

        await connection.query(
            `UPDATE egg_scheduled_productions SET
                production_date = ?, start_time = ?, end_time = ?, lot_code = ?,
                product_profile = ?, presentation = ?, target_quantity_lbs = ?,
                target_solids_pct = ?, status = ?, priority = ?,
                mix_formula_json = ?, assigned_operator_id = ?,
                assigned_operator_name = ?, notes = ?
             WHERE id = ? AND company_id = ?`,
            [
                production_date,
                start_time || '06:00:00',
                end_time || '14:00:00',
                lot_code,
                product_profile,
                presentation,
                parseFloat(target_quantity_lbs) || 12000.00,
                parseFloat(target_solids_pct) || 21.50,
                status || 'programado',
                priority || 'media',
                JSON.stringify(mix_formula_json || {}),
                assigned_operator_id || null,
                assigned_operator_name || null,
                notes || null,
                id,
                company_id
            ]
        );

        // Sincronizar tareas si se proporcionaron
        if (Array.isArray(tasks)) {
            await connection.query(
                'DELETE FROM egg_scheduled_tasks WHERE scheduled_production_id = ? AND company_id = ?',
                [id, company_id]
            );

            for (const task of tasks) {
                if (task.task_description && task.task_description.trim() !== '') {
                    await connection.query(
                        `INSERT INTO egg_scheduled_tasks (
                            company_id, scheduled_production_id, user_id, user_name,
                            factory_role, task_description, checklist_status, completed_at, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            company_id,
                            id,
                            task.user_id || null,
                            task.user_name || 'Operario de Planta',
                            task.factory_role || 'General',
                            task.task_description,
                            task.checklist_status || 'pendiente',
                            task.checklist_status === 'completado' ? (task.completed_at || new Date()) : null,
                            task.notes || null
                        ]
                    );
                }
            }
        }

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'calendar.updated', 'info', ?, ?, ?)`,
            [
                company_id,
                `Producción programada #${id} (${lot_code}) actualizada para fecha ${production_date}.`,
                JSON.stringify({ scheduled_id: id, lot_code, production_date }),
                req.user?.nombre || 'Planificador'
            ]
        );

        await connection.commit();
        res.json({ message: 'Producción actualizada correctamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar producción programada:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const moveScheduledProduction = async (req, res) => {
    try {
        const { id } = req.params;
        const { production_date, start_time, end_time } = req.body;
        const company_id = req.company_id || req.user?.company_id;

        if (!production_date) {
            return res.status(400).json({ message: 'La nueva fecha es obligatoria.' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM egg_scheduled_productions WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Producción programada no encontrada.' });
        }

        let updateSql = 'UPDATE egg_scheduled_productions SET production_date = ?';
        let params = [production_date];

        if (start_time) {
            updateSql += ', start_time = ?';
            params.push(start_time);
        }
        if (end_time) {
            updateSql += ', end_time = ?';
            params.push(end_time);
        }

        updateSql += ' WHERE id = ? AND company_id = ?';
        params.push(id, company_id);

        await pool.query(updateSql, params);

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'calendar.moved', 'info', ?, ?, ?)`,
            [
                company_id,
                `Producción ${existing[0].lot_code} movida de ${existing[0].production_date} a ${production_date}.`,
                JSON.stringify({ id, lot_code: existing[0].lot_code, old_date: existing[0].production_date, new_date: production_date }),
                req.user?.nombre || 'Planificador'
            ]
        );

        res.json({ id, lot_code: existing[0].lot_code, production_date, message: 'Producción reprogramada exitosamente.' });
    } catch (error) {
        console.error('Error al mover producción en calendario:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { createScheduledProduction, updateScheduledProduction, moveScheduledProduction };
