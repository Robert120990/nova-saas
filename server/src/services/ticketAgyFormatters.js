const path = require('path');
const { sanitizeConsoleText } = require('./ticketAgyConsole.service');

function escapeMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`[\]])/g, '');
}

/**
 * Convierte el plan generado por AGY en un resumen conciso, estructurado y en lenguaje humano.
 * Evita volcados de código extensos o listas redundantes de archivos.
 */
function humanizeAndFormatAgyPlan(ticket, rawPlan) {
    const subject = ticket?.subject || 'Ajuste solicitado';
    const moduleName = ticket?.module_name || 'General';

    if (!rawPlan) {
        return (
            `🧐 *Diagnóstico:*\n` +
            `Se analizó el reporte en *${escapeMd(moduleName)}* (${escapeMd(subject)}).\n\n` +
            `💡 *Solución propuesta:*\n` +
            `1. Ajustar la consulta y filtros en pantalla para que la información solicitada se muestre correctamente.\n` +
            `2. Validar que la interfaz y las acciones respondan sin errores.\n` +
            `3. Compilar los cambios y publicar la actualización en vivo.`
        );
    }

    let text = sanitizeConsoleText(String(rawPlan))
        .replace('[[REQUIERE_DECISION_AGY]]', '')
        .replace(/```[\s\S]*?```/g, '') // Elimina bloques de código
        .trim();

    // Eliminar encabezados repetitivos de markdown
    text = text.replace(/^#{1,4}\s*/gm, '');

    // Homogeneizar títulos para un tono humano y visual
    text = text
        .replace(/Diagnóstico de Causa Raíz[^:\n]*/gi, '🧐 *Diagnóstico:*')
        .replace(/Archivos (?:Detectados|a Intervenir)[^:\n]*/gi, '📂 *Componentes involucrados:*')
        .replace(/Pasos del Plan de Ejecución[^:\n]*/gi, '💡 *Solución propuesta:*')
        .replace(/Pasos Exactos de Código[^:\n]*/gi, '💡 *Solución propuesta:*');

    // Remover líneas técnicas redundantes
    text = text
        .replace(/- \*\*Proyecto Objetivo:\*\* [^\n]+/g, '')
        .replace(/- \*\*Entorno:\*\* [^\n]+/g, '')
        .replace(/- \*\*Telemetría automática:\*\* [^\n]+/g, '')
        .replace(/- \*\*Módulo y Ruta reportada:\*\* [^\n]+/g, '')
        .replace(/- \*\*Problema reportado:\*\* [^\n]+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // Limitar longitud para lectura cómoda en dispositivos móviles
    if (text.length > 1500) {
        const cut = text.lastIndexOf('\n', 1450);
        text = (cut > 400 ? text.slice(0, cut) : text.slice(0, 1450)) + '\n\n_(Plan resumido para Telegram)_';
    }

    return text;
}

/**
 * Convierte el resultado final de ejecución en un mensaje resumido y en lenguaje humano.
 */
function formatAgyExecutionResultForTelegram(ticket, summaryText, approvedBy) {
    const isFromAdmin = String(ticket?.source_system || '').toLowerCase().includes('admin.sipesv.com') ||
        String(ticket?.ticket_code || '').toUpperCase().startsWith('ADM-');
    const projectTag = isFromAdmin ? 'admin.sipesv.com (SIPE Admin)' : 'sys.sipesv.com (SIPE SaaS)';
    const moduleName = ticket?.module_name || 'General';
    const subject = ticket?.subject || 'Ajuste solicitado';

    const clean = sanitizeConsoleText(String(summaryText || ''));

    // Detectar si hay componentes o archivos tocados
    let componentsLine = '';
    const fileMatch = clean.match(/(?:Archivos modificados|Componentes actualizados):\s*([^\n]+)/i);
    if (fileMatch) {
        const shortFiles = fileMatch[1]
            .split(',')
            .map((f) => path.basename(f.trim()))
            .filter((f) => f && f.length > 1)
            .slice(0, 4)
            .join(', ');
        if (shortFiles) {
            componentsLine = `📦 *Componentes actualizados:* \`${shortFiles}\`\n`;
        }
    }

    // Filtrar líneas de build o git para dejar únicamente la explicación humana
    let customSummary = '';
    const lines = clean.split('\n')
        .map((l) => l.trim())
        .filter((l) => l &&
            !l.startsWith('• Compilación:') &&
            !l.startsWith('• Git Sync:') &&
            !l.startsWith('===') &&
            !l.includes('vite v') &&
            !l.includes('building for production') &&
            !l.includes('transforming ('));

    if (lines.length > 0 && !lines[0].startsWith('✅ Plan v')) {
        customSummary = `✨ ${escapeMd(lines[0].slice(0, 200))}\n`;
    } else {
        customSummary = `✨ Se aplicaron las correcciones requeridas para que *${escapeMd(subject)}* funcione correctamente.\n`;
    }

    return (
        `✅ *TAREA FINALIZADA CON ÉXITO — #${escapeMd(ticket.ticket_code)}*\n\n` +
        `📌 *Asunto:* ${escapeMd(subject)}\n` +
        `🏢 *Módulo:* ${escapeMd(moduleName)} (\`${escapeMd(projectTag)}\`)\n` +
        `👤 *Aprobado por:* ${escapeMd(approvedBy)}\n\n` +
        `📋 *Resumen de la Solución:*\n` +
        customSummary +
        componentsLine +
        `🚀 *Estado del sistema:* Cambios compilados y desplegados en vivo sin errores.\n\n` +
        `🎉 _El ticket quedó marcado automáticamente como *RESUELTO* y el solicitante ya puede verificar la solución en el sistema._`
    );
}

module.exports = {
    escapeMd,
    humanizeAndFormatAgyPlan,
    formatAgyExecutionResultForTelegram
};
