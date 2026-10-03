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

module.exports = { entryVersion, validateEntryLines };
