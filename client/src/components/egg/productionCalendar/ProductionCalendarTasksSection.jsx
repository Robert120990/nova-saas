import { ShieldCheck, Plus, CheckCircle2, Circle, X } from 'lucide-react';

export default function ProductionCalendarTasksSection({
    formData,
    setFormData,
    factoryUsers,
    FACTORY_ROLES,
    DEFAULT_PRESETS_BY_ROLE,
    newTaskRole,
    setNewTaskRole,
    newTaskUser,
    setNewTaskUser,
    newTaskDesc,
    setNewTaskDesc,
    handleAddTask,
    handleToggleTask,
    handleRemoveTask
}) {
    return (
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Roles de Fábrica & Checklist de Preparación
                    </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                    Insumos listos antes de arrancar
                </span>
            </div>

            {/* Input para agregar tarea */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2">
                <div className="grid grid-cols-2 gap-2 sm:contents">
                    <div className="sm:col-span-3">
                        <select
                            value={newTaskRole}
                            onChange={(e) => {
                                setNewTaskRole(e.target.value);
                                setNewTaskDesc(DEFAULT_PRESETS_BY_ROLE?.[e.target.value] || '');
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
                            <option value="">Operario...</option>
                            {(Array.isArray(factoryUsers) ? factoryUsers : []).map(u => (
                                <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:contents">
                    <div className="flex-1 sm:col-span-5">
                        <input
                            type="text"
                            placeholder="Tarea de preparación..."
                            value={newTaskDesc}
                            onChange={(e) => setNewTaskDesc(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                        />
                    </div>

                    <div className="sm:col-span-1">
                        <button
                            type="button"
                            onClick={handleAddTask}
                            className="px-3 py-1.5 sm:p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center text-xs font-bold w-full shadow-sm transition-all"
                            title="Agregar Tarea"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="sm:hidden ml-1">Agregar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Lista de tareas añadidas */}
            <div className="space-y-2 max-h-60 sm:max-h-52 overflow-y-auto pr-0.5">
                {(!formData.tasks || formData.tasks.length === 0) ? (
                    <p className="text-xs text-slate-400 italic py-2 text-center">
                        No se han asignado roles ni tareas de preparación aún.
                    </p>
                ) : (
                    (Array.isArray(formData.tasks) ? formData.tasks : []).map((task, idx) => (
                        <div
                            key={idx}
                            className="flex items-start justify-between gap-2 p-2.5 bg-white rounded-xl border border-slate-200/80 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                        >
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
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
                                    className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
                                    title={task.checklist_status === 'completado' ? 'Marcar como pendiente' : 'Marcar como completada'}
                                >
                                    {task.checklist_status === 'completado' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-slate-300" />
                                    )}
                                </button>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] shrink-0 border border-indigo-100">
                                            {task.factory_role}
                                        </span>
                                        {task.user_name && (
                                            <span className="font-bold text-slate-800 text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
                                                {task.user_name}
                                            </span>
                                        )}
                                    </div>
                                    {task.task_description && (
                                        <p className="text-slate-600 text-[11px] leading-snug break-words">
                                            {task.task_description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleRemoveTask(idx)}
                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 mt-0.5"
                                title="Eliminar tarea"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
