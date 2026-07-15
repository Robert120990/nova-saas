import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { useMenuItems } from '../../hooks/useMenuItems';
import { useAuth } from '../../context/AuthContext';

const CommandPalette = ({ isOpen, onClose }) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const navigate = useNavigate();
    const { user } = useAuth();
    const { flatItems } = useMenuItems();

    const isSuperAdmin = user?.role === 'SuperAdmin';

    const getPermissions = () => {
        if (!user?.permissions) return [];
        if (Array.isArray(user.permissions)) return user.permissions;
        try {
            return JSON.parse(user.permissions);
        } catch (e) {
            return [];
        }
    };

    const permissions = getPermissions();

    const hasPermission = (item) => {
        if (isSuperAdmin) return true;
        if (!item.permission_key) return true;
        return permissions.includes(item.permission_key);
    };

    const navigableItems = useMemo(() => {
        const results = [];
        const parentMap = {};
        flatItems.forEach(item => {
            if (!item.parent_id) {
                parentMap[item.id] = item.label;
            }
        });

        flatItems.forEach(item => {
            if (!item.path) return;
            if (!hasPermission(item)) return;
            if (item.hide_in_menu) return;

            let groupLabel = '';
            if (item.parent_id && parentMap[item.parent_id]) {
                groupLabel = parentMap[item.parent_id];
            }

            results.push({
                id: item.id,
                label: item.label,
                path: item.path,
                group: groupLabel,
                permission_key: item.permission_key,
            });
        });

        return results;
    }, [flatItems, permissions, isSuperAdmin]);

    const filteredItems = useMemo(() => {
        if (!search.trim()) return [];
        const query = search.toLowerCase().trim();
        return navigableItems.filter(item =>
            item.label.toLowerCase().includes(query) ||
            item.group.toLowerCase().includes(query)
        );
    }, [search, navigableItems]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev < filteredItems.length - 1 ? prev + 1 : 0
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev > 0 ? prev - 1 : filteredItems.length - 1
                    );
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredItems[selectedIndex]) {
                        navigate(filteredItems[selectedIndex].path);
                        onClose();
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
    }, [isOpen, filteredItems, selectedIndex, navigate, onClose]);

    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selected) {
                selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-lg bg-[#0f172a] border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                    <Search size={18} className="text-slate-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar menú... (ej. factura, cliente, reporte)"
                        className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 focus:outline-none"
                    />
                    <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-700">
                        ESC
                    </kbd>
                </div>

                <div
                    ref={listRef}
                    className="max-h-[350px] overflow-y-auto custom-scrollbar p-2"
                >
                    {search.trim() === '' ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-[11px] text-slate-500 font-medium">
                                Escribe para buscar cualquier opción del menú
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">
                                También puedes usar el atajo <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-400 border border-slate-700">Ctrl+K</kbd>
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-[11px] text-slate-500 font-medium">Sin resultados</p>
                        </div>
                    ) : (
                        filteredItems.map((item, index) => {
                            const showGroup = index === 0 || filteredItems[index - 1].group !== item.group;
                            return (
                                <React.Fragment key={item.id}>
                                    {showGroup && item.group && (
                                        <div className="px-3 py-2 mt-1">
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                                {item.group}
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        data-index={index}
                                        onClick={() => {
                                            navigate(item.path);
                                            onClose();
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                                            index === selectedIndex
                                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                                        }`}
                                    >
                                        <span className="text-[13px] font-medium">{item.label}</span>
                                        {index === selectedIndex && (
                                            <CornerDownLeft size={14} className="ml-auto text-indigo-400/60" />
                                        )}
                                    </button>
                                </React.Fragment>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-800/50 bg-[#0c1524]/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px]">↑↓</kbd>
                        <span>Navegar</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px]">↵</kbd>
                        <span>Seleccionar</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <kbd className="font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 text-[10px]">Esc</kbd>
                        <span>Cerrar</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
