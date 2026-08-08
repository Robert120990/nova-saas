import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import Table from '../components/ui/Table';
import { Handshake, Plus, Trash2, Search, Save, X, Loader2, Eye, Barcode, Edit3, Printer, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money, { MoneyInput } from '../components/ui/Money';

const today = () => new Date().toISOString().split('T')[0];
const now = () => new Date().toTimeString().split(' ')[0].slice(0, 5);

const SalesRemesaDeliveries = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();

    const [listSearch, setListSearch] = useState('');
    const [listPage, setListPage] = useState(1);

    const [showFormModal, setShowFormModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [fecha, setFecha] = useState(today());
    const [hora, setHora] = useState(now());
    const [responsable, setResponsable] = useState('');
    const [comentario, setComentario] = useState('');
    const [referencia, setReferencia] = useState('');
    const [montoEntregado, setMontoEntregado] = useState('');
    const [addedRemesas, setAddedRemesas] = useState([]);
    const [scanInput, setScanInput] = useState('');

    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchPage, setSearchPage] = useState(1);
    const [searchSelectedRemesas, setSearchSelectedRemesas] = useState([]);

    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);

    const isEditing = editId !== null;

    const { data: listData, isLoading: listLoading } = useQuery({
        queryKey: ['sales-remesa-deliveries', listPage, listSearch],
        queryFn: async () => (await axios.get('/api/sales/remesa-deliveries', {
            params: { page: listPage, limit: 15, search: listSearch || undefined }
        })).data
    });

    const deliveries = listData?.data || [];
    const totalDeliveries = listData?.total || 0;
    const totalDeliveryPages = listData?.totalPages || 0;

    const { data: searchData, isLoading: searchLoading } = useQuery({
        queryKey: ['sales-remesas-pending', searchTerm, searchPage, editId],
        queryFn: async () => (await axios.get('/api/sales/remesas/pending', {
            params: { search: searchTerm || undefined, page: searchPage, limit: 15 }
        })).data,
        enabled: showSearchModal,
    });

    const pendingRemesas = searchData?.data || [];
    const totalPending = searchData?.total || 0;
    const totalPendingPages = searchData?.totalPages || 0;

    const { data: deliveryDetail } = useQuery({
        queryKey: ['sales-remesa-delivery', selectedDeliveryId],
        queryFn: async () => (await axios.get(`/api/sales/remesa-deliveries/${selectedDeliveryId}`)).data,
        enabled: !!selectedDeliveryId,
    });

    const { data: editData } = useQuery({
        queryKey: ['sales-remesa-delivery-edit', editId],
        queryFn: async () => (await axios.get(`/api/sales/remesa-deliveries/${editId}`)).data,
        enabled: !!editId && showFormModal,
    });

    useEffect(() => {
        if (editData) {
            setFecha(editData.fecha ? editData.fecha.split('T')[0] : today());
            setHora(editData.hora || now());
            setResponsable(editData.responsable || '');
            setComentario(editData.comentario || '');
            setReferencia(editData.referencia || '');
            setMontoEntregado(editData.monto_entregado !== null && editData.monto_entregado !== undefined ? editData.monto_entregado.toString() : '');
            setAddedRemesas(editData.remesas || []);
        }
    }, [editData]);

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/sales/remesa-deliveries', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-remesa-deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['sales-remesas-pending'] });
            closeForm();
            toast.success('Entrega registrada exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al registrar entrega'),
    });

    const updateMutation = useMutation({
        mutationFn: (data) => axios.put(`/api/sales/remesa-deliveries/${editId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-remesa-deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['sales-remesas-pending'] });
            closeForm();
            toast.success('Entrega actualizada exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al actualizar entrega'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/sales/remesa-deliveries/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-remesa-deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['sales-remesas-pending'] });
            toast.success('Entrega eliminada');
            if (showDetailModal) setShowDetailModal(false);
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar entrega'),
    });

    const entregarMutation = useMutation({
        mutationFn: (id) => axios.put(`/api/sales/remesa-deliveries/${id}/entregar`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-remesa-deliveries'] });
            queryClient.invalidateQueries({ queryKey: ['sales-remesas-pending'] });
            toast.success('Entrega marcada como entregada');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al marcar entrega'),
    });

    const isSaving = createMutation.isPending || updateMutation.isPending;

    const closeForm = () => {
        setShowFormModal(false);
        setEditId(null);
        resetForm();
    };

    const resetForm = () => {
        setFecha(today());
        setHora(now());
        setResponsable('');
        setComentario('');
        setReferencia('');
        setMontoEntregado('');
        setAddedRemesas([]);
        setScanInput('');
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

    const handleScanAdd = async () => {
        const code = scanInput.trim();
        if (!code) return;
        try {
            const res = await axios.get('/api/sales/remesas/pending', {
                params: { search: code, page: 1, limit: 5 }
            });
            const found = res.data?.data || [];
            const alreadyAdded = new Set(addedRemesas.map(r => r.id));
            if (found.length === 0) {
                toast.error('No se encontró ninguna remesa pendiente con ese código');
            } else if (found.length === 1) {
                if (alreadyAdded.has(found[0].id)) {
                    toast.warning('Esta remesa ya fue agregada');
                } else {
                    setAddedRemesas(prev => [...prev, found[0]]);
                    toast.success('Remesa agregada');
                }
            } else {
                const newOnes = found.filter(r => !alreadyAdded.has(r.id));
                if (newOnes.length === 0) {
                    toast.warning('Todas ya fueron agregadas');
                } else {
                    setAddedRemesas(prev => [...prev, ...newOnes]);
                    toast.success(`${newOnes.length} remesa(s) agregada(s)`);
                }
            }
            setScanInput('');
        } catch {
            toast.error('Error al buscar remesa');
        }
    };

    const handleScanKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleScanAdd(); }
    };

    const handleSelectRemesas = (selectedRemesas) => {
        const alreadyAdded = new Set(addedRemesas.map(r => r.id));
        const newOnes = selectedRemesas.filter(r => !alreadyAdded.has(r.id));
        if (newOnes.length === 0) {
            toast.warning('Las remesas seleccionadas ya fueron agregadas');
            return;
        }
        setAddedRemesas(prev => [...prev, ...newOnes]);
        setShowSearchModal(false);
        setSearchTerm('');
        setSearchSelectedRemesas([]);
        toast.success(`${newOnes.length} remesa(s) agregada(s)`);
    };

    const handleRemoveRemesa = (id) => {
        setAddedRemesas(prev => prev.filter(r => r.id !== id));
    };

    const handleSave = () => {
        if (!fecha) { toast.error('La fecha es requerida'); return; }
        if (!hora) { toast.error('La hora es requerida'); return; }
        if (!referencia.trim()) { toast.error('El número de referencia es requerido'); return; }

        const montoNum = parseFloat(montoEntregado);
        const hasMonto = !isNaN(montoNum) && montoNum > 0;
        if (addedRemesas.length === 0 && !hasMonto) {
            toast.error('Debe agregar al menos una remesa o ingresar un monto de entrega');
            return;
        }

        const payload = {
            fecha, hora, responsable, comentario, referencia: referencia.trim(),
            remesa_ids: addedRemesas.map(r => r.id),
            monto_entregado: hasMonto ? montoNum : null,
        };

        if (isEditing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar entrega?',
            message: 'Las remesas volverán a estar pendientes de entrega.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleViewDetail = (id) => {
        setSelectedDeliveryId(id);
        setShowDetailModal(true);
    };

    const handleMarkEntregado = async (id) => {
        const ok = await confirm({
            title: '¿Marcar como entregada?',
            message: 'Una vez marcada, no se podrá editar ni eliminar la entrega.',
            confirmLabel: 'Sí, marcar entregada',
            variant: 'info',
        });
        if (ok) entregarMutation.mutate(id);
    };

    const handlePrintPdf = async (id) => {
        try {
            const response = await axios.get(`/api/sales/remesa-deliveries/${id}/pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (error) {
            toast.error('Error al generar PDF');
        }
    };

    const totalMonto = useMemo(() =>
        addedRemesas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0),
        [addedRemesas]
    );

    const montoNum = parseFloat(montoEntregado);
    const hasMonto = !isNaN(montoNum) && montoNum > 0;
    const montoEfectivo = hasMonto ? montoNum : totalMonto;
    const diferencia = montoEfectivo - totalMonto;

    const inputCls = "w-full bg-white border border-slate-200 rounded-xl text-[13px] font-medium py-2 px-3 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
    const labelCls = "text-[11px] font-bold text-slate-500 uppercase";

    const fmtFechaTurno = (r) => {
        if (r.shift_date) {
            return new Date(r.shift_date).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        if (r.start_time || r.fecha_turno) {
            const d = new Date(r.start_time || r.fecha_turno);
            return isNaN(d) ? '—' : d.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
        return '—';
    };

    const turnoDe = (r) => r.shift_number || r.numero_turno || '—';

    return (
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                        <Handshake size={22} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Entrega de Remesas</h2>
                        <p className="text-slate-500 text-[11px] font-medium">Ventas — Entrega de remesas</p>
                        {user?.branch_name && <p className="text-[10px] font-bold text-indigo-500 mt-0.5">Sucursal: {user.branch_name}</p>}
                    </div>
                </div>
                <button
                    onClick={openNewForm}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20} />
                    <span>Nueva Entrega</span>
                </button>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por responsable..."
                    value={listSearch}
                    onChange={(e) => { setListSearch(e.target.value); setListPage(1); }}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Fecha', 'Hora', 'Responsable', 'Referencia', 'No. Remesas', 'Monto Entregado', 'Diferencia', 'Estado', 'Acciones']}
                    data={deliveries}
                    isLoading={listLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-medium text-slate-800">
                                    {new Date(item.fecha).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs text-slate-600 font-mono">{item.hora}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-medium text-slate-800">{item.responsable || '—'}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-indigo-600">{item.referencia || '—'}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-indigo-600">{item.total_remesas}</span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold font-mono text-emerald-600"><Money value={item.monto_entregado ?? item.monto_total} /></span>
                            </td>
                            <td className="px-3 py-1">
                                <span className={`text-xs font-bold font-mono ${parseFloat(item.diferencia || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {parseFloat(item.diferencia || 0) >= 0 ? '+' : ''}<Money value={item.diferencia || 0} />
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                {item.entregado ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded-lg"><CheckCircle size={11} /> Entregado</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[10px] rounded-lg">Pendiente</span>
                                )}
                            </td>
                            <td className="px-3 py-1 flex gap-1">
                                <button onClick={() => handleViewDetail(item.id)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver detalle"><Eye size={15} /></button>
                                <button onClick={() => handlePrintPdf(item.id)} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Imprimir PDF"><Printer size={15} /></button>
                                {!item.entregado && (
                                    <>
                                        <button onClick={() => openEditForm(item.id)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar"><Edit3 size={15} /></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                                        <button onClick={() => handleMarkEntregado(item.id)} className="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Marcar entregada"><CheckCircle size={15} /></button>
                                    </>
                                )}
                            </td>
                        </tr>
                    )}
                />
                {totalDeliveryPages > 1 && (
                    <div className="px-2">
                        <Pagination
                            currentPage={listPage}
                            totalPages={totalDeliveryPages}
                            totalItems={totalDeliveries}
                            itemsOnPage={deliveries.length}
                            onPageChange={setListPage}
                            limit={15}
                        />
                    </div>
                )}
            </div>

            <Modal
                isOpen={showFormModal}
                onClose={() => { if (!isSaving) closeForm(); }}
                title={isEditing ? 'Editar Entrega de Remesas' : 'Nueva Entrega de Remesas'}
                maxWidth="max-w-4xl"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Fecha</label>
                            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Hora</label>
                            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Responsable</label>
                            <input type="text" value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Nombre del responsable" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Comentario</label>
                            <input type="text" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario opcional" className={inputCls} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={`${labelCls} block mb-1`}>Número de Referencia</label>
                            <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Número de referencia / documento" className={inputCls} />
                        </div>
                        <div>
                            <label className={`${labelCls} block mb-1`}>Monto de Entrega</label>
                            <MoneyInput
                                value={montoEntregado}
                                onChange={(e) => setMontoEntregado(e.target.value)}
                                placeholder="0.00"
                                className={inputCls + " font-mono"}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                Opcional si agrega remesas. Si solo ingresa monto, no es obligatorio seleccionar remesas.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
                        <div className="relative flex-1">
                            <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                                onKeyDown={handleScanKeyDown}
                                placeholder="Escanear o digitar código de remesa..."
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px]"
                            />
                        </div>
                        <button onClick={handleScanAdd} className="w-full md:w-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl border border-indigo-200 transition-all">Agregar</button>
                        <button
                            onClick={() => { setSearchPage(1); setSearchTerm(''); setSearchSelectedRemesas([]); setShowSearchModal(true); }}
                            className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all"
                        >
                            <Search size={14} />
                            Buscar Remesas
                        </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead>
                                <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Código</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Descripción</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Turno</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Fecha Turno</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">POS</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Vendedor</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right">Monto</th>
                                    <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {addedRemesas.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-12 text-center text-xs text-slate-400">
                                            <div className="flex flex-col items-center gap-2">
                                                <Handshake size={32} className="text-slate-200" />
                                                <span>No hay remesas agregadas. Escanee, busque remesas pendientes o ingrese solo el monto de entrega.</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {addedRemesas.map(r => (
                                    <tr key={r.id} className="text-[12px] hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-2 font-mono font-bold text-[11px] text-indigo-600">{r.codigo || r.id}</td>
                                        <td className="px-3 py-2 font-medium text-slate-800">{r.description || r.documento || '—'}</td>
                                        <td className="px-3 py-2 font-mono text-slate-600">#{turnoDe(r)}</td>
                                        <td className="px-3 py-2 text-slate-600">{fmtFechaTurno(r)}</td>
                                        <td className="px-3 py-2 text-slate-600">{r.pos_name || '—'}</td>
                                        <td className="px-3 py-2 text-slate-600">{r.seller_name || r.despachador_descripcion || '—'}</td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600"><Money value={r.monto} /></td>
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={() => handleRemoveRemesa(r.id)} className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Eliminar"><X size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50">
                                    <td colSpan={6} className="px-3 py-2 text-[11px] font-bold text-slate-600 text-right">
                                        Total remesas: {addedRemesas.length} — <span className="font-mono"><Money value={totalMonto} /></span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-[11px] text-slate-600">
                                        Entregado: <span className="text-lg text-indigo-600"><Money value={montoEfectivo} /></span>
                                    </td>
                                    <td></td>
                                </tr>
                                <tr className="bg-indigo-50/60">
                                    <td colSpan={7} className="px-3 py-2 text-[11px] font-bold text-slate-700 text-right">
                                        Diferencia (Entregado - Seleccionado):
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold">
                                        <span className={diferencia >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                            {diferencia >= 0 ? '+' : ''}<Money value={diferencia} />
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={closeForm} className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm">Cancelar</button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSaving ? 'Guardando...' : (isEditing ? 'Actualizar Entrega' : 'Guardar Entrega')}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showSearchModal} onClose={() => { setShowSearchModal(false); setSearchSelectedRemesas([]); }} title="Buscar Remesas Pendientes" maxWidth="max-w-4xl">
                <div className="space-y-3">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setSearchPage(1); }}
                            placeholder="Buscar por código, descripción o turno..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px]"
                            autoFocus
                        />
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100 w-8"></th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Código</th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Descripción</th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Turno</th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Fecha Turno</th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">POS</th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Vendedor</th>
                                <th className="px-2 py-1.5 bg-slate-50 border-b border-slate-100 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {searchLoading ? (
                                <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400"><Loader2 size={18} className="animate-spin inline-block" /> Buscando...</td></tr>
                            ) : pendingRemesas.length === 0 ? (
                                <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-400">No hay remesas pendientes.</td></tr>
                            ) : (
                                <RemesaSelectRows
                                    remesas={pendingRemesas}
                                    addedIds={new Set(addedRemesas.map(r => r.id))}
                                    selectedRemesas={searchSelectedRemesas}
                                    setSelectedRemesas={setSearchSelectedRemesas}
                                    onSelect={handleSelectRemesas}
                                    fmtFechaTurno={fmtFechaTurno}
                                    turnoDe={turnoDe}
                                />
                            )}
                        </tbody>
                    </table>
                    </div>
                    {totalPendingPages > 1 && (
                        <Pagination
                            currentPage={searchPage}
                            totalPages={totalPendingPages}
                            totalItems={totalPending}
                            itemsOnPage={pendingRemesas.length}
                            onPageChange={setSearchPage}
                            limit={15}
                        />
                    )}
                </div>
            </Modal>

            <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedDeliveryId(null); }} title="Detalle de Entrega" maxWidth="max-w-4xl">
                {deliveryDetail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl">
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Fecha</span>
                                <span className="text-[13px] font-medium">{new Date(deliveryDetail.fecha).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Hora</span>
                                <span className="text-[13px] font-medium">{deliveryDetail.hora}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Responsable</span>
                                <span className="text-[13px] font-medium">{deliveryDetail.responsable || '—'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Estado</span>
                                {deliveryDetail.entregado ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg mt-1"><CheckCircle size={13} /> Entregado</span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[11px] rounded-lg mt-1">Pendiente</span>
                                )}
                            </div>
                        </div>
                        {deliveryDetail.referencia && (
                            <div className="px-4 -mt-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Número de Referencia</span>
                                <span className="text-[13px] font-medium font-mono text-indigo-600">{deliveryDetail.referencia}</span>
                            </div>
                        )}
                        {deliveryDetail.comentario && (
                            <div className="px-4 -mt-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase block">Comentario</span>
                                <span className="text-[13px] font-medium">{deliveryDetail.comentario}</span>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 -mt-1">
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Monto Entregado</span>
                                <span className="text-lg font-mono font-bold text-emerald-700"><Money value={deliveryDetail.monto_entregado ?? deliveryDetail.monto_total} /></span>
                            </div>
                            <div className={`p-3 rounded-xl border ${parseFloat(deliveryDetail.diferencia || 0) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                <span className={`text-[10px] font-bold uppercase block ${parseFloat(deliveryDetail.diferencia || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Diferencia</span>
                                <span className={`text-lg font-mono font-bold ${parseFloat(deliveryDetail.diferencia || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {parseFloat(deliveryDetail.diferencia || 0) >= 0 ? '+' : ''}<Money value={deliveryDetail.diferencia || 0} />
                                </span>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase block">Total Remesas Seleccionadas</span>
                                <span className="text-lg font-mono font-bold text-indigo-700"><Money value={deliveryDetail.monto_total} /></span>
                            </div>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-separate border-spacing-0">
                                <thead>
                                    <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Código</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Descripción</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Turno</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Fecha Turno</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">POS</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100">Vendedor</th>
                                        <th className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {deliveryDetail.remesas?.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-400">
                                                Entrega manual sin remesas asociadas.
                                            </td>
                                        </tr>
                                    )}
                                    {deliveryDetail.remesas?.map(r => (
                                        <tr key={r.id} className="text-[12px]">
                                            <td className="px-3 py-2 font-mono font-bold text-[11px] text-indigo-600">{r.codigo || r.id}</td>
                                            <td className="px-3 py-2 font-medium text-slate-800">{r.description || r.documento || '—'}</td>
                                            <td className="px-3 py-2 font-mono text-slate-600">#{turnoDe(r)}</td>
                                            <td className="px-3 py-2 text-slate-600">{fmtFechaTurno(r)}</td>
                                            <td className="px-3 py-2 text-slate-600">{r.pos_name || '—'}</td>
                                            <td className="px-3 py-2 text-slate-600">{r.seller_name || r.despachador_descripcion || '—'}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600"><Money value={r.monto} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => handlePrintPdf(deliveryDetail.id)}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                            >
                                <Printer size={14} /> Imprimir PDF
                            </button>
                            {!deliveryDetail.entregado && (
                                <button
                                    onClick={() => { setShowDetailModal(false); openEditForm(deliveryDetail.id); }}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all"
                                >
                                    <Edit3 size={14} /> Editar
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const RemesaSelectRows = ({ remesas, addedIds, selectedRemesas, setSelectedRemesas, onSelect, fmtFechaTurno, turnoDe }) => {
    const allSelectedOnPage = remesas.length > 0 && remesas.every(r => selectedRemesas.some(s => s.id === r.id));

    const toggle = (remesa) => {
        setSelectedRemesas(prev => {
            const exists = prev.some(s => s.id === remesa.id);
            if (exists) return prev.filter(s => s.id !== remesa.id);
            return [...prev, remesa];
        });
    };

    const toggleAll = () => {
        setSelectedRemesas(prev => {
            const pageIds = new Set(remesas.map(r => r.id));
            const filtered = prev.filter(s => !pageIds.has(s.id));
            if (allSelectedOnPage) return filtered;
            return [...filtered, ...remesas];
        });
    };

    return (
        <>
            {remesas.map(r => {
                const isAdded = addedIds.has(r.id);
                const isSelected = selectedRemesas.some(s => s.id === r.id);
                return (
                    <tr key={r.id} className={`text-[12px] hover:bg-slate-50 transition-colors ${isAdded ? 'opacity-50' : ''}`}>
                        <td className="px-2 py-1.5">
                            <input type="checkbox" checked={isAdded || isSelected} disabled={isAdded} onChange={() => toggle(r)} className="accent-indigo-600 cursor-pointer" />
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-indigo-600">{r.codigo || r.id}</td>
                        <td className="px-2 py-1.5 font-medium">{r.description || r.documento || '—'}</td>
                        <td className="px-2 py-1.5 font-mono text-slate-600">#{turnoDe(r)}</td>
                        <td className="px-2 py-1.5 text-slate-600">{fmtFechaTurno(r)}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.pos_name || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.seller_name || r.despachador_descripcion || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-emerald-600"><Money value={r.monto} /></td>
                    </tr>
                );
            })}
            <tr>
                <td colSpan={8} className="px-2 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={allSelectedOnPage} onChange={toggleAll} className="accent-indigo-600" />
                            Seleccionar todo ({remesas.length})
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-500">{selectedRemesas.length} seleccionadas</span>
                            <button onClick={() => onSelect(selectedRemesas)} disabled={selectedRemesas.length === 0} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20">Agregar Seleccionadas</button>
                        </div>
                    </div>
                </td>
            </tr>
        </>
    );
};

export default SalesRemesaDeliveries;
