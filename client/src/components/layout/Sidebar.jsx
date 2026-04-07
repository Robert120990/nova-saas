import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { menuConfig, topLevelItems } from "../../config/menuConfig.js";
import { ChevronDown, ChevronRight, ChevronLeft, Menu, X, Save, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const Sidebar = () => {
    const { user, updateUser } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    }, [isCollapsed]);

    const getPermissions = () => {
        if (!user?.permissions) return [];
        if (Array.isArray(user.permissions)) return user.permissions;
        try {
            const parsed = JSON.parse(user.permissions);
            return parsed;
        } catch (e) {
            console.error('Error parsing permissions:', e);
            return [];
        }
    };

    const permissions = getPermissions();
    const isSuperAdmin = user?.role === 'SuperAdmin';

    // Initialize groups as collapsed
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedSubGroups, setExpandedSubGroups] = useState({});

    const toggleGroup = (groupId) => {
        if (isCollapsed) return; // Don't expand groups when collapsed
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    const toggleSubGroup = (subGroupId) => {
        if (isCollapsed) return;
        setExpandedSubGroups(prev => ({
            ...prev,
            [subGroupId]: !prev[subGroupId]
        }));
    };

    const hasPermission = (item) => {
        if (isSuperAdmin) return true;
        if (!item.permission) return true;
        return permissions.includes(item.permission);
    };

    const { data: settings } = useQuery({
        queryKey: ['system-settings'],
        queryFn: async () => (await axios.get('/api/settings')).data,
    });

    const [hoveredItem, setHoveredItem] = useState(null);
    const [hoveredPos, setHoveredPos] = useState({ top: 0, left: 0 });

    const handleMouseEnter = (e, item) => {
        if (!item.children || item.children.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        
        // Calcular posicionamiento para evitar que se corte por abajo
        const estimatedHeight = (item.children.length * 45) + 60; // Estima la altura del menú
        let top = rect.top;
        const viewportHeight = window.innerHeight;

        if (top + estimatedHeight > viewportHeight) {
            top = viewportHeight - estimatedHeight - 10; // Ajuste hacia arriba con margen
            if (top < 10) top = 10; // Evita que se salga por arriba
        }

        setHoveredPos({ 
            top, 
            left: rect.right + 8 
        });
        setHoveredItem(item);
    };

    const handleMouseLeave = () => {
        setHoveredItem(null);
    };

    const renderMenuItem = (item, depth = 0) => {
        if (!hasPermission(item) || item.hideInMenu) return null;

        const hasChildren = item.children && item.children.length > 0;
        const paddingLeft = isCollapsed ? 'px-0 justify-center' : (depth === 0 ? 'pl-8 pr-4' : depth === 1 ? 'pl-12 pr-4' : 'pl-16 pr-4');

        if (hasChildren) {
            return (
                <div key={item.id} className="relative">
                    <button
                        onMouseEnter={(e) => handleMouseEnter(e, item)}
                        className={`w-full flex items-center justify-between ${paddingLeft} py-1.5 rounded-xl transition-all duration-200 text-slate-400 hover:bg-white/5 hover:text-white group`}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon size={isCollapsed ? 20 : 18} className="group-hover:scale-110 transition-transform opacity-70 group-hover:opacity-100" />
                            {!isCollapsed && <span className="font-semibold text-[12px] whitespace-nowrap tracking-tight">{item.label}</span>}
                        </div>
                        {!isCollapsed && <ChevronRight size={14} className="opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-1" />}
                    </button>
                </div>
            );
        }

        return (
            <NavLink
                key={item.path || item.id}
                to={item.path}
                end
                onMouseEnter={() => setHoveredItem(null)} // Clear flyout when hovering a simple link
                title={isCollapsed ? item.label : ""}
                className={({ isActive }) =>
                    `flex items-center gap-3 ${isCollapsed ? 'justify-center w-10 h-10 mx-auto' : `${paddingLeft} py-1.5 w-full`} rounded-xl transition-all duration-200 group ${
                        isActive
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }`
                }
            >
                <item.icon size={isCollapsed ? 20 : 18} className="group-hover:scale-110 transition-transform shrink-0" />
                {!isCollapsed && <span className="font-semibold text-[12px] whitespace-nowrap tracking-tight">{item.label}</span>}
            </NavLink>
        );
    };

    return (
        <aside 
            onMouseLeave={handleMouseLeave}
            className={`${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 transition-all duration-300 ease-in-out relative group/sidebar`}
        >
            {/* Header / Logo */}
            <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between'} border-b border-slate-800/50`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-8 w-auto object-contain min-w-[32px]" />
                    ) : (
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/20 shrink-0">
                            {(settings?.system_name || 'SAAS').charAt(0).toUpperCase()}
                        </div>
                    )}
                    {!isCollapsed && (
                        <h1 className="text-sm font-bold text-white tracking-widest uppercase truncate animate-in fade-in slide-in-from-left-2 duration-300">
                            {settings?.system_name || 'SAAS SV'}
                        </h1>
                    )}
                </div>
                
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all hover:bg-indigo-600/20 hover:border-indigo-500/50 ${isCollapsed ? 'mt-2' : ''}`}
                    title={isCollapsed ? "Expandir" : "Contraer"}
                >
                    {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 mt-6 overflow-y-auto pb-4 custom-scrollbar">
                {/* Top-level items (e.g. Dashboard) */}
                <div className="mb-6 space-y-1">
                    {topLevelItems
                        .filter(hasPermission)
                        .map((item) => renderMenuItem(item))}
                </div>

                {menuConfig.map((group) => {
                    if (group.hideInMenu) return null;
                    const children = group.children.filter(hasPermission);
                    if (children.length === 0) return null;
                    const isExpanded = expandedGroups[group.id];

                    return (
                        <div key={group.id} className="mb-4">
                            {!isCollapsed ? (
                                <button
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full px-4 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-widest flex items-center justify-between transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <group.icon size={12} className="opacity-50 group-hover:opacity-100" />
                                        {group.label}
                                    </div>
                                    <div className="text-slate-600">
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </div>
                                </button>
                            ) : (
                                <div className="flex justify-center py-2 opacity-30">
                                    <div className="h-px w-8 bg-slate-700" />
                                </div>
                            )}

                            <div className={`mt-1 space-y-2 transition-all duration-300 ${!isCollapsed && !isExpanded ? 'hidden' : 'block'}`}>
                                {group.children.map((item) => renderMenuItem(item))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Menú Lateral (Flyout) con Position Fixed */}
            {hoveredItem && (
                <div 
                    onMouseEnter={() => setHoveredItem(hoveredItem)}
                    onMouseLeave={handleMouseLeave}
                    className="fixed bg-slate-900 border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-[999] transition-all duration-300 animate-in fade-in zoom-in-95"
                    style={{ 
                        top: hoveredPos.top, 
                        left: hoveredPos.left,
                        width: '220px'
                    }}
                >
                    <div className="px-3 py-2 mb-2 border-b border-white/5">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{hoveredItem.label}</span>
                    </div>
                    <div className="space-y-1 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
                        {hoveredItem.children.map(child => (
                            <NavLink
                                key={child.path}
                                to={child.path}
                                end
                                onClick={handleMouseLeave}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 pl-6 pr-3 py-1.5 rounded-lg transition-all duration-200 ${
                                        isActive
                                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                                    }`
                                }
                            >
                                {child.icon && <child.icon size={14} className="opacity-70" />}
                                <span className="text-[12px] font-medium tracking-tight">{child.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
