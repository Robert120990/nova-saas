import { unwrapList } from '../../../utils/apiUtils';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
    DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT,
    DEFAULT_INDUSTRIAL_PRESENTATION,
    DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
    getIndustrialPresentationWeightLbs,
    normalizeIndustrialPresentation,
    poundsToKilograms,
    getRecipeFormulaName
} from '../../../constants/eggIndustrialCatalogs';


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
export default function useConfigModel() {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    // Tabs
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(
        tabFromUrl && ['costs', 'lot-prefixes', 'products', 'code-mappings'].includes(tabFromUrl)
            ? tabFromUrl
            : 'costs'
    );

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['costs', 'lot-prefixes', 'products', 'code-mappings'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setSearchParams({ tab: newTab });
    };

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

    const loadProvidersOptions = async (search, page) => {
        const { data } = await axios.get('/api/providers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        return data;
    };

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

    const _eggProductsList = useMemo(() => {
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
                axios.get('/api/providers', { params: { limit: 2000 } }),
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

    const _handleSelectProductQuick = (index, product) => {
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
            setCodeMappings(unwrapList(mapRes));
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al guardar la vinculación.');
        }
    };

    const handleDeleteMapping = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/code-mappings/${id}`);
            toast.success('Vinculación eliminada.');
            const mapRes = await axios.get('/api/egg-industrial/code-mappings');
            setCodeMappings(unwrapList(mapRes));
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
            setCodeMappings(unwrapList(mapRes));
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
        setEditingLotConfig(configItem);
        setIsLotConfigModalOpen(true);
    };

    const handleLotConfigSaved = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/provider-lot-configs');
            setProviderLotConfigs(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error refreshing lot configs:', error);
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


 return { MONTH_NAMES, inferCategoryAndPresentation, parseMappingCodes, parseMappingItems, createMappingForm, user, companyId, searchParams, setSearchParams, tabFromUrl, activeTab, setActiveTab, handleTabChange, config, setConfig, costConcepts, setCostConcepts, providerLotConfigs, setProviderLotConfigs, providers, setProviders, loading, setLoading, newConcept, setNewConcept, helpConceptModal, setHelpConceptModal, isSyncModalOpen, setIsSyncModalOpen, syncParams, setSyncParams, syncData, setSyncData, isSyncing, setIsSyncing, syncPreviewLoading, setSyncPreviewLoading, isLotConfigModalOpen, setIsLotConfigModalOpen, editingLotConfig, setEditingLotConfig, loadProvidersOptions, codeMappings, setCodeMappings, systemProducts, setSystemProducts, isMappingModalOpen, setIsMappingModalOpen, mappingSearchTerm, setMappingSearchTerm, mappingForm, setMappingForm, isProductCatalogModalOpen, setIsProductCatalogModalOpen, catalogSearchQuery, setCatalogSearchQuery, catalogFilterType, setCatalogFilterType, targetCodeIndex, setTargetCodeIndex, isFetchingProducts, setIsFetchingProducts, defaults, baseFormulationProducts, _eggProductsList, formulationProducts, getWeight, getPct, fetchAllData, fetchSystemProducts, handleOpenProductCatalog, isProductMapped, getProductMappingInfo, isProductInCurrentForm, handleSelectProductCode, handleOpenCreateMapping, handleOpenEditMapping, handleAddCodeToMapping, handleAddMappingCode, handleUpdateMappingCode, handleRemoveMappingCode, _handleSelectProductQuick, handleSaveMapping, handleDeleteMapping, handleSeedExampleMappings, handleUpdateProduct, handleSaveProduct, handleSaveAllProducts, handleAddConcept, handleUpdateConcept, handleDeleteConcept, handleOpenSyncModal, fetchSyncPreview, handleConfirmSync, handleOpenLotConfigModal, handleLotConfigSaved, handleDeleteLotConfig };
}
