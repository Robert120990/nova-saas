const { createHash } = require('node:crypto');

function entryVersion(entry, lines) {
    const snapshot = {
        id: Number(entry.id), description: entry.description || '', status: entry.status,
        lines: lines.map(line => ({
            id: Number(line.id), account_id: Number(line.account_id),
            description: line.description || '', debit: Number(line.debit || 0), credit: Number(line.credit || 0)
        }))
    };
    return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

async function validateEntryLines(conn, companyId, lines) {
    if (!Array.isArray(lines) || !lines.length) throw new Error('Debe tener al menos una línea');
    let debitCents = 0, creditCents = 0;
    for (const line of lines) {
        const debit = Number(line.debit || 0), credit = Number(line.credit || 0);
        if (!Number.isInteger(Number(line.account_id)) || Number(line.account_id) <= 0) {
            throw new Error('Todas las líneas necesitan una cuenta contable válida');
        }
        if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
            throw new Error('Los montos deben ser números válidos y no negativos');
        }
        if (debit > 0 && credit > 0) throw new Error('Una línea no puede tener débito y crédito al mismo tiempo');
        if (Math.abs(debit * 100 - Math.round(debit * 100)) > 0.000001 || Math.abs(credit * 100 - Math.round(credit * 100)) > 0.000001) {
            throw new Error('Los montos deben tener como máximo dos decimales');
        }
        debitCents += Math.round(debit * 100);
        creditCents += Math.round(credit * 100);
    }
    if (debitCents !== creditCents) throw new Error('El débito y crédito no cuadran');
    if (!debitCents) throw new Error('La partida debe tener montos mayores que cero');
    const ids = [...new Set(lines.map(line => Number(line.account_id)))];
    const [accounts] = await conn.query(
        'SELECT id FROM chart_of_accounts WHERE company_id = ? AND id IN (?) AND active = 1 AND allows_entries = 1',
        [companyId, ids]
    );
    if (accounts.length !== ids.length) throw new Error('Las cuentas deben pertenecer a esta empresa, estar activas y permitir movimientos');
    return { totalDebit: debitCents / 100, totalCredit: creditCents / 100 };
}

async function quickFixAccountingEntry(pool, companyId, entryId, action = 'sync_totals') {
    let query = 'SELECT id, number, company_id, total_debit, total_credit, status FROM accounting_entries WHERE id = ?';
    const params = [entryId];
    if (companyId) {
        query += ' AND company_id = ?';
        params.push(companyId);
    }
    const [entries] = await pool.query(query, params);
    if (!entries.length) throw new Error('Partida no encontrada');

    const entry = entries[0];
    const [sumRows] = await pool.query(
        'SELECT COALESCE(SUM(debit), 0) as lines_debit, COALESCE(SUM(credit), 0) as lines_credit FROM accounting_entry_lines WHERE entry_id = ?',
        [entry.id]
    );
    const linesDebit = Number(sumRows[0]?.lines_debit || 0);
    const linesCredit = Number(sumRows[0]?.lines_credit || 0);

    if (action === 'auto_balance') {
        const diff = Math.round((linesDebit - linesCredit) * 100) / 100;
        if (Math.abs(diff) > 0.05) {
            throw new Error(`El descuadre ($${Math.abs(diff).toFixed(2)}) supera el límite para ajuste automático (máx $0.05). Edite la partida manualmente.`);
        }
        if (diff !== 0) {
            const [entryLines] = await pool.query('SELECT id, debit, credit FROM accounting_entry_lines WHERE entry_id = ? ORDER BY debit DESC', [entry.id]);
            if (diff < 0) {
                const debitLine = entryLines.find(l => Number(l.debit) > 0);
                if (debitLine) {
                    const newDebit = Math.round((Number(debitLine.debit) + Math.abs(diff)) * 100) / 100;
                    await pool.query('UPDATE accounting_entry_lines SET debit = ? WHERE id = ?', [newDebit, debitLine.id]);
                }
            } else {
                const creditLine = entryLines.find(l => Number(l.credit) > 0);
                if (creditLine) {
                    const newCredit = Math.round((Number(creditLine.credit) + diff) * 100) / 100;
                    await pool.query('UPDATE accounting_entry_lines SET credit = ? WHERE id = ?', [newCredit, creditLine.id]);
                }
            }
        }
        const [finalSum] = await pool.query('SELECT COALESCE(SUM(debit), 0) as d, COALESCE(SUM(credit), 0) as c FROM accounting_entry_lines WHERE entry_id = ?', [entry.id]);
        const targetTotal = Number(finalSum[0]?.c || linesCredit);
        await pool.query('UPDATE accounting_entries SET total_debit = ?, total_credit = ? WHERE id = ?', [targetTotal, targetTotal, entry.id]);
        return { message: `Partida #${entry.number} balanceada exitosamente (Total: $${targetTotal.toFixed(2)})` };
    }

    if (action === 'sync_totals' || !action) {
        await pool.query('UPDATE accounting_entries SET total_debit = ?, total_credit = ? WHERE id = ?', [linesDebit, linesCredit, entry.id]);
        return { message: `Partida #${entry.number} sincronizada correctamente con sus líneas (Debe: $${linesDebit.toFixed(2)}, Haber: $${linesCredit.toFixed(2)})` };
    }

    throw new Error('Acción no soportada');
}

module.exports = { entryVersion, validateEntryLines, quickFixAccountingEntry };
