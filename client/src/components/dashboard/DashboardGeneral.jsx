import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Money from '../ui/Money';
import { 
    ShoppingCart, 
    Package, 
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
    RefreshCw
} from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color, bg, subtitle, breakdown }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between transition-all hover:shadow-md h-full">
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{label}</p>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
            {subtitle && <p className="text-[10px] text-slate-400 font-bold mt-1">{subtitle}</p>}
            {breakdown?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    {breakdown.map((b, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{b.name}</span>
                            <span className="text-[10px] font-black text-slate-600">{b.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className={`p-3 rounded-2xl ${bg} ${color} shadow-sm shrink-0`}>
            <Icon size={20} />
        </div>
    </div>
);

export default function DashboardGeneral() {
    const { user } = useAuth();

    const { data: stats, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['dashboard-general-stats', user?.company_id],
        queryFn: async () => (await axios.get('/api/dashboard/general-stats')).data,
        enabled: !!user?.company_id,
        refetchInterval: 60000
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[350px]">
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

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header del Dashboard General */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Dashboard General</h2>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Resumen ejecutivo y comercial en tiempo real</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                        title="Actualizar datos"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
                        <span>Actualizar</span>
                    </button>
                    <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{user?.company_name}</span>
                    </div>
                </div>
            </div>

            {/* Tarjetas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <StatCard 
                    label="Ventas del Día" 
                    value={<Money value={summary?.todaySales} className="text-2xl font-black text-slate-900 tracking-tight" />}
                    icon={TrendingUp}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    subtitle="Ingresos facturados hoy"
                    breakdown={(summary?.todaySalesByBranch || []).map(b => ({ name: b.branch_name, value: <Money value={b.total} className="text-[10px] font-black text-slate-600" /> }))}
                />
                <StatCard 
                    label="Efectivo en Caja" 
                    value={<Money value={summary?.totalCashInHand} className="text-2xl font-black text-slate-900 tracking-tight" />}
                    icon={Wallet}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    subtitle={`${summary?.activeShiftsCount || 0} turnos abiertos`}
                    breakdown={(summary?.cashInHandByBranch || []).map(b => ({ name: b.branch_name, value: <Money value={b.total} className="text-[10px] font-black text-slate-600" /> }))}
                />
                <StatCard 
                    label="Ventas del Mes" 
                    value={<Money value={summary?.monthlySales} className="text-2xl font-black text-slate-900 tracking-tight" />}
                    icon={DollarSign}
                    color="text-sky-600"
                    bg="bg-sky-50"
                    subtitle="Total acumulado del mes"
                    breakdown={(summary?.monthlySalesByBranch || []).map(b => ({ name: b.branch_name, value: <Money value={b.total} className="text-[10px] font-black text-slate-600" /> }))}
                />
                <StatCard 
                    label="Inventario" 
                    value={summary?.products || 0} 
                    icon={Package}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    subtitle="Productos registrados"
                />
                <StatCard 
                    label="Clientes" 
                    value={summary?.customers || 0} 
                    icon={Users}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    subtitle="Cartera de clientes"
                />
            </div>

            {/* Cajas en Línea */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-emerald-500 animate-pulse" />
                        <h3 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">Cajas en Línea</h3>
                    </div>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">{activeShifts.length} activos</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar px-4 py-3 flex gap-3">
                    {activeShifts.length > 0 ? (
                        activeShifts.map((shift) => {
                            const shiftDate = new Date(shift.start_time).toDateString();
                            const isOld = shiftDate !== new Date().toDateString();
                            return (
                                <div key={shift.id} className={`p-3.5 rounded-2xl transition-all shrink-0 w-60 ${isOld ? 'bg-amber-50/80 border-2 border-amber-400' : 'bg-slate-50/50 border border-slate-100 hover:border-indigo-200'}`}>
                                    <div className="flex justify-between items-start mb-1.5">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tight">{shift.seller_name}</p>
                                                {shift.shift_number && <span className="text-[10px] font-black text-indigo-500 shrink-0">#{shift.shift_number}</span>}
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-700 truncate">{shift.pos_name} · {shift.branch_name}</p>
                                        </div>
                                        {isOld ? <AlertCircle size={14} className="text-amber-500 shrink-0" /> : <ArrowUpRight size={14} className="text-emerald-500 shrink-0" />}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Apertura: {new Date(shift.start_time).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 mt-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Efectivo Arqueo</span>
                                        <Money value={shift.expected_cash} className="text-sm font-black text-indigo-600 tracking-tight" />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex items-center justify-center py-6 text-slate-400 gap-2 opacity-60 w-full">
                            <Monitor size={20} />
                            <p className="text-xs font-bold uppercase tracking-wider">Sin Cajas Activas en este momento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Actividad Reciente y Rendimiento por Sucursal */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Actividad Reciente */}
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
                                                <Money 
                                                    value={item.amount} 
                                                    className={`text-xs font-black tracking-tight ${isSale ? 'text-emerald-600' : isExpense ? 'text-rose-600' : 'text-slate-900'}`} 
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin movimientos registrados</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rendimiento por Sucursal */}
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
                                                <Money value={branch.monthlyTotal} className="text-lg font-black text-indigo-600" />
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

            {/* Ventas por Categoría */}
            <CategorySalesChart />
        </div>
    );
}

function CategorySalesChart() {
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

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/10 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-indigo-500" />
                    <h3 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">Ventas por Categoría</h3>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <select value={branchId} onChange={e => setBranchId(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-full sm:w-auto">
                        <option value="">Todas las sucursales</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-[140px] flex-1 min-w-0 sm:flex-none" />
                        <span className="text-[10px] text-slate-400">a</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold w-[140px] flex-1 min-w-0 sm:flex-none" />
                    </div>
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
                                <div className="w-24 text-right">
                                    <Money value={cat.total} className="text-[10px] font-bold text-slate-600" />
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 w-10 text-right">{cat.pct}%</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
