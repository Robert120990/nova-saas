const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadPayroll, database, invoke } = require('./rhPayrollTestHelpers.cjs');

const period = { periodo_anio: 2026, periodo_mes: 10, quincena: 'primera' };
const commission = (id = 1, seller = 3, amount = 200) => ({ id, company_id: 7, seller_id: seller, employee_id: 11,
    period_year: 2026, period_month: 10, quincena: 'primera', capped_commission_amount: amount, status: 'aprobado' });
const salary = { id: 20, codigo: '01', descripcion: 'SUELDO', operacion: 'sumar', tipo_valor: 'dias', orden: 1 };
const bonus = { id: 22, codigo: '02', descripcion: 'BONIFICACION', operacion: 'sumar', tipo_valor: 'valor', orden: 2 };
const account = { id: 21, codigo: '07', descripcion: 'COMISIONES', operacion: 'sumar', tipo_valor: 'valor', orden: 7 };
const overtime = { id: 23, codigo: '03', descripcion: 'HORAS EXTRAS', operacion: 'sumar', tipo_valor: 'horas', orden: 3 };
const deduction = { id: 24, codigo: '10', descripcion: 'OTRA DEDUCCION', operacion: 'restar', tipo_valor: 'valor', orden: 10, valor_base: 25 };
const employee = { id: 11, sueldo_base: 600, bonificacion_fija: 50, es_activo: 1, es_jubilado: 0, aplica_renta: 0, afp_id: 3 };
const taxOptions = { employees: [employee], isss: [{ porcentaje_empleado: 3, tope_quincenal: 500 }],
    afp: [{ porcentaje_empleado: 7.25 }], accounts: [salary, bonus, overtime, account, deduction] };
const detail = (id, definition, amount, base = amount) => ({ id, planilla_id: 1, cuenta_id: definition.id, ...definition,
    valor_ingresado: amount, valor_base: base });

describe('Importación de comisiones hacia planillas', () => {
    it('calcula una sola vez el sueldo y conserva valores manuales y deducciones legales', async () => {
        const details = [detail(1, salary, 300, 15), detail(2, bonus, 50), detail(3, overtime, 75, 5), detail(4, deduction, 25)];
        const db = database({ ...taxOptions, details, commissions: [commission()] });
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
        assert.equal(result.statusCode, 200);
        const payroll = db.state.headers[0];
        assert.equal(payroll.total_percepciones, 625);
        assert.equal(payroll.descuento_isss, 15);
        assert.equal(payroll.descuento_afp, 45.31);
        assert.equal(payroll.total_deducciones, 85.31);
        assert.equal(payroll.monto_recibir, 539.69);
        assert.equal(db.state.details.find(d => d.cuenta_id === overtime.id).valor_ingresado, 75);
        assert.equal(db.state.commissions[0].status, 'transferido_planilla');
        assert.equal(db.state.commissions[0].transferred_to_planilla_id, 1);
    });

    it('la transferencia individual aplica el mismo cálculo y bloqueo que Recursos Humanos', async () => {
        const db = database({ ...taxOptions, commissions: [commission()] });
        const api = loadPayroll(db, 'src/controllers/eggCommissions/eggCommissionsOperations2.controller.js');
        const first = await invoke(api.transferCommissionToPayroll, { body: { commission_id: 1 } });
        assert.equal(first.statusCode, 200);
        assert.equal(db.state.headers[0].total_percepciones, 500);
        assert.equal(db.state.headers[0].descuento_isss, 15);
        assert.equal(db.state.headers[0].descuento_afp, 36.25);
        assert.equal(db.state.headers[0].monto_recibir, 448.75);
        const before = structuredClone(db.state);
        const second = await invoke(api.transferCommissionToPayroll, { body: { commission_id: 1 } });
        assert.equal(second.body.already_transferred, true);
        assert.deepEqual(db.state, before);
        const locks = db.calls.filter(call => call.sql?.includes('FOR UPDATE'));
        assert.equal(locks[0].sql.includes('FROM companies'), true);
    });

    it('crea cabecera y detalles completos al importar a un empleado aún sin planilla', async () => {
        const db = database({ ...taxOptions, headers: [], details: [], commissions: [commission(1, 3, 150)] });
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
        assert.equal(result.statusCode, 200);
        assert.equal(db.state.details.find(d => d.codigo === '01').valor_ingresado, 300);
        assert.equal(db.state.details.find(d => d.codigo === '02').valor_ingresado, 50);
        assert.equal(db.state.details.find(d => d.codigo === '07').valor_ingresado, 150);
        assert.equal(db.state.headers[0].total_percepciones, 500);
        assert.equal(db.state.headers[0].monto_recibir, 423.75);
    });

    it('repetir una importación transferida conserva el detalle y total guardados', async () => {
        const db = database({ ...taxOptions, commissions: [commission()] }); const api = loadPayroll(db);
        assert.equal((await invoke(api.syncIndustrialCommissions, { body: period })).statusCode, 200);
        const before = structuredClone(db.state);
        const second = await invoke(api.syncIndustrialCommissions, { body: period });
        assert.equal(second.statusCode, 200);
        assert.equal(second.body.synced_count, 0);
        assert.deepEqual(db.state, before);
    });

    it('agrega comisiones de dos vendedores vinculados al mismo empleado sin reemplazar la primera', async () => {
        const db = database({ ...taxOptions, commissions: [commission(1, 3, 100), commission(2, 4, 200)] });
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.synced_count, 2);
        assert.equal(db.state.details.find(d => d.codigo === '07').valor_ingresado, 300);
        assert.equal(db.state.headers[0].total_percepciones, 600);
    });

    it('revierte detalles y transferencia si falla el recálculo final', async () => {
        const db = database({ ...taxOptions, commissions: [commission()], fail: sql => sql.startsWith('UPDATE rh_planillas') });
        const before = structuredClone(db.state);
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
        assert.equal(result.statusCode, 500);
        assert.deepEqual(db.state, before);
    });

    it('libera comisiones al excluir o eliminar un borrador para poder importarlas nuevamente', async () => {
        for (const handler of ['deletePlanilla', 'eliminarPeriodo']) {
            const db = database({ ...taxOptions, commissions: [commission()] }); const api = loadPayroll(db);
            assert.equal((await invoke(api.syncIndustrialCommissions, { body: period })).statusCode, 200);
            const deleted = await invoke(api[handler], { params: { id: 1 }, body: period });
            assert.equal(deleted.statusCode, 200);
            assert.equal(db.state.commissions[0].status, 'aprobado');
            assert.equal(db.state.commissions[0].transferred_to_planilla_id, null);
            const imported = await invoke(api.syncIndustrialCommissions, { body: period });
            assert.equal(imported.statusCode, 200);
            assert.equal(imported.body.synced_count, 1);
            assert.equal(db.state.details.find(d => d.codigo === '07').valor_ingresado, 200);
        }
    });

    it('si eliminar el borrador falla conserva también la vinculación de comisiones', async () => {
        const db = database({ ...taxOptions, commissions: [commission()], fail: sql => sql.startsWith('DELETE FROM rh_planillas') });
        const api = loadPayroll(db);
        assert.equal((await invoke(api.syncIndustrialCommissions, { body: period })).statusCode, 200);
        const before = structuredClone(db.state);
        assert.equal((await invoke(api.deletePlanilla, { params: { id: 1 } })).statusCode, 500);
        assert.deepEqual(db.state, before);
    });

    it('recupera una transferencia histórica cuyo borrador fue eliminado', async () => {
        const source = { ...commission(), status: 'transferido_planilla', transferred_to_planilla_id: null };
        const db = database({ ...taxOptions, headers: [], details: [], commissions: [source] });
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.synced_count, 1);
        assert.equal(db.state.commissions[0].transferred_to_planilla_id, 1);
    });

    it('rechaza importaciones sobre períodos cerrados o con otro período abierto', async () => {
        for (const variant of ['closed', 'other']) {
            const db = database({ ...taxOptions, commissions: [commission()] });
            if (variant === 'closed') db.state.headers[0].estado = 'pagada';
            else db.state.headers[0].periodo_mes = 9;
            const before = structuredClone(db.state);
            const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
            assert.equal(result.statusCode, 409);
            assert.deepEqual(db.state, before);
            assert.equal(db.calls.some(call => /^(UPDATE|INSERT|DELETE)/.test(call.sql)), false);
        }
    });

    it('no importa a otra quincena liquidaciones de la primera', async () => {
        const db = database({ ...taxOptions, headers: [], details: [], commissions: [commission()], sellers: [] });
        const before = structuredClone(db.state);
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: { ...period, quincena: 'segunda' } });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.synced_count, 0);
        assert.deepEqual(db.state, before);
    });

    it('rechaza importar otra liquidación del mismo mes que ya fue transferida', async () => {
        const previous = { ...commission(2), quincena: 'segunda', status: 'transferido_planilla', transferred_to_planilla_id: 2 };
        const db = database({ ...taxOptions, commissions: [commission(), previous] });
        const before = structuredClone(db.state);
        const result = await invoke(loadPayroll(db).syncIndustrialCommissions, { body: period });
        assert.equal(result.statusCode, 409);
        assert.deepEqual(db.state, before);
    });
});
