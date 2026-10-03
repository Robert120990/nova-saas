const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const { reserveEntryNumber } = require('./accounting.correlativos.controller');
const { validateEntryLines } = require('../services/accounting/accountingEntryIntegrity.service');

const { buildVentasPreview, buildComprasPreview, buildCxcPreview, buildCxpPreview } = require('../services/accounting/accountingGenerationPreview.service');

const REQUIRED_KEYS = {
    ventas: [
        'CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_CLIENTES_CXC',
        'CUENTA_VENTAS_GRAVADAS', 'CUENTA_VENTAS_EXENTAS', 'CUENTA_VENTAS_NOSUJETAS',
        'CUENTA_IVA_DEBITO', 'CUENTA_FOVIAL_POR_PAGAR', 'CUENTA_COTRANS_POR_PAGAR', 'CUENTA_IVA_PERCIBIDO'
    ],
    compras: [
        'CUENTA_COMPRAS_GRAVADAS', 'CUENTA_COMPRAS_EXENTAS', 'CUENTA_IVA_CREDITO',
        'CUENTA_PROVEEDORES_CXP', 'CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_IVA_RETENIDO',
        'CUENTA_FOVIAL_POR_PAGAR', 'CUENTA_COTRANS_POR_PAGAR'
    ],
    cxc: ['CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_CLIENTES_CXC'],
    cxp: ['CUENTA_CAJA', 'CUENTA_BANCOS', 'CUENTA_PROVEEDORES_CXP']
};

const KIND_ENTRY_CODE = { ventas: 'VENTAS', compras: 'COMPRAS', cxc: 'CXC', cxp: 'CXP' };
const DEDUP_PREFIX = { ventas: 'PARTIDA_VENTAS_', compras: 'PARTIDA_COMPRAS_', cxc: 'PARTIDA_CXC_', cxp: 'PARTIDA_CXP_' };

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

async function getSettingsMap(companyId) {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ?', [companyId]);
    const map = {};
    rows.forEach(r => { map[r.setting_key] = r.setting_value; });
    return map;
}

async function getEntryTypeIdByCode(code) {
    const [[row]] = await pool.query('SELECT id FROM entry_types WHERE code = ?', [code]);
    return row ? row.id : null;
}

const getConfig = async (req, res) => {
    try {
        const settings = await getSettingsMap(req.company_id);
        const mappings = {};
        const missing = [];
        for (const kind of Object.keys(REQUIRED_KEYS)) {
            mappings[kind] = {};
            for (const key of REQUIRED_KEYS[kind]) {
                const val = settings[key] ? parseInt(settings[key], 10) : null;
                mappings[kind][key] = val;
                if (!val && !missing.includes(key)) missing.push(key);
            }
        }
        const entryTypes = {};
        for (const [kind, code] of Object.entries(KIND_ENTRY_CODE)) {
            entryTypes[kind] = await getEntryTypeIdByCode(code);
        }
        res.json({ mappings, missing, entry_types: entryTypes });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const preview = async (req, res) => {
    try {
        const { kind, date, detail_credit } = req.body;
        if (!KIND_ENTRY_CODE[kind]) return res.status(400).json({ message: 'Tipo inválido (ventas|compras)' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });

        const settings = await getSettingsMap(req.company_id);
        const required = REQUIRED_KEYS[kind];
        const missing = required.filter(k => !settings[k]);
        if (missing.length > 0) {
            return res.status(400).json({ message: `Faltan cuentas configuradas: ${missing.join(', ')}`, missing });
        }
        const numericSettings = {};
        required.forEach(k => { numericSettings[k] = parseInt(settings[k], 10); });
        if (settings.CUENTA_IVA_RETENIDO) numericSettings.CUENTA_IVA_RETENIDO = parseInt(settings.CUENTA_IVA_RETENIDO, 10);

        const data = kind === 'ventas'
            ? await buildVentasPreview(req.company_id, date, !!detail_credit, numericSettings)
            : kind === 'compras'
                ? await buildComprasPreview(req.company_id, date, !!detail_credit, numericSettings)
                : kind === 'cxc'
                    ? await buildCxcPreview(req.company_id, date, !!detail_credit, numericSettings)
                    : await buildCxpPreview(req.company_id, date, !!detail_credit, numericSettings);

        const dedupKey = DEDUP_PREFIX[kind] + date;
        const [[generatedEntry]] = settings[dedupKey] ? await pool.query(
            "SELECT id FROM accounting_entries WHERE id = ? AND company_id = ? AND status <> 'voided'",
            [settings[dedupKey], req.company_id]
        ) : [[]];
        const alreadyGenerated = !!generatedEntry;

        res.json({ kind, date, detail_credit: !!detail_credit, already_generated: alreadyGenerated, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const generate = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { kind, date, lines, description } = req.body;
        if (!KIND_ENTRY_CODE[kind]) return res.status(400).json({ message: 'Tipo inválido (ventas|compras)' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });
        if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ message: 'Debe tener al menos una línea' });

        const dedupKey = DEDUP_PREFIX[kind] + date;

        const entryTypeId = await getEntryTypeIdByCode(KIND_ENTRY_CODE[kind]);
        if (!entryTypeId) return res.status(500).json({ message: `No existe el tipo de partida ${KIND_ENTRY_CODE[kind]}. Ejecuta la migración v145.` });

        await conn.beginTransaction();
        try {
            await conn.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [req.company_id]);
            const { totalDebit, totalCredit } = await validateEntryLines(conn, req.company_id, lines);
            // La clave única serializa también el primer intento de generación del día.
            await conn.query(
                `INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, '')
                 ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key)`,
                [req.company_id, dedupKey]
            );
            const [[marker]] = await conn.query(
                'SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = ? FOR UPDATE',
                [req.company_id, dedupKey]
            );
            if (marker.setting_value) {
                const [[existing]] = await conn.query(
                    'SELECT id, status FROM accounting_entries WHERE id = ? AND company_id = ? FOR UPDATE',
                    [marker.setting_value, req.company_id]
                );
                if (existing && existing.status !== 'voided') {
                    const conflict = new Error(`Ya existe una partida de ${kind} generada para ${date} (partida #${existing.id}). Anúlala primero si deseas regenerarla.`);
                    conflict.statusCode = 409;
                    throw conflict;
                }
            }
            const entryNumber = await reserveEntryNumber(conn, req.company_id, entryTypeId, date);
            const defaultDesc = {
                ventas: `CONTABILIZACION AUTOMATICA DE VENTAS DEL ${date}`,
                compras: `CONTABILIZACION AUTOMATICA DE COMPRAS DEL ${date}`,
                cxc: `CONTABILIZACION AUTOMATICA DE COBRANZAS DEL ${date}`,
                cxp: `CONTABILIZACION AUTOMATICA DE PAGOS DEL ${date}`
            }[kind];

            const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
                company_id: req.company_id,
                branch_id: req.branch_id,
                entry_type_id: entryTypeId,
                number: entryNumber,
                date,
                description: description || defaultDesc,
                total_debit: totalDebit,
                total_credit: totalCredit,
                status: 'posted',
                created_by: req.user?.id
            }]);
            for (const line of lines) {
                await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                    entry_id: r.insertId,
                    account_id: line.account_id,
                    description: line.description || '',
                    debit: round2(line.debit || 0),
                    credit: round2(line.credit || 0)
                }]);
            }
            await conn.query(
                'INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [req.company_id, dedupKey, String(r.insertId), String(r.insertId)]
            );
            await conn.commit();

            notificationService.notify('accounting_entry_created', req.company_id, req.user?.branch_id, {
                partida_id: r.insertId,
                tipo_partida: KIND_ENTRY_CODE[kind],
                descripcion: description || defaultDesc,
                total_debe: totalDebit,
                total_haber: totalCredit,
                fecha: date
            }).catch(() => {});

            res.status(201).json({ id: r.insertId, number: entryNumber, message: 'Partida generada' });
        } catch (e) {
            await conn.rollback();
            throw e;
        }
    } catch (e) { res.status(e.statusCode || 400).json({ message: e.message }); }
    finally { conn.release(); }
};

const ENTITY_TABLES = {
    cliente: { table: 'customers', nameCol: 'nombre' },
    proveedor: { table: 'providers', nameCol: 'nombre' }
};

const listEntityAccounts = async (req, res) => {
    try {
        const type = req.query.type;
        const conf = ENTITY_TABLES[type];
        if (!conf) return res.status(400).json({ message: 'Tipo inválido (cliente|proveedor)' });
        const search = (req.query.search || '').trim();
        let sql = `
            SELECT t.id, t.nombre, t.nrc, t.account_id,
                   acc.code AS account_code, acc.name AS account_name
            FROM ${conf.table} t
            LEFT JOIN chart_of_accounts acc ON acc.id = t.account_id
            WHERE t.company_id = ?`;
        const params = [req.company_id];
        if (search) {
            sql += ` AND (t.nombre LIKE ? OR t.nrc LIKE ?)`;
            const like = `%${search}%`;
            params.push(like, like);
        }
        sql += ' ORDER BY t.nombre LIMIT 50';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const saveEntityAccounts = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { type, items } = req.body;
        const conf = ENTITY_TABLES[type];
        if (!conf) return res.status(400).json({ message: 'Tipo inválido (cliente|proveedor)' });
        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Sin cambios' });
        await conn.beginTransaction();
        for (const item of items) {
            if (!item.id) continue;
            if (item.account_id) {
                const [[acc]] = await conn.query(
                    'SELECT id FROM chart_of_accounts WHERE id = ? AND company_id = ?',
                    [item.account_id, req.company_id]
                );
                if (!acc) throw new Error(`La cuenta ${item.account_id} no pertenece a tu empresa`);
            }
            await conn.query(
                `UPDATE ${conf.table} SET account_id = ? WHERE id = ? AND company_id = ?`,
                [item.account_id || null, item.id, req.company_id]
            );
        }
        await conn.commit();
        res.json({ message: 'Asignaciones guardadas' });
    } catch (e) {
        await conn.rollback();
        res.status(400).json({ message: e.message });
    } finally { conn.release(); }
};

module.exports = { getConfig, preview, generate, listEntityAccounts, saveEntityAccounts };
