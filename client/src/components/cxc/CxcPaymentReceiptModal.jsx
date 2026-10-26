import { X, Printer } from 'lucide-react';
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

const CxcPaymentReceiptModal = ({ paymentId, onClose, onPrintPDF }) => {
    const { data: pay, isLoading } = useQuery({
        queryKey: ['cxc-payment-detail', paymentId],
        queryFn: async () => (await axios.get(`/api/cxc/payments/${paymentId}`)).data,
        enabled: !!paymentId
    });

    if (!paymentId) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-base font-black text-slate-800 uppercase tracking-tight text-indigo-600">Comprobante de Abono</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">RECIBO #{String(pay?.recibo_numero || paymentId).padStart(6, '0')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {onPrintPDF && pay && (
                            <button 
                                type="button"
                                onClick={() => onPrintPDF(pay.recibo_numero || paymentId)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                                title="Imprimir / Descargar Recibo"
                            >
                                <Printer size={14} />
                                <span>Imprimir</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600 cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>
                </div>
                {isLoading ? (
                    <div className="p-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando recibo...</div>
                ) : pay ? (
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                            <div className="space-y-3">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Cliente</span>
                                    <span className="text-xs font-black text-slate-800 uppercase">{pay.cliente_nombre}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Monto Total Cobrado</span>
                                    <span className="text-2xl font-black text-indigo-600 tracking-tight">
                                        <Money value={pay.monto || 0} />
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-3 sm:text-right">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Fecha de Pago</span>
                                    <span className="text-xs font-bold text-slate-700 block">{formatDate(pay.fecha_pago)}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Método</span>
                                    <span className={`px-2.5 py-0.5 rounded-lg font-black text-[9px] uppercase border inline-block ${metodoBadge(pay.metodo_pago)}`}>
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

                        {pay.documentos && pay.documentos.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                                    <span>Documentos Abonados ({pay.documentos.length})</span>
                                    <span>Monto Abonado</span>
                                </div>
                                <div className="max-h-64 overflow-y-auto border border-slate-200/80 rounded-xl divide-y divide-slate-100 bg-white">
                                    {pay.documentos.map((d, idx) => (
                                        <div key={d.id || idx} className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                                            <div>
                                                <div className="font-bold text-slate-800 uppercase text-[11px] leading-tight">
                                                    {d.documento_aplicado || d.documento_tipo}
                                                </div>
                                                <div className="text-[9.5px] text-slate-400 font-mono leading-tight">
                                                    {formatDate(d.fecha_documento)} · Total: <Money value={d.total_documento || 0} />
                                                </div>
                                            </div>
                                            <div className="font-black text-slate-900 text-right text-xs">
                                                <Money value={d.monto || 0} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
