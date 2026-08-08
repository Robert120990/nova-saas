import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';

const GasExpenseCategories = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['gas-expense-categories', user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/expense-categories')).data
    });

    const filtered = items.filter(i => !searchTerm || i.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedItem) return axios.put(`/api/gas-station/expense-categories/${selectedItem.id}`, data);
            return axios.post('/api/gas-station/expense-categories', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-expense-categories']);
            setIsModalOpen(false);
            setSelectedItem(null);
            toast.success(selectedItem ? 'Rubro actualizado' : 'Rubro creado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/expense-categories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-expense-categories']);
            toast.success('Rubro eliminado');
        }
    });

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar rubro?',
            message: 'Este rubro será eliminado permanentemente.',
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
                    <h2 className="text-xl font-bold text-slate-900">Rubros de Gastos</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Catálogos</p>
                </div>
                <button
                    onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Rubro</span>
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
                    headers={['Nombre', 'Acciones']}
                    data={filtered}
                    isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg"><Receipt size={12}/></div>
                                    <span className="font-bold text-xs text-slate-900">{item.name}</span>
                                </div>
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15}/></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15}/></button>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedItem ? 'Editar Rubro' : 'Nuevo Rubro de Gasto'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Nombre <span className="text-red-400">*</span></label>
                        <input
                            name="name"
                            defaultValue={selectedItem?.name}
                            required
                            placeholder="Ej: Electricidad, Agua, Alquiler..."
                            className={fieldCls}
                        />
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

export default GasExpenseCategories;
