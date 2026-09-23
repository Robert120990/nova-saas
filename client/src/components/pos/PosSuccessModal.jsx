import { CheckCircle2, Printer } from 'lucide-react';

/**
 * PosSuccessModal Component
 * Modal shown upon successful sale processing, providing details and ticket printing options.
 */
const PosSuccessModal = ({
    isOpen,
    saleResult,
    onPrintTicket,
    onNewSale
}) => {
    if (!isOpen || !saleResult) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[400] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-6 md:p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="p-4 bg-emerald-100 rounded-3xl text-emerald-600 mb-4">
                        <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">¡Venta Exitosa!</h3>
                    <p className="text-slate-400 font-bold text-sm mt-2">El documento ha sido procesado correctamente</p>
                </div>

                <div className="bg-slate-50 rounded-3xl p-6 space-y-4 mb-8">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Documento</span>
                        <span className="font-bold text-slate-900">{saleResult.tipoDteName}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Número Control</span>
                        <span className="font-mono font-bold text-indigo-600 tracking-tighter">{saleResult.dte?.numero_control || '---'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total</span>
                        <span className="text-xl font-black text-slate-900 tracking-tight">${saleResult.totals?.total?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Código Generación</span>
                        <span className="font-mono text-[10px] text-slate-500 break-all bg-white p-2 rounded-xl border border-slate-100">{saleResult.dte?.codigo_generacion || '---'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <button 
                        type="button"
                        onClick={() => onPrintTicket(saleResult)}
                        className="flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl transition-all active:scale-95 w-full cursor-pointer"
                    >
                        <Printer size={20} />
                        Imprimir Ticket  [F10]
                    </button>
                    <button 
                        type="button"
                        onClick={onNewSale}
                        className="flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:border-indigo-100 hover:text-indigo-600 text-slate-500 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all w-full cursor-pointer"
                    >
                        Nueva Venta  [Enter]
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PosSuccessModal;
