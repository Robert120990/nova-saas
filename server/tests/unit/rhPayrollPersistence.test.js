const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadPayroll, database, invoke } = require('./rhPayrollTestHelpers.cjs');

const detail = amount => ({ cuenta_id: 20, codigo: '01', descripcion: 'SUELDO', operacion: 'sumar',
    tipo_valor: 'dias', valor_base: 15, valor_ingresado: amount, orden: 1 });
const period = { periodo_anio: 2026, periodo_mes: 10, quincena: 'primera' };

describe('Persistencia y concurrencia de planillas', () => {
    it('restaura cabecera y detalles cuando falla el INSERT después del DELETE', async () => {
        const db = database({ fail: sql => sql.startsWith('INSERT INTO rh_planilla_detalles') });
        const before = structuredClone(db.state);
        const api = loadPayroll(db);
        const result = await invoke(api.updatePlanilla, { params: { id: 1 }, body: { dias_trabajados: 10, detalles: [detail(400)] } });
        assert.equal(result.statusCode, 500);
        assert.deepEqual(db.state, before);
        assert.equal(db.calls.includes('ROLLBACK'), true);
        assert.equal(db.calls.includes('COMMIT'), false);
        assert.equal(db.released, 1);
    });

    it('conserva valores manuales al intentar generar un período existente', async () => {
        const db = database(); const before = structuredClone(db.state);
        const result = await invoke(loadPayroll(db).generarPlanilla, { body: period });
        assert.equal(result.statusCode, 409);
        assert.match(result.body.message, /Sincronizar/);
        assert.deepEqual(db.state, before);
        assert.equal(db.calls.some(call => call.sql?.startsWith('DELETE')), false);
    });

    it('revierte toda la generación si falla un empleado posterior', async () => {
        const db = database({ headers: [], details: [], employees: [
            { id: 11, sueldo_base: 600, es_jubilado: 1 }, { id: 12, sueldo_base: 900, es_jubilado: 1 }
        ], fail: (sql, params) => sql.startsWith('INSERT INTO rh_planillas') && params[1] === 12 });
        const result = await invoke(loadPayroll(db).generarPlanilla, { body: period });
        assert.equal(result.statusCode, 500);
        assert.equal(db.state.headers.length, 0);
        assert.equal(db.state.details.length, 0);
    });

    it('rechaza una pestaña obsoleta antes de reemplazar detalles', async () => {
        const db = database(); const api = loadPayroll(db);
        const original = await invoke(api.getPlanilla, { params: { id: 1 } });
        assert.equal(original.statusCode, 200);
        const first = await invoke(api.updatePlanilla, { params: { id: 1 }, body: { detalles: [detail(400)], expected_revision: original.body.revision } });
        assert.equal(first.statusCode, 200);
        const before = structuredClone(db.state);
        const stale = await invoke(api.updatePlanilla, { params: { id: 1 }, body: { detalles: [detail(500)], expected_revision: original.body.revision } });
        assert.equal(stale.statusCode, 409);
        assert.deepEqual(db.state, before);
        assert.notEqual(first.body.revision, original.body.revision);
    });

    it('serializa dos guardados simultáneos de la misma revisión y rechaza el segundo', async () => {
        const db = database(); const api = loadPayroll(db);
        const original = await invoke(api.getPlanilla, { params: { id: 1 } });
        const results = await Promise.all([400, 500].map(amount => invoke(api.updatePlanilla, {
            params: { id: 1 }, body: { detalles: [detail(amount)], expected_revision: original.body.revision }
        })));
        assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
        assert.equal(db.state.headers[0].monto_recibir, 400);
    });

    it('recalcula desde detalles guardados e ignora totales de cliente obsoletos', async () => {
        const db = database(); const api = loadPayroll(db);
        const result = await invoke(api.updatePlanilla, { params: { id: 1 }, body: {
            detalles: [detail(450)], total_percepciones: 1, total_deducciones: 9999, descuento_renta: 9999, monto_recibir: 1
        } });
        assert.equal(result.statusCode, 200);
        assert.equal(db.state.headers[0].total_percepciones, 450);
        assert.equal(db.state.headers[0].monto_recibir, 450);
        assert.equal(result.body.monto_recibir, 450);
    });

    it('descuenta una sola cuota al recibir dos pagos simultáneos', async () => {
        const db = database(); const api = loadPayroll(db);
        const results = await Promise.all([invoke(api.pagarPlanilla, { params: { id: 1 } }), invoke(api.pagarPlanilla, { params: { id: 1 } })]);
        assert.deepEqual(results.map(result => result.statusCode), [200, 200]);
        assert.equal(db.state.cuotas, 1);
        assert.equal(db.state.activo, 1);
        assert.equal(db.state.headers[0].estado, 'pagada');
    });

    it('revierte cuotas cuando falla el cierre de la cabecera', async () => {
        const db = database({ fail: sql => sql.startsWith('UPDATE rh_planillas') });
        const before = structuredClone(db.state);
        const result = await invoke(loadPayroll(db).pagarPlanilla, { params: { id: 1 } });
        assert.equal(result.statusCode, 500);
        assert.deepEqual(db.state, before);
    });

    it('conserva cero días trabajados en altas y rechaza detalles vacíos sin escribir', async () => {
        const db = database({ headers: [], details: [] }); const api = loadPayroll(db);
        const created = await invoke(api.createPlanilla, { body: { ...period, empleado_id: 11, dias_trabajados: 0, detalles: [detail(0)] } });
        assert.equal(created.statusCode, 201);
        assert.equal(db.state.headers[0].dias_trabajados, 0);
        const before = structuredClone(db.state);
        const invalid = await invoke(api.updatePlanilla, { params: { id: 1 }, body: { detalles: [] } });
        assert.equal(invalid.statusCode, 400);
        assert.deepEqual(db.state, before);
    });

    it('protege planillas pagadas frente a cálculo, guardado y eliminación', async () => {
        const db = database(); db.state.headers[0].estado = 'pagada'; const api = loadPayroll(db);
        const before = structuredClone(db.state);
        const results = await Promise.all([
            invoke(api.calcular, { body: { planilla_id: 1 } }),
            invoke(api.updatePlanilla, { params: { id: 1 }, body: { detalles: [detail(700)] } }),
            invoke(api.deletePlanilla, { params: { id: 1 } }),
            invoke(api.eliminarPeriodo, { body: period })
        ]);
        assert.deepEqual(results.map(result => result.statusCode), [400, 400, 400, 400]);
        assert.deepEqual(db.state, before);
    });
});
