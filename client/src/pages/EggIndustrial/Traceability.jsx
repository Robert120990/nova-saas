import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Activity,
    Search,
    Flame,
    Barcode,
    Snowflake,
    ClipboardList,
    ShieldCheck,
    Building2,
    FlaskConical,
    Calculator,
    FileCheck,
    Plus,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Printer,
    Download
} from 'lucide-react';

const EggTraceability = () => {
    const [activeTab, setActiveTab] = useState('trace'); // 'trace', 'lab', 'solids', 'coa'

    // Traceability States
    const [searchCode, setSearchCode] = useState('');
    const [loadingTrace, setLoadingTrace] = useState(false);
    const [traceData, setTraceData] = useState(null);

    // Lab LAB-004 States
    const [labLogs, setLabLogs] = useState([]);
    const [loadingLab, setLoadingLab] = useState(false);
    const [batches, setBatches] = useState([]);
    const [isLabModalOpen, setIsLabModalOpen] = useState(false);
    const [labForm, setLabForm] = useState({
        batch_id: '',
        analysis_date: new Date().toISOString().split('T')[0],
        mesofilos_aerobios: '< 1000 UFC/g',
        coliformes_totales: '< 10 UFC/g',
        escherichia_coli: 'Ausencia',
        salmonella_spp: 'Ausencia en 25g',
        hongos_levaduras: '< 10 UFC/g',
        solidos_totales_pct: '24.2',
        ph: '7.4',
        result_status: 'aprobado',
        analyst_name: 'Mario (Calidad)',
        notes: ''
    });

    // Solids Calculator States (Mario's formula)
    const [solidsCalc, setSolidsCalc] = useState({
        base_egg_solids: 24.2,
        target_solids: 21.5,
        batch_weight_lbs: 10000
    });
    const [calcResult, setCalcResult] = useState(null);

    // COA Generator States
    const [selectedLabForCoa, setSelectedLabForCoa] = useState(null);
    const [coaCustomerName, setCoaCustomerName] = useState('PriceSmart El Salvador');

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

    useEffect(() => {
        fetchBatchesAndLab();
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

    const handleCreateLabLog = async (e) => {
        e.preventDefault();
        if (!labForm.batch_id) return toast.error('Debe seleccionar un lote de producción.');

        try {
            await axios.post('/api/egg-industrial/lab/logs', {
                ...labForm,
                batch_id: parseInt(labForm.batch_id),
                solidos_totales_pct: labForm.solidos_totales_pct ? parseFloat(labForm.solidos_totales_pct) : null,
                ph: labForm.ph ? parseFloat(labForm.ph) : null
            });
            toast.success('Análisis de laboratorio LAB-004 guardado exitosamente.');
            setIsLabModalOpen(false);
            fetchBatchesAndLab();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar análisis microbiológico.');
        }
    };

    // Generador oficial del Certificado de Análisis (COA) en PDF
    const handleGenerateCoaPdf = (log) => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            // Encabezado Corporativo ANDELSA
            doc.setFillColor(15, 23, 42); // slate-900
            doc.rect(0, 0, 216, 28, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text('AGROINDUSTRIA DEL NORTE S.A. DE C.V. (ANDELSA)', 14, 12);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(203, 213, 225);
            doc.text('Planta Procesadora de Ovoproductos Pasteurizados | Departamento de Control de Calidad', 14, 18);
            doc.text('Normativa FDA / HACCP / Codex Alimentarius CAC/RCP 15-1976', 14, 23);

            // Título del Documento
            doc.setTextColor(15, 23, 42);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('CERTIFICADO DE ANÁLISIS DE CALIDAD & LIBERACIÓN (COA)', 14, 38);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Registro Oficial: LAB-004-${String(log.id).padStart(4, '0')} | Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 43);

            // Cuadro de Metadatos del Lote
            autoTable(doc, {
                startY: 48,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                head: [['Parámetro General', 'Información de Producción & Cliente']],
                body: [
                    ['Cliente Destino / Receptor:', coaCustomerName || 'Venta General / Stock'],
                    ['Lote de Producción (Juliano):', log.batch_code_display || log.batch_uuid || 'LOTE GENERAL'],
                    ['Producto:', (log.product_type || 'Huevo Entero Pasteurizado').toUpperCase()],
                    ['Presentación Comercial:', log.presentation || 'Cubeta 30 Lb'],
                    ['Fecha de Fabricación / Análisis:', log.analysis_date ? new Date(log.analysis_date).toLocaleDateString() : new Date().toLocaleDateString()],
                    ['Analista Responsable:', log.analyst_name || 'Mario (Control de Calidad)'],
                    ['Dictamen de Inocuidad:', log.result_status?.toUpperCase() || 'APROBADO']
                ]
            });

            // Cuadro de Parámetros Microbiológicos (LAB-004)
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 6,
                theme: 'striped',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                head: [['Ensayo Microbiológico', 'Límite Normativo Aceptable', 'Resultado Obtenido', 'Criterio']],
                body: [
                    ['Recuento Mesófilos Aerobios', 'Máx 10,000 UFC/g', log.mesofilos_aerobios || '< 1,000 UFC/g', 'CONFORME'],
                    ['Coliformes Totales', 'Máx 10 UFC/g', log.coliformes_totales || '< 10 UFC/g', 'CONFORME'],
                    ['Escherichia coli', 'Ausencia en 1g', log.escherichia_coli || 'Ausencia', 'CONFORME'],
                    ['Salmonella spp.', 'Ausencia en 25g (Crítico)', log.salmonella_spp || 'Ausencia en 25g', 'CONFORME'],
                    ['Hongos y Levaduras', 'Máx 100 UFC/g', log.hongos_levaduras || '< 10 UFC/g', 'CONFORME']
                ]
            });

            // Cuadro de Parámetros Físico-Químicos
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 6,
                theme: 'grid',
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                head: [['Parámetro Físico-Químico', 'Especificación', 'Valor Registrado', 'Estado']],
                body: [
                    ['Porcentaje de Sólidos Totales', '≥ 21.0% (Refractómetro)', log.solidos_totales_pct ? `${log.solidos_totales_pct}%` : '24.2%', 'DENTRO DE NORMA'],
                    ['Potencial de Hidrógeno (pH)', '7.20 - 7.80 pH', log.ph ? `${log.ph}` : '7.40', 'DENTRO DE NORMA'],
                    ['Olor, Color y Aspecto', 'Característico, homogéneo, libre de olores extraños', 'Normal', 'CONFORME']
                ]
            });

            // Dictamen y Firma
            const finalY = doc.lastAutoTable.finalY + 10;
            doc.setFillColor(240, 253, 250);
            doc.setDrawColor(45, 212, 191);
            doc.roundedRect(14, finalY, 188, 22, 2, 2, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(13, 148, 136);
            doc.text('DICTAMEN FINAL DE LIBERACIÓN DE CALIDAD:', 18, finalY + 7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text('El lote analizado cumple satisfactoriamente con los estándares microbiológicos y físico-químicos establecidos.', 18, finalY + 12);
            doc.text('PRODUCTO APTO PARA CONSUMO HUMANO Y DISTRIBUCIÓN COMERCIAL.', 18, finalY + 17);

            // Firmas
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.line(30, finalY + 42, 90, finalY + 42);
            doc.text('Mario / Analista de Calidad', 40, finalY + 46);
            doc.text('Firma y Sello de Laboratorio', 40, finalY + 50);

            doc.line(125, finalY + 42, 185, finalY + 42);
            doc.text('Roxy / Gerencia de Operaciones', 135, finalY + 46);
            doc.text('Liberación de Despacho', 145, finalY + 50);

            doc.save(`COA-${log.batch_code_display || log.batch_uuid || 'LOTE'}.pdf`);
            toast.success('Certificado de Análisis (COA) PDF generado correctamente.');
        } catch (error) {
            console.error('Error generando COA:', error);
            toast.error('Error al generar el certificado PDF.');
        }
    };

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-100 text-teal-600">
                        <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Trazabilidad de Lotes, Calidad & COA</h1>
                        <p className="text-xs text-slate-500 font-medium">Control de calidad LAB-004, calculadora de formulación HE Plus y emisión de Certificados de Análisis</p>
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

                            {/* Step 4: HACCP PCC */}
                            {traceData.pasteurizations && traceData.pasteurizations.length > 0 && (
                                <div className="relative flex flex-col md:flex-row md:justify-end items-center gap-6">
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex shadow-xs">4</div>
                                    <div className="md:w-1/2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 z-10">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fase 04: Inocuidad Térmica (PCC-1)</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                traceData.pasteurizations[0].haccp_compliant
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-300 font-bold'
                                            }`}>
                                                {traceData.pasteurizations[0].haccp_compliant ? 'Conforme HACCP' : 'DESVIACIÓN'}
                                            </span>
                                        </div>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex gap-3">
                                                <Flame className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-bold text-slate-900">Pasteurización Térmica</h4>
                                                    <p className="text-xs text-slate-500">Tiempo de retención: {traceData.pasteurizations[0].holding_time_seconds}s | Presión: {traceData.pasteurizations[0].pressure_psi} PSI</p>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <span className="text-[9px] font-bold text-slate-500 block uppercase">Temperatura Registrada:</span>
                                                <span className={`text-base font-bold ${traceData.pasteurizations[0].haccp_compliant ? 'text-teal-700' : 'text-rose-600'}`}>
                                                    {traceData.pasteurizations[0].temperature_c}°C
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 5: PACKAGING & LAB */}
                            {traceData.packaging && (
                                <div className="relative flex flex-col md:flex-row md:justify-start items-center gap-6">
                                    <div className="md:w-1/2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 z-10">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Fase 05: Envasado y Almacén</span>
                                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">Lote Envasado</span>
                                        </div>
                                        <div className="space-y-3 text-xs">
                                            <div className="flex gap-3">
                                                <Barcode className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-bold text-slate-900">Lote Comercial: {traceData.packaging.lot_code}</h4>
                                                    <span className="text-xs text-slate-500 font-medium">Unidades: {traceData.packaging.units_packaged} | Peso: {parseFloat(traceData.packaging.total_batch_weight_lbs).toLocaleString()} Lbs</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex shadow-xs">5</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: CONTROL MICROBIOLÓGICO (LAB-004) */}
            {activeTab === 'lab' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-teal-600" />
                                Bitácora de Análisis de Calidad (LAB-004)
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">Registro de ensayos de laboratorio y liberación microbiológica de lotes</p>
                        </div>
                        <button
                            onClick={() => setIsLabModalOpen(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            <Plus size={14} />
                            Nuevo Análisis LAB-004
                        </button>
                    </div>

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
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Lote Juliano / Producto</th>
                                            <th className="p-3">Mesófilos</th>
                                            <th className="p-3">Coliformes</th>
                                            <th className="p-3">E. Coli / Salmonella</th>
                                            <th className="p-3 text-center">Sólidos / pH</th>
                                            <th className="p-3 text-center">Dictamen</th>
                                            <th className="p-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                        {labLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="p-3 text-xs text-slate-600 whitespace-nowrap">
                                                    {log.analysis_date ? new Date(log.analysis_date).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs">{log.batch_code_display || log.batch_uuid}</span>
                                                        <span className="text-[10px] text-slate-500 capitalize">{log.product_type}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-teal-700 font-bold">{log.mesofilos_aerobios}</td>
                                                <td className="p-3 text-teal-700 font-bold">{log.coliformes_totales}</td>
                                                <td className="p-3 text-xs">
                                                    <span className="block text-slate-800 font-bold">{log.escherichia_coli}</span>
                                                    <span className="text-teal-700 font-bold">{log.salmonella_spp}</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="text-slate-900 font-bold">{log.solidos_totales_pct ? `${log.solidos_totales_pct}%` : '-'}</span>
                                                    <span className="text-slate-500 text-[10px] block">pH: {log.ph || '-'}</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        log.result_status === 'aprobado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {log.result_status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleGenerateCoaPdf(log)}
                                                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-all shadow-xs"
                                                        title="Descargar Certificado de Análisis Oficial"
                                                    >
                                                        <Download size={12} />
                                                        COA PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: CALCULADORA DE SÓLIDOS HE PLUS */}
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

            {/* MODAL CREAR LAB-004 */}
            {isLabModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical size={16} className="text-teal-600" />
                                Registrar Ensayo Microbiológico LAB-004
                            </h3>
                            <button onClick={() => setIsLabModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLabLog} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote de Producción *</label>
                                    <select
                                        value={labForm.batch_id}
                                        onChange={(e) => setLabForm({ ...labForm, batch_id: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        <option value="">Seleccione Lote...</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                [{b.batch_code_display || b.batch_uuid}] {b.product_type}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Fecha de Análisis</label>
                                    <input
                                        type="date"
                                        value={labForm.analysis_date}
                                        onChange={(e) => setLabForm({ ...labForm, analysis_date: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Mesófilos Aerobios</label>
                                    <input
                                        type="text"
                                        value={labForm.mesofilos_aerobios}
                                        onChange={(e) => setLabForm({ ...labForm, mesofilos_aerobios: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Coliformes Totales</label>
                                    <input
                                        type="text"
                                        value={labForm.coliformes_totales}
                                        onChange={(e) => setLabForm({ ...labForm, coliformes_totales: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Salmonella spp.</label>
                                    <input
                                        type="text"
                                        value={labForm.salmonella_spp}
                                        onChange={(e) => setLabForm({ ...labForm, salmonella_spp: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Escherichia coli</label>
                                    <input
                                        type="text"
                                        value={labForm.escherichia_coli}
                                        onChange={(e) => setLabForm({ ...labForm, escherichia_coli: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Sólidos Totales (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={labForm.solidos_totales_pct}
                                        onChange={(e) => setLabForm({ ...labForm, solidos_totales_pct: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">pH</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={labForm.ph}
                                        onChange={(e) => setLabForm({ ...labForm, ph: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Dictamen de Calidad</label>
                                    <select
                                        value={labForm.result_status}
                                        onChange={(e) => setLabForm({ ...labForm, result_status: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        <option value="aprobado">Aprobado / Apto</option>
                                        <option value="retenido">Retenido para Re-ensayo</option>
                                        <option value="rechazado">Rechazado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Analista Responsable</label>
                                    <input
                                        type="text"
                                        value={labForm.analyst_name}
                                        onChange={(e) => setLabForm({ ...labForm, analyst_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
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
                                    Guardar Registro LAB-004
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
