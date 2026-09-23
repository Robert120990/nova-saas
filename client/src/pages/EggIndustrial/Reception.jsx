import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Plus,
    FileText,
    User,
    Calendar,
    Thermometer,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Boxes,
    Search,
    Pencil,
    Ban,
    Truck,
    Settings,
    Sparkles,
    History,
    Printer,
    Eye,
    EyeOff,
    Download,
    ShieldCheck,
    Award,
    Trash2,
    Lock,
    FlaskConical,
    ClipboardList,
    Check,
    Loader2,
    ChevronDown,
    Scale,
    Layers
} from 'lucide-react';
import TarimaLabelModal from '../../components/egg/TarimaLabelModal';
import PdfViewerModal from '../../components/ui/PdfViewerModal';
import ProviderLotConfigModal from '../../components/egg/ProviderLotConfigModal';

const EggReception = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    // States for raw materials list and providers list
    const [rawMaterials, setRawMaterials] = useState([]);
    const [providers, setProviders] = useState([]);
    const [providerLotConfigs, setProviderLotConfigs] = useState([]);
    const [providerLotIntel, setProviderLotIntel] = useState(null);
    const [lotConfigModalData, setLotConfigModalData] = useState({
        isOpen: false,
        config: null,
        initialProviderId: ''
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingReception, setViewingReception] = useState(null);

    const todayStr = new Date().toISOString().split('T')[0];

    const [useTarimas, setUseTarimas] = useState(false);
    const [globalHasCaja, setGlobalHasCaja] = useState(true);
    const [showDetailedTares, setShowDetailedTares] = useState(false);
    const [bulkAddCount, setBulkAddCount] = useState(10);
    const [receptionTareTarima, setReceptionTareTarima] = useState(0);
    const [receptionTareSep, setReceptionTareSep] = useState(48);
    const [receptionTareCaja, setReceptionTareCaja] = useState(30);
    const [receptionBaseBoxes, setReceptionBaseBoxes] = useState(24);
    const [globalStorageLocation, setGlobalStorageLocation] = useState('abajo');
    const [lastDraftSavedAt, setLastDraftSavedAt] = useState(null);
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
    const [tarimas, setTarimas] = useState([
        { id: 1, tarima_number: 1, gross_weight_lbs: '', tare_weight_lbs: 78, net_weight_lbs: 0, boxes_count: 24, has_caja: true, tare_pallet_lbs: 0, tare_separador_lbs: 48, tare_caja_lbs: 30, storage_location: 'abajo' }
    ]);

    // Form state
    const [formData, setFormData] = useState({
        provider_id: '',
        egg_type: 'huevo cáscara',
        egg_color: 'blanco',
        egg_size: 'L',
        egg_classification: 'Grado A',
        fecha: todayStr,
        weight_lbs: '',
        total_boxes: 0,
        storage_location: 'abajo',
        temperature_c: '',
        truck_temperature_c: '',
        truck_plate: '',
        driver_name: '',
        provider_lot: '',
        certificate_urls: '',
        operator_name: user?.nombre || '',
        status: 'aprobado'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [voidConfirmId, setVoidConfirmId] = useState(null);

    // Estado del modal de impresión de etiquetas de tarimas
    const [printTarimaModal, setPrintTarimaModal] = useState({
        isOpen: false,
        tarima: null,
        allTarimas: [],
        receptionData: {}
    });

    const DRAFT_STORAGE_KEY = `egg_reception_draft_${companyId}`;

    // Efecto de autoguardado dinámico resiliente en localStorage (protección contra cierres accidentales)
    useEffect(() => {
        if (!isCreateModalOpen || editingId) return;

        // Comprobar si hay contenido significativo ingresado por el usuario
        const hasData = Boolean(
            formData.provider_id ||
            formData.provider_lot?.trim() ||
            formData.weight_lbs ||
            tarimas.some(t => t.gross_weight_lbs !== '' && parseFloat(t.gross_weight_lbs) > 0)
        );

        if (!hasData) return;

        const timer = setTimeout(() => {
            try {
                const nowTime = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const draftPayload = {
                    formData,
                    tarimas,
                    useTarimas,
                    globalHasCaja,
                    globalStorageLocation,
                    receptionTareTarima,
                    receptionTareSep,
                    receptionTareCaja,
                    receptionBaseBoxes,
                    savedAt: nowTime
                };
                localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
                setLastDraftSavedAt(nowTime);
            } catch (err) {
                console.warn('Error guardando borrador dinámico en localStorage:', err);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [
        isCreateModalOpen, editingId, formData, tarimas, useTarimas,
        globalHasCaja, globalStorageLocation, receptionTareTarima,
        receptionTareSep, receptionTareCaja, receptionBaseBoxes, DRAFT_STORAGE_KEY
    ]);

    const checkForDraft = () => {
        try {
            const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (!raw) return false;
            const draft = JSON.parse(raw);
            if (!draft || !draft.tarimas || !Array.isArray(draft.tarimas)) return false;

            if (draft.formData) setFormData(prev => ({ ...prev, ...draft.formData }));
            if (draft.tarimas && draft.tarimas.length > 0) setTarimas(draft.tarimas);
            if (draft.useTarimas !== undefined) setUseTarimas(draft.useTarimas);
            if (draft.globalHasCaja !== undefined) setGlobalHasCaja(draft.globalHasCaja);
            if (draft.globalStorageLocation) setGlobalStorageLocation(draft.globalStorageLocation);
            if (draft.receptionTareTarima !== undefined) setReceptionTareTarima(draft.receptionTareTarima);
            if (draft.receptionTareSep !== undefined) setReceptionTareSep(draft.receptionTareSep);
            if (draft.receptionTareCaja !== undefined) setReceptionTareCaja(draft.receptionTareCaja);
            if (draft.receptionBaseBoxes !== undefined) setReceptionBaseBoxes(draft.receptionBaseBoxes);
            setLastDraftSavedAt(draft.savedAt || 'reciente');
            setHasRestoredDraft(true);
            return true;
        } catch (e) {
            console.warn('Error restaurando borrador de recepción:', e);
            return false;
        }
    };

    const discardDraft = () => {
        try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch (e) { }
        setHasRestoredDraft(false);
        setLastDraftSavedAt(null);
        resetForm();
        toast.info('Borrador descartado. Formulario reiniciado a valores iniciales.');
    };

    // Roles y Permisos (Página 3 del documento adjunto)
    const userPermissions = Array.isArray(user?.permissions)
        ? user.permissions
        : (typeof user?.permissions === 'string' ? JSON.parse(user?.permissions || '[]') : []);
    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin' || user?.role_id <= 2;
    const canEditQuality = isAdmin || userPermissions.includes('edit_egg_quality');
    const canDeleteReception = isAdmin || userPermissions.includes('delete_egg_reception');

    const [deleteConfirmRm, setDeleteConfirmRm] = useState(null);

    const handleDeleteReception = async () => {
        if (!deleteConfirmRm) return;
        try {
            const res = await axios.delete(`/api/egg-industrial/raw-materials/${deleteConfirmRm.id}`);
            toast.success(res.data?.message || 'Recepción de materia prima eliminada exitosamente.');
            setDeleteConfirmRm(null);
            fetchData();
        } catch (error) {
            console.error('Error al eliminar recepción:', error);
            toast.error(error.response?.data?.message || 'Error al eliminar la recepción.');
        }
    };

    // Colorimetría según calidad / grado (Página 2 del documento: al no ser conforme color en rojo)
    const getQualityBadgeClass = (status, grade) => {
        const s = (status || '').toLowerCase();
        const g = (grade || '').toLowerCase();

        // No conforme o rechazado: ROJO INTENSO OBLIGATORIO
        if (s === 'rechazado' || s === 'no_conforme' || g.includes('no conforme') || g.includes('rechaz')) {
            return 'bg-rose-600 text-white border-rose-700 shadow-sm font-black';
        }
        // Grado AA
        if (g.includes('aa')) {
            return 'bg-purple-100 text-purple-800 border-purple-300 font-black';
        }
        // Grado A
        if (g === 'grado a' || (g.includes('grado a') && !g.includes('aa'))) {
            return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
        }
        // Grado B
        if (g.includes('grado b') || g.includes('b')) {
            return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
        }
        // Grado C o condicional
        if (s === 'condicional' || g.includes('grado c')) {
            return 'bg-sky-100 text-sky-800 border-sky-300 font-bold';
        }
        // Aprobado estándar
        if (s === 'aprobado') {
            return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
        }
        return 'bg-amber-50 text-amber-700 border-amber-200';
    };

    const defaultPhysicochemical = {
        granja: { val1: '', val2: '' },
        espesor_celda_aire: { val1: '', val2: '' },
        ph_huevo_fresco: { val1: '', val2: '' },
        solidos_huevo_fresco: { val1: '', val2: '' },
        firmeza_albumina: { val1: '', val2: '' },
        ph_albumina: { val1: '', val2: '' },
        solidos_albumina: { val1: '', val2: '' },
        firmeza_yema: { val1: '', val2: '' },
        forma_yema: { val1: '', val2: '' },
        color_yema: { val1: '', val2: '' },
        ph_yema: { val1: '', val2: '' },
        solidos_yema: { val1: '', val2: '' },
        estado_separacion: { val1: '', val2: '' }
    };

    const defaultOrganoleptic = {
        olor_normal: true,
        olor_fuerte: false,
        olor_descomposicion_prematura: false,
        olor_descomposicion_avanzada: false,
        consistencia_cascaron: 'resistente'
    };

    const defaultTransport = {
        limpieza_camion: 'CONFORME / LIMPIO',
        apariencia_cajas: 'BUEN ESTADO / LIMPIAS',
        temperatura_transporte: ''
    };

    const [printingPdfId, setPrintingPdfId] = useState(null);
    const [openPrintMenuId, setOpenPrintMenuId] = useState(null);
    const [pdfPreviewModal, setPdfPreviewModal] = useState({
        isOpen: false,
        url: null,
        title: '',
        subtitle: '',
        fileName: ''
    });

    const handleClosePdfPreview = () => {
        if (pdfPreviewModal.url) {
            window.URL.revokeObjectURL(pdfPreviewModal.url);
        }
        setPdfPreviewModal({
            isOpen: false,
            url: null,
            title: '',
            subtitle: '',
            fileName: ''
        });
    };

    const handlePrintLab001 = async (rawMaterialId, customLot = '') => {
        if (!rawMaterialId) return;
        setPrintingPdfId(rawMaterialId);
        const toastId = toast.loading('Generando dictamen técnico de calidad LAB 001...');
        try {
            const res = await axios.get(`/api/egg-industrial/raw-materials/${rawMaterialId}/lab-001-pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setPdfPreviewModal({
                isOpen: true,
                url: blobUrl,
                title: 'Reporte de Materia Prima • Control de Calidad',
                subtitle: `Formato Oficial LAB 001 • Lote ${customLot || rawMaterialId}`,
                fileName: `LAB_001_Materia_Prima_${(customLot || rawMaterialId).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
            });

            toast.dismiss(toastId);
        } catch (err) {
            console.error('Error al generar PDF LAB 001:', err);
            toast.error(err.response?.data?.message || 'Error al generar o visualizar el reporte LAB 001.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handlePrintLab001FromModal = async () => {
        if (!qualityModal.rm?.id) return;
        setPrintingPdfId(qualityModal.rm.id);
        const toastId = toast.loading('Generando dictamen técnico de calidad LAB 001...');
        try {
            const currentPayload = {
                egg_classification: qualityModal.egg_classification,
                egg_size: qualityModal.egg_size,
                egg_color: qualityModal.egg_color,
                quality_status: qualityModal.quality_status,
                quality_inspector_name: qualityModal.inspector_name?.trim(),
                quality_reviewed_by: qualityModal.quality_reviewed_by?.trim(),
                quality_defect_broken_pct: parseFloat(qualityModal.quality_defect_broken_pct) || 0,
                quality_defect_dirty_pct: parseFloat(qualityModal.quality_defect_dirty_pct) || 0,
                quality_brix: qualityModal.quality_brix !== '' ? parseFloat(qualityModal.quality_brix) : null,
                quality_notes: qualityModal.quality_notes?.trim() || null,
                remission_note: qualityModal.remission_note || null,
                farm_name: qualityModal.farm_name || null,
                production_date: qualityModal.production_date || null,
                expiration_date: qualityModal.expiration_date || null,
                sample_egg_weight_g: qualityModal.sample_egg_weight_g ? parseFloat(qualityModal.sample_egg_weight_g) : null,
                total_boxes: qualityModal.total_boxes || 0,
                physicochemical: qualityModal.physicochemical,
                organoleptic: qualityModal.organoleptic,
                transport_storage: qualityModal.transport_storage
            };

            const res = await axios.post(`/api/egg-industrial/raw-materials/${qualityModal.rm.id}/lab-001-pdf`, currentPayload, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            setPdfPreviewModal({
                isOpen: true,
                url: blobUrl,
                title: 'Reporte de Materia Prima • Control de Calidad',
                subtitle: `Formato Oficial LAB 001 • Lote ${qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id}`,
                fileName: `LAB_001_Materia_Prima_${(qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
            });

            toast.dismiss(toastId);
        } catch (err) {
            console.error('Error al generar PDF LAB 001 desde modal:', err);
            try {
                const res = await axios.get(`/api/egg-industrial/raw-materials/${qualityModal.rm.id}/lab-001-pdf`, {
                    responseType: 'blob'
                });
                const blob = new Blob([res.data], { type: 'application/pdf' });
                const blobUrl = window.URL.createObjectURL(blob);
                setPdfPreviewModal({
                    isOpen: true,
                    url: blobUrl,
                    title: 'Reporte de Materia Prima • Control de Calidad',
                    subtitle: `Formato Oficial LAB 001 • Lote ${qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id}`,
                    fileName: `LAB_001_Materia_Prima_${(qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
                });
                toast.dismiss(toastId);
            } catch (err2) {
                toast.error(err2.response?.data?.message || err2.message || 'Error al generar dictamen LAB 001.', { id: toastId });
            }
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handleDownloadLab001Docx = async (rawMaterialId, customLot = '') => {
        if (!rawMaterialId) return;
        setPrintingPdfId(rawMaterialId);
        const toastId = toast.loading('Generando documento Word (.docx) de LAB 001...');
        try {
            const res = await axios.get(`/api/egg-industrial/raw-materials/${rawMaterialId}/lab-001-pdf?format=word`, {
                responseType: 'blob'
            });
            const safeLot = (customLot || rawMaterialId).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `LAB_001_Dictamen_Calidad_${safeLot}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Documento Word descargado con éxito.', { id: toastId });
        } catch (err) {
            console.error('Error al descargar Word LAB 001:', err);
            toast.error(err.response?.data?.message || 'Error al generar el documento Word LAB 001.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handleDownloadLab001DocxFromModal = async () => {
        if (!qualityModal.rm?.id) return;
        setPrintingPdfId(qualityModal.rm.id);
        const toastId = toast.loading('Generando documento Word (.docx) de LAB 001...');
        try {
            const currentPayload = {
                format: 'word',
                egg_classification: qualityModal.egg_classification,
                egg_size: qualityModal.egg_size,
                egg_color: qualityModal.egg_color,
                quality_status: qualityModal.quality_status,
                quality_inspector_name: qualityModal.inspector_name?.trim(),
                quality_reviewed_by: qualityModal.quality_reviewed_by?.trim(),
                quality_defect_broken_pct: parseFloat(qualityModal.quality_defect_broken_pct) || 0,
                quality_defect_dirty_pct: parseFloat(qualityModal.quality_defect_dirty_pct) || 0,
                quality_brix: qualityModal.quality_brix !== '' ? parseFloat(qualityModal.quality_brix) : null,
                quality_notes: qualityModal.quality_notes?.trim() || null,
                remission_note: qualityModal.remission_note || null,
                farm_name: qualityModal.farm_name || null,
                production_date: qualityModal.production_date || null,
                expiration_date: qualityModal.expiration_date || null,
                sample_egg_weight_g: qualityModal.sample_egg_weight_g ? parseFloat(qualityModal.sample_egg_weight_g) : null,
                total_boxes: qualityModal.total_boxes || 0,
                physicochemical: qualityModal.physicochemical,
                organoleptic: qualityModal.organoleptic,
                transport_storage: qualityModal.transport_storage
            };

            const res = await axios.post(`/api/egg-industrial/raw-materials/${qualityModal.rm.id}/lab-001-pdf?format=word`, currentPayload, {
                responseType: 'blob'
            });
            const safeLot = (qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `LAB_001_Dictamen_Calidad_${safeLot}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Documento Word descargado con éxito.', { id: toastId });
        } catch (err) {
            console.error('Error al descargar Word LAB 001 desde modal:', err);
            toast.error(err.response?.data?.message || 'Error al generar documento Word LAB 001.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handlePrintOriginCert = async (rawMaterialId, customLot = '') => {
        if (!rawMaterialId) return;
        setPrintingPdfId(rawMaterialId);
        const toastId = toast.loading('Generando Certificado de Calidad de Origen (PDF)...');
        try {
            const res = await axios.get(`/api/egg-industrial/raw-materials/${rawMaterialId}/origin-certificate?format=pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfPreviewModal({
                isOpen: true,
                url: blobUrl,
                title: 'Certificado de Calidad de Origen (Proveedor • ANDELSA)',
                subtitle: `Control de Origen • Lote ${customLot || rawMaterialId}`,
                fileName: `Certificado_Origen_${(customLot || rawMaterialId).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
            });
            toast.dismiss(toastId);
        } catch (err) {
            console.error('Error al generar PDF de Certificado de Origen:', err);
            toast.error(err.response?.data?.message || 'Error al generar Certificado de Origen.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handlePrintOriginCertFromModal = async () => {
        if (!qualityModal.rm?.id) return;
        setPrintingPdfId(qualityModal.rm.id);
        const toastId = toast.loading('Generando Certificado de Calidad de Origen (PDF)...');
        try {
            const currentPayload = {
                format: 'pdf',
                farm_name: qualityModal.farm_name,
                provider_lot: qualityModal.provider_lot,
                production_date: qualityModal.production_date,
                delivery_date: qualityModal.reception_date,
                is_color_blanco: (qualityModal.egg_color || 'blanco').toLowerCase() === 'blanco',
                is_color_marron: (qualityModal.egg_color || '').toLowerCase() === 'marron',
                is_camion_cerrado: qualityModal.is_camion_cerrado,
                is_limpieza_camion: qualityModal.is_limpieza_camion,
                is_cartones_limpios: qualityModal.is_cartones_limpios,
                bird_batches: qualityModal.bird_batches
            };
            const res = await axios.post(`/api/egg-industrial/raw-materials/${qualityModal.rm.id}/origin-certificate`, currentPayload, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfPreviewModal({
                isOpen: true,
                url: blobUrl,
                title: 'Certificado de Calidad de Origen (Proveedor • ANDELSA)',
                subtitle: `Control de Origen • Lote ${qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id}`,
                fileName: `Certificado_Origen_${(qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id).toString().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`
            });
            toast.dismiss(toastId);
        } catch (err) {
            console.error('Error al generar Certificado de Origen desde modal:', err);
            toast.error(err.response?.data?.message || 'Error al generar Certificado de Origen.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handleDownloadOriginCertDocx = async (rawMaterialId, customLot = '') => {
        if (!rawMaterialId) return;
        setPrintingPdfId(rawMaterialId);
        const toastId = toast.loading('Generando Certificado de Origen en Word (.docx)...');
        try {
            const res = await axios.get(`/api/egg-industrial/raw-materials/${rawMaterialId}/origin-certificate?format=word`, {
                responseType: 'blob'
            });
            const safeLot = (customLot || rawMaterialId).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Certificado_Origen_${safeLot}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Documento Word (.docx) descargado con éxito.', { id: toastId });
        } catch (err) {
            console.error('Error al descargar Word de Certificado de Origen:', err);
            toast.error(err.response?.data?.message || 'Error al descargar Word.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    const handleDownloadOriginCertDocxFromModal = async () => {
        if (!qualityModal.rm?.id) return;
        setPrintingPdfId(qualityModal.rm.id);
        const toastId = toast.loading('Generando Certificado de Origen en Word (.docx)...');
        try {
            const currentPayload = {
                format: 'word',
                farm_name: qualityModal.farm_name,
                provider_lot: qualityModal.provider_lot,
                production_date: qualityModal.production_date,
                delivery_date: qualityModal.reception_date,
                is_color_blanco: (qualityModal.egg_color || 'blanco').toLowerCase() === 'blanco',
                is_color_marron: (qualityModal.egg_color || '').toLowerCase() === 'marron',
                is_camion_cerrado: qualityModal.is_camion_cerrado,
                is_limpieza_camion: qualityModal.is_limpieza_camion,
                is_cartones_limpios: qualityModal.is_cartones_limpios,
                bird_batches: qualityModal.bird_batches
            };
            const res = await axios.post(`/api/egg-industrial/raw-materials/${qualityModal.rm.id}/origin-certificate`, currentPayload, {
                responseType: 'blob'
            });
            const safeLot = (qualityModal.provider_lot || qualityModal.rm.provider_lot || qualityModal.rm.id).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `Certificado_Origen_${safeLot}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Documento Word (.docx) descargado con éxito.', { id: toastId });
        } catch (err) {
            console.error('Error al descargar Word de Certificado de Origen desde modal:', err);
            toast.error(err.response?.data?.message || 'Error al descargar Word.', { id: toastId });
        } finally {
            setPrintingPdfId(null);
        }
    };

    // Estado del modal de evaluación de calidad y reporte de materia prima (LAB 001, Rev. 7.03.24)
    const [qualityModal, setQualityModal] = useState({
        isOpen: false,
        activeTab: 'general',
        rm: null,
        provider_type: 'LOCAL',
        farm_name: '',
        provider_lot: '',
        production_date: '',
        expiration_date: '',
        total_boxes: 0,
        remission_note: '',
        plant_entry_date: todayStr,
        reception_date: todayStr,
        analysis_date: todayStr,
        analysis_time: '',
        egg_color: 'blanco',
        egg_size: 'L',
        sample_egg_weight_g: '',
        egg_classification: 'Grado A',
        physicochemical: defaultPhysicochemical,
        organoleptic: defaultOrganoleptic,
        transport_storage: defaultTransport,
        is_camion_cerrado: true,
        is_limpieza_camion: true,
        is_cartones_limpios: true,
        bird_batches: [
            { breed: 'DEKALB WHITE', age_weeks: '69 SEMANAS DE EDAD' }
        ],
        inspector_name: '',
        quality_reviewed_by: 'Jefe de Control de Calidad',
        quality_status: 'aprobado',
        quality_defect_broken_pct: 0,
        quality_defect_dirty_pct: 0,
        quality_brix: '',
        quality_notes: '',
        isSubmitting: false
    });

    const handleOpenQualityModal = (rm) => {
        let labReport = {};
        if (rm.quality_lab_report_json) {
            try {
                labReport = typeof rm.quality_lab_report_json === 'string'
                    ? JSON.parse(rm.quality_lab_report_json)
                    : rm.quality_lab_report_json;
            } catch (e) {
                labReport = {};
            }
        }

        const sampleWeight = rm.sample_egg_weight_g !== null && rm.sample_egg_weight_g !== undefined
            ? rm.sample_egg_weight_g
            : (labReport.sample_egg_weight_g || (
                rm.weight_lbs && rm.total_boxes
                    ? Math.round((parseFloat(rm.weight_lbs) * 453.592) / (parseInt(rm.total_boxes) * 360) * 10) / 10
                    : ''
            ));

        const prov = providers.find(p => p.id === rm.provider_id);
        const isExtranjero = labReport.provider_type
            ? labReport.provider_type.toUpperCase() === 'EXTRANJERO'
            : (prov?.pais && !['EL SALVADOR', 'SV', 'SALVADOR'].includes(prov.pais.toUpperCase()));

        const plantEntry = labReport.plant_entry_date || (rm.fecha ? String(rm.fecha).split('T')[0] : todayStr);
        const receptionDt = labReport.reception_date || (rm.fecha ? String(rm.fecha).split('T')[0] : todayStr);
        const analysisDt = labReport.analysis_date || (rm.quality_date ? String(rm.quality_date).split('T')[0] : todayStr);
        const analysisTm = labReport.analysis_time || (rm.quality_date ? new Date(rm.quality_date).toTimeString().substring(0, 5) : new Date().toTimeString().substring(0, 5));

        const farm = rm.farm_name || labReport.farm_name || '';

        setQualityModal({
            isOpen: true,
            activeTab: 'general',
            rm,
            provider_type: isExtranjero ? 'EXTRANJERO' : 'LOCAL',
            farm_name: farm,
            provider_lot: rm.provider_lot || '',
            production_date: rm.production_date ? String(rm.production_date).split('T')[0] : (labReport.production_date || ''),
            expiration_date: rm.expiration_date ? String(rm.expiration_date).split('T')[0] : (labReport.expiration_date || ''),
            total_boxes: rm.total_boxes || 0,
            remission_note: rm.remission_note || labReport.remission_note || '',
            plant_entry_date: plantEntry,
            reception_date: receptionDt,
            analysis_date: analysisDt,
            analysis_time: analysisTm,
            egg_color: rm.egg_color || 'blanco',
            egg_size: rm.egg_size || 'L',
            sample_egg_weight_g: sampleWeight,
            egg_classification: rm.egg_classification || 'Grado A',

            physicochemical: {
                ...defaultPhysicochemical,
                ...(labReport.physicochemical || {}),
                granja: (labReport.physicochemical?.granja?.val1
                    ? labReport.physicochemical.granja
                    : { val1: farm, val2: '' })
            },

            organoleptic: {
                ...defaultOrganoleptic,
                ...(labReport.organoleptic || {})
            },

            transport_storage: {
                limpieza_camion: labReport.transport_storage?.limpieza_camion || 'CONFORME / LIMPIO',
                apariencia_cajas: labReport.transport_storage?.apariencia_cajas || 'BUEN ESTADO / LIMPIAS',
                temperatura_transporte: labReport.transport_storage?.temperatura_transporte || (rm.truck_temperature_c ? `${rm.truck_temperature_c} °C` : (rm.temperature_c ? `${rm.temperature_c} °C` : ''))
            },

            is_camion_cerrado: labReport.camion_cerrado !== undefined ? Boolean(labReport.camion_cerrado) : true,
            is_limpieza_camion: labReport.limpieza_camion !== undefined ? Boolean(labReport.limpieza_camion) : true,
            is_cartones_limpios: labReport.cartones_limpios_sin_plaga !== undefined ? Boolean(labReport.cartones_limpios_sin_plaga) : true,
            bird_batches: Array.isArray(labReport.bird_batches) && labReport.bird_batches.length > 0
                ? labReport.bird_batches
                : [{ breed: 'DEKALB WHITE', age_weeks: '69 SEMANAS DE EDAD' }],

            inspector_name: rm.quality_inspector_name || labReport.inspector_name || user?.nombre || '',
            quality_reviewed_by: rm.quality_reviewed_by || labReport.reviewed_by || 'Jefe de Control de Calidad',
            quality_status: rm.quality_status || (rm.status === 'aprobado' ? 'aprobado' : 'cuarentena'),
            quality_defect_broken_pct: rm.quality_defect_broken_pct !== null && rm.quality_defect_broken_pct !== undefined ? rm.quality_defect_broken_pct : 0,
            quality_defect_dirty_pct: rm.quality_defect_dirty_pct !== null && rm.quality_defect_dirty_pct !== undefined ? rm.quality_defect_dirty_pct : 0,
            quality_brix: rm.quality_brix !== null && rm.quality_brix !== undefined ? rm.quality_brix : '',
            quality_notes: rm.quality_notes || labReport.observations || '',
            isSubmitting: false
        });
    };

    const handleSaveQualityClassification = async (e) => {
        e?.preventDefault();
        if (!qualityModal.rm?.id) return;

        if (!canEditQuality) {
            toast.error('No tiene permisos asignados para modificar el dictamen de calidad (LAB 001).');
            return;
        }

        if (!qualityModal.inspector_name?.trim()) {
            toast.error('Debe ingresar el nombre del inspector responsable de Calidad.');
            return;
        }

        setQualityModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            const labReportJson = {
                provider_type: qualityModal.provider_type,
                farm_name: qualityModal.farm_name,
                provider_lot: qualityModal.provider_lot,
                production_date: qualityModal.production_date || null,
                expiration_date: qualityModal.expiration_date || null,
                total_boxes: qualityModal.total_boxes,
                remission_note: qualityModal.remission_note,
                plant_entry_date: qualityModal.plant_entry_date,
                reception_date: qualityModal.reception_date,
                analysis_date: qualityModal.analysis_date,
                analysis_time: qualityModal.analysis_time,
                sample_egg_weight_g: qualityModal.sample_egg_weight_g,
                egg_color: qualityModal.egg_color,
                egg_size: qualityModal.egg_size,
                egg_classification: qualityModal.egg_classification,
                physicochemical: qualityModal.physicochemical,
                organoleptic: qualityModal.organoleptic,
                transport_storage: qualityModal.transport_storage,
                camion_cerrado: qualityModal.is_camion_cerrado,
                limpieza_camion: qualityModal.is_limpieza_camion,
                cartones_limpios_sin_plaga: qualityModal.is_cartones_limpios,
                bird_batches: qualityModal.bird_batches,
                observations: qualityModal.quality_notes?.trim() || '',
                inspector_name: qualityModal.inspector_name.trim(),
                reviewed_by: qualityModal.quality_reviewed_by?.trim() || 'Jefe de Control de Calidad'
            };

            const payload = {
                egg_classification: qualityModal.egg_classification,
                egg_size: qualityModal.egg_size,
                egg_color: qualityModal.egg_color,
                quality_status: qualityModal.quality_status,
                quality_inspector_name: qualityModal.inspector_name.trim(),
                quality_reviewed_by: qualityModal.quality_reviewed_by?.trim() || 'Jefe de Control de Calidad',
                quality_defect_broken_pct: parseFloat(qualityModal.quality_defect_broken_pct) || 0,
                quality_defect_dirty_pct: parseFloat(qualityModal.quality_defect_dirty_pct) || 0,
                quality_brix: qualityModal.quality_brix !== '' ? parseFloat(qualityModal.quality_brix) : null,
                quality_notes: qualityModal.quality_notes?.trim() || null,
                remission_note: qualityModal.remission_note || null,
                farm_name: qualityModal.farm_name || null,
                production_date: qualityModal.production_date || null,
                expiration_date: qualityModal.expiration_date || null,
                sample_egg_weight_g: qualityModal.sample_egg_weight_g ? parseFloat(qualityModal.sample_egg_weight_g) : null,
                quality_lab_report_json: labReportJson
            };

            const res = await axios.put(`/api/egg-industrial/raw-materials/${qualityModal.rm.id}/quality-classification`, payload);

            toast.success(res.data?.message || 'Reporte técnico LAB 001 y dictamen guardados exitosamente.');

            setRawMaterials(prev => prev.map(item => {
                if (item.id === qualityModal.rm.id) {
                    return {
                        ...item,
                        ...payload,
                        quality_date: new Date().toISOString()
                    };
                }
                return item;
            }));

            if (viewingReception && viewingReception.id === qualityModal.rm.id) {
                setViewingReception(prev => ({
                    ...prev,
                    ...payload,
                    quality_date: new Date().toISOString()
                }));
            }

            setQualityModal(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
            console.error('Error guardando clasificación de calidad:', err);
            toast.error(err.response?.data?.message || 'Error al guardar dictamen de calidad.');
        } finally {
            setQualityModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const handleOpenPrintTarima = (tarimaItem, allTarimasList, customReceptionData = null) => {
        const currentProvider = providers.find(p => String(p.id) === String(formData.provider_id));
        const recData = customReceptionData || {
            reception_id: editingId || null,
            provider_name: currentProvider?.nombre || 'PROVEEDOR PENDIENTE',
            provider_lot: formData.provider_lot || 'LOTE PENDIENTE',
            fecha: formData.fecha || todayStr,
            egg_type: formData.egg_type,
            egg_color: formData.egg_color,
            egg_size: formData.egg_size,
            temperature_c: formData.temperature_c,
            truck_temperature_c: formData.truck_temperature_c,
            truck_plate: formData.truck_plate,
            driver_name: formData.driver_name,
            operator_name: formData.operator_name || user?.nombre,
            company_name: user?.company_name || 'ANDELSA, S.A. DE C.V.'
        };

        setPrintTarimaModal({
            isOpen: true,
            tarima: tarimaItem,
            allTarimas: allTarimasList || (tarimaItem ? [tarimaItem] : []),
            receptionData: recData
        });
    };

    // Helpers para cálculo y tasas de tara según configuración de proveedor y ajustes de lote
    const getProviderTareRates = () => {
        const provConfig = providerLotIntel?.config || providerLotConfigs.find(c => String(c.provider_id) === String(formData.provider_id));
        const baseB = parseInt(receptionBaseBoxes || provConfig?.base_boxes_per_tarima) || 24;
        const sepTare = parseFloat(receptionTareSep !== undefined ? receptionTareSep : (provConfig?.tare_separador_lbs || 48));
        const boxTare = parseFloat(receptionTareCaja !== undefined ? receptionTareCaja : (provConfig?.tare_caja_lbs || 30));
        const defaultHasCaja = provConfig?.default_has_caja !== undefined ? Boolean(provConfig.default_has_caja) : true;
        return {
            baseB,
            sepTare,
            boxTare,
            rateSep: baseB > 0 ? (sepTare / baseB) : 2.0,
            rateBox: baseB > 0 ? (boxTare / baseB) : 1.25,
            defaultHasCaja,
            providerName: provConfig?.provider_name || providerLotIntel?.provider?.nombre || ''
        };
    };

    const calculateTarimaTare = (boxes, hasCaja = globalHasCaja, palletTare = 0, customRates = null) => {
        let baseB = receptionBaseBoxes || 24;
        let sepTare = receptionTareSep || 48;
        let boxTare = receptionTareCaja || 30;

        if (customRates) {
            if (customRates.baseB !== undefined) baseB = parseInt(customRates.baseB) || 24;
            if (customRates.tareSep !== undefined) sepTare = parseFloat(customRates.tareSep) || 0;
            if (customRates.tareCaja !== undefined) boxTare = parseFloat(customRates.tareCaja) || 0;
        }

        const rateSep = baseB > 0 ? (sepTare / baseB) : 2.0;
        const rateBox = baseB > 0 ? (boxTare / baseB) : 1.25;
        const b = parseInt(boxes) || 0;
        const sepPart = Math.round(b * rateSep * 100) / 100;
        const boxPart = hasCaja ? Math.round(b * rateBox * 100) / 100 : 0;
        const pTare = parseFloat(palletTare) || 0;
        const total = Math.round((pTare + sepPart + boxPart) * 100) / 100;

        return {
            totalTare: total,
            tarimaTare: pTare,
            sepPart,
            boxPart,
            rateSep,
            rateBox
        };
    };

    const _handleUpdateReceptionTare = (field, value) => {
        const val = parseFloat(value) || 0;
        let newSep = receptionTareSep;
        let newCaja = receptionTareCaja;

        if (field === 'separador') {
            newSep = val;
            setReceptionTareSep(val);
        } else if (field === 'caja') {
            newCaja = val;
            setReceptionTareCaja(val);
        }

        const rates = {
            baseB: receptionBaseBoxes,
            tareSep: newSep,
            tareCaja: newCaja
        };

        const updated = tarimas.map(t => {
            const hasC = t.has_caja !== undefined ? t.has_caja : globalHasCaja;
            const b = parseInt(t.boxes_count) || 24;
            const pTare = parseFloat(t.tare_pallet_lbs) || 0;
            const calc = calculateTarimaTare(b, hasC, pTare, rates);
            const gross = parseFloat(t.gross_weight_lbs) || 0;
            return {
                ...t,
                tare_weight_lbs: calc.totalTare,
                tare_pallet_lbs: t.tare_pallet_lbs !== undefined ? t.tare_pallet_lbs : '',
                tare_separador_lbs: calc.sepPart,
                tare_caja_lbs: calc.boxPart,
                net_weight_lbs: gross > 0 ? Math.max(0, Math.round((gross - calc.totalTare) * 100) / 100) : 0
            };
        });
        setTarimas(updated);
        recalcTarimasTotals(updated);
    };

    // Helpers para tarimas
    const addTarima = (boxes = 24, hasCaja = globalHasCaja, loc = globalStorageLocation) => {
        const nextNum = tarimas.length + 1;
        const calc = calculateTarimaTare(boxes, hasCaja, 0);
        const updated = [...tarimas, {
            id: Date.now() + Math.random(),
            tarima_number: nextNum,
            gross_weight_lbs: '',
            tare_pallet_lbs: '',
            tare_weight_lbs: calc.totalTare,
            tare_separador_lbs: calc.sepPart,
            tare_caja_lbs: calc.boxPart,
            net_weight_lbs: 0,
            boxes_count: boxes,
            has_caja: hasCaja,
            storage_location: loc
        }];
        setTarimas(updated);
        recalcTarimasTotals(updated);
    };

    const addMultipleTarimas = (count, boxes = 24, hasCaja = globalHasCaja, loc = globalStorageLocation) => {
        const n = parseInt(count);
        if (!n || n <= 0) {
            toast.error('Ingrese una cantidad válida de tarimas a agregar.');
            return;
        }
        if (n > 200) {
            toast.error('El límite máximo por lote es de 200 tarimas.');
            return;
        }

        const startNum = tarimas.length + 1;
        const calc = calculateTarimaTare(boxes, hasCaja, 0);
        const newRows = [];
        for (let i = 0; i < n; i++) {
            newRows.push({
                id: Date.now() + i + Math.random(),
                tarima_number: startNum + i,
                gross_weight_lbs: '',
                tare_pallet_lbs: '',
                tare_weight_lbs: calc.totalTare,
                tare_separador_lbs: calc.sepPart,
                tare_caja_lbs: calc.boxPart,
                net_weight_lbs: 0,
                boxes_count: boxes,
                has_caja: hasCaja,
                storage_location: loc
            });
        }
        const updated = [...tarimas, ...newRows];
        setTarimas(updated);
        recalcTarimasTotals(updated);
        toast.success(`Se agregaron ${n} tarimas (#${startNum} a #${startNum + n - 1}) con éxito.`);
    };

    const applyStorageLocationToAll = (newLoc) => {
        setGlobalStorageLocation(newLoc);
        const updated = tarimas.map(t => ({
            ...t,
            storage_location: newLoc
        }));
        setTarimas(updated);
        toast.info(newLoc === 'abajo' 
            ? 'Ubicación Abajo (Piso) aplicada a todas las tarimas.' 
            : 'Ubicación Arriba (Rack) aplicada a todas las tarimas.'
        );
    };

    const applyEmpaqueModeToAll = (newHasCaja) => {
        setGlobalHasCaja(newHasCaja);
        const updated = tarimas.map(t => {
            const b = parseInt(t.boxes_count) || 24;
            const pTare = parseFloat(t.tare_pallet_lbs) || 0;
            const calc = calculateTarimaTare(b, newHasCaja, pTare);
            const gross = parseFloat(t.gross_weight_lbs) || 0;
            return {
                ...t,
                has_caja: newHasCaja,
                tare_pallet_lbs: t.tare_pallet_lbs !== undefined ? t.tare_pallet_lbs : '',
                tare_weight_lbs: calc.totalTare,
                tare_separador_lbs: calc.sepPart,
                tare_caja_lbs: calc.boxPart,
                net_weight_lbs: gross > 0 ? Math.max(0, Math.round((gross - calc.totalTare) * 100) / 100) : 0
            };
        });
        setTarimas(updated);
        recalcTarimasTotals(updated);
        toast.info(newHasCaja 
            ? 'Empaque con cajas aplicado a todas las tarimas (descuenta separador, caja y tara de pallet).' 
            : 'Empaque a granel aplicado a todas las tarimas (descuenta separador y tara de pallet).'
        );
    };

    const removeTarima = (index) => {
        const updated = tarimas.filter((_, i) => i !== index).map((t, idx) => ({
            ...t,
            tarima_number: idx + 1
        }));
        setTarimas(updated);
        recalcTarimasTotals(updated);
    };

    const updateTarima = (index, field, value) => {
        const updated = [...tarimas];
        updated[index] = { ...updated[index], [field]: value };

        const b = parseInt(field === 'boxes_count' ? value : updated[index].boxes_count) || 0;
        const hasC = field === 'has_caja' ? value : (updated[index].has_caja !== undefined ? updated[index].has_caja : globalHasCaja);
        const rates = getProviderTareRates();

        let pTare = parseFloat(field === 'tare_pallet_lbs' ? value : updated[index].tare_pallet_lbs) || 0;
        let sTare = parseFloat(field === 'tare_separador_lbs' ? value : updated[index].tare_separador_lbs);
        let cTare = parseFloat(field === 'tare_caja_lbs' ? value : updated[index].tare_caja_lbs);

        if (field === 'boxes_count') {
            sTare = Math.round(b * rates.rateSep * 100) / 100;
            cTare = hasC ? Math.round(b * rates.rateBox * 100) / 100 : 0;
            updated[index].tare_separador_lbs = sTare;
            updated[index].tare_caja_lbs = cTare;
        } else if (field === 'has_caja') {
            cTare = value ? Math.round(b * rates.rateBox * 100) / 100 : 0;
            updated[index].tare_caja_lbs = cTare;
        } else if (field === 'tare_pallet_lbs') {
            updated[index].tare_pallet_lbs = value;
            pTare = parseFloat(value) || 0;
        } else if (field === 'tare_separador_lbs') {
            updated[index].tare_separador_lbs = value;
            sTare = parseFloat(value) || 0;
        } else if (field === 'tare_caja_lbs') {
            updated[index].tare_caja_lbs = value;
            cTare = parseFloat(value) || 0;
        }

        if (isNaN(sTare)) sTare = Math.round(b * rates.rateSep * 100) / 100;
        if (isNaN(cTare)) cTare = hasC ? Math.round(b * rates.rateBox * 100) / 100 : 0;

        let totalTare = 0;
        if (field === 'tare_weight_lbs') {
            totalTare = parseFloat(value) || 0;
            updated[index].tare_weight_lbs = value;
        } else {
            totalTare = Math.round((pTare + sTare + cTare) * 100) / 100;
            updated[index].tare_weight_lbs = totalTare;
        }

        const gross = parseFloat(updated[index].gross_weight_lbs) || 0;
        updated[index].net_weight_lbs = gross > 0 ? Math.max(0, Math.round((gross - totalTare) * 100) / 100) : 0;

        setTarimas(updated);
        recalcTarimasTotals(updated);
    };

    const recalcTarimasTotals = (currentTarimas) => {
        const totalNet = currentTarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs) || 0), 0);
        const totalB = currentTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0);
        setFormData(prev => ({
            ...prev,
            weight_lbs: totalNet > 0 ? totalNet.toFixed(2) : '',
            total_boxes: totalB
        }));
    };

    const handleProviderSelect = async (providerId) => {
        setFormData(prev => ({ ...prev, provider_id: providerId }));
        if (!providerId) {
            setProviderLotIntel(null);
            return;
        }
        try {
            const res = await axios.get(`/api/egg-industrial/providers/${providerId}/lot-intelligence`);
            setProviderLotIntel(res.data);
            const provConfig = res.data?.config;
            const provTareTarima = parseFloat(provConfig?.tare_tarima_lbs !== undefined ? provConfig.tare_tarima_lbs : 0);
            const provTareSep = parseFloat(provConfig?.tare_separador_lbs !== undefined ? provConfig.tare_separador_lbs : 48);
            const provTareCaja = parseFloat(provConfig?.tare_caja_lbs !== undefined ? provConfig.tare_caja_lbs : 30);
            const provBaseBoxes = parseInt(provConfig?.base_boxes_per_tarima) || 24;
            const provHasCaja = provConfig?.default_has_caja !== undefined ? Boolean(provConfig.default_has_caja) : true;

            setReceptionTareTarima(provTareTarima);
            setReceptionTareSep(provTareSep);
            setReceptionTareCaja(provTareCaja);
            setReceptionBaseBoxes(provBaseBoxes);
            setGlobalHasCaja(provHasCaja);

            if (res.data?.suggested_lot) {
                setFormData(prev => ({
                    ...prev,
                    provider_id: providerId,
                    provider_lot: res.data.suggested_lot
                }));
            }

            const rates = {
                baseB: provBaseBoxes,
                tareSep: provTareSep,
                tareCaja: provTareCaja
            };

            // Actualizar taras en curso según parámetros de tara del nuevo proveedor
            setTarimas(prev => {
                const updated = prev.map(t => {
                    const hasC = t.has_caja !== undefined ? t.has_caja : provHasCaja;
                    const b = parseInt(t.boxes_count) || 24;
                    const pTare = parseFloat(t.tare_pallet_lbs) || 0;
                    const calc = calculateTarimaTare(b, hasC, pTare, rates);
                    const gross = parseFloat(t.gross_weight_lbs) || 0;
                    return {
                        ...t,
                        has_caja: hasC,
                        tare_pallet_lbs: t.tare_pallet_lbs !== undefined ? t.tare_pallet_lbs : '',
                        tare_weight_lbs: calc.totalTare,
                        tare_separador_lbs: calc.sepPart,
                        tare_caja_lbs: calc.boxPart,
                        net_weight_lbs: gross > 0 ? Math.max(0, Math.round((gross - calc.totalTare) * 100) / 100) : 0
                    };
                });
                recalcTarimasTotals(updated);
                return updated;
            });
        } catch (e) {
            console.error('Error fetching provider lot intelligence:', e);
        }
    };

    const loadProvidersOptions = async (search, page) => {
        const { data } = await axios.get('/api/providers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        return data;
    };

    const handleOpenLotConfig = (specificProviderId = null) => {
        const targetId = specificProviderId || formData.provider_id;
        const existingConfig = providerLotConfigs.find(c => String(c.provider_id) === String(targetId));
        if (existingConfig) {
            setLotConfigModalData({
                isOpen: true,
                config: existingConfig,
                initialProviderId: targetId
            });
        } else {
            setLotConfigModalData({
                isOpen: true,
                config: null,
                initialProviderId: targetId || ''
            });
        }
    };

    const handleLotConfigSaved = async (savedPayload) => {
        try {
            const lotCfgRes = await axios.get('/api/egg-industrial/provider-lot-configs');
            const configs = Array.isArray(lotCfgRes.data) ? lotCfgRes.data : [];
            setProviderLotConfigs(configs);

            const targetProvId = savedPayload?.provider_id || formData.provider_id;
            if (targetProvId) {
                if (String(formData.provider_id) !== String(targetProvId)) {
                    setFormData(prev => ({
                        ...prev,
                        provider_id: targetProvId,
                        provider_name: savedPayload.provider_name || prev.provider_name
                    }));
                }
                await handleProviderSelect(targetProvId);
            }
        } catch (err) {
            console.error('Error refreshing provider lot configs:', err);
        }
    };

    // Fetch raw materials, providers and lot configurations on mount
    const fetchData = async () => {
        setLoading(true);
        try {
            const [rmRes, provRes, lotCfgRes] = await Promise.all([
                axios.get('/api/egg-industrial/raw-materials'),
                axios.get('/api/providers', { params: { limit: 2000 } }),
                axios.get('/api/egg-industrial/provider-lot-configs')
            ]);
            setRawMaterials(rmRes.data);
            setProviders(Array.isArray(provRes.data) ? provRes.data : (provRes.data?.data || []));
            setProviderLotConfigs(Array.isArray(lotCfgRes.data) ? lotCfgRes.data : []);
        } catch (error) {
            console.error('Error fetching egg reception data:', error);
            toast.error('Error al cargar la información de recepción.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validations
        if (!formData.provider_id) {
            return toast.error('Debe seleccionar un proveedor.');
        }
        if (!formData.weight_lbs || parseFloat(formData.weight_lbs) <= 0) {
            return toast.error('El peso debe ser mayor a cero.');
        }
        if (!formData.provider_lot.trim()) {
            return toast.error('El lote del proveedor es obligatorio.');
        }

        const parsedWeight = parseFloat(formData.weight_lbs);
        const parsedTemp = formData.temperature_c !== '' && formData.temperature_c !== null 
            ? parseFloat(formData.temperature_c) 
            : null;

        // Quality rule warning toast only if temperature was entered
        if (parsedTemp !== null && !isNaN(parsedTemp) && parsedTemp > 6.0) {
            toast.warning('ALERTA DE CONTROL DE CALIDAD: La temperatura ingresada supera el límite máximo de inocuidad (6°C). El lote será marcado para revisión adicional.', { duration: 6000 });
        }

        setIsSubmitting(true);
        try {
            const urlsArray = formData.certificate_urls.trim() 
                ? formData.certificate_urls.split(',').map(url => url.trim())
                : [];

            const cleanTarimas = useTarimas ? tarimas.map(t => ({
                ...t,
                storage_location: t.storage_location || globalStorageLocation || 'abajo'
            })) : null;

            const payload = {
                ...formData,
                storage_location: globalStorageLocation || formData.storage_location || 'abajo',
                provider_lot: formData.provider_lot.trim().toUpperCase(),
                weight_lbs: parsedWeight,
                total_boxes: formData.total_boxes || 0,
                temperature_c: parsedTemp,
                truck_temperature_c: formData.truck_temperature_c ? parseFloat(formData.truck_temperature_c) : null,
                truck_plate: formData.truck_plate || null,
                driver_name: formData.driver_name || null,
                tarimas_json: cleanTarimas,
                certificate_urls: urlsArray
            };

            if (editingId) {
                await axios.put(`/api/egg-industrial/raw-materials/${editingId}`, payload);
                toast.success('Recepción de materia prima actualizada con éxito.');
            } else {
                await axios.post('/api/egg-industrial/raw-materials', payload);
                toast.success('Recepción de materia prima registrada con éxito.');
            }

            try {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
            } catch (e) { }
            setLastDraftSavedAt(null);
            setHasRestoredDraft(false);

            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error saving raw material reception:', error);
            toast.error(error.response?.data?.message || 'Error al guardar la recepción.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setIsCreateModalOpen(false);
        setUseTarimas(false);
        setProviderLotIntel(null);
        setGlobalHasCaja(true);
        setGlobalStorageLocation('abajo');
        setBulkAddCount(10);
        setReceptionTareTarima(0);
        setReceptionTareSep(48);
        setReceptionTareCaja(30);
        setReceptionBaseBoxes(24);
        setHasRestoredDraft(false);
        setTarimas([{ id: 1, tarima_number: 1, gross_weight_lbs: '', tare_weight_lbs: 78, net_weight_lbs: 0, boxes_count: 24, has_caja: true, tare_pallet_lbs: 0, tare_separador_lbs: 48, tare_caja_lbs: 30, storage_location: 'abajo' }]);
        setFormData({
            provider_id: '',
            provider_name: '',
            egg_type: 'huevo cáscara',
            egg_color: 'blanco',
            egg_size: 'L',
            egg_classification: 'Grado A',
            fecha: new Date().toISOString().split('T')[0],
            weight_lbs: '',
            total_boxes: 0,
            storage_location: 'abajo',
            temperature_c: '',
            truck_temperature_c: '',
            truck_plate: '',
            driver_name: '',
            provider_lot: '',
            certificate_urls: '',
            operator_name: user?.nombre || '',
            status: 'aprobado'
        });
    };

    const handleOpenNewReception = () => {
        setEditingId(null);
        const restored = checkForDraft();
        if (restored) {
            toast.info('Se ha restaurado el borrador guardado automáticamente.', { duration: 4000 });
        } else {
            resetForm();
        }
        setIsCreateModalOpen(true);
    };

    const handleEdit = (rm) => {
        let certUrls = '';
        try {
            certUrls = (JSON.parse(rm.certificate_urls || '[]') || []).join(', ');
        } catch (e) { certUrls = ''; }

        let parsedTarimas = [];
        try {
            parsedTarimas = typeof rm.tarimas_json === 'string'
                ? JSON.parse(rm.tarimas_json || '[]')
                : (rm.tarimas_json || []);
        } catch (e) { parsedTarimas = []; }

        const provCfg = providerLotConfigs.find(c => String(c.provider_id) === String(rm.provider_id));
        setReceptionTareTarima(provCfg?.tare_tarima_lbs !== undefined ? parseFloat(provCfg.tare_tarima_lbs) : 0);
        setReceptionTareSep(provCfg?.tare_separador_lbs !== undefined ? parseFloat(provCfg.tare_separador_lbs) : 48);
        setReceptionTareCaja(provCfg?.tare_caja_lbs !== undefined ? parseFloat(provCfg.tare_caja_lbs) : 30);
        setReceptionBaseBoxes(parseInt(provCfg?.base_boxes_per_tarima) || 24);

        const mainLoc = rm.storage_location || 'abajo';
        setGlobalStorageLocation(mainLoc);

        setEditingId(rm.id);
        setFormData({
            provider_id: String(rm.provider_id || ''),
            provider_name: rm.provider_name || '',
            egg_type: rm.egg_type || 'huevo cáscara',
            egg_color: rm.egg_color || 'blanco',
            egg_size: rm.egg_size || 'L',
            egg_classification: rm.egg_classification || 'Grado A',
            fecha: rm.fecha ? rm.fecha.split('T')[0] : (rm.created_at ? rm.created_at.split('T')[0] : todayStr),
            weight_lbs: String(rm.weight_lbs || ''),
            total_boxes: rm.total_boxes || 0,
            storage_location: mainLoc,
            temperature_c: rm.temperature_c !== null && rm.temperature_c !== undefined ? String(rm.temperature_c) : '',
            truck_temperature_c: rm.truck_temperature_c !== null && rm.truck_temperature_c !== undefined ? String(rm.truck_temperature_c) : '',
            truck_plate: rm.truck_plate || '',
            driver_name: rm.driver_name || '',
            provider_lot: rm.provider_lot || '',
            certificate_urls: certUrls,
            operator_name: rm.operator_name || user?.nombre || '',
            status: rm.status || 'aprobado'
        });

        if (Array.isArray(parsedTarimas) && parsedTarimas.length > 0) {
            const normalized = parsedTarimas.map((t, idx) => ({
                ...t,
                tarima_number: t.tarima_number || (idx + 1),
                has_caja: t.has_caja !== undefined ? Boolean(t.has_caja) : true,
                storage_location: t.storage_location || mainLoc
            }));
            setTarimas(normalized);
            setGlobalHasCaja(normalized[0]?.has_caja !== undefined ? normalized[0].has_caja : true);
            setGlobalStorageLocation(normalized[0]?.storage_location || mainLoc);
            setUseTarimas(true);
        } else {
            setUseTarimas(false);
            setTarimas([{ id: 1, tarima_number: 1, gross_weight_lbs: rm.weight_lbs || '', tare_weight_lbs: 0, net_weight_lbs: rm.weight_lbs || 0, boxes_count: rm.total_boxes || 24, has_caja: true, tare_pallet_lbs: 0, tare_separador_lbs: 0, tare_caja_lbs: 0, storage_location: mainLoc }]);
        }

        setIsCreateModalOpen(true);
    };

    const handlePrintReceptionSummary = (rm) => {
        if (!rm) return;
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            let parsedTarimas = [];
            try {
                parsedTarimas = typeof rm.tarimas_json === 'string'
                    ? JSON.parse(rm.tarimas_json || '[]')
                    : (rm.tarimas_json || []);
            } catch (e) { parsedTarimas = []; }

            const folio = `REC-${String(rm.id).padStart(5, '0')}`;
            const emissionDate = new Date().toLocaleDateString('es-SV', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // 1. Header Corporativo Superior
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, pageWidth, 26, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('ANDELSA, S.A. DE C.V.', 14, 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(203, 213, 225);
            doc.text('PLANTA INDUSTRIAL DE PASTEURIZACIÓN Y QUEBRADO DE HUEVO', 14, 16);
            doc.text('REGISTRO OFICIAL DE RECEPCIÓN E INSPECCIÓN DE MATERIA PRIMA (LOG-004)', 14, 21);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(56, 189, 248); // sky-400
            doc.text(`FOLIO: ${folio}`, pageWidth - 14, 12, { align: 'right' });
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7.5);
            doc.text(`ESTADO: ${(rm.status || 'APROBADO').toUpperCase()}`, pageWidth - 14, 18, { align: 'right' });

            // 2. Metadatos de la Recepción
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('HOJA DE ENTRADA Y CONTROL DE CALIDAD EN BÁSCULA', 14, 34);

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Fecha de Emisión: ${emissionDate} | Planta ANDELSA El Salvador | Auditoría de Trazabilidad`, 14, 39);

            // Tabla 1: Datos Generales y Cadena de Frío
            autoTable(doc, {
                startY: 43,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 2 },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 45 },
                    1: { cellWidth: 50 },
                    2: { fontStyle: 'bold', cellWidth: 45 },
                    3: { cellWidth: 50 }
                },
                head: [['Parámetro General', 'Información', 'Parámetro Técnico / Frío', 'Registro Inspección']],
                body: [
                    ['Proveedor:', rm.provider_name || 'N/A', 'Placa de Transporte:', rm.truck_plate || 'Sin transporte'],
                    ['Lote de Proveedor:', rm.provider_lot || 'N/A', 'Motorista:', rm.driver_name || 'N/A'],
                    ['Fecha de Ingreso:', formatDate(rm.fecha || rm.created_at), 'Temp. Termoking (°C):', rm.truck_temperature_c !== null && rm.truck_temperature_c !== undefined ? `${rm.truck_temperature_c}°C` : 'N/R'],
                    ['Tipo de Producto:', `${rm.egg_type} (${rm.egg_color || 'blanco'})`, 'Temp. Interna Huevo:', rm.temperature_c !== null && rm.temperature_c !== undefined ? `${rm.temperature_c}°C` : 'N/R'],
                    ['Clasificación Calidad:', `${rm.egg_classification || 'Grado A'} (${(rm.quality_status || rm.status || 'Aprobado').toUpperCase()})`, 'Inspector Calidad:', rm.quality_inspector_name || rm.operator_name || 'N/A'],
                    ['Total Cajas Recibidas:', `${rm.total_boxes || 0} cajas (Talla: ${rm.egg_size || 'L'})`, 'Total Peso Neto:', `${parseFloat(rm.weight_lbs || 0).toLocaleString()} Lbs`]
                ]
            });

            // Tabla 2: Desglose de Tarimas en Báscula
            const tarimaRows = parsedTarimas.map((t, idx) => {
                const tNum = t.tarima_number || (idx + 1);
                const code = `TAR-${(rm.provider_lot || 'LOT').toUpperCase()}-${String(tNum).padStart(2, '0')}`;
                const tLoc = (t.storage_location || rm.storage_location || 'abajo') === 'arriba' ? 'ARRIBA' : 'ABAJO';
                return [
                    `Tarima #${tNum}`,
                    code,
                    tLoc,
                    `${t.boxes_count || 0} cajas`,
                    `${parseFloat(t.gross_weight_lbs || 0).toLocaleString()} Lbs`,
                    `${parseFloat(t.tare_weight_lbs || 0).toLocaleString()} Lbs`,
                    `${parseFloat(t.net_weight_lbs || 0).toLocaleString()} Lbs`
                ];
            });

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 8,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 2 },
                head: [['# Tarima', 'Código Identificador', 'Ubicación', 'Cajas', 'Peso Bruto', 'Tara', 'Peso Neto']],
                body: tarimaRows.length > 0 ? tarimaRows : [
                    ['Tarima #1 (Global)', `TAR-${(rm.provider_lot || 'LOT').toUpperCase()}-01`, (rm.storage_location || 'abajo') === 'arriba' ? 'ARRIBA' : 'ABAJO', `${rm.total_boxes || 0} cajas`, `${parseFloat(rm.weight_lbs || 0).toLocaleString()} Lbs`, '0.00 Lbs', `${parseFloat(rm.weight_lbs || 0).toLocaleString()} Lbs`]
                ],
                foot: [[
                    'TOTALES CONSOLIDADOS',
                    `${tarimaRows.length || 1} Tarimas`,
                    '-',
                    `${rm.total_boxes || 0} cajas`,
                    '-',
                    '-',
                    `${parseFloat(rm.weight_lbs || 0).toLocaleString()} Lbs`
                ]],
                footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 }
            });

            // Tabla 3: Evaluación de Calidad de Lote (LAB-004)
            if (rm.quality_inspector_name || rm.quality_notes || rm.quality_defect_broken_pct > 0 || rm.quality_defect_dirty_pct > 0) {
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 6,
                    theme: 'grid',
                    headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
                    bodyStyles: { fontSize: 7.2, textColor: [30, 41, 59], cellPadding: 2 },
                    columnStyles: {
                        0: { fontStyle: 'bold', cellWidth: 50 },
                        1: { cellWidth: 140 }
                    },
                    head: [['DICTAMEN TÉCNICO DE CALIDAD (LAB-004)', 'RESULTADO']],
                    body: [
                        ['Inspector Calidad Responsable:', rm.quality_inspector_name || 'N/A'],
                        ['Clasificación Oficial Asignada:', `${rm.egg_classification || 'Grado A'} (Talla: ${rm.egg_size || 'L'}) - Dictamen: ${(rm.quality_status || rm.status || 'Aprobado').toUpperCase()}`],
                        ['Muestreo Defectos Físicos:', `% Huevo Roto/Fisurado: ${rm.quality_defect_broken_pct || 0}% | % Huevo Sucio: ${rm.quality_defect_dirty_pct || 0}% | Brix: ${rm.quality_brix ? `${rm.quality_brix}°Bx` : 'N/A'}`],
                        ['Observaciones Técnicas:', rm.quality_notes || 'Lote evaluado conforme parámetros de calidad e inocuidad de planta.']
                    ]
                });
            }

            // 3. Firmas de Aprobación
            const finalY = doc.lastAutoTable.finalY + 22;
            if (finalY < 240) {
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(71, 85, 105);

                doc.line(20, finalY, 70, finalY);
                doc.text('Aseguramiento de Calidad', 25, finalY + 4);
                doc.text(rm.quality_inspector_name ? `Firma: ${rm.quality_inspector_name.slice(0, 20)}` : 'Firma y Sello LAB-004', 22, finalY + 8);

                doc.line(80, finalY, 130, finalY);
                doc.text('Bodega / Receptor de Báscula', 83, finalY + 4);
                doc.text(rm.operator_name ? `Firma: ${rm.operator_name.slice(0, 20)}` : 'Firma y Verificación', 83, finalY + 8);

                doc.line(140, finalY, 190, finalY);
                doc.text('Motorista / Proveedor', 147, finalY + 4);
                doc.text(rm.driver_name ? `Firma: ${rm.driver_name.slice(0, 20)}` : 'Firma de Entrega', 147, finalY + 8);
            }

            doc.save(`Resumen-Recepcion-${folio}-${(rm.provider_lot || 'LOTE').replace(/\s+/g, '')}.pdf`);
            toast.success('Resumen de recepción generado y descargado en PDF.');
        } catch (err) {
            console.error('Error al generar PDF de recepción:', err);
            toast.error('Error al generar resumen de recepción.');
        }
    };

    const handleVoid = async (id) => {
        try {
            await axios.put(`/api/egg-industrial/raw-materials/${id}/void`);
            toast.success('Recepción anulada correctamente.');
            setVoidConfirmId(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al anular.');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Filter raw materials based on search
    const filteredMaterials = rawMaterials.filter(rm => 
        rm.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rm.provider_lot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rm.egg_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helpers to style status badge
    const getStatusBadge = (status) => {
        switch (status) {
            case 'aprobado':
                return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
            case 'cuarentena':
                return 'bg-amber-50 text-amber-700 border border-amber-200';
            case 'rechazado':
                return 'bg-rose-50 text-rose-700 border border-rose-200';
            case 'anulado':
                return 'bg-slate-100 text-slate-500 border border-slate-200';
            default:
                return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'aprobado':
                return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
            case 'cuarentena':
                return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
            case 'rechazado':
                return <XCircle className="h-3.5 w-3.5 text-rose-600" />;
            case 'anulado':
                return <Ban className="h-3.5 w-3.5 text-slate-500" />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Boxes className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Recepción de Huevo en Cáscara y Líquido</h1>
                        <p className="text-xs text-slate-500 font-medium">Registro de ingresos de materia prima, pesaje de tarimas en báscula y control de cadena de frío</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleOpenNewReception}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                    <Plus size={16} />
                    Nueva Recepción
                </button>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            {editingId ? <Pencil className="h-4 w-4 text-indigo-600" /> : <Plus className="h-4 w-4 text-indigo-600" />}
                            {editingId ? `Editar Recepción #${editingId} - Lote: ${formData.provider_lot || ''}` : 'Boleta de Ingreso y Control de Calidad (LOG-004)'}
                        </h2>
                        <button 
                            type="button" 
                            onClick={resetForm}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                        >
                            <XCircle size={18} />
                        </button>
                    </div>

                    {/* Presets y Proveedores Parametrizados */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Boxes size={13} className="text-indigo-600" />
                                Proveedores Frecuentes y Prefijos Parametrizados:
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-medium">Autocompleta proveedor y correlativo</span>
                                <button
                                    type="button"
                                    onClick={() => handleOpenLotConfig()}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline cursor-pointer bg-transparent border-0 p-0"
                                    title="Parametrizar prefijo de lote y taras por proveedor"
                                >
                                    <Settings size={11} />
                                    Parametrizar
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {providerLotConfigs.length > 0 ? (
                                providerLotConfigs.map((cfg) => (
                                    <div
                                        key={cfg.id}
                                        className={`inline-flex items-center rounded-xl border shadow-xs transition-all ${
                                            String(formData.provider_id) === String(cfg.provider_id)
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleProviderSelect(cfg.provider_id)}
                                            className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-transparent border-0 text-inherit"
                                        >
                                            <span>📦 {cfg.provider_name}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                                                String(formData.provider_id) === String(cfg.provider_id)
                                                    ? 'bg-indigo-700 text-white'
                                                    : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                                            }`}>
                                                {cfg.lot_prefix}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenLotConfig(cfg.provider_id);
                                            }}
                                            title={`Editar parametrización de ${cfg.provider_name}`}
                                            className={`pr-2.5 pl-1 py-1.5 cursor-pointer transition-opacity bg-transparent border-0 ${
                                                String(formData.provider_id) === String(cfg.provider_id)
                                                    ? 'text-indigo-200 hover:text-white'
                                                    : 'text-slate-400 hover:text-indigo-600'
                                            }`}
                                        >
                                            <Settings size={12} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[11px] text-slate-500 italic flex items-center gap-2">
                                    <span>No hay proveedores con prefijo parametrizado aún.</span>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenLotConfig()}
                                        className="text-indigo-600 font-bold underline cursor-pointer bg-transparent border-0 p-0"
                                    >
                                        Parametrizar en Configuración de Planta
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Banner de Borrador Dinámico Restaurado */}
                        {hasRestoredDraft && (
                            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-200 text-amber-900 rounded-lg shrink-0">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <p className="font-extrabold text-amber-950 text-xs">
                                            Borrador de Pesaje Restaurado ({lastDraftSavedAt})
                                        </p>
                                        <p className="text-[11px] text-amber-800">
                                            Se restauraron automáticamente {tarimas.length} tarimas y datos ingresados de la sesión previa para proteger tu trabajo contra cierres accidentales.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={discardDraft}
                                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto shrink-0"
                                    title="Descartar el borrador y volver al formulario vacío"
                                >
                                    Descartar Borrador
                                </button>
                            </div>
                        )}

                        {/* Datos del Transporte (LOG-004) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-2">
                                <Truck size={15} />
                                Control de Transporte & Cadena de Frío (LOG-004)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Placa de Vehículo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: C123-456"
                                        value={formData.truck_plate}
                                        onChange={(e) => setFormData({ ...formData, truck_plate: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Motorista / Chofer</label>
                                    <input
                                        type="text"
                                        placeholder="Nombre del conductor"
                                        value={formData.driver_name}
                                        onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Temp. Termoking/Cabina (°C)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 4.5"
                                            value={formData.truck_temperature_c}
                                            onChange={(e) => setFormData({ ...formData, truck_temperature_c: e.target.value })}
                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        />
                                        <Thermometer size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Datos de la Carga */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Provider selection */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Proveedor de Origen *</label>
                                <SearchableSelect
                                    options={providers}
                                    loadOptions={loadProvidersOptions}
                                    value={formData.provider_id}
                                    onChange={(e, opt) => {
                                        handleProviderSelect(e.target.value);
                                        if (opt) {
                                            setFormData(prev => ({
                                                ...prev,
                                                provider_id: e.target.value,
                                                provider_name: opt.nombre || opt.label || prev.provider_name
                                            }));
                                        }
                                    }}
                                    valueKey="id"
                                    labelKey="nombre"
                                    placeholder="Buscar proveedor..."
                                    codeKey="nrc"
                                    codeLabel="NRC"
                                    selectedLabel={formData.provider_name}
                                    dropdownWidth={460}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Fecha de Recepción</label>
                                <input
                                    type="date"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                />
                            </div>

                            {/* Egg type */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Tipo de Huevo</label>
                                <select
                                    value={formData.egg_type}
                                    onChange={(e) => setFormData({ ...formData, egg_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                >
                                    <option value="huevo cáscara">Huevo en Cáscara</option>
                                    <option value="huevo líquido">Huevo Líquido</option>
                                    <option value="clara">Clara Líquida</option>
                                    <option value="yema">Yema Líquida</option>
                                </select>
                            </div>

                            {/* Egg color, size & classification conditionally active */}
                            {formData.egg_type === 'huevo cáscara' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Color</label>
                                        <select
                                            value={formData.egg_color}
                                            onChange={(e) => setFormData({ ...formData, egg_color: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="blanco">Blanco</option>
                                            <option value="marrón">Marrón</option>
                                            <option value="mixto">Mixto</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tamaño / Calibre</label>
                                        <select
                                            value={formData.egg_size}
                                            onChange={(e) => setFormData({ ...formData, egg_size: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="S">S (Chico)</option>
                                            <option value="M">M (Mediano)</option>
                                            <option value="L">L (Grande)</option>
                                            <option value="XL">XL (Extra Grande)</option>
                                            <option value="Jumbo">Jumbo</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Clasificación Inicial</label>
                                        <select
                                            value={formData.egg_classification}
                                            onChange={(e) => setFormData({ ...formData, egg_classification: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="Grado AA">Grado AA (Extra Especial)</option>
                                            <option value="Grado A">Grado A (Estándar Premium)</option>
                                            <option value="Grado B">Grado B (Comercial)</option>
                                            <option value="Grado Industrial">Grado Industrial</option>
                                        </select>
                                    </div>
                                </div>
                            ) : null}

                            {/* Lote del proveedor con inteligencia histórica */}
                            <div className="space-y-1 md:col-span-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                                        <span>Lote del Proveedor *</span>
                                        {providerLotIntel?.prefix && (
                                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                                Prefijo: {providerLotIntel.prefix}
                                            </span>
                                        )}
                                    </label>
                                    {providerLotIntel?.last_registered_lot && (
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            Último: <strong className="text-slate-800 font-bold">{providerLotIntel.last_registered_lot}</strong>
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.provider_lot}
                                        onChange={(e) => setFormData({ ...formData, provider_lot: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Ej: LOTE-AV-0908"
                                    />
                                    {providerLotIntel?.suggested_lot && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, provider_lot: providerLotIntel.suggested_lot }))}
                                            className="absolute right-2 top-2 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                                            title="Reaplicar sugerencia inteligente"
                                        >
                                            <Sparkles size={11} />
                                            Sugerir
                                        </button>
                                    )}
                                </div>

                                {/* Desglose de Histórico de Lotes Anteriores */}
                                {providerLotIntel?.historical_lots?.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-tight">
                                            <History size={11} className="text-slate-400" />
                                            Histórico Anterior:
                                        </span>
                                        {providerLotIntel.historical_lots.map((hl) => (
                                            <button
                                                key={hl.id}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, provider_lot: hl.provider_lot }))}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded text-[10px] font-mono font-bold transition-all"
                                                title={`Registrado el ${hl.fecha || 'N/D'} (${hl.weight_lbs} lbs)`}
                                            >
                                                {hl.provider_lot}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Temperature (NO REQUERIDA / OPCIONAL) */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                    <span>Temperatura Huevo (°C)</span>
                                    <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.temperature_c}
                                        onChange={(e) => setFormData({ ...formData, temperature_c: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Opcional (Máx 6.0°C si aplica)"
                                        step="0.01"
                                    />
                                    <Thermometer className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* MODO PESAJE: DIRECTO VS TARIMAS */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                        <Boxes size={15} className="text-indigo-600" />
                                        Detalle de Pesaje & Cajas
                                    </h4>
                                    <p className="text-[11px] text-slate-500">Seleccione si registrará el peso total directo o tarima por tarima de báscula</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => setUseTarimas(false)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${!useTarimas ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Pesaje Directo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUseTarimas(true)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${useTarimas ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Por Tarimas (Báscula)
                                    </button>
                                </div>
                            </div>

                            {!useTarimas ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Total Cajas de Huevo</label>
                                        <input
                                            type="number"
                                            value={formData.total_boxes}
                                            onChange={(e) => setFormData({ ...formData, total_boxes: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            placeholder="Ej: 360"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Peso Neto Recibido (Libras) *</label>
                                        <input
                                            type="number"
                                            value={formData.weight_lbs}
                                            onChange={(e) => setFormData({ ...formData, weight_lbs: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            placeholder="Ej: 16500.50"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Ubicación de Almacenamiento</label>
                                        <select
                                            value={formData.storage_location || 'abajo'}
                                            onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="abajo">⬇ Abajo (Nivel 1 / Piso)</option>
                                            <option value="arriba">⬆ Arriba (Nivel 2 / Rack Superior)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Espacio Interactivo de Edición de las 3 Taras: Tarima (Pallet), Cartón (Separador) y Caja (Jaba) */}
                                    {/* Cabecera compacta de control de empaque y aviso de taras */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200 rounded-xl shadow-2xs">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                                                <Scale size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                                        Registro de Tarimas en Báscula
                                                    </h4>
                                                    {lastDraftSavedAt && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold shadow-2xs" title="Taras y pesajes guardados dinámicamente en borrador local">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                            Autoguardado {lastDraftSavedAt}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    Base proveedor: <span className="font-bold text-slate-700">{receptionBaseBoxes} Cajas</span> • Las taras y ubicaciones se calculan y editan directamente en la tabla de abajo.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Switch rápido de modo de empaque, ubicación masiva y visibilidad de desglose de taras */}
                                        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailedTares(!showDetailedTares)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                                    showDetailedTares
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                                title={showDetailedTares ? 'Ocultar columnas de Tara Cartón y Tara Caja' : 'Mostrar columnas de Tara Cartón y Tara Caja'}
                                            >
                                                {showDetailedTares ? <EyeOff size={13} /> : <Eye size={13} />}
                                                <span>{showDetailedTares ? 'Ocultar Tara Cartón / Caja' : 'Ver Tara Cartón / Caja'}</span>
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ubicación:</span>
                                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyStorageLocationToAll('abajo')}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            globalStorageLocation === 'abajo'
                                                                ? 'bg-blue-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica ubicación Abajo (Piso) a todas las tarimas"
                                                    >
                                                        ⬇ Abajo (Piso)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyStorageLocationToAll('arriba')}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            globalStorageLocation === 'arriba'
                                                                ? 'bg-amber-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica ubicación Arriba (Rack) a todas las tarimas"
                                                    >
                                                        ⬆ Arriba (Rack)
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Empaque:</span>
                                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyEmpaqueModeToAll(true)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            globalHasCaja
                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica modo Con Caja a todas las tarimas"
                                                    >
                                                        Con Cajas
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyEmpaqueModeToAll(false)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            !globalHasCaja
                                                                ? 'bg-amber-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica modo A Granel (sin cajas) a todas las tarimas"
                                                    >
                                                        A Granel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2 text-center w-10">#</th>
                                                    <th className="p-2 w-20 text-center">Empaque</th>
                                                    <th className="p-2 w-20 text-center">Ubicación</th>
                                                    <th className="p-2 w-16 text-center">Cajas</th>
                                                    <th className="p-2 w-24 text-right">Peso Bruto (lb)</th>
                                                    <th className="p-2 w-24 text-right">Tara Tarima (lb)</th>
                                                    {showDetailedTares && (
                                                        <>
                                                            <th className="p-2 w-24 text-right bg-indigo-50/50 text-indigo-900">Tara Cartón (lb)</th>
                                                            <th className="p-2 w-24 text-right bg-indigo-50/50 text-indigo-900">Tara Caja (lb)</th>
                                                        </>
                                                    )}
                                                    <th className="p-2 w-28 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span>Tara Total (lb)</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowDetailedTares(!showDetailedTares)}
                                                                className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 cursor-pointer"
                                                                title={showDetailedTares ? "Ocultar columnas de cartón y caja" : "Mostrar columnas de cartón y caja"}
                                                            >
                                                                {showDetailedTares ? <EyeOff size={12} /> : <Eye size={12} />}
                                                            </button>
                                                        </div>
                                                    </th>
                                                    <th className="p-2 text-right w-24">Peso Neto (lb)</th>
                                                    <th className="p-2 w-16 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {tarimas.map((t, idx) => {
                                                    const hasC = t.has_caja !== undefined ? t.has_caja : globalHasCaja;

                                                    return (
                                                        <tr key={t.id || idx} className="hover:bg-slate-50">
                                                            <td className="p-2 text-center text-slate-500 text-xs font-bold">{t.tarima_number}</td>
                                                            <td className="p-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateTarima(idx, 'has_caja', !hasC)}
                                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                                                        hasC
                                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                                                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                                    }`}
                                                                    title="Clic para alternar entre Con Caja y A Granel"
                                                                >
                                                                    {hasC ? 'Con Caja' : 'A Granel'}
                                                                </button>
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateTarima(idx, 'storage_location', (t.storage_location || 'abajo') === 'abajo' ? 'arriba' : 'abajo')}
                                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                                                                        (t.storage_location || 'abajo') === 'abajo'
                                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                                                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                                    }`}
                                                                    title="Clic para alternar entre Abajo (Piso) y Arriba (Rack)"
                                                                >
                                                                    {(t.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                </button>
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    value={t.boxes_count}
                                                                    onChange={(e) => updateTarima(idx, 'boxes_count', e.target.value)}
                                                                    className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    placeholder="0.0"
                                                                    value={t.gross_weight_lbs}
                                                                    onChange={(e) => updateTarima(idx, 'gross_weight_lbs', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    min="0"
                                                                    placeholder="0.0"
                                                                    value={t.tare_pallet_lbs !== undefined ? t.tare_pallet_lbs : ''}
                                                                    onChange={(e) => updateTarima(idx, 'tare_pallet_lbs', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                    title="Tara física del pallet/tarima en báscula"
                                                                />
                                                            </td>
                                                            {showDetailedTares && (
                                                                <>
                                                                    <td className="p-2 bg-indigo-50/20">
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            min="0"
                                                                            placeholder="0.0"
                                                                            value={t.tare_separador_lbs !== undefined ? t.tare_separador_lbs : ''}
                                                                            onChange={(e) => updateTarima(idx, 'tare_separador_lbs', e.target.value)}
                                                                            className="w-full px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                            title="Tara de separadores de cartón"
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 bg-indigo-50/20">
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            min="0"
                                                                            placeholder="0.0"
                                                                            value={t.tare_caja_lbs !== undefined ? t.tare_caja_lbs : ''}
                                                                            onChange={(e) => updateTarima(idx, 'tare_caja_lbs', e.target.value)}
                                                                            className="w-full px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                            title="Tara de cajas o jabas plásticas"
                                                                        />
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={t.tare_weight_lbs}
                                                                    onChange={(e) => updateTarima(idx, 'tare_weight_lbs', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs text-indigo-900 font-black text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                    title={`Tara Total: ${t.tare_weight_lbs} lb (Pallet: ${t.tare_pallet_lbs || 0} lb + Cartón: ${t.tare_separador_lbs || 0} lb + Caja: ${t.tare_caja_lbs || 0} lb)`}
                                                                />
                                                            </td>
                                                            <td className="p-2 text-right font-black text-emerald-700 text-xs">
                                                                {parseFloat(t.net_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lb
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenPrintTarima(t, tarimas)}
                                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                                        title={`Imprimir Ficha / Etiqueta de Tarima #${t.tarima_number}`}
                                                                    >
                                                                        <Printer size={14} />
                                                                    </button>
                                                                    {tarimas.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeTarima(idx)}
                                                                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                                                            title="Eliminar Tarima"
                                                                        >
                                                                            <XCircle size={15} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => addTarima(24, globalHasCaja)}
                                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-xs transition-all"
                                            >
                                                <Plus size={14} />
                                                Agregar Tarima #{tarimas.length + 1}
                                            </button>

                                            {/* Control de adición de múltiples tarimas */}
                                            <div className="inline-flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                                <span className="text-[11px] font-bold text-slate-500 pl-1.5">Lote:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={bulkAddCount}
                                                    onChange={(e) => setBulkAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-800 focus:bg-white"
                                                    placeholder="10"
                                                    title="Cantidad de tarimas a generar en bloque"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => addMultipleTarimas(bulkAddCount, 24, globalHasCaja)}
                                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 flex items-center gap-1 transition-all"
                                                    title={`Agregar ${bulkAddCount} tarimas de 24 cajas de un solo`}
                                                >
                                                    <Layers size={13} />
                                                    + Agregar {bulkAddCount} Tarimas
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenPrintTarima(tarimas[0], tarimas)}
                                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-xs transition-all"
                                                title="Imprimir etiquetas de todas las tarimas registradas"
                                            >
                                                <Printer size={14} />
                                                Imprimir Tarimas ({tarimas.length})
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs shadow-xs">
                                            <span className="text-slate-500">Tarimas: <strong className="text-slate-800">{tarimas.length}</strong></span>
                                            <span className="text-slate-500">Total Cajas: <strong className="text-indigo-700">{formData.total_boxes}</strong></span>
                                            <span className="text-slate-500">Neto Total: <strong className="text-emerald-700">{formData.weight_lbs || '0.00'} lb</strong></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Certificados y Calidad Inicial */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Estado Inicial Calidad</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                >
                                    <option value="aprobado">Aprobado para Producción</option>
                                    <option value="cuarentena">En Cuarentena</option>
                                    <option value="rechazado">Rechazado (No Apto)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">URLs Certificados Inocuidad</label>
                                <input
                                    type="text"
                                    value={formData.certificate_urls}
                                    onChange={(e) => setFormData({ ...formData, certificate_urls: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    placeholder="Ej: https://docs.quality.com/cert1.pdf"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-55"
                            >
                                {isSubmitting ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Confirmar Ingreso')}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {/* HISTORY LIST CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            Historial de Ingresos de Materia Prima
                        </h2>
                        
                        <div className="relative w-full md:w-80">
                            <input
                                type="text"
                                placeholder="Buscar por proveedor, lote o tipo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                            />
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Cargando historial de recepciones...
                            </div>
                        ) : filteredMaterials.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                                No se encontraron registros de materia prima.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-3 py-2.5">Fecha</th>
                                        <th className="px-3 py-2.5">Proveedor / Lote</th>
                                        <th className="px-3 py-2.5">Transporte (LOG-004)</th>
                                        <th className="px-3 py-2.5">Tipo / Presentación</th>
                                        <th className="px-3 py-2.5 text-right">Cajas</th>
                                        <th className="px-3 py-2.5 text-right">Peso (Lbs)</th>
                                        <th className="px-3 py-2.5 text-right">Stock (Lbs)</th>
                                        <th className="px-3 py-2.5 text-center">Temp Huevo</th>
                                        <th className="px-3 py-2.5 text-center">Estatus</th>
                                        <th className="px-3 py-2.5 text-center">Calidad / Grado</th>
                                        <th className="px-3 py-2.5">Operador</th>
                                        <th className="px-3 py-2.5 text-center w-12">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredMaterials.map(rm => {
                                        let certs = [];
                                        try {
                                            certs = JSON.parse(rm.certificate_urls || '[]');
                                        } catch (e) {
                                            certs = [];
                                        }

                                        return (
                                            <tr key={rm.id} className="hover:bg-slate-50/75 transition-colors">
                                                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                                                        <Calendar size={13} className="text-slate-400" />
                                                        {formatDate(rm.fecha || rm.created_at)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{rm.provider_name}</span>
                                                        <span className="bg-slate-100 border border-slate-200 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit mt-0.5">
                                                            {rm.provider_lot}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col text-xs">
                                                        {rm.truck_plate ? (
                                                            <span className="text-slate-800 font-bold flex items-center gap-1">
                                                                <Truck size={13} className="text-indigo-600" />
                                                                {rm.truck_plate}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">Sin transporte</span>
                                                        )}
                                                        {rm.truck_temperature_c && (
                                                            <span className="text-slate-500 text-[10px]">Termoking: {rm.truck_temperature_c}°C</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 capitalize">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-900 text-xs font-bold">{rm.egg_type}</span>
                                                        {rm.egg_type === 'huevo cáscara' && (
                                                            <span className="text-[10px] text-slate-500">Color: {rm.egg_color} | Talla: {rm.egg_size}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-800 text-xs">
                                                    {rm.total_boxes ? `${rm.total_boxes} cjs` : '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-black text-slate-900 text-xs">
                                                    {parseFloat(rm.weight_lbs).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-xs">
                                                    <span className={parseFloat(rm.stock_lbs || 0) <= 0 ? 'text-rose-600' : parseFloat(rm.stock_lbs) < 1000 ? 'text-amber-600' : 'text-emerald-700'}>
                                                        {parseFloat(rm.stock_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {rm.temperature_c !== null && rm.temperature_c !== undefined && rm.temperature_c !== '' ? (
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                            parseFloat(rm.temperature_c) > 6.0 
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {rm.temperature_c}°C
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-medium text-[10px] italic">
                                                            N/R
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight">
                                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${getStatusBadge(rm.status)}`}>
                                                            {getStatusIcon(rm.status)}
                                                            {rm.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {rm.quality_inspector_name ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenQualityModal(rm)}
                                                            className="inline-flex flex-col items-center p-1 hover:bg-amber-50/70 rounded-lg transition-colors group cursor-pointer"
                                                            title="Dictamen de calidad registrado. Haz clic para ver o editar."
                                                        >
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getQualityBadgeClass(rm.quality_status, rm.egg_classification)}`}>
                                                                <ShieldCheck size={11} className="shrink-0" />
                                                                <span>
                                                                    {rm.quality_status === 'rechazado' || (rm.egg_classification || '').toLowerCase().includes('no conforme')
                                                                        ? 'NO CONFORME'
                                                                        : (rm.egg_classification || 'Grado A')}
                                                                </span>
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 group-hover:text-amber-700 font-semibold mt-0.5 truncate max-w-[85px]">
                                                                {rm.quality_inspector_name}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenQualityModal(rm)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shadow-2xs"
                                                            title="Pendiente de evaluación de calidad por personal técnico. Haz clic para evaluar."
                                                        >
                                                            <ShieldCheck size={11} className="text-amber-600 shrink-0" />
                                                            <span>Pendiente Calidad</span>
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-600 flex items-center gap-1 text-[10px]">
                                                            <User size={11} className="text-slate-400" />
                                                            {rm.operator_name}
                                                        </span>
                                                        {certs.length > 0 && (
                                                            <div className="flex gap-1 mt-0.5">
                                                                {certs.map((url, idx) => (
                                                                    <a 
                                                                        key={idx} 
                                                                        href={url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="text-indigo-600 hover:text-indigo-800 text-[10px] underline font-bold flex items-center gap-0.5"
                                                                    >
                                                                        <FileText size={10} />
                                                                        Cert #{idx + 1}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {/* 1. Ver Detalle y Tarimas */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingReception(rm)}
                                                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                            title="Ver Detalle y Tarimas"
                                                        >
                                                            <Eye size={13} />
                                                        </button>

                                                        {/* 2. Menú Desplegable de Impresión */}
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => setOpenPrintMenuId(openPrintMenuId === rm.id ? null : rm.id)}
                                                                disabled={printingPdfId === rm.id}
                                                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border transition-all shadow-xs ${
                                                                    openPrintMenuId === rm.id
                                                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/20'
                                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                                } disabled:opacity-50`}
                                                                title="Formatos de Impresión (LOG-004, LAB-001, Tarimas)"
                                                            >
                                                                {printingPdfId === rm.id ? (
                                                                    <Loader2 className="animate-spin" size={12} />
                                                                ) : (
                                                                    <Printer size={12} className={openPrintMenuId === rm.id ? 'text-white' : 'text-slate-500'} />
                                                                )}
                                                                <span>Imprimir</span>
                                                                <ChevronDown size={10} className={`transition-transform duration-150 ${openPrintMenuId === rm.id ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {openPrintMenuId === rm.id && (
                                                                <>
                                                                    {/* Overlay transparente para cerrar al hacer clic afuera */}
                                                                    <div 
                                                                        className="fixed inset-0 z-30" 
                                                                        onClick={() => setOpenPrintMenuId(null)} 
                                                                    />

                                                                    {/* Menú Desplegable */}
                                                                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-40 text-left divide-y divide-slate-100 animate-in fade-in-50 zoom-in-95">
                                                                        <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                                            Formatos Oficiales
                                                                        </div>
                                                                        <div className="py-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handlePrintReceptionSummary(rm);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FileText size={15} className="text-emerald-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Resumen Recepción (LOG-004)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Boleta de ingreso y báscula en PDF</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handlePrintLab001(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FlaskConical size={15} className="text-amber-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Dictamen de Calidad (LAB-001)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Reporte técnico oficial en PDF</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handleDownloadLab001Docx(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FileText size={15} className="text-indigo-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Dictamen Word (LAB-001)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Descargar documento editable (.docx)</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handlePrintOriginCert(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left border-t border-slate-100"
                                                                            >
                                                                                <ShieldCheck size={15} className="text-teal-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Certificado Calidad Origen (PDF)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Formato oficial proveedor / ANDELSA</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handleDownloadOriginCertDocx(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FileText size={15} className="text-teal-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Certificado Origen Word (.docx)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Descargar formato editable oficial</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    let parsedTarimas = [];
                                                                                    try {
                                                                                        parsedTarimas = typeof rm.tarimas_json === 'string'
                                                                                            ? JSON.parse(rm.tarimas_json || '[]')
                                                                                            : (rm.tarimas_json || []);
                                                                                    } catch (e) {
                                                                                        parsedTarimas = [];
                                                                                    }
                                                                                    if (!Array.isArray(parsedTarimas) || parsedTarimas.length === 0) {
                                                                                        parsedTarimas = [{
                                                                                            tarima_number: 1,
                                                                                            boxes_count: rm.total_boxes || 0,
                                                                                            gross_weight_lbs: rm.weight_lbs || 0,
                                                                                            tare_weight_lbs: 0,
                                                                                            net_weight_lbs: rm.weight_lbs || 0
                                                                                        }];
                                                                                    }
                                                                                    const recData = {
                                                                                        reception_id: rm.id,
                                                                                        provider_name: rm.provider_name,
                                                                                        provider_lot: rm.provider_lot,
                                                                                        fecha: rm.fecha || rm.created_at,
                                                                                        egg_type: rm.egg_type,
                                                                                        egg_color: rm.egg_color,
                                                                                        egg_size: rm.egg_size,
                                                                                        temperature_c: rm.temperature_c,
                                                                                        truck_temperature_c: rm.truck_temperature_c,
                                                                                        truck_plate: rm.truck_plate,
                                                                                        driver_name: rm.driver_name,
                                                                                        operator_name: rm.operator_name,
                                                                                        company_name: user?.company_name || 'ANDELSA, S.A. DE C.V.'
                                                                                    };
                                                                                    handleOpenPrintTarima(parsedTarimas[0], parsedTarimas, recData);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <Boxes size={15} className="text-sky-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Etiquetas de Tarimas (QR)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Fichas de identificación para estibas</span>
                                                                                </div>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* 3. Editar Recepción */}
                                                        {rm.status !== 'anulado' && (
                                                            <button
                                                                onClick={() => handleEdit(rm)}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shadow-xs"
                                                                title="Editar Recepción"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                        )}

                                                        {/* 4. Anular */}
                                                        {rm.status !== 'anulado' && parseFloat(rm.stock_lbs || 0) >= parseFloat(rm.weight_lbs || 0) && (
                                                            <button
                                                                onClick={() => setVoidConfirmId(rm.id)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                                title="Anular Recepción"
                                                            >
                                                                <Ban size={13} />
                                                            </button>
                                                        )}

                                                        {/* 5. Eliminar */}
                                                        {canDeleteReception && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteConfirmRm(rm)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                                title="Eliminar Recepción Permanentemente"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}

                                                        {rm.status === 'anulado' && (
                                                            <span className="text-[10px] text-slate-400 font-semibold italic">Anulado</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            {/* Modal de Detalle de Recepción e Impresión Individual de Tarimas */}
            {viewingReception && (() => {
                let parsedTarimas = [];
                try {
                    parsedTarimas = typeof viewingReception.tarimas_json === 'string'
                        ? JSON.parse(viewingReception.tarimas_json || '[]')
                        : (viewingReception.tarimas_json || []);
                } catch (e) {
                    parsedTarimas = [];
                }
                if (!Array.isArray(parsedTarimas) || parsedTarimas.length === 0) {
                    parsedTarimas = [{
                        tarima_number: 1,
                        boxes_count: viewingReception.total_boxes || 0,
                        gross_weight_lbs: viewingReception.weight_lbs || 0,
                        tare_weight_lbs: 0,
                        net_weight_lbs: viewingReception.weight_lbs || 0
                    }];
                }
                const recData = {
                    reception_id: viewingReception.id,
                    provider_name: viewingReception.provider_name,
                    provider_lot: viewingReception.provider_lot,
                    fecha: viewingReception.fecha || viewingReception.created_at,
                    egg_type: viewingReception.egg_type,
                    egg_color: viewingReception.egg_color,
                    egg_size: viewingReception.egg_size,
                    temperature_c: viewingReception.temperature_c,
                    truck_temperature_c: viewingReception.truck_temperature_c,
                    truck_plate: viewingReception.truck_plate,
                    driver_name: viewingReception.driver_name,
                    operator_name: viewingReception.operator_name,
                    company_name: user?.company_name || 'ANDELSA, S.A. DE C.V.'
                };

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-5 text-slate-900">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                                        <Boxes className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                                Recepción #{viewingReception.id} - Lote: {viewingReception.provider_lot}
                                            </h2>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 ${getStatusBadge(viewingReception.status)}`}>
                                                {getStatusIcon(viewingReception.status)}
                                                {viewingReception.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            Proveedor: <strong className="text-slate-700">{viewingReception.provider_name}</strong> | Fecha: {formatDate(viewingReception.fecha || viewingReception.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setViewingReception(null)}
                                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>

                            {/* Cards de Resumen */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1">
                                        <Boxes size={12} /> Datos de Producto
                                    </span>
                                    <div className="text-slate-700 space-y-0.5 pt-1">
                                        <p><span className="text-slate-400 font-medium">Tipo:</span> <strong className="capitalize">{viewingReception.egg_type}</strong></p>
                                        {viewingReception.egg_type === 'huevo cáscara' && (
                                            <p><span className="text-slate-400 font-medium">Color / Talla:</span> <strong>{viewingReception.egg_color} / {viewingReception.egg_size}</strong></p>
                                        )}
                                        <p><span className="text-slate-400 font-medium">Temp. Huevo:</span> <strong>{viewingReception.temperature_c ? `${viewingReception.temperature_c}°C` : 'N/R'}</strong></p>
                                        <p><span className="text-slate-400 font-medium">Inspector:</span> <strong>{viewingReception.operator_name || 'N/A'}</strong></p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                                    <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wide flex items-center gap-1">
                                        <Truck size={12} /> Transporte & Cadena de Frío
                                    </span>
                                    <div className="text-slate-700 space-y-0.5 pt-1">
                                        <p><span className="text-slate-400 font-medium">Placa:</span> <strong>{viewingReception.truck_plate || 'Sin transporte'}</strong></p>
                                        <p><span className="text-slate-400 font-medium">Motorista:</span> <strong>{viewingReception.driver_name || 'N/A'}</strong></p>
                                        <p><span className="text-slate-400 font-medium">Termoking:</span> <strong>{viewingReception.truck_temperature_c ? `${viewingReception.truck_temperature_c}°C` : 'N/R'}</strong></p>
                                        <p><span className="text-slate-400 font-medium">Ingreso:</span> <strong>{formatDate(viewingReception.fecha || viewingReception.created_at)}</strong></p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                                        <FileText size={12} /> Balance de Peso & Stock
                                    </span>
                                    <div className="text-slate-700 space-y-0.5 pt-1">
                                        <p><span className="text-slate-400 font-medium">Total Cajas:</span> <strong className="text-indigo-700">{viewingReception.total_boxes || 0} cjs</strong></p>
                                        <p><span className="text-slate-400 font-medium">Peso Neto Inicial:</span> <strong className="text-slate-900">{parseFloat(viewingReception.weight_lbs || 0).toLocaleString()} Lbs</strong></p>
                                        <p><span className="text-slate-400 font-medium">Stock Remanente:</span> <strong className="text-emerald-700">{parseFloat(viewingReception.stock_lbs || 0).toLocaleString()} Lbs</strong></p>
                                        <p><span className="text-slate-400 font-medium">Tarimas Pesadas:</span> <strong>{parsedTarimas.length}</strong></p>
                                    </div>
                                </div>
                            </div>

                            {/* Card de Calidad y Clasificación (LAB-004) */}
                            <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-amber-50/80 border border-amber-200/90 rounded-xl p-4 space-y-3 shadow-2xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-2xs">
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                                                Dictamen Técnico y Clasificación de Calidad (LAB-004)
                                            </h4>
                                            <p className="text-[11px] text-amber-800/80 font-medium">
                                                Evaluación realizada por el personal técnico de Control de Calidad
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-start sm:self-auto">
                                        <button
                                            type="button"
                                            disabled={printingPdfId === viewingReception.id}
                                            onClick={() => handlePrintLab001(viewingReception.id, viewingReception.provider_lot)}
                                            className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                            title="Imprimir Formato Oficial LAB 001 (Rev. 7.03.24)"
                                        >
                                            {printingPdfId === viewingReception.id ? <Loader2 className="animate-spin" size={13} /> : <Printer size={13} />}
                                            <span>Imprimir LAB 001</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenQualityModal(viewingReception)}
                                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                                        >
                                            <ShieldCheck size={13} />
                                            <span>{viewingReception.quality_inspector_name ? 'Editar Dictamen LAB 001' : 'Evaluar Calidad (LAB 001)'}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Inspector Calidad:</span>
                                        <strong className="text-slate-900">{viewingReception.quality_inspector_name || 'Pendiente de asignar'}</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Clasificación / Grado:</span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-indigo-700 bg-white border border-indigo-200 text-xs shadow-2xs mt-0.5">
                                            <Award size={12} className="text-indigo-600" />
                                            {viewingReception.egg_classification || 'Grado A'} ({viewingReception.egg_size || 'L'})
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Estado Dictamen:</span>
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight mt-0.5 ${
                                            viewingReception.quality_status === 'aprobado'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : viewingReception.quality_status === 'rechazado'
                                                ? 'bg-rose-100 text-rose-800'
                                                : viewingReception.quality_status === 'condicional'
                                                ? 'bg-sky-100 text-sky-800'
                                                : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {viewingReception.quality_status || 'Pendiente'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Muestreo Defectos:</span>
                                        <div className="text-slate-700 font-semibold text-[11px] mt-0.5">
                                            <span>Rotos: <strong className="text-rose-700">{viewingReception.quality_defect_broken_pct || 0}%</strong></span>
                                            <span className="mx-1.5">•</span>
                                            <span>Sucios: <strong className="text-amber-700">{viewingReception.quality_defect_dirty_pct || 0}%</strong></span>
                                            {viewingReception.quality_brix && (
                                                <>
                                                    <span className="mx-1.5">•</span>
                                                    <span>Brix: <strong className="text-indigo-700">{viewingReception.quality_brix}°Bx</strong></span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {viewingReception.quality_notes && (
                                    <div className="text-xs bg-white/90 p-2.5 rounded-xl border border-amber-200 text-slate-800">
                                        <span className="font-bold text-amber-900 block text-[10px] uppercase tracking-wide">Observaciones Técnicas:</span>
                                        <p className="mt-0.5 text-slate-700 font-medium">{viewingReception.quality_notes}</p>
                                    </div>
                                )}
                            </div>

                            {/* Tabla de Tarimas */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Boxes size={14} className="text-indigo-600" />
                                        Tarimas Registradas en Báscula ({parsedTarimas.length})
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenPrintTarima(parsedTarimas[0], parsedTarimas, recData)}
                                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold border border-sky-200 transition-colors flex items-center gap-1.5 shadow-xs"
                                    >
                                        <Printer size={13} />
                                        Imprimir Todas las Tarimas
                                    </button>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                                            <tr>
                                                <th className="p-2.5 text-center w-12">#</th>
                                                <th className="p-2.5">Código QR / Identificador</th>
                                                <th className="p-2.5 text-right">Cajas</th>
                                                <th className="p-2.5 text-right">Peso Bruto</th>
                                                <th className="p-2.5 text-right">Tara</th>
                                                <th className="p-2.5 text-right">Peso Neto</th>
                                                <th className="p-2.5 text-center w-36">Impresión</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {parsedTarimas.map((t, idx) => {
                                                const tNum = t.tarima_number || (idx + 1);
                                                const code = `TAR-${(viewingReception.provider_lot || 'LOT').toUpperCase()}-${String(tNum).padStart(2, '0')}`;
                                                return (
                                                    <tr key={t.id || idx} className="hover:bg-slate-50">
                                                        <td className="p-2.5 text-center font-bold text-slate-500">{tNum}</td>
                                                        <td className="p-2.5">
                                                            <span className="font-mono text-xs font-bold bg-slate-100 text-indigo-700 px-2 py-0.5 rounded border border-slate-200">
                                                                {code}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 text-right font-bold text-slate-700">{t.boxes_count || 0} cjs</td>
                                                        <td className="p-2.5 text-right text-slate-600">{parseFloat(t.gross_weight_lbs || 0).toLocaleString()} lb</td>
                                                        <td className="p-2.5 text-right text-slate-400">{parseFloat(t.tare_weight_lbs || 0).toLocaleString()} lb</td>
                                                        <td className="p-2.5 text-right font-black text-emerald-700">
                                                            {parseFloat(t.net_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lb
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenPrintTarima(t, parsedTarimas, recData)}
                                                                className="px-2.5 py-1 bg-white hover:bg-sky-50 text-sky-700 rounded-lg border border-slate-200 hover:border-sky-300 text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition-colors shadow-xs"
                                                            >
                                                                <Printer size={12} />
                                                                Imprimir Tarima #{tNum}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => handlePrintReceptionSummary(viewingReception)}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 flex items-center justify-center gap-2 transition-colors shadow-xs"
                                >
                                    <Download size={15} />
                                    Imprimir Resumen de Recepción (PDF LOG-004)
                                </button>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setViewingReception(null)}
                                        className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-xs"
                                    >
                                        Cerrar
                                    </button>
                                    {viewingReception.status !== 'anulado' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const rec = viewingReception;
                                                setViewingReception(null);
                                                handleEdit(rec);
                                            }}
                                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                                        >
                                            <Pencil size={14} />
                                            Editar Recepción Completa
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {voidConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 text-slate-900">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-rose-600">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Confirmar Anulación</h3>
                        </div>
                        <p className="text-xs text-slate-600 mb-6 leading-relaxed">¿Está seguro de anular esta recepción de materia prima? Esta acción restará el inventario ingresado y no se puede deshacer.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setVoidConfirmId(null)} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs">Cancelar</button>
                            <button onClick={() => handleVoid(voidConfirmId)} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">Anular</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Evaluación y Reporte de Calidad Oficial (LAB 001, Rev. 7.03.24) */}
            {qualityModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full mx-auto max-h-[92vh] flex flex-col text-slate-900 overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-black text-slate-900 tracking-tight">
                                            Laboratorio de Control de Calidad • Reporte de Materia Prima
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                            LAB 001 • Rev. 7.03.24
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Complemento técnico oficial de recepción, muestreo y dictamen de lote
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handlePrintOriginCertFromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Imprimir Certificado de Calidad de Origen (Proveedor a ANDELSA) en PDF"
                                >
                                    {printingPdfId === qualityModal.rm?.id ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} className="text-teal-700" />}
                                    <span className="hidden sm:inline">Cert. Origen (PDF)</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handleDownloadOriginCertDocxFromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Descargar Certificado de Calidad de Origen en formato Word (.docx)"
                                >
                                    <FileText size={14} className="text-teal-600" />
                                    <span className="hidden sm:inline">Origen (Word)</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handlePrintLab001FromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Imprimir formato físico oficial LAB 001 en PDF"
                                >
                                    {printingPdfId === qualityModal.rm?.id ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} className="text-amber-700" />}
                                    <span className="hidden sm:inline">{printingPdfId === qualityModal.rm?.id ? 'Generando...' : 'LAB 001'}</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handleDownloadLab001DocxFromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Descargar dictamen técnico oficial en formato Word editable (.docx)"
                                >
                                    <FileText size={14} className="text-indigo-600" />
                                    <span className="hidden sm:inline">Word (.docx)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQualityModal(prev => ({ ...prev, isOpen: false }))}
                                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Resumen del Lote en Cabecera */}
                        {qualityModal.rm && (
                            <div className="bg-amber-50/60 border-b border-amber-200/70 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Lote:</span>
                                        <strong className="text-slate-900 font-black">{qualityModal.provider_lot || qualityModal.rm.provider_lot}</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Proveedor:</span>
                                        <strong className="text-slate-800">{qualityModal.rm.provider_name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Cajas / Peso:</span>
                                        <strong className="text-slate-800">{qualityModal.total_boxes || qualityModal.rm.total_boxes || 0} cjs (~{parseFloat(qualityModal.rm.weight_lbs || 0).toLocaleString()} Lbs)</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Ingreso:</span>
                                        <strong className="text-slate-800">{formatDate(qualityModal.plant_entry_date)}</strong>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-amber-900/70 uppercase">Clasificación:</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getQualityBadgeClass(qualityModal.quality_status, qualityModal.egg_classification)}`}>
                                        {qualityModal.egg_classification || 'Grado A'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Pestañas de Navegación del Formulario LAB 001 y Certificado de Origen */}
                        <div className="flex items-center border-b border-slate-200 px-5 bg-white overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'general' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'general'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <ClipboardList size={14} />
                                <span>1. Datos Generales & Clasificación</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'physico' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'physico'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <FlaskConical size={14} />
                                <span>2. Análisis Fisicoquímicos (13 Parámetros)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'organo' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'organo'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <Truck size={14} />
                                <span>3. Organolépticos & Transporte</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'review' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'review'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <Award size={14} />
                                <span>4. Dictamen Oficial & Firmas</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'origin_cert' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'origin_cert'
                                        ? 'border-teal-600 text-teal-800 bg-teal-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <ShieldCheck size={14} className="text-teal-600" />
                                <span>5. Certificado de Calidad de Origen</span>
                            </button>
                        </div>

                        {/* Modal Body / Form */}
                        <form onSubmit={handleSaveQualityClassification} className="flex-1 overflow-y-auto p-5 space-y-4">
                            {!canEditQuality && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
                                    <Lock size={16} className="shrink-0 text-amber-600" />
                                    <span><b>Modo Solo Lectura:</b> Su rol no posee permisos para editar el dictamen de calidad (LAB 001).</span>
                                </div>
                            )}

                            {/* TAB 1: DATOS GENERALES */}
                            {qualityModal.activeTab === 'general' && (
                                <div className="space-y-4">
                                    {/* Clasificación Destacada (Formato LAB 001) */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                        <div>
                                            <label className="text-xs font-black text-slate-900 uppercase tracking-wide block">
                                                CLASIFICACION HUEVO SEGÚN ANALISIS *
                                            </label>
                                            <span className="text-[11px] text-slate-500">
                                                Dictamen técnico de recepción plasmado en el recuadro superior oficial de LAB 001
                                            </span>
                                        </div>
                                        <div className="w-full sm:w-64">
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.egg_classification}
                                                onChange={(e) => setQualityModal({ ...qualityModal, egg_classification: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                                            >
                                                <option value="Grado AA">Grado AA (Extra Especial / Cáscara Impecable)</option>
                                                <option value="Grado A">Grado A (Estándar Premium de Planta)</option>
                                                <option value="Grado B">Grado B (Comercial / Cáscara Irregular)</option>
                                                <option value="Grado Industrial">Grado Industrial (Quiebre Inmediato)</option>
                                                <option value="No Conforme">No Conforme / Rechazado</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                        {/* Tipo de Proveedor (Local / Extranjero) */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Origen del Proveedor
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={!canEditQuality}
                                                    onClick={() => setQualityModal({ ...qualityModal, provider_type: 'LOCAL' })}
                                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                        qualityModal.provider_type === 'LOCAL'
                                                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    Local
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!canEditQuality}
                                                    onClick={() => setQualityModal({ ...qualityModal, provider_type: 'EXTRANJERO' })}
                                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                        qualityModal.provider_type === 'EXTRANJERO'
                                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    Extranjero
                                                </button>
                                            </div>
                                        </div>

                                        {/* Granja */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Granja de Procedencia
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canEditQuality}
                                                placeholder="Ej: Granja El Progreso, Galpón 4"
                                                value={qualityModal.farm_name}
                                                onChange={(e) => setQualityModal({ ...qualityModal, farm_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Lote */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Lote de Recepción
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canEditQuality}
                                                placeholder="Lote proveedor"
                                                value={qualityModal.provider_lot}
                                                onChange={(e) => setQualityModal({ ...qualityModal, provider_lot: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Nota de Remisión */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Nota de Remisión / Guía
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canEditQuality}
                                                placeholder="Ej: NR-8921"
                                                value={qualityModal.remission_note}
                                                onChange={(e) => setQualityModal({ ...qualityModal, remission_note: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Número de Cajas */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Número de Cajas
                                            </label>
                                            <input
                                                type="number"
                                                disabled={!canEditQuality}
                                                placeholder="Total cajas recibidas"
                                                value={qualityModal.total_boxes}
                                                onChange={(e) => setQualityModal({ ...qualityModal, total_boxes: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Peso en Gramos Unitario Muestreado */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Peso Unitario en Gramos (Muestreo)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: 62.5"
                                                    value={qualityModal.sample_egg_weight_g}
                                                    onChange={(e) => setQualityModal({ ...qualityModal, sample_egg_weight_g: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">g/huevo</span>
                                            </div>
                                        </div>

                                        {/* Color Cascarón */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Color Cascarón
                                            </label>
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.egg_color}
                                                onChange={(e) => setQualityModal({ ...qualityModal, egg_color: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                <option value="blanco">Blanco</option>
                                                <option value="marrón">Marrón / Rojo</option>
                                                <option value="mixto">Mixto</option>
                                            </select>
                                        </div>

                                        {/* Tamaño de Huevo */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Tamaño de Huevo
                                            </label>
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.egg_size}
                                                onChange={(e) => setQualityModal({ ...qualityModal, egg_size: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                <option value="XL">XL (Super Grande / &gt;73g)</option>
                                                <option value="L">L (Grande / 63g - 73g)</option>
                                                <option value="M">M (Mediano / 53g - 63g)</option>
                                                <option value="S">S (Pequeño / &lt;53g)</option>
                                                <option value="Jumbo">Jumbo (&gt;78g)</option>
                                            </select>
                                        </div>

                                        {/* Fecha Producción */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Producción / Postura
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.production_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, production_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Vencimiento */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Vencimiento
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.expiration_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, expiration_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Ingreso a Planta */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Ingreso a Planta
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.plant_entry_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, plant_entry_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Recepción */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Recepción
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.reception_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, reception_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Análisis */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Análisis Laboratorio
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.analysis_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, analysis_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Hora Análisis */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Hora del Análisis
                                            </label>
                                            <input
                                                type="time"
                                                disabled={!canEditQuality}
                                                value={qualityModal.analysis_time}
                                                onChange={(e) => setQualityModal({ ...qualityModal, analysis_time: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: ANALISIS FISICOQUIMICOS */}
                            {qualityModal.activeTab === 'physico' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                                Parámetros Fisicoquímicos (Formato Oficial LAB 001)
                                            </h3>
                                            <p className="text-[11px] text-slate-500">
                                                Registre las lecturas analíticas por muestra o lote de granja conforme a la hoja de laboratorio.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                                                <tr>
                                                    <th className="px-4 py-2.5 w-1/2">Parámetro</th>
                                                    <th className="px-4 py-2.5 w-1/4 text-center">Lectura / Muestra 1</th>
                                                    <th className="px-4 py-2.5 w-1/4 text-center">Lectura / Muestra 2</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                                {[
                                                    { key: 'granja', label: 'GRANJA', placeholder: 'Identificador / Galpón' },
                                                    { key: 'espesor_celda_aire', label: 'ESPESOR CELDA DE AIRE', placeholder: 'Ej: 3 mm' },
                                                    { key: 'ph_huevo_fresco', label: 'PH HUEVO FRESCO', placeholder: 'Ej: 7.6 - 8.2' },
                                                    { key: 'solidos_huevo_fresco', label: 'SOLIDOS HUEVO FRESCO', placeholder: 'Ej: 23.5 - 24.5 %' },
                                                    { key: 'firmeza_albumina', label: 'FIRMEZA DE ALBUMINA', placeholder: 'Unidades Haugh' },
                                                    { key: 'ph_albumina', label: 'PH DE ALBUMINA', placeholder: 'Ej: 8.8 - 9.1' },
                                                    { key: 'solidos_albumina', label: 'SOLIDOS ALBUMINA', placeholder: 'Ej: 11.5 - 12.5 %' },
                                                    { key: 'firmeza_yema', label: 'FIRMEZA YEMA', placeholder: 'Firme / Regular' },
                                                    { key: 'forma_yema', label: 'FORMA YEMA', placeholder: 'Índice / Esférica' },
                                                    { key: 'color_yema', label: 'COLOR YEMA', placeholder: 'Escala Roche (1-15)' },
                                                    { key: 'ph_yema', label: 'PH YEMA', placeholder: 'Ej: 6.0 - 6.3' },
                                                    { key: 'solidos_yema', label: 'SOLIDOS DE YEMA', placeholder: 'Ej: 48 - 50 %' },
                                                    { key: 'estado_separacion', label: 'ESTADO DE SEPARACION', placeholder: 'Conforme / Limpio' }
                                                ].map((param, idx) => (
                                                    <tr key={param.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                        <td className="px-4 py-2 font-bold text-slate-800 text-[11px]">
                                                            {param.label}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                disabled={!canEditQuality}
                                                                placeholder={param.placeholder}
                                                                value={qualityModal.physicochemical[param.key]?.val1 || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setQualityModal(prev => ({
                                                                        ...prev,
                                                                        physicochemical: {
                                                                            ...prev.physicochemical,
                                                                            [param.key]: {
                                                                                ...(prev.physicochemical[param.key] || {}),
                                                                                val1: val
                                                                            }
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                disabled={!canEditQuality}
                                                                placeholder={param.placeholder}
                                                                value={qualityModal.physicochemical[param.key]?.val2 || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setQualityModal(prev => ({
                                                                        ...prev,
                                                                        physicochemical: {
                                                                            ...prev.physicochemical,
                                                                            [param.key]: {
                                                                                ...(prev.physicochemical[param.key] || {}),
                                                                                val2: val
                                                                            }
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: ORGANOLEPTICOS & TRANSPORTE */}
                            {qualityModal.activeTab === 'organo' && (
                                <div className="space-y-4">
                                    {/* Olores Organolépticos */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                            Análisis Organolépticos • Evaluación de Olor
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {[
                                                { key: 'olor_normal', label: 'OLOR CARACTERISTICO A HUEVO NORMAL', desc: 'Conforme, sin notas extrañas' },
                                                { key: 'olor_fuerte', label: 'OLOR CARACTERISTICO A HUEVO FUERTE', desc: 'Alerta por intensidad o edad del huevo' },
                                                { key: 'olor_descomposicion_prematura', label: 'OLOR EN DESCOMPOSICION PREMATURA', desc: 'No conforme, riesgo biológico' },
                                                { key: 'olor_descomposicion_avanzada', label: 'OLOR EN DESCOMPOSICION AVANZADA', desc: 'Rechazo inmediato de lote' }
                                            ].map((item) => (
                                                <label
                                                    key={item.key}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                        qualityModal.organoleptic[item.key]
                                                            ? item.key.includes('descomposicion')
                                                                ? 'bg-rose-50 border-rose-300 text-rose-900'
                                                                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        disabled={!canEditQuality}
                                                        checked={!!qualityModal.organoleptic[item.key]}
                                                        onChange={(e) => {
                                                            const chk = e.target.checked;
                                                            setQualityModal(prev => ({
                                                                ...prev,
                                                                organoleptic: {
                                                                    ...prev.organoleptic,
                                                                    [item.key]: chk
                                                                }
                                                            }));
                                                        }}
                                                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold block">{item.label}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">{item.desc}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Consistencia de Cascarón */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wide block">
                                            CONSISTENCIA CASCARON
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { val: 'resistente', label: 'RESISTENTE', color: 'emerald' },
                                                { val: 'poco_resistente', label: 'POCO RESISTENTE', color: 'amber' },
                                                { val: 'fragil', label: 'FRAGIL', color: 'rose' }
                                            ].map((c) => {
                                                const isSel = (qualityModal.organoleptic.consistencia_cascaron || 'resistente') === c.val;
                                                return (
                                                    <button
                                                        key={c.val}
                                                        type="button"
                                                        disabled={!canEditQuality}
                                                        onClick={() => setQualityModal(prev => ({
                                                            ...prev,
                                                            organoleptic: { ...prev.organoleptic, consistencia_cascaron: c.val }
                                                        }))}
                                                        className={`py-2 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                                            isSel
                                                                ? c.color === 'emerald'
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                                                    : c.color === 'amber'
                                                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                                                    : 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {isSel && <Check size={14} />}
                                                        <span>{c.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Transporte y Almacenaje */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                            Transporte y Almacenaje
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                    Limpieza / Orden Camión
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: CONFORME / LIMPIO"
                                                    value={qualityModal.transport_storage?.limpieza_camion || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQualityModal(prev => ({
                                                            ...prev,
                                                            transport_storage: { ...prev.transport_storage, limpieza_camion: val }
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                    Apariencia de Cajas a su Ingreso
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: BUEN ESTADO / LIMPIAS"
                                                    value={qualityModal.transport_storage?.apariencia_cajas || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQualityModal(prev => ({
                                                            ...prev,
                                                            transport_storage: { ...prev.transport_storage, apariencia_cajas: val }
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                    T° Transporte
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: 18.5 °C"
                                                    value={qualityModal.transport_storage?.temperatura_transporte || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQualityModal(prev => ({
                                                            ...prev,
                                                            transport_storage: { ...prev.transport_storage, temperatura_transporte: val }
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: DICTAMEN OFICIAL & FIRMAS */}
                            {qualityModal.activeTab === 'review' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {/* Dictamen Oficial del Lote */}
                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Dictamen Oficial del Lote *
                                            </label>
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.quality_status}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_status: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                <option value="aprobado">✅ Aprobado para Producción y Quebrado</option>
                                                <option value="condicional">⚠️ Aprobado Condicional (Uso Restringido o Mezcla)</option>
                                                <option value="cuarentena">⏳ Cuarentena / En Espera de Laboratorio</option>
                                                <option value="rechazado">❌ No Conforme / Rechazado para Producción</option>
                                            </select>
                                        </div>

                                        {/* Muestreo de Defectos Físicos */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                % Huevo Roto / Fisurado
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    disabled={!canEditQuality}
                                                    placeholder="0.00"
                                                    value={qualityModal.quality_defect_broken_pct}
                                                    onChange={(e) => setQualityModal({ ...qualityModal, quality_defect_broken_pct: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                % Huevo Sucio / Manchado
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    disabled={!canEditQuality}
                                                    placeholder="0.00"
                                                    value={qualityModal.quality_defect_dirty_pct}
                                                    onChange={(e) => setQualityModal({ ...qualityModal, quality_defect_dirty_pct: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                °Brix / Sólidos Totales (Opcional)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                disabled={!canEditQuality}
                                                placeholder="Opcional. Ej: 23.5"
                                                value={qualityModal.quality_brix}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_brix: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Observaciones Técnicas */}
                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                OBSERVACIONES :
                                            </label>
                                            <textarea
                                                rows={3}
                                                disabled={!canEditQuality}
                                                placeholder="Detalle aquí cualquier observación sobre el lote, cámara de aire, olor, aspecto de cáscara o acuerdos con proveedor..."
                                                value={qualityModal.quality_notes}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_notes: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Firmas: Realizado y Revisado */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                REALIZADO : (Inspector de Calidad) *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                disabled={!canEditQuality}
                                                placeholder="Nombre del técnico analista"
                                                value={qualityModal.inspector_name}
                                                onChange={(e) => setQualityModal({ ...qualityModal, inspector_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                REVISADO : (Supervisor / Jefe de Calidad) *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                disabled={!canEditQuality}
                                                placeholder="Nombre del supervisor que valida"
                                                value={qualityModal.quality_reviewed_by}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_reviewed_by: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: CERTIFICADO DE CALIDAD DE ORIGEN (FORMATO OFICIAL PROVEEDOR - ANDELSA) */}
                            {qualityModal.activeTab === 'origin_cert' && (
                                <div className="space-y-4">
                                    {/* Cabecera del Certificado de Origen */}
                                    <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/80 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1.5 bg-teal-600 text-white rounded-xl shadow-2xs">
                                                        <ShieldCheck size={16} />
                                                    </span>
                                                    <h3 className="text-xs font-black uppercase tracking-wider text-teal-950">
                                                        Certificado de Calidad de Origen • Cadena de Custodia
                                                    </h3>
                                                </div>
                                                <p className="text-[11px] text-teal-800 font-medium mt-0.5">
                                                    Documento legal emitido por el proveedor para <b>ANDELSA</b> acreditando inocuidad, transporte y razas de aves
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={printingPdfId === qualityModal.rm?.id}
                                                    onClick={handlePrintOriginCertFromModal}
                                                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <Printer size={13} />
                                                    <span>PDF</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={printingPdfId === qualityModal.rm?.id}
                                                    onClick={handleDownloadOriginCertDocxFromModal}
                                                    className="px-3 py-1.5 bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <FileText size={13} className="text-teal-700" />
                                                    <span>Word (.docx)</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Recuadro Lote ANDELSA vs Lote Proveedor */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                            <div className="bg-white border border-teal-200 rounded-xl p-3 space-y-1">
                                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-tight block">
                                                    EMISOR (PROVEEDOR) :
                                                </span>
                                                <strong className="text-xs text-slate-900 font-bold block truncate">
                                                    {qualityModal.rm?.provider_name || 'INVERSIONES AVÍCOLAS DE HONDURAS, S.A.'}
                                                </strong>
                                                <span className="text-[10px] text-slate-500 font-medium block">
                                                    Lote Proveedor: <b>{qualityModal.provider_lot || '---'}</b>
                                                </span>
                                            </div>

                                            <div className="bg-amber-50/90 border-2 border-amber-400 rounded-xl p-3 space-y-1 shadow-2xs">
                                                <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight block">
                                                    LOTE (SE LO COLOCAMOS EN ANDELSA) :
                                                </span>
                                                <strong className="text-sm font-black text-slate-900 font-mono block">
                                                    {qualityModal.rm?.andelsa_lot || qualityModal.rm?.lot_code || `REC-${qualityModal.rm?.id}`}
                                                </strong>
                                                <span className="text-[10px] text-amber-800 font-medium block">
                                                    Destinatario: <b>ANDELSA</b>
                                                </span>
                                            </div>

                                            <div className="bg-white border border-teal-200 rounded-xl p-3 space-y-1">
                                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-tight block">
                                                    FECHAS CLAVE :
                                                </span>
                                                <div className="text-[11px] text-slate-700 space-y-0.5">
                                                    <div>Producción: <b>{qualityModal.production_date || '---'}</b></div>
                                                    <div>Entrega: <b>{qualityModal.reception_date || '---'}</b></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sección: Requerimientos y Conformidades del Transporte y Empaque */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                            <Truck size={14} className="text-teal-600" />
                                            Requerimientos y Conformidades de Inocuidad
                                        </h4>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                                                    Color del Huevo
                                                </label>
                                                <div className="flex items-center gap-4">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                                        <input
                                                            type="radio"
                                                            name="origin_egg_color"
                                                            value="blanco"
                                                            checked={(qualityModal.egg_color || 'blanco').toLowerCase() === 'blanco'}
                                                            onChange={() => setQualityModal({ ...qualityModal, egg_color: 'blanco' })}
                                                            className="text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Blanco (Conforme)</span>
                                                    </label>
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                                        <input
                                                            type="radio"
                                                            name="origin_egg_color"
                                                            value="marron"
                                                            checked={(qualityModal.egg_color || '').toLowerCase() === 'marron'}
                                                            onChange={() => setQualityModal({ ...qualityModal, egg_color: 'marron' })}
                                                            className="text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Marrón / Rojo</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                                                    Conformidades Físicas (Transporte y Empaque)
                                                </label>
                                                <div className="space-y-2">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={qualityModal.is_camion_cerrado}
                                                            onChange={(e) => setQualityModal({ ...qualityModal, is_camion_cerrado: e.target.checked })}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Camión cerrado</span>
                                                    </label>
                                                    <br />
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={qualityModal.is_limpieza_camion}
                                                            onChange={(e) => setQualityModal({ ...qualityModal, is_limpieza_camion: e.target.checked })}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Limpieza del camión</span>
                                                    </label>
                                                    <br />
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={qualityModal.is_cartones_limpios}
                                                            onChange={(e) => setQualityModal({ ...qualityModal, is_cartones_limpios: e.target.checked })}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Cartones no reciclables y limpios sin plagas ni objetos extraños</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sección: Tabla Dinámica de Razas y Semanas de Edad de las Aves */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                    Lotes de Aves en Origen (Raza y Edad)
                                                </h4>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    Registre las razas y semanas de postura correspondientes a este cargamento
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQualityModal(prev => ({
                                                        ...prev,
                                                        bird_batches: [
                                                            ...(prev.bird_batches || []),
                                                            { breed: 'DEKALB WHITE', age_weeks: '35 SEMANAS DE EDAD' }
                                                        ]
                                                    }));
                                                }}
                                                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                                            >
                                                <Plus size={13} />
                                                <span>+ Agregar Lote de Aves</span>
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="p-2.5 w-12 text-center">#</th>
                                                        <th className="p-2.5">Raza del Ave</th>
                                                        <th className="p-2.5">Edad en Semanas</th>
                                                        <th className="p-2.5 w-12 text-center">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs">
                                                    {(qualityModal.bird_batches || []).map((batch, bIdx) => (
                                                        <tr key={bIdx} className="hover:bg-slate-50/60 transition-colors">
                                                            <td className="p-2.5 text-center font-mono font-bold text-slate-400 text-[11px]">
                                                                {bIdx + 1}
                                                            </td>
                                                            <td className="p-2.5">
                                                                <input
                                                                    type="text"
                                                                    value={batch.breed}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setQualityModal(prev => {
                                                                            const updated = [...(prev.bird_batches || [])];
                                                                            updated[bIdx] = { ...updated[bIdx], breed: val };
                                                                            return { ...prev, bird_batches: updated };
                                                                        });
                                                                    }}
                                                                    placeholder="Ej: DEKALB WHITE, BOVANS BROWN"
                                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-800 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </td>
                                                            <td className="p-2.5">
                                                                <input
                                                                    type="text"
                                                                    value={batch.age_weeks}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setQualityModal(prev => {
                                                                            const updated = [...(prev.bird_batches || [])];
                                                                            updated[bIdx] = { ...updated[bIdx], age_weeks: val };
                                                                            return { ...prev, bird_batches: updated };
                                                                        });
                                                                    }}
                                                                    placeholder="Ej: 69 SEMANAS DE EDAD"
                                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold uppercase text-slate-800 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </td>
                                                            <td className="p-2.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setQualityModal(prev => ({
                                                                            ...prev,
                                                                            bird_batches: (prev.bird_batches || []).filter((_, i) => i !== bIdx)
                                                                        }));
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                                                    title="Eliminar fila"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!qualityModal.bird_batches || qualityModal.bird_batches.length === 0) && (
                                                        <tr>
                                                            <td colSpan={4} className="p-4 text-center text-slate-400 italic text-xs">
                                                                No se han registrado lotes de aves. Haga clic en "+ Agregar Lote de Aves".
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer Controls */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                                    <button
                                        type="button"
                                        disabled={printingPdfId === qualityModal.rm?.id}
                                        onClick={handlePrintOriginCertFromModal}
                                        className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-xl text-xs font-bold border border-teal-300 transition-colors shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        <ShieldCheck size={14} className="text-teal-700" />
                                        <span>Cert. Origen (PDF)</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={printingPdfId === qualityModal.rm?.id}
                                        onClick={handlePrintLab001FromModal}
                                        className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 transition-colors shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {printingPdfId === qualityModal.rm?.id ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} className="text-amber-700" />}
                                        <span>Reporte LAB 001</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setQualityModal(prev => ({ ...prev, isOpen: false }))}
                                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs"
                                    >
                                        {canEditQuality ? 'Cancelar' : 'Cerrar'}
                                    </button>
                                    {canEditQuality && (
                                        <button
                                            type="submit"
                                            disabled={qualityModal.isSubmitting}
                                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <ShieldCheck size={15} />
                                            <span>{qualityModal.isSubmitting ? 'Guardando Reporte...' : 'Guardar Reporte LAB 001'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Confirmar Eliminación Permanente de Recepción */}
            {deleteConfirmRm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 text-slate-900 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600 border-b border-slate-200 pb-3">
                            <div className="p-2.5 bg-rose-100 rounded-xl">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                    Eliminar Recepción de Materia Prima
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">Acción administrativa por nivel de rol</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                            ¿Está seguro de eliminar permanentemente la recepción <b>{deleteConfirmRm.provider_lot || `REC-${deleteConfirmRm.id}`}</b> de <b>{deleteConfirmRm.provider_name}</b>?
                        </p>

                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                            <div className="font-bold">⚠️ Advertencia:</div>
                            <div>• Se eliminarán las tarimas y datos asociados a este ingreso ({parseFloat(deleteConfirmRm.weight_lbs || 0).toLocaleString()} Lbs).</div>
                            <div>• Si ya se utilizó en producciones, el sistema bloqueará la eliminación para proteger la trazabilidad.</div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmRm(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteReception}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Sí, Eliminar Recepción
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Impresión de Fichas de Tarimas */}
            <TarimaLabelModal
                isOpen={printTarimaModal.isOpen}
                onClose={() => setPrintTarimaModal({ isOpen: false, tarima: null, allTarimas: [], receptionData: {} })}
                tarima={printTarimaModal.tarima}
                allTarimas={printTarimaModal.allTarimas}
                receptionData={printTarimaModal.receptionData}
            />

            {/* Modal de Visualización e Impresión de Reporte LAB 001 */}
            <PdfViewerModal
                isOpen={pdfPreviewModal.isOpen}
                onClose={handleClosePdfPreview}
                title={pdfPreviewModal.title}
                subtitle={pdfPreviewModal.subtitle}
                badge="LAB 001 • Rev. 7.03.24"
                pdfUrl={pdfPreviewModal.url}
                fileName={pdfPreviewModal.fileName}
                footerNote="Laboratorio de Control de Calidad • Reporte Oficial de Materia Prima y Dictamen Técnico (LAB 001)"
            />

            {/* Modal de Parametrización de Proveedor y Taras */}
            <ProviderLotConfigModal
                isOpen={lotConfigModalData.isOpen}
                onClose={() => setLotConfigModalData({ isOpen: false, config: null, initialProviderId: '' })}
                configToEdit={lotConfigModalData.config}
                initialProviderId={lotConfigModalData.initialProviderId}
                providers={providers}
                loadProvidersOptions={loadProvidersOptions}
                onSaved={handleLotConfigSaved}
            />
        </div>
    );
};

export default EggReception;
