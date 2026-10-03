const test = require('node:test');
const assert = require('node:assert/strict');
const { benefitRevision, validateBenefit, saveBenefit, persistBenefit } = require('../../src/services/rhBenefitsPersistence.service');

const vacation = () => ({
    empleado_id: 10, periodo_año: 2026, periodo_mes: 10, quincena: 'primera',
    fecha_inicial: '2025-10-01', fecha_final: '2026-10-01', dias_transcurridos: 366,
    vacaciones_monto: 650, descuento_isss: 19.5, descuento_afp: 47.13, descuento_renta: 0,
    total_devengado: 650, total_deducciones: 66.63, monto_recibir: 583.37
});
const settlement = () => ({
    empleado_id: 10, periodo_año: 2026, periodo_mes: 10,
    periodo_indemnizacion_desde: '2025-10-01', periodo_indemnizacion_hasta: '2026-09-30',
    periodo_vacaciones_desde: '2025-10-01', periodo_vacaciones_hasta: '2026-09-30',
    periodo_aguinaldo_desde: '2025-12-01', periodo_aguinaldo_hasta: '2026-09-30',
    dias_indemnizacion: 365, dias_vacaciones: 365, dias_aguinaldo: 304, ultimos_dias_laborados: '2026-09-30',
    pago_ultimos_dias: 200, total_indemnizacion: 1000, total_vacaciones: 650, total_aguinaldo: 416.44,
    descuento_isss: 25.5, descuento_afp: 61.63, descuento_renta: 45, otros_descuentos: 10,
    total_devengado: 2266.44, total_deducciones: 142.13, monto_recibir: 2124.31,
    pago_cuotas: true, cuotas: 2, pago_por_cuota: 1062.16
});

function database({ employees = [{ id: 10 }], row, failWrite = false } = {}) {
    const statements = [];
    const events = [];
    const connection = {
        async beginTransaction() { events.push('begin'); },
        async commit() { events.push('commit'); },
        async rollback() { events.push('rollback'); },
        release() { events.push('release'); },
        async query(sql, params) {
            statements.push({ sql, params });
            if (sql.startsWith('SELECT id FROM rh_empleados')) return [employees];
            if (sql.startsWith('SELECT * FROM')) return [row ? [row] : []];
            if (failWrite) throw new Error('Fallo de escritura simulado');
            return [{ insertId: 81, affectedRows: 1 }];
        }
    };
    return { pool: { async getConnection() { return connection; } }, connection, statements, events };
}

test('vacaciones: una petición incompleta nunca convierte retenciones faltantes a cero', async () => {
    for (const value of [undefined, null, '', NaN, Infinity, false, []]) {
        const body = { ...vacation(), descuento_afp: value };
        const db = database();
        await assert.rejects(persistBenefit(db.pool, 'vacaciones', 1, body, 4), { status: 400 });
        assert.equal(db.statements.length, 0);
        assert.deepEqual(db.events, ['begin', 'rollback', 'release']);
    }
});

test('liquidaciones: los descuentos son completos y los totales deben corresponder al detalle', () => {
    assert.doesNotThrow(() => validateBenefit('liquidaciones', settlement()));
    assert.throws(() => validateBenefit('liquidaciones', { ...settlement(), descuento_renta: undefined }), { status: 400 });
    assert.throws(() => validateBenefit('liquidaciones', { ...settlement(), monto_recibir: 2266.44 }), { status: 400 });
});

test('un empleado de otra empresa no puede crear ni reemplazar información', async () => {
    for (const kind of ['vacaciones', 'liquidaciones']) {
        const db = database({ employees: [] });
        await assert.rejects(persistBenefit(db.pool, kind, 2, kind === 'vacaciones' ? vacation() : settlement(), 4), { status: 403 });
        assert.deepEqual(db.statements[0].params, [10, 2]);
        assert.equal(db.statements.length, 1);
        assert.deepEqual(db.events, ['begin', 'rollback', 'release']);
    }
});

test('una edición vieja no sobrescribe las vacaciones guardadas por otra sesión', async () => {
    const previous = vacation();
    const current = { ...previous, fecha_final: '2026-10-02', dias_transcurridos: 367 };
    const db = database({ row: current });
    await assert.rejects(persistBenefit(db.pool, 'vacaciones', 1, { ...previous, expected_revision: benefitRevision('vacaciones', previous) }, 4), { status: 409 });
    assert.equal(db.statements.filter(s => s.sql.startsWith('UPDATE')).length, 0);
    assert.deepEqual(db.events, ['begin', 'rollback', 'release']);
});

test('la revisión de liquidaciones detecta descuentos e importes editados, aun en el mismo segundo', () => {
    const original = settlement();
    const changed = { ...original, otros_descuentos: 20, total_deducciones: 152.13, monto_recibir: 2114.31 };
    assert.notEqual(benefitRevision('liquidaciones', original), benefitRevision('liquidaciones', changed));
    assert.equal(benefitRevision('liquidaciones', original), benefitRevision('liquidaciones', { ...original, sueldo_base: 1500, updated_at: new Date() }));
});

test('una liquidación conserva todos los campos del snapshot y confirma antes de liberar', async () => {
    const body = settlement();
    const db = database({ row: body });
    const result = await persistBenefit(db.pool, 'liquidaciones', 1, { ...body, expected_revision: benefitRevision('liquidaciones', body) }, 4);
    assert.deepEqual(result, { id: 4 });
    assert.deepEqual(db.events, ['begin', 'commit', 'release']);
    const write = db.statements.find(s => s.sql.startsWith('UPDATE'));
    assert.match(write.sql, /`ultimos_dias_laborados` = \?/);
    assert.ok(write.params.includes('2026-09-30'));
    assert.deepEqual(write.params.slice(-2), [4, 1]);
});

test('una falla de almacenamiento revierte el cambio y libera la conexión', async () => {
    const db = database({ failWrite: true });
    await assert.rejects(persistBenefit(db.pool, 'vacaciones', 1, vacation()), /Fallo de escritura/);
    assert.deepEqual(db.events, ['begin', 'rollback', 'release']);
});

test('una planilla registrada no puede reasignarse a otro empleado al guardar', async () => {
    const db = database({ row: { ...vacation(), empleado_id: 20 } });
    await assert.rejects(saveBenefit(db.connection, 'vacaciones', 1, vacation(), 4), { status: 400 });
    assert.equal(db.statements.some(s => s.sql.startsWith('UPDATE')), false);
});
