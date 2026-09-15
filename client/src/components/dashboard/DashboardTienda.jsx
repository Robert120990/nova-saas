import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Money from '../ui/Money';
import { 
    Store, 
    Package, 
    CreditCard, 
    Clock, 
    RefreshCw, 
    CheckCircle2, 
    Wallet, 
    Layers,
    Award
} from 'lucide-react';

export default function DashboardTienda() {
    const { user } = useAuth();
    const [period, setPeriod] = useState('month'); // 'today' | 'week' | 'month'

    const { data: tiendaData, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['dashboard-tienda-stats', user?.company_id, period],
        queryFn: async () => (await axios.get(`/api/dashboard/tienda-stats?period=${period}`)).data,
        enabled: !!user?.company_id,
        refetchInterval: 60000
    });

    const { 
        activeShifts = [], 
        topProducts = [], 
        topCategories = [], 
        pendingChecks = [], 
        summary = {} 
    } = tiendaData || {};

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cargando métricas de tienda...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header de Tienda */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                            <Store size={20} />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Dashboard Tienda</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Control de cajas de conveniencia, ranking de ventas y cheques pendientes</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                        title="Actualizar datos de tienda"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin text-emerald-600' : 'text-slate-500'} />
                        <span>Actualizar</span>
                    </button>
                    <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200/60 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Tienda Operativa</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards de Tienda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cajas Abiertas</span>
                        <h4 className="text-2xl font-black text-slate-900">{activeShifts.length}</h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">Cajeros operando en piso</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                        <Store size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Efectivo en Gavetas</span>
                        <Money 
                            value={activeShifts.reduce((acc, s) => acc + (s.cash_in_drawer || 0), 0)} 
                            className="text-2xl font-black text-slate-900" 
                        />
                        <p className="text-[11px] font-bold text-slate-500 mt-1">Saldo inicial + cobros efectivo</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <Wallet size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Cheques x Entregar</span>
                        <h4 className="text-2xl font-black text-rose-600">{pendingChecks.length}</h4>
                        <div className="text-[11px] font-bold text-slate-500 mt-1">
                            Total: <Money value={summary?.pendingChecksAmount || 0} className="font-bold text-slate-700" />
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm">
                        <CreditCard size={24} />
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: TURNOS ACTIVOS EN TIENDA */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-emerald-600" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Cajas y Turnos Abiertos</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cajeros de tienda y ventas en curso</p>
                        </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                        {activeShifts.length} {activeShifts.length === 1 ? 'Caja activa' : 'Cajas activas'}
                    </span>
                </div>

                <div className="p-6">
                    {activeShifts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {activeShifts.map((shift) => (
                                <div 
                                    key={shift.id} 
                                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-emerald-300 transition-all shadow-sm flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
                                                        {shift.seller_name}
                                                    </h4>
                                                    {shift.shift_number && (
                                                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                            #{shift.shift_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 truncate mt-0.5">
                                                    {shift.pos_name} · {shift.branch_name}
                                                </p>
                                            </div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                                        </div>

                                        <p className="text-[11px] text-slate-400 font-medium mt-1">
                                            Apertura: {new Date(shift.start_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                                        </p>

                                        {/* Desglose de Ventas */}
                                        <div className="grid grid-cols-2 gap-2 my-3 pt-2 border-t border-slate-200/60 text-center">
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Efectivo</span>
                                                <Money value={shift.cash_sales} className="text-xs font-black text-emerald-600" />
                                            </div>
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Tarjeta/Otros</span>
                                                <Money value={shift.card_sales} className="text-xs font-black text-indigo-600" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Gaveta Esperada</span>
                                        <Money value={shift.cash_in_drawer} className="text-base font-black text-slate-900 tracking-tight" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400">
                            <Store size={30} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">No hay turnos de tienda abiertos en este momento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 2: PRODUCTOS Y CATEGORÍAS MÁS VENDIDAS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Ranking de Productos Más Vendidos */}
                <div className="lg:col-span-7 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/20">
                        <div className="flex items-center gap-2">
                            <Award size={16} className="text-amber-500" />
                            <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Productos Más Vendidos</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ranking por volumen y facturación (Excluye combustibles y lubricantes)</p>
                            </div>
                        </div>

                        {/* Selector de Período */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setPeriod('today')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    period === 'today' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Hoy
                            </button>
                            <button
                                onClick={() => setPeriod('week')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    period === 'week' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                7 Días
                            </button>
                            <button
                                onClick={() => setPeriod('month')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    period === 'month' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                Este Mes
                            </button>
                        </div>
                    </div>

                    <div className="p-6 flex-1">
                        {topProducts.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {topProducts.map((p, idx) => (
                                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-xs font-black text-slate-900 truncate uppercase">{p.nombre}</p>
                                                <p className="text-[10px] text-slate-400 font-medium truncate">{p.categoria} · {p.codigo}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <Money value={p.monto} className="text-xs font-black text-slate-900 block" />
                                            <span className="text-[10px] font-bold text-emerald-600">{Math.round(p.cantidad)} un.</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-400">
                                <Package size={30} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-wider">Sin ventas registradas en el período</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Categorías Más Vendidas con Métricas */}
                <div className="lg:col-span-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-indigo-600" />
                            <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Mix por Categoría</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Participación en ventas (Excluye combustibles y lubricantes)</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 flex-1 space-y-4">
                        {topCategories.length > 0 ? (
                            topCategories.map((cat, i) => (
                                <div key={cat.name} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-800 truncate">{cat.name}</span>
                                        <div className="flex items-center gap-2">
                                            <Money value={cat.total_amount} className="font-black text-slate-900" />
                                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                {cat.percentage}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{ 
                                                width: `${cat.percentage}%`,
                                                backgroundColor: ['#10b981', '#6366f1', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 6]
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                                        <span>{cat.products_count} productos</span>
                                        <span>{Math.round(cat.total_qty)} unidades vendidas</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-400 py-12 text-xs font-bold uppercase tracking-wider">
                                Sin categorías con ventas en el período
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: CHEQUES PENDIENTES DE ENTREGA A PROVEEDORES */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-rose-600" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Cheques Pendientes de Entrega</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Emitidos a proveedores esperando retiro</p>
                        </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">
                        {pendingChecks.length} {pendingChecks.length === 1 ? 'Cheque pendiente' : 'Cheques pendientes'}
                    </span>
                </div>

                <div className="p-6">
                    {pendingChecks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingChecks.map((ch) => {
                                const isUrgent = ch.dias_espera > 15;
                                return (
                                    <div 
                                        key={ch.id} 
                                        className={`p-4 rounded-2xl border ${isUrgent ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200 bg-slate-50/40'} hover:bg-white transition-all shadow-sm flex flex-col justify-between`}
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
                                                        Cheque #{ch.rrs_num_cheque || ch.documento || ch.id}
                                                    </span>
                                                    <h4 className="text-sm font-black text-slate-900 truncate mt-1">{ch.provider_name}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400">{ch.branch_name}</p>
                                                </div>
                                                <Money value={ch.monto} className="text-sm font-black text-slate-900 shrink-0" />
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-3">
                                                <span>Fecha Emisión:</span>
                                                <span className="font-bold text-slate-700">{new Date(ch.fecha).toLocaleDateString('es-SV')}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/40">
                                            <span className="text-[10px] font-bold text-slate-400">Tiempo de Espera:</span>
                                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
                                                {ch.dias_espera} {ch.dias_espera === 1 ? 'día' : 'días'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400">
                            <CheckCircle2 size={30} className="mx-auto text-emerald-400 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Todos los cheques emitidos han sido entregados a proveedores</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
