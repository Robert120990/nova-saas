import { Flame, Settings2, ShoppingCart, RefreshCcw, Droplets, Plus, FileText, Edit2, Trash2, Package } from 'lucide-react';
import Money from '../../ui/Money';

export default function EggCosteoCatalogTab({
    configs,
    setConfigModal,
    handleSyncPurchases,
    syncingPurchases,
    cipItems = [],
    setCipModal,
    handleQuickApplyCipCost,
    handleDeleteCipItem,
    packagingItems = [],
    setPackagingModal,
    handleQuickApplyPackagingCost,
    handleDeletePackagingItem
}) {
    return (
                <div className="space-y-6">
                    {/* Parámetros de Caldera, Vapor & GIF */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <Flame className="w-4 h-4 text-amber-600" />
                                    <span>Parámetros de Caldera, Vapor & Gastos Indirectos (GIF)</span>
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Constantes energéticas y prorrateos de planta para absorción por lote.
                                </p>
                            </div>
                            <button
                                onClick={() => setConfigModal({ open: true, data: { ...configs } })}
                                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-auto"
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                <span>Editar Parámetros de Planta</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Diesel Caldera</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    {configs.boiler_diesel_gal_batch || 20.84} gal
                                </span>
                                <span className="text-[10px] text-slate-400">@ ${configs.boiler_diesel_price_gal || 4.14}/gal</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Electricidad</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${configs.boiler_kwh_cost_batch || 386.00}
                                </span>
                                <span className="text-[10px] text-slate-400">Por batch</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Agua Caldera</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${configs.boiler_water_cost_batch || 17.34}
                                </span>
                                <span className="text-[10px] text-slate-400">Por batch</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Mano de Obra</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${configs.mod_cost_per_lb || 0.0500}
                                </span>
                                <span className="text-[10px] text-slate-400">Por libra</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">GIF Mensual</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${(configs.monthly_gif_total || 24537.00).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400">Total fijo</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Volumen Base</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    {(configs.monthly_projected_lbs || 100000).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400">Libras / mes</span>
                            </div>
                        </div>
                    </div>

                    {/* Banner de Vinculación con Compras y Facturas Ingresadas */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-inner flex-shrink-0">
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 flex-wrap">
                                    <span>Vinculación con Módulo de Compras & Facturación</span>
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        En Tiempo Real
                                    </span>
                                </h4>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Los empaques y químicos CIP están vinculados a los productos del inventario y leen automáticamente el costo unitario de las facturas de compras ingresadas.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSyncPurchases}
                            disabled={syncingPurchases}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all self-start sm:self-auto flex-shrink-0"
                        >
                            <RefreshCcw className={`w-4 h-4 ${syncingPurchases ? 'animate-spin' : ''}`} />
                            <span>{syncingPurchases ? 'Sincronizando...' : 'Sincronizar Costos con Compras'}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Químicos CIP */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                        <Droplets className="w-4 h-4 text-cyan-600" />
                                        <span>Químicos CIP & Sanitización</span>
                                    </h3>
                                    <span className="text-xs text-slate-500 font-medium">Por ciclo de pasteurizador</span>
                                </div>
                                <button
                                    onClick={() => setCipModal({ open: true, data: { status: 'activo' } })}
                                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Agregar Químico</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-2.5 px-3">Químico & Compra</th>
                                            <th className="py-2.5 px-3">Presentación</th>
                                            <th className="py-2.5 px-3 text-right">Costo Pres.</th>
                                            <th className="py-2.5 px-3 text-right">Dosis Batch</th>
                                            <th className="py-2.5 px-3 text-right">Costo/Ciclo</th>
                                            <th className="py-2.5 px-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {cipItems.map((cip) => {
                                            const unitPrice = parseFloat(cip.presentation_cost) / (parseFloat(cip.presentation_qty) || 1);
                                            const cycleCost = unitPrice * (parseFloat(cip.dose_per_batch) || 0);
                                            return (
                                                <tr key={cip.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-slate-900">{cip.item_name}</div>
                                                        {cip.latest_invoice_number ? (
                                                            <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                                                                <span className="inline-flex items-center gap-0.5 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                                                    <FileText className="w-3 h-3 text-indigo-600" />
                                                                    <span>Fac. #{cip.latest_invoice_number}</span>
                                                                </span>
                                                                <span>Compra: <strong className="text-emerald-700 font-bold">${parseFloat(cip.latest_purchase_cost).toFixed(2)}</strong>/ud</span>
                                                                {cip.latest_purchase_date && <span>({new Date(cip.latest_purchase_date).toLocaleDateString()})</span>}
                                                                {cip.latest_provider_name && <span className="text-slate-400">({cip.latest_provider_name})</span>}
                                                                {Math.abs(parseFloat(cip.presentation_cost) - (parseFloat(cip.latest_purchase_cost) * (parseFloat(cip.presentation_qty) || 1))) > 0.01 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleQuickApplyCipCost(cip.id, cip.latest_purchase_cost)}
                                                                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded"
                                                                        title="Actualizar costo de presentación con base en la factura"
                                                                    >
                                                                        Aplicar Factura
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : cip.product_id ? (
                                                            <span className="mt-0.5 inline-block text-[10px] text-slate-400 font-normal">
                                                                Vinculado a {cip.product_code || 'Inventario'} (Sin compras aún)
                                                            </span>
                                                        ) : (
                                                            <span className="mt-0.5 inline-block text-[10px] text-amber-600 font-normal italic">
                                                                Sin vincular a producto
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-600">{cip.presentation_qty} {cip.presentation_unit}</td>
                                                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                                                        <Money value={cip.presentation_cost} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                                                        {cip.dose_per_batch} {cip.dose_unit}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-black text-cyan-700">
                                                        <Money value={cycleCost} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => setCipModal({ open: true, data: cip })}
                                                                className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteCipItem(cip.id)}
                                                                className="p-1 text-slate-500 hover:text-rose-600 rounded"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Empaques */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-emerald-600" />
                                        <span>Catálogo de Materiales & Empaques</span>
                                    </h3>
                                    <span className="text-xs text-slate-500 font-medium">Cubetas, tapaderas, liners y etiquetas</span>
                                </div>
                                <button
                                    onClick={() => setPackagingModal({ open: true, data: { category: 'recipiente' } })}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Agregar Empaque</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse min-w-[550px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-2.5 px-3">Código</th>
                                            <th className="py-2.5 px-3">Descripción & Compra</th>
                                            <th className="py-2.5 px-3">Categoría</th>
                                            <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                                            <th className="py-2.5 px-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {packagingItems.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{p.item_code}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-medium text-slate-900">{p.item_name}</div>
                                                    {p.latest_invoice_number ? (
                                                        <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
                                                            <span className="inline-flex items-center gap-0.5 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                                                <FileText className="w-3 h-3 text-indigo-600" />
                                                                <span>Fac. #{p.latest_invoice_number}</span>
                                                            </span>
                                                            <span>Compra: <strong className="text-emerald-700 font-bold">${parseFloat(p.latest_purchase_cost).toFixed(4)}</strong></span>
                                                            {p.latest_purchase_date && <span>({new Date(p.latest_purchase_date).toLocaleDateString()})</span>}
                                                            {p.latest_provider_name && <span className="text-slate-400">({p.latest_provider_name})</span>}
                                                            {Math.abs(parseFloat(p.unit_cost) - parseFloat(p.latest_purchase_cost)) > 0.0001 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickApplyPackagingCost(p.id, p.latest_purchase_cost)}
                                                                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded"
                                                                    title="Actualizar costo de empaque al valor de la factura"
                                                                >
                                                                    Aplicar Factura
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : p.product_id ? (
                                                        <span className="mt-0.5 inline-block text-[10px] text-slate-400 font-normal">
                                                            Vinculado a {p.product_code || 'Inventario'} (Sin compras aún)
                                                        </span>
                                                    ) : (
                                                        <span className="mt-0.5 inline-block text-[10px] text-amber-600 font-normal italic">
                                                            Sin vincular a producto
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                                        {p.category}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                                    <Money value={p.unit_cost} />
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setPackagingModal({ open: true, data: p })}
                                                            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePackagingItem(p.id)}
                                                            className="p-1 text-slate-500 hover:text-rose-600 rounded"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
    );
}
