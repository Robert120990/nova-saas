import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
    ShoppingCart, 
    Package, 
    Truck, 
    Users, 
    ArrowUpRight, 
    Clock, 
    Building2, 
    TrendingUp, 
    DollarSign, 
    Award,
    Activity,
    Wallet,
    Monitor,
    AlertCircle,
    ChevronRight,
    Search,
    ShieldAlert,
    User,
    GitBranch
} from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color, bg, subtitle }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between transition-all hover:shadow-md h-full">
        <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{label}</p>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
            {subtitle && <p className="text-[10px] text-slate-400 font-bold mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-2xl ${bg} ${color} shadow-sm`}>
            <Icon size={20} />
        </div>
    </div>
);

const getPermissions = (user) => {
    if (!user?.permissions) return [];
    if (Array.isArray(user.permissions)) return user.permissions;
    try { return JSON.parse(user.permissions); } catch { return []; }
};

const Dashboard = () => {
    const { user } = useAuth();

    const isSuperAdmin = user?.role === 'SuperAdmin';
    const permissions = getPermissions(user);
    const hasDashboardAccess = isSuperAdmin || permissions.includes('view_dashboard');

    // Hooks must always be called (Rules of Hooks)
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats', user?.company_id],
        queryFn: async () => (await axios.get('/api/dashboard/general-stats')).data,
        enabled: !!user?.company_id && hasDashboardAccess
    });

    if (!hasDashboardAccess) {
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
                                <h1 className="text-2xl font-black text-white tracking-tight">{user?.company_name || 'SAAS SV'}</h1>
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
                                        Tu rol no tiene permisos para ver las estadísticas generales del Dashboard. 
                                        Utiliza el menú lateral para navegar a los módulos disponibles.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const { 
        summary = {}, 
        recentActivity = [], 
        branches = [], 
        activeShifts = [] 
    } = stats || {};

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-indigo-600 tracking-tighter">Dashboard Principal</h2>
                    <p className="text-slate-500 font-medium font-spanish">Resumen de operaciones en tiempo real</p>
                </div>
                <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{user?.company_name}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Métricas Principales (Izquierda) */}
                <div className="lg:col-span-12 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <StatCard 
                            label="Ventas del Día" 
                            value={formatCurrency(summary?.todaySales)} 
                            icon={TrendingUp}
                            color="text-emerald-600"
                            bg="bg-emerald-40"
                            subtitle="Ingresos de hoy"
                        />
                        <StatCard 
                            label="Efectivo en Caja" 
                            value={formatCurrency(summary?.totalCashInHand)} 
                            icon={Wallet}
                            color="text-indigo-600"
                            bg="bg-indigo-40"
                            subtitle={`${summary?.activeShiftsCount || 0} turnos abiertos`}
                        />
                        <StatCard 
                            label="Ventas del Mes" 
                            value={formatCurrency(summary?.monthlySales)} 
                            icon={DollarSign}
                            color="text-slate-600"
                            bg="bg-slate-40"
                            subtitle="Suma del mes actual"
                        />
                        <StatCard 
                            label="Inventario" 
                            value={summary?.products || 0} 
                            icon={Package}
                            color="text-blue-600"
                            bg="bg-blue-40"
                            subtitle="Productos únicos"
                        />
                        <StatCard 
                            label="Clientes" 
                            value={summary?.customers || 0} 
                            icon={Users}
                            color="text-amber-600"
                            bg="bg-amber-40"
                            subtitle="Base de datos"
                        />
                    </div>
                </div>
            </div>

            {/* Cajas en Línea — Fila completa */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-emerald-500 animate-pulse" />
                        <h3 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">Cajas en Línea</h3>
                    </div>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{activeShifts.length}</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar px-4 py-3 flex gap-3">
                    {activeShifts.length > 0 ? (
                        activeShifts.map((shift) => {
                            const shiftDate = new Date(shift.start_time).toDateString();
                            const isOld = shiftDate !== new Date().toDateString();
                            return (
                            <div key={shift.id} className={`p-3 rounded-2xl hover:bg-white transition-all shrink-0 w-56 ${isOld ? 'bg-amber-50/80 border-2 border-amber-400 animate-pulse' : 'bg-slate-50/50 border border-slate-100 hover:border-indigo-100'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">{shift.seller_name}</p>
                                            {shift.shift_number && <span className="text-[10px] font-black text-indigo-500 shrink-0">#{shift.shift_number}</span>}
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-800 truncate">{shift.pos_name} · {shift.branch_name}</p>
                                    </div>
                                    {isOld ? <AlertCircle size={12} className="text-amber-500 shrink-0" /> : <ArrowUpRight size={12} className="text-emerald-500 shrink-0" />}
                                </div>
                                {/* {isOld && <p className="text-[8px] font-bold text-amber-600 mt-1">Sin cerrar desde {new Date(shift.start_time).toLocaleDateString('es-SV')}</p>} */}
                                <p className="text-[11px] text-slate-800 mt-1">Apertura: {new Date(shift.start_time).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Efectivo</span>
                                    <span className="text-sm font-black text-indigo-600 tracking-tight">{formatCurrency(shift.expected_cash)}</span>
                                </div>
                            </div>
                            );
                        })
                    ) : (
                        <div className="flex items-center justify-center py-6 text-slate-300 gap-2 opacity-30 w-full">
                            <Monitor size={24} />
                            <p className="text-[8px] font-black uppercase tracking-widest">Sin Cajas Activas</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Actividad Reciente</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Últimos movimientos</p>
                        </div>
                        <Clock size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                        {recentActivity && recentActivity.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                                {recentActivity.map((item, idx) => {
                                    if (!item || typeof item !== 'object') return null;
                                    const itemType = item.type || 'PURCHASE';
                                    const isSale = itemType === 'SALE';
                                    const isExpense = itemType === 'EXPENSE';
                                    const docNum = String(item.numero_documento || item.id || 'S/N');
                                    
                                    return (
                                        <div key={`${itemType}-${item.id || idx}`} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border shrink-0 ${
                                                isSale 
                                                ? 'bg-emerald-50 text-emerald-500 border-emerald-100' 
                                                : isExpense
                                                ? 'bg-rose-50 text-rose-500 border-rose-100'
                                                : 'bg-amber-50 text-amber-500 border-amber-100'
                                            }`}>
                                                {isSale ? <TrendingUp size={16} /> : isExpense ? <Wallet size={16} /> : <ShoppingCart size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                                                        isSale ? 'bg-emerald-100 text-emerald-600' : isExpense ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                                                    }`}>
                                                        {isSale ? 'Venta' : isExpense ? 'Gasto' : 'Compra'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                                                        #{docNum.length > 12 ? docNum.substring(0, 8) + '...' : docNum}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-900 truncate uppercase tracking-tight">{item.entity || (isSale ? 'Consumidor Final' : 'Proveedor')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xs font-black tracking-tight ${isSale ? 'text-emerald-600' : isExpense ? 'text-rose-600' : 'text-slate-900'}`}>
                                                    {isSale ? '+' : '-'}{formatCurrency(item.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin movimientos</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col h-full">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 tracking-tight uppercase">
                        <Building2 size={22} className="text-indigo-500" />
                        Rendimiento por Sucursal
                    </h3>
                    <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {Array.isArray(branches) && branches.length > 0 ? (
                            (() => {
                                const validMonthlyTotals = branches
                                    .map(b => parseFloat(b.monthlyTotal || 0))
                                    .filter(t => !isNaN(t));
                                const maxTotal = validMonthlyTotals.length > 0 ? Math.max(...validMonthlyTotals, 1) : 1;
                                
                                return branches.map(branch => (
                                    <div key={branch.name} className="flex flex-col gap-3 group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{branch.name}</span>
                                                <span className="text-lg font-black text-indigo-600">{formatCurrency(branch.monthlyTotal)}</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                                    branch.ambiente === '2'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                    {branch.ambiente === '2' ? 'Producción' : 'Pruebas'}
                                                </span>
                                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">Este Mes</span>
                                                <div className="flex items-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Activa</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Barra de progreso */}
                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                                            <div 
                                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${(branch.monthlyTotal / maxTotal) * 100}%` }}
                                            />
                                        </div>

                                        {/* Top Productos */}
                                        {branch.topProducts?.length > 0 && (
                                            <div className="bg-slate-50/50 rounded-xl p-3 border border-dashed border-slate-200">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <Award size={12} className="text-amber-500" />
                                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Lo más vendido</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {branch.topProducts.map((p, pIdx) => (
                                                        <div key={`${branch.name}-${p.product_name}`} className="flex items-center justify-between group/p">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-500">
                                                                    {pIdx + 1}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-600 truncate uppercase">{p.product_name}</span>
                                                            </div>
                                                            <span className="text-[10px] font-black text-slate-400">{Math.round(p.total_qty)} un.</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ));
                            })()
                        ) : (
                            <p className="text-center text-slate-400 text-sm py-4">Sin sucursales registradas</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Ventas por Categoría — Dinámico con filtros */}
            <CategorySalesChart />
        </div>
    );
};

const CategorySalesChart = () => {
    const [branchId, setBranchId] = useState('');
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const { data: catData, isLoading: catLoading } = useQuery({
        queryKey: ['category-sales', branchId, startDate, endDate],
        queryFn: async () => {
            const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
            if (branchId) params.append('branch_id', branchId);
            return (await axios.get(`/api/dashboard/category-sales?${params}`)).data;
        },
        refetchInterval: 60000
    });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'], queryFn: async () => (await axios.get('/api/branches')).data,
    });

    const formatCurrency = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/10 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-indigo-500" />
                    <h3 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">Ventas por Categoría</h3>
                </div>
                <div className="flex items-center gap-2">
                    <select value={branchId} onChange={e => setBranchId(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold">
                        <option value="">Todas las sucursales</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-[140px]" />
                    <span className="text-[10px] text-slate-400">a</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-[140px]" />
                </div>
            </div>
            <div className="p-5">
                {catLoading ? (
                    <div className="text-center py-8 text-slate-400 text-xs">Cargando...</div>
                ) : !catData?.length ? (
                    <div className="text-center py-8 text-slate-300 text-xs">Sin datos para el período seleccionado</div>
                ) : (
                    <div className="space-y-3">
                        {catData.map((cat, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-600 w-32 truncate">{cat.category}</span>
                                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{
                                        width: `${cat.pct}%`,
                                        backgroundColor: ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6'][i % 10]
                                    }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 w-16 text-right">{formatCurrency(cat.total)}</span>
                                <span className="text-[9px] font-bold text-slate-400 w-10 text-right">{cat.pct}%</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
