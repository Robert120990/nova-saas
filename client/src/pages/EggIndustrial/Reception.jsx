import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
    Plus,
    FileText,
    User,
    Calendar,
    Thermometer,
    Award,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Boxes,
    Search,
    Pencil,
    Ban,
    Truck
} from 'lucide-react';

const EggReception = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    // States for raw materials list and providers list
    const [rawMaterials, setRawMaterials] = useState([]);
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const todayStr = new Date().toISOString().split('T')[0];

    // Preset providers (ANDELSA plant habituals)
    const PRESET_PROVIDERS = [
        { name: 'Don Héctor', code: 'HD 25918', prefix: 'HD-25918' },
        { name: 'Granja Candy', code: 'CANDY', prefix: 'GC-CANDY' },
        { name: 'Avícola La Granja', code: 'AV-GRANJA', prefix: 'LOTE-AV' }
    ];

    const [useTarimas, setUseTarimas] = useState(false);
    const [tarimas, setTarimas] = useState([
        { id: 1, tarima_number: 1, gross_weight_lbs: '', tare_weight_lbs: 60, net_weight_lbs: 0, boxes_count: 24 }
    ]);

    // Form state
    const [formData, setFormData] = useState({
        provider_id: '',
        egg_type: 'huevo cáscara',
        egg_color: 'blanco',
        egg_size: 'L',
        fecha: todayStr,
        weight_lbs: '',
        total_boxes: 0,
        temperature_c: '',
        truck_temperature_c: '',
        truck_plate: '',
        driver_name: '',
        provider_lot: '',
        certificate_urls: '',
        operator_name: user?.nombre || '',
        status: 'aprobado'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        provider_id: '',
        egg_type: 'huevo cáscara',
        egg_color: 'blanco',
        egg_size: 'L',
        fecha: '',
        weight_lbs: '',
        total_boxes: 0,
        temperature_c: '',
        truck_temperature_c: '',
        truck_plate: '',
        driver_name: '',
        provider_lot: '',
        certificate_urls: '',
        operator_name: '',
        status: 'aprobado'
    });
    const [voidConfirmId, setVoidConfirmId] = useState(null);

    // Helpers para tarimas
    const addTarima = () => {
        const nextNum = tarimas.length + 1;
        setTarimas([...tarimas, {
            id: Date.now(),
            tarima_number: nextNum,
            gross_weight_lbs: '',
            tare_weight_lbs: 60,
            net_weight_lbs: 0,
            boxes_count: 24
        }]);
    };

    const removeTarima = (index) => {
        const updated = tarimas.filter((_, i) => i !== index).map((t, idx) => ({
            ...t,
            tarima_number: idx + 1
        }));
        setTarimas(updated);
        recalcTarimasTotals(updated);
    };

    const updateTarima = (index, field, value) => {
        const updated = [...tarimas];
        const val = field === 'boxes_count' ? (parseInt(value) || 0) : (parseFloat(value) || 0);
        updated[index][field] = value;
        
        const gross = parseFloat(updated[index].gross_weight_lbs) || 0;
        const tare = parseFloat(updated[index].tare_weight_lbs) || 0;
        updated[index].net_weight_lbs = Math.max(0, gross - tare);

        setTarimas(updated);
        recalcTarimasTotals(updated);
    };

    const recalcTarimasTotals = (currentTarimas) => {
        const totalNet = currentTarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs) || 0), 0);
        const totalB = currentTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0);
        setFormData(prev => ({
            ...prev,
            weight_lbs: totalNet > 0 ? totalNet.toFixed(2) : '',
            total_boxes: totalB
        }));
    };

    const applyPreset = (preset) => {
        const match = providers.find(p => p.nombre?.toLowerCase().includes(preset.name.toLowerCase()));
        setFormData(prev => ({
            ...prev,
            provider_id: match ? match.id : prev.provider_id,
            provider_lot: `${preset.prefix}-${new Date().toISOString().slice(5, 10).replace(/-/g, '')}`
        }));
        toast.info(`Preset aplicado: ${preset.name}`);
    };

    // Fetch raw materials and providers on mount
    const fetchData = async () => {
        setLoading(true);
        try {
            const [rmRes, provRes] = await Promise.all([
                axios.get('/api/egg-industrial/raw-materials'),
                axios.get('/api/providers')
            ]);
            setRawMaterials(rmRes.data);
            setProviders(Array.isArray(provRes.data) ? provRes.data : (provRes.data?.data || []));
        } catch (error) {
            console.error('Error fetching egg reception data:', error);
            toast.error('Error al cargar la información de recepción.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validations
        if (!formData.provider_id) {
            return toast.error('Debe seleccionar un proveedor.');
        }
        if (!formData.weight_lbs || parseFloat(formData.weight_lbs) <= 0) {
            return toast.error('El peso debe ser mayor a cero.');
        }
        if (!formData.temperature_c) {
            return toast.error('Debe ingresar la temperatura.');
        }
        if (!formData.provider_lot.trim()) {
            return toast.error('El lote del proveedor es obligatorio.');
        }

        const parsedWeight = parseFloat(formData.weight_lbs);
        const parsedTemp = parseFloat(formData.temperature_c);

        // Quality rule warning toast
        if (parsedTemp > 6.0) {
            toast.warning('ALERTA DE CONTROL DE CALIDAD: La temperatura ingresada supera el límite máximo de inocuidad (6°C). El lote será marcado para revisión adicional.', { duration: 6000 });
        }

        setIsSubmitting(true);
        try {
            const urlsArray = formData.certificate_urls.trim() 
                ? formData.certificate_urls.split(',').map(url => url.trim())
                : [];

            await axios.post('/api/egg-industrial/raw-materials', {
                ...formData,
                provider_lot: formData.provider_lot.trim().toUpperCase(),
                weight_lbs: parsedWeight,
                total_boxes: formData.total_boxes || 0,
                temperature_c: parsedTemp,
                truck_temperature_c: formData.truck_temperature_c ? parseFloat(formData.truck_temperature_c) : null,
                truck_plate: formData.truck_plate || null,
                driver_name: formData.driver_name || null,
                tarimas_json: useTarimas ? tarimas : null,
                certificate_urls: urlsArray
            });

            toast.success('Recepción de materia prima registrada con éxito.');
            setIsCreateModalOpen(false);
            setUseTarimas(false);
            setTarimas([{ id: 1, tarima_number: 1, gross_weight_lbs: '', tare_weight_lbs: 60, net_weight_lbs: 0, boxes_count: 24 }]);
            setFormData({
                provider_id: '',
                egg_type: 'huevo cáscara',
                egg_color: 'blanco',
                egg_size: 'L',
                fecha: new Date().toISOString().split('T')[0],
                weight_lbs: '',
                total_boxes: 0,
                temperature_c: '',
                truck_temperature_c: '',
                truck_plate: '',
                driver_name: '',
                provider_lot: '',
                certificate_urls: '',
                operator_name: user?.nombre || '',
                status: 'aprobado'
            });
            fetchData();
        } catch (error) {
            console.error('Error registering raw material reception:', error);
            toast.error(error.response?.data?.message || 'Error al guardar la recepción.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (rm) => {
        let certUrls = '';
        try {
            certUrls = (JSON.parse(rm.certificate_urls || '[]') || []).join(', ');
        } catch (e) { certUrls = ''; }
        setEditForm({
            provider_id: rm.provider_id || '',
            egg_type: rm.egg_type || 'huevo cáscara',
            egg_color: rm.egg_color || 'blanco',
            egg_size: rm.egg_size || 'L',
            fecha: rm.fecha ? rm.fecha.split('T')[0] : '',
            weight_lbs: rm.weight_lbs || '',
            temperature_c: rm.temperature_c || '',
            provider_lot: rm.provider_lot || '',
            certificate_urls: certUrls,
            operator_name: rm.operator_name || '',
            status: rm.status || 'aprobado'
        });
        setEditingId(rm.id);
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editForm.provider_id) return toast.error('Debe seleccionar un proveedor.');
        if (!editForm.weight_lbs || parseFloat(editForm.weight_lbs) <= 0) return toast.error('El peso debe ser mayor a cero.');
        if (!editForm.temperature_c) return toast.error('Debe ingresar la temperatura.');
        if (!editForm.provider_lot.trim()) return toast.error('El lote del proveedor es obligatorio.');

        setIsSubmitting(true);
        try {
            const urlsArray = editForm.certificate_urls.trim()
                ? editForm.certificate_urls.split(',').map(url => url.trim())
                : [];
            await axios.put(`/api/egg-industrial/raw-materials/${editingId}`, {
                ...editForm,
                provider_lot: editForm.provider_lot.trim().toUpperCase(),
                weight_lbs: parseFloat(editForm.weight_lbs),
                temperature_c: parseFloat(editForm.temperature_c),
                certificate_urls: urlsArray
            });
            toast.success('Recepción actualizada correctamente.');
            setIsEditModalOpen(false);
            setEditingId(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al actualizar.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVoid = async (id) => {
        try {
            await axios.put(`/api/egg-industrial/raw-materials/${id}/void`);
            toast.success('Recepción anulada correctamente.');
            setVoidConfirmId(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al anular.');
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Filter raw materials based on search
    const filteredMaterials = rawMaterials.filter(rm => 
        rm.provider_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rm.provider_lot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rm.egg_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helpers to style status badge
    const getStatusBadge = (status) => {
        switch (status) {
            case 'aprobado':
                return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
            case 'cuarentena':
                return 'bg-amber-50 text-amber-700 border border-amber-200';
            case 'rechazado':
                return 'bg-rose-50 text-rose-700 border border-rose-200';
            case 'anulado':
                return 'bg-slate-100 text-slate-500 border border-slate-200';
            default:
                return 'bg-slate-100 text-slate-600 border border-slate-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'aprobado':
                return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
            case 'cuarentena':
                return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
            case 'rechazado':
                return <XCircle className="h-3.5 w-3.5 text-rose-600" />;
            case 'anulado':
                return <Ban className="h-3.5 w-3.5 text-slate-500" />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Boxes className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Recepción de Huevo en Cáscara y Líquido</h1>
                        <p className="text-xs text-slate-500 font-medium">Registro de ingresos de materia prima, pesaje de tarimas en báscula y control de cadena de frío</p>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                    <Plus size={16} />
                    Nueva Recepción
                </button>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <Plus className="h-4 w-4 text-indigo-600" />
                            Boleta de Ingreso y Control de Calidad (LOG-004)
                        </h2>
                        <button 
                            type="button" 
                            onClick={() => setIsCreateModalOpen(false)}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                        >
                            <XCircle size={18} />
                        </button>
                    </div>

                    {/* Presets Rápidos */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Proveedores Frecuentes (ANDELSA):</span>
                            <span className="text-[10px] text-indigo-600 font-bold">Autocompleta proveedor y prefijo de lote</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_PROVIDERS.map((preset, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => applyPreset(preset)}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                                >
                                    <span>📦 {preset.name}</span>
                                    <span className="text-[9px] bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-indigo-700">{preset.code}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Datos del Transporte (LOG-004) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-2">
                                <Truck size={15} />
                                Control de Transporte & Cadena de Frío (LOG-004)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Placa de Vehículo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: C123-456"
                                        value={formData.truck_plate}
                                        onChange={(e) => setFormData({ ...formData, truck_plate: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Motorista / Chofer</label>
                                    <input
                                        type="text"
                                        placeholder="Nombre del conductor"
                                        value={formData.driver_name}
                                        onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Temp. Termoking/Cabina (°C)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 4.5"
                                            value={formData.truck_temperature_c}
                                            onChange={(e) => setFormData({ ...formData, truck_temperature_c: e.target.value })}
                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        />
                                        <Thermometer size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Datos de la Carga */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Provider selection */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Proveedor de Origen *</label>
                                <SearchableSelect
                                    options={providers}
                                    value={formData.provider_id}
                                    onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                                    valueKey="id"
                                    labelKey="nombre"
                                    placeholder="Buscar proveedor..."
                                    codeKey="nrc"
                                    codeLabel="NRC"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Fecha de Recepción</label>
                                <input
                                    type="date"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                />
                            </div>

                            {/* Egg type */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Tipo de Huevo</label>
                                <select
                                    value={formData.egg_type}
                                    onChange={(e) => setFormData({ ...formData, egg_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                >
                                    <option value="huevo cáscara">Huevo en Cáscara</option>
                                    <option value="huevo líquido">Huevo Líquido</option>
                                    <option value="clara">Clara Líquida</option>
                                    <option value="yema">Yema Líquida</option>
                                </select>
                            </div>

                            {/* Egg color & size conditionally active */}
                            {formData.egg_type === 'huevo cáscara' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Color</label>
                                        <select
                                            value={formData.egg_color}
                                            onChange={(e) => setFormData({ ...formData, egg_color: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="blanco">Blanco</option>
                                            <option value="marrón">Marrón</option>
                                            <option value="mixto">Mixto</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tamaño</label>
                                        <select
                                            value={formData.egg_size}
                                            onChange={(e) => setFormData({ ...formData, egg_size: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="S">S (Chico)</option>
                                            <option value="M">M (Mediano)</option>
                                            <option value="L">L (Grande)</option>
                                            <option value="XL">XL (Extra Grande)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Lote del Proveedor *</label>
                                    <input
                                        type="text"
                                        value={formData.provider_lot}
                                        onChange={(e) => setFormData({ ...formData, provider_lot: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Ej: LOTE-AV-991A"
                                    />
                                </div>
                            )}

                            {formData.egg_type === 'huevo cáscara' && (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Lote del Proveedor *</label>
                                    <input
                                        type="text"
                                        value={formData.provider_lot}
                                        onChange={(e) => setFormData({ ...formData, provider_lot: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Ej: LOTE-AV-991A"
                                    />
                                </div>
                            )}

                            {/* Temperature */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Temperatura Huevo (°C) *</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.temperature_c}
                                        onChange={(e) => setFormData({ ...formData, temperature_c: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Máx 6.0°C"
                                        step="0.01"
                                    />
                                    <Thermometer className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* MODO PESAJE: DIRECTO VS TARIMAS */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                        <Boxes size={15} className="text-indigo-600" />
                                        Detalle de Pesaje & Cajas
                                    </h4>
                                    <p className="text-[11px] text-slate-500">Seleccione si registrará el peso total directo o tarima por tarima de báscula</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                    <button
                                        type="button"
                                        onClick={() => setUseTarimas(false)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${!useTarimas ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Pesaje Directo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUseTarimas(true)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${useTarimas ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Por Tarimas (Báscula)
                                    </button>
                                </div>
                            </div>

                            {!useTarimas ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Total Cajas de Huevo</label>
                                        <input
                                            type="number"
                                            value={formData.total_boxes}
                                            onChange={(e) => setFormData({ ...formData, total_boxes: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            placeholder="Ej: 360"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Peso Neto Recibido (Libras) *</label>
                                        <input
                                            type="number"
                                            value={formData.weight_lbs}
                                            onChange={(e) => setFormData({ ...formData, weight_lbs: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            placeholder="Ej: 16500.50"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2 text-center w-12">#</th>
                                                    <th className="p-2 w-28">Cajas</th>
                                                    <th className="p-2">Peso Bruto (lb)</th>
                                                    <th className="p-2">Tara (lb)</th>
                                                    <th className="p-2 text-right">Peso Neto (lb)</th>
                                                    <th className="p-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {tarimas.map((t, idx) => (
                                                    <tr key={t.id || idx} className="hover:bg-slate-50">
                                                        <td className="p-2 text-center text-slate-500 text-xs font-bold">{t.tarima_number}</td>
                                                        <td className="p-2">
                                                            <input
                                                                type="number"
                                                                value={t.boxes_count}
                                                                onChange={(e) => updateTarima(idx, 'boxes_count', e.target.value)}
                                                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-center"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                placeholder="0.0"
                                                                value={t.gross_weight_lbs}
                                                                onChange={(e) => updateTarima(idx, 'gross_weight_lbs', e.target.value)}
                                                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold"
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={t.tare_weight_lbs}
                                                                onChange={(e) => updateTarima(idx, 'tare_weight_lbs', e.target.value)}
                                                                className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-600"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right font-black text-emerald-700 text-xs">
                                                            {parseFloat(t.net_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lb
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {tarimas.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeTarima(idx)}
                                                                    className="text-rose-500 hover:text-rose-700 p-1"
                                                                >
                                                                    <XCircle size={15} />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={addTarima}
                                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-xs transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Tarima #{tarimas.length + 1}
                                        </button>
                                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs shadow-xs">
                                            <span className="text-slate-500">Tarimas: <strong className="text-slate-800">{tarimas.length}</strong></span>
                                            <span className="text-slate-500">Total Cajas: <strong className="text-indigo-700">{formData.total_boxes}</strong></span>
                                            <span className="text-slate-500">Neto Total: <strong className="text-emerald-700">{formData.weight_lbs || '0.00'} lb</strong></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Certificados y Calidad Inicial */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Estado Inicial Calidad</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                >
                                    <option value="aprobado">Aprobado para Producción</option>
                                    <option value="cuarentena">En Cuarentena</option>
                                    <option value="rechazado">Rechazado (No Apto)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">URLs Certificados Inocuidad</label>
                                <input
                                    type="text"
                                    value={formData.certificate_urls}
                                    onChange={(e) => setFormData({ ...formData, certificate_urls: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    placeholder="Ej: https://docs.quality.com/cert1.pdf"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-55"
                            >
                                {isSubmitting ? 'Guardando...' : 'Confirmar Ingreso'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {/* HISTORY LIST CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            Historial de Ingresos de Materia Prima
                        </h2>
                        
                        <div className="relative w-full md:w-80">
                            <input
                                type="text"
                                placeholder="Buscar por proveedor, lote o tipo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                            />
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Cargando historial de recepciones...
                            </div>
                        ) : filteredMaterials.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                                No se encontraron registros de materia prima.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-3 py-2.5">Fecha</th>
                                        <th className="px-3 py-2.5">Proveedor / Lote</th>
                                        <th className="px-3 py-2.5">Transporte (LOG-004)</th>
                                        <th className="px-3 py-2.5">Tipo / Presentación</th>
                                        <th className="px-3 py-2.5 text-right">Cajas</th>
                                        <th className="px-3 py-2.5 text-right">Peso (Lbs)</th>
                                        <th className="px-3 py-2.5 text-right">Stock (Lbs)</th>
                                        <th className="px-3 py-2.5 text-center">Temp Huevo</th>
                                        <th className="px-3 py-2.5 text-center">Estatus</th>
                                        <th className="px-3 py-2.5">Operador</th>
                                        <th className="px-3 py-2.5 text-center w-12">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {filteredMaterials.map(rm => {
                                        let certs = [];
                                        try {
                                            certs = JSON.parse(rm.certificate_urls || '[]');
                                        } catch (e) {
                                            certs = [];
                                        }

                                        return (
                                            <tr key={rm.id} className="hover:bg-slate-50/75 transition-colors">
                                                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                                                        <Calendar size={13} className="text-slate-400" />
                                                        {formatDate(rm.fecha || rm.created_at)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{rm.provider_name}</span>
                                                        <span className="bg-slate-100 border border-slate-200 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit mt-0.5">
                                                            {rm.provider_lot}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col text-xs">
                                                        {rm.truck_plate ? (
                                                            <span className="text-slate-800 font-bold flex items-center gap-1">
                                                                <Truck size={13} className="text-indigo-600" />
                                                                {rm.truck_plate}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">Sin transporte</span>
                                                        )}
                                                        {rm.truck_temperature_c && (
                                                            <span className="text-slate-500 text-[10px]">Termoking: {rm.truck_temperature_c}°C</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 capitalize">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-900 text-xs font-bold">{rm.egg_type}</span>
                                                        {rm.egg_type === 'huevo cáscara' && (
                                                            <span className="text-[10px] text-slate-500">Color: {rm.egg_color} | Talla: {rm.egg_size}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-800 text-xs">
                                                    {rm.total_boxes ? `${rm.total_boxes} cjs` : '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-black text-slate-900 text-xs">
                                                    {parseFloat(rm.weight_lbs).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-xs">
                                                    <span className={parseFloat(rm.stock_lbs || 0) <= 0 ? 'text-rose-600' : parseFloat(rm.stock_lbs) < 1000 ? 'text-amber-600' : 'text-emerald-700'}>
                                                        {parseFloat(rm.stock_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                        parseFloat(rm.temperature_c) > 6.0 
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        {rm.temperature_c}°C
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight">
                                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${getStatusBadge(rm.status)}`}>
                                                            {getStatusIcon(rm.status)}
                                                            {rm.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-600 flex items-center gap-1 text-[10px]">
                                                            <User size={11} className="text-slate-400" />
                                                            {rm.operator_name}
                                                        </span>
                                                        {certs.length > 0 && (
                                                            <div className="flex gap-1 mt-0.5">
                                                                {certs.map((url, idx) => (
                                                                    <a 
                                                                        key={idx} 
                                                                        href={url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="text-indigo-600 hover:text-indigo-800 text-[10px] underline font-bold flex items-center gap-0.5"
                                                                    >
                                                                        <FileText size={10} />
                                                                        Cert #{idx + 1}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {rm.status !== 'anulado' && (
                                                            <button
                                                                onClick={() => handleEdit(rm)}
                                                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                                title="Editar"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                        )}
                                                        {rm.status !== 'anulado' && parseFloat(rm.stock_lbs || 0) >= parseFloat(rm.weight_lbs || 0) && (
                                                            <button
                                                                onClick={() => setVoidConfirmId(rm.id)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                                title="Anular"
                                                            >
                                                                <Ban size={13} />
                                                            </button>
                                                        )}
                                                        {rm.status === 'anulado' && (
                                                            <span className="text-[10px] text-slate-400 font-semibold italic">Anulado</span>
                                                        )}
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

            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto text-slate-900">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Pencil className="h-4 w-4 text-indigo-600" />
                                Editar Recepción de Materia Prima
                            </h2>
                            <button 
                                type="button" 
                                onClick={() => { setIsEditModalOpen(false); setEditingId(null); }}
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Proveedor de Origen</label>
                                    <SearchableSelect
                                        options={providers}
                                        value={editForm.provider_id}
                                        onChange={(e) => setEditForm({ ...editForm, provider_id: e.target.value })}
                                        valueKey="id"
                                        labelKey="nombre"
                                        placeholder="Buscar proveedor..."
                                        codeKey="nrc"
                                        codeLabel="NRC"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Fecha de Recepción</label>
                                    <input
                                        type="date"
                                        value={editForm.fecha}
                                        onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Tipo de Huevo</label>
                                    <select
                                        value={editForm.egg_type}
                                        onChange={(e) => setEditForm({ ...editForm, egg_type: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    >
                                        <option value="huevo cáscara">Huevo en Cáscara</option>
                                        <option value="huevo líquido">Huevo Líquido</option>
                                        <option value="clara">Clara Líquida</option>
                                        <option value="yema">Yema Líquida</option>
                                    </select>
                                </div>
                                {editForm.egg_type === 'huevo cáscara' && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Color del Huevo</label>
                                            <select
                                                value={editForm.egg_color}
                                                onChange={(e) => setEditForm({ ...editForm, egg_color: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            >
                                                <option value="blanco">Blanco</option>
                                                <option value="marrón">Marrón</option>
                                                <option value="mixto">Mixto</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Tamaño</label>
                                            <select
                                                value={editForm.egg_size}
                                                onChange={(e) => setEditForm({ ...editForm, egg_size: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            >
                                                <option value="S">S (Chico)</option>
                                                <option value="M">M (Mediano)</option>
                                                <option value="L">L (Grande)</option>
                                                <option value="XL">XL (Extra Grande)</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Peso Recibido (Libras)</label>
                                    <input type="number" value={editForm.weight_lbs} onChange={(e) => setEditForm({ ...editForm, weight_lbs: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs" step="0.01" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Temperatura en Sensor (°C)</label>
                                    <input type="number" value={editForm.temperature_c} onChange={(e) => setEditForm({ ...editForm, temperature_c: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs" step="0.01" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Lote del Proveedor</label>
                                    <input type="text" value={editForm.provider_lot} onChange={(e) => setEditForm({ ...editForm, provider_lot: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Estado Inicial Calidad</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    >
                                        <option value="aprobado">Aprobado para Producción</option>
                                        <option value="cuarentena">En Cuarentena</option>
                                        <option value="rechazado">Rechazado (No Apto)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">URLs de Certificados de Inocuidad (Separados por coma)</label>
                                    <input type="text" value={editForm.certificate_urls} onChange={(e) => setEditForm({ ...editForm, certificate_urls: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs" placeholder="Ej: https://docs.quality.com/cert1.pdf" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingId(null); }} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs">Cancelar</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-55">{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {voidConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 text-slate-900">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-rose-50 rounded-xl border border-rose-200 text-rose-600">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Confirmar Anulación</h3>
                        </div>
                        <p className="text-xs text-slate-600 mb-6 leading-relaxed">¿Está seguro de anular esta recepción de materia prima? Esta acción restará el inventario ingresado y no se puede deshacer.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setVoidConfirmId(null)} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs">Cancelar</button>
                            <button onClick={() => handleVoid(voidConfirmId)} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs">Anular</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EggReception;
