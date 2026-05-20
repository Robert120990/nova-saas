import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
    Activity,
    Plus,
    FileSpreadsheet,
    Flame,
    Droplets,
    ShieldAlert,
    CheckCircle,
    XCircle,
    ClipboardList,
    Clock,
    Wrench,
    AlertOctagon,
    ArrowRight,
    Lock
} from 'lucide-react';

const EggProduction = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    // Lists
    const [batches, setBatches] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [cipLogs, setCipLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Navigation sub-tabs
    const [activeTab, setActiveTab] = useState('batches'); // 'batches', 'cip', 'new-batch', 'pasteurize'

    // Form States
    const [batchForm, setBatchForm] = useState({
        product_type: 'huevo entero',
        presentation: 'cubeta 32LB',
        raw_material_id: '',
        input_weight_lbs: '',
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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bRes, rmRes, cRes] = await Promise.all([
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/raw-materials'),
                axios.get('/api/egg-industrial/cip')
            ]);
            setBatches(bRes.data);
            setRawMaterials(rmRes.data.filter(rm => rm.status === 'aprobado'));
            setCipLogs(cRes.data);
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

        if (!batchForm.raw_material_id) {
            return toast.error('Debe seleccionar la materia prima de origen.');
        }
        if (!batchForm.input_weight_lbs || parseFloat(batchForm.input_weight_lbs) <= 0) {
            return toast.error('El peso de entrada debe ser mayor a cero.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/batches', {
                ...batchForm,
                input_weight_lbs: parseFloat(batchForm.input_weight_lbs)
            });
            toast.success('Lote de producción iniciado exitosamente.');
            setBatchForm({
                product_type: 'huevo entero',
                presentation: 'cubeta 32LB',
                raw_material_id: '',
                input_weight_lbs: '',
                operator_name: user?.nombre || ''
            });
            fetchData();
            setIsNewBatchModalOpen(false);
        } catch (error) {
            console.error('Error starting production batch:', error);
            if (error.response?.status === 400 && error.response?.data?.message?.includes('BLOQUEO')) {
                // CIP Block Rule
                setCipBlockedError(error.response.data.message);
                toast.error('BLOQUEO CIP: Sanitización requerida.');
            } else {
                toast.error(error.response?.data?.message || 'Error al iniciar el lote.');
            }
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
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            case 'pasteurizado':
                return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
            case 'empaquetado':
                return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
            case 'congelado':
                return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse';
            case 'bloqueado_haccp':
                return 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse font-black';
            case 'aprobado_calidad':
                return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
            default:
                return 'bg-slate-800 text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500">
                        <Flame className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Sala de Producción y Pasteurización</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Monitoreo de limpieza CIP, inocuidad HACCP, control térmico de pasteurizadores y balance de masas</p>
                    </div>
                </div>
            </div>

            {/* Custom Tab Selectors */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-900 w-fit">
                <button
                    onClick={() => { setActiveTab('batches'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'batches' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Lotes de Producción
                </button>
                <button
                    onClick={() => { setActiveTab('cip'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'cip' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    Registros CIP
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => { setIsNewBatchModalOpen(true); setCipBlockedError(null); }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 flex items-center gap-1.5 shadow-lg shadow-teal-600/15"
                >
                    <Plus size={14} />
                    Iniciar Nuevo Lote
                </button>
                <button
                    onClick={() => { setIsPasteurizeModalOpen(true); setHaccpViolationAlert(null); }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-extrabold transition-all border border-orange-500 flex items-center gap-1.5 shadow-lg shadow-orange-600/15"
                >
                    <Flame size={14} />
                    Pasteurizar
                </button>
            </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'batches' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-indigo-400" />
                        Historial de Procesamiento por Lotes
                    </h2>
                    <div className="h-px bg-slate-800" />

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Cargando lotes de producción...
                            </div>
                        ) : batches.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                                No hay lotes de producción registrados.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                                        <th className="p-4">UUID de Trazabilidad</th>
                                        <th className="p-4">Producto</th>
                                        <th className="p-4">Presentación</th>
                                        <th className="p-4 text-right">Peso Entrada (Lbs)</th>
                                        <th className="p-4 text-right">Rendimiento (Lbs)</th>
                                        <th className="p-4 text-center">Estado Lote</th>
                                        <th className="p-4 min-w-[200px]">Inicio / Fin</th>
                                        <th className="p-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                                    {batches.map(b => (
                                        <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                                            <td className="p-4 font-mono text-[10px] text-slate-400 select-all">{b.batch_uuid}</td>
                                            <td className="p-4 font-bold text-white capitalize">{b.product_type}</td>
                                            <td className="p-4 font-semibold text-slate-400">{b.presentation}</td>
                                            <td className="p-4 text-right text-white font-bold">{parseFloat(b.input_weight_lbs).toLocaleString()}</td>
                                            <td className="p-4 text-right text-teal-400 font-black">
                                                {b.yield_liquid_lbs > 0 ? parseFloat(b.yield_liquid_lbs).toLocaleString() : '-'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${getBatchStatusBadge(b.status)}`}>
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-[10px] text-slate-400 space-y-1 min-w-[200px] whitespace-nowrap">
                                                <div>
                                                    <span className="text-slate-500 font-extrabold block uppercase text-[8px]">Iniciado:</span>
                                                    {new Date(b.started_at).toLocaleString()}
                                                </div>
                                                {b.completed_at && (
                                                    <div>
                                                        <span className="text-slate-500 font-extrabold block uppercase text-[8px]">Completado:</span>
                                                        {new Date(b.completed_at).toLocaleString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {b.status === 'pasteurizado' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBatchForComplete(b);
                                                            setCompleteForm({
                                                                yield_liquid_lbs: (parseFloat(b.input_weight_lbs) * 0.85).toFixed(2),
                                                                waste_shell_lbs: (parseFloat(b.input_weight_lbs) * 0.12).toFixed(2),
                                                                waste_loss_lbs: (parseFloat(b.input_weight_lbs) * 0.03).toFixed(2)
                                                            });
                                                        }}
                                                        className="px-3 py-1 bg-teal-600/10 hover:bg-teal-600/25 border border-teal-500/20 text-teal-400 hover:text-teal-300 rounded-lg text-[10px] font-extrabold transition-all"
                                                    >
                                                        Finalizar Balance
                                                    </button>
                                                )}
                                                {b.status === 'en_proceso' && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedBatchForPasteurize(b.id);
                                                            setIsPasteurizeModalOpen(true);
                                                        }}
                                                        className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 hover:text-amber-300 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 mx-auto"
                                                    >
                                                        <Flame size={10} />
                                                        Pasteurizar
                                                    </button>
                                                )}
                                                {b.status === 'bloqueado_haccp' && (
                                                    <span className="text-rose-500 font-bold text-[10px] flex items-center justify-center gap-0.5">
                                                        <Lock size={10} />
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
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-fit space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-teal-400" />
                                Registrar Limpieza CIP
                            </h2>
                            <div className="h-px bg-slate-800" />
                        </div>

                        <form onSubmit={handleCreateCip} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipo Sanitizado</label>
                                <select
                                    value={cipForm.equipment_name}
                                    onChange={(e) => setCipForm({ ...cipForm, equipment_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="pasteurizador">Pasteurizador de Placas</option>
                                    <option value="quebradora">Quebradora Centrífuga</option>
                                    <option value="tanque holding 1">Tanque Pulmón 1</option>
                                    <option value="tanque holding 2">Tanque Pulmón 2</option>
                                    <option value="llenadora">Envasadora de Llenado</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Agente Químico Sanitizante</label>
                                <input
                                    type="text"
                                    value={cipForm.chemical_used}
                                    onChange={(e) => setCipForm({ ...cipForm, chemical_used: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    placeholder="Ej: Ácido Peracético 1.5%"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Temp Limpieza (°C)</label>
                                    <input
                                        type="number"
                                        value={cipForm.temperature_c}
                                        onChange={(e) => setCipForm({ ...cipForm, temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: 78.5"
                                        step="0.01"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Duración (Minutos)</label>
                                    <input
                                        type="number"
                                        value={cipForm.duration_minutes}
                                        onChange={(e) => setCipForm({ ...cipForm, duration_minutes: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: 45"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado de Validación</label>
                                <select
                                    value={cipForm.validation_status}
                                    onChange={(e) => setCipForm({ ...cipForm, validation_status: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="completado">Completado & Aprobado</option>
                                    <option value="fallido">Fallido / Requiere Reinicio</option>
                                    <option value="pendiente">Pendiente de Aprobación</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Notas de Bitácora</label>
                                <textarea
                                    value={cipForm.notes}
                                    onChange={(e) => setCipForm({ ...cipForm, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 h-20"
                                    placeholder="Detalles sobre enjuague, conductividad..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 shadow-lg shadow-teal-600/15"
                            >
                                Registrar Limpieza
                            </button>
                        </form>
                    </div>

                    {/* CIP History */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-400" />
                            Historial CIP Reciente (Habilita el arranque de planta)
                        </h2>
                        <div className="h-px bg-slate-800" />

                        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                            {cipLogs.map(log => (
                                <div key={log.id} className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white capitalize">{log.equipment_name}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                log.validation_status === 'completado' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                            }`}>
                                                {log.validation_status}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-semibold">{log.notes || 'Sin anotaciones adicionales.'}</p>
                                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                                            <span>Químico: <b>{log.chemical_used}</b></span>
                                            <span>Operador: <b>{log.operator_name}</b></span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className="text-[10px] text-slate-500 font-semibold">{new Date(log.created_at).toLocaleString()}</span>
                                        <div className="flex gap-3 text-xs mt-2">
                                            <div className="text-center bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl">
                                                <span className="text-[8px] font-black block text-slate-500 uppercase">Temp</span>
                                                <span className="text-[11px] font-bold text-white">{log.temperature_c}°C</span>
                                            </div>
                                            <div className="text-center bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl">
                                                <span className="text-[8px] font-black block text-slate-500 uppercase">Tiempo</span>
                                                <span className="text-[11px] font-bold text-white">{log.duration_minutes}m</span>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-6">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-teal-400" />
                            Iniciar Lote de Producción
                        </h2>
                        <p className="text-[11px] text-slate-400">Recuerde que el pasteurizador debe contar con una limpieza CIP válida en las últimas 12 horas.</p>
                        <div className="h-px bg-slate-800 mt-4" />
                    </div>

                    {/* CIP Block Warning Alert */}
                    {cipBlockedError && (
                        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 space-y-2 text-rose-400 animate-pulse">
                            <div className="flex gap-2 items-center font-black text-xs uppercase tracking-wider">
                                <AlertOctagon size={16} />
                                ALERTA CRÍTICA DE PLANTA: BLOQUEO DE ARRANQUE CIP
                            </div>
                            <p className="text-[11px] font-bold leading-relaxed">{cipBlockedError}</p>
                            <button
                                onClick={() => { setActiveTab('cip'); setCipBlockedError(null); }}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl text-[10px] font-extrabold transition-all"
                            >
                                Registrar Sanitización CIP Ahora
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleCreateBatch} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Producto a Fabricar</label>
                                <select
                                    value={batchForm.product_type}
                                    onChange={(e) => setBatchForm({ ...batchForm, product_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                >
                                    <option value="huevo entero">Huevo Entero Pasteurizado</option>
                                    <option value="clara">Clara Pasteurizada</option>
                                    <option value="yema salada">Yema Líquida Salada (10% sal)</option>
                                    <option value="yema azucarada">Yema Líquida Azucarada (10% azúcar)</option>
                                    <option value="fórmula especial">Fórmula Especial / Mezcla Premium</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Presentación Comercial</label>
                                <select
                                    value={batchForm.presentation}
                                    onChange={(e) => setBatchForm({ ...batchForm, presentation: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                >
                                    <option value="cubeta 32LB">Cubeta Industrial (32 Lbs)</option>
                                    <option value="galón 8LB">Galón (8 Lbs)</option>
                                    <option value="medio galón 4LB">Medio Galón (4 Lbs)</option>
                                    <option value="litro 2LB">Litro (2 Lbs)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Materia Prima de Entrada Aprobada</label>
                                <select
                                    value={batchForm.raw_material_id}
                                    onChange={(e) => setBatchForm({ ...batchForm, raw_material_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                >
                                    <option value="">Seleccione Materia Prima...</option>
                                    {rawMaterials.map(rm => (
                                        <option key={rm.id} value={rm.id}>
                                            {rm.provider_lot} - {rm.egg_type} ({rm.weight_lbs} Lbs libres)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peso a Procesar (Libras)</label>
                                <input
                                    type="number"
                                    value={batchForm.input_weight_lbs}
                                    onChange={(e) => setBatchForm({ ...batchForm, input_weight_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    placeholder="Ej: 12000"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsNewBatchModalOpen(false)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all border border-indigo-500 shadow-lg shadow-indigo-600/15"
                            >
                                {isSubmitting ? 'Iniciando...' : 'Iniciar Lote'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {isPasteurizeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-6">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Flame className="h-4 w-4 text-orange-400" />
                            Registro de Parámetros Críticos (HACCP PCC)
                        </h2>
                        <p className="text-[11px] text-slate-400">Verifique los termómetros y flujómetros del PLC antes de registrar la telemetría.</p>
                        <div className="h-px bg-slate-800 mt-4" />
                    </div>

                    {/* Glowing HACCP Failure Alert Box */}
                    {haccpViolationAlert && (
                        <div className="bg-rose-500/10 border-2 border-rose-500 rounded-2xl p-4 text-rose-500 animate-pulse space-y-3 shadow-lg shadow-rose-500/10">
                            <div className="flex gap-2 items-center font-black text-sm uppercase tracking-wider">
                                <AlertOctagon size={20} className="text-rose-500 animate-bounce" />
                                SISTEMA DE INOCUIDAD ALIMENTARIA: ALERTA DE FALLA HACCP
                            </div>
                            <p className="text-[12px] font-black leading-relaxed">{haccpViolationAlert}</p>
                            <p className="text-[11px] font-semibold text-rose-400">
                                <b>ACCIÓN AUTOMÁTICA DEL SISTEMA:</b> El lote de producción ha sido BLOQUEADO para empaque comercial. La válvula de desvío del pasteurizador se ha activado y se ha inyectado un evento crítico en la bitácora de auditoría digital.
                            </p>
                            <button
                                onClick={() => { setHaccpViolationAlert(null); setIsPasteurizeModalOpen(false); }}
                                className="px-4 py-2 bg-rose-600 text-white border border-rose-500 rounded-xl text-[10px] font-extrabold hover:bg-rose-500 transition-all shadow-md"
                            >
                                Volver al Historial y Ver Bloqueo
                            </button>
                        </div>
                    )}

                    <form onSubmit={handlePasteurize} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lote Activo a Pasteurizar</label>
                            <select
                                value={selectedBatchForPasteurize}
                                onChange={(e) => setSelectedBatchForPasteurize(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                            >
                                <option value="">Seleccione Lote Activo...</option>
                                {batches.filter(b => b.status === 'en_proceso').map(b => (
                                    <option key={b.id} value={b.id}>
                                        Lote: {b.batch_uuid.slice(0, 8)}... - {b.product_type} ({b.presentation})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Temperatura Pasteurización (°C)</label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.temperature_c}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, temperature_c: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    step="0.01"
                                    placeholder="Ej: 64.5"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tiempo de Retención (Segundos)</label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.holding_time_seconds}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, holding_time_seconds: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    placeholder="Ej: 210"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Presión Hidráulica (PSI)</label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.pressure_psi}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, pressure_psi: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    step="0.01"
                                    placeholder="Ej: 48.0"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Flujo de Bomba (GPM)</label>
                                <input
                                    type="number"
                                    value={pasteurizeForm.flow_rate_gpm}
                                    onChange={(e) => setPasteurizeForm({ ...pasteurizeForm, flow_rate_gpm: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    step="0.01"
                                    placeholder="Ej: 12.5"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsPasteurizeModalOpen(false)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-extrabold transition-all border border-amber-500 shadow-lg shadow-amber-600/15"
                            >
                                {isSubmitting ? 'Validando...' : 'Validar & Guardar Log'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {/* BALANCE DE MASAS DIALOG MODAL */}
            {selectedBatchForComplete && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-6">
                        <div>
                            <h3 className="text-base font-black text-white uppercase tracking-wider">Balance de Masas & Finalización de Lote</h3>
                            <p className="text-[11px] text-slate-400 mt-1">Lote: <b>{selectedBatchForComplete.batch_uuid}</b></p>
                        </div>
                        <div className="h-px bg-slate-800" />

                        <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-850">
                            <div className="text-center">
                                <span className="text-[9px] font-black text-slate-500 block uppercase">Entrada Raw</span>
                                <span className="text-xs font-bold text-white">{parseFloat(selectedBatchForComplete.input_weight_lbs).toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[9px] font-black text-slate-500 block uppercase">Producto Esperado</span>
                                <span className="text-xs font-bold text-indigo-400">~{(parseFloat(selectedBatchForComplete.input_weight_lbs) * 0.86).toLocaleString()} Lbs</span>
                            </div>
                            <div className="text-center">
                                <span className="text-[9px] font-black text-slate-500 block uppercase">Cáscaras/Pérdidas</span>
                                <span className="text-xs font-bold text-slate-400">~{(parseFloat(selectedBatchForComplete.input_weight_lbs) * 0.14).toLocaleString()} Lbs</span>
                            </div>
                        </div>

                        <form onSubmit={handleCompleteBatch} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Rendimiento Líquido Logrado (Lbs)</label>
                                <input
                                    type="number"
                                    value={completeForm.yield_liquid_lbs}
                                    onChange={(e) => setCompleteForm({ ...completeForm, yield_liquid_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                    placeholder="Ej: 10320"
                                    step="0.01"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Desperdicio Cáscara (Lbs)</label>
                                    <input
                                        type="number"
                                        value={completeForm.waste_shell_lbs}
                                        onChange={(e) => setCompleteForm({ ...completeForm, waste_shell_lbs: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: 1440"
                                        step="0.01"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Mermas de Proceso (Lbs)</label>
                                    <input
                                        type="number"
                                        value={completeForm.waste_loss_lbs}
                                        onChange={(e) => setCompleteForm({ ...completeForm, waste_loss_lbs: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: 240"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedBatchForComplete(null)}
                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 shadow-lg"
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
