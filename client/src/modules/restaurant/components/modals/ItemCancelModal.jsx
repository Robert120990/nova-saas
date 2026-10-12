import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function ItemCancelModal({
    isOpen,
    onClose,
    orderId,
    item,
    onSuccess
}) {
    const isDispatched = item?.status === 'listo' || item?.status === 'servido';

    const predefinedReasons = isDispatched ? [
        'Platillo devuelto por el comensal',
        'Error de cocción o temperatura incorrecta',
        'Platillo equivocado entregado a mesa',
        'Comensal se retiró sin consumir',
        'Error de captura de mesero',
        'Otro motivo...'
    ] : [
        'Cliente cambió de opinión',
        'Error de captura de mesero',
        'Falta de insumos en cocina',
        'Tiempo de espera excesivo',
        'Otro motivo...'
    ];

    const [reason, setReason] = useState(isDispatched ? 'Platillo devuelto por el comensal' : 'Cliente cambió de opinión');
    const [customReason, setCustomReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (item) {
            const dispatched = item.status === 'listo' || item.status === 'servido';
            setReason(dispatched ? 'Platillo devuelto por el comensal' : 'Cliente cambió de opinión');
            setCustomReason('');
        }
    }, [item]);

    if (!isOpen || !item) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalReason = reason === 'Otro motivo...' ? customReason.trim() : reason;
        if (!finalReason) {
            toast.error('Debe especificar el motivo de la anulación');
            return;
        }

        setIsSubmitting(true);
        try {
            await axios.put(`/api/restaurant/orders/${orderId}/items/${item.id}/cancel`, {
                reason: finalReason
            });
            toast.success(isDispatched ? 'Platillo devuelto y descontado de la comanda' : 'Platillo anulado y cocina notificada');
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error cancelling item:', err);
            toast.error(err.response?.data?.message || 'Error al anular platillo');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isDispatched ? 'Devolución de Platillo Despachado' : 'Anular Platillo en Preparación'}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className={`flex items-start gap-3 p-3.5 rounded-2xl border ${
                    isDispatched
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}>
                    <AlertTriangle size={20} className={`shrink-0 mt-0.5 ${isDispatched ? 'text-amber-600' : 'text-rose-600'}`} />
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black">{item.product_name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isDispatched
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}>
                                {isDispatched ? 'YA DESPACHADO' : 'EN COCINA'}
                            </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${isDispatched ? 'text-amber-800' : 'text-rose-700'}`}>
                            {isDispatched
                                ? 'Este platillo ya fue completado por la cocina. Al anularlo, se descontará de la cuenta del cliente y se registrará como devolución o merma.'
                                : 'Esta acción notificará con una alerta sonora a la estación de cocina para detener su preparación de inmediato.'}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Motivo de {isDispatched ? 'Devolución' : 'Anulación'} *
                    </label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    >
                        {predefinedReasons.map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>

                {reason === 'Otro motivo...' && (
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Detalle del Motivo *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Describe el motivo de la anulación..."
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800"
                        />
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                    >
                        Volver
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all flex items-center gap-1.5 ${
                            isDispatched
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                        }`}
                    >
                        {isDispatched && <RotateCcw size={13} />}
                        <span>{isSubmitting ? 'Procesando...' : isDispatched ? 'Confirmar Devolución' : 'Confirmar Anulación'}</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
}
