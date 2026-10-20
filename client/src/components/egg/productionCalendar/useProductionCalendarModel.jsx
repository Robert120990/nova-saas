import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { getTodayString } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import { useAuth } from '../../../context/AuthContext';
import {
    PRODUCT_PROFILES,
    FACTORY_ROLES,
    DEFAULT_PRESETS_BY_ROLE,
    PRESENTATIONS,
    MONTH_NAMES,
    findAgreementForProduct,
    recalculateMixFormula,
    getProfileBadgeStyle,
    buildCalendarMonthDays
} from './eggCalendarConstants';
import useEggCalendarActions from './useEggCalendarActions';

export default function useProductionCalendarModel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const companyId = user?.company_id || 1;

    const [calendarView, setCalendarView] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [productions, setProductions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [factoryUsers, setFactoryUsers] = useState([]);
    const [suggestionsData, setSuggestionsData] = useState(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [customerOrders, setCustomerOrders] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [profileFilter, setProfileFilter] = useState('todos');

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isSuggestionsDrawerOpen, setIsSuggestionsDrawerOpen] = useState(false);
    const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
    const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isCustomerOrderModalOpen, setIsCustomerOrderModalOpen] = useState(false);
    const [selectedOrderToEdit, setSelectedOrderToEdit] = useState(null);
    const [alterDateItem, setAlterDateItem] = useState(null);
    const [newAlteredDate, setNewAlteredDate] = useState('');
    const [isAlteringDate, setIsAlteringDate] = useState(false);

    const [suggestionsTab, setSuggestionsTab] = useState('monthly');
    const [monthlyPlanData, setMonthlyPlanData] = useState(null);
    const [loadingMonthlyPlan, setLoadingMonthlyPlan] = useState(false);
    const [applyingPlan, setApplyingPlan] = useState(false);
    const [selectedPlanRuns, setSelectedPlanRuns] = useState([]);
    const [julianFormat, setJulianFormat] = useState('standard');
    const [hoverPreview, setHoverPreview] = useState(null);

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

    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState(null);
    const [separationBatchLbs, setSeparationBatchLbs] = useState(6000);
    const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);

    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverDate, setDragOverDate] = useState(null);

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

    const [newTaskRole, setNewTaskRole] = useState(FACTORY_ROLES[0]);
    const [newTaskUser, setNewTaskUser] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState(DEFAULT_PRESETS_BY_ROLE[FACTORY_ROLES[0]] || '');

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
            if (sepBatch) params.separation_batch_lbs = sepBatch;
            const res = await axios.get('/api/egg-industrial/calendar/suggestions', { params });
            setSuggestionsData(res.data || null);
            if (Array.isArray(res.data?.available_customers) && res.data.available_customers.length > 0) {
                setAvailableCustomers(res.data.available_customers);
                if (custIds === null || custIds === undefined) {
                    setSelectedCustomerIds(res.data.available_customers.filter((c) => c.active).map((c) => c.id));
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
            const params = {
                year: targetD.getFullYear(),
                month: targetD.getMonth() + 1,
                start_date: sDate,
                end_date: eDate,
                prevent_past: prevPast
            };
            if (custIds !== null && custIds !== undefined) {
                params.customer_ids = custIds.length > 0 ? custIds.join(',') : 'none';
            }
            if (sepBatch) params.separation_batch_lbs = sepBatch;
            const res = await axios.get('/api/egg-industrial/calendar/monthly-suggestions', { params });
            setMonthlyPlanData(res.data || null);
            if (Array.isArray(res.data?.available_customers) && res.data.available_customers.length > 0) {
                setAvailableCustomers(res.data.available_customers);
                if (custIds === null || custIds === undefined) {
                    setSelectedCustomerIds(res.data.available_customers.filter((c) => c.active).map((c) => c.id));
                }
            }
            setSelectedPlanRuns((res.data?.monthly_plan || []).filter((p) => !p.already_scheduled));
        } catch (error) {
            console.error('Error cargando plan mensual de producción:', error);
        } finally {
            setLoadingMonthlyPlan(false);
        }
    };

    const handleToggleCustomer = (customerId) => {
        setSelectedCustomerIds((prev) => {
            const current = prev !== null ? prev : availableCustomers.map((c) => c.id);
            return current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId];
        });
    };

    const handleSelectAllCustomers = () => setSelectedCustomerIds(availableCustomers.map((c) => c.id));
    const handleDeselectAllCustomers = () => setSelectedCustomerIds([]);

    const handleConvertLotToJulian = async (prodId) => {
        try {
            const res = await axios.post(`/api/egg-industrial/calendar/${prodId}/convert-julian`);
            toast.success(`Lote actualizado a formato juliano: ${res.data.new_lot_code}`);
            fetchProductions();
        } catch {
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
            const res = await axios.post('/api/egg-industrial/calendar/apply-monthly-plan', { productions: selectedPlanRuns });
            toast.success(res.data.message || 'Plan mensual aplicado exitosamente al calendario.');
            setIsSuggestionsDrawerOpen(false);
            fetchProductions();
            fetchSuggestions();
            fetchMonthlyPlan(currentDate);
        } catch (error) {
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

    const actions = useEggCalendarActions({
        productions,
        setProductions,
        formData,
        setFormData,
        setIsFormModalOpen,
        setIsSubmitting,
        julianFormat,
        separationBatchLbs,
        factoryUsers,
        newTaskRole,
        newTaskUser,
        newTaskDesc,
        setNewTaskDesc,
        draggedItem,
        setDraggedItem,
        dragOverDate,
        setDragOverDate,
        alterDateItem,
        setAlterDateItem,
        newAlteredDate,
        setNewAlteredDate,
        setIsAlteringDate,
        fetchProductions,
        fetchOrders,
        fetchSuggestions
    });

    const filteredProductions = useMemo(() => {
        return productions.filter((p) => {
            const matchesSearch = !searchTerm ||
                (p.lot_code && p.lot_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.product_profile && p.product_profile.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.assigned_operator_name && p.assigned_operator_name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
            const matchesProfile = profileFilter === 'todos' || p.product_profile === profileFilter;
            return matchesSearch && matchesStatus && matchesProfile;
        });
    }, [productions, searchTerm, statusFilter, profileFilter]);

    const calendarMonthDays = useMemo(() => buildCalendarMonthDays(currentDate), [currentDate]);

    const getProductionsForDate = (dateStr) => {
        return filteredProductions.filter((p) => p.production_date && getTodayString(new Date(p.production_date)) === dateStr);
    };

    const todayStr = getTodayString(new Date());
    const totalScheduledLbs = useMemo(() => filteredProductions.reduce((sum, p) => sum + (parseFloat(p.target_quantity_lbs) || 0), 0), [filteredProductions]);
    const totalTasksCount = useMemo(() => {
        let done = 0;
        let total = 0;
        filteredProductions.forEach((p) => {
            (p.tasks || []).forEach((t) => {
                total++;
                if (t.checklist_status === 'completado') done++;
            });
        });
        return { done, total };
    }, [filteredProductions]);

    return {
        PRODUCT_PROFILES,
        FACTORY_ROLES,
        DEFAULT_PRESETS_BY_ROLE,
        PRESENTATIONS,
        _findAgreementForProduct: findAgreementForProduct,
        user,
        navigate,
        companyId,
        calendarView,
        setCalendarView,
        currentDate,
        setCurrentDate,
        productions,
        setProductions,
        loading,
        setLoading,
        factoryUsers,
        setFactoryUsers,
        suggestionsData,
        setSuggestionsData,
        loadingSuggestions,
        setLoadingSuggestions,
        customerOrders,
        setCustomerOrders,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        profileFilter,
        setProfileFilter,
        isFormModalOpen,
        setIsFormModalOpen,
        isSuggestionsDrawerOpen,
        setIsSuggestionsDrawerOpen,
        isOrdersModalOpen,
        setIsOrdersModalOpen,
        isPlannerModalOpen,
        setIsPlannerModalOpen,
        isSubmitting,
        setIsSubmitting,
        isCustomerOrderModalOpen,
        setIsCustomerOrderModalOpen,
        selectedOrderToEdit,
        setSelectedOrderToEdit,
        alterDateItem,
        setAlterDateItem,
        newAlteredDate,
        setNewAlteredDate,
        isAlteringDate,
        setIsAlteringDate,
        suggestionsTab,
        setSuggestionsTab,
        monthlyPlanData,
        setMonthlyPlanData,
        loadingMonthlyPlan,
        setLoadingMonthlyPlan,
        applyingPlan,
        setApplyingPlan,
        selectedPlanRuns,
        setSelectedPlanRuns,
        julianFormat,
        setJulianFormat,
        hoverPreview,
        setHoverPreview,
        suggestionStartDate,
        setSuggestionStartDate,
        suggestionEndDate,
        setSuggestionEndDate,
        preventPastSuggestions,
        setPreventPastSuggestions,
        availableCustomers,
        setAvailableCustomers,
        selectedCustomerIds,
        setSelectedCustomerIds,
        separationBatchLbs,
        setSeparationBatchLbs,
        isConfigDrawerOpen,
        setIsConfigDrawerOpen,
        handleToggleCustomer,
        handleSelectAllCustomers,
        handleDeselectAllCustomers,
        draggedItem,
        setDraggedItem,
        dragOverDate,
        setDragOverDate,
        formData,
        setFormData,
        newTaskRole,
        setNewTaskRole,
        newTaskUser,
        setNewTaskUser,
        newTaskDesc,
        setNewTaskDesc,
        fetchProductions,
        fetchFactoryUsers,
        fetchSuggestions,
        fetchOrders,
        fetchMonthlyPlan,
        handleConvertLotToJulian,
        handleApplyMonthlyPlan,
        recalculateMixFormula,
        _handleStartBatchInPlant: (id) => navigate('/industrial/produccion', { state: { scheduledProductionId: id } }),
        filteredProductions,
        calendarMonthDays,
        getProductionsForDate,
        getProfileBadgeStyle,
        monthNames: MONTH_NAMES,
        todayStr,
        totalScheduledLbs,
        totalTasksCount,
        ...actions
    };
}
