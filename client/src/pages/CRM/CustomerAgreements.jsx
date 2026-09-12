import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
    Handshake,
    Plus,
    Search,
    Edit2,
    Trash2,
    Calculator,
    X,
    ExternalLink,
    Settings,
    Layers,
    Calendar
} from 'lucide-react';
import Money from '../../components/ui/Money';
import { useAuth } from '../../context/AuthContext';

const PRESENTATION_WEIGHTS = {
    'cubeta 30LB': 30,
    'cubeta 32LB': 32,
    'galón 8LB': 8,
    'medio galón 4LB': 4,
    'litro 2LB': 2,
};

const PRODUCT_TYPES = [
    'Huevo Entero Pasteurizado',
    'Huevo Entero Plus',
    'Clara de Huevo Pasteurizada',
    'Yema Azucarada',
    'Yema Salada',
    'Huevo con Leche Pasteurizado'
];

const PRESENTATION_OPTIONS = [
    { key: 'cubeta 30LB', label: 'Cubeta 30 LBS (30.0 Lbs)', weight: 30 },
    { key: 'cubeta 32LB', label: 'Cubeta 32 LBS (32.0 Lbs)', weight: 32 },
    { key: 'galón 8LB', label: 'Galón 8 LBS (8.0 Lbs)', weight: 8 },
    { key: 'medio galón 4LB', label: 'Medio Galón 4 LBS (4.0 Lbs)', weight: 4 },
    { key: 'litro 2LB', label: 'Litro 2 LBS (2.0 Lbs)', weight: 2 },
];

export default function CustomerAgreements() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Estados de filtrado y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos'); // 'todos', 'activo', 'inactivo'

    // Estado del modal de creación / edición
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAgreement, setEditingAgreement] = useState(null);

    // Función auxiliar para crear un item default sin duplicar los existentes
    const createDefaultItem = (existingItems = []) => {
        let selectedType = PRODUCT_TYPES[0];
        let selectedPres = PRESENTATION_OPTIONS[0].key;
        let selectedWeight = PRESENTATION_OPTIONS[0].weight;

        // Buscar la primera combinación de tipo y presentación no repetida
        outer: for (const t of PRODUCT_TYPES) {
            for (const p of PRESENTATION_OPTIONS) {
                if (!existingItems.some(it => it.product_type === t && it.presentation === p.key)) {
                    selectedType = t;
                    selectedPres = p.key;
                    selectedWeight = p.weight;
                    break outer;
                }
            }
        }

        return {
            id: null,
            product_id: '',
            product_code: '',
            catalog_product_name: '',
            product_type: selectedType,
            presentation: selectedPres,
            weight_lbs: selectedWeight,
            agreed_price_per_lb: '1.1900',
            agreed_unit_price: (1.1900 * selectedWeight).toFixed(2),
            monthly_volume_lbs: '10000',
            productSearchQuery: '',
            showProductDropdown: false
        };
    };

    // Formulario del modal
    const initialFormData = {
        id: null,
        customer_id: '',
        customer_name: '',
        target_margin_pct: '22',
        freight_cost_per_lb: '0.0000',
        payment_terms_days: '30',
        valid_from: '',
        valid_to: '',
        change_reason: '',
        notes: '',
        status: 'activo',
        items: []
    };
    const [formData, setFormData] = useState(initialFormData);

    // Búsqueda de clientes para el selector del modal
    const [customerQuery, setCustomerQuery] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Query principal de acuerdos
    const { data: agreementsResponse = { data: [], kpis: {} }, isLoading } = useQuery({
        queryKey: ['crm-customer-agreements', user?.company_id, searchTerm, statusFilter],
        queryFn: async () => {
            const res = await axios.get('/api/crm/customer-agreements', {
                params: {
                    search: searchTerm || undefined,
                    status: statusFilter !== 'todos' ? statusFilter : undefined
                }
            });
            return res.data;
        }
    });

    const agreementsList = agreementsResponse.data || [];
    const kpis = agreementsResponse.kpis || {
        total_agreements: 0,
        active_agreements: 0,
        distinct_customers: 0,
        total_active_volume_lbs: 0,
        avg_target_margin: 0
    };

    // Query de clientes para el selector del modal
    const { data: customersData = [] } = useQuery({
        queryKey: ['customers-list-for-agreements', customerQuery],
        queryFn: async () => {
            const res = await axios.get('/api/customers', {
                params: { nombre: customerQuery || undefined, limit: 30 }
            });
            return res.data?.data || res.data || [];
        },
        enabled: modalOpen
    });

    // Query general de productos para el catálogo del modal
    const { data: allCatalogProducts = [] } = useQuery({
        queryKey: ['products-list-for-agreements-catalog'],
        queryFn: async () => {
            const res = await axios.get('/api/products', {
                params: { limit: 100 }
            });
            return res.data?.data || res.data || [];
        },
        enabled: modalOpen
    });

    // Mutación para guardar (crear / editar)
    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            return (await axios.post('/api/crm/customer-agreements', payload)).data;
        },
        onSuccess: (res) => {
            toast.success(res.message || 'Acuerdo comercial guardado exitosamente.');
            queryClient.invalidateQueries({ queryKey: ['crm-customer-agreements'] });
            queryClient.invalidateQueries({ queryKey: ['customer-agreements-sales'] });
            closeModal();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar acuerdo comercial.');
        }
    });

    // Mutación para eliminar
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            return (await axios.delete(`/api/crm/customer-agreements/${id}`)).data;
        },
        onSuccess: () => {
            toast.success('Acuerdo comercial eliminado.');
            queryClient.invalidateQueries({ queryKey: ['crm-customer-agreements'] });
            queryClient.invalidateQueries({ queryKey: ['customer-agreements-sales'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar acuerdo.');
        }
    });

    // Abrir modal de creación
    const openCreateModal = () => {
        setEditingAgreement(null);
        const firstItem = createDefaultItem([]);
        setFormData({
            ...initialFormData,
            items: [firstItem]
        });
        setCustomerQuery('');
        setModalOpen(true);
    };

    // Abrir modal de edición
    const openEditModal = (agreement) => {
        setEditingAgreement(agreement);
        let weight = 30;
        const pres = agreement.presentation || 'cubeta 30LB';
        if (PRESENTATION_WEIGHTS[pres]) {
            weight = PRESENTATION_WEIGHTS[pres];
        } else {
            const m = pres.match(/(\d+(?:\.\d+)?)/);
            if (m) weight = parseFloat(m[1]) || 1;
        }

        const editItem = {
            id: agreement.id,
            product_id: agreement.product_id || '',
            product_code: agreement.product_code || '',
            catalog_product_name: agreement.catalog_product_name || '',
            product_type: agreement.product_type || 'Huevo Entero Pasteurizado',
            presentation: agreement.presentation || 'cubeta 30LB',
            weight_lbs: weight,
            agreed_price_per_lb: agreement.agreed_price_per_lb ? String(agreement.agreed_price_per_lb) : '0.0000',
            agreed_unit_price: agreement.agreed_unit_price ? String(agreement.agreed_unit_price) : '0.00',
            monthly_volume_lbs: agreement.monthly_volume_lbs ? String(agreement.monthly_volume_lbs) : '0',
            productSearchQuery: agreement.catalog_product_name || '',
            showProductDropdown: false
        };

        setFormData({
            id: agreement.id,
            customer_id: agreement.customer_id || '',
            customer_name: agreement.customer_name || '',
            target_margin_pct: agreement.target_margin_pct ? String(agreement.target_margin_pct) : '20',
            freight_cost_per_lb: agreement.freight_cost_per_lb ? String(agreement.freight_cost_per_lb) : '0.0000',
            payment_terms_days: agreement.payment_terms_days ? String(agreement.payment_terms_days) : '30',
            valid_from: agreement.valid_from ? agreement.valid_from.split('T')[0] : '',
            valid_to: agreement.valid_to ? agreement.valid_to.split('T')[0] : '',
            change_reason: '',
            notes: agreement.notes || '',
            status: agreement.status || 'activo',
            items: [editItem]
        });
        setCustomerQuery(agreement.customer_registered_name || agreement.customer_name || '');
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingAgreement(null);
        setShowCustomerDropdown(false);
    };

    // -----------------------------------------------------------------
    // Gestión dinámica de productos / presentaciones sin repetir
    // -----------------------------------------------------------------
    const handleAddItem = () => {
        const newItem = createDefaultItem(formData.items);
        // Validar si la combinación ya existe en la lista actual
        const isDuplicate = formData.items.some(
            it => it.product_type === newItem.product_type && it.presentation === newItem.presentation
        );
        if (isDuplicate) {
            return toast.error('Todas las combinaciones estándar de producto y presentación ya han sido agregadas.');
        }

        setFormData(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        toast.success(`Línea agregada: ${newItem.product_type} (${newItem.presentation})`);
    };

    const handleRemoveItem = (index) => {
        if (formData.items.length <= 1) {
            return toast.error('El acuerdo debe incluir al menos un producto o presentación.');
        }
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleItemChange = (index, field, value) => {
        const updated = [...formData.items];
        const currentItem = { ...updated[index] };

        const targetType = field === 'product_type' ? value : currentItem.product_type;
        const targetPres = field === 'presentation' ? value : currentItem.presentation;

        // Validar que no se repita la combinación de producto y presentación en otra fila
        if (field === 'product_type' || field === 'presentation') {
            const isDuplicate = updated.some(
                (it, i) => i !== index && it.product_type === targetType && it.presentation === targetPres
            );
            if (isDuplicate) {
                return toast.error(`La combinación "${targetType}" en "${targetPres}" ya está en la lista. No se permite repetir.`);
            }
        }

        if (field === 'presentation') {
            let weight = PRESENTATION_WEIGHTS[value];
            if (!weight) {
                const m = value.match(/(\d+(?:\.\d+)?)/);
                weight = m ? parseFloat(m[1]) || 1 : 1;
            }
            const priceLb = parseFloat(currentItem.agreed_price_per_lb) || 0;
            currentItem.presentation = value;
            currentItem.weight_lbs = weight;
            currentItem.agreed_unit_price = (priceLb * weight).toFixed(2);
        } else if (field === 'agreed_price_per_lb') {
            const priceLb = parseFloat(value) || 0;
            const weight = parseFloat(currentItem.weight_lbs) || 1;
            currentItem.agreed_price_per_lb = value;
            currentItem.agreed_unit_price = (priceLb * weight).toFixed(2);
        } else if (field === 'agreed_unit_price') {
            const unit = parseFloat(value) || 0;
            const weight = parseFloat(currentItem.weight_lbs) || 1;
            currentItem.agreed_unit_price = value;
            currentItem.agreed_price_per_lb = weight > 0 ? (unit / weight).toFixed(4) : '0.0000';
        } else {
            currentItem[field] = value;
        }

        updated[index] = currentItem;
        setFormData(prev => ({ ...prev, items: updated }));
    };

    // Selección de cliente desde dropdown
    const handleSelectCustomer = (customer) => {
        setFormData(prev => ({
            ...prev,
            customer_id: customer.id,
            customer_name: customer.nombre
        }));
        setCustomerQuery(customer.nombre);
        setShowCustomerDropdown(false);
    };

    // Mapeo opcional de producto desde catálogo para una fila específica
    const handleSelectProductForItem = (index, product) => {
        const prodName = product.nombre || '';
        let detectedType = 'Huevo Entero Pasteurizado';
        if (prodName.toLowerCase().includes('plus')) detectedType = 'Huevo Entero Plus';
        else if (prodName.toLowerCase().includes('clara')) detectedType = 'Clara de Huevo Pasteurizada';
        else if (prodName.toLowerCase().includes('yema azucarada')) detectedType = 'Yema Azucarada';
        else if (prodName.toLowerCase().includes('yema salada')) detectedType = 'Yema Salada';
        else if (prodName.toLowerCase().includes('leche')) detectedType = 'Huevo con Leche Pasteurizado';

        let detectedPres = 'cubeta 30LB';
        let weight = 30;
        if (prodName.toLowerCase().includes('32')) {
            detectedPres = 'cubeta 32LB';
            weight = 32;
        } else if (prodName.toLowerCase().includes('8')) {
            detectedPres = 'galón 8LB';
            weight = 8;
        } else if (prodName.toLowerCase().includes('4')) {
            detectedPres = 'medio galón 4LB';
            weight = 4;
        } else if (prodName.toLowerCase().includes('2')) {
            detectedPres = 'litro 2LB';
            weight = 2;
        }

        // Verificar si la combinación detectada ya existe en otra fila
        const isDuplicate = formData.items.some(
            (it, i) => i !== index && it.product_type === detectedType && it.presentation === detectedPres
        );
        if (isDuplicate) {
            return toast.error(`El producto de catálogo corresponde a "${detectedType} - ${detectedPres}", que ya existe en otra fila de este acuerdo.`);
        }

        const updated = [...formData.items];
        const currentItem = { ...updated[index] };
        const priceLb = parseFloat(currentItem.agreed_price_per_lb) || 0;

        currentItem.product_id = product.id;
        currentItem.product_code = product.codigo;
        currentItem.catalog_product_name = product.nombre;
        currentItem.product_type = detectedType;
        currentItem.presentation = detectedPres;
        currentItem.weight_lbs = weight;
        currentItem.agreed_unit_price = (priceLb * weight).toFixed(2);
        currentItem.productSearchQuery = product.nombre;
        currentItem.showProductDropdown = false;

        updated[index] = currentItem;
        setFormData(prev => ({ ...prev, items: updated }));
        toast.success(`Producto enlazado: ${product.nombre}`);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.customer_name || !formData.customer_name.trim()) {
            return toast.error('El nombre del cliente es obligatorio.');
        }

        if (!formData.items || formData.items.length === 0) {
            return toast.error('Debe agregar al menos un producto o presentación al acuerdo.');
        }

        // Validar unicidad estricta entre todos los items
        const combos = new Set();
        for (let i = 0; i < formData.items.length; i++) {
            const item = formData.items[i];
            const pLb = parseFloat(item.agreed_price_per_lb) || 0;
            const pUnit = parseFloat(item.agreed_unit_price) || 0;

            if (pLb <= 0 && pUnit <= 0) {
                return toast.error(`El producto #${i + 1} (${item.product_type} - ${item.presentation}) debe tener un precio pactado mayor a cero.`);
            }

            const key = `${item.product_type.trim().toLowerCase()}___${item.presentation.trim().toLowerCase()}`;
            if (combos.has(key)) {
                return toast.error(`La combinación "${item.product_type} - ${item.presentation}" está repetida. No se permiten duplicados.`);
            }
            combos.add(key);
        }

        // Enviar al backend
        saveMutation.mutate(formData);
    };

    const handleDelete = (id, customerName) => {
        if (window.confirm(`¿Seguro de eliminar el acuerdo comercial con "${customerName}"?`)) {
            deleteMutation.mutate(id);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* ENCABEZADO PRINCIPAL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
                        <Handshake className="w-4 h-4" />
                        <span>CRM Comercial • ANDELSA Planta Industrial</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <span>Acuerdos de Precios con Clientes</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Mantenimiento centralizado de contratos y precios pactados. Se cargan automáticamente al facturar en punto de venta.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => navigate('/crm/configuracion')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                        title="Configurar márgenes objetivo, fletes, plazos y políticas comerciales"
                    >
                        <Settings className="w-4 h-4 text-slate-600" />
                        <span className="hidden sm:inline">Configuración</span>
                    </button>

                    <button
                        onClick={() => navigate('/industrial/costeo-libra')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                        title="Ver simulador dinámico de absorción y costos"
                    >
                        <Calculator className="w-4 h-4 text-indigo-600" />
                        <span className="hidden sm:inline">Simulador de Costeo</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </button>

                    <button
                        onClick={() => navigate('/industrial/calendario')}
                        className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200 transition-all shadow-2xs"
                        title="Ver pedidos y programación en Calendario de Producción"
                    >
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span className="hidden sm:inline">Calendario de Producción</span>
                    </button>

                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Acuerdo</span>
                    </button>
                </div>
            </div>

            {/* BARRA DE KPIS COMERCIALES */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Acuerdos Registrados</span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                        {kpis.total_agreements || 0}
                    </div>
                    <span className="text-[11px] text-indigo-600 font-semibold mt-0.5 block">
                        {kpis.active_agreements || 0} contratos vigentes
                    </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Clientes con Acuerdo</span>
                    <div className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
                        {kpis.distinct_customers || 0}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                        Empresas vinculadas
                    </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Volumen Comprometido</span>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                        <span>{parseFloat(kpis.total_active_volume_lbs || 0).toLocaleString()}</span>
                        <span className="text-xs font-bold text-slate-400">Lbs/mes</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                        Demanda fija mensual
                    </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Margen Promedio</span>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 flex items-baseline gap-1">
                        <span>{parseFloat(kpis.avg_target_margin || 0).toFixed(1)}</span>
                        <span className="text-xs font-bold">%</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5 block">
                        Sobre absorción total
                    </span>
                </div>

                <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider block">Sincronización POS</span>
                        <div className="text-xs font-semibold text-white mt-1 leading-snug">
                            Tarifas automáticas al seleccionar el cliente en facturación
                        </div>
                    </div>
                    <span className="text-[10px] text-indigo-200 font-mono mt-2 block">
                        • Enlace directo con punto de venta
                    </span>
                </div>
            </div>

            {/* TABLA PRINCIPAL Y FILTROS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                {/* FILTROS Y BÚSQUEDA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, tipo de huevo, presentación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                            <button
                                onClick={() => setStatusFilter('todos')}
                                className={`px-3 py-1 font-bold rounded-lg transition-all ${statusFilter === 'todos' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setStatusFilter('activo')}
                                className={`px-3 py-1 font-bold rounded-lg transition-all ${statusFilter === 'activo' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Activos
                            </button>
                            <button
                                onClick={() => setStatusFilter('inactivo')}
                                className={`px-3 py-1 font-bold rounded-lg transition-all ${statusFilter === 'inactivo' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Inactivos
                            </button>
                        </div>
                    </div>
                </div>

                {/* LISTA DE ACUERDOS */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4">Cliente / Razón Social</th>
                                <th className="py-3 px-4">Producto y Presentación</th>
                                <th className="py-3 px-4 text-right">Precio Pactado ($/Lb)</th>
                                <th className="py-3 px-4 text-right">Precio en POS ($/Unidad)</th>
                                <th className="py-3 px-4 text-right">Volumen (Lbs/Mes)</th>
                                <th className="py-3 px-4 text-center">Términos Pago</th>
                                <th className="py-3 px-4 text-center">Vigencia</th>
                                <th className="py-3 px-4 text-center">Estado</th>
                                <th className="py-3 px-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-slate-400 font-semibold">
                                        Cargando acuerdos comerciales...
                                    </td>
                                </tr>
                            ) : agreementsList.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Handshake className="w-8 h-8 text-slate-300" />
                                            <span className="font-semibold text-slate-500">No se encontraron acuerdos comerciales</span>
                                            <span className="text-[11px] text-slate-400">Presione "Nuevo Acuerdo" para pactar una tarifa con un cliente.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                agreementsList.map((agr) => (
                                    <tr key={agr.id} className="hover:bg-slate-50/75 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-slate-900 text-[13px]">
                                                {agr.customer_registered_name || agr.customer_name}
                                            </div>
                                            {agr.customer_nit && (
                                                <div className="text-[10px] text-slate-400">
                                                    NIT: {agr.customer_nit} {agr.customer_nrc ? `• NRC: ${agr.customer_nrc}` : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-slate-800">{agr.product_type}</div>
                                            <div className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
                                                <span>{agr.presentation}</span>
                                                {agr.catalog_product_name && (
                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                        ({agr.catalog_product_name})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="font-mono font-bold text-slate-900">
                                                ${parseFloat(agr.agreed_price_per_lb || 0).toFixed(4)}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">/ lb</span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="font-black text-indigo-600 text-xs px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md">
                                                <Money value={agr.agreed_unit_price} />
                                            </span>
                                            <span className="text-[10px] text-slate-400 block mt-0.5">/ unidad facturable</span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                                            {parseFloat(agr.monthly_volume_lbs || 0) > 0
                                                ? `${parseFloat(agr.monthly_volume_lbs).toLocaleString()} Lbs`
                                                : <span className="text-slate-400 italic">No fijado</span>}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold">
                                                {agr.payment_terms_days ? `${agr.payment_terms_days} días` : 'Contado'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {agr.valid_from || agr.valid_to ? (
                                                <div className="text-[10px] font-semibold text-slate-600">
                                                    <div>{agr.valid_from ? agr.valid_from.split('T')[0] : 'Inicio'}</div>
                                                    <div className="text-slate-400">hasta {agr.valid_to ? agr.valid_to.split('T')[0] : 'Indefinido'}</div>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-400 font-medium italic">Permanente</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${agr.status === 'activo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                                {agr.status === 'activo' ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => openEditModal(agr)}
                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Editar acuerdo y productos"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(agr.id, agr.customer_name)}
                                                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Eliminar acuerdo comercial"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL: NUEVO / EDITAR ACUERDO DE PRECIOS CON CLIENTE CON MÚLTIPLES PRODUCTOS */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto">
                        {/* Cabecera del modal */}
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                    <Handshake className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 uppercase">
                                        {editingAgreement ? 'Editar Acuerdo Comercial' : 'Nuevo Acuerdo de Precios con Cliente'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        El precio pactado se asignará automáticamente en el Punto de Venta al seleccionar este cliente.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* SELECCIÓN DE CLIENTE */}
                            <div className="relative">
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                    Cliente / Empresa Comercial <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        placeholder="Buscar cliente del catálogo o escribir nombre libre..."
                                        value={customerQuery}
                                        onChange={(e) => {
                                            setCustomerQuery(e.target.value);
                                            setFormData(prev => ({ ...prev, customer_name: e.target.value, customer_id: '' }));
                                            setShowCustomerDropdown(true);
                                        }}
                                        onFocus={() => setShowCustomerDropdown(true)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                    {formData.customer_id && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                            Cliente Enlazado ID: {formData.customer_id}
                                        </span>
                                    )}
                                </div>

                                {showCustomerDropdown && customersData.length > 0 && (
                                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                                        {customersData.map((c) => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleSelectCustomer(c)}
                                                className="p-2.5 hover:bg-indigo-50/60 cursor-pointer transition-colors text-xs"
                                            >
                                                <div className="font-bold text-slate-900">{c.nombre}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    NRC: {c.nrc || 'N/A'} • NIT: {c.nit || 'N/A'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* SECCIÓN DINÁMICA: PRODUCTOS Y PRESENTACIONES PACTADOS */}
                            <div className="space-y-3 bg-slate-50/75 p-4 rounded-2xl border border-slate-200">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-indigo-600" />
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                                Productos y Presentaciones Pactadas
                                            </h4>
                                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                {formData.items.length} {formData.items.length === 1 ? 'Producto' : 'Productos'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                            Puede agregar múltiples productos o presentaciones distintas sin repetirse.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 self-start sm:self-auto"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Agregar Otro Producto / Presentación</span>
                                    </button>
                                </div>

                                {/* LISTA DE PRODUCTOS DEL ACUERDO */}
                                <div className="space-y-4 pt-1">
                                    {formData.items.map((item, index) => (
                                        <div
                                            key={index}
                                            className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3 relative"
                                        >
                                            {/* Cabecera del ítem */}
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] rounded-lg uppercase">
                                                        Línea #{index + 1}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-800">
                                                        {item.product_type} • {item.presentation}
                                                    </span>
                                                </div>

                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                                                        title="Eliminar este producto del acuerdo"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        <span className="text-[10px]">Quitar</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* MAPEO CON PRODUCTO DE CATÁLOGO (OPCIONAL) */}
                                            <div className="relative">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                                    Mapeo con Producto de Catálogo (Opcional)
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Buscar en catálogo para auto-llenar tipo y presentación..."
                                                    value={item.productSearchQuery || ''}
                                                    onChange={(e) => {
                                                        const q = e.target.value;
                                                        const updated = [...formData.items];
                                                        updated[index].productSearchQuery = q;
                                                        updated[index].showProductDropdown = true;
                                                        setFormData(prev => ({ ...prev, items: updated }));
                                                    }}
                                                    onFocus={() => {
                                                        const updated = [...formData.items];
                                                        updated[index].showProductDropdown = true;
                                                        setFormData(prev => ({ ...prev, items: updated }));
                                                    }}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />

                                                {item.showProductDropdown && allCatalogProducts.length > 0 && (
                                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                        {allCatalogProducts
                                                            .filter(p => !item.productSearchQuery || p.nombre.toLowerCase().includes(item.productSearchQuery.toLowerCase()) || p.codigo?.toLowerCase().includes(item.productSearchQuery.toLowerCase()))
                                                            .slice(0, 15)
                                                            .map((p) => (
                                                                <div
                                                                    key={p.id}
                                                                    onClick={() => handleSelectProductForItem(index, p)}
                                                                    className="p-2 hover:bg-indigo-50/60 cursor-pointer transition-colors text-xs flex items-center justify-between"
                                                                >
                                                                    <div>
                                                                        <div className="font-bold text-slate-900">{p.nombre}</div>
                                                                        <div className="text-[10px] text-slate-500">Código: {p.codigo}</div>
                                                                    </div>
                                                                    <span className="text-xs font-black text-indigo-600">
                                                                        <Money value={p.precio_unitario} />
                                                                    </span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* TIPO DE PRODUCTO Y PRESENTACIÓN */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                                        Tipo de Producto
                                                    </label>
                                                    <select
                                                        value={item.product_type}
                                                        onChange={(e) => handleItemChange(index, 'product_type', e.target.value)}
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                                    >
                                                        {PRODUCT_TYPES.map(pt => (
                                                            <option key={pt} value={pt}>{pt}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                                        Presentación Comercial
                                                    </label>
                                                    <select
                                                        value={item.presentation}
                                                        onChange={(e) => handleItemChange(index, 'presentation', e.target.value)}
                                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                                    >
                                                        {PRESENTATION_OPTIONS.map(po => (
                                                            <option key={po.key} value={po.key}>{po.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* CALCULADORA DUAL: PRECIO $/LB Y PRECIO FACTURABLE UNITARIO */}
                                            <div className="bg-indigo-50/50 border border-indigo-100 p-3.5 rounded-xl space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] font-black text-indigo-900 uppercase flex items-center gap-1.5">
                                                        <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                                                        <span>Precios Sincronizados de Contrato</span>
                                                    </span>
                                                    <span className="text-[10px] text-indigo-600 font-bold bg-white px-2 py-0.5 rounded border border-indigo-200">
                                                        Peso base: {item.weight_lbs} Lbs / unidad
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                            Precio Pactado ($/Lb) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                min="0"
                                                                required
                                                                placeholder="1.1900"
                                                                value={item.agreed_price_per_lb}
                                                                onChange={(e) => handleItemChange(index, 'agreed_price_per_lb', e.target.value)}
                                                                className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 block mt-0.5">Precio por libra</span>
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-1">
                                                            Precio POS ($/Unidad) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600">$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                required
                                                                placeholder="35.70"
                                                                value={item.agreed_unit_price}
                                                                onChange={(e) => handleItemChange(index, 'agreed_unit_price', e.target.value)}
                                                                className="w-full bg-white border-2 border-indigo-400 rounded-xl pl-8 pr-3 py-1.5 text-xs font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 shadow-sm"
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-indigo-600 block mt-0.5 font-medium">Facturación automática</span>
                                                    </div>

                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                            Volumen (Lbs/Mes)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            placeholder="10000"
                                                            value={item.monthly_volume_lbs}
                                                            onChange={(e) => handleItemChange(index, 'monthly_volume_lbs', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                                        />
                                                        <span className="text-[9px] text-slate-400 block mt-0.5">Volumen mensual estimado</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* CONDICIONES GENERALES DEL ACUERDO */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Margen Objetivo (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        placeholder="22"
                                        value={formData.target_margin_pct}
                                        onChange={(e) => setFormData({ ...formData, target_margin_pct: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Días de Crédito / Plazo de Pago
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="30"
                                        value={formData.payment_terms_days}
                                        onChange={(e) => setFormData({ ...formData, payment_terms_days: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* RANGO DE VIGENCIA DE LA TARIFA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Vigente Desde (Inicio)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.valid_from}
                                        onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Vigente Hasta (Vencimiento)
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.valid_to}
                                        onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <span className="sm:col-span-2 text-[10px] text-slate-400 font-medium">
                                    Opcional: Si se deja en blanco, la tarifa pactada se considera permanente.
                                </span>
                            </div>

                            {/* MOTIVO DEL CAMBIO / AJUSTE (AUDITORÍA) */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                    Motivo de Ajuste / Nota de Revisión
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Renegociación anual, volumen adicional pactado, nuevo catálogo de cliente..."
                                    value={formData.change_reason}
                                    onChange={(e) => setFormData({ ...formData, change_reason: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                />
                            </div>

                            {/* NOTAS Y ESTADO */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Notas & Condiciones Especiales
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Frecuencia de entrega, temperatura refrigerada, devolución..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Estado del Contrato
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="activo">Activo (Vigente)</option>
                                        <option value="inactivo">Inactivo (Suspendido)</option>
                                    </select>
                                </div>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saveMutation.isPending}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2"
                                >
                                    {saveMutation.isPending ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Guardando...</span>
                                        </>
                                    ) : (
                                        <span>
                                            {formData.items.length > 1
                                                ? `Guardar Acuerdo (${formData.items.length} Productos)`
                                                : 'Guardar Acuerdo Comercial'}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
