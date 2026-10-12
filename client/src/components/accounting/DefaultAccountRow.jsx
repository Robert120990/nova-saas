import { CheckCircle2, AlertCircle, XCircle, Trash2 } from 'lucide-react';
import AccountSelect from './AccountSelect';

const DefaultAccountRow = ({
    item,
    accounts = [],
    onSetAccount,
    onRemoveCustomKey
}) => {
    const isConfigured = item.isConfigured;

    return (
        <div
            className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 min-w-0 ${
                isConfigured
                    ? 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300'
                    : 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
            }`}
        >
            {/* Información Descriptiva Compacta */}
            <div className="space-y-0.5 flex-1 min-w-0 pr-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-xs sm:text-[13px] font-black text-slate-800 tracking-tight">
                        {item.label}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[9px] font-bold">
                        {item.key}
                    </span>
                    {isConfigured ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                            <CheckCircle2 size={10} /> Configurada
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                            <AlertCircle size={10} /> Pendiente
                        </span>
                    )}
                </div>
                {item.description && (
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                        {item.description}
                    </p>
                )}
            </div>

            {/* Selector de Cuenta y Acciones */}
            <div className="flex items-center gap-1.5 w-full md:w-[320px] lg:w-[380px] shrink-0 min-w-0">
                <div className="flex-1 min-w-0">
                    <AccountSelect
                        value={item.account_id}
                        onChange={val => onSetAccount(item.key, val)}
                        accounts={accounts}
                        placeholder="Seleccionar cuenta..."
                    />
                </div>
                {isConfigured && (
                    <button
                        type="button"
                        onClick={() => onSetAccount(item.key, '')}
                        title="Desvincular cuenta"
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                        <XCircle size={16} />
                    </button>
                )}
                {!item.isKnown && (
                    <button
                        type="button"
                        onClick={() => onRemoveCustomKey(item.key)}
                        title="Eliminar clave personalizada"
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default DefaultAccountRow;
