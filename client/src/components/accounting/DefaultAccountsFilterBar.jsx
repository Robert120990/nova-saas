import { Search, X, Layers, Fuel, CreditCard, ShoppingCart, ShoppingBag, Sliders } from 'lucide-react';
import { ACCOUNT_CATEGORIES } from './defaultAccountsConfig';

const CATEGORY_ICONS = {
    all: Layers,
    turnos: Fuel,
    tarjetas: CreditCard,
    ventas: ShoppingCart,
    compras: ShoppingBag,
    custom: Sliders,
};

const STATUS_FILTERS = [
    { id: 'all', label: 'Todas' },
    { id: 'configured', label: 'Asignadas' },
    { id: 'pending', label: 'Pendientes' },
];

const DefaultAccountsFilterBar = ({
    selectedCategory,
    onSelectCategory,
    categoryStats,
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange
}) => {
    return (
        <div className="space-y-3 min-w-0">
            {/* Pestañas Horizontales por Módulo */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {ACCOUNT_CATEGORIES.map(cat => {
                    const Icon = CATEGORY_ICONS[cat.id] || Layers;
                    const isSelected = selectedCategory === cat.id;
                    const st = categoryStats[cat.id] || { total: 0, configured: 0 };
                    const isComplete = st.total > 0 && st.configured === st.total;

                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => onSelectCategory(cat.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                isSelected
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                            }`}
                        >
                            <Icon size={13} className={isSelected ? 'text-white' : 'text-slate-400'} />
                            <span>{cat.label}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                                isSelected
                                    ? 'bg-white/20 text-white'
                                    : isComplete
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-200/70 text-slate-600'
                            }`}>
                                {st.configured}/{st.total}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Barra de Filtros y Búsqueda Rápida */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 min-w-0">
                <div className="relative flex-1 min-w-0">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        placeholder="Buscar por nombre, clave técnica o cuenta..."
                        className="w-full pl-8 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => onSearchChange('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                    <span className="text-[10px] font-black uppercase text-slate-400 mr-1 hidden md:inline">Estado:</span>
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => onStatusFilterChange(f.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                statusFilter === f.id
                                    ? 'bg-white text-slate-800 shadow-2xs border border-slate-200'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DefaultAccountsFilterBar;
