import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    X, ChevronRight, Trash2, FileText, History,
    Edit3, Search, Link2, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import Money from '../ui/Money';
import Pagination from '../ui/Pagination';
import { formatDate, getTodayString } from '../../utils/dateUtils';

/**
 * PosLinkedDocModal Component
 * References modal for DTEs (F9 shortcut).
 * Handles Notas de Crédito (DTE-05), Comprobantes de Retención (DTE-07),
 * document lookup with full server-side search and pagination, automatic discount prorating,
 * and manual document linking.
 */
const PosLinkedDocModal = ({
    isOpen,
    onClose,
    tipoDte,
    customerId,
    linkedDocs = [],
    setLinkedDocs,
    setReferencingSale,
    setCart,
    setGeneralDiscount,
    setGeneralDiscountPercentage
}) => {
    const [activeTab, setActiveTab] = useState('customer'); // 'customer' | 'manual'
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterDocType, setFilterDocType] = useState('all'); // 'all' | '03' | '01'
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);
    const [loadingSaleId, setLoadingSaleId] = useState(null);

    // Form inputs state for manual entry / CR
    const [docType, setDocType] = useState('01');
    const [genType, setGenType] = useState('2');
    const [docNumber, setDocNumber] = useState('');
    const [emissionDate, setEmissionDate] = useState(() => getTodayString());
    const [montoGravado, setMontoGravado] = useState('');
    const [ivaRetenido, setIvaRetenido] = useState('');

    // Debounce search input (350ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset pagination when doc type filter changes
    const handleFilterDocTypeChange = (newType) => {
        setFilterDocType(newType);
        setPage(1);
    };

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setDebouncedSearch('');
            setFilterDocType('all');
            setPage(1);
            setDocNumber('');
            setEmissionDate(getTodayString());
            setMontoGravado('');
            setIvaRetenido('');
            setDocType(tipoDte === '05' ? '01' : '01');
            setGenType('2');
            if (tipoDte === '05') {
                setActiveTab(customerId ? 'customer' : 'manual');
            }
        }
    }, [isOpen, tipoDte, customerId]);

    // Escape key listener to close modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Server-side query for customer sales with pagination, server search, and type filter
    const {
        data: salesResponse = { data: [], total: 0, totalPages: 1 },
        isLoading: isLoadingSales,
        isFetching: isFetchingSales,
        refetch: refetchSales
    } = useQuery({
        queryKey: ['pos-customer-sales', customerId, debouncedSearch, filterDocType, page, limit],
        queryFn: async () => {
            const docTypeParam = filterDocType === 'all' ? '01,03,07' : filterDocType;
            const res = await axios.get('/api/sales', {
                params: {
                    customer_id: customerId,
                    status: 'emitido',
                    only_processed: 'true',
                    exclude_has_nc: 'true',
                    tipo_documento: docTypeParam,
                    search: debouncedSearch.trim() || undefined,
                    page,
                    limit
                }
            });
            return res.data || { data: [], total: 0, totalPages: 1 };
        },
        enabled: isOpen && tipoDte === '05' && !!customerId
    });

    const customerSales = Array.isArray(salesResponse?.data) ? salesResponse.data : [];
    const totalSales = salesResponse?.total || 0;
    const totalPages = salesResponse?.totalPages || 1;

    if (!isOpen) return null;

    const handleSelectSale = async (sale) => {
        if (loadingSaleId) return;
        setLoadingSaleId(sale.id);
        try {
            const { data: fullSale } = await axios.get(`/api/sales/${sale.id}`);
            setReferencingSale(fullSale);
            const refDoc = fullSale.codigo_generacion || sale.codigo_generacion || fullSale.numero_control || sale.numero_control || sale.dte_control || sale.id.toString();
            const isElectronic = !!(fullSale.codigo_generacion || sale.codigo_generacion);

            // Prorratear descuento general si la venta original tuvo alguno
            const origGenDiscount = parseFloat(fullSale.descuento_general) || 0;
            const saleItems = fullSale.items || [];

            let totalGravBase = 0;
            const itemBases = saleItems.map(item => {
                const qty = parseFloat(item.cantidad) || 0;
                const price = parseFloat(item.precio_unitario) || 0;
                const disc = parseFloat(item.monto_descuento) || 0;
                const isExento = item.venta_exenta > 0;
                const lineBase = isExento ? 0 : Math.max(0, (qty * price) - disc);
                totalGravBase += lineBase;
                return lineBase;
            });

            let allocatedDisc = 0;
            const gravCount = itemBases.filter(b => b > 0).length;
            let currentGravIndex = 0;

            // Cargar items al carrito con sus descuentos correspondientes
            const newItems = saleItems.map((item, idx) => {
                const qty = parseFloat(item.cantidad) || 0;
                const price = parseFloat(item.precio_unitario) || 0;
                const origItemDisc = parseFloat(item.monto_descuento) || 0;
                const lineBase = itemBases[idx];

                let prorratedGenDisc = 0;
                if (origGenDiscount > 0 && lineBase > 0) {
                    currentGravIndex++;
                    if (currentGravIndex === gravCount) {
                        prorratedGenDisc = Math.max(0, Math.round((origGenDiscount - allocatedDisc) * 100) / 100);
                    } else {
                        const share = totalGravBase > 0 ? (lineBase / totalGravBase) : (1 / gravCount);
                        prorratedGenDisc = Math.round((origGenDiscount * share) * 100) / 100;
                        allocatedDisc += prorratedGenDisc;
                    }
                }

                const totalItemDisc = Math.round((origItemDisc + prorratedGenDisc) * 100) / 100;
                const unitDisc = qty > 0 ? (totalItemDisc / qty) : 0;

                return {
                    id: item.product_id,
                    nombre: item.descripcion,
                    codigo: item.codigo,
                    precio: price,
                    originalPrice: price,
                    cantidad: qty,
                    originalQty: qty,
                    descuento: totalItemDisc,
                    unitDiscount: unitDisc,
                    exento: item.venta_exenta > 0,
                    isManual: !item.product_id,
                    referencedDoc: refDoc
                };
            });
            setCart(newItems);
            setGeneralDiscount(0);
            setGeneralDiscountPercentage(null);

            // Vincular documento
            setLinkedDocs([{
                doc_type: sale.dte_type,
                doc_number: refDoc,
                control_number: fullSale.numero_control || sale.numero_control || sale.dte_control || null,
                emission_date: sale.fecha_emision ? sale.fecha_emision.split('T')[0] : getTodayString(),
                generation_type: isElectronic ? 1 : 2,
                orig_iva_retenido: parseFloat(fullSale.iva_retenido || sale.iva_retenido || 0),
                orig_iva_percibido: parseFloat(fullSale.iva_percibido || sale.iva_percibido || 0)
            }]);

            onClose();
            toast.success('Documento referenciado y productos cargados');
        } catch (error) {
            console.error('Error al cargar detalle del documento:', error);
            toast.error('Error al cargar detalle del documento');
        } finally {
            setLoadingSaleId(null);
        }
    };

    const handleManualLink = () => {
        const num = docNumber.trim().toUpperCase();
        if (!num) return toast.error('El número es obligatorio');
        if (!emissionDate) return toast.error('La fecha del documento es obligatoria');

        const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(num);
        const genVal = genType ? parseInt(genType) : (isUUID ? 1 : 2);

        setLinkedDocs([...linkedDocs, {
            doc_type: docType,
            doc_number: num,
            emission_date: emissionDate,
            generation_type: genVal
        }]);
        setDocNumber('');
        toast.success('Documento referenciado manualmente');
    };

    const handleCrLink = async () => {
        const num = docNumber.trim().toUpperCase();
        const grav = parseFloat(montoGravado) || 0;
        const ret = parseFloat(ivaRetenido) || 0;

        if (!num) return toast.error('El número de documento es obligatorio');
        if (!emissionDate) return toast.error('La fecha del documento es obligatoria');

        const todayStr = getTodayString();
        const currentPeriod = todayStr.substring(0, 7);
        const docPeriod = emissionDate.substring(0, 7);

        if (docPeriod !== currentPeriod) {
            return toast.error(`El documento a retener debe corresponder al mismo período tributario (${currentPeriod}). Hacienda rechaza comprobantes de retención para documentos de otros meses.`);
        }
        if (emissionDate > todayStr) {
            return toast.error('La fecha del documento a retener no puede ser una fecha futura');
        }
        if (grav < 100) return toast.error('El monto gravado debe ser mayor o igual a $100.00');
        if (ret <= 0) return toast.error('La retención debe ser mayor a $0.00');

        if (linkedDocs.some(d => d.doc_number === num && d.doc_type === docType)) {
            return toast.error('Este documento ya fue agregado al CR');
        }

        try {
            const { data: checkData } = await axios.get(`/api/sales/check-cr?doc_number=${encodeURIComponent(num)}&doc_type=${docType}`);
            if (checkData.exists) {
                return toast.error(`Ya existe un Comprobante de Retención para el documento ${num}`);
            }
        } catch (err) {
            console.warn('No se pudo verificar CR existente:', err.message);
        }

        const dteName = docType === '01' ? 'Factura' : docType === '03' ? 'Créd. Fiscal' : 'DTE ' + docType;
        const descripcion = `RETENCION IVA 1% AL DOCUMENTO ${num} (${dteName})`;

        setLinkedDocs([...linkedDocs, {
            doc_type: docType,
            doc_number: num,
            emission_date: emissionDate,
            generation_type: parseInt(genType) || 2,
            montoSujeto: grav,
            ivaRetenido: ret,
            descripcion
        }]);

        setDocNumber('');
        setMontoGravado('');
        setIvaRetenido('');
        toast.success('Documento agregado');
    };

    const handleRemoveLinkedDoc = (idx) => {
        setLinkedDocs(linkedDocs.filter((_, i) => i !== idx));
        toast.info('Documento desvinculado');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-xs shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Referencias Documentales</h3>
                            <p className="text-xs text-slate-500 font-medium line-clamp-1">
                                {tipoDte === '05'
                                    ? 'Seleccione el documento original para la Nota de Crédito'
                                    : tipoDte === '07'
                                    ? 'Agregue los documentos sujetos a retención (DTE-07)'
                                    : 'Vincule documentos de referencia a la transacción actual'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Cerrar (Esc)"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                    {/* Tabs when Nota de Crédito */}
                    {tipoDte === '05' && (
                        <div className="flex p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveTab('customer')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                                    activeTab === 'customer'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <History size={14} />
                                <span>Documentos del Cliente</span>
                                {totalSales > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                        activeTab === 'customer' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {totalSales}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('manual')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all ${
                                    activeTab === 'manual'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Edit3 size={14} />
                                <span>Entrada Manual</span>
                            </button>
                        </div>
                    )}

                    {/* Customer Documents Tab for NC */}
                    {tipoDte === '05' && activeTab === 'customer' && (
                        <div className="space-y-3">
                            {!customerId ? (
                                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500">
                                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
                                    <p className="text-xs font-bold">No hay un cliente seleccionado en la venta</p>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Seleccione un cliente para ver sus documentos previos, o ingrese la referencia en la pestaña Entrada Manual.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Search bar and Filters */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="Buscar por número, código de generación o fecha..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                            {searchTerm && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchTerm('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleFilterDocTypeChange('all')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                                    filterDocType === 'all'
                                                        ? 'bg-slate-900 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                Todos
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleFilterDocTypeChange('03')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                                    filterDocType === '03'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                Créd. Fiscal
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleFilterDocTypeChange('01')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                                    filterDocType === '01'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                Factura
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => refetchSales()}
                                                disabled={isFetchingSales}
                                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Recargar"
                                            >
                                                <RefreshCw size={13} className={isFetchingSales ? 'animate-spin text-indigo-600' : ''} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* List / Loading / Empty */}
                                    {isLoadingSales ? (
                                        <div className="p-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                                            <Loader2 size={24} className="animate-spin text-indigo-600" />
                                            <span>Buscando documentos del cliente...</span>
                                        </div>
                                    ) : customerSales.length === 0 ? (
                                        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 text-xs font-bold">
                                            {debouncedSearch
                                                ? `No se encontraron documentos que coincidan con "${debouncedSearch}".`
                                                : 'No se encontraron facturas o créditos fiscales previos para este cliente.'}
                                            <div className="mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('manual')}
                                                    className="text-indigo-600 hover:underline text-xs font-black"
                                                >
                                                    Ingresar referencia manualmente &rarr;
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="max-h-60 sm:max-h-64 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl divide-y divide-slate-100">
                                                {customerSales.map((sale) => (
                                                    <button
                                                        key={sale.id}
                                                        type="button"
                                                        disabled={!!loadingSaleId}
                                                        onClick={() => handleSelectSale(sale)}
                                                        className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-indigo-50/70 transition-colors text-left group disabled:opacity-50"
                                                    >
                                                        <div className="min-w-0 pr-3">
                                                            <div className="font-black text-slate-900 text-xs tracking-tight group-hover:text-indigo-600 transition-colors truncate">
                                                                {sale.tipo_documento_name} - {sale.numero_control || sale.dte_control || sale.codigo_generacion || `ID: ${sale.id}`}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                                {formatDate(sale.fecha_emision)} • TOTAL: <Money value={sale.total_pagar} />
                                                            </div>
                                                        </div>
                                                        {loadingSaleId === sale.id ? (
                                                            <Loader2 size={16} className="text-indigo-600 animate-spin shrink-0" />
                                                        ) : (
                                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Pagination */}
                                            <Pagination
                                                currentPage={page}
                                                totalPages={totalPages}
                                                totalItems={totalSales}
                                                itemsOnPage={customerSales.length}
                                                onPageChange={setPage}
                                                isLoading={isFetchingSales}
                                                limit={limit}
                                                onLimitChange={(newLim) => {
                                                    setLimit(newLim);
                                                    setPage(1);
                                                }}
                                            />
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Comprobante de Retención (07) */}
                    {tipoDte === '07' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo de Documento</label>
                                    <select
                                        value={docType}
                                        onChange={(e) => setDocType(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="01">Factura (01)</option>
                                        <option value="03">Créd. Fiscal (03)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Generación</label>
                                    <select
                                        value={genType}
                                        onChange={(e) => setGenType(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="1">Físico</option>
                                        <option value="2">Electrónico</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Número de Documento</label>
                                    <input
                                        type="text"
                                        value={docNumber}
                                        onChange={(e) => setDocNumber(e.target.value)}
                                        placeholder="Ej: DTE-03-S001P001-..."
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Emisión</label>
                                    <input
                                        type="date"
                                        value={emissionDate}
                                        max={getTodayString()}
                                        onChange={(e) => setEmissionDate(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                    <span className="text-[9px] text-indigo-500 font-semibold ml-1 block mt-0.5">
                                        * Período actual: {new Date().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Monto Gravado ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={montoGravado}
                                        placeholder="0.00"
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMontoGravado(val);
                                            const num = parseFloat(val) || 0;
                                            setIvaRetenido(num > 0 ? (num * 0.01).toFixed(2) : '');
                                        }}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Retención 1% ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={ivaRetenido}
                                        placeholder="0.00"
                                        onChange={(e) => setIvaRetenido(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-rose-500/20 text-rose-600 font-mono"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCrLink}
                                className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95 shadow-sm"
                            >
                                Agregar Documento
                            </button>
                        </div>
                    )}

                    {/* Manual Form (when Manual tab in NC or other DTE types) */}
                    {tipoDte !== '07' && (tipoDte !== '05' || activeTab === 'manual') && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo de Documento</label>
                                    <select
                                        value={docType}
                                        onChange={(e) => setDocType(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="01">Factura (01)</option>
                                        <option value="03">Créd. Fiscal (03)</option>
                                        <option value="07">C. Retención (07)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Fecha Emisión</label>
                                    <input
                                        type="date"
                                        value={emissionDate}
                                        max={getTodayString()}
                                        onChange={(e) => setEmissionDate(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">UUID o Número de Control</label>
                                <input
                                    type="text"
                                    value={docNumber}
                                    onChange={(e) => setDocNumber(e.target.value)}
                                    placeholder="UUID o Número de Documento"
                                    className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleManualLink}
                                className="w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95 shadow-sm"
                            >
                                Vincular Manualmente
                            </button>
                        </div>
                    )}

                    {/* Linked Documents List */}
                    {linkedDocs.length > 0 && (
                        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 mt-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                                    <Link2 size={13} className="text-indigo-600" />
                                    Documentos Vinculados ({linkedDocs.length})
                                </span>
                            </div>
                            <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                                {linkedDocs.map((doc, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                                        <div className="truncate pr-3">
                                            <div className="font-black text-xs text-slate-900 truncate">
                                                {doc.control_number || doc.doc_number}
                                            </div>
                                            {doc.control_number && doc.doc_number !== doc.control_number && (
                                                <div className="text-[10px] text-slate-400 font-mono truncate">{doc.doc_number}</div>
                                            )}
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                {doc.doc_type === '01' ? 'Factura' : doc.doc_type === '03' ? 'Créd. Fiscal' : 'DTE ' + doc.doc_type} • {formatDate(doc.emission_date)}
                                                {tipoDte === '07' && doc.montoSujeto ? ` • Grav $${parseFloat(doc.montoSujeto).toFixed(2)}` : ''}
                                                {tipoDte === '07' && doc.ivaRetenido ? ` • Ret $${parseFloat(doc.ivaRetenido).toFixed(2)}` : ''}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLinkedDoc(idx)}
                                            className="text-rose-400 p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors shrink-0"
                                            title="Eliminar documento vinculado"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                    <div className="text-xs font-bold text-slate-500">
                        {linkedDocs.length > 0 ? (
                            <span className="text-indigo-600 font-black">
                                {linkedDocs.length} {linkedDocs.length === 1 ? 'documento referenciado' : 'documentos referenciados'}
                            </span>
                        ) : (
                            <span className="text-slate-400">Sin referencias vinculadas</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PosLinkedDocModal;
