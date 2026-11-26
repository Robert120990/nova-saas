import { Lock, Unlock, ArrowLeft, Printer, UserCheck, X } from 'lucide-react';
import { formatDate, formatDecimalHours } from '../../utils/dateUtils';

const SelectedEmployeeTotalsStrip = ({ selectedEmployee, summary, onClear, isFrozen }) => {
    if (!selectedEmployee) return null;
    const hrsLab = Number(summary?.total_horas_trabajadas || 0);
    const heReloj = Number(summary?.total_horas_extra_calculadas || 0);
    const heAprob = Number(summary?.total_horas_extra_aprobadas || 0);
    const heDiur = Number(summary?.total_horas_extra_diurnas || 0);
    const heNoct = Number(summary?.total_horas_extra_nocturnas || 0);

    return (
        <div className={`p-3 sm:p-4 rounded-xl border ${isFrozen ? 'bg-white/10 border-sky-400/30' : 'bg-white/10 border-indigo-400/30'} space-y-3`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-400/30">
                        <UserCheck className="w-3 h-3" />
                        Totalizador por Colaborador
                    </span>
                    <span className="text-sm font-black text-white">
                        {selectedEmployee.nombre}
                    </span>
                    <span className="text-xs font-mono text-slate-300">[{selectedEmployee.codigo}]</span>
                    <span className="text-xs text-slate-300">· {selectedEmployee.cargo} ({selectedEmployee.departamento})</span>
                </div>
                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/15 hover:bg-white/25 text-white self-start sm:self-center transition-colors"
                    >
                        <X className="w-3 h-3" />
                        <span>Ver todos</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <div className="bg-slate-950/35 px-3 py-2 rounded-lg border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">Días Registrados</span>
                    <span className="text-base font-black text-white">{summary?.total_filas || 0}</span>
                </div>
                <div className="bg-slate-950/35 px-3 py-2 rounded-lg border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">Horas Laboradas</span>
                    <span className="text-base font-black text-white">{formatDecimalHours(hrsLab, { short: true })}</span>
                    <span className="text-[10px] text-slate-300 block">({hrsLab.toFixed(2)} h)</span>
                </div>
                <div className="bg-slate-950/35 px-3 py-2 rounded-lg border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">H.E. Reloj</span>
                    <span className="text-base font-black text-indigo-200">{formatDecimalHours(heReloj, { short: true })}</span>
                    <span className="text-[10px] text-slate-300 block">({heReloj.toFixed(2)} h)</span>
                </div>
                <div className="bg-emerald-500/20 px-3 py-2 rounded-lg border border-emerald-400/30">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase block">H.E. Aprobadas</span>
                    <span className="text-base font-black text-emerald-300">{formatDecimalHours(heAprob, { short: true })}</span>
                    <span className="text-[10px] text-emerald-200/90 block">
                        ({heAprob.toFixed(2)}h · D:{heDiur.toFixed(1)} N:{heNoct.toFixed(1)})
                    </span>
                </div>
                <div className="bg-slate-950/35 px-3 py-2 rounded-lg border border-white/10">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">Tardanzas</span>
                    <span className="text-base font-black text-rose-300">
                        {summary?.total_llegadas_tarde || 0} ({summary?.total_minutos_tardanza || 0} min)
                    </span>
                </div>
            </div>
        </div>
    );
};

export const BiometricPendingBanner = ({
    pendingRange,
    lastCorte,
    summary,
    selectedEmployee = null,
    onClearEmployee
}) => {
    return (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Rango Pendiente Para Reportar
                        </span>
                        {lastCorte && (
                            <span className="text-[11px] text-slate-300">
                                (Último corte: <strong>{lastCorte.nombre}</strong> hasta {formatDate(lastCorte.fecha_fin)})
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                        {pendingRange.fecha_inicio ? formatDate(pendingRange.fecha_inicio) : '---'}
                        <span className="text-indigo-400 font-normal mx-2">al</span>
                        {pendingRange.fecha_fin ? formatDate(pendingRange.fecha_fin) : '---'}
                    </h2>
                    <p className="text-xs text-slate-300">
                        Mostrando las marcaciones acumuladas pendientes de corte para reporte a planillas.
                    </p>
                </div>

                {/* Totales Resumen */}
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10 text-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase block">Colaboradores</span>
                        <span className="text-lg font-black text-white">{summary.total_empleados || 0}</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10 text-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase block">Hrs Lab.</span>
                        <span className="text-lg font-black text-white">
                            {formatDecimalHours(summary.total_horas_trabajadas, { short: true })}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                            ({(summary.total_horas_trabajadas || 0).toFixed(2)} h)
                        </span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10 text-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase block">H.E. Reloj</span>
                        <span className="text-lg font-black text-indigo-300">
                            {formatDecimalHours(summary.total_horas_extra_calculadas, { short: true })}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                            ({(summary.total_horas_extra_calculadas || 0).toFixed(2)} h)
                        </span>
                    </div>
                    <div className="bg-emerald-500/20 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-emerald-500/30 text-center">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase block">H.E. Aprobadas</span>
                        <span className="text-lg font-black text-emerald-400">
                            {formatDecimalHours(summary.total_horas_extra_aprobadas, { short: true })}
                        </span>
                        <span className="text-[10px] text-emerald-300/80 block font-normal">
                            ({(summary.total_horas_extra_aprobadas || 0).toFixed(2)} h)
                        </span>
                    </div>
                </div>
            </div>

            <SelectedEmployeeTotalsStrip
                selectedEmployee={selectedEmployee}
                summary={summary}
                onClear={onClearEmployee}
                isFrozen={false}
            />
        </div>
    );
};

export const BiometricFrozenBanner = ({
    selectedCorte,
    summary = {},
    selectedEmployee = null,
    onClearEmployee,
    onOpenExport,
    onBack,
    onUnfreeze,
    isUnfreezing
}) => {
    const hrsLab = summary?.total_horas_trabajadas ?? selectedCorte.total_horas_trabajadas ?? 0;
    const heAprob = summary?.total_horas_extra_aprobadas ?? selectedCorte.total_horas_extra_aprobadas ?? 0;
    const heReloj = summary?.total_horas_extra_calculadas ?? selectedCorte.total_horas_extra ?? 0;

    return (
        <div className="p-4 sm:p-5 bg-sky-950 text-white rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Volver a la lista de cortes congelados</span>
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-sky-400" />
                            Período Congelado
                        </span>
                        <h3 className="text-lg font-black text-white">{selectedCorte.nombre}</h3>
                    </div>
                    <p className="text-xs text-sky-200 mt-1">
                        Rango: {formatDate(selectedCorte.fecha_inicio)} al {formatDate(selectedCorte.fecha_fin)}.
                        Las marcaciones del reloj están protegidas; <strong>puede editar las horas extra</strong> de cualquier registro o imprimir resúmenes con firma.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-sky-300 uppercase block">Hrs Lab.</span>
                        <span className="text-base font-black text-white">
                            {formatDecimalHours(hrsLab, { short: true })}
                        </span>
                        <span className="text-[10px] text-sky-200/80 block font-normal">
                            ({Number(hrsLab).toFixed(2)} h)
                        </span>
                    </div>
                    <div className="bg-white/10 px-3.5 py-2 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-sky-300 uppercase block">H.E. Reloj</span>
                        <span className="text-base font-black text-indigo-200">
                            {formatDecimalHours(heReloj, { short: true })}
                        </span>
                        <span className="text-[10px] text-sky-200/80 block font-normal">
                            ({Number(heReloj).toFixed(2)} h)
                        </span>
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-400/30 px-3.5 py-2 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase block">H.E. Aprobadas</span>
                        <span className="text-base font-black text-emerald-300">
                            {formatDecimalHours(heAprob, { short: true })}
                        </span>
                        <span className="text-[10px] text-emerald-200/80 block font-normal">
                            ({Number(heAprob).toFixed(2)} h)
                        </span>
                    </div>

                    {onOpenExport && (
                        <button
                            type="button"
                            onClick={onOpenExport}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 rounded-xl shadow-sm transition-colors"
                            title="Imprimir PDF o descargar Excel (Global con firmas o Detallado por Persona)"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir / Exportar</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onUnfreeze}
                        disabled={isUnfreezing}
                        className="flex items-center gap-1 px-3 py-2.5 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl transition-colors disabled:opacity-50"
                        title="Descongelar y reabrir este corte"
                    >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{isUnfreezing ? 'Descongelando...' : 'Descongelar'}</span>
                    </button>
                </div>
            </div>

            <SelectedEmployeeTotalsStrip
                selectedEmployee={selectedEmployee}
                summary={summary}
                onClear={onClearEmployee}
                isFrozen
            />
        </div>
    );
};
