import { toast } from 'sonner';
import Modal from '../../ui/Modal';
import { Trash2, Play, Sparkles } from 'lucide-react';
import { getJulianDayInfo, generateJulianLotCode } from '../../../utils/julianDate';
import { isProductionFinished } from '../EggCalendarPreviewPopover';
import ProductionCalendarBatchCard from './ProductionCalendarBatchCard';
import ProductionCalendarMixFormulaSection from './ProductionCalendarMixFormulaSection';
import ProductionCalendarTasksSection from './ProductionCalendarTasksSection';

export default function ProductionCalendarSection5({ model }) {
    const {
        PRODUCT_PROFILES, FACTORY_ROLES, DEFAULT_PRESETS_BY_ROLE, PRESENTATIONS,
        navigate, factoryUsers, isFormModalOpen, setIsFormModalOpen, isSubmitting,
        julianFormat, setJulianFormat, formData, setFormData,
        newTaskRole, setNewTaskRole, newTaskUser, setNewTaskUser, newTaskDesc, setNewTaskDesc,
        handleProfileChange, handleQuantityChange, handleAddTask, handleRemoveTask,
        handleSaveProduction, handleDeleteProduction, handleToggleTask,
        handleAddSecondaryLot, handleRemoveSecondaryLot, handleUpdateSecondaryLot,
        productions
    } = model;

    return (
        <Modal
            isOpen={isFormModalOpen}
            onClose={() => setIsFormModalOpen(false)}
            title={formData.id ? `Editar Producción: ${formData.lot_code}` : 'Nueva Producción en Calendario'}
            maxWidth="max-w-4xl"
        >
            <form onSubmit={handleSaveProduction} className="space-y-4">
                {/* Selector de Modo: 1 Lote vs Multi-Lote */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, enable_secondary_batch: false, secondary_lots: [] }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            !formData.enable_secondary_batch
                                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span>🥚 Corrida Individual (1 Lote)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if ((formData.secondary_lots || []).length === 0) handleAddSecondaryLot();
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            formData.enable_secondary_batch ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>⚡ Quebrado Multi-Lote ({formData.secondary_lots?.length ? `${1 + formData.secondary_lots.length} Lotes` : '2+ Lotes'})</span>
                    </button>
                </div>

                {/* Parámetros Generales de Fecha, Horario y Prioridad */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Fecha de Producción *
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.production_date}
                            onChange={(e) => {
                                const newDate = e.target.value;
                                const newJulianLot = generateJulianLotCode(newDate, 1, julianFormat);
                                setFormData(prev => ({
                                    ...prev,
                                    production_date: newDate,
                                    lot_code: prev.id ? prev.lot_code : newJulianLot,
                                    secondary_lots: prev.id ? prev.secondary_lots : (prev.secondary_lots || []).map((s, idx) => ({
                                        ...s,
                                        lot_code: generateJulianLotCode(newDate, idx + 2, julianFormat)
                                    }))
                                }));
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Hora Inicio - Fin
                        </label>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                                className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Prioridad
                        </label>
                        <select
                            value={formData.priority}
                            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                        >
                            <option value="baja">Baja</option>
                            <option value="media">Media (Estándar)</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente (Prioritaria)</option>
                        </select>
                    </div>
                </div>

                {/* Especificación de Lotes: Individual vs Multi-Lote */}
                <div className="space-y-2.5">
                    <div className={`grid gap-3 ${formData.enable_secondary_batch ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {/* LOTE 1 (PRINCIPAL) */}
                        <ProductionCalendarBatchCard
                            isSecondary={false}
                            lotNumber={1}
                            lotCode={formData.lot_code}
                            onLotCodeChange={(val) => setFormData(prev => ({ ...prev, lot_code: val }))}
                            onRegenerateLot={() => {
                                const refreshed = generateJulianLotCode(formData.production_date, 1, julianFormat);
                                setFormData(prev => ({ ...prev, lot_code: refreshed }));
                                toast.info(`Lote 1 actualizado: ${refreshed}`);
                            }}
                            productProfile={formData.product_profile}
                            onProductProfileChange={handleProfileChange}
                            presentation={formData.presentation}
                            onPresentationChange={(val) => setFormData(prev => ({ ...prev, presentation: val }))}
                            quantityLbs={formData.target_quantity_lbs}
                            onQuantityChange={handleQuantityChange}
                            PRODUCT_PROFILES={PRODUCT_PROFILES}
                            PRESENTATIONS={PRESENTATIONS}
                            julianDayStr={getJulianDayInfo(formData.production_date).dayOfYearStr}
                            julianFormat={julianFormat}
                            onToggleFormat={() => {
                                const nextFmt = julianFormat === 'standard' ? 'andelsa' : 'standard';
                                setJulianFormat(nextFmt);
                                const updated1 = generateJulianLotCode(formData.production_date, 1, nextFmt);
                                setFormData(prev => ({
                                    ...prev,
                                    lot_code: updated1,
                                    secondary_lots: (prev.secondary_lots || []).map((s, i) => ({
                                        ...s,
                                        lot_code: generateJulianLotCode(prev.production_date, i + 2, nextFmt)
                                    }))
                                }));
                                toast.info(`Formato: ${nextFmt === 'standard' ? 'Oficial' : 'Sin LOTE'}`);
                            }}
                        />

                        {/* LOTES CO-PRODUCTOS DINÁMICOS */}
                        {formData.enable_secondary_batch && (formData.secondary_lots || []).map((secLot, idx) => (
                            <ProductionCalendarBatchCard
                                key={secLot.id || idx}
                                isSecondary={true}
                                lotNumber={idx + 2}
                                lotCode={secLot.lot_code}
                                onLotCodeChange={(val) => handleUpdateSecondaryLot(idx, 'lot_code', val)}
                                onRegenerateLot={() => {
                                    const refreshed = generateJulianLotCode(formData.production_date, idx + 2, julianFormat);
                                    handleUpdateSecondaryLot(idx, 'lot_code', refreshed);
                                    toast.info(`Lote ${idx + 2} actualizado: ${refreshed}`);
                                }}
                                productProfile={secLot.product_profile}
                                onProductProfileChange={(val) => handleUpdateSecondaryLot(idx, 'product_profile', val)}
                                presentation={secLot.presentation}
                                onPresentationChange={(val) => handleUpdateSecondaryLot(idx, 'presentation', val)}
                                quantityLbs={secLot.target_quantity_lbs}
                                onQuantityChange={(val) => handleUpdateSecondaryLot(idx, 'target_quantity_lbs', parseFloat(val) || 0)}
                                onDelete={() => handleRemoveSecondaryLot(idx)}
                                PRODUCT_PROFILES={PRODUCT_PROFILES}
                                PRESENTATIONS={PRESENTATIONS}
                                julianDayStr={getJulianDayInfo(formData.production_date).dayOfYearStr}
                            />
                        ))}
                    </div>

                    {/* Botón para Agregar Más Lotes Co-Productos */}
                    {formData.enable_secondary_batch && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddSecondaryLot}
                                className="px-3 py-1.5 rounded-lg border border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/50 hover:bg-teal-50 text-teal-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                <span>+ Agregar Lote Co-Producto {(formData.secondary_lots || []).length + 2}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Desglose de Mezcla / BOM */}
                <ProductionCalendarMixFormulaSection formData={formData} />

                {/* Checklist de Preparación y Roles */}
                <ProductionCalendarTasksSection
                    formData={formData}
                    setFormData={setFormData}
                    factoryUsers={factoryUsers}
                    FACTORY_ROLES={FACTORY_ROLES}
                    DEFAULT_PRESETS_BY_ROLE={DEFAULT_PRESETS_BY_ROLE}
                    newTaskRole={newTaskRole}
                    setNewTaskRole={setNewTaskRole}
                    newTaskUser={newTaskUser}
                    setNewTaskUser={setNewTaskUser}
                    newTaskDesc={newTaskDesc}
                    setNewTaskDesc={setNewTaskDesc}
                    handleAddTask={handleAddTask}
                    handleToggleTask={handleToggleTask}
                    handleRemoveTask={handleRemoveTask}
                />

                {/* Operador Líder, Estado y Notas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Operador Líder / Responsable
                        </label>
                        <select
                            value={formData.assigned_operator_id}
                            onChange={(e) => {
                                const u = (Array.isArray(factoryUsers) ? factoryUsers : []).find(usr => String(usr.id) === e.target.value);
                                setFormData(prev => ({
                                    ...prev,
                                    assigned_operator_id: e.target.value,
                                    assigned_operator_name: u ? u.nombre : ''
                                }));
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        >
                            <option value="">Seleccionar Operador...</option>
                            {(Array.isArray(factoryUsers) ? factoryUsers : []).map(u => (
                                <option key={u.id} value={u.id}>{u.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Estado del Evento
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        >
                            <option value="programado">Programado</option>
                            <option value="en_preparacion">En Preparación</option>
                            <option value="en_proceso">En Proceso</option>
                            <option value="completado">Completado</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Notas Adicionales
                        </label>
                        <input
                            type="text"
                            placeholder="ej. Quebrado dual para atender pedidos de clara y entero"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                        />
                    </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        {formData.id && formData.status !== 'completado' && formData.status !== 'cancelado' && !isProductionFinished(formData) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsFormModalOpen(false);
                                    const companions = (Array.isArray(productions) ? productions : []).filter(p =>
                                        p.id !== formData.id && (p.parent_production_id === formData.id || (formData.parent_production_id && p.parent_production_id === formData.parent_production_id))
                                    );
                                    navigate('/industrial/produccion', {
                                        state: {
                                            openNewBatchModal: true,
                                            scheduledProduction: formData,
                                            companionProductions: companions
                                        }
                                    });
                                }}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-200 transition-all"
                                title="Llevar actividad a Producción e iniciar lote real"
                            >
                                <Play className="w-3.5 h-3.5 fill-white" />
                                <span>Llevar a Producción</span>
                            </button>
                        )}
                        {formData.id && formData.status !== 'completado' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsFormModalOpen(false);
                                    handleDeleteProduction(formData.id, formData.lot_code);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                                title="Eliminar esta producción programada"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsFormModalOpen(false)}
                            className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting
                                ? 'Guardando...'
                                : formData.id
                                    ? 'Guardar Cambios'
                                    : formData.enable_secondary_batch && (formData.secondary_lots || []).length > 0
                                        ? `Programar (${1 + formData.secondary_lots.length} Lotes)`
                                        : 'Programar Producción'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
