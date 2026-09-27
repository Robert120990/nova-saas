

import EggCustomerOrderModal from '../EggCustomerOrderModal';


export default function EggDispatchContent({ model }) {
    const { selectedDate, orderModalOpen, setOrderModalOpen, editingOrder, setEditingOrder, selectedRoute, routeDetail, fetchOrders, fetchRoutes, fetchRouteDetail } = model;

    return (<EggCustomerOrderModal
                isOpen={orderModalOpen}
                onClose={() => {
                    setOrderModalOpen(false);
                    setEditingOrder(null);
                }}
                orderToEdit={editingOrder}
                onOrderSaved={async () => {
                    await fetchOrders();
                    await fetchRoutes();
                    const activeRouteId = routeDetail?.id || selectedRoute?.id || (typeof selectedRoute === 'number' ? selectedRoute : null);
                    if (activeRouteId) {
                        await fetchRouteDetail(activeRouteId);
                    }
                }}
                defaultDate={selectedDate}
            />);
}
