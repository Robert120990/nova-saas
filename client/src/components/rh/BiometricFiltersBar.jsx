import { Search } from 'lucide-react';

const BiometricFiltersBar = ({
    searchTerm,
    onSearchChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    punchType,
    onPunchTypeChange,
    source,
    onSourceChange
}) => {
    return (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative lg:col-span-2">
                    <input
                        type="text"
                        placeholder="Buscar por empleado, código o UID..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <span className="text-slate-400 text-xs font-bold">a</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                {/* Punch Type Filter */}
                <div>
                    <select
                        value={punchType}
                        onChange={(e) => onPunchTypeChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                        <option value="todos">Todos los Tipos</option>
                        <option value="entrada">Entradas</option>
                        <option value="salida">Salidas</option>
                        <option value="salida_almuerzo">Salida Almuerzo</option>
                        <option value="entrada_almuerzo">Regreso Almuerzo</option>
                    </select>
                </div>

                {/* Source Filter */}
                <div>
                    <select
                        value={source}
                        onChange={(e) => onSourceChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                        <option value="todos">Todos los Orígenes</option>
                        <option value="biometrico">Reloj Biométrico</option>
                        <option value="manual">Marcación Manual</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default BiometricFiltersBar;
