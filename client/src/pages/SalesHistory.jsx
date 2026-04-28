import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { 
    Search, FileText, Eye, Printer, Trash2, Calendar, User, Tag, 
    ShoppingCart, CreditCard, Banknote, MapPin, Mail, Phone, Calculator,
    Terminal, FileJson, Code, CheckCircle2, XCircle, AlertCircle, Info, Clock, Send, Ban, RefreshCcw,
    MoreHorizontal, ChevronDown, Building2
} from 'lucide-react';

const formatDateTime = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A 00:00';
    
    // Si la cadena no contiene fecha válida, retornar N/A
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A 00:00';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const formatNIT = (value) => {
    if (!value) return '';
    const v = value.replace(/\D/g, '').slice(0, 14);
    if (v.length <= 4) return v;
    if (v.length <= 10) return `${v.slice(0, 4)}-${v.slice(4)}`;
    if (v.length <= 13) return `${v.slice(0, 4)}-${v.slice(4, 10)}-${v.slice(10)}`;
    return `${v.slice(0, 4)}-${v.slice(4, 10)}-${v.slice(10, 13)}-${v.slice(13)}`;
};

const formatDUI = (value) => {
    if (!value) return '';
    const v = value.replace(/\D/g, '').slice(0, 9);
    if (v.length <= 8) return v;
    return `${v.slice(0, 8)}-${v.slice(8)}`;
};

const SalesHistory = () => {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedSaleId, setSelectedSaleId] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
    const [isLegibleModalOpen, setIsLegibleModalOpen] = useState(false);
    const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
    const [voidForm, setVoidForm] = useState({
        motivo: '2',
        descripcion: '',
        nombreResponsable: '',
        tipDocResponsable: '36',
        numDocResponsable: '',
        nombreSolicita: '',
        tipDocSolicita: '36',
        numDocSolicita: ''
    });
    const [isRetransmitModalOpen, setIsRetransmitModalOpen] = useState(false);
    const [retransmitForm, setRetransmitForm] = useState({
        nombre: '',
        nit: '',
        nrc: '',
        email: ''
    });
    const [retransmitLoading, setRetransmitLoading] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const limit = 10;

    const { data: salesData = { data: [], totalItems: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['sales-history', search, page],
        queryFn: async () => (await axios.get('/api/sales', { params: { search, page, limit } })).data
    });

    const { data: saleDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['sale-detail', selectedSaleId],
        queryFn: async () => (await axios.get(`/api/sales/${selectedSaleId}`)).data,
        enabled: !!selectedSaleId
    });

    const handleViewSale = (id) => {
        setSelectedSaleId(id);
        setIsViewModalOpen(true);
    };

    const handleViewResponse = (id) => {
        setSelectedSaleId(id);
        setIsResponseModalOpen(true);
    };

    const handleViewJSON = (id) => {
        setSelectedSaleId(id);
        setIsLegibleModalOpen(true);
    };

    const handleViewRTEE = async (id) => {
        try {
            const response = await axios.get(`/api/sales/rtee/${id}`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error viewing RTEE:', error);
            alert('Error al visualizar la Representación Gráfica');
        }
    };

    const handleResendEmail = async (sale) => {
        if (!sale.customer_email) {
            return toast.error('El cliente no tiene un correo electrónico registrado');
        }

        try {
            await axios.post(`/api/sales/resend-email/${sale.id}`);
            toast.success('Proceso de reenvío de correo iniciado');
            queryClient.invalidateQueries(['sales-history']);
        } catch (error) {
            console.error('Error al reenviar correo:', error);
            toast.error('Error al iniciar el reenvío de correo');
        }
    };

    const handleOpenVoidModal = (sale) => {
        const user = JSON.parse(localStorage.getItem('user')) || {};
        const tipDoc = '36'; // Default NIT
        setVoidForm({
            ...voidForm,
            sale_id: sale.id,
            nombreResponsable: user.nombre || '',
            tipDocResponsable: tipDoc,
            numDocResponsable: formatNIT(user.nit || ''),
            nombreSolicita: sale.customer_name || 'CLIENTE',
            tipDocSolicita: '36',
            numDocSolicita: ''
        });
        setSelectedSaleId(sale.id);
        setIsVoidModalOpen(true);
    };

    const handleIdentificacionChange = (field, typeField, value) => {
        const type = voidForm[typeField];
        let formattedValue = value;
        if (type === '36') formattedValue = formatNIT(value);
        if (type === '13') formattedValue = formatDUI(value);
        
        setVoidForm({ ...voidForm, [field]: formattedValue });
    };

    const handleVoidSubmit = async (e) => {
        e.preventDefault();
        
        // Validación de longitudes
        const respLen = voidForm.numDocResponsable.replace(/\D/g, '').length;
        const solLen = voidForm.numDocSolicita.replace(/\D/g, '').length;

        if (voidForm.tipDocResponsable === '36' && respLen !== 14) return toast.error('El NIT del responsable debe tener 14 dígitos');
        if (voidForm.tipDocResponsable === '13' && respLen !== 9) return toast.error('El DUI del responsable debe tener 9 dígitos');
        if (voidForm.tipDocSolicita === '36' && solLen !== 14) return toast.error('El NIT del solicitante debe tener 14 dígitos');
        if (voidForm.tipDocSolicita === '13' && solLen !== 9) return toast.error('El DUI del solicitante debe tener 9 dígitos');

        try {
            await axios.post(`/api/sales/${selectedSaleId}/void`, voidForm);
            toast.success('Venta anulada correctamente');
            setIsVoidModalOpen(false);
            queryClient.invalidateQueries(['sales-history']);
        } catch (error) {
            console.error('Error voiding sale:', error);
            toast.error(error.response?.data?.message || 'Error al anular la venta');
        }
    };

    const handleOpenRetransmitModal = (sale) => {
        setRetransmitForm({
            nombre: sale.customer_name || 'CONSUMIDOR FINAL',
            nit: sale.customer_nit || '',
            nrc: sale.customer_nrc || '',
            email: sale.customer_email || ''
        });
        setSelectedSaleId(sale.id);
        setIsRetransmitModalOpen(true);
    };

    const handleRetransmitSubmit = async (e) => {
        e.preventDefault();
        setRetransmitLoading(true);
        try {
            await axios.post(`/api/sales/${selectedSaleId}/retransmit`, {
                newReceptor: {
                    nombre: retransmitForm.nombre,
                    nit: retransmitForm.nit,
                    nrc: retransmitForm.nrc,
                    correo: retransmitForm.email
                }
            });
            toast.success('DTE retransmitido con éxito');
            setIsRetransmitModalOpen(false);
            queryClient.invalidateQueries(['sales-history']);
        } catch (error) {
            console.error('Error retransmitting DTE:', error);
            toast.error(error.response?.data?.message || 'Error al retransmitir');
        } finally {
            setRetransmitLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'ACCEPTED':
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider"><CheckCircle2 size={12} /> Aceptado</span>;
            case 'REJECTED':
            case 'RECHAZADO':
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-wider"><XCircle size={12} /> Rechazado</span>;
            case 'SENT':
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider"><Clock size={12} /> Enviado</span>;
            case 'anulado':
            case 'INVALIDADO':
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider"><Ban size={12} /> Anulado</span>;
            default:
                return <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider"><AlertCircle size={12} /> Pendiente</span>;
        }
    };

    const isVoidableDTE = (sale) => {
        if (!sale.codigo_generacion) return true; // Si no es DTE oficial, es anulable siempre
        // Para DTE oficial, límite de 24 horas
        const emissionDateStr = sale.fecha_emision.substring(0, 10);
        const emissionDateTime = new Date(`${emissionDateStr}T${sale.hora_emision}`);
        const now = new Date();
        const diffHours = (now - emissionDateTime) / (1000 * 60 * 60);
        
        const isFactura = sale.tipo_documento === '01' || (sale.tipo_documento_name && sale.tipo_documento_name.toLowerCase().includes('factura'));
        const limitHours = isFactura ? (90 * 24) : 24;
        
        return diffHours <= limitHours;
    };

    const getRemainingHours = (sale) => {
        if (!sale.codigo_generacion) return null;
        const emissionDateStr = sale.fecha_emision.substring(0, 10);
        const emissionDateTime = new Date(`${emissionDateStr}T${sale.hora_emision}`);
        const now = new Date();
        const diffHours = 24 - ((now - emissionDateTime) / (1000 * 60 * 60));
        return Math.max(0, diffHours).toFixed(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-Spanish">Historial de Ventas</h2>
                    <p className="text-slate-500 font-medium text-Spanish">Consulta y gestión de documentos emitidos</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nro. control o cliente..."
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <Table 
                    headers={['Fecha', 'Sucursal', 'Documento', 'Cliente', 'Estado MH', 'Total', 'Acciones']}
                    data={salesData.data}
                    isLoading={isLoading}
                    renderRow={(sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-sm">
                            <td className="px-4 py-2">
                                <span className="text-[11px] font-bold text-slate-600 block leading-tight">
                                    {formatDateTime(sale.fh_procesamiento || `${sale.fecha_emision.substring(0, 10)}T${sale.hora_emision}`).split(' ')[0]}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium lowercase tracking-tighter">
                                    {formatDateTime(sale.fh_procesamiento || `${sale.fecha_emision.substring(0, 10)}T${sale.hora_emision}`).split(' ')[1]}
                                </span>
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">
                                        {sale.branch_name || 'Central'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                        {sale.pos_name || 'Principal'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex flex-col leading-tight">
                                    <span className="font-bold text-slate-900 text-xs">{sale.tipo_documento_name}</span>
                                    {sale.numero_control ? (
                                        <span className="text-[9px] font-mono font-bold text-indigo-500 opacity-80 break-all line-clamp-1" title={sale.numero_control}>{sale.numero_control}</span>
                                    ) : (
                                        <span className="text-[8px] px-1 bg-slate-100 text-slate-400 rounded w-fit font-bold uppercase tracking-widest">Sin Control</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex flex-col leading-tight">
                                    <span className="font-bold text-slate-700 text-xs truncate max-w-[120px]" title={sale.customer_name}>{sale.customer_name || 'Consumidor Final'}</span>
                                    <span className={`text-[8px] px-1 rounded w-fit font-black uppercase tracking-widest ${
                                        sale.condicion_operacion == 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                        {sale.condicion_operacion == 1 ? 'Contado' : 'Crédito'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                    {getStatusBadge(sale.dte_status)}
                                    {sale.dte_status === 'ACCEPTED' && (
                                        <div 
                                            className={`p-1 rounded-full ${sale.dte_email_sent ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-slate-50'}`}
                                            title={sale.dte_email_sent ? 'Correo enviado con éxito' : (sale.customer_email ? (sale.dte_email_error || 'Correo no enviado') : 'Cliente sin correo')}
                                        >
                                            <Mail size={12} />
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-2 font-black text-slate-900 text-sm">
                                ${parseFloat(sale.total_pagar).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right overflow-visible">
                                <div className="relative flex justify-end">
                                    <button 
                                        onClick={() => setOpenMenuId(openMenuId === sale.id ? null : sale.id)}
                                        className={`p-2 rounded-xl transition-all flex items-center gap-1 border ${
                                            openMenuId === sale.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600 border-slate-100'
                                        }`}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest pl-1">Acciones</span>
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${openMenuId === sale.id ? 'rotate-180' : ''}`} />
                                    </button>

                                    {openMenuId === sale.id && (
                                        <>
                                            <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[101] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="p-2 grid grid-cols-1 gap-1">
                                                    <button onClick={() => { handleViewSale(sale.id); setOpenMenuId(null); }} className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><Eye size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Ver Detalle</span>
                                                    </button>
                                                    
                                                    <button onClick={() => { handleViewRTEE(sale.id); setOpenMenuId(null); }} className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform"><FileText size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Representación (PDF)</span>
                                                    </button>

                                                    <button onClick={() => { handleViewJSON(sale.id); setOpenMenuId(null); }} className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg group-hover:scale-110 transition-transform"><Code size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Ver JSON DTE</span>
                                                    </button>

                                                    <button onClick={() => { handleViewResponse(sale.id); setOpenMenuId(null); }} className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform"><Terminal size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Respuesta MH</span>
                                                    </button>

                                                    {sale.dte_status === 'ACCEPTED' && (
                                                        <button onClick={() => { handleResendEmail(sale); setOpenMenuId(null); }} className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform"><Send size={14} /></div>
                                                            <span className="text-xs font-bold text-slate-600">Reenviar Correo</span>
                                                        </button>
                                                    )}

                                                    {(sale.dte_status === 'REJECTED' || sale.dte_status === 'RECHAZADO') && (
                                                        <button onClick={() => { handleOpenRetransmitModal(sale); setOpenMenuId(null); }} className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:scale-110 transition-transform"><RefreshCcw size={14} /></div>
                                                            <span className="text-xs font-bold text-slate-600">Reintentar Envío</span>
                                                        </button>
                                                    )}

                                                    <div className="h-px bg-slate-100 my-1 mx-2" />

                                                    <button 
                                                        onClick={() => { handleOpenVoidModal(sale); setOpenMenuId(null); }} 
                                                        disabled={sale.estado === 'anulado' || !isVoidableDTE(sale)}
                                                        className={`flex items-center gap-3 w-full p-2.5 text-left rounded-xl transition-all group ${
                                                            sale.estado === 'anulado' || !isVoidableDTE(sale) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-rose-50 text-rose-600'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg group-hover:scale-110 transition-transform ${
                                                            sale.estado === 'anulado' || !isVoidableDTE(sale) ? 'bg-slate-100 text-slate-400' : 'bg-rose-100 text-rose-600'
                                                        }`}><Ban size={14} /></div>
                                                        <span className="text-xs font-bold">Anular Operación</span>
                                                    </button>

                                                    <button className="flex items-center gap-3 w-full p-2.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-slate-100 text-slate-400 rounded-lg group-hover:scale-110 transition-transform"><Printer size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-400">Imprimir Tiket</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                />
                <Pagination 
                    currentPage={page}
                    totalPages={salesData.totalPages}
                    totalItems={salesData.totalItems}
                    onPageChange={setPage}
                    itemsOnPage={salesData.data.length}
                    isLoading={isLoading}
                />
            </div>

            {/* Modal de Detalle */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title="Detalle de Venta"
                maxWidth="max-w-4xl"
            >
                {isLoadingDetail ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Cargando Detalle...</p>
                    </div>
                ) : saleDetail ? (
                    <div className="space-y-8">
                        {/* Cabecera del Documento */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-slate-900">
                                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><FileText size={20} /></div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Información del Documento</h4>
                                        <p className="text-lg font-black">{saleDetail.tipo_documento_name}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nro. Control</span>
                                        <span className="font-mono font-black text-indigo-600">{saleDetail.numero_control || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Emisión</span>
                                        <span className="font-black text-slate-700">{new Date(saleDetail.fecha_emision).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {saleDetail.codigo_generacion && (
                                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                                        <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Código de Generación (DTE)</span>
                                        <span className="font-mono text-xs font-black text-indigo-700 break-all">{saleDetail.codigo_generacion}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-slate-900">
                                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><User size={20} /></div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Información del Cliente</h4>
                                        <p className="text-lg font-black">{saleDetail.customer_name || 'Consumidor Final'}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 grid grid-cols-1 gap-2 mb-4">
                                    {saleDetail.customer_nit && (
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <Tag size={14} className="text-slate-300" />
                                            <span>NIT: {saleDetail.customer_nit}</span>
                                        </div>
                                    )}
                                    {saleDetail.customer_address && (
                                        <div className="flex items-start gap-2 text-xs font-bold text-slate-500">
                                            <MapPin size={14} className="text-slate-300 mt-0.5" />
                                            <span className="flex-1">{saleDetail.customer_address}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sucursal / Terminal</span>
                                        <span className="block font-black text-slate-700 text-[10px] uppercase leading-tight line-clamp-1">{saleDetail.branch_name || 'Matriz'}</span>
                                        <span className="block font-bold text-indigo-400 text-[9px] uppercase tracking-tighter mt-0.5">{saleDetail.pos_name || 'Principal'}</span>
                                    </div>

                                    <div className={`p-3 rounded-2xl border ${
                                        saleDetail.condicion_operacion == 1 
                                            ? 'bg-emerald-50 border-emerald-100' 
                                            : 'bg-amber-50 border-amber-100'
                                    }`}>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Condición</span>
                                        <span className={`font-black text-sm ${
                                            saleDetail.condicion_operacion == 1 ? 'text-emerald-700' : 'text-amber-700'
                                        }`}>
                                            {saleDetail.condicion_operacion == 1 ? 'Contado' : 'Crédito'}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado de Venta</span>
                                        <span className="font-black text-slate-700 capitalize text-sm">{saleDetail.estado}</span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vendedor / Cajero</span>
                                        <span className="font-black text-slate-700 uppercase text-[11px] leading-tight line-clamp-2">{saleDetail.seller_name || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Listado de Ítems */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-900 font-black uppercase text-xs tracking-widest border-b border-slate-100 pb-4">
                                <ShoppingCart size={18} className="text-indigo-600" />
                                <span>Detalle de Ítems</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                            <th className="py-3 px-2">Descripción</th>
                                            <th className="py-3 px-2 text-center">Cant.</th>
                                            <th className="py-3 px-2 text-right">Precio U.</th>
                                            <th className="py-3 px-2 text-right">Desc.</th>
                                            <th className="py-3 px-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {saleDetail.items?.map((item, idx) => (
                                            <tr key={idx} className="text-xs">
                                                <td className="py-3 px-2 font-bold text-slate-700">{item.descripcion}</td>
                                                <td className="py-3 px-2 text-center font-black text-slate-900">{item.cantidad}</td>
                                                <td className="py-3 px-2 text-right font-medium text-slate-600">${parseFloat(item.precio_unitario).toFixed(2)}</td>
                                                <td className="py-3 px-2 text-right font-medium text-rose-500">-${parseFloat(item.monto_descuento || 0).toFixed(2)}</td>
                                                <td className="py-3 px-2 text-right font-black text-slate-900">
                                                    ${((item.cantidad * item.precio_unitario) - (item.monto_descuento || 0)).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totales y Pagos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-widest">
                                    <CreditCard size={18} className="text-indigo-600" />
                                    <span>Formas de Pago</span>
                                </div>
                                <div className="space-y-2">
                                    {saleDetail.payments?.map((pay, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                                            <div className="flex items-center gap-2 font-bold text-slate-600">
                                                <Banknote size={14} className="text-emerald-500" />
                                                {pay.metodo_pago === '01' ? 'Efectivo' : 'Tarjeta/Transferencia'}
                                            </div>
                                            <span className="font-black text-slate-900">${parseFloat(pay.monto).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl space-y-4">
                                <div className="space-y-2 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>Gravada</span><span>${parseFloat(saleDetail.total_gravado).toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>IVA</span><span>${parseFloat(saleDetail.total_iva).toFixed(2)}</span></div>
                                    {parseFloat(saleDetail.fovial) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>FOVIAL</span><span>${parseFloat(saleDetail.fovial).toFixed(2)}</span></div>}
                                    {parseFloat(saleDetail.cotrans) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>COTRANS</span><span>${parseFloat(saleDetail.cotrans).toFixed(2)}</span></div>}
                                    {parseFloat(saleDetail.total_exento) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>Exenta</span><span>${parseFloat(saleDetail.total_exento).toFixed(2)}</span></div>}
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300"><span>Retención</span><span>-${parseFloat(saleDetail.iva_retenido || 0).toFixed(2)}</span></div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <span className="text-[10px] font-black uppercase text-indigo-400">Total Pagado</span>
                                    <span className="text-4xl font-black tracking-tighter">${parseFloat(saleDetail.total_pagar).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* Modal de Respuesta Hacienda */}
            <Modal
                isOpen={isResponseModalOpen}
                onClose={() => setIsResponseModalOpen(false)}
                title="Respuesta Técnica de Hacienda"
                maxWidth="max-w-xl"
            >
                {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : saleDetail?.respuesta_hacienda ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 text-xs">
                            <Info size={18} className="shrink-0" />
                            <p>Esta es la respuesta JSON literal recibida desde los servidores del Ministerio de Hacienda (MH).</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-3xl overflow-auto max-h-[400px]">
                            <pre className="text-indigo-300 font-mono text-xs leading-relaxed">
                                {JSON.stringify(saleDetail.respuesta_hacienda, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">Sin respuesta técnica registrada</div>
                )}
            </Modal>

            <Modal
                isOpen={isLegibleModalOpen}
                onClose={() => setIsLegibleModalOpen(false)}
                title="Inspección Técnica DTE (JSON Original)"
                maxWidth="max-w-4xl"
            >
                {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : saleDetail?.json_original ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                            <Code size={18} /> JSON Literal del DTE (Representación Técnica)
                        </div>
                        <div className="bg-slate-950 p-6 rounded-3xl overflow-auto max-h-[70vh] border border-slate-800 shadow-2xl">
                            <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
                                {JSON.stringify(saleDetail.json_original, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">No hay datos de DTE disponibles para este registro</div>
                )}
            </Modal>

            {/* Modal de Anulación */}
            <Modal
                isOpen={isVoidModalOpen}
                onClose={() => setIsVoidModalOpen(false)}
                title="Anular Documento"
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleVoidSubmit} className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-800 rounded-3xl border border-rose-100 text-xs">
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                            <p className="font-black uppercase tracking-widest mb-1">Advertencia Crítica</p>
                            <p className="font-medium">Esta acción revertirá el inventario, anulará el registro contable y, si es un DTE, enviará un Evento de Invalidación al Ministerio de Hacienda. **Esta acción no se puede deshacer.**</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo de Anulación (Normativa Hacienda)</label>
                            <select 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all cursor-pointer"
                                value={voidForm.motivo}
                                onChange={(e) => setVoidForm({ ...voidForm, motivo: e.target.value })}
                                required
                            >
                                <option value="2">Rescisión de la Operación (Anulación Total)</option>
                            </select>
                        </div>

                        <div className="space-y-4 md:col-span-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción Detallada</label>
                            <textarea 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all min-h-[80px]"
                                placeholder="Indique la razón técnica o comercial de la anulación..."
                                value={voidForm.descripcion}
                                onChange={(e) => setVoidForm({ ...voidForm, descripcion: e.target.value })}
                                required
                            />
                        </div>

                        {/* Datos de Responsabilidad */}
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Responsable (Quien anula)</label>
                            <input 
                                type="text"
                                className="w-full px-4 py-2.5 bg-slate-100/50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500"
                                value={voidForm.nombreResponsable}
                                readOnly
                                placeholder="Nombre del Usuario"
                            />
                            <div className="flex gap-2">
                                <select 
                                    className="w-20 px-2 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none"
                                    value={voidForm.tipDocResponsable}
                                    onChange={(e) => setVoidForm({ ...voidForm, tipDocResponsable: e.target.value, numDocResponsable: '' })}
                                >
                                    <option value="36">NIT</option>
                                    <option value="13">DUI</option>
                                </select>
                                <input 
                                    type="text"
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                                    value={voidForm.numDocResponsable}
                                    onChange={(e) => handleIdentificacionChange('numDocResponsable', 'tipDocResponsable', e.target.value)}
                                    placeholder={voidForm.tipDocResponsable === '36' ? '0000-000000-000-0' : '00000000-0'}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Solicitante (Cliente)</label>
                            <input 
                                type="text"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                                value={voidForm.nombreSolicita}
                                onChange={(e) => setVoidForm({ ...voidForm, nombreSolicita: e.target.value })}
                                placeholder="Nombre de quien solicita"
                                required
                            />
                            <div className="flex gap-2">
                                <select 
                                    className="w-20 px-2 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none"
                                    value={voidForm.tipDocSolicita}
                                    onChange={(e) => setVoidForm({ ...voidForm, tipDocSolicita: e.target.value, numDocSolicita: '' })}
                                >
                                    <option value="36">NIT</option>
                                    <option value="13">DUI</option>
                                </select>
                                <input 
                                    type="text"
                                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                                    value={voidForm.numDocSolicita}
                                    onChange={(e) => handleIdentificacionChange('numDocSolicita', 'tipDocSolicita', e.target.value)}
                                    placeholder={voidForm.tipDocSolicita === '36' ? '0000-000000-000-0' : '00000000-0'}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6">
                        <button 
                            type="button"
                            onClick={() => setIsVoidModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="px-8 py-2.5 bg-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all flex items-center gap-2"
                        >
                            <Ban size={16} /> Confirmar Anulación
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Retransmisión */}
            <Modal
                isOpen={isRetransmitModalOpen}
                onClose={() => setIsRetransmitModalOpen(false)}
                title="Reintentar Transmisión DTE"
                maxWidth="max-w-2xl"
            >
                <form onSubmit={handleRetransmitSubmit} className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-800 rounded-3xl border border-amber-100 text-xs">
                        <AlertCircle size={20} className="shrink-0" />
                        <div>
                            <p className="font-black uppercase tracking-widest mb-1">Corrección de Datos</p>
                            <p className="font-medium text-Spanish">El DTE fue rechazado previamente. Puede corregir la información del receptor a continuación y volver a intentar el envío a Hacienda.</p>
                        </div>
                    </div>

                    {selectedSaleId && salesData.data.find(s => s.id === selectedSaleId)?.dte_error && (
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                            <p className="text-[10px] font-black uppercase text-rose-400 mb-2">Error Reportado por Hacienda:</p>
                            <div className="bg-white/50 p-3 rounded-xl font-mono text-xs text-rose-700 border border-rose-200">
                                {(() => {
                                    const error = salesData.data.find(s => s.id === selectedSaleId).dte_error;
                                    if (typeof error === 'object' && error !== null) {
                                        return error.descripcionMsg || JSON.stringify(error);
                                    }
                                    return error;
                                })()}
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-50 p-6 rounded-3xl border border-dotted border-slate-200 text-center space-y-2">
                        <p className="text-slate-500 text-sm font-medium text-Spanish">Se intentará enviar el documento a Hacienda nuevamente con los datos originales.</p>
                        <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase text-slate-400">
                            <span>{retransmitForm.nombre}</span>
                            {retransmitForm.nit && <span>• NIT: {retransmitForm.nit}</span>}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6">
                        <button 
                            type="button"
                            onClick={() => setIsRetransmitModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                            disabled={retransmitLoading}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="px-8 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                            disabled={retransmitLoading}
                        >
                            {retransmitLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <RefreshCcw size={16} />
                            )}
                            Reintentar Transmisión
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default SalesHistory;
