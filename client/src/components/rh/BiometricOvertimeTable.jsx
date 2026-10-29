import { Search, Edit3, Calendar } from 'lucide-react';
import Table from '../ui/Table';
import { formatDate, formatDecimalHours, getDateRangePreset } from '../../utils/dateUtils';

const QUICK_PRESETS = [
    { id: 'quincena_actual', label: 'Quincena Actual' },
    { id: 'quincena_anterior', label: 'Quincena Anterior' },
    { id: 'mes_actual', label: 'Este Mes' },
    { id: 'mes_anterior', label: 'Mes Anterior' }
];

const BiometricOvertimeTable = ({
    rows,
    isLoading,
    search,
    onSearchChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    onApplyRange,
    onlyOvertime,
    onOnlyOvertimeChange,
    isFrozenView,
    onOpenEdit
}) => {
    const safeRows = Array.isArray(rows) ? rows : [];

    const headers = [
        { label: 'Fecha', sortKey: 'fecha', sortType: 'date' },
        { label: 'Colaborador', sortKey: 'nombre', sortType: 'string' },
        { label: 'Cargo / Depto', sortKey: 'departamento', sortType: 'string' },
        { label: 'Entrada', sortKey: 'entrada', sortType: 'string' },
        { label: 'Salida', sortKey: 'salida', sortType: 'string' },
        { label: 'Horas Lab.', sortKey: 'horas_trabajadas', sortType: 'number', className: 'text-right' },
        { label: 'Tardanza', sortKey: 'minutos_tardanza', sortType: 'number', className: 'text-right' },
        { label: 'H.E. Reloj', sortKey: 'horas_extra_calculadas', sortType: 'number', className: 'text-right' },
        { label: 'H.E. Aprobadas', sortKey: 'horas_extra_aprobadas', sortType: 'number', className: 'text-right' },
        { label: 'Observación', sortKey: 'observacion', sortType: 'string' },
        { label: 'Acciones', className: 'text-center', sortable: false }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Barra de Filtros */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                    <div className="relative lg:col-span-4">
                        <input
                            type="text"
                            placeholder="Buscar colaborador, código, cargo..."
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full text-xs font-medium border border-slate-300 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>

                    {!isFrozenView && (
                        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                                className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white"
                            />
                            <span className="text-slate-400 font-bold shrink-0">a</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                                className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2 lg:col-span-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={onlyOvertime}
                                onChange={(e) => onOnlyOvertimeChange(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="font-bold text-slate-700 text-xs">
                                Solo registros con Horas Extra
                            </span>
                        </label>
                    </div>
                </div>

                {!isFrozenView && onApplyRange && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
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
                                    onClick={() => onApplyRange(pRange.startDate, pRange.endDate)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
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

            {/* Tabla con Ordenamiento por Columna */}
            <Table
                headers={headers}
                data={safeRows}
                isLoading={isLoading}
                emptyMessage="No se encontraron registros de asistencia/horas para el rango seleccionado."
                renderRow={(r, idx) => (
                    <tr key={`${r.device_uid}-${r.fecha}-${idx}`} className="hover:bg-slate-50/80 transition-colors text-xs text-slate-700">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-medium">
                            {formatDate(r.fecha)}
                            {r.es_festivo && (
                                <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.5 rounded">
                                    Festivo
                                </span>
                            )}
                        </td>
                        <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block">{r.nombre}</span>
                            <span className="text-[10px] text-slate-400 font-mono">[{r.codigo}]</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            <span>{r.cargo}</span>
                            <span className="block text-[10px] text-slate-400">{r.departamento}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{r.entrada || '---'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{r.salida || '---'}</td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-800">
                            {r.horas_trabajadas > 0 ? (
                                <div>
                                    <span className="font-bold text-slate-800 block">{formatDecimalHours(r.horas_trabajadas)}</span>
                                    <span className="text-[10px] text-slate-400 font-normal block">
                                        ({r.horas_trabajadas.toFixed(2)} h)
                                    </span>
                                </div>
                            ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right">
                            {r.es_llegada_tarde ? (
                                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                    {r.minutos_tardanza} min
                                </span>
                            ) : (
                                <span className="text-slate-300">—</span>
                            )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right text-slate-500">
                            {r.horas_extra_calculadas > 0 ? (
                                <div>
                                    <span className="font-bold text-indigo-900 block">{formatDecimalHours(r.horas_extra_calculadas)}</span>
                                    <span className="text-[10px] text-slate-400 font-normal block">
                                        ({r.horas_extra_calculadas.toFixed(2)} h)
                                    </span>
                                </div>
                            ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-right bg-indigo-50/50">
                            {r.horas_extra_aprobadas > 0 ? (
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            +{formatDecimalHours(r.horas_extra_aprobadas)}
                                        </span>
                                        {r.es_editado && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-500" title="Ajustada manualmente" />
                                        )}
                                    </div>
                                    <span className="text-[10px] text-emerald-700/80 font-normal mt-0.5">
                                        ({r.horas_extra_aprobadas.toFixed(2)} h)
                                    </span>
                                </div>
                            ) : (
                                <span className="text-slate-300">—</span>
                            )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={r.observacion}>
                            {r.observacion || <span className="text-slate-300 italic">Sin nota</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                                type="button"
                                onClick={() => onOpenEdit(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg transition-all shadow-xs"
                                title="Editar horas extra de este día"
                            >
                                <Edit3 className="w-3 h-3 text-indigo-600" />
                                <span>Editar Horas</span>
                            </button>
                        </td>
                    </tr>
                )}
            />
        </div>
    );
};

export default BiometricOvertimeTable;
