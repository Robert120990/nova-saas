import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, Trash2, Edit, Percent, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuth } from '../context/AuthContext';

const DiscountRules = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || '');
    const [selectedProductId, setSelectedProductId] = useState('');

    const { data: rules = [], isLoading } = useQuery({
        queryKey: ['discount-rules'],
        queryFn: async () => (await axios.get('/api/discount-rules')).data,
    });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data,
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products', 'simple', selectedBranchId],
        queryFn: async () => {
            const params = new URLSearchParams({ limit: '500', status: 'activo' });
            if (selectedBranchId) params.append('branch_id', selectedBranchId);
            return (await axios.get(`/api/products?${params}`)).data?.data || [];
        },
        enabled: !!selectedBranchId,
    });

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/discount-rules', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['discount-rules']);
            setIsModalOpen(false);
            setEditingRule(null);
            setSelectedProductId('');
            toast.success('Regla creada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al crear regla'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/discount-rules/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['discount-rules']);
            setIsModalOpen(false);
            setEditingRule(null);
            setSelectedProductId('');
            toast.success('Regla actualizada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/discount-rules/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['discount-rules']);
            toast.success('Regla eliminada');
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const data = {
            product_id: selectedProductId || editingRule?.product_id,
            discount_type: form.get('discount_type'),
            discount_value: parseFloat(form.get('discount_value')),
            start_date: form.get('start_date') || null,
            end_date: form.get('end_date') || null,
            active: form.get('active') === '1' ? 1 : 0,
        };

        if (!data.product_id) return toast.error('Seleccione un producto');

        if (editingRule) {
            updateMutation.mutate({ id: editingRule.id, ...data });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Reglas de Descuento</h1>
                    <p className="text-slate-500 font-medium">Gestión de descuentos por producto</p>
                </div>
                <button
                    onClick={() => { setEditingRule(null); setSelectedProductId(''); setSelectedBranchId(user?.branch_id || ''); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg"
                >
                    <Plus size={16} /> Nueva Regla
                </button>
            </div>

            <Table
                headers={['Producto', 'Tipo', 'Valor', 'Vigencia', 'Estado', 'Acciones']}
                data={rules}
                isLoading={isLoading}
                renderRow={(rule) => (
                    <tr key={rule.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                            <p className="font-bold text-sm text-slate-800">{rule.product_name || 'Producto ' + rule.product_id}</p>
                            <p className="text-[10px] text-slate-400">{rule.product_code}</p>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${rule.discount_type === 'percentage' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                                {rule.discount_type === 'percentage' ? <Percent size={12} /> : <DollarSign size={12} />}
                                {rule.discount_type === 'percentage' ? 'Porcentaje' : 'Fijo'}
                            </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-sm">
                            {rule.discount_type === 'percentage' ? `${parseFloat(rule.discount_value)}%` : `$${parseFloat(rule.discount_value).toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                            {rule.start_date || rule.end_date ? (
                                <span>{rule.start_date || '—'} → {rule.end_date || 'Indefinido'}</span>
                            ) : 'Indefinido'}
                        </td>
                        <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${rule.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {rule.active ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setEditingRule(rule); setSelectedProductId(rule.product_id); setIsModalOpen(true); }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                >
                                    <Edit size={14} />
                                </button>
                                <button
                                    onClick={() => { if (confirm('¿Eliminar esta regla?')) deleteMutation.mutate(rule.id); }}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </td>
                    </tr>
                )}
            />

            <Modal
                isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setEditingRule(null); setSelectedProductId(''); }}
                    title={editingRule ? 'Editar Regla' : 'Nueva Regla de Descuento'}
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Sucursal</label>
                        <select
                            value={selectedBranchId}
                            onChange={(e) => { setSelectedBranchId(e.target.value); setProductSearch(''); }}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                        >
                            <option value="">Seleccionar sucursal</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Producto</label>
                        <SearchableSelect
                            options={products}
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                            placeholder="Buscar producto..."
                            valueKey="id"
                            labelKey="nombre"
                            codeKey="codigo"
                        />
                        {!selectedBranchId && (
                            <p className="text-[9px] text-amber-600 mt-1">Seleccione una sucursal para ver productos</p>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Tipo de Descuento</label>
                        <select
                            name="discount_type"
                            defaultValue={editingRule?.discount_type || 'percentage'}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                        >
                            <option value="percentage">Porcentaje (%)</option>
                            <option value="fixed">Monto Fijo ($)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Valor</label>
                        <input
                            name="discount_value"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={editingRule?.discount_value || 0}
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Inicio</label>
                            <input
                                name="start_date"
                                type="date"
                                defaultValue={editingRule?.start_date?.split('T')[0] || ''}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Caducidad</label>
                            <input
                                name="end_date"
                                type="date"
                                defaultValue={editingRule?.end_date?.split('T')[0] || ''}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                name="active"
                                type="checkbox"
                                value="1"
                                defaultChecked={editingRule ? editingRule.active : true}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                            />
                            <span className="text-xs font-bold text-slate-600">Regla activa</span>
                        </label>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => { setIsModalOpen(false); setEditingRule(null); setSelectedProductId(''); }} className="flex-1 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                        <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black uppercase text-xs">Guardar</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DiscountRules;
