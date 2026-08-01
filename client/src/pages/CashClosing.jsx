import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { printTicket } from '../utils/qzPrint';
import { 
    Calculator, 
    History, 
    FileText, 
    TrendingUp, 
    Clock, 
    User, 
    Monitor,
    ChevronRight,
    Search,
    AlertCircle,
    CheckCircle2,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Printer,
    Trash2,
    Users,
    Plus,
    X,
    Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import Money, { MoneyInput } from '../components/ui/Money';
import Pagination from '../components/ui/Pagination';

const CashClosing = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canEditShift = user?.role === 'SuperAdmin' || (Array.isArray(user?.permissions) ? user.permissions : []).includes('manage_shifts_edit');
    
    // UI State
    const [selectedPos, setSelectedPos] = useState('');
    const [openingBalance, setOpeningBalance] = useState('');
    
    // History Filters State
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLimit, setHistoryLimit] = useState(15);
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [showHistorySearch, setShowHistorySearch] = useState(false);
    const [showHistoryDates, setShowHistoryDates] = useState(false);
    const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState(null);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [actualCash, setActualCash] = useState('');
    const [shiftSummary, setShiftSummary] = useState(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [expenses, setExpenses] = useState([{ description: '', amount: '' }]);
    const [incomes, setIncomes] = useState([{ description: '', amount: '', payment_method: '01' }]);
    const [remesas, setRemesas] = useState([{ description: '', amount: '' }]);
    const [arqueoActiveTab, setArqueoActiveTab] = useState('incomes');
    const [selectedResponsibleId, setSelectedResponsibleId] = useState('');
    const [selectedSellers, setSelectedSellers] = useState([]);
    const [isEditSellersModalOpen, setIsEditSellersModalOpen] = useState(false);
    const [editingShiftSellers, setEditingShiftSellers] = useState(null);
    const [shiftSellersList, setShiftSellersList] = useState([]);
    const [isEditShiftModalOpen, setIsEditShiftModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [editForm, setEditForm] = useState({ seller_id: '', pos_id: '', opening_balance: '', shift_number: '' });

    const updateShiftMutation = useMutation({
        mutationFn: async ({ id, data }) => (await axios.put(`/api/shifts/${id}`, data)).data,
        onSuccess: () => {
            toast.success('Turno actualizado correctamente');
            setIsEditShiftModalOpen(false);
            setEditingShift(null);
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al actualizar el turno');
        }
    });

    const deleteShiftMutation = useMutation({
        mutationFn: async (id) => (await axios.delete(`/api/shifts/${id}`)).data,
        onSuccess: () => {
            toast.success('Turno eliminado correctamente');
            setIsEditShiftModalOpen(false);
            setEditingShift(null);
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al eliminar el turno');
        }
    });

    // Queries
    const { data: currentShiftStatus, isLoading: isLoadingStatus } = useQuery({
        queryKey: ['shifts', 'current'],
        queryFn: async () => (await axios.get('/api/shifts/current', {
                params: { branch_id: user.branch_id }
            })).data,
    });

    // Summary query for the current active shift
    const { data: activeSummary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['shifts', 'summary', selectedShiftId || currentShiftStatus?.shift?.id],
        queryFn: async () => {
            const shiftId = selectedShiftId || currentShiftStatus?.shift?.id;
            if (!shiftId) return null;
            return (await axios.get(`/api/shifts/${shiftId}/summary`)).data;
        },
        enabled: !!currentShiftStatus?.shift?.id,
    });

    const { data: shiftsHistoryData = { data: [], total: 0, totalPages: 0 }, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['shifts', 'history', historySearch, historyStartDate, historyEndDate, historyPage, historyLimit],
        queryFn: async () => (await axios.get('/api/shifts', {
            params: {
                search: historySearch,
                start_date: historyStartDate,
                end_date: historyEndDate,
                branch_id: user.branch_id,
                page: historyPage,
                limit: historyLimit
            }
        })).data,
    });
    const shiftsHistory = shiftsHistoryData.data || [];

    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers'],
        queryFn: async () => (await axios.get('/api/sellers', { params: { limit: 1000 } })).data?.data || []
    });

    const { data: posList = [] } = useQuery({
        queryKey: ['pos', user.branch_id],
        queryFn: async () => (await axios.get(`/api/pos?branch_id=${user.branch_id}`)).data,
    });

    // Filtrar por sucursal actual y solo vendedores activos
    const branchSellers = sellers.filter(s => s.branch_id == user.branch_id && s.status === 'activo');
    // Vendedores no asignados a ningún turno activo
    const availableSellers = branchSellers.filter(s => !s.assigned_shift_id);
    const branchPOS = posList.filter(p => p.branch_id == user.branch_id);

    const { data: paymentMethods = [] } = useQuery({
        queryKey: ['catalogs', 'cat_017_forma_pago'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_017_forma_pago')).data,
    });

    // Mutations
    const openShiftMutation = useMutation({
        mutationFn: async (data) => (await axios.post('/api/shifts/open', data)).data,
        onSuccess: () => {
            queryClient.invalidateQueries(['shifts']);
            setIsOpeningModalOpen(false);
            setSelectedSellers([]);
            setSelectedResponsibleId('');
            toast.success('Turno abierto correctamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al abrir turno')
    });

    const closeShiftMutation = useMutation({
        mutationFn: async ({ id, actualCash, expenses, incomes, remesas }) => (await axios.post(`/api/shifts/${id}/close`, { actual_cash: actualCash, expenses, incomes, remesas })).data,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['shifts']);
            setShiftSummary(data.summary);
            setIsClosingModalOpen(false);
            setIsSummaryModalOpen(true);
            setExpenses([{ description: '', amount: '' }]); // Reset
            setIncomes([{ description: '', amount: '', payment_method: '01' }]); // Reset
            setRemesas([{ description: '', amount: '' }]); // Reset
            toast.success('Turno cerrado correctamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al cerrar turno')
    });

    const updateSellersMutation = useMutation({
        mutationFn: async ({ id, seller_ids }) => (await axios.put(`/api/shifts/${id}/sellers`, { seller_ids })).data,
        onSuccess: () => {
            queryClient.invalidateQueries(['shifts']);
            setIsEditSellersModalOpen(false);
            setEditingShiftSellers(null);
            setShiftSellersList([]);
            toast.success('Vendedores actualizados correctamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar vendedores')
    });

    const loadSummary = async (shiftId) => {
        if (!shiftId) return;
        try {
            const { data } = await axios.get(`/api/shifts/${shiftId}/summary`);
            setShiftSummary(data);
        } catch (err) {
            toast.error('Error al cargar el resumen del turno');
            return;
        }
        setActualCash('');
        setExpenses([{ description: '', amount: '' }]);
        setIncomes([{ description: '', amount: '', payment_method: '01' }]);
        setRemesas([{ description: '', amount: '' }]);
        setIsClosingModalOpen(true);
    };

    const handleViewHistoryReport = async (shiftId) => {
        try {
            const res = await axios.get(`/api/shifts/${shiftId}/summary`);
            setShiftSummary(res.data);
            setIsSummaryModalOpen(true);
        } catch (err) {
            toast.error('Error al cargar el reporte del turno');
        }
    };

    const handleOpenShift = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        openShiftMutation.mutate({
            seller_id: formData.get('seller_id'),
            pos_id: formData.get('pos_id'),
            branch_id: user.branch_id || formData.get('branch_id'),
            opening_balance: parseFloat(openingBalance),
            assigned_sellers: selectedSellers
        });
    };

    const handleOpenEditSellers = async (shift) => {
        try {
            const { data } = await axios.get(`/api/shifts/${shift.id}/sellers`);
            setEditingShiftSellers(shift);
            setShiftSellersList(data);
            setIsEditSellersModalOpen(true);
        } catch (err) {
            toast.error('Error al cargar vendedores del turno');
        }
    };

    const handleSaveEditSellers = () => {
        if (!editingShiftSellers) return;
        const sellerIds = shiftSellersList.map(s => s.seller_id);
        updateSellersMutation.mutate({
            id: editingShiftSellers.id,
            seller_ids: sellerIds
        });
    };

    if (isLoadingStatus) return <div className="p-8 text-center text-slate-500 font-bold">Cargando gestión de caja...</div>;

    const currentShift = currentShiftStatus?.shift;
    const activeShifts = currentShiftStatus?.shifts || (currentShift ? [currentShift] : []);

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Corte de Caja
                        <span className="text-sm font-black uppercase px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">Administración</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Gestión de turnos, arqueos y trazabilidad financiera.</p>
                </div>
                <button 
                    onClick={() => setIsOpeningModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center gap-3"
                >
                    <Calculator size={18} />
                    Nueva Apertura
                </button>
            </div>

            {/* Active Shifts */}
            {activeShifts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeShifts.map(shift => (
                <div key={shift.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Turno Activo</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{shift.pos_name || 'Sin terminal'}</span>
                            {shift.shift_number && <span className="text-[10px] font-black text-indigo-500">#{shift.shift_number}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <span className="text-[9px] font-black uppercase text-slate-400">Vendedor Responsable</span>
                            <p className="text-xs font-bold text-slate-700 truncate">{shift.seller_name || 'Sin asignar'}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-black uppercase text-slate-400">Fondo Inicial</span>
                            <p className="text-sm font-black text-slate-900"><Money value={shift.opening_balance} /></p>
                        </div>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mb-2">
                        {new Date(shift.start_time).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' — '}
                        {new Date(shift.start_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                    {activeSummary && activeShifts[0]?.id === shift.id && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mb-3">
                            <div>
                                <span className="text-[9px] font-black uppercase text-slate-400">Ventas Totales</span>
                                <p className="text-sm font-black text-slate-900"><Money value={activeSummary.total_sales || 0} /></p>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] font-black uppercase text-slate-400">Efectivo en Caja</span>
                                <p className="text-sm font-black text-emerald-600">
                                    <Money value={(parseFloat(activeSummary.opening_balance) || 0) + (parseFloat(activeSummary.cash) || 0)} />
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between mb-3 pt-2 border-t border-slate-100">
                        <div>
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Vendedores</span>
                            <button
                                onClick={() => handleOpenEditSellers(shift)}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all"
                            >
                                <Users size={12} />
                                {shift.seller_name ? `${shift.seller_name} y más` : 'Gestionar'}
                            </button>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setSelectedShiftId(shift.id); loadSummary(shift.id); }}
                        className="w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-wider flex items-center justify-center gap-2 transition-all"
                    >
                        Realizar Arqueo
                        <Calculator size={14} />
                    </button>
                </div>
                    ))}
                </div>
            )}
            {activeShifts.length === 0 && (
                <div className="bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-400 mx-auto mb-6">
                        <AlertCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-400 tracking-tight">No hay turnos activos</h2>
                    <p className="text-slate-400 font-medium mt-2 max-w-md mx-auto">Debe abrir un turno para comenzar a registrar ventas en la terminal.</p>
                </div>
            )}

            {/* History Table */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <History size={24} className="text-indigo-600" />
                        Historial de Turnos
                    </h3>
                    <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowHistorySearch(!showHistorySearch)}
                                className={`p-3 rounded-2xl transition-all border ${showHistorySearch ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600'}`}
                                title="Buscar por nombre o terminal"
                            >
                                <Search size={18} />
                            </button>
                            <button 
                                onClick={() => setShowHistoryDates(!showHistoryDates)}
                                className={`p-3 rounded-2xl transition-all border ${showHistoryDates ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600'}`}
                                title="Filtrar por fecha"
                            >
                                <Calendar size={18} />
                            </button>
                        </div>

                        {/* Expandable Filter UI */}
                        <div className="flex flex-wrap gap-2 justify-end">
                            {showHistorySearch && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <input 
                                        type="text"
                                        placeholder="Buscar cajero o terminal..."
                                        value={historySearch}
                                        onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-64 shadow-sm"
                                    />
                                </div>
                            )}
                            {showHistoryDates && (
                                <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Desde</span>
                                        <input 
                                            type="date"
                                            value={historyStartDate}
                                            onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                                            className="text-sm text-slate-600 border-none p-0 focus:ring-0 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Hasta</span>
                                        <input 
                                            type="date"
                                            value={historyEndDate}
                                            onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                                            className="text-sm text-slate-600 border-none p-0 focus:ring-0 outline-none"
                                        />
                                    </div>
                                    {(historyStartDate || historyEndDate) && (
                                        <button 
                                            onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); setHistoryPage(1); }}
                                            className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
                                            title="Limpiar fechas"
                                        >
                                            <AlertCircle size={18} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Inicio / Fin</th>
                                    <th className="px-6 py-3 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Turno</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsable</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">POS</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Esperado</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Contado</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Diferencia</th>
                                    <th className="px-6 py-3 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shiftsHistory.length > 0 ? shiftsHistory.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900">{new Date(shift.start_time).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                                    {new Date(shift.start_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })} - {shift.end_time ? new Date(shift.end_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }) : 'Abierto'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="text-xs font-black text-indigo-600">#{shift.shift_number || '-'}</span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-[10px] font-black">
                                                    {shift.seller_name?.charAt(0)}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{shift.seller_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{shift.pos_name}</span>
                                        </td>
                                        <td className="px-6 py-3 text-right tabular-nums">
                                            <span className="text-sm font-bold text-slate-700"><Money value={shift.expected_cash || 0} /></span>
                                        </td>
                                        <td className="px-6 py-3 text-right tabular-nums">
                                            <span className="text-sm font-bold text-slate-700"><Money value={shift.actual_cash || 0} /></span>
                                        </td>
                                        <td className="px-6 py-3 text-right tabular-nums">
                                            <span className={`text-sm font-black flex items-center justify-end gap-1 ${parseFloat(shift.actual_cash - shift.expected_cash) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {parseFloat(shift.actual_cash - shift.expected_cash || 0).toFixed(2)}
                                                {parseFloat(shift.actual_cash - shift.expected_cash || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button 
                                                    title="Ver Arqueo / Reporte"
                                                    onClick={() => handleViewHistoryReport(shift.id)}
                                                    className="p-2.5 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                {canEditShift && (
                                                    <button 
                                                        title="Editar / Eliminar Turno"
                                                        onClick={() => { 
                                                            setEditingShift(shift); 
                                                            setEditForm({ 
                                                                seller_id: shift.seller_id || '', 
                                                                pos_id: shift.pos_id || '', 
                                                                opening_balance: shift.opening_balance?.toString() || '', 
                                                                shift_number: shift.shift_number?.toString() || '' 
                                                            }); 
                                                            setIsEditShiftModalOpen(true); 
                                                        }}
                                                        className="p-2.5 bg-slate-100 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="8" className="px-8 py-12 text-center text-slate-400 font-medium italic">No hay historial de turnos disponible.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        currentPage={historyPage}
                        totalPages={shiftsHistoryData.totalPages}
                        totalItems={shiftsHistoryData.total}
                        itemsOnPage={shiftsHistory.length}
                        onPageChange={(p) => setHistoryPage(p)}
                        limit={historyLimit}
                        onLimitChange={(l) => { setHistoryLimit(l); setHistoryPage(1); }}
                        isLoading={isLoadingHistory}
                    />
                </div>
            </div>

            {/* Modal: Apertura de Caja */}
            <Modal
                isOpen={isOpeningModalOpen}
                onClose={() => { setIsOpeningModalOpen(false); setSelectedSellers([]); setSelectedResponsibleId(''); }}
                title="Apertura de Turno"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleOpenShift} className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Vendedor Responsable</label>
                            <select name="seller_id" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                value={selectedResponsibleId}
                                onChange={(e) => {
                                    setSelectedResponsibleId(e.target.value);
                                    // Limpiar seleccionados si ya no son elegibles
                                    setSelectedSellers(prev => prev.filter(id => id !== Number(e.target.value)));
                                }}
                            >
                                <option value="">Seleccione vendedor</option>
                                {availableSellers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                        {selectedResponsibleId && (
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Vendedores Adicionales</label>
                            <div className="max-h-40 overflow-y-auto space-y-0.5 px-1 custom-scrollbar border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                                {availableSellers.filter(s => s.id != selectedResponsibleId).length > 0 ? availableSellers
                                    .filter(s => s.id != selectedResponsibleId)
                                    .map(s => (
                                        <label key={s.id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${selectedSellers.includes(s.id) ? 'bg-indigo-50' : 'hover:bg-slate-100'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedSellers.includes(s.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedSellers([...selectedSellers, s.id]);
                                                    } else {
                                                        setSelectedSellers(selectedSellers.filter(id => id !== s.id));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs font-bold text-slate-700">{s.nombre}</span>
                                        </label>
                                    )) : (
                                    <p className="text-[10px] text-slate-400 italic text-center py-3">No hay otros vendedores disponibles en esta sucursal</p>
                                )}
                            </div>
                        </div>
                        )}
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Punto de Venta (Terminal)</label>
                            <select name="pos_id" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all">
                                <option value="">Seleccione terminal</option>
                                {branchPOS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Fondo Inicial (Efectivo)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={openingBalance}
                                    onChange={(e) => setOpeningBalance(e.target.value)}
                                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xl font-black outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setIsOpeningModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                        <button 
                            type="submit" 
                            disabled={openShiftMutation.isPending}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                        >
                            {openShiftMutation.isPending ? 'Abriendo...' : 'Abrir Turno'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal: Editar Vendedores del Turno */}
            <Modal
                isOpen={isEditSellersModalOpen}
                onClose={() => { setIsEditSellersModalOpen(false); setEditingShiftSellers(null); setShiftSellersList([]); }}
                title={`Vendedores — Turno #${editingShiftSellers?.shift_number || ''}`}
                maxWidth="max-w-md"
            >
                {editingShiftSellers && (
                    <div className="space-y-6 pt-4">
                        <p className="text-xs font-bold text-slate-500 px-1">
                            Responsable: <span className="text-indigo-600">{editingShiftSellers.seller_name}</span>
                        </p>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Vendedores Asignados</label>
                            <div className="max-h-60 overflow-y-auto space-y-0.5 px-1 custom-scrollbar border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                                {branchSellers.filter(s => s.id != editingShiftSellers.seller_id && (!s.assigned_shift_id || s.assigned_shift_id === editingShiftSellers.id)).length > 0 ? branchSellers
                                    .filter(s => s.id != editingShiftSellers.seller_id && (!s.assigned_shift_id || s.assigned_shift_id === editingShiftSellers.id))
                                    .map(s => {
                                        const isAssigned = shiftSellersList.some(sl => sl.seller_id === s.id);
                                        return (
                                            <label key={s.id} className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${isAssigned ? 'bg-indigo-50' : 'hover:bg-slate-100'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isAssigned}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setShiftSellersList([...shiftSellersList, {
                                                                seller_id: s.id,
                                                                seller_name: s.nombre
                                                            }]);
                                                        } else {
                                                            setShiftSellersList(shiftSellersList.filter(sl => sl.seller_id !== s.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-xs font-bold text-slate-700">{s.nombre}</span>
                                            </label>
                                        );
                                    }) : (
                                    <p className="text-[10px] text-slate-400 italic text-center py-3">No hay otros vendedores disponibles en esta sucursal</p>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={() => { setIsEditSellersModalOpen(false); setEditingShiftSellers(null); setShiftSellersList([]); }} 
                                className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveEditSellers}
                                disabled={updateSellersMutation.isPending}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-30"
                            >
                                {updateSellersMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal: Arqueo de Caja (Cierre) */}
            <Modal
                isOpen={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                title="Realizar Arqueo de Caja"
                maxWidth="max-w-5xl"
            >
                {shiftSummary && (
                    <div className="flex flex-col gap-8 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            {/* Resumen de Valores Esperados */}
                            <div className="md:col-span-5 bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6 flex flex-col justify-between">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-6">Desglose Detallado de Ventas</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-400 italic">
                                            <span>Saldo Inicial (Fondo)</span>
                                            <span><Money value={shiftSummary.opening_balance || 0} /></span>
                                        </div>
                                        
                                        {/* Detalle Dinámico de Métodos */}
                                        {shiftSummary.methods?.map(method => (
                                            <div key={method.code} className="flex justify-between items-center text-sm font-bold text-slate-400 italic">
                                                <span>{method.name}</span>
                                                <span className={method.code === '01' ? 'text-emerald-500' : 'text-indigo-400'}>
                                                    +<Money value={method.total || 0} />
                                                </span>
                                            </div>
                                        ))}

                                        {/* Sección de Otros Ingresos (Resumen) */}
                                        {incomes.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) > 0 && (
                                            <div className="flex justify-between items-center text-sm font-bold text-emerald-600 italic pt-2 border-t border-slate-200">
                                                <span>Otros Ingresos</span>
                                                <span>+${incomes.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0).toFixed(2)}</span>
                                            </div>
                                        )}
                                        
                                        {/* Sección de Gastos (Resumen) */}
                                        {expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) > 0 && (
                                            <div className="flex justify-between items-center text-sm font-bold text-rose-500 italic">
                                                <span>Total Gastos</span>
                                                <span>-${expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0).toFixed(2)}</span>
                                            </div>
                                        )}

                                        {/* Sección de Remesas (Resumen) */}
                                        {remesas.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) > 0 && (
                                            <div className="flex justify-between items-center text-sm font-bold text-amber-600 italic">
                                                <span>Total Remesas</span>
                                                <span>-${remesas.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0).toFixed(2)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-200 my-4"></div>
                                <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase text-slate-900 tracking-widest">Efectivo Físico Esperado</span>
                                        <span className="text-[10px] text-slate-400 font-bold italic">(Saldo + Cash Sales + Cash In - Expenses - Remesas)</span>
                                    </div>
                                    <span className="text-3xl font-black text-emerald-600">
                                        ${(
                                            (parseFloat(shiftSummary.opening_balance) || 0) + 
                                            (parseFloat(shiftSummary.cash) || 0) + 
                                            incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                            expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                            remesas.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
                                        ).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Formularios de Ajuste - Tabs */}
                            <div className="md:col-span-7 space-y-4">
                                {/* Tab Bar */}
                                <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl">
                                    {[
                                        { key: 'incomes', label: 'Ingresos', color: 'emerald', total: incomes.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0) },
                                        { key: 'remesas', label: 'Remesas', color: 'amber', total: remesas.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0) },
                                        { key: 'expenses', label: 'Gastos', color: 'rose', total: expenses.reduce((a, e) => a + (parseFloat(e.amount) || 0), 0) },
                                    ].map(tab => (
                                        <button key={tab.key} onClick={() => setArqueoActiveTab(tab.key)}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${arqueoActiveTab === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                            {tab.label}
                                            {tab.total > 0 && <span className="ml-1.5 tabular-nums text-slate-500">(${tab.total.toFixed(2)})</span>}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content: Ingresos */}
                                {arqueoActiveTab === 'incomes' && (
                                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Otros Ingresos</h5>
                                            <button onClick={() => setIncomes([...incomes, { description: '', amount: '', payment_method: '01' }])}
                                                className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase">+ Agregar</button>
                                        </div>
                                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                            {incomes.map((inc, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <input className="flex-[2] px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-emerald-300"
                                                        placeholder="Motivo" value={inc.description}
                                                        onChange={(e) => { const n = [...incomes]; n[idx].description = e.target.value; setIncomes(n); }} />
                                                    <select className="flex-1 px-2 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none"
                                                        value={inc.payment_method}
                                                        onChange={(e) => { const n = [...incomes]; n[idx].payment_method = e.target.value; setIncomes(n); }}>
                                                        {paymentMethods.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                                                    </select>
                                                    <input type="number" className="w-28 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-emerald-300 text-right"
                                                        placeholder="0.00" value={inc.amount}
                                                        onChange={(e) => { const n = [...incomes]; n[idx].amount = e.target.value; setIncomes(n); }} />
                                                    {incomes.length > 1 && (
                                                        <button onClick={() => setIncomes(incomes.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tab Content: Remesas */}
                                {arqueoActiveTab === 'remesas' && (
                                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Remesas / Entregas</h5>
                                            <button onClick={() => setRemesas([...remesas, { description: '', amount: '' }])}
                                                className="text-[10px] font-black text-amber-600 hover:text-amber-700 uppercase">+ Agregar</button>
                                        </div>
                                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                            {remesas.map((rem, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <span className="w-5 text-[10px] font-black text-amber-600 text-center shrink-0">#{idx + 1}</span>
                                                    <input className="flex-[2] px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-amber-300"
                                                        placeholder="Descripción" value={rem.description}
                                                        onChange={(e) => { const n = [...remesas]; n[idx].description = e.target.value; setRemesas(n); }} />
                                                    <input type="number" className="w-28 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-amber-300 text-right"
                                                        placeholder="0.00" value={rem.amount}
                                                        onChange={(e) => { const n = [...remesas]; n[idx].amount = e.target.value; setRemesas(n); }} />
                                                    {remesas.length > 1 && (
                                                        <button onClick={() => setRemesas(remesas.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tab Content: Gastos */}
                                {arqueoActiveTab === 'expenses' && (
                                    <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Gastos Caja Chica</h5>
                                            <button onClick={() => setExpenses([...expenses, { description: '', amount: '' }])}
                                                className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase">+ Agregar</button>
                                        </div>
                                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                            {expenses.map((exp, idx) => (
                                                <div key={idx} className="flex gap-2 items-center">
                                                    <input className="flex-[2] px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-rose-300"
                                                        placeholder="Descripción" value={exp.description}
                                                        onChange={(e) => { const n = [...expenses]; n[idx].description = e.target.value; setExpenses(n); }} />
                                                    <input type="number" className="w-28 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-rose-300 text-right"
                                                        placeholder="0.00" value={exp.amount}
                                                        onChange={(e) => { const n = [...expenses]; n[idx].amount = e.target.value; setExpenses(n); }} />
                                                    {expenses.length > 1 && (
                                                        <button onClick={() => setExpenses(expenses.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Entrada de Efectivo Contado */}
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Efectivo Contado (Físico)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={actualCash}
                                            onChange={(e) => setActualCash(e.target.value)}
                                            className="w-full pl-12 pr-4 py-6 bg-slate-50 border border-slate-100 rounded-3xl text-4xl font-black outline-none focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-400 transition-all tabular-nums"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    
                                    {actualCash && (
                                        <div className={`mt-4 p-4 rounded-2xl flex justify-between items-center ${
                                            (parseFloat(actualCash) - (
                                                (parseFloat(shiftSummary.opening_balance) || 0) + 
                                                (parseFloat(shiftSummary.cash) || 0) + 
                                                incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                                expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                                remesas.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
                                            )) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                        }`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Diferencia</span>
                                            <span className="text-xl font-black tabular-nums">
                                                $ {(parseFloat(actualCash) - (
                                                    (parseFloat(shiftSummary.opening_balance) || 0) + 
                                                    (parseFloat(shiftSummary.cash) || 0) + 
                                                    incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                                    expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                                    remesas.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
                                                )).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <button 
                                onClick={() => {
                                        const totalCashIncomings = (parseFloat(shiftSummary.opening_balance) || 0) + (parseFloat(shiftSummary.cash) || 0) + incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                                        const totalExp = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) + remesas.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                                        if (totalExp > totalCashIncomings) {
                                            return toast.error('El total de gastos y remesas no puede superar el efectivo disponible (Fondo + Ventas Cash + Ingresos Cash)');
                                        }
                                        closeShiftMutation.mutate({ 
                                            id: shiftSummary?.id || selectedShiftId || activeShifts[0]?.id, 
                                            actualCash, 
                                            expenses: expenses.filter(e => parseFloat(e.amount) > 0),
                                            incomes: incomes.filter(i => parseFloat(i.amount) > 0),
                                            remesas: remesas.filter(r => parseFloat(r.amount) > 0)
                                        });
                                    }}
                                    disabled={!actualCash || closeShiftMutation.isPending}
                                    className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                                >
                                    {closeShiftMutation.isPending ? 'Procesando...' : 'Finalizar Turno'}
                                    <CheckCircle2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal: Resumen Final (Corte X) */}
            <Modal
                isOpen={isSummaryModalOpen}
                onClose={() => setIsSummaryModalOpen(false)}
                title={shiftSummary?.status === 'active' ? "Resumen de Turno en Curso" : "Reporte de Arqueo (Corte X)"}
                maxWidth="max-w-lg"
            >
                {shiftSummary && (
                    <div className="text-center py-6 space-y-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-20 h-20 ${shiftSummary.status === 'active' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'} rounded-[2.5rem] flex items-center justify-center shadow-sm`}>
                                {shiftSummary.status === 'active' ? <Clock size={40} /> : <CheckCircle2 size={40} />}
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                                    {shiftSummary.status === 'active' ? 'Turno en Curso' : 'Turno Cerrado'}
                                </h4>
                                <p className="text-slate-500 font-medium font-mono text-[10px] uppercase tracking-widest mt-1">Turno: #{shiftSummary.shift_number || shiftSummary.id}</p>
                            </div>
                        </div>

                        <div id="arqueo-print-area" className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 space-y-6">
                            {/* Bloque de Totales de Arqueo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Esperado en Caja</span>
                                    <span className="text-lg font-black text-slate-900"><Money value={shiftSummary.expected || 0} /></span>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left border-l-4 border-l-indigo-500">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Contado Físico</span>
                                    <span className="text-lg font-black text-slate-900"><Money value={shiftSummary.actual || 0} /></span>
                                </div>
                            </div>

                            {/* Diferencia Destacada */}
                            <div className={`p-4 rounded-2xl flex justify-between items-center ${parseFloat(shiftSummary.difference) >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                <span className="text-xs font-black uppercase tracking-[0.2em]">Diferencia</span>
                                <span className="text-2xl font-black tabular-nums">
                                    {parseFloat(shiftSummary.difference) > 0 ? '+' : ''}<Money value={shiftSummary.difference || 0} />
                                </span>
                            </div>

                            <div className="h-px bg-slate-200"></div>

                            {/* Desglose de Ventas por Método */}
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-left px-1">Ventas por Método</h5>
                                <div className="space-y-2">
                                    {shiftSummary.methods?.map(m => (
                                        <div key={m.code} className="flex justify-between items-center text-sm font-bold">
                                            <span className="text-slate-500 italic">{m.name}</span>
                                            <span className="text-slate-900"><Money value={m.total || 0} /></span>
                                        </div>
                                    ))}
                                    {(!shiftSummary.methods || shiftSummary.methods.length === 0) && <p className="text-[10px] text-slate-300 italic">No se registraron ventas</p>}
                                </div>
                            </div>

                            <div className="h-px bg-slate-200"></div>

                            {/* Otros Ingresos y Gastos Detallados */}
                            <div className="space-y-4">
                                {parseFloat(shiftSummary.total_incomes || 0) > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 p-2 rounded-lg">
                                            <span>Otros Ingresos</span>
                                            <span>+<Money value={shiftSummary.total_incomes || 0} /></span>
                                        </div>
                                        <div className="px-1 space-y-1">
                                            {shiftSummary.incomes?.map((inc, i) => (
                                                <div key={i} className="flex justify-between text-[10px] font-bold text-slate-400">
                                                    <span className="truncate pr-4">{inc.description} <span className="opacity-50 font-normal">({inc.method || 'Efectivo'})</span></span>
                                                    <span className="shrink-0">+<Money value={inc.amount} /></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {parseFloat(shiftSummary.total_expenses || 0) > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 p-2 rounded-lg">
                                            <span>Gastos Administrativos</span>
                                            <span>-<Money value={shiftSummary.total_expenses || 0} /></span>
                                        </div>
                                        <div className="px-1 space-y-1">
                                            {shiftSummary.expenses?.map((exp, i) => (
                                                <div key={i} className="flex justify-between text-[10px] font-bold text-slate-400">
                                                    <span className="truncate pr-4">{exp.description}</span>
                                                    <span className="shrink-0">-<Money value={exp.amount} /></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {parseFloat(shiftSummary.total_remesas || 0) > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 p-2 rounded-lg">
                                            <span>Remesas / Entregas</span>
                                            <span>-<Money value={shiftSummary.total_remesas || 0} /></span>
                                        </div>
                                        <div className="px-1 space-y-1">
                                            {shiftSummary.remesas?.map((rem, i) => (
                                                <div key={i} className="flex justify-between text-[10px] font-bold text-slate-400">
                                                    <span className="truncate pr-4">#{rem.numero} {rem.description}</span>
                                                    <span className="shrink-0">-<Money value={rem.amount} /></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={async () => {
                                    const s = shiftSummary;
                                    if (!s) return;
                                    const totalSales = parseFloat(s.total_sales || 0);
                                    const catsHtml = (s.salesByCategory || []).map(c => {
                                        const pct = totalSales > 0 ? ((c.total / totalSales) * 100).toFixed(1) : 0;
                                        return `<div class="row"><span>${c.categoria}</span><span>$${c.total.toFixed(2)} (${pct}%)</span></div>`;
                                    }).join('');
                                    const methodsHtml = (s.methods || []).map(m => 
                                        `<div class="row"><span>${m.name}</span><span>$${m.total.toFixed(2)}</span></div>`
                                    ).join('');
                                    const expensesHtml = (s.expenses || []).map(e =>
                                        `<div class="row"><span>${e.description}</span><span>-$${e.amount.toFixed(2)}</span></div>`
                                    ).join('');
                                    const incomesHtml = (s.incomes || []).map(i =>
                                        `<div class="row"><span>Ingreso: ${i.description}</span><span>+$${i.amount.toFixed(2)}</span></div>`
                                    ).join('');
                                    const remesasHtml = (s.remesas || []).map(r =>
                                        `<div class="row"><span>#${r.numero} ${r.description}</span><span>-$${r.amount.toFixed(2)}</span></div>`
                                    ).join('');

                                    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Arqueo</title>
                                    <style>
                                        @page { margin: 0; }
                                        body { 
                                            font-family: 'Courier New', Courier, monospace; 
                                            width: 80mm; 
                                            margin: 0; 
                                            padding: 5mm;
                                            font-size: 11px;
                                            line-height: 1.3;
                                        }
                                        .center { text-align: center; }
                                        .bold { font-weight: bold; }
                                        .dashed { border-top: 1px dashed #000; margin: 6px 0; }
                                        .row { display: flex; justify-content: space-between; }
                                    </style></head><body>
                                    <div class="center bold" style="font-size:13px;">ARQUEO DE TURNO</div>
                                    <div class="center" style="font-size:9px;">${s.status === 'closed' ? 'CERRADO' : 'ACTIVO'}</div>
                                    <div class="center" style="font-size:9px; margin-top:3px;">${s.pos_name || 'Sin terminal'} — ${s.branch_name || ''}</div>
                                    <div class="center" style="font-size:8px; margin-top:2px;">Vendedor: ${s.seller_name || 'Sin asignar'}</div>
                                    <div class="center" style="font-size:8px;">Apertura: ${new Date(s.start_time).toLocaleString('es-SV')}</div>
                                    ${s.end_time ? `<div class="center" style="font-size:8px;">Cierre: ${new Date(s.end_time).toLocaleString('es-SV')}</div>` : ''}
                                    <div class="center" style="font-size:9px; margin-top:3px;">${new Date().toLocaleDateString('es-SV')} — ${new Date().toLocaleTimeString('es-SV')}</div>
                                    <div class="dashed"></div>
                                    <div class="row bold"><span>Fondo Inicial</span><span>$${parseFloat(s.opening_balance || 0).toFixed(2)}</span></div>
                                    <div class="dashed"></div>
                                    <div class="bold" style="margin-bottom:2px;">VENTAS POR MÉTODO</div>${methodsHtml}
                                    <div class="row bold" style="margin-top:4px;"><span>TOTAL VENTAS</span><span>$${totalSales.toFixed(2)}</span></div>
                                    <div class="dashed"></div>
                                    ${catsHtml ? `<div class="bold" style="margin-bottom:2px;">VENTAS POR CATEGORÍA</div>${catsHtml}<div class="dashed"></div>` : ''}
                                    ${incomesHtml ? `<div class="bold" style="margin-bottom:2px;">INGRESOS</div>${incomesHtml}<div class="dashed"></div>` : ''}
                                    ${remesasHtml ? `<div class="bold" style="margin-bottom:2px;">REMAS</div>${remesasHtml}<div class="dashed"></div>` : ''}
                                    ${expensesHtml ? `<div class="bold" style="margin-bottom:2px;">GASTOS</div>${expensesHtml}<div class="dashed"></div>` : ''}
                                    <div class="row bold"><span>Esperado en Caja</span><span>$${(s.expected || 0).toFixed(2)}</span></div>
                                    <div class="row bold"><span>Contado Físico</span><span>$${(s.actual || 0).toFixed(2)}</span></div>
                                    <div class="row bold"><span>Diferencia</span><span>$${(s.difference || 0).toFixed(2)}</span></div>
                                    <div class="dashed"></div>
                                    <div class="center" style="font-size:8px; margin-top:6px;">Impreso ${new Date().toLocaleString('es-SV')}</div>
                                    </body></html>`;

                                    // Verificar si el POS tiene QZ Tray con impresora configurada
                                    let qzSuccess = false;
                                    if (s.pos_id) {
                                        try {
                                            const { data: posList } = await axios.get('/api/pos');
                                            const pos = Array.isArray(posList) ? posList.find(p => p.id == s.pos_id) : null;
                                            if (pos?.auto_print && pos?.printer_name) {
                                                const qzResult = await printTicket(html, pos.printer_name);
                                                qzSuccess = qzResult?.success;
                                            }
                                        } catch(e) {}
                                    }

                                    if (!qzSuccess) {
                                        // Fallback: vista previa normal
                                        const pw = window.open('', '_blank', 'width=400,height=600');
                                        pw.document.write(html);
                                        pw.document.close();
                                        pw.focus();
                                    }
                                }}
                                className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 shadow-xl"
                            >
                                <Printer size={18} />
                                Imprimir Reporte Arqueo
                            </button>
                            <button onClick={() => setIsSummaryModalOpen(false)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cerrar Detalle</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal: Editar / Eliminar Turno */}
            <Modal
                isOpen={isEditShiftModalOpen}
                onClose={() => { setIsEditShiftModalOpen(false); setEditingShift(null); }}
                title={`Editar Turno #${editingShift?.shift_number || ''}`}
                maxWidth="max-w-md"
            >
                {editingShift && (
                    <div className="space-y-5 pt-4">
                        <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal</span>
                                <span className="text-sm font-bold text-slate-900">{editingShift.branch_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inicio</span>
                                <span className="text-sm font-bold text-slate-900">
                                    {new Date(editingShift.start_time).toLocaleString('es-SV', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {editingShift.end_time && (
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fin</span>
                                    <span className="text-sm font-bold text-slate-900">
                                        {new Date(editingShift.end_time).toLocaleString('es-SV', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estado</span>
                                <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${editingShift.status === 'open' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {editingShift.status === 'open' ? 'Abierto' : 'Cerrado'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Ventas</span>
                                <span className="text-sm font-black text-slate-900">
                                    <Money value={editingShift.total_sales || 0} />
                                </span>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">N° Turno</label>
                                    <input type="number" value={editForm.shift_number}
                                        onChange={(e) => setEditForm({ ...editForm, shift_number: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Vendedor Responsable</label>
                                    <select value={editForm.seller_id}
                                        onChange={(e) => setEditForm({ ...editForm, seller_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none">
                                        {branchSellers.filter(s => !s.assigned_shift_id || s.assigned_shift_id === editingShift.id).map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">POS / Terminal</label>
                                    <select value={editForm.pos_id}
                                        onChange={(e) => setEditForm({ ...editForm, pos_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none">
                                        {posList.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Fondo Inicial</label>
                                    <MoneyInput value={editForm.opening_balance}
                                        onChange={(e) => setEditForm({ ...editForm, opening_balance: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => updateShiftMutation.mutate({ id: editingShift.id, data: editForm })}
                                disabled={updateShiftMutation.isPending}
                                className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                            >
                                {updateShiftMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                                <CheckCircle2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (window.confirm('¿Está seguro de eliminar este turno? Esta acción no se puede deshacer.')) {
                                        deleteShiftMutation.mutate(editingShift.id);
                                    }
                                }}
                                disabled={deleteShiftMutation.isPending}
                                className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                            >
                                {deleteShiftMutation.isPending ? 'Eliminando...' : 'Eliminar Turno'}
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default CashClosing;
