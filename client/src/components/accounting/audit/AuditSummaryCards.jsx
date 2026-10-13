import { ShieldCheck, AlertTriangle, AlertCircle, FileSpreadsheet, Activity } from 'lucide-react';

export const AuditSummaryCards = ({ health, catalogCounts, entriesCounts, catalogOverview, entriesOverview }) => {
    const score = health?.score ?? 100;
    const opinion = health?.opinion || 'Sin Evaluar';
    const opinionLevel = health?.opinionLevel || 'clean';

    const getScoreBadge = () => {
        if (opinionLevel === 'clean') {
            return {
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
                icon: ShieldCheck
            };
        }
        if (opinionLevel === 'qualified') {
            return {
                bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
                icon: AlertTriangle
            };
        }
        return {
            bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
            icon: AlertCircle
        };
    };

    const badge = getScoreBadge();
    const ScoreIcon = badge.icon;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Card 1: Puntuación de Salud Contable */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Salud Contable
                    </span>
                    <div className={`p-2 rounded-xl border ${badge.bg}`}>
                        <ScoreIcon className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">
                        {score}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">/ 100</span>
                </div>
                <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                        {opinion}
                    </span>
                </div>
            </div>

            {/* Card 2: Anomalías en Catálogo */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Catálogo de Cuentas
                    </span>
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800">
                        <FileSpreadsheet className="w-5 h-5" />
                    </div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {catalogCounts?.error || 0}
                        <span className="text-xs font-normal text-rose-500 ml-1.5 font-medium">errores críticos</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span>{catalogCounts?.warning || 0} advertencias</span>
                        <span>•</span>
                        <span>{catalogOverview?.totalAccounts || 0} cuentas</span>
                    </div>
                </div>
            </div>

            {/* Card 3: Descuadres en Partidas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Integridad Partidas
                    </span>
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {entriesCounts?.error || 0}
                        <span className="text-xs font-normal text-rose-500 ml-1.5 font-medium">descuadres / fallas</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span>{entriesCounts?.warning || 0} advertencias</span>
                        <span>•</span>
                        <span>{entriesOverview?.draftCount || 0} borradores</span>
                    </div>
                </div>
            </div>

            {/* Card 4: Cobertura de Auditoría */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Volumen Auditado
                    </span>
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">
                        {(entriesOverview?.totalEntries || 0).toLocaleString()}
                        <span className="text-xs font-normal text-slate-500 ml-1.5">partidas</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        100% de transacciones verificadas
                    </div>
                </div>
            </div>
        </div>
    );
};
