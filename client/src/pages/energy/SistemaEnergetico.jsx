import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Zap, 
    RefreshCw, 
    Settings, 
    Activity, 
    BarChart2, 
    History,
    Radio
} from 'lucide-react';
import { 
    EnergySummaryCards, 
    EnergyFlowDiagram, 
    EnergyInvertersTable, 
    EnergyBatteryStatus, 
    EnergyAnalyticsSection,
    EnergyHistoryTable, 
    EnergyConfigModal 
} from '../../components/energy';
import { getTodayString } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';

export default function SistemaEnergetico() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('live'); // 'live' | 'charts' | 'history'
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
    const [startDate, setStartDate] = useState(getTodayString());
    const [endDate, setEndDate] = useState(getTodayString());

    const companyHeaders = user?.company_id ? { 'x-company-id': String(user.company_id) } : {};

    // Cargar datos en vivo
    const fetchLive = async (showToast = false) => {
        try {
            const res = await axios.get('/api/energy/live', { headers: companyHeaders });
            if (res.data?.data) {
                setLiveData(res.data.data);
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
        fetchLive();
    }, [user?.company_id]);

    // Polling en vivo cada 30s si auto-refresco está activo
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchLive(false);
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, user?.company_id]);

    // Recargar historial al cambiar filtros o tab
    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, historyPage, startDate, endDate]);

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            {/* Cabecera Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Sistema Energético
                                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                    <Radio className="w-3 h-3 animate-pulse text-emerald-500" /> EN VIVO
                                </span>
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

                    {/* Configuración */}
                    <button
                        onClick={() => setConfigModalOpen(true)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Configurar credenciales y tarifas"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Pestañas de Navegación */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('live')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'live'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <Activity className="w-4 h-4" />
                    Monitoreo en Vivo
                </button>

                <button
                    onClick={() => setActiveTab('charts')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'charts'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <BarChart2 className="w-4 h-4" />
                    Análisis Temporal (Día / Mes / Año)
                </button>

                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'history'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Historial de Lecturas (4h)
                </button>
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
                onSaved={() => {
                    fetchLive(true);
                }}
            />
        </div>
    );
}
