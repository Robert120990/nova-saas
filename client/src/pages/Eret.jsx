import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import {
    Undo2, Plus, Search, Code, Terminal,
    CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Info, Loader2, ShoppingCart
} from 'lucide-react';

const Eret = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [isEmitModalOpen, setIsEmitModalOpen] = useState(false);
    const [codigoGeneracionOriginal, setCodigoGeneracionOriginal] = useState('');
    const [originalDte, setOriginalDte] = useState(null);
    const [originalLoading, setOriginalLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
    const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
    const [jsonData, setJsonData] = useState(null);
    const [responseData, setResponseData] = useState(null);
    const limit = 10;

    const { data: eretData = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['eret', search, page],
        queryFn: async () => (await axios.get('/api/retorno', { params: { search, page, limit } })).data
    });

    const fetchEretJson = async (codigoGeneracion) => {
        try {
            const { data } = await axios.get(`/api/retorno/status/${codigoGeneracion}`);
            if (data.success) {
                const dteResp = await axios.get(`/api/dte/${codigoGeneracion}`);
                if (dteResp.data.success) {
                    setJsonData(dteResp.data.data);
                    setIsJsonModalOpen(true);
                }
            }
        } catch (error) {
            toast.error('Error al obtener JSON del ERET');
        }
    };

    const fetchEretResponse = async (row) => {
        setResponseData(row.respuesta_hacienda);
        setIsResponseModalOpen(true);
    };

    const lookupOriginalDte = async () => {
        if (!codigoGeneracionOriginal.trim()) return toast.error('Ingrese un código de generación');
        setOriginalLoading(true);
        setOriginalDte(null);
        try {
            const { data } = await axios.get(`/api/dte/${codigoGeneracionOriginal.trim()}`);
            if (!data.success) throw new Error(data.message);
            const dte = data.data;
            const jsonOriginal = typeof dte.json_original === 'string' ? JSON.parse(dte.json_original) : dte.json_original;
            if (!['01', '11', '14'].includes(dte.tipo_dte)) {
                return toast.error(`El tipo de DTE "${dte.tipo_dte}" no soporta ERET. Solo Factura (01), FEX (11) y FSE (14).`);
            }
            const items = (jsonOriginal.cuerpoDocumento || []).map(item => ({
                numItem: item.numItem,
                descripcion: item.descripcion || 'Item',
                cantidad: item.cantidad,
                precioUni: item.precioUni || 0,
                selected: true,
                returnQty: item.cantidad,
            }));
            setOriginalDte({
                codigoGeneracion: dte.codigo_generacion,
                tipoDte: dte.tipo_dte,
                tipoDteName: { '01': 'Factura', '11': 'FEX', '14': 'FSE' }[dte.tipo_dte] || dte.tipo_dte,
                fechaEmision: jsonOriginal.identificacion?.fecEmi,
                receptor: jsonOriginal.receptor || jsonOriginal.documento || null,
                items,
            });
            setSelectedItems(items);
            toast.success(`DTE ${dte.tipo_dte} encontrado — ${items.length} item(s)`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'DTE no encontrado');
        } finally {
            setOriginalLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            lookupOriginalDte();
        }
    };

    const toggleItem = (numItem) => {
        setSelectedItems(prev => prev.map(item =>
            item.numItem === numItem ? { ...item, selected: !item.selected } : item
        ));
    };

    const updateReturnQty = (numItem, qty) => {
        const maxQty = originalDte.items.find(i => i.numItem === numItem)?.cantidad || 0;
        const val = Math.max(0, Math.min(maxQty, parseInt(qty) || 0));
        setSelectedItems(prev => prev.map(item =>
            item.numItem === numItem ? { ...item, returnQty: val } : item
        ));
    };

    const emitMutation = useMutation({
        mutationFn: (data) => axios.post('/api/retorno/emit', data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['eret'] });
            setIsEmitModalOpen(false);
            setCodigoGeneracionOriginal('');
            setOriginalDte(null);
            setSelectedItems([]);
            if (res.data.success) {
                toast.success('ERET emitido y transmitido exitosamente');
            } else {
                toast.error(`ERET rechazado: ${res.data.estadoHacienda || 'Error'}`);
            }
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al emitir ERET'),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!originalDte) return toast.error('Primero busque un DTE original');
        const itemsToSend = selectedItems
            .filter(item => item.selected && item.returnQty > 0)
            .map(item => ({ numItem: item.numItem, cantidad: item.returnQty }));
        if (itemsToSend.length === 0) return toast.error('Seleccione al menos un item con cantidad > 0');
        emitMutation.mutate({
            codigoGeneracionOriginal: originalDte.codigoGeneracion,
            items: itemsToSend,
        });
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
            default:
                return <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider"><AlertCircle size={11} /> {status}</span>;
        }
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('es-SV');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Evento de Retorno (ERET)</h2>
                    <p className="text-slate-500 font-medium">Gestión de Eventos de Retorno DTE-18 para devoluciones</p>
                </div>
                <button
                    onClick={() => setIsEmitModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
                >
                    <Plus size={16} /> Nuevo ERET
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total ERETs</span>
                    <p className="text-2xl font-black text-slate-900">{eretData.total || 0}</p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aceptados</span>
                    <p className="text-2xl font-black text-emerald-600">
                        {eretData.data?.filter(r => r.status === 'ACCEPTED').length || 0}
                    </p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rechazados</span>
                    <p className="text-2xl font-black text-rose-600">
                        {eretData.data?.filter(r => r.status === 'REJECTED' || r.status === 'RECHAZADO').length || 0}
                    </p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pendientes</span>
                    <p className="text-2xl font-black text-amber-600">
                        {eretData.data?.filter(r => r.status !== 'ACCEPTED' && r.status !== 'REJECTED' && r.status !== 'RECHAZADO').length || 0}
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por código de generación..."
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <Table
                    headers={['Fecha', 'Código Generación', 'DTE Original', 'Estado MH', 'Acciones']}
                    data={eretData.data}
                    isLoading={isLoading}
                    renderRow={(row) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-sm">
                            <td className="px-4 py-3">
                                <span className="text-[11px] font-bold text-slate-600">
                                    {formatDateTime(row.created_at || row.fh_procesamiento)}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                <span className="font-mono text-[11px] font-bold text-indigo-600">{row.codigo_generacion}</span>
                            </td>
                            <td className="px-4 py-3">
                                {row.codigo_generacion_original ? (
                                    <span className="font-mono text-[11px] font-bold text-slate-700">{row.codigo_generacion_original}</span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">N/A</span>
                                )}
                            </td>
                            <td className="px-4 py-3">{getStatusBadge(row.status)}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fetchEretJson(row.codigo_generacion)}
                                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                        title="Ver JSON"
                                    >
                                        <Code size={14} className="text-slate-600" />
                                    </button>
                                    <button
                                        onClick={() => fetchEretResponse(row)}
                                        className="p-2 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all"
                                        title="Respuesta MH"
                                    >
                                        <Terminal size={14} className="text-amber-600" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
                <Pagination
                    currentPage={page}
                    totalPages={eretData.totalPages}
                    totalItems={eretData.total}
                    onPageChange={setPage}
                    itemsOnPage={eretData.data.length}
                    isLoading={isLoading}
                />
            </div>

            <Modal isOpen={isEmitModalOpen} onClose={() => { setIsEmitModalOpen(false); setOriginalDte(null); setSelectedItems([]); setCodigoGeneracionOriginal(''); }} title="Nuevo Evento de Retorno" maxWidth="max-w-3xl">
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 text-indigo-800 rounded-3xl border border-indigo-100 text-xs">
                        <Info size={20} className="shrink-0" />
                        <p className="font-medium">Ingrese el código de generación del DTE original (Factura 01, FEX 11 o FSE 14) que desea retornar y presione Enter o clic en Buscar.</p>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-1">Código de Generación Original</label>
                            <input
                                type="text"
                                value={codigoGeneracionOriginal}
                                onChange={(e) => setCodigoGeneracionOriginal(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                                placeholder="Ej: 1F15A34D-CC0D-42AC-98F7-6ED8BDCE7D38"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                required
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={lookupOriginalDte}
                                disabled={originalLoading}
                                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
                            >
                                {originalLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                Buscar
                            </button>
                        </div>
                    </div>

                    {originalDte && (
                        <>
                            <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tipo DTE</span>
                                    <p className="text-sm font-black text-slate-900">{originalDte.tipoDteName} ({originalDte.tipoDte})</p>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Fecha Emisión</span>
                                    <p className="text-sm font-black text-slate-900">{originalDte.fechaEmision || 'N/A'}</p>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Receptor</span>
                                    <p className="text-sm font-black text-slate-900 truncate">{originalDte.receptor?.nombre || 'Consumidor Final'}</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <ShoppingCart size={16} className="text-indigo-600" />
                                    <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Items del DTE Original</span>
                                    <span className="text-[10px] text-slate-400 ml-auto">
                                        {selectedItems.filter(i => i.selected && i.returnQty > 0).length} seleccionados
                                    </span>
                                </div>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                <th className="px-3 py-2 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.length > 0 && selectedItems.every(i => i.selected)}
                                                        onChange={() => setSelectedItems(prev => prev.map(i => ({ ...i, selected: !prev.every(p => p.selected) })))}
                                                        className="rounded"
                                                    />
                                                </th>
                                                <th className="px-3 py-2">Item</th>
                                                <th className="px-3 py-2 text-right">Cant. Original</th>
                                                <th className="px-3 py-2 text-right">Cant. a Retornar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {originalDte.items.map((item, idx) => (
                                                <tr key={idx} className={`text-xs hover:bg-slate-50 transition-colors ${selectedItems.find(i => i.numItem === item.numItem)?.selected ? '' : 'opacity-40'}`}>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.find(i => i.numItem === item.numItem)?.selected || false}
                                                            onChange={() => toggleItem(item.numItem)}
                                                            className="rounded"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-slate-700">{item.descripcion}</td>
                                                    <td className="px-3 py-2 text-right font-bold text-slate-500">{item.cantidad}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={item.cantidad}
                                                            value={selectedItems.find(i => i.numItem === item.numItem)?.returnQty || 0}
                                                            onChange={(e) => updateReturnQty(item.numItem, e.target.value)}
                                                            className="w-20 px-2 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-indigo-400"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => { setIsEmitModalOpen(false); setOriginalDte(null); setSelectedItems([]); setCodigoGeneracionOriginal(''); }} className="flex-1 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={emitMutation.isPending || !originalDte} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                            {emitMutation.isPending ? (
                                <><Loader2 size={16} className="animate-spin" /> Emitiendo...</>
                            ) : (
                                <><Undo2 size={16} /> Emitir ERET</>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} title="JSON del ERET" maxWidth="max-w-4xl">
                {jsonData?.json_original ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                            <Code size={18} /> JSON del Evento de Retorno
                        </div>
                        <div className="bg-slate-950 p-6 rounded-3xl overflow-auto max-h-[70vh] border border-slate-800 shadow-2xl">
                            <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
                                {JSON.stringify(jsonData.json_original, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">No hay datos JSON disponibles</div>
                )}
            </Modal>

            <Modal isOpen={isResponseModalOpen} onClose={() => setIsResponseModalOpen(false)} title="Respuesta MH" maxWidth="max-w-xl">
                {responseData ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 text-xs">
                            <Info size={18} className="shrink-0" />
                            <p>Respuesta del Ministerio de Hacienda para este ERET.</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-3xl overflow-auto max-h-[400px]">
                            <pre className="text-indigo-300 font-mono text-xs leading-relaxed">
                                {typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">Sin respuesta registrada</div>
                )}
            </Modal>
        </div>
    );
};

export default Eret;