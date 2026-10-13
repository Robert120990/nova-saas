import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Wrench, Check, AlertCircle } from 'lucide-react';

export const FixAccountModal = ({ open, onClose, account, onFixed }) => {
    const [loading, setLoading] = useState(false);

    if (!open || !account) return null;

    const handleAction = async (action, value) => {
        setLoading(true);
        try {
            const res = await axios.post('/api/accounting/audit/quick-fix', {
                accountId: account.accountId,
                action,
                value
            });
            if (res.data?.success) {
                toast.success(res.data.message || 'Corrección aplicada con éxito');
                if (onFixed) onFixed();
                onClose();
            }
        } catch (err) {
            console.error('Error applying quick fix:', err);
            toast.error(err.response?.data?.message || 'Error al aplicar la corrección rápida');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                            <Wrench className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                Corrección Rápida de Cuenta
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {account.code} - {account.name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 text-xs">
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                            <span className="font-bold block text-[11px] uppercase tracking-wider mb-0.5">
                                {account.category}
                            </span>
                            <p className="text-xs">{account.description}</p>
                            <p className="text-xs font-semibold mt-1">Recomendación: {account.recommendation}</p>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Acciones de Regularización Sugeridas:
                        </span>

                        {account.category?.includes('Mayor') || account.description?.includes('permite movimientos') ? (
                            <button
                                onClick={() => handleAction('toggle_allows_entries', 0)}
                                disabled={loading}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-colors font-medium text-slate-700 dark:text-slate-200"
                            >
                                <div>
                                    <span className="font-bold block text-slate-800 dark:text-white">Bloquear Asientos Directos</span>
                                    <span className="text-slate-500 text-[11px]">Convertir en cuenta agrupadora/de mayor (allows_entries = 0)</span>
                                </div>
                                <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                            </button>
                        ) : null}

                        {account.category?.includes('Detalle') || account.description?.includes('hoja') ? (
                            <button
                                onClick={() => handleAction('toggle_allows_entries', 1)}
                                disabled={loading}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-left transition-colors font-medium text-slate-700 dark:text-slate-200"
                            >
                                <div>
                                    <span className="font-bold block text-slate-800 dark:text-white">Habilitar Asientos Directos</span>
                                    <span className="text-slate-500 text-[11px]">Convertir en cuenta de detalle/auxiliar (allows_entries = 1)</span>
                                </div>
                                <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                            </button>
                        ) : null}

                        <button
                            onClick={() => handleAction('toggle_active')}
                            disabled={loading}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors font-medium text-slate-700 dark:text-slate-200"
                        >
                            <div>
                                <span className="font-bold block text-slate-800 dark:text-white">Alternar Estado (Activa / Inactiva)</span>
                                <span className="text-slate-500 text-[11px]">Cambiar la disponibilidad operativa de la cuenta</span>
                            </div>
                            <Wrench className="w-4 h-4 text-slate-500 shrink-0 ml-2" />
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-800/40">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};
