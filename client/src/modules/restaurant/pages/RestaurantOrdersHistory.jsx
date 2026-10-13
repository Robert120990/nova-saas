import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import { getTodayString } from '../../../utils/dateUtils';
import {
    OrderHistoryFiltersBar,
    OrderHistorySummaryCards,
    OrderHistoryTable,
    OrderDetailModal
} from '../components';
import { printThermalTickets } from '../utils/printTicket';

export default function RestaurantOrdersHistory() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const branchId = user?.branch_id;

    // Filtros
    const today = getTodayString();
    const [filters, setFilters] = useState({
        status: 'all',
        startDate: today,
        endDate: today,
        search: '',
        waiterId: '',
        orderType: 'all'
    });

    const [selectedOrder, setSelectedOrder] = useState(null);

    // Consulta de comandas
    const {
        data: rawOrders = [],
        isLoading,
        refetch,
        isFetching
    } = useQuery({
        queryKey: ['restaurant-orders-history', branchId, filters],
        queryFn: async () => {
            const params = {
                branch_id: branchId,
                status: filters.status,
                start_date: filters.startDate || undefined,
                end_date: filters.endDate || undefined,
                search: filters.search || undefined,
                waiter_id: filters.waiterId || undefined,
                order_type: filters.orderType !== 'all' ? filters.orderType : undefined
            };
            const res = await axios.get('/api/restaurant/orders', { params });
            return unwrapList(res);
        }
    });

    // Consulta de meseros para filtro
    const { data: rawWaiters = [] } = useQuery({
        queryKey: ['restaurant-waiters-list', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/waiters', { params: { branch_id: branchId } }))
    });

    const orders = useMemo(() => Array.isArray(rawOrders) ? rawOrders : [], [rawOrders]);
    const waiters = useMemo(() => Array.isArray(rawWaiters) ? rawWaiters : [], [rawWaiters]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleResetFilters = () => {
        setFilters({
            status: 'all',
            startDate: today,
            endDate: today,
            search: '',
            waiterId: '',
            orderType: 'all'
        });
    };

    const handleReprintTicket = (order) => {
        if (!order) return;
        const items = Array.isArray(order.items) ? order.items : [];
        const ticket = {
            companyName: user?.company_name || 'RESTAURANTE',
            tableName: order.order_type === 'mesa' ? `Mesa ${order.table_number || ''}` : (order.order_type === 'para_llevar' ? 'Para Llevar' : 'Delivery'),
            orderId: order.id,
            title: order.customer_name ? `Cliente: ${order.customer_name}` : 'COPIA DE CUENTA',
            waiterName: order.waiter_name || user?.nombre,
            dateStr: today,
            timeStr: new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }),
            items: items.map(i => ({
                name: i.product_name,
                qty: Number(i.quantity) || 1,
                unitPrice: Number(i.unit_price) || 0,
                total: (Number(i.quantity) || 1) * (Number(i.unit_price) || 0)
            })),
            subtotal: Number(order.subtotal || 0),
            discount: Number(order.discount_amount || 0),
            tipPct: Number(order.tip_percentage || 0),
            tipAmount: Number(order.tip_amount || 0),
            total: Number(order.total_with_tip || order.subtotal || 0)
        };
        printThermalTickets([ticket]);
    };

    return (
        <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto animate-in fade-in duration-200">
            {/* Cabecera Principal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/restaurant/comandas')}
                        className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
                        title="Volver a Terminal de Mesas"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black text-slate-900 leading-tight">
                                Consulta de Comandas
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Restaurante
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            Historial operativo, auditoría y consulta de comandas finalizadas con o sin DTE fiscal.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="px-3.5 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Actualizar listado"
                    >
                        <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Actualizar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/restaurant/comandas')}
                        className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-200 transition-all"
                    >
                        <UtensilsCrossed size={15} />
                        <span>Toma de Comandas</span>
                    </button>
                </div>
            </div>

            {/* Tarjetas de Resumen KPI */}
            <OrderHistorySummaryCards orders={orders} />

            {/* Barra de Filtros */}
            <OrderHistoryFiltersBar
                filters={filters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
                waiters={waiters}
            />

            {/* Tabla de Resultados */}
            <OrderHistoryTable
                orders={orders}
                isLoading={isLoading}
                onViewDetail={(o) => setSelectedOrder(o)}
                onReprintTicket={handleReprintTicket}
            />

            {/* Modal de Detalle Completo de la Comanda */}
            <OrderDetailModal
                isOpen={Boolean(selectedOrder)}
                onClose={() => setSelectedOrder(null)}
                order={selectedOrder}
                onReprintTicket={handleReprintTicket}
            />
        </div>
    );
}
