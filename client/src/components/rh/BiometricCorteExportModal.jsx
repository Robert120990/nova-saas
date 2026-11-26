import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    X, Printer, FileSpreadsheet, Users, User, Loader2, FileCheck2
} from 'lucide-react';
import PdfViewerModal from '../ui/PdfViewerModal';
import { formatDate } from '../../utils/dateUtils';

const BiometricCorteExportModal = ({
    open,
    onClose,
    corte,
    employees = [],
    defaultEmployeeKey = 'all',
    defaultOnlyOvertime = false
}) => {
    const [scope, setScope] = useState('global');
    const [employeeKey, setEmployeeKey] = useState('all');
    const [onlyOvertime, setOnlyOvertime] = useState(false);
    const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

    // Visor PDF integrado
    const [isPdfOpen, setIsPdfOpen] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [pdfError, setPdfError] = useState(null);

    const hasPreloadedEmployees = Array.isArray(employees) && employees.length > 0;

    const { data: fetchedCorteData } = useQuery({
        queryKey: ['rh-biometric-corte-export-employees', corte?.id],
        queryFn: async () => (await axios.get('/api/rh/biometric/cortes/daily-overtime', { params: { corteId: corte.id } })).data || {},
        enabled: Boolean(open && corte?.id && !hasPreloadedEmployees)
    });

    const resolvedEmployees = hasPreloadedEmployees
        ? employees
        : (Array.isArray(fetchedCorteData?.employees) ? fetchedCorteData.employees : []);

    useEffect(() => {
        if (!open) return;
        const hasDefaultEmp = defaultEmployeeKey && defaultEmployeeKey !== 'all';
        setScope(hasDefaultEmp ? 'person' : 'global');
        setEmployeeKey(defaultEmployeeKey || 'all');
        setOnlyOvertime(Boolean(defaultOnlyOvertime));
    }, [open, corte?.id, defaultEmployeeKey, defaultOnlyOvertime]);

    useEffect(() => () => {
        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    }, [pdfBlobUrl]);

    if (!open || !corte) return null;

    const buildQueryParams = (format) => ({
        format,
        scope,
        employeeKey: scope === 'person' ? employeeKey : 'all',
        onlyOvertime: onlyOvertime ? 1 : 0
    });

    const handleClosePdf = () => {
        if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
        setPdfError(null);
        setIsPdfOpen(false);
    };

    const handleOpenPdf = async () => {
        try {
            if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
            setPdfBlobUrl(null);
            setPdfError(null);
            setIsPdfOpen(true);
            setIsGeneratingPdf(true);

            const res = await axios.get(`/api/rh/biometric/cortes/${corte.id}/export`, {
                params: buildQueryParams('pdf'),
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            setPdfBlobUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error('Error generando PDF del corte:', err);
            setPdfError(err.response?.data?.message || 'No se pudo generar el PDF del período congelado.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleDownloadExcel = async () => {
        try {
            setIsDownloadingExcel(true);
            const res = await axios.get(`/api/rh/biometric/cortes/${corte.id}/export`, {
                params: buildQueryParams('excel'),
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const suffix = scope === 'person'
                ? (employeeKey !== 'all' ? 'por_persona' : 'detallado_todos')
                : 'global_firmas';
            link.setAttribute('download', `Control_Horas_${corte.fecha_inicio}_al_${corte.fecha_fin}_${suffix}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Archivo Excel (.xlsx) descargado correctamente.');
        } catch (err) {
            console.error('Error descargando Excel del corte:', err);
            toast.error(err.response?.data?.message || 'Error al generar Excel del período congelado.');
        } finally {
            setIsDownloadingExcel(false);
        }
    };

    const selectedEmpObj = resolvedEmployees.find(e => e.employee_key === employeeKey) || null;
    const pdfSubtitle = `${corte.nombre} (${formatDate(corte.fecha_inicio)} al ${formatDate(corte.fecha_fin)})${selectedEmpObj && scope === 'person' ? ` • ${selectedEmpObj.nombre}` : ''}`;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
                                <FileCheck2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-black tracking-tight">
                                    Imprimir / Exportar Período Congelado
                                </h3>
                                <p className="text-[11px] text-slate-300">
                                    {corte.nombre} ({formatDate(corte.fecha_inicio)} al {formatDate(corte.fecha_fin)})
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label="Cerrar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4 text-xs">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                Formato de Resumen
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setScope('global')}
                                    className={`text-left p-3.5 rounded-xl border-2 transition-all space-y-1 ${
                                        scope === 'global'
                                            ? 'border-indigo-600 bg-indigo-50/70'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-bold text-slate-900">
                                        <Users className={`w-4 h-4 ${scope === 'global' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <span>Global (Con Firmas)</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                        Todos los colaboradores en tabla consolidada con columna de firma de aceptación por fila según nombre.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setScope('person')}
                                    className={`text-left p-3.5 rounded-xl border-2 transition-all space-y-1 ${
                                        scope === 'person'
                                            ? 'border-indigo-600 bg-indigo-50/70'
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-bold text-slate-900">
                                        <User className={`w-4 h-4 ${scope === 'person' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <span>Detallado por Persona</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-snug">
                                        Detalle diario completo (entrada, salida, horas y H.E.), subtotal individual y firma de aceptación.
                                    </p>
                                </button>
                            </div>
                        </div>

                        {scope === 'person' && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                    Colaborador
                                </label>
                                <select
                                    value={employeeKey}
                                    onChange={(e) => setEmployeeKey(e.target.value)}
                                    className="w-full text-[13px] font-medium border border-slate-300 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="all">Todos los colaboradores (detalle individual c/u)</option>
                                    {resolvedEmployees.map((emp) => (
                                        <option key={emp.employee_key} value={emp.employee_key}>
                                            {emp.nombre} [{emp.codigo}] — {emp.cargo}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={onlyOvertime}
                                onChange={(e) => setOnlyOvertime(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="font-bold text-slate-700 text-xs">
                                Incluir únicamente registros con Horas Extra
                            </span>
                        </label>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={isDownloadingExcel || isGeneratingPdf}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {isDownloadingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            <span>Descargar Excel (.xlsx)</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenPdf}
                            disabled={isGeneratingPdf || isDownloadingExcel}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                        >
                            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                            <span>Ver / Imprimir PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            <PdfViewerModal
                isOpen={isPdfOpen}
                onClose={handleClosePdf}
                title={scope === 'global' ? 'Resumen Global de Control de Horas y Aceptación' : 'Resumen Detallado de Horas por Colaborador'}
                subtitle={pdfSubtitle}
                badge="Período Congelado • Con Firmas"
                pdfUrl={pdfBlobUrl}
                isLoading={isGeneratingPdf}
                loadingText="Generando formato PDF con firmas de aceptación..."
                error={pdfError}
                onRetry={handleOpenPdf}
                fileName={`Control_Horas_${corte.fecha_inicio}_al_${corte.fecha_fin}.pdf`}
                footerNote="Incluye espacio de firma de aceptación por colaborador • Formato Oficial"
            />
        </>
    );
};

export default BiometricCorteExportModal;
