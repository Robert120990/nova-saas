const httpError = (status, message) => Object.assign(new Error(message), { status });

const validateEmployeeBatch = async (connection, companyId, items, departmentId) => {
    if (!Array.isArray(items) || !items.length) throw httpError(400, 'Debe incluir empleados en la planilla');
    const ids = items.map(item => Number(item.empleado_id));
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
        throw httpError(400, 'Los empleados de la planilla son inválidos o están duplicados');
    }
    const [employees] = await connection.query(
        'SELECT id, departamento_personal_id FROM rh_empleados WHERE company_id = ? AND id IN (?) ORDER BY id FOR UPDATE',
        [companyId, ids]
    );
    if (employees.length !== ids.length) throw httpError(403, 'Todos los empleados deben pertenecer a la empresa activa');
    if (departmentId) {
        const department = Number(departmentId);
        const [departments] = await connection.query('SELECT id FROM rh_departamentos WHERE id = ? AND company_id = ?', [department, companyId]);
        if (!Number.isSafeInteger(department) || department <= 0 || !departments.length
            || employees.some(employee => Number(employee.departamento_personal_id) !== department)) {
            throw httpError(400, 'El departamento no corresponde a los empleados de la planilla; vuelva a calcular');
        }
    }
};

const assertQuincena25Editable = async (connection, companyId, year) => {
    const [rows] = await connection.query(
        'SELECT estado FROM rh_planilla_quincena25 WHERE company_id = ? AND periodo_anio = ? FOR UPDATE',
        [companyId, year]
    );
    if (rows.some(row => row.estado === 'pagada')) throw httpError(409, 'El período está pagado. Reábralo antes de modificarlo');
};

const deleteEmployeePreservingHistory = async (connection, companyId, id) => {
    const [employees] = await connection.query('SELECT id FROM rh_empleados WHERE id = ? AND company_id = ? FOR UPDATE', [id, companyId]);
    if (!employees.length) throw httpError(404, 'Empleado no encontrado');
    // Consultar las relaciones instaladas también protege nuevas tablas de historial.
    const [references] = await connection.query(
        `SELECT DISTINCT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'rh_empleados'
           AND TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'rh_empleado_emergency_contacts'`
    );
    for (const reference of references) {
        const table = '`' + reference.TABLE_NAME.replace(/`/g, '``') + '`';
        const column = '`' + reference.COLUMN_NAME.replace(/`/g, '``') + '`';
        const [history] = await connection.query(`SELECT 1 AS present FROM ${table} WHERE ${column} = ? LIMIT 1`, [id]);
        if (history.length) throw httpError(409, 'El empleado tiene historial registrado y no puede eliminarse. Desactívelo desde su ficha para conservarlo');
    }
    await connection.query('DELETE FROM rh_empleados WHERE id = ? AND company_id = ?', [id, companyId]);
};

module.exports = { httpError, validateEmployeeBatch, assertQuincena25Editable, deleteEmployeePreservingHistory };
