import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { History, Eye, Lock, Unlock, Search, Pencil, Trash2, Loader2, AlertTriangle, Printer, Database, CheckCircle, XCircle, LockOpen, Calendar, Hash, FileEdit } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { downloadCloseoutPdf } from '../utils/closeoutPdf';
import Money from '../components/ui/Money';

const GasReadingHistory = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [rrsModal, setRrsModal] = useState(null);
    const [reopenConfirm, setReopenConfirm] = useState(null);
    const [fechaTurnoModal, setFechaTurnoModal] = useState(null);
    const [editFecha, setEditFecha] = useState('');
    const [editNumeroTurno, setEditNumeroTurno] = useState('');
    const [changesModal, setChangesModal] = useState(null);
    const clickTimerRef = useRef(null);
    const clickCountsRef = useRef({});

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['gas-closeouts', debouncedSearch, page, user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/closeouts', { params: { search: debouncedSearch, page, branch_id: user?.branch_id } })).data
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/closeouts/${id}`),
        onSuccess: () => {
            toast.success('Cierre eliminado');
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
            queryClient.invalidateQueries({ queryKey: ['gas-last-turno'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const sendToRrsMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/gas-station/closeouts/${id}/send-to-rrs`),
        onSuccess: () => {
            toast.success('Cierre enviado a RRS exitosamente');
            setRrsModal(null);
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al enviar a RRS')
    });

    const reopenMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/gas-station/closeouts/${id}/reopen`),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Cierre reabierto exitosamente');
            setReopenConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al reabrir cierre')
    });

    const updateFechaTurnoMutation = useMutation({
        mutationFn: ({ id, fecha_turno, numero_turno }) => axios.patch(`/api/gas-station/closeouts/${id}/fecha-turno`, { fecha_turno, numero_turno }),
        onSuccess: () => {
            toast.success('Fecha y turno actualizados correctamente');
            setFechaTurnoModal(null);
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
            queryClient.invalidateQueries({ queryKey: ['gas-last-turno'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al actualizar fecha y turno')
    });

    const { data: changesData = [], isLoading: changesLoading } = useQuery({
        queryKey: ['gas-closeout-changes', changesModal?.id],
        queryFn: async () => (await axios.get(`/api/gas-station/closeouts/${changesModal.id}/changes`)).data,
        enabled: !!changesModal
    });

    const permissions = user?.permissions || [];
    const isSuperAdmin = user?.role === 'SuperAdmin';
    const canReopenCloseout = isSuperAdmin || permissions.includes('manage_gas_closeout_reopen');

    const handleView = (item) => {
        navigate(`/gas-station/cierre-lecturas?editId=${item.id}`);
    };

    const handleEdit = (item) => {
        navigate(`/gas-station/cierre-lecturas?editId=${item.id}`);
    };

    const handlePdf = async (item) => {
        try {
            const { data } = await axios.get(`/api/gas-station/closeouts/${item.id}/print-full`);
            await downloadCloseoutPdf(data);
        } catch (error) {
            toast.error('Error al generar PDF');
        }
    };

    const handleTurnoClicks = (c) => {
        if (!isSuperAdmin) return;
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = setTimeout(() => {
            clickCountsRef.current[c.id] = 0;
        }, 3000);
        const nextCount = (clickCountsRef.current[c.id] || 0) + 1;
        clickCountsRef.current[c.id] = nextCount;
        if (nextCount >= 5) {
            clickCountsRef.current[c.id] = 0;
            clearTimeout(clickTimerRef.current);
            setEditFecha(c.fecha_turno ? c.fecha_turno.split('T')[0] : '');
            setEditNumeroTurno(c.numero_turno ?? '');
            setFechaTurnoModal(c);
        }
    };

    const handleSaveFechaTurno = () => {
        if (!fechaTurnoModal || !editFecha || !editNumeroTurno) return;
        updateFechaTurnoMutation.mutate({
            id: fechaTurnoModal.id,
            fecha_turno: editFecha,
            numero_turno: editNumeroTurno
        });
    };

    const SECTION_LABELS = {
        gastos: 'Gastos', remesas: 'Remesas', cupones: 'Cupones', descuentos: 'Descuentos',
        adelantos: 'Adelantos', tarjetas: 'Tarjetas', creditos: 'Créditos', vales: 'Vales',
        anticipos: 'Anticipos despachados', lubricantes: 'Lubricantes', despachadores: 'Despachadores',
        nozzles: 'Mangueras', fecha_turno: 'Fecha/Turno', reopen: 'Reapertura', reclose: 'Recierre'
    };

    const ACTION_LABELS = { update: 'Modificación', create: 'Creación', delete: 'Eliminación', reopen: 'Reapertura', reclose: 'Recierre' };

    const FIELD_LABELS = {
        rubro: 'Rubro', fecha: 'Fecha', documento: 'Documento', tipo: 'Tipo', proveedor: 'Proveedor',
        valor: 'Valor', monto: 'Monto', descripcion: 'Descripción', codigo: 'Código', cupon: 'Cupón',
        distribuidora_nombre: 'Distribuidora', distribuidora_id: 'Distribuidora',
        producto_codigo: 'Cód. Producto', producto_descripcion: 'Producto', cantidad: 'Cantidad',
        precio: 'Precio', total: 'Total', cliente_nombre: 'Cliente', tipo_documento: 'Tipo Doc.',
        placa: 'Placa', kilometraje: 'Kilometraje', empleado: 'Empleado', num_tarjeta: 'No. Tarjeta',
        num_autorizacion: 'No. Autorización', pos_type_id: 'POS', tipo_operacion: 'Tipo Operación',
        lectura_inicial: 'Lect. Inicial', recarga: 'Recarga', lectura_final: 'Lect. Final',
        ventas: 'Ventas', nombre: 'Nombre', despachador_id: 'Despachador', nozzle_id: 'Manguera',
        numero_turno: 'No. Turno', fecha_turno: 'Fecha Turno', estado: 'Estado',
        producto_id: 'Producto', cliente_id: 'Cliente', provider_id: 'Proveedor'
    };

    const MONEY_FIELDS = ['valor', 'monto', 'precio', 'total'];

    const formatValue = (field, value) => {
        if (value === null || value === undefined || value === '') return <span className="text-slate-300">—</span>;
        if (MONEY_FIELDS.includes(field)) return <Money value={value} />;
        if (field === 'fecha' || field === 'fecha_turno') {
            const d = new Date(value);
            return isNaN(d) ? String(value) : d.toLocaleDateString('es-SV');
        }
        return String(value);
    };

    const renderRowSummary = (row) => {
        const keys = Object.keys(row).filter(k => !['id', 'closeout_id', 'despachador_codigo', 'despachador_descripcion', 'pos_type_nombre', 'proveedor_nombre', 'saldo_disponible'].includes(k));
        return keys.map(k => (
            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-600">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{FIELD_LABELS[k] || k}</span>
                {formatValue(k, row[k])}
            </span>
        ));
    };

    const renderChangeDetail = (ch) => {
        const details = ch.details;
        if (ch.section === 'fecha_turno' && details?.before) {
            return (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-600">
                    <span className="text-slate-400 line-through decoration-rose-300">
                        {new Date(details.before.fecha_turno).toLocaleDateString('es-SV')} #{details.before.numero_turno}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="font-bold text-emerald-700">
                        {new Date(details.after.fecha_turno).toLocaleDateString('es-SV')} #{details.after.numero_turno}
                    </span>
                </div>
            );
        }
        return (
            <div className="space-y-1.5">
                {details?.modified?.length > 0 && (
                    <div className="space-y-1">
                        {details.modified.map((m, i) => (
                            <div key={i} className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-2 py-1.5 space-y-0.5">
                                {m.changes.map((c, j) => (
                                    <div key={j} className="flex flex-wrap items-center gap-1 text-[11px]">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{FIELD_LABELS[c.field] || c.field}</span>
                                        <span className="text-slate-400 line-through decoration-rose-300">{formatValue(c.field, c.old)}</span>
                                        <span className="text-slate-400">→</span>
                                        <span className="font-bold text-indigo-700">{formatValue(c.field, c.new)}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
                {details?.added?.length > 0 && (
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2 py-1.5 space-y-1">
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">Agregados</span>
                        {details.added.map((row, i) => (
                            <div key={i} className="flex flex-wrap gap-1">{renderRowSummary(row)}</div>
                        ))}
                    </div>
                )}
                {details?.removed?.length > 0 && (
                    <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-2 py-1.5 space-y-1">
                        <span className="text-[9px] font-bold text-rose-600 uppercase">Eliminados</span>
                        {details.removed.map((row, i) => (
                            <div key={i} className="flex flex-wrap gap-1">{renderRowSummary(row)}</div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <History size={20} className="text-indigo-600" />
                        Historial de Lecturas
                    </h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Cierres de lectura registrados</p>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por turno o vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Fecha', 'Turno #', 'Vendedor', 'Estado', 'Galones Vendidos', 'Total Monto', 'Diferencia', 'RRS', 'Cambios', 'Acciones']}
                    data={response.data}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">
                                    {new Date(c.fecha_turno).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                <button
                                    type="button"
                                    onClick={() => handleTurnoClicks(c)}
                                    className="text-xs font-mono font-bold text-slate-900 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                                >
                                    {c.numero_turno}
                                </button>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600">{c.seller_name}</td>
                            <td className="px-3 py-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    c.estado === 'cerrado'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}>
                                    {c.estado === 'cerrado' ? <Lock size={10} /> : <Unlock size={10} />}
                                    {c.estado}
                                </span>
                            </td>
                            <td className="px-3 py-1 text-xs font-mono font-bold text-indigo-600">{parseFloat(c.total_diferencia).toFixed(5)}</td>
                            <td className="px-3 py-1 text-xs font-mono font-bold text-slate-900"><Money value={c.total_monto} /></td>
                            <td className="px-3 py-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                                    parseFloat(c.total_diferencia_efectivo) >= 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                    {parseFloat(c.total_diferencia_efectivo) >= 0 ? '+' : ''}
                                    <Money value={c.total_diferencia_efectivo} />
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-bold uppercase ${
                                    c.rrs_enviado_at
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {c.rrs_enviado_at ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                    {c.rrs_enviado_at ? (
                                        <span title={new Date(c.rrs_enviado_at).toLocaleString('es-SV')}>Enviado</span>
                                    ) : 'Pendiente'}
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                {parseInt(c.cambios_count) > 0 ? (
                                    <button
                                        onClick={() => setChangesModal(c)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                                        title="Ver cambios realizados al reabrir"
                                    >
                                        <FileEdit size={10} />
                                        {c.cambios_count} cambio{parseInt(c.cambios_count) > 1 ? 's' : ''}
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-slate-300">—</span>
                                )}
                            </td>
                            <td className="px-3 py-1">
                                <div className="flex items-center gap-1">
                                    {c.estado === 'cerrado' ? (
                                        <>
                                            {canReopenCloseout && (
                                                <button
                                                    onClick={() => setReopenConfirm(c)}
                                                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Reabrir cierre con permiso especial"
                                                >
                                                    <LockOpen size={15} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleView(c)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Ver detalle"
                                            >
                                                <Eye size={15} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEdit(c)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Editar cierre"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(c)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Eliminar cierre"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handlePdf(c)}
                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Descargar PDF"
                                    >
                                        <Printer size={15} />
                                    </button>
                                    {c.estado === 'cerrado' && (
                                        <button
                                            onClick={() => setRrsModal(c)}
                                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title={c.rrs_enviado_at ? 'Reenviar a RRS' : 'Enviar a RRS'}
                                        >
                                            <Database size={15} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Pagination
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={response.data.length}
                isLoading={isLoading}
            />

            {/* Delete confirmation modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Eliminar Cierre"
                maxWidth="max-w-sm"
            >
                <div className="text-center py-4">
                    <AlertTriangle size={40} className="mx-auto text-rose-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700 mb-1">
                        ¿Eliminar Turno #{deleteConfirm?.numero_turno}?
                    </p>
                    <p className="text-xs text-slate-400">Esta acción no se puede deshacer.</p>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                    </button>
                </div>
            </Modal>

            {/* RRS Send modal */}
            <Modal
                isOpen={!!rrsModal}
                onClose={() => setRrsModal(null)}
                title={rrsModal?.rrs_enviado_at ? 'Reenviar a RRS' : 'Enviar a RRS'}
                maxWidth="max-w-sm"
            >
                <div className="text-center py-4">
                    <Database size={40} className="mx-auto text-emerald-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700 mb-1">
                        Turno #{rrsModal?.numero_turno} — {new Date(rrsModal?.fecha_turno).toLocaleDateString('es-SV')}
                    </p>
                    <p className="text-xs text-slate-400">
                        {rrsModal?.rrs_enviado_at
                            ? `Enviado previamente el ${new Date(rrsModal.rrs_enviado_at).toLocaleString('es-SV')}. Al reenviar se eliminarán los datos existentes y se volverán a insertar.`
                            : 'El cierre será enviado a la base de datos RRS (empresa 015).'}
                    </p>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setRrsModal(null)}
                        className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => sendToRrsMutation.mutate(rrsModal?.id)}
                        disabled={sendToRrsMutation.isPending}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {sendToRrsMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                        {sendToRrsMutation.isPending
                            ? 'Enviando...'
                            : rrsModal?.rrs_enviado_at ? 'Reenviar' : 'Enviar'}
                    </button>
                </div>
            </Modal>

            {/* Reopen confirmation modal */}
            <Modal
                isOpen={!!reopenConfirm}
                onClose={() => setReopenConfirm(null)}
                title="Reabrir Cierre"
                maxWidth="max-w-sm"
            >
                <div className="text-center py-4">
                    <LockOpen size={40} className="mx-auto text-amber-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700 mb-1">
                        ¿Reabrir Turno #{reopenConfirm?.numero_turno}?
                    </p>
                    <p className="text-xs text-slate-400">
                        El cierre se marcará como reabierto. Podrá editar los datos del turno, pero no podrá modificar las lecturas ni los tanques.
                    </p>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setReopenConfirm(null)}
                        className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => reopenMutation.mutate(reopenConfirm.id)}
                        disabled={reopenMutation.isPending}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {reopenMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <LockOpen size={14} />}
                        {reopenMutation.isPending ? 'Reabriendo...' : 'Reabrir'}
                    </button>
                </div>
            </Modal>

            {/* Cambiar fecha y turno (acceso oculto SuperAdmin) */}
            <Modal
                isOpen={!!fechaTurnoModal}
                onClose={() => setFechaTurnoModal(null)}
                title="Cambiar Fecha y Turno"
                maxWidth="max-w-sm"
            >
                <div className="space-y-3">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Fecha de Turno</label>
                        <div className="relative">
                            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="date"
                                value={editFecha}
                                onChange={(e) => setEditFecha(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Número de Turno</label>
                        <div className="relative">
                            <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={editNumeroTurno}
                                onChange={(e) => setEditNumeroTurno(e.target.value)}
                                placeholder="Ej: 1"
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                            />
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        El cambio aplica sin importar el estado del cierre. Si el cierre fue enviado a RRS, el envío se reiniciará para poder reenviarlo.
                    </p>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setFechaTurnoModal(null)}
                        className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveFechaTurno}
                        disabled={updateFechaTurnoMutation.isPending || !editFecha || !editNumeroTurno}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {updateFechaTurnoMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                        {updateFechaTurnoMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </Modal>

            {/* Modal de cambios realizados en cierre reabierto */}
            <Modal
                isOpen={!!changesModal}
                onClose={() => setChangesModal(null)}
                title={`Cambios del Turno #${changesModal?.numero_turno || ''}`}
                maxWidth="max-w-4xl"
            >
                <p className="text-[11px] text-slate-500 mb-3">
                    {changesModal && (
                        <>Fecha: <span className="font-bold text-slate-700">{new Date(changesModal.fecha_turno).toLocaleDateString('es-SV')}</span> · Vendedor: <span className="font-bold text-slate-700">{changesModal.seller_name}</span></>
                    )}
                </p>
                <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Fecha/Hora</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Usuario</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Sección</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Acción</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {changesLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center">
                                        <Loader2 size={20} className="mx-auto text-indigo-500 animate-spin" />
                                    </td>
                                </tr>
                            ) : changesData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400 italic text-xs">
                                        No se encontraron cambios registrados
                                    </td>
                                </tr>
                            ) : changesData.map(ch => (
                                <tr key={ch.id} className="align-top hover:bg-slate-50/60 transition-colors">
                                    <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                                        {new Date(ch.created_at).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-3 py-2 text-[11px] font-bold text-slate-700 whitespace-nowrap">{ch.username || '—'}</td>
                                    <td className="px-3 py-2">
                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-indigo-50 text-indigo-600 whitespace-nowrap">
                                            {SECTION_LABELS[ch.section] || ch.section}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase whitespace-nowrap ${
                                            ch.action === 'delete'
                                            ? 'bg-rose-50 text-rose-600'
                                            : ch.action === 'reopen' || ch.action === 'reclose'
                                            ? 'bg-amber-50 text-amber-600'
                                            : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {ACTION_LABELS[ch.action] || ch.action}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="space-y-1.5">
                                            <p className="text-[11px] font-bold text-slate-700">{ch.description}</p>
                                            {ch.details ? renderChangeDetail(ch) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>

        </div>
    );
};

export default GasReadingHistory;
