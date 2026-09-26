import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import {
    Plus,
    Barcode,
    QrCode,
    Calendar,
    User,
    Snowflake,
    Boxes,
    Search,
    Printer,
    Pencil,
    Trash2,
    Lock,
    Scale,
    CheckCircle2,
    FlaskConical
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import {
    EggNewPackagingModal,
    EggLabelPreviewModal,
    EggFreezerModal,
    EggEditPackagingModal,
    EggCloseBatchModal
} from '../../components/egg/packaging';
import { EggQualityFinishedProductModal } from '../../components/egg/quality';

const EggPackaging = () => {
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
        operator_name: user?.nombre || ''
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
            const [pkgRes, bRes, fRes, cfgRes] = await Promise.all([
                axios.get('/api/egg-industrial/packaging'),
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/blast-freezer'),
                axios.get('/api/egg-industrial/product-config')
            ]);
            setPackagingRecords(pkgRes.data);
            setBatches(bRes.data);
            setFreezerLogs(fRes.data);
            setProductConfig(cfgRes.data);
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

        if (availableLbs > 0 && totalWeight > availableLbs + 0.1) {
            toast.warning(`Atención: El peso total (${totalWeight.toFixed(1)} Lbs) excede el disponible del lote (${availableLbs.toFixed(1)} Lbs).`);
        }

        setIsSubmitting(true);
        try {
            const res = await axios.post('/api/egg-industrial/packaging', {
                batch_id: parseInt(packagingForm.batch_id),
                product_type: packagingForm.product_type,
                items: validItems,
                units_packaged: validItems.reduce((s, it) => s + parseInt(it.units_packaged), 0),
                presentation: validItems.map(it => it.presentation).join(', '),
                weight_per_unit_lbs: validItems[0]?.weight_per_unit_lbs || 30.00,
                product_state: packagingForm.product_state,
                warehouse_zone: packagingForm.warehouse_zone,
                shelf_life_days: packagingForm.product_state === 'congelado' ? 365 : 28,
                operator_name: packagingForm.operator_name
            });
            toast.success(`Registro de empaque envasado con éxito (${res.data.records?.length || validItems.length} presentación(es)).`);
            setIsNewPackagingModalOpen(false);
            setPackagingForm({
                batch_id: '',
                product_type: 'huevo entero',
                items: [{ presentation: 'cubeta 30LB', units_packaged: '', weight_per_unit_lbs: '30.00' }],
                product_state: 'líquido',
                warehouse_zone: 'COOLER',
                operator_name: user?.nombre || ''
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

    const filteredPackaging = packagingRecords.filter(p =>
        p.lot_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.product_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.presentation?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                reopen_packaging: packagingForm.reopen_packaging
            });
            toast.success('Empaque actualizado correctamente.');
            setIsEditModalOpen(false);
            setEditingPackaging(null);
            setPackagingForm({ batch_id: '', units_packaged: '', weight_per_unit_lbs: '32.00', operator_name: user?.nombre || '' });
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

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-600">
                        <Barcode className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Empaque Final y Túnel de Congelación</h1>
                        <p className="text-xs text-slate-500 font-medium">Impresión de etiquetas GS1/QR, inocuidad de envasado y monitoreo de congelación ultra-rápida (Blast Freezer)</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setIsNewPackagingModalOpen(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Plus size={14} />
                        Registrar Envasado
                    </button>
                    <button
                        onClick={() => setIsFreezerModalOpen(true)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Snowflake size={14} />
                        Blast Freezer
                    </button>
                </div>
            </div>

            {/* HISTORIAL DE LOTES EMPACADOS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-indigo-600" />
                        Historial de Unidades Empacadas
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

                {/* Stock de Producto Terminado */}
                {batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado').length > 0 && (() => {
                    const stockByProduct = {};
                    batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado').forEach(b => {
                        const key = b.product_type || 'otro';
                        if (!stockByProduct[key]) stockByProduct[key] = 0;
                        stockByProduct[key] += Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0));
                    });
                    const entries = Object.entries(stockByProduct);
                    return (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                            {entries.map(([product, lbs]) => (
                                <div key={product} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">{product}</span>
                                    <span className={`text-sm font-bold ${lbs > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                                        {lbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} Lbs
                                    </span>
                                    <span className="text-[9px] text-slate-400 block font-medium">disponible</span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* Control de Lotes en Etapa de Envasado (Cerrar / Reabrir) */}
                {batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad').length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                        <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Boxes size={14} className="text-purple-600" />
                                Lotes en Etapa de Envasado ({batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad').length})
                            </h3>
                            <span className="text-[10px] text-slate-500 font-medium">
                                Control de cierre técnico y reapertura de empaque
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-white text-slate-500 font-bold uppercase text-[10px]">
                                        <th className="px-3 py-2">Lote</th>
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2 text-right">Rendimiento Líq.</th>
                                        <th className="px-3 py-2 text-right">Envasado</th>
                                        <th className="px-3 py-2 text-right">Saldo Disp.</th>
                                        <th className="px-3 py-2 text-center">Estado Empaque</th>
                                        <th className="px-3 py-2 text-center">Calidad FQ/MB</th>
                                        <th className="px-3 py-2 text-center">Eficiencia</th>
                                        <th className="px-3 py-2 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                                    {batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad').map(b => {
                                        const packaged = parseFloat(b.packaged_weight_lbs || 0);
                                        const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
                                        const pending = Math.max(0, yieldLbs - packaged);
                                        const isClosed = b.packaging_status === 'cerrado';

                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 font-mono font-bold text-slate-900">
                                                    {b.batch_code_display || b.batch_uuid}
                                                </td>
                                                <td className="px-3 py-2 capitalize font-medium text-slate-700">
                                                    {b.product_type}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-teal-700">
                                                    {yieldLbs.toLocaleString()} Lbs
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-indigo-700">
                                                    {packaged.toLocaleString()} Lbs
                                                </td>
                                                <td className="px-3 py-2 text-right font-black">
                                                    <span className={pending > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                                        {pending.toLocaleString()} Lbs
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        isClosed 
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {isClosed ? 'Cerrado' : 'Abierto'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQualityModal({ isOpen: true, batch: b })}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                            b.status === 'aprobado_calidad'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : b.status === 'bloqueado_haccp'
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}
                                                        title="Ver o evaluar control de calidad FQ / MB"
                                                    >
                                                        {b.status === 'aprobado_calidad' ? 'Liberado' : b.status === 'bloqueado_haccp' ? 'Bloqueado' : 'Cuarentena'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 text-center font-bold text-slate-700">
                                                    {b.packaging_efficiency_pct ? `${b.packaging_efficiency_pct}%` : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {!isClosed ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPackagingForm(prev => ({
                                                                            ...prev,
                                                                            batch_id: String(b.id),
                                                                            product_type: (b.product_type || 'huevo entero').toLowerCase()
                                                                        }));
                                                                        setIsNewPackagingModalOpen(true);
                                                                    }}
                                                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                >
                                                                    <Plus size={11} />
                                                                    Envasar
                                                                </button>
                                                                {canClosePackaging && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCloseBatchModal({ isOpen: true, batch: b, notes: '', isSubmitting: false })}
                                                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                        title="Cerrar Envasado y Computar Mermas Técnicas"
                                                                    >
                                                                        <Lock size={11} />
                                                                        Cerrar
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenBatchPackaging(b)}
                                                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                title="Reabrir Envasado para agregar más cubetas o corregir"
                                                            >
                                                                <Lock size={11} className="text-purple-600" />
                                                                Reabrir
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="h-px bg-slate-100" />

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-medium animate-pulse">
                            Cargando empaques finalizados...
                        </div>
                    ) : filteredPackaging.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-medium">
                            No se han registrado envasados todavía.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="p-3">Código Lote / Barra</th>
                                    <th className="p-3">Producto</th>
                                    <th className="p-3">Presentación</th>
                                    <th className="p-3">Estado / Zona</th>
                                    <th className="p-3 text-right">Cant. Envasada</th>
                                    <th className="p-3 text-right">Peso Total</th>
                                    <th className="p-3 text-center">Calidad FQ/MB</th>
                                    <th className="p-3">Vencimiento</th>
                                    <th className="p-3">Operador</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {filteredPackaging.map(p => {
                                    const relatedBatch = batches.find(b => b.id === p.batch_id);
                                    const qStatus = p.quality_status || (relatedBatch?.status === 'aprobado_calidad' ? 'liberado' : relatedBatch?.status === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'cuarentena');
                                    return (
                                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-900 text-xs">{p.lot_code}</span>
                                                <span className="text-[10px] text-indigo-600 font-medium tracking-wide flex items-center gap-1">
                                                    <Barcode size={11} />
                                                    {p.barcode}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 font-bold text-slate-900 capitalize text-xs">{p.product_type}</td>
                                        <td className="p-3 font-medium text-slate-600 text-xs">{p.presentation}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit flex items-center gap-1 ${
                                                    p.product_state === 'congelado' 
                                                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' 
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {p.product_state === 'congelado' && <Snowflake size={10} />}
                                                    {p.product_state || 'líquido'}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    Zona: <span className="text-slate-800 font-bold">{p.warehouse_zone || 'COOLER'}</span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right text-slate-900 font-bold text-xs">{p.units_packaged} Uds</td>
                                        <td className="p-3 text-right text-teal-700 font-bold text-xs">
                                            {parseFloat(p.total_batch_weight_lbs).toLocaleString()} Lbs
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setQualityModal({
                                                    isOpen: true,
                                                    batch: relatedBatch || {
                                                        id: p.batch_id,
                                                        batch_uuid: p.lot_code,
                                                        batch_code_display: p.lot_code,
                                                        product_type: p.product_type,
                                                        status: qStatus === 'liberado' ? 'aprobado_calidad' : qStatus === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'empaquetado'
                                                    }
                                                })}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                    qStatus === 'liberado'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : qStatus === 'bloqueado_haccp'
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}
                                                title="Ver o evaluar control de calidad FQ / MB"
                                            >
                                                {qStatus === 'liberado' ? 'Liberado' : qStatus === 'bloqueado_haccp' ? 'Bloqueado' : 'Cuarentena'}
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-slate-600 flex items-center gap-1 text-xs font-medium">
                                                <Calendar size={12} className="text-slate-400" />
                                                {formatDate(p.expiry_date)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600">
                                            <span className="flex items-center gap-1 text-xs font-medium">
                                                <User size={12} className="text-slate-400" />
                                                {p.operator_name}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setQualityModal({
                                                        isOpen: true,
                                                        batch: relatedBatch || {
                                                            id: p.batch_id,
                                                            batch_uuid: p.lot_code,
                                                            batch_code_display: p.lot_code,
                                                            product_type: p.product_type,
                                                            status: qStatus === 'liberado' ? 'aprobado_calidad' : qStatus === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'empaquetado'
                                                        }
                                                    })}
                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
                                                    title="Calidad FQ / MB (LAB-004)"
                                                >
                                                    <FlaskConical size={12} />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedLabel(p)}
                                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                    title="Ver Etiqueta QR"
                                                >
                                                    <QrCode size={11} />
                                                    QR
                                                </button>
                                                <button
                                                    onClick={() => handlePrintLabel(p)}
                                                    className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 transition-colors"
                                                    title="Imprimir Etiqueta PDF"
                                                >
                                                    <Printer size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(p)}
                                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                {canEditLots && batches.find(b => b.id === p.batch_id)?.packaging_status === 'cerrado' && (
                                                    <button
                                                        onClick={() => handleReopenBatchPackaging(batches.find(b => b.id === p.batch_id))}
                                                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors"
                                                        title="Reabrir Envasado de este Lote"
                                                    >
                                                        <Lock size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(p.id)}
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <EggNewPackagingModal
                isOpen={isNewPackagingModalOpen}
                onClose={() => setIsNewPackagingModalOpen(false)}
                packagingForm={packagingForm}
                setPackagingForm={setPackagingForm}
                batches={batches}
                isSubmitting={isSubmitting}
                onSubmit={handleCreatePackaging}
                onOpenCloseBatch={(b) => setCloseBatchModal({ isOpen: true, batch: b, notes: '', isSubmitting: false })}
                onReopenPackaging={handleReopenBatchPackaging}
                canClosePackaging={canClosePackaging}
            />

            <EggLabelPreviewModal
                isOpen={!!selectedLabel}
                onClose={() => setSelectedLabel(null)}
                label={selectedLabel}
                onPrint={handlePrintLabel}
            />

            <EggFreezerModal
                isOpen={isFreezerModalOpen}
                onClose={() => setIsFreezerModalOpen(false)}
                freezerForm={freezerForm}
                setFreezerForm={setFreezerForm}
                onSubmit={handleCreateFreezerLog}
                isSubmitting={isSubmitting}
                packagingRecords={packagingRecords}
                freezerLogs={freezerLogs}
                onDeleteFreezerLog={handleDeleteFreezerLog}
                getFreezerStatusBadge={getFreezerStatusBadge}
            />

            <EggEditPackagingModal
                isOpen={isEditModalOpen && !!editingPackaging}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingPackaging(null);
                }}
                packaging={editingPackaging}
                packagingForm={packagingForm}
                setPackagingForm={setPackagingForm}
                onSubmit={handleEditSubmit}
                isSubmitting={isSubmitting}
                canEditLots={canEditLots}
                batches={batches}
                onReopenPackaging={handleReopenBatchPackaging}
            />

            <EggCloseBatchModal
                isOpen={closeBatchModal.isOpen && !!closeBatchModal.batch}
                onClose={() => setCloseBatchModal({ isOpen: false, batch: null, notes: '', isSubmitting: false })}
                batch={closeBatchModal.batch}
                notes={closeBatchModal.notes}
                onNotesChange={(val) => setCloseBatchModal(prev => ({ ...prev, notes: val }))}
                onSubmit={handleCloseBatchPackaging}
                isSubmitting={closeBatchModal.isSubmitting}
            />

            <EggQualityFinishedProductModal
                open={qualityModal.isOpen}
                onClose={() => setQualityModal({ isOpen: false, batch: null })}
                batch={qualityModal.batch}
                onSuccess={fetchData}
            />
        </div>
    );
};

export default EggPackaging;
