const pool = require('../../config/db');
const { getOfficeConfig, getOfficePool } = require('../officeDb.service');
const { resolveOfficeEmpresa } = require('./accountingBankQuery.service');
const { reserveEntryNumber } = require('../../controllers/accounting.correlativos.controller');
const { validateEntryLines } = require('./accountingEntryIntegrity.service');
const {
    findIvaCreditoAccount,
    findRetencionAccount,
    findPercepcionAccount,
    calculateTaxBreakdown,
    fetchOfficeBankDoc,
    round2
} = require('./accountingBankTax.helper');

async function getEntryTypeIdByCode(code) {
    const [[row]] = await pool.query('SELECT id FROM entry_types WHERE code = ?', [code]);
    return row ? row.id : 1;
}

async function findCounterpartAccount(companyId, searchTerms = []) {
    for (const term of searchTerms) {
        const clean = (term || '').replace(/[,.-].*$/, '').trim();
        if (clean.length < 3) continue;
        const [rows] = await pool.query(
            'SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND allows_entries = 1 AND active = 1 AND name LIKE ? LIMIT 1',
            [companyId, `%${clean.slice(0, 20)}%`]
        );
        if (rows[0]) return rows[0];
    }
    return null;
}

async function buildBankEntryPreview(companyId, { type, id, detallar_iva, tax_detail_mode }) {
    const config = await getOfficeConfig(companyId);
    if (!config.host || !config.database) throw new Error('Conexión a oficina no configurada');

    const officePool = getOfficePool(config);
    const empresa = await resolveOfficeEmpresa(officePool, companyId);
    if (!empresa) throw new Error('Empresa no encontrada en base de datos de oficina');

    const doc = await fetchOfficeBankDoc(officePool, type, id);
    if (!doc) throw new Error('Registro no encontrado en base de datos de oficina');

    const rawDate = doc.fecha instanceof Date
        ? doc.fecha.toISOString().slice(0, 10)
        : (/^\d{2}\/\d{2}\/\d{4}$/.test(String(doc.fecha || ''))
            ? doc.fecha.split('/').reverse().join('-')
            : String(doc.fecha || '').slice(0, 10));

    const monto = round2(doc.valor || doc.monto || doc.cargo || doc.abono || 0);
    const bancoCodCta = (doc.cuenta_cod_cta || '').trim();

    let bankAccount = null;
    if (bancoCodCta) {
        const [[acc]] = await pool.query(
            'SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND code = ?',
            [companyId, bancoCodCta]
        );
        bankAccount = acc || null;
    }

    let defaultTypeCode = 'DIARIO';
    let defaultDesc = '';
    let counterpartAccount = null;
    let isRemesa = false;
    const lines = [];

    if (type === 'cheque') {
        defaultTypeCode = 'CXP';
        const chqNum = String(doc.cheque || '').trim();
        const beneficiario = (doc.a_nombre || doc.beneficiario || '').trim();
        defaultDesc = `CUENTA #${doc.cuenta_numero} CHEQUE #${chqNum} - ${beneficiario}`.trim();
        counterpartAccount = await findCounterpartAccount(companyId, [beneficiario, doc.concepto]);
    } else {
        const ref = String(doc.referencia || '').trim();
        const concepto = (doc.concepto || '').trim();
        const tipoCod = String(doc.tipo_remesa_codigo || '').trim();
        defaultDesc = `CUENTA #${doc.cuenta_numero} DOC #${ref} - ${concepto}`.trim();

        isRemesa = tipoCod === '01' || (parseFloat(doc.cargo) > 0 && !doc.abono);
        defaultTypeCode = isRemesa ? 'INGRESO' : 'GASTO';

        if (isRemesa) {
            const [[cajaAcc]] = await pool.query(
                "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND code = '110101' AND allows_entries = 1",
                [companyId]
            );
            counterpartAccount = cajaAcc || await findCounterpartAccount(companyId, [concepto]);
        } else {
            counterpartAccount = await findCounterpartAccount(companyId, [concepto]);
        }
    }

    const defaultDetallarIva = type === 'cheque' && !isRemesa;
    const shouldDetailIva = isRemesa ? false : (detallar_iva !== undefined ? Boolean(detallar_iva) : defaultDetallarIva);
    const taxMode = isRemesa ? 'none' : (tax_detail_mode || 'none');

    const ivaAccount = shouldDetailIva ? await findIvaCreditoAccount(companyId) : null;
    const retAccount = taxMode === 'retencion' ? await findRetencionAccount(companyId) : null;
    const perAccount = taxMode === 'percepcion' ? await findPercepcionAccount(companyId) : null;

    const breakdown = calculateTaxBreakdown({ monto, detallarIva: shouldDetailIva, taxDetailMode: taxMode });

    if (isRemesa) {
        // Remesa: Bank Debit, Counterpart Credit
        lines.push({
            account_id: bankAccount ? bankAccount.id : null,
            account_code: bankAccount ? bankAccount.code : bancoCodCta,
            account_name: bankAccount ? bankAccount.name : (doc.cuenta_nombre || 'Cuenta bancaria'),
            description: defaultDesc,
            debit: monto,
            credit: 0
        });
        lines.push({
            account_id: counterpartAccount ? counterpartAccount.id : null,
            account_code: counterpartAccount ? counterpartAccount.code : '',
            account_name: counterpartAccount ? counterpartAccount.name : '',
            description: defaultDesc,
            debit: 0,
            credit: monto
        });
    } else {
        // Check / Expense: Counterpart Debit (Subtotal), IVA Debit, Ret/Per, Bank Credit
        lines.push({
            account_id: counterpartAccount ? counterpartAccount.id : null,
            account_code: counterpartAccount ? counterpartAccount.code : '',
            account_name: counterpartAccount ? counterpartAccount.name : '',
            description: defaultDesc,
            debit: breakdown.subtotal,
            credit: 0
        });

        if (shouldDetailIva && breakdown.iva > 0) {
            lines.push({
                account_id: ivaAccount ? ivaAccount.id : null,
                account_code: ivaAccount ? ivaAccount.code : '',
                account_name: ivaAccount ? ivaAccount.name : 'Crédito Fiscal IVA',
                description: defaultDesc,
                debit: breakdown.iva,
                credit: 0
            });
        }

        if (taxMode === 'retencion' && breakdown.retPer > 0) {
            lines.push({
                account_id: retAccount ? retAccount.id : null,
                account_code: retAccount ? retAccount.code : '',
                account_name: retAccount ? retAccount.name : 'Retenciones IVA 1%',
                description: defaultDesc,
                debit: 0,
                credit: breakdown.retPer
            });
        } else if (taxMode === 'percepcion' && breakdown.retPer > 0) {
            lines.push({
                account_id: perAccount ? perAccount.id : null,
                account_code: perAccount ? perAccount.code : '',
                account_name: perAccount ? perAccount.name : 'Percepciones IVA 1%',
                description: defaultDesc,
                debit: breakdown.retPer,
                credit: 0
            });
        }

        lines.push({
            account_id: bankAccount ? bankAccount.id : null,
            account_code: bankAccount ? bankAccount.code : bancoCodCta,
            account_name: bankAccount ? bankAccount.name : (doc.cuenta_nombre || 'Cuenta bancaria'),
            description: defaultDesc,
            debit: 0,
            credit: monto
        });
    }

    const docKey = type === 'cheque' ? `CHEQUE #${doc.cheque}` : `DOC #${doc.referencia}`;
    const [[existing]] = await pool.query(
        "SELECT id, number, date, status, description FROM accounting_entries WHERE company_id = ? AND description LIKE ? AND status <> 'voided' LIMIT 1",
        [companyId, `%${docKey}%`]
    );

    return {
        type,
        id,
        fecha: rawDate,
        documento_numero: type === 'cheque' ? String(doc.cheque || '') : String(doc.referencia || ''),
        banco_label: [doc.banco_nombre, doc.cuenta_numero, doc.cuenta_nombre].filter(Boolean).join(' - '),
        beneficiario: doc.a_nombre || doc.beneficiario || '',
        concepto: doc.concepto || '',
        monto,
        entry_type_code: defaultTypeCode,
        description: defaultDesc,
        lines,
        detallar_iva: shouldDetailIva,
        tax_detail_mode: taxMode,
        is_remesa: Boolean(isRemesa),
        tax_accounts: {
            iva: ivaAccount || await findIvaCreditoAccount(companyId),
            retencion: retAccount || await findRetencionAccount(companyId),
            percepcion: perAccount || await findPercepcionAccount(companyId),
            counterpart: counterpartAccount,
            bank: bankAccount
        },
        already_generated: Boolean(existing || doc.num_partida),
        existing_entry: existing ? { id: existing.id, number: existing.number, date: existing.date, description: existing.description } : null
    };
}

async function generateBankEntry(companyId, userId, { type, id, date, description, entry_type_code = 'DIARIO', lines }) {
    if (!Array.isArray(lines) || lines.length === 0) throw new Error('Debe contener al menos una línea');

    const unassigned = lines.find(l => !l.account_id);
    if (unassigned) throw new Error('Todas las líneas deben tener cuenta contable asignada');

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const entryTypeId = await getEntryTypeIdByCode(entry_type_code);
        const { totalDebit, totalCredit } = await validateEntryLines(conn, companyId, lines);

        const entryNumber = await reserveEntryNumber(conn, companyId, entryTypeId, date);

        const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: companyId,
            branch_id: null,
            entry_type_id: entryTypeId,
            number: entryNumber,
            date,
            description: description || `PARTIDA DE ${type.toUpperCase()} #${id}`,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: 'posted',
            created_by: userId
        }]);

        for (const line of lines) {
            await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                entry_id: r.insertId,
                account_id: Number(line.account_id),
                description: line.description || '',
                debit: round2(line.debit || 0),
                credit: round2(line.credit || 0)
            }]);
        }

        await conn.commit();

        try {
            const config = await getOfficeConfig(companyId);
            if (config.host && config.database) {
                const officePool = getOfficePool(config);
                if (type === 'cheque') {
                    const [t] = await officePool.query("SHOW TABLES LIKE 'cheques'");
                    if (t.length > 0) {
                        await officePool.query('UPDATE cheques SET num_partida = ?, es_contabilizado = 1 WHERE id = ?', [entryNumber, id]);
                    } else {
                        await officePool.query("UPDATE vouchers SET num_partida = ?, es_contabilizado = 'S' WHERE id = ? OR llave = ?", [entryNumber, id, id]);
                    }
                } else {
                    const [cols] = await officePool.query("DESCRIBE movimientos_bancarios");
                    const isInt = cols.find(c => c.Field === 'es_contabilizado')?.Type?.startsWith('tinyint');
                    const flag = isInt ? 1 : 'S';
                    await officePool.query('UPDATE movimientos_bancarios SET num_partida = ?, es_contabilizado = ? WHERE id = ?', [entryNumber, flag, id]);
                }
            }
        } catch (syncErr) {
            console.warn('Advertencia al sincronizar estado con base de oficina:', syncErr.message);
        }

        return {
            success: true,
            id: r.insertId,
            number: entryNumber,
            message: `Partida #${entryNumber} generada exitosamente`
        };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function generateBankBatch(companyId, userId, { type, ids }) {
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('Selecciona al menos un registro para contabilizar');

    const results = [];
    let generatedCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
        try {
            const preview = await buildBankEntryPreview(companyId, { type, id });
            if (preview.already_generated) {
                results.push({ id, status: 'skipped', reason: 'Ya fue contabilizado previamente' });
                skippedCount++;
                continue;
            }

            const unassigned = preview.lines.find(l => !l.account_id);
            if (unassigned) {
                results.push({ id, status: 'skipped', reason: 'Falta cuenta contable de contrapartida. Abre con doble clic para editar.' });
                skippedCount++;
                continue;
            }

            const genRes = await generateBankEntry(companyId, userId, {
                type,
                id,
                date: preview.fecha,
                description: preview.description,
                entry_type_code: preview.entry_type_code,
                lines: preview.lines
            });

            results.push({ id, status: 'success', number: genRes.number });
            generatedCount++;
        } catch (itemErr) {
            results.push({ id, status: 'error', error: itemErr.message });
            skippedCount++;
        }
    }

    return {
        success: true,
        generated_count: generatedCount,
        skipped_count: skippedCount,
        results
    };
}

module.exports = {
    buildBankEntryPreview,
    generateBankEntry,
    generateBankBatch
};
