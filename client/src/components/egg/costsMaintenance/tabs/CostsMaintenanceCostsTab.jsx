import { formatDate } from '../../../../utils/dateUtils';
import Money from '../../../ui/Money';
import {
    Plus,
    DollarSign,
    Calendar
} from 'lucide-react';


export default function CostsMaintenanceCostsTab({ model }) {
    const { batches, activeTab, profitMarginPercent, dateStart, setDateStart, dateEnd, setDateEnd, openVariableCosts, getTotalFixedCost } = model;

    return (<>{activeTab === 'costs' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-teal-600" />
                                <span>Centro de Costos de Producción</span>
                            </h2>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-slate-500" />
                                <input
                                    type="date"
                                    value={dateStart}
                                    onChange={(e) => setDateStart(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <span className="text-slate-400 text-xs">a</span>
                                <input
                                    type="date"
                                    value={dateEnd}
                                    onChange={(e) => setDateEnd(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Costo Fijo Base</span>
                                <span className="text-sm font-black text-amber-700 block mt-1">
                                    <Money value={getTotalFixedCost()} />
                                </span>
                            </div>
                            {(() => {
                                const filtered = batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59');
                                const totalYield = filtered.reduce((s, b) => s + parseFloat(b.yield_liquid_lbs || 0), 0);
                                const totalVar = filtered.reduce((s, b) => s + (b.variable_costs || []).reduce((ss, c) => ss + parseFloat(c.amount || 0), 0), 0);
                                const totalAll = getTotalFixedCost() * filtered.length + totalVar;
                                const totalWasteLbs = filtered.reduce((s, b) => s + parseFloat(b.waste_shell_lbs || 0) + parseFloat(b.waste_loss_lbs || 0), 0);
                                return (
                                    <>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Lotes Procesados</span>
                                            <span className="text-sm font-black text-slate-900 block mt-1">{filtered.length}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Rendimiento Líquido</span>
                                            <span className="text-sm font-black text-teal-700 block mt-1">{totalYield.toLocaleString()} Lbs</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Merma de Cáscara</span>
                                            <span className="text-sm font-black text-rose-700 block mt-1">{totalWasteLbs.toLocaleString()} Lbs</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Costo Total Acumulado</span>
                                            <span className="text-sm font-black text-amber-700 block mt-1">
                                                <Money value={totalAll} />
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">Costo Promedio / Lb</span>
                                            <span className="text-sm font-black text-indigo-700 block mt-1">
                                                <Money value={totalYield > 0 ? totalAll / totalYield : 0} />
                                            </span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59').length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-semibold shadow-sm">
                            No hay lotes finalizados en el rango de fechas seleccionado.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="px-4 py-3">Producto</th>
                                        <th className="px-3 py-3">Fecha Fin</th>
                                        <th className="px-3 py-3 text-right">Rendimiento</th>
                                        <th className="px-3 py-3 text-right">Merma</th>
                                        <th className="px-3 py-3 text-right">Costo Total</th>
                                        <th className="px-3 py-3 text-right">Costo / Lb</th>
                                        <th className="px-3 py-3 text-right">Precio Sugerido</th>
                                        <th className="px-3 py-3 text-right">Venta Total</th>
                                        <th className="px-3 py-3 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {(Array.isArray(batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59').sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))) ? batches.filter(b => b.completed_at && b.completed_at >= dateStart && b.completed_at <= dateEnd + 'T23:59:59').sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)) : []).map(b => {
                                        const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
                                        const inputLbs = parseFloat(b.input_weight_lbs || 1);
                                        const wasteShell = parseFloat(b.waste_shell_lbs || 0);
                                        const wasteLoss = parseFloat(b.waste_loss_lbs || 0);
                                        const fixedTotal = getTotalFixedCost();
                                        const varTotal = (b.variable_costs || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
                                        const totalCost = fixedTotal + varTotal;
                                        const costPerLb = yieldLbs > 0 ? totalCost / yieldLbs : 0;
                                        const shellCost = (wasteShell / inputLbs) * totalCost;
                                        const lossCost = (wasteLoss / inputLbs) * totalCost;
                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs capitalize">{b.product_type}</span>
                                                        <span className="text-[10px] text-slate-500">{b.presentation}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-[11px] text-slate-600 font-medium">
                                                    {formatDate(b.completed_at)}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-teal-700 text-xs">{yieldLbs.toLocaleString()} Lbs</span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[11px] text-slate-600 font-medium">{(wasteShell + wasteLoss).toLocaleString()} Lbs</span>
                                                        <span className="text-[9px] text-rose-600 font-bold">
                                                            <Money value={shellCost + lossCost} />
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-bold text-amber-700 text-xs">
                                                            <Money value={totalCost} />
                                                        </span>
                                                        {varTotal > 0 && (
                                                            <span className="text-[9px] text-indigo-600 font-bold">
                                                                +<Money value={varTotal} /> var
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-indigo-700 text-xs">
                                                        <Money value={costPerLb} />
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-teal-700 text-xs">
                                                        <Money value={costPerLb / (1 - (profitMarginPercent / 100))} />
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <span className="font-bold text-emerald-700 text-xs">
                                                        <Money value={(costPerLb / (1 - (profitMarginPercent / 100))) * yieldLbs} />
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <button
                                                        onClick={() => openVariableCosts(b)}
                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                                        title="Agregar costos variables"
                                                    >
                                                        <Plus size={11} />
                                                        <span>Variables</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}</>);
}
