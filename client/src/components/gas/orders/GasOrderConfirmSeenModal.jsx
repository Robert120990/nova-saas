import { Eye, RefreshCw, Check } from 'lucide-react';

export default function GasOrderConfirmSeenModal({ open, order, onClose, onConfirm, isLoading }) {
    if (!open || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                            <Eye className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                ¿Marcar Pedido como Visto?
                            </h3>
                            <p className="text-xs text-slate-500">
                                Pedido #{order.numero || order.id}
                            </p>
                        </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        El estado del pedido cambiará a <strong className="text-sky-700">VISTO</strong> para indicar que la estación tiene conocimiento del pedido y se encuentra lista para recibir la descarga.
                    </p>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm(order.id)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            {isLoading ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Check className="w-3.5 h-3.5" />
                            )}
                            <span>Confirmar y Marcar como Visto</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
