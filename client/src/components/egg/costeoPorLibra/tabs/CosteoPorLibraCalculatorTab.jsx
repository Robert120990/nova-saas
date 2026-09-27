import useMoneyFormatter from '../../../../hooks/useMoneyFormatter';
import { MoneyInput } from '../../../ui/Money';
import {
    Users,
    Settings2,
    DollarSign,
    Package,
    Flame,
    Droplets,
    Sparkles,
    BarChart3,
    Scale,
    Split,
    CheckCircle2,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import Money from '../../../ui/Money';




export default function CosteoPorLibraCalculatorTab({ model }) {
    const formatMoney = useMoneyFormatter();
    const { activeTab, calcParams, showCustomSolids, setShowCustomSolids, showPresentationsMatrixCalc, setShowPresentationsMatrixCalc, calculationResult, handleParamChange, opSummary } = model;

    return (<>{activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Panel de Parámetros */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-indigo-600" />
                        <span>Parámetros de Formulación y Costeo</span>
                    </h2>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                        Lote {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs
                    </span>
                </div>

                <div className="space-y-3.5 text-xs">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Tipo de Producto
                        </label>
                        <select
                            value={calcParams.product_type}
                            onChange={(e) => handleParamChange('product_type', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                        >
                            <option value="Huevo Entero Pasteurizado">Huevo Entero Pasteurizado (83% rend.)</option>
                            <option value="Huevo Formulado por Separación">Huevo Formulado por Separación (Yema + mp liquida + Venta de Clara)</option>
                            <option value="Huevo Entero Plus">Huevo Entero Plus (Con formula 8% y ácido cítrico)</option>
                            <option value="Clara de Huevo Pasteurizada">Clara Pasteurizada (53.95% rend.)</option>
                            <option value="Yema Azucarada">Yema Azucarada (4% azúcar)</option>
                            <option value="Yema Salada">Yema Salada (10% sal)</option>
                            <option value="Huevo con Leche">Huevo Entero con Leche (Institucional / Vuelos)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Presentación
                            </label>
                            <select
                                value={calcParams.presentation}
                                onChange={(e) => handleParamChange('presentation', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            >
                                <option value="cubeta 30LB">Cubeta 30 Lbs (Estándar)</option>
                                <option value="cubeta 32LB">Cubeta 32 Lbs</option>
                                <option value="galon 8LB">Galón 8 Lbs</option>
                                <option value="medio galon 4LB">Medio Galón 4 Lbs</option>
                                <option value="litro 2LB">Litro 2 Lbs</option>
                                <option value="medio litro 1LB">Medio Litro 1 Lb</option>
                            </select>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Costo Caja Huevo ($)
                                </label>
                                {opSummary.real_box_cost && (
                                    <button
                                        type="button"
                                        onClick={() => handleParamChange('raw_egg_box_cost', opSummary.real_box_cost.toFixed(2))}
                                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                                    >
                                        Real: <Money value={opSummary.real_box_cost} />
                                    </button>
                                )}
                            </div>
                            <MoneyInput
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={calcParams.raw_egg_box_cost}
                                onChange={(e) => handleParamChange('raw_egg_box_cost', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Libras por Caja (360 Uds)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                placeholder="43.5"
                                value={calcParams.raw_egg_lbs_per_box}
                                onChange={(e) => handleParamChange('raw_egg_lbs_per_box', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Tamaño del Lote (Lbs)
                            </label>
                            <input
                                type="number"
                                step="500"
                                placeholder="12000"
                                value={calcParams.batch_size_lbs}
                                onChange={(e) => handleParamChange('batch_size_lbs', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                    </div>

                    {/* SECCIÓN DE FORMULACIÓN POR SEPARACIÓN CLARA/YEMA CON MP LIQUIDA A */}
                    {(calcParams.product_type.toLowerCase().includes('separaci') || calcParams.product_type.toLowerCase().includes('separad')) && (
                        <div className="pt-3.5 pb-3.5 px-4 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-3.5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wide">
                                    <Split className="w-4 h-4 text-emerald-600" />
                                    <span>Modelo de Separación & Arbitraje con Aditivo</span>
                                </div>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Alta Rentabilidad (Crédito Clara)
                                </span>
                            </div>

                            <p className="text-[11px] text-emerald-900 leading-relaxed">
                                Separa la <strong>Clara</strong> para venta comercial a mejor precio (PriceSmart, repostería, hoteles), y utiliza la <strong>Yema pura</strong> (50% sólidos) agregando aditivo <strong>MP liquido a</strong> y ácido cítrico para formular huevo entero estandarizado al <strong>{calcParams.target_solids || '21.5'}%</strong> de sólidos, reduciendo drásticamente el costo por libra.
                            </p>

                            {/* Inputs de la Separación */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                        % Clara a Separar
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        value={calcParams.clara_separated_pct}
                                        onChange={(e) => handleParamChange('clara_separated_pct', e.target.value)}
                                        placeholder="100"
                                        className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-0.5 block">100% = Venta total de clara</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                        Precio Venta Clara ($/lb)
                                    </label>
                                    <MoneyInput
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={calcParams.clara_sale_price_per_lb}
                                        onChange={(e) => handleParamChange('clara_sale_price_per_lb', e.target.value)}
                                        placeholder="1.35"
                                        className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-emerald-700 font-semibold mt-0.5 block">PriceSmart ($1.35 - $1.50)</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                        Sólidos Yema (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="30"
                                        max="60"
                                        value={calcParams.yema_solids_pct}
                                        onChange={(e) => handleParamChange('yema_solids_pct', e.target.value)}
                                        placeholder="50.0"
                                        className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-0.5 block">Estándar planta: 50.0%</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                        Sólidos Target Formulado (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="15"
                                        max="30"
                                        value={calcParams.target_solids}
                                        onChange={(e) => handleParamChange('target_solids', e.target.value)}
                                        placeholder="21.5"
                                        className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-0.5 block">Norma técnica: ≥21.0%</span>
                                </div>
                            </div>

                            {/* Fórmulas matemáticas de planta */}
                            <div className="bg-white/90 border border-emerald-200 rounded-lg p-2.5 text-[10.5px] text-slate-800 space-y-1">
                                <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-100 pb-1">
                                    <span>Fórmula de Balance de Masa & Crédito:</span>
                                    <span>Base Batch: {(parseFloat(calcParams.batch_size_lbs) || 12000).toLocaleString()} lbs Huevo Líquido</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-slate-700">
                                    <div>
                                        • MP liquido a Necesaria = [(Lbs Yema × % Sólidos Yema) ÷ Sólidos Target] − Lbs Yema
                                    </div>
                                    <div>
                                        • Costo Neto MP = Costo Cáscara − (Lbs Clara × Precio Clara) + Aditivos
                                    </div>
                                </div>
                            </div>

                            {/* Tarjetas de balance para el Lote actual */}
                            {calculationResult?.separation_data && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Clara para Venta</span>
                                        <span className="font-bold text-emerald-800 text-xs mt-0.5 block">
                                            {(calculationResult.separation_data.clara_for_sale_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                        </span>
                                        <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">
                                            +<Money value={calculationResult.separation_data.clara_revenue || 0} /> ingreso
                                        </span>
                                    </div>

                                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Yema Base Concentrada</span>
                                        <span className="font-bold text-amber-800 text-xs mt-0.5 block">
                                            {(calculationResult.separation_data.natural_yema_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                        </span>
                                        <span className="text-[9px] text-slate-500 block mt-0.5">
                                            {calculationResult.separation_data.yema_solids_pct}% sólidos
                                        </span>
                                    </div>

                                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase block">MP liquida A Requerida</span>
                                        <span className="font-bold text-cyan-700 text-xs mt-0.5 block">
                                            {(calculationResult.separation_data.h2o_required_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                        </span>
                                        <span className="text-[9px] text-cyan-800 font-semibold block mt-0.5">
                                            {(calculationResult.separation_data.h2o_garrafones || 0).toFixed(1)} garrafones (42 lb)
                                        </span>
                                    </div>

                                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Huevo Formulado Final</span>
                                        <span className="font-bold text-indigo-800 text-xs mt-0.5 block">
                                            {(calculationResult.separation_data.final_formulated_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                        </span>
                                        <span className="text-[9px] text-indigo-600 font-semibold block mt-0.5">
                                            {calculationResult.separation_data.target_solids_pct}% sólidos (Norma)
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Resumen de Arbitraje y Ahorro */}
                            {calculationResult?.separation_data && (
                                <div className="flex flex-wrap items-center justify-between text-xs bg-emerald-100/80 p-2.5 rounded-lg text-emerald-950 font-medium gap-2 border border-emerald-200">
                                    <div>
                                        <span>Costo MP Normal: </span>
                                        <strong className="text-slate-700"><Money value={calculationResult.separation_data.standard_mp_cost_without_separation || 0} />/lb</strong>
                                    </div>
                                    <div>
                                        <span>Costo MP Formulado: </span>
                                        <strong className="text-emerald-900 text-sm font-black"><Money value={calculationResult.separation_data.mp_cost_per_lb_formulated || 0} />/lb</strong>
                                    </div>
                                    <div className="bg-emerald-600 text-white font-black px-2.5 py-1 rounded-md text-[11px] shadow-sm">
                                        Ahorro Arbitraje: -<Money value={calculationResult.separation_data.mp_cost_reduction_per_lb || 0} /> /lb
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SECCIÓN DE FORMULACIÓN Y BALANCE DE SÓLIDOS */}
                    {calcParams.product_type.toLowerCase().includes('plus') || showCustomSolids ? (
                        <div className="pt-3 pb-3 px-3.5 bg-cyan-50/80 border border-cyan-200 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-cyan-900 font-bold text-xs uppercase tracking-wide">
                                    <Droplets className="w-4 h-4 text-cyan-600" />
                                    <span>Nivelación de Sólidos & Balance Hídrico (HE+)</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${(parseFloat(calcParams.target_solids) || 0) >= 21.0
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    }`}>
                                    {(parseFloat(calcParams.target_solids) || 0) >= 21.0 ? 'Norma Cumplida (≥21.0%)' : 'Sólidos Bajos (<21.0%)'}
                                </span>
                            </div>

                            {/* Inputs de Sólidos Base y Objetivo */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        Sólidos Base (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="40"
                                        value={calcParams.base_egg_solids}
                                        onChange={(e) => handleParamChange('base_egg_solids', e.target.value)}
                                        placeholder="24.2"
                                        className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-0.5 block">Refractómetro</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        Sólidos Target (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="40"
                                        value={calcParams.target_solids}
                                        onChange={(e) => handleParamChange('target_solids', e.target.value)}
                                        placeholder="21.5"
                                        className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-0.5 block">Mínimo 21.0%</span>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                        % liquido a a Añadir
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="30"
                                        value={calcParams.water_added_pct}
                                        onChange={(e) => handleParamChange('water_added_pct', e.target.value)}
                                        placeholder="8.0"
                                        className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-cyan-900 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                                    />
                                    <span className="text-[9px] text-cyan-700 font-semibold mt-0.5 block">Sincronizado</span>
                                </div>
                            </div>

                            {/* Banner con la fórmula oficial */}
                            <div className="bg-white/80 border border-cyan-200 rounded-lg p-2 text-[10px] text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <div>
                                    <span className="font-bold text-cyan-800">Fórmula de Planta: </span>
                                    <span className="font-mono text-[10.5px] text-slate-800">% liquido a = [(Sólidos Base − Sólidos Target) ÷ Sólidos Base] × 100</span>
                                </div>
                                <div className="font-bold text-cyan-900">
                                    Lote: {(parseFloat(calcParams.batch_size_lbs) || 12000).toLocaleString()} lbs
                                </div>
                            </div>

                            {/* Desglose de componentes para el Batch actual */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Huevo Líquido Puro</span>
                                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                        {(calculationResult?.formulation?.base_liquid_pure_lbs || (parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.water_added_pct || 0) / 100)))).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                    </span>
                                </div>

                                <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">liquido a</span>
                                    <span className="font-bold text-cyan-700 text-xs mt-0.5 block">
                                        {(calculationResult?.formulation?.water_lbs || (parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.water_added_pct || 0) / 100))).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                    </span>
                                </div>

                                <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Garrafones (42 lb)</span>
                                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                        {(calculationResult?.formulation?.water_garrafones || ((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.water_added_pct || 0) / 100)) / 42.0)).toFixed(1)} u
                                    </span>
                                </div>

                                <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Ácido Cítrico 0.1%</span>
                                    <span className="font-bold text-amber-700 text-xs mt-0.5 block">
                                        {(calculationResult?.formulation?.citric_acid_lbs || (parseFloat(calcParams.batch_size_lbs || 12000) * 0.001)).toFixed(1)} lbs
                                    </span>
                                </div>
                            </div>

                            {/* Resumen de impacto económico de la formulación */}
                            <div className="flex items-center justify-between text-[10px] bg-cyan-100/60 p-2 rounded-lg text-cyan-900">
                                <span>
                                    Costo MP Puro: <strong><Money value={(calculationResult?.formulation?.pure_egg_cost_per_lb || 0)} />/lb</strong>
                                </span>
                                <span>
                                    Costo MP Formulado: <strong><Money value={(calculationResult?.formulation?.formulated_mp_cost_per_lb || calculationResult?.breakdown?.mp_cost_per_lb || 0)} />/lb</strong>
                                </span>
                                <span className="text-emerald-700 font-bold">
                                    Ahorro: -<Money value={(calculationResult?.formulation?.mp_cost_savings_per_lb || 0)} />/lb
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {/* FORMULACIÓN YEMA AZUCARADA */}
                    {calcParams.product_type.toLowerCase().includes('azucarada') && (
                        <div className="pt-3 pb-3 px-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between text-amber-900 font-bold text-xs uppercase">
                                <span className="flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-amber-600" />
                                    Formulación Yema Azucarada
                                </span>
                                <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                    Azúcar Industrial ($0.45/lb)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">% Azúcar</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={calcParams.sugar_added_pct}
                                        onChange={(e) => handleParamChange('sugar_added_pct', e.target.value)}
                                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                                    />
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-amber-200 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Libras de Azúcar</span>
                                    <span className="font-bold text-amber-800 text-xs mt-0.5 block">
                                        {((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.sugar_added_pct || 4) / 100))).toLocaleString()} lbs
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-amber-200 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Yema Pura Requerida</span>
                                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                        {((parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.sugar_added_pct || 4) / 100)))).toLocaleString()} lbs
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FORMULACIÓN YEMA SALADA */}
                    {calcParams.product_type.toLowerCase().includes('salada') && (
                        <div className="pt-3 pb-3 px-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between text-blue-900 font-bold text-xs uppercase">
                                <span className="flex items-center gap-1.5">
                                    <Scale className="w-4 h-4 text-blue-600" />
                                    Formulación Yema Salada
                                </span>
                                <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                    Sal Refinada ($0.15/lb)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">% Sal Industrial</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={calcParams.salt_added_pct}
                                        onChange={(e) => handleParamChange('salt_added_pct', e.target.value)}
                                        className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                                    />
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Libras de Sal</span>
                                    <span className="font-bold text-blue-800 text-xs mt-0.5 block">
                                        {((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.salt_added_pct || 10) / 100))).toLocaleString()} lbs
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Yema Pura Requerida</span>
                                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                        {((parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.salt_added_pct || 10) / 100)))).toLocaleString()} lbs
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FORMULACIÓN HUEVO CON LECHE */}
                    {calcParams.product_type.toLowerCase().includes('leche') && (
                        <div className="pt-3 pb-3 px-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between text-purple-900 font-bold text-xs uppercase">
                                <span className="flex items-center gap-1.5">
                                    <Droplets className="w-4 h-4 text-purple-600" />
                                    Formulación Huevo con Leche (Institucional)
                                </span>
                                <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                                    Leche en Polvo ($1.80/lb)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">% Leche en Polvo</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={calcParams.milk_added_pct}
                                        onChange={(e) => handleParamChange('milk_added_pct', e.target.value)}
                                        className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                                    />
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-purple-200 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Lbs Leche en Polvo</span>
                                    <span className="font-bold text-purple-800 text-xs mt-0.5 block">
                                        {((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.milk_added_pct || 5) / 100))).toLocaleString()} lbs
                                    </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-purple-200 text-center">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Huevo Líquido Base</span>
                                    <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                        {((parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.milk_added_pct || 5) / 100)))).toLocaleString()} lbs
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Botón para alternar nivelación de sólidos en cualquier momento */}
                    {!calcParams.product_type.toLowerCase().includes('plus') && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowCustomSolids(!showCustomSolids)}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                            >
                                <Droplets className="w-3.5 h-3.5" />
                                <span>{showCustomSolids ? 'Ocultar nivelación de sólidos' : '+ Ajustar sólidos / balance hídrico'}</span>
                            </button>
                        </div>
                    )}

                    {/* Prorrateo GIF Mensual */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-slate-700 font-bold text-[11px] uppercase">
                            <span>Prorrateo GIF Mensual</span>
                            <span className="text-[10px] text-slate-500 font-normal">Base 100k Lbs</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">GIF Total ($/mes)</label>
                                <input
                                    type="number"
                                    value={calcParams.custom_gif_monthly}
                                    onChange={(e) => handleParamChange('custom_gif_monthly', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">Volumen Proyectado (Lbs)</label>
                                <input
                                    type="number"
                                    value={calcParams.custom_monthly_volume_lbs}
                                    onChange={(e) => handleParamChange('custom_monthly_volume_lbs', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel de Resultados y Desglose */}
            <div className="lg:col-span-7 space-y-6">
                {/* BANNER DESTACADO: ARBITRAJE COMERCIAL POR SEPARACIÓN Y MP LIQUIDA a*/}
                {calculationResult?.separation_data?.is_separation_mode && (
                    <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-6 text-white shadow-xl border border-emerald-500/40 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                                        Arbitraje Industrial: Separación & Reconstitución con MP liquida a
                                    </h4>
                                    <p className="text-xs text-emerald-200/80">
                                        Doble producto de alto margen: Venta de Clara a precio premium + Huevo Entero Formulado a costo mínimo
                                    </p>
                                </div>
                            </div>
                            <div className="text-right self-start sm:self-auto">
                                <span className="text-[10px] font-bold text-emerald-300 uppercase block">Costo MP Formulado</span>
                                <div className="text-2xl font-black text-emerald-400">
                                    <Money value={calculationResult.separation_data.mp_cost_per_lb_formulated || 0} />
                                    <span className="text-xs text-emerald-200 font-normal"> /lb</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* 1. Clara Separada para Venta Premium */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center justify-between text-emerald-300 text-xs font-bold uppercase mb-2.5 pb-1 border-b border-white/10">
                                    <span>1. Venta de Clara Premium</span>
                                    <span className="text-emerald-400 font-black">
                                        <Money value={calculationResult.separation_data.clara_sale_price || 0} /> /lb
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between text-indigo-100">
                                        <span>Volumen de Clara Vendida:</span>
                                        <strong className="text-white">{(calculationResult.separation_data.clara_for_sale_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs</strong>
                                    </div>
                                    <div className="flex justify-between text-indigo-100">
                                        <span>Ingreso Total Obtenido:</span>
                                        <strong className="text-emerald-300 font-black text-sm"><Money value={calculationResult.separation_data.clara_revenue || 0} /></strong>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-indigo-200/80 pt-1 border-t border-white/10">
                                        <span>Utilidad Neta de la Clara:</span>
                                        <span className="text-emerald-400 font-bold">+<Money value={calculationResult.separation_data.clara_profit || 0} /></span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Huevo Entero Formulado con MP LIQUIDA A*/}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center justify-between text-amber-200 text-xs font-bold uppercase mb-2.5 pb-1 border-b border-white/10">
                                    <span>2. Huevo Formulado (Yema + MP LIQUIDA A)</span>
                                    <span className="text-amber-300 font-black">
                                        {calculationResult.separation_data.target_solids_pct}% Sólidos
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between text-amber-100">
                                        <span>Producción Huevo Formulado:</span>
                                        <strong className="text-white">{(calculationResult.separation_data.final_formulated_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs</strong>
                                    </div>
                                    <div className="flex justify-between text-amber-100">
                                        <span>liquido a:</span>
                                        <strong className="text-cyan-300">{(calculationResult.separation_data.h2o_garrafones || 0).toFixed(1)} garrafones (42 lb)</strong>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-amber-200/80 pt-1 border-t border-white/10">
                                        <span>Ahorro en Materia Prima:</span>
                                        <span className="text-emerald-400 font-bold">-<Money value={calculationResult.separation_data.mp_cost_reduction_per_lb || 0} /> /lb</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-950/80 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="text-emerald-200">
                                El ingreso de <strong className="text-emerald-400"><Money value={calculationResult.separation_data.clara_revenue || 0} /></strong> por venta de clara cubre y subsidia el lote de huevo cáscara, bajando el costo de materia prima a solo <strong className="text-white"><Money value={calculationResult.separation_data.mp_cost_per_lb_formulated || 0} />/lb</strong>.
                            </div>
                        </div>
                    </div>
                )}

                {/* Tarjeta Principal de Costo por Libra */}
                <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                                Costo Unitario Calculado
                            </span>
                            <div className="text-4xl font-black tracking-tight mt-1 flex items-baseline gap-2">
                                <span><Money value={(calculationResult?.breakdown?.total_cost_per_lb || 0)} /></span>
                                <span className="text-base font-semibold text-indigo-200">/ Libra</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-medium">
                                    Presentación ({calcParams.presentation}):{' '}
                                    <strong className="text-white">
                                        <Money value={(calculationResult?.breakdown?.cost_per_unit || 0)} />
                                    </strong>
                                </span>
                                <span className="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-medium">
                                    Rendimiento Líquido:{' '}
                                    <strong className="text-emerald-300">
                                        {calculationResult?.parameters_used?.liquid_yield_pct || 83}%
                                    </strong>
                                </span>
                            </div>
                        </div>

                        <div className="text-right sm:border-l sm:border-white/15 sm:pl-6">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
                                Lote Completo ({(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs)
                            </span>
                            <div className="text-2xl font-black tracking-tight mt-0.5 text-indigo-100">
                                <Money value={((calculationResult?.breakdown?.total_cost_per_lb || 0) * (parseFloat(calcParams.batch_size_lbs) || 0))} />
                            </div>
                            <span className="text-[10px] text-indigo-200 block mt-1">
                                Equivalente a {Math.round((parseFloat(calcParams.batch_size_lbs) || 0) / (calculationResult?.presentation_lbs || 30))} unidades
                            </span>
                        </div>
                    </div>
                </div>

                {/* Desglose de Factores de Absorción */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-indigo-600" />
                            <span>Estructura Desglosada del Costo por Libra</span>
                        </h3>
                        <span className="text-xs text-slate-500 font-medium">Suma de Factores Unitarios</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(Array.isArray([
                            {
                                label: 'Materia Prima (Huevo Líquido)',
                                value: calculationResult?.breakdown?.mp_cost_per_lb || 0,
                                icon: Package,
                                color: 'text-amber-600',
                                bg: 'bg-amber-50/80',
                                desc: calculationResult?.separation_data?.is_separation_mode
                                    ? `Formulado con MP liquida A y crédito de clara (Ahorro -${formatMoney(calculationResult.separation_data.mp_cost_reduction_per_lb || 0, 2)}/lb)`
                                    : calculationResult?.formulation?.water_added_pct > 0
                                        ? `Base puro ${formatMoney(calculationResult.formulation.pure_egg_cost_per_lb || 0, 2)} (Ahorro -${formatMoney(calculationResult.formulation.mp_cost_savings_per_lb || 0, 2)})`
                                        : 'Huevo cáscara descontando 17% cáscara'
                            },
                            {
                                label: 'Empaque & Etiquetas',
                                value: calculationResult?.breakdown?.packaging_cost_per_lb || 0,
                                icon: Package,
                                color: 'text-blue-600',
                                bg: 'bg-blue-50/80',
                                desc: 'Cubeta, tapa, liner, etiqueta 4x2'
                            },
                            {
                                label: 'Químicos Sanitización CIP',
                                value: calculationResult?.breakdown?.cip_cost_per_lb || 0,
                                icon: Droplets,
                                color: 'text-cyan-600',
                                bg: 'bg-cyan-50/80',
                                desc: `${formatMoney(calculationResult?.breakdown?.cip_total_batch_cost || 50.85, 2)} por batch`
                            },
                            {
                                label: 'Caldera, Vapor & Energía',
                                value: calculationResult?.breakdown?.boiler_energy_cost_per_lb || 0,
                                icon: Flame,
                                color: 'text-orange-600',
                                bg: 'bg-orange-50/80',
                                desc: 'Diesel caldera + Energía + Agua'
                            },
                            {
                                label: 'Mano de Obra Directa (MOD)',
                                value: calculationResult?.breakdown?.mod_cost_per_lb || 0,
                                icon: Users,
                                color: 'text-purple-600',
                                bg: 'bg-purple-50/80',
                                desc: '$0.0500 fijo por libra producida'
                            },
                            {
                                label: 'Gastos Indirectos (GIF)',
                                value: calculationResult?.breakdown?.gif_cost_per_lb || 0,
                                icon: BarChart3,
                                color: 'text-indigo-600',
                                bg: 'bg-indigo-50/80',
                                desc: 'Prorrateo mensual sobre volumen'
                            }
                        ]) ? [
                            {
                                label: 'Materia Prima (Huevo Líquido)',
                                value: calculationResult?.breakdown?.mp_cost_per_lb || 0,
                                icon: Package,
                                color: 'text-amber-600',
                                bg: 'bg-amber-50/80',
                                desc: calculationResult?.separation_data?.is_separation_mode
                                    ? `Formulado con MP LIQUIDA A y crédito de clara (Ahorro -${formatMoney(calculationResult.separation_data.mp_cost_reduction_per_lb || 0, 2)}/lb)`
                                    : calculationResult?.formulation?.water_added_pct > 0
                                        ? `Base puro ${formatMoney(calculationResult.formulation.pure_egg_cost_per_lb || 0, 2)} (Ahorro -${formatMoney(calculationResult.formulation.mp_cost_savings_per_lb || 0, 2)})`
                                        : 'Huevo cáscara descontando 17% cáscara'
                            },
                            {
                                label: 'Empaque & Etiquetas',
                                value: calculationResult?.breakdown?.packaging_cost_per_lb || 0,
                                icon: Package,
                                color: 'text-blue-600',
                                bg: 'bg-blue-50/80',
                                desc: 'Cubeta, tapa, liner, etiqueta 4x2'
                            },
                            {
                                label: 'Químicos Sanitización CIP',
                                value: calculationResult?.breakdown?.cip_cost_per_lb || 0,
                                icon: Droplets,
                                color: 'text-cyan-600',
                                bg: 'bg-cyan-50/80',
                                desc: `${formatMoney(calculationResult?.breakdown?.cip_total_batch_cost || 50.85, 2)} por batch`
                            },
                            {
                                label: 'Caldera, Vapor & Energía',
                                value: calculationResult?.breakdown?.boiler_energy_cost_per_lb || 0,
                                icon: Flame,
                                color: 'text-orange-600',
                                bg: 'bg-orange-50/80',
                                desc: 'Diesel caldera + Energía + Agua'
                            },
                            {
                                label: 'Mano de Obra Directa (MOD)',
                                value: calculationResult?.breakdown?.mod_cost_per_lb || 0,
                                icon: Users,
                                color: 'text-purple-600',
                                bg: 'bg-purple-50/80',
                                desc: '$0.0500 fijo por libra producida'
                            },
                            {
                                label: 'Gastos Indirectos (GIF)',
                                value: calculationResult?.breakdown?.gif_cost_per_lb || 0,
                                icon: BarChart3,
                                color: 'text-indigo-600',
                                bg: 'bg-indigo-50/80',
                                desc: 'Prorrateo mensual sobre volumen'
                            }
                        ] : []).map((item, idx) => {
                            const Icon = item.icon;
                            const total = calculationResult?.breakdown?.total_cost_per_lb || 1;
                            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                            return (
                                <div key={idx} className={`p-3.5 rounded-xl border border-slate-200 ${item.bg}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <Icon className={`w-4 h-4 ${item.color}`} />
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-200 shadow-sm">
                                            {pct}%
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tight line-clamp-1">
                                        {item.label}
                                    </div>
                                    <div className="text-base font-black text-slate-900 mt-0.5">
                                        <Money value={item.value} />
                                        <span className="text-[10px] text-slate-500 font-normal"> /lb</span>
                                    </div>
                                    <div className="text-[9px] text-slate-500 truncate mt-1">
                                        {item.desc}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Matriz Comparativa por Presentación y Empaque (Desplegable para evitar saturación) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                    <div
                        onClick={() => setShowPresentationsMatrixCalc(prev => !prev)}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                    >
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex-shrink-0">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                        Matriz de Costeo por Presentación y Empaque
                                    </h3>
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                        6 formatos
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {showPresentationsMatrixCalc
                                        ? `Costo base líquido sin empaque: ${formatMoney(calculationResult?.breakdown?.base_operating_cost_per_lb || 0, 2)}/lb. Haz clic para ocultar.`
                                        : 'Compara cómo varía el costo por libra según el empaque (Cubetas, Galones, Litros). Haz clic para desplegar.'
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-center">
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                Activo: <strong className="text-indigo-700">{calcParams.presentation}</strong>
                            </span>
                            <button
                                type="button"
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <span>{showPresentationsMatrixCalc ? 'Ocultar' : 'Desplegar'}</span>
                                {showPresentationsMatrixCalc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {showPresentationsMatrixCalc && (
                        <div className="p-6 pt-0 space-y-4 border-t border-slate-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3">
                                <p className="text-xs text-slate-500 font-medium">
                                    Costo base operacional líquido: <strong className="text-indigo-700 font-bold"><Money value={calculationResult?.breakdown?.base_operating_cost_per_lb || 0} /> /lb</strong>. El costo de empaque modifica el costo final por libra y por envase:
                                </p>
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                                    Lote: {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs
                                </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-3 px-3.5">Presentación</th>
                                            <th className="py-3 px-3 text-right">Empaque / Envase</th>
                                            <th className="py-3 px-3 text-right">Empaque / Lb</th>
                                            <th className="py-3 px-3.5 text-right">Costo Total / Lb</th>
                                            <th className="py-3 px-3.5 text-right">Costo / Envase</th>
                                            <th className="py-3 px-3 text-right">Precio Sug. (20% Margen)</th>
                                            <th className="py-3 px-3 text-right">Rendimiento</th>
                                            <th className="py-3 px-3 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {((Array.isArray(calculationResult?.presentations_comparison || []) ? calculationResult?.presentations_comparison || [] : [])).map((row, idx) => {
                                            const isSelected = row.is_current || (calcParams.presentation || '').toLowerCase().includes(row.lbs.toString());
                                            const packPct = row.total_cost_per_lb > 0 ? ((row.packaging_cost_lb / row.total_cost_per_lb) * 100).toFixed(1) : 0;
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
                                                                <span className="text-[10px] text-slate-400 font-medium">{row.lbs} Libras netas</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-medium text-slate-700">
                                                        <div><Money value={row.packaging_cost_unit} /></div>
                                                        <span className="text-[9px] text-slate-400 font-normal">
                                                            Env: <Money value={(row.packaging_breakdown?.container_cost || 0)} /> + Tap: <Money value={(row.packaging_breakdown?.lid_cost || 0)} />
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <div className="font-bold text-blue-700"><Money value={row.packaging_cost_lb} />/lb</div>
                                                        <span className="text-[9px] text-slate-400 font-normal">{packPct}% del costo</span>
                                                    </td>
                                                    <td className="py-3 px-3.5 text-right">
                                                        <span className="font-black text-indigo-950 text-sm">
                                                            <Money value={row.total_cost_per_lb} />
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-normal block">/lb</span>
                                                    </td>
                                                    <td className="py-3 px-3.5 text-right font-black text-slate-900">
                                                        <Money value={row.total_cost_per_unit} />
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <span className="font-black text-emerald-700">
                                                            <Money value={row.suggested_prices?.margin_20?.price_unit || 0} />
                                                        </span>
                                                        <span className="text-[9px] text-slate-500 block font-normal">
                                                            (<Money value={row.suggested_prices?.margin_20?.price_lb || 0} />/lb)
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <span className="font-bold text-slate-800">{row.units_in_batch?.toLocaleString()}</span>
                                                        <span className="text-[10px] text-slate-400 block font-normal">unidades</span>
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
    )}</>);
}
