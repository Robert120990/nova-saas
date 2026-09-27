import { formatDateTime } from '../../../../utils/dateUtils';
import { toast } from 'sonner';
import {
    Flame,
    Copy,
    Search,
    ClipboardList,
    AlertOctagon,
    Lock,
    Layers,
    Trash2,
    Pencil,
    Download,
    FileSpreadsheet,
    FileText,
    FileCheck,
    Scale,
    FlaskConical
} from 'lucide-react';


export default function ProductionBatchesTab({ model }) {
    const { setQualityModal, openExportMenuId, setOpenExportMenuId, loading, searchTerm, setSearchTerm, activeTab, setSelectedBatchForPasteurize, setIsPasteurizeModalOpen, canEditProduction, canDeleteProduction, canManageLots, setDeleteConfirmBatch, handleOpenStagesModal, handleOpenClosePasteurization, handleReopenPasteurization, handleOpenBalanceModal, handleOpenWastesModal, handleOpenEditBatch, handleExportSummary, getBatchStatusBadge, filteredBatches } = model;

    return (<>{activeTab === 'batches' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-indigo-600" />
                            Historial de Procesamiento por Lotes
                        </h2>
                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder="Buscar por lote, producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                            />
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        </div>
                    </div>
                    <div className="h-px bg-slate-100" />

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-medium animate-pulse">
                                Cargando lotes de producción...
                            </div>
                        ) : filteredBatches.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-medium">
                                No hay lotes de producción registrados.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="px-3 py-2.5">Lote Juliano / UUID</th>
                                        <th className="px-3 py-2.5">Producto</th>
                                        <th className="px-3 py-2.5">Presentación</th>
                                        <th className="px-3 py-2.5 text-right">Peso Entrada</th>
                                        <th className="px-3 py-2.5 text-right">Rendimiento</th>
                                        <th className="px-3 py-2.5 text-right">Disponible</th>
                                        <th className="px-3 py-2.5 text-center">Estado</th>
                                        <th className="px-3 py-2.5 min-w-[180px]">Inicio / Fin</th>
                                        <th className="px-3 py-2.5 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {(Array.isArray(filteredBatches) ? filteredBatches : []).map(b => (
                                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col gap-0.5">
                                                    {b.batch_code_display ? (
                                                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg w-fit">
                                                            {b.batch_code_display}
                                                        </span>
                                                    ) : null}
                                                    {b.pasteurization_status === 'cerrado' ? (
                                                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1" title={`Pasteurización Cerrada: ${b.pasteurization_lot || ''}`}>
                                                            <Lock size={10} />
                                                            Past: {b.pasteurization_lot || 'Cerrado'}
                                                        </span>
                                                    ) : b.pasteurization_lot ? (
                                                        <span className="bg-amber-50 border border-amber-200 text-amber-700 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1">
                                                            Past: {b.pasteurization_lot}
                                                        </span>
                                                    ) : null}
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-mono text-[10px] text-slate-500 select-all truncate max-w-[180px]">{b.batch_uuid}</span>
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(b.batch_code_display || b.batch_uuid); toast.success('Lote copiado'); }}
                                                            className="p-0.5 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors flex-shrink-0"
                                                            title="Copiar Lote"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-slate-900 text-xs capitalize flex items-center gap-1.5">
                                                    <span>{b.product_type}</span>
                                                    {b.scheduled_lot_code && (
                                                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded" title="Originado en Calendario de Producción">
                                                            Prog: {b.scheduled_lot_code}
                                                        </span>
                                                    )}
                                                </div>
                                                {b.raw_materials && b.raw_materials.length > 0 && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5 space-y-0.5">
                                                        {(Array.isArray(b.raw_materials) ? b.raw_materials : []).map((m, mi) => (
                                                            <div key={mi}>
                                                                <span>{m.egg_type} - {parseFloat(m.quantity_lbs).toFixed(0)} Lbs{m.boxes_count > 0 ? ` (${m.boxes_count} cjs)` : ''}</span>
                                                                {Array.isArray(m.tarimas) && m.tarimas.length > 0 && (
                                                                    <div className="text-[9px] text-indigo-600 font-medium pl-1">
                                                                        Tarimas: {(Array.isArray(m.tarimas) ? m.tarimas : []).map(t => `#${t.tarima_number || 1} (${t.boxes_count || 0}cjs - ${parseFloat(t.quantity_lbs || 0).toFixed(0)}Lbs)`).join(', ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-slate-600 text-xs">{b.presentation}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-900 font-bold text-xs">{parseFloat(b.input_weight_lbs).toLocaleString()} Lbs</td>
                                            <td className="px-3 py-2.5 text-right text-teal-700 font-bold text-xs">
                                                {b.yield_liquid_lbs > 0 ? `${parseFloat(b.yield_liquid_lbs).toLocaleString()} Lbs` : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-xs">
                                                {b.yield_liquid_lbs > 0 ? (
                                                    <span className={Math.max(0, parseFloat(b.yield_liquid_lbs) - parseFloat(b.packaged_weight_lbs || 0)) > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                                        {Math.max(0, parseFloat(b.yield_liquid_lbs) - parseFloat(b.packaged_weight_lbs || 0)).toLocaleString()} Lbs
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setQualityModal({ isOpen: true, batch: b })}
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${getBatchStatusBadge(b.status)}`}
                                                    title="Haga clic para ver o evaluar dictamen de calidad FQ & MB"
                                                >
                                                    {b.status}
                                                </button>
                                            </td>
                                            <td className="px-3 py-2.5 text-[10px] text-slate-600 space-y-0.5 min-w-[180px]">
                                                <div>
                                                    <span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Iniciado:</span>
                                                    {formatDateTime(b.started_at)}
                                                </div>
                                                {b.completed_at && (
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Finalizado:</span>
                                                        {formatDateTime(b.completed_at)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    {/* Control de Calidad FQ / MB */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setQualityModal({ isOpen: true, batch: b })}
                                                        className={`p-1.5 rounded-lg border transition-colors shadow-xs ${
                                                            b.status === 'aprobado_calidad'
                                                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                                                : b.status === 'bloqueado_haccp'
                                                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                                                : 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
                                                        }`}
                                                        title="Control de Calidad LAB-004 (FQ & MB) y Liberación"
                                                    >
                                                        <FlaskConical size={13} />
                                                    </button>

                                                    {/* Visualizador de Etapas */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenStagesModal(b)}
                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                        title="Visualizador de Etapas Cumplidas del Proceso (Quebraje, Pasteurización, Remanentes, Envasado, Calidad)"
                                                    >
                                                        <Layers size={13} />
                                                    </button>

                                                    {/* Mermas */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenWastesModal(b)}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                        title="Registrar y Consultar Mermas del Lote"
                                                    >
                                                        <AlertOctagon size={13} />
                                                    </button>

                                                    {/* Exportar Resumen (PDF, Excel, Word) */}
                                                    <div className="relative inline-block">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenExportMenuId(openExportMenuId === b.id ? null : b.id)}
                                                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors shadow-xs flex items-center gap-0.5"
                                                            title="Exportar Resumen de Producción (PDF, Excel, Word)"
                                                        >
                                                            <Download size={13} />
                                                        </button>
                                                        {openExportMenuId === b.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-30"
                                                                    onClick={() => setOpenExportMenuId(null)}
                                                                />
                                                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40 flex flex-col gap-1 min-w-[130px] text-left animate-in fade-in duration-100">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleExportSummary(b.id, 'pdf');
                                                                            setOpenExportMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-rose-50 rounded-lg text-[11px] font-bold text-rose-700 w-full"
                                                                    >
                                                                        <FileText size={12} />
                                                                        PDF
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleExportSummary(b.id, 'excel');
                                                                            setOpenExportMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-emerald-50 rounded-lg text-[11px] font-bold text-emerald-700 w-full"
                                                                    >
                                                                        <FileSpreadsheet size={12} />
                                                                        Excel (.xlsx)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleExportSummary(b.id, 'word');
                                                                            setOpenExportMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-blue-50 rounded-lg text-[11px] font-bold text-blue-700 w-full"
                                                                    >
                                                                        <FileCheck size={12} />
                                                                        Word (.docx)
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Balance de Masas */}
                                                    {b.status !== 'creado' && b.status !== 'bloqueado_haccp' && (
                                                        <button
                                                            onClick={() => handleOpenBalanceModal(b)}
                                                            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1"
                                                            title="Editar Balance de Masas"
                                                        >
                                                            <Scale size={12} />
                                                            Balance
                                                        </button>
                                                    )}

                                                    {/* Pasteurizar si en_proceso */}
                                                    {b.status === 'en_proceso' && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBatchForPasteurize(b.id);
                                                                setIsPasteurizeModalOpen(true);
                                                            }}
                                                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs"
                                                            title="Iniciar Pasteurización"
                                                        >
                                                            <Flame size={12} />
                                                            Pasteurizar
                                                        </button>
                                                    )}

                                                    {/* Cerrar / Reabrir Pasteurización */}
                                                    {b.pasteurization_status === 'cerrado' ? (
                                                        canManageLots && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenPasteurization(b)}
                                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                                                                title="Reabrir Pasteurización (Permite volver a agregar tarimas o ajustar registros)"
                                                            >
                                                                <Lock size={11} className="text-amber-600" />
                                                                Reabrir Past.
                                                            </button>
                                                        )
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenClosePasteurization(b)}
                                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                                                            title="Cerrar Pasteurización y Fijar Lote Térmico Oficial"
                                                        >
                                                            <Lock size={11} className="text-emerald-600" />
                                                            Cerrar Past.
                                                        </button>
                                                    )}

                                                    {/* Editar Lote (Abre la pantalla completa de producción) */}
                                                    {canEditProduction && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditBatch(b)}
                                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shadow-xs"
                                                            title="Editar Lote de Producción (Abrir pantalla de producción)"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}

                                                    {/* Eliminar Lote */}
                                                    {canDeleteProduction && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteConfirmBatch(b)}
                                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                            title="Eliminar Lote de Producción y Revertir Materia Prima"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}

                                                    {b.status === 'bloqueado_haccp' && (
                                                        <span className="text-rose-600 font-bold text-xs flex items-center justify-center gap-1">
                                                            <Lock size={12} />
                                                            Bloqueado
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}</>);
}
