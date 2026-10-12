import { Store, CheckCircle2, Info } from 'lucide-react';

/**
 * Sidebar card displaying detected Tienda POS terminals or Comparative KPI diagnostics.
 */
const StoreSalesComparisonCard = ({ isComparative, compSummary, isLoadingSummary, detectedPosList = [] }) => {
    if (isComparative && compSummary) {
        const isExact = Math.abs(compSummary.total_difference || 0) < 0.01;
        return (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black text-emerald-800">
                    <span>Diagnóstico del Cuadre</span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 rounded-full font-bold">
                        {compSummary.exact_days_count} / {compSummary.total_days} días exactos
                    </span>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 font-medium pt-1">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Arqueos Caja:</span>
                        <span className="font-bold text-slate-700">${Number(compSummary.total_arqueos || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Total DTEs:</span>
                        <span className="font-bold text-indigo-700">${Number(compSummary.total_dtes || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-emerald-200/60 pt-1">
                        <span className="font-bold text-slate-700">Diferencia Neta:</span>
                        <span className={`font-bold ${isExact ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {compSummary.total_difference >= 0 
                                ? `+$${Number(compSummary.total_difference).toFixed(2)}` 
                                : `-$${Math.abs(compSummary.total_difference).toFixed(2)}`}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700">
                <Store size={14} className="text-indigo-600" />
                <span>Terminales de Tienda Detectadas</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                Lee automáticamente los puntos de venta configurados para Tienda y cuadra directamente con los turnos operativos.
            </p>
            {isLoadingSummary ? (
                <span className="text-[10px] text-indigo-500 font-semibold italic animate-pulse">Detectando terminales...</span>
            ) : detectedPosList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {detectedPosList.map((name, idx) => (
                        <span 
                            key={idx} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-indigo-200/80 rounded-md text-[10px] font-bold text-indigo-700 shadow-2xs"
                        >
                            <CheckCircle2 size={10} className="text-emerald-500" />
                            {name}
                        </span>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                    <Info size={11} />
                    <span>Sin turnos registrados en el rango</span>
                </div>
            )}
        </div>
    );
};

export default StoreSalesComparisonCard;
