import { unwrapList } from '../../../utils/apiUtils';
import { formatDate } from '../../../utils/dateUtils';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';



export default function useTraceabilityModel() {
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
            setTrace360List(unwrapList(res));
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
            setTraceStats(res.data?.raw_materials && res.data?.production && res.data?.packaging && res.data?.alerts ? res.data : null);
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
            const emissionDate = log.sample_date ? formatDate(log.sample_date) : (log.analysis_date ? formatDate(log.analysis_date) : formatDate(new Date()));
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


 return { activeTab, setActiveTab, trace360List, setTrace360List, trace360Total, setTrace360Total, trace360Page, setTrace360Page, trace360TotalPages, setTrace360TotalPages, trace360Limit, traceStats, setTraceStats, trace360Search, setTrace360Search, debouncedTraceSearch, setDebouncedTraceSearch, trace360Stage, setTrace360Stage, traceStartDate, setTraceStartDate, traceEndDate, setTraceEndDate, loadingTrace360, setLoadingTrace360, isDetailModalOpen, setIsDetailModalOpen, detailTarget, setDetailTarget, detailData, setDetailData, loadingDetail, setLoadingDetail, isQualityLetterModalOpen, setIsQualityLetterModalOpen, qualityLetterBatch, setQualityLetterBatch, letterCustomerName, setLetterCustomerName, letterCustomerContact, setLetterCustomerContact, letterScope, setLetterScope, exportingFormat, setExportingFormat, companyInfo, setCompanyInfo, customers, setCustomers, qualityParameters, setQualityParameters, _loadingParams, setLoadingParams, labLogs, setLabLogs, loadingLab, setLoadingLab, batches, setBatches, qualityModal, setQualityModal, labReleaseFilter, setLabReleaseFilter, selectedLogIds, setSelectedLogIds, isEmailModalOpen, setIsEmailModalOpen, sendingEmail, setSendingEmail, emailForm, setEmailForm, paramFilterProduct, setParamFilterProduct, paramSearch, setParamSearch, isParamModalOpen, setIsParamModalOpen, editingParam, setEditingParam, paramForm, setParamForm, solidsCalc, setSolidsCalc, calcResult, setCalcResult, fetchBatchesAndLab, fetchQualityParameters, fetchCompanyAndCustomers, runLocalSolidsCalc, fetchTrace360List, fetchTrace360Stats, handleOpenInspection, handleOpenQualityLetterModal, handleDownloadQualityLetter, downloadingOriginCert, setDownloadingOriginCert, handleDownloadOriginCertificate, handleOpenCreateLab, handleOpenEditLab, handleExportMarioExcel, handleGenerateCoaPdf, handleToggleSelectLog, handleSelectAllLogs, handleOpenUnifiedEmailModal, handleSendUnifiedEmail, handleOpenCreateParam, handleOpenEditParam, handleSaveParam, handleDeleteParam, filteredParameters, availableForms };
}
