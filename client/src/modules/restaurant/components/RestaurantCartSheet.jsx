import { Send, Printer, ArrowRightLeft, Split, CheckCircle2, Trash2, Ban, Tag } from 'lucide-react';
import Money from '../../../components/ui/Money';

export default function RestaurantCartSheet({
    order,
    cartItems = [],
    onRemoveLocalItem,
    onRequestCancelItem,
    onSendOrder,
    onOpenPreAccount,
    onOpenTransfer,
    onOpenSplitBill,
    onOpenDiscount,
    onCloseOrder,
    isSubmitting
}) {
    const existingItems = Array.isArray(order?.items) ? order.items : [];
    const hasUnsentItems = cartItems.length > 0;

    // Totales combinados
    const existingSubtotal = existingItems
        .filter(i => i.status !== 'cancelado')
        .reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);

    const itemsDiscountTotal = existingItems
        .filter(i => i.status !== 'cancelado')
        .reduce((acc, i) => acc + Number(i.discount_amount || 0), 0);

    const cartSubtotal = cartItems
        .reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);

    const totalSubtotal = existingSubtotal + cartSubtotal;
    const orderDiscount = Number(order?.discount_amount || 0);
    const totalDiscount = itemsDiscountTotal + orderDiscount;
    const netSubtotal = Math.max(0, totalSubtotal - totalDiscount);

    const tipPercentage = Number(order?.tip_percentage || 10);
    const tipAmount = Number(((netSubtotal * tipPercentage) / 100).toFixed(2));
    const grandTotal = netSubtotal + tipAmount;

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between space-y-4">
            {/* Lista de Partidas (Existentes + Nuevas) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                        Comanda Actual ({existingItems.length + cartItems.length} ítems)
                    </span>
                    {order?.id && (
                        <span className="text-[11px] text-indigo-600 font-bold">
                            #{order.id}
                        </span>
                    )}
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                    {/* Partidas ya marchadas a cocina */}
                    {existingItems.map(item => {
                        const isCancelled = item.status === 'cancelado';
                        const isReady = item.status === 'listo';
                        const isServed = item.status === 'servido';
                        const isPreparing = item.status === 'en_preparacion';
                        const isDispatched = isReady || isServed;
                        const hasItemDiscount = item.discount_type && item.discount_type !== 'none';

                        return (
                            <div
                                key={item.id}
                                className={`p-2.5 rounded-2xl border text-xs flex items-start justify-between gap-2 ${
                                    isCancelled
                                        ? 'bg-red-50/50 border-red-200 opacity-60 line-through'
                                        : isReady
                                            ? 'bg-emerald-50/50 border-emerald-300'
                                            : isServed
                                                ? 'bg-blue-50/50 border-blue-200'
                                                : isPreparing
                                                    ? 'bg-amber-50/50 border-amber-200'
                                                    : 'bg-slate-50 border-slate-200'
                                }`}
                            >
                                <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-extrabold text-slate-900">{item.quantity}x</span>
                                        <span className="font-bold text-slate-800 truncate">{item.product_name}</span>
                                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-bold">
                                            {item.course}
                                        </span>
                                        {isReady && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-300">
                                                ✓ LISTO
                                            </span>
                                        )}
                                        {isServed && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black border border-blue-300">
                                                SERVIDO
                                            </span>
                                        )}
                                        {isPreparing && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                                EN COCINA
                                            </span>
                                        )}
                                        {item.status === 'pendiente' && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                                                EN ESPERA
                                            </span>
                                        )}
                                    </div>
                                    {hasItemDiscount && (
                                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                            <span>{item.discount_type === 'courtesy' ? '🎁 Cortesía 100%' : `🏷️ Descuento: -$${Number(item.discount_amount || 0).toFixed(2)}`}</span>
                                            {item.discount_reason && <span className="text-slate-400 font-normal truncate">({item.discount_reason})</span>}
                                        </p>
                                    )}
                                    {item.notes && (
                                        <p className="text-[10px] text-amber-700 font-semibold">⚠️ {item.notes}</p>
                                    )}
                                    {isCancelled && (
                                        <p className="text-[10px] text-red-600 font-bold">Motivo: {item.cancellation_reason}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                        {hasItemDiscount ? (
                                            <>
                                                <span className="text-[10px] line-through text-slate-400 block leading-tight">
                                                    <Money value={Number(item.quantity) * Number(item.unit_price)} />
                                                </span>
                                                <span className="font-extrabold text-slate-900">
                                                    <Money value={Math.max(0, (Number(item.quantity) * Number(item.unit_price)) - Number(item.discount_amount || 0))} />
                                                </span>
                                            </>
                                        ) : (
                                            <span className="font-bold text-slate-900">
                                                <Money value={Number(item.quantity) * Number(item.unit_price)} />
                                            </span>
                                        )}
                                    </div>
                                    {!isCancelled && (
                                        <div className="flex items-center gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() => onOpenDiscount(item)}
                                                className={`p-1 rounded transition-colors ${
                                                    hasItemDiscount ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                }`}
                                                title="Aplicar descuento o cortesía a este platillo"
                                            >
                                                <Tag size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onRequestCancelItem(item)}
                                                className={`p-1 rounded transition-colors ${
                                                    isDispatched
                                                        ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-100'
                                                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                }`}
                                                title={isDispatched ? 'Devolución de platillo' : 'Anular platillo'}
                                            >
                                                <Ban size={13} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Partidas nuevas por enviar */}
                    {cartItems.map((item, idx) => (
                        <div
                            key={idx}
                            className="p-2.5 rounded-2xl border border-indigo-200 bg-indigo-50/40 text-xs flex items-start justify-between gap-2"
                        >
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-indigo-700">{item.quantity}x</span>
                                    <span className="font-bold text-slate-900 truncate">{item.product_name}</span>
                                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                                        {item.course}
                                    </span>
                                    <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold">Nuevo</span>
                                </div>
                                {item.notes && (
                                    <p className="text-[10px] text-indigo-700 font-semibold">⚠️ {item.notes}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-indigo-900">
                                    <Money value={Number(item.quantity) * Number(item.unit_price)} />
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onRemoveLocalItem(idx)}
                                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                                    title="Quitar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {existingItems.length === 0 && cartItems.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-6">
                            Selecciona platillos del catálogo para armar la comanda.
                        </p>
                    )}
                </div>
            </div>

            {/* Resumen de Cuenta y Totales con Descuento y Propina */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex justify-between text-slate-600">
                    <span>Subtotal Consumo:</span>
                    <span className="font-bold text-slate-900"><Money value={totalSubtotal} /></span>
                </div>
                {totalDiscount > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                        <span>Descuento / Cortesía:</span>
                        <span>-<Money value={totalDiscount} /></span>
                    </div>
                )}
                {totalDiscount > 0 && (
                    <div className="flex justify-between text-slate-700 font-semibold">
                        <span>Subtotal Neto:</span>
                        <span className="font-bold text-slate-900"><Money value={netSubtotal} /></span>
                    </div>
                )}
                <div className="flex justify-between text-indigo-700 font-semibold">
                    <span>Propina Sugerida ({tipPercentage}%):</span>
                    <span className="font-bold"><Money value={tipAmount} /></span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Total Sugerido:</span>
                    <span className="text-base text-indigo-600"><Money value={grandTotal} /></span>
                </div>
            </div>

            {/* Acciones Rápidas (Pre-cuenta, Descuento, Cambiar mesa, Dividir) */}
            {order?.id && (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                        type="button"
                        onClick={onOpenPreAccount}
                        className="py-2 px-1 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex flex-col items-center gap-1 transition-colors"
                    >
                        <Printer size={15} className="text-slate-600" />
                        <span className="truncate">Pre-cuenta</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onOpenDiscount(null)}
                        className={`py-2 px-1 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-colors ${
                            order.discount_type && order.discount_type !== 'none'
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                        title="Aplicar descuento o cortesía"
                    >
                        <Tag size={15} className={order.discount_type && order.discount_type !== 'none' ? 'text-amber-600' : 'text-slate-600'} />
                        <span className="truncate">Descuento</span>
                    </button>
                    <button
                        type="button"
                        onClick={onOpenTransfer}
                        className="py-2 px-1 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex flex-col items-center gap-1 transition-colors"
                    >
                        <ArrowRightLeft size={15} className="text-slate-600" />
                        <span className="truncate">Mesa</span>
                    </button>
                    <button
                        type="button"
                        onClick={onOpenSplitBill}
                        className="py-2 px-1 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex flex-col items-center gap-1 transition-colors"
                    >
                        <Split size={15} className="text-slate-600" />
                        <span className="truncate">Dividir</span>
                    </button>
                </div>
            )}

            {/* Botón Principal: Marchar o Cerrar */}
            <div className="space-y-2 pt-1">
                {hasUnsentItems ? (
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onSendOrder}
                        className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-50 transition-all"
                    >
                        <Send size={15} />
                        <span>{isSubmitting ? 'Marchando...' : `Marchar Comanda (${cartItems.length} ítems)`}</span>
                    </button>
                ) : order?.id ? (
                    <button
                        type="button"
                        onClick={onCloseOrder}
                        className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all"
                    >
                        <CheckCircle2 size={16} />
                        <span>Cerrar Mesa / Liberar</span>
                    </button>
                ) : null}
            </div>
        </div>
    );
}
