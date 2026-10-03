import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { AccountingGenerationTab } from '../components/accounting';
const LABELS = { ventas: 'Ventas', compras: 'Compras', cxc: 'CxC', cxp: 'CxP' };
const AccountingGenerate = ({ kinds = ['ventas', 'compras'] }) => {
    const [activeKind, setActiveKind] = useState(kinds[0]);
    const [busy, setBusy] = useState(false);
    const kind = kinds.includes(activeKind) ? activeKind : kinds[0];
    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-20">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><Calculator size={28} className="text-indigo-600" />Contabilizar</h1>
                <p className="text-slate-500 mt-1 font-medium">Genera partidas automáticas por día</p>
            </div>
            <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl w-fit max-w-full shadow-inner">
                {(Array.isArray(kinds) ? kinds : []).map(item => (
                    <button key={item} type="button" disabled={busy} onClick={() => setActiveKind(item)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 ${kind === item ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500'}`}>{LABELS[item]}</button>
                ))}
            </div>
            <AccountingGenerationTab kind={kind} onBusyChange={setBusy} />
        </div>
    );
};
export default AccountingGenerate;
