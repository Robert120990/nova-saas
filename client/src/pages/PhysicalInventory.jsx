import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Plus, 
    History, 
    FileText, 
    Calendar, 
    Search, 
    Package,
    Save,
    CheckCircle2,
    AlertCircle,
    User,
    GitBranch,
    Loader2,
    RefreshCw,
    Hash,
    Calculator,
    Tags,
    ChevronRight,
    ArrowRightCircle,
    Download,
    FileSpreadsheet,
    FileText as FilePdf,
    TrendingUp,
    Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';

const PhysicalInventory = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('nuevo');
    
    // Header State
    const [branchId, setBranchId] = useState(user?.branch_id || '');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [responsable, setResponsable] = useState(user?.nombre || '');
    const [observaciones, setObservaciones] = useState('');
    
    // Items State
    const [items, setItems] = useState([]);
    const [inventoryId, setInventoryId] = useState(null);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const autoSaveTimerRef = useRef(null);

    // Quick Add Bar State
    const [quickBarcode, setQuickBarcode] = useState('');
    const [quickProd, setQuickProd] = useState(null);
    const [quickCant, setQuickCant] = useState('');
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const barcodeInputRef = useRef(null);
    const qtyInputRef = useRef(null);

    // Detail Grid Filters & Pagination
    const [detailSearch, setDetailSearch] = useState('');
    const [detailPage, setDetailPage] = useState(1);
    const detailLimit = 50;

    // History Filters
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const historyLimit = 10;

    // Category Filter Modal
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: allCategories = [] } = useQuery({
        queryKey: ['categories-all'],
        queryFn: async () => (await axios.get('/api/categories', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: allProducts = [] } = useQuery({
        queryKey: ['products-all'],
        queryFn: async () => (await axios.get('/api/products', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: historyData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: loadingHistory } = useQuery({
        queryKey: ['physical-inventory-history', historySearch, historyPage],
        queryFn: async () => (await axios.get('/api/inventory/physical', { 
            params: { search: historySearch, page: historyPage, limit: historyLimit } 
        })).data,
        enabled: activeTab === 'historial'
    });

    const loadProductsMutation = useMutation({
        mutationFn: async ({ branchId: bid, categoryIds }) => {
            const params = { branch_id: bid };
            if (categoryIds && categoryIds.length > 0) params.category_ids = categoryIds.join(',');
            return (await axios.get('/api/inventory/physical/products', { params })).data;
        },
        onSuccess: (data) => {
            const formatted = data.map(p => {
                const sis = parseFloat(p.stock_sistema || 0);
                return {
                    ...p,
                    stock_fisico: '',
                    diferencia: -sis,
                    total: -sis * parseFloat(p.costo || 0)
                };
            });
            setItems(formatted);
            toast.success(`${formatted.length} productos cargados para auditoría`);
        },
        onError: () => toast.error('Error al cargar productos')
    });

    const saveMutation = useMutation({
        mutationFn: async (payload) => (await axios.post('/api/inventory/physical/save', payload)).data,
        onSuccess: (data) => {
            if (!inventoryId) {
                setInventoryId(data.id);
                toast.success('Borrador de inventario iniciado automáticamente');
                queryClient.invalidateQueries(['physical-inventory-history']);
            }
            setIsAutoSaving(false);
        },
        onError: () => {
            setIsAutoSaving(false);
            toast.error('Error al auto-guardar borradores');
        }
    });

    const applyMutation = useMutation({
        mutationFn: async (id) => (await axios.post(`/api/inventory/physical/${id}/apply`)).data,
        onSuccess: () => {
            toast.success('Inventario aplicado y stock actualizado');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['physical-inventory-history']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al aplicar inventario')
    });
    
    const deleteMutation = useMutation({
        mutationFn: async (id) => (await axios.delete(`/api/inventory/physical/${id}`)).data,
        onSuccess: (data) => {
            toast.success(data.message || 'Inventario eliminado');
            queryClient.invalidateQueries(['physical-inventory-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar inventario')
    });

    // F3 Keyboard Shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                if (activeTab === 'nuevo' && branchId) setIsProductModalOpen(true);
                else if (!branchId) toast.error('Seleccione una sucursal primero');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [branchId, activeTab]);

    const handleBarcodeSubmit = async (e) => {
        if (e.key === 'Enter' && quickBarcode) {
            const searchCode = quickBarcode.trim().toUpperCase();
            const product = allProducts.find(p => 
                p.codigo?.toUpperCase() === searchCode || 
                p.barcode?.toUpperCase() === searchCode
            );
            if (product) {
                if (product.status !== 'activo') return toast.error('Producto inactivo');
                if (branchId && !product.branches?.includes(parseInt(branchId))) return toast.error('Producto no autorizado para esta sucursal');
                
                setQuickProd(product);
                setTimeout(() => qtyInputRef.current?.focus(), 50);
            } else {
                toast.error('Producto no encontrado');
                setQuickBarcode('');
            }
        }
    };

    const handleAddQuick = async () => {
        if (!quickProd || quickCant === '') return;
        
        const fis = parseFloat(quickCant);
        const productId = quickProd.id || quickProd.product_id;

        if (!branchId) {
            toast.error('Seleccione una sucursal primero para registrar stock al item');
            return;
        }

        let stockSistema = 0;
        const existsLocally = items.find(i => i.product_id === productId);

        if (!existsLocally) {
            try {
                // Fetch current stock from system since standard products list doesn't have it
                const searchParam = quickProd.codigo || quickProd.nombre;
                const res = await axios.get('/api/inventory', { params: { branch_id: branchId, search: searchParam } });
                const invItem = res.data.find(inv => inv.product_id === productId);
                if (invItem) {
                    stockSistema = parseFloat(invItem.stock || 0);
                }
            } catch (error) {
                console.error('Error fetching system stock:', error);
            }
        }

        setItems(prev => {
            const exists = prev.find(i => i.product_id === productId);
            if (exists) {
                return prev.map(i => {
                    if (i.product_id === productId) {
                        const previousFis = i.stock_fisico === '' ? 0 : parseFloat(i.stock_fisico || 0);
                        const newFis = previousFis + fis;
                        const updated = { ...i, stock_fisico: newFis.toString() };
                        const sis = parseFloat(updated.stock_sistema || 0);
                        updated.diferencia = newFis - sis;
                        updated.total = updated.diferencia * parseFloat(updated.costo || 0);
                        return updated;
                    }
                    return i;
                });
            } else {
                return [...prev, {
                    product_id: productId,
                    nombre: quickProd.nombre,
                    codigo: quickProd.codigo,
                    costo: quickProd.costo || 0,
                    stock_sistema: stockSistema,
                    stock_fisico: quickCant,
                    diferencia: fis - stockSistema,
                    total: (fis - stockSistema) * (quickProd.costo || 0)
                }];
            }
        });

        setQuickProd(null);
        setQuickBarcode('');
        setQuickCant('');
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
        
        // Trigger immediate save since user requested instant DB update on entry
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => handleAutoSave(), 50);
    };

    const handleSelectProduct = (p) => {
        setQuickProd(p);
        setIsProductModalOpen(false);
        setTimeout(() => qtyInputRef.current?.focus(), 50);
    };

    // Auto-save logic
    useEffect(() => {
        if (items.length > 0) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
                handleAutoSave();
            }, 3000);
        }
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [items, fecha, responsable, observaciones]);

    const handleAutoSave = () => {
        if (!branchId || items.length === 0) return;
        setIsAutoSaving(true);
        saveMutation.mutate({
            id: inventoryId,
            branch_id: branchId,
            fecha,
            responsable,
            observaciones,
            items: items.map(i => ({
                ...i,
                stock_fisico: i.stock_fisico === '' ? null : parseFloat(i.stock_fisico || 0),
                diferencia: parseFloat(i.diferencia || 0),
                total: parseFloat(i.total || 0)
            }))
        });
    };

    const handleLoadProducts = () => {
        if (!branchId) return toast.error('Seleccione una sucursal');
        if (items.length > 0 && !window.confirm('Se perderá el progreso actual. ¿Desea continuar?')) return;
        setSelectedCategoryIds([]);
        setIsCategoryModalOpen(true);
    };

    const handleConfirmLoadProducts = () => {
        setIsCategoryModalOpen(false);
        loadProductsMutation.mutate({ branchId, categoryIds: selectedCategoryIds });
    };

    const toggleCategory = (id) => {
        setSelectedCategoryIds(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleResume = async (id) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/inventory/physical/${id}`);
            const data = response.data;

            setInventoryId(data.id);
            setBranchId(String(data.branch_id));

            const rawFecha = data.fecha;
            const formattedFecha = rawFecha ? new Date(rawFecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            setFecha(formattedFecha);

            setResponsable(data.responsable || '');
            setObservaciones(data.observaciones || '');

            // Only load the saved items — no extra merge with full catalog
            const savedItems = (data.items || []).map(i => ({
                product_id: i.product_id,
                nombre: i.nombre,
                codigo: i.codigo,
                costo: parseFloat(i.costo || 0),
                stock_sistema: parseFloat(i.stock_sistema || 0),
                stock_fisico: i.stock_fisico === 0 ? '0' : (i.stock_fisico ?? ''),
                diferencia: parseFloat(i.diferencia || 0),
                total: parseFloat(i.total || 0)
            }));

            setItems(savedItems);
            setActiveTab('nuevo');
            toast.success(`Conteo #${id} retomado con ${savedItems.length} productos guardados`);
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Error al cargar el inventario';
            const debug = error.response?.data?.debug ? ` (${error.response.data.debug})` : '';
            toast.error(`${msg}${debug}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        if (window.confirm('¿Está seguro de eliminar este borrador de inventario? Esta acción no se puede deshacer.')) {
            deleteMutation.mutate(id);
        }
    };

    const handleExportExcel = async (inv) => {
        try {
            toast.loading('Generando Excel...', { id: 'excel-export' });
            const response = await axios.get(`/api/inventory/physical/${inv.id}`);
            const data = response.data;
            const itemsToExport = data.items || [];

            // Group by category
            const grouped = {};
            itemsToExport.forEach(item => {
                const cat = item.categoria || 'Sin Categoría';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
            });

            const aoa = [];
            aoa.push(['Detalle de Inventario Físico']);
            aoa.push([`ID Conteo: INV-${String(inv.id).padStart(5, '0')}`]);
            aoa.push([`Sucursal: ${inv.branch_name || ''}`]);
            aoa.push([`Responsable: ${inv.responsable || ''}`]);
            aoa.push([]);

            const headerRow = ['Categoría / Código', 'Producto', 'Stock Sistema', 'Stock Físico', 'Diferencia', 'Costo Unitario ($)', 'Total Ajuste ($)'];

            Object.keys(grouped).sort().forEach(cat => {
                const catItems = grouped[cat];
                aoa.push([`CATEGORÍA: ${cat.toUpperCase()}`, '', '', '', '', '', '']);
                aoa.push(headerRow);
                
                catItems.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(i => {
                    aoa.push([
                        i.codigo || '-',
                        i.nombre || '-',
                        parseFloat(i.stock_sistema || 0),
                        i.stock_fisico !== null && i.stock_fisico !== '' ? parseFloat(i.stock_fisico) : 0,
                        parseFloat(i.diferencia || 0),
                        parseFloat(i.costo || 0),
                        parseFloat(i.total || 0)
                    ]);
                });
                
                aoa.push([]); // Separation row
            });

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            
            ws['!cols'] = [
                { wch: 20 }, { wch: 45 }, { wch: 15 }, 
                { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventario Físico");
            XLSX.writeFile(wb, `Inventario_Fisico_${(inv.branch_name || 'Sucursal').replace(/[^a-zA-Z0-9]/g, '_')}_INV${inv.id}.xlsx`);
            
            toast.dismiss('excel-export');
            toast.success('Excel exportado correctamente');
        } catch (error) {
            console.error(error);
            toast.dismiss('excel-export');
            toast.error('Error al exportar inventario a Excel');
        }
    };

    const handleNewInventory = () => {
        setInventoryId(null);
        setBranchId('');
        setFecha(new Date().toISOString().split('T')[0]);
        setResponsable('');
        setObservaciones('');
        setItems([]);
        setActiveTab('nuevo');
    };

    const handleItemChange = (productId, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const updated = { ...item, [field]: value };
                if (field === 'stock_fisico') {
                    const fis = value === '' ? 0 : parseFloat(value || 0);
                    const sis = parseFloat(updated.stock_sistema || 0);
                    updated.diferencia = fis - sis;
                    updated.total = updated.diferencia * parseFloat(updated.costo || 0);
                }
                return updated;
            }
            return item;
        }));
    };

    const resetForm = () => {
        setInventoryId(null);
        setItems([]);
        setObservaciones('');
        setBranchId(user?.branch_id || '');
    };

    const totalDiferencia = items.reduce((acc, i) => acc + (parseFloat(i.total) || 0), 0);
    const totalUnidadesDiferencia = items.reduce((acc, i) => acc + (parseFloat(i.diferencia) || 0), 0);
    const countConteo = items.filter(i => i.stock_fisico !== '').length;

    const filteredItems = React.useMemo(() => {
        if (!detailSearch) return items;
        const lowerSearch = detailSearch.toLowerCase();
        return items.filter(i => 
            i.nombre.toLowerCase().includes(lowerSearch) || 
            (i.codigo && i.codigo.toLowerCase().includes(lowerSearch))
        );
    }, [items, detailSearch]);

    const paginatedItems = React.useMemo(() => {
        const start = (detailPage - 1) * detailLimit;
        return filteredItems.slice(start, start + detailLimit);
    }, [filteredItems, detailPage]);

    const totalDetailPages = Math.ceil(filteredItems.length / detailLimit);

    const inputCls = "w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all text-xs font-black text-slate-700";
    const labelCls = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";

    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        {inventoryId ? `Conteo #${inventoryId}` : 'Inventario Físico'}
                        <span className="text-sm font-black uppercase px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">Auditoría</span>
                    </h1>
                    <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest">Sincronización de existencias reales y ajustes de Kardex.</p>
                </div>
                
                <div className="flex bg-slate-100 p-1.5 rounded-[1.25rem] self-start">
                    <button 
                        onClick={handleNewInventory}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all uppercase flex items-center gap-2 ${activeTab === 'nuevo' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plus size={14} /> Nuevo Conteo
                    </button>
                    <button 
                        onClick={() => setActiveTab('historial')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black tracking-widest transition-all uppercase flex items-center gap-2 ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History size={14} /> Historial
                    </button>
                </div>
            </div>

            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8 space-y-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                                <Calculator size={120} className="text-slate-900" />
                            </div>

                            <div className="space-y-6 relative z-10">
                                <div className="space-y-4">
                                    <div>
                                        <label className={labelCls}><GitBranch size={12} className="text-indigo-500" /> Sucursal</label>
                                        <select 
                                            value={branchId} 
                                            onChange={(e) => setBranchId(e.target.value)}
                                            disabled={items.length > 0}
                                            className={inputCls}
                                        >
                                            <option value="">Seleccionar Sucursal...</option>
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}><Calendar size={12} className="text-indigo-500" /> Fecha Audit.</label>
                                        <input 
                                            type="date" 
                                            value={fecha} 
                                            onChange={(e) => setFecha(e.target.value)}
                                            disabled={items.length > 0 || !!inventoryId}
                                            className={`${inputCls} ${items.length > 0 || !!inventoryId ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}><User size={12} className="text-indigo-500" /> Responsable</label>
                                        <input 
                                            type="text" 
                                            value={responsable} 
                                            onChange={(e) => setResponsable(e.target.value)}
                                            placeholder="Nombre del auditor"
                                            className={inputCls} 
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}><FileText size={12} className="text-indigo-500" /> Notas</label>
                                        <textarea 
                                            value={observaciones}
                                            onChange={(e) => setObservaciones(e.target.value)}
                                            className={`${inputCls} h-24 resize-none`}
                                            placeholder="Observaciones adicionales..."
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleLoadProducts}
                                    disabled={!branchId || loadProductsMutation.isPending || items.length > 0 || !!inventoryId}
                                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                                        items.length > 0 || !!inventoryId 
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed hidden' 
                                        : 'bg-slate-900 text-white shadow-xl hover:bg-slate-800 active:scale-95 disabled:opacity-50'
                                    }`}
                                >
                                    {loadProductsMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                    Cargar Productos
                                </button>
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                    <TrendingUp size={80} />
                                </div>
                                <div className="space-y-6 relative z-10">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-1">
                                            <p className="text-[8.5px] font-black uppercase tracking-widest opacity-60 mb-1">Conteo Actual</p>
                                            <p className="text-xl font-black tracking-tighter">{countConteo} <span className="text-xs opacity-50 text-slate-200 font-bold">/ {items.length}</span></p>
                                        </div>
                                        <div className="col-span-1 border-l border-white/20 pl-4">
                                            <p className="text-[8.5px] font-black uppercase tracking-widest opacity-60 mb-1">Dif. Unids.</p>
                                            <p className="text-xl font-black tracking-tighter">{totalUnidadesDiferencia > 0 ? '+' : ''}{totalUnidadesDiferencia}</p>
                                        </div>
                                        <div className="col-span-2 pt-3 border-t border-white/10">
                                            <p className="text-[8.5px] font-black uppercase tracking-widest opacity-60 mb-1">Desajuste Neto Total</p>
                                            <p className="text-2xl font-black tracking-tighter truncate text-emerald-300" title={`$${totalDiferencia.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}>
                                                ${totalDiferencia.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 py-4 border-t border-white/10 uppercase font-black text-[10px] tracking-widest">
                                        {isAutoSaving ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                <span>Guardando borrador...</span>
                                            </>
                                        ) : inventoryId ? (
                                            <>
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                                <span>Borrador # {inventoryId} Sincronizado</span>
                                            </>
                                        ) : (
                                            <span>Esperando cambios...</span>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => {
                                            if (window.confirm('¿Confirmas que deseas APLICAR este inventario? El stock se ajustará irreversiblemente.')) {
                                                applyMutation.mutate(inventoryId);
                                            }
                                        }}
                                        disabled={!inventoryId || applyMutation.isPending}
                                        className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                    >
                                        {applyMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                        Aplicar Ajustes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        <div className={`bg-white rounded-[2rem] border border-slate-100 shadow-xl p-4 transition-all ${!branchId ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                            <div className="flex items-end gap-3">
                                <div className="flex-1 max-w-[200px]">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Cód. / Escáner</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input 
                                            id="quick-barcode-input"
                                            ref={barcodeInputRef}
                                            type="text"
                                            value={quickBarcode}
                                            onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && quickBarcode) {
                                                    const searchCode = quickBarcode.trim().toUpperCase();
                                                    const product = allProducts.find(p => 
                                                        (p.codigo?.toUpperCase() === searchCode || p.barcode?.toUpperCase() === searchCode) &&
                                                        p.status === 'activo' &&
                                                        p.afecta_inventario === 1 &&
                                                        (!branchId || p.branches?.includes(parseInt(branchId)))
                                                    );
                                                    if (product) {
                                                        setQuickProd(product);
                                                        setTimeout(() => qtyInputRef.current?.focus(), 50);
                                                    } else {
                                                        toast.error('Producto no encontrado o no autorizado');
                                                        setQuickBarcode('');
                                                    }
                                                }
                                            }}
                                            placeholder="SCANNER..."
                                            className="w-full pl-9 pr-4 py-3 bg-slate-50 border-none rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-xs font-black font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Descripción (F3 para buscar)</label>
                                    <div className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-400 truncate h-[44px] flex items-center">
                                        {quickProd?.nombre || 'Presione F3 para buscar manualmente...'}
                                    </div>
                                </div>
                                <div className="w-24">
                                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Cant. Física</label>
                                    <input 
                                        id="quick-qty-input"
                                        ref={qtyInputRef}
                                        type="number"
                                        value={quickCant}
                                        onChange={(e) => setQuickCant(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddQuick()}
                                        onFocus={(e) => e.target.select()}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white border-2 border-indigo-100 rounded-xl outline-none focus:border-indigo-500 transition-all text-sm font-black text-indigo-600 text-center h-[44px]"
                                    />
                                </div>
                                <button 
                                    id="btn-add-quick"
                                    onClick={handleAddQuick}
                                    disabled={!quickProd || quickCant === ''}
                                    className="h-[44px] px-6 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-lg active:scale-95"
                                >
                                    <ArrowRightCircle size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden min-h-[600px] relative flex flex-col">
                            {items.length > 0 ? (
                                <>
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                        <div className="flex-1 max-w-sm relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input 
                                                type="text"
                                                value={detailSearch}
                                                onChange={(e) => { setDetailSearch(e.target.value); setDetailPage(1); }}
                                                placeholder="Buscar por código o descripción..."
                                                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all text-xs font-bold text-slate-700 placeholder:text-slate-400"
                                            />
                                        </div>
                                        <div className="text-xs font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100">
                                            {filteredItems.length} Resultados
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto flex-1">
                                        <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Producto</th>
                                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistema</th>
                                                <th className="px-6 py-4 text-center text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] bg-indigo-50/30">Físico</th>
                                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Dif.</th>
                                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Costo</th>
                                                <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {paginatedItems.map((item) => (
                                                <tr key={item.product_id} className="hover:bg-slate-50/50 transition-colors group text-sm">
                                                    <td className="px-6 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-mono font-black text-indigo-500 mb-0.5">#{item.codigo}</span>
                                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{item.nombre}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="text-xs font-black text-slate-400">{item.stock_sistema}</span>
                                                    </td>
                                                    <td className="px-6 py-3 bg-indigo-50/20">
                                                        <input 
                                                            type="number"
                                                            value={item.stock_fisico}
                                                            onChange={(e) => handleItemChange(item.product_id, 'stock_fisico', e.target.value)}
                                                            className="w-20 bg-white border border-indigo-100 rounded-lg px-2 py-1 text-center text-xs font-black text-indigo-700 outline-none focus:border-indigo-400 shadow-sm"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className={`text-xs font-black ${item.diferencia === 0 ? 'text-slate-300' : item.diferencia > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {item.diferencia > 0 ? '+' : ''}{item.diferencia}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="text-xs font-bold text-slate-400">${item.costo}</span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className={`text-xs font-black ${item.total === 0 ? 'text-slate-300' : item.total > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            ${Math.abs(item.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {paginatedItems.length === 0 && (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-12 text-center">
                                                        <Search className="mx-auto text-slate-300 mb-3" size={32} />
                                                        <p className="text-slate-500 font-bold text-sm">No se encontraron productos en el conteo</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {totalDetailPages > 1 && (
                                    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-[10px] font-black uppercase text-slate-400">
                                        <button 
                                            onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                                            disabled={detailPage === 1}
                                            className="px-5 py-2.5 disabled:opacity-30 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-xl transition-all flex items-center gap-2 text-slate-600"
                                        >Anterior</button>
                                        <span>Página {detailPage} de {totalDetailPages}</span>
                                        <button 
                                            onClick={() => setDetailPage(p => Math.min(totalDetailPages, p + 1))}
                                            disabled={detailPage === totalDetailPages}
                                            className="px-5 py-2.5 disabled:opacity-30 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-xl transition-all flex items-center gap-2 text-slate-600"
                                        >Siguiente</button>
                                    </div>
                                )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[600px] gap-6 text-center px-12">
                                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <RefreshCw size={48} className="text-slate-200" />
                                    </div>
                                    <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em] leading-relaxed max-w-xs">
                                        Use el botón "Cargar Productos" para traer todo el catálogo o escanee el primer producto para iniciar manualmente.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Tab Historial (Existing) */
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                placeholder="Buscar por responsable o sucursal..."
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-bold"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                        <Table 
                            headers={['ID', 'Fecha', 'Sucursal', 'Responsable', 'Items', 'Estado', 'Acciones']}
                            data={historyData.data}
                            isLoading={loadingHistory}
                            renderRow={(inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0 text-sm">
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-mono font-black text-indigo-500">INV-{String(inv.id).padStart(5, '0')}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-bold text-slate-600">{new Date(inv.fecha).toLocaleDateString()}</span>
                                    </td>
                                    <td className="px-8 py-5 font-black text-slate-700">{inv.branch_name}</td>
                                    <td className="px-8 py-5 font-bold text-slate-600">{inv.responsable}</td>
                                    <td className="px-8 py-5">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs font-black text-slate-500">{inv.items_count} Prod.</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${inv.status === 'APLICADO' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleExportExcel(inv)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all text-[10px] font-black uppercase"
                                            title="Exportar Detalle a Excel"
                                        >
                                            <FileSpreadsheet size={14} />
                                        </button>
                                        {inv.status === 'PENDIENTE' && (
                                            <>
                                                <button 
                                                    onClick={() => handleResume(inv.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase"
                                                >
                                                    <RefreshCw size={14} />
                                                    Resumir
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(inv.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all text-[10px] font-black uppercase"
                                                    title="Eliminar borrador"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all">
                                            <ChevronRight size={20} />
                                        </button>
                                    </td>
                                </tr>
                            )}
                        />
                        <Pagination 
                            currentPage={historyPage}
                            totalPages={historyData.totalPages}
                            totalItems={historyData.totalItems}
                            onPageChange={setHistoryPage}
                            itemsOnPage={historyData.data.length}
                            isLoading={loadingHistory}
                        />
                    </div>
                </div>
            )}

            {/* Product Modal */}
            <Modal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                title="Buscador de Productos (F3)"
                size="4xl"
            >
                <div className="p-6 space-y-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            id="modal-product-search"
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Buscar por nombre o código..."
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm font-bold"
                            autoFocus
                        />
                    </div>
                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {allProducts
                                    .filter(p => p.status === 'activo' && p.afecta_inventario === 1)
                                    .filter(p => !branchId || p.branches?.includes(parseInt(branchId)))
                                    .filter(p => !productSearch || p.nombre.toLowerCase().includes(productSearch.toLowerCase()) || p.codigo.toLowerCase().includes(productSearch.toLowerCase()))
                                    .slice(0, 50)
                                    .map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-all group">
                                            <td className="px-8 py-4 font-mono font-black text-indigo-500 text-xs">#{p.codigo}</td>
                                            <td className="px-8 py-4 font-bold text-slate-700 text-xs">{p.nombre}</td>
                                            <td className="px-8 py-4 text-right">
                                                <button 
                                                    id={`btn-select-prod-${p.id}`}
                                                    onClick={() => handleSelectProduct(p)}
                                                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            {/* Category Filter Modal */}
            <Modal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                title="Seleccionar Categorías a Cargar"
                size="2xl"
            >
                <div className="p-6 space-y-5">
                    <p className="text-sm text-slate-500 font-medium">
                        Selecciona las categorías cuyos productos deseas incluir en este conteo. Si no seleccionas ninguna, se cargarán <strong>todas las categorías</strong>.
                    </p>

                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={() => setSelectedCategoryIds(allCategories.map(c => c.id))}
                            className="px-3 py-1.5 text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                        >
                            Seleccionar Todas
                        </button>
                        <button
                            onClick={() => setSelectedCategoryIds([])}
                            className="px-3 py-1.5 text-[10px] font-black uppercase bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"
                        >
                            Limpiar
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
                        {allCategories.length === 0 ? (
                            <p className="col-span-2 text-center text-slate-400 text-sm py-8">No hay categorías registradas</p>
                        ) : (
                            allCategories.map(cat => {
                                const selected = selectedCategoryIds.includes(cat.id);
                                return (
                                    <label
                                        key={cat.id}
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                            selected
                                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                            selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                                        }`}>
                                            {selected && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-xs font-bold truncate">{cat.name}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <span className="text-xs text-slate-400 font-medium">
                            {selectedCategoryIds.length === 0
                                ? 'Se cargarán todas las categorías'
                                : `${selectedCategoryIds.length} categoría(s) seleccionada(s)`}
                        </span>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmLoadProducts}
                                disabled={loadProductsMutation.isPending}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {loadProductsMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                                Cargar Productos
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PhysicalInventory;
