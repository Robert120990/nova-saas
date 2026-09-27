import { getTodayString } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';


import { getIndustrialPresentationWeightLbs } from '../../../constants/eggIndustrialCatalogs';
const _PRODUCT_PROFILES = [
    'Huevo Entero Pasteurizado',
    'Huevo Formulado por Separación',
    'Huevo Entero Plus',
    'Clara de Huevo Pasteurizada',
    'Yema Azucarada',
    'Yema Salada',
    'Huevo con Leche',
    'Huevo en Cáscara'
];
const _PRESENTATIONS = [
    'cubeta 30LB',
    'cubeta 32LB',
    'galon 8LB',
    'medio galon 4LB',
    'litro 2LB',
    'bolsa 20LB'
];
export default function useEggDispatchModel() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Pestaña activa: 'calendario' | 'rutas' | 'flota' | 'motorista'
    const initialTab = searchParams.get('tab') || 'calendario';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Estados generales
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(getTodayString(new Date()));
    const [dateFilterMode, setDateFilterMode] = useState('dia'); // 'dia' | 'semana' | 'mes' | 'todos'
    const [clientFilter, setClientFilter] = useState('');

    // =========================================================================
    // 1. ESTADO: PEDIDOS Y CALENDARIO
    // =========================================================================
    const [orders, setOrders] = useState([]);
    const [orderModalOpen, setOrderModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [orderStatusFilter, setOrderStatusFilter] = useState('todos');
    const [orderPriorityFilter, setOrderPriorityFilter] = useState('todos');
    const [autoInvoiceModalOpen, setAutoInvoiceModalOpen] = useState(false);

    // Estados de impresión y visor PDF
    const [pdfPreviewModal, setPdfPreviewModal] = useState({
        isOpen: false,
        url: null,
        title: '',
        subtitle: '',
        fileName: '',
        footerNote: ''
    });
    const [printingOrderId, setPrintingOrderId] = useState(null);
    const [printingManifest, setPrintingManifest] = useState(false);

    const handleClosePdfPreview = () => {
        if (pdfPreviewModal.url) {
            window.URL.revokeObjectURL(pdfPreviewModal.url);
        }
        setPdfPreviewModal({
            isOpen: false,
            url: null,
            title: '',
            subtitle: '',
            fileName: '',
            footerNote: ''
        });
    };

    const handlePrintOrderReceipt = async (orderId) => {
        if (!orderId) return;
        setPrintingOrderId(orderId);
        const toastId = toast.loading('Generando comprobante de entrega...');
        try {
            const res = await axios.get(`/api/egg-industrial/orders/${orderId}/delivery-receipt`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setPdfPreviewModal({
                isOpen: true,
                url: blobUrl,
                title: 'Comprobante de Despacho y Entrega',
                subtitle: `Pedido #${orderId} • Ovoproductos y Huevo Industrial`,
                fileName: `Comprobante_Entrega_Pedido_${orderId}.pdf`,
                footerNote: 'Documento Operativo de Entrega • Planta Industrial de Ovoproductos'
            });
            toast.dismiss(toastId);
        } catch (err) {
            console.error('Error al generar comprobante de entrega:', err);
            toast.error(err.response?.data?.message || 'Error al generar o visualizar el comprobante de entrega.', { id: toastId });
        } finally {
            setPrintingOrderId(null);
        }
    };

    const handlePrintRouteManifest = async (routeId, format = 'pdf', includeDtes = false) => {
        if (!routeId) return;
        if (format === 'excel') {
            const toastId = toast.loading('Exportando manifiesto a Excel...');
            try {
                const res = await axios.get(`/api/egg-industrial/dispatch/routes/${routeId}/manifest-pdf?format=excel`, {
                    responseType: 'blob'
                });
                const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Manifiesto_Ruta_${routeId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Manifiesto exportado a Excel exitosamente.', { id: toastId });
            } catch (err) {
                console.error('Error al exportar a Excel:', err);
                toast.error('Error al exportar el manifiesto a Excel.', { id: toastId });
            }
            return;
        }

        setPrintingManifest(includeDtes ? 'with_dtes' : 'only_manifest');
        const toastId = toast.loading(includeDtes ? 'Generando manifiesto con facturas DTE anexadas...' : 'Generando manifiesto de carga y ruta...');
        try {
            const url = `/api/egg-industrial/dispatch/routes/${routeId}/manifest-pdf${includeDtes ? '?include_dtes=true' : ''}`;
            const res = await axios.get(url, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setPdfPreviewModal({
                isOpen: true,
                url: blobUrl,
                title: includeDtes ? 'Manifiesto de Carga + Facturas DTE' : 'Manifiesto de Carga y Hoja de Ruta',
                subtitle: `Ruta de Despacho #${routeId} • Planta Industrial${includeDtes ? ' (con DTEs unificados)' : ''}`,
                fileName: `Manifiesto_Despacho_Ruta_${routeId}${includeDtes ? '_con_DTEs' : ''}.pdf`,
                footerNote: 'Control de Despacho y Logística • Hoja de Ruta Oficial'
            });
            toast.dismiss(toastId);
        } catch (err) {
            console.error('Error al generar manifiesto de ruta:', err);
            toast.error(err.response?.data?.message || 'Error al generar o visualizar el manifiesto de ruta.', { id: toastId });
        } finally {
            setPrintingManifest(false);
        }
    };

    const getOrderItems = (orderOrStop) => {
        if (!orderOrStop) return [];
        if (orderOrStop.items_json) {
            try {
                const parsed = typeof orderOrStop.items_json === 'string'
                    ? JSON.parse(orderOrStop.items_json)
                    : orderOrStop.items_json;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (e) {
                console.error('Error parseando items_json:', e);
            }
        }
        return [
            {
                product_type: orderOrStop.product_type || 'Ovoproducto Líquido',
                presentation: orderOrStop.presentation || 'cubeta 30LB',
                quantity_lbs: orderOrStop.quantity_lbs || 0,
                price_per_lb: orderOrStop.price_per_lb || 0,
                lot_code: orderOrStop.lot_code || orderOrStop.lot_code_display || orderOrStop.order_lot_code || orderOrStop.linked_batch_code || null
            }
        ];
    };

    const getItemUnits = (item) => {
        const rawU = item?.quantity_units ?? item?.units;
        if (rawU !== undefined && rawU !== null && rawU !== '' && parseFloat(rawU) > 0) {
            return parseFloat(rawU);
        }
        const factor = getIndustrialPresentationWeightLbs(item?.presentation, 30) || 30;
        const lbs = parseFloat(item?.quantity_lbs || 0);
        return factor > 0 ? Math.max(1, Math.round(lbs / factor)) : 1;
    };

    const getOrderTotalUnits = (orderOrStop) => {
        const items = getOrderItems(orderOrStop);
        if (!items || items.length === 0) {
            const factor = getIndustrialPresentationWeightLbs(orderOrStop?.presentation, 30) || 30;
            const lbs = parseFloat(orderOrStop?.quantity_lbs || 0);
            return factor > 0 ? Math.max(1, Math.round(lbs / factor)) : 1;
        }
        return items.reduce((sum, it) => sum + getItemUnits(it), 0);
    };

    // =========================================================================
    // 2. ESTADO: RUTAS Y PLANIFICADOR
    // =========================================================================
    const [routes, setRoutes] = useState([]);
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [routeDetail, setRouteDetail] = useState(null);
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [editingRouteId, setEditingRouteId] = useState(null);
    const [optimizingRoute, setOptimizingRoute] = useState(false);
    const [savingRoute, setSavingRoute] = useState(false);

    // Formulario de Ruta
    const [routeForm, setRouteForm] = useState({
        codigo_ruta: '',
        fecha_despacho: getTodayString(new Date()),
        vehicle_id: '',
        driver_id: '',
        driver_name: '',
        driver_phone: '',
        hora_salida_estimada: '07:00:00',
        notas_ruta: '',
        selectedOrderIds: []
    });

    // =========================================================================
    // 3. ESTADO: FLOTA Y MANTENIMIENTO
    // =========================================================================
    const [vehicles, setVehicles] = useState([]);
    const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [vehicleForm, setVehicleForm] = useState({
        codigo: '',
        placa: '',
        marca: '',
        modelo: '',
        anio: new Date().getFullYear(),
        tipo_vehiculo: 'camion_refrigerado',
        capacidad_peso_lbs: 10000,
        capacidad_cubetas: 350,
        tiene_termo_king: true,
        odometro_actual: 0,
        estado: 'disponible',
        notas: ''
    });

    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
    const [maintenanceForm, setMaintenanceForm] = useState({
        vehicle_id: '',
        tipo_mantenimiento: 'preventivo',
        fecha_programada: getTodayString(new Date()),
        fecha_realizada: '',
        odometro: '',
        taller_proveedor: '',
        costo_total: 0,
        descripcion: '',
        repuestos_cambiados: '',
        estado: 'programado',
        proximo_servicio_km: '',
        proximo_servicio_fecha: '',
        notas: ''
    });

    // =========================================================================
    // 4. ESTADO: MODO MOTORISTA Y ESCÁNER QR
    // =========================================================================
    const [driverRoutes, setDriverRoutes] = useState([]);
    const [activeDriverRouteId, setActiveDriverRouteId] = useState(null);
    const [deliveryScannerModalOpen, setDeliveryScannerModalOpen] = useState(false);
    const [selectedStopToDeliver, setSelectedStopToDeliver] = useState(null);

    // Catálogos generales
    const [factoryUsers, setFactoryUsers] = useState([]);

    // Sincronizar parámetro URL
    useEffect(() => {
        setSearchParams({ tab: activeTab });
    }, [activeTab]);

    // Carga inicial
    useEffect(() => {
        fetchVehicles();
        fetchOrders();
        fetchRoutes();
        fetchFactoryUsers();
    }, []);

    // Cargar cuando cambia la pestaña o fecha
    useEffect(() => {
        if (activeTab === 'calendario') {
            fetchOrders();
        } else if (activeTab === 'rutas') {
            fetchRoutes();
            fetchVehicles();
        } else if (activeTab === 'flota') {
            fetchVehicles();
            fetchMaintenanceLogs();
        } else if (activeTab === 'motorista') {
            fetchDriverRoutes();
        }
    }, [activeTab, selectedDate]);

    // Cargar detalle de ruta si hay una seleccionada
    useEffect(() => {
        if (selectedRoute?.id) {
            fetchRouteDetail(selectedRoute.id);
        } else {
            setRouteDetail(null);
        }
    }, [selectedRoute]);

    // =========================================================================
    // API CALLS: PEDIDOS
    // =========================================================================
    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/egg-industrial/orders');
            setOrders(unwrapList(res));
        } catch (error) {
            console.error('Error al cargar pedidos:', error);
            toast.error('Error al cargar pedidos de clientes.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (id) => {
        if (!window.confirm('¿Eliminar este pedido de cliente?')) return;
        try {
            await axios.delete(`/api/egg-industrial/orders/${id}`);
            toast.success('Pedido eliminado.');
            fetchOrders();
        } catch (error) {
            console.error('Error al eliminar pedido:', error);
            toast.error('Error al eliminar pedido.');
        }
    };

    // =========================================================================
    // API CALLS: RUTAS
    // =========================================================================
    const fetchRoutes = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/dispatch/routes', {
                params: { fecha_desde: selectedDate ? `${selectedDate.substring(0, 7)}-01` : undefined }
            });
            const list = res.data || [];
            setRoutes(list);
            if (list.length > 0 && !selectedRoute) {
                setSelectedRoute(list[0]);
            }
        } catch (error) {
            console.error('Error cargando rutas:', error);
        }
    };

    const fetchRouteDetail = async (routeOrId) => {
        const routeId = typeof routeOrId === 'object' ? routeOrId?.id : routeOrId;
        if (!routeId) return null;
        try {
            const res = await axios.get(`/api/egg-industrial/dispatch/routes/${routeId}`);
            const data = res.data || null;
            setRouteDetail(data);
            return data;
        } catch (error) {
            console.error('Error al cargar detalle de ruta:', error);
            return null;
        }
    };

    const handleOpenCreateRoute = (preselectedDate = null, preselectedOrderIds = []) => {
        const targetDate = preselectedDate || selectedDate || getTodayString(new Date());
        setRouteForm({
            codigo_ruta: '',
            fecha_despacho: targetDate,
            vehicle_id: '',
            driver_id: '',
            driver_name: '',
            driver_phone: '',
            hora_salida_estimada: '07:00:00',
            notas_ruta: '',
            selectedOrderIds: preselectedOrderIds
        });
        setEditingRouteId(null);
        setRouteModalOpen(true);
    };

    const handleEditRoute = (r, detail) => {
        if (!r) return;
        const currentStopOrderIds = detail?.stops ? detail.stops.map(s => s.order_id) : [];
        setRouteForm({
            codigo_ruta: r.codigo_ruta || '',
            fecha_despacho: r.fecha_despacho ? r.fecha_despacho.split('T')[0] : selectedDate,
            vehicle_id: r.vehicle_id || '',
            driver_id: r.driver_id || '',
            driver_name: r.driver_name || '',
            driver_phone: r.driver_phone || '',
            hora_salida_estimada: r.hora_salida_estimada || '07:00:00',
            notas_ruta: r.notas_ruta || '',
            selectedOrderIds: currentStopOrderIds
        });
        setEditingRouteId(r.id);
        setRouteModalOpen(true);
    };

    const handleRemoveStopFromRoute = async (stopId, _orderId) => {
        if (!routeDetail?.id || !stopId) return;
        if (!window.confirm('¿Desea quitar este pedido de la ruta? El pedido volverá a quedar disponible para programar.')) return;
        try {
            await axios.delete(`/api/egg-industrial/dispatch/routes/${routeDetail.id}/stops/${stopId}`);
            toast.success('Pedido desvinculado de la ruta exitosamente.');
            fetchRouteDetail(routeDetail.id);
            fetchRoutes();
            fetchOrders();
        } catch (error) {
            console.error('Error al remover parada:', error);
            toast.error(error.response?.data?.message || 'Error al desvincular pedido de la ruta.');
        }
    };

    const handleSaveRoute = async (e) => {
        e.preventDefault();
        if (savingRoute) return;

        if (!routeForm.vehicle_id) {
            toast.error('Debe seleccionar un camión para la ruta.');
            return;
        }

        if (routeForm.selectedOrderIds.length === 0) {
            toast.error('Debe seleccionar al menos un pedido para armar la ruta.');
            return;
        }

        // Construir paradas a partir de los pedidos seleccionados
        const stopsPayload = routeForm.selectedOrderIds.map((orderId, idx) => {
            const ord = orders.find(o => o.id === orderId);
            return {
                order_id: orderId,
                customer_id: ord?.customer_id,
                customer_branch_id: ord?.customer_branch_id,
                prioridad: ord?.priority || 'normal',
                orden_visita: idx + 1
            };
        });

        try {
            setSavingRoute(true);
            const payload = {
                ...routeForm,
                stops: stopsPayload
            };

            if (editingRouteId) {
                await axios.put(`/api/egg-industrial/dispatch/routes/${editingRouteId}`, payload);
                toast.success('Ruta actualizada exitosamente.');
                setRouteModalOpen(false);
                fetchRoutes();
                fetchOrders();
                fetchRouteDetail(editingRouteId);
            } else {
                const res = await axios.post('/api/egg-industrial/dispatch/routes', payload);
                toast.success(res.data?.message || 'Ruta de despacho creada exitosamente.');
                setRouteModalOpen(false);
                fetchRoutes();
                fetchOrders();
                if (res.data?.id) {
                    fetchRouteDetail(res.data.id);
                }
            }
        } catch (error) {
            console.error('Error al guardar ruta:', error);
            toast.error(error.response?.data?.message || 'Error al guardar ruta de despacho.');
        } finally {
            setSavingRoute(false);
        }
    };

    const handleDeleteRoute = async (routeId) => {
        if (!window.confirm('¿Eliminar esta ruta de despacho? Los pedidos no facturados volverán a quedar disponibles en estado pendiente.')) return;
        try {
            const res = await axios.delete(`/api/egg-industrial/dispatch/routes/${routeId}`);
            toast.success(res.data?.message || 'Ruta eliminada y pedidos liberados.');
            setSelectedRoute(null);
            setRouteDetail(null);
            fetchRoutes();
            fetchOrders();
        } catch (error) {
            console.error('Error al eliminar ruta:', error);
            const msg = error.response?.data?.message || error.message || 'Error al eliminar ruta.';
            toast.error(msg);
        }
    };

    const handleOptimizeRoute = async () => {
        if (!routeDetail?.id) return;
        setOptimizingRoute(true);
        try {
            await axios.post(`/api/egg-industrial/dispatch/routes/${routeDetail.id}/optimize`);
            toast.success('¡Ruta optimizada con éxito según prioridad y cercanía geográfica!');
            fetchRouteDetail(routeDetail.id);
        } catch (error) {
            console.error('Error optimizando ruta:', error);
            toast.error('Error al optimizar la ruta.');
        } finally {
            setOptimizingRoute(false);
        }
    };

    const handleOpenAutoInvoice = async () => {
        const activeRouteId = routeDetail?.id || selectedRoute?.id || (typeof selectedRoute === 'number' ? selectedRoute : null);
        if (activeRouteId) {
            await fetchRouteDetail(activeRouteId);
        }
        setAutoInvoiceModalOpen(true);
    };

    const handleMoveStop = async (stopIndex, direction) => {
        if (!routeDetail?.stops) return;
        const currentStops = [...routeDetail.stops];
        const targetIndex = stopIndex + direction;

        if (targetIndex < 0 || targetIndex >= currentStops.length) return;

        // Intercambiar
        const temp = currentStops[stopIndex];
        currentStops[stopIndex] = currentStops[targetIndex];
        currentStops[targetIndex] = temp;

        const stopsToUpdate = currentStops.map((s, idx) => ({
            id: s.id,
            orden_visita: idx + 1
        }));

        try {
            await axios.put(`/api/egg-industrial/dispatch/routes/${routeDetail.id}/reorder`, {
                stops: stopsToUpdate
            });
            fetchRouteDetail(routeDetail.id);
        } catch (error) {
            console.error('Error al reordenar paradas:', error);
            toast.error('Error al reordenar paradas.');
        }
    };

    // =========================================================================
    // API CALLS: FLOTA Y MANTENIMIENTO
    // =========================================================================
    const fetchVehicles = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/dispatch/vehicles');
            setVehicles(unwrapList(res));
        } catch (error) {
            console.error('Error cargando vehículos:', error);
        }
    };

    const fetchMaintenanceLogs = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/dispatch/maintenance');
            setMaintenanceLogs(unwrapList(res));
        } catch (error) {
            console.error('Error cargando mantenimientos:', error);
        }
    };

    const handleSaveVehicle = async (e) => {
        e.preventDefault();
        try {
            if (editingVehicle?.id) {
                await axios.put(`/api/egg-industrial/dispatch/vehicles/${editingVehicle.id}`, vehicleForm);
                toast.success('Vehículo actualizado.');
            } else {
                await axios.post('/api/egg-industrial/dispatch/vehicles', vehicleForm);
                toast.success('Vehículo agregado a la flota.');
            }
            setVehicleModalOpen(false);
            setEditingVehicle(null);
            fetchVehicles();
        } catch (error) {
            console.error('Error al guardar vehículo:', error);
            toast.error(error.response?.data?.message || 'Error al guardar vehículo.');
        }
    };

    const handleSaveMaintenance = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/dispatch/maintenance', maintenanceForm);
            toast.success('Mantenimiento registrado exitosamente.');
            setMaintenanceModalOpen(false);
            fetchMaintenanceLogs();
            fetchVehicles();
        } catch (error) {
            console.error('Error al registrar mantenimiento:', error);
            toast.error(error.response?.data?.message || 'Error al guardar mantenimiento.');
        }
    };

    // =========================================================================
    // API CALLS: MODO MOTORISTA
    // =========================================================================
    const fetchDriverRoutes = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/dispatch/my-routes', {
                params: { fecha: selectedDate }
            });
            const dRoutes = res.data || [];
            setDriverRoutes(dRoutes);
            if (dRoutes.length > 0 && !activeDriverRouteId) {
                setActiveDriverRouteId(dRoutes[0].id);
                fetchRouteDetail(dRoutes[0].id);
            }
        } catch (error) {
            console.error('Error cargando rutas del motorista:', error);
        }
    };

    const fetchFactoryUsers = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/factory-users');
            setFactoryUsers(unwrapList(res));
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    };

    // =========================================================================
    // FILTROS Y DATOS CALCULADOS
    // =========================================================================
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            // 1. Filtro por Estado
            const matchesStatus = orderStatusFilter === 'todos' || o.delivery_status === orderStatusFilter;
            // 2. Filtro por Prioridad
            const matchesPriority = orderPriorityFilter === 'todos' || o.priority === orderPriorityFilter;
            // 3. Filtro por Cliente
            const ordClient = (o.customer_name || '').toLowerCase();
            const filterTerm = clientFilter.trim().toLowerCase();
            const matchesClient = !filterTerm || ordClient.includes(filterTerm) || String(o.customer_id) === filterTerm;

            // 4. Filtro por Fecha de Entrega (Día, Semana, Mes, Todos)
            let matchesDate = true;
            if (dateFilterMode !== 'todos') {
                const orderDateStr = o.required_delivery_date ? o.required_delivery_date.split('T')[0] : '';
                if (!orderDateStr) {
                    matchesDate = false;
                } else if (dateFilterMode === 'dia') {
                    matchesDate = orderDateStr === selectedDate;
                } else if (dateFilterMode === 'mes') {
                    matchesDate = orderDateStr.substring(0, 7) === selectedDate.substring(0, 7);
                } else if (dateFilterMode === 'semana') {
                    const target = new Date(selectedDate + 'T00:00:00');
                    const ordD = new Date(orderDateStr + 'T00:00:00');
                    const day = target.getDay() || 7;
                    const monday = new Date(target);
                    monday.setDate(target.getDate() - (day - 1));
                    const sunday = new Date(monday);
                    sunday.setDate(monday.getDate() + 6);
                    matchesDate = ordD >= monday && ordD <= sunday;
                }
            }

            return matchesStatus && matchesPriority && matchesClient && matchesDate;
        });
    }, [orders, orderStatusFilter, orderPriorityFilter, clientFilter, dateFilterMode, selectedDate]);

    // Pedidos pendientes agrupados por fecha
    const ordersByDate = useMemo(() => {
        const map = {};
        orders.forEach(o => {
            const d = o.required_delivery_date ? o.required_delivery_date.split('T')[0] : 'Sin fecha';
            if (!map[d]) map[d] = [];
            map[d].push(o);
        });
        return map;
    }, [orders]);

    // Capacidad en tiempo real del vehículo seleccionado en la ruta
    const selectedVehicleForRoute = useMemo(() => {
        return vehicles.find(v => v.id === parseInt(routeForm.vehicle_id));
    }, [vehicles, routeForm.vehicle_id]);

    // Pedidos disponibles para planificar o editar ruta
    // EXCLUYE pedidos que ya están en otra ruta o que ya fueron entregados
    const availableOrdersForRoute = useMemo(() => {
        return orders.filter(ord => {
            if (ord.delivery_status === 'entregado') return false;
            if (editingRouteId) {
                // Si estamos editando una ruta, mostrar los pedidos de esta ruta O los no asignados
                return !ord.dispatch_route_id || ord.dispatch_route_id === editingRouteId;
            }
            // Si estamos creando una ruta nueva, NO mostrar pedidos que ya tienen ruta o están en ruta
            return !ord.dispatch_route_id && ord.delivery_status !== 'en_ruta';
        });
    }, [orders, editingRouteId]);

    const calculatedLoadForNewRoute = useMemo(() => {
        let lbs = 0;
        routeForm.selectedOrderIds.forEach(id => {
            const ord = orders.find(o => o.id === id);
            if (ord) lbs += parseFloat(ord.quantity_lbs) || 0;
        });
        const cubetas = Math.ceil(lbs / 30.0);
        const maxLbs = parseFloat(selectedVehicleForRoute?.capacidad_peso_lbs) || 10000;
        const maxCubetas = parseInt(selectedVehicleForRoute?.capacidad_cubetas) || 350;
        const pctLbs = maxLbs > 0 ? (lbs / maxLbs) * 100 : 0;
        const pctCubetas = maxCubetas > 0 ? (cubetas / maxCubetas) * 100 : 0;

        return {
            totalLbs: lbs,
            totalCubetas: cubetas,
            maxLbs,
            maxCubetas,
            pctLbs: Math.min(pctLbs, 100),
            pctCubetas: Math.min(pctCubetas, 100),
            isOverload: lbs > maxLbs || cubetas > maxCubetas
        };
    }, [routeForm.selectedOrderIds, orders, selectedVehicleForRoute]);


 return { _PRODUCT_PROFILES, _PRESENTATIONS, searchParams, setSearchParams, initialTab, activeTab, setActiveTab, loading, setLoading, selectedDate, setSelectedDate, dateFilterMode, setDateFilterMode, clientFilter, setClientFilter, orders, setOrders, orderModalOpen, setOrderModalOpen, editingOrder, setEditingOrder, orderStatusFilter, setOrderStatusFilter, orderPriorityFilter, setOrderPriorityFilter, autoInvoiceModalOpen, setAutoInvoiceModalOpen, pdfPreviewModal, setPdfPreviewModal, printingOrderId, setPrintingOrderId, printingManifest, setPrintingManifest, handleClosePdfPreview, handlePrintOrderReceipt, handlePrintRouteManifest, getOrderItems, getItemUnits, getOrderTotalUnits, routes, setRoutes, selectedRoute, setSelectedRoute, routeDetail, setRouteDetail, routeModalOpen, setRouteModalOpen, editingRouteId, setEditingRouteId, optimizingRoute, setOptimizingRoute, savingRoute, setSavingRoute, routeForm, setRouteForm, vehicles, setVehicles, vehicleModalOpen, setVehicleModalOpen, editingVehicle, setEditingVehicle, vehicleForm, setVehicleForm, maintenanceLogs, setMaintenanceLogs, maintenanceModalOpen, setMaintenanceModalOpen, maintenanceForm, setMaintenanceForm, driverRoutes, setDriverRoutes, activeDriverRouteId, setActiveDriverRouteId, deliveryScannerModalOpen, setDeliveryScannerModalOpen, selectedStopToDeliver, setSelectedStopToDeliver, factoryUsers, setFactoryUsers, fetchOrders, handleDeleteOrder, fetchRoutes, fetchRouteDetail, handleOpenCreateRoute, handleEditRoute, handleRemoveStopFromRoute, handleSaveRoute, handleDeleteRoute, handleOptimizeRoute, handleOpenAutoInvoice, handleMoveStop, fetchVehicles, fetchMaintenanceLogs, handleSaveVehicle, handleSaveMaintenance, fetchDriverRoutes, fetchFactoryUsers, filteredOrders, ordersByDate, selectedVehicleForRoute, availableOrdersForRoute, calculatedLoadForNewRoute };
}
