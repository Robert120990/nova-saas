import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { AccountingGenerationTab, AccountingCloseoutsTab, AccountingBankTab } from '../components/accounting';

const LABELS = {
    ventas: 'Ventas',
    compras: 'Compras',
    cxc: 'CxC',
    cxp: 'CxP',
    turnos: 'Cierres de Turno',
    bancos: 'Bancos / Cheques'
};

const AccountingGenerate = ({ kinds = ['ventas', 'compras'] }) => {
    const [activeKind, setActiveKind] = useState(kinds[0]);
    const [busy, setBusy] = useState(false);
    const kind = kinds.includes(activeKind) ? activeKind : kinds[0];

    const isCloseouts = kind === 'turnos';
    const isBancos = kind === 'bancos';

    return (
        <div className={`${isBancos ? 'w-full max-w-[1550px]' : isCloseouts ? 'max-w-7xl' : 'max-w-5xl'} mx-auto p-3 sm:p-4 md:p-6 space-y-3 pb-12 transition-all`}>
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3">
                    <Calculator size={28} className="text-indigo-600" />
                    Contabilizar {isCloseouts ? 'Cierres de Turno' : isBancos ? 'Bancos y Cheques' : ''}
                </h1>
                <p className="text-slate-500 mt-1 font-medium">
                    {isCloseouts
                        ? 'Genera la partida de diario de la estación a partir de las lecturas y liquidaciones del turno'
                        : isBancos
                            ? 'Consulta y genera partidas contables de cheques y movimientos bancarios desde la base de oficina'
                            : 'Genera partidas automáticas por día'}
                </p>
            </div>

            {kinds.length > 1 && (
                <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl w-fit max-w-full shadow-inner">
                    {(Array.isArray(kinds) ? kinds : []).map(item => (
                        <button
                            key={item}
                            type="button"
                            disabled={busy}
                            onClick={() => setActiveKind(item)}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all ${
                                kind === item ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {LABELS[item] || item}
                        </button>
                    ))}
                </div>
            )}

            {isCloseouts ? (
                <AccountingCloseoutsTab onBusyChange={setBusy} />
            ) : isBancos ? (
                <AccountingBankTab />
            ) : (
                <AccountingGenerationTab kind={kind} onBusyChange={setBusy} />
            )}
        </div>
    );
};

export default AccountingGenerate;
