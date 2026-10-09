import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';


import { formatDate } from '../../../utils/dateUtils';



export default function usePackagingModel() {
    const { user } = useAuth();
    const confirm = useConfirm();
    const companyId = user?.company_id || 1;

    // Lists
    const [packagingRecords, setPackagingRecords] = useState([]);
    const [batches, setBatches] = useState([]);
    const [freezerLogs, setFreezerLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Tab state
    const [isNewPackagingModalOpen, setIsNewPackagingModalOpen] = useState(false);
    const [isFreezerModalOpen, setIsFreezerModalOpen] = useState(false);
    const [_productConfig, setProductConfig] = useState([]);
    const [catalogProducts, setCatalogProducts] = useState([]);
    const [codeMappings, setCodeMappings] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState(null);

    // Form states
    const [packagingForm, setPackagingForm] = useState({
        batch_id: '',
        product_type: 'huevo entero',
        items: [
            { presentation: 'cubeta 30LB', units_packaged: '', weight_per_unit_lbs: '30.00' }
        ],
        product_state: 'líquido', // 'líquido' (28 días) o 'congelado' (365 días)
        warehouse_zone: 'COOLER', // 'COOLER', 'BLAST', 'HOLDING'
        operator_name: user?.nombre || '',
        packaging_start_time: '',
        packaging_end_time: ''
    });

    const [freezerForm, setFreezerForm] = useState({
        packaging_id: '',
        freezer_location: 'Túnel A - Posición 1',
        core_temperature_c: '-18.5',
        freezing_duration_hours: '4.0',
        status: 'congelando'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState(null); // Label modal state
    const [qualityModal, setQualityModal] = useState({ isOpen: false, batch: null });

    // Role & Permisos (Página 4 del documento)
    const userPermissions = Array.isArray(user?.permissions)
        ? user.permissions
        : (typeof user?.permissions === 'string' ? JSON.parse(user?.permissions || '[]') : []);
    const isAdmin = user?.role === 'SuperAdmin' || user?.role === 'Admin' || user?.role_id <= 2;
    const canClosePackaging = isAdmin || userPermissions.includes('manage_egg_packaging_close') || userPermissions.includes('manage_egg_production_lots');
    const canEditLots = isAdmin || userPermissions.includes('manage_egg_production_lots');

    // Estado del modal de Cierre Técnico de Envasado
    const [closeBatchModal, setCloseBatchModal] = useState({
        isOpen: false,
        batch: null,
        notes: '',
        isSubmitting: false
    });

    const handleCloseBatchPackaging = async (e) => {
        e?.preventDefault();
        if (!closeBatchModal.batch) return;
        setCloseBatchModal(prev => ({ ...prev, isSubmitting: true }));
        try {
            const res = await axios.post(`/api/egg-industrial/batches/${closeBatchModal.batch.id}/close-packaging`, {
                notes: closeBatchModal.notes
            });
            toast.success(res.data?.message || 'Lote cerrado con cálculo de eficiencia y merma.');
            setCloseBatchModal({ isOpen: false, batch: null, notes: '', isSubmitting: false });
            fetchData();
        } catch (error) {
            console.error('Error cerrando lote:', error);
            toast.error(error.response?.data?.message || 'Error al cerrar el envasado del lote.');
            setCloseBatchModal(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const handleReopenBatchPackaging = async (batch) => {
        if (!batch) return;
        const confirmed = await confirm({
            title: 'Reabrir Envasado de Lote',
            message: `¿Estás seguro de volver a abrir el envasado para el lote ${batch.batch_code_display || batch.batch_uuid || batch.id}? Se cancelará el cierre técnico y se revertirá el estado a disponible.`,
            confirmText: 'Reabrir Envasado',
            confirmColor: 'amber'
        });
        if (!confirmed) return;

        try {
            const res = await axios.post(`/api/egg-industrial/batches/${batch.id}/reopen-packaging`);
            toast.success(res.data?.message || 'Envasado reabierto con éxito.');
            fetchData();
        } catch (error) {
            console.error('Error reabriendo envasado:', error);
            toast.error(error.response?.data?.message || 'Error al reabrir el envasado del lote.');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pkgRes, bRes, fRes, cfgRes, prodRes, mapRes] = await Promise.all([
                axios.get('/api/egg-industrial/packaging').catch(err => {
                    console.error('Error fetching packaging records:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/batches').catch(err => {
                    console.error('Error fetching batches in packaging:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/blast-freezer').catch(err => {
                    console.error('Error fetching blast freezer logs:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/product-config').catch(err => {
                    console.error('Error fetching product config:', err);
                    return { data: {} };
                }),
                axios.get('/api/egg-industrial/catalog-products').catch(err => {
                    console.error('Error fetching catalog products:', err);
                    return { data: [] };
                }),
                axios.get('/api/egg-industrial/code-mappings').catch(err => {
                    console.error('Error fetching code mappings:', err);
                    return { data: [] };
                })
            ]);
            const pkgList = Array.isArray(pkgRes.data) ? pkgRes.data : (pkgRes.data?.data || []);
            const batchesList = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.data || []);
            const freezerList = Array.isArray(fRes.data) ? fRes.data : (fRes.data?.data || []);
            const cfgData = cfgRes.data?.data || cfgRes.data || {};
            const prodList = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data?.data || []);
            const mapList = Array.isArray(mapRes.data) ? mapRes.data : (mapRes.data?.data || []);

            setPackagingRecords(pkgList);
            setBatches(batchesList);
            setFreezerLogs(freezerList);
            setProductConfig(cfgData);
            setCatalogProducts(prodList);
            setCodeMappings(mapList);
        } catch (error) {
            console.error('Error fetching packaging data:', error);
            toast.error('Error al cargar datos de envasado.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Handle create packaging record (multi-presentation supported)
    const handleCreatePackaging = async (e) => {
        e.preventDefault();

        if (!packagingForm.batch_id) {
            return toast.error('Debe seleccionar un lote de producción.');
        }

        const validItems = (packagingForm.items || []).filter(it => parseInt(it.units_packaged) > 0 && parseFloat(it.weight_per_unit_lbs) > 0);
        if (validItems.length === 0) {
            return toast.error('Debe ingresar al menos una presentación con unidades válidas mayor a cero.');
        }

        const selectedBatchObj = batches.find(b => b.id === parseInt(packagingForm.batch_id));
        if (selectedBatchObj && selectedBatchObj.status === 'bloqueado_haccp') {
            return toast.error('BLOQUEO DE INOCUIDAD: No se puede envasar un lote bloqueado por HACCP.');
        }

        const totalWeight = validItems.reduce((acc, it) => acc + (parseInt(it.units_packaged) * parseFloat(it.weight_per_unit_lbs)), 0);
        const availableLbs = Math.max(0, parseFloat(selectedBatchObj?.yield_liquid_lbs || 0) - parseFloat(selectedBatchObj?.packaged_weight_lbs || 0));

        if (totalWeight > availableLbs + 0.01) {
            return toast.error(`Atención: El peso total (${totalWeight.toFixed(1)} Lbs) excede el disponible del lote (${availableLbs.toFixed(1)} Lbs).`);
        }

        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/egg-industrial/packaging', {
                batch_id: parseInt(packagingForm.batch_id),
                product_type: packagingForm.product_type,
                items: validItems.map(it => ({
                    ...it,
                    product_id: it.product_id || it.catalog_product_id || null
                })),
                units_packaged: validItems.reduce((s, it) => s + parseInt(it.units_packaged), 0),
                presentation: validItems.map(it => it.presentation).join(', '),
                weight_per_unit_lbs: validItems[0]?.weight_per_unit_lbs || 30.00,
                product_state: packagingForm.product_state,
                warehouse_zone: packagingForm.warehouse_zone,
                shelf_life_days: packagingForm.product_state === 'congelado' ? 365 : 28,
                operator_name: packagingForm.operator_name,
                packaging_start_time: packagingForm.packaging_start_time || undefined,
                packaging_end_time: packagingForm.packaging_end_time || undefined
            });
            toast.success(`Registro de empaque envasado con éxito (${res.data.records?.length || validItems.length} presentación(es)).`);
            setIsNewPackagingModalOpen(false);
            setPackagingForm({
                batch_id: '',
                product_type: 'huevo entero',
                items: [{ presentation: 'cubeta 30LB', units_packaged: '', weight_per_unit_lbs: '30.00', product_id: null }],
                product_state: 'líquido',
                warehouse_zone: 'COOLER',
                operator_name: user?.nombre || '',
                packaging_start_time: '',
                packaging_end_time: ''
            });
            fetchData();
        } catch (error) {
            console.error('Error saving packaging record:', error);
            toast.error(error.response?.data?.message || 'Error al registrar el empaque.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete blast freezer log
    const handleDeleteFreezerLog = (id) => {
        confirm({
            title: 'Eliminar de Bitácora Blast Freezer',
            message: '¿Está seguro de eliminar este registro de la bitácora del Blast Freezer?',
            confirmText: 'Eliminar',
            confirmColor: 'rose',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/egg-industrial/blast-freezer/${id}`);
                    toast.success('Registro de Blast Freezer eliminado.');
                    fetchData();
                } catch (error) {
                    console.error('Error al eliminar registro de túnel:', error);
                    toast.error(error.response?.data?.message || 'Error al eliminar registro de túnel.');
                }
            }
        });
    };

    // Handle freezer entry logging
    const handleCreateFreezerLog = async (e) => {
        e.preventDefault();

        if (!freezerForm.packaging_id) {
            return toast.error('Debe seleccionar una etiqueta de empaque.');
        }

        const parsedTemp = parseFloat(freezerForm.core_temperature_c);
        if (parsedTemp > -12.0) {
            toast.warning('ALERTA FRIGORÍFICA: La temperatura en el núcleo es superior a -12°C. Tiempo de congelado extendido.', { duration: 6000 });
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/blast-freezer', {
                packaging_id: parseInt(freezerForm.packaging_id),
                freezer_location: freezerForm.freezer_location,
                core_temperature_c: parsedTemp,
                freezing_duration_hours: parseFloat(freezerForm.freezing_duration_hours),
                status: freezerForm.status
            });
            toast.success('Registro de Blast Freezer guardado.');
            setFreezerForm({
                packaging_id: '',
                freezer_location: 'Túnel A - Posición 1',
                core_temperature_c: '-18.5',
                freezing_duration_hours: '4.0',
                status: 'congelando'
            });
            fetchData();
            setIsFreezerModalOpen(false);
        } catch (error) {
            console.error('Error logging blast freezer entry:', error);
            toast.error('Error al guardar registro en Blast Freezer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper for freezer statuses
    const getFreezerStatusBadge = (status) => {
        switch (status) {
            case 'congelado_ok':
                return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
            case 'alarma_tiempo':
                return 'bg-rose-50 text-rose-700 border border-rose-300';
            case 'congelando':
            default:
                return 'bg-cyan-50 text-cyan-700 border border-cyan-200';
        }
    };

    // Generate and download a real PDF label for physical printing
    const handlePrintLabel = async (p) => {
        try {
            // Crear instancia de jsPDF (etiqueta industrial de 4x4 pulgadas)
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: [4, 4]
            });

            // Margen y fuentes
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('NOVA INDUSTRIAL PLANT', 0.2, 0.3);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('FDA CERTIFIED #98217A', 2.5, 0.3);

            // Línea divisoria
            doc.setLineWidth(0.01);
            doc.line(0.2, 0.35, 3.8, 0.35);

            // Código de Lote GS1
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('CODIGO DE LOTE GS1', 0.2, 0.55);
            doc.setFontSize(11);
            doc.text(p.lot_code, 0.2, 0.75);

            // Línea divisoria
            doc.line(0.2, 0.85, 3.8, 0.85);

            // Datos del Lote
            doc.setFontSize(8);
            doc.text('Producto:', 0.2, 1.05);
            doc.setFont('helvetica', 'bold');
            doc.text(p.product_type.toUpperCase(), 1.2, 1.05);

            doc.setFont('helvetica', 'normal');
            doc.text('Presentacion:', 0.2, 1.25);
            doc.setFont('helvetica', 'bold');
            doc.text(p.presentation.toUpperCase(), 1.2, 1.25);

            doc.setFont('helvetica', 'normal');
            doc.text('Cant. Envasada:', 0.2, 1.45);
            doc.setFont('helvetica', 'bold');
            doc.text(`${p.units_packaged} Unidades`, 1.2, 1.45);

            doc.setFont('helvetica', 'normal');
            doc.text('Peso Total:', 0.2, 1.65);
            doc.setFont('helvetica', 'bold');
            doc.text(`${parseFloat(p.total_batch_weight_lbs).toLocaleString()} Lbs`, 1.2, 1.65);

            doc.setFont('helvetica', 'normal');
            doc.text('F. Empaque:', 0.2, 1.85);
            doc.setFont('helvetica', 'bold');
            doc.text(formatDate(p.created_at), 1.2, 1.85);

            doc.setFont('helvetica', 'normal');
            doc.text('F. Vencimiento:', 0.2, 2.05);
            doc.setFont('helvetica', 'bold');
            doc.text(formatDate(p.expiry_date), 1.2, 2.05);

            // Línea divisoria
            doc.setLineWidth(0.01);
            doc.line(0.2, 2.15, 3.8, 2.15);

            // Código de barras simulado
            doc.setFont('Courier', 'bold');
            doc.setFontSize(10);
            doc.text('|||| | | ||| || ||| || |||', 1.0, 2.35);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(`(${p.barcode})`, 1.5, 2.48);

            // Cargar y pintar código QR real
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(p.qr_code_payload)}`;
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = qrUrl;
            img.onload = () => {
                doc.addImage(img, 'PNG', 1.4, 2.6, 1.2, 1.2);
                doc.setFontSize(6);
                doc.text('ESCANEAR PARA TRAZABILIDAD 360', 1.1, 3.9);
                doc.save(`etiqueta-${p.lot_code}.pdf`);
                toast.success('Etiqueta PDF generada e iniciada la descarga.');
            };
            img.onerror = () => {
                doc.setFontSize(6);
                doc.text('ERROR AL CARGAR QR DE TRAZABILIDAD', 1.1, 3.5);
                doc.save(`etiqueta-${p.lot_code}.pdf`);
                toast.warning('Etiqueta PDF generada sin código QR dinámico.');
            };
        } catch (error) {
            console.error('Error al generar la etiqueta PDF:', error);
            toast.error('Error al generar la etiqueta imprimible.');
        }
    };

    const filteredPackaging = (Array.isArray(packagingRecords) ? packagingRecords : []).filter(p => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (p.lot_code && p.lot_code.toLowerCase().includes(term)) ||
            (p.product_type && p.product_type.toLowerCase().includes(term)) ||
            (p.presentation && p.presentation.toLowerCase().includes(term))
        );
    });

    const handleEdit = (p) => {
        setEditingPackaging(p);
        const relatedBatch = batches.find(b => b.id === p.batch_id);
        setPackagingForm({
            batch_id: String(p.batch_id || ''),
            lot_code: p.lot_code || '',
            product_type: (p.product_type || relatedBatch?.product_type || 'huevo entero').toLowerCase(),
            presentation: p.presentation || relatedBatch?.presentation || 'cubeta 30LB',
            units_packaged: String(p.units_packaged || ''),
            weight_per_unit_lbs: String(p.weight_per_unit_lbs || '32.00'),
            operator_name: p.operator_name || user?.nombre || '',
            packaging_start_time: p.packaging_start_time || '',
            packaging_end_time: p.packaging_end_time || '',
            reopen_packaging: false
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!packagingForm.units_packaged || parseInt(packagingForm.units_packaged) <= 0) {
            return toast.error('La cantidad debe ser mayor a cero.');
        }
        setIsSubmitting(true);
        try {
            const units = parseInt(packagingForm.units_packaged);
            const weight = parseFloat(packagingForm.weight_per_unit_lbs);
            await axios.put(`/api/egg-industrial/packaging/${editingPackaging.id}`, {
                units_packaged: units,
                weight_per_unit_lbs: weight,
                operator_name: packagingForm.operator_name,
                lot_code: packagingForm.lot_code,
                product_type: packagingForm.product_type,
                presentation: packagingForm.presentation,
                batch_id: packagingForm.batch_id ? parseInt(packagingForm.batch_id) : undefined,
                reopen_packaging: packagingForm.reopen_packaging,
                packaging_start_time: packagingForm.packaging_start_time || undefined,
                packaging_end_time: packagingForm.packaging_end_time || undefined
            });
            toast.success('Empaque actualizado correctamente.');
            setIsEditModalOpen(false);
            setEditingPackaging(null);
            setPackagingForm({ batch_id: '', units_packaged: '', weight_per_unit_lbs: '32.00', operator_name: user?.nombre || '', packaging_start_time: '', packaging_end_time: '' });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al actualizar empaque.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (id) => {
        confirm({
            title: 'Confirmar Eliminación',
            message: '¿Eliminar este registro de empaque? Se liberará el stock consumido del lote.',
            confirmText: 'Eliminar',
            confirmColor: 'rose',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/egg-industrial/packaging/${id}`);
                    toast.success('Empaque eliminado.');
                    fetchData();
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Error al eliminar.');
                }
            }
        });
    };


 return { user, confirm, companyId, packagingRecords, setPackagingRecords, batches, setBatches, freezerLogs, setFreezerLogs, loading, setLoading, searchTerm, setSearchTerm, isNewPackagingModalOpen, setIsNewPackagingModalOpen, isFreezerModalOpen, setIsFreezerModalOpen, _productConfig, setProductConfig, catalogProducts, setCatalogProducts, codeMappings, setCodeMappings, isEditModalOpen, setIsEditModalOpen, editingPackaging, setEditingPackaging, packagingForm, setPackagingForm, freezerForm, setFreezerForm, isSubmitting, setIsSubmitting, selectedLabel, setSelectedLabel, qualityModal, setQualityModal, userPermissions, isAdmin, canClosePackaging, canEditLots, closeBatchModal, setCloseBatchModal, handleCloseBatchPackaging, handleReopenBatchPackaging, fetchData, handleCreatePackaging, handleDeleteFreezerLog, handleCreateFreezerLog, getFreezerStatusBadge, handlePrintLabel, filteredPackaging, handleEdit, handleEditSubmit, handleDelete };
}
