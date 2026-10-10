

import {
    Settings,
    Layers,
    DollarSign,
    Tag,
    Barcode
} from 'lucide-react';


export default function ConfigHeader({ model }) {
    const { activeTab, handleTabChange } = model;

    return (<div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600 shrink-0">
                        <Settings className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">Configuración de Parámetros</h1>
                        <p className="text-xs text-slate-500 font-medium">Costos operativos, prefijos de lotes y rendimientos estándar</p>
                    </div>
                </div>

                {/* Navigation Pills */}
                <div className="flex flex-wrap gap-1 sm:gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 w-full sm:w-auto">
                    <button
                        onClick={() => handleTabChange('costs')}
                        className={`flex-1 sm:flex-initial justify-center px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'costs'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <DollarSign size={14} />
                        Costos y Planillas
                    </button>
                    <button
                        onClick={() => handleTabChange('lot-prefixes')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'lot-prefixes'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <Tag size={14} />
                        Prefijos de Lote por Proveedor
                    </button>
                    <button
                        onClick={() => handleTabChange('products')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'products'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <Layers size={14} />
                        Rendimientos de Producto
                    </button>
                    <button
                        onClick={() => handleTabChange('code-mappings')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'code-mappings'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <Barcode size={14} />
                        Vinculación de Códigos
                    </button>
                </div>
            </div>);
}
