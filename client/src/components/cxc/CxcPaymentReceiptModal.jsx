import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

const metodoBadge = (m) => {
    const map = {
        Efectivo: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        Transferencia: 'bg-blue-50 text-blue-700 border-blue-100',
        Cheque: 'bg-violet-50 text-violet-700 border-violet-100',
        Tarjeta: 'bg-amber-50 text-amber-700 border-amber-100',
    };
    return map[m] || 'bg-slate-50 text-slate-600 border-slate-100';
};

const CxcPaymentReceiptModal = ({ paymentId, onClose }) => {
    const { data: pay, isLoading } = useQuery({
        queryKey: ['cxc-payment-detail', paymentId],
        queryFn: async () => (await axios.get(`/api/cxc/payments/${paymentId}`)).data,
        enabled: !!paymentId
    });

    if (!paymentId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tight text-indigo-600">Comprobante de Abono</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">RECIBO #{paymentId}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </div>
                {isLoading ? (
                    <div className="p-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando recibo...</div>
                ) : pay ? (
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente</span>
                                    <span className="text-xs font-black text-slate-800 uppercase">{pay.cliente_nombre}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto Cobrado</span>
                                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                                        <Money value={pay.monto || 0} />
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-4 sm:text-right">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Cobro</span>
                                    <span className="text-xs font-bold text-slate-700 block">{formatDate(pay.fecha_pago)}</span>
                                </div>
                                <div className="mt-2">
                                    <span className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase border inline-block ${metodoBadge(pay.metodo_pago)}`}>
                                        {pay.metodo_pago}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {pay.notas && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Notas / Referencia</span>
                                <p className="font-medium text-slate-600 uppercase">{pay.notas}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">No se pudo cargar el recibo</div>
                )}
            </div>
        </div>
    );
};

export default CxcPaymentReceiptModal;
