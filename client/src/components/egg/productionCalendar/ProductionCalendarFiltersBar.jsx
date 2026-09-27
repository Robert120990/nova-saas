import {
    ChevronLeft,
    ChevronRight,
    Search,
    RefreshCw,
    List,
    CalendarDays
} from 'lucide-react';




export default function ProductionCalendarFiltersBar({ model }) {
    const { PRODUCT_PROFILES, calendarView, setCalendarView, currentDate, setCurrentDate, loading, searchTerm, setSearchTerm, statusFilter, setStatusFilter, profileFilter, setProfileFilter, fetchProductions, monthNames } = model;

    return (<div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
                {/* Selector de Mes / Navegación */}
                <div className="flex items-center justify-between sm:justify-start gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(d.getMonth() - 1);
                            setCurrentDate(d);
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Mes Anterior"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
                    >
                        Hoy
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(d.getMonth() + 1);
                            setCurrentDate(d);
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                        title="Mes Siguiente"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <h2 className="text-sm sm:text-base font-bold text-slate-900 ml-1">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                </div>

                {/* Vistas (Mes / Semana / Lista) y Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Búsqueda */}
                    <div className="relative flex-1 sm:w-48">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar lote, operario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    {/* Filtro Perfil */}
                    <select
                        value={profileFilter}
                        onChange={(e) => setProfileFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
                    >
                        <option value="todos">Todos los perfiles</option>
                        {(Array.isArray(PRODUCT_PROFILES) ? PRODUCT_PROFILES : []).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    {/* Filtro Estado */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none"
                    >
                        <option value="todos">Todos los estados</option>
                        <option value="programado">Programado</option>
                        <option value="en_preparacion">En Preparación</option>
                        <option value="en_proceso">En Proceso</option>
                        <option value="completado">Completado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>

                    {/* Switcher de Vista */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
                        <button
                            type="button"
                            onClick={() => setCalendarView('month')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${calendarView === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Mes</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCalendarView('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${calendarView === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <List className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Lista / Agenda</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={fetchProductions}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>);
}
