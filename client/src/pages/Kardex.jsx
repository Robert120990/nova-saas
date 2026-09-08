import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Search, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Box, 
    Layers,
    Calendar,
    FileSpreadsheet,
    FileText as FilePdf,
    DollarSign,
    Barcode,
    X,
    Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import Money from '../components/ui/Money';
import PdfViewerModal from '../components/ui/PdfViewerModal';

const Kardex = () => {
    const { user } = useAuth();

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-SV', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-SV', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    };

    const [branchId, setBranchId] = useState(user?.branch_id ? String(user.branch_id) : '');
    const [productId, setProductId] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [quickBarcode, setQuickBarcode] = useState('');
    const [productSearchModal, setProductSearchModal] = useState('');
    const [debouncedModalSearch, setDebouncedModalSearch] = useState('');
    const [modalPage, setModalPage] = useState(1);
    const itemsPerPage = 15;

    // PDF Viewer States
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [pdfError, setPdfError] = useState(null);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: modalProductsData = { data: [], total: 0, totalPages: 0 }, isLoading: isLoadingModalProducts } = useQuery({
        queryKey: ['kardex-products', debouncedModalSearch, branchId, modalPage],
        queryFn: async () => (await axios.get('/api/products', {
            params: { search: debouncedModalSearch || undefined, branch_id: branchId || undefined, limit: 20, page: modalPage }
        })).data,
        enabled: isProductModalOpen
    });
    const modalProducts = modalProductsData.data.filter(p => p.status === 'activo');

    React.useEffect(() => {
        const timer = setTimeout(() => { setDebouncedModalSearch(productSearchModal); setModalPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [productSearchModal]);

    const { data: movements = [], isLoading } = useQuery({
        queryKey: ['kardex', branchId, productId],
        queryFn: async () => {
            if (!branchId || !productId) return [];
            return (await axios.get('/api/inventory/kardex', { params: { branch_id: branchId, product_id: productId } })).data;
        },
        enabled: !!branchId && !!productId
    });

    // Reset page on product/branch/search change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [productId, branchId, searchTerm]);

    // Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setIsProductModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleBarcodeSubmit = async (e) => {
        if (e.key === 'Enter') {
            const code = quickBarcode.trim();
            if (!code) return;
            if (!branchId) return toast.error('Seleccione primero una sucursal');
            try {
                const { data } = await axios.get(`/api/products/lookup/${encodeURIComponent(code)}`, { params: { branch_id: branchId } });
                setProductId(data.id);
                setSelectedProduct(data);
                setQuickBarcode('');
            } catch {
                toast.error('Producto no encontrado');
            }
        }
    };

    // Reset productId if not valid for chosen branch
    React.useEffect(() => {
        if (productId && branchId && selectedProduct?.branches) {
            if (!selectedProduct.branches.includes(parseInt(branchId))) {
                setProductId('');
                setSelectedProduct(null);
            }
        }
    }, [branchId, selectedProduct, productId]);

    // Local Search Filtering
    const filteredMovements = movements.filter(m => 
        m.tipo_documento?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.documento_id?.toString().includes(searchTerm) ||
        m.tipo_movimiento?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate pagination
    const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
    const paginatedMovements = filteredMovements.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Calculate totals based on ALL movements for the product/branch
    const totals = movements.reduce((acc, mov) => {
        if (mov.tipo_movimiento === 'ENTRADA') acc.entradas += parseFloat(mov.cantidad);
        else acc.salidas += parseFloat(mov.cantidad);
        return acc;
    }, { entradas: 0, salidas: 0 });

    const currentStock = totals.entradas - totals.salidas;

    // Get selected product's costo
    const productCosto = selectedProduct?.costo || 0;
    const totalValuation = currentStock * productCosto;

    const handleOpenPdfModal = async () => {
        if (!productId || !branchId || movements.length === 0) return;

        setIsPdfModalOpen(true);
        setIsLoadingPdf(true);
        setPdfError(null);

        try {
            const params = {
                product_id: productId,
                branch_id: branchId
            };

            const response = await axios.get('/api/inventory/kardex-report', {
                params,
                responseType: 'blob'
            });

            if (response.data.type !== 'application/pdf') {
                const text = await response.data.text();
                let errorMsg = 'Error al generar el reporte en formato PDF';
                try {
                    const errObj = JSON.parse(text);
                    errorMsg = errObj.message || errorMsg;
                } catch {}
                throw new Error(errorMsg);
            }

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            const url = URL.createObjectURL(response.data);
            setPdfUrl(url);
        } catch (err) {
            console.error('Error fetching Kardex PDF:', err);
            setPdfError(err.message || 'Ocurrió un error al generar el PDF');
        } finally {
            setIsLoadingPdf(false);
        }
    };

    const exportToExcel = async () => {
        if (!productId || !branchId || movements.length === 0) return;
        try {
            const params = {
                product_id: productId,
                branch_id: branchId,
                format: 'excel'
            };

            const response = await axios.get('/api/inventory/kardex-report', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const prodName = selectedProduct?.codigo || selectedProduct?.nombre || 'Producto';
            link.setAttribute('download', `Kardex_${prodName}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte de Kárdex exportado a Excel correctamente');
        } catch (err) {
            console.error('Error exporting Kardex to Excel:', err);
            toast.error('Error al exportar a Excel');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-3.5 pb-16">
            {/* Encabezado y Acciones */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Consulta de Kardex</h2>
                    <p className="text-slate-500 font-medium text-xs">Historial de movimientos y saldos de inventario</p>
                </div>
                {productId && branchId && movements.length > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                        <button 
                            onClick={exportToExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all border border-emerald-200/60 shadow-xs cursor-pointer"
                            title="Exportar a Excel"
                        >
                            <FileSpreadsheet size={15} />
                            <span>Excel</span>
                        </button>
                        <button 
                            onClick={handleOpenPdfModal}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all border border-rose-200/60 shadow-xs cursor-pointer"
                            title="Visualizar Reporte en PDF"
                        >
                            <FilePdf size={15} />
                            <span>PDF</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Filtros Compactos */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4 lg:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 ml-0.5">
                            Sucursal
                        </label>
                        <select 
                            value={branchId} 
                            onChange={(e) => setBranchId(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all text-xs font-semibold h-[36px]"
                        >
                            <option value="">Seleccionar Sucursal...</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div className="sm:col-span-8 lg:col-span-9">
                        <div className="flex items-center justify-between mb-1 ml-0.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Producto (Código / F3 Buscar)
                            </label>
                            {selectedProduct && (
                                <button
                                    onClick={() => { setProductId(''); setSelectedProduct(null); }}
                                    className="text-[10px] text-slate-400 hover:text-rose-600 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <X size={11} /> Limpiar selección
                                </button>
                            )}
                        </div>
                        <div className="flex items-stretch gap-1.5">
                            <div className="relative w-36 sm:w-44 shrink-0">
                                <Barcode className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input 
                                    type="text"
                                    value={quickBarcode}
                                    onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())}
                                    onKeyDown={handleBarcodeSubmit}
                                    placeholder="ESCANEAR..."
                                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 font-mono text-[11px] font-bold transition-all h-[36px]"
                                />
                            </div>
                            <div 
                                onClick={() => setIsProductModalOpen(true)}
                                className="flex-1 px-3 py-1.5 bg-indigo-50/20 hover:bg-indigo-50/40 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between group overflow-hidden h-[36px] cursor-pointer transition-all"
                            >
                                <span className={productId ? 'text-indigo-700 truncate font-bold text-xs' : 'text-slate-400 italic truncate text-xs font-normal'}>
                                    {selectedProduct ? `${selectedProduct.nombre} (${selectedProduct.codigo})` : 'Seleccione o presione F3 para buscar producto...'}
                                </span>
                                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                    <span className="hidden sm:inline-block px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-mono font-black">F3</span>
                                    <button 
                                        type="button"
                                        className="p-1 bg-indigo-600 text-white rounded-lg group-hover:bg-slate-900 transition-all shadow-xs"
                                        title="Buscar Producto (F3)"
                                    >
                                        <Search size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Selection Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Seleccionar Producto</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"><X size={20} /></button>
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
                            {isLoadingModalProducts ? (
                                <div className="py-16 text-center text-slate-400 text-sm font-medium">Cargando productos...</div>
                            ) : modalProducts.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 text-sm font-medium">No se encontraron productos para esta selección</div>
                            ) : modalProducts.map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => {
                                            setProductId(p.id);
                                            setSelectedProduct(p);
                                            setIsProductModalOpen(false);
                                            setProductSearchModal('');
                                            setModalPage(1);
                                        }} 
                                        className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-50 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group text-left cursor-pointer"
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
                                                <span className="text-sm font-black text-slate-900"><Money value={p.precio_unitario} /></span>
                                            </div>
                                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                                <Maximize2 size={16} />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                        </div>
                        {modalProductsData.totalPages > 1 && (
                            <div className="border-t border-slate-100 p-4">
                                <Pagination 
                                    currentPage={modalPage}
                                    totalPages={modalProductsData.totalPages}
                                    totalItems={modalProductsData.total}
                                    onPageChange={setModalPage}
                                    itemsOnPage={modalProducts.length}
                                    isLoading={isLoadingModalProducts}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tarjetas de Resumen Compactas */}
            {productId && branchId && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in duration-150">
                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-indigo-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 block leading-tight">
                                Saldo Actual
                            </span>
                            <span className="text-lg font-black text-slate-900 leading-tight">
                                {currentStock}
                            </span>
                        </div>
                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Layers size={16} />
                        </div>
                    </div>

                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 block leading-tight">
                                Total Entradas
                            </span>
                            <span className="text-lg font-black text-emerald-700 leading-tight">
                                +{totals.entradas}
                            </span>
                        </div>
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                            <ArrowUpCircle size={16} />
                        </div>
                    </div>

                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-rose-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 block leading-tight">
                                Total Salidas
                            </span>
                            <span className="text-lg font-black text-rose-700 leading-tight">
                                -{totals.salidas}
                            </span>
                        </div>
                        <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                            <ArrowDownCircle size={16} />
                        </div>
                    </div>

                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-amber-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 block leading-tight">
                                Valorización
                            </span>
                            <span className="text-lg font-black text-slate-900 leading-tight">
                                <Money value={totalValuation} />
                            </span>
                        </div>
                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                            <DollarSign size={16} />
                        </div>
                    </div>
                </div>
            )}

            {/* Movements Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {productId && branchId && (
                    <div className="bg-slate-50/60 px-3.5 py-2 border-b border-slate-100 flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-xs sm:max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                placeholder="Filtrar por tipo o doc..."
                                className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-400 transition-all text-xs font-semibold h-[30px]"
                            />
                        </div>
                        <div className="text-[11px] font-bold text-slate-400">
                            {filteredMovements.length} {filteredMovements.length === 1 ? 'movimiento' : 'movimientos'}
                        </div>
                    </div>
                )}
                <Table
                    headers={['Fecha / Hora', 'Tipo', 'Documento', 'Cantidad', 'Precio Venta', 'Costo Unit.', 'Balance']}
                    data={paginatedMovements}
                    isLoading={isLoading}
                    renderRow={(mov, index) => {
                        const overallIndex = (currentPage - 1) * itemsPerPage + index;
                        const balanceAtThisPoint = filteredMovements
                            .slice(overallIndex)
                            .reduce((acc, m) => {
                                if (m.tipo_movimiento === 'ENTRADA') return acc + parseFloat(m.cantidad);
                                return acc - parseFloat(m.cantidad);
                            }, 0);

                        return (
                            <tr key={mov.id} className="hover:bg-indigo-50/20 transition-colors border-b border-slate-100 last:border-0 text-xs">
                                <td className="px-3.5 py-1.5 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={12} className="text-slate-400 shrink-0" />
                                        <div className="flex flex-col leading-tight">
                                            <span className="font-bold text-slate-700 leading-none">{formatDate(mov.created_at)}</span>
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">{formatTime(mov.created_at)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-3.5 py-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                        mov.tipo_movimiento === 'ENTRADA'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                    }`}>
                                        {mov.tipo_movimiento === 'ENTRADA' ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                                        {mov.tipo_movimiento}
                                    </span>
                                </td>
                                <td className="px-3.5 py-1.5 leading-tight">
                                    <div className="font-bold text-slate-800 text-xs truncate max-w-[200px]">{mov.tipo_documento || 'Movimiento'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">Doc #{mov.documento_id}</div>
                                </td>
                                <td className="px-3.5 py-1.5 text-right font-black text-xs">
                                    <span className={mov.tipo_movimiento === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'}>
                                        {mov.tipo_movimiento === 'ENTRADA' ? '+' : '-'}{parseFloat(mov.cantidad || 0)}
                                    </span>
                                </td>
                                <td className="px-3.5 py-1.5 text-right font-bold text-xs text-slate-800">
                                    <Money value={mov.precio_venta ? parseFloat(mov.precio_venta) : parseFloat(mov.current_price || 0)} />
                                </td>
                                <td className="px-3.5 py-1.5 text-right font-semibold text-xs text-slate-600">
                                    <Money value={productCosto} />
                                </td>
                                <td className="px-3.5 py-1.5 text-right">
                                    <span className="font-mono font-black text-xs text-slate-900 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60">
                                        {balanceAtThisPoint}
                                    </span>
                                </td>
                            </tr>
                        );
                    }}
                />
                {!productId || !branchId ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                        <div className="bg-slate-50 p-3 rounded-full">
                            <Box size={28} className="text-slate-300" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-400 uppercase text-[11px] tracking-widest">Esperando Selección</p>
                            <p className="text-slate-500 text-xs mt-0.5">Selecciona un producto y una sucursal para ver los movimientos.</p>
                        </div>
                    </div>
                ) : movements.length === 0 && !isLoading && (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
                        <p className="text-slate-400 text-xs font-medium">No se encontraron movimientos para esta selección</p>
                    </div>
                )}
                {productId && branchId && filteredMovements.length > itemsPerPage && (
                    <div className="border-t border-slate-100 px-2 py-1">
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={filteredMovements.length}
                            onPageChange={setCurrentPage}
                            itemsOnPage={paginatedMovements.length}
                            isLoading={isLoading}
                        />
                    </div>
                )}
            </div>

            {/* Modal de Visualización Interactiva de Reporte PDF */}
            <PdfViewerModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                title="Consulta de Kárdex"
                subtitle={`Producto: [${selectedProduct?.codigo || 'S/C'}] ${selectedProduct?.nombre || ''} • Sucursal: ${branches.find(b => String(b.id) === String(branchId))?.nombre || ''}`}
                badge="Formato Oficial"
                pdfUrl={pdfUrl}
                isLoading={isLoadingPdf}
                loadingText="Generando reporte de Kárdex en formato contable oficial..."
                error={pdfError}
                onRetry={handleOpenPdfModal}
                fileName={`Kardex_${selectedProduct?.codigo || selectedProduct?.nombre || 'Producto'}.pdf`}
                footerNote="Formato contable estándar oficial • Presentación Carta sin firmas"
            />
        </div>
    );
};

export default Kardex;
