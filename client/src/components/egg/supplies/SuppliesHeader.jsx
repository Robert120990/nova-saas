import {
    Boxes,
    Plus,
    ArrowUpDown,
    RefreshCw,
    FileText,
    FileSpreadsheet
} from 'lucide-react';

export default function SuppliesHeader({ model, embedded = false }) {
    const {
        summary,
        openNewSupplyModal,
        openMovementModal,
        syncCostingMutation,
        handleOpenReportPdf,
        handleExportExcel
    } = model;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
                    <Boxes className="h-6 w-6" />
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className={`${embedded ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-bold text-slate-900 tracking-tight`}>
                            Inventario de Insumos de Planta Industrial
                        </h1>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase">
                            {summary.total_items} Insumos
                        </span>
                    </div>
                    <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                        Control de existencias, stock mínimo, kárdex de entradas/salidas y valorización de Material de Empaque, Aditivos y Químicos CIP.
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={handleOpenReportPdf}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Ver e imprimir Reporte Oficial de Inventario de Insumos en PDF"
                >
                    <FileText size={14} />
                    <span>PDF</span>
                </button>

                <button
                    type="button"
                    onClick={handleExportExcel}
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Exportar Inventario Valorizado de Insumos a Excel"
                >
                    <FileSpreadsheet size={14} />
                    <span>Excel</span>
                </button>

                <button
                    type="button"
                    onClick={() => syncCostingMutation.mutate()}
                    disabled={syncCostingMutation.isPending}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Sincronizar catálogo y costos unitarios con Costeo por Libra"
                >
                    <RefreshCw size={14} className={syncCostingMutation.isPending ? 'animate-spin' : ''} />
                    <span>Sincronizar Costeo</span>
                </button>

                <button
                    type="button"
                    onClick={() => openMovementModal(null, 'entrada_compra')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                    <ArrowUpDown size={14} />
                    <span>Registrar Entrada / Salida</span>
                </button>

                <button
                    type="button"
                    onClick={openNewSupplyModal}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                    <Plus size={14} />
                    <span>Nuevo Insumo</span>
                </button>
            </div>
        </div>
    );
}
