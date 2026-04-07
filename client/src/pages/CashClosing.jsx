import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
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
    Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

const CashClosing = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    // UI State
    const [selectedPos, setSelectedPos] = useState('');
    const [openingBalance, setOpeningBalance] = useState('');
    
    // History Filters State
    const [historySearch, setHistorySearch] = useState('');
    const [historyStartDate, setHistoryStartDate] = useState('');
    const [historyEndDate, setHistoryEndDate] = useState('');
    const [showHistorySearch, setShowHistorySearch] = useState(false);
    const [showHistoryDates, setShowHistoryDates] = useState(false);
    const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [actualCash, setActualCash] = useState('');
    const [shiftSummary, setShiftSummary] = useState(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [expenses, setExpenses] = useState([{ description: '', amount: '' }]);
    const [incomes, setIncomes] = useState([{ description: '', amount: '', payment_method: '01' }]);

    // Queries
    const { data: currentShiftStatus, isLoading: isLoadingStatus } = useQuery({
        queryKey: ['shifts', 'current'],
        queryFn: async () => (await axios.get('/api/shifts/current')).data,
    });

    // Summary query for the current active shift
    const { data: activeSummary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['shifts', 'summary', currentShiftStatus?.shift?.id],
        queryFn: async () => (await axios.get(`/api/shifts/${currentShiftStatus.shift.id}/summary`)).data,
        enabled: !!currentShiftStatus?.shift?.id,
    });

    const { data: shiftsHistory = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ['shifts', 'history', historySearch, historyStartDate, historyEndDate],
        queryFn: async () => (await axios.get('/api/shifts', {
            params: {
                search: historySearch,
                start_date: historyStartDate,
                end_date: historyEndDate
            }
        })).data,
    });

    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers'],
        queryFn: async () => (await axios.get('/api/sellers')).data?.data || []
    });

    const { data: posList = [] } = useQuery({
        queryKey: ['pos'],
        queryFn: async () => (await axios.get('/api/pos')).data,
    });

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
            toast.success('Turno abierto correctamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al abrir turno')
    });

    const closeShiftMutation = useMutation({
        mutationFn: async ({ id, actualCash, expenses, incomes }) => (await axios.post(`/api/shifts/${id}/close`, { actual_cash: actualCash, expenses, incomes })).data,
        onSuccess: (data) => {
            queryClient.invalidateQueries(['shifts']);
            setShiftSummary(data.summary);
            setIsClosingModalOpen(false);
            setIsSummaryModalOpen(true);
            setExpenses([{ description: '', amount: '' }]); // Reset
            setIncomes([{ description: '', amount: '', payment_method: '01' }]); // Reset
            toast.success('Turno cerrado correctamente');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al cerrar turno')
    });

    const loadSummary = async () => {
        if (!currentShiftStatus?.shift?.id) return;
        setShiftSummary(activeSummary); // Use already fetched data
        setActualCash('');
        setExpenses([{ description: '', amount: '' }]);
        setIncomes([{ description: '', amount: '', payment_method: '01' }]);
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
            opening_balance: parseFloat(openingBalance)
        });
    };

    if (isLoadingStatus) return <div className="p-8 text-center text-slate-500 font-bold">Cargando gestión de caja...</div>;

    const currentShift = currentShiftStatus?.shift;

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
                {!currentShift && (
                    <button 
                        onClick={() => setIsOpeningModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-200 transition-all active:scale-95 flex items-center gap-3"
                    >
                        <Calculator size={18} />
                        Nueva Apertura
                    </button>
                )}
            </div>

            {/* Current Shift Card */}
            {currentShift ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                    <div className="p-8 md:p-12">
                        <div className="flex flex-col md:flex-row gap-12">
                            <div className="flex-1 space-y-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 animate-pulse">
                                        <Clock size={32} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-xs font-black uppercase tracking-widest text-emerald-500">Turno en Curso</span>
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900">Activo desde {new Date(currentShift.start_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}</h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Vendedor</label>
                                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <User size={14} className="text-indigo-500" />
                                            {currentShift.seller_name || 'Vendedor'}
                                        </span>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Punto de Venta</label>
                                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <Monitor size={14} className="text-indigo-500" />
                                            {currentShift.pos_name || 'Caja Principal'}
                                        </span>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Fondo Inicial</label>
                                        <span className="text-lg font-black text-slate-900">${parseFloat(currentShift.opening_balance).toFixed(2)}</span>
                                    </div>
                                    <div className="p-6 bg-indigo-600 rounded-3xl shadow-lg shadow-indigo-200">
                                        <label className="text-[10px] font-black uppercase text-indigo-100 tracking-widest block mb-1">Ventas Hoy</label>
                                        <span className="text-lg font-black text-white flex items-center gap-1">
                                            <TrendingUp size={16} />
                                            {isLoadingSummary ? 'Calculando...' : `$${parseFloat(activeSummary?.total_sales || 0).toFixed(2)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="w-full md:w-80 flex flex-col justify-center gap-4">
                                <button 
                                    onClick={loadSummary}
                                    className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
                                >
                                    Realizar Arqueo
                                    <Calculator size={18} />
                                </button>
                                <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                    Al realizar el arqueo se cerrará el turno actual y se generará el reporte de caja.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
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
                                        onChange={(e) => setHistorySearch(e.target.value)}
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
                                            onChange={(e) => setHistoryStartDate(e.target.value)}
                                            className="text-sm text-slate-600 border-none p-0 focus:ring-0 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Hasta</span>
                                        <input 
                                            type="date"
                                            value={historyEndDate}
                                            onChange={(e) => setHistoryEndDate(e.target.value)}
                                            className="text-sm text-slate-600 border-none p-0 focus:ring-0 outline-none"
                                        />
                                    </div>
                                    {(historyStartDate || historyEndDate) && (
                                        <button 
                                            onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); }}
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
                                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Inicio / Fin</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsable</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">POS</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Esperado</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Contado</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Diferencia</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shiftsHistory.length > 0 ? shiftsHistory.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900">{new Date(shift.start_time).toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                                    {new Date(shift.start_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })} - {shift.end_time ? new Date(shift.end_time).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' }) : 'Abierto'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-[10px] font-black">
                                                    {shift.seller_name?.charAt(0)}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{shift.seller_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">{shift.pos_name}</span>
                                        </td>
                                        <td className="px-8 py-6 text-right tabular-nums">
                                            <span className="text-sm font-bold text-slate-700">${parseFloat(shift.expected_cash || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="px-8 py-6 text-right tabular-nums">
                                            <span className="text-sm font-bold text-slate-700">${parseFloat(shift.actual_cash || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="px-8 py-6 text-right tabular-nums">
                                            <span className={`text-sm font-black flex items-center justify-end gap-1 ${parseFloat(shift.actual_cash - shift.expected_cash) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {parseFloat(shift.actual_cash - shift.expected_cash || 0).toFixed(2)}
                                                {parseFloat(shift.actual_cash - shift.expected_cash || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button 
                                                title="Ver Arqueo / Reporte"
                                                onClick={() => handleViewHistoryReport(shift.id)}
                                                className="p-2.5 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                            >
                                                <Printer size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="px-8 py-12 text-center text-slate-400 font-medium italic">No hay historial de turnos disponible.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal: Apertura de Caja */}
            <Modal
                isOpen={isOpeningModalOpen}
                onClose={() => setIsOpeningModalOpen(false)}
                title="Apertura de Turno"
                maxWidth="max-w-md"
            >
                <form onSubmit={handleOpenShift} className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Vendedor Responsable</label>
                            <select name="seller_id" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all">
                                <option value="">Seleccione vendedor</option>
                                {sellers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2 px-1">Punto de Venta (Terminal)</label>
                            <select name="pos_id" required className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all">
                                <option value="">Seleccione terminal</option>
                                {posList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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

            {/* Modal: Arqueo de Caja (Cierre) */}
            <Modal
                isOpen={isClosingModalOpen}
                onClose={() => setIsClosingModalOpen(false)}
                title="Realizar Arqueo de Caja"
                maxWidth="max-w-6xl"
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
                                            <span>${(parseFloat(shiftSummary.opening_balance) || 0).toFixed(2)}</span>
                                        </div>
                                        
                                        {/* Detalle Dinámico de Métodos */}
                                        {shiftSummary.methods?.map(method => (
                                            <div key={method.code} className="flex justify-between items-center text-sm font-bold text-slate-400 italic">
                                                <span>{method.name}</span>
                                                <span className={method.code === '01' ? 'text-emerald-500' : 'text-indigo-400'}>
                                                    +${parseFloat(method.total || 0).toFixed(2)}
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
                                    </div>
                                </div>

                                <div className="h-px bg-slate-200 my-4"></div>
                                <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase text-slate-900 tracking-widest">Efectivo Físico Esperado</span>
                                        <span className="text-[10px] text-slate-400 font-bold italic">(Saldo + Cash Sales + Cash In - Expenses)</span>
                                    </div>
                                    <span className="text-3xl font-black text-emerald-600">
                                        ${(
                                            (parseFloat(shiftSummary.opening_balance) || 0) + 
                                            (parseFloat(shiftSummary.cash) || 0) + 
                                            incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                            expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
                                        ).toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* Formularios de Ajuste */}
                            <div className="md:col-span-7 space-y-6">
                                {/* Sección de Otros Ingresos */}
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Otros Ingresos</h5>
                                        <button 
                                            onClick={() => setIncomes([...incomes, { description: '', amount: '', payment_method: '01' }])}
                                            className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase"
                                        >
                                            + Agregar Ingreso
                                        </button>
                                    </div>
                                    <div className="space-y-3 max-h-32 overflow-y-auto px-1 custom-scrollbar">
                                        {incomes.map((inc, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input 
                                                    className="flex-[2] px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-emerald-300"
                                                    placeholder="Motivo (ej: Cambio)"
                                                    value={inc.description}
                                                    onChange={(e) => {
                                                        const newInc = [...incomes];
                                                        newInc[idx].description = e.target.value;
                                                        setIncomes(newInc);
                                                    }}
                                                />
                                                <select
                                                    className="flex-1 px-2 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none"
                                                    value={inc.payment_method}
                                                    onChange={(e) => {
                                                        const newInc = [...incomes];
                                                        newInc[idx].payment_method = e.target.value;
                                                        setIncomes(newInc);
                                                    }}
                                                >
                                                    {paymentMethods.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                                                </select>
                                                <input 
                                                    type="number"
                                                    className="w-32 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-emerald-300 text-right"
                                                    placeholder="0.00"
                                                    value={inc.amount}
                                                    onChange={(e) => {
                                                        const newInc = [...incomes];
                                                        newInc[idx].amount = e.target.value;
                                                        setIncomes(newInc);
                                                    }}
                                                />
                                                {incomes.length > 1 && (
                                                    <button onClick={() => setIncomes(incomes.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Sección de Gastos */}
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Gastos Caja Chica</h5>
                                        <button 
                                            onClick={() => setExpenses([...expenses, { description: '', amount: '' }])}
                                            className="text-[10px] font-black text-rose-600 hover:text-rose-700 uppercase"
                                        >
                                            + Agregar Gasto
                                        </button>
                                    </div>
                                    <div className="space-y-3 max-h-32 overflow-y-auto px-1 custom-scrollbar">
                                        {expenses.map((exp, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input 
                                                    className="flex-[2] px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-rose-300"
                                                    placeholder="Descripción"
                                                    value={exp.description}
                                                    onChange={(e) => {
                                                        const newExp = [...expenses];
                                                        newExp[idx].description = e.target.value;
                                                        setExpenses(newExp);
                                                    }}
                                                />
                                                <input 
                                                    type="number"
                                                    className="w-32 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:border-rose-300 text-right"
                                                    placeholder="0.00"
                                                    value={exp.amount}
                                                    onChange={(e) => {
                                                        const newExp = [...expenses];
                                                        newExp[idx].amount = e.target.value;
                                                        setExpenses(newExp);
                                                    }}
                                                />
                                                {expenses.length > 1 && (
                                                    <button onClick={() => setExpenses(expenses.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

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
                                                expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
                                            )) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                        }`}>
                                            <span className="text-[10px] font-black uppercase tracking-widest">Diferencia</span>
                                            <span className="text-xl font-black tabular-nums">
                                                $ {(parseFloat(actualCash) - (
                                                    (parseFloat(shiftSummary.opening_balance) || 0) + 
                                                    (parseFloat(shiftSummary.cash) || 0) + 
                                                    incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) - 
                                                    expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0)
                                                )).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={() => {
                                        const totalCashIncomings = (parseFloat(shiftSummary.opening_balance) || 0) + (parseFloat(shiftSummary.cash) || 0) + incomes.filter(i => i.payment_method === '01').reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                                        const totalExp = expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                                        if (totalExp > totalCashIncomings) {
                                            return toast.error('El total de gastos no puede superar el efectivo disponible (Fondo + Ventas Cash + Ingresos Cash)');
                                        }
                                        closeShiftMutation.mutate({ 
                                            id: currentShiftStatus.shift.id, 
                                            actualCash, 
                                            expenses: expenses.filter(e => parseFloat(e.amount) > 0),
                                            incomes: incomes.filter(i => parseFloat(i.amount) > 0)
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
                                <p className="text-slate-500 font-medium font-mono text-[10px] uppercase tracking-widest mt-1">ID Turno: #{shiftSummary.id}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 space-y-6">
                            {/* Bloque de Totales de Arqueo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Esperado en Caja</span>
                                    <span className="text-lg font-black text-slate-900">${(parseFloat(shiftSummary.expected) || 0).toFixed(2)}</span>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left border-l-4 border-l-indigo-500">
                                    <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Contado Físico</span>
                                    <span className="text-lg font-black text-slate-900">${(parseFloat(shiftSummary.actual) || 0).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Diferencia Destacada */}
                            <div className={`p-4 rounded-2xl flex justify-between items-center ${parseFloat(shiftSummary.difference) >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                <span className="text-xs font-black uppercase tracking-[0.2em]">Diferencia</span>
                                <span className="text-2xl font-black tabular-nums">
                                    {parseFloat(shiftSummary.difference) > 0 ? '+' : ''}${(parseFloat(shiftSummary.difference) || 0).toFixed(2)}
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
                                            <span className="text-slate-900">${parseFloat(m.total || 0).toFixed(2)}</span>
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
                                            <span>+${(parseFloat(shiftSummary.total_incomes) || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="px-1 space-y-1">
                                            {shiftSummary.incomes?.map((inc, i) => (
                                                <div key={i} className="flex justify-between text-[10px] font-bold text-slate-400">
                                                    <span className="truncate pr-4">{inc.description} <span className="opacity-50 font-normal">({inc.method || 'Efectivo'})</span></span>
                                                    <span className="shrink-0">+${parseFloat(inc.amount).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {parseFloat(shiftSummary.total_expenses || 0) > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 p-2 rounded-lg">
                                            <span>Gastos Administrativos</span>
                                            <span>-${(parseFloat(shiftSummary.total_expenses) || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="px-1 space-y-1">
                                            {shiftSummary.expenses?.map((exp, i) => (
                                                <div key={i} className="flex justify-between text-[10px] font-bold text-slate-400">
                                                    <span className="truncate pr-4">{exp.description}</span>
                                                    <span className="shrink-0">-${parseFloat(exp.amount).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => window.print()}
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
        </div>
    );
};

export default CashClosing;
