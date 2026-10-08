import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Clock, X, Check, Lock } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const BiometricEditOvertimeModal = ({ open, onClose, entry, onSuccess }) => {
    const queryClient = useQueryClient();
    const [horasAprobadas, setHorasAprobadas] = useState('');
    const [observacion, setObservacion] = useState('');

    useEffect(() => {
        if (entry) {
            setHorasAprobadas(
                entry.horas_extra_aprobadas !== undefined && entry.horas_extra_aprobadas !== null
                    ? String(entry.horas_extra_aprobadas)
                    : String(entry.horas_extra_calculadas || '0')
            );
            setObservacion(entry.observacion || '');
        }
    }, [entry, open]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.put('/api/rh/biometric/cortes/overtime-entry', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Horas extra actualizadas con éxito.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar las horas extra');
        }
    });

    if (!open || !entry) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const num = parseFloat(horasAprobadas);
        if (isNaN(num) || num < 0) {
            toast.error('Ingrese un número de horas extra válido (mayor o igual a 0).');
            return;
        }

        mutation.mutate({
            empleado_id: entry.empleado_id,
            device_uid: entry.device_uid,
            fecha: entry.fecha,
            horas_trabajadas: entry.horas_trabajadas,
            entrada: entry.entrada,
            salida: entry.salida,
            corte_id: entry.corte_id || null,
            horas_extra_aprobadas: num,
            observacion: observacion.trim()
        });
    };

    const handleSetCalculadas = () => {
        setHorasAprobadas(String(entry.horas_extra_calculadas || '0'));
    };

    const handleSetZero = () => {
        setHorasAprobadas('0');
        if (!observacion) setObservacion('No autorizadas por jefatura');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Ajustar Horas Extra
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                {entry.nombre} ({formatDate(entry.fecha)})
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                    {/* Indicador de Congelamiento */}
                    {entry.congelado && (
                        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-2.5 text-sky-800">
                            <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>
                                <strong>Período Congelado:</strong> Las marcaciones originales del reloj están protegidas; se autoriza únicamente la edición de las horas extra.
                            </span>
                        </div>
                    )}

                    {/* Resumen del día */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-center">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Entrada</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{entry.entrada || '---'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Salida</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{entry.salida || '---'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Horas Laboradas</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{entry.horas_trabajadas || 0} h</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase block">H.E. Reloj</span>
                            <span className="text-xs font-bold text-indigo-700 font-mono">{entry.horas_extra_calculadas || 0} h</span>
                        </div>
                    </div>

                    {/* Campo Horas Aprobadas */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-slate-600 uppercase">
                                Horas Extra Autorizadas / Aprobadas <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleSetCalculadas}
                                    className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                                    title="Restablecer al cálculo automático del reloj"
                                >
                                    Restablecer Reloj
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSetZero}
                                    className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded transition-colors"
                                    title="Poner a 0 horas extra"
                                >
                                    0 h (Denegar)
                                </button>
                            </div>
                        </div>
                        <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            required
                            value={horasAprobadas}
                            onChange={(e) => setHorasAprobadas(e.target.value)}
                            placeholder="Ej. 2.0"
                            className="w-full text-base font-bold text-indigo-900 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                        <p className="text-[11px] text-slate-400">
                            Indique las horas extra finales que serán reconocidas para el corte y reporte de planillas.
                        </p>
                    </div>

                    {/* Observación / Justificación */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">
                            Motivo / Observación del Ajuste
                        </label>
                        <textarea
                            rows={3}
                            value={observacion}
                            onChange={(e) => setObservacion(e.target.value)}
                            placeholder="Ej. Autorizadas 2 horas por jefatura de producción por cierre de mes..."
                            className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
                        >
                            <Check className="w-4 h-4" />
                            <span>{mutation.isPending ? 'Guardando...' : 'Guardar Ajuste'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricEditOvertimeModal;
