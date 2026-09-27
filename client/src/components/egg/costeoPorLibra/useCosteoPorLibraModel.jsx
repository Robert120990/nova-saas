import { getTodayString } from '../../../utils/dateUtils';
import useMoneyFormatter from '../../../hooks/useMoneyFormatter';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';





export default function useCosteoPorLibraModel() {
    const formatMoney = useMoneyFormatter();
    // Tab actual
    const [activeTab, setActiveTab] = useState('calculator'); // 'calculator', 'simulator', 'commissions', 'clients', 'catalog', 'history'
    const [commissionsSubTab, setCommissionsSubTab] = useState('manager'); // 'manager' | 'simulator'

    // Rango de fechas global para monitoreo operacional y acuerdos
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return {
            preset: '30d',
            startDate: getTodayString(d),
            endDate: getTodayString(new Date())
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

    // Resultados calculados
    const [calculationResult, setCalculationResult] = useState(null);
    const [calculating, setCalculating] = useState(false);

    // Costo actual operacional (en vivo desde recepciones, lotes y ventas)
    const [operationalStats, setOperationalStats] = useState(null);
    const [loadingOperational, setLoadingOperational] = useState(false);

    // Listados complementarios
    const [cipItems, setCipItems] = useState([]);
    const [packagingItems, setPackagingItems] = useState([]);
    const [productsLookup, setProductsLookup] = useState([]);
    const [syncingPurchases, setSyncingPurchases] = useState(false);
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
            const [confRes, cipRes, packRes, agrRes, scenRes, prodRes] = await Promise.all([
                axios.get('/api/egg-industrial/costeo-libra/config'),
                axios.get('/api/egg-industrial/costeo-libra/cip-items'),
                axios.get('/api/egg-industrial/costeo-libra/packaging-items'),
                axios.get('/api/egg-industrial/costeo-libra/customer-agreements', {
                    params: { start_date: sDate || undefined, end_date: eDate || undefined }
                }),
                axios.get('/api/egg-industrial/costeo-libra/scenarios'),
                axios.get('/api/egg-industrial/costeo-libra/products-lookup')
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
            setProductsLookup(Array.isArray(prodRes?.data) ? prodRes.data : []);

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
        let end = getTodayString(now);

        if (preset === 'month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            start = getTodayString(firstDay);
            end = getTodayString(lastDay);
        } else if (preset === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            start = getTodayString(d);
        } else if (preset === '3m') {
            const d = new Date();
            d.setMonth(d.getMonth() - 3);
            start = getTodayString(d);
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

    // Sincronización con Facturas de Compras
    const handleSyncPurchases = async () => {
        setSyncingPurchases(true);
        try {
            const res = await axios.post('/api/egg-industrial/costeo-libra/sync-purchases');
            toast.success(res.data.message || 'Costos sincronizados con facturas de compras.');
            await loadData(dateRange.startDate, dateRange.endDate);
        } catch (error) {
            console.error('Error sincronizando con compras:', error);
            toast.error(error.response?.data?.message || 'Error al sincronizar costos con compras.');
        } finally {
            setSyncingPurchases(false);
        }
    };

    const handleSelectProductForCip = (productId) => {
        const pId = parseInt(productId) || null;
        const prod = productsLookup.find(p => p.id === pId);
        if (prod) {
            const costToUse = prod.latest_purchase_cost ? parseFloat(prod.latest_purchase_cost) : parseFloat(prod.costo || 0);
            const qty = parseFloat(cipModal.data?.presentation_qty) || 1;
            setCipModal(prev => ({
                ...prev,
                data: {
                    ...prev.data,
                    product_id: pId,
                    item_name: prev.data?.item_name || prod.nombre,
                    presentation_unit: prev.data?.presentation_unit || prod.unidad_medida || 'kg',
                    presentation_cost: costToUse * qty
                }
            }));
        } else {
            setCipModal(prev => ({
                ...prev,
                data: {
                    ...prev.data,
                    product_id: null
                }
            }));
        }
    };

    const handleSelectProductForPackaging = (productId) => {
        const pId = parseInt(productId) || null;
        const prod = productsLookup.find(p => p.id === pId);
        if (prod) {
            const costToUse = prod.latest_purchase_cost ? parseFloat(prod.latest_purchase_cost) : parseFloat(prod.costo || 0);
            setPackagingModal(prev => ({
                ...prev,
                data: {
                    ...prev.data,
                    product_id: pId,
                    item_code: prev.data?.item_code || prod.codigo,
                    item_name: prev.data?.item_name || prod.nombre,
                    unit_cost: costToUse
                }
            }));
        } else {
            setPackagingModal(prev => ({
                ...prev,
                data: {
                    ...prev.data,
                    product_id: null
                }
            }));
        }
    };

    const handleQuickApplyPackagingCost = async (packId, newCost) => {
        try {
            const item = packagingItems.find(p => p.id === packId);
            if (!item) return;
            await axios.post('/api/egg-industrial/costeo-libra/packaging-items', {
                ...item,
                unit_cost: parseFloat(newCost)
            });
            toast.success(`Costo de ${item.item_code} actualizado a ${formatMoney(parseFloat(newCost), 4)} desde la factura.`);
            await loadData(dateRange.startDate, dateRange.endDate);
        } catch (error) {
            console.error('Error aplicando costo de empaque:', error);
            toast.error('Error al aplicar costo desde factura.');
        }
    };

    const handleQuickApplyCipCost = async (cipId, unitCost) => {
        try {
            const item = cipItems.find(c => c.id === cipId);
            if (!item) return;
            const qty = parseFloat(item.presentation_qty) || 1;
            const newPresCost = parseFloat(unitCost) * qty;
            await axios.post('/api/egg-industrial/costeo-libra/cip-items', {
                ...item,
                presentation_cost: newPresCost
            });
            toast.success(`Costo de ${item.item_name} actualizado a ${formatMoney(newPresCost, 2)} desde la factura.`);
            await loadData(dateRange.startDate, dateRange.endDate);
        } catch (error) {
            console.error('Error aplicando costo CIP:', error);
            toast.error('Error al aplicar costo desde factura.');
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


 return { activeTab, setActiveTab, commissionsSubTab, setCommissionsSubTab, dateRange, setDateRange, calcParams, setCalcParams, showCustomSolids, setShowCustomSolids, showPresentationsMatrixCalc, setShowPresentationsMatrixCalc, calculationResult, setCalculationResult, calculating, setCalculating, operationalStats, setOperationalStats, loadingOperational, setLoadingOperational, cipItems, setCipItems, packagingItems, setPackagingItems, productsLookup, setProductsLookup, syncingPurchases, setSyncingPurchases, agreements, setAgreements, scenarios, setScenarios, configs, setConfigs, costingHistoryList, setCostingHistoryList, loadingHistory, setLoadingHistory, globalAgreementHistory, setGlobalAgreementHistory, loadingGlobalHistory, setLoadingGlobalHistory, historySubTab, setHistorySubTab, validityFilter, setValidityFilter, agreementModal, setAgreementModal, agreementHistoryModal, setAgreementHistoryModal, saveScenarioModal, setSaveScenarioModal, scenarioNameInput, setScenarioNameInput, cipModal, setCipModal, packagingModal, setPackagingModal, configModal, setConfigModal, debounceTimerRef, loadData, loadOperationalCost, loadCostingHistory, loadGlobalAgreementHistory, handlePresetChange, handleCustomDateApply, getPresetLabel, handleOpenAgreementHistory, runCalculation, handleParamChange, handleApplyRealPlantData, handleSaveScenario, handleSaveAgreement, handleDeleteAgreement, handleSyncPurchases, handleSelectProductForCip, handleSelectProductForPackaging, handleQuickApplyPackagingCost, handleQuickApplyCipCost, handleSaveCipItem, handleDeleteCipItem, handleSavePackagingItem, handleDeletePackagingItem, handleSaveConfigs, opSummary, opBreakdown };
}
