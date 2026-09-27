import {
    RefreshCcw,
    Package,
    Factory,
    Scale,
    ShoppingCart,
    ArrowDownRight
} from 'lucide-react';
import Money from '../../ui/Money';




export default function CosteoPorLibraContent({ model }) {
    const { loadingOperational, handleApplyRealPlantData, opSummary, opBreakdown } = model;

    return (<div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-indigo-800/40">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                            <Factory className="w-4 h-4 text-emerald-400" />
                            <span>Monitoreo Operativo en Tiempo Real</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            <span>Costo Actual de Planta (Entradas, Producción & Ventas)</span>
                            {loadingOperational && <RefreshCcw className="w-4 h-4 animate-spin text-indigo-300" />}
                        </h2>
                        <p className="text-xs text-indigo-200/80 mt-0.5">
                            Calculado dinámicamente según las compras de huevo cáscara, rendimiento real de quebrado y contratos de venta.
                        </p>
                    </div>
                    <button
                        onClick={handleApplyRealPlantData}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all self-start lg:self-auto"
                    >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Cargar Parámetros Reales al Simulador</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-5">
                    {/* 1. Entradas / Recepción */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-400" />
                                Entradas MP
                            </span>
                            <span className="text-[10px] text-slate-400">{opSummary.total_receptions || 0} envíos</span>
                        </div>
                        <div className="text-xl font-black text-white mt-1">
                            <Money value={opSummary.real_box_cost ? opSummary.real_box_cost.toFixed(2) : '38.00'} />
                            <span className="text-xs font-normal text-indigo-300"> /caja</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            {opSummary.total_lbs_received ? opSummary.total_lbs_received.toLocaleString() : 0} lbs recibidas
                        </div>
                    </div>

                    {/* 2. Producción / Rendimiento Real */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span className="flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                                Rend. Quebrado
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                                {opSummary.actual_yield_pct ? opSummary.actual_yield_pct.toFixed(1) : '83.0'}% Real
                            </span>
                        </div>
                        <div className="text-xl font-black text-white mt-1">
                            {opSummary.actual_shell_pct ? opSummary.actual_shell_pct.toFixed(1) : '17.0'}%
                            <span className="text-xs font-normal text-indigo-300"> Merma Cáscara</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            {opSummary.total_batches || 0} lotes procesados
                        </div>
                    </div>

                    {/* 3. Ventas / Precio Promedio */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span className="flex items-center gap-1.5">
                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                                Venta Pactada
                            </span>
                            <span className="text-[10px] text-slate-400">Promedio</span>
                        </div>
                        <div className="text-xl font-black text-emerald-400 mt-1">
                            <Money value={opSummary.avg_sale_price_per_lb ? opSummary.avg_sale_price_per_lb.toFixed(2) : '1.25'} />
                            <span className="text-xs font-normal text-indigo-300"> /lb</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            {opSummary.total_contract_volume ? opSummary.total_contract_volume.toLocaleString() : '100,000'} lbs/mes
                        </div>
                    </div>

                    {/* 4. COSTO ACTUAL REAL */}
                    <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-emerald-300 text-[11px] font-black uppercase mb-1">
                            <span>Costo Actual / Lb</span>
                            <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded">EN VIVO</span>
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                            <Money value={opBreakdown.total_actual_cost_per_lb ? opBreakdown.total_actual_cost_per_lb.toFixed(2) : '1.50'} />
                            <span className="text-xs font-normal text-emerald-300"> /lb</span>
                        </div>
                        <div className="text-[10px] text-emerald-200/70 mt-1">
                            Base {opBreakdown.volume_basis_lbs ? opBreakdown.volume_basis_lbs.toLocaleString() : '100,000'} lbs
                        </div>
                    </div>

                    {/* 5. Margen Actual Real */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span>Margen Real</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${(opBreakdown.actual_margin_pct || 0) >= 15 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                {opBreakdown.actual_margin_pct ? opBreakdown.actual_margin_pct.toFixed(1) : '0.0'}%
                            </span>
                        </div>
                        <div className={`text-xl font-black mt-1 ${(opBreakdown.actual_margin_per_lb || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                            <Money value={opBreakdown.actual_margin_per_lb ? opBreakdown.actual_margin_per_lb.toFixed(2) : '0.00'} />
                            <span className="text-xs font-normal text-indigo-300"> /lb utilidad</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            Frente a ventas reales
                        </div>
                    </div>
                </div>
            </div>);
}
