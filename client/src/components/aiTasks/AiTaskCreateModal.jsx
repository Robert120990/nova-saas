import { useState } from 'react';
import Modal from '../ui/Modal';
import axios from 'axios';
import { toast } from 'sonner';
import { Sparkles, Send, Loader2, MessageSquare } from 'lucide-react';
import { OUTPUT_TYPES } from './aiTaskConstants';
import AiModeAndLogsSelector from './AiModeAndLogsSelector';

const QUICK_TEMPLATES = [
    {
        icon: '⚡',
        label: 'Auditoría DTEs',
        title: 'Auditar DTEs no transmitidos o con error en Hacienda',
        prompt: 'Revisar todos los Documentos Tributarios Electrónicos (DTEs) del día de hoy y días previos que se encuentren en estado RECHAZADO, CONTINGENCIA o PENDIENTE de transmisión. Indicar código de generación, motivo del rechazo según catálogo MH y sugerir la corrección adecuada.',
        priority: 'alta'
    },
    {
        icon: '⛽',
        label: 'Remesas Gasolinera',
        title: 'Verificar remesas de pista huérfanas o no sincronizadas en RRS',
        prompt: 'Consultar las entregas de remesas de gasolinera registradas en el SaaS durante los últimos 7 días y compararlas con los movimientos bancarios de RRS. Identificar discrepancias de montos, comprobantes faltantes o remesas que no tengan la llave de enlace correspondiente.',
        priority: 'alta'
    },
    {
        icon: '📦',
        label: 'Stock Crítico',
        title: 'Detectar productos bajo stock mínimo y sin rotación',
        prompt: 'Analizar el catálogo de inventario e identificar los productos con stock menor o igual al mínimo permitido en cada sucursal. Listar las existencias actuales, el último movimiento registrado en kardex y estimar los días restantes de cobertura según las ventas recientes.',
        priority: 'media'
    },
    {
        icon: '📊',
        label: 'Análisis Ventas',
        title: 'Diagnóstico de ventas, ticket promedio y rentabilidad',
        prompt: 'Realizar un resumen comparativo de las ventas del mes en curso versus el mes anterior. Calcular el ticket promedio por cliente, identificar los 5 productos más vendidos y alertar si existen variaciones atípicas o descuentos excesivos aplicados en caja.',
        priority: 'media'
    },
    {
        icon: '🛠️',
        label: 'Salud Servidor',
        title: 'Diagnóstico de salud del servidor y base de datos',
        prompt: 'Verificar el uso de memoria RAM, porcentaje de CPU, espacio disponible en disco y tiempo de respuesta de la base de datos MySQL. Comprobar la latencia y disponibilidad del microservicio DTE en el puerto 5000.',
        priority: 'baja'
    }
];

const AiTaskCreateModal = ({ isOpen, onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [priority, setPriority] = useState('media');
    const [outputType, setOutputType] = useState('texto');
    const [executionMode, setExecutionMode] = useState('api');
    const [agentPlatform, setAgentPlatform] = useState('antigravity');
    const [customLogs, setCustomLogs] = useState('');
    const [notifyTelegram, setNotifyTelegram] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleApplyTemplate = (tpl) => {
        setTitle(tpl.title);
        setPrompt(tpl.prompt);
        setPriority(tpl.priority);
        if (tpl.outputType) setOutputType(tpl.outputType);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Por favor ingresa un título para la tarea.');
            return;
        }
        if (!prompt.trim()) {
            toast.error('Por favor ingresa la instrucción o prompt detallado.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/agent-tasks', {
                title: title.trim(),
                prompt: prompt.trim(),
                priority,
                output_type: outputType,
                execution_mode: executionMode,
                agent_platform: agentPlatform,
                custom_logs: customLogs,
                notify_telegram: notifyTelegram
            });

            toast.success(res.data?.message || 'Tarea agéntica registrada exitosamente');
            if (onSuccess) onSuccess();
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al registrar la tarea agéntica');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setTitle('');
        setPrompt('');
        setPriority('media');
        setOutputType('texto');
        setExecutionMode('api');
        setAgentPlatform('antigravity');
        setCustomLogs('');
        setNotifyTelegram(true);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Nueva Tarea Agéntica (API o Prompt con Logs)"
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <AiModeAndLogsSelector
                    executionMode={executionMode}
                    onExecutionModeChange={setExecutionMode}
                    agentPlatform={agentPlatform}
                    onAgentPlatformChange={setAgentPlatform}
                    customLogs={customLogs}
                    onCustomLogsChange={setCustomLogs}
                />
                {/* Preconfigured Quick Templates */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                        <Sparkles size={13} className="text-amber-500" />
                        <span>Plantillas de Auditoría Rápida</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_TEMPLATES.map((tpl, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => handleApplyTemplate(tpl)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 border border-slate-200 transition-all active:scale-95"
                            >
                                <span>{tpl.icon}</span>
                                <span>{tpl.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Priority Selection */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Prioridad de Ejecución
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setPriority('alta')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                priority === 'alta'
                                    ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-400/20 shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                            <span>Alta (Prioritaria)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPriority('media')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                priority === 'media'
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-400/20 shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span>Media (Estándar)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setPriority('baja')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                priority === 'baja'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-400/20 shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Baja (De fondo)</span>
                        </button>
                    </div>
                </div>

                {/* Task Title */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Título de la Tarea / Objetivo
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Auditar inconsistencias en facturación de la semana"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all text-slate-800"
                        maxLength={250}
                        required
                    />
                </div>

                {/* Task Detailed Prompt */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Instrucción Detallada para los Agentes
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe con precisión qué debe auditar, calcular o reportar el equipo de agentes..."
                        rows={5}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all text-slate-800 resize-none"
                        required
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                        💡 El <strong>SupervisorAgent</strong> leerá tu instrucción, elegirá automáticamente al especialista idóneo y ejecutará el análisis en segundo plano.
                    </p>
                </div>

                {/* Desired Output Type */}
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
                                className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${
                                    outputType === t.id
                                        ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-sm'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                                }`}
                            >
                                <span className="text-xl mb-1">{t.icon}</span>
                                <span className="text-xs font-bold leading-tight">{t.label}</span>
                                <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Telegram notification toggle */}
                <div className="flex items-center gap-2 pt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <input
                        type="checkbox"
                        id="notifyTelegramCheck"
                        checked={notifyTelegram}
                        onChange={(e) => setNotifyTelegram(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="notifyTelegramCheck" className="text-xs font-semibold text-slate-700 cursor-pointer select-none flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-sky-500" />
                        <span>Enviar resumen a Telegram al finalizar la tarea</span>
                    </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Encolando...</span>
                            </>
                        ) : (
                            <>
                                <Send size={14} />
                                <span>Poner en Cola</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AiTaskCreateModal;
