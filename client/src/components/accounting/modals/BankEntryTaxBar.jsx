import { Percent } from 'lucide-react';

const BankEntryTaxBar = ({
    isRemesa = false,
    detallarIva = true,
    onToggleIva,
    taxDetailMode = 'none',
    onTaxModeChange
}) => {
    if (isRemesa) return null;

    const TAX_OPTIONS = [
        { value: 'none', label: 'Ninguna' },
        { value: 'retencion', label: 'Retención (1%)' },
        { value: 'percepcion', label: 'Percepción (1%)' }
    ];

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200/90 rounded-xl shadow-xs">
            {/* Detallar IVA Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                    type="checkbox"
                    checked={detallarIva}
                    onChange={(e) => onToggleIva(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 focus:ring-offset-0 transition-colors cursor-pointer"
                />
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                        Detallar IVA Crédito Fiscal
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 tracking-wider">
                        13%
                    </span>
                </div>
            </label>

            {/* Retención / Percepción Selector */}
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                    <Percent size={12} className="text-slate-400" />
                    Retención / Percepción:
                </span>
                <div className="inline-flex p-0.5 bg-slate-200/70 rounded-lg">
                    {TAX_OPTIONS.map(opt => {
                        const active = taxDetailMode === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                disabled={!detallarIva}
                                onClick={() => onTaxModeChange(opt.value)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                    active
                                        ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                                        : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-600 cursor-pointer disabled:cursor-not-allowed'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BankEntryTaxBar;
