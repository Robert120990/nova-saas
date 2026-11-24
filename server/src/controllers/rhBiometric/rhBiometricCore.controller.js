const path = require('path');
const fs = require('fs');
const os = require('os');
const rhBiometricService = require('../../services/rhBiometric.service');

const getDevices = async (req, res) => {
    try {
        const devices = await rhBiometricService.getDevices(req.company_id);
        res.json({ success: true, data: devices });
    } catch (error) {
        console.error('Error al obtener dispositivos biométricos:', error);
        res.status(500).json({ message: error.message || 'Error al obtener dispositivos biométricos.' });
    }
};

const saveDevice = async (req, res) => {
    try {
        const device = await rhBiometricService.saveDevice(req.company_id, req.body);
        res.json({ success: true, data: device, message: 'Dispositivo guardado correctamente.' });
    } catch (error) {
        console.error('Error al guardar dispositivo biométrico:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al guardar dispositivo.' });
    }
};

const regenerateAgentKey = async (req, res) => {
    try {
        const newKey = await rhBiometricService.regenerateAgentKey(req.company_id, req.params.id);
        res.json({ success: true, agent_key: newKey, message: 'Nueva clave de conector generada.' });
    } catch (error) {
        console.error('Error al regenerar clave:', error);
        res.status(500).json({ message: error.message || 'Error al regenerar clave de conector.' });
    }
};

const getAttendanceLogs = async (req, res) => {
    try {
        const result = await rhBiometricService.getAttendanceLogs(req.company_id, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error al obtener registros de asistencia:', error);
        res.status(500).json({ message: error.message || 'Error al consultar registros de asistencia.' });
    }
};

const createManualPunch = async (req, res) => {
    try {
        const result = await rhBiometricService.createManualPunch(req.company_id, req.body);
        res.status(201).json({ success: true, data: result, message: 'Marcación manual registrada exitosamente.' });
    } catch (error) {
        console.error('Error al registrar marcación manual:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al registrar marcación manual.' });
    }
};

const updateManualPunch = async (req, res) => {
    try {
        const userLabel = req.user?.nombre || req.user?.username || 'RH';
        const result = await rhBiometricService.updateManualPunch(req.company_id, req.params.id, req.body, userLabel);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al actualizar marcación manual.' });
    }
};

const deleteManualPunch = async (req, res) => {
    try {
        const result = await rhBiometricService.deleteManualPunch(req.company_id, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al eliminar marcación manual.' });
    }
};

const getClockUsersComparison = async (req, res) => {
    try {
        const data = await rhBiometricService.getClockUsersComparison(req.company_id);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Error al consultar usuarios del reloj.' });
    }
};

const linkClockUser = async (req, res) => {
    try {
        const result = await rhBiometricService.linkClockUserToEmployee(req.company_id, req.body);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al vincular usuario biométrico.' });
    }
};

const cleanupInvalidDates = async (req, res) => {
    try {
        const result = await rhBiometricService.cleanupInvalidDates(req.company_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Error al limpiar fechas CMOS corruptas.' });
    }
};

const setUpdatePolicy = async (req, res) => {
    try {
        const result = await rhBiometricService.setDeviceUpdatePolicy(req.company_id, req.params.id, req.body?.update_policy);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al cambiar política de actualización.' });
    }
};

const requestDeviceUpdate = async (req, res) => {
    try {
        const userLabel = req.user?.nombre || req.user?.username || 'Admin';
        const result = await rhBiometricService.requestRemoteDeviceUpdate(req.company_id, req.params.id, userLabel);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al solicitar actualización del conector.' });
    }
};

const downloadUpdaterBat = async (req, res) => {
    try {
        const [devices] = await require('../../config/db').query(
            'SELECT * FROM rh_biometric_devices WHERE id = ? AND company_id = ?',
            [req.params.id, req.company_id]
        );
        if (!devices.length) return res.status(404).json({ message: 'Dispositivo no encontrado.' });
        const batContent = rhBiometricService.buildOneClickUpdaterBat(devices[0], getBestServerUrl(req));
        res.setHeader('Content-Type', 'application/x-bat');
        res.setHeader('Content-Disposition', 'attachment; filename="actualizar-conector.bat"');
        res.send(batContent);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Error al generar actualizador 1-clic.' });
    }
};

const syncFromAgent = async (req, res) => {
    try {
        const agentKey = req.headers['x-agent-key'] || req.body?.agent_key;
        if (!agentKey) return res.status(401).json({ message: 'Clave de conector (x-agent-key) requerida.' });

        const device = await rhBiometricService.getDeviceByAgentKey(agentKey);
        if (!device) return res.status(403).json({ message: 'Conector no autorizado o clave inválida.' });

        const punches = req.body?.punches || [];
        const deviceInfo = req.body?.device_info || null;
        const result = await rhBiometricService.processBatchPunches(device.company_id, device.id, punches);

        if (deviceInfo) {
            await rhBiometricService.updateDeviceHeartbeat(device.id, deviceInfo, 'online');
        }

        res.json({
            success: true,
            deviceId: device.id,
            deviceName: device.nombre,
            companyId: device.company_id,
            totalReceived: result.totalReceived,
            insertedCount: result.insertedCount,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error en sincronización desde agente biométrico:', error);
        res.status(500).json({ message: error.message || 'Error al procesar sincronización del reloj biométrico.' });
    }
};

const heartbeatFromAgent = async (req, res) => {
    try {
        const agentKey = req.headers['x-agent-key'] || req.body?.agent_key;
        if (!agentKey) return res.status(401).json({ message: 'Clave requerida.' });

        const device = await rhBiometricService.getDeviceByAgentKey(agentKey);
        if (!device) return res.status(403).json({ message: 'Dispositivo no autorizado.' });

        const deviceInfo = req.body?.device_info || null;
        const status = req.body?.status || 'online';
        const mergedInfo = await rhBiometricService.updateDeviceHeartbeat(device.id, deviceInfo, status);

        const lastPunchInfo = await rhBiometricService.getDeviceLastPunch(device.id, device.company_id);
        const agentMeta = rhBiometricService.getLatestAgentMetadata();
        const compat = rhBiometricService.evaluateDeviceCompatibility(device, mergedInfo);
        const updatePolicy = mergedInfo?.update_policy === 'prompt' ? 'prompt' : 'auto';
        const updateRequested = !!mergedInfo?.pending_update_request;

        res.json({
            success: true,
            status: 'pong',
            serverTime: new Date().toISOString(),
            last_punch_time: lastPunchInfo.last_punch_time,
            total_server_logs: lastPunchInfo.total_logs,
            latest_agent_version: agentMeta.version,
            agent_script_sha256: agentMeta.sha256,
            update_policy: updatePolicy,
            update_requested: updateRequested,
            is_compatible: compat.compatible,
            changelog: agentMeta.changelog
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getBestServerUrl = (req) => {
    const rawHost = req.get('host') || 'localhost:4000';
    const isLocalhost = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
    const protocol = (req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https') ? 'https' : 'http';

    if (!isLocalhost && !rawHost.startsWith('192.168.') && !rawHost.startsWith('10.') && !rawHost.startsWith('172.')) {
        return `${protocol}://${rawHost}`;
    }

    let lanIp = '127.0.0.1';
    try {
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    lanIp = net.address;
                    break;
                }
            }
            if (lanIp !== '127.0.0.1') break;
        }
    } catch { /* fallback */ }

    const backendPort = process.env.PORT || 4000;
    return `http://${lanIp}:${backendPort}`;
};

const downloadConfig = async (req, res) => {
    try {
        const deviceId = req.params.id;
        const [devices] = await require('../../config/db').query(
            'SELECT * FROM rh_biometric_devices WHERE id = ? AND company_id = ?',
            [deviceId, req.company_id]
        );
        if (!devices.length) return res.status(404).json({ message: 'Dispositivo no encontrado.' });
        const dev = devices[0];

        const cfg = {
            serverUrl: getBestServerUrl(req),
            companyId: dev.company_id,
            deviceId: dev.id,
            deviceName: dev.nombre,
            agentKey: dev.agent_key,
            deviceIp: dev.ip_address || '192.168.3.201',
            devicePort: dev.port || 4370,
            commKey: dev.comm_key || 0,
            protocol: dev.protocol || 'tcp',
            syncIntervalSeconds: 60,
            autoUpdate: true
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="config.json"');
        res.send(JSON.stringify(cfg, null, 2));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const sendAgentFile = (res, fileName, contentType, fallbackContent) => {
    const candidatePaths = [
        path.resolve(__dirname, `../../../../scripts/biometric-agent/${fileName}`),
        path.resolve(process.cwd(), `scripts/biometric-agent/${fileName}`),
        path.resolve(__dirname, `../../../scripts/biometric-agent/${fileName}`)
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            return res.sendFile(p);
        }
    }
    if (fallbackContent) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(fallbackContent);
    }
    return res.status(404).json({ message: `Archivo ${fileName} no encontrado en el servidor.` });
};

const downloadBat = (_req, res) => sendAgentFile(res, 'iniciar-conector.bat', 'application/x-bat', '@echo off\r\ncd /d "%~dp0"\r\nnode biometric-agent.js\r\npause\r\n');
const downloadStopBat = (_req, res) => sendAgentFile(res, 'detener-conector.bat', 'application/x-bat', '@echo off\r\ntaskkill /fi "WINDOWTITLE eq Conector Marcador Biometrico*" /f /t >nul 2>nul\r\npause\r\n');
const downloadServiceBat = (_req, res) => sendAgentFile(res, 'instalar-servicio-windows.bat', 'application/x-bat');
const downloadAgentScript = (_req, res) => sendAgentFile(res, 'biometric-agent.js', 'application/javascript');

const downloadAgentScriptByKey = async (req, res) => {
    try {
        const agentKey = req.headers['x-agent-key'] || req.query?.agent_key;
        if (!agentKey) return res.status(401).json({ message: 'Clave x-agent-key requerida.' });
        const device = await rhBiometricService.getDeviceByAgentKey(agentKey);
        if (!device) return res.status(403).json({ message: 'Dispositivo no autorizado.' });
        return downloadAgentScript(req, res);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDevices,
    saveDevice,
    regenerateAgentKey,
    getAttendanceLogs,
    createManualPunch,
    updateManualPunch,
    deleteManualPunch,
    getClockUsersComparison,
    linkClockUser,
    cleanupInvalidDates,
    setUpdatePolicy,
    requestDeviceUpdate,
    downloadUpdaterBat,
    syncFromAgent,
    heartbeatFromAgent,
    downloadConfig,
    downloadBat,
    downloadStopBat,
    downloadServiceBat,
    downloadAgentScript,
    downloadAgentScriptByKey
};
