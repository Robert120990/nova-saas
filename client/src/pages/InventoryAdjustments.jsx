import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Plus, 
    Trash2, 
    Save, 
    History, 
    FileText, 
    Calendar, 
    Search, 
    X,
    Barcode,
    Check,
    ArrowUpCircle,
    ArrowDownCircle,
    Package,
    Settings,
    Download,
    Eye,
    Edit2,
    XCircle,
    CheckCircle2,
    AlertCircle,
    FileSpreadsheet,
    FileText as FilePdf
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';

const InventoryAdjustments = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('nuevo');
    const barcodeInputRef = useRef(null);
    
    // Form State
    const [branchId, setBranchId] = useState('');
    const [tipo, setTipo] = useState('ENTRADA');
    const [motivoId, setMotivoId] = useState('');
    const [numero, setNumero] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    
    // History State
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const limit = 10;

    // Quick Add state
    const [quickProd, setQuickProd] = useState(null);
    const [quickCant, setQuickCant] = useState(1);
    const [quickCosto, setQuickCosto] = useState(0);
    const [quickBarcode, setQuickBarcode] = useState('');
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                if (activeTab === 'nuevo') {
                    if (!branchId) {
                        toast.error('Seleccione primero una sucursal');
                    } else {
                        setIsProductModalOpen(true);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [branchId, activeTab]);
    
    const qtyInputRef = useRef(null);
    const costInputRef = useRef(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: motivos = [] } = useQuery({
        queryKey: ['inventory-motivos'],
        queryFn: async () => (await axios.get('/api/inventory/motivos')).data
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products-all'],
        queryFn: async () => (await axios.get('/api/products', { params: { limit: 1000 } })).data?.data || []
    });

    const { data: adjustmentsData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: loadingAdjustments } = useQuery({
        queryKey: ['inventory-adjustments', historySearch, historyPage],
        queryFn: async () => (await axios.get('/api/inventory/adjustments', { 
            params: { search: historySearch, page: historyPage, limit } 
        })).data,
        enabled: activeTab === 'historial'
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/inventory/adjustments', data),
        onSuccess: () => {
            toast.success('Movimiento registrado correctamente');
            resetForm();
            queryClient.invalidateQueries(['inventory']);
            queryClient.invalidateQueries(['inventory-adjustments']);
            setActiveTab('historial');
        },
        onError: (err) => {
            const serverMsg = err.response?.data?.message;
            toast.error(serverMsg || 'Error al procesar el movimiento');
        }
    });

    const resetForm = () => {
        setBranchId('');
        setMotivoId('');
        setNumero('');
        setObservaciones('');
        setSelectedItems([]);
        setQuickBarcode('');
        setQuickProd(null);
    };

    const handleBarcodeSubmit = async (e) => {
        if (e.key === 'Enter' && quickBarcode) {
            const searchCode = quickBarcode.trim().toUpperCase();
            const product = products.find(p => 
                p.codigo?.toUpperCase() === searchCode || 
                p.barcode?.toUpperCase() === searchCode
            );
            if (product) {
                if (product.status !== 'activo') {
                    setQuickBarcode('');
                    return toast.error('El producto seleccionado se encuentra inactivo');
                }
                const bid = parseInt(branchId);
                if (bid && !product.branches?.includes(bid)) {
                    setQuickBarcode('');
                    return toast.error('El producto no está autorizado para esta sucursal');
                }
                setQuickProd(product);
                setQuickCosto(product.costo || 0);
                setTimeout(() => qtyInputRef.current?.focus(), 50);
            } else {
                toast.error('Producto no encontrado');
                setQuickBarcode('');
            }
        }
    };

    const handleAddQuick = () => {
        if (!quickProd) return;

        if (quickProd.status !== 'activo') {
            return toast.error('El producto seleccionado se encuentra inactivo');
        }

        if (branchId && !quickProd.branches?.includes(parseInt(branchId))) {
            return toast.error('El producto no está autorizado para esta sucursal');
        }
        if (!branchId || !motivoId || !numero) {
            return toast.error('Complete la configuración del encabezado (Sucursal, Motivo y Número)');
        }
        
        const cant = parseFloat(quickCant);
        const cost = parseFloat(quickCosto);

        if (isNaN(cant) || cant <= 0) return toast.error('Cantidad inválida');
        if (isNaN(cost) || cost < 0) return toast.error('Costo inválido');

        if (quickProd.status !== 'activo') {
            return toast.error('El producto seleccionado se encuentra inactivo');
        }

        // Verificar sucursal
        if (!quickProd.branches?.includes(parseInt(branchId))) {
            return toast.error(`El producto "${quickProd.nombre}" no está autorizado para esta sucursal`);
        }

        // Si ya está en la lista, sumar cantidad? No, el usuario mostró filas repetidas usualmente, pero aquí mantendremos la lógica de "ya está en la lista" o "sumar". 
        // Siguiendo el estándar previo: error si ya está.
        if (selectedItems.find(item => item.product_id === quickProd.id)) {
            return toast.error('El producto ya está en la lista');
        }

        const newItem = {
            product_id: quickProd.id,
            nombre: quickProd.nombre,
            codigo: quickProd.codigo,
            cantidad: parseFloat(quickCant),
            costo: parseFloat(quickCosto),
            total: parseFloat(quickCant) * parseFloat(quickCosto)
        };
        
        setSelectedItems([...selectedItems, newItem]);
        setQuickProd(null);
        setQuickBarcode('');
        setQuickCant(1);
        setQuickCosto(0);
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
    };

    const handleSelectProduct = (product) => {
        setQuickProd(product);
        setQuickCosto(product.costo || 0);
        setQuickCant(1);
        setIsProductModalOpen(false);
        setTimeout(() => qtyInputRef.current?.focus(), 50);
    };

    const updateItem = (productId, field, value) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const updated = { ...item, [field]: value };
                updated.total = updated.cantidad * updated.costo;
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.product_id !== id));
    };

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isMotivosModalOpen, setIsMotivosModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    // Filter products for modal
    const productsForModal = useMemo(() => {
        let list = products.filter(p => p.status === 'activo');
        
        if (branchId) {
            const bid = parseInt(branchId);
            list = list.filter(p => p.branches?.includes(bid));
        }

        if (!productSearch) return list.slice(0, 50);
        const search = productSearch.toLowerCase();
        return list.filter(p => 
            p.nombre.toLowerCase().includes(search) || 
            p.codigo.toLowerCase().includes(search)
        ).slice(0, 50);
    }, [products, productSearch, branchId]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!branchId || !motivoId || !tipo) return toast.error('Complete la configuración del encabezado');
        if (selectedItems.length === 0) return toast.error('Agregue al menos un producto');

        createMutation.mutate({
            branch_id: branchId,
            motivo_id: motivoId,
            tipo,
            numero: String(numero || ''),
            fecha,
            observaciones: String(observaciones || ''),
            items: selectedItems
        });
    };

    const handleCreateMotivo = async (nombre) => {
        try {
            await axios.post('/api/inventory/motivos', { nombre, tipo });
            toast.success('Motivo creado');
            queryClient.invalidateQueries(['inventory-motivos']);
            setIsMotivosModalOpen(false);
        } catch (error) {
            toast.error('Error al crear motivo');
        }
    };

    const totalAjuste = selectedItems.reduce((acc, item) => acc + item.total, 0);

    const inputCls = "w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[13px] font-medium";
    const selectSmallCls = "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight";
    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";

    const [viewingAdjustment, setViewingAdjustment] = useState(null);
    const [editingAdjustment, setEditingAdjustment] = useState(null);

    const voidMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/inventory/adjustments/${id}/void`),
        onSuccess: () => {
            toast.success('Movimiento anulado correctamente');
            queryClient.invalidateQueries(['inventory-adjustments']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al anular')
    });
    
    const exportToExcel = () => {
        if (!adjustmentsData?.data?.length) return;
        
        const worksheet = XLSX.utils.json_to_sheet(adjustmentsData.data.map(a => ({
            Documento: `AJ-${String(a.id).padStart(6, '0')}`,
            Referencia: a.numero || '',
            Fecha: new Date(a.fecha).toLocaleString(),
            Sucursal: a.branch_name,
            Motivo: a.motivo_name,
            Tipo: a.tipo,
            Items: a.items_count,
            Estado: a.status || 'COMPLETADO'
        })));
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
        XLSX.writeFile(workbook, `Movimientos_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
    };
    
    const exportToPDF = () => {
        if (!adjustmentsData?.data?.length) return;
        
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte de Movimientos de Inventario", 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Fecha Reporte: ${new Date().toLocaleString()}`, 14, 30);
        
        const tableColumn = ["Documento", "Fecha", "Sucursal", "Motivo", "Tipo", "Cant. Items", "Estado"];
        const tableRows = adjustmentsData.data.map(a => [
            `AJ-${String(a.id).padStart(6, '0')}`,
            new Date(a.fecha).toLocaleString(),
            a.branch_name,
            a.motivo_name,
            a.tipo,
            a.items_count,
            a.status || 'COMPLETADO'
        ]);
        
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
        });
        
        doc.save(`Movimientos_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header section */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Movimientos de Inventario</h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm">Registro de entradas y salidas de stock</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('nuevo')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'nuevo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plus size={14} />
                        Nuevo Movimiento
                    </button>
                    <button 
                        onClick={() => setActiveTab('historial')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={14} />
                        Historial
                    </button>
                    <button 
                        onClick={() => setIsMotivosModalOpen(true)}
                        className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 text-slate-500 hover:text-slate-700"
                    >
                        <Settings size={14} />
                        Motivos
                    </button>
                </div>
            </div>

            {activeTab === 'nuevo' ? (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Top Row: Configuration & Totals */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                        <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <FileText size={18} className="text-indigo-600" />
                                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Configuración del Movimiento</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Sucursal</label>
                                    <select 
                                        value={branchId} 
                                        onChange={(e) => setBranchId(e.target.value)}
                                        className={inputCls}
                                    >
                                        <option value="">Seleccionar Sucursal...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo</label>
                                    <select 
                                        value={tipo} 
                                        onChange={(e) => setTipo(e.target.value)}
                                        className={inputCls}
                                    >
                                        <option value="ENTRADA">ENTRADA</option>
                                        <option value="SALIDA">SALIDA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Fecha</label>
                                    <input 
                                        type="date"
                                        value={fecha}
                                        onChange={(e) => setFecha(e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className={labelCls}>Número</label>
                                    <input 
                                        type="text"
                                        value={numero}
                                        onChange={(e) => setNumero(e.target.value)}
                                        placeholder="Doc #"
                                        className={inputCls}
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className={labelCls}>Motivo</label>
                                    <select 
                                        value={motivoId} 
                                        onChange={(e) => setMotivoId(e.target.value)}
                                        className={inputCls}
                                    >
                                        <option value="">Seleccionar Motivo...</option>
                                        {motivos
                                            .filter(m => m.tipo === tipo)
                                            .map(m => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelCls}>Observaciones</label>
                                <input 
                                    type="text"
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Ingrese observaciones del movimiento..."
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Totals Section */}
                        <div className="lg:col-span-1 h-full">
                            <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white space-y-4 h-full flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center text-[10px] opacity-60 uppercase font-black mb-2">
                                        <span>Items: {selectedItems.length}</span>
                                        <span>Subtotal: ${totalAjuste.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-white/10 pt-4">
                                        <span className="text-sm font-bold opacity-80 uppercase tracking-widest">Total Ajuste</span>
                                        <span className="text-2xl font-black">${totalAjuste.toFixed(2)}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending || selectedItems.length === 0}
                                    className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 mt-4"
                                >
                                    <Save size={18} />
                                    <span>{createMutation.isPending ? 'Guardando...' : 'Guardar Movimiento'}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Detail Row: Items */}
                    <div className="space-y-6">
                        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 relative ${(!branchId || !motivoId || !numero) ? 'opacity-40 grayscale pointer-events-none select-none' : ''}`}>
                            {(!branchId || !motivoId || !numero) && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
                                    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-3xl border border-slate-100 shadow-2xl max-w-sm animate-in zoom-in-95 duration-300">
                                        <AlertCircle size={32} className="mx-auto mb-3 text-amber-500" />
                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-relaxed">
                                            Debe completar la sucursal, el motivo y el número de documento para comenzar a agregar productos.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-100 bg-slate-50/30 rounded-xl">
                                <div className="flex-1 grid grid-cols-[150px_1fr_100px_120px_100px_50px] gap-2 items-end">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Producto</label>
                                        <div className="relative">
                                            <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input 
                                                ref={barcodeInputRef}
                                                type="text"
                                                value={quickBarcode}
                                                onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())}
                                                onKeyDown={handleBarcodeSubmit}
                                                placeholder="CÓDIGO + ENTER"
                                                className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-mono text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Descripción</label>
                                        <div className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 truncate h-[34px] flex items-center">
                                            {quickProd?.nombre || '---'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Cant.</label>
                                        <input 
                                            ref={qtyInputRef}
                                            type="number"
                                            value={quickCant}
                                            onChange={(e) => setQuickCant(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && costInputRef.current?.focus()}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 text-xs font-black text-center h-[34px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1">Costo Unit.</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">$</span>
                                            <input 
                                                ref={costInputRef}
                                                type="number"
                                                value={quickCosto}
                                                onChange={(e) => setQuickCosto(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddQuick()}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 text-xs font-black text-right h-[34px]"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right pr-1 italic">Total</label>
                                        <div className="w-full px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black text-indigo-600 text-right h-[34px] flex items-center justify-end">
                                            ${(parseFloat(quickCant || 0) * parseFloat(quickCosto || 0)).toFixed(2)}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleAddQuick}
                                        disabled={!quickProd}
                                        className="h-[34px] w-full bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden min-h-[400px]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100 font-bold text-[10px] text-slate-500 uppercase tracking-widest">
                                            <th className="px-6 py-2">Código</th>
                                            <th className="px-6 py-2">Producto</th>
                                            <th className="px-6 py-2 text-center w-24">Cant.</th>
                                            <th className="px-6 py-2 text-right w-32">Costo U.</th>
                                            <th className="px-6 py-2 text-right w-32">Total</th>
                                            <th className="px-6 py-2 text-right w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-24 text-center">
                                                    <div className="flex flex-col items-center gap-3 text-slate-300">
                                                        <Package size={48} className="opacity-20" />
                                                        <p className="text-sm font-bold uppercase tracking-widest">Lista Vacía</p>
                                                        <p className="text-xs font-medium text-slate-400">Escanea o selecciona productos manualmente</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            selectedItems.map((item) => (
                                                <tr key={item.product_id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 grow">
                                                    <td className="px-6 py-1.5">
                                                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded">{item.codigo}</span>
                                                    </td>
                                                    <td className="px-6 py-1.5">
                                                        <div className="text-xs font-bold text-slate-700">{item.nombre}</div>
                                                    </td>
                                                    <td className="px-6 py-1.5">
                                                        <input 
                                                            type="number" 
                                                            value={item.cantidad}
                                                            onChange={(e) => updateItem(item.product_id, 'cantidad', parseFloat(e.target.value))}
                                                            onFocus={(e) => e.target.select()}
                                                            className="w-full bg-transparent border-none rounded-lg text-center font-black py-0.5 text-xs focus:ring-2 focus:ring-indigo-500/10"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-1.5">
                                                        <div className="relative">
                                                            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[10px]">$</span>
                                                            <input 
                                                                type="number" 
                                                                value={item.costo}
                                                                onChange={(e) => updateItem(item.product_id, 'costo', parseFloat(e.target.value))}
                                                                onFocus={(e) => e.target.select()}
                                                                className="w-full bg-transparent border-none rounded-lg pl-4 text-right font-bold py-0.5 text-xs focus:ring-2 focus:ring-indigo-500/10"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-1.5 text-right">
                                                        <span className="text-xs font-black text-slate-900">${item.total.toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-6 py-1.5 text-right">
                                                        <button 
                                                            onClick={() => removeItem(item.product_id)}
                                                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            ) : (
                /* History Tab */
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                value={historySearch}
                                onChange={(e) => { setHistorySearch(e.target.value.toUpperCase()); setHistoryPage(1); }}
                                placeholder="Buscar por número, sucursal u observaciones..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm font-bold"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={exportToExcel}
                                className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all"
                            >
                                <FileSpreadsheet size={14} />
                                Excel
                            </button>
                            <button 
                                onClick={exportToPDF}
                                className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-rose-100 transition-all"
                            >
                                <FilePdf size={14} />
                                PDF
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <Table 
                            headers={['Documento', 'Fecha', 'Sucursal', 'Motivo', 'Tipo', 'Items', 'Estado', 'Acciones']}
                            data={adjustmentsData?.data || []}
                            isLoading={loadingAdjustments}
                            renderRow={(a) => (
                                <tr key={a.id} className={`hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 ${a.status === 'ANULADO' ? 'opacity-50 grayscale select-none' : ''}`}>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-mono font-black text-indigo-600">
                                                AJ-{String(a.id).padStart(6, '0')}
                                            </span>
                                            {a.numero && <span className="text-[10px] text-slate-400 font-bold">{a.numero}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-600">{new Date(a.fecha).toLocaleString()}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-700">{a.branch_name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-medium text-slate-500">{a.motivo_name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-wider ${a.tipo === 'ENTRADA' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                            {a.tipo === 'ENTRADA' ? <ArrowUpCircle size={14} className="inline mr-1" /> : <ArrowDownCircle size={14} className="inline mr-1" />}
                                            {a.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-black text-slate-600">{a.items_count}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black tracking-tighter uppercase ${a.status === 'ANULADO' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {a.status === 'ANULADO' ? <AlertCircle size={10} className="inline mr-1" /> : <CheckCircle2 size={10} className="inline mr-1" />}
                                            {a.status || 'COMPLETADO'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button 
                                                onClick={() => setViewingAdjustment(a)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {a.status !== 'ANULADO' && (
                                                <>
                                                    <button 
                                                        onClick={() => setEditingAdjustment(a)}
                                                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm('¿Está seguro de anular este movimiento? Esta acción reversará el stock automáticamente.')) {
                                                                voidMutation.mutate(a.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    >
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
                            totalPages={adjustmentsData?.totalPages || 0}
                            totalItems={adjustmentsData?.totalItems || 0}
                            onPageChange={setHistoryPage}
                            itemsOnPage={adjustmentsData?.data?.length || 0}
                            isLoading={loadingAdjustments}
                        />
                    </div>
                </div>
            )}

            <ProductSelectionModal 
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                products={productsForModal}
                handleSelect={handleSelectProduct}
            />

            <MotivosModal 
                isOpen={isMotivosModalOpen}
                onClose={() => setIsMotivosModalOpen(false)}
                tipo={tipo}
                motivos={motivos}
                handleCreateMotivo={handleCreateMotivo}
                labelCls={labelCls}
                inputCls={inputCls}
                queryClient={queryClient}
            />

            <AdjustmentDetailModal 
                adjustment={viewingAdjustment}
                onClose={() => setViewingAdjustment(null)}
            />

            <EditAdjustmentModal 
                adjustment={editingAdjustment}
                onClose={() => setEditingAdjustment(null)}
                queryClient={queryClient}
            />
        </div>
    );
};

/* Modals */
const ProductSelectionModal = ({ isOpen, onClose, productSearch, setProductSearch, products, handleSelect }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Seleccionar Producto</h3>
                        <p className="text-sm text-slate-500 font-medium text-[Spanish]">Solo se muestran productos activos autorizados para esta sucursal</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                
                <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            autoFocus
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {products.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => handleSelect(p)}
                                className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group"
                            >
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-indigo-100 transition-all">
                                    <Package size={20} className="text-slate-400 group-hover:text-indigo-500" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900 line-clamp-1">{p.nombre}</div>
                                    <div className="text-xs font-mono font-bold text-indigo-500 mt-1">{p.codigo}</div>
                                    <div className="mt-2 text-[10px] font-black uppercase text-slate-400">Stock Sugerido: <span className="text-slate-900">{p.stock || 0}</span></div>
                                </div>
                            </button>
                        ))}
                        {products.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <Package size={40} className="mx-auto opacity-20 mb-2" />
                                <p className="font-bold uppercase tracking-widest text-xs">Sin coincidencias</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MotivosModal = ({ isOpen, onClose, tipo, motivos, handleCreateMotivo, labelCls, inputCls, queryClient }) => {
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    if (!isOpen) return null;

    const handleDelete = async (id) => {
        if (!window.confirm('¿Desea eliminar este motivo?')) return;
        try {
            await axios.delete(`/api/inventory/motivos/${id}`);
            toast.success('Motivo eliminado');
            queryClient.invalidateQueries(['inventory-motivos']);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al eliminar');
        }
    };

    const handleUpdate = async (id) => {
        try {
            await axios.put(`/api/inventory/motivos/${id}`, { nombre: editValue });
            toast.success('Motivo actualizado');
            setEditingId(null);
            queryClient.invalidateQueries(['inventory-motivos']);
        } catch (error) {
            toast.error('Error al actualizar');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-900">Gestión de Motivos</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateMotivo(e.target.nombre.value);
                        e.target.reset();
                    }} className="space-y-4">
                        <div>
                            <label className={labelCls}>Nuevo Motivo ({tipo})</label>
                            <div className="flex gap-2">
                                <input 
                                    name="nombre"
                                    required
                                    type="text" 
                                    placeholder="Ej: Ajuste por Daño"
                                    className={inputCls}
                                />
                                <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                    </form>

                    <div className="space-y-2">
                        <label className={labelCls}>Existentes para {tipo}</label>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-2">
                            {motivos.filter(m => m.tipo === tipo).map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                    {editingId === m.id ? (
                                        <div className="flex-1 flex gap-2">
                                            <input 
                                                autoFocus
                                                className="flex-1 px-2 py-1 text-sm rounded border"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                            />
                                            <button onClick={() => handleUpdate(m.id)} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded"><Save size={14}/></button>
                                            <button onClick={() => setEditingId(null)} className="text-slate-400 p-1 hover:bg-slate-100 rounded"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-sm font-bold text-slate-700">{m.nombre}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => { setEditingId(m.id); setEditValue(m.nombre); }}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(m.id)}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdjustmentDetailModal = ({ adjustment, onClose }) => {
    const { data: detail, isLoading } = useQuery({
        queryKey: ['adjustment-detail', adjustment?.id],
        queryFn: async () => (await axios.get(`/api/inventory/adjustments/${adjustment.id}`)).data,
        enabled: !!adjustment
    });

    if (!adjustment) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-900">Detalle de Movimiento</h3>
                            <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                AJ-{String(adjustment.id).padStart(6, '0')}
                            </span>
                            {detail?.status === 'ANULADO' && (
                                <span className="bg-rose-100 text-rose-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">Anulado</span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Registrado por {detail?.usuario_nombre} un {new Date(detail?.fecha).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-4 p-6 border-b border-slate-100 text-xs uppercase font-black text-slate-400">
                    <div>
                        <div className="mb-1 opacity-60">Sucursal</div>
                        <div className="text-slate-900">{detail?.branch_name}</div>
                    </div>
                    <div>
                        <div className="mb-1 opacity-60">Tipo/Motivo</div>
                        <div className="text-slate-900">{detail?.tipo} - {detail?.motivo_name}</div>
                    </div>
                    <div>
                        <div className="mb-1 opacity-60">Número Doc.</div>
                        <div className="text-slate-900">{detail?.numero || 'N/A'}</div>
                    </div>
                    {detail?.observaciones && (
                        <div className="col-span-full mt-2">
                            <div className="mb-1 opacity-60">Notas</div>
                            <div className="text-slate-600 italic normal-case font-medium">{detail.observaciones}</div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-3">Producto</th>
                                <th className="px-6 py-3 text-center">Cantidad</th>
                                <th className="px-6 py-3 text-right">Costo</th>
                                <th className="px-6 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {detail?.items?.map(item => (
                                <tr key={item.id} className="text-sm">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{item.nombre}</div>
                                        <div className="text-[11px] font-mono text-slate-400">{item.codigo}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center font-black">{item.cantidad}</td>
                                    <td className="px-6 py-4 text-right font-medium text-slate-500">${item.costo.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right font-black text-slate-900">${item.total.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-black border-t-2 border-slate-100">
                            <tr>
                                <td colSpan="3" className="px-6 py-4 text-right uppercase text-[10px] text-slate-500 tracking-widest">Total Movimiento</td>
                                <td className="px-6 py-4 text-right text-lg text-slate-900">${detail?.items?.reduce((sum, i) => sum + i.total, 0).toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

const EditAdjustmentModal = ({ adjustment, onClose, queryClient }) => {
    const [form, setForm] = useState({ numero: '', fecha: '', observaciones: '' });
    
    useEffect(() => {
        if (adjustment) {
            setForm({
                numero: adjustment.numero || '',
                fecha: adjustment.fecha ? adjustment.fecha.split('T')[0] : '',
                observaciones: adjustment.observaciones || ''
            });
        }
    }, [adjustment]);

    const mutation = useMutation({
        mutationFn: (data) => axios.put(`/api/inventory/adjustments/${adjustment.id}`, data),
        onSuccess: () => {
            toast.success('Cambios guardados');
            queryClient.invalidateQueries(['inventory-adjustments']);
            onClose();
        },
        onError: () => toast.error('Error al actualizar')
    });

    if (!adjustment) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900">Editar Movimiento</h3>
                    <p className="text-xs text-slate-500 font-medium">Actualice información informativa del encabezado</p>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Número de Documento</label>
                        <input 
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-bold"
                            value={form.numero}
                            onChange={(e) => setForm({...form, numero: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Fecha</label>
                        <input 
                            type="date"
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-bold"
                            value={form.fecha}
                            onChange={(e) => setForm({...form, fecha: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 mb-1 block">Observaciones</label>
                        <textarea 
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 text-sm font-medium h-24 resize-none"
                            value={form.observaciones}
                            onChange={(e) => setForm({...form, observaciones: e.target.value})}
                        />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all text-sm uppercase tracking-widest text-[Spanish]">Cancelar</button>
                        <button 
                            onClick={() => mutation.mutate(form)}
                            disabled={mutation.isPending}
                            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 text-[Spanish]"
                        >
                            {mutation.isPending ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryAdjustments;
