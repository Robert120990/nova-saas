const WebSocket = require('ws');

// Almacén de clientes WebSocket conectados, agrupados por company_id
// Estructura: { companyId: Set([ws, ws, ...]) }
const companyClients = new Map();

// Almacén de clientes WebSocket para notificaciones, agrupados por user_id
// Estructura: { userId: Set([ws, ws, ...]) }
const userClients = new Map();

// Estado simulado de telemetría IoT industrial
const telemetryState = {
    // Tanques de Holding (2 a 6 C)
    tanks: [
        { id: 'Tanque Pulmón 1', temp: 3.8, humidity: 45.2, status: 'normal' },
        { id: 'Tanque Pulmón 2', temp: 4.1, humidity: 48.0, status: 'normal' },
        { id: 'Silo Almacén Crudo 1', temp: 4.5, humidity: 52.3, status: 'normal' },
        { id: 'Cámara Fría 1 (Líquido)', temp: 2.5, humidity: 60.1, status: 'normal' }
    ],
    // Pasteurizador (Parámetros del lote activo)
    pasteurizer: {
        temp: 64.5,
        flow: 12.5,
        pressure: 48.2,
        holdingTime: 210,
        haccpStatus: 'compliant', // compliant, deviation
        active: false,
        batchUuid: null
    }
};

let telemetryInterval = null;

function initWebSocket(server) {
    console.log('Inicializando servidor WebSocket para Procesamiento Industrial...');
    
    const wss = new WebSocket.Server({ noServer: true });

    // Acoplar al servidor HTTP nativo
    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

        if (pathname === '/ws/egg-industrial' || pathname === '/ws/inventory' || pathname === '/ws/notifications') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request, pathname);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on('connection', (ws, req) => {
        const parameters = Object.fromEntries(new URL(req.url, `http://${req.headers.host}`).searchParams);

        const companyId = parseInt(parameters.company_id || '1');

        const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

        const userId = parseInt(parameters.user_id || '0');

        console.log(`Cliente WebSocket conectado. Company ID: ${companyId}, User ID: ${userId}, Path: ${pathname}`);

        // Asociar cliente a su compañía
        if (!companyClients.has(companyId)) {
            companyClients.set(companyId, new Set());
        }
        companyClients.get(companyId).add(ws);

        // Asociar cliente a su usuario (para notificaciones)
        if (pathname === '/ws/notifications' && userId) {
            if (!userClients.has(userId)) {
                userClients.set(userId, new Set());
            }
            userClients.get(userId).add(ws);
        }

        // Solo egg-industrial envía estado inicial de telemetría
        if (pathname === '/ws/egg-industrial') {
            ws.send(JSON.stringify({
                event: 'telemetry_initial',
                data: telemetryState
            }));
        }

        ws.on('message', (message) => {
            try {
                const parsed = JSON.parse(message);
                console.log(`Mensaje WS recibido (Company ${companyId}):`, parsed);
                
                // Manejar comandos entrantes desde el frontend
                if (parsed.event === 'control_pasteurizer') {
                    // Cambiar estado del pasteurizador
                    const { active, batchUuid, productType } = parsed.data;
                    telemetryState.pasteurizer.active = active;
                    telemetryState.pasteurizer.batchUuid = batchUuid;
                    
                    if (active) {
                        // Temp objetivo según producto
                        let targetTemp = 64.5; // Huevo entero
                        if (productType === 'clara') targetTemp = 57.2;
                        else if (productType && productType.includes('yema')) targetTemp = 65.0;
                        
                        telemetryState.pasteurizer.temp = targetTemp;
                        telemetryState.pasteurizer.haccpStatus = 'compliant';
                    }
                    
                    broadcastToCompany(companyId, 'telemetry_update', telemetryState);
                }
                
                if (parsed.event === 'inject_haccp_deviation') {
                    // Simular caída de temperatura para probar bloqueo automático
                    if (telemetryState.pasteurizer.active) {
                        telemetryState.pasteurizer.temp = parsed.data.temperature || 59.8;
                        telemetryState.pasteurizer.haccpStatus = 'deviation';
                        
                        // Notificar desviación inmediatamente
                        broadcastToCompany(companyId, 'haccp_alert', {
                            message: `ALERTA CRÍTICA: Desviación HACCP detectada en pasteurizador. Temperatura bajó a ${telemetryState.pasteurizer.temp}°C. Válvula desviadora activada.`,
                            temp: telemetryState.pasteurizer.temp,
                            batchUuid: telemetryState.pasteurizer.batchUuid
                        });
                    }
                    broadcastToCompany(companyId, 'telemetry_update', telemetryState);
                }
                
                if (parsed.event === 'inject_tank_alarm') {
                    // Activar alarma en un tanque
                    const { tankId, temp } = parsed.data;
                    const tank = telemetryState.tanks.find(t => t.id === tankId);
                    if (tank) {
                        tank.temp = temp;
                        tank.status = 'alarm';
                        
                        broadcastToCompany(companyId, 'tank_alert', {
                            tankId,
                            temp,
                            message: `ALERTA DE FRÍO: Tanque ${tankId} reporta ${temp}°C (límite superado).`
                        });
                    }
                    broadcastToCompany(companyId, 'telemetry_update', telemetryState);
                }
                
                if (parsed.event === 'reset_alarms') {
                    // Restablecer tanques y pasteurizador
                    telemetryState.tanks.forEach(t => {
                        if (t.id.includes('Cámara')) t.temp = 2.5;
                        else if (t.id.includes('Silo')) t.temp = 4.5;
                        else t.temp = t.id.includes('1') ? 3.8 : 4.1;
                        t.status = 'normal';
                    });
                    telemetryState.pasteurizer.haccpStatus = 'compliant';
                    if (telemetryState.pasteurizer.active) {
                        telemetryState.pasteurizer.temp = 64.5;
                    }
                    
                    broadcastToCompany(companyId, 'telemetry_update', telemetryState);
                }

            } catch (err) {
                console.error('Error procesando mensaje WS:', err);
            }
        });

        ws.on('close', () => {
            console.log(`Cliente WebSocket desconectado. Company ID: ${companyId}, User ID: ${userId}`);
            if (companyClients.has(companyId)) {
                companyClients.get(companyId).delete(ws);
                if (companyClients.get(companyId).size === 0) {
                    companyClients.delete(companyId);
                }
            }
            if (userId && userClients.has(userId)) {
                userClients.get(userId).delete(ws);
                if (userClients.get(userId).size === 0) {
                    userClients.delete(userId);
                }
            }
        });

        ws.on('error', (err) => {
            console.error('Error en socket WS:', err);
        });
    });

    // Iniciar el generador automático de telemetría IoT (fluctuaciones y simulación continua)
    startTelemetrySimulation();
}

function startTelemetrySimulation() {
    if (telemetryInterval) clearInterval(telemetryInterval);

    telemetryInterval = setInterval(() => {
        // 1. Simular fluctuaciones en tanques de holding
        telemetryState.tanks.forEach(tank => {
            if (tank.status === 'normal') {
                // Fluctuar +/- 0.15 grados
                const diff = (Math.random() * 0.3) - 0.15;
                tank.temp = parseFloat((tank.temp + diff).toFixed(2));
                
                // Asegurar que se mantenga dentro del rango normal (2 a 6 C, 1.5 a 4.5 para cámara)
                if (tank.id.includes('Cámara')) {
                    if (tank.temp < 1.0) tank.temp = 1.8;
                    if (tank.temp > 5.0) tank.temp = 3.2;
                } else {
                    if (tank.temp < 2.2) tank.temp = 2.8;
                    if (tank.temp > 5.8) tank.temp = 4.5;
                }
            }
        });

        // 2. Simular fluctuaciones en pasteurizador si está activo
        if (telemetryState.pasteurizer.active) {
            // Si está en desviación, no fluctuar automáticamente al alza sin control
            if (telemetryState.pasteurizer.haccpStatus === 'compliant') {
                // Fluctuar +/- 0.08 C
                const diff = (Math.random() * 0.16) - 0.08;
                telemetryState.pasteurizer.temp = parseFloat((telemetryState.pasteurizer.temp + diff).toFixed(2));
                
                // Fluctuar flujo y presión
                const flowDiff = (Math.random() * 0.4) - 0.2;
                telemetryState.pasteurizer.flow = parseFloat((telemetryState.pasteurizer.flow + flowDiff).toFixed(2));
                if (telemetryState.pasteurizer.flow < 10) telemetryState.pasteurizer.flow = 12.0;

                const pressDiff = (Math.random() * 0.8) - 0.4;
                telemetryState.pasteurizer.pressure = parseFloat((telemetryState.pasteurizer.pressure + pressDiff).toFixed(2));
                if (telemetryState.pasteurizer.pressure < 40) telemetryState.pasteurizer.pressure = 45.0;
            }
        } else {
            // Si está apagado, enfriar gradualmente hasta ambiente (ej. 22C)
            if (telemetryState.pasteurizer.temp > 22.5) {
                telemetryState.pasteurizer.temp = parseFloat((telemetryState.pasteurizer.temp - 1.5).toFixed(2));
                telemetryState.pasteurizer.flow = 0;
                telemetryState.pasteurizer.pressure = 0;
            } else {
                telemetryState.pasteurizer.temp = 22.0;
            }
        }

        // 3. Transmitir actualización de telemetría a todas las compañías activas
        for (const companyId of companyClients.keys()) {
            broadcastToCompany(companyId, 'telemetry_update', telemetryState);
        }
    }, 3000);
}

function sendToUser(userId, event, data) {
    const numericId = typeof userId === 'string' ? parseInt(userId) : userId;
    const clients = userClients.get(numericId);
    if (!clients) return;

    const payload = JSON.stringify({ event, data });
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    }
}

function broadcastToCompany(companyId, event, data) {
    const numericId = typeof companyId === 'string' ? parseInt(companyId) : companyId;
    const clients = companyClients.get(numericId);
    if (!clients) return;

    const payload = JSON.stringify({ event, data });
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
        }
    }
}

module.exports = {
    initWebSocket,
    broadcastToCompany,
    sendToUser,
    telemetryState
};
