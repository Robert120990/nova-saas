import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Search, CalendarClock, Calendar, X } from 'lucide-react';
import Modal from '../ui/Modal';
import Pagination from '../ui/Pagination';
import Money from '../ui/Money';
import { formatDateTime, getTodayString, getFirstDayOfMonth } from '../../utils/dateUtils';

const ShiftPickerModal = ({
    isOpen,
    onClose,
    onSelectShift,
    selectedShiftId,
    branchId
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [status, setStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleSetToday = () => {
        const today = getTodayString();
        setStartDate(today);
        setEndDate(today);
        setPage(1);
    };

    const handleSetYesterday = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yest = getTodayString(d);
        setStartDate(yest);
        setEndDate(yest);
        setPage(1);
    };

    const handleSetThisMonth = () => {
        setStartDate(getFirstDayOfMonth());
        setEndDate(getTodayString());
        setPage(1);
    };

    const handleClearDates = () => {
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const { data: shiftsData = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['shifts', 'picker', debouncedSearch, status, startDate, endDate, branchId, page],
        queryFn: async () => {
            const res = await axios.get('/api/shifts', {
                params: {
                    search: debouncedSearch.trim() || undefined,
                    status: status || undefined,
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    branch_id: branchId || undefined,
                    page,
                    limit: 10
                }
            });
            return res.data || { data: [], total: 0, totalPages: 0 };
        },
        enabled: isOpen
    });

    const shiftsList = Array.isArray(shiftsData?.data) ? shiftsData.data : [];
    const totalItems = shiftsData?.total || 0;
    const totalPages = shiftsData?.totalPages || 0;

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Seleccionar Turno"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                {/* Filtros de Búsqueda y Estado */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por vendedor o terminal..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400 transition-all cursor-pointer text-slate-600"
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    >
                        <option value="">Todos los estados</option>
                        <option value="open">Abiertos</option>
                        <option value="closed">Cerrados</option>
                    </select>
                </div>

                {/* Filtro por Fecha */}
                <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={13} className="text-indigo-500" /> Filtrar por Fecha del Turno
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                            <button
                                type="button"
                                onClick={handleSetToday}
                                className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-bold text-slate-600 hover:text-indigo-600 transition-all"
                            >
                                Hoy
                            </button>
                            <button
                                type="button"
                                onClick={handleSetYesterday}
                                className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-bold text-slate-600 hover:text-indigo-600 transition-all"
                            >
                                Ayer
                            </button>
                            <button
                                type="button"
                                onClick={handleSetThisMonth}
                                className="px-2 py-1 bg-white border border-slate-200 hover:border-indigo-300 rounded-lg text-[10px] font-bold text-slate-600 hover:text-indigo-600 transition-all"
                            >
                                Este Mes
                            </button>
                            {(startDate || endDate) && (
                                <button
                                    type="button"
                                    onClick={handleClearDates}
                                    className="px-2 py-1 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1"
                                >
                                    <X size={11} /> Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Desde</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Hasta</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Lista de Turnos */}
                <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : shiftsList.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-xs">
                            No se encontraron turnos con los filtros seleccionados
                        </div>
                    ) : (
                        shiftsList.map((shift) => (
                            <button
                                key={shift.id}
                                type="button"
                                onClick={() => {
                                    onSelectShift(shift);
                                    onClose();
                                }}
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
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter block mt-0.5">
                                            {formatDateTime(shift.start_time)} • {shift.branch_name || `Sucursal ${shift.branch_id}`} • {shift.pos_name} • {shift.seller_name}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventas</span>
                                    <span className="text-sm font-black text-slate-900"><Money value={shift.total_sales || 0} /></span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Paginación */}
                <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{totalItems} turno(s)</span>
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        onPageChange={setPage}
                        itemsOnPage={shiftsList.length}
                        isLoading={isLoading}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default ShiftPickerModal;
