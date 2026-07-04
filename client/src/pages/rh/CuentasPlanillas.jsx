import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Calculator, Check, X } from 'lucide-react';

const OPERACIONES = [
    { value: 'sumar', label: 'Sumar' },
    { value: 'restar', label: 'Restar' },
];

const TIPOS_VALOR = [
    { value: 'valor', label: 'Valor ($)' },
    { value: 'dias', label: 'Días' },
    { value: 'horas', label: 'Horas' },
    { value: 'porcentaje', label: 'Porcentaje' },
];

const CuentasPlanillas = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [nextOrden, setNextOrden] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-cuentas-planillas', debouncedSearch, page],
        queryFn: async () => (await axios.get('/api/rh/cuentas-planillas', { params: { search: debouncedSearch, page } })).data
    });

    const items = response.data || [];

    const { data: nextOrdenData } = useQuery({
        queryKey: ['rh-cuentas-planillas-next-orden'],
        queryFn: async () => (await axios.get('/api/rh/cuentas-planillas/next-orden')).data,
        enabled: isModalOpen && !selected,
    });

    useEffect(() => {
        if (nextOrdenData?.next) setNextOrden(nextOrdenData.next);
    }, [nextOrdenData]);

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selected) return axios.put(`/api/rh/cuentas-planillas/${selected.id}`, data);
            return axios.post('/api/rh/cuentas-planillas', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-cuentas-planillas'] });
            setIsModalOpen(false);
            setSelected(null);
            toast.success(selected ? 'Cuenta actualizada' : 'Cuenta creada');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar cuenta');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/cuentas-planillas/${id}`),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rh-cuentas-planillas'] }); toast.success('Cuenta eliminada'); },
        onError: (error) => { toast.error(error.response?.data?.message || 'Error al eliminar'); }
    });

    const handleDelete = async (id) => {
        const ok = await confirm({ title: '¿Eliminar cuenta?', message: 'Esta cuenta de planilla será eliminada permanentemente.', confirmLabel: 'Sí, eliminar', variant: 'danger' });
        if (ok) deleteMutation.mutate(id);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.activa = formData.get('activa') === 'on' ? 1 : 0;
        data.aparece_recibos = formData.get('aparece_recibos') === 'on' ? 1 : 0;
        data.aparece_planilla = formData.get('aparece_planilla') === 'on' ? 1 : 0;
        mutation.mutate(data);
    };

    const cls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const lbl = "block text-xs font-semibold text-slate-500 mb-1";

    const operacionBadge = (item) => (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${item.operacion === 'sumar' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {item.operacion === 'sumar' ? '+' : '−'}
        </span>
    );

    const tipoValorLabel = (item) => {
        const t = TIPOS_VALOR.find(t => t.value === item.tipo_valor);
        return t ? t.label : item.tipo_valor;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Cuentas de Planillas</h2>
                    <p className="text-slate-500 text-[11px] font-medium">Partidas que componen el cálculo de planilla</p>
                </div>
                <button onClick={() => { setSelected(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    <Plus size={20} /><span>Nueva Cuenta</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table headers={['Código', 'Descripción', 'Operación', 'Tipo Valor', 'Activa', 'Orden', 'Acciones']} data={items} isLoading={isLoading} renderRow={(item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg"><Calculator size={12} /></div>
                                <span className="font-bold text-xs text-slate-900">{item.codigo}</span>
                            </div>
                        </td>
                        <td className="px-3 py-1 text-xs text-slate-500">{item.descripcion}</td>
                        <td className="px-3 py-1">{operacionBadge(item)}</td>
                        <td className="px-3 py-1 text-xs text-slate-700 font-medium">{tipoValorLabel(item)}</td>
                        <td className="px-3 py-1">
                            {item.activa ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><Check size={11} />Sí</span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full"><X size={11} />No</span>
                            )}
                        </td>
                        <td className="px-3 py-1 text-xs text-slate-500 text-center">{item.orden}</td>
                        <td className="px-3 py-1 flex gap-1">
                            <button onClick={() => { setSelected(item); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={15} /></button>
                            <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                        </td>
                    </tr>
                )} />
            </div>

            <Pagination currentPage={page} totalPages={response.totalPages} totalItems={response.total} onPageChange={setPage} itemsOnPage={items.length} isLoading={isLoading} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selected ? 'Editar Cuenta de Planilla' : 'Nueva Cuenta de Planilla'} maxWidth="max-w-2xl">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={lbl}>Código</label>
                            <input name="codigo" defaultValue={selected?.codigo} required placeholder="Ej. HRS-EXT" className={cls} />
                        </div>
                        <div>
                            <label className={lbl}>Descripción</label>
                            <input name="descripcion" defaultValue={selected?.descripcion} required placeholder="Nombre de la cuenta" className={cls} />
                        </div>
                        <div>
                            <label className={lbl}>Operación en Planilla</label>
                            <select name="operacion" defaultValue={selected?.operacion || 'sumar'} className={cls}>
                                {OPERACIONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Tipo de Valor</label>
                            <select name="tipo_valor" defaultValue={selected?.tipo_valor || 'valor'} className={cls}>
                                {TIPOS_VALOR.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lbl}>Orden</label>
                            <input name="orden" type="number" min="1" defaultValue={selected?.orden || nextOrden} className={cls} />
                            <p className="text-[10px] text-slate-400 mt-0.5">Sugerido automáticamente, puedes editarlo</p>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold text-slate-500 mb-3">Opciones de Visualización</p>
                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="activa" defaultChecked={selected ? !!selected.activa : true} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                                <span className="text-xs font-medium text-slate-600">Activa</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="aparece_recibos" defaultChecked={selected ? !!selected.aparece_recibos : true} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                                <span className="text-xs font-medium text-slate-600">Aparece en Recibos</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="aparece_planilla" defaultChecked={selected ? !!selected.aparece_planilla : true} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                                <span className="text-xs font-medium text-slate-600">Aparece en Planilla</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                            {mutation.isPending ? 'Guardando...' : (selected ? 'Guardar Cambios' : 'Registrar Cuenta')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CuentasPlanillas;
