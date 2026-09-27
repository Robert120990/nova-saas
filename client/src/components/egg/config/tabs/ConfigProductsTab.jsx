

import {
    Save,
    Layers
} from 'lucide-react';


export default function ConfigProductsTab({ model }) {
    const { activeTab, loading, formulationProducts, getWeight, getPct, handleUpdateProduct, handleSaveProduct, handleSaveAllProducts } = model;

    return (<>{activeTab === 'products' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Layers className="h-4 w-4 text-indigo-600" />
                                Peso por Unidad y Rendimientos Estándar de Formulación
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Estos valores se usarán como referencia y sugerencia al envasar y formular cada lote de producción.</p>
                        </div>
                        <button
                            onClick={handleSaveAllProducts}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0"
                        >
                            <Save size={15} />
                            Guardar Toda la Configuración
                        </button>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {loading ? (
                        <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando parámetros...</div>
                    ) : (
                        <div className="space-y-4">
                            {(Array.isArray(formulationProducts) ? formulationProducts : []).map(p => (
                                <div key={p.type} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800 capitalize">{p.label}</span>
                                        <button
                                            onClick={() => handleSaveProduct(p.type)}
                                            className="px-3 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-all shadow-xs"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Peso/Unidad (lb)</span>
                                            <input
                                                type="number"
                                                value={getWeight(p.type)}
                                                onChange={(e) => handleUpdateProduct(p.type, 'weight_per_unit_lbs', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Rendimiento %</span>
                                            <input
                                                type="number"
                                                value={getPct(p.type, 'yield_pct')}
                                                onChange={(e) => handleUpdateProduct(p.type, 'yield_pct', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-emerald-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-amber-700 uppercase block">Cáscara %</span>
                                            <input
                                                type="number"
                                                value={getPct(p.type, 'waste_shell_pct')}
                                                onChange={(e) => handleUpdateProduct(p.type, 'waste_shell_pct', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-amber-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-rose-700 uppercase block">Merma %</span>
                                            <input
                                                type="number"
                                                value={getPct(p.type, 'waste_loss_pct')}
                                                onChange={(e) => handleUpdateProduct(p.type, 'waste_loss_pct', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-rose-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}</>);
}
