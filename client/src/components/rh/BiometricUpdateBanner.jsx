import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { DownloadCloud, RefreshCw, Sparkles, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

const BiometricUpdateBanner = ({ device, onOpenAgentModal, onDeviceUpdated }) => {
    const queryClient = useQueryClient();
    const [dismissed, setDismissed] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const requestUpdateMutation = useMutation({
        mutationFn: async (deviceId) => (await axios.post(`/api/rh/biometric/devices/${deviceId}/request-update`)).data,
        onSuccess: (res) => {
            toast.success(res?.message || 'Actualización solicitada.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onDeviceUpdated) onDeviceUpdated();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al solicitar actualización')
    });

    if (!device || dismissed) return null;

    const isOutdated = !!device.is_outdated_agent;
    const isPending = device.update_status === 'pending' || device.update_status === 'updating';
    const isFailed = device.update_status === 'failed';
    const compatible = device.compatibility?.compatible !== false;

    if (!isOutdated && !isPending && !isFailed) return null;

    const handleDownloadUpdater = async () => {
        try {
            setDownloading(true);
            const res = await axios.get(`/api/rh/biometric/devices/${device.id}/download-updater-bat`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'actualizar-conector.bat');
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Actualizador 1-Clic descargado. Ejecútelo en la PC conectada al reloj.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo descargar el actualizador');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
            isFailed
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : isPending
                    ? 'bg-sky-50 border-sky-200 text-sky-900'
                    : 'bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border-indigo-200 text-slate-800'
        }`}>
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isFailed ? 'bg-rose-100 text-rose-600 border-rose-200'
                        : isPending ? 'bg-sky-100 text-sky-600 border-sky-200'
                            : 'bg-indigo-600 text-white border-indigo-600'
                }`}>
                    {isFailed ? <AlertTriangle className="w-4 h-4" />
                        : isPending ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Sparkles className="w-4 h-4" />}
                </div>
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900">
                            {isPending
                                ? `Actualización del Conector a v${device.latest_agent_version} en curso...`
                                : isFailed
                                    ? 'Error al actualizar automáticamente el conector biométrico'
                                    : `Nuevo conector compatible disponible: v${device.latest_agent_version}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                            Instalado: v{device.agent_version}
                        </span>
                        {compatible && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Compatible con {device.protocol?.toUpperCase() || 'TCP'} {device.port || 4370}
                            </span>
                        )}
                    </div>
                    <p className="text-[11.5px] text-slate-600">
                        {isFailed
                            ? (device.update_error || 'Use el Actualizador 1-Clic (.bat) en la PC conectada al reloj.')
                            : device.supports_remote_update
                                ? 'Puede aplicar la actualización automáticamente de forma remota o descargar el actualizador 1-clic.'
                                : 'La PC aún ejecuta una versión 1.x sin auto-actualización. Descargue y ejecute el Actualizador 1-Clic (.bat) una sola vez para activar futuras actualizaciones automáticas.'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
                {device.supports_remote_update && compatible && (
                    <button
                        type="button"
                        disabled={requestUpdateMutation.isPending || isPending}
                        onClick={() => requestUpdateMutation.mutate(device.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs disabled:opacity-50"
                    >
                        {requestUpdateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>{isPending ? 'Esperando Conector...' : 'Actualizar Automáticamente'}</span>
                    </button>
                )}
                <button
                    type="button"
                    disabled={downloading}
                    onClick={handleDownloadUpdater}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl disabled:opacity-50"
                >
                    {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                    <span>Actualizador 1-Clic (.bat)</span>
                </button>
                <button
                    type="button"
                    onClick={onOpenAgentModal}
                    className="px-2.5 py-1.5 font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl"
                >
                    Detalles
                </button>
                <button type="button" onClick={() => setDismissed(true)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg" title="Ocultar aviso">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default BiometricUpdateBanner;
