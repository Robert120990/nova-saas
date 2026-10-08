import { formatDate } from '../../../utils/dateUtils';
import { Sparkles, RefreshCw, CheckSquare } from 'lucide-react';

export default function ProductionCalendarMonthlyTab({
    monthlyPlanData,
    loadingMonthlyPlan,
    selectedPlanRuns = [],
    setSelectedPlanRuns
}) {
    if (loadingMonthlyPlan) {
        return (
            <div className="py-12 text-center text-slate-400 font-medium text-xs space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p>Generando plan mensual optimizado con calendario juliano...</p>
            </div>
        );
    }

    if (!monthlyPlanData) {
        return (
            <div className="py-8 text-center text-slate-500 text-xs font-medium">
                No se pudo cargar la sugerencia mensual. Presiona Recalcular.
            </div>
        );
    }

    const unscheduledRuns = (monthlyPlanData.monthly_plan || []).filter(p => !p.already_scheduled);

    return (
        <div className="space-y-4">
            {/* Banner Informativo */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-indigo-200 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                    <strong className="text-indigo-900 font-bold">Proyección Mensual Inteligente:</strong> Este plan mensual se genera analizando la <strong>demanda confirmada</strong> de los clientes seleccionados, los <strong>acuerdos de suministro</strong> y el <strong>histórico de ventas</strong>. Cada corrida incluye su <strong>Lote con Calendario Juliano</strong> pre-asignado y calibra los lotes de separación para evitar saturar maquinaria y cuartos fríos.
                </div>
            </div>

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
                    <span className="text-[10px] font-bold text-teal-800 uppercase block">Lote Separación Calibrado</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-lg font-black text-teal-900">
                            {(monthlyPlanData.separation_batch_lbs || 6000).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-semibold text-teal-700">Lbs máx</span>
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Ahorro Arbitraje Yema</span>
                    <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-lg font-black text-emerald-900">
                            ${(monthlyPlanData.summary?.coproduct_savings_usd || 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700">USD</span>
                    </div>
                </div>
            </div>

            {/* Barra de Selección Masiva */}
            <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (selectedPlanRuns.length === unscheduledRuns.length) {
                                setSelectedPlanRuns([]);
                            } else {
                                setSelectedPlanRuns(unscheduledRuns);
                            }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>
                            {selectedPlanRuns.length === unscheduledRuns.length
                                ? 'Deseleccionar Todas'
                                : 'Seleccionar Todas las Pendientes'}
                        </span>
                    </button>
                    <span className="text-[11px] text-slate-400">|</span>
                    <span className="text-[11px] font-medium text-slate-500">
                        {selectedPlanRuns.length} de {unscheduledRuns.length} seleccionadas para programar
                    </span>
                </div>
            </div>

            {/* Lista de Corridas Planificadas */}
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {(Array.isArray(monthlyPlanData.monthly_plan) ? monthlyPlanData.monthly_plan : []).map((run) => {
                    const isSelected = selectedPlanRuns.some(r => r.lot_code === run.lot_code && r.production_date === run.production_date);
                    return (
                        <div
                            key={`${run.production_date}-${run.lot_code}`}
                            className={`p-3 rounded-xl border transition-all ${run.already_scheduled
                                    ? 'bg-slate-50/60 border-slate-200 opacity-60'
                                    : isSelected
                                        ? 'bg-indigo-50/40 border-indigo-300 shadow-xs'
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
                                            setSelectedPlanRuns(selectedPlanRuns.filter(r => !(r.lot_code === run.lot_code && r.production_date === run.production_date)));
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

                                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            {run.lot_code}
                                        </span>

                                        <span className="text-xs font-semibold text-slate-800">
                                            • {run.product_profile}
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
                                        <span><strong>Materia Prima:</strong> {run.mix_formula_json?.raw_egg_boxes || Math.round(run.target_quantity_lbs / 36.1)} cajas</span>
                                        {run.mix_formula_json?.water_bottles > 0 && (
                                            <span className="text-cyan-700 font-semibold">
                                                + {run.mix_formula_json.water_bottles} garrafas MP liquida A
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-[11px] text-slate-500 mt-1 italic">
                                        {run.reason}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
