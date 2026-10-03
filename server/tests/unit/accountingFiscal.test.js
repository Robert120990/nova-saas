const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, invoke } = require('./eggTestHelpers.cjs');
const fiscal = require('../../src/services/accounting/accountingFiscal.service');

const chart = [
    { id: 10, code: '1101', name: 'Caja', type: '1', nature: 'debit' },
    { id: 20, code: '2101', name: 'Pasivo', type: '2', nature: 'credit' },
    { id: 30, code: '3101', name: 'Resultado', type: '3', nature: 'credit' },
    { id: 40, code: '4101', name: 'Ingreso', type: '4', nature: 'credit' },
    { id: 50, code: '6101', name: 'Gasto', type: '6', nature: 'debit' }
];
const source = (id, date, account_id, debit, credit, company_id = 7) => ({ id, date, company_id, status: 'posted', code: 'DIARIO', lines: [{ account_id, debit, credit }] });
function database({ entries = [], markers = {}, failLine, failCommit } = {}) {
    const db = { state: structuredClone({ entries, markers }), calls: [], released: 0 };
    let tail = Promise.resolve();
    db.getConnection = async () => {
        let working, unlock, lineCount = 0;
        return {
            async beginTransaction() { db.calls.push('BEGIN'); },
            async query(raw, params = []) {
                const sql = raw.replace(/\s+/g, ' ').trim(); db.calls.push({ sql, params });
                if (sql.includes('FROM companies')) {
                    const previous = tail; tail = new Promise(resolve => { unlock = resolve; });
                    await previous; working = structuredClone(db.state); return [[{ id: params[0] }]];
                }
                if (sql.includes('FROM accounting_settings')) {
                    if (params[1] === 'resultado_ejercicio_id') return [[{ setting_value: '30' }]];
                    return [working.markers[params[1]] ? [{ setting_value: working.markers[params[1]] }] : []];
                }
                if (sql.includes('FROM accounting_entries e') && sql.includes('JOIN entry_types')) {
                    return [working.entries.filter(entry => entry.company_id === params[0] && entry.code === params[1]
                        && Number(entry.date.slice(0, 4)) === params[2] && entry.status !== 'voided').slice(0, 1)];
                }
                if (sql.startsWith('SELECT id, status FROM accounting_entries')) return [working.entries.filter(entry => entry.id === Number(params[0]) && entry.company_id === params[1])];
                if (sql.startsWith('SELECT id FROM accounting_entries')) return [working.entries.filter(entry => entry.company_id === params[0]
                    && entry.status === 'posted' && Number(entry.date.slice(0, 4)) === params[1] && entry.date <= params[2])];
                if (sql.includes('FROM chart_of_accounts a') && sql.includes('JOIN accounting_entry_lines')) {
                    const accounts = [];
                    for (const account of chart.filter(account => params[2].includes(account.type))) {
                        let debit = 0, credit = 0;
                        for (const entry of working.entries) {
                            if (entry.company_id !== params[1] || entry.status !== 'posted' || entry.date > params[4]) continue;
                            if (sql.includes('YEAR(e.date) = ?') && Number(entry.date.slice(0, 4)) !== params[3]) continue;
                            for (const line of entry.lines.filter(line => line.account_id === account.id)) { debit += line.debit; credit += line.credit; }
                        }
                        const balance = account.nature === 'debit' ? debit - credit : credit - debit;
                        if (balance) accounts.push({ ...account, total_debit: debit, total_credit: credit, balance });
                    }
                    return [accounts];
                }
                if (sql.includes('FROM chart_of_accounts a')) return [[{ id: 30 }]];
                if (sql.startsWith('SELECT id FROM chart_of_accounts')) return [chart.filter(account => params[1].includes(account.id)).map(account => ({ id: account.id }))];
                if (sql.includes('FROM entry_types')) return [[{ id: params[0] === 'CIERRE' ? 2 : 3 }]];
                if (sql.startsWith('INSERT INTO accounting_entries')) {
                    const row = params[0]; const id = Math.max(0, ...working.entries.map(entry => entry.id)) + 1;
                    working.entries.push({ ...row, id, code: row.entry_type_id === 2 ? 'CIERRE' : 'APERTURA', lines: [] }); return [{ insertId: id }];
                }
                if (sql.startsWith('INSERT INTO accounting_entry_lines')) {
                    if (++lineCount === failLine) throw new Error('Falla de detalle');
                    working.entries.find(entry => entry.id === params[0].entry_id).lines.push(params[0]); return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('INSERT INTO accounting_settings')) { working.markers[params[1]] = params[2]; return [{ affectedRows: 1 }]; }
                throw new Error(`SQL no simulado: ${sql}`);
            },
            async commit() { db.calls.push('COMMIT'); if (failCommit) throw new Error('Falla COMMIT'); db.state = working; unlock?.(); },
            async rollback() { db.calls.push('ROLLBACK'); unlock?.(); },
            release() { db.released++; }
        };
    };
    return db;
}
const controller = db => load('src/controllers/accounting/accountingFiscal.controller.js', {
    'src/config/db.js': db,
    'src/services/notification.service.js': { notify: async () => {} },
    'src/services/accounting/accountingFiscal.service.js': fiscal,
    'src/controllers/accounting.correlativos.controller.js': { reserveEntryNumber: async () => '2612001' }
});
const resultSources = () => [source(1, '2026-06-01', 40, 0, 100), source(2, '2026-06-01', 50, 40, 0)];

describe('Cierres y aperturas contables', () => {
    it('utiliza el ejercicio de cierre y el ejercicio previo de apertura y valida fechas reales', () => {
        assert.deepEqual(fiscal.fiscalPeriod('closing', '2026-12-31'), { entryYear: 2026, sourceYear: 2026, cutoff: '2026-12-31' });
        assert.deepEqual(fiscal.fiscalPeriod('opening', '2027-01-01'), { entryYear: 2027, sourceYear: 2026, cutoff: '2026-12-31' });
        assert.throws(() => fiscal.fiscalPeriod('closing', '2026-02-30'), /inválida/);
    });
    it('revierte saldos negativos sin introducir líneas negativas ni líneas vacías', () => {
        assert.deepEqual(fiscal.fiscalLines([{ id: 40, balance: -25, nature: 'credit' }, { id: 50, balance: 0, nature: 'debit' }], 'closing')
            .map(line => [line.account_id, line.debit, line.credit]), [[40, 0, 25]]);
    });
    it('el cierre no acumula saldos de años anteriores, fechas futuras ni otra empresa', async () => {
        const db = database({ entries: [...resultSources(), source(3, '2025-06-01', 40, 0, 500), source(4, '2027-01-01', 40, 0, 700), source(5, '2026-06-01', 40, 0, 900, 8)] });
        const result = await invoke(controller(db).performClosing, { body: { date: '2026-12-31' } });
        assert.equal(result.statusCode, 200); assert.equal(result.body.total_debit, 100); assert.equal(result.body.total_credit, 100);
        assert.equal(db.state.entries.at(-1).lines.find(line => line.account_id === 30).credit, 60);
    });
    it('dos cierres simultáneos generan una sola partida y rechazan el segundo', async () => {
        const db = database({ entries: resultSources() }); const api = controller(db);
        const results = await Promise.all([invoke(api.performClosing, { body: { date: '2026-12-31' } }), invoke(api.performClosing, { body: { date: '2026-12-31' } })]);
        assert.deepEqual(results.map(result => result.statusCode), [200, 409]);
        assert.equal(db.state.entries.filter(entry => entry.code === 'CIERRE').length, 1); assert.equal(db.released, 2);
    });
    it('rechaza aperturas históricas sin marcador antes de copiar sus saldos otra vez', async () => {
        const db = database({ entries: [{ ...source(1, '2027-01-01', 10, 100, 0), code: 'APERTURA' }] });
        const before = structuredClone(db.state);
        const result = await invoke(controller(db).performOpening, { body: { date: '2027-01-01' } });
        assert.equal(result.statusCode, 409); assert.deepEqual(db.state, before);
        assert.equal(db.calls.some(call => call.sql?.startsWith('INSERT')), false);
    });
    it('la apertura copia solo el año previo y registra un balance exacto', async () => {
        const db = database({ entries: [source(1, '2026-01-01', 10, 100, 0), source(2, '2026-01-01', 20, 0, 100),
            source(3, '2025-01-01', 10, 500, 0), source(4, '2025-01-01', 20, 0, 500)] });
        const result = await invoke(controller(db).performOpening, { body: { date: '2027-01-01' } });
        assert.equal(result.statusCode, 200); assert.equal(result.body.total_debit, 100); assert.equal(result.body.total_credit, 100);
        assert.ok(db.state.markers.PARTIDA_APERTURA_2027);
    });
    it('no crea partidas con monto cero ni aperturas descuadradas', async () => {
        for (const entries of [[], [source(1, '2026-01-01', 10, 100, 0)]]) {
            const db = database({ entries }); const before = structuredClone(db.state);
            const result = await invoke(controller(db).performOpening, { body: { date: '2027-01-01' } });
            assert.equal(result.statusCode, 400); assert.deepEqual(db.state, before);
            assert.equal(db.calls.some(call => call.sql?.startsWith('INSERT')), false);
        }
    });
    it('anular la partida marcada permite regenerar el cierre desde los saldos vigentes', async () => {
        const db = database({ entries: [...resultSources(), { id: 3, company_id: 7, date: '2026-12-31', code: 'CIERRE', status: 'voided', lines: [] }], markers: { PARTIDA_CIERRE_2026: '3' } });
        const result = await invoke(controller(db).performClosing, { body: { date: '2026-12-31' } });
        assert.equal(result.statusCode, 200); assert.equal(db.state.markers.PARTIDA_CIERRE_2026, '4');
    });
    it('revierte cabecera, detalles y marcador si falla una línea o el COMMIT', async () => {
        for (const failure of [{ failLine: 2 }, { failCommit: true }]) {
            const db = database({ entries: resultSources(), ...failure }); const before = structuredClone(db.state);
            const result = await invoke(controller(db).performClosing, { body: { date: '2026-12-31' } });
            assert.equal(result.statusCode, 400); assert.deepEqual(db.state, before); assert.equal(db.calls.includes('ROLLBACK'), true); assert.equal(db.released, 1);
        }
    });
});
