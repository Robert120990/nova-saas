import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, Check, X, Loader2 } from 'lucide-react';
import { matchScore } from '../../utils/fuzzySearch';

/**
 * Super Defensive SearchableSelect
 * Prevents app crashes if options are null, opt is null, or properties missing.
 *
 * Modo local (por defecto): filtra `options` en el cliente.
 * Modo remoto: si se pasa `loadOptions(search, page) => Promise<{ data, total, totalPages }>`,
 * busca en el servidor con debounce y carga incremental (scroll). La llamada `onChange`
 * recibe `(event, option)` donde `option` es el objeto seleccionado.
 * `dropdownWidth` (px) hace el panel más ancho que el campo y lo posiciona con `fixed`
 * para evitar recortes por contenedores con overflow.
 */
const SearchableSelect = ({
    options = [],
    value,
    onChange,
    placeholder = "Seleccionar...",
    name,
    valueKey = 'code',
    labelKey = 'description',
    displayKey = null, 
    codeKey = null,
    codeLabel = "CÓDIGO",
    disabled = false,
    searchKeys = null,
    loadOptions = null,
    selectedLabel = null,
    dropdownWidth = null,
    debounceMs = 500
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [focusIdx, setFocusIdx] = useState(-1);
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const listRef = useRef(null);

    const [remoteOptions, setRemoteOptions] = useState([]);
    const [remotePage, setRemotePage] = useState(1);
    const [remoteHasMore, setRemoteHasMore] = useState(false);
    const [remoteLoading, setRemoteLoading] = useState(false);
    const [panelPos, setPanelPos] = useState(null);
    const requestSeqRef = useRef(0);
    const skipDebounceRef = useRef(false);

    // Mantener siempre la última referencia de loadOptions para evitar
    // que cambios de identidad (re-renders del padre) disparen re-fetch en bucle
    const loadOptionsRef = useRef(loadOptions);
    useEffect(() => {
        loadOptionsRef.current = loadOptions;
    }, [loadOptions]);

    // Ensure options is always an array
    const safeOptions = Array.isArray(options) ? options : [];

    const loadRemotePage = useCallback(async (searchTerm, page, append) => {
        const seq = ++requestSeqRef.current;
        setRemoteLoading(true);
        try {
            const res = await loadOptionsRef.current(searchTerm, page);
            if (seq !== requestSeqRef.current) return;
            const data = Array.isArray(res?.data) ? res.data : [];
            setRemotePage(page);
            setRemoteHasMore((res?.totalPages || 0) > page);
            setRemoteOptions(prev => (append ? [...prev, ...data] : data));
        } catch (err) {
            if (seq !== requestSeqRef.current) return;
            if (!append) setRemoteOptions([]);
        } finally {
            if (seq === requestSeqRef.current) setRemoteLoading(false);
        }
    }, []);

    const effectiveOptions = loadOptions ? remoteOptions : safeOptions;

    const selectedOption = (value !== undefined && value !== null && value !== '') 
        ? effectiveOptions.find(opt => opt && String(opt[valueKey]) === String(value)) || null
        : null;

    const displayText = selectedOption
        ? (displayKey 
            ? selectedOption[displayKey] 
            : `${codeKey ? (selectedOption[codeKey] || 'N/A') : (selectedOption[valueKey] || 'N/A')} - ${selectedOption[labelKey] || 'Sin nombre'}`)
        : (selectedLabel || null);

    const filteredOptions = loadOptions
        ? effectiveOptions
        : safeOptions.map(opt => {
            if (!opt) return null;
            const s = (search || '').trim();
            if (!s) return { opt, score: 0 };
            let text;
            if (Array.isArray(searchKeys) && searchKeys.length > 0) {
                text = searchKeys.map(k => String(opt[k] ?? '')).join(' ');
            } else {
                const v = String(opt[valueKey] || '');
                const l = String(opt[labelKey] || '');
                const c = codeKey ? String(opt[codeKey] || '') : '';
                text = `${v} ${l} ${c}`;
            }
            const score = matchScore(text, s);
            return score === null ? null : { opt, score };
        })
        .filter(Boolean)
        .sort((a, b) => a.score - b.score)
        .slice(0, 100)
        .map(x => x.opt);

    const computePanelPos = useCallback(() => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const w = Math.min(dropdownWidth, window.innerWidth - 16);
        let left = rect.left;
        if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
        return { top: rect.bottom + 4, left, width: w };
    }, [dropdownWidth]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) setFocusIdx(-1);
    }, [isOpen]);

    // Debounce de búsqueda remota
    useEffect(() => {
        if (!isOpen || !loadOptionsRef.current) return;
        if (skipDebounceRef.current) { skipDebounceRef.current = false; return; }
        const timer = setTimeout(() => {
            setFocusIdx(-1);
            loadRemotePage(search, 1, false);
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [search, isOpen, loadRemotePage, debounceMs]);

    // Reposicionar panel ancho al hacer scroll/resize
    useEffect(() => {
        if (!isOpen || !dropdownWidth) return;
        const onScrollResize = () => setPanelPos(computePanelPos());
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);
        return () => {
            window.removeEventListener('scroll', onScrollResize, true);
            window.removeEventListener('resize', onScrollResize);
        };
    }, [isOpen, dropdownWidth, computePanelPos]);

    const toggleOpen = () => {
        if (disabled) return;
        const next = !isOpen;
        setIsOpen(next);
        if (next) {
            setSearch('');
            setFocusIdx(-1);
            if (loadOptions) {
                skipDebounceRef.current = true;
                loadRemotePage('', 1, false);
            }
            if (dropdownWidth) setPanelPos(computePanelPos());
        }
    };

    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleOpen();
            }
            return;
        }
        switch (e.key) {
            case 'Escape':
                setIsOpen(false);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setFocusIdx(prev => Math.min(prev + 1, filteredOptions.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setFocusIdx(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (focusIdx >= 0 && focusIdx < filteredOptions.length) {
                    handleSelect(filteredOptions[focusIdx]);
                }
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (option) => {
        if (!option) return;
        onChange({ target: { name, value: option[valueKey] } }, option);
        setIsOpen(false);
        setSearch('');
    };

    const handleListScroll = (e) => {
        if (!loadOptions || remoteLoading || !remoteHasMore) return;
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
            loadRemotePage(search, remotePage + 1, true);
        }
    };

    const isSelected = (opt) => {
        if (!opt || value === undefined || value === null || value === '') return false;
        return String(value) === String(opt[valueKey]);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div 
                ref={triggerRef}
                tabIndex={disabled ? -1 : 0}
                role="button"
                onClick={toggleOpen}
                onKeyDown={disabled ? undefined : handleKeyDown}
                className={`w-full px-3 py-1.5 bg-white border rounded-xl flex items-center justify-between transition-all text-[11px] font-bold uppercase outline-none ${
                    disabled
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'cursor-pointer focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 hover:border-slate-300'
                } ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-200'}`}
            >
                <div className="truncate pr-2">
                    {displayText ? (
                        <span className="truncate">{displayText}</span>
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div 
                    className={`z-[100] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 ${
                        dropdownWidth ? 'fixed' : 'absolute mt-1 w-full'
                    }`}
                    style={dropdownWidth ? (panelPos || computePanelPos()) : undefined}
                >
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input 
                            autoFocus
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full bg-transparent border-none outline-none py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-0"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="p-1 hover:text-slate-600 rounded text-slate-400 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                        {loadOptions && remoteLoading && (
                            <Loader2 size={14} className="text-indigo-500 animate-spin shrink-0" />
                        )}
                    </div>
                    <div ref={listRef} onScroll={handleListScroll} className="max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, i) => (
                                <div 
                                    key={opt[valueKey] || i}
                                    onClick={() => handleSelect(opt)}
                                    onMouseEnter={() => setFocusIdx(i)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                                        focusIdx === i ? 'bg-indigo-50' : ''
                                    } ${
                                        isSelected(opt) ? 'text-indigo-700 font-bold' : 'text-slate-600'
                                    }`}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-mono text-slate-400 uppercase">{codeLabel}: {codeKey ? opt[codeKey] : opt[valueKey]}</span>
                                        <span className="truncate text-[10px] font-bold text-slate-700">{displayKey ? opt[displayKey] : opt[labelKey]}</span>
                                    </div>
                                    {isSelected(opt) && <Check size={14} className="text-indigo-600" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-slate-400 text-sm italic">
                                {remoteLoading && loadOptions ? 'Cargando...' : 'No se encontraron resultados'}
                            </div>
                        )}
                    </div>
                    {loadOptions && !remoteLoading && remoteHasMore && (
                        <div className="p-1.5 border-t border-slate-100 text-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Deslice para cargar más...
                        </div>
                    )}
                </div>
            )}
            <input type="hidden" name={name} value={value || ''} />
        </div>
    );
};

export default SearchableSelect;
