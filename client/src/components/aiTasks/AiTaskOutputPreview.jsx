import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Copy, Eye, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Inline expandable preview for task output/result.
 */
export const AiTaskOutputPreview = ({ result, outputType = 'texto', outputFileUrl = null, onOpenDetail, onOpenPdf }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!result && !outputFileUrl) return null;

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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all shadow-xs"
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

                {outputFileUrl && (outputType === 'imagen' || outputFileUrl.endsWith('.svg') || outputFileUrl.endsWith('.png')) && (
                    <a
                        href={outputFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all shadow-xs"
                        title="Ver gráfico visual"
                    >
                        <span>🖼️</span>
                        <span>Ver Gráfico</span>
                    </a>
                )}

                {result && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border shadow-xs ${
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
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Copiar resultado"
                    >
                        <Copy size={12} />
                    </button>
                )}
            </div>

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
                                className="text-indigo-400 hover:text-indigo-300 font-semibold underline lowercase flex items-center gap-1"
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
