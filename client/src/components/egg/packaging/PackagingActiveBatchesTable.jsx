import { useState } from 'react';
import { Boxes, Plus, Lock, Eye, EyeOff, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

export default function PackagingActiveBatchesTable({
    batches,
    canClosePackaging,
    setPackagingForm,
    setIsNewPackagingModalOpen,
    setCloseBatchModal,
    setQualityModal,
    handleReopenBatchPackaging
}) {
    const [filterTab, setFilterTab] = useState('activos'); // 'activos' | 'cerrados' | 'todos'
    const [isCollapsed, setIsCollapsed] = useState(false);

    const activeBatches = (Array.isArray(batches) ? batches : []).filter(
        b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad'
    );

    if (activeBatches.length === 0) return null;

    const inProgressBatches = activeBatches.filter(b => b.packaging_status !== 'cerrado');
    const closedBatches = activeBatches.filter(b => b.packaging_status === 'cerrado');

    const displayedBatches = filterTab === 'activos'
        ? inProgressBatches
        : filterTab === 'cerrados'
            ? closedBatches
            : activeBatches;

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 shadow-2xs">
            {/* Header con Pestañas y Control de Ocultar/Expandir */}
            <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <Boxes size={15} className="text-purple-600" />
                        Lotes en Etapa de Envasado
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500">
                        ({displayedBatches.length})
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Selector de Pestañas */}
                    <div className="inline-flex p-0.5 bg-slate-200/80 rounded-xl gap-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setFilterTab('activos')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                                filterTab === 'activos'
                                    ? 'bg-white text-indigo-700 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>⚡ En Proceso</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                filterTab === 'activos' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-300/70 text-slate-700'
                            }`}>
                                {inProgressBatches.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('cerrados')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                                filterTab === 'cerrados'
                                    ? 'bg-white text-purple-700 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>🔒 Cerrados / Saldo 0</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                filterTab === 'cerrados' ? 'bg-purple-100 text-purple-800' : 'bg-slate-300/70 text-slate-700'
                            }`}>
                                {closedBatches.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('todos')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                                filterTab === 'todos'
                                    ? 'bg-white text-slate-800 shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Todos</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                filterTab === 'todos' ? 'bg-slate-200 text-slate-800' : 'bg-slate-300/70 text-slate-700'
                            }`}>
                                {activeBatches.length}
                            </span>
                        </button>
                    </div>

                    {/* Botón para ocultar/mostrar panel completo */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="px-2 py-1 hover:bg-slate-200/80 rounded-lg text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                        title={isCollapsed ? "Expandir tabla de lotes" : "Ocultar tabla de lotes para mayor espacio"}
                    >
                        {isCollapsed ? (
                            <>
                                <Eye size={13} className="text-indigo-600" />
                                <span className="hidden sm:inline">Mostrar</span>
                                <ChevronDown size={14} />
                            </>
                        ) : (
                            <>
                                <EyeOff size={13} />
                                <span className="hidden sm:inline">Ocultar</span>
                                <ChevronUp size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Contenido de la Tabla (Colapsable) */}
            {!isCollapsed && (
                <>
                    {displayedBatches.length === 0 ? (
                        <div className="py-8 px-4 text-center bg-white">
                            <div className="inline-flex p-2.5 rounded-full bg-emerald-50 text-emerald-600 mb-2">
                                <CheckCircle2 size={22} />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                {filterTab === 'activos'
                                    ? 'No hay lotes con envasado pendiente'
                                    : 'No hay lotes cerrados en esta etapa'}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                                {filterTab === 'activos'
                                    ? 'Todos los lotes pasteurizados están completados o cerrados con saldo en cero.'
                                    : 'Los lotes finalizados y cerrados técnicamente aparecerán aquí.'}
                            </p>
                            {filterTab === 'activos' && closedBatches.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('cerrados')}
                                    className="mt-3 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs"
                                >
                                    <Lock size={12} />
                                    Ver Lotes Cerrados / Saldo 0 ({closedBatches.length})
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-white text-slate-500 font-bold uppercase text-[10px]">
                                        <th className="px-3 py-2">Lote</th>
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2 text-right">Rendimiento Líq.</th>
                                        <th className="px-3 py-2 text-right">Envasado</th>
                                        <th className="px-3 py-2 text-right">Saldo Disp.</th>
                                        <th className="px-3 py-2 text-center">Estado Empaque</th>
                                        <th className="px-3 py-2 text-center">Calidad FQ/MB</th>
                                        <th className="px-3 py-2 text-center">Eficiencia</th>
                                        <th className="px-3 py-2 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                                    {displayedBatches.map(b => {
                                        const packaged = parseFloat(b.packaged_weight_lbs || 0);
                                        const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
                                        const pending = Math.max(0, yieldLbs - packaged);
                                        const isClosed = b.packaging_status === 'cerrado';

                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2 font-mono font-bold text-slate-900">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span>{b.batch_code_display || b.batch_uuid}</span>
                                                        {b.is_coproduct ? (
                                                            <span className="px-1.5 py-0.5 text-[9px] bg-purple-100 text-purple-700 font-bold rounded border border-purple-200" title="Co-producto derivado">
                                                                🔗 Co-Prod
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 capitalize font-medium text-slate-700">
                                                    {b.product_type}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-teal-700">
                                                    {yieldLbs.toLocaleString()} Lbs
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-indigo-700">
                                                    {packaged.toLocaleString()} Lbs
                                                </td>
                                                <td className="px-3 py-2 text-right font-black">
                                                    <span className={pending > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                                        {pending.toLocaleString()} Lbs
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        isClosed
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {isClosed ? 'Cerrado' : 'Abierto'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQualityModal({ isOpen: true, batch: b })}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                            b.status === 'aprobado_calidad'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : b.status === 'bloqueado_haccp'
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}
                                                        title="Ver o evaluar control de calidad FQ / MB"
                                                    >
                                                        {b.status === 'aprobado_calidad' ? 'Liberado' : b.status === 'bloqueado_haccp' ? 'Bloqueado' : 'Cuarentena'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 text-center font-bold text-slate-700">
                                                    {b.packaging_efficiency_pct ? `${b.packaging_efficiency_pct}%` : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {!isClosed ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPackagingForm(prev => ({
                                                                            ...prev,
                                                                            batch_id: String(b.id),
                                                                            product_type: (b.product_type || 'huevo entero').toLowerCase()
                                                                        }));
                                                                        setIsNewPackagingModalOpen(true);
                                                                    }}
                                                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                >
                                                                    <Plus size={11} />
                                                                    Envasar
                                                                </button>
                                                                {canClosePackaging && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCloseBatchModal({ isOpen: true, batch: b, notes: '', isSubmitting: false })}
                                                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                        title="Cerrar Envasado y Computar Mermas Técnicas"
                                                                    >
                                                                        <Lock size={11} />
                                                                        Cerrar
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenBatchPackaging(b)}
                                                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                title="Reabrir Envasado para agregar más cubetas o corregir"
                                                            >
                                                                <Lock size={11} className="text-purple-600" />
                                                                Reabrir
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
