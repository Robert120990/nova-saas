import { useProductionCalendarModel, ProductionCalendarAlterDateItemModal, ProductionCalendarHeader, ProductionCalendarFiltersBar, ProductionCalendarContent, ProductionCalendarActionBar, ProductionCalendarSection5, ProductionCalendarSection6, ProductionCalendarSection7 } from '../../components/egg/productionCalendar';




import RawMaterialPlannerModal from '../../components/egg/RawMaterialPlannerModal';
import EggCustomerOrderModal from '../../components/egg/EggCustomerOrderModal';
import EggCalendarPreviewPopover from '../../components/egg/EggCalendarPreviewPopover';
export default function ProductionCalendar() {
 const model = useProductionCalendarModel();
 const { currentDate, isPlannerModalOpen, setIsPlannerModalOpen, isCustomerOrderModalOpen, setIsCustomerOrderModalOpen, selectedOrderToEdit, setSelectedOrderToEdit, hoverPreview, fetchSuggestions, fetchOrders } = model;
 return (<div className="space-y-4 sm:space-y-6 pb-12">
            {/* CABECERA PRINCIPAL CON ESTÉTICA PREMIUM */}
            <ProductionCalendarHeader model={model} />

            {/* BARRA DE CONTROLES: NAVEGACIÓN DE FECHA, VISTAS Y FILTROS */}
            <ProductionCalendarFiltersBar model={model} />

            {/* ========================================================================= */}
            {/* VISTA 1: CUADRÍCULA MENSUAL CON DRAG AND DROP */}
            {/* ========================================================================= */}
            <ProductionCalendarContent model={model} />

            {/* ========================================================================= */}
            {/* VISTA 2: LISTA / AGENDA TABULAR */}
            {/* ========================================================================= */}
            <ProductionCalendarActionBar model={model} />

            {/* ========================================================================= */}
            {/* MODAL 1: CREAR / EDITAR PRODUCCIÓN PROGRAMADA Y ROLES DE FÁBRICA */}
            {/* ========================================================================= */}
            <ProductionCalendarSection5 model={model} />

            {/* ========================================================================= */}
            {/* MODAL 2: MOTOR DE SUGERENCIAS INTELIGENTES (ARBITRAJE Y OPTIMIZACIÓN) */}
            {/* ========================================================================= */}
            <ProductionCalendarSection6 model={model} />

            {/* ========================================================================= */}
            {/* MODAL 3: GESTIÓN DE PEDIDOS DE CLIENTES DE OVOPRODUCTOS */}
            {/* ========================================================================= */}
            <ProductionCalendarSection7 model={model} />

            {/* MODAL NORMALIZADO DE PEDIDO DE CLIENTE */}
            <EggCustomerOrderModal
                isOpen={isCustomerOrderModalOpen}
                onClose={() => {
                    setIsCustomerOrderModalOpen(false);
                    setSelectedOrderToEdit(null);
                }}
                orderToEdit={selectedOrderToEdit}
                onOrderSaved={() => {
                    fetchOrders();
                    fetchSuggestions();
                }}
            />

            {/* MODAL PARA ALTERAR FECHA DE PRODUCCIÓN / PEDIDO */}
            <ProductionCalendarAlterDateItemModal model={model} />

            {/* ========================================================================= */}
            {/* MODAL 4: PLANIFICADOR DE MATERIA PRIMA E INSUMOS (MRP) */}
            {/* ========================================================================= */}
            <RawMaterialPlannerModal
                isOpen={isPlannerModalOpen}
                onClose={() => setIsPlannerModalOpen(false)}
                initialDate={currentDate}
            />

            {/* ========================================================================= */}
            {/* POPOVER FLOTANTE INTELIGENTE: PREVIEW DE PEDIDOS Y PRODUCCIONES AL HOVER */}
            {/* ========================================================================= */}
            <EggCalendarPreviewPopover hoverPreview={hoverPreview} />
        </div>);
}
