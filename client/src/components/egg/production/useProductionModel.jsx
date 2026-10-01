import { unwrapList } from '../../../utils/apiUtils';
import { getNowDateTimeLocal } from '../../../utils/dateUtils';
import { getJulianDayInfo } from '../../../utils/julianDate';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';


export default function useProductionModel() {
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
    const [qualityModal, setQualityModal] = useState({ isOpen: false, batch: null });

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
        parent_batch_id: null,
        is_coproduct: false,
        enable_secondary_batch: false,
        secondary_batches: [],
        second_run_number: 2,
        second_batch_code_display: '',
        second_product_type: 'huevo entero',
        second_presentation: 'cubeta 30LB',
        second_presentations: ['cubeta 30LB'],
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
        operator_name: user?.nombre || '',
        pasteurization_lot: ''
    });

    const [secondPasteurizeForm, setSecondPasteurizeForm] = useState({
        temperature_c: '64.5',
        holding_time_seconds: '210',
        pressure_psi: '48.0',
        flow_rate_gpm: '12.5',
        operator_name: user?.nombre || '',
        pasteurization_lot: ''
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
        const inputLbs = parseFloat(batch.input_weight_lbs || 0);
        const defaultShell = batch.waste_shell_lbs && parseFloat(batch.waste_shell_lbs) > 0
            ? String(batch.waste_shell_lbs)
            : (inputLbs > 0 ? (inputLbs * 0.13).toFixed(2) : '');
        const defaultYield = batch.yield_liquid_lbs && parseFloat(batch.yield_liquid_lbs) > 0
            ? String(batch.yield_liquid_lbs)
            : (inputLbs > 0 ? (inputLbs * 0.87).toFixed(2) : '');

        setClosePasteurizationModal({
            isOpen: true,
            batch,
            pasteurization_lot: batch.pasteurization_lot || (batch.batch_code_display ? `PAST-${batch.batch_code_display}` : `PAST-${batch.id}`),
            waste_shell_lbs: defaultShell,
            yield_liquid_lbs: defaultYield,
            notes: '',
            isSubmitting: false
        });
    };

    const handleConfirmClosePasteurization = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const { batch, pasteurization_lot, notes, waste_shell_lbs, yield_liquid_lbs } = closePasteurizationModal;
        if (!batch) return;
        if (!pasteurization_lot?.trim()) {
            return toast.error('Debe ingresar un identificador o lote de pasteurización.');
        }

        setClosePasteurizationModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            const res = await axios.post(`/api/egg-industrial/batches/${batch.id}/close-pasteurization`, {
                pasteurization_lot: pasteurization_lot.trim(),
                waste_shell_lbs: waste_shell_lbs || undefined,
                yield_liquid_lbs: yield_liquid_lbs || undefined,
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
                waste_loss_lbs: String(batch.waste_loss_lbs || '0'),
                supervisor_password: ''
            });
        } else {
            const cfg = productConfig.find(c => c.product_type === batch.product_type) || {};
            const yieldPct = parseFloat(cfg.yield_pct || 87) / 100;
            const shellPct = parseFloat(cfg.waste_shell_pct || 13) / 100;
            const lossPct = parseFloat(cfg.waste_loss_pct || 0) / 100;
            const inputLbs = parseFloat(batch.input_weight_lbs || 0);
            setCompleteForm({
                yield_liquid_lbs: inputLbs > 0 ? (inputLbs * yieldPct).toFixed(2) : '',
                waste_shell_lbs: inputLbs > 0 ? (inputLbs * shellPct).toFixed(2) : '0',
                waste_loss_lbs: inputLbs > 0 ? (inputLbs * lossPct).toFixed(2) : '0',
                supervisor_password: ''
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
            setAvailableRemanentes(unwrapList(res));
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
            setAvailableRemanentes(unwrapList(res));
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
                params: { status: 'programado,en_proceso' }
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

    const handleCreateCoproductBatch = (parentBatch) => {
        if (!parentBatch) return;

        // Determinar producto secundario sugerido
        const currentProd = (parentBatch.product_type || '').toLowerCase();
        let suggestedProd = 'huevo entero';
        if (currentProd.includes('clara')) {
            suggestedProd = 'huevo entero';
        } else if (currentProd.includes('entero')) {
            suggestedProd = 'clara';
        } else if (currentProd.includes('yema')) {
            suggestedProd = 'huevo entero';
        }

        // Sugerir código de corrida secundaria (ej. LOTE 01B-265-26)
        let suggestedCode = '';
        if (parentBatch.batch_code_display) {
            const raw = parentBatch.batch_code_display.trim();
            if (raw.includes('-')) {
                const parts = raw.split('-');
                if (parts.length === 3) {
                    const runPart = parts[0];
                    if (!runPart.endsWith('B') && !runPart.endsWith('C')) {
                        suggestedCode = `${runPart}B-${parts[1]}-${parts[2]}`;
                    }
                }
            }
        }

        // Clonar materias primas del lote padre para asociarlas a la corrida compartida sin re-escanear
        const clonedMaterials = (parentBatch.raw_materials || []).map(m => ({
            raw_material_id: m.raw_material_id,
            quantity_lbs: m.quantity_lbs,
            boxes_count: m.boxes_count || 0,
            tarimas: m.tarimas || [],
            egg_type: m.egg_type,
            provider_lot: m.provider_lot
        }));

        const matchingSchedule = scheduledProductions.find(p => p.id === parentBatch.scheduled_production_id || p.batch_id === parentBatch.id);
        setSelectedScheduledProd(matchingSchedule || null);

        setBatchForm(prev => ({
            ...prev,
            parent_batch_id: parentBatch.id,
            is_coproduct: true,
            scheduled_production_id: parentBatch.scheduled_production_id || null,
            product_type: suggestedProd,
            presentation: parentBatch.presentation || 'cubeta 30LB',
            presentations: parentBatch.presentation ? (parentBatch.presentation.includes(',') ? parentBatch.presentation.split(',').map(s => s.trim()) : [parentBatch.presentation]) : ['cubeta 30LB'],
            run_number: parentBatch.run_number || prev.run_number || 1,
            batch_code_display: suggestedCode || prev.batch_code_display,
            raw_materials: clonedMaterials.length > 0 ? clonedMaterials : prev.raw_materials,
            notes: `Segundo lote derivado de la corrida compartida ${parentBatch.batch_code_display || parentBatch.id} (${parentBatch.product_type}).`
        }));

        setIsNewBatchModalOpen(true);
        toast.info(`Configurando segundo lote / co-producto derivado de ${parentBatch.batch_code_display || parentBatch.id}. Materia prima compartida.`);
    };

    const handleSelectScheduledProduction = (sched) => {
        if (!sched) {
            setSelectedScheduledProd(null);
            setBatchForm(prev => ({
                ...prev,
                scheduled_production_id: null,
                parent_batch_id: null,
                is_coproduct: false
            }));
            return;
        }

        setSelectedScheduledProd(sched);

        // Si la orden ya cuenta con un lote iniciado o en proceso, cargar como segundo lote / co-producto
        if (sched.batch_id || sched.status === 'en_proceso') {
            const existingBatch = batches.find(b => b.id === sched.batch_id || b.scheduled_production_id === sched.id);
            if (existingBatch) {
                return handleCreateCoproductBatch(existingBatch);
            }
        }

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

        // Detectar si la actividad programada tiene co-productos secundarios programados simultáneamente
        const companions = (Array.isArray(scheduledProductions) ? scheduledProductions : []).filter(
            p => p.id !== sched.id && (p.parent_production_id === sched.id || (sched.parent_production_id && (p.id === sched.parent_production_id || p.parent_production_id === sched.parent_production_id)))
        );

        const mappedSecondaryBatches = companions.map((comp, idx) => {
            const sp = (comp.product_profile || '').toLowerCase();
            let cPType = 'clara';
            if (sp.includes('clara')) cPType = 'clara';
            else if (sp.includes('azucar') || sp.includes('azúcar')) cPType = 'yema azucarada';
            else if (sp.includes('sal')) cPType = 'yema salada';
            else if (sp.includes('plus') || sp.includes('formulado') || sp.includes('separaci')) cPType = 'fórmula especial';
            else cPType = 'huevo entero';

            const spres = (comp.presentation || '').toLowerCase();
            let cPresType = 'cubeta 30LB';
            if (spres.includes('30')) cPresType = 'cubeta 30LB';
            else if (spres.includes('32')) cPresType = 'cubeta 32LB';
            else if (spres.includes('medio')) cPresType = 'medio galón 4LB';
            else if (spres.includes('gal')) cPresType = 'galón 8LB';
            else if (spres.includes('litro')) cPresType = 'litro 2LB';

            return {
                id: comp.id,
                run_number: runNum + idx + 1,
                batch_code_display: comp.lot_code || '',
                product_type: cPType,
                presentation: cPresType,
                presentations: [cPresType]
            };
        });

        const hasSecondary = mappedSecondaryBatches.length > 0;
        const firstSec = mappedSecondaryBatches[0];

        setBatchForm(prev => ({
            ...prev,
            scheduled_production_id: sched.id,
            parent_batch_id: null,
            is_coproduct: Boolean(sched.is_coproduct),
            product_type: pType,
            presentation: presType,
            presentations: [presType],
            run_number: runNum,
            batch_code_display: sched.lot_code || prev.batch_code_display,
            enable_secondary_batch: hasSecondary,
            secondary_batches: mappedSecondaryBatches,
            second_product_type: firstSec?.product_type || 'clara',
            second_presentation: firstSec?.presentation || 'cubeta 30LB',
            second_presentations: firstSec?.presentations || ['cubeta 30LB'],
            second_batch_code_display: firstSec?.batch_code_display || '',
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

        toast.success(hasSecondary
            ? `Producción multi-lote programada cargada: ${sched.lot_code} con ${mappedSecondaryBatches.length} co-producto(s)`
            : `Producción programada cargada: ${sched.lot_code} (${sched.product_profile})`
        );
    };

    const handleAddSecondaryBatch = () => {
        const count = (batchForm.secondary_batches || []).length;
        const baseRun = parseInt(batchForm.run_number) || 1;
        const nextRun = baseRun + count + 1;
        const dayInfo = getJulianDayInfo();
        const nextCode = `LOTE ${String(nextRun).padStart(2, '0')}-${dayInfo.dayOfYearStr}-${dayInfo.year2Digit}`;
        const defaultTypes = ['clara', 'yema azucarada', 'yema salada', 'huevo entero'];
        const pType = defaultTypes[count % defaultTypes.length] || 'clara';
        setBatchForm(prev => {
            const nextBatches = [
                ...(prev.secondary_batches || []),
                {
                    id: `sec-${Date.now()}-${nextRun}`,
                    run_number: nextRun,
                    batch_code_display: nextCode,
                    product_type: pType,
                    presentation: 'cubeta 30LB',
                    presentations: ['cubeta 30LB']
                }
            ];
            return {
                ...prev,
                enable_secondary_batch: true,
                secondary_batches: nextBatches,
                second_run_number: nextBatches[0].run_number,
                second_batch_code_display: nextBatches[0].batch_code_display,
                second_product_type: nextBatches[0].product_type,
                second_presentation: nextBatches[0].presentation,
                second_presentations: nextBatches[0].presentations
            };
        });
    };

    const handleRemoveSecondaryBatch = (idx) => {
        setBatchForm(prev => {
            const updated = (prev.secondary_batches || []).filter((_, i) => i !== idx);
            return {
                ...prev,
                enable_secondary_batch: updated.length > 0,
                secondary_batches: updated,
                second_run_number: updated[0]?.run_number || 2,
                second_batch_code_display: updated[0]?.batch_code_display || '',
                second_product_type: updated[0]?.product_type || 'huevo entero',
                second_presentation: updated[0]?.presentation || 'cubeta 30LB',
                second_presentations: updated[0]?.presentations || ['cubeta 30LB']
            };
        });
    };

    const handleUpdateSecondaryBatch = (idx, field, value) => {
        setBatchForm(prev => {
            const updated = [...(prev.secondary_batches || [])];
            if (updated[idx]) {
                updated[idx] = { ...updated[idx], [field]: value };
                if (field === 'presentations' && Array.isArray(value)) {
                    updated[idx].presentation = value.join(', ');
                }
            }
            return {
                ...prev,
                secondary_batches: updated,
                ...(idx === 0 ? {
                    second_run_number: updated[0].run_number,
                    second_batch_code_display: updated[0].batch_code_display,
                    second_product_type: updated[0].product_type,
                    second_presentation: updated[0].presentation,
                    second_presentations: updated[0].presentations
                } : {})
            };
        });
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
            const exceptionReason = shouldBypass ? window.prompt('Motivo de la excepción CIP autorizada:') : null;
            if (shouldBypass && !exceptionReason?.trim()) return;

            const secBatchesList = (batchForm.secondary_batches || []).map((sb, idx) => ({
                run_number: parseInt(sb.run_number) || (parseInt(batchForm.run_number) + idx + 1),
                batch_code_display: sb.batch_code_display,
                product_type: sb.product_type || 'huevo entero',
                presentation: Array.isArray(sb.presentations) && sb.presentations.length > 0
                    ? sb.presentations.join(', ')
                    : (sb.presentation || 'cubeta 30LB')
            }));

            if (secBatchesList.length === 0 && batchForm.enable_secondary_batch && batchForm.second_product_type) {
                secBatchesList.push({
                    run_number: parseInt(batchForm.second_run_number) || (parseInt(batchForm.run_number) + 1),
                    batch_code_display: batchForm.second_batch_code_display,
                    product_type: batchForm.second_product_type || 'huevo entero',
                    presentation: Array.isArray(batchForm.second_presentations) && batchForm.second_presentations.length > 0
                        ? batchForm.second_presentations.join(', ')
                        : (batchForm.second_presentation || 'cubeta 30LB')
                });
            }

            await axios.post('/api/egg-industrial/batches', {
                ...batchForm,
                parent_batch_id: batchForm.parent_batch_id || undefined,
                is_coproduct: Boolean(batchForm.is_coproduct || batchForm.parent_batch_id),
                presentation: resolvedPres,
                run_number: parseInt(batchForm.run_number) || 1,
                raw_materials: batchForm.raw_materials,
                remanente_ids: batchForm.remanente_ids || [],
                ingredients: batchForm.ingredients,
                bypass_cip_check: shouldBypass,
                cip_exception_reason: exceptionReason,
                secondary_batches: secBatchesList.length > 0 ? secBatchesList : undefined,
                secondary_batch: secBatchesList[0] || undefined
            });
            toast.success(shouldBypass
                ? 'Lote de producción iniciado bajo excepción de sanitización.'
                : (secBatchesList.length > 0
                    ? `Lotes de producción iniciados con éxito (${1 + secBatchesList.length} lotes con materia prima compartida).`
                    : (batchForm.is_coproduct ? 'Segundo lote / co-producto iniciado exitosamente.' : 'Lote de producción iniciado exitosamente.')));
            setSelectedScheduledProd(null);
            fetchScheduledProductions();
            setBatchForm({
                product_type: 'huevo entero',
                presentation: 'cubeta 30LB',
                presentations: ['cubeta 30LB'],
                run_number: 1,
                scheduled_production_id: null,
                parent_batch_id: null,
                is_coproduct: false,
                enable_secondary_batch: false,
                secondary_batches: [],
                second_run_number: 2,
                second_batch_code_display: '',
                second_product_type: 'huevo entero',
                second_presentation: 'cubeta 30LB',
                second_presentations: ['cubeta 30LB'],
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

            if (!haccp_compliant && deviation_description) {
                toast.warning(`Parámetros registrados con observación: ${deviation_description}. El lote pasó a estado pasteurizado; Control de Calidad dictaminará la liberación.`, { duration: 8000 });
            } else {
                toast.success('Monitoreo de pasteurización registrado correctamente. El lote pasó a estado pasteurizado.');
            }
            setSelectedBatchForPasteurize('');
            setIsPasteurizeModalOpen(false);
            setHaccpViolationAlert(null);
            fetchData();
        } catch (error) {
            console.error('Error validating pasteurization HACCP:', error);
            toast.error(error.response?.data?.message || 'Error al guardar control de pasteurización.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasteurizeDual = async (primaryBatchId, secondaryBatchId) => {
        setIsSubmitting(true);
        setHaccpViolationAlert(null);
        try {
            const res1 = await axios.post('/api/egg-industrial/pasteurize', {
                batch_id: parseInt(primaryBatchId),
                temperature_c: parseFloat(pasteurizeForm.temperature_c),
                holding_time_seconds: parseInt(pasteurizeForm.holding_time_seconds),
                pressure_psi: parseFloat(pasteurizeForm.pressure_psi),
                flow_rate_gpm: parseFloat(pasteurizeForm.flow_rate_gpm),
                operator_name: pasteurizeForm.operator_name,
                pasteurization_lot: pasteurizeForm.pasteurization_lot
            });

            const res2 = await axios.post('/api/egg-industrial/pasteurize', {
                batch_id: parseInt(secondaryBatchId),
                temperature_c: parseFloat(secondPasteurizeForm.temperature_c),
                holding_time_seconds: parseInt(secondPasteurizeForm.holding_time_seconds),
                pressure_psi: parseFloat(secondPasteurizeForm.pressure_psi),
                flow_rate_gpm: parseFloat(secondPasteurizeForm.flow_rate_gpm),
                operator_name: secondPasteurizeForm.operator_name,
                pasteurization_lot: secondPasteurizeForm.pasteurization_lot
            });

            const fail1 = !res1.data.haccp_compliant;
            const fail2 = !res2.data.haccp_compliant;

            if (fail1 || fail2) {
                const msg = [fail1 ? `Lote Principal: ${res1.data.deviation_description}` : null, fail2 ? `Segundo Lote: ${res2.data.deviation_description}` : null].filter(Boolean).join(' | ');
                setHaccpViolationAlert(msg);
                toast.error('ALERTA HACCP: Se detectó desviación en al menos uno de los lotes.', { duration: 10000 });
            } else {
                toast.success('Monitoreo HACCP validado para ambos lotes con éxito.');
                setSelectedBatchForPasteurize('');
                setIsPasteurizeModalOpen(false);
            }
            fetchData();
        } catch (error) {
            console.error('Error in dual pasteurization:', error);
            toast.error(error.response?.data?.message || 'Error al guardar pasteurización dual.');
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
            const res = await axios.put(`/api/egg-industrial/batches/${batchToUpdate.id}/complete`, {
                yield_liquid_lbs: parseFloat(completeForm.yield_liquid_lbs),
                waste_shell_lbs: parseFloat(completeForm.waste_shell_lbs || 0),
                waste_loss_lbs: parseFloat(completeForm.waste_loss_lbs || 0),
                supervisor_password: completeForm.supervisor_password || undefined
            });
            toast.success(res.data?.message || 'Balance de masas registrado y actualizado correctamente.');
            setSelectedBatchForComplete(null);
            setCompleteForm({ yield_liquid_lbs: '', waste_shell_lbs: '', waste_loss_lbs: '', supervisor_password: '' });
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

    const filteredBatches = (Array.isArray(batches) ? batches : []).filter(b => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (b.batch_code_display && b.batch_code_display.toLowerCase().includes(term)) ||
            (b.batch_uuid && b.batch_uuid.toLowerCase().includes(term)) ||
            (b.product_type && b.product_type.toLowerCase().includes(term)) ||
            (b.presentation && b.presentation.toLowerCase().includes(term))
        );
    });


 return { getNowDateTimeLocal, user, navigate, location, companyId, scheduledProductions, setScheduledProductions, selectedScheduledProd, setSelectedScheduledProd, scannerModalOpen, setScannerModalOpen, tarimaPickerModal, setTarimaPickerModal, tarimaSearchPickerOpen, setTarimaSearchPickerOpen, qualityModal, setQualityModal, batches, setBatches, rawMaterials, setRawMaterials, availableRemanentes, setAvailableRemanentes, showAllRemanentes, setShowAllRemanentes, openExportMenuId, setOpenExportMenuId, cipLogs, setCipLogs, loading, setLoading, searchTerm, setSearchTerm, activeTab, setActiveTab, batchForm, setBatchForm, cipForm, setCipForm, selectedBatchForPasteurize, setSelectedBatchForPasteurize, pasteurizeForm, setPasteurizeForm, secondPasteurizeForm, setSecondPasteurizeForm, selectedBatchForComplete, setSelectedBatchForComplete, completeForm, setCompleteForm, isSubmitting, setIsSubmitting, cipBlockedError, setCipBlockedError, haccpViolationAlert, setHaccpViolationAlert, isNewBatchModalOpen, setIsNewBatchModalOpen, isPasteurizeModalOpen, setIsPasteurizeModalOpen, productConfig, setProductConfig, userPermissions, isAdmin, canEditProduction, canDeleteProduction, canManageLots, stagesModal, setStagesModal, closePasteurizationModal, setClosePasteurizationModal, scannerContext, setScannerContext, editingBatch, setEditingBatch, addTarimasModal, setAddTarimasModal, remanenteModal, setRemanenteModal, wastesModal, setWastesModal, editBatchModal, setEditBatchModal, deleteConfirmBatch, setDeleteConfirmBatch, handleOpenStagesModal, handleOpenClosePasteurization, handleConfirmClosePasteurization, handleReopenPasteurization, handleReopenBatchPackaging, handleOpenBalanceModal, handleOpenWastesModal, handleOpenEditWaste, handleCreateWaste, handleDeleteWaste, handleOpenEditRemanente, handleDeleteRemanente, handleOpenEditBatch, handleMarkRemanenteUsed, handleReactivateRemanente, handleAddSpecificTarimaToAddModal, handleLoadAllAvailableTarimasToAddModal, handleUpdateTarimaBoxesInAddModal, handleUpdateTarimaLbsInAddModal, handleRemoveTarimaFromAddModal, handleManualTarimaDigitize, handleAddTarimasSubmit, handleRemanenteSubmit, _handleEditBatchSubmit, handleDeleteBatchConfirm, handleExportSummary, fetchData, fetchScheduledProductions, handleSelectScheduledProduction, handleCreateCoproductBatch, handleAddSpecificTarimaToRm, handleLoadAllAvailableTarimas, handleUpdateTarimaBoxesInRm, handleUpdateTarimaLbsInRm, handleRemoveTarimaFromRm, handleScanTarimaResult, isSeparationProduct, availableRawLots, oldestFifoLot, oldestAALot, isCurrentSeparation, recommendedLot, recommendationReason, nonAALotSelectedForSeparation, nonAALotObj, handleApplyRecommendedLot, handleCreateBatch, handleQuickSanitize, handleCreateCip, handleDeleteCip, handlePasteurize, handlePasteurizeDual, handleCompleteBatch, getBatchStatusBadge, filteredBatches, handleAddSecondaryBatch, handleRemoveSecondaryBatch, handleUpdateSecondaryBatch };
}
