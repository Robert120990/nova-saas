import { Boxes, Plus, Lock } from 'lucide-react';

export default function PackagingActiveBatchesTable({
    batches,
    canClosePackaging,
    setPackagingForm,
    setIsNewPackagingModalOpen,
    setCloseBatchModal,
    setQualityModal,
    handleReopenBatchPackaging
}) {
    const activeBatches = (Array.isArray(batches) ? batches : []).filter(
        b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad'
    );

    if (activeBatches.length === 0) return null;

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
            <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Boxes size={14} className="text-purple-600" />
                    Lotes en Etapa de Envasado ({activeBatches.length})
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">
                    Control de cierre técnico y reapertura de empaque
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 bg-white text-slate-500 font-bold uppercase text-[10px]">
                            <th className="px-3 py-2">Lote</th>
                            <th className="px-3 py-2">Producto</th>
                            <th className="px-3 py-2 text-right">Rendimiento Líq.</th>
                            <th className="px-3 py-2 text-right">Envasado</th>
                            <th className="px-3 py-2 text-right">Saldo Disp.</th>
                            <th className="px-3 py-2 text-center">Estado Empaque</th>
                            <th className="px-3 py-2 text-center">Calidad FQ/MB</th>
                            <th className="px-3 py-2 text-center">Eficiencia</th>
                            <th className="px-3 py-2 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                        {activeBatches.map(b => {
                            const packaged = parseFloat(b.packaged_weight_lbs || 0);
                            const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
                            const pending = Math.max(0, yieldLbs - packaged);
                            const isClosed = b.packaging_status === 'cerrado';

                            return (
                                <tr key={b.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-mono font-bold text-slate-900">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>{b.batch_code_display || b.batch_uuid}</span>
                                            {b.is_coproduct ? (
                                                <span className="px-1.5 py-0.5 text-[9px] bg-purple-100 text-purple-700 font-bold rounded border border-purple-200" title="Co-producto derivado">
                                                    🔗 Co-Prod
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 capitalize font-medium text-slate-700">
                                        {b.product_type}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-teal-700">
                                        {yieldLbs.toLocaleString()} Lbs
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-indigo-700">
                                        {packaged.toLocaleString()} Lbs
                                    </td>
                                    <td className="px-3 py-2 text-right font-black">
                                        <span className={pending > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                            {pending.toLocaleString()} Lbs
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                            isClosed
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                            {isClosed ? 'Cerrado' : 'Abierto'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setQualityModal({ isOpen: true, batch: b })}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                b.status === 'aprobado_calidad'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : b.status === 'bloqueado_haccp'
                                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}
                                            title="Ver o evaluar control de calidad FQ / MB"
                                        >
                                            {b.status === 'aprobado_calidad' ? 'Liberado' : b.status === 'bloqueado_haccp' ? 'Bloqueado' : 'Cuarentena'}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold text-slate-700">
                                        {b.packaging_efficiency_pct ? `${b.packaging_efficiency_pct}%` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {!isClosed ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setPackagingForm(prev => ({
                                                                ...prev,
                                                                batch_id: String(b.id),
                                                                product_type: (b.product_type || 'huevo entero').toLowerCase()
                                                            }));
                                                            setIsNewPackagingModalOpen(true);
                                                        }}
                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                    >
                                                        <Plus size={11} />
                                                        Envasar
                                                    </button>
                                                    {canClosePackaging && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCloseBatchModal({ isOpen: true, batch: b, notes: '', isSubmitting: false })}
                                                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                            title="Cerrar Envasado y Computar Mermas Técnicas"
                                                        >
                                                            <Lock size={11} />
                                                            Cerrar
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleReopenBatchPackaging(b)}
                                                    className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                    title="Reabrir Envasado para agregar más cubetas o corregir"
                                                >
                                                    <Lock size={11} className="text-purple-600" />
                                                    Reabrir
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
