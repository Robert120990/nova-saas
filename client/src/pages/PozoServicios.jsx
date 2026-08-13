import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { Plus, Edit, Trash2, Wrench, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { useAuth } from '../context/AuthContext';
import Money, { MoneyInput } from '../components/ui/Money';

const PozoServicios = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [codigo, setCodigo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [monto, setMonto] = useState('');

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const { data, isLoading } = useQuery({
        queryKey: ['pozo-servicios', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/pozo/servicios', {
            params: { search: debouncedSearch || undefined, page, limit: 15 }
        })).data
    });

    const servicios = data?.data || [];
    const total = data?.total || 0;
    const totalPages = data?.totalPages || 0;

    const mutation = useMutation({
        mutationFn: (payload) => {
            if (selectedItem) return axios.put(`/api/pozo/servicios/${selectedItem.id}`, payload);
            return axios.post('/api/pozo/servicios', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-servicios'] });
            closeModal();
            toast.success(selectedItem ? 'Servicio actualizado' : 'Servicio creado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/pozo/servicios/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-servicios'] });
            toast.success('Servicio eliminado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar servicio?',
            message: 'Este servicio será eliminado permanentemente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const openNew = () => {
        setSelectedItem(null);
        setCodigo('');
        setDescripcion('');
        setMonto('');
        setIsModalOpen(true);
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        setCodigo(item.codigo || '');
        setDescripcion(item.descripcion || '');
        setMonto(String(item.monto ?? ''));
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedItem(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate({ codigo: codigo.trim(), descripcion: descripcion.trim(), monto });
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Wrench size={22} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Servicios del Pozo</h2>
                        <p className="text-slate-500 text-[11px] font-medium">Control de Pozo — Catálogos</p>
                        {user?.branch_name && <p className="text-[10px] font-bold text-indigo-500 mt-0.5">Sucursal: {user.branch_name}</p>}
                    </div>
                </div>
                <button
                    onClick={openNew}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Nuevo Servicio</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por código o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Código', 'Descripción', 'Monto', 'Acciones']}
                    data={servicios}
                    isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg"><Wrench size={12} /></div>
                                    <span className="font-bold text-xs text-slate-900">{item.codigo}</span>
                                </div>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600">{item.descripcion}</td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.monto} /></span>
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit size={15} /></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )}
                />
                {totalPages > 1 && (
                    <div className="px-2">
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            totalItems={total}
                            itemsOnPage={servicios.length}
                            onPageChange={setPage}
                            limit={15}
                        />
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={selectedItem ? 'Editar Servicio' : 'Nuevo Servicio'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelCls}>Código <span className="text-red-400">*</span></label>
                        <input
                            value={codigo}
                            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                            required
                            placeholder="Ej: PZ-001"
                            className={fieldCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Descripción</label>
                        <input
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
                            placeholder="Descripción del servicio"
                            className={fieldCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Monto <span className="text-red-400">*</span></label>
                        <MoneyInput
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            placeholder="0.00"
                            required
                            className={fieldCls}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selectedItem ? 'Guardar Cambios' : 'Registrar')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PozoServicios;
