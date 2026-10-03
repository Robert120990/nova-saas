import Modal from '../../ui/Modal';
import { Plus, Umbrella, Loader2 } from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

const VacacionesElegiblesModal = ({ open, onClose, onSubmit, model }) => {
    const { elegiblesAño, elegiblesList, elegiblesMes, incluirPendientes, isLoadingElegibles, months, setElegiblesAño, setElegiblesMes, setIncluirPendientes, totalEstimadoPagar, years } = model;
    if (!open) return null;
    return (<Modal
                isOpen={open}
                onClose={onClose}
                title="Empleados con Derecho a Vacación"
                maxWidth="max-w-6xl"
            >
                <div className="space-y-4">
                    {/* Header Controls & Filters */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Año de Consulta</label>
                                <select
                                    value={elegiblesAño}
                                    onChange={e => setElegiblesAño(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mes de Consulta</label>
                                <select
                                    value={elegiblesMes}
                                    onChange={e => setElegiblesMes(parseInt(e.target.value))}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="pt-4 md:pt-3">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                                    <input
                                        type="checkbox"
                                        checked={incluirPendientes}
                                        onChange={e => setIncluirPendientes(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                    />
                                    <span>Incluir acumuladas (+365 días de meses anteriores)</span>
                                </label>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="flex items-center gap-3 self-end md:self-center">
                            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-right shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Elegibles</span>
                                <span className="text-base font-black text-indigo-700">{elegiblesList.length}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-right shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monto Estimado</span>
                                <span className="text-base font-black text-emerald-600 tabular-nums">
                                    <Money value={totalEstimadoPagar} />
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Table of Elegibles */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2.5">Empleado</th>
                                        <th className="px-3 py-2.5">Cargo / Depto</th>
                                        <th className="px-3 py-2.5">Sueldo Base</th>
                                        <th className="px-3 py-2.5">Ingreso / Antigüedad</th>
                                        <th className="px-3 py-2.5">Última Vacación</th>
                                        <th className="px-3 py-2.5">Período de Vacación</th>
                                        <th className="px-3 py-2.5">Monto Estimado</th>
                                        <th className="px-3 py-2.5">Estado</th>
                                        <th className="px-3 py-2.5 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingElegibles ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                                                    <span className="text-xs font-medium">Verificando elegibilidad y aniversarios de ley...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : elegiblesList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                    <Umbrella size={32} className="text-slate-300" />
                                                    <span className="text-sm font-bold text-slate-700">Sin empleados con derecho este mes</span>
                                                    <span className="text-xs text-slate-400 max-w-sm">
                                                        Ningún colaborador activo cumple su ciclo de 365 días en {months.find(m => m.value === elegiblesMes)?.label} {elegiblesAño}.
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        (Array.isArray(elegiblesList) ? elegiblesList : []).map((item) => (
                                            <tr key={item.empleado_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2.5">
                                                    <div className="font-bold text-slate-900">{item.nombre_completo}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{item.empleado_codigo}</div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-semibold text-slate-700">{item.cargo_nombre}</div>
                                                    <div className="text-[10px] text-slate-400">{item.departamento_nombre}</div>
                                                </td>
                                                <td className="px-3 py-2.5 font-bold text-slate-800 tabular-nums">
                                                    <Money value={item.sueldo_base} />
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-medium text-slate-700">{formatDate(item.fecha_ingreso)}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{item.dias_totales_empresa} días en empresa</div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-medium text-slate-700">
                                                        {item.ultima_vacacion_fecha_final ? formatDate(item.ultima_vacacion_fecha_final) : 'Sin registro previo'}
                                                    </div>
                                                    <div className="text-[10px] text-indigo-600 font-medium">
                                                        {item.origen === 'ultima_vacacion' ? 'Desde última vacación' : 'Desde fecha de ingreso'}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-semibold text-slate-800 text-[11px]">
                                                        {formatDate(item.fecha_inicio_periodo)} al {formatDate(item.fecha_fin_periodo)}
                                                    </div>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-0.5">
                                                        {item.dias_servicio} días
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="font-black text-emerald-700 tabular-nums text-xs">
                                                        <Money value={item.vacaciones_monto_estimado} />
                                                    </div>
                                                    <div className="text-[9px] text-slate-400">15 días + 30%</div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    {item.es_mes_aniversario ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            Cumple este mes
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                            Pendiente acumulada
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => onSubmit(item)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                                                    >
                                                        <Plus size={13} />
                                                        <span>Registrar Vacación</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                        >
                            Cerrar consulta
                        </button>
                    </div>
                </div>
            </Modal>
    );
};

export default VacacionesElegiblesModal;
