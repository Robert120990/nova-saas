const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { deleteEmployeePreservingHistory } = require('../../services/rhPayroll/rhIntegrity.service');
const TABLE = 'rh_empleados';
const LABEL = 'Empleado';

const createEmpleado = async (req, res) => {
    try {
        let { codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
              ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
              cargo_id, departamento_personal_id, branch_id, num_isss, num_nup, fecha_ingreso,
              tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
              es_activo, es_jubilado, aplica_renta, en_vacaciones, incapacitado, comentarios,
              emergency_contacts } = req.body;

        if (!codigo) {
            const [maxResult] = await pool.query(
                `SELECT COALESCE(MAX(CAST(codigo AS UNSIGNED)), 0) + 1 as next FROM ${TABLE} WHERE company_id = ?`,
                [req.company_id]
            );
            codigo = String(maxResult[0].next).padStart(4, '0');
        }

        const cleanBranchId = branch_id && branch_id !== '' && branch_id !== 'null' ? parseInt(branch_id) : null;

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (company_id, codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
              ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
              cargo_id, departamento_personal_id, branch_id, num_isss, num_nup, fecha_ingreso,
              tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
              es_activo, es_jubilado, aplica_renta, en_vacaciones, incapacitado, comentarios)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
             ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
             cargo_id, departamento_personal_id, cleanBranchId, num_isss, num_nup, fecha_ingreso,
             tipo_contrato_id, sueldo_base || 0, bonificacion_fija || 0, cuenta_planillera,
             es_activo ?? 1, es_jubilado ?? 0, aplica_renta ?? 1, en_vacaciones ?? 0, incapacitado ?? 0, comentarios]
        );

        const empleadoId = result.insertId;
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
