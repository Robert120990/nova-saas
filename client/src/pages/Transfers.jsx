import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    ArrowRightLeft, 
    Plus, 
    Trash2, 
    Save, 
    Info, 
    ArrowRight,
    Box,
    AlertCircle,
    ChevronRight,
    ShoppingBag,
    History,
    FileText,
    Ban,
    Edit2,
    Calendar,
    Search,
    X,
    Eye,
    Download,
    FileSpreadsheet,
    FileText as FilePdf,
    Barcode,
    Maximize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';

const Transfers = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('nuevo');
    
    // Form State
    const [origenBranch, setOrigenBranch] = useState('');
    const [destinoBranch, setDestinoBranch] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    
    // History State
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const limit = 10;

    // Auxiliary state for adding a product
    const [currentProduct, setCurrentProduct] = useState('');
    const [currentQty, setCurrentQty] = useState(1);
    const [viewingTransfer, setViewingTransfer] = useState(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [quickBarcode, setQuickBarcode] = useState('');
    const [productSearchModal, setProductSearchModal] = useState('');
    
    // Refs for focus management
    const qtyRef = React.useRef(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: catResponse = { data: [] } } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => (await axios.get('/api/categories')).data
    });

    const categories = catResponse.data || [];

    const { data: products = [] } = useQuery({
        queryKey: ['products-all'],
        queryFn: async () => (await axios.get('/api/products', { params: { limit: 1000 } })).data?.data || []
    });

    // Transform products to include category for display (Only active products and authorized for origin branch)
    const productsForSelect = products
        .filter(p => 
            p.status === 'activo' && 
            (!origenBranch || p.branches?.includes(parseInt(origenBranch)))
        )
        .map(p => {
            const cat = categories.find(c => c.id === p.category_id);
            return {
                ...p,
                categoria_nombre: cat ? cat.name : 'Sin categoría',
                displayText: p.nombre
            };
        });

    const { data: transfersData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: loadingTransfers } = useQuery({
        queryKey: ['transfers', historySearch, historyPage],
        queryFn: async () => (await axios.get('/api/inventory/transfers', { 
            params: { search: historySearch, page: historyPage, limit } 
        })).data,
        enabled: activeTab === 'historial'
    });

    // Fetch stock of origin branch when it changes
    const { data: originInventory = [], isLoading: loadingStock } = useQuery({
        queryKey: ['inventory', origenBranch],
        queryFn: async () => {
            if (!origenBranch) return [];
            return (await axios.get('/api/inventory', { params: { branch_id: origenBranch } })).data;
        },
        enabled: !!origenBranch && activeTab === 'nuevo'
    });

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/inventory/transfers', data),
        onSuccess: (response) => {
            const data = response.data;
            toast.success(data.message || 'Traslado completado correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['inventory']);
            queryClient.invalidateQueries(['transfers']);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al procesar el traslado');
        }
    });

    const annulMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/inventory/transfers/${id}`),
        onSuccess: () => {
            toast.success('Traslado anulado correctamente');
            queryClient.invalidateQueries(['inventory']);
            queryClient.invalidateQueries(['transfers']);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al anular el traslado');
        }
    });

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeTab === 'nuevo' && e.key === 'F3') {
                e.preventDefault();
                setIsProductModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab]);

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter') {
            const found = products.find(p => p.codigo === quickBarcode);
            if (found) {
                if (origenBranch && found.branches && !found.branches.includes(parseInt(origenBranch))) {
                    return toast.error('Producto no disponible en la sucursal de origen');
                }
                setCurrentProduct(found.id);
                setQuickBarcode('');
                setCurrentQty(1); // Reset qty to 1 for new item
                setTimeout(() => qtyRef.current?.focus(), 100);
            } else {
                toast.error('Producto no encontrado');
            }
        }
    };

    const exportToExcel = () => {
        if (!transfersData?.data?.length) return;
        const worksheet = XLSX.utils.json_to_sheet(transfersData.data.map(t => ({
            Documento: `TR-${String(t.id).padStart(6, '0')}`,
            Fecha: new Date(t.fecha).toLocaleString(),
            Origen: t.origen_nombre,
            Destino: t.destino_nombre,
            Usuario: t.usuario_nombre,
            Items: t.items_count,
            Estado: t.status
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Traslados");
        XLSX.writeFile(workbook, `Traslados_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = () => {
        if (!transfersData?.data?.length) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte de Traslados de Inventario", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Fecha Reporte: ${new Date().toLocaleString()}`, 14, 30);
        const tableColumn = ["Documento", "Fecha", "Origen", "Destino", "Items", "Estado"];
        const tableRows = transfersData.data.map(t => [
            `TR-${String(t.id).padStart(6, '0')}`,
            new Date(t.fecha).toLocaleString(),
            t.origen_nombre,
            t.destino_nombre,
            t.items_count,
            t.status
        ]);
        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [79, 70, 229] }
        });
        doc.save(`Traslados_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const resetForm = () => {
        setOrigenBranch('');
        setDestinoBranch('');
        setSelectedItems([]);
        setObservaciones('');
    };

    const handleAddItem = () => {
        if (!currentProduct) return toast.error('Seleccione un producto');
        if (!destinoBranch) return toast.error('Seleccione primero la sucursal de destino');
        if (currentQty <= 0) return toast.error('La cantidad debe ser mayor a 0');

        const product = products.find(p => String(p.id) === String(currentProduct));
        
        // Verificar si el producto tiene permiso en la sucursal de destino
        if (!product?.branches?.includes(parseInt(destinoBranch))) {
            return toast.error(`El producto "${product.nombre}" no tiene permiso de acceso a la sucursal de destino`);
        }

        const stockInfo = originInventory.find(i => String(i.product_id) === String(currentProduct));
        const currentStock = stockInfo ? stockInfo.stock : 0;

        // Check if product allows negative stock (puede venir como 1/0 o true/false)
        const permiteExistenciaNegativa = product?.permitir_existencia_negativa == 1;

        if (!permiteExistenciaNegativa && currentStock < currentQty) {
            return toast.error(`Stock insuficiente. Disponible: ${currentStock}`);
        }

        // Check if already in list
        if (selectedItems.find(item => item.product_id === product.id)) {
            return toast.error('El producto ya está en la lista');
        }

        setSelectedItems([...selectedItems, {
            product_id: product.id,
            nombre: product.nombre,
            codigo: product.codigo,
            cantidad: currentQty,
            stockAvailable: currentStock,
            permitir_existencia_negativa: permiteExistenciaNegativa
        }]);

        setCurrentProduct('');
        setCurrentQty(1);
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.product_id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!origenBranch || !destinoBranch) return toast.error('Seleccione origen y destino');
        if (origenBranch === destinoBranch) return toast.error('El origen y destino no pueden ser iguales');
        if (selectedItems.length === 0) return toast.error('Agregue al menos un producto');

        createMutation.mutate({
            origen_branch_id: origenBranch,
            destino_branch_id: destinoBranch,
            observaciones,
            items: selectedItems.map(i => ({ product_id: i.product_id, cantidad: i.cantidad }))
        });
    };

    const inputCls = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium";
    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Traslados de Inventario</h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm text-[Spanish]">Gestión y control de movimientos entre sucursales</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('nuevo')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'nuevo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plus size={14} />
                        Nuevo Traslado
                    </button>
                    <button 
                        onClick={() => setActiveTab('historial')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={14} />
                        Historial
                    </button>
                </div>
            </div>

            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                <ArrowRightLeft size={18} className="text-indigo-600" />
                                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Configuración</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Sucursal de Origen</label>
                                    <select 
                                        value={origenBranch} 
                                        onChange={(e) => { 
                                            setOrigenBranch(e.target.value); 
                                            setSelectedItems([]); 
                                            setCurrentProduct('');
                                        }}
                                        className={inputCls}
                                    >
                                        <option value="">Seleccionar Origen...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-center py-1">
                                    <div className="bg-indigo-50 p-2 rounded-full">
                                        <ChevronRight size={16} className="text-indigo-600 rotate-90 lg:rotate-0" />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Sucursal de Destino</label>
                                    <select 
                                        value={destinoBranch} 
                                        onChange={(e) => setDestinoBranch(e.target.value)}
                                        className={inputCls}
                                    >
                                        <option value="">Seleccionar Destino...</option>
                                        {branches
                                            .filter(b => String(b.id) !== String(origenBranch))
                                            .map(b => (
                                                <option key={b.id} value={b.id}>{b.nombre}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div className="pt-4">
                                    <label className={labelCls}>Observaciones</label>
                                    <textarea 
                                        value={observaciones}
                                        onChange={(e) => setObservaciones(e.target.value)}
                                        placeholder="Motivo del traslado..."
                                        className={`${inputCls} h-24 resize-none`}
                                    />
                                </div>
                            </div>
                        </div>

                        {selectedItems.length > 0 && (
                            <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-600/20 text-white space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium opacity-80 uppercase tracking-widest text-[Spanish]">Total Productos</span>
                                    <span className="text-2xl font-black text-[Spanish]">{selectedItems.length}</span>
                                </div>
                                <button 
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending}
                                    className="w-full bg-white text-indigo-600 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    <span>{createMutation.isPending ? 'Procesando...' : 'Completar Traslado'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <ShoppingBag size={18} className="text-indigo-600" />
                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Agregar Productos</h3>
                                </div>
                            </div>

                            {!origenBranch ? (
                                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                                    <div className="bg-slate-50 p-4 rounded-full">
                                        <AlertCircle size={32} className="text-slate-300" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-400 uppercase text-xs tracking-widest">Atención</p>
                                        <p className="text-slate-500 text-sm mt-1 text-[Spanish]">Selecciona una sucursal de origen para empezar a agregar productos.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-8">
                                        <label className={labelCls}>Producto (CÓDIGO / F3 BUSCAR)</label>
                                        <div className="flex items-stretch">
                                            <div className="relative w-40 shrink-0">
                                                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                <input 
                                                    type="text"
                                                    value={quickBarcode}
                                                    onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())}
                                                    onKeyDown={handleBarcodeSubmit}
                                                    placeholder="CÓDIGO..."
                                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-l-xl border-r-0 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 font-mono text-[11px] font-black transition-all h-[40px]"
                                                />
                                            </div>
                                            <div className="flex-1 px-4 py-2 bg-indigo-50/20 border border-slate-200 rounded-r-xl text-xs font-bold text-slate-700 flex items-center justify-between group overflow-hidden h-[40px]">
                                                <span className={currentProduct ? 'text-indigo-600 truncate' : 'text-slate-400 italic truncate'}>
                                                    {currentProduct ? `${products.find(p => String(p.id) === String(currentProduct))?.nombre} (${products.find(p => String(p.id) === String(currentProduct))?.codigo})` : 'Escanee o busque...'}
                                                </span>
                                                <button 
                                                    onClick={() => setIsProductModalOpen(true)}
                                                    className="ml-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-black transition-all shadow-sm shrink-0"
                                                >
                                                    <Search size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Cantidad</label>
                                        <input 
                                            ref={qtyRef}
                                            type="number" 
                                            min="1" 
                                            value={currentQty}
                                            onChange={(e) => setCurrentQty(parseFloat(e.target.value))}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-black h-[40px]"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <button 
                                            onClick={handleAddItem}
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white h-[40px] rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-xs uppercase tracking-widest"
                                        >
                                            <Plus size={16} />
                                            <span>Agregar</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 font-bold text-[10px] text-slate-500 uppercase tracking-widest">
                                        <th className="px-6 py-4">Código</th>
                                        <th className="px-6 py-4">Producto</th>
                                        <th className="px-6 py-4 text-center">Disponible</th>
                                        <th className="px-6 py-4 text-center">Cantidad a Mover</th>
                                        <th className="px-6 py-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {selectedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                                    <Box size={40} className="opacity-20 mb-2" />
                                                    <p className="text-sm font-medium text-[Spanish]">No hay productos en la lista</p>
                                                    <p className="text-xs uppercase tracking-tighter text-[Spanish]">Agrega productos desde el panel superior</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedItems.map((item) => (
                                            <tr key={item.product_id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{item.codigo}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-slate-900 text-[Spanish]">{item.nombre}</div>
                                                    {item.permitir_existencia_negativa && (
                                                        <span className="text-[10px] text-amber-600 font-bold">(Permite stock negativo)</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-xs font-bold ${item.stockAvailable < 0 || (item.stockAvailable === 0 && item.permitir_existencia_negativa) ? 'text-amber-500' : 'text-slate-500'}`}>{item.stockAvailable}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-sm font-black text-indigo-600">{item.cantidad}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => removeItem(item.product_id)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={18} />
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
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                    {/* Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                value={historySearch}
                                onChange={(e) => { setHistorySearch(e.target.value.toUpperCase()); setHistoryPage(1); }}
                                placeholder="Buscar por documento, sucursal, usuario u observaciones..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm font-bold"
                            />
                            {historySearch && (
                                <button onClick={() => setHistorySearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={16} />
                                </button>
                            )}
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
                            headers={['Documento', 'Fecha', 'Origen', 'Destino', 'Usuario', 'Items', 'Estado', 'Acciones']}
                            data={transfersData?.data || []}
                            isLoading={loadingTransfers}
                            renderRow={(t) => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <FileText size={14} className="text-indigo-600" />
                                            <span className="text-xs font-mono font-black text-slate-700">
                                                TR-{String(t.id).padStart(6, '0')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <Calendar size={14} />
                                            <span className="text-xs font-bold text-[Spanish]">{new Date(t.fecha).toLocaleString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-slate-700 text-[Spanish]">{t.origen_nombre}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-bold text-indigo-600 text-[Spanish]">{t.destino_nombre}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-medium text-slate-500 text-[Spanish]">{t.usuario_nombre}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="bg-slate-100 px-2 py-1 rounded-lg text-xs font-bold text-slate-600">
                                            {t.items_count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            t.status === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-600' : 
                                            t.status === 'ANULADO' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                                        }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => setViewingTransfer(t)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Ver detalle"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {t.status !== 'ANULADO' && (
                                                <>
                                                    <button 
                                                        onClick={() => {
                                                            setOrigenBranch(t.origen_branch_id);
                                                            setDestinoBranch(t.destino_branch_id);
                                                            setObservaciones(`Corrección de traslado TR-${String(t.id).padStart(6, '0')}: ${t.observaciones}`);
                                                            setActiveTab('nuevo');
                                                            toast.info('Cargando datos para corrección. No olvides anular el anterior si es necesario.');
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Editar (Crear copia)"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm('¿Estás seguro de anular este traslado? Esto revertirá el stock en ambas sucursales.')) {
                                                                annulMutation.mutate(t.id);
                                                            }
                                                        }}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                        title="Anular"
                                                    >
                                                        <Ban size={16} />
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
                            totalPages={transfersData?.totalPages || 0}
                            totalItems={transfersData?.totalItems || 0}
                            onPageChange={setHistoryPage}
                            itemsOnPage={transfersData?.data?.length || 0}
                            isLoading={loadingTransfers}
                        />
                    </div>
                </div>
            )}
            
            <TransferDetailModal 
                transfer={viewingTransfer}
                onClose={() => setViewingTransfer(null)}
            />

            {/* Product Selection Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Seleccionar Producto</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Buscar por nombre o código..."
                                    value={productSearchModal}
                                    onChange={(e) => setProductSearchModal(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-2 custom-scrollbar">
                            {products
                                .filter(p => p.status === 'activo' && (!origenBranch || (p.branches && p.branches.includes(parseInt(origenBranch)))))
                                .filter(p => (p.nombre || '').toLowerCase().includes(productSearchModal.toLowerCase()) || (p.codigo || '').toLowerCase().includes(productSearchModal.toLowerCase()))
                                .map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => {
                                            setCurrentProduct(p.id);
                                            setIsProductModalOpen(false);
                                            setProductSearchModal('');
                                        }} 
                                        className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group text-left"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:text-indigo-600 transition-colors">
                                                <Box size={20} />
                                            </div>
                                            <div className="truncate">
                                                <p className="font-black text-slate-900 uppercase text-sm leading-tight truncate">{p.nombre}</p>
                                                <p className="text-[10px] font-mono font-bold text-indigo-400 tracking-wider mt-0.5">{p.codigo}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-right shrink-0">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">Precio</span>
                                                <span className="text-sm font-black text-slate-900">${parseFloat(p.precio_unitario || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                <Maximize2 size={16} />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TransferDetailModal = ({ transfer, onClose }) => {
    const { data: items, isLoading } = useQuery({
        queryKey: ['transfer-detail', transfer?.id],
        queryFn: async () => (await axios.get(`/api/inventory/transfers/${transfer.id}`)).data,
        enabled: !!transfer
    });

    if (!transfer) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-900">Detalle de Traslado</h3>
                            <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                TR-{String(transfer.id).padStart(6, '0')}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">Realizado por {transfer.usuario_nombre} el {new Date(transfer.fecha).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-8 p-6 border-b border-slate-100">
                    <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Sucursal Origen</div>
                        <div className="text-sm font-bold text-slate-700">{transfer.origen_nombre}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase text-indigo-400 mb-1 font-[Spanish]">Sucursal Destino</div>
                        <div className="text-sm font-bold text-indigo-600">{transfer.destino_nombre}</div>
                    </div>
                    {transfer.observaciones && (
                        <div className="col-span-2">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Observaciones</div>
                            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">{transfer.observaciones}</div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest font-[Spanish]">
                            <tr>
                                <th className="px-6 py-4">Producto</th>
                                <th className="px-6 py-4 text-center">Código</th>
                                <th className="px-6 py-4 text-center">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr><td colSpan="3" className="px-6 py-10 text-center text-sm text-slate-400">Cargando ítems...</td></tr>
                            ) : items?.map(item => (
                                <tr key={item.id}>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{item.nombre}</td>
                                    <td className="px-6 py-4 text-center text-xs font-mono font-bold text-slate-500">{item.codigo}</td>
                                    <td className="px-6 py-4 text-center font-black text-indigo-600">{item.cantidad}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Transfers;
