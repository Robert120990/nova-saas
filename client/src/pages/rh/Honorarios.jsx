import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { IMaskInput } from 'react-imask';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, FileSignature } from 'lucide-react';
import { MoneyInput } from '../../components/ui/Money';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const roCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-700";

const Honorarios = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Form
    const [numero, setNumero] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));
    const [nombre, setNombre] = useState('');
    const [numDui, setNumDui] = useState('');
    const [numNit, setNumNit] = useState('');
    const [concepto, setConcepto] = useState('');
    const [monto, setMonto] = useState(0);

    // Auto-calculated
    const rentaIsr = Math.round((parseFloat(monto || 0) * 0.10) * 100) / 100;
    const liquidoPagar = Math.round((parseFloat(monto || 0) - rentaIsr) * 100) / 100;

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-honorarios', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/rh/honorarios', {
            params: { search: debouncedSearch, page }
        })).data
    });

    const items = response.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/honorarios/${selected.id}`, data);
            return axios.post('/api/rh/honorarios', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-honorarios'] });
            setIsModalOpen(false);
            resetForm();
            toast.success(selected ? 'Honorario actualizado' : 'Honorario creado');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar honorario');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/honorarios/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-honorarios'] }); toast.success('Honorario eliminado'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const handleDelete = async (id) => {
        const ok = await confirm({ title: 'Eliminar honorario?', message: 'Este honorario sera eliminado permanentemente.', confirmLabel: 'Si, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleDownloadPDF = async (id) => {
        try {
            const res = await axios.get(`/api/rh/honorarios/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Honorario_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF descargado');
        } catch { toast.error('Error al descargar PDF'); }
    };

    const fetchNextCode = async () => {
        try {
            const res = await axios.get('/api/rh/honorarios/next-code');
            setNumero(res.data.numero);
        } catch { setNumero(''); }
    };

    const resetForm = () => {
        setSelected(null);
        setNumero('');
        setFecha(new Date().toISOString().substring(0, 10));
        setNombre('');
        setNumDui('');
        setNumNit('');
        setConcepto('');
        setMonto(0);
    };

    const handleEdit = (item) => {
        setSelected(item);
        setNumero(item.numero);
        setFecha(item.fecha ? item.fecha.substring(0, 10) : '');
        setNombre(item.nombre || '');
        setNumDui(item.num_dui || '');
        setNumNit(item.num_nit || '');
        setConcepto(item.concepto || '');
        setMonto(parseFloat(item.monto) || 0);
        setIsModalOpen(true);
    };

    const handleNew = async () => {
        resetForm();
        await fetchNextCode();
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!nombre.trim()) return toast.error('El nombre es requerido');
        if (!numero) return toast.error('Numero de honorario requerido');

        mutation.mutate({
            numero,
            fecha,
            nombre,
            num_dui: numDui,
            num_nit: numNit,
            concepto,
            monto: parseFloat(monto) || 0,
            renta_isr: rentaIsr,
            liquido_pagar: liquidoPagar
        });
    };

    const fmtDate = (d) => {
        if (!d) return '-';
        const date = d instanceof Date ? d : new Date(d + 'T00:00:00');
        if (isNaN(date.getTime())) return String(d);
        const dd = String(date.getUTCDate()).padStart(2, '0');
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = date.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    return (
        <div className="space-y-3 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Honorarios y Servicios</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gestion de recibos de honorarios profesionales</p>
                </div>
                <button onClick={handleNew}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nuevo Honorario</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Buscar por nombre, DUI, NIT..." value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['No.', 'Fecha', 'Nombre', 'DUI/NIT', 'Concepto', 'Monto', 'ISR (10%)', 'Liquido', 'Acciones']}
                    data={items} isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-mono font-bold text-indigo-500">{item.numero}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs text-slate-600">{fmtDate(item.fecha)}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-900">{item.nombre}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-[10px] text-slate-500">{item.num_dui || '-'}{item.num_nit ? ` / ${item.num_nit}` : ''}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs text-slate-600 max-w-[200px] truncate block">{item.concepto || '-'}</span>
                            </td>
                            <td className="px-3 py-1 text-right text-xs font-bold text-slate-700">${parseFloat(item.monto).toFixed(2)}</td>
                            <td className="px-3 py-1 text-right text-xs text-red-600 font-bold">${parseFloat(item.renta_isr).toFixed(2)}</td>
                            <td className="px-3 py-1 text-right text-xs font-bold text-emerald-600">${parseFloat(item.liquido_pagar).toFixed(2)}</td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                                <button onClick={() => handleDownloadPDF(item.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></button>
                                <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                            </td>
                        </tr>
                    )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total}
                onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={selected ? 'Editar Honorario' : 'Nuevo Honorario'} maxWidth="max-w-3xl">
                <form onSubmit={handleSubmit} className="space-y-4 pb-4">
                    <div className="grid grid-cols-6 gap-3">
                        <div>
                            <label className={labelCls}>No.</label>
                            <div className={`${roCls} font-mono font-bold text-indigo-600`}>{numero || '---'}</div>
                        </div>
                        <div className="col-span-2">
                            <label className={labelCls}>Fecha</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={fieldCls} />
                        </div>
                        <div className="col-span-3">
                            <label className={labelCls}>Nombre</label>
                            <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Nombre del profesional" className={fieldCls} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>DUI</label>
                            <IMaskInput mask="00000000-0" value={numDui} onAccept={(val) => setNumDui(val)} placeholder="00000000-0" className={fieldCls} lazy={false} />
                        </div>
                        <div>
                            <label className={labelCls}>NIT</label>
                            <IMaskInput mask="0000-000000-000-0" value={numNit} onAccept={(val) => setNumNit(val)} placeholder="0000-000000-000-0" className={fieldCls} lazy={false} />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Concepto</label>
                        <textarea value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Descripcion del servicio profesional" className={`${fieldCls} h-20 resize-none`} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelCls}>Monto ($)</label>
                            <MoneyInput value={monto || ''} onChange={e => setMonto(parseFloat(e.target.value) || 0)} step="0.01" min="0" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Renta ISR (10%)</label>
                            <div className={`${roCls} font-bold text-red-600`}>${rentaIsr.toFixed(2)}</div>
                        </div>
                        <div>
                            <label className={labelCls}>Liquido a Pagar</label>
                            <div className={`${roCls} font-black text-base text-emerald-600`}>${liquidoPagar.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }}
                            className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selected ? 'Guardar Cambios' : 'Registrar Honorario')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Honorarios;
