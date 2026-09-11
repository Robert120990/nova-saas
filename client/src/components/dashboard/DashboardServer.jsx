import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Server, 
    Cpu, 
    HardDrive, 
    Database, 
    Activity, 
    RefreshCw, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Zap
} from 'lucide-react';

function formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '0m';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export default function DashboardServer() {
    const { data: serverData, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['dashboard-server-stats'],
        queryFn: async () => (await axios.get('/api/dashboard/server-stats')).data,
        refetchInterval: 15000 // Refresca cada 15 segundos para telemetría en vivo
    });

    const { 
        hardware = {}, 
        services = [], 
        database = {} 
    } = serverData || {};

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Consultando telemetría del servidor...</p>
            </div>
        );
    }

    const { ram = {}, disk = {} } = hardware;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header del Monitor de Servidor */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                            <Server size={20} />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Salud y Monitoreo del Servidor</h2>
                    </div>
                    <p className="text-slate-500 font-medium text-xs sm:text-sm">Telemetría de hardware, servicios críticos, firmadores de Hacienda y base de datos</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center gap-2 shadow-sm"
                        title="Escanear estado de servicios"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
                        <span>Sondear Servicios</span>
                    </button>
                    <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200/60 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Host En Línea</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 1: TELEMETRÍA DE HARDWARE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Memoria RAM */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Memoria RAM</span>
                            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                <Zap size={16} />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h4 className="text-3xl font-black text-slate-900">{ram.percentage || 0}%</h4>
                            <span className="text-xs font-bold text-slate-400">en uso</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            {ram.usedGB || 0} GB usados de {ram.totalGB || 0} GB
                        </p>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-4">
                        <div 
                            className={`h-full rounded-full transition-all duration-700 ${
                                ram.percentage > 85 ? 'bg-rose-500' : ram.percentage > 70 ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${ram.percentage || 0}%` }}
                        />
                    </div>
                </div>

                {/* CPU Host */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Procesador Host</span>
                            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                                <Cpu size={16} />
                            </div>
                        </div>
                        <h4 className="text-xl font-black text-slate-900 truncate" title={hardware.cpuModel}>
                            {hardware.cpuCount || 1} Núcleos
                        </h4>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 truncate" title={hardware.cpuModel}>
                            {hardware.cpuModel}
                        </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-4 flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>Carga (1m / 5m / 15m):</span>
                        <span className="font-mono text-slate-700 font-bold">
                            {(hardware.loadAvg || [0, 0, 0]).join(' · ')}
                        </span>
                    </div>
                </div>

                {/* Disco Duro */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Disco Principal</span>
                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                                <HardDrive size={16} />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <h4 className="text-3xl font-black text-slate-900">{disk.percentage || 0}%</h4>
                            <span className="text-xs font-bold text-slate-400">ocupado</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            {disk.freeGB || 0} GB libres de {disk.totalGB || 0} GB
                        </p>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-4">
                        <div 
                            className={`h-full rounded-full transition-all duration-700 ${
                                disk.percentage > 90 ? 'bg-rose-500' : disk.percentage > 75 ? 'bg-amber-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${disk.percentage || 0}%` }}
                        />
                    </div>
                </div>

                {/* Uptime Host */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tiempo Activo</span>
                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                                <Clock size={16} />
                            </div>
                        </div>
                        <h4 className="text-2xl font-black text-slate-900">
                            {formatUptime(hardware.uptimeSeconds)}
                        </h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-1">
                            Node Uptime: {formatUptime(hardware.processUptimeSeconds)}
                        </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 mt-4 flex items-center justify-between text-[10px] font-bold text-emerald-600">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Sistema Estable
                        </span>
                        <span className="text-slate-400 uppercase">Sin caídas</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2: ESTADO DE SERVICIOS Y FIRMADORES DE HACIENDA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Servicios de Aplicación */}
                <div className="lg:col-span-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-indigo-600" />
                            <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Servicios Críticos y Firmadores MH</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sondeo de puertos de microservicios y contenedores Docker</p>
                            </div>
                        </div>
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                            {services.filter(s => s.status === 'online').length} / {services.length} Operativos
                        </span>
                    </div>

                    <div className="p-6 flex-1 divide-y divide-slate-100">
                        {services.map((svc) => {
                            const isOnline = svc.status === 'online';
                            return (
                                <div key={svc.name} className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                            isOnline ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                                        }`}>
                                            {isOnline ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-900 truncate">{svc.name}</h4>
                                                <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    :{svc.port}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-medium">
                                                {svc.type === 'mh' ? 'Firmador oficial de Hacienda (Contenedor Docker)' :
                                                 svc.type === 'dte' ? 'Recepción, validación y transmisión JSON DTE' :
                                                 svc.type === 'core' ? 'Backend central SaaS Express & MySQL' : 'Servicio auxiliar de eventos'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`text-xs font-black px-3 py-1 rounded-xl uppercase tracking-wider ${
                                            isOnline 
                                            ? 'bg-emerald-100/80 text-emerald-800' 
                                            : 'bg-rose-100/80 text-rose-800'
                                        }`}>
                                            {isOnline ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Base de Datos MySQL */}
                <div className="lg:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-indigo-600" />
                            <div>
                                <h3 className="text-xs font-black text-slate-900 tracking-wider uppercase">Motor MySQL</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Estado de base de datos</p>
                            </div>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>

                    <div className="p-6 flex-1 space-y-4">
                        <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/80">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Latencia Query</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                                    {database.latencyMs} ms
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">Tiempo de respuesta 'SELECT 1'</p>
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                                <span className="text-slate-500 font-bold">Conexiones Activas:</span>
                                <span className="font-black text-slate-900 font-mono">{database.connectedThreads || 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                                <span className="text-slate-500 font-bold">Consultas Lentas:</span>
                                <span className="font-black text-slate-900 font-mono">{database.slowQueries || 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                                <span className="text-slate-500 font-bold">Uptime MySQL:</span>
                                <span className="font-black text-slate-900 font-mono">{formatUptime(database.uptimeSeconds)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1">
                                <span className="text-slate-500 font-bold">Pool Connection:</span>
                                <span className="font-black text-emerald-600 uppercase text-[10px]">Healthy</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
