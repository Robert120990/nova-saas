import { Ticket, AlertCircle, Clock, CheckCircle2, Flame } from 'lucide-react';

const TicketSummaryCards = ({ stats = {}, activeStatus = '', onSelectStatus }) => {
    const cards = [
        {
            id: '',
            label: 'Total Tickets',
            value: Number(stats.total || 0),
            icon: Ticket,
            color: 'text-indigo-600 bg-indigo-50 border-indigo-200/70'
        },
        {
            id: 'abierto',
            label: 'Abiertos',
            value: Number(stats.abiertos || 0),
            icon: AlertCircle,
            color: 'text-amber-600 bg-amber-50 border-amber-200/70'
        },
        {
            id: 'en_proceso',
            label: 'En Proceso',
            value: Number(stats.en_proceso || 0),
            icon: Clock,
            color: 'text-sky-600 bg-sky-50 border-sky-200/70'
        },
        {
            id: 'resuelto',
            label: 'Resueltos',
            value: Number(stats.resueltos || 0),
            icon: CheckCircle2,
            color: 'text-emerald-600 bg-emerald-50 border-emerald-200/70'
        },
        {
            id: 'urgente_info',
            label: 'Urgentes Activos',
            value: Number(stats.urgentes_pendientes || 0),
            icon: Flame,
            color: 'text-rose-600 bg-rose-50 border-rose-200/70',
            isFilter: false
        }
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((card) => {
                const Icon = card.icon;
                const isSelected = card.isFilter !== false && activeStatus === card.id;
                return (
                    <button
                        key={card.id}
                        type="button"
                        onClick={() => card.isFilter !== false && onSelectStatus && onSelectStatus(card.id)}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                            card.isFilter !== false ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
                        } ${
                            isSelected
                                ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'bg-white border-slate-200/80'
                        }`}
                    >
                        <div className="min-w-0">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                {card.label}
                            </span>
                            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5 block">
                                {card.value}
                            </span>
                        </div>
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${card.color}`}>
                            <Icon size={18} />
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default TicketSummaryCards;
