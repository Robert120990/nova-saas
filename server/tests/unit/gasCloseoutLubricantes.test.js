const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

/**
 * Pure function simulating the merge logic implemented in GasCloseout.jsx
 * for saveLubricantesMutation.onSuccess
 */
function mergeLubricantReadings({ current, serverData, sentVariables, seq, latestFinishedSeq }) {
    if (seq < latestFinishedSeq) {
        // Discard stale out-of-order response
        return { merged: current, newLatestSeq: latestFinishedSeq, ignored: true };
    }

    const serverMap = new Map((serverData || []).map(r => [r.producto_id, r]));
    const sentMap = new Map((sentVariables || []).map(r => [r.producto_id, r]));

    const merged = current.map(p => {
        const serverItem = serverMap.get(p.producto_id);
        const sentItem = sentMap.get(p.producto_id);
        if (!serverItem) return p;

        // If the current value matches what was sent in this specific mutation,
        // it is safe to accept the server-calculated / normalized value.
        // If the user changed the field while the request was in flight, KEEP the user's latest value!
        const lectura_inicial = (sentItem && (parseFloat(p.lectura_inicial) || 0) === (parseFloat(sentItem.lectura_inicial) || 0))
            ? serverItem.lectura_inicial
            : p.lectura_inicial;

        const recarga = (sentItem && (parseFloat(p.recarga) || 0) === (parseFloat(sentItem.recarga) || 0))
            ? serverItem.recarga
            : p.recarga;

        const lectura_final = (sentItem && (parseFloat(p.lectura_final) || 0) === (parseFloat(sentItem.lectura_final) || 0))
            ? serverItem.lectura_final
            : p.lectura_final;

        const ini = parseFloat(lectura_inicial || 0);
        const rec = parseFloat(recarga || 0);
        const fin = parseFloat(lectura_final || 0);
        const prc = parseFloat(p.precio || serverItem.precio || 0);
        const ventas = parseFloat((ini + rec - fin).toFixed(5));
        const total = parseFloat((ventas * prc).toFixed(2));

        return {
            ...p,
            id: serverItem.id || p.id,
            lectura_inicial,
            recarga,
            lectura_final,
            ventas,
            total,
            precio: prc
        };
    });

    return { merged, newLatestSeq: seq, ignored: false };
}

describe('GasCloseout Lubricantes Race Condition & Synchronization Tests', () => {
    it('Scenario 1: User edits lectura_final while recarga save is in-flight -> does NOT overwrite lectura_final', () => {
        // Initial state before edit:
        // producto_id: 1, inicial: 10, recarga: 0, final: 10
        const initialReading = {
            producto_id: 1,
            producto_codigo: 'LUB01',
            producto_descripcion: 'Aceite 20W50',
            lectura_inicial: '10.00000',
            recarga: '0.00000',
            lectura_final: '10.00000',
            precio: '5.00'
        };

        // 1. User changes recarga to 5 -> save #1 triggers with recarga: 5, final: 10
        const sentVariablesSeq1 = [{
            producto_id: 1,
            lectura_inicial: 10,
            recarga: 5,
            lectura_final: 10,
            ventas: 5,
            total: 25
        }];

        // 2. While request #1 is traveling over network, user types lectura_final = 8 in the input:
        const currentClientStateDuringFlight = [{
            ...initialReading,
            recarga: '5',
            lectura_final: '8' // New unsent user edit!
        }];

        // 3. Response for save #1 arrives from server (it contains recarga: 5, lectura_final: 10)
        const serverResponseSeq1 = [{
            id: 101,
            producto_id: 1,
            lectura_inicial: '10.00000',
            recarga: '5.00000',
            lectura_final: '10.00000',
            ventas: '5.00000',
            total: '25.00',
            precio: '5.00'
        }];

        const result = mergeLubricantReadings({
            current: currentClientStateDuringFlight,
            serverData: serverResponseSeq1,
            sentVariables: sentVariablesSeq1,
            seq: 1,
            latestFinishedSeq: 0
        });

        // The user's unsaved edit to lectura_final (8) MUST be preserved!
        const mergedItem = result.merged[0];
        assert.equal(mergedItem.lectura_final, '8', 'lectura_final should remain 8 and NOT be reverted to 10');
        assert.equal(mergedItem.recarga, '5.00000', 'recarga should be updated to server format');
        // Correct recomputed ventas: 10 + 5 - 8 = 7
        assert.equal(mergedItem.ventas, 7, 'ventas should reflect 10 + 5 - 8 = 7');
        assert.equal(mergedItem.total, 35, 'total should reflect 7 * 5 = 35');
    });

    it('Scenario 2: Out-of-order response (stale sequence) is ignored', () => {
        const currentClientState = [{
            producto_id: 1,
            lectura_inicial: '10.00000',
            recarga: '10.00000',
            lectura_final: '12.00000',
            precio: '5.00'
        }];

        const staleServerData = [{
            producto_id: 1,
            lectura_inicial: '10.00000',
            recarga: '2.00000',
            lectura_final: '10.00000',
            precio: '5.00'
        }];

        const result = mergeLubricantReadings({
            current: currentClientState,
            serverData: staleServerData,
            sentVariables: staleServerData,
            seq: 1, // Stale sequence
            latestFinishedSeq: 2 // A newer sequence 2 has already finished
        });

        assert.equal(result.ignored, true);
        assert.deepEqual(result.merged, currentClientState, 'State should remain untouched');
    });

    it('Scenario 3: Normal save without concurrent edits updates cleanly from server data', () => {
        const clientState = [{
            producto_id: 1,
            lectura_inicial: '10.00000',
            recarga: '5.00000',
            lectura_final: '12.00000',
            precio: '5.00'
        }];

        const sentVariables = [{
            producto_id: 1,
            lectura_inicial: 10,
            recarga: 5,
            lectura_final: 12
        }];

        const serverData = [{
            id: 202,
            producto_id: 1,
            lectura_inicial: '10.00000',
            recarga: '5.00000',
            lectura_final: '12.00000',
            precio: '5.00'
        }];

        const result = mergeLubricantReadings({
            current: clientState,
            serverData,
            sentVariables,
            seq: 3,
            latestFinishedSeq: 2
        });

        assert.equal(result.ignored, false);
        assert.equal(result.merged[0].id, 202);
        assert.equal(result.merged[0].ventas, 3); // 10 + 5 - 12 = 3
        assert.equal(result.merged[0].total, 15); // 3 * 5 = 15
    });
});
