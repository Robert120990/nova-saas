import { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../ui/Modal';
import { 
    Sparkles, 
    AlertTriangle, 
    Scale, 
    Wrench, 
    RefreshCcw, 
    ChevronDown, 
    ChevronUp, 
    User, 
    FileText, 
    Zap,
    Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import EditarClienteDteModal from './EditarClienteDteModal';

export default function DiagnosticoDteModal({ isOpen, onClose, sale, onRetransmit }) {
    const [loading, setLoading] = useState(false);
    const [forceReloading, setForceReloading] = useState(false);
    const [diagnosis, setDiagnosis] = useState(null);
    const [isCached, setIsCached] = useState(false);
    const [showRaw, setShowRaw] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);

    const fetchDiagnosis = async (force = false) => {
        if (!sale?.id) return;
        if (force) {
            setForceReloading(true);
        } else {
            setLoading(true);
        }
        setErrorMsg(null);

        try {
            const url = `/api/sales/${sale.id}/dte-diagnosis${force ? '?force=true' : ''}`;
            const res = await axios.get(url);
            if (res.data?.success && res.data?.data) {
                setDiagnosis(res.data.data);
                setIsCached(Boolean(res.data.cached));
                if (force) {
                    toast.success('Diagnóstico actualizado con IA');
                }
            } else {
                setErrorMsg('No se recibió información de diagnóstico.');
            }
        } catch (err) {
            console.error('Error fetching DTE diagnosis:', err);
            const msg = err.response?.data?.message || err.message || 'Error al obtener diagnóstico con IA';
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
            setForceReloading(false);
        }
    };

    useEffect(() => {
        if (isOpen && sale?.id) {
            setShowRaw(false);
            fetchDiagnosis(false);
        } else {
            setDiagnosis(null);
            setErrorMsg(null);
        }
    }, [isOpen, sale?.id]);

    if (!isOpen || !sale) return null;

    const getTipoCorreccionBadge = (tipo) => {
        switch (tipo) {
            case 'CLIENTE':
                return {
                    label: 'Corrección de Datos del Cliente',
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <User size={13} className="text-blue-600" />
                };
            case 'PRODUCTO':
                return {
                    label: 'Revisión de Ítems / Productos',
                    color: 'bg-purple-50 text-purple-700 border-purple-200',
                    icon: <FileText size={13} className="text-purple-600" />
                };
            case 'EMISOR':
                return {
                    label: 'Configuración de Emisor / Firma',
                    color: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: <AlertTriangle size={13} className="text-amber-600" />
                };
            case 'SISTEMA_MH':
                return {
                    label: 'Intermitencia de Servidores Hacienda',
                    color: 'bg-rose-50 text-rose-700 border-rose-200',
                    icon: <AlertTriangle size={13} className="text-rose-600" />
                };
            default:
                return {
                    label: 'Revisión General de la Venta',
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: <Wrench size={13} className="text-slate-600" />
                };
        }
    };

    const tipoBadge = getTipoCorreccionBadge(diagnosis?.tipo_correccion);

    const handleOpenCustomer = () => {
        setIsEditCustomerOpen(true);
    };

    const handleRetry = () => {
        onClose();
        if (onRetransmit) {
            onRetransmit(sale);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-xl shadow-sm">
                        <Sparkles size={18} className="text-amber-300 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900">Diagnóstico Inteligente DTE</span>
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full border border-rose-200">
                                Rechazado por MH
                            </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                            Análisis tributario asistido por IA sobre normativa del Ministerio de Hacienda
                        </p>
                    </div>
                </div>
            }
            maxWidth="max-w-3xl"
        >
            <div className="space-y-4">
                {/* Resumen del Documento */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Documento</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                                {sale.tipo_documento_name || 'DTE'}
                            </span>
                            {sale.numero_control && (
                                <span className="font-mono text-xs font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                    {sale.numero_control}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cliente / Receptor</span>
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[240px]" title={sale.customer_name}>
                            {sale.customer_name || 'Consumidor Final'}
                        </span>
                        {sale.customer_nit && (
                            <span className="font-mono text-[10px] text-slate-500">NIT: {sale.customer_nit}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {diagnosis?.provider && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-xl text-[10px] font-bold border border-violet-200 shadow-2xs">
                                <Cpu size={12} className="text-violet-600" />
                                {diagnosis.provider === 'deepseek' ? 'DeepSeek AI' : diagnosis.provider === 'gemini' ? 'Gemini AI' : 'Reglas SVFE'}
                            </span>
                        )}
                        {isCached && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold border border-emerald-200" title="Cargado instantáneamente desde el historial en base de datos">
                                <Zap size={11} className="text-emerald-600" />
                                Caché
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => fetchDiagnosis(true)}
                            disabled={loading || forceReloading}
                            className="p-1.5 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                            title="Reanalizar con Inteligencia Artificial"
                        >
                            <RefreshCcw size={14} className={forceReloading ? 'animate-spin text-indigo-600' : ''} />
                        </button>
                    </div>
                </div>

                {/* Error Raw Collapsible */}
                {sale.dte_error && (
                    <div className="border border-rose-200/80 bg-rose-50/50 rounded-2xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowRaw(!showRaw)}
                            className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-rose-100/40 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                                <span className="text-[11px] font-bold text-rose-800">
                                    Respuesta Cruda de Hacienda
                                    {diagnosis?.codigo_msg && (
                                        <span className="ml-2 font-mono font-black text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded">
                                            Código {diagnosis.codigo_msg}
                                        </span>
                                    )}
                                </span>
                            </div>
                            {showRaw ? <ChevronUp size={15} className="text-rose-600" /> : <ChevronDown size={15} className="text-rose-600" />}
                        </button>
                        {showRaw && (
                            <div className="p-3 bg-white border-t border-rose-100">
                                <pre className="font-mono text-[11px] text-slate-700 whitespace-pre-wrap break-all bg-slate-50 p-2.5 rounded-xl max-h-40 overflow-y-auto border border-slate-200/70">
                                    {typeof sale.dte_error === 'object'
                                        ? JSON.stringify(sale.dte_error, null, 2)
                                        : sale.dte_error}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Loading Skeleton */}
                {loading && (
                    <div className="p-8 bg-slate-50/60 rounded-3xl border border-slate-200/60 text-center space-y-4">
                        <div className="inline-flex p-3 bg-indigo-50 rounded-2xl text-indigo-600 animate-pulse">
                            <Sparkles size={28} className="animate-spin text-indigo-600" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800">Consultando especialista DTE con IA...</p>
                            <p className="text-xs text-slate-500">
                                Analizando el motivo de rechazo según las normativas y catálogos de Hacienda
                            </p>
                        </div>
                        <div className="w-48 h-1.5 bg-indigo-100 rounded-full mx-auto overflow-hidden">
                            <div className="w-full h-full bg-indigo-600 animate-progress origin-left" />
                        </div>
                    </div>
                )}

                {/* Error State */}
                {errorMsg && !loading && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-3">
                        <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 flex-1">
                            <p className="font-bold">No se pudo obtener el diagnóstico</p>
                            <p>{errorMsg}</p>
                            <button
                                type="button"
                                onClick={() => fetchDiagnosis(true)}
                                className="mt-2 text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                                <RefreshCcw size={12} /> Reintentar análisis
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Diagnosis Content (3 Structured Cards) */}
                {diagnosis && !loading && (
                    <div className="space-y-3.5">
                        {/* Tipo de corrección Badge */}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Diagnóstico Tributario y Solución
                            </span>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${tipoBadge.color}`}>
                                {tipoBadge.icon}
                                <span>{tipoBadge.label}</span>
                            </div>
                        </div>

                        {/* Card 1: ¿Qué pasó? */}
                        <div className="p-4 bg-gradient-to-br from-rose-50/70 to-orange-50/50 rounded-2xl border border-rose-200/80 shadow-2xs space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-800">
                                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                                <h4 className="text-xs font-black uppercase tracking-wider">1. ¿Qué causó el rechazo?</h4>
                            </div>
                            <p className="text-[13px] text-slate-800 leading-relaxed font-medium pl-6">
                                {diagnosis.que_paso}
                            </p>
                        </div>

                        {/* Card 2: Normativa SVFE */}
                        <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-sky-50/50 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-1.5">
                            <div className="flex items-center gap-2 text-indigo-900">
                                <Scale size={16} className="text-indigo-600 shrink-0" />
                                <h4 className="text-xs font-black uppercase tracking-wider">2. Normativa y Base Legal SVFE</h4>
                            </div>
                            <p className="text-[12.5px] text-slate-700 leading-relaxed pl-6 font-medium">
                                {diagnosis.normativa}
                            </p>
                        </div>

                        {/* Card 3: Solución Paso a Paso */}
                        <div className="p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-2xl border border-emerald-200/90 shadow-2xs space-y-2">
                            <div className="flex items-center gap-2 text-emerald-900">
                                <Wrench size={16} className="text-emerald-600 shrink-0" />
                                <h4 className="text-xs font-black uppercase tracking-wider">3. Solución Paso a Paso en Nova SaaS</h4>
                            </div>
                            <div className="pl-6 space-y-1 text-[13px] text-slate-800 font-medium whitespace-pre-line leading-relaxed">
                                {diagnosis.solucion}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                        Cerrar
                    </button>

                    <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 justify-end">
                        <button
                            type="button"
                            onClick={handleOpenCustomer}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            title="Abrir formulario para corregir datos fiscales del cliente de esta venta"
                        >
                            <User size={13} className="text-indigo-600" />
                            <span>Corregir Cliente</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleRetry}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                        >
                            <RefreshCcw size={13} />
                            <span>Reintentar Transmisión</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal para corregir datos del cliente */}
            {isEditCustomerOpen && (
                <EditarClienteDteModal
                    isOpen={isEditCustomerOpen}
                    onClose={() => setIsEditCustomerOpen(false)}
                    sale={sale}
                    onSaved={({ retransmitted }) => {
                        setIsEditCustomerOpen(false);
                        if (retransmitted) {
                            onClose();
                        } else {
                            fetchDiagnosis(true);
                        }
                    }}
                />
            )}
        </Modal>
    );
}
