import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Undo2, Search, Info, Loader2, ShoppingCart,
    Calendar, Clock, User, Hash, Filter, ArrowLeft, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { formatDate, formatTime, getTodayString } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';

const DTE_TYPE_LABELS = {
    '01': { short: 'FE', name: 'Factura (01)', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    '11': { short: 'FEX', name: 'Exportación (11)', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
    '14': { short: 'FSE', name: 'Sujeto Excluido (14)', badge: 'bg-amber-50 text-amber-700 border-amber-200' }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shiftDays = (ymd, delta) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d + delta);
    return getTodayString(dt);
};

const EmitEretModal = ({ isOpen, onClose, onSuccess }) => {
    const queryClient = useQueryClient();
    const today = getTodayString();

    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [clienteFilter, setClienteFilter] = useState('');
    const [debouncedCliente, setDebouncedCliente] = useState('');
    const [fechaDesde, setFechaDesde] = useState(shiftDays(today, -30));
    const [fechaHasta, setFechaHasta] = useState(today);
    const [horaDesde, setHoraDesde] = useState('');
    const [horaHasta, setHoraHasta] = useState('');
    const [tipoDte, setTipoDte] = useState('');
    const [branchId, setBranchId] = useState('');
    const [page, setPage] = useState(1);
    const [showAdvanced, setShowAdvanced] = useState(true);

    const [originalDte, setOriginalDte] = useState(null);
    const [originalLoading, setOriginalLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchText); setPage(1); }, 400);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedCliente(clienteFilter); setPage(1); }, 400);
        return () => clearTimeout(timer);
    }, [clienteFilter]);

    const { data: branches = [] } = useQuery({
        queryKey: ['eret-branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches')),
        enabled: isOpen
    });

    const { data: searchResult = { data: [], total: 0, totalPages: 1 }, isFetching: isSearching } = useQuery({
        queryKey: [
            'eret-eligible-dtes', debouncedSearch, debouncedCliente,
            fechaDesde, fechaHasta, horaDesde, horaHasta, tipoDte, branchId, page
        ],
        queryFn: async () => {
            const res = await axios.get('/api/retorno/search-dtes', {
                params: {
                    search: debouncedSearch.trim() || undefined,
                    cliente: debouncedCliente.trim() || undefined,
                    fecha_desde: fechaDesde || undefined,
                    fecha_hasta: fechaHasta || undefined,
                    hora_desde: horaDesde || undefined,
                    hora_hasta: horaHasta || undefined,
                    tipo_dte: tipoDte || undefined,
                    branch_id: branchId || undefined,
                    page,
                    limit: 8
                }
            });
            return res.data || { data: [], total: 0, totalPages: 1 };
        },
        enabled: isOpen && !originalDte
    });

    const resetAll = () => {
        setOriginalDte(null);
        setSelectedItems([]);
        setSearchText('');
        setDebouncedSearch('');
        setClienteFilter('');
        setDebouncedCliente('');
        setFechaDesde(shiftDays(today, -30));
        setFechaHasta(today);
        setHoraDesde('');
        setHoraHasta('');
        setTipoDte('');
        setBranchId('');
        setPage(1);
    };

    const handleClose = () => {
        resetAll();
        onClose();
    };

    const loadDteDetail = async (codigoGeneracion) => {
        const cleanCode = String(codigoGeneracion || '').trim().toUpperCase();
        if (!cleanCode) return;
        setOriginalLoading(true);
        try {
            const { data } = await axios.get(`/api/dte/${cleanCode}`);
            if (!data.success) throw new Error(data.message);
            const dte = data.data;
            const jsonOrig = typeof dte.json_original === 'string' ? JSON.parse(dte.json_original) : (dte.json_original || {});
            if (!['01', '11', '14'].includes(dte.tipo_dte)) {
                toast.error(`El tipo de DTE "${dte.tipo_dte}" no soporta ERET. Solo Factura (01), FEX (11) y FSE (14).`);
                return;
            }
            const items = (Array.isArray(jsonOrig.cuerpoDocumento) ? jsonOrig.cuerpoDocumento : []).map((item) => ({
                numItem: item.numItem,
                descripcion: item.descripcion || 'Item',
                cantidad: Number(item.cantidad) || 0,
                precioUni: Number(item.precioUni) || 0,
                selected: true,
                returnQty: Number(item.cantidad) || 0
            }));
            setOriginalDte({
                codigoGeneracion: dte.codigo_generacion,
                numeroControl: dte.numero_control,
                tipoDte: dte.tipo_dte,
                tipoDteName: DTE_TYPE_LABELS[dte.tipo_dte]?.name || dte.tipo_dte,
                fechaEmision: jsonOrig.identificacion?.fecEmi,
                horaEmision: jsonOrig.identificacion?.horEmi,
                receptor: jsonOrig.receptor || jsonOrig.sujetoExcluido || jsonOrig.documento || null,
                items
            });
            setSelectedItems(items);
            toast.success(`DTE ${dte.tipo_dte} cargado — ${items.length} ítem(s)`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'No se pudo cargar el detalle del DTE');
        } finally {
            setOriginalLoading(false);
        }
    };

    const handleQuickEnter = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const trimmed = searchText.trim();
        if (UUID_REGEX.test(trimmed)) {
            loadDteDetail(trimmed);
        } else {
            setDebouncedSearch(trimmed);
            setPage(1);
        }
    };

    const applyDatePreset = (days) => {
        if (days === null) {
            setFechaDesde('');
            setFechaHasta('');
        } else if (days === 1) {
            const yest = shiftDays(today, -1);
            setFechaDesde(yest);
            setFechaHasta(yest);
        } else {
            setFechaDesde(days === 0 ? today : shiftDays(today, -days));
            setFechaHasta(today);
        }
        setPage(1);
    };

    const toggleItem = (numItem) => {
        setSelectedItems((prev) => prev.map((it) => (it.numItem === numItem ? { ...it, selected: !it.selected } : it)));
    };

    const updateReturnQty = (numItem, qty) => {
        const maxQty = originalDte?.items?.find((i) => i.numItem === numItem)?.cantidad || 0;
        const val = Math.max(0, Math.min(maxQty, parseFloat(qty) || 0));
        setSelectedItems((prev) => prev.map((it) => (it.numItem === numItem ? { ...it, returnQty: val } : it)));
    };

    const emitMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/retorno/emit', payload),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['eret'] });
            if (res.data?.success) {
                toast.success('ERET emitido y transmitido exitosamente');
                handleClose();
                if (onSuccess) onSuccess(res.data);
            } else {
                toast.error(`ERET rechazado: ${res.data?.estadoHacienda || 'Error'}`);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al emitir ERET')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!originalDte) return toast.error('Primero seleccione un DTE original');
        const itemsToSend = selectedItems
            .filter((it) => it.selected && it.returnQty > 0)
            .map((it) => ({ numItem: it.numItem, cantidad: it.returnQty }));
        if (itemsToSend.length === 0) return toast.error('Seleccione al menos un ítem con cantidad > 0');
        emitMutation.mutate({ codigoGeneracionOriginal: originalDte.codigoGeneracion, items: itemsToSend });
    };

    if (!isOpen) return null;

    const candidates = Array.isArray(searchResult?.data) ? searchResult.data : [];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo Evento de Retorno (ERET)" maxWidth="max-w-5xl">
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                {!originalDte ? (
                    <>
                        <div className="flex items-start gap-2.5 p-3 bg-indigo-50 text-indigo-800 rounded-2xl border border-indigo-100 text-xs">
                            <Info size={18} className="shrink-0 mt-0.5" />
                            <p className="font-medium">
                                Busque el DTE aceptado (Factura 01, FEX 11 o FSE 14) por <b>número de control, código de generación, cliente, DUI/NIT, monto, fecha u hora</b> y haga clic en Seleccionar.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onKeyDown={handleQuickEnter}
                                    placeholder="Buscar por N° Control, UUID, Cliente, NIT/DUI o Monto..."
                                    className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400"
                                />
                                {searchText && (
                                    <button type="button" onClick={() => setSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced((v) => !v)}
                                className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 ${showAdvanced ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                            >
                                <Filter size={14} /> Filtros
                            </button>
                            {UUID_REGEX.test(searchText.trim()) && (
                                <button
                                    type="button"
                                    disabled={originalLoading}
                                    onClick={() => loadDteDetail(searchText.trim())}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5"
                                >
                                    {originalLoading ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />} Cargar UUID
                                </button>
                            )}
                        </div>

                        {showAdvanced && (
                            <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3 space-y-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Rango rápido:</span>
                                    {[['Hoy', 0], ['Ayer', 1], ['7 días', 7], ['30 días', 30], ['Todos', null]].map(([lbl, d]) => (
                                        <button
                                            key={lbl}
                                            type="button"
                                            onClick={() => applyDatePreset(d)}
                                            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 text-[11px] font-bold text-slate-600"
                                        >
                                            {lbl}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Calendar size={11} /> Fecha Desde</label>
                                        <input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Calendar size={11} /> Fecha Hasta</label>
                                        <input type="date" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Clock size={11} /> Hora Desde</label>
                                        <input type="time" value={horaDesde} onChange={(e) => { setHoraDesde(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><Clock size={11} /> Hora Hasta</label>
                                        <input type="time" value={horaHasta} onChange={(e) => { setHoraHasta(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1"><User size={11} /> Cliente (Nombre, NIT o DUI)</label>
                                        <input type="text" value={clienteFilter} onChange={(e) => setClienteFilter(e.target.value)} placeholder="Ej: Consumidor Final, Juan Pérez o NIT..." className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo DTE</label>
                                        <select value={tipoDte} onChange={(e) => { setTipoDte(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                                            <option value="">Todos (01, 11, 14)</option>
                                            <option value="01">Factura (01)</option>
                                            <option value="11">Exportación (11)</option>
                                            <option value="14">Sujeto Excluido (14)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Sucursal</label>
                                        <select value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                                            <option value="">Todas</option>
                                            {(Array.isArray(branches) ? branches : []).map((b) => (
                                                <option key={b.id} value={b.id}>{b.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                            <div className="overflow-x-auto max-h-[300px]">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2.5">Fecha / Hora</th>
                                            <th className="px-3 py-2.5">Documento / Control</th>
                                            <th className="px-3 py-2.5">Cliente / Receptor</th>
                                            <th className="px-3 py-2.5">Sucursal</th>
                                            <th className="px-3 py-2.5 text-right">Total</th>
                                            <th className="px-3 py-2.5 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(isSearching || originalLoading) && candidates.length === 0 ? (
                                            <tr><td colSpan={6} className="py-8 text-center text-slate-400"><Loader2 size={18} className="animate-spin inline mr-2" />Buscando DTEs elegibles...</td></tr>
                                        ) : candidates.length === 0 ? (
                                            <tr><td colSpan={6} className="py-8 text-center text-slate-400 font-medium">No se encontraron DTEs aceptados (01, 11, 14) con esos filtros.</td></tr>
                                        ) : candidates.map((row) => {
                                            const badge = DTE_TYPE_LABELS[row.tipo_dte] || { short: row.tipo_dte, badge: 'bg-slate-100 text-slate-600' };
                                            return (
                                                <tr key={row.id} onClick={() => loadDteDetail(row.codigo_generacion)} className="hover:bg-indigo-50/40 cursor-pointer transition-colors">
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        <div className="font-bold text-slate-700">{formatDate(row.fecha_emision)}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{formatTime(row.hora_emision) || '--:--'}</div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${badge.badge}`}>{badge.short}</span>
                                                            <span className="font-mono font-bold text-slate-800 text-[11px]">{row.numero_control || 'Sin control'}</span>
                                                        </div>
                                                        <div className="font-mono text-[10px] text-indigo-600 truncate max-w-[230px]">{row.codigo_generacion}</div>
                                                    </td>
                                                    <td className="px-3 py-2 max-w-[180px]">
                                                        <div className="font-semibold text-slate-700 truncate">{row.receptor_nombre}</div>
                                                        {row.receptor_documento && <div className="text-[10px] text-slate-400 font-mono">{row.receptor_documento}</div>}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.branch_name}</td>
                                                    <td className="px-3 py-2 text-right font-black text-slate-800 whitespace-nowrap"><Money value={row.total_pagar} /></td>
                                                    <td className="px-3 py-2 text-right whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            disabled={originalLoading}
                                                            onClick={(e) => { e.stopPropagation(); loadDteDetail(row.codigo_generacion); }}
                                                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold"
                                                        >
                                                            Seleccionar
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                                <span>{searchResult?.total || 0} documento(s) encontrado(s)</span>
                                <div className="flex items-center gap-1.5">
                                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                                    <span className="font-bold text-slate-700 px-1">Pág. {page} / {searchResult?.totalPages || 1}</span>
                                    <button type="button" disabled={page >= (searchResult?.totalPages || 1)} onClick={() => setPage((p) => p + 1)} className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Documento Original</span>
                                    <p className="text-xs font-black text-slate-900">{originalDte.tipoDteName}</p>
                                    <p className="text-[10px] font-mono text-indigo-600 truncate">{originalDte.numeroControl || originalDte.codigoGeneracion}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Fecha / Hora Emisión</span>
                                    <p className="text-xs font-black text-slate-900">{formatDate(originalDte.fechaEmision)} {originalDte.horaEmision || ''}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400">Receptor</span>
                                    <p className="text-xs font-black text-slate-900 truncate">{originalDte.receptor?.nombre || 'Consumidor Final'}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => { setOriginalDte(null); setSelectedItems([]); }} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1">
                                <ArrowLeft size={13} /> Cambiar DTE
                            </button>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <ShoppingCart size={15} className="text-indigo-600" />
                                <span className="text-[11px] font-black uppercase text-slate-500">Ítems del DTE Original</span>
                                <span className="text-[10px] text-slate-400 ml-auto">
                                    {selectedItems.filter((i) => i.selected && i.returnQty > 0).length} seleccionados
                                </span>
                            </div>
                            <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-[260px]">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-3 py-2 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.length > 0 && selectedItems.every((i) => i.selected)}
                                                    onChange={() => setSelectedItems((prev) => prev.map((i) => ({ ...i, selected: !prev.every((p) => p.selected) })))}
                                                />
                                            </th>
                                            <th className="px-3 py-2">Ítem</th>
                                            <th className="px-3 py-2 text-right">Precio Unit.</th>
                                            <th className="px-3 py-2 text-right">Cant. Orig.</th>
                                            <th className="px-3 py-2 text-right">Cant. a Retornar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {originalDte.items.map((item) => {
                                            const rowState = selectedItems.find((i) => i.numItem === item.numItem);
                                            return (
                                                <tr key={item.numItem} className={`hover:bg-slate-50 ${rowState?.selected ? '' : 'opacity-40'}`}>
                                                    <td className="px-3 py-2">
                                                        <input type="checkbox" checked={rowState?.selected || false} onChange={() => toggleItem(item.numItem)} />
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-slate-700">{item.descripcion}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-slate-600"><Money value={item.precioUni} /></td>
                                                    <td className="px-3 py-2 text-right font-bold text-slate-500">{item.cantidad}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={item.cantidad}
                                                            step="any"
                                                            value={rowState?.returnQty ?? 0}
                                                            onChange={(e) => updateReturnQty(item.numItem, e.target.value)}
                                                            className="w-20 px-2 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-3 border-t border-slate-100">
                    <button type="button" onClick={handleClose} className="flex-1 py-2.5 text-xs font-black uppercase text-slate-500 hover:text-slate-700 rounded-xl border border-slate-200">
                        Cancelar
                    </button>
                    <button type="submit" disabled={emitMutation.isPending || !originalDte} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-2.5 rounded-xl font-black uppercase text-xs shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                        {emitMutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Emitiendo...</> : <><Undo2 size={15} /> Emitir ERET</>}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default EmitEretModal;
