const pool = require('../../config/db');
const { auditChartOfAccounts } = require('../../services/accounting/accountingAuditCatalog.service');
const { auditAccountingEntries, getEntryAuditDetail } = require('../../services/accounting/accountingAuditEntries.service');
const { calculateHealthScore, performAIAuditDiagnosis } = require('../../services/accounting/accountingAuditAI.service');
const { createExcelBuffer, sendExcelResponse } = require('../../services/excel.service');

/**
 * Resumen General y Puntuación de Salud Contable
 */
async function getAuditOverview(req, res) {
    try {
        const companyId = req.companyId;
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
        const companyId = req.companyId;
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
        const companyId = req.companyId;
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
        const companyId = req.companyId;
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
        const companyId = req.companyId;
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
        const companyId = req.companyId;
        const { accountId, action, value } = req.body;

        if (!accountId || !action) {
            return res.status(400).json({ success: false, message: 'Parámetros incompletos' });
        }

        const [existing] = await pool.query(
            'SELECT id, code, name, allows_entries, active, parent_id FROM chart_of_accounts WHERE id = ? AND company_id = ?',
            [accountId, companyId]
        );

        if (!existing.length) {
            return res.status(404).json({ success: false, message: 'Cuenta no encontrada' });
        }

        if (action === 'toggle_allows_entries') {
            const newValue = value !== undefined ? (value ? 1 : 0) : (existing[0].allows_entries ? 0 : 1);
            await pool.query(
                'UPDATE chart_of_accounts SET allows_entries = ? WHERE id = ? AND company_id = ?',
                [newValue, accountId, companyId]
            );
            return res.json({
                success: true,
                message: `Propiedad 'Permite Asientos' actualizada a ${newValue === 1 ? 'Sí' : 'No'}`
            });
        }

        if (action === 'toggle_active') {
            const newValue = value !== undefined ? (value ? 1 : 0) : (existing[0].active ? 0 : 1);
            await pool.query(
                'UPDATE chart_of_accounts SET active = ? WHERE id = ? AND company_id = ?',
                [newValue, accountId, companyId]
            );
            return res.json({
                success: true,
                message: `Estado de la cuenta actualizado a ${newValue === 1 ? 'Activa' : 'Inactiva'}`
            });
        }

        if (action === 'set_parent') {
            await pool.query(
                'UPDATE chart_of_accounts SET parent_id = ? WHERE id = ? AND company_id = ?',
                [value || null, accountId, companyId]
            );
            return res.json({
                success: true,
                message: 'Cuenta padre actualizada correctamente'
            });
        }

        res.status(400).json({ success: false, message: 'Acción no soportada' });
    } catch (error) {
        console.error('Error in quickFixAccount:', error);
        res.status(500).json({ success: false, message: 'Error al aplicar corrección rápida' });
    }
}

/**
 * Exportar Informe Completo de Auditoría a Excel
 */
async function exportAuditExcel(req, res) {
    try {
        const companyId = req.companyId;
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
            severidad: a.severity?.toUpperCase(),
            categoria: a.category,
            codigo: a.code || '',
            nombre: a.name || '',
            descripcion: a.description,
            recomendacion: a.recommendation
        }));

        const entriesData = (entriesAudit.anomalies || []).map(a => ({
            severidad: a.severity?.toUpperCase(),
            categoria: a.category,
            partida: a.entryNumber ? `#${a.entryNumber}` : '',
            fecha: a.entryDate ? String(a.entryDate).substring(0, 10) : '',
            cuenta: a.accountCode ? `${a.accountCode} - ${a.accountName || ''}` : '',
            descripcion: a.description,
            recomendacion: a.recommendation
        }));

        const sheets = [
            {
                name: 'Resumen Ejecutivo',
                columns: [
                    { header: 'Métrica / Indicador', key: 'metrica', width: 35 },
                    { header: 'Valor Evaluado', key: 'valor', width: 40 }
                ],
                data: summaryData
            },
            {
                name: 'Anomalías Catálogo',
                columns: [
                    { header: 'Severidad', key: 'severidad', width: 14 },
                    { header: 'Categoría', key: 'categoria', width: 25 },
                    { header: 'Código', key: 'codigo', width: 16 },
                    { header: 'Nombre de Cuenta', key: 'nombre', width: 35 },
                    { header: 'Hallazgo / Descripción', key: 'descripcion', width: 50 },
                    { header: 'Recomendación Técnica', key: 'recomendacion', width: 50 }
                ],
                data: catalogData
            },
            {
                name: 'Anomalías Partidas',
                columns: [
                    { header: 'Severidad', key: 'severidad', width: 14 },
                    { header: 'Categoría', key: 'categoria', width: 25 },
                    { header: 'Partida', key: 'partida', width: 12 },
                    { header: 'Fecha', key: 'fecha', width: 14 },
                    { header: 'Cuenta Afectada', key: 'cuenta', width: 30 },
                    { header: 'Hallazgo / Descripción', key: 'descripcion', width: 50 },
                    { header: 'Recomendación Técnica', key: 'recomendacion', width: 50 }
                ],
                data: entriesData
            }
        ];

        const buffer = await createExcelBuffer({
            sheets,
            title: 'INFORME DE AUDITORÍA CONTABLE Y CONTROL DE CALIDAD'
        });

        const filename = `Auditoria_Contable_${new Date().toISOString().slice(0, 10)}.xlsx`;
        sendExcelResponse(res, buffer, filename);
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
    exportAuditExcel
};
