import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Copy, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Inline expandable preview for task output/result.
 */
export const AiTaskOutputPreview = ({ result, outputType = 'texto', outputFileUrl: rawOutputFileUrl = null, onOpenDetail, onOpenPdf }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isChartExpanded, setIsChartExpanded] = useState(false);

    const outputFileUrl = typeof rawOutputFileUrl === 'string' && rawOutputFileUrl.startsWith('/uploads/')
        ? `/api${rawOutputFileUrl}`
        : rawOutputFileUrl;

    if (!result && !outputFileUrl) return null;

    const isImageFile = Boolean(
        outputFileUrl && (outputType === 'imagen' || /\.(svg|png|webp|jpe?g|gif)$/i.test(outputFileUrl))
    );

    const handleCopy = (e) => {
        e.stopPropagation();
        if (result) {
            navigator.clipboard.writeText(result);
            toast.success('Dato de salida copiado al portapapeles');
        }
    };

    return (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 flex-wrap">
                {/* File Action Badges */}
                {outputFileUrl && (outputType === 'pdf' || outputFileUrl.endsWith('.pdf')) && (
                    <button
                        type="button"
                        onClick={() => onOpenPdf ? onOpenPdf(outputFileUrl) : window.open(outputFileUrl, '_blank')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all shadow-xs cursor-pointer"
                        title="Abrir visor oficial PDF"
                    >
                        <span>📄</span>
                        <span>Ver PDF</span>
                    </button>
                )}

                {outputFileUrl && (outputType === 'excel' || outputFileUrl.endsWith('.xlsx')) && (
                    <a
                        href={outputFileUrl}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all shadow-xs"
                        title="Descargar libro Excel .xlsx"
                    >
                        <span>📊</span>
                        <span>Excel .xlsx</span>
                    </a>
                )}

                {isImageFile && (
                    <button
                        type="button"
                        onClick={() => setIsChartExpanded(prev => !prev)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all shadow-xs cursor-pointer ${
                            isChartExpanded
                                ? 'bg-purple-600 text-white border-purple-700'
                                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                        }`}
                        title="Ver gráfico o imagen adjunta"
                    >
                        <span>🖼️</span>
                        <span>{isChartExpanded ? 'Ocultar Cuadro' : 'Ver Cuadro'}</span>
                        {isChartExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                )}

                {result && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border shadow-xs cursor-pointer ${
                            isExpanded
                                ? 'bg-indigo-600 text-white border-indigo-700'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        <FileText size={12} />
                        <span>{isExpanded ? 'Ocultar Texto' : 'Ver Texto'}</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                )}

                {result && (
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Copiar resultado"
                    >
                        <Copy size={12} />
                    </button>
                )}
            </div>

            {isChartExpanded && isImageFile && (
                <div className="mt-2 p-3 bg-slate-950 text-slate-100 rounded-xl border border-slate-800 shadow-inner space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                        <span className="flex items-center gap-1 text-purple-400">
                            🖼️ Vista Previa Visual
                        </span>
                        <div className="flex items-center gap-3">
                            {onOpenDetail && (
                                <button
                                    type="button"
                                    onClick={onOpenDetail}
                                    className="text-indigo-400 hover:text-indigo-300 font-semibold underline lowercase flex items-center gap-1 cursor-pointer"
                                >
                                    <Eye size={10} />
                                    <span>ampliar en modal</span>
                                </button>
                            )}
                            <a
                                href={outputFileUrl}
                                download
                                className="text-emerald-400 hover:text-emerald-300 font-semibold underline lowercase"
                            >
                                descargar imagen
                            </a>
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto flex justify-center bg-slate-900/80 rounded-lg p-2">
                        <img
                            src={outputFileUrl}
                            alt="Cuadro visual generado"
                            className="max-h-72 w-auto object-contain rounded-lg mx-auto"
                        />
                    </div>
                </div>
            )}

            {isExpanded && (
                <div className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-xl border border-slate-800 text-xs leading-relaxed max-h-56 overflow-y-auto shadow-inner">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                        <span className="flex items-center gap-1 text-indigo-400">
                            <Sparkles size={11} /> Salida del Agente
                        </span>
                        {onOpenDetail && (
                            <button
                                type="button"
                                onClick={onOpenDetail}
                                className="text-indigo-400 hover:text-indigo-300 font-semibold underline lowercase flex items-center gap-1 cursor-pointer"
                            >
                                <Eye size={10} />
                                <span>ver en modal</span>
                            </button>
                        )}
                    </div>
                    <div className="whitespace-pre-wrap font-sans text-xs text-slate-200">
                        {result}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiTaskOutputPreview;
