import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import axios from 'axios';
import { toast } from 'sonner';
import { Edit3, Play, Save, Loader2 } from 'lucide-react';
import { OUTPUT_TYPES } from './aiTaskConstants';

const AiTaskEditModal = ({ isOpen, onClose, task, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [priority, setPriority] = useState('media');
    const [outputType, setOutputType] = useState('texto');
    const [reExecute, setReExecute] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (task && isOpen) {
            setTitle(task.title || '');
            setPrompt(task.prompt || '');
            setPriority(task.priority || 'media');
            setOutputType(task.output_type || 'texto');
            // Default to re-execute if completed, failed, or cancelled
            setReExecute(['completada', 'fallida', 'cancelada'].includes(task.status));
        }
    }, [task, isOpen]);

    if (!isOpen || !task) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('El título de la tarea es requerido');
            return;
        }

        if (!prompt.trim()) {
            toast.error('La instrucción o prompt es requerido');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await axios.put(`/api/agent-tasks/${task.id}`, {
                title: title.trim(),
                prompt: prompt.trim(),
                priority,
                output_type: outputType,
                re_execute: reExecute
            });

            toast.success(res.data.message || 'Tarea actualizada correctamente');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al actualizar la tarea');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Editar Tarea #${task.id}`}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Form Header Info */}
                <div className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-medium">
                    <Edit3 size={15} className="text-indigo-600 shrink-0" />
                    <span>
                        Modifica los parámetros o refina la instrucción del prompt para que el Supervisor y los agentes ejecuten el objetivo con mayor precisión.
                    </span>
                </div>

                {/* Title */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Título de la Tarea <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Cuadro comparativo de arqueos y DTEs"
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all bg-white"
                        required
                    />
                </div>

                {/* Priority Selector */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Prioridad de Ejecución
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'baja', label: 'Baja', color: 'border-emerald-200 peer-checked:bg-emerald-50 peer-checked:border-emerald-500 peer-checked:text-emerald-800' },
                            { id: 'media', label: 'Media', color: 'border-indigo-200 peer-checked:bg-indigo-50 peer-checked:border-indigo-600 peer-checked:text-indigo-800' },
                            { id: 'alta', label: 'Alta', color: 'border-rose-200 peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:text-rose-800' }
                        ].map((p) => (
                            <label key={p.id} className="relative cursor-pointer">
                                <input
                                    type="radio"
                                    name="priority"
                                    value={p.id}
                                    checked={priority === p.id}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="peer sr-only"
                                />
                                <div className={`p-2 rounded-xl border text-center text-xs font-bold capitalize transition-all ${p.color} text-slate-600 hover:bg-slate-50`}>
                                    {p.label}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Prompt Textarea */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Instrucción / Prompt para los Agentes <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                            {prompt.length} caracteres
                        </span>
                    </div>
                    <textarea
                        rows={6}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe la instrucción detallada, fechas y parámetros para los especialistas..."
                        className="w-full p-3 text-xs leading-relaxed rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans bg-white resize-y"
                        required
                    />
                </div>

                {/* Output Type Selector */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                        Tipo de Salida Deseado
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.values(OUTPUT_TYPES).map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setOutputType(t.id)}
                                className={`flex flex-col items-center text-center p-2 rounded-xl border transition-all ${
                                    outputType === t.id
                                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-sm'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <span className="text-lg mb-0.5">{t.icon}</span>
                                <span className="text-[11px] font-bold leading-tight">{t.label}</span>
                                <span className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{t.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Re-execute Checkbox */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Play size={16} className={reExecute ? 'text-indigo-600' : 'text-slate-400'} />
                        <div>
                            <span className="text-xs font-bold text-slate-800 block">
                                Reejecutar tarea tras guardar
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                                Limpia el informe anterior y procesa de inmediato el nuevo prompt en segundo plano.
                            </span>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={reExecute}
                            onChange={(e) => setReExecute(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Guardando...</span>
                            </>
                        ) : reExecute ? (
                            <>
                                <Play size={13} />
                                <span>Guardar y Reejecutar</span>
                            </>
                        ) : (
                            <>
                                <Save size={13} />
                                <span>Guardar Cambios</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AiTaskEditModal;
