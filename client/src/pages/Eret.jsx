import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import {
    Plus, Search, Code, Terminal,
    CheckCircle2, XCircle, Clock, AlertCircle
} from 'lucide-react';
import { formatDateTime } from '../utils/dateUtils';
import { unwrapList, unwrapPagination } from '../utils/apiUtils';
import { EmitEretModal, EretJsonModal, EretResponseModal } from '../components/eret';

const Eret = () => {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [isEmitModalOpen, setIsEmitModalOpen] = useState(false);
    const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
    const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
    const [jsonData, setJsonData] = useState(null);
    const [responseData, setResponseData] = useState(null);
    const limit = 10;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: eretResponse = { items: [], pagination: { total: 0, page: 1, totalPages: 1 } }, isLoading } = useQuery({
        queryKey: ['eret', debouncedSearch, fechaDesde, fechaHasta, statusFilter, page],
        queryFn: async () => {
            const res = await axios.get('/api/retorno', {
                params: {
                    search: debouncedSearch || undefined,
                    fecha_desde: fechaDesde || undefined,
                    fecha_hasta: fechaHasta || undefined,
                    status: statusFilter || undefined,
                    page,
                    limit
                }
            });
            return {
                items: unwrapList(res),
                pagination: unwrapPagination(res)
            };
        }
    });

    const eretRows = Array.isArray(eretResponse?.items) ? eretResponse.items : [];
    const pagination = eretResponse?.pagination || { total: 0, page: 1, totalPages: 1 };

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
        } catch {
            toast.error('Error al obtener JSON del ERET');
        }
    };

    const fetchEretResponse = (row) => {
        setResponseData(row.respuesta_hacienda);
        setIsResponseModalOpen(true);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'ACCEPTED':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><CheckCircle2 size={11} /> Aceptado</span>;
            case 'REJECTED':
            case 'RECHAZADO':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><XCircle size={11} /> Rechazado</span>;
            case 'SENT':
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><Clock size={11} /> Enviado</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider"><AlertCircle size={11} /> {status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Evento de Retorno (ERET)</h2>
                    <p className="text-slate-500 font-medium text-sm">Gestión de Eventos de Retorno DTE-18 para devoluciones</p>
                </div>
                <button
                    onClick={() => setIsEmitModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all w-full md:w-auto"
                >
                    <Plus size={16} /> Nuevo ERET
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total ERETs</span>
                    <p className="text-2xl font-black text-slate-900">{pagination.total || 0}</p>
                </div>
                <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aceptados</span>
                    <p className="text-2xl font-black text-emerald-600">
                        {eretRows.filter((r) => r.status === 'ACCEPTED').length}
                    </p>
                </div>
                <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rechazados</span>
                    <p className="text-2xl font-black text-rose-600">
                        {eretRows.filter((r) => r.status === 'REJECTED' || r.status === 'RECHAZADO').length}
                    </p>
                </div>
                <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pendientes</span>
                    <p className="text-2xl font-black text-amber-600">
                        {eretRows.filter((r) => r.status !== 'ACCEPTED' && r.status !== 'REJECTED' && r.status !== 'RECHAZADO').length}
                    </p>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Buscar ERET</label>
                        <Search className="absolute left-3.5 bottom-3 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Código de generación, control o cliente..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-40">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Desde</label>
                        <input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium" />
                    </div>
                    <div className="w-full md:w-40">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Hasta</label>
                        <input type="date" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium" />
                    </div>
                    <div className="w-full md:w-40">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Estado MH</label>
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium">
                            <option value="">Todos</option>
                            <option value="ACCEPTED">Aceptado</option>
                            <option value="REJECTED">Rechazado</option>
                        </select>
                    </div>
                </div>

                <Table
                    headers={['Fecha', 'Código Generación', 'DTE Original', 'Estado MH', 'Acciones']}
                    data={eretRows}
                    isLoading={isLoading}
                    renderRow={(row) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-sm">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold text-slate-600">
                                    {formatDateTime(row.created_at || row.fh_procesamiento, 'N/A')}
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
                    totalPages={pagination.totalPages || 1}
                    totalItems={pagination.total || 0}
                    onPageChange={setPage}
                    itemsOnPage={eretRows.length}
                    isLoading={isLoading}
                />
            </div>

            <EmitEretModal isOpen={isEmitModalOpen} onClose={() => setIsEmitModalOpen(false)} />
            <EretJsonModal isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} jsonData={jsonData} />
            <EretResponseModal isOpen={isResponseModalOpen} onClose={() => setIsResponseModalOpen(false)} responseData={responseData} />
        </div>
    );
};

export default Eret;
