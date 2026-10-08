import { getTodayString } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';


import {
    generateJulianLotCode
} from '../../../utils/julianDate';
import { getDefaultPresentationForProduct } from '../../../utils/eggPresentationUtils';
const PRODUCT_PROFILES = [
    { id: 'Huevo Entero Pasteurizado', name: 'Huevo Entero Pasteurizado', defaultSolids: 23.5, color: 'indigo', desc: '83% rendimiento estándar' },
    { id: 'Huevo Formulado por Separación', name: 'Huevo Formulado por Separación (Yema + MP liquida A)', defaultSolids: 22.5, color: 'emerald', desc: 'Venta de Clara + Yema con MP liquida A' },
    { id: 'Huevo Entero Plus', name: 'Huevo Entero Plus', defaultSolids: 21.5, color: 'cyan', desc: 'Con MP liquida A 8% y ácido cítrico' },
    { id: 'Clara de Huevo Pasteurizada', name: 'Clara de Huevo Pasteurizada', defaultSolids: 11.5, color: 'teal', desc: '54% rendimiento, alta demanda' },
    { id: 'Yema Azucarada', name: 'Yema Azucarada (4% azúcar)', defaultSolids: 48.0, color: 'amber', desc: 'Para panificación y repostería' },
    { id: 'Yema Salada', name: 'Yema Salada (10% sal)', defaultSolids: 47.0, color: 'orange', desc: 'Para aderezos y mayonesa' },
    { id: 'Huevo con Leche', name: 'Huevo Entero con Leche', defaultSolids: 22.0, color: 'purple', desc: 'Institucional / servicios de vuelo' }
];
const FACTORY_ROLES = [
    'Quebrado y Carga',
    'Sanitización CIP',
    'Dosificación MP liquida A / Mezcla',
    'Pasteurización HACCP',
    'Control de Calidad LAB-004',
    'Empaque y Cuarto Frío',
    'Supervisor de Turno'
];
const DEFAULT_PRESETS_BY_ROLE = {
    'Quebrado y Carga': 'Alinear y quebrar cajas de huevo blanco en cámara de quebrado.',
    'Sanitización CIP': 'Sanitizar pasteurizador con Ácido Peracético 1.5% a 78°C antes de iniciar.',
    'Dosificación MP liquida A / Mezcla': 'Medir y dosificar MP liquida A con ácido cítrico estabilizador.',
    'Pasteurización HACCP': 'Mantener régimen pasteurizador a 64.5°C por 210s monitoreando CCP-1.',
    'Control de Calidad LAB-004': 'Verificar refractómetro: Sólidos totales y pH antes de envasado.',
    'Empaque y Cuarto Frío': 'Alistar cubetas sanitizadas con liner alimentario y etiquetas de lote.'
};
const PRESENTATIONS = [
    'cubeta 30LB',
    'cubeta 32LB',
    'galón 8LB',
    'galon 8LB',
    'medio galón 4LB',
    'medio galon 4LB',
    'litro 2LB',
    'bolsa 20LB'
];
const _findAgreementForProduct = (agreementsList, productType) => {
    if (!agreementsList || agreementsList.length === 0 || !productType) return null;

    const clean = (s) => (s || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, ' ')
        .trim();

    const target = clean(productType);

    // 1. Coincidencia exacta de tipo de producto
    let match = agreementsList.find(a => clean(a.product_type) === target);
    if (match) return match;

    // 2. Coincidencias por palabras clave de perfiles
    if (target.includes('clara')) {
        match = agreementsList.find(a => clean(a.product_type).includes('clara') || clean(a.product_name).includes('clara'));
    } else if (target.includes('azucarada')) {
        match = agreementsList.find(a => clean(a.product_type).includes('azucar') || clean(a.product_name).includes('azucar'));
    } else if (target.includes('salada')) {
        match = agreementsList.find(a => clean(a.product_type).includes('salad') || clean(a.product_name).includes('salad'));
    } else if (target.includes('leche')) {
        match = agreementsList.find(a => clean(a.product_type).includes('leche') || clean(a.product_name).includes('leche'));
    } else if (target.includes('plus')) {
        match = agreementsList.find(a => clean(a.product_type).includes('plus') || clean(a.product_name).includes('plus'));
    } else if (target.includes('formulado') || target.includes('separacion')) {
        match = agreementsList.find(a => clean(a.product_type).includes('formulado') || clean(a.product_type).includes('separacion'));
        if (!match) {
            match = agreementsList.find(a => clean(a.product_type).includes('entero') && !clean(a.product_type).includes('plus'));
        }
    } else if (target.includes('entero')) {
        match = agreementsList.find(a => clean(a.product_type).includes('entero') && !clean(a.product_type).includes('plus'));
    }

    if (match) return match;

    // 3. Coincidencia por catálogo o descripción
    match = agreementsList.find(a => {
        const pName = clean(a.product_name);
        return pName && (pName.includes(target) || target.includes(pName));
    });
    if (match) return match;

    // 4. Si el cliente solo tiene 1 acuerdo comercial activo con precio registrado
    if (agreementsList.length === 1 && parseFloat(agreementsList[0].agreed_price_per_lb) > 0) {
        return agreementsList[0];
    }

    return null;
};
export default function useProductionCalendarModel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const companyId = user?.company_id || 1;

    // View state: 'month', 'week', 'list'
    const [calendarView, setCalendarView] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    // Data lists
    const [productions, setProductions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [factoryUsers, setFactoryUsers] = useState([]);
    const [suggestionsData, setSuggestionsData] = useState(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [customerOrders, setCustomerOrders] = useState([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [profileFilter, setProfileFilter] = useState('todos');

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isSuggestionsDrawerOpen, setIsSuggestionsDrawerOpen] = useState(false);
    const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
    const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal Normalizado de Pedidos de Clientes & Alterar Fechas
    const [isCustomerOrderModalOpen, setIsCustomerOrderModalOpen] = useState(false);
    const [selectedOrderToEdit, setSelectedOrderToEdit] = useState(null);
    const [alterDateItem, setAlterDateItem] = useState(null); // { type: 'production' | 'order', id, item, title, currentDate }
    const [newAlteredDate, setNewAlteredDate] = useState('');
    const [isAlteringDate, setIsAlteringDate] = useState(false);

    // Sugerencia Mensual IA & Planificador MP
    const [suggestionsTab, setSuggestionsTab] = useState('monthly'); // 'monthly' | 'tactical'
    const [monthlyPlanData, setMonthlyPlanData] = useState(null);
    const [loadingMonthlyPlan, setLoadingMonthlyPlan] = useState(false);
    const [applyingPlan, setApplyingPlan] = useState(false);
    const [selectedPlanRuns, setSelectedPlanRuns] = useState([]);
    const [julianFormat, setJulianFormat] = useState('standard'); // 'standard' (LOTE-YYJJJ-NN) | 'andelsa' (NN - JJJ - YY)

    // Estado de Hover Preview para producciones y pedidos
    const [hoverPreview, setHoverPreview] = useState(null);

    // Estado de Rango de Fechas para Sugerencias IA (evita fechas pasadas retroactivas)
    const [suggestionStartDate, setSuggestionStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [suggestionEndDate, setSuggestionEndDate] = useState(() => {
        const d = new Date();
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
    });
    const [preventPastSuggestions, setPreventPastSuggestions] = useState(true);

    // Filtro de Clientes y Lote de Separación en Sugerencias IA
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState(null); // null = todos activos por defecto
    const [separationBatchLbs, setSeparationBatchLbs] = useState(6000);
    const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);

    // Drag and Drop state
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverDate, setDragOverDate] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        id: null,
        production_date: getTodayString(new Date()),
        start_time: '06:00',
        end_time: '14:00',
        lot_code: '',
        product_profile: 'Huevo Entero Pasteurizado',
        presentation: 'cubeta 30LB',
        target_quantity_lbs: 12000,
        target_solids_pct: 23.5,
        status: 'programado',
        priority: 'media',
        mix_formula_json: {
            raw_egg_boxes: 332,
            raw_liquid_lbs: 12000,
            clara_separated_pct: 0,
            clara_produced_lbs: 0,
            yema_coproduct_lbs: 0,
            yema_reutilized_lbs: 0,
            water_h2o_lbs: 0,
            water_bottles: 0,
            citric_acid_lbs: '0.00',
            sugar_lbs: '0.00',
            salt_lbs: '0.00',
            milk_powder_lbs: '0.00',
            notes: ''
        },
        assigned_operator_id: '',
        assigned_operator_name: '',
        notes: '',
        tasks: [],
        enable_secondary_batch: false,
        secondary_lots: [],
        second_lot_code: '',
        second_product_profile: 'Clara de Huevo Pasteurizada',
        second_presentation: 'cubeta 30LB',
        second_target_quantity_lbs: 6000,
        second_target_solids_pct: 11.5
    });

    // Temporary task state inside form
    const [newTaskRole, setNewTaskRole] = useState(FACTORY_ROLES[0]);
    const [newTaskUser, setNewTaskUser] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState(DEFAULT_PRESETS_BY_ROLE[FACTORY_ROLES[0]] || '');

    // Fetch primary data
    const fetchProductions = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/egg-industrial/calendar');
            setProductions(unwrapList(res));
        } catch (error) {
            console.error('Error cargando producciones programadas:', error);
            toast.error('Error al cargar calendario de producción.');
        } finally {
            setLoading(false);
        }
    };

    const fetchFactoryUsers = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/factory-users');
            setFactoryUsers(unwrapList(res));
        } catch (error) {
            console.error('Error cargando usuarios de planta:', error);
        }
    };

    const fetchSuggestions = async (
        sDate = suggestionStartDate,
        eDate = suggestionEndDate,
        custIds = selectedCustomerIds,
        sepBatch = separationBatchLbs
    ) => {
        setLoadingSuggestions(true);
        try {
            const params = { start_date: sDate, end_date: eDate };
            if (custIds !== null && custIds !== undefined) {
                params.customer_ids = custIds.length > 0 ? custIds.join(',') : 'none';
            }
            if (sepBatch) {
                params.separation_batch_lbs = sepBatch;
            }
            const res = await axios.get('/api/egg-industrial/calendar/suggestions', { params });
            setSuggestionsData(res.data || null);
            if (Array.isArray(res.data?.available_customers) && res.data.available_customers.length > 0) {
                setAvailableCustomers(res.data.available_customers);
                if (custIds === null || custIds === undefined) {
                    const activeIds = res.data.available_customers.filter(c => c.active).map(c => c.id);
                    setSelectedCustomerIds(activeIds);
                }
            }
        } catch (error) {
            console.error('Error cargando sugerencias inteligentes:', error);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const fetchOrders = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/orders');
            setCustomerOrders(unwrapList(res));
        } catch (error) {
            console.error('Error cargando pedidos de clientes:', error);
        }
    };

    const fetchMonthlyPlan = async (
        targetD = currentDate,
        sDate = suggestionStartDate,
        eDate = suggestionEndDate,
        prevPast = preventPastSuggestions,
        custIds = selectedCustomerIds,
        sepBatch = separationBatchLbs
    ) => {
        setLoadingMonthlyPlan(true);
        try {
            const targetYear = targetD.getFullYear();
            const targetMonth = targetD.getMonth() + 1;
            const params = {
                year: targetYear,
                month: targetMonth,
                start_date: sDate,
                end_date: eDate,
                prevent_past: prevPast
            };
            if (custIds !== null && custIds !== undefined) {
                params.customer_ids = custIds.length > 0 ? custIds.join(',') : 'none';
            }
            if (sepBatch) {
                params.separation_batch_lbs = sepBatch;
            }
            const res = await axios.get('/api/egg-industrial/calendar/monthly-suggestions', { params });
            setMonthlyPlanData(res.data || null);
            if (Array.isArray(res.data?.available_customers) && res.data.available_customers.length > 0) {
                setAvailableCustomers(res.data.available_customers);
                if (custIds === null || custIds === undefined) {
                    const activeIds = res.data.available_customers.filter(c => c.active).map(c => c.id);
                    setSelectedCustomerIds(activeIds);
                }
            }
            // Pre-seleccionar todos los que no estén ya programados
            const unscheduled = (res.data?.monthly_plan || []).filter(p => !p.already_scheduled);
            setSelectedPlanRuns(unscheduled);
        } catch (error) {
            console.error('Error cargando plan mensual de producción:', error);
        } finally {
            setLoadingMonthlyPlan(false);
        }
    };

    const handleToggleCustomer = (customerId) => {
        setSelectedCustomerIds(prev => {
            const current = prev !== null ? prev : availableCustomers.map(c => c.id);
            const exists = current.includes(customerId);
            if (exists) {
                return current.filter(id => id !== customerId);
            } else {
                return [...current, customerId];
            }
        });
    };

    const handleSelectAllCustomers = () => {
        const allIds = availableCustomers.map(c => c.id);
        setSelectedCustomerIds(allIds);
    };

    const handleDeselectAllCustomers = () => {
        setSelectedCustomerIds([]);
    };

    const handleConvertLotToJulian = async (prodId) => {
        try {
            const res = await axios.post(`/api/egg-industrial/calendar/${prodId}/convert-julian`);
            toast.success(`Lote actualizado a formato juliano: ${res.data.new_lot_code}`);
            fetchProductions();
        } catch (error) {
            console.error('Error convirtiendo lote a juliano:', error);
            toast.error('Error al convertir lote a formato juliano.');
        }
    };

    const handleApplyMonthlyPlan = async () => {
        if (!selectedPlanRuns || selectedPlanRuns.length === 0) {
            toast.warning('No hay producciones seleccionadas para programar.');
            return;
        }
        setApplyingPlan(true);
        try {
            const res = await axios.post('/api/egg-industrial/calendar/apply-monthly-plan', {
                productions: selectedPlanRuns
            });
            toast.success(res.data.message || 'Plan mensual aplicado exitosamente al calendario.');
            setIsSuggestionsDrawerOpen(false);
            fetchProductions();
            fetchSuggestions();
            fetchMonthlyPlan(currentDate);
        } catch (error) {
            console.error('Error aplicando plan mensual:', error);
            toast.error(error.response?.data?.message || 'Error al aplicar plan mensual.');
        } finally {
            setApplyingPlan(false);
        }
    };

    useEffect(() => {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;
        const sD = (preventPastSuggestions && isCurrentMonth) ? today : firstDay;
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const newStart = fmt(sD);
        const newEnd = fmt(lastDay);
        setSuggestionStartDate(newStart);
        setSuggestionEndDate(newEnd);

        fetchProductions();
        fetchFactoryUsers();
        fetchSuggestions(newStart, newEnd);
        fetchOrders();
        fetchMonthlyPlan(currentDate, newStart, newEnd, preventPastSuggestions);
    }, [companyId, currentDate.getMonth(), currentDate.getFullYear()]);

    // Recalculate BOM mix formula based on product profile and target lbs
    const recalculateMixFormula = (profileName, targetLbs) => {
        const qty = parseFloat(targetLbs) || 12000;
        const profLower = (profileName || '').toLowerCase();

        let rawLiquid = qty;
        let boxes = Math.round(qty / 36.1);
        let claraSepPct = 0;
        let claraLbs = 0;
        let yemaCoproduct = 0;
        let yemaReutilized = 0;
        let waterLbs = 0;
        let citricAcid = '0.00';
        let sugarLbs = '0.00';
        let saltLbs = '0.00';
        let milkLbs = '0.00';
        let solids = 23.5;
        let notes = '';

        if (profLower.includes('separaci') || profLower.includes('formulado')) {
            // Caso reformulación con MP liquida A por separación de clara
            // 1 lb yema pura (50% sólidos) + 1.22 lbs MP liquida A -> 2.22 lbs formulado
            solids = 22.5;
            claraSepPct = 100;
            const yemaNeeded = qty / 2.22;
            rawLiquid = Math.round(yemaNeeded / 0.308); // Yema es 30.8% del líquido quebrado
            boxes = Math.round(rawLiquid / 36.1);
            claraLbs = Math.round(rawLiquid * 0.5395); // 53.95% rinde clara
            yemaCoproduct = Math.round(yemaNeeded);
            yemaReutilized = yemaCoproduct;
            waterLbs = Math.round(qty - yemaNeeded);
            citricAcid = (qty * 0.0015).toFixed(2);
            notes = `Separar ${claraLbs.toLocaleString()} Lbs de clara pura para empaque. Reincorporar ${yemaReutilized.toLocaleString()} Lbs de yema coproducto con ${waterLbs.toLocaleString()} Lbs de MP liquida A y ${citricAcid} Lbs de ácido cítrico.`;
        } else if (profLower.includes('clara')) {
            solids = 11.5;
            rawLiquid = Math.round(qty / 0.5395);
            boxes = Math.round(rawLiquid / 36.1);
            claraSepPct = 100;
            claraLbs = qty;
            yemaCoproduct = Math.round(rawLiquid * 0.308);
            notes = `Corrida de separación de clara. Genera ${yemaCoproduct.toLocaleString()} Lbs de yema coproducto excedente.`;
        } else if (profLower.includes('plus')) {
            solids = 21.5;
            waterLbs = Math.round(qty * 0.08);
            rawLiquid = qty - waterLbs;
            boxes = Math.round(rawLiquid / 36.1);
            citricAcid = (qty * 0.0012).toFixed(2);
            notes = `Adicionar ${waterLbs.toLocaleString()} Lbs liquido(8%) y ${citricAcid} Lbs de ácido cítrico sobre ${rawLiquid.toLocaleString()} Lbs de huevo líquido base.`;
        } else if (profLower.includes('azucar')) {
            solids = 48.0;
            sugarLbs = (qty * 0.04).toFixed(2);
            rawLiquid = qty - parseFloat(sugarLbs);
            boxes = Math.round((rawLiquid / 0.308) / 36.1);
            notes = `Yema azucarada al 4%: mezclar ${rawLiquid.toLocaleString()} Lbs de yema con ${sugarLbs} Lbs de azúcar refinada.`;
        } else if (profLower.includes('salada')) {
            solids = 47.0;
            saltLbs = (qty * 0.10).toFixed(2);
            rawLiquid = qty - parseFloat(saltLbs);
            boxes = Math.round((rawLiquid / 0.308) / 36.1);
            notes = `Yema salada al 10%: mezclar ${rawLiquid.toLocaleString()} Lbs de yema con ${saltLbs} Lbs de sal no yodada.`;
        } else if (profLower.includes('leche')) {
            solids = 22.0;
            milkLbs = (qty * 0.06).toFixed(2);
            waterLbs = Math.round(qty * 0.04);
            rawLiquid = qty - parseFloat(milkLbs) - waterLbs;
            boxes = Math.round(rawLiquid / 36.1);
            notes = `Huevo con leche: dosificar ${milkLbs} Lbs de leche en polvo y ${waterLbs} Lbs de liquido.`;
        } else {
            // Huevo entero estándar
            solids = 23.5;
            rawLiquid = qty;
            boxes = Math.round(qty / 36.1);
            notes = `Huevo entero pasteurizado estándar al 83% de rendimiento (332 cajas aprox por batch de 12,000 Lbs).`;
        }

        const waterBottles = waterLbs > 0 ? Math.ceil(waterLbs / 41.8) : 0;

        return {
            raw_egg_boxes: boxes,
            raw_liquid_lbs: rawLiquid,
            clara_separated_pct: claraSepPct,
            clara_produced_lbs: claraLbs,
            yema_coproduct_lbs: yemaCoproduct,
            yema_reutilized_lbs: yemaReutilized,
            water_h2o_lbs: waterLbs,
            water_bottles: waterBottles,
            citric_acid_lbs: citricAcid,
            sugar_lbs: sugarLbs,
            salt_lbs: saltLbs,
            milk_powder_lbs: milkLbs,
            target_solids_pct: solids,
            notes
        };
    };

    // Open modal to create new production
    const handleOpenCreateModal = (suggestedDate = null, defaultRunData = null) => {
        const targetDate = suggestedDate || getTodayString(new Date());
        const julianLot = generateJulianLotCode(targetDate, 1, julianFormat);
        const secondJulianLot = generateJulianLotCode(targetDate, 2, julianFormat);

        if (defaultRunData) {
            const isSep = (defaultRunData.product_profile || '').toLowerCase().includes('clara') || (defaultRunData.product_profile || '').toLowerCase().includes('separaci');
            const targetQty = defaultRunData.target_quantity_lbs || (isSep ? (separationBatchLbs || 6000) : 12000);
            setFormData({
                id: null,
                production_date: defaultRunData.production_date || targetDate,
                start_time: defaultRunData.start_time || '06:00',
                end_time: defaultRunData.end_time || '14:00',
                lot_code: defaultRunData.lot_code || julianLot,
                product_profile: defaultRunData.product_profile || 'Huevo Entero Pasteurizado',
                presentation: defaultRunData.presentation || 'cubeta 30LB',
                target_quantity_lbs: targetQty,
                target_solids_pct: defaultRunData.target_solids_pct || 22.5,
                status: 'programado',
                priority: defaultRunData.priority || 'alta',
                mix_formula_json: defaultRunData.mix_formula_json || recalculateMixFormula(defaultRunData.product_profile, targetQty),
                assigned_operator_id: '',
                assigned_operator_name: '',
                notes: defaultRunData.notes || '',
                tasks: (defaultRunData.tasks || []).map(t => ({
                    factory_role: t.factory_role || 'General',
                    user_name: 'Operario de Planta',
                    task_description: t.task_description || '',
                    checklist_status: 'pendiente'
                })),
                enable_secondary_batch: false,
                secondary_lots: [],
                second_lot_code: secondJulianLot,
                second_product_profile: 'Clara de Huevo Pasteurizada',
                second_presentation: getDefaultPresentationForProduct('Clara de Huevo Pasteurizada'),
                second_target_quantity_lbs: 6000,
                second_target_solids_pct: 11.5
            });
        } else {
            const defaultMix = recalculateMixFormula('Huevo Entero Pasteurizado', 12000);
            setFormData({
                id: null,
                production_date: targetDate,
                start_time: '06:00',
                end_time: '14:00',
                lot_code: julianLot,
                product_profile: 'Huevo Entero Pasteurizado',
                presentation: 'cubeta 30LB',
                target_quantity_lbs: 12000,
                target_solids_pct: 23.5,
                status: 'programado',
                priority: 'media',
                mix_formula_json: defaultMix,
                assigned_operator_id: '',
                assigned_operator_name: '',
                notes: '',
                tasks: [
                    { factory_role: 'Sanitización CIP', user_name: 'Sanitizador', task_description: 'Verificar sanitización CIP del pasteurizador a 78°C', checklist_status: 'pendiente' },
                    { factory_role: 'Quebrado y Carga', user_name: 'Operador Quebrado', task_description: 'Cargar tolva con 332 cajas de huevo blanco', checklist_status: 'pendiente' },
                    { factory_role: 'Pasteurización HACCP', user_name: 'Operador Pasteurizador', task_description: 'Pasteurizar a 64.5°C por 210s CCP-1', checklist_status: 'pendiente' },
                    { factory_role: 'Control de Calidad LAB-004', user_name: 'Analista LAB', task_description: 'Medir Brix 23.5% y pH de línea', checklist_status: 'pendiente' },
                    { factory_role: 'Empaque y Cuarto Frío', user_name: 'Empacador', task_description: 'Alistar 400 cubetas de 30 Lb sanitizadas con liner', checklist_status: 'pendiente' }
                ],
                enable_secondary_batch: false,
                secondary_lots: [],
                second_lot_code: secondJulianLot,
                second_product_profile: 'Clara de Huevo Pasteurizada',
                second_presentation: getDefaultPresentationForProduct('Clara de Huevo Pasteurizada'),
                second_target_quantity_lbs: 6000,
                second_target_solids_pct: 11.5
            });
        }

        setIsFormModalOpen(true);
    };

    // Open modal to edit existing production
    const handleOpenEditModal = (prod) => {
        const rootProd = prod.parent_production_id
            ? ((Array.isArray(productions) ? productions : []).find(p => p.id === prod.parent_production_id) || prod)
            : prod;

        const companions = (Array.isArray(productions) ? productions : []).filter(
            p => p.id !== rootProd.id && (p.parent_production_id === rootProd.id || (rootProd.parent_production_id && p.parent_production_id === rootProd.parent_production_id))
        );
        const mappedSec = companions.map(c => ({
            id: c.id,
            lot_code: c.lot_code,
            product_profile: c.product_profile,
            presentation: c.presentation,
            target_quantity_lbs: c.target_quantity_lbs || 6000
        }));

        setFormData({
            id: rootProd.id,
            production_date: rootProd.production_date ? getTodayString(new Date(rootProd.production_date)) : '',
            start_time: rootProd.start_time ? rootProd.start_time.slice(0, 5) : '06:00',
            end_time: rootProd.end_time ? rootProd.end_time.slice(0, 5) : '14:00',
            lot_code: rootProd.lot_code || '',
            product_profile: rootProd.product_profile || 'Huevo Entero Pasteurizado',
            presentation: rootProd.presentation || 'cubeta 30LB',
            target_quantity_lbs: rootProd.target_quantity_lbs || 12000,
            target_solids_pct: rootProd.target_solids_pct || 21.5,
            status: rootProd.status || 'programado',
            priority: rootProd.priority || 'media',
            mix_formula_json: rootProd.mix_formula_json || {},
            assigned_operator_id: rootProd.assigned_operator_id || '',
            assigned_operator_name: rootProd.assigned_operator_name || '',
            notes: rootProd.notes || '',
            tasks: rootProd.tasks || [],
            enable_secondary_batch: mappedSec.length > 0,
            secondary_lots: mappedSec,
            second_lot_code: mappedSec[0]?.lot_code || '',
            second_product_profile: mappedSec[0]?.product_profile || 'Clara de Huevo Pasteurizada',
            second_presentation: mappedSec[0]?.presentation || 'cubeta 30LB',
            second_target_quantity_lbs: mappedSec[0]?.target_quantity_lbs || 6000,
            second_target_solids_pct: 11.5,
            is_coproduct: Boolean(rootProd.is_coproduct),
            parent_production_id: rootProd.parent_production_id || null
        });
        setIsFormModalOpen(true);
    };

    // Handlers for adding, removing and updating secondary co-product lots
    const handleAddSecondaryLot = () => {
        const count = (formData.secondary_lots || []).length;
        const nextIdx = count + 2;
        const nextLot = generateJulianLotCode(formData.production_date, nextIdx, julianFormat);
        const defaultProfiles = ['Clara de Huevo Pasteurizada', 'Yema Azucarada', 'Yema Salada', 'Huevo Entero Pasteurizado'];
        const prof = defaultProfiles[count % defaultProfiles.length] || 'Clara de Huevo Pasteurizada';
        const defaultPres = getDefaultPresentationForProduct(prof);
        setFormData(prev => ({
            ...prev,
            enable_secondary_batch: true,
            secondary_lots: [
                ...(prev.secondary_lots || []),
                {
                    id: `sec-${Date.now()}-${nextIdx}`,
                    lot_code: nextLot,
                    product_profile: prof,
                    presentation: defaultPres,
                    target_quantity_lbs: 6000
                }
            ]
        }));
    };

    const handleRemoveSecondaryLot = (idx) => {
        setFormData(prev => {
            const updated = (prev.secondary_lots || []).filter((_, i) => i !== idx);
            return {
                ...prev,
                enable_secondary_batch: updated.length > 0,
                secondary_lots: updated
            };
        });
    };

    const handleUpdateSecondaryLot = (idx, field, value) => {
        setFormData(prev => {
            const updated = [...(prev.secondary_lots || [])];
            if (updated[idx]) {
                updated[idx] = { ...updated[idx], [field]: value };
                if (field === 'product_profile') {
                    updated[idx].presentation = getDefaultPresentationForProduct(value);
                }
            }
            return { ...prev, secondary_lots: updated };
        });
    };

    // Handle Profile Change in Form
    const handleProfileChange = (newProfile) => {
        const profLower = (newProfile || '').toLowerCase();
        let targetQty = formData.target_quantity_lbs;
        // Si cambia a separación (Clara o Formulado por separación), calibrar por lote de separación
        if ((profLower.includes('clara') || profLower.includes('separaci')) && targetQty === 12000) {
            targetQty = separationBatchLbs || 6000;
        } else if (profLower.includes('entero') && targetQty === (separationBatchLbs || 6000)) {
            targetQty = 12000;
        }
        const newMix = recalculateMixFormula(newProfile, targetQty);
        const defaultPres = getDefaultPresentationForProduct(newProfile);
        setFormData(prev => ({
            ...prev,
            product_profile: newProfile,
            presentation: defaultPres,
            target_quantity_lbs: targetQty,
            target_solids_pct: newMix.target_solids_pct,
            mix_formula_json: newMix
        }));
    };

    // Handle Target Quantity Change in Form
    const handleQuantityChange = (newQty) => {
        const val = parseFloat(newQty) || 0;
        const newMix = recalculateMixFormula(formData.product_profile, val);
        setFormData(prev => ({
            ...prev,
            target_quantity_lbs: val,
            mix_formula_json: newMix
        }));
    };

    // Add Task to local checklist
    const handleAddTask = () => {
        if (!newTaskDesc || newTaskDesc.trim() === '') {
            return toast.warning('Escriba la descripción de la tarea.');
        }
        const userObj = factoryUsers.find(u => String(u.id) === String(newTaskUser));
        const taskItem = {
            user_id: userObj ? userObj.id : null,
            user_name: userObj ? userObj.nombre : 'Operario de Planta',
            factory_role: newTaskRole,
            task_description: newTaskDesc.trim(),
            checklist_status: 'pendiente'
        };
        setFormData(prev => ({
            ...prev,
            tasks: [...prev.tasks, taskItem]
        }));
        setNewTaskDesc('');
    };

    // Remove Task from local checklist
    const handleRemoveTask = (idx) => {
        setFormData(prev => ({
            ...prev,
            tasks: prev.tasks.filter((_, i) => i !== idx)
        }));
    };

    // Save Production (Create or Update)
    const handleSaveProduction = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (formData.id) {
                const secLots = formData.secondary_lots || [];
                const secProductionsPayload = secLots.map(sl => ({
                    id: (sl.id && !String(sl.id).startsWith('sec-')) ? sl.id : null,
                    lot_code: sl.lot_code,
                    product_profile: sl.product_profile,
                    presentation: sl.presentation,
                    target_quantity_lbs: parseFloat(sl.target_quantity_lbs) || 6000,
                    target_solids_pct: (sl.product_profile || '').toLowerCase().includes('clara') ? 11.5 : 21.5,
                    mix_formula_json: recalculateMixFormula(sl.product_profile, sl.target_quantity_lbs)
                }));

                const updatePayload = {
                    ...formData,
                    enable_secondary_batch: secLots.length > 0,
                    secondary_lots: secProductionsPayload,
                    secondary_productions: secProductionsPayload,
                    secondary_production: secProductionsPayload[0] || null
                };

                await axios.put(`/api/egg-industrial/calendar/${formData.id}`, updatePayload);
                toast.success(secLots.length > 0
                    ? `Producción multi-lote (${1 + secLots.length} lotes) actualizada exitosamente.`
                    : 'Producción actualizada exitosamente.'
                );
            } else {
                const secLots = formData.secondary_lots || [];
                const secProductionsPayload = secLots.map(sl => ({
                    lot_code: sl.lot_code,
                    product_profile: sl.product_profile,
                    presentation: sl.presentation,
                    target_quantity_lbs: parseFloat(sl.target_quantity_lbs) || 6000,
                    target_solids_pct: (sl.product_profile || '').toLowerCase().includes('clara') ? 11.5 : 21.5,
                    mix_formula_json: recalculateMixFormula(sl.product_profile, sl.target_quantity_lbs)
                }));

                const payload = {
                    ...formData,
                    enable_secondary_batch: secLots.length > 0,
                    secondary_productions: secProductionsPayload,
                    secondary_production: secProductionsPayload[0] || null
                };
                await axios.post('/api/egg-industrial/calendar', payload);
                toast.success(secLots.length > 0
                    ? `Producción multi-lote (${1 + secLots.length} lotes vinculados) programada exitosamente.`
                    : 'Producción programada exitosamente.'
                );
            }
            setIsFormModalOpen(false);
            fetchProductions();
        } catch (error) {
            console.error('Error al guardar producción:', error);
            toast.error(error.response?.data?.message || 'Error al guardar producción.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Production
    const handleDeleteProduction = async (id, lotCode) => {
        if (!window.confirm(`¿Está seguro de eliminar la producción programada ${lotCode}?`)) return;
        try {
            await axios.delete(`/api/egg-industrial/calendar/${id}`);
            toast.success(`Producción ${lotCode} eliminada.`);
            fetchProductions();
        } catch (error) {
            console.error('Error al eliminar:', error);
            toast.error(error.response?.data?.message || 'Error al eliminar producción.');
        }
    };

    // Start Batch in Plant
    const _handleStartBatchInPlant = (id) => {
        navigate('/industrial/produccion', { state: { scheduledProductionId: id } });
    };

    // Toggle Task Status directly from Calendar / View
    const handleToggleTask = async (taskId) => {
        try {
            await axios.patch(`/api/egg-industrial/calendar/tasks/${taskId}/toggle`);
            setProductions(prev => prev.map(p => ({
                ...p,
                tasks: p.tasks.map(t => {
                    if (t.id === taskId) {
                        const nextStatus = t.checklist_status === 'completado' ? 'pendiente' : 'completado';
                        return { ...t, checklist_status: nextStatus };
                    }
                    return t;
                })
            })));
            toast.success('Estado de tarea actualizado.');
        } catch (error) {
            console.error('Error al alternar tarea:', error);
            toast.error('Error al actualizar tarea.');
        }
    };

    // --- DRAG AND DROP HANDLERS ---
    const handleDragStart = (e, prod) => {
        setDraggedItem(prod);
        e.dataTransfer.setData('text/plain', String(prod.id));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, dateStr) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverDate !== dateStr) {
            setDragOverDate(dateStr);
        }
    };

    const handleDragLeave = () => {
        setDragOverDate(null);
    };

    const handleDrop = async (e, targetDateStr) => {
        e.preventDefault();
        setDragOverDate(null);
        if (!draggedItem) return;

        const originalDate = draggedItem.production_date ? getTodayString(new Date(draggedItem.production_date)) : '';
        if (originalDate === targetDateStr) {
            setDraggedItem(null);
            return;
        }

        // Optimistic UI update
        const updatedItem = { ...draggedItem, production_date: targetDateStr };
        setProductions(prev => prev.map(p => p.id === draggedItem.id ? updatedItem : p));

        try {
            await axios.patch(`/api/egg-industrial/calendar/${draggedItem.id}/move`, {
                production_date: targetDateStr
            });
            toast.success(`Lote ${draggedItem.lot_code} reprogramado al ${targetDateStr}`);
        } catch (error) {
            console.error('Error al mover producción:', error);
            toast.error('Error al reprogramar la fecha de producción.');
            fetchProductions(); // Rollback
        } finally {
            setDraggedItem(null);
        }
    };

    const handleDeleteOrder = async (id) => {
        if (!window.confirm('¿Eliminar este pedido de cliente?')) return;
        try {
            await axios.delete(`/api/egg-industrial/orders/${id}`);
            toast.success('Pedido eliminado.');
            fetchOrders();
            fetchSuggestions();
        } catch (error) {
            console.error('Error al eliminar pedido:', error);
            toast.error('Error al eliminar pedido.');
        }
    };

    // Alterar fecha de producción o pedido directamente desde el calendario
    const handleOpenAlterDateModal = (type, item) => {
        const currentDate = type === 'production'
            ? (item.production_date ? item.production_date.split('T')[0] : '')
            : (item.required_delivery_date ? item.required_delivery_date.split('T')[0] : '');
        const title = type === 'production'
            ? `Producción Lote ${item.lot_code} (${item.product_profile})`
            : `Pedido de ${item.customer_name} (${item.product_type} - ${parseFloat(item.quantity_lbs || 0).toLocaleString()} Lbs)`;
        setAlterDateItem({ type, id: item.id, item, title, currentDate });
        setNewAlteredDate(currentDate || getTodayString(new Date()));
    };

    const handleSaveAlteredDate = async (e) => {
        if (e) e.preventDefault();
        if (!alterDateItem || !newAlteredDate) return;
        try {
            setIsAlteringDate(true);
            if (alterDateItem.type === 'production') {
                await axios.patch(`/api/egg-industrial/calendar/${alterDateItem.id}`, {
                    production_date: newAlteredDate
                });
                toast.success('Fecha de producción reprogramada exitosamente.');
                fetchProductions();
            } else {
                await axios.put(`/api/egg-industrial/orders/${alterDateItem.id}`, {
                    ...alterDateItem.item,
                    required_delivery_date: newAlteredDate
                });
                toast.success('Fecha de entrega de pedido reprogramada exitosamente.');
                fetchOrders();
                fetchSuggestions();
            }
            setAlterDateItem(null);
        } catch (err) {
            console.error('Error alterando fecha:', err);
            toast.error(err.response?.data?.message || 'Error al reprogramar fecha.');
        } finally {
            setIsAlteringDate(false);
        }
    };

    // Filtered Productions
    const filteredProductions = useMemo(() => {
        return productions.filter(p => {
            const matchesSearch = !searchTerm ||
                (p.lot_code && p.lot_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.product_profile && p.product_profile.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.assigned_operator_name && p.assigned_operator_name.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
            const matchesProfile = profileFilter === 'todos' || p.product_profile === profileFilter;

            return matchesSearch && matchesStatus && matchesProfile;
        });
    }, [productions, searchTerm, statusFilter, profileFilter]);

    // Calendar Calculations for Monthly Grid
    const calendarMonthDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        // Day of week: 0 is Sun, 1 is Mon. Adjust so week starts on Monday (0=Mon, 6=Sun)
        let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
        if (startingDayOfWeek === -1) startingDayOfWeek = 6;

        const totalDaysInMonth = lastDayOfMonth.getDate();
        const days = [];

        // Previous month days padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthLastDay - i);
            days.push({
                date: d,
                dateStr: getTodayString(d),
                isCurrentMonth: false,
                dayNumber: d.getDate()
            });
        }

        // Current month days
        for (let i = 1; i <= totalDaysInMonth; i++) {
            const d = new Date(year, month, i);
            days.push({
                date: d,
                dateStr: getTodayString(d),
                isCurrentMonth: true,
                dayNumber: i
            });
        }

        // Next month days padding to complete 35 or 42 grid cells
        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            const d = new Date(year, month + 1, i);
            days.push({
                date: d,
                dateStr: getTodayString(d),
                isCurrentMonth: false,
                dayNumber: i
            });
        }

        return days;
    }, [currentDate]);

    // Helper to get productions for a specific date
    const getProductionsForDate = (dateStr) => {
        return filteredProductions.filter(p => {
            if (!p.production_date) return false;
            const pDate = getTodayString(new Date(p.production_date));
            return pDate === dateStr;
        });
    };

    // Helper for profile badge colors
    const getProfileBadgeStyle = (profile) => {
        const pLower = (profile || '').toLowerCase();
        if (pLower.includes('separaci') || pLower.includes('formulado')) {
            return {
                bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                card: 'border-l-4 border-l-emerald-500 bg-emerald-50/50 hover:bg-emerald-50'
            };
        }
        if (pLower.includes('clara')) {
            return {
                bg: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
                card: 'border-l-4 border-l-teal-500 bg-teal-50/50 hover:bg-teal-50'
            };
        }
        if (pLower.includes('yema')) {
            return {
                bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                card: 'border-l-4 border-l-amber-500 bg-amber-50/50 hover:bg-amber-50'
            };
        }
        if (pLower.includes('leche')) {
            return {
                bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                card: 'border-l-4 border-l-purple-500 bg-purple-50/50 hover:bg-purple-50'
            };
        }
        if (pLower.includes('plus')) {
            return {
                bg: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
                card: 'border-l-4 border-l-cyan-500 bg-cyan-50/50 hover:bg-cyan-50'
            };
        }
        return {
            bg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
            card: 'border-l-4 border-l-indigo-500 bg-indigo-50/40 hover:bg-indigo-50'
        };
    };

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const todayStr = getTodayString(new Date());

    // Summary KPIs
    const totalScheduledLbs = useMemo(() => {
        return filteredProductions.reduce((sum, p) => sum + (parseFloat(p.target_quantity_lbs) || 0), 0);
    }, [filteredProductions]);

    const totalTasksCount = useMemo(() => {
        let done = 0;
        let total = 0;
        filteredProductions.forEach(p => {
            (p.tasks || []).forEach(t => {
                total++;
                if (t.checklist_status === 'completado') done++;
            });
        });
        return { done, total };
    }, [filteredProductions]);


 return { PRODUCT_PROFILES, FACTORY_ROLES, DEFAULT_PRESETS_BY_ROLE, PRESENTATIONS, _findAgreementForProduct, user, navigate, companyId, calendarView, setCalendarView, currentDate, setCurrentDate, productions, setProductions, loading, setLoading, factoryUsers, setFactoryUsers, suggestionsData, setSuggestionsData, loadingSuggestions, setLoadingSuggestions, customerOrders, setCustomerOrders, searchTerm, setSearchTerm, statusFilter, setStatusFilter, profileFilter, setProfileFilter, isFormModalOpen, setIsFormModalOpen, isSuggestionsDrawerOpen, setIsSuggestionsDrawerOpen, isOrdersModalOpen, setIsOrdersModalOpen, isPlannerModalOpen, setIsPlannerModalOpen, isSubmitting, setIsSubmitting, isCustomerOrderModalOpen, setIsCustomerOrderModalOpen, selectedOrderToEdit, setSelectedOrderToEdit, alterDateItem, setAlterDateItem, newAlteredDate, setNewAlteredDate, isAlteringDate, setIsAlteringDate, suggestionsTab, setSuggestionsTab, monthlyPlanData, setMonthlyPlanData, loadingMonthlyPlan, setLoadingMonthlyPlan, applyingPlan, setApplyingPlan, selectedPlanRuns, setSelectedPlanRuns, julianFormat, setJulianFormat, hoverPreview, setHoverPreview, suggestionStartDate, setSuggestionStartDate, suggestionEndDate, setSuggestionEndDate, preventPastSuggestions, setPreventPastSuggestions, availableCustomers, setAvailableCustomers, selectedCustomerIds, setSelectedCustomerIds, separationBatchLbs, setSeparationBatchLbs, isConfigDrawerOpen, setIsConfigDrawerOpen, handleToggleCustomer, handleSelectAllCustomers, handleDeselectAllCustomers, draggedItem, setDraggedItem, dragOverDate, setDragOverDate, formData, setFormData, newTaskRole, setNewTaskRole, newTaskUser, setNewTaskUser, newTaskDesc, setNewTaskDesc, fetchProductions, fetchFactoryUsers, fetchSuggestions, fetchOrders, fetchMonthlyPlan, handleConvertLotToJulian, handleApplyMonthlyPlan, recalculateMixFormula, handleOpenCreateModal, handleOpenEditModal, handleProfileChange, handleQuantityChange, handleAddTask, handleRemoveTask, handleSaveProduction, handleDeleteProduction, _handleStartBatchInPlant, handleToggleTask, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDeleteOrder, handleOpenAlterDateModal, handleSaveAlteredDate, filteredProductions, calendarMonthDays, getProductionsForDate, getProfileBadgeStyle, monthNames, todayStr, totalScheduledLbs, totalTasksCount, handleAddSecondaryLot, handleRemoveSecondaryLot, handleUpdateSecondaryLot };
}
