import { Package, FlaskConical, Sparkles, DollarSign, Search, AlertTriangle } from 'lucide-react';
import Money from '../../ui/Money';

export default function SuppliesSummaryCards({ model }) {
    const {
        summary,
        categoryFilter,
        setCategoryFilter,
        stockFilter,
        setStockFilter,
        searchTerm,
        setSearchTerm
    } = model;

    return (
        <div className="space-y-4">
            {/* Tarjetas KPI por Categoría y Valor Total */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Material de Empaque */}
                <div
                    onClick={() => setCategoryFilter(categoryFilter === 'empaque' ? 'all' : 'empaque')}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all shadow-sm flex items-center justify-between ${
                        categoryFilter === 'empaque'
                            ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:border-indigo-300'
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                            Material de Empaque
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-600">
                                {summary.empaque_count}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                insumos
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 block">
                            Valor: <Money value={summary.empaque_value} className="text-indigo-700 font-black" />
                        </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-indigo-100/80 text-indigo-600 shrink-0">
                        <Package className="h-6 w-6" />
                    </div>
                </div>

                {/* 2. Ingredientes y Aditivos */}
                <div
                    onClick={() => setCategoryFilter(categoryFilter === 'aditivo' ? 'all' : 'aditivo')}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all shadow-sm flex items-center justify-between ${
                        categoryFilter === 'aditivo'
                            ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200 hover:border-amber-300'
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                            Ingredientes y Aditivos
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-amber-600">
                                {summary.aditivo_count}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                insumos
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 block">
                            Valor: <Money value={summary.aditivo_value} className="text-amber-700 font-black" />
                        </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-100/80 text-amber-600 shrink-0">
                        <FlaskConical className="h-6 w-6" />
                    </div>
                </div>

                {/* 3. Químicos CIP y Sanitización */}
                <div
                    onClick={() => setCategoryFilter(categoryFilter === 'quimico_cip' ? 'all' : 'quimico_cip')}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all shadow-sm flex items-center justify-between ${
                        categoryFilter === 'quimico_cip'
                            ? 'bg-cyan-50/90 border-cyan-400 ring-2 ring-cyan-500/20'
                            : 'bg-white border-slate-200 hover:border-cyan-300'
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                            Químicos CIP y Sanitización
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-cyan-600">
                                {summary.quimico_cip_count}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                químicos
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 block">
                            Valor: <Money value={summary.quimico_cip_value} className="text-cyan-700 font-black" />
                        </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-cyan-100/80 text-cyan-600 shrink-0">
                        <Sparkles className="h-6 w-6" />
                    </div>
                </div>

                {/* 4. Valor Total Inventario y Alertas */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">
                                Valor Total Inventario Insumos
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                                <Money value={summary.total_inventory_value} />
                            </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/10 text-indigo-200 shrink-0">
                            <DollarSign className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-amber-300 flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Bajo Stock: {summary.low_stock_count}
                        </span>
                        <span className="text-rose-300">
                            Agotados: {summary.out_of_stock_count}
                        </span>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros de Categoría, Estado de Stock y Búsqueda */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Filtros de Categoría */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {[
                        { key: 'all', label: `Todos (${summary.total_items})` },
                        { key: 'empaque', label: `Empaques (${summary.empaque_count})` },
                        { key: 'aditivo', label: `Aditivos (${summary.aditivo_count})` },
                        { key: 'quimico_cip', label: `Químicos CIP (${summary.quimico_cip_count})` }
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setCategoryFilter(tab.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                categoryFilter === tab.key
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filtros de Estado de Stock y Búsqueda */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {[
                            { key: 'all', label: 'Todo Stock' },
                            { key: 'ok', label: `Óptimos (${summary.optimal_stock_count})` },
                            { key: 'low', label: `Bajo Stock (${summary.low_stock_count})` },
                            { key: 'out', label: `Agotados (${summary.out_of_stock_count})` }
                        ].map((sf) => (
                            <button
                                key={sf.key}
                                type="button"
                                onClick={() => setStockFilter(sf.key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    stockFilter === sf.key
                                        ? 'bg-white text-indigo-600 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {sf.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 sm:w-52 min-w-[170px]">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar insumo o código..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
