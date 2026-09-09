import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Search,
    ClipboardList,
    ShieldCheck,
    Building2,
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
    Square
} from 'lucide-react';

const EggTraceability = () => {
    const [activeTab, setActiveTab] = useState('trace'); // 'trace', 'lab', 'solids', 'params'

    // Traceability States
    const [searchCode, setSearchCode] = useState('');
    const [loadingTrace, setLoadingTrace] = useState(false);
    const [traceData, setTraceData] = useState(null);

    // Company & Catalogs States
    const [companyInfo, setCompanyInfo] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [qualityParameters, setQualityParameters] = useState([]);
    const [_loadingParams, setLoadingParams] = useState(false);

    // Lab LAB-004 States
    const [labLogs, setLabLogs] = useState([]);
    const [loadingLab, setLoadingLab] = useState(false);
    const [batches, setBatches] = useState([]);
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
                axios.get('/api/customers?limit=200')
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

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchCode.trim()) {
            return toast.error('Debe ingresar un código de lote, UUID o código de barra.');
        }

        setLoadingTrace(true);
        setTraceData(null);
        try {
            const res = await axios.get(`/api/egg-industrial/trace/${searchCode.trim()}`);
            setTraceData(res.data);
            toast.success('Historial de trazabilidad 360° recuperado.');
        } catch (error) {
            console.error('Error fetching egg traceability details:', error);
            toast.error(error.response?.data?.message || 'No se encontraron registros para el código suministrado.');
        } finally {
            setLoadingTrace(false);
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

    // Abrir modal para crear nuevo análisis
    const handleOpenCreateLab = () => {
        setEditingLogId(null);
        setLabForm({
            ...initialLabForm,
            sample_date: new Date().toISOString().split('T')[0]
        });
        setIsLabModalOpen(true);
    };

    // Abrir modal para editar análisis existente
    const handleOpenEditLab = (log) => {
        setEditingLogId(log.id);

        // Reconstruir lecturas dinámicas desde log.custom_parameters si existen
        const dynamicReadings = {};
        const dynamicCriteria = {};

        if (Array.isArray(log.custom_parameters)) {
            log.custom_parameters.forEach(p => {
                if (p.parameter_id) {
                    dynamicReadings[p.parameter_id] = p.value;
                    dynamicCriteria[p.parameter_id] = p.criterion;
                }
            });
        }

        setLabForm({
            batch_id: String(log.batch_id),
            customer_id: log.customer_id ? String(log.customer_id) : '',
            customer_name: log.customer_name || log.customer_nombre_db || '',
            presentation: log.presentation || 'Cubeta 30 Lb',
            sample_date: log.sample_date ? new Date(log.sample_date).toISOString().split('T')[0] : (log.analysis_date ? new Date(log.analysis_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            status: log.status || log.result_status || 'aprobado',
            analyst_name: log.analyst_name || 'Mario (Control de Calidad)',
            observations: log.observations || log.notes || '',
            dynamicReadings,
            dynamicCriteria
        });

        setIsLabModalOpen(true);
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
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'trace' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Search size={14} />
                        Trazabilidad de Lotes
                    </button>
                    <button
                        onClick={() => setActiveTab('lab')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'lab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FlaskConical size={14} />
                        Control de Calidad (LAB-004)
                    </button>
                    <button
                        onClick={() => setActiveTab('params')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'params' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <SlidersHorizontal size={14} />
                        Parámetros & Normas COA
                    </button>
                    <button
                        onClick={() => setActiveTab('solids')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                            activeTab === 'solids' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Calculator size={14} />
                        Calculadora de Sólidos HE+
                    </button>
                </div>
            </div>

            {/* TAB 1: TRAZABILIDAD */}
            {activeTab === 'trace' && (
                <div className="space-y-6">
                    {/* Search Input Bar Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 space-y-2">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">Código de Lote Comercial, Lote Juliano o Código de Barras</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchCode}
                                        onChange={(e) => setSearchCode(e.target.value)}
                                        placeholder="Ej: LOTE-260519-ENTERO, 01 - 245 - 26, e573a4b0..."
                                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    <Search className="absolute left-4 top-3 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loadingTrace}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                            >
                                {loadingTrace ? 'Buscando...' : 'Consultar Traza'}
                            </button>
                        </form>
                    </div>

                    {/* RENDER LIFECYCLE TIMELINE TREE */}
                    {traceData && (
                        <div className="space-y-8 relative">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Cadena de Proceso e Inocuidad Alimentaria</h2>
                            <div className="absolute left-1/2 top-12 bottom-12 w-0.5 bg-slate-200 transform -translate-x-1/2 hidden md:block" />

                            {/* Step 1: RAW MATERIAL INTAKE */}
                            <div className="relative flex flex-col md:flex-row md:justify-start items-center gap-6">
                                <div className="md:w-1/2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 z-10">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fase 01: Granja y Recepción</span>
                                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">Ingreso Aprobado</span>
                                    </div>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex gap-3">
                                            <Building2 className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-bold text-slate-900">{traceData.batch.provider_name}</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">Lote Proveedor: {traceData.batch.raw_provider_lot}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Materia Prima:</span>
                                                <span className="font-bold text-slate-900 capitalize">{traceData.batch.raw_egg_type}</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Temp Recepción:</span>
                                                <span className="font-bold text-teal-700">{traceData.batch.raw_temp}°C</span>
                                            </div>
                                            <div className="mt-1">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Peso Ingresado:</span>
                                                <span className="font-bold text-slate-900">{parseFloat(traceData.batch.raw_weight).toLocaleString()} Lbs</span>
                                            </div>
                                            <div className="mt-1">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Operador:</span>
                                                <span className="font-medium text-slate-700">{traceData.batch.raw_operator}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex shadow-xs">1</div>
                            </div>

                            {/* Step 2: CLEAN IN PLACE (CIP) */}
                            {traceData.cipLogs && traceData.cipLogs.length > 0 && (
                                <div className="relative flex flex-col md:flex-row md:justify-end items-center gap-6">
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex shadow-xs">2</div>
                                    <div className="md:w-1/2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 z-10">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fase 02: Habilitación de Planta</span>
                                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">Sanitización CIP OK</span>
                                        </div>
                                        <div className="space-y-3 text-xs">
                                            <p className="text-xs text-slate-600 font-medium">{traceData.cipLogs[0].notes || 'Limpieza y sanitización CIP completada de forma óptima.'}</p>
                                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <div>
                                                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Equipo:</span>
                                                    <span className="font-bold text-slate-900 capitalize">{traceData.cipLogs[0].equipment_name}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Sanitizante:</span>
                                                    <span className="font-bold text-slate-900">{traceData.cipLogs[0].chemical_used}</span>
                                                </div>
                                                <div className="mt-1">
                                                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Temp de Lavado:</span>
                                                    <span className="font-bold text-slate-900">{traceData.cipLogs[0].temperature_c}°C</span>
                                                </div>
                                                <div className="mt-1">
                                                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Duración:</span>
                                                    <span className="font-bold text-slate-900">{traceData.cipLogs[0].duration_minutes} Minutos</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: BATCH PROCESSING */}
                            <div className="relative flex flex-col md:flex-row md:justify-start items-center gap-6">
                                <div className="md:w-1/2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 z-10">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fase 03: Quebrado y Balance de Masas</span>
                                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">Balance Completo</span>
                                    </div>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex gap-3">
                                            <ClipboardList className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-bold text-slate-900 capitalize">{traceData.batch.product_type} ({traceData.batch.presentation})</h4>
                                                <span className="text-xs font-bold font-mono text-indigo-600 block">Lote: {traceData.batch.batch_code_display || traceData.batch.batch_uuid}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Peso Entrada:</span>
                                                <span className="font-bold text-slate-900">{parseFloat(traceData.batch.input_weight_lbs).toLocaleString()} Lbs</span>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Rendimiento Líquido:</span>
                                                <span className="font-bold text-teal-700">{parseFloat(traceData.batch.yield_liquid_lbs).toLocaleString()} Lbs</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex shadow-xs">3</div>
                            </div>
                        </div>
                    )}
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
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
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
                                        {labLogs.map(log => {
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
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                            statusVal === 'aprobado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
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
                                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                                        paramFilterProduct === formKey ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                    calcResult.is_compliant ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                    {calcResult.is_compliant ? 'Norma Cumplida' : 'Objetivo Fuera de Rango'}
                                </span>
                            )}
                        </div>

                        {calcResult && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">% Agua a Agregar</span>
                                        <span className="text-lg font-bold text-indigo-700">{calcResult.water_percentage.toFixed(2)}%</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Agua Requerida</span>
                                        <span className="text-lg font-bold text-teal-700">{calcResult.water_lbs.toFixed(0)} Lbs</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Garrafones (42 Lbs)</span>
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
                                        <span className="text-slate-600">Agua Purificada:</span>
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

            {/* MODAL REGISTRAR / EDITAR LAB-004 */}
            {isLabModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-5 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical size={16} className="text-teal-600" />
                                {editingLogId ? 'Editar Análisis de Calidad LAB-004 & Parámetros' : 'Registrar Ensayo Microbiológico LAB-004'}
                            </h3>
                            <button onClick={() => setIsLabModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveLabLog} className="space-y-4">
                            {/* Metadata del Lote y Cliente */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Lote de Producción *</label>
                                    <select
                                        value={labForm.batch_id}
                                        onChange={(e) => setLabForm({ ...labForm, batch_id: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        required
                                    >
                                        <option value="">Seleccione Lote...</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation || 'Cubeta 30 Lb'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Fecha de Análisis</label>
                                    <input
                                        type="date"
                                        value={labForm.sample_date}
                                        onChange={(e) => setLabForm({ ...labForm, sample_date: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Cliente Destino / Receptor</label>
                                    <div className="flex gap-1.5">
                                        <select
                                            value={labForm.customer_id}
                                            onChange={(e) => {
                                                const cid = e.target.value;
                                                const cObj = customers.find(c => String(c.id) === String(cid));
                                                setLabForm({
                                                    ...labForm,
                                                    customer_id: cid,
                                                    customer_name: cObj ? (cObj.nombre_comercial || cObj.nombre) : labForm.customer_name
                                                });
                                            }}
                                            className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                        >
                                            <option value="">(Seleccionar cliente del catálogo...)</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.nombre_comercial || c.nombre}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="text"
                                            value={labForm.customer_name}
                                            onChange={(e) => setLabForm({ ...labForm, customer_name: e.target.value })}
                                            placeholder="Nombre cliente / Stock"
                                            className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Presentación Comercial</label>
                                    <input
                                        type="text"
                                        value={labForm.presentation}
                                        onChange={(e) => setLabForm({ ...labForm, presentation: e.target.value })}
                                        placeholder="Ej: Cubeta 30 Lb, Garrafa 40 Lb, A granel"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Ensayos y Parámetros Dinámicos según la Forma del Producto */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                        Ensayos & Parámetros de Calidad Aplicables ({activeProductParams.length} parámetros configurados)
                                    </span>
                                    <span className="text-[10px] text-indigo-600 font-medium">Valores sugeridos según norma oficial</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[36vh] overflow-y-auto pr-1">
                                    {activeProductParams.map(param => {
                                        const currentVal = labForm.dynamicReadings[param.id] !== undefined ? labForm.dynamicReadings[param.id] : (param.default_value || '');
                                        const currentCrit = labForm.dynamicCriteria[param.id] !== undefined ? labForm.dynamicCriteria[param.id] : (param.expected_criterion || 'CONFORME');

                                        return (
                                            <div key={param.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                                                <div className="flex justify-between items-start gap-1">
                                                    <span className="text-xs font-bold text-slate-900 block leading-tight">{param.parameter_name}</span>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                                                        {param.specification}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={currentVal}
                                                        onChange={(e) => {
                                                            setLabForm({
                                                                ...labForm,
                                                                dynamicReadings: {
                                                                    ...labForm.dynamicReadings,
                                                                    [param.id]: e.target.value
                                                                }
                                                            });
                                                        }}
                                                        placeholder={`Ej: ${param.default_value || 'Conforme'}`}
                                                        className="w-2/3 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    <select
                                                        value={currentCrit}
                                                        onChange={(e) => {
                                                            setLabForm({
                                                                ...labForm,
                                                                dynamicCriteria: {
                                                                    ...labForm.dynamicCriteria,
                                                                    [param.id]: e.target.value
                                                                }
                                                            });
                                                        }}
                                                        className="w-1/3 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-700"
                                                    >
                                                        <option value="CONFORME">CONFORME</option>
                                                        <option value="DENTRO DE NORMA">EN NORMA</option>
                                                        <option value="NO CONFORME">NO CONFORME</option>
                                                        <option value="FUERA DE NORMA">FUERA NORMA</option>
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Dictamen y Responsables */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Dictamen de Calidad</label>
                                    <select
                                        value={labForm.status}
                                        onChange={(e) => setLabForm({ ...labForm, status: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        <option value="aprobado">Aprobado / Apto para Liberación</option>
                                        <option value="cuarentena">Retenido / Cuarentena Re-ensayo</option>
                                        <option value="rechazado">Rechazado (Bloqueo HACCP)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Analista Responsable</label>
                                    <input
                                        type="text"
                                        value={labForm.analyst_name}
                                        onChange={(e) => setLabForm({ ...labForm, analyst_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Observaciones / Notas de Liberación</label>
                                <textarea
                                    value={labForm.observations}
                                    onChange={(e) => setLabForm({ ...labForm, observations: e.target.value })}
                                    rows={2}
                                    placeholder="Observaciones analíticas o de despacho..."
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsLabModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    {editingLogId ? 'Actualizar Registro LAB-004' : 'Guardar Registro LAB-004'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
        </div>
    );
};

export default EggTraceability;
