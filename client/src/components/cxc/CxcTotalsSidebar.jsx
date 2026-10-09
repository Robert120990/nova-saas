import { Calendar, DollarSign, Check, FileText, Loader2, Sparkles } from 'lucide-react';
import Money from '../ui/Money';

const CxcTotalsSidebar = ({
    totalAbonado = 0,
    montoManual = '',
    onMontoManualChange,
    formData,
    onFormDataChange,
    onSubmit,
    isSubmitting = false,
}) => {
    return (
        <form 
            onSubmit={onSubmit} 
            className="bg-slate-900 rounded-2xl p-5 shadow-xl text-white space-y-5 sticky top-6 border border-slate-800"
        >
            {/* Cabecera de totales */}
            <div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    <span>Distribución Total</span>
                    <span><Money value={totalAbonado} /></span>
                </div>
                <div className="text-3xl font-black text-center text-white py-3 border-b border-slate-800 tracking-tight">
                    <Money value={totalAbonado} />
                </div>
            </div>
            
            <div className="space-y-4">
                {/* Auto-distribución */}
                <div>
                    <label className="text-[10px] font-black text-indigo-300 uppercase block mb-1.5 tracking-wider flex items-center gap-1.5">
                        <DollarSign size={12} className="text-indigo-400" /> 
                        Distribuir Saldo
                        <span className="text-[9px] font-normal text-slate-400 lowercase">(auto)</span>
                    </label>
                    <div className="relative">
                        <input 
                            type="text" 
                            inputMode="decimal"
                            className="w-full pl-3 pr-8 py-2 bg-slate-800/90 border border-slate-700 hover:border-indigo-400 focus:border-indigo-500 rounded-xl text-white text-xs font-black outline-none transition-all placeholder:text-slate-500" 
                            placeholder="0.00" 
                            value={montoManual}
                            onChange={e => onMontoManualChange(e.target.value)} 
                        />
                        <Sparkles size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400/60 pointer-events-none" />
                    </div>
                </div>

                {/* Fecha de Abono */}
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-wider flex items-center gap-1.5">
                        <Calendar size={12} className="text-indigo-400" /> 
                        Fecha de Abono
                    </label>
                    <input 
                        type="date"
                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl text-white text-xs font-bold outline-none transition-all font-mono"
                        value={formData.fecha}
                        onChange={e => onFormDataChange('fecha', e.target.value)}
                    />
                </div>

                {/* Método de Cobro */}
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-wider flex items-center gap-1.5">
                        <Check size={12} className="text-indigo-400" /> 
                        Método de Cobro
                    </label>
                    <select 
                        value={formData.metodo} 
                        onChange={e => onFormDataChange('metodo', e.target.value)} 
                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl text-white text-xs font-bold outline-none transition-all uppercase cursor-pointer"
                    >
                        <option value="Efectivo" className="bg-slate-900 text-white">Efectivo</option>
                        <option value="Transferencia" className="bg-slate-900 text-white">Transferencia</option>
                        <option value="Cheque" className="bg-slate-900 text-white">Cheque</option>
                        <option value="Tarjeta" className="bg-slate-900 text-white">Tarjeta</option>
                    </select>
                </div>

                {/* Notas / Referencia */}
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5 tracking-wider flex items-center gap-1.5">
                        <FileText size={12} className="text-indigo-400" /> 
                        Notas / Referencia
                    </label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 rounded-xl text-white text-xs font-medium outline-none transition-all uppercase placeholder:text-slate-500" 
                        placeholder="DOC # O NOTAS..." 
                        value={formData.comentario} 
                        onChange={e => onFormDataChange('comentario', e.target.value)} 
                    />
                </div>
            </div>

            {/* Botón de acción principal */}
            <button 
                type="submit" 
                disabled={isSubmitting || totalAbonado <= 0} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 py-3 rounded-xl font-black transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-indigo-600/20 uppercase text-xs tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
                {isSubmitting ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        PROCESANDO...
                    </>
                ) : (
                    'GUARDAR RECIBO'
                )}
            </button>
        </form>
    );
};

export default CxcTotalsSidebar;
