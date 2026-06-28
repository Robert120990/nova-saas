import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Receipt, X } from 'lucide-react';

const RentaConfig = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [detalles, setDetalles] = useState([]);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-renta-config', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/rh/renta-config', { params: { search: debouncedSearch, page } })).data
    });

    const items = response.data || [];

    const mutation = useMutation({
        mutationFn: (payload) => {
            if (selected) return axios.put(`/api/rh/renta-config/${selected.id}`, payload);
            return axios.post('/api/rh/renta-config', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-renta-config'] });
            setIsModalOpen(false);
            setSelected(null);
            setDetalles([]);
            toast.success(selected ? 'Configuración actualizada' : 'Configuración creada');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar configuración');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/renta-config/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-renta-config'] }); toast.success('Configuración eliminada'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const handleDelete = async (id) => {
        const ok = await confirm({ title: '¿Eliminar configuración?', message: 'Esta configuración de renta será eliminada permanentemente.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const openModal = async (item) => {
        setSelected(item);
        if (item) {
            try {
                const res = await axios.get(`/api/rh/renta-config/${item.id}`);
                setDetalles(res.data.detalles || []);
            } catch {
                setDetalles([]);
            }
        } else {
            setDetalles([{ sueldo_inicial: '', sueldo_final: '', porcentaje: '', valor_descuento: '', exceso: '' }]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelected(null);
        setDetalles([]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const payload = {
            tipo: fd.get('tipo'),
            fecha_desde: fd.get('fecha_desde'),
            fecha_hasta: fd.get('fecha_hasta') || null,
            detalles: detalles.map(d => ({
                sueldo_inicial: parseFloat(d.sueldo_inicial),
                sueldo_final: parseFloat(d.sueldo_final),
                porcentaje: parseFloat(d.porcentaje),
                valor_descuento: parseFloat(d.valor_descuento),
                exceso: parseFloat(d.exceso),
            }))
        };
        if (!payload.detalles.length) return toast.error('Agregue al menos un tramo');
        mutation.mutate(payload);
    };

    const addDetalle = () => {
        setDetalles([...detalles, { sueldo_inicial: '', sueldo_final: '', porcentaje: '', valor_descuento: '', exceso: '' }]);
    };

    const removeDetalle = (idx) => {
        setDetalles(detalles.filter((_, i) => i !== idx));
    };

    const updateDetalle = (idx, field, value) => {
        setDetalles(detalles.map((d, i) => i === idx ? { ...d, [field]: value } : d));
    };

    const cls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const lbl = "block text-xs font-semibold text-slate-500 mb-1";
    const inputSm = "w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs text-right";

    const formatDate = (date) => {
        if (!date) return 'Indefinido';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${day}/${month}/${year}`;
    };

    const tipoLabel = (tipo) => tipo === 'Q' ? 'Quincenal' : 'Mensual';

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Renta (ISR)</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Tramos de retención por rango de fechas</p>
                </div>
                <button onClick={() => openModal(null)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nueva Configuraci&oacute;n</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Tipo', 'Vigencia Desde', 'Vigencia Hasta', 'Acciones']} data={items} isLoading={isLoading} renderRow={(item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-amber-50 text-amber-600 rounded-lg"><Receipt size={12} /></div>
                                <span className="font-bold text-xs text-slate-900">{tipoLabel(item.tipo)}</span>
                            </div>
                        </td>
                        <td className="px-3 py-1 text-xs text-slate-500">{formatDate(item.fecha_desde)}</td>
                        <td className="px-3 py-1 text-xs text-slate-500">{formatDate(item.fecha_hasta)}</td>
                        <td className="px-3 py-1 flex gap-1">
                            <button onClick={() => openModal(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                        </td>
                    </tr>
                )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total} onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={selected ? 'Editar Configuración de Renta' : 'Nueva Configuración de Renta'} maxWidth="max-w-5xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={lbl}>Tipo</label>
                            <select name="tipo" defaultValue={selected?.tipo || 'Q'} required className={cls}>
                                <option value="Q">Quincenal</option>
                                <option value="M">Mensual</option>
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Vigencia Desde</label>
                            <input name="fecha_desde" type="date" defaultValue={selected?.fecha_desde?.split('T')[0] || ''} required className={cls} />
                        </div>
                        <div>
                            <label className={lbl}>Vigencia Hasta <span className="text-slate-400 font-normal">(opcional)</span></label>
                            <input name="fecha_hasta" type="date" defaultValue={selected?.fecha_hasta?.split('T')[0] || ''} className={cls} />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Tramos de Retención</label>
                            <button type="button" onClick={addDetalle} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                <Plus size={14} /> Agregar Tramo
                            </button>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="px-3 py-2 w-8">#</th>
                                        <th className="px-3 py-2">Sueldo Inicial</th>
                                        <th className="px-3 py-2">Sueldo Final</th>
                                        <th className="px-3 py-2 w-20">%</th>
                                        <th className="px-3 py-2">Valor Descuento</th>
                                        <th className="px-3 py-2">Exceso</th>
                                        <th className="px-3 py-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detalles.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-6 text-center text-xs text-slate-300">Sin tramos. Presione "Agregar Tramo".</td>
                                        </tr>
                                    ) : detalles.map((det, idx) => (
                                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-3 py-1.5 text-[10px] text-slate-400 font-bold">{idx + 1}</td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" step="0.01" min="0" placeholder="0.00"
                                                    value={det.sueldo_inicial} onChange={(e) => updateDetalle(idx, 'sueldo_inicial', e.target.value)}
                                                    className={inputSm} />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" step="0.01" min="0" placeholder="0.00"
                                                    value={det.sueldo_final} onChange={(e) => updateDetalle(idx, 'sueldo_final', e.target.value)}
                                                    className={inputSm} />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" step="0.01" min="0" placeholder="%" 
                                                    value={det.porcentaje} onChange={(e) => updateDetalle(idx, 'porcentaje', e.target.value)}
                                                    className={`${inputSm} text-center`} />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" step="0.01" min="0" placeholder="0.00"
                                                    value={det.valor_descuento} onChange={(e) => updateDetalle(idx, 'valor_descuento', e.target.value)}
                                                    className={inputSm} />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input type="number" step="0.01" min="0" placeholder="0.00"
                                                    value={det.exceso} onChange={(e) => updateDetalle(idx, 'exceso', e.target.value)}
                                                    className={inputSm} />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <button type="button" onClick={() => removeDetalle(idx)}
                                                    className="p-1 text-rose-300 hover:text-rose-600 transition-colors">
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selected ? 'Guardar Cambios' : 'Registrar')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default RentaConfig;
