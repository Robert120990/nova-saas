import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Sparkles, Square, RefreshCw, Terminal, Zap
} from 'lucide-react';
import CompanyDteTestTable from './CompanyDteTestTable';
import CompanyDteTestConsole from './CompanyDteTestConsole';
import CompanyDteTestHeader from './CompanyDteTestHeader';

export default function CompanyDteTestModal({ isOpen, open, onClose, company }) {
    const isModalOpen = isOpen ?? open;
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState('table'); // 'table' | 'console'
    const [isRunning, setIsRunning] = useState(false);
    const [runningTestKey, setRunningTestKey] = useState(null);
    const [throttleMs, setThrottleMs] = useState(600);
    const [logs, setLogs] = useState([]);
    const stopSignalRef = useRef(false);

    // Fetch live summary for this company
    const { data: summaryData, isLoading, refetch } = useQuery({
        queryKey: ['company-dte-test-summary', company?.id],
        queryFn: async () => {
            if (!company?.id) return null;
            const res = await axios.get(`/api/companies/${company.id}/dte-tests/summary`);
            return res.data?.data;
        },
        enabled: Boolean(isModalOpen && company?.id),
        staleTime: 0
    });

    useEffect(() => {
        if (!isModalOpen) {
            setIsRunning(false);
            setRunningTestKey(null);
            stopSignalRef.current = false;
        } else if (company?.id) {
            refetch();
        }
    }, [isModalOpen, company?.id, refetch]);

    const addLog = useCallback((log) => {
        setLogs(prev => [...prev.slice(-300), { ...log, timestamp: new Date() }]);
    }, []);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const executeOneTest = async (test) => {
        try {
            addLog({
                testType: test.key,
                testName: test.name,
                isPending: true,
                message: `Enviando ${test.name} a Hacienda...`
            });

            const res = await axios.post(`/api/companies/${company.id}/dte-tests/emit-single`, {
                testType: test.key
            });

            const data = res.data;
            if (data.success) {
                addLog({
                    testType: test.key,
                    testName: test.name,
                    status: 'ACCEPTED',
                    codigoGeneracion: data.codigoGeneracion,
                    selloRecepcion: data.selloRecepcion,
                    message: `Aceptado por Hacienda (${data.estadoHacienda || 'PROCESADO'})`
                });
                return { success: true, data };
            } else {
                addLog({
                    testType: test.key,
                    testName: test.name,
                    status: 'REJECTED',
                    message: data.message || 'Rechazado por validación tributaria',
                    details: data.details || data.error
                });
                return { success: false, data };
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Error en comunicación con API';
            addLog({
                testType: test.key,
                testName: test.name,
                status: 'ERROR',
                message: errMsg,
                details: err.response?.data?.details
            });
            return { success: false, error: errMsg };
        }
    };

    const handleRunBatch = async (testsToRun, batchTitle) => {
        if (isRunning) return;
        setIsRunning(true);
        stopSignalRef.current = false;
        toast.info(`Iniciando ${batchTitle}...`);

        let totalSuccess = 0;
        let totalFailed = 0;

        for (const item of testsToRun) {
            if (stopSignalRef.current) break;
            setRunningTestKey(item.test.key);

            for (let i = 0; i < item.count; i++) {
                if (stopSignalRef.current) break;

                const result = await executeOneTest(item.test);
                if (result.success) {
                    totalSuccess++;
                    refetch();
                } else {
                    totalFailed++;
                }

                if (i < item.count - 1 || testsToRun.indexOf(item) < testsToRun.length - 1) {
                    await sleep(throttleMs);
                }
            }
        }

        setIsRunning(false);
        setRunningTestKey(null);
        await refetch();
        queryClient.invalidateQueries({ queryKey: ['company-dte-test-summary', company?.id] });

        if (stopSignalRef.current) {
            toast.warning('Ejecución de pruebas detenida');
        } else {
            toast.success(`Pruebas completadas: ${totalSuccess} exitosas, ${totalFailed} fallidas`);
        }
    };

    const handleRunSingle = (test, count = 1) => {
        handleRunBatch([{ test, count: Math.max(1, count) }], `${test.name} (${count})`);
    };

    const handleRunMandatory = () => {
        if (!summaryData?.tests) return;
        const mandatoryItems = summaryData.tests
            .filter(t => t.isMandatory && t.pending > 0)
            .map(t => ({ test: t, count: t.pending }));

        if (mandatoryItems.length === 0) {
            toast.info('Todas las pruebas obligatorias ya están al 100%');
            return;
        }
        handleRunBatch(mandatoryItems, 'Pruebas Obligatorias (Factura, CCF, NC)');
    };

    const handleRunAll = () => {
        if (!summaryData?.tests) return;
        const allPending = summaryData.tests
            .filter(t => t.pending > 0)
            .map(t => ({ test: t, count: t.pending }));

        if (allPending.length === 0) {
            toast.info('Todas las pruebas del catálogo ya están al 100%');
            return;
        }
        handleRunBatch(allPending, 'Todas las Pruebas Faltantes');
    };

    const handleStop = () => {
        stopSignalRef.current = true;
        addLog({ testType: 'SISTEMA', message: 'Detención solicitada por el usuario...' });
    };

    if (!isModalOpen) return null;

    const tests = summaryData?.tests || [];
    const mandatory = summaryData?.mandatorySummary || { required: 215, completed: 0, percentage: 0 };
    const total = summaryData?.totalSummary || { required: 615, completed: 0, percentage: 0 };
    const comp = summaryData?.company || company;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                <CompanyDteTestHeader
                    comp={comp}
                    mandatory={mandatory}
                    total={total}
                    isRunning={isRunning}
                    onClose={onClose}
                />

                {/* Controls Bar & View Switcher */}
                <div className="px-6 py-2.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                    {/* View Switcher Tabs */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setActiveTab('table')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'table' ? 'bg-slate-100 text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Matriz de Pruebas
                        </button>
                        <button
                            onClick={() => setActiveTab('console')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'console' ? 'bg-slate-900 text-emerald-400 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Terminal size={13} />
                            <span>Consola en Vivo</span>
                            {logs.length > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-800 text-slate-300">
                                    {logs.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Throttle delay */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mr-1">
                            <span>Pausa:</span>
                            <select
                                value={throttleMs}
                                onChange={(e) => setThrottleMs(Number(e.target.value))}
                                disabled={isRunning}
                                className="px-1.5 py-1 text-xs border border-slate-200 rounded-md bg-white outline-hidden focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value={300}>300ms (Rápido)</option>
                                <option value={600}>600ms (Normal)</option>
                                <option value={1200}>1.2s (Seguro)</option>
                            </select>
                        </div>

                        {isRunning ? (
                            <button
                                onClick={handleStop}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 animate-pulse"
                            >
                                <Square size={13} className="fill-current" />
                                <span>Detener Pruebas</span>
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleRunMandatory}
                                    disabled={isLoading || mandatory.isFinished}
                                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <Sparkles size={13} />
                                    <span>Generar Obligatorias</span>
                                </button>
                                <button
                                    onClick={handleRunAll}
                                    disabled={isLoading || total.isFinished}
                                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <Zap size={13} />
                                    <span>Generar Todas</span>
                                </button>
                                <button
                                    onClick={() => refetch()}
                                    title="Actualizar estado"
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <RefreshCw size={15} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-300">
                    {isLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs font-medium">Cargando estado de pruebas de acreditación...</p>
                        </div>
                    ) : activeTab === 'table' ? (
                        <CompanyDteTestTable
                            tests={tests}
                            onRunSingle={handleRunSingle}
                            isRunning={isRunning}
                            runningTestKey={runningTestKey}
                        />
                    ) : (
                        <CompanyDteTestConsole
                            logs={logs}
                            onClear={() => setLogs([])}
                            isRunning={isRunning}
                        />
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        {isRunning ? (
                            <span className="flex items-center gap-2 text-indigo-600 font-bold">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                                Generando y transmitiendo pruebas a Hacienda en tiempo real...
                            </span>
                        ) : (
                            'Listo para ejecutar pruebas individuales o en lote.'
                        )}
                    </span>
                    <button
                        onClick={onClose}
                        disabled={isRunning}
                        className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold transition-all text-xs"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
