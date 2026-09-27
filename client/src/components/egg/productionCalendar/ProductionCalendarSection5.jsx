import { toast } from 'sonner';
import Modal from '../../ui/Modal';
import {
    Plus,
    RefreshCw,
    CheckCircle2,
    Circle,
    Trash2,
    Play,
    Split,
    ShieldCheck,
    X,
    Wand2,
    ArrowRightLeft
} from 'lucide-react';
import {
    getJulianDayInfo,
    generateJulianLotCode,
    convertGregorianLotToJulian,
    isJulianLotCode
} from '../../../utils/julianDate';


export default function ProductionCalendarSection5({ model }) {
    const { PRODUCT_PROFILES, FACTORY_ROLES, DEFAULT_PRESETS_BY_ROLE, PRESENTATIONS, navigate, factoryUsers, isFormModalOpen, setIsFormModalOpen, isSubmitting, julianFormat, setJulianFormat, formData, setFormData, newTaskRole, setNewTaskRole, newTaskUser, setNewTaskUser, newTaskDesc, setNewTaskDesc, handleProfileChange, handleQuantityChange, handleAddTask, handleRemoveTask, handleSaveProduction, handleDeleteProduction, handleToggleTask } = model;

    return (<Modal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                title={formData.id ? `Editar Producción: ${formData.lot_code}` : 'Nueva Producción en Calendario'}
                maxWidth="max-w-4xl"
            >
                <form onSubmit={handleSaveProduction} className="space-y-5">
                    {/* 1. Datos Principales del Lote */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
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
                                    setFormData({
                                        ...formData,
                                        production_date: newDate,
                                        lot_code: formData.id ? formData.lot_code : newJulianLot
                                    });
                                }}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Lote (Calendario Juliano) *
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextFmt = julianFormat === 'standard' ? 'andelsa' : 'standard';
                                            setJulianFormat(nextFmt);
                                            const updatedLot = generateJulianLotCode(formData.production_date, 1, nextFmt);
                                            setFormData({ ...formData, lot_code: updatedLot });
                                            toast.info(`Formato cambiado a: ${nextFmt === 'standard' ? 'Oficial (LOTE 01-265-26)' : 'Sin LOTE (01-265-26)'}`);
                                        }}
                                        className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold px-1 py-0.5 rounded hover:bg-slate-100 transition-colors"
                                        title="Alternar prefijo LOTE"
                                    >
                                        <ArrowRightLeft className="w-2.5 h-2.5" />
                                        <span>{julianFormat === 'standard' ? 'Con LOTE' : 'Sin LOTE'}</span>
                                    </button>
                                    <span
                                        className="text-[10px] font-black px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                                        title="Día del año según calendario juliano (1..365)"
                                    >
                                        Día {getJulianDayInfo(formData.production_date).dayOfYearStr}
                                    </span>
                                </div>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    value={formData.lot_code}
                                    onChange={(e) => setFormData({ ...formData, lot_code: e.target.value })}
                                    placeholder="ej. LOTE 01-265-26"
                                    className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const refreshed = generateJulianLotCode(formData.production_date, 1, julianFormat);
                                        setFormData({ ...formData, lot_code: refreshed });
                                        toast.info(`Lote juliano generado: ${refreshed}`);
                                    }}
                                    className="absolute right-2 top-2.5 text-slate-400 hover:text-indigo-600 transition-colors"
                                    title="Regenerar Lote Juliano"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {!isJulianLotCode(formData.lot_code) && formData.lot_code && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const converted = convertGregorianLotToJulian(formData.lot_code, formData.production_date);
                                        setFormData({ ...formData, lot_code: converted });
                                        toast.success(`Lote convertido a Juliano: ${converted}`);
                                    }}
                                    className="mt-1 text-[10px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                                >
                                    <Wand2 className="w-3 h-3" />
                                    <span>Convertir a Juliano ({convertGregorianLotToJulian(formData.lot_code, formData.production_date)})</span>
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Hora Inicio - Fin
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800"
                                />
                                <span className="text-slate-400">-</span>
                                <input
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
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
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
                            >
                                <option value="baja">Baja</option>
                                <option value="media">Media (Estándar)</option>
                                <option value="alta">Alta</option>
                                <option value="urgente">Urgente (Prioritaria)</option>
                            </select>
                        </div>
                    </div>

                    {/* 2. Selección de Perfil de Producto y Parámetros */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Perfil del Producto *
                            </label>
                            <select
                                value={formData.product_profile}
                                onChange={(e) => handleProfileChange(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                {(Array.isArray(PRODUCT_PROFILES) ? PRODUCT_PROFILES : []).map(p => (
                                    <option key={p.id} value={p.id}>{p.name} - ({p.desc})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Presentación
                            </label>
                            <select
                                value={formData.presentation}
                                onChange={(e) => setFormData({ ...formData, presentation: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                            >
                                {(Array.isArray(PRESENTATIONS) ? PRESENTATIONS : []).map(pres => (
                                    <option key={pres} value={pres}>{pres}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Cantidad Objetivo (Lbs) *
                            </label>
                            <input
                                type="number"
                                required
                                step="100"
                                min="100"
                                value={formData.target_quantity_lbs}
                                onChange={(e) => handleQuantityChange(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* 3. MEZCLA / FORMULACIÓN A REALIZAR (BOM) */}
                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Split className="w-4 h-4 text-indigo-600" />
                                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                    Desglose de Mezcla / Formulación BOM
                                </span>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                                Sólidos Esperados: {formData.target_solids_pct}%
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                                <span className="text-[10px] text-slate-500 font-semibold block">Huevo Cáscara Estimado:</span>
                                <span className="font-extrabold text-slate-900 text-sm">
                                    {formData.mix_formula_json?.raw_egg_boxes || 0} cajas
                                </span>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                                <span className="text-[10px] text-slate-500 font-semibold block">Huevo Líquido Base:</span>
                                <span className="font-extrabold text-slate-900 text-sm">
                                    {formData.mix_formula_json?.raw_liquid_lbs?.toLocaleString() || 0} Lbs
                                </span>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                                <span className="text-[10px] text-slate-500 font-semibold block">Aditivo H2O Purificada:</span>
                                <span className="font-extrabold text-emerald-600 text-sm">
                                    {formData.mix_formula_json?.water_h2o_lbs?.toLocaleString() || 0} Lbs
                                </span>
                                {formData.mix_formula_json?.water_bottles > 0 && (
                                    <span className="text-[10px] text-slate-400 block">
                                        (~{formData.mix_formula_json.water_bottles} garrafas)
                                    </span>
                                )}
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                                <span className="text-[10px] text-slate-500 font-semibold block">Ácido Cítrico Estabilizador:</span>
                                <span className="font-extrabold text-slate-900 text-sm">
                                    {formData.mix_formula_json?.citric_acid_lbs || '0.00'} Lbs
                                </span>
                            </div>
                        </div>

                        {formData.mix_formula_json?.notes && (
                            <p className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-indigo-100/80 leading-relaxed">
                                <strong>Instrucciones Operativas de Mezcla:</strong> {formData.mix_formula_json.notes}
                            </p>
                        )}
                    </div>

                    {/* 4. ASIGNACIÓN DE ROLES POR USUARIO DE FÁBRICA Y CHECKLIST */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                    Asignación de Roles de Fábrica & Checklist de Preparación
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium">
                                Insumos listos antes de arrancar
                            </span>
                        </div>

                        {/* Input para agregar tarea */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                            <div className="sm:col-span-3">
                                <select
                                    value={newTaskRole}
                                    onChange={(e) => {
                                        setNewTaskRole(e.target.value);
                                        setNewTaskDesc(DEFAULT_PRESETS_BY_ROLE[e.target.value] || '');
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                                >
                                    {(Array.isArray(FACTORY_ROLES) ? FACTORY_ROLES : []).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-3">
                                <select
                                    value={newTaskUser}
                                    onChange={(e) => setNewTaskUser(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                                >
                                    <option value="">Seleccionar Operario...</option>
                                    {(Array.isArray(factoryUsers) ? factoryUsers : []).map(u => (
                                        <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="sm:col-span-5">
                                <input
                                    type="text"
                                    placeholder="Tarea de preparación..."
                                    value={newTaskDesc}
                                    onChange={(e) => setNewTaskDesc(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                />
                            </div>

                            <div className="sm:col-span-1 flex items-center">
                                <button
                                    type="button"
                                    onClick={handleAddTask}
                                    className="w-full p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center text-xs"
                                    title="Agregar Tarea"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Lista de tareas añadidas */}
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {formData.tasks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2 text-center">
                                    No se han asignado roles ni tareas de preparación aún.
                                </p>
                            ) : (
                                (Array.isArray(formData.tasks) ? formData.tasks : []).map((task, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200/80 text-xs"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (task.id) {
                                                        handleToggleTask(task.id);
                                                    }
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        tasks: (Array.isArray(prev.tasks) ? prev.tasks : []).map((t, i) => i === idx ? {
                                                            ...t,
                                                            checklist_status: t.checklist_status === 'completado' ? 'pendiente' : 'completado'
                                                        } : t)
                                                    }));
                                                }}
                                                className="shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
                                                title={task.checklist_status === 'completado' ? 'Marcar como pendiente' : 'Marcar como completada'}
                                            >
                                                {task.checklist_status === 'completado' ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                ) : (
                                                    <Circle className="w-4 h-4 text-slate-300" />
                                                )}
                                            </button>
                                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] shrink-0">
                                                {task.factory_role}
                                            </span>
                                            <span className="font-semibold text-slate-700 truncate">
                                                {task.user_name}
                                            </span>
                                            <span className="text-slate-500 text-[11px] truncate">
                                                - {task.task_description}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTask(idx)}
                                            className="p-1 text-slate-600 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 5. Operador Líder, Estado y Notas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                Operador Líder / Responsable
                            </label>
                            <select
                                value={formData.assigned_operator_id}
                                onChange={(e) => {
                                    const u = factoryUsers.find(usr => String(usr.id) === e.target.value);
                                    setFormData({
                                        ...formData,
                                        assigned_operator_id: e.target.value,
                                        assigned_operator_name: u ? u.nombre : ''
                                    });
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
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                                placeholder="ej. Cliente solicita envío antes de mediodía"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                            />
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            {formData.id && formData.status !== 'completado' && formData.status !== 'cancelado' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsFormModalOpen(false);
                                        navigate('/industrial/produccion', {
                                            state: {
                                                openNewBatchModal: true,
                                                scheduledProduction: formData
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
                                {isSubmitting ? 'Guardando...' : formData.id ? 'Guardar Cambios' : 'Programar Producción'}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>);
}
