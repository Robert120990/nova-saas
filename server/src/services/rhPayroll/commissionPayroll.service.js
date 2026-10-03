const { cargarCuentasPorDefecto } = require('./defaults.service');
const { recalculateSavedPlanilla } = require('./calculation.service');

const payrollError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function assertPayrollPeriodEditable(connection, companyId, year, month, quincena) {
    if (!Number.isInteger(Number(year)) || Number(year) < 1900 || Number(year) > 9999 ||
        !Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12 ||
        !['primera', 'segunda'].includes(quincena)) {
        throw payrollError(400, 'El año, mes y quincena de la planilla son inválidos.');
    }
    const [closed] = await connection.query(
        `SELECT id FROM rh_planillas WHERE company_id = ? AND periodo_anio = ?
         AND periodo_mes = ? AND quincena = ? AND estado = 'pagada' LIMIT 1`,
        [companyId, year, month, quincena]
    );
    if (closed.length) throw payrollError(409, 'No se pueden importar comisiones a un período pagado y cerrado.');
    const [open] = await connection.query(
        `SELECT id FROM rh_planillas WHERE company_id = ? AND estado != 'pagada'
         AND NOT (periodo_anio = ? AND periodo_mes = ? AND quincena = ?) LIMIT 1`,
        [companyId, year, month, quincena]
    );
    if (open.length) throw payrollError(409, 'Debe cerrar el período abierto antes de importar comisiones a otro.');
}

async function applyCommissionToPayroll(connection, companyId, commission, account, quincena) {
    const amount = Number(commission.capped_commission_amount);
    if (!Number.isFinite(amount) || amount <= 0) throw payrollError(400, 'El monto de la comisión debe ser mayor que cero.');
    const [other] = await connection.query(
        `SELECT id FROM egg_seller_commissions WHERE company_id = ? AND seller_id = ?
         AND period_year = ? AND period_month = ? AND id != ?
         AND status IN ('transferido_planilla', 'pagado')`,
        [companyId, commission.seller_id, commission.period_year, commission.period_month, commission.id]
    );
    if (other.length) throw payrollError(409, 'Este mes ya tiene una comisión transferida para el vendedor. Concilie la liquidación existente.');
    const [employees] = await connection.query(
        `SELECT sueldo_base, bonificacion_fija, en_vacaciones, incapacitado FROM rh_empleados
         WHERE id = ? AND company_id = ?`, [commission.employee_id, companyId]
    );
    if (!employees.length) throw payrollError(400, 'El empleado vinculado no pertenece a la empresa activa.');
    const [payrolls] = await connection.query(
        `SELECT * FROM rh_planillas WHERE company_id = ? AND empleado_id = ?
         AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
        [companyId, commission.employee_id, commission.period_year, commission.period_month, quincena]
    );
    let id = payrolls[0]?.id;
    if (id && payrolls[0].estado === 'pagada') throw payrollError(409, 'La planilla está pagada y cerrada.');
    if (!id) {
        const employee = employees[0];
        const salary = Number(employee.sueldo_base || 0);
        const bonus = Number(employee.bonificacion_fija || 0);
        const absent = Number(employee.en_vacaciones) === 1 || Number(employee.incapacitado) === 1;
        const days = absent ? 0 : 15;
        const [inserted] = await connection.query(
            `INSERT INTO rh_planillas
             (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyId, commission.employee_id, commission.period_year, commission.period_month, quincena, days, salary, bonus]
        );
        id = inserted.insertId;
        await cargarCuentasPorDefecto(connection, id, companyId, days, salary, commission.employee_id, quincena, bonus);
        if (absent) await connection.query(
            'UPDATE rh_planilla_detalles SET valor_base = 0, valor_ingresado = 0 WHERE planilla_id = ?', [id]
        );
    }
    // Varios vendedores pueden estar vinculados al mismo empleado: conservar todas sus liquidaciones.
    const [previous] = await connection.query(
        `SELECT COALESCE(SUM(capped_commission_amount), 0) AS amount FROM egg_seller_commissions
         WHERE company_id = ? AND employee_id = ? AND transferred_to_planilla_id = ? AND id != ?
         AND status IN ('transferido_planilla', 'pagado')`,
        [companyId, commission.employee_id, id, commission.id]
    );
    const total = Math.round((amount + Number(previous[0]?.amount || 0)) * 100) / 100;
    const [details] = await connection.query(
        'SELECT id FROM rh_planilla_detalles WHERE planilla_id = ? AND cuenta_id = ?', [id, account.id]
    );
    if (details.length) {
        await connection.query(
            'UPDATE rh_planilla_detalles SET valor_ingresado = ?, valor_base = ? WHERE id = ?',
            [total, total, details[0].id]
        );
    } else {
        await connection.query(
            `INSERT INTO rh_planilla_detalles
             (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
             VALUES ?`, [[[id, account.id, account.codigo, account.descripcion, 'sumar', 'valor', total, total, 7]]]
        );
    }
    // El sueldo ya es un detalle; el cálculo central incluye también ISSS, AFP y renta.
    await recalculateSavedPlanilla(connection, companyId, id);
    await connection.query(
        `UPDATE egg_seller_commissions SET status = 'transferido_planilla',
         transferred_to_planilla_id = ?, transferred_at = NOW() WHERE id = ? AND company_id = ?`,
        [id, commission.id, companyId]
    );
    return id;
}

async function releasePayrollCommissions(connection, companyId, ids) {
    if (!ids.length) return;
    // RH también funciona en instalaciones donde el módulo de huevo aún no está instalado.
    const [installed] = await connection.query(
        `SELECT 1 FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_seller_commissions'`
    );
    if (!installed.length) return;
    await connection.query(
        `UPDATE egg_seller_commissions SET status = 'aprobado',
         transferred_to_planilla_id = NULL, transferred_at = NULL
         WHERE company_id = ? AND transferred_to_planilla_id IN (?) AND status = 'transferido_planilla'`,
        [companyId, ids]
    );
}

module.exports = { assertPayrollPeriodEditable, applyCommissionToPayroll, releasePayrollCommissions };
