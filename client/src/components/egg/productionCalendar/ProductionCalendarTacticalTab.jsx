import { Sparkles, Plus } from 'lucide-react';
import Money from '../../ui/Money';

export default function ProductionCalendarTacticalTab({
    suggestionsData,
    loadingSuggestions,
    setIsSuggestionsDrawerOpen,
    handleOpenCreateModal
}) {
    const suggestionsList = Array.isArray(suggestionsData?.suggestions) ? suggestionsData.suggestions : [];

    return (
        <div className="space-y-3">
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 leading-relaxed">
                    <strong>Motor de Arbitraje Táctico:</strong> Analiza balances inmediatos de masa con lotes de separación calibrados, sugerencias de secuenciación CIP para evitar paros de planta y priorización de pedidos con fecha crítica.
                </div>
            </div>

            {loadingSuggestions ? (
                <div className="py-8 text-center text-slate-400 font-medium text-xs">
                    Analizando balance de masas y pedidos de clientes...
                </div>
            ) : suggestionsList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-medium">
                    No hay sugerencias tácticas pendientes en este momento. La línea está balanceada.
                </div>
            ) : (
                <div className="space-y-3">
                    {suggestionsList.map((sug) => (
                        <div
                            key={sug.id}
                            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-xs space-y-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                                        {sug.badge}
                                    </span>
                                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                                        {sug.title}
                                    </h3>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSuggestionsDrawerOpen(false);
                                        handleOpenCreateModal(sug.suggested_production?.production_date, sug.suggested_production);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-emerald-200 transition-all shrink-0"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Aplicar al Calendario</span>
                                </button>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">
                                {sug.summary}
                            </p>

                            {sug.economic_impact && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg text-[11px]">
                                    {sug.economic_impact.boxes_saved && (
                                        <div>
                                            <span className="text-slate-500 block text-[10px]">Ahorro en Cajas:</span>
                                            <strong className="text-emerald-700 font-bold">{sug.economic_impact.boxes_saved} cajas</strong>
                                        </div>
                                    )}
                                    {sug.economic_impact.cost_savings_usd && (
                                        <div>
                                            <span className="text-slate-500 block text-[10px]">Ahorro Económico:</span>
                                            <strong className="text-emerald-700 font-bold">
                                                <Money value={sug.economic_impact.cost_savings_usd} />
                                            </strong>
                                        </div>
                                    )}
                                    {sug.economic_impact.cost_per_lb_formulated && (
                                        <div>
                                            <span className="text-slate-500 block text-[10px]">Costo Formulado:</span>
                                            <strong className="text-slate-800 font-bold">{sug.economic_impact.cost_per_lb_formulated}</strong>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
