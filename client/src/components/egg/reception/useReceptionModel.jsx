import { getTodayString } from '../../../utils/dateUtils';
import { formatTime } from '../../../utils/dateUtils';
import { formatDate } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Ban,
    Clock
} from 'lucide-react';

export default function useReceptionModel() {
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

    const todayStr = getTodayString(new Date());

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
                const nowTime = formatTime(new Date());
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
            setProviderLotConfigs(unwrapList(lotCfgRes));

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
            setRawMaterials(unwrapList(rmRes));
            setProviders(unwrapList(provRes));
            setProviderLotConfigs(unwrapList(lotCfgRes));
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
            fecha: getTodayString(new Date()),
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
            const emissionDate = formatDate(new Date());

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

            const tarimaBoxes = Array.isArray(parsedTarimas) ? parsedTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0) : 0;
            const initBoxes = rm.initial_boxes || tarimaBoxes || rm.total_boxes || 0;
            const avgBoxWeight = (parseFloat(initBoxes) > 0 && parseFloat(rm.weight_lbs || 0) > 0)
                ? (parseFloat(rm.weight_lbs) / parseFloat(initBoxes)).toFixed(2)
                : null;

            autoTable(doc, {
                startY: 44,
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
                    ['Total Cajas Recibidas:', `${initBoxes} cajas (Talla: ${rm.egg_size || 'L'})`, 'Total Peso Neto:', `${parseFloat(rm.weight_lbs || 0).toLocaleString()} Lbs`],
                    ...(avgBoxWeight ? [['Peso Promedio / Caja:', `${avgBoxWeight} Lbs/Caja`, 'Condición de Empaque:', rm.egg_color ? `Color ${rm.egg_color}` : 'Estándar']] : [])
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

    // Filter raw materials based on search
    const filteredMaterials = rawMaterials.filter(rm =>
        rm.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rm.provider_lot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rm.egg_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helpers to style status badge
    const getStatusBadge = (status) => {
        switch (status) {
            case 'pendiente_aprobacion':
                return 'bg-amber-50 text-amber-800 border border-amber-300';
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
            case 'pendiente_aprobacion':
                return <Clock className="h-3.5 w-3.5 text-amber-600" />;
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

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pendiente_aprobacion':
                return 'Pendiente Aprobación';
            case 'aprobado':
                return 'Aprobado';
            case 'cuarentena':
                return 'Cuarentena';
            case 'rechazado':
                return 'Rechazado';
            case 'anulado':
                return 'Anulado';
            default:
                return status || 'N/A';
        }
    };

    const handleQuickApprove = async (rm) => {
        try {
            await axios.put(`/api/egg-industrial/raw-materials/${rm.id}/approve`, {
                notes: 'Aprobación directa de lote para producción'
            });
            toast.success(`Lote ${rm.provider_lot || '#' + rm.id} aprobado con éxito para uso en producción.`);
            fetchData();
        } catch (error) {
            console.error('Error al aprobar lote de materia prima:', error);
            toast.error(error.response?.data?.message || 'Error al aprobar el lote.');
        }
    };


 return { user, companyId, rawMaterials, setRawMaterials, providers, setProviders, providerLotConfigs, setProviderLotConfigs, providerLotIntel, setProviderLotIntel, lotConfigModalData, setLotConfigModalData, loading, setLoading, searchTerm, setSearchTerm, viewingReception, setViewingReception, todayStr, useTarimas, setUseTarimas, globalHasCaja, setGlobalHasCaja, showDetailedTares, setShowDetailedTares, bulkAddCount, setBulkAddCount, receptionTareTarima, setReceptionTareTarima, receptionTareSep, setReceptionTareSep, receptionTareCaja, setReceptionTareCaja, receptionBaseBoxes, setReceptionBaseBoxes, globalStorageLocation, setGlobalStorageLocation, lastDraftSavedAt, setLastDraftSavedAt, hasRestoredDraft, setHasRestoredDraft, tarimas, setTarimas, formData, setFormData, isSubmitting, setIsSubmitting, isCreateModalOpen, setIsCreateModalOpen, editingId, setEditingId, voidConfirmId, setVoidConfirmId, printTarimaModal, setPrintTarimaModal, DRAFT_STORAGE_KEY, checkForDraft, discardDraft, userPermissions, isAdmin, canEditQuality, canDeleteReception, deleteConfirmRm, setDeleteConfirmRm, handleDeleteReception, getQualityBadgeClass, defaultPhysicochemical, defaultOrganoleptic, defaultTransport, printingPdfId, setPrintingPdfId, openPrintMenuId, setOpenPrintMenuId, pdfPreviewModal, setPdfPreviewModal, handleClosePdfPreview, handlePrintLab001, handlePrintLab001FromModal, handleDownloadLab001Docx, handleDownloadLab001DocxFromModal, handlePrintOriginCert, handlePrintOriginCertFromModal, handleDownloadOriginCertDocx, handleDownloadOriginCertDocxFromModal, qualityModal, setQualityModal, handleOpenQualityModal, handleSaveQualityClassification, handleOpenPrintTarima, getProviderTareRates, calculateTarimaTare, _handleUpdateReceptionTare, addTarima, addMultipleTarimas, applyStorageLocationToAll, applyEmpaqueModeToAll, removeTarima, updateTarima, recalcTarimasTotals, handleProviderSelect, loadProvidersOptions, handleOpenLotConfig, handleLotConfigSaved, fetchData, handleSubmit, resetForm, handleOpenNewReception, handleEdit, handlePrintReceptionSummary, handleVoid, filteredMaterials, getStatusBadge, getStatusIcon, getStatusLabel, handleQuickApprove };
}
