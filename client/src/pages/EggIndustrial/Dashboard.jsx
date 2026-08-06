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
            return 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse';
        }
        return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
    };

    return (
        <div className="space-y-6">
            {/* Header del Dashboard */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                        <Cpu className="h-8 w-8 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Centro de Control IoT SCADA</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Monitoreo en tiempo real y simulación de inocuidad alimentaria (HACCP)</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl border border-slate-700 text-[12px] font-bold">
                        <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-teal-500 animate-ping' : 'bg-rose-500'}`} />
                        <span className="text-slate-300">SCADA: {socketConnected ? 'CONECTADO (WebSocket)' : 'DESCONECTADO'}</span>
                    </div>
                    <button 
                        onClick={handleResetSimulation}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-extrabold transition-all border border-indigo-500 flex items-center gap-2 shadow-lg shadow-indigo-600/15"
                    >
                        <RefreshCw size={14} />
                        Restablecer Planta
                    </button>
                </div>
            </div>

            {/* Layout de Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* 1. DIAGRAMA DE FLUJO DE PLANTA (SCADA VISUAL) */}
                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-teal-400" />
                            Flujo Continuo del Proceso Pasteurizador
                        </h2>
                        <div className="h-px bg-slate-800" />
                    </div>

                    {/* Flujo Gráfico */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 py-6 relative">
                        {/* Paso 1: Recepción */}
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-between text-center relative z-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Paso 01</span>
                            <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center my-3 text-slate-300 font-black">MP</div>
                            <span className="text-[11px] font-bold text-slate-300">Recepción Huevo</span>
                            <span className="text-[9px] text-slate-400 mt-1">Cáscara / Líquido</span>
                        </div>

                        {/* Flecha */}
                        <div className="hidden md:flex items-center justify-center text-slate-700">
                            <ArrowRight size={20} className="animate-pulse" />
                        </div>

                        {/* Paso 2: Holding Tanks */}
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-between text-center relative z-10">
                            <span className="text-[10px] font-black text-slate-500 uppercase">Paso 02</span>
                            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center my-3 font-black">
                                <Thermometer className="h-6 w-6 animate-pulse" />
                            </div>
                            <span className="text-[11px] font-bold text-slate-300">Holding & Frío</span>
                            <span className="text-[9px] text-slate-400 mt-1">2.0°C a 6.0°C</span>
                        </div>

                        {/* Flecha */}
                        <div className="hidden md:flex items-center justify-center text-slate-700">
                            <ArrowRight size={20} className="animate-pulse" />
                        </div>

                        {/* Paso 3: Pasteurizador (Critical PCC) */}
                        <div className={`rounded-2xl p-4 flex flex-col items-center justify-between text-center relative z-10 border transition-all ${
                            telemetry?.pasteurizer?.active 
                                ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-500/5 border-rose-500/30' : 'bg-teal-500/5 border-teal-500/30')
                                : 'bg-slate-800/40 border-slate-700/50'
                        }`}>
                            <span className="text-[10px] font-black text-slate-500 uppercase">Paso 03 (PCC)</span>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center my-3 font-black ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-500/10 text-rose-500' : 'bg-teal-500/10 text-teal-400')
                                    : 'bg-slate-700 text-slate-400'
                            }`}>
                                <Activity className={`h-6 w-6 ${telemetry?.pasteurizer?.active ? 'animate-bounce' : ''}`} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-300">Pasteurizador</span>
                            <span className={`text-[9px] font-bold mt-1 ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'text-rose-500' : 'text-teal-400')
                                    : 'text-slate-400'
                            }`}>
                                {telemetry?.pasteurizer?.active 
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'FALLA HACCP' : 'OPERANDO OK')
                                    : 'APAGADO'}
                            </span>
                        </div>
                    </div>

                    {/* Diales de Temperatura */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950 p-6 rounded-2xl border border-slate-800/50">
                        {/* Dial Pasteurizador */}
                        <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className={`p-4 rounded-full ${
                                telemetry?.pasteurizer?.active 
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-500/10 text-rose-500 animate-ping' : 'bg-teal-500/10 text-teal-400')
                                    : 'bg-slate-800 text-slate-500'
                            }`}>
                                <Thermometer className="h-8 w-8" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Temp Pasteurización</span>
                                <span className="text-2xl font-black text-white">{telemetry?.pasteurizer?.temp || 0.0}°C</span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">Límite HACCP: Huevo Entero &gt;= 64°C</span>
                            </div>
                        </div>

                        {/* Dial Flujo y Presión */}
                        <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                            <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400">
                                <Droplets className="h-8 w-8 animate-pulse" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Parámetros Hidráulicos</span>
                                <div className="flex items-center gap-4">
                                    <div>
                                        <span className="text-slate-400 text-[10px] block">Flujo</span>
                                        <span className="text-sm font-bold text-white">{telemetry?.pasteurizer?.flow || 0} GPM</span>
                                    </div>
                                    <div className="h-6 w-px bg-slate-800" />
                                    <div>
                                        <span className="text-slate-400 text-[10px] block">Presión</span>
                                        <span className="text-sm font-bold text-white">{telemetry?.pasteurizer?.pressure || 0} PSI</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PANEL DE SIMULADORES E INYECCIÓN DE ALERTAS */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-indigo-400" />
                            Simulador IoT (PLC / SCADA)
                        </h2>
                        <div className="h-px bg-slate-800" />
                    </div>

                    {/* Controles de Pasteurizador */}
                    <div className="space-y-4">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Control de Pasteurizador</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleTogglePasteurizer(true)}
                                    disabled={telemetry?.pasteurizer?.active}
                                    className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                        telemetry?.pasteurizer?.active 
                                            ? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    }`}
                                >
                                    <Play size={12} />
                                    Encender
                                </button>
                                <button
                                    onClick={() => handleTogglePasteurizer(false)}
                                    disabled={!telemetry?.pasteurizer?.active}
                                    className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                        !telemetry?.pasteurizer?.active 
                                            ? 'bg-rose-500/20 text-rose-500 border-rose-500/30'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    }`}
                                >
                                    <Pause size={12} />
                                    Apagar
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-800/50" />

                        {/* Inyectar Falla Pasteurizador */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block flex items-center gap-1">
                                <ShieldAlert size={12} />
                                Inyectar Desviación HACCP
                            </span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={simulatedPasteurizerTemp}
                                    onChange={(e) => setSimulatedPasteurizerTemp(e.target.value)}
                                    className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[12px] text-white font-bold"
                                    placeholder="59.5"
                                    step="0.1"
                                />
                                <button
                                    onClick={handleInjectHaccpDeviation}
                                    disabled={!telemetry?.pasteurizer?.active}
                                    className="flex-1 py-1.5 px-3 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Falla Temp (PCC)
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-800/50" />

                        {/* Inyectar Alarma Tanques */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider block">Alarma Tanque Holding</span>
                            <select
                                value={selectedTank}
                                onChange={(e) => setSelectedTank(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] text-slate-300 font-bold"
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
                                    className="w-20 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[12px] text-white font-bold"
                                    placeholder="7.2"
                                    step="0.1"
                                />
                                <button
                                    onClick={handleInjectTankAlarm}
                                    className="flex-1 py-1.5 px-3 bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/30 hover:border-orange-500/50 text-orange-400 rounded-lg text-[11px] font-bold transition-all"
                                >
                                    Forzar Alarma
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fila de Tanques y Bitácora de Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* 3. LECTURAS DE HOLDING TANKS (CADENA DE FRÍO) */}
                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-teal-400" />
                            Cadena de Frío: Tanques de Holding & Almacén
                        </h2>
                        <div className="h-px bg-slate-800" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {telemetry?.tanks.map(tank => (
                            <div key={tank.id} className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:border-slate-700">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight block truncate">{tank.id}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                                        tank.status === 'alarm' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800 text-slate-400'
                                    }`}>
                                        {tank.status === 'alarm' ? 'ALARMA FRÍO' : 'SISTEMA OK'}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between mt-4">
                                    <span className={`text-xl font-black px-2.5 py-1 rounded-xl ${getTankTempBadge(tank.temp, tank.status)}`}>
                                        {tank.temp}°C
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-semibold">{tank.humidity}% Hum</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. BITÁCORA DE ALERTAS (AUDIT TRAIL EN VIVO) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[220px]">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                            Alertas Críticas SCADA
                        </h2>
                        <div className="h-px bg-slate-800" />
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[140px] space-y-2 mt-4 pr-1 custom-scrollbar">
                        {alerts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-4">
                                <CheckCircle className="h-8 w-8 text-slate-700 mb-1" />
                                <span className="text-[11px] font-bold">Sin alertas activas</span>
                            </div>
                        ) : (
                            alerts.map(a => (
                                <div key={a.id} className={`p-2.5 rounded-xl border flex gap-2 items-start ${
                                    a.severity === 'critical' 
                                        ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' 
                                        : 'bg-orange-500/5 border-orange-500/20 text-orange-400'
                                }`}>
                                    <AlertOctagon size={16} className="shrink-0 mt-0.5" />
                                    <div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-[9px] font-black uppercase tracking-wider bg-slate-950 px-1.5 py-0.5 rounded-md">{a.type}</span>
                                            <span className="text-[8px] text-slate-500 font-black">{a.timestamp}</span>
                                        </div>
                                        <p className="text-[10px] font-semibold mt-1 leading-snug">{a.message}</p>
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
