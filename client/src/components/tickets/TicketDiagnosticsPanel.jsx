import { useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Terminal,
    WifiOff,
    Cpu,
    Sparkles
} from 'lucide-react';
import { formatTime } from '../../utils/dateUtils';

const RELEVANCE_STYLES = {
    alta: {
        bg: 'bg-rose-50/90 border-rose-200',
        badge: 'bg-rose-600 text-white',
        text: 'text-rose-900',
        subtext: 'text-rose-700',
        icon: AlertTriangle,
        iconColor: 'text-rose-600',
        label: 'ALTA RELACIÓN CON EL PROBLEMA'
    },
    media: {
        bg: 'bg-amber-50/90 border-amber-200',
        badge: 'bg-amber-500 text-white',
        text: 'text-amber-900',
        subtext: 'text-amber-700',
        icon: Activity,
        iconColor: 'text-amber-600',
        label: 'POSIBLE RELACIÓN DETECTADA'
    },
    baja: {
        bg: 'bg-slate-50 border-slate-200',
        badge: 'bg-slate-600 text-white',
        text: 'text-slate-800',
        subtext: 'text-slate-600',
        icon: Terminal,
        iconColor: 'text-slate-500',
        label: 'REGISTROS PREVIOS NO VINCULADOS'
    },
    sin_errores: {
        bg: 'bg-emerald-50/70 border-emerald-200',
        badge: 'bg-emerald-600 text-white',
        text: 'text-emerald-900',
        subtext: 'text-emerald-700',
        icon: CheckCircle2,
        iconColor: 'text-emerald-600',
        label: 'CONSOLA Y RED LIMPIAS'
    }
};

export default function TicketDiagnosticsPanel({
    diagnostics,
    compact = false,
    includeDiagnostics = true,
    onToggleInclude = null
}) {
    const [expanded, setExpanded] = useState(!compact);

    if (!diagnostics) return null;

    const relKey = RELEVANCE_STYLES[diagnostics.relevance] ? diagnostics.relevance : 'sin_errores';
    const style = RELEVANCE_STYLES[relKey];
    const StatusIcon = style.icon;

    const netList = Array.isArray(diagnostics.networkFailures) ? diagnostics.networkFailures : [];
    const conList = Array.isArray(diagnostics.consoleErrors) ? diagnostics.consoleErrors : [];
    const totalEvents = netList.length + conList.length;

    return (
        <div className={`rounded-2xl border p-3.5 transition-all ${style.bg}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 flex-1 min-w-[220px]">
                    <div className="p-2 rounded-xl bg-white/90 shadow-sm border border-black/5 shrink-0 mt-0.5">
                        <StatusIcon className={`w-4 h-4 ${style.iconColor}`} />
                    </div>
                    <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${style.badge}`}>
                                <Sparkles className="w-3 h-3" />
                                {style.label}
                                {diagnostics.score > 0 ? ` (${diagnostics.score}%)` : ''}
                            </span>
                            {totalEvents > 0 && (
                                <span className="text-[11px] font-bold text-slate-600">
                                    {netList.length} op. fallida(s) · {conList.length} log(s) consola
                                </span>
                            )}
                        </div>
                        <p className={`text-xs font-semibold leading-relaxed ${style.text}`}>
                            {diagnostics.verdictLabel}
                        </p>
                        <p className={`text-[11px] leading-relaxed ${style.subtext}`}>
                            {diagnostics.explanation}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-center">
                    {typeof onToggleInclude === 'function' && (
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer bg-white/80 px-2.5 py-1 rounded-xl border border-slate-200">
                            <input
                                type="checkbox"
                                checked={includeDiagnostics}
                                onChange={(e) => onToggleInclude(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            Adjuntar log
                        </label>
                    )}

                    {totalEvents > 0 && (
                        <button
                            type="button"
                            onClick={() => setExpanded((prev) => !prev)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 hover:bg-white text-[11px] font-bold text-slate-700 border border-slate-200 shadow-sm"
                        >
                            {expanded ? 'Ocultar detalle' : 'Ver bitácora'}
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                    )}
                </div>
            </div>

            {expanded && totalEvents > 0 && (
                <div className="mt-3 pt-3 border-t border-black/10 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {/* Operaciones de Red / Servidor Fallidas */}
                    {netList.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                                Operaciones Fallidas Previas ({netList.length})
                            </div>
                            {(Array.isArray(netList) ? netList : []).map((net, idx) => (
                                <div
                                    key={net.id || idx}
                                    className="bg-white/95 rounded-xl p-2.5 border border-slate-200 shadow-sm text-xs space-y-1"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-slate-900">
                                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                                                {net.method} {net.status || 'ERR'}
                                            </span>
                                            <span className="truncate max-w-[240px] sm:max-w-md">{net.url}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                                    net.isRelated
                                                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {net.isRelated ? `Sí relacionado (${net.relevanceScore}%)` : `Baja relación (${net.relevanceScore}%)`}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                {formatTime(net.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] font-semibold text-rose-700 break-words">
                                        Respuesta: {net.backendMessage}
                                    </p>
                                    {Array.isArray(net.reasons) && net.reasons.length > 0 && (
                                        <p className="text-[10px] text-slate-500">
                                            Diagnóstico: {net.reasons.join(' · ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Errores de Consola / Runtime JS */}
                    {conList.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-amber-600" />
                                Errores en Log del Explorador ({conList.length})
                            </div>
                            {(Array.isArray(conList) ? conList : []).map((con, idx) => (
                                <div
                                    key={con.id || idx}
                                    className="bg-slate-900 text-slate-100 rounded-xl p-2.5 border border-slate-800 text-xs space-y-1"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                            [{con.kind}] Ruta: {con.route || '/'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    con.isRelated ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-400'
                                                }`}
                                            >
                                                {con.isRelated ? `Relacionado (${con.relevanceScore}%)` : `No vinculado (${con.relevanceScore}%)`}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {formatTime(con.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="font-mono text-[11px] text-rose-300 break-words">
                                        {con.message}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {diagnostics.environment && (
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-1">
                            <span className="inline-flex items-center gap-1">
                                <Cpu className="w-3 h-3" />
                                Resolución: {diagnostics.environment.viewport || 'N/A'}
                            </span>
                            {diagnostics.environment.memoryMb && (
                                <span>Memoria JS: {diagnostics.environment.memoryMb} MB</span>
                            )}
                            <span>Red: {diagnostics.environment.online ? 'En línea' : 'Sin conexión'}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
