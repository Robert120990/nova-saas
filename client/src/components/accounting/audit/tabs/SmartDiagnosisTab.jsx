import { Sparkles, ShieldCheck, AlertTriangle, AlertCircle, BookOpen, Scale, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

export const SmartDiagnosisTab = ({ diagnosis, isDiagnosing, onRunDiagnosis }) => {
    const healthScore = diagnosis?.healthScore ?? 100;
    const opinion = diagnosis?.opinion || 'Limpio / Favorable';
    const opinionLevel = diagnosis?.opinionLevel || 'clean';

    const getOpinionBadge = () => {
        if (opinionLevel === 'clean') {
            return {
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
                icon: ShieldCheck,
                title: 'Opinión Favorable / Limpia'
            };
        }
        if (opinionLevel === 'qualified') {
            return {
                bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
                icon: AlertTriangle,
                title: 'Opinión Con Salvedades'
            };
        }
        return {
            bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
            icon: AlertCircle,
            title: 'Opinión Adversa / Desfavorable'
        };
    };

    const badge = getOpinionBadge();
    const OpinionIcon = badge.icon;

    return (
        <div className="space-y-6">
            {/* Header & Trigger AI Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-indigo-200 backdrop-blur-sm border border-white/10">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Motor Auditor con IA y Normativa Técnica Salvadoreña</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                            Diagnóstico y Razonamiento Contable Inteligente
                        </h2>
                        <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
                            Inspecciona automáticamente la partida doble, consistencia de catálogos y emite un dictamen profesional bajo NIIF para PYMES y Arts. 139-142 del Código Tributario.
                        </p>
                    </div>

                    <button
                        onClick={onRunDiagnosis}
                        disabled={isDiagnosing}
                        className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] shrink-0 ${
                            isDiagnosing
                                ? 'bg-white/90 text-indigo-900 cursor-not-allowed opacity-90 shadow-inner'
                                : 'bg-white text-indigo-900 hover:bg-indigo-50 hover:shadow-lg'
                        }`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isDiagnosing ? 'animate-spin text-indigo-600' : ''}`} />
                        {isDiagnosing ? 'Auditando con IA en curso...' : 'Ejecutar Dictamen IA'}
                    </button>
                </div>
            </div>

            {/* AI Active Processing Banner */}
            {isDiagnosing && (
                <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden animate-in fade-in duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse" />
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="relative flex items-center justify-center">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Sparkles className="w-6 h-6 animate-pulse" />
                                </div>
                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                                        Auditoría y Razonamiento Contable en Proceso...
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 animate-pulse">
                                        Analizando
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Examinando integridad de partida doble, consistencia de catálogo de cuentas y cumplimiento bajo NIIF para PYMES y Arts. 139-142 del Código Tributario SV. Esto tomará sólo unos segundos.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Steps Indicators */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300 font-medium">1. Verificación de catálogo</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300 font-medium">2. Cuadre de partida doble</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-ping" />
                            <span className="text-slate-600 dark:text-slate-300 font-medium">3. Detección de anomalías</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
                            <span className="text-slate-600 dark:text-slate-300 font-medium">4. Emisión de dictamen técnico</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Opinion & Executive Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score & Dictamen Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Dictamen de Auditoría
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">
                                Motor: {diagnosis?.engine === 'ai' ? 'IA Generativa' : 'Reglas Contables'}
                            </span>
                        </div>

                        <div className={`p-4 rounded-xl border ${badge.bg} flex items-center gap-3.5 mb-4`}>
                            <OpinionIcon className="w-8 h-8 shrink-0" />
                            <div>
                                <span className="text-xs font-semibold block opacity-80 uppercase tracking-wider">
                                    Resultado Dictaminado
                                </span>
                                <h3 className="text-base font-extrabold">{opinion}</h3>
                            </div>
                        </div>

                        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span>Índice de Confiabilidad:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{healthScore}%</span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                                <span>Partida Doble:</span>
                                <span className={`font-semibold ${opinionLevel === 'adverse' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {opinionLevel === 'adverse' ? 'Vulnerada' : 'Verificada'}
                                </span>
                            </div>
                            <div className="flex justify-between py-1.5">
                                <span>Marco de Referencia:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">NIIF para PYMES / SV</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center">
                        Auditoría efectuada con base en los registros asentados
                    </div>
                </div>

                {/* Resumen Ejecutivo Card */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                                Dictamen y Resumen Ejecutivo
                            </h3>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                            {diagnosis?.summary || 'Cargando análisis contable...'}
                        </p>

                        {diagnosis?.executiveDiagnosis && (
                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 mb-3">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Diagnóstico Técnico Especializado:
                                </span>
                                <p className="text-xs text-slate-700 dark:text-slate-300">
                                    {diagnosis.executiveDiagnosis}
                                </p>
                            </div>
                        )}

                        {diagnosis?.opinionReasoning && (
                            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
                                    Fundamentación del Dictamen:
                                </span>
                                <p className="text-xs text-slate-700 dark:text-slate-300">
                                    {diagnosis.opinionReasoning}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Findings & Action Plan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Principales Riesgos y Hallazgos */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Hallazgos y Factores de Riesgo
                    </h3>
                    <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {((diagnosis?.topRisks && diagnosis.topRisks.length > 0) ? diagnosis.topRisks : (diagnosis?.findings || [])).map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                                    {idx + 1}
                                </span>
                                <span className="leading-snug">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Plan de Acción y Regularización */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Plan de Acción y Recomendaciones
                    </h3>
                    <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {((diagnosis?.actionPlan && diagnosis.actionPlan.length > 0) ? diagnosis.actionPlan : (diagnosis?.recommendations || [])).map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                <span className="leading-snug">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Partidas de Ajuste Sugeridas */}
            {diagnosis?.suggestedAdjustments && diagnosis.suggestedAdjustments.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Partidas de Ajuste y Reclasificación Sugeridas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {diagnosis.suggestedAdjustments.map((adj, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="font-bold text-slate-800 dark:text-white block mb-1">
                                    {adj.title}
                                </span>
                                <p className="text-slate-600 dark:text-slate-300">{adj.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cumplimiento Legal y NIIF en El Salvador */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-xs space-y-2">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                        Marco Normativo NIIF para PYMES
                    </span>
                    {(diagnosis?.niifCompliance || []).map((text, i) => (
                        <p key={i} className="text-slate-600 dark:text-slate-400 leading-relaxed">• {text}</p>
                    ))}
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-xs space-y-2">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                        Marco Tributario (Código Tributario SV)
                    </span>
                    {(diagnosis?.taxCompliance || []).map((text, i) => (
                        <p key={i} className="text-slate-600 dark:text-slate-400 leading-relaxed">• {text}</p>
                    ))}
                </div>
            </div>
        </div>
    );
};
