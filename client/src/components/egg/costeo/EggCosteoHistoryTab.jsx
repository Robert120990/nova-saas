import { History, RefreshCcw, Factory, Clock } from 'lucide-react';
import Money from '../../ui/Money';

export default function EggCosteoHistoryTab({
    historySubTab,
    setHistorySubTab,
    costingHistoryList = [],
    loadingHistory = false,
    handlePresetChange,
    scenarios = [],
    globalAgreementHistory = [],
    loadingGlobalHistory = false,
    loadGlobalAgreementHistory
}) {
    return (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-600" />
                                <span>Historial Operacional, Escenarios y Auditoría de Precios</span>
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Analiza el rendimiento real acumulado de planta, compara escenarios guardados o audita las revisiones de acuerdos de clientes.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
                            <button
                                type="button"
                                onClick={() => setHistorySubTab('real_production')}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${historySubTab === 'real_production'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                Producción Real & Costo/Lb
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistorySubTab('scenarios')}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${historySubTab === 'scenarios'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                Escenarios Simulados ({scenarios.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setHistorySubTab('agreements_history');
                                    loadGlobalAgreementHistory();
                                }}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${historySubTab === 'agreements_history'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                Historial de Tarifas Clientes
                            </button>
                        </div>
                    </div>

                    {/* SUB-VISTA 1: HISTÓRICO REAL DE PRODUCCIÓN Y COSTOS */}
                    {historySubTab === 'real_production' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                                        Rendimiento y Costo Real de Planta por Período
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                        Consolidado mensual de lotes procesados, rendimientos líquidos y costo promedio por libra.
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {loadingHistory && <RefreshCcw className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                                        {costingHistoryList.length} períodos registrados
                                    </span>
                                </div>
                            </div>

                            {costingHistoryList.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Factory className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                                    <p className="text-xs font-medium">No hay lotes con costos calculados en el rango de fechas seleccionado.</p>
                                    <button
                                        onClick={() => handlePresetChange('all')}
                                        className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all"
                                    >
                                        Ver Todo el Histórico
                                    </button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                <th className="py-3 px-4">Período</th>
                                                <th className="py-3 px-3">Producto</th>
                                                <th className="py-3 px-3 text-right">Lotes</th>
                                                <th className="py-3 px-3 text-right">Entrada MP (Lbs)</th>
                                                <th className="py-3 px-3 text-right">Líquido Obtenido</th>
                                                <th className="py-3 px-3 text-center">Rendimiento Real</th>
                                                <th className="py-3 px-3 text-right">Costo Total</th>
                                                <th className="py-3 px-4 text-right font-black">Costo Promedio / Lb</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {costingHistoryList.map((row, idx) => {
                                                const yieldPct = row.total_input_lbs > 0
                                                    ? ((row.total_yield_lbs / row.total_input_lbs) * 100).toFixed(1)
                                                    : '0.0';
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                                            {row.period}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-800">
                                                            {row.product_type}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-600">
                                                            {row.batches_count}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-600">
                                                            {parseFloat(row.total_input_lbs || 0).toLocaleString()} lbs
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-900 font-bold">
                                                            {parseFloat(row.total_yield_lbs || 0).toLocaleString()} lbs
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                {yieldPct}%
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-700">
                                                            <Money value={row.total_cost} />
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black text-indigo-700">
                                                            <Money value={row.avg_cost_per_lb} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUB-VISTA 2: ESCENARIOS GUARDADOS */}
                    {historySubTab === 'scenarios' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {scenarios.map((scen) => (
                                <div key={scen.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="text-sm font-bold text-slate-900">{scen.scenario_name}</h4>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold shrink-0">
                                            {new Date(scen.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <div>Producto: <strong className="text-slate-900">{scen.product_type}</strong></div>
                                        <div>Presentación: <strong className="text-slate-900">{scen.presentation}</strong></div>
                                        <div>Lote: <strong className="text-slate-900">{scen.batch_size_lbs?.toLocaleString()} Lbs</strong></div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-500 block">Costo / Lb</span>
                                            <strong className="text-slate-900 font-black">
                                                <Money value={scen.calculated_cost_per_lb} />
                                            </strong>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-500 block">Precio Sug. / Lb</span>
                                            <strong className="text-emerald-600 font-black">
                                                <Money value={scen.target_sale_price_per_lb} />
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SUB-VISTA 3: AUDITORÍA GLOBAL DE TARIFAS DE CLIENTES */}
                    {historySubTab === 'agreements_history' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                                        Auditoría Cronológica de Precios Pactados con Clientes
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                        Registro histórico de cada cambio de tarifa, vigencia estipulada y motivo de ajuste.
                                    </span>
                                </div>
                                <button
                                    onClick={loadGlobalAgreementHistory}
                                    disabled={loadingGlobalHistory}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 ${loadingGlobalHistory ? 'animate-spin' : ''}`} />
                                    <span>Actualizar Historial</span>
                                </button>
                            </div>

                            {globalAgreementHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                                    <p className="text-xs font-medium">Aún no hay cambios o revisiones de tarifas archivadas en el historial.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                <th className="py-3 px-4">Fecha de Ajuste</th>
                                                <th className="py-3 px-3">Cliente</th>
                                                <th className="py-3 px-3">Producto / Pres.</th>
                                                <th className="py-3 px-3 text-right">Tarifa Anterior</th>
                                                <th className="py-3 px-3 text-right">Nueva Tarifa</th>
                                                <th className="py-3 px-3">Vigencia Pactada</th>
                                                <th className="py-3 px-3">Motivo del Ajuste</th>
                                                <th className="py-3 px-4">Auditor / Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {globalAgreementHistory.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3 px-4 font-mono text-slate-600">
                                                        {new Date(h.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-slate-900">
                                                        {h.customer_name}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="block text-slate-800">{h.product_type}</span>
                                                        <span className="text-[10px] text-slate-500">{h.presentation}</span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-slate-400 font-mono line-through">
                                                        {h.previous_price_per_lb ? <Money value={h.previous_price_per_lb} /> : '-'}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-emerald-600">
                                                        <Money value={h.agreed_price_per_lb} />
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                                                        {h.valid_from ? new Date(h.valid_from).toLocaleDateString() : 'Sin inicio'}
                                                        {' → '}
                                                        {h.valid_to ? new Date(h.valid_to).toLocaleDateString() : 'Permanente'}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-700 italic max-w-xs truncate" title={h.change_reason}>
                                                        {h.change_reason || 'Sin motivo especificado'}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600 font-medium">
                                                        {h.changed_by || 'Sistema'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
    );
}
