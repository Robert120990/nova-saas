import {
    Search
} from 'lucide-react';


export default function InventoryActionBar({ model }) {
    const { inventoryData, searchTerm, setSearchTerm, selectedType, setSelectedType, viewMode, productTypes } = model;

    return (<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por código, producto o vinculación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                {viewMode === 'detail' && productTypes.length > 0 && (
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            Filtrar Tipo:
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedType('todos')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                                selectedType === 'todos'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            Todos ({inventoryData.items?.length || 0})
                        </button>
                        {(Array.isArray(productTypes) ? productTypes : []).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setSelectedType(t)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors whitespace-nowrap ${
                                    selectedType === t
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                )}
            </div>);
}
