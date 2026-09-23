import { X, Clock, RefreshCcw, FileText } from 'lucide-react';
import Money from '../../ui/Money';

export default function EggAgreementHistoryModal({
    open,
    agreement,
    history = [],
    loading = false,
    onClose
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Línea de Tiempo • Auditoría de Precios</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                            Historial de Tarifas: {agreement?.customer_name}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                            {agreement?.product_type} ({agreement?.presentation})
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-slate-400">
                        <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                        <span>Cargando historial de revisiones...</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span>No hay revisiones previas archivadas para este cliente todavía.</span>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {history.map((item, index) => (
                            <div key={item.id || index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-slate-900">
                                            <Money value={item.agreed_price_per_lb} /> / Lb
                                        </span>
                                        {item.previous_price_per_lb && (
                                            <span className="text-[11px] text-slate-400 font-medium line-through">
                                                anterior: <Money value={item.previous_price_per_lb} />
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {new Date(item.created_at).toLocaleString()}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                                    <div>
                                        <span className="font-bold text-slate-500">Vigencia: </span>
                                        <span className="font-mono">
                                            {item.valid_from ? new Date(item.valid_from).toLocaleDateString() : 'Sin inicio'}
                                            {' → '}
                                            {item.valid_to ? new Date(item.valid_to).toLocaleDateString() : 'Permanente'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-500">Registrado por: </span>
                                        <span>{item.changed_by || 'Sistema'}</span>
                                    </div>
                                </div>

                                {item.change_reason && (
                                    <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-100 italic">
                                        "{item.change_reason}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex justify-end pt-3 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
