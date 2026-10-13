import { Receipt, Building2, Ban, CheckCircle2 } from 'lucide-react';

export default function RestaurantDteSelector({ dteType, onSelectType }) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                ¿Desea emitir Documento Tributario Electrónico (DTE)?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                    type="button"
                    onClick={() => onSelectType('01')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                        dteType === '01'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <Receipt size={18} className={dteType === '01' ? 'text-indigo-600' : 'text-slate-400'} />
                        {dteType === '01' && <CheckCircle2 size={16} className="text-indigo-600" />}
                    </div>
                    <div>
                        <div className="font-black text-xs">Factura (01)</div>
                        <div className="text-[10px] text-slate-500">Consumidor Final</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onSelectType('03')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                        dteType === '03'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <Building2 size={18} className={dteType === '03' ? 'text-indigo-600' : 'text-slate-400'} />
                        {dteType === '03' && <CheckCircle2 size={16} className="text-indigo-600" />}
                    </div>
                    <div>
                        <div className="font-black text-xs">Crédito Fiscal (03)</div>
                        <div className="text-[10px] text-slate-500">Empresa / Con NRC</div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => onSelectType('none')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                        dteType === 'none'
                            ? 'border-amber-600 bg-amber-50/70 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <Ban size={18} className={dteType === 'none' ? 'text-amber-600' : 'text-slate-400'} />
                        {dteType === 'none' && <CheckCircle2 size={16} className="text-amber-600" />}
                    </div>
                    <div>
                        <div className="font-black text-xs">Sin DTE</div>
                        <div className="text-[10px] text-slate-500">Ticket interno</div>
                    </div>
                </button>
            </div>
        </div>
    );
}
