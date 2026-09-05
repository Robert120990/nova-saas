import { useState, useEffect } from 'react';
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
    CheckCircle2,
    AlertCircle,
    Plus,
    X,
    Sparkles,
    BarChart3
} from 'lucide-react';
import Money, { MoneyInput } from '../../components/ui/Money';

export default function EggCosteoPorLibra() {
    // Tab actual
    const [activeTab, setActiveTab] = useState('calculator'); // 'calculator', 'simulator', 'clients', 'catalog', 'history'

    // Parámetros de simulación
    const [calcParams, setCalcParams] = useState({
        product_type: 'Huevo Entero Pasteurizado',
        presentation: 'cubeta 30LB',
        raw_egg_box_cost: 38.00,
        raw_egg_lbs_per_box: 43.5,
        batch_size_lbs: 12000,
        water_added_pct: 0.0,
        sugar_added_pct: 0.0,
        salt_added_pct: 0.0,
        target_sale_price_per_lb: 1.15,
        custom_cip_cost: null,
        custom_mod_per_lb: 0.0500,
        custom_gif_monthly: 24537.00,
        custom_monthly_volume_lbs: 100000
    });

    // Resultados calculados
    const [calculationResult, setCalculationResult] = useState(null);
    const [calculating, setCalculating] = useState(false);

    // Listados complementarios
    const [cipItems, setCipItems] = useState([]);
    const [packagingItems, setPackagingItems] = useState([]);
    const [agreements, setAgreements] = useState([]);
    const [scenarios, setScenarios] = useState([]);
    const [, setConfigs] = useState({});

    // Modales
    const [agreementModal, setAgreementModal] = useState({ open: false, data: null });
    const [saveScenarioModal, setSaveScenarioModal] = useState(false);
    const [scenarioNameInput, setScenarioNameInput] = useState('');

    // Carga inicial
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [confRes, cipRes, packRes, agrRes, scenRes] = await Promise.all([
                axios.get('/api/egg-industrial/costeo-libra/config'),
                axios.get('/api/egg-industrial/costeo-libra/cip-items'),
                axios.get('/api/egg-industrial/costeo-libra/packaging'),
                axios.get('/api/egg-industrial/costeo-libra/customer-agreements'),
                axios.get('/api/egg-industrial/costeo-libra/scenarios')
            ]);
            setConfigs(confRes.data);
            setCipItems(cipRes.data);
            setPackagingItems(packRes.data);
            setAgreements(agrRes.data);
            setScenarios(scenRes.data);

            // Ejecutar primer cálculo
            runCalculation(calcParams);
        } catch (error) {
            console.error('Error cargando datos de costeo:', error);
            toast.error('Error al inicializar datos de costeo por libra.');
        }
    };

    // Motor de cálculo
    const runCalculation = async (params = calcParams) => {
        setCalculating(true);
        try {
            const res = await axios.post('/api/egg-industrial/costeo-libra/calculate', params);
            setCalculationResult(res.data);
        } catch (error) {
            console.error('Error en cálculo de costeo:', error);
            toast.error(error.response?.data?.message || 'Error al calcular costos.');
        } finally {
            setCalculating(false);
        }
    };

    // Cambio en parámetros
    const handleParamChange = (field, value) => {
        const updated = { ...calcParams, [field]: value };

        // Ajustes automáticos según tipo de producto
        if (field === 'product_type') {
            if (value.toLowerCase().includes('plus')) {
                updated.water_added_pct = 8.0;
                updated.sugar_added_pct = 0.0;
                updated.salt_added_pct = 0.0;
            } else if (value.toLowerCase().includes('azucarada')) {
                updated.water_added_pct = 0.0;
                updated.sugar_added_pct = 4.0;
                updated.salt_added_pct = 0.0;
            } else if (value.toLowerCase().includes('salada')) {
                updated.water_added_pct = 0.0;
                updated.salt_added_pct = 10.0;
                updated.sugar_added_pct = 0.0;
            } else {
                updated.water_added_pct = 0.0;
                updated.sugar_added_pct = 0.0;
                updated.salt_added_pct = 0.0;
            }
        }

        setCalcParams(updated);
        runCalculation(updated);
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
                base_raw_egg_cost_per_box: calcParams.raw_egg_box_cost,
                batch_size_lbs: calcParams.batch_size_lbs,
                yield_liquid_pct: calculationResult?.parameters_used?.liquid_yield_pct || 83,
                calculated_cost_per_lb: calculationResult?.breakdown?.total_cost_per_lb || 0,
                target_sale_price_per_lb: calcParams.target_sale_price_per_lb || 0,
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

    // Guardar Acuerdo Cliente
    const handleSaveAgreement = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/egg-industrial/costeo-libra/customer-agreements', agreementModal.data);
            toast.success('Acuerdo comercial guardado con éxito.');
            setAgreementModal({ open: false, data: null });
            const agrRes = await axios.get('/api/egg-industrial/costeo-libra/customer-agreements');
            setAgreements(agrRes.data);
            runCalculation();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar acuerdo.');
        }
    };

    // Eliminar Acuerdo
    const handleDeleteAgreement = async (id) => {
        if (!window.confirm('¿Seguro de eliminar este acuerdo comercial?')) return;
        try {
            await axios.delete(`/api/egg-industrial/costeo-libra/customer-agreements/${id}`);
            toast.success('Acuerdo eliminado.');
            const agrRes = await axios.get('/api/egg-industrial/costeo-libra/customer-agreements');
            setAgreements(agrRes.data);
            runCalculation();
        } catch (error) {
            toast.error('Error al eliminar acuerdo.');
        }
    };

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
                        Modelo oficial de costeo por absorción: Materia Prima, Insumos, Empaque, CIP, Energía/Vapor, Mano de Obra y Gastos Indirectos.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => runCalculation()}
                        disabled={calculating}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
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
                                Lote {calcParams.batch_size_lbs.toLocaleString()} Lbs
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
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                                        Costo Caja Huevo Cáscara ($)
                                    </label>
                                    <MoneyInput
                                        value={calcParams.raw_egg_box_cost}
                                        onChange={(e) => handleParamChange('raw_egg_box_cost', parseFloat(e.target.value) || 0)}
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
                                        value={calcParams.raw_egg_lbs_per_box}
                                        onChange={(e) => handleParamChange('raw_egg_lbs_per_box', parseFloat(e.target.value) || 43.5)}
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
                                        value={calcParams.batch_size_lbs}
                                        onChange={(e) => handleParamChange('batch_size_lbs', parseFloat(e.target.value) || 12000)}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Aditivos condicionales */}
                            {calcParams.product_type.toLowerCase().includes('plus') && (
                                <div className="p-3.5 bg-cyan-50 border border-cyan-200 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2 text-cyan-800 font-bold text-[11px]">
                                        <Droplets className="w-4 h-4 text-cyan-600" />
                                        <span>Parámetros de Dilución HE Plus</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-700 font-semibold">% Agua Añadida:</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={calcParams.water_added_pct}
                                            onChange={(e) => handleParamChange('water_added_pct', parseFloat(e.target.value) || 0)}
                                            className="w-20 bg-white border border-cyan-300 rounded-lg px-2 py-1 text-right font-bold text-slate-800"
                                        />
                                    </div>
                                    <p className="text-[10px] text-cyan-700 leading-relaxed font-medium">
                                        Estándar ANDELSA: 8% agua purificada manteniendo sólidos $\ge 21.5\%$.
                                    </p>
                                </div>
                            )}

                            {calcParams.product_type.toLowerCase().includes('azucarada') && (
                                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-amber-900 font-bold">% Azúcar Industrial:</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={calcParams.sugar_added_pct}
                                            onChange={(e) => handleParamChange('sugar_added_pct', parseFloat(e.target.value) || 4)}
                                            className="w-20 bg-white border border-amber-300 rounded-lg px-2 py-1 text-right font-bold text-slate-800"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* GIF & Prorrateo */}
                            <div className="pt-3 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] font-bold uppercase text-slate-700">Prorrateo de Gastos Indirectos (GIF)</span>
                                    <span className="text-[10px] text-indigo-600 font-bold">Base 100k Lbs/mes</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">GIF Total ($/mes)</label>
                                        <MoneyInput
                                            value={calcParams.custom_gif_monthly}
                                            onChange={(e) => handleParamChange('custom_gif_monthly', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Volumen Proyectado (Lbs)</label>
                                        <input
                                            type="number"
                                            step="5000"
                                            value={calcParams.custom_monthly_volume_lbs}
                                            onChange={(e) => handleParamChange('custom_monthly_volume_lbs', parseFloat(e.target.value) || 100000)}
                                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel de Resultados y Desglose Visual */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Tarjeta Principal de Costo por Libra */}
                        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-500/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Calculator className="w-48 h-48" />
                            </div>
                            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300">
                                        Costo Unitario Calculado
                                    </span>
                                    <div className="text-4xl sm:text-5xl font-black tracking-tight mt-1 flex items-baseline gap-2">
                                        <Money value={calculationResult?.breakdown?.total_cost_per_lb || 0} />
                                        <span className="text-lg font-bold text-indigo-300">/ Libra</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-indigo-200">
                                        <span className="bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-400/30">
                                            Presentación ({calcParams.presentation}): <strong className="text-white"><Money value={calculationResult?.breakdown?.cost_per_unit || 0} /></strong>
                                        </span>
                                        <span className="bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-400/30">
                                            Rendimiento Líquido: <strong className="text-white">{calculationResult?.parameters_used?.liquid_yield_pct?.toFixed(1)}%</strong>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right sm:border-l sm:border-indigo-700/50 sm:pl-6 space-y-1">
                                    <div className="text-[10px] uppercase font-bold text-indigo-300">Lote Completo ({calcParams.batch_size_lbs.toLocaleString()} Lbs)</div>
                                    <div className="text-xl font-black text-white">
                                        <Money value={(calculationResult?.breakdown?.total_cost_per_lb || 0) * calcParams.batch_size_lbs} />
                                    </div>
                                    <div className="text-[10px] text-indigo-300">Costo total de producción</div>
                                </div>
                            </div>
                        </div>

                        {/* Desglose de Componentes de Costo */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-600" />
                                <span>Estructura Desglosada del Costo por Libra</span>
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    {
                                        label: 'Huevo Cáscara (Materia Prima)',
                                        value: calculationResult?.breakdown?.raw_egg_cost_per_lb || 0,
                                        icon: DollarSign,
                                        color: 'text-amber-600',
                                        bg: 'bg-amber-50/80',
                                        desc: 'Incluye 15% merma de cáscara'
                                    },
                                    {
                                        label: 'Químicos y Agua CIP',
                                        value: calculationResult?.breakdown?.cip_chemicals_per_lb || 0,
                                        icon: Droplets,
                                        color: 'text-cyan-600',
                                        bg: 'bg-cyan-50/80',
                                        desc: 'Soda, nítrico, peracético'
                                    },
                                    {
                                        label: 'Energía Eléctrica y Vapor',
                                        value: (calculationResult?.breakdown?.electricity_per_lb || 0) + (calculationResult?.breakdown?.boiler_steam_per_lb || 0),
                                        icon: Flame,
                                        color: 'text-rose-600',
                                        bg: 'bg-rose-50/80',
                                        desc: 'Placas APV y caldera Cleaver'
                                    },
                                    {
                                        label: 'Empaque Unitario',
                                        value: calculationResult?.breakdown?.packaging_per_lb || 0,
                                        icon: Package,
                                        color: 'text-emerald-600',
                                        bg: 'bg-emerald-50/80',
                                        desc: `${calcParams.presentation} + tapadera`
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
                                    <MoneyInput
                                        value={calcParams.target_sale_price_per_lb}
                                        onChange={(e) => handleParamChange('target_sale_price_per_lb', parseFloat(e.target.value) || 0)}
                                        className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm"
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
                                    <Money value={(calculationResult?.target_simulation?.margin_per_lb || 0) * calcParams.batch_size_lbs} />
                                </div>
                                <span className="text-[10px] text-slate-500">Para {calcParams.batch_size_lbs.toLocaleString()} Lbs</span>
                            </div>
                        </div>
                    </div>

                    {/* Matriz Comparativa de Márgenes */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                            Tabla Comparativa de Precios Sugeridos por Margen
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="py-3 px-4">Margen Deseado</th>
                                        <th className="py-3 px-4 text-right">Precio Sugerido / Lb</th>
                                        <th className="py-3 px-4 text-right">Precio / {calcParams.presentation}</th>
                                        <th className="py-3 px-4 text-right">Ganancia / Lb</th>
                                        <th className="py-3 px-4 text-right">Utilidad Lote ({calcParams.batch_size_lbs.toLocaleString()} Lbs)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {(calculationResult?.target_simulation?.margin_matrix || []).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    row.margin_target_pct >= 25
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : row.margin_target_pct >= 15
                                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                    {row.margin_target_pct}% Margen
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-slate-900">
                                                <Money value={row.suggested_price_per_lb} />
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-slate-700">
                                                <Money value={row.suggested_price_per_presentation} />
                                            </td>
                                            <td className="py-3 px-4 text-right text-emerald-600 font-bold">
                                                <Money value={row.margin_dollar_per_lb} />
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-indigo-700">
                                                <Money value={row.batch_profit} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: ACUERDOS CON CLIENTES */}
            {activeTab === 'clients' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span>Control de Precios y Acuerdos Comerciales por Cliente</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Semáforo de rentabilidad y precios pactados (PriceSmart, La Francesa, Lorena, Denny's, etc.).
                            </p>
                        </div>
                        <button
                            onClick={() => setAgreementModal({
                                open: true,
                                data: {
                                    customer_name: '',
                                    product_type: 'Huevo Entero Pasteurizado',
                                    presentation: 'cubeta 30LB',
                                    agreed_price_per_lb: 1.20,
                                    monthly_volume_lbs: 10000,
                                    target_margin_pct: 20.0,
                                    notes: ''
                                }
                            })}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo Acuerdo de Precio</span>
                        </button>
                    </div>

                    {/* Tabla de Acuerdos */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="py-3 px-4">Cliente</th>
                                        <th className="py-3 px-3">Producto / Presentación</th>
                                        <th className="py-3 px-3 text-right">Precio Pactado</th>
                                        <th className="py-3 px-3 text-right">Costo Calculado</th>
                                        <th className="py-3 px-3 text-right">Margen / Lb</th>
                                        <th className="py-3 px-3 text-center">Semáforo</th>
                                        <th className="py-3 px-3 text-right">Volumen Mes</th>
                                        <th className="py-3 px-3 text-right">Utilidad Proyectada</th>
                                        <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {(calculationResult?.client_analysis || []).map((client) => {
                                        const badgeClass =
                                            client.status === 'RENTABLE'
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : client.status === 'EN_ALERTA'
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
                                                        {client.status} ({client.margin_pct}%)
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right text-slate-600 font-medium">
                                                    {client.monthly_volume_lbs.toLocaleString()} Lbs
                                                </td>
                                                <td className="py-3 px-3 text-right font-black text-indigo-700">
                                                    <Money value={client.monthly_profit} />
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setAgreementModal({ open: true, data: client })}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold"
                                                            title="Editar Acuerdo"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAgreement(client.id)}
                                                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold"
                                                            title="Eliminar Acuerdo"
                                                        >
                                                            <X className="w-4 h-4" />
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

            {/* TAB 4: INSUMOS, EMPAQUES Y CIP */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Químicos CIP */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Droplets className="w-4 h-4 text-cyan-600" />
                                <span>Químicos de Lavado CIP (Clean-In-Place)</span>
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">Por ciclo de pasteurizador</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="py-2.5 px-3">Químico / Insumo</th>
                                        <th className="py-2.5 px-3">Dosis</th>
                                        <th className="py-2.5 px-3 text-right">Costo Ciclo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {cipItems.map((cip) => (
                                        <tr key={cip.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3">{cip.chemical_name}</td>
                                            <td className="py-2.5 px-3 text-slate-600">{cip.dosage_per_cycle} {cip.unit_of_measure}</td>
                                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                                <Money value={cip.presentation_cost} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Empaques */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Package className="w-4 h-4 text-emerald-600" />
                                <span>Costos de Empaques y Envases</span>
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">Ficha técnica unitaria</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="py-2.5 px-3">Presentación</th>
                                        <th className="py-2.5 px-3">Capacidad</th>
                                        <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {packagingItems.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-2.5 px-3 font-bold text-slate-900">{p.packaging_type}</td>
                                            <td className="py-2.5 px-3 text-slate-600">{p.capacity_lbs} Lbs</td>
                                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                                <Money value={p.unit_cost} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: ESCENARIOS GUARDADOS */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-1 flex items-center gap-2">
                            <History className="w-4 h-4 text-indigo-600" />
                            <span>Historial de Escenarios Guardados</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Modelos de simulación guardados para comparativas financieras y presupuestos de producción.
                        </p>
                    </div>

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
                </div>
            )}

            {/* MODAL: NUEVO ACUERDO DE PRECIO CON CLIENTE */}
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
                                        <option value="cubeta 30LB">Cubeta 30 Lbs (Estándar)</option>
                                        <option value="cubeta 32LB">Cubeta 32 Lbs</option>
                                        <option value="galon 8LB">Galón 8 Lbs</option>
                                        <option value="medio galon 4LB">Medio Galón 4 Lbs</option>
                                        <option value="litro 2LB">Litro 2 Lbs</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">
                                        Precio Pactado ($/Lb)
                                    </label>
                                    <MoneyInput
                                        value={agreementModal.data?.agreed_price_per_lb || 0}
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
