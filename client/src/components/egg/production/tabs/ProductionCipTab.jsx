import {
    Activity,
    Wrench,
    Calendar,
    Layers,
    Trash2
} from 'lucide-react';
import { formatDate, formatDateTime } from '../../../../utils/dateUtils';


export default function ProductionCipTab({ model }) {
    const { batches, cipLogs, activeTab, cipForm, setCipForm, isSubmitting, handleCreateCip, handleDeleteCip } = model;

    return (<>{activeTab === 'cip' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Log New CIP Form */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm h-fit space-y-4 sm:space-y-5">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-teal-600" />
                                Registrar Limpieza CIP
                            </h2>
                            <p className="text-xs text-slate-500">Bitácora de sanitización y control de inocuidad</p>
                            <div className="h-px bg-slate-100 mt-3" />
                        </div>

                        <form onSubmit={handleCreateCip} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                                    Fecha y Hora de Sanitización
                                </label>
                                <input
                                    type="datetime-local"
                                    value={cipForm.created_at}
                                    onChange={(e) => setCipForm({ ...cipForm, created_at: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                    Vincular a Lote de Producción (Opcional)
                                </label>
                                <select
                                    value={cipForm.batch_id}
                                    onChange={(e) => setCipForm({ ...cipForm, batch_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">General / Pre-operacional (Sin lote vinculado)</option>
                                    {(Array.isArray(batches) ? batches : []).map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.batch_code_display || b.batch_uuid} - {b.product_type} ({formatDate(b.started_at)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Equipo Sanitizado</label>
                                <select
                                    value={cipForm.equipment_name}
                                    onChange={(e) => setCipForm({ ...cipForm, equipment_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="pasteurizador">Pasteurizador de Placas</option>
                                    <option value="quebradora">Quebradora Centrífuga</option>
                                    <option value="tanque holding 1">Tanque Pulmón 1</option>
                                    <option value="tanque holding 2">Tanque Pulmón 2</option>
                                    <option value="llenadora">Envasadora de Llenado</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Agente Químico Sanitizante</label>
                                <input
                                    type="text"
                                    value={cipForm.chemical_used}
                                    onChange={(e) => setCipForm({ ...cipForm, chemical_used: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: Ácido Peracético 1.5%"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Temp Limpieza (°C)</label>
                                    <input
                                        type="number"
                                        value={cipForm.temperature_c}
                                        onChange={(e) => setCipForm({ ...cipForm, temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 78.5"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Duración (Minutos)</label>
                                    <input
                                        type="number"
                                        value={cipForm.duration_minutes}
                                        onChange={(e) => setCipForm({ ...cipForm, duration_minutes: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 45"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Estado de Validación</label>
                                <select
                                    value={cipForm.validation_status}
                                    onChange={(e) => setCipForm({ ...cipForm, validation_status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="completado">Completado y Aprobado</option>
                                    <option value="fallido">Fallido / Requiere Reinicio</option>
                                    <option value="pendiente">Pendiente de Aprobación</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Notas de Bitácora</label>
                                <textarea
                                    value={cipForm.notes}
                                    onChange={(e) => setCipForm({ ...cipForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-20"
                                    placeholder="Detalles sobre enjuague, conductividad..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                Registrar Limpieza
                            </button>
                        </form>
                    </div>

                    {/* CIP History */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="h-4 w-4 text-indigo-600" />
                                Historial de Sanitización CIP Reciente
                            </h2>
                            <p className="text-xs text-slate-500">Valida la autorización higiénica para el inicio de producción</p>
                            <div className="h-px bg-slate-100 mt-3" />
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
                            {(Array.isArray(cipLogs) ? cipLogs : []).length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-6">No hay registros de limpieza disponibles.</p>
                            ) : (Array.isArray(cipLogs) ? cipLogs : []).map(log => (
                                <div key={log.id} className="bg-slate-50 hover:bg-slate-100/70 transition-colors border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row justify-between gap-3 sm:gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.validation_status === 'completado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                {log.validation_status}
                                            </span>
                                            {log.batch_id && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    Lote: {log.batch_code_display || log.batch_uuid || `#${log.batch_id}`}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{log.notes || 'Sin anotaciones adicionales.'}</p>
                                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                                            <span>Químico: <b className="text-slate-700">{log.chemical_used}</b></span>
                                            <span>Operador: <b className="text-slate-700">{log.operator_name}</b></span>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col justify-between items-end text-right gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.created_at)}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCip(log.id)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                title="Eliminar este registro de sanitización CIP"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2 text-xs mt-1">
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[8px] font-bold block text-slate-400 uppercase">Temp</span>
                                                <span className="text-xs font-bold text-slate-800">{log.temperature_c}°C</span>
                                            </div>
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[8px] font-bold block text-slate-400 uppercase">Tiempo</span>
                                                <span className="text-xs font-bold text-slate-800">{log.duration_minutes}m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}</>);
}
