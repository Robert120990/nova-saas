import { Lock, Unlock, ArrowLeft } from 'lucide-react';
import { formatDate, formatDecimalHours } from '../../utils/dateUtils';

export const BiometricPendingBanner = ({ pendingRange, lastCorte, summary }) => {
    return (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
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
        </div>
    );
};

export const BiometricFrozenBanner = ({ selectedCorte, onBack, onUnfreeze, isUnfreezing }) => {
    return (
        <div className="p-4 sm:p-5 bg-sky-950 text-white rounded-2xl shadow-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white mb-2 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Volver a la lista de cortes congelados</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-sky-400" />
                            Período Congelado
                        </span>
                        <h3 className="text-lg font-black text-white">{selectedCorte.nombre}</h3>
                    </div>
                    <p className="text-xs text-sky-200 mt-1">
                        Rango: {formatDate(selectedCorte.fecha_inicio)} al {formatDate(selectedCorte.fecha_fin)}.
                        Las marcaciones del reloj están protegidas; <strong>puede editar las horas extra</strong> de cualquier registro si requiere ajustes.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-sky-300 uppercase block">H.E. Aprobadas</span>
                        <span className="text-lg font-black text-white">
                            {formatDecimalHours(selectedCorte.total_horas_extra_aprobadas, { short: true })}
                        </span>
                        <span className="text-[10px] text-sky-200/80 block font-normal">
                            ({(selectedCorte.total_horas_extra_aprobadas || 0).toFixed(2)} h)
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onUnfreeze}
                        disabled={isUnfreezing}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl transition-colors disabled:opacity-50"
                        title="Descongelar y reabrir este corte"
                    >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{isUnfreezing ? 'Descongelando...' : 'Descongelar'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
