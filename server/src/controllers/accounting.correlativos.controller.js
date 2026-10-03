const pool = require('../config/db');
const { lockAccountingCompany, reserveEntryNumber, getMonthStats, saveCorrelativosBatch, renumberEntries } = require('../services/accounting/accountingCorrelativos.service');

async function transaction(req, res, handler) {
    let connection, started = false;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction(); started = true;
        const result = await handler(connection);
        await connection.commit(); started = false;
        res.json(result);
    } catch (error) {
        if (started) await connection.rollback().catch(() => {});
        res.status(error.statusCode || 500).json({ message: error.message, ...(error.conflicts ? { conflicts: error.conflicts } : {}) });
    } finally { connection?.release(); }
}

const getCorrelativos = async (req, res) => transaction(req, res, async connection => {
    const year = Number(req.query.year || new Date().getFullYear());
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw Object.assign(new Error('Año inválido'), { statusCode: 400 });
    await lockAccountingCompany(connection, req.company_id);
    const [types] = await connection.query('SELECT id, code, name FROM entry_types ORDER BY code');
    const stats = await getMonthStats(connection, req.company_id, year);
    const [counters] = await connection.query(
        'SELECT entry_type_id, month, current_number FROM accounting_entry_correlativos WHERE company_id = ? AND year = ?',
        [req.company_id, year]
    );
    const current = Object.fromEntries(counters.map(row => [`${row.entry_type_id}_${row.month}`, Number(row.current_number)]));
    return { year, types: types.map(type => ({ type_id: type.id, code: type.code, name: type.name,
        months: Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const stat = stats[`${type.id}_${month}`] || { total: 0, posted_entries: 0, last_used: null };
            return { month, next_number: current[`${type.id}_${month}`] ?? null,
                last_used: stat.last_used, total_entries: Number(stat.total), posted_entries: Number(stat.posted_entries),
                has_gap: stat.last_used != null && Number(stat.last_used) > Number(stat.total) };
        })
    })) };
});

const saveCorrelativos = async (req, res) => transaction(req, res, async connection => {
    await saveCorrelativosBatch(connection, req.company_id, req.body);
    return { message: 'Correlativos guardados' };
});
const renumber = async (req, res) => transaction(req, res, connection => renumberEntries(connection, req.company_id, req.body));

module.exports = { reserveEntryNumber, getCorrelativos, saveCorrelativos, renumber };
