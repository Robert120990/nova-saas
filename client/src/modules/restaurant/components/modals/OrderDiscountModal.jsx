import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import Modal from '../../../../components/ui/Modal';
import { Percent, DollarSign, Gift, Tag, Trash2, CheckCircle2 } from 'lucide-react';
import Money, { MoneyInput } from '../../../../components/ui/Money';

const PRESET_REASONS = [
    'Cortesía de la casa',
    'Cliente VIP',
    'Cumpleaños',
    'Descuento empleado',
    'Convenio corporativo',
    'Demora en cocina'
];

export default function OrderDiscountModal({ isOpen, onClose, order, initialItem = null }) {
    const queryClient = useQueryClient();

    const [scope, setScope] = useState('order'); // 'order' o 'item'
    const [selectedItemId, setSelectedItemId] = useState('');
    const [discountType, setDiscountType] = useState('percentage'); // 'percentage', 'amount', 'courtesy'
    const [discountValue, setDiscountValue] = useState(10);
    const [discountReason, setDiscountReason] = useState('');

    const activeItems = Array.isArray(order?.items) ? order.items.filter(i => i.status !== 'cancelado') : [];

    useEffect(() => {
        if (!isOpen || !order) return;
        if (initialItem?.id) {
            setScope('item');
            setSelectedItemId(String(initialItem.id));
            setDiscountType(initialItem.discount_type !== 'none' ? initialItem.discount_type : 'percentage');
            setDiscountValue(Number(initialItem.discount_value || 10));
            setDiscountReason(initialItem.discount_reason || '');
        } else if (order.discount_type && order.discount_type !== 'none') {
            setScope('order');
            setSelectedItemId('');
            setDiscountType(order.discount_type);
            setDiscountValue(Number(order.discount_value || 10));
            setDiscountReason(order.discount_reason || '');
        } else {
            setScope('order');
            setSelectedItemId('');
            setDiscountType('percentage');
            setDiscountValue(10);
            setDiscountReason('');
        }
    }, [isOpen, order, initialItem]);

    const targetItem = scope === 'item' ? activeItems.find(i => String(i.id) === String(selectedItemId)) : null;
    const targetGross = scope === 'item'
        ? (targetItem ? Number(targetItem.quantity) * Number(targetItem.unit_price) : 0)
        : Number(order?.subtotal || 0);

    let estimatedDiscount = 0;
    if (discountType === 'courtesy') {
        estimatedDiscount = targetGross;
    } else if (discountType === 'percentage') {
        estimatedDiscount = Number(((targetGross * Number(discountValue || 0)) / 100).toFixed(2));
    } else if (discountType === 'amount') {
        estimatedDiscount = Math.min(Number(discountValue || 0), targetGross);
    }

    const estimatedNet = Math.max(0, targetGross - estimatedDiscount);

    const orderMutation = useMutation({
        mutationFn: async (payload) => axios.put(`/api/restaurant/orders/${order?.id}/discount`, payload),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Descuento actualizado');
            queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
            queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
            queryClient.invalidateQueries({ queryKey: ['waiter-shift-summary'] });
            onClose();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al aplicar descuento')
    });

    const itemMutation = useMutation({
        mutationFn: async (payload) => axios.put(`/api/restaurant/orders/${order?.id}/items/${selectedItemId}/discount`, payload),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Descuento en platillo actualizado');
            queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
            queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
            queryClient.invalidateQueries({ queryKey: ['waiter-shift-summary'] });
            onClose();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al aplicar descuento')
    });

    if (!isOpen || !order) return null;

    const handleSubmit = (e) => {
        e?.preventDefault();
        if (!discountReason.trim()) {
            toast.error('Debes indicar el motivo del descuento o cortesía');
            return;
        }

        const payload = {
            discount_type: discountType,
            discount_value: discountType === 'courtesy' ? 100 : Number(discountValue || 0),
            discount_reason: discountReason.trim()
        };

        if (scope === 'order') {
            orderMutation.mutate(payload);
        } else {
            if (!selectedItemId) return toast.error('Selecciona un platillo');
            itemMutation.mutate(payload);
        }
    };

    const handleRemoveDiscount = () => {
        const payload = { discount_type: 'none', discount_value: 0, discount_reason: null };
        if (scope === 'order') orderMutation.mutate(payload);
        else itemMutation.mutate(payload);
    };

    const isPending = orderMutation.isPending || itemMutation.isPending;
    const hasExistingDiscount = scope === 'order'
        ? (order.discount_type && order.discount_type !== 'none')
        : (targetItem && targetItem.discount_type && targetItem.discount_type !== 'none');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Descuentos y Cortesías • ${order.order_type === 'mesa' ? order.table_number : 'Para Llevar'}`}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Selector de Ámbito */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <button
                        type="button"
                        onClick={() => { setScope('order'); setSelectedItemId(''); }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            scope === 'order' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                        }`}
                    >
                        <Tag size={14} />
                        <span>Toda la Comanda</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setScope('item');
                            if (!selectedItemId && activeItems.length > 0) setSelectedItemId(String(activeItems[0].id));
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            scope === 'item' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                        }`}
                    >
                        <Percent size={14} />
                        <span>Platillo Individual</span>
                    </button>
                </div>

                {scope === 'item' && (
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Selecciona el Platillo</label>
                        <select
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium"
                        >
                            {activeItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.quantity}x {item.product_name} (${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)})
                                    {item.discount_type !== 'none' ? ` [-${Number(item.discount_amount || 0).toFixed(2)}]` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Tipo de Descuento */}
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Tipo de Beneficio</label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${
                                discountType === 'percentage' ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white text-slate-600'
                            }`}
                        >
                            <Percent size={15} className="text-indigo-600" />
                            <span>Porcentaje %</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setDiscountType('amount')}
                            className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${
                                discountType === 'amount' ? 'bg-indigo-50 border-indigo-300 text-indigo-900' : 'bg-white text-slate-600'
                            }`}
                        >
                            <DollarSign size={15} className="text-indigo-600" />
                            <span>Monto Fijo $</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setDiscountType('courtesy'); setDiscountValue(100); }}
                            className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 ${
                                discountType === 'courtesy' ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white text-slate-600'
                            }`}
                        >
                            <Gift size={15} className="text-amber-600" />
                            <span>Cortesía 100%</span>
                        </button>
                    </div>
                </div>

                {/* Valor */}
                {discountType === 'percentage' ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[5, 10, 15, 20, 25, 50].map(pct => (
                            <button
                                key={pct}
                                type="button"
                                onClick={() => setDiscountValue(pct)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold border ${
                                    Number(discountValue) === pct ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700'
                                }`}
                            >
                                {pct}%
                            </button>
                        ))}
                        <div className="flex items-center gap-1 ml-auto">
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                className="w-16 px-2 py-1 text-xs font-bold rounded-xl border border-slate-300 text-center"
                            />
                            <span className="text-xs font-bold text-slate-600">%</span>
                        </div>
                    </div>
                ) : discountType === 'amount' ? (
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Monto a Descontar ($)</label>
                        <MoneyInput
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e?.target ? e.target.value : e)}
                            className="w-full px-3 py-1.5 text-sm font-bold rounded-xl border border-slate-300"
                        />
                    </div>
                ) : (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                        🎁 Cortesía completa del 100% sobre el consumo seleccionado.
                    </div>
                )}

                {/* Motivo */}
                <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                        Motivo / Justificación <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1 flex-wrap pb-0.5">
                        {PRESET_REASONS.map(reason => (
                            <button
                                key={reason}
                                type="button"
                                onClick={() => setDiscountReason(reason)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                    discountReason === reason
                                        ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                        : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                                }`}
                            >
                                {reason}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        required
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="Escribe el motivo del beneficio..."
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Resumen */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600">
                        <span>Consumo Base:</span>
                        <span className="font-bold text-slate-900"><Money value={targetGross} /></span>
                    </div>
                    <div className="flex justify-between text-rose-600 font-bold">
                        <span>Descuento a Aplicar:</span>
                        <span>-<Money value={estimatedDiscount} /></span>
                    </div>
                    <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200 text-sm">
                        <span>Nuevo Subtotal:</span>
                        <span className="text-indigo-700 font-black"><Money value={estimatedNet} /></span>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center justify-between pt-1">
                    {hasExistingDiscount ? (
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={handleRemoveDiscount}
                            className="px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 border border-rose-200"
                        >
                            <Trash2 size={14} />
                            <span>Quitar Descuento</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                        >
                            Cancelar
                        </button>
                    )}

                    <button
                        type="submit"
                        disabled={isPending || targetGross <= 0 || !discountReason.trim()}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-50"
                    >
                        <CheckCircle2 size={15} />
                        <span>{isPending ? 'Guardando...' : 'Aplicar Beneficio'}</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
}
