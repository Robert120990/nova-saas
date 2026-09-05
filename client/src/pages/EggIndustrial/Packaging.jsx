import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import {
    Activity,
    Plus,
    Barcode,
    QrCode,
    Calendar,
    User,
    Snowflake,
    XCircle,
    Boxes,
    Search,
    Printer,
    Lock,
    Pencil,
    Trash2
} from 'lucide-react';

const EggPackaging = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${h}:${m}`;
    };

    // Lists
    const [packagingRecords, setPackagingRecords] = useState([]);
    const [batches, setBatches] = useState([]);
    const [freezerLogs, setFreezerLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Tab state
    const [isNewPackagingModalOpen, setIsNewPackagingModalOpen] = useState(false);
    const [isFreezerModalOpen, setIsFreezerModalOpen] = useState(false);
    const [productConfig, setProductConfig] = useState([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPackaging, setEditingPackaging] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Form states
    const [packagingForm, setPackagingForm] = useState({
        batch_id: '',
        units_packaged: '',
        presentation: 'cubeta 30LB',
        weight_per_unit_lbs: '30.00',
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

    // Handle create packaging record
    const handleCreatePackaging = async (e) => {
        e.preventDefault();

        if (!packagingForm.batch_id) {
            return toast.error('Debe seleccionar un lote de producción.');
        }
        if (!packagingForm.units_packaged || parseInt(packagingForm.units_packaged) <= 0) {
            return toast.error('La cantidad de unidades debe ser mayor a cero.');
        }

        const selectedBatchObj = batches.find(b => b.id === parseInt(packagingForm.batch_id));
        if (selectedBatchObj && selectedBatchObj.status === 'bloqueado_haccp') {
            return toast.error('BLOQUEO DE INOCUIDAD: No se puede envasar un lote bloqueado por HACCP.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/packaging', {
                batch_id: parseInt(packagingForm.batch_id),
                units_packaged: parseInt(packagingForm.units_packaged),
                presentation: packagingForm.presentation,
                weight_per_unit_lbs: parseFloat(packagingForm.weight_per_unit_lbs),
                product_state: packagingForm.product_state,
                warehouse_zone: packagingForm.warehouse_zone,
                shelf_life_days: packagingForm.product_state === 'congelado' ? 365 : 28,
                operator_name: packagingForm.operator_name
            });
            toast.success('Registro de empaque envasado con éxito.');
            setIsNewPackagingModalOpen(false);
            setPackagingForm({
                batch_id: '',
                units_packaged: '',
                presentation: 'cubeta 30LB',
                weight_per_unit_lbs: '30.00',
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
        setPackagingForm({
            batch_id: String(p.batch_id || ''),
            units_packaged: String(p.units_packaged || ''),
            weight_per_unit_lbs: String(p.weight_per_unit_lbs || '32.00'),
            operator_name: p.operator_name || ''
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
                operator_name: packagingForm.operator_name
            });
            toast.success('Empaque actualizado.');
            setIsEditModalOpen(false);
            setEditingPackaging(null);
            setPackagingForm({ batch_id: '', units_packaged: '', weight_per_unit_lbs: '32.00', operator_name: user?.nombre || '' });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al actualizar.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/packaging/${id}`);
            toast.success('Empaque eliminado.');
            setDeleteConfirmId(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al eliminar.');
        }
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
                                    <th className="p-3">Vencimiento</th>
                                    <th className="p-3">Operador</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {filteredPackaging.map(p => (
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
                                                <button
                                                    onClick={() => setDeleteConfirmId(p.id)}
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isNewPackagingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Plus className="h-5 w-5 text-purple-600" />
                            Registrar Empaque y Envasado de Producto
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Genere la numeración de lote comercial e imprima la etiqueta QR de trazabilidad.</p>
                        <div className="h-px bg-slate-100 mt-4" />
                    </div>

                    <form onSubmit={handleCreatePackaging} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote Pasteurizado Aprobado *</label>
                            <select
                                value={packagingForm.batch_id}
                                onChange={(e) => {
                                    const bid = e.target.value;
                                    const batch = batches.find(b => b.id === parseInt(bid));
                                    const cfg = productConfig.find(c => c.product_type === batch?.product_type);
                                    setPackagingForm({ 
                                        ...packagingForm, 
                                        batch_id: bid, 
                                        weight_per_unit_lbs: cfg ? String(cfg.weight_per_unit_lbs) : '30.00' 
                                    });
                                }}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Seleccione Lote Disponible...</option>
                                {batches.filter(b => {
                                    const allowed = ['pasteurizado', 'aprobado_calidad', 'empaquetado', 'bloqueado_haccp'];
                                    if (!allowed.includes(b.status)) return false;
                                    const disp = parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0);
                                    return disp > 0;
                                }).map(b => (
                                    <option key={b.id} value={b.id} disabled={b.status === 'bloqueado_haccp'}>
                                        [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation}) - Disp: {(parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0)).toFixed(0)} Lbs{b.status === 'bloqueado_haccp' ? ' [BLOQUEADO HACCP]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {packagingForm.batch_id && batches.find(b => b.id === parseInt(packagingForm.batch_id))?.status === 'bloqueado_haccp' && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 flex gap-2 font-bold text-xs">
                                <Lock size={16} className="shrink-0 text-rose-600" />
                                <span>Este lote tiene bloqueo de inocuidad activo. El envasado está inhabilitado hasta su evaluación de calidad.</span>
                            </div>
                        )}

                        {packagingForm.batch_id && (() => {
                            const b = batches.find(x => x.id === parseInt(packagingForm.batch_id));
                            if (b) return (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Rendimiento Lote</span>
                                        <span className="text-sm font-bold text-teal-700">{parseFloat(b.yield_liquid_lbs || 0).toLocaleString()} Lbs</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Ya Envasado</span>
                                        <span className="text-sm font-bold text-indigo-700">{parseFloat(b.packaged_weight_lbs || 0).toLocaleString()} Lbs</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Disponible</span>
                                        <span className="text-sm font-bold text-amber-700">{Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0)).toLocaleString()} Lbs</span>
                                    </div>
                                </div>
                            );
                            return null;
                        })()}

                        {/* Presentación y Pesaje */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Presentación Comercial</label>
                                <select
                                    value={packagingForm.presentation}
                                    onChange={(e) => {
                                        const pres = e.target.value;
                                        let defaultW = '30.00';
                                        if (pres.includes('30')) defaultW = '30.00';
                                        else if (pres.includes('32')) defaultW = '32.00';
                                        else if (pres.includes('8LB')) defaultW = '8.00';
                                        else if (pres.includes('4LB')) defaultW = '4.00';
                                        else if (pres.includes('2LB')) defaultW = '2.00';
                                        setPackagingForm({ ...packagingForm, presentation: pres, weight_per_unit_lbs: defaultW });
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="cubeta 30LB">Cubeta 30 Lbs (Estándar)</option>
                                    <option value="cubeta 32LB">Cubeta 32 Lbs</option>
                                    <option value="galón 8LB">Galón (8 Lbs)</option>
                                    <option value="medio galón 4LB">Medio Galón (4 Lbs)</option>
                                    <option value="litro 2LB">Litro (2 Lbs)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Unidades Envasadas</label>
                                <input
                                    type="number"
                                    value={packagingForm.units_packaged}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, units_packaged: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 320"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Peso por Unidad (Lbs)</label>
                                <input
                                    type="number"
                                    value={packagingForm.weight_per_unit_lbs}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, weight_per_unit_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 30.00"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        {/* Estado del Producto & Ubicación de Almacenamiento */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                            <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Cadena de Frío & Vida Útil</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Estado / Proceso Frío</label>
                                    <select
                                        value={packagingForm.product_state}
                                        onChange={(e) => {
                                            const state = e.target.value;
                                            const zone = state === 'congelado' ? 'BLAST' : 'COOLER';
                                            setPackagingForm({ ...packagingForm, product_state: state, warehouse_zone: zone });
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="líquido">Líquido Refrigerado (2-4°C) - Vida útil: 28 días</option>
                                        <option value="congelado">Congelado (-18°C) - Vida útil: 365 días (1 Año)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Zona de Bodega Destino</label>
                                    <select
                                        value={packagingForm.warehouse_zone}
                                        onChange={(e) => setPackagingForm({ ...packagingForm, warehouse_zone: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="COOLER">COOLER (Cámara de Refrigeración Líquido PT 2-4°C)</option>
                                        <option value="BLAST">BLAST (Túnel Congelación Ultra-rápida)</option>
                                        <option value="HOLDING">HOLDING (Cámara de Almacenamiento Congelados -18°C)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {packagingForm.units_packaged && packagingForm.weight_per_unit_lbs && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                                <span className="text-[10px] font-bold text-teal-700 uppercase block">Total Producido</span>
                                <span className="text-base font-bold text-teal-800">
                                    {(parseFloat(packagingForm.units_packaged || 0) * parseFloat(packagingForm.weight_per_unit_lbs || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Lbs
                                </span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsNewPackagingModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || (packagingForm.batch_id && batches.find(b => b.id === parseInt(packagingForm.batch_id))?.status === 'bloqueado_haccp')}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40"
                            >
                                {isSubmitting ? 'Guardando...' : 'Confirmar & Generar Lote'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {/* INTERACTIVE GS1 LABEL PREVIEW MODAL */}
            {selectedLabel && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-5 text-slate-900">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                <QrCode size={16} className="text-purple-600" />
                                Etiqueta de Trazabilidad
                            </h3>
                            <button
                                onClick={() => setSelectedLabel(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase"
                            >
                                Cerrar
                            </button>
                        </div>
                        <div className="h-px bg-slate-100" />

                        {/* Printable Area Representation */}
                        <div className="bg-white text-slate-900 p-6 rounded-xl border border-slate-300 shadow-sm flex flex-col items-center text-center font-mono space-y-4 max-w-sm mx-auto">
                            <div className="w-full flex justify-between items-center border-b border-slate-900 pb-2 text-[9px] font-bold">
                                <span>ANDELSA PLANTA INDUSTRIAL</span>
                                <span>REGISTRO SANITARIO</span>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">Código de Lote</span>
                                <span className="text-base font-bold tracking-tight text-slate-900 uppercase border border-slate-900 px-3 py-1 rounded-md">{selectedLabel.lot_code}</span>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-2 text-left text-[10px] font-medium border-t border-b border-slate-900 py-3 font-sans">
                                <div>
                                    <span className="text-slate-500 block text-[8px] uppercase font-bold">Producto:</span>
                                    <span className="font-bold capitalize text-slate-900">{selectedLabel.product_type}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[8px] uppercase font-bold">Presentación:</span>
                                    <span className="font-bold text-slate-900">{selectedLabel.presentation}</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[8px] uppercase font-bold">Cant. Envasada:</span>
                                    <span className="font-bold text-slate-900">{selectedLabel.units_packaged} Unidades</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[8px] uppercase font-bold">Peso Total:</span>
                                    <span className="font-bold text-slate-900">{selectedLabel.total_batch_weight_lbs} Lbs</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[8px] uppercase font-bold">F. Empaque:</span>
                                    <span className="font-bold text-slate-900">{formatDate(selectedLabel.created_at)}</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[8px] uppercase font-bold">F. Vencimiento:</span>
                                    <span className="font-bold text-rose-600">{formatDate(selectedLabel.expiry_date)}</span>
                                </div>
                            </div>

                            {/* Simulated Barcode block */}
                            <div className="py-2 flex flex-col items-center">
                                <div className="h-10 w-44 bg-slate-900 flex items-center justify-between px-2 text-white font-mono text-[9px] tracking-[4px] font-bold rounded">
                                    |||| | | ||| || ||| || |||
                                </div>
                                <span className="text-[10px] text-slate-600 font-bold font-mono mt-1">({selectedLabel.barcode})</span>
                            </div>

                            {/* Dynamic QR Code from API */}
                            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div className="h-28 w-28 bg-white rounded-lg flex items-center justify-center p-1 shadow-xs relative overflow-hidden border border-slate-200">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedLabel.qr_code_payload)}`}
                                        alt="QR Trazabilidad"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <span className="text-[8px] text-slate-500 font-bold mt-2 tracking-tight uppercase">Escanee para verificar trazabilidad</span>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    handlePrintLabel(selectedLabel);
                                    setSelectedLabel(null);
                                }}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Printer size={14} />
                                Imprimir Etiqueta (PDF)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isFreezerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto text-slate-900">
                    {/* Add Blast Freezer Log Form */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl h-fit space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Snowflake className="h-4 w-4 text-cyan-600" />
                                Blast Freezer
                            </h2>
                            <button onClick={() => setIsFreezerModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <XCircle size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500">Registro de congelación ultra-rápida</p>
                        <div className="h-px bg-slate-100" />

                        <form onSubmit={handleCreateFreezerLog} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote Envasado a Congelar</label>
                                <select
                                    value={freezerForm.packaging_id}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, packaging_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="">Seleccione Lote Envasado...</option>
                                    {packagingRecords.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.lot_code} - {p.product_type} ({p.units_packaged} Uds)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Ubicación del Túnel</label>
                                <select
                                    value={freezerForm.freezer_location}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, freezer_location: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="Túnel A - Posición 1">Túnel Rápido A - Posición 1</option>
                                    <option value="Túnel A - Posición 2">Túnel Rápido A - Posición 2</option>
                                    <option value="Túnel B - Posición 1">Túnel Rápido B - Posición 1</option>
                                    <option value="Túnel B - Posición 2">Túnel Rápido B - Posición 2</option>
                                    <option value="Túnel C (Ultra-frío)">Túnel C - Criogénico</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Temp Núcleo (°C)</label>
                                    <input
                                        type="number"
                                        value={freezerForm.core_temperature_c}
                                        onChange={(e) => setFreezerForm({ ...freezerForm, core_temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: -18.5"
                                        step="0.1"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Horas en Túnel</label>
                                    <input
                                        type="number"
                                        value={freezerForm.freezing_duration_hours}
                                        onChange={(e) => setFreezerForm({ ...freezerForm, freezing_duration_hours: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        placeholder="Ej: 4.0"
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Estado del Proceso</label>
                                <select
                                    value={freezerForm.status}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="congelando">Congelando (Activo)</option>
                                    <option value="congelado_ok">Congelado Aprobado (-18°C núcleo)</option>
                                    <option value="alarma_tiempo">Alarma de Desviación de Tiempo</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                Guardar Registro Túnel
                            </button>
                        </form>
                    </div>

                    {/* Freezer active logs */}
                    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="h-4 w-4 text-cyan-600" />
                                Bitácora del Blast Freezer (Cadena de Frío)
                            </h2>
                            <p className="text-xs text-slate-500">Monitoreo de tiempos y temperatura interna de congelación</p>
                            <div className="h-px bg-slate-100 mt-3" />
                        </div>

                        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                            {freezerLogs.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-6">No hay registros de túnel registrados.</p>
                            ) : freezerLogs.map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900">{log.lot_code}</span>
                                            <span className="text-[11px] text-slate-500 capitalize">{log.product_type}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">Ubicación: <b className="text-slate-800">{log.freezer_location}</b></p>
                                        <div className="text-[11px] text-slate-500">
                                            <span>Ingreso: <b className="text-slate-700">{formatDateTime(log.created_at)}</b></span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getFreezerStatusBadge(log.status)}`}>
                                            {log.status === 'congelado_ok' ? 'Congelado Aprobado' : log.status}
                                        </span>
                                        <div className="flex gap-2 text-xs mt-2">
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[8px] font-bold block text-slate-400 uppercase">Núcleo</span>
                                                <span className="text-xs font-bold text-cyan-700">{log.core_temperature_c}°C</span>
                                            </div>
                                            <div className="text-center bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                                                <span className="text-[8px] font-bold block text-slate-400 uppercase">Horas</span>
                                                <span className="text-xs font-bold text-slate-800">{log.freezing_duration_hours}h</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>
            )}

            {isEditModalOpen && editingPackaging && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full space-y-4 text-slate-900">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-indigo-600" />
                        Editar Empaque
                    </h3>
                    <div className="h-px bg-slate-100" />
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote</label>
                            <input type="text" value={editingPackaging.lot_code} disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Unidades</label>
                                <input
                                    type="number"
                                    value={packagingForm.units_packaged}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, units_packaged: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Peso/Unidad (Lbs)</label>
                                <input
                                    type="number"
                                    value={packagingForm.weight_per_unit_lbs}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, weight_per_unit_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    step="0.01"
                                />
                            </div>
                        </div>
                        {packagingForm.units_packaged && packagingForm.weight_per_unit_lbs && (
                            <div className="bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-center">
                                <span className="text-[10px] font-bold text-teal-700 uppercase block">Total</span>
                                <span className="text-sm font-bold text-teal-800">
                                    {(parseFloat(packagingForm.units_packaged || 0) * parseFloat(packagingForm.weight_per_unit_lbs || 0)).toFixed(2)} Lbs
                                </span>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingPackaging(null); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200">Cancelar</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">Guardar</button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {deleteConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-slate-900">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Confirmar Eliminación</h3>
                    <p className="text-xs text-slate-600">¿Eliminar este registro de empaque? Se liberará el stock consumido del lote.</p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200">Cancelar</button>
                        <button onClick={() => handleDelete(deleteConfirmId)} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">Eliminar</button>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};

export default EggPackaging;
