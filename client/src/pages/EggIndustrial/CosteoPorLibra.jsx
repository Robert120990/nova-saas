import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Calculator,
    TrendingUp,
    Users,
    Settings2,
    History,
    Save,
    RefreshCcw,
    DollarSign,
    Package,
    Flame,
    Droplets,
    Plus,
    X,
    Sparkles,
    BarChart3,
    Factory,
    Scale,
    ShoppingCart,
    Edit2,
    Trash2,
    ArrowDownRight,
    Split,
    Handshake,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    FileText,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import Money from '../../components/ui/Money';

export default function EggCosteoPorLibra() {
    const navigate = useNavigate();
    // Tab actual
    const [activeTab, setActiveTab] = useState('calculator'); // 'calculator', 'simulator', 'clients', 'catalog', 'history'

    // Rango de fechas global para monitoreo operacional y acuerdos
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return {
            preset: '30d',
            startDate: d.toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0]
        };
    });

    // Parámetros de simulación (guardados como texto/número para edición natural sin snap a 0)
    const [calcParams, setCalcParams] = useState({
        product_type: 'Huevo Entero Pasteurizado',
        presentation: 'cubeta 30LB',
        raw_egg_box_cost: '38.00',
        raw_egg_lbs_per_box: '43.5',
        batch_size_lbs: '12000',
        base_egg_solids: '24.2',
        target_solids: '21.5',
        water_added_pct: '8.0',
        sugar_added_pct: '4.0',
        salt_added_pct: '10.0',
        milk_added_pct: '5.0',
        clara_separated_pct: '100',
        clara_sale_price_per_lb: '1.35',
        yema_solids_pct: '50.0',
        target_sale_price_per_lb: '1.25',
        custom_cip_cost: null,
        custom_mod_per_lb: 0.0500,
        custom_gif_monthly: 24537.00,
        custom_monthly_volume_lbs: 100000
    });
    const [showCustomSolids, setShowCustomSolids] = useState(false);
    // Control de acordeón / desplegable para matrices de presentación
    const [showPresentationsMatrixCalc, setShowPresentationsMatrixCalc] = useState(false);
    const [showPresentationsMatrixSim, setShowPresentationsMatrixSim] = useState(false);

    // Resultados calculados
    const [calculationResult, setCalculationResult] = useState(null);
    const [calculating, setCalculating] = useState(false);

    // Costo actual operacional (en vivo desde recepciones, lotes y ventas)
    const [operationalStats, setOperationalStats] = useState(null);
    const [loadingOperational, setLoadingOperational] = useState(false);

    // Listados complementarios
    const [cipItems, setCipItems] = useState([]);
    const [packagingItems, setPackagingItems] = useState([]);
    const [agreements, setAgreements] = useState([]);
    const [scenarios, setScenarios] = useState([]);
    const [configs, setConfigs] = useState({});

    // Histórico de costos operacionales reales
    const [costingHistoryList, setCostingHistoryList] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Historial global de revisiones de acuerdos
    const [globalAgreementHistory, setGlobalAgreementHistory] = useState([]);
    const [loadingGlobalHistory, setLoadingGlobalHistory] = useState(false);
    const [historySubTab, setHistorySubTab] = useState('real_production'); // 'real_production', 'scenarios', 'agreements_history'

    // Filtro de vigencia para acuerdos
    const [validityFilter, setValidityFilter] = useState('todos'); // 'todos', 'vigente', 'por_vencer', 'vencido', 'programado'

    // Modales
    const [agreementModal, setAgreementModal] = useState({ open: false, data: null });
    const [agreementHistoryModal, setAgreementHistoryModal] = useState({ open: false, agreement: null, history: [], loading: false });
    const [saveScenarioModal, setSaveScenarioModal] = useState(false);
    const [scenarioNameInput, setScenarioNameInput] = useState('');

    // Modales para Catálogo Insumos / CIP
    const [cipModal, setCipModal] = useState({ open: false, data: null });
    const [packagingModal, setPackagingModal] = useState({ open: false, data: null });
    const [configModal, setConfigModal] = useState({ open: false, data: null });

    // Ref para debounce de cálculo automático
    const debounceTimerRef = useRef(null);

    // Carga inicial
    useEffect(() => {
        loadData(dateRange.startDate, dateRange.endDate);
        loadOperationalCost(dateRange.startDate, dateRange.endDate);
        loadCostingHistory(dateRange.startDate, dateRange.endDate);
    }, []);

    const loadData = async (sDate = dateRange.startDate, eDate = dateRange.endDate) => {
        try {
            const [confRes, cipRes, packRes, agrRes, scenRes] = await Promise.all([
                axios.get('/api/egg-industrial/costeo-libra/config'),
                axios.get('/api/egg-industrial/costeo-libra/cip-items'),
                axios.get('/api/egg-industrial/costeo-libra/packaging-items'),
                axios.get('/api/egg-industrial/costeo-libra/customer-agreements', {
                    params: { start_date: sDate || undefined, end_date: eDate || undefined }
                }),
                axios.get('/api/egg-industrial/costeo-libra/scenarios')
            ]);
            
            const confMap = {};
            if (Array.isArray(confRes.data)) {
                confRes.data.forEach(c => { confMap[c.setting_key] = parseFloat(c.setting_value) || 0; });
            }
            setConfigs(confMap);
            setCipItems(Array.isArray(cipRes.data) ? cipRes.data : []);
            setPackagingItems(Array.isArray(packRes.data) ? packRes.data : []);
            setAgreements(Array.isArray(agrRes.data) ? agrRes.data : []);
            setScenarios(Array.isArray(scenRes.data) ? scenRes.data : []);

            // Ejecutar primer cálculo pasando rango de fecha
            runCalculation(calcParams, false, sDate, eDate);
        } catch (error) {
            console.error('Error cargando datos de costeo:', error);
            toast.error('Error al inicializar datos del módulo de costeo.');
        }
    };

    const loadOperationalCost = async (sDate = dateRange.startDate, eDate = dateRange.endDate) => {
        setLoadingOperational(true);
        try {
            const res = await axios.get('/api/egg-industrial/costeo-libra/actual-operational-cost', {
                params: {
                    start_date: sDate || undefined,
                    end_date: eDate || undefined
                }
            });
            setOperationalStats(res.data);
        } catch (error) {
            console.error('Error cargando costo operacional:', error);
        } finally {
            setLoadingOperational(false);
        }
    };

    const loadCostingHistory = async (sDate = dateRange.startDate, eDate = dateRange.endDate) => {
        setLoadingHistory(true);
        try {
            const res = await axios.get('/api/egg-industrial/costeo-libra/history', {
                params: {
                    start_date: sDate || undefined,
                    end_date: eDate || undefined
                }
            });
            setCostingHistoryList(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error cargando histórico de costos:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const loadGlobalAgreementHistory = async () => {
        setLoadingGlobalHistory(true);
        try {
            const res = await axios.get('/api/egg-industrial/costeo-libra/customer-agreements/history');
            setGlobalAgreementHistory(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Error cargando historial global de acuerdos:', error);
        } finally {
            setLoadingGlobalHistory(false);
        }
    };

    const handlePresetChange = (preset) => {
        const now = new Date();
        let start = '';
        let end = now.toISOString().split('T')[0];

        if (preset === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            start = firstDay.toISOString().split('T')[0];
            end = lastDay.toISOString().split('T')[0];
        } else if (preset === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            start = d.toISOString().split('T')[0];
        } else if (preset === '3m') {
            const d = new Date();
            d.setMonth(d.getMonth() - 3);
            start = d.toISOString().split('T')[0];
        } else if (preset === 'year') {
            start = `${now.getFullYear()}-01-01`;
        } else if (preset === 'all') {
            start = '';
            end = '';
        }

        const newRange = { preset, startDate: start, endDate: end };
        setDateRange(newRange);
        loadOperationalCost(start, end);
        loadData(start, end);
        loadCostingHistory(start, end);
        toast.success(`Filtro de período actualizado: ${getPresetLabel(preset)}`);
    };

    const handleCustomDateApply = () => {
        setDateRange(prev => ({ ...prev, preset: 'custom' }));
        loadOperationalCost(dateRange.startDate, dateRange.endDate);
        loadData(dateRange.startDate, dateRange.endDate);
        loadCostingHistory(dateRange.startDate, dateRange.endDate);
        toast.success('Rango de fechas personalizado aplicado.');
    };

    const getPresetLabel = (preset) => {
        switch (preset) {
            case 'month': return 'Mes Actual';
            case '30d': return 'Últimos 30 Días';
            case '3m': return 'Últimos 3 Meses';
            case 'year': return 'Año Actual';
            case 'all': return 'Todo el Histórico';
            default: return 'Personalizado';
        }
    };

    const handleOpenAgreementHistory = async (agreement) => {
        setAgreementHistoryModal({
            open: true,
            agreement,
            history: [],
            loading: true
        });
        try {
            const res = await axios.get(`/api/egg-industrial/costeo-libra/customer-agreements/${agreement.id}/history`, {
                params: { customer_name: agreement.customer_name }
            });
            setAgreementHistoryModal(prev => ({
                ...prev,
                history: Array.isArray(res.data) ? res.data : [],
                loading: false
            }));
        } catch (error) {
            console.error('Error cargando historial del acuerdo:', error);
            toast.error('Error al cargar historial del acuerdo.');
            setAgreementHistoryModal(prev => ({ ...prev, loading: false }));
        }
    };

    // Motor de cálculo con debounce opcional
    const runCalculation = async (params = calcParams, isManual = false, sDate = dateRange.startDate, eDate = dateRange.endDate) => {
        setCalculating(true);
        try {
            const payload = {
                ...params,
                start_date: sDate || undefined,
                end_date: eDate || undefined,
                raw_egg_box_cost: parseFloat(params.raw_egg_box_cost) || 0,
                raw_egg_lbs_per_box: parseFloat(params.raw_egg_lbs_per_box) || 43.5,
                batch_size_lbs: parseFloat(params.batch_size_lbs) || 12000,
                base_egg_solids: parseFloat(params.base_egg_solids) || 24.2,
                target_solids: parseFloat(params.target_solids) || 21.5,
                water_added_pct: parseFloat(params.water_added_pct) || 0,
                sugar_added_pct: parseFloat(params.sugar_added_pct) || 0,
                salt_added_pct: parseFloat(params.salt_added_pct) || 0,
                milk_added_pct: parseFloat(params.milk_added_pct) || 0,
                clara_separated_pct: parseFloat(params.clara_separated_pct) || 100,
                clara_sale_price_per_lb: parseFloat(params.clara_sale_price_per_lb) || 1.35,
                yema_solids_pct: parseFloat(params.yema_solids_pct) || 50.0,
                target_sale_price_per_lb: parseFloat(params.target_sale_price_per_lb) || 0,
                custom_gif_monthly: parseFloat(params.custom_gif_monthly) || 24537.00,
                custom_monthly_volume_lbs: parseFloat(params.custom_monthly_volume_lbs) || 100000
            };
            const res = await axios.post('/api/egg-industrial/costeo-libra/calculate', payload);
            setCalculationResult(res.data);
            if (isManual) {
                toast.success('Costos recalculados correctamente.');
            }
        } catch (error) {
            console.error('Error en cálculo de costeo:', error);
            if (isManual) {
                toast.error(error.response?.data?.message || 'Error al calcular costos.');
            }
        } finally {
            setCalculating(false);
        }
    };

    // Cambio en parámetros con debounce de 350ms para no saturar ni dar errores en vivo
    const handleParamChange = (field, value) => {
        setCalcParams(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'product_type') {
                const valLower = (value || '').toLowerCase();
                if (valLower.includes('separaci') || valLower.includes('separad') || valLower.includes('reconstituido')) {
                    updated.base_egg_solids = '50.0';
                    updated.yema_solids_pct = '50.0';
                    updated.target_solids = '21.5';
                    updated.clara_separated_pct = '100';
                    updated.clara_sale_price_per_lb = '1.35';
                    updated.water_added_pct = '0.0';
                    updated.sugar_added_pct = '0.0';
                    updated.salt_added_pct = '0.0';
                    updated.milk_added_pct = '0.0';
                } else if (valLower.includes('plus')) {
                    updated.base_egg_solids = '24.2';
                    updated.target_solids = '21.5';
                    updated.water_added_pct = '11.16';
                    updated.sugar_added_pct = '0.0';
                    updated.salt_added_pct = '0.0';
                    updated.milk_added_pct = '0.0';
                } else if (valLower.includes('azucarada')) {
                    updated.water_added_pct = '0.0';
                    updated.sugar_added_pct = '4.0';
                    updated.salt_added_pct = '0.0';
                    updated.milk_added_pct = '0.0';
                } else if (valLower.includes('salada')) {
                    updated.water_added_pct = '0.0';
                    updated.salt_added_pct = '10.0';
                    updated.sugar_added_pct = '0.0';
                    updated.milk_added_pct = '0.0';
                } else if (valLower.includes('leche')) {
                    updated.milk_added_pct = '5.0';
                    updated.water_added_pct = '0.0';
                    updated.sugar_added_pct = '0.0';
                    updated.salt_added_pct = '0.0';
                } else {
                    updated.water_added_pct = '0.0';
                    updated.sugar_added_pct = '0.0';
                    updated.salt_added_pct = '0.0';
                    updated.milk_added_pct = '0.0';
                }
            } else if (field === 'base_egg_solids' || field === 'target_solids') {
                const b = parseFloat(field === 'base_egg_solids' ? value : updated.base_egg_solids) || 0;
                const t = parseFloat(field === 'target_solids' ? value : updated.target_solids) || 0;
                if (b > 0 && t > 0 && b > t) {
                    updated.water_added_pct = (((b - t) / b) * 100).toFixed(2);
                }
            } else if (field === 'water_added_pct') {
                const w = parseFloat(value) || 0;
                const b = parseFloat(updated.base_egg_solids) || 24.2;
                if (b > 0 && w >= 0) {
                    updated.target_solids = (b * (1 - (w / 100))).toFixed(1);
                }
            }

            // Disparar debounce de cálculo
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                runCalculation(updated, false);
            }, 350);

            return updated;
        });
    };

    // Cargar Parámetros Reales al Simulador
    const handleApplyRealPlantData = () => {
        if (!operationalStats?.operational_summary) {
            return toast.error('Aún no hay estadísticas operacionales registradas en el sistema.');
        }

        const op = operationalStats.operational_summary;
        const brk = operationalStats.actual_cost_breakdown;

        setCalcParams(prev => {
            const updated = {
                ...prev,
                raw_egg_box_cost: op.real_box_cost ? op.real_box_cost.toFixed(2) : prev.raw_egg_box_cost,
                raw_egg_lbs_per_box: op.avg_lbs_per_box ? op.avg_lbs_per_box.toFixed(1) : prev.raw_egg_lbs_per_box,
                target_sale_price_per_lb: op.avg_sale_price_per_lb ? op.avg_sale_price_per_lb.toFixed(2) : prev.target_sale_price_per_lb,
                custom_monthly_volume_lbs: brk.volume_basis_lbs || prev.custom_monthly_volume_lbs
            };
            runCalculation(updated, false);
            return updated;
        });

        toast.success('Parámetros de planta reales aplicados al simulador.');
    };

    // Guardar Escenario
    const handleSaveScenario = async () => {
        if (!scenarioNameInput.trim()) {
            return toast.error('Ingresa un nombre descriptivo para el escenario.');
        }
        try {
            await axios.post('/api/egg-industrial/costeo-libra/scenarios', {
                scenario_name: scenarioNameInput.trim(),
                product_type: calcParams.product_type,
                presentation: calcParams.presentation,
                base_raw_egg_cost_per_box: parseFloat(calcParams.raw_egg_box_cost) || 38.0,
                batch_size_lbs: parseFloat(calcParams.batch_size_lbs) || 12000,
                yield_liquid_pct: calculationResult?.parameters_used?.liquid_yield_pct || 83,
                calculated_cost_per_lb: calculationResult?.breakdown?.total_cost_per_lb || 0,
                target_sale_price_per_lb: parseFloat(calcParams.target_sale_price_per_lb) || 0,
                margin_pct: calculationResult?.target_simulation?.margin_pct || 0,
                full_breakdown_json: calculationResult?.breakdown || {}
            });
            toast.success('Escenario de costeo guardado exitosamente.');
            setSaveScenarioModal(false);
            setScenarioNameInput('');
            const scenRes = await axios.get('/api/egg-industrial/costeo-libra/scenarios');
            setScenarios(scenRes.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar escenario.');
        }
    };

    // CRUD: Acuerdos Clientes
    const handleSaveAgreement = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/costeo-libra/customer-agreements', agreementModal.data);
            toast.success('Acuerdo comercial guardado con éxito.');
            setAgreementModal({ open: false, data: null });
            await loadData(dateRange.startDate, dateRange.endDate);
            await loadOperationalCost(dateRange.startDate, dateRange.endDate);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar acuerdo.');
        }
    };

    const handleDeleteAgreement = async (id) => {
        if (!window.confirm('¿Seguro de eliminar este acuerdo comercial?')) return;
        try {
            await axios.delete(`/api/egg-industrial/costeo-libra/customer-agreements/${id}`);
            toast.success('Acuerdo eliminado.');
            await loadData(dateRange.startDate, dateRange.endDate);
            await loadOperationalCost(dateRange.startDate, dateRange.endDate);
        } catch (error) {
            toast.error('Error al eliminar acuerdo.');
        }
    };

    // CRUD: Químicos CIP
    const handleSaveCipItem = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/costeo-libra/cip-items', cipModal.data);
            toast.success('Químico CIP guardado.');
            setCipModal({ open: false, data: null });
            const cipRes = await axios.get('/api/egg-industrial/costeo-libra/cip-items');
            setCipItems(cipRes.data);
            runCalculation(calcParams, false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar químico CIP.');
        }
    };

    const handleDeleteCipItem = async (id) => {
        if (!window.confirm('¿Seguro de eliminar este químico CIP?')) return;
        try {
            await axios.delete(`/api/egg-industrial/costeo-libra/cip-items/${id}`);
            toast.success('Químico CIP eliminado.');
            const cipRes = await axios.get('/api/egg-industrial/costeo-libra/cip-items');
            setCipItems(cipRes.data);
            runCalculation(calcParams, false);
        } catch (error) {
            toast.error('Error al eliminar químico CIP.');
        }
    };

    // CRUD: Empaques
    const handleSavePackagingItem = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/costeo-libra/packaging-items', packagingModal.data);
            toast.success('Empaque guardado.');
            setPackagingModal({ open: false, data: null });
            const packRes = await axios.get('/api/egg-industrial/costeo-libra/packaging-items');
            setPackagingItems(packRes.data);
            runCalculation(calcParams, false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar empaque.');
        }
    };

    const handleDeletePackagingItem = async (id) => {
        if (!window.confirm('¿Seguro de eliminar este material de empaque?')) return;
        try {
            await axios.delete(`/api/egg-industrial/costeo-libra/packaging-items/${id}`);
            toast.success('Empaque eliminado.');
            const packRes = await axios.get('/api/egg-industrial/costeo-libra/packaging-items');
            setPackagingItems(packRes.data);
            runCalculation(calcParams, false);
        } catch (error) {
            toast.error('Error al eliminar empaque.');
        }
    };

    // CRUD: Configuraciones de Planta / Caldera
    const handleSaveConfigs = async (e) => {
        e.preventDefault();
        try {
            const settingsArray = Object.keys(configModal.data).map(key => ({
                setting_key: key,
                setting_value: configModal.data[key]
            }));
            await axios.put('/api/egg-industrial/costeo-libra/config', { settings: settingsArray });
            toast.success('Parámetros de caldera y planta actualizados.');
            setConfigModal({ open: false, data: null });
            const confRes = await axios.get('/api/egg-industrial/costeo-libra/config');
            const confMap = {};
            confRes.data.forEach(c => { confMap[c.setting_key] = parseFloat(c.setting_value) || 0; });
            setConfigs(confMap);
            runCalculation(calcParams, false);
        } catch (error) {
            toast.error('Error al guardar configuraciones de planta.');
        }
    };

    const opSummary = operationalStats?.operational_summary || {};
    const opBreakdown = operationalStats?.actual_cost_breakdown || {};

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header Principal */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-indigo-600 text-[11px] font-bold uppercase tracking-wider mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span>Planta Industrial ANDELSA • Ovoproductos</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <Calculator className="w-6 h-6 text-indigo-600" />
                        <span>Costeo por Libra & Simulador de Rentabilidad</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Cálculo del costo actual según entradas, producción y ventas, más simulador comercial por absorción.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => runCalculation(calcParams, true)}
                        disabled={calculating}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                        <RefreshCcw className={`w-3.5 h-3.5 ${calculating ? 'animate-spin' : ''}`} />
                        <span>Recalcular</span>
                    </button>
                    <button
                        onClick={() => setSaveScenarioModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Escenario</span>
                    </button>
                </div>
            </div>

            {/* BARRA GLOBAL DE RANGO DE FECHAS & FILTRO HISTÓRICO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Período de Análisis & Vigencia</span>
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] font-black uppercase">
                                {getPresetLabel(dateRange.preset)}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {dateRange.startDate && dateRange.endDate
                                ? `Desde ${new Date(dateRange.startDate + 'T00:00:00').toLocaleDateString()} hasta ${new Date(dateRange.endDate + 'T00:00:00').toLocaleDateString()}`
                                : 'Mostrando todo el histórico operacional'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Presets Rápidos */}
                    <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex flex-wrap gap-1">
                        {[
                            { id: 'month', label: 'Mes Actual' },
                            { id: '30d', label: '30 Días' },
                            { id: '3m', label: '3 Meses' },
                            { id: 'year', label: 'Año Actual' },
                            { id: 'all', label: 'Todo' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => handlePresetChange(btn.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    dateRange.preset === btn.id
                                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Selector Manual de Fechas */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Desde</span>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value, preset: 'custom' }))}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-bold uppercase text-slate-400">Hasta</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value, preset: 'custom' }))}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={handleCustomDateApply}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-all ml-1"
                        >
                            Filtrar
                        </button>
                    </div>
                </div>
            </div>

            {/* SECCIÓN DESTACADA: COSTO ACTUAL REAL DE OPERACIÓN (EN VIVO) */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl border border-indigo-800/40">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-1">
                            <Factory className="w-4 h-4 text-emerald-400" />
                            <span>Monitoreo Operativo en Tiempo Real</span>
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                            <span>Costo Actual de Planta (Entradas, Producción & Ventas)</span>
                            {loadingOperational && <RefreshCcw className="w-4 h-4 animate-spin text-indigo-300" />}
                        </h2>
                        <p className="text-xs text-indigo-200/80 mt-0.5">
                            Calculado dinámicamente según las compras de huevo cáscara, rendimiento real de quebrado y contratos de venta.
                        </p>
                    </div>
                    <button
                        onClick={handleApplyRealPlantData}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all self-start lg:self-auto"
                    >
                        <ArrowDownRight className="w-4 h-4" />
                        <span>Cargar Parámetros Reales al Simulador</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-5">
                    {/* 1. Entradas / Recepción */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-400" />
                                Entradas MP
                            </span>
                            <span className="text-[10px] text-slate-400">{opSummary.total_receptions || 0} envíos</span>
                        </div>
                        <div className="text-xl font-black text-white mt-1">
                            ${opSummary.real_box_cost ? opSummary.real_box_cost.toFixed(2) : '38.00'}
                            <span className="text-xs font-normal text-indigo-300"> /caja</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            {opSummary.total_lbs_received ? opSummary.total_lbs_received.toLocaleString() : 0} lbs recibidas
                        </div>
                    </div>

                    {/* 2. Producción / Rendimiento Real */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span className="flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                                Rend. Quebrado
                            </span>
                            <span className="text-[10px] text-emerald-400 font-bold">
                                {opSummary.actual_yield_pct ? opSummary.actual_yield_pct.toFixed(1) : '83.0'}% Real
                            </span>
                        </div>
                        <div className="text-xl font-black text-white mt-1">
                            {opSummary.actual_shell_pct ? opSummary.actual_shell_pct.toFixed(1) : '17.0'}%
                            <span className="text-xs font-normal text-indigo-300"> Merma Cáscara</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            {opSummary.total_batches || 0} lotes procesados
                        </div>
                    </div>

                    {/* 3. Ventas / Precio Promedio */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span className="flex items-center gap-1.5">
                                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                                Venta Pactada
                            </span>
                            <span className="text-[10px] text-slate-400">Promedio</span>
                        </div>
                        <div className="text-xl font-black text-emerald-400 mt-1">
                            ${opSummary.avg_sale_price_per_lb ? opSummary.avg_sale_price_per_lb.toFixed(2) : '1.25'}
                            <span className="text-xs font-normal text-indigo-300"> /lb</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            {opSummary.total_contract_volume ? opSummary.total_contract_volume.toLocaleString() : '100,000'} lbs/mes
                        </div>
                    </div>

                    {/* 4. COSTO ACTUAL REAL */}
                    <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-emerald-300 text-[11px] font-black uppercase mb-1">
                            <span>Costo Actual / Lb</span>
                            <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-black rounded">EN VIVO</span>
                        </div>
                        <div className="text-2xl font-black text-white mt-1">
                            ${opBreakdown.total_actual_cost_per_lb ? opBreakdown.total_actual_cost_per_lb.toFixed(2) : '1.50'}
                            <span className="text-xs font-normal text-emerald-300"> /lb</span>
                        </div>
                        <div className="text-[10px] text-emerald-200/70 mt-1">
                            Base {opBreakdown.volume_basis_lbs ? opBreakdown.volume_basis_lbs.toLocaleString() : '100,000'} lbs
                        </div>
                    </div>

                    {/* 5. Margen Actual Real */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px] font-bold uppercase mb-1">
                            <span>Margen Real</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                (opBreakdown.actual_margin_pct || 0) >= 15 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                                {opBreakdown.actual_margin_pct ? opBreakdown.actual_margin_pct.toFixed(1) : '0.0'}%
                            </span>
                        </div>
                        <div className={`text-xl font-black mt-1 ${
                            (opBreakdown.actual_margin_per_lb || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                            ${opBreakdown.actual_margin_per_lb ? opBreakdown.actual_margin_per_lb.toFixed(2) : '0.00'}
                            <span className="text-xs font-normal text-indigo-300"> /lb utilidad</span>
                        </div>
                        <div className="text-[10px] text-indigo-200/70 mt-1">
                            Frente a ventas reales
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap gap-1.5 w-fit">
                {[
                    { id: 'calculator', label: 'Calculadora de Costeo', icon: Calculator },
                    { id: 'simulator', label: 'Simulador de Margen Libre', icon: TrendingUp },
                    { id: 'clients', label: 'Acuerdos con Clientes', icon: Users, badge: agreements.length },
                    { id: 'catalog', label: 'Insumos, Empaques y CIP', icon: Settings2 },
                    { id: 'history', label: 'Escenarios Guardados', icon: History, badge: scenarios.length }
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                                isActive
                                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                                    isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: CALCULADORA DINÁMICA */}
            {activeTab === 'calculator' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Panel de Parámetros */}
                    <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-indigo-600" />
                                <span>Parámetros de Formulación y Costeo</span>
                            </h2>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                                Lote {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs
                            </span>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                    Tipo de Producto
                                </label>
                                <select
                                    value={calcParams.product_type}
                                    onChange={(e) => handleParamChange('product_type', e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                >
                                    <option value="Huevo Entero Pasteurizado">Huevo Entero Pasteurizado (83% rend.)</option>
                                    <option value="Huevo Formulado por Separación">Huevo Formulado por Separación (Yema + H2O + Venta de Clara)</option>
                                    <option value="Huevo Entero Plus">Huevo Entero Plus (Con agua 8% y ácido cítrico)</option>
                                    <option value="Clara de Huevo Pasteurizada">Clara Pasteurizada (53.95% rend.)</option>
                                    <option value="Yema Azucarada">Yema Azucarada (4% azúcar)</option>
                                    <option value="Yema Salada">Yema Salada (10% sal)</option>
                                    <option value="Huevo con Leche">Huevo Entero con Leche (Institucional / Vuelos)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Presentación
                                    </label>
                                    <select
                                        value={calcParams.presentation}
                                        onChange={(e) => handleParamChange('presentation', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="cubeta 30LB">Cubeta 30 Lbs (Estándar)</option>
                                        <option value="cubeta 32LB">Cubeta 32 Lbs</option>
                                        <option value="galon 8LB">Galón 8 Lbs</option>
                                        <option value="medio galon 4LB">Medio Galón 4 Lbs</option>
                                        <option value="litro 2LB">Litro 2 Lbs</option>
                                        <option value="medio litro 1LB">Medio Litro 1 Lb</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase">
                                            Costo Caja Huevo ($)
                                        </label>
                                        {opSummary.real_box_cost && (
                                            <button
                                                type="button"
                                                onClick={() => handleParamChange('raw_egg_box_cost', opSummary.real_box_cost.toFixed(2))}
                                                className="text-[10px] text-indigo-600 font-bold hover:underline"
                                            >
                                                Real: ${opSummary.real_box_cost.toFixed(2)}
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={calcParams.raw_egg_box_cost}
                                        onChange={(e) => handleParamChange('raw_egg_box_cost', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Libras por Caja (360 Uds)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="43.5"
                                        value={calcParams.raw_egg_lbs_per_box}
                                        onChange={(e) => handleParamChange('raw_egg_lbs_per_box', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Tamaño del Lote (Lbs)
                                    </label>
                                    <input
                                        type="number"
                                        step="500"
                                        placeholder="12000"
                                        value={calcParams.batch_size_lbs}
                                        onChange={(e) => handleParamChange('batch_size_lbs', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* SECCIÓN DE FORMULACIÓN POR SEPARACIÓN CLARA/YEMA CON ADITIVO H2O */}
                            {(calcParams.product_type.toLowerCase().includes('separaci') || calcParams.product_type.toLowerCase().includes('separad')) && (
                                <div className="pt-3.5 pb-3.5 px-4 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-3.5 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs uppercase tracking-wide">
                                            <Split className="w-4 h-4 text-emerald-600" />
                                            <span>Modelo de Separación & Arbitraje con Aditivo H2O</span>
                                        </div>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            Alta Rentabilidad (Crédito Clara)
                                        </span>
                                    </div>

                                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                                        Separa la <strong>Clara</strong> para venta comercial a mejor precio (PriceSmart, repostería, hoteles), y utiliza la <strong>Yema pura</strong> (50% sólidos) agregando aditivo <strong>H2O purificada</strong> y ácido cítrico para formular huevo entero estandarizado al <strong>{calcParams.target_solids || '21.5'}%</strong> de sólidos, reduciendo drásticamente el costo por libra.
                                    </p>

                                    {/* Inputs de la Separación */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                                % Clara a Separar
                                            </label>
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                value={calcParams.clara_separated_pct}
                                                onChange={(e) => handleParamChange('clara_separated_pct', e.target.value)}
                                                placeholder="100"
                                                className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-slate-500 mt-0.5 block">100% = Venta total de clara</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                                Precio Venta Clara ($/lb)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={calcParams.clara_sale_price_per_lb}
                                                onChange={(e) => handleParamChange('clara_sale_price_per_lb', e.target.value)}
                                                placeholder="1.35"
                                                className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-emerald-700 font-semibold mt-0.5 block">PriceSmart ($1.35 - $1.50)</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                                Sólidos Yema (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="30"
                                                max="60"
                                                value={calcParams.yema_solids_pct}
                                                onChange={(e) => handleParamChange('yema_solids_pct', e.target.value)}
                                                placeholder="50.0"
                                                className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-slate-500 mt-0.5 block">Estándar planta: 50.0%</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                                                Sólidos Target Formulado (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="15"
                                                max="30"
                                                value={calcParams.target_solids}
                                                onChange={(e) => handleParamChange('target_solids', e.target.value)}
                                                placeholder="21.5"
                                                className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-slate-500 mt-0.5 block">Norma técnica: ≥21.0%</span>
                                        </div>
                                    </div>

                                    {/* Fórmulas matemáticas de planta */}
                                    <div className="bg-white/90 border border-emerald-200 rounded-lg p-2.5 text-[10.5px] text-slate-800 space-y-1">
                                        <div className="flex items-center justify-between font-bold text-emerald-900 border-b border-emerald-100 pb-1">
                                            <span>Fórmula de Balance de Masa & Crédito:</span>
                                            <span>Base Batch: {(parseFloat(calcParams.batch_size_lbs) || 12000).toLocaleString()} lbs Huevo Líquido</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-[10px] text-slate-700">
                                            <div>
                                                • H2O Necesaria = [(Lbs Yema × % Sólidos Yema) ÷ Sólidos Target] − Lbs Yema
                                            </div>
                                            <div>
                                                • Costo Neto MP = Costo Cáscara − (Lbs Clara × Precio Clara) + Aditivos
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tarjetas de balance para el Lote actual */}
                                    {calculationResult?.separation_data && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                            <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Clara para Venta</span>
                                                <span className="font-bold text-emerald-800 text-xs mt-0.5 block">
                                                    {(calculationResult.separation_data.clara_for_sale_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                                </span>
                                                <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5">
                                                    +<Money value={calculationResult.separation_data.clara_revenue || 0} /> ingreso
                                                </span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Yema Base Concentrada</span>
                                                <span className="font-bold text-amber-800 text-xs mt-0.5 block">
                                                    {(calculationResult.separation_data.natural_yema_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                                </span>
                                                <span className="text-[9px] text-slate-500 block mt-0.5">
                                                    {calculationResult.separation_data.yema_solids_pct}% sólidos
                                                </span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Aditivo H2O Requerido</span>
                                                <span className="font-bold text-cyan-700 text-xs mt-0.5 block">
                                                    {(calculationResult.separation_data.h2o_required_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                                </span>
                                                <span className="text-[9px] text-cyan-800 font-semibold block mt-0.5">
                                                    {(calculationResult.separation_data.h2o_garrafones || 0).toFixed(1)} garrafones (42 lb)
                                                </span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Huevo Formulado Final</span>
                                                <span className="font-bold text-indigo-800 text-xs mt-0.5 block">
                                                    {(calculationResult.separation_data.final_formulated_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                                </span>
                                                <span className="text-[9px] text-indigo-600 font-semibold block mt-0.5">
                                                    {calculationResult.separation_data.target_solids_pct}% sólidos (Norma)
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Resumen de Arbitraje y Ahorro */}
                                    {calculationResult?.separation_data && (
                                        <div className="flex flex-wrap items-center justify-between text-xs bg-emerald-100/80 p-2.5 rounded-lg text-emerald-950 font-medium gap-2 border border-emerald-200">
                                            <div>
                                                <span>Costo MP Normal: </span>
                                                <strong className="text-slate-700"><Money value={calculationResult.separation_data.standard_mp_cost_without_separation || 0} />/lb</strong>
                                            </div>
                                            <div>
                                                <span>Costo MP Formulado: </span>
                                                <strong className="text-emerald-900 text-sm font-black"><Money value={calculationResult.separation_data.mp_cost_per_lb_formulated || 0} />/lb</strong>
                                            </div>
                                            <div className="bg-emerald-600 text-white font-black px-2.5 py-1 rounded-md text-[11px] shadow-sm">
                                                Ahorro Arbitraje: -<Money value={calculationResult.separation_data.mp_cost_reduction_per_lb || 0} /> /lb
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECCIÓN DE FORMULACIÓN Y BALANCE DE SÓLIDOS */}
                            {calcParams.product_type.toLowerCase().includes('plus') || showCustomSolids ? (
                                <div className="pt-3 pb-3 px-3.5 bg-cyan-50/80 border border-cyan-200 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-cyan-900 font-bold text-xs uppercase tracking-wide">
                                            <Droplets className="w-4 h-4 text-cyan-600" />
                                            <span>Nivelación de Sólidos & Balance Hídrico (HE+)</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                            (parseFloat(calcParams.target_solids) || 0) >= 21.0
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                                        }`}>
                                            {(parseFloat(calcParams.target_solids) || 0) >= 21.0 ? 'Norma Cumplida (≥21.0%)' : 'Sólidos Bajos (<21.0%)'}
                                        </span>
                                    </div>

                                    {/* Inputs de Sólidos Base y Objetivo */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                Sólidos Base (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1"
                                                max="40"
                                                value={calcParams.base_egg_solids}
                                                onChange={(e) => handleParamChange('base_egg_solids', e.target.value)}
                                                placeholder="24.2"
                                                className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-slate-500 mt-0.5 block">Refractómetro</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                Sólidos Target (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1"
                                                max="40"
                                                value={calcParams.target_solids}
                                                onChange={(e) => handleParamChange('target_solids', e.target.value)}
                                                placeholder="21.5"
                                                className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-slate-500 mt-0.5 block">Mínimo 21.0%</span>
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                % Agua a Añadir
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                max="30"
                                                value={calcParams.water_added_pct}
                                                onChange={(e) => handleParamChange('water_added_pct', e.target.value)}
                                                placeholder="8.0"
                                                className="w-full bg-white border border-cyan-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-cyan-900 focus:ring-2 focus:ring-cyan-500/20 shadow-sm"
                                            />
                                            <span className="text-[9px] text-cyan-700 font-semibold mt-0.5 block">Sincronizado</span>
                                        </div>
                                    </div>

                                    {/* Banner con la fórmula oficial */}
                                    <div className="bg-white/80 border border-cyan-200 rounded-lg p-2 text-[10px] text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                        <div>
                                            <span className="font-bold text-cyan-800">Fórmula de Planta: </span>
                                            <span className="font-mono text-[10.5px] text-slate-800">% Agua = [(Sólidos Base − Sólidos Target) ÷ Sólidos Base] × 100</span>
                                        </div>
                                        <div className="font-bold text-cyan-900">
                                            Lote: {(parseFloat(calcParams.batch_size_lbs) || 12000).toLocaleString()} lbs
                                        </div>
                                    </div>

                                    {/* Desglose de componentes para el Batch actual */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                        <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Huevo Líquido Puro</span>
                                            <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                                {(calculationResult?.formulation?.base_liquid_pure_lbs || (parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.water_added_pct || 0) / 100)))).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                            </span>
                                        </div>

                                        <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Agua Purificada</span>
                                            <span className="font-bold text-cyan-700 text-xs mt-0.5 block">
                                                {(calculationResult?.formulation?.water_lbs || (parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.water_added_pct || 0) / 100))).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs
                                            </span>
                                        </div>

                                        <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Garrafones (42 lb)</span>
                                            <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                                {(calculationResult?.formulation?.water_garrafones || ((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.water_added_pct || 0) / 100)) / 42.0)).toFixed(1)} u
                                            </span>
                                        </div>

                                        <div className="bg-white p-2 rounded-lg border border-cyan-200">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Ácido Cítrico 0.1%</span>
                                            <span className="font-bold text-amber-700 text-xs mt-0.5 block">
                                                {(calculationResult?.formulation?.citric_acid_lbs || (parseFloat(calcParams.batch_size_lbs || 12000) * 0.001)).toFixed(1)} lbs
                                            </span>
                                        </div>
                                    </div>

                                    {/* Resumen de impacto económico de la formulación */}
                                    <div className="flex items-center justify-between text-[10px] bg-cyan-100/60 p-2 rounded-lg text-cyan-900">
                                        <span>
                                            Costo MP Puro: <strong>${(calculationResult?.formulation?.pure_egg_cost_per_lb || 0).toFixed(2)}/lb</strong>
                                        </span>
                                        <span>
                                            Costo MP Formulado: <strong>${(calculationResult?.formulation?.formulated_mp_cost_per_lb || calculationResult?.breakdown?.mp_cost_per_lb || 0).toFixed(2)}/lb</strong>
                                        </span>
                                        <span className="text-emerald-700 font-bold">
                                            Ahorro: -${(calculationResult?.formulation?.mp_cost_savings_per_lb || 0).toFixed(2)}/lb
                                        </span>
                                    </div>
                                </div>
                            ) : null}

                            {/* FORMULACIÓN YEMA AZUCARADA */}
                            {calcParams.product_type.toLowerCase().includes('azucarada') && (
                                <div className="pt-3 pb-3 px-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
                                    <div className="flex items-center justify-between text-amber-900 font-bold text-xs uppercase">
                                        <span className="flex items-center gap-1.5">
                                            <Package className="w-4 h-4 text-amber-600" />
                                            Formulación Yema Azucarada
                                        </span>
                                        <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                            Azúcar Industrial ($0.45/lb)
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">% Azúcar</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={calcParams.sugar_added_pct}
                                                onChange={(e) => handleParamChange('sugar_added_pct', e.target.value)}
                                                className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                                            />
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-amber-200 text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Libras de Azúcar</span>
                                            <span className="font-bold text-amber-800 text-xs mt-0.5 block">
                                                {((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.sugar_added_pct || 4) / 100))).toLocaleString()} lbs
                                            </span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-amber-200 text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Yema Pura Requerida</span>
                                            <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                                {((parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.sugar_added_pct || 4) / 100)))).toLocaleString()} lbs
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FORMULACIÓN YEMA SALADA */}
                            {calcParams.product_type.toLowerCase().includes('salada') && (
                                <div className="pt-3 pb-3 px-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                                    <div className="flex items-center justify-between text-blue-900 font-bold text-xs uppercase">
                                        <span className="flex items-center gap-1.5">
                                            <Scale className="w-4 h-4 text-blue-600" />
                                            Formulación Yema Salada
                                        </span>
                                        <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                            Sal Refinada ($0.15/lb)
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">% Sal Industrial</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={calcParams.salt_added_pct}
                                                onChange={(e) => handleParamChange('salt_added_pct', e.target.value)}
                                                className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                                            />
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Libras de Sal</span>
                                            <span className="font-bold text-blue-800 text-xs mt-0.5 block">
                                                {((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.salt_added_pct || 10) / 100))).toLocaleString()} lbs
                                            </span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Yema Pura Requerida</span>
                                            <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                                {((parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.salt_added_pct || 10) / 100)))).toLocaleString()} lbs
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* FORMULACIÓN HUEVO CON LECHE */}
                            {calcParams.product_type.toLowerCase().includes('leche') && (
                                <div className="pt-3 pb-3 px-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
                                    <div className="flex items-center justify-between text-purple-900 font-bold text-xs uppercase">
                                        <span className="flex items-center gap-1.5">
                                            <Droplets className="w-4 h-4 text-purple-600" />
                                            Formulación Huevo con Leche (Institucional)
                                        </span>
                                        <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                                            Leche en Polvo ($1.80/lb)
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">% Leche en Polvo</label>
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={calcParams.milk_added_pct}
                                                onChange={(e) => handleParamChange('milk_added_pct', e.target.value)}
                                                className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm"
                                            />
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-purple-200 text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Lbs Leche en Polvo</span>
                                            <span className="font-bold text-purple-800 text-xs mt-0.5 block">
                                                {((parseFloat(calcParams.batch_size_lbs || 12000) * (parseFloat(calcParams.milk_added_pct || 5) / 100))).toLocaleString()} lbs
                                            </span>
                                        </div>
                                        <div className="bg-white p-2 rounded-lg border border-purple-200 text-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Huevo Líquido Base</span>
                                            <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                                                {((parseFloat(calcParams.batch_size_lbs || 12000) * (1 - (parseFloat(calcParams.milk_added_pct || 5) / 100)))).toLocaleString()} lbs
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Botón para alternar nivelación de sólidos en cualquier momento */}
                            {!calcParams.product_type.toLowerCase().includes('plus') && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomSolids(!showCustomSolids)}
                                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                                    >
                                        <Droplets className="w-3.5 h-3.5" />
                                        <span>{showCustomSolids ? 'Ocultar nivelación de sólidos' : '+ Ajustar sólidos / balance hídrico'}</span>
                                    </button>
                                </div>
                            )}

                            {/* Prorrateo GIF Mensual */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between text-slate-700 font-bold text-[11px] uppercase">
                                    <span>Prorrateo GIF Mensual</span>
                                    <span className="text-[10px] text-slate-500 font-normal">Base 100k Lbs</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">GIF Total ($/mes)</label>
                                        <input
                                            type="number"
                                            value={calcParams.custom_gif_monthly}
                                            onChange={(e) => handleParamChange('custom_gif_monthly', e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Volumen Proyectado (Lbs)</label>
                                        <input
                                            type="number"
                                            value={calcParams.custom_monthly_volume_lbs}
                                            onChange={(e) => handleParamChange('custom_monthly_volume_lbs', e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel de Resultados y Desglose */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* BANNER DESTACADO: ARBITRAJE COMERCIAL POR SEPARACIÓN Y ADITIVO H2O */}
                        {calculationResult?.separation_data?.is_separation_mode && (
                            <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 rounded-2xl p-6 text-white shadow-xl border border-emerald-500/40 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                                            <Sparkles className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-wider">
                                                Arbitraje Industrial: Separación & Reconstitución con H2O
                                            </h4>
                                            <p className="text-xs text-emerald-200/80">
                                                Doble producto de alto margen: Venta de Clara a precio premium + Huevo Entero Formulado a costo mínimo
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right self-start sm:self-auto">
                                        <span className="text-[10px] font-bold text-emerald-300 uppercase block">Costo MP Formulado</span>
                                        <div className="text-2xl font-black text-emerald-400">
                                            <Money value={calculationResult.separation_data.mp_cost_per_lb_formulated || 0} />
                                            <span className="text-xs text-emerald-200 font-normal"> /lb</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* 1. Clara Separada para Venta Premium */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div className="flex items-center justify-between text-emerald-300 text-xs font-bold uppercase mb-2.5 pb-1 border-b border-white/10">
                                            <span>1. Venta de Clara Premium</span>
                                            <span className="text-emerald-400 font-black">
                                                <Money value={calculationResult.separation_data.clara_sale_price || 0} /> /lb
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between text-indigo-100">
                                                <span>Volumen de Clara Vendida:</span>
                                                <strong className="text-white">{(calculationResult.separation_data.clara_for_sale_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs</strong>
                                            </div>
                                            <div className="flex justify-between text-indigo-100">
                                                <span>Ingreso Total Obtenido:</span>
                                                <strong className="text-emerald-300 font-black text-sm"><Money value={calculationResult.separation_data.clara_revenue || 0} /></strong>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-indigo-200/80 pt-1 border-t border-white/10">
                                                <span>Utilidad Neta de la Clara:</span>
                                                <span className="text-emerald-400 font-bold">+<Money value={calculationResult.separation_data.clara_profit || 0} /></span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Huevo Entero Formulado con H2O */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <div className="flex items-center justify-between text-amber-200 text-xs font-bold uppercase mb-2.5 pb-1 border-b border-white/10">
                                            <span>2. Huevo Formulado (Yema + H2O)</span>
                                            <span className="text-amber-300 font-black">
                                                {calculationResult.separation_data.target_solids_pct}% Sólidos
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between text-amber-100">
                                                <span>Producción Huevo Formulado:</span>
                                                <strong className="text-white">{(calculationResult.separation_data.final_formulated_lbs || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs</strong>
                                            </div>
                                            <div className="flex justify-between text-amber-100">
                                                <span>Agua Purificada Adicionada:</span>
                                                <strong className="text-cyan-300">{(calculationResult.separation_data.h2o_garrafones || 0).toFixed(1)} garrafones (42 lb)</strong>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-amber-200/80 pt-1 border-t border-white/10">
                                                <span>Ahorro en Materia Prima:</span>
                                                <span className="text-emerald-400 font-bold">-<Money value={calculationResult.separation_data.mp_cost_reduction_per_lb || 0} /> /lb</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-emerald-950/80 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                    <div className="text-emerald-200">
                                        El ingreso de <strong className="text-emerald-400"><Money value={calculationResult.separation_data.clara_revenue || 0} /></strong> por venta de clara cubre y subsidia el lote de huevo cáscara, bajando el costo de materia prima a solo <strong className="text-white"><Money value={calculationResult.separation_data.mp_cost_per_lb_formulated || 0} />/lb</strong>.
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tarjeta Principal de Costo por Libra */}
                        <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                                        Costo Unitario Calculado
                                    </span>
                                    <div className="text-4xl font-black tracking-tight mt-1 flex items-baseline gap-2">
                                        <span>${(calculationResult?.breakdown?.total_cost_per_lb || 0).toFixed(2)}</span>
                                        <span className="text-base font-semibold text-indigo-200">/ Libra</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-medium">
                                            Presentación ({calcParams.presentation}):{' '}
                                            <strong className="text-white">
                                                ${(calculationResult?.breakdown?.cost_per_unit || 0).toFixed(2)}
                                            </strong>
                                        </span>
                                        <span className="text-xs bg-white/10 px-2.5 py-1 rounded-lg font-medium">
                                            Rendimiento Líquido:{' '}
                                            <strong className="text-emerald-300">
                                                {calculationResult?.parameters_used?.liquid_yield_pct || 83}%
                                            </strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="text-right sm:border-l sm:border-white/15 sm:pl-6">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block">
                                        Lote Completo ({(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs)
                                    </span>
                                    <div className="text-2xl font-black tracking-tight mt-0.5 text-indigo-100">
                                        ${((calculationResult?.breakdown?.total_cost_per_lb || 0) * (parseFloat(calcParams.batch_size_lbs) || 0)).toFixed(2)}
                                    </div>
                                    <span className="text-[10px] text-indigo-200 block mt-1">
                                        Equivalente a {Math.round((parseFloat(calcParams.batch_size_lbs) || 0) / (calculationResult?.presentation_lbs || 30))} unidades
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Desglose de Factores de Absorción */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-indigo-600" />
                                    <span>Estructura Desglosada del Costo por Libra</span>
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">Suma de Factores Unitarios</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    {
                                        label: 'Materia Prima (Huevo Líquido)',
                                        value: calculationResult?.breakdown?.mp_cost_per_lb || 0,
                                        icon: Package,
                                        color: 'text-amber-600',
                                        bg: 'bg-amber-50/80',
                                        desc: calculationResult?.separation_data?.is_separation_mode
                                            ? `Formulado con H2O y crédito de clara (Ahorro -$${(calculationResult.separation_data.mp_cost_reduction_per_lb || 0).toFixed(2)}/lb)`
                                            : calculationResult?.formulation?.water_added_pct > 0 
                                                ? `Base puro $${(calculationResult.formulation.pure_egg_cost_per_lb || 0).toFixed(2)} (Ahorro -$${(calculationResult.formulation.mp_cost_savings_per_lb || 0).toFixed(2)})`
                                                : 'Huevo cáscara descontando 17% cáscara'
                                    },
                                    {
                                        label: 'Empaque & Etiquetas',
                                        value: calculationResult?.breakdown?.packaging_cost_per_lb || 0,
                                        icon: Package,
                                        color: 'text-blue-600',
                                        bg: 'bg-blue-50/80',
                                        desc: 'Cubeta, tapa, liner, etiqueta 4x2'
                                    },
                                    {
                                        label: 'Químicos Sanitización CIP',
                                        value: calculationResult?.breakdown?.cip_cost_per_lb || 0,
                                        icon: Droplets,
                                        color: 'text-cyan-600',
                                        bg: 'bg-cyan-50/80',
                                        desc: `$${(calculationResult?.breakdown?.cip_total_batch_cost || 50.85).toFixed(2)} por batch`
                                    },
                                    {
                                        label: 'Caldera, Vapor & Energía',
                                        value: calculationResult?.breakdown?.boiler_energy_cost_per_lb || 0,
                                        icon: Flame,
                                        color: 'text-orange-600',
                                        bg: 'bg-orange-50/80',
                                        desc: 'Diesel caldera + Energía + Agua'
                                    },
                                    {
                                        label: 'Mano de Obra Directa (MOD)',
                                        value: calculationResult?.breakdown?.mod_cost_per_lb || 0,
                                        icon: Users,
                                        color: 'text-purple-600',
                                        bg: 'bg-purple-50/80',
                                        desc: '$0.0500 fijo por libra producida'
                                    },
                                    {
                                        label: 'Gastos Indirectos (GIF)',
                                        value: calculationResult?.breakdown?.gif_cost_per_lb || 0,
                                        icon: BarChart3,
                                        color: 'text-indigo-600',
                                        bg: 'bg-indigo-50/80',
                                        desc: 'Prorrateo mensual sobre volumen'
                                    }
                                ].map((item, idx) => {
                                    const Icon = item.icon;
                                    const total = calculationResult?.breakdown?.total_cost_per_lb || 1;
                                    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                                    return (
                                        <div key={idx} className={`p-3.5 rounded-xl border border-slate-200 ${item.bg}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <Icon className={`w-4 h-4 ${item.color}`} />
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-200 shadow-sm">
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tight line-clamp-1">
                                                {item.label}
                                            </div>
                                            <div className="text-base font-black text-slate-900 mt-0.5">
                                                <Money value={item.value} />
                                                <span className="text-[10px] text-slate-500 font-normal"> /lb</span>
                                            </div>
                                            <div className="text-[9px] text-slate-500 truncate mt-1">
                                                {item.desc}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Matriz Comparativa por Presentación y Empaque (Desplegable para evitar saturación) */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                            <div 
                                onClick={() => setShowPresentationsMatrixCalc(prev => !prev)}
                                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                            >
                                <div className="flex items-start sm:items-center gap-3">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 flex-shrink-0">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                                Matriz de Costeo por Presentación y Empaque
                                            </h3>
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                6 formatos
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            {showPresentationsMatrixCalc
                                                ? `Costo base líquido sin empaque: ${(calculationResult?.breakdown?.base_operating_cost_per_lb || 0).toFixed(2)}/lb. Haz clic para ocultar.`
                                                : 'Compara cómo varía el costo por libra según el empaque (Cubetas, Galones, Litros). Haz clic para desplegar.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 self-end sm:self-center">
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                                        Activo: <strong className="text-indigo-700">{calcParams.presentation}</strong>
                                    </span>
                                    <button
                                        type="button"
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        <span>{showPresentationsMatrixCalc ? 'Ocultar' : 'Desplegar'}</span>
                                        {showPresentationsMatrixCalc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {showPresentationsMatrixCalc && (
                                <div className="p-6 pt-0 space-y-4 border-t border-slate-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3">
                                        <p className="text-xs text-slate-500 font-medium">
                                            Costo base operacional líquido: <strong className="text-indigo-700 font-bold"><Money value={calculationResult?.breakdown?.base_operating_cost_per_lb || 0} /> /lb</strong>. El costo de empaque modifica el costo final por libra y por envase:
                                        </p>
                                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                                            Lote: {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="py-3 px-3.5">Presentación</th>
                                                    <th className="py-3 px-3 text-right">Empaque / Envase</th>
                                                    <th className="py-3 px-3 text-right">Empaque / Lb</th>
                                                    <th className="py-3 px-3.5 text-right">Costo Total / Lb</th>
                                                    <th className="py-3 px-3.5 text-right">Costo / Envase</th>
                                                    <th className="py-3 px-3 text-right">Precio Sug. (20% Margen)</th>
                                                    <th className="py-3 px-3 text-right">Rendimiento</th>
                                                    <th className="py-3 px-3 text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {(calculationResult?.presentations_comparison || []).map((row, idx) => {
                                                    const isSelected = row.is_current || (calcParams.presentation || '').toLowerCase().includes(row.lbs.toString());
                                                    const packPct = row.total_cost_per_lb > 0 ? ((row.packaging_cost_lb / row.total_cost_per_lb) * 100).toFixed(1) : 0;
                                                    return (
                                                        <tr key={idx} className={`transition-colors ${isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50/80'}`}>
                                                            <td className="py-3 px-3.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                                        <Package className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                                            <span>{row.short_name}</span>
                                                                            {isSelected && (
                                                                                <span className="text-[9px] font-black uppercase bg-indigo-600 text-white px-1.5 py-0.2 rounded tracking-wider">
                                                                                    Activo
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400 font-medium">{row.lbs} Libras netas</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-right font-medium text-slate-700">
                                                                <div><Money value={row.packaging_cost_unit} /></div>
                                                                <span className="text-[9px] text-slate-400 font-normal">
                                                                    Env: ${(row.packaging_breakdown?.container_cost || 0).toFixed(2)} + Tap: ${(row.packaging_breakdown?.lid_cost || 0).toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <div className="font-bold text-blue-700"><Money value={row.packaging_cost_lb} />/lb</div>
                                                                <span className="text-[9px] text-slate-400 font-normal">{packPct}% del costo</span>
                                                            </td>
                                                            <td className="py-3 px-3.5 text-right">
                                                                <span className="font-black text-indigo-950 text-sm">
                                                                    <Money value={row.total_cost_per_lb} />
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-normal block">/lb</span>
                                                            </td>
                                                            <td className="py-3 px-3.5 text-right font-black text-slate-900">
                                                                <Money value={row.total_cost_per_unit} />
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <span className="font-black text-emerald-700">
                                                                    <Money value={row.suggested_prices?.margin_20?.price_unit || 0} />
                                                                </span>
                                                                <span className="text-[9px] text-slate-500 block font-normal">
                                                                    (<Money value={row.suggested_prices?.margin_20?.price_lb || 0} />/lb)
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <span className="font-bold text-slate-800">{row.units_in_batch?.toLocaleString()}</span>
                                                                <span className="text-[10px] text-slate-400 block font-normal">unidades</span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                {isSelected ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                        <span>Seleccionado</span>
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleParamChange('presentation', row.id)}
                                                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg shadow-sm transition-all"
                                                                    >
                                                                        Seleccionar
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: SIMULADOR COMERCIAL & MATRIZ DE RENTABILIDAD */}
            {activeTab === 'simulator' && (
                <div className="space-y-6">
                    {/* Simulador Rápido con Precio Libre */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <span>Simulador de Margen y Precios de Venta</span>
                                </h2>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Proyecta el margen bruto y ganancia total para cualquier precio ofertado a clientes.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-700">Precio Objetivo a Simular:</label>
                                <div className="w-36">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="1.25"
                                        value={calcParams.target_sale_price_per_lb}
                                        onChange={(e) => handleParamChange('target_sale_price_per_lb', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cards de Métricas del Simulador */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Costo Unitario Base</span>
                                <div className="text-xl font-black text-slate-900 mt-1">
                                    <Money value={calculationResult?.breakdown?.total_cost_per_lb || 0} />
                                    <span className="text-xs font-medium text-slate-500"> /lb</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Costo total por libra</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Margen Bruto ($/lb)</span>
                                <div className={`text-xl font-black mt-1 ${
                                    (calculationResult?.target_simulation?.margin_per_lb || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                    <Money value={calculationResult?.target_simulation?.margin_per_lb || 0} />
                                    <span className="text-xs font-medium text-slate-500"> /lb</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Ganancia neta por libra</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Margen Porcentual (%)</span>
                                <div className="text-xl font-black mt-1 flex items-center gap-2">
                                    <span className={
                                        (calculationResult?.target_simulation?.margin_pct || 0) >= 20
                                            ? 'text-emerald-600'
                                            : (calculationResult?.target_simulation?.margin_pct || 0) >= 10
                                            ? 'text-amber-600'
                                            : 'text-rose-600'
                                    }>
                                        {calculationResult?.target_simulation?.margin_pct?.toFixed(1) || 0}%
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500">Rentabilidad sobre venta</span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Ganancia Lote Completo</span>
                                <div className="text-xl font-black text-indigo-700 mt-1">
                                    <Money value={(calculationResult?.target_simulation?.margin_per_lb || 0) * (parseFloat(calcParams.batch_size_lbs) || 0)} />
                                </div>
                                <span className="text-[10px] text-slate-500">Para {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs</span>
                            </div>
                        </div>
                    </div>

                    {/* Grid en 2 Columnas: Izquierda = Matriz Escalonada de Margen | Derecha = Simulación Multiformato por Presentación */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Columna Izquierda: Matriz de Precios Sugeridos por Margen */}
                        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="pb-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                                    <span>Escala de Precios por Margen</span>
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Presentación activa: <strong className="text-indigo-700 font-bold">{calcParams.presentation}</strong>
                                </p>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-3 px-3">Margen</th>
                                            <th className="py-3 px-3 text-right">Precio / Lb</th>
                                            <th className="py-3 px-3 text-right">Precio / Envase</th>
                                            <th className="py-3 px-3 text-right">Utilidad Lote</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {(calculationResult?.target_simulation?.margin_matrix || []).map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-block ${
                                                        row.margin_target_pct >= 25
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : row.margin_target_pct >= 15
                                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {row.margin_target_pct}%
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-slate-900">
                                                    <Money value={row.suggested_price_per_lb} />
                                                </td>
                                                <td className="py-3 px-3 text-right font-medium text-slate-700">
                                                    <Money value={row.suggested_price_per_presentation} />
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-indigo-700">
                                                    <Money value={row.batch_gain} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Columna Derecha: Simulación Multiformato por Presentación (Desplegable para evitar saturación) */}
                        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                            <div 
                                onClick={() => setShowPresentationsMatrixSim(prev => !prev)}
                                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
                            >
                                <div className="flex items-start sm:items-center gap-3">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                                Simulación por Presentación y Empaque
                                            </h3>
                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                Multiformato
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            {showPresentationsMatrixSim
                                                ? `Impacto del precio simulado de ${(parseFloat(calcParams.target_sale_price_per_lb) || 0).toFixed(2)}/lb en cada formato. Haz clic para ocultar.`
                                                : 'Márgenes y utilidades por formato al precio simulado. Haz clic para desplegar.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 self-end sm:self-center">
                                    <button
                                        type="button"
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                                    >
                                        <span>{showPresentationsMatrixSim ? 'Ocultar' : 'Desplegar'}</span>
                                        {showPresentationsMatrixSim ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {showPresentationsMatrixSim && (
                                <div className="p-6 pt-0 space-y-4 border-t border-slate-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3">
                                        <p className="text-xs text-slate-500 font-medium">
                                            Impacto del precio simulado de <strong className="text-slate-900 font-bold"><Money value={parseFloat(calcParams.target_sale_price_per_lb) || 0} /> /lb</strong> en cada formato:
                                        </p>
                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                                            Lote: {(parseFloat(calcParams.batch_size_lbs) || 0).toLocaleString()} Lbs
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="py-3 px-3.5">Presentación</th>
                                                    <th className="py-3 px-3 text-right">Costo / Envase</th>
                                                    <th className="py-3 px-3 text-right">Precio Venta</th>
                                                    <th className="py-3 px-3 text-right">Margen / Envase</th>
                                                    <th className="py-3 px-3 text-center">Margen %</th>
                                                    <th className="py-3 px-3.5 text-right">Utilidad Lote</th>
                                                    <th className="py-3 px-3 text-right">Precio Sug. 20%</th>
                                                    <th className="py-3 px-3 text-center">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {(calculationResult?.presentations_comparison || []).map((row, idx) => {
                                                    const isSelected = row.is_current || (calcParams.presentation || '').toLowerCase().includes(row.lbs.toString());
                                                    const hasSimPrice = (parseFloat(calcParams.target_sale_price_per_lb) || 0) > 0;
                                                    const marginPct = row.simulation?.margin_pct || 0;
                                                    const marginPerUnit = row.simulation?.gain_per_unit || 0;
                                                    const totalBatchGain = row.simulation?.total_batch_gain || 0;

                                                    return (
                                                        <tr key={idx} className={`transition-colors ${isSelected ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : 'hover:bg-slate-50/80'}`}>
                                                            <td className="py-3 px-3.5">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                                        <Package className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                                            <span>{row.short_name}</span>
                                                                            {isSelected && (
                                                                                <span className="text-[9px] font-black uppercase bg-indigo-600 text-white px-1.5 py-0.2 rounded tracking-wider">
                                                                                    Activo
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                                            Empaque: <Money value={row.packaging_cost_lb} />/lb
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <div className="font-bold text-slate-900"><Money value={row.total_cost_per_unit} /></div>
                                                                <span className="text-[9px] text-slate-400 font-normal">(<Money value={row.total_cost_per_lb} />/lb)</span>
                                                            </td>
                                                            <td className="py-3 px-3 text-right font-black text-slate-900">
                                                                {hasSimPrice ? (
                                                                    <Money value={row.simulation?.sale_price_unit || 0} />
                                                                ) : (
                                                                    <span className="text-slate-400 text-[11px] font-normal italic">Sin precio</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                {hasSimPrice ? (
                                                                    <span className={`font-black ${marginPerUnit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        {marginPerUnit >= 0 ? '+' : ''}<Money value={marginPerUnit} />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-normal">-</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                {hasSimPrice ? (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black inline-block ${
                                                                        marginPct >= 20
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : marginPct >= 10
                                                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                    }`}>
                                                                        {marginPct.toFixed(1)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-normal">-</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3.5 text-right font-black text-indigo-900">
                                                                {hasSimPrice ? (
                                                                    <span className={totalBatchGain >= 0 ? 'text-indigo-900' : 'text-rose-600'}>
                                                                        <Money value={totalBatchGain} />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 font-normal">-</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <span className="font-bold text-emerald-700">
                                                                    <Money value={row.suggested_prices?.margin_20?.price_unit || 0} />
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 block font-normal">
                                                                    (<Money value={row.suggested_prices?.margin_20?.price_lb || 0} />/lb)
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                {isSelected ? (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                        <span>Seleccionado</span>
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleParamChange('presentation', row.id)}
                                                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg shadow-sm transition-all"
                                                                    >
                                                                        Seleccionar
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ACUERDOS CON CLIENTES & SEMÁFORO */}
            {activeTab === 'clients' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span>Acuerdos Comerciales & Semáforo de Margen por Cliente</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Compara precios pactados contra el costo actual de absorción para evaluar la rentabilidad y vigencia de cada contrato.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/crm/acuerdos')}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-200 transition-all"
                            >
                                <Handshake className="w-4 h-4 text-indigo-600" />
                                <span>Módulo CRM Acuerdos</span>
                            </button>
                            <button
                                onClick={() => setAgreementModal({ open: true, data: {} })}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Nuevo Acuerdo de Precio</span>
                            </button>
                        </div>
                    </div>

                    {/* Filtros de Vigencia */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-sm">
                        <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtrar por Vigencia:</span>
                        {[
                            { id: 'todos', label: 'Todos los Acuerdos' },
                            { id: 'vigente', label: 'Vigentes' },
                            { id: 'por_vencer', label: 'Por Vencer (≤30 días)' },
                            { id: 'vencido', label: 'Vencidos' },
                            { id: 'programado', label: 'Programados' }
                        ].map(f => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setValidityFilter(f.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    validityFilter === f.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="py-3 px-4">Cliente</th>
                                        <th className="py-3 px-3">Producto / Presentación</th>
                                        <th className="py-3 px-3">Vigencia del Acuerdo</th>
                                        <th className="py-3 px-3 text-right">Precio Pactado</th>
                                        <th className="py-3 px-3 text-right">Costo + Flete</th>
                                        <th className="py-3 px-3 text-right">Margen $/Lb</th>
                                        <th className="py-3 px-3 text-center">Semáforo</th>
                                        <th className="py-3 px-3 text-right">Volumen Mes</th>
                                        <th className="py-3 px-3 text-right">Utilidad Bruta</th>
                                        <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {(calculationResult?.clients_comparison || [])
                                        .filter(client => {
                                            if (validityFilter === 'todos') return true;
                                            return client.validity_status === validityFilter;
                                        })
                                        .map((client) => {
                                            const badgeClass =
                                                client.status === 'green'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : client.status === 'yellow'
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200';

                                            return (
                                                <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-slate-900">
                                                        {client.customer_name}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="block text-slate-800">{client.product_type}</span>
                                                        <span className="text-[10px] text-slate-500">{client.presentation}</span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="space-y-1">
                                                            {client.validity_status === 'vigente' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                    Vigente
                                                                </span>
                                                            )}
                                                            {client.validity_status === 'por_vencer' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    <Clock className="w-3 h-3 text-amber-600" />
                                                                    Vence en {client.days_remaining}d
                                                                </span>
                                                            )}
                                                            {client.validity_status === 'vencido' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                                    Vencido
                                                                </span>
                                                            )}
                                                            {client.validity_status === 'programado' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                    <Calendar className="w-3 h-3 text-indigo-600" />
                                                                    Programado
                                                                </span>
                                                            )}
                                                            {!client.validity_status && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    Indefinido
                                                                </span>
                                                            )}
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {client.valid_from ? new Date(client.valid_from).toLocaleDateString() : 'Sin inicio'}
                                                                {' → '}
                                                                {client.valid_to ? new Date(client.valid_to).toLocaleDateString() : 'Permanente'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-slate-900">
                                                        <Money value={client.agreed_price} />
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                                                        <Money value={client.effective_cost} />
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-bold text-emerald-600">
                                                        <Money value={client.margin_per_lb} />
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                                                            {client.margin_pct ? client.margin_pct.toFixed(1) : 0}%
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                                                        {(client.monthly_volume_lbs || 0).toLocaleString()} Lbs
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-indigo-700">
                                                        <Money value={client.monthly_profit} />
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleOpenAgreementHistory(client)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold"
                                                                title="Ver Historial de Precios y Revisiones"
                                                            >
                                                                <History className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setAgreementModal({ open: true, data: client })}
                                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold"
                                                                title="Editar Acuerdo"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteAgreement(client.id)}
                                                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold"
                                                                title="Eliminar Acuerdo"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: INSUMOS, EMPAQUES Y CIP (CON BOTONES Y MODALES PARA AGREGAR) */}
            {activeTab === 'catalog' && (
                <div className="space-y-6">
                    {/* Parámetros de Caldera, Vapor & GIF */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                    <Flame className="w-4 h-4 text-amber-600" />
                                    <span>Parámetros de Caldera, Vapor & Gastos Indirectos (GIF)</span>
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Constantes energéticas y prorrateos de planta para absorción por lote.
                                </p>
                            </div>
                            <button
                                onClick={() => setConfigModal({ open: true, data: { ...configs } })}
                                className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all self-start sm:self-auto"
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                <span>Editar Parámetros de Planta</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Diesel Caldera</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    {configs.boiler_diesel_gal_batch || 20.84} gal
                                </span>
                                <span className="text-[10px] text-slate-400">@ ${configs.boiler_diesel_price_gal || 4.14}/gal</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Electricidad</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${configs.boiler_kwh_cost_batch || 386.00}
                                </span>
                                <span className="text-[10px] text-slate-400">Por batch</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Agua Caldera</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${configs.boiler_water_cost_batch || 17.34}
                                </span>
                                <span className="text-[10px] text-slate-400">Por batch</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Mano de Obra</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${configs.mod_cost_per_lb || 0.0500}
                                </span>
                                <span className="text-[10px] text-slate-400">Por libra</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">GIF Mensual</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    ${(configs.monthly_gif_total || 24537.00).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400">Total fijo</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Volumen Base</span>
                                <span className="text-sm font-black text-slate-900 mt-1 block">
                                    {(configs.monthly_projected_lbs || 100000).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400">Libras / mes</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Químicos CIP */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                        <Droplets className="w-4 h-4 text-cyan-600" />
                                        <span>Químicos CIP & Sanitización</span>
                                    </h3>
                                    <span className="text-xs text-slate-500 font-medium">Por ciclo de pasteurizador</span>
                                </div>
                                <button
                                    onClick={() => setCipModal({ open: true, data: { status: 'activo' } })}
                                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Agregar Químico</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-2.5 px-3">Químico</th>
                                            <th className="py-2.5 px-3">Presentación</th>
                                            <th className="py-2.5 px-3 text-right">Costo Pres.</th>
                                            <th className="py-2.5 px-3 text-right">Dosis Batch</th>
                                            <th className="py-2.5 px-3 text-right">Costo/Ciclo</th>
                                            <th className="py-2.5 px-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {cipItems.map((cip) => {
                                            const unitPrice = parseFloat(cip.presentation_cost) / (parseFloat(cip.presentation_qty) || 1);
                                            const cycleCost = unitPrice * (parseFloat(cip.dose_per_batch) || 0);
                                            return (
                                                <tr key={cip.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-2.5 px-3 font-bold text-slate-900">{cip.item_name}</td>
                                                    <td className="py-2.5 px-3 text-slate-600">{cip.presentation_qty} {cip.presentation_unit}</td>
                                                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                                                        <Money value={cip.presentation_cost} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                                                        {cip.dose_per_batch} {cip.dose_unit}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-black text-cyan-700">
                                                        <Money value={cycleCost} />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => setCipModal({ open: true, data: cip })}
                                                                className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteCipItem(cip.id)}
                                                                className="p-1 text-slate-500 hover:text-rose-600 rounded"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Empaques */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-emerald-600" />
                                        <span>Catálogo de Materiales & Empaques</span>
                                    </h3>
                                    <span className="text-xs text-slate-500 font-medium">Cubetas, tapaderas, liners y etiquetas</span>
                                </div>
                                <button
                                    onClick={() => setPackagingModal({ open: true, data: { category: 'recipiente' } })}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Agregar Empaque</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="py-2.5 px-3">Código</th>
                                            <th className="py-2.5 px-3">Descripción</th>
                                            <th className="py-2.5 px-3">Categoría</th>
                                            <th className="py-2.5 px-3 text-right">Costo Unit.</th>
                                            <th className="py-2.5 px-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                        {packagingItems.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">{p.item_code}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-900">{p.item_name}</td>
                                                <td className="py-2.5 px-3">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                                        {p.category}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                                    <Money value={p.unit_cost} />
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setPackagingModal({ open: true, data: p })}
                                                            className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePackagingItem(p.id)}
                                                            className="p-1 text-slate-500 hover:text-rose-600 rounded"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: HISTÓRICO Y ESCENARIOS */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <History className="w-4 h-4 text-indigo-600" />
                                <span>Historial Operacional, Escenarios y Auditoría de Precios</span>
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Analiza el rendimiento real acumulado de planta, compara escenarios guardados o audita las revisiones de acuerdos de clientes.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
                            <button
                                type="button"
                                onClick={() => setHistorySubTab('real_production')}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                    historySubTab === 'real_production'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Producción Real & Costo/Lb
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistorySubTab('scenarios')}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                    historySubTab === 'scenarios'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Escenarios Simulados ({scenarios.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setHistorySubTab('agreements_history');
                                    loadGlobalAgreementHistory();
                                }}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                    historySubTab === 'agreements_history'
                                        ? 'bg-white text-indigo-700 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Historial de Tarifas Clientes
                            </button>
                        </div>
                    </div>

                    {/* SUB-VISTA 1: HISTÓRICO REAL DE PRODUCCIÓN Y COSTOS */}
                    {historySubTab === 'real_production' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                                        Rendimiento y Costo Real de Planta por Período
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                        Consolidado mensual de lotes procesados, rendimientos líquidos y costo promedio por libra.
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {loadingHistory && <RefreshCcw className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
                                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl">
                                        {costingHistoryList.length} períodos registrados
                                    </span>
                                </div>
                            </div>

                            {costingHistoryList.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Factory className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                                    <p className="text-xs font-medium">No hay lotes con costos calculados en el rango de fechas seleccionado.</p>
                                    <button
                                        onClick={() => handlePresetChange('all')}
                                        className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all"
                                    >
                                        Ver Todo el Histórico
                                    </button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                <th className="py-3 px-4">Período</th>
                                                <th className="py-3 px-3">Producto</th>
                                                <th className="py-3 px-3 text-right">Lotes</th>
                                                <th className="py-3 px-3 text-right">Entrada MP (Lbs)</th>
                                                <th className="py-3 px-3 text-right">Líquido Obtenido</th>
                                                <th className="py-3 px-3 text-center">Rendimiento Real</th>
                                                <th className="py-3 px-3 text-right">Costo Total</th>
                                                <th className="py-3 px-4 text-right font-black">Costo Promedio / Lb</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {costingHistoryList.map((row, idx) => {
                                                const yieldPct = row.total_input_lbs > 0
                                                    ? ((row.total_yield_lbs / row.total_input_lbs) * 100).toFixed(1)
                                                    : '0.0';
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                                            {row.period}
                                                        </td>
                                                        <td className="py-3 px-3 text-slate-800">
                                                            {row.product_type}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-600">
                                                            {row.batches_count}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-600">
                                                            {parseFloat(row.total_input_lbs || 0).toLocaleString()} lbs
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-900 font-bold">
                                                            {parseFloat(row.total_yield_lbs || 0).toLocaleString()} lbs
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                {yieldPct}%
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-slate-700">
                                                            <Money value={row.total_cost} />
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-black text-indigo-700">
                                                            <Money value={row.avg_cost_per_lb} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUB-VISTA 2: ESCENARIOS GUARDADOS */}
                    {historySubTab === 'scenarios' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {scenarios.map((scen) => (
                                <div key={scen.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="text-sm font-bold text-slate-900">{scen.scenario_name}</h4>
                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold shrink-0">
                                            {new Date(scen.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-600 space-y-1">
                                        <div>Producto: <strong className="text-slate-900">{scen.product_type}</strong></div>
                                        <div>Presentación: <strong className="text-slate-900">{scen.presentation}</strong></div>
                                        <div>Lote: <strong className="text-slate-900">{scen.batch_size_lbs?.toLocaleString()} Lbs</strong></div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-500 block">Costo / Lb</span>
                                            <strong className="text-slate-900 font-black">
                                                <Money value={scen.calculated_cost_per_lb} />
                                            </strong>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-500 block">Precio Sug. / Lb</span>
                                            <strong className="text-emerald-600 font-black">
                                                <Money value={scen.target_sale_price_per_lb} />
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SUB-VISTA 3: AUDITORÍA GLOBAL DE TARIFAS DE CLIENTES */}
                    {historySubTab === 'agreements_history' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                                        Auditoría Cronológica de Precios Pactados con Clientes
                                    </h4>
                                    <span className="text-[11px] text-slate-500">
                                        Registro histórico de cada cambio de tarifa, vigencia estipulada y motivo de ajuste.
                                    </span>
                                </div>
                                <button
                                    onClick={loadGlobalAgreementHistory}
                                    disabled={loadingGlobalHistory}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 ${loadingGlobalHistory ? 'animate-spin' : ''}`} />
                                    <span>Actualizar Historial</span>
                                </button>
                            </div>

                            {globalAgreementHistory.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                                    <p className="text-xs font-medium">Aún no hay cambios o revisiones de tarifas archivadas en el historial.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                <th className="py-3 px-4">Fecha de Ajuste</th>
                                                <th className="py-3 px-3">Cliente</th>
                                                <th className="py-3 px-3">Producto / Pres.</th>
                                                <th className="py-3 px-3 text-right">Tarifa Anterior</th>
                                                <th className="py-3 px-3 text-right">Nueva Tarifa</th>
                                                <th className="py-3 px-3">Vigencia Pactada</th>
                                                <th className="py-3 px-3">Motivo del Ajuste</th>
                                                <th className="py-3 px-4">Auditor / Usuario</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {globalAgreementHistory.map((h) => (
                                                <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3 px-4 font-mono text-slate-600">
                                                        {new Date(h.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-slate-900">
                                                        {h.customer_name}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="block text-slate-800">{h.product_type}</span>
                                                        <span className="text-[10px] text-slate-500">{h.presentation}</span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-slate-400 font-mono line-through">
                                                        {h.previous_price_per_lb ? <Money value={h.previous_price_per_lb} /> : '-'}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-emerald-600">
                                                        <Money value={h.agreed_price_per_lb} />
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                                                        {h.valid_from ? new Date(h.valid_from).toLocaleDateString() : 'Sin inicio'}
                                                        {' → '}
                                                        {h.valid_to ? new Date(h.valid_to).toLocaleDateString() : 'Permanente'}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-700 italic max-w-xs truncate" title={h.change_reason}>
                                                        {h.change_reason || 'Sin motivo especificado'}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600 font-medium">
                                                        {h.changed_by || 'Sistema'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: NUEVO / EDITAR ACUERDO DE PRECIO CON CLIENTE */}
            {agreementModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveAgreement} className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">
                                {agreementModal.data?.id ? 'Editar Acuerdo de Precios con Cliente' : 'Nuevo Acuerdo de Precios con Cliente'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setAgreementModal({ open: false, data: null })}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                    Nombre del Cliente o Empresa
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: PriceSmart El Salvador / Pastelería Lorena"
                                    value={agreementModal.data?.customer_name || ''}
                                    onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, customer_name: e.target.value } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                        Producto
                                    </label>
                                    <select
                                        value={agreementModal.data?.product_type || 'Huevo Entero Pasteurizado'}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, product_type: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="Huevo Entero Pasteurizado">Huevo Entero Pasteurizado</option>
                                        <option value="Huevo Entero Plus">Huevo Entero Plus</option>
                                        <option value="Clara de Huevo Pasteurizada">Clara Pasteurizada</option>
                                        <option value="Yema Azucarada">Yema Azucarada</option>
                                        <option value="Yema Salada">Yema Salada</option>
                                        <option value="Huevo con Leche">Huevo Entero con Leche</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                        Presentación
                                    </label>
                                    <select
                                        value={agreementModal.data?.presentation || 'cubeta 30LB'}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, presentation: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    >
                                        <option value="cubeta 30LB">Cubeta 30 LBS</option>
                                        <option value="cubeta 32LB">Cubeta 32 LBS</option>
                                        <option value="galón 8LB">Galón 8 LBS</option>
                                        <option value="medio galón 4LB">Medio Galón 4 LBS</option>
                                        <option value="litro 2LB">Litro 2 LBS</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                        Precio Pactado ($/Lb)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        required
                                        placeholder="1.20"
                                        value={agreementModal.data?.agreed_price_per_lb || ''}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, agreed_price_per_lb: parseFloat(e.target.value) || 0 } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                        Volumen Mes (Lbs)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="10000"
                                        value={agreementModal.data?.monthly_volume_lbs || ''}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, monthly_volume_lbs: parseFloat(e.target.value) || 0 } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                        Margen Obj (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        placeholder="20"
                                        value={agreementModal.data?.target_margin_pct || ''}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, target_margin_pct: parseFloat(e.target.value) || 20 } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* RANGO DE VIGENCIA DE LA TARIFA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Vigente Desde (Inicio)
                                    </label>
                                    <input
                                        type="date"
                                        value={agreementModal.data?.valid_from ? agreementModal.data.valid_from.split('T')[0] : ''}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, valid_from: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Vigente Hasta (Vencimiento)
                                    </label>
                                    <input
                                        type="date"
                                        value={agreementModal.data?.valid_to ? agreementModal.data.valid_to.split('T')[0] : ''}
                                        onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, valid_to: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <span className="sm:col-span-2 text-[10px] text-slate-400 font-medium">
                                    Opcional: Si se deja en blanco, la tarifa se considera permanente sin expiración automática.
                                </span>
                            </div>

                            {/* MOTIVO DEL CAMBIO / AJUSTE (AUDITORÍA) */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                    Motivo de Ajuste / Revisión de Tarifa
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Negociación semestral, incremento por alza en costo de huevo..."
                                    value={agreementModal.data?.change_reason || ''}
                                    onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, change_reason: e.target.value } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                    Notas y Condiciones Especiales
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Condición de pago, frecuencia de entrega, flete incluido..."
                                    value={agreementModal.data?.notes || ''}
                                    onChange={(e) => setAgreementModal({ ...agreementModal, data: { ...agreementModal.data, notes: e.target.value } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setAgreementModal({ open: false, data: null })}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                            >
                                Guardar Acuerdo
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL: HISTORIAL DE PRECIOS Y REVISIONES DE ACUERDO */}
            {agreementHistoryModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                                <div className="flex items-center gap-2 text-indigo-600 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Línea de Tiempo • Auditoría de Precios</span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Historial de Tarifas: {agreementHistoryModal.agreement?.customer_name}
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    {agreementHistoryModal.agreement?.product_type} ({agreementHistoryModal.agreement?.presentation})
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAgreementHistoryModal({ open: false, agreement: null, history: [], loading: false })}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {agreementHistoryModal.loading ? (
                            <div className="py-12 text-center text-slate-400">
                                <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-500" />
                                <span>Cargando historial de revisiones...</span>
                            </div>
                        ) : agreementHistoryModal.history.length === 0 ? (
                            <div className="py-12 text-center text-slate-400">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <span>No hay revisiones previas archivadas para este cliente todavía.</span>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                {agreementHistoryModal.history.map((item, index) => (
                                    <div key={item.id || index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-900">
                                                    <Money value={item.agreed_price_per_lb} /> / Lb
                                                </span>
                                                {item.previous_price_per_lb && (
                                                    <span className="text-[11px] text-slate-400 font-medium line-through">
                                                        anterior: <Money value={item.previous_price_per_lb} />
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {new Date(item.created_at).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                                            <div>
                                                <span className="font-bold text-slate-500">Vigencia: </span>
                                                <span className="font-mono">
                                                    {item.valid_from ? new Date(item.valid_from).toLocaleDateString() : 'Sin inicio'}
                                                    {' → '}
                                                    {item.valid_to ? new Date(item.valid_to).toLocaleDateString() : 'Permanente'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-bold text-slate-500">Registrado por: </span>
                                                <span>{item.changed_by || 'Sistema'}</span>
                                            </div>
                                        </div>

                                        {item.change_reason && (
                                            <div className="text-[11px] text-slate-700 bg-white p-2 rounded-lg border border-slate-100 italic">
                                                "{item.change_reason}"
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setAgreementHistoryModal({ open: false, agreement: null, history: [], loading: false })}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: AGREGAR / EDITAR QUÍMICO CIP */}
            {cipModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveCipItem} className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">
                                {cipModal.data?.id ? 'Editar Químico CIP' : 'Nuevo Químico de Lavado CIP'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setCipModal({ open: false, data: null })}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Nombre del Químico</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Soda Cáustica / Ácido Nítrico"
                                    value={cipModal.data?.item_name || ''}
                                    onChange={(e) => setCipModal({ ...cipModal, data: { ...cipModal.data, item_name: e.target.value } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Cant. Presentación</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="250"
                                        value={cipModal.data?.presentation_qty || ''}
                                        onChange={(e) => setCipModal({ ...cipModal, data: { ...cipModal.data, presentation_qty: parseFloat(e.target.value) || 0 } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Unidad Presentación</label>
                                    <input
                                        type="text"
                                        placeholder="kg, gal, L"
                                        value={cipModal.data?.presentation_unit || 'kg'}
                                        onChange={(e) => setCipModal({ ...cipModal, data: { ...cipModal.data, presentation_unit: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Costo Presentación ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="262.50"
                                        value={cipModal.data?.presentation_cost || ''}
                                        onChange={(e) => setCipModal({ ...cipModal, data: { ...cipModal.data, presentation_cost: parseFloat(e.target.value) || 0 } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Dosis por Batch</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        placeholder="15"
                                        value={cipModal.data?.dose_per_batch || ''}
                                        onChange={(e) => setCipModal({ ...cipModal, data: { ...cipModal.data, dose_per_batch: parseFloat(e.target.value) || 0 } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setCipModal({ open: false, data: null })}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20"
                            >
                                Guardar Químico
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL: AGREGAR / EDITAR EMPAQUE */}
            {packagingModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleSavePackagingItem} className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">
                                {packagingModal.data?.id ? 'Editar Empaque' : 'Nuevo Material / Empaque'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setPackagingModal({ open: false, data: null })}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Código del Item</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="CUBETA-30LB"
                                        value={packagingModal.data?.item_code || ''}
                                        onChange={(e) => setPackagingModal({ ...packagingModal, data: { ...packagingModal.data, item_code: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Categoría</label>
                                    <select
                                        value={packagingModal.data?.category || 'recipiente'}
                                        onChange={(e) => setPackagingModal({ ...packagingModal, data: { ...packagingModal.data, category: e.target.value } })}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                    >
                                        <option value="recipiente">Recipiente</option>
                                        <option value="tapadera">Tapadera</option>
                                        <option value="liner">Liner / Bolsa</option>
                                        <option value="etiqueta">Etiqueta</option>
                                        <option value="cinta">Cinta / Precinto</option>
                                        <option value="otro">Otro</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Descripción / Nombre</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Cubeta Plástica Blanca 30 LBS Grado Alimenticio"
                                    value={packagingModal.data?.item_name || ''}
                                    onChange={(e) => setPackagingModal({ ...packagingModal, data: { ...packagingModal.data, item_name: e.target.value } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">Costo Unitario ($)</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    required
                                    placeholder="2.40"
                                    value={packagingModal.data?.unit_cost || ''}
                                    onChange={(e) => setPackagingModal({ ...packagingModal, data: { ...packagingModal.data, unit_cost: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setPackagingModal({ open: false, data: null })}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                            >
                                Guardar Empaque
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL: EDITAR PARÁMETROS DE CALDERA Y GIF */}
            {configModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveConfigs} className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">
                                Parámetros de Caldera, Vapor y GIF de Planta
                            </h3>
                            <button
                                type="button"
                                onClick={() => setConfigModal({ open: false, data: null })}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Diesel Gal / Batch</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={configModal.data?.boiler_diesel_gal_batch || 20.84}
                                    onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, boiler_diesel_gal_batch: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Precio Diesel ($/Gal)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={configModal.data?.boiler_diesel_price_gal || 4.14}
                                    onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, boiler_diesel_price_gal: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Electricidad ($/Batch)</label>
                                <input
                                    type="number"
                                    step="1"
                                    value={configModal.data?.boiler_kwh_cost_batch || 386}
                                    onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, boiler_kwh_cost_batch: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Agua Caldera ($/Batch)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={configModal.data?.boiler_water_cost_batch || 17.34}
                                    onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, boiler_water_cost_batch: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Mano de Obra MOD ($/Lb)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={configModal.data?.mod_cost_per_lb || 0.05}
                                    onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, mod_cost_per_lb: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">GIF Mensual Total ($)</label>
                                <input
                                    type="number"
                                    step="1"
                                    value={configModal.data?.monthly_gif_total || 24537}
                                    onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, monthly_gif_total: parseFloat(e.target.value) || 0 } })}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setConfigModal({ open: false, data: null })}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20"
                            >
                                Guardar Parámetros
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL: GUARDAR ESCENARIO */}
            {saveScenarioModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <h3 className="text-base font-bold text-slate-900 uppercase">Guardar Escenario de Costeo</h3>
                            <button
                                onClick={() => setSaveScenarioModal(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                Nombre del Escenario
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: Costeo Base Septiembre 2026 - HE Plus"
                                value={scenarioNameInput}
                                onChange={(e) => setScenarioNameInput(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                onClick={() => setSaveScenarioModal(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveScenario}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all"
                            >
                                Confirmar Guardado
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
