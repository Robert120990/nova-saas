import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import Money from '../components/ui/Money';
import SaleDetailModal from '../components/sales/SaleDetailModal';
import {
    Search, ArrowLeftRight, Eye, CheckCircle2, XCircle, AlertCircle, Clock, Ban,
    Calendar, User, Monitor, CalendarClock
} from 'lucide-react';

const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('es-SV');
};

const getStatusBadge = (status) => {
    switch (status) {
        case 'ACCEPTED':
            return <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><CheckCircle2 size={11} /> Aceptado</span>;
        case 'REJECTED':
        case 'RECHAZADO':
            return <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><XCircle size={11} /> Rechazado</span>;
        case 'SENT':
            return <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><Clock size={11} /> Enviado</span>;
        case 'anulado':
        case 'INVALIDADO':
            return <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><Ban size={11} /> Anulado</span>;
        default:
            return <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider"><AlertCircle size={11} /> Pendiente</span>;
    }
};

const ShiftDTEs = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canChangeShift = user?.role === 'SuperAdmin' || (Array.isArray(user?.permissions) ? user.permissions : []).includes('manage_dte_shift_change');

    // Selector de turno
    const [isShiftPickerOpen, setIsShiftPickerOpen] = useState(false);
    const [shiftSearchTerm, setShiftSearchTerm] = useState('');
    const [shiftSearch, setShiftSearch] = useState('');
    const [shiftStatus, setShiftStatus] = useState('');
    const [shiftPage, setShiftPage] = useState(1);
    const [selectedShiftId, setSelectedShiftId] = useState(null);

    // Lista de DTEs
    const [searchTerm, setSearchTerm] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState([]);

    // Detalle
    const [detailSaleId, setDetailSaleId] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Cambio de turno
    const [isChangeShiftOpen, setIsChangeShiftOpen] = useState(false);
    const [targetShiftId, setTargetShiftId] = useState('');
    const [changeIds, setChangeIds] = useState([]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setShiftSearch(shiftSearchTerm);
            setShiftPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [shiftSearchTerm]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: shiftsData = { data: [], total: 0, totalPages: 0 }, isLoading: isLoadingShifts } = useQuery({
        queryKey: ['shifts', 'history', shiftSearch, shiftStatus, shiftPage],
        queryFn: async () => (await axios.get('/api/shifts', {
            params: {
                search: shiftSearch,
                status: shiftStatus || undefined,
                branch_id: user?.branch_id,
                page: shiftPage,
                limit: 10
            }
        })).data,
    });

    const selectedShift = selectedShiftId ? (shiftsData.data.find(s => s.id == selectedShiftId) || null) : null;

    const { data: dtesData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: isLoadingDTEs } = useQuery({
        queryKey: ['shift-dtes', selectedShiftId, search, page],
        queryFn: async () => (await axios.get('/api/sales', {
            params: { shift_id: selectedShiftId, has_dte: 'true', search, page, limit: 15 }
        })).data,
        enabled: !!selectedShiftId
    });

    const changeShiftMutation = useMutation({
        mutationFn: async ({ ids, shift_id }) => (await axios.put('/api/sales/change-shift', { ids, shift_id })).data,
        onSuccess: (data) => {
            toast.success(data.message || 'Ventas cambiadas de turno correctamente');
            setIsChangeShiftOpen(false);
            setTargetShiftId('');
            setSelected([]);
            queryClient.invalidateQueries({ queryKey: ['shift-dtes'] });
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al cambiar las ventas de turno');
        }
    });

    const handleSelectShift = (shift) => {
        setSelectedShiftId(shift.id);
        setSelected([]);
        setPage(1);
        setSearchTerm('');
        setIsShiftPickerOpen(false);
    };

    const handleOpenChangeShift = (ids) => {
        if (!ids || ids.length === 0) return;
        setChangeIds(ids);
        setTargetShiftId('');
        setIsChangeShiftOpen(true);
    };

    const targetShifts = selectedShift
        ? (shiftsData.data || []).filter(s => s.branch_id == selectedShift.branch_id && s.id != selectedShift.id)
        : [];

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selected.length === dtesData.data.length) {
            setSelected([]);
        } else {
            setSelected(dtesData.data.map(s => s.id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">DTEs por Turno</h2>
                    <p className="text-slate-500 font-medium">Filtra los DTE emitidos por turno y cámbialos de turno</p>
                </div>
            </div>

            {/* Selector de Turno */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600"><CalendarClock size={20} /></div>
                        <div>
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Turno seleccionado</span>
                            {selectedShift ? (
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-lg font-black text-slate-900">Turno #{selectedShift.shift_number || selectedShift.id}</span>
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                        selectedShift.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        {selectedShift.status === 'open' ? 'Abierto' : 'Cerrado'}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-sm font-bold text-slate-400">Ningún turno seleccionado</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => setIsShiftPickerOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                    >
                        <Search size={15} /> Seleccionar Turno
                    </button>
                </div>

                {selectedShift && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><Calendar size={12} className="inline mr-1" />Fecha</span>
                            <span className="font-black text-slate-700 text-xs">{formatDate(selectedShift.shift_date || selectedShift.start_time)}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><User size={12} className="inline mr-1" />Responsable</span>
                            <span className="font-black text-slate-700 text-xs uppercase">{selectedShift.seller_name || 'N/A'}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><Monitor size={12} className="inline mr-1" />Sucursal / Terminal</span>
                            <span className="font-black text-slate-700 text-xs uppercase block">{selectedShift.branch_name || 'Central'}</span>
                            <span className="font-bold text-indigo-400 text-[9px] uppercase tracking-tighter">{selectedShift.pos_name || 'Principal'}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ventas del Turno</span>
                            <span className="font-black text-slate-700 text-sm"><Money value={selectedShift.total_sales || 0} /></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de DTEs */}
            {selectedShift && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="relative max-w-md flex-1 min-w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nro. control, código o cliente..."
                                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {canChangeShift && (
                            <button
                                onClick={() => handleOpenChangeShift(selected)}
                                disabled={selected.length === 0 || changeShiftMutation.isPending}
                                className={`flex items-center gap-2 px-5 py-2.5 font-black text-xs uppercase tracking-widest rounded-2xl transition-all ${
                                    selected.length > 0
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <ArrowLeftRight size={15} />
                                {changeShiftMutation.isPending ? 'Procesando...' : `Cambiar a otro turno (${selected.length})`}
                            </button>
                        )}
                    </div>

                    <Table
                        headers={[
                            ...(canChangeShift ? [''] : []),
                            'Fecha', 'Documento', 'Cliente', 'Estado MH', 'Total', 'Acciones'
                        ]}
                        data={dtesData.data}
                        isLoading={isLoadingDTEs}
                        renderRow={(sale) => (
                            <tr key={sale.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-sm">
                                {canChangeShift && (
                                    <td className="px-4 py-1 w-8">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                            checked={selected.includes(sale.id)}
                                            onChange={() => toggleSelect(sale.id)}
                                        />
                                    </td>
                                )}
                                <td className="px-4 py-1">
                                    <span className="text-[11px] font-bold text-slate-600 block leading-tight">
                                        {formatDate(sale.fecha_emision)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium lowercase tracking-tighter">
                                        {sale.hora_emision}
                                    </span>
                                </td>
                                <td className="px-4 py-1">
                                    <div className="flex flex-col leading-[1.1]">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-bold text-slate-900 text-[10px] truncate leading-none">{sale.tipo_documento_name}</span>
                                            {sale.codigo_generacion && (
                                                sale.dte_ambiente === '01' ? (
                                                    <span className="text-[7px] px-1 py-px bg-emerald-50 text-emerald-600 rounded font-black uppercase tracking-wider leading-none">Prod</span>
                                                ) : (
                                                    <span className="text-[7px] px-1 py-px bg-amber-50 text-amber-600 rounded font-black uppercase tracking-wider leading-none">Pruebas</span>
                                                )
                                            )}
                                        </div>
                                        <span className="text-[10.25px] font-mono font-bold text-indigo-500 opacity-80 truncate max-w-[300px]" title={`Control: ${sale.numero_control}`}>{sale.numero_control}</span>
                                        <span className="text-[9.25px] font-mono text-emerald-600/80 truncate mt-0 max-w-[300px]" title={`Generación: ${sale.codigo_generacion}`}>{sale.codigo_generacion}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-1">
                                    <div className="flex flex-col leading-tight">
                                        <span className="font-bold text-slate-700 text-[9px] truncate max-w-[300px]" title={sale.customer_name}>{sale.customer_name || 'Consumidor Final'}</span>
                                        <span className={`text-[8px] px-1 rounded w-fit font-black uppercase tracking-widest ${
                                            sale.condicion_operacion == 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                            {sale.condicion_operacion == 1 ? 'Contado' : 'Crédito'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-1">
                                    {getStatusBadge(sale.dte_status)}
                                </td>
                                <td className="px-4 py-1 font-black text-slate-900 text-[12.5px]">
                                    <Money value={sale.total_pagar} />
                                </td>
                                <td className="px-6 py-1 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button
                                            onClick={() => { setDetailSaleId(sale.id); setIsDetailOpen(true); }}
                                            className="p-2 rounded-xl transition-all flex items-center gap-1 border bg-white text-slate-400 hover:text-indigo-600 border-slate-100"
                                            title="Ver detalle"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {canChangeShift && (
                                            <button
                                                onClick={() => handleOpenChangeShift([sale.id])}
                                                disabled={changeShiftMutation.isPending}
                                                className="p-2 rounded-xl transition-all flex items-center gap-1 border bg-white text-slate-400 hover:text-indigo-600 border-slate-100 disabled:opacity-50"
                                                title="Cambiar a otro turno"
                                            >
                                                <ArrowLeftRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    />
                    <div className="flex items-center justify-between">
                        {canChangeShift && (
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                    checked={selected.length > 0 && selected.length === dtesData.data.length}
                                    onChange={toggleSelectAll}
                                    disabled={dtesData.data.length === 0}
                                />
                                Seleccionar página ({dtesData.data.length})
                            </label>
                        )}
                        <Pagination
                            currentPage={page}
                            totalPages={dtesData.totalPages}
                            totalItems={dtesData.totalItems}
                            onPageChange={setPage}
                            itemsOnPage={dtesData.data.length}
                            isLoading={isLoadingDTEs}
                        />
                    </div>
                </div>
            )}

            {!selectedShift && (
                <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 text-center">
                    <CalendarClock size={40} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Seleccione un turno para ver sus DTE emitidos</p>
                </div>
            )}

            {/* Modal Selector de Turno */}
            <Modal
                isOpen={isShiftPickerOpen}
                onClose={() => setIsShiftPickerOpen(false)}
                title="Seleccionar Turno"
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por vendedor o terminal..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                value={shiftSearchTerm}
                                onChange={(e) => setShiftSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all cursor-pointer"
                            value={shiftStatus}
                            onChange={(e) => { setShiftStatus(e.target.value); setShiftPage(1); }}
                        >
                            <option value="">Todos los estados</option>
                            <option value="open">Abiertos</option>
                            <option value="closed">Cerrados</option>
                        </select>
                    </div>

                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                        {isLoadingShifts ? (
                            <div className="flex justify-center py-10">
                                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                        ) : shiftsData.data.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron turnos</div>
                        ) : (
                            shiftsData.data.map(shift => (
                                <button
                                    key={shift.id}
                                    onClick={() => handleSelectShift(shift)}
                                    className={`w-full flex items-center justify-between gap-4 p-4 rounded-2xl border text-left transition-all ${
                                        selectedShiftId == shift.id
                                            ? 'bg-indigo-50 border-indigo-200 ring-4 ring-indigo-500/5'
                                            : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-xl ${shift.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <CalendarClock size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-900">Turno #{shift.shift_number || shift.id}</span>
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                                                    shift.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {shift.status === 'open' ? 'Abierto' : 'Cerrado'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block">
                                                {formatDateTime(shift.start_time)} • {shift.branch_name || `Sucursal ${shift.branch_id}`} • {shift.pos_name} • {shift.seller_name}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventas</span>
                                        <span className="text-sm font-black text-slate-900"><Money value={shift.total_sales || 0} /></span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{shiftsData.total} turno(s)</span>
                        <Pagination
                            currentPage={shiftPage}
                            totalPages={shiftsData.totalPages}
                            totalItems={shiftsData.total}
                            onPageChange={setShiftPage}
                            itemsOnPage={shiftsData.data.length}
                            isLoading={isLoadingShifts}
                        />
                    </div>
                </div>
            </Modal>

            {/* Modal Cambiar de Turno */}
            <Modal
                isOpen={isChangeShiftOpen}
                onClose={() => setIsChangeShiftOpen(false)}
                title="Cambiar DTE a otro Turno"
                maxWidth="max-w-xl"
            >
                <div className="space-y-5">
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 text-indigo-800 rounded-3xl border border-indigo-100 text-xs">
                        <ArrowLeftRight size={20} className="shrink-0" />
                        <div>
                            <p className="font-black uppercase tracking-widest mb-1">Confirmar Cambio de Turno</p>
                            <p className="font-medium">
                                {changeIds.length} DTE(s) se moverán del turno actual. Los totales de ambos turnos se recalcularán automáticamente.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Turno Destino</label>
                        {targetShifts.length === 0 ? (
                            <div className="p-4 bg-slate-50 rounded-2xl text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                No hay turnos disponibles de la misma sucursal
                            </div>
                        ) : (
                            <select
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all cursor-pointer"
                                value={targetShiftId}
                                onChange={(e) => setTargetShiftId(e.target.value)}
                            >
                                <option value="">Seleccione un turno destino...</option>
                                {targetShifts.map(shift => (
                                    <option key={shift.id} value={shift.id}>
                                        Turno #{shift.shift_number || shift.id} — {formatDate(shift.shift_date || shift.start_time)} — {shift.pos_name} — {shift.seller_name} ({shift.status === 'open' ? 'Abierto' : 'Cerrado'})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsChangeShiftOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                            disabled={changeShiftMutation.isPending}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => changeShiftMutation.mutate({ ids: changeIds, shift_id: targetShiftId })}
                            disabled={!targetShiftId || changeShiftMutation.isPending}
                            className="px-8 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {changeShiftMutation.isPending ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <ArrowLeftRight size={16} />
                            )}
                            Confirmar Cambio
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Detalle (incluye JSON DTE y Respuesta MH) */}
            <SaleDetailModal
                saleId={detailSaleId}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
            />
        </div>
    );
};

export default ShiftDTEs;
