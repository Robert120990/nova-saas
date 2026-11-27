import { Search, Calendar, CheckCheck, Ban, SlidersHorizontal, Scale, MinusCircle } from 'lucide-react';
import { getDateRangePreset } from '../../utils/dateUtils';

const QUICK_PRESETS = [
    { id: 'quincena_actual', label: 'Quincena Actual' },
    { id: 'quincena_anterior', label: 'Quincena Anterior' },
    { id: 'mes_actual', label: 'Este Mes' },
    { id: 'mes_anterior', label: 'Mes Anterior' }
];

const BiometricOvertimeFiltersBar = ({
    search,
    onSearchChange,
    employees = [],
    selectedEmployeeKey = 'all',
    onSelectedEmployeeChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    onApplyRange,
    onlyOvertime,
    onOnlyOvertimeChange,
    includeDeficit = false,
    onIncludeDeficitChange,
    onlyNegative = false,
    onOnlyNegativeChange,
    negativeCount = 0,
    negativeHours = 0,
    isFrozenView = false,
    activeSelectedCount = 0,
    isBatchPending = false,
    capValue,
    onCapValueChange,
    onRunBatch,
    onClearSelection
}) => {
    return (
        <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                <div className={`relative ${isFrozenView ? 'lg:col-span-4' : 'lg:col-span-3'}`}>
                    <input
                        type="text"
                        placeholder="Buscar colaborador, código, cargo..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-300 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>

                {onSelectedEmployeeChange && (
                    <div className={isFrozenView ? 'lg:col-span-4' : 'lg:col-span-3'}>
                        <select
                            value={selectedEmployeeKey}
                            onChange={(e) => onSelectedEmployeeChange(e.target.value)}
                            aria-label="Filtrar por colaborador"
                            className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700"
                        >
                            <option value="all">Todos los colaboradores ({employees.length})</option>
                            {employees.map((emp) => (
                                <option key={emp.employee_key} value={emp.employee_key}>
                                    {emp.nombre} [{emp.codigo}]
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {!isFrozenView && (
                    <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
                        <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white" />
                        <span className="text-slate-400 font-bold shrink-0">a</span>
                        <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white" />
                    </div>
                )}

                <div className={`flex items-center gap-3 flex-wrap ${isFrozenView ? 'lg:col-span-4' : 'lg:col-span-2'}`}>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={onlyOvertime} onChange={(e) => onOnlyOvertimeChange(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" />
                        <span className="font-bold text-slate-700 text-xs">Solo con H.E.</span>
                    </label>
                </div>
            </div>

            {/* Toggle de Compensación con Horas en Negativo + Períodos rápidos */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                    {!isFrozenView && onIncludeDeficitChange && (
                        <button
                            type="button"
                            role="switch"
                            aria-checked={includeDeficit}
                            onClick={() => onIncludeDeficitChange(!includeDeficit)}
                            title="Trae jornadas incompletas de L–V en negativo (respetando el umbral de redondeo) para compensarlas contra las horas extra"
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold ${
                                includeDeficit
                                    ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-sm'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-rose-200 hover:bg-rose-50/40'
                            }`}
                        >
                            <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${includeDeficit ? 'bg-rose-600' : 'bg-slate-300'}`}>
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${includeDeficit ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                            </span>
                            <Scale className={`w-3.5 h-3.5 ${includeDeficit ? 'text-rose-600' : 'text-slate-400'}`} />
                            <span>Traer horas en negativo (Compensar)</span>
                            {negativeCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                    {negativeCount} ({Number(negativeHours).toFixed(1)}h)
                                </span>
                            )}
                        </button>
                    )}

                    {onOnlyNegativeChange && (negativeCount > 0 || onlyNegative) && (
                        <button
                            type="button"
                            onClick={() => onOnlyNegativeChange(!onlyNegative)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                                onlyNegative
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                            }`}
                            title="Mostrar únicamente los días con horas en negativo"
                        >
                            <MinusCircle className="w-3.5 h-3.5" />
                            <span>Solo negativos ({negativeCount})</span>
                        </button>
                    )}
                </div>

                {!isFrozenView && onApplyRange && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase mr-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Período:
                        </span>
                        {QUICK_PRESETS.map((preset) => {
                            const pRange = getDateRangePreset(preset.id);
                            const isActive = startDate === pRange.startDate && endDate === pRange.endDate;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => onApplyRange(pRange.startDate, pRange.endDate)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Barra de Aprobación / Compensación Masiva */}
            {activeSelectedCount > 0 && onRunBatch && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="font-bold text-indigo-900">
                        {activeSelectedCount} registro(s) seleccionado(s)
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            disabled={isBatchPending}
                            onClick={() => onRunBatch('approve_clock')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg disabled:opacity-50"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Aplicar Reloj
                        </button>
                        <button
                            type="button"
                            disabled={isBatchPending}
                            onClick={() => onRunBatch('deny_zero')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg disabled:opacity-50"
                            title="Establecer en 0 horas (condonar déficit o denegar horas extra)"
                        >
                            <Ban className="w-3.5 h-3.5" />
                            Condonar / 0h
                        </button>
                        <div className="inline-flex items-center gap-1 bg-white border border-indigo-200 rounded-lg px-2 py-0.5">
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="12"
                                value={capValue}
                                onChange={(e) => onCapValueChange(e.target.value)}
                                className="w-12 text-xs font-bold text-indigo-900 outline-none text-center"
                            />
                            <button
                                type="button"
                                disabled={isBatchPending}
                                onClick={() => onRunBatch('cap_hours', parseFloat(capValue) || 0)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 rounded disabled:opacity-50"
                                title="Limitar las horas extra de los registros seleccionados a este tope máximo"
                            >
                                <SlidersHorizontal className="w-3 h-3" />
                                Tope (h)
                            </button>
                        </div>
                        <button type="button" onClick={onClearSelection} className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-1.5">
                            Limpiar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BiometricOvertimeFiltersBar;
