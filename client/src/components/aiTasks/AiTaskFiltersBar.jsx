import { Search, Plus, Filter, RotateCcw } from 'lucide-react';

const AiTaskFiltersBar = ({
    search,
    onSearchChange,
    status,
    onStatusChange,
    priority,
    onPriorityChange,
    agentCode,
    onAgentCodeChange,
    onOpenNewTask,
    onResetFilters
}) => {
    return (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search box */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Buscar por objetivo, prompt o título..."
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 focus:bg-white transition-all text-xs font-medium text-slate-800"
                    />
                </div>

                {/* Primary Action Button */}
                <button
                    onClick={onOpenNewTask}
                    className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 whitespace-nowrap"
                >
                    <Plus size={16} />
                    <span>Nueva Tarea Agéntica</span>
                </button>
            </div>

            {/* Filter pills and dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-1 text-slate-400 mr-1 font-bold text-[11px] uppercase">
                    <Filter size={13} />
                    <span>Filtros:</span>
                </div>

                {/* Status Dropdown */}
                <select
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400"
                >
                    <option value="todos">Todos los Estados</option>
                    <option value="pendiente">Pendiente (En Cola)</option>
                    <option value="analizando">Analizando</option>
                    <option value="en_proceso">En Proceso</option>
                    <option value="completada">Completada</option>
                    <option value="fallida">Fallida</option>
                    <option value="cancelada">Cancelada</option>
                </select>

                {/* Priority Dropdown */}
                <select
                    value={priority}
                    onChange={(e) => onPriorityChange(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400"
                >
                    <option value="todas">Todas las Prioridades</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                </select>

                {/* Agent Dropdown */}
                <select
                    value={agentCode}
                    onChange={(e) => onAgentCodeChange(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400"
                >
                    <option value="todos">Todos los Agentes</option>
                    <option value="supervisor">👑 Supervisor</option>
                    <option value="dte">⚡ Fiscal & DTE</option>
                    <option value="accounting">⚖️ Contador CPA</option>
                    <option value="inventory">📦 Inventario</option>
                    <option value="gas">⛽ Combustibles</option>
                    <option value="sales">📈 Ventas</option>
                    <option value="tech">🛠️ SysAdmin</option>
                    <option value="support">🎫 Soporte & Tickets</option>
                </select>

                {/* Reset button if any filter is active */}
                {(status !== 'todos' || priority !== 'todas' || agentCode !== 'todos' || search) && (
                    <button
                        onClick={onResetFilters}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors ml-auto"
                        title="Limpiar todos los filtros"
                    >
                        <RotateCcw size={12} />
                        <span>Restablecer</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default AiTaskFiltersBar;
