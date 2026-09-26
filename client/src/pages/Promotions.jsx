import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Plus, 
    Trash2, 
    Edit, 
    Search, 
    Sparkles, 
    Tag, 
    Info, 
    Layers, 
    ShoppingBag, 
    Check, 
    X
} from 'lucide-react';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

const PROMOTION_TYPES = [
    {
        id: 'nxm',
        name: 'N x M (2x1, 3x2)',
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: Sparkles,
        description: 'Lleva N unidades y paga solo M (la diferencia es 100% gratis)',
        example: 'Ej: 2x1 (Lleva 2, Paga 1) o 3x2 (Lleva 3, Paga 2)'
    },
    {
        id: 'second_unit_discount',
        name: 'Segunda Unidad (%)',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: Layers,
        description: 'Compra a precio regular y la siguiente unidad recibe un % de descuento',
        example: 'Ej: Compra 1 y la 2da al 50% de descuento'
    },
    {
        id: 'bundle_fixed_price',
        name: 'Paquete Fijo (X por $Y)',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: ShoppingBag,
        description: 'Lote de X unidades por un precio global cerrado',
        example: 'Ej: 3 unidades por $10.00 en total'
    },
    {
        id: 'volume_tier',
        name: 'Escala por Volumen',
        badge: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: Tag,
        description: 'A partir de N unidades, se aplica un descuento porcentual a toda la línea',
        example: 'Ej: A partir de 6 unidades, 15% de descuento en cada una'
    }
];

const DAYS_NAMES = [
    { id: 1, label: 'Lun', name: 'Lunes' },
    { id: 2, label: 'Mar', name: 'Martes' },
    { id: 3, label: 'Mié', name: 'Miércoles' },
    { id: 4, label: 'Jue', name: 'Jueves' },
    { id: 5, label: 'Vie', name: 'Viernes' },
    { id: 6, label: 'Sáb', name: 'Sábado' },
    { id: 7, label: 'Dom', name: 'Domingo' }
];

const Promotions = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterBranchId, setFilterBranchId] = useState('');

    // Modal estado
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        branch_id: '',
        promotion_type: 'nxm',
        buy_quantity: 2,
        pay_quantity: 1,
        discount_percentage: 50,
        bundle_price: 10,
        start_date: '',
        end_date: '',
        days_of_week: [1, 2, 3, 4, 5, 6, 7],
        max_applications_per_sale: '',
        is_cumulative: false,
        active: true,
        selectedProducts: [] // Array de { id, codigo, nombre }
    });

    // Carga de sucursales
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    // Carga de promociones
    const { data: promotions = [], isLoading } = useQuery({
        queryKey: ['promotions', searchTerm, filterType, filterStatus, filterBranchId],
        queryFn: async () => {
            const params = {};
            if (searchTerm) params.search = searchTerm;
            if (filterType !== 'all') params.promotion_type = filterType;
            if (filterStatus !== 'all') params.status = filterStatus;
            if (filterBranchId) params.branch_id = filterBranchId;
            return (await axios.get('/api/promotions', { params })).data;
        }
    });

    // Carga de productos remota para SearchableSelect
    const loadProductsOptions = useCallback(async (search, page) => {
        const { data } = await axios.get('/api/products', {
            params: {
                search: search || undefined,
                page,
                limit: 50,
                branch_id: formData.branch_id || undefined,
                status: 'activo'
            }
        });
        return data;
    }, [formData.branch_id]);

    // Mutaciones
    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            if (editingPromotion?.id) {
                return (await axios.put(`/api/promotions/${editingPromotion.id}`, payload)).data;
            } else {
                return (await axios.post('/api/promotions', payload)).data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['promotions']);
            setIsModalOpen(false);
            resetForm();
            toast.success(editingPromotion ? 'Promoción actualizada con éxito' : 'Promoción creada con éxito');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar la promoción');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => (await axios.delete(`/api/promotions/${id}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries(['promotions']);
            toast.success('Promoción eliminada con éxito');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar la promoción')
    });

    const resetForm = () => {
        setEditingPromotion(null);
        setFormData({
            name: '',
            description: '',
            branch_id: user?.branch_id || '',
            promotion_type: 'nxm',
            buy_quantity: 2,
            pay_quantity: 1,
            discount_percentage: 50,
            bundle_price: 10,
            start_date: '',
            end_date: '',
            days_of_week: [1, 2, 3, 4, 5, 6, 7],
            max_applications_per_sale: '',
            is_cumulative: false,
            active: true,
            selectedProducts: []
        });
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (promo) => {
        setEditingPromotion(promo);
        const days = promo.days_of_week
            ? (typeof promo.days_of_week === 'string' ? promo.days_of_week.split(',').map(d => parseInt(d.trim(), 10)) : promo.days_of_week)
            : [1, 2, 3, 4, 5, 6, 7];

        setFormData({
            name: promo.name || '',
            description: promo.description || '',
            branch_id: promo.branch_id || '',
            promotion_type: promo.promotion_type || 'nxm',
            buy_quantity: parseFloat(promo.buy_quantity) || 2,
            pay_quantity: parseFloat(promo.pay_quantity) || 1,
            discount_percentage: promo.discount_percentage ? parseFloat(promo.discount_percentage) : 50,
            bundle_price: promo.bundle_price ? parseFloat(promo.bundle_price) : 10,
            start_date: promo.start_date ? promo.start_date.substring(0, 10) : '',
            end_date: promo.end_date ? promo.end_date.substring(0, 10) : '',
            days_of_week: days,
            max_applications_per_sale: promo.max_applications_per_sale || '',
            is_cumulative: Boolean(promo.is_cumulative),
            active: Boolean(promo.active),
            selectedProducts: promo.products || []
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (promo) => {
        const ok = await confirm({
            title: '¿Eliminar promoción?',
            message: `¿Estás seguro de que deseas eliminar la promoción "${promo.name}"? Los productos vinculados dejarán de recibir este beneficio en caja.`,
            confirmText: 'Sí, eliminar',
            cancelText: 'Cancelar',
            type: 'danger'
        });
        if (ok) {
            deleteMutation.mutate(promo.id);
        }
    };

    const toggleDay = (dayId) => {
        setFormData(prev => {
            const exists = prev.days_of_week.includes(dayId);
            const updated = exists 
                ? prev.days_of_week.filter(d => d !== dayId)
                : [...prev.days_of_week, dayId];
            return { ...prev, days_of_week: updated.sort() };
        });
    };

    const handleAddProduct = (_e, option) => {
        const item = option || (_e?.id ? _e : null);
        if (!item || !item.id) return;
        const exists = formData.selectedProducts.some(p => p.id === item.id);
        if (exists) {
            toast.info('Este producto ya está agregado a la promoción');
            return;
        }
        setFormData(prev => ({
            ...prev,
            selectedProducts: [
                ...prev.selectedProducts,
                {
                    id: item.id,
                    codigo: item.codigo || item.codigo_barra || '',
                    nombre: item.nombre || item.descripcion || 'Sin nombre',
                    precio_unitario: item.precio_unitario || 0
                }
            ]
        }));
    };

    const handleRemoveProduct = (productId) => {
        setFormData(prev => ({
            ...prev,
            selectedProducts: prev.selectedProducts.filter(p => p.id !== productId)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            return toast.error('El nombre de la promoción es obligatorio');
        }

        if (formData.selectedProducts.length === 0) {
            return toast.error('Debe agregar al menos un producto participante');
        }

        if (formData.days_of_week.length === 0) {
            return toast.error('Debe seleccionar al menos un día de la semana');
        }

        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            branch_id: formData.branch_id || null,
            promotion_type: formData.promotion_type,
            buy_quantity: parseFloat(formData.buy_quantity) || 1,
            pay_quantity: parseFloat(formData.pay_quantity) || 1,
            discount_percentage: formData.promotion_type === 'second_unit_discount' || formData.promotion_type === 'volume_tier'
                ? parseFloat(formData.discount_percentage) || null
                : null,
            bundle_price: formData.promotion_type === 'bundle_fixed_price'
                ? parseFloat(formData.bundle_price) || null
                : null,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            days_of_week: formData.days_of_week.join(','),
            max_applications_per_sale: formData.max_applications_per_sale ? parseInt(formData.max_applications_per_sale, 10) : null,
            is_cumulative: formData.is_cumulative,
            active: formData.active,
            product_ids: formData.selectedProducts.map(p => p.id)
        };

        saveMutation.mutate(payload);
    };

    // Previsualización dinámica de la fórmula
    const previewText = useMemo(() => {
        const buy = formData.buy_quantity;
        const pay = formData.pay_quantity;
        const pct = formData.discount_percentage;
        const price = formData.bundle_price;

        switch (formData.promotion_type) {
            case 'nxm':
                return `El cliente lleva ${buy} unidades y solo paga ${pay} (Ahorro del 100% en ${buy - pay} unidad/es por cada grupo).`;
            case 'second_unit_discount':
                return `Por cada ${buy} unidad(es) a precio regular, la siguiente unidad recibe un ${pct}% de descuento directo.`;
            case 'bundle_fixed_price':
                return `Cada grupo de ${buy} unidades se cobra a un precio cerrado de $${parseFloat(price || 0).toFixed(2)} en total.`;
            case 'volume_tier':
                return `Al comprar ${buy} o más unidades, todas las unidades de la línea reciben un ${pct}% de descuento.`;
            default:
                return '';
        }
    }, [formData.promotion_type, formData.buy_quantity, formData.pay_quantity, formData.discount_percentage, formData.bundle_price]);

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-300 pb-24">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                                Promociones Comerciales
                            </h1>
                            <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
                                Configuración de ofertas 2x1, segunda unidad con descuento, paquetes cerrados y escalas
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="w-full sm:w-auto px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={16} />
                    Nueva Promoción
                </button>
            </div>

            {/* Banner Informativo Normativo */}
            <div className="bg-gradient-to-r from-indigo-50/90 via-slate-50 to-purple-50/80 p-5 rounded-3xl border border-indigo-100/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                        <Info size={20} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                            Aplicación Automática en POS y Cumplimiento DTE Hacienda
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-4xl font-medium">
                            Las promociones activas se detectan <strong>en tiempo real en el Terminal POS</strong> al acumular la cantidad requerida en el carrito. Para total cumplimiento con el Ministerio de Hacienda (DTE SV), el descuento se aplica sobre el campo tributario oficial <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-100 text-indigo-700 font-bold font-mono">montoDescu</code> y se desglosa visualmente en el ticket con sub-líneas claras para el cliente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400"
                    />
                </div>

                <div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
                    >
                        <option value="all">Todos los Tipos de Promoción</option>
                        <option value="nxm">N x M (2x1, 3x2...)</option>
                        <option value="second_unit_discount">Segunda Unidad con Descuento %</option>
                        <option value="bundle_fixed_price">Paquete Fijo (X por $Y)</option>
                        <option value="volume_tier">Escala por Volumen</option>
                    </select>
                </div>

                <div>
                    <select
                        value={filterBranchId}
                        onChange={(e) => setFilterBranchId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
                    >
                        <option value="">Todas las Sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
                    >
                        <option value="all">Todos los Estados</option>
                        <option value="active">Activas Vigentes</option>
                        <option value="inactive">Inactivas</option>
                        <option value="expired">Vencidas</option>
                    </select>
                </div>
            </div>

            {/* Tabla de Promociones */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <Table
                    headers={['Promoción / Mecánica', 'Tipo de Oferta', 'Productos Participantes', 'Vigencia y Días', 'Sucursal', 'Estado', 'Acciones']}
                    data={promotions}
                    isLoading={isLoading}
                    renderRow={(promo) => {
                        const typeInfo = PROMOTION_TYPES.find(t => t.id === promo.promotion_type) || PROMOTION_TYPES[0];
                        const TypeIcon = typeInfo.icon;

                        // Determinar vigencia
                        const now = new Date();
                        const isExpired = promo.end_date && new Date(promo.end_date) < now.setHours(0,0,0,0);
                        const isUpcoming = promo.start_date && new Date(promo.start_date) > now.setHours(23,59,59,999);

                        return (
                            <tr key={promo.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3">
                                    <div className="font-bold text-xs text-slate-900">{promo.name}</div>
                                    {promo.description && (
                                        <div className="text-[11px] text-slate-400 font-medium line-clamp-1">{promo.description}</div>
                                    )}
                                    <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                                        {promo.promotion_type === 'nxm' && `Lleva ${parseFloat(promo.buy_quantity)} paga ${parseFloat(promo.pay_quantity)}`}
                                        {promo.promotion_type === 'second_unit_discount' && `Segunda unidad al ${parseFloat(promo.discount_percentage)}%`}
                                        {promo.promotion_type === 'bundle_fixed_price' && `${parseFloat(promo.buy_quantity)} unidades por $${parseFloat(promo.bundle_price).toFixed(2)}`}
                                        {promo.promotion_type === 'volume_tier' && `A partir de ${parseFloat(promo.buy_quantity)} u: ${parseFloat(promo.discount_percentage)}% desc`}
                                    </div>
                                </td>

                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${typeInfo.badge}`}>
                                        <TypeIcon size={12} />
                                        {typeInfo.name}
                                    </span>
                                </td>

                                <td className="px-4 py-3">
                                    {promo.products && promo.products.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {promo.products.slice(0, 3).map(p => (
                                                <span key={p.id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-medium border border-slate-200">
                                                    {p.codigo || p.nombre}
                                                </span>
                                            ))}
                                            {promo.products.length > 3 && (
                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold">
                                                    +{promo.products.length - 3} más
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-slate-400 font-medium">Sin productos</span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-xs">
                                    <div className="text-[11px] font-medium text-slate-600">
                                        {promo.start_date || promo.end_date ? (
                                            <span>
                                                {promo.start_date ? promo.start_date.substring(0, 10) : 'Inicio'} → {promo.end_date ? promo.end_date.substring(0, 10) : 'Indefinido'}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">Permanente</span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {promo.days_of_week && promo.days_of_week.length < 13
                                            ? `Días: ${promo.days_of_week.split(',').map(d => DAYS_NAMES.find(dn => dn.id === parseInt(d, 10))?.label).join(', ')}`
                                            : 'Todos los días'
                                        }
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-xs font-medium text-slate-700">
                                    {promo.branch_name || (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                                            Todas las sucursales
                                        </span>
                                    )}
                                </td>

                                <td className="px-4 py-3">
                                    {!promo.active ? (
                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-100 text-slate-500">
                                            Inactiva
                                        </span>
                                    ) : isExpired ? (
                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                            Vencida
                                        </span>
                                    ) : isUpcoming ? (
                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                            Programada
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                            Activa
                                        </span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(promo)}
                                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                            title="Editar promoción"
                                        >
                                            <Edit size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(promo)}
                                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                            title="Eliminar promoción"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>

            {/* Modal de Creación / Edición */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editingPromotion ? 'Editar Promoción Comercial' : 'Crear Nueva Promoción'}
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                    {/* Selector de Tipo de Promoción (Cards) */}
                    <div>
                        <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                            Tipo de Promoción
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {PROMOTION_TYPES.map(type => {
                                const Icon = type.icon;
                                const isSelected = formData.promotion_type === type.id;
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, promotion_type: type.id }))}
                                        className={`p-3.5 rounded-2xl border text-left transition-all ${
                                            isSelected 
                                                ? 'bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm' 
                                                : 'bg-white hover:bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    <Icon size={14} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-900">{type.name}</span>
                                            </div>
                                            {isSelected && <Check size={14} className="text-indigo-600" />}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-snug">
                                            {type.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preview Dinámica */}
                    <div className="p-3.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-slate-50 rounded-2xl border border-indigo-200/80 flex items-center gap-3">
                        <Sparkles size={20} className="text-indigo-600 flex-shrink-0" />
                        <div className="text-xs text-indigo-950 font-bold leading-relaxed">
                            {previewText}
                        </div>
                    </div>

                    {/* Datos Generales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                Nombre de la Promoción *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Ej: 2x1 en Bebidas Energizantes, 2da al 50% en Snacks..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                Descripción o Bases (Opcional)
                            </label>
                            <textarea
                                rows={2}
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Detalles visibles para el cajero o restricciones..."
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                Sucursal Aplicable
                            </label>
                            <select
                                value={formData.branch_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            >
                                <option value="">Todas las Sucursales (Global)</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                Límite de Aplicaciones por Ticket
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder="Ilimitado si se deja vacío"
                                value={formData.max_applications_per_sale}
                                onChange={(e) => setFormData(prev => ({ ...prev, max_applications_per_sale: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                    </div>

                    {/* Parámetros Específicos según el Tipo */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
                        <div className="text-xs font-black uppercase text-slate-700 tracking-wider">
                            Regla y Valores de Descuento
                        </div>

                        {formData.promotion_type === 'nxm' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        Cantidad a Llevar (N)
                                    </label>
                                    <input
                                        type="number"
                                        min="2"
                                        required
                                        value={formData.buy_quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, buy_quantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-700"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ej: 2 para 2x1, 3 para 3x2</span>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        Cantidad a Pagar (M)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={formData.pay_quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, pay_quantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-700"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ej: 1 para 2x1, 2 para 3x2</span>
                                </div>
                            </div>
                        )}

                        {formData.promotion_type === 'second_unit_discount' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        Unidades a Precio Regular
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={formData.buy_quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, buy_quantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-700"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Normalmente 1 unidad</span>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        % Descuento en la Siguiente Unidad
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            required
                                            value={formData.discount_percentage}
                                            onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: e.target.value }))}
                                            className="w-full pl-4 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-600"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ej: 50% para "2da al 50%"</span>
                                </div>
                            </div>
                        )}

                        {formData.promotion_type === 'bundle_fixed_price' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        Cantidad de Unidades (Lote)
                                    </label>
                                    <input
                                        type="number"
                                        min="2"
                                        required
                                        value={formData.buy_quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, buy_quantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-amber-700"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ej: 3 unidades</span>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        Precio Total del Paquete ($)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            value={formData.bundle_price}
                                            onChange={(e) => setFormData(prev => ({ ...prev, bundle_price: e.target.value }))}
                                            className="w-full pl-7 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-amber-700"
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Precio cerrado por el lote</span>
                                </div>
                            </div>
                        )}

                        {formData.promotion_type === 'volume_tier' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        Cantidad Mínima (Escala)
                                    </label>
                                    <input
                                        type="number"
                                        min="2"
                                        required
                                        value={formData.buy_quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, buy_quantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-purple-700"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Ej: A partir de 6 unidades</span>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                        % de Descuento por Unidad
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            required
                                            value={formData.discount_percentage}
                                            onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: e.target.value }))}
                                            className="w-full pl-4 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-purple-700"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Aplica a todas las unidades</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Productos Participantes */}
                    <div className="space-y-2.5">
                        <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                            Productos Participantes ({formData.selectedProducts.length}) *
                        </label>
                        <SearchableSelect
                            key={`promo-product-select-${formData.branch_id || 'all'}`}
                            loadOptions={loadProductsOptions}
                            placeholder="Buscar y seleccionar producto para agregar a la promoción..."
                            valueKey="id"
                            labelKey="nombre"
                            codeKey="codigo"
                            codeLabel="CÓDIGO"
                            value=""
                            onChange={handleAddProduct}
                        />

                        {formData.selectedProducts.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-40 overflow-y-auto">
                                {formData.selectedProducts.map(p => (
                                    <span
                                        key={p.id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-800 border border-slate-200 shadow-sm"
                                    >
                                        <span>{p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveProduct(p.id)}
                                            className="text-slate-400 hover:text-rose-600 transition-colors ml-1"
                                        >
                                            <X size={13} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Fechas y Días de la Semana */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                Fecha de Inicio (Opcional)
                            </label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                                Fecha de Fin (Opcional)
                            </label>
                            <input
                                type="date"
                                value={formData.end_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                    </div>

                    {/* Selector de Días de la Semana */}
                    <div>
                        <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                            Días de la Semana Aplicables
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_NAMES.map(day => {
                                const isSelected = formData.days_of_week.includes(day.id);
                                return (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => toggleDay(day.id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                            isSelected 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Opciones de Estado */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                            <span className="text-xs font-bold text-slate-800 block">Promoción Activa</span>
                            <span className="text-[11px] text-slate-500 font-medium">Habilitada para aplicarse en cajas registradoras</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={formData.active}
                            onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                            className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                        />
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => { setIsModalOpen(false); resetForm(); }}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saveMutation.isPending}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-2xl text-xs transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {saveMutation.isPending ? 'Guardando...' : (editingPromotion ? 'Actualizar Promoción' : 'Crear Promoción')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Promotions;
