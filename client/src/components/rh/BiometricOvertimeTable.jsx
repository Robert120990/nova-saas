import { Search, Edit3 } from 'lucide-react';
import { formatDate, formatDecimalHours } from '../../utils/dateUtils';

const BiometricOvertimeTable = ({
    rows,
    isLoading,
    search,
    onSearchChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    onlyOvertime,
    onOnlyOvertimeChange,
    isFrozenView,
    onOpenEdit
}) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
            {/* Barra de Filtros */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center text-xs">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Buscar colaborador, código, cargo..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-300 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                </div>

                {!isFrozenView && (
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onStartDateChange(e.target.value)}
                            className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white"
                        />
                        <span className="text-slate-400 font-bold">a</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onEndDateChange(e.target.value)}
                            className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none bg-white"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2">
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

            {/* Tabla de Horas Extra */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3">Colaborador</th>
                            <th className="py-2.5 px-3">Cargo / Depto</th>
                            <th className="py-2.5 px-3">Entrada</th>
                            <th className="py-2.5 px-3">Salida</th>
                            <th className="py-2.5 px-3 text-right">Horas Lab.</th>
                            <th className="py-2.5 px-3 text-right">Tardanza</th>
                            <th className="py-2.5 px-3 text-right">H.E. Reloj</th>
                            <th className="py-2.5 px-3 text-right bg-indigo-50/50">H.E. Aprobadas</th>
                            <th className="py-2.5 px-3">Observación</th>
                            <th className="py-2.5 px-3 text-center">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {isLoading ? (
                            <tr>
                                <td colSpan="11" className="py-12 text-center text-slate-400">
                                    Calculando registros de horas extra...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan="11" className="py-12 text-center text-slate-400">
                                    No se encontraron registros de horas para los filtros seleccionados.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r, idx) => (
                                <tr key={`${r.device_uid}-${r.fecha}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
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
                                                    <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title={`Horas decimales para planilla: ${r.horas_extra_aprobadas.toFixed(2)} h`}>
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
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BiometricOvertimeTable;
