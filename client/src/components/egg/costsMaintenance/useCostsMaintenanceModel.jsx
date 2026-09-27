import { getTodayString } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';



export default function useCostsMaintenanceModel() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const companyId = user?.company_id || 1;

    // Lists
    const [, setCosts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [maintenanceLogs, setMaintenanceLogs] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [, setLoading] = useState(true);

    // Returnables state (Control de cubetas y tapaderas & Estado de Cuenta)
    const [returnables, setReturnables] = useState([]);
    const [loadingReturnables, setLoadingReturnables] = useState(false);
    const [isSyncingSales, setIsSyncingSales] = useState(false);
    const [returnableSearch, setReturnableSearch] = useState('');
    const [returnableFilter, setReturnableFilter] = useState('all'); // 'all', 'pending', 'missing_lids'

    // Statement Modal state
    const [statementModal, setStatementModal] = useState(null);
    const [statementData, setStatementData] = useState(null);
    const [loadingStatement, setLoadingStatement] = useState(false);
    const [statementTypeFilter, setStatementTypeFilter] = useState('all');

    // Movement Modal
    const [movementModal, setMovementModal] = useState(null);
    const [movementForm, setMovementForm] = useState({
        movement_type: 'devolucion',
        cubetas_qty: '',
        cubetas_30lb_qty: '',
        cubetas_32lb_qty: '',
        tapaderas_qty: '',
        movement_date: getTodayString(new Date()),
        reference_document: '',
        notes: ''
    });

    // New Customer Modal
    const [newCustomerModal, setNewCustomerModal] = useState(false);
    const [customerCatalog, setCustomerCatalog] = useState([]);
    const [newCustomerForm, setNewCustomerForm] = useState({
        customer_id: '',
        customer_name: '',
        packaging_type: 'cubeta_30lb',
        initial_balance: 0,
        initial_tapaderas: 0,
        notes: ''
    });

    // Tab state
    const [activeTab, setActiveTab] = useState('costs'); // 'costs', 'returnables', 'maintenance', 'forecasting'

    // Form states
    const [maintenanceForm, setMaintenanceForm] = useState({
        equipment_name: 'pasteurizador',
        maintenance_type: 'preventivo',
        description: '',
        spare_parts_used: '',
        usage_hours_count: '',
        technician_name: '',
        cost: '0.00'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [profitMarginPercent, _setProfitMarginPercent] = useState(35);
    const [dateStart, setDateStart] = useState(getTodayString(new Date(new Date().setDate(1))));
    const [dateEnd, setDateEnd] = useState(getTodayString(new Date()));
    const [costConcepts, setCostConcepts] = useState([]);
    const [variableCostsModal, setVariableCostsModal] = useState(null);
    const [variableCosts, setVariableCosts] = useState([]);
    const [newVarCost, setNewVarCost] = useState({ concept_name: '', amount: '' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [cRes, bRes, mRes, fRes, ccRes] = await Promise.allSettled([
                axios.get('/api/egg-industrial/costs'),
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/maintenance'),
                axios.get('/api/egg-industrial/forecast'),
                axios.get('/api/egg-industrial/cost-concepts')
            ]);
            if (cRes.status === 'fulfilled') setCosts(cRes.value.data || []);
            if (bRes.status === 'fulfilled') setBatches(bRes.value.data || []);
            if (mRes.status === 'fulfilled') setMaintenanceLogs(mRes.value.data || []);
            if (ccRes.status === 'fulfilled') setCostConcepts(ccRes.value.data || []);
            if (fRes.status === 'fulfilled') setForecast(fRes.value.data || null);

            const allFailed = [cRes, bRes, mRes, fRes, ccRes].every(r => r.status === 'rejected');
            if (allFailed) {
                toast.error('Error al cargar datos de costos y mantenimiento.');
            }
        } catch (error) {
            console.error('Error fetching cost and maintenance data:', error);
            toast.error('Error al cargar datos de costos y mantenimiento.');
        } finally {
            setLoading(false);
        }
    };

    const fetchReturnables = async () => {
        setLoadingReturnables(true);
        try {
            const res = await axios.get('/api/egg-industrial/returnables/balances');
            setReturnables(unwrapList(res));
        } catch (error) {
            console.error('Error fetching returnables:', error);
            toast.error('Error al cargar balances de envases retornables.');
        } finally {
            setLoadingReturnables(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchReturnables();
    }, [companyId]);

    const openVariableCosts = async (batch) => {
        setVariableCostsModal(batch);
        try {
            const res = await axios.get(`/api/egg-industrial/batches/${batch.id}/variable-costs`);
            setVariableCosts(res.data);
        } catch (e) { setVariableCosts([]); }
        setNewVarCost({ concept_name: '', amount: '' });
    };

    const addVariableCost = async () => {
        if (!newVarCost.concept_name.trim() || !newVarCost.amount) return toast.error('Complete nombre y monto.');
        try {
            await axios.post(`/api/egg-industrial/batches/${variableCostsModal.id}/variable-costs`, {
                concept_name: newVarCost.concept_name,
                amount: parseFloat(newVarCost.amount)
            });
            toast.success('Costo variable agregado.');
            setNewVarCost({ concept_name: '', amount: '' });
            openVariableCosts(variableCostsModal);
        } catch (e) { toast.error('Error al agregar costo.'); }
    };

    const deleteVariableCost = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/variable-costs/${id}`);
            openVariableCosts(variableCostsModal);
        } catch (e) { toast.error('Error al eliminar costo.'); }
    };

    const getTotalFixedCost = () => costConcepts.reduce((s, c) => s + parseFloat(c.default_value || 0), 0);

    // Handle create maintenance log
    const handleCreateMaintenance = async (e) => {
        e.preventDefault();

        if (!maintenanceForm.description.trim()) {
            return toast.error('La descripción técnica es obligatoria.');
        }
        if (!maintenanceForm.usage_hours_count || parseInt(maintenanceForm.usage_hours_count) <= 0) {
            return toast.error('Debe ingresar las horas de uso acumuladas.');
        }
        if (!maintenanceForm.technician_name.trim()) {
            return toast.error('Ingrese el nombre del técnico responsable.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/maintenance', {
                ...maintenanceForm,
                usage_hours_count: parseInt(maintenanceForm.usage_hours_count),
                cost: parseFloat(maintenanceForm.cost)
            });
            toast.success('Mantenimiento técnico de maquinaria registrado.');
            setMaintenanceForm({
                equipment_name: 'pasteurizador',
                maintenance_type: 'preventivo',
                description: '',
                spare_parts_used: '',
                usage_hours_count: '',
                technician_name: '',
                cost: '0.00'
            });
            fetchData();
            setActiveTab('maintenance');
        } catch (error) {
            console.error('Error registering maintenance:', error);
            toast.error('Error al guardar bitácora de mantenimiento.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const syncSalesReturnables = async () => {
        setIsSyncingSales(true);
        try {
            const res = await axios.post('/api/egg-industrial/returnables/sync-sales');
            toast.success(res.data?.message || 'Sincronización de facturas completada.');
            await fetchReturnables();
            if (statementModal) {
                await openStatement(statementModal);
            }
        } catch (error) {
            console.error('Error syncing sales returnables:', error);
            toast.error(error.response?.data?.message || 'Error al sincronizar facturas.');
        } finally {
            setIsSyncingSales(false);
        }
    };

    const openStatement = async (customerRecord) => {
        setStatementModal(customerRecord);
        setLoadingStatement(true);
        try {
            const res = await axios.get(`/api/egg-industrial/returnables/customers/${customerRecord.id}/statement`);
            setStatementData(res.data);
        } catch (error) {
            console.error('Error fetching customer statement:', error);
            toast.error('Error al cargar estado de cuenta del cliente.');
        } finally {
            setLoadingStatement(false);
        }
    };

    const openNewCustomerModal = async () => {
        setNewCustomerModal(true);
        if (customerCatalog.length === 0) {
            try {
                const res = await axios.get('/api/customers?limit=200');
                setCustomerCatalog(res.data?.data || res.data || []);
            } catch (e) {
                console.warn('Could not fetch customer catalog:', e);
            }
        }
    };

    // Handle returnable movement submit (Cubetas y Tapaderas con 30 LB / 32 LB)
    const handleMovementSubmit = async (e) => {
        e.preventDefault();
        const c30 = parseInt(movementForm.cubetas_30lb_qty, 10) || 0;
        const c32 = parseInt(movementForm.cubetas_32lb_qty, 10) || 0;
        let cQty = parseInt(movementForm.cubetas_qty, 10) || 0;
        if (cQty === 0 && (c30 > 0 || c32 > 0)) {
            cQty = c30 + c32;
        }
        const tQty = parseInt(movementForm.tapaderas_qty, 10) || 0;
        if (cQty <= 0 && tQty <= 0) {
            return toast.error('Ingrese al menos una cantidad de cubetas o tapaderas mayor a 0.');
        }

        try {
            await axios.post('/api/egg-industrial/returnables/movements', {
                returnable_id: movementModal.id,
                movement_type: movementForm.movement_type,
                cubetas_qty: cQty,
                cubetas_30lb_qty: c30,
                cubetas_32lb_qty: c32,
                tapaderas_qty: tQty,
                movement_date: movementForm.movement_date || getTodayString(new Date()),
                reference_document: movementForm.reference_document,
                notes: movementForm.notes,
                registered_by: user?.nombre || user?.name || user?.username || 'Encargado Logística'
            });
            toast.success(`Movimiento de ${movementForm.movement_type} registrado correctamente.`);
            setMovementModal(null);
            setMovementForm({
                movement_type: 'devolucion',
                cubetas_qty: '',
                cubetas_30lb_qty: '',
                cubetas_32lb_qty: '',
                tapaderas_qty: '',
                movement_date: getTodayString(new Date()),
                reference_document: '',
                notes: ''
            });
            await fetchReturnables();
            if (statementModal && statementModal.id === movementModal.id) {
                await openStatement(statementModal);
            }
        } catch (error) {
            console.error('Error saving returnable movement:', error);
            toast.error(error.response?.data?.message || 'Error al registrar movimiento.');
        }
    };

    // Handle new customer for returnables (Cubetas y Tapaderas)
    const handleNewCustomerSubmit = async (e) => {
        e.preventDefault();
        if (!newCustomerForm.customer_name.trim()) return toast.error('Ingrese o seleccione el nombre del cliente.');

        try {
            await axios.post('/api/egg-industrial/returnables/customers', {
                customer_id: newCustomerForm.customer_id ? parseInt(newCustomerForm.customer_id, 10) : null,
                customer_name: newCustomerForm.customer_name,
                packaging_type: newCustomerForm.packaging_type,
                initial_balance: parseInt(newCustomerForm.initial_balance, 10) || 0,
                initial_tapaderas: parseInt(newCustomerForm.initial_tapaderas, 10) || 0,
                notes: newCustomerForm.notes
            });
            toast.success('Cliente registrado para control de cubetas y tapaderas.');
            setNewCustomerModal(false);
            setNewCustomerForm({
                customer_id: '',
                customer_name: '',
                packaging_type: 'cubeta_30lb',
                initial_balance: 0,
                initial_tapaderas: 0,
                notes: ''
            });
            fetchReturnables();
        } catch (error) {
            console.error('Error creating customer returnable:', error);
            toast.error(error.response?.data?.message || 'Error al guardar cliente.');
        }
    };


 return { user, navigate, companyId, setCosts, batches, setBatches, maintenanceLogs, setMaintenanceLogs, forecast, setForecast, setLoading, returnables, setReturnables, loadingReturnables, setLoadingReturnables, isSyncingSales, setIsSyncingSales, returnableSearch, setReturnableSearch, returnableFilter, setReturnableFilter, statementModal, setStatementModal, statementData, setStatementData, loadingStatement, setLoadingStatement, statementTypeFilter, setStatementTypeFilter, movementModal, setMovementModal, movementForm, setMovementForm, newCustomerModal, setNewCustomerModal, customerCatalog, setCustomerCatalog, newCustomerForm, setNewCustomerForm, activeTab, setActiveTab, maintenanceForm, setMaintenanceForm, isSubmitting, setIsSubmitting, profitMarginPercent, _setProfitMarginPercent, dateStart, setDateStart, dateEnd, setDateEnd, costConcepts, setCostConcepts, variableCostsModal, setVariableCostsModal, variableCosts, setVariableCosts, newVarCost, setNewVarCost, fetchData, fetchReturnables, openVariableCosts, addVariableCost, deleteVariableCost, getTotalFixedCost, handleCreateMaintenance, syncSalesReturnables, openStatement, openNewCustomerModal, handleMovementSubmit, handleNewCustomerSubmit };
}
