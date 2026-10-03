const failure = (statusCode, message, conflicts) => Object.assign(new Error(message), { statusCode, conflicts });
const prefixFor = (year, month) => `${String(year).slice(-2)}${String(month).padStart(2, '0')}`;
const numberFor = (year, month, sequence) => `${prefixFor(year, month)}${String(sequence).padStart(3, '0')}`;
const suffix = number => /^\d{4}\d{3,}$/.test(String(number || '')) ? Number(String(number).slice(4)) : 0;

function validateContext(type, year) {
    if (!Number.isSafeInteger(Number(type)) || Number(type) < 1) throw failure(400, 'Tipo de partida inválido');
    if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2200) throw failure(400, 'Año inválido');
}

async function lockAccountingCompany(connection, companyId) {
    const [companies] = await connection.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [companyId]);
    if (!companies.length) throw failure(404, 'Empresa no encontrada');
}

async function validateType(connection, type) {
    const [types] = await connection.query('SELECT id FROM entry_types WHERE id = ?', [type]);
    if (!types.length) throw failure(400, 'Tipo de partida inválido');
}

async function monthEntries(connection, companyId, type, year, month) {
    // Lectura actual: evita usar un snapshot anterior al bloqueo de empresa.
    const [entries] = await connection.query(
        `SELECT id, number, status FROM accounting_entries
         WHERE company_id = ? AND entry_type_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
         ORDER BY date, id FOR UPDATE`, [companyId, type, year, month]
    );
    return entries;
}

async function getMonthStats(connection, companyId, year) {
    const [stats] = await connection.query(
        `SELECT entry_type_id, MONTH(date) AS m, COUNT(*) AS total,
                SUM(status = 'posted') AS posted_entries,
                MAX(CAST(SUBSTRING(number, 5) AS UNSIGNED)) AS last_used
         FROM accounting_entries
         WHERE company_id = ? AND YEAR(date) = ? AND number IS NOT NULL AND number <> ''
         GROUP BY entry_type_id, MONTH(date)`, [companyId, year]
    );
    return Object.fromEntries(stats.map(stat => [`${stat.entry_type_id}_${stat.m}`, stat]));
}

async function writeCounter(connection, companyId, type, year, month, number) {
    await connection.query(
        `INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number)
         VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE current_number = VALUES(current_number)`,
        [companyId, type, year, month, number]
    );
}

async function reserveEntryNumber(connection, companyId, type, dateStr) {
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
    if (!matched) throw failure(400, 'Fecha de partida inválida');
    const [, yearText, monthText, dayText] = matched;
    const year = Number(yearText), month = Number(monthText), day = Number(dayText);
    validateContext(type, year);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw failure(400, 'Fecha de partida inválida');
    await lockAccountingCompany(connection, companyId);
    const [rows] = await connection.query(
        `SELECT id, current_number FROM accounting_entry_correlativos
         WHERE company_id = ? AND entry_type_id = ? AND year = ? AND month = ? FOR UPDATE`,
        [companyId, type, year, month]
    );
    const entries = await monthEntries(connection, companyId, type, year, month);
    const maxUsed = entries.reduce((max, entry) => Math.max(max, suffix(entry.number)), 0);
    const sequence = Math.max(Number(rows[0]?.current_number || 1), maxUsed + 1);
    if (!Number.isSafeInteger(sequence) || sequence > 2147483646) throw failure(400, 'El correlativo excede el rango permitido');
    await writeCounter(connection, companyId, type, year, month, sequence + 1);
    return numberFor(year, month, sequence);
}

async function saveCorrelativosBatch(connection, companyId, { type_id, year, months }) {
    validateContext(type_id, year);
    if (!Array.isArray(months) || !months.length) throw failure(400, 'Debe indicar los meses que desea guardar');
    const seen = new Set();
    const normalized = months.map(item => {
        const month = Number(item?.month), number = Number(item?.current_number);
        if (!Number.isInteger(month) || month < 1 || month > 12 || seen.has(month)) throw failure(400, 'Los meses son inválidos o están duplicados');
        if (!Number.isSafeInteger(number) || number < 1 || number > 2147483646) throw failure(400, `El próximo número del mes ${month} debe ser un entero mayor o igual a 1`);
        const expected = item.expected_current_number;
        if (expected !== undefined && expected !== null && (!Number.isSafeInteger(Number(expected)) || Number(expected) < 1)) throw failure(400, 'El correlativo esperado es inválido');
        seen.add(month);
        return { month, number, expected };
    }).sort((a, b) => a.month - b.month);
    await lockAccountingCompany(connection, companyId);
    await validateType(connection, type_id);
    const [previous] = await connection.query(
        `SELECT month, current_number FROM accounting_entry_correlativos
         WHERE company_id = ? AND entry_type_id = ? AND year = ? AND month IN (?) FOR UPDATE`,
        [companyId, type_id, year, normalized.map(item => item.month)]
    );
    const current = Object.fromEntries(previous.map(item => [item.month, Number(item.current_number)]));
    const conflicts = normalized.filter(item => item.expected !== undefined && (current[item.month] ?? null) !== (item.expected === null ? null : Number(item.expected)))
        .map(item => ({ month: item.month, expected: item.expected, current: current[item.month] ?? null }));
    if (conflicts.length) throw failure(409, 'Los correlativos cambiaron desde que los abrió. Sus cambios pendientes se conservan; revise los valores guardados.', conflicts);
    for (const item of normalized) {
        const entries = await monthEntries(connection, companyId, type_id, year, item.month);
        const maxUsed = entries.reduce((max, entry) => Math.max(max, suffix(entry.number)), 0);
        if (item.number <= maxUsed) throw failure(400, `Mes ${item.month}: el próximo número (${item.number}) debe ser mayor al último usado (${maxUsed})`);
    }
    for (const item of normalized) await writeCounter(connection, companyId, type_id, year, item.month, item.number);
}

async function renumberEntries(connection, companyId, { type_id, year }) {
    validateContext(type_id, year);
    await lockAccountingCompany(connection, companyId);
    await validateType(connection, type_id);
    const monthsTouched = [], sample = [];
    let totalChanged = 0, totalEntries = 0;
    for (let month = 1; month <= 12; month++) {
        const all = await monthEntries(connection, companyId, type_id, year, month);
        const posted = all.filter(entry => entry.status === 'posted');
        if (!posted.length) continue;
        const reserved = new Set(all.filter(entry => entry.status !== 'posted').map(entry => suffix(entry.number)));
        let sequence = 1, changed = 0;
        for (const entry of posted) {
            while (reserved.has(sequence)) sequence++;
            const next = numberFor(year, month, sequence++);
            if (entry.number === next) continue;
            changed++;
            if (sample.length < 8) sample.push({ id: entry.id, antes: entry.number, despues: next });
            await connection.query('UPDATE accounting_entries SET number = ? WHERE id = ? AND company_id = ?', [next, entry.id, companyId]);
        }
        const highestReserved = [...reserved].reduce((max, value) => Math.max(max, value), 0);
        await writeCounter(connection, companyId, type_id, year, month, Math.max(sequence, highestReserved + 1));
        totalChanged += changed;
        totalEntries += posted.length;
        monthsTouched.push({ month, partidas: posted.length, renumeradas: changed });
    }
    return { message: `Reenumeración completada: ${totalChanged} de ${totalEntries} partidas actualizadas`, total_entries: totalEntries, total_changed: totalChanged, months: monthsTouched, sample };
}

module.exports = { lockAccountingCompany, reserveEntryNumber, getMonthStats, saveCorrelativosBatch, renumberEntries };
