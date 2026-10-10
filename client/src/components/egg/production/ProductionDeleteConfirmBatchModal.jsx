import {
    AlertTriangle
} from 'lucide-react';


export default function ProductionDeleteConfirmBatchModal({ model, open = model.deleteConfirmBatch, onClose = () => model.setDeleteConfirmBatch(null), onSave = model.handleDeleteBatchConfirm }) {
    const { deleteConfirmBatch } = model;
    if (!open) return null;
    return (<>{deleteConfirmBatch && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-6 text-slate-900 space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
                        <div className="flex items-center gap-3 text-rose-600 border-b border-slate-200 pb-3">
                            <div className="p-2.5 bg-rose-100 rounded-xl shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 leading-snug">
                                    Confirmar Eliminación de Lote
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">Acción irreversible según nivel de usuario</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                            ¿Está seguro de eliminar el lote <b>{deleteConfirmBatch.batch_code_display || deleteConfirmBatch.batch_uuid}</b> ({deleteConfirmBatch.product_type})?
                        </p>

                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                            <div className="font-bold">⚠️ Esta acción:</div>
                            <div>• Revertirá el consumo de stock de materia prima utilizada en las tarimas.</div>
                            <div>• Eliminará los registros de mermas y remanentes asociados.</div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs text-center"
                            >
                                Sí, Eliminar Lote
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
