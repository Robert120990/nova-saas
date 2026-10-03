const { validateEntryLines } = require('./accountingEntryIntegrity.service');

function fiscalPeriod(kind, date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('Fecha fiscal inválida');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Fecha fiscal inválida');
    const entryYear = parsed.getUTCFullYear();
    return { entryYear, sourceYear: kind === 'opening' ? entryYear - 1 : entryYear,
        cutoff: kind === 'opening' ? `${entryYear - 1}-12-31` : date };
}

async function getFiscalBalances(connection, companyId, kind, date) {
    const period = fiscalPeriod(kind, date);
    const codes = kind === 'opening' ? ['1', '2', '3'] : ['4', '5', '6'];
    const [rows] = await connection.query(`
        SELECT a.id, a.code, a.name, t.name AS type_name, t.nature,
            COALESCE(SUM(l.debit), 0) AS total_debit, COALESCE(SUM(l.credit), 0) AS total_credit,
            CASE WHEN t.nature = 'debit'
                THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) END AS balance
        FROM chart_of_accounts a
        JOIN account_types t ON t.id = a.account_type_id
        JOIN accounting_entry_lines l ON l.account_id = a.id
        JOIN accounting_entries e ON e.id = l.entry_id
        WHERE a.company_id = ? AND e.company_id = ? AND t.code IN (?)
            AND a.active = 1 AND a.allows_entries = 1 AND e.status = 'posted'
            AND YEAR(e.date) = ? AND e.date <= ?
        GROUP BY a.id, a.code, a.name, t.name, t.nature
        HAVING balance != 0 ORDER BY a.code`, [companyId, companyId, codes, period.sourceYear, period.cutoff]);
    return rows;
}

async function resolveResultAccount(connection, companyId) {
    const [[setting]] = await connection.query(
        'SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = ? LOCK IN SHARE MODE',
        [companyId, 'resultado_ejercicio_id']
    );
    const id = Number(setting?.setting_value) || null;
    const [accounts] = await connection.query(`
        SELECT a.id FROM chart_of_accounts a JOIN account_types t ON t.id = a.account_type_id
        WHERE a.company_id = ? AND t.code = '3' AND a.active = 1 AND a.allows_entries = 1
            AND ${id ? 'a.id = ?' : "a.name LIKE '%resultado%'"}
        ORDER BY a.id LIMIT 1 LOCK IN SHARE MODE`, id ? [companyId, id] : [companyId]);
    if (!accounts.length) throw new Error('Configure una cuenta activa de Patrimonio que permita movimientos para Resultado del Ejercicio.');
    return accounts[0].id;
}

function fiscalLines(accounts, kind) {
    const lines = [];
    for (const account of accounts) {
        const cents = Math.round(Number(account.balance) * 100);
        if (!Number.isFinite(cents)) throw new Error('Saldo contable inválido');
        if (!cents) continue;
        let debit = account.nature === 'debit';
        if (kind === 'closing') debit = !debit;
        if (cents < 0) debit = !debit;
        lines.push({ account_id: account.id, description: `${kind === 'closing' ? 'Cierre' : 'Apertura'}: ${account.name} (${account.code})`,
            debit: debit ? Math.abs(cents) / 100 : 0, credit: debit ? 0 : Math.abs(cents) / 100 });
    }
    return lines;
}

async function buildFiscalEntry(connection, companyId, kind, date) {
    const accounts = await getFiscalBalances(connection, companyId, kind, date);
    const lines = fiscalLines(accounts, kind);
    if (!lines.length) throw new Error(kind === 'closing' ? 'No hay saldos de resultado que cerrar' : 'No hay saldos de balance para aperturar');
    if (kind === 'closing') {
        const difference = lines.reduce((total, line) => total + Math.round(line.debit * 100) - Math.round(line.credit * 100), 0);
        if (difference) {
            const resultAccount = await resolveResultAccount(connection, companyId);
            lines.push({ account_id: resultAccount, description: 'Resultado del Ejercicio',
                debit: difference < 0 ? -difference / 100 : 0, credit: difference > 0 ? difference / 100 : 0 });
        }
    }
    const { totalDebit, totalCredit } = await validateEntryLines(connection, companyId, lines);
    return { lines, totalDebit, totalCredit };
}

module.exports = { fiscalPeriod, getFiscalBalances, fiscalLines, buildFiscalEntry };
