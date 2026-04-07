import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Tag, 
    Search, 
    Plus, 
    Trash2, 
    User, 
    Package, 
    Percent, 
    DollarSign,
    Filter,
    X,
    Building2
} from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';

const CustomerDiscounts = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBranchId, setFilterBranchId] = useState('');
    
    const [formData, setFormData] = useState({
        branch_id: '',
        customer_id: '',
        product_id: '',
        discount_type: 'PORCENTAJE',
        discount_value: ''
    });

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: discounts = [], isLoading: isLoadingDiscounts } = useQuery({
        queryKey: ['customer-discounts', filterBranchId],
        queryFn: async () => (await axios.get('/api/customer-discounts', { params: { branch_id: filterBranchId } })).data
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers-all'],
        queryFn: async () => (await axios.get('/api/customers', { params: { limit: 1000 } })).data?.data || []
    });

    // We fetch products based on the branch selected in the FORM
    const { data: products = [], isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-by-branch', formData.branch_id],
        queryFn: async () => {
            if (!formData.branch_id) return [];
            const res = await axios.get('/api/products', { 
                params: { 
                    limit: 2000, 
                    branch_id: formData.branch_id 
                } 
            });
            // Filter only active products
            return (res.data?.data || []).filter(p => p.status === 'activo');
        },
        enabled: !!formData.branch_id
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (newData) => {
            const data = {
                ...newData,
                discount_value: parseFloat(newData.discount_value)
            };
            return await axios.post('/api/customer-discounts', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['customer-discounts']);
            setIsModalOpen(false);
            setFormData({ branch_id: '', customer_id: '', product_id: '', discount_type: 'PORCENTAJE', discount_value: '' });
            toast.success('Regla de descuento guardada correctamente');
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

    const filteredDiscounts = discounts.filter(d => 
        d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.product_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.branch_id || !formData.customer_id || !formData.product_id || !formData.discount_value) {
            return toast.error('Todos los campos son obligatorios');
        }
        createMutation.mutate(formData);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header */}
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
                            {branches.map(b => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        <Plus size={18} />
                        NUEVA REGLA
                    </button>
                </div>
            </div>

            {/* List Table Card */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
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
                            {branches.map(b => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 italic">Sucursal</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Cliente</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Producto / Código</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Tipo</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Valor Descuento</th>
                                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center uppercase tracking-tighter">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoadingDiscounts ? (
                                <tr><td colSpan="6" className="px-8 py-20 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></td></tr>
                            ) : filteredDiscounts.length > 0 ? (
                                filteredDiscounts.map((d) => (
                                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded-md">{d.branch_name}</span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                                                    <User size={18} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-900 uppercase italic">{d.customer_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-700 uppercase">{d.product_name}</span>
                                                <span className="text-[10px] font-bold text-slate-400 font-mono italic">#{d.product_code}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${
                                                d.discount_type === 'PORCENTAJE' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                            }`}>
                                                {d.discount_type === 'PORCENTAJE' ? 'POCENT' : 'VALOR'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <span className="text-sm font-black text-indigo-600">
                                                {d.discount_type === 'PORCENTAJE' ? `${d.discount_value}%` : `$${parseFloat(d.discount_value).toFixed(2)}`}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4 text-center">
                                            <button 
                                                onClick={() => { if(window.confirm('¿Eliminar esta regla?')) deleteMutation.mutate(d.id); }}
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center text-slate-400 opacity-50">
                                        <div className="flex flex-col items-center gap-3">
                                            <Filter size={48} className="text-slate-200" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">No se encontraron reglas para esta selección</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none">Nueva Regla Personalizada</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configura un acuerdo comercial</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="bg-slate-100 p-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-all focus:outline-none">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-5">
                            <div className="grid grid-cols-1 gap-5">
                                {/* Branch Select */}
                                <div className="space-y-1.5 font-spanish">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Para la Sucursal</label>
                                    <select 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 font-bold text-sm transition-all"
                                        value={formData.branch_id}
                                        onChange={e => setFormData({...formData, branch_id: e.target.value, product_id: ''})}
                                    >
                                        <option value="">-- SELECCIONAR SUCURSAL --</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                {/* Customer Searchable Select */}
                                <div className="space-y-1.5 font-spanish">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Elegir Cliente</label>
                                    <SearchableSelect 
                                        placeholder="BUSCAR CLIENTE..."
                                        options={customers}
                                        value={formData.customer_id}
                                        onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                                        valueKey="id"
                                        labelKey="nombre"
                                        codeKey="numero_documento"
                                        codeLabel="DOC"
                                    />
                                </div>

                                {/* Product Searchable Select (Branches-Scoped) */}
                                <div className="space-y-1.5 font-spanish text-spanish">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Elegir Producto</label>
                                    <SearchableSelect 
                                        placeholder={!formData.branch_id ? "DEBE ELEGIR SUCURSAL PRIMERO..." : "BUSCAR PRODUCTO ACTIVO..."}
                                        options={products}
                                        value={formData.product_id}
                                        onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                                        valueKey="id"
                                        labelKey="nombre"
                                        codeKey="codigo"
                                        codeLabel="SKU"
                                        disabled={!formData.branch_id || isLoadingProducts}
                                    />
                                    {!formData.branch_id && <p className="text-[9px] font-bold text-rose-400 uppercase italic animate-pulse">Debe seleccionar una sucursal para listar los productos disponibles.</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-5 pt-2">
                                    <div className="space-y-1.5 font-spanish">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 uppercase">Tipo Descuento</label>
                                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, discount_type: 'PORCENTAJE'})}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${formData.discount_type === 'PORCENTAJE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                                <Percent size={14} /> %
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, discount_type: 'VALOR'})}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${formData.discount_type === 'VALOR' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                                            >
                                                <DollarSign size={14} /> VALOR
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 font-spanish">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Valor</label>
                                        <input 
                                            type="number"
                                            step="any"
                                            placeholder="0.00"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 font-bold text-sm transition-all"
                                            value={formData.discount_value}
                                            onChange={e => setFormData({...formData, discount_value: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 bg-slate-50/50 -mx-8 -mb-8 px-8 py-6 border-t border-slate-50 flex items-center gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={createMutation.isPending || !formData.branch_id}
                                    className="flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
                                >
                                    {createMutation.isPending ? 'Guardando...' : 'Aplicar Regla'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDiscounts;
