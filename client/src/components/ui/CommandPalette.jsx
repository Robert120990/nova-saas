import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, CornerDownLeft, Calculator, Ticket, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useMenuItems, GROUP_MODULE_MAP, ITEM_MODULE_MAP } from '../../hooks/useMenuItems';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketContext';
import { useSafeNavigate } from '../../hooks/useSafeNavigate';
import { evaluateSafeMath, copyTextToClipboard } from '../../utils/calculatorUtils';

const TICKET_KEYWORDS = ['ticket', 'tickets', 'soporte', 'problema', 'requerimiento', 'ayuda', 'bug', 'reportar'];

const CommandPalette = ({ isOpen, onClose }) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const { safeNavigate } = useSafeNavigate();
    const { user } = useAuth();
    const { openQuickTicket } = useTickets();
    const { flatItems } = useMenuItems();

    const isSuperAdmin = user?.role === 'SuperAdmin';

    const permissions = useMemo(() => {
        if (!user?.permissions) return [];
        if (Array.isArray(user.permissions)) return user.permissions;
        try { return JSON.parse(user.permissions); } catch { return []; }
    }, [user?.permissions]);

    const hasPermission = (item) => {
        if (isSuperAdmin || !item.permission_key) return true;
        if (item.permission_key === 'manage_company_modules') {
            return permissions.includes('manage_company_modules') || permissions.includes('manage_system_settings');
        }
        const userRole = (user?.role || '').toLowerCase();
        const isAdminRole = userRole.includes('admin') || userRole.includes('geren') || userRole.includes('supervis');
        if (item.permission_key === 'manage_customer_agreements' || item.permission_key === 'view_crm') {
            if (isAdminRole || permissions.includes('manage_sales') || permissions.includes('view_sales')) return true;
        }
        if (item.permission_key === 'manage_production') {
            if (isAdminRole || userRole.includes('operacion') || permissions.includes('view_industrial_dashboard')) return true;
        }
        return permissions.includes(item.permission_key);
    };

    const navigableItems = useMemo(() => {
        const results = [];
        const isAndelsaContext = user?.company_id === 9 ||
            (typeof user?.company_name === 'string' && user.company_name.toUpperCase().includes('ANDELSA')) ||
            (typeof window !== 'undefined' && window.location.hostname.includes('andelsa'));

        flatItems.forEach(item => {
            if (!item.path || !hasPermission(item) || item.hide_in_menu) return;

            let groupLabel = '';
            if (item.parent_id) {
                let curr = item;
                const visited = new Set();
                while (curr && curr.parent_id && !visited.has(curr.id)) {
                    visited.add(curr.id);
                    const p = flatItems.find(f => f.id === curr.parent_id);
                    if (!p) break;
                    curr = p;
                }
                groupLabel = curr?.label || '';
            } else if (item.path?.startsWith('/industrial/')) {
                groupLabel = 'Huevo Industrial';
            } else if (item.path?.startsWith('/crm/')) {
                groupLabel = 'CRM';
            }

            if (groupLabel && GROUP_MODULE_MAP[groupLabel]) {
                const reqModule = GROUP_MODULE_MAP[groupLabel];
                const isAndelsaExempt = isAndelsaContext && (reqModule === 'egg_industrial' || reqModule === 'crm');
                if (!isAndelsaExempt && Array.isArray(user?.enabled_modules) && !user.enabled_modules.includes(reqModule)) {
                    return;
                }
            }

            if (item.path && ITEM_MODULE_MAP[item.path]) {
                const reqMod = ITEM_MODULE_MAP[item.path];
                if (Array.isArray(user?.enabled_modules) && !user.enabled_modules.includes(reqMod)) {
                    return;
                }
            }

            results.push({ id: item.id, label: item.label, path: item.path, group: groupLabel, permission_key: item.permission_key });
        });

        return results;
    }, [flatItems, permissions, isSuperAdmin, user?.enabled_modules, user?.company_id, user?.company_name]);

    const calcResult = useMemo(() => evaluateSafeMath(search), [search]);
    const hasCalc = calcResult !== null;

    const ticketMatch = useMemo(() => {
        const raw = search.trim();
        if (!raw) return null;
        const lower = raw.toLowerCase();
        const prefixMatch = raw.match(/^(?:ticket|soporte|problema|requerimiento|bug)\s*[:-]?\s*(.*)$/i);
        if (prefixMatch) return { initialSubject: (prefixMatch[1] || '').trim() };
        if (TICKET_KEYWORDS.some(k => k.includes(lower) || lower.includes(k))) return { initialSubject: '' };
        return null;
    }, [search]);

    const hasTicketShortcut = Boolean(ticketMatch);
    const specialSlots = (hasTicketShortcut ? 1 : 0) + (hasCalc ? 1 : 0);

    const filteredItems = useMemo(() => {
        if (!search.trim()) return [];
        const query = search.toLowerCase().trim();
        return navigableItems.filter(item => item.label.toLowerCase().includes(query) || item.group.toLowerCase().includes(query));
    }, [search, navigableItems]);

    useEffect(() => { setSelectedIndex(0); }, [search]);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSelectItem = (path) => {
        onClose();
        safeNavigate(path);
    };

    const handleTriggerQuickTicket = () => {
        const subjectText = ticketMatch?.initialSubject || '';
        onClose();
        openQuickTicket({ subject: subjectText, autoCapture: true });
    };

    const handleCopyCalc = async (val) => {
        if (val === null || val === undefined) return;
        const textVal = val.toString();
        await copyTextToClipboard(textVal);
        toast.success(`Resultado ${textVal} copiado al portapapeles`);
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            const total = specialSlots + filteredItems.length;
            if (total === 0 && e.key !== 'Escape') return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => (prev < total - 1 ? prev + 1 : 0));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : total - 1));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (hasTicketShortcut && selectedIndex === 0) {
                        handleTriggerQuickTicket();
                    } else if (hasCalc && selectedIndex === (hasTicketShortcut ? 1 : 0)) {
                        handleCopyCalc(calcResult);
                    } else {
                        const itemIndex = selectedIndex - specialSlots;
                        if (filteredItems[itemIndex]) handleSelectItem(filteredItems[itemIndex].path);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex, hasCalc, hasTicketShortcut, specialSlots, calcResult, ticketMatch, onClose]);

    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selected) selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;
    const calcSlotIndex = hasTicketShortcut ? 1 : 0;

    return (
        <div data-ticket-modal="true" className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-lg bg-[#0f172a] border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                    <Search size={18} className="text-slate-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar menú o escribe 'ticket' para reportar a soporte..."
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 focus:outline-none"
                    />
                    <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">ESC</kbd>
                </div>

                <div ref={listRef} className="max-h-[360px] overflow-y-auto custom-scrollbar p-2">
                    {search.trim() === '' ? (
                        <div className="px-4 py-6 text-center space-y-3">
                            <div>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Escribe para buscar cualquier opción del menú o escribe <strong className="text-indigo-400">ticket</strong>
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Atajo rápido de soporte con captura: <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">Ctrl+Shift+K</kbd>
                                </p>
                            </div>
                            <button type="button" onClick={handleTriggerQuickTicket} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all cursor-pointer">
                                <Camera size={14} className="text-indigo-400" />
                                <span>Crear Ticket con Captura de Pantalla</span>
                            </button>
                        </div>
                    ) : filteredItems.length === 0 && !hasCalc && !hasTicketShortcut ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-[11px] text-slate-500 font-medium">Sin resultados</p>
                        </div>
                    ) : (
                        <>
                            {hasTicketShortcut && (
                                <button
                                    type="button"
                                    data-index={0}
                                    onClick={handleTriggerQuickTicket}
                                    onMouseEnter={() => setSelectedIndex(0)}
                                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 mb-1.5 rounded-xl transition-all duration-150 text-left overflow-hidden group select-none cursor-pointer ${
                                        selectedIndex === 0 ? 'bg-indigo-600/25 text-white border border-indigo-500/50 shadow-md' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
                                    }`}
                                >
                                    {selectedIndex === 0 && <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-400 rounded-r" />}
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                        <Ticket size={17} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[13px] font-bold text-white leading-tight truncate">
                                            {ticketMatch?.initialSubject ? `Crear Ticket: "${ticketMatch.initialSubject}"` : 'Crear Ticket de Soporte (Capturar Pantalla)'}
                                        </span>
                                        <span className="text-[11px] text-indigo-300/80">Toma foto de la pantalla actual y notifica a los técnicos por Telegram</span>
                                    </div>
                                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                        <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-500/30">↵ Enter</kbd>
                                    </div>
                                </button>
                            )}

                            {hasCalc && (
                                <button
                                    type="button"
                                    data-index={calcSlotIndex}
                                    onClick={() => handleCopyCalc(calcResult)}
                                    onMouseEnter={() => setSelectedIndex(calcSlotIndex)}
                                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 mb-1.5 rounded-xl transition-all duration-150 text-left overflow-hidden group select-none ${
                                        selectedIndex === calcSlotIndex ? 'bg-slate-800/90 text-white border border-slate-700/80 shadow-md' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white border border-transparent'
                                    }`}
                                >
                                    {selectedIndex === calcSlotIndex && <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-sky-400 rounded-r" />}
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                        <Calculator size={18} />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[15px] font-bold text-white tracking-wide leading-tight">
                                            {typeof calcResult === 'number' ? calcResult.toLocaleString('en-US', { maximumFractionDigits: 6 }) : calcResult}
                                        </span>
                                        <span className="text-[11px] text-slate-400">Copiar resultado al portapapeles</span>
                                    </div>
                                </button>
                            )}

                            {filteredItems.map((item, index) => {
                                const itemSelectIndex = index + specialSlots;
                                const isSelected = selectedIndex === itemSelectIndex;
                                const showGroup = index === 0 || filteredItems[index - 1].group !== item.group;
                                return (
                                    <React.Fragment key={item.id}>
                                        {showGroup && item.group && (
                                            <div className="px-3 py-2 mt-1">
                                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{item.group}</span>
                                            </div>
                                        )}
                                        <button
                                            data-index={itemSelectIndex}
                                            onClick={() => handleSelectItem(item.path)}
                                            onMouseEnter={() => setSelectedIndex(itemSelectIndex)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                                                isSelected ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                                            }`}
                                        >
                                            <span className="text-[13px] font-medium">{item.label}</span>
                                            {isSelected && <CornerDownLeft size={14} className="ml-auto text-indigo-400/60" />}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-800/50 bg-[#0c1524]/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px]">↑↓</kbd><span>Navegar</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px]">↵</kbd><span>Seleccionar</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px]">Esc</kbd><span>Cerrar</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
