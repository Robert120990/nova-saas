import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { matchesQuery, matchScore } from '../../utils/fuzzySearch';

const defaultInputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
const compactInputCls = "w-full px-2 py-0.5 bg-white hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-indigo-500 rounded text-[11px] font-mono font-bold outline-none transition-all";

const AccountSelect = ({
    value,
    onChange,
    accounts,
    placeholder = 'Seleccionar cuenta...',
    compact = false,
    showCodeOnly = false,
    className = ''
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [panelPos, setPanelPos] = useState(null);
    const ref = useRef(null);
    const dropdownRef = useRef(null);

    const updatePanelPos = useCallback(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const targetWidth = compact ? Math.max(320, rect.width) : Math.max(rect.width, 260);
        const width = Math.min(targetWidth, viewportWidth - 16);

        let left = rect.left;
        if (left + width > viewportWidth - 8) {
            left = Math.max(8, viewportWidth - width - 8);
        }
        if (left < 8) left = 8;

        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

        if (openUp) {
            const maxHeight = Math.min(260, Math.max(120, spaceAbove - 16));
            setPanelPos({
                bottom: viewportHeight - rect.top + 4,
                left,
                width,
                maxHeight,
                placement: 'top'
            });
        } else {
            const maxHeight = Math.min(260, Math.max(120, spaceBelow - 16));
            setPanelPos({
                top: rect.bottom + 4,
                left,
                width,
                maxHeight,
                placement: 'bottom'
            });
        }
    }, [compact]);

    useEffect(() => {
        if (!open) return;
        updatePanelPos();

        const handleScrollResize = () => {
            updatePanelPos();
        };

        window.addEventListener('scroll', handleScrollResize, true);
        window.addEventListener('resize', handleScrollResize);
        return () => {
            window.removeEventListener('scroll', handleScrollResize, true);
            window.removeEventListener('resize', handleScrollResize);
        };
    }, [open, updatePanelPos]);

    useEffect(() => {
        const handler = (e) => {
            const inContainer = ref.current && ref.current.contains(e.target);
            const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
            if (!inContainer && !inDropdown) setOpen(false);
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

    const displayValue = open
        ? query
        : selected
            ? (showCodeOnly ? selected.code : `${selected.code} - ${selected.name}`)
            : '';

    const dropdownPanel = open && panelPos ? (
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                ...(panelPos.top !== undefined ? { top: panelPos.top } : {}),
                ...(panelPos.bottom !== undefined ? { bottom: panelPos.bottom } : {}),
                left: panelPos.left,
                width: panelPos.width,
                maxHeight: panelPos.maxHeight,
                zIndex: 9999
            }}
            className="overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        >
            {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-400 font-medium">Sin resultados</div>
            )}
            {(Array.isArray(filtered) ? filtered : []).map(a => (
                <button
                    key={a.id}
                    type="button"
                    onClick={() => { onChange(String(a.id)); setOpen(false); setQuery(''); }}
                    className={`w-full text-left ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'} flex items-center gap-2 hover:bg-indigo-50 transition-colors ${a.id == value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}
                >
                    <span className="font-mono text-[11px] font-bold shrink-0">{a.code}</span>
                    <span className="flex-1 truncate text-xs font-medium">{a.name}</span>
                    {a.type_name && <span className="text-[10px] text-slate-400 shrink-0">{a.type_name}</span>}
                </button>
            ))}
        </div>
    ) : null;

    return (
        <div ref={ref} className={`relative ${className}`}>
            <div className="relative">
                <input
                    value={displayValue}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className={`${compact ? compactInputCls : defaultInputCls} ${compact ? 'pr-5' : 'pr-10'}`}
                />
                <Search
                    size={compact ? 12 : 15}
                    className={`absolute ${compact ? 'right-1.5' : 'right-3.5'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`}
                />
            </div>
            {typeof document !== 'undefined' && dropdownPanel && createPortal(dropdownPanel, document.body)}
        </div>
    );
};

export default AccountSelect;
