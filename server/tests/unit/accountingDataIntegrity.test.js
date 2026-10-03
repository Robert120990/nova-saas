const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { load, database, invoke } = require('./eggTestHelpers.cjs');
const integrity = require('../../src/services/accounting/accountingEntryIntegrity.service');

function controller(file, db, extras = {}) {
    return load(`src/controllers/${file}`, {
        'src/config/db.js': db,
        'src/services/notification.service.js': { notify: async () => {} },
        'src/services/accounting/accountingEntryIntegrity.service.js': integrity,
        'src/services/accounting/accountingGenerationPreview.service.js': {},
        'src/controllers/accounting.correlativos.controller.js': { reserveEntryNumber: async () => '2610001' },
        ...extras
    });
}
const lines = [{ id: 1, account_id: 10, debit: '50.00', credit: '0.00' }, { id: 2, account_id: 20, debit: '0.00', credit: '50.00' }];
const entry = { id: 1, company_id: 7, description: 'Partida original', status: 'posted' };
const accounts = database(async (_sql, params) => [params[1].map(id => ({ id }))]);

describe('Integridad de contabilidad', () => {
    it('rechaza cuentas de otra empresa antes de eliminar líneas o insertar asientos', async () => {
        const db = database(async () => [[{ id: 10 }]]);
        await assert.rejects(integrity.validateEntryLines(db, 7, lines), /pertenecer a esta empresa/);
        assert.equal(db.calls[0].params[0], 7);
    });

    it('rechaza montos no finitos, negativos, de precisión excesiva y partidas descuadradas', async () => {
        for (const debit of [Infinity, -5, 50.005, 51]) {
            await assert.rejects(integrity.validateEntryLines(accounts, 7, [{ account_id: 10, debit }, lines[1]]));
        }
        await assert.rejects(integrity.validateEntryLines(accounts, 7, [{ account_id: 10, debit: 50, credit: 50 }]), /al mismo tiempo/);
        assert.deepEqual(await integrity.validateEntryLines(accounts, 7, lines), { totalDebit: 50, totalCredit: 50 });
    });

    it('la versión detecta cambios aunque ocurran dentro del mismo segundo', () => {
        const before = integrity.entryVersion(entry, lines);
        const after = integrity.entryVersion(entry, [{ ...lines[0], description: 'Otra edición' }, lines[1]]);
        assert.notEqual(before, after);
        assert.equal(before, integrity.entryVersion(entry, lines.map(line => ({ ...line, debit: Number(line.debit), credit: Number(line.credit) }))));
    });

    it('rechaza una edición desactualizada sin borrar los datos existentes', async () => {
        const db = database(async sql => {
            if (sql.includes('SELECT * FROM accounting_entries')) return [[entry]];
            if (sql.includes('SELECT * FROM accounting_entry_lines')) return [lines];
            throw new Error(`No se esperaba escritura: ${sql}`);
        });
        const { updateEntry } = controller('accounting/accountingEntries.controller.js', db);
        const result = await invoke(updateEntry, { params: { id: 1 }, body: { lines, expected_version: 'desactualizada' } });
        assert.equal(result.statusCode, 409);
        assert.ok(db.calls.some(call => call.sql.includes('FOR UPDATE')));
        assert.ok(db.calls.some(call => call.sql === 'ROLLBACK'));
        assert.ok(!db.calls.some(call => call.sql.startsWith('DELETE')));
    });

    it('revierte la sustitución de líneas cuando falla una inserción', async () => {
        const db = database(async (sql, params) => {
            if (sql.includes('SELECT * FROM accounting_entries')) return [[entry]];
            if (sql.includes('SELECT * FROM accounting_entry_lines')) return [lines];
            if (sql.includes('SELECT id FROM chart_of_accounts')) return [params[1].map(id => ({ id }))];
            if (sql.startsWith('INSERT INTO accounting_entry_lines')) throw new Error('Falla de almacenamiento');
            return [{ affectedRows: 1 }];
        });
        const result = await invoke(controller('accounting/accountingEntries.controller.js', db).updateEntry, {
            params: { id: 1 }, body: { lines, expected_version: integrity.entryVersion(entry, lines) }
        });
        assert.equal(result.statusCode, 400);
        assert.ok(db.calls.some(call => call.sql.startsWith('DELETE')));
        assert.ok(db.calls.some(call => call.sql === 'ROLLBACK'));
        assert.ok(!db.calls.some(call => call.sql === 'COMMIT'));
    });

    it('guarda ajustes como un solo lote y revierte si falla el segundo valor', async () => {
        let writes = 0;
        const db = database(async sql => {
            if (sql.startsWith('INSERT') && ++writes === 2) throw new Error('Falla simulada');
            return [{}];
        });
        const result = await invoke(controller('accounting/accountingSettings.controller.js', db).saveSettings, {
            body: { settings: { CUENTA_CAJA: 10, CUENTA_BANCOS: 20 } }
        });
        assert.equal(result.statusCode, 400);
        assert.equal(db.calls[0].sql, 'BEGIN');
        assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
    });

    it('impide modificar los marcadores internos desde ajustes', async () => {
        const db = database(async () => { throw new Error('No se debe escribir'); });
        for (const key of ['PARTIDA_VENTAS_2026-10-01', 'partida_ventas_2026-10-01']) {
            const result = await invoke(controller('accounting/accountingSettings.controller.js', db).saveSettings, {
                body: { settings: {}, remove: [key] }
            });
            assert.equal(result.statusCode, 400);
            assert.match(result.body.message, /marcadores/);
        }
        assert.ok(!db.calls.some(call => call.sql.startsWith('DELETE')));
    });

    it('un segundo usuario no sobreescribe un ajuste que cambió después de cargarlo', async () => {
        let value = '10';
        const db = database(async (sql, params) => {
            if (sql.startsWith('SELECT')) return [[{ setting_key: 'CUENTA_CAJA', setting_value: value }]];
            if (sql.startsWith('INSERT')) value = params[2];
            return [{ affectedRows: 1 }];
        });
        const save = controller('accounting/accountingSettings.controller.js', db).saveSettings;
        const first = await invoke(save, { body: { settings: { CUENTA_CAJA: 20 }, expected_settings: { CUENTA_CAJA: '10' } } });
        const writes = db.calls.filter(call => call.sql.startsWith('INSERT')).length;
        const second = await invoke(save, { body: { settings: { CUENTA_CAJA: 30 }, expected_settings: { CUENTA_CAJA: '10' } } });
        assert.equal(first.statusCode, 200);
        assert.equal(second.statusCode, 409);
        assert.equal(second.body.conflicts[0].key, 'CUENTA_CAJA');
        assert.equal(second.body.conflicts[0].current, '20');
        assert.equal(second.body.conflicts[0].expected, '10');
        assert.equal(value, '20');
        assert.equal(db.calls.filter(call => call.sql.startsWith('INSERT')).length, writes);
        assert.ok(db.calls.some(call => call.sql.includes('FOR UPDATE') && call.params[0] === 7));
        assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
    });

    it('detecta creaciones y eliminaciones concurrentes sin borrar ajustes nuevos', async () => {
        const db = database(async () => [[{ setting_key: 'CUENTA_CAJA', setting_value: '20' }]]);
        const save = controller('accounting/accountingSettings.controller.js', db).saveSettings;
        for (const body of [
            { settings: { CUENTA_CAJA: 10 }, expected_settings: { CUENTA_CAJA: null } },
            { settings: {}, remove: ['CUENTA_CAJA'], expected_settings: { CUENTA_CAJA: '10' } }
        ]) {
            assert.equal((await invoke(save, { body })).statusCode, 409);
        }
        assert.ok(!db.calls.some(call => call.sql.startsWith('DELETE') || call.sql.startsWith('INSERT')));
    });

    it('compara solo claves del lote y permite guardar una clave nueva sin conflictos ajenos', async () => {
        const db = database(async sql => [sql.startsWith('SELECT') ? [] : { affectedRows: 1 }]);
        const result = await invoke(controller('accounting/accountingSettings.controller.js', db).saveSettings, {
            body: { settings: { CUENTA_CAJA: 10 }, expected_settings: { CUENTA_CAJA: null, contador_nombre: 'Anterior' } }
        });
        assert.equal(result.statusCode, 200);
        const check = db.calls.find(call => call.sql.startsWith('SELECT'));
        assert.equal(check.params[0], 7);
        assert.deepEqual(Array.from(check.params[1]), ['CUENTA_CAJA']);
        assert.equal(db.calls.at(-1).sql, 'COMMIT');
    });

    it('rechaza snapshots incompletos antes de modificar la configuración', async () => {
        const db = database(async () => { throw new Error('No se debe escribir'); });
        const result = await invoke(controller('accounting/accountingSettings.controller.js', db).saveSettings, {
            body: { settings: { CUENTA_CAJA: 10 }, expected_settings: {} }
        });
        assert.equal(result.statusCode, 400);
        assert.ok(!db.calls.some(call => call.sql.startsWith('INSERT')));
    });

    it('revierte las asignaciones auxiliares previas si otra cuenta no pertenece a la empresa', async () => {
        const db = database(async (_sql, params) => [params[0] === 10 ? [{ id: 10 }] : []]);
        const result = await invoke(controller('accounting.generation.controller.js', db).saveEntityAccounts, {
            body: { type: 'cliente', items: [{ id: 1, account_id: 10 }, { id: 2, account_id: 999 }] }
        });
        assert.equal(result.statusCode, 400);
        assert.ok(db.calls.some(call => call.sql.startsWith('UPDATE')));
        assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
    });
});

function concurrentGenerationDatabase(initialStatus = null) {
    let marker = initialStatus ? '99' : '', nextId = 100, tail = Promise.resolve();
    const entries = initialStatus ? [{ id: 99, status: initialStatus }] : [];
    const calls = [];
    return {
        entries, calls,
        async query() { return [[{ id: 3 }]]; },
        async getConnection() {
            let unlock, pendingEntry, pendingMarker;
            return {
                async beginTransaction() { calls.push('BEGIN'); },
                async query(sql, params) {
                    calls.push(sql);
                    if (sql.includes('SELECT id FROM chart_of_accounts')) return [params[1].map(id => ({ id }))];
                    if (sql.includes("VALUES (?, ?, '')")) {
                        const previous = tail;
                        tail = new Promise(resolve => { unlock = resolve; });
                        await previous;
                        return [{}];
                    }
                    if (sql.includes('SELECT setting_value')) return [[{ setting_value: marker }]];
                    if (sql.includes('SELECT id, status')) return [entries.filter(row => row.id === Number(params[0]))];
                    if (sql.startsWith('INSERT INTO accounting_entries')) {
                        pendingEntry = { id: nextId++, ...params[0] };
                        return [{ insertId: pendingEntry.id }];
                    }
                    if (sql.startsWith('INSERT INTO accounting_settings')) { pendingMarker = params[2]; return [{}]; }
                    return [{}];
                },
                async commit() { if (pendingEntry) entries.push(pendingEntry); marker = pendingMarker ?? marker; calls.push('COMMIT'); unlock?.(); },
                async rollback() { calls.push('ROLLBACK'); unlock?.(); },
                release() {}
            };
        }
    };
}

describe('Generación simultánea de partidas', () => {
    const body = { kind: 'ventas', date: '2026-10-01', lines };
    it('dos solicitudes simultáneas generan exactamente una partida', async () => {
        const db = concurrentGenerationDatabase();
        const { generate } = controller('accounting.generation.controller.js', db);
        const results = await Promise.all([invoke(generate, { body }), invoke(generate, { body })]);
        assert.deepEqual(results.map(result => result.statusCode).sort(), [201, 409]);
        assert.equal(db.entries.length, 1);
        assert.equal(db.calls.filter(sql => sql === 'COMMIT').length, 1);
    });

    it('permite regenerar una partida anulada y conserva la anterior', async () => {
        const db = concurrentGenerationDatabase('voided');
        const result = await invoke(controller('accounting.generation.controller.js', db).generate, { body });
        assert.equal(result.statusCode, 201);
        assert.equal(db.entries.length, 2);
        assert.equal(db.entries[0].status, 'voided');
    });
});
