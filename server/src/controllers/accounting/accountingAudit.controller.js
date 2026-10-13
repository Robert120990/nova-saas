const pool = require('../../config/db');
const { auditChartOfAccounts } = require('../../services/accounting/accountingAuditCatalog.service');
const { auditAccountingEntries, getEntryAuditDetail } = require('../../services/accounting/accountingAuditEntries.service');
const { calculateHealthScore, performAIAuditDiagnosis } = require('../../services/accounting/accountingAuditAI.service');
const { createExcelBuffer, sendExcelResponse } = require('../../services/excel.service');

const getTenantCompanyId = (req) => {
    return req.company_id || req.companyId || req.user?.company_id || (req.headers['x-company-id'] ? parseInt(req.headers['x-company-id'], 10) : null);
};

/**
 * Resumen General y Puntuación de Salud Contable
 */
async function getAuditOverview(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Contexto de empresa no especificado' });
        }
        const catalogAudit = await auditChartOfAccounts(companyId);
        const entriesAudit = await auditAccountingEntries(companyId, req.query);
        const health = calculateHealthScore(catalogAudit, entriesAudit);

        res.json({
            success: true,
            data: {
                health,
                catalog: {
                    overview: catalogAudit.overview,
                    counts: catalogAudit.counts
                },
                entries: {
                    overview: entriesAudit.overview,
                    counts: entriesAudit.counts
                }
            }
        });
    } catch (error) {
        console.error('Error in getAuditOverview:', error);
        res.status(500).json({ success: false, message: 'Error al obtener el resumen de auditoría contable' });
    }
}

/**
 * Auditoría del Catálogo de Cuentas
 */
async function auditCatalog(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Contexto de empresa no especificado' });
        }
        const result = await auditChartOfAccounts(companyId);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in auditCatalog:', error);
        res.status(500).json({ success: false, message: 'Error al auditar el catálogo de cuentas' });
    }
}

/**
 * Auditoría de Partidas Contables
 */
async function auditEntries(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Contexto de empresa no especificado' });
        }
        const result = await auditAccountingEntries(companyId, req.query);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in auditEntries:', error);
        res.status(500).json({ success: false, message: 'Error al auditar partidas contables' });
    }
}

/**
 * Detalle de una Partida para Inspección Auditora
 */
async function getEntryDetail(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        const entryId = req.params.id;
        const entry = await getEntryAuditDetail(companyId, entryId);

        if (!entry) {
            return res.status(404).json({ success: false, message: 'Partida no encontrada' });
        }

        res.json({ success: true, data: entry });
    } catch (error) {
        console.error('Error in getEntryDetail:', error);
        res.status(500).json({ success: false, message: 'Error al obtener el detalle de la partida' });
    }
}

/**
 * Ejecutar Diagnóstico Contable Inteligente (IA / NIIF / Normativa SV)
 */
async function runAIDiagnosis(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Contexto de empresa no especificado' });
        }
        const catalogAudit = await auditChartOfAccounts(companyId);
        const entriesAudit = await auditAccountingEntries(companyId, req.query);

        const diagnostic = await performAIAuditDiagnosis(companyId, catalogAudit, entriesAudit);

        res.json({
            success: true,
            data: diagnostic
        });
    } catch (error) {
        console.error('Error in runAIDiagnosis:', error);
        res.status(500).json({ success: false, message: 'Error al ejecutar el diagnóstico inteligente' });
    }
}

/**
 * Corrección Rápida de Cuenta Contable (Quick Fix)
 */
async function quickFixAccount(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        const { accountId, action, value } = req.body;

        if (!accountId || !action) {
            return res.status(400).json({ success: false, message: 'Parámetros incompletos' });
        }

        let existing = [];
        if (companyId) {
            const [rows] = await pool.query(
                'SELECT id, code, name, allows_entries, active, parent_id, company_id FROM chart_of_accounts WHERE id = ? AND company_id = ?',
                [accountId, companyId]
            );
            existing = rows;
        }

        // Si no se encontró por companyId pero es SuperAdmin, buscar globalmente por ID de cuenta
        if (!existing.length && req.user?.role === 'SuperAdmin') {
            const [rows] = await pool.query(
                'SELECT id, code, name, allows_entries, active, parent_id, company_id FROM chart_of_accounts WHERE id = ?',
                [accountId]
            );
            existing = rows;
        }

        if (!existing.length) {
            return res.status(404).json({ success: false, message: 'Cuenta no encontrada en el catálogo' });
        }

        const account = existing[0];
        const targetCompanyId = account.company_id;

        if (action === 'toggle_allows_entries') {
            const newValue = value !== undefined ? (Number(value) ? 1 : 0) : (account.allows_entries ? 0 : 1);
            await pool.query(
                'UPDATE chart_of_accounts SET allows_entries = ? WHERE id = ? AND company_id = ?',
                [newValue, accountId, targetCompanyId]
            );
            return res.json({
                success: true,
                message: `Propiedad 'Permite Asientos' actualizada a ${newValue === 1 ? 'Sí' : 'No'}`
            });
        }

        if (action === 'toggle_active') {
            const newValue = value !== undefined ? (Number(value) ? 1 : 0) : (account.active ? 0 : 1);
            await pool.query(
                'UPDATE chart_of_accounts SET active = ? WHERE id = ? AND company_id = ?',
                [newValue, accountId, targetCompanyId]
            );
            return res.json({
                success: true,
                message: `Estado de la cuenta actualizado a ${newValue === 1 ? 'Activa' : 'Inactiva'}`
            });
        }

        if (action === 'set_parent') {
            await pool.query('UPDATE chart_of_accounts SET parent_id = ? WHERE id = ? AND company_id = ?', [value || null, accountId, targetCompanyId]);
            return res.json({ success: true, message: 'Cuenta padre actualizada correctamente' });
        }

        if (action === 'update_account' || action === 'edit_account') {
            const data = value || req.body.data || {};
            const fields = {};
            if (data.code !== undefined) fields.code = String(data.code).trim();
            if (data.name !== undefined) fields.name = String(data.name).trim();
            if (data.parent_id !== undefined) fields.parent_id = data.parent_id ? Number(data.parent_id) : null;
            if (data.allows_entries !== undefined) fields.allows_entries = Number(data.allows_entries) ? 1 : 0;
            if (data.active !== undefined) fields.active = Number(data.active) ? 1 : 0;

            if (Object.keys(fields).length > 0) {
                await pool.query('UPDATE chart_of_accounts SET ? WHERE id = ? AND company_id = ?', [fields, accountId, targetCompanyId]);
            }
            return res.json({ success: true, message: `Cuenta ${fields.code || account.code} actualizada con éxito` });
        }

        if (action === 'delete_account') {
            const [entries] = await pool.query('SELECT COUNT(*) as count FROM accounting_entry_lines WHERE account_id = ?', [accountId]);
            if (entries[0]?.count > 0) {
                return res.status(400).json({ success: false, message: `No se puede eliminar: tiene ${entries[0].count} movimientos registrados.` });
            }
            const [children] = await pool.query('SELECT COUNT(*) as count FROM chart_of_accounts WHERE parent_id = ? AND company_id = ?', [accountId, targetCompanyId]);
            if (children[0]?.count > 0) {
                return res.status(400).json({ success: false, message: `No se puede eliminar: tiene ${children[0].count} subcuentas dependientes.` });
            }
            await pool.query('DELETE FROM chart_of_accounts WHERE id = ? AND company_id = ?', [accountId, targetCompanyId]);
            return res.json({ success: true, message: `Cuenta ${account.code} eliminada del catálogo` });
        }

        res.status(400).json({ success: false, message: 'Acción no soportada' });
    } catch (error) {
        console.error('Error in quickFixAccount:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al aplicar corrección rápida' });
    }
}

/**
 * Corrección Rápida de Partida Contable (Quick Fix de Asientos)
 * Acción: 'sync_totals' (recalcula total_debit y total_credit de la cabecera a partir de las líneas reales)
 */
async function quickFixEntry(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        const { entryId, action } = req.body;

        if (!entryId) {
            return res.status(400).json({ success: false, message: 'ID de partida no especificado' });
        }

        let query = 'SELECT id, number, company_id, total_debit, total_credit, status FROM accounting_entries WHERE id = ?';
        const params = [entryId];
        if (companyId) {
            query += ' AND company_id = ?';
            params.push(companyId);
        }

        const [entries] = await pool.query(query, params);
        if (!entries.length) {
            return res.status(404).json({ success: false, message: 'Partida no encontrada' });
        }

        const entry = entries[0];
        const [sumRows] = await pool.query(`
            SELECT 
                COALESCE(SUM(debit), 0) as lines_debit,
                COALESCE(SUM(credit), 0) as lines_credit
            FROM accounting_entry_lines
            WHERE entry_id = ?
        `, [entry.id]);

        const sumData = sumRows[0] || { lines_debit: 0, lines_credit: 0 };
        const linesDebit = Number(sumData.lines_debit);
        const linesCredit = Number(sumData.lines_credit);

        if (action === 'sync_totals' || !action) {
            await pool.query(
                'UPDATE accounting_entries SET total_debit = ?, total_credit = ? WHERE id = ?',
                [linesDebit, linesCredit, entry.id]
            );

            return res.json({
                success: true,
                message: `Partida #${entry.number} sincronizada correctamente con sus líneas (Debe: $${linesDebit.toFixed(2)}, Haber: $${linesCredit.toFixed(2)})`
            });
        }

        res.status(400).json({ success: false, message: 'Acción no soportada' });
    } catch (error) {
        console.error('Error in quickFixEntry:', error);
        res.status(500).json({ success: false, message: error.message || 'Error al corregir partida contable' });
    }
}

/**
 * Exportar Informe Completo de Auditoría a Excel
 */
async function exportAuditExcel(req, res) {
    try {
        const companyId = getTenantCompanyId(req);
        if (!companyId) return res.status(400).json({ success: false, message: 'Contexto de empresa no especificado' });
        const catalogAudit = await auditChartOfAccounts(companyId);
        const entriesAudit = await auditAccountingEntries(companyId, req.query);
        const health = calculateHealthScore(catalogAudit, entriesAudit);

        const summaryData = [
            { metrica: 'Puntuación de Salud Contable', valor: `${health.score} / 100` },
            { metrica: 'Dictamen / Opinión Contable', valor: health.opinion },
            { metrica: 'Total Cuentas en Catálogo', valor: catalogAudit.overview?.totalAccounts || 0 },
            { metrica: 'Cuentas de Detalle (Permiten Asientos)', valor: catalogAudit.overview?.detailAccounts || 0 },
            { metrica: 'Anomalías Críticas en Catálogo', valor: catalogAudit.counts?.error || 0 },
            { metrica: 'Advertencias en Catálogo', valor: catalogAudit.counts?.warning || 0 },
            { metrica: 'Total Partidas Auditadas', valor: entriesAudit.overview?.totalEntries || 0 },
            { metrica: 'Partidas Descuadradas', valor: entriesAudit.overview?.unbalancedCount || 0 },
            { metrica: 'Partidas en Borrador', valor: entriesAudit.overview?.draftCount || 0 },
            { metrica: 'Inconsistencias en Partidas', valor: entriesAudit.counts?.error || 0 },
            { metrica: 'Advertencias en Partidas', valor: entriesAudit.counts?.warning || 0 }
        ];

        const catalogData = (catalogAudit.anomalies || []).map(a => ({
            severidad: a.severity?.toUpperCase(), categoria: a.category, codigo: a.code || '',
            nombre: a.name || '', descripcion: a.description, recomendacion: a.recommendation
        }));

        const entriesData = (entriesAudit.anomalies || []).map(a => ({
            severidad: a.severity?.toUpperCase(), categoria: a.category, partida: a.entryNumber ? `#${a.entryNumber}` : '',
            fecha: a.entryDate ? String(a.entryDate).substring(0, 10) : '', cuenta: a.accountCode ? `${a.accountCode} - ${a.accountName || ''}` : '',
            descripcion: a.description, recomendacion: a.recommendation
        }));

        const sheets = [
            { name: 'Resumen Ejecutivo', columns: [{ header: 'Métrica', key: 'metrica', width: 35 }, { header: 'Valor', key: 'valor', width: 40 }], data: summaryData },
            {
                name: 'Anomalías Catálogo',
                columns: [{ header: 'Severidad', key: 'severidad', width: 14 }, { header: 'Categoría', key: 'categoria', width: 25 }, { header: 'Código', key: 'codigo', width: 16 }, { header: 'Nombre', key: 'nombre', width: 35 }, { header: 'Hallazgo', key: 'descripcion', width: 45 }, { header: 'Recomendación', key: 'recomendacion', width: 45 }],
                data: catalogData
            },
            {
                name: 'Anomalías Partidas',
                columns: [{ header: 'Severidad', key: 'severidad', width: 14 }, { header: 'Categoría', key: 'categoria', width: 25 }, { header: 'Partida', key: 'partida', width: 12 }, { header: 'Fecha', key: 'fecha', width: 14 }, { header: 'Cuenta', key: 'cuenta', width: 30 }, { header: 'Hallazgo', key: 'descripcion', width: 45 }, { header: 'Recomendación', key: 'recomendacion', width: 45 }],
                data: entriesData
            }
        ];

        const buffer = await createExcelBuffer({ sheets, title: 'INFORME DE AUDITORÍA CONTABLE Y CONTROL DE CALIDAD' });
        sendExcelResponse(res, buffer, `Auditoria_Contable_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
        console.error('Error exporting audit excel:', error);
        res.status(500).json({ success: false, message: 'Error al exportar informe de auditoría a Excel' });
    }
}

module.exports = {
    getAuditOverview,
    auditCatalog,
    auditEntries,
    getEntryDetail,
    runAIDiagnosis,
    quickFixAccount,
    quickFixEntry,
    exportAuditExcel
};

