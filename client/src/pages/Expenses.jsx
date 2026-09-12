import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Plus, 
    Trash2, 
    Search, 
    X,
    Eye,
    FileSpreadsheet,
    Banknote,
    Edit2,
    Calendar,
    CheckCircle2,
    Settings2,
    AlertCircle,
    Building2,
    Receipt,
    SlidersHorizontal,
    ArrowLeft,
    Save,
    ChevronDown,
    ChevronUp,
    Info,
    RotateCcw,
    Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from '../components/ui/SearchableSelect';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money from '../components/ui/Money';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import ProviderModal from '../components/providers/ProviderModal';
import { getTodayString } from '../utils/dateUtils';

// Helper for date formatting DD/MM/YYYY
const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    try {
        const datePart = String(dateStr).split('T')[0];
        const [year, month, day] = datePart.split('-');
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
};

// 12 Months catalog
const MONTHS = [
    { value: 1, label: '01 - Enero' },
    { value: 2, label: '02 - Febrero' },
    { value: 3, label: '03 - Marzo' },
    { value: 4, label: '04 - Abril' },
    { value: 5, label: '05 - Mayo' },
    { value: 6, label: '06 - Junio' },
    { value: 7, label: '07 - Julio' },
    { value: 8, label: '08 - Agosto' },
    { value: 9, label: '09 - Septiembre' },
    { value: 10, label: '10 - Octubre' },
    { value: 11, label: '11 - Noviembre' },
    { value: 12, label: '12 - Diciembre' },
];

const currentYearVal = new Date().getFullYear();
const YEARS = Array.from({ length: 9 }, (_, i) => currentYearVal - 4 + i);

// Catálogo Oficial de los 9 Tipos de Documentos de Compras/Gastos (Ministerio de Hacienda)
const DOCUMENT_TYPES = [
    {
        code: '01',
        name: 'FACTURA',
        badge: 'CONSUMIDOR FINAL',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        description: 'Facturas de proveedores donde el IVA viene incluido en el costo y no genera crédito fiscal deducible.',
        hasIVA: false
    },
    {
        code: '02',
        name: 'CRÉDITO FISCAL',
        badge: 'CCF DEDUCIBLE',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold',
        description: 'Comprobante estándar emitido por contribuyentes inscritos en IVA con derecho a crédito fiscal deducible (13%).',
        hasIVA: true,
        isDefault: true
    },
    {
        code: '03',
        name: 'FACTURA DE EXPORTACIÓN',
        badge: 'EXPORTACIÓN',
        badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
        description: 'Facturas por compras o servicios vinculados directamente con operaciones o regímenes de exportación.',
        hasIVA: false
    },
    {
        code: '04',
        name: 'IMPORTACIONES',
        badge: 'ADUANA / PÓLIZA',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        description: 'Adquisiciones fuera de Centroamérica nacionalizadas con Declaración de Mercancías / Póliza de Importación.',
        hasIVA: true,
        isAduana: true
    },
    {
        code: '05',
        name: 'INTERNACIONES',
        badge: 'FAUCA / C.A.',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        description: 'Compras originarias de países centroamericanos amparadas en FAUCA o Mandamiento de Pago.',
        hasIVA: true,
        isFauca: true
    },
    {
        code: '06',
        name: 'COMPROBANTE DE RETENCIÓN',
        badge: 'RETENCIÓN IVA',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        description: 'Comprobante emitido por Grandes Contribuyentes cuando actúan como agentes de retención del 1% de IVA.',
        hasIVA: false
    },
    {
        code: '07',
        name: 'DOC. CONTABLE DE LIQUIDACIÓN',
        badge: 'LIQUIDACIÓN',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        description: 'Liquidaciones de seguros, comisiones mercantiles, distribuidores o pagos por cuenta de terceros.',
        hasIVA: false
    },
    {
        code: '08',
        name: 'NOTA DE DÉBITO',
        badge: 'INCREMENTO (+)',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        description: 'Ajuste al alza, intereses o cargos adicionales sobre un Crédito Fiscal previo. Requiere asociar el CCF afectado.',
        hasIVA: true,
        isDebito: true
    },
    {
        code: '09',
        name: 'NOTA DE CRÉDITO',
        badge: 'REBAJA / NC (-)',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
        description: 'Devolución, rebaja o descuento concedido sobre compras previas. Resta del crédito fiscal y total acumulado del período.',
        hasIVA: true,
        isCredito: true
    }
];

// Configuración y guía de campos tributarios a utilizar por cada tipo de documento (Anexo F-07 MH)
const DOC_TYPE_FIELD_CONFIG = {
    '01': {
        primary: ['totalGravada'],
        secondary: ['totalExenta', 'totalNosujeta', 'manualFovial', 'manualCotrans', 'manualAnticipoCuenta'],
        disabled: ['manualIVA', 'gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Factura Consumidor Final: Digita el valor en Compras Gravadas Locales (o Exentas). No genera IVA Crédito Fiscal deducible.'
    },
    '02': {
        primary: ['totalGravada', 'manualIVA'],
        secondary: ['totalExenta', 'totalNosujeta', 'manualRetencion', 'manualPercepcion', 'manualFovial', 'manualCotrans', 'manualAnticipoCuenta'],
        disabled: ['gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Crédito Fiscal: Digita la base en Compras Gravadas Locales; el IVA 13% se calcula automáticamente. Si aplica retención o percepción 1%, ingrésala en su respectivo campo.'
    },
    '03': {
        primary: ['totalGravada', 'totalExenta'],
        secondary: ['totalNosujeta'],
        disabled: ['manualIVA', 'gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Factura de Exportación: Utiliza Compras Gravadas o Exentas según la naturaleza de la adquisición.'
    },
    '04': {
        primary: ['gravadasImportaciones', 'ivaImportaciones'],
        secondary: ['totalGravada', 'totalExenta'],
        disabled: ['manualIVA', 'gravadasInternaciones'],
        tip: 'Importaciones (Póliza / Declaración): Digita el valor CIF en Gravadas Importaciones y el IVA pagado en aduana en IVA Importaciones.'
    },
    '05': {
        primary: ['gravadasInternaciones', 'manualIVA'],
        secondary: ['totalExenta'],
        disabled: ['gravadasImportaciones', 'ivaImportaciones'],
        tip: 'Internaciones (Centroamérica / FAUCA): Digita el valor en Gravadas Internaciones y el IVA Crédito Fiscal correspondiente.'
    },
    '06': {
        primary: ['manualRetencion'],
        secondary: [],
        disabled: ['totalGravada', 'totalExenta', 'totalNosujeta', 'manualIVA', 'gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Comprobante de Retención: Registra únicamente el monto retenido en el campo Retención 1%.'
    },
    '07': {
        primary: ['totalGravada', 'manualMontoSujeto', 'manualAnticipoCuenta'],
        secondary: ['totalExenta', 'manualRetencion', 'manualPercepcion'],
        disabled: ['gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Doc. Contable de Liquidación: Para comprobantes de liquidación se ingresa el Monto Sujeto y el Anticipo a Cuenta, además del valor liquidado.'
    },
    '08': {
        primary: ['totalGravada', 'manualIVA'],
        secondary: [],
        disabled: ['gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Nota de Débito (+): Digita el incremento en Compras Gravadas Locales y su IVA 13%. Incrementará el costo y crédito fiscal.'
    },
    '09': {
        primary: ['totalGravada', 'manualIVA'],
        secondary: [],
        disabled: ['gravadasImportaciones', 'gravadasInternaciones', 'ivaImportaciones'],
        tip: 'Nota de Crédito (-): Digita el valor a rebajar en Compras Gravadas Locales y su IVA 13%. El sistema deducirá estos valores.'
    }
};

// Catálogos Oficiales F-07 (Ministerio de Hacienda El Salvador)
const F07_TIPOS_OPERACION = [
    { code: '1', label: '1 - GRAVADA' },
    { code: '2', label: '2 - NO GRAVADA O EXENTA' },
    { code: '3', label: '3 - EXCLUIDO' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const F07_TIPOS_CLASIFICACION = [
    { code: '1', label: '1 - COSTO' },
    { code: '2', label: '2 - GASTO' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const F07_TIPOS_SECTOR = [
    { code: '1', label: '1 - INDUSTRIA' },
    { code: '2', label: '2 - COMERCIO' },
    { code: '3', label: '3 - AGROPECUARIA' },
    { code: '4', label: '4 - SERVICIOS, PROFESIONES' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const F07_TIPOS_COSTO = [
    { code: '1', label: '1 - GASTO DE VENTA SIN DONACION' },
    { code: '2', label: '2 - GASTO DE ADMINISTRACION SIN DONACION' },
    { code: '3', label: '3 - GASTOS FINANCIEROS SIN DONACION' },
    { code: '4', label: '4 - COSTO ARTICULOS PRODUCIDOS IMPORTACIONES' },
    { code: '5', label: '5 - COSTO ARTICULOS PRODUCIDOS INTERNOS' },
    { code: '6', label: '6 - COSTOS INDIRECTOS DE FABRICACION' },
    { code: '7', label: '7 - MANO DE OBRA' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const Expenses = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Query Filters & Period Consultation State
    const now = new Date();
    const [filterYear, setFilterYear] = useState(now.getFullYear());
    const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyLimit, setHistoryLimit] = useState(15);
    const [filterBranchId, setFilterBranchId] = useState('');

    // Active Period Modal State
    const [modalPeriodoOpen, setModalPeriodoOpen] = useState(false);
    const [nuevoPeriodoMes, setNuevoPeriodoMes] = useState(now.getMonth() + 1);
    const [nuevoPeriodoAnio, setNuevoPeriodoAnio] = useState(now.getFullYear());

    // Expense Form In-Page State (Sin Modal)
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Detail View Modal State
    const [viewingExpense, setViewingExpense] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Form Header State
    const [branchId, setBranchId] = useState(user?.branch_id ? String(user.branch_id) : '');
    const [providerId, setProviderId] = useState('');
    const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [tipoDocId, setTipoDocId] = useState('02'); // Default 02 Crédito Fiscal
    const [condicionId, setCondicionId] = useState('01'); // Default Contado
    const [numeroDoc, setNumeroDoc] = useState('');
    const [numControl, setNumControl] = useState('');
    const [selloRecepcion, setSelloRecepcion] = useState('');
    const [fecha, setFecha] = useState(getTodayString());
    const [periodYear, setPeriodYear] = useState(now.getFullYear());
    const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
    const [isPeriodDirty, setIsPeriodDirty] = useState(false);
    const [observaciones, setObservaciones] = useState('');

    // Credit Note / Debit Note Specific Fields
    const [documentoAfectado, setDocumentoAfectado] = useState('');
    const [fechaAfectada, setFechaAfectada] = useState('');

    // Catálogos F-07 MH State
    const [tipoOperacion, setTipoOperacion] = useState('1'); // 1 Gravada
    const [tipoClasificacion, setTipoClasificacion] = useState('2'); // 2 Gasto
    const [tipoSector, setTipoSector] = useState('4'); // 4 Servicios/Profesiones
    const [tipoCosto, setTipoCosto] = useState('2'); // 2 Gasto de Administración
    const [isF07Open, setIsF07Open] = useState(false);

    // Form Direct Tax Amounts State
    const [totalGravada, setTotalGravada] = useState(0);
    const [totalExenta, setTotalExenta] = useState(0);
    const [totalNosujeta, setTotalNosujeta] = useState(0);
    const [gravadasImportaciones, setGravadasImportaciones] = useState(0);
    const [gravadasInternaciones, setGravadasInternaciones] = useState(0);
    const [ivaImportaciones, setIvaImportaciones] = useState(0);

    // Form & Button Refs for Keyboard Navigation
    const formRef = useRef(null);
    const submitBtnRef = useRef(null);
    const dteFileInputRef = useRef(null);
    const [isScanningDte, setIsScanningDte] = useState(false);

    // Summary / Totals State
    const [totals, setTotals] = useState({
        nosujeta: 0,
        exenta: 0,
        gravada: 0,
        gravadas_importaciones: 0,
        gravadas_internaciones: 0,
        iva_importaciones: 0,
        iva: 0,
        retencion: 0,
        percepcion: 0,
        fovial: 0,
        cotrans: 0,
        anticipo_cuenta: 0,
        monto_sujeto: 0,
        total: 0
    });

    // Manual Overrides
    const [manualIVA, setManualIVA] = useState(0);
    const [manualRetencion, setManualRetencion] = useState(0);
    const [manualPercepcion, setManualPercepcion] = useState(0);
    const [manualFovial, setManualFovial] = useState(0);
    const [manualCotrans, setManualCotrans] = useState(0);
    const [manualAnticipoCuenta, setManualAnticipoCuenta] = useState(0);
    const [manualMontoSujeto, setManualMontoSujeto] = useState(0);

    // Dirty Flags
    const [isIvaDirty, setIsIvaDirty] = useState(false);
    const [isRetDirty, setIsRetDirty] = useState(false);
    const [isPercDirty, setIsPercDirty] = useState(false);

    useDirtyTracker('gastos-form', isFormOpen && (parseFloat(totalGravada) > 0 || parseFloat(totalExenta) > 0 || parseFloat(totalNosujeta) > 0 || !!providerId || !!numeroDoc));

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

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', user?.company_id],
        queryFn: async () => (await axios.get('/api/branches')).data
    });


    const { data: condiciones = [] } = useQuery({
        queryKey: ['catalog', '016'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_016_condicion_operacion')).data
    });

    const { data: activePeriod } = useQuery({
        queryKey: ['active-period', user?.company_id],
        queryFn: async () => {
            const resp = await axios.get('/api/period-purchases');
            return resp.data;
        },
        retry: false
    });

    // Sincronizar consulta con período activo la primera vez
    useEffect(() => {
        if (activePeriod?.year && activePeriod?.month) {
            setNuevoPeriodoMes(activePeriod.month);
            setNuevoPeriodoAnio(activePeriod.year);
        }
    }, [activePeriod]);

    const { data: taxSettings } = useQuery({
        queryKey: ['tax-settings'],
        queryFn: async () => (await axios.get('/api/taxes')).data,
    });

    // Expenses History Query
    const { data: expensesData, isLoading: loadingHistory } = useQuery({
        queryKey: ['expenses-history', historySearch, historyPage, historyLimit, filterBranchId, filterYear, filterMonth],
        queryFn: async () => (await axios.get('/api/expenses', { 
            params: { 
                search: historySearch, 
                page: historyPage, 
                limit: historyLimit,
                branch_id: filterBranchId || undefined,
                year: filterYear,
                month: filterMonth
            } 
        })).data
    });

    // Helper: es Nota de Crédito
    const esNotaCredito = tipoDocId === '09';
    const esNotaDebito = tipoDocId === '08';
    const currentDocType = useMemo(() => {
        return DOCUMENT_TYPES.find(d => d.code === tipoDocId) || DOCUMENT_TYPES[1];
    }, [tipoDocId]);

    const activeFieldConfig = useMemo(() => {
        return DOC_TYPE_FIELD_CONFIG[tipoDocId] || DOC_TYPE_FIELD_CONFIG['02'];
    }, [tipoDocId]);

    const getFieldMeta = (fieldKey) => {
        const isPrimary = activeFieldConfig.primary.includes(fieldKey);
        const isSecondary = activeFieldConfig.secondary.includes(fieldKey);
        const isDisabled = activeFieldConfig.disabled?.includes(fieldKey);
        return { isPrimary, isSecondary, isDisabled };
    };

    // Handle date changes
    const handleFechaChange = (e) => {
        const val = e.target.value;
        setFecha(val);
        if (val && !isPeriodDirty) {
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

    // Tax Logic
    useEffect(() => {
        const gravada = parseFloat(totalGravada) || 0;
        const exenta = parseFloat(totalExenta) || 0;
        const nosujeta = parseFloat(totalNosujeta) || 0;
        const gImp = parseFloat(gravadasImportaciones) || 0;
        const gInt = parseFloat(gravadasInternaciones) || 0;
        const ivaImp = parseFloat(ivaImportaciones) || 0;

        const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
        // Factura tradicional (01) o Factura de Exportación (03) no generan crédito fiscal deducible separado
        const noDeduceIva = tipoDocId === '01' || tipoDocId === '03' || tipoDocId === '06' || tipoDocId === '07' || selectedProvider?.exento_iva;
        let ivaCalculated = noDeduceIva ? 0 : (gravada * ivaRate);
        ivaCalculated = Math.round(ivaCalculated * 100) / 100;

        let retencion = 0;
        const nosAgenteRetencion = currentCompany?.tipo_contribuyente === 'Grande';
        const proveedNoGC = !selectedProvider?.es_gran_contribuyente;
        const retencionRate = parseFloat(taxSettings?.retencion_rate || 1) / 100;
        
        if (nosAgenteRetencion && proveedNoGC && gravada >= 100 && (tipoDocId === '02' || tipoDocId === '08')) {
            retencion = Math.round((gravada * retencionRate) * 100) / 100;
        }

        let percepcion = 0;
        const proveedAgentePerc = selectedProvider?.es_gran_contribuyente;
        const nosNoGC = currentCompany?.tipo_contribuyente !== 'Grande';
        const percepcionRate = parseFloat(taxSettings?.percepcion_rate || 1) / 100;

        if (proveedAgentePerc && nosNoGC && (tipoDocId === '02' || tipoDocId === '08')) {
            percepcion = Math.round((gravada * percepcionRate) * 100) / 100;
        }

        if (!isIvaDirty) setManualIVA(ivaCalculated);
        if (!isRetDirty) setManualRetencion(retencion);
        if (!isPercDirty) setManualPercepcion(percepcion);

        const currentIva = parseFloat(isIvaDirty ? manualIVA : ivaCalculated) || 0;
        const currentRet = parseFloat(isRetDirty ? manualRetencion : retencion) || 0;
        const currentPerc = parseFloat(isPercDirty ? manualPercepcion : percepcion) || 0;
        const currentFov = parseFloat(manualFovial) || 0;
        const currentCot = parseFloat(manualCotrans) || 0;
        const currentAnt = parseFloat(manualAnticipoCuenta) || 0;
        const currentMontoSujeto = parseFloat(manualMontoSujeto) || 0;

        // Si es Nota de Crédito, el total y el IVA representan una deducción (resta)
        const subtotalNeto = gravada + exenta + nosujeta + gImp + gInt;
        let finalTotal = 0;
        if (esNotaCredito) {
            finalTotal = -(subtotalNeto + currentIva);
        } else {
            finalTotal = subtotalNeto + currentIva + ivaImp - currentRet + currentPerc + currentFov + currentCot;
        }

        setTotals({
            gravada,
            exenta,
            nosujeta,
            gravadas_importaciones: gImp,
            gravadas_internaciones: gInt,
            iva_importaciones: ivaImp,
            iva: currentIva,
            retencion: currentRet,
            percepcion: currentPerc,
            fovial: currentFov,
            cotrans: currentCot,
            anticipo_cuenta: currentAnt,
            monto_sujeto: currentMontoSujeto,
            total: Math.round(finalTotal * 100) / 100
        });

    }, [totalGravada, totalExenta, totalNosujeta, gravadasImportaciones, gravadasInternaciones, ivaImportaciones, tipoDocId, esNotaCredito, selectedProvider, currentCompany, isIvaDirty, isRetDirty, isPercDirty, manualIVA, manualRetencion, manualPercepcion, manualFovial, manualCotrans, manualAnticipoCuenta, manualMontoSujeto, taxSettings]);

    const handleGravadaChange = (e) => {
        const val = e.target.value;
        setTotalGravada(val);
        if (!isIvaDirty) {
            const num = parseFloat(val) || 0;
            if (currentDocType.hasIVA) {
                setManualIVA(Math.round(num * 0.13 * 100) / 100);
            } else {
                setManualIVA(0);
            }
        }
    };

    const handleResetIvaAuto = () => {
        setIsIvaDirty(false);
        const num = parseFloat(totalGravada) || 0;
        if (currentDocType.hasIVA) {
            setManualIVA(Math.round(num * 0.13 * 100) / 100);
        } else {
            setManualIVA(0);
        }
    };

    const handleFocusSelect = (e) => {
        if (e.target && typeof e.target.select === 'function') {
            e.target.select();
        }
    };

    // Escanear factura física o DTE digital con Inteligencia Artificial
    const handleScanDteFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = '';
        setIsScanningDte(true);
        const loadingToast = toast.loading('Analizando documento / DTE con Inteligencia Artificial...');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios.post('/api/expenses/scan-dte', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const data = res.data?.data;
            if (!data) throw new Error('No se pudieron extraer datos del documento');

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

            // 4. Tipo de Documento (Mapeo DTE MH a Catálogo Gastos/Libro de Compras)
            let mappedTipoDoc = '02'; // default Crédito Fiscal
            if (data.tipo_documento_id === '01') {
                mappedTipoDoc = '01'; // Factura
            } else if (data.tipo_documento_id === '03' || data.tipo_documento_id === '02') {
                mappedTipoDoc = '02'; // CCF
            } else if (data.tipo_documento_id === '05' || data.tipo_documento_id === '09') {
                mappedTipoDoc = '09'; // Nota de Crédito
            } else if (data.tipo_documento_id === '06' || data.tipo_documento_id === '08') {
                mappedTipoDoc = '08'; // Nota de Débito
            } else if (DOCUMENT_TYPES.some(d => d.code === data.tipo_documento_id)) {
                mappedTipoDoc = data.tipo_documento_id;
            }

            setTipoDocId(mappedTipoDoc);
            filledFields.push('Tipo Doc');

            // 5. Fecha de Emisión y Período
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

            // 7. Totales e Impuestos
            if (data.totales) {
                const gravada = parseFloat(data.totales.total_gravada) || 0;
                const exenta = parseFloat(data.totales.total_exenta) || 0;
                const nosujeta = parseFloat(data.totales.total_nosujeta) || 0;
                const iva = parseFloat(data.totales.iva) || 0;
                const ret = parseFloat(data.totales.retencion) || 0;
                const perc = parseFloat(data.totales.percepcion) || 0;
                const total = parseFloat(data.totales.monto_total) || 0;

                if (gravada > 0) {
                    setTotalGravada(gravada);
                    filledFields.push(`Gravada ($${gravada.toFixed(2)})`);
                } else if (total > 0 && mappedTipoDoc === '01') {
                    setTotalGravada(total);
                    filledFields.push(`Total ($${total.toFixed(2)})`);
                }

                if (exenta > 0) {
                    setTotalExenta(exenta);
                    filledFields.push('Exenta');
                }
                if (nosujeta > 0) {
                    setTotalNosujeta(nosujeta);
                    filledFields.push('No Sujeta');
                }

                if (iva > 0) {
                    setManualIVA(iva);
                    setIsIvaDirty(true);
                    filledFields.push(`IVA ($${iva.toFixed(2)})`);
                } else if (mappedTipoDoc === '02' && gravada > 0) {
                    setManualIVA(Math.round(gravada * 0.13 * 100) / 100);
                    setIsIvaDirty(false);
                }

                if (ret > 0) {
                    setManualRetencion(ret);
                    setIsRetDirty(true);
                    filledFields.push('Retención');
                }

                if (perc > 0) {
                    setManualPercepcion(perc);
                    setIsPercDirty(true);
                    filledFields.push('Percepción');
                }

                if (data.totales?.anticipo_cuenta || data.anticipo_cuenta) {
                    const antVal = parseFloat(data.totales?.anticipo_cuenta || data.anticipo_cuenta) || 0;
                    if (antVal > 0) {
                        setManualAnticipoCuenta(antVal);
                        filledFields.push(`Anticipo Cuenta ($${antVal.toFixed(2)})`);
                    }
                }

                if (data.totales?.monto_sujeto || data.monto_sujeto) {
                    const msVal = parseFloat(data.totales?.monto_sujeto || data.monto_sujeto) || 0;
                    if (msVal > 0) {
                        setManualMontoSujeto(msVal);
                        filledFields.push(`Monto Sujeto ($${msVal.toFixed(2)})`);
                    }
                }
            }

            toast.dismiss(loadingToast);
            if (filledFields.length > 0) {
                toast.success(`Datos detectados: ${filledFields.join(', ')}`, { duration: 6000 });
            } else {
                toast.info('No se detectaron campos legibles en el documento.');
            }

        } catch (err) {
            console.error('Error al escanear DTE en gastos:', err);
            toast.dismiss(loadingToast);
            toast.error(err.response?.data?.message || 'Error al procesar el documento con IA');
        } finally {
            setIsScanningDte(false);
        }
    };

    // Navegación secuencial ultra-rápida con tecla ENTER a lo largo de todo el formulario
    const handleFormKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.target.tagName === 'TEXTAREA') return;
            if (e.target.type === 'submit') return;
            // No interceptar si está en panel de opciones de SearchableSelect
            if (e.target.closest('.searchable-select-panel') || e.target.getAttribute('role') === 'option') return;

            e.preventDefault();

            const form = formRef.current;
            if (!form) return;

            // Elementos interactivos en orden DOM
            const selector = 'input:not([disabled]):not([type="hidden"]):not([readonly]), select:not([disabled]), [role="button"][tabindex="0"]:not([disabled]), button[type="submit"]:not([disabled])';
            const focusable = Array.from(form.querySelectorAll(selector)).filter(el => {
                if (el.classList.contains('skip-enter-nav')) return false;
                return el.offsetParent !== null; // elemento visible
            });

            const currentIndex = focusable.indexOf(e.target);
            if (currentIndex > -1 && currentIndex < focusable.length - 1) {
                const nextEl = focusable[currentIndex + 1];
                nextEl.focus();
                if (nextEl.select && typeof nextEl.select === 'function') {
                    nextEl.select();
                }
            } else if (currentIndex === focusable.length - 1) {
                submitBtnRef.current?.focus();
            }
        }
    };

    const resetForm = () => {
        setNumeroDoc('');
        setNumControl('');
        setSelloRecepcion('');
        setDocumentoAfectado('');
        setFechaAfectada('');
        setObservaciones('');
        setProviderId('');
        setBranchId(user?.branch_id ? String(user.branch_id) : '');
        setTipoDocId('02');
        setCondicionId('01');
        setTipoOperacion('1');
        setTipoClasificacion('2');
        setTipoSector('4');
        setTipoCosto('2');
        setIsF07Open(false);
        setTotalGravada(0);
        setTotalExenta(0);
        setTotalNosujeta(0);
        setGravadasImportaciones(0);
        setGravadasInternaciones(0);
        setIvaImportaciones(0);
        setManualIVA(0);
        setManualRetencion(0);
        setManualPercepcion(0);
        setManualFovial(0);
        setManualCotrans(0);
        setManualAnticipoCuenta(0);
        setManualMontoSujeto(0);
        setIsIvaDirty(false);
        setIsRetDirty(false);
        setIsPercDirty(false);

        const today = getTodayString();
        setFecha(today);
        const [y, m] = today.split('-').map(Number);
        const targetY = filterYear || y;
        const targetM = filterMonth || m;
        setPeriodYear(targetY);
        setPeriodMonth(targetM);
        setIsPeriodDirty(targetY !== y || targetM !== m);
        setIsEditing(false);
        setEditingId(null);
    };

    const openCreateModal = () => {
        resetForm();
        setIsFormOpen(true);
    };

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/expenses', data),
        onSuccess: () => {
            toast.success('Gasto registrado correctamente');
            setIsFormOpen(false);
            resetForm();
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al procesar registro')
    });
    
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => axios.put(`/api/expenses/${id}`, data),
        onSuccess: () => {
            toast.success('Gasto actualizado correctamente');
            setIsFormOpen(false);
            resetForm();
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar gasto')
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/expenses/${id}/void`),
        onSuccess: () => {
            toast.success('Gasto anulado correctamente');
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al anular gasto')
    });

    const updatePeriodMutation = useMutation({
        mutationFn: ({ year, month }) => axios.post('/api/period-purchases', { year, month }),
        onSuccess: (_, variables) => {
            toast.success('Período activo actualizado exitosamente');
            setFilterYear(variables.year);
            setFilterMonth(variables.month);
            setModalPeriodoOpen(false);
            queryClient.invalidateQueries(['active-period']);
            queryClient.invalidateQueries(['expenses-history']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar período activo')
    });

    const handleVoidExpense = async (id, numero) => {
        const ok = await confirm({
            title: `¿Anular gasto ${numero || ''}?`,
            message: 'El documento quedará marcado como ANULADO en el historial y se revertirán sus efectos contables. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, anular gasto',
            variant: 'warning',
        });
        if (ok) voidMutation.mutate(id);
    };

    const handleEdit = async (expense) => {
        const loadToast = toast.loading('Cargando datos del gasto...');
        try {
            const { data: detail } = await axios.get(`/api/expenses/${expense.id}`);
            setEditingId(expense.id);
            setIsEditing(true);
            setBranchId(String(detail.branch_id || ''));
            setProviderId(String(detail.provider_id || ''));
            
            if (detail.provider_nombre && detail.provider_id) {
                try {
                    const { data: res } = await axios.get('/api/providers', { params: { search: detail.provider_nombre, limit: 50 } });
                    const full = (res.data || []).find(p => String(p.id) === String(detail.provider_id));
                    setProvidersCache(prev => ({ ...prev, [detail.provider_id]: full || { id: detail.provider_id, nombre: detail.provider_nombre } }));
                } catch {}
            }

            setTipoDocId(detail.tipo_documento_id || '02');
            setCondicionId(detail.condicion_operacion_id || '01');
            setNumeroDoc((detail.numero_documento || '').toUpperCase());
            setNumControl((detail.num_control || '').toUpperCase());
            setSelloRecepcion((detail.sello_recepcion || '').toUpperCase());
            setDocumentoAfectado((detail.documento_afectado || '').toUpperCase());
            setFechaAfectada(detail.fecha_afectada ? String(detail.fecha_afectada).split('T')[0] : '');

            // Clasificación F-07 MH
            setTipoOperacion(detail.tipo_operacion || '1');
            setTipoClasificacion(detail.tipo_clasificacion || '2');
            setTipoSector(detail.tipo_sector || '4');
            setTipoCosto(detail.tipo_costo || '2');

            setFecha(new Date(detail.fecha).toISOString().split('T')[0]);
            if (detail.period_year && detail.period_month) {
                setPeriodYear(parseInt(detail.period_year, 10));
                setPeriodMonth(parseInt(detail.period_month, 10));
            } else {
                const d = new Date(detail.fecha);
                setPeriodYear(d.getFullYear());
                setPeriodMonth(d.getMonth() + 1);
            }
            setIsPeriodDirty(true);

            setObservaciones((detail.observaciones || '').toUpperCase());
            setTotalGravada(parseFloat(detail.total_gravada || 0));
            setTotalExenta(parseFloat(detail.total_exenta || 0));
            setTotalNosujeta(parseFloat(detail.total_nosujeta || 0));
            setGravadasImportaciones(parseFloat(detail.gravadas_importaciones || 0));
            setGravadasInternaciones(parseFloat(detail.gravadas_internaciones || 0));
            setIvaImportaciones(parseFloat(detail.iva_importaciones || 0));
            setManualIVA(parseFloat(detail.iva || 0));
            setManualRetencion(parseFloat(detail.retencion || 0));
            setManualPercepcion(parseFloat(detail.percepcion || 0));
            setManualFovial(parseFloat(detail.fovial || 0));
            setManualCotrans(parseFloat(detail.cotrans || 0));
            setManualAnticipoCuenta(parseFloat(detail.anticipo_cuenta || 0));
            setManualMontoSujeto(parseFloat(detail.monto_sujeto || 0));
            setIsIvaDirty(true);
            setIsRetDirty(true);
            setIsPercDirty(true);

            setIsFormOpen(true);
            toast.dismiss(loadToast);
        } catch (error) {
            toast.dismiss(loadToast);
            toast.error('Error al cargar detalle del gasto');
        }
    };

    const handleViewDetail = async (expense) => {
        const loadToast = toast.loading('Cargando información...');
        try {
            const { data: detail } = await axios.get(`/api/expenses/${expense.id}`);
            setViewingExpense(detail);
            setIsDetailModalOpen(true);
            toast.dismiss(loadToast);
        } catch {
            toast.dismiss(loadToast);
            toast.error('Error al consultar detalle');
        }
    };

    const handleSubmitForm = (e) => {
        if (e) e.preventDefault();
        if (!branchId) return toast.error('Seleccione la sucursal');
        if (!providerId) return toast.error('Seleccione el proveedor');
        if (!numeroDoc.trim()) return toast.error('Ingrese el número de documento');

        // Validar Nota de Crédito / Débito
        if ((esNotaCredito || esNotaDebito) && !documentoAfectado.trim()) {
            return toast.error('Debe ingresar el Documento Afectado para este tipo de comprobante');
        }

        const grav = parseFloat(totalGravada) || 0;
        const exe = parseFloat(totalExenta) || 0;
        const nos = parseFloat(totalNosujeta) || 0;
        const gImp = parseFloat(gravadasImportaciones) || 0;
        const gInt = parseFloat(gravadasInternaciones) || 0;
        const totalBases = grav + exe + nos + gImp + gInt;

        const isLiquidacion = tipoDocId === '07';
        if (totalBases === 0 && totals.total === 0 && !esNotaCredito && (!isLiquidacion || (totals.monto_sujeto === 0 && totals.anticipo_cuenta === 0))) {
            return toast.error('Debe ingresar al menos un monto en compras gravadas, exentas o no sujetas');
        }

        let docYear = new Date().getFullYear();
        let docMonth = new Date().getMonth() + 1;
        if (fecha) {
            const parts = fecha.split('T')[0].split('-');
            if (parts.length >= 2) {
                docYear = parseInt(parts[0], 10) || docYear;
                docMonth = parseInt(parts[1], 10) || docMonth;
            }
        }
        let finalPeriodYear = periodYear || activePeriod?.year || docYear;
        let finalPeriodMonth = periodMonth || activePeriod?.month || docMonth;

        if (!isPeriodDirty && (finalPeriodYear < docYear || (finalPeriodYear === docYear && finalPeriodMonth < docMonth))) {
            finalPeriodYear = docYear;
            finalPeriodMonth = docMonth;
        }

        const payload = {
            branch_id: branchId,
            provider_id: providerId,
            fecha,
            numero_documento: (numeroDoc || '').trim().toUpperCase(),
            num_control: (numControl || '').trim().toUpperCase() || null,
            sello_recepcion: (selloRecepcion || '').trim().toUpperCase() || null,
            documento_afectado: (esNotaCredito || esNotaDebito) ? (documentoAfectado || '').trim().toUpperCase() : null,
            fecha_afectada: (esNotaCredito || esNotaDebito) ? (fechaAfectada || null) : null,
            tipo_documento_id: tipoDocId,
            condicion_operacion_id: condicionId,
            observaciones: (observaciones || '').trim().toUpperCase() || 'GASTO REGISTRADO',
            tipo_operacion: tipoOperacion,
            tipo_clasificacion: tipoClasificacion,
            tipo_sector: tipoSector,
            tipo_costo: tipoCosto,
            total_nosujeta: totals.nosujeta,
            total_exenta: totals.exenta,
            total_gravada: totals.gravada,
            gravadas_importaciones: totals.gravadas_importaciones || 0,
            gravadas_internaciones: totals.gravadas_internaciones || 0,
            iva_importaciones: totals.iva_importaciones || 0,
            iva: totals.iva,
            retencion: totals.retencion,
            percepcion: totals.percepcion,
            fovial: totals.fovial,
            cotrans: totals.cotrans,
            anticipo_cuenta: totals.anticipo_cuenta || 0,
            monto_sujeto: totals.monto_sujeto || 0,
            monto_total: totals.total,
            period_year: finalPeriodYear,
            period_month: finalPeriodMonth,
            items: [{
                description: (observaciones || '').trim().toUpperCase() || 'GASTO REGISTRADO',
                expense_type_id: null,
                tax_type: grav > 0 ? 'gravada' : (exe > 0 ? 'exenta' : 'nosujeta'),
                total: totals.total || totals.monto_sujeto || 0
            }]
        };

        if (isEditing && editingId) {
            updateMutation.mutate({ id: editingId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleExportExcel = () => {
        if (!expensesData?.data || expensesData.data.length === 0) {
            return toast.error('No hay datos en el período para exportar');
        }
        const data = expensesData.data.map(e => ({
            ID: e.id,
            FECHA: formatDate(e.fecha),
            TIPO_DOC: e.tipo_documento_id,
            DOCUMENTO: e.numero_documento,
            NUM_CONTROL: e.num_control || '',
            PROVEEDOR: e.provider_nombre,
            NRC: e.provider_nrc || '',
            NIT: e.provider_nit || '',
            GRAVADAS: parseFloat(e.total_gravada || 0),
            EXENTAS: parseFloat(e.total_exenta || 0),
            NO_SUJETAS: parseFloat(e.total_nosujeta || 0),
            IVA_CREDITO: parseFloat(e.iva || 0),
            RETENCION: parseFloat(e.retencion || 0),
            ANTICIPO_CUENTA: parseFloat(e.anticipo_cuenta || 0),
            MONTO_SUJETO: parseFloat(e.monto_sujeto || 0),
            TOTAL: parseFloat(e.monto_total || 0),
            ESTADO: e.status,
            PERIODO: `${e.period_month || ''}/${e.period_year || ''}`
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gastos");
        XLSX.writeFile(wb, `Historial_Gastos_${filterMonth}_${filterYear}.xlsx`);
    };

    const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[12px] font-semibold text-slate-800 uppercase";
    const labelCls = "block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5";

    const summaryData = expensesData?.summary || {
        total_monto: 0,
        total_gravada: 0,
        total_iva: 0,
        total_retencion: 0,
        total_anticipo_cuenta: 0
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-4 text-slate-800">
            {!isFormOpen ? (
                <>
                    {/* Header de Página */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                            <Receipt size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase leading-none">
                                Gestión de Gastos Operativos e IVA
                            </h1>
                            <p className="text-xs font-medium text-slate-500 mt-1">
                                Control contable, compras de servicios y auditoría tributaria conforme al Ministerio de Hacienda
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Input oculto para escanear DTE desde listado */}
                    <input 
                        type="file" 
                        ref={dteFileInputRef} 
                        onChange={handleScanDteFile} 
                        accept="image/*,.pdf" 
                        capture="environment"
                        className="hidden" 
                    />
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm active:scale-95"
                        title="Exportar registros a Excel"
                    >
                        <FileSpreadsheet size={15} className="text-emerald-600" />
                        <span>Exportar</span>
                    </button>
                    <button 
                        type="button"
                        onClick={() => {
                            openCreateModal();
                            setTimeout(() => dteFileInputRef.current?.click(), 150);
                        }}
                        className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer"
                        title="Abrir formulario y escanear DTE con IA"
                    >
                        <Sparkles size={15} className="text-amber-300" />
                        <span>Escanear DTE (IA)</span>
                    </button>
                    <button 
                        type="button"
                        onClick={openCreateModal} 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
                    >
                        <Plus size={16} />
                        <span>Registrar Gasto</span>
                    </button>
                </div>
            </div>

            {/* Banner Período Activo y Selector de Consulta (Referencia ComprasIvaPage) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Selector de Consulta */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Calendar size={18} className="text-indigo-600" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                                Consultando Período:
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={filterMonth}
                                onChange={(e) => {
                                    setFilterMonth(parseInt(e.target.value, 10));
                                    setHistoryPage(1);
                                }}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all"
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <select
                                value={filterYear}
                                onChange={(e) => {
                                    setFilterYear(parseInt(e.target.value, 10));
                                    setHistoryPage(1);
                                }}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all"
                            >
                                {YEARS.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtro Sucursal Opcional */}
                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                            <Building2 size={15} className="text-slate-400" />
                            <select
                                value={filterBranchId}
                                onChange={(e) => {
                                    setFilterBranchId(e.target.value);
                                    setHistoryPage(1);
                                }}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                            >
                                <option value="">Todas las Sucursales</option>
                                {(Array.isArray(branches) ? branches : []).map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Badge Período de Compras Activo con Botón Cambiar */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 bg-emerald-50/70 border border-emerald-200/80 px-3.5 py-2 rounded-xl">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <span className="text-xs text-emerald-900 font-medium">
                                Período de Compras Activo:{' '}
                                <strong className="font-bold text-emerald-950">
                                    {activePeriod?.month && activePeriod?.year
                                        ? `${MONTHS.find(m => m.value === activePeriod.month)?.label.split(' - ')[1] || activePeriod.month} ${activePeriod.year}`
                                        : 'No configurado'}
                                </strong>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setModalPeriodoOpen(true)}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-2xs active:scale-95"
                            title="Cambiar el período activo de compras y gastos de la empresa"
                        >
                            <Settings2 size={13} />
                            <span>Cambiar Activo</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tarjetas KPI de Resumen del Período */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Total Gastos del Mes
                    </span>
                    <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                        <Money value={summaryData.total_monto} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1">
                        <Receipt size={12} className="text-indigo-500" />
                        {expensesData?.total || 0} documento(s)
                    </span>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Base Gravada Neta
                    </span>
                    <div className="text-lg sm:text-xl font-black text-slate-800 mt-1">
                        <Money value={summaryData.total_gravada} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 mt-1">
                        Exentas: <Money value={summaryData.total_exenta} />
                    </span>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                        IVA Crédito Fiscal
                    </span>
                    <div className="text-lg sm:text-xl font-black text-emerald-600 mt-1">
                        <Money value={summaryData.total_iva} />
                    </div>
                    <span className="text-[10px] font-medium text-emerald-700/70 mt-1">
                        Crédito deducible 13%
                    </span>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Retención / Percepción
                    </span>
                    <div className="text-lg sm:text-xl font-black text-slate-800 mt-1">
                        <Money value={parseFloat(summaryData.total_retencion || 0) + parseFloat(summaryData.total_percepcion || 0)} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 mt-1">
                        Ret: <Money value={summaryData.total_retencion} /> · Perc: <Money value={summaryData.total_percepcion} />
                    </span>
                </div>
            </div>

            {/* Tabla Principal de Gastos */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text"
                            value={historySearch}
                            onChange={(e) => { setHistorySearch(e.target.value.toUpperCase()); setHistoryPage(1); }}
                            placeholder="BUSCAR POR DOCUMENTO, CONTROL, PROVEEDOR, NRC..."
                            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 uppercase"
                        />
                        {historySearch && (
                            <button onClick={() => setHistorySearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Mostrar:</span>
                        <select
                            value={historyLimit}
                            onChange={(e) => { setHistoryLimit(parseInt(e.target.value, 10)); setHistoryPage(1); }}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/80 bg-slate-50/50">
                                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Fecha</th>
                                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Documento / Tipo</th>
                                <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">Proveedor</th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Gravadas</th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">IVA Crédito</th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-wider text-slate-500">Total</th>
                                <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Estado</th>
                                <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingHistory ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-xs font-semibold text-slate-400">
                                        Cargando gastos...
                                    </td>
                                </tr>
                            ) : (!expensesData?.data || expensesData.data.length === 0) ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center">
                                        <Receipt size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-xs font-bold text-slate-500">No hay gastos registrados en este período.</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Haz clic en "+ Registrar Gasto" para ingresar un nuevo documento.</p>
                                    </td>
                                </tr>
                            ) : (
                                (Array.isArray(expensesData.data) ? expensesData.data : []).map((g) => {
                                    const docTypeInfo = DOCUMENT_TYPES.find(d => d.code === g.tipo_documento_id) || {
                                        code: g.tipo_documento_id,
                                        name: g.tipo_documento_nombre || 'Gasto',
                                        badge: g.tipo_documento_id,
                                        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
                                    };
                                    const isNC = g.tipo_documento_id === '09';

                                    return (
                                        <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-3 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                                                {formatDate(g.fecha)}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${docTypeInfo.badgeColor}`}>
                                                        {docTypeInfo.code} {docTypeInfo.badge}
                                                    </span>
                                                    <span className="text-xs font-black text-slate-900">
                                                        {g.numero_documento}
                                                    </span>
                                                </div>
                                                {g.num_control && (
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[180px]" title={g.num_control}>
                                                        Ctrl: {g.num_control}
                                                    </div>
                                                )}
                                                {g.documento_afectado && (
                                                    <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                                                        Ref: {g.documento_afectado}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 max-w-[220px]">
                                                <div className="text-xs font-bold text-slate-900 truncate" title={g.provider_nombre}>
                                                    {g.provider_nombre || 'Proveedor Genérico'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {g.provider_nrc ? `NRC: ${g.provider_nrc}` : g.provider_nit ? `NIT: ${g.provider_nit}` : 'Sin registro'}
                                                    {g.branch_nombre && <span className="ml-1.5 text-indigo-600">· {g.branch_nombre}</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-700 whitespace-nowrap">
                                                <Money value={g.total_gravada} />
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs font-bold whitespace-nowrap">
                                                {isNC ? (
                                                    <span className="text-rose-600">-<Money value={g.iva} /></span>
                                                ) : parseFloat(g.iva) > 0 ? (
                                                    <span className="text-emerald-600"><Money value={g.iva} /></span>
                                                ) : (
                                                    <span className="text-slate-400">$ 0.00</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right text-xs font-black text-slate-900 whitespace-nowrap">
                                                {isNC ? (
                                                    <span className="text-rose-600 font-black">-<Money value={Math.abs(parseFloat(g.monto_total))} /></span>
                                                ) : (
                                                    <Money value={g.monto_total} />
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    g.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                    {g.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetail(g)}
                                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Ver Detalle Completo"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {g.status === 'ACTIVO' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEdit(g)}
                                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Editar Gasto"
                                                            >
                                                                <Edit2 size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleVoidExpense(g.id, g.numero_documento)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                title="Anular Gasto"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pt-2">
                    <Pagination 
                        currentPage={historyPage}
                        totalPages={expensesData?.totalPages || 1}
                        onPageChange={setHistoryPage}
                    />
                </div>
            </div>

                </>
            ) : (
                /* ============================================================ */
                /* VISTA REGISTRO / EDICIÓN INTEGRADA EN PÁGINA (SIN MODAL)     */
                /* ============================================================ */
                <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Header Superior del Formulario en Página */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    resetForm();
                                    setIsFormOpen(false);
                                }}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center justify-center shadow-2xs active:scale-95"
                                title="Volver al Listado de Gastos"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                                        {isEditing ? `Modificar Gasto: ${numeroDoc}` : 'Registrar Gasto / Compra'}
                                    </h1>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                        isEditing ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    }`}>
                                        {isEditing ? 'Modo Edición' : 'Nuevo Registro'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Período Fiscal Contable: <strong className="text-slate-800 font-bold">{String(periodMonth).padStart(2, '0')}/{periodYear}</strong> · Registro directo para Libro de Compras y Anexo F-07 MH
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    resetForm();
                                    setIsFormOpen(false);
                                }}
                                className="skip-enter-nav px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => formRef.current?.requestSubmit()}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/25 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                                <Save size={15} />
                                <span>{createMutation.isPending || updateMutation.isPending ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Guardar Comprobante')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Formulario Principal en 2 Columnas */}
                    <form ref={formRef} onSubmit={handleSubmitForm} onKeyDown={handleFormKeyDown} className="space-y-4 text-slate-800">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                            {/* ============================================================ */}
                            {/* COLUMNA IZQUIERDA: FORMULARIO PRINCIPAL (lg:col-span-8)      */}
                            {/* ============================================================ */}
                            <div className="lg:col-span-8 space-y-4">
                                {/* BLOQUE 1: DATOS DEL DOCUMENTO Y PROVEEDOR */}
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <Banknote size={16} className="text-indigo-600" />
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                1. Datos del Documento y Proveedor
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => dteFileInputRef.current?.click()}
                                                disabled={isScanningDte}
                                                className="skip-enter-nav px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-xs hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-95"
                                                title="Escanear DTE o factura física/digital mediante Inteligencia Artificial para autocompletar datos"
                                            >
                                                <Sparkles size={13} className={isScanningDte ? 'animate-spin text-purple-200' : 'text-amber-300'} />
                                                <span>{isScanningDte ? 'Escaneando...' : 'Escanear DTE (IA)'}</span>
                                            </button>

                                            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                <Calendar size={12} className="text-indigo-500" />
                                                Período:
                                            </span>
                                            <select
                                                value={periodMonth}
                                                onChange={(e) => {
                                                    setPeriodMonth(parseInt(e.target.value, 10));
                                                    setIsPeriodDirty(true);
                                                }}
                                                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                                                title="Mes del período tributario / contable"
                                            >
                                                {MONTHS.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={periodYear}
                                                onChange={(e) => {
                                                    setPeriodYear(parseInt(e.target.value, 10));
                                                    setIsPeriodDirty(true);
                                                }}
                                                className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                                                title="Año del período tributario / contable"
                                            >
                                                {YEARS.map(y => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                            {isPeriodDirty && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsPeriodDirty(false);
                                                        if (fecha) {
                                                            const parts = fecha.split('-');
                                                            if (parts.length === 3) {
                                                                setPeriodYear(parseInt(parts[0], 10));
                                                                setPeriodMonth(parseInt(parts[1], 10));
                                                            }
                                                        }
                                                    }}
                                                    title="Sincronizar período con la fecha de emisión del documento"
                                                    className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1"
                                                >
                                                    <RotateCcw size={10} />
                                                    <span>Auto</span>
                                                </button>
                                            )}
                                        </div>
                                        </div>
                                    </div>

                                    {/* Fila 1: Tipo Documento, Fecha y Sucursal */}
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                        <div className="sm:col-span-5">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className={labelCls}>Tipo de Documento *</label>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${currentDocType.badgeColor}`}>
                                                    {currentDocType.badge}
                                                </span>
                                            </div>
                                            <select
                                                value={tipoDocId}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTipoDocId(val);
                                                    const dt = DOCUMENT_TYPES.find(d => d.code === val);
                                                    if (!dt?.hasIVA) {
                                                        setManualIVA(0);
                                                        setIsIvaDirty(true);
                                                    } else {
                                                        setIsIvaDirty(false);
                                                        const num = parseFloat(totalGravada) || 0;
                                                        setManualIVA(Math.round(num * 0.13 * 100) / 100);
                                                    }
                                                    setIsRetDirty(false);
                                                    setIsPercDirty(false);
                                                }}
                                                className={inputCls}
                                            >
                                                {DOCUMENT_TYPES.map(t => (
                                                    <option key={t.code} value={t.code}>
                                                        {t.code} - {t.name} ({t.badge})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="sm:col-span-3">
                                            <label className={labelCls}>Fecha de Emisión *</label>
                                            <input 
                                                type="date" 
                                                value={fecha} 
                                                onChange={handleFechaChange} 
                                                className={inputCls} 
                                                required
                                            />
                                        </div>

                                        <div className="sm:col-span-4">
                                            <label className={labelCls}>Sucursal *</label>
                                            <select 
                                                value={branchId} 
                                                onChange={(e) => setBranchId(e.target.value)} 
                                                className={inputCls}
                                                required
                                            >
                                                <option value="">SELECCIONE...</option>
                                                {(Array.isArray(branches) ? branches : []).map(b => (
                                                    <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Alerta y Campos Obligatorios para Nota de Crédito o Débito */}
                                    {(esNotaCredito || esNotaDebito) && (
                                        <div className={`p-3 rounded-xl border animate-in slide-in-from-top-2 ${
                                            esNotaCredito ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'
                                        }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertCircle size={15} className={esNotaCredito ? 'text-rose-600' : 'text-blue-600'} />
                                                <span className={`text-[11px] font-black uppercase ${esNotaCredito ? 'text-rose-800' : 'text-blue-800'}`}>
                                                    {esNotaCredito ? 'Crédito Fiscal Afectado (Descuento/Rebaja)' : 'Crédito Fiscal Afectado (Aumento)'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                <div>
                                                    <label className={labelCls}>Documento / CCF Afectado *</label>
                                                    <input
                                                        type="text"
                                                        value={documentoAfectado}
                                                        onChange={(e) => setDocumentoAfectado(e.target.value.toUpperCase())}
                                                        placeholder="EJ: CCF-00123 O CÓDIGO DTE"
                                                        className={`${inputCls} uppercase`}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Fecha del Doc. Afectado *</label>
                                                    <input
                                                        type="date"
                                                        value={fechaAfectada}
                                                        onChange={(e) => setFechaAfectada(e.target.value)}
                                                        className={inputCls}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Fila 2: Proveedor y Concepto */}
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                        <div className="sm:col-span-6">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className={labelCls}>Proveedor *</label>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingProvider(null);
                                                            setIsProviderModalOpen(true);
                                                        }}
                                                        className="skip-enter-nav text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-all text-[10px] font-black uppercase flex items-center gap-0.5"
                                                        title="Crear Proveedor al Vuelo"
                                                    >
                                                        <Plus size={12} />
                                                        <span>Nuevo</span>
                                                    </button>
                                                    {selectedProvider && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingProvider(selectedProvider);
                                                                setIsProviderModalOpen(true);
                                                            }}
                                                            className="skip-enter-nav text-slate-500 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-all text-[10px] font-bold uppercase flex items-center gap-0.5"
                                                            title="Editar Proveedor"
                                                        >
                                                            <Edit2 size={11} />
                                                            <span>Editar</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <SearchableSelect 
                                                loadOptions={loadProvidersOptions} 
                                                value={providerId} 
                                                onChange={(e, opt) => {
                                                    setProviderId(e.target.value);
                                                    if (opt) setProvidersCache(prev => ({ ...prev, [opt.id]: opt }));
                                                }}
                                                valueKey="id" 
                                                labelKey="nombre" 
                                                placeholder="BUSCAR POR NOMBRE, NRC O NIT..."
                                                codeKey="nrc" 
                                                codeLabel="NRC"
                                                selectedLabel={selectedProvider?.nombre}
                                                dropdownWidth={420}
                                            />
                                        </div>

                                        <div className="sm:col-span-6">
                                            <label className={labelCls}>Concepto General / Observaciones</label>
                                            <input 
                                                type="text" 
                                                value={observaciones} 
                                                onChange={(e) => setObservaciones(e.target.value.toUpperCase())} 
                                                placeholder="DESCRIPCIÓN GENERAL O CONCEPTO..." 
                                                className={`${inputCls} uppercase`} 
                                            />
                                        </div>
                                    </div>

                                    {/* Fila 3: Código de Generación y Número de Control */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelCls}>
                                                {tipoDocId === '04' ? 'No. Póliza / Declaración *' : tipoDocId === '05' ? 'No. FAUCA / Mandamiento *' : 'Código de Generación *'}
                                            </label>
                                            <input 
                                                type="text" 
                                                value={numeroDoc} 
                                                onChange={(e) => setNumeroDoc(e.target.value.toUpperCase())} 
                                                placeholder={tipoDocId === '04' ? 'NO. PÓLIZA' : tipoDocId === '05' ? 'NO. FAUCA' : 'CÓDIGO GENERACIÓN DTE'} 
                                                className={`${inputCls} uppercase font-mono text-[11px]`} 
                                                required
                                            />
                                        </div>

                                        <div>
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
                                    </div>

                                    {/* Fila 4: Sello de Recepción y Condición de Operación */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
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

                                        <div>
                                            <label className={labelCls}>Condición de Operación</label>
                                            <select 
                                                value={condicionId} 
                                                onChange={(e) => setCondicionId(e.target.value)} 
                                                className={inputCls}
                                            >
                                                {(Array.isArray(condiciones) ? condiciones : []).map(c => (
                                                    <option key={c.code} value={c.code}>{c.description.toUpperCase()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* BLOQUE 2: CLASIFICACIÓN TRIBUTARIA F-07 (ACORDEÓN PLEGABLE) */}
                                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
                                    <button
                                        type="button"
                                        onClick={() => setIsF07Open(!isF07Open)}
                                        className="skip-enter-nav w-full px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between text-left transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <SlidersHorizontal size={14} className="text-indigo-600" />
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                                2. Clasificación F-07 MH
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
                                                (Anexo F-07 Ministerio de Hacienda)
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full truncate max-w-[200px] sm:max-w-xs">
                                                {F07_TIPOS_OPERACION.find(o => o.code === tipoOperacion)?.label.split('-')[1]?.trim() || 'GRAVADA'} · {F07_TIPOS_CLASIFICACION.find(c => c.code === tipoClasificacion)?.label.split('-')[1]?.trim() || 'GASTO'}
                                            </span>
                                            <div className="p-1 text-slate-400 hover:text-slate-600">
                                                {isF07Open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>
                                    </button>

                                    {isF07Open && (
                                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white border-t border-slate-100 animate-in fade-in duration-150">
                                            <div>
                                                <label className={labelCls}>Tipo de Operación</label>
                                                <select
                                                    value={tipoOperacion}
                                                    onChange={(e) => setTipoOperacion(e.target.value)}
                                                    className={inputCls}
                                                >
                                                    {F07_TIPOS_OPERACION.map(o => (
                                                        <option key={o.code} value={o.code}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className={labelCls}>Tipo de Clasificación</label>
                                                <select
                                                    value={tipoClasificacion}
                                                    onChange={(e) => setTipoClasificacion(e.target.value)}
                                                    className={inputCls}
                                                >
                                                    {F07_TIPOS_CLASIFICACION.map(c => (
                                                        <option key={c.code} value={c.code}>{c.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className={labelCls}>Tipo de Sector</label>
                                                <select
                                                    value={tipoSector}
                                                    onChange={(e) => setTipoSector(e.target.value)}
                                                    className={inputCls}
                                                >
                                                    {F07_TIPOS_SECTOR.map(s => (
                                                        <option key={s.code} value={s.code}>{s.label}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className={labelCls}>Tipo de Costo / Gasto</label>
                                                <select
                                                    value={tipoCosto}
                                                    onChange={(e) => setTipoCosto(e.target.value)}
                                                    className={inputCls}
                                                >
                                                    {F07_TIPOS_COSTO.map(c => (
                                                        <option key={c.code} value={c.code}>{c.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* BLOQUE 3: LIQUIDACIÓN E IMPUESTOS DIRECTOS */}
                                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <Receipt size={15} className="text-indigo-600" />
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                                3. Liquidación e Impuestos
                                            </h3>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                            Navega con <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold rounded border border-slate-300 text-[9px]">Enter ↵</kbd>
                                        </span>
                                    </div>

                                    {/* Bases Locales e IVA 13% */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {/* Compras Gravadas Locales */}
                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight truncate">Gravadas Locales *</label>
                                                {getFieldMeta('totalGravada').isPrimary && (
                                                    <span className="text-[7px] font-black uppercase text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">Principal</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={totalGravada}
                                                    onChange={handleGravadaChange}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-slate-900 focus:border-indigo-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        {/* Gastos Exentos Locales */}
                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight block mb-1 truncate">Exentas Locales</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={totalExenta}
                                                    onChange={(e) => setTotalExenta(e.target.value)}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono text-right text-slate-800 focus:border-indigo-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        {/* Compras No Sujetas */}
                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight block mb-1 truncate">No Sujetas</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={totalNosujeta}
                                                    onChange={(e) => setTotalNosujeta(e.target.value)}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono text-right text-slate-800 focus:border-indigo-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        {/* IVA Crédito Fiscal (13%) */}
                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight truncate">IVA Crédito (13%)</label>
                                                {currentDocType.hasIVA && isIvaDirty ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleResetIvaAuto}
                                                        className="skip-enter-nav text-[7px] text-amber-600 hover:text-indigo-600 font-bold uppercase transition-colors"
                                                        title="Recalcular automáticamente el 13%"
                                                    >
                                                        Auto ↺
                                                    </button>
                                                ) : currentDocType.hasIVA ? (
                                                    <span className="text-[7px] text-emerald-600 font-bold uppercase">Auto</span>
                                                ) : (
                                                    <span className="text-[7px] text-slate-400 font-bold uppercase">N/A</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={!currentDocType.hasIVA}
                                                    value={manualIVA}
                                                    onChange={(e) => {
                                                        setManualIVA(e.target.value);
                                                        setIsIvaDirty(true);
                                                    }}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className={`w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-emerald-600 focus:border-emerald-500 transition-colors h-[28px] ${!currentDocType.hasIVA ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Importaciones / Internaciones (si aplica) */}
                                    {(currentDocType.code === '04' || currentDocType.code === '05' || parseFloat(gravadasImportaciones) > 0 || parseFloat(gravadasInternaciones) > 0 || parseFloat(ivaImportaciones) > 0) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-purple-50/50 p-2 rounded-xl border border-purple-200 animate-in fade-in duration-150">
                                            <div>
                                                <label className="text-[9px] font-bold text-purple-900 uppercase tracking-tight block mb-1">Grav. Importaciones</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-300 font-mono font-bold text-[10px]">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={gravadasImportaciones}
                                                        onChange={(e) => setGravadasImportaciones(e.target.value)}
                                                        onFocus={handleFocusSelect}
                                                        placeholder="0.00"
                                                        className="w-full pl-5 pr-2 py-1 bg-white border border-purple-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-purple-950 focus:border-purple-500 transition-colors h-[28px]"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-purple-900 uppercase tracking-tight block mb-1">Grav. Internaciones</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-300 font-mono font-bold text-[10px]">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={gravadasInternaciones}
                                                        onChange={(e) => setGravadasInternaciones(e.target.value)}
                                                        onFocus={handleFocusSelect}
                                                        placeholder="0.00"
                                                        className="w-full pl-5 pr-2 py-1 bg-white border border-purple-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-purple-950 focus:border-purple-500 transition-colors h-[28px]"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-purple-900 uppercase tracking-tight block mb-1">IVA Aduana / Póliza</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-300 font-mono font-bold text-[10px]">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={ivaImportaciones}
                                                        onChange={(e) => setIvaImportaciones(e.target.value)}
                                                        onFocus={handleFocusSelect}
                                                        placeholder="0.00"
                                                        className="w-full pl-5 pr-2 py-1 bg-white border border-purple-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-purple-700 focus:border-purple-500 transition-colors h-[28px]"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Retención, Percepción, FOVIAL, COTRANS, Anticipo a Cuenta, Monto Sujeto */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 border-t border-slate-100">
                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-rose-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-rose-500/20 transition-all">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight truncate">Retención 1%</label>
                                                {isRetDirty && <span className="text-[7px] text-amber-600 font-bold uppercase">Manual</span>}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-rose-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={manualRetencion}
                                                    onChange={(e) => {
                                                        setManualRetencion(e.target.value);
                                                        setIsRetDirty(true);
                                                    }}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-rose-600 focus:border-rose-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-amber-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-amber-500/20 transition-all">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight truncate">Percepción 1%</label>
                                                {isPercDirty && <span className="text-[7px] text-amber-600 font-bold uppercase">Manual</span>}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={manualPercepcion}
                                                    onChange={(e) => {
                                                        setManualPercepcion(e.target.value);
                                                        setIsPercDirty(true);
                                                    }}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono font-bold text-right text-amber-600 focus:border-amber-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight block mb-1 truncate">FOVIAL</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={manualFovial}
                                                    onChange={(e) => setManualFovial(e.target.value)}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono text-right text-slate-800 focus:border-indigo-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/70 p-2 rounded-xl border border-slate-200/80 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
                                            <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight block mb-1 truncate">COTRANS</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={manualCotrans}
                                                    onChange={(e) => setManualCotrans(e.target.value)}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono text-right text-slate-800 focus:border-indigo-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        <div className={`bg-slate-50/70 p-2 rounded-xl border transition-all ${
                                            tipoDocId === '07' 
                                                ? 'border-blue-400 ring-1 ring-blue-500/20 bg-blue-50/40' 
                                                : 'border-slate-200/80'
                                        } focus-within:border-blue-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-blue-500/20`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight truncate">Anticipo Cta.</label>
                                                {tipoDocId === '07' ? (
                                                    <span className="text-[7px] font-black uppercase text-blue-700 bg-blue-100 px-1 py-0.2 rounded">Liquidación</span>
                                                ) : (
                                                    <span className="text-[7px] text-blue-600 font-bold uppercase">Info</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={manualAnticipoCuenta}
                                                    onChange={(e) => setManualAnticipoCuenta(e.target.value)}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono text-right text-blue-700 font-semibold focus:border-blue-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>

                                        <div className={`bg-slate-50/70 p-2 rounded-xl border transition-all ${
                                            tipoDocId === '07' 
                                                ? 'border-indigo-400 ring-1 ring-indigo-500/20 bg-indigo-50/40' 
                                                : 'border-slate-200/80'
                                        } focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500/20`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] font-bold text-slate-600 uppercase tracking-tight truncate">Monto Sujeto</label>
                                                {tipoDocId === '07' ? (
                                                    <span className="text-[7px] font-black uppercase text-indigo-700 bg-indigo-100 px-1 py-0.2 rounded">Liquidación</span>
                                                ) : (
                                                    <span className="text-[7px] text-indigo-600 font-bold uppercase">Info</span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-400 font-mono font-bold text-[10px]">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={manualMontoSujeto}
                                                    onChange={(e) => setManualMontoSujeto(e.target.value)}
                                                    onFocus={handleFocusSelect}
                                                    placeholder="0.00"
                                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-xs font-mono text-right text-indigo-700 font-semibold focus:border-indigo-500 transition-colors h-[28px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ============================================================ */}
                            {/* COLUMNA DERECHA: PANEL DE RESUMEN Y ACCIONES (lg:col-span-4) */}
                            {/* ============================================================ */}
                            <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-3">
                                <div className={`p-4 sm:p-5 rounded-2xl border shadow-lg ${
                                    esNotaCredito 
                                        ? 'bg-slate-900 border-rose-900/50 text-white' 
                                        : 'bg-slate-900 border-slate-800 text-white'
                                }`}>
                                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                                        <div className="flex items-center gap-2">
                                            <Receipt size={16} className={esNotaCredito ? 'text-rose-400' : 'text-emerald-400'} />
                                            <h3 className="text-xs font-black uppercase tracking-wider text-white">
                                                {esNotaCredito ? 'Resumen Nota Crédito' : 'Resumen Liquidación'}
                                            </h3>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${currentDocType.badgeColor}`}>
                                            {currentDocType.badge}
                                        </span>
                                    </div>

                                    {/* Desglose de Totales */}
                                    <div className="space-y-2 text-xs font-semibold text-slate-300">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Base Gravada:</span>
                                            <span className="font-mono text-white font-bold">
                                                {esNotaCredito && '-'}<Money value={totals.gravada} />
                                            </span>
                                        </div>

                                        {(parseFloat(totals.exenta || 0) > 0 || parseFloat(totals.nosujeta || 0) > 0) && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">Exentas / No Sujetas:</span>
                                                <span className="font-mono text-white font-bold">
                                                    <Money value={parseFloat(totals.exenta || 0) + parseFloat(totals.nosujeta || 0)} />
                                                </span>
                                            </div>
                                        )}

                                        {(parseFloat(totals.gravadas_importaciones || 0) > 0 || parseFloat(totals.gravadas_internaciones || 0) > 0) && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">Importaciones / Intern.:</span>
                                                <span className="font-mono text-purple-300 font-bold">
                                                    <Money value={parseFloat(totals.gravadas_importaciones || 0) + parseFloat(totals.gravadas_internaciones || 0)} />
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">IVA Crédito Fiscal (13%):</span>
                                            <span className={`font-mono font-bold ${esNotaCredito ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {esNotaCredito && '-'}<Money value={totals.iva} />
                                            </span>
                                        </div>

                                        {parseFloat(totals.iva_importaciones || 0) > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">IVA Importaciones / Póliza:</span>
                                                <span className="font-mono text-purple-300 font-bold">
                                                    <Money value={totals.iva_importaciones} />
                                                </span>
                                            </div>
                                        )}

                                        {parseFloat(totals.fovial || 0) > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">FOVIAL:</span>
                                                <span className="font-mono text-amber-300 font-bold">
                                                    <Money value={totals.fovial} />
                                                </span>
                                            </div>
                                        )}

                                        {parseFloat(totals.cotrans || 0) > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">COTRANS:</span>
                                                <span className="font-mono text-cyan-300 font-bold">
                                                    <Money value={totals.cotrans} />
                                                </span>
                                            </div>
                                        )}

                                        {parseFloat(totals.retencion || 0) > 0 && (
                                            <div className="flex justify-between items-center text-rose-400">
                                                <span>Retención 1%:</span>
                                                <span className="font-mono font-bold">
                                                    -<Money value={totals.retencion} />
                                                </span>
                                            </div>
                                        )}

                                        {parseFloat(totals.percepcion || 0) > 0 && (
                                            <div className="flex justify-between items-center text-emerald-400">
                                                <span>Percepción 1%:</span>
                                                <span className="font-mono font-bold">
                                                    +<Money value={totals.percepcion} />
                                                </span>
                                            </div>
                                        )}

                                        {parseFloat(totals.anticipo_cuenta || 0) > 0 && (
                                            <div className="flex justify-between items-center text-blue-300">
                                                <span className="text-slate-400">Anticipo a Cuenta (Info):</span>
                                                <span className="font-mono font-bold">
                                                    <Money value={totals.anticipo_cuenta} />
                                                </span>
                                            </div>
                                        )}

                                        {parseFloat(totals.monto_sujeto || 0) > 0 && (
                                            <div className="flex justify-between items-center text-indigo-300">
                                                <span className="text-slate-400">Monto Sujeto (Info):</span>
                                                <span className="font-mono font-bold">
                                                    <Money value={totals.monto_sujeto} />
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Total Destacado */}
                                    <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {esNotaCredito ? 'Total a Descontar (NC)' : 'Total Liquidación'}
                                        </span>
                                        <div className={`text-3xl font-black font-mono tracking-tight ${
                                            esNotaCredito ? 'text-rose-400' : 'text-emerald-400'
                                        }`}>
                                            {esNotaCredito && '-'}<Money value={Math.abs(totals.total)} />
                                        </div>
                                    </div>

                                    {/* Botones de Acción en Panel Lateral */}
                                    <div className="mt-5 space-y-2">
                                        <button
                                            ref={submitBtnRef}
                                            type="submit"
                                            disabled={createMutation.isPending || updateMutation.isPending}
                                            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                                                esNotaCredito
                                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                                            }`}
                                        >
                                            <Save size={16} />
                                            <span>{createMutation.isPending || updateMutation.isPending ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Guardar Comprobante')}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                resetForm();
                                                setIsFormOpen(false);
                                            }}
                                            className="skip-enter-nav w-full py-2 bg-white/10 hover:bg-white/15 text-white/90 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <ArrowLeft size={14} />
                                            <span>Volver al Listado</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Información del Tipo de Documento */}
                                <div className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 ${currentDocType.badgeColor}`}>
                                            {currentDocType.code} {currentDocType.badge}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800 truncate">
                                            {currentDocType.name}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        {currentDocType.description}
                                    </p>
                                    {activeFieldConfig?.tip && (
                                        <div className="pt-1.5 border-t border-slate-100 text-[10px] text-indigo-700/90 font-medium leading-relaxed flex items-start gap-1.5">
                                            <Info size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                                            <span>{activeFieldConfig.tip}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Mini Tip */}
                                <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs text-[11px] text-slate-500 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                    <span>Presiona <kbd className="px-1 py-0.5 bg-slate-100 font-mono font-bold rounded border text-[10px]">Enter ↵</kbd> para saltar entre campos rápidamente.</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal Ver Detalle (Solo Lectura) */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setViewingExpense(null);
                }}
                title={`Detalle de Gasto: ${viewingExpense?.numero_documento || ''}`}
                maxWidth="max-w-3xl"
            >
                {viewingExpense && (
                    <div className="space-y-4 text-slate-800">
                        {/* Cabecera del Documento */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Fecha</span>
                                <span className="text-xs font-black text-slate-800">{formatDate(viewingExpense.fecha)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo Documento</span>
                                <span className="text-xs font-black text-slate-800">{viewingExpense.tipo_documento_id} - {viewingExpense.tipo_documento_nombre || 'Gasto'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">No. Documento</span>
                                <span className="text-xs font-black text-slate-800">{viewingExpense.numero_documento}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estado</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    viewingExpense.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                    {viewingExpense.status}
                                </span>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Proveedor</span>
                                <span className="text-xs font-bold text-slate-900">{viewingExpense.provider_nombre}</span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                    NRC: {viewingExpense.provider_nrc || 'N/A'} · NIT: {viewingExpense.provider_nit || 'N/A'}
                                </div>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sucursal / Usuario</span>
                                <span className="text-xs font-medium text-slate-700">
                                    {viewingExpense.branch_nombre || '---'} {viewingExpense.usuario_nombre && `(${viewingExpense.usuario_nombre})`}
                                </span>
                            </div>
                            {viewingExpense.num_control && (
                                <div className="sm:col-span-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Número de Control (DTE)</span>
                                    <span className="text-xs font-mono text-slate-700">{viewingExpense.num_control}</span>
                                </div>
                            )}
                            {viewingExpense.sello_recepcion && (
                                <div className="sm:col-span-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sello Recepción (MH)</span>
                                    <span className="text-xs font-mono text-slate-700 truncate block">{viewingExpense.sello_recepcion}</span>
                                </div>
                            )}
                            {viewingExpense.documento_afectado && (
                                <div className="sm:col-span-4 p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block">Documento Afectado</span>
                                    <span className="text-xs font-bold text-rose-900">{viewingExpense.documento_afectado} ({formatDate(viewingExpense.fecha_afectada)})</span>
                                </div>
                            )}
                        </div>

                        {/* Clasificación F-07 MH */}
                        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div>
                                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Operación</span>
                                <span className="font-bold text-slate-800">
                                    {F07_TIPOS_OPERACION.find(o => o.code === viewingExpense.tipo_operacion)?.label || viewingExpense.tipo_operacion}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Clasificación</span>
                                <span className="font-bold text-slate-800">
                                    {F07_TIPOS_CLASIFICACION.find(c => c.code === viewingExpense.tipo_clasificacion)?.label || viewingExpense.tipo_clasificacion}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Sector</span>
                                <span className="font-bold text-slate-800">
                                    {F07_TIPOS_SECTOR.find(s => s.code === viewingExpense.tipo_sector)?.label || viewingExpense.tipo_sector}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Tipo Costo</span>
                                <span className="font-bold text-slate-800 truncate block" title={viewingExpense.tipo_costo}>
                                    {F07_TIPOS_COSTO.find(c => c.code === viewingExpense.tipo_costo)?.label || viewingExpense.tipo_costo}
                                </span>
                            </div>
                        </div>

                        {/* Observaciones */}
                        {viewingExpense.observaciones && (
                            <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Concepto General / Observaciones</span>
                                <p className="font-medium text-slate-800">{viewingExpense.observaciones}</p>
                            </div>
                        )}

                        {/* Liquidación de Totales y Desglose Fiscal */}
                        <div>
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-2">Desglose de Liquidación Fiscal</h4>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Compras Gravadas</span>
                                    <span className="text-xs font-mono font-bold text-slate-800"><Money value={viewingExpense.total_gravada} /></span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gastos Exentos</span>
                                    <span className="text-xs font-mono text-slate-700"><Money value={viewingExpense.total_exenta} /></span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">No Sujetas</span>
                                    <span className="text-xs font-mono text-slate-700"><Money value={viewingExpense.total_nosujeta} /></span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">IVA Crédito Fiscal (13%)</span>
                                    <span className="text-xs font-mono font-bold text-emerald-600"><Money value={viewingExpense.iva} /></span>
                                </div>
                                {parseFloat(viewingExpense.gravadas_importaciones || 0) > 0 && (
                                    <div>
                                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">Grav. Importaciones</span>
                                        <span className="text-xs font-mono font-bold text-slate-800"><Money value={viewingExpense.gravadas_importaciones} /></span>
                                    </div>
                                )}
                                {parseFloat(viewingExpense.iva_importaciones || 0) > 0 && (
                                    <div>
                                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">IVA Importaciones</span>
                                        <span className="text-xs font-mono font-bold text-purple-700"><Money value={viewingExpense.iva_importaciones} /></span>
                                    </div>
                                )}
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Retención 1%</span>
                                    <span className="text-xs font-mono text-rose-600 font-semibold"><Money value={viewingExpense.retencion} /></span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Percepción 1%</span>
                                    <span className="text-xs font-mono text-amber-600 font-semibold"><Money value={viewingExpense.percepcion} /></span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">FOVIAL / COTRANS</span>
                                    <span className="text-xs font-mono text-slate-700">
                                        <Money value={parseFloat(viewingExpense.fovial || 0) + parseFloat(viewingExpense.cotrans || 0)} />
                                    </span>
                                </div>
                                {parseFloat(viewingExpense.anticipo_cuenta || 0) > 0 && (
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Anticipo a Cuenta</span>
                                        <span className="text-xs font-mono text-blue-600 font-bold">
                                            <Money value={viewingExpense.anticipo_cuenta} />
                                        </span>
                                    </div>
                                )}
                                {parseFloat(viewingExpense.monto_sujeto || 0) > 0 && (
                                    <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Monto Sujeto</span>
                                        <span className="text-xs font-mono text-indigo-600 font-bold">
                                            <Money value={viewingExpense.monto_sujeto} />
                                        </span>
                                    </div>
                                )}
                                <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-slate-200">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Liquidado del Gasto</span>
                                    <span className="text-lg font-mono font-black text-slate-900"><Money value={viewingExpense.monto_total} /></span>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Cambiar Período Activo */}
            <Modal
                isOpen={modalPeriodoOpen}
                onClose={() => setModalPeriodoOpen(false)}
                title="Configurar Período de Compras Activo"
                maxWidth="max-w-md"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        updatePeriodMutation.mutate({ year: nuevoPeriodoAnio, month: nuevoPeriodoMes });
                    }}
                    className="space-y-4 text-slate-800"
                >
                    <p className="text-xs text-slate-600">
                        El período activo determina el mes y año en el cual se computan y declaran las compras y gastos tributarios de la empresa en curso.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Mes Activo *</label>
                            <select
                                value={nuevoPeriodoMes}
                                onChange={(e) => setNuevoPeriodoMes(parseInt(e.target.value, 10))}
                                className={inputCls}
                            >
                                {MONTHS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>Año Activo *</label>
                            <select
                                value={nuevoPeriodoAnio}
                                onChange={(e) => setNuevoPeriodoAnio(parseInt(e.target.value, 10))}
                                className={inputCls}
                            >
                                {YEARS.map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setModalPeriodoOpen(false)}
                            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={updatePeriodMutation.isPending}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                        >
                            {updatePeriodMutation.isPending ? 'Guardando...' : 'Guardar Período Activo'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Crear / Editar Proveedor Integrado */}
            {isProviderModalOpen && (
                <ProviderModal
                    isOpen={isProviderModalOpen}
                    onClose={() => {
                        setIsProviderModalOpen(false);
                        setEditingProvider(null);
                    }}
                    provider={editingProvider}
                    onSuccess={(newProvider) => {
                        setIsProviderModalOpen(false);
                        setEditingProvider(null);
                        if (newProvider?.id) {
                            setProviderId(String(newProvider.id));
                            setProvidersCache(prev => ({ ...prev, [newProvider.id]: newProvider }));
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Expenses;
