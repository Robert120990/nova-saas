import { Search, Filter, User, Users, RotateCcw } from 'lucide-react';

const TicketFiltersBar = ({
    search,
    onSearchChange,
    status,
    onStatusChange,
    type,
    onTypeChange,
    priority,
    onPriorityChange,
    mineOnly,
    onMineOnlyChange,
    canManage,
    onReset
}) => {
    return (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Buscar por código (#TKT-0001), asunto, módulo o descripción..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
            </div>

            {/* Selects & Scope */}
            <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                        <button
                            type="button"
                            onClick={() => onMineOnlyChange(false)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                !mineOnly ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Users size={13} /> Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => onMineOnlyChange(true)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                mineOnly ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <User size={13} /> Mis Tickets
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-1.5">
                    <Filter size={14} className="text-slate-400 hidden sm:inline" />
                    <select
                        value={status}
                        onChange={(e) => onStatusChange(e.target.value)}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 bg-slate-50/70 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="">Todos los Estados</option>
                        <option value="abierto">Abiertos</option>
                        <option value="en_proceso">En Proceso</option>
                        <option value="resuelto">Resueltos</option>
                        <option value="cerrado">Cerrados</option>
                    </select>
                </div>

                <select
                    value={type}
                    onChange={(e) => onTypeChange(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 bg-slate-50/70 focus:outline-none focus:border-indigo-500"
                >
                    <option value="">Todos los Tipos</option>
                    <option value="problema">Problema / Error</option>
                    <option value="requerimiento">Requerimiento</option>
                    <option value="mejora">Mejora</option>
                    <option value="consulta">Consulta</option>
                </select>

                <select
                    value={priority}
                    onChange={(e) => onPriorityChange(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 bg-slate-50/70 focus:outline-none focus:border-indigo-500"
                >
                    <option value="">Toda Prioridad</option>
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                </select>

                {(search || status || type || priority || mineOnly) && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Limpiar filtros"
                    >
                        <RotateCcw size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default TicketFiltersBar;
