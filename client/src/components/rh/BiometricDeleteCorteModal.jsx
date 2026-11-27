import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Trash2, RefreshCw, X, AlertTriangle, RotateCcw, Sparkles, ShieldCheck } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const BiometricDeleteCorteModal = ({ open, onClose, corte, onDeleted, onRecalculated }) => {
    const queryClient = useQueryClient();
    const [resetMode, setResetMode] = useState('clean_all');
    const [openRangeAfterDelete, setOpenRangeAfterDelete] = useState(true);

    useEffect(() => {
        if (open) {
            setResetMode('clean_all');
            setOpenRangeAfterDelete(true);
        }
    }, [open, corte?.id]);

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
        queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
        queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-list'] });
        queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
    };

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await axios.delete(`/api/rh/biometric/cortes/${corte.id}`, {
                data: { resetMode }
            });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Corte eliminado correctamente.');
            invalidateAll();
            if (onDeleted) onDeleted(data?.deletedCorte || corte, openRangeAfterDelete);
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar el corte');
        }
    });

    const recalcMutation = useMutation({
        mutationFn: async () => {
            const res = await axios.post(`/api/rh/biometric/cortes/${corte.id}/recalculate`, { resetMode });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Corte recalculado y congelado nuevamente.');
            invalidateAll();
            if (onRecalculated) onRecalculated(data);
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al recalcular el corte');
        }
    });

    if (!open || !corte) return null;

    const isBusy = deleteMutation.isPending || recalcMutation.isPending;
    const laterCount = Number(corte.later_cortes_count || 0);
    const manualEdits = Number(corte.manual_edits_count || 0);

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                            <RotateCcw className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Eliminar o Rehacer Corte</h2>
                            <p className="text-xs text-slate-500 font-medium">
                                {corte.nombre} ({formatDate(corte.fecha_inicio)} al {formatDate(corte.fecha_fin)})
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} disabled={isBusy} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
                    {/* Resumen del corte */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Colaboradores</span>
                            <span className="text-sm font-black text-slate-800">{corte.total_empleados || 0}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Pagables</span>
                            <span className="text-sm font-black text-emerald-700 font-mono">
                                +{Number(corte.total_horas_extra_pagables ?? corte.total_horas_extra_aprobadas ?? 0).toFixed(1)} h
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Ajustes Manuales</span>
                            <span className="text-sm font-black text-indigo-700">{manualEdits}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Avícola</span>
                            <span className="text-sm font-black text-amber-700 font-mono">
                                {Number(corte.total_horas_extra_avicola || 0) > 0 ? `+${Number(corte.total_horas_extra_avicola).toFixed(1)} h` : '0.0 h'}
                            </span>
                        </div>
                    </div>

                    {laterCount > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] leading-relaxed">
                                Existen <strong>{laterCount} corte(s) posteriores congelados</strong>. Si cambian los saldos negativos de este período, recuerde recalcular también los cortes siguientes para actualizar el arrastre de <strong>Horas Pendientes</strong>.
                            </p>
                        </div>
                    )}

                    {/* Selector de modo */}
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-600 uppercase block">
                            ¿Cómo desea reiniciar los cálculos de este período?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => setResetMode('clean_all')}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    resetMode === 'clean_all'
                                        ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>Limpio desde el reloj</span>
                                    <span className="ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Recomendado</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                    Borra los cálculos previos del corte y recalcula todo desde cero con las marcaciones, turnos, permisos y reglas actuales.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setResetMode('keep_manual')}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    resetMode === 'keep_manual'
                                        ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Conservar ajustes manuales</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                    Libera el corte preservando las horas que ya fueron editadas manualmente ({manualEdits}) y recalcula el resto.
                                </p>
                            </button>
                        </div>
                    </div>

                    <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={openRangeAfterDelete}
                            onChange={(e) => setOpenRangeAfterDelete(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                        <span className="text-xs font-semibold text-slate-700">
                            Al eliminar, abrir inmediatamente el rango <strong>{formatDate(corte.fecha_inicio)} al {formatDate(corte.fecha_fin)}</strong> listo para volver a congelar
                        </span>
                    </label>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isBusy}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => recalcMutation.mutate()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sky-800 bg-sky-100 hover:bg-sky-200 border border-sky-300 rounded-xl transition-all disabled:opacity-50"
                            title="Elimina y vuelve a congelar este mismo corte automáticamente en 1 paso"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
                            <span>{recalcMutation.isPending ? 'Recalculando...' : 'Recalcular en 1 Clic'}</span>
                        </button>

                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => deleteMutation.mutate()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm shadow-rose-200 transition-all disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deleteMutation.isPending ? 'Eliminando...' : 'Eliminar y Rehacer'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BiometricDeleteCorteModal;
