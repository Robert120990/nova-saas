import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Lock, RefreshCw, Clock, FileSpreadsheet, Loader2, FolderArchive
} from 'lucide-react';
import { normalizeDateRangeInput } from '../../../utils/dateUtils';
import { unwrapList } from '../../../utils/apiUtils';
import BiometricEditOvertimeModal from '../BiometricEditOvertimeModal';
import BiometricFreezePeriodModal from '../BiometricFreezePeriodModal';
import BiometricImportZkModal from '../BiometricImportZkModal';
import BiometricCortesHistoryTable from '../BiometricCortesHistoryTable';
import BiometricOvertimeTable from '../BiometricOvertimeTable';
import { BiometricPendingBanner, BiometricFrozenBanner } from '../BiometricOvertimeBanners';

const BiometricOvertimeCortesTab = () => {
    const queryClient = useQueryClient();
    const [subView, setSubView] = useState('pending');
    const [search, setSearch] = useState('');
    const [onlyOvertime, setOnlyOvertime] = useState(false);
    const [selectedCorte, setSelectedCorte] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    // Modales
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);
    const [isZkImportModalOpen, setIsZkImportModalOpen] = useState(false);

    const {
        data: summaryData = {},
        refetch: refetchSummary
    } = useQuery({
        queryKey: ['rh-biometric-cortes-summary'],
        queryFn: async () => (await axios.get('/api/rh/biometric/cortes/summary')).data || {}
    });

    const lastCorte = summaryData?.ultimo_corte || null;
    const pendingRange = summaryData?.rango_pendiente || {
        fecha_inicio: '',
        fecha_fin: '',
        total_empleados: 0,
        total_horas_extra_aprobadas: 0,
        total_editados: 0
    };

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const hasInitializedRange = useRef(false);

    useEffect(() => {
        if (!hasInitializedRange.current && pendingRange.fecha_inicio && pendingRange.fecha_fin) {
            setStartDate(pendingRange.fecha_inicio);
            setEndDate(pendingRange.fecha_fin);
            hasInitializedRange.current = true;
        }
    }, [pendingRange.fecha_inicio, pendingRange.fecha_fin]);

    const activeStartDate = selectedCorte ? selectedCorte.fecha_inicio : startDate;
    const activeEndDate = selectedCorte ? selectedCorte.fecha_fin : endDate;

    const handleDateChange = (field, val) => {
        const next = normalizeDateRangeInput(field, val, startDate, endDate);
        setStartDate(next.startDate);
        setEndDate(next.endDate);
    };

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

    const {
        data: rawCortesList = [],
        isLoading: isCortesLoading,
        refetch: refetchCortes
    } = useQuery({
        queryKey: ['rh-biometric-cortes-list'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/biometric/cortes')),
        enabled: subView === 'history'
    });
    const cortesList = Array.isArray(rawCortesList) ? rawCortesList : [];

    const unfreezeMutation = useMutation({
        mutationFn: async (corteId) => (await axios.post(`/api/rh/biometric/cortes/${corteId}/unfreeze`)).data,
        onSuccess: (data) => {
            toast.success(data?.message || 'Corte descongelado y reabierto.');
            hasInitializedRange.current = false;
            setSelectedCorte(null);
            setSubView('pending');
            setStartDate('');
            setEndDate('');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-list'] });
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
    const bannerRange = {
        ...pendingRange,
        fecha_inicio: activeStartDate || pendingRange.fecha_inicio,
        fecha_fin: activeEndDate || pendingRange.fecha_fin
    };

    return (
        <div className="space-y-6">
            {/* Selector de Sub-vistas */}
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
                        onClick={() => setIsZkImportModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-sm"
                        title="Cargar y validar archivos quincenales de ZKTeco (.xls)"
                    >
                        <FolderArchive className="w-4 h-4 text-indigo-600" />
                        <span>Cargar Archivos ZK</span>
                    </button>
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

            {!selectedCorte && subView === 'pending' && (
                <BiometricPendingBanner
                    pendingRange={bannerRange}
                    lastCorte={lastCorte}
                    summary={summary}
                />
            )}

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

            {subView === 'history' && !selectedCorte && (
                <BiometricCortesHistoryTable
                    cortesList={cortesList}
                    isLoading={isCortesLoading}
                    onSelectCorte={(c) => setSelectedCorte(c)}
                />
            )}

            {(subView === 'pending' || selectedCorte) && (
                <BiometricOvertimeTable
                    rows={rows}
                    isLoading={isOvertimeLoading}
                    search={search}
                    onSearchChange={setSearch}
                    startDate={startDate}
                    onStartDateChange={(val) => handleDateChange('start', val)}
                    endDate={endDate}
                    onEndDateChange={(val) => handleDateChange('end', val)}
                    onApplyRange={(s, e) => { setStartDate(s); setEndDate(e); }}
                    onlyOvertime={onlyOvertime}
                    onOnlyOvertimeChange={setOnlyOvertime}
                    isFrozenView={!!selectedCorte}
                    onOpenEdit={handleOpenEdit}
                />
            )}

            <BiometricEditOvertimeModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                entry={selectedEntry}
                onSuccess={() => refetchOvertime()}
            />

            <BiometricFreezePeriodModal
                open={isFreezeModalOpen}
                onClose={() => setIsFreezeModalOpen(false)}
                suggestedRange={bannerRange}
                onSuccess={() => {
                    hasInitializedRange.current = false;
                    setStartDate('');
                    setEndDate('');
                    refetchSummary();
                    refetchOvertime();
                    refetchCortes();
                }}
            />

            <BiometricImportZkModal
                open={isZkImportModalOpen}
                onClose={() => setIsZkImportModalOpen(false)}
                onSuccess={() => handleRefreshAll()}
            />
        </div>
    );
};

export default BiometricOvertimeCortesTab;
