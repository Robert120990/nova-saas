import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { AuditSummaryCards, AuditFindingsSection } from './audit';
import { formatTime } from '../../utils/dateUtils';
import { 
    ShieldCheck, RefreshCw, FileDown, Clock, AlertTriangle
} from 'lucide-react';

const SalesIntegrityAuditModal = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    // Query para auditoría forense vinculada reactivamente a la empresa activa
    const { 
        data: auditResponse, 
        isLoading, 
        isFetching, 
        isError,
        error,
        refetch, 
        dataUpdatedAt 
    } = useQuery({
        queryKey: ['sales-integrity-audit', user?.company_id],
        queryFn: async () => {
            const res = await axios.get('/api/sales/audit-integrity');
            return res.data?.data || null;
        },
        enabled: isOpen && !!user?.company_id,
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
        } catch (err) {
            console.error('Error al sincronizar sellos:', err);
            toast.error(err.response?.data?.message || 'Error al sincronizar sellos de recepción.');
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
            link.setAttribute('download', `Dictamen_Auditoria_Ventas_${user?.company_id || 'empresa'}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Dictamen técnico descargado correctamente.');
        } catch (err) {
            console.error('Error al descargar PDF de auditoría:', err);
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
                {/* Header Action Bar con botones manual y PDF */}
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

                    {/* Controles de Ejecución Manual */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Botón Analizar Ahora (Manual) */}
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            title="Ejecutar análisis manual inmediatamente"
                        >
                            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
                            <span>{isFetching ? 'Analizando...' : 'Analizar Ahora'}</span>
                        </button>

                        {/* Botón Descargar Dictamen PDF */}
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={isDownloadingPdf || isLoading || isError}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 active:scale-95 text-rose-700 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                            title="Descargar dictamen técnico en formato PDF oficial"
                        >
                            <FileDown size={14} className={isDownloadingPdf ? "animate-bounce text-rose-600" : "text-rose-600"} />
                            <span>{isDownloadingPdf ? 'Generando PDF...' : 'Dictamen PDF'}</span>
                        </button>
                    </div>
                </div>

                {/* Estado de Error */}
                {isError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                            <div>
                                <p className="font-bold">Error al ejecutar la auditoría de ventas</p>
                                <p className="text-rose-600">{error?.response?.data?.message || error?.message || 'Error de conexión con el servidor.'}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all shrink-0 cursor-pointer"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Estado de Carga Inicial */}
                {isLoading ? (
                    <div className="py-16 text-center space-y-3">
                        <RefreshCw size={36} className="mx-auto text-indigo-600 animate-spin" />
                        <p className="text-sm font-bold text-slate-700">Analizando integridad tributaria de ventas...</p>
                        <p className="text-xs text-slate-400">Cruzando registros de sales_headers, dtes y pedidos automáticos</p>
                    </div>
                ) : !isError && (
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
