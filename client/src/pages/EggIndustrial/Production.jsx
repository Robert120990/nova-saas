import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
    Activity,
    Plus,
    Flame,
    Copy,
    Search,
    XCircle,
    ClipboardList,
    Wrench,
    AlertOctagon,
    Lock,
    Calendar,
    ShieldAlert,
    Sparkles,
    Layers,
    Trash2,
    Check,
    Camera,
    Pencil,
    Download,
    FileSpreadsheet,
    FileText,
    AlertTriangle,
    FileCheck,
    Scale
} from 'lucide-react';
import ProductionTarimaScannerModal from '../../components/egg/ProductionTarimaScannerModal';
import EggBatchStagesModal from '../../components/egg/EggBatchStagesModal';
import EggAddTarimasModal from '../../components/egg/EggAddTarimasModal';
import EggTarimaSearchModal from '../../components/egg/EggTarimaSearchModal';
import EggRemanenteModal from '../../components/egg/EggRemanenteModal';
import EggBatchWastesModal from '../../components/egg/EggBatchWastesModal';
import EggClosePasteurizationModal from '../../components/egg/EggClosePasteurizationModal';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { getJulianDayInfo } from '../../utils/julianDate';

const getNowDateTimeLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
};

const EggProduction = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const companyId = user?.company_id || 1;

    // Scheduled productions from Calendar
    const [scheduledProductions, setScheduledProductions] = useState([]);
    const [selectedScheduledProd, setSelectedScheduledProd] = useState(null);

    // Modal de escáner con cámara para tarimas QR / Código de barras
    const [scannerModalOpen, setScannerModalOpen] = useState(false);
    const [tarimaPickerModal, setTarimaPickerModal] = useState({ isOpen: false, lot: null, availableTarimas: [] });
    const [tarimaSearchPickerOpen, setTarimaSearchPickerOpen] = useState(false);

    // Lists
    const [batches, setBatches] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [availableRemanentes, setAvailableRemanentes] = useState([]);
    const [showAllRemanentes, setShowAllRemanentes] = useState(false);
    const [openExportMenuId, setOpenExportMenuId] = useState(null);
    const [cipLogs, setCipLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Navigation sub-tabs
    const [activeTab, setActiveTab] = useState('batches'); // 'batches', 'cip', 'new-batch', 'pasteurize'

    // Form States
    const [batchForm, setBatchForm] = useState({
        product_type: 'huevo entero',
        presentation: 'cubeta 30LB',
        presentations: ['cubeta 30LB'],
        run_number: 1,
        scheduled_production_id: null,
        raw_materials: [],
        remanente_ids: [],
        ingredients: {
            boxes_count: '',
            water_bottles: '',
            sugar_lbs: '',
            salt_lbs: '',
            citric_acid_lbs: '',
            milk_powder_lbs: '',
            ppg_g: ''
        },
        operator_name: user?.nombre || '',
        bypass_cip_check: false
    });

    const [cipForm, setCipForm] = useState({
        equipment_name: 'pasteurizador',
        chemical_used: 'Ácido Peracético 1.5%',
        temperature_c: '78.5',
        duration_minutes: '45',
        operator_name: user?.nombre || '',
        validation_status: 'completado',
        created_at: getNowDateTimeLocal(),
        batch_id: '',
        notes: ''
    });

    const [selectedBatchForPasteurize, setSelectedBatchForPasteurize] = useState('');
    const [pasteurizeForm, setPasteurizeForm] = useState({
        temperature_c: '64.5',
        holding_time_seconds: '210',
        pressure_psi: '48.0',
        flow_rate_gpm: '12.5',
        operator_name: user?.nombre || ''
    });

    const [selectedBatchForComplete, setSelectedBatchForComplete] = useState(null);
    const [completeForm, setCompleteForm] = useState({
        yield_liquid_lbs: '',
        waste_shell_lbs: '',
        waste_loss_lbs: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cipBlockedError, setCipBlockedError] = useState(null);
    const [haccpViolationAlert, setHaccpViolationAlert] = useState(null);
    const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
    const [isPasteurizeModalOpen, setIsPasteurizeModalOpen] = useState(false);
    const [productConfig, setProductConfig] = useState([]);

    // Role and Permissions
    const userPermissions = Array.isArray(user?.permissions)
        ? user.permissions
        : (typeof user?.permissions === 'string' ? JSON.parse(user?.permissions || '[]') : []);
    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin' || user?.role_id <= 2;
    const canEditProduction = isAdmin || userPermissions.includes('edit_egg_production');
    const canDeleteProduction = isAdmin || userPermissions.includes('delete_egg_production');
    const canManageLots = isAdmin || userPermissions.includes('manage_egg_production_lots');

    // Modals for Stages, Wastes, Remanentes, Edit & Delete
    const [stagesModal, setStagesModal] = useState({ isOpen: false, batch: null, data: null, loading: false });
    const [closePasteurizationModal, setClosePasteurizationModal] = useState({
        isOpen: false,
        batch: null,
        pasteurization_lot: '',
        notes: '',
        isSubmitting: false
    });
    const [scannerContext, setScannerContext] = useState('new_batch'); // 'new_batch' | 'add_tarimas'
    const [editingBatch, setEditingBatch] = useState(null);
    const [addTarimasModal, setAddTarimasModal] = useState({
        isOpen: false,
        batch: null,
        raw_materials: [
            { raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }
        ],
        manualTarimaInput: '',
        notes: '',
        isSubmitting: false
    });
    const [remanenteModal, setRemanenteModal] = useState({
        isOpen: false,
        batch: null,
        product_type: 'huevo entero',
        presentation: 'cubeta 30LB',
        weight_lbs: '',
        is_pasteurized: true,
        destination: 'proximo_empaque',
        notes: '',
        isSubmitting: false
    });
    const [wastesModal, setWastesModal] = useState({
        isOpen: false,
        batch: null,
        wastes: [],
        stage: 'quebraje',
        waste_type: 'cascaron',
        weight_lbs: '',
        notes: '',
        loading: false,
        isSubmitting: false
    });
    const [editBatchModal, setEditBatchModal] = useState({
        isOpen: false,
        batch: null,
        product_type: '',
        presentation: '',
        notes: '',
        isSubmitting: false
    });
    const [deleteConfirmBatch, setDeleteConfirmBatch] = useState(null);

    // Handlers for Stages, Wastes, Remanentes, Add Tarimas, Edit & Delete
    const handleOpenStagesModal = async (batch) => {
        setStagesModal({ isOpen: true, batch, data: null, loading: true });
        try {
            const res = await axios.get(`/api/egg-industrial/batches/${batch.id}/stages`);
            setStagesModal(prev => ({ ...prev, data: res.data, loading: false }));
        } catch (err) {
            console.error('Error fetching stages:', err);
            toast.error('No se pudieron cargar las etapas del lote.');
            setStagesModal(prev => ({ ...prev, loading: false }));
        }
    };

    const handleOpenClosePasteurization = (batch) => {
        if (!batch) return;
        setClosePasteurizationModal({
            isOpen: true,
            batch,
            pasteurization_lot: batch.pasteurization_lot || (batch.batch_code_display ? `PAST-${batch.batch_code_display}` : `PAST-${batch.id}`),
            notes: '',
            isSubmitting: false
        });
    };

    const handleConfirmClosePasteurization = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const { batch, pasteurization_lot, notes } = closePasteurizationModal;
        if (!batch) return;
        if (!pasteurization_lot?.trim()) {
            return toast.error('Debe ingresar un identificador o lote de pasteurización.');
        }

        setClosePasteurizationModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            const res = await axios.post(`/api/egg-industrial/batches/${batch.id}/close-pasteurization`, {
                pasteurization_lot: pasteurization_lot.trim(),
                notes: notes?.trim() || null
            });
            toast.success(res.data?.message || 'Pasteurización cerrada exitosamente.');
            setClosePasteurizationModal(prev => ({ ...prev, isOpen: false, isSubmitting: false, batch: null }));
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === batch.id) {
                handleOpenStagesModal(batch);
            }
        } catch (err) {
            console.error('Error cerrando pasteurización:', err);
            toast.error(err.response?.data?.message || 'Error al cerrar pasteurización.');
            setClosePasteurizationModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const handleReopenPasteurization = async (batch) => {
        if (!batch) return;
        if (!window.confirm(`¿Confirmas que deseas reabrir la pasteurización del lote ${batch.batch_code_display || batch.id}? Esto permitirá volver a modificar parámetros térmicos y agregar tarimas.`)) {
            return;
        }

        try {
            const res = await axios.post(`/api/egg-industrial/batches/${batch.id}/reopen-pasteurization`);
            toast.success(res.data?.message || 'Pasteurización reabierta con éxito.');
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === batch.id) {
                handleOpenStagesModal(batch);
            }
        } catch (err) {
            console.error('Error reabriendo pasteurización:', err);
            toast.error(err.response?.data?.message || 'Error al reabrir pasteurización.');
        }
    };

    const handleReopenBatchPackaging = async (batchId) => {
        if (!window.confirm('¿Confirmas que deseas volver a abrir el empaque para este lote? Se revertirá el cierre técnico y se habilitará nuevamente el envasado.')) {
            return;
        }

        try {
            const res = await axios.post(`/api/egg-industrial/batches/${batchId}/reopen-packaging`);
            toast.success(res.data?.message || 'Empaque reabierto con éxito.');
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === batchId) {
                handleOpenStagesModal({ id: batchId });
            }
        } catch (err) {
            console.error('Error al reabrir empaque:', err);
            toast.error(err.response?.data?.message || 'Error al reabrir empaque.');
        }
    };

    const handleOpenBalanceModal = (batch) => {
        if (!batch) return;
        setSelectedBatchForComplete(batch);
        const hasExistingBalance = parseFloat(batch.yield_liquid_lbs || 0) > 0;
        if (hasExistingBalance) {
            setCompleteForm({
                yield_liquid_lbs: String(batch.yield_liquid_lbs || ''),
                waste_shell_lbs: String(batch.waste_shell_lbs || '0'),
                waste_loss_lbs: String(batch.waste_loss_lbs || '0')
            });
        } else {
            const cfg = productConfig.find(c => c.product_type === batch.product_type) || {};
            const yieldPct = parseFloat(cfg.yield_pct || 85) / 100;
            const shellPct = parseFloat(cfg.waste_shell_pct || 12) / 100;
            const lossPct = parseFloat(cfg.waste_loss_pct || 3) / 100;
            const inputLbs = parseFloat(batch.input_weight_lbs || 0);
            setCompleteForm({
                yield_liquid_lbs: inputLbs > 0 ? (inputLbs * yieldPct).toFixed(2) : '',
                waste_shell_lbs: inputLbs > 0 ? (inputLbs * shellPct).toFixed(2) : '0',
                waste_loss_lbs: inputLbs > 0 ? (inputLbs * lossPct).toFixed(2) : '0'
            });
        }
    };

    const handleOpenWastesModal = async (batch) => {
        setWastesModal({
            isOpen: true,
            batch,
            wastes: [],
            editingWasteId: null,
            stage: 'quebraje',
            waste_type: 'cascaron',
            weight_lbs: '',
            notes: '',
            loading: true,
            isSubmitting: false
        });
        try {
            const res = await axios.get(`/api/egg-industrial/batches/${batch.id}/wastes`);
            setWastesModal(prev => ({ ...prev, wastes: res.data || [], loading: false }));
        } catch (err) {
            console.error('Error fetching wastes:', err);
            setWastesModal(prev => ({ ...prev, loading: false }));
        }
    };

    const handleOpenEditWaste = (waste, batch) => {
        const targetBatch = batch || stagesModal.batch || wastesModal.batch;
        setWastesModal({
            isOpen: true,
            batch: targetBatch,
            wastes: wastesModal.batch?.id === targetBatch?.id ? wastesModal.wastes : [],
            editingWasteId: waste.id,
            stage: waste.stage || 'quebraje',
            waste_type: waste.waste_type || 'cascaron',
            weight_lbs: String(waste.weight_lbs || waste.quantity_lbs || ''),
            notes: waste.notes || waste.reason || '',
            loading: false,
            isSubmitting: false
        });
        if (targetBatch?.id) {
            axios.get(`/api/egg-industrial/batches/${targetBatch.id}/wastes`)
                .then(res => {
                    setWastesModal(prev => ({ ...prev, wastes: res.data || [] }));
                })
                .catch(() => {});
        }
    };

    const handleCreateWaste = async (e) => {
        e.preventDefault();
        if (!wastesModal.weight_lbs || parseFloat(wastesModal.weight_lbs) <= 0) {
            return toast.error('Ingrese un peso válido para la merma.');
        }
        setWastesModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            if (wastesModal.editingWasteId) {
                await axios.put(`/api/egg-industrial/batches/${wastesModal.batch.id}/wastes/${wastesModal.editingWasteId}`, {
                    stage: wastesModal.stage,
                    waste_type: wastesModal.waste_type,
                    weight_lbs: parseFloat(wastesModal.weight_lbs),
                    quantity_lbs: parseFloat(wastesModal.weight_lbs),
                    notes: wastesModal.notes,
                    reason: wastesModal.notes
                });
                toast.success('Merma actualizada con éxito.');
            } else {
                await axios.post(`/api/egg-industrial/batches/${wastesModal.batch.id}/wastes`, {
                    stage: wastesModal.stage,
                    waste_type: wastesModal.waste_type,
                    weight_lbs: parseFloat(wastesModal.weight_lbs),
                    quantity_lbs: parseFloat(wastesModal.weight_lbs),
                    notes: wastesModal.notes,
                    reason: wastesModal.notes,
                    operator_name: user?.nombre || ''
                });
                toast.success('Merma registrada con éxito.');
            }
            const res = await axios.get(`/api/egg-industrial/batches/${wastesModal.batch.id}/wastes`);
            setWastesModal(prev => ({
                ...prev,
                editingWasteId: null,
                wastes: res.data || [],
                weight_lbs: '',
                notes: '',
                isSubmitting: false
            }));
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === wastesModal.batch?.id) {
                handleOpenStagesModal(wastesModal.batch);
            }
        } catch (err) {
            console.error('Error al guardar merma:', err);
            toast.error(err.response?.data?.message || 'Error al guardar merma.');
            setWastesModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const handleDeleteWaste = async (wasteId, batchIdOverride) => {
        const targetBatchId = batchIdOverride || wastesModal.batch?.id || stagesModal.batch?.id;
        if (!targetBatchId) return;
        if (!window.confirm('¿Confirmas que deseas eliminar este registro de merma?')) return;
        try {
            await axios.delete(`/api/egg-industrial/batches/${targetBatchId}/wastes/${wasteId}`);
            toast.success('Merma eliminada.');
            if (wastesModal.isOpen && wastesModal.batch?.id) {
                const res = await axios.get(`/api/egg-industrial/batches/${wastesModal.batch.id}/wastes`);
                setWastesModal(prev => ({ ...prev, wastes: res.data || [] }));
            }
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === targetBatchId) {
                handleOpenStagesModal(stagesModal.batch);
            }
        } catch (err) {
            console.error('Error al eliminar merma:', err);
            toast.error('Error al eliminar merma.');
        }
    };

    const handleOpenEditRemanente = (rem, batch) => {
        const targetBatch = batch || stagesModal.batch;
        setRemanenteModal({
            isOpen: true,
            id: rem.id,
            batch: targetBatch,
            product_type: rem.product_type || targetBatch?.product_type || 'huevo entero',
            presentation: rem.presentation || targetBatch?.presentation || 'cubeta 30LB',
            weight_lbs: String(rem.quantity_lbs || rem.weight_lbs || ''),
            is_pasteurized: rem.is_pasteurized !== undefined ? !!rem.is_pasteurized : (targetBatch?.status === 'pasteurizado'),
            destination: rem.destination || rem.storage_location || 'proximo_empaque',
            notes: rem.notes || '',
            isSubmitting: false
        });
    };

    const handleDeleteRemanente = async (remId, batchIdOverride) => {
        const batchId = batchIdOverride || stagesModal.batch?.id;
        if (!batchId) return;
        if (!window.confirm('¿Confirmas que deseas eliminar este registro de remanente?')) return;
        try {
            await axios.delete(`/api/egg-industrial/batches/${batchId}/remanentes/${remId}`);
            toast.success('Remanente eliminado exitosamente.');
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === batchId) {
                handleOpenStagesModal(stagesModal.batch);
            }
        } catch (err) {
            console.error('Error eliminando remanente:', err);
            toast.error(err.response?.data?.message || 'Error al eliminar remanente.');
        }
    };

    // Abrir pantalla completa de inicio de producción precargada para edición
    const handleOpenEditBatch = (batch) => {
        setEditingBatch(batch);
        let formula = {};
        try {
            formula = typeof batch.ingredients_json === 'string'
                ? JSON.parse(batch.ingredients_json)
                : (batch.ingredients_json || {});
        } catch (e) { formula = {}; }

        const mappedRms = (batch.raw_materials || []).map(rm => ({
            raw_material_id: String(rm.raw_material_id || rm.id),
            quantity_lbs: String(rm.quantity_lbs || ''),
            boxes_count: String(rm.boxes_count || ''),
            tarimas: Array.isArray(rm.tarimas) ? rm.tarimas : []
        }));

        let runNum = batch.run_number || 1;
        if (batch.batch_code_display) {
            const cleanCode = batch.batch_code_display.toUpperCase().replace(/^LOTE\s*/i, '').trim();
            const match = cleanCode.match(/^(\d+)/);
            if (match) runNum = parseInt(match[1], 10);
        }

        const presStr = batch.presentation || 'cubeta 30LB';
        const presList = presStr.split(',').map(s => s.trim()).filter(Boolean);

        const assignedRemIds = (batch.remanentes_used || []).map(r => r.id);

        setBatchForm({
            product_type: batch.product_type || 'huevo entero',
            presentation: presStr,
            presentations: presList.length > 0 ? presList : ['cubeta 30LB'],
            run_number: runNum,
            batch_code_display: batch.batch_code_display || '',
            pasteurization_lot: batch.pasteurization_lot || '',
            scheduled_production_id: batch.scheduled_production_id || null,
            raw_materials: mappedRms.length > 0 ? mappedRms : [{ raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }],
            remanente_ids: assignedRemIds,
            ingredients: {
                boxes_count: formula.boxes_count || formula.raw_egg_boxes || '',
                water_bottles: formula.water_bottles || '',
                sugar_lbs: formula.sugar_lbs || '',
                salt_lbs: formula.salt_lbs || '',
                citric_acid_lbs: formula.citric_acid_lbs || '',
                milk_powder_lbs: formula.milk_powder_lbs || '',
                ppg_g: formula.ppg_g || ''
            },
            operator_name: batch.operator_name || user?.nombre || '',
            bypass_cip_check: true,
            notes: batch.notes || ''
        });

        // Cargar remanentes disponibles incluyendo los asignados a este lote
        axios.get('/api/egg-industrial/remanentes/available', { params: { include_batch_id: batch.id } })
            .then(res => {
                if (res.data) setAvailableRemanentes(res.data);
            })
            .catch(() => { });

        setCipBlockedError(null);
        setIsNewBatchModalOpen(true);
    };

    const handleMarkRemanenteUsed = async (e, rem) => {
        e.stopPropagation();
        if (!window.confirm(`¿Confirmas que este remanente de ${parseFloat(rem.quantity_lbs || rem.weight_lbs || 0).toFixed(1)} Lbs ya fue utilizado en una producción anterior?`)) return;
        try {
            await axios.put(`/api/egg-industrial/remanentes/${rem.id}`, {
                status: 'asignado_a_lote',
                notes: (rem.notes ? rem.notes + ' | ' : '') + 'Marcado manualmente como utilizado en producción anterior'
            });
            toast.success('Remanente marcado como utilizado con éxito.');
            setBatchForm(prev => ({
                ...prev,
                remanente_ids: (prev.remanente_ids || []).filter(id => id !== rem.id)
            }));
            const res = await axios.get('/api/egg-industrial/remanentes/available', {
                params: showAllRemanentes ? { all: 'true' } : (editingBatch ? { include_batch_id: editingBatch.id } : {})
            });
            setAvailableRemanentes(res.data || []);
        } catch (err) {
            toast.error('Error al actualizar el estado del remanente.');
        }
    };

    const handleReactivateRemanente = async (e, rem) => {
        e.stopPropagation();
        try {
            await axios.put(`/api/egg-industrial/remanentes/${rem.id}`, {
                status: 'disponible',
                target_batch_id: null
            });
            toast.success('Remanente reactivado como disponible con éxito.');
            const res = await axios.get('/api/egg-industrial/remanentes/available', {
                params: showAllRemanentes ? { all: 'true' } : (editingBatch ? { include_batch_id: editingBatch.id } : {})
            });
            setAvailableRemanentes(res.data || []);
        } catch (err) {
            toast.error('Error al reactivar el remanente.');
        }
    };

    // Funciones para gestionar tarimas en modal Agregar Más Tarimas
    const handleAddSpecificTarimaToAddModal = (rmIdx, tarimaObj) => {
        const updated = [...addTarimasModal.raw_materials];
        const rm = updated[rmIdx];
        if (!rm) return;
        const tarimas = rm.tarimas || [];

        if (tarimas.some(t => parseInt(t.tarima_number) === parseInt(tarimaObj.tarima_number))) {
            toast.warning(`La Tarima #${tarimaObj.tarima_number} ya está agregada a este lote.`);
            return;
        }

        const availBoxes = parseInt(tarimaObj.available_boxes ?? tarimaObj.boxes_count) || 0;
        const availLbs = parseFloat(tarimaObj.available_lbs ?? tarimaObj.net_weight_lbs ?? tarimaObj.gross_weight_lbs) || 0;

        const newTarimaItem = {
            tarima_number: tarimaObj.tarima_number,
            boxes_count: availBoxes,
            available_boxes: availBoxes,
            quantity_lbs: availLbs.toFixed(2),
            available_lbs: availLbs,
            barcode: tarimaObj.barcode || '',
            storage_location: tarimaObj.storage_location || rm.storage_location || 'abajo',
            is_partial: false
        };

        const newTarimas = [...tarimas, newTarimaItem];
        const sumLbs = newTarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = newTarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = newTarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
        toast.success(`Tarima #${tarimaObj.tarima_number} agregada (${availBoxes} cjs • ${availLbs.toFixed(1)} Lbs).`);
    };

    const handleLoadAllAvailableTarimasToAddModal = (rmIdx, availableTarimas) => {
        if (!availableTarimas || availableTarimas.length === 0) return;
        const updated = [...addTarimasModal.raw_materials];
        const rm = updated[rmIdx];
        if (!rm) return;
        const existingTarimas = rm.tarimas || [];

        const nonDepleted = availableTarimas.filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01));
        if (nonDepleted.length === 0) {
            toast.warning('No hay tarimas con saldo disponible en este lote.');
            return;
        }

        const toAdd = nonDepleted.filter(t => !existingTarimas.some(et => parseInt(et.tarima_number) === parseInt(t.tarima_number)));
        if (toAdd.length === 0) {
            toast.info('Todas las tarimas disponibles ya están en la lista.');
            return;
        }

        const mapped = toAdd.map(t => {
            const availBoxes = parseInt(t.available_boxes ?? t.boxes_count) || 0;
            const availLbs = parseFloat(t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs) || 0;
            return {
                tarima_number: t.tarima_number,
                boxes_count: availBoxes,
                available_boxes: availBoxes,
                quantity_lbs: availLbs.toFixed(2),
                available_lbs: availLbs,
                barcode: t.barcode || '',
                storage_location: t.storage_location || rm.storage_location || 'abajo',
                is_partial: false
            };
        });

        const combined = [...existingTarimas, ...mapped];
        const sumLbs = combined.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = combined.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = combined;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
        toast.success(`${mapped.length} tarimas cargadas con éxito.`);
    };

    const handleUpdateTarimaBoxesInAddModal = (rmIdx, tIdx, newBoxesVal) => {
        const updated = [...addTarimasModal.raw_materials];
        const rm = updated[rmIdx];
        if (!rm) return;
        const tarimas = [...(rm.tarimas || [])];
        const currentItem = tarimas[tIdx];
        if (!currentItem) return;

        const maxAvail = currentItem.available_boxes || 99999;
        let enteredBoxes = parseInt(newBoxesVal) || 0;
        if (enteredBoxes < 0) enteredBoxes = 0;
        if (enteredBoxes > maxAvail) {
            toast.warning(`La cantidad máxima disponible en la Tarima #${currentItem.tarima_number} es de ${maxAvail} cajas.`);
            enteredBoxes = maxAvail;
        }

        const availLbs = currentItem.available_lbs || (parseFloat(currentItem.quantity_lbs) || 0);
        const propLbs = maxAvail > 0 ? ((enteredBoxes / maxAvail) * availLbs).toFixed(2) : '0.00';

        tarimas[tIdx] = {
            ...currentItem,
            boxes_count: enteredBoxes,
            quantity_lbs: propLbs,
            is_partial: enteredBoxes < maxAvail
        };

        const sumLbs = tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = tarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = tarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
    };

    const handleUpdateTarimaLbsInAddModal = (rmIdx, tIdx, newLbsVal) => {
        const updated = [...addTarimasModal.raw_materials];
        const rm = updated[rmIdx];
        if (!rm) return;
        const tarimas = [...(rm.tarimas || [])];
        const currentItem = tarimas[tIdx];
        if (!currentItem) return;

        const maxAvail = currentItem.available_lbs || 999999;
        let enteredLbs = parseFloat(newLbsVal) || 0;
        if (enteredLbs < 0) enteredLbs = 0;
        if (enteredLbs > maxAvail) {
            toast.warning(`El peso máximo disponible en la Tarima #${currentItem.tarima_number} es de ${maxAvail.toFixed(2)} Lbs.`);
            enteredLbs = maxAvail;
        }

        tarimas[tIdx] = {
            ...currentItem,
            quantity_lbs: enteredLbs.toFixed(2)
        };

        const sumLbs = tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        rm.tarimas = tarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);

        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
    };

    const handleRemoveTarimaFromAddModal = (rmIdx, tIdx) => {
        const updated = [...addTarimasModal.raw_materials];
        const rm = updated[rmIdx];
        if (!rm) return;
        const tarimas = (rm.tarimas || []).filter((_, i) => i !== tIdx);

        const sumLbs = tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = tarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = tarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated }));
    };

    // Digitación manual de código de tarima o número de tarima
    const handleManualTarimaDigitize = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const input = (addTarimasModal.manualTarimaInput || '').trim();
        if (!input) return toast.info('Ingrese un código de barras o número de tarima.');

        const matchTar = input.match(/^TAR-(.+)-(\d+)$/i);
        let targetLot = null;
        let tarimaNum = null;

        if (matchTar) {
            const lotStr = matchTar[1].toUpperCase();
            tarimaNum = parseInt(matchTar[2], 10);
            targetLot = rawMaterials.find(m => (m.provider_lot || '').toUpperCase().includes(lotStr) || String(m.id) === lotStr);
        } else if (/^\d+$/.test(input)) {
            tarimaNum = parseInt(input, 10);
            const firstSelectedId = addTarimasModal.raw_materials[0]?.raw_material_id;
            if (firstSelectedId) {
                targetLot = rawMaterials.find(m => String(m.id) === String(firstSelectedId));
            }
            if (!targetLot) {
                targetLot = rawMaterials.find(m => !m.is_depleted && parseFloat(m.stock_lbs || 0) > 0);
            }
        } else {
            targetLot = rawMaterials.find(m => (m.provider_lot || '').toUpperCase().includes(input.toUpperCase()));
        }

        if (!targetLot) {
            return toast.error(`No se encontró lote o tarima para "${input}".`);
        }

        let availableTarimas = targetLot.tarimas_available || [];
        if (availableTarimas.length === 0 && targetLot.tarimas_json) {
            try {
                availableTarimas = typeof targetLot.tarimas_json === 'string' ? JSON.parse(targetLot.tarimas_json) : targetLot.tarimas_json;
            } catch (err) { }
        }

        const updated = [...addTarimasModal.raw_materials];
        let rmIdx = updated.findIndex(r => String(r.raw_material_id) === String(targetLot.id));
        if (rmIdx === -1) {
            updated.push({
                raw_material_id: String(targetLot.id),
                quantity_lbs: '',
                boxes_count: '',
                tarimas: []
            });
            rmIdx = updated.length - 1;
        }

        const nonDepleted = (availableTarimas || []).filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01));
        let foundTarima = null;
        if (tarimaNum) {
            foundTarima = nonDepleted.find(t => parseInt(t.tarima_number) === tarimaNum);
        }
        if (!foundTarima && nonDepleted.length > 0) {
            foundTarima = nonDepleted[0];
        }

        if (!foundTarima) {
            return toast.error(`Tarima no encontrada o agotada en el lote ${targetLot.provider_lot}.`);
        }

        setAddTarimasModal(prev => ({ ...prev, raw_materials: updated, manualTarimaInput: '' }));
        handleAddSpecificTarimaToAddModal(rmIdx, foundTarima);
    };

    const handleAddTarimasSubmit = async (e) => {
        e.preventDefault();
        const validRms = (addTarimasModal.raw_materials || []).filter(rm => rm.raw_material_id && parseFloat(rm.quantity_lbs || 0) > 0);

        if (validRms.length === 0) {
            return toast.error('Debe seleccionar al menos una tarima o lote con peso válido.');
        }

        setAddTarimasModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            const res = await axios.post(`/api/egg-industrial/batches/${addTarimasModal.batch.id}/tarimas`, {
                raw_materials: validRms,
                notes: addTarimasModal.notes
            });
            toast.success(res.data?.message || 'Tarimas agregadas al quebraje exitosamente.');
            setAddTarimasModal(prev => ({ ...prev, isOpen: false, isSubmitting: false }));
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === addTarimasModal.batch.id) {
                handleOpenStagesModal(addTarimasModal.batch);
            }
        } catch (err) {
            console.error('Error agregando tarimas:', err);
            toast.error(err.response?.data?.message || 'Error al agregar tarimas al lote.');
            setAddTarimasModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };


    const handleRemanenteSubmit = async (e) => {
        e.preventDefault();
        if (!remanenteModal.weight_lbs || parseFloat(remanenteModal.weight_lbs) <= 0) {
            return toast.error('Ingrese el peso en libras del remanente.');
        }
        setRemanenteModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            if (remanenteModal.id) {
                const res = await axios.put(`/api/egg-industrial/batches/${remanenteModal.batch.id}/remanentes/${remanenteModal.id}`, {
                    product_type: remanenteModal.product_type,
                    presentation: remanenteModal.presentation,
                    weight_lbs: parseFloat(remanenteModal.weight_lbs),
                    quantity_lbs: parseFloat(remanenteModal.weight_lbs),
                    is_pasteurized: remanenteModal.is_pasteurized,
                    destination: remanenteModal.destination,
                    notes: remanenteModal.notes
                });
                toast.success(res.data?.message || 'Remanente actualizado exitosamente.');
            } else {
                const res = await axios.post(`/api/egg-industrial/batches/${remanenteModal.batch.id}/remanentes`, {
                    product_type: remanenteModal.product_type,
                    presentation: remanenteModal.presentation,
                    weight_lbs: parseFloat(remanenteModal.weight_lbs),
                    quantity_lbs: parseFloat(remanenteModal.weight_lbs),
                    is_pasteurized: remanenteModal.is_pasteurized,
                    destination: remanenteModal.destination,
                    notes: remanenteModal.notes,
                    created_by: user?.nombre || ''
                });
                toast.success(res.data?.message || 'Remanente / sobrante registrado exitosamente.');
            }
            setRemanenteModal(prev => ({ ...prev, isOpen: false, isSubmitting: false, id: null }));
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === remanenteModal.batch?.id) {
                handleOpenStagesModal(remanenteModal.batch);
            }
        } catch (err) {
            console.error('Error guardando remanente:', err);
            toast.error(err.response?.data?.message || 'Error al guardar remanente.');
            setRemanenteModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const _handleEditBatchSubmit = async (e) => {
        e.preventDefault();
        setEditBatchModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            const res = await axios.put(`/api/egg-industrial/batches/${editBatchModal.batch.id}`, {
                product_type: editBatchModal.product_type,
                presentation: editBatchModal.presentation,
                notes: editBatchModal.notes
            });
            toast.success(res.data?.message || 'Lote de producción actualizado.');
            setEditBatchModal(prev => ({ ...prev, isOpen: false, isSubmitting: false }));
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al actualizar lote.');
            setEditBatchModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const handleDeleteBatchConfirm = async () => {
        if (!deleteConfirmBatch) return;
        try {
            const res = await axios.delete(`/api/egg-industrial/batches/${deleteConfirmBatch.id}`);
            toast.success(res.data?.message || 'Lote de producción eliminado y materia prima revertida.');
            setDeleteConfirmBatch(null);
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al eliminar lote.');
        }
    };

    const handleExportSummary = async (batchId, format) => {
        try {
            toast.info(`Generando resumen en ${format.toUpperCase()}...`);
            const res = await axios.get(`/api/egg-industrial/batches/${batchId}/export-summary?format=${format}`, {
                responseType: 'blob'
            });
            const ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'docx';
            const mime = format === 'pdf'
                ? 'application/pdf'
                : format === 'excel'
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            const blob = new Blob([res.data], { type: mime });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Resumen_Produccion_Lote_${batchId}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`Resumen descargado exitosamente.`);
        } catch (err) {
            console.error('Error al exportar:', err);
            toast.error('Error al generar la exportación.');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, rmRes, cRes, cfgRes, remRes] = await Promise.all([
                axios.get('/api/egg-industrial/batches').catch(err => {
                    console.error('Error fetching batches:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/raw-materials', { params: { only_with_stock: 'true' } }).catch(err => {
                    console.error('Error fetching raw materials:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/cip').catch(err => {
                    console.error('Error fetching cip:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/product-config').catch(err => {
                    console.error('Error fetching product-config:', err);
                    return { data: {} };
                }),
                axios.get('/api/egg-industrial/remanentes/available').catch(err => {
                    console.error('Error fetching remanentes:', err);
                    return { data: [] };
                })
            ]);
            const batchesList = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.data || []);
            setBatches(batchesList);

            const rawMaterialsList = Array.isArray(rmRes.data) ? rmRes.data : (rmRes.data?.data || []);
            setRawMaterials(rawMaterialsList.filter(rm => rm && rm.status === 'aprobado'));

            const cipList = Array.isArray(cRes.data) ? cRes.data : (cRes.data?.data || []);
            setCipLogs(cipList);

            setProductConfig(cfgRes.data?.data || cfgRes.data || {});

            const remList = Array.isArray(remRes.data) ? remRes.data : (remRes.data?.data || []);
            setAvailableRemanentes(remList);
        } catch (error) {
            console.error('Error fetching production data:', error);
            toast.error('Error al cargar datos del módulo de producción.');
        } finally {
            setLoading(false);
        }
    };

    const fetchScheduledProductions = async () => {
        try {
            const res = await axios.get('/api/egg-industrial/calendar', {
                params: { status: 'programado' }
            });
            setScheduledProductions(Array.isArray(res.data) ? res.data : (res.data?.data || []));
        } catch (err) {
            console.error('Error al cargar producciones programadas:', err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchScheduledProductions();
    }, [companyId]);

    // Handle calendar navigation
    useEffect(() => {
        if (location.state?.openNewBatchModal || location.state?.scheduledProduction) {
            setIsNewBatchModalOpen(true);
            if (location.state?.scheduledProduction) {
                handleSelectScheduledProduction(location.state.scheduledProduction);
            }
        }
    }, [location.state]);

    const handleSelectScheduledProduction = (sched) => {
        if (!sched) {
            setSelectedScheduledProd(null);
            setBatchForm(prev => ({
                ...prev,
                scheduled_production_id: null
            }));
            return;
        }

        setSelectedScheduledProd(sched);

        const p = (sched.product_profile || '').toLowerCase();
        let pType = 'huevo entero';
        if (p.includes('clara')) pType = 'clara';
        else if (p.includes('azucar') || p.includes('azúcar')) pType = 'yema azucarada';
        else if (p.includes('sal')) pType = 'yema salada';
        else if (p.includes('plus') || p.includes('formulado') || p.includes('separaci')) pType = 'fórmula especial';

        const pres = (sched.presentation || '').toLowerCase();
        let presType = 'cubeta 32LB';
        if (pres.includes('30')) presType = 'cubeta 30LB';
        else if (pres.includes('32')) presType = 'cubeta 32LB';
        else if (pres.includes('medio')) presType = 'medio galón 4LB';
        else if (pres.includes('gal')) presType = 'galón 8LB';
        else if (pres.includes('litro')) presType = 'litro 2LB';

        let runNum = 1;
        const match = (sched.lot_code || '').match(/^(\d+)/);
        if (match) runNum = parseInt(match[1], 10);

        let formula = {};
        try {
            formula = typeof sched.mix_formula_json === 'string'
                ? JSON.parse(sched.mix_formula_json)
                : (sched.mix_formula_json || {});
        } catch (e) { formula = {}; }

        setBatchForm(prev => ({
            ...prev,
            scheduled_production_id: sched.id,
            product_type: pType,
            presentation: presType,
            run_number: runNum,
            ingredients: {
                boxes_count: formula.raw_egg_boxes || prev.ingredients.boxes_count || '',
                water_bottles: formula.water_bottles || (formula.water_h2o_lbs ? Math.round(formula.water_h2o_lbs / 41.8) : '') || prev.ingredients.water_bottles || '',
                sugar_lbs: formula.sugar_lbs || prev.ingredients.sugar_lbs || '',
                salt_lbs: formula.salt_lbs || prev.ingredients.salt_lbs || '',
                citric_acid_lbs: formula.citric_acid_lbs || prev.ingredients.citric_acid_lbs || '',
                milk_powder_lbs: formula.milk_powder_lbs || prev.ingredients.milk_powder_lbs || '',
                ppg_g: formula.ppg_g || prev.ingredients.ppg_g || ''
            }
        }));

        toast.success(`Producción programada cargada: ${sched.lot_code} (${sched.product_profile})`);
    };

    // Funciones de gestión de tarimas vinculadas a recepción y escáner
    const handleAddSpecificTarimaToRm = (rmIdx, tarimaObj) => {
        const updated = [...batchForm.raw_materials];
        const rm = updated[rmIdx];
        const tarimas = rm.tarimas || [];

        if (tarimas.some(t => parseInt(t.tarima_number) === parseInt(tarimaObj.tarima_number))) {
            toast.warning(`La Tarima #${tarimaObj.tarima_number} ya está agregada a este lote.`);
            return;
        }

        const availBoxes = parseInt(tarimaObj.available_boxes ?? tarimaObj.boxes_count) || 0;
        const availLbs = parseFloat(tarimaObj.available_lbs ?? tarimaObj.net_weight_lbs ?? tarimaObj.gross_weight_lbs) || 0;

        const newTarimaItem = {
            tarima_number: tarimaObj.tarima_number,
            boxes_count: availBoxes,
            available_boxes: availBoxes,
            quantity_lbs: availLbs.toFixed(2),
            available_lbs: availLbs,
            barcode: tarimaObj.barcode || '',
            storage_location: tarimaObj.storage_location || rm.storage_location || 'abajo',
            is_partial: false
        };

        const newTarimas = [...tarimas, newTarimaItem];
        const sumLbs = newTarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = newTarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = newTarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setBatchForm({ ...batchForm, raw_materials: updated });
        toast.success(`Tarima #${tarimaObj.tarima_number} agregada (${availBoxes} cjs • ${availLbs.toFixed(1)} Lbs).`);
    };

    const handleLoadAllAvailableTarimas = (rmIdx, availableTarimas) => {
        if (!availableTarimas || availableTarimas.length === 0) return;
        const updated = [...batchForm.raw_materials];
        const rm = updated[rmIdx];
        const existingTarimas = rm.tarimas || [];

        const nonDepleted = availableTarimas.filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01));
        if (nonDepleted.length === 0) {
            toast.warning('No hay tarimas con saldo disponible en este lote.');
            return;
        }

        const toAdd = nonDepleted.filter(t => !existingTarimas.some(et => parseInt(et.tarima_number) === parseInt(t.tarima_number)));
        if (toAdd.length === 0) {
            toast.info('Todas las tarimas disponibles ya están en la lista.');
            return;
        }

        const mapped = toAdd.map(t => {
            const availBoxes = parseInt(t.available_boxes ?? t.boxes_count) || 0;
            const availLbs = parseFloat(t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs) || 0;
            return {
                tarima_number: t.tarima_number,
                boxes_count: availBoxes,
                available_boxes: availBoxes,
                quantity_lbs: availLbs.toFixed(2),
                available_lbs: availLbs,
                barcode: t.barcode || '',
                storage_location: t.storage_location || rm.storage_location || 'abajo',
                is_partial: false
            };
        });

        const combined = [...existingTarimas, ...mapped];
        const sumLbs = combined.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = combined.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = combined;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setBatchForm({ ...batchForm, raw_materials: updated });
        toast.success(`${mapped.length} tarimas cargadas con éxito.`);
    };

    const handleUpdateTarimaBoxesInRm = (rmIdx, tIdx, newBoxesVal) => {
        const updated = [...batchForm.raw_materials];
        const rm = updated[rmIdx];
        const tarimas = [...(rm.tarimas || [])];
        const currentItem = tarimas[tIdx];
        if (!currentItem) return;

        const maxAvail = currentItem.available_boxes || 99999;
        let enteredBoxes = parseInt(newBoxesVal) || 0;
        if (enteredBoxes < 0) enteredBoxes = 0;
        if (enteredBoxes > maxAvail) {
            toast.warning(`La cantidad máxima disponible en la Tarima #${currentItem.tarima_number} es de ${maxAvail} cajas.`);
            enteredBoxes = maxAvail;
        }

        // Recálculo proporcional del peso en libras
        const availLbs = currentItem.available_lbs || (parseFloat(currentItem.quantity_lbs) || 0);
        const propLbs = maxAvail > 0 ? ((enteredBoxes / maxAvail) * availLbs).toFixed(2) : '0.00';

        tarimas[tIdx] = {
            ...currentItem,
            boxes_count: enteredBoxes,
            quantity_lbs: propLbs,
            is_partial: enteredBoxes < maxAvail
        };

        const sumLbs = tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = tarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = tarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setBatchForm({ ...batchForm, raw_materials: updated });
    };

    const handleUpdateTarimaLbsInRm = (rmIdx, tIdx, newLbsVal) => {
        const updated = [...batchForm.raw_materials];
        const rm = updated[rmIdx];
        const tarimas = [...(rm.tarimas || [])];
        const currentItem = tarimas[tIdx];
        if (!currentItem) return;

        const maxAvail = currentItem.available_lbs || 999999;
        let enteredLbs = parseFloat(newLbsVal) || 0;
        if (enteredLbs < 0) enteredLbs = 0;
        if (enteredLbs > maxAvail) {
            toast.warning(`El peso máximo disponible en la Tarima #${currentItem.tarima_number} es de ${maxAvail.toFixed(2)} Lbs.`);
            enteredLbs = maxAvail;
        }

        tarimas[tIdx] = {
            ...currentItem,
            quantity_lbs: enteredLbs.toFixed(2)
        };

        const sumLbs = tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        rm.tarimas = tarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);

        setBatchForm({ ...batchForm, raw_materials: updated });
    };

    const handleRemoveTarimaFromRm = (rmIdx, tIdx) => {
        const updated = [...batchForm.raw_materials];
        const rm = updated[rmIdx];
        const tarimas = (rm.tarimas || []).filter((_, i) => i !== tIdx);

        const sumLbs = tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0);
        const sumBoxes = tarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0);

        rm.tarimas = tarimas;
        rm.quantity_lbs = sumLbs.toFixed(2);
        rm.boxes_count = sumBoxes;

        setBatchForm({ ...batchForm, raw_materials: updated });
    };

    // Resultado del escaneo de QR / Código de barras de tarima
    const handleScanTarimaResult = (scannedData) => {
        if (!scannedData) return;
        const { lotCode, tarimaNumber, _palletId, rawText, loadAll } = scannedData;

        // 1. Buscar lote en rawMaterials
        const lot = rawMaterials.find(m =>
            (m.provider_lot || '').trim().toUpperCase() === (lotCode || '').trim().toUpperCase() ||
            String(m.id) === String(lotCode)
        );

        if (!lot) {
            toast.error(`Lote "${lotCode || rawText}" no encontrado en las recepciones de materia prima.`);
            return;
        }

        if (lot.is_depleted || parseFloat(lot.stock_lbs || 0) <= 0.01) {
            toast.error(`El lote ${lot.provider_lot} ya está 100% agotado y no tiene saldo disponible.`);
            return;
        }

        // 2. Buscar tarimas en el lote
        let availableTarimas = lot.tarimas_available || [];
        if (availableTarimas.length === 0 && lot.tarimas_json) {
            try {
                availableTarimas = typeof lot.tarimas_json === 'string' ? JSON.parse(lot.tarimas_json) : lot.tarimas_json;
            } catch (e) { }
        }

        const isAddContext = scannerContext === 'add_tarimas';

        // 3. Ubicar o crear la fila del lote en el formulario correspondiente
        let updatedRms = isAddContext ? [...addTarimasModal.raw_materials] : [...batchForm.raw_materials];
        let rmIdx = updatedRms.findIndex(r => String(r.raw_material_id) === String(lot.id));

        if (rmIdx === -1) {
            const newRm = {
                raw_material_id: String(lot.id),
                quantity_lbs: '',
                boxes_count: '',
                tarimas: []
            };
            updatedRms.push(newRm);
            rmIdx = updatedRms.length - 1;
        }

        // Si se solicitó cargar todas las tarimas con saldo
        if (loadAll) {
            if (isAddContext) {
                handleLoadAllAvailableTarimasToAddModal(rmIdx, availableTarimas);
            } else {
                handleLoadAllAvailableTarimas(rmIdx, availableTarimas);
            }
            setScannerModalOpen(false);
            return;
        }

        const nonDepleted = (availableTarimas || []).filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01));

        // Si no se especificó un número de tarima y hay más de 1 tarima disponible, abrir selector
        if (!tarimaNumber && nonDepleted.length > 1) {
            setTarimaPickerModal({
                isOpen: true,
                lot,
                availableTarimas: nonDepleted
            });
            setScannerModalOpen(false);
            return;
        }

        let targetTarima = null;
        if (tarimaNumber) {
            targetTarima = availableTarimas.find(t => parseInt(t.tarima_number) === parseInt(tarimaNumber));
        }
        if (!targetTarima && nonDepleted.length > 0) {
            targetTarima = nonDepleted[0];
        }

        if (!targetTarima) {
            toast.error(`Tarima #${tarimaNumber || '1'} no disponible o no encontrada en el lote ${lot.provider_lot}.`);
            return;
        }

        if (targetTarima.is_depleted || (targetTarima.available_boxes <= 0 && targetTarima.available_lbs <= 0.01)) {
            toast.error(`La Tarima #${targetTarima.tarima_number} del lote ${lot.provider_lot} ya fue 100% consumida.`);
            return;
        }

        if (isAddContext) {
            handleAddSpecificTarimaToAddModal(rmIdx, targetTarima);
        } else {
            handleAddSpecificTarimaToRm(rmIdx, targetTarima);
        }
        setScannerModalOpen(false);
    };

    // Helper para determinar si un producto requiere separación de clara y yema
    const isSeparationProduct = (productType) => {
        const p = (productType || '').toLowerCase();
        return p.includes('clara') || p.includes('yema') || p.includes('separad');
    };

    // Lotes disponibles con stock aprobados (ordenados por FIFO desde el backend)
    const availableRawLots = (Array.isArray(rawMaterials) ? rawMaterials : []).filter(m => !m.is_depleted && parseFloat(m.stock_lbs || 0) > 0.01);
    const oldestFifoLot = availableRawLots[0] || null;
    const oldestAALot = availableRawLots.find(m => (m.egg_classification || '').toLowerCase().includes('aa')) || null;
    const isCurrentSeparation = isSeparationProduct(batchForm.product_type);

    const recommendedLot = isCurrentSeparation
        ? (oldestAALot || oldestFifoLot)
        : oldestFifoLot;

    const recommendationReason = isCurrentSeparation
        ? (oldestAALot
            ? '⭐ Grado AA recomendado para separación (membrana vitelina firme que previene roturas de yema en claras).'
            : '⚠️ No hay lotes Grado AA en bodega. Se sugiere el lote FIFO más antiguo con precaución de supervisión.')
        : '🔄 Rotación FIFO: Lote recepcionado más antiguo para garantizar rotación de inventario en bodega.';

    // Lote no AA seleccionado para producto de separación (alerta de calidad informativa)
    const nonAALotSelectedForSeparation = isCurrentSeparation && (batchForm.raw_materials || []).some(rm => {
        if (!rm.raw_material_id) return false;
        const lot = rawMaterials.find(m => String(m.id) === String(rm.raw_material_id));
        return lot && !(lot.egg_classification || '').toLowerCase().includes('aa');
    });

    const nonAALotObj = isCurrentSeparation
        ? rawMaterials.find(m => (batchForm.raw_materials || []).some(r => String(r.raw_material_id) === String(m.id) && !(m.egg_classification || '').toLowerCase().includes('aa')))
        : null;

    // Aplicar lote recomendado con 1 clic al formulario de producción
    const handleApplyRecommendedLot = (lot) => {
        if (!lot) return;
        let lotTarimas = lot.tarimas_available || [];
        if (lotTarimas.length === 0 && lot.tarimas_json) {
            try {
                lotTarimas = typeof lot.tarimas_json === 'string'
                    ? JSON.parse(lot.tarimas_json || '[]')
                    : (lot.tarimas_json || []);
            } catch (e) { lotTarimas = []; }
        }

        const validTarimas = lotTarimas.filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01));

        if (validTarimas.length > 0) {
            const mappedTarimas = validTarimas.map(t => ({
                tarima_number: t.tarima_number,
                barcode: t.barcode,
                boxes_count: t.available_boxes ?? t.boxes_count ?? 0,
                quantity_lbs: parseFloat(t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0).toFixed(2),
                available_boxes: t.available_boxes ?? t.boxes_count ?? 0,
                available_lbs: parseFloat(t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0),
                storage_location: t.storage_location || lot.storage_location || 'abajo',
                is_partial: false
            }));

            const totalLbs = mappedTarimas.reduce((sum, t) => sum + parseFloat(t.quantity_lbs || 0), 0);
            const totalBoxes = mappedTarimas.reduce((sum, t) => sum + (parseInt(t.boxes_count) || 0), 0);

            setBatchForm(prev => ({
                ...prev,
                raw_materials: [{
                    raw_material_id: String(lot.id),
                    quantity_lbs: totalLbs.toFixed(2),
                    boxes_count: String(totalBoxes),
                    tarimas: mappedTarimas
                }]
            }));
        } else {
            setBatchForm(prev => ({
                ...prev,
                raw_materials: [{
                    raw_material_id: String(lot.id),
                    quantity_lbs: String(lot.stock_lbs || ''),
                    boxes_count: String(lot.total_boxes || ''),
                    tarimas: []
                }]
            }));
        }

        toast.success(`Lote ${lot.provider_lot} aplicado (${lot.egg_classification || 'Grado A'}) según rotación.`);
    };

    // Handle new / edit production batch with optional bypass
    const handleCreateBatch = async (e, forceBypass = false) => {
        if (e && e.preventDefault) e.preventDefault();
        setCipBlockedError(null);

        if (!batchForm.raw_materials || batchForm.raw_materials.length === 0) {
            return toast.error('Debe agregar al menos una materia prima.');
        }

        const totalWeight = batchForm.raw_materials.reduce((sum, rm) => sum + parseFloat(rm.quantity_lbs || 0), 0);
        if (totalWeight <= 0) {
            return toast.error('El peso total debe ser mayor a cero.');
        }

        const resolvedPres = Array.isArray(batchForm.presentations) && batchForm.presentations.length > 0
            ? batchForm.presentations.join(', ')
            : (batchForm.presentation || 'cubeta 30LB');

        setIsSubmitting(true);
        try {
            if (editingBatch) {
                // Modo Edición: Actualizar lote existente
                const res = await axios.put(`/api/egg-industrial/batches/${editingBatch.id}`, {
                    product_type: batchForm.product_type,
                    presentation: resolvedPres,
                    operator_name: batchForm.operator_name,
                    notes: batchForm.notes,
                    raw_materials: batchForm.raw_materials,
                    remanente_ids: batchForm.remanente_ids || [],
                    ingredients: batchForm.ingredients,
                    batch_code_display: canManageLots ? batchForm.batch_code_display : undefined,
                    pasteurization_lot: canManageLots ? batchForm.pasteurization_lot : undefined
                });
                toast.success(res.data?.message || 'Lote de producción actualizado exitosamente.');
                setEditingBatch(null);
                setIsNewBatchModalOpen(false);
                fetchData();
                return;
            }

            const shouldBypass = forceBypass || Boolean(batchForm.bypass_cip_check);
            await axios.post('/api/egg-industrial/batches', {
                ...batchForm,
                presentation: resolvedPres,
                run_number: parseInt(batchForm.run_number) || 1,
                raw_materials: batchForm.raw_materials,
                remanente_ids: batchForm.remanente_ids || [],
                ingredients: batchForm.ingredients,
                bypass_cip_check: shouldBypass
            });
            toast.success(shouldBypass ? 'Lote de producción iniciado bajo excepción de sanitización.' : 'Lote de producción iniciado exitosamente.');
            setSelectedScheduledProd(null);
            fetchScheduledProductions();
            setBatchForm({
                product_type: 'huevo entero',
                presentation: 'cubeta 30LB',
                presentations: ['cubeta 30LB'],
                run_number: 1,
                scheduled_production_id: null,
                raw_materials: [],
                remanente_ids: [],
                ingredients: {
                    boxes_count: '',
                    water_bottles: '',
                    sugar_lbs: '',
                    salt_lbs: '',
                    citric_acid_lbs: '',
                    milk_powder_lbs: '',
                    ppg_g: ''
                },
                operator_name: user?.nombre || '',
                bypass_cip_check: false
            });
            fetchData();
            setIsNewBatchModalOpen(false);
        } catch (error) {
            console.error('Error in batch operation:', error);
            if (!editingBatch) {
                setCipBlockedError(error.response?.data?.message || 'Error al iniciar el lote.');
            }
            toast.error(error.response?.data?.message || 'Error al procesar lote de producción.');
        } finally {
            setIsSubmitting(false);
        }
    };


    // Auto-registrar CIP express aprobado con 1 clic
    const handleQuickSanitize = async () => {
        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/egg-industrial/cip/quick-sanitize', {
                equipment_name: 'pasteurizador',
                operator_name: user?.nombre || 'Supervisor Planta'
            });
            toast.success(res.data?.message || 'Sanitización CIP express aprobada correctamente.');
            setCipBlockedError(null);
            fetchData();
        } catch (error) {
            console.error('Error in quick sanitize:', error);
            toast.error(error.response?.data?.message || 'Error al registrar sanitización rápida.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle CIP log creation
    const handleCreateCip = async (e) => {
        e.preventDefault();
        if (!cipForm.chemical_used) return toast.error('Ingrese el químico utilizado.');
        if (!cipForm.temperature_c) return toast.error('Ingrese la temperatura.');
        if (!cipForm.duration_minutes) return toast.error('Ingrese la duración.');

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/cip', {
                ...cipForm,
                temperature_c: parseFloat(cipForm.temperature_c),
                duration_minutes: parseInt(cipForm.duration_minutes),
                batch_id: cipForm.batch_id ? parseInt(cipForm.batch_id, 10) : null,
                created_at: cipForm.created_at || null
            });
            toast.success('Registro de sanitización CIP guardado.');
            setCipForm({
                equipment_name: 'pasteurizador',
                chemical_used: 'Ácido Peracético 1.5%',
                temperature_c: '78.5',
                duration_minutes: '45',
                operator_name: user?.nombre || '',
                validation_status: 'completado',
                created_at: getNowDateTimeLocal(),
                batch_id: '',
                notes: ''
            });
            fetchData();
            setActiveTab('cip');
        } catch (error) {
            console.error('Error registering CIP:', error);
            toast.error('Error al guardar registro CIP.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle CIP log deletion
    const handleDeleteCip = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este registro de sanitización CIP?')) {
            return;
        }

        try {
            await axios.delete(`/api/egg-industrial/cip/${id}`);
            toast.success('Registro de sanitización CIP eliminado.');
            fetchData();
        } catch (error) {
            console.error('Error deleting CIP log:', error);
            toast.error(error.response?.data?.message || 'Error al eliminar el registro CIP.');
        }
    };

    // Handle pasteurization logging (HACCP Check)
    const handlePasteurize = async (e) => {
        e.preventDefault();
        setHaccpViolationAlert(null);

        if (!selectedBatchForPasteurize) {
            return toast.error('Debe seleccionar un lote activo.');
        }

        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/egg-industrial/pasteurize', {
                batch_id: parseInt(selectedBatchForPasteurize),
                temperature_c: parseFloat(pasteurizeForm.temperature_c),
                holding_time_seconds: parseInt(pasteurizeForm.holding_time_seconds),
                pressure_psi: parseFloat(pasteurizeForm.pressure_psi),
                flow_rate_gpm: parseFloat(pasteurizeForm.flow_rate_gpm),
                operator_name: pasteurizeForm.operator_name
            });

            const { haccp_compliant, deviation_description } = res.data;

            if (!haccp_compliant) {
                setHaccpViolationAlert(deviation_description);
                toast.error('ALERTA CRÍTICA: Lote bloqueado por desviación HACCP.', { duration: 10000 });
            } else {
                toast.success('Monitoreo HACCP validado. El lote pasó a estado pasteurizado.');
                setSelectedBatchForPasteurize('');
                setIsPasteurizeModalOpen(false);
            }
            fetchData();
        } catch (error) {
            console.error('Error validating pasteurization HACCP:', error);
            toast.error(error.response?.data?.message || 'Error al guardar control de pasteurización.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle complete / balance batch
    const handleCompleteBatch = async (e) => {
        e.preventDefault();
        if (!completeForm.yield_liquid_lbs || parseFloat(completeForm.yield_liquid_lbs) <= 0) {
            return toast.error('Debe ingresar el rendimiento líquido.');
        }

        setIsSubmitting(true);
        const batchToUpdate = selectedBatchForComplete;
        try {
            await axios.put(`/api/egg-industrial/batches/${batchToUpdate.id}/complete`, {
                yield_liquid_lbs: parseFloat(completeForm.yield_liquid_lbs),
                waste_shell_lbs: parseFloat(completeForm.waste_shell_lbs || 0),
                waste_loss_lbs: parseFloat(completeForm.waste_loss_lbs || 0)
            });
            toast.success('Balance de masas registrado y actualizado correctamente.');
            setSelectedBatchForComplete(null);
            setCompleteForm({ yield_liquid_lbs: '', waste_shell_lbs: '', waste_loss_lbs: '' });
            fetchData();
            if (stagesModal.isOpen && stagesModal.batch?.id === batchToUpdate.id) {
                handleOpenStagesModal(batchToUpdate);
            }
        } catch (error) {
            console.error('Error completing batch:', error);
            toast.error(error.response?.data?.message || 'Error al guardar balance de masas.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get badge class for batch statuses
    const getBatchStatusBadge = (status) => {
        switch (status) {
            case 'en_proceso':
                return 'bg-blue-50 text-blue-700 border border-blue-200';
            case 'pasteurizado':
                return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
            case 'empaquetado':
                return 'bg-purple-50 text-purple-700 border border-purple-200';
            case 'congelado':
                return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
            case 'bloqueado_haccp':
                return 'bg-rose-50 text-rose-700 border border-rose-300 font-bold';
            case 'aprobado_calidad':
                return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
            default:
                return 'bg-slate-100 text-slate-700 border border-slate-200';
        }
    };

    const filteredBatches = (Array.isArray(batches) ? batches : []).filter(b =>
        b.batch_code_display?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.batch_uuid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.product_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.presentation?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-600">
                        <Flame className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Sala de Producción y Pasteurización</h1>
                        <p className="text-xs text-slate-500 font-medium">Control de lotes, sanitización CIP, pasteurización térmica y balance de masas</p>
                    </div>
                </div>
            </div>

            {/* Custom Tab Selectors */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit">
                    <button
                        onClick={() => { setActiveTab('batches'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'batches' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Lotes de Producción
                    </button>
                    <button
                        onClick={() => { setActiveTab('cip'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cip' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Registros de Sanitización (CIP)
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => navigate('/industrial/calendario')}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 shadow-sm"
                    >
                        <Calendar size={14} />
                        Calendario de Producción
                    </button>
                    <button
                        onClick={() => {
                            setEditingBatch(null);
                            const dayInfo = getJulianDayInfo();
                            const todayBatches = (Array.isArray(batches) ? batches : []).filter(b => {
                                if (!b.batch_code_display) return false;
                                const parts = b.batch_code_display.toUpperCase().replace(/^LOTE\s*/i, '').split('-').map(s => s.trim());
                                return parts.length === 3 && parseInt(parts[1], 10) === dayInfo.dayOfYear;
                            });
                            const nextRun = todayBatches.length > 0
                                ? Math.max(...todayBatches.map(b => {
                                    const parts = (b.batch_code_display || '').toUpperCase().replace(/^LOTE\s*/i, '').split('-').map(s => s.trim());
                                    return parseInt(b.run_number, 10) || parseInt(parts[0], 10) || 1;
                                })) + 1
                                : 1;

                            setBatchForm({
                                product_type: 'huevo entero',
                                presentation: 'cubeta 30LB',
                                presentations: ['cubeta 30LB'],
                                run_number: nextRun,
                                batch_code_display: `LOTE ${String(nextRun).padStart(2, '0')}-${dayInfo.dayOfYearStr}-${dayInfo.year2Digit}`,
                                scheduled_production_id: null,
                                raw_materials: [],
                                remanente_ids: [],
                                ingredients: {
                                    boxes_count: '',
                                    water_bottles: '',
                                    sugar_lbs: '',
                                    salt_lbs: '',
                                    citric_acid_lbs: '',
                                    milk_powder_lbs: '',
                                    ppg_g: ''
                                },
                                operator_name: user?.nombre || '',
                                bypass_cip_check: false
                            });
                            setCipBlockedError(null);
                            setIsNewBatchModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Plus size={14} />
                        Iniciar Nueva Producción
                    </button>
                    <button
                        onClick={() => { setIsPasteurizeModalOpen(true); setHaccpViolationAlert(null); }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Flame size={14} />
                        Pasteurizar
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'batches' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-indigo-600" />
                            Historial de Procesamiento por Lotes
                        </h2>
                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder="Buscar por lote, producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                            />
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        </div>
                    </div>
                    <div className="h-px bg-slate-100" />

                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-medium animate-pulse">
                                Cargando lotes de producción...
                            </div>
                        ) : filteredBatches.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-medium">
                                No hay lotes de producción registrados.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="px-3 py-2.5">Lote Juliano / UUID</th>
                                        <th className="px-3 py-2.5">Producto</th>
                                        <th className="px-3 py-2.5">Presentación</th>
                                        <th className="px-3 py-2.5 text-right">Peso Entrada</th>
                                        <th className="px-3 py-2.5 text-right">Rendimiento</th>
                                        <th className="px-3 py-2.5 text-right">Disponible</th>
                                        <th className="px-3 py-2.5 text-center">Estado</th>
                                        <th className="px-3 py-2.5 min-w-[180px]">Inicio / Fin</th>
                                        <th className="px-3 py-2.5 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredBatches.map(b => (
                                        <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-col gap-0.5">
                                                    {b.batch_code_display ? (
                                                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg w-fit">
                                                            {b.batch_code_display}
                                                        </span>
                                                    ) : null}
                                                    {b.pasteurization_status === 'cerrado' ? (
                                                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1" title={`Pasteurización Cerrada: ${b.pasteurization_lot || ''}`}>
                                                            <Lock size={10} />
                                                            Past: {b.pasteurization_lot || 'Cerrado'}
                                                        </span>
                                                    ) : b.pasteurization_lot ? (
                                                        <span className="bg-amber-50 border border-amber-200 text-amber-700 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-md w-fit flex items-center gap-1">
                                                            Past: {b.pasteurization_lot}
                                                        </span>
                                                    ) : null}
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-mono text-[10px] text-slate-500 select-all truncate max-w-[180px]">{b.batch_uuid}</span>
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(b.batch_code_display || b.batch_uuid); toast.success('Lote copiado'); }}
                                                            className="p-0.5 hover:bg-slate-100 rounded text-slate-600 hover:text-indigo-600 transition-colors flex-shrink-0"
                                                            title="Copiar Lote"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-slate-900 text-xs capitalize flex items-center gap-1.5">
                                                    <span>{b.product_type}</span>
                                                    {b.scheduled_lot_code && (
                                                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded" title="Originado en Calendario de Producción">
                                                            Prog: {b.scheduled_lot_code}
                                                        </span>
                                                    )}
                                                </div>
                                                {b.raw_materials && b.raw_materials.length > 0 && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5 space-y-0.5">
                                                        {b.raw_materials.map((m, mi) => (
                                                            <div key={mi}>
                                                                <span>{m.egg_type} - {parseFloat(m.quantity_lbs).toFixed(0)} Lbs{m.boxes_count > 0 ? ` (${m.boxes_count} cjs)` : ''}</span>
                                                                {Array.isArray(m.tarimas) && m.tarimas.length > 0 && (
                                                                    <div className="text-[9px] text-indigo-600 font-medium pl-1">
                                                                        Tarimas: {m.tarimas.map(t => `#${t.tarima_number || 1} (${t.boxes_count || 0}cjs - ${parseFloat(t.quantity_lbs || 0).toFixed(0)}Lbs)`).join(', ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-slate-600 text-xs">{b.presentation}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-900 font-bold text-xs">{parseFloat(b.input_weight_lbs).toLocaleString()} Lbs</td>
                                            <td className="px-3 py-2.5 text-right text-teal-700 font-bold text-xs">
                                                {b.yield_liquid_lbs > 0 ? `${parseFloat(b.yield_liquid_lbs).toLocaleString()} Lbs` : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-xs">
                                                {b.yield_liquid_lbs > 0 ? (
                                                    <span className={Math.max(0, parseFloat(b.yield_liquid_lbs) - parseFloat(b.packaged_weight_lbs || 0)) > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                                        {Math.max(0, parseFloat(b.yield_liquid_lbs) - parseFloat(b.packaged_weight_lbs || 0)).toLocaleString()} Lbs
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getBatchStatusBadge(b.status)}`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-[10px] text-slate-600 space-y-0.5 min-w-[180px]">
                                                <div>
                                                    <span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Iniciado:</span>
                                                    {new Date(b.started_at).toLocaleString()}
                                                </div>
                                                {b.completed_at && (
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Finalizado:</span>
                                                        {new Date(b.completed_at).toLocaleString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                    {/* Visualizador de Etapas */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenStagesModal(b)}
                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                        title="Visualizador de Etapas Cumplidas del Proceso (Quebraje, Pasteurización, Remanentes, Envasado)"
                                                    >
                                                        <Layers size={13} />
                                                    </button>

                                                    {/* Mermas */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenWastesModal(b)}
                                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                        title="Registrar y Consultar Mermas del Lote"
                                                    >
                                                        <AlertOctagon size={13} />
                                                    </button>

                                                    {/* Exportar Resumen (PDF, Excel, Word) */}
                                                    <div className="relative inline-block">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenExportMenuId(openExportMenuId === b.id ? null : b.id)}
                                                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors shadow-xs flex items-center gap-0.5"
                                                            title="Exportar Resumen de Producción (PDF, Excel, Word)"
                                                        >
                                                            <Download size={13} />
                                                        </button>
                                                        {openExportMenuId === b.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-30"
                                                                    onClick={() => setOpenExportMenuId(null)}
                                                                />
                                                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40 flex flex-col gap-1 min-w-[130px] text-left animate-in fade-in duration-100">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleExportSummary(b.id, 'pdf');
                                                                            setOpenExportMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-rose-50 rounded-lg text-[11px] font-bold text-rose-700 w-full"
                                                                    >
                                                                        <FileText size={12} />
                                                                        PDF
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleExportSummary(b.id, 'excel');
                                                                            setOpenExportMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-emerald-50 rounded-lg text-[11px] font-bold text-emerald-700 w-full"
                                                                    >
                                                                        <FileSpreadsheet size={12} />
                                                                        Excel (.xlsx)
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            handleExportSummary(b.id, 'word');
                                                                            setOpenExportMenuId(null);
                                                                        }}
                                                                        className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-blue-50 rounded-lg text-[11px] font-bold text-blue-700 w-full"
                                                                    >
                                                                        <FileCheck size={12} />
                                                                        Word (.docx)
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Balance de Masas */}
                                                    {b.status !== 'creado' && b.status !== 'bloqueado_haccp' && (
                                                        <button
                                                            onClick={() => handleOpenBalanceModal(b)}
                                                            className="px-2 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1"
                                                            title="Editar Balance de Masas"
                                                        >
                                                            <Scale size={12} />
                                                            Balance
                                                        </button>
                                                    )}

                                                    {/* Pasteurizar si en_proceso */}
                                                    {b.status === 'en_proceso' && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBatchForPasteurize(b.id);
                                                                setIsPasteurizeModalOpen(true);
                                                            }}
                                                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs"
                                                            title="Iniciar Pasteurización"
                                                        >
                                                            <Flame size={12} />
                                                            Pasteurizar
                                                        </button>
                                                    )}

                                                    {/* Cerrar / Reabrir Pasteurización */}
                                                    {b.pasteurization_status === 'cerrado' ? (
                                                        canManageLots && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenPasteurization(b)}
                                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                                                                title="Reabrir Pasteurización (Permite volver a agregar tarimas o ajustar registros)"
                                                            >
                                                                <Lock size={11} className="text-amber-600" />
                                                                Reabrir Past.
                                                            </button>
                                                        )
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenClosePasteurization(b)}
                                                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                                                            title="Cerrar Pasteurización y Fijar Lote Térmico Oficial"
                                                        >
                                                            <Lock size={11} className="text-emerald-600" />
                                                            Cerrar Past.
                                                        </button>
                                                    )}

                                                    {/* Editar Lote (Abre la pantalla completa de producción) */}
                                                    {canEditProduction && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditBatch(b)}
                                                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shadow-xs"
                                                            title="Editar Lote de Producción (Abrir pantalla de producción)"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}

                                                    {/* Eliminar Lote */}
                                                    {canDeleteProduction && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteConfirmBatch(b)}
                                                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                            title="Eliminar Lote de Producción y Revertir Materia Prima"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}

                                                    {b.status === 'bloqueado_haccp' && (
                                                        <span className="text-rose-600 font-bold text-xs flex items-center justify-center gap-1">
                                                            <Lock size={12} />
                                                            Bloqueado
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'cip' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Log New CIP Form */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit space-y-5">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-teal-600" />
                                Registrar Limpieza CIP
                            </h2>
                            <p className="text-xs text-slate-500">Bitácora de sanitización y control de inocuidad</p>
                            <div className="h-px bg-slate-100 mt-3" />
                        </div>

                        <form onSubmit={handleCreateCip} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                                    Fecha y Hora de Sanitización
                                </label>
                                <input
                                    type="datetime-local"
                                    value={cipForm.created_at}
                                    onChange={(e) => setCipForm({ ...cipForm, created_at: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                                    <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                    Vincular a Lote de Producción (Opcional)
                                </label>
                                <select
                                    value={cipForm.batch_id}
                                    onChange={(e) => setCipForm({ ...cipForm, batch_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">General / Pre-operacional (Sin lote vinculado)</option>
                                    {(Array.isArray(batches) ? batches : []).map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.batch_code_display || b.batch_uuid} - {b.product_type} ({formatDate(b.started_at)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Equipo Sanitizado</label>
                                <select
                                    value={cipForm.equipment_name}
                                    onChange={(e) => setCipForm({ ...cipForm, equipment_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="pasteurizador">Pasteurizador de Placas</option>
                                    <option value="quebradora">Quebradora Centrífuga</option>
                                    <option value="tanque holding 1">Tanque Pulmón 1</option>
                                    <option value="tanque holding 2">Tanque Pulmón 2</option>
                                    <option value="llenadora">Envasadora de Llenado</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Agente Químico Sanitizante</label>
                                <input
                                    type="text"
                                    value={cipForm.chemical_used}
                                    onChange={(e) => setCipForm({ ...cipForm, chemical_used: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: Ácido Peracético 1.5%"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Temp Limpieza (°C)</label>
                                    <input
                                        type="number"
                                        value={cipForm.temperature_c}
                                        onChange={(e) => setCipForm({ ...cipForm, temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 78.5"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Duración (Minutos)</label>
                                    <input
                                        type="number"
                                        value={cipForm.duration_minutes}
                                        onChange={(e) => setCipForm({ ...cipForm, duration_minutes: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 45"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Estado de Validación</label>
                                <select
                                    value={cipForm.validation_status}
                                    onChange={(e) => setCipForm({ ...cipForm, validation_status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="completado">Completado y Aprobado</option>
                                    <option value="fallido">Fallido / Requiere Reinicio</option>
                                    <option value="pendiente">Pendiente de Aprobación</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Notas de Bitácora</label>
                                <textarea
                                    value={cipForm.notes}
                                    onChange={(e) => setCipForm({ ...cipForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-20"
                                    placeholder="Detalles sobre enjuague, conductividad..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                Registrar Limpieza
                            </button>
                        </form>
                    </div>

                    {/* CIP History */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="h-4 w-4 text-indigo-600" />
                                Historial de Sanitización CIP Reciente
                            </h2>
                            <p className="text-xs text-slate-500">Valida la autorización higiénica para el inicio de producción</p>
                            <div className="h-px bg-slate-100 mt-3" />
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1">
                            {(Array.isArray(cipLogs) ? cipLogs : []).length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-6">No hay registros de limpieza disponibles.</p>
                            ) : (Array.isArray(cipLogs) ? cipLogs : []).map(log => (
                                <div key={log.id} className="bg-slate-50 hover:bg-slate-100/70 transition-colors border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.validation_status === 'completado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                {log.validation_status}
                                            </span>
                                            {log.batch_id && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    Lote: {log.batch_code_display || log.batch_uuid || `#${log.batch_id}`}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{log.notes || 'Sin anotaciones adicionales.'}</p>
                                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                                            <span>Químico: <b className="text-slate-700">{log.chemical_used}</b></span>
                                            <span>Operador: <b className="text-slate-700">{log.operator_name}</b></span>
                                        </div>
                                    </div>

                                    <div className="flex md:flex-col justify-between items-end text-right gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500 font-medium">{formatDateTime(log.created_at)}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCip(log.id)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                title="Eliminar este registro de sanitización CIP"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="flex gap-2 text-xs mt-1">
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[8px] font-bold block text-slate-400 uppercase">Temp</span>
                                                <span className="text-xs font-bold text-slate-800">{log.temperature_c}°C</span>
                                            </div>
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[8px] font-bold block text-slate-400 uppercase">Tiempo</span>
                                                <span className="text-xs font-bold text-slate-800">{log.duration_minutes}m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isNewBatchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                        <div>
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    {editingBatch ? (
                                        <>
                                            <Pencil className="h-5 w-5 text-indigo-600" />
                                            <span>Editar Lote de Producción: <b className="text-indigo-700">{editingBatch.batch_code_display || editingBatch.batch_uuid}</b></span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-5 w-5 text-emerald-600" />
                                            <span>Iniciar Nueva Producción</span>
                                        </>
                                    )}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => { setIsNewBatchModalOpen(false); setEditingBatch(null); }}
                                    className="text-slate-400 hover:text-slate-700 p-1"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {editingBatch
                                    ? 'Modifica los parámetros del lote, formulación y materias primas asignadas a esta corrida.'
                                    : 'El pasteurizador debe contar con una limpieza CIP aprobada en las últimas 12 horas.'}
                            </p>
                            <div className="h-px bg-slate-100 mt-4" />
                        </div>

                        {/* CIP Block Warning Alert */}
                        {cipBlockedError && (
                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3 text-rose-900 shadow-sm">
                                <div className="flex gap-2 items-center font-black text-xs uppercase tracking-wide text-rose-700">
                                    <AlertOctagon size={18} className="text-rose-600 shrink-0" />
                                    <span>Alerta de Inocuidad: Pasteurizador Sin Sanitización CIP Vigente</span>
                                </div>
                                <p className="text-xs leading-relaxed text-rose-800">
                                    {cipBlockedError}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/70">
                                    <button
                                        type="button"
                                        onClick={handleQuickSanitize}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                                    >
                                        <Sparkles size={13} />
                                        Auto-registrar CIP Aprobado de Hoy (1 clic)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleCreateBatch(e, true)}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                                    >
                                        <ShieldAlert size={13} />
                                        Iniciar de todos modos (Omitir CIP)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setActiveTab('cip'); setCipBlockedError(null); setIsNewBatchModalOpen(false); }}
                                        className="px-3 py-1.5 bg-white hover:bg-rose-100/60 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold transition-all"
                                    >
                                        Ir a Bitácora CIP Manual
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleCreateBatch} className="space-y-5">
                            {/* Selector de Producción Programada del Calendario */}
                            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-indigo-600" />
                                        <span>Vincular con Producción Programada del Calendario</span>
                                    </label>
                                    {selectedScheduledProd && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectScheduledProduction(null)}
                                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline transition-colors"
                                        >
                                            Desvincular
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={selectedScheduledProd?.id || ''}
                                    onChange={(e) => {
                                        const found = scheduledProductions.find(p => String(p.id) === e.target.value);
                                        handleSelectScheduledProduction(found || null);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                                >
                                    <option value="">-- Iniciar Producción Libre / Sin Programación Previa --</option>
                                    {scheduledProductions.map(p => (
                                        <option key={p.id} value={p.id}>
                                            Lote: {p.lot_code} | {p.product_profile} ({parseFloat(p.target_quantity_lbs || 0).toLocaleString()} Lbs) - {p.production_date?.split('T')[0]} ({p.priority || 'media'})
                                        </option>
                                    ))}
                                </select>
                                {selectedScheduledProd ? (
                                    <div className="text-[11px] text-indigo-800 font-medium flex items-center gap-2 pt-1 border-t border-indigo-200/60">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                        <span>
                                            Programado: <strong>{selectedScheduledProd.production_date?.split('T')[0]}</strong> •
                                            Operador Asignado: <strong>{selectedScheduledProd.assigned_operator_name || 'Sin asignar'}</strong> •
                                            Meta: <strong>{parseFloat(selectedScheduledProd.target_quantity_lbs || 0).toLocaleString()} Lbs</strong>
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-500">
                                        Selecciona una orden del calendario para precargar automáticamente producto, presentación, corrida y fórmula.
                                    </p>
                                )}
                            </div>

                            {/* Identificadores de Lote (Solo edición con permiso especial) */}
                            {editingBatch && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between mb-1.5">
                                            <span>Código de Lote de Producción</span>
                                            {canManageLots ? (
                                                <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded-md">Edición Habilitada</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Lock size={10} /> Solo Lectura</span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={!canManageLots}
                                            value={batchForm.batch_code_display || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, batch_code_display: e.target.value })}
                                            className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none ${
                                                canManageLots
                                                    ? 'bg-white border-indigo-300 text-slate-900 focus:ring-2 focus:ring-indigo-500/20'
                                                    : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                            }`}
                                            placeholder="Ej: LOTE 01-265-26"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Identificador visible de la orden de producción.</span>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between mb-1.5">
                                            <span>Lote de Pasteurización</span>
                                            {canManageLots ? (
                                                <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md">Edición Habilitada</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1"><Lock size={10} /> Solo Lectura</span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            disabled={!canManageLots}
                                            value={batchForm.pasteurization_lot || ''}
                                            onChange={(e) => setBatchForm({ ...batchForm, pasteurization_lot: e.target.value })}
                                            className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none ${
                                                canManageLots
                                                    ? 'bg-white border-amber-300 text-slate-900 focus:ring-2 focus:ring-amber-500/20'
                                                    : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                                            }`}
                                            placeholder="Ej: PAST-084-01"
                                        />
                                        <span className="text-[10px] text-slate-500 block mt-1">Identificador térmico registrado en el pasteurizador.</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Corrida del Día</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={batchForm.run_number}
                                        onChange={(e) => {
                                            const newRun = e.target.value;
                                            const dayInfo = getJulianDayInfo();
                                            const runStr = String(newRun || 1).padStart(2, '0');
                                            const autoCode = `LOTE ${runStr}-${dayInfo.dayOfYearStr}-${dayInfo.year2Digit}`;
                                            setBatchForm(prev => ({
                                                ...prev,
                                                run_number: newRun,
                                                batch_code_display: (!prev.batch_code_display || prev.batch_code_display.startsWith('LOTE'))
                                                    ? autoCode
                                                    : prev.batch_code_display
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 1"
                                    />
                                    <span className="text-[10px] text-indigo-600 font-medium block mt-1">
                                        Formato oficial: LOTE {String(batchForm.run_number || 1).padStart(2, '0')}-{getJulianDayInfo().dayOfYearStr}-{getJulianDayInfo().year2Digit}
                                    </span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Producto a Fabricar</label>
                                    <select
                                        value={batchForm.product_type}
                                        onChange={(e) => setBatchForm({ ...batchForm, product_type: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        <option value="huevo entero">Huevo Entero Pasteurizado</option>
                                        <option value="huevo rapido">Huevo Entero Rápido</option>
                                        <option value="clara">Clara Pasteurizada</option>
                                        <option value="clara ppg">Clara PPG</option>
                                        <option value="yema salada">Yema Líquida Salada (10% sal)</option>
                                        <option value="yema azucarada">Yema Líquida Azucarada (10% azúcar)</option>
                                        <option value="fórmula especial">Fórmula Especial / HE Plus (18-21% sol)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                                        Presentaciones Comerciales (Múltiples)
                                    </label>
                                    <div className="flex flex-wrap gap-1.5 p-1.5 bg-white border border-slate-300 rounded-xl min-h-[38px] items-center">
                                        {[
                                            { id: 'cubeta 30LB', label: 'Cubeta 30 Lbs' },
                                            { id: 'cubeta 32LB', label: 'Cubeta 32 Lbs' },
                                            { id: 'galón 8LB', label: 'Galón 8 Lbs' },
                                            { id: 'medio galón 4LB', label: 'Medio Galón 4 Lbs' },
                                            { id: 'litro 2LB', label: 'Litro 2 Lbs' },
                                            { id: 'bolsa 5LB', label: 'Bolsa 5 Lbs' }
                                        ].map(p => {
                                            const currentSelected = Array.isArray(batchForm.presentations)
                                                ? batchForm.presentations
                                                : (batchForm.presentation ? batchForm.presentation.split(',').map(s => s.trim()) : ['cubeta 30LB']);
                                            const isSelected = currentSelected.includes(p.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        let updated;
                                                        if (isSelected) {
                                                            if (currentSelected.length === 1) return toast.info('Debe mantener al menos una presentación seleccionada.');
                                                            updated = currentSelected.filter(x => x !== p.id);
                                                        } else {
                                                            updated = [...currentSelected, p.id];
                                                        }
                                                        setBatchForm({ ...batchForm, presentations: updated, presentation: updated.join(', ') });
                                                    }}
                                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 border ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                                                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    {isSelected && <Check size={11} className="text-indigo-600" />}
                                                    <span>{p.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Materias Primas con Desglose de Tarimas y Cantidades */}
                            <div className="space-y-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-2.5">
                                    <div>
                                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                            <Layers className="w-4 h-4 text-indigo-600" />
                                            <span>Materia Prima Base (Lotes en Recepción & Tarimas)</span>
                                        </label>
                                        <p className="text-[11px] text-slate-500">
                                            Selecciona lotes aprobados con saldo disponible o escanea las tarimas con la cámara.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setScannerModalOpen(true)}
                                            className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-500/20"
                                            title="Abrir cámara para escanear QR o código de barra de la tarima"
                                        >
                                            <Camera className="w-4 h-4" />
                                            <span>Escanear Tarima (Cámara / QR)</span>
                                        </button>
                                        <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                            <span className="text-slate-500 font-medium">Cajas: <strong className="text-indigo-700">{batchForm.raw_materials.reduce((s, rm) => s + (parseInt(rm.boxes_count) || (rm.tarimas || []).reduce((ts, t) => ts + (parseInt(t.boxes_count) || 0), 0)), 0)} cjs</strong></span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-slate-500 font-medium">Entrada: <strong className="text-emerald-700">{batchForm.raw_materials.reduce((s, rm) => s + parseFloat(rm.quantity_lbs || 0), 0).toFixed(2)} Lbs</strong></span>
                                        </div>
                                    </div>
                                </div>

                                {/* Banner de recomendación inteligente: FIFO y Grado AA para Separación */}
                                {recommendedLot && (
                                    <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/90 to-purple-50/90 rounded-xl border border-indigo-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5 shadow-xs">
                                                <Sparkles size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wide">
                                                        Lote Sugerido para Corrida:
                                                    </span>
                                                    {isCurrentSeparation ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                                                            ⭐ Prioridad Grado AA (Separación)
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                                                            🔄 Rotación FIFO (Más Antiguo)
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${(recommendedLot.storage_location || 'abajo') === 'abajo'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                        Estiba: {(recommendedLot.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo (Piso)' : '⬆ Arriba (Rack)'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-800 mt-0.5">
                                                    <strong>Lote {recommendedLot.provider_lot}</strong> ({recommendedLot.provider_name || 'Proveedor'}) • {recommendedLot.egg_type} • <span className="font-semibold text-purple-900">{recommendedLot.egg_classification || 'Grado A'}</span> • Saldo: <strong>{parseFloat(recommendedLot.stock_lbs || 0).toFixed(0)} Lbs</strong> ({recommendedLot.total_boxes || 0} cjs)
                                                </p>
                                                <span className="text-[11px] text-slate-600 font-medium block mt-0.5">
                                                    {recommendationReason}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleApplyRecommendedLot(recommendedLot)}
                                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                                            title="Cargar automáticamente este lote y todas sus tarimas con saldo a la producción"
                                        >
                                            <Check size={14} />
                                            <span>Aplicar Lote Recomendado</span>
                                        </button>
                                    </div>
                                )}

                                {/* Aviso no bloqueante si en producto de separación se seleccionó un lote que no es Grado AA */}
                                {nonAALotSelectedForSeparation && nonAALotObj && (
                                    <div className="p-3 bg-amber-50/95 rounded-xl border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs shadow-2xs">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <strong className="font-bold block text-amber-950">Aviso de Calidad para Separación de Clara / Yema:</strong>
                                            <p className="text-amber-900 leading-relaxed">
                                                El lote seleccionado <strong>{nonAALotObj.provider_lot}</strong> tiene clasificación <u>{nonAALotObj.egg_classification || 'No Grado AA'}</u>. Para el quebraje y separación de claras y yemas se recomienda estrictamente <strong>Huevo Grado AA</strong> con membrana vitelina firme para evitar la ruptura accidental de la yema y la contaminación grasa en las claras.
                                            </p>
                                            <span className="text-[11px] font-semibold text-amber-800 block">
                                                (Puede continuar con este lote si supervisión de planta autoriza el quebraje).
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {batchForm.raw_materials.map((rm, idx) => {
                                    const selectedLot = rawMaterials.find(m => String(m.id) === String(rm.raw_material_id));
                                    let lotTarimas = selectedLot?.tarimas_available || [];
                                    if (lotTarimas.length === 0 && selectedLot?.tarimas_json) {
                                        try {
                                            lotTarimas = typeof selectedLot.tarimas_json === 'string'
                                                ? JSON.parse(selectedLot.tarimas_json || '[]')
                                                : (selectedLot.tarimas_json || []);
                                        } catch (e) {
                                            lotTarimas = [];
                                        }
                                    }

                                    return (
                                        <div key={idx} className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-3">
                                            {/* Cabecera de línea de lote */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <div className="flex-1">
                                                    <select
                                                        value={rm.raw_material_id}
                                                        onChange={(e) => {
                                                            const lotId = e.target.value;
                                                            const lotObj = rawMaterials.find(m => String(m.id) === String(lotId));
                                                            const updated = [...batchForm.raw_materials];
                                                            updated[idx].raw_material_id = lotId;
                                                            updated[idx].tarimas = [];
                                                            if (lotObj) {
                                                                updated[idx].quantity_lbs = '';
                                                                updated[idx].boxes_count = '';
                                                            }
                                                            setBatchForm({ ...batchForm, raw_materials: updated });
                                                        }}
                                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                                                    >
                                                        <option value="">Seleccionar lote recepcionado...</option>
                                                        {rawMaterials.map((m, mIdx) => {
                                                            const isAgotado = m.is_depleted || parseFloat(m.stock_lbs || 0) <= 0.01;
                                                            const isAlreadyChosen = batchForm.raw_materials.some((r, i) => i !== idx && r.raw_material_id === String(m.id));
                                                            const isFifoOldest = mIdx === 0;
                                                            const isAA = (m.egg_classification || '').toLowerCase().includes('aa');
                                                            const locTag = (m.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba';
                                                            return (
                                                                <option
                                                                    key={m.id}
                                                                    value={m.id}
                                                                    disabled={isAgotado || isAlreadyChosen}
                                                                    className={isAgotado ? 'text-slate-400 bg-slate-50' : 'text-slate-900 font-semibold'}
                                                                >
                                                                    {isFifoOldest ? '[FIFO] ' : ''}
                                                                    {isAA ? '[⭐ Grado AA] ' : ''}
                                                                    [{locTag}] Lote: {m.provider_lot} - {m.egg_type} ({m.provider_name || 'Prov.'}) | {isAgotado ? '🚫 [AGOTADO - 0 Lbs]' : `Stock: ${parseFloat(m.stock_lbs || 0).toFixed(0)} Lbs (${m.total_boxes || 0} cjs)`}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="w-28">
                                                        <input
                                                            type="number"
                                                            value={rm.quantity_lbs}
                                                            readOnly
                                                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold text-right cursor-not-allowed"
                                                            placeholder="Total Lbs"
                                                            title="Suma automática de las tarimas seleccionadas"
                                                        />
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setBatchForm({ ...batchForm, raw_materials: batchForm.raw_materials.filter((_, i) => i !== idx) });
                                                        }}
                                                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                                                        title="Eliminar este lote"
                                                    >
                                                        <XCircle size={17} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Espacio para selección y desglose de Tarimas de Recepción */}
                                            {selectedLot && (
                                                <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1">
                                                                <Layers size={13} className="text-indigo-600" />
                                                                Tarimas Registradas en Recepción
                                                            </span>
                                                            {lotTarimas.length > 0 && (
                                                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                    {lotTarimas.filter(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01)).length} disponibles de {lotTarimas.length}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {lotTarimas.some(t => !t.is_depleted && !(t.available_boxes <= 0 && t.available_lbs <= 0.01) && !(rm.tarimas || []).some(it => parseInt(it.tarima_number) === parseInt(t.tarima_number))) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleLoadAllAvailableTarimas(idx, lotTarimas)}
                                                                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                >
                                                                    <Check size={11} /> Cargar todas disponibles
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Chips de tarimas registradas para seleccionar con 1 clic */}
                                                    {lotTarimas.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {lotTarimas.map((t) => {
                                                                const isAdded = (rm.tarimas || []).some(it => parseInt(it.tarima_number) === parseInt(t.tarima_number));
                                                                const isDepleted = t.is_depleted || (t.available_boxes <= 0 && t.available_lbs <= 0.01);
                                                                const availBoxes = t.available_boxes ?? t.boxes_count ?? 0;
                                                                const availLbs = t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0;

                                                                return (
                                                                    <button
                                                                        key={t.tarima_number}
                                                                        type="button"
                                                                        disabled={isAdded || isDepleted}
                                                                        onClick={() => handleAddSpecificTarimaToRm(idx, t)}
                                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 border ${isAdded
                                                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                                                                            : isDepleted
                                                                                ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed line-through'
                                                                                : 'bg-white hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 shadow-2xs'
                                                                            }`}
                                                                        title={isDepleted ? 'Tarima 100% consumida en corridas anteriores' : isAdded ? 'Tarima ya agregada' : 'Hacer clic para agregar a esta corrida'}
                                                                    >
                                                                        <span>Tarima #{t.tarima_number}</span>
                                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo'
                                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                            }`}>
                                                                            {(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                        </span>
                                                                        <span className="text-[10px] font-semibold opacity-80">
                                                                            ({availBoxes} cjs • {parseFloat(availLbs).toFixed(0)} Lbs)
                                                                        </span>
                                                                        {isAdded && <Check size={12} className="text-emerald-600" />}
                                                                        {isDepleted && <span className="text-[9px] text-rose-500 font-bold ml-0.5">Agotada</span>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic py-1">
                                                            Este lote no tiene tarimas registradas en recepción.
                                                        </p>
                                                    )}

                                                    {/* Lista de tarimas agregadas para consumir en esta corrida (admite consumo parcial) */}
                                                    {rm.tarimas && rm.tarimas.length > 0 && (
                                                        <div className="space-y-2 pt-2 border-t border-slate-200/80">
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase px-1 flex items-center justify-between">
                                                                <span>Tarimas a Quebrar en esta Corrida</span>
                                                                <span className="text-indigo-600 font-medium lowercase">admite consumo parcial de cajas</span>
                                                            </div>

                                                            <div className="space-y-1.5">
                                                                {rm.tarimas.map((t, ti) => {
                                                                    const maxBoxes = t.available_boxes || t.boxes_count || 0;
                                                                    const maxLbs = t.available_lbs || parseFloat(t.quantity_lbs) || 0;
                                                                    const currentBoxes = parseInt(t.boxes_count) || 0;
                                                                    const isPartial = currentBoxes < maxBoxes;

                                                                    return (
                                                                        <div key={ti} className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-xs flex items-center gap-1.5">
                                                                                        <span>Tarima #{t.tarima_number}</span>
                                                                                        <span className={`text-[9px] font-black px-1 py-0.2 rounded ${(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo'
                                                                                                ? 'bg-blue-100 text-blue-800'
                                                                                                : 'bg-amber-100 text-amber-800'
                                                                                            }`}>
                                                                                            {(t.storage_location || selectedLot?.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                                        </span>
                                                                                    </span>
                                                                                    {t.barcode && (
                                                                                        <span className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                                                                            {t.barcode}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-[11px] text-slate-500">
                                                                                        (Disponible: <strong className="text-slate-700">{maxBoxes} cjs</strong> • <strong className="text-slate-700">{parseFloat(maxLbs).toFixed(1)} Lbs</strong>)
                                                                                    </span>
                                                                                </div>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveTarimaFromRm(idx, ti)}
                                                                                    className="p-1 text-slate-600 hover:text-rose-600 rounded transition-colors"
                                                                                    title="Quitar esta tarima"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>

                                                                            <div className="grid grid-cols-12 gap-2 items-center">
                                                                                <div className="col-span-6 sm:col-span-5 flex items-center gap-1.5">
                                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Cajas a quebrar:</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        min="1"
                                                                                        max={maxBoxes}
                                                                                        value={t.boxes_count}
                                                                                        onChange={(e) => handleUpdateTarimaBoxesInRm(idx, ti, e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:border-indigo-500"
                                                                                        placeholder="0 cjs"
                                                                                    />
                                                                                </div>

                                                                                <div className="col-span-6 sm:col-span-5 flex items-center gap-1.5">
                                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Peso (Lbs):</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        step="0.01"
                                                                                        min="0.01"
                                                                                        max={maxLbs}
                                                                                        value={t.quantity_lbs}
                                                                                        onChange={(e) => handleUpdateTarimaLbsInRm(idx, ti, e.target.value)}
                                                                                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-right focus:border-indigo-500"
                                                                                        placeholder="0.00 Lbs"
                                                                                    />
                                                                                </div>

                                                                                <div className="col-span-12 sm:col-span-2 text-right">
                                                                                    {isPartial ? (
                                                                                        <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md" title={`Quedarán ${maxBoxes - currentBoxes} cajas en inventario`}>
                                                                                            Parcial (-{maxBoxes - currentBoxes} cjs)
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                                                                            Completa
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 pt-1.5 px-2 bg-slate-100/90 p-2 rounded-lg border border-slate-200">
                                                                <span>Subtotal a Quebrar de este Lote:</span>
                                                                <span className="text-indigo-700">
                                                                    {rm.tarimas.reduce((s, t) => s + (parseInt(t.boxes_count) || 0), 0)} Cajas • {rm.tarimas.reduce((s, t) => s + (parseFloat(t.quantity_lbs) || 0), 0).toFixed(2)} Lbs
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => setBatchForm({ ...batchForm, raw_materials: [...batchForm.raw_materials, { raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }] })}
                                    className="w-full py-2.5 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200/80 flex items-center justify-center gap-1.5 shadow-2xs"
                                >
                                    <Plus size={14} />
                                    Agregar Otro Lote de Materia Prima
                                </button>
                            </div>

                            {/* Remanentes / Sobrantes Disponibles de Producciones Anteriores */}
                            <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-200 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/80 pb-2">
                                    <div>
                                        <label className="text-xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4 text-teal-600" />
                                            <span>Materia prima en proceso (Producciones Previas)</span>
                                        </label>
                                        <p className="text-[11px] text-teal-700">
                                            Materia prima en proceso (huevo en leche, mezclas previas) listos para integrarse en esta formulación.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const nextVal = !showAllRemanentes;
                                                setShowAllRemanentes(nextVal);
                                                try {
                                                    const res = await axios.get('/api/egg-industrial/remanentes/available', {
                                                        params: nextVal ? { all: 'true' } : (editingBatch ? { include_batch_id: editingBatch.id } : {})
                                                    });
                                                    setAvailableRemanentes(res.data || []);
                                                } catch (e) { }
                                            }}
                                            className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all ${showAllRemanentes
                                                    ? 'bg-teal-700 text-white border-teal-700'
                                                    : 'bg-white text-teal-800 border-teal-300 hover:bg-teal-100'
                                                }`}
                                        >
                                            {showAllRemanentes ? 'Ver Solo Disponibles' : 'Ver Todos / Historial'}
                                        </button>
                                        <span className="text-xs bg-white px-2.5 py-1 rounded-lg border border-teal-200 text-teal-800 font-bold self-start sm:self-auto">
                                            {availableRemanentes.filter(r => r.status === 'disponible').length} disponibles
                                        </span>
                                    </div>
                                </div>

                                {availableRemanentes.length === 0 ? (
                                    <p className="text-xs text-teal-700/80 italic py-1">
                                        No hay remanentes o sobrantes con saldo disponible en este momento.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {availableRemanentes.map(rem => {
                                            const isSelected = (batchForm.remanente_ids || []).includes(rem.id);
                                            const isAssigned = rem.status === 'asignado_a_lote';
                                            return (
                                                <div
                                                    key={rem.id}
                                                    onClick={() => {
                                                        if (isAssigned && !isSelected) return;
                                                        const current = batchForm.remanente_ids || [];
                                                        const updated = isSelected ? current.filter(id => id !== rem.id) : [...current, rem.id];
                                                        setBatchForm({ ...batchForm, remanente_ids: updated });
                                                    }}
                                                    className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-2 ${isSelected
                                                            ? 'bg-white border-teal-500 shadow-sm ring-2 ring-teal-500/20 cursor-pointer'
                                                            : isAssigned
                                                                ? 'bg-slate-100/80 border-slate-200 text-slate-500 cursor-default opacity-85'
                                                                : 'bg-white/70 border-teal-200/70 hover:bg-white cursor-pointer'
                                                        }`}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={isAssigned && !isSelected}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    if (isAssigned && !isSelected) return;
                                                                    const current = batchForm.remanente_ids || [];
                                                                    const updated = isSelected ? current.filter(id => id !== rem.id) : [...current, rem.id];
                                                                    setBatchForm({ ...batchForm, remanente_ids: updated });
                                                                }}
                                                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                                            />
                                                            <span className="text-xs font-bold text-slate-900">{rem.batch_code_display || `Lote #${rem.batch_id}`}</span>
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-semibold uppercase">{rem.remanente_type || 'pasteurizado'}</span>
                                                            {isAssigned && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">Usado</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-600">
                                                            <span>{rem.product_type} • </span>
                                                            <strong className="text-teal-700">{parseFloat(rem.quantity_lbs || rem.weight_lbs || 0).toFixed(1)} Lbs</strong>
                                                        </div>
                                                        {rem.notes && (
                                                            <p className="text-[10px] text-slate-500 line-clamp-1">{rem.notes}</p>
                                                        )}
                                                        {isSelected && (
                                                            <span className="inline-block text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                                                ✓ Seleccionado para esta formulación
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        <span className="text-[11px] font-bold text-teal-700">{parseFloat(rem.quantity_lbs || rem.weight_lbs || 0).toFixed(1)} Lbs</span>
                                                        {!isAssigned ? (
                                                            <button
                                                                type="button"
                                                                title="Marcar como ya utilizado en corrida previa"
                                                                onClick={(e) => handleMarkRemanenteUsed(e, rem)}
                                                                className="text-[10px] font-semibold text-slate-600 hover:text-amber-700 bg-slate-100 hover:bg-amber-100 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                                                            >
                                                                Ya usado
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                title="Reactivar como disponible"
                                                                onClick={(e) => handleReactivateRemanente(e, rem)}
                                                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                                                            >
                                                                Reactivar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {(batchForm.remanente_ids || []).length > 0 && (
                                    <div className="text-xs font-bold text-teal-800 bg-white/90 px-3 py-1.5 rounded-lg border border-teal-300 flex items-center justify-between">
                                        <span>Remanentes Seleccionados: {(batchForm.remanente_ids || []).length}</span>
                                        <span>
                                            + {availableRemanentes.filter(r => (batchForm.remanente_ids || []).includes(r.id)).reduce((acc, r) => acc + parseFloat(r.quantity_lbs || r.weight_lbs || 0), 0).toFixed(1)} Lbs incorporadas a la mezcla
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Insumos de Formulación / Receta */}
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Insumos y Aditivos de Formulación (Receta)</label>
                                    <span className="text-[10px] text-slate-500">Opcional para fórmulas compuestas</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Cajas Huevo</label>
                                        <input
                                            type="number"
                                            placeholder="0 cjs"
                                            value={batchForm.ingredients.boxes_count}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, boxes_count: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">liquido a</label>
                                        <input
                                            type="number"
                                            placeholder="0 garrafones"
                                            value={batchForm.ingredients.water_bottles}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, water_bottles: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Azúcar (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.sugar_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, sugar_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Sal (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.salt_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, salt_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Ác. Cítrico (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.citric_acid_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, citric_acid_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Leche Polvo (Lbs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.milk_powder_lbs}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, milk_powder_lbs: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">PPG (Gramos)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="0.0"
                                            value={batchForm.ingredients.ppg_g}
                                            onChange={(e) => setBatchForm({ ...batchForm, ingredients: { ...batchForm.ingredients, ppg_g: e.target.value } })}
                                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 text-center font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Checkbox de autorización de excepción de CIP */}
                            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="bypassCipCheckModal"
                                    checked={batchForm.bypass_cip_check || false}
                                    onChange={(e) => setBatchForm({ ...batchForm, bypass_cip_check: e.target.checked })}
                                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <label htmlFor="bypassCipCheckModal" className="text-xs text-amber-900 cursor-pointer select-none">
                                    <span className="font-bold flex items-center gap-1.5">
                                        <ShieldAlert size={14} className="text-amber-600" />
                                        Autorizar inicio bajo excepción operativa de sanitización CIP
                                    </span>
                                    <span className="text-[11px] text-amber-700 block mt-0.5">
                                        Marque esta casilla si la planta ya fue sanitizada o requiere procesar de urgencia sin registro formal previo de CIP (se auditará como evento de excepción).
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => { setIsNewBatchModalOpen(false); setEditingBatch(null); }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    {isSubmitting
                                        ? (editingBatch ? 'Guardando Cambios...' : 'Iniciando...')
                                        : (editingBatch ? 'Actualizar Lote' : 'Iniciar Lote')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPasteurizeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <Flame className="h-5 w-5 text-orange-600" />
                                Registro de Parámetros de Pasteurización
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Verifique termómetros y manómetros antes de validar el tratamiento térmico.</p>
                            <div className="h-px bg-slate-100 mt-4" />
                        </div>

                        {/* Guía Rápida de Límites de Pasteurización ANDELSA */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                            <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-slate-500 block font-bold uppercase text-[10px]">Huevo Entero</span>
                                <span className="text-slate-900 font-bold text-xs">≥ 64.0°C</span>
                                <span className="text-slate-400 block text-[9px]">210 seg</span>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-slate-500 block font-bold uppercase text-[10px]">Clara Líquida</span>
                                <span className="text-slate-900 font-bold text-xs">≥ 56.0°C</span>
                                <span className="text-slate-400 block text-[9px]">210 seg</span>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-slate-500 block font-bold uppercase text-[10px]">Yema / Salada</span>
                                <span className="text-slate-900 font-bold text-xs">≥ 66.5°C</span>
                                <span className="text-slate-400 block text-[9px]">210 seg</span>
                            </div>
                        </div>

                        {/* Alert HACCP */}
                        {haccpViolationAlert && (
                            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 text-rose-900 space-y-3 shadow-sm">
                                <div className="flex gap-2 items-center font-bold text-xs uppercase tracking-wide text-rose-700">
                                    <AlertOctagon size={18} className="text-rose-600" />
                                    ALERTA DE INOCUIDAD ALIMENTARIA: PARÁMETROS FUERA DE RANGO
                                </div>
                                <p className="text-xs font-bold leading-relaxed">{haccpViolationAlert}</p>
                                <p className="text-xs text-rose-700">
                                    <b>ACCIÓN AUTOMÁTICA:</b> El lote ha sido marcado como bloqueado para empaque comercial y requiere evaluación de calidad.
                                </p>
                                <button
                                    onClick={() => { setHaccpViolationAlert(null); setIsPasteurizeModalOpen(false); }}
                                    className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-xs"
                                >
                                    Volver al Historial
                                </button>
                            </div>
                        )}

                        <form onSubmit={handlePasteurize} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote en Proceso a Pasteurizar</label>
                                <select
                                    value={selectedBatchForPasteurize}
                                    onChange={(e) => setSelectedBatchForPasteurize(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">Seleccione Lote...</option>
                                    {batches.filter(b => b.status === 'en_proceso' || String(b.id) === String(selectedBatchForPasteurize)).map(b => (
                                        <option key={b.id} value={b.id}>
                                            [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Temperatura Pasteurización (°C)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.temperature_c}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        step="0.01"
                                        placeholder="Ej: 64.5"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Tiempo de Retención (Segundos)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.holding_time_seconds}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, holding_time_seconds: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 210"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Presión Hidráulica (PSI)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.pressure_psi}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, pressure_psi: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        step="0.01"
                                        placeholder="Ej: 48.0"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Flujo de Bomba (GPM)</label>
                                    <input
                                        type="number"
                                        value={pasteurizeForm.flow_rate_gpm}
                                        onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, flow_rate_gpm: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        step="0.01"
                                        placeholder="Ej: 12.5"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setIsPasteurizeModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    {isSubmitting ? 'Validando...' : 'Validar & Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BALANCE DE MASAS DIALOG MODAL */}
            {selectedBatchForComplete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-6 text-slate-900">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">Balance de Masas y Cierre de Lote</h3>
                            <p className="text-xs text-slate-500 mt-1">Lote: <b>{selectedBatchForComplete.batch_uuid}</b></p>
                        </div>
                        <div className="h-px bg-slate-100" />

                        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Entrada</span>
                                <span className="text-xs font-bold text-slate-900">{parseFloat(selectedBatchForComplete.input_weight_lbs || 0).toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Esperado ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).yield_pct || 85}%)</span>
                                <span className="text-xs font-bold text-indigo-600">~{(parseFloat(selectedBatchForComplete.input_weight_lbs) * (() => { const cfg = productConfig.find(c => c.product_type === selectedBatchForComplete.product_type) || {}; return parseFloat(cfg.yield_pct || 85) / 100; })()).toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Cáscara/Merma ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_shell_pct || 12}%+{(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_loss_pct || 3}%)</span>
                                <span className="text-xs font-bold text-slate-600">~{(parseFloat(selectedBatchForComplete.input_weight_lbs) * (() => { const cfg = productConfig.find(c => c.product_type === selectedBatchForComplete.product_type) || {}; return (parseFloat(cfg.waste_shell_pct || 12) + parseFloat(cfg.waste_loss_pct || 3)) / 100; })()).toLocaleString()} Lbs</span>
                            </div>
                        </div>

                        <form onSubmit={handleCompleteBatch} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Rendimiento Líquido ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).yield_pct || 85}%)</label>
                                <input
                                    type="number"
                                    value={completeForm.yield_liquid_lbs}
                                    onChange={(e) => setCompleteForm({ ...completeForm, yield_liquid_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 10320"
                                    step="0.01"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Cáscara ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_shell_pct || 12}%)</label>
                                    <input
                                        type="number"
                                        value={completeForm.waste_shell_lbs}
                                        onChange={(e) => setCompleteForm({ ...completeForm, waste_shell_lbs: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 1440"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Merma ({(productConfig.find(c => c.product_type === selectedBatchForComplete?.product_type) || {}).waste_loss_pct || 3}%)</label>
                                    <input
                                        type="number"
                                        value={completeForm.waste_loss_lbs}
                                        onChange={(e) => setCompleteForm({ ...completeForm, waste_loss_lbs: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 240"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            {/* Métricas en tiempo real de Balance: Rendimiento por caja y Líquido + Envasado */}
                            {(() => {
                                const inpLbs = parseFloat(selectedBatchForComplete?.input_weight_lbs || 0);
                                const bxs = selectedBatchForComplete?.total_boxes || Math.round(inpLbs / 30) || 1;
                                const curLiquid = parseFloat(completeForm.yield_liquid_lbs || 0);
                                const curPkg = parseFloat(selectedBatchForComplete?.packaged_weight_lbs || 0);
                                const yieldPerBox = bxs > 0 ? (curLiquid / bxs).toFixed(1) : '0.0';
                                const liquidPlusPackaged = curLiquid + curPkg;
                                const totalYieldPct = inpLbs > 0 ? ((liquidPlusPackaged / inpLbs) * 100).toFixed(1) : '0.0';

                                return (
                                    <div className="grid grid-cols-3 gap-2 bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold text-blue-700 block uppercase">Rend. / Caja</span>
                                            <span className="text-xs font-black text-blue-900">{yieldPerBox} Lbs/Cja</span>
                                            <span className="text-[9px] text-blue-500 block">({bxs} cajas)</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold text-blue-700 block uppercase">Líq. + Envasado</span>
                                            <span className="text-xs font-black text-blue-900">{liquidPlusPackaged.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lbs</span>
                                            <span className="text-[9px] text-blue-500 block">{curPkg > 0 ? `(${curPkg.toLocaleString()} env.)` : 'sin envasar'}</span>
                                        </div>
                                        <div className="text-center">
                                            <span className="text-[10px] font-bold text-blue-700 block uppercase">% Rend. Total</span>
                                            <span className="text-xs font-black text-blue-900">{totalYieldPct}%</span>
                                            <span className="text-[9px] text-blue-500 block">sobre entrada</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setSelectedBatchForComplete(null)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                >
                                    Guardar & Cerrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal de Escáner de Tarima con Cámara (QR y Código de Barras) */}
            {scannerModalOpen && (
                <ProductionTarimaScannerModal
                    isOpen={scannerModalOpen}
                    onClose={() => setScannerModalOpen(false)}
                    onScanTarima={handleScanTarimaResult}
                    rawMaterials={rawMaterials}
                />
            )}

            {/* Modal Selector de Tarima Específica del Lote */}
            {tarimaPickerModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full space-y-4 text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                        Seleccionar Tarima del Lote
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {tarimaPickerModal.lot?.provider_lot} - {tarimaPickerModal.lot?.provider_name || 'Proveedor'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                            Este lote tiene múltiples tarimas disponibles en bodega. Selecciona la tarima que vas a ingresar a esta corrida de producción:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                            {tarimaPickerModal.availableTarimas.map((t) => {
                                const availBoxes = t.available_boxes ?? t.boxes_count ?? 0;
                                const availLbs = t.available_lbs ?? t.net_weight_lbs ?? t.gross_weight_lbs ?? 0;
                                return (
                                    <button
                                        key={t.tarima_number}
                                        type="button"
                                        onClick={() => {
                                            const lotObj = tarimaPickerModal.lot;
                                            setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] });
                                            handleScanTarimaResult({
                                                lotCode: lotObj.provider_lot,
                                                tarimaNumber: t.tarima_number
                                            });
                                        }}
                                        className="p-3.5 bg-white hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-xl text-left transition-all group shadow-xs"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-xs text-indigo-700 group-hover:text-indigo-900">
                                                    Tarima #{t.tarima_number}
                                                </span>
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${(t.storage_location || tarimaPickerModal.lot?.storage_location || 'abajo') === 'abajo'
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {(t.storage_location || tarimaPickerModal.lot?.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                                                {availBoxes} cjs
                                            </span>
                                        </div>
                                        <div className="text-xs font-black text-slate-800">
                                            {parseFloat(availLbs).toFixed(1)} Lbs
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => {
                                    const lotObj = tarimaPickerModal.lot;
                                    setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] });
                                    handleScanTarimaResult({
                                        lotCode: lotObj.provider_lot,
                                        loadAll: true
                                    });
                                }}
                                className="w-full sm:w-auto px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors shadow-xs"
                            >
                                Cargar Todas las Tarimas ({tarimaPickerModal.availableTarimas.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTarimaPickerModal({ isOpen: false, lot: null, availableTarimas: [] })}
                                className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VISUALIZADOR Y CONTROL DE ETAPAS DEL PROCESO */}
            {/* MODAL BALANCE Y ETAPAS DEL LOTE */}
            <EggBatchStagesModal
                isOpen={stagesModal.isOpen}
                onClose={() => setStagesModal({ isOpen: false, batch: null, data: null, loading: false })}
                stagesModal={stagesModal}
                canManageLots={canManageLots}
                onClosePasteurization={(batch) => handleOpenClosePasteurization(batch)}
                onReopenPasteurization={(batch) => handleReopenPasteurization(batch)}
                onReopenPackaging={(batch) => handleReopenBatchPackaging(batch?.id || batch)}
                onOpenAddTarimas={(batch) => setAddTarimasModal({
                    isOpen: true,
                    batch: batch,
                    raw_materials: [
                        { raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }
                    ],
                    manualTarimaInput: '',
                    notes: '',
                    isSubmitting: false
                })}
                onOpenPasteurize={(batch) => {
                    setSelectedBatchForPasteurize(batch?.id);
                    setIsPasteurizeModalOpen(true);
                    setStagesModal({ isOpen: false, batch: null, data: null, loading: false });
                }}
                onOpenBalance={(batch) => handleOpenBalanceModal(batch)}
                onOpenRemanente={(batch) => setRemanenteModal({
                    isOpen: true,
                    id: null,
                    batch: batch,
                    product_type: batch?.product_type || 'huevo entero',
                    presentation: 'cubeta 30LB',
                    weight_lbs: '',
                    is_pasteurized: batch?.status === 'pasteurizado',
                    destination: 'proximo_empaque',
                    notes: '',
                    isSubmitting: false
                })}
                onOpenEditRemanente={(rem) => handleOpenEditRemanente(rem)}
                onDeleteRemanente={(remId) => handleDeleteRemanente(remId)}
                onNavigateEmpaque={() => navigate('/industrial/empaque')}
                onOpenWastes={(batch) => handleOpenWastesModal(batch)}
                onOpenEditWaste={(waste) => handleOpenEditWaste(waste)}
                handleDeleteWaste={(wasteId) => handleDeleteWaste(wasteId)}
                onDeleteWaste={(wasteId) => handleDeleteWaste(wasteId)}
                onExportSummary={(batchId, format) => handleExportSummary(batchId, format)}
            />

            {/* MODAL CERRAR PASTEURIZACIÓN */}
            <EggClosePasteurizationModal
                isOpen={closePasteurizationModal.isOpen}
                onClose={() => setClosePasteurizationModal(prev => ({ ...prev, isOpen: false, batch: null }))}
                batch={closePasteurizationModal.batch}
                pasteurizationLot={closePasteurizationModal.pasteurization_lot}
                onPasteurizationLotChange={(val) => setClosePasteurizationModal(prev => ({ ...prev, pasteurization_lot: val }))}
                notes={closePasteurizationModal.notes}
                onNotesChange={(val) => setClosePasteurizationModal(prev => ({ ...prev, notes: val }))}
                onSubmit={handleConfirmClosePasteurization}
                isSubmitting={closePasteurizationModal.isSubmitting}
            />

            {/* MODAL AGREGAR MÁS TARIMAS AL QUEBRAJE */}
            <EggAddTarimasModal
                isOpen={addTarimasModal.isOpen}
                onClose={() => setAddTarimasModal(prev => ({ ...prev, isOpen: false }))}
                addTarimasModal={addTarimasModal}
                setAddTarimasModal={setAddTarimasModal}
                rawMaterials={rawMaterials}
                onOpenScanner={() => {
                    setScannerContext('add_tarimas');
                    setScannerModalOpen(true);
                }}
                onOpenTarimaSearchPicker={() => setTarimaSearchPickerOpen(true)}
                handleManualTarimaDigitize={handleManualTarimaDigitize}
                handleAddTarimasSubmit={handleAddTarimasSubmit}
                handleLoadAllAvailableTarimasToAddModal={handleLoadAllAvailableTarimasToAddModal}
                handleAddSpecificTarimaToAddModal={handleAddSpecificTarimaToAddModal}
                handleRemoveTarimaFromAddModal={handleRemoveTarimaFromAddModal}
                handleUpdateTarimaBoxesInAddModal={handleUpdateTarimaBoxesInAddModal}
                handleUpdateTarimaLbsInAddModal={handleUpdateTarimaLbsInAddModal}
            />

            {/* MODAL BUSCADOR DE LOTES Y TARIMAS DISPONIBLES */}
            <EggTarimaSearchModal
                isOpen={tarimaSearchPickerOpen}
                onClose={() => setTarimaSearchPickerOpen(false)}
                rawMaterials={rawMaterials}
                addTarimasModal={addTarimasModal}
                setAddTarimasModal={setAddTarimasModal}
                handleAddSpecificTarimaToAddModal={handleAddSpecificTarimaToAddModal}
            />

            {/* MODAL REGISTRAR REMANENTE / SOBRANTE */}
            <EggRemanenteModal
                isOpen={remanenteModal.isOpen}
                onClose={() => setRemanenteModal(prev => ({ ...prev, isOpen: false, id: null }))}
                remanenteModal={remanenteModal}
                setRemanenteModal={setRemanenteModal}
                onSubmit={handleRemanenteSubmit}
            />

            {/* MODAL REGISTRO Y GESTIÓN DE MERMAS POR LOTE */}
            <EggBatchWastesModal
                isOpen={wastesModal.isOpen}
                onClose={() => setWastesModal(prev => ({ ...prev, isOpen: false, editingWasteId: null }))}
                wastesModal={wastesModal}
                setWastesModal={setWastesModal}
                handleCreateWaste={handleCreateWaste}
                handleDeleteWaste={handleDeleteWaste}
            />

            {/* DIÁLOGO CONFIRMAR ELIMINACIÓN DE LOTE */}
            {deleteConfirmBatch && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600 border-b border-slate-200 pb-3">
                            <div className="p-2.5 bg-rose-100 rounded-xl">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                                    Confirmar Eliminación de Lote
                                </h3>
                                <span className="text-xs text-slate-500 font-medium">Acción irreversible según nivel de usuario</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 font-medium">
                            ¿Está seguro de eliminar el lote <b>{deleteConfirmBatch.batch_code_display || deleteConfirmBatch.batch_uuid}</b> ({deleteConfirmBatch.product_type})?
                        </p>

                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                            <div className="font-bold">⚠️ Esta acción:</div>
                            <div>• Revertirá el consumo de stock de materia prima utilizada en las tarimas.</div>
                            <div>• Eliminará los registros de mermas y remanentes asociados.</div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmBatch(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteBatchConfirm}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                            >
                                Sí, Eliminar Lote
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EggProduction;
