

import {
    HelpCircle,
    XCircle
} from 'lucide-react';


export default function ConfigHelpConceptModalModal({ model, open = model.helpConceptModal, onClose = () => model.setHelpConceptModal(null) }) {
    const { helpConceptModal } = model;
    if (!open) return null;
    return (<>{helpConceptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-xl w-full max-h-[92dvh] overflow-y-auto text-slate-900 space-y-4 sm:space-y-5 my-auto">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sm:pb-4">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                                    <HelpCircle size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide truncate">
                                        ¿Cómo se complementa?
                                    </h3>
                                    <span className="text-xs text-indigo-600 font-bold block truncate">{helpConceptModal.concept_name}</span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            {/* Qué representa */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px] block">1. ¿Qué representa este concepto?</span>
                                <p className="text-slate-600 leading-relaxed font-medium">{helpConceptModal.description}</p>
                            </div>

                            {/* De dónde se extrae */}
                            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-indigo-900 uppercase tracking-wide text-[10px] block">2. ¿De dónde sale y cómo se complementa?</span>
                                <p className="text-indigo-800 leading-relaxed">{helpConceptModal.how_to_complete}</p>
                            </div>

                            {/* Fórmula y Ejemplo */}
                            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-1.5">
                                <span className="font-bold text-emerald-900 uppercase tracking-wide text-[10px] block">3. Fórmula de Cálculo por Lote</span>
                                <div className="p-2 bg-white rounded-lg font-mono text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                    {helpConceptModal.formula}
                                </div>
                                <p className="text-emerald-900 leading-relaxed text-[11px] pt-1">
                                    <span className="font-bold">Ejemplo práctico:</span> {helpConceptModal.example}
                                </p>
                            </div>

                            {/* Incidencia en el Costo por Libra */}
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-amber-900 uppercase tracking-wide text-[10px] block">4. Incidencia en el Costo Final por Libra</span>
                                <p className="text-amber-900 leading-relaxed">{helpConceptModal.per_pound_impact}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button
                                onClick={onClose}
                                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs text-center"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
