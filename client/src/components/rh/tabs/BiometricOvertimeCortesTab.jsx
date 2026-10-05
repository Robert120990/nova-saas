import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Lock, Unlock, RefreshCw, Clock, ArrowLeft
} from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';
import BiometricEditOvertimeModal from '../BiometricEditOvertimeModal';
import BiometricFreezePeriodModal from '../BiometricFreezePeriodModal';
import BiometricCortesHistoryTable from '../BiometricCortesHistoryTable';
import BiometricOvertimeTable from '../BiometricOvertimeTable';

const BiometricOvertimeCortesTab = () => {
    const queryClient = useQueryClient();
    const [subView, setSubView] = useState('pending'); // 'pending' | 'history'
    const [search, setSearch] = useState('');
    const [onlyOvertime, setOnlyOvertime] = useState(true);
    const [selectedCorte, setSelectedCorte] = useState(null);

    // Modales
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);

    // 1. Fetch pending summary (detects last frozen cutoff and pending date range)
    const {
        data: summaryData = {},
        refetch: refetchSummary
    } = useQuery({
        queryKey: ['rh-biometric-cortes-summary'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/cortes/summary');
            return res.data || {};
        }
    });

    const lastCorte = summaryData?.ultimo_corte || null;
    const pendingRange = summaryData?.rango_pendiente || {
        fecha_inicio: '',
        fecha_fin: '',
        total_empleados: 0,
        total_horas_extra_aprobadas: 0,
        total_editados: 0
    };

    // Fechas para vista pendiente
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (pendingRange.fecha_inicio && pendingRange.fecha_fin && !startDate && !endDate) {
            setStartDate(pendingRange.fecha_inicio);
            setEndDate(pendingRange.fecha_fin);
        }
    }, [pendingRange]);

    // Fechas activas para la consulta de horas
    const activeStartDate = selectedCorte ? selectedCorte.fecha_inicio : (startDate || pendingRange.fecha_inicio);
    const activeEndDate = selectedCorte ? selectedCorte.fecha_fin : (endDate || pendingRange.fecha_fin);

    // 2. Fetch daily overtime rows
    const {
        data: overtimeData = { rows: [], summary: {} },
        isLoading: isOvertimeLoading,
        isFetching: isOvertimeFetching,
        refetch: refetchOvertime
    } = useQuery({
        queryKey: [
            'rh-biometric-cortes-daily-overtime',
            selectedCorte?.id || 'pending',
            activeStartDate,
            activeEndDate,
            search,
            onlyOvertime
        ],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/cortes/daily-overtime', {
                params: {
                    corteId: selectedCorte?.id || undefined,
                    startDate: activeStartDate || undefined,
                    endDate: activeEndDate || undefined,
                    search: search.trim() || undefined,
                    onlyOvertime: onlyOvertime ? 1 : 0
                }
            });
            return res.data || { rows: [], summary: {} };
        },
        enabled: !!(activeStartDate && activeEndDate)
    });

    // 3. Fetch list of frozen cortes
    const {
        data: cortesList = [],
        isLoading: isCortesLoading,
        refetch: refetchCortes
    } = useQuery({
        queryKey: ['rh-biometric-cortes-list'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/cortes');
            return res.data?.data || [];
        },
        enabled: subView === 'history'
    });

    // Mutation: Descongelar / reabrir corte
    const unfreezeMutation = useMutation({
        mutationFn: async (corteId) => {
            const res = await axios.post(`/api/rh/biometric/cortes/${corteId}/unfreeze`);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Corte descongelado y reabierto.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-list'] });
            setSelectedCorte(null);
            setSubView('pending');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al descongelar el corte');
        }
    });

    const handleOpenEdit = (row) => {
        setSelectedEntry(row);
        setIsEditModalOpen(true);
    };

    const handleRefreshAll = () => {
        refetchSummary();
        refetchOvertime();
        if (subView === 'history') refetchCortes();
    };

    const rows = Array.isArray(overtimeData?.rows) ? overtimeData.rows : [];
    const summary = overtimeData?.summary || {};

    return (
        <div className="space-y-6">
            {/* Selector de Sub-vistas (Pestañas internas) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                        type="button"
                        onClick={() => { setSubView('pending'); setSelectedCorte(null); }}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subView === 'pending' && !selectedCorte
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Horas Pendientes de Reportar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setSubView('history'); }}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subView === 'history' || selectedCorte
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Historial de Períodos Congelados</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {subView === 'pending' && !selectedCorte && (
                        <button
                            type="button"
                            onClick={() => setIsFreezeModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-all shadow-sm shadow-sky-200"
                            title="Congelar el rango actual para corte de planilla"
                        >
                            <Lock className="w-4 h-4" />
                            <span>Congelar Período</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleRefreshAll}
                        disabled={isOvertimeFetching}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-50"
                        title="Actualizar registros"
                    >
                        <RefreshCw className={`w-4 h-4 ${isOvertimeFetching ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Banner: Rango Pendiente de Reportar */}
            {!selectedCorte && subView === 'pending' && (
                <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl shadow-md space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Rango Pendiente Para Reportar
                                </span>
                                {lastCorte && (
                                    <span className="text-[11px] text-slate-300">
                                        (Último corte: <strong>{lastCorte.nombre}</strong> hasta {formatDate(lastCorte.fecha_fin)})
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                                {pendingRange.fecha_inicio ? formatDate(pendingRange.fecha_inicio) : '---'}
                                <span className="text-indigo-400 font-normal mx-2">al</span>
                                {pendingRange.fecha_fin ? formatDate(pendingRange.fecha_fin) : '---'}
                            </h2>
                            <p className="text-xs text-slate-300">
                                Mostrando las marcaciones acumuladas pendientes de corte para reporte a planillas.
                            </p>
                        </div>

                        {/* Totales Resumen */}
                        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                            <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10 text-center">
                                <span className="text-[10px] font-bold text-slate-300 uppercase block">Colaboradores</span>
                                <span className="text-lg font-black text-white">{summary.total_empleados || 0}</span>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10 text-center">
                                <span className="text-[10px] font-bold text-slate-300 uppercase block">H.E. Reloj</span>
                                <span className="text-lg font-black text-indigo-300">{summary.total_horas_extra_calculadas || 0} h</span>
                            </div>
                            <div className="bg-emerald-500/20 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-emerald-500/30 text-center">
                                <span className="text-[10px] font-bold text-emerald-300 uppercase block">H.E. Aprobadas</span>
                                <span className="text-lg font-black text-emerald-400">{summary.total_horas_extra_aprobadas || 0} h</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Banner: Modo Inspección de Corte Congelado */}
            {selectedCorte && (
                <div className="p-4 sm:p-5 bg-sky-950 text-white rounded-2xl shadow-md space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <button
                                type="button"
                                onClick={() => setSelectedCorte(null)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-300 hover:text-white mb-2 transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Volver a la lista de cortes congelados</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-sky-400" />
                                    Período Congelado
                                </span>
                                <h3 className="text-lg font-black text-white">{selectedCorte.nombre}</h3>
                            </div>
                            <p className="text-xs text-sky-200 mt-1">
                                Rango: {formatDate(selectedCorte.fecha_inicio)} al {formatDate(selectedCorte.fecha_fin)}.
                                Las marcaciones del reloj están protegidas; <strong>puede editar las horas extra</strong> de cualquier registro si requiere ajustes.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 px-4 py-2 rounded-xl text-center">
                                <span className="text-[10px] font-bold text-sky-300 uppercase block">H.E. Aprobadas</span>
                                <span className="text-lg font-black text-white">{selectedCorte.total_horas_extra_aprobadas || 0} h</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm(`¿Está seguro de descongelar y reabrir el corte "${selectedCorte.nombre}"? Volverá al rango pendiente.`)) {
                                        unfreezeMutation.mutate(selectedCorte.id);
                                    }
                                }}
                                disabled={unfreezeMutation.isPending}
                                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl transition-colors disabled:opacity-50"
                                title="Descongelar y reabrir este corte"
                            >
                                <Unlock className="w-3.5 h-3.5" />
                                <span>{unfreezeMutation.isPending ? 'Descongelando...' : 'Descongelar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Listado de Cortes Congelados (Vista Historial) */}
            {subView === 'history' && !selectedCorte && (
                <BiometricCortesHistoryTable
                    cortesList={cortesList}
                    isLoading={isCortesLoading}
                    onSelectCorte={(c) => setSelectedCorte(c)}
                />
            )}

            {/* Tabla de Detalle y Edición de Horas (Visible en Rango Pendiente o en Corte Seleccionado) */}
            {(subView === 'pending' || selectedCorte) && (
                <BiometricOvertimeTable
                    rows={rows}
                    isLoading={isOvertimeLoading}
                    search={search}
                    onSearchChange={setSearch}
                    startDate={startDate}
                    onStartDateChange={setStartDate}
                    endDate={endDate}
                    onEndDateChange={setEndDate}
                    onlyOvertime={onlyOvertime}
                    onOnlyOvertimeChange={setOnlyOvertime}
                    isFrozenView={!!selectedCorte}
                    onOpenEdit={handleOpenEdit}
                />
            )}

            {/* Modales */}
            <BiometricEditOvertimeModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                entry={selectedEntry}
                onSuccess={() => refetchOvertime()}
            />

            <BiometricFreezePeriodModal
                open={isFreezeModalOpen}
                onClose={() => setIsFreezeModalOpen(false)}
                suggestedRange={pendingRange}
                onSuccess={() => {
                    refetchSummary();
                    refetchOvertime();
                    refetchCortes();
                }}
            />
        </div>
    );
};

export default BiometricOvertimeCortesTab;
