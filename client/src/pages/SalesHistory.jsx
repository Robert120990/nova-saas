import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { printTicket } from '../utils/qzPrint';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { 
    Search, FileText, Eye, Printer, Trash2, Calendar, User, Tag, 
    ShoppingCart, CreditCard, Banknote, MapPin, Mail, Phone, Calculator,
    Terminal, FileJson, Code, CheckCircle2, XCircle, AlertCircle, Info, Clock, Send, Ban, RefreshCcw,
    MoreHorizontal, ChevronDown, Building2
} from 'lucide-react';
import Money from '../components/ui/Money';

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
const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
const [regenerateSaleId, setRegenerateSaleId] = useState(null);
const [regenerateLoading, setRegenerateLoading] = useState(false);
const [updateDateTime, setUpdateDateTime] = useState(false);
    const [retransmitForm, setRetransmitForm] = useState({
        nombre: '',
        nit: '',
        nrc: '',
        email: ''
    });
    const [retransmitLoading, setRetransmitLoading] = useState(false);
    const [menuState, setMenuState] = useState(null);
    const [isEditDTEModalOpen, setIsEditDTEModalOpen] = useState(false);
    const [editableItems, setEditableItems] = useState([]);
    const [editDTESaving, setEditDTESaving] = useState(false);
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
            const { data } = await axios.post(`/api/sales/resend-email/${sale.id}`);
            if (data.success) {
                toast.success('Correo enviado correctamente');
            } else {
                toast.warning(data.message || 'El cliente no tiene un correo electrónico registrado');
            }
            queryClient.invalidateQueries(['sales-history']);
        } catch (error) {
            console.error('Error al reenviar correo:', error);
            const msg = error.response?.data?.message || 'Error al iniciar el reenvío de correo';
            toast.error(msg);
        }
    };

    const handleOpenVoidModal = (sale) => {
        const user = JSON.parse(localStorage.getItem('user')) || {};

        // Determinar tipo de documento del solicitante
        let solTipDoc = '36';
        let solNumDoc = '';
        if (sale.customer_nit) {
            solTipDoc = '36';
            solNumDoc = sale.customer_nit;
        } else if (sale.customer_dui) {
            solTipDoc = '13';
            solNumDoc = sale.customer_dui;
        } else {
            solTipDoc = '36';
            solNumDoc = sale.company_nit || '';
        }

        setVoidForm({
            ...voidForm,
            sale_id: sale.id,
            nombreResponsable: user.nombre || '',
            tipDocResponsable: '36',
            numDocResponsable: formatNIT(sale.company_nit || ''),
            nombreSolicita: sale.customer_name || 'CLIENTE',
            tipDocSolicita: solTipDoc,
            numDocSolicita: solTipDoc === '36' ? formatNIT(solNumDoc) : formatDUI(solNumDoc)
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

    const handleEditDTEItems = async (sale) => {
        try {
            const { data: detail } = await axios.get(`/api/sales/${sale.id}`);
            const itemsNoCodigo = (detail.items || []).filter(i => !i.product_id);
            setEditableItems(itemsNoCodigo.map(i => ({ sales_item_id: i.id, descripcion: i.descripcion, cantidad: i.cantidad })));
            setSelectedSaleId(sale.id);
            setIsEditDTEModalOpen(true);
        } catch (error) {
            toast.error('Error al cargar los items de la venta');
        }
    };

    const handleEditDTESave = async () => {
        setEditDTESaving(true);
        try {
            await axios.put(`/api/sales/${selectedSaleId}/edit-dte-items`, { items: editableItems });
            toast.success('Items actualizados correctamente. Reenviando correo al cliente...');
            setIsEditDTEModalOpen(false);
            queryClient.invalidateQueries(['sales-history']);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al actualizar items');
        } finally {
            setEditDTESaving(false);
        }
    };

    const handleEditDTEAddItem = () => {
        setEditableItems(prev => [...prev, { sales_item_id: null, descripcion: '', cantidad: 1 }]);
    };

    const handleEditDTEDeleteItem = (index) => {
        setEditableItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleEditDTEChange = (index, field, value) => {
        setEditableItems(prev => prev.map((item, i) =>
            i === index ? { ...item, [field]: field === 'cantidad' ? parseFloat(value) || 0 : value } : item
        ));
    };

    const handleRegenerateDTE = (sale) => {
        const today = new Date().toISOString().slice(0, 10);
        const origDate = sale.fecha_emision?.slice(0, 10);
        setUpdateDateTime(origDate !== today);
        setRegenerateSaleId(sale.id);
        setIsRegenerateModalOpen(true);
    };

    const handleRegenerateConfirm = async () => {
        setRegenerateLoading(true);
        try {
            const res = await axios.post(`/api/sales/${regenerateSaleId}/regenerate-dte`, { updateDateTime });
            toast.success(`DTE regenerado exitosamente — Ambiente: ${res.data.ambiente === 'produccion' ? 'Producción' : 'Pruebas'}`);
            setIsRegenerateModalOpen(false);
            queryClient.invalidateQueries(['sales-history']);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al regenerar DTE');
        } finally {
            setRegenerateLoading(false);
        }
    };

    const handlePrintTicket = async (sale) => {
        try {
            const { data: detail } = await axios.get(`/api/sales/${sale.id}`);
            const itemsHtml = (detail.items || []).map(item => {
                const precio = parseFloat(item.precio_unitario);
                const cantidad = parseFloat(item.cantidad);
                const descuento = parseFloat(item.monto_descuento || 0);
                const showPrice = precio !== 0 && (cantidad * precio - descuento) !== 0;
                return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <div style="flex: 1;">${item.descripcion || item.nombre}</div>
                </div>
                ${showPrice ? `
                <div style="text-align: right; font-size: 11px;">
                    ${cantidad} x $${precio.toFixed(2)}
                    ${descuento > 0 ? ` (-$${descuento.toFixed(2)})` : ''}
                    = $${(cantidad * precio - descuento).toFixed(2)}
                </div>` : ''}
            `}).join('');
            const { data: companies } = await axios.get('/api/companies');
            const company = Array.isArray(companies) ? companies.find(c => c.id == detail.company_id) : null;
            const fechaStr = detail.fecha_emision ? new Date(detail.fecha_emision).toLocaleDateString('es-SV') : '';
            const horaStr = detail.hora_emision || '';
            let branchAddr = '';
            if (detail.branch_id) {
                try {
                    const { data: branchesData } = await axios.get('/api/branches');
                    const branch = Array.isArray(branchesData) ? branchesData.find(b => b.id == detail.branch_id) : null;
                    if (branch?.direccion) branchAddr = branch.direccion;
                } catch (e) {}
            }

            const origin = window.location.origin;
            const qrUrl = (sale.dte_control || sale.codigo_generacion)
                ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(origin + '/api/public/dte/' + (sale.codigo_generacion || sale.dte_control) + '/pdf')}`
                : '';

            const html = `
                <html>
                    <head>
                        <title>Ticket de Venta</title>
                        <style>
                            @page { margin: 0; }
                            body { width: 72mm; font-family: 'Courier New', monospace; font-size: 10px; margin: 0; padding: 5px 4px; }
                            .center { text-align: center; }
                            .bold { font-weight: bold; }
                            .dashed { border-top: 1px dashed #000; margin: 4px 0; }
                            .flex-between { display: flex; justify-content: space-between; }
                        </style>
                    </head>
                    <body>
                        <div class="center bold" style="font-size: 14px;">${company?.razon_social || detail.branch_name || 'EMPRESA'}</div>
                        ${detail.branch_name ? `<div class="center" style="font-size: 10px;">${detail.branch_name}</div>` : ''}
                        ${branchAddr ? `<div class="center" style="font-size: 8px;">${branchAddr}</div>` : ''}
                        <div class="center" style="font-size: 9px;">NIT: ${company?.nit || ''} | NRC: ${company?.nrc || ''}</div>
                        <div class="dashed"></div>
                        <div class="flex-between"><span>TIPO DTE:</span><span>${detail.tipo_documento_name || 'FACTURA'}</span></div>
                        <div class="flex-between"><span>N° CONTROL:</span><span>${detail.numero_control || '---'}</span></div>
                        <div class="flex-between"><span>CÓDIGO GENERACIÓN:</span><span style="font-size: 7px;">${detail.codigo_generacion || '---'}</span></div>
                        ${detail.sello_recepcion ? `<div class="flex-between"><span>SELLO:</span><span style="font-size: 7px;">${detail.sello_recepcion}</span></div>` : ''}
                        <div class="flex-between"><span>FECHA:</span><span>${fechaStr}</span></div>
                        <div class="flex-between"><span>HORA:</span><span>${horaStr}</span></div>
                        <div class="dashed"></div>
                        <div><span class="bold">CLIENTE:</span> ${detail.customer_name || 'CONSUMIDOR FINAL'}</div>
                        ${detail.customer_nit ? `<div><span class="bold">NIT:</span> ${detail.customer_nit}</div>` : ''}
                        ${detail.customer_nrc ? `<div><span class="bold">NRC:</span> ${detail.customer_nrc}</div>` : ''}
                        <div class="dashed"></div>
                        <div class="flex-between bold">
                            <div style="width: 50%;">DESCRIPCION</div>
                            <div>CANT.</div>
                            <div>PRECIO</div>
                            <div>SUBTOTAL</div>
                        </div>
                        <div class="dashed"></div>
                        ${itemsHtml}
                        <div class="dashed"></div>
                        <div class="flex-between"><div>TOTAL GRAVADAS</div><div>$${parseFloat(detail.total_gravado || 0).toFixed(2)}</div></div>
                        <div class="flex-between"><div>TOTAL IVA</div><div>$${parseFloat(detail.total_iva || 0).toFixed(2)}</div></div>
                        ${parseFloat(detail.total_exento || 0) > 0 ? `<div class="flex-between"><div>TOTAL EXENTAS</div><div>$${parseFloat(detail.total_exento).toFixed(2)}</div></div>` : ''}
                        ${parseFloat(detail.total_no_sujeto || 0) > 0 ? `<div class="flex-between"><div>NO SUJETAS</div><div>$${parseFloat(detail.total_no_sujeto).toFixed(2)}</div></div>` : ''}
                        <div class="flex-between"><div>FOVIAL</div><div>$${parseFloat(detail.fovial || 0).toFixed(2)}</div></div>
                        <div class="flex-between"><div>COTRANS</div><div>$${parseFloat(detail.cotrans || 0).toFixed(2)}</div></div>
                        <div class="flex-between bold" style="font-size: 1.2em; margin-top: 5px;">
                            <div>TOTAL A PAGAR</div>
                            <div>$${parseFloat(detail.total_pagar || 0).toFixed(2)}</div>
                        </div>
                        <div class="dashed"></div>
                        <div class="center">ATENDIDO POR : ${detail.seller_name || 'SISTEMA'}</div>
                        <div class="center">GRACIAS POR SU COMPRA</div>
                        ${qrUrl ? `<div class="dashed"></div>
                        <div class="center" style="margin-top: 10px;">
                            <div style="margin-bottom: 5px;">DESCARGUE SU DTE</div>
                            <img src="${qrUrl}" style="width: 120px; height: 120px;"
                                 onload="setTimeout(() => { window.print(); window.close(); }, 200);"
                                 onerror="setTimeout(() => { window.print(); window.close(); }, 200);" />
                        </div>` : ''}
                        <div style="height: 30px;"></div>
                    </body>
                </html>
            `;

            const fullHtml = html;

            let qzSuccess = false;
            try {
                if (detail.pos_id) {
                    const { data: posList } = await axios.get('/api/pos');
                    const pos = Array.isArray(posList) ? posList.find(p => p.id == detail.pos_id) : null;
                    if (pos?.auto_print && pos?.printer_name) {
                        const qzResult = await printTicket(fullHtml, pos.printer_name);
                        qzSuccess = qzResult?.success;
                    }
                }
            } catch (e) {}

            if (!qzSuccess) {
                const pw = window.open('', '_blank', 'width=400,height=600');
                if (pw) {
                    pw.document.write(fullHtml);
                    pw.document.close();
                    pw.focus();
                } else {
                    toast.error('Permita ventanas emergentes para imprimir');
                }
            }
        } catch (error) {
            toast.error('Error al reimprimir ticket');
        }
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
            case 'anulado':
            case 'INVALIDADO':
                return <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg text-[9px] font-black uppercase tracking-wider"><Ban size={11} /> Anulado</span>;
            default:
                return <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider"><AlertCircle size={11} /> Pendiente</span>;
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
                            <td className="px-4 py-1">
                                <span className="text-[11px] font-bold text-slate-600 block leading-tight">
                                    {formatDateTime(sale.fh_procesamiento || `${sale.fecha_emision.substring(0, 10)}T${sale.hora_emision}`).split(' ')[0]}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium lowercase tracking-tighter">
                                    {formatDateTime(sale.fh_procesamiento || `${sale.fecha_emision.substring(0, 10)}T${sale.hora_emision}`).split(' ')[1]}
                                </span>
                            </td>
                            <td className="px-4 py-1">
                                <div className="flex flex-col leading-[1.1]">
                                    <span className="text-[9px] font-black text-slate-900 uppercase tracking-tighter">
                                        {sale.branch_name || 'Central'}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                        {sale.pos_name || 'Principal'}
                                    </span>
                                    <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter mt-0.5">
                                        {sale.seller_name || '---'}
                                    </span>
                                </div>
                            </td>
                             <td className="px-4 py-1">
                                 <div className="flex flex-col leading-[1.1]">
                                     <div className="flex items-center gap-1.5 mb-0.5">
                                         <span className="font-bold text-slate-900 text-[10px] truncate leading-none">{sale.tipo_documento_name}</span>
                                         {sale.codigo_generacion && (
                                             sale.dte_ambiente === '01' ? (
                                                 <span className="text-[7px] px-1 py-px bg-emerald-50 text-emerald-600 rounded font-black uppercase tracking-wider leading-none">Prod</span>
                                             ) : (
                                                 <span className="text-[7px] px-1 py-px bg-amber-50 text-amber-600 rounded font-black uppercase tracking-wider leading-none">Pruebas</span>
                                             )
                                         )}
                                     </div>
                                     <div className="flex flex-col">
                                         {sale.numero_control ? (
                                             <span className="text-[10.25px] font-mono font-bold text-indigo-500 opacity-80 truncate max-w-[300px]" title={`Control: ${sale.numero_control}`}>{sale.numero_control}</span>
                                         ) : null}
                                         {sale.codigo_generacion ? (
                                             <span className="text-[9.25px] font-mono text-emerald-600/80 truncate mt-0 max-w-[300px]" title={`Generación: ${sale.codigo_generacion}`}>{sale.codigo_generacion}</span>
                                         ) : null}
                                         {!sale.numero_control && !sale.codigo_generacion && (
                                             <span className="text-[8px] px-1 bg-slate-100 text-slate-400 rounded w-fit font-bold uppercase tracking-widest">Sin DTE</span>
                                         )}
                                     </div>
                                 </div>
                             </td>
                            <td className="px-4 py-1">
                                 <div className="flex flex-col leading-tight">
                                     <span className="font-bold text-slate-700 text-[9px] truncate max-w-[300px]" title={sale.customer_name}>{sale.customer_name || 'Consumidor Final'}</span>
                                    <span className={`text-[8px] px-1 rounded w-fit font-black uppercase tracking-widest ${
                                        sale.condicion_operacion == 1 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                        {sale.condicion_operacion == 1 ? 'Contado' : 'Crédito'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-1">
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
                            <td className="px-4 py-1 font-black text-slate-900 text-[12.5px]">
                                <Money value={sale.total_pagar} />
                            </td>
                            <td className="px-6 py-1 text-right">
                                <div className="flex justify-end">
                                    <button
                                        onClick={(e) => {
                                            if (menuState?.id === sale.id) {
                                                setMenuState(null);
                                            } else {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const menuH = 296;
                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                const dir = spaceBelow < menuH && rect.top > menuH ? 'up' : 'down';
                                                let top = dir === 'up' ? rect.top - 8 - menuH : rect.bottom + 8;
                                                top = Math.max(8, Math.min(top, window.innerHeight - menuH - 8));
                                                setMenuState({ id: sale.id, top, right: document.documentElement.clientWidth - rect.right, dir });
                                            }
                                        }}
                                        className={`p-2 rounded-xl transition-all flex items-center gap-1 border ${
                                            menuState?.id === sale.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 hover:text-slate-600 border-slate-100'
                                        }`}
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest pl-1">Acciones</span>
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${menuState?.id === sale.id ? 'rotate-180' : ''}`} />
                                    </button>

                                    {menuState?.id === sale.id && <div className="fixed inset-0 z-[100]" onClick={() => setMenuState(null)} />}
                                    {menuState?.id === sale.id && (
                                        <div className="fixed z-[101]" style={{ top: menuState.top, right: menuState.right }}>
                                                <div className={`bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto animate-in fade-in duration-200 ${menuState.dir === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'}`}>
                                                <div className="p-1.5 grid grid-cols-1 gap-0.5 w-52">
                                                    <button onClick={() => { handleViewSale(sale.id); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><Eye size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Ver Detalle</span>
                                                    </button>
                                                    
                                                    <button onClick={() => { handleViewRTEE(sale.id); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform"><FileText size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Representación (PDF)</span>
                                                    </button>

                                                    <button onClick={() => { handleViewJSON(sale.id); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg group-hover:scale-110 transition-transform"><Code size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Ver JSON DTE</span>
                                                    </button>

                                                    <button onClick={() => { handleViewResponse(sale.id); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform"><Terminal size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Respuesta MH</span>
                                                    </button>

                                                    {sale.dte_status === 'ACCEPTED' && (
                                                        <button onClick={() => { handleResendEmail(sale); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform"><Send size={14} /></div>
                                                            <span className="text-xs font-bold text-slate-600">Reenviar Correo</span>
                                                        </button>
                                                    )}

                                                    {sale.dte_status === 'ACCEPTED' && (
                                                        <button onClick={() => { handleEditDTEItems(sale); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                            <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg group-hover:scale-110 transition-transform"><FileText size={14} /></div>
                                                            <span className="text-xs font-bold text-slate-600">Editar Items</span>
                                                        </button>
                                                    )}

                                                    {(sale.dte_status === 'REJECTED' || sale.dte_status === 'RECHAZADO') && (
                                                        <button onClick={() => { handleOpenRetransmitModal(sale); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg group-hover:scale-110 transition-transform"><RefreshCcw size={14} /></div>
                                                            <span className="text-xs font-bold text-slate-600">Reintentar Envío</span>
                                                        </button>
                                                    )}

                                                    {sale.codigo_generacion && (
                                                        <button onClick={() => { handleRegenerateDTE(sale); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><RefreshCcw size={14} /></div>
                                                            <span className="text-xs font-bold text-slate-600">Regenerar DTE</span>
                                                        </button>
                                                    )}

                                                    <div className="h-px bg-slate-100 my-0.5 mx-1" />

                                                    <button 
                                                        onClick={() => { handleOpenVoidModal(sale); setMenuState(null); }} 
                                                        disabled={sale.estado === 'anulado' || !isVoidableDTE(sale)}
                                                        className={`flex items-center gap-2 w-full p-1.5 text-left rounded-xl transition-all group ${
                                                            sale.estado === 'anulado' || !isVoidableDTE(sale) ? 'opacity-30 cursor-not-allowed' : 'hover:bg-rose-50 text-rose-600'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg group-hover:scale-110 transition-transform ${
                                                            sale.estado === 'anulado' || !isVoidableDTE(sale) ? 'bg-slate-100 text-slate-400' : 'bg-rose-100 text-rose-600'
                                                        }`}><Ban size={14} /></div>
                                                        <span className="text-xs font-bold">Anular Operación</span>
                                                    </button>

                                                    <button onClick={() => { handlePrintTicket(sale); setMenuState(null); }} className="flex items-center gap-2 w-full p-1.5 text-left hover:bg-slate-50 rounded-xl transition-all group">
                                                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg group-hover:scale-110 transition-transform"><Printer size={14} /></div>
                                                        <span className="text-xs font-bold text-slate-600">Reimprimir Ticket</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
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
                                                <td className="py-3 px-2 text-right font-medium text-slate-600"><Money value={item.precio_unitario} /></td>
                                                <td className="py-3 px-2 text-right font-medium text-rose-500">-<Money value={item.monto_descuento || 0} /></td>
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
                                            <span className="font-black text-slate-900"><Money value={pay.monto} /></span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl space-y-4">
                                <div className="space-y-2 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>Gravada</span><span><Money value={saleDetail.total_gravado} /></span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>IVA</span><span><Money value={saleDetail.total_iva} /></span></div>
                                    {parseFloat(saleDetail.fovial) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>FOVIAL</span><span><Money value={saleDetail.fovial} /></span></div>}
                                    {parseFloat(saleDetail.cotrans) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>COTRANS</span><span><Money value={saleDetail.cotrans} /></span></div>}
                                    {parseFloat(saleDetail.total_exento) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>Exenta</span><span><Money value={saleDetail.total_exento} /></span></div>}
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300"><span>Retención</span><span>-<Money value={saleDetail.iva_retenido || 0} /></span></div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <span className="text-[10px] font-black uppercase text-indigo-400">Total Pagado</span>
                                    <span className="text-4xl font-black tracking-tighter"><Money value={saleDetail.total_pagar} /></span>
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

            {/* Modal de Regenerar DTE */}
            <Modal
                isOpen={isRegenerateModalOpen}
                onClose={() => setIsRegenerateModalOpen(false)}
                title="Regenerar DTE"
                maxWidth="max-w-lg"
            >
                <div className="space-y-6">
                    <div className="flex items-center gap-3 p-4 bg-indigo-50 text-indigo-800 rounded-3xl border border-indigo-100 text-xs">
                        <RefreshCcw size={20} className="shrink-0" />
                        <div>
                            <p className="font-black uppercase tracking-widest mb-1">Confirmar Regeneración</p>
                            <p className="font-medium text-Spanish">Se creará un nuevo DTE con nuevos códigos de Hacienda (codigoGeneracion y numeroControl). El DTE anterior quedará intacto.</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                            <p className="text-xs font-bold text-slate-700">Actualizar fecha y hora</p>
                            <p className="text-[10px] text-slate-400">
                                {updateDateTime
                                    ? 'Se usará la fecha y hora actual (hoy difiere del DTE original)'
                                    : 'Se preservará la fecha y hora original del DTE'}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={updateDateTime}
                                onChange={(e) => setUpdateDateTime(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6">
                        <button 
                            type="button"
                            onClick={() => setIsRegenerateModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                            disabled={regenerateLoading}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={handleRegenerateConfirm}
                            className="px-8 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                            disabled={regenerateLoading}
                        >
                            {regenerateLoading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <RefreshCcw size={16} />
                            )}
                            Confirmar
                        </button>
                    </div>
                </div>
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

            {/* Modal de Editar Items DTE */}
            <Modal
                isOpen={isEditDTEModalOpen}
                onClose={() => setIsEditDTEModalOpen(false)}
                title="Editar Items del DTE"
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-sky-50 text-sky-700 rounded-2xl border border-sky-100 text-[10px] font-black uppercase tracking-widest">
                        <Info size={16} />
                        Solo se muestran items sin código de producto. Los cambios solo afectan la descripción en el PDF y JSON del DTE.
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="py-2 px-2">Descripción</th>
                                <th className="py-2 px-2 w-20 text-center">Cant.</th>
                                <th className="py-2 px-2 w-16 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {editableItems.map((item, idx) => (
                                <tr key={idx} className="text-xs">
                                    <td className="py-1.5 px-2">
                                        <input
                                            type="text"
                                            value={item.descripcion}
                                            onChange={(e) => handleEditDTEChange(idx, 'descripcion', e.target.value)}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all text-[13px] font-medium"
                                        />
                                    </td>
                                    <td className="py-1.5 px-2">
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={item.cantidad}
                                            onChange={(e) => handleEditDTEChange(idx, 'cantidad', e.target.value)}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all text-[13px] font-medium text-center"
                                        />
                                    </td>
                                    <td className="py-1.5 px-2 text-center">
                                        <button
                                            onClick={() => handleEditDTEDeleteItem(idx)}
                                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button
                        onClick={handleEditDTEAddItem}
                        className="flex items-center gap-2 px-4 py-2 text-sky-600 font-black text-xs uppercase tracking-widest hover:bg-sky-50 rounded-2xl transition-all"
                    >
                        + Agregar Item
                    </button>
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={() => setIsEditDTEModalOpen(false)}
                            className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                            disabled={editDTESaving}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleEditDTESave}
                            className="px-8 py-2.5 bg-sky-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-sky-700 shadow-lg shadow-sky-200 transition-all flex items-center gap-2 disabled:opacity-50"
                            disabled={editDTESaving}
                        >
                            {editDTESaving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FileText size={16} />
                            )}
                            Guardar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SalesHistory;
