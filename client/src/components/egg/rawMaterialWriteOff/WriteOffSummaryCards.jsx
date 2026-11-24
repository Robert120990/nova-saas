import { Layers, Package, Receipt, ArrowDownCircle } from 'lucide-react';
import { formatLbs, lbsToKg } from './constants';

export default function WriteOffSummaryCards({ lotsStats, writeOffSummary }) {
    const cards = [
        {
            title: 'Lotes Disponibles',
            value: (lotsStats.activeLots || 0).toLocaleString('en-US'),
            sub: `${(lotsStats.availableBoxes || 0).toLocaleString('en-US')} cajas en bodega`,
            icon: Package,
            iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
            accent: 'text-indigo-700'
        },
        {
            title: 'Tarimas Disponibles',
            value: (lotsStats.availableTarimas || 0).toLocaleString('en-US'),
            sub: `${formatLbs(lotsStats.availableLbs)} Lbs · ${lbsToKg(lotsStats.availableLbs)} Kg`,
            icon: Layers,
            iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            accent: 'text-emerald-700'
        },
        {
            title: 'Tarimas Dadas de Baja',
            value: (writeOffSummary.total_tarimas_written_off || 0).toLocaleString('en-US'),
            sub: `${(writeOffSummary.total_boxes_written_off || 0).toLocaleString('en-US')} cajas · ${formatLbs(writeOffSummary.total_lbs_written_off)} Lbs`,
            icon: ArrowDownCircle,
            iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
            accent: 'text-amber-700'
        },
        {
            title: 'Facturas Vinculadas',
            value: (writeOffSummary.linked_invoices_count || 0).toLocaleString('en-US'),
            sub: `${writeOffSummary.active_writeoffs || 0} bajas activas registradas`,
            icon: Receipt,
            iconBg: 'bg-violet-50 text-violet-600 border-violet-100',
            accent: 'text-violet-700'
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {cards.map((card) => {
                const Icon = card.icon;
                return (
                    <div
                        key={card.title}
                        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300/80 transition-colors"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                                    {card.title}
                                </p>
                                <p className={`text-2xl font-black mt-1 tracking-tight ${card.accent}`}>
                                    {card.value}
                                </p>
                            </div>
                            <div className={`p-2.5 rounded-xl border shrink-0 ${card.iconBg}`}>
                                <Icon size={18} />
                            </div>
                        </div>
                        <p className="text-xs font-medium text-slate-500 mt-2 truncate">
                            {card.sub}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
