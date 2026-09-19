import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { getIndustrialPresentationWeightLbs, isBatchCompatibleWithProduct } from '../../constants/eggIndustrialCatalogs';
import {
    CheckCircle2,
    AlertTriangle,
    FileText,
    CreditCard,
    Package,
    Search,
    Loader2,
    X,
    Receipt,
    Calendar,
    ChevronRight,
    Sparkles,
    ShieldCheck,
    Truck,
    HelpCircle,
    PlusCircle,
    Trash2,
    Copy,
    Mail
} from 'lucide-react';

const DTE_TYPE_OPTIONS = [
    { code: '01', name: '01 - Factura Consumidor Final', short: '01 Factura' },
    { code: '03', name: '03 - Comprobante Crédito Fiscal (CCF)', short: '03 CCF' },
    { code: '11', name: '11 - Factura de Exportación (FEX)', short: '11 FEX' },
    { code: '04', name: '04 - Nota de Remisión (NR)', short: '04 Remisión' }
];

export default function RouteAutoInvoicingModal({
    isOpen,
    onClose,
    route,
    onInvoiceSuccess
}) {
    // Configuración por parada: { [stopId]: { selected, dte_type, condicion_operacion, dias_credito, items } }
    const [stopsConfig, setStopsConfig] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [billingResults, setBillingResults] = useState([]);
    const [showResultsModal, setShowResultsModal] = useState(false);

    // Estado del Pop-up View Selector de Lotes
    const [lotPickerTarget, setLotPickerTarget] = useState(null); // { stopId, itemIndex, item, customerName }
    const [availableLots, setAvailableLots] = useState([]);
    const [isLoadingLots, setIsLoadingLots] = useState(false);
    const [lotSearchTerm, setLotSearchTerm] = useState('');
    const [showOnlyInStockLots, setShowOnlyInStockLots] = useState(true);

    // Inicializar configuración al abrir o cambiar la ruta
    useEffect(() => {
        if (!isOpen || !route?.stops) return;

        const initialConfig = {};
        route.stops.forEach(stop => {
            const isRejected = !!(stop.is_rejected || stop.dte_status === 'REJECTED');
            const isBilled = !isRejected && !!(
                stop.is_billed ||
                (stop.sale_sello_recepcion && (stop.sale_id || stop.sale_id_linked))
            );

            // Condición de pago por defecto: si el cliente tiene crédito activo -> Crédito (2), sino Contado (1)
            const isCredit = stop.customer_es_credito === 1;
            const condicionOperacion = isCredit ? 2 : 1;
            const diasCredito = isCredit ? (parseInt(stop.customer_dias_credito) || 15) : 0;

            // Tipo de documento DTE por defecto:
            // 1) País extranjero -> 11 (Exportación)
            // 2) Tiene NRC -> 03 (Crédito Fiscal)
            // 3) Otros -> 01 (Consumidor Final)
            const isForeign = stop.customer_pais &&
                stop.customer_pais !== '9579' &&
                stop.customer_pais !== 'SV' &&
                stop.customer_pais !== 'El Salvador';
            const hasNrc = !!(stop.customer_nrc && String(stop.customer_nrc).trim());
            const dteType = isForeign ? '11' : (hasNrc ? '03' : '01');

            // Desglosar ítems de la parada
            let items = [];
            if (stop.items_json) {
                try {
                    const parsed = typeof stop.items_json === 'string'
                        ? JSON.parse(stop.items_json)
                        : stop.items_json;
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        items = parsed.map(it => {
                            const rawUnits = it.quantity_units ?? it.units;
                            const parsedUnits = (rawUnits !== undefined && rawUnits !== null && rawUnits !== '' && parseFloat(rawUnits) > 0)
                                ? parseFloat(rawUnits)
                                : null;
                            return {
                                product_type: it.product_type || 'Huevo Entero Pasteurizado',
                                presentation: it.presentation || 'cubeta 30LB',
                                units: parsedUnits,
                                quantity_units: parsedUnits,
                                quantity_lbs: parseFloat(it.quantity_lbs || 0),
                                price_per_lb: parseFloat(it.price_per_lb || 0),
                                batch_id: it.batch_id || stop.batch_id || stop.order_batch_id || null,
                                lot_code: it.lot_code || stop.lot_code || stop.order_lot_code || stop.linked_batch_code || ''
                            };
                        });
                    }
                } catch (e) {
                    console.error('Error parseando items_json en parada:', e);
                }
            }

            if (items.length === 0) {
                const rawStopUnits = stop.quantity_units ?? stop.units;
                const parsedStopUnits = (rawStopUnits !== undefined && rawStopUnits !== null && rawStopUnits !== '' && parseFloat(rawStopUnits) > 0)
                    ? parseFloat(rawStopUnits)
                    : null;
                items = [{
                    product_type: stop.product_type || 'Huevo Entero Pasteurizado',
                    presentation: stop.presentation || 'cubeta 30LB',
                    units: parsedStopUnits,
                    quantity_units: parsedStopUnits,
                    quantity_lbs: parseFloat(stop.quantity_lbs || 0),
                    price_per_lb: parseFloat(stop.price_per_lb || 0),
                    batch_id: stop.batch_id || stop.order_batch_id || null,
                    lot_code: stop.lot_code || stop.order_lot_code || stop.linked_batch_code || ''
                }];
            }

            initialConfig[stop.id] = {
                selected: !isBilled,
                is_billed: isBilled,
                dte_type: dteType,
                condicion_operacion: condicionOperacion,
                dias_credito: diasCredito,
                items
            };
        });

        setStopsConfig(initialConfig);
    }, [isOpen, route]);

    // Cargar lotes activos al abrir el pop-up de asignación de lote
    const fetchAvailableLots = async () => {
        setIsLoadingLots(true);
        try {
            const res = await axios.get('/api/egg-industrial/traceability-360/available-lots', {
                params: { all_lots: 'true' }
            });
            setAvailableLots(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error cargando lotes disponibles:', error);
            toast.error('Error al cargar inventario de lotes.');
        } finally {
            setIsLoadingLots(false);
        }
    };

    const handleOpenLotPicker = (stopId, itemIndex, item, customerName) => {
        setLotPickerTarget({ stopId, itemIndex, item, customerName });
        setLotSearchTerm('');
        fetchAvailableLots();
    };

    const handleSelectLotForTarget = (lot) => {
        if (!lotPickerTarget) return;
        const { stopId, itemIndex, item } = lotPickerTarget;

        // 1. Alerta de existencia insuficiente (sin bloquear)
        const requiredLbs = parseFloat(item?.quantity_lbs || 0);
        const lotStockLbs = parseFloat(lot.total_weight_lbs || (lot.units_in_stock * (lot.weight_per_unit_lbs || 30)) || 0);
        const hasLowStock = lot.units_in_stock <= 0 || (requiredLbs > 0 && lotStockLbs < requiredLbs);

        // 2. Alerta de lote antiguo vs nuevo (rotación FIFO por tipo de ovoproducto)
        // Recordar: lote de huevo entero es diferente a lote de clara o yema; cada uno tiene su propia existencia
        const currentProdClean = String(lot.product_type || item?.product_type || '').trim().toLowerCase();
        const sameProductLotsWithStock = availableLots.filter(l => {
            const pClean = String(l.product_type || '').trim().toLowerCase();
            return (pClean === currentProdClean || pClean.includes(currentProdClean) || currentProdClean.includes(pClean))
                && l.units_in_stock > 0
                && (l.packaging_id !== lot.packaging_id);
        });

        // Ver si existe algún lote más antiguo en stock
        const olderAvailableLot = sameProductLotsWithStock.find(l => {
            if (l.packaging_id && lot.packaging_id && l.packaging_id < lot.packaging_id) return true;
            if (l.expiry_date && lot.expiry_date && new Date(l.expiry_date) < new Date(lot.expiry_date)) return true;
            return false;
        });

        if (hasLowStock) {
            toast.warning(`Existencia insuficiente en lote #${lot.lot_code} (Disponible: ${lot.units_in_stock} cub / ${lotStockLbs.toFixed(1)} Lbs). Se permite continuar.`, { duration: 5000 });
        } else if (olderAvailableLot) {
            toast.info(`Aviso de Rotación: Existe un lote más antiguo disponible (#${olderAvailableLot.lot_code}, ${olderAvailableLot.units_in_stock} cub) para ${lot.product_type}. Se asigna #${lot.lot_code}.`, { duration: 5500 });
        } else {
            toast.success(`Lote #${lot.lot_code} asignado al producto.`);
        }

        setStopsConfig(prev => {
            const currentStop = prev[stopId];
            if (!currentStop) return prev;
            const newItems = [...currentStop.items];
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                lot_code: lot.lot_code,
                batch_id: lot.batch_id,
                packaging_id: lot.packaging_id,
                low_stock_warning: hasLowStock,
                fifo_warning: olderAvailableLot ? olderAvailableLot.lot_code : null
            };
            return {
                ...prev,
                [stopId]: {
                    ...currentStop,
                    items: newItems
                }
            };
        });

        setLotPickerTarget(null);
    };

    // Actualizadores de configuración por parada
    const handleToggleSelectStop = (stopId) => {
        setStopsConfig(prev => {
            const curr = prev[stopId];
            if (!curr || curr.is_billed) return prev;
            return {
                ...prev,
                [stopId]: { ...curr, selected: !curr.selected }
            };
        });
    };

    const handleChangeDteType = (stopId, dteType) => {
        setStopsConfig(prev => {
            const curr = prev[stopId];
            if (!curr || curr.is_billed) return prev;
            return {
                ...prev,
                [stopId]: { ...curr, dte_type: dteType }
            };
        });
    };

    const handleChangeCondicion = (stopId, condicion) => {
        setStopsConfig(prev => {
            const curr = prev[stopId];
            if (!curr || curr.is_billed) return prev;
            return {
                ...prev,
                [stopId]: { ...curr, condicion_operacion: condicion }
            };
        });
    };

    const handleChangeDiasCredito = (stopId, dias) => {
        setStopsConfig(prev => {
            const curr = prev[stopId];
            if (!curr || curr.is_billed) return prev;
            return {
                ...prev,
                [stopId]: { ...curr, dias_credito: parseInt(dias) || 0 }
            };
        });
    };

    // Funciones para Adicionar, Editar y Eliminar Detalles Libres (sin producto/cantidad/precio obligatorios)
    const handleAddCustomDetail = (stopId) => {
        setStopsConfig(prev => {
            const currentStop = prev[stopId];
            if (!currentStop || currentStop.is_billed) return prev;
            const newItem = {
                id: 'custom-' + Date.now(),
                is_custom_detail: true,
                product_type: '',
                presentation: 'Detalle',
                quantity_lbs: '',
                price_per_lb: '',
                batch_id: null,
                lot_code: 'N/A'
            };
            return {
                ...prev,
                [stopId]: {
                    ...currentStop,
                    items: [...(currentStop.items || []), newItem]
                }
            };
        });
    };

    const handleUpdateCustomDetail = (stopId, itemIndex, field, value) => {
        setStopsConfig(prev => {
            const currentStop = prev[stopId];
            if (!currentStop || currentStop.is_billed) return prev;
            const newItems = [...currentStop.items];
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                [field]: value
            };
            return {
                ...prev,
                [stopId]: {
                    ...currentStop,
                    items: newItems
                }
            };
        });
    };

    const handleRemoveCustomDetail = (stopId, itemIndex) => {
        setStopsConfig(prev => {
            const currentStop = prev[stopId];
            if (!currentStop || currentStop.is_billed) return prev;
            const newItems = currentStop.items.filter((_, idx) => idx !== itemIndex);
            return {
                ...prev,
                [stopId]: {
                    ...currentStop,
                    items: newItems
                }
            };
        });
    };

    // Filtrar lotes en el modal de selección
    const filteredLots = useMemo(() => {
        let list = availableLots;
        if (showOnlyInStockLots) {
            list = list.filter(l => l.has_stock && (l.units_in_stock > 0 || l.total_weight_lbs > 0));
        }
        if (lotPickerTarget?.item?.product_type && !lotSearchTerm.trim()) {
            list = list.filter(l => isBatchCompatibleWithProduct(l.product_type, lotPickerTarget.item.product_type));
        }
        if (lotSearchTerm.trim()) {
            const term = lotSearchTerm.toLowerCase();
            list = list.filter(l =>
                (l.lot_code && l.lot_code.toLowerCase().includes(term)) ||
                (l.product_type && l.product_type.toLowerCase().includes(term)) ||
                (l.presentation && l.presentation.toLowerCase().includes(term)) ||
                (l.barcode && l.barcode.includes(term))
            );
        }
        return list;
    }, [availableLots, showOnlyInStockLots, lotSearchTerm, lotPickerTarget]);

    // Resumen de estado de paradas
    const stats = useMemo(() => {
        if (!route?.stops) return { total: 0, billed: 0, pending: 0, selectedCount: 0, selectedTotal: 0, missingLotsCount: 0 };
        let billed = 0;
        let pending = 0;
        let selectedCount = 0;
        let selectedTotal = 0;
        let missingLotsCount = 0;

        route.stops.forEach(s => {
            const cfg = stopsConfig[s.id];
            const isBilled = cfg ? cfg.is_billed : s.is_billed;
            if (isBilled) {
                billed++;
            } else {
                pending++;
                if (cfg?.selected) {
                    selectedCount++;
                    cfg.items.forEach(it => {
                        const price = Number.isFinite(parseFloat(it.price_per_lb)) ? parseFloat(it.price_per_lb) : 0;
                        const qty = Number.isFinite(parseFloat(it.quantity_lbs)) ? parseFloat(it.quantity_lbs) : 0;
                        if (price > 0 && qty > 0) {
                            selectedTotal += (price * qty);
                        }
                        // Solo los productos de catálogo requieren lote de inventario
                        if (!it.is_custom_detail && (!it.lot_code || !String(it.lot_code).trim())) {
                            missingLotsCount++;
                        }
                    });
                }
            }
        });

        return {
            total: route.stops.length,
            billed,
            pending,
            selectedCount,
            selectedTotal,
            missingLotsCount
        };
    }, [route?.stops, stopsConfig]);

    // Ejecución de la Facturación Automática
    const handleExecuteAutoInvoice = async () => {
        // 1. Validar que haya paradas seleccionadas
        const selectedStops = (route?.stops || []).filter(s => {
            const cfg = stopsConfig[s.id];
            return cfg?.selected && !cfg.is_billed;
        });

        if (selectedStops.length === 0) {
            toast.error('No hay paradas pendientes seleccionadas para facturar.');
            return;
        }

        // 2. Validar que los productos de catálogo tengan lote asignado y detalles libres tengan descripción
        for (const stop of selectedStops) {
            const cfg = stopsConfig[stop.id];
            for (let i = 0; i < cfg.items.length; i++) {
                const it = cfg.items[i];
                if (it.is_custom_detail) {
                    if (!it.product_type || !it.product_type.trim()) {
                        toast.warning(`Hay un detalle libre sin descripción en la parada de "${stop.customer_name}". Ingrese un texto o elimínelo.`);
                        return;
                    }
                    continue; // Exento de lote
                }
                if (!it.lot_code || !String(it.lot_code).trim()) {
                    toast.warning(
                        `Falta asignar lote para "${it.product_type}" en el pedido de "${stop.customer_name}". Se ha abierto el selector de lotes.`,
                        { duration: 6000 }
                    );
                    handleOpenLotPicker(stop.id, i, it, stop.customer_name);
                    return;
                }
            }
        }

        // 3. Confirmación
        if (!window.confirm(`¿Confirmas la facturación automática y emisión de DTEs para ${selectedStops.length} parada(s) de la ruta ${route.codigo_ruta}?`)) {
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                stops: selectedStops.map(stop => {
                    const cfg = stopsConfig[stop.id];
                    return {
                        stop_id: stop.id,
                        order_id: stop.order_id,
                        customer_id: stop.customer_id,
                        customer_branch_id: stop.customer_branch_id || null,
                        dte_type: cfg.dte_type,
                        condicion_operacion: parseInt(cfg.condicion_operacion, 10) || 1,
                        dias_credito: parseInt(cfg.dias_credito, 10) || 0,
                        items: (cfg.items || []).map(it => ({
                            ...it,
                            quantity_lbs: Number.isFinite(parseFloat(it.quantity_lbs)) ? parseFloat(it.quantity_lbs) : 0,
                            price_per_lb: Number.isFinite(parseFloat(it.price_per_lb)) ? parseFloat(it.price_per_lb) : 0,
                            batch_id: it.batch_id ? (parseInt(it.batch_id, 10) || null) : null
                        }))
                    };
                })
            };

            const res = await axios.post(`/api/egg-industrial/dispatch/routes/${route.id}/auto-invoice`, payload);
            const results = res.data?.results || [];
            toast.success(res.data?.message || 'Facturación automática completada exitosamente.');
            setBillingResults(results);
            setShowResultsModal(true);
            if (onInvoiceSuccess) {
                onInvoiceSuccess(results);
            }
        } catch (error) {
            console.error('Error en facturación automática:', error);
            const msg = error.response?.data?.message || error.message || 'Error al facturar paradas.';
            toast.error(msg, { duration: 7000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={isSubmitting ? () => {} : onClose}
            title={`Facturación Automática de Ruta: ${route?.codigo_ruta || ''}`}
            maxWidth="max-w-5xl"
            bodyClassName="p-4 md:p-6 space-y-6"
        >
            {/* 1. Barra Resumen de la Ruta */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/20 backdrop-blur-md rounded-xl border border-indigo-400/30 text-indigo-300">
                        <Truck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-indigo-400">Ruta {route?.codigo_ruta}</span>
                            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-slate-300">
                                {route?.fecha_despacho ? route.fecha_despacho.split('T')[0] : ''}
                            </span>
                        </div>
                        <h3 className="text-base font-black text-white mt-0.5">
                            {route?.vehicle_codigo} ({route?.vehicle_placa || 'Sin placa'}) • Chofer: {route?.driver_name || 'No asignado'}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Paradas</span>
                        <span className="text-sm font-black text-white">{stats.total}</span>
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold uppercase text-emerald-300 block">Ya Facturadas</span>
                        <span className="text-sm font-black text-emerald-300">{stats.billed}</span>
                    </div>
                    <div className="bg-indigo-500/20 border border-indigo-400/30 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[10px] font-bold uppercase text-indigo-300 block">Pendientes</span>
                        <span className="text-sm font-black text-indigo-200">{stats.pending}</span>
                    </div>
                </div>
            </div>

            {/* Alerta de Lotes Faltantes */}
            {stats.missingLotsCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-amber-800 text-xs">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                            <span className="font-black">Atención: Hay {stats.missingLotsCount} producto(s) sin lote asignado en las paradas seleccionadas.</span>
                            <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                                Haz clic en <span className="font-bold underline">"+ Asignar Lote"</span> en cada producto para seleccionarlo desde el inventario antes de facturar.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Lista de Paradas / Pedidos */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        <span>Paradas de la Ruta y Parámetros de Facturación</span>
                    </h4>
                    <span className="text-[11px] font-bold text-slate-400">
                        {stats.selectedCount} seleccionada(s) para emitir
                    </span>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {route?.stops?.map((stop, idx) => {
                        const cfg = stopsConfig[stop.id] || {};
                        const isBilled = cfg.is_billed;

                        return (
                            <div
                                key={stop.id}
                                className={`p-4 rounded-2xl border transition-all ${
                                    isBilled
                                        ? 'bg-emerald-50/80 border-emerald-300 opacity-95'
                                        : cfg.selected
                                        ? 'bg-white border-indigo-200 shadow-sm'
                                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                                }`}
                            >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                    {/* Cabecera de la parada */}
                                    <div className="flex items-start gap-3">
                                        <div className="pt-0.5">
                                            {isBilled ? (
                                                <div
                                                    title="Parada ya facturada. Protegida contra refacturación."
                                                    className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs"
                                                >
                                                    ✓
                                                </div>
                                            ) : (
                                                <input
                                                    type="checkbox"
                                                    checked={cfg.selected || false}
                                                    onChange={() => handleToggleSelectStop(stop.id)}
                                                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                                />
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-900">
                                                    #{stop.orden_visita} • {stop.customer_name}
                                                </span>

                                                {/* Badge de Estado Facturado vs Pendiente */}
                                                {isBilled ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                        <span>FACTURADO</span>
                                                        {stop.sale_numero_control && (
                                                            <span className="font-mono ml-0.5">#{stop.sale_numero_control}</span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                        PENDIENTE
                                                    </span>
                                                )}

                                                {stop.prioridad === 'urgente' && (
                                                    <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                                                        URGENTE
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                                                <span>Pedido #{stop.order_number || stop.order_id}</span>
                                                {stop.customer_nrc && (
                                                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                                        NRC: {stop.customer_nrc}
                                                    </span>
                                                )}
                                                {stop.customer_nit && (
                                                    <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                                        NIT: {stop.customer_nit}
                                                    </span>
                                                )}
                                                <span>📍 {stop.branch_name || stop.branch_address || 'Sucursal'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Controles de Facturación (DTE y Condición) */}
                                    {!isBilled ? (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                            {/* Selector de Tipo de DTE */}
                                            <div className="flex flex-col">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                                    Tipo Factura (DTE)
                                                </label>
                                                <select
                                                    value={cfg.dte_type || '01'}
                                                    onChange={(e) => handleChangeDteType(stop.id, e.target.value)}
                                                    className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                                >
                                                    {DTE_TYPE_OPTIONS.map(opt => (
                                                        <option key={opt.code} value={opt.code}>{opt.short}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Selector Contado / Crédito */}
                                            <div className="flex flex-col">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">
                                                    Condición de Pago
                                                </label>
                                                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChangeCondicion(stop.id, 1)}
                                                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                                                            cfg.condicion_operacion === 1
                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        Contado
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChangeCondicion(stop.id, 2)}
                                                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition ${
                                                            cfg.condicion_operacion === 2
                                                                ? 'bg-amber-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        Crédito
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Días de crédito si aplica */}
                                            {cfg.condicion_operacion === 2 && (
                                                <div className="flex flex-col w-20">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                                                        Días
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={cfg.dias_credito || 15}
                                                        onChange={(e) => handleChangeDiasCredito(stop.id, e.target.value)}
                                                        className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1 text-slate-800 text-center outline-none focus:border-amber-500"
                                                        placeholder="15"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            <span className="text-[11px] font-black text-emerald-800 uppercase block">
                                                Protegido
                                            </span>
                                            <span className="text-[10px] text-emerald-600 font-medium">
                                                No requiere refacturación
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Desglose de Productos y Lotes */}
                                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                                    {cfg.items?.map((it, itemIdx) => {
                                        // 1. Caso: Detalle Libre (sin producto, ni cantidad, ni precio obligatorios)
                                        if (it.is_custom_detail) {
                                            const customQty = parseFloat(it.quantity_lbs || 0);
                                            const customPrice = parseFloat(it.price_per_lb || 0);
                                            const hasAmount = customQty > 0 && customPrice > 0;
                                            const itemTotal = hasAmount ? (customQty * customPrice) : 0;

                                            return (
                                                <div
                                                    key={it.id || itemIdx}
                                                    className={`p-2.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs transition-all ${
                                                        isBilled
                                                            ? 'bg-white/60 border-emerald-200'
                                                            : 'bg-indigo-50/40 border-indigo-200/80 shadow-xs'
                                                    }`}
                                                >
                                                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                                                        <div className="flex items-center gap-1 text-slate-600 font-bold shrink-0">
                                                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                                            <span className="text-[10px] uppercase font-black tracking-wide">Nota / Obs:</span>
                                                        </div>
                                                        {!isBilled ? (
                                                            <input
                                                                type="text"
                                                                value={it.product_type || ''}
                                                                onChange={(e) => handleUpdateCustomDetail(stop.id, itemIdx, 'product_type', e.target.value)}
                                                                placeholder="Descripción libre (ej: Servicio de flete, observación, empaques...)"
                                                                className="flex-1 min-w-[200px] text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 outline-none focus:border-indigo-500"
                                                            />
                                                        ) : (
                                                            <span className="font-semibold text-slate-800">{it.product_type}</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                                        {!isBilled ? (
                                                            <>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-400">Cant:</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="any"
                                                                        value={it.quantity_lbs ?? ''}
                                                                        onChange={(e) => handleUpdateCustomDetail(stop.id, itemIdx, 'quantity_lbs', e.target.value)}
                                                                        placeholder="Opc"
                                                                        className="w-16 text-xs font-bold bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center text-slate-800 outline-none focus:border-indigo-500"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-400">Precio $:</span>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={it.price_per_lb ?? ''}
                                                                        onChange={(e) => handleUpdateCustomDetail(stop.id, itemIdx, 'price_per_lb', e.target.value)}
                                                                        placeholder="$0.00"
                                                                        className="w-20 text-xs font-bold bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-center text-slate-800 outline-none focus:border-indigo-500"
                                                                    />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            hasAmount && (
                                                                <span className="text-[11px] font-bold text-slate-600">
                                                                    {customQty} x <Money value={customPrice} /> = <Money value={itemTotal} />
                                                                </span>
                                                            )
                                                        )}

                                                        {hasAmount && !isBilled && (
                                                            <span className="text-xs font-black text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                                                                <Money value={itemTotal} />
                                                            </span>
                                                        )}

                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                                            Sin Lote
                                                        </span>

                                                        {!isBilled && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCustomDetail(stop.id, itemIdx)}
                                                                title="Eliminar este detalle libre"
                                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 2. Caso: Producto de Catálogo / Inventario
                                        const qtyLbs = parseFloat(it.quantity_lbs || 0);
                                        const priceLb = parseFloat(it.price_per_lb || 0);
                                        const itemTotal = qtyLbs * priceLb;
                                        const hasLot = !!(it.lot_code && String(it.lot_code).trim());

                                        let units = parseFloat(it.units ?? it.quantity_units ?? 0);
                                        if (!units || units <= 0) {
                                            const weightLbs = getIndustrialPresentationWeightLbs(it.presentation, 30) || 30;
                                            const calc = weightLbs > 0 ? (qtyLbs / weightLbs) : 1;
                                            units = Number.isInteger(calc) ? calc : Math.round(calc * 100) / 100;
                                        }

                                        return (
                                            <div
                                                key={itemIdx}
                                                className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-all ${
                                                    isBilled
                                                        ? 'bg-white/60 border-emerald-200'
                                                        : hasLot
                                                        ? 'bg-slate-50 border-slate-200 shadow-xs'
                                                        : 'bg-amber-50/80 border-amber-300 shadow-xs'
                                                }`}
                                            >
                                                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 items-center">
                                                    {/* 1. Producto */}
                                                    <div className="col-span-2 sm:col-span-1 md:col-span-2">
                                                        <span className="block text-[9px] font-black uppercase text-slate-400">Producto</span>
                                                        <span className="font-black text-slate-900 line-clamp-1">{it.product_type}</span>
                                                    </div>

                                                    {/* 2. Presentación */}
                                                    <div>
                                                        <span className="block text-[9px] font-black uppercase text-slate-400">Presentación</span>
                                                        <span className="font-bold text-slate-700">{it.presentation || 'cubeta 30LB'}</span>
                                                    </div>

                                                    {/* 3. Cant. Unidades */}
                                                    <div className="text-center sm:text-left">
                                                        <span className="block text-[9px] font-black uppercase text-slate-400">Unidades</span>
                                                        <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block">
                                                            {units} Uds
                                                        </span>
                                                    </div>

                                                    {/* 4. Cant. Libras */}
                                                    <div className="text-center sm:text-left">
                                                        <span className="block text-[9px] font-black uppercase text-slate-400">Libras (Peso)</span>
                                                        <span className="font-black text-slate-900">
                                                            {qtyLbs.toLocaleString()} Lbs
                                                        </span>
                                                    </div>

                                                    {/* 5 & 6. Precio y Total */}
                                                    <div className="text-right">
                                                        <span className="block text-[9px] font-black uppercase text-slate-400">
                                                            @ <Money value={priceLb} />/lb
                                                        </span>
                                                        <span className="font-black text-slate-900 text-sm">
                                                            <Money value={itemTotal} />
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 7. Lote & Botón Pop-up Selector */}
                                                <div className="flex items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                                    {hasLot ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                <span>Lote: {it.lot_code}</span>
                                                            </span>
                                                            {!isBilled && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenLotPicker(stop.id, itemIdx, it, stop.customer_name)}
                                                                    className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 hover:underline px-1 py-0.5"
                                                                >
                                                                    Cambiar
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg animate-pulse">
                                                                <AlertTriangle className="w-3 h-3 text-amber-700" />
                                                                <span>Sin Lote</span>
                                                            </span>
                                                            {!isBilled && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenLotPicker(stop.id, itemIdx, it, stop.customer_name)}
                                                                    className="flex items-center gap-1 text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg shadow-xs transition"
                                                                >
                                                                    <Package className="w-3 h-3" />
                                                                    <span>+ Asignar Lote</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Botón para Adicionar Detalle Libre */}
                                    {!isBilled && (
                                        <div className="pt-1.5 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleAddCustomDetail(stop.id)}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-dashed border-indigo-200 transition"
                                            >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                                <span>+ Adicionar Detalle / Nota Libre</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. Footer con Totales y Botón de Emisión */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <span className="text-xs font-bold text-slate-500 block">
                        Total Facturable ({stats.selectedCount} parada(s)):
                    </span>
                    <span className="text-xl font-black text-slate-900 tracking-tight">
                        <Money value={stats.selectedTotal} />
                    </span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleExecuteAutoInvoice}
                        disabled={isSubmitting || stats.selectedCount === 0}
                        className={`w-full sm:w-auto px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                            isSubmitting
                                ? 'bg-indigo-700 cursor-wait'
                                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Emitiendo DTEs a Hacienda...</span>
                            </>
                        ) : (
                            <>
                                <Receipt className="w-4 h-4" />
                                <span>Facturar Paradas Seleccionadas ({stats.selectedCount})</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* POP-UP VIEW: SELECTOR DE LOTE DESEADO POR PRODUCTO */}
            {/* ========================================================================= */}
            {lotPickerTarget && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Cabecera del Pop-up */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-slate-900">
                                        Seleccionar Lote de Ovoproducto
                                    </h4>
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                        Asignación
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Producto: <strong className="text-slate-800">{lotPickerTarget.item.product_type} ({lotPickerTarget.item.presentation})</strong>
                                    {' '}• Cliente: <span className="font-semibold text-indigo-700">{lotPickerTarget.customerName}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLotPickerTarget(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Buscador y Filtros */}
                        <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                            <div className="relative w-full flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={lotSearchTerm}
                                    onChange={(e) => setLotSearchTerm(e.target.value)}
                                    placeholder="Buscar por lote, producto o código..."
                                    className="w-full pl-9 pr-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                                />
                            </div>

                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 select-none cursor-pointer shrink-0">
                                <input
                                    type="checkbox"
                                    checked={showOnlyInStockLots}
                                    onChange={(e) => setShowOnlyInStockLots(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-indigo-600 rounded"
                                />
                                <span>Solo con stock disponible</span>
                            </label>
                        </div>

                        {/* Lista de Lotes */}
                        <div className="p-4 overflow-y-auto max-h-[400px] space-y-2.5">
                            {isLoadingLots ? (
                                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                                    <span>Cargando lotes disponibles en planta...</span>
                                </div>
                            ) : filteredLots.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs">
                                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="font-bold text-slate-600">No se encontraron lotes con los filtros actuales.</p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Desmarca "Solo con stock disponible" o prueba con otro término de búsqueda.
                                    </p>
                                </div>
                            ) : (
                                filteredLots.map(lot => {
                                    const hasStock = lot.has_stock && (lot.units_in_stock > 0 || lot.total_weight_lbs > 0);

                                    return (
                                        <div
                                            key={lot.packaging_id || lot.batch_id}
                                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                                hasStock
                                                    ? 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-xs'
                                                    : 'bg-rose-50/50 border-rose-200 opacity-80'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-black text-slate-900">
                                                        Lote: {lot.lot_code}
                                                    </span>
                                                    {hasStock ? (
                                                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                                                            {lot.units_in_stock} cub ({lot.total_weight_lbs || (lot.units_in_stock * 30)} Lbs)
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                                                            Sin existencias (0)
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs font-medium text-slate-700 mt-0.5">
                                                    {lot.product_type} - {lot.presentation}
                                                </p>

                                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                                                    <span>Vence: {lot.expiry_date ? lot.expiry_date.split('T')[0] : 'N/A'}</span>
                                                    <span>• Zona: {lot.warehouse_zone || 'COOLER'}</span>
                                                    <span>• Calidad: {lot.quality_status || 'Aprobado'}</span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleSelectLotForTarget(lot)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition shrink-0 ${
                                                    hasStock
                                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95'
                                                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                                }`}
                                            >
                                                Seleccionar
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer del Pop-up */}
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span>Mostrando {filteredLots.length} lotes encontrados</span>
                            <button
                                type="button"
                                onClick={() => setLotPickerTarget(null)}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE RESUMEN DE FACTURACIÓN Y RESPUESTA DE HACIENDA */}
            {showResultsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                    <CheckCircle2 size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Resultado de Facturación de Ruta
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Validación con Hacienda y Cuentas por Cobrar
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowResultsModal(false);
                                    onClose();
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {billingResults.map((res, idx) => {
                                const isAceptado = res.dte_status === 'ACEPTADO_HACIENDA';
                                const isContingencia = res.dte_status === 'CONTINGENCIA';
                                const isRechazado = res.dte_status === 'RECHAZADO_HACIENDA';
                                const isPrevia = res.already_billed || res.dte_status === 'FACTURADA_PREVIAMENTE';

                                return (
                                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                                    Cliente #{res.order_id || res.stop_id}
                                                </span>
                                                <h4 className="text-xs font-bold text-slate-900">
                                                    {res.customer_name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold">
                                                        {res.numero_control}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-md text-[10px] font-bold">
                                                        {res.condicion}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-black text-slate-900 block">
                                                    <Money value={res.total} />
                                                </span>
                                                <span className="text-[10px] font-bold text-indigo-600 block">
                                                    Venta #{res.sale_id}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Estado en Hacienda */}
                                        <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {isAceptado && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
                                                        <CheckCircle2 size={12} />
                                                        Aceptado por Hacienda
                                                    </span>
                                                )}
                                                {isContingencia && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold">
                                                        <AlertTriangle size={12} />
                                                        Contingencia
                                                    </span>
                                                )}
                                                {isRechazado && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded-full text-[10px] font-bold">
                                                        <X size={12} />
                                                        Rechazado por Hacienda
                                                    </span>
                                                )}
                                                {isPrevia && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded-full text-[10px] font-bold">
                                                        <CheckCircle2 size={12} />
                                                        Facturada Previamente
                                                    </span>
                                                )}
                                                {!isAceptado && !isContingencia && !isRechazado && !isPrevia && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-full text-[10px] font-bold">
                                                        {res.dte_status || 'Procesado'}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="text-[11px] text-slate-500 font-medium">
                                                {res.cxc_status}
                                            </div>
                                        </div>

                                        {/* Mensaje descriptivo de Hacienda o Sello */}
                                        {res.hacienda_msg && (
                                            <p className={`text-[11px] font-medium leading-relaxed ${isRechazado ? 'text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200' : 'text-slate-600'}`}>
                                                {res.hacienda_msg}
                                            </p>
                                        )}

                                        {/* Detalles adicionales de validación de Hacienda si existen */}
                                        {res.hacienda_details && (
                                            <div className="text-[10px] bg-rose-100/60 border border-rose-200 text-rose-900 rounded-lg p-2 font-mono space-y-0.5">
                                                <span className="font-bold block uppercase tracking-tight text-[9px] text-rose-800">
                                                    Observaciones de Hacienda:
                                                </span>
                                                {Array.isArray(res.hacienda_details) ? (
                                                    res.hacienda_details.map((d, dIdx) => (
                                                        <div key={dIdx}>• {typeof d === 'object' ? JSON.stringify(d) : String(d)}</div>
                                                    ))
                                                ) : (
                                                    <div>{typeof res.hacienda_details === 'object' ? JSON.stringify(res.hacienda_details) : String(res.hacienda_details)}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Sello y Código de Generación con botón de copia */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-slate-500 font-mono">
                                            {res.sello_recepcion && (
                                                <div className="flex items-center gap-1 truncate max-w-[280px]">
                                                    <span className="font-bold text-slate-400 shrink-0">Sello:</span>
                                                    <span className="truncate">{res.sello_recepcion}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(res.sello_recepcion);
                                                            toast.success('Sello copiado');
                                                        }}
                                                        className="text-slate-400 hover:text-indigo-600 p-0.5"
                                                        title="Copiar Sello"
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                            )}
                                            {res.codigo_generacion && (
                                                <div className="flex items-center gap-1 truncate max-w-[280px]">
                                                    <span className="font-bold text-slate-400 shrink-0">UUID:</span>
                                                    <span className="truncate">{res.codigo_generacion}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(res.codigo_generacion);
                                                            toast.success('Código de generación copiado');
                                                        }}
                                                        className="text-slate-400 hover:text-indigo-600 p-0.5"
                                                        title="Copiar Código de Generación"
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Envío formal de DTE por Correo Electrónico al Cliente */}
                                        {(isAceptado || isContingencia) && (
                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-[11px]">
                                                {res.customer_email ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                                        <Mail size={12} className="text-emerald-600 shrink-0" />
                                                        <span>DTE enviado por correo a: <strong>{res.customer_email}</strong></span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                                        <Mail size={12} className="text-amber-500 shrink-0" />
                                                        <span>Cliente sin correo electrónico configurado (envío omitido).</span>
                                                    </div>
                                                )}

                                                {res.sale_id && (
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const toastId = toast.loading('Reenviando DTE por correo...');
                                                            try {
                                                                await axios.post(`/api/sales/resend-email/${res.sale_id}`);
                                                                toast.success('DTE enviado exitosamente al correo del cliente.', { id: toastId });
                                                            } catch (err) {
                                                                toast.error(err.response?.data?.message || 'Error al reenviar el correo.', { id: toastId });
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition shrink-0"
                                                        title="Reenviar el DTE oficial por correo electrónico al cliente"
                                                    >
                                                        <Mail size={11} />
                                                        <span>Reenviar Correo</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowResultsModal(false);
                                    onClose();
                                }}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                            >
                                Entendido, Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
