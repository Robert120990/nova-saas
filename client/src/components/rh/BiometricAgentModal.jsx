import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Radio, X, Copy, Check, RefreshCw, Download, FileCode,
    Terminal, HelpCircle, Square, AlertTriangle, ShieldAlert,
    Trash2, Cpu, HardDrive, Loader2
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';
import BiometricAgentUpdateSection from './BiometricAgentUpdateSection';

const BiometricAgentModal = ({ open, onClose, device = null, onDeviceUpdated }) => {
    const queryClient = useQueryClient();
    const [copiedKey, setCopiedKey] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState('');

    const regenMutation = useMutation({
        mutationFn: async (deviceId) => {
            const res = await axios.post(`/api/rh/biometric/devices/${deviceId}/regenerate-key`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Clave de agente regenerada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onDeviceUpdated) onDeviceUpdated();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al regenerar clave');
        }
    });

    const cleanupCmosMutation = useMutation({
        mutationFn: async () => (await axios.post('/api/rh/biometric/cleanup-invalid-dates')).data,
        onSuccess: (data) => {
            toast.success(data?.message || 'Registros CMOS corruptos eliminados.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onDeviceUpdated) onDeviceUpdated();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al limpiar fechas CMOS')
    });

    if (!open) return null;

    const isOnline = !!device?.is_online;
    const isSyncStale = !!device?.is_sync_stale;
    const memoryPct = Number(device?.memory_pct || 0);
    const invalidCmos = Number(device?.invalid_date_punches || 0);
    const agentKey = device?.agent_key || 'No generada';

    const handleCopyKey = () => {
        navigator.clipboard.writeText(agentKey);
        setCopiedKey(true);
        toast.info('Clave de agente copiada al portapapeles');
        setTimeout(() => setCopiedKey(false), 2500);
    };

    const handleDownload = async (url, filename) => {
        try {
            setDownloadingFile(filename);
            const res = await axios.get(url, { responseType: 'blob' });
            const blobUrl = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            toast.error(err.response?.data?.message || `No se pudo descargar ${filename}`);
        } finally {
            setDownloadingFile('');
        }
    };

    const handleDownloadAll = async () => {
        if (!device?.id) return toast.error('Primero configure y guarde el reloj.');
        const files = [
            [`/api/rh/biometric/devices/${device.id}/download-config`, 'config.json'],
            ['/api/rh/biometric/agent/download-bat', 'iniciar-conector.bat'],
            ['/api/rh/biometric/agent/download-stop-bat', 'detener-conector.bat'],
            ['/api/rh/biometric/agent/download-service-bat', 'instalar-servicio-windows.bat'],
            ['/api/rh/biometric/agent/download-script', 'biometric-agent.js']
        ];
        toast.info('Descargando los 5 archivos del conector...');
        for (const [url, name] of files) {
            await handleDownload(url, name);
        }
        toast.success('Archivos del conector descargados.');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            isOnline && !isSyncStale
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : isSyncStale
                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                            <Radio className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-bold text-slate-800">Conector Local SIPE (LAN Agent)</h2>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                    isOnline && !isSyncStale
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : isSyncStale
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-slate-100 text-slate-600'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${isOnline && !isSyncStale ? 'bg-emerald-500 animate-ping' : isSyncStale ? 'bg-amber-500' : 'bg-slate-400'}`} />
                                    {isOnline ? (isSyncStale ? 'En Línea (Sin Sincronizar)' : 'En Línea') : 'Desconectado'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Puente de sincronización ZKTeco ({device?.ip_address || '192.168.3.201'}) · v{device?.agent_version || '—'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
                    {isSyncStale && (
                        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Alerta: El conector responde pero lleva más de 24h sin subir marcaciones</p>
                                <p className="text-amber-800 mt-0.5">
                                    Descargue la última versión de <code className="font-mono font-bold">biometric-agent.js</code> (v{device?.latest_agent_version}) y reemplácela en la PC conectada al reloj.
                                </p>
                            </div>
                        </div>
                    )}

                    {device?.last_sync_error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">Último error reportado por el conector:</p>
                                <p className="font-mono text-[11px] text-rose-700 mt-0.5 break-all">{device.last_sync_error}</p>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">IP / Puerto</span>
                                <span className="font-mono font-bold text-indigo-700">{device?.ip_address || '192.168.3.201'}:{device?.port || 4370}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Último Heartbeat</span>
                                <span className="font-medium text-slate-700">{formatDateTime(device?.last_seen, 'Sin registros')}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Última Sincronización</span>
                                <span className={`font-bold ${isSyncStale ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    {formatDateTime(device?.last_sync, 'Sin sincronizar')}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Última Marcación</span>
                                <span className="font-mono font-semibold text-slate-700">
                                    {formatDateTime(device?.last_valid_punch_time, 'Sin marcas')}
                                </span>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-slate-600 flex items-center gap-1">
                                        <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                                        Memoria del Reloj ({Number(device?.log_counts || 0).toLocaleString()} / {Number(device?.log_capacity || 100000).toLocaleString()})
                                    </span>
                                    <span className={`font-bold ${memoryPct >= 80 ? 'text-rose-600' : 'text-slate-700'}`}>{memoryPct}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${memoryPct >= 80 ? 'bg-rose-500' : memoryPct >= 60 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${Math.min(100, memoryPct)}%` }}
                                    />
                                </div>
                            </div>
                            {invalidCmos > 0 && (
                                <button
                                    type="button"
                                    onClick={() => cleanupCmosMutation.mutate()}
                                    disabled={cleanupCmosMutation.isPending}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shrink-0"
                                    title="Eliminar registros históricos con fechas corruptas (ej. año 2000 o 2118)"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Limpiar {invalidCmos} CMOS
                                </button>
                            )}
                        </div>
                    </div>

                    <BiometricAgentUpdateSection
                        device={device}
                        onDeviceUpdated={onDeviceUpdated}
                        isDownloading={downloadingFile === 'actualizar-conector.bat'}
                        onDownloadUpdater={() => handleDownload(`/api/rh/biometric/devices/${device?.id}/download-updater-bat`, 'actualizar-conector.bat')}
                    />

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Clave Secreta (Agent Key)</label>
                            {device?.id && (
                                <button
                                    type="button"
                                    onClick={() => regenMutation.mutate(device.id)}
                                    disabled={regenMutation.isPending}
                                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    <RefreshCw className={`w-3 h-3 ${regenMutation.isPending ? 'animate-spin' : ''}`} />
                                    Regenerar Clave
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="text" readOnly value={agentKey} className="w-full text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-xl px-3.5 py-2 outline-none select-all" />
                            <button type="button" onClick={handleCopyKey} className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shrink-0">
                                {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                {copiedKey ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Archivos del Conector v{device?.latest_agent_version || '2.1.0'}</h3>
                            <button type="button" onClick={handleDownloadAll} disabled={!!downloadingFile} className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 disabled:opacity-50">
                                {downloadingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                Descargar los 5 archivos
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {[
                                { url: `/api/rh/biometric/devices/${device?.id}/download-config`, file: 'config.json', desc: 'IP, Puerto y Clave listos', icon: FileCode, color: 'text-indigo-600' },
                                { url: '/api/rh/biometric/agent/download-script', file: 'biometric-agent.js', desc: 'Motor v2.1 con auto-update', icon: Download, color: 'text-amber-600' },
                                { url: '/api/rh/biometric/agent/download-bat', file: 'iniciar-conector.bat', desc: 'Inicio manual en consola', icon: Terminal, color: 'text-emerald-600' },
                                { url: '/api/rh/biometric/agent/download-service-bat', file: 'instalar-servicio-windows.bat', desc: 'Arranque automático oculto', icon: Cpu, color: 'text-sky-600' },
                                { url: '/api/rh/biometric/agent/download-stop-bat', file: 'detener-conector.bat', desc: 'Detiene y libera red', icon: Square, color: 'text-rose-600' }
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.file}
                                        type="button"
                                        disabled={!!downloadingFile}
                                        onClick={() => handleDownload(item.url, item.file)}
                                        className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl transition-all text-left disabled:opacity-50"
                                    >
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <Icon className={`w-4 h-4 ${item.color} shrink-0`} />
                                            <span className="text-xs font-bold text-slate-800 truncate">{item.file}</span>
                                        </div>
                                        <span className="text-[11px] text-slate-400">{item.desc}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                            <HelpCircle className="w-4 h-4 text-indigo-600" />
                            Recomendación de Instalación en Planta
                        </h4>
                        <p className="text-xs text-slate-600">
                            Coloque los archivos en una carpeta fija (ej. <code className="font-mono bg-white px-1 rounded border">C:\SIPE-Biometrico</code>) y ejecute <strong className="text-sky-700">instalar-servicio-windows.bat</strong> para que arranque solo al encender la PC en segundo plano y se auto-actualice automáticamente.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BiometricAgentModal;
