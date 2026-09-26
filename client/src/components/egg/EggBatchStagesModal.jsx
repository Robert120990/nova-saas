import {
    Layers, XCircle, FileText, FileSpreadsheet, FileCheck,
    Plus, AlertOctagon, CheckCircle2, ChevronRight, Pencil, Trash2, Scale,
    Lock, Boxes, FlaskConical
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const EggBatchStagesModal = ({
    isOpen,
    onClose,
    stagesModal,
    canManageLots = false,
    onClosePasteurization,
    onReopenPasteurization,
    onReopenPackaging,
    onOpenAddTarimas,
    onOpenPasteurize,
    onOpenBalance,
    onOpenRemanente,
    onOpenEditRemanente,
    onDeleteRemanente,
    onNavigateEmpaque,
    onOpenWastes,
    onOpenEditWaste,
    handleDeleteWaste,
    onDeleteWaste,
    onExportSummary,
    onOpenQualityEvaluation
}) => {
    if (!isOpen || !stagesModal) return null;

    const tarimasUsedList = stagesModal.data?.tarimasUsed || stagesModal.data?.tarimas || [];
    const remanentesUsedList = stagesModal.data?.remanentes_used || stagesModal.data?.remanentesUsed || [];
    const remanentesGeneratedList = stagesModal.data?.remanentes || [];
    const wastesList = stagesModal.data?.wastes || [];
    const isPastClosed = stagesModal.data?.batch?.pasteurization_status === 'cerrado';
    const isPkgClosed = stagesModal.data?.batch?.packaging_status === 'cerrado';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col text-slate-900 overflow-hidden">
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
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium flex-wrap">
                                <span>Lote: <b className="text-indigo-600">{stagesModal.batch?.batch_code_display || stagesModal.batch?.batch_uuid}</b></span>
                                <span>•</span>
                                <span className="capitalize">{stagesModal.batch?.product_type} ({stagesModal.batch?.presentation})</span>
                                <span>•</span>
                                <span className="font-bold text-teal-700">{parseFloat(stagesModal.batch?.input_weight_lbs || 0).toLocaleString()} Lbs Entrantes</span>
                                {stagesModal.batch?.pasteurization_lot && (
                                    <>
                                        <span>•</span>
                                        <span className="font-mono text-amber-700 font-bold">Past: {stagesModal.batch.pasteurization_lot}</span>
                                    </>
                                )}
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
                            {/* 5 Etapas Stepper / Timeline */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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
                                            <div>Tarimas: <span className="font-medium text-indigo-700">{tarimasUsedList.length} tarimas</span></div>
                                            {isPastClosed && (
                                                <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 pt-1">
                                                    <Lock size={10} /> Quebraje cerrado por pasteurización
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isPastClosed && !canManageLots}
                                        onClick={() => {
                                            if (isPastClosed && !canManageLots) return;
                                            onOpenAddTarimas && onOpenAddTarimas(stagesModal.batch);
                                        }}
                                        className={`mt-4 w-full py-1.5 px-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs ${
                                            isPastClosed && !canManageLots
                                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        }`}
                                    >
                                        <Plus size={13} />
                                        + Agregar Tarimas {isPastClosed ? '(Bloqueado)' : ''}
                                    </button>
                                </div>

                                {/* ETAPA 2: PASTEURIZADO & BALANCE */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 2: Pasteurización
                                            </span>
                                            <span className={`w-2.5 h-2.5 rounded-full ${stagesModal.data?.batch?.status === 'pasteurizado' || stagesModal.data?.batch?.status === 'empaquetado' || stagesModal.data?.batch?.status === 'aprobado_calidad' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">Tratamiento Térmico</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>Estado: <b className="capitalize text-slate-900">{stagesModal.data?.batch?.status?.replace('_', ' ')}</b></div>
                                            {stagesModal.data?.batch?.pasteurization_lot && (
                                                <div className="font-mono text-amber-800 font-bold text-[11px]">
                                                    Lote: {stagesModal.data.batch.pasteurization_lot}
                                                </div>
                                            )}
                                            {isPastClosed ? (
                                                <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                                                    <Lock size={10} /> Past. Cerrada Oficial
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-amber-700 font-medium">Abierto a modificaciones</div>
                                            )}
                                            {stagesModal.data?.pasteurize_log ? (
                                                <>
                                                    <div>Temp: <b>{stagesModal.data.pasteurize_log.temperature_c}°C</b></div>
                                                    <div>Tiempo: <b>{stagesModal.data.pasteurize_log.holding_time_seconds}s</b></div>
                                                </>
                                            ) : (
                                                <div className="text-amber-700 text-[11px] font-medium italic">Sin registro térmico</div>
                                            )}
                                            {parseFloat(stagesModal.data?.batch?.yield_liquid_lbs || 0) > 0 && (
                                                <div className="text-teal-700 font-bold text-[11px]">
                                                    Líquido: {parseFloat(stagesModal.data.batch.yield_liquid_lbs).toLocaleString()} Lbs
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-col gap-1.5">
                                        <div className="flex gap-1.5">
                                            {(stagesModal.data?.batch?.status === 'en_proceso' || stagesModal.data?.batch?.status === 'creado') ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPasteurize && onOpenPasteurize(stagesModal.batch)}
                                                    className="flex-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                >
                                                    <CheckCircle2 size={13} />
                                                    Pasteurizar
                                                </button>
                                            ) : (
                                                <div className="flex-1 py-1 text-center text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center">
                                                    ✓ Pasteurizado
                                                </div>
                                            )}
                                            {onOpenBalance && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenBalance(stagesModal.batch || stagesModal.data?.batch)}
                                                    className="py-1.5 px-2.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                                                    title="Editar Balance de Masas (Rendimiento Líquido, Cáscara, Merma)"
                                                >
                                                    <Scale size={12} />
                                                    Balance
                                                </button>
                                            )}
                                        </div>
                                        {/* Cerrar / Reabrir Pasteurización */}
                                        {isPastClosed ? (
                                            canManageLots && onReopenPasteurization && (
                                                <button
                                                    type="button"
                                                    onClick={() => onReopenPasteurization(stagesModal.batch || stagesModal.data?.batch)}
                                                    className="w-full py-1 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                >
                                                    <Lock size={11} className="text-amber-600" />
                                                    Reabrir Pasteurización
                                                </button>
                                            )
                                        ) : (
                                            onClosePasteurization && (
                                                <button
                                                    type="button"
                                                    onClick={() => onClosePasteurization(stagesModal.batch || stagesModal.data?.batch)}
                                                    className="w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                >
                                                    <Lock size={11} />
                                                    Cerrar Pasteurización
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* ETAPA 3: REMANENTES & SOBRANTES */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 3: Remanentes
                                            </span>
                                            <span className={`w-2.5 h-2.5 rounded-full ${remanentesGeneratedList.length > 0 ? 'bg-teal-500' : 'bg-slate-300'}`} />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">Sobrantes / Tanque</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>Generados: <b className="text-teal-700">{remanentesGeneratedList.length} reg</b></div>
                                            <div>Total Sobrante: <b>{remanentesGeneratedList.reduce((acc, r) => acc + (parseFloat(r.weight_lbs || r.quantity_lbs || 0)), 0).toFixed(1)} Lbs</b></div>
                                            <div>De otras prod.: <b className="text-indigo-700">{remanentesUsedList.length} reg</b></div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onOpenRemanente && onOpenRemanente(stagesModal.batch)}
                                        className="mt-4 w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                    >
                                        <Plus size={13} />
                                        + Registrar Remanente
                                    </button>
                                </div>

                                {/* ETAPA 4: EMPAQUE FINAL & BALANCE */}
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
                                            <div>Estado: <b className={`capitalize font-bold ${isPkgClosed ? 'text-emerald-700' : 'text-slate-800'}`}>{stagesModal.data?.batch?.packaging_status || 'abierto'}</b></div>
                                            {stagesModal.data?.batch?.packaging_efficiency_pct && (
                                                <div className="text-[11px] font-bold text-emerald-700">
                                                    Eficiencia: {stagesModal.data.batch.packaging_efficiency_pct}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-col gap-1.5">
                                        <div className="flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={onNavigateEmpaque}
                                                className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                            >
                                                Ir a Empaque
                                                <ChevronRight size={13} />
                                            </button>
                                            {onOpenBalance && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenBalance(stagesModal.batch || stagesModal.data?.batch)}
                                                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                                                    title="Editar Balance de Masas"
                                                >
                                                    <Scale size={12} />
                                                    Balance
                                                </button>
                                            )}
                                        </div>
                                        {isPkgClosed && onReopenPackaging && (
                                            <button
                                                type="button"
                                                onClick={() => onReopenPackaging(stagesModal.batch || stagesModal.data?.batch)}
                                                className="w-full py-1 px-2 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                title="Reabrir empaque del lote para modificaciones o nuevos envasados"
                                            >
                                                <Lock size={11} className="text-purple-600" />
                                                Reabrir Empaque
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ETAPA 5: CALIDAD E INOCUIDAD (FQ & MB) */}
                                <div className="border border-slate-200 rounded-xl p-4 bg-teal-50/40 border-teal-200/80 relative flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md text-[10px] font-bold uppercase">
                                                Etapa 5: Calidad (LAB-004)
                                            </span>
                                            <span
                                                className={`w-2.5 h-2.5 rounded-full ${
                                                    stagesModal.data?.batch?.status === 'aprobado_calidad'
                                                        ? 'bg-emerald-500'
                                                        : stagesModal.data?.batch?.status === 'bloqueado_haccp'
                                                        ? 'bg-rose-500'
                                                        : 'bg-amber-400 animate-pulse'
                                                }`}
                                                title={stagesModal.data?.batch?.status === 'aprobado_calidad' ? 'Liberado para Venta' : 'En Cuarentena / Evaluación'}
                                            />
                                        </div>
                                        <h4 className="font-bold text-xs text-slate-800">FQ & Microbiología</h4>
                                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                                            <div>
                                                Dictamen:{' '}
                                                <b className={`capitalize font-bold ${
                                                    stagesModal.data?.batch?.status === 'aprobado_calidad'
                                                        ? 'text-emerald-700'
                                                        : stagesModal.data?.batch?.status === 'bloqueado_haccp'
                                                        ? 'text-rose-700'
                                                        : 'text-amber-700'
                                                }`}>
                                                    {stagesModal.data?.batch?.status === 'aprobado_calidad'
                                                        ? 'Liberado'
                                                        : stagesModal.data?.batch?.status === 'bloqueado_haccp'
                                                        ? 'Bloqueado HACCP'
                                                        : 'En Cuarentena'}
                                                </b>
                                            </div>
                                            {stagesModal.data?.batch?.measured_solids_pct && (
                                                <div>Sólidos: <b>{stagesModal.data.batch.measured_solids_pct}%</b></div>
                                            )}
                                            {stagesModal.data?.batch?.measured_brix && (
                                                <div>Brix: <b>{stagesModal.data.batch.measured_brix}°Bx</b></div>
                                            )}
                                            <div className="text-[10px] text-slate-500 pt-1">
                                                {stagesModal.data?.batch?.status === 'aprobado_calidad'
                                                    ? '✓ Lote 100% conforme para despacho'
                                                    : '⏳ Medición FQ / Incubación MB 48h'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            onClick={() => onOpenQualityEvaluation && onOpenQualityEvaluation(stagesModal.batch || stagesModal.data?.batch)}
                                            className="w-full py-1.5 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-xs"
                                        >
                                            <FlaskConical size={13} />
                                            Evaluar Calidad FQ / MB
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* DETALLE DE TARIMAS UTILIZADAS */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <Layers size={14} className="text-indigo-600" />
                                        Tarimas Utilizadas en esta Producción ({tarimasUsedList.length})
                                    </h4>
                                    <span className="text-[11px] font-bold text-indigo-700">
                                        Total: {tarimasUsedList.reduce((acc, t) => acc + (parseFloat(t.quantity_lbs) || 0), 0).toLocaleString()} Lbs • {tarimasUsedList.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0)} Cajas
                                    </span>
                                </div>
                                {tarimasUsedList.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                                    <th className="py-1.5">Tarima #</th>
                                                    <th className="py-1.5">Lote Prov.</th>
                                                    <th className="py-1.5">Proveedor</th>
                                                    <th className="py-1.5">Tipo Huevo</th>
                                                    <th className="py-1.5 text-center">Cajas</th>
                                                    <th className="py-1.5 text-right">Peso (Lbs)</th>
                                                    <th className="py-1.5 text-center">Ubicación</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {tarimasUsedList.map((t, ti) => (
                                                    <tr key={ti} className="hover:bg-slate-50">
                                                        <td className="py-2 font-mono font-bold text-indigo-700">
                                                            #{t.tarima_number || (ti + 1)}
                                                            {t.is_partial && <span className="ml-1 text-[9px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded font-normal">Parcial</span>}
                                                        </td>
                                                        <td className="py-2 font-mono font-semibold text-slate-800">{t.provider_lot || '-'}</td>
                                                        <td className="py-2 text-slate-600">{t.provider_name || 'HUEVO EN CASCARÓN'}</td>
                                                        <td className="py-2 capitalize font-medium text-slate-700">{t.egg_type || 'comercial'}</td>
                                                        <td className="py-2 text-center font-bold text-slate-900">{t.boxes_count || 0} cjs</td>
                                                        <td className="py-2 text-right font-black text-slate-900">{parseFloat(t.quantity_lbs || 0).toLocaleString()} Lbs</td>
                                                        <td className="py-2 text-center">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${(t.storage_location || 'abajo') === 'abajo' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                                                {t.storage_location || 'abajo'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No hay detalle individual de tarimas disponible para este lote.</p>
                                )}
                            </div>

                            {/* REMANENTES DE OTRAS PRODUCCIONES UTILIZADOS */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <Boxes size={14} className="text-teal-600" />
                                        Remanentes de Otras Producciones Utilizados en este Lote ({remanentesUsedList.length})
                                    </h4>
                                    <span className="text-[11px] font-bold text-teal-700">
                                        Total: {remanentesUsedList.reduce((acc, r) => acc + (parseFloat(r.quantity_lbs || r.weight_lbs) || 0), 0).toFixed(1)} Lbs
                                    </span>
                                </div>
                                {remanentesUsedList.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                                    <th className="py-1.5">Lote Origen</th>
                                                    <th className="py-1.5">Fecha Origen</th>
                                                    <th className="py-1.5">Código Rem.</th>
                                                    <th className="py-1.5">Producto</th>
                                                    <th className="py-1.5 text-right">Peso Utilizado (Lbs)</th>
                                                    <th className="py-1.5 text-center">Térmico</th>
                                                    <th className="py-1.5">Notas</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {remanentesUsedList.map((r, ri) => (
                                                    <tr key={ri} className="hover:bg-slate-50">
                                                        <td className="py-2 font-mono font-bold text-indigo-700">{r.source_batch_code || `Lote #${r.batch_id}`}</td>
                                                        <td className="py-2 text-slate-600">{r.source_batch_date ? formatDate(r.source_batch_date) : '-'}</td>
                                                        <td className="py-2 font-mono font-medium text-teal-800">{r.remanente_code || `REM-${r.id}`}</td>
                                                        <td className="py-2 capitalize font-medium">{r.product_type}</td>
                                                        <td className="py-2 text-right font-black text-teal-700">{parseFloat(r.quantity_lbs || r.weight_lbs || 0).toFixed(1)} Lbs</td>
                                                        <td className="py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.is_pasteurized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                {r.is_pasteurized ? 'Pasteurizado' : 'Crudo'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-slate-500 italic text-[11px]">{r.notes || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No se consumieron remanentes de producciones anteriores en este lote.</p>
                                )}
                            </div>

                            {/* Detalle de Remanentes Registrados (Generados en este lote) */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-teal-500" />
                                        Materia Prima Remanente Generada en este Lote ({remanentesGeneratedList.length})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => onOpenRemanente && onOpenRemanente(stagesModal.batch)}
                                        className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={12} />
                                        + Registrar Remanente
                                    </button>
                                </div>
                                {remanentesGeneratedList.length > 0 ? (
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
                                                    <th className="py-1.5 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {remanentesGeneratedList.map(r => (
                                                    <tr key={r.id} className="hover:bg-slate-50">
                                                        <td className="py-2 font-mono font-bold text-teal-800">{r.remanente_code || `REM-${r.id}`}</td>
                                                        <td className="py-2 capitalize font-medium">{r.product_type}</td>
                                                        <td className="py-2 text-right font-bold text-teal-700">{parseFloat(r.weight_lbs || r.quantity_lbs || 0).toFixed(1)} Lbs</td>
                                                        <td className="py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.is_pasteurized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                {r.is_pasteurized ? 'Pasteurizado' : 'Sin Pasteurizar'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 capitalize text-slate-700">{(r.destination || r.storage_location || '-').replace('_', ' ')}</td>
                                                        <td className="py-2 text-slate-500 italic text-[11px]">{r.notes || '-'}</td>
                                                        <td className="py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {onOpenEditRemanente && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onOpenEditRemanente(r)}
                                                                        className="p-1 hover:bg-teal-100 text-teal-700 rounded transition-colors"
                                                                        title="Editar remanente"
                                                                    >
                                                                        <Pencil size={13} />
                                                                    </button>
                                                                )}
                                                                {onDeleteRemanente && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onDeleteRemanente(r.id)}
                                                                        className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                                                                        title="Eliminar remanente"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic">No se han registrado remanentes ni sobrantes para este lote.</p>
                                )}
                            </div>

                            {/* Resumen de Mermas de Producción */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <AlertOctagon size={14} className="text-rose-600" />
                                        Mermas y Pérdidas del Lote ({wastesList.length})
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => onOpenWastes && onOpenWastes(stagesModal.batch)}
                                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={12} />
                                        + Registrar Merma
                                    </button>
                                </div>
                                {wastesList.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                                    <th className="py-1.5">Etapa</th>
                                                    <th className="py-1.5">Tipo Merma</th>
                                                    <th className="py-1.5 text-right">Peso (Lbs)</th>
                                                    <th className="py-1.5">Registrado Por</th>
                                                    <th className="py-1.5">Notas</th>
                                                    <th className="py-1.5 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {wastesList.map(w => (
                                                    <tr key={w.id} className="hover:bg-slate-50">
                                                        <td className="py-2 capitalize font-semibold text-slate-800">{w.stage}</td>
                                                        <td className="py-2 capitalize text-rose-700 font-bold">{w.waste_type?.replace('_', ' ')}</td>
                                                        <td className="py-2 text-right font-black text-slate-900">{parseFloat(w.weight_lbs || w.quantity_lbs || 0).toFixed(1)} Lbs</td>
                                                        <td className="py-2 text-slate-600">{w.operator_name || '-'}</td>
                                                        <td className="py-2 text-slate-500 italic text-[11px]">{w.notes || w.reason || '-'}</td>
                                                        <td className="py-2 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                {onOpenEditWaste && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onOpenEditWaste(w)}
                                                                        className="p-1 hover:bg-rose-100 text-rose-700 rounded transition-colors"
                                                                        title="Editar merma"
                                                                    >
                                                                        <Pencil size={13} />
                                                                    </button>
                                                                )}
                                                                {(handleDeleteWaste || onDeleteWaste) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => (handleDeleteWaste || onDeleteWaste)(w.id)}
                                                                        className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                                                                        title="Eliminar registro de merma"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
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
