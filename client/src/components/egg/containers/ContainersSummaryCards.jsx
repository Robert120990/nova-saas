import { CheckCircle2, Zap, Clock, Receipt, Search } from 'lucide-react';
import Money from '../../ui/Money';

export default function ContainersSummaryCards({ model }) {
    const {
        containers,
        summary,
        statusFilter,
        setStatusFilter,
        searchTerm,
        setSearchTerm
    } = model;

    return (
        <div className="space-y-4">
            {/* Tarjetas KPI Principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Disponibles Visualmente */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'available' ? 'all' : 'available')}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all shadow-sm flex items-center justify-between ${
                        statusFilter === 'available'
                            ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                            Contenedores Disponibles
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
                                {summary.available_count}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                de {summary.total_containers} libres
                            </span>
                        </div>
                        <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Apagados • Listos para usar
                        </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-100/80 text-emerald-600 shrink-0">
                        <CheckCircle2 className="h-7 w-7" />
                    </div>
                </div>

                {/* 2. Encendidos (Con Producto) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all shadow-sm flex items-center justify-between ${
                        statusFilter === 'active'
                            ? 'bg-cyan-50/90 border-cyan-400 ring-2 ring-cyan-500/20'
                            : 'bg-white border-slate-200 hover:border-cyan-300'
                    }`}
                >
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping inline-block" />
                            Contenedores Encendidos
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-cyan-600">
                                {summary.active_count}
                            </span>
                            <span className="text-xs font-bold text-slate-400">
                                en operación
                            </span>
                        </div>
                        <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                            {Number(summary.current_lbs_balance || 0) > 0
                                ? `${Number(summary.current_lbs_balance).toLocaleString('en-US')} lbs almacenadas`
                                : 'Almacenando Producto'}
                        </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-cyan-100/80 text-cyan-600 shrink-0">
                        <Zap className="h-7 w-7" />
                    </div>
                </div>

                {/* 3. Total Días Encendido */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                            Total Días Encendidos
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl sm:text-3xl font-black text-indigo-600">
                                {summary.total_days_on}
                            </span>
                            <span className="text-xs font-bold text-slate-500 uppercase">
                                {summary.total_days_on === 1 ? 'Día' : 'Días'}
                            </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 block">
                            Almac.: <Money value={summary.storage_subtotal ?? summary.total_subtotal} /> • Desc.: <Money value={summary.loading_unloading_total || 0} />
                        </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
                        <Clock className="h-7 w-7" />
                    </div>
                </div>

                {/* 4. Cobro Total Acumulado ($195/día + IVA) */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block">
                                Total Estado de Cuenta
                            </span>
                            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
                                <Money value={summary.total_subtotal} />
                            </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white/10 text-indigo-200 shrink-0">
                            <Receipt className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                        <span>
                            + IVA (13%): <Money value={summary.total_iva} className="text-amber-300 font-bold" />
                        </span>
                        <span>
                            c/IVA: <Money value={summary.total_with_iva} className="text-white font-bold" />
                        </span>
                    </div>
                </div>
            </div>

            {/* Barra de Estado Visual de Disponibilidad y Filtros */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Indicador Gráfico Rápido de los Contenedores */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">
                        Disponibilidad Visual:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {(Array.isArray(containers) ? containers : []).map((c) => (
                            <div
                                key={c.id}
                                title={`${c.name}: ${c.is_active_power ? 'ENCENDIDO' : 'DISPONIBLE'} (${c.days_on} días)`}
                                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 transition-all ${
                                    c.is_active_power
                                        ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                            >
                                <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                        c.is_active_power ? 'bg-amber-300 animate-pulse' : 'bg-emerald-500'
                                    }`}
                                />
                                <span>#{c.container_number}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Filtros de Estado y Búsqueda */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === 'all'
                                    ? 'bg-white text-indigo-600 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todos ({summary.total_containers})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('available')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === 'available'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700'
                            }`}
                        >
                            Disponibles ({summary.available_count})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('active')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                statusFilter === 'active'
                                    ? 'bg-cyan-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-cyan-700'
                            }`}
                        >
                            Encendidos ({summary.active_count})
                        </button>
                    </div>

                    <div className="relative flex-1 sm:w-48 min-w-[160px]">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar contenedor..."
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
