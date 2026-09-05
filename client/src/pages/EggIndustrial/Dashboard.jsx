import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import {
    Activity,
    Thermometer,
    Droplets,
    AlertTriangle,
    CheckCircle,
    Play,
    Pause,
    RefreshCw,
    AlertOctagon,
    Settings,
    ShieldAlert,
    Cpu,
    ArrowRight
} from 'lucide-react';

const EggDashboard = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    const [socketConnected, setSocketConnected] = useState(false);
    const [telemetry, setTelemetry] = useState(null);
    const [alerts, setAlerts] = useState([]);
    
    // Controles para simulación manual
    const [selectedTank, setSelectedTank] = useState('Tanque Pulmón 1');
    const [simulatedTankTemp, setSimulatedTankTemp] = useState('7.2');
    const [simulatedPasteurizerTemp, setSimulatedPasteurizerTemp] = useState('59.5');

    const socketRef = useRef(null);

    // Conectar WebSocket
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // En desarrollo local apunta a port 4000
        const wsUrl = `${protocol}//${window.location.hostname}:4000/ws/egg-industrial?company_id=${companyId}`;
        
        console.log('Conectando a WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket Conectado exitosamente');
            setSocketConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if (parsed.event === 'telemetry_initial' || parsed.event === 'telemetry_update') {
                    setTelemetry(parsed.data);
                } else if (parsed.event === 'haccp_alert') {
                    const newAlert = {
                        id: Date.now(),
                        type: 'HACCP',
                        severity: 'critical',
                        message: parsed.data.message,
                        timestamp: new Date().toLocaleTimeString()
                    };
                    setAlerts(prev => [newAlert, ...prev]);
                    toast.error(parsed.data.message, { duration: 8000 });
                } else if (parsed.event === 'tank_alert') {
                    const newAlert = {
                        id: Date.now(),
                        type: 'FRÍO',
                        severity: 'warning',
                        message: parsed.data.message,
                        timestamp: new Date().toLocaleTimeString()
                    };
                    setAlerts(prev => [newAlert, ...prev]);
                    toast.warning(parsed.data.message);
                }
            } catch (err) {
                console.error('Error procesando telemetría WS:', err);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket Desconectado');
            setSocketConnected(false);
        };

        return () => {
            if (ws) ws.close();
        };
    }, [companyId]);

    // Enviar comandos al WebSocket
    const sendWsCommand = (event, data) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ event, data }));
        } else {
            toast.error('Error: WebSocket no conectado.');
        }
    };

    const handleInjectTankAlarm = () => {
        sendWsCommand('inject_tank_alarm', {
            tankId: selectedTank,
            temp: parseFloat(simulatedTankTemp)
        });
        toast.info(`Inyectando temperatura de ${simulatedTankTemp}°C en ${selectedTank}`);
    };

    const handleInjectHaccpDeviation = () => {
        sendWsCommand('inject_haccp_deviation', {
            temperature: parseFloat(simulatedPasteurizerTemp)
        });
        toast.info(`Inyectando falla de pasteurización a ${simulatedPasteurizerTemp}°C`);
    };

    const handleResetSimulation = () => {
        sendWsCommand('reset_alarms', {});
        setAlerts([]);
        toast.success('Telemetría restablecida a condiciones normales de operación');
    };

    const handleTogglePasteurizer = (active) => {
        sendWsCommand('control_pasteurizer', {
            active,
            batchUuid: active ? '3b92f4ad-981f-4b07-9b2f-37dbf25d911b' : null,
            productType: 'huevo entero'
        });
        toast.info(active ? 'Encendiendo pasteurizador en modo simulación' : 'Apagando pasteurizador');
    };

    // Helper para determinar color de la temperatura de holding (2 a 6 C)
    const getTankTempBadge = (temp, status) => {
        if (status === 'alarm' || temp < 2.0 || temp > 6.0) {
            return 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse';
        }
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    };

    return (
        <div className="space-y-6 text-slate-900">
            {/* Header del Dashboard */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Cpu className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Monitoreo de Planta y Pasteurización</h1>
                        <p className="text-xs text-slate-500 font-medium">Control en tiempo real de temperaturas de holding, pasteurizador y cadena de frío (HACCP)</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold">
                        <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span className="text-slate-700">Telemetría: {socketConnected ? 'En Línea' : 'Desconectada'}</span>
                    </div>
                    <button 
                        onClick={handleResetSimulation}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                    >
                        <RefreshCw size={14} />
                        Restablecer Lecturas
                    </button>
                </div>
            </div>

            {/* Layout de Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* 1. DIAGRAMA DE FLUJO DE PLANTA */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-600" />
                            Etapas del Proceso Productivo y Puntos Críticos (PCC)
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    {/* Flujo Gráfico */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 py-4 relative">
                        {/* Paso 1: Recepción */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between text-center relative z-10">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paso 01</span>
                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center my-3 text-slate-700 font-bold shadow-xs">MP</div>
                            <span className="text-xs font-bold text-slate-800">Recepción Huevo</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Cáscara / Líquido</span>
                        </div>

                        {/* Flecha */}
                        <div className="hidden md:flex items-center justify-center text-slate-300">
                            <ArrowRight size={20} />
                        </div>

                        {/* Paso 2: Holding Tanks */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between text-center relative z-10">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paso 02</span>
                            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center my-3 font-bold shadow-xs">
                                <Thermometer className="h-6 w-6" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Tanques Pulmón / Frío</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Rango: 2.0°C a 6.0°C</span>
                        </div>

                        {/* Flecha */}
                        <div className="hidden md:flex items-center justify-center text-slate-300">
                            <ArrowRight size={20} />
                        </div>

                        {/* Paso 3: Pasteurizador (Critical PCC) */}
                        <div className={`rounded-xl p-4 flex flex-col items-center justify-between text-center relative z-10 border transition-all ${
                            telemetry?.pasteurizer?.active 
                                ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300')
                                : 'bg-slate-50 border-slate-200'
                        }`}>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paso 03 (PCC-1)</span>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center my-3 font-bold shadow-xs ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-white text-rose-600 border border-rose-200' : 'bg-white text-emerald-600 border border-emerald-200')
                                    : 'bg-white text-slate-400 border border-slate-200'
                            }`}>
                                <Activity className={`h-6 w-6 ${telemetry?.pasteurizer?.active ? 'animate-pulse' : ''}`} />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Pasteurizador</span>
                            <span className={`text-[10px] font-bold mt-0.5 ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'text-rose-700' : 'text-emerald-700')
                                    : 'text-slate-500'
                            }`}>
                                {telemetry?.pasteurizer?.active 
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'DESVIACIÓN TÉRMICA' : 'OPERANDO NORMAL')
                                    : 'DETENIDO'}
                            </span>
                        </div>
                    </div>

                    {/* Diales de Temperatura */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                        {/* Dial Pasteurizador */}
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                            <div className={`p-3.5 rounded-xl ${
                                telemetry?.pasteurizer?.active 
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200')
                                    : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Thermometer className="h-7 w-7" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Temperatura de Pasteurización</span>
                                <span className="text-2xl font-black text-slate-900">{telemetry?.pasteurizer?.temp || 0.0}°C</span>
                                <span className="text-[11px] text-slate-500 block font-medium">Norma: Huevo Entero ≥ 64.0°C</span>
                            </div>
                        </div>

                        {/* Dial Flujo y Presión */}
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                            <div className="p-3.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                                <Droplets className="h-7 w-7" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Parámetros Hidráulicos de Bombeo</span>
                                <div className="flex items-center gap-6 mt-1">
                                    <div>
                                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Flujo</span>
                                        <span className="text-base font-bold text-slate-900">{telemetry?.pasteurizer?.flow || 0} GPM</span>
                                    </div>
                                    <div className="h-7 w-px bg-slate-200" />
                                    <div>
                                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Presión</span>
                                        <span className="text-base font-bold text-slate-900">{telemetry?.pasteurizer?.pressure || 0} PSI</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PANEL DE PRUEBAS Y CONTROL */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-indigo-600" />
                            Control de Equipos & Pruebas
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    {/* Controles de Pasteurizador */}
                    <div className="space-y-4">
                        <div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Equipo Pasteurizador</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleTogglePasteurizer(true)}
                                    disabled={telemetry?.pasteurizer?.active}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                                        telemetry?.pasteurizer?.active 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                    }`}
                                >
                                    <Play size={13} />
                                    Encender
                                </button>
                                <button
                                    onClick={() => handleTogglePasteurizer(false)}
                                    disabled={!telemetry?.pasteurizer?.active}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                                        !telemetry?.pasteurizer?.active 
                                            ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                    }`}
                                >
                                    <Pause size={13} />
                                    Apagar
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Inyectar Falla Pasteurizador */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-rose-700 uppercase block flex items-center gap-1">
                                <ShieldAlert size={14} />
                                Prueba de Desviación Térmica (PCC)
                            </span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={simulatedPasteurizerTemp}
                                    onChange={(e) => setSimulatedPasteurizerTemp(e.target.value)}
                                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                    placeholder="59.5"
                                    step="0.1"
                                />
                                <button
                                    onClick={handleInjectHaccpDeviation}
                                    disabled={!telemetry?.pasteurizer?.active}
                                    className="flex-1 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Simular Desviación
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Inyectar Alarma Tanques */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-amber-700 uppercase block">Prueba Cadena de Frío en Tanque</span>
                            <select
                                value={selectedTank}
                                onChange={(e) => setSelectedTank(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            >
                                {telemetry?.tanks.map(t => (
                                    <option key={t.id} value={t.id}>{t.id}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={simulatedTankTemp}
                                    onChange={(e) => setSimulatedTankTemp(e.target.value)}
                                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    placeholder="7.2"
                                    step="0.1"
                                />
                                <button
                                    onClick={handleInjectTankAlarm}
                                    className="flex-1 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all"
                                >
                                    Simular Alerta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fila de Tanques y Bitácora de Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* 3. LECTURAS DE HOLDING TANKS */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-600" />
                            Monitoreo de Frío: Tanques Pulmón y Almacenamiento
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {telemetry?.tanks.map(tank => (
                            <div key={tank.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:border-slate-300">
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight block truncate">{tank.id}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        tank.status === 'alarm' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {tank.status === 'alarm' ? 'ALERTA DE FRÍO' : 'EN RANGO NORMAL'}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between mt-4">
                                    <span className={`text-xl font-black px-2.5 py-1 rounded-xl ${getTankTempBadge(tank.temp, tank.status)}`}>
                                        {tank.temp}°C
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-semibold">{tank.humidity}% Hum</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. BITÁCORA DE ALERTAS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                            Registro de Alertas de Planta
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[160px] space-y-2 mt-4 pr-1">
                        {alerts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-4">
                                <CheckCircle className="h-8 w-8 text-emerald-500 mb-1" />
                                <span className="text-xs font-semibold text-slate-600">Sin desviaciones activas</span>
                            </div>
                        ) : (
                            alerts.map(a => (
                                <div key={a.id} className={`p-2.5 rounded-xl border flex gap-2 items-start ${
                                    a.severity === 'critical' 
                                        ? 'bg-rose-50 border-rose-200 text-rose-800' 
                                        : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                    <AlertOctagon size={16} className="shrink-0 mt-0.5 text-rose-600" />
                                    <div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wide bg-white px-1.5 py-0.5 rounded border border-slate-200">{a.type}</span>
                                            <span className="text-[10px] text-slate-500 font-bold">{a.timestamp}</span>
                                        </div>
                                        <p className="text-xs font-semibold mt-1 leading-snug">{a.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EggDashboard;
