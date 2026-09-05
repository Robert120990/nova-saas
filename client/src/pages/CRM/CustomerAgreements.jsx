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
    CheckCircle2,
    X,
    Scale,
    Percent,
    ExternalLink,
    Building2
} from 'lucide-react';
import Money from '../../components/ui/Money';

const PRESENTATION_WEIGHTS = {
    'cubeta 30LB': 30,
    'cubeta 32LB': 32,
    'galón 8LB': 8,
    'medio galón 4LB': 4,
    'litro 2LB': 2,
};

export default function CustomerAgreements() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Estados de filtrado y búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos'); // 'todos', 'activo', 'inactivo'

    // Estado del modal de creación / edición
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAgreement, setEditingAgreement] = useState(null);

    // Formulario del modal
    const initialFormData = {
        id: null,
        customer_id: '',
        customer_name: '',
        product_id: '',
        product_type: 'Huevo Entero Pasteurizado',
        presentation: 'cubeta 30LB',
        weight_lbs: 30,
        agreed_price_per_lb: '1.1900',
        agreed_unit_price: '35.70',
        monthly_volume_lbs: '10000',
        target_margin_pct: '22',
        freight_cost_per_lb: '0.0000',
        payment_terms_days: '30',
        notes: '',
        status: 'activo'
    };
    const [formData, setFormData] = useState(initialFormData);

    // Búsqueda de clientes para el selector del modal
    const [customerQuery, setCustomerQuery] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Búsqueda de productos del catálogo para el selector del modal
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    // Query principal de acuerdos
    const { data: agreementsResponse = { data: [], kpis: {} }, isLoading } = useQuery({
        queryKey: ['crm-customer-agreements', searchTerm, statusFilter],
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

    // Query de productos para el selector del modal
    const { data: productsData = [] } = useQuery({
        queryKey: ['products-list-for-agreements', productSearchQuery],
        queryFn: async () => {
            const res = await axios.get('/api/products', {
                params: { search: productSearchQuery || undefined, limit: 40 }
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
        setFormData(initialFormData);
        setCustomerQuery('');
        setProductSearchQuery('');
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

        setFormData({
            id: agreement.id,
            customer_id: agreement.customer_id || '',
            customer_name: agreement.customer_name || '',
            product_id: agreement.product_id || '',
            product_type: agreement.product_type || 'Huevo Entero Pasteurizado',
            presentation: agreement.presentation || 'cubeta 30LB',
            weight_lbs: weight,
            agreed_price_per_lb: agreement.agreed_price_per_lb ? String(agreement.agreed_price_per_lb) : '0.0000',
            agreed_unit_price: agreement.agreed_unit_price ? String(agreement.agreed_unit_price) : '0.00',
            monthly_volume_lbs: agreement.monthly_volume_lbs ? String(agreement.monthly_volume_lbs) : '0',
            target_margin_pct: agreement.target_margin_pct ? String(agreement.target_margin_pct) : '20',
            freight_cost_per_lb: agreement.freight_cost_per_lb ? String(agreement.freight_cost_per_lb) : '0.0000',
            payment_terms_days: agreement.payment_terms_days ? String(agreement.payment_terms_days) : '30',
            notes: agreement.notes || '',
            status: agreement.status || 'activo'
        });
        setCustomerQuery(agreement.customer_registered_name || agreement.customer_name || '');
        setProductSearchQuery(agreement.catalog_product_name || '');
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingAgreement(null);
        setShowCustomerDropdown(false);
        setShowProductDropdown(false);
    };

    // Cálculos bidireccionales de precio
    const handlePricePerLbChange = (val) => {
        const priceLb = parseFloat(val) || 0;
        const weight = parseFloat(formData.weight_lbs) || 1;
        const unit = (priceLb * weight).toFixed(2);
        setFormData(prev => ({
            ...prev,
            agreed_price_per_lb: val,
            agreed_unit_price: unit
        }));
    };

    const handleUnitPriceChange = (val) => {
        const unit = parseFloat(val) || 0;
        const weight = parseFloat(formData.weight_lbs) || 1;
        const priceLb = weight > 0 ? (unit / weight).toFixed(4) : '0.0000';
        setFormData(prev => ({
            ...prev,
            agreed_unit_price: val,
            agreed_price_per_lb: priceLb
        }));
    };

    const handlePresentationChange = (pres) => {
        let weight = PRESENTATION_WEIGHTS[pres];
        if (!weight) {
            const m = pres.match(/(\d+(?:\.\d+)?)/);
            weight = m ? parseFloat(m[1]) || 1 : 1;
        }
        const priceLb = parseFloat(formData.agreed_price_per_lb) || 0;
        const unit = (priceLb * weight).toFixed(2);
        setFormData(prev => ({
            ...prev,
            presentation: pres,
            weight_lbs: weight,
            agreed_unit_price: unit
        }));
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

    // Selección de producto desde dropdown
    const handleSelectProduct = (product) => {
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

        const priceLb = parseFloat(formData.agreed_price_per_lb) || 0;
        const unit = (priceLb * weight).toFixed(2);

        setFormData(prev => ({
            ...prev,
            product_id: product.id,
            product_type: detectedType,
            presentation: detectedPres,
            weight_lbs: weight,
            agreed_unit_price: unit
        }));
        setProductSearchQuery(product.nombre);
        setShowProductDropdown(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.customer_name.trim()) {
            return toast.error('El nombre del cliente es obligatorio.');
        }
        if (parseFloat(formData.agreed_price_per_lb) <= 0 && parseFloat(formData.agreed_unit_price) <= 0) {
            return toast.error('Ingrese un precio pactado válido mayor a 0.');
        }
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
                        onClick={() => navigate('/industrial/costeo-libra')}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                        title="Ver simulador dinámico de absorción y costos"
                    >
                        <Calculator className="w-4 h-4 text-indigo-600" />
                        <span className="hidden sm:inline">Simulador de Costeo</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </button>

                    <button
                        onClick={openCreateModal}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm shadow-indigo-600/30 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Acuerdo</span>
                    </button>
                </div>
            </div>

            {/* TARJETAS KPI DE RENDIMIENTO COMERCIAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Acuerdos Activos</span>
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                            <Handshake className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{kpis.active_agreements || 0}</span>
                        <span className="text-xs font-medium text-slate-400">de {kpis.total_agreements || 0} contratos</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Contratos vigentes para facturación</span>
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Clientes con Contrato</span>
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                            <Building2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">{kpis.distinct_customers || 0}</span>
                        <span className="text-xs font-medium text-slate-400">empresas</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                        PriceSmart, Gate Gourmet, y más
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Volumen Comprometido</span>
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                            <Scale className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                            {Number(kpis.total_active_volume_lbs || 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-medium text-slate-500">Lbs/Mes</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-amber-700">
                        Capacidad garantizada en contratos
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Margen Obj. Promedio</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                            <Percent className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-600">
                            {Number(kpis.avg_target_margin || 0).toFixed(1)}%
                        </span>
                        <span className="text-xs font-medium text-slate-400">sobre costo</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-slate-500">
                        Objetivo de rentabilidad pactada
                    </div>
                </div>
            </div>

            {/* BARRA DE BÚSQUEDA Y FILTROS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por cliente, producto, presentación, código..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-[13px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap hidden md:inline">
                        Estado:
                    </span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                        <option value="todos">Todos los Estados</option>
                        <option value="activo">Solo Activos</option>
                        <option value="inactivo">Inactivos</option>
                    </select>
                </div>
            </div>

            {/* TABLA PRINCIPAL DE ACUERDOS */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                <th className="py-3.5 px-4">Cliente / Contrato</th>
                                <th className="py-3.5 px-3">Producto & Presentación</th>
                                <th className="py-3.5 px-3 text-right">Precio $/Lb</th>
                                <th className="py-3.5 px-3 text-right">Precio Unitario</th>
                                <th className="py-3.5 px-3 text-right">Volumen Mes</th>
                                <th className="py-3.5 px-3 text-center">Margen Obj.</th>
                                <th className="py-3.5 px-3 text-center">Términos</th>
                                <th className="py-3.5 px-3 text-center">Estado</th>
                                <th className="py-3.5 px-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-slate-400">
                                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mb-2" />
                                        <p>Cargando acuerdos comerciales...</p>
                                    </td>
                                </tr>
                            ) : agreementsList.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="py-12 text-center text-slate-400">
                                        <Handshake className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        <p className="font-semibold text-slate-600">No se encontraron acuerdos comerciales.</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Cree un nuevo acuerdo para que se aplique automáticamente al facturar.</p>
                                    </td>
                                </tr>
                            ) : (
                                agreementsList.map((agr) => {
                                    const isLinkedCustomer = !!agr.customer_id;
                                    const isLinkedProduct = !!agr.product_id;
                                    const isActive = agr.status === 'activo';

                                    return (
                                        <tr key={agr.id} className="hover:bg-slate-50/70 transition-colors group">
                                            {/* CLIENTE */}
                                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                                                <div className="flex items-start gap-2">
                                                    <div>
                                                        <span className="font-bold block text-slate-900 text-[13px]">
                                                            {agr.customer_registered_name || agr.customer_name}
                                                        </span>
                                                        {isLinkedCustomer ? (
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    <span>Vinculado</span>
                                                                </span>
                                                                {agr.customer_nrc && (
                                                                    <span className="text-[10px] text-slate-400">
                                                                        NRC: {agr.customer_nrc}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                                                                (Nombre texto libre)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* PRODUCTO & PRESENTACIÓN */}
                                            <td className="py-3.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-800">{agr.product_type}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                        {agr.presentation}
                                                    </span>
                                                    {isLinkedProduct && (
                                                        <span className="text-[10px] text-slate-400">
                                                            SKU: {agr.product_code || agr.catalog_product_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* PRECIO $/LB */}
                                            <td className="py-3.5 px-3 text-right">
                                                <span className="font-bold text-slate-700 text-[13px]">
                                                    <Money value={agr.agreed_price_per_lb} />
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-normal">/ Lb</span>
                                            </td>

                                            {/* PRECIO UNITARIO FACTURABLE */}
                                            <td className="py-3.5 px-3 text-right">
                                                <div className="inline-block bg-indigo-50/60 border border-indigo-100 rounded-lg px-2.5 py-1 text-right">
                                                    <span className="font-black text-indigo-700 text-sm block">
                                                        <Money value={agr.agreed_unit_price} />
                                                    </span>
                                                    <span className="text-[9px] font-bold text-indigo-500 block uppercase">
                                                        Precio en POS
                                                    </span>
                                                </div>
                                            </td>

                                            {/* VOLUMEN MES */}
                                            <td className="py-3.5 px-3 text-right">
                                                <span className="font-bold text-slate-800">
                                                    {Number(agr.monthly_volume_lbs || 0).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-slate-400 block font-normal">Lbs</span>
                                            </td>

                                            {/* MARGEN OBJETIVO */}
                                            <td className="py-3.5 px-3 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {Number(agr.target_margin_pct || 0).toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* TÉRMINOS */}
                                            <td className="py-3.5 px-3 text-center">
                                                <span className="text-slate-600 font-semibold text-[11px]">
                                                    {agr.payment_terms_days ? `${agr.payment_terms_days} días` : 'Contado'}
                                                </span>
                                            </td>

                                            {/* ESTADO */}
                                            <td className="py-3.5 px-3 text-center">
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        isActive
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}
                                                >
                                                    {isActive ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>

                                            {/* ACCIONES */}
                                            <td className="py-3.5 px-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => openEditModal(agr)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Editar Acuerdo"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(agr.id, agr.customer_name)}
                                                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Eliminar Acuerdo"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL PARA CREAR / EDITAR ACUERDO COMERCIAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-auto">
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

                        <form onSubmit={handleSubmit} className="space-y-4">
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
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
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

                            {/* VINCULACIÓN DE PRODUCTO DEL CATÁLOGO */}
                            <div className="relative">
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                    Mapeo con Producto de Catálogo (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Buscar producto en catálogo para auto-llenar presentación..."
                                    value={productSearchQuery}
                                    onChange={(e) => {
                                        setProductSearchQuery(e.target.value);
                                        setShowProductDropdown(true);
                                    }}
                                    onFocus={() => setShowProductDropdown(true)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                {showProductDropdown && productsData.length > 0 && (
                                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                                        {productsData.map((p) => (
                                            <div
                                                key={p.id}
                                                onClick={() => handleSelectProduct(p)}
                                                className="p-2.5 hover:bg-indigo-50/60 cursor-pointer transition-colors text-xs flex items-center justify-between"
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
                                        value={formData.product_type}
                                        onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="Huevo Entero Pasteurizado">Huevo Entero Pasteurizado</option>
                                        <option value="Huevo Entero Plus">Huevo Entero Plus</option>
                                        <option value="Clara de Huevo Pasteurizada">Clara Pasteurizada</option>
                                        <option value="Yema Azucarada">Yema Azucarada</option>
                                        <option value="Yema Salada">Yema Salada</option>
                                        <option value="Huevo con Leche Pasteurizado">Huevo Entero con Leche</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Presentación Comercial
                                    </label>
                                    <select
                                        value={formData.presentation}
                                        onChange={(e) => handlePresentationChange(e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="cubeta 30LB">Cubeta 30 LBS (30.0 Lbs)</option>
                                        <option value="cubeta 32LB">Cubeta 32 LBS (32.0 Lbs)</option>
                                        <option value="galón 8LB">Galón 8 LBS (8.0 Lbs)</option>
                                        <option value="medio galón 4LB">Medio Galón 4 LBS (4.0 Lbs)</option>
                                        <option value="litro 2LB">Litro 2 LBS (2.0 Lbs)</option>
                                    </select>
                                </div>
                            </div>

                            {/* CALCULADORA DUAL: PRECIO $/LB Y PRECIO FACTURABLE UNITARIO */}
                            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-indigo-900 uppercase flex items-center gap-1.5">
                                        <Calculator className="w-4 h-4 text-indigo-600" />
                                        <span>Precios Sincronizados de Contrato</span>
                                    </span>
                                    <span className="text-[11px] text-indigo-600 font-semibold">
                                        Peso base: {formData.weight_lbs} Lbs / unidad
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
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
                                                value={formData.agreed_price_per_lb}
                                                onChange={(e) => handlePricePerLbChange(e.target.value)}
                                                className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 block mt-0.5">Precio contractual por libra</span>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-indigo-800 uppercase block mb-1">
                                            Precio Facturable en POS ($/Unidad) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                required
                                                placeholder="35.70"
                                                value={formData.agreed_unit_price}
                                                onChange={(e) => handleUnitPriceChange(e.target.value)}
                                                className="w-full bg-white border-2 border-indigo-400 rounded-xl pl-8 pr-3 py-2 text-[13px] font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 shadow-sm"
                                            />
                                        </div>
                                        <span className="text-[10px] text-indigo-600 block mt-0.5 font-medium">
                                            Monto que se cargará directamente a la factura
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* VOLUMEN, MARGEN Y TÉRMINOS */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Volumen Estimado (Lbs/Mes)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="10000"
                                        value={formData.monthly_volume_lbs}
                                        onChange={(e) => setFormData({ ...formData, monthly_volume_lbs: e.target.value })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-[13px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>

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
                                        Días de Crédito / Pago
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
                                        <span>Guardar Acuerdo Comercial</span>
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
