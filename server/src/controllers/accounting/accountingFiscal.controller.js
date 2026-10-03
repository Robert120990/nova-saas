const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { reserveEntryNumber } = require('../accounting.correlativos.controller');

// === Cierre Contable ===
const getTrialBalance = async (req, res) => {
    try {
        const { year } = req.query;
        const fiscalYear = year || new Date().getFullYear();
        const [rows] = await pool.query(`
            SELECT 
                a.id, a.code, a.name, t.name as type_name, t.nature,
                COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END), 0) as total_debit,
                COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END), 0) as total_credit,
                CASE WHEN t.nature = 'debit' 
                    THEN COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END), 0)
                    ELSE COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END), 0)
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
             JOIN accounting_entry_lines l ON a.id = l.account_id
             JOIN accounting_entries e ON l.entry_id = e.id
             WHERE a.company_id = ? AND a.account_type_id IN (4,5,6) AND a.active = 1 AND a.allows_entries = 1
               AND e.status = 'posted' AND e.date <= ?
             GROUP BY a.id
             HAVING balance != 0`,
            [companyId, date]
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
        const closingNumber = await reserveEntryNumber(conn, companyId, cierreType.id, date);

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
             JOIN accounting_entry_lines l ON a.id = l.account_id
             JOIN accounting_entries e ON l.entry_id = e.id
             WHERE a.company_id = ? AND a.account_type_id IN (1,2,3) AND a.active = 1 AND a.allows_entries = 1
               AND e.status = 'posted' AND e.date <= ?
             GROUP BY a.id
             HAVING balance != 0`,
            [companyId, date]
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
        const openingNumber = await reserveEntryNumber(conn, companyId, aperturaType.id, date);

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


module.exports = { getTrialBalance, performClosing, performOpening };
