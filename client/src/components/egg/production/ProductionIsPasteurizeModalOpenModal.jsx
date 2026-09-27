import {
    Flame,
    AlertOctagon
} from 'lucide-react';


export default function ProductionIsPasteurizeModalOpenModal({ model, open = model.isPasteurizeModalOpen, onClose = () => { model.setHaccpViolationAlert(null); model.setIsPasteurizeModalOpen(false); }, onSave = model.handlePasteurize }) {
    const { batches, selectedBatchForPasteurize, setSelectedBatchForPasteurize, pasteurizeForm, setPasteurizeForm, isSubmitting, haccpViolationAlert, isPasteurizeModalOpen, setIsPasteurizeModalOpen } = model;
    if (!open) return null;
    return (<>{isPasteurizeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Flame className="h-5 w-5 text-orange-600" />
                                Registro de Parámetros de Pasteurización
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Verifique termómetros y manómetros antes de validar el tratamiento térmico.</p>
                            <div className="h-px bg-slate-100 mt-4" />
                        </div>

                        {/* Guía Rápida de Límites de Pasteurización ANDELSA */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                            <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-slate-500 block font-bold uppercase text-[10px]">Huevo Entero</span>
                                <span className="text-slate-900 font-bold text-xs">≥ 64.0°C</span>
                                <span className="text-slate-400 block text-[9px]">210 seg</span>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-slate-500 block font-bold uppercase text-[10px]">Clara Líquida</span>
                                <span className="text-slate-900 font-bold text-xs">≥ 56.0°C</span>
                                <span className="text-slate-400 block text-[9px]">210 seg</span>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-slate-500 block font-bold uppercase text-[10px]">Yema / Salada</span>
                                <span className="text-slate-900 font-bold text-xs">≥ 66.5°C</span>
                                <span className="text-slate-400 block text-[9px]">210 seg</span>
                            </div>
                        </div>

                        {/* Alert HACCP */}
                        {haccpViolationAlert && (
                            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 space-y-3 shadow-sm">
                                <div className="flex gap-2 items-center font-bold text-xs uppercase tracking-wide text-rose-700">
                                    <AlertOctagon size={18} className="text-rose-600" />
                                    ALERTA DE INOCUIDAD ALIMENTARIA: PARÁMETROS FUERA DE RANGO
                                </div>
                                <p className="text-xs font-bold leading-relaxed">{haccpViolationAlert}</p>
                                <p className="text-xs text-rose-700">
                                    <b>ACCIÓN AUTOMÁTICA:</b> El lote ha sido marcado como bloqueado para empaque comercial y requiere evaluación de calidad.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-xs"
                                >
                                    Volver al Historial
                                </button>
                            </div>
                        )}

                        <form onSubmit={onSave} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote en Proceso a Pasteurizar</label>
                                <select
                                    value={selectedBatchForPasteurize}
                                    onChange={(e) => setSelectedBatchForPasteurize(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">Seleccione Lote...</option>
                                    {(Array.isArray(batches.filter(b => b.status === 'en_proceso' || String(b.id) === String(selectedBatchForPasteurize))) ? batches.filter(b => b.status === 'en_proceso' || String(b.id) === String(selectedBatchForPasteurize)) : []).map(b => (
                                        <option key={b.id} value={b.id}>
                                            [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Temperatura Pasteurización (°C)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.temperature_c}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        step="0.01"
                                        placeholder="Ej: 64.5"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Tiempo de Retención (Segundos)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.holding_time_seconds}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, holding_time_seconds: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 210"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Presión Hidráulica (PSI)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.pressure_psi}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, pressure_psi: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        step="0.01"
                                        placeholder="Ej: 48.0"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Flujo de Bomba (GPM)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.flow_rate_gpm}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, flow_rate_gpm: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        step="0.01"
                                        placeholder="Ej: 12.5"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsPasteurizeModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    {isSubmitting ? 'Validando...' : 'Validar & Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
