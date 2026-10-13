import { Search, Calendar, User, RotateCcw } from 'lucide-react';

const STATUS_FILTERS = [
    { value: 'all', label: 'Todas' },
    { value: 'facturada', label: 'Facturadas' },
    { value: 'abierta', label: 'Abiertas' },
    { value: 'en_cocina', label: 'En Cocina' },
    { value: 'cancelada', label: 'Canceladas' }
];

export default function OrderHistoryFiltersBar({
    filters,
    onFilterChange,
    onResetFilters,
    waiters = []
}) {
    return (
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3.5">
            {/* Fila 1: Píldoras de estado y Búsqueda */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                    {STATUS_FILTERS.map((s) => {
                        const isSelected = filters.status === s.value;
                        return (
                            <button
                                key={s.value}
                                type="button"
                                onClick={() => onFilterChange('status', s.value)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </div>

                <div className="relative w-full md:w-72">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => onFilterChange('search', e.target.value)}
                        placeholder="Buscar comanda, mesa, cliente, DTE..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    />
                </div>
            </div>

            {/* Fila 2: Rango de fechas, Mesero y Tipo de comanda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => onFilterChange('startDate', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                        title="Fecha Inicio"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => onFilterChange('endDate', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                        title="Fecha Fin"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <select
                        value={filters.waiterId}
                        onChange={(e) => onFilterChange('waiterId', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white font-medium truncate"
                    >
                        <option value="">Todos los Meseros</option>
                        {waiters.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.nombre || w.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={filters.orderType}
                        onChange={(e) => onFilterChange('orderType', e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-xl border border-slate-200 bg-white font-medium truncate"
                    >
                        <option value="all">Todos los Tipos</option>
                        <option value="mesa">Mesa (Comedor)</option>
                        <option value="para_llevar">Para Llevar</option>
                        <option value="delivery">Delivery / Domicilio</option>
                    </select>

                    <button
                        type="button"
                        onClick={onResetFilters}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
                        title="Restablecer filtros"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
