const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { reserveEntryNumber } = require('../accounting.correlativos.controller');
const { entryVersion, validateEntryLines } = require('../../services/accounting/accountingEntryIntegrity.service');

// === Accounting Entries ===
const getEntries = async (req, res) => {
    try {
        const { start_date, end_date, status } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;
        let sql = `SELECT e.*, et.name as entry_type_name 
                   FROM accounting_entries e 
                   LEFT JOIN entry_types et ON e.entry_type_id = et.id
                   WHERE e.company_id = ?`;
        const params = [req.company_id];
        if (start_date) { sql += ' AND e.date >= ?'; params.push(start_date); }
        if (end_date) { sql += ' AND e.date <= ?'; params.push(end_date); }
        if (status) { sql += ' AND e.status = ?'; params.push(status); }
        const countSql = `SELECT COUNT(*) as total FROM accounting_entries e WHERE ${sql.split('WHERE ')[1]}`;
        const countParams = [...params];
        sql += ' ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(sql, params);
        const [[{ total }]] = await pool.query(countSql, countParams);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const getEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [[entry]] = await conn.query(
            `SELECT e.*, et.name as entry_type_name FROM accounting_entries e 
             LEFT JOIN entry_types et ON e.entry_type_id = et.id WHERE e.id = ? AND e.company_id = ? LOCK IN SHARE MODE`,
            [req.params.id, req.company_id]
        );
        if (!entry) { await conn.rollback(); return res.status(404).json({ message: 'Partida no encontrada' }); }

        const [lines] = await conn.query(
            `SELECT l.*, a.code as account_code, a.name as account_name 
             FROM accounting_entry_lines l 
             JOIN chart_of_accounts a ON l.account_id = a.id
             WHERE l.entry_id = ? ORDER BY l.id`,
            [req.params.id]
        );
        await conn.commit();
        res.json({ ...entry, lines, version: entryVersion(entry, lines) });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ message: e.message });
    } finally { conn.release(); }
};

const createEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { entry_type_id, date, description, branch_id, lines } = req.body;
        const { totalDebit, totalCredit } = await validateEntryLines(conn, req.company_id, lines);

        // Generar número correlativo: AAMM-NNN por tipo de partida
        const entryNumber = await reserveEntryNumber(conn, req.company_id, entry_type_id, date);

        const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: req.company_id,
            branch_id: branch_id || req.branch_id,
            entry_type_id,
            number: entryNumber,
            date,
            description,
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
                debit: line.debit || 0,
                credit: line.credit || 0
            }]);
        }

        await conn.commit();
        notificationService.notify('accounting_entry_created', req.company_id, req.user?.branch_id, {
            partida_id: r.insertId,
            tipo_partida: '',
            descripcion: description || '',
            total_debe: totalDebit,
            total_haber: totalCredit,
            fecha: date || ''
        }).catch(() => {});
        res.status(201).json({ id: r.insertId, message: 'Partida registrada' });
    } catch (e) {
        await conn.rollback();
        res.status(400).json({ message: e.message });
    } finally { conn.release(); }
};

const voidEntry = async (req, res) => {
    try {
        const [r] = await pool.query(
            'UPDATE accounting_entries SET status = ? WHERE id = ? AND company_id = ? AND status != ?',
            ['voided', req.params.id, req.company_id, 'voided']
        );
        if (r.affectedRows === 0) return res.status(400).json({ message: 'No se puede anular' });

        notificationService.notify('accounting_entry_voided', req.company_id, req.user?.branch_id, {
            partida_id: parseInt(req.params.id),
            tipo_partida: '',
            descripcion: '',
            total: 0,
            motivo: ''
        }).catch(() => {});

        res.json({ message: 'Partida anulada' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { lines, description, expected_version } = req.body;
        const entryId = req.params.id;

        // Verificar que existe y no está anulada
        const [[entry]] = await conn.query(
            'SELECT * FROM accounting_entries WHERE id = ? AND company_id = ? FOR UPDATE',
            [entryId, req.company_id]
        );
        if (!entry) throw new Error('Partida no encontrada');
        if (entry.status === 'voided') throw new Error('No se puede editar una partida anulada');

        const [previousLines] = await conn.query('SELECT * FROM accounting_entry_lines WHERE entry_id = ? ORDER BY id', [entryId]);
        if (!expected_version || expected_version !== entryVersion(entry, previousLines)) {
            const conflict = new Error('La partida cambió desde que se abrió. Vuelve a cargarla antes de guardar para conservar los cambios de otros usuarios.');
            conflict.statusCode = 409;
            throw conflict;
        }
        const nextLines = lines === undefined ? previousLines : lines;
        const { totalDebit, totalCredit } = await validateEntryLines(conn, req.company_id, nextLines);

        // Actualizar encabezado
        await conn.query('UPDATE accounting_entries SET description = ?, total_debit = ?, total_credit = ?, updated_at = NOW() WHERE id = ?', [
            description || entry.description, totalDebit, totalCredit, entryId
        ]);

        // Eliminar líneas anteriores
        await conn.query('DELETE FROM accounting_entry_lines WHERE entry_id = ?', [entryId]);

        // Insertar nuevas líneas
        for (const line of nextLines) {
            await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                entry_id: entryId,
                account_id: line.account_id,
                description: line.description || '',
                debit: line.debit || 0,
                credit: line.credit || 0
            }]);
        }

        await conn.commit();
        res.json({ message: 'Partida actualizada' });
    } catch (e) {
        await conn.rollback();
        res.status(e.statusCode || 400).json({ message: e.message });
    } finally { conn.release(); }
};


module.exports = { getEntries, getEntry, createEntry, updateEntry, voidEntry };
