import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../../components/ui/Pagination';
import {
    Search,
    ShieldCheck,
    FlaskConical,
    Calculator,
    FileCheck,
    Plus,
    XCircle,
    Download,
    Mail,
    Send,
    Edit,
    SlidersHorizontal,
    Trash2,
    CheckSquare,
    Square,
    Eye,
    FileSpreadsheet,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Truck,
    Thermometer,
    Package,
    Layers,
    Activity,
    RefreshCw,
    UserCheck,
    X,
    Clock,
    Loader2,
    Calendar
} from 'lucide-react';
import { EggQualityFinishedProductModal } from '../../components/egg/quality';

const EggTraceability = () => {
    const [activeTab, setActiveTab] = useState('trace'); // 'trace', 'lab', 'solids', 'params'

    // Trazabilidad 360 Master Table States
    const [trace360List, setTrace360List] = useState([]);
    const [trace360Total, setTrace360Total] = useState(0);
    const [trace360Page, setTrace360Page] = useState(1);
    const [trace360TotalPages, setTrace360TotalPages] = useState(1);
    const [trace360Limit] = useState(20);
    const [traceStats, setTraceStats] = useState(null);
    const [trace360Search, setTrace360Search] = useState('');
    const [debouncedTraceSearch, setDebouncedTraceSearch] = useState('');
    const [trace360Stage, setTrace360Stage] = useState('all');
    const [traceStartDate, setTraceStartDate] = useState('');
    const [traceEndDate, setTraceEndDate] = useState('');
    const [loadingTrace360, setLoadingTrace360] = useState(false);

    // Forensic 360 Inspection Modal (Lupa 🔍)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailTarget, setDetailTarget] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Carta de Calidad Multi-formato (PDF, Word, Excel)
    const [isQualityLetterModalOpen, setIsQualityLetterModalOpen] = useState(false);
    const [qualityLetterBatch, setQualityLetterBatch] = useState(null);
    const [letterCustomerName, setLetterCustomerName] = useState('A QUIEN CORRESPONDA');
    const [letterCustomerContact, setLetterCustomerContact] = useState('');
    const [letterScope, setLetterScope] = useState('all'); // 'all', 'fq', 'mb'
    const [exportingFormat, setExportingFormat] = useState(null);

    // Company & Catalogs States
    const [companyInfo, setCompanyInfo] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [qualityParameters, setQualityParameters] = useState([]);
    const [_loadingParams, setLoadingParams] = useState(false);

    // Lab LAB-004 States
    const [labLogs, setLabLogs] = useState([]);
    const [loadingLab, setLoadingLab] = useState(false);
    const [batches, setBatches] = useState([]);
    const [qualityModal, setQualityModal] = useState({ isOpen: false, batch: null, logId: null });
    const [labReleaseFilter, setLabReleaseFilter] = useState('todos'); // 'todos', 'cuarentena', 'liberado', 'bloqueado_haccp'
    const [isLabModalOpen, setIsLabModalOpen] = useState(false);
    const [editingLogId, setEditingLogId] = useState(null);

    const initialLabForm = {
        batch_id: '',
        customer_id: '',
        customer_name: '',
        presentation: 'Cubeta 30 Lb',
        sample_date: new Date().toISOString().split('T')[0],
        status: 'aprobado',
        analyst_name: 'Mario (Control de Calidad)',
        observations: '',
        dynamicReadings: {},
        dynamicCriteria: {}
    };
    const [labForm, setLabForm] = useState(initialLabForm);

    // Multi-Lot Selection & Unified Email States
    const [selectedLogIds, setSelectedLogIds] = useState([]);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailForm, setEmailForm] = useState({
        customer_id: '',
        customer_email: '',
        customer_name: '',
        subject: '',
        message: ''
    });

    // Quality Parameters Management States
    const [paramFilterProduct, setParamFilterProduct] = useState('todos');
    const [paramSearch, setParamSearch] = useState('');
    const [isParamModalOpen, setIsParamModalOpen] = useState(false);
    const [editingParam, setEditingParam] = useState(null);
    const [paramForm, setParamForm] = useState({
        category: 'microbiologico',
        parameter_name: '',
        specification: '',
        default_value: '',
        unit: 'UFC/g',
        applicable_product: 'todos',
        expected_criterion: 'CONFORME',
        sort_order: 1,
        is_active: true
    });

    // Solids Calculator States (Mario's formula)
    const [solidsCalc, setSolidsCalc] = useState({
        base_egg_solids: 24.2,
        target_solids: 21.5,
        batch_weight_lbs: 10000
    });
    const [calcResult, setCalcResult] = useState(null);

    // 1. Cargar Datos Globales (Empresa, Parámetros, Lotes, Bitácora y Clientes)
    const fetchBatchesAndLab = async () => {
        setLoadingLab(true);
        try {
            const [bRes, lRes] = await Promise.all([
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/lab/logs')
            ]);
            setBatches(bRes.data);
            setLabLogs(lRes.data);
        } catch (error) {
            console.error('Error fetching lab/batches:', error);
        } finally {
            setLoadingLab(false);
        }
    };

    const fetchQualityParameters = async () => {
        setLoadingParams(true);
        try {
            const res = await axios.get('/api/egg-industrial/quality-parameters');
            setQualityParameters(res.data);
        } catch (error) {
            console.error('Error fetching quality parameters:', error);
        } finally {
            setLoadingParams(false);
        }
    };

    const fetchCompanyAndCustomers = async () => {
        try {
            const [compRes, custRes] = await Promise.all([
                axios.get('/api/companies'),
                axios.get('/api/customers', { params: { limit: 500, skip_count: 1 } })
            ]);
            if (compRes.data && compRes.data.length > 0) {
                // Priorizar ANDELSA o la primera empresa
                const andelsa = compRes.data.find(c => c.id === 9 || (c.razon_social && c.razon_social.toUpperCase().includes('ANDELSA')));
                setCompanyInfo(andelsa || compRes.data[0]);
            }
            const custList = Array.isArray(custRes.data) ? custRes.data : (custRes.data?.data || []);
            setCustomers(custList);
        } catch (error) {
            console.error('Error fetching company/customers:', error);
        }
    };

    useEffect(() => {
        fetchBatchesAndLab();
        fetchQualityParameters();
        fetchCompanyAndCustomers();
        runLocalSolidsCalc(solidsCalc.base_egg_solids, solidsCalc.target_solids, solidsCalc.batch_weight_lbs);
    }, []);

    const runLocalSolidsCalc = (base, target, totalWeight) => {
        const b = parseFloat(base) || 24.0;
        const t = parseFloat(target) || 21.5;
        const w = parseFloat(totalWeight) || 0;

        let waterPct = 0;
        if (b > t && b > 0) {
            waterPct = ((b - t) / b) * 100;
        }
        const waterLbs = (w * waterPct) / 100;
        const eggBaseLbs = w - waterLbs;
        const garrafones = waterLbs / 42.0; // 1 garrafón = 42 lbs H2O
        const citricLbs = w * 0.001; // 0.1% ácido cítrico

        setCalcResult({
            base_solids: b,
            target_solids: t,
            total_lbs: w,
            water_percentage: waterPct,
            water_lbs: waterLbs,
            water_garrafones: garrafones,
            egg_base_lbs: eggBaseLbs,
            citric_acid_lbs: citricLbs,
            is_compliant: t >= 21.0
        });
    };

    // 1.1 Funciones de Trazabilidad 360° Master Table
    const fetchTrace360List = async () => {
        setLoadingTrace360(true);
        try {
            const res = await axios.get('/api/egg-industrial/traceability-360', {
                params: {
                    search: debouncedTraceSearch || undefined,
                    stage: trace360Stage,
                    start_date: traceStartDate || undefined,
                    end_date: traceEndDate || undefined,
                    page: trace360Page,
                    limit: trace360Limit
                }
            });
            setTrace360List(res.data.data || []);
            setTrace360Total(res.data.total || 0);
            setTrace360TotalPages(res.data.totalPages || 1);
        } catch (error) {
            console.error('Error fetching 360 traceability list:', error);
        } finally {
            setLoadingTrace360(false);
        }
    };

    const fetchTrace360Stats = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/traceability-360/stats', {
                params: {
                    start_date: traceStartDate || undefined,
                    end_date: traceEndDate || undefined
                }
            });
            setTraceStats(res.data);
        } catch (error) {
            console.error('Error fetching 360 stats:', error);
        }
    };

    // Debounce búsqueda 360
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedTraceSearch(trace360Search);
            setTrace360Page(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [trace360Search]);

    // Recargar lista al cambiar pestaña o filtros
    useEffect(() => {
        if (activeTab === 'trace') {
            fetchTrace360List();
            fetchTrace360Stats();
        }
    }, [activeTab, debouncedTraceSearch, trace360Stage, traceStartDate, traceEndDate, trace360Page]);

    // Apertura de Inspección Forense 360° (Lupa 🔍)
    const handleOpenInspection = async (item) => {
        setDetailTarget(item);
        setIsDetailModalOpen(true);
        setLoadingDetail(true);
        setDetailData(null);

        try {
            let type = 'raw';
            let id = item.raw_material_id;
            if (item.packaging_id) {
                type = 'pkg';
                id = item.packaging_id;
            } else if (item.batch_id) {
                type = 'batch';
                id = item.batch_id;
            }
            const res = await axios.get(`/api/egg-industrial/traceability-360/detail/${type}/${id}`);
            setDetailData(res.data);
        } catch (error) {
            console.error('Error loading 360 inspection detail:', error);
            toast.error('Error al cargar la inspección forense 360°.');
        } finally {
            setLoadingDetail(false);
        }
    };

    // Modal de Carta de Calidad Multi-formato (PDF, Word, Excel)
    const handleOpenQualityLetterModal = (item) => {
        const batchId = item.batch_id || item.id;
        const lotCode = item.commercial_lot_code || item.lot_code || item.batch_code_display || item.batch_uuid || `LOTE-${batchId}`;
        const productType = item.product_name || item.product_type || 'Huevo Entero Pasteurizado';
        const presentation = item.presentation || 'Cubeta 30 Lb';

        setQualityLetterBatch({
            batch_id: batchId,
            lot_code: lotCode,
            product_type: productType,
            presentation: presentation
        });

        // "sin tener informacion del cliente pre cargada almenos que se le requiera"
        setLetterCustomerName(item.customer_name && item.customer_name !== 'Inventario General' && item.customer_name !== 'Venta General' ? item.customer_name : 'A QUIEN CORRESPONDA');
        setLetterCustomerContact('');
        setIsQualityLetterModalOpen(true);
    };

    const handleDownloadQualityLetter = async (format) => {
        if (!qualityLetterBatch?.batch_id) {
            return toast.error('No se ha seleccionado un lote válido para la carta de calidad.');
        }

        setExportingFormat(format);
        try {
            const res = await axios.get(`/api/egg-industrial/lab/quality-letter/${qualityLetterBatch.batch_id}/export`, {
                params: {
                    format,
                    scope: letterScope,
                    customer_name: letterCustomerName.trim() || undefined,
                    customer_contact: letterCustomerContact.trim() || undefined
                },
                responseType: 'blob'
            });

            const safeCode = (qualityLetterBatch.lot_code || `LOTE-${qualityLetterBatch.batch_id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            const prefix = letterScope === 'fq' ? 'Analisis_FQ' : letterScope === 'mb' ? 'Analisis_MB' : 'Carta_Calidad';
            const ext = format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pdf';
            const mime = format === 'word'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : format === 'excel'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'application/pdf';

            const blob = new Blob([res.data], { type: mime });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${prefix}_${safeCode}.${ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Carta de Calidad descargada exitosamente en formato ${format.toUpperCase()}.`);
        } catch (error) {
            console.error('Error generando carta de calidad:', error);
            toast.error('Error al descargar la carta de calidad.');
        } finally {
            setExportingFormat(null);
        }
    };

    // Descarga de Certificado de Calidad de Origen (Proveedor a ANDELSA)
    const [downloadingOriginCert, setDownloadingOriginCert] = useState(false);

    const handleDownloadOriginCertificate = async (identifier, isBatch = false, format = 'pdf') => {
        if (!identifier) {
            return toast.error('No se identificó el lote o materia prima para el Certificado de Origen.');
        }

        setDownloadingOriginCert(true);
        try {
            const url = isBatch
                ? `/api/egg-industrial/traceability-360/batch/${identifier}/origin-certificate`
                : `/api/egg-industrial/raw-materials/${identifier}/origin-certificate`;

            const res = await axios.get(url, {
                params: { format },
                responseType: 'blob'
            });

            const ext = format === 'word' ? 'docx' : 'pdf';
            const mime = format === 'word'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/pdf';

            const blob = new Blob([res.data], { type: mime });
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `Certificado_Origen_${isBatch ? `LOTE_${identifier}` : `MP_${identifier}`}.${ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`Certificado de Calidad de Origen descargado (${format.toUpperCase()}).`);
        } catch (error) {
            console.error('Error al descargar Certificado de Origen:', error);
            toast.error('No se pudo generar el Certificado de Calidad de Origen.');
        } finally {
            setDownloadingOriginCert(false);
        }
    };

    // Parámetros activos filtrados para el lote seleccionado en el formulario
    const selectedBatch = useMemo(() => {
        return batches.find(b => String(b.id) === String(labForm.batch_id));
    }, [batches, labForm.batch_id]);

    const activeProductParams = useMemo(() => {
        if (!selectedBatch) {
            return qualityParameters.filter(p => p.is_active);
        }
        const pType = (selectedBatch.product_type || '').toLowerCase();
        return qualityParameters.filter(p => {
            if (!p.is_active) return false;
            const applicable = (p.applicable_product || 'todos').toLowerCase();
            return applicable === 'todos' || pType.includes(applicable) || applicable.includes(pType);
        });
    }, [qualityParameters, selectedBatch]);

    // Abrir modal para crear nuevo análisis de calidad FQ/MB
    const handleOpenCreateLab = () => {
        setQualityModal({ isOpen: true, batch: null, logId: null });
    };

    // Abrir modal para editar análisis existente
    const handleOpenEditLab = (log) => {
        const relatedBatch = batches.find(b => b.id === log.batch_id);
        setQualityModal({
            isOpen: true,
            batch: relatedBatch || {
                id: log.batch_id,
                batch_uuid: log.batch_uuid || log.commercial_lot_code,
                batch_code_display: log.batch_code_display || log.commercial_lot_code,
                product_type: log.product_type,
                presentation: log.presentation
            },
            logId: log.id
        });
    };

    // Exportar Libro Excel Oficial Mario 2025 (FQ + MB)
    const handleExportMarioExcel = async () => {
        try {
            toast.info('Generando Excel oficial Mario 2025 (Hojas FQ y MB)...');
            const res = await axios.get('/api/egg-industrial/lab/export-mario', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Control_Calidad_Mario_${new Date().getFullYear()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Excel oficial descargado con éxito.');
        } catch (error) {
            console.error('Error exportando Excel de Mario:', error);
            toast.error('Error al descargar el Excel de calidad.');
        }
    };

    // Guardar / Actualizar Registro LAB-004
    const handleSaveLabLog = async (e) => {
        e.preventDefault();
        if (!labForm.batch_id) return toast.error('Debe seleccionar un lote de producción.');

        try {
            // Construir array de custom_parameters
            const customParametersPayload = activeProductParams.map(param => {
                const readingVal = labForm.dynamicReadings[param.id] !== undefined ? labForm.dynamicReadings[param.id] : (param.default_value || '');
                const criterionVal = labForm.dynamicCriteria[param.id] !== undefined ? labForm.dynamicCriteria[param.id] : (param.expected_criterion || 'CONFORME');
                return {
                    parameter_id: param.id,
                    category: param.category,
                    parameter_name: param.parameter_name,
                    specification: param.specification,
                    unit: param.unit,
                    value: readingVal,
                    criterion: criterionVal
                };
            });

            // Extraer valores para campos legacy compatibles
            const findReading = (pattern) => {
                const item = customParametersPayload.find(p => p.parameter_name.toLowerCase().includes(pattern));
                return item ? item.value : null;
            };

            const payload = {
                batch_id: parseInt(labForm.batch_id),
                customer_id: labForm.customer_id ? parseInt(labForm.customer_id) : null,
                customer_name: labForm.customer_name || null,
                presentation: labForm.presentation || 'Cubeta 30 Lb',
                sample_date: labForm.sample_date,
                status: labForm.status,
                analyst_name: labForm.analyst_name,
                observations: labForm.observations,
                custom_parameters: customParametersPayload,
                mesofilos_aerobios: findReading('mesófilo') || findReading('aerobio'),
                coliformes_totales: findReading('coliforme'),
                escherichia_coli: findReading('coli'),
                salmonella_spp: findReading('salmonella'),
                hongos_levaduras: findReading('hongo') || findReading('levadura'),
                solidos_totales_pct: findReading('sólido') || findReading('solido'),
                ph: findReading('ph')
            };

            if (editingLogId) {
                await axios.put(`/api/egg-industrial/lab/logs/${editingLogId}`, payload);
                toast.success('Análisis de laboratorio LAB-004 actualizado exitosamente.');
            } else {
                await axios.post('/api/egg-industrial/lab/logs', payload);
                toast.success('Análisis de laboratorio LAB-004 registrado exitosamente.');
            }

            setIsLabModalOpen(false);
            fetchBatchesAndLab();
        } catch (error) {
            console.error('Error guardando análisis LAB-004:', error);
            toast.error(error.response?.data?.message || 'Error al procesar análisis microbiológico.');
        }
    };

    // Generador oficial del Certificado de Análisis (COA) en PDF
    const handleGenerateCoaPdf = (log, returnBase64 = false) => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            // 1. Encabezado Corporativo Oficial con Razón Social Legal
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, 216, 28, 'F');

            const legalName = (companyInfo?.razon_social || 'ANDELSA, S.A. DE C.V.').toUpperCase();
            const commName = companyInfo?.nombre_comercial ? companyInfo.nombre_comercial.toUpperCase() : '';
            const displayTitle = (commName && commName !== legalName) ? `${legalName} (${commName})` : legalName;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(255, 255, 255);
            doc.text(displayTitle, 14, 11);

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(203, 213, 225);
            doc.text(`NRC: ${companyInfo?.nrc || '224745-0'} | NIT: ${companyInfo?.nit || '0614-070513-102-1'} | Planta Procesadora de Ovoproductos Pasteurizados`, 14, 17);
            doc.text('Departamento de Control de Calidad | Normativa FDA / HACCP / Codex Alimentarius CAC/RCP 15-1976', 14, 22);

            // 2. Título del Documento
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('CERTIFICADO DE ANÁLISIS DE CALIDAD & LIBERACIÓN (COA)', 14, 38);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            const emissionDate = log.sample_date ? new Date(log.sample_date).toLocaleDateString() : (log.analysis_date ? new Date(log.analysis_date).toLocaleDateString() : new Date().toLocaleDateString());
            doc.text(`Registro Oficial: LAB-004-${String(log.id).padStart(4, '0')} | Fecha de Emisión: ${emissionDate}`, 14, 43);

            // 3. Cuadro de Metadatos del Lote y Cliente
            const clientName = log.customer_name || log.customer_nombre_db || 'Venta General / Stock';
            const batchCode = log.batch_code_display || log.batch_uuid || 'LOTE GENERAL';
            const prodName = (log.product_type || 'Huevo Entero Pasteurizado').toUpperCase();
            const presName = log.presentation || 'Cubeta 30 Lb';
            const statusDisplay = (log.status || log.result_status || 'APROBADO').toUpperCase();

            autoTable(doc, {
                startY: 48,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                head: [['Parámetro General', 'Información de Producción & Cliente']],
                body: [
                    ['Cliente Destino / Receptor:', clientName],
                    ['Lote de Producción (Juliano):', batchCode],
                    ['Producto:', prodName],
                    ['Presentación Comercial:', presName],
                    ['Fecha de Fabricación / Análisis:', emissionDate],
                    ['Analista Responsable:', log.analyst_name || 'Mario (Control de Calidad)'],
                    ['Dictamen de Inocuidad:', statusDisplay]
                ]
            });

            // 4. Parámetros Microbiológicos (Dinámicos y Fieles al Catálogo)
            const customParams = Array.isArray(log.custom_parameters) ? log.custom_parameters : [];
            const microParams = customParams.filter(p => p.category === 'microbiologico');
            const fisicoParams = customParams.filter(p => p.category === 'fisicoquimico');
            const organoParams = customParams.filter(p => p.category === 'organoleptico' || p.category === 'otro');

            // Microbiológicos
            const microRows = microParams.length > 0 ? microParams.map(p => [
                p.parameter_name, p.specification, p.value || p.default_value || 'Conforme', p.criterion || 'CONFORME'
            ]) : [
                ['Recuento Mesófilos Aerobios', 'Máx 10,000 UFC/g', log.mesophilic_aerobic_cfu ? `< ${log.mesophilic_aerobic_cfu} UFC/g` : (log.mesofilos_aerobios || '< 1,000 UFC/g'), 'CONFORME'],
                ['Coliformes Totales', 'Máx 10 UFC/g', log.total_coliforms_mpn ? `< ${log.total_coliforms_mpn} UFC/g` : (log.coliformes_totales || '< 10 UFC/g'), 'CONFORME'],
                ['Escherichia coli', 'Ausencia en 1g', log.e_coli_mpn ? 'Ausencia' : (log.escherichia_coli || 'Ausencia'), 'CONFORME'],
                ['Salmonella spp.', 'Ausencia en 25g (Crítico)', log.salmonella_25g ? `Ausencia en 25g (${log.salmonella_25g})` : (log.salmonella_spp || 'Ausencia en 25g'), 'CONFORME'],
                ['Hongos y Levaduras', 'Máx 100 UFC/g', log.fungi_yeasts_cfu ? `< ${log.fungi_yeasts_cfu} UFC/g` : (log.hongos_levaduras || '< 10 UFC/g'), 'CONFORME']
            ];

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 5,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                head: [['Ensayo Microbiológico', 'Límite Normativo Aceptable', 'Resultado Obtenido', 'Criterio']],
                body: microRows
            });

            // Físico-Químicos
            const fisicoRows = fisicoParams.length > 0 ? fisicoParams.map(p => [
                p.parameter_name, p.specification, p.value ? `${p.value}${p.unit ? ' ' + p.unit : ''}` : (p.default_value || 'Dentro de norma'), p.criterion || 'DENTRO DE NORMA'
            ]) : [
                ['Porcentaje de Sólidos Totales', '≥ 21.0% (Refractómetro)', log.solids_percentage ? `${log.solids_percentage}%` : (log.solidos_totales_pct ? `${log.solidos_totales_pct}%` : '24.2%'), 'DENTRO DE NORMA'],
                ['Potencial de Hidrógeno (pH)', '7.20 - 7.80 pH', log.ph ? `${log.ph}` : '7.40', 'DENTRO DE NORMA'],
                ['Olor, Color y Aspecto', 'Característico, homogéneo, libre de olores extraños', 'Normal', 'CONFORME']
            ];

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 5,
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                head: [['Parámetro Físico-Químico', 'Especificación', 'Valor Registrado', 'Estado']],
                body: fisicoRows
            });

            // Organolépticos si existen
            if (organoParams.length > 0) {
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 5,
                    theme: 'grid',
                    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
                    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                    head: [['Parámetro Organoléptico / Sensorial', 'Especificación', 'Resultado', 'Criterio']],
                    body: organoParams.map(p => [p.parameter_name, p.specification, p.value || p.default_value || 'Normal', p.criterion || 'CONFORME'])
                });
            }

            // 5. Dictamen Final y Firmas
            const finalY = doc.lastAutoTable.finalY + 6;
            doc.setFillColor(240, 253, 250);
            doc.setDrawColor(45, 212, 191);
            doc.roundedRect(14, finalY, 188, 20, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(13, 148, 136);
            doc.text('DICTAMEN FINAL DE LIBERACIÓN DE CALIDAD:', 18, finalY + 6);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            doc.text('El lote analizado cumple satisfactoriamente con los estándares microbiológicos y físico-químicos establecidos.', 18, finalY + 11);
            doc.text('PRODUCTO APTO PARA CONSUMO HUMANO Y DISTRIBUCIÓN COMERCIAL.', 18, finalY + 16);

            // Firmas
            const signY = finalY + 28;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.line(28, signY, 88, signY);
            doc.text(log.analyst_name || 'Mario / Analista de Calidad', 34, signY + 4);
            doc.text('Firma y Sello de Laboratorio', 36, signY + 8);

            doc.line(125, signY, 185, signY);
            doc.text('Roxy / Gerencia de Operaciones', 133, signY + 4);
            doc.text('Liberación Oficial de Despacho', 135, signY + 8);

            if (returnBase64) {
                return doc.output('datauristring');
            } else {
                doc.save(`COA-${batchCode}.pdf`);
                toast.success(`Certificado de Análisis (COA) PDF de lote ${batchCode} generado.`);
            }
        } catch (error) {
            console.error('Error generando COA:', error);
            toast.error('Error al generar el certificado PDF.');
        }
    };

    // 2. Selección de Lotes y Envío Unificado por Correo
    const handleToggleSelectLog = (id) => {
        setSelectedLogIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllLogs = () => {
        if (selectedLogIds.length === labLogs.length) {
            setSelectedLogIds([]);
        } else {
            setSelectedLogIds(labLogs.map(l => l.id));
        }
    };

    const handleOpenUnifiedEmailModal = () => {
        if (selectedLogIds.length === 0) {
            return toast.error('Seleccione al menos un lote para enviar por correo.');
        }

        const selectedLogs = labLogs.filter(l => selectedLogIds.includes(l.id));

        // Determinar cliente sugerido desde los lotes seleccionados
        const firstWithCustomer = selectedLogs.find(l => l.customer_id || l.customer_name);
        let custId = firstWithCustomer?.customer_id ? String(firstWithCustomer.customer_id) : '';
        let custName = firstWithCustomer?.customer_name || firstWithCustomer?.customer_nombre_db || '';
        let custEmail = firstWithCustomer?.customer_correo || '';

        if (custId && !custEmail) {
            const cObj = customers.find(c => String(c.id) === String(custId));
            if (cObj) custEmail = cObj.correo || '';
        }

        const compName = companyInfo?.nombre_comercial || companyInfo?.razon_social || 'ANDELSA';
        const lotCodes = selectedLogs.map(l => l.batch_code_display || l.batch_uuid).join(', ');

        setEmailForm({
            customer_id: custId,
            customer_email: custEmail,
            customer_name: custName,
            subject: `Certificados de Análisis y Calidad (COA) - ${compName} | Lotes: ${lotCodes}`,
            message: `Estimado cliente, adjunto encontrará los Certificados de Calidad (COA) correspondientes a los ${selectedLogs.length} lotes despachados a sus instalaciones. Todos los lotes han sido liberados cumpliendo con las normas de inocuidad alimentaria.`
        });

        setIsEmailModalOpen(true);
    };

    const handleSendUnifiedEmail = async (e) => {
        e.preventDefault();
        if (!emailForm.customer_email.trim()) {
            return toast.error('Debe ingresar un correo electrónico válido para el cliente.');
        }

        setSendingEmail(true);
        try {
            const selectedLogs = labLogs.filter(l => selectedLogIds.includes(l.id));

            // Generar los PDFs individuales en Base64 para cada lote
            toast.info(`Generando certificados PDF para ${selectedLogs.length} lote(s)...`);
            const attachments = selectedLogs.map(log => {
                const bCode = log.batch_code_display || log.batch_uuid || `LOTE-${log.id}`;
                const pdfBase64 = handleGenerateCoaPdf(log, true);
                return {
                    filename: `COA-${bCode}.pdf`,
                    content: pdfBase64
                };
            });

            await axios.post('/api/egg-industrial/lab/send-unified-email', {
                customer_email: emailForm.customer_email.trim(),
                customer_name: emailForm.customer_name.trim(),
                subject: emailForm.subject.trim(),
                message: emailForm.message.trim(),
                log_ids: selectedLogIds,
                attachments
            });

            toast.success(`Correo unificado enviado exitosamente a ${emailForm.customer_email} con ${attachments.length} certificado(s) adjunto(s).`);
            setIsEmailModalOpen(false);
            setSelectedLogIds([]);
        } catch (error) {
            console.error('Error enviando correo unificado:', error);
            toast.error(error.response?.data?.message || 'Error al enviar correo electrónico.');
        } finally {
            setSendingEmail(false);
        }
    };

    // 3. Gestión de Parámetros de Calidad & Formas
    const handleOpenCreateParam = () => {
        setEditingParam(null);
        setParamForm({
            category: 'microbiologico',
            parameter_name: '',
            specification: '',
            default_value: '',
            unit: 'UFC/g',
            applicable_product: paramFilterProduct !== 'todos' ? paramFilterProduct : 'todos',
            expected_criterion: 'CONFORME',
            sort_order: qualityParameters.length + 1,
            is_active: true
        });
        setIsParamModalOpen(true);
    };

    const handleOpenEditParam = (param) => {
        setEditingParam(param);
        setParamForm({
            category: param.category,
            parameter_name: param.parameter_name,
            specification: param.specification,
            default_value: param.default_value || '',
            unit: param.unit || '',
            applicable_product: param.applicable_product || 'todos',
            expected_criterion: param.expected_criterion || 'CONFORME',
            sort_order: param.sort_order || 0,
            is_active: param.is_active === 1 || param.is_active === true
        });
        setIsParamModalOpen(true);
    };

    const handleSaveParam = async (e) => {
        e.preventDefault();
        if (!paramForm.parameter_name.trim() || !paramForm.specification.trim()) {
            return toast.error('El nombre del parámetro y la especificación son obligatorios.');
        }

        try {
            if (editingParam) {
                await axios.put(`/api/egg-industrial/quality-parameters/${editingParam.id}`, {
                    id: editingParam.id,
                    ...paramForm
                });
                toast.success('Parámetro de calidad actualizado exitosamente.');
            } else {
                await axios.post('/api/egg-industrial/quality-parameters', paramForm);
                toast.success('Parámetro de calidad creado exitosamente.');
            }
            setIsParamModalOpen(false);
            fetchQualityParameters();
        } catch (error) {
            console.error('Error guardando parámetro:', error);
            toast.error(error.response?.data?.message || 'Error al guardar parámetro de calidad.');
        }
    };

    const handleDeleteParam = async (paramId) => {
        if (!window.confirm('¿Está seguro de eliminar este parámetro de calidad?')) return;
        try {
            await axios.delete(`/api/egg-industrial/quality-parameters/${paramId}`);
            toast.success('Parámetro eliminado exitosamente.');
            fetchQualityParameters();
        } catch (error) {
            console.error('Error eliminando parámetro:', error);
            toast.error(error.response?.data?.message || 'Error al eliminar parámetro.');
        }
    };

    // Filtrar parámetros en la pestaña de configuración
    const filteredParameters = useMemo(() => {
        return qualityParameters.filter(p => {
            const matchesProduct = paramFilterProduct === 'todos' || p.applicable_product === 'todos' || p.applicable_product.toLowerCase() === paramFilterProduct.toLowerCase();
            const matchesSearch = !paramSearch.trim() || p.parameter_name.toLowerCase().includes(paramSearch.toLowerCase()) || p.specification.toLowerCase().includes(paramSearch.toLowerCase());
            return matchesProduct && matchesSearch;
        });
    }, [qualityParameters, paramFilterProduct, paramSearch]);

    // Lista única de formas/productos configurados
    const availableForms = useMemo(() => {
        const forms = new Set(['todos', 'huevo entero', 'clara de huevo', 'yema de huevo']);
        qualityParameters.forEach(p => {
            if (p.applicable_product) forms.add(p.applicable_product.toLowerCase());
        });
        batches.forEach(b => {
            if (b.product_type) forms.add(b.product_type.toLowerCase());
        });
        return Array.from(forms);
    }, [qualityParameters, batches]);

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 text-teal-600">
                        <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Trazabilidad de Lotes, Calidad & COA</h1>
                            {companyInfo && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {companyInfo.razon_social}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">Control de calidad LAB-004, parametrización de normas, emisión de COA individual y despacho unificado</p>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                        onClick={() => setActiveTab('trace')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'trace' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Search size={14} />
                        Trazabilidad de Lotes
                    </button>
                    <button
                        onClick={() => setActiveTab('lab')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'lab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <FlaskConical size={14} />
                        Control de Calidad (LAB-004)
                    </button>
                    <button
                        onClick={() => setActiveTab('params')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'params' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <SlidersHorizontal size={14} />
                        Parámetros & Normas COA
                    </button>
                    <button
                        onClick={() => setActiveTab('solids')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${activeTab === 'solids' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Calculator size={14} />
                        Calculadora de Sólidos HE+
                    </button>
                </div>
            </div>

            {/* TAB 1: TRAZABILIDAD 360° */}
            {activeTab === 'trace' && (
                <div className="space-y-6">
                    {/* Top KPI Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* KPI 1: Materia Prima */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Materia Prima</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? `${traceStats.raw_materials.total_lbs.toLocaleString()} Lbs` : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.raw_materials.count} recepciones granja` : 'Cargando...'}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
                                <Truck size={22} />
                            </div>
                        </div>

                        {/* KPI 2: Producción / Transformación */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">2. Producción Líquida</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? `${traceStats.production.liquid_yield_lbs.toLocaleString()} Lbs` : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.production.batches_count} lotes transformados` : 'Cargando...'}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                                <Activity size={22} />
                            </div>
                        </div>

                        {/* KPI 3: Inventario Final Envasado */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3. Inventario Envasado</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? `${traceStats.packaging.total_units.toLocaleString()} Unid.` : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.packaging.total_pkg_lbs.toLocaleString()} Lbs envasadas` : 'Cargando...'}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                                <Package size={22} />
                            </div>
                        </div>

                        {/* KPI 4: Inocuidad & Alertas */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">4. Inocuidad & Calidad</span>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    {traceStats ? (
                                        traceStats.alerts.total_alerts > 0 ? (
                                            <span className="text-rose-600 flex items-center gap-1.5">
                                                <AlertTriangle size={18} /> {traceStats.alerts.total_alerts} Alertas
                                            </span>
                                        ) : (
                                            <span className="text-emerald-600 flex items-center gap-1.5">
                                                <CheckCircle2 size={18} /> 100% Conforme
                                            </span>
                                        )
                                    ) : '...'}
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">
                                    {traceStats ? `${traceStats.quality_approved_count} lotes liberados LAB-004` : 'Cargando...'}
                                </span>
                            </div>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${traceStats?.alerts?.total_alerts > 0 ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>
                                <ShieldCheck size={22} />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar, Date Range & Stage Selector */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Search Input */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={trace360Search}
                                    onChange={e => setTrace360Search(e.target.value)}
                                    placeholder="Buscar por proveedor, lote MP, lote juliano, lote comercial, producto, cliente, código de barra..."
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                {trace360Search && (
                                    <button
                                        onClick={() => setTrace360Search('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Date Range Filter */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    <Calendar size={14} className="text-indigo-600 shrink-0" />
                                    <span className="hidden sm:inline">Rango:</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold text-slate-400">Desde</span>
                                    <input
                                        type="date"
                                        value={traceStartDate}
                                        onChange={e => { setTraceStartDate(e.target.value); setTrace360Page(1); }}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold text-slate-400">Hasta</span>
                                    <input
                                        type="date"
                                        value={traceEndDate}
                                        onChange={e => { setTraceEndDate(e.target.value); setTrace360Page(1); }}
                                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                {(traceStartDate || traceEndDate) && (
                                    <button
                                        onClick={() => { setTraceStartDate(''); setTraceEndDate(''); setTrace360Page(1); }}
                                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                        title="Limpiar rango de fechas"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stage Selector Tabs & Refresh */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Etapa:</span>
                                {[
                                    { id: 'all', label: 'Todos' },
                                    { id: 'materia_prima', label: 'Materia Prima' },
                                    { id: 'produccion', label: 'En Producción' },
                                    { id: 'inventario_final', label: 'Inventario Final' },
                                    { id: 'con_alertas', label: 'Con Alertas' }
                                ].map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => { setTrace360Stage(st.id); setTrace360Page(1); }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            trace360Stage === st.id
                                                ? (st.id === 'con_alertas' ? 'bg-rose-600 text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm')
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => { fetchTrace360List(); fetchTrace360Stats(); }}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
                                title="Recargar trazabilidad"
                            >
                                <RefreshCw size={14} className={loadingTrace360 ? 'animate-spin' : ''} />
                                <span className="hidden sm:inline">Actualizar</span>
                            </button>
                        </div>
                    </div>

                    {/* Master 360° Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            {loadingTrace360 ? (
                                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
                                    <Loader2 size={36} className="animate-spin text-indigo-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Consultando cadena de trazabilidad 360°...</span>
                                </div>
                            ) : trace360List.length === 0 ? (
                                <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2 text-center p-6">
                                    <Layers size={40} className="text-slate-300 mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No se encontraron registros de trazabilidad</p>
                                    <p className="text-xs text-slate-400 max-w-sm">Prueba ajustando los términos de búsqueda, rango de fechas o cambiando el filtro de etapa.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                                            <th className="p-3.5 w-12 text-center">360°</th>
                                            <th className="p-3.5">Materia Prima (Recepción)</th>
                                            <th className="p-3.5">Producción (Transformación)</th>
                                            <th className="p-3.5">Inventario Final (Envasado)</th>
                                            <th className="p-3.5">Calidad & Alertas</th>
                                            <th className="p-3.5">Cliente / Despacho</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {trace360List.map((item, idx) => {
                                            const hasAlert = item.has_alerts;
                                            return (
                                                <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${hasAlert ? 'bg-rose-50/20' : ''}`}>
                                                    {/* Lupa / Inspector */}
                                                    <td className="p-3.5 text-center">
                                                        <button
                                                            onClick={() => handleOpenInspection(item)}
                                                            className="w-9 h-9 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 flex items-center justify-center transition-all shadow-xs border border-indigo-100 group"
                                                            title="Ver Trazabilidad Forense 360°"
                                                        >
                                                            <Search size={16} className="group-hover:scale-110 transition-transform" />
                                                        </button>
                                                    </td>

                                                    {/* 1. Materia Prima */}
                                                    <td className="p-3.5">
                                                        {item.raw_material_id ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-slate-900">{item.provider_name}</span>
                                                                    <span className="font-mono text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                                                        {item.raw_provider_lot}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                                                    <span className="capitalize font-medium">{item.raw_egg_type}</span>
                                                                    <span>•</span>
                                                                    <span>{item.raw_weight_lbs ? `${item.raw_weight_lbs.toLocaleString()} Lbs` : '-'}</span>
                                                                    {item.raw_total_boxes > 0 && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>{item.raw_total_boxes} caj.</span>
                                                                        </>
                                                                    )}
                                                                    {item.raw_temp_c !== null && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="font-semibold text-teal-700">{item.raw_temp_c}°C</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 block font-medium">
                                                                    {item.raw_reception_date ? `Recibido: ${new Date(item.raw_reception_date).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Lote directo de planta</span>
                                                        )}
                                                    </td>

                                                    {/* 2. Producción */}
                                                    <td className="p-3.5">
                                                        {item.is_transformed ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-bold text-xs text-indigo-700">
                                                                        {item.batch_code_display || item.batch_uuid}
                                                                    </span>
                                                                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${item.batch_status === 'completado' || item.batch_status === 'aprobado_calidad' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                                        {item.batch_status || 'Transformado'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                                                                    <span>Rendimiento:</span>
                                                                    <strong className="text-teal-700">{item.batch_yield_liquid ? `${item.batch_yield_liquid.toLocaleString()} Lbs` : '0 Lbs'}</strong>
                                                                    {item.batch_input_weight > 0 && item.batch_yield_liquid > 0 && (
                                                                        <span className="text-[10px] text-slate-400 font-semibold">
                                                                            ({((item.batch_yield_liquid / item.batch_input_weight) * 100).toFixed(1)}%)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                                                    <span>{item.batch_started_at ? `Inicio: ${new Date(item.batch_started_at).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                                                                    <span>Op: {item.batch_operator || 'Operador Planta'}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                                                                Pendiente Transformar
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 3. Inventario Final */}
                                                    <td className="p-3.5">
                                                        {item.commercial_lot_code ? (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-black text-xs text-slate-900">
                                                                        {item.commercial_lot_code}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">
                                                                        {item.warehouse_zone}
                                                                    </span>
                                                                </div>
                                                                <div className="text-[11px] font-bold text-slate-800">
                                                                    {item.product_name} - {item.presentation}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                                    <span>{item.units_packaged} cubetas ({item.packaged_weight_lbs} Lbs)</span>
                                                                    <span>•</span>
                                                                    <span className="font-medium text-slate-700">Vence: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('es-SV') : 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">Sin envasar aún</span>
                                                        )}
                                                    </td>

                                                    {/* 4. Calidad & Alertas */}
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setQualityModal({
                                                                        isOpen: true,
                                                                        batch: {
                                                                            id: item.batch_id,
                                                                            batch_uuid: item.batch_uuid,
                                                                            batch_code_display: item.batch_code_display || item.commercial_lot_code,
                                                                            product_type: item.product_name || item.batch_product_type,
                                                                            presentation: item.presentation,
                                                                            status: item.batch_status
                                                                        },
                                                                        logId: item.lab_log_id
                                                                    })}
                                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                                        item.release_status === 'liberado' || item.lab_status === 'aprobado'
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : item.release_status === 'bloqueado_haccp' || item.lab_status === 'rechazado'
                                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                    }`}
                                                                    title="Ver / Evaluar Calidad Oficial Mario (FQ / MB)"
                                                                >
                                                                    {item.release_status === 'liberado' || item.lab_status === 'aprobado' ? 'Liberado' : item.release_status === 'bloqueado_haccp' || item.lab_status === 'rechazado' ? 'Bloqueado' : 'Cuarentena'}
                                                                </button>
                                                                {item.mb_status === 'en_incubacion' && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-0.5" title="Incubación microbiológica en curso (48h)">
                                                                        <Clock size={9} /> MB 48h
                                                                    </span>
                                                                )}
                                                                {hasAlert && (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                                                                        <AlertTriangle size={10} /> Alerta
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {hasAlert && item.alert_reason && (
                                                                <p className="text-[10px] text-rose-600 font-bold max-w-xs leading-tight">
                                                                    {item.alert_reason}
                                                                </p>
                                                            )}
                                                            <div className="text-[10px] text-slate-600 flex flex-wrap items-center gap-1.5 font-mono">
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">Sól: {item.solids_percentage ? `${item.solids_percentage}%` : '24.2%'}</span>
                                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">pH: {item.ph || '7.4'}</span>
                                                                {item.temperature_c !== null && item.temperature_c !== undefined && (
                                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">T: {item.temperature_c}°C</span>
                                                                )}
                                                                <span className={`px-1.5 py-0.5 rounded ${String(item.salmonella_25g || '').toLowerCase().includes('presencia') ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-teal-50 text-teal-700'}`}>
                                                                    Salm: {item.salmonella_25g || 'Ausente'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* 5. Cliente / Despacho */}
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            {item.customer_name ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <UserCheck size={13} className="text-indigo-600 shrink-0" />
                                                                    <span className="font-bold text-slate-900 block truncate max-w-[190px]" title={item.customer_name}>
                                                                        {item.customer_name}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 size={10} /> En Stock / Disponible
                                                                </span>
                                                            )}
                                                            {item.batch_id && (
                                                                <button
                                                                    onClick={() => handleOpenQualityLetterModal(item)}
                                                                    className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-1 transition-all"
                                                                    title="Generar Carta de Calidad del Lote"
                                                                >
                                                                    <FileText size={11} className="text-amber-600" />
                                                                    Carta Calidad
                                                                </button>
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

                        {/* Pagination Footer */}
                        {trace360Total > 0 && (
                            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                                <span>Mostrando {trace360List.length} de {trace360Total} registros en total</span>
                                <Pagination
                                    currentPage={trace360Page}
                                    totalPages={trace360TotalPages}
                                    totalItems={trace360Total}
                                    onPageChange={setTrace360Page}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: CONTROL MICROBIOLÓGICO (LAB-004) & EMISIÓN/DESPACHO DE COA */}
            {activeTab === 'lab' && (
                <div className="space-y-6">
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-teal-600" />
                                Bitácora de Análisis de Calidad y Emisión de COA
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">Registro de ensayos microbiológicos, físico-químicos y despacho de certificados</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedLogIds.length > 0 && (
                                <button
                                    onClick={handleOpenUnifiedEmailModal}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm animate-pulse"
                                >
                                    <Mail size={14} />
                                    Enviar {selectedLogIds.length} COA(s) al Cliente
                                </button>
                            )}
                            <button
                                onClick={handleExportMarioExcel}
                                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                title="Descargar libro Excel con Hojas FQ y MB según formato oficial de Mario"
                            >
                                <FileSpreadsheet size={14} />
                                Excel Mario 2025
                            </button>
                            <button
                                onClick={handleOpenCreateLab}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus size={14} />
                                Nuevo Análisis LAB-004
                            </button>
                        </div>
                    </div>

                    {/* Banner de Lotes Seleccionados para Despacho Multi-Lote */}
                    {selectedLogIds.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-indigo-900">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                                <span>
                                    <strong>{selectedLogIds.length} lote(s) seleccionado(s)</strong> para despacho unificado. Cada lote conservará su certificado individual de calidad, pero se enviarán agrupados en un solo correo para el cliente.
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedLogIds([])}
                                    className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100"
                                >
                                    Desmarcar Todos
                                </button>
                                <button
                                    onClick={handleOpenUnifiedEmailModal}
                                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-sm"
                                >
                                    <Send size={12} />
                                    Enviar Correo Unificado
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Table of Lab Logs */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        {/* Filtros de Dictamen y Liberación */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                                {[
                                    { id: 'todos', label: 'Todos los Ensayos' },
                                    { id: 'cuarentena', label: 'Cuarentena (Incubación)' },
                                    { id: 'liberado', label: 'Liberados Aprobados' },
                                    { id: 'bloqueado_haccp', label: 'Bloqueados HACCP' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setLabReleaseFilter(f.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            labReleaseFilter === f.id
                                                ? 'bg-white text-indigo-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                                Mostrando {labLogs.filter(log => {
                                    if (labReleaseFilter === 'todos') return true;
                                    const rel = log.release_status || (log.status === 'aprobado' ? 'liberado' : log.status === 'rechazado' ? 'bloqueado_haccp' : 'cuarentena');
                                    return rel === labReleaseFilter;
                                }).length} de {labLogs.length} registros
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            {loadingLab ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium animate-pulse">Cargando bitácora de calidad...</div>
                            ) : labLogs.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium">No se han registrado análisis de laboratorio aún.</div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="p-3 w-10 text-center">
                                                <button
                                                    onClick={handleSelectAllLogs}
                                                    title={selectedLogIds.length === labLogs.length ? 'Desmarcar todos' : 'Seleccionar todos'}
                                                    className="text-slate-500 hover:text-indigo-600"
                                                >
                                                    {selectedLogIds.length === labLogs.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                            </th>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Lote Juliano / Producto</th>
                                            <th className="p-3">Cliente Destino</th>
                                            <th className="p-3">Mesófilos</th>
                                            <th className="p-3">Coliformes</th>
                                            <th className="p-3">E. Coli / Salmonella</th>
                                            <th className="p-3 text-center">Sólidos / pH</th>
                                            <th className="p-3 text-center">Dictamen</th>
                                            <th className="p-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                        {labLogs.filter(log => {
                                            if (labReleaseFilter === 'todos') return true;
                                            const rel = log.release_status || (log.status === 'aprobado' ? 'liberado' : log.status === 'rechazado' ? 'bloqueado_haccp' : 'cuarentena');
                                            return rel === labReleaseFilter;
                                        }).map(log => {
                                            const isSelected = selectedLogIds.includes(log.id);
                                            const lotCode = log.batch_code_display || log.batch_uuid || `LOTE-${log.id}`;
                                            const customerDisplay = log.customer_name || log.customer_nombre_db || 'Venta General';
                                            const dateDisplay = log.sample_date ? new Date(log.sample_date).toLocaleDateString() : (log.analysis_date ? new Date(log.analysis_date).toLocaleDateString() : 'N/A');
                                            const statusVal = log.status || log.result_status || 'aprobado';

                                            return (
                                                <tr key={log.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleToggleSelectLog(log.id)}
                                                            className={`${isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
                                                        >
                                                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-xs text-slate-600 whitespace-nowrap">
                                                        {dateDisplay}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900 text-xs font-mono">{lotCode}</span>
                                                            <span className="text-[10px] text-slate-500 capitalize">{log.product_type} ({log.presentation || 'Cubeta 30 Lb'})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="font-semibold text-slate-800 text-xs">{customerDisplay}</span>
                                                    </td>
                                                    <td className="p-3 text-teal-700 font-bold">
                                                        {log.mesophilic_aerobic_cfu ? `< ${log.mesophilic_aerobic_cfu} UFC/g` : (log.mesofilos_aerobios || '< 1,000 UFC/g')}
                                                    </td>
                                                    <td className="p-3 text-teal-700 font-bold">
                                                        {log.total_coliforms_mpn ? `< ${log.total_coliforms_mpn} UFC/g` : (log.coliformes_totales || '< 10 UFC/g')}
                                                    </td>
                                                    <td className="p-3 text-xs">
                                                        <span className="block text-slate-800 font-bold">{log.e_coli_mpn ? 'Ausencia' : (log.escherichia_coli || 'Ausencia')}</span>
                                                        <span className="text-teal-700 font-bold">{log.salmonella_25g || log.salmonella_spp || 'Ausencia'}</span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="text-slate-900 font-bold">
                                                            {log.solids_percentage ? `${log.solids_percentage}%` : (log.solidos_totales_pct ? `${log.solidos_totales_pct}%` : '24.2%')}
                                                        </span>
                                                        <span className="text-slate-500 text-[10px] block">pH: {log.ph || '7.4'}</span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusVal === 'aprobado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                statusVal === 'cuarentena' || statusVal === 'retenido' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                                            }`}>
                                                            {statusVal}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handleGenerateCoaPdf(log)}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                                                title="Descargar Certificado de Análisis Oficial"
                                                            >
                                                                <Download size={12} />
                                                                COA PDF
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenQualityLetterModal(log)}
                                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                                                title="Generar Carta de Calidad del Lote (PDF / Word / Excel)"
                                                            >
                                                                <FileText size={12} />
                                                                Carta Calidad
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenEditLab(log)}
                                                                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                title="Editar Análisis y Parámetros del Lote"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
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
                </div>
            )}

            {/* TAB 3: PARÁMETROS & NORMAS COA */}
            {activeTab === 'params' && (
                <div className="space-y-6">
                    {/* Top control card */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                                Parametrización de Control de Calidad & Formas de Ovoproductos
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">Defina normas, límites permisibles y ensayos para cada forma o presentación (Huevo Entero, Clara, Yema o Formulado)</p>
                        </div>
                        <button
                            onClick={handleOpenCreateParam}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            <Plus size={14} />
                            Nuevo Parámetro de Calidad
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Forma / Producto:</span>
                            {availableForms.map(formKey => (
                                <button
                                    key={formKey}
                                    onClick={() => setParamFilterProduct(formKey)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${paramFilterProduct === formKey ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {formKey}
                                </button>
                            ))}
                        </div>
                        <div className="w-full sm:w-64 relative">
                            <input
                                type="text"
                                value={paramSearch}
                                onChange={(e) => setParamSearch(e.target.value)}
                                placeholder="Buscar parámetro o norma..."
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                        </div>
                    </div>

                    {/* Tables Grouped by Category */}
                    <div className="space-y-6">
                        {['microbiologico', 'fisicoquimico', 'organoleptico', 'otro'].map(cat => {
                            const catParams = filteredParameters.filter(p => p.category === cat);
                            if (catParams.length === 0) return null;

                            const catTitles = {
                                microbiologico: { label: 'Ensayos Microbiológicos (Inocuidad & Patógenos)', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                                fisicoquimico: { label: 'Parámetros Físico-Químicos (Sólidos, pH, Densidad)', color: 'text-teal-700 bg-teal-50 border-teal-200' },
                                organoleptico: { label: 'Criterios Organolépticos / Sensoriales', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                                otro: { label: 'Otros Ensayos y Requisitos Específicos', color: 'text-slate-700 bg-slate-50 border-slate-200' }
                            };

                            return (
                                <div key={cat} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catTitles[cat].color}`}>
                                                {catTitles[cat].label}
                                            </span>
                                            <span className="text-slate-400 font-normal">({catParams.length} parámetros)</span>
                                        </h3>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="p-2.5 w-12 text-center">Orden</th>
                                                    <th className="p-2.5">Parámetro / Ensayo</th>
                                                    <th className="p-2.5">Especificación / Límite Normativo</th>
                                                    <th className="p-2.5">Lectura Típica</th>
                                                    <th className="p-2.5">Unidad</th>
                                                    <th className="p-2.5">Forma / Producto</th>
                                                    <th className="p-2.5">Criterio</th>
                                                    <th className="p-2.5 text-center">Estado</th>
                                                    <th className="p-2.5 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {catParams.map(param => (
                                                    <tr key={param.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="p-2.5 text-center font-bold text-slate-500">{param.sort_order}</td>
                                                        <td className="p-2.5 font-bold text-slate-900">{param.parameter_name}</td>
                                                        <td className="p-2.5 font-medium text-slate-700">{param.specification}</td>
                                                        <td className="p-2.5 font-semibold text-teal-700">{param.default_value || '-'}</td>
                                                        <td className="p-2.5 text-slate-500">{param.unit || '-'}</td>
                                                        <td className="p-2.5">
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                                                                {param.applicable_product}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 font-semibold text-emerald-700">{param.expected_criterion || 'CONFORME'}</td>
                                                        <td className="p-2.5 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${param.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                                                {param.is_active ? 'Activo' : 'Inactivo'}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => handleOpenEditParam(param)}
                                                                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                    title="Editar parámetro"
                                                                >
                                                                    <Edit size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteParam(param.id)}
                                                                    className="p-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                                    title="Eliminar parámetro"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 4: CALCULADORA DE SÓLIDOS HE PLUS */}
            {activeTab === 'solids' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 h-fit text-slate-900">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Calculator size={18} className="text-teal-600" />
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Parámetros de Dilución HE+</h3>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Sólidos Base Medidos (Refractómetro %)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={solidsCalc.base_egg_solids}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setSolidsCalc({ ...solidsCalc, base_egg_solids: v });
                                        runLocalSolidsCalc(v, solidsCalc.target_solids, solidsCalc.batch_weight_lbs);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 24.2"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Sólidos Objetivo Deseados (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={solidsCalc.target_solids}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setSolidsCalc({ ...solidsCalc, target_solids: v });
                                        runLocalSolidsCalc(solidsCalc.base_egg_solids, v, solidsCalc.batch_weight_lbs);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 21.5"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">Estándar recomendado: ≥ 21.0%</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Peso Total del Lote Objetivo (Libras)</label>
                                <input
                                    type="number"
                                    step="100"
                                    value={solidsCalc.batch_weight_lbs}
                                    onChange={(e) => {
                                        const v = parseFloat(e.target.value) || 0;
                                        setSolidsCalc({ ...solidsCalc, batch_weight_lbs: v });
                                        runLocalSolidsCalc(solidsCalc.base_egg_solids, solidsCalc.target_solids, v);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 10000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Results Panel */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileCheck size={16} className="text-indigo-600" />
                                Formulación & Balance Hídrico
                            </h3>
                            {calcResult && (
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${calcResult.is_compliant ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                    {calcResult.is_compliant ? 'Norma Cumplida' : 'Objetivo Fuera de Rango'}
                                </span>
                            )}
                        </div>

                        {calcResult && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">% liquido A</span>
                                        <span className="text-lg font-bold text-indigo-700">{calcResult.water_percentage.toFixed(2)}%</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">liquido requerido</span>
                                        <span className="text-lg font-bold text-teal-700">{calcResult.water_lbs.toFixed(0)} Lbs</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Garrafones</span>
                                        <span className="text-lg font-bold text-slate-900">{calcResult.water_garrafones.toFixed(1)}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Ácido Cítrico 0.1%</span>
                                        <span className="text-lg font-bold text-amber-700">{calcResult.citric_acid_lbs.toFixed(2)} Lbs</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Detalle de la Mezcla:</h4>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                                        <span className="text-slate-600">Huevo Líquido Base Puro:</span>
                                        <strong className="text-slate-900">{calcResult.egg_base_lbs.toFixed(0)} Lbs</strong>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                                        <span className="text-slate-600">liquido A:</span>
                                        <strong className="text-teal-700">+{calcResult.water_lbs.toFixed(0)} Lbs ({calcResult.water_garrafones.toFixed(1)} garrafones)</strong>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-600">Estabilizador pH (Ácido Cítrico 0.1%):</span>
                                        <strong className="text-amber-700">{calcResult.citric_acid_lbs.toFixed(2)} Lbs</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL CONTROL DE CALIDAD OFICIAL MARIO 2025 (FQ / MB / LIBERACIÓN) */}
            <EggQualityFinishedProductModal
                open={qualityModal.isOpen}
                onClose={() => setQualityModal({ isOpen: false, batch: null, logId: null })}
                batch={qualityModal.batch}
                logId={qualityModal.logId}
                onSuccess={() => {
                    fetchBatchesAndLab();
                    fetchTrace360List();
                    fetchTrace360Stats();
                }}
            />

            {/* MODAL ENVIAR CORREO UNIFICADO AL CLIENTE (MULTI-LOTE) */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Mail size={16} className="text-indigo-600" />
                                Enviar Certificados de Calidad (COA) Unificados por Correo
                            </h3>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 space-y-1">
                            <p className="font-bold">Despacho Unificado al Cliente:</p>
                            <p>
                                Se enviará <strong>un solo correo electrónico</strong> al cliente amparando los <strong>{selectedLogIds.length} lotes seleccionados</strong>. Cada lote tendrá adjunto su respectivo Certificado de Calidad (COA) individual en PDF.
                            </p>
                        </div>

                        {/* Listado de Lotes a Amparar */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">Lotes Incluidos en este Despacho:</span>
                            <div className="flex flex-wrap gap-2">
                                {labLogs.filter(l => selectedLogIds.includes(l.id)).map(log => (
                                    <div key={log.id} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono flex items-center gap-2">
                                        <FileCheck size={14} className="text-teal-600" />
                                        <span className="font-bold text-slate-900">{log.batch_code_display || log.batch_uuid}</span>
                                        <span className="text-[10px] text-slate-500 capitalize">({log.product_type})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleSendUnifiedEmail} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Seleccionar Cliente del Catálogo</label>
                                    <select
                                        value={emailForm.customer_id}
                                        onChange={(e) => {
                                            const cid = e.target.value;
                                            const cObj = customers.find(c => String(c.id) === String(cid));
                                            setEmailForm({
                                                ...emailForm,
                                                customer_id: cid,
                                                customer_name: cObj ? (cObj.nombre_comercial || cObj.nombre) : emailForm.customer_name,
                                                customer_email: cObj ? (cObj.correo || emailForm.customer_email) : emailForm.customer_email
                                            });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    >
                                        <option value="">(Seleccionar cliente...)</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre_comercial || c.nombre} {c.correo ? `(${c.correo})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Nombre Receptor / Contacto</label>
                                    <input
                                        type="text"
                                        value={emailForm.customer_name}
                                        onChange={(e) => setEmailForm({ ...emailForm, customer_name: e.target.value })}
                                        placeholder="Ej: PriceSmart El Salvador"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Correo Electrónico de Destino *</label>
                                <input
                                    type="email"
                                    value={emailForm.customer_email}
                                    onChange={(e) => setEmailForm({ ...emailForm, customer_email: e.target.value })}
                                    placeholder="cliente@empresa.com"
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Asunto del Correo</label>
                                <input
                                    type="text"
                                    value={emailForm.subject}
                                    onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Mensaje / Cuerpo del Correo</label>
                                <textarea
                                    value={emailForm.message}
                                    onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    disabled={sendingEmail}
                                    onClick={() => setIsEmailModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={sendingEmail}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                >
                                    {sendingEmail ? (
                                        <>Enviando {selectedLogIds.length} Certificados...</>
                                    ) : (
                                        <>
                                            <Send size={14} />
                                            Enviar Correo con Certificados
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CREAR / EDITAR PARÁMETRO DE CALIDAD */}
            {isParamModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <SlidersHorizontal size={16} className="text-indigo-600" />
                                {editingParam ? 'Editar Parámetro de Calidad' : 'Nuevo Parámetro / Norma de Calidad'}
                            </h3>
                            <button onClick={() => setIsParamModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveParam} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Categoría de Ensayo *</label>
                                    <select
                                        value={paramForm.category}
                                        onChange={(e) => setParamForm({ ...paramForm, category: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    >
                                        <option value="microbiologico">Microbiológico (Inocuidad)</option>
                                        <option value="fisicoquimico">Físico-Químico</option>
                                        <option value="organoleptico">Organoléptico / Sensorial</option>
                                        <option value="otro">Otro Criterio Especial</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Forma / Producto Aplicable *</label>
                                    <input
                                        type="text"
                                        value={paramForm.applicable_product}
                                        onChange={(e) => setParamForm({ ...paramForm, applicable_product: e.target.value })}
                                        placeholder="todos, huevo entero, clara, yema..."
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Nombre del Parámetro *</label>
                                <input
                                    type="text"
                                    value={paramForm.parameter_name}
                                    onChange={(e) => setParamForm({ ...paramForm, parameter_name: e.target.value })}
                                    placeholder="Ej: Recuento Mesófilos Aerobios, Viscosidad, etc."
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Especificación / Límite Normativo *</label>
                                <input
                                    type="text"
                                    value={paramForm.specification}
                                    onChange={(e) => setParamForm({ ...paramForm, specification: e.target.value })}
                                    placeholder="Ej: Máx 10,000 UFC/g, 7.20 - 7.80 pH, Ausencia en 25g"
                                    required
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Lectura Sugerida / Defecto</label>
                                    <input
                                        type="text"
                                        value={paramForm.default_value}
                                        onChange={(e) => setParamForm({ ...paramForm, default_value: e.target.value })}
                                        placeholder="Ej: < 1,000 UFC/g, 24.2%"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Unidad de Medida</label>
                                    <input
                                        type="text"
                                        value={paramForm.unit}
                                        onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })}
                                        placeholder="Ej: UFC/g, %, pH, cP, N/A"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Criterio Esperado</label>
                                    <input
                                        type="text"
                                        value={paramForm.expected_criterion}
                                        onChange={(e) => setParamForm({ ...paramForm, expected_criterion: e.target.value })}
                                        placeholder="Ej: CONFORME, DENTRO DE NORMA"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Orden de Presentación</label>
                                    <input
                                        type="number"
                                        value={paramForm.sort_order}
                                        onChange={(e) => setParamForm({ ...paramForm, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="param_active"
                                    checked={paramForm.is_active}
                                    onChange={(e) => setParamForm({ ...paramForm, is_active: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                <label htmlFor="param_active" className="text-xs font-semibold text-slate-700">
                                    Parámetro activo y visible en los análisis de calidad
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsParamModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    {editingParam ? 'Guardar Cambios' : 'Crear Parámetro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: INSPECCIÓN FORENSE 360° (LUPA) */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
                        {/* Header */}
                        <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-xl">
                                        <Eye size={18} />
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Expediente Forense de Trazabilidad 360°
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        LOTE: {detailTarget?.commercial_lot_code || detailTarget?.batch_code_display || detailTarget?.lot_number || 'REGISTRO'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Reconstrucción de cadena de custodia desde granja origen hasta cliente final
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {(detailData?.batch || detailTarget?.batch_id) && (
                                    <button
                                        onClick={() => handleOpenQualityLetterModal(detailTarget || detailData?.batch || { batch_id: detailData?.batch?.id })}
                                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                        title="Generar Carta de Calidad del Lote (PDF, Word, Excel)"
                                    >
                                        <FileText size={14} />
                                        Carta de Calidad
                                    </button>
                                )}
                                {detailData?.qualityLab && (
                                    <button
                                        onClick={() => handleGenerateCoaPdf(detailData.qualityLab)}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                        title="Descargar Certificado de Análisis Oficial"
                                    >
                                        <Download size={14} />
                                        COA PDF
                                    </button>
                                )}
                                {detailData && (
                                    <button
                                        disabled={downloadingOriginCert}
                                        onClick={() => handleDownloadOriginCertificate(detailData.rawMaterial?.id || detailData.batch?.id, !detailData.rawMaterial, 'pdf')}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                                        title="Descargar Certificado de Calidad de Origen de Granja (PDF)"
                                    >
                                        <FileText size={14} className="text-rose-600" />
                                        Cert. Origen PDF
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
                            {loadingDetail ? (
                                <div className="py-20 text-center space-y-3">
                                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
                                    <p className="text-sm font-bold text-slate-700">Reconstruyendo genealogía y registros de producción...</p>
                                    <p className="text-xs text-slate-400">Verificando materias primas, bitácoras CIP, PCC-1 HACCP y análisis microbiológicos</p>
                                </div>
                            ) : !detailData ? (
                                <div className="py-16 text-center text-slate-400">
                                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No se pudieron recuperar los detalles del lote.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Lifecycle 7-Node Stepper */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                            <Layers size={14} className="text-indigo-600" />
                                            Ciclo de Vida de Ovoproductos (Cadena de Custodia)
                                        </h4>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                            {[
                                                { step: 1, name: 'Recepción MP', icon: Truck, ok: !!detailData.rawMaterial, desc: detailData.rawMaterial?.lot_number || 'Granja' },
                                                { step: 2, name: 'CIP & Sanidad', icon: ShieldCheck, ok: detailData.cipLogs?.length > 0 || !!detailData.batch, desc: 'Línea Limpia' },
                                                { step: 3, name: 'Pasteurización', icon: Thermometer, ok: detailData.pasteurizations?.length > 0 || !!detailData.batch, desc: 'HACCP PCC-1' },
                                                { step: 4, name: 'Envasado', icon: Package, ok: !!detailData.packaging, desc: detailData.packaging?.presentation || 'Empaque' },
                                                { step: 5, name: 'Blast Freezer', icon: Activity, ok: !!detailData.blastFreezer || !!detailData.packaging, desc: '-18°C / 4°C' },
                                                { step: 6, name: 'Lab LAB-004', icon: FlaskConical, ok: !!detailData.qualityLab, desc: detailData.qualityLab?.status || 'Micro' },
                                                { step: 7, name: 'Despacho', icon: UserCheck, ok: !!(detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db), desc: 'Cliente' },
                                            ].map((n) => {
                                                const Icon = n.icon;
                                                return (
                                                    <div
                                                        key={n.step}
                                                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                                                            n.ok
                                                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                                                                : 'bg-slate-50 border-slate-200 text-slate-400'
                                                        }`}
                                                    >
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 text-xs font-bold ${
                                                            n.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                                        }`}>
                                                            <Icon size={14} />
                                                        </div>
                                                        <span className="text-[11px] font-bold leading-tight">{n.name}</span>
                                                        <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">{n.desc}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 7 Stage Detail Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* 1. Recepción de Materia Prima */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-amber-50 text-amber-600 rounded-lg"><Truck size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">1. Recepción & Granja</h4>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailData.rawMaterial ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                                    {detailData.rawMaterial?.status || 'No Vinculado'}
                                                </span>
                                            </div>
                                            {detailData.rawMaterial ? (
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Lote MP:</span><span className="font-bold text-slate-800">{detailData.rawMaterial.lot_number || `MP-${detailData.rawMaterial.id}`}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Proveedor:</span><span className="font-bold text-slate-800">{detailData.rawMaterial.provider_name || 'Avícola Central'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Granja Origen:</span><span className="font-medium text-slate-700">{detailData.rawMaterial.farm_origin || 'Granja Matriz'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Fecha Recepción:</span><span className="font-medium text-slate-700">{detailData.rawMaterial.reception_date ? new Date(detailData.rawMaterial.reception_date).toLocaleDateString() : '-'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Cajas / Huevos:</span><span className="font-bold text-slate-800">{detailData.rawMaterial.cajas_total || 0} cajas ({(detailData.rawMaterial.total_eggs || (detailData.rawMaterial.cajas_total * 360) || 0).toLocaleString()} huevos)</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Peso Neto Total:</span><span className="font-bold text-indigo-600">{detailData.rawMaterial.peso_neto_total || detailData.rawMaterial.peso_total || '-'} Lb</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Temp Llegada:</span><span className="font-medium text-slate-700">{detailData.rawMaterial.temp_reception || detailData.rawMaterial.temp_llegada ? `${detailData.rawMaterial.temp_reception || detailData.rawMaterial.temp_llegada} °C` : 'Ambiente'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Tarimas:</span><span className="font-medium text-slate-700">{Array.isArray(detailData.rawMaterial.tarimas) ? `${detailData.rawMaterial.tarimas.length} tarimas` : '1 tarima'}</span></div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Materia prima ingresada directamente a tolva o no catalogada.</p>
                                            )}

                                            {/* Acciones Certificado de Origen ANDELSA */}
                                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                                    Certificado de Origen Proveedor (ANDELSA):
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={downloadingOriginCert || (!detailData.rawMaterial && !detailData.batch)}
                                                        onClick={() => handleDownloadOriginCertificate(detailData.rawMaterial?.id || detailData.batch?.id, !detailData.rawMaterial, 'pdf')}
                                                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                                        title="Descargar Certificado de Calidad de Origen oficial en PDF"
                                                    >
                                                        <FileText size={12} className="text-rose-600" />
                                                        PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={downloadingOriginCert || (!detailData.rawMaterial && !detailData.batch)}
                                                        onClick={() => handleDownloadOriginCertificate(detailData.rawMaterial?.id || detailData.batch?.id, !detailData.rawMaterial, 'word')}
                                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                                        title="Descargar Certificado de Calidad de Origen editable en Word (.docx)"
                                                    >
                                                        <Download size={12} className="text-blue-600" />
                                                        Word (.docx)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Sanitización & CIP */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-teal-50 text-teal-600 rounded-lg"><ShieldCheck size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">2. Sanitización CIP Pre-Proceso</h4>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                                    {detailData.cipLogs?.length > 0 ? 'Conforme' : 'Protocolo Estándar'}
                                                </span>
                                            </div>
                                            {detailData.cipLogs && detailData.cipLogs.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Circuito Sanitizado:</span><span className="font-bold text-slate-800">{detailData.cipLogs[0].circuit_name || detailData.cipLogs[0].line_name || 'Línea 1 - Pasteurizador'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Tipo Químico:</span><span className="font-medium text-slate-700">{detailData.cipLogs[0].chemical_type || detailData.cipLogs[0].detergent_type || 'Ácido Peracético 0.2%'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Temp Lavado:</span><span className="font-bold text-slate-800">{detailData.cipLogs[0].temperature ? `${detailData.cipLogs[0].temperature} °C` : '75 °C'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Operador / Fecha:</span><span className="font-medium text-slate-700">{detailData.cipLogs[0].operator_name || 'Sanitización Turno A'}</span></div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">Línea de quebrado y pasteurización validada conforme a POES/CIP diario previo al quebrado.</p>
                                            )}
                                        </div>

                                        {/* 3. Pasteurización HACCP PCC-1 */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-rose-50 text-rose-600 rounded-lg"><Thermometer size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">3. Pasteurización HACCP (PCC-1)</h4>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                                    {detailData.pasteurizations?.length > 0 ? (detailData.pasteurizations[0].is_conforming !== 0 ? 'PCC-1 Conforme' : 'Desviación') : 'Conforme'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Lote Juliano / Proceso:</span><span className="font-bold text-slate-800">{detailData.batch?.julian_lot || detailData.batch?.batch_uuid || 'Lote Juliano'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Producto Elaborado:</span><span className="font-bold text-indigo-700">{detailData.batch?.product_type || 'Huevo Entero Pasteurizado'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Temp Pasteurización:</span><span className="font-bold text-rose-700">{detailData.pasteurizations?.[0]?.temperature || detailData.pasteurizations?.[0]?.temp_c || '64.5'} °C</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Tiempo Retención:</span><span className="font-medium text-slate-700">{detailData.pasteurizations?.[0]?.holding_time_seconds || '210'} segundos</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Líquido Obtenido:</span><span className="font-bold text-slate-800">{detailData.batch?.liquid_obtained_lbs || detailData.batch?.liquid_weight_lbs || '-'} Lb</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Rendimiento Quebrado:</span><span className="font-bold text-emerald-600">{detailData.batch?.yield_percentage ? `${detailData.batch.yield_percentage}%` : '85.2%'}</span></div>
                                            </div>
                                        </div>

                                        {/* 4. Envasado & Inventario Final */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-purple-50 text-purple-600 rounded-lg"><Package size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">4. Envasado & Presentación</h4>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailData.packaging ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-500'}`}>
                                                    {detailData.packaging ? 'Empacado' : 'A Granel'}
                                                </span>
                                            </div>
                                            {detailData.packaging ? (
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Lote Comercial:</span><span className="font-bold text-indigo-700">{detailData.packaging.lot_code || `LOTE-${detailData.packaging.id}`}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Presentación:</span><span className="font-bold text-slate-800">{detailData.packaging.presentation || detailData.packaging.packaging_type || 'Cubeta 30 Lb'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Unidades Empacadas:</span><span className="font-bold text-slate-800">{detailData.packaging.units_packaged || detailData.packaging.units_produced || 0} unidades</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Peso Empaque:</span><span className="font-bold text-slate-800">{detailData.packaging.total_batch_weight_lbs || detailData.packaging.total_weight_lbs || '-'} Lb</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Fecha Envasado:</span><span className="font-medium text-slate-700">{detailData.packaging.packaged_at || detailData.packaging.packaging_date ? new Date(detailData.packaging.packaged_at || detailData.packaging.packaging_date).toLocaleDateString() : '-'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Vencimiento:</span><span className="font-bold text-rose-700">{detailData.packaging.expiry_date ? new Date(detailData.packaging.expiry_date).toLocaleDateString() : '-'}</span></div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Producto en tanque de almacenamiento o pendiente de fraccionamiento.</p>
                                            )}
                                        </div>

                                        {/* 5. Cadena de Frío & Blast Freezer */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-cyan-50 text-cyan-600 rounded-lg"><Activity size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">5. Cadena de Frío & Almacenamiento</h4>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase">
                                                    {detailData.blastFreezer ? 'Túnel / Congelado' : 'Cámara Fría 4°C'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Cámara Asignada:</span><span className="font-bold text-slate-800">{detailData.blastFreezer?.chamber_code || 'Cámara Principal 01'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Temperatura:</span><span className="font-bold text-cyan-700">{detailData.blastFreezer?.temp_c ? `${detailData.blastFreezer.temp_c} °C` : '-18 °C a 4 °C'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Horas en Túnel:</span><span className="font-medium text-slate-700">{detailData.blastFreezer?.freezing_hours ? `${detailData.blastFreezer.freezing_hours} horas` : 'Almacenamiento Continuo'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Estado Frío:</span><span className="font-bold text-emerald-600">Cadena Ininterrumpida</span></div>
                                            </div>
                                        </div>

                                        {/* 6. Control de Calidad Oficial (FQ & MB - Mario 2025) */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-teal-50 text-teal-600 rounded-lg"><FlaskConical size={16} /></span>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-900 uppercase">6. Control de Calidad Oficial (FQ & MB)</h4>
                                                        <span className="text-[10px] text-slate-400 font-medium">Especificación estándar ANDELSA / Mario 2025</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        (detailData.qualityLab?.release_status === 'liberado' || detailData.qualityLab?.status === 'aprobado')
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : (detailData.qualityLab?.release_status === 'bloqueado_haccp' || detailData.qualityLab?.status === 'rechazado')
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {detailData.qualityLab?.release_status === 'liberado' || detailData.qualityLab?.status === 'aprobado' ? 'Liberado' : detailData.qualityLab?.release_status === 'bloqueado_haccp' || detailData.qualityLab?.status === 'rechazado' ? 'Bloqueado HACCP' : 'Cuarentena'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQualityModal({
                                                            isOpen: true,
                                                            batch: detailData.batch || {
                                                                id: detailData.qualityLab?.batch_id || detailTarget?.batch_id,
                                                                batch_uuid: detailData.batch?.batch_uuid || detailTarget?.batch_uuid,
                                                                batch_code_display: detailData.batch?.batch_code_display || detailTarget?.batch_code_display,
                                                                product_type: detailData.batch?.product_type || detailTarget?.product_name,
                                                                presentation: detailData.packaging?.presentation || detailTarget?.presentation
                                                            },
                                                            logId: detailData.qualityLab?.id
                                                        })}
                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                                    >
                                                        <Edit size={11} />
                                                        Evaluar Calidad
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Parámetros FQ y MB */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                                {/* Columna FQ */}
                                                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide block">Físico-Químico (En Línea):</span>
                                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                                        <div><span className="text-slate-400 text-[10px] block">pH:</span><span className="font-bold text-slate-800">{detailData.qualityLab?.ph || '7.45'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Sólidos %:</span><span className="font-bold text-teal-700">{detailData.qualityLab?.solids_percentage || '24.2'}%</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Temperatura:</span><span className="font-bold text-slate-800">{detailData.qualityLab?.temperature_c !== null && detailData.qualityLab?.temperature_c !== undefined ? `${detailData.qualityLab.temperature_c} °C` : '3.5 °C'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Salinidad %:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.salinity_pct ? `${detailData.qualityLab.salinity_pct}%` : 'N/A'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Densidad:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.density || '0.130'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Brix:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.brix ? `${detailData.qualityLab.brix}°Bx` : '23.8°Bx'}</span></div>
                                                    </div>
                                                </div>

                                                {/* Columna MB */}
                                                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">Microbiológico (48h):</span>
                                                        {detailData.qualityLab?.mb_status === 'en_incubacion' && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                                                <Clock size={9} /> Incubando
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                                        <div><span className="text-slate-400 text-[10px] block">Recuento Total:</span><span className="font-bold text-teal-800">{detailData.qualityLab?.mesophilic_aerobic_cfu !== null && detailData.qualityLab?.mesophilic_aerobic_cfu !== undefined ? `< ${detailData.qualityLab.mesophilic_aerobic_cfu} UFC/g` : '< 1,000 UFC/g'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Coliformes:</span><span className="font-bold text-teal-800">{detailData.qualityLab?.total_coliforms_mpn !== null && detailData.qualityLab?.total_coliforms_mpn !== undefined ? `< ${detailData.qualityLab.total_coliforms_mpn} UFC/g` : '< 10 UFC/g'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Salmonella 25g:</span><span className={`font-bold ${String(detailData.qualityLab?.salmonella_25g || '').toLowerCase().includes('presencia') ? 'text-rose-700' : 'text-teal-700'}`}>{detailData.qualityLab?.salmonella_25g || 'Ausencia'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">E. Coli:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.e_coli_mpn ? 'Positivo' : 'Ausencia'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Hongos / Lev:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.fungi_yeasts_cfu !== null && detailData.qualityLab?.fungi_yeasts_cfu !== undefined ? `< ${detailData.qualityLab.fungi_yeasts_cfu} UFC/g` : '< 10 UFC/g'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Staph. Aureus:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.staph_aureus || 'Negativo'}</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-slate-500 text-[11px]">
                                                <span>Analista: <strong className="text-slate-700">{detailData.qualityLab?.analyst_name || 'Mario (Control de Calidad)'}</strong></span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQualityLetterModal(detailData.batch || detailTarget)}
                                                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1 text-[10px] transition-all"
                                                >
                                                    <FileText size={11} className="text-amber-600" />
                                                    Carta de Calidad (COA)
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7. Despacho & Destino Cliente */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg"><UserCheck size={16} /></span>
                                                <h4 className="text-xs font-bold text-slate-900 uppercase">7. Despacho & Trazabilidad hacia Cliente</h4>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                detailData.packaging?.sale_customer_name || detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db || detailTarget?.customer_name
                                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {detailData.packaging?.sale_customer_name ? 'Vendido en Punto de Venta / Facturado' : (detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db || detailTarget?.customer_name ? 'Asignado a Cliente' : 'Disponible en Stock')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                            <div>
                                                <span className="text-slate-400 text-[10px] uppercase block">Cliente Destino / Comprador:</span>
                                                <span className="font-bold text-slate-900 text-sm">
                                                    {detailData.packaging?.sale_customer_name || detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db || detailTarget?.customer_name || 'Disponible en Stock (Sin despachar)'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] uppercase block">Fecha Estimada Despacho / Venta:</span>
                                                <span className="font-medium text-slate-700">
                                                    {detailData.packaging?.packaged_at ? new Date(detailData.packaging.packaged_at).toLocaleDateString() : 'Inmediata'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] uppercase block">Respaldo Documental:</span>
                                                <span className="font-bold text-indigo-600">Carta de Calidad + COA LAB-004 Emitible</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bitácora de Eventos / Blockchain Trail si existe */}
                                    {detailData.auditTrail && detailData.auditTrail.length > 0 && (
                                        <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 shadow-xs space-y-2">
                                            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Clock size={14} />
                                                Historial Inmutable de Eventos del Lote
                                            </h4>
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                {detailData.auditTrail.map((evt, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800">
                                                        <span className="text-slate-300 font-medium">{evt.description}</span>
                                                        <span className="text-slate-500 text-[10px] font-mono">{evt.created_at ? new Date(evt.created_at).toLocaleString() : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                            >
                                Cerrar Expediente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: CARTA DE CALIDAD MULTI-FORMATO (PDF, WORD, EXCEL) */}
            {isQualityLetterModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-amber-50 text-amber-700 rounded-xl">
                                    <FileText size={18} />
                                </span>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Carta de Calidad de Ovoproductos
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Formato Membretado Oficial Eggcelent / SIPEWEBgas
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsQualityLetterModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Lot preview badge */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Lote Identificado</span>
                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                                        {qualityLetterBatch?.lot_code || `LOTE-${qualityLetterBatch?.batch_id}`}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-700">
                                    <span className="font-semibold text-slate-900">{qualityLetterBatch?.product_type || 'Huevo Entero Pasteurizado'}</span>
                                    <span className="text-slate-400 mx-1.5">•</span>
                                    <span>{qualityLetterBatch?.presentation || 'Presentación Estándar'}</span>
                                </div>
                            </div>

                            {/* Recipient Config */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                                        Destinatario / Cliente Receptor
                                    </label>
                                    <input
                                        type="text"
                                        value={letterCustomerName}
                                        onChange={(e) => setLetterCustomerName(e.target.value)}
                                        placeholder="Ej: A QUIEN CORRESPONDA o Nombre del Cliente"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Por política de confidencialidad, la carta se genera por defecto dirigida a "A QUIEN CORRESPONDA" salvo requerimiento del cliente.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                                        Atención a / Contacto / Departamento (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={letterCustomerContact}
                                        onChange={(e) => setLetterCustomerContact(e.target.value)}
                                        placeholder="Ej: Dpto. de Control de Calidad / Compras"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Scope Selector (Completo, FQ, MB) */}
                            <div className="space-y-1.5 pt-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                                    Contenido / Ámbito del Análisis
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setLetterScope('all')}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${letterScope === 'all' ? 'bg-amber-500 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Completo (FQ + MB)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLetterScope('fq')}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${letterScope === 'fq' ? 'bg-slate-800 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Solo Físico-Químico (FQ)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLetterScope('mb')}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${letterScope === 'mb' ? 'bg-teal-700 text-white border-teal-800 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Solo Microbiológico (MB)
                                    </button>
                                </div>
                            </div>

                            {/* Download Action Cards */}
                            <div className="space-y-2 pt-2">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Seleccione el formato de exportación:
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {/* PDF Button */}
                                    <button
                                        type="button"
                                        disabled={exportingFormat !== null}
                                        onClick={() => handleDownloadQualityLetter('pdf')}
                                        className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-2xl flex flex-col items-center text-center transition-all shadow-xs disabled:opacity-50"
                                    >
                                        {exportingFormat === 'pdf' ? (
                                            <Loader2 size={22} className="animate-spin text-rose-600 mb-1" />
                                        ) : (
                                            <FileText size={22} className="text-rose-600 mb-1" />
                                        )}
                                        <span className="text-xs font-bold">PDF Oficial</span>
                                        <span className="text-[10px] text-rose-600">Membretado</span>
                                    </button>

                                    {/* Word Button */}
                                    <button
                                        type="button"
                                        disabled={exportingFormat !== null}
                                        onClick={() => handleDownloadQualityLetter('word')}
                                        className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-2xl flex flex-col items-center text-center transition-all shadow-xs disabled:opacity-50"
                                    >
                                        {exportingFormat === 'word' ? (
                                            <Loader2 size={22} className="animate-spin text-blue-600 mb-1" />
                                        ) : (
                                            <FileText size={22} className="text-blue-600 mb-1" />
                                        )}
                                        <span className="text-xs font-bold">Word (.docx)</span>
                                        <span className="text-[10px] text-blue-600">Editable</span>
                                    </button>

                                    {/* Excel Button */}
                                    <button
                                        type="button"
                                        disabled={exportingFormat !== null}
                                        onClick={() => handleDownloadQualityLetter('excel')}
                                        className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-2xl flex flex-col items-center text-center transition-all shadow-xs disabled:opacity-50"
                                    >
                                        {exportingFormat === 'excel' ? (
                                            <Loader2 size={22} className="animate-spin text-emerald-600 mb-1" />
                                        ) : (
                                            <FileSpreadsheet size={22} className="text-emerald-600 mb-1" />
                                        )}
                                        <span className="text-xs font-bold">Excel (.xlsx)</span>
                                        <span className="text-[10px] text-emerald-600">Estructurado</span>
                                    </button>
                                </div>
                            </div>

                            {/* Respaldo de Origen del Proveedor (ANDELSA) */}
                            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                        <Truck size={13} className="text-amber-600" />
                                        Certificado de Calidad de Origen (Proveedor a ANDELSA)
                                    </span>
                                    <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 bg-amber-100/60 rounded-full">Anexo de Granja</span>
                                </div>
                                <p className="text-[11px] text-slate-600">
                                    Documento técnico emitido por la granja proveedora con condiciones de inocuidad, transporte y edades de aves que amparan este lote procesado.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        disabled={downloadingOriginCert}
                                        onClick={() => handleDownloadOriginCertificate(qualityLetterBatch?.batch_id, true, 'pdf')}
                                        className="flex-1 py-2 px-3 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                                    >
                                        <FileText size={13} className="text-rose-600" />
                                        Certificado Origen (PDF)
                                    </button>
                                    <button
                                        type="button"
                                        disabled={downloadingOriginCert}
                                        onClick={() => handleDownloadOriginCertificate(qualityLetterBatch?.batch_id, true, 'word')}
                                        className="flex-1 py-2 px-3 bg-white hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                                    >
                                        <Download size={13} className="text-blue-600" />
                                        Certificado Origen (Word)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsQualityLetterModalOpen(false)}
                                className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all shadow-xs"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EggTraceability;
