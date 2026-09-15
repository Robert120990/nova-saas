import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Money from '../ui/Money';
import { 
    Factory, 
    Calendar, 
    Truck, 
    RefreshCw, 
    DollarSign, 
    Activity, 
    FlaskConical, 
    ShieldCheck
} from 'lucide-react';

export default function DashboardAndelsa() {
    const { user } = useAuth();
    const [dispatchFilter, setDispatchFilter] = useState('all'); // 'all' | 'today' | 'tomorrow'
    const [calendarTab, setCalendarTab] = useState('prep'); // 'prep' | 'calendar'

    const { data: andelsaData, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['dashboard-andelsa-stats', user?.company_id],
        queryFn: async () => (await axios.get('/api/dashboard/andelsa-stats')).data,
        enabled: !!user?.company_id,
        refetchInterval: 60000
    });

    const { 
        calendarOperations = [], 
        weeklyWarehousePrep = { nextDays: [], rawMaterials: [] }, 
        dispatchControl = [], 
        productionCosts = { avgCostPerLb: 0, totalCost: 0, totalPounds: 0 }, 
        productionPipeline = [], 
        batchApprovals = [] 
    } = andelsaData || {};

    const filteredDispatches = dispatchControl.filter(d => {
        if (dispatchFilter === 'today') return d.is_today;
        if (dispatchFilter === 'tomorrow') return !d.is_today;
        return true;
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cargando operaciones de planta Andelsa...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header de Planta Andelsa */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
                            <Factory size={20} />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Dashboard Andelsa (Planta Industrial)</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Operación de producción de huevo líquido pasteurizado, costos, bodega y despachos</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                        title="Actualizar datos de planta"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
                        <span>Actualizar</span>
                    </button>
                    <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-200/60 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Planta Activa</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards de Planta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Costo Promedio Mes</span>
                        <div className="flex items-baseline gap-1">
                            <Money value={productionCosts.avgCostPerLb} className="text-2xl font-black text-slate-900" />
                            <span className="text-xs font-black text-indigo-600">/ lb</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mt-1">
                            {productionCosts.totalPounds > 0 ? `${Math.round(productionCosts.totalPounds).toLocaleString()} lbs procesadas` : 'Mes en curso'}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                        <DollarSign size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Lotes en Proceso</span>
                        <h4 className="text-2xl font-black text-slate-900">{productionPipeline.length}</h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">Pipeline activo en planta</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm">
                        <Activity size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Despachos Hoy y Mañana</span>
                        <h4 className="text-2xl font-black text-slate-900">{dispatchControl.length}</h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">Rutas de entrega a clientes</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-sm">
                        <Truck size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Liberación de Calidad</span>
                        <h4 className="text-2xl font-black text-emerald-600">{batchApprovals.length}</h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">Lotes en laboratorio / COA</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                        <FlaskConical size={24} />
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: CONTROL DE DESPACHO PARA HOY Y MAÑANA */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <Truck size={16} className="text-sky-600" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Control de Despacho (Hoy y Mañana)</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Órdenes de entrega programadas y estatus de ruta</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => setDispatchFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                dispatchFilter === 'all' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todos ({dispatchControl.length})
                        </button>
                        <button
                            onClick={() => setDispatchFilter('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                dispatchFilter === 'today' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Despacho Hoy ({dispatchControl.filter(d => d.is_today).length})
                        </button>
                        <button
                            onClick={() => setDispatchFilter('tomorrow')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                dispatchFilter === 'tomorrow' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Despacho Mañana ({dispatchControl.filter(d => !d.is_today).length})
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {filteredDispatches.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredDispatches.map((order) => (
                                <div 
                                    key={order.id} 
                                    className={`p-5 rounded-2xl border ${order.is_today ? 'border-sky-300 bg-sky-50/20' : 'border-slate-200 bg-slate-50/40'} hover:bg-white transition-all shadow-sm flex flex-col justify-between`}
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0">
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                                    order.is_today ? 'bg-sky-100 text-sky-800 font-black' : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {order.is_today ? '⚡ Entrega Hoy' : '📅 Entrega Mañana'} · #{order.order_number || order.id}
                                                </span>
                                                <h4 className="text-sm font-black text-slate-900 truncate mt-1.5">{order.customer_name}</h4>
                                                <p className="text-[11px] font-bold text-slate-500">{order.product_type} · {order.presentation}</p>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                order.delivery_status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                                                order.delivery_status === 'in_transit' ? 'bg-sky-100 text-sky-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {order.delivery_status === 'delivered' ? 'Entregado' :
                                                 order.delivery_status === 'in_transit' ? 'En Ruta' : 'Pendiente'}
                                            </span>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-100 my-2 flex items-center justify-between">
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Ruta / Chofer</span>
                                                <span className="text-xs font-bold text-slate-800 truncate block">
                                                    {order.route_name || 'Ruta estándar'} {order.driver_name ? `· ${order.driver_name}` : ''}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Peso Carga</span>
                                                <span className="text-sm font-black text-indigo-600">{Math.round(order.quantity_lbs).toLocaleString()} lbs</span>
                                            </div>
                                        </div>
                                    </div>

                                    {order.recipient_name && (
                                        <div className="text-[10px] text-slate-400 font-medium pt-1">
                                            Receptor: {order.recipient_name} {order.recipient_phone ? `(${order.recipient_phone})` : ''}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400">
                            <Truck size={30} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">No hay despachos programados para el filtro seleccionado</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 2: CALENDARIO SEMANAL Y PREPARACIÓN DE BODEGA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Calendario y Preparación Bodega */}
                <div className="lg:col-span-7 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/20">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-600" />
                            <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">
                                    {calendarTab === 'prep' ? 'Preparación Bodega (Próximos 7 Días)' : 'Operación Calendario (Lotes Programados)'}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    {calendarTab === 'prep' ? 'Demanda proyectada de materia prima e insumos' : 'Programación de corridas de pasteurización'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => setCalendarTab('prep')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                    calendarTab === 'prep' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Bodega (7 Días)
                            </button>
                            <button
                                onClick={() => setCalendarTab('calendar')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                    calendarTab === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Lotes ({calendarOperations.length})
                            </button>
                        </div>
                    </div>

                    <div className="p-6 flex-1 space-y-4">
                        {calendarTab === 'calendar' ? (
                            calendarOperations.length > 0 ? (
                                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                    {calendarOperations.map((item) => (
                                        <div key={item.id} className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs shrink-0">
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Hora</span>
                                                    <span className="text-xs font-black text-indigo-600">{item.start_time ? item.start_time.substring(0, 5) : '08:00'}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-black text-slate-900">
                                                            Lote #{item.lot_code || item.id}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                                            {item.product_profile || 'Huevo Líquido'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                                        {new Date(item.production_date).toLocaleDateString('es-SV', { weekday: 'short', day: 'numeric', month: 'short' })} · Op: {item.assigned_operator_name || 'Sin asignar'} {item.presentation ? `· ${item.presentation}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-sm font-black text-slate-900 block">{Math.round(item.target_quantity_lbs).toLocaleString()} lbs</span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    item.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                                    item.status === 'in_progress' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {item.status || 'Programado'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-wider">
                                    No hay corridas programadas en el calendario
                                </p>
                            )
                        ) : (
                            <>
                                {weeklyWarehousePrep.nextDays?.length > 0 ? (
                                    <div className="space-y-3">
                                        {weeklyWarehousePrep.nextDays.map((d, idx) => (
                                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Día</span>
                                                        <span className="text-sm font-black text-indigo-600">{new Date(d.date).getDate()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-black text-slate-900 block">
                                                            {new Date(d.date).toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">{d.total_batches} corridas de pasteurización programadas</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-sm font-black text-slate-900 block">{Math.round(d.total_lbs).toLocaleString()} lbs</span>
                                                    <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">A listar en bodega</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-wider">
                                        Sin programaciones para los próximos 7 días
                                    </p>
                                )}

                                {/* Materia Prima Disponible en Bodega */}
                                <div className="pt-3 border-t border-slate-100">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">Lotes de Huevo en Cáscara Disponibles</span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(weeklyWarehousePrep.rawMaterials || []).map((rm) => (
                                            <div key={rm.id} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex justify-between items-center shadow-xs">
                                                <div className="min-w-0">
                                                    <span className="font-black text-slate-800 truncate block">Lote #{rm.lot_number}</span>
                                                    <span className="text-[10px] text-slate-400 truncate block">{rm.provider_name}</span>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="font-black text-indigo-600 block">{Math.round(rm.quantity_boxes)} Cajas</span>
                                                    <span className="text-[10px] text-slate-400">{Math.round(rm.total_weight_lb)} lbs</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Pipeline de Lotes Activos en Planta */}
                <div className="lg:col-span-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-amber-500" />
                            <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Pipeline de Lotes Activos</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estado de corridas en pasteurizadora</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 flex-1 space-y-3">
                        {productionPipeline.length > 0 ? (
                            productionPipeline.map((batch) => (
                                <div key={batch.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all shadow-sm">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                                Lote #{batch.batch_number || batch.id}
                                            </span>
                                            <h4 className="text-sm font-black text-slate-900 mt-1">{batch.product_type}</h4>
                                        </div>
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                            {batch.status || 'EN PROCESO'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 my-2 py-2 border-y border-slate-200/60 text-xs">
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 block">Libras Entrada</span>
                                            <span className="font-bold text-slate-700">{Math.round(batch.input_weight_lbs)} lbs</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-bold text-slate-400 block">Rendimiento Líquido</span>
                                            <span className="font-black text-emerald-600">{Math.round(batch.yield_liquid_lbs)} lbs</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                        <span>Brix: {batch.measured_brix || '—'}° · Sólidos: {batch.measured_solids_pct || '—'}%</span>
                                        <span>Operador: {batch.operator_name || 'Turno Planta'}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-slate-400 py-12 text-xs font-bold uppercase tracking-wider">
                                No hay lotes en proceso de quebrado o pasteurización
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3: LIBERACIÓN DE CALIDAD Y COA */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Bandeja de Aprobación de Calidad y COA</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Parámetros fisicoquímicos y microbiológicos para liberación</p>
                        </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                        {batchApprovals.length} {batchApprovals.length === 1 ? 'Lote evaluado' : 'Lotes evaluados'}
                    </span>
                </div>

                <div className="p-6">
                    {batchApprovals.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {batchApprovals.map((test) => (
                                <div key={test.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                                Lote #{test.batch_number}
                                            </span>
                                            <h4 className="text-sm font-black text-slate-900 mt-1">{test.product_type}</h4>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            test.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                            test.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {test.status === 'approved' ? 'Liberado' : test.status === 'rejected' ? 'Rechazado' : 'En Cuarentena'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-slate-200/60 text-center">
                                        <div className="bg-white p-1.5 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-bold text-slate-400 block">pH</span>
                                            <span className="text-xs font-black text-slate-800">{test.ph || '—'}</span>
                                        </div>
                                        <div className="bg-white p-1.5 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-bold text-slate-400 block">Brix</span>
                                            <span className="text-xs font-black text-slate-800">{test.brix || '—'}°</span>
                                        </div>
                                        <div className="bg-white p-1.5 rounded-xl border border-slate-100">
                                            <span className="text-[8px] font-bold text-slate-400 block">Sólidos</span>
                                            <span className="text-xs font-black text-slate-800">{test.solids_percentage || '—'}%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1">
                                        <span>Fecha: {test.sample_date ? new Date(test.sample_date).toLocaleDateString('es-SV') : 'Reciente'}</span>
                                        <span>Analista: {test.analyst_name || 'Control Calidad'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400">
                            <ShieldCheck size={30} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">No hay lotes en cuarentena de laboratorio</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
