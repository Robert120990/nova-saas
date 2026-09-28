import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Zap, X, Search, RefreshCw, Loader2, CheckCircle2, Clock, AlertCircle, AlertTriangle, Radio } from 'lucide-react';
import { unwrapList } from '../../utils/apiUtils';
import { formatDate } from '../../utils/dateUtils';
import GasFusionAgentModal from './GasFusionAgentModal';

const GasFusionPeriodsModal = ({
    isOpen,
    onClose,
    onSelectPeriod,
    loading = false,
    branchId = null
}) => {
    const [statusFilter, setStatusFilter] = useState('cerrado');
    const [searchTerm, setSearchTerm] = useState('');
    const [limit, setLimit] = useState(3);
    const [selectingId, setSelectingId] = useState(null);
    const [showAgentModal, setShowAgentModal] = useState(false);

    const {
        data: periodsData,
        isLoading,
        isError,
        error,
        refetch,
        isFetching
    } = useQuery({
        queryKey: ['gas-fusion-periods', branchId, limit],
        queryFn: async () => unwrapList(await axios.get('/api/gas-station/fusion/periods', {
            params: { limit, branch_id: branchId }
        })),
        enabled: isOpen,
        staleTime: 15000,
        retry: 1
    });

    const { data: agentStatus } = useQuery({
        queryKey: ['gas-fusion-agent-status-periods', branchId],
        queryFn: async () => (!branchId ? null : (await axios.get('/api/gas-station/fusion/agent-status', {
            params: { branch_id: branchId }
        })).data),
        enabled: isOpen && Boolean(branchId),
        refetchInterval: isOpen ? 6000 : false
    });

    const periodsList = useMemo(() => {
        const raw = Array.isArray(periodsData) ? periodsData : [];
        const term = searchTerm.trim().toLowerCase();
        return raw.filter(p => {
            if (statusFilter === 'cerrado' && !p.isClosed) return false;
            if (statusFilter === 'abierto' && p.isClosed) return false;
            if (!term) return true;
            return String(p.id).includes(term) ||
                String(p.startFormatted || '').toLowerCase().includes(term) ||
                String(p.endFormatted || '').toLowerCase().includes(term) ||
                (p.usedInCloseout ? String(p.usedInCloseout.closeoutId).includes(term) : false);
        });
    }, [periodsData, statusFilter, searchTerm]);

    if (!isOpen) return null;

    const handleSelect = async (period) => {
        if (period.usedInCloseout) {
            const confirmed = window.confirm(
                `Atención: El turno #${period.id} de Fusion ya fue utilizado previamente en el Cierre #${period.usedInCloseout.closeoutId} (Turno #${period.usedInCloseout.numero_turno} — ${formatDate(period.usedInCloseout.fecha_turno)}).\n\n¿Está seguro de que desea volver a importarlo en este cierre?`
            );
            if (!confirmed) return;
        }

        setSelectingId(period.id);
        try {
            await onSelectPeriod(period);
        } finally {
            setSelectingId(null);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Cabecera */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                            <Zap size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-slate-800">
                                    Turnos Fusion FFC
                                </h3>
                                {branchId && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAgentModal(true)}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                                            agentStatus?.connected
                                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                        }`}
                                        title="Haga clic para ver el estado del Conector Local o descargarlo"
                                    >
                                        <Radio size={10} className={agentStatus?.connected ? 'animate-pulse text-emerald-600' : 'text-amber-600'} />
                                        {agentStatus?.connected ? 'Conector En Línea' : 'Conector Desconectado'}
                                    </button>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Controlador Wayne / Dover Fueling Solutions (10.19.4.15)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
                            title="Actualizar lista de turnos"
                        >
                            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Filtros y Selector de Límite */}
                <div className="px-5 py-2.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold text-slate-600">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('cerrado')}
                                className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'cerrado' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'hover:text-slate-900'}`}
                            >
                                Turnos Cerrados
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('todos')}
                                className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'todos' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'}`}
                            >
                                Todos
                            </button>
                        </div>

                        {/* Desplegable para limitar consulta a Fusion */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Mostrar:</span>
                            <select
                                value={limit}
                                onChange={(e) => setLimit(Number(e.target.value))}
                                className="bg-transparent text-slate-700 text-xs font-bold focus:outline-none cursor-pointer"
                                title="Seleccionar cantidad de turnos a cargar para no saturar Fusion"
                            >
                                {[3, 5, 10, 20, 50].map(v => <option key={v} value={v}>{v} turnos</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="relative flex-1 min-w-[150px] max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar # turno o fecha..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                        />
                    </div>
                </div>

                {/* Cuerpo / Listado */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="py-16 text-center space-y-3">
                            <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto" />
                            <p className="text-xs font-medium text-slate-600">
                                Consultando controlador Fusion FFC (últimos {limit} turnos)...
                            </p>
                        </div>
                    ) : isError ? (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 space-y-2.5">
                            <div className="flex items-center gap-2 font-bold text-xs">
                                <AlertCircle size={16} />
                                <span>Error de comunicación con Fusion</span>
                            </div>
                            <p className="text-xs leading-relaxed">
                                {error?.response?.data?.message || error?.message || 'No se pudo contactar con el controlador Fusion en la red local.'}
                            </p>
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => refetch()}
                                    className="px-3 py-1.5 text-xs font-bold bg-white text-rose-700 border border-rose-300 rounded-lg shadow-xs hover:bg-rose-100/50"
                                >
                                    Reintentar conexión
                                </button>
                                {branchId && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAgentModal(true)}
                                        className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                                    >
                                        <Radio size={13} />
                                        Abrir Conector Local de Estación
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : periodsList.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            No se encontraron turnos con los filtros seleccionados.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {periodsList.map((p) => {
                                const isSelecting = selectingId === p.id || (loading && selectingId === p.id);
                                const isUsed = Boolean(p.usedInCloseout);

                                return (
                                    <div
                                        key={p.id}
                                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                                            isUsed
                                                ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
                                                : 'border-slate-200/80 hover:border-emerald-300 bg-white hover:bg-emerald-50/20'
                                        }`}
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    Turno #{p.id}
                                                </span>
                                                {p.isClosed ? (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <CheckCircle2 size={10} /> Cerrado
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Clock size={10} /> En curso
                                                    </span>
                                                )}
                                                {p.transationCount > 0 && (
                                                    <span className="text-[10px] font-semibold text-slate-500">
                                                        {p.transationCount} transacciones
                                                    </span>
                                                )}
                                            </div>

                                            {/* Trazabilidad: si ya fue utilizado */}
                                            {isUsed && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-300/60 px-2 py-0.5 rounded-lg w-fit">
                                                    <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                                                    <span>
                                                        Utilizado en Cierre #{p.usedInCloseout.closeoutId} (Turno #{p.usedInCloseout.numero_turno} — {formatDate(p.usedInCloseout.fecha_turno)})
                                                    </span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-[11px] text-slate-600">
                                                <div>
                                                    <span className="font-semibold text-slate-400">Inicio: </span>
                                                    <span className="font-medium text-slate-700">{p.startFormatted}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-400">Cierre: </span>
                                                    <span className="font-medium text-slate-700">{p.endFormatted}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleSelect(p)}
                                            disabled={loading || selectingId !== null}
                                            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 ${
                                                isUsed
                                                    ? 'text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                                                    : 'text-white bg-emerald-600 hover:bg-emerald-700'
                                            }`}
                                        >
                                            {isSelecting ? (
                                                <>
                                                    <Loader2 size={13} className="animate-spin" />
                                                    <span>Cargando...</span>
                                                </>
                                            ) : isUsed ? (
                                                <>
                                                    <AlertTriangle size={13} className="text-amber-700" />
                                                    <span>Reutilizar lecturas</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={13} />
                                                    <span>Cargar lecturas</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pie de modal */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-slate-500">
                        Mostrando {periodsList.length} de {periodsData?.length || 0} turnos consultados (límite: {limit})
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>

        {branchId && (
            <GasFusionAgentModal
                isOpen={showAgentModal}
                onClose={() => { setShowAgentModal(false); refetch(); }}
                branch={{ branch_id: branchId }}
            />
        )}
    </>
);
};

export default GasFusionPeriodsModal;
