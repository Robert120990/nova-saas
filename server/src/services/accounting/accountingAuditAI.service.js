const aiService = require('../ai.service');

/**
 * Servicio de Diagnóstico Contable Inteligente y Razonamiento Auditor (NIIF / Normativa SV)
 */

function calculateHealthScore(catalogAudit, entriesAudit) {
    let score = 100;

    const catErrors = catalogAudit.counts?.error || 0;
    const catWarnings = catalogAudit.counts?.warning || 0;
    const catInfo = catalogAudit.counts?.info || 0;

    const entErrors = entriesAudit.counts?.error || 0;
    const entWarnings = entriesAudit.counts?.warning || 0;
    const entInfo = entriesAudit.counts?.info || 0;

    // Ponderación de deducciones
    score -= (catErrors * 8);
    score -= (entErrors * 10);
    score -= (catWarnings * 3);
    score -= (entWarnings * 4);
    score -= (catInfo * 1);
    score -= (entInfo * 1);

    if (score < 0) score = 0;
    if (score > 100) score = 100;

    let opinion = 'Limpio / Favorable';
    let opinionColor = 'emerald';
    let opinionLevel = 'clean';

    if (score < 70 || entErrors > 0) {
        opinion = 'Adverso / Desfavorable';
        opinionColor = 'rose';
        opinionLevel = 'adverse';
    } else if (score < 90 || catErrors > 0 || entWarnings > 0) {
        opinion = 'Con Salvedades';
        opinionColor = 'amber';
        opinionLevel = 'qualified';
    }

    return {
        score: Math.round(score),
        opinion,
        opinionColor,
        opinionLevel,
        breakdown: {
            catalogErrors: catErrors,
            catalogWarnings: catWarnings,
            entryErrors: entErrors,
            entryWarnings: entWarnings
        }
    };
}

function generateDeterministicReport(catalogAudit, entriesAudit, health) {
    const findings = [];
    const recommendations = [];
    const suggestedAdjustments = [];

    // Hallazgos en catálogo
    if (catalogAudit.counts?.error > 0) {
        findings.push(`Se detectaron ${catalogAudit.counts.error} inconsistencias críticas en el catálogo de cuentas (códigos duplicados, cuentas huérfanas o cuentas de mayor con movimientos permitidos).`);
        recommendations.push('Revisar la jerarquía de cuentas para asegurar que ninguna cuenta de mayor admita asientos directos y corregir códigos repetidos.');
    }
    if (catalogAudit.counts?.warning > 0) {
        findings.push(`Existen ${catalogAudit.counts.warning} cuentas con advertencias en su naturaleza contable (débito/crédito) o cuentas de detalle sin uso.`);
    }

    // Hallazgos en partidas
    if (entriesAudit.overview?.unbalancedCount > 0) {
        findings.push(`Existen ${entriesAudit.overview.unbalancedCount} partidas descuadradas que vulneran el principio contable de partida doble.`);
        recommendations.push('Rebalancear de inmediato las partidas descuadradas para evitar distorsiones en el Balance de Comprobación y Estados Financieros.');
        suggestedAdjustments.push({
            title: 'Ajuste de Rebalanceo de Partidas Descuadradas',
            description: 'Identificar la contrapartida omitida (cuenta de gasto, banco o cuenta por pagar) y asentar la diferencia en la línea correspondiente.'
        });
    }

    if (entriesAudit.counts?.warning > 0) {
        findings.push(`Se observaron líneas con importes negativos o cuentas de disponibilidad con saldo acreedor (sobregiro/saldo rojo).`);
        recommendations.push('Eliminar registros con importes negativos trasladándolos al haber/debe según corresponda y verificar conciliaciones bancarias para regularizar saldos en rojo.');
        suggestedAdjustments.push({
            title: 'Reclasificación de Sobregiro Bancario',
            description: 'Si existe sobregiro real en bancos, reclasificar el saldo acreedor desde Efectivo y Equivalentes hacia Pasivo Corriente (Préstamos y Sobregiros Bancarios).'
        });
    }

    if (findings.length === 0) {
        findings.push('No se evidenciaron anomalías críticas ni advertencias en el catálogo de cuentas ni en las partidas evaluadas.');
        recommendations.push('Mantener las políticas de control interno y realizar arqueos y conciliaciones periódicas.');
    }

    return {
        healthScore: health.score,
        opinion: health.opinion,
        opinionLevel: health.opinionLevel,
        summary: `Auditoría contable completada. Estado general evaluado con una calificación de ${health.score}/100 y una opinión contable "${health.opinion}". ${
            health.opinionLevel === 'clean'
                ? 'Los registros contables cumplen satisfactoriamente con la normativa técnica y legal.'
                : 'Se requiere la aplicación de las acciones correctivas recomendadas para garantizar la razonabilidad de las cifras.'
        }`,
        findings,
        recommendations,
        niifCompliance: [
            'NIIF para las PYMES (Sección 2): Exige comprensibilidad, relevancia, fiabilidad y equilibrio entre costo y beneficio. Las partidas descuadradas comprometen la fiabilidad.',
            'NIIF para las PYMES (Sección 3): Presentación razonable y cumplimiento íntegro de hipótesis de negocio en marcha y devengo contable.'
        ],
        taxCompliance: [
            'Código Tributario de El Salvador (Arts. 139 - 142): Obligación de llevar contabilidad formal debidamente respaldada, en idioma castellano y moneda de curso legal (USD), sin tachaduras ni omisiones.',
            'Art. 141 C.T.: Los registros deben soportar fehacientemente las transacciones comerciales declaradas en IVA y Pago a Cuenta.'
        ],
        suggestedAdjustments,
        engine: 'deterministic'
    };
}

async function performAIAuditDiagnosis(companyId, catalogAudit, entriesAudit) {
    const health = calculateHealthScore(catalogAudit, entriesAudit);
    const deterministicReport = generateDeterministicReport(catalogAudit, entriesAudit, health);

    const promptContext = {
        score: health.score,
        opinion: health.opinion,
        catalogStats: {
            totalAccounts: catalogAudit.overview?.totalAccounts,
            errors: catalogAudit.counts?.error,
            warnings: catalogAudit.counts?.warning,
            sampleAnomalies: catalogAudit.anomalies?.slice(0, 5)
        },
        entriesStats: {
            totalEntries: entriesAudit.overview?.totalEntries,
            unbalanced: entriesAudit.overview?.unbalancedCount,
            drafts: entriesAudit.overview?.draftCount,
            errors: entriesAudit.counts?.error,
            warnings: entriesAudit.counts?.warning,
            sampleAnomalies: entriesAudit.anomalies?.slice(0, 5)
        }
    };

    const systemPrompt = `Eres un Contador Público Certificado (CPA) y Auditor Financiero de primer nivel en El Salvador, experto en NIIF para las PYMES y el Código Tributario salvadoreño.
Tu tarea es emitir un dictamen de auditoría contable y diagnóstico financiero conciso, riguroso y profesional basado en los datos proporcionados.
Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "summary": "Resumen ejecutivo del estado contable (máximo 3 párrafos)",
  "executiveDiagnosis": "Diagnóstico técnico profundo de la situación encontrada",
  "opinionReasoning": "Justificación fundamentada de por qué se otorga la opinión ${health.opinion}",
  "topRisks": ["Riesgo 1", "Riesgo 2", "Riesgo 3"],
  "actionPlan": ["Paso 1 prioritario", "Paso 2 prioritario", "Paso 3 prioritario"],
  "suggestedAdjustingEntries": [
    {
      "title": "Nombre del asiento de ajuste sugerido",
      "rationale": "Explicación contable",
      "debitAccount": "Cuenta al Debe sugerida",
      "creditAccount": "Cuenta al Haber sugerida"
    }
  ]
}`;

    try {
        const response = await aiService.getChatCompletion({
            messages: [{
                role: 'user',
                content: `Realiza el diagnóstico de auditoría contable para la empresa con estos hallazgos:\n${JSON.stringify(promptContext, null, 2)}`
            }],
            tools: [],
            systemPrompt
        });

        let content = response?.data?.content;
        if (content) {
            // Limpieza de bloques markdown ```json ... ``` si los hubiese
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(content);

            return {
                ...deterministicReport,
                summary: aiData.summary || deterministicReport.summary,
                executiveDiagnosis: aiData.executiveDiagnosis || '',
                opinionReasoning: aiData.opinionReasoning || '',
                topRisks: Array.isArray(aiData.topRisks) ? aiData.topRisks : [],
                actionPlan: Array.isArray(aiData.actionPlan) ? aiData.actionPlan : deterministicReport.recommendations,
                suggestedAdjustments: Array.isArray(aiData.suggestedAdjustingEntries) && aiData.suggestedAdjustingEntries.length > 0
                    ? aiData.suggestedAdjustingEntries.map(a => ({
                        title: a.title,
                        description: `${a.rationale} Debe: ${a.debitAccount} / Haber: ${a.creditAccount}`
                    }))
                    : deterministicReport.suggestedAdjustments,
                engine: response.provider || 'ai'
            };
        }
    } catch (err) {
        console.warn('[AccountingAuditAI] Fallback to deterministic diagnosis:', err.message);
    }

    return deterministicReport;
}

module.exports = {
    calculateHealthScore,
    performAIAuditDiagnosis
};
