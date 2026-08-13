import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertCircle, Ban, Calendar, CheckCircle2, Clock, FileText, FileSpreadsheet, Loader2, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Money from '../../components/ui/Money';

const VatBookAnexosIVA = () => {
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];

    const [fechaInicio, setFechaInicio] = useState(firstDayOfMonth);
    const [fechaFin, setFechaFin] = useState(currentDate.toISOString().split('T')[0]);
    const [tipoDte, setTipoDte] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [isExporting, setIsExporting] = useState(null);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const queryParams = {
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        tipo_dte: tipoDte || undefined,
        search: debouncedSearch || undefined,
        page,
        limit
    };

    const { data: tipoDocs = [] } = useQuery({
        queryKey: ['catalog', '002'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_002_tipo_dte')).data
    });

    const { data: response = { data: [], total: 0, page: 1, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['anexos-iva', fechaInicio, fechaFin, tipoDte, debouncedSearch, page, limit],
        queryFn: async () => (await axios.get('/api/vat-books/anexos-iva', { params: queryParams })).data
    });

    const anexos = response.data || [];

    const exportToFile = async (endpoint, mime, filename, type) => {
        setIsExporting(type);
        try {
            const params = {
                fecha_inicio: fechaInicio || undefined,
                fecha_fin: fechaFin || undefined,
                tipo_dte: tipoDte || undefined,
                search: debouncedSearch || undefined
            };
            const res = await axios.get(endpoint, { params, responseType: 'blob' });
            const contentType = res.headers['content-type'] || '';
            if (!contentType.includes(mime)) {
                const text = await res.data.text();
                console.error('Respuesta inesperada del servidor:', text);
                toast.error('El servidor retornó una respuesta inesperada');
                return;
            }
            const blob = new Blob([res.data], { type: contentType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success(type === 'pdf' ? 'PDF exportado correctamente' : 'Excel exportado correctamente');
        } catch (error) {
            console.error('Error al exportar:', error);
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    toast.error(json.message || json.error || 'Error al exportar');
                } catch (e) {
                    toast.error('Error al exportar');
                }
            } else {
                toast.error(error.response?.data?.message || 'Error al exportar');
            }
        } finally {
            setIsExporting(null);
        }
    };

const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm";
const labelCls = "text-[10px] font-bold text-slate-500 uppercase tracking-wider";

const ESTADO_CONFIG = {
    ACCEPTED: { label: 'Aceptado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
    REJECTED: { label: 'Rechazado', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', icon: XCircle },
    ERROR: { label: 'Rechazado', cls: 'bg-rose-50 text-rose-700 ring-rose-600/20', icon: XCircle },
    SENT: { label: 'Enviado', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20', icon: Clock },
    CONTINGENCY: { label: 'Contingencia', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: AlertCircle },
    INVALIDADO: { label: 'Anulado', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Ban }
};

const EstadoBadge = ({ estado }) => {
    const cfg = ESTADO_CONFIG[estado?.toUpperCase?.()] || { label: 'Pendiente', cls: 'bg-slate-100 text-slate-600 ring-slate-500/20', icon: Clock };
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ring-inset whitespace-nowrap ${cfg.cls}`}>
            <Icon size={11} />
            {cfg.label}
        </span>
    );
};

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Anexos de IVA</h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest">
                        Consulta de ventas DTE por rango de fechas y tipo de documento
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => exportToFile('/api/vat-books/anexos-iva-pdf', 'application/pdf', 'Anexos_IVA.pdf', 'pdf')}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                    >
                        {isExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        <span className="hidden sm:inline">Exportar PDF</span>
                        <span className="sm:hidden">PDF</span>
                    </button>
                    <button
                        onClick={() => exportToFile('/api/vat-books/anexos-iva-excel', 'spreadsheetml', 'Anexos_IVA.xlsx', 'excel')}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                    >
                        {isExporting === 'excel' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        <span className="hidden sm:inline">Exportar Excel</span>
                        <span className="sm:hidden">Excel</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <label className={labelCls}>Fecha Inicio</label>
                        <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setPage(1); }} className={inputCls} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelCls}>Fecha Fin</label>
                        <input type="date" value={fechaFin} onChange={(e) => { setFechaFin(e.target.value); setPage(1); }} className={inputCls} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelCls}>Tipo de DTE</label>
                        <select value={tipoDte} onChange={(e) => { setTipoDte(e.target.value); setPage(1); }} className={inputCls}>
                            <option value="">Todos</option>
                            {tipoDocs.map(t => (
                                <option key={t.code} value={t.code}>{t.description?.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelCls}>Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Cliente, NIT, NRC, control..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`${inputCls} pl-9`}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Table
                headers={['N°', 'Fecha', 'Código Generación', 'N° Control', 'Sello Recepción', 'Estado', 'Cliente', 'NIT', 'NRC', 'Tipo DTE', 'Exentas', 'Gravadas', 'IVA', 'Retención', 'FOVIAL', 'COTRANS', 'Total']}
                data={anexos}
                isLoading={isLoading}
                renderRow={(r) => (
                    <tr key={r.corr} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1.5 text-[11px] font-bold text-slate-400">{r.corr}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.fecha}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.codigo_generacion || '---'}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.numero_control || '---'}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.sello_recepcion || '---'}</td>
                        <td className="px-3 py-1.5"><EstadoBadge estado={r.estado} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-bold text-slate-800 max-w-[180px] truncate">{r.cliente}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.nit || '---'}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.nrc || '---'}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">{r.tipo_dte}</td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-right whitespace-nowrap"><Money value={r.exentas} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-right whitespace-nowrap"><Money value={r.gravadas} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-right whitespace-nowrap"><Money value={r.iva} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-right whitespace-nowrap"><Money value={r.retencion} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-right whitespace-nowrap"><Money value={r.fovial} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-medium text-right whitespace-nowrap"><Money value={r.cotrans} /></td>
                        <td className="px-3 py-1.5 text-[11px] font-bold text-slate-900 text-right whitespace-nowrap"><Money value={r.total} /></td>
                    </tr>
                )}
                renderCard={(r) => (
                    <div className="space-y-2" key={r.corr}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-900 truncate">{r.cliente}</span>
                            <span className="text-[11px] font-bold text-indigo-600 whitespace-nowrap"><Money value={r.total} /></span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
                            <span className="inline-flex items-center gap-1"><Calendar size={11} className="text-slate-400" />{r.fecha}</span>
                            <span>{r.numero_control || '---'}</span>
                            <span>{r.tipo_dte}</span>
                            <span><EstadoBadge estado={r.estado} /></span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t border-slate-100 text-[10px] font-medium text-slate-500">
                            <span>Exentas: <Money value={r.exentas} /></span>
                            <span>Gravadas: <Money value={r.gravadas} /></span>
                            <span>IVA: <Money value={r.iva} /></span>
                            <span>Retención: <Money value={r.retencion} /></span>
                            <span>FOVIAL: <Money value={r.fovial} /></span>
                            <span>COTRANS: <Money value={r.cotrans} /></span>
                        </div>
                    </div>
                )}
            />

            <Pagination
                currentPage={response.page || 1}
                totalPages={response.totalPages || 0}
                totalItems={response.total || 0}
                onPageChange={setPage}
                itemsOnPage={anexos.length}
                isLoading={isLoading}
                limit={limit}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
            />
        </div>
    );
};

export default VatBookAnexosIVA;
