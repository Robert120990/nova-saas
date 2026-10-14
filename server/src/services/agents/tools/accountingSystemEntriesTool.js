const pool = require('../../../config/db');
const notificationService = require('../../notification.service');
const { reserveEntryNumber } = require('../../accounting/accountingCorrelativos.service');
const { validateEntryLines } = require('../../accounting/accountingEntryIntegrity.service');
const {
    buildVentasPreview,
    buildComprasPreview,
    buildCxcPreview,
    buildCxpPreview
} = require('../../accounting/accountingGenerationPreview.service');

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

const previewToolDefinition = {
    name: 'preview_system_entry',
    description: 'Genera la vista previa calculada de una partida automática del sistema (ventas, compras, cxc o cxp) para una fecha específica. Revisa cuadre de partida doble y verifica si ya fue generada previamente.',
    parameters: {
        type: 'object',
        properties: {
            kind: {
                type: 'string',
                enum: ['ventas', 'compras', 'cxc', 'cxp'],
                description: 'Tipo de partida automática: ventas, compras, cxc (cobros clientes) o cxp (pagos proveedores).'
            },
            date: {
                type: 'string',
                description: 'Fecha en formato YYYY-MM-DD.'
            },
            detail_credit: {
                type: 'boolean',
                description: 'Si es true, desglosa el crédito cliente por cliente en lugar de un saldo consolidado.'
            }
        },
        required: ['kind', 'date']
    }
};

async function executePreview({ kind, date, detail_credit = false }, context) {
    const { companyId } = context;
    if (!KIND_ENTRY_CODE[kind]) throw new Error(`Tipo de partida '${kind}' no válido. Use: ventas, compras, cxc o cxp.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD.');

    const settings = await getSettingsMap(companyId);
    const required = REQUIRED_KEYS[kind];
    const missing = required.filter(k => !settings[k]);
    if (missing.length > 0) {
        return {
            status: 'error',
            message: `Faltan cuentas configuradas en la empresa para ${kind}: ${missing.join(', ')}`,
            missing
        };
    }

    const numericSettings = {};
    required.forEach(k => { numericSettings[k] = parseInt(settings[k], 10); });
    if (settings.CUENTA_IVA_RETENIDO) numericSettings.CUENTA_IVA_RETENIDO = parseInt(settings.CUENTA_IVA_RETENIDO, 10);

    const data = kind === 'ventas'
        ? await buildVentasPreview(companyId, date, !!detail_credit, numericSettings)
        : kind === 'compras'
            ? await buildComprasPreview(companyId, date, !!detail_credit, numericSettings)
            : kind === 'cxc'
                ? await buildCxcPreview(companyId, date, !!detail_credit, numericSettings)
                : await buildCxpPreview(companyId, date, !!detail_credit, numericSettings);

    const dedupKey = DEDUP_PREFIX[kind] + date;
    const [[generatedEntry]] = settings[dedupKey] ? await pool.query(
        "SELECT id, number, status FROM accounting_entries WHERE id = ? AND company_id = ? AND status <> 'voided'",
        [settings[dedupKey], companyId]
    ) : [[]];

    // Obtener nombres de cuentas para que la IA los presente claramente
    const accountIds = (data.lines || []).map(l => l.account_id).filter(Boolean);
    const accountNamesMap = {};
    if (accountIds.length > 0) {
        const [accRows] = await pool.query(
            `SELECT id, code, name FROM chart_of_accounts WHERE id IN (?)`,
            [accountIds]
        );
        accRows.forEach(a => { accountNamesMap[a.id] = { code: a.code, name: a.name }; });
    }

    const enrichedLines = (data.lines || []).map(l => ({
        account_id: l.account_id,
        account_code: accountNamesMap[l.account_id]?.code || 'N/A',
        account_name: accountNamesMap[l.account_id]?.name || 'Cuenta',
        description: l.description,
        debit: l.debit,
        credit: l.credit
    }));

    return {
        status: 'success',
        kind,
        date,
        already_generated: !!generatedEntry,
        existing_entry: generatedEntry || null,
        balanced: data.balanced,
        total_debit: data.debit,
        total_credit: data.credit,
        diff: data.diff,
        lines_count: enrichedLines.length,
        lines: enrichedLines
    };
}

const createToolDefinition = {
    name: 'create_system_entry',
    description: 'Genera y sienta oficialmente en el libro diario de la empresa una partida automática (ventas, compras, cxc, cxp). Asigna el correlativo AAMM-NNN oficial y previene duplicidades.',
    parameters: {
        type: 'object',
        properties: {
            kind: {
                type: 'string',
                enum: ['ventas', 'compras', 'cxc', 'cxp'],
                description: 'Tipo de partida automática.'
            },
            date: {
                type: 'string',
                description: 'Fecha en formato YYYY-MM-DD.'
            },
            description: {
                type: 'string',
                description: 'Concepto opcional de la partida.'
            }
        },
        required: ['kind', 'date']
    }
};

async function executeCreate({ kind, date, description = '' }, context) {
    const { companyId, branchId, user } = context;
    if (!KIND_ENTRY_CODE[kind]) throw new Error(`Tipo de partida '${kind}' no válido.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD.');

    // 1. Obtener vista previa y verificar
    const preview = await executePreview({ kind, date }, context);
    if (preview.status === 'error') {
        throw new Error(preview.message);
    }
    if (preview.already_generated) {
        throw new Error(`Ya existe una partida de ${kind} para la fecha ${date} (Partida #${preview.existing_entry.id}, número: ${preview.existing_entry.number}). Anúlala primero si deseas regenerarla.`);
    }
    if (!preview.lines || preview.lines.length === 0) {
        throw new Error(`No se encontraron movimientos de ${kind} para registrar en la fecha ${date}.`);
    }

    const entryTypeId = await getEntryTypeIdByCode(KIND_ENTRY_CODE[kind]);
    if (!entryTypeId) {
        throw new Error(`Tipo de partida ${KIND_ENTRY_CODE[kind]} no configurado en la base de datos.`);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [companyId]);

        const rawLines = preview.lines.map(l => ({
            account_id: l.account_id,
            description: l.description,
            debit: l.debit,
            credit: l.credit
        }));

        const { totalDebit, totalCredit } = await validateEntryLines(conn, companyId, rawLines);

        const dedupKey = DEDUP_PREFIX[kind] + date;
        const entryNumber = await reserveEntryNumber(conn, companyId, entryTypeId, date);

        const defaultDesc = {
            ventas: `CONTABILIZACION AUTOMATICA DE VENTAS DEL ${date}`,
            compras: `CONTABILIZACION AUTOMATICA DE COMPRAS DEL ${date}`,
            cxc: `CONTABILIZACION AUTOMATICA DE COBRANZAS DEL ${date}`,
            cxp: `CONTABILIZACION AUTOMATICA DE PAGOS DEL ${date}`
        }[kind];

        const [resEntry] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: companyId,
            branch_id: branchId || null,
            entry_type_id: entryTypeId,
            number: entryNumber,
            date,
            description: description || defaultDesc,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: 'posted',
            created_by: user?.id || null
        }]);

        for (const line of rawLines) {
            await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                entry_id: resEntry.insertId,
                account_id: line.account_id,
                description: line.description || '',
                debit: round2(line.debit || 0),
                credit: round2(line.credit || 0)
            }]);
        }

        // Marcar clave de deduplicación
        await conn.query(
            `INSERT INTO accounting_settings (company_id, setting_key, setting_value) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [companyId, dedupKey, String(resEntry.insertId), String(resEntry.insertId)]
        );

        await conn.commit();

        notificationService.notify('accounting_entry_created', companyId, branchId, {
            partida_id: resEntry.insertId,
            tipo_partida: KIND_ENTRY_CODE[kind],
            descripcion: description || defaultDesc,
            total_debe: totalDebit,
            total_haber: totalCredit,
            fecha: date
        }).catch(() => {});

        return {
            status: 'posted',
            entry_id: resEntry.insertId,
            number: entryNumber,
            date,
            total: totalDebit,
            message: `Partida de ${kind} asentada exitosamente con número correlativo ${entryNumber}.`
        };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

module.exports = {
    previewToolDefinition,
    executePreview,
    createToolDefinition,
    executeCreate
};
