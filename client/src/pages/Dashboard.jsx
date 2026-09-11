import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    BarChart2, 
    Fuel, 
    Store, 
    Factory, 
    Server, 
    ShieldAlert, 
    Building2, 
    User, 
    GitBranch 
} from 'lucide-react';

import DashboardGeneral from '../components/dashboard/DashboardGeneral';
import DashboardPista from '../components/dashboard/DashboardPista';
import DashboardTienda from '../components/dashboard/DashboardTienda';
import DashboardAndelsa from '../components/dashboard/DashboardAndelsa';
import DashboardServer from '../components/dashboard/DashboardServer';

const parsePermissions = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export default function Dashboard() {
    const { user } = useAuth();

    const isSuperAdmin = user?.role === 'SuperAdmin';
    const permissions = parsePermissions(user?.permissions);

    // Definición de dashboards disponibles según permisos
    const DASHBOARD_DEFS = [
        {
            id: 'general',
            label: 'General',
            icon: BarChart2,
            allowed: isSuperAdmin || permissions.includes('view_dashboard_general') || permissions.includes('view_dashboard'),
            component: DashboardGeneral
        },
        {
            id: 'pista',
            label: 'Pista',
            icon: Fuel,
            allowed: isSuperAdmin || permissions.includes('view_dashboard_pista'),
            component: DashboardPista
        },
        {
            id: 'tienda',
            label: 'Tienda',
            icon: Store,
            allowed: isSuperAdmin || permissions.includes('view_dashboard_tienda'),
            component: DashboardTienda
        },
        {
            id: 'andelsa',
            label: 'Andelsa',
            icon: Factory,
            allowed: isSuperAdmin || permissions.includes('view_dashboard_andelsa'),
            component: DashboardAndelsa
        },
        {
            id: 'server',
            label: 'Servidor',
            icon: Server,
            allowed: isSuperAdmin || permissions.includes('view_dashboard_server') || permissions.includes('view_server_metrics'),
            component: DashboardServer
        }
    ];

    const allowedDashboards = DASHBOARD_DEFS.filter(d => d.allowed);

    // Determinar el dashboard activo por defecto
    const [activeTab, setActiveTab] = useState(() => {
        const saved = localStorage.getItem('active_dashboard_tab');
        if (saved && allowedDashboards.some(d => d.id === saved)) {
            return saved;
        }
        const userDefault = user?.default_dashboard;
        if (userDefault && allowedDashboards.some(d => d.id === userDefault)) {
            return userDefault;
        }
        return allowedDashboards[0]?.id || 'general';
    });

    useEffect(() => {
        if (allowedDashboards.length > 0 && !allowedDashboards.some(d => d.id === activeTab)) {
            const userDefault = user?.default_dashboard;
            const fallback = (userDefault && allowedDashboards.some(d => d.id === userDefault))
                ? userDefault
                : allowedDashboards[0]?.id;
            setActiveTab(fallback);
        }
    }, [allowedDashboards, activeTab, user?.default_dashboard]);

    const handleSelectTab = (tabId) => {
        setActiveTab(tabId);
        localStorage.setItem('active_dashboard_tab', tabId);
    };

    // Caso: sin permisos para ningún dashboard
    if (allowedDashboards.length === 0) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 pb-10 max-w-3xl mx-auto">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-8 py-10">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                <Building2 size={28} className="text-white" />
                            </div>
                            <div>
                                <p className="text-indigo-200 text-[11px] font-bold uppercase tracking-widest">Sistema</p>
                                <h1 className="text-2xl font-black text-white tracking-tight">{user?.company_name || 'Nova SaaS'}</h1>
                            </div>
                        </div>
                    </div>
                    <div className="px-8 py-8 space-y-6">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                                    <User size={20} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Bienvenido, {user?.nombre || user?.username}</h2>
                                    <p className="text-slate-500 font-medium text-[13px]">Has iniciado sesión correctamente</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Tu Rol</p>
                                <div className="flex items-center gap-2">
                                    <ShieldAlert size={16} className="text-indigo-500" />
                                    <span className="text-sm font-bold text-slate-900">{user?.role || '—'}</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Sucursal</p>
                                <div className="flex items-center gap-2">
                                    <GitBranch size={16} className="text-indigo-500" />
                                    <span className="text-sm font-bold text-slate-900">{user?.branch_name || '—'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                    <ShieldAlert size={16} className="text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-[13px] font-bold text-amber-800">Acceso restringido al Dashboard</p>
                                    <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">
                                        Tu rol actual no tiene asignado ningún permiso de dashboard (General, Pista, Tienda, Andelsa o Servidor). 
                                        Utiliza el menú lateral para acceder a tus módulos autorizados.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentDashboard = allowedDashboards.find(d => d.id === activeTab) || allowedDashboards[0];
    const ActiveComponent = currentDashboard.component;

    return (
        <div className="space-y-6">
            {/* Barra de pestañas para usuarios con acceso a 2 o más dashboards */}
            {allowedDashboards.length > 1 && (
                <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5 px-0.5">
                        {allowedDashboards.map((dash) => {
                            const Icon = dash.icon;
                            const isActive = dash.id === activeTab;
                            return (
                                <button
                                    key={dash.id}
                                    onClick={() => handleSelectTab(dash.id)}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shrink-0 select-none ${
                                        isActive 
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]' 
                                        : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                                    <span>{dash.label}</span>
                                    {dash.id === user?.default_dashboard && (
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-amber-300' : 'bg-indigo-500'}`} title="Dashboard por defecto de tu rol"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Renderizado dinámico del dashboard seleccionado */}
            <div>
                <ActiveComponent />
            </div>
        </div>
    );
}
