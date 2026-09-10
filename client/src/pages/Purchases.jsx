import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import PdfViewerModal from '../components/ui/PdfViewerModal';
import { 
    Plus, 
    Trash2, 
    History, 
    Search, 
    X,
    Barcode,
    Package,
    Eye,
    XCircle,
    FileSpreadsheet,
    Truck,
    Calculator,
    AlertCircle,
    FileText as FilePdf,
    Settings,
    Edit,
    Zap,
    Calendar,
    Sparkles,
    Loader2,
    QrCode,
    Smartphone,
    CheckCircle2,
    Copy,
    RefreshCw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money, { MoneyInput } from '../components/ui/Money';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import ProviderModal from '../components/providers/ProviderModal';
import { getTodayString } from '../utils/dateUtils';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const MONTHS = [
    { value: 1, label: '01 - ENE' },
    { value: 2, label: '02 - FEB' },
    { value: 3, label: '03 - MAR' },
    { value: 4, label: '04 - ABR' },
    { value: 5, label: '05 - MAY' },
    { value: 6, label: '06 - JUN' },
    { value: 7, label: '07 - JUL' },
    { value: 8, label: '08 - AGO' },
    { value: 9, label: '09 - SEP' },
    { value: 10, label: '10 - OCT' },
    { value: 11, label: '11 - NOV' },
    { value: 12, label: '12 - DIC' },
];
const currentYearVal = new Date().getFullYear();
const YEARS = Array.from({ length: 9 }, (_, i) => currentYearVal - 4 + i);

const Purchases = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('historial');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Header State
    const [branchId, setBranchId] = useState(user?.branch_id ? String(user.branch_id) : '');
    const [providerId, setProviderId] = useState('');
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [tipoDocId, setTipoDocId] = useState('03'); // Default CCF
    const [condicionId, setCondicionId] = useState('1'); // Default Contado
    const [numeroDoc, setNumeroDoc] = useState('');
    const [numControl, setNumControl] = useState('');
    const [selloRecepcion, setSelloRecepcion] = useState('');
    const [fecha, setFecha] = useState(getTodayString());
    const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
    const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
    const [observaciones, setObservaciones] = useState('');

    const handleFechaChange = (e) => {
        const val = e.target.value;
        setFecha(val);
        if (val) {
            const parts = val.split('-');
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                if (!isNaN(y) && !isNaN(m)) {
                    setPeriodYear(y);
                    setPeriodMonth(m);
                }
            }
        }
    };

    // Credit Note Specific
    const [docAfectado, setDocAfectado] = useState('');
    const [fechaAfectada, setFechaAfectada] = useState('');

    // Credit Terms
    const [diasCredito, setDiasCredito] = useState(0);
    const [fechaVencimiento, setFechaVencimiento] = useState('');

    // Items State
    const [selectedItems, setSelectedItems] = useState([]);
    
    // Quick Add State
    const [quickBarcode, setQuickBarcode] = useState('');
    const [quickDesc, setQuickDesc] = useState('');
    const [quickCant, setQuickCant] = useState('1');
    const [quickCosto, setQuickCosto] = useState('0');
    const [quickProd, setQuickProd] = useState(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
    const [modalPage, setModalPage] = useState(1);

    const barcodeInputRef = useRef(null);
    const descInputRef = useRef(null);
    const jsonFileInputRef = useRef(null);
    const aiFileInputRef = useRef(null);
    const [isScanningDte, setIsScanningDte] = useState(false);
    const [recognizeProducts, setRecognizeProducts] = useState(false);

    // QR Mobile Scan State
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrSessionId, setQrSessionId] = useState(null);
    const [qrLanIp, setQrLanIp] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [qrError, setQrError] = useState(null);
    const [qrStatus, setQrStatus] = useState('pending'); // 'pending' | 'processing' | 'completed' | 'expired' | 'error'

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

    const [manualRetencion, setManualRetencion] = useState('');
    const [manualPercepcion, setManualPercepcion] = useState('');
    const [manualNosujeta, setManualNosujeta] = useState('');
    const [manualExenta, setManualExenta] = useState('');
    const [manualFovial, setManualFovial] = useState('');
    const [manualCotrans, setManualCotrans] = useState('');
    const [isRetDirty, setIsRetDirty] = useState(false);
    const [isPercDirty, setIsPercDirty] = useState(false);
    const [isFovialDirty, setIsFovialDirty] = useState(false);
    const [isCotransDirty, setIsCotransDirty] = useState(false);

    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [viewingPurchase, setViewingPurchase] = useState(null);
    const limit = 10;

    // PDF Report Modal State
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [pdfError, setPdfError] = useState(null);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    useDirtyTracker('compras', selectedItems.length > 0 || providerId || numeroDoc || numControl || selloRecepcion);

    // Queries
    const { data: currentCompany } = useQuery({
        queryKey: ['company', user?.company_id],
        queryFn: async () => (await axios.get(`/api/companies`)).data.find(c => c.id === user.company_id),
        enabled: !!user?.company_id
    });

    const [providersCache, setProvidersCache] = useState({});

    const loadProvidersOptions = async (search, page) => {
        const { data } = await axios.get('/api/providers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        if (data?.data?.length) {
            setProvidersCache(prev => {
                const next = { ...prev };
                data.data.forEach(p => { next[p.id] = p; });
                return next;
            });
        }
        return data;
    };

    const selectedProvider = useMemo(() => {
        if (!providerId) return null;
        return providersCache[parseInt(providerId)] || null;
    }, [providersCache, providerId]);

    useEffect(() => {
        if (!selectedProvider) return;
        if (selectedProvider.es_credito) {
            setCondicionId('2');
        } else {
            setCondicionId(prev => prev === '2' ? '1' : prev);
        }
    }, [selectedProvider]);

    useEffect(() => {
        if (condicionId === '2' && fecha && selectedProvider) {
            const dias = Number(selectedProvider.dias_credito) || 0;
            setDiasCredito(dias);
            if (dias > 0) {
                const d = new Date(fecha);
                d.setDate(d.getDate() + dias);
                setFechaVencimiento(d.toISOString().split('T')[0]);
            } else {
                setFechaVencimiento('');
            }
        } else if (condicionId !== '2') {
            setDiasCredito(0);
            setFechaVencimiento('');
        }
    }, [condicionId, fecha, selectedProvider]);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', user?.company_id],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: modalProductsData = { data: [], total: 0, totalPages: 0 }, isLoading: isLoadingModalProducts } = useQuery({
        queryKey: ['purchase-products', debouncedProductSearch, branchId, modalPage],
        queryFn: async () => (await axios.get('/api/products', {
            params: { search: debouncedProductSearch || undefined, branch_id: branchId || undefined, limit: 20, page: modalPage }
        })).data,
        enabled: isProductModalOpen
    });

    React.useEffect(() => {
        const timer = setTimeout(() => { setDebouncedProductSearch(productSearch); setModalPage(1); }, 500);
        return () => clearTimeout(timer);
    }, [productSearch]);

    const { data: tipoDocs = [] } = useQuery({
        queryKey: ['catalog', '002'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_002_tipo_dte')).data
    });

    const { data: condiciones = [] } = useQuery({
        queryKey: ['catalog', '016'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_016_condicion_operacion')).data
    });

    const applyExtractedDteData = (data) => {
        if (!data) return;

        let filledFields = [];

        // 1. Código de Generación / Documento
        if (data.codigo_generacion) {
            setNumeroDoc(data.codigo_generacion.toUpperCase().trim());
            filledFields.push('Cód. Generación');
        }

        // 2. Número de Control
        if (data.numero_control) {
            setNumControl(data.numero_control.toUpperCase().trim());
            filledFields.push('Núm. Control');
        }

        // 3. Sello de Recepción
        if (data.sello_recepcion) {
            setSelloRecepcion(data.sello_recepcion.toUpperCase().trim());
            filledFields.push('Sello');
        }

        // 4. Tipo de Documento
        if (data.tipo_documento_id && tipoDocs?.length) {
            const foundType = tipoDocs.find(t => t.code === data.tipo_documento_id);
            if (foundType) {
                setTipoDocId(data.tipo_documento_id);
                filledFields.push('Tipo Doc');
            }
        }

        // 5. Fecha de Emisión
        if (data.fecha_emision) {
            setFecha(data.fecha_emision);
            handleFechaChange({ target: { value: data.fecha_emision } });
            filledFields.push('Fecha');
        }

        // 6. Proveedor
        if (data.matchedProvider) {
            setProviderId(String(data.matchedProvider.id));
            setProvidersCache(prev => ({ ...prev, [data.matchedProvider.id]: data.matchedProvider }));
            filledFields.push(`Proveedor (${data.matchedProvider.nombre})`);
        } else if (data.emisor?.nombre) {
            toast.info(`Emisor detectado: ${data.emisor.nombre}${data.emisor.nit ? ` (NIT: ${data.emisor.nit})` : ''}. Verifica si existe en el selector de proveedores.`);
        }

        // 7. Productos / Líneas de detalle de la compra
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            const newItems = data.items.map(it => {
                const prod = it.matchedProduct;
                const cant = parseFloat(it.cantidad || 1);
                const precio = parseFloat(it.precio_unitario || (it.total ? it.total / cant : 0));
                const tot = parseFloat(it.total || (cant * precio));
                if (prod) {
                    return {
                        uid: `prod_${prod.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        product_id: prod.id,
                        nombre: prod.nombre,
                        codigo: prod.codigo,
                        tipo_combustible: prod.tipo_combustible || 0,
                        cantidad: cant,
                        precio_unitario: precio,
                        total: tot
                    };
                } else {
                    return {
                        uid: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                        product_id: null,
                        nombre: (it.descripcion || 'ÍTEM').toUpperCase(),
                        codigo: it.codigo || '—',
                        tipo_combustible: 0,
                        cantidad: cant,
                        precio_unitario: precio,
                        total: tot
                    };
                }
            });
            setSelectedItems(newItems);
            filledFields.push(`${newItems.length} Producto(s)`);
        }

        if (filledFields.length > 0) {
            toast.success(`Datos detectados: ${filledFields.join(', ')}`, { duration: 6000 });
        } else {
            toast.info('No se detectaron campos de DTE legibles en la imagen.');
        }
    };

    const handleScanDteFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = '';
        setIsScanningDte(true);
        const loadingToast = toast.loading('Analizando factura / DTE con Inteligencia Artificial...');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('recognizeItems', recognizeProducts ? 'true' : 'false');

            const res = await axios.post('/api/purchases/scan-dte', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const data = res.data?.data;
            if (!data) throw new Error('No se pudieron extraer datos del documento');

            applyExtractedDteData(data);
            toast.dismiss(loadingToast);

        } catch (err) {
            console.error('Error al escanear DTE:', err);
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || 'Error al procesar la imagen con IA');
        } finally {
            setIsScanningDte(false);
        }
    };

    const handleOpenQrModal = async () => {
        setIsQrModalOpen(true);
        setQrLoading(true);
        setQrError(null);
        setQrStatus('pending');
        setQrSessionId(null);

        try {
            const res = await axios.post('/api/purchases/scan-session', { branch_id: branchId });
            if (res.data.success && res.data.sessionId) {
                setQrSessionId(res.data.sessionId);
                setQrLanIp(res.data.lanIp || null);
            } else {
                throw new Error(res.data.message || 'Error al generar sesión');
            }
        } catch (err) {
            console.error('Error al crear sesión QR:', err);
            setQrError(err.response?.data?.message || err.message || 'Error al generar código QR');
        } finally {
            setQrLoading(false);
        }
    };

    const handleCloseQrModal = () => {
        setIsQrModalOpen(false);
        setQrSessionId(null);
        setQrStatus('pending');
        setQrError(null);
    };

    useEffect(() => {
        let intervalId;
        if (isQrModalOpen && qrSessionId) {
            intervalId = setInterval(async () => {
                try {
                    const res = await axios.get(`/api/purchases/scan-session/${qrSessionId}`);
                    const { status, data, error } = res.data;
                    setQrStatus(status);

                    if (status === 'completed' && data) {
                        clearInterval(intervalId);
                        setIsQrModalOpen(false);
                        setQrSessionId(null);
                        applyExtractedDteData(data);
                        toast.success('¡DTE recibido y procesado desde el teléfono con éxito!');
                    } else if (status === 'error') {
                        clearInterval(intervalId);
                        setQrError(error || 'Error al procesar la imagen con IA');
                    } else if (status === 'expired') {
                        clearInterval(intervalId);
                        setQrError('La sesión de escaneo ha expirado');
                    }
                } catch (err) {
                    if (err.response?.status === 404 || err.response?.status === 410) {
                        clearInterval(intervalId);
                        setQrStatus('expired');
                        setQrError('La sesión de escaneo ha expirado o no es válida.');
                    }
                }
            }, 2000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isQrModalOpen, qrSessionId, tipoDocs]);

    const { data: purchasesData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: loadingHistory } = useQuery({
        queryKey: ['purchases', historySearch, historyPage, branchId],
        queryFn: async () => (await axios.get('/api/purchases', { 
            params: { search: historySearch, page: historyPage, limit, branch_id: branchId || undefined }
        })).data,
        enabled: activeTab === 'historial'
    });

    const { data: purchaseDetail, isLoading: loadingDetail } = useQuery({
        queryKey: ['purchase-detail', viewingPurchase?.id],
        queryFn: async () => (await axios.get(`/api/purchases/${viewingPurchase.id}`)).data,
        enabled: !!viewingPurchase?.id
    });

    const { data: activePeriod } = useQuery({
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
        mutationFn: (data) => axios.post('/api/purchases', data),
        onSuccess: () => {
            toast.success('Compra registrada correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al procesar')
    });
    
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => axios.put(`/api/purchases/${id}`, data),
        onSuccess: () => {
            toast.success('Compra actualizada correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar')
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/purchases/${id}/void`),
        onSuccess: () => {
            toast.success('Compra anulada correctamente');
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al anular')
    });

    const handleVoidPurchase = async (id) => {
        const ok = await confirm({
            title: '¿Anular compra?',
            message: 'El stock afectado será revertido automáticamente. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, anular',
            variant: 'warning',
        });
        if (ok) voidMutation.mutate(id);
    };

    // Tax Logic SV
    useEffect(() => {
        let gravada = 0;
        let autoFovial = 0;
        let autoCotrans = 0;

        selectedItems.forEach(item => {
            const qty = parseFloat(item.cantidad) || 0;
            const cost = parseFloat(item.precio_unitario) || 0;
            gravada += qty * cost;

            if (item.tipo_combustible > 0) {
                autoFovial += qty * parseFloat(taxSettings?.fovial_rate || 0.20);
                autoCotrans += qty * parseFloat(taxSettings?.cotrans_rate || 0.10);
            }
        });
        gravada = Math.round(gravada * 100) / 100;
        autoFovial = Math.round(autoFovial * 100) / 100;
        autoCotrans = Math.round(autoCotrans * 100) / 100;

        const esFactura = tipoDocId === '01';
        const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
        const iva = (selectedProvider?.exento_iva || esFactura) ? 0 : Math.round(gravada * ivaRate * 100) / 100;

        // Auto Retención y Percepción
        let autoRetencion = 0;
        const nosAgenteRetencion = currentCompany?.tipo_contribuyente === 'Grande';
        const proveedNoGC = !selectedProvider?.es_gran_contribuyente;
        const retencionRate = parseFloat(taxSettings?.retencion_rate || 1) / 100;
        if (nosAgenteRetencion && proveedNoGC && gravada >= 100 && tipoDocId === '03') {
            autoRetencion = Math.round(gravada * retencionRate * 100) / 100;
        }

        let autoPercepcion = 0;
        const proveedAgentePerc = selectedProvider?.es_gran_contribuyente;
        const nosNoGC = currentCompany?.tipo_contribuyente !== 'Grande';
        const percepcionRate = parseFloat(taxSettings?.percepcion_rate || 1) / 100;
        if (proveedAgentePerc && nosNoGC && tipoDocId === '03') {
            autoPercepcion = Math.round(gravada * percepcionRate * 100) / 100;
        }

        // Si no han sido editados manualmente, sincronizar con el cálculo automático
        if (!isFovialDirty) {
            setManualFovial(autoFovial > 0 ? String(autoFovial) : '');
        }
        if (!isCotransDirty) {
            setManualCotrans(autoCotrans > 0 ? String(autoCotrans) : '');
        }
        if (!isRetDirty) {
            setManualRetencion(autoRetencion > 0 ? String(autoRetencion) : '');
        }
        if (!isPercDirty) {
            setManualPercepcion(autoPercepcion > 0 ? String(autoPercepcion) : '');
        }

        const effectiveFovial = isFovialDirty ? (parseFloat(manualFovial) || 0) : autoFovial;
        const effectiveCotrans = isCotransDirty ? (parseFloat(manualCotrans) || 0) : autoCotrans;
        const effectiveRetencion = isRetDirty ? (parseFloat(manualRetencion) || 0) : autoRetencion;
        const effectivePercepcion = isPercDirty ? (parseFloat(manualPercepcion) || 0) : autoPercepcion;
        const effectiveNosujeta = parseFloat(manualNosujeta) || 0;
        const effectiveExenta = parseFloat(manualExenta) || 0;

        const isExentoProv = Boolean(selectedProvider?.exento_iva);
        const baseGravada = isExentoProv ? 0 : gravada;
        const baseExenta = isExentoProv ? (effectiveExenta + gravada) : effectiveExenta;

        const finalTotal = baseGravada + iva + effectiveFovial + effectiveCotrans + effectiveNosujeta + baseExenta - effectiveRetencion + effectivePercepcion;

        setTotals({
            gravada: baseGravada,
            iva,
            retencion: effectiveRetencion,
            percepcion: effectivePercepcion,
            fovial: effectiveFovial,
            cotrans: effectiveCotrans,
            nosujeta: effectiveNosujeta,
            exenta: baseExenta,
            total: Math.round(finalTotal * 100) / 100
        });

    }, [selectedItems, tipoDocId, selectedProvider, currentCompany, manualRetencion, manualPercepcion, manualNosujeta, manualExenta, manualFovial, manualCotrans, isFovialDirty, isCotransDirty, isRetDirty, isPercDirty, taxSettings]);

    const handleSelectProduct = (product) => {
        setQuickProd(product);
        setQuickBarcode(product.codigo || '');
        setQuickDesc(product.nombre || '');
        setQuickCosto(product.costo || '0');
        setIsProductModalOpen(false);
        setProductSearch('');
        setTimeout(() => qtyInputRef.current?.focus(), 100);
    };

    const handleClearQuickProduct = () => {
        setQuickProd(null);
        setQuickBarcode('');
        setQuickDesc('');
        setQuickCosto('0');
        setQuickCant('1');
        setTimeout(() => descInputRef.current?.focus(), 100);
    };

    const filteredProducts = useMemo(() => {
        let list = modalProductsData.data.filter(p => p.status === 'activo');

        // Filter by branch if selected
        if (branchId) {
            const bid = parseInt(branchId);
            list = list.filter(p => p.branches?.includes(bid));
        }

        return list;
    }, [modalProductsData, branchId]);

    const performBarcodeLookup = async () => {
        if (!quickBarcode) return;
        if (!branchId) return toast.error('Seleccione primero una sucursal');

        try {
            const { data } = await axios.get(`/api/products/lookup/${encodeURIComponent(quickBarcode.trim())}`, { params: { branch_id: branchId } });
            if (data.status !== 'activo') {
                setQuickBarcode('');
                return toast.error('El producto seleccionado se encuentra inactivo');
            }
            setQuickProd(data);
            setQuickDesc(data.nombre || '');
            setQuickCosto(data.costo || '0');
            qtyInputRef.current?.focus();
        } catch {
            toast.error('Producto no encontrado');
            setQuickBarcode('');
        }
    };

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter') {
            performBarcodeLookup();
        }
    };

    const handleAddQuick = () => {
        const qty = parseFloat(quickCant);
        const cost = parseFloat(quickCosto);
        const desc = (quickProd ? quickProd.nombre : quickDesc).trim();

        if (!desc && !quickProd) return toast.error('Ingrese una descripción o seleccione un producto');
        if (isNaN(qty) || qty <= 0) return toast.error('Cantidad inválida');
        if (isNaN(cost) || cost < 0) return toast.error('Costo inválido');

        if (quickProd) {
            const existing = selectedItems.find(i => i.product_id === quickProd.id);
            if (existing) {
                setSelectedItems(selectedItems.map(i => i.uid === existing.uid ? { 
                    ...i, 
                    cantidad: i.cantidad + qty,
                    precio_unitario: cost,
                    total: Math.round((i.cantidad + qty) * cost * 100) / 100
                } : i));
            } else {
                setSelectedItems([...selectedItems, {
                    uid: `prod_${quickProd.id}_${Date.now()}`,
                    product_id: quickProd.id,
                    nombre: quickProd.nombre,
                    codigo: quickProd.codigo,
                    tipo_combustible: quickProd.tipo_combustible || 0,
                    cantidad: qty,
                    precio_unitario: cost,
                    total: Math.round(qty * cost * 100) / 100
                }]);
            }
        } else {
            // Ítem sin código (solo descripción, cantidad y costo)
            setSelectedItems([...selectedItems, {
                uid: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                product_id: null,
                nombre: desc.toUpperCase(),
                codigo: '—',
                tipo_combustible: 0,
                cantidad: qty,
                precio_unitario: cost,
                total: Math.round(qty * cost * 100) / 100
            }]);
        }

        setQuickBarcode(''); 
        setQuickProd(null); 
        setQuickDesc(''); 
        setQuickCant('1'); 
        setQuickCosto('0');
        barcodeInputRef.current?.focus();
    };

    const updateItem = (uid, field, value) => {
        setSelectedItems(selectedItems.map(item => {
            if (item.uid === uid) {
                const updated = { ...item, [field]: value };
                if (field === 'cantidad' || field === 'precio_unitario') {
                    const c = parseFloat(updated.cantidad) || 0;
                    const p = parseFloat(updated.precio_unitario) || 0;
                    updated.total = Math.round(c * p * 100) / 100;
                }
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (uid) => {
        setSelectedItems(selectedItems.filter(item => item.uid !== uid));
    };

    const resetForm = () => {
        setSelectedItems([]); setNumeroDoc(''); setNumControl(''); setSelloRecepcion(''); setObservaciones('');
        setDocAfectado(''); setFechaAfectada('');
        setDiasCredito(0); setFechaVencimiento('');
        setManualRetencion(''); setManualPercepcion(''); setManualNosujeta(''); setManualExenta('');
        setManualFovial(''); setManualCotrans('');
        setIsRetDirty(false); setIsPercDirty(false); setIsFovialDirty(false); setIsCotransDirty(false);
        setQuickBarcode(''); setQuickProd(null); setQuickDesc(''); setQuickCant('1'); setQuickCosto('0');
        const today = getTodayString();
        setFecha(today);
        const [y, m] = today.split('-').map(Number);
        setPeriodYear(y);
        setPeriodMonth(m);
        setIsEditing(false); setEditingId(null);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let json = JSON.parse(event.target.result);
                
                // Support both direct DTE and wrapped structures
                if (!json.identificacion && json.dte) json = json.dte;
                if (!json.identificacion && json.data) json = json.data;

                if (!json.identificacion) {
                    return toast.error("El archivo no parece ser un DTE válido de El Salvador.");
                }

                toast.info("Procesando DTE...");

                // 1. Basic Metadata
                if (json.identificacion) {
                    setFecha(json.identificacion.fecEmi || new Date().toISOString().split('T')[0]);
                    setNumeroDoc(json.identificacion.codigoGeneracion || json.identificacion.numeroControl || '');
                    setNumControl(json.identificacion.numeroControl || '');
                    if (json.identificacion.tipoDte) setTipoDocId(json.identificacion.tipoDte);
                }

                const importedSello = json.respuestaHacienda?.selloRecibido || json.selloRecepcion || json.selloRecibido || '';
                if (importedSello) {
                    setSelloRecepcion(importedSello);
                }

                // 2. Identify Provider
                if (json.emisor) {
                    const nit = json.emisor.nit?.replace(/\D/g, '');
                    const nrc = json.emisor.nrc?.replace(/\D/g, '');
                    
                    const found = await (async () => {
                        if (!nit && !nrc) return null;
                        try {
                            const { data: res } = await axios.get('/api/providers', {
                                params: { search: nit || nrc, limit: 50 }
                            });
                            const match = (res.data || []).find(p => {
                                const pNit = p.nit?.replace(/\D/g, '');
                                const pNrc = p.nrc?.replace(/\D/g, '');
                                return (nit && pNit === nit) || (nrc && pNrc === nrc);
                            });
                            if (match) setProvidersCache(prev => ({ ...prev, [match.id]: match }));
                            return match || null;
                        } catch { return null; }
                    })();

                    if (found) {
                        setProviderId(found.id);
                        toast.success(`Proveedor: ${found.nombre}`);
                    } else {
                        toast.error(`Proveedor NO encontrado: NIT ${json.emisor.nit || 'desconocido'}. Debe seleccionarlo o crearlo.`, { duration: 6000 });
                        setProviderId('');
                    }
                } else {
                    toast.warning("No se encontró información del emisor en el DTE.");
                }

                // 3. Process Items
                const body = json.cuerpoDocumento;
                if (body && Array.isArray(body)) {
                    const newItems = [];
                    const missingProducts = [];
                    let matchedCount = 0;

                    for (const item of body) {
                        const code = (item.codigo || '').toUpperCase();
                        let prod = null;
                        if (code && branchId) {
                            try {
                                const { data } = await axios.get(`/api/products/lookup/${encodeURIComponent(code)}`, { params: { branch_id: branchId } });
                                prod = data;
                            } catch { prod = null; }
                        }
                        
                        if (prod) {
                            newItems.push({
                                uid: `prod_${prod.id}_${Date.now()}_${Math.random()}`,
                                product_id: prod.id,
                                nombre: prod.nombre,
                                codigo: prod.codigo,
                                tipo_combustible: prod.tipo_combustible || 0,
                                cantidad: parseFloat(item.cantidad || 0),
                                precio_unitario: parseFloat(item.precioUni || 0),
                                total: (parseFloat(item.cantidad || 0) * parseFloat(item.precioUni || 0))
                            });
                            matchedCount++;
                        } else {
                            newItems.push({
                                uid: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                product_id: null,
                                nombre: (item.descripcion || 'ÍTEM SIN CÓDIGO').toUpperCase(),
                                codigo: code || '—',
                                tipo_combustible: 0,
                                cantidad: parseFloat(item.cantidad || 0),
                                precio_unitario: parseFloat(item.precioUni || 0),
                                total: (parseFloat(item.cantidad || 0) * parseFloat(item.precioUni || 0))
                            });
                            missingProducts.push(code || item.descripcion);
                        }
                    }

                    if (newItems.length > 0) {
                        setSelectedItems(newItems);
                        setActiveTab('nuevo');
                        if (missingProducts.length > 0) {
                            toast.success(`Se cargaron ${matchedCount} productos del catálogo y ${missingProducts.length} ítems sin código.`, { duration: 6000 });
                        } else {
                            toast.success(`Se cargaron ${matchedCount} productos.`);
                        }
                    }

                    if (missingProducts.length > 0) {
                        toast.error(`Atención: ${missingProducts.length} ítems no coinciden con su catálogo: ${missingProducts.join(', ')}`, { duration: 8000 });
                    }
                } else {
                    toast.warning("El DTE no contiene una lista de ítems válida.");
                }

                // 4. Totals (Override with fiscal precision)
                if (json.resumen) {
                    const ret = parseFloat(json.resumen.retencionValue || json.resumen.totalRetencion || 0);
                    const nos = parseFloat(json.resumen.totalNoSuj || 0);
                    const exe = parseFloat(json.resumen.totalExenta || 0);
                    if (ret > 0) { setManualRetencion(String(ret)); setIsRetDirty(true); }
                    if (nos > 0) { setManualNosujeta(String(nos)); }
                    if (exe > 0) { setManualExenta(String(exe)); }

                    if (json.resumen.tributos && Array.isArray(json.resumen.tributos)) {
                        const fov = json.resumen.tributos.find(t => String(t.codigo).toUpperCase() === 'D1')?.valor || 0;
                        const cot = json.resumen.tributos.find(t => String(t.codigo).toUpperCase() === 'C8')?.valor || 0;
                        if (parseFloat(fov) > 0) {
                            setManualFovial(String(parseFloat(fov)));
                            setIsFovialDirty(true);
                        }
                        if (parseFloat(cot) > 0) {
                            setManualCotrans(String(parseFloat(cot)));
                            setIsCotransDirty(true);
                        }
                    }
                }

                toast.info("Importación completada.");
            } catch (err) {
                console.error("DTE Import Error:", err);
                toast.error("Error crítico al leer el archivo. Verifique el formato JSON.");
            }
        };
        reader.readAsText(file);
        e.target.value = null; 
    };

    const handleSubmit = () => {
        if (!branchId) return toast.error('Seleccione una sucursal');
        if (!providerId) return toast.error('Seleccione un proveedor');
        if (!numeroDoc) return toast.error('Ingrese el número de documento o factura');
        if (tipoDocId === '06' && !docAfectado) return toast.error('Documento afectado es requerido para Notas de Crédito');
        if (selectedItems.length === 0) return toast.error('Agregue productos');

        const d = fecha ? new Date(fecha) : new Date();
        const docYear = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
        const docMonth = !isNaN(d.getTime()) ? d.getMonth() + 1 : new Date().getMonth() + 1;
        let finalPeriodYear = periodYear || activePeriod?.year || docYear;
        let finalPeriodMonth = periodMonth || activePeriod?.month || docMonth;

        if (finalPeriodYear < docYear || (finalPeriodYear === docYear && finalPeriodMonth < docMonth)) {
            finalPeriodYear = docYear;
            finalPeriodMonth = docMonth;
        }

        const payload = {
            branch_id: branchId, provider_id: providerId, fecha, numero_documento: numeroDoc,
            numero_control: (numControl || '').trim().toUpperCase() || null,
            sello_recepcion: (selloRecepcion || '').trim().toUpperCase() || null,
            tipo_documento_id: tipoDocId, condicion_operacion_id: condicionId, observaciones,
            dias_credito: diasCredito, fecha_vencimiento: fechaVencimiento || null,
            total_nosujeta: totals.nosujeta, total_exenta: totals.exenta, total_gravada: totals.gravada,
            iva: totals.iva, retencion: totals.retencion, percepcion: totals.percepcion, 
            fovial: totals.fovial, cotrans: totals.cotrans, monto_total: totals.total,
            documento_afectado: docAfectado, fecha_afectada: fechaAfectada,
            period_year: finalPeriodYear, period_month: finalPeriodMonth,
            items: selectedItems.map(it => ({
                product_id: it.product_id || null,
                nombre: it.nombre,
                descripcion: it.nombre,
                cantidad: it.cantidad,
                precio_unitario: it.precio_unitario,
                total: it.total
            }))
        };

        if (isEditing && editingId) {
            updateMutation.mutate({ id: editingId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDownloadPDF = async (id, numero) => {
        try {
            const response = await axios.get(`/api/purchases/pdf/${id}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Compra_${numero || id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error al descargar PDF:', error);
            toast.error('Error al descargar PDF');
        }
    };

    const handleEdit = async (purchase) => {
        const loadToast = toast.loading('Cargando datos de compra...');
        try {
            const { data: detail } = await axios.get(`/api/purchases/${purchase.id}`);
            
            setEditingId(purchase.id);
            setIsEditing(true);
            setBranchId(detail.branch_id);
            setProviderId(detail.provider_id);
            if (detail.provider_nombre) {
                setProvidersCache(prev => ({ ...prev, [detail.provider_id]: { id: detail.provider_id, nombre: detail.provider_nombre } }));
            }
            setTipoDocId(detail.tipo_documento_id);
            setCondicionId(detail.condicion_operacion_id);
            setNumeroDoc(detail.numero_documento);
            setNumControl(detail.numero_control || detail.num_control || '');
            setSelloRecepcion(detail.sello_recepcion || '');
            setFecha(new Date(detail.fecha).toISOString().split('T')[0]);
            if (detail.period_year && detail.period_month) {
                setPeriodYear(parseInt(detail.period_year, 10));
                setPeriodMonth(parseInt(detail.period_month, 10));
            } else {
                const d = new Date(detail.fecha);
                setPeriodYear(d.getFullYear());
                setPeriodMonth(d.getMonth() + 1);
            }
            setDiasCredito(parseInt(detail.dias_credito) || 0);
            setFechaVencimiento(detail.fecha_vencimiento ? new Date(detail.fecha_vencimiento).toISOString().split('T')[0] : '');
            setObservaciones(detail.observaciones || '');
            setDocAfectado(detail.documento_afectado || '');
            setFechaAfectada(detail.fecha_afectada ? new Date(detail.fecha_afectada).toISOString().split('T')[0] : '');
            
            // Totals
            setManualNosujeta(detail.total_nosujeta != null && parseFloat(detail.total_nosujeta) !== 0 ? String(detail.total_nosujeta) : '');
            setManualExenta(detail.total_exenta != null && parseFloat(detail.total_exenta) !== 0 ? String(detail.total_exenta) : '');
            setManualRetencion(detail.retencion != null && parseFloat(detail.retencion) !== 0 ? String(detail.retencion) : '');
            setManualPercepcion(detail.percepcion != null && parseFloat(detail.percepcion) !== 0 ? String(detail.percepcion) : '');
            setManualFovial(detail.fovial != null && parseFloat(detail.fovial) !== 0 ? String(detail.fovial) : '');
            setManualCotrans(detail.cotrans != null && parseFloat(detail.cotrans) !== 0 ? String(detail.cotrans) : '');
            setIsRetDirty(true);
            setIsPercDirty(true);
            setIsFovialDirty(true);
            setIsCotransDirty(true);

            setSelectedItems(detail.items.map((it, idx) => ({
                uid: `item_${it.id || idx}_${Date.now()}`,
                product_id: it.product_id || null,
                nombre: it.nombre || it.descripcion || 'Sin descripción',
                codigo: it.codigo || '—',
                tipo_combustible: it.tipo_combustible || 0,
                cantidad: parseFloat(it.cantidad),
                precio_unitario: parseFloat(it.precio_unitario),
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
        if (!purchasesData.data || purchasesData.data.length === 0) {
            return toast.error('No hay datos para exportar');
        }

        const dataToExport = purchasesData.data.map(p => ({
            'FECHA': new Date(p.fecha).toLocaleDateString(),
            'PROVEEDOR': p.provider_nombre || '---',
            'NRC': p.provider_nrc || '---',
            'TIPO DOC.': p.tipo_doc_nombre || '---',
            'NÚMERO': p.numero_documento || '---',
            'N° CONTROL': p.numero_control || '---',
            'SELLO RECEPCIÓN': p.sello_recepcion || '---',
            'SUCURSAL': p.branch_nombre || '---',
            'GRAVADA': parseFloat(p.total_gravada || 0),
            'IVA': parseFloat(p.iva || 0),
            'RETENCIÓN': parseFloat(p.retencion || 0),
            'PERCEPCIÓN': parseFloat(p.percepcion || 0),
            'FOVIAL': parseFloat(p.fovial || 0),
            'COTRANS': parseFloat(p.cotrans || 0),
            'TOTAL': parseFloat(p.monto_total || 0),
            'ESTADO': p.status === 'voided' ? 'ANULADO' : 'ACTIVO'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'COMPRAS');
        XLSX.writeFile(wb, `Reporte_Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleOpenPdfModal = async () => {
        setIsPdfModalOpen(true);
        setIsLoadingPdf(true);
        setPdfError(null);

        try {
            const params = {
                branch_id: branchId && branchId !== 'all' ? branchId : undefined,
                search: historySearch?.trim() ? historySearch.trim() : undefined
            };

            const response = await axios.get('/api/purchases/reports/pdf', {
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
            console.error('Error fetching purchases PDF:', err);
            setPdfError(err.message || 'Ocurrió un error al generar el PDF');
        } finally {
            setIsLoadingPdf(false);
        }
    };

    const inputCls = "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight";
    const labelCls = "block text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 ml-1";

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">
                        {activeTab === 'historial' ? 'Gestión de Compras' : (isEditing ? 'Modificar Compra' : 'Nueva Compra')}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                            {activeTab === 'historial' 
                                ? 'Historial y auditoría de documentos de compras' 
                                : (isEditing ? `Modificando comprobante ${numeroDoc || ''}` : 'Formulario de registro de compra')}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <input 
                        type="file" 
                        ref={jsonFileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json" 
                        className="hidden" 
                    />

                    {activeTab === 'historial' ? (
                        <>
                            <button 
                                onClick={() => jsonFileInputRef.current?.click()}
                                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                title="Importar desde archivo JSON oficial (Hacienda SV)"
                            >
                                <Zap size={13} className="fill-amber-500 text-amber-500" /> Importar DTE
                            </button>
                            <button 
                                onClick={() => {
                                    resetForm();
                                    setActiveTab('nuevo');
                                }} 
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                <Plus size={14} /> Nueva Compra
                            </button>
                        </>
                    ) : (
                        <>
                            {!isEditing && (
                                <button 
                                    onClick={() => jsonFileInputRef.current?.click()}
                                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                    title="Importar desde archivo JSON oficial (Hacienda SV)"
                                >
                                    <Zap size={13} className="fill-amber-500 text-amber-500" /> Importar DTE
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    resetForm();
                                    setActiveTab('historial');
                                }} 
                                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            >
                                <History size={13} /> Volver al Listado
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    <div className="lg:col-span-3 space-y-4">
                        {/* Cabecera */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Truck size={16} className="text-indigo-600" />
                                    <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest text-[Spanish]">Datos del Comprobante</h3>
                                    {tipoDocId === '06' && (
                                        <div className="flex items-center gap-1.5 animate-pulse ml-2">
                                            <AlertCircle size={14} className="text-rose-500" />
                                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-[Spanish]">Requiere Referencia</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Botón de Escaneo con IA */}
                                    <input 
                                        type="file" 
                                        ref={aiFileInputRef} 
                                        onChange={handleScanDteFile} 
                                        accept="image/*,.pdf" 
                                        className="hidden" 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => aiFileInputRef.current?.click()}
                                        disabled={isScanningDte}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100/80 border border-violet-200/80 transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                                        title="Subir foto o PDF del DTE para auto-completar los datos con Inteligencia Artificial"
                                    >
                                        {isScanningDte ? (
                                            <>
                                                <Loader2 size={13} className="animate-spin text-violet-600" />
                                                <span>Escaneando con IA...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={13} className="text-violet-600" />
                                                <span>Escanear DTE (IA)</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Botón de Escaneo con Teléfono Móvil mediante QR */}
                                    <button
                                        type="button"
                                        onClick={handleOpenQrModal}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                        title="Escanear factura física con la cámara de tu smartphone mediante código QR"
                                    >
                                        <QrCode size={13} className="text-indigo-600" />
                                        <span>Escanear con Teléfono (QR)</span>
                                    </button>

                                    {/* Toggle Reconocer productos con IA */}
                                    <label 
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all shadow-2xs cursor-pointer select-none ${
                                            recognizeProducts 
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                                : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                                        }`}
                                        title="Al activar, el escáner con IA extraerá la lista de productos, cantidades y precios para llenar la tabla de la compra"
                                    >
                                        <input 
                                            type="checkbox" 
                                            checked={recognizeProducts} 
                                            onChange={(e) => setRecognizeProducts(e.target.checked)} 
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <Package size={13} className={recognizeProducts ? 'text-indigo-600' : 'text-slate-400'} />
                                        <span>Productos IA</span>
                                    </label>

                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        <Calendar size={12} className="text-indigo-500" />
                                        Período:
                                    </span>
                                    <select 
                                        value={periodMonth} 
                                        onChange={(e) => setPeriodMonth(parseInt(e.target.value, 10))}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                                        title="Mes del Período"
                                    >
                                        {MONTHS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                    <select 
                                        value={periodYear} 
                                        onChange={(e) => setPeriodYear(parseInt(e.target.value, 10))}
                                        className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                                        title="Año del Período"
                                    >
                                        {YEARS.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3">
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Sucursal Receptor</label>
                                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                                        <option value="">---</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <label className={labelCls}>Proveedor / Emisor</label>
                                            {selectedProvider?.es_gran_contribuyente && (
                                                <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tight">
                                                    Gran Contribuyente
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingProvider(null);
                                                    setIsProviderModalOpen(true);
                                                }}
                                                className="text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded-lg transition-all flex items-center gap-1 text-[9px] font-black uppercase tracking-tight"
                                                title="Nuevo Proveedor"
                                            >
                                                <Plus size={11} />
                                                <span className="hidden sm:inline">Nuevo</span>
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (!selectedProvider) return;
                                                    setEditingProvider(selectedProvider);
                                                    setIsProviderModalOpen(true);
                                                }}
                                                disabled={!selectedProvider}
                                                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded-lg transition-all disabled:opacity-20 flex items-center gap-1 text-[9px] font-black uppercase tracking-tight"
                                                title="Editar Proveedor Seleccionado"
                                            >
                                                <Edit size={11} />
                                                <span className="hidden sm:inline">Editar</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <SearchableSelect 
                                            loadOptions={loadProvidersOptions} value={providerId} 
                                            onChange={(e, opt) => {
                                                setProviderId(e.target.value);
                                                if (opt) setProvidersCache(prev => ({ ...prev, [opt.id]: opt }));
                                            }}
                                            valueKey="id" labelKey="nombre" placeholder="BUSCAR PROVEEDOR..."
                                            codeKey="nrc" codeLabel="NRC"
                                            selectedLabel={selectedProvider?.nombre}
                                            dropdownWidth={420}
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Condición Pago</label>
                                    <select value={condicionId} onChange={(e) => setCondicionId(e.target.value)} className={inputCls}>
                                        {condiciones.map(c => <option key={c.code} value={c.code} disabled={c.code === '2' && !selectedProvider?.es_credito}>{c.description.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className={labelCls}>Tipo Documento</label>
                                    <select value={tipoDocId} onChange={(e) => setTipoDocId(e.target.value)} className={inputCls}>
                                        {tipoDocs.map(t => <option key={t.code} value={t.code}>{t.description.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className={condicionId === '2' ? 'md:col-span-1' : 'md:col-span-2'}>
                                    <label className={labelCls}>Documento / Cód. Generación</label>
                                    <input 
                                        type="text" 
                                        value={numeroDoc} 
                                        onChange={(e) => setNumeroDoc(e.target.value.toUpperCase())} 
                                        placeholder="NO. FACTURA O CÓDIGO GENERACIÓN DTE" 
                                        className={`${inputCls} font-mono`} 
                                    />
                                </div>

                                {condicionId === '2' && (
                                    <div className="md:col-span-1 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                                        <label className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Vencimiento</label>
                                        <input type="date" value={fechaVencimiento} readOnly className={`${inputCls} border-indigo-100 cursor-not-allowed`} />
                                        {diasCredito > 0 && (
                                            <span className="text-[7px] font-black text-indigo-400 mt-0.5 block">+{diasCredito} días crédito</span>
                                        )}
                                    </div>
                                )}

                                <div className="md:col-span-1">
                                    <label className={labelCls}>Fecha de Emisión</label>
                                    <input 
                                        type="date" 
                                        value={fecha} 
                                        onChange={handleFechaChange} 
                                        className={inputCls} 
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className={labelCls}>
                                        Número de Control (DTE) <span className="text-[8px] font-normal text-slate-400 lowercase tracking-normal">(opcional)</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={numControl} 
                                        onChange={(e) => setNumControl(e.target.value.toUpperCase())} 
                                        placeholder="DTE-03-M001P001-00001 (OPCIONAL)" 
                                        className={`${inputCls} uppercase font-mono text-[11px]`} 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelCls}>
                                        Sello de Recepción (MH) <span className="text-[8px] font-normal text-slate-400 lowercase tracking-normal">(opcional)</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        value={selloRecepcion} 
                                        onChange={(e) => setSelloRecepcion(e.target.value.toUpperCase())} 
                                        placeholder="SELLO OFICIAL DE HACIENDA (OPCIONAL)" 
                                        className={`${inputCls} uppercase font-mono text-[11px]`} 
                                    />
                                </div>

                                {tipoDocId === '06' && (
                                    <>
                                        <div className="md:col-span-1 bg-rose-50/50 p-2 rounded-xl border border-rose-100 animate-in slide-in-from-top-2">
                                            <label className="block text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1 text-[Spanish]">Doc. Afectado</label>
                                            <input type="text" value={docAfectado} onChange={(e) => setDocAfectado(e.target.value)} placeholder="NO. FACTURA" className={`${inputCls} border-rose-100`} />
                                        </div>
                                        <div className="md:col-span-1 bg-rose-50/50 p-2 rounded-xl border border-rose-100 animate-in slide-in-from-top-2">
                                            <label className="block text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1 text-[Spanish]">Fecha Afectada</label>
                                            <input type="date" value={fechaAfectada} onChange={(e) => setFechaAfectada(e.target.value)} className={`${inputCls} border-rose-100`} />
                                        </div>
                                    </>
                                )}

                                <div className={tipoDocId === '06' ? 'md:col-span-2' : 'md:col-span-4'}>
                                    <label className={labelCls}>Observaciones / Notas</label>
                                    <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="OPCIONAL..." className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${(!branchId || !providerId || !tipoDocId) ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
                            {(!branchId || !providerId || !tipoDocId) && (
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 text-center px-10">
                                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-xl inline-block">
                                        <AlertCircle size={24} className="mx-auto mb-2 text-rose-500" />
                                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Complete la cabecera para agregar productos</p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-1 uppercase italic">(Sucursal, Proveedor y Documento requeridos)</p>
                                    </div>
                                </div>
                            )}
                            {/* Quick Add Bar */}
                            <div className="p-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-[120px_1fr_80px_100px_100px_44px] gap-2 items-end">
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Producto</label>
                                    <div className="relative">
                                        <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                        <input 
                                            ref={barcodeInputRef} 
                                            type="text" 
                                            value={quickBarcode} 
                                            onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())} 
                                            onKeyDown={handleBarcodeSubmit} 
                                            placeholder="SCAN / F3..." 
                                            className="w-full pl-7 pr-8 py-1 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[10px] font-bold" 
                                        />
                                        <button 
                                            type="button"
                                            onClick={performBarcodeLookup} 
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Buscar producto"
                                        >
                                            <Search size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1 ml-1">
                                        <label className="text-[8px] font-black text-slate-400 uppercase">
                                            {quickProd ? 'Producto (Catálogo)' : 'Descripción (Libre o Catálogo)'}
                                        </label>
                                        {quickProd && (
                                            <button
                                                type="button"
                                                onClick={handleClearQuickProduct}
                                                className="text-[7px] text-rose-500 hover:text-rose-700 font-black uppercase flex items-center gap-0.5"
                                                title="Quitar producto y escribir descripción libre"
                                            >
                                                <X size={10} /> Quitar Cód.
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <input
                                            ref={descInputRef}
                                            type="text"
                                            value={quickProd ? quickProd.nombre : quickDesc}
                                            disabled={Boolean(quickProd)}
                                            onChange={(e) => setQuickDesc(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && qtyInputRef.current?.focus()}
                                            placeholder={quickProd ? quickProd.nombre : "ESCRIBA DESCRIPCIÓN DEL ÍTEM..."}
                                            className={`w-full px-2 py-1 border rounded-lg text-[10px] font-black outline-none h-[26px] ${
                                                quickProd 
                                                    ? 'bg-slate-100 text-slate-700 border-slate-200 cursor-not-allowed uppercase' 
                                                    : 'bg-white text-slate-800 border-slate-200 focus:ring-1 focus:ring-indigo-500 uppercase placeholder:text-slate-300'
                                            }`}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-center">Cant.</label>
                                    <input 
                                        ref={qtyInputRef} 
                                        type="number" 
                                        step="0.01"
                                        value={quickCant} 
                                        onChange={(e) => setQuickCant(e.target.value)} 
                                        onKeyDown={(e) => e.key === 'Enter' && costInputRef.current?.focus()} 
                                        onFocus={(e) => e.target.select()} 
                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-[10px] font-black text-center h-[26px]" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right">Costo Neto</label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[9px]">$</span>
                                        <input 
                                            ref={costInputRef} 
                                            type="number" 
                                            step="0.0001"
                                            value={quickCosto} 
                                            onChange={(e) => setQuickCosto(e.target.value)} 
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddQuick()} 
                                            onFocus={(e) => e.target.select()} 
                                            className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-[10px] font-black text-right h-[26px]" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right pr-2">Total</label>
                                    <div className="w-full px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-600 text-right h-[26px] flex items-center justify-end">
                                        ${(parseFloat(quickCant || 0) * parseFloat(quickCosto || 0)).toFixed(2)}
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleAddQuick} 
                                    disabled={!quickProd && (!quickDesc || !quickDesc.trim())} 
                                    title="Agregar ítem a la compra"
                                    className="h-[26px] w-full bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-20 active:scale-95 transition-all"
                                >
                                    <Plus size={14} />
                                </button>
                            </div>

                            {/* Table */}
                            <div className="min-h-[250px]">
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead className="bg-slate-50/50 border-b border-slate-100 font-bold text-[9px] text-slate-400 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="px-5 py-2">Código</th>
                                            <th className="px-5 py-2">Producto / Descripción</th>
                                            <th className="px-5 py-2 text-center w-20">Cant.</th>
                                            <th className="px-5 py-2 text-right w-24">Costo U.</th>
                                            <th className="px-5 py-2 text-right w-24">Subtotal</th>
                                            <th className="px-5 py-2 text-right w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {selectedItems.length === 0 ? (
                                            <tr><td colSpan="6" className="px-5 py-16 text-center text-[9px] font-black text-slate-200 uppercase tracking-widest">Esperando Productos o Ítems...</td></tr>
                                        ) : selectedItems.map(item => (
                                            <tr key={item.uid} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-1.5 font-mono text-[9px] font-bold text-indigo-600" data-label="Código">
                                                    {item.codigo || '—'}
                                                </td>
                                                <td className="px-5 py-1.5 text-[10px] font-bold text-slate-600 uppercase" data-label="Producto">
                                                    {item.product_id ? (
                                                        <span>{item.nombre}</span>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={item.nombre}
                                                            onChange={(e) => updateItem(item.uid, 'nombre', e.target.value.toUpperCase())}
                                                            className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded px-2 py-0.5 text-[10px] font-bold outline-none uppercase"
                                                            placeholder="DESCRIPCIÓN..."
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-5 py-1.5" data-label="Cant.">
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={item.cantidad} 
                                                        onChange={(e) => updateItem(item.uid, 'cantidad', e.target.value)} 
                                                        onFocus={(e) => e.target.select()} 
                                                        className="w-full bg-slate-50 text-center font-black py-0.5 rounded text-[10px]" 
                                                    />
                                                </td>
                                                <td className="px-5 py-1.5" data-label="Costo U.">
                                                    <MoneyInput 
                                                        step="0.0001" 
                                                        value={item.precio_unitario} 
                                                        onChange={(e) => updateItem(item.uid, 'precio_unitario', e.target.value)} 
                                                        onFocus={(e) => e.target.select()} 
                                                        className="w-full bg-slate-50 text-right pr-1 font-bold py-0.5 rounded text-[10px]" 
                                                    />
                                                </td>
                                                <td className="px-5 py-1.5 text-right font-black text-slate-900 text-[10px]" data-label="Subtotal">
                                                    <Money value={item.total} />
                                                </td>
                                                <td className="px-5 py-1.5 text-right" data-label="">
                                                    <button onClick={() => removeItem(item.uid)} className="p-1 text-slate-300 hover:text-rose-500">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl space-y-5 sticky top-4">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                                <Calculator size={16} className="text-indigo-400" />
                                <h3 className="font-black text-[9px] uppercase tracking-widest text-[Spanish]">Resumen de Operaciones</h3>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-0.5">
                                    <div className="text-[8px] opacity-40 font-black uppercase text-[Spanish]">Ventas Gravadas</div>
                                    <div className="text-lg font-black text-right">${(selectedProvider?.exento_iva ? 0 : totals.gravada).toFixed(2)}</div>
                                </div>
                                <div className="space-y-0.5 border-t border-white/5 pt-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[8px] opacity-40 font-black uppercase text-[Spanish]">IVA ({(taxSettings?.iva_rate || 13)}%)</span>
                                    </div>
                                    <div className="text-sm font-black text-right text-white/90">${totals.iva.toFixed(2)}</div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-black text-amber-400 uppercase tracking-tight">FOVIAL ($)</span>
                                            {isFovialDirty ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsFovialDirty(false)}
                                                    className="text-[7px] text-amber-300 hover:text-white uppercase font-bold transition-colors"
                                                    title="Recalcular automáticamente según galonaje"
                                                >
                                                    Auto ↺
                                                </button>
                                            ) : (
                                                <span className="text-[7px] text-white/30 uppercase font-bold">Auto</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <MoneyInput
                                                step="0.01"
                                                value={manualFovial}
                                                onChange={(e) => {
                                                    setManualFovial(e.target.value);
                                                    setIsFovialDirty(true);
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-amber-500 group-hover:bg-white/10 text-white font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-black text-cyan-400 uppercase tracking-tight">COTRANS ($)</span>
                                            {isCotransDirty ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCotransDirty(false)}
                                                    className="text-[7px] text-cyan-300 hover:text-white uppercase font-bold transition-colors"
                                                    title="Recalcular automáticamente según galonaje"
                                                >
                                                    Auto ↺
                                                </button>
                                            ) : (
                                                <span className="text-[7px] text-white/30 uppercase font-bold">Auto</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <MoneyInput
                                                step="0.01"
                                                value={manualCotrans}
                                                onChange={(e) => {
                                                    setManualCotrans(e.target.value);
                                                    setIsCotransDirty(true);
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-cyan-500 group-hover:bg-white/10 text-white font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                    <div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-black text-rose-400 uppercase text-[Spanish]">Retención ({(taxSettings?.retencion_rate || 1)}%)</span>
                                                {isRetDirty ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsRetDirty(false)}
                                                        className="text-[7px] text-rose-300 hover:text-white uppercase font-bold transition-colors"
                                                        title="Recalcular automáticamente el 1%"
                                                    >
                                                        Auto ↺
                                                    </button>
                                                ) : (
                                                    <span className="text-[7px] text-white/30 uppercase font-bold">Auto</span>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <MoneyInput
                                                    step="0.01"
                                                    value={manualRetencion}
                                                    onChange={(e) => {
                                                        setManualRetencion(e.target.value);
                                                        setIsRetDirty(true);
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-rose-500 group-hover:bg-white/10 text-white font-mono"
                                                    placeholder="0.00"
                                                />
                                                <Settings size={8} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-rose-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-black text-emerald-400 uppercase text-[Spanish]">Percepción ({(taxSettings?.percepcion_rate || 1)}%)</span>
                                                {isPercDirty ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsPercDirty(false)}
                                                        className="text-[7px] text-emerald-300 hover:text-white uppercase font-bold transition-colors"
                                                        title="Recalcular automáticamente el 1%"
                                                    >
                                                        Auto ↺
                                                    </button>
                                                ) : (
                                                    <span className="text-[7px] text-white/30 uppercase font-bold">Auto</span>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <MoneyInput
                                                    step="0.01"
                                                    value={manualPercepcion}
                                                    onChange={(e) => {
                                                        setManualPercepcion(e.target.value);
                                                        setIsPercDirty(true);
                                                    }}
                                                    onFocus={(e) => e.target.select()}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-emerald-500 group-hover:bg-white/10 text-white font-mono"
                                                    placeholder="0.00"
                                                />
                                                <Settings size={8} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-emerald-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-slate-400 uppercase text-[Spanish]">No Sujeta</span>
                                        <MoneyInput
                                            step="0.01"
                                            value={manualNosujeta}
                                            onChange={(e) => setManualNosujeta(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="0.00"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-indigo-500 group-hover:bg-white/10 text-white font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-slate-400 uppercase text-[Spanish]">Exenta</span>
                                        <MoneyInput
                                            step="0.01"
                                            value={manualExenta}
                                            onChange={(e) => setManualExenta(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="0.00"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-indigo-500 group-hover:bg-white/10 text-white font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 mt-4 text-[Spanish]">
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 leading-none">Total</span>
                                            <span className="text-[7px] font-black opacity-30 uppercase tracking-[0.1em] mt-1 leading-none">Neto a Liquidar</span>
                                        </div>
                                        <span className="text-2xl font-black text-white leading-none">${totals.total.toFixed(2)}</span>
                                    </div>
                                    <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50">
                                        {(createMutation.isPending || updateMutation.isPending) ? 'PROCESANDO...' : (isEditing ? 'ACTUALIZAR COMPRA' : 'GUARDAR COMPRA')}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => { resetForm(); setActiveTab('historial'); }} 
                                        className="w-full mt-2 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-400 hover:bg-white/5 rounded-xl transition-all"
                                    >
                                        {isEditing ? 'Cancelar Edición' : 'Volver al Listado'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[180px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value.toUpperCase())}
                                placeholder="BUSCAR POR FACTURA, PROVEEDOR..." 
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border-none rounded-xl outline-none text-[10px] font-bold uppercase tracking-tight" 
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={handleExportExcel} className="h-8 px-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-100 transition-all">
                                <FileSpreadsheet size={14} /> EXCEL
                            </button>
                            <button onClick={handleOpenPdfModal} className="h-8 px-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-rose-100 transition-all">
                                <FilePdf size={14} /> PDF
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                        <Table 
                            headers={['No. Doc', 'Tipo', 'Fecha', 'Proveedor', 'Total', 'Estado', 'Acciones']}
                            data={purchasesData?.data || []} isLoading={loadingHistory}
                            compact={true}
                            renderRow={(c) => (
                                <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 grow">
                                    <td className="px-5 py-1 font-black text-slate-800 text-[10px] uppercase tracking-tighter">
                                        <div>{c.numero_documento}</div>
                                        {c.numero_control && (
                                            <div className="text-[8px] font-mono text-indigo-600 font-bold tracking-tight">CTRL: {c.numero_control}</div>
                                        )}
                                        {c.sello_recepcion && (
                                            <div className="text-[7px] font-mono text-slate-400 truncate max-w-[140px]" title={c.sello_recepcion}>
                                                SELLO: {c.sello_recepcion.substring(0, 16)}...
                                            </div>
                                        )}
                                        {c.documento_afectado && <div className="text-[7px] text-rose-500 flex items-center gap-1 mt-0.5">REF: {c.documento_afectado}</div>}
                                    </td>
                                    <td className="px-5 py-1"><span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">{c.tipo_documento_nombre}</span></td>
                                    <td className="px-5 py-1 text-[9px] font-bold text-slate-400">{formatDate(c.fecha)}</td>
                                    <td className="px-5 py-1 text-[10px] font-bold text-slate-600 uppercase">{c.provider_nombre}</td>
                                    <td className="px-5 py-1 font-black text-slate-900 text-[10px]"><Money value={c.monto_total} /></td>
                                    <td className="px-5 py-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.status === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{c.status}</span>
                                    </td>
                                    <td className="px-5 py-1 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button 
                                                onClick={() => setViewingPurchase(c)} 
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Ver Detalle"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleEdit(c)} 
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadPDF(c.id, c.numero_documento)}
                                                className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Exportar PDF"
                                            >
                                                <FilePdf size={14} />
                                            </button>
                                            {c.status !== 'ANULADO' && (
                                                <button 
                                                    onClick={() => handleVoidPurchase(c.id)} 
                                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Anular"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        />
                         <Pagination 
                            currentPage={historyPage}
                            totalPages={purchasesData.totalPages}
                            totalItems={purchasesData.totalItems}
                            onPageChange={setHistoryPage}
                            itemsOnPage={purchasesData?.data?.length || 0}
                            isLoading={loadingHistory}
                            compact={true}
                        />
                    </div>
                </div>
            )}

            {viewingPurchase && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
                         <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                    <Eye size={16} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest leading-none">Detalle de Compra</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ref: {viewingPurchase.numero_documento}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingPurchase(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={16} /></button>
                         </div>

                         <div className="p-6 overflow-y-auto space-y-6">
                            {loadingDetail ? (
                                <div className="py-20 text-center space-y-3">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando información detallada...</p>
                                </div>
                            ) : purchaseDetail && (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Proveedor</label>
                                            <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{purchaseDetail.provider_nombre}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sucursal</label>
                                            <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{purchaseDetail.branch_nombre}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
                                            <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{new Date(purchaseDetail.fecha).toLocaleDateString()}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tipo Documento</label>
                                            <p className="text-[11px] font-bold text-indigo-600 uppercase leading-tight">{purchaseDetail.tipo_documento_nombre || viewingPurchase.tipo_documento_nombre || '---'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Documento / Cód. Generación</label>
                                            <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight font-mono">{purchaseDetail.numero_documento}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Número de Control</label>
                                            <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight font-mono">{purchaseDetail.numero_control || '---'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Estado</label>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${purchaseDetail.status === 'ANULADO' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {purchaseDetail.status}
                                            </span>
                                        </div>
                                        <div className="space-y-1 col-span-2 md:col-span-3">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sello de Recepción (MH)</label>
                                            <p className="text-[11px] font-mono text-slate-700 uppercase leading-tight break-all bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                                                {purchaseDetail.sello_recepcion || 'NO REGISTRADO'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <label className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 block border-b border-slate-100 pb-2">Productos Comprados</label>
                                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                    <tr>
                                                        <th className="px-4 py-2">Producto</th>
                                                        <th className="px-4 py-2 text-right">Cant</th>
                                                        <th className="px-4 py-2 text-right">Precio U.</th>
                                                        <th className="px-4 py-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {purchaseDetail.items?.map((item, idx) => (
                                                        <tr key={idx} className="text-[10px] font-bold text-slate-600">
                                                            <td className="px-4 py-2 uppercase italic">{item.nombre}</td>
                                                            <td className="px-4 py-2 text-right font-black text-slate-800">{parseFloat(item.cantidad).toFixed(2)}</td>
                                                            <td className="px-4 py-2 text-right text-slate-400"><Money value={item.precio_unitario} /></td>
                                                            <td className="px-4 py-2 text-right font-black text-indigo-600"><Money value={item.total} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center mt-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Monto Total Invertido</p>
                                            <div className="flex flex-wrap gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                                <span>Gravada: <Money value={purchaseDetail.total_gravada} /></span>
                                                <span>IVA: <Money value={purchaseDetail.iva} /></span>
                                                {parseFloat(purchaseDetail.fovial || 0) > 0 && (
                                                    <span className="text-amber-600">FOVIAL: <Money value={purchaseDetail.fovial} /></span>
                                                )}
                                                {parseFloat(purchaseDetail.cotrans || 0) > 0 && (
                                                    <span className="text-cyan-600">COTRANS: <Money value={purchaseDetail.cotrans} /></span>
                                                )}
                                                {parseFloat(purchaseDetail.retencion || 0) > 0 && (
                                                    <span className="text-rose-500">Retención: -<Money value={purchaseDetail.retencion} /></span>
                                                )}
                                                {parseFloat(purchaseDetail.percepcion || 0) > 0 && (
                                                    <span className="text-emerald-600">Percepción: +<Money value={purchaseDetail.percepcion} /></span>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-2xl font-black tracking-tighter text-indigo-600"><Money value={purchaseDetail.monto_total} /></p>
                                    </div>
                                </>
                            )}
                         </div>
                    </div>
                </div>
            )}
            <ProviderModal 
                isOpen={isProviderModalOpen}
                onClose={() => {
                    setIsProviderModalOpen(false);
                    setEditingProvider(null);
                }}
                provider={editingProvider}
                onSuccess={(savedProvider) => {
                    if (savedProvider && savedProvider.id) {
                        setProvidersCache(prev => ({ ...prev, [savedProvider.id]: savedProvider }));
                        setProviderId(String(savedProvider.id));
                    }
                }}
            />
            <ProductSelectionModal 
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                products={filteredProducts}
                handleSelect={handleSelectProduct}
                isLoading={isLoadingModalProducts}
                modalData={modalProductsData}
                modalPage={modalPage}
                setModalPage={setModalPage}
            />

            {/* Modal de Visualización Interactiva de Reporte PDF */}
            <PdfViewerModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                title="Reporte de Compras"
                subtitle={historySearch ? `Búsqueda: "${historySearch}"` : (branchId && branchId !== 'all' ? `Sucursal: ${branches.find(b => String(b.id) === String(branchId))?.nombre || ''}` : 'Historial general de compras')}
                badge="Formato Oficial"
                pdfUrl={pdfUrl}
                isLoading={isLoadingPdf}
                loadingText="Generando reporte de compras en formato contable oficial..."
                error={pdfError}
                onRetry={handleOpenPdfModal}
                fileName={`Reporte_Compras_${new Date().toISOString().split('T')[0]}.pdf`}
                footerNote="Formato contable estándar oficial • Presentación Carta sin firmas"
            />

            {/* Modal de Escaneo con Cámara Móvil vía Código QR */}
            <QrScanModal
                isOpen={isQrModalOpen}
                onClose={handleCloseQrModal}
                sessionId={qrSessionId}
                lanIp={qrLanIp}
                isLoading={qrLoading}
                error={qrError}
                status={qrStatus}
                onRetry={handleOpenQrModal}
                recognizeProducts={recognizeProducts}
                onToggleRecognizeProducts={setRecognizeProducts}
            />
        </div>
    );
};

const ProductSelectionModal = ({ isOpen, onClose, productSearch, setProductSearch, products, handleSelect, isLoading, modalData, modalPage, setModalPage }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 border-none">Seleccionar Producto</h3>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Buscador rápido de ítems para compra</p>
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
                        {isLoading ? (
                            <div className="col-span-full py-12 text-center text-slate-400 text-sm font-medium">Cargando productos...</div>
                        ) : products.map(p => (
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
                                    <div className="mt-2 text-[10px] font-black uppercase text-slate-400">Stock Actual: <span className="text-slate-900">{p.stock || 0}</span></div>
                                </div>
                            </button>
                        ))}
                        {!isLoading && products.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <Package size={40} className="mx-auto opacity-20 mb-2" />
                                <p className="font-bold uppercase tracking-widest text-xs italic">Cargue productos en el inventario para que aparezcan aquí</p>
                            </div>
                        )}
                    </div>
                </div>
                {modalData?.totalPages > 1 && (
                    <div className="border-t border-slate-100 p-4">
                        <Pagination
                            currentPage={modalPage}
                            totalPages={modalData.totalPages}
                            totalItems={modalData.total}
                            onPageChange={setModalPage}
                            itemsOnPage={products.length}
                            isLoading={isLoading}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const QrScanModal = ({ 
    isOpen, 
    onClose, 
    sessionId, 
    lanIp, 
    isLoading, 
    error, 
    status, 
    onRetry,
    recognizeProducts,
    onToggleRecognizeProducts
}) => {
    const [copied, setCopied] = useState(false);
    if (!isOpen) return null;

    const queryParam = recognizeProducts ? '?recognize_items=1' : '';
    let qrUrl = '';
    if (sessionId) {
        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && lanIp) {
            qrUrl = `${window.location.protocol}//${lanIp}:${window.location.port}/scan-dte/${sessionId}${queryParam}`;
        } else {
            qrUrl = `${window.location.origin}/scan-dte/${sessionId}${queryParam}`;
        }
    }

    const handleCopy = () => {
        if (!qrUrl) return;
        navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        toast.success('Enlace copiado al portapapeles');
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-slate-100">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-indigo-50/50 via-white to-violet-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                            <Smartphone size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">
                                Escanear con Teléfono
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium mt-1">
                                Usa la cámara de tu smartphone para capturar el DTE
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center text-center space-y-4">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center gap-3">
                            <Loader2 size={36} className="animate-spin text-indigo-600" />
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Generando sesión segura de escaneo...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="py-8 flex flex-col items-center gap-3">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                                <AlertCircle size={32} />
                            </div>
                            <p className="text-sm font-bold text-rose-700">{error}</p>
                            <button
                                onClick={onRetry}
                                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
                            >
                                <RefreshCw size={14} /> Reintentar
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Toggle Reconocimiento de Productos */}
                            <div className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-left">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                        <Package size={14} className="text-indigo-600" />
                                        <span>Reconocer productos con IA</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                        Extrae automáticamente las líneas de productos, cantidades y precios
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={recognizeProducts} 
                                        onChange={(e) => onToggleRecognizeProducts?.(e.target.checked)} 
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* QR Code Container */}
                            <div className="relative p-4 bg-white rounded-2xl border-2 border-indigo-100 shadow-inner flex items-center justify-center">
                                {sessionId && (
                                    <QRCodeSVG
                                        value={qrUrl}
                                        size={210}
                                        level="M"
                                        includeMargin={false}
                                        className="rounded-lg"
                                    />
                                )}

                                {status === 'processing' && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 gap-2 animate-in fade-in">
                                        <Loader2 size={36} className="animate-spin text-violet-600" />
                                        <span className="text-xs font-black uppercase tracking-wider text-violet-700">
                                            Analizando DTE con IA...
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-medium text-center">
                                            La foto fue recibida del teléfono. Extrayendo datos...
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Status Indicator */}
                            {status === 'pending' && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-full text-xs font-bold">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span>Esperando captura desde el teléfono...</span>
                                </div>
                            )}

                            {status === 'processing' && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200/70 rounded-full text-xs font-bold">
                                    <Loader2 size={13} className="animate-spin text-violet-600" />
                                    <span>Procesando imagen con IA...</span>
                                </div>
                            )}

                            {/* Steps / Instructions */}
                            <div className="w-full bg-slate-50 rounded-2xl p-3.5 text-left border border-slate-100 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Instrucciones rápidas:
                                </p>
                                <ol className="text-[12px] text-slate-600 space-y-1.5 font-medium">
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>Abre la app de cámara de tu teléfono y enfoca el código QR.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                                        <span>Toca el enlace para abrir la pantalla de escaneo móvil.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                                        <span>Toma la foto del DTE/factura física y presiona procesar.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">✓</span>
                                        <span>Los datos se completarán aquí automáticamente en tiempo real.</span>
                                    </li>
                                </ol>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {sessionId && !error && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            title="Copiar enlace directo"
                        >
                            {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            <span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Purchases;
