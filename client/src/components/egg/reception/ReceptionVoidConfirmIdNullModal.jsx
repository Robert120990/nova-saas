import {
    AlertTriangle
} from 'lucide-react';


export default function ReceptionVoidConfirmIdNullModal({ model, open = model.voidConfirmId !== null, onClose = () => model.setVoidConfirmId(null) }) {
    const { voidConfirmId, handleVoid } = model;
    if (!open) return null;
    return (<>{voidConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-md w-full text-slate-900 max-h-[92dvh] overflow-y-auto my-auto space-y-4">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-600 shrink-0">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide leading-snug">Confirmar Anulación</h3>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">¿Está seguro de anular esta recepción de materia prima? Esta acción restará el inventario ingresado y no se puede deshacer.</p>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                            <button onClick={onClose} className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs text-center">Cancelar</button>
                            <button onClick={() => handleVoid(voidConfirmId)} className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs text-center">Anular</button>
                        </div>
                    </div>
                </div>
            )}</>);
}
