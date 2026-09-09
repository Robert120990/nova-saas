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
    Percent,
    Building2,
    Calendar,
    Phone,
    UserCheck,
    CheckCircle2,
    FileDown
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import SignaturePadModal from './SignaturePadModal';
import QuickCustomerModal from './QuickCustomerModal';

const PRESET_PRODUCTS = [
    { name: 'HUEVO ENTERO PASTEURIZADO', defaultCostPerLb: 1.05, defaultPricePerLb: 1.30 },
    { name: 'HUEVO ENTERO PLUS', defaultCostPerLb: 1.08, defaultPricePerLb: 1.35 },
    { name: 'CLARA DE HUEVO PASTEURIZADA', defaultCostPerLb: 1.25, defaultPricePerLb: 1.60 },
    { name: 'CLARA FORMULA PANADERIA', defaultCostPerLb: 1.30, defaultPricePerLb: 1.67 },
    { name: 'YEMA AZUCARADA', defaultCostPerLb: 1.40, defaultPricePerLb: 1.85 },
    { name: 'YEMA SALADA', defaultCostPerLb: 1.35, defaultPricePerLb: 1.80 }
];

const PRESENTATION_OPTIONS = [
    { label: 'CUBETA (30 libras)', weightLbs: 30, isReturnable: true },
    { label: 'CUBETA (32 libras)', weightLbs: 32, isReturnable: true },
    { label: 'GALON (8 libras)', weightLbs: 8, isReturnable: false },
    { label: 'MEDIO GALON (4 libras)', weightLbs: 4, isReturnable: false },
    { label: 'LITRO (2 libras)', weightLbs: 2, isReturnable: false },
    { label: 'A GRANEL (libras)', weightLbs: 1, isReturnable: false }
];

export default function QuotationModal({ isOpen, onClose, onSaved, quotationId = null }) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Modales secundarios
    const [sigModalOpen, setSigModalOpen] = useState(false);
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

    // Listado de clientes para selector
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');

    // Listado de productos del catálogo
    const [catalogProducts, setCatalogProducts] = useState([]);

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
        signature_author_phone: '(503) 7069-5335',
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

        // Cargar productos catálogo
        axios.get('/api/products?limit=100').then(res => {
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
            // Nueva cotización con 1 ítem inicial predeterminado
            const initialItem = {
                product_id: null,
                product_code: '',
                product_name: PRESET_PRODUCTS[0].name,
                presentation: PRESENTATION_OPTIONS[0].label,
                quantity: 1,
                unit_measure: 'LB',
                current_cost: PRESET_PRODUCTS[0].defaultCostPerLb,
                unit_price: PRESET_PRODUCTS[0].defaultPricePerLb,
                suggested_price: 1.50,
                discount_amount: 0,
                notes: 'Certificado de calidad incluido'
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
                our_commitments: '1. POLÍTICA DE ENVASES: Las cubetas plásticas (30 LBS / 32 LBS) son propiedad de ANDELSA y son RETORNABLES (deben devolverse limpias y completas en cada entrega). Los demás envases (galones, medios galones, litros, bolsas) son descartables de un solo uso y no aplican para retorno.\n2. CALIDAD CERTIFICADA: Se entrega Certificado de Calidad e Inocuidad con cada despacho bajo estándar HACCP.\n3. VIGENCIA: Oferta válida por 30 días a partir de su emisión.\n4. CONDICIONES: Precios más IVA. Pago: Contado. Entrega: Según programación semanal.',
                notes: '',
                delicate_reason: '',
                signature_data: null,
                signature_author_name: '',
                signature_author_title: 'Ejecutivo Comercial',
                signature_author_phone: '(503) 7069-5335',
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

    // Manejador para agregar ítem
    const addItem = () => {
        const newItem = {
            product_id: null,
            product_code: '',
            product_name: PRESET_PRODUCTS[1].name,
            presentation: PRESENTATION_OPTIONS[0].label,
            quantity: 1,
            unit_measure: 'LB',
            current_cost: PRESET_PRODUCTS[1].defaultCostPerLb,
            unit_price: PRESET_PRODUCTS[1].defaultPricePerLb,
            suggested_price: 1.60,
            discount_amount: 0,
            notes: ''
        };
        setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    };

    // Manejador para actualizar un ítem
    const updateItem = (index, field, value) => {
        const updated = [...formData.items];
        updated[index] = { ...updated[index], [field]: value };

        // Si se selecciona un producto predefinido
        if (field === 'preset_product') {
            const found = PRESET_PRODUCTS.find(p => p.name === value);
            if (found) {
                updated[index].product_name = found.name;
                updated[index].current_cost = found.defaultCostPerLb;
                updated[index].unit_price = found.defaultPricePerLb;
            }
        }

        // Si se selecciona un producto del catálogo
        if (field === 'catalog_product') {
            const prod = catalogProducts.find(p => String(p.id) === String(value));
            if (prod) {
                updated[index].product_id = prod.id;
                updated[index].product_code = prod.codigo || '';
                updated[index].product_name = prod.nombre;
                updated[index].current_cost = parseFloat(prod.costo) || 0;
                updated[index].unit_price = parseFloat(prod.precio_unitario) || 0;
            }
        }

        setFormData(prev => ({ ...prev, items: updated }));
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                
                {/* Cabecera del Modal */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
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

                {/* Barra de Pestañas */}
                <div className="px-6 border-b border-slate-200 bg-white flex gap-6 text-sm font-semibold">
                    <button
                        type="button"
                        onClick={() => setActiveTab('items')}
                        className={`py-3 border-b-2 transition-all ${
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
                        className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
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
                        className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
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

                {/* Contenido scrolleable */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

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
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                
                                {/* Selector / Búsqueda de Cliente */}
                                <div className="md:col-span-2">
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
                                        placeholder="Ej: Lic. Diego Reyes"
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
                                        placeholder="Ej: 7069-5335"
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
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                            Productos y Precios Cotizados
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Verifica el costo actual y el margen obtenido en cada línea
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Agregar Producto
                                    </button>
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                                    <th className="py-2.5 px-3">Producto</th>
                                                    <th className="py-2.5 px-3">Presentación</th>
                                                    <th className="py-2.5 px-3 text-center w-20">Cant.</th>
                                                    <th className="py-2.5 px-3 text-right w-24">Costo ($)</th>
                                                    <th className="py-2.5 px-3 text-right w-28">Precio ($)</th>
                                                    <th className="py-2.5 px-3 text-center w-28">Margen (%)</th>
                                                    <th className="py-2.5 px-3 text-right w-28">Subtotal ($)</th>
                                                    <th className="py-2.5 px-3 w-40">Detalle / Notas</th>
                                                    <th className="py-2.5 px-3 text-center w-12"></th>
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

                                                    return (
                                                        <tr
                                                            key={idx}
                                                            className={`transition-colors ${
                                                                isLineDelicate ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/70'
                                                            }`}
                                                        >
                                                            {/* Nombre de Producto */}
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    placeholder="Nombre de producto"
                                                                    value={item.product_name}
                                                                    onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                                                                    className="w-full text-xs font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none"
                                                                />
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <select
                                                                        onChange={(e) => updateItem(idx, 'preset_product', e.target.value)}
                                                                        className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 outline-none border border-slate-200"
                                                                        defaultValue=""
                                                                    >
                                                                        <option value="" disabled>Predefinidos ANDELSA...</option>
                                                                        {PRESET_PRODUCTS.map(p => (
                                                                            <option key={p.name} value={p.name}>{p.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </td>

                                                            {/* Presentación */}
                                                            <td className="py-2 px-3">
                                                                <select
                                                                    value={item.presentation}
                                                                    onChange={(e) => updateItem(idx, 'presentation', e.target.value)}
                                                                    className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                                                                >
                                                                    {PRESENTATION_OPTIONS.map(p => (
                                                                        <option key={p.label} value={p.label}>
                                                                            {p.label} {p.isReturnable ? '♻️ Retornable' : '🗑️ Desechable'}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>

                                                            {/* Cantidad */}
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    step="any"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                                    className="w-full text-center text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Costo Actual ($) */}
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="0.00"
                                                                    value={item.current_cost}
                                                                    onChange={(e) => updateItem(idx, 'current_cost', e.target.value)}
                                                                    className="w-full text-right text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Precio Unitario ($) */}
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="0.00"
                                                                    value={item.unit_price}
                                                                    onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                                                                    className={`w-full text-right text-xs font-bold rounded-lg px-2 py-1 outline-none border ${
                                                                        isLineDelicate
                                                                            ? 'border-red-400 bg-red-50 text-red-700'
                                                                            : 'border-slate-200 bg-white text-slate-800 focus:border-indigo-500'
                                                                    }`}
                                                                />
                                                            </td>

                                                            {/* Margen Calculado (%) con badge */}
                                                            <td className="py-2 px-3 text-center">
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
                                                            <td className="py-2 px-3 text-right text-xs font-bold text-slate-800">
                                                                ${sub.toFixed(2)}
                                                            </td>

                                                            {/* Notas o Descuento */}
                                                            <td className="py-2 px-3">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ej: Descuento $0.05 por publicidad"
                                                                    value={item.notes}
                                                                    onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                                                                    className="w-full text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                                                                />
                                                            </td>

                                                            {/* Botón eliminar */}
                                                            <td className="py-2 px-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(idx)}
                                                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
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
                            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                                <h4 className="text-xs font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    Nuestros Compromisos y Condiciones (Incluidas en el PDF Oficial)
                                </h4>
                                <p className="text-xs text-amber-800">
                                    Este texto se imprime en el recuadro oficial de la cotización. Asegura la mención expresa de que las
                                    <strong> cubetas plásticas son retornables</strong> y los demás envases no aplican para retorno.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                    Cláusulas de Compromiso y Garantía
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
                                            placeholder="Ej: (503) 7069-5335"
                                            value={formData.signature_author_phone}
                                            onChange={(e) => setFormData({ ...formData, signature_author_phone: e.target.value })}
                                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pie del Modal con Resumen de Totales y Guardar */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
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
                    <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
                        {quotationId && (
                            <button
                                type="button"
                                onClick={async () => {
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
                                }}
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
