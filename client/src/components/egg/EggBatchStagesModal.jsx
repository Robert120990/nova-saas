import {
    Layers, XCircle, FileText, FileSpreadsheet, FileCheck,
    Plus, AlertOctagon, CheckCircle2, ChevronRight
} from 'lucide-react';

const EggBatchStagesModal = ({
    isOpen,
    onClose,
    stagesModal,
    onOpenAddTarimas,
    onOpenPasteurize,
    onOpenRemanente,
    onNavigateEmpaque,
    onOpenWastes,
    onExportSummary
}) => {
    if (!isOpen || !stagesModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col text-slate-900 overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl">
                            <Layers size={22} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">
                                Visualizador y Control de Etapas de Producción
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                                <span>Lote: <b className="text-indigo-600">{stagesModal.batch?.batch_code_display || stagesModal.batch?.batch_uuid}</b></span>
                                <span>•</span>
                                <span className="capitalize">{stagesModal.batch?.product_type} ({stagesModal.batch?.presentation})</span>
                                <span>•</span>
                                <span className="font-bold text-teal-700">{parseFloat(stagesModal.batch?.input_weight_lbs || 0).toLocaleString()} Lbs Entrantes</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {stagesModal.loading ? (
                        <div className="p-12 text-center text-slate-500 text-xs font-medium animate-pulse">
                            Cargando flujo y balance de etapas...
                        </div>
                    ) : (
                        <>
                            {/* 4 Etapas Stepper / Timeline */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* ETAPA 1: QUEBRAJE */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 1: Quebraje
                                            </span>
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Activa / Procesada" />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">Entrada & Quebrado</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>Total: <b className="text-slate-900">{parseFloat(stagesModal.data?.batch?.input_weight_lbs || 0).toLocaleString()} Lbs</b></div>
                                            <div>Materia Prima: <span className="font-medium">{stagesModal.data?.raw_materials?.length || 0} ingresos</span></div>
                                            <div>Tarimas: <span className="font-medium text-indigo-700">{stagesModal.data?.tarimas?.length || 0} tarimas</span></div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onOpenAddTarimas && onOpenAddTarimas(stagesModal.batch)}
                                        className="mt-4 w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <Plus size={13} />
                                        + Agregar Tarimas
                                    </button>
                                </div>

                                {/* ETAPA 2: PASTEURIZADO */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 2: Pasteurización
                                            </span>
                                            <span className={`w-2.5 h-2.5 rounded-full ${stagesModal.data?.batch?.status === 'pasteurizado' || stagesModal.data?.batch?.status === 'empaquetado' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">Tratamiento Térmico</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>Estado: <b className="capitalize text-slate-900">{stagesModal.data?.batch?.status?.replace('_', ' ')}</b></div>
                                            {stagesModal.data?.pasteurize_log ? (
                                                <>
                                                    <div>Temp: <b>{stagesModal.data.pasteurize_log.temperature_c}°C</b></div>
                                                    <div>Tiempo: <b>{stagesModal.data.pasteurize_log.holding_time_seconds}s</b></div>
                                                </>
                                            ) : (
                                                <div className="text-amber-700 text-[11px] font-medium italic">Pendiente de pasteurizar</div>
                                            )}
                                        </div>
                                    </div>
                                    {stagesModal.data?.batch?.status === 'en_proceso' || stagesModal.data?.batch?.status === 'creado' ? (
                                        <button
                                            type="button"
                                            onClick={() => onOpenPasteurize && onOpenPasteurize(stagesModal.batch)}
                                            className="mt-4 w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                        >
                                            <CheckCircle2 size={13} />
                                            Pasteurizar Lote
                                        </button>
                                    ) : (
                                        <div className="mt-4 py-1 text-center text-[11px] text-emerald-700 font-bold bg-emerald-50 rounded-lg">
                                            ✓ Pasteurizado
                                        </div>
                                    )}
                                </div>

                                {/* ETAPA 3: REMANENTES & SOBRANTES */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 3: Remanentes
                                            </span>
                                            <span className={`w-2.5 h-2.5 rounded-full ${stagesModal.data?.remanentes?.length > 0 ? 'bg-teal-500' : 'bg-slate-300'}`} />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">Sobrantes / Tanque</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>Remanentes: <b className="text-teal-700">{stagesModal.data?.remanentes?.length || 0} registrados</b></div>
                                            <div>Total Sobrante: <b>{stagesModal.data?.remanentes?.reduce((acc, r) => acc + parseFloat(r.weight_lbs || 0), 0).toFixed(1)} Lbs</b></div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onOpenRemanente && onOpenRemanente(stagesModal.batch)}
                                        className="mt-4 w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <Plus size={13} />
                                        Registrar Remanente
                                    </button>
                                </div>

                                {/* ETAPA 4: EMPAQUE FINAL */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 4: Empaque
                                            </span>
                                            <span className={`w-2.5 h-2.5 rounded-full ${parseFloat(stagesModal.data?.batch?.packaged_weight_lbs || 0) > 0 ? 'bg-purple-600' : 'bg-slate-300'}`} />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">Envasado</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>Rendimiento: <b>{parseFloat(stagesModal.data?.batch?.yield_liquid_lbs || 0).toLocaleString()} Lbs</b></div>
                                            <div>Envasado: <b className="text-purple-700">{parseFloat(stagesModal.data?.batch?.packaged_weight_lbs || 0).toLocaleString()} Lbs</b></div>
                                            {stagesModal.data?.batch?.packaging_efficiency_pct && (
                                                <div className="text-[11px] font-bold text-emerald-700">
                                                    Eficiencia: {stagesModal.data.batch.packaging_efficiency_pct}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onNavigateEmpaque}
                                        className="mt-4 w-full py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        Ir a Empaque
                                        <ChevronRight size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Detalle de Remanentes Registrados */}
                            {stagesModal.data?.remanentes?.length > 0 && (
                                <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                                        Remanentes de Producto Registrados en este Lote
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                                    <th className="py-1.5">Código</th>
                                                    <th className="py-1.5">Producto</th>
                                                    <th className="py-1.5 text-right">Peso (Lbs)</th>
                                                    <th className="py-1.5 text-center">Térmico</th>
                                                    <th className="py-1.5">Destino</th>
                                                    <th className="py-1.5">Notas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {stagesModal.data.remanentes.map(r => (
                                                    <tr key={r.id}>
                                                        <td className="py-2 font-mono font-bold text-teal-800">{r.remanente_code}</td>
                                                        <td className="py-2 capitalize font-medium">{r.product_type}</td>
                                                        <td className="py-2 text-right font-bold text-teal-700">{parseFloat(r.weight_lbs).toFixed(1)} Lbs</td>
                                                        <td className="py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.is_pasteurized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                {r.is_pasteurized ? 'Pasteurizado' : 'Sin Pasteurizar'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 capitalize text-slate-700">{r.destination?.replace('_', ' ')}</td>
                                                        <td className="py-2 text-slate-500 italic text-[11px]">{r.notes || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Resumen de Mermas de Producción */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <AlertOctagon size={14} className="text-rose-600" />
                                        Mermas y Pérdidas del Lote
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => onOpenWastes && onOpenWastes(stagesModal.batch)}
                                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        + Registrar Merma
                                    </button>
                                </div>
                                {stagesModal.data?.wastes?.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                                    <th className="py-1.5">Etapa</th>
                                                    <th className="py-1.5">Tipo Merma</th>
                                                    <th className="py-1.5 text-right">Peso (Lbs)</th>
                                                    <th className="py-1.5">Registrado Por</th>
                                                    <th className="py-1.5">Notas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {stagesModal.data.wastes.map(w => (
                                                    <tr key={w.id}>
                                                        <td className="py-2 capitalize font-semibold text-slate-800">{w.stage}</td>
                                                        <td className="py-2 capitalize text-rose-700 font-bold">{w.waste_type?.replace('_', ' ')}</td>
                                                        <td className="py-2 text-right font-black text-slate-900">{parseFloat(w.weight_lbs).toFixed(1)} Lbs</td>
                                                        <td className="py-2 text-slate-600">{w.operator_name || '-'}</td>
                                                        <td className="py-2 text-slate-500 italic text-[11px]">{w.notes || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No se han registrado mermas extraordinarias para este lote.</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Exportar Resumen:</span>
                        <button
                            type="button"
                            onClick={() => onExportSummary && onExportSummary(stagesModal.batch?.id, 'pdf')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                        >
                            <FileText size={13} />
                            PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => onExportSummary && onExportSummary(stagesModal.batch?.id, 'excel')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                        >
                            <FileSpreadsheet size={13} />
                            Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => onExportSummary && onExportSummary(stagesModal.batch?.id, 'word')}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                        >
                            <FileCheck size={13} />
                            Word (.docx)
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EggBatchStagesModal;
