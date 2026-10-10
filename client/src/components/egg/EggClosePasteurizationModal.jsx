import { Lock, X, Flame } from 'lucide-react';

const EggClosePasteurizationModal = ({
    isOpen,
    onClose,
    batch,
    pasteurizationLot,
    onPasteurizationLotChange,
    notes,
    onNotesChange,
    wasteShellLbs,
    _onWasteShellLbsChange,
    yieldLiquidLbs,
    _onYieldLiquidLbsChange,
    onSubmit,
    isSubmitting
}) => {
    if (!isOpen || !batch) return null;

    const inputLbs = parseFloat(batch.input_weight_lbs || 0);
    const isCoproduct = Boolean(batch.is_coproduct || batch.parent_batch_id);
    const pType = (batch.product_type || '').toLowerCase();
    const isClara = pType.includes('clara');
    const isYema = pType.includes('yema');

    const defaultShellPct = isCoproduct ? 0 : 0.13;
    const defaultYieldPct = isClara ? 0.56 : isYema ? 0.32 : 0.87;
    const shellPctLabel = isCoproduct ? '0% (Compartida)' : '13% fijo';
    const yieldPctLabel = `${Math.round(defaultYieldPct * 100)}%`;

    const autoShellLbs = inputLbs > 0 ? (inputLbs * defaultShellPct).toFixed(2) : '0.00';
    const autoYieldLbs = inputLbs > 0 ? (inputLbs * defaultYieldPct).toFixed(2) : '0.00';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-3.5 sm:p-6 text-slate-900 space-y-3.5 sm:space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 text-amber-600">
                        <div className="p-2 sm:p-2.5 bg-amber-100 rounded-xl shrink-0">
                            <Lock size={20} className="sm:w-[22px] sm:h-[22px] text-amber-700" />
                        </div>
                        <div>
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
                                Cerrar Etapa de Pasteurización
                            </h3>
                            <span className="text-[11px] sm:text-xs text-slate-500 font-medium">Bloqueará modificaciones térmicas</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                        <Flame size={14} className="text-amber-700" />
                        <span>Lote: {batch.batch_code_display || batch.batch_uuid} ({batch.product_type})</span>
                        {isCoproduct && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-purple-100 text-purple-800 font-bold rounded border border-purple-200">
                                🔗 Co-Producto
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-amber-800">
                        Al cerrar la pasteurización, se fijará el lote térmico oficial y se impedirá añadir más tarimas o modificar temperaturas/retención sin permiso especial de administración.
                    </p>
                </div>

                {/* Desglose de Masa Automático Calibrado por Tipo de Corrida */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">Entrada del Lote:</span>
                        <span className="font-black text-slate-900 font-mono">{inputLbs.toLocaleString()} Lbs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                        <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-lg">
                            <span className="text-[10px] font-bold text-amber-800 uppercase block">Cáscara ({shellPctLabel})</span>
                            <span className="text-xs font-black text-amber-900 font-mono">
                                {wasteShellLbs !== undefined && wasteShellLbs !== null && wasteShellLbs !== '' ? parseFloat(wasteShellLbs).toLocaleString() : autoShellLbs} Lbs
                            </span>
                        </div>
                        <div className="p-2 bg-teal-50/80 border border-teal-200 rounded-lg">
                            <span className="text-[10px] font-bold text-teal-800 uppercase block">Líquido Estimado ({yieldPctLabel})</span>
                            <span className="text-xs font-black text-teal-900 font-mono">
                                {yieldLiquidLbs !== undefined && yieldLiquidLbs !== null && yieldLiquidLbs !== '' ? parseFloat(yieldLiquidLbs).toLocaleString() : autoYieldLbs} Lbs
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                        {isCoproduct
                            ? 'ℹ️ Lote co-producto (corrida compartida). La merma de cáscara se atribuye al lote principal para evitar doble contabilización.'
                            : 'ℹ️ El sistema registrará automáticamente la merma de cáscara en el balance de masas y en la bitácora de mermas.'}
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

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-2.5 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !pasteurizationLot?.trim()}
                            className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 text-center"
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
