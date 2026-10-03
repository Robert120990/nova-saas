import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayrollSaveQueue } from '../src/components/rh/planillas/payrollSaveQueue.js';

function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
test('persiste ediciones realizadas durante un guardado sin solicitudes simultáneas', async () => {
    const first = deferred();
    let state = { key: '1:2026:10:primera', empleado_id: 1, editRevision: 1, detalles: [{ cantidad: 2 }] };
    const sent = [];
    const queue = createPayrollSaveQueue({
        read: () => structuredClone(state), onBusy: () => {},
        persist: async snapshot => { sent.push(snapshot); if (sent.length === 1) await first.promise; return { id: 12 }; },
        accept: () => {}
    });
    const save = queue();
    state.editRevision = 2;
    state.detalles[0].cantidad = 7;
    const repeated = queue();
    assert.equal(save, repeated);
    first.resolve();
    assert.equal(await save, 12);
    assert.deepEqual(sent.map(s => s.detalles[0].cantidad), [2, 7]);
});
test('una falla preserva el borrador y permite reintentar', async () => {
    const state = { key: '1:2026:10:primera', empleado_id: 1, editRevision: 1, detalles: [{ cantidad: 9 }] };
    let fail = true, accepted = 0;
    const queue = createPayrollSaveQueue({ read: () => structuredClone(state), onBusy: () => {},
        persist: async () => { if (fail) throw new Error('Sin conexión'); return { id: 3 }; },
        accept: () => { accepted++; }
    });
    await assert.rejects(queue(), /Sin conexión/);
    assert.equal(accepted, 0);
    assert.equal(state.detalles[0].cantidad, 9);
    fail = false;
    assert.equal(await queue(), 3);
    assert.equal(accepted, 1);
});
test('una respuesta del empleado anterior no inicia guardados en el nuevo contexto', async () => {
    const first = deferred();
    let state = { key: '1:2026:10:primera', empleado_id: 1, editRevision: 1, detalles: [{ cantidad: 2 }] };
    const sent = [];
    const queue = createPayrollSaveQueue({ read: () => structuredClone(state), onBusy: () => {},
        persist: async snapshot => { sent.push(snapshot); await first.promise; return { id: 1 }; }, accept: () => {}
    });
    const save = queue();
    state = { ...state, key: '2:2026:11:segunda', empleado_id: 2, editRevision: 2 };
    first.resolve();
    await save;
    assert.equal(sent.length, 1);
    assert.equal(sent[0].empleado_id, 1);
});
