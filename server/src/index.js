require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initSentry, setupSentryErrorHandler } = require('./config/sentry');
const { logger, httpLogger } = require('./utils/logger');
const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');

const app = express();
app.set('trust proxy', 1);

// Initialize Sentry tracking
initSentry(app);

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const certsDir = path.join(__dirname, '..', 'certificados-p12pfx');
const crtsDir = path.join(__dirname, '..', 'certificados-crt');

[uploadsDir, certsDir, crtsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// File logger fallback stream setup
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = fs.createWriteStream(path.join(logsDir, 'server.log'), { flags: 'a' });

const _log = console.log;
const _error = console.error;
const _warn = console.warn;

const serializeLogArg = (arg) => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || arg.message;
    try {
        const json = JSON.stringify(arg);
        return json !== undefined ? json : String(arg);
    } catch {
        try { return String(arg); } catch { return '[unserializable]'; }
    }
};

console.log = (...args) => { logFile.write(`[${new Date().toISOString()}] [LOG] ${args.map(serializeLogArg).join(' ')}\n`); _log.apply(console, args); };
console.error = (...args) => { logFile.write(`[${new Date().toISOString()}] [ERROR] ${args.map(serializeLogArg).join(' ')}\n`); _error.apply(console, args); };
console.warn = (...args) => { logFile.write(`[${new Date().toISOString()}] [WARN] ${args.map(serializeLogArg).join(' ')}\n`); _warn.apply(console, args); };

// Middlewares
app.use(httpLogger);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(uploadsDir));

// Prevenir cache HTTP en respuestas dinámicas de la API
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Routes
app.use('/api/auth', authRoutes);

// Restart DTE API (reinicia proceso dte-api en puerto 5000)
app.post('/api/restart', express.json(), async (req, res) => {
    const expectedKey = process.env.RESTART_KEY;
    const key = req.body?.restart_key || req.body?.key || req.headers['x-restart-key'];
    if (!expectedKey || !key || key !== expectedKey) {
        return res.status(401).json({ message: 'restart_key inválida' });
    }
    try {
        const response = await fetch('http://localhost:5000/api/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restart_key: key })
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(502).json({ message: 'Error conectando con dte-api: ' + e.message });
    }
});

app.use('/api', apiRoutes);

// Health check & Versioning
let cachedVersionInfo = { commit: 'unknown', version: 'v2.7.0', lastCheck: 0 };

const getAppVersionInfo = () => {
    const now = Date.now();
    if (now - cachedVersionInfo.lastCheck < 5000) {
        return cachedVersionInfo;
    }
    try {
        const commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
        const count = require('child_process').execSync('git rev-list --count HEAD', { cwd: __dirname }).toString().trim();
        cachedVersionInfo = {
            commit,
            version: `v2.7.${count}`,
            lastCheck: now
        };
    } catch {
        cachedVersionInfo.lastCheck = now;
    }
    return cachedVersionInfo;
};

const initialVersionInfo = getAppVersionInfo();

app.get('/health', (req, res) => {
    const current = getAppVersionInfo();
    res.json({ 
        status: 'OK', 
        version: current.commit, 
        commit: current.commit,
        appVersion: current.version,
        environment: process.env.NODE_ENV, 
        timestamp: new Date() 
    });
});

// Serve client built files in production with strict cache headers for SPA/PWA
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, {
        setHeaders: (res, filePath) => {
            const normalized = filePath.replace(/\\/g, '/');
            if (normalized.endsWith('index.html') || normalized.endsWith('sw.js') || normalized.endsWith('manifest.webmanifest')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            } else if (normalized.includes('/assets/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
        }
    }));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/ws')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.sendFile(path.join(clientDist, 'index.html'));
        }
    });
}

// Setup Sentry express error handler
setupSentryErrorHandler(app);

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error({ err, path: req.path, method: req.method }, `GLOBAL ERROR: ${err.message}`);
    res.status(500).json({ 
        message: 'Error interno del servidor', 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const http = require('http');
const { initWebSocket, setAppVersion } = require('./services/websocket.service');
const { startWorker } = require('./services/notificationWorker');
const { startBot: startTelegramBot } = require('./services/telegram.service');
const { startSuspiciousSalesDetector } = require('./services/suspiciousSalesDetector');
const { startRrsAutoSyncCron } = require('./services/rrsVentasTiendaAutoSync.service');
const { startEnergyAutoSyncCron } = require('./services/energySystem.service');
const { preloadHaciendaCatalogs } = require('./services/catalogCache.service');
const { mailQueue } = require('./queue');

// Evitar que un error no capturado (unhandledRejection) tumbe el servidor
// a mitad de una respuesta: se registra la causa y el proceso sigue vivo.
process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Rejection (no tumba el server)');
});
process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught Exception (no tumba el server)');
});

const gracefulShutdown = async () => {
    logger.info('Iniciando cierre ordenado del servidor...');
    try {
        await mailQueue.close();
    } catch (e) {
        logger.error({ err: e.message }, 'Error cerrando mailQueue');
    }
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Inicializar el WebSocket acoplado al servidor HTTP con la versión del servidor
initWebSocket(server, { version: initialVersionInfo.version, commit: initialVersionInfo.commit });

// Monitoreo de nuevas versiones para difusión en tiempo real vía WebSocket
let lastBroadcastCommit = initialVersionInfo.commit;
setInterval(() => {
    const current = getAppVersionInfo();
    if (current.commit && current.commit !== 'unknown' && current.commit !== lastBroadcastCommit) {
        lastBroadcastCommit = current.commit;
        console.log(`[VersionWatcher] Nueva versión detectada: ${current.version} (#${current.commit}), notificando a clientes...`);
        setAppVersion({ version: current.version, commit: current.commit });
    }
}, 10000);

// Inicializar worker de notificaciones en segundo plano
startWorker();

server.listen(PORT, () => {
    console.log(`Servidor SaaS corriendo en puerto ${PORT}`);
    startTelegramBot();
    startSuspiciousSalesDetector();
    startRrsAutoSyncCron();
    startEnergyAutoSyncCron();
    preloadHaciendaCatalogs();
});
