import { createAuthenticatedSocket } from '../../../utils/webSocketUtils';
import { formatTime } from '../../../utils/dateUtils';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';



export default function useDashboardModel() {
    const navigate = useNavigate();
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
        const ws = createAuthenticatedSocket('/ws/egg-industrial', companyId);
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
                        timestamp: formatTime(new Date())
                    };
                    setAlerts(prev => [newAlert, ...prev]);
                    toast.error(parsed.data.message, { duration: 8000 });
                } else if (parsed.event === 'tank_alert') {
                    const newAlert = {
                        id: Date.now(),
                        type: 'FRÍO',
                        severity: 'warning',
                        message: parsed.data.message,
                        timestamp: formatTime(new Date())
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
        if (user?.role !== 'SuperAdmin' && !user?.permissions?.includes('manage_egg_telemetry_simulation')) { toast.error('No tiene permiso para modificar la simulación.'); return; }
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


 return { navigate, user, companyId, socketConnected, setSocketConnected, telemetry, setTelemetry, alerts, setAlerts, selectedTank, setSelectedTank, simulatedTankTemp, setSimulatedTankTemp, simulatedPasteurizerTemp, setSimulatedPasteurizerTemp, socketRef, sendWsCommand, handleInjectTankAlarm, handleInjectHaccpDeviation, handleResetSimulation, handleTogglePasteurizer, getTankTempBadge };
}
