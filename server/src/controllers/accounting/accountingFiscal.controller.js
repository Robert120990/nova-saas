const pool = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { reserveEntryNumber } = require('../accounting.correlativos.controller');
const { fiscalPeriod, getFiscalBalances, buildFiscalEntry } = require('../../services/accounting/accountingFiscal.service');

const getTrialBalance = async (req, res) => {
    try {
        if (['opening', 'closing'].includes(req.query.operation)) {
            return res.json(await getFiscalBalances(pool, req.company_id, req.query.operation, req.query.date));
        }
        const fiscalYear = req.query.year || new Date().getFullYear();
        const [rows] = await pool.query(`
            SELECT a.id, a.code, a.name, t.name as type_name, t.nature,
                COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END), 0) as total_debit,
                COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END), 0) as total_credit,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END), 0)
                    ELSE COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END), 0) END as balance
            FROM chart_of_accounts a JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id
                AND e.company_id = ? AND e.status = 'posted' AND YEAR(e.date) = ?
            WHERE a.company_id = ? AND a.active = 1 AND a.allows_entries = 1
            GROUP BY a.id, a.code, a.name, t.name, t.nature
            HAVING balance != 0 OR total_debit > 0 OR total_credit > 0 ORDER BY a.code`,
        [req.company_id, fiscalYear, req.company_id]);
        res.json(rows);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

async function performFiscalOperation(req, res, kind) {
    let connection, transactionStarted = false;
    try {
        const { date, description } = req.body;
        const period = fiscalPeriod(kind, date);
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;
        const [[company]] = await connection.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [req.company_id]);
        if (!company) throw new Error('Empresa no encontrada');
        const code = kind === 'opening' ? 'APERTURA' : 'CIERRE';
        const markerKey = `PARTIDA_${code}_${period.entryYear}`;
        const [[marker]] = await connection.query(
            'SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = ? FOR UPDATE',
            [req.company_id, markerKey]);
        if (marker?.setting_value) {
            const [[existing]] = await connection.query(
                'SELECT id, status FROM accounting_entries WHERE id = ? AND company_id = ? FOR UPDATE',
                [marker.setting_value, req.company_id]);
            if (existing && existing.status !== 'voided') {
                const conflict = new Error(`Ya existe una partida de ${kind === 'opening' ? 'apertura' : 'cierre'} generada para ${period.entryYear} (#${existing.id}). Anúlala antes de regenerar.`);
                conflict.statusCode = 409;
                throw conflict;
            }
        }
        // Las partidas anteriores a los marcadores también deben evitar duplicados.
        const [[legacy]] = await connection.query(`SELECT e.id FROM accounting_entries e
            JOIN entry_types t ON t.id = e.entry_type_id
            WHERE e.company_id = ? AND t.code = ? AND YEAR(e.date) = ? AND e.status != 'voided'
            ORDER BY e.id LIMIT 1 FOR UPDATE`, [req.company_id, code, period.entryYear]);
        if (legacy) {
            const conflict = new Error(`Ya existe una partida de ${kind === 'opening' ? 'apertura' : 'cierre'} para ${period.entryYear} (#${legacy.id}). Anúlala antes de regenerar.`);
            conflict.statusCode = 409;
            throw conflict;
        }
        // Evita que una edición o anulación altere los saldos entre lectura y guardado.
        await connection.query(`SELECT id FROM accounting_entries WHERE company_id = ? AND status = 'posted'
            AND YEAR(date) = ? AND date <= ? FOR UPDATE`, [req.company_id, period.sourceYear, period.cutoff]);
        const { lines, totalDebit, totalCredit } = await buildFiscalEntry(connection, req.company_id, kind, date);
        const [[entryType]] = await connection.query('SELECT id FROM entry_types WHERE code = ? LIMIT 1 LOCK IN SHARE MODE', [code]);
        if (!entryType) throw new Error(`No existe el tipo de partida ${code}`);
        const number = await reserveEntryNumber(connection, req.company_id, entryType.id, date);
        const [inserted] = await connection.query('INSERT INTO accounting_entries SET ?', [{
            company_id: req.company_id, entry_type_id: entryType.id, number, date,
            description: description || (kind === 'opening' ? 'Apertura del Ejercicio Contable' : 'Cierre del Ejercicio Contable'),
            total_debit: totalDebit, total_credit: totalCredit, status: 'posted', created_by: req.user?.id
        }]);
        for (const line of lines) await connection.query('INSERT INTO accounting_entry_lines SET ?', [{ entry_id: inserted.insertId, ...line }]);
        await connection.query(`INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [req.company_id, markerKey, String(inserted.insertId)]);
        await connection.commit();
        transactionStarted = false;
        Promise.resolve().then(() => notificationService.notify(kind === 'opening' ? 'accounting_opening_done' : 'accounting_closing_done',
            req.company_id, req.user?.branch_id, { periodo_contable: String(period.entryYear), fecha_cierre: date, usuario: req.user?.nombre || '' })).catch(() => {});
        res.json({ success: true, entry_id: inserted.insertId, lines: lines.length, total_debit: totalDebit, total_credit: totalCredit });
    } catch (error) {
        if (transactionStarted) await connection.rollback().catch(() => {});
        res.status(error.statusCode || 400).json({ message: error.message });
    } finally { if (connection) connection.release(); }
}

const performClosing = (req, res) => performFiscalOperation(req, res, 'closing');
const performOpening = (req, res) => performFiscalOperation(req, res, 'opening');
module.exports = { getTrialBalance, performClosing, performOpening };
