import { useState, useEffect } from 'react';
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
    poundsToKilograms
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
    AlertCircle
} from 'lucide-react';

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const inferCategoryAndPresentation = (productName = '', code = '') => {
    const text = `${productName} ${code}`.toLowerCase();

    let product_type = DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY;
    if (text.includes('clara')) {
        product_type = 'clara';
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

const createMappingForm = () => {
    const presentation = DEFAULT_INDUSTRIAL_PRESENTATION;
    const weightLbs = getIndustrialPresentationWeightLbs(presentation, 1);

    return {
        id: null,
        product_id: '',
        product_name: '',
        product_type: DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
        presentation,
        codes: [''],
        weight_lbs: weightLbs.toFixed(2),
        weight_kg: poundsToKilograms(weightLbs).toFixed(2),
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
        'clara': { weight: '8.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'yema salada': { weight: '4.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'yema azucarada': { weight: '4.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'fórmula especial': { weight: '32.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' }
    };

    const products = [
        { type: 'huevo entero', label: 'Huevo Entero Pasteurizado' },
        { type: 'clara', label: 'Clara Pasteurizada' },
        { type: 'yema salada', label: 'Yema Líquida Salada' },
        { type: 'yema azucarada', label: 'Yema Líquida Azucarada' },
        { type: 'fórmula especial', label: 'Fórmula Especial / Mezcla Premium' }
    ];

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
            setCostConcepts(Array.isArray(costRes.data) ? costRes.data : []);
            setProviderLotConfigs(Array.isArray(lotRes.data) ? lotRes.data : []);
            setProviders(Array.isArray(provRes.data) ? provRes.data : (provRes.data?.data || []));
            setCodeMappings(Array.isArray(mapRes.data) ? mapRes.data : []);
            const prods = Array.isArray(sysProdRes.data) ? sysProdRes.data : (sysProdRes.data?.data || []);
            setSystemProducts(prods);

            const merged = products.map(p => {
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

    const mappedCodesSet = new Set(
        codeMappings.flatMap((m) => parseMappingCodes(m.codes || m.catalog_codes).map((c) => c.toLowerCase()))
    );
    const mappedProductIdsSet = new Set(
        codeMappings.map((m) => Number(m.product_id || m.catalog_product_id)).filter(Boolean)
    );

    const isProductMapped = (prod) => {
        const sku = (prod.codigo || '').trim().toLowerCase();
        const barcode = (prod.codigo_barra || '').trim().toLowerCase();
        return mappedProductIdsSet.has(Number(prod.id)) ||
            (sku && mappedCodesSet.has(sku)) ||
            (barcode && mappedCodesSet.has(barcode));
    };

    const getProductMappingInfo = (prod) => {
        const sku = (prod.codigo || '').trim().toLowerCase();
        const barcode = (prod.codigo_barra || '').trim().toLowerCase();
        return codeMappings.find((m) => {
            if (Number(m.product_id || m.catalog_product_id) === Number(prod.id)) return true;
            const codes = parseMappingCodes(m.codes || m.catalog_codes).map((c) => c.toLowerCase());
            return (sku && codes.includes(sku)) || (barcode && codes.includes(barcode));
        });
    };

    const handleSelectProductCode = (product, codeType = 'sku', autoFillMeta = true) => {
        const skuCode = (product.codigo || '').trim();
        const barcode = (product.codigo_barra || '').trim();

        let codesToInsert = [];
        if (codeType === 'sku' && skuCode) {
            codesToInsert.push(skuCode);
        } else if (codeType === 'barcode' && barcode) {
            codesToInsert.push(barcode);
        } else if (codeType === 'both') {
            if (skuCode) codesToInsert.push(skuCode);
            if (barcode && barcode !== skuCode) codesToInsert.push(barcode);
        } else {
            if (skuCode) codesToInsert.push(skuCode);
            else if (barcode) codesToInsert.push(barcode);
        }

        if (codesToInsert.length === 0) {
            return toast.error('Este producto no tiene código SKU ni código de barra registrado.');
        }

        const inferred = inferCategoryAndPresentation(product.nombre || product.name || '', codesToInsert[0]);
        const presentationWeight = getIndustrialPresentationWeightLbs(inferred.presentation, 0);

        // Si el modal de vinculación no estaba abierto, abrirlo pre-rellenado
        if (!isMappingModalOpen) {
            const weightLbs = presentationWeight > 0 ? presentationWeight : (parseFloat(mappingForm.weight_lbs) || 8);
            setMappingForm({
                ...createMappingForm(),
                product_id: String(product.id),
                product_name: product.nombre || product.name || '',
                product_type: inferred.product_type,
                presentation: inferred.presentation,
                codes: codesToInsert,
                weight_lbs: weightLbs.toFixed(2),
                weight_kg: poundsToKilograms(weightLbs).toFixed(2),
                unit_of_measure: product.unidad_medida?.toLowerCase() === 'kg' ? 'kg' : 'lb'
            });
            setIsMappingModalOpen(true);
            setIsProductCatalogModalOpen(false);
            toast.success(`Producto '${product.nombre}' preparado para vinculación.`);
            return;
        }

        // Si el modal de vinculación ya está abierto:
        if (targetCodeIndex !== null && targetCodeIndex !== undefined && targetCodeIndex >= 0) {
            const primaryCode = codesToInsert[0];
            setMappingForm((current) => {
                const updatedCodes = [...current.codes];
                updatedCodes[targetCodeIndex] = primaryCode;
                if (codesToInsert[1] && !updatedCodes.includes(codesToInsert[1])) {
                    updatedCodes.push(codesToInsert[1]);
                }
                return {
                    ...current,
                    codes: updatedCodes,
                    product_id: autoFillMeta && !current.product_id ? String(product.id) : current.product_id,
                    product_name: autoFillMeta && !current.product_name?.trim() ? (product.nombre || product.name || '') : current.product_name
                };
            });
        } else {
            setMappingForm((current) => {
                const existing = current.codes.filter(Boolean);
                const merged = [...existing];
                codesToInsert.forEach((c) => {
                    if (!merged.includes(c)) merged.push(c);
                });
                return {
                    ...current,
                    codes: merged.length > 0 ? merged : [''],
                    product_id: autoFillMeta && !current.product_id ? String(product.id) : current.product_id,
                    product_name: autoFillMeta && !current.product_name?.trim() ? (product.nombre || product.name || '') : current.product_name
                };
            });
        }

        setIsProductCatalogModalOpen(false);
        setTargetCodeIndex(null);
        toast.success(`Código(s) [${codesToInsert.join(', ')}] insertado(s).`);
    };

    const handleOpenCreateMapping = () => {
        setMappingForm(createMappingForm());
        setIsMappingModalOpen(true);
    };

    const handleOpenEditMapping = (m) => {
        const presentation = normalizeIndustrialPresentation(m.presentation);
        const presentationWeight = getIndustrialPresentationWeightLbs(presentation, 0);
        const weightLbs = Number(m.weight_lbs ?? m.unit_weight_lbs ?? presentationWeight);
        const weightKg = Number(m.weight_kg ?? m.unit_weight_kg ?? poundsToKilograms(weightLbs));

        setMappingForm({
            id: m.id,
            product_id: m.product_id || '',
            product_name: m.product_name || m.catalog_product_name || '',
            product_type: m.product_type || m.industrial_product_type || DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY,
            presentation,
            codes: parseMappingCodes(m.codes || m.catalog_codes),
            weight_lbs: Number.isFinite(weightLbs) && weightLbs > 0 ? weightLbs.toFixed(2) : '',
            weight_kg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg.toFixed(2) : '',
            unit_of_measure: m.unit_of_measure || DEFAULT_INDUSTRIAL_MEASUREMENT_UNIT,
            notes: m.notes || ''
        });
        setIsMappingModalOpen(true);
    };

    const handleAddCodeToMapping = (mapping) => {
        handleOpenEditMapping({
            ...mapping,
            codes: [...parseMappingCodes(mapping.codes || mapping.catalog_codes), '']
        });
    };

    const handleAddMappingCode = () => {
        setMappingForm((current) => ({ ...current, codes: [...current.codes, ''] }));
    };

    const handleUpdateMappingCode = (index, value) => {
        setMappingForm((current) => ({
            ...current,
            codes: current.codes.map((code, codeIndex) => codeIndex === index ? value : code)
        }));
    };

    const handleRemoveMappingCode = (index) => {
        setMappingForm((current) => {
            const codes = current.codes.filter((_, codeIndex) => codeIndex !== index);
            return { ...current, codes: codes.length > 0 ? codes : [''] };
        });
    };

    const handleSaveMapping = async (e) => {
        e?.preventDefault();
        const codes = mappingForm.codes.map((code) => code.trim()).filter(Boolean);
        if ((!mappingForm.product_name?.trim() && !mappingForm.product_id) || codes.length === 0) {
            return toast.error('Debe indicar el nombre del producto y los códigos vinculados.');
        }
        try {
            const payload = {
                product_id: mappingForm.product_id ? parseInt(mappingForm.product_id) : null,
                product_name: mappingForm.product_name.trim(),
                product_type: mappingForm.product_type,
                presentation: mappingForm.presentation,
                codes,
                weight_lbs: parseFloat(mappingForm.weight_lbs) || 0,
                weight_kg: parseFloat(mappingForm.weight_kg) || 0,
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
            for (const p of products) {
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
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'costs'
                                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                    >
                        <DollarSign size={14} />
                        Costos y Planillas
                    </button>
                    <button
                        onClick={() => setActiveTab('lot-prefixes')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'lot-prefixes'
                                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                    >
                        <Tag size={14} />
                        Prefijos de Lote por Proveedor
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'products'
                                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                    >
                        <Layers size={14} />
                        Rendimientos de Producto
                    </button>
                    <button
                        onClick={() => setActiveTab('code-mappings')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'code-mappings'
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
                            {products.map(p => (
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
                                onClick={handleSeedExampleMappings}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-2 shadow-xs"
                                title="Cargar códigos oficiales de ejemplo citados en el documento (HEGL8, hel2, hec32, CL2b)"
                            >
                                <Sparkles size={14} className="text-amber-400" />
                                Cargar Ejemplos Doc
                            </button>
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
                                            const codesArr = parseMappingCodes(m.codes || m.catalog_codes);
                                            return (
                                                <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3 font-bold text-slate-900">
                                                        <div>{m.product_name || m.catalog_product_name || 'Sin descripción'}</div>
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
                                                        <div className="flex flex-wrap gap-1">
                                                            {codesArr.map((c, ci) => (
                                                                <span key={ci} className="font-mono text-[11px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="font-bold text-slate-900">{parseFloat(m.weight_lbs ?? m.unit_weight_lbs ?? 0).toFixed(2)} lb</div>
                                                        <div className="text-[10px] text-slate-400 font-medium">~{parseFloat(m.weight_kg ?? m.unit_weight_kg ?? 0).toFixed(2)} kg</div>
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-bold uppercase">
                                                        {m.unit_of_measure || 'lb'}
                                                    </td>
                                                    <td className="p-3 text-slate-600 font-medium">
                                                        {m.catalog_product_name ? (
                                                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                                                                <CheckCircle2 size={12} />
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
                            if (p.codigo) entries.push(<option key={`sku-${p.id}`} value={p.codigo}>{p.nombre} (SKU: {p.codigo})</option>);
                            if (p.codigo_barra && p.codigo_barra !== p.codigo) {
                                entries.push(<option key={`bar-${p.id}`} value={p.codigo_barra}>{p.nombre} (Barra: {p.codigo_barra})</option>);
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
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                    Nombre Descriptivo del Producto *
                                </label>
                                <input
                                    type="text"
                                    required={!mappingForm.product_id}
                                    value={mappingForm.product_name}
                                    onChange={(e) => setMappingForm({ ...mappingForm, product_name: e.target.value })}
                                    placeholder="Ej: Huevo Entero Pasteurizado Galón"
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Categoría industrial *
                                    </label>
                                    <select
                                        value={mappingForm.product_type}
                                        onChange={(e) => setMappingForm({ ...mappingForm, product_type: e.target.value })}
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
                                            setMappingForm({
                                                ...mappingForm,
                                                presentation,
                                                weight_lbs: lbs > 0 ? lbs.toFixed(2) : mappingForm.weight_lbs,
                                                weight_kg: lbs > 0 ? poundsToKilograms(lbs).toFixed(2) : mappingForm.weight_kg
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
                                            Códigos vinculados *
                                        </label>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                            {mappingForm.codes.filter(Boolean).length} vinculados
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
                                <div className="space-y-2">
                                    {mappingForm.codes.map((code, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className="relative flex-1 min-w-0">
                                                <input
                                                    type="text"
                                                    list="system-product-codes-list"
                                                    value={code}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        handleUpdateMappingCode(index, val);
                                                        // Si coincide exactamente con un producto del sistema, sugerir autocompletar nombre
                                                        const match = systemProducts.find(p =>
                                                            (p.codigo && p.codigo.toLowerCase() === val.toLowerCase()) ||
                                                            (p.codigo_barra && p.codigo_barra.toLowerCase() === val.toLowerCase())
                                                        );
                                                        if (match && !mappingForm.product_name?.trim()) {
                                                            const inferred = inferCategoryAndPresentation(match.nombre || match.name || '', val);
                                                            setMappingForm(prev => ({
                                                                ...prev,
                                                                product_name: match.nombre || match.name || prev.product_name,
                                                                product_id: prev.product_id || String(match.id),
                                                                product_type: prev.product_type === DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY ? inferred.product_type : prev.product_type,
                                                                presentation: prev.presentation === DEFAULT_INDUSTRIAL_PRESENTATION ? inferred.presentation : prev.presentation
                                                            }));
                                                        }
                                                    }}
                                                    placeholder={index === 0 ? 'Ej: HEGL8 o escribe para buscar...' : 'Otro código (SKU o Barra)'}
                                                    className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenProductCatalog(index)}
                                                    className="absolute right-2 top-2 text-slate-400 hover:text-indigo-600 transition-colors"
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
                                    ))}
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400 block">
                                        Escribe para ver sugerencias automáticas o pulsa <strong>Buscar en sistema</strong>.
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Peso Unitario (Lbs)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={mappingForm.weight_lbs}
                                        onChange={(e) => {
                                            const lbs = parseFloat(e.target.value) || 0;
                                            setMappingForm({
                                                ...mappingForm,
                                                weight_lbs: e.target.value,
                                                weight_kg: poundsToKilograms(lbs).toFixed(2)
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">
                                        Peso Unitario (Kg)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={mappingForm.weight_kg}
                                        onChange={(e) => {
                                            const kg = parseFloat(e.target.value) || 0;
                                            setMappingForm({
                                                ...mappingForm,
                                                weight_kg: e.target.value,
                                                weight_lbs: kilogramsToPounds(kg).toFixed(2)
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                                        Vincular a Producto del Catálogo General (Opcional)
                                    </label>
                                    {mappingForm.product_id && (
                                        <button
                                            type="button"
                                            onClick={() => setMappingForm({ ...mappingForm, product_id: '' })}
                                            className="text-[10px] text-rose-600 font-bold hover:underline"
                                        >
                                            Limpiar vínculo
                                        </button>
                                    )}
                                </div>
                                <SearchableSelect
                                    options={systemProducts}
                                    value={mappingForm.product_id}
                                    onChange={(e, opt) => {
                                        if (opt) {
                                            const sku = (opt.codigo || '').trim();
                                            const bar = (opt.codigo_barra || '').trim();
                                            const curCodes = mappingForm.codes.filter(Boolean);
                                            const merged = [...curCodes];
                                            if (sku && !merged.includes(sku)) merged.push(sku);
                                            if (bar && !merged.includes(bar)) merged.push(bar);

                                            const inferred = inferCategoryAndPresentation(opt.nombre || opt.name || '', sku || bar);

                                            setMappingForm(prev => ({
                                                ...prev,
                                                product_id: String(opt.id),
                                                product_name: prev.product_name?.trim() ? prev.product_name : (opt.nombre || opt.name || ''),
                                                product_type: prev.product_type === DEFAULT_INDUSTRIAL_PRODUCT_CATEGORY ? inferred.product_type : prev.product_type,
                                                presentation: prev.presentation === DEFAULT_INDUSTRIAL_PRESENTATION ? inferred.presentation : prev.presentation,
                                                codes: merged.length > 0 ? merged : [''],
                                                unit_of_measure: opt.unidad_medida?.toLowerCase() === 'kg' ? 'kg' : prev.unit_of_measure
                                            }));
                                        } else {
                                            setMappingForm(prev => ({ ...prev, product_id: '' }));
                                        }
                                    }}
                                    valueKey="id"
                                    labelKey="nombre"
                                    codeKey="codigo"
                                    searchKeys={['codigo', 'codigo_barra', 'nombre', 'category_name']}
                                    placeholder="(Automático por SKU/Código o buscar en catálogo...)"
                                    isClearable={true}
                                />
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
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                                        catalogFilterType === 'all'
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    Todos ({systemProducts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('egg')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                                        catalogFilterType === 'egg'
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
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                                        catalogFilterType === 'unmapped'
                                            ? 'bg-amber-600 text-white shadow-2xs'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                    }`}
                                >
                                    ⚠️ Sin Vincular ({systemProducts.filter(p => !isProductMapped(p)).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('mapped')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                                        catalogFilterType === 'mapped'
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                    }`}
                                >
                                    ✅ Ya Vinculados ({systemProducts.filter(p => isProductMapped(p)).length})
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
                                    } else if (catalogFilterType === 'unmapped' && isProductMapped(p)) {
                                        return false;
                                    } else if (catalogFilterType === 'mapped' && !isProductMapped(p)) {
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
                                    const mappingInfo = getProductMappingInfo(prod);
                                    const hasSku = Boolean(prod.codigo?.trim());
                                    const hasBarcode = Boolean(prod.codigo_barra?.trim() && prod.codigo_barra !== prod.codigo);

                                    return (
                                        <div
                                            key={prod.id}
                                            className="p-3 sm:p-3.5 hover:bg-slate-50/90 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
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
                                                            onClick={() => handleSelectProductCode(prod, 'sku', true)}
                                                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                                                            title="Click para usar este código SKU"
                                                        >
                                                            <Barcode size={12} />
                                                            <span>SKU: {prod.codigo}</span>
                                                        </button>
                                                    )}

                                                    {hasBarcode && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectProductCode(prod, 'barcode', true)}
                                                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-colors"
                                                            title="Click para usar este código de barra"
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
                                                    {mappingInfo ? (
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                            <CheckCircle2 size={11} />
                                                            Vinculado: {mappingInfo.product_type} ({mappingInfo.presentation})
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                                            Sin vincular a ovoproducto
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Botones de acción rápida */}
                                            <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
                                                {hasSku && hasBarcode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectProductCode(prod, 'both', true)}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold border border-slate-300 transition-colors"
                                                        title="Insertar ambos códigos (SKU + Barra)"
                                                    >
                                                        + Ambos Códigos
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectProductCode(prod, 'both', true)}
                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                                                >
                                                    <Sparkles size={12} />
                                                    <span>{isMappingModalOpen ? 'Usar en Formulario' : 'Crear Vinculación'}</span>
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
