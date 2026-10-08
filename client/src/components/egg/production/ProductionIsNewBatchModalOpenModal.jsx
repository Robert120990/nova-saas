import { toast } from 'sonner';
import {
    Plus,
    XCircle,
    Lock,
    Calendar,
    Sparkles,
    Layers,
    Trash2,
    Check,
    Camera,
    Pencil,
    AlertTriangle
} from 'lucide-react';
import { getJulianDayInfo } from '../../../utils/julianDate';
import ProductionRemanentesSelector from './ProductionRemanentesSelector';


export default function ProductionIsNewBatchModalOpenModal({ model, open = model.isNewBatchModalOpen, onClose = () => { model.setIsNewBatchModalOpen(false); model.setEditingBatch(null); }, onSave = (e) => model.handleCreateBatch(e) }) {
    const { scheduledProductions, selectedScheduledProd, setScannerModalOpen, rawMaterials, availableRemanentes, showAllRemanentes, setShowAllRemanentes, batchForm, setBatchForm, isSubmitting, isNewBatchModalOpen, setIsNewBatchModalOpen, canManageLots, editingBatch, setEditingBatch, handleMarkRemanenteUsed, handleReactivateRemanente, handleToggleRemanenteSelect, handleUpdateRemanenteUsage, handleDeleteRemanenteDirect, handleSelectScheduledProduction, batches, handleAddSpecificTarimaToRm, handleLoadAllAvailableTarimas, handleUpdateTarimaBoxesInRm, handleUpdateTarimaLbsInRm, handleRemoveTarimaFromRm, isCurrentSeparation, recommendedLot, recommendationReason, nonAALotSelectedForSeparation, nonAALotObj, handleApplyRecommendedLot, handleCreateBatch, handleAddSecondaryBatch, handleRemoveSecondaryBatch, handleUpdateSecondaryBatch, handleLinkSecondaryBatchToSchedule, handleProductTypeChange, handleSecondaryProductTypeChange } = model;
    if (!open) return null;
    return (<>{isNewBatchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl ${batchForm.enable_secondary_batch ? 'max-w-4xl' : 'max-w-2xl'} w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900 transition-all`}>
                        <div>
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    {editingBatch ? (
                                        <>
                                            <Pencil className="h-5 w-5 text-indigo-600" />
                                            <span>Editar Lote de Producción: <b className="text-indigo-700">{editingBatch.batch_code_display || editingBatch.batch_uuid}</b></span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-5 w-5 text-emerald-600" />
                                            <span>Iniciar Nueva Producción</span>
                                        </>
                                    )}
                                </h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-slate-700 p-1"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {editingBatch
                                    ? 'Modifica los parámetros del lote, formulación y materias primas asignadas a esta corrida.'
                                    : 'Configura los parámetros iniciales de quebrado, formulación y materias primas para esta corrida.'}
                            </p>
                            <div className="h-px bg-slate-100 mt-4" />
                        </div>

                        <form onSubmit={onSave || handleCreateBatch} className="space-y-5">
                            {/* Selector de Producción Programada del Calendario */}
                            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-indigo-600" />
                                        <span>Vincular con Producción Programada del Calendario</span>
                                    </label>
                                    {selectedScheduledProd && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectScheduledProduction(null)}
                                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline transition-colors"
                                        >
                                            Desvincular
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={selectedScheduledProd?.id || ''}
                                    onChange={(e) => {
                                        const found = scheduledProductions.find(p => String(p.id) === e.target.value);
                                        handleSelectScheduledProduction(found || null);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                                >
                                    <option value="">-- Iniciar Producción Libre / Sin Programación Previa --</option>
                                    {(Array.isArray(scheduledProductions) ? scheduledProductions : []).map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.status === 'en_proceso' || p.batch_id ? '🔄 [En Proceso / Co-Producto] ' : '📅 '}
                                            Lote: {p.lot_code} | {p.product_profile} ({parseFloat(p.target_quantity_lbs || 0).toLocaleString()} Lbs) - {p.production_date?.split('T')[0]} ({p.status || p.priority || 'media'})
                                        </option>
                                    ))}
                                </select>
                                {selectedScheduledProd ? (
                                    <div className="text-[11px] text-indigo-800 font-medium flex items-center gap-2 pt-1 border-t border-indigo-200/60">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                        <span>
                                            Programado: <strong>{selectedScheduledProd.production_date?.split('T')[0]}</strong> •
                                            Operador Asignado: <strong>{selectedScheduledProd.assigned_operator_name || 'Sin asignar'}</strong> •
                                            Meta: <strong>{parseFloat(selectedScheduledProd.target_quantity_lbs || 0).toLocaleString()} Lbs</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-500">
                                        Selecciona una orden del calendario para precargar automáticamente producto, presentación, corrida y fórmula.
                                    </p>
                                )}
                            </div>

                            {/* Banner y selector de Segundo Lote / Co-Producto */}
                            {(batchForm.parent_batch_id || batchForm.is_coproduct) ? (
                                <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-300 rounded-2xl p-4 space-y-2 text-teal-950 shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-wide flex items-center gap-1.5 text-teal-900">
                                            <Layers className="w-4 h-4 text-teal-600" />
                                            <span>Segundo Lote / Co-Producto (Materia Prima Compartida)</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setBatchForm(prev => ({ ...prev, parent_batch_id: null, is_coproduct: false }))}
                                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline transition-colors"
                                        >
                                            Desvincular Co-Producto
                                        </button>
                                    </div>
                                    <p className="text-xs text-teal-900 leading-relaxed">
                                        🌿 <strong>Corrida compartida:</strong> Este lote utilizará la misma materia prima quebrada del lote principal <strong>{(() => {
                                            const pb = (batches || []).find(b => b.id === batchForm.parent_batch_id);
                                            return pb ? `${pb.batch_code_display || pb.batch_uuid} (${pb.product_type})` : `#${batchForm.parent_batch_id}`;
                                        })()}</strong>.
                                        Ideal para quebraje simultáneo (ej. clara y yema separadas frente a huevo entero no separado). El inventario en bodega <strong>no se descontará dos veces</strong>.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-2 border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setBatchForm(prev => ({ ...prev, enable_secondary_batch: false, secondary_batches: [] }))}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                            !batchForm.enable_secondary_batch
                                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>🥚 Corrida Individual (1 Lote)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if ((batchForm.secondary_batches || []).length === 0) {
                                                handleAddSecondaryBatch();
                                            }
                                        }}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                                            batchForm.enable_secondary_batch
                                                ? 'bg-teal-600 text-white shadow-md border border-teal-700'
                                                : 'text-slate-600 hover:text-teal-700'
                                        }`}
                                    >
                                        <span>⚡ Quebrado Multi-Lote / Co-Productos ({(batchForm.secondary_batches?.length || 0) > 0 ? `${1 + batchForm.secondary_batches.length} Lotes` : '2+ Lotes'})</span>
                                    </button>
                                </div>
                            )}

                            {/* Identificadores de Lote (Solo edición con permiso especial) */}
                            {editingBatch && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between mb-1.5">
                                            <span>Código de Lote de Producción</span>
                                            {canManageLots ? (
                                                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded-md">Edición Habilitada</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Lock size={10} /> Solo Lectura</span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={!canManageLots}
                                            value={batchForm.batch_code_display || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, batch_code_display: e.target.value })}
                                            className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none ${
                                                canManageLots
                                                    ? 'bg-white border-indigo-300 text-slate-900 focus:ring-2 focus:ring-indigo-500/20'
                                                    : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                            }`}
                                            placeholder="Ej: LOTE 01-265-26"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Identificador visible de la orden de producción.</span>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between mb-1.5">
                                            <span>Lote de Pasteurización</span>
                                            {canManageLots ? (
                                                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md">Edición Habilitada</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Lock size={10} /> Solo Lectura</span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={!canManageLots}
                                            value={batchForm.pasteurization_lot || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, pasteurization_lot: e.target.value })}
                                            className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none ${
                                                canManageLots
                                                    ? 'bg-white border-amber-300 text-slate-900 focus:ring-2 focus:ring-amber-500/20'
                                                    : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                            }`}
                                            placeholder="Ej: PAST-084-01"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Identificador térmico registrado en el pasteurizador.</span>
                                    </div>
                                </div>
                            )}

                            {!batchForm.enable_secondary_batch ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Corrida del Día</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={batchForm.run_number}
                                        onChange={(e) => {
                                            const newRun = e.target.value;
                                            const dayInfo = getJulianDayInfo();
                                            const runStr = String(newRun || 1).padStart(2, '0');
                                            const autoCode = `LOTE ${runStr}-${dayInfo.dayOfYearStr}-${dayInfo.year2Digit}`;
                                            setBatchForm(prev => ({
                                                ...prev,
                                                run_number: newRun,
                                                batch_code_display: (!prev.batch_code_display || prev.batch_code_display.startsWith('LOTE'))
                                                    ? autoCode
                                                    : prev.batch_code_display
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 1"
                                    />
                                    <span className="text-[10px] text-indigo-600 font-medium block mt-1">
                                        Formato oficial: LOTE {String(batchForm.run_number || 1).padStart(2, '0')}-{getJulianDayInfo().dayOfYearStr}-{getJulianDayInfo().year2Digit}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Producto a Fabricar</label>
                                    <select
                                        value={batchForm.product_type}
                                        onChange={(e) => handleProductTypeChange(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        <option value="huevo entero">Huevo Entero Pasteurizado</option>
                                        <option value="huevo rapido">Huevo Entero Rápido</option>
                                        <option value="clara">Clara Pasteurizada</option>
                                        <option value="clara ppg">Clara PPG</option>
                                        <option value="yema salada">Yema Líquida Salada (10% sal)</option>
                                        <option value="yema azucarada">Yema Líquida Azucarada (10% azúcar)</option>
                                        <option value="fórmula especial">Fórmula Especial / HE Plus (18-21% sol)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                                        Presentaciones Comerciales (Múltiples)
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-slate-300 rounded-xl min-h-[38px] items-center">
                                        {(Array.isArray([
                                            { id: 'cubeta 30LB', label: 'Cubeta 30 Lbs' },
                                            { id: 'cubeta 32LB', label: 'Cubeta 32 Lbs' },
                                            { id: 'galón 8LB', label: 'Galón 8 Lbs' },
                                            { id: 'medio galón 4LB', label: 'Medio Galón 4 Lbs' },
                                            { id: 'litro 2LB', label: 'Litro 2 Lbs' },
                                            { id: 'bolsa 5LB', label: 'Bolsa 5 Lbs' }
                                        ]) ? [
                                            { id: 'cubeta 30LB', label: 'Cubeta 30 Lbs' },
                                            { id: 'cubeta 32LB', label: 'Cubeta 32 Lbs' },
                                            { id: 'galón 8LB', label: 'Galón 8 Lbs' },
                                            { id: 'medio galón 4LB', label: 'Medio Galón 4 Lbs' },
                                            { id: 'litro 2LB', label: 'Litro 2 Lbs' },
                                            { id: 'bolsa 5LB', label: 'Bolsa 5 Lbs' }
                                        ] : []).map(p => {
                                            const currentSelected = Array.isArray(batchForm.presentations)
                                                ? batchForm.presentations
                                                : (batchForm.presentation ? (Array.isArray(batchForm.presentation.split(',')) ? batchForm.presentation.split(',') : []).map(s => s.trim()) : ['cubeta 30LB']);
                                            const isSelected = currentSelected.includes(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        let updated;
                                                        if (isSelected) {
                                                            if (currentSelected.length === 1) return toast.info('Debe mantener al menos una presentación seleccionada.');
                                                            updated = currentSelected.filter(x => x !== p.id);
                                                        } else {
                                                            updated = [...currentSelected, p.id];
                                                        }
                                                        setBatchForm({ ...batchForm, presentations: updated, presentation: updated.join(', ') });
                                                    }}
                                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                                                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    {isSelected && <Check size={11} className="text-indigo-600" />}
                                                    <span>{p.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-teal-50/80 border border-teal-300 rounded-2xl p-3.5 text-xs text-teal-950 flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold">
                                            <span className="p-1.5 bg-teal-200 text-teal-800 rounded-xl">⚡</span>
                                            <span>Configuración de Quebrado Multi-Lote: Se crearán {1 + (batchForm.secondary_batches?.length || 1)} lotes simultáneos con la misma materia prima quebrada.</span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-full">
                                            Materia Prima Compartida
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                                        {/* TARJETA LOTE 1 (PRINCIPAL) */}
                                        <div className="bg-indigo-50/50 border-2 border-indigo-300 rounded-2xl p-4 space-y-3 min-w-0 overflow-hidden">
                                            <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                                                <span className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5">
                                                    <span>🥚 Lote 1 (Principal)</span>
                                                </span>
                                                <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-lg">
                                                    {batchForm.batch_code_display || `LOTE ${String(batchForm.run_number || 1).padStart(2, '0')}-${getJulianDayInfo().dayOfYearStr}-${getJulianDayInfo().year2Digit}`}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Corrida Lote 1</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={batchForm.run_number}
                                                        onChange={(e) => {
                                                            const newRun = e.target.value;
                                                            const dayInfo = getJulianDayInfo();
                                                            const runStr = String(newRun || 1).padStart(2, '0');
                                                            const autoCode = `LOTE ${runStr}-${dayInfo.dayOfYearStr}-${dayInfo.year2Digit}`;
                                                            setBatchForm(prev => ({
                                                                ...prev,
                                                                run_number: newRun,
                                                                batch_code_display: autoCode
                                                            }));
                                                        }}
                                                        className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Producto Lote 1 *</label>
                                                    <select
                                                        value={batchForm.product_type}
                                                        onChange={(e) => handleProductTypeChange(e.target.value)}
                                                        className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-semibold"
                                                    >
                                                        <option value="clara">Clara Pasteurizada</option>
                                                        <option value="clara ppg">Clara PPG</option>
                                                        <option value="huevo entero">Huevo Entero Pasteurizado</option>
                                                        <option value="huevo rapido">Huevo Entero Rápido</option>
                                                        <option value="yema salada">Yema Líquida Salada (10% sal)</option>
                                                        <option value="yema azucarada">Yema Líquida Azucarada (10% azúcar)</option>
                                                        <option value="fórmula especial">Fórmula Especial / HE Plus</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Presentaciones Lote 1</label>
                                                <div className="flex flex-wrap gap-1 p-1 bg-white border border-indigo-200 rounded-xl">
                                                    {[
                                                        { id: 'cubeta 30LB', label: 'Cubeta 30 Lbs' },
                                                        { id: 'cubeta 32LB', label: 'Cubeta 32 Lbs' },
                                                        { id: 'galón 8LB', label: 'Galón 8 Lbs' },
                                                        { id: 'medio galón 4LB', label: 'Medio Galón 4 Lbs' },
                                                        { id: 'litro 2LB', label: 'Litro 2 Lbs' },
                                                        { id: 'bolsa 5LB', label: 'Bolsa 5 Lbs' }
                                                    ].map(p => {
                                                        const currentSelected = Array.isArray(batchForm.presentations)
                                                            ? batchForm.presentations
                                                            : (batchForm.presentation ? batchForm.presentation.split(',').map(s => s.trim()) : ['cubeta 30LB']);
                                                        const isSelected = currentSelected.includes(p.id);
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    let updated;
                                                                    if (isSelected) {
                                                                        if (currentSelected.length === 1) return toast.info('Mantenga al menos una presentación.');
                                                                        updated = currentSelected.filter(x => x !== p.id);
                                                                    } else {
                                                                        updated = [...currentSelected, p.id];
                                                                    }
                                                                    setBatchForm({ ...batchForm, presentations: updated, presentation: updated.join(', ') });
                                                                }}
                                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${isSelected ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                                            >
                                                                {p.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* TARJETAS DINÁMICAS LOTES CO-PRODUCTOS */}
                                        {((batchForm.secondary_batches && batchForm.secondary_batches.length > 0)
                                            ? batchForm.secondary_batches
                                            : [{
                                                run_number: batchForm.second_run_number || 2,
                                                batch_code_display: batchForm.second_batch_code_display,
                                                product_type: batchForm.second_product_type || 'clara',
                                                presentation: batchForm.second_presentation || 'cubeta 30LB',
                                                presentations: batchForm.second_presentations?.length ? batchForm.second_presentations : ['cubeta 30LB']
                                            }]
                                        ).map((secBatch, sIdx) => {
                                            const lotNum = sIdx + 2;
                                            const targetDate = selectedScheduledProd?.production_date || new Date();
                                            const targetDayInfo = getJulianDayInfo(targetDate);
                                            const codeDisplay = secBatch.batch_code_display || `LOTE ${String(secBatch.run_number || lotNum).padStart(2, '0')}-${targetDayInfo.dayOfYearStr}-${targetDayInfo.year2Digit}`;
                                            const currentPres = Array.isArray(secBatch.presentations) && secBatch.presentations.length > 0
                                                ? secBatch.presentations
                                                : (secBatch.presentation ? secBatch.presentation.split(',').map(s => s.trim()) : ['cubeta 30LB']);

                                            return (
                                                <div key={secBatch.id || sIdx} className="bg-teal-50/50 border-2 border-teal-300 rounded-2xl p-4 space-y-3 min-w-0 overflow-hidden">
                                                    <div className="flex items-center justify-between border-b border-teal-200 pb-2">
                                                        <span className="text-xs font-black uppercase text-teal-900 flex items-center gap-1.5">
                                                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                                            <span>🔗 Lote {lotNum} (Co-Producto)</span>
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-xs font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-lg">
                                                                {codeDisplay}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSecondaryBatch(sIdx)}
                                                                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                title={`Quitar Lote ${lotNum}`}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Selector de vinculación con co-producto programado del calendario */}
                                                    <div className="bg-white/90 p-2.5 rounded-xl border border-teal-200 space-y-1.5 shadow-2xs min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-teal-900 uppercase truncate">
                                                                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                                                <span>Vincular con Calendario:</span>
                                                            </div>
                                                            {secBatch.scheduled_production_id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLinkSecondaryBatchToSchedule(sIdx, '')}
                                                                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 underline shrink-0 transition-colors"
                                                                >
                                                                    Desvincular
                                                                </button>
                                                            )}
                                                        </div>
                                                        <select
                                                            value={secBatch.scheduled_production_id || ''}
                                                            onChange={(e) => handleLinkSecondaryBatchToSchedule(sIdx, e.target.value)}
                                                            className="w-full min-w-0 max-w-full text-xs font-semibold bg-white border border-teal-300 rounded-lg px-2.5 py-1.5 text-slate-700 truncate focus:ring-2 focus:ring-teal-500"
                                                        >
                                                            <option value="">-- Sin vincular (Crear nuevo) --</option>
                                                            {(Array.isArray(scheduledProductions) ? scheduledProductions : [])
                                                                .filter(p => p.id !== batchForm.scheduled_production_id && (!p.batch_id || p.id === secBatch.scheduled_production_id))
                                                                .map(p => (
                                                                    <option key={p.id} value={p.id}>
                                                                        {p.lot_code} - {p.product_profile} ({p.presentation || 'cubeta 30LB'})
                                                                    </option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Corrida / Código Lote {lotNum}</label>
                                                            <input
                                                                type="text"
                                                                value={secBatch.batch_code_display || ''}
                                                                onChange={(e) => handleUpdateSecondaryBatch(sIdx, 'batch_code_display', e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-xl text-xs font-bold"
                                                                placeholder={`Ej: LOTE 0${lotNum}-${targetDayInfo.dayOfYearStr}-${targetDayInfo.year2Digit}`}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Producto Lote {lotNum} *</label>
                                                            <select
                                                                value={secBatch.product_type || 'clara'}
                                                                onChange={(e) => handleSecondaryProductTypeChange(sIdx, e.target.value)}
                                                                className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-xl text-xs font-semibold"
                                                            >
                                                                <option value="huevo entero">Huevo Entero Pasteurizado</option>
                                                                <option value="huevo rapido">Huevo Entero Rápido</option>
                                                                <option value="clara">Clara Pasteurizada</option>
                                                                <option value="clara ppg">Clara PPG</option>
                                                                <option value="yema salada">Yema Líquida Salada (10% sal)</option>
                                                                <option value="yema azucarada">Yema Líquida Azucarada (10% azúcar)</option>
                                                                <option value="fórmula especial">Fórmula Especial / HE Plus</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Presentaciones Lote {lotNum}</label>
                                                        <div className="flex flex-wrap gap-1 p-1 bg-white border border-teal-200 rounded-xl">
                                                            {[
                                                                { id: 'cubeta 30LB', label: 'Cubeta 30 Lbs' },
                                                                { id: 'cubeta 32LB', label: 'Cubeta 32 Lbs' },
                                                                { id: 'galón 8LB', label: 'Galón 8 Lbs' },
                                                                { id: 'medio galón 4LB', label: 'Medio Galón 4 Lbs' },
                                                                { id: 'litro 2LB', label: 'Litro 2 Lbs' },
                                                                { id: 'bolsa 5LB', label: 'Bolsa 5 Lbs' }
                                                            ].map(p => {
                                                                const isSelected = currentPres.includes(p.id);
                                                                return (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            let updated;
                                                                            if (isSelected) {
                                                                                if (currentPres.length === 1) return toast.info('Mantenga al menos una presentación.');
                                                                                updated = currentPres.filter(x => x !== p.id);
                                                                            } else {
                                                                                updated = [...currentPres, p.id];
                                                                            }
                                                                            handleUpdateSecondaryBatch(sIdx, 'presentations', updated);
                                                                        }}
                                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${isSelected ? 'bg-teal-600 text-white border-teal-700' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                                                    >
                                                                        {p.label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Botón para agregar más lotes co-productos */}
                                    <div className="flex justify-end pt-1">
                                        <button
                                            type="button"
                                            onClick={handleAddSecondaryBatch}
                                            className="px-3.5 py-2 rounded-xl border border-dashed border-teal-400 hover:border-teal-600 bg-teal-50/70 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                            <span>+ Agregar Lote Co-Producto Adicional ({1 + (batchForm.secondary_batches?.length || 1) + 1})</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Materias Primas con Desglose de Tarimas y Cantidades */}
                            <div className="space-y-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-2.5">
                                    <div>
                                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                            <Layers className="w-4 h-4 text-indigo-600" />
                                            <span>Materia Prima Base (Lotes en Recepción & Tarimas)</span>
                                        </label>
                                        <p className="text-[11px] text-slate-500">
                                            Selecciona lotes aprobados con saldo disponible o escanea las tarimas con la cámara.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setScannerModalOpen(true)}
                                            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
                                            title="Abrir cámara para escanear QR o código de barra de la tarima"
                                        >
                                            <Camera className="w-4 h-4" />
                                            <span>Escanear Tarima (Cámara / QR)</span>
                                        </button>
                                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                            <span className="text-slate-500 font-medium">Cajas: <strong className="text-indigo-700">{batchForm.raw_materials.reduce((s, rm) => s + (parseInt(rm.boxes_count) || (rm.tarimas || []).reduce((ts, t) => ts + (parseInt(t.boxes_count) || 0), 0)), 0)} cjs</strong></span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-slate-500 font-medium">Entrada: <strong className="text-emerald-700">{batchForm.raw_materials.reduce((s, rm) => s + parseFloat(rm.quantity_lbs || 0), 0).toFixed(2)} Lbs</strong></span>
                                        </div>
                                    </div>
                                </div>

                                {batchForm.is_coproduct && (
                                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0 animate-pulse"></span>
                                        <span>
                                            <strong>Materias primas vinculadas a corrida compartida:</strong> Estas tarimas y libras corresponden a la corrida del lote principal. No se descontará inventario adicional en bodega.
                                        </span>
                                    </div>
                                )}

                                {/* Banner de recomendación inteligente: FIFO y Grado AA para Separación */}
                                {recommendedLot && (
                                    <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-purple-50/90 rounded-xl border border-indigo-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                                                <Sparkles size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wide">
                                                        Lote Sugerido para Corrida:
                                                    </span>
                                                    {isCurrentSeparation ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                                                            ⭐ Prioridad Grado AA (Separación)
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                                                            🔄 Rotación FIFO (Más Antiguo)
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${(recommendedLot.storage_location || 'abajo') === 'abajo'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                        Estiba: {(recommendedLot.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo (Piso)' : '⬆ Arriba (Rack)'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-800 mt-0.5">
                                                    <strong>Lote {recommendedLot.provider_lot}</strong> ({recommendedLot.provider_name || 'Proveedor'}) • {recommendedLot.egg_type} • <span className="font-semibold text-purple-900">{recommendedLot.egg_classification || 'Grado A'}</span> • Saldo: <strong>{parseFloat(recommendedLot.stock_lbs || 0).toFixed(0)} Lbs</strong> ({recommendedLot.total_boxes || 0} cjs)
                                                </p>
                                                <span className="text-[11px] text-slate-600 font-medium block mt-0.5">
                                                    {recommendationReason}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyRecommendedLot(recommendedLot)}
                                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                                            title="Cargar automáticamente este lote y todas sus tarimas con saldo a la producción"
                                        >
                                            <Check size={14} />
                                            <span>Aplicar Lote Recomendado</span>
                                        </button>
                                    </div>
                                )}

                                {/* Aviso no bloqueante si en producto de separación se seleccionó un lote que no es Grado AA */}
                                {nonAALotSelectedForSeparation && nonAALotObj && (
                                    <div className="p-3 bg-amber-50/95 rounded-xl border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs shadow-2xs">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <strong className="font-bold block text-amber-950">Aviso de Calidad para Separación de Clara / Yema:</strong>
                                            <p className="text-amber-900 leading-relaxed">
                                                El lote seleccionado <strong>{nonAALotObj.provider_lot}</strong> tiene clasificación <u>{nonAALotObj.egg_classification || 'No Grado AA'}</u>. Para el quebraje y separación de claras y yemas se recomienda estrictamente <strong>Huevo Grado AA</strong> con membrana vitelina firme para evitar la ruptura accidental de la yema y la contaminación grasa en las claras.
                                            </p>
                                            <span className="text-[11px] font-semibold text-amber-800 block">
                                                (Puede continuar con este lote si supervisión de planta autoriza el quebraje).
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {(Array.isArray(batchForm.raw_materials) ? batchForm.raw_materials : []).map((rm, idx) => {
                                    const selectedLot = rawMaterials.find(m => String(m.id) === String(rm.raw_material_id));
                                    let lotTarimas = selectedLot?.tarimas_available || [];
                                    if (lotTarimas.length === 0 && selectedLot?.tarimas_json) {
                                        try {
                                            lotTarimas = typeof selectedLot.tarimas_json === 'string'
                                                ? JSON.parse(selectedLot.tarimas_json || '[]')
                                                : (selectedLot.tarimas_json || []);
                                        } catch (e) {
                                            lotTarimas = [];
                                        }
                                    }

                                    return (
                                        <div key={idx} className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-3">
                                            {/* Cabecera de línea de lote */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <div className="flex-1">
                                                    <select
                                                        value={rm.raw_material_id}
                                                        onChange={(e) => {
                                                            const lotId = e.target.value;
                                                            const lotObj = rawMaterials.find(m => String(m.id) === String(lotId));
                                                            const updated = [...batchForm.raw_materials];
                                                            updated[idx].raw_material_id = lotId;
                                                            updated[idx].tarimas = [];
                                                            if (lotObj) {
                                                                updated[idx].quantity_lbs = '';
                                                                updated[idx].boxes_count = '';
                                                            }
                                                            setBatchForm({ ...batchForm, raw_materials: updated });
                                                        }}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                                    >
                                                        <option value="">Seleccionar lote recepcionado...</option>
                                                        {(Array.isArray(rawMaterials) ? rawMaterials : []).map((m, mIdx) => {
                                                            const isAgotado = m.is_depleted || parseFloat(m.stock_lbs || 0) <= 0.01;
                                                            const isAlreadyChosen = batchForm.raw_materials.some((r, i) => i !== idx && r.raw_material_id === String(m.id));
                                                            const isFifoOldest = mIdx === 0;
                                                            const isAA = (m.egg_classification || '').toLowerCase().includes('aa');
                                                            const locTag = (m.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba';
                                                            let labJson = {};
                                                            try {
                                                                labJson = typeof m.quality_lab_report_json === 'string' ? JSON.parse(m.quality_lab_report_json || '{}') : (m.quality_lab_report_json || {});
                                                            } catch (e) {
                                                                labJson = {};
                                                            }
                                                            const mpTag = labJson.reception_lot ? `[${labJson.reception_lot}] ` : '';
                                                            const isDoubleAA = (m.egg_classification || '').includes('/') || (m.egg_classification || '').toLowerCase().includes('aa y a');
                                                            const aaTag = isAA ? (isDoubleAA ? '[⭐ Grado AA / A] ' : '[⭐ Grado AA] ') : '';

                                                            return (
                                                                <option
                                                                    key={m.id}
                                                                    value={m.id}
                                                                    disabled={isAgotado || isAlreadyChosen}
                                                                    className={isAgotado ? 'text-slate-400 bg-slate-50' : 'text-slate-900 font-semibold'}
                                                                >
                                                                    {isFifoOldest ? '[FIFO] ' : ''}
                                                                    {aaTag}
                                                                    {mpTag}[{locTag}] Lote Prov: {m.provider_lot} - {m.egg_type} ({m.provider_name || 'Prov.'}) | {isAgotado ? '🚫 [AGOTADO - 0 Lbs]' : `Stock: ${parseFloat(m.stock_lbs || 0).toFixed(0)} Lbs (${m.total_boxes || 0} cjs)`}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="w-28">
                                                        <input
                                                            type="number"
                                                            value={rm.quantity_lbs}
                                                            readOnly
                                                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold text-right cursor-not-allowed"
                                                            placeholder="Total Lbs"
                                                            title="Suma automática de las tarimas seleccionadas"
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setBatchForm({ ...batchForm, raw_materials: batchForm.raw_materials.filter((_, i) => i !== idx) });
                                                        }}
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                                                        title="Eliminar este lote"
                                                    >
                                                        <XCircle size={17} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Espacio para selección y desglose de Tarimas de Recepción */}
                                            {selectedLot && (
                                                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                                                                <Layers size={13} className="text-indigo-600" />
                                                                Tarimas Registradas en Recepción
                                                            </span>
                                                            {lotTarimas.length > 0 && (
                                                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                    {lotTarimas.filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01)).length} disponibles de {lotTarimas.length}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {lotTarimas.some(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01) && !(rm.tarimas || []).some(it => parseInt(it.tarima_number) === parseInt(t.tarima_number))) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLoadAllAvailableTarimas(idx, lotTarimas)}
                                                                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                >
                                                                    <Check size={11} /> Cargar todas disponibles
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Chips de tarimas registradas para seleccionar con 1 clic */}
                                                    {lotTarimas.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {(Array.isArray(lotTarimas) ? lotTarimas : []).map((t) => {
                                                                const isAdded = (rm.tarimas || []).some(it => parseInt(it.tarima_number) === parseInt(t.tarima_number));
                                                                const isDepleted = t.is_depleted || (t.available_boxes <= 0 && t.available_lbs <= 0.01);
                                                                const availBoxes = t.available_boxes ?? t.boxes_count ?? 0;
                                                                const availLbs = t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0;

                                                                return (
                                                                    <button
                                                                        key={t.tarima_number}
                                                                        type="button"
                                                                        disabled={isAdded || isDepleted}
                                                                        onClick={() => handleAddSpecificTarimaToRm(idx, t)}
                                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${isAdded
                                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                                                            : isDepleted
                                                                                ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed line-through'
                                                                                : 'bg-white hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 shadow-2xs'
                                                                            }`}
                                                                        title={isDepleted ? 'Tarima 100% consumida en corridas anteriores' : isAdded ? 'Tarima ya agregada' : 'Hacer clic para agregar a esta corrida'}
                                                                    >
                                                                        <span>Tarima #{t.tarima_number}</span>
                                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo'
                                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                            }`}>
                                                                            {(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold opacity-80">
                                                                            ({availBoxes} cjs • {parseFloat(availLbs).toFixed(0)} Lbs)
                                                                        </span>
                                                                        {isAdded && <Check size={12} className="text-emerald-600" />}
                                                                        {isDepleted && <span className="text-[9px] text-rose-500 font-bold ml-0.5">Agotada</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic py-1">
                                                            Este lote no tiene tarimas registradas en recepción.
                                                        </p>
                                                    )}

                                                    {/* Lista de tarimas agregadas para consumir en esta corrida (admite consumo parcial) */}
                                                    {rm.tarimas && rm.tarimas.length > 0 && (
                                                        <div className="space-y-2 pt-2 border-t border-slate-200/80">
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase px-1 flex items-center justify-between">
                                                                <span>Tarimas a Quebrar en esta Corrida</span>
                                                                <span className="text-indigo-600 font-medium lowercase">admite consumo parcial de cajas</span>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                {(Array.isArray(rm.tarimas) ? rm.tarimas : []).map((t, ti) => {
                                                                    const maxBoxes = t.available_boxes || t.boxes_count || 0;
                                                                    const maxLbs = t.available_lbs || parseFloat(t.quantity_lbs) || 0;
                                                                    const currentBoxes = parseInt(t.boxes_count) || 0;
                                                                    const isPartial = currentBoxes < maxBoxes;

                                                                    return (
                                                                        <div key={ti} className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-xs flex items-center gap-1.5">
                                                                                        <span>Tarima #{t.tarima_number}</span>
                                                                                        <span className={`text-[9px] font-black px-1 py-0.2 rounded ${(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo'
                                                                                                ? 'bg-blue-100 text-blue-800'
                                                                                                : 'bg-amber-100 text-amber-800'
                                                                                            }`}>
                                                                                            {(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                                        </span>
                                                                                    </span>
                                                                                    {t.barcode && (
                                                                                        <span className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                                                                            {t.barcode}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-[11px] text-slate-500">
                                                                                        (Disponible: <strong className="text-slate-700">{maxBoxes} cjs</strong> • <strong className="text-slate-700">{parseFloat(maxLbs).toFixed(1)} Lbs</strong>)
                                                                                    </span>
                                                                                </div>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveTarimaFromRm(idx, ti)}
                                                                                    className="p-1 text-slate-600 hover:text-rose-600 rounded transition-colors"
                                                                                    title="Quitar esta tarima"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>

                                                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                                                <div className="col-span-6 sm:col-span-5 flex items-center gap-1.5">
                                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Cajas a quebrar:</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        max={maxBoxes}
                                                                                        value={t.boxes_count}
                                                                                        onChange={(e) => handleUpdateTarimaBoxesInRm(idx, ti, e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:border-indigo-500"
                                                                                        placeholder="0 cjs"
                                                                                    />
                                                                                </div>

                                                                                <div className="col-span-6 sm:col-span-5 flex items-center gap-1.5">
                                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Peso (Lbs):</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        min="0.01"
                                                                                        max={maxLbs}
                                                                                        value={t.quantity_lbs}
                                                                                        onChange={(e) => handleUpdateTarimaLbsInRm(idx, ti, e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-right focus:border-indigo-500"
                                                                                        placeholder="0.00 Lbs"
                                                                                    />
                                                                                </div>

                                                                                <div className="col-span-12 sm:col-span-2 text-right">
                                                                                    {isPartial ? (
                                                                                        <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md" title={`Quedarán ${maxBoxes - currentBoxes} cajas en inventario`}>
                                                                                            Parcial (-{maxBoxes - currentBoxes} cjs)
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                                                            Completa
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 pt-1.5 px-2 bg-slate-100/90 p-2 rounded-lg border border-slate-200">
                                                                <span>Subtotal a Quebrar de este Lote:</span>
                                                                <span className="text-indigo-700">
                                                                    {rm.tarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0)} Cajas • {rm.tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0).toFixed(2)} Lbs
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => setBatchForm({ ...batchForm, raw_materials: [...batchForm.raw_materials, { raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }] })}
                                    className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200/80 flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                    <Plus size={14} />
                                    Agregar Otro Lote de Materia Prima
                                </button>
                            </div>

                            {/* Remanentes / Sobrantes Disponibles de Producciones Anteriores */}
                            <ProductionRemanentesSelector
                                availableRemanentes={availableRemanentes}
                                showAllRemanentes={showAllRemanentes}
                                setShowAllRemanentes={setShowAllRemanentes}
                                selectedRemanenteIds={batchForm.remanente_ids || []}
                                remanenteUsages={batchForm.remanente_usages || {}}
                                onToggleSelect={handleToggleRemanenteSelect}
                                onUpdateUsage={handleUpdateRemanenteUsage}
                                onMarkUsed={handleMarkRemanenteUsed}
                                onReactivate={handleReactivateRemanente}
                                onDelete={handleDeleteRemanenteDirect}
                            />

                            {/* Insumos de Formulación / Receta */}
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Insumos y Aditivos de Formulación (Receta)</label>
                                    <span className="text-[10px] text-slate-500">Opcional para fórmulas compuestas</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Cajas Huevo</label>
                                        <input
                                            type="number"
                                            placeholder="0 cjs"
                                            value={batchForm.ingredients.boxes_count}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, boxes_count: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">liquido a</label>
                                        <input
                                            type="number"
                                            placeholder="0 garrafones"
                                            value={batchForm.ingredients.water_bottles}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, water_bottles: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Azúcar (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.sugar_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, sugar_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Sal (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.salt_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, salt_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Ác. Cítrico (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.citric_acid_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, citric_acid_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Leche Polvo (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.milk_powder_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, milk_powder_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">PPG (Gramos)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.ppg_g}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, ppg_g: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => { setIsNewBatchModalOpen(false); setEditingBatch(null); }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`px-5 py-2 text-white rounded-xl text-xs font-bold transition-all shadow-sm ${
                                        (batchForm.enable_secondary_batch || batchForm.is_coproduct)
                                            ? 'bg-teal-600 hover:bg-teal-700'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                    {isSubmitting
                                        ? (editingBatch ? 'Guardando Cambios...' : 'Iniciando...')
                                        : (editingBatch
                                            ? 'Actualizar Lote'
                                            : (batchForm.enable_secondary_batch
                                                ? 'Iniciar Producción Dual (Lote 1 y Lote 2)'
                                                : (batchForm.is_coproduct ? 'Iniciar Segundo Lote / Co-Producto' : 'Iniciar Lote')))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}</>);
}
