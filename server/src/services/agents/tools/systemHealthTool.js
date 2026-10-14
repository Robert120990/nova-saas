const os = require('os');
const fs = require('fs');
const pool = require('../../../config/db');

/**
 * Tool for diagnosing server and system health:
 * CPU, RAM, Disk, MySQL Database status, Node.js process, DTE API ping.
 */

function formatUptime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

async function getSystemHealth() {
    // 1. CPU & OS
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model || 'N/A';
    const cpuCores = cpus.length;

    // 2. RAM
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const ramUsagePercent = parseFloat(((usedMemBytes / totalMemBytes) * 100).toFixed(1));

    // 3. Process Memory
    const procMem = process.memoryUsage();

    // 4. Disk Space
    let disk = null;
    try {
        const stats = fs.statfsSync(process.cwd());
        const totalBytes = stats.blocks * stats.bsize;
        const freeBytes = stats.bfree * stats.bsize;
        const usedBytes = totalBytes - freeBytes;
        const percentUsed = totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
        disk = {
            total_gb: parseFloat((totalBytes / (1024 ** 3)).toFixed(2)),
            free_gb: parseFloat((freeBytes / (1024 ** 3)).toFixed(2)),
            used_gb: parseFloat((usedBytes / (1024 ** 3)).toFixed(2)),
            percent_used: percentUsed,
            status: percentUsed >= 90 ? 'CRITICAL' : (percentUsed >= 80 ? 'WARNING' : 'HEALTHY')
        };
    } catch (e) {
        disk = { error: e.message };
    }

    // 5. Database Diagnostics
    let dbStatus = { online: false };
    try {
        const t0 = Date.now();
        const [testRows] = await pool.query('SELECT 1 as ping');
        const latencyMs = Date.now() - t0;

        const [statusRows] = await pool.query(
            "SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Uptime', 'Queries', 'Slow_queries')"
        );
        const map = {};
        statusRows.forEach(r => { map[r.Variable_name] = r.Value; });

        // Database size
        const [sizeRows] = await pool.query(`
            SELECT 
                ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS total_mb,
                COUNT(table_name) AS total_tables
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        `);

        // Top 5 largest tables
        const [topTables] = await pool.query(`
            SELECT table_name,
                   ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
                   table_rows
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            ORDER BY (data_length + index_length) DESC
            LIMIT 5
        `);

        dbStatus = {
            online: testRows.length > 0,
            latency_ms: latencyMs,
            threads_connected: parseInt(map.Threads_connected || '0', 10),
            threads_running: parseInt(map.Threads_running || '0', 10),
            slow_queries: parseInt(map.Slow_queries || '0', 10),
            uptime: formatUptime(parseInt(map.Uptime || '0', 10)),
            database_size_mb: sizeRows[0]?.total_mb || 0,
            total_tables: sizeRows[0]?.total_tables || 0,
            top_tables: topTables
        };
    } catch (dbErr) {
        dbStatus = { online: false, error: dbErr.message };
    }

    // 6. Microservice DTE Ping
    let dteApi = { online: false };
    try {
        const dteUrl = process.env.DTE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${dteUrl}/health`, { signal: AbortSignal.timeout(3000) })
            .catch(() => fetch(`${dteUrl}`, { signal: AbortSignal.timeout(3000) }));
        dteApi = {
            online: res && res.ok,
            status_code: res?.status || 'unreachable',
            url: dteUrl
        };
    } catch {
        dteApi = { online: false, note: 'Microservicio DTE no responde en puerto 5000' };
    }

    return {
        timestamp: new Date().toISOString(),
        server_uptime: formatUptime(Math.floor(os.uptime())),
        node_uptime: formatUptime(Math.floor(process.uptime())),
        platform: `${os.type()} ${os.release()} (${os.arch()})`,
        node_version: process.version,
        cpu: {
            model: cpuModel,
            cores: cpuCores
        },
        ram: {
            total_gb: parseFloat((totalMemBytes / (1024 ** 3)).toFixed(2)),
            used_gb: parseFloat((usedMemBytes / (1024 ** 3)).toFixed(2)),
            free_gb: parseFloat((freeMemBytes / (1024 ** 3)).toFixed(2)),
            percent_used: ramUsagePercent,
            process_rss_mb: parseFloat((procMem.rss / (1024 ** 2)).toFixed(2)),
            process_heap_used_mb: parseFloat((procMem.heapUsed / (1024 ** 2)).toFixed(2))
        },
        disk,
        database: dbStatus,
        dte_api: dteApi
    };
}

module.exports = {
    name: 'get_system_health',
    description: 'Diagnostica la salud del sistema y servidor: CPU, RAM, uso de disco, conexiones MySQL, latencia de base de datos, microservicio DTE y tiempos de actividad (uptime).',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },
    execute: async () => {
        return await getSystemHealth();
    }
};
