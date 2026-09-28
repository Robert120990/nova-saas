import { CheckCircle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

const PurchaseCheckDeliverModal = ({
    isOpen,
    onClose,
    targetCheck,
    numCheque,
    deliverFecha,
    setDeliverFecha,
    deliverDocumento,
    setDeliverDocumento,
    onDeliver,
    isPending
}) => {
    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-2.5 sm:py-3 px-3.5 sm:px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Entregar Chq Contado"
            maxWidth="max-w-md"
        >
            <div className="space-y-4 sm:space-y-5">
                {targetCheck && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Proveedor</span>
                            <span className="text-xs font-bold text-slate-800 uppercase truncate block" title={targetCheck.provider_nombre}>
                                {targetCheck.provider_nombre || '—'}
                            </span>
                        </div>
                        <div className="sm:text-right shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">N. Cheque</span>
                            <span className="text-xs font-black text-indigo-600 font-mono">
                                {numCheque || '—'}
                            </span>
                        </div>
                    </div>
                )}

                <div>
                    <label className={`${labelCls} block mb-1`}>Fecha de Entrega</label>
                    <input 
                        type="date" 
                        value={deliverFecha} 
                        onChange={(e) => setDeliverFecha(e.target.value)} 
                        className={inputCls} 
                    />
                </div>

                <div>
                    <label className={`${labelCls} block mb-1`}>Documento</label>
                    <input 
                        type="text" 
                        value={deliverDocumento} 
                        onChange={(e) => setDeliverDocumento(e.target.value)}
                        placeholder="No. de documento o referencia" 
                        className={inputCls} 
                    />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
                    <button 
                        type="button" 
                        onClick={onClose}
                        disabled={isPending}
                        className="w-full sm:w-auto px-4 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs uppercase tracking-wider text-center"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onDeliver}
                        disabled={isPending}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
                    >
                        {isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        <span>{isPending ? 'Procesando...' : 'Entregar'}</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseCheckDeliverModal;