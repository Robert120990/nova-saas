import { formatDate } from '../../../utils/dateUtils';
import Modal from '../../ui/Modal';
import Money from '../../ui/Money';
import {
    Plus,
    Sparkles,
    RefreshCw,
    CalendarCheck,
    CheckSquare
} from 'lucide-react';


import EggSuggestionsRangeBar from '../EggSuggestionsRangeBar';


export default function ProductionCalendarSection6({ model }) {
    const { currentDate, suggestionsData, loadingSuggestions, isSuggestionsDrawerOpen, setIsSuggestionsDrawerOpen, suggestionsTab, setSuggestionsTab, monthlyPlanData, loadingMonthlyPlan, applyingPlan, selectedPlanRuns, setSelectedPlanRuns, suggestionStartDate, setSuggestionStartDate, suggestionEndDate, setSuggestionEndDate, preventPastSuggestions, setPreventPastSuggestions, fetchSuggestions, fetchMonthlyPlan, handleApplyMonthlyPlan, handleOpenCreateModal } = model;

    return (<Modal
                isOpen={isSuggestionsDrawerOpen}
                onClose={() => setIsSuggestionsDrawerOpen(false)}
                title="Sugerencias Inteligentes de Producción por IA"
                maxWidth="max-w-5xl"
            >
                <div className="space-y-4">
                    {/* Barra de Selección de Rango de Fechas (Evita Generación Retroactiva) */}
                    <EggSuggestionsRangeBar
                        startDate={suggestionStartDate}
                        setStartDate={setSuggestionStartDate}
                        endDate={suggestionEndDate}
                        setEndDate={setSuggestionEndDate}
                        preventPast={preventPastSuggestions}
                        setPreventPast={setPreventPastSuggestions}
                        onCalculate={() => {
                            fetchMonthlyPlan(currentDate, suggestionStartDate, suggestionEndDate, preventPastSuggestions);
                            fetchSuggestions(suggestionStartDate, suggestionEndDate);
                        }}
                        loading={loadingMonthlyPlan || loadingSuggestions}
                    />

                    {/* Header Tabs */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setSuggestionsTab('monthly')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${suggestionsTab === 'monthly'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Plan Mensual Completo (IA)</span>
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                    {monthlyPlanData?.monthly_plan?.length || 0}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSuggestionsTab('tactical')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${suggestionsTab === 'tactical'
                                        ? 'bg-white text-emerald-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Sugerencias Tácticas</span>
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                    {suggestionsData?.suggestions?.length || 0}
                                </span>
                            </button>
                        </div>

                        {suggestionsTab === 'monthly' && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fetchMonthlyPlan(currentDate, suggestionStartDate, suggestionEndDate, preventPastSuggestions)}
                                    disabled={loadingMonthlyPlan}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                    title="Recalcular sugerencias del rango"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMonthlyPlan ? 'animate-spin text-indigo-600' : ''}`} />
                                    <span>Recalcular</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyMonthlyPlan}
                                    disabled={applyingPlan || selectedPlanRuns.length === 0}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-200 transition-all disabled:opacity-50"
                                >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    <span>
                                        {applyingPlan
                                            ? 'Programando...'
                                            : `Aplicar ${selectedPlanRuns.length} al Calendario`}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Contenido Pestaña 1: Plan Mensual Completo */}
                    {suggestionsTab === 'monthly' && (
                        <div className="space-y-4">
                            {/* Banner Informativo */}
                            <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-200 rounded-xl flex items-start gap-3">
                                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-slate-700 leading-relaxed">
                                    <strong className="text-indigo-900 font-bold">Proyección Mensual Inteligente:</strong> Este plan mensual se genera analizando la <strong>demanda confirmada</strong> en pedidos de clientes, los <strong>acuerdos de suministro recurrentes</strong> y el <strong>histórico de ventas</strong>. Cada corrida incluye su <strong>Lote con Calendario Juliano</strong> pre-asignado y balancea los coproductos (Clara vs Formulado Yema + H2O) para minimizar desperdicios.
                                </div>
                            </div>

                            {loadingMonthlyPlan ? (
                                <div className="py-12 text-center text-slate-400 font-medium text-xs space-y-2">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                                    <p>Generando plan mensual optimizado con calendario juliano...</p>
                                </div>
                            ) : !monthlyPlanData ? (
                                <div className="py-8 text-center text-slate-500 text-xs font-medium">
                                    No se pudo cargar la sugerencia mensual. Presiona Recalcular.
                                </div>
                            ) : (
                                <>
                                    {/* Resumen KPIs del Mes */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Corridas Sugeridas</span>
                                            <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className="text-lg font-black text-slate-900">
                                                    {monthlyPlanData.summary?.total_runs_suggested || 0}
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-500">lotes julianos</span>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                                            <span className="text-[10px] font-bold text-amber-800 uppercase block">Huevo Cáscara Total</span>
                                            <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className="text-lg font-black text-amber-900">
                                                    {(monthlyPlanData.summary?.total_egg_boxes_needed || 0).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] font-semibold text-amber-700">cajas req.</span>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                                            <span className="text-[10px] font-bold text-teal-800 uppercase block">Clara Pasteurizada</span>
                                            <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className="text-lg font-black text-teal-900">
                                                    {(monthlyPlanData.summary?.projected_production_lbs?.clara || 0).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] font-semibold text-teal-700">Lbs</span>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                                            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Formulado (Yema+H2O)</span>
                                            <div className="flex items-baseline gap-1.5 mt-1">
                                                <span className="text-lg font-black text-emerald-900">
                                                    {(monthlyPlanData.summary?.projected_production_lbs?.formulado_yema_h2o || 0).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] font-semibold text-emerald-700">Lbs</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Barra de Selección Masiva */}
                                    <div className="flex items-center justify-between px-1 py-0.5">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const unscheduled = (monthlyPlanData.monthly_plan || []).filter(p => !p.already_scheduled);
                                                    if (selectedPlanRuns.length === unscheduled.length) {
                                                        setSelectedPlanRuns([]);
                                                    } else {
                                                        setSelectedPlanRuns(unscheduled);
                                                    }
                                                }}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                                            >
                                                <CheckSquare className="w-3.5 h-3.5" />
                                                <span>
                                                    {selectedPlanRuns.length === (monthlyPlanData.monthly_plan || []).filter(p => !p.already_scheduled).length
                                                        ? 'Deseleccionar Todas'
                                                        : 'Seleccionar Todas las Pendientes'}
                                                </span>
                                            </button>
                                            <span className="text-[11px] text-slate-400">|</span>
                                            <span className="text-[11px] font-medium text-slate-500">
                                                {selectedPlanRuns.length} de {(monthlyPlanData.monthly_plan || []).filter(p => !p.already_scheduled).length} seleccionadas para programar
                                            </span>
                                        </div>
                                    </div>

                                    {/* Lista de Corridas Planificadas */}
                                    <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                                        {(Array.isArray(monthlyPlanData.monthly_plan) ? monthlyPlanData.monthly_plan : [])?.map((run) => {
                                            const isSelected = selectedPlanRuns.some(r => r.id === run.id);
                                            return (
                                                <div
                                                    key={run.id}
                                                    className={`p-3 rounded-xl border transition-all ${run.already_scheduled
                                                            ? 'bg-slate-50/60 border-slate-200 opacity-60'
                                                            : isSelected
                                                                ? 'bg-indigo-50/40 border-indigo-300 shadow-sm'
                                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            disabled={run.already_scheduled}
                                                            checked={isSelected || run.already_scheduled}
                                                            onChange={() => {
                                                                if (run.already_scheduled) return;
                                                                if (isSelected) {
                                                                    setSelectedPlanRuns(selectedPlanRuns.filter(r => r.id !== run.id));
                                                                } else {
                                                                    setSelectedPlanRuns([...selectedPlanRuns, run]);
                                                                }
                                                            }}
                                                            className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                                                        />

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-xs font-bold text-slate-900">
                                                                    {formatDate(run.production_date + 'T12:00:00Z')}
                                                                </span>

                                                                <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black border border-indigo-200">
                                                                    J-{run.julian_day}
                                                                </span>

                                                                <span className="font-mono text-[11px] font-bold text-slate-700">
                                                                    {run.lot_code}
                                                                </span>

                                                                <span className="text-xs font-semibold text-slate-800">
                                                                    • {run.product_type}
                                                                </span>

                                                                {run.already_scheduled ? (
                                                                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold ml-auto">
                                                                        Ya en Calendario
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold ml-auto">
                                                                        Sugerido IA
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-600">
                                                                <span><strong>Meta:</strong> {run.target_quantity_lbs?.toLocaleString()} Lbs ({run.presentation})</span>
                                                                <span><strong>Materia Prima:</strong> {run.mix_formula_json?.raw_egg_boxes} cajas</span>
                                                                {run.mix_formula_json?.water_bottles > 0 && (
                                                                    <span className="text-cyan-700 font-semibold">
                                                                        + {run.mix_formula_json.water_bottles} garrafas H2O
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <p className="text-[11px] text-slate-500 mt-1 italic">
                                                                {run.rationale}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Contenido Pestaña 2: Sugerencias Tácticas */}
                    {suggestionsTab === 'tactical' && (
                        <div className="space-y-3">
                            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-emerald-950 leading-relaxed">
                                    <strong>Motor de Arbitraje Táctico:</strong> Analiza balances inmediatos de masa para sugerir reformulaciones de coproducto (evitando que la yema quede rezagada), secuencias óptimas de lavado CIP y priorización de pedidos críticos.
                                </div>
                            </div>

                            {loadingSuggestions ? (
                                <div className="py-8 text-center text-slate-400 font-medium text-xs">
                                    Analizando balance de masas y pedidos de clientes...
                                </div>
                            ) : suggestionsData?.suggestions?.length === 0 ? (
                                <div className="py-8 text-center text-slate-500 text-xs font-medium">
                                    No hay sugerencias tácticas pendientes en este momento. La línea está balanceada.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(Array.isArray(suggestionsData?.suggestions) ? suggestionsData?.suggestions : [])?.map((sug) => (
                                        <div
                                            key={sug.id}
                                            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all shadow-sm space-y-3"
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
                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-200 transition-all shrink-0"
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
                    )}
                </div>
            </Modal>);
}
