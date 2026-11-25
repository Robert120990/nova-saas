import { AlertTriangle, CheckCircle2, RefreshCcw, Save, RotateCw, Send } from 'lucide-react';

export function CorrectionIssuesBanner({ analysis, liveHaciendaError, onSelectTab }) {
    const issues = Array.isArray(analysis?.detectedIssues) ? analysis.detectedIssues : [];
    const hasErrorText = liveHaciendaError || analysis?.descripcionMsg || (analysis?.observaciones?.length > 0);
    if (!hasErrorText && issues.length === 0) return null;

    return (
        <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
            {hasErrorText && (
                <div className="text-xs text-rose-900 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <div className="space-y-0.5">
                        <p className="font-bold">
                            {liveHaciendaError ? 'Nueva respuesta de Hacienda al reintentar:' : 'Motivo actual del rechazo:'}{' '}
                            {analysis?.codigoMsg && (
                                <span className="font-mono bg-rose-200 px-1.5 py-0.5 rounded text-[10px]">
                                    Cód. {analysis.codigoMsg}
                                </span>
                            )}
                        </p>
                        <p className="font-mono text-[11px] break-all">
                            {liveHaciendaError
                                ? (typeof liveHaciendaError === 'object' ? JSON.stringify(liveHaciendaError) : liveHaciendaError)
                                : [analysis?.descripcionMsg, ...(analysis?.observaciones || [])].filter(Boolean).join(' • ')}
                        </p>
                    </div>
                </div>
            )}

            {issues.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {issues.map(iss => (
                        <button
                            key={iss.id}
                            type="button"
                            onClick={() => onSelectTab(iss.tab)}
                            title={iss.detail}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                                iss.severity === 'error'
                                    ? 'bg-white text-rose-700 border-rose-300 hover:bg-rose-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }`}
                        >
                            {iss.title} →
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CorrectionFooterBar({
    analysis,
    canRegenerateDTE,
    hasCodigoGeneracion,
    updateDateTime,
    onToggleUpdateDateTime,
    saving,
    onClose,
    onAction
}) {
    const editable = Boolean(analysis?.isEditable);

    return (
        <div className="pt-3 border-t border-slate-200 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={updateDateTime}
                        onChange={(e) => onToggleUpdateDateTime(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                    />
                    <span>Actualizar fecha/hora de emisión a hoy ({analysis?.todaySv})</span>
                </label>

                {analysis?.recommendRegenerate && (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold text-[11px]">
                        <CheckCircle2 size={13} /> Se sugiere usar &quot;Guardar y Regenerar (Nuevo Control)&quot;
                    </span>
                )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                    Cerrar
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onAction('save_only')}
                        disabled={saving || !editable}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                    >
                        <Save size={14} />
                        <span>Guardar Cambios</span>
                    </button>

                    {canRegenerateDTE && (
                        <button
                            type="button"
                            onClick={() => onAction('regenerate')}
                            disabled={saving || !editable}
                            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 ${
                                analysis?.recommendRegenerate
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            }`}
                        >
                            <RotateCw size={14} className={saving ? 'animate-spin' : ''} />
                            <span>Guardar y Regenerar (Nuevo Control)</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => onAction('retransmit')}
                        disabled={saving || !editable || !hasCodigoGeneracion}
                        className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <RefreshCcw size={14} className="animate-spin" /> : <Send size={14} />}
                        <span>Guardar y Reintentar Envío</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
