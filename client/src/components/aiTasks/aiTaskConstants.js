export const AGENT_BADGES = {
    supervisor: { name: 'Supervisor', icon: '👑', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    dte: { name: 'Fiscal DTE', icon: '⚡', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    accounting: { name: 'Contador CPA', icon: '⚖️', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    inventory: { name: 'Inventario', icon: '📦', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    gas: { name: 'Combustibles', icon: '⛽', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    sales: { name: 'Ventas', icon: '📈', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    tech: { name: 'SysAdmin', icon: '🛠️', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
    support: { name: 'Soporte & Tickets', icon: '🎫', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' }
};

export const PRIORITY_STYLES = {
    alta: { cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-pulse' },
    media: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
    baja: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
};

export const OUTPUT_TYPES = {
    texto: { id: 'texto', label: 'Texto / Markdown', icon: '📝', desc: 'Resumen ejecutivo y tablas en pantalla', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    pdf: { id: 'pdf', label: 'PDF Oficial', icon: '📄', desc: 'Formato contable membretado oficial', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    excel: { id: 'excel', label: 'Excel (.xlsx)', icon: '📊', desc: 'Libro de cálculo estructurado descargable', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    imagen: { id: 'imagen', label: 'Gráfico / Imagen', icon: '🖼️', desc: 'Infografía visual de curvas y KPIs', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
};

export const AI_EXECUTION_MODES = {
    api: {
        id: 'api',
        label: 'Modo 1: Por API Interna (Gemini)',
        shortLabel: '⚡ Modo 1: API Interna',
        icon: '⚡',
        desc: 'Ejecución directa y autónoma en el servidor (consultas SQL, auditorías, PDF/Excel/Gráficos).',
        cls: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    agent_prompt: {
        id: 'agent_prompt',
        label: 'Modo 2: Prompt + Logs (Agente Externo)',
        shortLabel: '🚀 Modo 2: Prompt + Logs',
        icon: '🚀',
        desc: 'Carga logs del usuario/navegador y empaqueta un prompt listo para resolver en Antigravity, Cursor o Claude Code.',
        cls: 'bg-purple-50 text-purple-700 border-purple-200'
    }
};

export const AGENT_PLATFORMS = {
    antigravity: { id: 'antigravity', name: 'Google Antigravity IDE', icon: '🚀', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    cursor: { id: 'cursor', name: 'Cursor / Windsurf', icon: '🖱️', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    claude_code: { id: 'claude_code', name: 'Claude Code / Codex', icon: '🧠', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    universal: { id: 'universal', name: 'Markdown Universal', icon: '🤖', cls: 'bg-slate-100 text-slate-700 border-slate-200' }
};

export function getTaskActivityMeta(item = {}) {
    const status = item.status || 'pendiente';
    const progress = Math.min(100, Math.max(0, Number(item.progress) || 0));
    const isTicketTask = item.assigned_agent_code === 'support' || /\[Ticket #TKT-\d+\]/i.test(item.title || '');
    const execMode = item.execution_mode || (isTicketTask ? 'agent_prompt' : 'api');
    const platformId = item.agent_platform || 'antigravity';
    const platform = AGENT_PLATFORMS[platformId] || AGENT_PLATFORMS.antigravity;
    const hasCustomLogs = Boolean(item.custom_logs && String(item.custom_logs).trim());

    const modeBadge = execMode === 'agent_prompt'
        ? { label: `Modo 2: Prompt (${platform.name})`, icon: platform.icon, cls: 'bg-purple-50 text-purple-700 border-purple-200' }
        : { label: 'Modo 1: API Interna', icon: '⚡', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };

    let statusBadge = { label: 'En Cola', icon: '🕒', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (status === 'completada') {
        statusBadge = { label: 'Completada', icon: '✅', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    } else if (status === 'en_proceso' || status === 'analizando') {
        statusBadge = { label: 'En Progreso', icon: '⏳', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    } else if (status === 'fallida') {
        statusBadge = { label: 'No Completada', icon: '❌', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    } else if (status === 'cancelada') {
        statusBadge = { label: 'Cancelada', icon: '🚫', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
    }

    if (status === 'fallida') {
        return {
            progress,
            isCompleted: false,
            execMode,
            platform,
            modeBadge,
            hasCustomLogs,
            statusBadge,
            requiresHumanAction: true,
            humanBadge: '👤 Requiere Acción Humana',
            humanDetail: 'Revisar causa del error y reintentar o pasar a Modo 2 (Prompt + Logs)',
            humanCls: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }

    if ((execMode === 'agent_prompt' || isTicketTask) && status !== 'completada' && status !== 'cancelada') {
        return {
            progress,
            isCompleted: false,
            execMode,
            platform,
            modeBadge,
            hasCustomLogs,
            statusBadge,
            requiresHumanAction: true,
            humanBadge: `👤 Acción Humana (${platform.name})`,
            humanDetail: `Copiar Prompt + Logs y ejecutarlo en ${platform.name}`,
            humanCls: 'bg-amber-50 text-amber-800 border-amber-300'
        };
    }

    if (status === 'completada') {
        return {
            progress: 100,
            isCompleted: true,
            execMode,
            platform,
            modeBadge,
            hasCustomLogs,
            statusBadge,
            requiresHumanAction: false,
            humanBadge: '✓ Sin acción humana pendiente',
            humanDetail: isTicketTask ? 'Mejora aplicada y ticket resuelto al 100%' : 'Actividad finalizada exitosamente',
            humanCls: 'bg-emerald-50/70 text-emerald-700 border-emerald-200'
        };
    }

    return {
        progress,
        isCompleted: false,
        execMode,
        platform,
        modeBadge,
        hasCustomLogs,
        statusBadge,
        requiresHumanAction: false,
        humanBadge: '🤖 Ejecución Autónoma por API',
        humanDetail: 'Procesando automáticamente por API Interna sin intervención humana',
        humanCls: 'bg-sky-50 text-sky-700 border-sky-200'
    };
}


