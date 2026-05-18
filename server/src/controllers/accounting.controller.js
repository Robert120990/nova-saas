const pool = require('../config/db');

// === Account Types ===
const getAccountTypes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM account_types WHERE company_id = ? ORDER BY code', [req.company_id]);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createAccountType = async (req, res) => {
    try {
        const data = { ...req.body, company_id: req.company_id };
        const [r] = await pool.query('INSERT INTO account_types SET ?', [data]);
        res.status(201).json({ id: r.insertId, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateAccountType = async (req, res) => {
    try {
        await pool.query('UPDATE account_types SET ? WHERE id = ? AND company_id = ?', [req.body, req.params.id, req.company_id]);
        res.json({ message: 'Actualizado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteAccountType = async (req, res) => {
    try {
        await pool.query('DELETE FROM account_types WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        res.json({ message: 'Eliminado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// === Entry Types ===
const getEntryTypes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM entry_types WHERE company_id = ? ORDER BY code', [req.company_id]);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createEntryType = async (req, res) => {
    try {
        const data = { ...req.body, company_id: req.company_id };
        const [r] = await pool.query('INSERT INTO entry_types SET ?', [data]);
        res.status(201).json({ id: r.insertId, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateEntryType = async (req, res) => {
    try {
        await pool.query('UPDATE entry_types SET ? WHERE id = ? AND company_id = ?', [req.body, req.params.id, req.company_id]);
        res.json({ message: 'Actualizado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteEntryType = async (req, res) => {
    try {
        await pool.query('DELETE FROM entry_types WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        res.json({ message: 'Eliminado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// === Chart of Accounts ===
const getAccounts = async (req, res) => {
    try {
        const { type_id } = req.query;
        let sql = `SELECT a.*, t.name as type_name, t.nature, p.name as parent_name 
                   FROM chart_of_accounts a 
                   LEFT JOIN account_types t ON a.account_type_id = t.id
                   LEFT JOIN chart_of_accounts p ON a.parent_id = p.id
                   WHERE a.company_id = ?`;
        const params = [req.company_id];
        if (type_id) { sql += ' AND a.account_type_id = ?'; params.push(type_id); }
        sql += ' ORDER BY a.code';
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createAccount = async (req, res) => {
    try {
        const data = { ...req.body, company_id: req.company_id };
        const [r] = await pool.query('INSERT INTO chart_of_accounts SET ?', [data]);
        res.status(201).json({ id: r.insertId, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateAccount = async (req, res) => {
    try {
        await pool.query('UPDATE chart_of_accounts SET ? WHERE id = ? AND company_id = ?', [req.body, req.params.id, req.company_id]);
        res.json({ message: 'Actualizado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteAccount = async (req, res) => {
    try {
        await pool.query('DELETE FROM chart_of_accounts WHERE id = ? AND company_id = ?', [req.params.id, req.company_id]);
        res.json({ message: 'Eliminado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// === Accounting Entries ===
const getEntries = async (req, res) => {
    try {
        const { page = 1, limit = 20, start_date, end_date, status } = req.query;
        const offset = (page - 1) * limit;
        let sql = `SELECT e.*, et.name as entry_type_name 
                   FROM accounting_entries e 
                   LEFT JOIN entry_types et ON e.entry_type_id = et.id
                   WHERE e.company_id = ?`;
        const params = [req.company_id];
        if (start_date) { sql += ' AND e.date >= ?'; params.push(start_date); }
        if (end_date) { sql += ' AND e.date <= ?'; params.push(end_date); }
        if (status) { sql += ' AND e.status = ?'; params.push(status); }
        sql += ' ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(sql, params);
        const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM accounting_entries WHERE company_id = ?', [req.company_id]);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const getEntry = async (req, res) => {
    try {
        const [[entry]] = await pool.query(
            `SELECT e.*, et.name as entry_type_name FROM accounting_entries e 
             LEFT JOIN entry_types et ON e.entry_type_id = et.id WHERE e.id = ? AND e.company_id = ?`,
            [req.params.id, req.company_id]
        );
        if (!entry) return res.status(404).json({ message: 'Partida no encontrada' });

        const [lines] = await pool.query(
            `SELECT l.*, a.code as account_code, a.name as account_name 
             FROM accounting_entry_lines l 
             JOIN chart_of_accounts a ON l.account_id = a.id
             WHERE l.entry_id = ? ORDER BY l.id`,
            [req.params.id]
        );
        res.json({ ...entry, lines });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createEntry = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const { entry_type_id, date, description, branch_id, lines } = req.body;
        if (!lines || lines.length === 0) throw new Error('Debe tener al menos una línea');

        // Validar balance
        const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error('El débito y crédito no cuadran');

        // Generar número correlativo
        const [[{ num }]] = await conn.query(
            'SELECT COUNT(*) + 1 as num FROM accounting_entries WHERE company_id = ?', [req.company_id]
        );

        const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: req.company_id,
            branch_id: branch_id || req.branch_id,
            entry_type_id,
            number: `PART-${String(num).padStart(6, '0')}`,
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
        res.json({ message: 'Partida anulada' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
    getAccountTypes, createAccountType, updateAccountType, deleteAccountType,
    getEntryTypes, createEntryType, updateEntryType, deleteEntryType,
    getAccounts, createAccount, updateAccount, deleteAccount,
    getEntries, getEntry, createEntry, voidEntry
};
