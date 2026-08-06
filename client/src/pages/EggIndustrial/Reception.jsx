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
    Ban
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

    // Form state
    const [formData, setFormData] = useState({
        provider_id: '',
        egg_type: 'huevo cáscara',
        egg_color: 'blanco',
        egg_size: 'L',
        fecha: todayStr,
        weight_lbs: '',
        temperature_c: '',
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
        temperature_c: '',
        provider_lot: '',
        certificate_urls: '',
        operator_name: '',
        status: 'aprobado'
    });
    const [voidConfirmId, setVoidConfirmId] = useState(null);

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
                temperature_c: parsedTemp,
                certificate_urls: urlsArray
            });

            toast.success('Recepción de materia prima registrada con éxito.');
            setIsCreateModalOpen(false);
            setFormData({
                provider_id: '',
                egg_type: 'huevo cáscara',
                egg_color: 'blanco',
                egg_size: 'L',
                fecha: new Date().toISOString().split('T')[0],
                weight_lbs: '',
                temperature_c: '',
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
                return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
            case 'cuarentena':
                return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
            case 'rechazado':
                return 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
            case 'anulado':
                return 'bg-slate-700/50 text-slate-500 border border-slate-700/50';
            default:
                return 'bg-slate-800 text-slate-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'aprobado':
                return <CheckCircle2 className="h-3.5 w-3.5" />;
            case 'cuarentena':
                return <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />;
            case 'rechazado':
                return <XCircle className="h-3.5 w-3.5" />;
            case 'anulado':
                return <Ban className="h-3.5 w-3.5" />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                        <Boxes className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Recepción de Materia Prima</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Registro de ingresos de huevo cáscara y líquido, control de temperatura y certificaciones de calidad</p>
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all border border-indigo-500 flex items-center gap-2 shadow-lg shadow-indigo-600/15"
                >
                    <Plus size={16} />
                    Nueva Recepción
                </button>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Plus className="h-4 w-4 text-teal-400" />
                        Formulario de Ingreso y Control de Calidad
                    </h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Provider selection */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Proveedor de Origen</label>
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

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Fecha de Recepción</label>
                                <input
                                    type="date"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Egg type */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Huevo</label>
                                <select
                                    value={formData.egg_type}
                                    onChange={(e) => setFormData({ ...formData, egg_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="huevo cáscara">Huevo en Cáscara</option>
                                    <option value="huevo líquido">Huevo Líquido</option>
                                    <option value="clara">Clara Líquida</option>
                                    <option value="yema">Yema Líquida</option>
                                </select>
                            </div>

                            {/* Egg color & size conditionally active */}
                            {formData.egg_type === 'huevo cáscara' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Color del Huevo</label>
                                        <select
                                            value={formData.egg_color}
                                            onChange={(e) => setFormData({ ...formData, egg_color: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="blanco">Blanco</option>
                                            <option value="marrón">Marrón</option>
                                            <option value="mixto">Mixto</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tamaño</label>
                                        <select
                                            value={formData.egg_size}
                                            onChange={(e) => setFormData({ ...formData, egg_size: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="S">S (Chico)</option>
                                            <option value="M">M (Mediano)</option>
                                            <option value="L">L (Grande)</option>
                                            <option value="XL">XL (Extra Grande)</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {/* Weight and Temp */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Peso Recibido (Libras)</label>
                                <input
                                    type="number"
                                    value={formData.weight_lbs}
                                    onChange={(e) => setFormData({ ...formData, weight_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    placeholder="Ej: 12000"
                                    step="0.01"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Temperatura en Sensor (°C)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.temperature_c}
                                        onChange={(e) => setFormData({ ...formData, temperature_c: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: 4.2"
                                        step="0.01"
                                    />
                                    <Thermometer className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                                </div>
                            </div>

                            {/* Lot & Quality certificates */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Lote del Proveedor</label>
                                <input
                                    type="text"
                                    value={formData.provider_lot}
                                    onChange={(e) => setFormData({ ...formData, provider_lot: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    placeholder="Ej: LOTE-AV-991A"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado Inicial Calidad</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="aprobado">Aprobado para Producción</option>
                                    <option value="cuarentena">En Cuarentena</option>
                                    <option value="rechazado">Rechazado (No Apto)</option>
                                </select>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">URLs de Certificados de Inocuidad (Separados por coma)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.certificate_urls}
                                        onChange={(e) => setFormData({ ...formData, certificate_urls: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: https://docs.quality.com/cert1.pdf, https://docs.quality.com/cert2.pdf"
                                    />
                                    <Award className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-extrabold transition-all border border-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 flex items-center gap-2 shadow-lg shadow-teal-600/15 disabled:opacity-55"
                            >
                                {isSubmitting ? 'Guardando...' : 'Confirmar Ingreso'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {/* HISTORY LIST CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-400" />
                            Historial de Ingresos de Materia Prima
                        </h2>
                        
                        <div className="relative w-full md:w-80">
                            <input
                                type="text"
                                placeholder="Buscar por proveedor, lote o tipo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                        </div>
                    </div>

                    <div className="h-px bg-slate-800" />

                    {/* Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Cargando historial de recepciones...
                            </div>
                        ) : filteredMaterials.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                                No se encontraron registros de materia prima.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 font-extrabold uppercase tracking-tighter text-[10px]">
                                        <th className="px-2 py-1.5">Fecha</th>
                                        <th className="px-2 py-1.5">Proveedor</th>
                                        <th className="px-2 py-1.5">Lote</th>
                                        <th className="px-2 py-1.5">Tipo</th>
                                        <th className="px-2 py-1.5 text-right">Peso (Lbs)</th>
                                        <th className="px-2 py-1.5 text-right">Stock</th>
                                        <th className="px-2 py-1.5 text-center">Temp</th>
                                        <th className="px-2 py-1.5 text-center">Estatus</th>
                                        <th className="px-2 py-1.5">Operador</th>
                                        <th className="px-2 py-1.5 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                                    {filteredMaterials.map(rm => {
                                        let certs = [];
                                        try {
                                            certs = JSON.parse(rm.certificate_urls || '[]');
                                        } catch (e) {
                                            certs = [];
                                        }

                                        return (
                                            <tr key={rm.id} className="hover:bg-slate-900/40 transition-colors">
                                                <td className="px-2 py-1.5 text-[10px] whitespace-nowrap">
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Calendar size={10} />
                                                        {formatDate(rm.fecha || rm.created_at)}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 font-bold text-white text-[11px] truncate max-w-[220px]">{rm.provider_name}</td>
                                                <td className="px-2 py-1.5">
                                                    <span className="bg-slate-900 border border-slate-800 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                                        {rm.provider_lot}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 capitalize">
                                                    <div className="flex flex-col">
                                                        <span className="text-white text-[12px]">{rm.egg_type}</span>
                                                        {rm.egg_type === 'huevo cáscara' && (
                                                            <span className="text-[10px] text-slate-500">Color: {rm.egg_color} | Talla: {rm.egg_size}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-right font-black text-white text-[11px]">
                                                    {parseFloat(rm.weight_lbs).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2 py-1.5 text-right font-bold text-[11px]">
                                                    <span className={parseFloat(rm.stock_lbs || 0) <= 0 ? 'text-rose-500' : parseFloat(rm.stock_lbs) < 1000 ? 'text-amber-400' : 'text-teal-400'}>
                                                        {parseFloat(rm.stock_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                        parseFloat(rm.temperature_c) > 6.0 
                                                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                                                            : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                                    }`}>
                                                        {rm.temperature_c}°C
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight">
                                                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full font-black ${getStatusBadge(rm.status)}`}>
                                                            {getStatusIcon(rm.status)}
                                                            {rm.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-400 flex items-center gap-1 text-[9px]">
                                                            <User size={9} />
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
                                                                        className="text-indigo-400 hover:text-indigo-300 text-[9px] underline font-bold flex items-center gap-0.5"
                                                                    >
                                                                        <FileText size={9} />
                                                                        Cert #{idx + 1}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {rm.status !== 'anulado' && (
                                                            <button
                                                                onClick={() => handleEdit(rm)}
                                                                className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/20 transition-colors"
                                                                title="Editar"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                        )}
                                                        {rm.status !== 'anulado' && parseFloat(rm.stock_lbs || 0) >= parseFloat(rm.weight_lbs || 0) && (
                                                            <button
                                                                onClick={() => setVoidConfirmId(rm.id)}
                                                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/20 transition-colors"
                                                                title="Anular"
                                                            >
                                                                <Ban size={12} />
                                                            </button>
                                                        )}
                                                        {rm.status === 'anulado' && (
                                                            <span className="text-[10px] text-slate-600 font-semibold italic">Anulado</span>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-indigo-400" />
                            Editar Recepción de Materia Prima
                        </h2>
                        <form onSubmit={handleEditSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Proveedor de Origen</label>
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
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Fecha de Recepción</label>
                                    <input
                                        type="date"
                                        value={editForm.fecha}
                                        onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Huevo</label>
                                    <select
                                        value={editForm.egg_type}
                                        onChange={(e) => setEditForm({ ...editForm, egg_type: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="huevo cáscara">Huevo en Cáscara</option>
                                        <option value="huevo líquido">Huevo Líquido</option>
                                        <option value="clara">Clara Líquida</option>
                                        <option value="yema">Yema Líquida</option>
                                    </select>
                                </div>
                                {editForm.egg_type === 'huevo cáscara' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Color del Huevo</label>
                                            <select
                                                value={editForm.egg_color}
                                                onChange={(e) => setEditForm({ ...editForm, egg_color: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="blanco">Blanco</option>
                                                <option value="marrón">Marrón</option>
                                                <option value="mixto">Mixto</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tamaño</label>
                                            <select
                                                value={editForm.egg_size}
                                                onChange={(e) => setEditForm({ ...editForm, egg_size: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="S">S (Chico)</option>
                                                <option value="M">M (Mediano)</option>
                                                <option value="L">L (Grande)</option>
                                                <option value="XL">XL (Extra Grande)</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Peso Recibido (Libras)</label>
                                    <input type="number" value={editForm.weight_lbs} onChange={(e) => setEditForm({ ...editForm, weight_lbs: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500" step="0.01" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Temperatura en Sensor (°C)</label>
                                    <input type="number" value={editForm.temperature_c} onChange={(e) => setEditForm({ ...editForm, temperature_c: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500" step="0.01" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Lote del Proveedor</label>
                                    <input type="text" value={editForm.provider_lot} onChange={(e) => setEditForm({ ...editForm, provider_lot: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado Inicial Calidad</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="aprobado">Aprobado para Producción</option>
                                        <option value="cuarentena">En Cuarentena</option>
                                        <option value="rechazado">Rechazado (No Apto)</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">URLs de Certificados de Inocuidad (Separados por coma)</label>
                                    <input type="text" value={editForm.certificate_urls} onChange={(e) => setEditForm({ ...editForm, certificate_urls: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500" placeholder="Ej: https://docs.quality.com/cert1.pdf" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingId(null); }} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-extrabold transition-all border border-slate-800">Cancelar</button>
                                <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all border border-indigo-500 disabled:opacity-55">{isSubmitting ? 'Guardando...' : 'Guardar Cambios'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {voidConfirmId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirmar Anulación</h3>
                        </div>
                        <p className="text-xs text-slate-400 mb-6">¿Está seguro de anular esta recepción de materia prima? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setVoidConfirmId(null)} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-extrabold transition-all border border-slate-800">Cancelar</button>
                            <button onClick={() => handleVoid(voidConfirmId)} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-all border border-rose-500">Anular</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EggReception;
