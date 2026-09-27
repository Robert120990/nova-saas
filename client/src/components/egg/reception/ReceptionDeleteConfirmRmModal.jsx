import {
    AlertTriangle
} from 'lucide-react';


export default function ReceptionDeleteConfirmRmModal({ model, open = model.deleteConfirmRm, onClose = () => model.setDeleteConfirmRm(null) }) {
    const { deleteConfirmRm, handleDeleteReception } = model;
    if (!open) return null;
    return (<>{deleteConfirmRm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 text-slate-900 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600 border-b border-slate-200 pb-3">
                            <div className="p-2.5 bg-rose-100 rounded-xl">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                    Eliminar Recepción de Materia Prima
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">Acción administrativa por nivel de rol</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                            ¿Está seguro de eliminar permanentemente la recepción <b>{deleteConfirmRm.provider_lot || `REC-${deleteConfirmRm.id}`}</b> de <b>{deleteConfirmRm.provider_name}</b>?
                        </p>

                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                            <div className="font-bold">⚠️ Advertencia:</div>
                            <div>• Se eliminarán las tarimas y datos asociados a este ingreso ({parseFloat(deleteConfirmRm.weight_lbs || 0).toLocaleString()} Lbs).</div>
                            <div>• Si ya se utilizó en producciones, el sistema bloqueará la eliminación para proteger la trazabilidad.</div>
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
                                type="button"
                                onClick={handleDeleteReception}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Sí, Eliminar Recepción
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
