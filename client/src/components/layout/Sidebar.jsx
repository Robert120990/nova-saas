import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import { ChevronDown, ChevronRight, ChevronLeft, Menu, Search, X } from 'lucide-react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useMenuItems, GROUP_MODULE_MAP, ITEM_MODULE_MAP } from "../../hooks/useMenuItems";

const Sidebar = ({ onOpenSearch, isMobileOpen = false, onCloseMobile }) => {
    const { user } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved === 'true';
    });

    // En el drawer móvil siempre mostramos el sidebar expandido
    const effectiveCollapsed = isMobileOpen ? false : isCollapsed;

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

    const location = useLocation();
    const navigate = useNavigate();

    // Initialize groups as collapsed
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedItems, setExpandedItems] = useState({});
    const hoverTimeoutRef = useRef(null);

    const toggleGroup = (groupId) => {
        if (effectiveCollapsed) return; // Don't expand groups when collapsed
        setExpandedGroups(prev => ({
            ...prev,
            [groupId]: !prev[groupId]
        }));
    };

    const handleGroupClick = (group, children) => {
        if (effectiveCollapsed) return;
        toggleGroup(group.id);
        if (children.length === 1 && children[0].path) {
            navigate(children[0].path);
            if (isMobileOpen && onCloseMobile) onCloseMobile();
        }
    };

    const hasPermission = (item) => {
        if (isSuperAdmin) return true;
        if (!item.permission) return true;
        if (item.permission === 'manage_company_modules') {
            return permissions.includes('manage_company_modules') || permissions.includes('manage_system_settings');
        }
        if (item.permission === 'view_dashboard') {
            return (
                permissions.includes('view_dashboard') ||
                permissions.includes('view_dashboard_general') ||
                permissions.includes('view_dashboard_pista') ||
                permissions.includes('view_dashboard_tienda') ||
                permissions.includes('view_dashboard_andelsa') ||
                permissions.includes('view_dashboard_server')
            );
        }
        // Flexibilidad para CRM y Calendario para roles administrativos
        const userRole = (user?.role || '').toLowerCase();
        const isAdminRole = userRole.includes('admin') || userRole.includes('geren') || userRole.includes('supervis');
        if (item.permission === 'manage_customer_agreements' || item.permission === 'view_crm' || item.permission === 'manage_crm_settings') {
            if (isAdminRole || permissions.includes('manage_sales') || permissions.includes('view_sales')) {
                return true;
            }
        }
        if (item.permission === 'manage_production' || item.permission === 'manage_production_calendar') {
            if (isAdminRole || userRole.includes('operacion') || permissions.includes('view_industrial_dashboard')) {
                return true;
            }
        }
        return permissions.includes(item.permission);
    };

    const isGroupEnabled = (group) => {
        const reqModule = GROUP_MODULE_MAP[group.label];
        if (!reqModule) return true;

        // Si estamos en entorno ANDELSA o la empresa activa es ANDELSA, Huevo Industrial y CRM siempre activos
        const isAndelsaContext = user?.company_id === 9 || 
                                 (typeof user?.company_name === 'string' && user.company_name.toUpperCase().includes('ANDELSA')) ||
                                 (typeof window !== 'undefined' && window.location.hostname.includes('andelsa'));
        if (isAndelsaContext && (reqModule === 'egg_industrial' || reqModule === 'crm')) {
            return true;
        }

        if (Array.isArray(user?.enabled_modules)) {
            return user.enabled_modules.includes(reqModule);
        }

        // Fallback seguro por contexto si la sesión aún no tiene enabled_modules cargados
        if (isAndelsaContext) {
            return ['sales', 'purchases', 'inventory', 'accounting', 'human_resources', 'egg_industrial', 'crm'].includes(reqModule);
        }
        return ['sales', 'purchases', 'inventory', 'accounting', 'human_resources', 'gas_station', 'pozo'].includes(reqModule);
    };

    const { data: settings } = useQuery({
        queryKey: ['system-settings'],
        queryFn: async () => (await axios.get('/api/settings')).data,
    });

    const { topLevelItems, menuConfig } = useMenuItems();

    // Auto-expand group and sub-items containing current route
    useEffect(() => {
        if (!menuConfig) return;
        menuConfig.forEach(group => {
            if (!isGroupEnabled(group)) return;
            let groupHasActive = false;

            group.children?.forEach(child => {
                const isChildActive = child.path && (
                    location.pathname === child.path || 
                    (child.path !== '/' && location.pathname.startsWith(child.path))
                );
                if (isChildActive) {
                    groupHasActive = true;
                }

                // Check if any subchild (e.g. inside Reportes or Catálogos) is active
                const hasActiveSub = child.children?.some(sub => 
                    sub.path && (location.pathname === sub.path || (sub.path !== '/' && location.pathname.startsWith(sub.path)))
                );
                if (hasActiveSub) {
                    groupHasActive = true;
                    setExpandedItems(prev => ({ ...prev, [child.id]: true }));
                }
            });

            if (groupHasActive) {
                setExpandedGroups(prev => ({ ...prev, [group.id]: true }));
            }
        });
    }, [location.pathname, menuConfig, user?.enabled_modules]);

    const [hoveredItem, setHoveredItem] = useState(null);
    const [hoveredPos, setHoveredPos] = useState({ top: null, bottom: null, left: 0, maxHeight: 500 });

    const openFlyout = (targetElement, item) => {
        if (!item.children || item.children.length === 0) return;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

        const rect = targetElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Altura estimada del contenido (encabezado ~48px + items de ~36px c/u)
        const estimatedHeight = (item.children.length * 36) + 48;
        const spaceBelow = viewportHeight - rect.top - 16;

        if (spaceBelow >= estimatedHeight || rect.top < viewportHeight / 2) {
            // Cabe hacia abajo o está en la mitad superior de la pantalla:
            // Anclamos la parte superior con el botón
            const top = Math.max(12, Math.min(rect.top - 4, viewportHeight - 200));
            const maxHeight = Math.min(viewportHeight - top - 16, viewportHeight - 24);
            setHoveredPos({
                top,
                bottom: null,
                left: rect.right + 4,
                maxHeight
            });
        } else {
            // Está en la parte inferior y no cabe hacia abajo:
            // ¡ANCLAMOS LA BASE DEL FLYOUT CON LA BASE DEL BOTÓN!
            // De esta forma, el menú se alinea directamente con el cursor a la derecha
            const bottom = Math.max(12, viewportHeight - rect.bottom - 4);
            const maxHeight = Math.min(viewportHeight - bottom - 16, viewportHeight - 24);
            setHoveredPos({
                top: null,
                bottom,
                left: rect.right + 4,
                maxHeight
            });
        }

        setHoveredItem(item);
    };

    const handleMouseEnter = (e, item) => {
        openFlyout(e.currentTarget, item);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 160);
    };

    const handleFlyoutEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };

    const handleSubmenuTrigger = (e, item) => {
        if (hoveredItem?.id === item.id) {
            setHoveredItem(null);
        } else {
            openFlyout(e.currentTarget, item);
        }
    };

    const isItemEnabled = (item) => {
        if (!item?.path) return true;
        const reqMod = ITEM_MODULE_MAP[item.path];
        if (!reqMod) return true;
        if (Array.isArray(user?.enabled_modules)) {
            return user.enabled_modules.includes(reqMod);
        }
        return true;
    };

    const renderMenuItem = (item, depth = 0) => {
        if (!hasPermission(item) || item.hideInMenu || !isItemEnabled(item)) return null;

        const visibleChildren = item.children?.filter(c => !c.hideInMenu && isItemEnabled(c)) || [];
        const hasChildren = visibleChildren.length > 0;
        const paddingLeft = effectiveCollapsed ? 'px-0 justify-center' : (depth === 0 ? 'pl-8 pr-4' : depth === 1 ? 'pl-12 pr-4' : 'pl-16 pr-4');

        if (hasChildren) {
            // En móvil drawer (pantallas pequeñas táctiles): acordeón inline porque el flyout no cabe a la derecha
            if (isMobileOpen) {
                const isExpanded = !!expandedItems[item.id];
                return (
                    <div key={item.id} className="relative">
                        <button
                            type="button"
                            onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className={`w-full flex items-center justify-between ${paddingLeft} py-1.5 rounded-xl transition-all duration-200 ${
                                isExpanded ? 'text-white bg-white/5' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            } group`}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={18} className={`transition-transform shrink-0 ${isExpanded ? 'text-indigo-400' : 'opacity-70 group-hover:opacity-100'}`} />
                                <span className="font-semibold text-[12px] whitespace-nowrap tracking-tight">{item.label}</span>
                            </div>
                            {isExpanded
                                ? <ChevronDown size={14} className="text-indigo-400 transition-transform" />
                                : <ChevronRight size={14} className="opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-1" />}
                        </button>

                        {isExpanded && (
                            <div className="mt-1 space-y-0.5 pb-1">
                                {visibleChildren.filter(child => child.path).map(child => (
                                    <NavLink
                                        key={child.path}
                                        to={child.path}
                                        end
                                        onClick={() => {
                                            if (onCloseMobile) onCloseMobile();
                                        }}
                                        className={({ isActive }) =>
                                            `flex items-center gap-3 pl-12 pr-4 py-1.5 rounded-xl transition-all duration-200 ${
                                                isActive
                                                ? 'bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-600/30'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                                            }`
                                        }
                                    >
                                        {child.icon && <child.icon size={14} className="opacity-70 shrink-0" />}
                                        <span className="text-[12px] font-medium tracking-tight truncate">{child.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }

            // En desktop: SIEMPRE se despliega a la derecha (flyout flotante alineado con el botón)
            const isOpen = hoveredItem?.id === item.id;
            return (
                <div 
                    key={item.id} 
                    className="relative"
                    onMouseEnter={(e) => handleMouseEnter(e, item)}
                    onMouseLeave={handleMouseLeave}
                >
                    <button
                        type="button"
                        onClick={(e) => handleSubmenuTrigger(e, item)}
                        className={`w-full flex items-center justify-between ${paddingLeft} py-1.5 rounded-xl transition-all duration-200 ${
                            isOpen
                            ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30 shadow-sm'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
                        } group`}
                        title={effectiveCollapsed ? item.label : ""}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon size={effectiveCollapsed ? 20 : 18} className={`transition-transform shrink-0 ${isOpen ? 'text-indigo-400 scale-110' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'}`} />
                            {!effectiveCollapsed && <span className="font-semibold text-[12px] whitespace-nowrap tracking-tight">{item.label}</span>}
                        </div>
                        {!effectiveCollapsed && (
                            <ChevronRight size={14} className={`transition-all ${isOpen ? 'text-indigo-400 translate-x-1 opacity-100' : 'opacity-40 group-hover:opacity-100 transition-all group-hover:translate-x-1'}`} />
                        )}
                    </button>
                </div>
            );
        }

        return (
            <NavLink
                key={item.path || item.id}
                to={item.path}
                end
                onClick={() => {
                    setHoveredItem(null);
                    if (onCloseMobile) onCloseMobile();
                }}
                title={effectiveCollapsed ? item.label : ""}
                className={({ isActive }) =>
                    `flex items-center gap-3 ${effectiveCollapsed ? 'justify-center w-10 h-10 mx-auto' : `${paddingLeft} py-1.5 w-full`} rounded-xl transition-all duration-200 group ${
                        isActive
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }`
                }
            >
                <item.icon size={effectiveCollapsed ? 20 : 18} className="group-hover:scale-110 transition-transform shrink-0" />
                {!effectiveCollapsed && <span className="font-semibold text-[12px] whitespace-nowrap tracking-tight">{item.label}</span>}
            </NavLink>
        );
    };

    const [version, setVersion] = useState('...');

    useEffect(() => {
        fetch('/health')
            .then(r => r.json())
            .then(d => setVersion(d.version || '?'))
            .catch(() => setVersion('?'));
    }, []);

    const sidebarContent = (
        <aside 
            onMouseLeave={handleMouseLeave}
            className={`${effectiveCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 transition-all duration-300 ease-in-out relative group/sidebar`}
        >
            {/* Header / Logo */}
            <div className={`p-6 flex items-center ${effectiveCollapsed ? 'justify-center px-2' : 'justify-between'} border-b border-slate-800/50`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-8 w-auto object-contain min-w-[32px]" />
                    ) : (
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/20 shrink-0">
                            {(settings?.system_name || 'SAAS').charAt(0).toUpperCase()}
                        </div>
                    )}
                    {!effectiveCollapsed && (
                        <h1 className="text-sm font-bold text-white tracking-widest uppercase truncate animate-in fade-in slide-in-from-left-2 duration-300">
                            {settings?.system_name || 'SAAS SV'}
                        </h1>
                    )}
                </div>
                
                <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col mt-2' : ''}`}>
                    <button
                        onClick={onOpenSearch}
                        className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all hover:bg-indigo-600/20 hover:border-indigo-500/50"
                        title="Buscar menú (Ctrl+K)"
                    >
                        <Search size={18} />
                    </button>
                    {/* En móvil mostramos botón de cerrar X, en desktop el botón de plegar */}
                    <button 
                        onClick={() => {
                            if (isMobileOpen && onCloseMobile) {
                                onCloseMobile();
                            } else {
                                setIsCollapsed(!isCollapsed);
                            }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all hover:bg-indigo-600/20 hover:border-indigo-500/50"
                        title={isMobileOpen ? "Cerrar" : (isCollapsed ? "Expandir" : "Contraer")}
                    >
                        <div className="md:hidden">
                            <X size={18} />
                        </div>
                        <div className="hidden md:block">
                            {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
                        </div>
                    </button>
                </div>
            </div>

            {!effectiveCollapsed && (
                <div className="px-6 py-2 border-b border-slate-800/30">
                    <p className="text-[11px] font-mono text-indigo-400/70 font-semibold tracking-wide">
                        Versión: {version}
                    </p>
                </div>
            )}

            <nav className="flex-1 px-4 space-y-1 mt-3 overflow-y-auto pb-4 custom-scrollbar">
                {/* Top-level items (e.g. Dashboard) */}
                <div className="mb-6 space-y-1">
                    {topLevelItems
                        .filter(hasPermission)
                        .map((item) => renderMenuItem(item))}
                </div>

                {menuConfig.map((group) => {
                    if (group.hideInMenu || !isGroupEnabled(group)) return null;
                    const children = group.children.filter(hasPermission);
                    if (children.length === 0) return null;
                    const isExpanded = expandedGroups[group.id];

                    return (
                        <div key={group.id} className="mb-4">
                            {!effectiveCollapsed ? (
                                <button
                                    onClick={() => handleGroupClick(group, children)}
                                    className="w-full px-4 py-2 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center justify-between transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <group.icon size={12} className="text-indigo-400/80 opacity-70 group-hover:opacity-100" />
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

                            <div className={`mt-1 space-y-2 transition-all duration-300 ${!effectiveCollapsed && !isExpanded ? 'hidden' : 'block'}`}>
                                {group.children.map((item) => renderMenuItem(item))}
                            </div>
                        </div>
                    );
                })}
            </nav>

            {/* Menú Lateral (Flyout) con Position Fixed desplegado SIEMPRE a la derecha en Desktop */}
            {hoveredItem && !isMobileOpen && (
                <div 
                    onMouseEnter={handleFlyoutEnter}
                    onMouseLeave={handleMouseLeave}
                    className="fixed bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-2 z-[999] transition-all duration-150 animate-in fade-in zoom-in-95 before:absolute before:-left-3 before:top-0 before:bottom-0 before:w-4 before:content-['']"
                    style={{ 
                        top: hoveredPos.top !== null ? hoveredPos.top : undefined,
                        bottom: hoveredPos.bottom !== null ? hoveredPos.bottom : undefined,
                        left: hoveredPos.left,
                        minWidth: '270px',
                        maxWidth: '320px',
                        maxHeight: hoveredPos.maxHeight
                    }}
                >
                    <div className="px-3 py-2 mb-1.5 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <hoveredItem.icon size={15} className="text-indigo-400" />
                            <span className="text-[11px] font-bold text-white uppercase tracking-wider">{hoveredItem.label}</span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-full">
                            {hoveredItem.children.filter(c => c.path && !c.hideInMenu && isItemEnabled(c)).length}
                        </span>
                    </div>
                    <div 
                        className="space-y-0.5 overflow-y-auto custom-scrollbar pr-1"
                        style={{ maxHeight: `calc(${hoveredPos.maxHeight}px - 54px)` }}
                    >
                        {hoveredItem.children.filter(child => child.path && !child.hideInMenu && isItemEnabled(child)).map(child => (
                            <NavLink
                                key={child.path}
                                to={child.path}
                                end
                                onClick={() => {
                                    setHoveredItem(null);
                                    if (onCloseMobile) onCloseMobile();
                                }}
                                className={({ isActive }) =>
                                    `flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 ${
                                        isActive
                                        ? 'bg-indigo-600/25 text-indigo-300 font-semibold border border-indigo-500/40 shadow-sm'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-white border border-transparent'
                                    }`
                                }
                            >
                                {child.icon && <child.icon size={15} className="opacity-75 shrink-0" />}
                                <span className="text-[12px] font-medium tracking-tight truncate">{child.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );

    return (
        <>
            {/* Desktop Sidebar (oculto en pantallas pequeñas) */}
            <div className="hidden md:flex h-full shrink-0">
                {sidebarContent}
            </div>

            {/* Mobile Drawer (flotante con backdrop) */}
            {isMobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    <div 
                        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
                        onClick={onCloseMobile}
                    />
                    <div className="relative z-50 h-full w-72 max-w-[80vw]">
                        {sidebarContent}
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
