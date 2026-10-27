import {
    CalendarRange,
    FileText,
    FileSpreadsheet,
    Scissors,
    Calculator,
    Lock,
    Unlock,
    CheckCircle2,
    User
} from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

export default function ContainersCutoffBar({ model }) {
    const {
        summary,
        cutoffChain,
        periodStart,
        setPeriodStart,
        periodEnd,
        setPeriodEnd,
        periodSpanDays,
        lockToLastCutoff,
        setLockToLastCutoff,
        customerName,
        setCustomerName,
        handleSyncPeriodDays,
        handleOpenStatementPdf,
        handleExportStatementExcel,
        setCutoffModalOpen,
        isMutating
    } = model;

    const hasPrev = Boolean(cutoffChain?.has_previous_cutoff);

    return (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white border border-indigo-800/60 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            {/* Fila Superior: Información del Último Corte y Continuidad */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shrink-0">
                        <CalendarRange className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white">
                                Estado de Cuenta al Cliente • Corte por Fechas
                            </h2>
                            {hasPrev ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase flex items-center gap-1">
                                    <CheckCircle2 size={11} />
                                    Último Corte: {cutoffChain.last_cutoff_code} ({formatDate(cutoffChain.last_cutoff_date)})
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase">
                                    Primer Corte (Sin cortes previos)
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-indigo-200 font-medium mt-0.5">
                            {hasPrev ? (
                                <>
                                    El nuevo corte parte automáticamente desde el último corte realizado el{' '}
                                    <span className="font-extrabold text-cyan-300 underline decoration-cyan-400/50">
                                        {formatDate(cutoffChain.last_cutoff_date)}
                                    </span>
                                    {cutoffChain.last_cutoff_total > 0 && (
                                        <span className="text-slate-300">
                                            {' '}• Liquidación anterior: <Money value={cutoffChain.last_cutoff_total} className="text-emerald-300 font-bold" />
                                        </span>
                                    )}
                                </>
                            ) : (
                                'Seleccione el rango de fechas inicial para emitir el primer Estado de Cuenta. Los siguientes cortes partirán automáticamente desde la fecha del último corte.'
                            )}
                        </p>
                    </div>
                </div>

                {/* Botones de Vista Previa PDF, Excel y Realizar Corte */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => handleOpenStatementPdf()}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Ver e imprimir vista previa del Estado de Cuenta del período actual"
                    >
                        <FileText size={14} className="text-cyan-300" />
                        <span>Vista Previa PDF</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExportStatementExcel()}
                        className="px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-400/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Descargar Estado de Cuenta en Excel"
                    >
                        <FileSpreadsheet size={14} />
                        <span>Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setCutoffModalOpen(true)}
                        disabled={isMutating}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                        <Scissors size={14} />
                        <span>Realizar Corte por Fechas</span>
                    </button>
                </div>
            </div>

            {/* Fila Inferior: Controles de Fechas Encadenadas, Cliente y Cálculo de Días */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                {/* 1. Fecha Desde (Anclada al último corte) */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">
                            Desde (Último Corte)
                        </label>
                        {hasPrev && (
                            <button
                                type="button"
                                onClick={() => {
                                    const nextLock = !lockToLastCutoff;
                                    setLockToLastCutoff(nextLock);
                                    if (nextLock && cutoffChain.next_period_start) {
                                        setPeriodStart(cutoffChain.next_period_start);
                                    }
                                }}
                                className="text-[10px] font-bold text-cyan-300 hover:text-white flex items-center gap-1 cursor-pointer"
                                title={
                                    lockToLastCutoff
                                        ? 'Anclado automáticamente al último corte. Clic para desbloquear manualmente.'
                                        : 'Desbloqueado. Clic para volver a fijar al último corte.'
                                }
                            >
                                {lockToLastCutoff ? <Lock size={10} /> : <Unlock size={10} />}
                                <span>{lockToLastCutoff ? 'Fijo al último corte' : 'Manual'}</span>
                            </button>
                        )}
                    </div>
                    <input
                        type="date"
                        value={periodStart}
                        disabled={hasPrev && lockToLastCutoff}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold border focus:outline-none ${
                            hasPrev && lockToLastCutoff
                                ? 'bg-slate-800/90 border-cyan-500/40 text-cyan-200 cursor-not-allowed'
                                : 'bg-white text-slate-900 border-slate-300'
                        }`}
                    />
                </div>

                {/* 2. Fecha Hasta (Fecha de Nuevo Corte) */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">
                            Hasta (Fecha de Corte)
                        </label>
                        <span className="text-[10px] font-extrabold text-amber-300">
                            {periodSpanDays} {periodSpanDays === 1 ? 'día en rango' : 'días en rango'}
                        </span>
                    </div>
                    <input
                        type="date"
                        min={periodStart}
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white text-slate-900 border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                </div>

                {/* 3. Cliente / Destinatario del Estado de Cuenta */}
                <div>
                    <label className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <User size={11} />
                        <span>Cliente (Estado de Cuenta)</span>
                    </label>
                    <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nombre del cliente..."
                        className="w-full px-3 py-2 rounded-xl bg-white/10 text-white placeholder-slate-400 border border-white/20 text-xs font-medium focus:outline-none focus:bg-white/15 focus:border-cyan-400"
                    />
                </div>

                {/* 4. Acción Rápida: Sincronizar Días de Contenedores Encendidos con el Rango de Fechas */}
                <div>
                    <button
                        type="button"
                        onClick={() => handleSyncPeriodDays(true)}
                        disabled={isMutating || summary.active_count === 0}
                        className="w-full px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 text-cyan-200 border border-cyan-400/40 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        title="Asignar automáticamente los días transcurridos del rango de corte a los contenedores encendidos"
                    >
                        <Calculator size={14} />
                        <span>
                            Aplicar {periodSpanDays}d a Encendidos ({summary.active_count})
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
