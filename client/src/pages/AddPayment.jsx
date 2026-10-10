import { useState, useEffect, useMemo } from 'react';
import { Plus, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import {
    CxcDocDetailsModal,
    CxcPaymentReceiptModal,
    CxcPendingDocumentsTable,
    CxcTotalsSidebar,
    CxcHistoryTab,
    CxcFiltersBar,
} from '../components/cxc';

const AddPayment = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    
    // UI State
    const [activeTab, setActiveTab] = useState('nuevo');
    const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || '');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    
    // Data State
    const [docRows, setDocRows] = useState([]);
    const [detailsModal, setDetailsModal] = useState(null);
    const [viewPaymentId, setViewPaymentId] = useState(null);
    const [histSearch, setHistSearch] = useState('');
    const [montoManual, setMontoManual] = useState('');
    
    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        metodo: 'Efectivo',
        comentario: '',
        user_id: user?.id
    });

    useDirtyTracker('pagos', docRows.some(r => parseFloat(r.abono || 0) > 0) || (parseFloat(montoManual || 0) > 0));

    const totalAbonado = useMemo(() => {
        const total = docRows.reduce((acc, r) => acc + (parseFloat(r.abono || 0) || 0), 0);
        return Math.round(total * 100) / 100;
    }, [docRows]);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data,
    });

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, es_credito: 1 }
        });
        return data;
    };

    const { data: statementData } = useQuery({
        queryKey: ['customer-summary-balance', selectedCustomerId, selectedBranchId],
        queryFn: async () => (await axios.get('/api/cxc/statement', { params: { customer_id: selectedCustomerId, branch_id: selectedBranchId, limit: 1 } })).data,
        enabled: Boolean(selectedCustomerId && selectedBranchId)
    });

    const { data: pendingDocs = [], isSuccess: loadSuccess } = useQuery({
        queryKey: ['pending-documents', selectedCustomerId, selectedBranchId],
        queryFn: async () => (await axios.get('/api/cxc/pending-documents', { params: { customer_id: selectedCustomerId, branch_id: selectedBranchId } })).data,
        enabled: Boolean(selectedCustomerId && selectedBranchId)
    });

    const { data: histData = { payments: [] } } = useQuery({
        queryKey: ['payment-history', selectedCustomerId, selectedBranchId, histSearch],
        queryFn: async () => (await axios.get('/api/cxc/payments', { params: { customer_id: selectedCustomerId, branch_id: selectedBranchId, limit: 100, search: histSearch } })).data,
        enabled: activeTab === 'historial' && Boolean(selectedCustomerId),
    });

    // Sincronización de documentos pendientes
    useEffect(() => {
        if (loadSuccess && Array.isArray(pendingDocs)) {
            const currentIds = docRows.map(r => r.sale_id ? `s_${r.sale_id}` : `g_${r.gas_credito_id || r.id}`).sort().join(',');
            const nextIds = pendingDocs.map(r => r.sale_id ? `s_${r.sale_id}` : `g_${r.gas_credito_id || r.id}`).sort().join(',');
            if (currentIds !== nextIds || docRows.length === 0) {
                setDocRows(pendingDocs.map(d => ({
                    ...d,
                    id: d.sale_id ? `s_${d.sale_id}` : `g_${d.gas_credito_id}`,
                    sale_id: d.sale_id || null,
                    gas_credito_id: d.gas_credito_id || null,
                    abono: '',
                    originalSaldo: d.saldo_pendiente
                })));
                setMontoManual('');
            }
        }
    }, [pendingDocs, loadSuccess]);

    useEffect(() => {
        setHistSearch('');
        setDocRows([]);
        setMontoManual('');
    }, [selectedCustomerId, selectedBranchId]);

    const paymentMutation = useMutation({
        mutationFn: async (data) => (await axios.post('/api/cxc/payments', data)).data,
        onSuccess: async () => {
            toast.success('Abono registrado correctamente');
            setDocRows(prev => prev.map(d => ({ ...d, abono: '' })));
            setMontoManual('');
            setFormData(prev => ({ ...prev, comentario: '' }));
            queryClient.invalidateQueries(['pending-documents']);
            queryClient.invalidateQueries(['payment-history']);
            queryClient.invalidateQueries(['customer-summary-balance']);
            setActiveTab('historial');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al abonar')
    });

    // Auto-distribución manual desde la barra lateral
    const handleMontoManualChange = (val) => {
        const cleanVal = String(val).replace(',', '.');
        if (!/^\d*\.?\d{0,2}$/.test(cleanVal)) return;

        setMontoManual(cleanVal);
        let rem = cleanVal === '' ? 0 : Math.round(parseFloat(cleanVal) * 100) / 100;

        setDocRows(prev => prev.map(d => {
            const s = Math.round(parseFloat(d.originalSaldo || d.saldo_pendiente || 0) * 100) / 100;
            const p = Math.round(Math.min(rem, s) * 100) / 100;
            rem = Math.round(Math.max(0, rem - p) * 100) / 100;
            return { ...d, abono: p > 0 ? p.toFixed(2) : '' };
        }));
    };

    // Edición manual de cada abono en la tabla (sin trabas al escribir decimales)
    const handleAbonoChange = (idx, val) => {
        const cleanVal = String(val).replace(',', '.');
        if (!/^\d*\.?\d{0,2}$/.test(cleanVal)) return;

        setDocRows(prev => {
            const next = [...prev];
            if (!next[idx]) return next;
            const s = Math.round(parseFloat(next[idx].originalSaldo || next[idx].saldo_pendiente || 0) * 100) / 100;
            
            if (cleanVal !== '' && parseFloat(cleanVal) > s) {
                next[idx] = { ...next[idx], abono: s.toFixed(2) };
            } else {
                next[idx] = { ...next[idx], abono: cleanVal };
            }
            return next;
        });
    };

    const handleAbonoBlur = (idx) => {
        setDocRows(prev => {
            const next = [...prev];
            if (!next[idx]) return next;
            const s = Math.round(parseFloat(next[idx].originalSaldo || next[idx].saldo_pendiente || 0) * 100) / 100;
            const num = parseFloat(next[idx].abono);
            if (!isNaN(num) && num > 0) {
                next[idx] = { ...next[idx], abono: Math.min(num, s).toFixed(2) };
            } else {
                next[idx] = { ...next[idx], abono: '' };
            }
            return next;
        });
    };

    // Abonar el 100% del saldo de una fila con un clic
    const handleFillAllSaldo = (idx, saldo) => {
        setDocRows(prev => {
            const next = [...prev];
            if (!next[idx]) return next;
            const currentAbono = parseFloat(next[idx].abono || 0);
            next[idx] = { ...next[idx], abono: currentAbono === saldo ? '' : saldo.toFixed(2) };
            return next;
        });
    };

    const handleClearAllAbonos = () => {
        setDocRows(prev => prev.map(d => ({ ...d, abono: '' })));
        setMontoManual('');
    };

    const handleFormDataChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handlePrintPDF = async (id) => {
        try {
            const res = await axios.get(`/api/cxc/payments/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Recibo_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF descargado');
        } catch (e) { toast.error('Error al descargar PDF'); }
    };

    const handleSendEmail = async (id) => {
        const promise = axios.post(`/api/cxc/payments/${id}/send-email`);
        toast.promise(promise, {
            loading: 'Enviando comprobante...',
            success: 'Comprobante enviado al cliente',
            error: 'Error al enviar correo'
        });
    };

    const handleDelete = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar abono?',
            message: 'Los saldos de los documentos afectados serán restaurados automáticamente.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await axios.delete(`/api/cxc/payments/${id}`);
            toast.success('Abono eliminado');
            queryClient.invalidateQueries(['payment-history']);
            queryClient.invalidateQueries(['pending-documents']);
            queryClient.invalidateQueries(['customer-summary-balance']);
        } catch (e) { toast.error('Error al eliminar abono'); }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedCustomerId) return toast.error('Seleccione un cliente');
        const abs = docRows
            .filter(r => parseFloat(r.abono || 0) > 0)
            .map(r => ({
                sale_id: r.sale_id || null,
                gas_credito_id: r.gas_credito_id || null,
                monto: parseFloat(r.abono).toFixed(2)
            }));
        if (abs.length === 0) return toast.error('Ingrese un monto mayor a 0');
        paymentMutation.mutate({ 
            customer_id: selectedCustomerId, 
            branch_id: selectedBranchId, 
            fecha_pago: formData.fecha,
            metodo_pago: formData.metodo,
            notas: formData.comentario,
            documentos: abs 
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4 pb-16 animate-in fade-in duration-300">
            {/* Cabecera Principal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                        Abonos de Clientes
                    </h2>
                    <p className="text-slate-500 text-xs uppercase tracking-wider mt-0.5">
                        Distribución de saldos y gestión de CXC
                    </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner w-fit">
                    <button 
                        onClick={() => setActiveTab('nuevo')}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'nuevo' 
                                ? 'bg-white text-indigo-600 shadow-xs' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Plus size={14} />
                        Nuevo Abono
                    </button>
                    <button 
                        onClick={() => setActiveTab('historial')}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'historial' 
                                ? 'bg-white text-indigo-600 shadow-xs' 
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <History size={14} />
                        Historial
                    </button>
                </div>
            </div>

            {/* Barra de Filtros y Saldo */}
            <CxcFiltersBar 
                branches={branches}
                selectedBranchId={selectedBranchId}
                onBranchChange={setSelectedBranchId}
                selectedCustomerId={selectedCustomerId}
                onCustomerChange={setSelectedCustomerId}
                loadCustomersOptions={loadCustomersOptions}
                totalBalance={statementData?.total_balance ?? 0}
            />

            {/* Contenido Principal */}
            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                    <div className="lg:col-span-3">
                        <CxcPendingDocumentsTable 
                            docRows={docRows}
                            onAbonoChange={handleAbonoChange}
                            onAbonoBlur={handleAbonoBlur}
                            onFillAllSaldo={handleFillAllSaldo}
                            onClearAllAbonos={handleClearAllAbonos}
                            onViewDetails={setDetailsModal}
                        />
                    </div>

                    <div className="lg:col-span-1">
                        <CxcTotalsSidebar 
                            totalAbonado={totalAbonado}
                            montoManual={montoManual}
                            onMontoManualChange={handleMontoManualChange}
                            formData={formData}
                            onFormDataChange={handleFormDataChange}
                            onSubmit={handleSubmit}
                            isSubmitting={paymentMutation.isPending}
                        />
                    </div>
                </div>
            ) : (
                <CxcHistoryTab 
                    histData={histData}
                    histSearch={histSearch}
                    onHistSearchChange={setHistSearch}
                    onViewPayment={setViewPaymentId}
                    onPrintPDF={handlePrintPDF}
                    onSendEmail={handleSendEmail}
                    onDeletePayment={handleDelete}
                />
            )}

            {/* Modales Desacoplados */}
            <CxcDocDetailsModal doc={detailsModal} onClose={() => setDetailsModal(null)} />
            <CxcPaymentReceiptModal paymentId={viewPaymentId} onClose={() => setViewPaymentId(null)} />
        </div>
    );
};

export default AddPayment;
