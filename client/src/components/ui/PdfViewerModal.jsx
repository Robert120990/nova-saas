import { useRef, useEffect } from 'react';
import { FileText, Download, Printer, ExternalLink, X, Loader2, RefreshCw } from 'lucide-react';

/**
 * PdfViewerModal - Modal interactivo para visualizar reportes PDF con opciones de impresión y descarga.
 *
 * @param {boolean} isOpen - Indica si el modal está visible
 * @param {function} onClose - Función ejecutada al cerrar el modal
 * @param {string} title - Título del reporte (ej. "Reporte de Kárdex")
 * @param {string} subtitle - Subtítulo descriptivo (ej. "Aceite 20W50 • Sucursal Central")
 * @param {string} badge - Texto de la insignia (ej. "Formato Oficial")
 * @param {string} pdfUrl - URL de Blob del archivo PDF generado
 * @param {boolean} isLoading - Estado de carga mientras se genera el reporte
 * @param {string} loadingText - Mensaje mientras se genera el documento
 * @param {string} error - Mensaje de error en caso de fallo
 * @param {function} onRetry - Función para reintentar la generación
 * @param {string} fileName - Nombre del archivo sugerido para descarga
 * @param {string} footerNote - Nota informativa en el pie del visor
 */
const PdfViewerModal = ({
    isOpen,
    onClose,
    title = 'Vista Previa del Reporte',
    subtitle = '',
    badge = 'Formato Oficial',
    pdfUrl = null,
    isLoading = false,
    loadingText = 'Generando reporte en formato contable oficial...',
    error = null,
    onRetry = null,
    fileName = 'reporte.pdf',
    footerNote = 'Formato contable estándar oficial • Presentación Carta sin firmas'
}) => {
    const iframeRef = useRef(null);

    // Manejo de atajo ESC para cerrar
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handlePrint = () => {
        if (iframeRef.current?.contentWindow) {
            try {
                iframeRef.current.contentWindow.focus();
                iframeRef.current.contentWindow.print();
            } catch {
                window.open(pdfUrl, '_blank');
            }
        } else if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                className="bg-white w-full max-w-6xl h-[92vh] max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                            <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                                    {title}
                                </h3>
                                {badge && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                        {badge}
                                    </span>
                                )}
                            </div>
                            {subtitle && (
                                <p className="text-xs text-slate-500 font-medium truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {pdfUrl && !isLoading && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl font-bold text-xs transition-colors border border-slate-200 shadow-xs cursor-pointer"
                                    title="Descargar archivo PDF"
                                >
                                    <Download size={14} />
                                    <span className="hidden md:inline">Descargar PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors border border-slate-200 shadow-xs cursor-pointer"
                                    title="Imprimir documento"
                                >
                                    <Printer size={14} />
                                    <span className="hidden md:inline">Imprimir</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.open(pdfUrl, '_blank')}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                                    title="Abrir en pestaña nueva"
                                >
                                    <ExternalLink size={18} />
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors ml-1 cursor-pointer"
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
                            <Loader2 size={38} className="animate-spin text-indigo-600" />
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                {loadingText}
                            </p>
                            <p className="text-[11px] text-slate-400">
                                Preparando documento conforme al estándar contable unificado...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                                <FileText size={28} />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">No se pudo cargar el reporte</h4>
                            <p className="text-xs text-slate-500 max-w-sm">{error}</p>
                            {onRetry && (
                                <button
                                    type="button"
                                    onClick={onRetry}
                                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
                                >
                                    <RefreshCw size={14} />
                                    <span>Reintentar</span>
                                </button>
                            )}
                        </div>
                    ) : pdfUrl ? (
                        <iframe
                            ref={iframeRef}
                            src={`${pdfUrl}#view=FitH`}
                            className="w-full flex-1 border-0 bg-slate-100"
                            title={title}
                        />
                    ) : null}
                </div>

                {/* Footer */}
                <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                    <span className="font-medium text-slate-400 truncate mr-2">
                        {footerNote}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-slate-400">
                            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono font-bold text-[10px] text-slate-600 shadow-xs mr-1">ESC</kbd>
                            para salir
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 font-bold transition-colors shadow-xs cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfViewerModal;
