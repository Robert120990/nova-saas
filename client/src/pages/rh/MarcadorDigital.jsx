import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Fingerprint, Radio, Settings, Plus, RefreshCw,
    FileText, Sliders
} from 'lucide-react';
import { getTodayString } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';
import {
    BiometricDeviceModal,
    BiometricManualPunchModal,
    BiometricAgentModal,
    BiometricReportModal,
    BiometricConfigModal,
    BiometricSummaryCards,
    BiometricFiltersBar,
    BiometricLogsTable
} from '../../components/rh';

const MarcadorDigital = () => {
    const today = getTodayString();
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [punchType, setPunchType] = useState('todos');
    const [source, setSource] = useState('todos');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Fetch biometric devices to check status and LAN connectivity
    const { data: rawDevices = [], refetch: refetchDevices } = useQuery({
        queryKey: ['rh-biometric-devices'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/devices');
            return unwrapList(res);
        },
        refetchInterval: 15000 // Poll device status every 15s
    });

    const devices = Array.isArray(rawDevices) ? rawDevices : [];
    const activeDevice = devices.length > 0 ? devices[0] : null;
    const isOnline = !!activeDevice?.is_online;

    // Fetch attendance logs
    const {
        data: responseData = { data: [], pagination: {}, summary: {} },
        isLoading,
        isFetching,
        refetch: refetchLogs
    } = useQuery({
        queryKey: ['rh-biometric-attendance', page, limit, startDate, endDate, debouncedSearch, punchType, source],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/attendance-logs', {
                params: {
                    page,
                    limit,
                    start_date: startDate || undefined,
                    end_date: endDate || undefined,
                    search: debouncedSearch || undefined,
                    punch_type: punchType !== 'todos' ? punchType : undefined,
                    source: source !== 'todos' ? source : undefined
                }
            });
            return res.data || {};
        },
        refetchInterval: 20000 // Poll logs every 20s
    });

    const logs = Array.isArray(responseData?.data) ? responseData.data : [];
    const pagination = responseData?.pagination || { total: 0, totalPages: 1, page: 1, limit: 20 };
    const summary = responseData?.summary || { total_hoy: 0, entradas_hoy: 0, salidas_hoy: 0, empleados_activos_hoy: 0 };

    const handleRefresh = () => {
        refetchDevices();
        refetchLogs();
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Fingerprint className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                                Marcador Digital Biométrico
                            </h1>
                            <button
                                type="button"
                                onClick={() => setIsAgentModalOpen(true)}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 transition-all shadow-sm ${
                                    isOnline
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                                title="Ver estado del conector de red local"
                            >
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                                {isOnline ? 'Conector En Línea' : 'Conector Desconectado'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            Sincronización en tiempo real con reloj ZKTeco ({activeDevice?.ip_address || '192.168.3.201'})
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setIsReportModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
                        title="Ver y exportar reporte de asistencia por rango de fechas"
                    >
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>Reporte Asistencia</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsConfigModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
                        title="Configurar turnos, horarios, tolerancias, festivos y horas extras"
                    >
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        <span>Configuración</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsAgentModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
                    >
                        <Radio className="w-4 h-4 text-indigo-600" />
                        <span>Conector LAN</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsDeviceModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm"
                    >
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span>Configurar Reloj</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsPunchModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-200"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Marcación Manual</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isFetching}
                        className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        title="Actualizar registros"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <BiometricSummaryCards summary={summary} />

            {/* Filter Bar */}
            <BiometricFiltersBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                startDate={startDate}
                onStartDateChange={(val) => { setStartDate(val); setPage(1); }}
                endDate={endDate}
                onEndDateChange={(val) => { setEndDate(val); setPage(1); }}
                punchType={punchType}
                onPunchTypeChange={(val) => { setPunchType(val); setPage(1); }}
                source={source}
                onSourceChange={(val) => { setSource(val); setPage(1); }}
            />

            {/* Attendance Logs Table */}
            <BiometricLogsTable
                logs={logs}
                isLoading={isLoading}
                pagination={pagination}
                limit={limit}
                onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
                onPageChange={(newPage) => setPage(newPage)}
            />

            {/* Modals */}
            <BiometricReportModal
                open={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />

            <BiometricConfigModal
                open={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
            />

            <BiometricDeviceModal
                open={isDeviceModalOpen}
                onClose={() => setIsDeviceModalOpen(false)}
                device={activeDevice}
                onSuccess={() => refetchDevices()}
            />

            <BiometricManualPunchModal
                open={isPunchModalOpen}
                onClose={() => setIsPunchModalOpen(false)}
                onSuccess={() => refetchLogs()}
            />

            <BiometricAgentModal
                open={isAgentModalOpen}
                onClose={() => setIsAgentModalOpen(false)}
                device={activeDevice}
                onDeviceUpdated={() => refetchDevices()}
            />
        </div>
    );
};

export default MarcadorDigital;
