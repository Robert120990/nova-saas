import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, CornerDownLeft, Calculator, Ticket, Camera, Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useMenuItems, GROUP_MODULE_MAP, ITEM_MODULE_MAP } from '../../hooks/useMenuItems';
import { useAuth } from '../../context/AuthContext';
import { useTickets } from '../../context/TicketContext';
import { useSafeNavigate } from '../../hooks/useSafeNavigate';
import { evaluateSafeMathDetails, copyTextToClipboard } from '../../utils/calculatorUtils';

const TICKET_KEYWORDS = ['ticket', 'tickets', 'soporte', 'problema', 'requerimiento', 'ayuda', 'bug', 'reportar'];

const CommandPalette = ({ isOpen, onClose }) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [copiedLabel, setCopiedLabel] = useState(null);
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

    const calcResult = useMemo(() => evaluateSafeMathDetails(search), [search]);
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
            setCopiedLabel(null);
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

    const handleCopyCalcValue = async (val, label = 'Resultado', closeAfter = false) => {
        if (val === null || val === undefined) return;
        const cleanText = String(val).replace(/,/g, '');
        await copyTextToClipboard(cleanText);
        setCopiedLabel(label);
        toast.success(`${label} copiado: ${val}`);
        setTimeout(() => setCopiedLabel(null), 1800);
        if (closeAfter) {
            onClose();
        }
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
                        handleCopyCalcValue(calcResult.formatted, 'Resultado');
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
        <div data-ticket-modal="true" className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-[620px] bg-[#0f172a] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                    {hasCalc ? (
                        <Calculator size={20} className="text-emerald-400 shrink-0" />
                    ) : (
                        <Search size={19} className="text-emerald-400 shrink-0" />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar pantalla, calcular (ej. 1250*1.13) o escribe 'ticket'..."
                        className="flex-1 bg-slate-900/60 border border-slate-700/70 focus:border-indigo-500/60 rounded-xl px-3.5 py-2 text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none transition-colors"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                            title="Limpiar búsqueda"
                        >
                            <X size={16} />
                        </button>
                    )}
                    <kbd className="hidden sm:flex items-center gap-0.5 text-[11px] font-bold font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">ESC</kbd>
                </div>

                {hasCalc && calcResult && (
                    <div
                        data-index={calcSlotIndex}
                        onMouseEnter={() => setSelectedIndex(calcSlotIndex)}
                        className="px-4 pt-3 pb-1"
                    >
                        <div
                            style={{
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
                                color: '#fff',
                                padding: '0.85rem 1rem',
                                border: selectedIndex === calcSlotIndex
                                    ? '1px solid rgba(129, 140, 248, 0.65)'
                                    : '1px solid rgba(99, 102, 241, 0.35)'
                            }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-300">
                                        <Calculator size={13} />
                                        <span>Calculadora Instantánea</span>
                                    </div>
                                    <div className="text-xs text-slate-400 font-mono mt-1">
                                        {calcResult.expression} =
                                    </div>
                                    <div className="text-2xl font-black tracking-tight text-white mt-0.5">
                                        {calcResult.formatted}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopyCalcValue(calcResult.formatted, 'Resultado')}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                                >
                                    {copiedLabel === 'Resultado' ? <Check size={14} /> : <Copy size={14} />}
                                    <span>{copiedLabel === 'Resultado' ? 'Copiado' : 'Copiar'}</span>
                                </button>
                            </div>

                            <div
                                className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2.5"
                                style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => handleCopyCalcValue(calcResult.commercial.plusIva, '+ IVA 13%')}
                                    className="text-left px-2.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer border border-transparent hover:border-emerald-400/30"
                                >
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">+ IVA 13%</span>
                                    <span className="text-[12.5px] font-bold text-emerald-300 font-mono">${calcResult.commercial.plusIva}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCopyCalcValue(calcResult.commercial.iva13, 'IVA (13%)')}
                                    className="text-left px-2.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer border border-transparent hover:border-indigo-400/30"
                                >
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">IVA (13%)</span>
                                    <span className="text-[12.5px] font-bold text-indigo-200 font-mono">${calcResult.commercial.iva13}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCopyCalcValue(calcResult.commercial.netFromIncluded, 'Neto (sin IVA)')}
                                    className="text-left px-2.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer border border-transparent hover:border-amber-400/30"
                                >
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Neto (sin IVA)</span>
                                    <span className="text-[12.5px] font-bold text-amber-200 font-mono">${calcResult.commercial.netFromIncluded}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCopyCalcValue(calcResult.commercial.ivaFromIncluded, 'IVA Desglosado')}
                                    className="text-left px-2.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer border border-transparent hover:border-slate-400/30"
                                >
                                    <span className="block text-[10px] text-slate-400 uppercase font-bold">IVA Desglosado</span>
                                    <span className="text-[12.5px] font-bold text-slate-200 font-mono">${calcResult.commercial.ivaFromIncluded}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={listRef} className="max-h-[360px] overflow-y-auto custom-scrollbar p-2">
                    {search.trim() === '' ? (
                        <div className="px-4 py-6 text-center space-y-3">
                            <div>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Escribe para buscar cualquier opción del menú, calcular (ej. <strong className="text-emerald-400">2x2</strong>) o escribe <strong className="text-indigo-400">ticket</strong>
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
