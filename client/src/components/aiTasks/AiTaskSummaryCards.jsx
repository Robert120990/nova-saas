import { Cpu, Clock, CheckCircle2, AlertOctagon, Loader2 } from 'lucide-react';

const AiTaskSummaryCards = ({ summary = {} }) => {
    const {
        in_progress = 0,
        pending = 0,
        completed_today = 0,
        failed = 0
    } = summary;

    const cards = [
        {
            label: 'En Proceso / Analizando',
            value: in_progress,
            icon: in_progress > 0 ? Loader2 : Cpu,
            iconCls: in_progress > 0 ? 'animate-spin text-indigo-600' : 'text-indigo-600',
            bgCls: 'bg-indigo-50 border-indigo-100',
            textCls: 'text-indigo-900',
            subtext: in_progress === 1 ? '1 tarea activa' : `${in_progress} tareas activas`
        },
        {
            label: 'En Cola de Espera',
            value: pending,
            icon: Clock,
            iconCls: 'text-amber-600',
            bgCls: 'bg-amber-50 border-amber-100',
            textCls: 'text-amber-900',
            subtext: 'Priorizadas para ejecución'
        },
        {
            label: 'Completadas Hoy',
            value: completed_today,
            icon: CheckCircle2,
            iconCls: 'text-emerald-600',
            bgCls: 'bg-emerald-50 border-emerald-100',
            textCls: 'text-emerald-900',
            subtext: 'Informes generados'
        },
        {
            label: 'Fallidas / Interrumpidas',
            value: failed,
            icon: AlertOctagon,
            iconCls: failed > 0 ? 'text-rose-600' : 'text-slate-400',
            bgCls: failed > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100',
            textCls: failed > 0 ? 'text-rose-900' : 'text-slate-700',
            subtext: failed > 0 ? 'Requieren revisión' : 'Todo operativo'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cards.map((c, idx) => {
                const Icon = c.icon;
                return (
                    <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border transition-all shadow-sm ${c.bgCls}`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                {c.label}
                            </span>
                            <div className="p-1.5 bg-white/80 rounded-xl shadow-xs">
                                <Icon size={16} className={c.iconCls} />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-black font-mono tracking-tight ${c.textCls}`}>
                                {c.value}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                                {c.subtext}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AiTaskSummaryCards;
