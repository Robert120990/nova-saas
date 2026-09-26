import { PackageCheck, Landmark, ArrowLeftRight, X } from 'lucide-react';

export default function GasOrderMethodModal({ open, order, onClose, onSelectMethod }) {
    if (!open || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <PackageCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">
                                    Recibir Pedido #{order.numero || order.id}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Seleccione el método de pago para registrar la descarga:
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        {/* Opción 1: Pago con Cheque */}
                        <button
                            type="button"
                            onClick={() => onSelectMethod('CHEQUE')}
                            className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 text-left transition-all group flex flex-col justify-between cursor-pointer space-y-3"
                        >
                            <div className="p-2.5 w-fit rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <Landmark className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-900">
                                    Pago con Cheque(s)
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Registro de uno o más cheques bancarios con verificación de vouchers, descuento de cupones y notas de crédito.
                                </p>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                Continuar &rarr;
                            </span>
                        </button>

                        {/* Opción 2: Pago por Transferencia */}
                        <button
                            type="button"
                            onClick={() => onSelectMethod('TRANSFERENCIA')}
                            className="p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group flex flex-col justify-between cursor-pointer space-y-3"
                        >
                            <div className="p-2.5 w-fit rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <ArrowLeftRight className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-emerald-900">
                                    Pago por Transferencia
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                    Registro directo a cuenta bancaria con número de referencia, fecha de pago y registro en movimientos bancarios.
                                </p>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                Continuar &rarr;
                            </span>
                        </button>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
