

import {
    Settings,
    Layers,
    DollarSign,
    Tag,
    Barcode
} from 'lucide-react';


export default function ConfigHeader({ model }) {
    const { activeTab, handleTabChange } = model;

    return (<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Settings className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configuración de Parámetros de Planta</h1>
                        <p className="text-xs text-slate-500 font-medium">Costos operativos con planillas RRHH, prefijos de lotes por proveedor y rendimientos estándar</p>
                    </div>
                </div>

                {/* Navigation Pills */}
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                    <button
                        onClick={() => handleTabChange('costs')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'costs'
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
