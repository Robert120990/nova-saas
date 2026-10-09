import {
    Boxes,
    Package,
    Layers,
    TrendingDown,
    RefreshCw,
    FileText,
    FileSpreadsheet
} from 'lucide-react';

export default function InventoryHeader({ model }) {
    const {
        loading,
        activeTab,
        setActiveTab,
        unitOfMeasure,
        setUnitOfMeasure,
        fetchInventory,
        handleExport
    } = model;

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* Top row: Title and global actions */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                            <Boxes size={24} />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                                Inventario de Planta Industrial
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Control de existencias de materia prima, producto terminado por presentación y registro de mermas
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones: PDF, Excel, Selector de Unidad y Refresco */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Botones de Exportar */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => handleExport('pdf')}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                            title="Descargar Reporte en PDF"
                        >
                            <FileText size={15} />
                            <span>PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExport('excel')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                            title="Exportar a Excel"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Excel</span>
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    {/* Toggle de Unidad de Medida */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setUnitOfMeasure('lbs')}
                            className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                                unitOfMeasure === 'lbs'
                                    ? 'bg-blue-600 text-white shadow-xs'
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
                                    ? 'bg-blue-600 text-white shadow-xs'
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
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Unidades
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchInventory}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        title="Actualizar inventario"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Bottom row: Primary Navigation Tabs */}
            <div className="border-t border-slate-100 pt-3 flex items-center gap-2 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('finished_product')}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'finished_product'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                    }`}
                >
                    <Package size={17} />
                    <span>Producto Terminado (x Presentación)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('raw_material')}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'raw_material'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                    }`}
                >
                    <Layers size={17} />
                    <span>Materia Prima (Lotes y Tarimas)</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('wastes')}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'wastes'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                    }`}
                >
                    <TrendingDown size={17} />
                    <span>Mermas y Desperdicios</span>
                </button>
            </div>
        </div>
    );
}
