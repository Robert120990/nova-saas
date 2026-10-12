import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, Flame, Ban } from 'lucide-react';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';

export default function RestaurantKdsCard({ order, selectedStation, onUpdateItemStatus, onUpdateOrderStatus, onFireCourse }) {
    const [elapsedMinutes, setElapsedMinutes] = useState(0);
    const [confirmRevertItem, setConfirmRevertItem] = useState(null);

    useEffect(() => {
        const calculateElapsed = () => {
            if (!order.opened_at) return;
            const diffMs = Date.now() - new Date(order.opened_at).getTime();
            setElapsedMinutes(Math.floor(diffMs / 60000));
        };

        calculateElapsed();
        const interval = setInterval(calculateElapsed, 15000);
        return () => clearInterval(interval);
    }, [order.opened_at]);

    const warningMin = order.kds_warning_minutes || 10;
    const dangerMin = order.kds_danger_minutes || 18;

    let timeBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let cardBorderClass = 'border-slate-200 hover:border-slate-300';

    const items = Array.isArray(order.items) ? order.items : [];
    const hasPendingCourses = items.some(i => i.course_status === 'en_espera' && i.status === 'pendiente');
    const allItemsReady = items.length > 0 && items.filter(i => i.status !== 'cancelado').every(i => i.status === 'listo');

    if (allItemsReady) {
        timeBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
        cardBorderClass = 'border-emerald-300 shadow-sm shadow-emerald-50';
    } else if (elapsedMinutes >= dangerMin) {
        timeBadgeClass = 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse font-black';
        cardBorderClass = 'border-rose-400 shadow-md shadow-rose-100';
    } else if (elapsedMinutes >= warningMin) {
        timeBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
        cardBorderClass = 'border-amber-300 shadow-sm shadow-amber-50';
    }

    return (
        <div className={`bg-white rounded-3xl border-2 ${cardBorderClass} p-4 flex flex-col justify-between transition-all duration-200`}>
            <div className="space-y-3">
                {/* Cabecera de la Comanda */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-slate-900 tracking-tight">
                                {order.order_type === 'mesa' ? (order.table_number || 'Mesa') : `Para Llevar`}
                            </span>
                            {order.order_type !== 'mesa' && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                                    {order.customer_name || 'Cliente'}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                            Comanda #{order.id} • Mesero: {order.waiter_name || 'Staff'}
                        </p>
                    </div>

                    <div className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 border font-mono ${timeBadgeClass}`}>
                        <Clock size={13} />
                        <span>{elapsedMinutes} min</span>
                    </div>
                </div>

                {/* Lista de Platillos */}
                <div className="space-y-2">
                    {items.map((item) => {
                        const isCancelled = item.status === 'cancelado';
                        const isReady = item.status === 'listo';
                        const isPreparing = item.status === 'en_preparacion';
                        const isWaiting = item.course_status === 'en_espera';

                        const handleItemClick = () => {
                            if (isCancelled) return;
                            if (item.status === 'pendiente') {
                                onUpdateItemStatus(order.id, item.id, 'en_preparacion');
                            } else if (item.status === 'en_preparacion') {
                                onUpdateItemStatus(order.id, item.id, 'listo');
                            } else if (item.status === 'listo') {
                                setConfirmRevertItem(item);
                            }
                        };

                        return (
                            <div
                                key={item.id}
                                onClick={handleItemClick}
                                className={`p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
                                    isCancelled
                                        ? 'bg-red-50/60 border-red-200 opacity-60 line-through'
                                        : isReady
                                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                            : isPreparing
                                                ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950 ring-2 ring-indigo-500/20'
                                                : isWaiting
                                                    ? 'bg-slate-50 border-dashed border-slate-300 text-slate-500'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                            isReady ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'
                                        }`}>
                                            {item.quantity}
                                        </span>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-bold leading-tight ${isReady ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                                {item.product_name}
                                            </p>
                                            {item.notes && (
                                                <p className="text-[11px] font-bold text-amber-700 mt-0.5">
                                                    ⚠️ {item.notes}
                                                </p>
                                            )}
                                            {Array.isArray(item.selected_modifiers) && item.selected_modifiers.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.selected_modifiers.map((m, idx) => (
                                                        <span key={idx} className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                            {m.name || m}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1">
                                        {isCancelled ? (
                                            <span className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                                <Ban size={12} />
                                                <span>CANCELADO</span>
                                            </span>
                                        ) : isReady ? (
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                        ) : isPreparing ? (
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                                                Preparando
                                            </span>
                                        ) : isWaiting ? (
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                                                En Espera
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold text-slate-400">
                                                Tocar para iniciar
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Acciones Inferiores de la Tarjeta */}
            {(hasPendingCourses || !allItemsReady) && (
                <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
                    {hasPendingCourses && (
                        <button
                            onClick={() => onFireCourse(order.id, 'fuerte')}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                            <Flame size={14} />
                            <span>Marchar Platos Fuertes</span>
                        </button>
                    )}

                    {!allItemsReady && (
                        <button
                            onClick={() => onUpdateOrderStatus(order.id, 'lista')}
                            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            <CheckCircle2 size={15} />
                            <span>
                                {selectedStation && selectedStation !== 'all' ? 'Marcar Estación Lista' : 'Marcar Todo Listo'}
                            </span>
                        </button>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={!!confirmRevertItem}
                title="¿Regresar platillo a cocina?"
                message={`El platillo "${confirmRevertItem?.product_name}" ya está marcado como listo. ¿Deseas regresarlo a preparación en cocina?`}
                confirmLabel="Sí, regresar a cocina"
                cancelLabel="Cancelar"
                variant="warning"
                onConfirm={() => {
                    if (confirmRevertItem) {
                        onUpdateItemStatus(order.id, confirmRevertItem.id, 'pendiente');
                        setConfirmRevertItem(null);
                    }
                }}
                onCancel={() => setConfirmRevertItem(null)}
                onClose={() => setConfirmRevertItem(null)}
            />
        </div>
    );
}
