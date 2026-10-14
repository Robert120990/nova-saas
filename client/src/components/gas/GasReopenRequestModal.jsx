import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Send, AlertTriangle, Loader2, X, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../utils/dateUtils';

export default function GasReopenRequestModal({ open, onClose, onSuccess, closeout }) {
    const [reason, setReason] = useState('');
    const queryClient = useQueryClient();

    const requestMutation = useMutation({
        mutationFn: ({ id, reason }) => axios.post(`/api/gas-station/closeouts/${id}/request-reopen`, { reason }),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Solicitud enviada a Telegram exitosamente');
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
            if (onSuccess) onSuccess(res.data);
            handleClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al enviar la solicitud de reapertura');
        }
    });

    if (!open || !closeout) return null;

    const handleClose = () => {
        setReason('');
        if (onClose) onClose();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        requestMutation.mutate({
            id: closeout.id,
            reason: reason.trim()
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden transform transition-all">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-sm">
                            <LockOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                Solicitar Apertura de Turno
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Notificación directa a Telegram para autorización
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={requestMutation.isPending}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Shift details badge */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Turno a reabrir:</span>
                            <span className="font-bold text-slate-800">Turno #{closeout.numero_turno}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fecha de turno:</span>
                            <span className="font-medium text-slate-700">{formatDate(closeout.fecha_turno)}</span>
                        </div>
                        {closeout.seller_name && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Responsable:</span>
                                <span className="font-medium text-slate-700">{closeout.seller_name}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            Motivo o Justificación <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej: Corrección en lectura de pistola, ajuste en remesa faltante..."
                            className="w-full text-[13px] font-medium p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400 resize-none"
                        />
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            Los administradores recibirán botones en Telegram para aprobar o rechazar de inmediato.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={requestMutation.isPending}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={requestMutation.isPending || !reason.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {requestMutation.isPending ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Enviando a Telegram...
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    Enviar Solicitud a Telegram
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
