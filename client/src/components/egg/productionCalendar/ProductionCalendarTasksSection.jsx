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
                {(!formData.tasks || formData.tasks.length === 0) ? (
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
    );
}
