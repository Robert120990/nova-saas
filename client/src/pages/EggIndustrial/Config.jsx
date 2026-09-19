import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import SearchableSelect from '../../components/ui/SearchableSelect';
import Money from '../../components/ui/Money';
import {
    DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT,
    DEFAULT_INDUSTRIAL_PRESENTATION,
    DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
    getIndustrialPresentationWeightLbs,
    INDUSTRIAL_MEASUREMENT_UNITS,
    INDUSTRIAL_PRESENTATIONS,
    INDUSTRIAL_PRODUCT_CATEGORIES,
    kilogramsToPounds,
    normalizeIndustrialPresentation,
    poundsToKilograms,
    RECIPES_CATALOG,
    RECIPE_FORMULA_NAMES,
    getRecipeFormulaName
} from '../../constants/eggIndustrialCatalogs';
import {
    Settings,
    Save,
    Plus,
    Trash2,
    HelpCircle,
    RefreshCw,
    Layers,
    DollarSign,
    Tag,
    XCircle,
    CheckCircle2,
    Users,
    Receipt,
    Sparkles,
    Info,
    Barcode,
    Pencil,
    Search,
    Package,
    Filter,
    X,
    AlertCircle,
    Lock
} from 'lucide-react';

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const inferCategoryAndPresentation = (productName = '', code = '') => {
    const text = `${productName} ${code}`.toLowerCase();

    let product_type = DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY;
    if (text.includes('cascara') || text.includes('cáscara') || text.includes('cascaron') || text.includes('cascarón') || text.includes('materia prima') || text.includes('caja de huevo') || text.includes('cajas de huevo') || text.includes('carton de huevo') || text.includes('cartón de huevo') || text.includes('cartonh') || text.includes('huevo blanco')) {
        product_type = 'huevo en cascara';
    } else if (text.includes('clara ppg') || text.includes('ppg')) {
        product_type = 'clara ppg';
    } else if (text.includes('clara')) {
        product_type = 'clara';
    } else if (text.includes('rapido') || text.includes('rápido')) {
        product_type = 'huevo rapido';
    } else if (text.includes('salada') || text.includes('yema sal')) {
        product_type = 'yema salada';
    } else if (text.includes('azucar') || text.includes('azúcar') || text.includes('yema azuc')) {
        product_type = 'yema azucarada';
    } else if (text.includes('fórmula') || text.includes('formula') || text.includes('mezcla') || text.includes('mix')) {
        product_type = 'fórmula especial';
    } else if (text.includes('huevo') || text.includes('entero')) {
        product_type = 'huevo entero';
    }

    let presentation = DEFAULT_INDUSTRIAL_PRESENTATION;
    if (text.includes('cubeta') || text.includes('32lb') || text.includes('32 lb') || text.includes('32l')) {
        presentation = 'cubeta 32LB';
    } else if (text.includes('carton 55') || text.includes('55lb') || text.includes('55 lb') || text.includes('carton') || text.includes('cartón')) {
        presentation = 'carton 55LB';
    } else if (text.includes('caja') || text.includes('cajas')) {
        presentation = 'caja 32LB';
    } else if (text.includes('unidad') || text.includes('unid') || text.includes('hcu')) {
        presentation = 'unidad 0.2LB';
    } else if (text.includes('galon') || text.includes('galón') || text.includes('8lb') || text.includes('8 lb')) {
        presentation = 'galon 8LB';
    } else if (text.includes('litro') || text.includes('2lb') || text.includes('2 lb') || text.includes('1 lt') || text.includes('1lt')) {
        presentation = 'litro 2LB';
    } else if (text.includes('bolsa 4lb') || text.includes('4lb') || text.includes('4 lb')) {
        presentation = 'bolsa 4LB';
    } else if (text.includes('20kg') || text.includes('20 kg')) {
        presentation = 'bolsa 20kg';
    } else if (text.includes('10kg') || text.includes('10 kg')) {
        presentation = 'bolsa 10kg';
    } else if (text.includes('5kg') || text.includes('5 kg')) {
        presentation = 'bolsa 5kg';
    } else if (text.includes('1kg') || text.includes('1 kg')) {
        presentation = 'bolsa 1kg';
    } else if (text.includes('tanque') || text.includes('1000') || text.includes('tote') || text.includes('granel')) {
        presentation = 'granel / tanque';
    }

    return { product_type, presentation };
};

const parseMappingCodes = (codes) => {
    const parsed = (Array.isArray(codes) ? codes : String(codes || '').split(','))
        .map((code) => String(code || '').trim())
        .filter(Boolean);

    return parsed.length > 0 ? parsed : [''];
};

const parseMappingItems = (m) => {
    if (m?.code_weights_json) {
        try {
            const parsed = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((item) => {
                    const lbs = Number(item.weight_lbs || m.unit_weight_lbs || m.weight_lbs || 1);
                    const kg = Number(item.weight_kg || poundsToKilograms(lbs));
                    return {
                        code: String(item.code || '').trim(),
                        weight_lbs: lbs > 0 ? lbs.toFixed(2) : '1.00',
                        weight_kg: kg > 0 ? kg.toFixed(2) : '0.45',
                        product_id: item.product_id || null,
                        product_name: item.product_name || ''
                    };
                }).filter((it) => it.code);
            }
        } catch (e) {
            console.error('Error parsing code_weights_json in parseMappingItems:', e);
        }
    }

    // Fallback: parse catalog_codes as strings and assign mapping's unit weight
    const rawCodes = parseMappingCodes(m?.codes || m?.catalog_codes);
    const defaultLbs = Number(m?.unit_weight_lbs ?? m?.weight_lbs ?? 1);
    const defaultKg = Number(m?.unit_weight_kg ?? m?.weight_kg ?? poundsToKilograms(defaultLbs));

    return rawCodes.map((code) => ({
        code,
        weight_lbs: defaultLbs > 0 ? defaultLbs.toFixed(2) : '1.00',
        weight_kg: defaultKg > 0 ? defaultKg.toFixed(2) : '0.45',
        product_id: m?.product_id || m?.catalog_product_id || null,
        product_name: m?.product_name || m?.catalog_product_name || ''
    }));
};

const createMappingForm = () => {
    const presentation = DEFAULT_INDUSTRIAL_PRESENTATION;
    const weightLbs = getIndustrialPresentationWeightLbs(presentation, 32);

    return {
        id: null,
        product_name: '',
        product_type: DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
        presentation,
        codes: [
            {
                code: '',
                weight_lbs: weightLbs > 0 ? weightLbs.toFixed(2) : '32.00',
                weight_kg: poundsToKilograms(weightLbs > 0 ? weightLbs : 32).toFixed(2),
                product_id: null,
                product_name: ''
            }
        ],
        unit_of_measure: DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT,
        notes: ''
    };
};

const EggConfig = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    // Tabs
    const [activeTab, setActiveTab] = useState('costs'); // 'costs', 'lot-prefixes', 'products'

    // Lists
    const [config, setConfig] = useState([]);
    const [costConcepts, setCostConcepts] = useState([]);
    const [providerLotConfigs, setProviderLotConfigs] = useState([]);
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Concept management
    const [newConcept, setNewConcept] = useState({ concept_name: '', default_value: '' });

    // Help Modal
    const [helpConceptModal, setHelpConceptModal] = useState(null);

    // Sync from Payroll & Expenses Modal
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncParams, setSyncParams] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        projected_batches: 20
    });
    const [syncData, setSyncData] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncPreviewLoading, setSyncPreviewLoading] = useState(false);

    // Provider Lot Config Modal
    const [isLotConfigModalOpen, setIsLotConfigModalOpen] = useState(false);
    const [editingLotConfig, setEditingLotConfig] = useState(null);
    const [lotConfigForm, setLotConfigForm] = useState({
        provider_id: '',
        lot_prefix: '',
        suffix_format: 'correlativo',
        notes: ''
    });

    // Mapeo de Códigos de Producto (Página 5 del documento)
    const [codeMappings, setCodeMappings] = useState([]);
    const [systemProducts, setSystemProducts] = useState([]);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [mappingSearchTerm, setMappingSearchTerm] = useState('');
    const [mappingForm, setMappingForm] = useState(createMappingForm);

    // Catálogo de Productos y Códigos del Sistema (Búsqueda interactiva)
    const [isProductCatalogModalOpen, setIsProductCatalogModalOpen] = useState(false);
    const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
    const [catalogFilterType, setCatalogFilterType] = useState('all'); // 'all', 'egg', 'unmapped', 'mapped'
    const [targetCodeIndex, setTargetCodeIndex] = useState(null);
    const [isFetchingProducts, setIsFetchingProducts] = useState(false);

    const defaults = {
        'huevo entero': { weight: '32.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'huevo rapido': { weight: '32.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'clara': { weight: '8.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'clara ppg': { weight: '8.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'yema salada': { weight: '4.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'yema azucarada': { weight: '4.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'fórmula especial': { weight: '32.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'huevo en cascara': { weight: '55.00', yield_pct: '100.00', shell_pct: '0.00', loss_pct: '0.00' }
    };

    const baseFormulationProducts = [
        { type: 'huevo entero', label: 'Huevo Entero Pasteurizado' },
        { type: 'huevo rapido', label: 'Huevo Entero Rápido' },
        { type: 'clara', label: 'Clara Pasteurizada' },
        { type: 'clara ppg', label: 'Clara PPG' },
        { type: 'yema salada', label: 'Yema Líquida Salada' },
        { type: 'yema azucarada', label: 'Yema Líquida Azucarada' },
        { type: 'fórmula especial', label: 'Fórmula Especial / Mezcla Premium' },
        { type: 'huevo en cascara', label: 'Huevo en Cáscara / Cascarón' }
    ];

    const eggProductsList = useMemo(() => {
        return (systemProducts || []).filter(p => {
            const t = `${p.nombre || ''} ${p.codigo || ''} ${p.codigo_barra || ''} ${p.category_name || ''}`.toLowerCase();
            return t.includes('huevo') || t.includes('clara') || t.includes('yema') || t.includes('ovoproducto') || t.includes('carton') || t.includes('cascara') || t.includes('caja');
        });
    }, [systemProducts]);

    const formulationProducts = useMemo(() => {
        const list = [...baseFormulationProducts];
        (codeMappings || []).forEach((m) => {
            const type = (m.product_type || m.industrial_product_type || '').trim().toLowerCase();
            const label = m.catalog_product_name || getRecipeFormulaName(type) || m.product_name;
            if (type && !list.some((p) => p.type === type)) {
                list.push({ type, label });
            }
        });
        return list;
    }, [codeMappings]);

    const getWeight = (productType) => {
        const cfg = config.find(c => c.product_type === productType);
        return cfg ? cfg.weight_per_unit_lbs : defaults[productType]?.weight || '32.00';
    };

    const getPct = (productType, field) => {
        const cfg = config.find(c => c.product_type === productType);
        return cfg && cfg[field] !== undefined ? cfg[field] : (defaults[productType]?.[field] || '0');
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [prodRes, costRes, lotRes, provRes, mapRes, sysProdRes] = await Promise.all([
                axios.get('/api/egg-industrial/product-config'),
                axios.get('/api/egg-industrial/cost-concepts'),
                axios.get('/api/egg-industrial/provider-lot-configs'),
                axios.get('/api/providers'),
                axios.get('/api/egg-industrial/code-mappings'),
                axios.get('/api/products?limit=500&status=activo')
            ]);

            const data = Array.isArray(prodRes.data) ? prodRes.data : [];
            const currentCodeMappings = Array.isArray(mapRes.data) ? mapRes.data : [];
            setCostConcepts(Array.isArray(costRes.data) ? costRes.data : []);
            setProviderLotConfigs(Array.isArray(lotRes.data) ? lotRes.data : []);
            setProviders(Array.isArray(provRes.data) ? provRes.data : (provRes.data?.data || []));
            setCodeMappings(currentCodeMappings);
            const prods = Array.isArray(sysProdRes.data) ? sysProdRes.data : (sysProdRes.data?.data || []);
            setSystemProducts(prods);

            const effectiveProducts = [...baseFormulationProducts];
            currentCodeMappings.forEach((m) => {
                const type = (m.product_type || m.industrial_product_type || '').trim().toLowerCase();
                const label = m.catalog_product_name || getRecipeFormulaName(type) || m.product_name;
                if (type && !effectiveProducts.some((p) => p.type === type)) {
                    effectiveProducts.push({ type, label });
                }
            });

            const merged = effectiveProducts.map(p => {
                const existing = data.find(c => c.product_type === p.type);
                return existing || {
                    product_type: p.type,
                    weight_per_unit_lbs: defaults[p.type]?.weight || '32.00',
                    yield_pct: defaults[p.type]?.yield_pct || '85.00',
                    waste_shell_pct: defaults[p.type]?.shell_pct || '12.00',
                    waste_loss_pct: defaults[p.type]?.loss_pct || '3.00'
                };
            });
            setConfig(merged);
        } catch (e) {
            console.error('Error loading config:', e);
            toast.error('Error al cargar la configuración.');
        } finally {
            setLoading(false);
        }
    };

    const fetchSystemProducts = async () => {
        setIsFetchingProducts(true);
        try {
            const res = await axios.get('/api/products?limit=500&status=activo');
            const prods = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setSystemProducts(prods);
            toast.success(`Catálogo actualizado: ${prods.length} productos disponibles.`);
        } catch (err) {
            console.error('Error cargando productos:', err);
            toast.error('Error al actualizar catálogo de productos.');
        } finally {
            setIsFetchingProducts(false);
        }
    };

    const handleOpenProductCatalog = (targetIdx = null) => {
        setTargetCodeIndex(targetIdx);
        setCatalogSearchQuery('');
        setCatalogFilterType('all');
        setIsProductCatalogModalOpen(true);
    };

    const isProductMapped = (prod, currentEditingId = null) => {
        const sku = (prod.codigo || '').trim().toLowerCase();
        const barcode = (prod.codigo_barra || '').trim().toLowerCase();
        const prodId = Number(prod.id);

        return codeMappings.some((m) => {
            if (currentEditingId && Number(m.id) === Number(currentEditingId)) return false;
            if (Number(m.product_id || m.catalog_product_id) === prodId) return true;
            const items = parseMappingItems(m);
            return items.some((it) => {
                const c = (it.code || '').toLowerCase();
                return (sku && c === sku) || (barcode && c === barcode) || (it.product_id && Number(it.product_id) === prodId);
            });
        });
    };

    const getProductMappingInfo = (prod, currentEditingId = null) => {
        const sku = (prod.codigo || '').trim().toLowerCase();
        const barcode = (prod.codigo_barra || '').trim().toLowerCase();
        const prodId = Number(prod.id);

        return codeMappings.find((m) => {
            if (currentEditingId && Number(m.id) === Number(currentEditingId)) return false;
            if (Number(m.product_id || m.catalog_product_id) === prodId) return true;
            const items = parseMappingItems(m);
            return items.some((it) => {
                const c = (it.code || '').toLowerCase();
                return (sku && c === sku) || (barcode && c === barcode) || (it.product_id && Number(it.product_id) === prodId);
            });
        });
    };

    const isProductInCurrentForm = (prod, targetIdx = null) => {
        const sku = (prod.codigo || '').trim().toLowerCase();
        const barcode = (prod.codigo_barra || '').trim().toLowerCase();
        const prodId = Number(prod.id);

        return (mappingForm.codes || []).some((it, idx) => {
            if (targetIdx !== null && idx === targetIdx) return false;
            const c = (it.code || '').trim().toLowerCase();
            return (sku && c === sku) || (barcode && c === barcode) || (it.product_id && Number(it.product_id) === prodId);
        });
    };

    const handleSelectProductCode = (product, codeType = 'sku') => {
        const skuCode = (product.codigo || '').trim();
        const barcode = (product.codigo_barra || '').trim();

        // 1. Validar que no esté ya vinculado a otra configuración de ovoproducto
        const existingMapping = getProductMappingInfo(product, mappingForm.id);
        if (existingMapping) {
            return toast.error(`El producto '${product.nombre}' ya está vinculado a '${existingMapping.product_name || existingMapping.industrial_product_type}'. No se puede duplicar.`);
        }

        // 2. Validar que no esté ya agregado en este mismo formulario
        if (isProductInCurrentForm(product, targetCodeIndex)) {
            return toast.error(`El producto '${product.nombre}' ya está seleccionado en este formulario.`);
        }

        const inferred = inferCategoryAndPresentation(product.nombre || product.name || '', skuCode || barcode);
        const presentationWeight = getIndustrialPresentationWeightLbs(inferred.presentation, 0);
        const itemWeightLbs = presentationWeight > 0 ? presentationWeight : (parseFloat(mappingForm.codes?.[0]?.weight_lbs) || 32);
        const itemWeightKg = poundsToKilograms(itemWeightLbs);

        let codesToInclude = [];
        if (codeType === 'both') {
            if (skuCode) codesToInclude.push(skuCode);
            if (barcode && barcode !== skuCode) codesToInclude.push(barcode);
        } else if (codeType === 'barcode') {
            if (barcode) codesToInclude.push(barcode);
            else if (skuCode) codesToInclude.push(skuCode);
        } else {
            if (skuCode) codesToInclude.push(skuCode);
            else if (barcode) codesToInclude.push(barcode);
        }

        if (codesToInclude.length === 0) {
            return toast.error('Este producto no tiene código SKU ni código de barra registrado.');
        }

        const newItems = codesToInclude.map(c => ({
            code: c,
            weight_lbs: itemWeightLbs.toFixed(2),
            weight_kg: itemWeightKg.toFixed(2),
            product_id: product.id,
            product_name: product.nombre || product.name || ''
        }));

        if (!isMappingModalOpen) {
            const recipeFormula = getRecipeFormulaName(inferred.product_type);
            setMappingForm({
                ...createMappingForm(),
                product_name: recipeFormula || product.nombre || product.name || '',
                product_type: inferred.product_type,
                presentation: inferred.presentation,
                codes: newItems,
                unit_of_measure: product.unidad_medida?.toLowerCase() === 'kg' ? 'kg' : 'lb'
            });
            setIsMappingModalOpen(true);
            setIsProductCatalogModalOpen(false);
            toast.success(`Producto '${recipeFormula || product.nombre}' preparado para vinculación.`);
            return;
        }

        // Si el modal de vinculación ya está abierto
        setMappingForm((current) => {
            let updated = [...(current.codes || [])];
            if (targetCodeIndex !== null && targetCodeIndex >= 0 && targetCodeIndex < updated.length) {
                updated[targetCodeIndex] = newItems[0];
                if (newItems.length > 1) {
                    updated.splice(targetCodeIndex + 1, 0, ...newItems.slice(1));
                }
            } else {
                if (updated.length === 1 && !updated[0].code?.trim()) {
                    updated = [...newItems];
                } else {
                    updated.push(...newItems);
                }
            }

            const resolvedType = current.product_type === DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY ? inferred.product_type : current.product_type;
            const recipeFormula = getRecipeFormulaName(resolvedType);
            return {
                ...current,
                codes: updated,
                product_name: !current.product_name?.trim() ? (recipeFormula || product.nombre || product.name || '') : current.product_name,
                product_type: resolvedType,
                presentation: current.presentation === DEFAULT_INDUSTRIAL_PRESENTATION ? inferred.presentation : current.presentation
            };
        });

        setIsProductCatalogModalOpen(false);
        setTargetCodeIndex(null);
        toast.success(`Código(s) [${codesToInclude.join(', ')}] insertado(s) con peso unitario de ${itemWeightLbs.toFixed(2)} lb.`);
    };

    const handleOpenCreateMapping = () => {
        const initialForm = createMappingForm();
        setMappingForm({
            ...initialForm,
            product_name: getRecipeFormulaName(initialForm.product_type)
        });
        setIsMappingModalOpen(true);
    };

    const handleOpenEditMapping = (m) => {
        const presentation = normalizeIndustrialPresentation(m.presentation);
        const items = parseMappingItems(m);

        setMappingForm({
            id: m.id,
            product_id: m.product_id || m.catalog_product_id || '',
            product_name: m.product_name || m.catalog_product_name || '',
            product_type: m.product_type || m.industrial_product_type || DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
            presentation,
            codes: items.length > 0 ? items : [
                {
                    code: '',
                    weight_lbs: '32.00',
                    weight_kg: '14.51',
                    product_id: null,
                    product_name: ''
                }
            ],
            unit_of_measure: m.unit_of_measure || DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT,
            notes: m.notes || ''
        });
        setIsMappingModalOpen(true);
    };

    const handleAddCodeToMapping = (mapping) => {
        const presentation = normalizeIndustrialPresentation(mapping.presentation);
        const items = parseMappingItems(mapping);
        const defLbs = getIndustrialPresentationWeightLbs(presentation, 32);

        setMappingForm({
            id: mapping.id,
            product_id: mapping.product_id || mapping.catalog_product_id || '',
            product_name: mapping.product_name || mapping.catalog_product_name || '',
            product_type: mapping.product_type || mapping.industrial_product_type || DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
            presentation,
            codes: [
                ...items,
                {
                    code: '',
                    weight_lbs: defLbs.toFixed(2),
                    weight_kg: poundsToKilograms(defLbs).toFixed(2),
                    product_id: null,
                    product_name: ''
                }
            ],
            unit_of_measure: mapping.unit_of_measure || DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT,
            notes: mapping.notes || ''
        });
        setIsMappingModalOpen(true);
    };

    const handleAddMappingCode = () => {
        const defWeight = getIndustrialPresentationWeightLbs(mappingForm.presentation, 32);
        setMappingForm((current) => ({
            ...current,
            codes: [
                ...current.codes,
                {
                    code: '',
                    weight_lbs: defWeight > 0 ? defWeight.toFixed(2) : (current.codes[0]?.weight_lbs || '32.00'),
                    weight_kg: poundsToKilograms(defWeight > 0 ? defWeight : parseFloat(current.codes[0]?.weight_lbs || 32)).toFixed(2),
                    product_id: null,
                    product_name: ''
                }
            ]
        }));
    };

    const handleUpdateMappingCode = (index, field, value, extraValue) => {
        setMappingForm((current) => {
            const updated = [...current.codes];
            const item = { ...updated[index] };

            if (field === 'code') {
                item.code = value;
                const match = systemProducts.find((p) =>
                    (p.codigo && p.codigo.toLowerCase() === value.trim().toLowerCase()) ||
                    (p.codigo_barra && p.codigo_barra.toLowerCase() === value.trim().toLowerCase())
                );
                if (match) {
                    item.product_id = match.id;
                    item.product_name = match.nombre || match.name || '';
                    if (!item.weight_lbs || item.weight_lbs === '0.00' || item.weight_lbs === '32.00') {
                        const inferred = inferCategoryAndPresentation(match.nombre || match.name || '', value);
                        const pWeight = getIndustrialPresentationWeightLbs(inferred.presentation, 0);
                        if (pWeight > 0) {
                            item.weight_lbs = pWeight.toFixed(2);
                            item.weight_kg = poundsToKilograms(pWeight).toFixed(2);
                        }
                    }
                }
            } else if (field === 'weight_lbs') {
                item.weight_lbs = value;
                if (extraValue !== undefined) item.weight_kg = extraValue;
            } else if (field === 'weight_kg') {
                item.weight_kg = value;
                if (extraValue !== undefined) item.weight_lbs = extraValue;
            } else {
                item[field] = value;
            }

            updated[index] = item;
            return { ...current, codes: updated };
        });
    };

    const handleRemoveMappingCode = (index) => {
        setMappingForm((current) => {
            const codes = current.codes.filter((_, codeIndex) => codeIndex !== index);
            const defWeight = getIndustrialPresentationWeightLbs(current.presentation, 32);
            return {
                ...current,
                codes: codes.length > 0 ? codes : [
                    {
                        code: '',
                        weight_lbs: defWeight.toFixed(2),
                        weight_kg: poundsToKilograms(defWeight).toFixed(2),
                        product_id: null,
                        product_name: ''
                    }
                ]
            };
        });
    };

    const handleSelectProductQuick = (index, product) => {
        if (!product) return;
        const code = (product.codigo || product.codigo_barra || '').trim();
        const inferred = inferCategoryAndPresentation(product.nombre || product.name || '', code);
        const pWeight = getIndustrialPresentationWeightLbs(inferred.presentation, 0);
        const lbs = pWeight > 0 ? pWeight : (parseFloat(mappingForm.codes?.[index]?.weight_lbs) || 32);
        const kg = poundsToKilograms(lbs);

        setMappingForm((current) => {
            const updated = [...current.codes];
            updated[index] = {
                code,
                weight_lbs: lbs.toFixed(2),
                weight_kg: kg.toFixed(2),
                product_id: product.id,
                product_name: product.nombre || product.name || ''
            };
            const resolvedType = current.product_type === DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY ? inferred.product_type : current.product_type;
            const recipeFormula = getRecipeFormulaName(resolvedType);
            return {
                ...current,
                codes: updated,
                product_name: !current.product_name?.trim() ? (recipeFormula || product.nombre || product.name || '') : current.product_name,
                product_type: resolvedType,
                presentation: current.presentation === DEFAULT_INDUSTRIAL_PRESENTATION ? inferred.presentation : current.presentation
            };
        });
    };

    const handleSaveMapping = async (e) => {
        e?.preventDefault();
        const validItems = (mappingForm.codes || [])
            .map((it) => ({
                ...it,
                code: (it.code || '').trim(),
                weight_lbs: parseFloat(it.weight_lbs) || 0,
                weight_kg: parseFloat(it.weight_kg) || 0
            }))
            .filter((it) => it.code.length > 0);

        if (!mappingForm.product_name?.trim()) {
            return toast.error('Debe indicar el nombre descriptivo del producto comercial.');
        }
        if (validItems.length === 0) {
            return toast.error('Debe ingresar al menos un código vinculado.');
        }

        // Validar que cada código tenga peso unitario > 0
        const zeroWeightItem = validItems.find((it) => it.weight_lbs <= 0);
        if (zeroWeightItem) {
            return toast.error(`El código "${zeroWeightItem.code}" debe tener un peso unitario en libras mayor a cero.`);
        }

        // Validar duplicados en el mismo formulario
        const codeCounts = new Map();
        for (const it of validItems) {
            const cLower = it.code.toLowerCase();
            codeCounts.set(cLower, (codeCounts.get(cLower) || 0) + 1);
            if (codeCounts.get(cLower) > 1) {
                return toast.error(`El código "${it.code}" está repetido en este formulario. Cada código debe ser único.`);
            }
        }

        // Validar duplicados contra otras vinculaciones existentes
        for (const it of validItems) {
            const cLower = it.code.toLowerCase();
            const existing = codeMappings.find((m) => {
                if (mappingForm.id && Number(m.id) === Number(mappingForm.id)) return false;
                const items = parseMappingItems(m);
                return items.some((otherIt) => otherIt.code.toLowerCase() === cLower);
            });
            if (existing) {
                return toast.error(`El código "${it.code}" ya está vinculado a "${existing.product_name || existing.industrial_product_type}". No se puede duplicar.`);
            }
        }

        try {
            const payload = {
                product_name: mappingForm.product_name.trim(),
                product_type: mappingForm.product_type,
                presentation: mappingForm.presentation,
                codes: validItems.map((it) => it.code),
                code_items: validItems,
                unit_weight_lbs: validItems[0]?.weight_lbs || 1,
                unit_weight_kg: validItems[0]?.weight_kg || 0.45,
                unit_of_measure: mappingForm.unit_of_measure,
                notes: mappingForm.notes
            };
            const res = mappingForm.id
                ? await axios.put(`/api/egg-industrial/code-mappings/${mappingForm.id}`, payload)
                : await axios.post('/api/egg-industrial/code-mappings', payload);
            toast.success(res.data?.message || 'Vinculación de códigos guardada con éxito.');
            setIsMappingModalOpen(false);
            const mapRes = await axios.get('/api/egg-industrial/code-mappings');
            setCodeMappings(mapRes.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al guardar la vinculación.');
        }
    };

    const handleDeleteMapping = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/code-mappings/${id}`);
            toast.success('Vinculación eliminada.');
            const mapRes = await axios.get('/api/egg-industrial/code-mappings');
            setCodeMappings(mapRes.data || []);
        } catch (err) {
            toast.error('Error al eliminar vinculación.');
        }
    };

    const handleSeedExampleMappings = async () => {
        const examples = [
            { product_name: 'Huevo Entero Pasteurizado Galón', product_type: 'huevo entero', presentation: 'galon 8LB', codes: ['HEGL8', 'hd4kg', '167347'], weight_lbs: 8.0, weight_kg: 3.63, unit_of_measure: 'lb', notes: 'Referencia oficial del documento (Galón)' },
            { product_name: 'Huevo Entero Pasteurizado Litro', product_type: 'huevo entero', presentation: 'litro 2LB', codes: ['hel2', '48758943'], weight_lbs: 2.0, weight_kg: 0.91, unit_of_measure: 'lb', notes: 'Referencia oficial del documento (Litro)' },
            { product_name: 'Huevo Entero Pasteurizado Cubeta', product_type: 'huevo entero', presentation: 'cubeta 32LB', codes: 'hec32', weight_lbs: 32.0, weight_kg: 14.51, unit_of_measure: 'lb', notes: 'Referencia oficial del documento (Cubeta)' },
            { product_name: 'Clara de Huevo Pasteurizada', product_type: 'clara', presentation: 'galon 8LB', codes: 'CL2b', weight_lbs: 8.0, weight_kg: 3.63, unit_of_measure: 'lb', notes: 'Referencia oficial del documento (Clara)' }
        ];
        try {
            const existingCodes = new Set(
                codeMappings.flatMap((mapping) => parseMappingCodes(mapping.codes || mapping.catalog_codes)
                    .map((code) => code.toLowerCase()))
            );
            const missingExamples = examples.filter((example) =>
                parseMappingCodes(example.codes).every((code) => !existingCodes.has(code.toLowerCase()))
            );

            if (missingExamples.length === 0) {
                return toast.info('Los códigos de ejemplo ya están vinculados.');
            }

            for (const ex of missingExamples) {
                await axios.post('/api/egg-industrial/code-mappings', ex);
            }
            toast.success('Códigos de ejemplo faltantes cargados correctamente.');
            const mapRes = await axios.get('/api/egg-industrial/code-mappings');
            setCodeMappings(mapRes.data || []);
        } catch (e) {
            toast.error('Error al cargar códigos de ejemplo.');
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [companyId]);

    // -------------------------------------------------------------
    // Product Config Handlers
    // -------------------------------------------------------------
    const handleUpdateProduct = (productType, field, value) => {
        setConfig(prev => {
            const idx = prev.findIndex(c => c.product_type === productType);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], [field]: value };
                return updated;
            }
            return [...prev, { product_type: productType, [field]: value }];
        });
    };

    const handleSaveProduct = async (product_type) => {
        try {
            await axios.put('/api/egg-industrial/product-config', {
                product_type,
                weight_per_unit_lbs: parseFloat(getWeight(product_type)),
                yield_pct: parseFloat(getPct(product_type, 'yield_pct')),
                waste_shell_pct: parseFloat(getPct(product_type, 'waste_shell_pct')),
                waste_loss_pct: parseFloat(getPct(product_type, 'waste_loss_pct'))
            });
            toast.success(`${product_type}: configurado correctamente.`);
        } catch (e) {
            toast.error('Error al guardar parámetro de producto.');
        }
    };

    const handleSaveAllProducts = async () => {
        try {
            for (const p of formulationProducts) {
                await axios.put('/api/egg-industrial/product-config', {
                    product_type: p.type,
                    weight_per_unit_lbs: parseFloat(getWeight(p.type)),
                    yield_pct: parseFloat(getPct(p.type, 'yield_pct')),
                    waste_shell_pct: parseFloat(getPct(p.type, 'waste_shell_pct')),
                    waste_loss_pct: parseFloat(getPct(p.type, 'waste_loss_pct'))
                });
            }
            toast.success('Todos los parámetros de producto guardados.');
        } catch (e) {
            toast.error('Error al guardar configuración global.');
        }
    };

    // -------------------------------------------------------------
    // Cost Concepts Handlers
    // -------------------------------------------------------------
    const handleAddConcept = async () => {
        if (!newConcept.concept_name.trim()) return toast.error('Ingrese el nombre del concepto.');
        try {
            await axios.post('/api/egg-industrial/cost-concepts', {
                concept_name: newConcept.concept_name,
                default_value: parseFloat(newConcept.default_value || 0)
            });
            toast.success('Concepto de costo agregado.');
            setNewConcept({ concept_name: '', default_value: '' });
            const costRes = await axios.get('/api/egg-industrial/cost-concepts');
            setCostConcepts(Array.isArray(costRes.data) ? costRes.data : []);
        } catch (e) {
            toast.error('Error al agregar concepto de costo.');
        }
    };

    const handleUpdateConcept = async (id, field, value) => {
        const concept = costConcepts.find(c => c.id === id);
        if (!concept) return;
        try {
            await axios.put(`/api/egg-industrial/cost-concepts/${id}`, {
                id,
                concept_name: field === 'concept_name' ? value : concept.concept_name,
                default_value: field === 'default_value' ? parseFloat(value || 0) : parseFloat(concept.default_value || 0)
            });
            setCostConcepts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        } catch (e) {
            toast.error('Error al actualizar concepto.');
        }
    };

    const handleDeleteConcept = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/cost-concepts/${id}`);
            setCostConcepts(prev => prev.filter(c => c.id !== id));
            toast.success('Concepto eliminado.');
        } catch (e) {
            toast.error('Error al eliminar concepto.');
        }
    };

    // -------------------------------------------------------------
    // System Sources Sync (Payroll & Expenses)
    // -------------------------------------------------------------
    const handleOpenSyncModal = async () => {
        setIsSyncModalOpen(true);
        fetchSyncPreview(syncParams.month, syncParams.year, syncParams.projected_batches);
    };

    const fetchSyncPreview = async (month, year, projected_batches) => {
        setSyncPreviewLoading(true);
        try {
            const res = await axios.get('/api/egg-industrial/costs/system-sources', {
                params: { month, year, projected_batches }
            });
            setSyncData(res.data);
        } catch (error) {
            console.error('Error fetching system sources:', error);
            toast.error('Error al consultar datos de planillas y gastos del sistema.');
        } finally {
            setSyncPreviewLoading(false);
        }
    };

    const handleConfirmSync = async () => {
        setIsSyncing(true);
        try {
            const res = await axios.post('/api/egg-industrial/costs/sync-system-sources', {
                month: syncParams.month,
                year: syncParams.year,
                projected_batches: syncParams.projected_batches
            });
            toast.success(res.data?.message || 'Costos sincronizados desde planillas y gastos reales.');
            setIsSyncModalOpen(false);
            fetchAllData();
        } catch (error) {
            console.error('Error syncing system sources:', error);
            toast.error(error.response?.data?.message || 'Error al sincronizar costos.');
        } finally {
            setIsSyncing(false);
        }
    };

    // -------------------------------------------------------------
    // Provider Lot Configuration Handlers
    // -------------------------------------------------------------
    const handleOpenLotConfigModal = (configItem = null) => {
        if (configItem) {
            setEditingLotConfig(configItem);
            setLotConfigForm({
                provider_id: configItem.provider_id,
                lot_prefix: configItem.lot_prefix || '',
                suffix_format: configItem.suffix_format || 'correlativo',
                notes: configItem.notes || ''
            });
        } else {
            setEditingLotConfig(null);
            setLotConfigForm({
                provider_id: '',
                lot_prefix: '',
                suffix_format: 'correlativo',
                notes: ''
            });
        }
        setIsLotConfigModalOpen(true);
    };

    const handleSaveLotConfig = async (e) => {
        e.preventDefault();
        if (!lotConfigForm.provider_id) return toast.error('Debe seleccionar un proveedor.');
        if (!lotConfigForm.lot_prefix.trim()) return toast.error('Debe ingresar un prefijo de lote.');

        try {
            await axios.post('/api/egg-industrial/provider-lot-configs', {
                provider_id: lotConfigForm.provider_id,
                lot_prefix: lotConfigForm.lot_prefix.trim().toUpperCase(),
                suffix_format: lotConfigForm.suffix_format,
                notes: lotConfigForm.notes
            });
            toast.success('Parametrización de lote para proveedor guardada.');
            setIsLotConfigModalOpen(false);
            const res = await axios.get('/api/egg-industrial/provider-lot-configs');
            setProviderLotConfigs(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error saving lot config:', error);
            toast.error(error.response?.data?.message || 'Error al guardar parametrización de lote.');
        }
    };

    const handleDeleteLotConfig = async (id) => {
        if (!confirm('¿Desea eliminar la regla de prefijo para este proveedor?')) return;
        try {
            await axios.delete(`/api/egg-industrial/provider-lot-configs/${id}`);
            toast.success('Regla de prefijo eliminada.');
            setProviderLotConfigs(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            toast.error('Error al eliminar regla de lote.');
        }
    };

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Settings className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configuración de Parámetros de Planta</h1>
                        <p className="text-xs text-slate-500 font-medium">Costos operativos con planillas RRHH, prefijos de lotes por proveedor y rendimientos estándar</p>
                    </div>
                </div>

                {/* Navigation Pills */}
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setActiveTab('costs')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'costs'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <DollarSign size={14} />
                        Costos y Planillas
                    </button>
                    <button
                        onClick={() => setActiveTab('lot-prefixes')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'lot-prefixes'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <Tag size={14} />
                        Prefijos de Lote por Proveedor
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'products'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <Layers size={14} />
                        Rendimientos de Producto
                    </button>
                    <button
                        onClick={() => setActiveTab('code-mappings')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'code-mappings'
                            ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                            }`}
                    >
                        <Barcode size={14} />
                        Vinculación de Códigos
                    </button>
                </div>
            </div>

            {/* TAB 1: COSTOS FIJOS Y PLANILLAS */}
            {activeTab === 'costs' && (
                <div className="space-y-6">
                    {/* Banner de Sincronización Automática con Planillas y Gastos */}
                    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold tracking-wide uppercase">
                                <Sparkles size={12} className="text-amber-300" />
                                Sin Datos Quemados • Integración Contable Real
                            </div>
                            <h2 className="text-lg font-bold tracking-tight">Carga Automática de Planillas de Nómina y Gastos Operativos</h2>
                            <p className="text-xs text-indigo-100/90 leading-relaxed font-normal">
                                Extrae en tiempo real los salarios reales del módulo de RRHH y las compras/gastos indirectos de fabricación (electricidad, gas, químicos CIP, depreciación) para prorratearlos exactamente entre los lotes proyectados del mes.
                            </p>
                        </div>
                        <button
                            onClick={handleOpenSyncModal}
                            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 border border-emerald-400/40"
                        >
                            <RefreshCw size={15} />
                            Cargar desde Planillas RRHH y Gastos Operativos
                        </button>
                    </div>

                    {/* Contenedor de Conceptos de Costo con Ayuda Interactiva */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-indigo-600" />
                                    Conceptos de Costos Fijos y Operativos de Planta
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Valores cargados automáticamente al costear cada lote de huevo líquido. Haga clic en el icono <span className="font-bold text-indigo-600">(?)</span> de cualquier concepto para conocer su origen y fórmula.
                                </p>
                            </div>
                            <button
                                onClick={() => setHelpConceptModal({
                                    concept_name: 'Guía General de Costeo de Planta',
                                    description: 'Los costos fijos y operativos representan todos los egresos indispensables para mantener en marcha la planta de pasteurizado ANDELSA, excluyendo el huevo cáscara (materia prima directa).',
                                    how_to_complete: 'Se complementan a partir de dos fuentes reales del sistema: (1) Las planillas de pago procesadas en el módulo de RRHH para operarios de planta, y (2) Los gastos registrados en contabilidad para servicios industriales (electricidad trifásica, gas GLP de calderas, agua potable, sanitizantes de ácido peracético, mantenimiento).',
                                    formula: 'Costo por Lote ($) = (Total Planillas Mensuales + Gastos Operativos Mensuales) / Lotes Estimados en el Mes.',
                                    example: 'Si la nómina mensual es de $6,428.80 y los gastos operativos son $1,200.00 (Total = $7,628.80), y se programan 20 lotes al mes, el costo asignado a cada lote es exactamente $381.44.',
                                    per_pound_impact: 'Al dividir el costo del lote entre las libras producidas (ej: 14,000 lbs de huevo líquido), el impacto es de aproximadamente $0.027 por cada libra producida.'
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all w-fit shadow-xs"
                            >
                                <HelpCircle size={14} />
                                ¿Cómo se calculan y complementan estos espacios?
                            </button>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {loading ? (
                            <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando conceptos de costo...</div>
                        ) : (
                            <div className="space-y-3">
                                {costConcepts.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Info size={24} className="mx-auto text-slate-400 mb-2" />
                                        <p className="text-xs font-bold text-slate-700">No hay conceptos de costo configurados.</p>
                                        <p className="text-[11px] text-slate-500 mt-1">Haga clic en el botón superior para cargar automáticamente desde planillas y gastos o agregue conceptos manualmente abajo.</p>
                                    </div>
                                ) : (
                                    costConcepts.map(c => (
                                        <div key={c.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200/90 rounded-xl p-3 hover:bg-slate-50/90 transition-all">
                                            {/* Concept Name */}
                                            <input
                                                type="text"
                                                value={c.concept_name}
                                                onChange={(e) => {
                                                    setCostConcepts(prev => prev.map(x => x.id === c.id ? { ...x, concept_name: e.target.value } : x));
                                                    handleUpdateConcept(c.id, 'concept_name', e.target.value);
                                                }}
                                                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            />

                                            {/* Value per Batch */}
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-32">
                                                    <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        value={c.default_value}
                                                        onChange={(e) => {
                                                            setCostConcepts(prev => prev.map(x => x.id === c.id ? { ...x, default_value: e.target.value } : x));
                                                        }}
                                                        onBlur={(e) => handleUpdateConcept(c.id, 'default_value', e.target.value)}
                                                        className="w-full pl-6 pr-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-emerald-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                                                        step="0.01"
                                                    />
                                                </div>

                                                {/* Interactive (?) Help Button */}
                                                <button
                                                    onClick={() => setHelpConceptModal({
                                                        concept_name: c.concept_name,
                                                        description: `Representa el concepto de costo operativo [${c.concept_name}] asignado de forma fija o semivariable a cada lote de pasteurización.`,
                                                        how_to_complete: c.concept_name.toLowerCase().includes('planilla') || c.concept_name.toLowerCase().includes('mano de obra')
                                                            ? 'Este espacio se complementa tomando el sueldo base y bonificaciones fijas devengadas por los empleados operativos de planta registrados en la nómina de RRHH, dividido entre el número de lotes mensuales.'
                                                            : 'Este espacio se complementa calculando el gasto mensual registrado en facturas de compras y gastos (energía, insumos, mantenimiento, sanitización) dividido entre la cantidad de lotes producidos al mes.',
                                                        formula: `Costo del Concepto por Lote ($) = Monto Mensual Total ($) / Lotes Estimados en el Mes`,
                                                        example: `Si el gasto mensual en ${c.concept_name} es de $${(parseFloat(c.default_value || 0) * 20).toFixed(2)}, al procesar 20 lotes en el mes se le carga a cada corrida de producción un valor de $${parseFloat(c.default_value || 0).toFixed(2)}.`,
                                                        per_pound_impact: `En una corrida típica de 15,000 libras de producto líquido terminado, este concepto añade aproximadamente $${((parseFloat(c.default_value || 0) || 0) / 15000).toFixed(4)} por cada libra producida.`
                                                    })}
                                                    className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors shadow-xs"
                                                    title="¿Cómo se complementa este concepto?"
                                                >
                                                    <HelpCircle size={15} />
                                                </button>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => handleDeleteConcept(c.id)}
                                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Eliminar concepto"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Agregar Nuevo Concepto */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-3 mt-4">
                                    <input
                                        type="text"
                                        value={newConcept.concept_name}
                                        onChange={(e) => setNewConcept({ ...newConcept, concept_name: e.target.value })}
                                        placeholder="Nombre de nuevo concepto (ej: Insumos de Sanitización CIP, Mantenimiento Preventivo)..."
                                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 shadow-xs"
                                    />
                                    <div className="relative w-full sm:w-32">
                                        <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={newConcept.default_value}
                                            onChange={(e) => setNewConcept({ ...newConcept, default_value: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full pl-6 pr-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            step="0.01"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddConcept}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0"
                                    >
                                        <Plus size={14} /> Agregar Concepto
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: PREFIJOS DE LOTE POR PROVEEDOR */}
            {activeTab === 'lot-prefixes' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Tag className="h-4 w-4 text-indigo-600" />
                                Parametrización de Prefijos de Lote por Proveedor
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Configure el prefijo y formato con el que cada proveedor identifica sus lotes de huevo en granja. Al recibir materia prima, el sistema sugerirá el lote automáticamente basándose en este prefijo y en el historial previo.
                            </p>
                        </div>
                        <button
                            onClick={() => handleOpenLotConfigModal()}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0"
                        >
                            <Plus size={15} />
                            Asignar Prefijo a Proveedor
                        </button>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {loading ? (
                        <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando parametrización de proveedores...</div>
                    ) : providerLotConfigs.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                            <Tag size={24} className="mx-auto text-slate-400" />
                            <p className="text-xs font-bold text-slate-700">No hay prefijos de lote configurados.</p>
                            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                                Cree una regla para asociar proveedores (ej: Don Héctor, Granja Candy, Avícola Salvadoreña) con sus códigos de lote correspondientes.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-4 py-3">Proveedor</th>
                                        <th className="px-4 py-3">Prefijo Configurado</th>
                                        <th className="px-4 py-3">Último Lote Registrado</th>
                                        <th className="px-4 py-3">Formato de Sufijo</th>
                                        <th className="px-4 py-3">Notas / Identificación Granja</th>
                                        <th className="px-4 py-3 text-center w-24">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {providerLotConfigs.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900 text-xs">{item.provider_name || 'Proveedor sin nombre'}</span>
                                                    {item.provider_nrc && (
                                                        <span className="text-[10px] text-slate-400 font-medium">NRC: {item.provider_nrc}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-xs">
                                                    {item.lot_prefix}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.last_used_lot ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px] font-semibold">
                                                        {item.last_used_lot}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px]">Sin lotes previos</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 capitalize">
                                                <span className="text-slate-600 font-medium text-[11px]">
                                                    {item.suffix_format === 'correlativo' && 'Correlativo numérico (-01, -02)'}
                                                    {item.suffix_format === 'fecha-juliana' && 'Fecha Juliana (J-DDD)'}
                                                    {item.suffix_format === 'secuencial' && 'Secuencial continuo'}
                                                    {!item.suffix_format && 'Correlativo estándar'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-[11px]">
                                                {item.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenLotConfigModal(item)}
                                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 shadow-xs"
                                                        title="Editar parametrización"
                                                    >
                                                        <Settings size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLotConfig(item.id)}
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 shadow-xs"
                                                        title="Eliminar regla"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: RENDIMIENTOS Y PESOS POR PRODUCTO */}
            {activeTab === 'products' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Layers className="h-4 w-4 text-indigo-600" />
                                Peso por Unidad y Rendimientos Estándar de Formulación
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Estos valores se usarán como referencia y sugerencia al envasar y formular cada lote de producción.</p>
                        </div>
                        <button
                            onClick={handleSaveAllProducts}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0"
                        >
                            <Save size={15} />
                            Guardar Toda la Configuración
                        </button>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {loading ? (
                        <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando parámetros...</div>
                    ) : (
                        <div className="space-y-4">
                            {formulationProducts.map(p => (
                                <div key={p.type} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800 capitalize">{p.label}</span>
                                        <button
                                            onClick={() => handleSaveProduct(p.type)}
                                            className="px-3 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-all shadow-xs"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Peso/Unidad (lb)</span>
                                            <input
                                                type="number"
                                                value={getWeight(p.type)}
                                                onChange={(e) => handleUpdateProduct(p.type, 'weight_per_unit_lbs', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Rendimiento %</span>
                                            <input
                                                type="number"
                                                value={getPct(p.type, 'yield_pct')}
                                                onChange={(e) => handleUpdateProduct(p.type, 'yield_pct', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-emerald-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-amber-700 uppercase block">Cáscara %</span>
                                            <input
                                                type="number"
                                                value={getPct(p.type, 'waste_shell_pct')}
                                                onChange={(e) => handleUpdateProduct(p.type, 'waste_shell_pct', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-amber-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-rose-700 uppercase block">Merma %</span>
                                            <input
                                                type="number"
                                                value={getPct(p.type, 'waste_loss_pct')}
                                                onChange={(e) => handleUpdateProduct(p.type, 'waste_loss_pct', e.target.value)}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-rose-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: VINCULACIÓN DE CÓDIGOS DE PRODUCTO (PÁGINA 5 DEL DOCUMENTO) */}
            {activeTab === 'code-mappings' && (
                <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[11px] font-bold tracking-wide uppercase">
                                <Sparkles size={12} className="text-amber-300" />
                                Vinculación Multicódigo • Inventario Real & Sincronizado
                            </div>
                            <h2 className="text-xl font-bold tracking-tight">
                                Matriz de Códigos y Presentaciones Industriales
                            </h2>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Esta relación asocia los diversos códigos utilizados en materia prima, corridas de producción y envasado
                                (ej: <code>HEGL8, hd4kg, 167347</code> para galón o <code>hel2, 48758943</code> para litro).
                                Traduce las existencias hacia el CRM, pedidos y producción sin alterar el inventario de facturación general.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={handleOpenCreateMapping}
                                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs"
                            >
                                <Plus size={14} />
                                Nueva Vinculación
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Vinculaciones */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Barcode className="text-indigo-600" size={18} />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                    Códigos Registrados ({codeMappings.length})
                                </h3>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código, producto..."
                                    value={mappingSearchTerm}
                                    onChange={(e) => setMappingSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:bg-white focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {codeMappings.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                                <Barcode className="h-10 w-10 text-slate-300 mx-auto" />
                                <p className="text-xs text-slate-500 font-medium">No se han registrado vinculaciones de códigos aún.</p>
                                <button
                                    type="button"
                                    onClick={handleSeedExampleMappings}
                                    className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors"
                                >
                                    Cargar códigos de muestra del documento
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="p-3">Producto Comercial</th>
                                            <th className="p-3">Tipo</th>
                                            <th className="p-3">Presentación</th>
                                            <th className="p-3">Códigos Vinculados (Diversos Sistemas)</th>
                                            <th className="p-3 text-right">Peso Equivalente</th>
                                            <th className="p-3">Unidad</th>
                                            <th className="p-3">Producto Catálogo</th>
                                            <th className="p-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {codeMappings.filter(m => {
                                            if (!mappingSearchTerm.trim()) return true;
                                            const term = mappingSearchTerm.toLowerCase();
                                            return (m.product_name || '').toLowerCase().includes(term) ||
                                                (m.codes || '').toLowerCase().includes(term) ||
                                                (m.product_type || '').toLowerCase().includes(term) ||
                                                (m.presentation || '').toLowerCase().includes(term);
                                        }).map(m => {
                                            const items = parseMappingItems(m);
                                            const weights = items.map(it => parseFloat(it.weight_lbs) || 0).filter(w => w > 0);
                                            const minW = weights.length > 0 ? Math.min(...weights) : parseFloat(m.unit_weight_lbs || 0);
                                            const maxW = weights.length > 0 ? Math.max(...weights) : parseFloat(m.unit_weight_lbs || 0);
                                            const linkedProductNames = Array.from(new Set(items.map(it => it.product_name).filter(Boolean)));

                                            return (
                                                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3 font-bold text-slate-900">
                                                        <div>{m.catalog_product_name || getRecipeFormulaName(m.product_type) || m.product_name || 'Sin descripción'}</div>
                                                        {m.notes && <div className="text-[10px] text-slate-400 font-normal italic">{m.notes}</div>}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold uppercase capitalize">
                                                            {m.product_type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-semibold text-slate-700 capitalize">
                                                        {m.presentation}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {items.map((it, ci) => (
                                                                <span
                                                                    key={ci}
                                                                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200"
                                                                    title={`Peso: ${parseFloat(it.weight_lbs).toFixed(2)} lb (~${parseFloat(it.weight_kg).toFixed(2)} kg)${it.product_name ? ` | ${it.product_name}` : ''}`}
                                                                >
                                                                    <span>{it.code}</span>
                                                                    <span className="text-[10px] text-indigo-600 font-semibold font-sans bg-indigo-50 px-1 rounded border border-indigo-100">
                                                                        {parseFloat(it.weight_lbs).toFixed(1)} lb
                                                                    </span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="font-bold text-slate-900">
                                                            {minW === maxW ? `${minW.toFixed(2)} lb` : `${minW.toFixed(1)} - ${maxW.toFixed(1)} lb`}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium">
                                                            {minW === maxW ? `~${poundsToKilograms(minW).toFixed(2)} kg` : `~${poundsToKilograms(minW).toFixed(1)} - ${poundsToKilograms(maxW).toFixed(1)} kg`}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-bold uppercase">
                                                        {m.unit_of_measure || 'lb'}
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-medium">
                                                        {linkedProductNames.length > 0 ? (
                                                            <div className="space-y-0.5 max-w-[200px]">
                                                                {linkedProductNames.map((pName, pIdx) => (
                                                                    <div key={pIdx} className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 truncate" title={pName}>
                                                                        <CheckCircle2 size={11} className="shrink-0" />
                                                                        <span className="truncate">{pName}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : m.catalog_product_name ? (
                                                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                                                                <CheckCircle2 size={11} className="shrink-0" />
                                                                {m.catalog_product_name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">Auto por código / SKU</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddCodeToMapping(m)}
                                                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors"
                                                                title="Agregar otro código a este producto"
                                                                aria-label="Agregar otro código a este producto"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditMapping(m)}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors"
                                                                title="Editar Mapeo"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMapping(m.id)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                                                                title="Eliminar Mapeo"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL DE VINCULACIÓN DE CÓDIGOS */}
            {isMappingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    {/* Datalist para autocompletar códigos del sistema mientras se escribe */}
                    <datalist id="system-product-codes-list">
                        {systemProducts.flatMap(p => {
                            const entries = [];
                            const sku = p.codigo?.trim();
                            const barcode = p.codigo_barra?.trim();
                            const name = p.nombre || p.name || '';
                            if (sku) entries.push(<option key={`sku-${p.id}`} value={sku}>{sku} - {name}</option>);
                            if (barcode && barcode !== sku) {
                                entries.push(<option key={`bar-${p.id}`} value={barcode}>{barcode} - {name}</option>);
                            }
                            return entries;
                        })}
                    </datalist>

                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto text-slate-900 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Barcode size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                        {mappingForm.id ? 'Editar Vinculación de Códigos' : 'Nueva Vinculación de Códigos'}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">Asociación de códigos para inventario y CRM</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMappingModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMapping} className="space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        Producto Comercial / Nombre de la Receta o Fórmula *
                                    </label>
                                    <span className="text-[10px] text-indigo-600 font-semibold">
                                        Mismo nombre que en Formulación
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={mappingForm.product_name}
                                    onChange={(e) => setMappingForm({ ...mappingForm, product_name: e.target.value })}
                                    placeholder="Ej: Clara PPG, Huevo Entero Rápido, Huevo Entero Pasteurizado"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                {/* Quick selection chips con las recetas canónicas */}
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">Recetas Oficiales:</span>
                                    {RECIPES_CATALOG.map((rec) => (
                                        <button
                                            key={rec.type}
                                            type="button"
                                            onClick={() => setMappingForm(prev => ({
                                                ...prev,
                                                product_name: rec.label,
                                                product_type: rec.type
                                            }))}
                                            className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border transition-colors ${
                                                mappingForm.product_name === rec.label || mappingForm.product_type === rec.type
                                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold shadow-xs'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {rec.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Categoría industrial *
                                    </label>
                                    <select
                                        value={mappingForm.product_type}
                                        onChange={(e) => {
                                            const nextType = e.target.value;
                                            const suggestedName = getRecipeFormulaName(nextType);
                                            setMappingForm(prev => ({
                                                ...prev,
                                                product_type: nextType,
                                                product_name: (!prev.product_name?.trim() || Object.values(RECIPE_FORMULA_NAMES).includes(prev.product_name))
                                                    ? suggestedName
                                                    : prev.product_name
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        {INDUSTRIAL_PRODUCT_CATEGORIES.map((category) => (
                                            <option key={category.value} value={category.value}>{category.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Presentación *
                                    </label>
                                    <select
                                        value={mappingForm.presentation}
                                        onChange={(e) => {
                                            const presentation = e.target.value;
                                            const lbs = getIndustrialPresentationWeightLbs(presentation, 0);
                                            setMappingForm(prev => {
                                                const nextLbs = lbs > 0 ? lbs.toFixed(2) : null;
                                                const nextKg = lbs > 0 ? poundsToKilograms(lbs).toFixed(2) : null;
                                                return {
                                                    ...prev,
                                                    presentation,
                                                    codes: (prev.codes || []).map((it, idx) => {
                                                        if (nextLbs && (idx === 0 || !it.weight_lbs || it.weight_lbs === '32.00')) {
                                                            return {
                                                                ...it,
                                                                weight_lbs: nextLbs,
                                                                weight_kg: nextKg
                                                            };
                                                        }
                                                        return it;
                                                    })
                                                };
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        {INDUSTRIAL_PRESENTATIONS.map((item) => (
                                            <option key={item.value} value={item.value}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Unidad de medida *
                                    </label>
                                    <select
                                        value={mappingForm.unit_of_measure}
                                        onChange={(e) => setMappingForm({ ...mappingForm, unit_of_measure: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        {INDUSTRIAL_MEASUREMENT_UNITS.map((unit) => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                            Códigos vinculados y pesos unitarios *
                                        </label>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                            {(mappingForm.codes || []).filter(c => (c.code || '').trim()).length} vinculados
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenProductCatalog(null)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-2xs"
                                            title="Buscar códigos de productos registrados en el sistema"
                                        >
                                            <Search size={12} />
                                            Buscar en sistema
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleAddMappingCode}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                                            title="Agregar otro renglón de código manual"
                                        >
                                            <Plus size={12} />
                                            Manual
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400 mb-2">
                                    Cada código seleccionado tiene su propio peso unitario para calcular con precisión el stock y la equivalencia.
                                </p>
                                <div className="space-y-2.5">
                                    {mappingForm.codes.map((item, index) => (
                                        <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        list="system-product-codes-list"
                                                        value={typeof item === 'string' ? item : (item.code || '')}
                                                        onChange={(e) => {
                                                             const val = e.target.value;
                                                             handleUpdateMappingCode(index, 'code', val);
                                                             const match = systemProducts.find(p =>
                                                                 (p.codigo && p.codigo.toLowerCase() === val.toLowerCase()) ||
                                                                 (p.codigo_barra && p.codigo_barra.toLowerCase() === val.toLowerCase())
                                                             );
                                                             if (match && !mappingForm.product_name?.trim()) {
                                                                 const inferred = inferCategoryAndPresentation(match.nombre || match.name || '', val);
                                                                 const formulaName = getRecipeFormulaName(inferred.product_type);
                                                                 setMappingForm(prev => ({
                                                                     ...prev,
                                                                     product_name: formulaName || match.nombre || match.name || prev.product_name,
                                                                     product_type: prev.product_type === DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY ? inferred.product_type : prev.product_type,
                                                                     presentation: prev.presentation === DEFAULT_INDUSTRIAL_PRESENTATION ? inferred.presentation : prev.presentation
                                                                 }));
                                                             }
                                                         }}
                                                        placeholder={index === 0 ? 'Ej: HC, H1 o escribe para buscar...' : 'Otro código (SKU o Barra)'}
                                                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenProductCatalog(index)}
                                                        className="absolute right-2.5 top-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                        title="Buscar y seleccionar código de la lista de productos del sistema"
                                                    >
                                                        <Search size={14} />
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveMappingCode(index)}
                                                    disabled={mappingForm.codes.length === 1}
                                                    className="inline-flex shrink-0 items-center justify-center p-2 text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                                                    title="Quitar código"
                                                    aria-label="Quitar código"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            {/* Nombre del producto detectado/vinculado si existe */}
                                            {item.product_name && (
                                                <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1 pl-1">
                                                    <span className="text-slate-400">Producto:</span>
                                                    <span className="font-bold text-slate-700 truncate">{item.product_name}</span>
                                                </div>
                                            )}

                                            {/* Pesos unitarios individuales para este código */}
                                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">
                                                        Peso Unitario (Lbs) *
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.weight_lbs ?? ''}
                                                            onChange={(e) => {
                                                                const lbsVal = e.target.value;
                                                                const lbsNum = parseFloat(lbsVal) || 0;
                                                                handleUpdateMappingCode(index, 'weight_lbs', lbsVal, poundsToKilograms(lbsNum).toFixed(2));
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                                        />
                                                        <span className="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400">lb</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">
                                                        Peso Unitario (Kg) *
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.weight_kg ?? ''}
                                                            onChange={(e) => {
                                                                const kgVal = e.target.value;
                                                                const kgNum = parseFloat(kgVal) || 0;
                                                                handleUpdateMappingCode(index, 'weight_kg', kgVal, kilogramsToPounds(kgNum).toFixed(2));
                                                            }}
                                                            placeholder="0.00"
                                                            className="w-full pl-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                                        />
                                                        <span className="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400">kg</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-1.5">
                                    Escribe para autocompletar por SKU o pulsa <strong>Buscar en sistema</strong> para elegir desde el catálogo.
                                </span>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                    Notas y Comentarios
                                </label>
                                <textarea
                                    rows={2}
                                    value={mappingForm.notes}
                                    onChange={(e) => setMappingForm({ ...mappingForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
                                    placeholder="Observaciones de vinculación..."
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsMappingModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                                >
                                    Guardar Vinculación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DEL CATÁLOGO DE PRODUCTOS Y CÓDIGOS DEL SISTEMA */}
            {isProductCatalogModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col text-slate-900 space-y-4">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Package size={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900">
                                            Catálogo de Productos y Códigos del Sistema
                                        </h3>
                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-bold">
                                            {systemProducts.length} productos
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {targetCodeIndex !== null
                                            ? `Selecciona un código para asignarlo al renglón #${targetCodeIndex + 1}`
                                            : 'Busca y selecciona códigos actuales (SKU / Código de Barra) para vincularlos al módulo industrial'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={fetchSystemProducts}
                                    disabled={isFetchingProducts}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors disabled:opacity-50"
                                    title="Recargar productos desde la base de datos"
                                >
                                    <RefreshCw size={13} className={isFetchingProducts ? 'animate-spin text-indigo-600' : ''} />
                                    <span>{isFetchingProducts ? 'Actualizando...' : 'Refrescar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsProductCatalogModalOpen(false);
                                        setTargetCodeIndex(null);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                    aria-label="Cerrar modal"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Search & Filters */}
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por código SKU, código de barra, nombre del producto o categoría..."
                                    value={catalogSearchQuery}
                                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                                />
                                {catalogSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setCatalogSearchQuery('')}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Filtros rápidos por chips */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mr-1">
                                    <Filter size={12} /> Filtrar:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('all')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'all'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    Todos ({systemProducts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('egg')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'egg'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    🥚 Huevo / Ovoproductos ({systemProducts.filter(p => {
                                        const t = `${p.nombre || ''} ${p.descripcion || ''} ${p.category_name || ''} ${p.codigo || ''}`.toLowerCase();
                                        return t.includes('huevo') || t.includes('clara') || t.includes('yema') || t.includes('ovoproducto') || t.includes('pasteuriz');
                                    }).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('unmapped')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'unmapped'
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                        }`}
                                >
                                    ⚠️ Sin Vincular ({systemProducts.filter(p => !isProductMapped(p, mappingForm.id)).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('mapped')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'mapped'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                >
                                    ✅ Ya Vinculados ({systemProducts.filter(p => isProductMapped(p, mappingForm.id)).length})
                                </button>
                            </div>
                        </div>

                        {/* Listado de Productos */}
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl max-h-[55vh] divide-y divide-slate-100">
                            {(() => {
                                const filtered = systemProducts.filter(p => {
                                    // Filtro por tipo
                                    if (catalogFilterType === 'egg') {
                                        const t = `${p.nombre || ''} ${p.descripcion || ''} ${p.category_name || ''} ${p.codigo || ''}`.toLowerCase();
                                        if (!t.includes('huevo') && !t.includes('clara') && !t.includes('yema') && !t.includes('ovoproducto') && !t.includes('pasteuriz')) {
                                            return false;
                                        }
                                    } else if (catalogFilterType === 'unmapped' && isProductMapped(p, mappingForm.id)) {
                                        return false;
                                    } else if (catalogFilterType === 'mapped' && !isProductMapped(p, mappingForm.id)) {
                                        return false;
                                    }

                                    // Filtro por búsqueda de texto
                                    if (!catalogSearchQuery.trim()) return true;
                                    const q = catalogSearchQuery.toLowerCase();
                                    return (
                                        (p.nombre || '').toLowerCase().includes(q) ||
                                        (p.codigo || '').toLowerCase().includes(q) ||
                                        (p.codigo_barra || '').toLowerCase().includes(q) ||
                                        (p.category_name || '').toLowerCase().includes(q) ||
                                        (p.descripcion || '').toLowerCase().includes(q)
                                    );
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="p-8 text-center space-y-2">
                                            <Package className="h-10 w-10 text-slate-300 mx-auto" />
                                            <p className="text-xs font-bold text-slate-600">No se encontraron productos coincidentes.</p>
                                            <p className="text-[11px] text-slate-400">Intenta buscar por otro término o limpia los filtros.</p>
                                        </div>
                                    );
                                }

                                return filtered.map(prod => {
                                    const mappingInfo = getProductMappingInfo(prod, mappingForm.id);
                                    const alreadyMapped = Boolean(mappingInfo);
                                    const alreadyInForm = isProductInCurrentForm(prod, targetCodeIndex);
                                    const isBlocked = alreadyMapped || alreadyInForm;
                                    const hasSku = Boolean(prod.codigo?.trim());
                                    const hasBarcode = Boolean(prod.codigo_barra?.trim() && prod.codigo_barra !== prod.codigo);

                                    return (
                                        <div
                                            key={prod.id}
                                            className={`p-3 sm:p-3.5 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                                                isBlocked ? 'bg-slate-50/60 opacity-80' : 'hover:bg-slate-50/90'
                                            }`}
                                        >
                                            {/* Datos del producto */}
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                                                        {prod.nombre || prod.name}
                                                    </span>
                                                    {prod.category_name && (
                                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {prod.category_name}
                                                        </span>
                                                    )}
                                                    {prod.unidad_medida && (
                                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase">
                                                            {prod.unidad_medida}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Códigos disponibles */}
                                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                                    {hasSku && (
                                                        <button
                                                            type="button"
                                                            onClick={() => !isBlocked && handleSelectProductCode(prod, 'sku')}
                                                            disabled={isBlocked}
                                                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                                                isBlocked
                                                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200'
                                                            }`}
                                                            title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : 'Click para usar este código SKU'}
                                                        >
                                                            <Barcode size={12} />
                                                            <span>SKU: {prod.codigo}</span>
                                                        </button>
                                                    )}

                                                    {hasBarcode && (
                                                        <button
                                                            type="button"
                                                            onClick={() => !isBlocked && handleSelectProductCode(prod, 'barcode')}
                                                            disabled={isBlocked}
                                                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                                                isBlocked
                                                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                                                            }`}
                                                            title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : 'Click para usar este código de barra'}
                                                        >
                                                            <Barcode size={12} />
                                                            <span>Barra: {prod.codigo_barra}</span>
                                                        </button>
                                                    )}

                                                    {!hasSku && !hasBarcode && (
                                                        <span className="text-[10px] text-amber-600 font-bold italic flex items-center gap-1">
                                                            <AlertCircle size={11} /> Sin código SKU ni Barra
                                                        </span>
                                                    )}

                                                    {/* Estado de vinculación */}
                                                    {alreadyMapped ? (
                                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1" title={`Bloqueado: Ya vinculado a "${mappingInfo.product_name || mappingInfo.product_type}"`}>
                                                            <Lock size={11} className="text-amber-600 shrink-0" />
                                                            <span>Ya Vinculado: {mappingInfo.product_name || mappingInfo.product_type} ({mappingInfo.presentation})</span>
                                                        </span>
                                                    ) : alreadyInForm ? (
                                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1" title="Ya está agregado en este formulario">
                                                            <CheckCircle2 size={11} className="text-indigo-600 shrink-0" />
                                                            <span>Ya en este formulario</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                            <Sparkles size={11} className="text-emerald-500 shrink-0" />
                                                            <span>Disponible para vincular</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Botones de acción rápida */}
                                            <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
                                                {hasSku && hasBarcode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => !isBlocked && handleSelectProductCode(prod, 'both')}
                                                        disabled={isBlocked}
                                                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                                                            isBlocked
                                                                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                                                        }`}
                                                        title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : 'Insertar ambos códigos (SKU + Barra)'}
                                                    >
                                                        + Ambos Códigos
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => !isBlocked && handleSelectProductCode(prod, hasSku ? 'sku' : 'barcode')}
                                                    disabled={isBlocked}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ${
                                                        isBlocked
                                                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400'
                                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                    }`}
                                                    title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : (isMappingModalOpen ? 'Usar en Formulario' : 'Crear Vinculación')}
                                                >
                                                    {isBlocked ? <Lock size={12} /> : <Sparkles size={12} />}
                                                    <span>
                                                        {isBlocked
                                                            ? (alreadyMapped ? 'Ya Vinculado' : 'Ya en Formulario')
                                                            : (isMappingModalOpen ? 'Usar en Formulario' : 'Crear Vinculación')}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                            <span className="font-medium">
                                Haz clic en cualquier código SKU o en <strong>Usar en Formulario</strong> para insertarlo instantáneamente.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProductCatalogModalOpen(false);
                                    setTargetCodeIndex(null);
                                }}
                                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL DE AYUDA INTERACTIVO (?) */}
            {helpConceptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto text-slate-900 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                                    <HelpCircle size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                        ¿Cómo se complementa este espacio?
                                    </h3>
                                    <span className="text-xs text-indigo-600 font-bold">{helpConceptModal.concept_name}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setHelpConceptModal(null)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            {/* Qué representa */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px] block">1. ¿Qué representa este concepto?</span>
                                <p className="text-slate-600 leading-relaxed font-medium">{helpConceptModal.description}</p>
                            </div>

                            {/* De dónde se extrae */}
                            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-indigo-900 uppercase tracking-wide text-[10px] block">2. ¿De dónde sale y cómo se complementa?</span>
                                <p className="text-indigo-800 leading-relaxed">{helpConceptModal.how_to_complete}</p>
                            </div>

                            {/* Fórmula y Ejemplo */}
                            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-1.5">
                                <span className="font-bold text-emerald-900 uppercase tracking-wide text-[10px] block">3. Fórmula de Cálculo por Lote</span>
                                <div className="p-2 bg-white rounded-lg font-mono text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                    {helpConceptModal.formula}
                                </div>
                                <p className="text-emerald-900 leading-relaxed text-[11px] pt-1">
                                    <span className="font-bold">Ejemplo práctico:</span> {helpConceptModal.example}
                                </p>
                            </div>

                            {/* Incidencia en el Costo por Libra */}
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-amber-900 uppercase tracking-wide text-[10px] block">4. Incidencia en el Costo Final por Libra</span>
                                <p className="text-amber-900 leading-relaxed">{helpConceptModal.per_pound_impact}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button
                                onClick={() => setHelpConceptModal(null)}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE AYUDA INTERACTIVO (?) */}
            {helpConceptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto text-slate-900 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                                    <HelpCircle size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                        ¿Cómo se complementa este espacio?
                                    </h3>
                                    <span className="text-xs text-indigo-600 font-bold">{helpConceptModal.concept_name}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setHelpConceptModal(null)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            {/* Qué representa */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px] block">1. ¿Qué representa este concepto?</span>
                                <p className="text-slate-600 leading-relaxed font-medium">{helpConceptModal.description}</p>
                            </div>

                            {/* De dónde se extrae */}
                            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-indigo-900 uppercase tracking-wide text-[10px] block">2. ¿De dónde sale y cómo se complementa?</span>
                                <p className="text-indigo-800 leading-relaxed">{helpConceptModal.how_to_complete}</p>
                            </div>

                            {/* Fórmula y Ejemplo */}
                            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-1.5">
                                <span className="font-bold text-emerald-900 uppercase tracking-wide text-[10px] block">3. Fórmula de Cálculo por Lote</span>
                                <div className="p-2 bg-white rounded-lg font-mono text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                    {helpConceptModal.formula}
                                </div>
                                <p className="text-emerald-900 leading-relaxed text-[11px] pt-1">
                                    <span className="font-bold">Ejemplo práctico:</span> {helpConceptModal.example}
                                </p>
                            </div>

                            {/* Incidencia en el Costo por Libra */}
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-1">
                                <span className="font-bold text-amber-900 uppercase tracking-wide text-[10px] block">4. Incidencia en el Costo Final por Libra</span>
                                <p className="text-amber-900 leading-relaxed">{helpConceptModal.per_pound_impact}</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button
                                onClick={() => setHelpConceptModal(null)}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE SINCRONIZACIÓN DE PLANILLAS Y GASTOS OPERATIVOS */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto text-slate-900 space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                    <RefreshCw size={22} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                                        Cargar Costos desde Planillas y Gastos Reales
                                    </h2>
                                    <p className="text-xs text-slate-500">Módulo Contable & Nómina RRHH - Empresa ANDELSA</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSyncModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Parámetros de Consulta */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Año de Período</label>
                                <input
                                    type="number"
                                    value={syncParams.year}
                                    onChange={(e) => {
                                        const y = parseInt(e.target.value) || 2026;
                                        setSyncParams({ ...syncParams, year: y });
                                        fetchSyncPreview(syncParams.month, y, syncParams.projected_batches);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Mes de Operación</label>
                                <select
                                    value={syncParams.month}
                                    onChange={(e) => {
                                        const m = parseInt(e.target.value) || 1;
                                        setSyncParams({ ...syncParams, month: m });
                                        fetchSyncPreview(m, syncParams.year, syncParams.projected_batches);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold"
                                >
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={idx + 1} value={idx + 1}>
                                            {name} ({idx + 1})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Lotes Proyectados en el Mes</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={syncParams.projected_batches}
                                    onChange={(e) => {
                                        const p = parseInt(e.target.value) || 1;
                                        setSyncParams({ ...syncParams, projected_batches: p });
                                        fetchSyncPreview(syncParams.month, syncParams.year, p);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-center"
                                />
                            </div>
                        </div>

                        {/* Vista Previa de Datos Extraídos */}
                        {syncPreviewLoading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Consultando planillas de nómina y gastos contables del sistema...
                            </div>
                        ) : syncData ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Planillas RRHH */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Users size={16} className="text-indigo-600" />
                                                <span className="font-bold text-xs uppercase tracking-wide text-slate-800">Planillas de Nómina RRHH</span>
                                            </div>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                {syncData.payroll?.employee_count || 0} empleados
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between text-slate-600">
                                                <span>Total Sueldos Base:</span>
                                                <Money value={syncData.payroll?.total_base_salary || 0} className="font-semibold" />
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                                <span>Bonificaciones / Percepciones:</span>
                                                <Money value={syncData.payroll?.total_bonuses || 0} className="font-semibold" />
                                            </div>
                                            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                                                <span>Total Nómina Mensual:</span>
                                                <Money value={syncData.payroll?.total_payroll || 0} className="text-indigo-700 font-black" />
                                            </div>
                                            <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-[11px]">
                                                <span>Mano de Obra por Lote:</span>
                                                <Money value={syncData.payroll?.cost_per_batch || 0} className="font-black" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gastos Operativos Contables */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Receipt size={16} className="text-teal-600" />
                                                <span className="font-bold text-xs uppercase tracking-wide text-slate-800">Gastos Operativos Reales</span>
                                            </div>
                                            <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                                                {syncData.expenses?.category_breakdown?.length || 0} categorías
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                                            {syncData.expenses?.category_breakdown?.length > 0 ? (
                                                syncData.expenses.category_breakdown.map((cat, i) => (
                                                    <div key={i} className="flex justify-between text-slate-600 text-[11px]">
                                                        <span className="truncate max-w-[180px]">{cat.categoria}:</span>
                                                        <Money value={cat.total} className="font-medium" />
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[11px] text-slate-400 italic py-2">No se detectaron gastos registrados en este mes.</p>
                                            )}
                                        </div>
                                        <div className="border-t border-slate-100 pt-1.5">
                                            <div className="flex justify-between font-bold text-slate-900 text-xs mb-1">
                                                <span>Total Gastos Mensuales:</span>
                                                <Money value={syncData.expenses?.total_expenses || 0} className="text-teal-700 font-black" />
                                            </div>
                                            <div className="flex justify-between font-bold text-teal-700 bg-teal-50/70 p-2 rounded-lg border border-teal-100 text-[11px]">
                                                <span>Gastos CIF por Lote:</span>
                                                <Money value={syncData.expenses?.cost_per_batch || 0} className="font-black" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Resumen Global de Sincronización */}
                                <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-indigo-300 block">Resumen de Costeo Indirecto (GIF)</span>
                                        <div className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                                            <span>Total Mensual: <Money value={syncData.summary?.total_monthly_costs || 0} className="text-emerald-400" /></span>
                                            <span className="text-xs text-slate-400 font-normal">/ {syncData.summary?.projected_batches || 20} lotes</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-emerald-300 block">Costo Fijo / Operativo por Lote</span>
                                        <div className="text-xl font-black text-emerald-400">
                                            <Money value={syncData.summary?.cost_per_batch || 0} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsSyncModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSync}
                                disabled={isSyncing || syncPreviewLoading}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSyncing ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Sincronizando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        Aplicar y Sincronizar con Costeo de Planta
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE PARAMETRIZACIÓN DE PREFIJO DE LOTE POR PROVEEDOR */}
            {isLotConfigModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto text-slate-900 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                                    <Tag size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                        {editingLotConfig ? 'Editar Parametrización de Lote' : 'Asignar Prefijo de Lote a Proveedor'}
                                    </h3>
                                    <p className="text-xs text-slate-500">Reglas de codificación de lotes para recepción de materia prima</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsLotConfigModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLotConfig} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">Proveedor Avícola *</label>
                                <SearchableSelect
                                    options={providers}
                                    value={lotConfigForm.provider_id}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, provider_id: e.target.value })}
                                    valueKey="id"
                                    labelKey="nombre"
                                    placeholder="Seleccionar proveedor de huevo..."
                                    codeKey="nrc"
                                    codeLabel="NRC"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                                    Prefijo de Lote Habitual *
                                </label>
                                <input
                                    type="text"
                                    value={lotConfigForm.lot_prefix}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, lot_prefix: e.target.value.toUpperCase() })}
                                    placeholder="Ej: HD-25918, GC-CANDY, LOTE-AV"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                    Prefijo asignado por la granja o registrado habitualmente en las remesas de huevo.
                                </span>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">Formato de Sufijo Correlativo</label>
                                <select
                                    value={lotConfigForm.suffix_format}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, suffix_format: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="correlativo">Correlativo Numérico (-01, -02, -03...)</option>
                                    <option value="fecha-juliana">Fecha Juliana del Día (J-DDD)</option>
                                    <option value="secuencial">Secuencial Puro (1, 2, 3...)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">Notas o Ubicación de Granja</label>
                                <textarea
                                    value={lotConfigForm.notes}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, notes: e.target.value })}
                                    placeholder="Ej: Galpón principal, granja Sonsonate..."
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-20"
                                />
                            </div>

                            {/* Preview */}
                            {lotConfigForm.lot_prefix && (
                                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                                    <span className="font-semibold text-[11px]">Sugerencia de lote en recepción:</span>
                                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
                                        {lotConfigForm.lot_prefix}-01
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsLotConfigModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    Guardar Regla
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EggConfig;
