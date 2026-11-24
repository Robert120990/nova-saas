import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Sparkles, RefreshCw, DownloadCloud, CheckCircle2, AlertTriangle,
    ShieldCheck, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

const BiometricAgentUpdateSection = ({ device, onDeviceUpdated, onDownloadUpdater, isDownloading }) => {
    const queryClient = useQueryClient();
    const [showChangelog, setShowChangelog] = useState(false);

    const policyMutation = useMutation({
        mutationFn: async (policy) => (await axios.post(`/api/rh/biometric/devices/${device.id}/update-policy`, { update_policy: policy })).data,
        onSuccess: (res) => {
            toast.success(res?.message || 'Política de actualización guardada.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onDeviceUpdated) onDeviceUpdated();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar política')
    });

    const requestUpdateMutation = useMutation({
        mutationFn: async () => (await axios.post(`/api/rh/biometric/devices/${device.id}/request-update`)).data,
        onSuccess: (res) => {
            toast.success(res?.message || 'Actualización solicitada.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onDeviceUpdated) onDeviceUpdated();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al solicitar actualización')
    });

    if (!device?.id) return null;

    const compat = device.compatibility || {};
    const isOutdated = !!device.is_outdated_agent;
    const isPending = device.update_status === 'pending' || device.update_status === 'updating';
    const currentPolicy = device.update_policy === 'prompt' ? 'prompt' : 'auto';
    const changelog = Array.isArray(compat.changelog) ? compat.changelog : [];

    return (
        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-200/80 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-bold text-indigo-950">Actualizaciones y Compatibilidad del Conector</span>
                    {compat.compatible !== false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" />
                            Compatible ({device.protocol?.toUpperCase() || 'TCP'} {device.port || 4370})
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            Incompatibilidad detectada
                        </span>
                    )}
                </div>
                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border self-start sm:self-auto ${
                    isOutdated ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                    Instalado: v{device.agent_version} · Último: v{device.latest_agent_version}
                </span>
            </div>

            {compat.reasons?.length > 0 && (
                <p className="text-[11px] text-rose-700 font-semibold">{compat.reasons.join(' ')}</p>
            )}

            {/* Selector de Política: Automática vs Solicitar Confirmación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={policyMutation.isPending}
                    onClick={() => policyMutation.mutate('auto')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                        currentPolicy === 'auto'
                            ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/15'
                            : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Actualización Automática</span>
                        {currentPolicy === 'auto' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5">
                        El conector descarga y reinicia solo cuando hay versión más reciente compatible.
                    </span>
                </button>
                <button
                    type="button"
                    disabled={policyMutation.isPending}
                    onClick={() => policyMutation.mutate('prompt')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                        currentPolicy === 'prompt'
                            ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/15'
                            : 'bg-white/60 border-slate-200 hover:bg-white'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Solicitar Confirmación</span>
                        {currentPolicy === 'prompt' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <span className="text-[10.5px] text-slate-500 block mt-0.5">
                        Muestra alerta en SIPE WEB y espera su clic antes de actualizar el conector.
                    </span>
                </button>
            </div>

            {/* Acciones directas de actualización */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        disabled={requestUpdateMutation.isPending || isPending || compat.compatible === false}
                        onClick={() => requestUpdateMutation.mutate()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                        title={device.supports_remote_update ? 'Envía orden remota al conector en el próximo heartbeat' : 'Requiere actualizar primero con el Actualizador 1-Clic (.bat)'}
                    >
                        {requestUpdateMutation.isPending || isPending
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>
                            {isPending ? 'Actualización en cola (~30s)...' : 'Actualizar Remotamente'}
                        </span>
                    </button>
                    <button
                        type="button"
                        disabled={isDownloading}
                        onClick={onDownloadUpdater}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl disabled:opacity-50"
                    >
                        {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                        <span>Descargar Actualizador 1-Clic (.bat)</span>
                    </button>
                </div>

                {changelog.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowChangelog(v => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                        <span>Novedades v{device.latest_agent_version}</span>
                        {showChangelog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                )}
            </div>

            {device.update_error && (
                <p className="text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                    Error de actualización: {device.update_error}
                </p>
            )}

            {showChangelog && changelog.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-slate-600 bg-white rounded-xl p-3 border border-indigo-100 space-y-1">
                    {changelog.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
            )}
        </div>
    );
};

export default BiometricAgentUpdateSection;
