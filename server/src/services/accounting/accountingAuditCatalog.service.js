const pool = require('../../config/db');

/**
 * Servicio de Auditoría Integral del Catálogo de Cuentas Contables
 */
async function auditChartOfAccounts(companyId) {
    const [accounts] = await pool.query(`
        SELECT 
            a.id,
            a.code,
            a.name,
            a.description,
            a.allows_entries,
            a.active,
            a.account_type_id,
            a.parent_id,
            t.code as type_code,
            t.name as type_name,
            t.nature as type_nature,
            p.code as parent_code,
            p.name as parent_name,
            (SELECT COUNT(*) FROM chart_of_accounts c WHERE c.parent_id = a.id AND c.company_id = a.company_id) as children_count,
            (SELECT COUNT(*) FROM accounting_entry_lines l WHERE l.account_id = a.id) as entries_count
        FROM chart_of_accounts a
        LEFT JOIN account_types t ON a.account_type_id = t.id
        LEFT JOIN chart_of_accounts p ON a.parent_id = p.id
        WHERE a.company_id = ?
        ORDER BY a.code ASC
    `, [companyId]);

    const anomalies = [];
    const accountMap = new Map();
    const codeCounts = new Map();

    accounts.forEach(acc => {
        accountMap.set(acc.id, acc);
        const codeTrim = String(acc.code || '').trim();
        codeCounts.set(codeTrim, (codeCounts.get(codeTrim) || 0) + 1);
    });

    for (const acc of accounts) {
        const code = String(acc.code || '').trim();
        const name = String(acc.name || '').trim();
        const firstDigit = code.charAt(0);

        // 1. Códigos duplicados
        if (codeCounts.get(code) > 1) {
            anomalies.push({
                id: `dup-${acc.id}`,
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                severity: 'error',
                category: 'Duplicidad de Código',
                description: `El código contable ${code} se encuentra repetido en ${codeCounts.get(code)} cuentas del catálogo.`,
                recommendation: 'Modificar el código para garantizar la unicidad de cada cuenta.',
                fixType: 'edit_account'
            });
        }

        // 2. Nombres vacíos o marcadores provisionales
        const suspiciousWords = ['prueba', 'nueva', 'borrar', 'cuenta nueva', 'sin nombre', 'temp', 'eliminar', 'test'];
        const isSuspicious = suspiciousWords.some(w => name.toLowerCase().includes(w)) || name.length < 3;
        if (isSuspicious) {
            anomalies.push({
                id: `name-${acc.id}`,
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                severity: 'warning',
                category: 'Descripción Sospechosa',
                description: `La cuenta tiene un nombre ambiguo o temporal: "${name}".`,
                recommendation: 'Asignar una denominación técnica formal conforme a las NIIF / Catálogo oficial.',
                fixType: 'edit_account'
            });
        }

        // 3. Padre huérfano
        if (acc.parent_id && !accountMap.has(acc.parent_id)) {
            anomalies.push({
                id: `orphan-${acc.id}`,
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                severity: 'error',
                category: 'Jerarquía Rota (Padre Inexistente)',
                description: `La cuenta tiene asignado el parent_id ${acc.parent_id} pero no existe en el catálogo.`,
                recommendation: 'Reasignar la cuenta a su cuenta de mayor correspondiente o retirar el parent_id.',
                fixType: 'set_parent'
            });
        }

        // 4. Inconsistencia de prefijo respecto al padre
        if (acc.parent_id && accountMap.has(acc.parent_id)) {
            const parent = accountMap.get(acc.parent_id);
            const parentCode = String(parent.code || '').trim();
            if (!code.startsWith(parentCode)) {
                anomalies.push({
                    id: `prefix-${acc.id}`,
                    accountId: acc.id,
                    code: acc.code,
                    name: acc.name,
                    severity: 'warning',
                    category: 'Prefijo Jerárquico Desalineado',
                    description: `El código (${code}) no inicia con el código de su cuenta padre "${parent.name}" (${parentCode}).`,
                    recommendation: 'Alinear la estructura del código contable para preservar la jerarquía contable.',
                    fixType: 'edit_account'
                });
            }
        }

        // 5. Cuenta padre con movimientos directos permitidos (Mayor que recibe partidas)
        if (acc.children_count > 0 && acc.allows_entries) {
            anomalies.push({
                id: `parent-entries-${acc.id}`,
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                severity: 'error',
                category: 'Cuenta de Mayor con Asientos Permitidos',
                description: `La cuenta agrupa ${acc.children_count} subcuentas pero tiene "permite asientos directos" activo.`,
                recommendation: 'Desactivar "permite asientos" para que sea de acumulación pura y solo las cuentas de detalle reciban partidas.',
                fixType: 'disable_entries',
                autoFix: true
            });
        }

        // 6. Cuenta de detalle bloqueada sin hijos
        if (acc.children_count === 0 && !acc.allows_entries && acc.active) {
            anomalies.push({
                id: `leaf-blocked-${acc.id}`,
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                severity: 'info',
                category: 'Cuenta Terminal Bloqueada',
                description: 'La cuenta no tiene subcuentas hijas y tiene deshabilitado recibir asientos contables.',
                recommendation: 'Activar "permite asientos" si es una cuenta operativa de último nivel, o crear sus subcuentas.',
                fixType: 'enable_entries',
                autoFix: true
            });
        }

        // 7. Incoherencia de naturaleza contable respecto al grupo principal
        // 1=Activo (debe), 2=Pasivo (haber), 3=Patrimonio (haber), 4=Ingresos (haber), 5=Costos (debe), 6=Gastos (debe)
        const expectedNature = ['1', '5', '6'].includes(firstDigit) ? 'debit' : (['2', '3', '4'].includes(firstDigit) ? 'credit' : null);
        if (expectedNature && acc.type_nature && acc.type_nature !== expectedNature) {
            // Excepción técnica contable: Cuentas complementarias de activo (depreciación acumulada, estimación cuentas incobrables)
            const isContraAsset = firstDigit === '1' && (name.toLowerCase().includes('depreciaci') || name.toLowerCase().includes('estimaci') || name.toLowerCase().includes('acumulada') || name.toLowerCase().includes('amortizaci'));
            const isContraEquity = firstDigit === '3' && (name.toLowerCase().includes('pérdida') || name.toLowerCase().includes('perdida') || name.toLowerCase().includes('déficit'));

            if (!isContraAsset && !isContraEquity) {
                anomalies.push({
                    id: `nature-${acc.id}`,
                    accountId: acc.id,
                    code: acc.code,
                    name: acc.name,
                    severity: 'warning',
                    category: 'Naturaleza Inconsistente',
                    description: `La cuenta pertenece al rubro ${acc.type_name || firstDigit} pero tiene naturaleza ${acc.type_nature === 'debit' ? 'Deudora' : 'Acreedora'} (esperado: ${expectedNature === 'debit' ? 'Deudora' : 'Acreedora'}).`,
                    recommendation: 'Verificar el tipo de cuenta asignado para garantizar el cálculo correcto en balances.',
                    fixType: 'edit_account'
                });
            }
        }

        // 8. Cuenta inactiva con movimientos registrados
        if (!acc.active && acc.entries_count > 0) {
            anomalies.push({
                id: `inactive-entries-${acc.id}`,
                accountId: acc.id,
                code: acc.code,
                name: acc.name,
                severity: 'info',
                category: 'Cuenta Inactiva con Historial',
                description: `La cuenta está desactivada pero posee ${acc.entries_count} movimientos históricos.`,
                recommendation: 'Mantener inactiva para evitar nuevos registros, pero considerar si debe ser archivada formalmente.',
                fixType: 'view_entries'
            });
        }
    }

    const counts = {
        error: anomalies.filter(a => a.severity === 'error').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        info: anomalies.filter(a => a.severity === 'info').length
    };

    const overview = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.active).length,
        detailAccounts: accounts.filter(a => a.allows_entries).length,
        parentAccounts: accounts.filter(a => a.children_count > 0).length,
        totalAnomalies: anomalies.length
    };

    const summary = {
        ...overview,
        errors: counts.error,
        warnings: counts.warning,
        infos: counts.info,
        healthScore: Math.max(0, Math.min(100, Math.round(100 - (counts.error * 8) - (counts.warning * 3))))
    };

    return { overview, counts, summary, anomalies };
}

module.exports = {
    auditChartOfAccounts
};
