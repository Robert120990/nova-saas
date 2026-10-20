import axios from 'axios';
import { toast } from 'sonner';
import { getTodayString } from '../../../utils/dateUtils';
import { generateJulianLotCode } from '../../../utils/julianDate';
import { getDefaultPresentationForProduct } from '../../../utils/eggPresentationUtils';
import { recalculateMixFormula } from './eggCalendarConstants';

export default function useEggCalendarActions({
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
}) {
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
                presentation: defaultRunData.presentation || getDefaultPresentationForProduct(defaultRunData.product_profile || 'Huevo Entero Pasteurizado'),
                target_quantity_lbs: targetQty,
                target_solids_pct: defaultRunData.target_solids_pct || 22.5,
                status: 'programado',
                priority: defaultRunData.priority || 'alta',
                mix_formula_json: defaultRunData.mix_formula_json || recalculateMixFormula(defaultRunData.product_profile, targetQty),
                assigned_operator_id: '',
                assigned_operator_name: '',
                notes: defaultRunData.notes || '',
                tasks: (defaultRunData.tasks || []).map((t) => ({
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

    const handleOpenEditModal = (prod) => {
        const rootProd = prod.parent_production_id
            ? ((Array.isArray(productions) ? productions : []).find((p) => p.id === prod.parent_production_id) || prod)
            : prod;

        const companions = (Array.isArray(productions) ? productions : []).filter(
            (p) => p.id !== rootProd.id && (p.parent_production_id === rootProd.id || (rootProd.parent_production_id && p.parent_production_id === rootProd.parent_production_id))
        );
        const mappedSec = companions.map((c) => ({
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

    const handleAddSecondaryLot = () => {
        const count = (formData.secondary_lots || []).length;
        const nextIdx = count + 2;
        const nextLot = generateJulianLotCode(formData.production_date, nextIdx, julianFormat);
        const defaultProfiles = ['Clara de Huevo Pasteurizada', 'Yema Azucarada', 'Yema Salada', 'Huevo Entero Pasteurizado', 'Huevo Rápido'];
        const prof = defaultProfiles[count % defaultProfiles.length] || 'Clara de Huevo Pasteurizada';
        const defaultPres = getDefaultPresentationForProduct(prof);
        setFormData((prev) => ({
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
        setFormData((prev) => {
            const updated = (prev.secondary_lots || []).filter((_, i) => i !== idx);
            return { ...prev, enable_secondary_batch: updated.length > 0, secondary_lots: updated };
        });
    };

    const handleUpdateSecondaryLot = (idx, field, value) => {
        setFormData((prev) => {
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

    const handleProfileChange = (newProfile) => {
        const profLower = (newProfile || '').toLowerCase();
        let targetQty = formData.target_quantity_lbs;
        if ((profLower.includes('clara') || profLower.includes('separaci')) && targetQty === 12000) {
            targetQty = separationBatchLbs || 6000;
        } else if ((profLower.includes('entero') || profLower.includes('rapido') || profLower.includes('rápido')) && targetQty === (separationBatchLbs || 6000)) {
            targetQty = 12000;
        }
        const newMix = recalculateMixFormula(newProfile, targetQty);
        const defaultPres = getDefaultPresentationForProduct(newProfile);
        setFormData((prev) => ({
            ...prev,
            product_profile: newProfile,
            presentation: defaultPres,
            target_quantity_lbs: targetQty,
            target_solids_pct: newMix.target_solids_pct,
            mix_formula_json: newMix
        }));
    };

    const handleQuantityChange = (newQty) => {
        const val = parseFloat(newQty) || 0;
        const newMix = recalculateMixFormula(formData.product_profile, val);
        setFormData((prev) => ({ ...prev, target_quantity_lbs: val, mix_formula_json: newMix }));
    };

    const handleAddTask = () => {
        if (!newTaskDesc || newTaskDesc.trim() === '') {
            return toast.warning('Escriba la descripción de la tarea.');
        }
        const userObj = factoryUsers.find((u) => String(u.id) === String(newTaskUser));
        const taskItem = {
            user_id: userObj ? userObj.id : null,
            user_name: userObj ? userObj.nombre : 'Operario de Planta',
            factory_role: newTaskRole,
            task_description: newTaskDesc.trim(),
            checklist_status: 'pendiente'
        };
        setFormData((prev) => ({ ...prev, tasks: [...prev.tasks, taskItem] }));
        setNewTaskDesc('');
    };

    const handleRemoveTask = (idx) => {
        setFormData((prev) => ({ ...prev, tasks: prev.tasks.filter((_, i) => i !== idx) }));
    };

    const handleSaveProduction = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const secLots = formData.secondary_lots || [];
            const secProductionsPayload = secLots.map((sl) => ({
                id: (sl.id && !String(sl.id).startsWith('sec-')) ? sl.id : null,
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
                secondary_lots: secProductionsPayload,
                secondary_productions: secProductionsPayload,
                secondary_production: secProductionsPayload[0] || null
            };

            if (formData.id) {
                await axios.put(`/api/egg-industrial/calendar/${formData.id}`, payload);
                toast.success(secLots.length > 0 ? `Producción multi-lote (${1 + secLots.length} lotes) actualizada exitosamente.` : 'Producción actualizada exitosamente.');
            } else {
                await axios.post('/api/egg-industrial/calendar', payload);
                toast.success(secLots.length > 0 ? `Producción multi-lote (${1 + secLots.length} lotes vinculados) programada exitosamente.` : 'Producción programada exitosamente.');
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

    const handleDeleteProduction = async (id, lotCode) => {
        if (!window.confirm(`¿Está seguro de eliminar la producción programada ${lotCode}?`)) return;
        try {
            await axios.delete(`/api/egg-industrial/calendar/${id}`);
            toast.success(`Producción ${lotCode} eliminada.`);
            fetchProductions();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al eliminar producción.');
        }
    };

    const handleToggleTask = async (taskId) => {
        try {
            await axios.patch(`/api/egg-industrial/calendar/tasks/${taskId}/toggle`);
            setProductions((prev) => prev.map((p) => ({
                ...p,
                tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, checklist_status: t.checklist_status === 'completado' ? 'pendiente' : 'completado' } : t))
            })));
            toast.success('Estado de tarea actualizado.');
        } catch {
            toast.error('Error al actualizar tarea.');
        }
    };

    const handleDragStart = (e, prod) => {
        setDraggedItem(prod);
        e.dataTransfer.setData('text/plain', String(prod.id));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, dateStr) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverDate !== dateStr) setDragOverDate(dateStr);
    };

    const handleDragLeave = () => setDragOverDate(null);

    const handleDrop = async (e, targetDateStr) => {
        e.preventDefault();
        setDragOverDate(null);
        if (!draggedItem) return;
        const originalDate = draggedItem.production_date ? getTodayString(new Date(draggedItem.production_date)) : '';
        if (originalDate === targetDateStr) {
            setDraggedItem(null);
            return;
        }
        const updatedItem = { ...draggedItem, production_date: targetDateStr };
        setProductions((prev) => prev.map((p) => (p.id === draggedItem.id ? updatedItem : p)));
        try {
            await axios.patch(`/api/egg-industrial/calendar/${draggedItem.id}/move`, { production_date: targetDateStr });
            toast.success(`Lote ${draggedItem.lot_code} reprogramado al ${targetDateStr}`);
        } catch {
            toast.error('Error al reprogramar la fecha de producción.');
            fetchProductions();
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
        } catch {
            toast.error('Error al eliminar pedido.');
        }
    };

    const handleOpenAlterDateModal = (type, item) => {
        const currentDateStr = type === 'production'
            ? (item.production_date ? item.production_date.split('T')[0] : '')
            : (item.required_delivery_date ? item.required_delivery_date.split('T')[0] : '');
        const title = type === 'production'
            ? `Producción Lote ${item.lot_code} (${item.product_profile})`
            : `Pedido de ${item.customer_name} (${item.product_type} - ${parseFloat(item.quantity_lbs || 0).toLocaleString()} Lbs)`;
        setAlterDateItem({ type, id: item.id, item, title, currentDate: currentDateStr });
        setNewAlteredDate(currentDateStr || getTodayString(new Date()));
    };

    const handleSaveAlteredDate = async (e) => {
        if (e) e.preventDefault();
        if (!alterDateItem || !newAlteredDate) return;
        try {
            setIsAlteringDate(true);
            if (alterDateItem.type === 'production') {
                await axios.patch(`/api/egg-industrial/calendar/${alterDateItem.id}`, { production_date: newAlteredDate });
                toast.success('Fecha de producción reprogramada exitosamente.');
                fetchProductions();
            } else {
                await axios.put(`/api/egg-industrial/orders/${alterDateItem.id}`, { ...alterDateItem.item, required_delivery_date: newAlteredDate });
                toast.success('Fecha de entrega de pedido reprogramada exitosamente.');
                fetchOrders();
                fetchSuggestions();
            }
            setAlterDateItem(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al reprogramar fecha.');
        } finally {
            setIsAlteringDate(false);
        }
    };

    return {
        handleOpenCreateModal,
        handleOpenEditModal,
        handleAddSecondaryLot,
        handleRemoveSecondaryLot,
        handleUpdateSecondaryLot,
        handleProfileChange,
        handleQuantityChange,
        handleAddTask,
        handleRemoveTask,
        handleSaveProduction,
        handleDeleteProduction,
        handleToggleTask,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDeleteOrder,
        handleOpenAlterDateModal,
        handleSaveAlteredDate
    };
}
