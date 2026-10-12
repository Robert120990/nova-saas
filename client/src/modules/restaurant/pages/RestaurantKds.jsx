import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { UtensilsCrossed, Volume2, VolumeX, Ban, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import useRestaurantSocket from '../hooks/useRestaurantSocket';
import RestaurantKdsCard from '../components/RestaurantKdsCard';
import RestaurantUnavailableProductsModal from '../components/modals/RestaurantUnavailableProductsModal';

export default function RestaurantKds() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedStation, setSelectedStation] = useState('all');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [modalAgotadosOpen, setModalAgotadosOpen] = useState(false);

    const companyId = user?.company_id;
    const branchId = user?.branch_id;

    // Conexión WebSocket en tiempo real
    const handleSocketEvent = useCallback((event, data) => {
        if (data?.branch_id && branchId && Number(data.branch_id) !== Number(branchId)) {
            return;
        }
        if (event === 'restaurant:new_order') {
            toast.info(`¡Nueva comanda recibida! Mesa ${data?.table_number || data?.customer_name || ''}`);
            queryClient.invalidateQueries({ queryKey: ['restaurant-kds-orders'] });
        } else if (event === 'restaurant:item_cancelled') {
            toast.error(`⚠️ PLATILLO ANULADO: ${data?.reason || ''}`);
            queryClient.invalidateQueries({ queryKey: ['restaurant-kds-orders'] });
        } else if (event === 'restaurant:course_fired' || event === 'restaurant:order_updated') {
            queryClient.invalidateQueries({ queryKey: ['restaurant-kds-orders'] });
        }
    }, [queryClient, branchId]);

    const { isConnected, playTone } = useRestaurantSocket({
        companyId,
        onEvent: handleSocketEvent
    });

    // Consultas vinculadas a la sucursal activa
    const { data: stations = [] } = useQuery({
        queryKey: ['restaurant-stations', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/stations', { params: { branch_id: branchId } }))
    });

    const { data: restaurantConfig } = useQuery({
        queryKey: ['restaurant-config', branchId],
        queryFn: async () => (await axios.get('/api/restaurant/config', { params: { branch_id: branchId } })).data?.data || {}
    });

    const { data: rawCategories = [] } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    const allowedCategoryIds = Array.isArray(restaurantConfig?.allowed_categories) && restaurantConfig.allowed_categories.length > 0
        ? new Set(restaurantConfig.allowed_categories.map(Number))
        : null;

    const categories = allowedCategoryIds
        ? (Array.isArray(rawCategories) ? rawCategories : []).filter(c => allowedCategoryIds.has(Number(c.id)))
        : (Array.isArray(rawCategories) ? rawCategories : []);

    const { data: orders = [], isLoading, refetch } = useQuery({
        queryKey: ['restaurant-kds-orders', selectedStation, branchId],
        queryFn: async () => {
            const url = selectedStation !== 'all'
                ? `/api/restaurant/kds/orders?station_id=${selectedStation}`
                : '/api/restaurant/kds/orders';
            const res = await axios.get(url, { params: { branch_id: branchId } });
            return res.data?.data || [];
        },
        refetchInterval: 10000 // Refresco de seguridad cada 10s
    });

    const { data: unavailableProducts = [] } = useQuery({
        queryKey: ['restaurant-unavailable-products', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/kds/unavailable-products', { params: { branch_id: branchId } }))
    });

    const { data: allProducts = [] } = useQuery({
        queryKey: ['restaurant-catalog-products', branchId, restaurantConfig?.allowed_categories],
        queryFn: async () => {
            const params = { branch_id: branchId, status: 'activo', limit: 1000 };
            if (allowedCategoryIds && allowedCategoryIds.size > 0) {
                params.category_ids = Array.from(allowedCategoryIds).join(',');
            }
            return unwrapList(await axios.get('/api/products', { params }));
        }
    });

    // Mutaciones KDS
    const updateItemStatusMutation = useMutation({
        mutationFn: async ({ orderId, itemId, status }) => {
            return axios.put(`/api/restaurant/kds/orders/${orderId}/items/${itemId}/status`, { status });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant-kds-orders'] })
    });

    const updateOrderStatusMutation = useMutation({
        mutationFn: async ({ orderId, status, stationId }) => {
            return axios.put(`/api/restaurant/kds/orders/${orderId}/status`, { status, station_id: stationId });
        },
        onSuccess: () => {
            toast.success('Comanda actualizada');
            queryClient.invalidateQueries({ queryKey: ['restaurant-kds-orders'] });
        }
    });

    const fireCourseMutation = useMutation({
        mutationFn: async ({ orderId, course }) => {
            return axios.put(`/api/restaurant/orders/${orderId}/fire-course`, { course });
        },
        onSuccess: () => {
            toast.success('Platos fuertes marchados');
            queryClient.invalidateQueries({ queryKey: ['restaurant-kds-orders'] });
        }
    });

    const toggle86Mutation = useMutation({
        mutationFn: async ({ productId, isUnavailable }) => {
            return axios.post('/api/restaurant/kds/toggle-product-86', {
                branch_id: branchId || null,
                product_id: productId,
                is_unavailable: isUnavailable
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['restaurant-unavailable-products'] });
        }
    });

    const unavailableIds = new Set((Array.isArray(unavailableProducts) ? unavailableProducts : []).map(u => u.product_id));

    return (
        <div className="space-y-4 min-h-screen">
            {/* Barra Superior KDS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-3xl shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
                        <UtensilsCrossed size={20} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-black text-base tracking-tight">KDS Cocina & Barra</h1>
                            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} title={isConnected ? 'Conectado a WebSocket' : 'Desconectado'} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                            {orders.length} comandas en preparación • Pantalla táctil de despacho
                        </p>
                    </div>
                </div>

                {/* Filtros de Estación y Controles */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
                        <button
                            onClick={() => setSelectedStation('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                selectedStation === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Todas
                        </button>
                        {(Array.isArray(stations) ? stations : []).map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedStation(String(s.id))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    selectedStation === String(s.id) ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setModalAgotadosOpen(true)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Gestionar platillos o ingredientes agotados"
                    >
                        <Ban size={14} />
                        <span>Platillos Agotados ({unavailableIds.size})</span>
                    </button>

                    <button
                        onClick={() => {
                            setSoundEnabled(!soundEnabled);
                            if (!soundEnabled) playTone('chime');
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title={soundEnabled ? 'Silenciar alertas' : 'Activar sonido'}
                    >
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>

                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Refrescar comanda"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Grilla de Tarjetas KDS */}
            {isLoading ? (
                <div className="text-center py-20 text-slate-400 text-xs animate-pulse">Cargando comandas en cocina...</div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-xs">
                    <CheckCircle size={40} className="mx-auto text-emerald-500 mb-2" />
                    <h3 className="text-base font-extrabold text-slate-800">Cocina al día</h3>
                    <p className="text-xs text-slate-400 mt-1">No hay comandas pendientes de preparación en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {orders.map(order => (
                        <RestaurantKdsCard
                            key={order.id}
                            order={order}
                            selectedStation={selectedStation}
                            onUpdateItemStatus={(orderId, itemId, status) => updateItemStatusMutation.mutate({ orderId, itemId, status })}
                            onUpdateOrderStatus={(orderId, status) => updateOrderStatusMutation.mutate({ orderId, status, stationId: selectedStation })}
                            onFireCourse={(orderId, course) => fireCourseMutation.mutate({ orderId, course })}
                        />
                    ))}
                </div>
            )}

            {/* Modal de Platillos Agotados en Cocina */}
            <RestaurantUnavailableProductsModal
                isOpen={modalAgotadosOpen}
                onClose={() => setModalAgotadosOpen(false)}
                catalogProducts={allProducts}
                categories={categories}
                unavailableProductIds={unavailableIds}
                onToggleUnavailable={(data) => toggle86Mutation.mutate(data)}
                isLoading={toggle86Mutation.isPending}
            />
        </div>
    );
}
