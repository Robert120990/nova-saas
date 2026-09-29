import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Radio, X, Copy, Check, RefreshCw, Download, FileCode,
    Terminal, HelpCircle
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

const BiometricAgentModal = ({ open, onClose, device = null, onDeviceUpdated }) => {
    const queryClient = useQueryClient();
    const [copiedKey, setCopiedKey] = useState(false);

    const regenMutation = useMutation({
        mutationFn: async (deviceId) => {
            const res = await axios.post(`/api/rh/biometric/devices/${deviceId}/regenerate-agent-key`);
            return res.data;
        },
        onSuccess: (_data) => {
            toast.success('Clave de agente regenerada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onDeviceUpdated) onDeviceUpdated();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al regenerar clave');
        }
    });

    if (!open) return null;

    const isOnline = !!device?.is_online;
    const agentKey = device?.agent_key || 'No generada';

    const handleCopyKey = () => {
        navigator.clipboard.writeText(agentKey);
        setCopiedKey(true);
        toast.info('Clave de agente copiada al portapapeles');
        setTimeout(() => setCopiedKey(false), 2500);
    };

    const handleDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAll = () => {
        handleDownload(`/api/rh/biometric/devices/${device?.id}/download-config`, 'config.json');
        setTimeout(() => handleDownload('/api/rh/biometric/agent/download-bat', 'iniciar-conector.bat'), 500);
        setTimeout(() => handleDownload('/api/rh/biometric/agent/download-script', 'biometric-agent.js'), 1000);
        toast.success('Descargando los 3 archivos del conector...');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                            isOnline 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                            <Radio className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-800">
                                    Conector Local SIPE (LAN Agent)
                                </h2>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                    isOnline 
                                        ? 'bg-emerald-100 text-emerald-700' 
                                        : 'bg-slate-100 text-slate-600'
                                }`}>
                                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                                    {isOnline ? 'En Línea' : 'Desconectado'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Puente de sincronización entre el reloj ZKTeco ({device?.ip_address || '192.168.3.201'}) y la nube
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Status card */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase block">Dispositivo</span>
                                <span className="font-semibold text-slate-800">{device?.nombre || 'Marcador Digital'}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase block">IP / Puerto LAN</span>
                                <span className="font-mono font-bold text-indigo-700">{device?.ip_address || '192.168.3.201'}:{device?.port || 4370}</span>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase block">Último Heartbeat</span>
                                <span className="font-medium text-slate-600">{formatDateTime(device?.last_seen, 'Sin registros')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Agent Key Box */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Clave Secreta de Conexión (Agent Key)
                            </label>
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
                            <input
                                type="text"
                                readOnly
                                value={agentKey}
                                className="w-full text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none select-all"
                            />
                            <button
                                type="button"
                                onClick={handleCopyKey}
                                className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                                {copiedKey ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Esta clave autoriza al conector local a sincronizar marcaciones sin exponer credenciales de usuario.
                        </p>
                    </div>

                    {/* One-Click Downloads */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Archivos del Conector (Descarga Rápida)
                            </h3>
                            <button
                                type="button"
                                onClick={handleDownloadAll}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Descargar los 3 archivos
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => handleDownload(`/api/rh/biometric/devices/${device?.id}/download-config`, 'config.json')}
                                className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-xl transition-all group text-left"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <FileCode className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">config.json</span>
                                </div>
                                <span className="text-[11px] text-slate-400">Pre-configurado con IP y Clave</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDownload('/api/rh/biometric/agent/download-bat', 'iniciar-conector.bat')}
                                className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-xl transition-all group text-left"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Terminal className="w-4 h-4 text-emerald-600" />
                                    <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">iniciar-conector.bat</span>
                                </div>
                                <span className="text-[11px] text-slate-400">Lanzador 1-clic para Windows</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDownload('/api/rh/biometric/agent/download-script', 'biometric-agent.js')}
                                className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 rounded-xl transition-all group text-left"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Download className="w-4 h-4 text-amber-600" />
                                    <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">biometric-agent.js</span>
                                </div>
                                <span className="text-[11px] text-slate-400">Código fuente del agente Node</span>
                            </button>
                        </div>
                    </div>

                    {/* Step-by-Step LAN Setup Guide */}
                    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2.5">
                            <HelpCircle className="w-4 h-4 text-indigo-600" />
                            Guía de Puesta en Marcha (Red Local)
                        </h4>
                        <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside font-normal">
                            <li>
                                <strong>Ubicación:</strong> Coloque los 3 archivos descargados (o la carpeta <code className="bg-white px-1.5 py-0.5 rounded border text-[11px] font-mono text-indigo-700">scripts/biometric-agent</code>) en cualquier PC de la empresa que esté conectada a la misma red LAN que el reloj checador.
                            </li>
                            <li>
                                <strong>Requisito:</strong> Verifique que la PC tenga instalado <code className="bg-white px-1.5 py-0.5 rounded border text-[11px] font-mono">Node.js</code> (v18 o superior).
                            </li>
                            <li>
                                <strong>Ejecución:</strong> Haga doble clic sobre <code className="bg-white px-1.5 py-0.5 rounded border text-[11px] font-mono text-emerald-700">iniciar-conector.bat</code>. El script verificará las dependencias e iniciará la sincronización en tiempo real inmediatamente.
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-[13px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BiometricAgentModal;
