import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    X, Plus, Trash2, Search, Check, Building2, RefreshCw, Package, CheckCircle2, Barcode,
    MapPin, ChevronDown
} from 'lucide-react';
import Modal from '../ui/Modal';
import Money, { MoneyInput } from '../ui/Money';
import { isBatchCompatibleWithProduct } from '../../constants/eggIndustrialCatalogs';

const PRODUCT_PROFILES = [
    'Huevo Entero Pasteurizado',
    'Clara Pasteurizada',
    'Yema Pasteurizada',
    'Huevo Entero Plus',
    'Mezcla Especial Panadería',
    'Huevo Formulado por Separación',
    'Huevo en Cáscara'
];

const PRESENTATION_CONFIG = {
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

const PRESENTATIONS = Object.keys(PRESENTATION_CONFIG);

const getPresentationFactors = (pres) => {
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

const normalizeText = (txt) => {
    return String(txt || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const getPresWeight = (pres) => {
    const m = String(pres || '').match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|libras)?/i);
    return m ? parseFloat(m[1]) : null;
};

const inferPresentation = (productName, weightLbs, fallbackPres = '') => {
    const pName = String(productName || '').toLowerCase();
    const w = parseFloat(weightLbs);

    // 1. Contenedor específico en el nombre del propio SKU
    if (pName.includes('carton') || pName.includes('cartón')) return `carton ${w || 55} lb`;
    if (pName.includes('caja')) return `caja ${w || 32} lb`;
    if (pName.includes('unidad') || pName.includes('unid')) return `unidad ${w || 0.2} lb`;
    if (pName.includes('cubeta')) return `cubeta ${w || 30} lb`;
    if (pName.includes('galon') || pName.includes('galón')) {
        if (pName.includes('1/2') || pName.includes('medio') || (w && Math.abs(w - 4) < 0.2)) {
            return `medio galon ${w || 4} lb`;
        }
        return `galon ${w || 8} lb`;
    }
    if (pName.includes('litro')) {
        if (pName.includes('1/2') || pName.includes('medio') || (w && Math.abs(w - 1) < 0.2)) {
            return `medio litro ${w || 1} lb`;
        }
        return `litro ${w || 2} lb`;
    }

    // 2. Empaque estándar industrial por peso
    if (w) {
        if (Math.abs(w - 30) < 0.2) return 'cubeta 30 lb';
        if (Math.abs(w - 32) < 0.2) return 'cubeta 32 lb';
        if (Math.abs(w - 55) < 0.2) return 'carton 55 lb';
        if (Math.abs(w - 8) < 0.2) return 'galon 8 lb';
        if (Math.abs(w - 7.5) < 0.2) return 'galon 7.5 lb';
        if (Math.abs(w - 4) < 0.2) return 'medio galon 4 lb';
        if (Math.abs(w - 2) < 0.2) return 'litro 2 lb';
        if (Math.abs(w - 1) < 0.2) return 'medio litro 1 lb';
        if (w <= 0.5) return `unidad ${w} lb`;
        return `${w} lb`;
    }

    if (fallbackPres && fallbackPres.trim()) return fallbackPres.trim();
    return 'cubeta 30 lb';
};

const parseMappingItems = (m) => {
    if (m?.code_weights_json) {
        try {
            const parsed = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((item) => {
                    const lbs = Number(item.weight_lbs || m.unit_weight_lbs || m.weight_lbs || 1);
                    const kg = Number(item.weight_kg || (lbs * 0.45359237));
                    const pName = item.product_name || m.catalog_product_name || m.product_name || '';
                    const pres = inferPresentation(pName, lbs, m.presentation);
                    return {
                        code: String(item.code || '').trim(),
                        weight_lbs: lbs > 0 ? lbs : 1,
                        weight_kg: kg > 0 ? kg : 0.45,
                        product_id: item.product_id || m.catalog_product_id || null,
                        product_name: pName,
                        presentation: pres
                    };
                }).filter((it) => it.code);
            }
        } catch (e) {
            console.error('Error parsing code_weights_json in parseMappingItems:', e);
        }
    }
    const rawCodes = String(m?.codes || m?.catalog_codes || '')
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
    const defaultLbs = Number(m?.unit_weight_lbs ?? m?.weight_lbs ?? 1);
    const defaultKg = Number(m?.unit_weight_kg ?? m?.weight_kg ?? (defaultLbs * 0.45359237));
    const pName = m?.product_name || m?.catalog_product_name || '';
    const pres = inferPresentation(pName, defaultLbs, m?.presentation);
    return rawCodes.map(code => ({
        code,
        weight_lbs: defaultLbs > 0 ? defaultLbs : 1,
        weight_kg: defaultKg > 0 ? defaultKg : 0.45,
        product_id: m?.product_id || m?.catalog_product_id || null,
        product_name: pName,
        presentation: pres
    }));
};

const findMappingsForProductType = (prodType, mappings) => {
    if (!prodType || !mappings || mappings.length === 0) return [];
    const cType = normalizeText(prodType);
    if (!cType) return [];

    // 1. Coincidencia exacta de nombre de catálogo, receta o producto
    let matches = mappings.filter(m => {
        const t1 = normalizeText(m.catalog_product_name);
        const t2 = normalizeText(m.recipe_name);
        const t4 = normalizeText(m.product_name);
        return (t1 && t1 === cType) || (t2 && t2 === cType) || (t4 && t4 === cType);
    });

    if (matches.length > 0) return matches;

    // 2. Coincidencia de tipo industrial exacto SOLO si no tiene un catalog_product_name diferente
    matches = mappings.filter(m => {
        const t3 = normalizeText(m.industrial_product_type);
        const t1 = normalizeText(m.catalog_product_name);
        if (t3 && t3 === cType) {
            return !t1 || t1 === cType;
        }
        return false;
    });

    if (matches.length > 0) return matches;

    // 3. Coincidencia por sinónimos o palabras clave (ej: cascarón / cáscara)
    if (cType.includes('cascara') || cType.includes('cascaron')) {
        matches = mappings.filter(m => {
            const t1 = normalizeText(m.catalog_product_name);
            const t2 = normalizeText(m.recipe_name);
            const t4 = normalizeText(m.product_name);
            return (t1 && (t1.includes('cascara') || t1.includes('cascaron'))) ||
                   (t2 && (t2.includes('cascara') || t2.includes('cascaron'))) ||
                   (t4 && (t4.includes('cascara') || t4.includes('cascaron')));
        });
        if (matches.length > 0) return matches;
    }

    // 4. Inclusión estricta (mínimo 4 caracteres y NUNCA strings vacíos)
    matches = mappings.filter(m => {
        const t1 = normalizeText(m.catalog_product_name);
        const t2 = normalizeText(m.recipe_name);
        const t4 = normalizeText(m.product_name);
        const check = (val) => val && val.length >= 4 && (val.includes(cType) || cType.includes(val));
        return check(t1) || check(t2) || check(t4);
    });

    return matches;
};

const findBestMatrixMatch = (prodType, pres, mappings) => {
    if (!mappings || mappings.length === 0) return null;
    const matches = findMappingsForProductType(prodType, mappings);
    if (matches.length === 0) return null;

    const allItems = [];
    matches.forEach(m => {
        const parsed = parseMappingItems(m);
        parsed.forEach(it => {
            allItems.push({
                ...it,
                mapping_catalog_name: m.catalog_product_name,
                mapping_recipe_name: m.recipe_name,
                mapping_prod_name: m.product_name,
                mapping_catalog_id: m.catalog_product_id
            });
        });
    });

    if (allItems.length === 0) return null;

    const targetWeight = getPresWeight(pres);
    const cPres = normalizeText(pres);

    // 1. Prioridad por coincidencia de presentación textual exacta (ej: "cubeta 30 lb")
    if (cPres) {
        const presMatch = allItems.find(it => normalizeText(it.presentation) === cPres);
        if (presMatch) {
            return {
                code: presMatch.code,
                product_name: presMatch.product_name || presMatch.mapping_catalog_name || presMatch.mapping_prod_name,
                product_type: presMatch.mapping_catalog_name || presMatch.mapping_recipe_name || prodType,
                presentation: presMatch.presentation,
                weight_lbs: parseFloat(presMatch.weight_lbs) || targetWeight || 1,
                product_id: presMatch.product_id || presMatch.mapping_catalog_id
            };
        }
    }

    // 2. Prioridad por peso exacto
    if (targetWeight !== null) {
        const exact = allItems.find(it => Math.abs(parseFloat(it.weight_lbs) - targetWeight) < 0.1);
        if (exact) {
            return {
                code: exact.code,
                product_name: exact.product_name || exact.mapping_catalog_name || exact.mapping_prod_name,
                product_type: exact.mapping_catalog_name || exact.mapping_recipe_name || prodType,
                presentation: exact.presentation || `${exact.weight_lbs} lb`,
                weight_lbs: parseFloat(exact.weight_lbs) || targetWeight,
                product_id: exact.product_id || exact.mapping_catalog_id
            };
        }
    }

    // 3. Coincidencia por texto de presentación en el nombre del producto o código
    if (cPres) {
        for (const it of allItems) {
            const cCode = normalizeText(it.code);
            const cProdName = normalizeText(it.product_name);
            if ((cProdName && cProdName.length >= 3 && cProdName.includes(cPres)) || (cCode && cCode.length >= 3 && cPres.includes(cCode))) {
                return {
                    code: it.code,
                    product_name: it.product_name || it.mapping_catalog_name || it.mapping_prod_name,
                    product_type: it.mapping_catalog_name || it.mapping_recipe_name || prodType,
                    presentation: it.presentation,
                    weight_lbs: parseFloat(it.weight_lbs) || 1,
                    product_id: it.product_id || it.mapping_catalog_id
                };
            }
        }
    }

    // 4. Fallback al primer item mapeado
    const first = allItems[0];
    return {
        code: first.code,
        product_name: first.product_name || first.mapping_catalog_name || first.mapping_prod_name,
        product_type: first.mapping_catalog_name || first.mapping_recipe_name || prodType,
        presentation: first.presentation,
        weight_lbs: parseFloat(first.weight_lbs) || 1,
        product_id: first.product_id || first.mapping_catalog_id
    };
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
    const [branchSearchInput, setBranchSearchInput] = useState('');
    const [showBranchDropdown, setShowBranchDropdown] = useState(false);
    const branchDropdownRef = useRef(null);

    const [orderForm, setOrderForm] = useState({
        customer_id: '',
        customer_name: '',
        customer_branch_id: '',
        manual_branch_name: '',
        required_delivery_date: defaultDate || new Date().toISOString().split('T')[0],
        priority: 'normal',
        notes: ''
    });

    // Matriz de Códigos y Presentaciones Industriales
    const [codeMappings, setCodeMappings] = useState([]);
    const [_loadingMappings, setLoadingMappings] = useState(false);

    // Múltiples productos / presentaciones
    const [items, setItems] = useState([
        {
            id: 'item-1',
            product_type: 'Huevo Entero Pasteurizado',
            presentation: 'cubeta 30 lb',
            catalog_code: null,
            catalog_product_id: null,
            catalog_product_name: null,
            unit_weight_lbs: 30,
            quantity_units: '',
            quantity_lbs: '',
            quantity_kg: '',
            billing_unit: 'units',
            price_per_lb: '',
            price_source_note: '',
            batch_id: '',
            lot_code: ''
        }
    ]);

    const [availableBatches, setAvailableBatches] = useState([]);
    const [_loadingBatches, setLoadingBatches] = useState(false);
    const [saving, setSaving] = useState(false);

    // Modal de confirmación "¿Desea registrar otro pedido?"
    const [showConfirmAnother, setShowConfirmAnother] = useState(false);
    const [lastSavedSummary, setLastSavedSummary] = useState(null);

    // ---------------------------------------------------------
    // 2. Cargar lotes de producción y matriz de códigos
    // ---------------------------------------------------------
    useEffect(() => {
        if (!isOpen) return;
        const fetchBatchesAndMappings = async () => {
            try {
                setLoadingBatches(true);
                setLoadingMappings(true);
                const [batchRes, mapRes] = await Promise.all([
                    axios.get('/api/egg-industrial/batches', { params: { limit: 60 } }),
                    axios.get('/api/egg-industrial/code-mappings')
                ]);
                const batchList = batchRes.data?.batches || batchRes.data || [];
                setAvailableBatches(batchList);
                const mapList = Array.isArray(mapRes.data) ? mapRes.data : (mapRes.data?.data || []);
                setCodeMappings(mapList);
            } catch (err) {
                console.error('Error cargando datos de lotes y códigos:', err);
            } finally {
                setLoadingBatches(false);
                setLoadingMappings(false);
            }
        };
        fetchBatchesAndMappings();
    }, [isOpen]);

    // Cerrar dropdown de sucursales al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target)) {
                setShowBranchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                setBranchSearchInput(orderToEdit.branch_name || orderToEdit.manual_branch_name || '');
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
                    const weightLbs = parseFloat(it.unit_weight_lbs) || factor.lbs;
                    const units = it.quantity_units 
                        || (it.quantity_lbs ? Math.max(1, Math.round(parseFloat(it.quantity_lbs) / weightLbs)) : '');
                    const lbs = parseFloat(it.quantity_lbs) || (units ? (parseFloat(units) * weightLbs) : '');
                    const kg = lbs ? (parseFloat(lbs) * 0.453592) : '';
                    return {
                        id: `edit-${idx}-${Date.now()}`,
                        product_type: it.product_type || 'Huevo Entero Pasteurizado',
                        presentation: it.presentation || 'cubeta 30 lb',
                        catalog_code: it.catalog_code || null,
                        catalog_product_id: it.catalog_product_id || null,
                        catalog_product_name: it.catalog_product_name || null,
                        unit_weight_lbs: weightLbs,
                        quantity_units: units,
                        quantity_lbs: lbs,
                        quantity_kg: kg,
                        billing_unit: it.billing_unit || 'units',
                        price_per_lb: it.price_per_lb !== undefined ? it.price_per_lb : '',
                        price_source_note: it.price_source_note || '',
                        batch_id: it.batch_id || '',
                        lot_code: it.lot_code || ''
                    };
                }));
            } else {
                const factor = getPresentationFactors(orderToEdit.presentation);
                const weightLbs = parseFloat(orderToEdit.unit_weight_lbs) || factor.lbs;
                const units = orderToEdit.quantity_units 
                    || (orderToEdit.quantity_lbs ? Math.max(1, Math.round(parseFloat(orderToEdit.quantity_lbs) / weightLbs)) : '');
                const lbs = parseFloat(orderToEdit.quantity_lbs) || (units ? (parseFloat(units) * weightLbs) : '');
                const kg = lbs ? (parseFloat(lbs) * 0.453592) : '';
                setItems([
                    {
                        id: `single-${Date.now()}`,
                        product_type: orderToEdit.product_type || 'Huevo Entero Pasteurizado',
                        presentation: orderToEdit.presentation || 'cubeta 30 lb',
                        catalog_code: orderToEdit.catalog_code || null,
                        catalog_product_id: orderToEdit.catalog_product_id || null,
                        catalog_product_name: orderToEdit.catalog_product_name || null,
                        unit_weight_lbs: weightLbs,
                        quantity_units: units,
                        quantity_lbs: lbs,
                        quantity_kg: kg,
                        billing_unit: orderToEdit.billing_unit || 'units',
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
        setBranchSearchInput('');
        setShowBranchDropdown(false);
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
                catalog_code: null,
                catalog_product_id: null,
                catalog_product_name: null,
                unit_weight_lbs: 30,
                quantity_units: '',
                quantity_lbs: '',
                quantity_kg: '',
                billing_unit: 'units',
                price_per_lb: '',
                price_source_note: '',
                batch_id: '',
                lot_code: ''
            }
        ]);
    };

    // Lista de sucursales filtradas en tiempo real por nombre, dirección o municipio
    const filteredBranches = useMemo(() => {
        if (!customerBranches || customerBranches.length === 0) return [];
        if (!branchSearchInput || !branchSearchInput.trim()) return customerBranches;
        const q = branchSearchInput.toLowerCase().trim();
        return customerBranches.filter(b => {
            const nameMatch = b.nombre && b.nombre.toLowerCase().includes(q);
            const dirMatch = b.direccion && b.direccion.toLowerCase().includes(q);
            const munMatch = b.municipio && b.municipio.toLowerCase().includes(q);
            const depMatch = b.departamento && b.departamento.toLowerCase().includes(q);
            const contactMatch = b.contacto_nombre && b.contacto_nombre.toLowerCase().includes(q);
            return nameMatch || dirMatch || munMatch || depMatch || contactMatch;
        });
    }, [customerBranches, branchSearchInput]);

    // Sucursal actualmente seleccionada
    const selectedBranch = useMemo(() => {
        if (!orderForm.customer_branch_id || !customerBranches) return null;
        return customerBranches.find(b => String(b.id) === String(orderForm.customer_branch_id)) || null;
    }, [customerBranches, orderForm.customer_branch_id]);

    // Lista de productos disponibles combinando la Matriz y perfiles estándar
    const availableProducts = useMemo(() => {
        const set = new Set();
        (codeMappings || []).forEach(m => {
            const name = m.catalog_product_name || m.recipe_name || m.product_name;
            if (name && name.trim()) set.add(name.trim());
        });
        PRODUCT_PROFILES.forEach(p => set.add(p));
        return Array.from(set);
    }, [codeMappings]);

    // Lista plana de todos los códigos directos de la Matriz (SKUs)
    const allMatrixCodes = useMemo(() => {
        const list = [];
        (codeMappings || []).forEach(m => {
            const prodType = m.catalog_product_name || m.recipe_name || m.product_name || m.industrial_product_type;
            const items = parseMappingItems(m);
            items.forEach(it => {
                list.push({
                    code: it.code,
                    product_name: it.product_name || prodType,
                    product_type: prodType,
                    presentation: it.presentation || m.presentation || (it.weight_lbs ? `cubeta ${it.weight_lbs} lb` : 'cubeta 30 lb'),
                    weight_lbs: parseFloat(it.weight_lbs) || 1,
                    weight_kg: parseFloat(it.weight_kg) || 0.45,
                    product_id: it.product_id || m.catalog_product_id || null,
                    mapping_id: m.id
                });
            });
        });
        return list;
    }, [codeMappings]);

    // Obtener presentaciones mapeadas para un tipo de producto específico
    const getPresentationsForProduct = (prodType) => {
        if (!prodType || !codeMappings || codeMappings.length === 0) return [];
        const matches = findMappingsForProductType(prodType, codeMappings);

        const result = [];
        const seenCodes = new Set();
        matches.forEach(m => {
            const items = parseMappingItems(m);
            items.forEach(it => {
                if (!seenCodes.has(it.code)) {
                    seenCodes.add(it.code);
                    result.push({
                        presentation: it.presentation || m.presentation || `${it.weight_lbs} lb`,
                        code: it.code,
                        product_name: it.product_name || m.catalog_product_name || m.product_name,
                        weight_lbs: parseFloat(it.weight_lbs) || 1,
                        weight_kg: parseFloat(it.weight_kg) || 0.45,
                        product_id: it.product_id || m.catalog_product_id
                    });
                }
            });
        });
        return result;
    };

    // Auto-vincular códigos de la Matriz cuando se cargan los mappings si no están asignados
    useEffect(() => {
        if (codeMappings.length === 0) return;
        setItems(prev => prev.map(it => {
            if (it.catalog_code) return it;
            const matched = findBestMatrixMatch(it.product_type, it.presentation, codeMappings);
            if (matched) {
                const factorLbs = matched.weight_lbs || it.unit_weight_lbs || getPresentationFactors(it.presentation).lbs;
                const units = parseFloat(it.quantity_units) || 0;
                const lbs = units > 0 ? Math.round(units * factorLbs * 100) / 100 : it.quantity_lbs;
                const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : it.quantity_kg;
                return {
                    ...it,
                    catalog_code: matched.code,
                    catalog_product_id: matched.product_id,
                    catalog_product_name: matched.product_name,
                    presentation: matched.presentation || it.presentation,
                    unit_weight_lbs: factorLbs,
                    quantity_lbs: lbs,
                    quantity_kg: kg
                };
            }
            return it;
        }));
    }, [codeMappings]);

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
            if (branches.length > 0) {
                const targetId = defaultBranchId || branches[0].id;
                const found = branches.find(b => String(b.id) === String(targetId)) || branches[0];
                setOrderForm(prev => ({
                    ...prev,
                    customer_branch_id: found.id,
                    manual_branch_name: found.nombre
                }));
                setBranchSearchInput(found.nombre);
            } else {
                setOrderForm(prev => ({ ...prev, customer_branch_id: '' }));
                setBranchSearchInput(orderForm.manual_branch_name || '');
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
        setBranchSearchInput('');
        setShowBranchDropdown(false);
        const cleanName = name.trim();
        setOrderForm(prev => ({
            ...prev,
            customer_id: null,
            customer_name: cleanName,
            customer_branch_id: null,
            manual_branch_name: ''
        }));
        autoFillPricingForItems(null, cleanName);
    };

    // ---------------------------------------------------------
    // 5. Manejo de Líneas de Productos / Presentaciones
    // ---------------------------------------------------------
    const handleAddItem = () => {
        const newItemId = `item-${Date.now()}-${Math.random()}`;
        let defaultProd = 'Huevo Entero Pasteurizado';
        let defaultPres = 'cubeta 30 lb';
        let defaultCode = null;
        let defaultProdId = null;
        let defaultProdName = null;
        let defaultWeightLbs = 30;

        const matched = findBestMatrixMatch(defaultProd, defaultPres, codeMappings);
        if (matched) {
            defaultPres = matched.presentation;
            defaultCode = matched.code;
            defaultProdId = matched.product_id;
            defaultProdName = matched.product_name;
            defaultWeightLbs = matched.weight_lbs;
        }

        setItems(prev => [
            ...prev,
            {
                id: newItemId,
                product_type: defaultProd,
                presentation: defaultPres,
                catalog_code: defaultCode,
                catalog_product_id: defaultProdId,
                catalog_product_name: defaultProdName,
                unit_weight_lbs: defaultWeightLbs,
                quantity_units: '',
                quantity_lbs: '',
                quantity_kg: '',
                billing_unit: 'units',
                price_per_lb: '',
                price_source_note: '',
                batch_id: '',
                lot_code: '',
                selected_by_code: false
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

    const handleProductSelectChange = (id, rawValue) => {
        if (rawValue.startsWith('code:')) {
            const selectedCode = rawValue.replace('code:', '').trim();
            const codeItem = allMatrixCodes.find(c => c.code.toLowerCase() === selectedCode.toLowerCase());
            if (codeItem) {
                setItems(prev => prev.map(it => {
                    if (it.id !== id) return it;
                    const weightLbs = codeItem.weight_lbs;
                    const units = parseFloat(it.quantity_units) || 0;
                    const lbs = units > 0 ? Math.round(units * weightLbs * 100) / 100 : '';
                    const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';

                    const updated = {
                        ...it,
                        product_type: codeItem.product_type,
                        presentation: codeItem.presentation,
                        catalog_code: codeItem.code,
                        catalog_product_id: codeItem.product_id,
                        catalog_product_name: codeItem.product_name,
                        unit_weight_lbs: weightLbs,
                        quantity_lbs: lbs,
                        quantity_kg: kg,
                        selected_by_code: true
                    };

                    if (updated.batch_id) {
                        const currentBatch = availableBatches.find(b => String(b.id) === String(updated.batch_id));
                        if (currentBatch && !isBatchCompatibleWithProduct(currentBatch.product_type, updated.product_type)) {
                            updated.batch_id = '';
                            updated.lot_code = '';
                        }
                    }

                    const custId = orderForm.customer_id;
                    const custName = orderForm.customer_name || customerSearchInput;
                    if (custId || custName) {
                        fetchCustomerPrice(custId, custName, updated.product_type, updated.presentation).then(p => {
                            if (p && p.price_per_lb > 0) {
                                setItems(curr => curr.map(item => item.id === id ? {
                                    ...item,
                                    price_per_lb: p.price_per_lb,
                                    price_source_note: p.description
                                } : item));
                            }
                        });
                    }
                    return updated;
                }));
                return;
            }
        }

        // Tipo de producto industrial seleccionado
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;

            const mappedPres = getPresentationsForProduct(rawValue);
            let nextPres = it.presentation;
            let nextCode = null;
            let nextProdId = null;
            let nextProdName = null;
            let nextWeightLbs = getPresentationFactors(it.presentation).lbs;

            if (mappedPres.length > 0) {
                const matchPres = mappedPres.find(p => normalizeText(p.presentation) === normalizeText(it.presentation));
                const chosen = matchPres || mappedPres[0];
                nextPres = chosen.presentation;
                nextCode = chosen.code;
                nextProdId = chosen.product_id;
                nextProdName = chosen.product_name;
                nextWeightLbs = chosen.weight_lbs;
            }

            const units = parseFloat(it.quantity_units) || 0;
            const lbs = units > 0 ? Math.round(units * nextWeightLbs * 100) / 100 : '';
            const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';

            const updated = {
                ...it,
                product_type: rawValue,
                presentation: nextPres,
                catalog_code: nextCode,
                catalog_product_id: nextProdId,
                catalog_product_name: nextProdName,
                unit_weight_lbs: nextWeightLbs,
                quantity_lbs: lbs,
                quantity_kg: kg,
                selected_by_code: false
            };

            if (updated.batch_id) {
                const currentBatch = availableBatches.find(b => String(b.id) === String(updated.batch_id));
                if (currentBatch && !isBatchCompatibleWithProduct(currentBatch.product_type, rawValue)) {
                    updated.batch_id = '';
                    updated.lot_code = '';
                }
            }

            const custId = orderForm.customer_id;
            const custName = orderForm.customer_name || customerSearchInput;
            if (custId || custName) {
                fetchCustomerPrice(custId, custName, rawValue, nextPres).then(p => {
                    if (p && p.price_per_lb > 0) {
                        setItems(curr => curr.map(item => item.id === id ? {
                            ...item,
                            price_per_lb: p.price_per_lb,
                            price_source_note: p.description
                        } : item));
                    }
                });
            }
            return updated;
        }));
    };

    const handlePresentationSelectChange = (id, rawValue) => {
        if (rawValue.startsWith('code:')) {
            const selectedCode = rawValue.replace('code:', '').trim();
            const currentItem = items.find(x => x.id === id);
            const productPres = getPresentationsForProduct(currentItem?.product_type);
            const codeItem = productPres.find(c => c.code.toLowerCase() === selectedCode.toLowerCase())
                          || allMatrixCodes.find(c => c.code.toLowerCase() === selectedCode.toLowerCase());
            if (codeItem) {
                setItems(prev => prev.map(it => {
                    if (it.id !== id) return it;
                    const weightLbs = codeItem.weight_lbs;
                    const units = parseFloat(it.quantity_units) || 0;
                    const lbs = units > 0 ? Math.round(units * weightLbs * 100) / 100 : '';
                    const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';

                    const updated = {
                        ...it,
                        presentation: codeItem.presentation,
                        catalog_code: codeItem.code,
                        catalog_product_id: codeItem.product_id,
                        catalog_product_name: codeItem.product_name,
                        unit_weight_lbs: weightLbs,
                        quantity_lbs: lbs,
                        quantity_kg: kg
                    };

                    const custId = orderForm.customer_id;
                    const custName = orderForm.customer_name || customerSearchInput;
                    if (custId || custName) {
                        fetchCustomerPrice(custId, custName, updated.product_type, updated.presentation).then(p => {
                            if (p && p.price_per_lb > 0) {
                                setItems(curr => curr.map(item => item.id === id ? {
                                    ...item,
                                    price_per_lb: p.price_per_lb,
                                    price_source_note: p.description
                                } : item));
                            }
                        });
                    }
                    return updated;
                }));
                return;
            }
        }

        // Presentación seleccionada por nombre
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const mappedPres = getPresentationsForProduct(it.product_type);
            const match = mappedPres.find(p => normalizeText(p.presentation) === normalizeText(rawValue));

            const weightLbs = match ? match.weight_lbs : getPresentationFactors(rawValue).lbs;
            const units = parseFloat(it.quantity_units) || 0;
            const lbs = units > 0 ? Math.round(units * weightLbs * 100) / 100 : '';
            const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';

            const updated = {
                ...it,
                presentation: rawValue,
                catalog_code: match ? match.code : null,
                catalog_product_id: match ? match.product_id : null,
                catalog_product_name: match ? match.product_name : null,
                unit_weight_lbs: weightLbs,
                quantity_lbs: lbs,
                quantity_kg: kg
            };

            const custId = orderForm.customer_id;
            const custName = orderForm.customer_name || customerSearchInput;
            if (custId || custName) {
                fetchCustomerPrice(custId, custName, updated.product_type, rawValue).then(p => {
                    if (p && p.price_per_lb > 0) {
                        setItems(curr => curr.map(item => item.id === id ? {
                            ...item,
                            price_per_lb: p.price_per_lb,
                            price_source_note: p.description
                        } : item));
                    }
                });
            }
            return updated;
        }));
    };

    const handleItemChange = (id, field, value) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const updated = { ...it, [field]: value };
            
            // Si cambia la cantidad en unidades, recalcular lbs y kg
            if (field === 'quantity_units') {
                const factorLbs = parseFloat(updated.unit_weight_lbs) || getPresentationFactors(updated.presentation).lbs;
                const units = parseFloat(value) || 0;
                const lbs = units > 0 ? Math.round(units * factorLbs * 100) / 100 : '';
                const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';
                updated.quantity_lbs = lbs;
                updated.quantity_kg = kg;
            }

            // Si cambia la cantidad en libras, recalcular unidades y kg
            if (field === 'quantity_lbs') {
                const factorLbs = parseFloat(updated.unit_weight_lbs) || getPresentationFactors(updated.presentation).lbs;
                const lbs = parseFloat(value) || 0;
                const units = (lbs > 0 && factorLbs > 0) ? Math.round((lbs / factorLbs) * 100) / 100 : '';
                const kg = lbs ? Math.round(lbs * 0.45359237 * 100) / 100 : '';
                updated.quantity_units = units;
                updated.quantity_kg = kg;
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
                catalog_code: items[0].catalog_code || null,
                catalog_product_id: items[0].catalog_product_id ? parseInt(items[0].catalog_product_id, 10) : null,
                quantity_units: Number.isFinite(totals.totalUnits) ? totals.totalUnits : 0,
                quantity_lbs: Number.isFinite(totals.totalLbs) ? totals.totalLbs : 0,
                quantity_kg: Number.isFinite(totals.totalKg) ? totals.totalKg : 0,
                price_per_lb: Number.isFinite(parseFloat(items[0].price_per_lb)) ? parseFloat(items[0].price_per_lb) : 0,
                batch_id: items[0].batch_id ? (parseInt(items[0].batch_id, 10) || null) : null,
                lot_code: items[0].lot_code || null,
                items: items.map(it => ({
                    product_type: it.product_type,
                    presentation: it.presentation,
                    catalog_code: it.catalog_code || null,
                    catalog_product_id: it.catalog_product_id ? parseInt(it.catalog_product_id, 10) : null,
                    catalog_product_name: it.catalog_product_name || null,
                    unit_weight_lbs: it.unit_weight_lbs ? parseFloat(it.unit_weight_lbs) : null,
                    quantity_units: Number.isFinite(parseFloat(it.quantity_units)) ? parseFloat(it.quantity_units) : 0,
                    units: Number.isFinite(parseFloat(it.quantity_units)) ? parseFloat(it.quantity_units) : 0,
                    quantity_lbs: Number.isFinite(parseFloat(it.quantity_lbs)) ? parseFloat(it.quantity_lbs) : 0,
                    quantity_kg: Number.isFinite(parseFloat(it.quantity_kg)) ? parseFloat(it.quantity_kg) : 0,
                    billing_unit: it.billing_unit || 'units',
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

                            {/* Sucursal o Destino de Entrega con Búsqueda Escribible */}
                            <div className="relative" ref={branchDropdownRef}>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center justify-between">
                                    <span>Sucursal de Entrega (Dirección / Destino)</span>
                                    {customerBranches.length > 0 && (
                                        <span className="text-[10px] text-indigo-600 font-bold lowercase bg-indigo-50 px-1.5 py-0.5 rounded">
                                            {customerBranches.length} {customerBranches.length === 1 ? 'sucursal' : 'sucursales'}
                                        </span>
                                    )}
                                </label>

                                {customerBranches.length > 0 ? (
                                    <>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <MapPin className="w-3.5 h-3.5" />
                                            </div>

                                            <input
                                                type="text"
                                                value={branchSearchInput}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setBranchSearchInput(val);
                                                    setShowBranchDropdown(true);
                                                    if (!val.trim()) {
                                                        setOrderForm(prev => ({
                                                            ...prev,
                                                            customer_branch_id: '',
                                                            manual_branch_name: ''
                                                        }));
                                                    } else {
                                                        setOrderForm(prev => ({
                                                            ...prev,
                                                            manual_branch_name: val
                                                        }));
                                                    }
                                                }}
                                                onFocus={() => setShowBranchDropdown(true)}
                                                placeholder="Escriba para buscar sucursal o dirección..."
                                                className={`w-full text-xs font-semibold pl-8 pr-16 py-2 border rounded-xl outline-none transition-all ${
                                                    showBranchDropdown
                                                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white'
                                                        : orderForm.customer_branch_id
                                                        ? 'border-indigo-300 bg-indigo-50/20 text-indigo-950 font-bold'
                                                        : 'border-slate-300 text-slate-800 bg-white'
                                                }`}
                                            />

                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                {(orderForm.customer_branch_id || orderForm.manual_branch_name || branchSearchInput) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOrderForm(prev => ({ ...prev, customer_branch_id: '', manual_branch_name: '' }));
                                                            setBranchSearchInput('');
                                                            setShowBranchDropdown(false);
                                                        }}
                                                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition"
                                                        title="Limpiar sucursal seleccionada"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBranchDropdown(!showBranchDropdown)}
                                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                                                    title="Mostrar listado de sucursales"
                                                >
                                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showBranchDropdown ? 'rotate-180 text-indigo-600' : ''}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Detalle visual de la sucursal seleccionada */}
                                        {selectedBranch && (
                                            <div className="mt-1 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-600 flex items-start gap-1.5 animate-in fade-in duration-150">
                                                <span className="text-indigo-600 font-bold text-[10px] shrink-0 uppercase mt-0.5">Destino:</span>
                                                <span className="line-clamp-2 leading-relaxed">
                                                    {selectedBranch.direccion || selectedBranch.nombre}
                                                </span>
                                            </div>
                                        )}

                                        {/* Dropdown flotante con filtro en tiempo real */}
                                        {showBranchDropdown && (
                                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 z-50 animate-in fade-in zoom-in-95 duration-150">
                                                {/* Opción 1: Sin sucursal específica / Principal */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOrderForm(prev => ({
                                                            ...prev,
                                                            customer_branch_id: '',
                                                            manual_branch_name: ''
                                                        }));
                                                        setBranchSearchInput('');
                                                        setShowBranchDropdown(false);
                                                    }}
                                                    className={`w-full text-left p-2.5 text-xs flex items-center justify-between transition ${
                                                        !orderForm.customer_branch_id && !orderForm.manual_branch_name
                                                            ? 'bg-indigo-50/70 font-bold text-indigo-900'
                                                            : 'hover:bg-slate-50 text-slate-600'
                                                    }`}
                                                >
                                                    <span className="italic">-- Sucursal Principal / Sin especificar --</span>
                                                    {!orderForm.customer_branch_id && !orderForm.manual_branch_name && (
                                                        <Check className="w-3.5 h-3.5 text-indigo-600" />
                                                    )}
                                                </button>

                                                {/* Opción rápida: Usar como texto manual si el usuario escribió algo */}
                                                {branchSearchInput.trim().length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const val = branchSearchInput.trim();
                                                            setOrderForm(prev => ({
                                                                ...prev,
                                                                customer_branch_id: '',
                                                                manual_branch_name: val
                                                            }));
                                                            setBranchSearchInput(val);
                                                            setShowBranchDropdown(false);
                                                        }}
                                                        className="w-full text-left p-2.5 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-between transition"
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <span>✍️</span>
                                                            <span>Usar dirección manual: &quot;{branchSearchInput}&quot;</span>
                                                        </div>
                                                        <span className="text-[10px] bg-amber-200/80 text-amber-800 px-2 py-0.5 rounded font-semibold shrink-0">
                                                            Personalizada
                                                        </span>
                                                    </button>
                                                )}

                                                {/* Listado de sucursales filtradas */}
                                                {filteredBranches.map(b => {
                                                    const isSelected = String(orderForm.customer_branch_id) === String(b.id);
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setOrderForm(prev => ({
                                                                    ...prev,
                                                                    customer_branch_id: b.id,
                                                                    manual_branch_name: b.nombre
                                                                }));
                                                                setBranchSearchInput(b.nombre);
                                                                setShowBranchDropdown(false);
                                                            }}
                                                            className={`w-full text-left p-3 text-xs transition flex items-start justify-between gap-2.5 ${
                                                                isSelected
                                                                    ? 'bg-indigo-50/80 text-indigo-950 font-bold border-l-4 border-indigo-600'
                                                                    : 'hover:bg-indigo-50/40 text-slate-800'
                                                            }`}
                                                        >
                                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-slate-900 text-[12px] leading-snug">
                                                                        {b.nombre}
                                                                    </span>
                                                                    {b.id && (
                                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                                                            ID #{b.id}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {b.direccion ? (
                                                                    <p className="text-[11px] text-slate-500 font-normal leading-relaxed break-words">
                                                                        📍 {b.direccion}
                                                                    </p>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 italic">Sin dirección registrada</span>
                                                                )}
                                                            </div>
                                                            {isSelected && (
                                                                <div className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center mt-0.5">
                                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}

                                                {filteredBranches.length === 0 && (
                                                    <div className="p-4 text-center space-y-1">
                                                        <p className="text-xs text-slate-500 font-medium">
                                                            No se encontraron sucursales registradas con &quot;{branchSearchInput}&quot;
                                                        </p>
                                                        <p className="text-[11px] text-indigo-600">
                                                            Puede hacer clic en la opción de arriba para usarla como dirección manual.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <MapPin className="w-3.5 h-3.5" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Ej: Planta Principal, Sucursal Lourdes, Dirección de entrega..."
                                            value={orderForm.manual_branch_name}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setOrderForm(prev => ({ ...prev, manual_branch_name: val }));
                                                setBranchSearchInput(val);
                                            }}
                                            className="w-full text-xs font-medium pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-slate-800 outline-none focus:border-indigo-500 bg-white"
                                        />
                                    </div>
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
                                            value={
                                                it.selected_by_code && it.catalog_code 
                                                    ? `code:${it.catalog_code}` 
                                                    : (availableProducts.includes(it.product_type) ? it.product_type : (it.catalog_code ? `code:${it.catalog_code}` : it.product_type))
                                            }
                                            onChange={(e) => handleProductSelectChange(it.id, e.target.value)}
                                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            <optgroup label="📋 Productos de la Matriz Industrial">
                                                {availableProducts.map(p => (
                                                    <option key={`p-${p}`} value={p}>{p}</option>
                                                ))}
                                            </optgroup>
                                            {allMatrixCodes.length > 0 && (
                                                <optgroup label="🏷️ Códigos Directos de Catálogo (SKU / Matriz)">
                                                    {allMatrixCodes.map((c, cIdx) => (
                                                        <option key={`c-${c.code}-${cIdx}`} value={`code:${c.code}`}>
                                                            [{c.code}] {c.product_name} ({c.weight_lbs} lb)
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                        <div className="mt-1">
                                            {it.catalog_code ? (
                                                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate" title={`Código SKU: ${it.catalog_code}${it.catalog_product_name ? ` - ${it.catalog_product_name}` : ''}`}>
                                                    <Barcode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span className="font-mono font-bold">{it.catalog_code}</span>
                                                    {it.catalog_product_name && (
                                                        <span className="truncate text-slate-600 font-normal">
                                                            • {it.catalog_product_name}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic block pl-0.5">
                                                    Estándar general
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Presentación (2 cols) */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                            Presentación
                                        </label>
                                        <select
                                            value={
                                                it.catalog_code && getPresentationsForProduct(it.product_type).some(pm => pm.code === it.catalog_code)
                                                    ? `code:${it.catalog_code}`
                                                    : it.presentation
                                            }
                                            onChange={(e) => handlePresentationSelectChange(it.id, e.target.value)}
                                            className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                        >
                                            {getPresentationsForProduct(it.product_type).length > 0 && (
                                                <optgroup label="✨ Presentaciones Mapeadas (Matriz)">
                                                    {getPresentationsForProduct(it.product_type).map((pm, pmIdx) => (
                                                        <option key={`pm-${pmIdx}`} value={`code:${pm.code}`}>
                                                            {pm.presentation} [{pm.code}] ({pm.weight_lbs} lb)
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="📦 Otras Presentaciones">
                                                {PRESENTATIONS.map(p => (
                                                    <option key={`gen-${p}`} value={p}>{p}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <div className="mt-1">
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 block truncate">
                                                Factor: {it.unit_weight_lbs || getPresentationFactors(it.presentation).lbs} lb/ud
                                            </span>
                                        </div>
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
                                        <div className="mt-1 flex items-center justify-between gap-1 flex-wrap">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                                <span className="text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-100">
                                                    = {it.quantity_lbs ? `${it.quantity_lbs.toLocaleString()} lb` : '0 lb'}
                                                </span>
                                                {it.quantity_kg ? (
                                                    <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                                                        {it.quantity_kg.toLocaleString()} kg
                                                    </span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleItemChange(it.id, 'billing_unit', it.billing_unit === 'lbs' ? 'units' : 'lbs')}
                                                title={it.billing_unit === 'lbs' ? 'Facturar por Libras (Peso) en DTE' : 'Facturar por Presentación (Uds) en DTE'}
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition ${
                                                    it.billing_unit === 'lbs'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                }`}
                                            >
                                                {it.billing_unit === 'lbs' ? '⚖️ Factura: Lbs' : '📦 Factura: Uds'}
                                            </button>
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
                                            placeholder="0.0000"
                                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 outline-none focus:border-indigo-500"
                                            step="any"
                                            min="0"
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
                                            {availableBatches
                                                .filter(b => String(b.id) === String(it.batch_id) || isBatchCompatibleWithProduct(b.product_type, it.product_type))
                                                .map(b => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.batch_code_display || b.lote} ({b.product_type || 'Ovoproducto'})
                                                    </option>
                                                ))}
                                        </select>
                                        <div className="mt-1">
                                            {it.batch_id ? (
                                                <span className="text-[10px] font-semibold text-emerald-700 block truncate">
                                                    ✓ Lote asignado
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic block">
                                                    Sin lote
                                                </span>
                                            )}
                                        </div>
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
