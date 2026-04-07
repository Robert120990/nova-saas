import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * Super Defensive SearchableSelect
 * Prevents app crashes if options are null, opt is null, or properties missing.
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
    codeLabel = "CÓDIGO"
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    // Ensure options is always an array
    const safeOptions = Array.isArray(options) ? options : [];

    const selectedOption = (value !== undefined && value !== null && value !== '') 
        ? safeOptions.find(opt => opt && String(opt[valueKey]) === String(value)) 
        : null;
    
    const filteredOptions = safeOptions.filter(opt => {
        if (!opt) return false;
        const s = (search || '').toLowerCase();
        const v = String(opt[valueKey] || '').toLowerCase();
        const l = String(opt[labelKey] || '').toLowerCase();
        const c = codeKey ? String(opt[codeKey] || '').toLowerCase() : '';
        
        return v.includes(s) || l.includes(s) || c.includes(s);
    }).slice(0, 100);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        if (!option) return;
        onChange({ target: { name, value: option[valueKey] } });
        setIsOpen(false);
        setSearch('');
    };

    const isSelected = (opt) => {
        if (!opt || value === undefined || value === null || value === '') return false;
        return String(value) === String(opt[valueKey]);
    };

    return (
        <div className="relative" ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-1.5 bg-white border rounded-xl flex items-center justify-between transition-all text-[11px] font-bold uppercase cursor-pointer ${
                    isOpen ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                }`}
            >
                <div className="truncate pr-2">
                    {selectedOption ? (
                        <span className="truncate">
                            {displayKey 
                                ? selectedOption[displayKey] 
                                : `${codeKey ? (selectedOption[codeKey] || 'N/A') : (selectedOption[valueKey] || 'N/A')} - ${selectedOption[labelKey] || 'Sin nombre'}`
                            }
                        </span>
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
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
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, i) => (
                                <div 
                                    key={opt[valueKey] || i}
                                    onClick={() => handleSelect(opt)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                                        isSelected(opt) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600'
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
                                No se encontraron resultados
                            </div>
                        )}
                    </div>
                </div>
            )}
            <input type="hidden" name={name} value={value || ''} />
        </div>
    );
};

export default SearchableSelect;
