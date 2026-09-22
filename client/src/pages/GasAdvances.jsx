import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { 
    Plus, 
    Edit, 
    Trash2, 
    Search, 
    FileText, 
    Banknote, 
    CreditCard, 
    CheckSquare, 
    Landmark,
    Printer,
    Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import Money from '../components/ui/Money';
import { formatDateDMY, getTodayString } from '../utils/dateUtils';
import PdfViewerModal from '../components/ui/PdfViewerModal';

const GasAdvances = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedClienteId, setSelectedClienteId] = useState('');
    const [selectedClienteNombre, setSelectedClienteNombre] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Estado del visor de recibo PDF y envío de correo
    const [receiptModal, setReceiptModal] = useState({
        isOpen: false,
        pdfUrl: null,
        isLoading: false,
        error: null,
        title: 'Recibo de Anticipo',
        subtitle: '',
        fileName: 'Recibo_Anticipo.pdf',
        advance: null
    });
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Estado del formulario y desglose de pago
    const [fecha, setFecha] = useState(getTodayString());
    const [notas, setNotas] = useState('');
    const [breakdown, setBreakdown] = useState({
        efectivo: 0,
        tarjeta: 0,
        tarjeta_referencia: '',
        cheque: 0,
        cheque_referencia: '',
        transferencia: 0,
        transferencia_referencia: ''
    });

    const totalMonto = Math.round((
        (parseFloat(breakdown.efectivo) || 0) +
        (parseFloat(breakdown.tarjeta) || 0) +
        (parseFloat(breakdown.cheque) || 0) +
        (parseFloat(breakdown.transferencia) || 0)
    ) * 100) / 100;

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, es_anticipado: 1 }
        });
        return data;
    };

    const { data: advancesData, isLoading } = useQuery({
        queryKey: ['gas-advances', searchTerm],
        queryFn: async () => {
            const params = { page: 1, limit: 1000 };
            if (searchTerm) params.search = searchTerm;
            return (await axios.get('/api/gas-station/advances', { params })).data;
        }
    });

    const advances = advancesData?.data || [];

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedItem) return axios.put(`/api/gas-station/advances/${selectedItem.id}`, data);
            return axios.post('/api/gas-station/advances', data);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries(['gas-advances']);
            setIsModalOpen(false);
            const isCreate = !selectedItem;
            setSelectedItem(null);
            toast.success(isCreate ? 'Anticipo creado correctamente' : 'Anticipo actualizado correctamente');
            if (isCreate && res?.data?.id) {
                handlePrintReceipt(res.data);
            }
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al procesar anticipo')
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/advances/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['gas-advances']);
            toast.success('Anticipo eliminado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar anticipo?',
            message: 'Solo se puede eliminar si no tiene consumo registrado en cierres de gasolinera.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handlePrintReceipt = async (item) => {
        if (!item?.id) return;
        const clientName = item.cliente_nombre || item.customer_nombre || 'Cliente';
        const numero = item.numero || item.id;
        const fileName = `Recibo_Anticipo_${numero}.pdf`;

        if (receiptModal.pdfUrl) {
            window.URL.revokeObjectURL(receiptModal.pdfUrl);
        }

        setReceiptModal({
            isOpen: true,
            pdfUrl: null,
            isLoading: true,
            error: null,
            title: `Recibo de Pago Anticipado #${numero}`,
            subtitle: `Cliente: ${clientName}`,
            fileName,
            advance: item
        });

        try {
            const res = await axios.get(`/api/gas-station/advances/${item.id}/receipt/pdf`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            setReceiptModal(prev => ({
                ...prev,
                pdfUrl: url,
                isLoading: false
            }));
        } catch (err) {
            console.error('Error cargando recibo:', err);
            setReceiptModal(prev => ({
                ...prev,
                isLoading: false,
                error: 'Error al generar el recibo en PDF'
            }));
            toast.error('Error al generar el recibo en PDF');
        }
    };

    const handleCloseReceiptModal = () => {
        if (receiptModal.pdfUrl) {
            window.URL.revokeObjectURL(receiptModal.pdfUrl);
        }
        setReceiptModal(prev => ({ ...prev, isOpen: false, pdfUrl: null, advance: null }));
    };

    const handleSendEmail = async (item) => {
        const advanceId = item?.id;
        if (!advanceId) return;
        setIsSendingEmail(true);
        const clientName = item.cliente_nombre || item.customer_nombre || 'Cliente';
        const promise = axios.post(`/api/gas-station/advances/${advanceId}/send-email`);
        toast.promise(promise, {
            loading: `Enviando recibo por correo a ${clientName}...`,
            success: () => {
                setIsSendingEmail(false);
                return 'Recibo de pago enviado exitosamente por correo';
            },
            error: (err) => {
                setIsSendingEmail(false);
                return err.response?.data?.message || 'Error al enviar el recibo por correo';
            }
        });
    };

    const handleOpenCreate = () => {
        setSelectedItem(null);
        setSelectedClienteId('');
        setSelectedClienteNombre('');
        setFecha(getTodayString());
        setNotas('');
        setBreakdown({
            efectivo: 0,
            tarjeta: 0,
            tarjeta_referencia: '',
            cheque: 0,
            cheque_referencia: '',
            transferencia: 0,
            transferencia_referencia: ''
        });
        setIsModalOpen(true);
    };

    const handleEdit = (item) => {
        setSelectedItem(item);
        setSelectedClienteId(item?.cliente_id?.toString() || '');
        setSelectedClienteNombre(item?.cliente_nombre || item?.customer_nombre || '');
        setFecha(item?.fecha ? item.fecha.split('T')[0].split(' ')[0] : getTodayString());
        setNotas(item?.notas || '');
        setBreakdown({
            efectivo: item.efectivo !== undefined && item.efectivo !== null ? item.efectivo : item.monto,
            tarjeta: item.tarjeta || 0,
            tarjeta_referencia: item.tarjeta_referencia || '',
            cheque: item.cheque || 0,
            cheque_referencia: item.cheque_referencia || '',
            transferencia: item.transferencia || 0,
            transferencia_referencia: item.transferencia_referencia || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cliente_id = parseInt(selectedClienteId) || 0;
        const cliente_nombre = selectedClienteNombre || '';

        if (!cliente_id) {
            toast.error('Debe seleccionar un cliente');
            return;
        }

        if (totalMonto <= 0) {
            toast.error('El monto total debe ser mayor a cero. Ingrese al menos una forma de pago.');
            return;
        }

        // Validación de referencias
        if (parseFloat(breakdown.tarjeta) > 0 && !breakdown.tarjeta_referencia?.trim()) {
            toast.error('Ingrese el número de referencia de la tarjeta');
            return;
        }
        if (parseFloat(breakdown.cheque) > 0 && !breakdown.cheque_referencia?.trim()) {
            toast.error('Ingrese el número de cheque');
            return;
        }
        if (parseFloat(breakdown.transferencia) > 0 && !breakdown.transferencia_referencia?.trim()) {
            toast.error('Ingrese el número de comprobante o referencia de transferencia');
            return;
        }

        const payload = {
            cliente_id,
            cliente_nombre,
            fecha,
            notas,
            efectivo: parseFloat(breakdown.efectivo) || 0,
            tarjeta: parseFloat(breakdown.tarjeta) || 0,
            tarjeta_referencia: breakdown.tarjeta_referencia?.trim() || null,
            cheque: parseFloat(breakdown.cheque) || 0,
            cheque_referencia: breakdown.cheque_referencia?.trim() || null,
            transferencia: parseFloat(breakdown.transferencia) || 0,
            transferencia_referencia: breakdown.transferencia_referencia?.trim() || null
        };

        mutation.mutate(payload);
    };

    const handleBreakdownChange = (field, val) => {
        setBreakdown(prev => ({ ...prev, [field]: val }));
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium";
    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

    return (
        <div className="space-y-3.5 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Anticipos de Clientes</h2>
                    <p className="text-slate-500 text-xs font-medium">Gasolinera — Gestión de pagos anticipados y saldos</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/gas-station/reporte-anticipos')}
                        className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                        title="Ver Reporte Consolidado de Pagos Anticipados"
                    >
                        <FileText size={16} className="text-indigo-600" />
                        <span>Ver Reporte</span>
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                    >
                        <Plus size={16}/>
                        <span>Nuevo Anticipo</span>
                    </button>
                </div>
            </div>

            {/* Buscador */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                    type="text"
                    placeholder="Buscar por número o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-xs"
                />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <Table
                    headers={['No.', 'Fecha', 'Sucursal', 'Cliente', 'NRC', 'Desglose Pago', 'Total', 'Disponible', 'Utilizado', 'Acciones']}
                    data={advances}
                    isLoading={isLoading}
                    renderRow={(item) => {
                        const mo = parseFloat(item.monto) || 0;
                        const di = parseFloat(item.monto_disponible) || 0;
                        const usado = mo - di;

                        const ef = parseFloat(item.efectivo) || 0;
                        const tj = parseFloat(item.tarjeta) || 0;
                        const ch = parseFloat(item.cheque) || 0;
                        const tr = parseFloat(item.transferencia) || 0;

                        return (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0 text-xs">
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="font-mono font-black text-xs text-indigo-600">{item.numero}</span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="font-bold text-xs text-slate-600">{formatDateDMY(item.fecha)}</span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="font-medium text-xs text-slate-500 truncate max-w-[120px] block">{item.branch_name || '—'}</span>
                                </td>
                                <td className="px-3 py-2">
                                    <span className="font-bold text-xs text-slate-900 block truncate max-w-[200px]">{item.cliente_nombre || item.customer_nombre || '—'}</span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="font-mono text-xs text-slate-400">{item.nrc || '---'}</span>
                                </td>
                                <td className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-1 max-w-[240px]">
                                        {ef > 0 && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold" title="Efectivo">
                                                <Banknote size={10} /> <Money value={ef} />
                                            </span>
                                        )}
                                        {tj > 0 && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-bold" title={`Tarjeta ref: ${item.tarjeta_referencia || 'N/A'}`}>
                                                <CreditCard size={10} /> <Money value={tj} />
                                                {item.tarjeta_referencia && <span className="opacity-70 text-[9px] font-mono font-normal">#{item.tarjeta_referencia}</span>}
                                            </span>
                                        )}
                                        {ch > 0 && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-bold" title={`Cheque no: ${item.cheque_referencia || 'N/A'}`}>
                                                <CheckSquare size={10} /> <Money value={ch} />
                                                {item.cheque_referencia && <span className="opacity-70 text-[9px] font-mono font-normal">#{item.cheque_referencia}</span>}
                                            </span>
                                        )}
                                        {tr > 0 && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-bold" title={`Transferencia ref: ${item.transferencia_referencia || 'N/A'}`}>
                                                <Landmark size={10} /> <Money value={tr} />
                                                {item.transferencia_referencia && <span className="opacity-70 text-[9px] font-mono font-normal">#{item.transferencia_referencia}</span>}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                    <span className="font-mono font-black text-xs text-slate-900"><Money value={item.monto} /></span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                    <span className={`font-mono font-black text-xs ${di > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        <Money value={di} />
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                    <span className={`font-mono font-bold text-xs ${usado > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                        <Money value={usado} />
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button 
                                            onClick={() => handlePrintReceipt(item)} 
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                            title="Imprimir / Ver Recibo de Anticipo"
                                        >
                                            <Printer size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleSendEmail(item)} 
                                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                            title="Enviar Recibo por Correo"
                                        >
                                            <Mail size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleEdit(item)} 
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                            title="Editar anticipo"
                                        >
                                            <Edit size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(item.id)} 
                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Eliminar anticipo"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>

            {/* Modal de Creación / Edición */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedItem ? `Editar Anticipo #${selectedItem.numero}` : 'Nuevo Anticipo de Cliente'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className={labelCls}>Cliente Anticipado <span className="text-rose-500">*</span></label>
                            <SearchableSelect
                                loadOptions={loadCustomersOptions}
                                value={selectedClienteId}
                                onChange={(e, opt) => {
                                    setSelectedClienteId(e.target.value);
                                    setSelectedClienteNombre(opt?.nombre || '');
                                }}
                                placeholder="Buscar cliente por nombre o NRC..."
                                valueKey="id"
                                labelKey="nombre"
                                displayKey="nombre"
                                codeKey="nrc"
                                codeLabel="NRC"
                                selectedLabel={selectedClienteNombre}
                                dropdownWidth={420}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Fecha del Anticipo</label>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className={fieldCls}
                                required
                            />
                        </div>
                    </div>

                    {/* Tarjeta de Monto Total Calculado (Compacta) */}
                    <div className="px-3.5 py-2 rounded-xl bg-slate-900 text-white shadow-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Monto Total (Sumatoria):
                            </span>
                            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                                <Money value={totalMonto} />
                            </span>
                        </div>
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            Solo lectura
                        </span>
                    </div>

                    {/* Desglose de Métodos de Pago Compacto */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <div className="grid grid-cols-12 bg-slate-100/90 px-3 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                            <div className="col-span-4 sm:col-span-3">Forma de Pago</div>
                            <div className="col-span-4 sm:col-span-4 text-right pr-2">Monto ($)</div>
                            <div className="col-span-4 sm:col-span-5">No. Referencia</div>
                        </div>
                        <div className="divide-y divide-slate-100 bg-white">
                            {/* 1. Efectivo */}
                            <div className="grid grid-cols-12 items-center px-3 py-1.5 gap-2 hover:bg-slate-50/50">
                                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <Banknote size={14} className="text-emerald-600 shrink-0" />
                                    <span>Efectivo</span>
                                </div>
                                <div className="col-span-4 sm:col-span-4">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={breakdown.efectivo === 0 ? '' : breakdown.efectivo}
                                        onChange={(e) => handleBreakdownChange('efectivo', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-5 text-[11px] text-slate-400 italic px-1">
                                    No requiere
                                </div>
                            </div>

                            {/* 2. Tarjeta */}
                            <div className="grid grid-cols-12 items-center px-3 py-1.5 gap-2 hover:bg-slate-50/50">
                                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <CreditCard size={14} className="text-blue-600 shrink-0" />
                                    <span>Tarjeta</span>
                                </div>
                                <div className="col-span-4 sm:col-span-4">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={breakdown.tarjeta === 0 ? '' : breakdown.tarjeta}
                                        onChange={(e) => handleBreakdownChange('tarjeta', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-5">
                                    <input
                                        type="text"
                                        value={breakdown.tarjeta_referencia}
                                        onChange={(e) => handleBreakdownChange('tarjeta_referencia', e.target.value)}
                                        placeholder={parseFloat(breakdown.tarjeta) > 0 ? "Ej: AUT-92819 *" : "No. Autorización"}
                                        className={`w-full px-2.5 py-1 bg-slate-50 border rounded-lg font-mono text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all ${
                                            parseFloat(breakdown.tarjeta) > 0 && !breakdown.tarjeta_referencia?.trim() ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* 3. Cheque */}
                            <div className="grid grid-cols-12 items-center px-3 py-1.5 gap-2 hover:bg-slate-50/50">
                                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <CheckSquare size={14} className="text-amber-600 shrink-0" />
                                    <span>Cheque</span>
                                </div>
                                <div className="col-span-4 sm:col-span-4">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={breakdown.cheque === 0 ? '' : breakdown.cheque}
                                        onChange={(e) => handleBreakdownChange('cheque', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-5">
                                    <input
                                        type="text"
                                        value={breakdown.cheque_referencia}
                                        onChange={(e) => handleBreakdownChange('cheque_referencia', e.target.value)}
                                        placeholder={parseFloat(breakdown.cheque) > 0 ? "Ej: CHQ-00192 *" : "No. Cheque"}
                                        className={`w-full px-2.5 py-1 bg-slate-50 border rounded-lg font-mono text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all ${
                                            parseFloat(breakdown.cheque) > 0 && !breakdown.cheque_referencia?.trim() ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* 4. Transferencia */}
                            <div className="grid grid-cols-12 items-center px-3 py-1.5 gap-2 hover:bg-slate-50/50">
                                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                    <Landmark size={14} className="text-purple-600 shrink-0" />
                                    <span>Transferencia</span>
                                </div>
                                <div className="col-span-4 sm:col-span-4">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={breakdown.transferencia === 0 ? '' : breakdown.transferencia}
                                        onChange={(e) => handleBreakdownChange('transferencia', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-5">
                                    <input
                                        type="text"
                                        value={breakdown.transferencia_referencia}
                                        onChange={(e) => handleBreakdownChange('transferencia_referencia', e.target.value)}
                                        placeholder={parseFloat(breakdown.transferencia) > 0 ? "Ej: TRF-881923 *" : "No. Comprobante"}
                                        className={`w-full px-2.5 py-1 bg-slate-50 border rounded-lg font-mono text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all ${
                                            parseFloat(breakdown.transferencia) > 0 && !breakdown.transferencia_referencia?.trim() ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'
                                        }`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notas */}
                    <div>
                        <label className={labelCls}>Notas u Observaciones (Opcional)</label>
                        <input
                            type="text"
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Detalles adicionales del anticipo recibido..."
                            className={fieldCls}
                        />
                    </div>

                    {/* Acciones */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)} 
                            className="px-4 py-2 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs rounded-xl cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={mutation.isPending} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                            {mutation.isPending ? 'Guardando...' : (selectedItem ? 'Guardar Cambios' : 'Registrar Anticipo')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Visualización e Impresión de Recibo PDF */}
            <PdfViewerModal
                isOpen={receiptModal.isOpen}
                onClose={handleCloseReceiptModal}
                title={receiptModal.title}
                subtitle={receiptModal.subtitle}
                badge="Comprobante Oficial"
                pdfUrl={receiptModal.pdfUrl}
                isLoading={receiptModal.isLoading}
                loadingText="Generando recibo oficial de pago anticipado..."
                error={receiptModal.error}
                onRetry={() => receiptModal.advance && handlePrintReceipt(receiptModal.advance)}
                fileName={receiptModal.fileName}
                footerNote="Comprobante oficial de pago anticipado • Estación de Servicio"
                onSendEmail={receiptModal.advance ? () => handleSendEmail(receiptModal.advance) : null}
                isSendingEmail={isSendingEmail}
                sendEmailLabel="Enviar por Correo"
            />
        </div>
    );
};

export default GasAdvances;
