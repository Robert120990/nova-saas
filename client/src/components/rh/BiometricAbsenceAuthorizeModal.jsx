import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { ShieldCheck, X, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { getCategoryBadge, getSubtypeMeta } from './biometricAbsenceConstants';

const BiometricAbsenceAuthorizeModal = ({ open, onClose, absence = null, onSuccess }) => {
    const queryClient = useQueryClient();
    const [decision, setDecision] = useState('autorizado_con_goce');
    const [afectaSeptimo, setAfectaSeptimo] = useState(false);
    const [notas, setNotas] = useState('');

    useEffect(() => {
        if (!open || !absence) return;
        if (absence.estado_autorizacion === 'rechazado') {
            setDecision('rechazado');
            setAfectaSeptimo(!!absence.afecta_septimo_dia);
        } else if (absence.goce_sueldo) {
            setDecision('autorizado_con_goce');
            setAfectaSeptimo(false);
        } else {
            setDecision('autorizado_sin_goce');
            setAfectaSeptimo(false);
        }
        setNotas(absence.notas_autorizacion || '');
    }, [open, absence]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.patch(`/api/rh/biometric/absences/${absence.id}/authorize`, payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Decisión de autorización aplicada.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-daily-radar'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-absences'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            queryClient.invalidateQueries({ queryKey: ['rh-empleado-ausencias'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al procesar la autorización.');
        }
    });

    if (!open || !absence) return null;

    const catBadge = getCategoryBadge(absence.categoria);
    const subLabel = getSubtypeMeta(absence.subtipo)?.label || absence.subtipo_label || absence.tipo;

    const handleSubmit = (e) => {
        e.preventDefault();
        let estado_autorizacion = 'autorizado';
        let goce_sueldo = false;
        let afecta_septimo_dia = false;

        if (decision === 'autorizado_con_goce') {
            estado_autorizacion = 'autorizado';
            goce_sueldo = true;
        } else if (decision === 'autorizado_sin_goce') {
            estado_autorizacion = 'autorizado';
            goce_sueldo = false;
        } else if (decision === 'rechazado') {
            estado_autorizacion = 'rechazado';
            goce_sueldo = false;
            afecta_septimo_dia = afectaSeptimo;
        } else {
            estado_autorizacion = 'pendiente';
            goce_sueldo = !!absence.goce_sueldo;
        }

        mutation.mutate({
            estado_autorizacion,
            goce_sueldo,
            afecta_septimo_dia,
            notas_autorizacion: notas.trim()
        });
    };

    const options = [
        {
            id: 'autorizado_con_goce',
            title: 'Autorizar CON Goce de Sueldo',
            desc: 'Aprobado sin descuento salarial ni afectación de séptimo día.',
            icon: CheckCircle2,
            cls: 'border-emerald-300 bg-emerald-50/70 text-emerald-800'
        },
        {
            id: 'autorizado_sin_goce',
            title: 'Autorizar SIN Goce de Sueldo',
            desc: 'Permiso aprobado (no es falta disciplinaria), descontando el tiempo no laborado.',
            icon: ShieldCheck,
            cls: 'border-indigo-300 bg-indigo-50/70 text-indigo-800'
        },
        {
            id: 'rechazado',
            title: 'No Autorizar / Rechazar Permiso',
            desc: 'Se deniega la solicitud y queda como inasistencia injustificada.',
            icon: XCircle,
            cls: 'border-rose-300 bg-rose-50/70 text-rose-800'
        },
        {
            id: 'pendiente',
            title: 'Mantener Pendiente de Revisión',
            desc: 'En espera de firma de gerencia o entrega de constancia física.',
            icon: Clock,
            cls: 'border-amber-300 bg-amber-50/70 text-amber-800'
        }
    ];

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Resolver Autorización de Permiso</h2>
                            <p className="text-xs text-slate-500 font-medium">Aprobación o rechazo formal para control horario y planilla</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-black text-slate-800 text-sm">
                                {absence.empleado_nombre || `${absence.nombres || ''} ${absence.apellidos || ''}`}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${catBadge.badgeCls}`}>
                                {catBadge.shortLabel}
                            </span>
                        </div>
                        <p className="font-semibold text-indigo-700">{subLabel}</p>
                        <p className="text-slate-600">
                            <span className="font-bold">Fechas:</span> {formatDate(absence.fecha_inicio)}
                            {absence.fecha_fin && absence.fecha_fin !== absence.fecha_inicio ? ` al ${formatDate(absence.fecha_fin)}` : ''}
                            {absence.modalidad_tiempo === 'por_horas' && absence.hora_inicio
                                ? ` (${String(absence.hora_inicio).slice(0, 5)} - ${String(absence.hora_fin || '').slice(0, 5)})`
                                : ''}
                        </p>
                        {absence.motivo && <p className="text-slate-500 italic">“{absence.motivo}”</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block">Decisión *</label>
                        {options.map((opt) => {
                            const Icon = opt.icon;
                            const active = decision === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        setDecision(opt.id);
                                        if (opt.id === 'rechazado') setAfectaSeptimo(true);
                                    }}
                                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                                        active ? `${opt.cls} ring-2 ring-indigo-500/20` : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold">{opt.title}</p>
                                        <p className="text-[11px] opacity-80">{opt.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {decision === 'rechazado' && (
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={afectaSeptimo}
                                onChange={(e) => setAfectaSeptimo(e.target.checked)}
                                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                            />
                            <span>Aplicar pérdida de séptimo día (Art. 171 Código de Trabajo)</span>
                        </label>
                    )}

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Observación de Autorización</label>
                        <input
                            type="text"
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej. Autorizado por Gerencia General / Presentó boleta ISSS..."
                            className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50"
                        >
                            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span>Confirmar Decisión</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricAbsenceAuthorizeModal;
