const os = require('os');
const fs = require('fs');
const pool = require('../config/db');

// In-memory cache for CPU delta calculations
let prevCpuTimes = null;

function calculateCpuUsage() {
    const cpus = os.cpus();
    if (!cpus || cpus.length === 0) {
        return { percent: 0, cores: 1, model: 'N/A', speed_mhz: 0 };
    }

    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (const cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }
    const total = user + nice + sys + idle + irq;

    if (!prevCpuTimes) {
        prevCpuTimes = { total, idle };
        return {
            percent: 0,
            cores: cpus.length,
            model: cpus[0]?.model || 'N/A',
            speed_mhz: cpus[0]?.speed || 0,
        };
    }

    const deltaTotal = total - prevCpuTimes.total;
    const deltaIdle = idle - prevCpuTimes.idle;
    prevCpuTimes = { total, idle };

    const percent = deltaTotal > 0 ? Math.max(0, Math.min(100, ((deltaTotal - deltaIdle) / deltaTotal) * 100)) : 0;

    return {
        percent: parseFloat(percent.toFixed(1)),
        cores: cpus.length,
        model: cpus[0]?.model || 'N/A',
        speed_mhz: cpus[0]?.speed || 0,
    };
}

const getSystemMetrics = async (req, res) => {
    try {
        // 1. CPU
        const cpu = calculateCpuUsage();

        // 2. RAM & Node Memory
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsage = process.memoryUsage();

        // 3. Disk Space (process.cwd())
        let disk = null;
        try {
            const stats = fs.statfsSync(process.cwd());
            const totalBytes = stats.blocks * stats.bsize;
            const freeBytes = stats.bfree * stats.bsize;
            const usedBytes = totalBytes - freeBytes;
            const percentUsed = totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
            disk = {
                total_bytes: totalBytes,
                free_bytes: freeBytes,
                used_bytes: usedBytes,
                total_gb: parseFloat((totalBytes / (1024 ** 3)).toFixed(2)),
                free_gb: parseFloat((freeBytes / (1024 ** 3)).toFixed(2)),
                used_gb: parseFloat((usedBytes / (1024 ** 3)).toFixed(2)),
                percent_used: percentUsed,
                is_warning: percentUsed >= 80,
                is_critical: percentUsed >= 90,
            };
        } catch (diskErr) {
            console.warn('[SystemMetrics] Error reading disk:', diskErr.message);
            disk = { error: diskErr.message };
        }

        // 4. Database Metrics (MySQL)
        let dbMetrics = {
            online: false,
            latency_ms: null,
            total_mb: 0,
            data_mb: 0,
            index_mb: 0,
            total_tables: 0,
            threads_connected: 0,
            threads_running: 0,
            slow_queries: 0,
            total_queries: 0,
            uptime_seconds: 0,
            top_tables: [],
        };

        try {
            const dbT0 = Date.now();
            await pool.query('SELECT 1');
            const dbLatency = Date.now() - dbT0;

            const [statusRows] = await pool.query(`
                SHOW GLOBAL STATUS WHERE Variable_name IN (
                    'Threads_connected', 'Threads_running', 'Uptime', 'Queries', 'Slow_queries', 'Max_used_connections'
                )
            `);
            const dbStatusMap = {};
            statusRows.forEach(r => { dbStatusMap[r.Variable_name] = r.Value; });

            const [sizeRows] = await pool.query(`
                SELECT 
                    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS total_mb,
                    ROUND(SUM(data_length) / 1024 / 1024, 2) AS data_mb,
                    ROUND(SUM(index_length) / 1024 / 1024, 2) AS index_mb,
                    COUNT(*) AS total_tables
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            `);

            const [topTables] = await pool.query(`
                SELECT 
                    table_name AS name,
                    table_rows AS rows_count,
                    ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                ORDER BY (data_length + index_length) DESC
                LIMIT 6
            `);

            dbMetrics = {
                online: true,
                latency_ms: dbLatency,
                total_mb: parseFloat(sizeRows[0]?.total_mb || 0),
                data_mb: parseFloat(sizeRows[0]?.data_mb || 0),
                index_mb: parseFloat(sizeRows[0]?.index_mb || 0),
                total_tables: parseInt(sizeRows[0]?.total_tables || 0),
                threads_connected: parseInt(dbStatusMap.Threads_connected || 0),
                threads_running: parseInt(dbStatusMap.Threads_running || 0),
                slow_queries: parseInt(dbStatusMap.Slow_queries || 0),
                total_queries: parseInt(dbStatusMap.Queries || 0),
                uptime_seconds: parseInt(dbStatusMap.Uptime || 0),
                top_tables: topTables.map(t => ({
                    name: t.name,
                    rows: parseInt(t.rows_count || 0),
                    size_mb: parseFloat(t.size_mb || 0),
                })),
            };
        } catch (dbErr) {
            console.warn('[SystemMetrics] Error querying database metrics:', dbErr.message);
            dbMetrics.error = dbErr.message;
        }

        // 5. DTE API Ping
        let dteStatus = { online: false, latency_ms: null, port: 5000 };
        try {
            const dteT0 = Date.now();
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 1200);
            const dteRes = await fetch('http://localhost:5000/api', { signal: ctrl.signal });
            clearTimeout(timeoutId);
            dteStatus = {
                online: dteRes.ok || dteRes.status < 500,
                latency_ms: Date.now() - dteT0,
                status_code: dteRes.status,
                port: 5000,
            };
        } catch (dteErr) {
            dteStatus = { online: false, latency_ms: null, error: dteErr.message, port: 5000 };
        }

        const metricsPayload = {
            os: {
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                hostname: os.hostname(),
                node_version: process.version,
                uptime_seconds: Math.floor(os.uptime()),
                load_avg: os.loadavg(),
            },
            cpu,
            memory: {
                system: {
                    total_bytes: totalMem,
                    free_bytes: freeMem,
                    used_bytes: usedMem,
                    total_gb: parseFloat((totalMem / (1024 ** 3)).toFixed(2)),
                    free_gb: parseFloat((freeMem / (1024 ** 3)).toFixed(2)),
                    used_gb: parseFloat((usedMem / (1024 ** 3)).toFixed(2)),
                    percent_used: parseFloat(((usedMem / totalMem) * 100).toFixed(1)),
                },
                node_process: {
                    rss_mb: parseFloat((memUsage.rss / 1024 / 1024).toFixed(2)),
                    heap_total_mb: parseFloat((memUsage.heapTotal / 1024 / 1024).toFixed(2)),
                    heap_used_mb: parseFloat((memUsage.heapUsed / 1024 / 1024).toFixed(2)),
                    external_mb: parseFloat((memUsage.external / 1024 / 1024).toFixed(2)),
                    uptime_seconds: Math.floor(process.uptime()),
                },
            },
            disk,
            database: dbMetrics,
            services: {
                main_server: {
                    name: 'Servidor Principal (API)',
                    online: true,
                    port: 4000,
                    uptime_seconds: Math.floor(process.uptime()),
                },
                dte_api: {
                    name: 'Microservicio DTE',
                    ...dteStatus,
                },
                database: {
                    name: 'Base de Datos MySQL',
                    online: dbMetrics.online,
                    latency_ms: dbMetrics.latency_ms,
                },
            },
            timestamp: new Date().toISOString(),
        };

        res.json(metricsPayload);
    } catch (err) {
        console.error('[SystemMetrics] Error in getSystemMetrics:', err);
        res.status(500).json({ message: 'Error obteniendo métricas del sistema', error: err.message });
    }
};

module.exports = {
    getSystemMetrics,
};
