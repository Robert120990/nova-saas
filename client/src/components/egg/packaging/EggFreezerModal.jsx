import { Snowflake, XCircle, Activity, Trash2 } from 'lucide-react';
import { formatDateTime } from '../../../utils/dateUtils';

const EggFreezerModal = ({
    isOpen,
    onClose,
    freezerForm,
    setFreezerForm,
    onSubmit,
    isSubmitting,
    packagingRecords = [],
    freezerLogs = [],
    onDeleteFreezerLog,
    getFreezerStatusBadge
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto text-slate-900">
                {/* Add Blast Freezer Log Form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl h-fit space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <Snowflake className="h-4 w-4 text-cyan-600" />
                            Blast Freezer
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <XCircle size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">Registro de congelación ultra-rápida</p>
                    <div className="h-px bg-slate-100" />

                    <form onSubmit={onSubmit} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote Envasado a Congelar</label>
                            <select
                                value={freezerForm.packaging_id}
                                onChange={(e) => setFreezerForm({ ...freezerForm, packaging_id: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Seleccione Lote Envasado...</option>
                                {packagingRecords.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.lot_code} - {p.product_type} ({p.units_packaged} Uds)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Ubicación del Túnel</label>
                            <select
                                value={freezerForm.freezer_location}
                                onChange={(e) => setFreezerForm({ ...freezerForm, freezer_location: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="Túnel A - Posición 1">Túnel Rápido A - Posición 1</option>
                                <option value="Túnel A - Posición 2">Túnel Rápido A - Posición 2</option>
                                <option value="Túnel B - Posición 1">Túnel Rápido B - Posición 1</option>
                                <option value="Túnel B - Posición 2">Túnel Rápido B - Posición 2</option>
                                <option value="Túnel C (Ultra-frío)">Túnel C - Criogénico</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Temp Núcleo (°C)</label>
                                <input
                                    type="number"
                                    value={freezerForm.core_temperature_c}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, core_temperature_c: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: -18.5"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Horas en Túnel</label>
                                <input
                                    type="number"
                                    value={freezerForm.freezing_duration_hours}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, freezing_duration_hours: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 4.0"
                                    step="0.1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Estado del Proceso</label>
                            <select
                                value={freezerForm.status}
                                onChange={(e) => setFreezerForm({ ...freezerForm, status: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="congelando">Congelando (Activo)</option>
                                <option value="congelado_ok">Congelado Aprobado (-18°C núcleo)</option>
                                <option value="alarma_tiempo">Alarma de Desviación de Tiempo</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40"
                        >
                            Guardar Registro Túnel
                        </button>
                    </form>
                </div>

                {/* Freezer active logs */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-cyan-600" />
                            Bitácora del Blast Freezer (Cadena de Frío)
                        </h2>
                        <p className="text-xs text-slate-500">Monitoreo de tiempos y temperatura interna de congelación</p>
                        <div className="h-px bg-slate-100 mt-3" />
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                        {freezerLogs.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-6">No hay registros de túnel registrados.</p>
                        ) : freezerLogs.map(log => (
                            <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-900">{log.lot_code}</span>
                                        <span className="text-[11px] text-slate-500 capitalize">{log.product_type}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium">Ubicación: <b className="text-slate-800">{log.freezer_location}</b></p>
                                    <div className="text-[11px] text-slate-500">
                                        <span>Ingreso: <b className="text-slate-700">{formatDateTime(log.created_at)}</b></span>
                                    </div>
                                </div>
                                
                                <div className="flex md:flex-col justify-between items-end text-right">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getFreezerStatusBadge ? getFreezerStatusBadge(log.status) : ''}`}>
                                            {log.status === 'congelado_ok' ? 'Congelado Aprobado' : log.status}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteFreezerLog?.(log.id)}
                                            title="Eliminar de bitácora Blast Freezer"
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    <div className="flex gap-2 text-xs mt-2">
                                        <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                            <span className="text-[8px] font-bold block text-slate-400 uppercase">Núcleo</span>
                                            <span className="text-xs font-bold text-cyan-700">{log.core_temperature_c}°C</span>
                                        </div>
                                        <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                            <span className="text-[8px] font-bold block text-slate-400 uppercase">Horas</span>
                                            <span className="text-xs font-bold text-slate-800">{log.freezing_duration_hours}h</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EggFreezerModal;
