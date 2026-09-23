import { useState } from 'react';
import { TrendingUp, CheckCircle2, ChevronUp, ChevronDown, Package } from 'lucide-react';
import Money from '../../ui/Money';

export default function EggCosteoSimulatorTab({
    calcParams,
    calculationResult,
    handleParamChange
}) {
    const [showPresentationsMatrixSim, setShowPresentationsMatrixSim] = useState(false);

    return (
                <div className="space-y-6">
                    {/* Simulador Rápido con Precio Libre */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <span>Simulador de Margen y Precios de Venta</span>
                                </h2>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Proyecta el margen bruto y ganancia total para cualquier precio ofertado a clientes.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-700">Precio Objetivo a Simular:</label>
                                <div className="w-36">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="1.25"
                                        value={calcParams.target_sale_price_per_lb}
                                        onChange={(e) => handleParamChange('target_sale_price_per_lb', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cards de Métricas del Simulador */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Costo Unitario Base</span>
                                <div className="text-xl font-black text-slate-900 mt-1">
                                    <Money value={calculationResult?.breakdown?.total_cost_per_lb || 0} />
                                    <span className="text-xs font-medium text-slate-500"> /lb</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Costo total por libra</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Margen Bruto ($/lb)</span>
                                <div className={`text-xl font-black mt-1 ${(calculationResult?.target_simulation?.margin_per_lb || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                    <Money value={calculationResult?.target_simulation?.margin_per_lb || 0} />
                                    <span className="text-xs font-medium text-slate-500"> /lb</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Ganancia neta por libra</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Margen Porcentual (%)</span>
                                <div className="text-xl font-black mt-1 flex items-center gap-2">
                                    <span className={
                                        (calculationResult?.target_simulation?.margin_pct || 0) >= 20
                                            ? 'text-emerald-600'
                                            : (calculationResult?.target_simulation?.margin_pct || 0) >= 10
                                                ? 'text-amber-600'
                                                : 'text-rose-600'
                                    }>
                                        {calculationResult?.target_simulation?.margin_pct?.toFixed(1) || 0}%
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500">Rentabilidad sobre venta</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Ganancia Lote Completo</span>
                                <div className="text-xl font-black text-indigo-700 mt-1">
                                    <Money value={(calculationResult?.target_simulation?.margin_per_lb || 0) * (parseFloat(calcParams.batch_size_lbs) || 0)} />
                                </div>
                                <span className="text-[10px] text-slate-500">Para {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs</span>
                            </div>
                        </div>
                    </div>

                    {/* Grid en 2 Columnas: Izquierda = Matriz Escalonada de Margen | Derecha = Simulación Multiformato por Presentación */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Columna Izquierda: Matriz de Precios Sugeridos por Margen */}
                        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="pb-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                                    <span>Escala de Precios por Margen</span>
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Presentación activa: <strong className="text-indigo-700 font-bold">{calcParams.presentation}</strong>
                                </p>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-3 px-3">Margen</th>
                                            <th className="py-3 px-3 text-right">Precio / Lb</th>
                                            <th className="py-3 px-3 text-right">Precio / Envase</th>
                                            <th className="py-3 px-3 text-right">Utilidad Lote</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {(calculationResult?.target_simulation?.margin_matrix || []).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-block ${row.margin_target_pct >= 25
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : row.margin_target_pct >= 15
                                                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                        {row.margin_target_pct}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-slate-900">
                                                    <Money value={row.suggested_price_per_lb} />
                                                </td>
                                                <td className="py-3 px-3 text-right font-medium text-slate-700">
                                                    <Money value={row.suggested_price_per_presentation} />
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-indigo-700">
                                                    <Money value={row.batch_gain} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Columna Derecha: Simulación Multiformato por Presentación (Desplegable para evitar saturación) */}
                        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                            <div
                                onClick={() => setShowPresentationsMatrixSim(prev => !prev)}
                                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                            >
                                <div className="flex items-start sm:items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                                Simulación por Presentación y Empaque
                                            </h3>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                Multiformato
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            {showPresentationsMatrixSim
                                                ? `Impacto del precio simulado de ${(parseFloat(calcParams.target_sale_price_per_lb) || 0).toFixed(2)}/lb en cada formato. Haz clic para ocultar.`
                                                : 'Márgenes y utilidades por formato al precio simulado. Haz clic para desplegar.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 self-end sm:self-center">
                                    <button
                                        type="button"
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        <span>{showPresentationsMatrixSim ? 'Ocultar' : 'Desplegar'}</span>
                                        {showPresentationsMatrixSim ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {showPresentationsMatrixSim && (
                                <div className="p-6 pt-0 space-y-4 border-t border-slate-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3">
                                        <p className="text-xs text-slate-500 font-medium">
                                            Impacto del precio simulado de <strong className="text-slate-900 font-bold"><Money value={parseFloat(calcParams.target_sale_price_per_lb) || 0} /> /lb</strong> en cada formato:
                                        </p>
                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                                            Lote: {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="py-3 px-3.5">Presentación</th>
                                                    <th className="py-3 px-3 text-right">Costo / Envase</th>
                                                    <th className="py-3 px-3 text-right">Precio Venta</th>
                                                    <th className="py-3 px-3 text-right">Margen / Envase</th>
                                                    <th className="py-3 px-3 text-center">Margen %</th>
                                                    <th className="py-3 px-3.5 text-right">Utilidad Lote</th>
                                                    <th className="py-3 px-3 text-right">Precio Sug. 20%</th>
                                                    <th className="py-3 px-3 text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {(calculationResult?.presentations_comparison || []).map((row, idx) => {
                                                    const isSelected = row.is_current || (calcParams.presentation || '').toLowerCase().includes(row.lbs.toString());
                                                    const hasSimPrice = (parseFloat(calcParams.target_sale_price_per_lb) || 0) > 0;
                                                    const marginPct = row.simulation?.margin_pct || 0;
                                                    const marginPerUnit = row.simulation?.gain_per_unit || 0;
                                                    const totalBatchGain = row.simulation?.total_batch_gain || 0;

                                                    return (
                                                        <tr key={idx} className={`transition-colors ${isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50/80'}`}>
                                                            <td className="py-3 px-3.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                                        <Package className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                                            <span>{row.short_name}</span>
                                                                            {isSelected && (
                                                                                <span className="text-[9px] font-black uppercase bg-indigo-600 text-white px-1.5 py-0.2 rounded tracking-wider">
                                                                                    Activo
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                                            Empaque: <Money value={row.packaging_cost_lb} />/lb
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <div className="font-bold text-slate-900"><Money value={row.total_cost_per_unit} /></div>
                                                                <span className="text-[9px] text-slate-400 font-normal">(<Money value={row.total_cost_per_lb} />/lb)</span>
                                                            </td>
                                                            <td className="py-3 px-3 text-right font-black text-slate-900">
                                                                {hasSimPrice ? (
                                                                    <Money value={row.simulation?.sale_price_unit || 0} />
                                                                ) : (
                                                                    <span className="text-slate-400 text-[11px] font-normal italic">Sin precio</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                {hasSimPrice ? (
                                                                    <span className={`font-black ${marginPerUnit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        {marginPerUnit >= 0 ? '+' : ''}<Money value={marginPerUnit} />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-normal">-</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                {hasSimPrice ? (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black inline-block ${marginPct >= 20
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : marginPct >= 10
                                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                        }`}>
                                                                        {marginPct.toFixed(1)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-normal">-</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3.5 text-right font-black text-indigo-900">
                                                                {hasSimPrice ? (
                                                                    <span className={totalBatchGain >= 0 ? 'text-indigo-900' : 'text-rose-600'}>
                                                                        <Money value={totalBatchGain} />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-normal">-</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <span className="font-bold text-emerald-700">
                                                                    <Money value={row.suggested_prices?.margin_20?.price_unit || 0} />
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 block font-normal">
                                                                    (<Money value={row.suggested_prices?.margin_20?.price_lb || 0} />/lb)
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                {isSelected ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                        <span>Seleccionado</span>
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleParamChange('presentation', row.id)}
                                                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg shadow-sm transition-all"
                                                                    >
                                                                        Seleccionar
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
    );
}
