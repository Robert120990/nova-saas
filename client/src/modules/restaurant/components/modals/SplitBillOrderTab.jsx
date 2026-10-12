import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { CheckSquare, Square, ArrowRight } from 'lucide-react';
import Money from '../../../../components/ui/Money';

export default function SplitBillOrderTab({
    order,
    items = [],
    seatsMap = {},
    tipPercentage = 10,
    selectedItemIds = [],
    setSelectedItemIds,
    splitName,
    setSplitName,
    onClose,
    onSuccess
}) {
    const queryClient = useQueryClient();

    const movingItems = items.filter(i => selectedItemIds.includes(i.id));
    const remainingItems = items.filter(i => !selectedItemIds.includes(i.id));

    const movingSubtotal = movingItems.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);
    const movingTip = Number(((movingSubtotal * tipPercentage) / 100).toFixed(2));
    const movingTotal = movingSubtotal + movingTip;

    const remainingSubtotal = remainingItems.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);
    const remainingTip = Number(((remainingSubtotal * tipPercentage) / 100).toFixed(2));
    const remainingTotal = remainingSubtotal + remainingTip;

    const canSplit = selectedItemIds.length > 0 && selectedItemIds.length < items.length;

    const splitMutation = useMutation({
        mutationFn: async () => {
            return axios.post(`/api/restaurant/orders/${order?.id}/split`, {
                item_ids: selectedItemIds,
                split_name: splitName.trim() || undefined
            });
        },
        onSuccess: (res) => {
            toast.success('Comanda dividida exitosamente en 2 cuentas');
            queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
            queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
            setSelectedItemIds([]);
            setSplitName('');
            onSuccess?.(res.data?.data?.newOrder?.id);
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al dividir comanda');
        }
    });

    const handleToggleItem = (itemId) => {
        setSelectedItemIds(prev =>
            prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
        );
    };

    const handleToggleSeat = (seatItems) => {
        const seatIds = seatItems.map(i => i.id);
        const allSelected = seatIds.every(id => selectedItemIds.includes(id));
        if (allSelected) {
            setSelectedItemIds(prev => prev.filter(id => !seatIds.includes(id)));
        } else {
            setSelectedItemIds(prev => Array.from(new Set([...prev, ...seatIds])));
        }
    };

    return (
        <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <span className="text-slate-600 font-medium">
                    Marca los platillos que deseas mover a la nueva cuenta:
                </span>
                <div className="flex items-center gap-1.5">
                    {Object.keys(seatsMap).length > 1 && (
                        Object.entries(seatsMap).map(([seat, seatItems]) => (
                            <button
                                key={seat}
                                type="button"
                                onClick={() => handleToggleSeat(seatItems)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition-colors"
                            >
                                Comensal #{seat}
                            </button>
                        ))
                    )}
                    <button
                        type="button"
                        onClick={() => setSelectedItemIds([])}
                        className="px-2 py-1 text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Lista de partidas seleccionables */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
                {items.map(item => {
                    const isSelected = selectedItemIds.includes(item.id);
                    return (
                        <div
                            key={item.id}
                            onClick={() => handleToggleItem(item.id)}
                            className={`p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {isSelected ? (
                                    <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                                ) : (
                                    <Square size={16} className="text-slate-300 shrink-0" />
                                )}
                                <span className="truncate">{item.quantity}x {item.product_name}</span>
                                {item.seat_number && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-extrabold uppercase">
                                        C#{item.seat_number}
                                    </span>
                                )}
                            </div>
                            <span className="font-extrabold shrink-0">
                                <Money value={Number(item.quantity) * Number(item.unit_price)} />
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Nombre opcional para la nueva comanda */}
            <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 shrink-0">
                    Nombre de nueva cuenta:
                </label>
                <input
                    type="text"
                    value={splitName}
                    onChange={(e) => setSplitName(e.target.value)}
                    placeholder="ej. Cuenta B, Pedro, etc."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* Comparación visual de saldos en tiempo real */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-100/70 border border-slate-200 rounded-2xl space-y-1 text-xs">
                    <div className="flex items-center justify-between font-black text-slate-800 pb-1 border-b border-slate-200">
                        <span>Cuenta Original</span>
                        <span>{remainingItems.length} ítems</span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Subtotal:</span>
                        <span><Money value={remainingSubtotal} /></span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Propina ({tipPercentage}%):</span>
                        <span><Money value={remainingTip} /></span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                        <span>Total Restante:</span>
                        <span className="text-indigo-700 font-black"><Money value={remainingTotal} /></span>
                    </div>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1 text-xs">
                    <div className="flex items-center justify-between font-black text-indigo-950 pb-1 border-b border-indigo-200">
                        <span>Nueva Cuenta</span>
                        <span>{movingItems.length} ítems</span>
                    </div>
                    <div className="flex justify-between text-indigo-800 text-[11px]">
                        <span>Subtotal:</span>
                        <span><Money value={movingSubtotal} /></span>
                    </div>
                    <div className="flex justify-between text-indigo-800 text-[11px]">
                        <span>Propina ({tipPercentage}%):</span>
                        <span><Money value={movingTip} /></span>
                    </div>
                    <div className="flex justify-between font-extrabold text-indigo-950 pt-1 border-t border-indigo-200">
                        <span>Total a Separar:</span>
                        <span className="text-indigo-700 font-black"><Money value={movingTotal} /></span>
                    </div>
                </div>
            </div>

            {/* Botón de acción para separar */}
            <div className="flex items-center justify-between pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    disabled={!canSplit || splitMutation.isPending}
                    onClick={() => splitMutation.mutate()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <ArrowRight size={15} />
                    <span>
                        {splitMutation.isPending ? 'Separando...' : `Separar Comanda (${movingItems.length} ítems)`}
                    </span>
                </button>
            </div>
        </div>
    );
}
