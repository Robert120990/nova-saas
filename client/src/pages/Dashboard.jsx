import React from 'react';
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
    ChevronRight,
    Search
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

const Dashboard = () => {
    const { user } = useAuth();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard-stats', user?.company_id],
        queryFn: async () => (await axios.get('/api/dashboard/general-stats')).data,
        enabled: !!user?.company_id
    });

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
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Panel de Control</h2>
                    <p className="text-slate-500 font-medium font-spanish">Resumen de operaciones en tiempo real</p>
                </div>
                <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{user?.company_name}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Métricas Principales (Izquierda) */}
                <div className="lg:col-span-9 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <StatCard 
                            label="Ventas del Día" 
                            value={formatCurrency(summary?.todaySales)} 
                            icon={TrendingUp}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                            subtitle="Ingresos de hoy"
                        />
                        <StatCard 
                            label="Efectivo en Caja" 
                            value={formatCurrency(summary?.totalCashInHand)} 
                            icon={Wallet}
                            color="text-indigo-600"
                            bg="bg-indigo-50"
                            subtitle={`${summary?.activeShiftsCount || 0} turnos abiertos`}
                        />
                        <StatCard 
                            label="Ventas del Mes" 
                            value={formatCurrency(summary?.monthlySales)} 
                            icon={DollarSign}
                            color="text-slate-600"
                            bg="bg-slate-50"
                            subtitle="Suma del mes actual"
                        />
                        <StatCard 
                            label="Inventario" 
                            value={summary?.products || 0} 
                            icon={Package}
                            color="text-blue-600"
                            bg="bg-blue-50"
                            subtitle="Productos únicos"
                        />
                        <StatCard 
                            label="Clientes" 
                            value={summary?.customers || 0} 
                            icon={Users}
                            color="text-amber-600"
                            bg="bg-amber-50"
                            subtitle="Base de datos"
                        />
                    </div>
                </div>

                {/* Monitor Compacto (Derecha) */}
                <div className="lg:col-span-3 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full max-h-[350px]">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
                        <div className="flex items-center gap-2">
                            <Activity size={14} className="text-emerald-500 animate-pulse" />
                            <h3 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">Cajas en Línea</h3>
                        </div>
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{activeShifts.length}</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-3">
                        {activeShifts.length > 0 ? (
                            activeShifts.map((shift) => (
                                <div key={shift.id} className="bg-slate-50/50 border border-slate-100 p-3 rounded-2xl hover:bg-white hover:border-indigo-100 transition-all">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">{shift.seller_name}</p>
                                            <p className="text-[8px] font-bold text-slate-400 truncate">{shift.pos_name} • {shift.branch_name}</p>
                                        </div>
                                        <ArrowUpRight size={12} className="text-emerald-500 shrink-0" />
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Efectivo</span>
                                        <span className="text-xs font-black text-indigo-600 tracking-tight">{formatCurrency(shift.expected_cash)}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-8 text-slate-300 gap-2 opacity-30">
                                <Monitor size={24} />
                                <p className="text-[8px] font-black uppercase tracking-widest">Sin Cajas Activas</p>
                            </div>
                        )}
                    </div>
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
        </div>
    );
};

export default Dashboard;
