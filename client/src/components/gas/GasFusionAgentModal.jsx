import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    X, CheckCircle2, AlertCircle, Copy, Check, 
    Terminal, RefreshCw, Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../utils/dateUtils';
import GasFusionAgentFiles from './GasFusionAgentFiles';

const GasFusionAgentModal = ({ isOpen, onClose, branch }) => {
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedCmd, setCopiedCmd] = useState(false);
    const [copiedPsUpdate, setCopiedPsUpdate] = useState(false);
    const [syncingAgent, setSyncingAgent] = useState(false);

    const branchId = branch?.branch_id;

    const {
        data: agentStatus,
        isLoading,
        refetch,
        isFetching
    } = useQuery({
        queryKey: ['gas-fusion-agent-status-modal', branchId],
        queryFn: async () => {
            if (!branchId) return null;
            const res = await axios.get('/api/gas-station/fusion/agent-status', {
                params: { branch_id: branchId }
            });
            return res.data;
        },
        enabled: isOpen && Boolean(branchId),
        refetchInterval: isOpen ? 4000 : false
    });

    if (!isOpen) return null;

    const isConnected = Boolean(agentStatus?.connected);
    const agentKey = agentStatus?.agentKey || '';
    const serverUrl = agentStatus?.serverUrl || window.location.origin;
    const companyId = agentStatus?.companyId || 1;
    const fusionHost = agentStatus?.fusionHost || 'https://10.19.4.15';

    const runCommand = `node fusion-agent.js --server ${serverUrl} --company ${companyId} --branch ${branchId} --key ${agentKey}`;

    const psUpdateCommand = `$cfg = @{ serverUrl="${serverUrl}"; companyId=${companyId}; branchId=${branchId}; agentKey="${agentKey}"; fusionHost="${fusionHost}"; fusionUser="manager"; fusionPassword="MANAGER" } | ConvertTo-Json; Set-Content -Path "C:\\fusion-agent\\config.json" -Value $cfg -Encoding UTF8; Write-Host "config.json actualizado a Empresa #${companyId} / Estacion #${branchId}" -ForegroundColor Green`;

    const handleCopyKey = () => {
        navigator.clipboard.writeText(agentKey);
        setCopiedKey(true);
        toast.success('Clave copiada al portapapeles');
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleCopyCmd = () => {
        navigator.clipboard.writeText(runCommand);
        setCopiedCmd(true);
        toast.success('Comando copiado al portapapeles');
        setTimeout(() => setCopiedCmd(false), 2000);
    };

    const handleCopyPsUpdate = () => {
        navigator.clipboard.writeText(psUpdateCommand);
        setCopiedPsUpdate(true);
        toast.success('Comando PowerShell de actualización local copiado');
        setTimeout(() => setCopiedPsUpdate(false), 2000);
    };

    const handleSyncAgent = async () => {
        setSyncingAgent(true);
        try {
            const res = await axios.post('/api/gas-station/fusion/agent-sync', { branch_id: branchId });
            toast.success(res.data?.message || 'Conector sincronizado correctamente');
            refetch();
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo sincronizar el conector');
        } finally {
            setSyncingAgent(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl my-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Cabecera */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs ${
                            isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                            <Radio size={18} className={isConnected ? 'animate-pulse' : ''} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                Conector de Estación Fusion FFC
                                <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                                    {branch?.codigo || `ID #${branchId}`}
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Puente seguro para consultar IP local (10.19.4.15) desde la nube
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
                            title="Comprobar estado"
                        >
                            <RefreshCw size={15} className={isFetching ? 'animate-spin text-indigo-600' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Tarjeta de Estado en Vivo */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        isConnected 
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                            : 'bg-amber-50/70 border-amber-200 text-amber-950'
                    }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex items-start gap-3 flex-1 min-w-[220px]">
                                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                    isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                }`}>
                                    {isConnected ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                </div>
                                <div className="space-y-0.5">
                                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                        Estado: {isConnected ? 'Conector En Línea (Activo)' : 'Conector Desconectado'}
                                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                                            isConnected ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                                        }`} />
                                    </h4>
                                    <p className="text-[11px] leading-relaxed opacity-90">
                                        {isConnected 
                                            ? `Conectado desde ${agentStatus?.remoteAddress || 'la estación'} (${formatDateTime(agentStatus?.connectedAt)}). Las consultas desde el SaaS se procesan en tiempo real.` 
                                            : 'Para importar turnos desde la nube (sys.sipesv.com) sin abrir puertos en el router, inicie el conector en cualquier PC de la estación conectada a la red de Fusion.'}
                                    </p>
                                </div>
                            </div>
                            {isConnected && (
                                <button
                                    type="button"
                                    onClick={handleSyncAgent}
                                    disabled={syncingAgent}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                                    title="Actualizar config.json y fusion-agent.js remotamente en la PC de la estación"
                                >
                                    <RefreshCw size={12} className={syncingAgent ? 'animate-spin' : ''} />
                                    <span>{syncingAgent ? 'Actualizando...' : 'Actualizar Conector'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Descarga de Archivos */}
                    <GasFusionAgentFiles branchId={branchId} agentStatus={agentStatus} />

                    {/* Guía Rápida */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Terminal size={14} className="text-indigo-600" />
                                Instrucciones de Instalación / Actualización Local (3 Pasos)
                            </h5>
                            {agentKey && (
                                <button
                                    type="button"
                                    onClick={handleCopyPsUpdate}
                                    className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Copia un comando PowerShell que actualiza C:\fusion-agent\config.json automáticamente"
                                >
                                    {copiedPsUpdate ? <Check size={11} className="text-emerald-600" /> : <Terminal size={11} />}
                                    <span>{copiedPsUpdate ? 'Comando copiado' : 'Copiar comando PowerShell (Actualizar C:\\fusion-agent)'}</span>
                                </button>
                            )}
                        </div>
                        <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
                            <li>
                                Guarde los 3 archivos descargados en una misma carpeta (ej: <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-mono text-[11px]">C:\fusion-agent</code>) en la computadora de la estación (si ya estaba instalado, basta con reemplazar <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-mono text-[11px]">config.json</code>).
                            </li>
                            <li>
                                Verifique que la computadora tenga instalado <strong>Node.js</strong> (descarga gratuita en <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium">nodejs.org</a>).
                            </li>
                            <li>
                                Haga doble clic sobre <strong>iniciar-agente.bat</strong>. Esta ventana cambiará automáticamente a <strong className="text-emerald-700">En Línea</strong>.
                            </li>
                        </ol>
                    </div>

                    {/* Clave de Seguridad & Comando Manual */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                Clave del Conector (Agent Key)
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyCmd}
                                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1"
                                    title="Copiar comando completo para terminal"
                                >
                                    {copiedCmd ? <Check size={12} className="text-emerald-600" /> : <Terminal size={12} />}
                                    {copiedCmd ? 'Copiado' : 'Copiar comando'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCopyKey}
                                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    {copiedKey ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                    {copiedKey ? 'Copiada' : 'Copiar clave'}
                                </button>
                            </div>
                        </div>
                        <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-400 select-all break-all flex items-center justify-between">
                            <span>{agentKey || (isLoading ? 'Cargando clave...' : 'Sin clave')}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GasFusionAgentModal;
