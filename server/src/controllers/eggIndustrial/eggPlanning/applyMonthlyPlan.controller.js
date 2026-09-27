const { pool, computeJulianLotCode } = require('./shared');
const applyMonthlyPlan = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const company_id = req.company_id || req.user?.company_id;
        const { productions, overwrite_existing } = req.body;

        if (!Array.isArray(productions) || productions.length === 0) {
            connection.release();
            return res.status(400).json({ message: 'No se enviaron producciones para programar.' });
        }

        let insertedCount = 0;

        for (const prod of productions) {
            const {
                production_date,
                start_time,
                end_time,
                lot_code,
                product_profile,
                presentation,
                target_quantity_lbs,
                target_solids_pct,
                priority,
                mix_formula_json,
                reason,
                tasks
            } = prod;

            // Verificar si ya existe una producción en esa fecha
            const [existRows] = await connection.query(
                'SELECT id FROM egg_scheduled_productions WHERE company_id = ? AND production_date = ? AND status != "cancelado"',
                [company_id, production_date]
            );

            if (existRows.length > 0 && !overwrite_existing) {
                // Saltar para no duplicar si el usuario no pidió sobreescribir
                continue;
            }

            const finalLotCode = lot_code || computeJulianLotCode(production_date, 1);

            const [result] = await connection.query(
                `INSERT INTO egg_scheduled_productions (
                    company_id, production_date, start_time, end_time,
                    lot_code, product_profile, presentation, target_quantity_lbs,
                    target_solids_pct, status, priority, mix_formula_json,
                    suggestion_source, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'programado', ?, ?, 'ai_plan_mensual', ?, ?)`,
                [
                    company_id,
                    production_date,
                    start_time || '06:00:00',
                    end_time || '14:00:00',
                    finalLotCode,
                    product_profile || 'Huevo Entero Pasteurizado',
                    presentation || 'cubeta 30LB',
                    parseFloat(target_quantity_lbs) || 12000,
                    parseFloat(target_solids_pct) || 23.5,
                    priority || 'media',
                    JSON.stringify(mix_formula_json || {}),
                    reason || 'Plan Mensual Sugerido por IA',
                    req.user?.nombre || req.user?.username || 'IA Sugerencia Mensual'
                ]
            );

            const scheduledId = result.insertId;

            // Insertar tareas operativas
            const taskList = Array.isArray(tasks) && tasks.length > 0 ? tasks : [
                { factory_role: 'Sanitización CIP', task_description: 'CIP térmico/químico a 78°C antes de iniciar' },
                { factory_role: 'Quebrado y Carga', task_description: 'Carga de tolva y quebrado' },
                { factory_role: 'Pasteurización HACCP', task_description: 'Pasteurizar a 64.5°C por 210s CCP-1' },
                { factory_role: 'Control de Calidad LAB-004', task_description: 'Control brix y análisis microbiológico' },
                { factory_role: 'Empaque y Cuarto Frío', task_description: 'Envasado con liner alimentario y etiquetas julianas' }
            ];

            for (const t of taskList) {
                await connection.query(
                    `INSERT INTO egg_scheduled_tasks (
                        scheduled_production_id, factory_role, user_name, task_description, checklist_status
                    ) VALUES (?, ?, ?, ?, 'pendiente')`,
                    [scheduledId, t.factory_role || 'General', 'Operario de Planta', t.task_description || '']
                );
            }

            insertedCount++;
        }

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            inserted_count: insertedCount,
            message: `Se programaron exitosamente ${insertedCount} lotes con numeración juliana en el calendario.`
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Error al aplicar plan mensual:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { applyMonthlyPlan };
