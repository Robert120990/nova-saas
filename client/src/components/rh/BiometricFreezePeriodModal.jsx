import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const BiometricFreezePeriodModal = ({ open, onClose, suggestedRange, onSuccess }) => {
    const queryClient = useQueryClient();
    const [nombre, setNombre] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        if (suggestedRange && open) {
            const start = suggestedRange.fecha_inicio || '';
            const end = suggestedRange.fecha_fin || '';
            setFechaInicio(start);
            setFechaFin(end);
            if (start && end) {
                setNombre(`Corte ${formatDate(start)} al ${formatDate(end)}`);
            } else {
                setNombre('Corte de Asistencia y Horas Extra');
            }
            setObservaciones('');
        }
    }, [suggestedRange, open]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/rh/biometric/cortes/freeze', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Período congelado exitosamente.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-list'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al congelar el período');
        }
    });

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!nombre.trim() || !fechaInicio || !fechaFin) {
            toast.error('Complete el nombre y el rango de fechas para el corte.');
            return;
        }

        if (fechaInicio > fechaFin) {
            toast.error('La fecha de inicio no puede ser posterior a la fecha de fin.');
            return;
        }

        mutation.mutate({
            nombre: nombre.trim(),
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            observaciones: observaciones.trim()
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Congelar Período de Horas
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Cierre de corte para reporte y consolidación de planillas
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

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                    {/* Alerta explicativa */}
                    <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-amber-900 leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold">¿Cómo funciona el congelamiento?</p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                                Las marcaciones del reloj en este rango quedarán resguardadas. Posteriormente, la pantalla mostrará únicamente el <strong>rango de horas pendiente para reportar</strong>. Si necesita ajustar alguna marcación de este período, podrá <strong>editar las horas extra únicamente</strong> en el historial de cortes.
                            </p>
                        </div>
                    </div>

                    {/* Nombre del Corte */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">
                            Nombre o Descripción del Corte <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej. 1ª Quincena Septiembre 2026"
                            className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        />
                    </div>

                    {/* Rango de Fechas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 uppercase">
                                Fecha Inicio <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 uppercase">
                                Fecha Fin <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                            />
                        </div>
                    </div>

                    {/* Observaciones opcionales */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">
                            Observaciones Generales (Opcional)
                        </label>
                        <textarea
                            rows={2}
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Notas administrativas sobre el corte..."
                            className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        />
                    </div>

                    {/* Actions */}
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
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-all shadow-sm shadow-sky-200 disabled:opacity-50"
                        >
                            <Lock className="w-4 h-4" />
                            <span>{mutation.isPending ? 'Congelando...' : 'Congelar Período'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricFreezePeriodModal;
