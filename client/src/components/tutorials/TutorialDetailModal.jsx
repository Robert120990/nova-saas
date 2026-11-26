import { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, ExternalLink, FileDown, CheckCircle2,
    Lightbulb, AlertTriangle, CheckSquare, GraduationCap, Target
} from 'lucide-react';
import Modal from '../ui/Modal';
import AnnotatedScreenshot from './AnnotatedScreenshot';

export default function TutorialDetailModal({
    isOpen,
    onClose,
    tutorial,
    isCompleted = false,
    onToggleComplete,
    onDownloadPdf,
    onNavigateModule
}) {
    const [stepIndex, setStepIndex] = useState(0);
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);

    const steps = Array.isArray(tutorial?.steps) ? tutorial.steps : [];

    useEffect(() => {
        setStepIndex(0);
        setShowTroubleshooting(false);
    }, [tutorial?.slug, isOpen]);

    useEffect(() => {
        if (!isOpen || steps.length <= 1) return undefined;
        const onKeyDown = (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.key === 'ArrowRight') {
                setStepIndex((i) => Math.min(steps.length - 1, i + 1));
            } else if (e.key === 'ArrowLeft') {
                setStepIndex((i) => Math.max(0, i - 1));
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, steps.length]);

    if (!isOpen || !tutorial) return null;

    const currentStep = steps[stepIndex] || steps[0] || {};
    const prereqs = Array.isArray(tutorial.prerequisites) ? tutorial.prerequisites : [];
    const troubleList = Array.isArray(tutorial.troubleshooting) ? tutorial.troubleshooting : [];
    const progressPct = steps.length > 0 ? Math.round(((stepIndex + 1) / steps.length) * 100) : 100;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-5xl"
            title={
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
                        <GraduationCap size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {tutorial.order}. {tutorial.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate">
                            {tutorial.categoryLabel}
                            {tutorial.menuPath ? ` • Menú: ${tutorial.menuPath}` : ''}
                            {` • ${steps.length} pasos • ${tutorial.duration}`}
                        </p>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Barra de progreso y selector de pasos */}
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-indigo-700">
                            Paso {stepIndex + 1} de {steps.length}: {currentStep.title}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">{progressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {steps.map((s, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setStepIndex(idx)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    idx === stepIndex
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : idx < stepIndex
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {idx + 1}. {s.title.length > 34 ? `${s.title.slice(0, 34)}…` : s.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Objetivo + Prerrequisitos en Paso 1 */}
                {stepIndex === 0 && (tutorial.outcome || prereqs.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {tutorial.outcome && (
                            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-950 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Target size={14} className="text-emerald-600 shrink-0" />
                                    <span>¿Qué lograrás con esta guía?</span>
                                </div>
                                <p className="text-[11.5px] leading-relaxed">{tutorial.outcome}</p>
                            </div>
                        )}
                        {prereqs.length > 0 && (
                            <div className={`p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl text-xs text-indigo-950 space-y-1 ${!tutorial.outcome ? 'md:col-span-2' : ''}`}>
                                <div className="font-bold flex items-center gap-1.5">
                                    <CheckSquare size={14} className="text-indigo-600 shrink-0" />
                                    <span>Antes de iniciar, verifica:</span>
                                </div>
                                <ul className="list-disc pl-5 space-y-0.5 text-[11.5px]">
                                    {prereqs.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Descripción del paso + Captura real anotada */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-3">
                    <p className="text-[13px] text-slate-800 leading-relaxed font-medium">
                        {currentStep.description}
                    </p>

                    <AnnotatedScreenshot
                        image={currentStep.image}
                        title={currentStep.title}
                        annotations={currentStep.annotations}
                    />

                    {currentStep.tip && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
                            <Lightbulb size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                            <span>
                                <strong>Consejo práctico:</strong> {currentStep.tip}
                            </span>
                        </div>
                    )}
                </div>

                {/* Solución de inconvenientes frecuentes */}
                {troubleList.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50/50 rounded-2xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-amber-900 hover:bg-amber-100/40 cursor-pointer"
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-600" />
                                ¿Qué hacer si ocurre un inconveniente? ({troubleList.length})
                            </span>
                            <span>{showTroubleshooting ? 'Ocultar' : 'Ver soluciones'}</span>
                        </button>
                        {showTroubleshooting && (
                            <div className="p-3.5 bg-white border-t border-amber-100 space-y-2 text-xs">
                                {troubleList.map((item, i) => (
                                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                                        <p className="font-bold text-slate-900">{item.issue}</p>
                                        <p className="text-slate-600 mt-0.5">{item.fix}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Barra de navegación y acciones */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onNavigateModule(tutorial.modulePath)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer"
                        >
                            <ExternalLink size={13} />
                            <span>Ir a la pantalla</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onDownloadPdf(tutorial)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                        >
                            <FileDown size={13} />
                            <span>Descargar PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onToggleComplete(tutorial.slug)}
                            className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                                isCompleted
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <CheckCircle2 size={13} />
                            <span>{isCompleted ? 'Completado' : 'Marcar completado'}</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                            disabled={stepIndex === 0}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                        >
                            <ChevronLeft size={14} />
                            <span>Anterior</span>
                        </button>

                        {stepIndex < steps.length - 1 ? (
                            <button
                                type="button"
                                onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                            >
                                <span>Siguiente Paso</span>
                                <ChevronRight size={14} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isCompleted) onToggleComplete(tutorial.slug);
                                    onClose();
                                }}
                                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                            >
                                <CheckCircle2 size={14} />
                                <span>Finalizar Guía</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
