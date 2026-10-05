import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import { Plus, Edit, Trash2, Barcode, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Pagination from '../components/ui/Pagination';
import Money from '../components/ui/Money';
import { unwrapList } from '../utils/apiUtils';
import { ComboModal } from '../components/combos';

const Combos = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCombo, setSelectedCombo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['combos', debouncedSearch, page, limit],
        queryFn: async () => (await axios.get('/api/combos', { params: { search: debouncedSearch, page, limit } })).data
    });

    const combos = response.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedCombo) return axios.put(`/api/combos/${selectedCombo.id}`, data);
            return axios.post('/api/combos', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['combos']);
            setIsModalOpen(false);
            setSelectedCombo(null);
            toast.success(selectedCombo ? 'Combo actualizado' : 'Combo creado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar el combo');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/combos/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['combos']);
            toast.success('Combo eliminado');
        }
    });

    const handleDeleteCombo = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar combo?',
            message: 'Este combo será eliminado permanentemente del catálogo. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Combos de Productos</h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Gestiona paquetes y promociones especiales</p>
                </div>
                <button 
                    onClick={() => { setSelectedCombo(null); setIsModalOpen(true); }}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 w-full md:w-auto"
                >
                    <Plus size={20}/>
                    <span>Nuevo Combo</span>
                </button>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o código de barras..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Sucursal', 'Código / Barras', 'Combo', 'Items', 'Precio Final', 'Acciones']}
                    data={combos}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-6 py-4">
                                <div className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-wider inline-block">
                                    {c.branch_name || 'Global'}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono font-bold"><Barcode size={10}/> {c.barcode}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{c.name}</div>
                                <div className="text-xs text-slate-500 truncate max-w-xs">{c.description}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                    {(Array.isArray(c.items) ? c.items : []).map((item, i) => (
                                        <span key={i} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                            {item.quantity}x {item.product_name}
                                        </span>
                                    ))}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-black text-indigo-600"><Money value={c.price} /></div>
                                <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">IVA Incluido</div>
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => { setSelectedCombo(c); setIsModalOpen(true); }} className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => handleDeleteCombo(c.id)} className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    )}
                    renderCard={(c) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 truncate">{c.name}</h4>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono font-bold mt-0.5">
                                        <Barcode size={10} /> {c.barcode}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-sm font-black text-indigo-600"><Money value={c.price} /></div>
                                    <div className="text-[8px] text-slate-400 uppercase font-black tracking-widest">IVA Incluido</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    {c.branch_name || 'Global'}
                                </span>
                            </div>

                            {c.description && (
                                <p className="text-xs text-slate-500 truncate">{c.description}</p>
                            )}

                            <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                                {(Array.isArray(c.items) ? c.items : []).map((item, i) => (
                                    <span key={i} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                        {item.quantity}x {item.product_name}
                                    </span>
                                ))}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button onClick={() => { setSelectedCombo(c); setIsModalOpen(true); }} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-100">
                                    <Edit size={14} /> Editar
                                </button>
                                <button onClick={() => handleDeleteCombo(c.id)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-rose-100">
                                    <Trash2 size={14} /> Eliminar
                                </button>
                            </div>
                        </div>
                    )}
                />
            </div>

            <Pagination 
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={combos.length}
                isLoading={isLoading}
                limit={limit}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />

            <ComboModal 
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedCombo(null); }}
                selectedCombo={selectedCombo}
                branches={branches}
                onSubmit={(data) => mutation.mutate(data)}
            />
        </div>
    );
};

export default Combos;
