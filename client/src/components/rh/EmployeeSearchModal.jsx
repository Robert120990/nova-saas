import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Search, X, Users, Briefcase, Building2, ChevronRight, Loader2 } from 'lucide-react';
import Money from '../ui/Money';

const getInitials = (nombres = '', apellidos = '') => {
    const first = nombres.trim().charAt(0) || '';
    const second = apellidos.trim().charAt(0) || '';
    return (first + second).toUpperCase() || 'EM';
};

const getAvatarColor = (id = 0) => {
    const colors = [
        'bg-indigo-100 text-indigo-700 border-indigo-200',
        'bg-sky-100 text-sky-700 border-sky-200',
        'bg-emerald-100 text-emerald-700 border-emerald-200',
        'bg-violet-100 text-violet-700 border-violet-200',
        'bg-amber-100 text-amber-800 border-amber-200',
        'bg-rose-100 text-rose-700 border-rose-200'
    ];
    return colors[id % colors.length];
};

const EmployeeSearchModal = ({ isOpen, onClose, onSelect }) => {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedDepto, setSelectedDepto] = useState('todos');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef(null);
    const itemRefs = useRef([]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setSelectedIndex(0);
        }, 200);
        return () => clearTimeout(timer);
    }, [search]);

    // Reset and focus when opening
    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setDebouncedSearch('');
            setSelectedDepto('todos');
            setSelectedIndex(0);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Fetch employees
    const { data: empResponse = { data: [] }, isLoading } = useQuery({
        queryKey: ['rh-empleados-catalog', debouncedSearch],
        queryFn: async () => {
            const res = await axios.get('/api/rh/empleados', {
                params: {
                    search: debouncedSearch,
                    limit: 150,
                    solo_activos: 1
                }
            });
            return res.data;
        },
        enabled: isOpen,
        staleTime: 1000 * 60 * 2
    });

    const employees = empResponse.data || [];

    // Unique departments for filter chips
    const deptos = useMemo(() => {
        const set = new Set();
        employees.forEach(e => {
            if (e.departamento_nombre) set.add(e.departamento_nombre);
        });
        return Array.from(set);
    }, [employees]);

    // Filter by department chip if selected
    const filteredEmployees = useMemo(() => {
        if (selectedDepto === 'todos') return employees;
        return employees.filter(e => e.departamento_nombre === selectedDepto);
    }, [employees, selectedDepto]);

    // Ensure selectedIndex is within range
    useEffect(() => {
        if (selectedIndex >= filteredEmployees.length) {
            setSelectedIndex(Math.max(0, filteredEmployees.length - 1));
        }
    }, [filteredEmployees.length, selectedIndex]);

    // Scroll selected item into view
    useEffect(() => {
        if (itemRefs.current[selectedIndex]) {
            itemRefs.current[selectedIndex].scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }, [selectedIndex]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev < filteredEmployees.length - 1 ? prev + 1 : prev));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredEmployees[selectedIndex]) {
                    onSelect(filteredEmployees[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredEmployees, selectedIndex, onSelect, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl w-full max-w-4xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                            <Users size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Catálogo de Empleados</h3>
                                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md">
                                    F3
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Seleccione un colaborador para cargar en el módulo</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                            <kbd className="font-mono text-[10px] font-bold text-slate-600 mr-1">ESC</kbd> para cerrar
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                            title="Cerrar modal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Search Bar & Filter Strip */}
                <div className="p-4 bg-slate-50/60 border-b border-slate-100 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar por nombre, apellido, código, cargo o departamento..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-11 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 text-sm font-medium transition-all shadow-sm"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => { setSearch(''); inputRef.current?.focus(); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    {/* Department chips & count */}
                    <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                            <button
                                type="button"
                                onClick={() => { setSelectedDepto('todos'); setSelectedIndex(0); }}
                                className={`shrink-0 text-xs px-3 py-1 rounded-xl font-bold transition-all ${
                                    selectedDepto === 'todos'
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                Todos ({employees.length})
                            </button>
                            {deptos.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => { setSelectedDepto(d); setSelectedIndex(0); }}
                                    className={`shrink-0 text-xs px-3 py-1 rounded-xl font-semibold transition-all ${
                                        selectedDepto === d
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>

                        <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-auto">
                            {filteredEmployees.length} {filteredEmployees.length === 1 ? 'resultado' : 'resultados'}
                        </span>
                    </div>
                </div>

                {/* Employees Cards List */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Loader2 size={32} className="animate-spin text-indigo-500" />
                            <span className="text-xs font-bold uppercase tracking-wider">Cargando catálogo...</span>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                                <Users size={28} className="opacity-50" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">No se encontraron empleados</span>
                            <p className="text-xs text-slate-400">Intente buscar con otro nombre, código o limpie los filtros</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {filteredEmployees.map((emp, index) => {
                                const isHighlighted = selectedIndex === index;
                                const avatarColor = getAvatarColor(emp.id || index);

                                return (
                                    <button
                                        key={emp.id}
                                        ref={el => (itemRefs.current[index] = el)}
                                        type="button"
                                        onClick={() => onSelect(emp)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        className={`flex items-center gap-3.5 p-3 rounded-2xl border text-left transition-all group ${
                                            isHighlighted
                                                ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/5'
                                                : 'bg-white border-slate-200/80 hover:border-indigo-200 hover:bg-slate-50 shadow-sm'
                                        }`}
                                    >
                                        {/* Avatar Initials */}
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${avatarColor}`}>
                                            {getInitials(emp.nombres, emp.apellidos)}
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                                                    {emp.codigo}
                                                </span>
                                                <div className="text-right">
                                                    <span className="text-xs font-black text-slate-800">
                                                        <Money value={emp.sueldo_base || 0} />
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-xs font-bold text-slate-900 truncate mt-0.5 group-hover:text-indigo-600 transition-colors">
                                                {emp.nombres} {emp.apellidos}
                                            </div>

                                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 truncate">
                                                {emp.cargo_nombre && (
                                                    <span className="inline-flex items-center gap-1 text-slate-600">
                                                        <Briefcase size={11} className="text-slate-400 shrink-0" />
                                                        <span className="truncate max-w-[130px]">{emp.cargo_nombre}</span>
                                                    </span>
                                                )}
                                                {emp.departamento_nombre && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                                                            <Building2 size={11} className="text-slate-400 shrink-0" />
                                                            <span className="truncate max-w-[110px]">{emp.departamento_nombre}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action indicator */}
                                        <div className={`p-1.5 rounded-xl transition-all shrink-0 ${
                                            isHighlighted ? 'bg-indigo-600 text-white' : 'text-slate-300 group-hover:text-indigo-500'
                                        }`}>
                                            <ChevronRight size={16} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer / Shortcuts bar */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1 font-medium">
                        <span>Mostrando <strong>{filteredEmployees.length}</strong> de <strong>{employees.length}</strong> empleados activos</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-400">
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-600 shadow-sm">↑</kbd>
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-600 shadow-sm">↓</kbd>
                            <span>Navegar</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-600 shadow-sm">↵ Enter</kbd>
                            <span>Seleccionar</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-600 shadow-sm">ESC</kbd>
                            <span>Salir</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeSearchModal;
