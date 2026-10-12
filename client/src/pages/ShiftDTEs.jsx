import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Money from '../components/ui/Money';
import SaleDetailModal from '../components/sales/SaleDetailModal';
import { ShiftPickerModal, ShiftChangeModal } from '../components/shiftDtes';
import { formatDate } from '../utils/dateUtils';
import {
    Search, ArrowLeftRight, Eye, CheckCircle2, XCircle, AlertCircle, Clock, Ban,
    Calendar, User, Monitor, CalendarClock, X
} from 'lucide-react';

const getStatusBadge = (status) => {
    switch (status) {
        case 'ACCEPTED':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    <CheckCircle2 size={11} /> Aceptado
                </span>
            );
        case 'REJECTED':
        case 'RECHAZADO':
        case 'ERROR':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    <XCircle size={11} /> Rechazado
                </span>
            );
        case 'SENT':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    <Clock size={11} /> Enviado
                </span>
            );
        case 'anulado':
        case 'INVALIDADO':
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    <Ban size={11} /> Anulado
                </span>
            );
        default:
            return (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider">
                    <AlertCircle size={11} /> Pendiente
                </span>
            );
    }
};

const ShiftDTEs = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canChangeShift =
        user?.role === 'SuperAdmin' ||
        (Array.isArray(user?.permissions) ? user.permissions : []).includes('manage_dte_shift_change');

    // Estado del turno
    const [selectedShift, setSelectedShift] = useState(null);
    const [isShiftPickerOpen, setIsShiftPickerOpen] = useState(false);

    // Filtros de la lista de DTEs
    const [searchTerm, setSearchTerm] = useState('');
    const [search, setSearch] = useState('');
    const [dteStartDate, setDteStartDate] = useState('');
    const [dteEndDate, setDteEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState([]);

    // Modales secundarios
    const [detailSaleId, setDetailSaleId] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isChangeShiftOpen, setIsChangeShiftOpen] = useState(false);
    const [changeIds, setChangeIds] = useState([]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchTerm);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: dtesData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: isLoadingDTEs } = useQuery({
        queryKey: ['shift-dtes', selectedShift?.id, search, dteStartDate, dteEndDate, page],
        queryFn: async () => {
            const res = await axios.get('/api/sales', {
                params: {
                    shift_id: selectedShift?.id,
                    has_dte: 'true',
                    search: search.trim() || undefined,
                    start_date: dteStartDate || undefined,
                    end_date: dteEndDate || undefined,
                    page,
                    limit: 15
                }
            });
            return res.data || { data: [], totalItems: 0, totalPages: 0 };
        },
        enabled: !!selectedShift?.id
    });

    const dtesList = Array.isArray(dtesData?.data) ? dtesData.data : [];

    const handleSelectShift = (shift) => {
        setSelectedShift(shift);
        setSelected([]);
        setPage(1);
        setSearchTerm('');
        setDteStartDate('');
        setDteEndDate('');
    };

    const handleOpenChangeShift = (ids) => {
        if (!ids || ids.length === 0) return;
        setChangeIds(ids);
        setIsChangeShiftOpen(true);
    };

    const handleChangeShiftSuccess = () => {
        setSelected([]);
        queryClient.invalidateQueries({ queryKey: ['shift-dtes'] });
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
    };

    const toggleSelect = (id) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleSelectAll = () => {
        if (selected.length === dtesList.length) {
            setSelected([]);
        } else {
            setSelected(dtesList.map((s) => s.id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">DTEs por Turno</h2>
                    <p className="text-slate-500 font-medium">Filtra los DTE emitidos por turno y fecha, y adminístralos</p>
                </div>
            </div>

            {/* Selector de Turno */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600">
                            <CalendarClock size={20} />
                        </div>
                        <div>
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                Turno seleccionado
                            </span>
                            {selectedShift ? (
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-lg font-black text-slate-900">
                                        Turno #{selectedShift.shift_number || selectedShift.id}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                            selectedShift.status === 'open'
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        {selectedShift.status === 'open' ? 'Abierto' : 'Cerrado'}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-sm font-bold text-slate-400">Ningún turno seleccionado</span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsShiftPickerOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                    >
                        <Search size={15} /> {selectedShift ? 'Cambiar Turno' : 'Seleccionar Turno'}
                    </button>
                </div>

                {selectedShift && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                <Calendar size={12} className="inline mr-1" />Fecha
                            </span>
                            <span className="font-black text-slate-700 text-xs">
                                {formatDate(selectedShift.shift_date || selectedShift.start_time)}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                <User size={12} className="inline mr-1" />Responsable
                            </span>
                            <span className="font-black text-slate-700 text-xs uppercase">
                                {selectedShift.seller_name || 'N/A'}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                <Monitor size={12} className="inline mr-1" />Sucursal / Terminal
                            </span>
                            <span className="font-black text-slate-700 text-xs uppercase block truncate">
                                {selectedShift.branch_name || 'Central'}
                            </span>
                            <span className="font-bold text-indigo-400 text-[9px] uppercase tracking-tighter truncate block">
                                {selectedShift.pos_name || 'Principal'}
                            </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                Ventas del Turno
                            </span>
                            <span className="font-black text-slate-700 text-sm">
                                <Money value={selectedShift.total_sales || 0} />
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de DTEs */}
            {selectedShift ? (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center flex-wrap gap-2.5 flex-1 min-w-[280px]">
                            {/* Búsqueda */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nro. control, código o cliente..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Filtro de Fecha para DTEs */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                                    <Calendar size={13} className="text-slate-400" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Desde:</span>
                                    <input
                                        type="date"
                                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                        value={dteStartDate}
                                        onChange={(e) => {
                                            setDteStartDate(e.target.value);
                                            setPage(1);
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                                    <Calendar size={13} className="text-slate-400" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hasta:</span>
                                    <input
                                        type="date"
                                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                        value={dteEndDate}
                                        onChange={(e) => {
                                            setDteEndDate(e.target.value);
                                            setPage(1);
                                        }}
                                    />
                                </div>
                                {(dteStartDate || dteEndDate) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDteStartDate('');
                                            setDteEndDate('');
                                            setPage(1);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Limpiar fechas"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {canChangeShift && (
                            <button
                                type="button"
                                onClick={() => handleOpenChangeShift(selected)}
                                disabled={selected.length === 0}
                                className={`flex items-center gap-2 px-5 py-2.5 font-black text-xs uppercase tracking-widest rounded-2xl transition-all ${
                                    selected.length > 0
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                <ArrowLeftRight size={15} />
                                Cambiar a otro turno ({selected.length})
                            </button>
                        )}
                    </div>

                    <Table
                        headers={[
                            ...(canChangeShift ? [''] : []),
                            'Fecha', 'Documento', 'Cliente', 'Estado MH', 'Total', 'Acciones'
                        ]}
                        data={dtesList}
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
                                            <span className="font-bold text-slate-900 text-[10px] truncate leading-none">
                                                {sale.tipo_documento_name}
                                            </span>
                                            {sale.codigo_generacion && (
                                                sale.dte_ambiente === '01' ? (
                                                    <span className="text-[7px] px-1 py-px bg-emerald-50 text-emerald-600 rounded font-black uppercase tracking-wider leading-none">Prod</span>
                                                ) : (
                                                    <span className="text-[7px] px-1 py-px bg-amber-50 text-amber-600 rounded font-black uppercase tracking-wider leading-none">Pruebas</span>
                                                )
                                            )}
                                        </div>
                                        <span className="text-[10.25px] font-mono font-bold text-indigo-500 opacity-80 truncate max-w-[300px]" title={`Control: ${sale.numero_control}`}>
                                            {sale.numero_control}
                                        </span>
                                        <span className="text-[9.25px] font-mono text-emerald-600/80 truncate mt-0 max-w-[300px]" title={`Generación: ${sale.codigo_generacion}`}>
                                            {sale.codigo_generacion}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-1">
                                    <div className="flex flex-col leading-tight">
                                        <span className="font-bold text-slate-700 text-[9px] truncate max-w-[300px]" title={sale.customer_name}>
                                            {sale.customer_name || 'Consumidor Final'}
                                        </span>
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
                                            type="button"
                                            onClick={() => { setDetailSaleId(sale.id); setIsDetailOpen(true); }}
                                            className="p-2 rounded-xl transition-all flex items-center gap-1 border bg-white text-slate-600 hover:text-indigo-600 border-slate-100"
                                            title="Ver detalle"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        {canChangeShift && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenChangeShift([sale.id])}
                                                className="p-2 rounded-xl transition-all flex items-center gap-1 border bg-white text-slate-600 hover:text-indigo-600 border-slate-100"
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

                    <div className="flex items-center justify-between flex-wrap gap-3">
                        {canChangeShift && (
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                    checked={selected.length > 0 && selected.length === dtesList.length}
                                    onChange={toggleSelectAll}
                                    disabled={dtesList.length === 0}
                                />
                                Seleccionar página ({dtesList.length})
                            </label>
                        )}
                        <Pagination
                            currentPage={page}
                            totalPages={dtesData.totalPages}
                            totalItems={dtesData.totalItems}
                            onPageChange={setPage}
                            itemsOnPage={dtesList.length}
                            isLoading={isLoadingDTEs}
                        />
                    </div>
                </div>
            ) : (
                <div className="bg-white p-16 rounded-3xl shadow-sm border border-slate-100 text-center">
                    <CalendarClock size={40} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Seleccione un turno para ver sus DTE emitidos
                    </p>
                </div>
            )}

            {/* Modal Selector de Turno con Filtro por Fecha */}
            <ShiftPickerModal
                isOpen={isShiftPickerOpen}
                onClose={() => setIsShiftPickerOpen(false)}
                onSelectShift={handleSelectShift}
                selectedShiftId={selectedShift?.id}
                branchId={user?.branch_id}
            />

            {/* Modal Cambiar de Turno */}
            <ShiftChangeModal
                isOpen={isChangeShiftOpen}
                onClose={() => setIsChangeShiftOpen(false)}
                changeIds={changeIds}
                currentShift={selectedShift}
                onSuccess={handleChangeShiftSuccess}
            />

            {/* Modal Detalle de Venta */}
            <SaleDetailModal
                saleId={detailSaleId}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
            />
        </div>
    );
};

export default ShiftDTEs;
