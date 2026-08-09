import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { History, Eye, Lock, Unlock, Search, Pencil, Trash2, Loader2, AlertTriangle, Printer, Database, CheckCircle, XCircle, LockOpen, Calendar, Hash } from 'lucide-react';
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
                    headers={['Fecha', 'Turno #', 'Vendedor', 'Estado', 'Galones Vendidos', 'Total Monto', 'Diferencia', 'RRS', 'Acciones']}
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

        </div>
    );
};

export default GasReadingHistory;
