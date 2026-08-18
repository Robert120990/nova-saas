import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { Calculator, Search, Plus, Trash2, Save, Loader2, Gauge, FileText, Eye, Edit3, Banknote, Lock, Unlock, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money, { MoneyInput } from '../components/ui/Money';

const today = () => new Date().toISOString().split('T')[0];

const PozoCorte = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();

    const [listSearch, setListSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [listPage, setListPage] = useState(1);

    const [showFormModal, setShowFormModal] = useState(false);
    const [editCorteId, setEditCorteId] = useState(null);
    const [fecha, setFecha] = useState(today());
    const [encargado, setEncargado] = useState(user?.nombre || '');
    const [gastos, setGastos] = useState([]);
    const [consultarKey, setConsultarKey] = useState(null);

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [viewFecha, setViewFecha] = useState(null);
    const [editOdoFinal, setEditOdoFinal] = useState(false);
    const [odoFinalInput, setOdoFinalInput] = useState('');

    const canReopen = user?.role === 'SuperAdmin' || (user?.permissions || []).includes('close_pozo_cortes');

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(listSearch);
            setListPage(1);
        }, 500);
        return () => clearTimeout(t);
    }, [listSearch]);

    const { data: cortesData, isLoading: listLoading } = useQuery({
        queryKey: ['pozo-cortes', debouncedSearch, listPage],
        queryFn: async () => (await axios.get('/api/pozo/cortes', {
            params: { page: listPage, limit: 15, search: debouncedSearch || undefined }
        })).data
    });

    const historial = cortesData?.data || [];
    const totalCortes = cortesData?.total || 0;
    const totalCortePages = cortesData?.totalPages || 0;

    const { data: corteData, isLoading: consultando } = useQuery({
        queryKey: ['pozo-corte-consultar', consultarKey],
        queryFn: async () => (await axios.get('/api/pozo/cortes/consultar', { params: { fecha: consultarKey } })).data,
        enabled: !!consultarKey,
    });

    const { data: editData } = useQuery({
        queryKey: ['pozo-corte-edit', editCorteId],
        queryFn: async () => (await axios.get(`/api/pozo/cortes/${editCorteId}`)).data,
        enabled: !!editCorteId && showFormModal,
        staleTime: 0,
    });

    const { data: viewCorteData, isLoading: viewLoading } = useQuery({
        queryKey: ['pozo-corte-ver', viewFecha],
        queryFn: async () => (await axios.get('/api/pozo/cortes/consultar', { params: { fecha: viewFecha } })).data,
        enabled: !!viewFecha && showDetailModal,
    });

    useEffect(() => {
        if (corteData) {
            setGastos((corteData.gastos || []).map(g => ({ descripcion: g.descripcion || '', monto: String(g.monto ?? '') })));
            setOdoFinalInput(corteData.corte?.odometro_final_manual ?? corteData.odometro_final ?? '');
        }
    }, [corteData]);

    useEffect(() => {
        if (editData) {
            setFecha(editData.fecha ? editData.fecha.split('T')[0] : today());
            setEncargado(editData.encargado || '');
            setGastos((editData.gastos || []).map(g => ({ descripcion: g.descripcion || '', monto: String(g.monto ?? '') })));
            setOdoFinalInput(editData.odometro_final_manual ?? '');
            setConsultarKey(editData.fecha ? editData.fecha.split('T')[0] : today());
        }
    }, [editData]);

    const consultar = () => {
        if (!fecha) { toast.error('Seleccione una fecha'); return; }
        setEditOdoFinal(false);
        setConsultarKey(fecha);
    };

    const saveMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/pozo/cortes', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes'] });
            closeForm();
            toast.success('Corte guardado exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar el corte'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/pozo/cortes/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            toast.success('Corte eliminado');
            if (showFormModal) closeForm();
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar el corte'),
    });

    const closeMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/pozo/cortes/${id}/close`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-ver'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes-entregas-estimadas'] });
            toast.success('Corte cerrado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al cerrar el corte'),
    });

    const reopenMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/pozo/cortes/${id}/reopen`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-ver'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes-entregas-estimadas'] });
            toast.success('Corte reabierto');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al reabrir el corte'),
    });

    const saveOdoFinalMutation = useMutation({
        mutationFn: ({ id, odometro_final_manual }) => axios.put(`/api/pozo/cortes/${id}/odometro-final`, { odometro_final_manual }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-ver'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-corte-consultar'] });
            queryClient.invalidateQueries({ queryKey: ['pozo-cortes'] });
            setEditOdoFinal(false);
            toast.success('Odómetro final actualizado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al actualizar el odómetro'),
    });

    const isSaving = saveMutation.isPending;

    const resetForm = () => {
        setFecha(today());
        setEncargado(user?.nombre || '');
        setGastos([]);
        setOdoFinalInput('');
        setConsultarKey(null);
    };

    const closeForm = () => {
        setShowFormModal(false);
        setEditCorteId(null);
        resetForm();
    };

    const openNewCorte = () => {
        setEditCorteId(null);
        resetForm();
        setShowFormModal(true);
    };

    const verCorte = (c) => {
        setViewFecha(c.fecha ? c.fecha.split('T')[0] : c.fecha);
        setEditOdoFinal(false);
        setShowDetailModal(true);
    };

    const editarCorte = (id) => {
        setEditCorteId(id);
        setShowFormModal(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar corte?',
            message: 'Este corte será eliminado permanentemente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleClose = async (item) => {
        const ok = await confirm({
            title: '¿Cerrar corte?',
            message: `El corte del ${fmtDate(item.fecha)} quedará cerrado y no podrá editarse ni eliminarse.`,
            confirmLabel: 'Sí, cerrar',
            variant: 'danger',
        });
        if (ok) closeMutation.mutate(item.id);
    };

    const handleReopen = async (item) => {
        const ok = await confirm({
            title: '¿Reabrir corte?',
            message: `El corte del ${fmtDate(item.fecha)} podrá editarse nuevamente.`,
            confirmLabel: 'Sí, reabrir',
        });
        if (ok) reopenMutation.mutate(item.id);
    };

    const saveOdoFinal = (corte) => {
        if (!corte) return;
        const v = odoFinalInput.trim();
        if (v !== '' && (isNaN(parseFloat(v)) || parseFloat(v) < 0)) {
            toast.error('Ingrese un valor válido (mayor o igual a cero)');
            return;
        }
        saveOdoFinalMutation.mutate({ id: corte.id, odometro_final_manual: v });
    };

    const addGasto = () => {
        setGastos(prev => [...prev, { descripcion: '', monto: '' }]);
    };

    const removeGasto = (index) => {
        setGastos(prev => prev.filter((_, i) => i !== index));
    };

    const updateGasto = (index, field, value) => {
        setGastos(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
    };

    const handleSave = () => {
        if (!fecha) { toast.error('La fecha es requerida'); return; }
        const gastosValidos = gastos.filter(g => g.descripcion.trim() && parseFloat(g.monto) > 0);
        saveMutation.mutate({
            fecha,
            encargado: encargado.trim(),
            gastos: gastosValidos.map(g => ({ descripcion: g.descripcion.trim(), monto: g.monto })),
            odometro_final_manual: odoFinalInput,
        });
    };

    const totalGastos = useMemo(() =>
        gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0),
        [gastos]
    );

    const despachos = corteData?.despachos || [];
    const gastosValidosCount = gastos.filter(g => g.descripcion.trim() && parseFloat(g.monto) > 0).length;

    const fmtDate = (v) => {
        if (!v) return '—';
        return new Date(v).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    const summaryCard = (icon, label, value, accent) => (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${accent}`}>{icon}</div>
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">{value}</p>
            </div>
        </div>
    );

    const odometroFinalCard = (corte, odometroAuto) => (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50"><Gauge size={18} className="text-emerald-600" /></div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    Odómetro Final
                    {corte?.odometro_final_manual != null && (
                        <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded">MANUAL</span>
                    )}
                </p>
                {editOdoFinal ? (
                    <div className="flex items-center gap-1 mt-1">
                        <input
                            type="number"
                            value={odoFinalInput}
                            onChange={(e) => setOdoFinalInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveOdoFinal(corte); if (e.key === 'Escape') setEditOdoFinal(false); }}
                            autoFocus
                            className="w-24 bg-white border border-indigo-300 rounded-lg text-[13px] font-mono px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <button onClick={() => saveOdoFinal(corte)} disabled={saveOdoFinalMutation.isPending} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Guardar">
                            {saveOdoFinalMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                        <button onClick={() => setEditOdoFinal(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title="Cancelar"><X size={13} /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => { setOdoFinalInput(corte?.odometro_final_manual ?? odometroAuto ?? ''); setEditOdoFinal(true); }}
                        disabled={!corte || corte.estado === 'cerrado'}
                        className={`text-lg font-bold text-slate-900 font-mono mt-0.5 flex items-center gap-1.5 ${corte && corte.estado !== 'cerrado' ? 'hover:text-indigo-600 cursor-pointer' : 'cursor-default disabled:opacity-70'}`}
                        title={!corte ? 'No hay corte registrado este día' : corte.estado === 'cerrado' ? 'El corte está cerrado' : 'Clic para editar el odómetro final'}
                    >
                        {corte?.odometro_final_manual ?? odometroAuto ?? '—'}
                        {corte && corte.estado !== 'cerrado' && <Edit3 size={13} className="text-slate-300" />}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Calculator size={22} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Cortes</h2>
                        <p className="text-slate-500 text-[11px] font-medium">Control de Pozo — Cortes</p>
                        {user?.branch_name && <p className="text-[10px] font-bold text-indigo-500 mt-0.5">Sucursal: {user.branch_name}</p>}
                    </div>
                </div>
                <button
                    onClick={openNewCorte}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Nuevo Corte</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por encargado..."
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Fecha', 'Encargado', 'Estado', 'Total Ventas', 'Gastos', 'Total Gastos', 'Acciones']}
                    data={historial}
                    isLoading={listLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-medium text-slate-800">{fmtDate(item.fecha)}</span>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600">{item.encargado || '—'}</td>
                            <td className="px-3 py-1">
                                {item.estado === 'cerrado' ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-600 px-2 py-0.5 rounded-full"><Lock size={10} /> Cerrado</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Abierto</span>
                                )}
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.total_ventas} /></span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-800">{item.total_gastos_count || 0}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.total_gastos} /></span>
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => verCorte(item)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver corte"><Eye size={15} /></button>
                                {item.estado === 'cerrado' ? (
                                    canReopen && (
                                        <button onClick={() => handleReopen(item)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reabrir corte"><Unlock size={15} /></button>
                                    )
                                ) : (
                                    <>
                                        <button onClick={() => handleClose(item)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cerrar corte"><Lock size={15} /></button>
                                        <button onClick={() => editarCorte(item.id)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar corte"><Edit3 size={15} /></button>
                                    </>
                                )}
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    disabled={item.estado === 'cerrado'}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={item.estado === 'cerrado' ? 'No se puede eliminar un corte cerrado' : 'Eliminar'}
                                >
                                    <Trash2 size={15} />
                                </button>
                            </td>
                        </tr>
                    )}
                />
                {totalCortePages > 1 && (
                    <div className="px-2">
                        <Pagination
                            currentPage={listPage}
                            totalPages={totalCortePages}
                            totalItems={totalCortes}
                            itemsOnPage={historial.length}
                            onPageChange={setListPage}
                            limit={15}
                        />
                    </div>
                )}
            </div>

            <Modal isOpen={showFormModal} onClose={() => { if (!isSaving) closeForm(); }} title={editCorteId ? 'Editar Corte' : 'Nuevo Corte'} maxWidth="max-w-5xl">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha <span className="text-red-400">*</span></label>
                            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Encargado</label>
                            <input type="text" value={encargado} onChange={(e) => setEncargado(e.target.value)} placeholder="Nombre del encargado" className={inputCls} />
                        </div>
                        <button
                            onClick={consultar}
                            disabled={consultando}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                        >
                            {consultando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            Consultar
                        </button>
                    </div>

                    {corteData && (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {summaryCard(<Gauge size={18} className="text-indigo-600" />, 'Odómetro Inicial', corteData.odometro_inicial ?? '—', 'bg-indigo-50')}
                                {odometroFinalCard(corteData.corte, corteData.odometro_final)}
                                {summaryCard(<FileText size={18} className="text-amber-600" />, 'Despachos del Día', corteData.total_despachos ?? despachos.length, 'bg-amber-50')}
                                {summaryCard(<FileText size={18} className="text-sky-600" />, 'Servicios del Día', corteData.total_servicios ?? 0, 'bg-sky-50')}
                                {summaryCard(<Banknote size={18} className="text-emerald-600" />, 'Total Ventas', <Money value={corteData.monto_total} />, 'bg-emerald-50')}
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <Table
                                    headers={['Número', 'Encargado', 'Cliente', 'Placa', 'Hora Entrada', 'Hora Salida', 'Odómetro Ini', 'Odómetro Fin', 'Total']}
                                    data={despachos}
                                    isLoading={consultando}
                                    renderRow={(item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                            <td className="px-3 py-1"><span className="text-xs font-bold font-mono text-indigo-600">{item.numero || '—'}</span></td>
                                            <td className="px-3 py-1 text-xs text-slate-600">{item.encargado || '—'}</td>
                                            <td className="px-3 py-1 text-xs text-slate-600">{item.cliente || '—'}</td>
                                            <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.placa || '—'}</td>
                                            <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.hora_entrada || '—'}</td>
                                            <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.hora_salida || '—'}</td>
                                            <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.odometro_inicial ?? '—'}</td>
                                            <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.odometro_final ?? '—'}</td>
                                            <td className="px-3 py-1"><span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.monto_total} /></span></td>
                                        </tr>
                                    )}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <label className={labelCls}>Gastos del Día</label>
                                    <button
                                        onClick={addGasto}
                                        className="flex items-center justify-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl border border-indigo-200 transition-all"
                                    >
                                        <Plus size={13} /> Agregar Gasto
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {gastos.length === 0 && (
                                        <div className="px-3 py-3 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                                            Sin gastos. Clic en "+ Agregar Gasto" para ingresar descripción y monto.
                                        </div>
                                    )}
                                    {gastos.map((g, i) => (
                                        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_40px] gap-2 items-center">
                                            <input
                                                type="text"
                                                value={g.descripcion}
                                                onChange={(e) => updateGasto(i, 'descripcion', e.target.value.toUpperCase())}
                                                placeholder="Descripción del gasto..."
                                                className={inputCls}
                                            />
                                            <MoneyInput
                                                value={g.monto}
                                                onChange={(e) => updateGasto(i, 'monto', e.target.value)}
                                                placeholder="0.00"
                                                className={inputCls}
                                            />
                                            <button
                                                onClick={() => removeGasto(i)}
                                                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all self-center"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <Banknote size={14} className="text-slate-400" />
                                        {gastosValidosCount} gasto(s) · Total: <Money value={totalGastos} className="font-bold text-indigo-600" />
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                                    >
                                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {isSaving ? 'Guardando...' : 'Guardar Corte'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setViewFecha(null); }} title="Detalle de Corte" maxWidth="max-w-5xl">
                {viewCorteData && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl">
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Fecha</span>
                                <span className="text-[13px] font-medium text-slate-800">{fmtDate(viewCorteData.fecha)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Encargado</span>
                                <span className="text-[13px] font-medium text-slate-800">{viewCorteData.corte?.encargado || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Estado</span>
                                {!viewCorteData.corte ? (
                                    <span className="text-[13px] font-medium font-mono text-slate-400">SIN CORTE</span>
                                ) : viewCorteData.corte.estado === 'cerrado' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black font-mono text-red-600 bg-red-100 px-2 py-0.5 rounded-full"><Lock size={11} /> CERRADO</span>
                                ) : (
                                    <span className="text-[13px] font-medium font-mono text-indigo-600">CORTE REALIZADO</span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                            {summaryCard(<Gauge size={18} className="text-indigo-600" />, 'Odómetro Inicial', viewCorteData.odometro_inicial ?? '—', 'bg-indigo-50')}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-emerald-50"><Gauge size={18} className="text-emerald-600" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        Odómetro Final
                                        {viewCorteData.corte?.odometro_final_manual != null && (
                                            <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded">MANUAL</span>
                                        )}
                                    </p>
                                    <p className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                                        {viewCorteData.corte?.odometro_final_manual ?? viewCorteData.odometro_final ?? '—'}
                                    </p>
                                </div>
                            </div>
                            {summaryCard(<FileText size={18} className="text-amber-600" />, 'Despachos del Día', viewCorteData.total_despachos ?? viewCorteData.despachos.length, 'bg-amber-50')}
                            {summaryCard(<FileText size={18} className="text-sky-600" />, 'Servicios del Día', viewCorteData.total_servicios ?? 0, 'bg-sky-50')}
                            {summaryCard(<Banknote size={18} className="text-emerald-600" />, 'Total Ventas', <Money value={viewCorteData.monto_total} />, 'bg-emerald-50')}
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <Table
                                headers={['Número', 'Encargado', 'Cliente', 'Placa', 'Hora Entrada', 'Hora Salida', 'Odómetro Ini', 'Odómetro Fin', 'Total']}
                                data={viewCorteData.despachos}
                                isLoading={viewLoading}
                                renderRow={(item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                        <td className="px-3 py-1"><span className="text-xs font-bold font-mono text-indigo-600">{item.numero || '—'}</span></td>
                                        <td className="px-3 py-1 text-xs text-slate-600">{item.encargado || '—'}</td>
                                        <td className="px-3 py-1 text-xs text-slate-600">{item.cliente || '—'}</td>
                                        <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.placa || '—'}</td>
                                        <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.hora_entrada || '—'}</td>
                                        <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.hora_salida || '—'}</td>
                                        <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.odometro_inicial ?? '—'}</td>
                                        <td className="px-3 py-1 text-xs font-mono text-slate-600">{item.odometro_final ?? '—'}</td>
                                        <td className="px-3 py-1"><span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.monto_total} /></span></td>
                                    </tr>
                                )}
                            />
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold text-slate-900">Gastos del Día</h3>
                            </div>
                            {viewCorteData.gastos.length === 0 ? (
                                <div className="px-3 py-6 text-center text-xs text-slate-400">Sin gastos registrados.</div>
                            ) : (
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Descripción</th>
                                            <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right w-32">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {viewCorteData.gastos.map(g => (
                                            <tr key={g.id} className="text-[12px] hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2 text-slate-700">{g.descripcion || '—'}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800"><Money value={g.monto} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50">
                                            <td className="px-3 py-2 text-[11px] font-bold text-slate-600 text-right">Total Gastos:</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-red-600"><Money value={viewCorteData.gastos.reduce((s, g) => s + (parseFloat(g.monto) || 0), 0)} /></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default PozoCorte;
