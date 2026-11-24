import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Fingerprint, Radio, Settings, Plus, RefreshCw,
    FileText, Sliders, Lock, UserPlus, CalendarX, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTodayString, normalizeDateRangeInput } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';
import {
    BiometricDeviceModal,
    BiometricManualPunchModal,
    BiometricAgentModal,
    BiometricReportModal,
    BiometricConfigModal,
    BiometricEmployeeModal,
    BiometricUpdateBanner
} from '../../components/rh';
import {
    BiometricLogsTab,
    BiometricOvertimeCortesTab,
    BiometricAbsencesTab
} from '../../components/rh/tabs';

const MarcadorDigital = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || null;
    const isAndelsa = companyId === 9 || (typeof user?.company_name === 'string' && user.company_name.toUpperCase().includes('ANDELSA'));
    const hasBiometricModule = Array.isArray(user?.enabled_modules)
        ? user.enabled_modules.includes('biometric')
        : isAndelsa;

    const today = getTodayString();
    const [mainTab, setMainTab] = useState('marcaciones');

    // Filtros de la pestaña de marcaciones
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [punchType, setPunchType] = useState('todos');
    const [source, setSource] = useState('todos');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    // Modales generales
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [isPunchModalOpen, setIsPunchModalOpen] = useState(false);
    const [editingManualPunch, setEditingManualPunch] = useState(null);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const { data: rawDevices = [], refetch: refetchDevices } = useQuery({
        queryKey: ['rh-biometric-devices', companyId],
        queryFn: async () => unwrapList(await axios.get('/api/rh/biometric/devices')),
        enabled: hasBiometricModule,
        refetchInterval: 15000
    });

    const devices = Array.isArray(rawDevices) ? rawDevices : [];
    const activeDevice = devices.length > 0 ? devices[0] : null;
    const isOnline = !!activeDevice?.is_online;
    const isSyncStale = !!activeDevice?.is_sync_stale;

    const deleteManualMutation = useMutation({
        mutationFn: async (punchId) => (await axios.delete(`/api/rh/biometric/manual-punch/${punchId}`)).data,
        onSuccess: (data) => {
            toast.success(data?.message || 'Marcación manual eliminada');
            refetchLogs();
            refetchRadarToday();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar marcación')
    });

    const { data: radarToday = {}, refetch: refetchRadarToday } = useQuery({
        queryKey: ['rh-biometric-daily-radar', companyId, today, '', 'todos'],
        queryFn: async () => (await axios.get('/api/rh/biometric/absences/daily-radar', { params: { date: today } })).data || {},
        enabled: hasBiometricModule,
        refetchInterval: 30000
    });

    const alertCount = Number(radarToday?.summary?.sin_justificar || 0) + Number(radarToday?.summary?.pendientes_autorizar || 0);

    const {
        data: responseData = { data: [], pagination: {}, summary: {} },
        isLoading,
        isFetching,
        refetch: refetchLogs
    } = useQuery({
        queryKey: ['rh-biometric-attendance', companyId, page, limit, startDate, endDate, debouncedSearch, punchType, source],
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
        enabled: hasBiometricModule && mainTab === 'marcaciones',
        refetchInterval: 20000
    });

    const logs = Array.isArray(responseData?.data) ? responseData.data : [];
    const pagination = responseData?.pagination || {
        total: Number(responseData?.total || 0),
        totalPages: Number(responseData?.totalPages || 1),
        page: Number(responseData?.page || page),
        limit: Number(responseData?.limit || limit)
    };
    const summary = responseData?.summary || {
        total_hoy: 0,
        entradas_hoy: 0,
        salidas_hoy: 0,
        empleados_activos_hoy: 0,
        is_today_range: startDate === today && endDate === today
    };

    const handleDateChange = (field, val) => {
        const next = normalizeDateRangeInput(field, val, startDate, endDate);
        setStartDate(next.startDate);
        setEndDate(next.endDate);
        setPage(1);
    };

    const handleRefresh = () => {
        refetchDevices();
        refetchRadarToday();
        if (mainTab === 'marcaciones') refetchLogs();
    };

    if (!hasBiometricModule) {
        return (
            <div className="p-6 max-w-2xl mx-auto mt-10">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                        <Fingerprint className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-black text-slate-800">Marcador Digital no habilitado en {user?.company_name || 'esta empresa'}</h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        El módulo de control biométrico se activa de forma independiente por empresa. Si esta empresa cuenta con reloj biométrico, puede habilitarlo desde <strong>Módulos por Empresa</strong>.
                    </p>
                    <Link to="/config/modulos-empresa" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm">
                        <Layers className="w-4 h-4" />
                        Ir a Módulos por Empresa
                    </Link>
                </div>
            </div>
        );
    }

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
                                    isOnline && !isSyncStale
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : isSyncStale
                                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                                title={isSyncStale ? 'Conector en línea pero lleva >24h sin sincronizar marcaciones' : 'Ver estado del conector de red local'}
                            >
                                <span className={`w-2 h-2 rounded-full ${isOnline && !isSyncStale ? 'bg-emerald-500 animate-ping' : isSyncStale ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
                                {isOnline ? (isSyncStale ? 'Sin Sincronizar (>24h)' : 'Conector En Línea') : 'Conector Desconectado'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            {activeDevice?.ip_address ? `Sincronización con reloj ZKTeco (${activeDevice.ip_address})` : 'Sin reloj biométrico configurado en esta empresa'}
                        </p>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={() => setIsEmployeeModalOpen(true)} title="Registrar nuevo colaborador y configurarlo para el reloj marcador"
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm">
                        <UserPlus className="w-4 h-4 text-emerald-600" /><span>Nuevo Empleado</span>
                    </button>
                    <button type="button" onClick={() => setIsReportModalOpen(true)} title="Ver y exportar reporte de asistencia por rango de fechas"
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm">
                        <FileText className="w-4 h-4 text-emerald-600" /><span>Reporte Asistencia</span>
                    </button>
                    <button type="button" onClick={() => setIsConfigModalOpen(true)} title="Configurar turnos, horarios, tolerancias, festivos y horas extras"
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm">
                        <Sliders className="w-4 h-4 text-indigo-600" /><span>Configuración</span>
                    </button>
                    <button type="button" onClick={() => setIsAgentModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm">
                        <Radio className="w-4 h-4 text-indigo-600" /><span>Conector LAN</span>
                    </button>
                    <button type="button" onClick={() => setIsDeviceModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm">
                        <Settings className="w-4 h-4 text-slate-500" /><span>Configurar Reloj</span>
                    </button>
                    <button type="button" onClick={() => setIsPunchModalOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-200">
                        <Plus className="w-4 h-4" /><span>Marcación Manual</span>
                    </button>
                    <button type="button" onClick={handleRefresh} disabled={isFetching} title="Actualizar registros"
                        className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Aviso de actualización de conector */}
            <BiometricUpdateBanner device={activeDevice} onOpenAgentModal={() => setIsAgentModalOpen(true)} onDeviceUpdated={refetchDevices} />

            {/* Pestañas Principales */}
            <div className="flex border-b border-slate-200 gap-4 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setMainTab('marcaciones')}
                    className={`flex items-center gap-2 pb-3 px-2 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                        mainTab === 'marcaciones'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Fingerprint className="w-4 h-4" />
                    <span>Marcaciones del Reloj</span>
                </button>
                <button
                    type="button"
                    onClick={() => setMainTab('inasistencias')}
                    className={`flex items-center gap-2 pb-3 px-2 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                        mainTab === 'inasistencias'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <CalendarX className="w-4 h-4 text-rose-500" />
                    <span>Inasistencias y Permisos</span>
                    {alertCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            {alertCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setMainTab('cortes_horas')}
                    className={`flex items-center gap-2 pb-3 px-2 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                        mainTab === 'cortes_horas'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Lock className="w-4 h-4 text-sky-600" />
                    <span>Cortes y Horas Extra</span>
                </button>
            </div>

            {/* Renderizado Condicional de Pestañas */}
            {mainTab === 'marcaciones' ? (
                <BiometricLogsTab
                    summary={summary}
                    logs={logs}
                    isLoading={isLoading}
                    pagination={pagination}
                    limit={limit}
                    onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
                    onPageChange={(newPage) => setPage(newPage)}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    startDate={startDate}
                    onStartDateChange={(val) => handleDateChange('start', val)}
                    endDate={endDate}
                    onEndDateChange={(val) => handleDateChange('end', val)}
                    onApplyRange={(s, e) => { setStartDate(s); setEndDate(e); setPage(1); }}
                    punchType={punchType}
                    onPunchTypeChange={(val) => { setPunchType(val); setPage(1); }}
                    source={source}
                    onSourceChange={(val) => { setSource(val); setPage(1); }}
                    onEditManual={(log) => { setEditingManualPunch(log); setIsPunchModalOpen(true); }}
                    onDeleteManual={(log) => {
                        if (window.confirm(`¿Eliminar la marcación manual de ${log.empleado_nombre_completo || log.device_uid} (${log.punch_time})?`)) {
                            deleteManualMutation.mutate(log.id);
                        }
                    }}
                />
            ) : mainTab === 'inasistencias' ? (
                <BiometricAbsencesTab />
            ) : (
                <BiometricOvertimeCortesTab />
            )}

            {/* Modales Compartidos */}
            <BiometricReportModal open={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
            <BiometricConfigModal open={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} />
            <BiometricDeviceModal open={isDeviceModalOpen} onClose={() => setIsDeviceModalOpen(false)} device={activeDevice} onSuccess={refetchDevices} />
            <BiometricManualPunchModal open={isPunchModalOpen} initialPunch={editingManualPunch} onClose={() => { setIsPunchModalOpen(false); setEditingManualPunch(null); }} onSuccess={() => { refetchLogs(); refetchRadarToday(); }} />
            <BiometricAgentModal open={isAgentModalOpen} onClose={() => setIsAgentModalOpen(false)} device={activeDevice} onDeviceUpdated={refetchDevices} />
            <BiometricEmployeeModal open={isEmployeeModalOpen} onClose={() => setIsEmployeeModalOpen(false)} onSuccess={handleRefresh} />
        </div>
    );
};

export default MarcadorDigital;
