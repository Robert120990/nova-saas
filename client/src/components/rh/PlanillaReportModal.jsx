import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { FileText, Download, Printer, ExternalLink, X, Loader2, RefreshCw, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';

const MONTH_NAMES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const PlanillaReportModal = ({ isOpen, onClose, periodo }) => {
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const iframeRef = useRef(null);

    const anio = periodo?.anio || periodo?.periodo_año || periodo?.año;
    const mes = periodo?.mes || periodo?.periodo_mes || 12;
    const quincena = periodo?.quincena;
    const departamento_id = periodo?.departamento_id || periodo?.filtro_departamento_id;
    const departamento_nombre = periodo?.departamento_nombre;
    const tipo = periodo?.tipo || 'planilla';
    const isAguinaldo = tipo === 'aguinaldo' || tipo === 'aguinaldo-recibos';
    const isRecibos = tipo === 'recibos' || tipo === 'aguinaldo-recibos';

    const mesLabel = MONTH_NAMES[parseInt(mes)] || `Mes ${mes}`;
    const quincenaLabel = quincena === 'primera' ? '1ra Quincena' : '2da Quincena';

    const fetchReport = async () => {
        if (!anio || (!isAguinaldo && (!mes || !quincena))) return;
        setIsLoading(true);
        setError(null);
        try {
            let endpoint = '';
            let params = {};

            if (tipo === 'aguinaldo') {
                endpoint = '/api/rh/planilla-aguinaldos/pdf';
                params = { año: anio, mes: mes || 12 };
                if (departamento_id && departamento_id !== '0') params.departamento_id = departamento_id;
            } else if (tipo === 'aguinaldo-recibos') {
                endpoint = '/api/rh/planilla-aguinaldos/recibos';
                params = { año: anio, mes: mes || 12 };
                if (departamento_id && departamento_id !== '0') params.departamento_id = departamento_id;
            } else if (isRecibos) {
                endpoint = '/api/rh/planillas/recibos-masivos';
                params = { anio, mes, quincena };
            } else {
                endpoint = '/api/rh/planillas/reporte-pdf';
                params = { anio, mes, quincena };
            }

            const res = await axios.get(endpoint, {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err) {
            console.error('Error fetching PDF:', err);
            const defaultMsg = isAguinaldo
                ? (isRecibos ? 'Error al generar los recibos de aguinaldo' : 'Error al generar la planilla de aguinaldos')
                : (isRecibos ? 'Error al generar los recibos masivos' : 'Error al generar el reporte de planilla');
            setError(err.response?.data?.message || defaultMsg);
            toast.error(defaultMsg);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && anio && (isAguinaldo || (mes && quincena))) {
            fetchReport();
        } else {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
            setError(null);
        }

        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [isOpen, anio, mes, quincena, tipo, departamento_id]);

    // Close on ESC
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        const defaultFilename = isAguinaldo
            ? (isRecibos ? `Recibos_Aguinaldos_${anio}_${mes}.pdf` : `Planilla_Aguinaldos_${anio}_${mes}.pdf`)
            : (isRecibos ? `Recibos_Planilla_${anio}_${mes}_${quincena}.pdf` : `Planilla_${anio}_${mes}_${quincena}.pdf`);
        link.setAttribute('download', defaultFilename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Descarga iniciada');
    };

    const handlePrint = () => {
        if (!iframeRef.current) return;
        try {
            iframeRef.current.contentWindow?.print();
        } catch {
            window.open(pdfUrl, '_blank');
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl w-full max-w-6xl h-[92vh] max-h-[92vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${
                            isRecibos
                                ? 'from-purple-600 to-indigo-800 shadow-purple-500/20'
                                : 'from-indigo-600 to-indigo-800 shadow-indigo-500/20'
                        } text-white flex items-center justify-center shadow-md shrink-0`}>
                            {isRecibos ? <ReceiptText size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                                    {isAguinaldo
                                        ? (isRecibos ? 'Recibos de Aguinaldo Masivos' : 'Planilla de Aguinaldos')
                                        : (isRecibos ? 'Recibos de Pago Masivos' : 'Planilla de Sueldos y Salarios')}
                                </h3>
                                <span className={`text-[10px] font-bold ${
                                    isRecibos
                                        ? 'text-purple-700 bg-purple-50 border-purple-200/70'
                                        : 'text-indigo-700 bg-indigo-50 border-indigo-200/70'
                                } border px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0`}>
                                    {isAguinaldo
                                        ? (isRecibos ? 'Boletas de Aguinaldo' : 'Formato Oficial')
                                        : (isRecibos ? 'Boletas de Pago' : 'Formato Oficial')}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium truncate">
                                {isAguinaldo
                                    ? `Período: ${mesLabel} ${anio}${departamento_nombre && departamento_nombre !== 'Todos' ? ' • Depto: ' + departamento_nombre : ' • Todos los Departamentos'}`
                                    : `Período: ${mesLabel} ${anio} • ${quincenaLabel}`}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {pdfUrl && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl font-bold text-xs transition-colors border border-slate-200 shadow-sm"
                                    title="Descargar archivo PDF"
                                >
                                    <Download size={14} />
                                    <span className="hidden md:inline">Descargar PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors border border-slate-200 shadow-sm"
                                    title="Imprimir documento"
                                >
                                    <Printer size={14} />
                                    <span className="hidden md:inline">Imprimir</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.open(pdfUrl, '_blank')}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                    title="Abrir en pestaña nueva"
                                >
                                    <ExternalLink size={18} />
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors ml-1"
                            title="Cerrar vista previa"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body / PDF viewer */}
                <div className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-slate-500">
                            <Loader2 size={36} className={`animate-spin ${isRecibos ? 'text-purple-600' : 'text-indigo-600'}`} />
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                {isAguinaldo
                                    ? (isRecibos ? 'Generando recibos de aguinaldo...' : 'Generando planilla de aguinaldos en formato oficial...')
                                    : (isRecibos ? 'Generando recibos de pago...' : 'Generando planilla en formato contable...')}
                            </p>
                            <p className="text-[11px] text-slate-400">
                                {isAguinaldo
                                    ? (isRecibos ? 'Compilando boletas individuales de aguinaldo de cada empleado' : 'Procesando cálculos, días de ley, exenciones y retenciones')
                                    : (isRecibos ? 'Compilando boletas individuales de cada empleado del período' : 'Procesando totales, deducciones y percepciones de ley')}
                            </p>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                                <FileText size={28} />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">No se pudo cargar el reporte</h4>
                            <p className="text-xs text-slate-500 max-w-sm">{error}</p>
                            <button
                                type="button"
                                onClick={fetchReport}
                                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all"
                            >
                                <RefreshCw size={14} />
                                <span>Reintentar</span>
                            </button>
                        </div>
                    ) : pdfUrl ? (
                        <iframe
                            ref={iframeRef}
                            src={`${pdfUrl}#view=FitH`}
                            className="w-full flex-1 border-0 bg-slate-100"
                            title={isAguinaldo
                                ? (isRecibos ? `Recibos Aguinaldos ${anio} ${mes}` : `Planilla Aguinaldos ${anio} ${mes}`)
                                : (isRecibos ? `Recibos ${anio} ${mes} ${quincena}` : `Planilla ${anio} ${mes} ${quincena}`)}
                        />
                    ) : null}
                </div>

                {/* Footer */}
                <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                    <span className="font-medium text-slate-400">
                        {isAguinaldo
                            ? (isRecibos
                                ? 'Boletas oficiales de aguinaldo • Formato individual para firma y entrega'
                                : 'Planilla oficial de aguinaldos • Formato contable apaisado (Carta) sin firmas')
                            : (isRecibos
                                ? 'Boletas oficiales de pago quincenal • Formato individual para firma y entrega'
                                : 'Formato contable estándar oficial • Presentación apaisada (Carta) sin firmas')}
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="hidden sm:inline text-slate-400">
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-600 shadow-sm mr-1">ESC</kbd>
                            para salir
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-bold transition-colors shadow-sm"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanillaReportModal;
