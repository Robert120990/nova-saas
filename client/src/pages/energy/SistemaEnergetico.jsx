import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Zap, 
    RefreshCw, 
    Settings, 
    Activity, 
    BarChart2, 
    History,
    Radio,
    Building2,
    Sun,
    FileText,
    AlertTriangle
} from 'lucide-react';
import { 
    EnergySummaryCards, 
    EnergyFlowDiagram, 
    EnergyInvertersTable, 
    EnergyBatteryStatus, 
    EnergyAnalyticsSection,
    EnergySfvReportTab,
    EnergyHistoryTable, 
    EnergyConfigModal 
} from '../../components/energy';
import { getTodayString } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';

export default function SistemaEnergetico() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('live'); // 'live' | 'charts' | 'history'
    const [locations, setLocations] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(user?.company_id || 9);
    const [liveData, setLiveData] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [configModalOpen, setConfigModalOpen] = useState(false);

    // Estado para el historial
    const [historyData, setHistoryData] = useState([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotalPages, setHistoryTotalPages] = useState(1);
    const [historyLoading, setHistoryLoading] = useState(false);
    const canManageConfig = user?.role === 'SuperAdmin' || (Array.isArray(user?.permissions) ? user.permissions : []).includes('manage_energy_config');
    const [startDate, setStartDate] = useState(getTodayString());
    const [endDate, setEndDate] = useState(getTodayString());
    const lastAlertToastRef = useRef('');

    const companyHeaders = { 'x-company-id': String(selectedCompanyId) };

    // Cargar localidades disponibles según permisos RBAC
    const fetchLocations = async () => {
        try {
            const res = await axios.get('/api/energy/locations');
            const locs = res.data?.data || [];
            setLocations(locs);
            if (locs.length > 0) {
                const currentAccessible = locs.some(l => Number(l.companyId) === Number(selectedCompanyId));
                if (!currentAccessible) {
                    setSelectedCompanyId(locs[0].companyId);
                }
            }
        } catch (err) {
            console.error('Error al cargar localidades energéticas:', err);
        }
    };

    // Cargar datos en vivo
    const fetchLive = async (showToast = false) => {
        try {
            const res = await axios.get('/api/energy/live', { headers: companyHeaders });
            if (res.data?.data) {
                const data = res.data.data;
                setLiveData(data);
                const critical = (data.communicationAlerts || []).filter(a => a.severity === 'error');
                if (critical.length > 0) {
                    const sig = `${selectedCompanyId}:${critical.map(c => `${c.source}:${c.message}`).join('|')}`;
                    if (lastAlertToastRef.current !== sig) {
                        lastAlertToastRef.current = sig;
                        toast.error(critical.map(c => `${c.title}: ${c.message}`).join(' • '), { duration: 7000 });
                    }
                } else {
                    lastAlertToastRef.current = '';
                }
                if (showToast) toast.success('Telemetría en vivo actualizada');
            }
        } catch (err) {
            if (showToast) toast.error('Error al obtener datos en vivo: ' + (err.response?.data?.message || err.message));
        }
    };

    // Sincronizar inmediatamente
    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            const res = await axios.post('/api/energy/sync', {}, { headers: companyHeaders });
            if (res.data?.data?.live) {
                setLiveData(res.data.data.live);
            }
            toast.success('Lectura energética registrada y sincronizada con éxito');
            if (activeTab === 'history') fetchHistory();
        } catch (err) {
            toast.error('Error al sincronizar: ' + (err.response?.data?.message || err.message));
        } finally {
            setSyncing(false);
        }
    };

    // Cargar historial
    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await axios.get('/api/energy/history', {
                params: { startDate, endDate, page: historyPage, limit: 30 },
                headers: companyHeaders
            });
            if (res.data) {
                setHistoryData(res.data.data || []);
                setHistoryTotal(res.data.total || 0);
                setHistoryTotalPages(res.data.totalPages || 1);
            }
        } catch (err) {
            toast.error('Error al cargar historial: ' + (err.response?.data?.message || err.message));
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchLocations();
    }, []);

    useEffect(() => {
        fetchLive();
    }, [selectedCompanyId]);

    // Polling en vivo cada 30s si auto-refresco está activo
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchLive(false);
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, selectedCompanyId]);

    // Recargar historial al cambiar filtros, tab o empresa
    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, historyPage, startDate, endDate, selectedCompanyId]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Cabecera Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2">
                                Sistema Energético
                                {(() => {
                                    const alerts = liveData?.communicationAlerts || [];
                                    const hasCritical = alerts.some(a => a.severity === 'error');
                                    const hasWarning = alerts.some(a => a.severity === 'warning');
                                    if (hasCritical) {
                                        return (
                                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                                <AlertTriangle className="w-3 h-3" /> SIN COMUNICACIÓN
                                            </span>
                                        );
                                    }
                                    if (hasWarning) {
                                        return (
                                            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                <AlertTriangle className="w-3 h-3" /> ALERTA DE EQUIPOS
                                            </span>
                                        );
                                    }
                                    return (
                                        <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                            <Radio className="w-3 h-3 animate-pulse text-emerald-500" /> EN VIVO
                                        </span>
                                    );
                                })()}
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Evaluación y análisis de Inversores (Growatt) y Banco de Baterías (GESS SolarWeb)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Acciones de Cabecera */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Toggle En Vivo */}
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            autoRefresh
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                        title="Auto-refrescar cada 30 segundos"
                    >
                        <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                        {autoRefresh ? 'En Vivo (30s)' : 'Pausado'}
                    </button>

                    {/* Sincronizar Ahora */}
                    <button
                        onClick={handleSyncNow}
                        disabled={syncing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                    </button>

                    {/* Configuración (Solo Administradores con permiso) */}
                    {canManageConfig && (
                        <button
                            onClick={() => setConfigModalOpen(true)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Configurar credenciales y tarifas (Administrador)"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Selector de Localidad / Empresa */}
            {locations.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Empresa / Localidad Monitoreada
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {locations.find(l => Number(l.companyId) === Number(selectedCompanyId))?.legalName || 'Seleccionar Localidad'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {locations.map((loc) => {
                            const isSelected = Number(loc.companyId) === Number(selectedCompanyId);
                            return (
                                <button
                                    key={loc.companyId}
                                    onClick={() => {
                                        setSelectedCompanyId(loc.companyId);
                                        setLiveData(null);
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-400/40'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    <Sun className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-amber-500'}`} />
                                    <span>{loc.plantName}</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                        isSelected 
                                            ? 'bg-indigo-700/80 text-indigo-100' 
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        {loc.hasBatteries ? 'Solar + Baterías' : 'Solo Solar'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Alertas de Comunicación / Equipos Desconectados */}
            {Array.isArray(liveData?.communicationAlerts) && liveData.communicationAlerts.length > 0 && (
                <div className="space-y-2">
                    {liveData.communicationAlerts.map((alert, idx) => {
                        const isError = alert.severity === 'error';
                        return (
                            <div
                                key={`${alert.source}-${idx}`}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-2xl border text-xs ${
                                    isError
                                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                                        : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200'
                                }`}
                            >
                                <div className="flex items-start sm:items-center gap-2.5">
                                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${isError ? 'text-rose-600' : 'text-amber-600'}`} />
                                    <div>
                                        <span className="font-black">{alert.title}: </span>
                                        <span className="font-medium">{alert.message}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pestañas de Navegación */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
                {[
                    { id: 'live', label: 'Monitoreo en Vivo', icon: Activity },
                    { id: 'charts', label: 'Análisis Temporal (Día / Mes / Año)', icon: BarChart2 },
                    { id: 'report', label: 'Reporte SFV (Mes / Año)', icon: FileText },
                    { id: 'history', label: 'Historial de Lecturas (4h)', icon: History }
                ].map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            <TabIcon className="w-4 h-4 shrink-0" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Contenido según Pestaña */}
            {activeTab === 'live' && (
                <div className="space-y-6">
                    <EnergySummaryCards liveData={liveData} isPeakHour={liveData?.isPeakHour} />
                    <EnergyFlowDiagram liveData={liveData} isPeakHour={liveData?.isPeakHour} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <EnergyInvertersTable growattData={liveData?.growatt} />
                        <EnergyBatteryStatus gessData={liveData?.gess} />
                    </div>
                </div>
            )}

            {activeTab === 'charts' && (
                <EnergyAnalyticsSection companyHeaders={companyHeaders} />
            )}

            {activeTab === 'report' && (
                <EnergySfvReportTab
                    companyHeaders={companyHeaders}
                    selectedLocation={locations.find(l => Number(l.companyId) === Number(selectedCompanyId)) || null}
                />
            )}

            {activeTab === 'history' && (
                <EnergyHistoryTable 
                    readings={historyData}
                    total={historyTotal}
                    page={historyPage}
                    totalPages={historyTotalPages}
                    onPageChange={setHistoryPage}
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    isLoading={historyLoading}
                />
            )}

            {/* Modal de Configuración */}
            <EnergyConfigModal 
                open={configModalOpen}
                onClose={() => setConfigModalOpen(false)}
                companyId={selectedCompanyId}
                onSaved={() => {
                    fetchLive(true);
                }}
            />
        </div>
    );
}
