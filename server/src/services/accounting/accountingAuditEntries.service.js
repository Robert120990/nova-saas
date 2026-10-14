const pool = require('../../config/db');

/**
 * Servicio de Auditoría de Partidas Contables (Journal Entries Audit)
 * Inspecciona integridad transaccional, partida doble, saldos y cuentas aplicadas.
 */
async function auditAccountingEntries(companyId, filters = {}) {
    const { startDate, endDate, branchId, entryTypeId, status } = filters;

    const baseConditions = ['e.company_id = ?'];
    const baseParams = [companyId];

    if (startDate) {
        baseConditions.push('e.date >= ?');
        baseParams.push(startDate);
    }
    if (endDate) {
        baseConditions.push('e.date <= ?');
        baseParams.push(endDate);
    }
    if (branchId) {
        baseConditions.push('e.branch_id = ?');
        baseParams.push(branchId);
    }
    if (entryTypeId) {
        baseConditions.push('e.entry_type_id = ?');
        baseParams.push(entryTypeId);
    }
    if (status) {
        baseConditions.push('e.status = ?');
        baseParams.push(status);
    }

    const whereClause = baseConditions.join(' AND ');

    // 1. Estadísticas generales
    const [overviewRows] = await pool.query(`
        SELECT 
            COUNT(e.id) as total_entries,
            COALESCE(SUM(e.total_debit), 0) as total_debit_sum,
            COALESCE(SUM(e.total_credit), 0) as total_credit_sum,
            SUM(CASE WHEN e.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
            SUM(CASE WHEN e.status = 'posted' THEN 1 ELSE 0 END) as posted_count,
            SUM(CASE WHEN e.status = 'voided' THEN 1 ELSE 0 END) as voided_count,
            SUM(CASE WHEN ROUND(ABS(e.total_debit - e.total_credit), 2) > 0.00 THEN 1 ELSE 0 END) as unbalanced_header_count
        FROM accounting_entries e
        WHERE ${whereClause}
    `, baseParams);

    const overview = overviewRows[0] || {};
    const anomalies = [];

    // 2. Partidas Descuadradas (Diferencia de Partida Doble en líneas o en cabecera)
    const [unbalancedEntries] = await pool.query(`
        SELECT 
            e.id, e.number, e.date, e.description, e.status, e.total_debit, e.total_credit,
            b.nombre as branch_name, t.name as entry_type_name,
            COALESCE(SUM(l.debit), 0) as lines_debit,
            COALESCE(SUM(l.credit), 0) as lines_credit,
            ROUND(ABS(COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)), 2) as lines_diff,
            ROUND(ABS(e.total_debit - e.total_credit), 2) as header_diff
        FROM accounting_entries e
        LEFT JOIN accounting_entry_lines l ON e.id = l.entry_id
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN entry_types t ON e.entry_type_id = t.id
        WHERE ${whereClause} AND e.status != 'voided'
        GROUP BY e.id, e.number, e.date, e.description, e.status, e.total_debit, e.total_credit, b.nombre, t.name
        HAVING lines_diff > 0.00 OR header_diff > 0.00
        ORDER BY GREATEST(lines_diff, header_diff) DESC, e.date DESC
        LIMIT 100
    `, baseParams);

    const processedEntryIds = new Set();
    unbalancedEntries.forEach(entry => {
        processedEntryIds.add(entry.id);
        const maxDiff = Math.max(Number(entry.lines_diff), Number(entry.header_diff));
        anomalies.push({
            id: `unbalanced-${entry.id}`,
            entryId: entry.id,
            entryNumber: entry.number,
            entryDate: entry.date,
            branchName: entry.branch_name,
            entryTypeName: entry.entry_type_name,
            status: entry.status,
            severity: 'error',
            category: 'Descuadre en Partida Doble',
            description: `La partida #${entry.number} presenta un descuadre de $${maxDiff.toFixed(2)} (Líneas Debe: $${Number(entry.lines_debit).toFixed(2)}, Líneas Haber: $${Number(entry.lines_credit).toFixed(2)}).`,
            recommendation: 'Revisar las líneas de la partida y rebalancear debe y haber para cumplir la partida doble.',
            fixType: 'edit_entry'
        });
    });

    // 3. Inconsistencia entre Cabecera y Suma Real de Líneas
    const [lineSumMismatch] = await pool.query(`
        SELECT 
            e.id, e.number, e.date, e.status, e.total_debit, e.total_credit,
            b.nombre as branch_name, t.name as entry_type_name,
            COALESCE(SUM(l.debit), 0) as lines_debit,
            COALESCE(SUM(l.credit), 0) as lines_credit,
            ROUND(ABS(e.total_debit - COALESCE(SUM(l.debit), 0)), 2) as debit_diff,
            ROUND(ABS(e.total_credit - COALESCE(SUM(l.credit), 0)), 2) as credit_diff
        FROM accounting_entries e
        LEFT JOIN accounting_entry_lines l ON e.id = l.entry_id
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN entry_types t ON e.entry_type_id = t.id
        WHERE ${whereClause} AND e.status != 'voided'
        GROUP BY e.id, e.number, e.date, e.status, e.total_debit, e.total_credit, b.nombre, t.name
        HAVING debit_diff > 0.00 OR credit_diff > 0.00
        ORDER BY (debit_diff + credit_diff) DESC
        LIMIT 100
    `, baseParams);

    lineSumMismatch.forEach(entry => {
        if (processedEntryIds.has(entry.id)) return;
        anomalies.push({
            id: `line-mismatch-${entry.id}`,
            entryId: entry.id,
            entryNumber: entry.number,
            entryDate: entry.date,
            branchName: entry.branch_name,
            entryTypeName: entry.entry_type_name,
            status: entry.status,
            severity: 'error',
            category: 'Desincronización Cabecera-Líneas',
            description: `Partida #${entry.number}: La suma de líneas (Debe: $${Number(entry.lines_debit).toFixed(2)}, Haber: $${Number(entry.lines_credit).toFixed(2)}) no coincide con los totales de cabecera (Debe: $${Number(entry.total_debit).toFixed(2)}, Haber: $${Number(entry.total_credit).toFixed(2)}).`,
            recommendation: 'Recalcular los totales de la partida o verificar posibles líneas huérfanas/eliminadas.',
            fixType: 'recalculate_entry'
        });
    });

    // 4. Partidas con Menos de 2 Líneas (Monopartidas o Vacías)
    const [incompleteEntries] = await pool.query(`
        SELECT 
            e.id, e.number, e.date, e.status, e.total_debit, e.total_credit,
            b.nombre as branch_name, t.name as entry_type_name,
            COUNT(l.id) as line_count
        FROM accounting_entries e
        LEFT JOIN accounting_entry_lines l ON e.id = l.entry_id
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN entry_types t ON e.entry_type_id = t.id
        WHERE ${whereClause} AND e.status != 'voided'
        GROUP BY e.id, e.number, e.date, e.status, e.total_debit, e.total_credit, b.nombre, t.name
        HAVING line_count < 2
        ORDER BY e.date DESC
        LIMIT 100
    `, baseParams);

    incompleteEntries.forEach(entry => {
        anomalies.push({
            id: `incomplete-${entry.id}`,
            entryId: entry.id,
            entryNumber: entry.number,
            entryDate: entry.date,
            branchName: entry.branch_name,
            entryTypeName: entry.entry_type_name,
            status: entry.status,
            severity: 'error',
            category: 'Partida Incompleta',
            description: `Partida #${entry.number} posee solo ${entry.line_count} línea(s). El principio de partida doble exige al menos dos cuentas afectadas.`,
            recommendation: 'Completar los asientos de contrapartida o anular el registro si fue un error.',
            fixType: 'edit_entry'
        });
    });

    // 5. Líneas con Montos Negativos
    const [negativeLines] = await pool.query(`
        SELECT 
            l.id as line_id, l.entry_id, l.debit, l.credit, l.description as line_desc,
            e.number as entry_number, e.date as entry_date, e.status,
            a.code as account_code, a.name as account_name
        FROM accounting_entry_lines l
        JOIN accounting_entries e ON l.entry_id = e.id
        LEFT JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE ${whereClause} AND (l.debit < 0 OR l.credit < 0)
        ORDER BY e.date DESC
        LIMIT 100
    `, baseParams);

    negativeLines.forEach(line => {
        anomalies.push({
            id: `neg-line-${line.line_id}`,
            entryId: line.entry_id,
            entryNumber: line.entry_number,
            entryDate: line.entry_date,
            accountCode: line.account_code,
            accountName: line.account_name,
            status: line.status,
            severity: 'warning',
            category: 'Importe Negativo en Línea',
            description: `Partida #${line.entry_number}, cuenta ${line.account_code || 'N/A'}: Registro con saldo negativo (Debe: ${line.debit}, Haber: ${line.credit}).`,
            recommendation: 'En contabilidad estándar no deben usarse importes negativos. Use la columna opuesta o una cuenta correctora.',
            fixType: 'edit_entry'
        });
    });

    // 6. Uso de Cuentas Inactivas o Cuentas de Mayor (allows_entries = 0)
    const [invalidAccountLines] = await pool.query(`
        SELECT 
            l.id as line_id, l.entry_id, l.debit, l.credit,
            e.number as entry_number, e.date as entry_date, e.status,
            a.id as account_id, a.code as account_code, a.name as account_name,
            a.allows_entries, a.active
        FROM accounting_entry_lines l
        JOIN accounting_entries e ON l.entry_id = e.id
        JOIN chart_of_accounts a ON l.account_id = a.id
        WHERE ${whereClause} AND (a.active = 0 OR a.allows_entries = 0)
        ORDER BY e.date DESC
        LIMIT 100
    `, baseParams);

    invalidAccountLines.forEach(line => {
        const isInactive = line.active === 0;
        anomalies.push({
            id: `invalid-acc-line-${line.line_id}`,
            entryId: line.entry_id,
            entryNumber: line.entry_number,
            entryDate: line.entry_date,
            accountCode: line.account_code,
            accountName: line.account_name,
            status: line.status,
            severity: isInactive ? 'warning' : 'error',
            category: isInactive ? 'Cuenta Inactiva Utilizada' : 'Cuenta de Mayor Utilizada',
            description: isInactive
                ? `Partida #${line.entry_number} imputa a la cuenta ${line.account_code} (${line.account_name}) que está inactiva.`
                : `Partida #${line.entry_number} imputa a la cuenta agrupadora/de mayor ${line.account_code} (${line.account_name}), la cual no permite movimientos directos.`,
            recommendation: isInactive
                ? 'Reclasificar el movimiento a una cuenta activa o reactivar la cuenta si corresponde.'
                : 'Reclasificar el movimiento a la subcuenta o cuenta auxiliar correspondiente.',
            fixType: 'reclassify_line'
        });
    });

    // 7. Partidas en Borrador con Rezago (> 30 días de antigüedad)
    const [staleDrafts] = await pool.query(`
        SELECT 
            e.id, e.number, e.date, e.description, e.total_debit, e.total_credit,
            b.nombre as branch_name, t.name as entry_type_name,
            DATEDIFF(CURDATE(), e.date) as days_old
        FROM accounting_entries e
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN entry_types t ON e.entry_type_id = t.id
        WHERE ${whereClause} AND e.status = 'draft' AND e.date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ORDER BY e.date ASC
        LIMIT 100
    `, baseParams);

    staleDrafts.forEach(entry => {
        anomalies.push({
            id: `stale-draft-${entry.id}`,
            entryId: entry.id,
            entryNumber: entry.number,
            entryDate: entry.date,
            branchName: entry.branch_name,
            entryTypeName: entry.entry_type_name,
            status: 'draft',
            severity: 'info',
            category: 'Partida en Borrador Rezagada',
            description: `La partida en borrador #${entry.number} tiene ${entry.days_old} días sin asentar ni anular.`,
            recommendation: 'Revisar y asentar (postear) la partida si es válida o anularla para evitar distorsiones en los cierres.',
            fixType: 'review_status'
        });
    });

    // 8. Cuentas de Efectivo / Bancos con Saldos Invertidos (Acreedores)
    const [invertedCashAccounts] = await pool.query(`
        SELECT 
            a.id, a.code, a.name,
            ROUND(SUM(l.debit), 2) as total_debit,
            ROUND(SUM(l.credit), 2) as total_credit,
            ROUND(SUM(l.debit) - SUM(l.credit), 2) as net_balance
        FROM chart_of_accounts a
        JOIN accounting_entry_lines l ON a.id = l.account_id
        JOIN accounting_entries e ON l.entry_id = e.id
        WHERE ${whereClause} AND e.status = 'posted' AND (a.code LIKE '1101%' OR a.code LIKE '1102%')
        GROUP BY a.id, a.code, a.name
        HAVING net_balance < -0.01
        ORDER BY net_balance ASC
        LIMIT 20
    `, baseParams);

    invertedCashAccounts.forEach(acc => {
        anomalies.push({
            id: `cash-overdraft-${acc.id}`,
            accountId: acc.id,
            code: acc.code,
            name: acc.name,
            severity: 'warning',
            category: 'Saldo Acreedor en Efectivo/Bancos',
            description: `La cuenta de disponibilidad ${acc.code} (${acc.name}) presenta saldo neto acreedor de $${Number(Math.abs(acc.net_balance)).toFixed(2)} (saldo rojo / sobregiro).`,
            recommendation: 'Verificar si existen depósitos o cobros pendientes de registrar o registrar el sobregiro bancario como pasivo.',
            fixType: 'review_cash'
        });
    });

    // Conteo de anomalías por severidad
    const severityCounts = {
        error: anomalies.filter(a => a.severity === 'error').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        info: anomalies.filter(a => a.severity === 'info').length
    };

    return {
        overview: {
            totalEntries: Number(overview.total_entries || 0),
            totalDebit: Number(overview.total_debit_sum || 0),
            totalCredit: Number(overview.total_credit_sum || 0),
            draftCount: Number(overview.draft_count || 0),
            postedCount: Number(overview.posted_count || 0),
            voidedCount: Number(overview.voided_count || 0),
            unbalancedCount: severityCounts.error
        },
        counts: severityCounts,
        totalAnomalies: anomalies.length,
        anomalies
    };
}

/**
 * Obtener detalle completo de una partida para auditoría en modal
 */
async function getEntryAuditDetail(companyId, entryId) {
    const whereSql = companyId ? 'WHERE e.company_id = ? AND (e.id = ? OR e.number = ?)' : 'WHERE (e.id = ? OR e.number = ?)';
    const params = companyId ? [companyId, entryId, entryId] : [entryId, entryId];

    const [entries] = await pool.query(`
        SELECT 
            e.id, e.company_id, e.branch_id, e.entry_type_id, e.number, e.date,
            e.description, e.status, e.total_debit, e.total_credit, e.created_at,
            b.nombre as branch_name, t.name as entry_type_name,
            COALESCE(u.nombre, u.username) as creator_name
        FROM accounting_entries e
        LEFT JOIN branches b ON e.branch_id = b.id
        LEFT JOIN entry_types t ON e.entry_type_id = t.id
        LEFT JOIN users u ON e.created_by = u.id
        ${whereSql}
        LIMIT 1
    `, params);

    if (!entries.length) return null;

    const entry = entries[0];
    const [lines] = await pool.query(`
        SELECT 
            l.id, l.account_id, l.description, l.debit, l.credit,
            a.code as account_code, a.name as account_name,
            a.allows_entries, a.active,
            t.nature as account_nature
        FROM accounting_entry_lines l
        LEFT JOIN chart_of_accounts a ON l.account_id = a.id
        LEFT JOIN account_types t ON a.account_type_id = t.id
        WHERE l.entry_id = ?
        ORDER BY l.id ASC
    `, [entry.id]);

    return {
        ...entry,
        lines: lines.map(line => ({
            ...line,
            isInvalidAccount: line.active === 0 || line.allows_entries === 0,
            isNegative: line.debit < 0 || line.credit < 0
        }))
    };
}

module.exports = {
    auditAccountingEntries,
    getEntryAuditDetail
};
