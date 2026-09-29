const bcrypt = require('bcryptjs');
const { eggRules, hasPermission, pool, notificationService } = require('./shared');

const completeProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs } = req.body;

        // Traer datos del lote
        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, req.company_id]
        );
        if (!batches.length) eggRules.fail('Lote no encontrado', 404);
        const batch = batches[0];

        // Cambiar estado a aprobado_calidad o mantener bloqueado_haccp, empaquetado o congelado
        let nextStatus = batch.status;
        if (nextStatus === 'en_proceso') {
            const [lab] = await connection.query(
                'SELECT release_status FROM egg_lab_micro_logs WHERE batch_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1',
                [id, req.company_id]
            );
            if (lab.length && lab[0].release_status === 'liberado') {
                nextStatus = 'aprobado_calidad';
            } else if (batch.pasteurization_status === 'cerrado' || batch.pasteurization_status === 'pasteurizado') {
                nextStatus = 'pasteurizado';
            }
        }
        const values = [yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs].map(v => eggRules.number(v, 'Peso'));
        if (values[0] <= 0) eggRules.fail('El rendimiento debe ser mayor a cero.');

        if (batch.completed_at) {
            const same = ['yield_liquid_lbs', 'waste_shell_lbs', 'waste_loss_lbs'].every(
                (key, i) => Math.abs(Number(batch[key]) - values[i]) < 0.001
            );
            if (same) {
                await connection.commit();
                return res.json({ id, status: batch.status, yield_liquid_lbs: batch.yield_liquid_lbs, unchanged: true });
            }

            // Corrección supervisada: verificar permisos del usuario
            const userPerms = Array.isArray(req.user?.permissions)
                ? req.user.permissions
                : (typeof req.user?.permissions === 'string' ? JSON.parse(req.user?.permissions || '[]') : []);

            const isSupervisorOrAdmin = req.eggAccess?.superAdmin ||
                req.user?.role === 'SuperAdmin' ||
                req.user?.role === 'Admin' ||
                userPerms.includes('manage_egg_production_lots') ||
                hasPermission(req.eggAccess, 'manage_egg_production_lots') ||
                hasPermission(req.eggAccess, 'manage_production');

            let supervisorName = req.user?.nombre || 'Administrador';

            if (!isSupervisorOrAdmin) {
                const { supervisor_password } = req.body;
                if (!supervisor_password) {
                    eggRules.fail('El lote ya fue finalizado. La corrección del balance de masas requiere autorización de un Supervisor o Administrador.', 403);
                }

                const [supervisors] = await connection.query(
                    `SELECT u.id, u.nombre, u.password, u.role, r.permissions
                     FROM users u
                     LEFT JOIN usuario_empresa ue ON ue.usuario_id = u.id AND ue.empresa_id = ? AND ue.has_access = 1
                     LEFT JOIN roles r ON r.id = ue.role_id
                     WHERE u.is_active = 1 AND (u.role IN ('SuperAdmin', 'Admin') OR ue.role_id IS NOT NULL)`,
                    [req.company_id]
                );

                let validSupervisor = null;
                for (const sup of supervisors) {
                    let hasLotPerm = sup.role === 'SuperAdmin' || sup.role === 'Admin';
                    if (!hasLotPerm && sup.permissions) {
                        try {
                            const p = typeof sup.permissions === 'string' ? JSON.parse(sup.permissions) : sup.permissions;
                            if (Array.isArray(p) && p.includes('manage_egg_production_lots')) hasLotPerm = true;
                        } catch { /* ignore */ }
                    }
                    if (hasLotPerm && sup.password) {
                        const match = await bcrypt.compare(supervisor_password, sup.password);
                        if (match) {
                            validSupervisor = sup;
                            break;
                        }
                    }
                }

                if (!validSupervisor) {
                    eggRules.fail('Contraseña de supervisor incorrecta o el usuario no cuenta con permisos de supervisión.', 403);
                }
                supervisorName = validSupervisor.nombre;
            }

            const [packaged] = await connection.query(
                'SELECT COALESCE(SUM(total_batch_weight_lbs),0) AS lbs FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
                [id, req.company_id]
            );
            if (values[0] < Number(packaged[0].lbs)) {
                eggRules.fail(`El rendimiento líquido corregido (${values[0]} Lbs) no puede ser menor al peso ya envasado (${packaged[0].lbs} Lbs).`, 409);
            }

            await connection.query(
                `UPDATE egg_production_batches
                 SET yield_liquid_lbs = ?, waste_shell_lbs = ?, waste_loss_lbs = ?
                 WHERE id = ? AND company_id = ?`,
                [yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, id, req.company_id]
            );

            await connection.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'production.balance_corrected', 'warning', ?, ?, ?)`,
                [
                    req.company_id,
                    `Corrección supervisada de balance de masas en lote #${id} (${batch.batch_code_display || batch.batch_uuid}) autorizada por ${supervisorName}. Rendimiento: ${batch.yield_liquid_lbs} -> ${yield_liquid_lbs} Lbs.`,
                    JSON.stringify({
                        batch_id: id,
                        prev_yield: batch.yield_liquid_lbs,
                        new_yield: yield_liquid_lbs,
                        supervisor: supervisorName,
                        operator: req.user?.nombre || 'Operador'
                    }),
                    supervisorName
                ]
            );

            await connection.commit();
            return res.json({
                id,
                status: batch.status,
                yield_liquid_lbs,
                corrected: true,
                message: `Balance de masas corregido exitosamente (autorizado por ${supervisorName}).`
            });
        }

        const [packaged] = await connection.query(
            'SELECT COALESCE(SUM(total_batch_weight_lbs),0) AS lbs FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (values[0] < Number(packaged[0].lbs)) eggRules.fail('El rendimiento no puede ser menor al peso ya envasado.', 409);

        await connection.query(
            `UPDATE egg_production_batches
             SET yield_liquid_lbs = ?, waste_shell_lbs = ?, waste_loss_lbs = ?, status = ?, completed_at = COALESCE(completed_at, NOW())
             WHERE id = ? AND company_id = ?`,
            [yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, nextStatus, id, req.company_id]
        );

        // Crear evento
        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.completed', 'info', ?, ?, ?)`,
            [
                req.company_id,
                `Lote de producción completado. Rendimiento líquido: ${yield_liquid_lbs} LBS, Desperdicio cáscara: ${waste_shell_lbs} LBS.`,
                JSON.stringify({ batch_id: id, yield_liquid_lbs, waste_shell_lbs }),
                batch.operator_name
            ]
        );

        await connection.commit();
        const inputWeight = parseFloat(batch.input_weight_lbs || 0);
        const yieldPct = inputWeight > 0 ? Math.round((parseFloat(yield_liquid_lbs || 0) / inputWeight) * 10000) / 100 : 0;
        notificationService.notify('production_batch_completed', req.company_id, req.user?.branch_id, {
            lote_id: parseInt(id),
            producto: batch.product_type || '',
            cantidad: inputWeight,
            rendimiento: yieldPct,
            duracion: 0
        }).catch(() => { });

        res.json({ id, status: nextStatus, yield_liquid_lbs });
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

module.exports = { completeProductionBatch };
