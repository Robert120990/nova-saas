const PLATFORM_META = {
    antigravity: {
        id: 'antigravity',
        name: 'Google Antigravity IDE',
        icon: '🚀',
        headerNote: 'Prompt optimizado para Google Antigravity IDE. Lee el contexto de AGENTS.md, inspecciona los archivos involucrados, aplica los cambios y verifica con ESLint/Build.'
    },
    cursor: {
        id: 'cursor',
        name: 'Cursor / Windsurf IDE',
        icon: '🖱️',
        headerNote: 'Prompt optimizado para Cursor Composer / Windsurf Cascade. Analiza los logs adjuntos y aplica el refactor respetando las reglas del repositorio.'
    },
    claude_code: {
        id: 'claude_code',
        name: 'Claude Code / Codex CLI',
        icon: '🧠',
        headerNote: 'Prompt optimizado para agentes de terminal (Claude Code / OpenAI Codex). Ejecuta diagnóstico sobre las trazas y aplica la corrección atómica.'
    },
    universal: {
        id: 'universal',
        name: 'Agente IA Universal (Markdown)',
        icon: '🤖',
        headerNote: 'Paquete estándar en Markdown con contexto técnico, logs de consola/servidor y criterios de aceptación.'
    }
};

function getPlatformMeta(platform) {
    return PLATFORM_META[platform] || PLATFORM_META.antigravity;
}

function buildTaskExternalPrompt({
    id,
    title,
    prompt,
    priority = 'media',
    agentPlatform = 'antigravity',
    customLogs = '',
    pageUrl = '',
    moduleName = '',
    screenshotUrl = '',
    diagnostics = null,
    aiNotes = ''
}) {
    const plat = getPlatformMeta(agentPlatform);
    const lines = [
        `# ${plat.icon} PAQUETE DE RESOLUCIÓN PARA ${plat.name.toUpperCase()}`,
        `> **Modo de Ejecución:** Modo 2 — Prompt + Logs para Plataforma de Agente Externo (\`${plat.id}\`)`,
        `> **Directriz de Plataforma:** ${plat.headerNote}`,
        '',
        `## 📌 1. Objetivo / Requerimiento (#${id || 'N/A'} — ${title})`,
        `- **Prioridad:** \`${priority}\``,
        moduleName || pageUrl ? `- **Módulo / Ruta:** ${moduleName || 'General'} (\`${pageUrl || '/'}\`)` : null,
        '',
        '### 📝 Descripción / Instrucción Principal',
        String(prompt || title || '').trim(),
        ''
    ].filter((l) => l !== null);

    if (aiNotes && String(aiNotes).trim()) {
        lines.push('### 🎯 Directriz Técnica Adicional');
        lines.push(String(aiNotes).trim());
        lines.push('');
    }

    if (screenshotUrl) {
        const cleanRel = String(screenshotUrl).replace(/^\/+/, '').replace(/^api\/+/, '');
        lines.push('### 🖼️ Captura de Pantalla Adjunta (WebP)');
        lines.push(`- Archivo local en repositorio: \`server/${cleanRel}\``);
        lines.push('');
    }

    if (customLogs && String(customLogs).trim()) {
        lines.push('## 📋 2. Logs Cargados por el Usuario (Consola / Servidor / Stack Trace)');
        lines.push('```log');
        lines.push(String(customLogs).trim().slice(0, 15000));
        lines.push('```');
        lines.push('');
    }

    if (diagnostics && ((diagnostics.networkFailures?.length || 0) > 0 || (diagnostics.consoleErrors?.length || 0) > 0)) {
        lines.push(`## 🚨 3. Telemetría Automática del Explorador (Correlación: ${(diagnostics.relevance || 'N/A').toUpperCase()} - ${diagnostics.score || 0}%)`);
        if (diagnostics.explanation) {
            lines.push(`- **Veredicto:** ${diagnostics.explanation}`);
        }
        if (Array.isArray(diagnostics.networkFailures) && diagnostics.networkFailures.length > 0) {
            lines.push('- **Peticiones HTTP/API Fallidas:**');
            diagnostics.networkFailures.slice(0, 8).forEach((n) => {
                lines.push(`  - \`${n.method} ${n.url}\` → **HTTP ${n.status || 'ERR'}**: "${n.backendMessage || 'Error'}" [Ruta: \`${n.route || '/'}\`]`);
            });
        }
        if (Array.isArray(diagnostics.consoleErrors) && diagnostics.consoleErrors.length > 0) {
            lines.push('- **Errores en Consola JS / Runtime:**');
            diagnostics.consoleErrors.slice(0, 8).forEach((c) => {
                lines.push(`  - \`[${c.kind}]\` \`${c.message}\` [Ruta: \`${c.route || '/'}\`]`);
            });
        }
        lines.push('');
    }

    lines.push('## ✅ Criterios de Resolución para el Agente');
    lines.push('1. Analiza los logs cargados y localiza la causa raíz exacta en `client/src/` o `server/src/`.');
    lines.push('2. Aplica la solución respetando `AGENTS.md` (archivos < 350 líneas, sin modales inline, uso de `unwrapList`, `dateUtils` y `<Money>`).');
    lines.push('3. Ejecuta `npx eslint` y `npm run build` en `client/` verificando **0 errores**.');

    return lines.join('\n');
}

module.exports = {
    PLATFORM_META,
    getPlatformMeta,
    buildTaskExternalPrompt
};
