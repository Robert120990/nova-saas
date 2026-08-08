import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Truck, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/ui/Pagination';

const GasDistributors = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['gas-distributors', debouncedSearch, page, user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/distributors', { params: { search: debouncedSearch, page } })).data
    });

    const items = response.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedItem) return axios.put(`/api/gas-station/distributors/${selectedItem.id}`, data);
            return axios.post('/api/gas-station/distributors', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-distributors']);
            setIsModalOpen(false);
            setSelectedItem(null);
            toast.success(selectedItem ? 'Distribuidora actualizada' : 'Distribuidora creada');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/distributors/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-distributors']);
            toast.success('Distribuidora eliminada');
        }
    });

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar distribuidora?',
            message: 'Esta distribuidora será eliminada permanentemente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        mutation.mutate(data);
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Distribuidoras de Cupones</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Catálogos</p>
                </div>
                <button
                    onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nueva Distribuidora</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Código', 'Descripción', 'Acciones']}
                    data={items}
                    isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg"><Truck size={12}/></div>
                                    <span className="font-bold text-xs text-slate-900">{item.codigo}</span>
                                </div>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-500">{item.descripcion}</td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15}/></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15}/></button>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Pagination
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={items.length}
                isLoading={isLoading}
            />

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedItem ? 'Editar Distribuidora' : 'Nueva Distribuidora'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Código <span className="text-red-400">*</span></label>
                        <input
                            name="codigo"
                            defaultValue={selectedItem?.codigo}
                            required
                            maxLength={4}
                            placeholder="Máx. 4 dígitos"
                            className={`${fieldCls} uppercase`}
                            onChange={(e) => e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Descripción <span className="text-red-400">*</span></label>
                        <input name="descripcion" defaultValue={selectedItem?.descripcion} required placeholder="Nombre de la distribuidora" className={fieldCls} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selectedItem ? 'Guardar Cambios' : 'Registrar')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default GasDistributors;
