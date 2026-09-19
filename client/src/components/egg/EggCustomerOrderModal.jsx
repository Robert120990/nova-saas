import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    X, Plus, Trash2, Search, Check, Sparkles, Building2, 
    User, Calendar, Clock, AlertCircle, RefreshCw, Layers, 
    DollarSign, Package, CheckCircle2, ChevronDown, MapPin
} from 'lucide-react';
import Modal from '../ui/Modal';
import Money, { MoneyInput } from '../ui/Money';

export const PRODUCT_PROFILES = [
    'Huevo Entero Pasteurizado',
    'Clara Pasteurizada',
    'Yema Pasteurizada',
    'Huevo Entero Plus',
    'Mezcla Especial Panadería',
    'Huevo Formulado por Separación',
    'Huevo en Cáscara'
];

export const PRESENTATION_CONFIG = {
    'cubeta 30 lb': { label: 'cubeta 30 lb', lbs: 30, kg: 13.61 },
    'cubeta 32 lb': { label: 'cubeta 32 lb', lbs: 32, kg: 14.51 },
    'galon 8 lb': { label: 'galon 8 lb', lbs: 8, kg: 3.63 },
    'medio galon 4 lb': { label: 'medio galon 4 lb', lbs: 4, kg: 1.81 },
    'litro 2 lb': { label: 'litro 2 lb', lbs: 2, kg: 0.91 },
    'carton 55 lb': { label: 'carton 55 lb', lbs: 55, kg: 24.95 },
    'caja 32 lb': { label: 'caja 32 lb', lbs: 32, kg: 14.51 },
    'carton 4 lb': { label: 'carton 4 lb (30 u)', lbs: 4, kg: 1.81 },
    'unidad 0.20 lb': { label: 'unidad 0.20 lb', lbs: 0.20, kg: 0.09 }
};

export const PRESENTATIONS = Object.keys(PRESENTATION_CONFIG);

export const getPresentationFactors = (pres) => {
    if (!pres) return PRESENTATION_CONFIG['cubeta 30 lb'];
    const clean = String(pres).toLowerCase().trim();
    if (PRESENTATION_CONFIG[clean]) return PRESENTATION_CONFIG[clean];
    if (clean.includes('55') || clean.includes('carton 55') || clean.includes('cartón 55')) return PRESENTATION_CONFIG['carton 55 lb'];
    if (clean.includes('caja') || clean.includes('cajas')) return PRESENTATION_CONFIG['caja 32 lb'];
    if (clean.includes('unidad') || clean.includes('unid')) return PRESENTATION_CONFIG['unidad 0.20 lb'];
    if (clean.includes('32')) return PRESENTATION_CONFIG['cubeta 32 lb'];
    if (clean.includes('30') && !clean.includes('carton') && !clean.includes('cartón')) return PRESENTATION_CONFIG['cubeta 30 lb'];
    if (clean.includes('carton') || clean.includes('cartón')) return PRESENTATION_CONFIG['carton 55 lb'];
    if (clean.includes('8') || clean.includes('galon 8') || clean.includes('galón 8')) return PRESENTATION_CONFIG['galon 8 lb'];
    if (clean.includes('4') || clean.includes('medio')) return PRESENTATION_CONFIG['medio galon 4 lb'];
    if (clean.includes('2') || clean.includes('litro')) return PRESENTATION_CONFIG['litro 2 lb'];
    return PRESENTATION_CONFIG['cubeta 30 lb'];
};

export default function EggCustomerOrderModal({
    isOpen,
    onClose,
    orderToEdit = null,
    onOrderSaved,
    defaultDate = null,
    zIndex = "z-[1100]"
}) {
    // ---------------------------------------------------------
    // 1. Estados de Formulario
    // ---------------------------------------------------------
    const [customerMode, setCustomerMode] = useState('catalog'); // 'catalog' | 'manual'
    const [customerSearchInput, setCustomerSearchInput] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerBranches, setCustomerBranches] = useState([]);

    const [orderForm, setOrderForm] = useState({
        customer_id: '',
        customer_name: '',
        customer_branch_id: '',
        manual_branch_name: '',
        required_delivery_date: defaultDate || new Date().toISOString().split('T')[0],
        priority: 'normal',
        notes: ''
    });

    // Múltiples productos / presentaciones
    const [items, setItems] = useState([
        {
            id: 'item-1',
            product_type: 'Huevo Entero Pasteurizado',
            presentation: 'cubeta 30 lb',
            quantity_units: '',
            quantity_lbs: '',
            quantity_kg: '',
            price_per_lb: '',
            price_source_note: '',
            batch_id: '',
            lot_code: ''
        }
    ]);

    const [availableBatches, setAvailableBatches] = useState([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [saving, setSaving] = useState(false);

    // Modal de confirmación "¿Desea registrar otro pedido?"
    const [showConfirmAnother, setShowConfirmAnother] = useState(false);
    const [lastSavedSummary, setLastSavedSummary] = useState(null);

    // ---------------------------------------------------------
    // 2. Cargar lotes de producción disponibles para vincular
    // ---------------------------------------------------------
    useEffect(() => {
        if (!isOpen) return;
        const fetchBatches = async () => {
            try {
                setLoadingBatches(true);
                const res = await axios.get('/api/egg-industrial/batches', {
                    params: { limit: 60 }
                });
                const batchList = res.data?.batches || res.data || [];
                setAvailableBatches(batchList);
            } catch (err) {
                console.error('Error cargando lotes de producción:', err);
            } finally {
                setLoadingBatches(false);
            }
        };
        fetchBatches();
    }, [isOpen]);

    // ---------------------------------------------------------
    // 3. Inicializar formulario al abrir o cambiar orderToEdit
    // ---------------------------------------------------------
    useEffect(() => {
        if (!isOpen) {
            setShowConfirmAnother(false);
            return;
        }

        if (orderToEdit) {
            // Edición de pedido existente
            setOrderForm({
                customer_id: orderToEdit.customer_id || '',
                customer_name: orderToEdit.customer_name || '',
                customer_branch_id: orderToEdit.customer_branch_id || '',
                manual_branch_name: orderToEdit.branch_name || '',
                required_delivery_date: orderToEdit.required_delivery_date 
                    ? orderToEdit.required_delivery_date.split('T')[0] 
                    : new Date().toISOString().split('T')[0],
                priority: orderToEdit.priority || 'normal',
                notes: orderToEdit.notes || ''
            });

            if (orderToEdit.customer_id) {
                setCustomerMode('catalog');
                setSelectedCustomer({
                    id: orderToEdit.customer_id,
                    nombre: orderToEdit.customer_name
                });
                setCustomerSearchInput(orderToEdit.customer_name || '');
                loadBranches(orderToEdit.customer_id, orderToEdit.customer_branch_id);
            } else {
                setCustomerMode('manual');
                setSelectedCustomer(null);
                setCustomerSearchInput(orderToEdit.customer_name || '');
            }

            // Desglosar items si existen en items_json
            let parsedItems = [];
            if (orderToEdit.items_json) {
                try {
                    parsedItems = typeof orderToEdit.items_json === 'string' 
                        ? JSON.parse(orderToEdit.items_json) 
                        : orderToEdit.items_json;
                } catch (e) {
                    console.error('Error parseando items_json:', e);
                }
            }

            if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                setItems(parsedItems.map((it, idx) => {
                    const factor = getPresentationFactors(it.presentation);
                    const units = it.quantity_units 
                        || (it.quantity_lbs ? Math.max(1, Math.round(parseFloat(it.quantity_lbs) / factor.lbs)) : '');
                    const lbs = parseFloat(it.quantity_lbs) || (units ? (parseFloat(units) * factor.lbs) : '');
                    const kg = lbs ? (parseFloat(lbs) * 0.453592) : '';
                    return {
                        id: `edit-${idx}-${Date.now()}`,
                        product_type: it.product_type || 'Huevo Entero Pasteurizado',
                        presentation: it.presentation || 'cubeta 30 lb',
                        quantity_units: units,
                        quantity_lbs: lbs,
                        quantity_kg: kg,
                        price_per_lb: it.price_per_lb !== undefined ? it.price_per_lb : '',
                        price_source_note: it.price_source_note || '',
                        batch_id: it.batch_id || '',
                        lot_code: it.lot_code || ''
                    };
                }));
            } else {
                const factor = getPresentationFactors(orderToEdit.presentation);
                const units = orderToEdit.quantity_units 
                    || (orderToEdit.quantity_lbs ? Math.max(1, Math.round(parseFloat(orderToEdit.quantity_lbs) / factor.lbs)) : '');
                const lbs = parseFloat(orderToEdit.quantity_lbs) || (units ? (parseFloat(units) * factor.lbs) : '');
                const kg = lbs ? (parseFloat(lbs) * 0.453592) : '';
                setItems([
                    {
                        id: `single-${Date.now()}`,
                        product_type: orderToEdit.product_type || 'Huevo Entero Pasteurizado',
                        presentation: orderToEdit.presentation || 'cubeta 30 lb',
                        quantity_units: units,
                        quantity_lbs: lbs,
                        quantity_kg: kg,
                        price_per_lb: orderToEdit.price_per_lb !== undefined ? orderToEdit.price_per_lb : '',
                        price_source_note: '',
                        batch_id: orderToEdit.batch_id || '',
                        lot_code: orderToEdit.lot_code || ''
                    }
                ]);
            }
        } else {
            // Nuevo pedido limpio
            resetForm();
        }
    }, [isOpen, orderToEdit, defaultDate]);

    const resetForm = () => {
        setCustomerMode('catalog');
        setSelectedCustomer(null);
        setCustomerSearchInput('');
        setCustomerSearchResults([]);
        setCustomerBranches([]);
        setOrderForm({
            customer_id: '',
            customer_name: '',
            customer_branch_id: '',
            manual_branch_name: '',
            required_delivery_date: defaultDate || new Date().toISOString().split('T')[0],
            priority: 'normal',
            notes: ''
        });
        setItems([
            {
                id: `item-${Date.now()}`,
                product_type: 'Huevo Entero Pasteurizado',
                presentation: 'cubeta 30 lb',
                quantity_units: '',
                quantity_lbs: '',
                quantity_kg: '',
                price_per_lb: '',
                price_source_note: '',
                batch_id: '',
                lot_code: ''
            }
        ]);
    };

    // ---------------------------------------------------------
    // 4. Búsqueda y selección de clientes en CRM
    // ---------------------------------------------------------
    const searchCustomersList = async (term) => {
        try {
            setLoadingCustomers(true);
            const res = await axios.get('/api/customers', {
                params: { search: term, limit: 15 }
            });
            const list = res.data?.data || res.data || [];
            setCustomerSearchResults(list);
        } catch (err) {
            console.error('Error buscando clientes:', err);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const loadBranches = async (custId, defaultBranchId = null) => {
        try {
            const res = await axios.get('/api/egg-industrial/dispatch/customer-branches', {
                params: { customer_id: custId }
            });
            const branches = res.data || [];
            setCustomerBranches(branches);
            if (branches.length > 0 && !defaultBranchId) {
                setOrderForm(prev => ({ ...prev, customer_branch_id: branches[0].id }));
            }
        } catch (error) {
            console.error('Error cargando sucursales de cliente:', error);
        }
    };

    // Consultar precio pactado en CRM o último precio facturado/pedido
    const fetchCustomerPrice = async (custId, custName, prodType, pres) => {
        try {
            const res = await axios.get('/api/egg-industrial/orders/customer-pricing', {
                params: {
                    customer_id: custId || undefined,
                    customer_name: custName || undefined,
                    product_type: prodType || undefined,
                    presentation: pres || undefined
                }
            });
            return res.data;
        } catch (e) {
            console.error('Error obteniendo precio sugerido:', e);
            return null;
        }
    };

    const autoFillPricingForItems = async (custId, custName) => {
        if (!custId && !custName) return;
        setItems(prevItems => {
            prevItems.forEach(async (it) => {
                const pricing = await fetchCustomerPrice(custId, custName, it.product_type, it.presentation);
                if (pricing && pricing.price_per_lb > 0) {
                    setItems(curr => curr.map(item => {
                        if (item.id === it.id && (!item.price_per_lb || parseFloat(item.price_per_lb) === 0)) {
                            return {
                                ...item,
                                price_per_lb: pricing.price_per_lb,
                                price_source_note: pricing.description
                            };
                        }
                        return item;
                    }));
                }
            });
            return prevItems;
        });
    };

    const handleSelectCatalogCustomer = (cust) => {
        setSelectedCustomer(cust);
        setCustomerMode('catalog');
        setCustomerSearchInput(cust.nombre || cust.nombre_comercial);
        setShowCustomerDropdown(false);
        setOrderForm(prev => ({
            ...prev,
            customer_id: cust.id,
            customer_name: cust.nombre || cust.nombre_comercial || ''
        }));
        loadBranches(cust.id);
        autoFillPricingForItems(cust.id, cust.nombre || cust.nombre_comercial);
    };

    const handleUseManualCustomer = (name) => {
        setSelectedCustomer(null);
        setCustomerMode('manual');
        setShowCustomerDropdown(false);
        setCustomerBranches([]);
        const cleanName = name.trim();
        setOrderForm(prev => ({
            ...prev,
            customer_id: null,
            customer_name: cleanName,
            customer_branch_id: null
        }));
        autoFillPricingForItems(null, cleanName);
    };

    // ---------------------------------------------------------
    // 5. Manejo de Líneas de Productos / Presentaciones
    // ---------------------------------------------------------
    const handleAddItem = () => {
        const newItemId = `item-${Date.now()}-${Math.random()}`;
        const defaultProd = 'Huevo Entero Pasteurizado';
        const defaultPres = 'cubeta 30 lb';
        setItems(prev => [
            ...prev,
            {
                id: newItemId,
                product_type: defaultProd,
                presentation: defaultPres,
                quantity_units: '',
                quantity_lbs: '',
                quantity_kg: '',
                price_per_lb: '',
                price_source_note: '',
                batch_id: '',
                lot_code: ''
            }
        ]);

        const custId = orderForm.customer_id;
        const custName = orderForm.customer_name || customerSearchInput;
        if (custId || custName) {
            fetchCustomerPrice(custId, custName, defaultProd, defaultPres).then(p => {
                if (p && p.price_per_lb > 0) {
                    setItems(curr => curr.map(it => it.id === newItemId ? {
                        ...it,
                        price_per_lb: p.price_per_lb,
                        price_source_note: p.description
                    } : it));
                }
            });
        }
    };

    const handleRemoveItem = (id) => {
        if (items.length <= 1) {
            toast.error('El pedido debe tener al menos una presentación o producto.');
            return;
        }
        setItems(prev => prev.filter(it => it.id !== id));
    };

    const handleItemChange = (id, field, value) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const updated = { ...it, [field]: value };
            
            // Si cambia la cantidad en unidades, recalcular lbs y kg
            if (field === 'quantity_units') {
                const factor = getPresentationFactors(updated.presentation);
                const units = parseFloat(value) || 0;
                const lbs = units > 0 ? Math.round(units * factor.lbs * 100) / 100 : '';
                const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';
                updated.quantity_lbs = lbs;
                updated.quantity_kg = kg;
            }

            // Si cambia la presentación, recalcular peso y sugerir precio
            if (field === 'presentation') {
                const factor = getPresentationFactors(value);
                const units = parseFloat(updated.quantity_units) || 0;
                const lbs = units > 0 ? Math.round(units * factor.lbs * 100) / 100 : '';
                const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';
                updated.quantity_lbs = lbs;
                updated.quantity_kg = kg;

                const custId = orderForm.customer_id;
                const custName = orderForm.customer_name || customerSearchInput;
                if (custId || custName) {
                    fetchCustomerPrice(custId, custName, updated.product_type, value).then(p => {
                        if (p && p.price_per_lb > 0) {
                            setItems(curr => curr.map(item => item.id === id ? {
                                ...item,
                                price_per_lb: p.price_per_lb,
                                price_source_note: p.description
                            } : item));
                        }
                    });
                }
            }

            // Si cambia el tipo de producto, consultar precio sugerido
            if (field === 'product_type') {
                const custId = orderForm.customer_id;
                const custName = orderForm.customer_name || customerSearchInput;
                if (custId || custName) {
                    fetchCustomerPrice(custId, custName, value, updated.presentation).then(p => {
                        if (p && p.price_per_lb > 0) {
                            setItems(curr => curr.map(item => item.id === id ? {
                                ...item,
                                price_per_lb: p.price_per_lb,
                                price_source_note: p.description
                            } : item));
                        }
                    });
                }
            }

            // Si cambia el batch_id, auto-completar lot_code y sugerir tipo si coincide
            if (field === 'batch_id') {
                const foundBatch = availableBatches.find(b => String(b.id) === String(value));
                if (foundBatch) {
                    updated.lot_code = foundBatch.batch_code_display || foundBatch.lote || '';
                    if (foundBatch.product_type && PRODUCT_PROFILES.includes(foundBatch.product_type)) {
                        updated.product_type = foundBatch.product_type;
                    }
                } else {
                    updated.lot_code = '';
                }
            }
            return updated;
        }));
    };

    // Cálculos de resumen en Unidades, Libras, Kilogramos y Monto Total
    const totals = useMemo(() => {
        let totalUnits = 0;
        let totalLbs = 0;
        let totalKg = 0;
        let totalMoney = 0;

        items.forEach(it => {
            const units = Number.isFinite(parseFloat(it.quantity_units)) ? parseFloat(it.quantity_units) : 0;
            const lbs = Number.isFinite(parseFloat(it.quantity_lbs)) ? parseFloat(it.quantity_lbs) : 0;
            const kg = Number.isFinite(parseFloat(it.quantity_kg)) ? parseFloat(it.quantity_kg) : (lbs * 0.45359237);
            const price = Number.isFinite(parseFloat(it.price_per_lb)) ? parseFloat(it.price_per_lb) : 0;

            totalUnits += units;
            totalLbs += lbs;
            totalKg += kg;
            totalMoney += (lbs * price);
        });

        return {
            totalUnits: Math.round(totalUnits * 100) / 100,
            totalLbs: Math.round(totalLbs * 100) / 100,
            totalKg: Math.round(totalKg * 100) / 100,
            totalMoney: Math.round(totalMoney * 100) / 100
        };
    }, [items]);

    // ---------------------------------------------------------
    // 6. Guardar Pedido
    // ---------------------------------------------------------
    const handleSaveOrder = async (e) => {
        if (e) e.preventDefault();

        const finalCustomerName = orderForm.customer_name || customerSearchInput;
        if (!finalCustomerName || !finalCustomerName.trim()) {
            toast.error('Debe ingresar o seleccionar el nombre del cliente.');
            return;
        }

        // Validar cantidades de cada línea
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const qtyUnits = parseFloat(it.quantity_units);
            const qtyLbs = parseFloat(it.quantity_lbs);
            if (!qtyUnits || qtyUnits <= 0) {
                toast.error(`La línea #${i + 1} (${it.product_type}) debe tener una cantidad mayor a 0 unidades.`);
                return;
            }
            if (!qtyLbs || qtyLbs <= 0) {
                toast.error(`La línea #${i + 1} (${it.product_type}) debe tener un peso válido calculado.`);
                return;
            }
        }

        try {
            setSaving(true);
            const payload = {
                customer_id: orderForm.customer_id ? (parseInt(orderForm.customer_id, 10) || null) : null,
                customer_name: finalCustomerName.trim(),
                customer_branch_id: orderForm.customer_branch_id ? (parseInt(orderForm.customer_branch_id, 10) || null) : null,
                branch_name: orderForm.manual_branch_name || undefined,
                required_delivery_date: orderForm.required_delivery_date,
                priority: orderForm.priority,
                notes: orderForm.notes,
                product_type: items[0].product_type,
                presentation: items[0].presentation,
                quantity_units: Number.isFinite(totals.totalUnits) ? totals.totalUnits : 0,
                quantity_lbs: Number.isFinite(totals.totalLbs) ? totals.totalLbs : 0,
                quantity_kg: Number.isFinite(totals.totalKg) ? totals.totalKg : 0,
                price_per_lb: Number.isFinite(parseFloat(items[0].price_per_lb)) ? parseFloat(items[0].price_per_lb) : 0,
                batch_id: items[0].batch_id ? (parseInt(items[0].batch_id, 10) || null) : null,
                lot_code: items[0].lot_code || null,
                items: items.map(it => ({
                    product_type: it.product_type,
                    presentation: it.presentation,
                    quantity_units: Number.isFinite(parseFloat(it.quantity_units)) ? parseFloat(it.quantity_units) : 0,
                    quantity_lbs: Number.isFinite(parseFloat(it.quantity_lbs)) ? parseFloat(it.quantity_lbs) : 0,
                    quantity_kg: Number.isFinite(parseFloat(it.quantity_kg)) ? parseFloat(it.quantity_kg) : 0,
                    price_per_lb: Number.isFinite(parseFloat(it.price_per_lb)) ? parseFloat(it.price_per_lb) : 0,
                    price_source_note: it.price_source_note || '',
                    batch_id: it.batch_id ? (parseInt(it.batch_id, 10) || null) : null,
                    lot_code: it.lot_code || null
                }))
            };

            let res;
            if (orderToEdit?.id) {
                res = await axios.put(`/api/egg-industrial/orders/${orderToEdit.id}`, payload);
                toast.success('Pedido actualizado con éxito.');
                if (onOrderSaved) onOrderSaved(res.data);
                onClose();
            } else {
                res = await axios.post('/api/egg-industrial/orders', payload);
                toast.success('Pedido registrado con éxito.');
                if (onOrderSaved) onOrderSaved(res.data);

                // Preguntar al usuario si desea registrar otro pedido
                setLastSavedSummary({
                    client: finalCustomerName.trim(),
                    itemsCount: items.length,
                    totalUnits: totals.totalUnits,
                    totalLbs: totals.totalLbs,
                    totalKg: totals.totalKg
                });
                setShowConfirmAnother(true);
            }
        } catch (err) {
            console.error('Error guardando pedido:', err);
            toast.error(err.response?.data?.message || 'Error al guardar pedido.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen && !showConfirmAnother}
                onClose={onClose}
                title={orderToEdit ? "Editar Pedido de Ovoproductos" : "Nuevo Pedido de Ovoproductos"}
                maxWidth="max-w-4xl"
                zIndex={zIndex}
            >
                <form onSubmit={handleSaveOrder} className="space-y-4">
                    {/* ENCABEZADO: CLIENTE Y SUCURSAL */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-indigo-600" />
                                <span>Información del Cliente y Destino</span>
                            </span>
                            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomerMode('catalog');
                                    }}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        customerMode === 'catalog' 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Catálogo CRM
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCustomerMode('manual');
                                        setSelectedCustomer(null);
                                        setOrderForm(prev => ({ ...prev, customer_id: null, customer_branch_id: null }));
                                    }}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${
                                        customerMode === 'manual' 
                                            ? 'bg-amber-600 text-white shadow-sm' 
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Cliente Directo / No registrado
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Input de Cliente */}
                            <div className="relative">
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    Cliente * {customerMode === 'manual' && <span className="text-amber-600 font-bold lowercase">(nombre sin registrar)</span>}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        placeholder={customerMode === 'catalog' ? "Buscar cliente existente en catálogo..." : "Escriba el nombre del cliente directamente..."}
                                        value={customerSearchInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCustomerSearchInput(val);
                                            setOrderForm(prev => ({ ...prev, customer_name: val }));
                                            if (customerMode === 'catalog') {
                                                setShowCustomerDropdown(true);
                                                searchCustomersList(val);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (customerMode === 'catalog') {
                                                setShowCustomerDropdown(true);
                                                if (customerSearchResults.length === 0) searchCustomersList(customerSearchInput);
                                            }
                                        }}
                                        className={`w-full text-xs font-semibold border rounded-xl px-3 py-2 pr-8 transition outline-none ${
                                            selectedCustomer 
                                                ? 'border-emerald-500 bg-emerald-50/20 text-slate-900 ring-1 ring-emerald-500/30 font-bold'
                                                : customerMode === 'manual'
                                                ? 'border-amber-400 bg-amber-50/20 text-slate-900'
                                                : 'border-slate-300 bg-white text-slate-800 focus:border-indigo-500'
                                        }`}
                                    />
                                    {selectedCustomer ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedCustomer(null);
                                                setCustomerSearchInput('');
                                                setOrderForm(prev => ({ ...prev, customer_id: '', customer_name: '', customer_branch_id: '' }));
                                                setCustomerBranches([]);
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-0.5"
                                            title="Quitar cliente seleccionado"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            {loadingCustomers ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Search className="w-3.5 h-3.5" />}
                                        </div>
                                    )}
                                </div>

                                {/* Menú desplegable con clientes y opción directa */}
                                {showCustomerDropdown && customerMode === 'catalog' && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 z-50">
                                        {/* Opción rápida: Usar como cliente directo */}
                                        {customerSearchInput.trim().length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleUseManualCustomer(customerSearchInput)}
                                                className="w-full text-left p-2.5 bg-amber-50/70 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-between transition"
                                            >
                                                <span>✍️ Usar nombre directo: &quot;{customerSearchInput}&quot; (sin guardar en catálogo)</span>
                                                <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded">Usar Directo</span>
                                            </button>
                                        )}

                                        {customerSearchResults.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSelectCatalogCustomer(c)}
                                                className="w-full text-left p-2.5 hover:bg-indigo-50 text-xs font-medium text-slate-800 flex items-center justify-between transition"
                                            >
                                                <div>
                                                    <span className="font-bold text-slate-900 block">{c.nombre}</span>
                                                    {c.nombre_comercial && (
                                                        <span className="text-[11px] text-slate-500">{c.nombre_comercial}</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                    ID #{c.id}
                                                </span>
                                            </button>
                                        ))}

                                        {customerSearchResults.length === 0 && !loadingCustomers && (
                                            <div className="p-3 text-center text-xs text-slate-400">
                                                No se encontraron clientes registrados con ese nombre.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Sucursal o Destino de Entrega */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    Sucursal de Entrega (Dirección / Destino)
                                </label>
                                {customerBranches.length > 0 ? (
                                    <select
                                        value={orderForm.customer_branch_id || ''}
                                        onChange={(e) => setOrderForm(prev => ({ ...prev, customer_branch_id: e.target.value }))}
                                        className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 bg-white"
                                    >
                                        <option value="">-- Sucursal Principal / Sin especificar --</option>
                                        {customerBranches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.nombre} {b.direccion ? `- ${b.direccion}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Ej: Planta Principal, Sucursal Lourdes, Dirección de entrega..."
                                        value={orderForm.manual_branch_name}
                                        onChange={(e) => setOrderForm(prev => ({ ...prev, manual_branch_name: e.target.value }))}
                                        className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 bg-white"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Fecha y Prioridad */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    Fecha Requerida *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={orderForm.required_delivery_date}
                                    onChange={(e) => setOrderForm(prev => ({ ...prev, required_delivery_date: e.target.value }))}
                                    className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    Prioridad
                                </label>
                                <select
                                    value={orderForm.priority}
                                    onChange={(e) => setOrderForm(prev => ({ ...prev, priority: e.target.value }))}
                                    className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 bg-white"
                                >
                                    <option value="normal">Normal</option>
                                    <option value="alta">Alta</option>
                                    <option value="urgente">Urgente</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    Notas de Entrega / Referencias
                                </label>
                                <input
                                    type="text"
                                    placeholder="Indicaciones especiales de entrega..."
                                    value={orderForm.notes}
                                    onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN MULTI-PRODUCTO / PRESENTACIONES */}
                    <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Package className="w-4 h-4 text-indigo-600" />
                                <span>Productos y Presentaciones ({items.length})</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-xl transition"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Agregar otra presentación</span>
                            </button>
                        </div>

                        {/* Tabla de items */}
                        <div className="space-y-2.5">
                            {items.map((it, idx) => (
                                <div 
                                    key={it.id}
                                    className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                                >
                                    {/* Tipo de producto (3 cols) */}
                                    <div className="sm:col-span-3">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            #{idx + 1} Tipo de Producto *
                                        </label>
                                        <select
                                            value={it.product_type}
                                            onChange={(e) => handleItemChange(it.id, 'product_type', e.target.value)}
                                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            {PRODUCT_PROFILES.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Presentación (2 cols) */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Presentación
                                        </label>
                                        <select
                                            value={it.presentation}
                                            onChange={(e) => handleItemChange(it.id, 'presentation', e.target.value)}
                                            className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            {PRESENTATIONS.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Cantidad en Unidades (2 cols) */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Cantidad (Uds) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            step="1"
                                            min="1"
                                            placeholder="Ej: 10"
                                            value={it.quantity_units}
                                            onChange={(e) => handleItemChange(it.id, 'quantity_units', e.target.value)}
                                            className="w-full text-xs font-black border border-slate-200 rounded-lg px-2 py-1.5 text-indigo-700 outline-none focus:border-indigo-500"
                                        />
                                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                            <span className="text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                                = {it.quantity_lbs ? `${it.quantity_lbs.toLocaleString()} lb` : '0 lb'}
                                            </span>
                                            {it.quantity_kg ? (
                                                <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                                                    {it.quantity_kg.toLocaleString()} kg
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Precio Acordado / Lb (2 cols) */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Precio ($/Lb)
                                        </label>
                                        <MoneyInput
                                            value={it.price_per_lb}
                                            onChange={(e) => handleItemChange(it.id, 'price_per_lb', e.target.value)}
                                            placeholder="0.00"
                                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                        />
                                        <div className="mt-0.5">
                                            {it.price_source_note ? (
                                                <span className="text-[9px] font-semibold text-emerald-700 block truncate" title={it.price_source_note}>
                                                    🏷️ {it.price_source_note}
                                                </span>
                                            ) : null}
                                            <span className="text-[10px] font-bold text-slate-600 block">
                                                Subtotal: <Money amount={(parseFloat(it.quantity_lbs) || 0) * (parseFloat(it.price_per_lb) || 0)} />
                                            </span>
                                        </div>
                                    </div>

                                    {/* Vincular Lote de Producción (2 cols) */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Vincular Lote
                                        </label>
                                        <select
                                            value={it.batch_id || ''}
                                            onChange={(e) => handleItemChange(it.id, 'batch_id', e.target.value)}
                                            className="w-full text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1.5 text-emerald-800 bg-emerald-50/20 outline-none focus:border-emerald-500"
                                        >
                                            <option value="">-- Sin asignar --</option>
                                            {availableBatches.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.batch_code_display || b.lote} ({b.product_type || 'Ovoproducto'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Eliminar fila (1 col) */}
                                    <div className="sm:col-span-1 flex justify-center pb-1">
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(it.id)}
                                            disabled={items.length <= 1}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 transition rounded"
                                            title="Eliminar presentación"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Barra de Totales */}
                        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-4">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Unidades</span>
                                    <span className="font-black text-indigo-900 text-sm">{totals.totalUnits.toLocaleString()} Uds</span>
                                </div>
                                <div className="h-6 w-px bg-indigo-200/80" />
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Peso (Lbs)</span>
                                    <span className="font-black text-indigo-950 text-sm">{totals.totalLbs.toLocaleString()} Lbs</span>
                                </div>
                                <div className="h-6 w-px bg-indigo-200/80" />
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Peso (Kg)</span>
                                    <span className="font-black text-slate-800 text-sm">{totals.totalKg.toLocaleString()} Kg</span>
                                </div>
                                <div className="h-6 w-px bg-indigo-200/80" />
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Monto Total Estimado</span>
                                    <span className="font-black text-emerald-700 text-sm">
                                        <Money amount={totals.totalMoney} />
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar más presentaciones
                            </button>
                        </div>
                    </div>

                    {/* PIE DE ACCIONES */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-60"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Guardando Pedido...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>{orderToEdit ? "Guardar Cambios" : "Registrar Pedido"}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* MODAL DE CONFIRMACIÓN: "¿DESEA REGISTRAR OTRO PEDIDO?" */}
            {showConfirmAnother && (
                <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm`}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-black text-slate-900 mb-1">
                            ¡Pedido Registrado con Éxito!
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Se guardó el pedido para <strong className="text-slate-800">{lastSavedSummary?.client}</strong> por un total de <strong className="text-indigo-700">{lastSavedSummary?.totalLbs} Lbs</strong>.
                        </p>

                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 mb-5">
                            <p className="text-xs font-bold text-indigo-900">
                                ¿Desea registrar otro pedido de cliente?
                            </p>
                            <span className="text-[11px] text-indigo-600 block mt-0.5">
                                Puede continuar cargando pedidos para el mismo día u otro cliente sin salir de la pantalla.
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirmAnother(false);
                                    onClose();
                                }}
                                className="w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                            >
                                No, Finalizar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirmAnother(false);
                                    resetForm();
                                }}
                                className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition flex items-center justify-center gap-1.5"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Sí, Registrar Otro</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
