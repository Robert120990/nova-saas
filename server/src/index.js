require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initSentry, setupSentryErrorHandler } = require('./config/sentry');
const { logger, httpLogger } = require('./utils/logger');
const authRoutes = require('./routes/auth.routes');
const integrationContractRoutes = require('./routes/integrationContract.routes');
const apiRoutes = require('./routes/api.routes');
const idempotencyMiddleware = require('./middlewares/idempotency.middleware');
const { syncAllCrtCertificates } = require('./utils/certSync');

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
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
});
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const staticUploadsMiddleware = express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:;");
        if (/\.(html?|xml)$/i.test(filePath)) {
            res.setHeader('Content-Disposition', 'attachment');
        } else {
            res.setHeader('Content-Disposition', 'inline');
        }
    }
});
app.use('/uploads', staticUploadsMiddleware);
app.use('/api/uploads', staticUploadsMiddleware);

// Prevenir cache HTTP en respuestas dinámicas de la API
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/integration', integrationContractRoutes);

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

// Health check & Versioning
const formatSemanticVersion = (commitCount) => {
    const count = parseInt(commitCount, 10);
    if (!isNaN(count) && count >= 1000) {
        const patch = String(count - 999).padStart(2, '0');
        return `v2.08.${patch}`;
    }
    const patch = String(count || 0).padStart(2, '0');
    return `v2.07.${patch}`;
};

let cachedVersionInfo = { commit: 'unknown', version: 'v2.08.02', lastCheck: 0 };

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
            version: formatSemanticVersion(count),
            lastCheck: now
        };
    } catch {
        cachedVersionInfo.lastCheck = now;
    }
    return cachedVersionInfo;
};

const initialVersionInfo = getAppVersionInfo();

app.get(['/health', '/api/health'], (req, res) => {
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

app.use('/api', idempotencyMiddleware);
app.use('/api', apiRoutes);

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
        if (req.path.startsWith('/assets/')) {
            return res.status(404).end();
        }
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
const { startDailyBriefingCron } = require('./services/telegramDailyBriefing.service');
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

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Inicializar el WebSocket acoplado al servidor HTTP con la versión del servidor
initWebSocket(server, { version: initialVersionInfo.version, commit: initialVersionInfo.commit });

// Monitoreo de nuevas versiones para difusión en tiempo real vía WebSocket
let lastBroadcastCommit = initialVersionInfo.commit;
const versionWatcherInterval = setInterval(() => {
    const current = getAppVersionInfo();
    if (current.commit && current.commit !== 'unknown' && current.commit !== lastBroadcastCommit) {
        lastBroadcastCommit = current.commit;
        console.log(`[VersionWatcher] Nueva versión detectada: ${current.version} (#${current.commit}), notificando a clientes...`);
        setAppVersion({ version: current.version, commit: current.commit });
    }
}, 10000);

let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, 'Iniciando cierre ordenado (Graceful Shutdown) del servidor...');

    const forceExitTimer = setTimeout(() => {
        logger.error('Cierre forzado por exceder tiempo límite de 10s');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    clearInterval(versionWatcherInterval);

    // 1. Dejar de aceptar nuevas conexiones HTTP pero drenar las activas
    if (server.listening) {
        if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
        }
        await new Promise((resolve) => {
            server.close((err) => {
                if (err) logger.error({ err }, 'Error al cerrar servidor HTTP');
                else logger.info('Servidor HTTP cerró recepción de nuevas conexiones. Peticiones activas drenadas.');
                resolve();
            });
        });
    }

    // 2. Cerrar colas y workers
    try {
        await mailQueue.close();
    } catch (e) {
        logger.error({ err: e.message }, 'Error cerrando mailQueue');
    }

    // 3. Cerrar pool de base de datos
    try {
        const pool = require('./config/db');
        await pool.end();
        logger.info('Pool de conexiones MySQL cerrado exitosamente.');
    } catch (e) {
        logger.error({ err: e.message }, 'Error cerrando pool MySQL');
    }

    clearTimeout(forceExitTimer);
    logger.info('Servidor apagado ordenadamente sin pérdida de datos.');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Inicializar worker de notificaciones en segundo plano
startWorker();

server.listen(PORT, () => {
    console.log(`Servidor SaaS corriendo en puerto ${PORT}`);
    startTelegramBot();
    startDailyBriefingCron();
    startSuspiciousSalesDetector();
    startRrsAutoSyncCron();
    startEnergyAutoSyncCron();
    preloadHaciendaCatalogs();
    syncAllCrtCertificates();
    if (typeof process.send === 'function') {
        process.send('ready');
    }
});
