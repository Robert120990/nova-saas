import { useEggDispatchModel, EggDispatchMotoristaTab, EggDispatchFlotaTab, EggDispatchCalendarioTab, EggDispatchRutasTab, EggDispatchHeader, EggDispatchFiltersBar, EggDispatchContent, EggDispatchActionBar, EggDispatchSection5, EggDispatchSection6, EggDispatchSection7 } from '../../components/egg/eggDispatch';


import RouteAutoInvoicingModal from '../../components/egg/RouteAutoInvoicingModal';
import PdfViewerModal from '../../components/ui/PdfViewerModal';
export default function EggDispatch() {
 const model = useEggDispatchModel();
 const { autoInvoiceModalOpen, setAutoInvoiceModalOpen, pdfPreviewModal, handleClosePdfPreview, routeDetail, fetchOrders, fetchRoutes, fetchRouteDetail } = model;
 return (<div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Principal */}
            <EggDispatchHeader model={model} />

            {/* Selector de Pestañas */}
            <EggDispatchFiltersBar model={model} />

            {/* ========================================================================= */}
            {/* PESTAÑA 1: CALENDARIO DE PEDIDOS */}
            {/* ========================================================================= */}
            <EggDispatchCalendarioTab model={model} />

            {/* ========================================================================= */}
            {/* PESTAÑA 2: PLANIFICADOR DE RUTAS & MAPA */}
            {/* ========================================================================= */}
            <EggDispatchRutasTab model={model} />

            {/* ========================================================================= */}
            {/* PESTAÑA 3: FLOTA Y MANTENIMIENTO */}
            {/* ========================================================================= */}
            <EggDispatchFlotaTab model={model} />

            {/* ========================================================================= */}
            {/* PESTAÑA 4: MODO MOTORISTA (MÓVIL) */}
            {/* ========================================================================= */}
            <EggDispatchMotoristaTab model={model} />

            {/* ========================================================================= */}
            {/* MODAL 1: NUEVO / EDITAR PEDIDO DE CLIENTE */}
            {/* ========================================================================= */}
            {/* MODAL NORMALIZADO DE PEDIDOS DE CLIENTES */}
            <EggDispatchContent model={model} />

            {/* ========================================================================= */}
            {/* MODAL 2: CREAR / CONFIGURAR RUTA DE DESPACHO */}
            {/* ========================================================================= */}
            <EggDispatchActionBar model={model} />

            {/* ========================================================================= */}
            {/* MODAL 3: AGREGAR / EDITAR VEHÍCULO */}
            {/* ========================================================================= */}
            <EggDispatchSection5 model={model} />

            {/* ========================================================================= */}
            {/* MODAL 4: REGISTRAR MANTENIMIENTO */}
            {/* ========================================================================= */}
            <EggDispatchSection6 model={model} />

            {/* ========================================================================= */}
            {/* MODAL 5: ESCÁNER QR DTE & CONFIRMACIÓN DE ENTREGA */}
            {/* ========================================================================= */}
            <EggDispatchSection7 model={model} />

            {/* ========================================================================= */}
            {/* MODAL 6: FACTURACIÓN AUTOMÁTICA DE RUTA Y ASIGNACIÓN DE LOTES */}
            {/* ========================================================================= */}
            <RouteAutoInvoicingModal
                isOpen={autoInvoiceModalOpen}
                onClose={() => setAutoInvoiceModalOpen(false)}
                route={routeDetail}
                onInvoiceSuccess={() => {
                    if (routeDetail?.id) {
                        fetchRouteDetail(routeDetail.id);
                    }
                    fetchRoutes();
                    fetchOrders();
                }}
            />

            {/* ========================================================================= */}
            {/* MODAL 7: VISUALIZADOR E IMPRESOR INTERACTIVO DE PDF */}
            {/* ========================================================================= */}
            <PdfViewerModal
                isOpen={pdfPreviewModal.isOpen}
                onClose={handleClosePdfPreview}
                title={pdfPreviewModal.title}
                subtitle={pdfPreviewModal.subtitle}
                pdfUrl={pdfPreviewModal.url}
                fileName={pdfPreviewModal.fileName}
                footerNote={pdfPreviewModal.footerNote}
            />
        </div>);
}
