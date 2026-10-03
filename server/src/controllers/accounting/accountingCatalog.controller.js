const pool = require('../../config/db');

// === Account Types (GLOBALES, compartidos por todas las empresas) ===
const getAccountTypes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM account_types ORDER BY code');
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createAccountType = async (req, res) => {
    try {
        const data = req.body;
        const [r] = await pool.query('INSERT INTO account_types SET ?', [data]);
        res.status(201).json({ id: r.insertId, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateAccountType = async (req, res) => {
    try {
        await pool.query('UPDATE account_types SET ? WHERE id = ?', [req.body, req.params.id]);
        res.json({ message: 'Actualizado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteAccountType = async (req, res) => {
    try {
        await pool.query('DELETE FROM account_types WHERE id = ?', [req.params.id]);
        res.json({ message: 'Eliminado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// === Entry Types (globales, compartidos por todas las empresas) ===
const getEntryTypes = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM entry_types ORDER BY code');
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const createEntryType = async (req, res) => {
    try {
        const data = req.body;
        const [r] = await pool.query('INSERT INTO entry_types SET ?', [data]);
        res.status(201).json({ id: r.insertId, ...data });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateEntryType = async (req, res) => {
    try {
        await pool.query('UPDATE entry_types SET ? WHERE id = ?', [req.body, req.params.id]);
        res.json({ message: 'Actualizado' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteEntryType = async (req, res) => {
    try {
        await pool.query('DELETE FROM entry_types WHERE id = ?', [req.params.id]);
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


module.exports = { getAccountTypes, createAccountType, updateAccountType, deleteAccountType, getEntryTypes, createEntryType, updateEntryType, deleteEntryType, getAccounts, createAccount, updateAccount, deleteAccount };
