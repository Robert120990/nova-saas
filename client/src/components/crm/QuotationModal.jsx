import { useState, useEffect } from 'react';
import {
    X,
    Plus,
    Trash2,
    Save,
    AlertTriangle,
    PenTool,
    ShieldAlert,
    Clock,
    FileText,
    Building2,
    Calendar,
    Phone,
    CheckCircle2,
    FileDown,
    Search,
    Check,
    Scale
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import SignaturePadModal from './SignaturePadModal';
import QuickCustomerModal from './QuickCustomerModal';

// Lista de productos predefinidos y frecuentes para carga rápida
const PRESET_PRODUCTS = [
    // 🥚 HUEVO EN CÁSCARA (BLANCO) POR TALLA
    { 
        group: '🥚 Huevo Blanco en Cáscara (por Talla)',
        name: 'HUEVO BLANCO EN CÁSCARA - EXTRA GRANDE', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 36.00, 
        defaultPrice: 42.00 
    },
    { 
        group: '🥚 Huevo Blanco en Cáscara (por Talla)',
        name: 'HUEVO BLANCO EN CÁSCARA - GRANDE', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 33.00, 
        defaultPrice: 38.00 
    },
    { 
        group: '🥚 Huevo Blanco en Cáscara (por Talla)',
        name: 'HUEVO BLANCO EN CÁSCARA - MEDIANO', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 29.00, 
        defaultPrice: 34.00 
    },
    { 
        group: '🥚 Huevo Blanco en Cáscara (por Talla)',
        name: 'HUEVO BLANCO EN CÁSCARA - PEQUEÑO', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 25.00, 
        defaultPrice: 30.00 
    },
    // 🥚 HUEVO EN CÁSCARA (MARRÓN / COLOR) POR TALLA
    { 
        group: '🥚 Huevo Marrón en Cáscara (por Talla)',
        name: 'HUEVO MARRÓN EN CÁSCARA - EXTRA GRANDE', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 37.00, 
        defaultPrice: 43.00 
    },
    { 
        group: '🥚 Huevo Marrón en Cáscara (por Talla)',
        name: 'HUEVO MARRÓN EN CÁSCARA - GRANDE', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 34.00, 
        defaultPrice: 39.00 
    },
    { 
        group: '🥚 Huevo Marrón en Cáscara (por Talla)',
        name: 'HUEVO MARRÓN EN CÁSCARA - MEDIANO', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 30.00, 
        defaultPrice: 35.00 
    },
    { 
        group: '🥚 Huevo Marrón en Cáscara (por Talla)',
        name: 'HUEVO MARRÓN EN CÁSCARA - PEQUEÑO', 
        unit_measure: 'CAJA',
        presentation: 'CAJA (360 unidades / 12 cartones)',
        defaultCost: 26.00, 
        defaultPrice: 31.00 
    },
    // 📦 CARTONES DE HUEVO (30 UNIDADES)
    { 
        group: '📦 Cartones de Huevo (30 Unidades)',
        name: 'HUEVO BLANCO CARTÓN (30 UDS) - GRANDE', 
        unit_measure: 'CARTON',
        presentation: 'CARTON (30 unidades)',
        defaultCost: 2.80, 
        defaultPrice: 3.30 
    },
    { 
        group: '📦 Cartones de Huevo (30 Unidades)',
        name: 'HUEVO MARRÓN CARTÓN (30 UDS) - GRANDE', 
        unit_measure: 'CARTON',
        presentation: 'CARTON (30 unidades)',
        defaultCost: 2.90, 
        defaultPrice: 3.40 
    },
    // 🥛 OVOPRODUCTOS PASTEURIZADOS (LÍQUIDOS - COTIZADOS POR LB O KG)
    { 
        group: '🥛 Ovoproductos Pasteurizados (por LB)',
        name: 'HUEVO ENTERO PASTEURIZADO', 
        unit_measure: 'LB',
        presentation: 'CUBETA (30 libras)',
        defaultCost: 1.05, 
        defaultPrice: 1.30 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por KG)',
        name: 'HUEVO ENTERO PASTEURIZADO (KG)', 
        unit_measure: 'KG',
        presentation: 'A GRANEL (Kilogramos)',
        defaultCost: 2.31, 
        defaultPrice: 2.86 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por LB)',
        name: 'HUEVO ENTERO PLUS', 
        unit_measure: 'LB',
        presentation: 'CUBETA (30 libras)',
        defaultCost: 1.08, 
        defaultPrice: 1.35 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por LB)',
        name: 'CLARA DE HUEVO PASTEURIZADA', 
        unit_measure: 'LB',
        presentation: 'CUBETA (32 libras)',
        defaultCost: 1.25, 
        defaultPrice: 1.60 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por KG)',
        name: 'CLARA DE HUEVO PASTEURIZADA (KG)', 
        unit_measure: 'KG',
        presentation: 'A GRANEL (Kilogramos)',
        defaultCost: 2.75, 
        defaultPrice: 3.52 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por LB)',
        name: 'CLARA FORMULA PANADERIA', 
        unit_measure: 'LB',
        presentation: 'CUBETA (32 libras)',
        defaultCost: 1.30, 
        defaultPrice: 1.67 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por LB)',
        name: 'YEMA AZUCARADA', 
        unit_measure: 'LB',
        presentation: 'CUBETA (30 libras)',
        defaultCost: 1.40, 
        defaultPrice: 1.85 
    },
    { 
        group: '🥛 Ovoproductos Pasteurizados (por LB)',
        name: 'YEMA SALADA', 
        unit_measure: 'LB',
        presentation: 'CUBETA (30 libras)',
        defaultCost: 1.35, 
        defaultPrice: 1.80 
    }
];

// Opciones de presentación física y empaque
const PRESENTATION_OPTIONS = [
    // Cáscara
    { label: 'CAJA (360 unidades / 12 cartones)', isReturnable: false },
    { label: 'CARTON (30 unidades)', isReturnable: false },
    { label: 'MEDIO CARTON (15 unidades)', isReturnable: false },
    { label: 'EMPAQUE / BLISTER (12 unidades)', isReturnable: false },
    { label: 'EMPAQUE / BLISTER (6 unidades)', isReturnable: false },
    { label: 'UNIDAD INDIVIDUAL', isReturnable: false },
    // Ovoproductos Líquidos
    { label: 'CUBETA (30 libras)', isReturnable: true },
    { label: 'CUBETA (32 libras)', isReturnable: true },
    { label: 'GALON (8 libras)', isReturnable: false },
    { label: 'MEDIO GALON (4 libras)', isReturnable: false },
    { label: 'LITRO (2 libras)', isReturnable: false },
    { label: 'A GRANEL (Libras)', isReturnable: false },
    { label: 'A GRANEL (Kilogramos)', isReturnable: false },
    { label: 'PERSONALIZADA / OTRA', isReturnable: false }
];

// Unidades de medida disponibles para la cotización
const UNIT_MEASURE_OPTIONS = [
    { value: 'CAJA', label: 'CAJA (360 uds)' },
    { value: 'CARTON', label: 'CARTÓN (30 uds)' },
    { value: 'UNIDAD', label: 'UNIDAD' },
    { value: 'DOCENA', label: 'DOCENA (12 uds)' },
    { value: 'LB', label: 'LB (Libras)' },
    { value: 'KG', label: 'KG (Kilogramos)' },
    { value: 'CUBETA', label: 'CUBETA' },
    { value: 'GALON', label: 'GALÓN' },
    { value: 'LITRO', label: 'LITRO' }
];

// Plantillas oficiales de compromisos y garantías comerciales
const COMMITMENT_TEMPLATES = {
    shell: 
        '1. ESPECIFICACIÓN Y CALIDAD: Huevo fresco en cáscara clasificado comercialmente por talla y color. Selección de primera calidad e inocuidad garantizada.\n' +
        '2. EMPAQUE Y MANEJO: Despachado en cajas estándar de 360 unidades (12 cartones de 30 unidades) o cartones protectores. Los empaques son descartables y no aplican para retorno.\n' +
        '3. VIGENCIA: Oferta válida por {validity_days} días a partir de su emisión según disponibilidad de postura.\n' +
        '4. CONDICIONES: Precios más IVA. Pago: {payment_terms}. Entrega: {delivery_time}.',
    liquid: 
        '1. POLÍTICA DE ENVASES: Las cubetas plásticas (30 LBS / 32 LBS) son propiedad de ANDELSA y son RETORNABLES (deben devolverse limpias y completas en cada entrega). Los demás envases (galones, medios galones, litros, bolsas) son descartables de un solo uso y no aplican para retorno.\n' +
        '2. CALIDAD CERTIFICADA: Se entrega Certificado de Calidad e Inocuidad con cada despacho bajo estándar HACCP.\n' +
        '3. VIGENCIA: Oferta válida por {validity_days} días a partir de su emisión.\n' +
        '4. CONDICIONES: Precios más IVA. Pago: {payment_terms}. Entrega: {delivery_time}.',
    mixed:
        '1. POLÍTICA DE ENVASES Y EMPAQUE: Las cubetas plásticas de ovoproductos son RETORNABLES y deben devolverse en cada despacho. El huevo en cáscara se entrega en cajas o cartones comerciales garantizados.\n' +
        '2. CALIDAD E INOCUIDAD: Productos procesados y clasificados bajo altos estándares de inocuidad y certificación HACCP con trazabilidad de lote.\n' +
        '3. VIGENCIA: Oferta válida por {validity_days} días a partir de su emisión.\n' +
        '4. CONDICIONES: Precios más IVA. Pago: {payment_terms}. Entrega: {delivery_time}.'
};

// Resolver precio unitario real desde catálogo
function resolveCatalogProductPrice(prod) {
    const direct = parseFloat(prod.precio_unitario);
    if (!isNaN(direct) && direct > 0) return direct;
    if (prod.branchPrices && typeof prod.branchPrices === 'object') {
        const prices = Object.values(prod.branchPrices)
            .map(v => parseFloat(v))
            .filter(v => !isNaN(v) && v > 0);
        if (prices.length > 0) return prices[0];
    }
    return 0;
}

// Resolver unidad de medida por defecto desde catálogo
function resolveCatalogUnitMeasure(prod) {
    const um = String(prod.unidad_medida || '').trim();
    const nameLower = (prod.nombre || '').toLowerCase();
    
    if (nameLower.includes('caja')) return 'CAJA';
    if (nameLower.includes('carton') || nameLower.includes('cartón')) return 'CARTON';
    if (nameLower.includes('cubeta')) return 'CUBETA';
    if (nameLower.includes('galon') || nameLower.includes('galón')) return 'GALON';
    if (nameLower.includes('litro') || nameLower.includes('ltr')) return 'LITRO';
    if (nameLower.includes(' kg') || nameLower.includes('kilo')) return 'KG';
    if (nameLower.includes(' lb') || nameLower.includes('libra')) return 'LB';

    if (um === '34') return 'LB';
    if (um === '22') return 'KG';
    if (um === '59') return 'UNIDAD';
    if (um === '40') return 'GALON';
    if (um === '41') return 'LITRO';
    return 'CAJA';
}

// Resolver presentación adecuada sugerida
function resolveCatalogPresentation(prod, unitMeasure) {
    const nameLower = (prod.nombre || '').toLowerCase();
    if (nameLower.includes('caja')) return 'CAJA (360 unidades / 12 cartones)';
    if (nameLower.includes('carton') || nameLower.includes('cartón')) return 'CARTON (30 unidades)';
    if (nameLower.includes('32') && nameLower.includes('cubeta')) return 'CUBETA (32 libras)';
    if (nameLower.includes('30') && nameLower.includes('cubeta')) return 'CUBETA (30 libras)';
    if (nameLower.includes('cubeta')) return 'CUBETA (30 libras)';
    if (nameLower.includes('8') && (nameLower.includes('galon') || nameLower.includes('galón'))) return 'GALON (8 libras)';
    if (nameLower.includes('4') && (nameLower.includes('galon') || nameLower.includes('galón'))) return 'MEDIO GALON (4 libras)';
    if (nameLower.includes('litro') || nameLower.includes('2 lb')) return 'LITRO (2 libras)';
    if (unitMeasure === 'CAJA') return 'CAJA (360 unidades / 12 cartones)';
    if (unitMeasure === 'CARTON') return 'CARTON (30 unidades)';
    if (unitMeasure === 'KG') return 'A GRANEL (Kilogramos)';
    if (unitMeasure === 'LB') return 'A GRANEL (Libras)';
    if (unitMeasure === 'UNIDAD') return 'UNIDAD INDIVIDUAL';
    return 'CAJA (360 unidades / 12 cartones)';
}

export default function QuotationModal({ isOpen, onClose, onSaved, quotationId = null }) {
    const [_loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Modales secundarios
    const [sigModalOpen, setSigModalOpen] = useState(false);
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

    // Listado de clientes para selector
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');

    // Listado de productos del catálogo del sistema
    const [catalogProducts, setCatalogProducts] = useState([]);

    // Índice de fila que tiene el menú de autocompletado de catálogo abierto
    const [activeCatalogDropdownIdx, setActiveCatalogDropdownIdx] = useState(null);

    // Firma del usuario logueado
    const [savedUserSig, setSavedUserSig] = useState(null);

    // Estado principal del formulario
    const [formData, setFormData] = useState({
        customer_id: '',
        customer_name: '',
        customer_contact: '',
        customer_email: '',
        customer_phone: '',
        customer_address: '',
        customer_nrc: '',
        customer_nit: '',
        date: new Date().toISOString().split('T')[0],
        validity_days: 30,
        expiration_date: '',
        payment_terms: 'Contado',
        delivery_time: 'Entrega inmediata / según programación',
        our_commitments: '',
        notes: '',
        delicate_reason: '',
        signature_data: null,
        signature_author_name: '',
        signature_author_title: 'Ejecutivo Comercial',
        signature_author_phone: '(503) 7060-5040',
        items: []
    });

    // Pestaña activa en el modal
    const [activeTab, setActiveTab] = useState('items'); // 'items', 'commitments', 'signature'

    // Cargar datos iniciales
    useEffect(() => {
        if (!isOpen) return;

        // Cargar clientes
        axios.get('/api/customers?limit=100').then(res => {
            setCustomers(res.data?.data || res.data || []);
        }).catch(err => console.error('Error cargando clientes:', err));

        // Cargar catálogo de productos amplio (hasta 500 registros)
        axios.get('/api/products?limit=500').then(res => {
            setCatalogProducts(res.data?.data || res.data || []);
        }).catch(err => console.error('Error cargando catálogo:', err));

        // Cargar firma de usuario
        axios.get('/api/crm/user-signature').then(res => {
            const u = res.data;
            if (u) {
                setSavedUserSig(u);
                if (!quotationId) {
                    setFormData(prev => ({
                        ...prev,
                        signature_data: u.signature_data || prev.signature_data,
                        signature_author_name: u.nombre || prev.signature_author_name,
                        signature_author_title: u.signature_title || prev.signature_author_title,
                        signature_author_phone: u.phone || prev.signature_author_phone
                    }));
                }
            }
        }).catch(err => console.warn('No hay firma guardada:', err.message));

        // Si es edición, cargar datos
        if (quotationId) {
            setLoading(true);
            axios.get(`/api/crm/quotations/${quotationId}`).then(res => {
                const q = res.data;
                setFormData({
                    ...q,
                    date: q.date ? q.date.split('T')[0] : '',
                    expiration_date: q.expiration_date ? q.expiration_date.split('T')[0] : '',
                    items: q.items || []
                });
                setCustomerSearch(q.customer_name || '');
            }).catch(err => {
                console.error('Error al cargar cotización:', err);
                toast.error('No se pudo cargar la cotización.');
            }).finally(() => setLoading(false));
        } else {
            // Nueva cotización con 1 ítem inicial predeterminado de Huevo en Cáscara
            const initialItem = {
                product_id: null,
                product_code: '',
                product_name: PRESET_PRODUCTS[1].name,
                presentation: PRESET_PRODUCTS[1].presentation,
                quantity: 1,
                unit_measure: PRESET_PRODUCTS[1].unit_measure,
                current_cost: PRESET_PRODUCTS[1].defaultCost,
                unit_price: PRESET_PRODUCTS[1].defaultPrice,
                suggested_price: PRESET_PRODUCTS[1].defaultPrice * 1.1,
                discount_amount: 0,
                notes: 'Selección y calidad garantizada'
            };

            const today = new Date();
            const exp = new Date(today);
            exp.setDate(exp.getDate() + 30);

            setFormData({
                customer_id: '',
                customer_name: '',
                customer_contact: '',
                customer_email: '',
                customer_phone: '',
                customer_address: '',
                customer_nrc: '',
                customer_nit: '',
                date: today.toISOString().split('T')[0],
                validity_days: 30,
                expiration_date: exp.toISOString().split('T')[0],
                payment_terms: 'Contado',
                delivery_time: 'Entrega inmediata / según programación',
                our_commitments: COMMITMENT_TEMPLATES.shell
                    .replace('{validity_days}', '30')
                    .replace('{payment_terms}', 'Contado')
                    .replace('{delivery_time}', 'Según programación semanal'),
                notes: '',
                delicate_reason: '',
                signature_data: null,
                signature_author_name: '',
                signature_author_title: 'Ejecutivo Comercial',
                signature_author_phone: '(503) 7060-5040',
                items: [initialItem]
            });
            setCustomerSearch('');
        }
    }, [isOpen, quotationId]);

    // Recalcular fecha de caducidad al cambiar fecha o días de validez
    useEffect(() => {
        if (!formData.date) return;
        const d = new Date(formData.date);
        const days = parseInt(formData.validity_days, 10) || 30;
        d.setDate(d.getDate() + days);
        setFormData(prev => ({ ...prev, expiration_date: d.toISOString().split('T')[0] }));
    }, [formData.date, formData.validity_days]);

    if (!isOpen) return null;

    // Aplicar plantilla de compromisos
    const applyCommitmentTemplate = (templateKey) => {
        const tpl = COMMITMENT_TEMPLATES[templateKey];
        if (!tpl) return;
        const days = formData.validity_days || 30;
        const terms = formData.payment_terms || 'Contado';
        const delivery = formData.delivery_time || 'Según programación semanal';
        const text = tpl
            .replace('{validity_days}', String(days))
            .replace('{payment_terms}', terms)
            .replace('{delivery_time}', delivery);
        setFormData(prev => ({ ...prev, our_commitments: text }));
        toast.success('Plantilla de compromisos aplicada.');
    };

    // Manejador para agregar ítem
    const addItem = () => {
        const preset = PRESET_PRODUCTS[1]; // Huevo Blanco Grande por defecto
        const newItem = {
            product_id: null,
            product_code: '',
            product_name: preset.name,
            presentation: preset.presentation,
            quantity: 1,
            unit_measure: preset.unit_measure,
            current_cost: preset.defaultCost,
            unit_price: preset.defaultPrice,
            suggested_price: preset.defaultPrice * 1.1,
            discount_amount: 0,
            notes: ''
        };
        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    // Manejador para actualizar un ítem
    const updateItem = (index, field, value) => {
        const updated = [...formData.items];
        updated[index] = { ...updated[index], [field]: value };

        // Si el usuario edita el nombre de producto, abrir autocompletado si hay texto
        if (field === 'product_name') {
            if (value && value.trim().length > 0) {
                setActiveCatalogDropdownIdx(index);
            } else {
                setActiveCatalogDropdownIdx(null);
            }
        }

        setFormData(prev => ({ ...prev, items: updated }));
    };

    // Seleccionar producto desde sugerencias predefinidas
    const handleSelectPreset = (index, presetName) => {
        const found = PRESET_PRODUCTS.find(p => p.name === presetName);
        if (!found) return;

        const updated = [...formData.items];
        updated[index] = {
            ...updated[index],
            product_id: null,
            product_code: '',
            product_name: found.name,
            unit_measure: found.unit_measure,
            presentation: found.presentation,
            current_cost: found.defaultCost,
            unit_price: found.defaultPrice
        };
        setFormData(prev => ({ ...prev, items: updated }));
        setActiveCatalogDropdownIdx(null);
        toast.info(`Cargado: ${found.name}`);
    };

    // Seleccionar producto real desde el catálogo de la empresa
    const handleSelectCatalogProduct = (index, prod) => {
        const price = resolveCatalogProductPrice(prod);
        const cost = parseFloat(prod.costo) || 0;
        const unit = resolveCatalogUnitMeasure(prod);
        const presentation = resolveCatalogPresentation(prod, unit);

        const updated = [...formData.items];
        updated[index] = {
            ...updated[index],
            product_id: prod.id,
            product_code: prod.codigo || '',
            product_name: prod.nombre,
            unit_measure: unit,
            presentation: presentation,
            current_cost: cost,
            unit_price: price > 0 ? price : (cost > 0 ? Number((cost * 1.25).toFixed(2)) : 0)
        };
        setFormData(prev => ({ ...prev, items: updated }));
        setActiveCatalogDropdownIdx(null);
        toast.success(`Producto vinculado: ${prod.nombre} (${prod.codigo || 'Sin código'})`);
    };

    // Desvincular producto del catálogo (volver a modo manual/libre)
    const handleUnlinkCatalogProduct = (index) => {
        const updated = [...formData.items];
        updated[index] = {
            ...updated[index],
            product_id: null,
            product_code: ''
        };
        setFormData(prev => ({ ...prev, items: updated }));
        toast.info('Producto desvinculado del catálogo (modo manual)');
    };

    // Eliminar ítem
    const removeItem = (index) => {
        if (formData.items.length <= 1) {
            toast.warning('La cotización debe tener al menos un producto.');
            return;
        }
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    // Cálculos financieros y análisis de margen en vivo
    let subtotal = 0;
    let totalCost = 0;
    let hasDelicateItem = false;

    formData.items.forEach(it => {
        const qty = parseFloat(it.quantity) || 1;
        const price = parseFloat(it.unit_price) || 0;
        const cost = parseFloat(it.current_cost) || 0;
        const discount = parseFloat(it.discount_amount) || 0;

        const lineSubtotal = (qty * price) - discount;
        const lineCost = qty * cost;

        subtotal += lineSubtotal;
        totalCost += lineCost;

        const marginPct = price > 0 ? ((price - cost) / price) * 100 : 0;
        if (price <= cost || marginPct < 15) {
            hasDelicateItem = true;
        }
    });

    const taxAmount = subtotal * 0.13;
    const total = subtotal + taxAmount;
    const overallMarginPct = subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0;
    const isDelicate = hasDelicateItem || overallMarginPct < 15;

    // Asignar cliente seleccionado
    const handleSelectCustomer = (cust) => {
        setFormData(prev => ({
            ...prev,
            customer_id: cust.id,
            customer_name: cust.nombre,
            customer_contact: cust.nombre_comercial || '',
            customer_email: cust.correo || '',
            customer_phone: cust.telefono || '',
            customer_address: cust.direccion || '',
            customer_nrc: cust.nrc || '',
            customer_nit: cust.nit || ''
        }));
        setCustomerSearch(cust.nombre);
    };

    // Guardar cotización
    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.customer_name.trim()) {
            toast.warning('Debe ingresar o seleccionar un cliente.');
            return;
        }

        if (formData.items.length === 0) {
            toast.warning('Agregue al menos un producto a la cotización.');
            return;
        }

        if (isDelicate && !formData.delicate_reason?.trim()) {
            toast.error('Esta cotización es DELICADA (bajo costo o margen < 15%). Por favor especifique la justificación comercial.');
            setActiveTab('items');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...formData,
                subtotal,
                tax_amount: taxAmount,
                total,
                total_cost: totalCost,
                overall_margin_pct: overallMarginPct,
                is_delicate: isDelicate ? 1 : 0
            };

            if (quotationId) {
                await axios.put(`/api/crm/quotations/${quotationId}`, payload);
                toast.success('Cotización actualizada exitosamente.');
            } else {
                const res = await axios.post('/api/crm/quotations', payload);
                toast.success(`Cotización ${res.data.quote_number} generada exitosamente.`);
            }

            onSaved();
            onClose();
        } catch (err) {
            console.error('Error al guardar cotización:', err);
            toast.error(err.response?.data?.message || 'Error al guardar la cotización.');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadDocx = async () => {
        if (!quotationId) return;
        const toastId = toast.loading('Generando documento Word...');
        try {
            const res = await axios.get(`/api/crm/quotations/${quotationId}/docx`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Cotizacion_${formData.quote_number || quotationId}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Documento Word descargado.', { id: toastId });
        } catch (e) {
            toast.error('Error al descargar Word.', { id: toastId });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4 md:p-6 overflow-hidden sm:overflow-y-auto">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] my-0 sm:my-auto overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                
                {/* Barra superior compacta exclusiva de móvil (~44px) */}
                <div className="sm:hidden px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0"
                            aria-label="Cerrar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-xs font-bold text-slate-800 truncate">
                                {quotationId ? `Editar ${formData.quote_number || ''}` : 'Nueva Cotización'}
                            </h2>
                            <div className="text-[10px] text-indigo-700 font-extrabold flex items-center gap-1">
                                <span>Total: ${total.toFixed(2)}</span>
                                <span className={`text-[9px] px-1 rounded ${
                                    overallMarginPct <= 0
                                        ? 'bg-red-100 text-red-700'
                                        : overallMarginPct < 15
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {overallMarginPct.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all ${
                                isDelicate
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                            } disabled:opacity-50`}
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>{saving ? '...' : 'Guardar'}</span>
                        </button>
                    </div>
                </div>

                {/* Cabecera del Modal (Desktop) */}
                <div className="hidden sm:flex px-6 py-4 bg-slate-50 border-b border-slate-200 items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-800">
                                    {quotationId ? `Editar Cotización ${formData.quote_number || ''}` : 'Nueva Cotización Comercial'}
                                </h2>
                                {isDelicate ? (
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        COTIZACIÓN DELICADA
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        MARGEN SEGURO
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                                Formato Oficial Eggcelent / ANDELSA • Validación de costos y compromisos retornables
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Barra de Pestañas (Compacta, con scroll horizontal fluido sin partir renglones) */}
                <div className="px-3 sm:px-6 border-b border-slate-200 bg-white flex gap-2 sm:gap-6 text-xs sm:text-sm font-semibold shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
                    <button
                        type="button"
                        onClick={() => setActiveTab('items')}
                        className={`py-2.5 sm:py-3 border-b-2 transition-all shrink-0 ${
                            activeTab === 'items'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        1. Cliente y Productos ({formData.items.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('commitments')}
                        className={`py-2.5 sm:py-3 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'commitments'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        2. Compromisos y Envases
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('signature')}
                        className={`py-2.5 sm:py-3 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                            activeTab === 'signature'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        3. Firma Electrónica
                        {formData.signature_data && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        )}
                    </button>
                </div>

                {/* Contenido scrolleable con altura completa disponible */}
                <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">

                    {/* Enunciado informativo en móvil (se desplaza con el scroll para no asfixiar el espacio de trabajo) */}
                    <div className="sm:hidden p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800">
                                {quotationId ? `Cotización ${formData.quote_number || ''}` : 'Nueva Propuesta Comercial'}
                            </span>
                            {isDelicate ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                    <ShieldAlert className="w-3 h-3" />
                                    DELICADA
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    MARGEN SEGURO
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Formato Oficial Eggcelent / ANDELSA • Validación de costos y compromisos retornables
                        </p>
                    </div>

                    {/* ALERTA VISUAL SI LA COTIZACIÓN ES DELICADA */}
                    {isDelicate && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 text-red-700 rounded-lg">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-red-900 uppercase tracking-wide">
                                        Alerta de Riesgo Comercial: Cotización Delicada
                                    </h4>
                                    <p className="text-xs text-red-700">
                                        Uno o más productos tienen precio inferior al costo o margen menor al 15% (Margen global: {overallMarginPct.toFixed(1)}%).
                                    </p>
                                </div>
                            </div>
                            <div className="w-full md:w-auto">
                                <input
                                    type="text"
                                    required
                                    placeholder="Justificación comercial requerida *"
                                    value={formData.delicate_reason}
                                    onChange={(e) => setFormData({ ...formData, delicate_reason: e.target.value })}
                                    className="w-full md:w-80 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300 bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 1: CLIENTE Y PRODUCTOS */}
                    {activeTab === 'items' && (
                        <div className="space-y-6">
                            {/* Bloque Superior: Cliente y Vigencia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                
                                {/* Selector / Búsqueda de Cliente */}
                                <div className="col-span-1 sm:col-span-2 md:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <Building2 className="w-3.5 h-3.5" />
                                            Cliente <span className="text-red-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setNewCustomerModalOpen(true)}
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            + Nuevo Cliente
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            placeholder="Buscar o escribir nombre del cliente..."
                                            value={customerSearch}
                                            onChange={(e) => {
                                                setCustomerSearch(e.target.value);
                                                setFormData(prev => ({ ...prev, customer_name: e.target.value }));
                                            }}
                                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                                        />

                                        {/* Dropdown de clientes sugeridos */}
                                        {customerSearch && customers.length > 0 && !customers.some(c => c.nombre.toLowerCase() === customerSearch.toLowerCase()) && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-20">
                                                {customers
                                                    .filter(c => c.nombre.toLowerCase().includes(customerSearch.toLowerCase()))
                                                    .slice(0, 6)
                                                    .map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => handleSelectCustomer(c)}
                                                            className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                        >
                                                            <div className="font-bold text-slate-800">{c.nombre}</div>
                                                            <div className="text-slate-500 text-[11px] flex items-center gap-2">
                                                                {c.telefono && <span>Tel: {c.telefono}</span>}
                                                                {c.nrc && <span>NRC: {c.nrc}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Atención / Contacto */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Atención a / Contacto
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Juan Pérez"
                                        value={formData.customer_contact}
                                        onChange={(e) => setFormData({ ...formData, customer_contact: e.target.value })}
                                        className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                                    />
                                </div>

                                {/* Teléfono */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Teléfono de Contacto
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 7060-5040"
                                        value={formData.customer_phone}
                                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                                        className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                                    />
                                </div>

                                {/* Fecha de Emisión */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Fecha de Emisión
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                                    />
                                </div>

                                {/* Días de Validez */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Validez de la Oferta
                                    </label>
                                    <select
                                        value={formData.validity_days}
                                        onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                                        className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                                    >
                                        <option value="15">15 Días</option>
                                        <option value="30">30 Días (Estándar)</option>
                                        <option value="45">45 Días</option>
                                        <option value="60">60 Días</option>
                                    </select>
                                </div>

                                {/* Fecha de Caducidad (Calculada) */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Fecha de Caducidad
                                    </label>
                                    <input
                                        type="date"
                                        readOnly
                                        value={formData.expiration_date}
                                        className="w-full text-[13px] font-bold text-slate-700 px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 cursor-not-allowed outline-none"
                                    />
                                </div>

                                {/* Términos de Pago */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Condición de Pago
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Contado contra entrega"
                                        value={formData.payment_terms}
                                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                        className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white"
                                    />
                                </div>
                            </div>

                            {/* Tabla Detallada de Ítems */}
                            {/* Tabla Detallada de Ítems */}
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <Scale className="w-4 h-4 text-indigo-600" />
                                            Productos, Presentaciones y Precios Cotizados
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Busca en el catálogo del sistema, elige predefinidos por talla o ingresa productos a la medida
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors self-start sm:self-auto shadow-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Producto
                                    </button>
                                </div>

                                <div className="border border-slate-200 rounded-xl shadow-sm bg-white">
                                    <div className="overflow-x-auto overflow-y-visible">
                                        <table className="w-full text-left border-collapse text-xs table-cards">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                                    <th className="py-2.5 px-3 min-w-[240px]">Producto / Búsqueda Catálogo</th>
                                                    <th className="py-2.5 px-3 min-w-[170px]">Presentación</th>
                                                    <th className="py-2.5 px-3 w-28 text-center">Unidad</th>
                                                    <th className="py-2.5 px-3 text-center w-20">Cant.</th>
                                                    <th className="py-2.5 px-3 text-right w-24">Costo ($)</th>
                                                    <th className="py-2.5 px-3 text-right w-28">Precio ($)</th>
                                                    <th className="py-2.5 px-3 text-center w-24">Margen (%)</th>
                                                    <th className="py-2.5 px-3 text-right w-24">Subtotal ($)</th>
                                                    <th className="py-2.5 px-3 min-w-[130px]">Detalle / Notas</th>
                                                    <th className="py-2.5 px-3 text-center w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {formData.items.map((item, idx) => {
                                                    const price = parseFloat(item.unit_price) || 0;
                                                    const cost = parseFloat(item.current_cost) || 0;
                                                    const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
                                                    const isLineDelicate = price <= cost || margin < 15;
                                                    const qty = parseFloat(item.quantity) || 1;
                                                    const sub = (qty * price) - (parseFloat(item.discount_amount) || 0);

                                                    // Filtro de catálogo en tiempo real para esta fila
                                                    const query = (item.product_name || '').trim().toLowerCase();
                                                    const matchingCatalog = query.length >= 1
                                                        ? catalogProducts.filter(p => 
                                                            (p.nombre && p.nombre.toLowerCase().includes(query)) ||
                                                            (p.codigo && p.codigo.toLowerCase().includes(query))
                                                        ).slice(0, 8)
                                                        : [];

                                                    // Agrupar predefinidos para el selector rápido
                                                    const presetGroups = PRESET_PRODUCTS.reduce((acc, p) => {
                                                        const g = p.group || 'Otros';
                                                        if (!acc[g]) acc[g] = [];
                                                        acc[g].push(p);
                                                        return acc;
                                                    }, {});

                                                    return (
                                                        <tr
                                                            key={idx}
                                                            className={`transition-colors ${
                                                                isLineDelicate ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/70'
                                                            }`}
                                                        >
                                                            {/* Nombre de Producto y Selector Catálogo */}
                                                            <td className="py-2.5 px-3 relative" data-label="Producto">
                                                                <div className="w-full space-y-1.5">
                                                                    <div className="relative">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input
                                                                                type="text"
                                                                                required
                                                                                placeholder="Buscar en catálogo o escribir nombre..."
                                                                                value={item.product_name}
                                                                                onFocus={() => {
                                                                                    if (query.length >= 1) setActiveCatalogDropdownIdx(idx);
                                                                                }}
                                                                                onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                                                                                className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none"
                                                                            />
                                                                        </div>

                                                                        {/* Menú flotante de resultados del catálogo */}
                                                                        {activeCatalogDropdownIdx === idx && matchingCatalog.length > 0 && (
                                                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                                                                                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                                                                                    <span className="flex items-center gap-1">
                                                                                        <Search className="w-3 h-3 text-indigo-500" />
                                                                                        Resultados en Catálogo ({matchingCatalog.length})
                                                                                    </span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => setActiveCatalogDropdownIdx(null)}
                                                                                        className="text-slate-400 hover:text-slate-600"
                                                                                    >
                                                                                        Cerrar
                                                                                    </button>
                                                                                </div>
                                                                                {matchingCatalog.map((prod) => {
                                                                                    const catPrice = resolveCatalogProductPrice(prod);
                                                                                    const catCost = parseFloat(prod.costo) || 0;
                                                                                    const catUnit = resolveCatalogUnitMeasure(prod);

                                                                                    return (
                                                                                        <div
                                                                                            key={prod.id}
                                                                                            onClick={() => handleSelectCatalogProduct(idx, prod)}
                                                                                            className="p-2 hover:bg-indigo-50/80 cursor-pointer transition-colors"
                                                                                        >
                                                                                            <div className="flex items-center justify-between gap-2">
                                                                                                <span className="text-xs font-bold text-slate-800 line-clamp-1">
                                                                                                    {prod.nombre}
                                                                                                </span>
                                                                                                {prod.codigo && (
                                                                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                                                                                        {prod.codigo}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                                                                                <span>Costo: <strong className="text-slate-700">${catCost.toFixed(2)}</strong></span>
                                                                                                <span>Precio: <strong className="text-indigo-600">${catPrice.toFixed(2)}</strong></span>
                                                                                                <span className="px-1 rounded bg-indigo-50 text-indigo-700 font-semibold">{catUnit}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Badges y selector de predefinidos debajo del input */}
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {item.product_code || item.product_id ? (
                                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                                Catálogo: {item.product_code || `ID-${item.product_id}`}
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleUnlinkCatalogProduct(idx)}
                                                                                    title="Desvincular (modo libre)"
                                                                                    className="text-slate-400 hover:text-red-500 ml-0.5 font-bold"
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-medium text-slate-400">
                                                                                Modo libre / personalizado
                                                                            </span>
                                                                        )}

                                                                        <div className="relative inline-block">
                                                                            <select
                                                                                onChange={(e) => {
                                                                                    if (e.target.value) handleSelectPreset(idx, e.target.value);
                                                                                }}
                                                                                className="text-[10px] font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 rounded-md px-2 py-0.5 outline-none border border-indigo-200 cursor-pointer transition-colors"
                                                                                defaultValue=""
                                                                            >
                                                                                <option value="" disabled>⚡ Sugerencias Rápidas...</option>
                                                                                {Object.entries(presetGroups).map(([grp, itemsList]) => (
                                                                                    <optgroup key={grp} label={grp}>
                                                                                        {itemsList.map(p => (
                                                                                            <option key={p.name} value={p.name}>{p.name}</option>
                                                                                        ))}
                                                                                    </optgroup>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Presentación */}
                                                            <td className="py-2.5 px-3" data-label="Presentación">
                                                                <div className="w-full">
                                                                    <select
                                                                        value={item.presentation}
                                                                        onChange={(e) => updateItem(idx, 'presentation', e.target.value)}
                                                                        className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                                                                    >
                                                                        {PRESENTATION_OPTIONS.map(p => (
                                                                            <option key={p.label} value={p.label}>
                                                                                {p.label} {p.isReturnable ? '♻️ Retornable' : ''}
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    {/* Si es personalizada, permitir escribir el texto */}
                                                                    {item.presentation === 'PERSONALIZADA / OTRA' && (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Especificar presentación..."
                                                                            value={item.custom_presentation || ''}
                                                                            onChange={(e) => updateItem(idx, 'custom_presentation', e.target.value)}
                                                                            className="w-full text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1 mt-1 outline-none focus:border-indigo-500"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Unidad de Medida (LB / KG / CAJA / CARTÓN / ETC) */}
                                                            <td className="py-2.5 px-3 text-center" data-label="Unidad">
                                                                <select
                                                                    value={item.unit_measure || 'CAJA'}
                                                                    onChange={(e) => updateItem(idx, 'unit_measure', e.target.value)}
                                                                    className="w-full text-xs font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded-lg px-2 py-1.5 text-center outline-none focus:border-indigo-500"
                                                                >
                                                                    {UNIT_MEASURE_OPTIONS.map(u => (
                                                                        <option key={u.value} value={u.value}>
                                                                            {u.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Cantidad */}
                                                            <td className="py-2.5 px-3" data-label="Cantidad">
                                                                <input
                                                                    type="number"
                                                                    min="0.01"
                                                                    step="any"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                                    className="w-full text-center text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 outline-none focus:border-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Costo Actual ($) */}
                                                            <td className="py-2.5 px-3" data-label="Costo ($)">
                                                                <div className="w-full text-right">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                        value={item.current_cost}
                                                                        onChange={(e) => updateItem(idx, 'current_cost', e.target.value)}
                                                                        className="w-full text-right text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                                                                    />
                                                                    <span className="block text-[9px] text-right text-slate-400 font-semibold mt-0.5">
                                                                        ${item.current_cost || 0} / {item.unit_measure || 'u'}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Precio Unitario ($) */}
                                                            <td className="py-2.5 px-3" data-label="Precio ($)">
                                                                <div className="w-full text-right">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                        value={item.unit_price}
                                                                        onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                                                                        className={`w-full text-right text-xs font-bold rounded-lg px-2 py-1.5 outline-none border ${
                                                                            isLineDelicate
                                                                                ? 'border-red-400 bg-red-50 text-red-700'
                                                                                : 'border-slate-200 bg-white text-slate-800 focus:border-indigo-500'
                                                                        }`}
                                                                    />
                                                                    <span className="block text-[9px] text-right font-semibold mt-0.5 text-slate-500">
                                                                        ${item.unit_price || 0} / {item.unit_measure || 'u'}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* Margen Calculado (%) con badge */}
                                                            <td className="py-2.5 px-3 text-center" data-label="Margen (%)">
                                                                <div className="flex flex-col items-center">
                                                                    <span className={`text-xs font-black ${
                                                                        margin <= 0
                                                                            ? 'text-red-600'
                                                                            : margin < 15
                                                                            ? 'text-amber-600'
                                                                            : 'text-emerald-600'
                                                                    }`}>
                                                                        {margin.toFixed(1)}%
                                                                    </span>
                                                                    {price <= cost ? (
                                                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                                                            Bajo Costo
                                                                        </span>
                                                                    ) : margin < 15 ? (
                                                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                                                            Riesgoso
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] font-bold text-slate-400">
                                                                            Rentable
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Subtotal Línea ($) */}
                                                            <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-800" data-label="Subtotal ($)">
                                                                ${sub.toFixed(2)}
                                                            </td>

                                                            {/* Notas o Descuento */}
                                                            <td className="py-2.5 px-3" data-label="Notas">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ej: Calidad seleccionada"
                                                                    value={item.notes}
                                                                    onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                                                                    className="w-full text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Botón eliminar */}
                                                            <td className="py-2.5 px-3 text-center" data-label="Acción">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(idx)}
                                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-1 mx-auto"
                                                                    title="Eliminar producto"
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-red-500 sm:text-slate-400" />
                                                                    <span className="sm:hidden text-xs text-red-600 font-bold">Quitar</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 2: COMPROMISOS Y ENVASES */}
                    {activeTab === 'commitments' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <h4 className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        Nuestros Compromisos y Condiciones (Impresos en PDF y Word)
                                    </h4>
                                    <span className="text-[11px] font-semibold text-amber-800">
                                        Cargar plantilla sugerida:
                                    </span>
                                </div>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    Elige la plantilla que corresponda al tipo de producto cotizado o redacta libremente las cláusulas legales, vigencia y políticas de despacho.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => applyCommitmentTemplate('shell')}
                                        className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all shadow-sm flex items-center gap-1"
                                    >
                                        🥚 Huevo en Cáscara (Tallas / Cajas)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyCommitmentTemplate('liquid')}
                                        className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all shadow-sm flex items-center gap-1"
                                    >
                                        🥛 Ovoproductos (Cubetas Retornables / HACCP)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyCommitmentTemplate('mixed')}
                                        className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all shadow-sm flex items-center gap-1"
                                    >
                                        📋 Plantilla Mixta
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                    Cláusulas de Compromiso y Garantía Comercial
                                </label>
                                <textarea
                                    rows="8"
                                    value={formData.our_commitments}
                                    onChange={(e) => setFormData({ ...formData, our_commitments: e.target.value })}
                                    className="w-full text-xs font-mono p-3.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none leading-relaxed"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Notas Adicionales Internas (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Notas visibles solo para el equipo comercial..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 3: FIRMA ELECTRÓNICA */}
                    {activeTab === 'signature' && (
                        <div className="space-y-5">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <h4 className="text-xs font-bold text-slate-800 uppercase mb-1 flex items-center gap-1.5">
                                    <PenTool className="w-4 h-4 text-indigo-600" />
                                    Firma Electrónica Autorizada
                                </h4>
                                <p className="text-xs text-slate-500">
                                    La firma seleccionada se plasmará al pie del PDF de la cotización junto al nombre y teléfono del asesor.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Visualizador de Firma */}
                                <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-white shadow-sm space-y-3 min-h-[160px]">
                                    {formData.signature_data ? (
                                        <div className="flex flex-col items-center space-y-2">
                                            <img
                                                src={formData.signature_data}
                                                alt="Firma Electrónica"
                                                className="max-h-24 max-w-full object-contain"
                                            />
                                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Firma Electrónica Activa
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <PenTool className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                                            <p className="text-xs text-slate-400">Sin firma registrada para esta cotización</p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setSigModalOpen(true)}
                                            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <PenTool className="w-3.5 h-3.5" />
                                            {formData.signature_data ? 'Cambiar Firma' : 'Dibujar o Subir Firma'}
                                        </button>

                                        {savedUserSig?.signature_data && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        signature_data: savedUserSig.signature_data,
                                                        signature_author_name: savedUserSig.nombre || prev.signature_author_name,
                                                        signature_author_title: savedUserSig.signature_title || prev.signature_author_title,
                                                        signature_author_phone: savedUserSig.phone || prev.signature_author_phone
                                                    }));
                                                    toast.success('Firma precargada de tu cuenta.');
                                                }}
                                                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                            >
                                                Usar mi firma guardada
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Datos del Asesor Firmante */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                            Nombre del Asesor / Firmante
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Raul Rafael Sosa M."
                                            value={formData.signature_author_name}
                                            onChange={(e) => setFormData({ ...formData, signature_author_name: e.target.value })}
                                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                            Cargo Comercial
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Ejecutivo Comercial / Gerente de Ventas"
                                            value={formData.signature_author_title}
                                            onChange={(e) => setFormData({ ...formData, signature_author_title: e.target.value })}
                                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                            <Phone className="w-3.5 h-3.5" />
                                            Teléfono de Contacto
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: (503) 7060-5040"
                                            value={formData.signature_author_phone}
                                            onChange={(e) => setFormData({ ...formData, signature_author_phone: e.target.value })}
                                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Resumen de Totales y Botones en Móvil (dentro del scroll, al pie del formulario para no bloquear la pantalla) */}
                    <div className="sm:hidden mt-6 pt-4 border-t border-slate-200 space-y-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Subtotal:</span>
                                <span className="font-bold text-slate-800">${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">IVA (13%):</span>
                                <span className="font-bold text-slate-800">${taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                                <span className="text-slate-700 font-bold">Total Cotizado:</span>
                                <span className="text-base font-black text-indigo-700">${total.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                                <span className="text-slate-500 font-medium">Margen General:</span>
                                <span className={`text-xs font-black ${
                                    overallMarginPct <= 0
                                        ? 'text-red-600'
                                        : overallMarginPct < 15
                                        ? 'text-amber-600'
                                        : 'text-emerald-600'
                                }`}>
                                    {overallMarginPct.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        {/* Botones de acción en móvil */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className={`w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
                                    isDelicate
                                        ? 'bg-amber-600 hover:bg-amber-700'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                } disabled:opacity-50`}
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Guardando...' : quotationId ? 'Actualizar Cotización' : 'Guardar Cotización'}
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                {quotationId && (
                                    <button
                                        type="button"
                                        onClick={handleDownloadDocx}
                                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                                    >
                                        <FileDown className="w-3.5 h-3.5" />
                                        <span>Word (.docx)</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`flex items-center justify-center py-2.5 px-3 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors ${!quotationId ? 'col-span-2' : ''}`}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pie del Modal con Resumen de Totales y Guardar (Solo Desktop, fijo abajo) */}
                <div className="hidden sm:flex px-6 py-4 bg-slate-50 border-t border-slate-200 flex-row items-center justify-between gap-4 shrink-0">
                    {/* Resumen Financiero */}
                    <div className="flex flex-wrap items-center gap-6 text-xs">
                        <div>
                            <span className="text-slate-500 block">Subtotal:</span>
                            <span className="text-sm font-bold text-slate-800">${subtotal.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">IVA (13%):</span>
                            <span className="text-sm font-bold text-slate-800">${taxAmount.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Total Cotizado:</span>
                            <span className="text-base font-black text-indigo-700">${total.toFixed(2)}</span>
                        </div>
                        <div className="border-l border-slate-200 pl-4">
                            <span className="text-slate-500 block">Margen General:</span>
                            <span className={`text-sm font-black ${
                                overallMarginPct <= 0
                                    ? 'text-red-600'
                                    : overallMarginPct < 15
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                            }`}>
                                {overallMarginPct.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Botones */}
                    <div className="flex items-center gap-2.5 justify-end">
                        {quotationId && (
                            <button
                                type="button"
                                onClick={handleDownloadDocx}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                                title="Descargar versión editable en Word"
                            >
                                <FileDown className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Word (.docx)</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all ${
                                isDelicate
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                            } disabled:opacity-50`}
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : quotationId ? 'Actualizar Cotización' : 'Guardar Cotización'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Firma Electrónica */}
            <SignaturePadModal
                isOpen={sigModalOpen}
                onClose={() => setSigModalOpen(false)}
                initialSignature={formData.signature_data}
                onSave={({ signatureData, saveAsDefault, title, phone }) => {
                    setFormData(prev => ({
                        ...prev,
                        signature_data: signatureData,
                        signature_author_title: title || prev.signature_author_title,
                        signature_author_phone: phone || prev.signature_author_phone
                    }));
                    if (saveAsDefault) {
                        axios.post('/api/crm/user-signature', {
                            signature_data: signatureData,
                            signature_title: title,
                            phone
                        }).then(() => toast.success('Firma guardada como predeterminada en tu perfil.'))
                          .catch(err => console.warn('Error guardando firma en perfil:', err));
                    }
                }}
            />

            {/* Modal de Nuevo Cliente Rápido */}
            <QuickCustomerModal
                isOpen={newCustomerModalOpen}
                onClose={() => setNewCustomerModalOpen(false)}
                onCustomerCreated={(newCust) => {
                    setCustomers(prev => [newCust, ...prev]);
                    handleSelectCustomer(newCust);
                }}
            />
        </div>
    );
}
