const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const clone = value => JSON.parse(JSON.stringify(value));

function loadPayroll(db, entry = 'src/controllers/rhPlanilla.controller.js') {
    const cache = new Map();
    const mocks = {
        'src/config/db.js': db,
        'src/services/notification.service.js': { notify: async () => {} },
        'src/services/pdf.service.js': {},
        'src/utils/numberToWords.js': {}
    };
    function read(absolute) {
        const relative = path.relative(root, absolute).replaceAll('\\', '/');
        if (Object.hasOwn(mocks, relative)) return mocks[relative];
        if (cache.has(absolute)) return cache.get(absolute).exports;
        const module = { exports: {} };
        cache.set(absolute, module);
        vm.runInNewContext(fs.readFileSync(absolute, 'utf8'), {
            module, exports: module.exports, Buffer, console: { error() {}, log() {} },
            require(name) {
                if (name.startsWith('node:')) return require(name);
                if (!name.startsWith('.')) return {};
                const target = path.resolve(path.dirname(absolute), name);
                return read(target + '.js');
            }
        }, { filename: absolute });
        return module.exports;
    }
    return read(path.join(root, entry));
}

function database(options = {}) {
    const db = {
        state: {
            headers: clone(options.headers ?? [{ id: 1, company_id: 7, empleado_id: 11, periodo_anio: 2026,
                periodo_mes: 10, quincena: 'primera', dias_trabajados: 15, sueldo_base: 600, bonificacion_fija: 0,
                total_percepciones: 300, total_deducciones: 0, descuento_isss: 0, descuento_afp: 0,
                descuento_renta: 0, monto_recibir: 300, estado: 'pendiente' }]),
            details: clone(options.details ?? [{ id: 1, planilla_id: 1, cuenta_id: 20, codigo: '01', descripcion: 'SUELDO',
                operacion: 'sumar', tipo_valor: 'dias', valor_base: 15, valor_ingresado: 300, orden: 1 }]),
            commissions: clone(options.commissions ?? []),
            cuotas: options.cuotas ?? 2, activo: 1
        }, calls: [], lock: Promise.resolve(), released: 0
    };
    db.getConnection = async () => {
        let working;
        let unlock;
        const conn = {
            async beginTransaction() { db.calls.push('BEGIN'); },
            async commit() {
                db.calls.push('COMMIT');
                if (options.failCommit) throw new Error('Fallo simulado de COMMIT');
                db.state = working; unlock?.();
            },
            async rollback() { db.calls.push('ROLLBACK'); unlock?.(); },
            release() { db.released++; },
            async query(rawSql, params = []) {
                const sql = rawSql.replace(/\s+/g, ' ').trim();
                db.calls.push({ sql, params: clone(params) });
                const parameterFor = field => {
                    const match = sql.match(new RegExp(`(?:\\b\\w+\\.)?\\b${field} = \\?`));
                    return match ? params[(sql.slice(0, match.index).match(/\?/g) || []).length] : undefined;
                };
                if (sql.includes('FROM companies') && sql.includes('FOR UPDATE')) {
                    const previous = db.lock;
                    db.lock = new Promise(resolve => { unlock = resolve; });
                    await previous;
                    working = clone(db.state);
                    return [[{ id: 7 }]];
                }
                if (options.fail?.(sql, params)) throw new Error('Fallo simulado de persistencia');
                if (sql.includes('FROM information_schema.TABLES')) return [options.commissionsInstalled === false ? [] : [{ installed: 1 }]];
                if (sql.includes('FROM sellers')) return [clone(options.sellers ?? [...new Set(working.commissions.map(c => c.seller_id))].map(id => ({ id })))];
                if (sql.startsWith('SELECT') && sql.includes('FROM egg_seller_commissions')) {
                    let rows = working.commissions.filter(c => c.company_id === Number(parameterFor('company_id')));
                    if (sql.includes('AS amount')) return [[{ amount: rows.filter(c => c.employee_id === Number(params[1]) &&
                        c.transferred_to_planilla_id === Number(params[2]) && c.id !== Number(params[3]) &&
                        ['transferido_planilla', 'pagado'].includes(c.status)).reduce((sum, c) => sum + Number(c.capped_commission_amount), 0) }]];
                    for (const field of ['id', 'seller_id', 'period_year', 'period_month']) {
                        const value = parameterFor(field);
                        if (value !== undefined) rows = rows.filter(c => c[field] === Number(value));
                    }
                    const selectedQuincena = parameterFor('quincena');
                    if (selectedQuincena !== undefined) rows = rows.filter(c => c.quincena === selectedQuincena ||
                        (sql.includes("c.quincena = 'mensual'") && c.quincena === 'mensual' && selectedQuincena === 'segunda'));
                    if (sql.includes('id != ?')) rows = rows.filter(c => c.id !== Number(params[4]));
                    if (sql.includes("status IN ('transferido_planilla', 'pagado')")) rows = rows.filter(c => ['transferido_planilla', 'pagado'].includes(c.status));
                    return [clone(rows)];
                }
                if (sql.startsWith('UPDATE egg_seller_commissions')) {
                    if (sql.includes("status = 'aprobado'")) {
                        working.commissions.filter(c => c.company_id === Number(params[0]) &&
                            params[1].map(Number).includes(c.transferred_to_planilla_id) && c.status === 'transferido_planilla').forEach(c => {
                            c.status = 'aprobado'; c.transferred_to_planilla_id = null; c.transferred_at = null;
                        });
                        return [{ affectedRows: 1 }];
                    }
                    const commission = working.commissions.find(c => c.id === Number(params[1]));
                    commission.status = 'transferido_planilla'; commission.transferred_to_planilla_id = Number(params[0]);
                    return [{ affectedRows: 1 }];
                }
                if (sql.includes('FROM rh_cuentas_planillas')) {
                    let accounts = clone(options.accounts ?? [{ id: 20, codigo: '01', descripcion: 'SUELDO',
                        operacion: 'sumar', tipo_valor: 'dias', orden: 1 }]);
                    if (sql.includes("codigo = '07'")) accounts = accounts.filter(c => c.codigo === '07');
                    else if (params.length > 1) accounts = params[1].map(id => ({ id }));
                    return [accounts];
                }
                if (sql.includes('FROM rh_isss_tasas')) return [clone(options.isss ?? [])];
                if (sql.includes('FROM rh_afp_tasas')) return [clone(options.afp ?? [])];
                if (sql.startsWith('SELECT') && (sql.includes('FROM rh_isss_tasas') || sql.includes('FROM rh_renta_config') ||
                    sql.includes('FROM rh_afp_tasas') || sql.includes('FROM rh_empleado_descuentos'))) return [[]];
                if (sql.includes('FROM rh_empleados')) {
                    let employees = clone(options.employees ?? [{ id: 11, sueldo_base: 600,
                        bonificacion_fija: 0, es_activo: 1, es_jubilado: 1, aplica_renta: 0, en_vacaciones: 0, incapacitado: 0 }]);
                    if (sql.includes('WHERE id = ?') || sql.includes('WHERE e.id = ?')) employees = employees.filter(e => e.id === Number(params[0]));
                    return [employees];
                }
                if (sql.startsWith('SELECT') && sql.includes('FROM rh_planilla_detalles')) {
                    return [clone(working.details.filter(d => d.planilla_id === Number(params[0]) &&
                        (!sql.includes('cuenta_id = ?') || d.cuenta_id === Number(params[1]))))];
                }
                if (sql.startsWith('SELECT') && sql.includes('FROM rh_planillas')) {
                    let rows = working.headers.filter(p => p.company_id === 7);
                    if (sql.includes('p.id = ?') || sql.includes('WHERE id = ?')) rows = rows.filter(p => p.id === Number(params[0]));
                    else if (sql.includes('empleado_id = ?')) rows = rows.filter(p => p.empleado_id === Number(params[1]));
                    const year = parameterFor('periodo_anio');
                    const month = parameterFor('periodo_mes');
                    const quincena = parameterFor('quincena');
                    if (year !== undefined) rows = rows.filter(p => {
                        const matches = p.periodo_anio === Number(year) && p.periodo_mes === Number(month) && p.quincena === quincena;
                        return sql.includes('AND NOT (') ? !matches : matches;
                    });
                    if (sql.includes("quincena = 'primera'")) rows = rows.filter(p => p.quincena === 'primera');
                    if (sql.includes("estado = 'pagada'")) rows = rows.filter(p => p.estado === 'pagada');
                    if (sql.includes("estado != 'pagada'")) rows = rows.filter(p => p.estado !== 'pagada');
                    return [clone(rows.map(p => {
                        const row = { ...p, es_jubilado: 1, aplica_renta: 0 };
                        if (sql.includes('JOIN rh_empleados e')) {
                            const employee = options.employees?.find(e => e.id === p.empleado_id);
                            for (const field of ['afp_id', 'es_jubilado', 'aplica_renta']) {
                                if (employee && sql.includes(`e.${field}`)) row[field] = employee[field];
                            }
                            for (const field of ['sueldo_base', 'bonificacion_fija']) {
                                if (!employee || !sql.includes(`e.${field}`)) continue;
                                const alias = sql.match(new RegExp(`e\\.${field}\\s+as\\s+(\\w+)`, 'i'));
                                row[alias ? alias[1] : field] = employee[field];
                            }
                        }
                        return row;
                    }))];
                }
                if (sql.startsWith('DELETE FROM rh_planilla_detalles')) {
                    working.details = working.details.filter(d => d.planilla_id !== Number(params[0]));
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('UPDATE rh_planilla_detalles')) {
                    if (sql.includes('WHERE planilla_id = ?')) {
                        working.details.filter(d => d.planilla_id === Number(params[0])).forEach(d => {
                            d.valor_base = 0; d.valor_ingresado = 0;
                        });
                    } else {
                        const row = working.details.find(d => d.id === Number(params[2]));
                        row.valor_ingresado = params[0]; row.valor_base = params[1];
                    }
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('INSERT INTO rh_planilla_detalles')) {
                    for (const row of params[0]) working.details.push({ id: working.details.length + 1, planilla_id: Number(row[0]),
                        cuenta_id: row[1], codigo: row[2], descripcion: row[3], operacion: row[4], tipo_valor: row[5],
                        valor_base: row[6], valor_ingresado: row[7], orden: row[8] });
                    return [{ affectedRows: params[0].length }];
                }
                if (sql.startsWith('INSERT INTO rh_planillas')) {
                    const id = Math.max(0, ...working.headers.map(p => p.id)) + 1;
                    working.headers.push({ id, company_id: params[0], empleado_id: params[1], periodo_anio: params[2], periodo_mes: params[3],
                        quincena: params[4], dias_trabajados: params[5], sueldo_base: params[6], bonificacion_fija: params[7], estado: 'pendiente' });
                    return [{ insertId: id }];
                }
                if (sql.startsWith('UPDATE rh_empleado_descuentos')) {
                    if (sql.indexOf('activo =') < sql.indexOf('cuotas_restantes =')) {
                        working.activo = working.cuotas <= 1 ? 0 : working.activo;
                        working.cuotas = Math.max(0, working.cuotas - 1);
                    } else {
                        working.cuotas = Math.max(0, working.cuotas - 1);
                        working.activo = working.cuotas - 1 <= 0 ? 0 : working.activo;
                    }
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('UPDATE rh_planillas')) {
                    if (sql.includes("estado = 'pagada'")) {
                        working.headers.forEach(p => { p.estado = 'pagada'; });
                    } else if (sql.includes('SET total_percepciones')) {
                        const p = working.headers.find(p => p.id === Number(params[6]));
                        ['total_percepciones', 'total_deducciones', 'descuento_isss', 'descuento_afp', 'descuento_renta', 'monto_recibir']
                            .forEach((field, i) => { p[field] = params[i]; });
                    } else if (sql.includes('SET dias_trabajados')) {
                        const id = Number(params[params.length - 2]);
                        working.headers.find(p => p.id === id).dias_trabajados = Number(params[0]);
                    }
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('DELETE FROM rh_planillas')) {
                    working.headers = [];
                    working.details = [];
                    return [{ affectedRows: 1 }];
                }
                throw new Error(`SQL no simulado: ${sql}`);
            }
        };
        return conn;
    };
    return db;
}

async function invoke(handler, { body = {}, params = {}, query = {} } = {}) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = clone(body); return this; } };
    await handler({ company_id: 7, body, params, query, user: { id: 1, branch_id: 2 } }, res);
    return res;
}

module.exports = { loadPayroll, database, invoke };
