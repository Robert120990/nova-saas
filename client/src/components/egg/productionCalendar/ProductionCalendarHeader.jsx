import {
    Calendar as CalendarIcon,
    Plus,
    Sparkles,
    ShoppingBag,
    Boxes,
    Truck
} from 'lucide-react';




export default function ProductionCalendarHeader({ model }) {
    const { navigate, suggestionsData, customerOrders, setIsSuggestionsDrawerOpen, setIsOrdersModalOpen, setIsPlannerModalOpen, handleOpenCreateModal, filteredProductions, totalScheduledLbs, totalTasksCount } = model;

    return (<div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            Calendario de Producción
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/80">
                                ANDELSA Planta
                            </span>
                        </h1>
                        <p className="text-xs sm:text-[13px] text-slate-500 font-medium">
                            Programación interactiva de lotes, formulaciones con balance de coproductos (MP Liquida a) y roles de fábrica.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {/* Botón Sugerencias Inteligentes */}
                <button
                    type="button"
                    onClick={() => setIsSuggestionsDrawerOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-200 hover:brightness-105 active:scale-95 transition-all"
                >
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Sugerencias IA</span>
                    {suggestionsData?.suggestions?.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-white text-emerald-700 rounded-full text-[10px] font-black">
                            {suggestionsData.suggestions.length}
                        </span>
                    )}
                </button>

                {/* Botón Pedidos de Clientes */}
                <button
                    type="button"
                    onClick={() => setIsOrdersModalOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition-all"
                >
                    <ShoppingBag className="w-4 h-4 text-slate-500" />
                    <span className="hidden sm:inline">Pedidos Clientes</span>
                    <span className="sm:hidden">Pedidos</span>
                    {customerOrders.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-slate-300 text-slate-800 rounded-full text-[10px] font-black">
                            {customerOrders.length}
                        </span>
                    )}
                </button>

                {/* Botón Despachos y Rutas */}
                <button
                    type="button"
                    onClick={() => navigate('/industrial/despachos')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-slate-800 text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all"
                >
                    <Truck className="w-4 h-4 text-indigo-200" />
                    <span className="hidden sm:inline">Despachos y Rutas</span>
                    <span className="sm:hidden">Despachos</span>
                </button>


                {/* Botón Planificador de Materia Prima (MRP) */}
                <button
                    type="button"
                    onClick={() => setIsPlannerModalOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-md shadow-amber-200 hover:brightness-105 active:scale-95 transition-all"
                >
                    <Boxes className="w-4 h-4 text-amber-100" />
                    <span className="hidden sm:inline">Planificador Materia Prima</span>
                    <span className="sm:hidden">Planificador MP</span>
                </button>

                {/* Botón Nueva Producción */}
                <button
                    type="button"
                    onClick={() => handleOpenCreateModal()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 active:scale-95 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    <span>Nueva Producción</span>
                </button>
            </div>
        </div>

        {/* TARJETAS KPI DE RESUMEN OPERATIVO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Lotes Programados</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-extrabold text-slate-900">{filteredProductions.length}</span>
                    <span className="text-[11px] text-slate-500 font-medium">corridas</span>
                </div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Volumen Estimado</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-extrabold text-indigo-600">{totalScheduledLbs.toLocaleString()}</span>
                    <span className="text-[11px] text-slate-500 font-medium">Lbs</span>
                </div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Preparación / Roles</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-extrabold text-emerald-600">{totalTasksCount.done}</span>
                    <span className="text-xs text-slate-500">/ {totalTasksCount.total} listas</span>
                </div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Demanda Pendiente</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-extrabold text-amber-600">
                        {suggestionsData?.kpis?.pending_orders_count || customerOrders.length}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">pedidos</span>
                </div>
            </div>
        </div>
    </div>);
}
