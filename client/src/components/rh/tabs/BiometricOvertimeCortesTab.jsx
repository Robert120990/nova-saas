import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Lock, RefreshCw, Clock, FileSpreadsheet, Loader2
} from 'lucide-react';
import BiometricEditOvertimeModal from '../BiometricEditOvertimeModal';
import BiometricFreezePeriodModal from '../BiometricFreezePeriodModal';
import BiometricCortesHistoryTable from '../BiometricCortesHistoryTable';
import BiometricOvertimeTable from '../BiometricOvertimeTable';
import { BiometricPendingBanner, BiometricFrozenBanner } from '../BiometricOvertimeBanners';

const BiometricOvertimeCortesTab = () => {
    const queryClient = useQueryClient();
    const [subView, setSubView] = useState('pending'); // 'pending' | 'history'
    const [search, setSearch] = useState('');
    const [onlyOvertime, setOnlyOvertime] = useState(true);
    const [selectedCorte, setSelectedCorte] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

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

    const handleExportQuincenal = async () => {
        try {
            setIsExporting(true);
            const res = await axios.get('/api/rh/biometric/report/export', {
                params: {
                    startDate: activeStartDate,
                    endDate: activeEndDate,
                    format: 'andelsa_excel',
                    template: 'andelsa'
                },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Horas_Extras_Quincenal_${activeStartDate}_al_${activeEndDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Formato de Horas Extras XLSX generado con éxito.');
        } catch (error) {
            console.error('Error al exportar:', error);
            toast.error('Error al exportar horas extras');
        } finally {
            setIsExporting(false);
        }
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

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleExportQuincenal}
                        disabled={isExporting || !activeStartDate || !activeEndDate}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        title="Descargar formato oficial de Horas Extras Quincenal (.xlsx)"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                        <span>Exportar XLSX</span>
                    </button>
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
                <BiometricPendingBanner
                    pendingRange={pendingRange}
                    lastCorte={lastCorte}
                    summary={summary}
                />
            )}

            {/* Banner: Modo Inspección de Corte Congelado */}
            {selectedCorte && (
                <BiometricFrozenBanner
                    selectedCorte={selectedCorte}
                    onBack={() => setSelectedCorte(null)}
                    onUnfreeze={() => {
                        if (window.confirm(`¿Está seguro de descongelar y reabrir el corte "${selectedCorte.nombre}"? Volverá al rango pendiente.`)) {
                            unfreezeMutation.mutate(selectedCorte.id);
                        }
                    }}
                    isUnfreezing={unfreezeMutation.isPending}
                />
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
