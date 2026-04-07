import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Plus, 
    Trash2, 
    Save, 
    History, 
    Search, 
    X,
    Check,
    Eye,
    XCircle,
    FileSpreadsheet,
    Banknote,
    Calculator,
    Calendar,
    AlertCircle,
    FileText as FilePdf,
    Edit,
    ArrowLeft,
    RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';

// Helper for date formatting DD/MM/YYYY
const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    try {
        const datePart = dateStr.split('T')[0];
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateStr;
    }
};

const Expenses = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('nuevo');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Header State
    const [branchId, setBranchId] = useState('');
    const [providerId, setProviderId] = useState('');
    const [tipoDocId, setTipoDocId] = useState('03'); // Default CCF
    const [condicionId, setCondicionId] = useState('01'); // Default Contado
    const [numeroDoc, setNumeroDoc] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');

    // Items State
    const [selectedItems, setSelectedItems] = useState([]);
    
    // Quick Add Item State
    const [quickDesc, setQuickDesc] = useState('');
    const [quickTypeId, setQuickTypeId] = useState('');
    const [quickAmount, setQuickAmount] = useState('0');
    const [quickTaxType, setQuickTaxType] = useState('gravada');

    // Refs for keyboard navigation
    const descRef = useRef(null);
    const typeRef = useRef(null);
    const amountRef = useRef(null);
    const taxTypeRef = useRef(null);

    // Summary/Totals State
    const [totals, setTotals] = useState({
        nosujeta: 0,
        exenta: 0,
        gravada: 0,
        iva: 0,
        retencion: 0,
        percepcion: 0,
        fovial: 0,
        cotrans: 0,
        total: 0
    });

    // Manual Overrides
    const [manualIVA, setManualIVA] = useState(0);
    const [manualRetencion, setManualRetencion] = useState(0);
    const [manualPercepcion, setManualPercepcion] = useState(0);
    const [manualFovial, setManualFovial] = useState(0);
    const [manualCotrans, setManualCotrans] = useState(0);

    // Dirty Flags
    const [isIvaDirty, setIsIvaDirty] = useState(false);
    const [isRetDirty, setIsRetDirty] = useState(false);
    const [isPercDirty, setIsPercDirty] = useState(false);
    const [isFovDirty, setIsFovDirty] = useState(false);
    const [isCotDirty, setIsCotDirty] = useState(false);

    // History State
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [viewingExpense, setViewingExpense] = useState(null);
    const limit = 10;

    // Queries
    const { data: currentCompany } = useQuery({
        queryKey: ['company', user?.company_id],
        queryFn: async () => (await axios.get(`/api/companies`)).data.find(c => c.id === user.company_id),
        enabled: !!user?.company_id
    });

    const { data: providers = [] } = useQuery({
        queryKey: ['providers-all', user?.company_id],
        queryFn: async () => (await axios.get('/api/providers', { params: { limit: 1000 } })).data?.data || []
    });

    const selectedProvider = useMemo(() => {
        return providers.find(p => p.id === parseInt(providerId));
    }, [providers, providerId]);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', user?.company_id],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: expenseTypes = [] } = useQuery({
        queryKey: ['expense-types', user?.company_id],
        queryFn: async () => (await axios.get('/api/expenses/types')).data
    });

    const { data: tipoDocs = [] } = useQuery({
        queryKey: ['catalog', '002'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_002_tipo_dte')).data
    });

    const { data: condiciones = [] } = useQuery({
        queryKey: ['catalog', '016'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_016_condicion_operacion')).data
    });

    const { data: expensesData, isLoading: loadingHistory } = useQuery({
        queryKey: ['expenses-history', historySearch, historyPage],
        queryFn: async () => (await axios.get('/api/expenses', { 
            params: { search: historySearch, page: historyPage, limit } 
        })).data,
        enabled: activeTab === 'historial'
    });

    const { data: expenseDetail, isLoading: loadingDetail } = useQuery({
        queryKey: ['expense-detail', viewingExpense?.id],
        queryFn: async () => (await axios.get(`/api/expenses/${viewingExpense.id}`)).data,
        enabled: !!viewingExpense?.id
    });

    const { data: activePeriod, isLoading: loadingPeriod } = useQuery({
        queryKey: ['active-period', user?.company_id],
        queryFn: async () => {
            const resp = await axios.get('/api/period-purchases');
            return resp.data;
        },
        retry: false
    });

    const { data: taxSettings } = useQuery({
        queryKey: ['tax-settings'],
        queryFn: async () => (await axios.get('/api/taxes')).data,
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/expenses', data),
        onSuccess: () => {
            toast.success('Gasto registrado correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al procesar')
    });
    
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => axios.put(`/api/expenses/${id}`, data),
        onSuccess: () => {
            toast.success('Gasto actualizado correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar')
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/expenses/${id}/void`),
        onSuccess: () => {
            toast.success('Gasto anulado correctamente');
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al anular')
    });

    // Tax Logic
    useEffect(() => {
        let gravada = 0;
        let exenta = 0;
        let nosujeta = 0;

        selectedItems.forEach(item => {
            const monto = parseFloat(item.total || 0);
            if (item.tax_type === 'gravada') gravada += monto;
            else if (item.tax_type === 'exenta') exenta += monto;
            else if (item.tax_type === 'nosujeta') nosujeta += monto;
        });

        const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
        const esFactura = tipoDocId === '01';
        let ivaCalculated = (selectedProvider?.exento_iva || esFactura) ? 0 : (gravada * ivaRate);
        ivaCalculated = Math.round(ivaCalculated * 100) / 100;

        let retencion = 0;
        const nosAgenteRetencion = currentCompany?.tipo_contribuyente === 'Gran Contribuyente';
        const proveedNoGC = !selectedProvider?.es_gran_contribuyente;
        const retencionRate = parseFloat(taxSettings?.retencion_rate || 1) / 100;
        
        if (nosAgenteRetencion && proveedNoGC && gravada >= 100 && tipoDocId === '03') {
            retencion = Math.round((gravada * retencionRate) * 100) / 100;
        }

        let percepcion = 0;
        const proveedAgentePerc = selectedProvider?.es_gran_contribuyente;
        const nosNoGC = currentCompany?.tipo_contribuyente !== 'Gran Contribuyente';
        const percepcionRate = parseFloat(taxSettings?.percepcion_rate || 1) / 100;

        if (proveedAgentePerc && nosNoGC && tipoDocId === '03') {
            percepcion = Math.round((gravada * percepcionRate) * 100) / 100;
        }

        if (!isIvaDirty) setManualIVA(ivaCalculated);
        if (!isRetDirty) setManualRetencion(retencion);
        if (!isPercDirty) setManualPercepcion(percepcion);

        setTotals({
            gravada,
            exenta,
            nosujeta,
            iva: isIvaDirty ? manualIVA : ivaCalculated,
            retencion: isRetDirty ? manualRetencion : retencion,
            percepcion: isPercDirty ? manualPercepcion : percepcion,
            fovial: manualFovial,
            cotrans: manualCotrans,
            total: gravada + exenta + nosujeta + 
                   parseFloat(isIvaDirty ? manualIVA : ivaCalculated) - 
                   parseFloat(isRetDirty ? manualRetencion : retencion) + 
                   parseFloat(isPercDirty ? manualPercepcion : percepcion) + 
                   parseFloat(manualFovial) + parseFloat(manualCotrans)
        });

    }, [selectedItems, tipoDocId, selectedProvider, currentCompany, isIvaDirty, isRetDirty, isPercDirty, manualIVA, manualRetencion, manualPercepcion, manualFovial, manualCotrans, taxSettings]);

    const handleAddQuick = () => {
        if (!quickDesc || !quickTypeId) return toast.error('Concepto y Tipo de Gasto son obligatorios');
        const amount = parseFloat(quickAmount);
        if (amount <= 0) return toast.error('Monto inválido');

        const typeName = expenseTypes.find(t => t.id === parseInt(quickTypeId))?.name || 'Gastos';

        setSelectedItems([...selectedItems, {
            id: Date.now(),
            description: quickDesc,
            expense_type_id: quickTypeId,
            expense_type_name: typeName,
            tax_type: quickTaxType,
            total: amount
        }]);

        setQuickDesc(''); setQuickAmount('0');
        descRef.current?.focus(); 
    };

    const handleKeyDown = (e, nextRef) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextRef === 'add') {
                handleAddQuick();
            } else {
                nextRef.current?.focus();
            }
        }
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.id !== id));
    };

    const resetForm = () => {
        setSelectedItems([]); setNumeroDoc(''); setObservaciones('');
        setProviderId(''); setBranchId('');
        setManualIVA(0); setManualRetencion(0); setManualPercepcion(0); setManualFovial(0); setManualCotrans(0);
        setIsIvaDirty(false); setIsRetDirty(false); setIsPercDirty(false); setIsFovDirty(false); setIsCotDirty(false);
        setIsEditing(false); setEditingId(null);
    };

    const handleSubmit = () => {
        if (!branchId || !providerId || !numeroDoc) return toast.error('Cabecera incompleta');
        if (selectedItems.length === 0) return toast.error('Agregue al menos un concepto');

        const payload = {
            branch_id: branchId, provider_id: providerId, fecha, numero_documento: numeroDoc,
            tipo_documento_id: tipoDocId, condicion_operacion_id: condicionId, observaciones,
            total_nosujeta: totals.nosujeta, total_exenta: totals.exenta, total_gravada: totals.gravada,
            iva: totals.iva, retencion: totals.retencion, percepcion: totals.percepcion, 
            fovial: totals.fovial, cotrans: totals.cotrans, monto_total: totals.total,
            period_year: activePeriod?.year, period_month: activePeriod?.month,
            items: selectedItems
        };

        if (isEditing && editingId) {
            updateMutation.mutate({ id: editingId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleEdit = async (expense) => {
        const loadToast = toast.loading('Cargando datos de gasto...');
        try {
            const { data: detail } = await axios.get(`/api/expenses/${expense.id}`);
            setEditingId(expense.id);
            setIsEditing(true);
            setBranchId(detail.branch_id);
            setProviderId(detail.provider_id);
            setTipoDocId(detail.tipo_documento_id);
            setCondicionId(detail.condicion_operacion_id);
            setNumeroDoc(detail.numero_documento);
            setFecha(new Date(detail.fecha).toISOString().split('T')[0]);
            setObservaciones(detail.observaciones || '');
            setManualIVA(parseFloat(detail.iva));
            setManualRetencion(parseFloat(detail.retencion));
            setManualPercepcion(parseFloat(detail.percepcion));
            setManualFovial(parseFloat(detail.fovial));
            setManualCotrans(parseFloat(detail.cotrans));
            setIsIvaDirty(true); setIsRetDirty(true); setIsPercDirty(true); setIsFovDirty(true); setIsCotDirty(true);
            setSelectedItems(detail.items.map(it => ({
                id: it.id,
                description: it.description,
                expense_type_id: it.expense_type_id,
                expense_type_name: expenseTypes.find(t => t.id === it.expense_type_id)?.name || 'Gasto',
                tax_type: it.tax_type,
                total: parseFloat(it.total)
            })));
            setActiveTab('nuevo');
            toast.dismiss(loadToast);
        } catch (error) {
            toast.error('Error al cargar detalle');
            toast.dismiss(loadToast);
        }
    };

    const handleExportExcel = () => {
        if (!expensesData?.data || expensesData.data.length === 0) return toast.error('No hay datos para exportar');
        const data = expensesData.data.map(e => ({
            ID: e.id,
            FECHA: formatDate(e.fecha),
            PROVEEDOR: e.provider_nombre,
            DOCUMENTO: e.tipo_documento_nombre,
            NUMERO: e.numero_documento,
            TOTAL: parseFloat(e.monto_total),
            ESTADO: e.status
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gastos");
        XLSX.writeFile(wb, "Historial_Gastos.xlsx");
    };

    const inputCls = "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight font-black";
    const labelCls = "block text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 ml-1";

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none text-[Spanish]">Gastos Operativos</h2>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none text-[Spanish]">
                            Registro de gastos no inventariables
                        </span>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/50">
                    <button onClick={() => setActiveTab('nuevo')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'nuevo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        <Plus size={12} /> {isEditing ? 'Editando' : 'Nuevo'}
                    </button>
                    <button onClick={() => setActiveTab('historial')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        <History size={12} /> Historial
                    </button>
                </div>
            </div>

            {(!activePeriod && !loadingPeriod) && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 text-[Spanish]">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                            <Calendar size={40} className="text-amber-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Periodo Requerido</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                Configure un periodo fiscal activo en el menú de compras.
                            </p>
                        </div>
                        <button onClick={() => window.location.href = '/compras/periodo'} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl">
                            CONFIGURAR PERIODO
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-in fade-in duration-300 text-[Spanish]">
                    <div className="lg:col-span-3 space-y-4">
                        {/* Cabecera */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <Banknote size={16} className="text-indigo-600" />
                                <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">Datos Generales</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Sucursal</label>
                                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                                        <option value="">---</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Proveedor</label>
                                    <SearchableSelect 
                                        options={providers} value={providerId} 
                                        onChange={(e) => setProviderId(e.target.value)}
                                        valueKey="id" labelKey="nombre" placeholder="BUSCAR PROVEEDOR..."
                                        codeKey="nrc" codeLabel="NRC"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>
                                        Fecha {activePeriod && `(Periodo: ${activePeriod.month}/${activePeriod.year})`}
                                    </label>
                                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo Doc.</label>
                                    <select value={tipoDocId} onChange={(e) => {setTipoDocId(e.target.value); setIsIvaDirty(false); setIsRetDirty(false); setIsPercDirty(false);}} className={inputCls}>
                                        {tipoDocs.map(t => <option key={t.code} value={t.code}>{t.description.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>No. Doc.</label>
                                    <input type="text" value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="000-000" className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Condición</label>
                                    <select value={condicionId} onChange={(e) => setCondicionId(e.target.value)} className={inputCls}>
                                        {condiciones.map(c => <option key={c.code} value={c.code}>{c.description.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Concepto Gral.</label>
                                    <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="GASTOS VARIOS..." className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Detalle */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 font-black text-slate-800 text-[10px] uppercase tracking-widest text-[Spanish]">
                                <Calculator size={14} className="text-indigo-600" /> Detalles del Gasto
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300">
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Concepto / Descripción</label>
                                    <input 
                                        ref={descRef}
                                        type="text" value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)} 
                                        onKeyDown={(e) => handleKeyDown(e, typeRef)}
                                        className={inputCls} placeholder="Ej. Pago de Alquiler" 
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Tipo Gasto</label>
                                    <select 
                                        ref={typeRef}
                                        value={quickTypeId} onChange={(e) => setQuickTypeId(e.target.value)} 
                                        onKeyDown={(e) => handleKeyDown(e, amountRef)}
                                        className={inputCls}
                                    >
                                        <option value="">---</option>
                                        {expenseTypes.map(t => <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Monto $</label>
                                    <input 
                                        ref={amountRef}
                                        type="number" step="0.01" value={quickAmount} 
                                        onChange={(e) => setQuickAmount(e.target.value)} 
                                        onKeyDown={(e) => handleKeyDown(e, taxTypeRef)}
                                        onFocus={(e) => e.target.select()}
                                        className={inputCls} 
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Clasificación</label>
                                    <select 
                                        ref={taxTypeRef}
                                        value={quickTaxType} onChange={(e) => setQuickTaxType(e.target.value)} 
                                        onKeyDown={(e) => handleKeyDown(e, 'add')}
                                        className={inputCls}
                                    >
                                        <option value="gravada">GRAVADA</option>
                                        <option value="exenta">EXENTA</option>
                                        <option value="nosujeta">NO SUJETA</option>
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button 
                                        onClick={handleAddQuick} 
                                        className="w-full bg-slate-900 text-white h-8 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} /> AGREGAR
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto min-h-[200px]">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 italic">
                                            <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-[Spanish]">Descripción</th>
                                            <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-[Spanish]">Tipo</th>
                                            <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-[Spanish]">Fiscal</th>
                                            <th className="py-3 px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-[Spanish]">Monto</th>
                                            <th className="py-3 px-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 italic">
                                        {selectedItems.map((item) => (
                                            <tr key={item.id} className="text-[10px] font-bold text-slate-600 hover:bg-slate-50/50 transition-colors group">
                                                <td className="py-3 px-2 uppercase">{item.description}</td>
                                                <td className="py-3 px-2 text-indigo-500 font-black">{item.expense_type_name.toUpperCase()}</td>
                                                <td className="py-3 px-2">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                                        item.tax_type === 'gravada' ? 'bg-green-50 text-green-600' :
                                                        item.tax_type === 'exenta' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        {item.tax_type}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-2 text-right font-black text-slate-900">${parseFloat(item.total).toFixed(2)}</td>
                                                <td className="py-3 px-2 text-right">
                                                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {selectedItems.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="py-12 text-center text-slate-400 italic text-[11px] text-[Spanish]">
                                                    No hay conceptos agregados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Totales y Acciones (Vertical Layout + Right Aligned Text) */}
                    <div className="space-y-4 text-[Spanish]">
                        <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white space-y-4 ring-8 ring-slate-900/5">
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Resumen de Gasto</h3>
                                {(isIvaDirty || isRetDirty || isPercDirty) && (
                                    <button 
                                        onClick={() => {setIsIvaDirty(false); setIsRetDirty(false); setIsPercDirty(false);}}
                                        className="text-[8px] font-black text-indigo-400 hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest"
                                    >
                                        <RefreshCw size={10} /> Recalcular
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-3 text-right">
                                <div className="flex flex-col items-end py-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Total Gravada</span>
                                    <span className="font-mono text-sm font-black italic text-white">${totals.gravada.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col items-end py-1 border-b border-white/5 pb-3">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Total Exento/NoSuj</span>
                                    <span className="font-mono text-sm font-black italic text-white">${(totals.exenta + totals.nosujeta).toFixed(2)}</span>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-end gap-2">
                                            {isIvaDirty && <span className="text-[7px] text-indigo-500 font-bold uppercase italic">[Manual]</span>}
                                            <label className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">(+) IVA (13%)</label>
                                        </div>
                                        <input 
                                            type="number" step="0.01" 
                                            value={manualIVA} 
                                            onChange={(e) => {setManualIVA(parseFloat(e.target.value || 0)); setIsIvaDirty(true);}} 
                                            onFocus={(e) => e.target.select()}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none font-mono text-[13px] font-black text-indigo-400 focus:border-indigo-500/50 transition-all text-right" 
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-end gap-2">
                                            {isRetDirty && <span className="text-[7px] text-rose-500 font-bold uppercase italic">[Manual]</span>}
                                            <label className="text-[8px] font-black text-rose-400 uppercase tracking-widest">(-) Retención (1%)</label>
                                        </div>
                                        <input 
                                            type="number" step="0.01" 
                                            value={manualRetencion} 
                                            onChange={(e) => {setManualRetencion(parseFloat(e.target.value || 0)); setIsRetDirty(true);}} 
                                            onFocus={(e) => e.target.select()}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none font-mono text-[13px] font-black text-rose-400 focus:border-rose-500/50 transition-all text-right" 
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-end gap-2">
                                            {isPercDirty && <span className="text-[7px] text-amber-500 font-bold uppercase italic">[Manual]</span>}
                                            <label className="text-[8px] font-black text-amber-400 uppercase tracking-widest">(+) Percepción (1%)</label>
                                        </div>
                                        <input 
                                            type="number" step="0.01" 
                                            value={manualPercepcion} 
                                            onChange={(e) => {setManualPercepcion(parseFloat(e.target.value || 0)); setIsPercDirty(true);}} 
                                            onFocus={(e) => e.target.select()}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none font-mono text-[13px] font-black text-amber-400 focus:border-amber-500/50 transition-all text-right" 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest text-right">(+) Fovial</label>
                                            <input 
                                                type="number" step="0.01" value={manualFovial} 
                                                onChange={(e) => {setManualFovial(parseFloat(e.target.value || 0)); setIsFovDirty(true);}} 
                                                onFocus={(e) => e.target.select()}
                                                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none font-mono text-[11px] font-black text-emerald-400 focus:border-emerald-500/50 transition-all text-right" 
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[8px] font-black text-emerald-400 uppercase tracking-widest text-right">(+) Cotrans</label>
                                            <input 
                                                type="number" step="0.01" value={manualCotrans} 
                                                onChange={(e) => {setManualCotrans(parseFloat(e.target.value || 0)); setIsCotDirty(true);}} 
                                                onFocus={(e) => e.target.select()}
                                                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none font-mono text-[11px] font-black text-emerald-400 focus:border-emerald-500/50 transition-all text-right" 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 mt-2">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">TOTAL A PAGAR</span>
                                        <span className="text-4xl font-black italic tracking-tighter text-indigo-400 underline decoration-white/20 underline-offset-8">
                                            ${totals.total.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col gap-2">
                                <button 
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    onClick={handleSubmit} 
                                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? 'Procesando...' : (isEditing ? <Check size={16} /> : <Save size={16} />)}
                                    {isEditing ? 'ACTUALIZAR GASTO' : 'REGISTRAR GASTO'}
                                </button>
                                <button onClick={resetForm} className="w-full bg-white/5 border border-white/10 text-slate-400 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">
                                    Limpiar Formulario
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-bottom-2 duration-400 text-[Spanish]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                placeholder="Buscar por número o proveedor..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all text-xs font-bold uppercase tracking-tight"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleExportExcel} className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors" title="Exportar Excel">
                                <FileSpreadsheet size={18} />
                            </button>
                        </div>
                    </div>

                    <Table 
                        headers={["ID", "FECHA", "PROVEEDOR", "TIPO DOC", "NÚMERO", "TOTAL", "ESTADO", "ACCIONES"]}
                        data={expensesData?.data || []}
                        isLoading={loadingHistory}
                        renderRow={(e) => (
                            <tr key={e.id} className="text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors uppercase italic">
                                <td className="py-4 px-4 font-mono text-[10px] text-slate-400">#{e.id}</td>
                                <td className="py-4 px-4">{formatDate(e.fecha)}</td>
                                <td className="py-4 px-4 max-w-[200px] truncate">{e.provider_nombre}</td>
                                <td className="py-4 px-4 text-indigo-500">{e.tipo_documento_nombre}</td>
                                <td className="py-4 px-4">{e.numero_documento}</td>
                                <td className="py-4 px-4 font-black">${parseFloat(e.monto_total).toFixed(2)}</td>
                                <td className="py-4 px-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                        e.status === 'activo' || e.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                    }`}>
                                        {e.status}
                                    </span>
                                </td>
                                <td className="py-4 px-4">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => { setViewingExpense(e); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                            <Eye size={16} />
                                        </button>
                                        {e.status !== 'ANULADO' && e.status !== 'voided' && (
                                            <>
                                                <button onClick={() => handleEdit(e)} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors">
                                                    <Edit size={16} />
                                                </button>
                                                <button onClick={() => { if(window.confirm('¿Desea anular este gasto?')) voidMutation.mutate(e.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors">
                                                    <XCircle size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    />

                    <Pagination 
                        currentPage={historyPage}
                        totalPages={expensesData?.totalPages || 0}
                        onPageChange={setHistoryPage}
                        totalItems={expensesData?.totalItems || 0}
                    />
                </div>
            )}

            {/* Modal Detalle */}
            {viewingExpense && (
                <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center text-[Spanish]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <Banknote size={24} className="text-indigo-400" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Detalle de Gasto</span>
                                    <h3 className="text-xl font-black italic tracking-tighter uppercase">{viewingExpense.numero_documento}</h3>
                                </div>
                            </div>
                            <button onClick={() => setViewingExpense(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            {loadingDetail ? (
                                <div className="h-60 flex items-center justify-center text-[Spanish]"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
                            ) : expenseDetail && (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[Spanish]">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Fecha Emisión</span>
                                            <span className="text-sm font-bold text-slate-600 italic underline decoration-indigo-500 decoration-2 underline-offset-4">{formatDate(expenseDetail.fecha)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 col-span-2">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Proveedor</span>
                                            <span className="text-sm font-black text-slate-800 italic uppercase">{expenseDetail.provider_nombre}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 text-right">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Condición</span>
                                            <span className="text-sm font-black text-indigo-500 italic mt-1 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">{expenseDetail.condicion_operacion_nombre?.toUpperCase() || 'CONTADO'}</span>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-inner bg-slate-50/30 italic">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-100/50">
                                                    <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-[Spanish]">Cpto.</th>
                                                    <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-[Spanish]">Tipo</th>
                                                    <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right text-[Spanish]">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {expenseDetail.items?.map(it => (
                                                    <tr key={it.id} className="text-[11px] font-bold text-slate-600">
                                                        <td className="py-3 px-4 uppercase">{it.description}</td>
                                                        <td className="py-3 px-4 text-indigo-500 font-black">{expenseTypes.find(t=>t.id===it.expense_type_id)?.name.toUpperCase()}</td>
                                                        <td className="py-3 px-4 text-right font-black text-slate-900">${parseFloat(it.total).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-slate-100 text-[Spanish]">
                                        <div className="w-64 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded-xl">
                                                    <span className="text-[8px] font-black text-slate-400">IVA</span>
                                                    <span className="text-[10px] font-bold font-mono">${parseFloat(expenseDetail.iva).toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-2 bg-slate-50 rounded-xl">
                                                    <span className="text-[8px] font-black text-slate-400">RET.</span>
                                                    <span className="text-[10px] font-bold font-mono">${parseFloat(expenseDetail.retencion).toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-4 py-2 bg-slate-900 rounded-2xl text-white">
                                                <span className="text-[9px] font-black text-slate-400 tracking-widest italic animate-pulse">TOTAL PAGADO</span>
                                                <span className="text-xl font-black italic tracking-tighter text-indigo-400 group-hover:underline underline-offset-4">${parseFloat(expenseDetail.monto_total).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;
