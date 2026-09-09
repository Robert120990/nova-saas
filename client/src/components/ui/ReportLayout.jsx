import React, { useState } from 'react';
import { 
    FileText, 
    Download, 
    Loader2, 
    BarChart3,
    FileSpreadsheet,
    Maximize2
} from 'lucide-react';
import PdfViewerModal from './PdfViewerModal';

/**
 * ReportLayout - Componente base unificado para reportes "Premium"
 * 
 * @param {string} title - Título del reporte
 * @param {string} subtitle - Subtítulo descriptivo
 * @param {string} category - Categoría del reporte (ej: "Inventario", "Ventas")
 * @param {React.ReactNode} children - Contenido de los filtros (Sidebar)
 * @param {string} pdfUrl - URL del PDF generado (Blob URL)
 * @param {boolean} isGenerating - Estado de carga mientras se genera el reporte
 * @param {function} onGenerate - Función al presionar generar
 * @param {function} onDownload - Función al presionar descargar
 * @param {boolean} canGenerate - Si el botón de generar está habilitado
 * @param {string} generateButtonText - Texto del botón de generar
 * @param {function} onExportExcel - Función al presionar exportar a Excel
 * @param {string} fileName - Nombre del archivo descargado
 * @param {string} footerNote - Nota informativa en el pie del visor modal
 * @param {boolean} showModalButton - Si se muestra el botón para abrir en modal (por defecto true)
 */
const ReportLayout = ({
    title,
    subtitle,
    category,
    children,
    pdfUrl,
    isGenerating,
    onGenerate,
    onDownload,
    canGenerate = true,
    generateButtonText = "Generar Reporte",
    onExportExcel,
    fileName,
    footerNote,
    showModalButton = true
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const effectiveFileName = fileName || `${(title || 'reporte').toLowerCase().replace(/[^a-z0-9]/gi, '_')}.pdf`;

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header con Título y Botón Ver en Modal */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-3">
                        {title}
                        {category && (
                            <span className="text-xs md:text-sm font-black uppercase px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                {category}
                            </span>
                        )}
                    </h1>
                    {subtitle && (
                        <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest leading-relaxed">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Botón Expandir en la cabecera */}
                {pdfUrl && showModalButton && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200/80 hover:border-indigo-300 rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer"
                            title="Expandir reporte en ventana modal amplia (pantalla completa)"
                        >
                            <Maximize2 size={16} className="text-indigo-600" />
                            <span>Expandir</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-4 md:p-8 space-y-8 h-fit">
                        <div className="space-y-6">
                            {children}
                        </div>

                        <div className="pt-6 border-t border-slate-50 space-y-4">
                            <button 
                                onClick={onGenerate}
                                disabled={!canGenerate || isGenerating}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <BarChart3 size={18} />}
                                {generateButtonText}
                            </button>

                            {pdfUrl && onDownload && (
                                <button 
                                    onClick={onDownload}
                                    className="w-full py-4 bg-white text-slate-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
                                >
                                    <Download size={18} />
                                    Descargar PDF
                                </button>
                            )}

                            {pdfUrl && (
                                <button 
                                    onClick={() => window.open(pdfUrl, '_blank')}
                                    className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-3 md:hidden"
                                >
                                    <FileText size={18} />
                                    Abrir PDF
                                </button>
                            )}

                            {pdfUrl && onExportExcel && (
                                <button 
                                    onClick={onExportExcel}
                                    className="w-full py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center justify-center gap-3"
                                >
                                    <FileSpreadsheet size={18} />
                                    Exportar Excel
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* PDF Display Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden min-h-[420px] sm:min-h-[600px] lg:min-h-[750px] flex flex-col relative">
                        {pdfUrl ? (
                            <iframe 
                                src={`${pdfUrl}#view=FitH`} 
                                className="w-full flex-1 border-none"
                                title={`${title} Preview`}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                                    <FileText size={48} />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Vista Previa</h3>
                                    <p className="text-slate-400 text-sm max-w-[300px] font-medium mx-auto">
                                        Configure los filtros y presione "{generateButtonText}" para visualizar el documento en formato PDF.
                                    </p>
                                </div>
                            </div>
                        )}

                        {isGenerating && (
                            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <Loader2 className="text-indigo-600 animate-spin mb-4" size={48} />
                                <p className="text-slate-900 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Generando Documento...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Visualización Interactiva estilo Planillas */}
            {showModalButton && (
                <PdfViewerModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={title}
                    subtitle={subtitle}
                    badge={category || 'Formato Oficial'}
                    pdfUrl={pdfUrl}
                    isLoading={isGenerating}
                    onRetry={onGenerate}
                    fileName={effectiveFileName}
                    footerNote={footerNote || "Formato contable estándar oficial • Presentación Carta sin firmas"}
                />
            )}
        </div>
    );
};

export default ReportLayout;
