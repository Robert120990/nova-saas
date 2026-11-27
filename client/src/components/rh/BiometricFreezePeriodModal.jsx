import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, X, AlertTriangle, Clock, Calendar, CheckCircle2, Scale } from 'lucide-react';
import { formatDate, getTodayString, getDateRangePreset } from '../../utils/dateUtils';

const MONTHS_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function suggestCorteName(start, end) {
    if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return start && end ? `Corte ${formatDate(start)} al ${formatDate(end)}` : 'Corte de Asistencia y Horas Extra';
    }
    const [y, mStr, dStr] = end.split('-');
    const mName = MONTHS_ES[(parseInt(mStr, 10) - 1) % 12] || '';
    const qLabel = parseInt(dStr, 10) <= 15 ? '1° Quincena' : '2° Quincena';
    return mName ? `${qLabel} ${mName} ${y}` : `Corte ${formatDate(start)} al ${formatDate(end)}`;
}

function addDaysIso(iso, delta) {
    const d = new Date(`${iso}T12:00:00Z`);
    if (isNaN(d.getTime())) return iso;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
}

function computeTwoWeekPlantRange(lastCorteEnd) {
    let start = lastCorteEnd ? addDaysIso(lastCorteEnd, 1) : getTodayString();
    const dStart = new Date(`${start}T12:00:00Z`);
    if (!isNaN(dStart.getTime()) && dStart.getUTCDay() === 0) {
        start = addDaysIso(start, 1); // Si cae domingo, arrancar lunes
    }
    const end = addDaysIso(start, 12); // Lunes -> Sábado de 2 semanas (12 días laborables)
    return { start, end };
}

const BiometricFreezePeriodModal = ({ open, onClose, suggestedRange, initialDraft = null, lastCorte = null, includeDeficit = false, onIncludeDeficitChange, onSuccess }) => {
    const queryClient = useQueryClient();
    const [nombre, setNombre] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [localIncludeDeficit, setLocalIncludeDeficit] = useState(!!includeDeficit);

    useEffect(() => {
        if (!open) return;
        setLocalIncludeDeficit(!!includeDeficit);
        if (initialDraft?.fecha_inicio && initialDraft?.fecha_fin) {
            setFechaInicio(initialDraft.fecha_inicio);
            setFechaFin(initialDraft.fecha_fin);
            setNombre(initialDraft.nombre || suggestCorteName(initialDraft.fecha_inicio, initialDraft.fecha_fin));
            setObservaciones(initialDraft.observaciones || '');
        } else if (suggestedRange) {
            const start = suggestedRange.fecha_inicio || '';
            const end = suggestedRange.fecha_fin || '';
            setFechaInicio(start);
            setFechaFin(end);
            setNombre(suggestCorteName(start, end));
            setObservaciones('');
        }
    }, [suggestedRange, initialDraft, includeDeficit, open]);

    const rangeReady = !!(open && fechaInicio && fechaFin && fechaInicio <= fechaFin);

    const { data: previewResp = {}, isFetching: isPreviewLoading } = useQuery({
        queryKey: ['rh-biometric-freeze-preview', fechaInicio, fechaFin, localIncludeDeficit],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/cortes/daily-overtime', {
                params: { startDate: fechaInicio, endDate: fechaFin, onlyOvertime: 0, includeDeficit: localIncludeDeficit ? 1 : 0 }
            });
            return res.data || {};
        },
        enabled: rangeReady
    });

    const { data: pendingPermsResp = {} } = useQuery({
        queryKey: ['rh-biometric-absences-freeze-check', fechaInicio, fechaFin],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/absences', {
                params: { startDate: fechaInicio, endDate: fechaFin, estadoAutorizacion: 'pendiente', limit: 5 }
            });
            return res.data || {};
        },
        enabled: rangeReady
    });

    const pendingPermissionsCount = Number(pendingPermsResp?.summary?.pendientes || 0);
    const previewSummary = previewResp?.summary || {};
    const incompleteCount = Number(previewSummary.total_incompletas || 0);

    const mutation = useMutation({
        mutationFn: async (payload) => (await axios.post('/api/rh/biometric/cortes/freeze', payload)).data,
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

    const applyQuickRange = (start, end) => {
        setFechaInicio(start);
        setFechaFin(end);
        setNombre(suggestCorteName(start, end));
    };

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
            observaciones: observaciones.trim(),
            include_deficit: localIncludeDeficit ? 1 : 0
        });
    };

    const twoWeek = computeTwoWeekPlantRange(lastCorte?.fecha_fin);
    const todayIso = getTodayString();
    const fromLastStart = lastCorte?.fecha_fin ? addDaysIso(lastCorte.fecha_fin, 1) : getDateRangePreset('quincena_actual').startDate;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
                            <Lock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                {initialDraft ? 'Volver a Congelar Corte' : 'Congelar Período de Horas'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Cierre de corte para reporte y consolidación de planillas
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
                    {/* Atajos rápidos de rango */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase mr-1">
                            <Calendar className="w-3 h-3" /> Rango rápido:
                        </span>
                        <button
                            type="button"
                            onClick={() => applyQuickRange(twoWeek.start, twoWeek.end)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                        >
                            2 Semanas (L–S)
                        </button>
                        <button
                            type="button"
                            onClick={() => applyQuickRange(fromLastStart <= todayIso ? fromLastStart : todayIso, todayIso)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        >
                            Pendiente hasta Hoy
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const q = getDateRangePreset('quincena_actual');
                                applyQuickRange(q.startDate, q.endDate);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        >
                            Quincena Calendario
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">
                            Nombre o Descripción del Corte <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ej. 1° Quincena Diciembre 2026"
                            className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        />
                    </div>

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

                    {/* Toggle de compensación con horas en negativo */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={localIncludeDeficit}
                        onClick={() => {
                            const next = !localIncludeDeficit;
                            setLocalIncludeDeficit(next);
                            if (onIncludeDeficitChange) onIncludeDeficitChange(next);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                            localIncludeDeficit
                                ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <Scale className={`w-4 h-4 shrink-0 ${localIncludeDeficit ? 'text-rose-600' : 'text-slate-400'}`} />
                            <div>
                                <span className="font-bold text-xs block">Traer horas en negativo para compensar</span>
                                <span className="text-[10px] opacity-80">Descuenta jornadas incompletas (L–V) contra las horas extra del corte</span>
                            </div>
                        </div>
                        <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${localIncludeDeficit ? 'bg-rose-600' : 'bg-slate-300'}`}>
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${localIncludeDeficit ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </span>
                    </button>

                    {/* Vista previa en vivo del corte */}
                    {rangeReady && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Vista Previa de Consolidación
                                </span>
                                {isPreviewLoading && <span className="text-[10px] text-indigo-600 font-semibold">Calculando...</span>}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                <div className="bg-white p-2 rounded-lg border border-slate-200/70">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Colab.</span>
                                    <span className="text-xs font-black text-slate-800">{previewSummary.total_empleados || 0}</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/70">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Producción</span>
                                    <span className="text-xs font-black font-mono text-slate-800">{Number(previewSummary.total_horas_extra_produccion || 0).toFixed(1)}h</span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-200/70">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Transporte</span>
                                    <span className="text-xs font-black font-mono text-slate-800">{Number(previewSummary.total_horas_extra_transporte || 0).toFixed(1)}h</span>
                                </div>
                                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                                    <span className="text-[9px] font-bold text-emerald-700 uppercase block">Pagables</span>
                                    <span className="text-xs font-black font-mono text-emerald-800">+{Number(previewSummary.total_horas_extra_pagables || 0).toFixed(1)}h</span>
                                </div>
                                <div className="bg-rose-50/70 p-2 rounded-lg border border-rose-200">
                                    <span className="text-[9px] font-bold text-rose-700 uppercase block">Arrastre</span>
                                    <span className="text-xs font-black font-mono text-rose-700">{Number(previewSummary.total_saldo_arrastre_siguiente || 0).toFixed(1)}h</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {incompleteCount > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px]">
                                Se detectaron <strong>{incompleteCount} marcación(es) incompleta(s)</strong> en este rango. Puede congelar ahora y editarlas después, o corregirlas antes de cerrar.
                            </p>
                        </div>
                    )}

                    {pendingPermissionsCount > 0 && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-900">
                            <Clock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <p className="text-[11px]">
                                Existen <strong>{pendingPermissionsCount} permiso(s) pendiente(s) de autorizar</strong> en este período. Se recomienda resolverlos antes de cerrar planilla.
                            </p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase">Observaciones Generales (Opcional)</label>
                        <textarea
                            rows={2}
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            placeholder="Notas administrativas sobre el corte..."
                            className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm shadow-sky-200 disabled:opacity-50"
                        >
                            <Lock className="w-3.5 h-3.5" />
                            <span>{mutation.isPending ? 'Congelando...' : (initialDraft ? 'Volver a Congelar' : 'Congelar Período')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricFreezePeriodModal;
