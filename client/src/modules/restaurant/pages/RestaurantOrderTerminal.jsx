import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import useRestaurantSocket from '../hooks/useRestaurantSocket';
import Money from '../../../components/ui/Money';
import {
    RestaurantTableGrid, RestaurantProductCatalog, RestaurantCartSheet,
    RestaurantTerminalHeader, RestaurantItemModifierModal, TableTransferModal,
    ItemCancelModal, SplitBillModal, RestaurantPreAccountModal, TakeoutOrderModal,
    OrderDiscountModal, WaiterShiftSummaryModal, RestaurantFinalizeModal
} from '../components';

export default function RestaurantOrderTerminal() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company_id;
    const branchId = user?.branch_id;

    // Estados de navegación
    const [selectedTable, setSelectedTable] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [cartItems, setCartItems] = useState([]);
    const [activeTab, setActiveTab] = useState('tables');

    // Estados de modales
    const [modifierModalOpen, setModifierModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [itemToCancel, setItemToCancel] = useState(null);
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [preAccountOpen, setPreAccountOpen] = useState(false);
    const [discountModalOpen, setDiscountModalOpen] = useState(false);
    const [itemToDiscount, setItemToDiscount] = useState(null);
    const [shiftSummaryOpen, setShiftSummaryOpen] = useState(false);
    const [takeoutModalOpen, setTakeoutModalOpen] = useState(false);
    const [takeoutType, setTakeoutType] = useState('para_llevar');
    const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);

    // WebSocket en tiempo real
    const refreshAll = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
        queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
    }, [queryClient]);

    const handleSocketEvent = useCallback((event, data) => {
        if (data?.branch_id && branchId && Number(data.branch_id) !== Number(branchId)) return;
        if (event === 'restaurant:order_ready') toast.success(`🍽️ ¡Comanda lista! ${data?.tableNumber || ''}`);
        refreshAll();
    }, [refreshAll, branchId]);

    const { isConnected } = useRestaurantSocket({ companyId, onEvent: handleSocketEvent });

    const { data: areas = [] } = useQuery({
        queryKey: ['restaurant-areas', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/areas', { params: { branch_id: branchId } }))
    });

    const { data: tables = [] } = useQuery({
        queryKey: ['restaurant-tables', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/tables', { params: { branch_id: branchId } }))
    });

    const { data: activeOrders = [] } = useQuery({
        queryKey: ['restaurant-orders', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/orders', { params: { branch_id: branchId } }))
    });

    const { data: restaurantConfig } = useQuery({
        queryKey: ['restaurant-config', branchId],
        queryFn: async () => (await axios.get('/api/restaurant/config', { params: { branch_id: branchId } })).data?.data || {}
    });

    const hasConfiguredCategories = Array.isArray(restaurantConfig?.allowed_categories) && restaurantConfig.allowed_categories.length > 0;
    const allowedCategoryIds = hasConfiguredCategories ? new Set(restaurantConfig.allowed_categories.map(Number)) : null;

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    const { data: products = [] } = useQuery({
        queryKey: ['restaurant-products', branchId, restaurantConfig?.allowed_categories],
        queryFn: async () => {
            if (!hasConfiguredCategories || !allowedCategoryIds || allowedCategoryIds.size === 0) return [];
            return unwrapList(await axios.get('/api/products', {
                params: { branch_id: branchId, category_ids: Array.from(allowedCategoryIds).join(','), status: 'activo', limit: 1000 }
            }));
        },
        enabled: Boolean(hasConfiguredCategories)
    });

    const { data: modifierGroups = [] } = useQuery({
        queryKey: ['restaurant-modifiers-groups'],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/modifiers/groups'))
    });

    const { data: unavailableProducts = [] } = useQuery({
        queryKey: ['restaurant-unavailable-products', branchId],
        queryFn: async () => unwrapList(await axios.get('/api/restaurant/kds/unavailable-products', { params: { branch_id: branchId } }))
    });

    const filteredCategories = hasConfiguredCategories
        ? (Array.isArray(categories) ? categories : []).filter(c => allowedCategoryIds.has(Number(c.id)))
        : [];

    const filteredProducts = hasConfiguredCategories
        ? (Array.isArray(products) ? products : []).filter(p => allowedCategoryIds.has(Number(p.category_id)))
        : [];

    const unavailableIds = new Set((Array.isArray(unavailableProducts) ? unavailableProducts : []).map(u => u.product_id));

    // Cuentas activas asociadas a la mesa o pedido seleccionado
    const tableOrders = activeOrders.filter(o =>
        (selectedTable?.id && o.table_id === selectedTable.id) ||
        (selectedTable?.order_id && o.id === selectedTable.order_id)
    );

    const currentOrder = (selectedOrderId && tableOrders.find(o => o.id === selectedOrderId))
        || tableOrders[0]
        || null;

    const handleSelectTable = (table) => {
        setSelectedTable(table);
        setSelectedOrderId(table?.order_id || null);
        setCartItems([]);
        setActiveTab('order');
    };

    const handleStartTakeout = (type) => {
        setTakeoutType(type);
        setTakeoutModalOpen(true);
    };

    const handleConfirmTakeout = (data) => {
        setSelectedTable({
            id: null,
            table_number: data.order_type === 'para_llevar' ? 'Para Llevar' : 'Delivery',
            order_type: data.order_type,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            delivery_address: data.delivery_address,
            notes: data.notes
        });
        setSelectedOrderId(null);
        setCartItems([]);
        setActiveTab('order');
    };

    const sendOrderMutation = useMutation({
        mutationFn: async () => {
            if (currentOrder?.id) {
                return axios.post(`/api/restaurant/orders/${currentOrder.id}/items`, { items: cartItems });
            } else {
                return axios.post('/api/restaurant/orders', {
                    branch_id: branchId || null,
                    table_id: selectedTable?.id || null,
                    order_type: selectedTable?.order_type || 'mesa',
                    customer_name: selectedTable?.customer_name || null,
                    items: cartItems
                });
            }
        },
        onSuccess: () => {
            toast.success('¡Comanda marchada a cocina!');
            setCartItems([]);
            refreshAll();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al marchar comanda')
    });

    return (
        <div className="space-y-4 max-w-6xl mx-auto pb-8">
            <RestaurantTerminalHeader
                activeTab={activeTab}
                selectedTable={selectedTable}
                currentOrder={currentOrder}
                user={user}
                isConnected={isConnected}
                onBackToTables={() => { setActiveTab('tables'); setSelectedTable(null); setSelectedOrderId(null); }}
                onViewTables={() => setActiveTab('tables')}
                onOpenShiftSummary={() => setShiftSummaryOpen(true)}
            />

            {/* Vista 1: Mapa de Mesas y Órdenes */}
            {activeTab === 'tables' ? (
                <RestaurantTableGrid
                    tables={tables}
                    areas={areas}
                    activeOrders={activeOrders}
                    onSelectTable={handleSelectTable}
                    onStartTakeout={handleStartTakeout}
                />
            ) : (
                /* Vista 2: Toma de Pedido (Catálogo + Comanda) */
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    <div className="md:col-span-7 bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
                        <RestaurantProductCatalog
                            products={filteredProducts}
                            categories={filteredCategories}
                            unavailableProductIds={unavailableIds}
                            hasConfiguredCategories={hasConfiguredCategories}
                            onSelectProduct={(p) => { setSelectedProduct(p); setModifierModalOpen(true); }}
                        />
                    </div>

                    <div className="md:col-span-5 space-y-2">
                        {/* Selector de sub-cuentas cuando la mesa está dividida */}
                        {tableOrders.length > 1 && (
                            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
                                {tableOrders.map((ord, idx) => (
                                    <button
                                        key={ord.id}
                                        type="button"
                                        onClick={() => setSelectedOrderId(ord.id)}
                                        className={`flex-1 min-w-[120px] py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1.5 ${
                                            currentOrder?.id === ord.id
                                                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100 font-black'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <span className="truncate">{ord.customer_name || `Cuenta #${idx + 1}`}</span>
                                        <span className="text-[11px] shrink-0 font-extrabold text-indigo-600">
                                            <Money value={ord.total_with_tip || ord.subtotal} />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <RestaurantCartSheet
                            order={currentOrder}
                            cartItems={cartItems}
                            onRemoveLocalItem={(idx) => setCartItems(prev => prev.filter((_, i) => i !== idx))}
                            onRequestCancelItem={(item) => { setItemToCancel(item); setCancelModalOpen(true); }}
                            onSendOrder={() => sendOrderMutation.mutate()}
                            onOpenPreAccount={() => setPreAccountOpen(true)}
                            onOpenTransfer={() => setTransferModalOpen(true)}
                            onOpenSplitBill={() => setSplitModalOpen(true)}
                            onOpenDiscount={(item) => { setItemToDiscount(item); setDiscountModalOpen(true); }}
                            onCloseOrder={() => setFinalizeModalOpen(true)}
                            isSubmitting={sendOrderMutation.isPending}
                        />
                    </div>
                </div>
            )}

            {/* Modales Controlados */}
            <RestaurantItemModifierModal
                isOpen={modifierModalOpen}
                onClose={() => setModifierModalOpen(false)}
                product={selectedProduct}
                modifierGroups={modifierGroups}
                onConfirm={(itemPayload) => setCartItems(prev => [...prev, itemPayload])}
            />

            <TableTransferModal
                isOpen={transferModalOpen}
                onClose={() => setTransferModalOpen(false)}
                currentTable={selectedTable}
                tables={tables}
                onSuccess={() => { refreshAll(); setActiveTab('tables'); }}
            />

            <ItemCancelModal
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                orderId={currentOrder?.id}
                item={itemToCancel}
                onSuccess={refreshAll}
            />

            <SplitBillModal
                isOpen={splitModalOpen}
                onClose={() => setSplitModalOpen(false)}
                order={currentOrder}
                onSuccess={(newId) => {
                    refreshAll();
                    if (newId) setSelectedOrderId(newId);
                }}
            />

            <OrderDiscountModal
                isOpen={discountModalOpen}
                onClose={() => { setDiscountModalOpen(false); setItemToDiscount(null); }}
                order={currentOrder}
                initialItem={itemToDiscount}
            />

            <WaiterShiftSummaryModal
                isOpen={shiftSummaryOpen}
                onClose={() => setShiftSummaryOpen(false)}
            />

            <RestaurantPreAccountModal
                isOpen={preAccountOpen}
                onClose={() => setPreAccountOpen(false)}
                order={currentOrder}
            />

            <TakeoutOrderModal
                isOpen={takeoutModalOpen}
                onClose={() => setTakeoutModalOpen(false)}
                orderType={takeoutType}
                onConfirm={handleConfirmTakeout}
            />

            <RestaurantFinalizeModal
                isOpen={finalizeModalOpen}
                onClose={() => setFinalizeModalOpen(false)}
                order={currentOrder}
                branchId={branchId}
                user={user}
                onSuccess={() => {
                    const remaining = tableOrders.filter(o => o.id !== currentOrder?.id);
                    if (remaining.length > 0) {
                        setSelectedOrderId(remaining[0].id);
                    } else {
                        setSelectedTable(null);
                        setSelectedOrderId(null);
                        setActiveTab('tables');
                    }
                    refreshAll();
                }}
            />
        </div>
    );
}
