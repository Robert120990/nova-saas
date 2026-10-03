const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { loadPayroll, invoke } = require('./rhPayrollTestHelpers.cjs');
const service = require('../../src/services/accounting/accountingCorrelativos.service');

const context = { type_id: 3, year: 2026 };
const counter = (month, current_number) => ({ id: month, company_id: 7, entry_type_id: 3, year: 2026, month, current_number });
const entry = (id, month, number, status = 'posted') => ({ id, company_id: 7, entry_type_id: 3, year: 2026, month, number, status });
function database({ counters = [], entries = [], failMonth, failCommit, pause } = {}) {
    const db = { state: structuredClone({ counters, entries }), calls: [], released: 0 };
    let tail = Promise.resolve();
    db.getConnection = async () => {
        let working, unlock;
        return {
            async beginTransaction() { db.calls.push('BEGIN'); },
            async query(raw, params = []) {
                const sql = raw.replace(/\s+/g, ' ').trim(); db.calls.push({ sql, params });
                if (sql.includes('FROM companies') && sql.includes('FOR UPDATE')) {
                    if (!working) {
                        const previous = tail; tail = new Promise(resolve => { unlock = resolve; });
                        await previous; working = structuredClone(db.state);
                    }
                    return [[{ id: params[0] }]];
                }
                if (sql.includes('FROM entry_types')) return [[{ id: 3, code: 'ING', name: 'Ingreso' }]];
                if (sql.includes('FROM accounting_entry_correlativos')) {
                    let rows = working.counters.filter(c => c.company_id === Number(params[0]));
                    if (sql.includes('entry_type_id = ?')) rows = rows.filter(c => c.entry_type_id === Number(params[1]) && c.year === Number(params[2]) &&
                        (Array.isArray(params[3]) ? params[3].includes(c.month) : c.month === Number(params[3])));
                    else rows = rows.filter(c => c.year === Number(params[1]));
                    return [structuredClone(rows)];
                }
                if (sql.includes('FROM accounting_entries')) {
                    let rows = working.entries.filter(e => e.company_id === Number(params[0]));
                    if (sql.includes('GROUP BY')) {
                        rows = rows.filter(e => e.year === Number(params[1]) && e.number);
                        const grouped = {};
                        for (const row of rows) {
                            const key = `${row.entry_type_id}:${row.month}`;
                            const group = grouped[key] ||= { entry_type_id: row.entry_type_id, m: row.month, total: 0, posted_entries: 0, last_used: 0 };
                            group.total++; group.posted_entries += row.status === 'posted' ? 1 : 0;
                            // Interpretar SQL permite detectar una regresión al truncamiento RIGHT(..., 3).
                            const suffix = sql.includes('SUBSTRING(number, 5)') ? row.number.slice(4) : row.number.slice(-3);
                            group.last_used = Math.max(group.last_used, Number(suffix));
                        }
                        return [Object.values(grouped)];
                    }
                    rows = rows.filter(e => e.entry_type_id === Number(params[1]) && e.year === Number(params[2]) && e.month === Number(params[3]));
                    if (pause && !pause.used) { pause.used = true; pause.ready(); await pause.wait; }
                    return [structuredClone(rows.sort((a, b) => a.id - b.id))];
                }
                if (sql.startsWith('INSERT INTO accounting_entry_correlativos')) {
                    if (Number(params[3]) === failMonth) throw new Error('Falla del segundo mes');
                    const existing = working.counters.find(c => c.company_id === Number(params[0]) && c.entry_type_id === Number(params[1]) && c.year === Number(params[2]) && c.month === Number(params[3]));
                    if (existing) existing.current_number = Number(params[4]);
                    else working.counters.push({ ...counter(Number(params[3]), Number(params[4])), company_id: Number(params[0]), entry_type_id: Number(params[1]), year: Number(params[2]) });
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('UPDATE accounting_entries')) {
                    working.entries.find(e => e.id === Number(params[1]) && e.company_id === Number(params[2])).number = params[0];
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('INSERT INTO accounting_entries')) { working.entries.push(params[0]); return [{ affectedRows: 1 }]; }
                throw new Error(`SQL no simulado: ${sql}`);
            },
            async commit() { db.calls.push('COMMIT'); if (failCommit) throw new Error('Falla COMMIT'); db.state = working; unlock?.(); },
            async rollback() { db.calls.push('ROLLBACK'); unlock?.(); },
            release() { db.released++; }
        };
    };
    return db;
}
const api = db => loadPayroll(db, 'src/controllers/accounting.correlativos.controller.js');
async function allocate(db, id = 1) {
    const connection = await db.getConnection(); await connection.beginTransaction();
    try {
        const number = await service.reserveEntryNumber(connection, 7, 3, '2026-10-01');
        await connection.query('INSERT INTO accounting_entries SET ?', [{ ...entry(id, 10, number) }]);
        await connection.commit(); return number;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
}

describe('Integridad de correlativos contables', () => {
    it('revierte todo el lote cuando falla el segundo mes', async () => {
        const db = database({ counters: [counter(1, 4), counter(2, 8)], failMonth: 2 }); const before = structuredClone(db.state);
        const result = await invoke(api(db).saveCorrelativos, { body: { ...context, months: [
            { month: 1, current_number: 10, expected_current_number: 4 }, { month: 2, current_number: 20, expected_current_number: 8 }
        ] } });
        assert.equal(result.statusCode, 500); assert.deepEqual(db.state, before);
        assert.equal(db.calls.includes('ROLLBACK'), true); assert.equal(db.calls.includes('COMMIT'), false);
        assert.equal(db.released, 1);
    });
    it('rechaza snapshots obsoletos antes de escribir cualquier mes', async () => {
        const db = database({ counters: [counter(1, 4), counter(2, 9)] }); const before = structuredClone(db.state);
        const result = await invoke(api(db).saveCorrelativos, { body: { ...context, months: [
            { month: 1, current_number: 10, expected_current_number: 4 }, { month: 2, current_number: 20, expected_current_number: 8 }
        ] } });
        assert.equal(result.statusCode, 409); assert.equal(result.body.conflicts[0].current, 9);
        assert.deepEqual(db.state, before); assert.equal(db.calls.some(call => call.sql?.startsWith('INSERT')), false);
    });
    it('no permite sobrescribir un correlativo creado después de cargar la pantalla', async () => {
        const db = database({ counters: [counter(10, 3)] });
        const result = await invoke(api(db).saveCorrelativos, { body: { ...context, months: [{ month: 10, current_number: 20, expected_current_number: null }] } });
        assert.equal(result.statusCode, 409); assert.equal(db.state.counters[0].current_number, 3);
    });
    it('dos reservas simultáneas del primer mes obtienen números distintos', async () => {
        const db = database();
        assert.deepEqual(await Promise.all([allocate(db, 1), allocate(db, 2)]), ['2610001', '2610002']);
        assert.equal(db.state.counters[0].current_number, 3);
    });
    it('una partida concurrente invalida la edición antigua del contador', async () => {
        let release, ready;
        const waiting = new Promise(resolve => { ready = resolve; });
        const db = database({ counters: [counter(10, 5)], pause: { ready, wait: new Promise(resolve => { release = resolve; }) } });
        const reservation = allocate(db);
        await waiting;
        const saving = invoke(api(db).saveCorrelativos, { body: { ...context, months: [{ month: 10, current_number: 5, expected_current_number: 5 }] } });
        release(); await reservation;
        assert.equal((await saving).statusCode, 409); assert.equal(db.state.counters[0].current_number, 6);
    });
    it('usa el sufijo completo después de mil partidas y corrige contadores rezagados', async () => {
        const db = database({ counters: [counter(10, 5)], entries: [entry(1, 10, '26101000')] });
        assert.equal(await allocate(db, 2), '26101001');
        const result = await invoke(api(db).getCorrelativos, { query: { year: 2026 } });
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.types[0].months[9].last_used, 1001);
        assert.equal(result.body.types[0].months[9].next_number, 1002);
    });
    it('valida todos los meses antes de escribir y respeta números ya usados', async () => {
        const db = database({ entries: [entry(1, 2, '26021000')] }); const before = structuredClone(db.state);
        const result = await invoke(api(db).saveCorrelativos, { body: { ...context, months: [
            { month: 1, current_number: 4 }, { month: 2, current_number: 1000 }
        ] } });
        assert.equal(result.statusCode, 400); assert.deepEqual(db.state, before);
        assert.equal(db.calls.some(call => call.sql?.startsWith('INSERT')), false);
    });
    it('reenumera sin duplicar los números que conservan partidas anuladas', async () => {
        const db = database({ entries: [entry(1, 10, '2610001', 'voided'), entry(2, 10, '2610005'), entry(3, 10, '2610007')] });
        const result = await invoke(api(db).renumber, { body: context });
        assert.equal(result.statusCode, 200);
        assert.deepEqual(db.state.entries.map(e => e.number), ['2610001', '2610002', '2610003']);
        assert.equal(db.state.counters[0].current_number, 4);
        assert.equal(await allocate(db, 4), '2610004');
    });
    it('un COMMIT fallido nunca produce respuesta de éxito', async () => {
        const db = database({ counters: [counter(10, 3)], failCommit: true }); const before = structuredClone(db.state);
        const result = await invoke(api(db).saveCorrelativos, { body: { ...context, months: [{ month: 10, current_number: 4 }] } });
        assert.equal(result.statusCode, 500); assert.deepEqual(db.state, before);
        assert.equal(db.calls.includes('ROLLBACK'), true);
    });
});
