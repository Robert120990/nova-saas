import { Lock, Edit3, Printer } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const BiometricCortesHistoryTable = ({ cortesList, isLoading, onSelectCorte, onExportCorte }) => {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Historial de Períodos Congelados</h3>
                    <p className="text-xs text-slate-500 font-medium">
                        Períodos cerrados y consolidados. Seleccione uno para ver y editar sus horas.
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4">Corte</th>
                            <th className="py-3 px-4">Rango de Fechas</th>
                            <th className="py-3 px-4 text-center">Colaboradores</th>
                            <th className="py-3 px-4 text-right">Horas Laboradas</th>
                            <th className="py-3 px-4 text-right">H.E. Aprobadas</th>
                            <th className="py-3 px-4 text-center">Estado</th>
                            <th className="py-3 px-4">Congelado Por</th>
                            <th className="py-3 px-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {isLoading ? (
                            <tr>
                                <td colSpan="8" className="py-12 text-center text-slate-400">
                                    Cargando períodos congelados...
                                </td>
                            </tr>
                        ) : cortesList.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="py-12 text-center text-slate-400">
                                    Aún no se ha realizado ningún congelamiento de período.
                                </td>
                            </tr>
                        ) : (
                            cortesList.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4 font-bold text-slate-800">{c.nombre}</td>
                                    <td className="py-3 px-4 whitespace-nowrap font-medium font-mono text-slate-600">
                                        {formatDate(c.fecha_inicio)} al {formatDate(c.fecha_fin)}
                                    </td>
                                    <td className="py-3 px-4 text-center font-bold">{c.total_empleados}</td>
                                    <td className="py-3 px-4 text-right font-mono font-medium">{c.total_horas_trabajadas} h</td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                                        <span className="block">
                                            +{Number(c.total_horas_extra_pagables || c.total_horas_extra_aprobadas || 0).toFixed(1)} h
                                        </span>
                                        <span className="block text-[10px] font-medium text-slate-400">
                                            Prod: {Number(c.total_horas_extra_produccion || 0).toFixed(1)} · Transp: {Number(c.total_horas_extra_transporte || 0).toFixed(1)}
                                            {Number(c.total_horas_extra_avicola || 0) > 0 ? ` · Avíc: +${Number(c.total_horas_extra_avicola).toFixed(1)}` : ''}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                            <Lock className="w-2.5 h-2.5" />
                                            Congelado
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                                        {c.created_by_name || 'Sistema'}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <div className="inline-flex items-center justify-center gap-1.5 flex-wrap">
                                            {onExportCorte && (
                                                <button
                                                    type="button"
                                                    onClick={() => onExportCorte(c)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                                                    title="Imprimir PDF o exportar Excel con firmas de aceptación"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                    <span>Imprimir / Excel</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onSelectCorte(c)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                                title="Ver y editar horas extra de este corte"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                <span>Ver / Editar Horas</span>
                                            </button>
                                        </div>
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

export default BiometricCortesHistoryTable;
