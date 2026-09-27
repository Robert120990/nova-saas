import {
    Boxes,
    RefreshCw,
    FileText,
    FileSpreadsheet,
    Layers,
    ListFilter
} from 'lucide-react';


export default function InventoryHeader({ model }) {
    const { loading, unitOfMeasure, setUnitOfMeasure, viewMode, setViewMode, fetchInventory, handleExport } = model;

    return (<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Boxes size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                                Inventario Industrial Traducido
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Conversión de existencias por tipo de producto y peso (Lbs / Kg) para CRM y Gestión de Pedidos
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones, Botones de Exportar y selector de unidad */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Botones Oficiales de Reporte: PDF y Excel */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleExport('pdf')}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                            title="Descargar Reporte de Inventario en PDF"
                        >
                            <FileText size={15} />
                            <span>PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExport('excel')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                            title="Exportar Inventario a Excel"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Excel</span>
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    {/* Toggle de Modo de Visualización */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewMode('mapping')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                viewMode === 'mapping'
                                    ? 'bg-white text-indigo-600 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Layers size={14} />
                            <span>Vinculación de Producto</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('detail')}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                                viewMode === 'detail'
                                    ? 'bg-white text-indigo-600 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <ListFilter size={14} />
                            <span>Por Código</span>
                        </button>
                    </div>

                    {/* Toggle de Unidad de Medida */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('lbs')}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'lbs'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Lbs
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('kg')}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'kg'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Kg
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('units')}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'units'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Unidades
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchInventory}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        title="Actualizar existencias"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>);
}
