import { useState } from 'react';
import { Users, ShoppingBag, Truck, Plus, User, Clock } from 'lucide-react';
import Money from '../../../components/ui/Money';
import { formatTime } from '../../../utils/dateUtils';

const formatElapsed = (dateStr) => {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return '0 min';
    const totalMinutes = Math.floor(diffMs / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
};

export default function RestaurantTableGrid({
    tables = [],
    areas = [],
    activeOrders = [],
    onSelectTable,
    onStartTakeout
}) {
    const [selectedAreaId, setSelectedAreaId] = useState('all');
    const [orderMode, setOrderMode] = useState('mesa'); // 'mesa', 'para_llevar', 'delivery'

    const filteredTables = selectedAreaId === 'all'
        ? tables
        : tables.filter(t => String(t.area_id) === String(selectedAreaId));

    const takeoutOrders = activeOrders.filter(o => o.order_type === 'para_llevar');
    const deliveryOrders = activeOrders.filter(o => o.order_type === 'delivery');

    return (
        <div className="space-y-4">
            {/* Selector de Tipo de Servicio: Mesas vs Para Llevar vs Delivery */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                    type="button"
                    onClick={() => setOrderMode('mesa')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        orderMode === 'mesa' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    <Users size={14} />
                    <span>En Salón</span>
                </button>
                <button
                    type="button"
                    onClick={() => setOrderMode('para_llevar')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        orderMode === 'para_llevar' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    <ShoppingBag size={14} />
                    <span>Para Llevar ({takeoutOrders.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setOrderMode('delivery')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        orderMode === 'delivery' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    <Truck size={14} />
                    <span>Delivery ({deliveryOrders.length})</span>
                </button>
            </div>

            {orderMode === 'mesa' ? (
                <div className="space-y-3">
                    {/* Filtro de Áreas */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        <button
                            onClick={() => setSelectedAreaId('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                selectedAreaId === 'all'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            Todas
                        </button>
                        {(Array.isArray(areas) ? areas : []).map(a => (
                            <button
                                key={a.id}
                                onClick={() => setSelectedAreaId(String(a.id))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                    selectedAreaId === String(a.id)
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {a.name}
                            </button>
                        ))}
                    </div>

                    {/* Grilla de Mesas (Táctil, grande para pulgar) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {(Array.isArray(filteredTables) ? filteredTables : []).map(table => {
                            const isOccupied = table.status === 'ocupada';
                            const isBillRequested = table.status === 'cuenta_pedida';

                            return (
                                <button
                                    key={table.id}
                                    type="button"
                                    onClick={() => onSelectTable(table)}
                                    className={`p-4 rounded-3xl border-2 text-left transition-all active:scale-95 flex flex-col justify-between min-h-[110px] ${
                                        isOccupied
                                            ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400'
                                            : isBillRequested
                                                ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400'
                                                : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between w-full gap-2">
                                        <div className="min-w-0">
                                            <span className="text-base font-black text-slate-900 leading-tight block truncate">
                                                {table.table_number}
                                            </span>
                                            {table.order_opened_at && (isOccupied || isBillRequested) && (
                                                <div
                                                    className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded-md mt-1 border border-amber-300/60"
                                                    title={`Hora de inicio: ${formatTime(table.order_opened_at)}`}
                                                >
                                                    <Clock size={10} className="text-amber-600 shrink-0" />
                                                    <span>{formatElapsed(table.order_opened_at)}</span>
                                                    <span className="text-amber-700/70 font-normal">({formatTime(table.order_opened_at).slice(0, 5)})</span>
                                                </div>
                                            )}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                                            isOccupied
                                                ? 'bg-rose-100 text-rose-700 border-rose-300'
                                                : isBillRequested
                                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        }`}>
                                            {isOccupied ? 'OCUPADA' : isBillRequested ? 'CUENTA' : 'LIBRE'}
                                        </span>
                                    </div>

                                    <div className="mt-2.5 w-full">
                                        {isOccupied || isBillRequested ? (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-extrabold text-slate-900">
                                                        <Money value={table.active_subtotal || 0} />
                                                    </span>
                                                    <span className="text-[11px] font-bold text-slate-500">
                                                        {Number(table.active_orders_count || 1) > 1
                                                            ? `${table.active_orders_count} cuentas`
                                                            : `${table.active_items_count || 0} ítems`}
                                                    </span>
                                                </div>
                                                {table.waiter_name && (
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-900 bg-white/90 px-2 py-1 rounded-xl border border-indigo-100/80 truncate shadow-2xs">
                                                        <User size={11} className="shrink-0 text-indigo-600" />
                                                        <span className="truncate">{table.waiter_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                                                <Users size={12} />
                                                <span>{table.capacity} comensales</span>
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Lista de Órdenes Para Llevar o Delivery */
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={() => onStartTakeout(orderMode)}
                        className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
                    >
                        <Plus size={16} />
                        <span>Nueva Orden {orderMode === 'para_llevar' ? 'Para Llevar' : 'a Domicilio'}</span>
                    </button>

                    <div className="space-y-2">
                        {(orderMode === 'para_llevar' ? takeoutOrders : deliveryOrders).map(order => (
                            <div
                                key={order.id}
                                onClick={() => onSelectTable({ id: null, order_id: order.id, order })}
                                className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer flex items-center justify-between"
                            >
                                <div>
                                    <h4 className="font-extrabold text-sm text-slate-900">{order.customer_name || 'Sin nombre'}</h4>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span>Comanda #{order.id} • {order.total_items || 0} platillos</span>
                                        {order.opened_at && (
                                            <span
                                                className="inline-flex items-center gap-1 text-slate-600 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md"
                                                title={`Hora de inicio: ${formatTime(order.opened_at)}`}
                                            >
                                                <Clock size={10} className="text-amber-500" />
                                                <span className="font-bold">{formatElapsed(order.opened_at)}</span>
                                                <span className="text-slate-400 font-normal">({formatTime(order.opened_at).slice(0, 5)})</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-indigo-700">
                                        <Money value={order.total_with_tip || order.subtotal || 0} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{order.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
