import { Lock, X, Flame } from 'lucide-react';

const EggClosePasteurizationModal = ({
    isOpen,
    onClose,
    batch,
    pasteurizationLot,
    onPasteurizationLotChange,
    notes,
    onNotesChange,
    onSubmit,
    isSubmitting
}) => {
    if (!isOpen || !batch) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-3 text-amber-600">
                        <div className="p-2.5 bg-amber-100 rounded-xl">
                            <Lock size={22} className="text-amber-700" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                Cerrar Etapa de Pasteurización
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">Bloqueará modificaciones térmicas e incongruencias</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                        <Flame size={14} className="text-amber-700" />
                        Lote: {batch.batch_code_display || batch.batch_uuid} ({batch.product_type})
                    </div>
                    <p className="text-[11px] text-amber-800">
                        Al cerrar la pasteurización, se fijará el lote térmico oficial y se impedirá añadir más tarimas o modificar temperaturas/retención sin permiso especial de administración.
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                            Identificador / Lote de Pasteurización *
                        </label>
                        <input
                            type="text"
                            required
                            value={pasteurizationLot}
                            onChange={(e) => onPasteurizationLotChange(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                            placeholder="Ej: PAST-084-01"
                        />
                        <span className="text-[10px] text-slate-400 block mt-1">
                            Este lote se imprimirá en reportes y asociará a las lecturas térmicas del pasteurizador.
                        </span>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                            Observaciones de Cierre (Opcional)
                        </label>
                        <textarea
                            rows="2"
                            value={notes}
                            onChange={(e) => onNotesChange(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none font-medium"
                            placeholder="Notas de conformidad o condiciones de la corrida..."
                        />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !pasteurizationLot?.trim()}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                        >
                            <Lock size={13} />
                            {isSubmitting ? 'Cerrando...' : 'Confirmar Cierre de Pasteurización'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggClosePasteurizationModal;
