import { AlertTriangle, XCircle, ShieldCheck, ArrowRight, CheckCircle2, Info, Sparkles, Package, Scale, DollarSign } from 'lucide-react';
import Money from '../../ui/Money';

const ACTION_LABELS = {
    asignado: { label: 'Asignado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    aumentado: { label: 'Aumentado', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    reducido: { label: 'Reducido', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    liberado: { label: 'Liberado', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
};

export default function ProductionClosedBatchImpactModal({
    open,
    onClose,
    batch,
    preview,
    loading = false,
    submitting = false,
    reason = '',
    onReasonChange,
    acknowledgeWarnings = false,
    onAcknowledgeWarningsChange,
    onConfirm
}) {
    if (!open) return null;

    const changes = Array.isArray(preview?.changes) ? preview.changes : [];
    const remImpacts = Array.isArray(preview?.remanente_impacts) ? preview.remanente_impacts : [];
    const matImpacts = Array.isArray(preview?.material_impacts) ? preview.material_impacts : [];
    const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];
    const blockingErrors = Array.isArray(preview?.blocking_errors) ? preview.blocking_errors : [];
    const downstreamNotes = Array.isArray(preview?.downstream_notes) ? preview.downstream_notes : [];
    const mb = preview?.mass_balance;
    const pkg = preview?.packaging_impact;
    const cost = preview?.costing_impact;

    const canConfirm =
        !loading &&
        !submitting &&
        preview?.has_changes &&
        blockingErrors.length === 0 &&
        reason.trim().length >= 5 &&
        (warnings.length === 0 || acknowledgeWarnings);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-2 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
                <div className="px-4 sm:px-6 py-3.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-amber-600 text-white rounded-xl shrink-0">
                            <ShieldCheck size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-amber-950 uppercase tracking-tight truncate">
                                Revisión de Afectaciones — Lote Cerrado
                            </h3>
                            <p className="text-[11px] text-amber-800 truncate">
                                Lote: <strong>{batch?.batch_code_display || batch?.batch_uuid || `#${batch?.id}`}</strong> • Estado: <strong className="uppercase">{batch?.status}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {loading ? (
                        <div className="py-12 text-center text-xs font-semibold text-slate-500 animate-pulse">
                            Calculando afectaciones en remanentes, inventario, envasado y costeo...
                        </div>
                    ) : !preview ? null : (
                        <>
                            {!preview.has_changes && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                                    <Info size={16} className="text-slate-500 shrink-0" />
                                    <span>No se detectaron modificaciones respecto al estado actual del lote.</span>
                                </div>
                            )}

                            {blockingErrors.length > 0 && (
                                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl space-y-1">
                                    <p className="text-xs font-black text-rose-900 uppercase flex items-center gap-1.5">
                                        <XCircle size={15} className="text-rose-600 shrink-0" />
                                        Impedimentos detectados (no es posible aplicar)
                                    </p>
                                    <ul className="list-disc pl-5 text-xs text-rose-800 space-y-0.5">
                                        {blockingErrors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </div>
                            )}

                            {warnings.length > 0 && (
                                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                                    <p className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                        Advertencias de Impacto Operativo
                                    </p>
                                    <ul className="list-disc pl-5 text-xs text-amber-900 space-y-0.5">
                                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                    <label className="flex items-start gap-2 pt-1 text-xs font-bold text-amber-950 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={acknowledgeWarnings}
                                            onChange={(e) => onAcknowledgeWarningsChange?.(e.target.checked)}
                                            className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span>Confirmo que revisé las advertencias y autorizo registrar estas afectaciones bajo mi responsabilidad.</span>
                                    </label>
                                </div>
                            )}

                            {remImpacts.length > 0 && (
                                <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-3.5 space-y-2">
                                    <h4 className="text-xs font-black text-teal-900 uppercase flex items-center gap-1.5">
                                        <Sparkles size={14} className="text-teal-600" />
                                        Afectaciones en Remanentes / Reutilizables
                                    </h4>
                                    <div className="overflow-x-auto rounded-lg border border-teal-200 bg-white">
                                        <table className="w-full text-left text-xs min-w-[540px]">
                                            <thead className="bg-teal-50 text-[10px] font-black uppercase text-teal-900 border-b border-teal-200">
                                                <tr>
                                                    <th className="px-3 py-2">Código</th>
                                                    <th className="px-3 py-2">Producto</th>
                                                    <th className="px-3 py-2">Acción</th>
                                                    <th className="px-3 py-2 text-right">Antes</th>
                                                    <th className="px-3 py-2 text-right">Después</th>
                                                    <th className="px-3 py-2">Efecto en Saldo Residual</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {remImpacts.map((r, idx) => {
                                                    const badge = ACTION_LABELS[r.action] || { label: r.action, cls: 'bg-slate-100 text-slate-700 border-slate-200' };
                                                    return (
                                                        <tr key={idx}>
                                                            <td className="px-3 py-2 font-mono font-bold text-teal-800">{r.code}</td>
                                                            <td className="px-3 py-2 capitalize">{r.product_type}</td>
                                                            <td className="px-3 py-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.cls}`}>
                                                                    {badge.label}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-mono">{Number(r.before_lbs || 0).toFixed(2)} Lbs</td>
                                                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{Number(r.after_lbs || 0).toFixed(2)} Lbs</td>
                                                            <td className="px-3 py-2 text-[11px] text-slate-600">{r.residual_effect}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {matImpacts.length > 0 && (
                                <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3.5 space-y-2">
                                    <h4 className="text-xs font-black text-indigo-900 uppercase flex items-center gap-1.5">
                                        <Package size={14} className="text-indigo-600" />
                                        Afectaciones en Inventario de Materia Prima
                                    </h4>
                                    <div className="overflow-x-auto rounded-lg border border-indigo-200 bg-white">
                                        <table className="w-full text-left text-xs min-w-[500px]">
                                            <thead className="bg-indigo-50 text-[10px] font-black uppercase text-indigo-900 border-b border-indigo-200">
                                                <tr>
                                                    <th className="px-3 py-2">Lote MP</th>
                                                    <th className="px-3 py-2 text-right">Antes</th>
                                                    <th className="px-3 py-2 text-right">Después</th>
                                                    <th className="px-3 py-2 text-right">Delta</th>
                                                    <th className="px-3 py-2 text-right">Saldo Bodega Resultante</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {matImpacts.map((m, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 font-bold">{m.provider_lot} ({m.egg_type})</td>
                                                        <td className="px-3 py-2 text-right font-mono">{Number(m.before_lbs).toFixed(2)} Lbs</td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold">{Number(m.after_lbs).toFixed(2)} Lbs</td>
                                                        <td className="px-3 py-2 text-right font-mono">{m.delta_lbs > 0 ? `+${m.delta_lbs}` : m.delta_lbs} Lbs</td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700">{Number(m.stock_after_lbs).toFixed(2)} Lbs ({m.boxes_after} cjs)</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {mb && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                        <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                                            <Scale size={14} className="text-indigo-600" />
                                            Balance de Masas y Envasado
                                        </h4>
                                        <div className="space-y-1.5 text-xs">
                                            {[
                                                ['Entrada MP', `${mb.input_weight_lbs.before} Lbs`, `${mb.input_weight_lbs.after} Lbs`],
                                                ['Remanentes Incorporados', `${mb.remanentes_used_lbs.before} Lbs`, `${mb.remanentes_used_lbs.after} Lbs`],
                                                ['Líquido Disponible Total', `${mb.total_available_liquid_lbs.before} Lbs`, `${mb.total_available_liquid_lbs.after} Lbs`],
                                                ['Envasado Registrado', `${pkg?.packaged_lbs || 0} Lbs`, `${pkg?.packaged_lbs || 0} Lbs`],
                                                ['Eficiencia Empaque', `${pkg?.efficiency_pct?.before || 0}%`, `${pkg?.efficiency_pct?.after || 0}%`],
                                                ['Diferencia / Merma Líquida', `${pkg?.loss_lbs?.before || 0} Lbs`, `${pkg?.loss_lbs?.after || 0} Lbs`]
                                            ].map(([lbl, before, after], idx) => (
                                                <div key={idx} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                    <span className="text-slate-600 font-medium">{lbl}</span>
                                                    <span className="font-mono flex items-center gap-1.5 text-[11px]">
                                                        <span className="text-slate-500">{before}</span>
                                                        {before !== after && (
                                                            <>
                                                                <ArrowRight size={12} className="text-indigo-500" />
                                                                <strong className="text-indigo-700">{after}</strong>
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {cost && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                                            <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                                                <DollarSign size={14} className="text-emerald-600" />
                                                Impacto en Costeo Industrial
                                            </h4>
                                            <div className="space-y-1.5 text-xs">
                                                {[
                                                    ['Costo Materia Prima', cost.mp_cost.before, cost.mp_cost.after],
                                                    ['Costos Operativos Planta', cost.industrial_cost.before, cost.industrial_cost.after],
                                                    ['Costo Total Estimado', cost.total_cost.before, cost.total_cost.after],
                                                    ['Costo por Libra Disponible', cost.cost_per_lb.before, cost.cost_per_lb.after]
                                                ].map(([lbl, beforeVal, afterVal], idx) => {
                                                    const changed = Math.abs(Number(beforeVal) - Number(afterVal)) > 0.009;
                                                    return (
                                                        <div key={idx} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                            <span className="text-slate-600 font-medium">{lbl}</span>
                                                            <span className="font-mono flex items-center gap-1.5 text-[11px]">
                                                                <span className="text-slate-500"><Money value={beforeVal} /></span>
                                                                {changed && (
                                                                    <>
                                                                        <ArrowRight size={12} className="text-emerald-600" />
                                                                        <strong className="text-emerald-700"><Money value={afterVal} /></strong>
                                                                    </>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-slate-500 pt-1">
                                                Además se actualizarán: {downstreamNotes.join(' ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {changes.length > 0 && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-800 uppercase block">
                                        Motivo de la modificación (Auditoría Obligatoria) <span className="text-rose-500">*</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={reason}
                                        onChange={(e) => onReasonChange?.(e.target.value)}
                                        placeholder="Ej: Corrección de digitación en consumo de REM-#48 verificado con hoja de planta (mínimo 5 caracteres)..."
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
                    >
                        Volver a Editar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!canConfirm}
                        className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <CheckCircle2 size={15} />
                        <span>{submitting ? 'Aplicando y Registrando Log...' : 'Confirmar y Aplicar Cambios'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
