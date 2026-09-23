import { Loader2, Radio, ShieldCheck } from 'lucide-react';

/**
 * DteTransmittingOverlay Component
 * Full-screen modal overlay displayed while transmitting a DTE document to Hacienda.
 */
const DteTransmittingOverlay = ({ isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                <div className="relative mb-5">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xl shadow-indigo-100/60">
                        <Loader2 size={38} className="animate-spin text-indigo-600" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-indigo-600 text-white items-center justify-center text-[10px]">
                            <Radio size={12} className="animate-pulse" />
                        </span>
                    </span>
                </div>

                <h3 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    Transmitiendo DTE
                </h3>
                
                <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider mt-2 border border-indigo-200/70">
                    <ShieldCheck size={13} />
                    <span>Firma Electrónica & Hacienda</span>
                </div>

                <p className="text-xs text-slate-500 font-medium mt-4 leading-relaxed max-w-xs">
                    Firmando comprobante y comunicando con los servidores del <strong className="text-slate-700 font-bold">Ministerio de Hacienda</strong>.
                </p>

                <div className="mt-6 p-3 rounded-2xl bg-slate-50 border border-slate-100 w-full flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <span>Por favor no recargue ni cierre esta pantalla</span>
                </div>
            </div>
        </div>
    );
};

export default DteTransmittingOverlay;
