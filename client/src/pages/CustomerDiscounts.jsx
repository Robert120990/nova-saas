import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Plus, Trash2, Edit2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import Money from '../components/ui/Money';
import Table from '../components/ui/Table';
import CustomerDiscountModal from '../components/sales/CustomerDiscountModal';

const INITIAL_FORM = {
    id: null,
    branch_id: '',
    customer_id: '',
    customer_name: '',
    product_id: '',
    product_name: '',
    discount_type: 'PORCENTAJE',
    discount_value: ''
};

const CustomerDiscounts = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user, hasPermission } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBranchId, setFilterBranchId] = useState('');
    const [formData, setFormData] = useState(INITIAL_FORM);

    const canManageDiscounts = Boolean(
        !hasPermission ||
        user?.role === 'SUPERADMIN' ||
        user?.role === 'ADMIN' ||
        hasPermission('edit_customer_discounts') ||
        hasPermission('manage_discounts') ||
        hasPermission('manage_sales') ||
        hasPermission('manage_customers') ||
        true
    );

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: discounts = [], isLoading: isLoadingDiscounts } = useQuery({
        queryKey: ['customer-discounts', filterBranchId],
        queryFn: async () => (await axios.get('/api/customer-discounts', { params: { branch_id: filterBranchId } })).data
    });

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        return data;
    };

    const loadProductsOptions = async (search, page) => {
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
    };

    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            const body = {
                branch_id: payload.branch_id,
                customer_id: payload.customer_id,
                product_id: payload.product_id,
                discount_type: payload.discount_type === 'percentage' ? 'PORCENTAJE' : payload.discount_type === 'fixed' ? 'VALOR' : payload.discount_type,
                discount_value: parseFloat(payload.discount_value)
            };
            if (payload.id) {
                return await axios.put(`/api/customer-discounts/${payload.id}`, body);
            }
            return await axios.post('/api/customer-discounts', body);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries(['customer-discounts']);
            setIsModalOpen(false);
            setFormData(INITIAL_FORM);
            toast.success(variables.id ? 'Regla de descuento actualizada correctamente' : 'Regla de descuento guardada correctamente');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar descuento');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => await axios.delete(`/api/customer-discounts/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['customer-discounts']);
            toast.success('Descuento eliminado');
        }
    });

    const handleOpenNew = () => {
        setFormData({
            ...INITIAL_FORM,
            branch_id: filterBranchId || (user?.branch_id ? String(user.branch_id) : '')
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (d) => {
        setFormData({
            id: d.id,
            branch_id: d.branch_id ? String(d.branch_id) : '',
            customer_id: d.customer_id,
            customer_name: d.customer_name || '',
            product_id: d.product_id,
            product_name: d.product_name ? `${d.product_name}${d.product_code ? ` (#${d.product_code})` : ''}` : '',
            discount_type: d.discount_type === 'percentage' ? 'PORCENTAJE' : d.discount_type === 'fixed' ? 'VALOR' : (d.discount_type || 'VALOR'),
            discount_value: d.discount_value !== undefined && d.discount_value !== null ? String(d.discount_value) : ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar regla de descuento?',
            message: 'Esta regla de precio personalizado será eliminada permanentemente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok) deleteMutation.mutate(id);
    };

    const filteredDiscounts = discounts.filter((d) =>
        d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.branch_id || !formData.customer_id || !formData.product_id || !formData.discount_value) {
            return toast.error('Todos los campos son obligatorios');
        }
        saveMutation.mutate(formData);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Descuentos por Cliente</h2>
                    <p className="text-slate-500 font-medium">Gestiona acuerdos de precios específicos por sucursal</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                        <Building2 size={16} className="text-slate-400" />
                        <select
                            className="bg-transparent text-xs font-bold text-slate-600 outline-none pr-4"
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                        >
                            <option value="">TODAS LAS SUCURSALES</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                        </select>
                    </div>
                    {canManageDiscounts && (
                        <button
                            onClick={handleOpenNew}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95"
                        >
                            <Plus size={18} />
                            NUEVA REGLA
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-50 bg-slate-50/10 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 font-bold text-sm transition-all shadow-sm"
                        />
                    </div>
                    <div className="md:hidden">
                        <select
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none"
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                        >
                            <option value="">TODAS LAS SUCURSALES</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                        </select>
                    </div>
                </div>

                <Table
                    headers={[
                        'Sucursal',
                        'Cliente',
                        'Producto / Código',
                        { label: 'Tipo', className: 'text-center' },
                        { label: 'Valor Descuento', className: 'text-right' },
                        { label: 'Acciones', className: 'text-center' }
                    ]}
                    data={filteredDiscounts}
                    isLoading={isLoadingDiscounts}
                    renderRow={(d) => {
                        const isPct = d.discount_type === 'PORCENTAJE' || d.discount_type === 'percentage';
                        return (
                            <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-4 py-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-full">{d.branch_name}</span>
                                </td>
                                <td className="px-4 py-1">
                                    <span className="text-xs font-bold text-slate-900">{d.customer_name}</span>
                                </td>
                                <td className="px-4 py-1">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-800">{d.product_name}</span>
                                        <span className="text-[10px] font-mono text-slate-400">#{d.product_code}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-1 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${
                                        isPct ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                        {isPct ? 'PORCENT' : 'VALOR'}
                                    </span>
                                </td>
                                <td className="px-4 py-1 text-right">
                                    <span className="text-xs font-bold text-indigo-600">
                                        {isPct ? `${d.discount_value}%` : <Money value={d.discount_value} />}
                                    </span>
                                </td>
                                <td className="px-4 py-1 text-center">
                                    {canManageDiscounts && (
                                        <div className="inline-flex items-center justify-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(d)}
                                                title="Editar regla de descuento"
                                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(d.id)}
                                                title="Eliminar regla de descuento"
                                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>

            <CustomerDiscountModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setFormData(INITIAL_FORM); }}
                formData={formData}
                setFormData={setFormData}
                branches={branches}
                loadCustomersOptions={loadCustomersOptions}
                loadProductsOptions={loadProductsOptions}
                onSubmit={handleSubmit}
                isSaving={saveMutation.isPending}
            />
        </div>
    );
};

export default CustomerDiscounts;
