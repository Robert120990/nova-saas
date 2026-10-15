const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { deleteEmployeePreservingHistory } = require('../../services/rhPayroll/rhIntegrity.service');
const TABLE = 'rh_empleados';
const LABEL = 'Empleado';

const createEmpleado = async (req, res) => {
    try {
        let { codigo, codigo_biometrico, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
              ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
              cargo_id, departamento_personal_id, branch_id, num_isss, num_nup, fecha_ingreso,
              tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
              es_activo, es_jubilado, aplica_renta, en_vacaciones, incapacitado, comentarios,
              emergency_contacts, turno_id, exento_horas_extras } = req.body;

        if (!codigo) {
            const [maxResult] = await pool.query(
                `SELECT COALESCE(MAX(CAST(codigo AS UNSIGNED)), 0) + 1 as next FROM ${TABLE} WHERE company_id = ?`,
                [req.company_id]
            );
            codigo = String(maxResult[0].next).padStart(4, '0');
        }

        const cleanBranchId = branch_id && branch_id !== '' && branch_id !== 'null' ? parseInt(branch_id) : null;
        const cleanTurnoId = turno_id && turno_id !== '' && turno_id !== 'null' ? parseInt(turno_id) : null;
        const cleanCodigoBio = codigo_biometrico ? String(codigo_biometrico).trim() : null;

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (company_id, codigo, codigo_biometrico, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
              ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
              cargo_id, departamento_personal_id, branch_id, turno_id, exento_horas_extras, num_isss, num_nup, fecha_ingreso,
              tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
              es_activo, es_jubilado, aplica_renta, en_vacaciones, incapacitado, comentarios)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, codigo, cleanCodigoBio, nombres, apellidos, fecha_nacimiento || null, num_dui || null, num_nit || null, afp_id || null,
             ocupacion || null, direccion || null, departamento || null, municipio || null, distrito || null, telefono || null, correo || null,
             cargo_id || null, departamento_personal_id || null, cleanBranchId, cleanTurnoId, exento_horas_extras ? 1 : 0, num_isss || null, num_nup || null, fecha_ingreso || null,
             tipo_contrato_id || null, sueldo_base || 0, bonificacion_fija || 0, cuenta_planillera || null,
             es_activo ?? 1, es_jubilado ?? 0, aplica_renta ?? 1, en_vacaciones ?? 0, incapacitado ?? 0, comentarios || null]
        );

        const empleadoId = result.insertId;

        // Auto-vincular marcaciones previas huérfanas en el marcador digital con este UID
        const bioUid = cleanCodigoBio || String(codigo).trim();
        if (bioUid) {
            const cleanNoZero = bioUid.replace(/^0+/, '');
            const targets = [bioUid];
            if (cleanNoZero && cleanNoZero !== bioUid) targets.push(cleanNoZero);
            await pool.query(
                `UPDATE rh_biometric_attendance_logs
                 SET empleado_id = ?
                 WHERE company_id = ? AND device_uid IN (?) AND (empleado_id IS NULL OR empleado_id = 0)`,
                [empleadoId, req.company_id, targets]
            ).catch(() => {});

            await pool.query(
                `UPDATE rh_biometric_daily_overtime
                 SET empleado_id = ?
                 WHERE company_id = ? AND device_uid IN (?) AND (empleado_id IS NULL OR empleado_id = 0)`,
                [empleadoId, req.company_id, targets]
            ).catch(() => {});
        }

        if (Array.isArray(emergency_contacts) && emergency_contacts.length > 0) {
            for (const ec of emergency_contacts) {
                if (ec.nombre && ec.telefono) {
                    await pool.query(
                        `INSERT INTO rh_empleado_emergency_contacts (empleado_id, nombre, telefono, parentesco) VALUES (?, ?, ?, ?)`,
                        [empleadoId, ec.nombre, ec.telefono, ec.parentesco || null]
                    );
                }
            }
        }

        notificationService.notify('employee_created', req.company_id, cleanBranchId || req.user?.branch_id, {
            empleado_nombre: `${nombres || ''} ${apellidos || ''}`.trim(),
            empleado_codigo: codigo || '',
            cargo: '',
            departamento: '',
            sucursal: req.branch_name || ''
        }).catch(() => {});

        res.status(201).json({ id: empleadoId, codigo });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
                ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
                cargo_id, departamento_personal_id, branch_id, num_isss, num_nup, fecha_ingreso,
                tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
                es_activo, es_jubilado, aplica_renta, en_vacaciones, incapacitado, comentarios,
                emergency_contacts } = req.body;

        const cleanBranchId = branch_id && branch_id !== '' && branch_id !== 'null' ? parseInt(branch_id) : null;

        const [currentRows] = await pool.query(
            `SELECT branch_id, departamento_personal_id, cargo_id, sueldo_base FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        const prev = currentRows[0] || null;

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET codigo = ?, nombres = ?, apellidos = ?, fecha_nacimiento = ?, num_dui = ?, num_nit = ?, afp_id = ?,
             ocupacion = ?, direccion = ?, departamento = ?, municipio = ?, distrito = ?, telefono = ?, correo = ?,
             cargo_id = ?, departamento_personal_id = ?, branch_id = ?, num_isss = ?, num_nup = ?, fecha_ingreso = ?,
             tipo_contrato_id = ?, sueldo_base = ?, bonificacion_fija = ?, cuenta_planillera = ?,
             es_activo = ?, es_jubilado = ?, aplica_renta = ?, en_vacaciones = ?, incapacitado = ?, comentarios = ?
             WHERE id = ? AND company_id = ?`,
            [codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
             ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
             cargo_id, departamento_personal_id, cleanBranchId, num_isss, num_nup, fecha_ingreso,
             tipo_contrato_id, sueldo_base || 0, bonificacion_fija || 0, cuenta_planillera,
             es_activo ?? 1, es_jubilado ?? 0, aplica_renta ?? 1, en_vacaciones ?? 0, incapacitado ?? 0, comentarios,
             id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });

        if (prev) {
            const newCargoId = cargo_id && cargo_id !== '' && cargo_id !== 'null' ? parseInt(cargo_id) : null;
            const newDeptoId = departamento_personal_id && departamento_personal_id !== '' && departamento_personal_id !== 'null' ? parseInt(departamento_personal_id) : null;
            const newSueldo = sueldo_base !== undefined && sueldo_base !== null ? parseFloat(sueldo_base) : null;
            const prevSueldo = prev.sueldo_base !== null ? parseFloat(prev.sueldo_base) : null;

            const branchChanged = prev.branch_id !== cleanBranchId;
            const deptoChanged = prev.departamento_personal_id !== newDeptoId;
            const cargoChanged = prev.cargo_id !== newCargoId;
            const sueldoChanged = newSueldo !== null && prevSueldo !== null && Math.abs(newSueldo - prevSueldo) > 0.001;

            if (branchChanged || deptoChanged || cargoChanged || sueldoChanged) {
                const today = new Date().toISOString().split('T')[0];
                await pool.query(
                    `INSERT INTO rh_empleado_traslados
                     (company_id, empleado_id, fecha_efectiva, branch_id_anterior, branch_id_nuevo,
                      departamento_id_anterior, departamento_id_nuevo, cargo_id_anterior, cargo_id_nuevo,
                      sueldo_anterior, sueldo_nuevo, motivo, usuario_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        req.company_id, id, req.body.fecha_efectiva_traslado || today,
                        prev.branch_id, cleanBranchId,
                        prev.departamento_personal_id, newDeptoId,
                        prev.cargo_id, newCargoId,
                        prev.sueldo_base, newSueldo,
                        req.body.motivo_traslado || 'Modificación en expediente de personal',
                        req.user?.id || null
                    ]
                ).catch(err => console.error('[rh_empleado_traslados log error]:', err.message));

                if (branchChanged || deptoChanged || cargoChanged) {
                    await pool.query(
                        `UPDATE rh_planillas
                         SET branch_id = ?, departamento_personal_id = ?, cargo_id = ?
                         WHERE empleado_id = ? AND company_id = ? AND estado != 'pagada'`,
                        [cleanBranchId, newDeptoId, newCargoId, id, req.company_id]
                    ).catch(err => console.error('[update open planillas branch/depto error]:', err.message));
                }
            }
        }

        if (Array.isArray(emergency_contacts)) {
            await pool.query(`DELETE FROM rh_empleado_emergency_contacts WHERE empleado_id = ?`, [id]);
            for (const ec of emergency_contacts) {
                if (ec.nombre && ec.telefono) {
                    await pool.query(
                        `INSERT INTO rh_empleado_emergency_contacts (empleado_id, nombre, telefono, parentesco) VALUES (?, ?, ?, ?)`,
                        [id, ec.nombre, ec.telefono, ec.parentesco || null]
                    );
                }
            }
        }

        res.json({ id, codigo });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ message: `${LABEL} eliminado` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Descuentos Programados Asignados ---
module.exports = { createEmpleado, updateEmpleado, deleteEmpleado };
