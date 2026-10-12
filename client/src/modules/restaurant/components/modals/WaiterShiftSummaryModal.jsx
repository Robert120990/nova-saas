import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../../../../components/ui/Modal';
import { Printer, Calendar, User, Gift } from 'lucide-react';
import Money from '../../../../components/ui/Money';
import { useAuth } from '../../../../context/AuthContext';
import { unwrapList } from '../../../../utils/apiUtils';
import { formatDate, formatTime } from '../../../../utils/dateUtils';
import { printShiftSummaryThermalTicket } from '../../utils/printTicket';

export default function WaiterShiftSummaryModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const branchId = user?.branch_id;

    const todayStr = new Date().toISOString().slice(0, 10);
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [selectedWaiterId, setSelectedWaiterId] = useState(user?.id ? String(user.id) : '');

    const { data: waiters = [] } = useQuery({
        queryKey: ['restaurant-waiters', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/waiters', { params: { branch_id: branchId } })),
        enabled: isOpen
    });

    const activeWaiterId = selectedWaiterId || (user?.id ? String(user.id) : '');

    const { data: summaryData, isLoading } = useQuery({
        queryKey: ['waiter-shift-summary', activeWaiterId, selectedDate, branchId],
        queryFn: async () => {
            const res = await axios.get('/api/restaurant/waiters/shift-summary', {
                params: { waiter_id: activeWaiterId, date: selectedDate, branch_id: branchId }
            });
            return res.data?.data;
        },
        enabled: isOpen && Boolean(activeWaiterId),
        staleTime: 0,
        refetchOnMount: 'always'
    });

    if (!isOpen) return null;

    const metrics = summaryData?.metrics || {};
    const orders = summaryData?.orders || [];
    const waiterInfo = summaryData?.waiter || { name: user?.nombre || 'Mesero' };

    const handlePrintSummary = () => {
        printShiftSummaryThermalTicket({
            companyName: user?.company_name || 'RESTAURANTE',
            waiterName: waiterInfo.name,
            dateStr: formatDate(selectedDate),
            timeStr: formatTime(new Date()),
            metrics,
            orders
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Cierre de Turno y Arqueo de Propinas"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                {/* Filtros de Fecha y Mesero */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                        <Calendar size={15} className="text-slate-400 shrink-0" />
                        <div className="flex items-center gap-1.5 flex-1">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white"
                            />
                            {selectedDate !== todayStr && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(todayStr)}
                                    className="px-2 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg shrink-0"
                                >
                                    Hoy
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <User size={15} className="text-slate-400 shrink-0" />
                        <select
                            value={activeWaiterId}
                            onChange={(e) => setSelectedWaiterId(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white"
                        >
                            {waiters.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400">Cargando métricas de turno...</div>
                ) : (
                    <>
                        {/* KPI Cards Principales */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Propinas Turno</span>
                                <div className="text-xl font-black text-emerald-700 mt-0.5">
                                    <Money value={metrics.total_tips || 0} />
                                </div>
                                <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                                    {metrics.closed_orders || 0} comandas pagadas
                                </span>
                            </div>

                            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                                <span className="text-[10px] font-bold text-indigo-800 uppercase block">Ventas Netas</span>
                                <div className="text-xl font-black text-indigo-700 mt-0.5">
                                    <Money value={metrics.net_sales || 0} />
                                </div>
                                <span className="text-[10px] text-indigo-500 font-semibold block mt-0.5">
                                    Total: <Money value={metrics.total_collected || 0} />
                                </span>
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Comandas</span>
                                <div className="text-xl font-black text-slate-800 mt-0.5">
                                    {metrics.total_orders || 0}
                                </div>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                    {metrics.open_orders || 0} aún abiertas
                                </span>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                                <span className="text-[10px] font-bold text-amber-800 uppercase block">Cortesías</span>
                                <div className="text-xl font-black text-amber-700 mt-0.5">
                                    <Money value={metrics.total_discounts || 0} />
                                </div>
                                <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                                    Descuentos otorgados
                                </span>
                            </div>
                        </div>

                        {/* Listado de Comandas Atendidas */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase px-1">
                                <span>Detalle de Comandas Atendidas ({orders.length})</span>
                                <span>Propina</span>
                            </div>

                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
                                {orders.length === 0 ? (
                                    <p className="text-xs text-slate-400 text-center py-6">
                                        No hay comandas registradas para este mesero en la fecha seleccionada.
                                    </p>
                                ) : (
                                    orders.map(order => {
                                        const isFacturada = order.status === 'facturada';
                                        return (
                                            <div
                                                key={order.id}
                                                className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-2 shadow-2xs"
                                            >
                                                <div className="space-y-0.5 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-black text-slate-900">
                                                            {order.table_number || order.customer_name || 'Para Llevar'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold">#{order.id}</span>
                                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase ${
                                                            isFacturada ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {isFacturada ? 'PAGADA' : 'ABIERTA'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                        <span>{formatTime(order.opened_at)}</span>
                                                        <span>•</span>
                                                        <span>{order.total_items} ítems</span>
                                                        {Number(order.discount_amount || 0) > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                                                    <Gift size={10} /> -<Money value={order.discount_amount} />
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="font-extrabold text-emerald-700 text-xs">
                                                        <Money value={order.tip_amount || 0} />
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                        Consumo: <Money value={order.total_with_tip || order.subtotal} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* Acciones */}
                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        disabled={orders.length === 0}
                        onClick={handlePrintSummary}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-200 disabled:opacity-50"
                    >
                        <Printer size={15} />
                        <span>Imprimir Arqueo de Turno (58mm)</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
}
