import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    FileText,
    Plus,
    Search,
    Edit2,
    Trash2,
    Copy,
    Share2,
    Eye,
    ShieldAlert,
    CheckCircle2,
    Clock,
    Handshake,
    DollarSign,
    RefreshCw,
    Mail,
    FileDown
} from 'lucide-react';
import Money from '../../components/ui/Money';
import PdfViewerModal from '../../components/ui/PdfViewerModal';
import QuotationModal from '../../components/crm/QuotationModal';
import SendEmailModal from '../../components/crm/SendEmailModal';
import { useAuth } from '../../context/AuthContext';

const STATUS_CONFIG = {
    borrador: { label: 'Borrador', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    enviada: { label: 'Enviada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    aprobada: { label: 'Aprobada', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rechazada: { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200' },
    vencida: { label: 'Vencida', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export default function CrmQuotations() {
    const { user: _user } = useAuth();
    const queryClient = useQueryClient();

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [page, setPage] = useState(1);

    // Modales
    const [quotationModalOpen, setQuotationModalOpen] = useState(false);
    const [selectedQuoteId, setSelectedQuoteId] = useState(null);

    // Visor de PDF
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState(null);

    // Modal de Envío por Correo
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [selectedQuoteForEmail, setSelectedQuoteForEmail] = useState(null);

    // Query principal de cotizaciones
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['crm-quotations', searchTerm, statusFilter, page],
        queryFn: async () => {
            const res = await axios.get('/api/crm/quotations', {
                params: {
                    search: searchTerm,
                    status: statusFilter,
                    page,
                    limit: 15
                }
            });
            return res.data;
        }
    });

    const quotations = data?.data || [];
    const kpis = data?.kpis || {};
    const totalPages = data?.totalPages || 1;

    // Mutación para cambiar estado
    const _statusMutation = useMutation({
        mutationFn: async ({ id, status }) => {
            await axios.patch(`/api/crm/quotations/${id}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-quotations'] });
            toast.success('Estado actualizado correctamente.');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al cambiar estado.');
        }
    });

    // Mutación para eliminar
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            await axios.delete(`/api/crm/quotations/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-quotations'] });
            toast.success('Cotización eliminada.');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar cotización.');
        }
    });

    // Mutación para duplicar
    const duplicateMutation = useMutation({
        mutationFn: async (id) => {
            const res = await axios.post(`/api/crm/quotations/${id}/duplicate`);
            return res.data;
        },
        onSuccess: (resData) => {
            queryClient.invalidateQueries({ queryKey: ['crm-quotations'] });
            toast.success(`Cotización duplicada como ${resData.quote_number}`);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al duplicar cotización.');
        }
    });

    // Mutación para convertir a acuerdo CRM
    const convertMutation = useMutation({
        mutationFn: async (id) => {
            const res = await axios.post(`/api/crm/quotations/${id}/convert-to-agreement`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-quotations'] });
            toast.success('¡Cotización aprobada y convertida a Acuerdo Comercial de CRM!');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al convertir a acuerdo.');
        }
    });

    // Abrir visor de PDF
    const handleViewPdf = async (quote) => {
        setSelectedQuoteForPdf(quote);
        setPdfModalOpen(true);
        setPdfLoading(true);
        if (pdfBlobUrl) {
            URL.revokeObjectURL(pdfBlobUrl);
            setPdfBlobUrl(null);
        }

        try {
            const response = await axios.get(`/api/crm/quotations/${quote.id}/pdf`, {
                responseType: 'blob'
            });
            const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            setPdfBlobUrl(blobUrl);
        } catch (err) {
            console.error('Error al descargar PDF:', err);
            toast.error('Error al generar PDF de la cotización.');
        } finally {
            setPdfLoading(false);
        }
    };

    // Compartir por WhatsApp
    const handleShareWhatsapp = (quote) => {
        const phone = quote.customer_phone ? quote.customer_phone.replace(/\D/g, '') : '';
        const greeting = `Estimados ${quote.customer_name}, reciba un cordial saludo de ANDELSA / Eggcelent. Adjuntamos la propuesta formal de cotización N° ${quote.quote_number} por un total de $${parseFloat(quote.total).toFixed(2)}. Quedamos a su entera disposición.`;
        const url = phone
            ? `https://wa.me/503${phone}?text=${encodeURIComponent(greeting)}`
            : `https://wa.me/?text=${encodeURIComponent(greeting)}`;
        window.open(url, '_blank');
    };

    // Descargar Word (.docx) editable
    const handleDownloadDocx = async (quote) => {
        const toastId = toast.loading(`Generando documento Word de ${quote.quote_number}...`);
        try {
            const res = await axios.get(`/api/crm/quotations/${quote.id}/docx`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Cotizacion_${quote.quote_number || quote.id}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Documento Word descargado con éxito.', { id: toastId });
        } catch (err) {
            console.error('Error al descargar Word (.docx):', err);
            toast.error('No se pudo generar el documento Word.', { id: toastId });
        }
    };

    // Abrir modal de envío por correo
    const handleOpenEmailModal = (quote) => {
        setSelectedQuoteForEmail(quote);
        setEmailModalOpen(true);
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Encabezado Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                Cotizador Comercial
                            </h1>
                            <p className="text-xs text-slate-500">
                                Gestión de propuestas comerciales • Formato oficial Eggcelent / ANDELSA con control de costos y márgenes
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 bg-white"
                        title="Actualizar listado"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedQuoteId(null);
                            setQuotationModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cotización
                    </button>
                </div>
            </div>

            {/* KPI Cards Superiores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 md:gap-5">
                {/* Total Cotizado del Mes */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Total Cotizado (Mes)
                        </span>
                        <span className="text-lg md:text-xl font-black text-slate-800">
                            <Money amount={kpis.total_quoted_amount || 0} />
                        </span>
                    </div>
                </div>

                {/* Cotizaciones Activas / Total */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Cotizaciones Mes
                        </span>
                        <span className="text-lg md:text-xl font-black text-slate-800">
                            {kpis.total_quotes || 0}
                        </span>
                    </div>
                </div>

                {/* Cotizaciones Aprobadas */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Aprobadas (Mes)
                        </span>
                        <span className="text-lg md:text-xl font-black text-emerald-700">
                            {kpis.approved_quotes || 0}
                        </span>
                    </div>
                </div>

                {/* Cotizaciones Delicadas (Alerta) */}
                <div className={`p-4 rounded-2xl border shadow-sm flex items-center gap-3.5 ${
                    kpis.delicate_quotes > 0
                        ? 'bg-red-50/70 border-red-200 text-red-900'
                        : 'bg-white border-slate-200'
                }`}>
                    <div className={`p-3 rounded-xl ${
                        kpis.delicate_quotes > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider block opacity-70">
                            Cotizaciones Delicadas
                        </span>
                        <span className="text-lg md:text-xl font-black">
                            {kpis.delicate_quotes || 0}
                        </span>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-3.5">
                {/* Búsqueda */}
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, cotización..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-9 pr-3 py-2 text-[13px] font-medium rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-slate-50/50"
                    />
                </div>

                {/* Filtro por estado */}
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    {['todos', 'borrador', 'enviada', 'aprobada', 'delicada', 'vencida'].map((st) => (
                        <button
                            key={st}
                            type="button"
                            onClick={() => {
                                setStatusFilter(st);
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                                statusFilter === st
                                    ? st === 'delicada'
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {st === 'delicada' ? '🚨 Delicadas' : st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla de Cotizaciones */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4">N° Cotización</th>
                                <th className="py-3 px-4">Emisión / Vence</th>
                                <th className="py-3 px-4">Cliente / Contacto</th>
                                <th className="py-3 px-4">Productos</th>
                                <th className="py-3 px-4 text-right">Total ($)</th>
                                <th className="py-3 px-4 text-center">Margen</th>
                                <th className="py-3 px-4 text-center">Estado</th>
                                <th className="py-3 px-4 text-center">Delicada</th>
                                <th className="py-3 px-4">Asesor</th>
                                <th className="py-3 px-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400 font-medium">
                                        Cargando cotizaciones comerciales...
                                    </td>
                                </tr>
                            ) : quotations.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400 font-medium">
                                        No se encontraron cotizaciones con los criterios seleccionados.
                                    </td>
                                </tr>
                            ) : (
                                quotations.map((q) => {
                                    const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.borrador;
                                    const isDel = Boolean(q.is_delicate);

                                    return (
                                        <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* N° Cotización */}
                                            <td className="py-3 px-4 font-bold text-indigo-600">
                                                {q.quote_number}
                                            </td>

                                            {/* Fechas */}
                                            <td className="py-3 px-4 text-slate-600">
                                                <div className="font-semibold text-slate-800">
                                                    {q.date ? q.date.split('T')[0] : '---'}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    Vence: {q.expiration_date ? q.expiration_date.split('T')[0] : '---'}
                                                </div>
                                            </td>

                                            {/* Cliente */}
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-800 line-clamp-1">
                                                    {q.customer_name}
                                                </div>
                                                {q.customer_contact && (
                                                    <div className="text-[11px] text-slate-500">
                                                        Att: {q.customer_contact}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Productos */}
                                            <td className="py-3 px-4 text-slate-600 max-w-xs">
                                                <div className="line-clamp-1 font-medium">
                                                    {q.products_summary || `${q.items_count} producto(s)`}
                                                </div>
                                                <span className="text-[10px] text-slate-400">
                                                    {q.items_count} ítem(s) cotizado(s)
                                                </span>
                                            </td>

                                            {/* Total */}
                                            <td className="py-3 px-4 text-right font-black text-slate-800">
                                                <Money amount={q.total} />
                                            </td>

                                            {/* Margen */}
                                            <td className="py-3 px-4 text-center">
                                                <span className={`font-black ${
                                                    parseFloat(q.overall_margin_pct) <= 0
                                                        ? 'text-red-600'
                                                        : parseFloat(q.overall_margin_pct) < 15
                                                        ? 'text-amber-600'
                                                        : 'text-emerald-600'
                                                }`}>
                                                    {parseFloat(q.overall_margin_pct).toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* Estado */}
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.color}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </td>

                                            {/* Delicada */}
                                            <td className="py-3 px-4 text-center">
                                                {isDel ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200 cursor-help"
                                                        title={q.delicate_reason || 'Bajo costo o margen inferior al 15%'}
                                                    >
                                                        <ShieldAlert className="w-3 h-3" />
                                                        DELICADA
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 font-bold">—</span>
                                                )}
                                            </td>

                                            {/* Asesor */}
                                            <td className="py-3 px-4 text-slate-600">
                                                <div className="font-medium text-slate-700 line-clamp-1">
                                                    {q.signature_author_name || q.created_by_name || 'Raul Sosa'}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {q.signature_data ? '✓ Con firma digital' : 'Sin firma'}
                                                </div>
                                            </td>

                                            {/* Acciones */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Ver PDF */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewPdf(q)}
                                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Ver PDF Oficial"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {/* Descargar Word (.docx) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadDocx(q)}
                                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Descargar Word (.docx) editable"
                                                    >
                                                        <FileDown className="w-4 h-4" />
                                                    </button>

                                                    {/* Enviar por Correo Electrónico */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEmailModal(q)}
                                                        className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition-colors"
                                                        title="Enviar por Correo Electrónico"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                    </button>

                                                    {/* Compartir por WhatsApp */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleShareWhatsapp(q)}
                                                        className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Compartir por WhatsApp"
                                                    >
                                                        <Share2 className="w-4 h-4" />
                                                    </button>

                                                    {/* Convertir a Acuerdo CRM */}
                                                    {q.status !== 'aprobada' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm(`¿Convertir la cotización ${q.quote_number} en Acuerdo Comercial formal de CRM para ${q.customer_name}?`)) {
                                                                    convertMutation.mutate(q.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Aprobar y Convertir a Acuerdo de Precios CRM"
                                                        >
                                                            <Handshake className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Duplicar */}
                                                    <button
                                                        type="button"
                                                        onClick={() => duplicateMutation.mutate(q.id)}
                                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Duplicar Cotización"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>

                                                    {/* Editar */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedQuoteId(q.id);
                                                            setQuotationModalOpen(true);
                                                        }}
                                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>

                                                    {/* Eliminar */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm(`¿Eliminar la cotización ${q.quote_number}?`)) {
                                                                deleteMutation.mutate(q.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <span>Página {page} de {totalPages}</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Principal de Creación / Edición */}
            <QuotationModal
                isOpen={quotationModalOpen}
                onClose={() => setQuotationModalOpen(false)}
                quotationId={selectedQuoteId}
                onSaved={() => {
                    refetch();
                }}
            />

            {/* Modal Visor de PDF Oficial */}
            <PdfViewerModal
                isOpen={pdfModalOpen}
                onClose={() => {
                    setPdfModalOpen(false);
                    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
                    setPdfBlobUrl(null);
                }}
                title={`Cotización ${selectedQuoteForPdf?.quote_number || ''}`}
                subtitle={`Cliente: ${selectedQuoteForPdf?.customer_name || ''} • Emisión: ${selectedQuoteForPdf?.date?.split('T')[0] || ''}`}
                badge="Formato Oficial Eggcelent"
                pdfUrl={pdfBlobUrl}
                isLoading={pdfLoading}
                fileName={`Cotizacion_${selectedQuoteForPdf?.quote_number || 'ANDELSA'}.pdf`}
                footerNote="Documento Oficial ANDELSA / Eggcelent • Incluye Firma Electrónica y Cláusulas de Envases Retornables"
            />

            {/* Modal de Envío por Correo Electrónico */}
            <SendEmailModal
                isOpen={emailModalOpen}
                onClose={() => {
                    setEmailModalOpen(false);
                    setSelectedQuoteForEmail(null);
                }}
                quotation={selectedQuoteForEmail}
                onSent={() => refetch()}
            />
        </div>
    );
}

