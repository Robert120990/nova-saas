const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function load(file, mocks = {}) {
    const cache = new Map();
    function read(absolute) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        if (relative === 'src/config/db.js') throw new Error('Las pruebas no pueden acceder a MySQL.');
        if (cache.has(absolute)) return cache.get(absolute).exports;
        const module = { exports: {} }; cache.set(absolute, module);
        vm.runInNewContext(fs.readFileSync(absolute, 'utf8'), { module, exports: module.exports, Buffer, Date, JSON, URL, process: { env: {} },
            console: { log() {}, error() {}, warn() {} }, setTimeout, clearTimeout,
            require(name) {
                if (Object.hasOwn(mocks, name)) return mocks[name];
                if (name === 'crypto' || name.startsWith('node:')) return require(name);
                if (!name.startsWith('.')) return {};
                const resolved = path.resolve(path.dirname(absolute), name);
                const target = fs.existsSync(resolved + '.js') ? resolved + '.js' : fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? path.join(resolved, 'index.js') : resolved;
                if (Object.hasOwn(mocks, path.relative(root, target).replaceAll('\\','/'))) return read(target);
                if (/services[/\\](?!eggRules|eggStock|eggAccess|eggDispatchEmission|eggDispatchRecovery|eggTelemetry|eggReturnableService|eggReportsExport|eggIndustrial)/.test(target)) return {};
                if (/utils[/\\]/.test(target) && !target.includes('eggProductResolver')) return {};
                return read(target);
            }
        }, { filename: absolute });
        return module.exports;
    }
    return read(path.resolve(root, file));
}
function database(query) {
    const calls = [];
    const db = { calls, transaction: false,
        async query(sql, params = []) { calls.push({ sql, params }); return query(sql, params); },
        async beginTransaction() { db.transaction = true; calls.push({ sql: 'BEGIN' }); },
        async commit() { db.transaction = false; calls.push({ sql: 'COMMIT' }); },
        async rollback() { db.transaction = false; calls.push({ sql: 'ROLLBACK' }); },
        release() {}, async getConnection() { return db; } };
    return db;
}
function controller(name, db, extras = {}) {
    return load(`src/controllers/eggIndustrial/${name}.controller.js`, { 'src/config/db.js': db,
        'src/controllers/eggIndustrial/eggUtils.js': { pool: db, ensureEggSchema: async () => {}, notificationService: { notify: async () => {} }, broadcastToCompany() {}, safeNum: (v,f=0) => Number(v)||f, safeInt: (v,f=null) => parseInt(v)||f, ...extras }
    });
}
async function invoke(fn, { body = {}, params = {}, query = {}, eggAccess = { permissions: [] } } = {}) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, setHeader() {}, json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
    await fn({ company_id: 7, body, params, query, eggAccess, user: { id: 9, branch_id: 1, nombre: 'Pruebas', permissions: [] } }, res);
    return res;
}
module.exports = { load, database, controller, invoke };
