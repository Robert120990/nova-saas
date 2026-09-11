import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Money from '../ui/Money';
import { 
    Fuel, 
    AlertTriangle, 
    Clock, 
    CreditCard, 
    Truck, 
    User, 
    RefreshCw, 
    CheckCircle2, 
    Droplet,
    ShieldAlert
} from 'lucide-react';

function getTankFuelDisplay(tank) {
    const rawTipo = String(tank?.tipo_combustible ?? '');
    const rawDesc = String(tank?.descripcion ?? '').toLowerCase();
    const rawCod = String(tank?.codigo ?? '').toLowerCase();

    const isDiesel = rawTipo === '3' || rawTipo === '5' || rawDesc.includes('diesel') || rawDesc.includes('diésel') || rawCod.includes('die');
    const isSuper = rawTipo === '2' || rawDesc.includes('super') || rawDesc.includes('súper') || rawCod.includes('sup');
    const isRegular = rawTipo === '1' || rawDesc.includes('regular') || rawCod.includes('reg');

    let label = 'Combustible';
    if (isDiesel) label = 'Diésel';
    else if (isSuper) label = 'Gasolina Súper';
    else if (isRegular) label = 'Gasolina Regular';
    else if (tank?.descripcion) label = tank.descripcion;

    let theme = {
        border: 'border-sky-200',
        bgLight: 'bg-sky-50',
        liquidGradient: 'from-sky-500 to-cyan-500',
        badge: 'bg-sky-100 text-sky-700',
        accent: 'text-sky-600',
        pill: 'bg-sky-500'
    };

    if (isDiesel) {
        theme = {
            border: 'border-emerald-200',
            bgLight: 'bg-emerald-50',
            liquidGradient: 'from-emerald-600 to-teal-500',
            badge: 'bg-emerald-100 text-emerald-800',
            accent: 'text-emerald-700',
            pill: 'bg-emerald-600'
        };
    } else if (isSuper) {
        theme = {
            border: 'border-rose-200',
            bgLight: 'bg-rose-50',
            liquidGradient: 'from-rose-600 to-amber-500',
            badge: 'bg-rose-100 text-rose-800',
            accent: 'text-rose-700',
            pill: 'bg-rose-600'
        };
    }

    return { label, theme };
}

export default function DashboardPista() {
    const { user } = useAuth();
    const [balanceTab, setBalanceTab] = useState('trupput'); // 'trupput' | 'advances' | 'credits'

    const { data: pistaData, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['dashboard-pista-stats', user?.company_id],
        queryFn: async () => (await axios.get('/api/dashboard/pista-stats')).data,
        enabled: !!user?.company_id,
        refetchInterval: 30000 // Refresca cada 30 segundos en pista
    });

    const { 
        tanks = [], 
        activeShifts = [], 
        rejectedDtes = [], 
        pendingCredits = [], 
        trupputBalances = [], 
        advanceBalances = [], 
        upcomingPipas = [] 
    } = pistaData || {};

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Cargando telemetría de pista...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Styles for liquid wave animation */}
            <style>{`
                @keyframes fluidWave {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .tank-wave-wrapper {
                    position: relative;
                    overflow: hidden;
                    border-radius: 1.5rem;
                }
                .tank-wave {
                    position: absolute;
                    width: 200%;
                    height: 200%;
                    top: -50%;
                    left: -50%;
                    border-radius: 40%;
                    animation: fluidWave 10s infinite linear;
                    opacity: 0.18;
                    background: white;
                }
                .tank-wave-secondary {
                    position: absolute;
                    width: 210%;
                    height: 210%;
                    top: -55%;
                    left: -55%;
                    border-radius: 43%;
                    animation: fluidWave 14s infinite linear reverse;
                    opacity: 0.12;
                    background: white;
                }
            `}</style>

            {/* Header de Pista */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                            <Fuel size={20} />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Dashboard Pista</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Control de despacho de combustible, tanques, pipas y saldos autorizados</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                        title="Actualizar datos de pista"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin text-amber-600' : 'text-slate-500'} />
                        <span>Actualizar</span>
                    </button>
                    <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-200/60 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
                        <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Pista Activa</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: INVENTARIO GRÁFICO ANIMADO POR TANQUE */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Droplet size={18} className="text-amber-500" />
                        <h3 className="text-sm font-black text-slate-900 tracking-wider uppercase">Inventario Gráfico por Tanque</h3>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                        {tanks.length} {tanks.length === 1 ? 'Tanque instalado' : 'Tanques instalados'}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {tanks.map((tank) => {
                        const { label: fuelLabel, theme } = getTankFuelDisplay(tank);
                        const isCritical = tank.status === 'critical';
                        const isWarning = tank.status === 'warning';

                        return (
                            <div 
                                key={tank.id} 
                                className={`bg-white rounded-3xl p-5 border ${isCritical ? 'border-red-400 ring-2 ring-red-300' : isWarning ? 'border-amber-300' : theme.border} shadow-sm flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md`}
                            >
                                {/* Header del tanque */}
                                <div className="flex items-start justify-between gap-2 mb-3 z-10">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2.5 h-2.5 rounded-full ${theme.pill}`}></span>
                                            <h4 className="font-black text-slate-900 text-sm tracking-tight truncate uppercase">
                                                {tank.codigo} · {tank.descripcion}
                                            </h4>
                                        </div>
                                        <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5">{tank.branch_name}</p>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${theme.badge} shrink-0`}>
                                        {fuelLabel}
                                    </span>
                                </div>

                                {/* Visualizador Cilíndrico de Fluido con Animación */}
                                <div className="relative h-44 w-full bg-slate-100/90 rounded-2xl overflow-hidden border border-slate-200/80 my-2 z-10 flex flex-col justify-end">
                                    {/* Capa de líquido con altura según porcentaje */}
                                    <div 
                                        className={`w-full bg-gradient-to-t ${theme.liquidGradient} relative transition-all duration-1000 ease-out`}
                                        style={{ height: `${Math.min(100, Math.max(8, tank.porcentaje))}%` }}
                                    >
                                        {/* Olas líquidas animadas en la superficie */}
                                        <div className="tank-wave"></div>
                                        <div className="tank-wave-secondary"></div>
                                    </div>

                                    {/* Overlay de Métricas dentro del tanque */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-3 text-center">
                                        <div className="bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-lg">
                                            <span className="text-xl font-black text-white tracking-tight">
                                                {Math.round(tank.galones_actuales).toLocaleString()} <span className="text-xs font-bold text-slate-200">Gln</span>
                                            </span>
                                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                                <span className="text-[11px] font-black text-amber-300">
                                                    {tank.porcentaje}% Lleno
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Marca de nivel de reserva */}
                                    <div 
                                        className="absolute w-full border-b border-dashed border-red-400/80 flex items-center justify-end pr-2 pointer-events-none"
                                        style={{ bottom: `${Math.min(100, Math.round((tank.reserva / tank.capacidad) * 100))}%` }}
                                    >
                                        <span className="text-[8px] font-black bg-red-500 text-white px-1 rounded uppercase tracking-widest shadow-sm">
                                            Reserva ({Math.round(tank.reserva)} Gln)
                                        </span>
                                    </div>
                                </div>

                                {/* Footer de especificaciones y alertas */}
                                <div className="pt-2 z-10 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                        <span>Capacidad Nominal:</span>
                                        <span className="font-black text-slate-800">{Math.round(tank.capacidad).toLocaleString()} Gln</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                        <span>Espacio Libre:</span>
                                        <span className="font-black text-slate-800">
                                            {Math.max(0, Math.round(tank.capacidad - tank.galones_actuales)).toLocaleString()} Gln
                                        </span>
                                    </div>

                                    {isCritical ? (
                                        <div className="mt-2 py-1 px-2 rounded-xl bg-red-100 text-red-700 text-[10px] font-black uppercase text-center flex items-center justify-center gap-1">
                                            <AlertTriangle size={12} /> Nivel crítico: reabastecer
                                        </div>
                                    ) : isWarning ? (
                                        <div className="mt-2 py-1 px-2 rounded-xl bg-amber-100 text-amber-800 text-[10px] font-black uppercase text-center flex items-center justify-center gap-1">
                                            <AlertTriangle size={12} /> Próximo a reserva
                                        </div>
                                    ) : (
                                        <div className="mt-2 py-1 px-2 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase text-center flex items-center justify-center gap-1">
                                            <CheckCircle2 size={12} /> Capacidad Óptima
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* WIDGET DE MONITOREO DTE COMPACTO: DTEs Rechazados en el Día y Turnos Activos con Causa */}
            {rejectedDtes.length > 0 ? (
                <div className="bg-rose-50/40 border border-rose-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
                                <ShieldAlert size={16} />
                            </div>
                            <div>
                                <h3 className="text-xs sm:text-sm font-black text-rose-950 uppercase tracking-wide flex items-center gap-2">
                                    DTEs Rechazados en el Día
                                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase">
                                        {rejectedDtes.length}
                                    </span>
                                </h3>
                            </div>
                        </div>
                        <span className="text-[11px] text-rose-700 font-medium">
                            Causa oficial devuelta por validación de Hacienda
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {rejectedDtes.map((dte) => (
                            <div key={dte.id} className="bg-white rounded-xl border border-rose-200/90 p-3 shadow-xs hover:border-rose-400 transition-all flex flex-col justify-between text-[11px]">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                                            {dte.tipo_dte === '01' ? 'Factura' : dte.tipo_dte === '03' ? 'CCF' : `DTE ${dte.tipo_dte || ''}`}
                                        </span>
                                        <span className="text-[10px] font-mono font-semibold text-slate-500 truncate" title={dte.numero_control}>
                                            {dte.numero_control ? dte.numero_control.slice(-10) : `#${dte.id}`}
                                        </span>
                                        <Money value={dte.monto} className="text-xs font-black text-rose-600 shrink-0 ml-auto" />
                                    </div>

                                    <p className="font-bold text-slate-800 truncate text-[11px]" title={dte.cliente}>
                                        {dte.cliente}
                                    </p>

                                    <div className="bg-rose-50/70 rounded-lg p-2 border border-rose-100/90">
                                        <div className="flex items-center justify-between text-[9px] font-black text-rose-700 uppercase mb-0.5">
                                            <span>Causa</span>
                                            <span className="font-mono">Cód: {dte.codigo_error}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-700 font-medium line-clamp-2 leading-tight" title={dte.mensaje_error}>
                                            {dte.mensaje_error}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[9px] text-slate-400 font-medium">
                                    <span className="truncate max-w-[140px]" title={`${dte.pos_name} · T#${dte.shift_number}`}>
                                        {dte.pos_name} · T#{dte.shift_number}
                                    </span>
                                    <span>
                                        {new Date(dte.fecha).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl px-3.5 py-2 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-bold text-emerald-900">
                            DTEs Pista: Sin rechazos en el día
                        </span>
                        <span className="text-[10px] text-emerald-700 hidden sm:inline">
                            — Todos los comprobantes tributarios emitidos hoy fueron autorizados por Hacienda
                        </span>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded">
                        0 Errores
                    </span>
                </div>
            )}

            {/* SECCIÓN 2: TURNOS ACTIVOS DE PISTA (SIN MOSTRAR EFECTIVO ESPERADO) */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <User size={16} className="text-amber-500" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Turnos Activos en Pista</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Despachadores en bomba abiertos</p>
                        </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        {activeShifts.length} {activeShifts.length === 1 ? 'Turno abierto' : 'Turnos abiertos'}
                    </span>
                </div>

                <div className="p-6">
                    {activeShifts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {activeShifts.map((shift) => (
                                <div 
                                    key={shift.id} 
                                    className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-amber-300 transition-all flex flex-col justify-between shadow-sm"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
                                                        {shift.seller_name}
                                                    </p>
                                                    {shift.shift_number && (
                                                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                                                            #{shift.shift_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-slate-600 truncate mt-0.5">
                                                    {shift.pos_name} · {shift.branch_name}
                                                </p>
                                            </div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-2">
                                            <Clock size={12} className="text-slate-400" />
                                            <span>Apertura: {new Date(shift.start_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>

                                    {/* Métricas de venta de pista (SIN mostrar efectivo esperado, por regla del usuario) */}
                                    <div className="pt-3 border-t border-slate-200/60 mt-3 flex items-center justify-between">
                                        <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Ventas Turno</span>
                                            <Money value={shift.total_sales} className="text-sm font-black text-emerald-600" />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tickets</span>
                                            <span className="text-sm font-black text-slate-800">{shift.sales_count}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center text-slate-400">
                            <Fuel size={32} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">No hay turnos de pista abiertos en este momento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 3: PRÓXIMAS PIPAS (PEDIDOS DE COMBUSTIBLE) */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <Truck size={16} className="text-indigo-600" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Próximas Pipas / Pedidos en Camino</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cisternas y despachos programados</p>
                        </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        {upcomingPipas.length} {upcomingPipas.length === 1 ? 'Pipa activa' : 'Pipas activas'}
                    </span>
                </div>

                <div className="p-6">
                    {upcomingPipas.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingPipas.map((pipa) => (
                                <div key={pipa.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-indigo-300 transition-all shadow-sm">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                                Pedido #{pipa.numero || pipa.id}
                                            </span>
                                            <h4 className="text-sm font-black text-slate-900 mt-1">
                                                Cisterna: {pipa.cisterna || 'Por descargar'}
                                            </h4>
                                            {pipa.placa && (
                                                <p className="text-[11px] font-bold text-slate-500">Placa: {pipa.placa}</p>
                                            )}
                                        </div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            pipa.estado === 'EN RUTA' ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {pipa.estado || 'PROGRAMADO'}
                                        </span>
                                    </div>

                                    {/* Desglose de Galones */}
                                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-200/60 my-2 text-center">
                                        <div className="bg-emerald-50/80 p-1.5 rounded-xl border border-emerald-100">
                                            <span className="text-[9px] font-bold text-emerald-700 block">Diésel</span>
                                            <span className="text-xs font-black text-emerald-900">{Math.round(pipa.galones_diesel || 0)} Gln</span>
                                        </div>
                                        <div className="bg-sky-50/80 p-1.5 rounded-xl border border-sky-100">
                                            <span className="text-[9px] font-bold text-sky-700 block">Regular</span>
                                            <span className="text-xs font-black text-sky-900">{Math.round(pipa.galones_regular || 0)} Gln</span>
                                        </div>
                                        <div className="bg-rose-50/80 p-1.5 rounded-xl border border-rose-100">
                                            <span className="text-[9px] font-bold text-rose-700 block">Súper</span>
                                            <span className="text-xs font-black text-rose-900">{Math.round(pipa.galones_super || 0)} Gln</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 pt-1">
                                        <span>Total Galonaje:</span>
                                        <span className="text-indigo-600 font-black">{Math.round(pipa.total_galones).toLocaleString()} Gln</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mt-1">
                                        <span>Entrega Estimada:</span>
                                        <span>{pipa.fecha_entrega ? new Date(pipa.fecha_entrega).toLocaleDateString('es-SV') : 'Pendiente'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-slate-400">
                            <Truck size={30} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">No hay pedidos de pipas en camino en este momento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 4: BALANCES Y SALDOS DE CLIENTES (TRUPPUT, ANTICIPOS, CRÉDITOS) */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20">
                    <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-indigo-600" />
                        <div>
                            <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Cartera y Saldos Autorizados en Pista</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contratos Trupput, Anticipos y Créditos de clientes</p>
                        </div>
                    </div>

                    {/* Selector de Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            onClick={() => setBalanceTab('trupput')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                balanceTab === 'trupput' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Saldos Trupput ({trupputBalances.length})
                        </button>
                        <button
                            onClick={() => setBalanceTab('advances')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                balanceTab === 'advances' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Anticipos a Favor ({advanceBalances.length})
                        </button>
                        <button
                            onClick={() => setBalanceTab('credits')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                balanceTab === 'credits' 
                                ? 'bg-white text-indigo-600 shadow-sm' 
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Créditos Pendientes ({pendingCredits.length})
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {/* TAB 1: TRUPPUT */}
                    {balanceTab === 'trupput' && (
                        <div>
                            {trupputBalances.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {trupputBalances.map((item) => (
                                        <div key={item.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                        Contrato #{item.numero || item.id}
                                                    </span>
                                                    <h4 className="text-sm font-black text-slate-900 truncate mt-1">{item.cliente}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400">{item.branch_name}</p>
                                                </div>
                                            </div>

                                            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/80 my-2 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Galones Disponibles</span>
                                                    <span className="text-lg font-black text-indigo-600">
                                                        {Math.round(item.galones_disponibles).toLocaleString()} <span className="text-xs font-bold">Gln</span>
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Precio Pactado</span>
                                                    <Money value={item.precio} className="text-xs font-black text-slate-800" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                                <span>Total Contratado:</span>
                                                <span className="font-bold text-slate-700">{Math.round(item.galones_totales).toLocaleString()} Gln</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-wider">
                                    No hay contratos Trupput con saldo activo
                                </p>
                            )}
                        </div>
                    )}

                    {/* TAB 2: ANTICIPOS A FAVOR */}
                    {balanceTab === 'advances' && (
                        <div>
                            {advanceBalances.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {advanceBalances.map((item) => (
                                        <div key={item.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        Anticipo #{item.numero || item.id}
                                                    </span>
                                                    <h4 className="text-sm font-black text-slate-900 truncate mt-1">{item.cliente}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400">{item.branch_name}</p>
                                                </div>
                                            </div>

                                            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/80 my-2 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Saldo Disponible</span>
                                                    <Money value={item.monto_disponible} className="text-lg font-black text-emerald-600" />
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Monto Inicial</span>
                                                    <Money value={item.monto_inicial} className="text-xs font-black text-slate-700" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                                                <span>Fecha Registro:</span>
                                                <span className="font-bold text-slate-700">{new Date(item.fecha).toLocaleDateString('es-SV')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-wider">
                                    No hay anticipos de combustible con saldo disponible
                                </p>
                            )}
                        </div>
                    )}

                    {/* TAB 3: CRÉDITOS PENDIENTES */}
                    {balanceTab === 'credits' && (
                        <div>
                            {pendingCredits.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {pendingCredits.map((item) => (
                                        <div key={item.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-all shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                        Factura #{item.id}
                                                    </span>
                                                    <h4 className="text-sm font-black text-slate-900 truncate mt-1">{item.cliente}</h4>
                                                    {item.telefono && <p className="text-[10px] font-medium text-slate-400">Tel: {item.telefono}</p>}
                                                </div>
                                                <Money value={item.monto} className="text-sm font-black text-slate-900" />
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-2">
                                                <span>Días de Crédito:</span>
                                                <span className={`font-black ${item.dias_credito > 30 ? 'text-rose-600' : 'text-slate-700'}`}>
                                                    {item.dias_credito} días
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                                <span>Sucursal:</span>
                                                <span className="font-bold text-slate-600">{item.branch_name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-slate-400 py-8 text-xs font-bold uppercase tracking-wider">
                                    No hay créditos pendientes registrados en pista
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
