import { Search, Calendar } from 'lucide-react';
import { getDateRangePreset } from '../../utils/dateUtils';

const QUICK_PRESETS = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'quincena_actual', label: 'Quincena Actual' },
    { id: 'quincena_anterior', label: 'Quincena Anterior' },
    { id: 'mes_actual', label: 'Este Mes' },
    { id: 'mes_anterior', label: 'Mes Anterior' }
];

const BiometricFiltersBar = ({
    searchTerm,
    onSearchChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    onApplyRange,
    punchType,
    onPunchTypeChange,
    source,
    onSourceChange
}) => {
    const handlePresetClick = (presetId) => {
        const range = getDateRangePreset(presetId);
        if (onApplyRange) {
            onApplyRange(range.startDate, range.endDate);
        } else {
            onStartDateChange(range.startDate);
            onEndDateChange(range.endDate);
        }
    };

    return (
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                {/* Search */}
                <div className="relative lg:col-span-4">
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
                <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <span className="text-slate-400 text-xs font-bold shrink-0">a</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                {/* Punch Type Filter */}
                <div className="lg:col-span-2">
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
                <div className="lg:col-span-2">
                    <select
                        value={source}
                        onChange={(e) => onSourceChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                        <option value="todos">Todos los Orígenes</option>
                        <option value="biometrico">Reloj Biométrico</option>
                        <option value="zk_import">Archivos ZK (.xls)</option>
                        <option value="manual">Marcación Manual</option>
                    </select>
                </div>
            </div>

            {/* Accesos rápidos de período */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mr-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Período rápido:
                </span>
                {QUICK_PRESETS.map((preset) => {
                    const pRange = getDateRangePreset(preset.id);
                    const isActive = startDate === pRange.startDate && endDate === pRange.endDate;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => handlePresetClick(preset.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                isActive
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                            }`}
                        >
                            {preset.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BiometricFiltersBar;
