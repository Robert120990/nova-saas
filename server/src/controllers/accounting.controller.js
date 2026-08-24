const pool = require('../config/db');
const notificationService = require('../services/notification.service');

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

        // Generar número correlativo: AAMM-NNN por tipo de partida
        const entryDate = new Date(date);
        const yy = String(entryDate.getFullYear()).slice(-2);
        const mm = String(entryDate.getMonth() + 1).padStart(2, '0');
        const [[{ num }]] = await conn.query(
            `SELECT COUNT(*) + 1 as num FROM accounting_entries 
             WHERE company_id = ? AND entry_type_id = ? AND YEAR(date) = ? AND MONTH(date) = ?`,
            [req.company_id, entry_type_id, entryDate.getFullYear(), entryDate.getMonth() + 1]
        );
        const entryNumber = `${yy}${mm}${String(num).padStart(3, '0')}`;

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
    await conn.beginTransaction();
    try {
        const { lines, description } = req.body;
        const entryId = req.params.id;

        // Verificar que existe y no está anulada
        const [[entry]] = await conn.query(
            'SELECT * FROM accounting_entries WHERE id = ? AND company_id = ?',
            [entryId, req.company_id]
        );
        if (!entry) throw new Error('Partida no encontrada');
        if (entry.status === 'voided') throw new Error('No se puede editar una partida anulada');

        if (!lines || lines.length === 0) throw new Error('Debe tener al menos una línea');

        const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error('El débito y crédito no cuadran');

        // Actualizar encabezado
        await conn.query('UPDATE accounting_entries SET description = ?, total_debit = ?, total_credit = ?, updated_at = NOW() WHERE id = ?', [
            description || entry.description, totalDebit, totalCredit, entryId
        ]);

        // Eliminar líneas anteriores
        await conn.query('DELETE FROM accounting_entry_lines WHERE entry_id = ?', [entryId]);

        // Insertar nuevas líneas
        for (const line of lines) {
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
        res.status(400).json({ message: e.message });
    } finally { conn.release(); }
};

// === Cierre Contable ===
const getTrialBalance = async (req, res) => {
    try {
        const { year } = req.query;
        const fiscalYear = year || new Date().getFullYear();
        const [rows] = await pool.query(`
            SELECT 
                a.id, a.code, a.name, t.name as type_name, t.nature,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit,
                CASE WHEN t.nature = 'debit' 
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id 
                AND e.status = 'posted' AND YEAR(e.date) = ?
            WHERE a.company_id = ? AND a.active = 1 AND a.allows_entries = 1
            GROUP BY a.id, a.code, a.name, t.name, t.nature
            HAVING balance != 0 OR total_debit > 0 OR total_credit > 0
            ORDER BY a.code
        `, [fiscalYear, req.company_id]);
        res.json(rows);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const performClosing = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const { date, description } = req.body;
        const companyId = req.company_id;

        // Obtener cuentas de resultado (ingresos tipo 4, costos tipo 5, gastos tipo 6)
        const [incomeAccounts] = await conn.query(
            `SELECT a.*, t.nature,
                CASE WHEN t.nature = 'credit'
                    THEN COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                    ELSE COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                END as balance
             FROM chart_of_accounts a
             JOIN account_types t ON a.account_type_id = t.id
             LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
             LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted'
             WHERE a.company_id = ? AND a.account_type_id IN (4,5,6) AND a.active = 1 AND a.allows_entries = 1
             GROUP BY a.id
             HAVING balance != 0`,
            [companyId]
        );

        // Buscar cuenta de "Resultado del Ejercicio" desde configuración
        const [settings] = await conn.query(
            'SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = ?',
            [companyId, 'resultado_ejercicio_id']
        );

        let resultAccountId = settings.length > 0 ? parseInt(settings[0].setting_value) : null;

        // Si no está configurado, buscar por nombre
        if (!resultAccountId) {
            const [resultAccounts] = await conn.query(
                `SELECT id FROM chart_of_accounts WHERE company_id = ? AND account_type_id = 3 
                 AND name LIKE '%resultado%' AND active = 1 LIMIT 1`,
                [companyId]
            );
            if (resultAccounts.length === 0) {
                throw new Error('Configure la cuenta "Resultado del Ejercicio" en Ajustes Contables (tipo Patrimonio).');
            }
            resultAccountId = resultAccounts[0].id;
        } else {
            // Verificar que la cuenta exista
            const [check] = await conn.query('SELECT id FROM chart_of_accounts WHERE id = ? AND company_id = ?', [resultAccountId, companyId]);
            if (check.length === 0) throw new Error('La cuenta configurada para "Resultado del Ejercicio" ya no existe.');
        }

        // Construir líneas de cierre
        const lines = [];
        let totalProfit = 0;

        for (const acc of incomeAccounts) {
            const balance = parseFloat(acc.balance);
            if (Math.abs(balance) < 0.01) continue;

            // Si es cuenta de naturaleza acreedora (ingresos), saldar con débito
            // Si es deudora (gastos/costos), saldar con crédito
            const isCreditNature = acc.nature === 'credit';
            const line = {
                account_id: acc.id,
                description: `Cierre: ${acc.name} (${acc.code})`,
                debit: isCreditNature ? balance : 0,
                credit: isCreditNature ? 0 : balance
            };
            lines.push(line);
            totalProfit += isCreditNature ? balance : -balance;
        }

        // Línea a Resultado del Ejercicio (el saldo neto)
        lines.push({
            account_id: resultAccountId,
            description: 'Resultado del Ejercicio',
            debit: totalProfit < 0 ? Math.abs(totalProfit) : 0,
            credit: totalProfit > 0 ? totalProfit : 0,
        });

        if (lines.length === 0) {
            throw new Error('No hay saldos de resultado que cerrar');
        }

        // Validar débito = crédito
        const totalD = lines.reduce((s, l) => s + l.debit, 0);
        const totalC = lines.reduce((s, l) => s + l.credit, 0);
        if (Math.abs(totalD - totalC) > 0.01) {
            throw new Error(`El cierre no cuadra: Débito $${totalD.toFixed(2)}, Crédito $${totalC.toFixed(2)}`);
        }

        const [[cierreType]] = await conn.query("SELECT id FROM entry_types WHERE code = 'CIERRE' LIMIT 1");
        if (!cierreType) throw new Error('No existe el tipo de partida CIERRE');

        // Generar número: mismo formato AAMM-NNN
        const entryDate2 = new Date(date);
        const yy2 = String(entryDate2.getFullYear()).slice(-2);
        const mm2 = String(entryDate2.getMonth() + 1).padStart(2, '0');
        const [[{ num: num2 }]] = await conn.query(
            `SELECT COUNT(*) + 1 as num FROM accounting_entries 
             WHERE company_id = ? AND entry_type_id = ? AND YEAR(date) = ? AND MONTH(date) = ?`,
            [companyId, cierreType.id, entryDate2.getFullYear(), entryDate2.getMonth() + 1]
        );
        const closingNumber = `${yy2}${mm2}${String(num2).padStart(3, '0')}`;

        const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: companyId,
            entry_type_id: cierreType.id,
            number: closingNumber,
            date,
            description: description || 'Cierre del Ejercicio Contable',
            total_debit: totalD,
            total_credit: totalC,
            status: 'posted',
            created_by: req.user?.id
        }]);

        for (const line of lines) {
            await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                entry_id: r.insertId, account_id: line.account_id,
                description: line.description, debit: line.debit, credit: line.credit
            }]);
        }

        await conn.commit();
        notificationService.notify('accounting_closing_done', req.company_id, req.user?.branch_id, {
            periodo_contable: `${entryDate2.getFullYear()}`,
            fecha_cierre: date || '',
            usuario: req.user?.nombre || ''
        }).catch(() => {});
        res.json({ success: true, entry_id: r.insertId, lines: lines.length, total_debit: totalD, total_credit: totalC });
    } catch (e) {
        await conn.rollback();
        res.status(400).json({ message: e.message });
    } finally { conn.release(); }
};

const performOpening = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        const { date, description } = req.body;
        const companyId = req.company_id;

        // Obtener saldos de cuentas de balance (activo 1, pasivo 2, patrimonio 3)
        const [balanceAccounts] = await conn.query(
            `SELECT a.*, t.nature,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
             FROM chart_of_accounts a
             JOIN account_types t ON a.account_type_id = t.id
             LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
             LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted'
             WHERE a.company_id = ? AND a.account_type_id IN (1,2,3) AND a.active = 1 AND a.allows_entries = 1
             GROUP BY a.id
             HAVING balance != 0`,
            [companyId]
        );

        const lines = [];
        for (const acc of balanceAccounts) {
            const balance = parseFloat(acc.balance);
            if (Math.abs(balance) < 0.01) continue;

            const isDebitNature = acc.nature === 'debit';
            lines.push({
                account_id: acc.id,
                description: `Apertura: ${acc.name} (${acc.code})`,
                debit: isDebitNature ? Math.abs(balance) : 0,
                credit: isDebitNature ? 0 : Math.abs(balance),
            });
        }

        if (lines.length === 0) throw new Error('No hay saldos de balance para aperturar');

        const totalD = lines.reduce((s, l) => s + l.debit, 0);
        const totalC = lines.reduce((s, l) => s + l.credit, 0);
        if (Math.abs(totalD - totalC) > 0.01) throw new Error(`La apertura no cuadra: D $${totalD.toFixed(2)}, C $${totalC.toFixed(2)}`);

        const [[aperturaType]] = await conn.query("SELECT id FROM entry_types WHERE code = 'APERTURA' LIMIT 1");
        if (!aperturaType) throw new Error('No existe el tipo de partida APERTURA');

        const entryDate3 = new Date(date);
        const yy3 = String(entryDate3.getFullYear()).slice(-2);
        const mm3 = String(entryDate3.getMonth() + 1).padStart(2, '0');
        const [[{ num: num3 }]] = await conn.query(
            `SELECT COUNT(*) + 1 as num FROM accounting_entries 
             WHERE company_id = ? AND entry_type_id = ? AND YEAR(date) = ? AND MONTH(date) = ?`,
            [companyId, aperturaType.id, entryDate3.getFullYear(), entryDate3.getMonth() + 1]
        );
        const openingNumber = `${yy3}${mm3}${String(num3).padStart(3, '0')}`;

        const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
            company_id: companyId,
            entry_type_id: aperturaType.id,
            number: openingNumber,
            date,
            description: description || 'Apertura del Ejercicio Contable',
            total_debit: totalD,
            total_credit: totalC,
            status: 'posted',
            created_by: req.user?.id
        }]);

        for (const line of lines) {
            await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                entry_id: r.insertId, account_id: line.account_id,
                description: line.description, debit: line.debit, credit: line.credit
            }]);
        }

        await conn.commit();
        notificationService.notify('accounting_opening_done', req.company_id, req.user?.branch_id, {
            periodo_contable: `${entryDate3.getFullYear()}`,
            fecha_apertura: date || '',
            usuario: req.user?.nombre || ''
        }).catch(() => {});
        res.json({ success: true, entry_id: r.insertId, lines: lines.length, total_debit: totalD, total_credit: totalC });
    } catch (e) {
        await conn.rollback();
        res.status(400).json({ message: e.message });
    } finally { conn.release(); }
};

// === Settings ===
const getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ?', [req.company_id]);
        const settings = {};
        rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
        res.json(settings);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const saveSettings = async (req, res) => {
    try {
        const { settings, remove } = req.body;
        for (const [key, value] of Object.entries(settings || {})) {
            if (value !== null && value !== undefined && value !== '') {
                await pool.query(
                    'INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [req.company_id, key, String(value), String(value)]
                );
            }
        }
        if (Array.isArray(remove) && remove.length > 0) {
            for (const key of remove) {
                if (typeof key === 'string' && key.trim() !== '') {
                    await pool.query('DELETE FROM accounting_settings WHERE company_id = ? AND setting_key = ?', [req.company_id, key]);
                }
            }
        }
        res.json({ message: 'Configuración guardada' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const resolveAccountTypeId = (value, types) => {
    const raw = String(value ?? '').trim().replace(/^"|"$/g, '').trim();
    if (!raw) return null;
    const numeric = parseInt(raw, 10);
    if (!Number.isNaN(numeric) && types.some(t => t.id === numeric)) return numeric;
    const key = raw.toLowerCase();
    const found = types.find(t => String(t.code).toLowerCase() === key || String(t.name).toLowerCase() === key);
    return found ? found.id : null;
};

const validateAccounts = async (req, res) => {
    try {
        const { accounts } = req.body;
        if (!Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ message: 'No se recibieron cuentas para importar' });
        }

        const [existing] = await pool.query('SELECT id, code FROM chart_of_accounts WHERE company_id = ?', [req.company_id]);
        const codeToId = {};
        existing.forEach(a => { codeToId[a.code] = a.id; });

        const [types] = await pool.query('SELECT id, code, name FROM account_types');
        if (types.length === 0) {
            return res.status(400).json({ message: 'No hay tipos de cuenta configurados en el sistema. Configúralos antes de importar.' });
        }

        const seenCodes = new Set();
        const rows = [];
        let newCount = 0, updateCount = 0, errorCount = 0;

        accounts.forEach((row, index) => {
            const code = String(row.code || '').trim();
            const name = String(row.name || '').trim();
            const typeId = resolveAccountTypeId(row.account_type_id, types);
            const parentCode = String(row.parent_code || '').trim();
            const allows = row.allows_entries === '1' || row.allows_entries === 1 || row.allows_entries === true ? 1 : 0;

            const errorMessages = [];
            if (!code) errorMessages.push('El código es obligatorio');
            else if (code.length > 20) errorMessages.push('El código no puede superar 20 caracteres');
            if (!name) errorMessages.push('El nombre es obligatorio');
            if (!typeId) errorMessages.push(`Tipo de cuenta inválido: "${String(row.account_type_id ?? '').trim()}"`);
            if (code && seenCodes.has(code)) errorMessages.push('Código duplicado en el archivo');
            if (parentCode && !codeToId[parentCode] && !seenCodes.has(parentCode)) errorMessages.push(`La cuenta padre "${parentCode}" no existe`);

            if (code) seenCodes.add(code);

            const status = errorMessages.length > 0 ? 'error' : (codeToId[code] ? 'update' : 'new');
            if (status === 'error') errorCount++;
            else if (status === 'update') updateCount++;
            else newCount++;

            rows.push({
                index,
                code,
                name,
                account_type_id: typeId || null,
                parent_code: parentCode,
                allows_entries: allows,
                status,
                error: status === 'error' ? errorMessages.join('; ') : null
            });
        });

        res.json({ rows, totals: { total: accounts.length, new: newCount, updates: updateCount, errors: errorCount } });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const importAccounts = async (req, res) => {
    try {
        const { accounts } = req.body;
        if (!Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ message: 'No se recibieron cuentas para importar' });
        }

        let imported = 0, updated = 0, errors = 0;
        const codeToId = {};

        const [existing] = await pool.query('SELECT id, code FROM chart_of_accounts WHERE company_id = ?', [req.company_id]);
        existing.forEach(a => { codeToId[a.code] = a.id; });

        const [types] = await pool.query('SELECT id, code, name FROM account_types');

        for (const row of accounts) {
            try {
                const code = String(row.code || '').trim();
                const name = String(row.name || '').trim();
                const typeId = resolveAccountTypeId(row.account_type_id, types);
                const parentCode = String(row.parent_code || '').trim();
                const allows = row.allows_entries === '1' || row.allows_entries === 1 || row.allows_entries === true ? 1 : 0;

                if (!code || !name || !typeId) { errors++; continue; }

                const parentId = parentCode ? codeToId[parentCode] : null;

                if (codeToId[code]) {
                    await pool.query(
                        `UPDATE chart_of_accounts SET account_type_id = ?, parent_id = ?, name = ?, allows_entries = ? WHERE id = ? AND company_id = ?`,
                        [typeId, parentId || null, name, allows, codeToId[code], req.company_id]
                    );
                    updated++;
                } else {
                    const [r] = await pool.query(
                        `INSERT INTO chart_of_accounts (company_id, account_type_id, parent_id, code, name, allows_entries, active) 
                         VALUES (?, ?, ?, ?, ?, ?, 1)`,
                        [req.company_id, typeId, parentId || null, code, name, allows]
                    );
                    codeToId[code] = r.insertId;
                    imported++;
                }
            } catch (e) { errors++; }
        }

        res.json({ message: `Importadas: ${imported}, Actualizadas: ${updated}, Errores: ${errors}`, imported, updated, errors });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
    getAccountTypes, createAccountType, updateAccountType, deleteAccountType,
    getEntryTypes, createEntryType, updateEntryType, deleteEntryType,
    getAccounts, createAccount, updateAccount, deleteAccount,
    getEntries, getEntry, createEntry, updateEntry, voidEntry,
    getTrialBalance, performClosing, performOpening,
    getSettings, saveSettings, validateAccounts, importAccounts
};
