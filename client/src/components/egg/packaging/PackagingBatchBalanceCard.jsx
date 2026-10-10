import { CheckCircle2, Scale, Lock } from 'lucide-react';

export default function PackagingBatchBalanceCard({
    currentBatch,
    packagingItems,
    onReopenPackaging,
    onOpenCloseBatch,
    canClosePackaging
}) {
    if (!currentBatch) return null;

    const disp = Math.max(0, parseFloat(currentBatch.yield_liquid_lbs || 0) - parseFloat(currentBatch.packaged_weight_lbs || 0));
    const currentProd = (packagingItems || []).reduce((acc, it) => acc + ((parseFloat(it.units_packaged) || 0) * (parseFloat(it.weight_per_unit_lbs) || 0)), 0);
    const rem = Math.max(0, disp - currentProd);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200 text-center text-xs">
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Rendimiento</span>
                    <strong className="text-teal-700 font-bold">{parseFloat(currentBatch.yield_liquid_lbs || 0).toLocaleString()} Lbs</strong>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Ya Envasado</span>
                    <strong className="text-indigo-700 font-bold">{parseFloat(currentBatch.packaged_weight_lbs || 0).toLocaleString()} Lbs</strong>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Disp. Previa</span>
                    <strong className="text-amber-700 font-bold">{disp.toLocaleString()} Lbs</strong>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Restante</span>
                    <strong className={`font-bold ${rem === 0 && currentProd > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {rem.toLocaleString()} Lbs
                    </strong>
                </div>
            </div>

            {currentBatch.packaging_status === 'cerrado' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <span className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        Lote Cerrado Técnicamente (Eficiencia: {currentBatch.packaging_efficiency_pct}%, Merma: {currentBatch.packaging_loss_lbs} Lbs)
                    </span>
                    {onReopenPackaging && (
                        <button
                            type="button"
                            onClick={() => onReopenPackaging(currentBatch)}
                            className="w-full sm:w-auto justify-center px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                        >
                            <Lock size={13} />
                            Reabrir Envasado
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <span className="font-bold flex items-center gap-1.5 text-amber-800">
                            <Scale size={15} className="shrink-0" />
                            Balance de Envasado & Eficiencia
                        </span>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                            {disp > 0
                                ? `Faltan ${disp.toLocaleString()} Lbs por envasar en este lote.`
                                : `Lote completamente envasado.`}
                        </p>
                    </div>
                    {canClosePackaging && (
                        <button
                            type="button"
                            onClick={() => onOpenCloseBatch?.(currentBatch)}
                            className="w-full sm:w-auto justify-center px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                        >
                            <Lock size={13} />
                            Cerrar Envasado de Lote
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
