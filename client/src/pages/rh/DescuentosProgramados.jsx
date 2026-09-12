import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Wallet, Link as LinkIcon } from 'lucide-react';

const DescuentosProgramados = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-descuentos', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/rh/descuentos-programados', { params: { search: debouncedSearch, page } })).data
    });

    const { data: cuentasDeduccion = [] } = useQuery({
        queryKey: ['rh-cuentas-deducciones-all'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/cuentas-planillas', { params: { limit: 1000 } });
            const all = res.data?.data || [];
            return all.filter(c => c.operacion === 'restar' && c.activa);
        }
    });

    const items = response.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/descuentos-programados/${selected.id}`, data);
            return axios.post('/api/rh/descuentos-programados', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-descuentos'] });
            setIsModalOpen(false);
            setSelected(null);
            toast.success(selected ? 'Descuento actualizado' : 'Descuento creado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar descuento');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/descuentos-programados/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-descuentos'] }); toast.success('Descuento eliminado'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const handleDelete = async (id) => {
        const ok = await confirm({ title: '¿Eliminar descuento?', message: 'Este descuento será eliminado permanentemente.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        if (!data.cuenta_id) data.cuenta_id = null;
        mutation.mutate(data);
    };

    const cls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const lbl = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Descuentos Programados</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Catálogo de descuentos fijos recurrentes (Préstamos, PGR, FSV, etc.)</p>
                </div>
                <button onClick={() => { setSelected(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nuevo Descuento</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Buscar por código, nombre o cuenta..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Código', 'Descripción', 'Cuenta de Deducción Asociada', 'Acciones']} data={items} isLoading={isLoading} renderRow={(item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg"><Wallet size={12} /></div>
                                <span className="font-bold text-xs text-slate-900">{item.codigo}</span>
                            </div>
                        </td>
                        <td className="px-3 py-1.5 text-xs font-semibold text-slate-700">{item.descripcion}</td>
                        <td className="px-3 py-1.5">
                            {item.cuenta_descripcion ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                                    <LinkIcon size={11} className="text-amber-600" />
                                    {item.cuenta_codigo} - {item.cuenta_descripcion}
                                </span>
                            ) : (
                                <span className="text-[11px] text-slate-400 italic">Sin cuenta vinculada</span>
                            )}
                        </td>
                        <td className="px-3 py-1.5 flex gap-1">
                            <button onClick={() => { setSelected(item); setIsModalOpen(true); }} className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar"><Edit size={15} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                        </td>
                    </tr>
                )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total} onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selected ? 'Editar Descuento Programado' : 'Nuevo Descuento Programado'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={lbl}>Código</label>
                        <input name="codigo" defaultValue={selected?.codigo} required placeholder="01" className={cls} />
                    </div>
                    <div>
                        <label className={lbl}>Descripción</label>
                        <input name="descripcion" defaultValue={selected?.descripcion} required placeholder="Ej: Pago de Préstamo" className={cls} />
                    </div>
                    <div>
                        <label className={lbl}>Cuenta de Planilla de Deducción (Opcional pero recomendado)</label>
                        <select name="cuenta_id" defaultValue={selected?.cuenta_id || ''} className={cls}>
                            <option value="">-- Seleccionar cuenta de deducción en planilla --</option>
                            {cuentasDeduccion.map(c => (
                                <option key={c.id} value={c.id}>{c.codigo} - {c.descripcion}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                            La planilla acumulará las cuotas activas de este descuento en la cuenta contable seleccionada.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selected ? 'Guardar Cambios' : 'Registrar Descuento')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default DescuentosProgramados;
