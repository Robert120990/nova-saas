import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { matchesQuery, matchScore } from '../../utils/fuzzySearch';
const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

const AccountSelect = ({ value, onChange, accounts, placeholder = 'Seleccionar cuenta...' }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const filtered = safeAccounts
        .filter(a => !query || matchesQuery(`${a.code} ${a.name} ${a.type_name || ''}`, query))
        .map(a => ({ a, score: query ? matchScore(`${a.code} ${a.name} ${a.type_name || ''}`, query) : 0 }))
        .sort((x, y) => x.score - y.score)
        .map(x => x.a);
    const selected = safeAccounts.find(a => a.id == value);

    return (
        <div ref={ref} className="relative">
            <div className="relative">
                <input
                    value={open ? query : (selected ? `${selected.code} - ${selected.name}` : '')}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={`${inputCls} pr-10`}
                />
                <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {open && (
                <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
                    {filtered.length === 0 && (
                        <div className="px-4 py-4 text-xs text-slate-400 font-medium">Sin resultados</div>
                    )}
                    {(Array.isArray(filtered) ? filtered : []).map(a => (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => { onChange(String(a.id)); setOpen(false); setQuery(''); }}
                            className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-indigo-50 transition-colors ${a.id == value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                        >
                            <span className="font-mono text-[11px] font-bold shrink-0">{a.code}</span>
                            <span className="flex-1 truncate text-[13px] font-medium">{a.name}</span>
                            {a.type_name && <span className="text-[10px] text-slate-400 shrink-0">{a.type_name}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};


export default AccountSelect;
