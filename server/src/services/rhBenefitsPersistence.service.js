const { createHash } = require('node:crypto');

const commonAmounts = ['descuento_isss', 'descuento_afp', 'descuento_renta', 'total_devengado', 'total_deducciones', 'monto_recibir'];
const definitions = {
    vacaciones: {
        table: 'rh_planilla_vacaciones',
        fields: ['empleado_id', 'periodo_año', 'periodo_mes', 'quincena', 'fecha_inicial', 'fecha_final', 'dias_transcurridos', 'vacaciones_monto', ...commonAmounts],
        amounts: ['vacaciones_monto', ...commonAmounts],
        days: ['dias_transcurridos'],
        periods: [['fecha_inicial', 'fecha_final']]
    },
    liquidaciones: {
        table: 'rh_planilla_liquidaciones',
        fields: ['empleado_id', 'periodo_año', 'periodo_mes', 'periodo_indemnizacion_desde', 'periodo_indemnizacion_hasta', 'periodo_vacaciones_desde', 'periodo_vacaciones_hasta', 'periodo_aguinaldo_desde', 'periodo_aguinaldo_hasta', 'dias_indemnizacion', 'dias_vacaciones', 'dias_aguinaldo', 'ultimos_dias_laborados', 'pago_ultimos_dias', 'total_indemnizacion', 'total_vacaciones', 'total_aguinaldo', ...commonAmounts, 'otros_descuentos', 'pago_cuotas', 'cuotas', 'pago_por_cuota'],
        amounts: ['pago_ultimos_dias', 'total_indemnizacion', 'total_vacaciones', 'total_aguinaldo', ...commonAmounts, 'otros_descuentos', 'pago_por_cuota'],
        days: ['dias_indemnizacion', 'dias_vacaciones', 'dias_aguinaldo'],
        periods: [['periodo_indemnizacion_desde', 'periodo_indemnizacion_hasta'], ['periodo_vacaciones_desde', 'periodo_vacaciones_hasta'], ['periodo_aguinaldo_desde', 'periodo_aguinaldo_hasta']]
    }
};
const httpError = (status, message) => Object.assign(new Error(message), { status });
const numeric = value => (typeof value === 'number' || typeof value === 'string') && value !== '' && Number.isFinite(Number(value));
const dateValue = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);

function benefitRevision(kind, row) {
    const definition = definitions[kind];
    const dates = new Set(definition.periods.flat().concat('ultimos_dias_laborados'));
    const values = definition.fields.map(field => {
        if (dates.has(field)) return row[field] ? dateValue(row[field]) : null;
        if (field === 'quincena') return row[field];
        return Number(row[field] ?? 0);
    });
    return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function validateBenefit(kind, body) {
    const definition = definitions[kind];
    if (!definition) throw httpError(400, 'Tipo de planilla inválido');
    for (const field of ['empleado_id', 'periodo_año', 'periodo_mes', ...definition.days]) {
        if (!numeric(body[field]) || !Number.isSafeInteger(Number(body[field])) || Number(body[field]) < (definition.days.includes(field) ? 0 : 1)) {
            throw httpError(400, `El campo ${field} es inválido`);
        }
    }
    if (Number(body.periodo_mes) > 12) throw httpError(400, 'El mes del período es inválido');
    for (const field of definition.amounts) {
        if (!numeric(body[field]) || Math.abs(Number(body[field])) > 99999999.99 || (field !== 'monto_recibir' && Number(body[field]) < 0)) {
            throw httpError(400, `El importe ${field} es requerido y debe ser válido. No se guardó ningún cambio`);
        }
    }
    for (const [from, to] of definition.periods) {
        const required = kind === 'vacaciones';
        if (!body[from] && !body[to] && !required) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body[from] || '') || !/^\d{4}-\d{2}-\d{2}$/.test(body[to] || '') || body[from] > body[to]) {
            throw httpError(400, 'Complete correctamente las fechas del período antes de guardar');
        }
    }
    if (kind === 'vacaciones' && !['primera', 'segunda'].includes(body.quincena)) throw httpError(400, 'La quincena es inválida');
    if (kind === 'liquidaciones' && (!numeric(body.cuotas) || !Number.isSafeInteger(Number(body.cuotas)) || Number(body.cuotas) < 1)) throw httpError(400, 'El número de cuotas es inválido');
    const earnings = kind === 'vacaciones' ? Number(body.vacaciones_monto)
        : ['total_indemnizacion', 'total_vacaciones', 'total_aguinaldo', 'pago_ultimos_dias'].reduce((sum, field) => sum + Number(body[field]), 0);
    const deductions = ['descuento_isss', 'descuento_afp', 'descuento_renta'].reduce((sum, field) => sum + Number(body[field]), 0) + Number(body.otros_descuentos || 0);
    if (Math.abs(earnings - Number(body.total_devengado)) > 0.02 || Math.abs(deductions - Number(body.total_deducciones)) > 0.02
        || Math.abs(earnings - deductions - Number(body.monto_recibir)) > 0.02) {
        throw httpError(400, 'Los totales no corresponden al detalle del cálculo. Recalcule antes de guardar');
    }
    return definition;
}

async function saveBenefit(connection, kind, companyId, body, id) {
    const definition = validateBenefit(kind, body);
    const [employees] = await connection.query('SELECT id FROM rh_empleados WHERE id = ? AND company_id = ? FOR UPDATE', [body.empleado_id, companyId]);
    if (!employees.length) throw httpError(403, 'El empleado debe pertenecer a la empresa activa');
    if (id) {
        const [rows] = await connection.query(`SELECT * FROM ${definition.table} WHERE id = ? AND company_id = ? FOR UPDATE`, [id, companyId]);
        if (!rows.length) throw httpError(404, 'Planilla no encontrada');
        if (Number(rows[0].empleado_id) !== Number(body.empleado_id)) throw httpError(400, 'El empleado de una planilla registrada no puede cambiarse');
        if (body.expected_revision !== undefined && body.expected_revision !== benefitRevision(kind, rows[0])) {
            throw httpError(409, 'Esta planilla fue modificada por otra sesión. Vuelva a abrirla antes de guardar; sus cambios actuales se conservaron en el formulario');
        }
    }
    const values = definition.fields.map(field => {
        if (field === 'pago_cuotas') return body[field] ? 1 : 0;
        return body[field] ?? null;
    });
    if (id) {
        await connection.query(`UPDATE ${definition.table} SET ${definition.fields.map(field => `\`${field}\` = ?`).join(', ')} WHERE id = ? AND company_id = ?`, [...values, id, companyId]);
        return { id };
    }
    const [result] = await connection.query(`INSERT INTO ${definition.table} (company_id, ${definition.fields.map(field => `\`${field}\``).join(', ')}) VALUES (${values.map(() => '?').concat('?').join(', ')})`, [companyId, ...values]);
    return { id: result.insertId };
}

async function persistBenefit(pool, kind, companyId, body, id) {
    let connection;
    let started = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        started = true;
        const result = await saveBenefit(connection, kind, companyId, body, id);
        await connection.commit();
        started = false;
        return result;
    } catch (error) {
        if (started) await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection?.release();
    }
}

module.exports = { benefitRevision, validateBenefit, saveBenefit, persistBenefit };
