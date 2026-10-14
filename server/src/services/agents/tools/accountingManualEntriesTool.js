const pool = require('../../../config/db');
const notificationService = require('../../notification.service');
const { reserveEntryNumber } = require('../../accounting/accountingCorrelativos.service');
const { validateEntryLines } = require('../../accounting/accountingEntryIntegrity.service');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

async function resolveEntryTypeId(companyId, typeCode = 'DIARIO') {
    const [[row]] = await pool.query(
        'SELECT id FROM entry_types WHERE (company_id = ? OR company_id = 1) AND UPPER(code) = UPPER(?) ORDER BY id DESC LIMIT 1',
        [companyId, typeCode]
    );
    if (row) return row.id;
    const [[diario]] = await pool.query(
        "SELECT id FROM entry_types WHERE (company_id = ? OR company_id = 1) AND code = 'DIARIO' LIMIT 1",
        [companyId]
    );
    return diario ? diario.id : 1;
}

const previewToolDefinition = {
    name: 'preview_manual_entry',
    description: 'Valida y formula la vista previa de una partida contable independiente o manual (ajuste, depreciación, gasto, reclasificación). Verifica el cuadre estricto de partida doble (Debe = Haber) y que las cuentas admitan movimientos.',
    parameters: {
        type: 'object',
        properties: {
            entry_type_code: {
                type: 'string',
                enum: ['DIARIO', 'AJUSTE', 'INGRESO', 'GASTO', 'APERTURA', 'CIERRE'],
                description: 'Tipo de partida contable (por defecto DIARIO o AJUSTE).'
            },
            date: {
                type: 'string',
                description: 'Fecha del asiento en formato YYYY-MM-DD.'
            },
            description: {
                type: 'string',
                description: 'Concepto contable detallado del asiento.'
            },
            lines: {
                type: 'array',
                description: 'Líneas que componen el asiento contable.',
                items: {
                    type: 'object',
                    properties: {
                        account_id: { type: 'number', description: 'ID de la cuenta contable en chart_of_accounts.' },
                        description: { type: 'string', description: 'Descripción específica del renglón.' },
                        debit: { type: 'number', description: 'Monto cargado al Debe (0.00 si es abono).' },
                        credit: { type: 'number', description: 'Monto abonado al Haber (0.00 si es cargo).' }
                    },
                    required: ['account_id', 'debit', 'credit']
                }
            }
        },
        required: ['date', 'description', 'lines']
    }
};

async function executePreview({ entry_type_code = 'DIARIO', date, description, lines }, context) {
    const { companyId } = context;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD.');
    if (!Array.isArray(lines) || lines.length < 2) {
        throw new Error('Una partida contable debe tener al menos dos líneas para cumplir con la partida doble.');
    }

    const conn = await pool.getConnection();
    try {
        const { totalDebit, totalCredit } = await validateEntryLines(conn, companyId, lines);

        const accountIds = lines.map(l => l.account_id);
        const [accounts] = await conn.query(
            `SELECT id, code, name, allows_entries FROM chart_of_accounts WHERE id IN (?) AND company_id = ?`,
            [accountIds, companyId]
        );

        const accMap = {};
        accounts.forEach(a => { accMap[a.id] = a; });

        const enrichedLines = lines.map(l => ({
            account_id: l.account_id,
            account_code: accMap[l.account_id]?.code || 'N/A',
            account_name: accMap[l.account_id]?.name || 'Cuenta',
            description: l.description || description,
            debit: round2(l.debit || 0),
            credit: round2(l.credit || 0)
        }));

        return {
            status: 'valid',
            entry_type: entry_type_code,
            date,
            description,
            total_debit: totalDebit,
            total_credit: totalCredit,
            balanced: totalDebit === totalCredit,
            lines: enrichedLines
        };
    } finally {
        conn.release();
    }
}

const createToolDefinition = {
    name: 'create_manual_entry',
    description: 'Asienta de forma definitiva una partida contable independiente en el libro diario de la empresa. Reserva correlativo oficial y valida partida doble.',
    parameters: {
        type: 'object',
        properties: {
            entry_type_code: {
                type: 'string',
                enum: ['DIARIO', 'AJUSTE', 'INGRESO', 'GASTO', 'APERTURA', 'CIERRE'],
                description: 'Tipo de partida.'
            },
            date: {
                type: 'string',
                description: 'Fecha en formato YYYY-MM-DD.'
            },
            description: {
                type: 'string',
                description: 'Concepto contable de la partida.'
            },
            lines: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        account_id: { type: 'number' },
                        description: { type: 'string' },
                        debit: { type: 'number' },
                        credit: { type: 'number' }
                    },
                    required: ['account_id', 'debit', 'credit']
                }
            }
        },
        required: ['date', 'description', 'lines']
    }
};

async function executeCreate({ entry_type_code = 'DIARIO', date, description, lines }, context) {
    const { companyId, branchId, user } = context;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Formato de fecha inválido. Use YYYY-MM-DD.');
    if (!Array.isArray(lines) || lines.length < 2) {
        throw new Error('La partida contable debe tener al menos dos líneas.');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const entryTypeId = await resolveEntryTypeId(companyId, entry_type_code);
        const { totalDebit, totalCredit } = await validateEntryLines(conn, companyId, lines);
        const entryNumber = await reserveEntryNumber(conn, companyId, entryTypeId, date);

        const [res] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: companyId,
            branch_id: branchId || null,
            entry_type_id: entryTypeId,
            number: entryNumber,
            date,
            description,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: 'posted',
            created_by: user?.id || null
        }]);

        for (const line of lines) {
            await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                entry_id: res.insertId,
                account_id: line.account_id,
                description: line.description || description,
                debit: round2(line.debit || 0),
                credit: round2(line.credit || 0)
            }]);
        }

        await conn.commit();

        notificationService.notify('accounting_entry_created', companyId, branchId, {
            partida_id: res.insertId,
            tipo_partida: entry_type_code,
            descripcion: description,
            total_debe: totalDebit,
            total_haber: totalCredit,
            fecha: date
        }).catch(() => {});

        return {
            status: 'posted',
            entry_id: res.insertId,
            number: entryNumber,
            date,
            total: totalDebit,
            message: `Partida ${entry_type_code} asentada exitosamente con número correlativo ${entryNumber}.`
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
