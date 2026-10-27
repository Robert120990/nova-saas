import { Container, Plus, DollarSign, Snowflake } from 'lucide-react';
import Money from '../../ui/Money';

export default function ContainersHeader({ model }) {
    const { summary, openAddModal, openRateModal } = model;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0 relative">
                    <Container className="h-6 w-6" />
                    <Snowflake className="h-3.5 w-3.5 text-cyan-500 absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-xs" />
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                            Control de Contenedores de Almacenamiento
                        </h1>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase">
                            {summary.total_containers} Contenedores
                        </span>
                    </div>
                    <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                        Monitoreo visual de disponibilidad, encendido/apagado según llegada de producto y liquidación diaria de frío.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                {/* Tarifa Diaria Activa ($195 + IVA) */}
                <button
                    type="button"
                    onClick={openRateModal}
                    className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-200 transition-all text-left group w-full sm:w-auto justify-between sm:justify-start"
                    title="Clic para ajustar la tarifa diaria por contenedor"
                >
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                        <DollarSign size={14} />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block leading-none">
                            Cobro por Día (Tarifa Base)
                        </span>
                        <div className="text-xs font-extrabold text-slate-900 mt-0.5 flex items-center gap-1.5">
                            <Money value={summary.default_daily_rate} />
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                + IVA (<Money value={summary.default_daily_with_iva} />)
                            </span>
                        </div>
                    </div>
                </button>

                {/* Botón Adicionar Más Contenedores */}
                <button
                    type="button"
                    onClick={openAddModal}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                    <Plus size={15} />
                    <span>Adicionar Contenedor</span>
                </button>
            </div>
        </div>
    );
}
