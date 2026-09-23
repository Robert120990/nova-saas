import { FileText, ChevronRight } from 'lucide-react';

/**
 * PosSupervisorAuthModal Component
 * Password and document configuration modal for seller/supervisor authentication.
 */
const PosSupervisorAuthModal = ({
    isOpen,
    onSubmit,
    tipoDte,
    setTipoDte,
    authPassword,
    setAuthPassword,
    onExit
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <form onSubmit={onSubmit} className="bg-white rounded-[3rem] w-full max-w-md p-6 md:p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="p-4 bg-indigo-100 rounded-3xl text-indigo-600 mb-4">
                        <FileText size={40} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Acceso Logística</h3>
                    <p className="text-slate-400 font-bold text-sm mt-2">Configura el documento y verifica tu acceso</p>
                </div>
                
                <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Tipo de Documento</label>
                        <select 
                            value={tipoDte}
                            onChange={(e) => setTipoDte(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                        >
                            <option value="01">Factura (01)</option>
                            <option value="03">Crédito Fiscal (03)</option>
                            <option value="04">Nota Remisión (04)</option>
                            <option value="05">Nota Crédito (05)</option>
                            <option value="07">Comprobante Retención (07)</option>
                            <option value="11">FEX (11)</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Contraseña de Vendedor</label>
                        <input 
                            autoFocus
                            type="password"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-center tracking-[0.5em] outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all placeholder:tracking-normal placeholder:font-bold"
                        />
                    </div>

                    <button 
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 mt-4"
                    >
                        Iniciar Terminal
                        <ChevronRight size={20} />
                    </button>

                    <button 
                        type="button"
                        onClick={onExit}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all mt-4 border border-slate-200 shadow-sm"
                    >
                        Salir al Panel Principal (Esc)
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PosSupervisorAuthModal;
