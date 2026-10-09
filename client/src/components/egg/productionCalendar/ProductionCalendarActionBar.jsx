import { formatDate } from '../../../utils/dateUtils';
import {
    Clock,
    User,
    CheckCircle2,
    Trash2,
    Edit3,
    Play,
    Wand2
} from 'lucide-react';
import {
    getJulianDayInfo,
    isJulianLotCode
} from '../../../utils/julianDate';
import { isProductionFinished } from '../EggCalendarPreviewPopover';


export default function ProductionCalendarActionBar({ model }) {
    const { navigate, calendarView, handleConvertLotToJulian, handleOpenEditModal, handleDeleteProduction, filteredProductions, getProfileBadgeStyle } = model;

    return (<>{calendarView === 'list' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    <th className="px-4 py-3">Fecha & Hora</th>
                                    <th className="px-4 py-3">Lote Asignado</th>
                                    <th className="px-4 py-3">Perfil & Presentación</th>
                                    <th className="px-4 py-3 text-right">Cantidad (Lbs)</th>
                                    <th className="px-4 py-3 text-center">Sólidos %</th>
                                    <th className="px-4 py-3">Operador / Equipo</th>
                                    <th className="px-4 py-3">Estado Lote</th>
                                    <th className="px-4 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredProductions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-medium">
                                            No se encontraron producciones programadas con los filtros seleccionados.
                                        </td>
                                    </tr>
                                ) : (
                                    (Array.isArray(filteredProductions) ? filteredProductions : []).map((prod) => {
                                        const badgeStyle = getProfileBadgeStyle(prod.product_profile);
                                        const tasksDone = (prod.tasks || []).filter(t => t.checklist_status === 'completado').length;
                                        const tasksTotal = (prod.tasks || []).length;
                                        const _isBatchRunning = prod.status === 'en_proceso';
                                        const isFinished = isProductionFinished(prod);

                                        return (
                                            <tr
                                                key={prod.id}
                                                className={`transition-colors ${isFinished
                                                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-600'
                                                        : 'hover:bg-slate-50/70'
                                                    }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-900">
                                                        {prod.production_date ? formatDate(prod.production_date) : 'N/A'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {prod.start_time ? prod.start_time.slice(0, 5) : '06:00'} - {prod.end_time ? prod.end_time.slice(0, 5) : '14:00'}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-slate-900">{prod.lot_code}</span>
                                                        <span
                                                            className="text-[9px] font-extrabold px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                                            title={`Día Juliano: ${getJulianDayInfo(prod.production_date).dayOfYearStr}`}
                                                        >
                                                            J-{getJulianDayInfo(prod.production_date).dayOfYearStr}
                                                        </span>
                                                        {isFinished && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider flex items-center gap-0.5 shadow-2xs">
                                                                <CheckCircle2 className="w-2.5 h-2.5" /> Finalizado
                                                            </span>
                                                        )}
                                                        {!isJulianLotCode(prod.lot_code) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleConvertLotToJulian(prod.id)}
                                                                className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[9px] font-bold flex items-center gap-1 transition-all"
                                                                title="Convertir a Lote Juliano"
                                                            >
                                                                <Wand2 className="w-2.5 h-2.5" />
                                                                <span>Juliano</span>
                                                            </button>
                                                        )}
                                                        {prod.priority === 'urgente' && (
                                                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                                                                Urgente
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-bold ${badgeStyle.bg}`}>
                                                        {prod.product_profile}
                                                    </span>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">{prod.presentation}</div>
                                                </td>

                                                <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                    {parseFloat(prod.target_quantity_lbs || 0).toLocaleString()} Lbs
                                                </td>

                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-semibold text-slate-700">{prod.target_solids_pct || '22.5'}%</span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                        {prod.assigned_operator_name || 'Sin asignar'}
                                                    </div>
                                                    {tasksTotal > 0 && (
                                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                                            Checklist: <span className="font-bold text-emerald-600">{tasksDone}</span> de {tasksTotal} tareas
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {isFinished ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Finalizado
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${prod.status === 'completado'
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : prod.status === 'en_proceso'
                                                                        ? 'bg-blue-100 text-blue-700 animate-pulse'
                                                                        : prod.status === 'cancelado'
                                                                            ? 'bg-slate-200 text-slate-600'
                                                                            : 'bg-amber-100 text-amber-700'
                                                                }`}
                                                        >
                                                            {prod.status}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {!isFinished && !prod.batch_id && prod.status !== 'completado' && prod.status !== 'cancelado' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    navigate('/industrial/produccion', {
                                                                        state: {
                                                                            openNewBatchModal: true,
                                                                            scheduledProduction: prod
                                                                        }
                                                                    });
                                                                }}
                                                                className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1 shadow-2xs"
                                                                title="Llevar actividad a Producción e iniciar lote"
                                                            >
                                                                <Play className="w-3.5 h-3.5 fill-emerald-600" />
                                                                <span className="text-[10px] font-bold">A Producción</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditModal(prod)}
                                                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                                                            title="Editar detalles y mezcla"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteProduction(prod.id, prod.lot_code)}
                                                            disabled={prod.status === 'completado'}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-30"
                                                            title={prod.status === 'completado' ? 'Producción completada (no eliminable)' : 'Eliminar producción'}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}</>);
}
