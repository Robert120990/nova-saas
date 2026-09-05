import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Calendar
} from 'lucide-react';

const EggProduction = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const companyId = user?.company_id || 1;

    // Lists
    const [batches, setBatches] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [cipLogs, setCipLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Navigation sub-tabs
    const [activeTab, setActiveTab] = useState('batches'); // 'batches', 'cip', 'new-batch', 'pasteurize'

    // Form States
    const [batchForm, setBatchForm] = useState({
        product_type: 'huevo entero',
        presentation: 'cubeta 32LB',
        run_number: 1,
        raw_materials: [],
        ingredients: {
            boxes_count: '',
            water_bottles: '',
            sugar_lbs: '',
            salt_lbs: '',
            citric_acid_lbs: '',
            milk_powder_lbs: '',
            ppg_g: ''
        },
        operator_name: user?.nombre || ''
    });

    const [cipForm, setCipForm] = useState({
        equipment_name: 'pasteurizador',
        chemical_used: 'Ácido Peracético 1.5%',
        temperature_c: '78.5',
        duration_minutes: '45',
        operator_name: user?.nombre || '',
        validation_status: 'completado',
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, rmRes, cRes, cfgRes] = await Promise.all([
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/raw-materials', { params: { only_with_stock: 'true' } }),
                axios.get('/api/egg-industrial/cip'),
                axios.get('/api/egg-industrial/product-config')
            ]);
            setBatches(bRes.data);
            setRawMaterials(rmRes.data.filter(rm => rm.status === 'aprobado'));
            setCipLogs(cRes.data);
            setProductConfig(cfgRes.data);
        } catch (error) {
            console.error('Error fetching production data:', error);
            toast.error('Error al cargar datos del módulo de producción.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Handle new production batch
    const handleCreateBatch = async (e) => {
        e.preventDefault();
        setCipBlockedError(null);

        if (!batchForm.raw_materials || batchForm.raw_materials.length === 0) {
            return toast.error('Debe agregar al menos una materia prima.');
        }

        const totalWeight = batchForm.raw_materials.reduce((sum, rm) => sum + parseFloat(rm.quantity_lbs || 0), 0);
        if (totalWeight <= 0) {
            return toast.error('El peso total debe ser mayor a cero.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/batches', {
                ...batchForm,
                run_number: parseInt(batchForm.run_number) || 1,
                raw_materials: batchForm.raw_materials,
                ingredients: batchForm.ingredients
            });
            toast.success('Lote de producción iniciado exitosamente.');
            setBatchForm({
                product_type: 'huevo entero',
                presentation: 'cubeta 32LB',
                run_number: 1,
                raw_materials: [],
                ingredients: {
                    boxes_count: '',
                    water_bottles: '',
                    sugar_lbs: '',
                    salt_lbs: '',
                    citric_acid_lbs: '',
                    milk_powder_lbs: '',
                    ppg_g: ''
                },
                operator_name: user?.nombre || ''
            });
            fetchData();
            setIsNewBatchModalOpen(false);
        } catch (error) {
            console.error('Error creating production batch:', error);
            setCipBlockedError(error.response?.data?.message || 'Error al iniciar el lote.');
            toast.error(error.response?.data?.message || 'Error al iniciar lote de producción.');
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
                duration_minutes: parseInt(cipForm.duration_minutes)
            });
            toast.success('Registro de sanitización CIP guardado.');
            setCipForm({
                equipment_name: 'pasteurizador',
                chemical_used: 'Ácido Peracético 1.5%',
                temperature_c: '78.5',
                duration_minutes: '45',
                operator_name: user?.nombre || '',
                validation_status: 'completado',
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

    // Handle complete batch
    const handleCompleteBatch = async (e) => {
        e.preventDefault();
        if (!completeForm.yield_liquid_lbs || parseFloat(completeForm.yield_liquid_lbs) <= 0) {
            return toast.error('Debe ingresar el rendimiento líquido.');
        }

        setIsSubmitting(true);
        try {
            await axios.put(`/api/egg-industrial/batches/${selectedBatchForComplete.id}/complete`, {
                yield_liquid_lbs: parseFloat(completeForm.yield_liquid_lbs),
                waste_shell_lbs: parseFloat(completeForm.waste_shell_lbs || 0),
                waste_loss_lbs: parseFloat(completeForm.waste_loss_lbs || 0)
            });
            toast.success('Lote finalizado correctamente.');
            setSelectedBatchForComplete(null);
            setCompleteForm({ yield_liquid_lbs: '', waste_shell_lbs: '', waste_loss_lbs: '' });
            fetchData();
        } catch (error) {
            console.error('Error completing batch:', error);
            toast.error('Error al finalizar el lote.');
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

    const filteredBatches = batches.filter(b =>
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
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'batches' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Lotes de Producción
                    </button>
                    <button
                        onClick={() => { setActiveTab('cip'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'cip' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
                        onClick={() => { setIsNewBatchModalOpen(true); setCipBlockedError(null); }}
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
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-mono text-[10px] text-slate-500 select-all truncate max-w-[180px]">{b.batch_uuid}</span>
                                                        <button
                                                            onClick={() => { navigator.clipboard.writeText(b.batch_code_display || b.batch_uuid); toast.success('Lote copiado'); }}
                                                            className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                                                            title="Copiar Lote"
                                                        >
                                                            <Copy size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-bold text-slate-900 text-xs capitalize">{b.product_type}</div>
                                                {b.raw_materials && b.raw_materials.length > 0 && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                        {b.raw_materials.map(m => `${m.egg_type} (${parseFloat(m.quantity_lbs).toFixed(0)} Lbs)`).join(', ')}
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
                                                {b.status === 'pasteurizado' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBatchForComplete(b);
                                                            const cfg = productConfig.find(c => c.product_type === b.product_type) || {};
                                                            const yieldPct = parseFloat(cfg.yield_pct || 85) / 100;
                                                            const shellPct = parseFloat(cfg.waste_shell_pct || 12) / 100;
                                                            const lossPct = parseFloat(cfg.waste_loss_pct || 3) / 100;
                                                            setCompleteForm({
                                                                yield_liquid_lbs: (parseFloat(b.input_weight_lbs) * yieldPct).toFixed(2),
                                                                waste_shell_lbs: (parseFloat(b.input_weight_lbs) * shellPct).toFixed(2),
                                                                waste_loss_lbs: (parseFloat(b.input_weight_lbs) * lossPct).toFixed(2)
                                                            });
                                                        }}
                                                        className="px-3 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-lg text-xs font-bold transition-all shadow-xs"
                                                    >
                                                        Balance
                                                    </button>
                                                )}
                                                {b.status === 'en_proceso' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBatchForPasteurize(b.id);
                                                            setIsPasteurizeModalOpen(true);
                                                        }}
                                                        className="px-3 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 mx-auto shadow-xs"
                                                    >
                                                        <Flame size={12} />
                                                        Pasteurizar
                                                    </button>
                                                )}
                                                {b.status === 'bloqueado_haccp' && (
                                                    <span className="text-rose-600 font-bold text-xs flex items-center justify-center gap-1">
                                                        <Lock size={12} />
                                                        Bloqueado
                                                    </span>
                                                )}
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
                            {cipLogs.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-6">No hay registros de limpieza disponibles.</p>
                            ) : cipLogs.map(log => (
                                <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                log.validation_status === 'completado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {log.validation_status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 font-medium">{log.notes || 'Sin anotaciones adicionales.'}</p>
                                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
                                            <span>Químico: <b className="text-slate-700">{log.chemical_used}</b></span>
                                            <span>Operador: <b className="text-slate-700">{log.operator_name}</b></span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className="text-[11px] text-slate-500 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                                        <div className="flex gap-2 text-xs mt-2">
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
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Plus className="h-5 w-5 text-emerald-600" />
                            Iniciar Nueva Producción
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">El pasteurizador debe contar con una limpieza CIP aprobada en las últimas 12 horas.</p>
                        <div className="h-px bg-slate-100 mt-4" />
                    </div>

                    {/* CIP Block Warning Alert */}
                    {cipBlockedError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2 text-rose-800">
                            <div className="flex gap-2 items-center font-bold text-xs uppercase tracking-wide">
                                <AlertOctagon size={16} className="text-rose-600" />
                                ALERTA DE INOCUIDAD: BLOQUEO POR SANITIZACIÓN CIP
                            </div>
                            <p className="text-xs leading-relaxed">{cipBlockedError}</p>
                            <button
                                onClick={() => { setActiveTab('cip'); setCipBlockedError(null); }}
                                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold transition-all"
                            >
                                Registrar Sanitización CIP Ahora
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleCreateBatch} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Corrida del Día</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="99"
                                    value={batchForm.run_number}
                                    onChange={(e) => setBatchForm({ ...batchForm, run_number: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    placeholder="Ej: 1"
                                />
                                <span className="text-[10px] text-indigo-600 font-medium block mt-1">Lote juliano: {String(batchForm.run_number || 1).padStart(2, '0')} - [Día] - 26</span>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Producto a Fabricar</label>
                                <select
                                    value={batchForm.product_type}
                                    onChange={(e) => setBatchForm({ ...batchForm, product_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="huevo entero">Huevo Entero Pasteurizado</option>
                                    <option value="clara">Clara Pasteurizada</option>
                                    <option value="yema salada">Yema Líquida Salada (10% sal)</option>
                                    <option value="yema azucarada">Yema Líquida Azucarada (10% azúcar)</option>
                                    <option value="fórmula especial">Fórmula Especial / HE Plus (18-21% sol)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Presentación Comercial</label>
                                <select
                                    value={batchForm.presentation}
                                    onChange={(e) => setBatchForm({ ...batchForm, presentation: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="cubeta 30LB">Cubeta Industrial (30 Lbs - Estándar)</option>
                                    <option value="cubeta 32LB">Cubeta Industrial (32 Lbs)</option>
                                    <option value="galón 8LB">Galón (8 Lbs)</option>
                                    <option value="medio galón 4LB">Medio Galón (4 Lbs)</option>
                                    <option value="litro 2LB">Litro (2 Lbs)</option>
                                </select>
                            </div>
                        </div>

                        {/* Materias Primas */}
                        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Materia Prima Base (Lotes en Recepción)</label>
                                <span className="text-xs font-bold text-emerald-700">
                                    Total: {batchForm.raw_materials.reduce((s, rm) => s + parseFloat(rm.quantity_lbs || 0), 0).toFixed(2)} Lbs
                                </span>
                            </div>
                            {batchForm.raw_materials.map((rm, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2.5">
                                    <select
                                        value={rm.raw_material_id}
                                        onChange={(e) => {
                                            const updated = [...batchForm.raw_materials];
                                            updated[idx].raw_material_id = e.target.value;
                                            setBatchForm({ ...batchForm, raw_materials: updated });
                                        }}
                                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Seleccionar lote recepcionado...</option>
                                        {rawMaterials.map(m => (
                                            <option key={m.id} value={m.id} disabled={batchForm.raw_materials.some((r, i) => i !== idx && r.raw_material_id === String(m.id))}>
                                                {m.egg_type} - Lote: {m.provider_lot} (Stock: {parseFloat(m.stock_lbs || 0).toFixed(0)} Lbs)
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        value={rm.quantity_lbs}
                                        onChange={(e) => {
                                            const updated = [...batchForm.raw_materials];
                                            updated[idx].quantity_lbs = e.target.value;
                                            setBatchForm({ ...batchForm, raw_materials: updated });
                                        }}
                                        className="w-28 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold focus:outline-none text-right"
                                        placeholder="Lbs"
                                        step="0.01"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setBatchForm({ ...batchForm, raw_materials: batchForm.raw_materials.filter((_, i) => i !== idx) });
                                        }}
                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                        title="Eliminar línea"
                                    >
                                        <XCircle size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setBatchForm({ ...batchForm, raw_materials: [...batchForm.raw_materials, { raw_material_id: '', quantity_lbs: '' }] })}
                                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200 flex items-center justify-center gap-1.5"
                            >
                                <Plus size={14} />
                                Agregar Lote de Materia Prima
                            </button>
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
                                    <label className="text-[10px] text-slate-600 font-bold uppercase block mb-1">Agua (Garrafones)</label>
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

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsNewBatchModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                {isSubmitting ? 'Iniciando...' : 'Iniciar Lote'}
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
                                {batches.filter(b => b.status === 'en_proceso').map(b => (
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
                                <span className="text-xs font-bold text-slate-900">{parseFloat(selectedBatchForComplete.input_weight_lbs).toLocaleString()} Lbs</span>
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
        </div>
    );
};

export default EggProduction;
