import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayrollRequestScope } from '../src/utils/rhPayrollRequestScope.js';

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

test('una respuesta tardía del período anterior no reemplaza la planilla actual', async () => {
    const scope = createPayrollRequestScope();
    let rows = [];
    const load = async (response) => {
        const request = scope.begin();
        const result = await response.promise;
        if (request.isCurrent()) rows = result;
    };
    scope.setContext('empresa-1/2026/departamento-1');
    const previousResponse = deferred();
    const previousLoad = load(previousResponse);
    scope.setContext('empresa-1/2027/departamento-2');
    const currentResponse = deferred();
    const currentLoad = load(currentResponse);
    currentResponse.resolve(['planilla-2027']);
    await currentLoad;
    previousResponse.resolve(['planilla-2026']);
    await previousLoad;
    assert.deepEqual(rows, ['planilla-2027']);
});

test('cambiar empresa invalida una respuesta aunque no se inicie otra consulta', () => {
    const scope = createPayrollRequestScope();
    scope.setContext('empresa-1/2026');
    const request = scope.begin();
    scope.setContext('empresa-2/2026');
    assert.equal(request.isCurrent(), false);
});

test('la cancelación impide revivir un cálculo al volver a sus filtros originales', () => {
    const scope = createPayrollRequestScope();
    scope.setContext('empresa-1/2026');
    const request = scope.begin();
    scope.cancel();
    scope.setContext('empresa-1/2027');
    scope.setContext('empresa-1/2026');
    assert.equal(request.signal.aborted, true);
    assert.equal(request.isCurrent(), false);
});

test('cerrar el modal o desmontar la pantalla impide aplicar respuestas pendientes', () => {
    const scope = createPayrollRequestScope();
    scope.setContext('empresa-1/2026/modal-abierto');
    const request = scope.begin();
    scope.cancel();
    assert.equal(request.isCurrent(), false);
    assert.equal(request.signal.aborted, true);
});

test('iniciar un segundo cálculo cancela el primero incluso en el mismo período', () => {
    const scope = createPayrollRequestScope();
    scope.setContext('empresa-1/2026');
    const previous = scope.begin();
    const latest = scope.begin();
    assert.equal(previous.isCurrent(), false);
    assert.equal(previous.signal.aborted, true);
    assert.equal(latest.isCurrent(), true);
});
