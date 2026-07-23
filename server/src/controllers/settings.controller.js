const pool = require('../config/db');

const getSettings = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM system_settings WHERE company_id = ?', [req.company_id]);
        if (rows.length === 0) {
            // Devuelve valores por defecto si no existen
            return res.json({ system_name: 'SAAS SV', logo_url: null });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener configuración' });
    }
};

const updateSettings = async (req, res) => {
    const { system_name, logo_url } = req.body;
    try {
        // Usar ON DUPLICATE KEY UPDATE para manejar creación/actualización
        await pool.query(
            `INSERT INTO system_settings (company_id, system_name, logo_url) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE system_name = VALUES(system_name), logo_url = VALUES(logo_url)`,
            [req.company_id, system_name, logo_url]
        );
        res.json({ message: 'Configuración actualizada exitosamente' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error al actualizar configuración' });
    }
};

const getPublicSettings = async (req, res) => {
    try {
        // Obtener la configuración del sistema (global o la primera empresa activa)
        const [rows] = await pool.query('SELECT system_name, logo_url FROM system_settings LIMIT 1');
        if (rows.length === 0) {
            return res.json({ system_name: 'SAAS SV', logo_url: null });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener configuración pública' });
    }
};

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const PM2_DIR = path.join(os.homedir(), '.pm2', 'logs');

const LOG_PATHS = {
    server: [path.join(PM2_DIR, 'server-out.log'), path.join(LOG_DIR, 'server.log')],
    'dte-api': [path.join(PM2_DIR, 'dte-api-out.log'), path.join(__dirname, '..', '..', '..', 'dte-api', 'logs', 'dte-api.log')],
    webhook: [path.join(PM2_DIR, 'webhook-out.log')],
    client: [path.join(LOG_DIR, 'client.log')],
};

const resolveLogPath = (paths) => {
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
};

const streamLogs = async (req, res) => {
    const { service } = req.params;

    if (!LOG_PATHS[service]) {
        return res.status(400).json({ message: `Servicio inválido: ${service}` });
    }

    const paths = LOG_PATHS[service];
    let activePath = resolveLogPath(paths);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const send = (text) => {
        if (text.trim()) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
    };

    const readTail = (filePath) => {
        const stat = fs.statSync(filePath);
        const size = Math.min(stat.size, 50 * 1024);
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(size);
        fs.readSync(fd, buf, 0, size, stat.size - size);
        fs.closeSync(fd);
        return buf.toString('utf-8').split('\n');
    };

    const readDelta = (filePath, from) => {
        const stat = fs.statSync(filePath);
        if (stat.size <= from) return [];
        const size = stat.size - from;
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(size);
        fs.readSync(fd, buf, 0, size, from);
        fs.closeSync(fd);
        return buf.toString('utf-8').split('\n');
    };

    if (activePath) {
        try {
            const lines = readTail(activePath).slice(-500);
            lines.forEach(send);
        } catch (e) {}
    }
    res.write(`data: ${JSON.stringify({ type: 'ready' })}\n\n`);

    let currentSize = activePath ? (fs.statSync(activePath).size) : 0;

    const interval = setInterval(() => {
        try {
            const filePath = resolveLogPath(paths);
            if (!filePath) return;

            if (filePath !== activePath) {
                activePath = filePath;
                currentSize = 0;
            }

            const stat = fs.statSync(filePath);
            if (stat.size < currentSize) currentSize = 0;

            if (stat.size > currentSize) {
                const lines = readDelta(filePath, currentSize);
                lines.forEach(send);
                currentSize = stat.size;
            }
        } catch (e) {}
    }, 1000);

    req.on('close', () => {
        clearInterval(interval);
    });
};

module.exports = { getSettings, updateSettings, getPublicSettings, streamLogs };
