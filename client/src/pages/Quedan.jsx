import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Plus, Trash2, Search, Edit, Handshake, Send, Undo2, Save, Loader2,
    FileSignature, PlusCircle
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';

const today = () => new Date().toISOString().split('T')[0];
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

const emptyItem = () => ({
    _key: Date.now() + Math.random(),
    fecha: today(),
    documento: '',
    tipo: 'CCF',
    gravadas: '',
    iva: '',
    retencion: '',
    percepcion: '',
    exentas: '',
    total: ''
});

const Quedan = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [listSearch, setListSearch] = useState('');
    const [listPage, setListPage] = useState(1);
    const [branchFilter, setBranchFilter] = useState(user?.branch_id || '');

    const [showFormModal, setShowFormModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formBranchId, setFormBranchId] = useState(user?.branch_id || '');
    const [formNumQuedan, setFormNumQuedan] = useState('');
    const [formProviderId, setFormProviderId] = useState('');
    const [formProviderDias, setFormProviderDias] = useState(0);
    const [formFecha, setFormFecha] = useState(today());
    const [formFechaVenc, setFormFechaVenc] = useState('');
    const [formItems, setFormItems] = useState([]);

    const [showDeliverModal, setShowDeliverModal] = useState(false);
    const [deliverId, setDeliverId] = useState(null);
    const [deliverFecha, setDeliverFecha] = useState(today());

    const [showItemModal, setShowItemModal] = useState(false);
    const [editingItemKey, setEditingItemKey] = useState(null);
    const [itemForm, setItemForm] = useState({ fecha: today(), documento: '', tipo: 'CCF', gravadas: '', iva: '', retencion: '', percepcion: '', exentas: '' });

    const isEditing = editId !== null;

    const [showRequestConfirm, setShowRequestConfirm] = useState(null);

    const { data: listData, isLoading: listLoading } = useQuery({
        queryKey: ['purchase-quedans', listSearch, listPage, branchFilter],
        queryFn: async () => (await axios.get('/api/purchases/quedans', {
            params: { search: listSearch || undefined, page: listPage, limit: 15, branch_id: branchFilter || undefined }
        })).data
    });

    const quedans = listData?.data || [];
    const total = listData?.total || 0;
    const totalPages = listData?.totalPages || 0;

    const { data: creditProviders = [] } = useQuery({
        queryKey: ['providers-credito'],
        queryFn: async () => (await axios.get('/api/providers', { params: { limit: 5000, es_credito: '1' } })).data?.data || []
    });

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', user?.company_id],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: editData } = useQuery({
        queryKey: ['purchase-quedan-edit', editId],
        queryFn: async () => (await axios.get(`/api/purchases/quedans/${editId}`)).data,
        enabled: !!editId && showFormModal,
    });

    useMemo(() => {
        if (editData) {
            setFormBranchId(editData.branch_id || user?.branch_id || '');
            setFormNumQuedan(editData.num_quedan || '');
            setFormProviderId(String(editData.provider_id || ''));
            setFormProviderDias(editData.dias_credito || 0);
            setFormFecha(editData.fecha ? editData.fecha.split('T')[0] : today());
            setFormFechaVenc(editData.fecha_vencimiento ? editData.fecha_vencimiento.split('T')[0] : '');
            if (editData.items && editData.items.length > 0) {
                setFormItems(editData.items.map(item => ({
                    _key: item.id || Date.now() + Math.random(),
                    id: item.id,
                    fecha: item.fecha ? item.fecha.split('T')[0] : today(),
                    documento: item.documento || '',
                    tipo: item.tipo || 'CCF',
                    gravadas: String(item.gravadas || ''),
                    iva: String(item.iva || ''),
                    retencion: String(item.retencion || ''),
                    percepcion: String(item.percepcion || ''),
                    exentas: String(item.exentas || ''),
                    total: String(item.total || '')
                })));
            } else {
                setFormItems([]);
            }
        }
    }, [editData, user?.branch_id]);

    const recalcVenc = (fecha, dias) => {
        if (!fecha || !dias) return '';
        const d = new Date(fecha);
        d.setDate(d.getDate() + parseInt(dias));
        return d.toISOString().split('T')[0];
    };

    const handleProviderChange = (e) => {
        const val = String(e.target.value);
        setFormProviderId(val);
        const provider = creditProviders.find(p => String(p.id) === val);
        const dias = provider ? Number(provider.dias_credito) || 0 : 0;
        setFormProviderDias(dias);
        setFormFechaVenc(recalcVenc(formFecha, dias));
    };

    const handleFechaChange = (val) => {
        setFormFecha(val);
        setFormFechaVenc(recalcVenc(val, formProviderDias));
    };

    const recalcItemTotal = (item) => {
        const g = parseFloat(item.gravadas) || 0;
        const i = parseFloat(item.iva) || 0;
        const e = parseFloat(item.exentas) || 0;
        return g + i + e;
    };

    const removeItem = (key) => {
        setFormItems(prev => prev.filter(item => item._key !== key));
    };

    const resetItemForm = () => {
        setItemForm({ fecha: today(), documento: '', tipo: 'CCF', gravadas: '', iva: '', retencion: '', percepcion: '', exentas: '' });
        setEditingItemKey(null);
    };

    const openAddItem = () => {
        resetItemForm();
        setShowItemModal(true);
    };

    const openEditItem = (key) => {
        const item = formItems.find(i => i._key === key);
        if (!item) return;
        setItemForm({
            fecha: item.fecha,
            documento: item.documento,
            tipo: item.tipo,
            gravadas: item.gravadas,
            iva: item.iva,
            retencion: item.retencion,
            percepcion: item.percepcion,
            exentas: item.exentas
        });
        setEditingItemKey(key);
        setShowItemModal(true);
    };

    const saveItem = () => {
        const total = recalcItemTotal(itemForm);
        if (editingItemKey) {
            setFormItems(prev => prev.map(item =>
                item._key === editingItemKey ? { ...item, ...itemForm, total } : item
            ));
        } else {
            setFormItems(prev => [...prev, { _key: Date.now() + Math.random(), ...itemForm, total }]);
        }
        setShowItemModal(false);
        resetItemForm();
    };

    const updateItemForm = (field, value) => {
        setItemForm(prev => {
            const next = { ...prev, [field]: value };
            if (next.tipo === 'CCF' && (field === 'gravadas' || field === 'tipo')) {
                const gravadas = parseFloat(field === 'gravadas' ? value : next.gravadas) || 0;
                next.iva = (gravadas * 0.13).toFixed(2);
            }
            return next;
        });
    };

    const calcTotals = () => {
        let g = 0, i = 0, r = 0, p = 0, e = 0, t = 0;
        for (const item of formItems) {
            g += parseFloat(item.gravadas) || 0;
            i += parseFloat(item.iva) || 0;
            r += parseFloat(item.retencion) || 0;
            p += parseFloat(item.percepcion) || 0;
            e += parseFloat(item.exentas) || 0;
            t += recalcItemTotal(item);
        }
        return { gravadas: g, iva: i, retencion: r, percepcion: p, exentas: e, total: t };
    };

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/purchases/quedans', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-quedans'] });
            toast.success('Quedan registrado con éxito');
            closeForm();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al registrar quedan'),
    });

    const updateMutation = useMutation({
        mutationFn: (data) => axios.put(`/api/purchases/quedans/${editId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-quedans'] });
            toast.success('Quedan actualizado con éxito');
            closeForm();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al actualizar quedan'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/purchases/quedans/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-quedans'] });
            toast.success('Quedan eliminado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar quedan'),
    });

    const deliverMutation = useMutation({
        mutationFn: ({ id, data }) => axios.post(`/api/purchases/quedans/${id}/deliver`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-quedans'] });
            toast.success('Quedan marcado como entregado');
            setShowDeliverModal(false);
            setDeliverId(null);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al entregar quedan'),
    });

    const requestMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/purchases/quedans/${id}/request`),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-quedans'] });
            toast.success('Quedan enviado a RRS con éxito');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al solicitar quedan'),
    });

    const revertMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/purchases/quedans/${id}/revert`),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['purchase-quedans'] });
            toast.success(res.data.message);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al revertir quedan'),
    });

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const handleRevert = async (id) => {
        const ok = await confirm({
            title: '¿Revertir solicitud?',
            message: 'Se eliminará el registro de RRS y el quedan volverá a estado PENDIENTE.',
            confirmLabel: 'Sí, revertir',
            variant: 'warning',
        });
        if (ok) revertMutation.mutate(id);
    };

    const handleRequest = async (id) => {
        const ok = await confirm({
            title: '¿Enviar solicitud a RRS?',
            message: 'Se creará la emisión del quedan en el sistema RRS.',
            confirmLabel: 'Sí, solicitar',
            variant: 'info',
        });
        if (ok) requestMutation.mutate(id);
    };

    const closeForm = () => {
        setShowFormModal(false);
        setEditId(null);
        resetForm();
    };

    const resetForm = () => {
        setFormBranchId(user?.branch_id || '');
        setFormNumQuedan('');
        setFormProviderId('');
        setFormProviderDias(0);
        setFormFecha(today());
        setFormFechaVenc('');
        setFormItems([]);
    };

    const openNewForm = () => {
        setEditId(null);
        resetForm();
        setShowFormModal(true);
    };

    const openEditForm = (id) => {
        setEditId(id);
        setShowFormModal(true);
    };

    const openDeliverModal = (id) => {
        setDeliverId(id);
        setDeliverFecha(today());
        setShowDeliverModal(true);
    };

    const handleSave = () => {
        if (!formNumQuedan) { toast.error('El N. Quedan es requerido'); return; }
        if (!formProviderId) { toast.error('El proveedor es requerido'); return; }
        if (!formFecha) { toast.error('La fecha es requerida'); return; }

        const totals = calcTotals();
        const payload = {
            branch_id: formBranchId,
            num_quedan: formNumQuedan,
            provider_id: formProviderId,
            dias_credito: formProviderDias,
            fecha: formFecha,
            fecha_vencimiento: formFechaVenc,
            items: formItems.map(item => ({
                fecha: item.fecha,
                documento: item.documento,
                tipo: item.tipo,
                gravadas: parseFloat(item.gravadas) || 0,
                iva: parseFloat(item.iva) || 0,
                retencion: parseFloat(item.retencion) || 0,
                percepcion: parseFloat(item.percepcion) || 0,
                exentas: parseFloat(item.exentas) || 0,
                total: recalcItemTotal(item)
            }))
        };

        if (isEditing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar quedan?',
            message: 'Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleDeliver = () => {
        if (!deliverFecha) { toast.error('La fecha de entrega es requerida'); return; }
        deliverMutation.mutate({ id: deliverId, data: { fecha_entrega: deliverFecha } });
    };

    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";
    const totals = calcTotals();

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">Quedan</h2>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                            Documentos de Crédito
                        </span>
                        {user?.branch_name && (
                            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                                {user.branch_name}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={openNewForm}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Agregar</span>
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Buscar por proveedor o N. Quedan..."
                        value={listSearch}
                        onChange={(e) => { setListSearch(e.target.value); setListPage(1); }}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight shadow-sm"
                    />
                </div>
                <div className="w-48">
                    <select
                        value={branchFilter}
                        onChange={(e) => { setBranchFilter(e.target.value); setListPage(1); }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight"
                    >
                        <option value="">Todas las Sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['N. Quedan', 'Fecha', 'Vencimiento', 'Días', 'Proveedor', 'Total', 'Estado', 'Acciones']}
                    data={quedans}
                    isLoading={listLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                            <td className="px-5 py-3 text-[10px] font-black text-slate-700 font-mono">
                                {c.num_quedan || '—'}
                            </td>
                            <td className="px-5 py-3 text-[9px] font-bold text-slate-400">
                                {formatDate(c.fecha)}
                            </td>
                            <td className="px-5 py-3 text-[9px] font-bold text-slate-400">
                                {formatDate(c.fecha_vencimiento)}
                            </td>
                            <td className="px-5 py-3 text-[9px] font-bold text-slate-500">
                                {c.dias_credito || 0}
                            </td>
                            <td className="px-5 py-3 text-[10px] font-bold text-slate-600 uppercase max-w-[160px] truncate">
                                {c.provider_nombre}
                            </td>
                            <td className="px-5 py-3 font-black text-slate-900 text-[10px]">
                                ${parseFloat(c.total || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.status === 'ENTREGADO' ? 'bg-emerald-50 text-emerald-600' : c.status === 'SOLICITADO' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {c.status}
                                </span>
                            </td>
                            <td className="px-5 py-3">
                                <div className="flex justify-end gap-1">
                                    {c.status === 'PENDIENTE' && (
                                        <>
                                            <button
                                                onClick={() => openEditForm(c.id)}
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRequest(c.id)}
                                                disabled={requestMutation.isPending}
                                                className="p-1.5 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all disabled:opacity-40"
                                                title="Solicitar a RRS"
                                            >
                                                <Send size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(c.id)}
                                                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                    {c.status === 'SOLICITADO' && (
                                        <>
                                            <button
                                                onClick={() => openDeliverModal(c.id)}
                                                className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Entregar"
                                            >
                                                <Handshake size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRevert(c.id)}
                                                disabled={revertMutation.isPending}
                                                className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-40"
                                                title="Revertir"
                                            >
                                                <Undo2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                />
                {totalPages > 1 && (
                    <div className="px-2">
                        <Pagination
                            currentPage={listPage}
                            totalPages={totalPages}
                            totalItems={total}
                            itemsOnPage={quedans.length}
                            onPageChange={setListPage}
                            limit={15}
                            compact={true}
                        />
                    </div>
                )}
            </div>

            <Modal
                isOpen={showFormModal}
                onClose={() => { if (!isSaving) closeForm(); }}
                title={isEditing ? 'Editar Quedan' : 'Nuevo Quedan'}
                maxWidth="max-w-5xl"
            >
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className={`${labelCls} block mb-1`}>N. Quedan</label>
                            <input type="text" value={formNumQuedan}
                                onChange={(e) => setFormNumQuedan(e.target.value)}
                                placeholder="0001" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Sucursal</label>
                            <select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)} className={inputCls}>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha</label>
                            <input type="date" value={formFecha} onChange={(e) => handleFechaChange(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha Vencimiento</label>
                            <input type="date" value={formFechaVenc} className={inputCls + ' bg-slate-50 text-slate-500'} readOnly />
                        </div>
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Proveedor</label>
                        <SearchableSelect
                            options={creditProviders}
                            value={formProviderId}
                            onChange={handleProviderChange}
                            valueKey="id"
                            labelKey="nombre"
                            placeholder="BUSCAR PROVEEDOR CRÉDITO..."
                            codeKey="nrc"
                            codeLabel="NRC"
                        />
                    </div>
                    {formProviderDias > 0 && (
                        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 inline-block">
                            <span className="text-[10px] font-bold text-slate-500">Días de Crédito: </span>
                            <span className="text-[13px] font-black text-indigo-600">{formProviderDias}</span>
                        </div>
                    )}
                    <hr className="border-slate-200" />
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className={labelCls}>Detalle de Documentos</span>
                            <button
                                type="button"
                                onClick={openAddItem}
                                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 text-[10px] font-bold uppercase tracking-wider"
                            >
                                <PlusCircle size={14} />
                                Agregar Documento
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Fecha</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Documento</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Tipo</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Gravadas</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">IVA</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Retención</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Percepción</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Exentas</th>
                                        <th className="text-[9px] font-bold text-slate-400 uppercase py-2 px-2">Total</th>
                                        <th className="py-2 px-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formItems.length === 0 && (
                                        <tr>
                                            <td colSpan="10" className="text-center py-8 text-[10px] text-slate-400 font-medium">
                                                Sin documentos. Presione "Agregar Documento" para añadir.
                                            </td>
                                        </tr>
                                    )}
                                    {formItems.map((item) => (
                                        <tr key={item._key} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="py-2 px-2 text-[10px] font-bold text-slate-600">{formatDate(item.fecha)}</td>
                                            <td className="py-2 px-2 text-[10px] font-mono font-bold text-slate-700">{item.documento || '—'}</td>
                                            <td className="py-2 px-2">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${item.tipo === 'CCF' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {item.tipo}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-[10px] font-bold text-slate-600 text-right">${(parseFloat(item.gravadas) || 0).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[10px] font-bold text-slate-600 text-right">${(parseFloat(item.iva) || 0).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[10px] font-bold text-slate-600 text-right">${(parseFloat(item.retencion) || 0).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[10px] font-bold text-slate-600 text-right">${(parseFloat(item.percepcion) || 0).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[10px] font-bold text-slate-600 text-right">${(parseFloat(item.exentas) || 0).toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[11px] font-black text-slate-800 text-right">${recalcItemTotal(item).toFixed(2)}</td>
                                            <td className="py-2 px-2">
                                                <div className="flex gap-1">
                                                    <button onClick={() => openEditItem(item._key)}
                                                        className="p-1 text-slate-300 hover:text-indigo-600 transition-colors" title="Editar">
                                                        <Edit size={13} />
                                                    </button>
                                                    <button onClick={() => removeItem(item._key)}
                                                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors" title="Eliminar">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {formItems.length > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                                            <td colSpan="3" className="py-2 px-2 text-[10px] font-black text-slate-600 uppercase">Totales</td>
                                            <td className="py-2 px-2 text-[11px] font-black text-slate-800 text-right">${totals.gravadas.toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[11px] font-black text-slate-800 text-right">${totals.iva.toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[11px] font-black text-slate-800 text-right">${totals.retencion.toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[11px] font-black text-slate-800 text-right">${totals.percepcion.toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[11px] font-black text-slate-800 text-right">${totals.exentas.toFixed(2)}</td>
                                            <td className="py-2 px-2 text-[12px] font-black text-indigo-600 text-right">${totals.total.toFixed(2)}</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={closeForm}
                            className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSaving ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar')}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showItemModal}
                onClose={() => { setShowItemModal(false); resetItemForm(); }}
                title={editingItemKey ? 'Editar Documento' : 'Agregar Documento'}
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha</label>
                            <input type="date" value={itemForm.fecha}
                                onChange={(e) => updateItemForm('fecha', e.target.value)}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Documento</label>
                            <input type="text" value={itemForm.documento}
                                onChange={(e) => updateItemForm('documento', e.target.value)}
                                placeholder="No. documento" className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Tipo</label>
                        <select value={itemForm.tipo}
                            onChange={(e) => updateItemForm('tipo', e.target.value)}
                            className={inputCls}>
                            <option value="CCF">CCF</option>
                            <option value="NCR">NCR</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Gravadas</label>
                            <input type="number" step="0.01" min="0" value={itemForm.gravadas}
                                onChange={(e) => updateItemForm('gravadas', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>IVA</label>
                            <input type="number" step="0.01" min="0" value={itemForm.iva}
                                onChange={(e) => updateItemForm('iva', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Retención</label>
                            <input type="number" step="0.01" min="0" value={itemForm.retencion}
                                onChange={(e) => updateItemForm('retencion', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Percepción</label>
                            <input type="number" step="0.01" min="0" value={itemForm.percepcion}
                                onChange={(e) => updateItemForm('percepcion', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className={`${labelCls} block mb-1`}>Exentas</label>
                        <input type="number" step="0.01" min="0" value={itemForm.exentas}
                            onChange={(e) => updateItemForm('exentas', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className={inputCls} />
                    </div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Total</span>
                        <span className="text-lg font-black text-indigo-600">
                            ${recalcItemTotal(itemForm).toFixed(2)}
                        </span>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => { setShowItemModal(false); resetItemForm(); }}
                            className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button onClick={saveItem}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20">
                            <Save size={16} />
                            {editingItemKey ? 'Actualizar' : 'Agregar'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showDeliverModal}
                onClose={() => { setShowDeliverModal(false); setDeliverId(null); }}
                title="Entregar Quedan"
                maxWidth="max-w-md"
            >
                <div className="space-y-5">
                    <div>
                        <label className={`${labelCls} block mb-1`}>Fecha de Entrega</label>
                        <input type="date" value={deliverFecha} onChange={(e) => setDeliverFecha(e.target.value)} className={inputCls} />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => { setShowDeliverModal(false); setDeliverId(null); }}
                            className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">
                            Cancelar
                        </button>
                        <button
                            onClick={handleDeliver}
                            disabled={deliverMutation.isPending}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                        >
                            {deliverMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} />}
                            {deliverMutation.isPending ? 'Procesando...' : 'Entregar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Quedan;
