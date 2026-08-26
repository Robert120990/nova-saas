const pool = require('../config/db');

const pad3 = (n) => String(n).padStart(3, '0');

async function reserveEntryNumber(conn, companyId, entryTypeId, dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const prefix = `${String(year).slice(-2)}${String(month).padStart(2, '0')}`;

    const [rows] = await conn.query(
        `SELECT id, current_number FROM accounting_entry_correlativos
         WHERE company_id = ? AND entry_type_id = ? AND year = ? AND month = ? FOR UPDATE`,
        [companyId, entryTypeId, year, month]
    );

    let num;
    if (rows.length > 0) {
        num = rows[0].current_number;
        await conn.query('UPDATE accounting_entry_correlativos SET current_number = current_number + 1 WHERE id = ?', [rows[0].id]);
    } else {
        const [[{ maxNum }]] = await conn.query(
            `SELECT MAX(CAST(RIGHT(number, 3) AS UNSIGNED)) AS maxNum
             FROM accounting_entries
             WHERE company_id = ? AND entry_type_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
               AND number IS NOT NULL AND number <> ''`,
            [companyId, entryTypeId, year, month]
        );
        num = (maxNum || 0) + 1;
        await conn.query(
            'INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number) VALUES (?, ?, ?, ?, ?)',
            [companyId, entryTypeId, year, month, num + 1]
        );
    }
    return `${prefix}${pad3(num)}`;
}

async function getMonthStats(companyId, year) {
    const [stats] = await pool.query(
        `SELECT entry_type_id, MONTH(date) AS m, COUNT(*) AS total,
                MAX(CAST(RIGHT(number, 3) AS UNSIGNED)) AS last_used
         FROM accounting_entries
         WHERE company_id = ? AND YEAR(date) = ? AND number IS NOT NULL AND number <> ''
         GROUP BY entry_type_id, MONTH(date)`,
        [companyId, year]
    );
    const map = {};
    stats.forEach(s => {
        map[`${s.entry_type_id}_${s.m}`] = { total: s.total, last_used: s.last_used };
    });
    return map;
}

const getCorrelativos = async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        if (year < 2000 || year > 2200) return res.status(400).json({ message: 'Año inválido' });

        const [types] = await pool.query('SELECT id, code, name FROM entry_types ORDER BY code');
        const statsMap = await getMonthStats(req.company_id, year);
        const [corrs] = await pool.query(
            'SELECT entry_type_id, month, current_number FROM accounting_entry_correlativos WHERE company_id = ? AND year = ?',
            [req.company_id, year]
        );
        const corrMap = {};
        corrs.forEach(c => { corrMap[`${c.entry_type_id}_${c.month}`] = c.current_number; });

        const result = types.map(t => ({
            type_id: t.id,
            code: t.code,
            name: t.name,
            months: Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const stat = statsMap[`${t.id}_${m}`] || { total: 0, last_used: null };
                return {
                    month: m,
                    next_number: corrMap[`${t.id}_${m}`] ?? null,
                    last_used: stat.last_used,
                    total_entries: stat.total,
                    has_gap: stat.last_used != null && stat.last_used > stat.total
                };
            })
        }));
        res.json({ year, types: result });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const saveCorrelativos = async (req, res) => {
    try {
        const { type_id, year, months } = req.body;
        if (!type_id || !year || !Array.isArray(months) || months.length === 0) {
            return res.status(400).json({ message: 'Datos incompletos' });
        }
        const [[type]] = await pool.query('SELECT id FROM entry_types WHERE id = ?', [type_id]);
        if (!type) return res.status(400).json({ message: 'Tipo de partida inválido' });

        const statsMap = await getMonthStats(req.company_id, year);
        for (const item of months) {
            const m = parseInt(item.month, 10);
            const n = parseInt(item.current_number, 10);
            if (!(m >= 1 && m <= 12)) return res.status(400).json({ message: `Mes inválido: ${item.month}` });
            if (!(Number.isInteger(n) && n >= 1)) return res.status(400).json({ message: `El próximo número del mes ${m} debe ser un entero mayor o igual a 1` });
            const stat = statsMap[`${type_id}_${m}`];
            if (stat && stat.last_used != null && n <= stat.last_used) {
                return res.status(400).json({ message: `Mes ${m}: el próximo número (${n}) debe ser mayor al último usado (${stat.last_used})` });
            }
        }
        for (const item of months) {
            await pool.query(
                `INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE current_number = VALUES(current_number)`,
                [req.company_id, type_id, year, item.month, parseInt(item.current_number, 10)]
            );
        }
        res.json({ message: 'Correlativos guardados' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const renumber = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { type_id, year } = req.body;
        if (!type_id || !year) return res.status(400).json({ message: 'Datos incompletos' });
        const y = parseInt(year, 10);
        if (!(y >= 2000 && y <= 2200)) return res.status(400).json({ message: 'Año inválido' });

        const yy = String(y).slice(-2);
        await conn.beginTransaction();
        try {
            const monthsTouched = [];
            const sample = [];
            let totalChanged = 0;
            let totalEntries = 0;

            for (let m = 1; m <= 12; m++) {
                const [entries] = await conn.query(
                    `SELECT id, number FROM accounting_entries
                     WHERE company_id = ? AND entry_type_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
                       AND status = 'posted'
                     ORDER BY date, id FOR UPDATE`,
                    [req.company_id, type_id, y, m]
                );
                if (entries.length === 0) continue;

                const mm = String(m).padStart(2, '0');
                let seq = 1;
                let changed = 0;
                for (const e of entries) {
                    const newNumber = `${yy}${mm}${pad3(seq)}`;
                    seq++;
                    if (e.number === newNumber) continue;
                    changed++;
                    if (sample.length < 8) sample.push({ id: e.id, antes: e.number, despues: newNumber });
                    await conn.query('UPDATE accounting_entries SET number = ? WHERE id = ?', [newNumber, e.id]);
                }
                await conn.query(
                    `INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE current_number = VALUES(current_number)`,
                    [req.company_id, type_id, y, m, seq]
                );
                totalChanged += changed;
                totalEntries += entries.length;
                monthsTouched.push({ month: m, partidas: entries.length, renumeradas: changed });
            }

            await conn.commit();
            res.json({
                message: `Reenumeración completada: ${totalChanged} de ${totalEntries} partidas actualizadas`,
                total_entries: totalEntries,
                total_changed: totalChanged,
                months: monthsTouched,
                sample
            });
        } catch (e) {
            await conn.rollback();
            throw e;
        }
    } catch (e) { res.status(500).json({ message: e.message }); }
    finally { conn.release(); }
};

module.exports = { reserveEntryNumber, getCorrelativos, saveCorrelativos, renumber };
