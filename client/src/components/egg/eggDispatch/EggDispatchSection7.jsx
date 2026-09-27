import DteQrDeliveryScannerModal from '../DteQrDeliveryScannerModal';




export default function EggDispatchSection7({ model }) {
    const { routeDetail, deliveryScannerModalOpen, setDeliveryScannerModalOpen, selectedStopToDeliver, setSelectedStopToDeliver, fetchOrders, fetchRouteDetail, fetchDriverRoutes } = model;

    return (<DteQrDeliveryScannerModal
                isOpen={deliveryScannerModalOpen}
                onClose={() => {
                    setDeliveryScannerModalOpen(false);
                    setSelectedStopToDeliver(null);
                }}
                stop={selectedStopToDeliver}
                onDeliveryConfirmed={() => {
                    if (routeDetail?.id) {
                        fetchRouteDetail(routeDetail.id);
                    }
                    fetchDriverRoutes();
                    fetchOrders();
                }}
            />);
}
