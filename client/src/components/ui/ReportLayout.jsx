import React from 'react';
import { 
    FileText, 
    Download, 
    Loader2, 
    BarChart3
} from 'lucide-react';

/**
 * ReportLayout - Componente base para reportes "Premium"
 * 
 * @param {string} title - Título del reporte
 * @param {string} subtitle - Subtítulo descriptivo
 * @param {string} category - Categoría del reporte (ej: "Inventario")
 * @param {React.ReactNode} children - Contenido de los filtros (Sidebar)
 * @param {string} pdfUrl - URL del PDF generado
 * @param {boolean} isGenerating - Estado de carga
 * @param {function} onGenerate - Función al presionar generar
 * @param {function} onDownload - Función al presionar descargar
 * @param {boolean} canGenerate - Si el botón de generar está habilitado
 * @param {string} generateButtonText - Texto del botón de generar
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
    generateButtonText = "Generar Reporte"
}) => {
    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    {title}
                    {category && (
                        <span className="text-sm font-black uppercase px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8 space-y-8 h-fit">
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
                                    className="w-full py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center justify-center gap-3"
                                >
                                    <Download size={18} />
                                    Descargar PDF
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* PDF Display Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden min-h-[750px] flex flex-col relative">
                        {pdfUrl ? (
                            <iframe 
                                src={`${pdfUrl}#toolbar=0&view=FitH`} 
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
        </div>
    );
};

export default ReportLayout;
