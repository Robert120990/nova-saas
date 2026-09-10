import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Activity,
    Cpu,
    HardDrive,
    Database,
    Server,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    RotateCw,
    Layers,
    Shield,
    Table,
} from 'lucide-react';
import { toast } from 'sonner';

const REFRESH_INTERVALS = [
    { label: '3 seg', value: 3000 },
    { label: '5 seg', value: 5000 },
    { label: '10 seg', value: 10000 },
    { label: 'Pausado', value: 0 },
];

function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0 seg';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (parts.length === 0 || s > 0) parts.push(`${s}s`);
    return parts.slice(0, 3).join(' ');
}

export default function ServerMetrics() {
    const [refreshInterval, setRefreshInterval] = useState(5000);
    const [isRestartingDte, setIsRestartingDte] = useState(false);
    const [showRestartConfirm, setShowRestartConfirm] = useState(false);

    const {
        data: metrics,
        isLoading,
        isFetching,
        refetch,
        error,
    } = useQuery({
        queryKey: ['system-metrics'],
        queryFn: async () => {
            const res = await axios.get('/api/system/metrics');
            return res.data;
        },
        refetchInterval: refreshInterval > 0 ? refreshInterval : false,
        refetchIntervalInBackground: false,
    });

    const handleManualRefresh = async () => {
        try {
            await refetch();
            toast.success('Métricas actualizadas');
        } catch {
            toast.error('Error al actualizar métricas');
        }
    };

    const handleRestartDte = async () => {
        setShowRestartConfirm(false);
        setIsRestartingDte(true);
        const toastId = toast.loading('Reiniciando microservicio DTE...');
        try {
            const res = await axios.post('/api/restart', { restart_key: 'novarestart2026' });
            if (res.data?.success || res.status === 200) {
                toast.success('Microservicio DTE reiniciado correctamente', { id: toastId });
            } else {
                toast.warning('Solicitud enviada al microservicio DTE', { id: toastId });
            }
            setTimeout(() => refetch(), 2000);
        } catch (err) {
            toast.error('Error al reiniciar DTE: ' + (err.response?.data?.message || err.message), { id: toastId });
        } finally {
            setIsRestartingDte(false);
        }
    };

    // Calculate status colors
    const cpuPercent = metrics?.cpu?.percent ?? 0;
    const ramPercent = metrics?.memory?.system?.percent_used ?? 0;
    const diskPercent = metrics?.disk?.percent_used ?? 0;

    const getProgressColor = (percent) => {
        if (percent >= 90) return 'bg-rose-500';
        if (percent >= 75) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getTextColor = (percent) => {
        if (percent >= 90) return 'text-rose-500';
        if (percent >= 75) return 'text-amber-500';
        return 'text-emerald-500';
    };

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400">
                        <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-slate-800 dark:text-white">
                                Monitor del Servidor
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                EN VIVO
                            </span>
                        </div>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400">
                            Rendimiento de hardware, capacidad de almacenamiento y estado de microservicios
                        </p>
                    </div>
                </div>

                {/* Controles de Refresco */}
                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        {REFRESH_INTERVALS.map((item) => (
                            <button
                                key={item.value}
                                onClick={() => setRefreshInterval(item.value)}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                                    refreshInterval === item.value
                                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleManualRefresh}
                        disabled={isFetching}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs disabled:opacity-50"
                        title="Actualizar métricas ahora"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-indigo-500' : ''}`} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* Loading Skeleton */}
            {isLoading && !metrics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4].map((n) => (
                        <div key={n} className="h-36 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4" />
                    ))}
                </div>
            )}

            {/* Error Banner if any */}
            {error && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                        <h4 className="text-sm font-semibold">Error al cargar métricas del servidor</h4>
                        <p className="text-xs opacity-90">{error.message || 'No se pudo conectar con el endpoint de métricas.'}</p>
                    </div>
                </div>
            )}

            {/* Alerta de Capacidad Crítica (Disco > 90%) */}
            {diskPercent >= 90 && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300">
                    <div className="flex items-start sm:items-center gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-md mr-2">
                                Capacidad Crítica
                            </span>
                            <span className="text-[13px] font-medium">
                                El almacenamiento en disco está al <strong>{diskPercent}%</strong> ({metrics?.disk?.free_gb} GB libres de {metrics?.disk?.total_gb} GB). Se recomienda limpiar temporales o ampliar almacenamiento.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid Principal de Tarjetas KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CPU */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                                Uso de Procesador
                            </span>
                            <span className={`text-[12px] font-bold ${getTextColor(cpuPercent)}`}>
                                {cpuPercent}%
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                            {cpuPercent}%
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${getProgressColor(cpuPercent)}`}
                                style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Núcleos: <strong>{metrics?.cpu?.cores || 0}</strong></span>
                        <span className="truncate max-w-[140px]" title={metrics?.cpu?.model}>
                            {metrics?.cpu?.model || 'Desconocido'}
                        </span>
                    </div>
                </div>

                {/* Memoria RAM */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-blue-500" />
                                Memoria RAM
                            </span>
                            <span className={`text-[12px] font-bold ${getTextColor(ramPercent)}`}>
                                {ramPercent}%
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                            {metrics?.memory?.system?.used_gb || 0} <span className="text-sm font-semibold text-slate-400">/ {metrics?.memory?.system?.total_gb || 0} GB</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${getProgressColor(ramPercent)}`}
                                style={{ width: `${Math.min(ramPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Libre: <strong>{metrics?.memory?.system?.free_gb || 0} GB</strong></span>
                        <span>Node Heap: <strong>{metrics?.memory?.node_process?.heap_used_mb || 0} MB</strong></span>
                    </div>
                </div>

                {/* Almacenamiento en Disco */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <HardDrive className="w-3.5 h-3.5 text-purple-500" />
                                Disco del Servidor
                            </span>
                            <span className={`text-[12px] font-bold ${getTextColor(diskPercent)}`}>
                                {diskPercent}%
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                            {metrics?.disk?.used_gb || 0} <span className="text-sm font-semibold text-slate-400">/ {metrics?.disk?.total_gb || 0} GB</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${getProgressColor(diskPercent)}`}
                                style={{ width: `${Math.min(diskPercent, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Espacio libre:</span>
                        <span className={`font-bold ${diskPercent >= 90 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            {metrics?.disk?.free_gb || 0} GB
                        </span>
                    </div>
                </div>

                {/* Base de Datos MySQL */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-emerald-500" />
                                Base de Datos MySQL
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {metrics?.database?.latency_ms ? `${metrics.database.latency_ms} ms` : 'Activa'}
                            </span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                            {metrics?.database?.total_mb || 0} <span className="text-sm font-semibold text-slate-400">MB</span>
                        </div>
                        <div className="text-[12px] text-slate-500 dark:text-slate-400">
                            {metrics?.database?.total_tables || 0} tablas registradas
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Conexiones: <strong>{metrics?.database?.threads_connected || 0}</strong></span>
                        <span>Lentas: <strong>{metrics?.database?.slow_queries || 0}</strong></span>
                    </div>
                </div>
            </div>

            {/* Fila Central: Estado de Microservicios y Ficha de Servidor */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Microservicios y Conectividad */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                Salud de Microservicios y Procesos
                            </h3>
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                            Puertos y Conectividad
                        </span>
                    </div>

                    <div className="space-y-3">
                        {/* Servidor Principal */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-750">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold text-slate-800 dark:text-white">
                                        Servidor Principal (Backend API)
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Puerto 4000 • Uptime proceso: {formatDuration(metrics?.services?.main_server?.uptime_seconds)}
                                    </div>
                                </div>
                            </div>
                            <span className="self-start sm:self-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                OPERATIVO
                            </span>
                        </div>

                        {/* Microservicio DTE */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-750">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                    metrics?.services?.dte_api?.online
                                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                                }`}>
                                    {metrics?.services?.dte_api?.online ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <XCircle className="w-4 h-4" />
                                    )}
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        Microservicio DTE (Facturación Electrónica)
                                        {metrics?.services?.dte_api?.latency_ms && (
                                            <span className="text-[11px] font-normal text-slate-400">
                                                ({metrics.services.dte_api.latency_ms} ms)
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Puerto 5000 • Firma digital y transmisión al Ministerio de Hacienda
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-center">
                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                    metrics?.services?.dte_api?.online
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                                }`}>
                                    {metrics?.services?.dte_api?.online ? 'OPERATIVO' : 'SIN CONEXIÓN'}
                                </span>

                                <button
                                    onClick={() => setShowRestartConfirm(true)}
                                    disabled={isRestartingDte}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors disabled:opacity-50"
                                    title="Reiniciar microservicio DTE en puerto 5000"
                                >
                                    <RotateCw className={`w-3 h-3 ${isRestartingDte ? 'animate-spin' : ''}`} />
                                    <span>Reiniciar</span>
                                </button>
                            </div>
                        </div>

                        {/* Base de Datos */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-750">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                    <Database className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        Motor de Base de Datos (MySQL)
                                        {metrics?.database?.latency_ms && (
                                            <span className="text-[11px] font-normal text-slate-400">
                                                (Ping: {metrics.database.latency_ms} ms)
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {metrics?.database?.total_queries?.toLocaleString() || 0} consultas procesadas • Uptime BD: {formatDuration(metrics?.database?.uptime_seconds)}
                                    </div>
                                </div>
                            </div>
                            <span className="self-start sm:self-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                CONECTADO
                            </span>
                        </div>
                    </div>
                </div>

                {/* Ficha de Sistema y Entorno */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            Ficha del Servidor
                        </h3>
                    </div>

                    <div className="space-y-3 text-[12px]">
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="text-slate-500 dark:text-slate-400">Sistema Operativo:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {metrics?.os?.platform === 'win32' ? 'Windows' : metrics?.os?.platform || 'N/A'} ({metrics?.os?.arch || 'x64'})
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="text-slate-500 dark:text-slate-400">Nombre de Host:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={metrics?.os?.hostname}>
                                {metrics?.os?.hostname || 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="text-slate-500 dark:text-slate-400">Versión de Node.js:</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {metrics?.os?.node_version || 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="text-slate-500 dark:text-slate-400">Tiempo Activo SO:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {formatDuration(metrics?.os?.uptime_seconds)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="text-slate-500 dark:text-slate-400">Memoria Proceso RSS:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {metrics?.memory?.node_process?.rss_mb || 0} MB
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="text-slate-500 dark:text-slate-400">Última lectura:</span>
                            <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleTimeString() : '--:--:--'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Tablas Más Grandes en la Base de Datos */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            Tablas con Mayor Consumo en Base de Datos
                        </h3>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {metrics?.database?.total_mb || 0} MB totales distribuidos en {metrics?.database?.total_tables || 0} tablas
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                <th className="pb-3 font-bold">Tabla</th>
                                <th className="pb-3 font-bold text-right">Filas Estimadas</th>
                                <th className="pb-3 font-bold text-right">Tamaño</th>
                                <th className="pb-3 font-bold text-right pr-2">Proporción de BD</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-750">
                            {metrics?.database?.top_tables?.map((table) => {
                                const totalDbMb = metrics?.database?.total_mb || 1;
                                const tablePercent = Math.min(100, Math.round((table.size_mb / totalDbMb) * 100));
                                return (
                                    <tr key={table.name} className="hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors">
                                        <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <Table className="w-3.5 h-3.5 text-slate-400" />
                                            <code>{table.name}</code>
                                        </td>
                                        <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">
                                            {table.rows.toLocaleString()}
                                        </td>
                                        <td className="py-2.5 text-right font-bold text-slate-800 dark:text-white">
                                            {table.size_mb} MB
                                        </td>
                                        <td className="py-2.5 text-right pr-2">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-20 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                                    <div
                                                        className="h-full bg-indigo-500 rounded-full"
                                                        style={{ width: `${tablePercent}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-9 text-right">
                                                    {tablePercent}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirmación de Reinicio DTE */}
            {showRestartConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 rounded-xl">
                                <RotateCw className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">
                                ¿Reiniciar Microservicio DTE?
                            </h3>
                        </div>

                        <p className="text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                            Se enviará una orden de reinicio al proceso del microservicio DTE en el puerto 5000. Cualquier transmisión de firma electrónica en curso se reiniciará inmediatamente.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowRestartConfirm(false)}
                                className="px-4 py-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleRestartDte}
                                className="px-4 py-2 text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                            >
                                Confirmar Reinicio
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
