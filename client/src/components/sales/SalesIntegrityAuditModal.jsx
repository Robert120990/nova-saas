import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import { AuditSummaryCards, AuditFindingsSection } from './audit';
import { formatTime } from '../../utils/dateUtils';
import { 
    ShieldCheck, RefreshCw, FileDown, Clock
} from 'lucide-react';

const SalesIntegrityAuditModal = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [autoInterval, setAutoInterval] = useState(0); // 0 = manual
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    // Query para auditoría forense
    const { 
        data: auditResponse, 
        isLoading, 
        isFetching, 
        refetch, 
        dataUpdatedAt 
    } = useQuery({
        queryKey: ['sales-integrity-audit'],
        queryFn: async () => {
            const res = await axios.get('/api/sales/audit-integrity');
            return res.data?.data || null;
        },
        enabled: isOpen,
        refetchInterval: autoInterval > 0 ? autoInterval : false,
        staleTime: 10000
    });

    const auditData = auditResponse || {};
    const resumen = auditData.resumen || {};

    // Sincronizar sellos de recepción en dtes con sales_headers
    const handleSyncStamps = async () => {
        try {
            setIsSyncing(true);
            const res = await axios.post('/api/sales/audit-integrity/sync-stamps');
            toast.success(res.data?.message || 'Sellos sincronizados con éxito.');
            await refetch();
            queryClient.invalidateQueries(['sales']);
        } catch (error) {
            console.error('Error al sincronizar sellos:', error);
            toast.error(error.response?.data?.message || 'Error al sincronizar sellos de recepción.');
        } finally {
            setIsSyncing(false);
        }
    };

    // Descarga de Dictamen PDF Oficial
    const handleDownloadPdf = async () => {
        try {
            setIsDownloadingPdf(true);
            const response = await axios.get('/api/sales/audit-integrity/pdf', {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Dictamen_Auditoria_Ventas_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Dictamen técnico descargado correctamente.');
        } catch (error) {
            console.error('Error al descargar PDF de auditoría:', error);
            toast.error('Error al generar y descargar el dictamen PDF.');
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Auditoría Forense de Integridad y Duplicidad de Ventas"
            maxWidth="max-w-6xl"
        >
            <div className="space-y-5">
                {/* Header Action Bar con botones manual, periódico y PDF */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-200/70 flex items-center justify-center shrink-0">
                            <ShieldCheck size={22} className="text-indigo-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-900">
                                    Diagnóstico Tributario y Cruce de Pedidos
                                </h3>
                                {dataUpdatedAt > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                        <Clock size={11} className="text-slate-400" />
                                        Comprobado: {formatTime(new Date(dataUpdatedAt))}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Valida sellos ante Hacienda, detecta ventas fantasma y cruza pedidos automáticos vs POS
                            </p>
                        </div>
                    </div>

                    {/* Controles de Ejecución */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Selector de Monitoreo Periódico */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Periódico:</span>
                            <select
                                value={autoInterval}
                                onChange={(e) => setAutoInterval(Number(e.target.value))}
                                className="font-semibold text-slate-700 bg-transparent outline-none cursor-pointer text-xs"
                            >
                                <option value={0}>Manual</option>
                                <option value={30000}>Cada 30s</option>
                                <option value={60000}>Cada 1 min</option>
                                <option value={120000}>Cada 2 min</option>
                                <option value={300000}>Cada 5 min</option>
                            </select>
                            {autoInterval > 0 && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Monitoreo periódico activo" />
                            )}
                        </div>

                        {/* Botón Analizar Ahora (Manual) */}
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            title="Ejecutar análisis manual inmediatamente"
                        >
                            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
                            <span>{isFetching ? 'Analizando...' : 'Analizar Ahora'}</span>
                        </button>

                        {/* Botón Descargar Dictamen PDF */}
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={isDownloadingPdf || isLoading}
                            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 active:scale-95 text-rose-700 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                            title="Descargar dictamen técnico en formato PDF oficial"
                        >
                            <FileDown size={14} className={isDownloadingPdf ? "animate-bounce text-rose-600" : "text-rose-600"} />
                            <span>{isDownloadingPdf ? 'Generando PDF...' : 'Dictamen PDF'}</span>
                        </button>
                    </div>
                </div>

                {/* Estado de Carga Inicial */}
                {isLoading ? (
                    <div className="py-16 text-center space-y-3">
                        <RefreshCw size={36} className="mx-auto text-indigo-600 animate-spin" />
                        <p className="text-sm font-bold text-slate-700">Analizando integridad tributaria de ventas...</p>
                        <p className="text-xs text-slate-400">Cruzando registros de sales_headers, dtes y pedidos automáticos</p>
                    </div>
                ) : (
                    <>
                        {/* Tarjetas Resumen */}
                        <AuditSummaryCards resumen={resumen} />

                        {/* Secciones y Detalle de Hallazgos */}
                        <AuditFindingsSection 
                            auditData={auditData} 
                            onSyncStamps={handleSyncStamps}
                            isSyncing={isSyncing}
                        />
                    </>
                )}
            </div>
        </Modal>
    );
};

export default SalesIntegrityAuditModal;
