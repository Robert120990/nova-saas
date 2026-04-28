import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    History, 
    Search, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Box, 
    Filter,
    Store,
    Layers,
    Calendar,
    Download,
    FileSpreadsheet,
    FileText as FilePdf,
    DollarSign,
    Barcode,
    Plus,
    X,
    Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';

const Kardex = () => {
    const formatDateTime = (dateString) => {
        if (!dateString) return '---';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-SV', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(date);
    };

    const [branchId, setBranchId] = useState('');
    const [productId, setProductId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [quickBarcode, setQuickBarcode] = useState('');
    const [productSearchModal, setProductSearchModal] = useState('');
    const itemsPerPage = 10;

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products-all'],
        queryFn: async () => (await axios.get('/api/products', { params: { limit: 5000 } })).data?.data || []
    });

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

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter') {
            const found = products.find(p => p.codigo === quickBarcode);
            if (found) {
                if (branchId && found.branches && !found.branches.includes(parseInt(branchId))) {
                    return toast.error('Producto no disponible en esta sucursal');
                }
                setProductId(found.id);
                setQuickBarcode('');
            } else {
                toast.error('Producto no encontrado');
            }
        }
    };

    // Reset productId if not valid for chosen branch
    React.useEffect(() => {
        if (productId && branchId) {
            const product = products.find(p => String(p.id) === String(productId));
            if (product && !product.branches?.includes(parseInt(branchId))) {
                setProductId('');
            }
        }
    }, [branchId, products, productId]);

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
    const selectedProduct = products.find(p => String(p.id) === String(productId));
    const productCosto = selectedProduct?.costo || 0;
    const totalValuation = currentStock * productCosto;

    const exportToExcel = () => {
        if (movements.length === 0) return;
        
        const worksheet = XLSX.utils.json_to_sheet(movements.map((m, index) => {
            const balanceAtThisPoint = movements
                .slice(index)
                .reduce((acc, mov) => {
                    if (mov.tipo_movimiento === 'ENTRADA') return acc + parseFloat(mov.cantidad);
                    return acc - parseFloat(mov.cantidad);
                }, 0);

            return {
                Fecha: formatDateTime(m.created_at),
                Tipo: m.tipo_movimiento,
                Documento: `${m.tipo_documento} #${m.documento_id}`,
                Cantidad: m.cantidad,
                Precio: `$${(parseFloat(m.precio_venta || m.current_price)).toFixed(2)}`,
                Costo: `$${(parseFloat(productCosto)).toFixed(2)}`,
                Balance: balanceAtThisPoint
            };
        }));
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Kardex");
        XLSX.writeFile(workbook, `Kardex_${selectedProduct?.nombre || 'Producto'}.xlsx`);
    };

    const exportToPDF = () => {
        if (movements.length === 0) return;

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte de Kardex", 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Producto: ${selectedProduct?.nombre}`, 14, 30);
        doc.text(`Sucursal: ${branches.find(b => String(b.id) === String(branchId))?.nombre || ''}`, 14, 35);
        doc.text(`Fecha Reporte: ${formatDateTime(new Date())}`, 14, 40);

        const tableColumn = ["Fecha", "Tipo", "Documento", "Cant.", "Precio", "Costo", "Balance"];
        const tableRows = movements.map((m, index) => {
            const balanceAtThisPoint = movements
                .slice(index)
                .reduce((acc, mov) => {
                    if (mov.tipo_movimiento === 'ENTRADA') return acc + parseFloat(mov.cantidad);
                    return acc - parseFloat(mov.cantidad);
                }, 0);

            return [
                formatDateTime(m.created_at),
                m.tipo_movimiento,
                `${m.tipo_documento} #${m.documento_id}`,
                m.cantidad,
                `$${(parseFloat(m.precio_venta || m.current_price)).toFixed(2)}`,
                `$${(parseFloat(productCosto)).toFixed(2)}`,
                balanceAtThisPoint
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            styles: { fontSize: 7 },
            headStyles: { fillColor: [79, 70, 229] }
        });

        doc.save(`Kardex_${selectedProduct?.nombre || 'Producto'}.pdf`);
    };

    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1";
    const cardCls = "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm";

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Consulta de Kardex</h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm text-[Spanish]">Historial de movimientos y saldos de inventario</p>
                </div>
                {productId && branchId && movements.length > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-2">
                        <button 
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm shadow-emerald-600/5 h-[42px]"
                        >
                            <FileSpreadsheet size={16} />
                            Excel
                        </button>
                        <button 
                            onClick={exportToPDF}
                            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all border border-rose-100 shadow-sm shadow-rose-600/5 h-[42px]"
                        >
                            <FilePdf size={16} />
                            PDF
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className={cardCls}>
                <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                    <Filter size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Filtros de Búsqueda</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                    <div className="lg:col-span-4">
                        <label className={labelCls}>Sucursal</label>
                        <select 
                            value={branchId} 
                            onChange={(e) => setBranchId(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-bold h-[40px]"
                        >
                            <option value="">Seleccionar Sucursal...</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-8">
                        <label className={labelCls}>Producto (Código / F3 Buscar)</label>
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
                                <span className={productId ? 'text-indigo-600 truncate' : 'text-slate-400 italic truncate'}>
                                    {selectedProduct ? `${selectedProduct.nombre} (${selectedProduct.codigo})` : 'Seleccione o escanee un producto'}
                                </span>
                                <button 
                                    onClick={() => setIsProductModalOpen(true)}
                                    className="ml-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-black transition-all shadow-sm shrink-0"
                                    title="Buscar Producto (F3)"
                                >
                                    <Search size={12} />
                                </button>
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
                                .filter(p => p.status === 'activo' && (!branchId || (p.branches && p.branches.includes(parseInt(branchId)))))
                                .filter(p => (p.nombre || '').toLowerCase().includes(productSearchModal.toLowerCase()) || (p.codigo || '').toLowerCase().includes(productSearchModal.toLowerCase()))
                                .map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => {
                                            setProductId(p.id);
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

            {productId && branchId && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/20 text-white">
                        <div className="flex items-center justify-between mb-1">
                            <Layers size={16} className="opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Saldo Actual</span>
                        </div>
                        <div className="text-xl font-black">{currentStock}</div>
                    </div>
                    <div className="bg-emerald-500 p-4 rounded-2xl shadow-lg shadow-emerald-500/20 text-white">
                        <div className="flex items-center justify-between mb-1">
                            <ArrowUpCircle size={16} className="opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Total Entradas</span>
                        </div>
                        <div className="text-xl font-black text-[Spanish]">{totals.entradas}</div>
                    </div>
                    <div className="bg-rose-500 p-4 rounded-2xl shadow-lg shadow-rose-500/20 text-white">
                        <div className="flex items-center justify-between mb-1">
                            <ArrowDownCircle size={16} className="opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Total Salidas</span>
                        </div>
                        <div className="text-xl font-black text-[Spanish]">{totals.salidas}</div>
                    </div>
                    <div className="bg-amber-500 p-4 rounded-2xl shadow-lg shadow-amber-500/20 text-white">
                        <div className="flex items-center justify-between mb-1">
                            <DollarSign size={16} className="opacity-80" />
                            <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">Valorización</span>
                        </div>
                        <div className="text-xl font-black text-[Spanish] tracking-tight">
                            ${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            )}

            {/* Movements Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                {productId && branchId && (
                    <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                placeholder="Buscar en movimientos..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-bold"
                            />
                        </div>
                    </div>
                )}
                <Table
                    headers={['Fecha', 'Tipo', 'Documento', 'Cantidad', 'Precio', 'Costo', 'Balance']}
                    data={paginatedMovements}
                    isLoading={isLoading}
                    renderRow={(mov, index) => {
                        // Calculate running balance for each row (needs to consider the full list for correct index calculation)
                        const overallIndex = (currentPage - 1) * itemsPerPage + index;
                        const balanceAtThisPoint = filteredMovements
                            .slice(overallIndex)
                            .reduce((acc, m) => {
                                if (m.tipo_movimiento === 'ENTRADA') return acc + parseFloat(m.cantidad);
                                return acc - parseFloat(m.cantidad);
                            }, 0);

                        return (
                            <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <Calendar size={14} />
                                        <span className="text-xs font-bold whitespace-nowrap">{formatDateTime(mov.created_at)}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                        mov.tipo_movimiento === 'ENTRADA'
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                            : 'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                        {mov.tipo_movimiento}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-xs font-bold text-slate-600">{mov.tipo_documento}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">#{mov.documento_id}</div>
                                </td>
                                <td className="px-6 py-4 font-black text-sm text-slate-700">
                                    {mov.tipo_movimiento === 'ENTRADA' ? '+' : '-'}{mov.cantidad}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-slate-900">
                                        ${mov.precio_venta ? parseFloat(mov.precio_venta).toFixed(2) : parseFloat(mov.current_price).toFixed(2)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-slate-600">
                                        ${parseFloat(productCosto).toFixed(2)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl text-[Spanish]">
                                        {balanceAtThisPoint}
                                    </span>
                                </td>
                            </tr>
                        );
                    }}
                />
                {!productId || !branchId ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="bg-slate-50 p-4 rounded-full">
                            <Box size={40} className="text-slate-200" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-400 uppercase text-xs tracking-widest text-[Spanish]">Esperando Selección</p>
                            <p className="text-slate-500 text-sm mt-1 text-[Spanish]">Selecciona un producto y una sucursal para ver los movimientos.</p>
                        </div>
                    </div>
                ) : movements.length === 0 && !isLoading && (
                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                        <p className="text-slate-400 text-sm font-medium">No se encontraron movimientos para esta selección</p>
                    </div>
                )}
                {productId && branchId && filteredMovements.length > itemsPerPage && (
                    <div className="border-t border-slate-100">
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
        </div>
    );
};

export default Kardex;
