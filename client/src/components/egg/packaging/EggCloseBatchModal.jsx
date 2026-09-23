import { Scale, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

const EggCloseBatchModal = ({
    isOpen,
    onClose,
    batch,
    notes,
    onNotesChange,
    onSubmit,
    isSubmitting
}) => {
    if (!isOpen || !batch) return null;

    const b = batch;
    const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
    const packagedLbs = parseFloat(b.packaged_weight_lbs || 0);
    const missingLbs = Math.max(0, yieldLbs - packagedLbs);
    const effPct = yieldLbs > 0 ? ((packagedLbs / yieldLbs) * 100).toFixed(2) : '100.00';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                            <Scale size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                Cierre Técnico de Envasado del Lote
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Lote: <b>{b.batch_code_display || b.batch_uuid}</b> ({b.product_type})
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                    >
                        <XCircle size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center text-xs">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Rendimiento</span>
                        <strong className="text-teal-700 text-sm">{yieldLbs.toLocaleString()} Lbs</strong>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Envasado Real</span>
                        <strong className="text-indigo-700 text-sm">{packagedLbs.toLocaleString()} Lbs</strong>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Faltante/Merma</span>
                        <strong className={`text-sm ${missingLbs > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {missingLbs.toLocaleString()} Lbs
                        </strong>
                    </div>
                </div>

                {missingLbs > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                            Alerta de Saldo Pendiente por Envasar:
                        </div>
                        <p>
                            Faltan <b>{missingLbs.toFixed(2)} Lbs</b> por envasar respecto al rendimiento obtenido.
                            Al confirmar el cierre, esta diferencia se computará automáticamente como <b>pérdida en tuberías / desperdicio técnico</b> para evaluar el margen de eficiencia global.
                        </p>
                        <p className="font-bold text-slate-800 pt-1">
                            Margen de Eficiencia Resultante: <span className="text-amber-700 font-black">{effPct}%</span>
                        </p>
                    </div>
                ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <div>
                            <b>100% de Eficiencia:</b> Se ha completado el envasado de todo el rendimiento disponible sin pérdidas residuales registradas.
                        </div>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                            Notas y Justificación del Cierre Técnico
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => onNotesChange?.(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            placeholder="Ej: Fin de corrida de envasado, residuo de libras en circuito de tuberías..."
                        />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40"
                        >
                            {isSubmitting ? 'Cerrando...' : 'Confirmar Cierre de Envasado'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggCloseBatchModal;
