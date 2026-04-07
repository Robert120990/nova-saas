import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, Calendar, DollarSign, FileText, ChevronRight, ChevronLeft, Eye, Check, X, Building2, User, History, FilterX, Clock, Printer, Mail, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuth } from '../context/AuthContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        // Use UTC to avoid timezone shift for date-only strings
        const d = date.getUTCDate().toString().padStart(2, '0');
        const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
        const y = date.getUTCFullYear();
        return `${d}/${m}/${y}`;
    } catch (e) { return String(dateStr); }
};

const metodoBadge = (m) => {
    const map = {
        Efectivo: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        Transferencia: 'bg-blue-50 text-blue-700 border-blue-100',
        Cheque: 'bg-violet-50 text-violet-700 border-violet-100',
        Tarjeta: 'bg-amber-50 text-amber-700 border-amber-100',
    };
    return map[m] || 'bg-slate-50 text-slate-600 border-slate-100';
};

// ── Sub-components (Modals) ──────────────────────────────────────────────────

const DetailsModal = ({ doc, onClose }) => {
    if (!doc) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">Detalles del Documento</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{doc.tipo} #{doc.documento || doc.id}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all text-slate-400 hover:text-slate-600 shadow-sm"><X size={20} /></button>
                </div>
                <div className="p-8 grid grid-cols-2 gap-8 text-sm">
                    <div className="space-y-6">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto Original</span>
                            <span className="text-lg font-black text-slate-800 italic underline tracking-tighter">${parseFloat(doc.total_original || 0).toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Saldo Pendiente</span>
                            <span className="text-lg font-black text-indigo-600 italic underline tracking-tighter">${parseFloat(doc.saldo_pendiente || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha Emisión</span>
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar size={14} className="text-indigo-400" /> {formatDate(doc.fecha)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ViewModal = ({ paymentId, onClose }) => {
    const { data: pay } = useQuery({
        queryKey: ['cxc-payment-detail', paymentId],
        queryFn: async () => (await axios.get(`/api/cxc/payments/${paymentId}`)).data,
        enabled: !!paymentId
    });

    if (!paymentId) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl z-10 overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none text-indigo-600">Comprobante de Abono</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">RECIBO #{paymentId}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400"><X size={20} /></button>
                </div>
                {pay ? (
                    <div className="p-8 space-y-8">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cliente</span>
                                    <span className="text-sm font-black text-slate-800 uppercase">{pay.cliente_nombre}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Monto Cobrado</span>
                                    <span className="text-3xl font-black text-slate-900 italic tracking-tighter">${parseFloat(pay.monto || 0).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="space-y-6 text-right">
                                <div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fecha de Cobro</span>
                                    <span className="text-sm font-bold text-slate-700 block">{formatDate(pay.fecha_pago, true)}</span>
                                </div>
                                <div className="mt-4">
                                    <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase border inline-block ${metodoBadge(pay.metodo_pago)}`}>{pay.metodo_pago}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : <div className="p-20 text-center text-slate-400 italic">Cargando recibo...</div>}
            </div>
        </div>
    );
};

// ── Main Component ───────────────────────────────────────────────────────────

const AddPayment = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    
    // UI State
    const [activeTab, setActiveTab] = useState('nuevo');
    const [selectedBranchId, setSelectedBranchId] = useState(user?.branch_id || '');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    
    // Data State
    const [docRows, setDocRows] = useState([]);
    const [detailsModal, setDetailsModal] = useState(null);
    const [viewPaymentId, setViewPaymentId] = useState(null);
    const [histPage, setHistPage] = useState(1);
    const [histSearch, setHistSearch] = useState('');
    
    const [formData, setFormData] = useState({
        fecha: new Date().toISOString().split('T')[0],
        metodo: 'Efectivo',
        comentario: '',
        user_id: user?.id
    });

    const totalAbonado = useMemo(() => {
        return docRows.reduce((acc, r) => acc + (parseFloat(r.abono || 0) || 0), 0);
    }, [docRows]);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data,
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers-all'],
        queryFn: async () => (await axios.get('/api/customers', { params: { limit: 1000 } })).data?.data || [],
    });

    const { data: statementData } = useQuery({
        queryKey: ['customer-summary-balance', selectedCustomerId, selectedBranchId],
        queryFn: async () => (await axios.get(`/api/cxc/statement`, { params: { customer_id: selectedCustomerId, branch_id: selectedBranchId, limit: 1 } })).data,
        enabled: !!selectedCustomerId && !!selectedBranchId
    });

    const { data: pendingDocs = [], isSuccess: loadSuccess } = useQuery({
        queryKey: ['pending-documents', selectedCustomerId, selectedBranchId],
        queryFn: async () => (await axios.get(`/api/cxc/pending-documents`, { params: { customer_id: selectedCustomerId, branch_id: selectedBranchId } })).data,
        enabled: !!selectedCustomerId && !!selectedBranchId
    });

    const { data: histData = { payments: [], pagination: { total: 0, pages: 1 } } } = useQuery({
        queryKey: ['payment-history', selectedCustomerId, selectedBranchId, histPage, histSearch],
        queryFn: async () => (await axios.get(`/api/cxc/payments`, {
            params: { customer_id: selectedCustomerId, branch_id: selectedBranchId, page: histPage, search: histSearch }
        })).data,
        enabled: activeTab === 'historial' && !!selectedCustomerId,
    });

    // Reset loop protection
    useEffect(() => {
        if (loadSuccess && Array.isArray(pendingDocs)) {
            const currentIds = docRows.map(r => r.sale_id || r.id).sort().join(',');
            const nextIds = pendingDocs.map(r => r.sale_id || r.id).sort().join(',');
            if (currentIds !== nextIds || docRows.length === 0) {
                 setDocRows(pendingDocs.map(d => ({ ...d, id: d.sale_id || d.id, abono: '', originalSaldo: d.saldo_pendiente })));
            }
        }
    }, [pendingDocs, loadSuccess]);

    useEffect(() => {
        setHistPage(1);
        setHistSearch('');
        setDocRows([]);
    }, [selectedCustomerId, selectedBranchId]);

    const paymentMutation = useMutation({
        mutationFn: async (data) => (await axios.post('/api/cxc/payments', data)).data,
        onSuccess: async () => {
            toast.success('Abono registrado correctamente');
            setDocRows(prev => prev.map(d => ({ ...d, abono: '' })));
            queryClient.invalidateQueries(['pending-documents']);
            queryClient.invalidateQueries(['payment-history']);
            queryClient.invalidateQueries(['customer-summary-balance']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al abonar')
    });

    const handleMontoManual = (val) => {
        let rem = val === '' ? 0 : parseFloat(val);
        setDocRows(prev => prev.map(d => {
            const s = parseFloat(d.originalSaldo || d.saldo_pendiente || 0);
            const p = Math.min(rem, s);
            rem = Math.max(0, rem - p);
            return { ...d, abono: p > 0 ? p.toFixed(2) : '' };
        }));
    };

    const handleAbonoChange = (idx, val) => {
        setDocRows(prev => {
            const next = [...prev];
            if (!next[idx]) return next;
            const s = parseFloat(next[idx].originalSaldo || next[idx].saldo_pendiente || 0);
            const p = val === '' ? 0 : parseFloat(val);
            next[idx] = { ...next[idx], abono: val === '' ? '' : Math.min(p, s).toFixed(2) };
            return next;
        });
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
        if (!window.confirm('¿Está seguro de eliminar este abono? Los saldos se restaurarán.')) return;
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
        const abs = docRows.filter(r => parseFloat(r.abono || 0) > 0).map(r => ({ sale_id: r.id, monto: r.abono }));
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
        <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase italic">Abonos de Clientes</h2>
                    <p className="text-slate-500 mt-1 font-medium text-xs uppercase tracking-widest">Distribución de saldos y gestión de CXC</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
                    <button 
                        onClick={() => setActiveTab('nuevo')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'nuevo' ? 'bg-white text-indigo-600 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plus size={14} />
                        Nuevo Abono
                    </button>
                    <button 
                        onClick={() => setActiveTab('historial')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={14} />
                        Historial
                    </button>
                </div>
            </div>

            {/* Selectors Bar (Compact) */}
            <div className="bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                <div className="md:col-span-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">SUCURSAL</label>
                    <select 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase h-[38px] cursor-pointer"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                        <option value="">-- SUCURSAL --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">CLIENTE</label>
                    <SearchableSelect 
                        placeholder="BUSCAR CLIENTE..."
                        options={customers}
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        valueKey="id"
                        labelKey="nombre"
                        codeKey="numero_documento"
                        displayKey="nombre"
                    />
                </div>

                {/* Resumen de Saldo */}
                <div className="md:col-span-2 flex flex-col justify-center">
                    {selectedCustomerId && selectedBranchId && statementData ? (
                        <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-xl shadow-indigo-100 flex items-center justify-between animate-in zoom-in-95 duration-300 italic h-[56px] mt-4 md:mt-2">
                           <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md shadow-inner">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-100 italic">Saldo Total</h3>
                                    <p className="text-xl font-black leading-tight tracking-tighter">${parseFloat(statementData.total_balance || 0).toFixed(2)}</p>
                                </div>
                           </div>
                           <div className="text-right hidden md:block border-l border-white/20 pl-4">
                                <span className="text-[9px] font-black opacity-60 uppercase block tracking-wider font-mono leading-none">Corte al</span>
                                <span className="text-[10px] font-black uppercase block tracking-widest">{new Date().toLocaleDateString('es-SV')}</span>
                           </div>
                        </div>
                    ) : (
                        <div className="h-[56px] mt-4 md:mt-2 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300 px-4 bg-slate-50/30">
                            <p className="text-[9px] font-black uppercase tracking-widest">Seleccione cliente para cargar saldos</p>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start animate-in slide-in-from-top-2 duration-300">
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm italic">
                                <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-5">Documento</th>
                                        <th className="px-6 py-5">Fecha</th>
                                        <th className="px-6 py-5 text-right whitespace-nowrap">Saldo Pend.</th>
                                        <th className="px-6 py-5 text-right pr-12">Abono</th>
                                        <th className="px-6 py-5 text-center">Info</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {docRows.map((d, i) => (
                                        <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-700 uppercase leading-none mb-1">{d.tipo}</span>
                                                    <span className="text-[10px] font-bold text-indigo-500 font-mono tracking-tighter">#{d.documento || d.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">{formatDate(d.fecha)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-xs font-black text-slate-900 tracking-tighter">${parseFloat(d.originalSaldo || 0).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right pr-10">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-[10px] font-bold text-slate-300">$</span>
                                                    <input type="number" step="0.01" value={d.abono} onChange={e => handleAbonoChange(i, e.target.value)} className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-right font-black text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button onClick={() => setDetailsModal(d)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors hover:text-indigo-600 shadow-sm border border-transparent hover:border-slate-100"><Eye size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {docRows.length === 0 && (
                                        <tr><td colSpan="5" className="px-6 py-24 text-center">
                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                <FilterX size={48} />
                                                <p className="text-xs font-black uppercase tracking-widest">Sin documentos pendientes</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-[2rem] p-6 shadow-xl text-white space-y-6 sticky top-6 border border-white/5 italic">
                            <div className="flex justify-between items-center text-[10px] opacity-40 uppercase font-black tracking-widest">
                                <span>DISTRIBUCIÓN TOTAL</span>
                                <span>${totalAbonado.toFixed(2)}</span>
                            </div>
                            <div className="text-4xl font-black text-center border-b border-white/10 pb-6 tracking-tighter decoration-indigo-500 underline underline-offset-8">${totalAbonado.toFixed(2)}</div>
                            
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-2 ml-1 tracking-widest flex items-center gap-2 italic"><Calendar size={12} className="text-indigo-400" /> Fecha de Abono</label>
                                    <input 
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[11px] font-bold outline-none focus:border-indigo-400 transition-all font-mono"
                                        value={formData.fecha}
                                        onChange={e => setFormData(f => ({ ...f, fecha: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-2 ml-1 tracking-widest flex items-center gap-2 italic"><DollarSign size={12} className="text-indigo-400" /> Distribuir Saldo</label>
                                    <input type="number" step="0.01" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xs font-black outline-none focus:border-indigo-400 transition-all" placeholder="0.00" onChange={e => handleMontoManual(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-2 ml-1 tracking-widest flex items-center gap-2 italic"><Check size={12} className="text-indigo-400" /> Método de Cobro</label>
                                    <select value={formData.metodo} onChange={e => setFormData(f => ({ ...f, metodo: e.target.value }))} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-[11px] font-black outline-none focus:border-indigo-400 transition-all uppercase cursor-pointer">
                                        <option value="Efectivo" className="bg-slate-900">Efectivo</option>
                                        <option value="Transferencia" className="bg-slate-900">Transferencia</option>
                                        <option value="Cheque" className="bg-slate-900">Cheque</option>
                                        <option value="Tarjeta" className="bg-slate-900">Tarjeta</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black opacity-40 uppercase block mb-2 ml-1 tracking-widest italic flex items-center gap-2"><FileText size={12} className="text-indigo-400" /> Notas / Referencia</label>
                                    <input type="text" className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-[10px] font-bold outline-none focus:border-indigo-400 transition-all uppercase placeholder:text-white/20" placeholder="DOC # O NOTAS..." value={formData.comentario} onChange={e => setFormData(f => ({ ...f, comentario: e.target.value }))} />
                                </div>
                            </div>

                            <button type="submit" disabled={paymentMutation.isPending || totalAbonado <= 0} className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50 shadow-2xl shadow-indigo-600/20 uppercase text-[11px] tracking-[0.2em]">
                                {paymentMutation.isPending ? 'PROCESANDO...' : 'GUARDAR RECIBO'}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="flex-1 relative italic">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input type="text" placeholder="FILTRAR MOVIMIENTOS POR NÚMERO O CLIENTE..." value={histSearch} onChange={e => setHistSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-none rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" />
                        </div>
                    </div>
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-[11px]">
                        <table className="w-full text-left italic">
                            <thead className="bg-slate-50/50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="px-6 py-5">Recibo</th>
                                    <th className="px-6 py-5">Fecha</th>
                                    <th className="px-6 py-5 whitespace-nowrap">Aplicado a</th>
                                    <th className="px-6 py-5 text-right">Monto</th>
                                    <th className="px-6 py-5 text-center">Método</th>
                                    <th className="px-6 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(histData.payments || []).map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 font-black text-indigo-600 font-mono text-xs tracking-tighter">REC-{String(p.id).padStart(5, '0')}</td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-400 font-mono">{formatDate(p.fecha_pago)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-700 uppercase leading-none mb-1">{p.documento_aplicado || 'COMPOSITE'}</span>
                                                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest truncate max-w-[120px]">{p.cliente_nombre}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900 italic tracking-tighter text-xs">${parseFloat(p.monto || 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 rounded-xl text-[8px] font-black uppercase border shadow-sm ${metodoBadge(p.metodo_pago)}`}>{p.metodo_pago}</span></td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => setViewPaymentId(p.id)} title="Ver Detalle" className="p-1.5 hover:bg-white text-slate-400 hover:text-indigo-600 rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100"><Eye size={14} /></button>
                                                <button onClick={() => handlePrintPDF(p.id)} title="Imprimir Recibo" className="p-1.5 hover:bg-white text-slate-400 hover:text-rose-600 rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100"><Printer size={14} /></button>
                                                <button onClick={() => handleSendEmail(p.id)} title="Enviar por Correo" className="p-1.5 hover:bg-white text-slate-400 hover:text-blue-600 rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100"><Mail size={14} /></button>
                                                <button onClick={() => handleDelete(p.id)} title="Eliminar Abono" className="p-1.5 hover:bg-white text-slate-400 hover:text-rose-600 rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-100"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!histData.payments || histData.payments.length === 0) && (
                                    <tr><td colSpan="6" className="px-8 py-32 text-center text-slate-300 italic uppercase font-black text-[10px] tracking-[0.3em] opacity-20">No se encontraron movimientos registrados</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {detailsModal && <DetailsModal doc={detailsModal} onClose={() => setDetailsModal(null)} />}
            {viewPaymentId && <ViewModal paymentId={viewPaymentId} onClose={() => setViewPaymentId(null)} />}
        </div>
    );
};

export default AddPayment;
