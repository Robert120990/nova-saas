import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Fuel,
    Search,
    RefreshCw,
    Eye,
    X,
    Clock,
    CheckCircle2,
    AlertCircle,
    Info,
    FileText,
    Layers,
    PackageCheck,
} from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import {
    GasOrderConfirmSeenModal,
    GasOrderMethodModal,
    GasOrderReceiveModal,
    GasOrderDetailModal,
} from '../components/gas/orders';

function formatNumber(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-SV', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getStatusBadge(estado) {
    const est = String(estado || '').toUpperCase();
    if (est === 'PENDIENTE') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                PENDIENTE
            </span>
        );
    }
    if (est === 'VISTO') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <Eye className="w-3.5 h-3.5" />
                VISTO
            </span>
        );
    }
    if (est === 'RECIBIDO') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                RECIBIDO
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Info className="w-3.5 h-3.5" />
            {est || 'OTRO'}
        </span>
    );
}

export default function GasOrders() {
    const queryClient = useQueryClient();

    const [statusFilter, setStatusFilter] = useState('PENDIENTE');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal states
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [confirmSeenOrder, setConfirmSeenOrder] = useState(null);
    const [selectMethodOrder, setSelectMethodOrder] = useState(null); // Dialog asking Cheque vs Transferencia
    const [receivingOrder, setReceivingOrder] = useState(null);
    const [receiveMethod, setReceiveMethod] = useState('CHEQUE'); // 'CHEQUE' | 'TRANSFERENCIA'

    // Main orders query
    const { data: responseData, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['gas-orders', statusFilter, searchTerm, startDate, endDate],
        queryFn: async () => {
            const params = {
                status: statusFilter,
                search: searchTerm,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            };
            const res = await axios.get('/api/gas-station/orders', { params });
            return res.data;
        },
        staleTime: 60 * 1000,
    });

    // Mark as Seen Mutation
    const markSeenMutation = useMutation({
        mutationFn: async (orderId) => {
            const res = await axios.patch(`/api/gas-station/orders/${orderId}/seen`);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Pedido marcado como visto exitosamente');
            queryClient.invalidateQueries({ queryKey: ['gas-orders'] });
            setConfirmSeenOrder(null);
            if (selectedOrder) {
                setSelectedOrder(prev => prev ? { ...prev, estado: 'VISTO' } : null);
            }
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Error al marcar como visto');
        }
    });

    const isUnconfigured = responseData?.unconfigured;
    const stationId = responseData?.stationId;
    const branchName = responseData?.branchName;
    const orders = responseData?.data || [];
    const summary = responseData?.summary || {
        totalOrders: 0,
        totalDiesel: 0,
        totalRegular: 0,
        totalSuper: 0,
        totalIon: 0,
        totalGallons: 0,
    };

    // Step 1: Open Method Selection dialog
    const handleInitiateReceive = (order) => {
        setSelectMethodOrder(order);
    };

    // Step 2: Open Receive Modal with chosen method
    const handleSelectReceiveMethod = (method, order = selectMethodOrder) => {
        if (!order) return;
        setReceiveMethod(method);
        setReceivingOrder(order);
        setSelectMethodOrder(null);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Fuel className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">Consulta de Pedidos</h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Monitoreo, confirmación y recepción de pedidos de combustible desde RRS
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto justify-start sm:justify-end">
                    {stationId ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Estación RRS: <strong>{stationId}</strong> {branchName ? `(${branchName})` : ''}</span>
                        </div>
                    ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-xs font-medium text-amber-700">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span>Sin estación RRS configurada</span>
                        </div>
                    )}

                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                        title="Refrescar lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                        <span>Actualizar</span>
                    </button>
                </div>
            </div>

            {/* Warning if station is not configured */}
            {isUnconfigured && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                        <p className="font-semibold text-amber-900">Estación de RRS no configurada para esta sucursal</p>
                        <p>
                            Para consultar pedidos en línea, debe definir el código de estación (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">rrs_id_empresa</code>) en{' '}
                            <strong>Gasolinera &gt; Configuración</strong>.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Pedidos {statusFilter === 'TODOS' ? '' : statusFilter.toLowerCase()}</span>
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Layers className="w-4 h-4" />
                        </div>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-800 tracking-tight font-mono">{summary.totalOrders}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">En el listado actual</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Diésel</span>
                        <span className="w-3 h-3 rounded-full bg-slate-700" title="Diésel" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-800 tracking-tight font-mono">{formatNumber(summary.totalDiesel)} <span className="text-xs font-normal text-slate-500">gln</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Galones pedidos</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Regular</span>
                        <span className="w-3 h-3 rounded-full bg-amber-500" title="Regular" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-800 tracking-tight font-mono">{formatNumber(summary.totalRegular)} <span className="text-xs font-normal text-slate-500">gln</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Galones pedidos</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Súper</span>
                        <span className="w-3 h-3 rounded-full bg-rose-500" title="Súper" />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-800 tracking-tight font-mono">{formatNumber(summary.totalSuper)} <span className="text-xs font-normal text-slate-500">gln</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Galones pedidos</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-2xl border border-indigo-200/80 shadow-sm col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-700 uppercase">Total Galones</span>
                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                            <Fuel className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <p className="mt-2 text-xl font-black text-indigo-900 tracking-tight font-mono">{formatNumber(summary.totalGallons)} <span className="text-xs font-normal text-indigo-700">gln</span></p>
                    <p className="text-[11px] text-indigo-600 mt-0.5">Suma de productos</p>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                    {/* Status Tabs */}
                    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('PENDIENTE')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statusFilter === 'PENDIENTE'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Pendientes / Vistos
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('RECIBIDO')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statusFilter === 'RECIBIDO'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Recibidos
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('TODOS')}
                            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                                statusFilter === 'TODOS'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Todos
                        </button>
                    </div>

                    {/* Search & Dates */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 md:justify-end">
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar pedido, documento, referencia..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3.5 py-1.5 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-2.5 py-1.5 text-[12px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                                    title="Fecha desde"
                                />
                            </div>
                            <span className="text-slate-400 text-xs">-</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-2.5 py-1.5 text-[12px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                                    title="Fecha hasta"
                                />
                            </div>
                            {(startDate || endDate || searchTerm) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setSearchTerm('');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    title="Limpiar filtros"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className="text-xs font-medium text-slate-500">Cargando pedidos desde RRS...</span>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <Fuel className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mt-2">No se encontraron pedidos</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                            {isUnconfigured
                                ? 'Configure la estación de RRS en la configuración de gasolinera.'
                                : statusFilter === 'PENDIENTE'
                                ? 'No hay pedidos pendientes o vistos para la estación en este momento.'
                                : 'No se encontraron resultados con los filtros aplicados.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-4">Pedido #</th>
                                    <th className="py-3 px-4">Fecha</th>
                                    <th className="py-3 px-4">Estado</th>
                                    <th className="py-3 px-4 text-right">Diésel</th>
                                    <th className="py-3 px-4 text-right">Regular</th>
                                    <th className="py-3 px-4 text-right">Súper</th>
                                    <th className="py-3 px-4 text-right">Total Gln</th>
                                    <th className="py-3 px-4">Forma de Pago / Referencia</th>
                                    <th className="py-3 px-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {orders.map((order) => {
                                    const pDiesel = parseFloat(order.p_diesel) || 0;
                                    const pRegular = parseFloat(order.p_regular) || 0;
                                    const pSuper = parseFloat(order.p_super) || 0;
                                    const totalGln = order.total_galones || 0;
                                    const est = String(order.estado || '').toUpperCase();

                                    return (
                                        <tr key={order.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                                                {order.numero || `#${order.id}`}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                                {formatDate(order.fecha)}
                                            </td>
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {getStatusBadge(order.estado)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">
                                                {pDiesel > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                                                        {formatNumber(pDiesel)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">
                                                {pRegular > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold">
                                                        {formatNumber(pRegular)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono">
                                                {pSuper > 0 ? (
                                                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 font-semibold">
                                                        {formatNumber(pSuper)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                                                {formatNumber(totalGln)}
                                            </td>
                                            <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={order.forma_pago}>
                                                {order.forma_pago || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="inline-flex items-center justify-center gap-1">
                                                    {/* Marcar como Visto: solo visible en PENDIENTE */}
                                                    {est === 'PENDIENTE' && (
                                                        <button
                                                            onClick={() => setConfirmSeenOrder(order)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                            title="Marcar pedido como visto"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span className="hidden sm:inline">Visto</span>
                                                        </button>
                                                    )}

                                                    {/* Recibir Pedido: solo visible si el estado es VISTO */}
                                                    {est === 'VISTO' && (
                                                        <button
                                                            onClick={() => handleInitiateReceive(order)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                            title="Recibir pedido y registrar descarga"
                                                        >
                                                            <PackageCheck className="w-3.5 h-3.5" />
                                                            <span className="hidden sm:inline">Recibir</span>
                                                        </button>
                                                    )}

                                                    {/* Ver Detalle */}
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                        title="Ver detalle del pedido"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal: Confirm Marcar como Visto */}
            <GasOrderConfirmSeenModal
                open={!!confirmSeenOrder}
                order={confirmSeenOrder}
                onClose={() => setConfirmSeenOrder(null)}
                onConfirm={(id) => markSeenMutation.mutate(id)}
                isLoading={markSeenMutation.isPending}
            />

            {/* Modal: Selector de Método de Pago al Recibir */}
            <GasOrderMethodModal
                open={!!selectMethodOrder}
                order={selectMethodOrder}
                onClose={() => setSelectMethodOrder(null)}
                onSelectMethod={(method) => handleSelectReceiveMethod(method)}
            />

            {/* Modal: Recibir Pedido (Cheque o Transferencia) */}
            <GasOrderReceiveModal
                open={!!receivingOrder}
                order={receivingOrder}
                initialMethod={receiveMethod}
                onClose={() => setReceivingOrder(null)}
                onSuccess={() => {
                    setReceivingOrder(null);
                    if (selectedOrder) setSelectedOrder(null);
                }}
            />

            {/* Modal: Order Detail Modal */}
            <GasOrderDetailModal
                open={!!selectedOrder}
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onMarkSeen={(ord) => {
                    setSelectedOrder(null);
                    setConfirmSeenOrder(ord);
                }}
                onReceive={(ord) => {
                    setSelectedOrder(null);
                    handleInitiateReceive(ord);
                }}
            />
        </div>
    );
}
