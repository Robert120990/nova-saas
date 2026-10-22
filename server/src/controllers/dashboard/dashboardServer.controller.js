const os = require('os');
const net = require('net');
const fs = require('fs');
const pool = require('../../config/db');
const { getOrSetDashboard } = require('../../services/dashboardCache.service');

// Port probe helper
const checkPort = (host, port, timeout = 900) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let isResolved = false;
        socket.setTimeout(timeout);
        socket.once('connect', () => {
            if (!isResolved) { isResolved = true; socket.destroy(); resolve(true); }
        });
        socket.once('timeout', () => {
            if (!isResolved) { isResolved = true; socket.destroy(); resolve(false); }
        });
        socket.once('error', () => {
            if (!isResolved) { isResolved = true; socket.destroy(); resolve(false); }
        });
        try { socket.connect(port, host); } catch { resolve(false); }
    });
};

/**
 * Server Telemetry & Health Statistics
 */
const getServerStats = async (req, res) => {
    try {
        const force = req.query?.force === 'true';
        const cacheKey = 'dashboard:server:metrics';

        const data = await getOrSetDashboard(cacheKey, async () => {
            // 1. Hardware Metrics
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const ramPct = Math.round((usedMem / totalMem) * 100);

            const cpus = os.cpus();
            const cpuCount = cpus.length;
            const cpuModel = cpus[0]?.model || 'Procesador Host';
            const loadAvg = os.loadavg();

            // Disk space
            let disk = { totalGB: 0, freeGB: 0, usedGB: 0, percentage: 0 };
            try {
                const rootPath = process.platform === 'win32' ? 'C:\\' : '/';
                const stat = await fs.promises.statfs(rootPath);
                const total = (stat.bsize * stat.blocks) / 1e9;
                const free = (stat.bsize * stat.bfree) / 1e9;
                const used = total - free;
                disk = {
                    totalGB: parseFloat(total.toFixed(1)),
                    freeGB: parseFloat(free.toFixed(1)),
                    usedGB: parseFloat(used.toFixed(1)),
                    percentage: Math.round((used / total) * 100)
                };
            } catch (e) {
                console.warn('Statfs warning:', e.message);
            }

            // 2. Services probe in parallel
            const [dteApiOnline, mhProdOnline, mhTestOnline, webhookOnline] = await Promise.all([
                checkPort('127.0.0.1', 5000),
                checkPort('127.0.0.1', 8113),
                checkPort('127.0.0.1', 8114),
                checkPort('127.0.0.1', 7777)
            ]);

            // 3. MySQL Telemetry
            const startDb = Date.now();
            await pool.query('SELECT 1');
            const dbLatencyMs = Date.now() - startDb;

            let dbThreads = 0;
            let dbSlowQueries = 0;
            let dbUptime = 0;
            try {
                const [statusRows] = await pool.query(`
                    SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Slow_queries', 'Uptime')
                `);
                (statusRows || []).forEach(r => {
                    if (r.Variable_name === 'Threads_connected') dbThreads = parseInt(r.Value || 0);
                    if (r.Variable_name === 'Slow_queries') dbSlowQueries = parseInt(r.Value || 0);
                    if (r.Variable_name === 'Uptime') dbUptime = parseInt(r.Value || 0);
                });
            } catch (e) { 
                console.error('DB STATUS ERR:', e); 
            }

            return {
                hardware: {
                    cpuCount,
                    cpuModel,
                    loadAvg: [
                        parseFloat(loadAvg[0]?.toFixed(2) || 0),
                        parseFloat(loadAvg[1]?.toFixed(2) || 0),
                        parseFloat(loadAvg[2]?.toFixed(2) || 0)
                    ],
                    ram: {
                        totalGB: parseFloat((totalMem / 1e9).toFixed(2)),
                        freeGB: parseFloat((freeMem / 1e9).toFixed(2)),
                        usedGB: parseFloat((usedMem / 1e9).toFixed(2)),
                        percentage: ramPct
                    },
                    disk,
                    uptimeSeconds: Math.floor(os.uptime()),
                    processUptimeSeconds: Math.floor(process.uptime())
                },
                services: [
                    { name: 'API Principal (Nova Server)', port: 4000, status: 'online', type: 'core' },
                    { name: 'Servicio DTE (Express / Hacienda)', port: 5000, status: dteApiOnline ? 'online' : 'offline', type: 'dte' },
                    { name: 'Firmador MH Producción (Docker)', port: 8113, status: mhProdOnline ? 'online' : 'offline', type: 'mh' },
                    { name: 'Firmador MH Pruebas (Docker)', port: 8114, status: mhTestOnline ? 'online' : 'offline', type: 'mh' },
                    { name: 'Servicio Webhook Notificaciones', port: 7777, status: webhookOnline ? 'online' : 'offline', type: 'webhook' }
                ],
                database: {
                    status: 'online',
                    latencyMs: dbLatencyMs,
                    connectedThreads: dbThreads,
                    slowQueries: dbSlowQueries,
                    uptimeSeconds: dbUptime
                }
            };
        }, 10, force); // 10s TTL for server health

        return res.json(data);
    } catch (error) {
        console.error('CRITICAL SERVER DASHBOARD ERROR:', error);
        return res.status(500).json({ message: 'Error al obtener métricas del servidor', error: error.message });
    }
};

module.exports = {
    getServerStats
};
